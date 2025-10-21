const API_URL = "http://127.0.0.1:8000";
const WEBSITE_API_KEY = "ag_b1ac536efcbe3e2972293ebeba9d044227e077bec317bc98e66d4ebc8a198ec8"; 
const jogoLancado = true;
let currentLanguage = 'pt';
let translations = {};
let stripeProducts = [];
let allShopItems = [];
let inactivityTimer = null; 
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

async function performLogin(username, password) {
    try {
        const response = await fetch(`${API_URL}/website/login`, {
            method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": WEBSITE_API_KEY },
            body: JSON.stringify({ username, password })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || `Erro ${response.status}`);
        localStorage.setItem("jwt_token", result.access_token);
        localStorage.setItem("username", result.username);
        updateLoginStatus(); closeModal('login-modal'); closeModal('register-modal');
        document.getElementById('login-form')?.reset(); document.getElementById('register-form')?.reset();
        startInactivityTimer();
    } catch (error) { console.error("Erro Login:", error); alert(`Erro ao entrar: ${error.message}`); }
}

async function performRegister(username, email, password) {
    try {
        const response = await fetch(`${API_URL}/register`, {
            method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": WEBSITE_API_KEY },
            body: JSON.stringify({ username, email, password })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || `Erro ${response.status}`);
        alert(`Usuário ${username} criado! Fazendo login...`);
        document.getElementById('register-form')?.reset(); closeModal('register-modal');
        await performLogin(username, password);
    } catch (error) { console.error("Erro Registro:", error); alert(`Erro ao registrar: ${error.message}`); }
}

function logout() {
    localStorage.removeItem("jwt_token"); localStorage.removeItem("username");
    if (inactivityTimer) { clearTimeout(inactivityTimer); inactivityTimer = null; console.log("Timer cancelado (logout)."); } 
    updateLoginStatus(); showPage('inicio');
}

async function loadProfileData() {
    const loadingDiv = document.getElementById('profile-info-loading');
    const contentDiv = document.getElementById('profile-info-content');
    const errorDiv = document.getElementById('profile-info-error');
    const linkDiscordForm = document.getElementById('link-discord-form'); // Pega o formulário
    const discordLinkedStatus = document.getElementById('discord-linked-status'); // Pega o div de status
    const token = localStorage.getItem("jwt_token");

    // Esconde tudo, mostra 'carregando', esconde form e status de link
    loadingDiv?.classList.remove('hidden'); 
    contentDiv?.classList.add('hidden'); 
    errorDiv?.classList.add('hidden');
    linkDiscordForm?.classList.add('hidden');      // <-- Esconde formulário por padrão
    discordLinkedStatus?.classList.add('hidden'); // <-- Esconde status por padrão

    if (!token) {
        if(errorDiv) errorDiv.textContent = "Você precisa estar logado."; 
        errorDiv?.classList.remove('hidden');
        loadingDiv?.classList.add('hidden'); 
        return;
    }

    try {
        const response = await fetch(`${API_URL}/users/me`, {
            headers: { 'Authorization': `Bearer ${token}`, 'X-API-Key': WEBSITE_API_KEY }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || `Erro ${response.status}`);

        // Preenche os campos do perfil (como antes)
        document.getElementById('profile-username').textContent = data.username;
        document.getElementById('profile-email').textContent = data.email;
        document.getElementById('profile-currency').textContent = data.in_game_currency;
        document.getElementById('profile-premium').textContent = data.premium_currency;
        document.getElementById('profile-score').textContent = data.total_score;
        document.getElementById('profile-created').textContent = new Date(data.created_at).toLocaleDateString();
        document.getElementById('edit-email').value = data.email; 

        // ---- LÓGICA DE VISIBILIDADE DO VÍNCULO ----
        if (data.discord_id) { 
            // Se discord_id existe e não é nulo/vazio, mostra o status
            discordLinkedStatus?.classList.remove('hidden');
            linkDiscordForm?.classList.add('hidden'); // Garante que form esteja escondido
        } else {
            // Se não tem discord_id, mostra o formulário
            linkDiscordForm?.classList.remove('hidden');
            discordLinkedStatus?.classList.add('hidden'); // Garante que status esteja escondido
        }
        // ------------------------------------------

        // Mostra o conteúdo do perfil
        contentDiv?.classList.remove('hidden'); 
        loadingDiv?.classList.add('hidden');

    } catch (error) {
        console.error("Erro ao carregar perfil:", error);
        if(errorDiv) errorDiv.textContent = `Erro ao carregar dados: ${error.message}`; 
        errorDiv?.classList.remove('hidden');
        loadingDiv?.classList.add('hidden');
        // Desloga se o token for inválido
        if (response && response.status === 401 || error.message.toLowerCase().includes("token")) {
             console.log("Token inválido/expirado detectado. Deslogando.");
             logout();
        }
    }
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
         alert("Email atualizado com sucesso!"); closeModal('edit-profile-modal');
         loadProfileData(); // Recarrega os dados do perfil para mostrar o novo email
     } catch (error) { console.error("Erro ao atualizar perfil:", error); alert(`Erro ao salvar: ${error.message}`); }
}

async function loadRanking() {
    const tableBody = document.getElementById('ranking-table-body');
    if (!tableBody) { console.error("Elemento #ranking-table-body não encontrado."); return; } 
    tableBody.innerHTML = '<tr><td colspan="3">Carregando ranking...</td></tr>';
    try {
        const response = await fetch(`${API_URL}/ranking`); // Endpoint público
        if (!response.ok) { 
            const errorData = await response.json().catch(() => ({detail: `Erro HTTP ${response.status}`}));
            throw new Error(errorData.detail || `Erro ${response.status}`);
        }
        const ranking = await response.json();
        
        tableBody.innerHTML = ''; // Limpa antes de preencher
        if (ranking.length === 0) { tableBody.innerHTML = '<tr><td colspan="3">Ninguém no ranking ainda.</td></tr>'; return; }
        
        ranking.forEach((player, index) => {
            const row = tableBody.insertRow();
            // Adiciona células com os dados
            row.insertCell().textContent = `#${index + 1}`;
            row.insertCell().textContent = player.username;
            row.insertCell().textContent = player.total_score;
        });
    } catch (error) { 
        console.error("Erro ao carregar ranking:", error);
        tableBody.innerHTML = `<tr><td colspan="3" style="color: red;">Erro ao carregar ranking: ${error.message}</td></tr>`; 
    }
}

async function loadShopItems() {
    document.querySelectorAll('.shop-items-grid').forEach(grid => grid.innerHTML = '<p>Carregando itens...</p>');
    let hasLoadError = false; // Flag para evitar múltiplas mensagens de erro
    try {
        // Busca itens internos (cash) da tabela 'items'
        if (allShopItems.length === 0) {
            const internalResponse = await fetch(`${API_URL}/shop/items?item_type=premium`); // Pede só premium
            if (!internalResponse.ok) { 
                 hasLoadError = true; 
                 const err = await internalResponse.json().catch(() => ({detail:''}));
                 throw new Error(`Falha itens premium (${internalResponse.status}) ${err.detail}`); 
            }
            allShopItems = await internalResponse.json(); 
        }
        // Busca itens Stripe (recarga/vip)
        if (stripeProducts.length === 0) {
             const stripeResponse = await fetch(`${API_URL}/shop/stripe-products`);
             if (!stripeResponse.ok) { 
                 hasLoadError = true; 
                 const err = await stripeResponse.json().catch(() => ({detail:''}));
                 throw new Error(`Falha itens loja (${stripeResponse.status}) ${err.detail}`);
             }
             stripeProducts = await stripeResponse.json();
        }
        renderShopItems(); // Renderiza tudo se ambas as buscas funcionarem
    } catch (error) {
        console.error("Erro ao carregar itens da loja:", error);
        // Mostra o erro apenas uma vez, mesmo se ambas as buscas falharem
         if(!document.querySelector('.shop-items-grid p')?.textContent.includes('Erro:')) {
            document.querySelectorAll('.shop-items-grid').forEach(grid => grid.innerHTML = `<p style="color: red;">Erro ao carregar produtos: ${error.message}</p>`);
         }
    }
}

async function handleBuyClick(event) { // Para Stripe (Recarga/VIP)
    const button = event.target;
    const priceId = button.dataset.itemId; // O ID do preço do Stripe
    const token = localStorage.getItem("jwt_token");
    if (!token) { alert("Você precisa estar logado para comprar!"); openModal('login-modal'); return; }
    
    button.disabled = true; button.textContent = 'Indo para pagamento...';
    try {
        const response = await fetch(`${API_URL}/shop/create-checkout-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'X-API-Key': WEBSITE_API_KEY },
            body: JSON.stringify({ priceId: priceId })
        });
        const session = await response.json();
        if (!response.ok) throw new Error(session.detail || 'Falha ao iniciar checkout');
        // Redireciona o usuário para a página de checkout hospedada pelo Stripe
        window.location.href = session.checkout_url; 
    } catch (error) {
        console.error("Erro checkout Stripe:", error); alert(`Erro ao iniciar pagamento: ${error.message}`);
        button.disabled = false; 
        // Encontra o tipo original para restaurar o texto do botão
        const originalItem = stripeProducts.find(p => p.price_id === priceId);
        button.textContent = originalItem?.type === 'recurring' ? 'Assinar' : 'Comprar';
    }
}

// (Adicione esta função e REMOVA handleBuyWithCashClick)
async function handleBuyInternalClick(event) {
    const button = event.target;
    const itemId = parseInt(button.dataset.itemId); 
    const itemName = button.dataset.itemName; 
    // Determina a moeda pelo botão clicado
    const currencyType = button.classList.contains('buy-normal') ? 'normal' : 'premium'; 
    const token = localStorage.getItem("jwt_token");

    if (!token || isNaN(itemId) || !itemName) { alert("Erro interno ou não logado."); return; } 
    if (!confirm(`Comprar '${itemName}' usando ${currencyType === 'normal' ? 'Moedas' : 'Cash'}?`)) return;

    button.disabled = true; button.textContent = 'Processando...';
    try {
        const response = await fetch(`${API_URL}/shop/buy_internal_item`, { // Chama o endpoint unificado
            method: 'POST',
            headers: { 'Content-Type': 'application/json','Authorization': `Bearer ${token}`, 'X-API-Key': WEBSITE_API_KEY },
            body: JSON.stringify({ itemId: itemId, currencyType: currencyType }) // Envia ID e tipo de moeda
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || 'Falha na compra');
        alert(result.message); 
        loadProfileData(); // Recarrega perfil para atualizar saldo
    } catch (error) { console.error(`Erro compra ${currencyType}:`, error); alert(`Erro: ${error.message}`); } 
    finally { 
        button.disabled = false; 
        button.textContent = button.textContent = `Comprar (${currencyType === 'normal' ? itemPriceNormalText : itemPricePremiumText})`; // Precisa buscar o preço original aqui
        // TODO: Melhorar restauração do texto do botão
    }
}

function updateLoginStatus() {
    const token = localStorage.getItem("jwt_token"); const username = localStorage.getItem("username");
    const loggedOutEl = document.getElementById('auth-logged-out'); const loggedInEl = document.getElementById('auth-logged-in');
    const profileLink = document.getElementById('nav-profile-link');
    const profileNameEl = document.getElementById('user-profile-name');
    
    if (token && username) {
        loggedInEl?.classList.remove('hidden'); loggedOutEl?.classList.add('hidden'); profileLink?.classList.remove('hidden');
        if(profileNameEl) profileNameEl.textContent = username;
    } else {
        loggedInEl?.classList.add('hidden'); loggedOutEl?.classList.remove('hidden'); profileLink?.classList.add('hidden');
    }
}

function openModal(modalId) { const m = document.getElementById(modalId); if(m) m.classList.remove('hidden'); }
function closeModal(modalId) { const m = document.getElementById(modalId); if(m) m.classList.add('hidden'); }

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
        const buttonClone = button.cloneNode(true); // Clona para limpar listeners
        button.parentNode.replaceChild(buttonClone, button);

        // Adiciona listener correto
        if (buttonClone.classList.contains('buy-stripe')) { // Botões Stripe (Recarga/VIP)
            buttonClone.addEventListener('click', handleBuyClick); 
        } else if (buttonClone.classList.contains('buy-normal')) { // Botão Moeda Normal
            buttonClone.addEventListener('click', handleBuyInternalClick); 
        } else if (buttonClone.classList.contains('buy-premium')) { // Botão Cash Premium
             buttonClone.addEventListener('click', handleBuyInternalClick); 
        }
    });
}


function createCategoryGrid(categoryId) {
    const container = document.getElementById(`category-${categoryId}`); 
    if (!container) { console.warn(`Container #category-${categoryId} não encontrado.`); return null; } 
    let grid = document.getElementById(`${categoryId}-items`);
    if (!grid) {
        // Cria o H2 apenas se a categoria não for recarga ou vip (que já têm no HTML)
        if (categoryId !== 'recarga' && categoryId !== 'vip') {
             container.innerHTML = `<h2>${categoryId.charAt(0).toUpperCase() + categoryId.slice(1)}</h2>`; 
        } else {
             container.innerHTML = ''; // Limpa o "Carregando..."
        }
        grid = document.createElement('div'); grid.className = 'shop-items-grid'; grid.id = `${categoryId}-items`;
        container.appendChild(grid);
    } return grid;
}

function createShopCard(name, desc, price, btnTxt, btnType, itemId, token, imgUrl) { 
    const card = document.createElement('div'); card.className = 'shop-item-card';
    const imgHtml = imgUrl ? `<img src="${imgUrl}" alt="${name}" class="shop-item-image">` : '<div class="shop-item-image-placeholder">?</div>';
    card.innerHTML = `${imgHtml}<h3>${name}</h3><p class="item-description">${desc || ''}</p><p class="item-price">${price}</p>
        <button class="buy-button" data-item-id="${itemId}" data-item-name="${name}" data-button-type="${btnType}" ${!token ? 'disabled' : ''}>${btnTxt}</button>`;
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

    // Carrega dados se a página ficou ativa
    if (targetPage?.classList.contains('active')) {
        if (pageId === 'ranking') loadRanking();
        else if (pageId === 'profile') loadProfileData();
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
        console.log("Inatividade! Deslogando..."); alert("Sua sessão expirou por inatividade."); logout();
    }, INACTIVITY_TIMEOUT_MS);
}
function resetInactivityTimer() { if (localStorage.getItem("jwt_token")) startInactivityTimer(); } // Só reinicia se estiver logado

/* ================================================== */
/* TRADUÇÃO E BOTÃO DE DOWNLOAD           */
/* ================================================== */
async function loadTranslations() {
    try {
        const response = await fetch('translations.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        translations = await response.json();
        applyTranslations(); // Aplica traduções após carregar
    } catch (error) { 
        console.error('Erro ao carregar traduções:', error); 
        // Tenta aplicar com o que tiver (pode ser vazio ou de cache antigo)
        applyTranslations(); 
    }
}

function applyTranslations() {
    document.querySelectorAll('[data-translate]').forEach(el => {
        const key = el.getAttribute('data-translate');
        const translatedText = translations[currentLanguage]?.[key];
        
        // Se for um span dentro de um link de nav, aplica no span
        const targetElement = el.tagName === 'A' && el.querySelector('span[data-translate]') ? el.querySelector('span[data-translate]') : el;
        const targetKey = targetElement.getAttribute('data-translate');

        if (translations[currentLanguage]?.[targetKey]) {
            targetElement.textContent = translations[currentLanguage][targetKey];
        } else if (translations['pt']?.[targetKey]) { // Fallback para PT
             targetElement.textContent = translations['pt'][targetKey]; 
        } else {
             // Mantém o texto original se não achar tradução nem fallback
             // targetElement.textContent = targetKey; // Descomente se quiser mostrar a chave
        }
    });
    updateDownloadButton(); 
}


function changeLanguage(lang) {
    if (['pt', 'en'].includes(lang)) { // Valida o idioma
        currentLanguage = lang;
        document.documentElement.lang = lang; 
        applyTranslations(); 
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
        // !! SUBSTITUA '#' PELO SEU LINK DE DOWNLOAD REAL !!
        btn.onclick = () => window.location.href = '#'; 
    } else {
        btn.textContent = translations[currentLanguage]?.[keySoon] || 'Coming Soon';
        btn.classList.add('disabled'); btn.classList.remove('active'); btn.disabled = true;
        btn.onclick = null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Carregado. Configurando eventos...");
    const loginForm = document.getElementById('login-form'); 
    const registerForm = document.getElementById('register-form');
    const logoutBtn = document.getElementById('logout-btn'); 
    const editProfileForm = document.getElementById('edit-profile-form');
    
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
    
    logoutBtn?.addEventListener('click', (e) => { e.preventDefault(); logout(); });
    document.querySelectorAll('[data-modal-target]').forEach(btn => btn.addEventListener('click', (e) => { e.preventDefault(); openModal(btn.dataset.modalTarget); }));
    document.querySelectorAll('[data-modal-close]').forEach(btn => btn.addEventListener('click', (e) => { e.preventDefault(); closeModal(btn.dataset.modalClose); }));
    document.querySelectorAll('.sidebar-nav a[data-page]').forEach(link => link.addEventListener('click', (e) => { e.preventDefault(); showPage(link.dataset.page); resetInactivityTimer(); })); 
    document.querySelectorAll('.language-switcher button[data-lang]').forEach(btn => btn.addEventListener('click', () => changeLanguage(btn.dataset.lang)));

    setupShopCategories();
    loadTranslations();
    updateLoginStatus();
    
    if (localStorage.getItem("jwt_token")) {
        startInactivityTimer();
    }
    
    document.body.addEventListener('click', resetInactivityTimer, true);
    document.body.addEventListener('keypress', resetInactivityTimer, true);
});