const API_URL = "https://precipitative-nonmotoring-michelina.ngrok-free.dev";
const WEBSITE_API_KEY = "ag_46faffb2a230b800eedbe772040b9b944bf790b76e2bc775498433a90db8eb5f"; 
const jogoLancado = true;
let translations = {};
let stripeProducts = [];
let allShopItems = [];
let inactivityTimer = null; 
let current2FASecret = null;
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
let currentLanguage = localStorage.getItem('preferred_language') || 'pt';
let featuredItems = [];
let chatSocket = null;
let activeChatRoomId = null;
let currentChatTargetId = null;
let currentChatType = null;
let myPrivateKeyObj = null;
let myPublicKeyStr = null;
let currentChatMode = 'cbc';
let chatSocketIsConnecting = false;

const SecurityManager = {
    serverRsaKey: null,
    sessionKeys: null,

    // Converte ArrayBuffer para Hex
    buf2hex: (buffer) => { 
        return Array.from(new Uint8Array(buffer))
            .map(x => x.toString(16).padStart(2, '0'))
            .join(''); 
    },
    
    // Converte Hex para Uint8Array
    hex2buf: (hexString) => {
        return new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    },

    // 1. Inicializa: Busca certificado do servidor e faz handshake
    async init() {
        try {
            console.log("🔒 Iniciando protocolo de segurança...");
            // A. Buscar chave pública RSA do servidor
            const certResp = await fetch(`${API_URL}/auth/server-cert-key`);
            if(!certResp.ok) return; // Falha silenciosa se o endpoint não existir ainda
            const certData = await certResp.json();
            
            this.serverRsaKey = await this.importRsaKey(certData.public_key);

            // B. Fazer Handshake
            await this.performHandshake();
        } catch (e) {
            console.error("⚠️ Falha na inicialização da segurança:", e);
        }
    },

    async importRsaKey(pem) {
        // Limpa cabeçalhos PEM e quebras de linha
        const b64 = pem.replace(/-----(BEGIN|END) PUBLIC KEY-----/g, "").replace(/\s/g, "");
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        
        return window.crypto.subtle.importKey(
            "spki", bytes,
            { name: "RSASSA-PSS", hash: "SHA-256" },
            true, ["verify"]
        );
    },

    async performHandshake() {
        const token = localStorage.getItem("jwt_token");
        if (!token) return;

        // A. Gerar par ECDH do cliente
        const keyPair = await window.crypto.subtle.generateKey(
            { name: "ECDH", namedCurve: "P-256" },
            true, ["deriveBits"]
        );

        // Exportar chave pública para enviar
        const rawPub = await window.crypto.subtle.exportKey("raw", keyPair.publicKey);
        const clientHex = this.buf2hex(rawPub);

        // B. Enviar ao servidor
        const resp = await fetch(`${API_URL}/auth/handshake`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ client_pub_key_hex: clientHex })
        });

        if (!resp.ok) throw new Error("Servidor rejeitou handshake");
        const data = await resp.json();

        // C. Validar Assinatura RSA (Autenticidade do Servidor)
        const serverPubBuf = this.hex2buf(data.server_pub_key_hex);
        const saltBuf = this.hex2buf(data.salt_hex);
        const sigBuf = this.hex2buf(data.signature_hex);

        // Pegar ID do usuário do token (para reconstruir o que foi assinado)
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userIdStr = String(payload.sub || payload.user_id); 
        const userIdBuf = new TextEncoder().encode(userIdStr);

        // Concatenar dados: server_pub + user_id + salt
        const dataToVerify = new Uint8Array(serverPubBuf.length + userIdBuf.length + saltBuf.length);
        dataToVerify.set(serverPubBuf);
        dataToVerify.set(userIdBuf, serverPubBuf.length);
        dataToVerify.set(saltBuf, serverPubBuf.length + userIdBuf.length);

        const isValid = await window.crypto.subtle.verify(
            { name: "RSASSA-PSS", saltLength: 32 }, // Salt length max usually corresponds to hash len
            this.serverRsaKey,
            sigBuf,
            dataToVerify
        );

        if (isValid) {
            console.log("✅ Servidor Autenticado com Sucesso (RSA Validado)!");
            console.log("🔑 Sessão Segura ID:", data.session_id);
            // Aqui futuramente derivaríamos as chaves AES-GCM
        } else {
            console.error("❌ PERIGO: Assinatura do servidor INVÁLIDA!");
        }
    }
};

/**
 * Wrapper 'fetch' personalizado para adicionar cabeçalhos padrão da API e do Ngrok.
 * @param {string} endpoint - O endpoint da API (ex: /users/me)
 * @param {object} options - As opções do fetch (method, body, etc.)
 * @returns {Promise<Response>}
 */
async function apiFetch(endpoint, options = {}) {
    let token = localStorage.getItem("jwt_token");
    
    const getHeaders = (t) => {
        const h = new Headers();
        h.append("X-API-Key", WEBSITE_API_KEY);
        h.append("ngrok-skip-browser-warning", "true");
        if (t) h.append("Authorization", `Bearer ${t}`);
        if (!options.method || options.method === 'GET') h.append("Cache-Control", "no-cache");
        if (options.body) h.append("Content-Type", "application/json");
        if (options.headers) {
            for (const [key, value] of Object.entries(options.headers)) {
                h.append(key, value);
            }
        }
        return h;
    };

    let fetchOptions = { ...options, headers: getHeaders(token) };
    
    let response = await fetch(`${API_URL}${endpoint}`, fetchOptions);

    if (response.status === 401 && !options._retry) {
        const refreshToken = localStorage.getItem("refresh_token");
        if (refreshToken) {
            console.log("Token expirado. Tentando renovar com Refresh Token...");
            try {
                const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
                    method: "POST",
                    headers: { 
                        "Content-Type": "application/json",
                        "ngrok-skip-browser-warning": "true"
                    },
                    body: JSON.stringify({ refresh_token: refreshToken })
                });

                if (refreshRes.ok) {
                    const data = await refreshRes.json();
                    console.log("Token renovado com sucesso!");
                    localStorage.setItem("jwt_token", data.access_token);
                    localStorage.setItem("refresh_token", data.refresh_token);
                    fetchOptions.headers = getHeaders(data.access_token);
                    fetchOptions._retry = true;
                    response = await fetch(`${API_URL}${endpoint}`, fetchOptions);
                } else {
                    console.warn("Refresh token inválido ou expirado. Deslogando.");
                    logout();
                }
            } catch (err) {
                console.error("Erro ao tentar refresh:", err);
                logout();
            }
        } else {
            if (!endpoint.includes('/login')) logout();
        }
    }

    return response;
}

/**
 * Insere texto de forma segura em um elemento, prevenindo XSS.
 * Converte quebras de linha (\n) em tags <br>.
 * @param {HTMLElement} element O elemento HTML onde o texto será inserido.
 * @param {string} text O texto (potencialmente inseguro) a ser inserido.
 */
function setSafeHTML(element, text) {
    if (!element) return;
    
    element.textContent = ''; 
    
    if (typeof text !== 'string' || text.length === 0) {
        return;
    }

    const lines = text.split('\n');
    
    lines.forEach((line, index) => {
        element.appendChild(document.createTextNode(line));
        if (index < lines.length - 1) {
            element.appendChild(document.createElement('br'));
        }
    });
}

let currentAesKey = null;

/**
 * [CTR MODE] Encripta o conteúdo usando a Web Crypto API (SubtleCrypto).
 * @param {string} plaintext 
 * @param {CryptoKey} key - Chave AES-256 no formato CryptoKey.
 * @returns {Promise<{ciphertext: string, iv: string}>}
 */
async function aesCtrEncrypt(plaintext, key) {
    const iv = window.crypto.getRandomValues(new Uint8Array(16)); // IV de 16 bytes
    const encoded = new TextEncoder().encode(plaintext);

    const ciphertext = await window.crypto.subtle.encrypt(
        { name: "AES-CTR", counter: iv, length: 128 },
        key,
        encoded
    );

    return {
        ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
        iv: btoa(String.fromCharCode(...iv))
    };
}

/**
 * [CTR MODE] Desencripta o conteúdo.
 * @param {string} ciphertext - Mensagem em Base64.
 * @param {string} ivBase64 - IV em Base64.
 * @param {CryptoKey} key - Chave AES-256 no formato CryptoKey.
 * @returns {Promise<string>}
 */
async function aesCtrDecrypt(ciphertext, ivBase64, key) {
    const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
    const encryptedData = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));

    const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-CTR", counter: iv, length: 128 },
        key,
        encryptedData
    );

    return new TextDecoder().decode(decrypted);
}

async function deriveKeyFromPassword(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
    );
    return window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2", salt: enc.encode(salt),
            iterations: 100000, hash: "SHA-256"
        },
        keyMaterial, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
    );
}

async function encryptDataWithPass(text, password) {
    const salt = "static_salt_mc_v1";
    const key = await deriveKeyFromPassword(password, salt);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(text);
    
    const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv }, key, encoded
    );
    
    const ivB64 = btoa(String.fromCharCode(...iv));
    const contentB64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
    return `${ivB64}:${contentB64}`;
}

async function decryptDataWithPass(encryptedBundle, password) {
    try {
        const [ivB64, contentB64] = encryptedBundle.split(':');
        const salt = "static_salt_mc_v1";
        const key = await deriveKeyFromPassword(password, salt);
        
        const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
        const content = Uint8Array.from(atob(contentB64), c => c.charCodeAt(0));
        
        const decrypted = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv }, key, content
        );
        return new TextDecoder().decode(decrypted);
    } catch (e) {
        console.error("Falha ao descriptografar MasterKey:", e);
        return null;
    }
}

function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    const isSecure = window.location.protocol === 'https:';
    let cookieString = `${name}=${value || ""}${expires}; path=/; SameSite=Lax`;
    
    if (isSecure) {
        cookieString += "; Secure";
    }

    document.cookie = cookieString;
    console.log(`🍪 Cookie gravado: ${name} (SSL: ${isSecure})`);
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i=0;i < ca.length;i++) {
        let c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}

function eraseCookie(name) {   
    document.cookie = name +'=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

function generateLocalMasterKey() {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array));
}

async function performLogin(username, password) {
    try {
        console.log("🚀 Iniciando Login...");
        const response = await apiFetch(`/website/login`, {
            method: "POST",
            body: JSON.stringify({ username, password })
        });
        const result = await response.json();
        
        if (response.status === 200 && result.access_token) {
            // Salva Token
            localStorage.setItem("jwt_token", result.access_token);
            localStorage.setItem("refresh_token", result.refresh_token);
            localStorage.setItem("username", result.username);
            
            // --- RECUPERAÇÃO DA SEGURANÇA ---
            if (result.master_key_recovery) {
                console.log("🔐 Tentando descriptografar Chave Mestra...");
                const decryptedMasterKey = await decryptDataWithPass(result.master_key_recovery, password);
                
                if (decryptedMasterKey) {
                    console.log("✅ Chave Mestra RECUPERADA! Salvando em Cookie seguro...");
                    setCookie("local_master_key", decryptedMasterKey, 7); // Salva por 7 dias
                } else {
                    console.error("❌ ERRO CRÍTICO: Senha correta, mas falha ao abrir o cofre da Chave Mestra. (Chaves antigas?)");
                    alert("Aviso: Sua senha funcionou, mas suas chaves de criptografia antigas não puderam ser desbloqueadas. Você precisará gerar novas chaves no Perfil.");
                }
            } else {
                console.warn("⚠️ Nenhuma chave mestra encontrada no servidor (Conta nova ou sem chaves).");
            }
            
            updateLoginStatus(); 
            await fetchAndCacheKeys(); // Busca as chaves PGP
            await checkCharacterSetup();
            
            closeModal('login-modal'); 
            closeModal('register-modal');
            document.getElementById('login-form')?.reset(); 
            startInactivityTimer(); 
            
        } else if (response.status === 200 && result['2fa_required'] === true) {
            console.log("🔒 2FA Solicitado...");
            closeModal('login-modal');
            const userHidden = document.getElementById('2fa-login-username');
            const passHidden = document.getElementById('2fa-login-password');
            if(userHidden) userHidden.value = username;
            if(passHidden) passHidden.value = password;
            openModal('2fa-login-modal');
        } else { 
            throw new Error(result.detail || `Erro ${response.status}`); 
        }
    } catch (error) { 
        console.error("Erro Login:", error); 
        alert(`Erro: ${error.message}`); 
    }
}

async function checkCharacterSetup() {
    try {
        const res = await apiFetch('/users/me');
        if(res.ok) {
            const user = await res.json();
            if (!user.character_name) {
                console.log("Personagem não configurado. Abrindo setup...");
            }
        }
    } catch(e) { 
        console.error("Erro ao verificar setup de personagem:", e); 
    }
}

async function performRegister(username, email, password) {
    const btn = document.querySelector('#register-form button');
    if(btn) { btn.disabled = true; btn.textContent = "Criando segurança..."; }

    try {
        console.log("1. Gerando Chave Mestra Local...");
        const localMasterKey = generateLocalMasterKey();
        
        console.log("2. Gerando par PGP usando a Chave Mestra...");
        const { privateKey, publicKey } = await openpgp.generateKey({
            type: 'ecc', curve: 'curve25519',
            userIDs: [{ name: username, email: email }],
            passphrase: localMasterKey
        });

        console.log("3. Criando backup da Chave Mestra com a Senha de Login...");
        const recoveryBlob = await encryptDataWithPass(localMasterKey, password);

        console.log("4. Enviando registro...");
        const response = await apiFetch(`/register`, {
            method: "POST",
            body: JSON.stringify({ 
                username: username, 
                email: email, 
                password: password,
                public_key: publicKey,
                encrypted_private_key: privateKey,
                master_key_recovery: recoveryBlob
            })
        });
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || `Erro ${response.status}`);
        
        localStorage.setItem("local_master_key", localMasterKey);

        alert("Conta criada com sucesso! Chaves seguras geradas.");
        document.getElementById('register-form')?.reset(); 
        closeModal('register-modal');
        
    } catch (error) { 
        console.error("Erro Registro:", error); 
        alert(`Erro ao registrar: ${error.message}`); 
    } finally {
        if(btn) { btn.disabled = false; btn.textContent = "Cadastrar"; }
    }
}

async function generateAndSaveKeys() {
    const username = localStorage.getItem("username");
    
    const password = prompt("Para gerar NOVAS chaves, digite sua senha de login (Necessária para validação e encriptação):");
    if (!username || !password) return;

    try {
        const checkRes = await apiFetch('/auth/check_password', {
            method: 'POST',
            body: JSON.stringify({ password: password })
        });
        if (!checkRes.ok) {
             const errorData = await checkRes.json();
             throw new Error(errorData.detail || "Senha inválida.");
        }
    } catch (e) {
        alert(`Falha na validação: ${e.message}. Tente novamente.`);
        return;
    }

    if(!confirm("ATENÇÃO: Gerar novas chaves tornará o histórico de chat antigo ilegível se você não tiver backup das chaves antigas. Continuar?")) return;

    console.log("Gerando novo par de chaves...");

    try {
        const { privateKey, publicKey } = await openpgp.generateKey({
            type: 'ecc',
            curve: 'curve25519',
            userIDs: [{ name: username }],
            passphrase: password
        });

        const response = await apiFetch('/users/me/keys', {
            method: 'POST',
            body: JSON.stringify({
                public_key: publicKey,
                encrypted_private_key: privateKey
            })
        });

        if (response.ok) {
            console.log("Novas chaves salvas.");
            localStorage.setItem("pgp_private_key", privateKey);
            localStorage.setItem("pgp_public_key", publicKey);
            
            try {
                myPrivateKeyObj = await openpgp.decryptKey({
                    privateKey: await openpgp.readPrivateKey({ armoredKey: privateKey }),
                    passphrase: password
                });
                myPublicKeyStr = publicKey;
                alert("Novas chaves geradas e ativadas com sucesso!");
            } catch(e) {
                console.error("Erro ao desbloquear nova chave", e);
            }
        } else {
            alert("Erro ao salvar chaves no servidor.");
        }
    } catch (error) {
        console.error("Erro fatal na criptografia:", error);
        alert("Erro ao gerar chaves: " + error.message);
    }
}

async function fetchAndCacheKeys() {
    try {
        const res = await apiFetch('/users/me/keys_secure');
        if (res.ok) {
            const data = await res.json();
            
            setCookie("pgp_public_key", data.public_key, 30);
            setCookie("pgp_private_key", data.encrypted_private_key, 30);
            
            await tryUnlockKey();
        } 
    } catch (e) {
        console.error("Erro ao buscar chaves:", e);
    }
}

async function tryUnlockKey() {
    const armoredKey = getCookie("pgp_private_key");
    const masterKey = getCookie("local_master_key");

    if (armoredKey && masterKey) {
        try {
            myPrivateKeyObj = await openpgp.decryptKey({
                privateKey: await openpgp.readPrivateKey({ armoredKey: armoredKey }),
                passphrase: masterKey
            });
            myPublicKeyStr = localStorage.getItem("pgp_public_key");
            console.log("✅ Chat Seguro: Chave PGP desbloqueada automaticamente via MasterKey.");
            return true;
        } catch(e) {
            console.error("Falha ao desbloquear chave com MasterKey local:", e);
            return false;
        }
    } else {
        console.log("Aguardando login ou chave mestra para desbloquear chat.");
        return false;
    }
}

async function passiveKeyRestoration() {
    const unlockedArmored = sessionStorage.getItem("pgp_unlocked_private_armored");
    const publicKey = localStorage.getItem("pgp_public_key");

    if (unlockedArmored && publicKey && !myPrivateKeyObj) {
        try {
            const privateKeyObj = await openpgp.readPrivateKey({ armoredKey: unlockedArmored });

            myPrivateKeyObj = privateKeyObj;
            myPublicKeyStr = publicKey; 
            
            console.log("Estado E2EE restaurado de forma silenciosa (SessionStorage).");
            return true;
        } catch (e) {
            sessionStorage.removeItem("pgp_unlocked_private_armored");
            console.error("Falha ao restaurar chave. Requer reautenticação completa.", e);
            return false;
        }
    }
    return false;
}

async function restoreDecryptionState(password) {
    const errorEl = document.getElementById('pgp-unlock-error');
    const submitBtn = document.querySelector('#pgp-unlock-form button');
    
    errorEl.textContent = '';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Verificando Senha...';

    try {
        const checkRes = await apiFetch('/auth/check_password', {
            method: 'POST',
            body: JSON.stringify({ password: password })
        });
        if (!checkRes.ok) {
            throw new Error("Senha de login incorreta. Acesso negado.");
        }

        await fetchAndCacheKeys(password); 
        
        if (myPrivateKeyObj) {
            closeModal('pgp-unlock-modal');
            document.getElementById('pgp-unlock-form').reset();
            console.log("Estado E2EE reativado. Conectando WebSocket...");
            
            connectChatWebSocket(); 
        } else {
            throw new Error("Chave PGP corrompida. Tente gerar novas chaves.");
        }
    } catch (e) {
        errorEl.textContent = `Falha: ${e.message}`;
        document.getElementById('pgp-unlock-password').value = '';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Desbloquear Chat';
    }
}

async function encryptMessageForUser(text, publicKeyArmored) {
    try {
        const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored });
        const message = await openpgp.createMessage({ text: text });
        return await openpgp.encrypt({
            message,
            encryptionKeys: publicKey
        });
    } catch (e) {
        console.error("Erro ao encriptar para user específico:", e);
        return null;
    }
}

async function checkAndResyncPeer(roomId, peerId) {
    const peerPublicKeyArmored = await getTargetPublicKey(peerId);
    if (!peerPublicKeyArmored) {
        alert("Não foi possível obter a chave pública do parceiro para ressincronia.");
        return;
    }

    const history = await apiFetch(`/game/chat/history/${roomId}`);
    const messages = await history.json();
    
    const savedMode = localStorage.getItem(`pref_cipher_mode_${peerId}`) || 'cbc';
    console.log(`Ressincronizando histórico para User ${peerId} usando modo: ${savedMode.toUpperCase()}`);

    const messagesToResync = [];

    for (const msg of messages) {
        if (!msg.content) continue; 
        
        let plainText = msg.content;
        
        if (msg.content.includes("BEGIN PGP MESSAGE")) {
            try {
                plainText = await decryptMessage(msg.content);
                
                if (plainText.startsWith("[Erro:")) continue; 
            } catch (e) { 
                console.warn("Falha na descriptografia durante o resync.", e);
                continue; 
            }
        }
        
        if (!msg.content.includes("BEGIN PGP MESSAGE") && plainText === msg.content) {
            continue;
        }

        const reEncrypted = await encryptMessageForUser(plainText, peerPublicKeyArmored);
        
        if (reEncrypted) { 
            messagesToResync.push({
                original_message_id: msg.message_id,
                new_encrypted_content: reEncrypted
            });
        }
    }

    if (messagesToResync.length > 0) {
        await apiFetch('/game/chat/resync_history', {
            method: 'POST',
            body: JSON.stringify({
                target_user_id: peerId,
                room_id: roomId,
                messages: messagesToResync
            })
        });
        alert(`Sucesso! ${messagesToResync.length} mensagens sincronizadas/recuperadas para o parceiro.`);
    } else {
        alert("Nenhuma mensagem precisou ser ressincronizada.");
    }
}

function logout() {
    localStorage.removeItem("jwt_token"); 
    localStorage.removeItem("username");
    if (inactivityTimer) { clearTimeout(inactivityTimer); 
        inactivityTimer = null; 
        console.log("Timer cancelado (logout)."); 
    } 
    const invGrid = document.getElementById('profile-inventory-grid');
    if (invGrid) invGrid.innerHTML = '';
    updateLoginStatus(); 
    showPage('inicio');
}

function startPresenceHeartbeat() {
    if (localStorage.getItem("jwt_token")) {
        apiFetch('/game/presence/heartbeat', { method: 'POST' }).catch(e => console.error("Erro heartbeat", e));
    }

    setInterval(() => {
        if (localStorage.getItem("jwt_token")) {
            apiFetch('/game/presence/heartbeat', { method: 'POST' })
                .then(() => console.log("Heartbeat enviado."))
                .catch(e => console.error("Erro heartbeat", e));
        }
    }, 60000);
}

const publicKeyCache = {}; 

async function getTargetPublicKey(userId) {
    if (publicKeyCache[userId]) return publicKeyCache[userId];

    try {
        const res = await apiFetch(`/users/${userId}/public_key`);
        if (res.ok) {
            const data = await res.json();
            publicKeyCache[userId] = data.public_key;
            return data.public_key;
        }
    } catch (e) {
        console.error("Erro ao buscar chave pública:", e);
    }
    return null;
}

async function loadProfileData() {
    const loadingDiv = document.getElementById('profile-info-loading');
    const contentDiv = document.getElementById('profile-info-content');
    const errorDiv = document.getElementById('profile-info-error');
    const token = localStorage.getItem("jwt_token");

    loadingDiv?.classList.remove('hidden'); 
    contentDiv?.classList.add('hidden'); 
    errorDiv?.classList.add('hidden');
    document.getElementById('profile-inventory-grid').innerHTML = '';

    if (!token) {
        if(errorDiv) errorDiv.textContent = translateKey('error_profile_load_generic'); 
        errorDiv?.classList.remove('hidden');
        loadingDiv?.classList.add('hidden'); 
        return;
    }

    try {
        const response = await apiFetch("/users/me");
        const data = await response.json();
        if (!response.ok) {
             if (response.status === 401 || data.detail.toLowerCase().includes("token")) {
                 logout();
             }
             throw new Error(data.detail || `Erro ${response.status}`);
        }

        document.getElementById('profile-username').textContent = data.username;
        document.getElementById('profile-email').textContent = data.email;
        document.getElementById('profile-currency').textContent = data.in_game_currency;
        document.getElementById('profile-premium').textContent = data.premium_currency;
        document.getElementById('profile-score').textContent = data.total_score;
        document.getElementById('profile-created').textContent = new Date(data.created_at).toLocaleDateString();
        document.getElementById('edit-email').value = data.email; 

        if (data.discord_id) { 
            document.getElementById('discord-linked-status')?.classList.remove('hidden');
            document.getElementById('link-discord-form')?.classList.add('hidden');
        } else {
            document.getElementById('link-discord-form')?.classList.remove('hidden');
            document.getElementById('discord-linked-status')?.classList.add('hidden');
        }

        contentDiv?.classList.remove('hidden'); 
        loadingDiv?.classList.add('hidden');
        
        loadInventory();
        check2FAStatus();

        try {
            const statsResponse = await apiFetch("/users/me/stats");
            const statsData = await statsResponse.json();
            if (!statsResponse.ok) throw new Error(statsData.detail || 'Erro ao buscar stats');

            const wins = statsData.total_wins || 0;
            const matches = statsData.total_matches_played || 0;
            document.getElementById('profile-matches').textContent = matches;
            document.getElementById('profile-wins').textContent = wins;
            
            let winRate = (matches > 0) ? (wins / matches) * 100 : 0;
            document.getElementById('profile-winrate').textContent = `${winRate.toFixed(1)}%`;
            
        } catch (statsError) {
            console.error("Erro ao carregar estatísticas:", statsError);
            document.getElementById('profile-matches').textContent = '-';
            document.getElementById('profile-wins').textContent = '-';
            document.getElementById('profile-winrate').textContent = 'Erro';
        }

    } catch (error) {
        console.error("Erro ao carregar perfil:", error);
        if(errorDiv) errorDiv.textContent = `${translateKey('error_profile_load')} ${error.message}`; 
        errorDiv?.classList.remove('hidden');
        loadingDiv?.classList.add('hidden');
    }
}

async function loadInventory() {
    const grid = document.getElementById('profile-inventory-grid');
    const token = localStorage.getItem("jwt_token");

    if (!grid) return;
    if (!token) {
        grid.innerHTML = '<p>Você precisa estar logado para ver seu inventário.</p>';
        return;
    }
    
    grid.innerHTML = '<p>Carregando inventário...</p>';

    try {
        const response = await apiFetch("/users/me/inventory");
        const items = await response.json();
        if (!response.ok) throw new Error(items.detail || 'Falha ao buscar inventário');

        grid.innerHTML = '';
        if (items.length === 0) {
            grid.innerHTML = '<p>Seu inventário está vazio.</p>';
            return;
        }

        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'shop-item-card';
            
            if (item.image_url) {
                const img = document.createElement('img');
                img.src = item.image_url;
                img.alt = item.item_name;
                img.className = 'shop-item-image';
                card.appendChild(img);
            } else {
                const placeholder = document.createElement('div');
                placeholder.className = 'shop-item-image-placeholder';
                placeholder.textContent = '?';
                card.appendChild(placeholder);
            }

            const h3 = document.createElement('h3');
            const levelText = (item.item_level && item.item_level > 1) ? ` (+${item.item_level})` : '';
            h3.textContent = `${item.item_name}${levelText}`;
            card.appendChild(h3);

            if (['skin', 'tool', 'pet'].includes(item.category)) {
                const currentLevel = item.item_level || 1;
                const levelBadge = document.createElement('div');
                levelBadge.style.cssText = "background: #444; color: #fff; padding: 2px 8px; border-radius: 4px; display: inline-block; font-size: 0.8rem; margin-bottom: 5px;";
                levelBadge.textContent = `Nível ${currentLevel} / 50`;
                card.appendChild(levelBadge);
            }

            const pDesc = document.createElement('p');
            pDesc.className = 'item-description';
            pDesc.textContent = item.description || '...';
            card.appendChild(pDesc);

            const actionDiv = document.createElement('div');
            actionDiv.className = 'buy-options';
            actionDiv.style.marginTop = '1rem';
            
            const currentLevel = item.item_level || 1;

            if (currentLevel < 50 && ['skin', 'tool', 'pet'].includes(item.category)) {
                const upgradeBtn = document.createElement('button');
                upgradeBtn.className = 'register-btn';
                upgradeBtn.style.fontSize = '0.9rem';
                upgradeBtn.style.width = '100%';
                upgradeBtn.style.marginBottom = '5px';
                let baseCost = 100;
                if (item.rarity === 'rare') baseCost = 200;
                else if (item.rarity === 'epic') baseCost = 500;
                else if (item.rarity === 'legendary') baseCost = 1000;
                
                const nextCost = Math.floor(baseCost * Math.pow(currentLevel, 1.5));
                
                upgradeBtn.innerHTML = `<i class="fa-solid fa-arrow-up"></i> Melhorar (${nextCost} $)`;
                upgradeBtn.onclick = () => handleUpgradeSkin(item.item_id, item.item_name);
                actionDiv.appendChild(upgradeBtn);
                
            } else if (currentLevel >= 50 && ['skin', 'tool', 'pet'].includes(item.category)) {
                const maxBtn = document.createElement('button');
                maxBtn.className = 'buy-button disabled';
                maxBtn.style.width = '100%';
                maxBtn.textContent = 'Nível Máximo';
                maxBtn.disabled = true;
                actionDiv.appendChild(maxBtn);
            }

            const spanQty = document.createElement('span');
            spanQty.style.cssText = 'display:block; font-size: 1rem; font-weight: bold; color: var(--text-primary); margin-top: 5px;';
            spanQty.textContent = `Qtd: ${item.total_quantity}`;
            actionDiv.appendChild(spanQty);

            card.appendChild(actionDiv);
            grid.appendChild(card);
        });

    } catch (error) {
        console.error("Erro ao carregar inventário:", error);
        grid.innerHTML = `<p style="color: var(--error-color);">Erro ao carregar inventário: ${error.message}</p>`;
    }
}

async function handleUpgradeSkin(itemId, itemName) {
    if (!confirm(`Deseja gastar moedas para tentar melhorar o nível de '${itemName}'?`)) return;

    try {
        const response = await apiFetch("/game/skins/upgrade", {
            method: 'POST',
            body: JSON.stringify({ item_id: itemId })
        });
        const result = await response.json();
        
        if (response.ok) {
            alert(result.message);
            loadUserWallet();
            loadInventory();
        } else {
            alert(`Falha no upgrade: ${result.detail}`);
        }
    } catch (error) {
        console.error("Erro upgrade:", error);
        alert("Erro ao processar upgrade.");
    }
}

async function loadVipStatus() {
    const container = document.getElementById('vip-status-container');
    if (!container) return;

    const levelEl = document.getElementById('vip-level');
    const spentEl = document.getElementById('vip-total-spent');
    const progressTextEl = document.getElementById('vip-progress-bar-text');
    const progressBarEl = document.getElementById('vip-progress-bar');
    const rewardsListEl = document.getElementById('vip-rewards-list');

    try {
        const response = await apiFetch("/users/me/vip_status");
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Erro ao buscar status VIP');

        levelEl.textContent = data.current_vip_level;
        spentEl.textContent = data.total_premium_spent;

        const progressPercent = (data.progress_to_next_level / data.next_level_cost) * 100;
        progressTextEl.textContent = `(${data.progress_to_next_level} / ${data.next_level_cost} Cash)`;
        progressBarEl.style.width = `${progressPercent}%`;

        rewardsListEl.innerHTML = '';
        if (data.rewards.length === 0) {
            rewardsListEl.innerHTML = "<p>Nenhuma recompensa VIP definida ainda.</p>";
            return;
        }

        data.rewards.forEach(level => {
            const card = document.createElement('div');
            card.className = 'shop-item-card';
            let buttonsHtml = '';
            const isUnlocked = level.is_unlocked;

            const fixed = level.fixed_reward;
            if (fixed.currency > 0 || fixed.premium > 0) {
                let fixedDesc = [];
                if (fixed.currency > 0) fixedDesc.push(`${fixed.currency} Moedas`);
                if (fixed.premium > 0) fixedDesc.push(`${fixed.premium} Cash`);

                if (fixed.is_claimed) {
                    buttonsHtml += `<button class="buy-button disabled" disabled>Pacote Fixo Resgatado</button>`;
                } else if (isUnlocked) {
                    buttonsHtml += `<button class="buy-button buy-vip" data-level="${level.level}" data-type="fixed">Resgatar (${fixedDesc.join(' + ')})</button>`;
                } else {
                    buttonsHtml += `<button class="buy-button not-unlocked" disabled>${fixedDesc.join(' + ')} (Bloqueado)</button>`;
                }
            }

            level.item_choices.forEach(item => {
                if (item.is_claimed) {
                    buttonsHtml += `<button class="buy-button disabled" disabled>${item.item_name} (Resgatado)</button>`;
                } else if (isUnlocked) {
                    buttonsHtml += `<button class="buy-button buy-vip buy-premium" data-level="${level.level}" data-type="item" data-item-id="${item.item_id}">Resgatar (${item.item_name})</button>`;
                } else {
                    buttonsHtml += `<button class="buy-button not-unlocked" disabled>${item.item_name} (Bloqueado)</button>`;
                }
            });

            card.innerHTML = `
                <h3 style="color: var(--accent-orange);">Nível ${level.level}</h3>
                <p class="item-description">${level.reward_description || 'Recompensa'}</p>
                <div class="buy-options" style="margin-top: 1rem; gap: 0.5rem;">
                    ${buttonsHtml || '<p>Nenhuma recompensa definida.</p>'}
                </div>
            `;

            card.querySelectorAll('.buy-button.buy-vip').forEach(button => {
                button.addEventListener('click', handleClaimVipReward);
            });

            rewardsListEl.appendChild(card);
        });

    } catch (error) {
        console.error("Erro ao carregar status VIP:", error);
        container.innerHTML = `<p style="color: var(--error-color);">Erro ao carregar dados VIP: ${error.message}</p>`;
    }
}

async function handleClaimVipReward(event) {
    const button = event.target;
    const level = parseInt(button.dataset.level);
    const claimType = button.dataset.type;
    const itemId = parseInt(button.dataset.itemId) || null;

    if (isNaN(level) || !claimType) {
        alert("Erro: Botão de resgate inválido.");
        return;
    }

    let confirmMsg = `Resgatar ${claimType === 'fixed' ? 'pacote fixo' : `item`} do Nível ${level}?`;
    if (!confirm(confirmMsg)) return;

    button.disabled = true;
    button.textContent = 'Processando...';

    try {
        const response = await apiFetch("/users/me/vip_claim_reward", {
            method: 'POST',
            body: JSON.stringify({ 
                level: level,
                claim_type: claimType,
                chosen_item_id: itemId
            })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || 'Falha ao resgatar');

        alert(result.message);
        loadVipStatus();
        loadUserWallet();

    } catch (error) {
        console.error("Erro ao resgatar recompensa VIP:", error);
        alert(`Erro: ${error.message}`);
        button.disabled = false;
        button.textContent = 'Tentar Novamente';
    }
}

async function loadCodexIngredients() {
    const grid = document.getElementById('codex-ingredients-grid');
    if (!grid) return;
    grid.innerHTML = `<p>${translateKey('shop_loading')}</p>`;
    
    try {
        const response = await apiFetch("/game/codex/ingredients");
        const ingredients = await response.json();
        if (!response.ok) throw new Error(ingredients.detail || 'Erro ao buscar ingredientes');
        
        grid.innerHTML = '';
        if (ingredients.length === 0) {
            grid.innerHTML = '<p>Nenhum ingrediente encontrado.</p>';
            return;
        }
        
        ingredients.forEach(ing => {
            const card = document.createElement('div');
            card.className = 'codex-card';

            if (ing.image_url) {
                const img = document.createElement('img');
                img.src = ing.image_url;
                img.alt = ing.name;
                img.className = 'shop-item-image';
                card.appendChild(img);
            } else {
                const placeholder = document.createElement('div');
                placeholder.className = 'shop-item-image-placeholder';
                placeholder.textContent = '?';
                card.appendChild(placeholder);
            }

            const h3 = document.createElement('h3');
            h3.textContent = ing.name;
            card.appendChild(h3);

            const pDesc = document.createElement('p');
            pDesc.className = 'item-description';
            pDesc.textContent = ing.description || 'Um ingrediente...';
            card.appendChild(pDesc);

            const h4Flavor = document.createElement('h4');
            h4Flavor.style.cssText = "margin-top: 1rem; margin-bottom: 0.5rem; color: var(--text-primary);";
            h4Flavor.textContent = "Atributos de Sabor";
            card.appendChild(h4Flavor);

            const ulFlavor = document.createElement('ul');
            ulFlavor.className = 'codex-stats';
            ulFlavor.innerHTML = `
                <li><strong>Salgado:</strong> <span>${ing.attr_salty}</span></li>
                <li><strong>Doce:</strong> <span>${ing.attr_sweet}</span></li>
                <li><strong>Ácido:</strong> <span>${ing.attr_sour}</span></li>
                <li><strong>Amargo:</strong> <span>${ing.attr_bitter}</span></li>
                <li><strong>Umami:</strong> <span>${ing.attr_umami}</span></li>
                <li><strong>Textura:</strong> <span>${ing.attr_texture}</span></li>
                <li><strong>Aroma:</strong> <span>${ing.attr_aroma}</span></li>
            `;
            card.appendChild(ulFlavor);

            const h4Rules = document.createElement('h4');
            h4Rules.style.cssText = "margin-top: 1rem; margin-bottom: 0.5rem; color: var(--text-primary);";
            h4Rules.textContent = "Regras de Jogo";
            card.appendChild(h4Rules);

            let tags_text = "Nenhuma";
            if (ing.tags && ing.tags.length > 0) {
                tags_text = ing.tags.map(tag => tag.charAt(0).toUpperCase() + tag.slice(1)).join(', ');
            }

            let cook_rules_html = `
                <li style="color: ${ing.is_toxic_raw ? 'var(--error-color)' : 'inherit'};">
                    <strong>Tóxico Cru:</strong> <span>${ing.is_toxic_raw ? 'Sim' : 'Não'}</span>
                </li>
                <li style="color: ${ing.needs_cooking ? 'var(--accent-orange)' : 'inherit'};">
                    <strong>Precisa Cozinhar:</strong> <span>${ing.needs_cooking ? 'Sim' : 'Não'}</span>
                </li>
            `;
            if (ing.needs_cooking) {
                cook_rules_html += `
                    <li><strong>Tempo Mín. (Seg):</strong> <span>${ing.cook_time_min}s</span></li>
                    <li><strong>Tempo Máx. (Seg):</strong> <span>${ing.cook_time_max}s</span></li>
                `;
            }

            const ulRules = document.createElement('ul');
            ulRules.className = 'codex-stats';
            ulRules.innerHTML = `<li><strong>Tags:</strong> <span></span></li>` + cook_rules_html;
            ulRules.querySelector('li > span').textContent = tags_text;
            card.appendChild(ulRules);

            grid.appendChild(card);
        });
        
    } catch (error) {
        console.error("Erro ao carregar ingredientes:", error);
        grid.innerHTML = `<p style="color: var(--error-color);">Erro ao carregar ingredientes: ${error.message}</p>`;
    }
}

async function loadCodexRecipes() {
    const grid = document.getElementById('codex-recipes-grid');
    if (!grid) return;
    grid.innerHTML = `<p>${translateKey('shop_loading')}</p>`;
    
    try {
        const response = await apiFetch("/game/crafting/recipes");
        const recipes = await response.json();
        if (!response.ok) throw new Error(recipes.detail || 'Erro ao buscar receitas');
        
        grid.innerHTML = '';
        if (recipes.length === 0) {
            grid.innerHTML = '<p>Nenhuma receita encontrada.</p>';
            return;
        }
        
        recipes.forEach(recipe => {
            const card = document.createElement('div');
            card.className = 'codex-card';

            if (recipe.output_image_url) {
                const img = document.createElement('img');
                img.src = recipe.output_image_url;
                img.alt = recipe.output_item_name;
                img.className = 'shop-item-image';
                card.appendChild(img);
            } else {
                const placeholder = document.createElement('div');
                placeholder.className = 'shop-item-image-placeholder';
                placeholder.textContent = '?';
                card.appendChild(placeholder);
            }

            const h3 = document.createElement('h3');
            h3.textContent = `${recipe.output_item_name} (x${recipe.output_item_quantity})`;
            card.appendChild(h3);

            const divIngredients = document.createElement('div');
            divIngredients.className = 'codex-recipe-ingredients';

            const strong = document.createElement('strong');
            strong.textContent = 'Ingredientes:';
            divIngredients.appendChild(strong);

            const ul = document.createElement('ul');
            if (recipe.ingredients && recipe.ingredients.length > 0) {
                recipe.ingredients.forEach(ing => {
                    const li = document.createElement('li');
                    li.textContent = `${ing.item_name} (x${ing.quantity_required})`;
                    ul.appendChild(li);
                });
            } else {
                const li = document.createElement('li');
                li.textContent = 'Nenhum';
                ul.appendChild(li);
            }
            divIngredients.appendChild(ul);
            card.appendChild(divIngredients);

            grid.appendChild(card);
        });
        
    } catch (error) {
        console.error("Erro ao carregar receitas:", error);
        grid.innerHTML = `<p style="color: var(--error-color);">Erro ao carregar receitas: Faça Login para ter acesso</p>`;
    }
}

async function check2FAStatus() {
    const statusText = document.getElementById('2fa-status-text');
    const enableBtn = document.getElementById('btn-enable-2fa');
    const disableBtn = document.getElementById('btn-disable-2fa');
    const token = localStorage.getItem("jwt_token");

    if (!statusText || !enableBtn || !disableBtn || !token) return;

    statusText.textContent = 'Verificando...';
    enableBtn.classList.add('hidden');
    disableBtn.classList.add('hidden');

    try {
        const response = await apiFetch(`/users/me`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail);

        if (data.is_two_factor_enabled) {
            statusText.textContent = 'Ativado';
            statusText.style.color = '#4caf50';
            disableBtn.classList.remove('hidden');
        } else {
            statusText.textContent = 'Desativado';
            statusText.style.color = 'orange';
            enableBtn.classList.remove('hidden');
        }
    } catch (error) {
        console.error("Erro ao verificar status 2FA:", error);
        statusText.textContent = 'Erro ao verificar';
        statusText.style.color = 'red';
    }
}

async function start2FASetup() {
    const qrCodeImg = document.getElementById('2fa-qr-code');
    const secretKeyInput = document.getElementById('2fa-secret-key');
    const errorDiv = document.getElementById('2fa-setup-error');
    const token = localStorage.getItem("jwt_token");

    if (!qrCodeImg || !secretKeyInput || !errorDiv || !token) return;
    
    qrCodeImg.src = ''; secretKeyInput.value = ''; errorDiv.textContent = '';
    openModal('2fa-setup-modal');
    qrCodeImg.alt = "Carregando QR Code...";

    try {
        const response = await apiFetch(`/users/me/2fa/setup`, {
            method: 'GET'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail);

        current2FASecret = data.secret;
        qrCodeImg.src = data.qr_code;
        qrCodeImg.alt = "QR Code 2FA";
        secretKeyInput.value = data.secret;

    } catch (error) {
        console.error("Erro ao iniciar setup 2FA:", error);
        errorDiv.textContent = `Erro: ${error.message}`;
        closeModal('2fa-setup-modal');
    }
}

async function confirmAndEnable2FA(code) {
    const errorDiv = document.getElementById('2fa-setup-error');
    const token = localStorage.getItem("jwt_token");

    if (!current2FASecret || !code || !token || !errorDiv) return;
    errorDiv.textContent = '';

    try {
        const response = await apiFetch(`/users/me/2fa/enable`, {
            method: 'POST',
            body: JSON.stringify({ secret: current2FASecret, code: code })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail);

        alert(result.message);
        closeModal('2fa-setup-modal');
        current2FASecret = null;
        document.getElementById('2fa-enable-form').reset();
        check2FAStatus();

    } catch (error) {
        console.error("Erro ao ativar 2FA:", error);
        errorDiv.textContent = `Erro: ${error.message}`;
    }
}

async function disable2FA() {
     const token = localStorage.getItem("jwt_token");
     if (!token) return;

     const code = prompt("Para desativar o 2FA, por favor, insira o código atual do seu aplicativo autenticador:");
     if (!code) return;

     try {
         const response = await apiFetch(`/users/me/2fa/disable`, {
             method: 'POST',
             body: JSON.stringify({ code: code })
         });
         const result = await response.json();
         if (!response.ok) throw new Error(result.detail);

         alert(result.message);
         check2FAStatus();

     } catch (error) {
          console.error("Erro ao desativar 2FA:", error);
          alert(`Erro: ${error.message}`);
     }
}

async function performLogin2FA(username, password, code) {
     const errorDiv = document.getElementById('2fa-login-error');
     if (!errorDiv) return; errorDiv.textContent = '';
     try {
        console.log("Chamando API /website/login/2fa...");
        const response = await apiFetch(`/website/login/2fa`, {
            method: "POST",
            body: JSON.stringify({ username, password, code })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || `Erro ${response.status}`);
        localStorage.setItem("jwt_token", result.access_token);
        localStorage.setItem("refresh_token", result.refresh_token);
        localStorage.setItem("username", result.username);
        updateLoginStatus(); 
        await fetchAndCacheKeys(password);
        closeModal('2fa-login-modal');
        document.getElementById('2fa-login-form').reset(); 
        startInactivityTimer();
    } catch (error) { console.error("Erro Login 2FA:", error); errorDiv.textContent = `Erro: ${error.message}`; }
}

async function startGoogleLogin() {
    try {
        const response = await apiFetch("/auth/google/login_url");
        const data = await response.json();
        window.location.href = data.url;
    } catch (error) {
        alert("Erro ao iniciar login Google: " + error.message);
    }
}

async function handleGoogleCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
        window.history.replaceState({}, document.title, "/");
        
        console.log("Processando login Google...");
        
        try {
            const response = await apiFetch(`/auth/google/callback?code=${code}`);
            const data = await response.json();
            
            if (data.status === 'success') {
                localStorage.setItem("jwt_token", data.access_token);
                localStorage.setItem("refresh_token", data.refresh_token);
                localStorage.setItem("username", data.username);
                updateLoginStatus();
                alert(`Bem-vindo de volta, ${data.username}!`);
            } else if (data.status === 'setup_required') {
                sessionStorage.setItem("temp_google_token", data.temp_token);
                openModal('google-finalize-modal');
            }
        } catch (error) {
            alert("Falha no login Google: " + error.message);
        }
    }
}

async function finalizeGoogleRegistration(e) {
    e.preventDefault();
    const tempToken = sessionStorage.getItem("temp_google_token");
    if (!tempToken) { 
        alert("Sessão expirada."); 
        return; 
    }

    const data = {
        username: document.getElementById('g-username').value,
        character_name: document.getElementById('g-character').value,
        gender: document.getElementById('g-gender').value
    };

    try {
        const response = await fetch(`${API_URL}/auth/google/finalize`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${tempToken}`,
                "X-API-Key": WEBSITE_API_KEY,
                "ngrok-skip-browser-warning": "true"
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail);

        localStorage.setItem("jwt_token", result.access_token);
        localStorage.setItem("refresh_token", result.refresh_token);
        localStorage.setItem("username", result.username);
        const payload = JSON.parse(atob(result.access_token.split('.')[1]));
        localStorage.setItem("user_id", payload.id);
        
        closeModal('google-finalize-modal');
        sessionStorage.removeItem("temp_google_token");
        
        updateLoginStatus();

        let pgpPass = prompt("Conta criada! Para ativar o Chat Seguro, defina uma senha para suas chaves de criptografia (ou deixe em branco, mas será menos seguro):");
        if (pgpPass === null) pgpPass = "";

        console.log("Gerando chaves PGP para conta Google...");
        await generateAndSaveKeys(pgpPass);

        alert("Bem-vindo! Sua conta e chaves de segurança foram configuradas.");
        startInactivityTimer();

    } catch (error) {
        alert("Erro: " + error.message);
    }
}

async function updateProfileData(newEmail) {
     const token = localStorage.getItem("jwt_token");
     if (!token) { alert("Sessão expirada. Faça login novamente."); return; }
     try {
         const response = await apiFetch(`/users/me`, {
             method: 'PATCH',
             body: JSON.stringify({ email: newEmail })
         });
         const result = await response.json();
         if (!response.ok) throw new Error(result.detail || 'Erro desconhecido ao atualizar');
         alert("Email atualizado com sucesso!"); 
         closeModal('edit-profile-modal');
         loadProfileData();
     } catch (error) {
         console.error("Erro ao atualizar perfil:", error);
         alert(`Erro ao salvar: ${error.message}`);
     }
}

async function loadUserWallet() {
    const token = localStorage.getItem("jwt_token");
    const currencyEl = document.getElementById('sidebar-currency');
    const premiumEl = document.getElementById('sidebar-premium');

    if (!token) return;
    if (!currencyEl || !premiumEl) return;

    currencyEl.textContent = '...';
    premiumEl.textContent = '...';

    try {
        const response = await apiFetch(`/users/me`);
        if (!response.ok) {
             currencyEl.textContent = 'Erro'; premiumEl.textContent = 'Erro';
             if (response.status === 401) logout();
             return;
        }
        const data = await response.json();
        currencyEl.textContent = data.in_game_currency;
        premiumEl.textContent = data.premium_currency;
    } catch (error) {
        console.error("Erro ao carregar wallet:", error);
        currencyEl.textContent = 'Falha';
        premiumEl.textContent = 'Falha';
    }
}

async function loadTeamInvites() {
    const list = document.getElementById('my-team-invites-list');
    if (!list) return;
    list.innerHTML = '<p>Carregando convites...</p>';

    try {
        const res = await apiFetch('/game/teams/invites/my');
        const invites = await res.json();

        list.innerHTML = '';
        if (invites.length === 0) {
            list.innerHTML = '<p style="color:#aaa; font-style:italic;">Nenhum convite pendente.</p>';
            return;
        }

        invites.forEach(inv => {
            const div = document.createElement('div');
            div.className = 'shop-item-card';
            div.style.marginBottom = '1rem';
            div.style.textAlign = 'left';
            div.innerHTML = `
                <h4 style="color:var(--accent-orange)">${inv.team_name} [${inv.team_tag}]</h4>
                <p style="font-size:0.9rem">Convidado por: <strong>${inv.inviter_username}</strong></p>
                <div style="display:flex; gap:10px; margin-top:10px;">
                    <button class="register-btn" style="padding:0.5rem 1rem; font-size:0.9rem" onclick="acceptTeamInvite(${inv.invite_id})">Aceitar</button>
                    <button class="delete-btn" style="padding:0.5rem 1rem; font-size:0.9rem" onclick="declineTeamInvite(${inv.invite_id})">Recusar</button>
                </div>
            `;
            list.appendChild(div);
        });
    } catch (e) {
        list.innerHTML = '<p class="error-message">Erro ao carregar convites.</p>';
    }
}

async function acceptTeamInvite(inviteId) {
    try {
        const res = await apiFetch(`/game/teams/invites/${inviteId}/accept`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            alert("Bem-vindo ao time!");
            loadMyTeamData();
        } else {
            alert(data.detail);
        }
    } catch (e) { alert("Erro ao aceitar."); }
}

async function declineTeamInvite(inviteId) {
    if(!confirm("Recusar este convite?")) return;
    try {
        const res = await apiFetch(`/game/teams/invites/${inviteId}/decline`, { method: 'POST' });
        if (res.ok) {
            loadTeamInvites();
        }
    } catch (e) { alert("Erro ao recusar."); }
}

async function handleLeaveTeam() {
    if(!confirm("Tem certeza que deseja sair do time?")) return;
    try {
        const res = await apiFetch('/game/teams/leave', { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            loadMyTeamData();
        } else {
            alert(data.detail);
        }
    } catch(e) { alert("Erro ao sair."); }
}

async function handleCreateGroup(e) {
    e.preventDefault();
    const name = document.getElementById('group-name').value;
    const inviteStr = document.getElementById('group-invites').value;
    
    const inviteUsernames = inviteStr.split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    try {
        const res = await apiFetch('/game/chat/create_group', {
            method: 'POST',
            body: JSON.stringify({ room_name: name, invite_usernames: inviteUsernames })
        });
        const data = await res.json();
        if (res.ok) {
            alert("Grupo criado com sucesso!");
            closeModal('create-group-modal');
            loadMyChats();
        } else {
            alert(data.detail);
        }
    } catch(e) { alert("Erro ao criar grupo."); }
}

async function handleCreateTeam(e) {
    e.preventDefault();
    const name = document.getElementById('create-team-name').value;
    const tag = document.getElementById('create-team-tag').value;

    try {
        const res = await apiFetch('/game/teams/create', {
            method: 'POST',
            body: JSON.stringify({ team_name: name, team_tag: tag })
        });
        const data = await res.json();
        if (res.ok) {
            alert("Time criado com sucesso!");
            closeModal('create-team-modal');
            loadMyTeamData();
        } else {
            alert(data.detail);
        }
    } catch(e) { alert("Erro ao criar time."); }
}

async function handleInviteMemberToTeam(e) {
    e.preventDefault();
    const username = document.getElementById('invite-team-username').value;
    
    try {
        const res = await apiFetch('/game/teams/invite', {
            method: 'POST',
            body: JSON.stringify({ invitee_username: username })
        });
        const data = await res.json();
        alert(data.message || data.detail);
        if (res.ok) closeModal('invite-team-modal');
    } catch(e) { alert("Erro ao convidar."); }
}

async function encryptMessage(text, roomId) {
    // 1. Busca chave pública nos Cookies se não estiver na memória
    if (!myPublicKeyStr) myPublicKeyStr = getCookie("pgp_public_key");
    
    // 2. Validação: Se não tiver chave pública, avisa o usuário
    if (!myPublicKeyStr) {
        if(localStorage.getItem("jwt_token")) {
            console.warn("Chave pública do remetente não encontrada nos Cookies.");
            alert("Aviso: Gere suas chaves de segurança no perfil para começar a criptografar.");
        }
        // Se o chat não for privado, envia texto plano. Se for privado, bloqueia.
        if (currentChatType !== 'private') return text;
        return null; 
    }

    const mode = currentChatMode || 'cbc'; 

    try {
        if (currentChatType === 'private') {
            
            // Valida destinatário
            if (!window.currentChatTargetId) {
                 console.warn("ID do destinatário desconhecido. Não é possível encriptar.");
                 return null;
            }

            // Busca chave do destinatário (Cache ou API)
            const targetKeyArmored = await getTargetPublicKey(window.currentChatTargetId);
            if (!targetKeyArmored) {
                alert("Erro E2EE: A chave pública do destinatário está ausente no servidor.");
                return null;
            }

            // Prepara as chaves para encriptação
            const publicKeys = [
                await openpgp.readKey({ armoredKey: targetKeyArmored }), // Chave DELE
                await openpgp.readKey({ armoredKey: myPublicKeyStr })    // MINHA chave (para eu ler depois)
            ];
            
            // --- MODO CBC (PGP Padrão) ---
            if (mode === 'cbc') {
                console.log(`🛡️ MODO PADRÃO (PGP/CBC) selecionado.`);
                
                const message = await openpgp.createMessage({ text: text });
                
                const encrypted = await openpgp.encrypt({
                    message,
                    encryptionKeys: publicKeys 
                });
                
                // LOG NO CONSOLE (Para demonstração)
                console.group("🔒 SAÍDA CRIPTOGRAFADA (CBC/PGP)");
                console.log("Texto Original:", text);
                console.log("Ciphertext (Bloco PGP):", encrypted);
                console.groupEnd();
                
                return encrypted;
            } 
            
            // --- MODO CTR (Híbrido AES+PGP) ---
            else if (mode === 'ctr') {
                console.log(`⚡ MODO RÁPIDO (CTR/Híbrido) selecionado.`);

                // 1. Gera chave efêmera AES-256
                const aesKey = await window.crypto.subtle.generateKey(
                    { name: "AES-CTR", length: 256 }, true, ["encrypt", "decrypt"]
                );
                
                // 2. Encripta o texto com AES-CTR (Rápido)
                const aesResult = await aesCtrEncrypt(text, aesKey);
                
                // 3. Exporta a chave AES para enviar
                const aesKeyExported = await window.crypto.subtle.exportKey("raw", aesKey);
                const aesKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(aesKeyExported)));
                
                // 4. Cria o pacote da chave (Chave + IV)
                const keyTransportMessage = JSON.stringify({ 
                    key: aesKeyBase64, 
                    iv: aesResult.iv 
                });

                // 5. Encripta o pacote da chave com PGP (Seguro)
                const pgpKeyEnvelope = await openpgp.encrypt({
                    message: await openpgp.createMessage({ text: keyTransportMessage }),
                    encryptionKeys: publicKeys
                });

                // 6. Monta o pacote final
                const finalPayload = JSON.stringify({
                    mode: 'CTR',
                    envelope: pgpKeyEnvelope, 
                    content: aesResult.ciphertext 
                });

                // LOG NO CONSOLE (Para demonstração)
                console.group("⚡ SAÍDA CRIPTOGRAFADA (CTR/AES)");
                console.log("Texto Original:", text);
                console.log("IV (Base64):", aesResult.iv);
                console.log("Ciphertext (AES-256-CTR):", aesResult.ciphertext);
                console.log("Envelope de Chave (PGP):", pgpKeyEnvelope);
                console.groupEnd();

                return finalPayload;
            }

            throw new Error("Modo de cifra inválido."); 
        } 
        
        return text; // Retorna texto normal se não for chat privado

    } catch (error) {
        console.error("Erro na encriptação:", error); 
        alert(`Erro ao criptografar mensagem. Verifique suas chaves. Detalhe: ${error.message}`);
        return null;
    }
}

async function decryptMessage(encryptedText) {
    
    let messageObject;
    try {
        messageObject = JSON.parse(encryptedText);
    } catch (e) {
        messageObject = null; 
    }

    if (messageObject && messageObject.mode === 'CTR') {
        try {
            if (!myPrivateKeyObj) {
                console.error("Falha CTR: Chave privada não desbloqueada em memória.");
                return "[Erro: Login Necessário para descriptografar (CTR)]";
            }
            
            const { data: keyTransportData } = await openpgp.decrypt({
                message: await openpgp.readMessage({ armoredMessage: messageObject.envelope }),
                decryptionKeys: myPrivateKeyObj
            });
            
            const { key: aesKeyBase64, iv: aesIvBase64 } = JSON.parse(keyTransportData);

            const aesKeyRaw = Uint8Array.from(atob(aesKeyBase64), c => c.charCodeAt(0));
            const importedAesKey = await window.crypto.subtle.importKey(
                "raw", aesKeyRaw, { name: "AES-CTR" }, false, ["encrypt", "decrypt"]
            );

            return await aesCtrDecrypt(messageObject.content, aesIvBase64, importedAesKey);

        } catch (e) {
            console.warn("Falha na descriptografia CTR:", e);
            return "[Erro: Descriptografia CTR falhou]";
        }
    } 
    
    if (encryptedText && encryptedText.includes("-----BEGIN PGP MESSAGE-----")) {
        try {
            if (!myPrivateKeyObj) {
                console.error("Falha PGP: Chave privada não desbloqueada em memória.");
                return "[Erro: Login Necessário para descriptografar (PGP)]";
            }
            
            const message = await openpgp.readMessage({ armoredMessage: encryptedText });
            
            const { data: decrypted } = await openpgp.decrypt({
                message,
                decryptionKeys: myPrivateKeyObj
            });

            return decrypted;
        } catch (error) {
            console.warn("Descriptografia PGP falhou:", error);
            return "[Erro: Descriptografia PGP falhou]";
        }
    }

    return encryptedText;
}

function updateLoginStatus() {
    const token = localStorage.getItem("jwt_token");
    const username = localStorage.getItem("username");
    const currencyEl = document.getElementById('sidebar-currency');
    const premiumEl = document.getElementById('sidebar-premium');
    const loggedOutEl = document.getElementById('auth-logged-out'); 
    const loggedInEl = document.getElementById('auth-logged-in');
    const profileLink = document.getElementById('nav-profile-link');
    const loyaltyLink = document.getElementById('nav-loyalty-link');
    const supportLink = document.getElementById('nav-support-link');
    const mailboxLink = document.getElementById('nav-mailbox-link');
    const profileNameEl = document.getElementById('user-profile-name');
    const dailyRewardLink = document.getElementById('nav-daily-reward-link');

    if (token && username) {
        loggedInEl?.classList.remove('hidden');
        loggedOutEl?.classList.add('hidden');
        profileLink?.classList.remove('hidden');
        loyaltyLink?.classList.remove('hidden');
        supportLink?.classList.remove('hidden');
        dailyRewardLink?.classList.remove('hidden');
        mailboxLink?.classList.remove('hidden');
        if(profileNameEl) profileNameEl.textContent = username;
        loadUserWallet();
        
    } else {
        loggedInEl?.classList.add('hidden');
        loggedOutEl?.classList.remove('hidden');
        profileLink?.classList.add('hidden');
        loyaltyLink?.classList.add('hidden');
        supportLink?.classList.add('hidden');
        dailyRewardLink?.classList.add('hidden');
        mailboxLink?.classList.add('hidden');
        if(currencyEl) currencyEl.textContent = '-';
        if(premiumEl) premiumEl.textContent = '-';
    }
}

function connectChatWebSocket() {
    const token = localStorage.getItem("jwt_token");
    if (!token) return;
    
    if (chatSocketIsConnecting) return; 
    chatSocketIsConnecting = true; 
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const domain = API_URL.replace('http://', '').replace('https://', '');
    
    chatSocket = new WebSocket(`${protocol}//${domain}/ws/chat?token=${token}`);
    
    chatSocket.onopen = () => {
        chatSocketIsConnecting = false;
        console.log("WebSocket conectado.");
    };
    
    chatSocket.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'new_message') {
            console.log("Nova mensagem recebida:", data);

            if (activeChatRoomId == data.room_id) {
                await appendMessageToChat(data);
            }
            
            const teamTab = document.getElementById('social-tab-team');
            
            if (teamTab && !teamTab.classList.contains('hidden') && window.currentTeamRoomId == data.room_id) {
                console.log("Adicionando mensagem ao chat do time...");
                appendMessageToTeamArea(data);
            }
        }
    };
    
    chatSocket.onclose = () => {
        chatSocketIsConnecting = false;
        console.log("WebSocket fechado. Tentando reconectar em 5s...");
        setTimeout(connectChatWebSocket, 5000);
    };
}

async function loadMyChats() {
    const list = document.getElementById('chat-list');
    list.innerHTML = '<p class="loading-text">Carregando...</p>';
    
    if (localStorage.getItem("jwt_token") && localStorage.getItem("pgp_private_key") && !myPrivateKeyObj) {
        await tryUnlockKey();
    }
    
    try {
        const res = await apiFetch('/game/chat/rooms');
        const rooms = await res.json();
        
        list.innerHTML = '';
        if (rooms.length === 0) {
            list.innerHTML = '<p style="padding:1rem; color:#888;">Nenhuma conversa.</p>';
            return;
        }
        
        rooms.forEach(room => {
            const div = document.createElement('div');
            div.className = 'chat-item';
            
            div.onclick = () => openChatRoom(room.room_id, room.room_name, room.room_type, room.target_user_id);
            
            let icon = '<i class="fa-solid fa-user"></i>';
            if (room.room_type === 'group') icon = '<i class="fa-solid fa-users"></i>';
            if (room.room_type === 'team') icon = '<i class="fa-solid fa-flag"></i>';
            if (room.room_type === 'public_community') icon = '<i class="fa-solid fa-globe"></i>';

            let lastMsg = room.last_message ? room.last_message : 'Nenhuma mensagem ainda';
            
            if (lastMsg.includes("BEGIN PGP MESSAGE")) {
                if (myPrivateKeyObj) {
                    lastMsg = "🔒 [Mensagem Criptografada]"; 
                } else {
                    lastMsg = "🔒 [Bloqueado]";
                }
            }

            div.innerHTML = `
                <span class="chat-item-name">${icon} ${room.room_name}</span>
                <span class="chat-item-last">${lastMsg}</span>
            `;
            list.appendChild(div);
        });
    } catch (e) {
        console.error(e);
        list.innerHTML = '<p class="error-message">Erro ao carregar.</p>';
    }
}

async function openChatRoom(roomId, roomName, roomType, targetUserId = null) {
    activeChatRoomId = roomId;
    currentChatType = roomType;
    
    window.currentChatTargetId = targetUserId; 
    console.log(`Chat aberto. Alvo para encriptação: ${window.currentChatTargetId}`);
    
    document.getElementById('active-chat-name').textContent = roomName;
    document.getElementById('chat-input-form').classList.remove('hidden');
    document.getElementById('chat-header-active').classList.remove('hidden');
    
    const statusEl = document.getElementById('active-chat-status');
    
    if (roomType === 'public_community') {
        statusEl.innerHTML = '<i class="fa-solid fa-globe"></i> Público (Não Criptografado)';
        statusEl.style.color = '#ccc';
        statusEl.style.border = 'none';
    } else if (roomType === 'private') {
        statusEl.innerHTML = '<i class="fa-solid fa-lock"></i> E2EE (Seguro)';
        statusEl.style.color = 'var(--success-color)';
        statusEl.style.border = '1px solid var(--success-color)';
    } else {
        statusEl.innerHTML = '<i class="fa-solid fa-users"></i> Grupo';
        statusEl.style.color = 'var(--text-primary)';
        statusEl.style.border = 'none';
    }
    
    const area = document.getElementById('chat-messages-area');
    area.innerHTML = '<p style="text-align:center; margin-top:1rem;">Carregando mensagens...</p>';
    
    try {
        const res = await apiFetch(`/game/chat/history/${roomId}`);
        const msgs = await res.json();
        area.innerHTML = '';
        
        for (const msg of msgs) {
            await appendMessageToChat(msg);
        }
        area.scrollTop = area.scrollHeight;
    } catch (e) {
        console.error(e);
        area.innerHTML = '<p style="color:red; text-align:center;">Erro ao carregar histórico.</p>';
    }
}

async function appendMessageToChat(msgData) {
    const area = document.getElementById('chat-messages-area');
    const myUsername = localStorage.getItem("username");
    const myId = localStorage.getItem("user_id");
    
    const rawDate = msgData.timestamp || msgData.created_at;
    const isMine = (msgData.sender_name === myUsername) || (String(msgData.sender_id) === String(myId));
    
    const div = document.createElement('div');
    div.className = `chat-msg ${isMine ? 'mine' : 'others'}`;
    
    let content = msgData.content;
    let isSecure = false;
    let isError = false;

    if (content && content.includes("BEGIN PGP MESSAGE")) {
        try {
            const decrypted = await decryptMessage(content);
            
            if (decrypted.startsWith("[Erro:")) {
                isError = true;
                content = "🔒 Mensagem ilegível (Chave perdida ou alterada).";
            } else {
                content = decrypted;
                isSecure = true;
            }
        } catch (err) {
            console.warn("Falha visual decrypt:", err);
            content = "🔒 Mensagem ilegível (Erro PGP CRÍTICO).";
            isError = true;
        }
    }
    
    if (!isMine) {
        const strong = document.createElement('strong');
        strong.textContent = msgData.sender_name;
        div.appendChild(strong);
    }

    const pContent = document.createElement('p');
    
    if (isSecure) {
        const lockIcon = document.createElement('i');
        lockIcon.className = 'fa-solid fa-lock';
        lockIcon.style.fontSize = '0.7rem';
        lockIcon.style.marginRight = '5px';
        lockIcon.style.opacity = '0.7';
        lockIcon.title = "Criptografado Ponta-a-Ponta";
        pContent.appendChild(lockIcon);
    }
    
    pContent.appendChild(document.createTextNode(content));
    div.appendChild(pContent);

    if (isError && currentChatType === 'private') {
        
        if (!isMine) { 
            const resyncBtn = document.createElement('button');
            resyncBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Tentar recuperar';
            resyncBtn.className = 'secondary-button small-action-btn';
            resyncBtn.style.cssText = 'margin-top: 5px; font-size: 0.7rem; padding: 4px 8px; border-radius: 4px;';
            resyncBtn.title = "Seu amigo precisa estar online e ter as chaves corretas.";
            
            resyncBtn.onclick = () => checkAndResyncPeer(activeChatRoomId, msgData.sender_id);
            div.appendChild(resyncBtn);
        }
    }

    const timeSpan = document.createElement('span');
    let timeString = '';
    if (rawDate) {
        const dateObj = new Date(rawDate);
        if (!isNaN(dateObj.getTime())) {
            timeString = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }
    }
    timeSpan.textContent = timeString;
    div.appendChild(timeSpan);

    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
}

async function handleSendChatMessage(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input-text');
    const text = input.value.trim();
    if (!text || !activeChatRoomId) return;

    if (chatSocket === null || chatSocket.readyState !== WebSocket.OPEN) {
        console.warn("Socket fechado. Tentando reconectar proativamente...");
        connectChatWebSocket(); 
        await new Promise(resolve => setTimeout(resolve, 300)); 
        
        if (chatSocket === null || chatSocket.readyState !== WebSocket.OPEN) {
             alert("Erro: Conexão de chat perdida e falha na reconexão. Faça o login novamente.");
             return;
        }
    }

    let finalContent = text;

    if (currentChatType === 'private') {
        if (!myPrivateKeyObj) {
            console.log("Chave PGP não está na memória. Tentando desbloqueio automático...");
            const unlocked = await tryUnlockKey();
            
            if (!unlocked) {
                alert("Erro Crítico de Segurança: Não foi possível restaurar suas chaves de criptografia automaticamente. Por favor, faça Logout e Login novamente para restaurar seu acesso seguro.");
                return; 
            }
        }

        const encrypted = await encryptMessage(text, activeChatRoomId);
        if (!encrypted) return; 
        finalContent = encrypted;
    }

    chatSocket.send(JSON.stringify({
        room_id: activeChatRoomId,
        content: finalContent
    }));

    input.value = '';
}

async function initializeChatCrypto() {
    const success = await tryUnlockKey();
    
    if (success) {
        console.log("Sistema de Criptografia Inicializado.");
        connectChatWebSocket();
    } else {
        if (localStorage.getItem("jwt_token")) {
            const hasKeyCookie = getCookie("pgp_private_key");
            
            if (hasKeyCookie) {
                console.warn("Chat seguro detectado, mas chave bloqueada. Solicitando senha...");
                // openModal('pgp-unlock-modal');
            } else {
                console.warn("Nenhuma chave de criptografia encontrada. O chat funcionará, mas mensagens seguras estarão ilegíveis.");
            }
        }
    }
}

async function loadPublicCommunities() {
    const grid = document.getElementById('public-communities-list');
    grid.innerHTML = '<p>Carregando...</p>';
    try {
        const res = await apiFetch('/game/chat/public_communities');
        const comms = await res.json();
        
        grid.innerHTML = '';
        if (comms.length === 0) {
            grid.innerHTML = '<p>Nenhuma comunidade encontrada.</p>';
            return;
        }

        comms.forEach(c => {
            const div = document.createElement('div');
            div.className = 'shop-item-card';
            
            const h3 = document.createElement('h3');
            h3.textContent = c.room_name;
            
            const pDesc = document.createElement('p');
            pDesc.textContent = c.description;
            
            const pInfo = document.createElement('p');
            const small = document.createElement('small');
            small.textContent = `${c.member_count} membros`;
            pInfo.appendChild(small);

            div.appendChild(h3);
            div.appendChild(pDesc);
            div.appendChild(pInfo);

            if (c.has_password) {
                const pLock = document.createElement('p');
                pLock.style.color = 'orange';
                pLock.innerHTML = '<i class="fa-solid fa-lock"></i> Requer Senha';
                div.appendChild(pLock);
            }

            const btn = document.createElement('button');
            btn.className = 'buy-button buy-normal';
            btn.textContent = 'Entrar';
            btn.onclick = () => joinCommunity(c.room_id, c.has_password);
            
            div.appendChild(btn);
            grid.appendChild(div);
        });
    } catch(e) {
        console.error(e);
        grid.innerHTML = '<p class="error-message">Erro ao carregar.</p>';
    }
}

async function joinCommunity(roomId, hasPassword) {
    let password = null;
    if (hasPassword) {
        password = prompt("Digite a senha da comunidade:");
        if (!password) return;
    }
    
    try {
        const res = await apiFetch('/game/chat/join_community', {
            method: 'POST',
            body: JSON.stringify({ community_id: roomId, password: password })
        });
        if (res.ok) {
            alert("Você entrou na comunidade!");
            
            document.querySelector('[data-social-tab="chats"]').click();
            
            setTimeout(async () => {
                await loadMyChats();
            }, 500); 
        } else {
            const d = await res.json();
            alert("Erro: " + d.detail);
        }
    } catch(e) { alert("Erro ao entrar."); }
}

async function handleCreateCommunity(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('comm-name').value,
        description: document.getElementById('comm-desc').value,
        password: document.getElementById('comm-pass').value || null
    };
    
    try {
        const res = await apiFetch('/game/chat/create_community', { method: 'POST', body: JSON.stringify(data) });
        if (res.ok) {
            alert("Comunidade criada!");
            closeModal('create-community-modal');
            loadPublicCommunities();
        } else {
            const d = await res.json();
            alert(d.detail);
        }
    } catch(e) { alert("Erro."); }
}

async function loadMyTeamData() {
    const container = document.getElementById('social-tab-team');
    const loading = document.getElementById('team-loading');
    const noTeam = document.getElementById('team-no-team');
    const dashboard = document.getElementById('team-dashboard');
    
    loading.classList.remove('hidden');
    noTeam.classList.add('hidden');
    dashboard.classList.add('hidden');
    
    try {
        const res = await apiFetch('/game/team/details');
        const data = await res.json();
        
        loading.classList.add('hidden');
        
        if (!data.has_team) {
            noTeam.classList.remove('hidden');
            loadTeamInvites();
        } else {
            dashboard.classList.remove('hidden');
            document.getElementById('my-team-name').textContent = data.info.team_name;
            document.getElementById('my-team-tag').textContent = data.info.team_tag;
            
            const membersList = document.getElementById('team-members-list');
            membersList.innerHTML = '';
            data.members.forEach(m => {
                const isOnline = m.status === 'online' || m.status === 'in_match' || m.status === 'in_lobby';
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>${m.username} <small>(${m.character_name})</small></span>
                    <span class="${isOnline ? 'status-online' : 'status-offline'}">
                        <i class="fa-solid fa-circle"></i> ${m.status}
                    </span>
                `;
                membersList.appendChild(li);
            });

            const myUsername = localStorage.getItem("username");
            const amILeader = data.members.find(m => m.username === myUsername && m.id === data.info.leader_user_id);
            if (amILeader) {
                document.getElementById('team-leader-actions').classList.remove('hidden');
            }

            if (data.chat_room_id) {
                window.currentTeamRoomId = data.chat_room_id; 
                console.log("Sala do Time Definida:", window.currentTeamRoomId);
                loadTeamChatHistory(data.chat_room_id);

                const teamChatForm = document.getElementById('team-chat-form');
                
                const newForm = teamChatForm.cloneNode(true);
                teamChatForm.parentNode.replaceChild(newForm, teamChatForm);
                
                newForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    handleSendTeamMessage(data.chat_room_id);
                });
            }
        }
    } catch (e) {
        console.error(e);
        loading.textContent = "Erro ao carregar time.";
    }
}

async function loadTeamChatHistory(roomId) {
    const area = document.getElementById('team-chat-area');
    area.innerHTML = '<p style="text-align:center; padding:1rem; color:#888;">Carregando...</p>';
    
    try {
        const res = await apiFetch(`/game/chat/history/${roomId}`);
        const msgs = await res.json();
        area.innerHTML = '';
        
        msgs.forEach(msg => appendMessageToTeamArea(msg));
        area.scrollTop = area.scrollHeight;
    } catch (e) {
        area.innerHTML = '<p style="color:red; text-align:center;">Erro ao carregar chat.</p>';
    }
}

async function handleSendTeamMessage(roomId) {
    const input = document.getElementById('team-chat-input');
    const text = input.value.trim();
    if (!text) return;
    
    chatSocket.send(JSON.stringify({
        room_id: roomId,
        content: text
    }));
    
    input.value = '';
}

function openStartChatModal(targetId, targetName) {
    const modal = document.getElementById('start-chat-modal');
    if(!modal) return;
    
    document.getElementById('start-chat-target-id').value = targetId;
    document.getElementById('start-chat-target-name').textContent = targetName;
    
    const savedMode = localStorage.getItem(`pref_cipher_mode_${targetId}`);
    if(savedMode) {
        document.getElementById('chat-cipher-mode').value = savedMode;
    }
    
    openModal('start-chat-modal');
}

function appendMessageToTeamArea(msgData) {
    const area = document.getElementById('team-chat-area');
    const myUsername = localStorage.getItem("username");
    const myId = localStorage.getItem("user_id");
    
    const rawDate = msgData.timestamp || msgData.created_at;

    const isMine = (msgData.sender_name === myUsername) || (String(msgData.sender_id) === String(myId));
    
    const div = document.createElement('div');
    div.className = `chat-msg ${isMine ? 'mine' : 'others'}`;
    
    if (!isMine) {
        const strong = document.createElement('strong');
        strong.textContent = msgData.sender_name + ': ';
        div.appendChild(strong);
    }
    
    let content = msgData.content;
    if (content.includes("BEGIN PGP MESSAGE")) content = "[Criptografado]";

    const textNode = document.createTextNode(content);
    div.appendChild(textNode);

    const timeSpan = document.createElement('span');
    let timeString = '';
    
    if (rawDate) {
        const dateObj = new Date(rawDate);
        if (!isNaN(dateObj.getTime())) {
            timeString = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }
    }

    timeSpan.textContent = timeString;
    div.appendChild(timeSpan);

    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
}

async function loadFriendsList() {
    const pendingList = document.getElementById('friends-pending-list');
    const activeList = document.getElementById('friends-active-list');
    
    if(pendingList) pendingList.innerHTML = '<p>Carregando...</p>';
    if(activeList) activeList.innerHTML = '<p>Carregando...</p>';

    try {
        const res = await apiFetch('/game/social/list');
        const users = await res.json();

        if(pendingList) pendingList.innerHTML = '';
        if(activeList) activeList.innerHTML = '';

        let hasPending = false;
        let hasActive = false;

        users.forEach(u => {
            const li = document.createElement('li');
            li.className = 'friend-item';

            const infoDiv = document.createElement('div');
            infoDiv.className = 'friend-info';
            
            const headerDiv = document.createElement('div');
            headerDiv.className = 'friend-header';
            
            const nameStrong = document.createElement('strong');
            nameStrong.className = 'friend-name';
            nameStrong.textContent = u.username;
            
            const charSpan = document.createElement('span');
            charSpan.className = 'friend-char';
            charSpan.textContent = `(${u.character_name})`;

            headerDiv.appendChild(nameStrong);
            headerDiv.appendChild(charSpan);

            let lastSeenText = 'Nunca';
            if (u.last_seen) {
                const lastDate = new Date(u.last_seen);
                const diffMs = new Date() - lastDate;
                const diffMins = Math.floor(diffMs / 60000);
                
                if (diffMins < 5) lastSeenText = "Agora";
                else if (diffMins < 60) lastSeenText = `${diffMins}m atrás`;
                else if (diffMins < 1440) lastSeenText = `${Math.floor(diffMins/60)}h atrás`;
                else lastSeenText = `${Math.floor(diffMins/1440)}d atrás`;
            }

            const isOnline = u.status !== 'offline';
            const statusColor = isOnline ? 'var(--success-color)' : '#666';
            
            const statusDiv = document.createElement('div');
            statusDiv.className = 'friend-status';
            statusDiv.style.color = statusColor;
            statusDiv.innerHTML = `<i class="fa-solid fa-circle"></i> ${u.status} <span style="color:#666; margin-left:5px;">• Visto: ${lastSeenText}</span>`;

            infoDiv.appendChild(headerDiv);
            infoDiv.appendChild(statusDiv);
            li.appendChild(infoDiv);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'friend-actions';

            if (u.relationship_status === 'friends') {
                hasActive = true;
                
                const chatBtn = document.createElement('button');
                chatBtn.className = 'secondary-button small-action-btn';
                chatBtn.innerHTML = '<i class="fa-solid fa-comment"></i>';
                chatBtn.title = "Configurar e Abrir Chat";
                chatBtn.onclick = () => openStartChatModal(u.user_id, u.username);
                
                const removeBtn = document.createElement('button');
                removeBtn.className = 'delete-btn small-action-btn';
                removeBtn.innerHTML = '<i class="fa-solid fa-user-minus"></i>';
                removeBtn.title = "Remover Amigo";
                removeBtn.onclick = () => removeFriend(u.user_id, u.username);

                actionsDiv.appendChild(chatBtn);
                actionsDiv.appendChild(removeBtn);
                li.appendChild(actionsDiv);
                activeList.appendChild(li);

            } else if (u.relationship_status === 'pending_received') {
                hasPending = true;
                
                const acceptBtn = document.createElement('button');
                acceptBtn.className = 'register-btn small-action-btn';
                acceptBtn.textContent = 'Aceitar';
                acceptBtn.onclick = () => acceptFriend(u.user_id);
                
                const denyBtn = document.createElement('button');
                denyBtn.className = 'delete-btn small-action-btn';
                denyBtn.textContent = 'X';
                denyBtn.onclick = () => removeFriend(u.user_id, u.username, true);

                actionsDiv.appendChild(acceptBtn);
                actionsDiv.appendChild(denyBtn);
                li.appendChild(actionsDiv);
                pendingList.appendChild(li);

            } else if (u.relationship_status === 'pending_sent') {
                hasPending = true;
                
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'secondary-button small-action-btn';
                cancelBtn.textContent = 'Cancelar';
                cancelBtn.onclick = () => removeFriend(u.user_id, u.username, true);

                actionsDiv.appendChild(cancelBtn);
                li.appendChild(actionsDiv);
                pendingList.appendChild(li);
            }
        });

        if (!hasPending) pendingList.innerHTML = '<p style="color:#666; font-style:italic;">Nenhum pedido pendente.</p>';
        if (!hasActive) activeList.innerHTML = '<p style="color:#666; font-style:italic;">Você ainda não adicionou amigos.</p>';

    } catch (e) {
        console.error(e);
        if(activeList) activeList.innerHTML = '<p class="error-message">Erro ao carregar lista.</p>';
    }
}

async function handleAddFriendSubmit(e) {
    e.preventDefault();
    const usernameInput = document.getElementById('add-friend-username');
    const username = usernameInput.value.trim();
    if (!username) return;

    try {
        const res = await apiFetch('/game/social/add', {
            method: 'POST',
            body: JSON.stringify({ username: username })
        });
        const data = await res.json();
        
        if (res.ok) {
            alert(data.message);
            usernameInput.value = '';
            loadFriendsList();
        } else {
            alert(data.detail);
        }
    } catch (err) {
        alert("Erro ao enviar pedido.");
    }
}

async function removeFriend(targetId, username, isCancel = false) {
    const action = isCancel ? "cancelar/recusar o pedido de" : "remover";
    if (!confirm(`Tem certeza que deseja ${action} ${username}?`)) return;

    try {
        const res = await apiFetch(`/game/social/remove/${targetId}`, { method: 'DELETE' });
        if (res.ok) {
            loadFriendsList();
        } else {
            const d = await res.json();
            alert(d.detail);
        }
    } catch (e) { alert("Erro ao remover."); }
}

async function acceptFriend(targetId) {
    try {
        const res = await apiFetch(`/game/social/accept/${targetId}`, { method: 'POST' });
        if (res.ok) {
            alert("Agora vocês são amigos!");
            loadFriendsList();
        } else {
            const d = await res.json();
            alert(d.detail);
        }
    } catch (e) { alert("Erro ao aceitar."); }
}

async function startPrivateChat(targetId, targetName) {
    try {
        const res = await apiFetch(`/game/chat/start_private/${targetId}`, { method: 'POST' });
        const data = await res.json();
        if (res.ok || data.room_id) {
            document.querySelector('[data-social-tab="chats"]').click();
            
            setTimeout(() => {
                openChatRoom(data.room_id, targetName, 'private');
            }, 500);
        }
    } catch (e) {
        console.error(e);
        alert("Erro ao iniciar chat.");
    }
}

async function loadRankingHistory(seasonName) {
    const tableBody = document.getElementById('ranking-table-body');
    const headerValue = document.getElementById('ranking-header-value');
    if (!tableBody || !headerValue) return;

    headerValue.textContent = 'Pontuação Final';
    tableBody.innerHTML = `<tr><td colspan="3">${translateKey('ranking_loading')}</td></tr>`;

    try {
        const response = await apiFetch(`/game/ranking/history/${seasonName}`);
        if (!response.ok) { 
            const errorData = await response.json().catch(() => ({detail: `Erro HTTP ${response.status}`}));
            throw new Error(errorData.detail || `Erro ${response.status}`);
        }
        const ranking = await response.json();

        tableBody.innerHTML = '';
        if (ranking.length === 0) { 
            tableBody.innerHTML = '<tr><td colspan="3">Ninguém no ranking.</td></tr>'; 
            return; 
        }

        ranking.forEach((player) => {
            const row = tableBody.insertRow();
            row.insertCell().textContent = `#${player.final_rank}`;
            row.insertCell().textContent = player.username;
            row.insertCell().textContent = player.final_score;
        });
    } catch (error) { 
        console.error("Erro ao carregar histórico do ranking:", error);
        tableBody.innerHTML = `<tr><td colspan="3" style="color: red;">${translateKey('error_ranking_load')} ${error.message}</td></tr>`; 
    }
}

async function loadCurrentLeaderboard(type = 'score') {
    const tableBody = document.getElementById('ranking-table-body');
    const headerValue = document.getElementById('ranking-header-value');
    if (!tableBody || !headerValue) return;

    const headerMap = {
        'score': 'Pontuação',
        'wins': 'Vitórias',
        'dishes': 'Pratos Completos'
    };
    headerValue.textContent = headerMap[type] || 'Pontuação';

    tableBody.innerHTML = `<tr><td colspan="3">${translateKey('ranking_loading')}</td></tr>`;

    const endpoint = (type === 'score') ? '/ranking' : `/game/leaderboard/${type}`;

    try {
        const response = await apiFetch(endpoint);
        if (!response.ok) { 
            const errorData = await response.json().catch(() => ({detail: `Erro HTTP ${response.status}`}));
            throw new Error(errorData.detail || `Erro ${response.status}`);
        }
        const ranking = await response.json();

        tableBody.innerHTML = '';
        if (ranking.length === 0) { 
            tableBody.innerHTML = '<tr><td colspan="3">Ninguém no ranking ainda.</td></tr>'; 
            return; 
        }

        ranking.forEach((player, index) => {
            const row = tableBody.insertRow();
            row.insertCell().textContent = `#${index + 1}`;
            row.insertCell().textContent = player.username;
            row.insertCell().textContent = player.value ?? player.total_score;
        });
    } catch (error) { 
        console.error(`Erro ao carregar leaderboard (${type}):`, error);
        tableBody.innerHTML = `<tr><td colspan="3" style="color: red;">${translateKey('error_ranking_load')} ${error.message}</td></tr>`; 
    }
}

async function loadRankingData() {
    const seasonSelect = document.getElementById('season-select');
    const rankingTypeSelect = document.getElementById('ranking-type-select');
    const rankingTypeGroup = document.getElementById('ranking-type-selector-group');

    if (!seasonSelect || !rankingTypeSelect || !rankingTypeGroup) return;

    const season = seasonSelect.value;
    const type = rankingTypeSelect.value;

    if (season === 'current') {
        rankingTypeGroup.style.display = 'block';
        await loadCurrentLeaderboard(type);
    } else {
        rankingTypeGroup.style.display = 'none';
        await loadRankingHistory(season);
    }
}

async function loadShopItems() {
        document.querySelectorAll('.shop-items-grid').forEach(grid => {
            if (!grid.id === 'featured-items-grid' || grid.innerHTML.includes('<p>')) {
                grid.innerHTML = '<p>Carregando itens...</p>';
            }
        });
        
        let hasLoadError = false;
        
        try {
            const results = await Promise.allSettled([
                (allShopItems.length === 0) ? apiFetch(`/shop/items?item_type=premium`) : Promise.resolve(null),
                (stripeProducts.length === 0) ? apiFetch(`/shop/stripe-products`) : Promise.resolve(null),
                (featuredItems.length === 0) ? apiFetch(`/shop/featured_items`) : Promise.resolve(null)
            ]);

            const [internalRes, stripeRes, featuredRes] = results;

            if (internalRes.status === 'fulfilled' && internalRes.value) {
                if (!internalRes.value.ok) throw new Error('Falha itens premium');
                allShopItems = await internalRes.value.json();
            } else if (internalRes.status === 'rejected') {
                hasLoadError = true; console.error("Erro ao carregar itens internos:", internalRes.reason);
            }
            
            if (stripeRes.status === 'fulfilled' && stripeRes.value) {
                if (!stripeRes.value.ok) throw new Error('Falha itens stripe');
                stripeProducts = await stripeRes.value.json();
            } else if (stripeRes.status === 'rejected') {
                hasLoadError = true; console.error("Erro ao carregar produtos stripe:", stripeRes.reason);
            }
            
            if (featuredRes.status === 'fulfilled' && featuredRes.value) {
                if (!featuredRes.value.ok) throw new Error('Falha itens destaque');
                featuredItems = await featuredRes.value.json();
            } else if (featuredRes.status === 'rejected') {
                hasLoadError = true; console.error("Erro ao carregar itens em destaque:", featuredRes.reason);
            }

            renderFeaturedItems();
            renderShopItems();

        } catch (error) {
            console.error("Erro ao carregar itens da loja:", error);
            if (!hasLoadError) {
                document.querySelectorAll('.shop-items-grid').forEach(grid => grid.innerHTML = `<p style="color: red;">Erro ao carregar produtos: ${error.message}</p>`);
            }
        }
    }

async function handleBuyClick(event) {
    const button = event.target;
    const priceId = button.dataset.itemId;
    const token = localStorage.getItem("jwt_token");
    if (!token) {
        alert("Você precisa estar logado para comprar!");
        openModal('login-modal');
        return;
    }

    button.disabled = true; button.textContent = 'Indo para pagamento...';
    try {
        const response = await apiFetch(`/shop/create-checkout-session`, {
            method: 'POST',
            body: JSON.stringify({ priceId: priceId })
        });
        const session = await response.json();
        if (!response.ok) throw new Error(session.detail || 'Falha ao iniciar checkout');
        window.location.href = session.checkout_url; 
    } catch (error) {
        console.error("Erro checkout Stripe:", error); 
        alert(`Erro ao iniciar pagamento: ${error.message}`);
        button.disabled = false; 
        const originalItem = stripeProducts.find(p => p.price_id === priceId);
        button.textContent = originalItem?.type === 'recurring' ? 'Assinar' : 'Comprar';
    }
}

async function handleCloseTicket(event) {
    event.preventDefault();
    const button = event.target;
    const ticketId = document.getElementById('reply-ticket-id').value;
    const errorDiv = document.getElementById('view-ticket-reply-error');

    if (!ticketId) {
        errorDiv.textContent = "Erro: ID do Ticket não encontrado.";
        return;
    }

    if (!confirm(translateKey('alert_support_close_confirm', { ticketId: ticketId }))) {
        return;
    }

    button.disabled = true;
    errorDiv.textContent = '';

    try {
        const response = await apiFetch(`/game/support/my_tickets/${ticketId}/close`, {
            method: 'POST'
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail);

        alert(result.message);
        closeModal('view-ticket-modal');
        loadSupportTickets();

    } catch (err) {
        errorDiv.textContent = `Erro: ${err.message}`;
    } finally {
        button.disabled = false;
    }
}

async function handleBuyInternalClick(event) {
    const button = event.target;
    const itemId = parseInt(button.dataset.itemId); 
    const itemName = button.dataset.itemName;
    const currencyType = button.classList.contains('buy-normal') ? 'normal' : 'premium'; 
    const token = localStorage.getItem("jwt_token");
    const originalText = button.textContent;

    if (!token || isNaN(itemId) || !itemName) { 
        alert("Erro interno ou não logado."); 
        return; 
    } 
    if (!confirm(`Comprar '${itemName}' usando ${currencyType === 'normal' ? 'Moedas' : 'Cash'}?`)) return;

    button.disabled = true; button.textContent = 'Processando...';
    try {
        const response = await apiFetch(`/shop/buy_internal_item`, {
            method: 'POST',
            body: JSON.stringify({ itemId: itemId, currencyType: currencyType })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || 'Falha na compra');
        alert(result.message); 
        loadProfileData();
        loadUserWallet();
    } catch (error) {
        console.error(`Erro compra ${currencyType}:`, error);
        alert(`Erro: ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
}

function openModal(modalId) { 
    const m = document.getElementById(modalId); 
    if(m) m.classList.remove('hidden'); 
}
function closeModal(modalId) { 
    const m = document.getElementById(modalId); 
    if(m) m.classList.add('hidden'); 
}

function renderFeaturedItems() {
        const container = document.getElementById('featured-items-grid');
        if (!container) return;
        
        container.innerHTML = '';
        const token = localStorage.getItem("jwt_token");

        if (featuredItems.length === 0) {
            container.innerHTML = '<p>Nenhum item em destaque no momento.</p>';
            document.getElementById('featured-items-container').style.display = 'none';
            return;
        }
        
        document.getElementById('featured-items-container').style.display = 'block';

        featuredItems.forEach(item => {
            let buttonsHtml = '';
            const priceNormalText = item.price_normal !== null ? `${item.price_normal} Moedas` : null;
            const pricePremiumText = item.price_premium !== null ? `${item.price_premium} Cash` : null;

            if (priceNormalText) {
                 buttonsHtml += `<button class="buy-button buy-normal" data-item-id="${item.item_id}" data-item-name="${item.item_name}" ${!token ? 'disabled' : ''}>Comprar (${priceNormalText})</button>`;
            }
            if (pricePremiumText) {
                 buttonsHtml += `<button class="buy-button buy-premium" data-item-id="${item.item_id}" data-item-name="${item.item_name}" ${!token ? 'disabled' : ''}>Comprar (${pricePremiumText})</button>`;
            }
            if (!token && (priceNormalText || pricePremiumText)) {
                 buttonsHtml += `<span class="requires-login-text"> (Requer Login)</span>`;
            }

            const card = document.createElement('div'); 
            card.className = 'shop-item-card featured-item';
            const badge = document.createElement('div');
            badge.className = 'featured-badge';
            badge.textContent = item.display_name;
            card.appendChild(badge);

            if (item.image_url) {
                const img = document.createElement('img');
                img.src = item.image_url;
                img.alt = item.item_name;
                img.className = 'shop-item-image';
                card.appendChild(img);
            } else {
                const placeholder = document.createElement('div');
                placeholder.className = 'shop-item-image-placeholder';
                placeholder.textContent = '?';
                card.appendChild(placeholder);
            }

            const h3 = document.createElement('h3');
            h3.textContent = item.item_name;
            card.appendChild(h3);

            const p = document.createElement('p');
            p.className = 'item-description';
            p.textContent = item.description || '';
            card.appendChild(p);

            const buyDiv = document.createElement('div');
            buyDiv.className = 'buy-options';
            buyDiv.innerHTML = buttonsHtml || '<p>Item não disponível</p>';
            card.appendChild(buyDiv);
                container.appendChild(card);
            });
        
        setupBuyButtons();
    }

function renderShopItems() {
    const recargaContainer = document.getElementById('recarga-items'); const vipContainer = document.getElementById('vip-items');
    const skinsContainer = document.getElementById('skins-items') || createCategoryGrid('skin'); 
    const petsContainer = document.getElementById('pets-items') || createCategoryGrid('pet');     
    
    if(recargaContainer) recargaContainer.innerHTML = ''; if(vipContainer) vipContainer.innerHTML = ''; 
    if(skinsContainer) skinsContainer.innerHTML = ''; if(petsContainer) petsContainer.innerHTML = '';
    
    const token = localStorage.getItem("jwt_token");

    stripeProducts.forEach(item => {
        const container = item.type === 'one_time' ? recargaContainer : vipContainer;
        if (!container) return; 
        const priceFormatted = item.price.toLocaleString('pt-BR', { style: 'currency', currency: item.currency });
        const card = createShopCard(
            item.name, item.description, 
            priceFormatted + (item.type === 'recurring' ? ' / mês' : ''),
            item.type === 'recurring' ? 'Assinar' : 'Comprar', 
            'buy-stripe', 
            item.price_id,
            token, item.image_url
        );
        container.appendChild(card);
    });

    const featuredItemIds = featuredItems.map(f => f.item_id);
    
    allShopItems.forEach(item => {
        if (featuredItemIds.includes(item.item_id)) {
                return;
            }
        let container; 
        switch(item.category?.toLowerCase()) { 
            case 'skin': container = skinsContainer; 
            break; 
            case 'pet': container = petsContainer; 
            break; 
            default: return; 
        }
        if (!container) return; 
        const priceNormalText = item.price_normal !== null ? `${item.price_normal} Moedas` : null;
        const pricePremiumText = item.price_premium !== null ? `${item.price_premium} Cash` : null;
        
        let buttonsHtml = '';
        if (priceNormalText) {
             buttonsHtml += `<button class="buy-button buy-normal" data-item-id="${item.item_id}" data-item-name="${item.item_name}" ${!token ? 'disabled' : ''}>Comprar (${priceNormalText})</button>`;
        }
        if (pricePremiumText) {
             buttonsHtml += `<button class="buy-button buy-premium" data-item-id="${item.item_id}" data-item-name="${item.item_name}" ${!token ? 'disabled' : ''}>Comprar (${pricePremiumText})</button>`;
        }
        if (!token && (priceNormalText || pricePremiumText)) {
             buttonsHtml += `<span class="requires-login-text"> (Requer Login)</span>`;
        }


        const card = document.createElement('div'); 
        card.className = 'shop-item-card';
        if (item.image_url) {
            const img = document.createElement('img');
            img.src = item.image_url;
            img.alt = item.item_name;
            img.className = 'shop-item-image';
            card.appendChild(img);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'shop-item-image-placeholder';
            placeholder.textContent = '?';
            card.appendChild(placeholder);
        }

        const h3 = document.createElement('h3');
        h3.textContent = item.item_name;
        card.appendChild(h3);

        const p = document.createElement('p');
        p.className = 'item-description';
        p.textContent = item.description || '';
        card.appendChild(p);

        const buyDiv = document.createElement('div');
        buyDiv.className = 'buy-options';
        buyDiv.innerHTML = buttonsHtml || '<p>Item não disponível</p>';
        card.appendChild(buyDiv);

        container.appendChild(card);
    });
    
    setupBuyButtons(); 
}

function setupBuyButtons() {
    document.querySelectorAll('.buy-button').forEach(button => {
        const buttonClone = button.cloneNode(true);
        button.parentNode.replaceChild(buttonClone, button);

        if (buttonClone.classList.contains('buy-stripe')) {
            buttonClone.addEventListener('click', handleBuyClick); 
        } else if (buttonClone.classList.contains('buy-normal')) {
            buttonClone.addEventListener('click', handleBuyInternalClick); 
        } else if (buttonClone.classList.contains('buy-premium')) {
             buttonClone.addEventListener('click', handleBuyInternalClick); 
        }
    });
}

function createCategoryGrid(categoryId) {
    const container = document.getElementById(`category-${categoryId}`); 
    if (!container) { console.warn(`Container #category-${categoryId} não encontrado.`); return null; } 
    let grid = document.getElementById(`${categoryId}-items`);
    if (!grid) {
        if (categoryId !== 'recarga' && categoryId !== 'vip') {
             container.innerHTML = `<h2>${categoryId.charAt(0).toUpperCase() + categoryId.slice(1)}</h2>`; 
        } else {
             container.innerHTML = '';
        }
        grid = document.createElement('div'); grid.className = 'shop-items-grid'; grid.id = `${categoryId}-items`;
        container.appendChild(grid);
    } return grid;
}

function createShopCard(name, desc, price, btnTxt, btnType, itemId, token, imgUrl) { 
    const card = document.createElement('div'); 
    card.className = 'shop-item-card';

    if (imgUrl) {
        const img = document.createElement('img');
        img.src = imgUrl;
        img.alt = name;
        img.className = 'shop-item-image';
        card.appendChild(img);
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'shop-item-image-placeholder';
        placeholder.textContent = '?';
        card.appendChild(placeholder);
    }

    const h3 = document.createElement('h3');
    h3.textContent = name;
    card.appendChild(h3);

    const pDesc = document.createElement('p');
    pDesc.className = 'item-description';
    pDesc.textContent = desc || '';
    card.appendChild(pDesc);

    const pPrice = document.createElement('p');
    pPrice.className = 'item-price';
    pPrice.textContent = price;
    card.appendChild(pPrice);

    const button = document.createElement('button');
    button.className = `buy-button ${btnType}`;
    button.dataset.itemId = itemId;
    button.dataset.itemName = name;
    button.disabled = !token;
    button.textContent = btnTxt;

    if (!token) button.classList.add('requires-login');

    card.appendChild(button);
    return card;
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(`page-${pageId}`);
    targetPage?.classList.add('active');
    
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-page') === pageId) link.classList.add('active');
    });

    if (targetPage?.classList.contains('active')) {
        if (pageId === 'ranking') loadRankingData();
        else if (pageId === 'profile'){ 
            loadProfileData();
        }
        else if (pageId === 'loja') loadShopItems();
        else if (pageId === 'loyalty') {
            loadVipStatus();
        }
        else if (pageId === 'codex') {
            loadCodexIngredients();
            loadCodexRecipes();
        }
        else if (pageId === 'support') {
            loadSupportTickets();
        }
    }
}

function setupShopCategories() {
    const categoryButtons = document.querySelectorAll('.shop-category-btn');
    const categoryContents = document.querySelectorAll('.shop-category-content');
    
    categoryButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetCategory = button.dataset.category;
            
            const parentContainer = button.closest('nav').nextElementSibling;
            if (parentContainer) {
                 parentContainer.querySelectorAll('.shop-category-content').forEach(content => content.classList.remove('active'));
            }
            
            button.closest('nav').querySelectorAll('.shop-category-btn').forEach(btn => btn.classList.remove('active'));
            
            document.getElementById(`category-${targetCategory}`)?.classList.add('active');
            button.classList.add('active');
        });
    });
}

function startInactivityTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    console.log(`Iniciando timer inatividade (${INACTIVITY_TIMEOUT_MS / 60000} min).`);
    inactivityTimer = setTimeout(() => {
        console.log("Inatividade! Deslogando..."); 
        alert(translateKey('alert_inactivity_logout'));
        logout();
    }, INACTIVITY_TIMEOUT_MS);
}

async function loadDailyRewardStatus() {
    const content = document.getElementById('daily-reward-content');
    content.innerHTML = '<p data-translate="modal_daily_loading">Carregando seu status...</p>';
    try {
        const response = await apiFetch("/game/daily_login/status");
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail);

        let rewardHtml = '<h4>Recompensa de Hoje (Dia ' + (data.current_streak_day) + ')</h4>';
        if (data.today_reward) {
            const r = data.today_reward;
            let rewards = [];
            if (r.reward_currency_normal > 0) rewards.push(r.reward_currency_normal + ' Moedas');
            if (r.reward_currency_premium > 0) rewards.push(r.reward_currency_premium + ' Cash');
            if (r.item_name) rewards.push(r.item_name);
            rewardHtml += `<p style="font-size: 1.1rem; color: var(--accent-orange);">${rewards.join(', ')}</p>`;
        } else {
            rewardHtml += '<p>Nenhuma recompensa configurada para este dia.</p>';
        }

        if (data.can_claim_today) {
            content.innerHTML = `
                ${rewardHtml}
                <button id="claim-daily-reward-btn" class="register-btn" style="width:100%; margin-top: 1rem;">Resgatar Recompensa</button>
            `;
            document.getElementById('claim-daily-reward-btn').addEventListener('click', claimDailyReward);
        } else {
            const hours = Math.floor(data.seconds_until_next_claim / 3600);
            const minutes = Math.floor((data.seconds_until_next_claim % 3600) / 60);
            content.innerHTML = `
                ${rewardHtml}
                <p style="margin-top: 1rem;">Você já resgatou sua recompensa hoje.</p>
                <p>Próximo resgate em: <strong>${hours}h ${minutes}m</strong></p>
            `;
        }
    } catch (error) {
        content.innerHTML = `<p class="error-message">O sistema de Recompensa Diária está em manutenção. Tente novamente mais tarde.</p>`;
    }
}

async function claimDailyReward() {
    const button = document.getElementById('claim-daily-reward-btn');
    button.disabled = true;
    button.textContent = 'Processando...';
    try {
        const response = await apiFetch("/game/daily_login/claim", { method: 'POST' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail);

        alert('Recompensa resgatada com sucesso!');
        loadDailyRewardStatus();
        loadUserWallet();
    } catch (error) {
        alert(`Erro: ${error.message}`);
        button.disabled = false;
        button.textContent = 'Resgatar Recompensa';
    }
}

async function loadMailbox() {
    const content = document.getElementById('mailbox-content');
    content.innerHTML = `<p data-translate="modal_mailbox_loading">Carregando...</p>`;
    applyTranslations();
    
    try {
        const response = await apiFetch("/game/mailbox/check");
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail);

        if (data.length === 0) {
            content.innerHTML = '<p data-translate="modal_mailbox_empty">Sua caixa de correio está vazia.</p>';
            applyTranslations();
            return;
        }
        
        content.innerHTML = '';
        data.forEach(mail => {
            const card = document.createElement('div');
            card.className = 'codex-card';
            
            let rewards = [];
            if (mail.reward_currency_normal > 0) rewards.push(`${mail.reward_currency_normal} Moedas`);
            if (mail.reward_currency_premium > 0) rewards.push(`${mail.reward_currency_premium} Cash`);
            
            if (mail.reward_item_id > 0 && mail.item_name) {
                rewards.push(`${mail.item_name} (x${mail.reward_item_quantity})`);
            } else if (mail.reward_item_id > 0) {
                rewards.push(`Item ID ${mail.reward_item_id} (x${mail.reward_item_quantity})`);
            }

            const h3 = document.createElement('h3');
            h3.style.color = 'var(--text-primary)';
            h3.textContent = mail.subject;
            card.appendChild(h3);

            const small = document.createElement('small');
            small.style.cssText = 'color:var(--text-secondary); font-size: 0.8rem;';
            small.textContent = new Date(mail.sent_at).toLocaleString('pt-BR');
            card.appendChild(small);

            const pDesc = document.createElement('p');
            pDesc.className = 'item-description';
            pDesc.style.margin = '0.75rem 0';
            setSafeHTML(pDesc, mail.message || 'Sem mensagem.');
            card.appendChild(pDesc);

            if (rewards.length > 0) {
                const strongRewards = document.createElement('strong');
                strongRewards.dataset.translate = 'modal_mailbox_rewards';
                strongRewards.textContent = 'Recompensas:';
                card.appendChild(strongRewards);

                const pRewards = document.createElement('p');
                pRewards.style.cssText = 'color:var(--accent-orange); margin-top: 5px;';
                pRewards.textContent = rewards.join(', ');
                card.appendChild(pRewards);
            }
            
            const button = document.createElement('button');
            button.className = 'register-btn claim-mail-btn';
            button.dataset.mailId = mail.mail_id;
            button.style.cssText = 'width: 100%; margin-top: 1rem;';
            button.textContent = rewards.length > 0 ? translateKey('modal_mailbox_claim') : translateKey('modal_mailbox_read');
            card.appendChild(button);
            
            content.appendChild(card);
        });
        
        content.querySelectorAll('.claim-mail-btn').forEach(btn => {
            btn.addEventListener('click', claimMailItem);
        });
        
    } catch (error) {
        content.innerHTML = `<p class="error-message">Erro ao carregar correio: ${error.message}</p>`;
    }
}

async function claimMailItem(event) {
    const button = event.target;
    const mailId = button.dataset.mailId;
    button.disabled = true;
    button.textContent = 'Processando...';
    try {
        const response = await apiFetch(`/game/mailbox/claim/${mailId}`, { method: 'POST' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail);
        
        alert(result.message);
        loadUserWallet();
        button.closest('.codex-card').remove();
        
        if (document.getElementById('mailbox-content').childElementCount === 0) {
            document.getElementById('mailbox-content').innerHTML = '<p data-translate="modal_mailbox_empty">Sua caixa de correio está vazia.</p>';
            applyTranslations();
        }
        
    } catch (error) {
        alert(`Erro: ${error.message}`);
        button.disabled = false;
        button.textContent = 'Tentar Novamente';
    }
}

async function loadSupportTickets() {
    const tableBody = document.getElementById('support-ticket-list-body');
    const loading = document.getElementById('support-ticket-list-loading');
    const error = document.getElementById('support-ticket-list-error');
    const table = document.getElementById('support-ticket-table');

    loading.classList.remove('hidden');
    error.classList.add('hidden');
    table.classList.add('hidden');
    tableBody.innerHTML = '';

    try {
        const response = await apiFetch("/game/support/my_tickets");
        const tickets = await response.json();
        if (!response.ok) throw new Error(tickets.detail);

        loading.classList.add('hidden');
        table.classList.remove('hidden');

        if (tickets.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" data-translate="modal_support_no_tickets">Você não abriu nenhum ticket.</td></tr>';
            applyTranslations();
            return;
        }

        tickets.forEach(ticket => {
            const row = tableBody.insertRow();
            const statusKey = `modal_support_status_${ticket.status.toLowerCase()}`;

            row.insertCell().textContent = ticket.ticket_id;
            row.insertCell().textContent = ticket.subject;

            const statusCell = row.insertCell();
            statusCell.innerHTML = `<strong class="status-${ticket.status.toLowerCase()}" data-translate="${statusKey}">${ticket.status}</strong>`; 

            row.insertCell().textContent = new Date(ticket.updated_at).toLocaleString('pt-BR');

            const actionsCell = row.insertCell();
            actionsCell.className = 'action-buttons';
            
            const button = document.createElement('button');
            button.className = 'secondary-button view-ticket-btn';
            button.dataset.ticketId = ticket.ticket_id;
            button.dataset.ticketSubject = ticket.subject; 
            button.textContent = 'Ver/Responder'; 
            
            actionsCell.appendChild(button);
        });

        tableBody.querySelectorAll('.view-ticket-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.ticketId;
                const subject = e.target.dataset.ticketSubject;
                openTicketViewModal(id, subject);
            });
        });
        applyTranslations();

    } catch (err) {
        loading.classList.add('hidden');
        error.classList.remove('hidden');
        error.textContent = `Erro ao carregar tickets: ${err.message}`;
    }
}

async function openTicketViewModal(ticketId, subject) {
    const title = document.getElementById('view-ticket-modal-title');
    const messagesView = document.getElementById('view-ticket-messages-view');
    const form = document.getElementById('view-ticket-reply-form');
    const errorDiv = document.getElementById('view-ticket-reply-error');

    title.textContent = `Ticket ID: ${ticketId} - ${subject}`;
    messagesView.innerHTML = '<p>Carregando mensagens...</p>';
    form.reset();
    errorDiv.textContent = '';
    document.getElementById('reply-ticket-id').value = ticketId;

    openModal('view-ticket-modal');

    try {
        const response = await apiFetch(`/game/support/my_tickets/${ticketId}/messages`);
        const messages = await response.json();
        if (!response.ok) throw new Error(messages.detail);

        messagesView.innerHTML = '';
        if (messages.length === 0) {
            messagesView.innerHTML = '<p>Nenhuma mensagem neste ticket ainda.</p>';
            return;
        }

        messages.forEach(msg => {
            const sender = msg.admin_username ? msg.admin_username : msg.username;
            const senderType = msg.admin_username ? 'Admin' : 'Você';
            const senderClass = msg.admin_username ? 'chat-admin' : 'chat-user';

            const messageDiv = document.createElement('div');
            messageDiv.className = `ticket-message ${senderClass}`;

            const small = document.createElement('small');
            const strong = document.createElement('strong');
            strong.textContent = sender;
            small.appendChild(strong);
            small.appendChild(document.createTextNode(` (${senderType}) - ${new Date(msg.created_at).toLocaleString('pt-BR')}`));

            const p = document.createElement('p');
            setSafeHTML(p, msg.message_content); 

            messageDiv.appendChild(small);
            messageDiv.appendChild(p);
            messagesView.appendChild(messageDiv);
        });
        messagesView.scrollTop = messagesView.scrollHeight;
    } catch (err) {
        messagesView.innerHTML = `<p class="error-message">Erro ao carregar mensagens: ${err.message}</p>`;
    }
}

async function handleTicketReply(event) {
    event.preventDefault();
    const form = event.target;
    const button = form.querySelector('button[type="submit"]');
    const errorDiv = document.getElementById('view-ticket-reply-error');
    const ticketId = document.getElementById('reply-ticket-id').value;
    const message = document.getElementById('view-ticket-reply-message').value;

    button.disabled = true;
    errorDiv.textContent = '';

    try {
        const response = await apiFetch(`/game/support/my_tickets/${ticketId}/reply`, {
            method: 'POST',
            body: JSON.stringify({ message: message })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail);

        form.reset();
        const title = document.getElementById('view-ticket-modal-title').textContent.split(' - ')[1] || '...';
        openTicketViewModal(ticketId, title);
        loadSupportTickets();

    } catch (err) {
        errorDiv.textContent = `Erro: ${err.message}`;
    } finally {
        button.disabled = false;
    }
}

function translateKey(key, replacements = {}) {
    let text = translations[currentLanguage]?.[key] || translations['pt']?.[key] || key;
    
    for (const placeholder in replacements) {
        text = text.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return text;
}

function resetInactivityTimer() { if (localStorage.getItem("jwt_token")) startInactivityTimer(); }

async function loadTranslations() {
    try {
        const response = await fetch('translations.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        translations = await response.json();
        applyTranslations();
    } catch (error) { 
        console.error('Erro ao carregar traduções:', error); 
        applyTranslations(); 
    }
}

function applyTranslations() {
    document.querySelectorAll('[data-translate]').forEach(el => {
        const key = el.getAttribute('data-translate');
        const translatedText = translations[currentLanguage]?.[key];
        
        const targetElement = el.tagName === 'A' && el.querySelector('span[data-translate]') ? el.querySelector('span[data-translate]') : el;
        const targetKey = targetElement.getAttribute('data-translate');

        if (translations[currentLanguage]?.[targetKey]) {
            targetElement.textContent = translations[currentLanguage][targetKey];
        } else if (translations['pt']?.[targetKey]) {
             targetElement.textContent = translations['pt'][targetKey]; 
        } else {
        }
    });
    updateDownloadButton(); 
}


function changeLanguage(lang) {
    if (translations[lang]) { 
        currentLanguage = lang;
        document.documentElement.lang = lang; 
        localStorage.setItem('preferred_language', lang);
        applyTranslations(); 
    } else {
        console.warn(`Idioma '${lang}' não encontrado nas traduções.`);
    }
}

function updateDownloadButton() {
    const btn = document.getElementById('download-btn');
    if (!btn) return;
    const keyCTA = 'download_button_cta';
    const keySoon = 'download_button_soon';
    
    if (jogoLancado) {
        btn.textContent = translations[currentLanguage]?.[keyCTA] || 'Download Now!';
        btn.classList.add('active'); btn.classList.remove('disabled'); btn.disabled = false;
        btn.onclick = () => window.location.href = ''; 
    } else {
        btn.textContent = translations[currentLanguage]?.[keySoon] || 'Coming Soon';
        btn.classList.add('disabled'); btn.classList.remove('active'); btn.disabled = true;
        btn.onclick = null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Carregado. Configurando eventos...");
    const registerForm = document.getElementById('register-form');
    const logoutBtn = document.getElementById('logout-btn'); 
    const editProfileForm = document.getElementById('edit-profile-form');
    const btnEnable2FA = document.getElementById('btn-enable-2fa');
    const btnDisable2FA = document.getElementById('btn-disable-2fa');
    const loginForm = document.getElementById('login-form'); 
    const changePassForm = document.getElementById('change-pass-form');
    const changePassError = document.getElementById('change-pass-error');

    loginForm?.addEventListener('submit', (e) => { 
        e.preventDefault(); 
        const usernameInput = document.getElementById('login-username');
        const passwordInput = document.getElementById('login-password');
        if (usernameInput && passwordInput) {
            performLogin(usernameInput.value, passwordInput.value); 
        }
    });
    registerForm?.addEventListener('submit', (e) => { 
        e.preventDefault(); 
        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        if (username && email && password) {
            performRegister(username, email, password); 
        } else {
            alert("Por favor, preencha todos os campos.");
        }
    });
    const setupForm = document.getElementById('character-setup-form');
    setupForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const charName = document.getElementById('setup-char-name').value;
        const gender = document.getElementById('setup-gender').value;
        const btn = setupForm.querySelector('button');

        if (!charName || !gender) {
            alert("Preencha todos os campos."); return;
        }

        btn.disabled = true;
        btn.textContent = "Criando...";

        try {
            const res = await apiFetch('/users/me/setup_character', {
                method: 'POST',
                body: JSON.stringify({ character_name: charName, gender: gender })
            });
            const data = await res.json();
            
            if (res.ok) {
                alert("Personagem criado com sucesso! Bem-vindo(a) à cozinha.");
                closeModal('character-setup-modal');
                loadProfileData();
            } else {
                alert(data.detail || "Erro ao criar personagem.");
            }
        } catch (err) {
            console.error(err);
            alert("Erro de conexão ao criar personagem.");
        } finally {
            btn.disabled = false;
            btn.textContent = "Finalizar e Jogar";
        }
    });

    const startChatForm = document.getElementById('start-chat-form');
    if (startChatForm) {
        startChatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const targetId = document.getElementById('start-chat-target-id').value;
            const targetName = document.getElementById('start-chat-target-name').textContent;
            const selectedMode = document.getElementById('chat-cipher-mode').value;
            
            currentChatMode = selectedMode;
            localStorage.setItem(`pref_cipher_mode_${targetId}`, selectedMode);
            
            console.log(`Iniciando chat com ${targetName} usando modo: ${selectedMode.toUpperCase()}`);
            
            closeModal('start-chat-modal');
            startPrivateChat(targetId, targetName);
        });
    }

    const pgpUnlockForm = document.getElementById('pgp-unlock-form');
    if (pgpUnlockForm) {
        pgpUnlockForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const password = document.getElementById('pgp-unlock-password').value;
            restoreDecryptionState(password);
        });
    }

    editProfileForm?.addEventListener('submit', (e) => { 
        e.preventDefault(); 
        const emailInput = document.getElementById('edit-email');
        if (emailInput) {
             updateProfileData(emailInput.value); 
        }
    });

    const btnGenKeys = document.getElementById('btn-generate-keys');
        if (btnGenKeys) {
            btnGenKeys.addEventListener('click', generateAndSaveKeys);
        }

    const linkDiscordForm = document.getElementById('link-discord-form');
    if (linkDiscordForm) {
        linkDiscordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const linkCode = document.getElementById('link-code').value;
            const token = localStorage.getItem("jwt_token");

            if (!token) { alert("Você precisa estar logado no site."); return; }
            if (!linkCode || linkCode.length !== 6) { alert("Código inválido."); return; }

            try {
                const response = await apiFetch(`/users/me/confirm_link`, {
                    method: 'POST',
                    body: JSON.stringify({ link_code: linkCode })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.detail || 'Erro desconhecido');

                alert(result.message);
                linkDiscordForm.reset();
                loadProfileData(); 

            } catch (error) {
                console.error("Erro ao confirmar link:", error);
                alert(`Erro: ${error.message}`);
            }
        });
    }

    const enable2FAForm = document.getElementById('2fa-enable-form');
    if (enable2FAForm) {
        enable2FAForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const codeInput = document.getElementById('2fa-code-input');
            if (codeInput) confirmAndEnable2FA(codeInput.value);
        });
    }

    const login2FAForm = document.getElementById('2fa-login-form');
    if (login2FAForm) {
         login2FAForm.addEventListener('submit', (e) => {
             e.preventDefault();
             const userInput = document.getElementById('2fa-login-username');
             const passInput = document.getElementById('2fa-login-password');
             const codeInput = document.getElementById('2fa-login-code');
             if (userInput && passInput && codeInput) {
                  performLogin2FA(userInput.value, passInput.value, codeInput.value);
             }
         });
    }

    if (changePassForm) {
        changePassForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const oldPassword = document.getElementById('old-password').value;
            const newPassword = document.getElementById('new-password').value;
            const token = localStorage.getItem("jwt_token");

            if (!token) { alert("Sessão expirada."); return; }
            if (changePassError) changePassError.textContent = '';

            try {
                const response = await apiFetch(`/users/me/change-password`, {
                    method: 'POST',
                    body: JSON.stringify({ 
                        old_password: oldPassword, 
                        new_password: newPassword 
                    })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.detail || 'Erro desconhecido');

                alert(result.message);
                changePassForm.reset();
                closeModal('change-pass-modal');

            } catch (error) {
                console.error("Erro ao alterar senha:", error);
                if (changePassError) changePassError.textContent = `Erro: ${error.message}`;
            }
        });
    }

    const forgotPasswordLink = document.getElementById('forgot-password-link');
    forgotPasswordLink?.addEventListener('click', (e) => {
        e.preventDefault();
        closeModal('login-modal');
        openModal('forgot-pass-modal');
        document.getElementById('forgot-pass-message').textContent = '';
    });

    const forgotPassForm = document.getElementById('forgot-pass-form');
    const forgotPassMessage = document.getElementById('forgot-pass-message');

    if (forgotPassForm) {
        forgotPassForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('forgot-email').value;
            const submitBtn = forgotPassForm.querySelector('button[type="submit"]');

            if (forgotPassMessage) forgotPassMessage.textContent = 'Processando...';
            submitBtn.disabled = true;

            try {
                const response = await apiFetch(`/forgot-password`, {
                    method: 'POST',
                    body: JSON.stringify({ email: email })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.detail || 'Erro no servidor');

                if (forgotPassMessage) {
                    forgotPassMessage.textContent = result.message;
                    forgotPassMessage.style.color = 'var(--success-color)';
                }
                forgotPassForm.reset();
                
            } catch (error) {
                console.error("Erro ao pedir reset de senha:", error);
                if (forgotPassMessage) {
                    forgotPassMessage.textContent = `Erro: ${error.message}`;
                    forgotPassMessage.style.color = 'var(--error-color)';
                }
            } finally {
                submitBtn.disabled = false;
            }
        });
    }

    const supportTicketForm = document.getElementById('support-ticket-form');
    if (supportTicketForm) {
        supportTicketForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const errorDiv = document.getElementById('support-ticket-error');
            const submitBtn = supportTicketForm.querySelector('button[type="submit"]');
            errorDiv.textContent = '';
            submitBtn.disabled = true;

            try {
                const data = {
                    ticket_type: document.getElementById('support-ticket-type').value,
                    subject: document.getElementById('support-ticket-subject').value,
                    message: document.getElementById('support-ticket-message').value
                };

                if (!data.ticket_type) {
                    throw new Error("Por favor, selecione uma categoria.");
                }

                const response = await apiFetch(`/game/support/create_ticket`, {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.detail || 'Erro no servidor');

                alert(result.message);
                supportTicketForm.reset();
                closeModal('support-ticket-modal');

            } catch (error) {
                console.error("Erro ao criar ticket:", error);
                errorDiv.textContent = `Erro: ${error.message}`;
            } finally {
                submitBtn.disabled = false;
            }
        });
    }
    const forceDisconnectBtn = document.getElementById('btn-force-disconnect');
    if (forceDisconnectBtn) {
        forceDisconnectBtn.addEventListener('click', async () => {
            if (!confirm("Tem certeza que deseja forçar sua desconexão?\n\nUse isso apenas se seu personagem estiver 'preso' no servidor.")) {
                return;
            }
            try {
                const response = await apiFetch(`/users/me/force_disconnect`, { method: 'POST' });
                const result = await response.json();
                if (!response.ok) throw new Error(result.detail);
                alert(result.message);
            } catch (error) {
                alert(`Erro: ${error.message}`);
            }
        });
    }
    const closeTicketBtn = document.getElementById('close-ticket-btn');
    if (closeTicketBtn) {
        closeTicketBtn.addEventListener('click', handleCloseTicket);
    }
    
    btnEnable2FA?.addEventListener('click', start2FASetup);
    btnDisable2FA?.addEventListener('click', disable2FA);
    logoutBtn?.addEventListener('click', (e) => { 
        e.preventDefault(); 
        logout(); 
    });
    document.querySelectorAll('[data-modal-target]').forEach(btn => btn.addEventListener('click', (e) => { 
        e.preventDefault(); 
        openModal(btn.dataset.modalTarget); 
    }));
    document.querySelectorAll('[data-modal-close]').forEach(btn => btn.addEventListener('click', (e) => { 
        e.preventDefault(); 
        closeModal(btn.dataset.modalClose); 
    }));
    document.querySelectorAll('.sidebar-nav a[data-page]').forEach(link => link.addEventListener('click', (e) => { 
        e.preventDefault(); 
        showPage(link.dataset.page); 
        resetInactivityTimer(); 
    })); 
    
    const langSelector = document.getElementById('lang-selector');
    if (langSelector) {
        langSelector.value = currentLanguage; 
        
        langSelector.addEventListener('change', (e) => {
            changeLanguage(e.target.value);
        });
    }
    
    document.getElementById('season-select')?.addEventListener('change', (e) => {
        loadRankingData();
    });
    document.getElementById('ranking-type-select')?.addEventListener('change', (e) => {
        loadRankingData();
    });
    document.querySelector('#nav-daily-reward-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        loadDailyRewardStatus();
    });
    document.querySelector('#nav-mailbox-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (localStorage.getItem("jwt_token")) {
            loadMailbox();
        } else {
            openModal('login-modal');
        }
    });

    document.getElementById('google-login-btn')?.addEventListener('click', startGoogleLogin);
    document.getElementById('google-register-btn')?.addEventListener('click', startGoogleLogin);
    document.getElementById('google-finalize-form')?.addEventListener('submit', finalizeGoogleRegistration);
    handleGoogleCallback()
    const viewTicketReplyForm = document.getElementById('view-ticket-reply-form');
    if (viewTicketReplyForm) {
        viewTicketReplyForm.addEventListener('submit', handleTicketReply);
    }

    document.getElementById('add-friend-form')?.addEventListener('submit', handleAddFriendSubmit);

    document.querySelectorAll('[data-social-tab]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('[data-social-tab]').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.social-content').forEach(c => c.classList.add('hidden'));
            
            const tabId = e.target.closest('button').dataset.socialTab;
            e.target.closest('button').classList.add('active');
            document.getElementById(`social-tab-${tabId}`).classList.remove('hidden');
            
            if (tabId === 'chats') loadMyChats();
            if (tabId === 'communities') loadPublicCommunities();
            if (tabId === 'team') loadMyTeamData();
            if (tabId === 'friends') loadFriendsList();
        });
    });

    document.getElementById('create-group-form')?.addEventListener('submit', handleCreateGroup);
    document.getElementById('create-team-form')?.addEventListener('submit', handleCreateTeam);
    document.getElementById('invite-team-form')?.addEventListener('submit', handleInviteMemberToTeam);
    document.getElementById('leave-team-btn')?.addEventListener('click', handleLeaveTeam);
    document.getElementById('refresh-chats-btn')?.addEventListener('click', loadMyChats);
    document.getElementById('create-community-form')?.addEventListener('submit', handleCreateCommunity);
    document.getElementById('chat-input-form')?.addEventListener('submit', handleSendChatMessage);
    connectChatWebSocket();

    setupShopCategories();
    loadTranslations();
    updateLoginStatus();

    if (localStorage.getItem("jwt_token")) {
        startInactivityTimer();
        startPresenceHeartbeat();
        checkCharacterSetup();
        passiveKeyRestoration();
        initializeChatCrypto();
        SecurityManager.init();
        setTimeout(() => { 
            if (!myPrivateKeyObj && localStorage.getItem("pgp_private_key")) {
                // openModal('pgp-unlock-modal');
            }
        }, 500);
    }
    
    document.body.addEventListener('click', resetInactivityTimer, true);
    document.body.addEventListener('keypress', resetInactivityTimer, true);
});