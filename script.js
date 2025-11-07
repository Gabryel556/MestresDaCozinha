const API_URL = "https://87486ffba1a4.ngrok-free.app";
const WEBSITE_API_KEY = "ag_b1ac536efcbe3e2972293ebeba9d044227e077bec317bc98e66d4ebc8a198ec8"; 
const jogoLancado = true;
let translations = {};
let stripeProducts = [];
let allShopItems = [];
let inactivityTimer = null; 
let current2FASecret = null;
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
let currentLanguage = localStorage.getItem('preferred_language') || 'pt';
let featuredItems = [];

/**
 * Wrapper 'fetch' personalizado para adicionar cabeçalhos padrão da API e do Ngrok.
 * @param {string} endpoint - O endpoint da API (ex: /users/me)
 * @param {object} options - As opções do fetch (method, body, etc.)
 * @returns {Promise<Response>}
 */
async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem("jwt_token");

    const headers = new Headers();
    headers.append("X-API-Key", WEBSITE_API_KEY);

    headers.append("ngrok-skip-browser-warning", "true");

    if (token) {
        headers.append("Authorization", `Bearer ${token}`);
    }

    if (!options.method || options.method === 'GET') {
        headers.append("Cache-Control", "no-cache");
    }

    if (options.body) {
        headers.append("Content-Type", "application/json");
    }

    if (options.headers) {
        for (const [key, value] of Object.entries(options.headers)) {
            headers.append(key, value);
        }
    }

    const fetchOptions = {
        ...options,
        headers: headers
    };

    return fetch(`${API_URL}${endpoint}`, fetchOptions);
}

async function performLogin(username, password) {
    try {
        console.log("Chamando API /website/login...")
        const response = await apiFetch(`/website/login`, {
            method: "POST",
            body: JSON.stringify({ username, password })
        });
        const result = await response.json();
        console.log("RESPOSTA DA API LOGIN:", result);
        
        if (response.status === 200 && result.access_token) {
            localStorage.setItem("jwt_token", result.access_token);
            localStorage.setItem("username", result.username);
            updateLoginStatus(); 
            closeModal('login-modal'); 
            closeModal('register-modal');
            document.getElementById('login-form')?.reset(); 
            document.getElementById('register-form')?.reset();
            startInactivityTimer(); 
        } else if (response.status === 200 && result['2fa_required'] === true) {
            console.log("API retornou 2fa_required. Abrindo modal 2FA...");
            closeModal('login-modal');
            const userHidden = document.getElementById('2fa-login-username');
            const passHidden = document.getElementById('2fa-login-password');
            if(userHidden) userHidden.value = username;
            if(passHidden) passHidden.value = password;
            document.getElementById('2fa-login-error').textContent = '';
            openModal('2fa-login-modal');
        } else { throw new Error(result.detail || `Erro ${response.status}`); }
    } catch (error) { console.error("Erro performLogin:", error); alert(`Erro: ${error.message}`); }
}

async function performRegister(username, email, password) {
    try {
        const response = await apiFetch(`/register`, {
            method: "POST",
            body: JSON.stringify({ username, email, password })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || `Erro ${response.status}`);
        alert(translateKey('alert_login_success', {username: username}));
        document.getElementById('register-form')?.reset(); closeModal('register-modal');
        await performLogin(username, password);
    } catch (error) { console.error("Erro Registro:", error); alert(`Erro ao registrar: ${error.message}`); }
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
        console.log("Tentando /ping...");
        const pingRes = await apiFetch(`/ping`);
        if (!pingRes.ok) console.error("Ping falhou:", pingRes.status);
        else {
            const pingData = await pingRes.json();
            console.log("Ping OK:", pingData); 
        }
    } catch(pingErr) {
        console.error("Erro no Ping:", pingErr);
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
            
            const imgHtml = item.image_url 
                ? `<img src="${item.image_url}" alt="${item.item_name}" class="shop-item-image">` 
                : '<div class="shop-item-image-placeholder">?</div>';

            card.innerHTML = `
                ${imgHtml}
                <h3>${item.item_name}</h3>
                <p class.item-description">${item.description || '...'}</p>
                <div class="buy-options" style="margin-top: 1rem;">
                    <span style="font-size: 1.2rem; font-weight: bold; color: var(--text-primary);">
                        Quantidade: ${item.total_quantity}
                    </span>
                </div>
            `;
            grid.appendChild(card);
        });

    } catch (error) {
        console.error("Erro ao carregar inventário:", error);
        grid.innerHTML = `<p style="color: var(--error-color);">Erro ao carregar inventário: ${error.message}</p>`;
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
            const imgHtml = ing.image_url ? `<img src="${ing.image_url}" alt="${ing.name}" class="shop-item-image">` : '<div class="shop-item-image-placeholder">?</div>';
            
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

            card.innerHTML = `
                ${imgHtml}
                <h3>${ing.name}</h3>
                <p class="item-description">${ing.description || 'Um ingrediente...'}</p>
                
                <h4 style="margin-top: 1rem; margin-bottom: 0.5rem; color: var(--text-primary);">Atributos de Sabor</h4>
                <ul class="codex-stats">
                    <li><strong>Salgado:</strong> <span>${ing.attr_salty}</span></li>
                    <li><strong>Doce:</strong> <span>${ing.attr_sweet}</span></li>
                    <li><strong>Ácido:</strong> <span>${ing.attr_sour}</span></li>
                    <li><strong>Amargo:</strong> <span>${ing.attr_bitter}</span></li>
                    <li><strong>Umami:</strong> <span>${ing.attr_umami}</span></li>
                    <li><strong>Textura:</strong> <span>${ing.attr_texture}</span></li>
                    <li><strong>Aroma:</strong> <span>${ing.attr_aroma}</span></li>
                </ul>
                
                <h4 style="margin-top: 1rem; margin-bottom: 0.5rem; color: var(--text-primary);">Regras de Jogo</h4>
                <ul class="codex-stats">
                    <li><strong>Tags:</strong> <span>${tags_text}</span></li>
                    ${cook_rules_html}
                </ul>
            `;
            
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
            const imgHtml = recipe.output_image_url ? `<img src="${recipe.output_image_url}" alt="${recipe.output_item_name}" class="shop-item-image">` : '<div class="shop-item-image-placeholder">?</div>';
            
            const ingredientsHtml = recipe.ingredients.map(ing => 
                `<li>${ing.item_name} (x${ing.quantity_required})</li>`
            ).join('');
            
            card.innerHTML = `
                ${imgHtml}
                <h3>${recipe.output_item_name} (x${recipe.output_item_quantity})</h3>
                <div class="codex-recipe-ingredients">
                    <strong>Ingredientes:</strong>
                    <ul>${ingredientsHtml || '<li>Nenhum</li>'}</ul>
                </div>
            `;
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
        localStorage.setItem("username", result.username);
        updateLoginStatus(); 
        closeModal('2fa-login-modal');
        document.getElementById('2fa-login-form').reset(); 
        startInactivityTimer();
    } catch (error) { console.error("Erro Login 2FA:", error); errorDiv.textContent = `Erro: ${error.message}`; }
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
            const imgHtml = item.image_url ? `<img src="${item.image_url}" alt="${item.item_name}" class="shop-item-image">` : '<div class="shop-item-image-placeholder">?</div>';
            
            card.innerHTML = `
                <div class="featured-badge">${item.display_name}</div> 
                ${imgHtml}
                <h3>${item.item_name}</h3>
                <p class="item-description">${item.description || ''}</p>
                <div class="buy-options">
                    ${buttonsHtml || '<p>Item não disponível</p>'} 
                </div>
            `;
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
        const imgHtml = item.image_url ? `<img src="${item.image_url}" alt="${item.item_name}" class="shop-item-image">` : '<div class="shop-item-image-placeholder">?</div>';
        
        card.innerHTML = `
            ${imgHtml}
            <h3>${item.item_name}</h3>
            <p class="item-description">${item.description || ''}</p>
            <div class="buy-options">
                ${buttonsHtml || '<p>Item não disponível</p>'} 
            </div>
        `;
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
    const card = document.createElement('div'); card.className = 'shop-item-card';
    const imgHtml = imgUrl ? `<img src="${imgUrl}" alt="${name}" class="shop-item-image">` : '<div class="shop-item-image-placeholder">?</div>';
    card.innerHTML = `${imgHtml}<h3>${name}</h3><p class="item-description">${desc || ''}</p><p class="item-price">${price}</p>
    <button class="buy-button ${btnType}" data-item-id="${itemId}" data-item-name="${name}" ${!token ? 'disabled' : ''}>${btnTxt}</button>`;
    if (!token) card.querySelector('.buy-button').classList.add('requires-login');
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
            
            card.innerHTML = `
                <h3 style="color: var(--text-primary);">${mail.subject}</h3>
                <small style="color:var(--text-secondary); font-size: 0.8rem;">${new Date(mail.sent_at).toLocaleString('pt-BR')}</small>
                <p class="item-description" style="margin: 0.75rem 0;">${mail.message || 'Sem mensagem.'}</p>
                ${rewards.length > 0 ? `<strong data-translate="modal_mailbox_rewards">Recompensas:</strong><p style="color:var(--accent-orange); margin-top: 5px;">${rewards.join(', ')}</p>` : ''}
                <button class="register-btn claim-mail-btn" data-mail-id="${mail.mail_id}" style="width: 100%; margin-top: 1rem;">
                    ${rewards.length > 0 ? translateKey('modal_mailbox_claim') : translateKey('modal_mailbox_read')}
                </button>
            `;
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
            row.innerHTML = `
                <td>${ticket.ticket_id}</td>
                <td>${ticket.subject}</td>
                <td><strong class="status-${ticket.status.toLowerCase()}" data-translate="${statusKey}">${ticket.status}</strong></td>
                <td>${new Date(ticket.updated_at).toLocaleString('pt-BR')}</td>
                <td class="action-buttons">
                    <button class="secondary-button view-ticket-btn" data-ticket-id="${ticket.ticket_id}" data-ticket-subject="${ticket.subject}">Ver/Responder</button>
                </td>
            `;
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

            messagesView.innerHTML += `
                <div class="ticket-message ${senderClass}">
                    <small><strong>${sender}</strong> (${senderType}) - ${new Date(msg.created_at).toLocaleString('pt-BR')}</small>
                    <p>${msg.message_content.replace(/\n/g, '<br>')}</p>
                </div>
            `;
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
        const usernameInput = document.getElementById('username');
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        if (usernameInput && emailInput && passwordInput) {
            performRegister(usernameInput.value, emailInput.value, passwordInput.value); 
        }
    });
    editProfileForm?.addEventListener('submit', (e) => { 
        e.preventDefault(); 
        const emailInput = document.getElementById('edit-email');
        if (emailInput) {
             updateProfileData(emailInput.value); 
        }
    });

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
    const viewTicketReplyForm = document.getElementById('view-ticket-reply-form');
    if (viewTicketReplyForm) {
        viewTicketReplyForm.addEventListener('submit', handleTicketReply);
    }

    setupShopCategories();
    loadTranslations();
    updateLoginStatus();
    
    if (localStorage.getItem("jwt_token")) {
        startInactivityTimer();
    }
    
    document.body.addEventListener('click', resetInactivityTimer, true);
    document.body.addEventListener('keypress', resetInactivityTimer, true);
});