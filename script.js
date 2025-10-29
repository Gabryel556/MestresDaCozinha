const API_URL = "https://eb55696aaa2c.ngrok-free.app";
const WEBSITE_API_KEY = "ag_b1ac536efcbe3e2972293ebeba9d044227e077bec317bc98e66d4ebc8a198ec8"; 
const jogoLancado = true;
let translations = {};
let stripeProducts = [];
let allShopItems = [];
let inactivityTimer = null; 
let current2FASecret = null;
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
let currentLanguage = localStorage.getItem('preferred_language') || 'pt';

async function performLogin(username, password) {
    try {
        console.log("Chamando API /website/login...")
        const response = await fetch(`${API_URL}/website/login`, {
            method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": WEBSITE_API_KEY },
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
        const response = await fetch(`${API_URL}/register`, {
            method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": WEBSITE_API_KEY },
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
        const pingRes = await fetch(`${API_URL}/ping`);
        if (!pingRes.ok) console.error("Ping falhou:", pingRes.status);
        else {
            const pingData = await pingRes.json();
            console.log("Ping OK:", pingData); 
        }
    } catch(pingErr) {
        console.error("Erro no Ping:", pingErr);
    }

    try {
        const response = await fetch(`${API_URL}/users/me`, {
            headers: { 'Authorization': `Bearer ${token}`, 'X-API-Key': WEBSITE_API_KEY, 'Cache-Control': 'no-cache' }
        });
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

        // --- Bloco 2: Carregar Estatísticas (Bónus, não-crítico) ---
        try {
            const statsResponse = await fetch(`${API_URL}/users/me/stats`, {
                headers: { 'Authorization': `Bearer ${token}`, 'X-API-Key': WEBSITE_API_KEY, 'Cache-Control': 'no-cache' }
            });
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
        const response = await fetch(`${API_URL}/users/me/inventory`, {
            headers: { 
                'Authorization': `Bearer ${token}`, 
                'X-API-Key': WEBSITE_API_KEY,
                'Cache-Control': 'no-cache'
            }
        });
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
        const response = await fetch(`${API_URL}/users/me`, {
            headers: { 'Authorization': `Bearer ${token}`, 'X-API-Key': WEBSITE_API_KEY, 'Cache-Control': 'no-cache' }
        });
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
        const response = await fetch(`${API_URL}/users/me/2fa/setup`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}`, 'X-API-Key': WEBSITE_API_KEY }
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
        const response = await fetch(`${API_URL}/users/me/2fa/enable`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'X-API-Key': WEBSITE_API_KEY },
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
         const response = await fetch(`${API_URL}/users/me/2fa/disable`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'X-API-Key': WEBSITE_API_KEY },
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
        const response = await fetch(`${API_URL}/website/login/2fa`, {
            method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": WEBSITE_API_KEY },
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
         const response = await fetch(`${API_URL}/users/me`, {
             method: 'PATCH',
             headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'X-API-Key': WEBSITE_API_KEY },
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
        const response = await fetch(`${API_URL}/users/me`, {
            headers: { 'Authorization': `Bearer ${token}`, 'X-API-Key': WEBSITE_API_KEY, 'Cache-Control': 'no-cache' }
        });
        //
        if (!response.ok) {
             currencyEl.textContent = 'Erro'; premiumEl.textContent = 'Erro';
             if (response.status === 401) logout();
             return;
        }
        const data = await response.json();
        currencyEl.textContent = data.in_game_currency;
        premiumEl.textContent = data.premium_currency;
        //
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
    const profileNameEl = document.getElementById('user-profile-name');

    if (token && username) {
        loggedInEl?.classList.remove('hidden');
        loggedOutEl?.classList.add('hidden');
        profileLink?.classList.remove('hidden');
        if(profileNameEl) profileNameEl.textContent = username;
        loadUserWallet();
        
    } else {
        loggedInEl?.classList.add('hidden');
        loggedOutEl?.classList.remove('hidden');
        profileLink?.classList.add('hidden');
        if(currencyEl) currencyEl.textContent = '-';
        if(premiumEl) premiumEl.textContent = '-';
    }
}

async function loadRanking() {
    const tableBody = document.getElementById('ranking-table-body');
    if (!tableBody) { console.error("Elemento #ranking-table-body não encontrado."); return; } 
    tableBody.innerHTML = '<tr><td colspan="3">Carregando ranking...</td></tr>';
    try {
        const response = await fetch(`${API_URL}/ranking`);
        if (!response.ok) { 
            const errorData = await response.json().catch(() => ({detail: `Erro HTTP ${response.status}`}));
            throw new Error(errorData.detail || `Erro ${response.status}`);
        }
        const ranking = await response.json();
        
        tableBody.innerHTML = '';
        if (ranking.length === 0) { tableBody.innerHTML = '<tr><td colspan="3">Ninguém no ranking ainda.</td></tr>'; return; }
        
        ranking.forEach((player, index) => {
            const row = tableBody.insertRow();
            row.insertCell().textContent = `#${index + 1}`;
            row.insertCell().textContent = player.username;
            row.insertCell().textContent = player.total_score;
        });
    } catch (error) { 
        console.error("Erro ao carregar ranking:", error);
        tableBody.innerHTML = `<tr><td colspan="3" style="color: red;">${translateKey('error_ranking_load')} ${error.message}</td></tr>`; 
    }
}

async function loadShopItems() {
    document.querySelectorAll('.shop-items-grid').forEach(grid => grid.innerHTML = '<p>Carregando itens...</p>');
    let hasLoadError = false;
    try {
        if (allShopItems.length === 0) {
            const internalResponse = await fetch(`${API_URL}/shop/items?item_type=premium`);
            if (!internalResponse.ok) { 
                 hasLoadError = true; 
                 const err = await internalResponse.json().catch(() => ({detail:''}));
                 throw new Error(`Falha itens premium (${internalResponse.status}) ${err.detail}`); 
            }
            allShopItems = await internalResponse.json(); 
        }
        if (stripeProducts.length === 0) {
             const stripeResponse = await fetch(`${API_URL}/shop/stripe-products`);
             if (!stripeResponse.ok) { 
                 hasLoadError = true; 
                 const err = await stripeResponse.json().catch(() => ({detail:''}));
                 throw new Error(`Falha itens loja (${stripeResponse.status}) ${err.detail}`);
             }
             stripeProducts = await stripeResponse.json();
        }
        renderShopItems();
    } catch (error) {
        console.error("Erro ao carregar itens da loja:", error);
         if(!document.querySelector('.shop-items-grid p')?.textContent.includes('Erro:')) {
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
        const response = await fetch(`${API_URL}/shop/create-checkout-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'X-API-Key': WEBSITE_API_KEY },
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
        const response = await fetch(`${API_URL}/shop/buy_internal_item`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json','Authorization': `Bearer ${token}`, 'X-API-Key': WEBSITE_API_KEY },
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
    
    allShopItems.forEach(item => {
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
        if (pageId === 'ranking') loadRanking();
        else if (pageId === 'profile'){ 
            loadProfileData(); 
            check2FAStatus(); 
        }
        else if (pageId === 'loja') loadShopItems();
    }
}

function setupShopCategories() {
    const categoryButtons = document.querySelectorAll('.shop-category-btn');
    const categoryContents = document.querySelectorAll('.shop-category-content');
    categoryButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetCategory = button.dataset.category;
            categoryContents.forEach(content => content.classList.remove('active'));
            categoryButtons.forEach(btn => btn.classList.remove('active'));
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
        btn.onclick = () => window.location.href = 'https://drive.google.com/drive/folders/1ZllnIiZQWxJx0vuItNVlyK1ZStI6ifVU?usp=sharing'; 
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
                const response = await fetch(`${API_URL}/users/me/confirm_link`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`, 
                        'X-API-Key': WEBSITE_API_KEY 
                    },
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
                const response = await fetch(`${API_URL}/users/me/change-password`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        'X-API-Key': WEBSITE_API_KEY
                    },
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
                const response = await fetch(`${API_URL}/forgot-password`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': WEBSITE_API_KEY
                    },
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

    setupShopCategories();
    loadTranslations();
    updateLoginStatus();
    
    if (localStorage.getItem("jwt_token")) {
        startInactivityTimer();
    }
    
    document.body.addEventListener('click', resetInactivityTimer, true);
    document.body.addEventListener('keypress', resetInactivityTimer, true);
});