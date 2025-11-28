const API_URL = "http://127.0.0.1:8000";

function getAdminHeaders() {
    const key = sessionStorage.getItem("admin_api_key");
    
    if (!key) {
        const keyLoginSection = document.getElementById('admin-key-login-section');
        if (!keyLoginSection || keyLoginSection.classList.contains('hidden')) {
             alert("Erro: Chave de API de admin não encontrada. Faça o login.");
             document.getElementById('admin-key-login-section')?.classList.remove('hidden');
             document.getElementById('admin-main-content')?.classList.add('hidden');
        }
        
        throw new Error("Chave de API de admin não encontrada.");
    }
    
    return { 
        "Content-Type": "application/json", 
        "X-API-Key": key
    };
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

let createItemForm;
let deleteItemForm;
let grantCurrencyForm;
let grantPremiumCurrencyForm;
let grantItemForm;
let grantVipForm;
let setAdminForm;
let createCodeForm;
let cancelEditCodeBtn; 
let refreshCodesBtn;
let redeemCodesListBody;
let banUserForm;
let unbanUserForm;
let createIngredientForm;
let cancelEditIngredientBtn;
let createJudgeForm;
let cancelEditJudgeBtn;
let createRecipeForm;
let cancelEditRecipeBtn;
let createPrepStepForm;
let refreshPrepStepsBtn;
let prepStepsListBody;
let createSeasonForm;
let cancelEditSeasonBtn;
let createRewardForm;
let cancelEditRewardBtn;
let createQuestForm;
let cancelEditQuestBtn;
let createAchievementForm;
let cancelEditAchBtn;
let createVipRewardForm;
let refreshVipRewardsBtn;
let vipRewardsListBody;
let settingsVipStatus;
let toggleVipPurchasesBtn;
let settingsMatchmakingStatus;
let toggleMatchmakingBtn;
let createOrderForm;
let refreshOrdersBtn;
let ordersListBody;
let createGameModeForm;
let cancelEditGameModeBtn;
let refreshGameModesBtn;
let gameModesListBody;
let createLevelForm;
let cancelEditLevelBtn;
let refreshLevelsBtn;
let levelsListBody;
let editUserModal;
let editUserForm;
let cancelEditUserBtn;
let cancelEditItemBtn;
let refreshUsersBtn;
let refreshItemsBtn;
let refreshAchievementsBtn;
let refreshIngredientsBtn;
let refreshJudgesBtn;
let refreshRecipesBtn;
let refreshSeasonsBtn;
let bpSeasonSelect;
let userListBody;
let itemListBody;
let achievementsListBody;
let ingredientsListBody;
let judgesListBody;
let recipesListBody;
let seasonsListBody;
let rewardsListBody;
let questsListBody;
let petAbilitiesManager;
let createAbilityForm;
let cancelEditAbilityBtn;
let abilitiesListBody;
let abilityPetName;
let navLinks;
let adminPages;
let editUserModalOverlay;
let editUserModalCloseBtn;
let refreshDashboardBtn; 
let broadcastForm; 
let refreshLogsBtn; 
let adminLogsBody;
let createNewsForm; 
let cancelEditNewsBtn;
let refreshNewsBtn; 
let newsListBody; 
let createEventForm; 
let refreshEventsBtn; 
let eventsListBody;
let userDetailsModal;
let userDetailsLoading;
let userDetailsContent;
let editUserStatsForm;
let wipeInventoryBtn;
let wipeStatsBtn;
let wipeBattlepassBtn;
let batchDiscountForm;
let archiveRankingForm;
let gameSettingsForm;
let searchTransactionsForm;
let transactionsListBody;
let refreshServersBtn;
let serversListBody;
let refreshApiKeysBtn;
let apiKeysListBody;
let editApiKeyModal;
let editApiKeyForm;
let sendMailForm;
let sendMassMailForm;
let refreshTicketsBtn;
let ticketsListBody;
let ticketCategoryFilter;
let ticketStatusFilter;
let refreshAnalyticsBtn;
let analyticsMonetizationBody;
let analyticsGameModesBody;
let analyticsTotalUsers;
let analyticsVerifiedUsers;
let analyticsBannedUsers;
let analyticsTotalCurrency;
let analyticsTotalPremium;
let refreshFeaturedBtn;
let createFeaturedSlotForm;
let featuredItemsListBody;
let setFeaturedItemModal;
let setFeaturedItemForm;
let refreshReportsBtn;
let reportStatusFilter;
let moderationListBody;
let refreshDailyRewardsBtn;
let createDailyRewardForm;
let dailyRewardsListBody;
let editUserInventoryForm;
let analyticsFilterForm;
let searchChatLogsForm;
let chatLogsResultBody;
let webTicketsListBody;
let webTicketModal;
let webTicketModalTitle;
let webTicketMessagesView;
let webTicketReplyForm;
let refreshAlertsBtn;
let alertsListBody;
let analyticsEconomySourcesBody;
let analyticsEconomySinksBody;
let settingsDailyLoginStatus;
let toggleDailyLoginBtn;
let resetDailyLoginBtn;
let setRoleForm;
let roleIdSelect;
let keyLoginForm;
let keyLoginSection;
let keyLoginError;
let adminApiKeyInput;
let mainContent;
let logoutBtn;
let analyticsTotalRevenue;
let analyticsTotalSales;
let analyticsAvgSale;
let createSkinOverrideForm;
let refreshOverridesBtn;
let overridesListBody;
let createUpdateForm;
let updatesListBody;
let refreshUpdatesBtn;
let currentAdminContext = 'live';
let pendingSettingsPayload = null;

async function apiRequest(endpoint, method = 'GET', body = null) {
    let options;
    try {
        options = { method, headers: getAdminHeaders() };
    } catch (error) {
        console.error(`Erro ao obter headers: ${error.message}`);
        throw error;
    }
    
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    try {
        const response = await fetch(`${API_URL}${endpoint}`, options);
        let result;

        if (response.status === 204) { 
             return { message: 'Operação bem-sucedida (No Content)' };
        }
        
        try {
            result = await response.json();
        } catch (e) {
            result = { detail: `Erro ${response.status} ${response.statusText}` };
        }
        
        if (!response.ok) {
            if (result.detail && typeof result.detail === 'string' && 
               (result.detail.includes("Inválida") || result.detail.includes("Ausente") || result.detail.includes("Revogada"))) {
                 document.getElementById('admin-logout-btn')?.click();
            }

            let errorMsg = result.detail || `Erro ${response.status}`;
            if (typeof errorMsg === 'object') {
                errorMsg = JSON.stringify(errorMsg, null, 2);
            }
            
            throw new Error(errorMsg);
        }
        return result;
    } catch (error) {
        console.error(`Erro API ${method} ${endpoint}:`, error);
        
        if (!error.message.includes("Chave de API")) {
             alert(`Erro: ${error.message}`);
        }
        throw error;
    }
}

async function refreshRolesList() {
    if (!roleIdSelect) return;
    
    roleIdSelect.innerHTML = '<option value="">Carregando...</option>';
    try {
        const roles = await apiRequest('/admin/roles');
        roleIdSelect.innerHTML = '<option value="">-- Selecione um Cargo --</option>';
        roles.forEach(role => {
            const option = document.createElement('option');
            option.value = role.role_id;
            option.textContent = `${role.role_name} (ID: ${role.role_id})`;
            roleIdSelect.appendChild(option);
        });
    } catch (error) {
        roleIdSelect.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

function setupNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.modal').forEach(modal => {
                if (!modal.classList.contains('hidden')) {
                    modal.classList.add('hidden');
                }
            });
            const pageId = link.dataset.page;

            adminPages.forEach(page => page.classList.remove('active'));
            navLinks.forEach(nav => nav.classList.remove('active'));

            document.getElementById(`section-${pageId}`)?.classList.add('active');
            link.classList.add('active');
            
            if (pageId === 'items') {
                refreshItemList();
            } else if (pageId === 'users') {
                refreshUserList();
            } else if (pageId === 'codes') {
                refreshCodesList();
            } else if (pageId === 'vip') {
                refreshVipRewardsList();
            } else if (pageId === 'settings') {
                loadSystemSettings();
            } else if (pageId === 'orders') {
                refreshOrdersList();
            } else if (pageId === 'game-modes') {
                refreshGameModesList();
            } else if (pageId === 'crafting') {
                refreshIngredientsList();
                refreshJudgesList();
                refreshRecipesList();
                refreshPrepStepsList();
            } else if (pageId === 'battlepass') {
                refreshSeasonsList();
            } else if (pageId === 'levels') {
                refreshLevelsList();
            } else if (pageId === 'transactions') {
                refreshTransactionsList();
            } else if (pageId === 'servers') {
                refreshServersList();
            } else if (pageId === 'tickets') {
                refreshTicketsList();
            } else if (pageId === 'api_keys') {
                refreshApiKeysList();
            } else if (pageId === 'analytics') {
                refreshAnalytics();
            } else if (pageId === 'featured') {
                refreshFeaturedSlotsList();
            } else if (pageId === 'moderation') {
                refreshReportsList();
            } else if (pageId === 'daily_rewards') {
                refreshDailyRewardsList();
                loadSystemSettings();
            } else if (pageId === 'alerts') {
                refreshAlertsList();
            }
        });
    });
}

function openScheduleModalWithPayload(actionType, payload) {
    window.pendingPayload = payload; 
    window.pendingActionType = actionType; 
    
    const modal = document.getElementById('schedule-selector-modal');
    const select = document.getElementById('schedule-target-select');
    const btnConfirm = document.getElementById('btn-confirm-schedule');
    
    select.innerHTML = '<option>Carregando...</option>';
    modal.classList.remove('hidden');
    btnConfirm.disabled = true;
    
    apiRequest('/admin/updates').then(updates => {
        const pending = updates.filter(u => u.status === 'pending');
        select.innerHTML = '';
        if (pending.length === 0) {
            select.add(new Option("Nenhuma manutenção pendente.", ""));
        } else {
            pending.forEach(u => {
                const opt = document.createElement('option');
                opt.value = u.update_id;
                opt.text = `${u.title} (ID: ${u.update_id}) - Início: ${new Date(u.start_time).toLocaleString()}`;
                select.add(opt);
            });
            btnConfirm.disabled = false;
        }
    });
}

async function refreshUserList() {
    if (!userListBody) return;
    userListBody.innerHTML = '<tr><td colspan="9">Carregando...</td></tr>';
    try {
        const users = await apiRequest('/admin/users');
        userListBody.innerHTML = ''; 
        if (users.length === 0) { userListBody.innerHTML = '<tr><td colspan="9">Nenhum usuário.</td></tr>'; return; }
        
        if (typeof refreshRolesList === 'function') {
            refreshRolesList();
        }

        users.forEach(user => {
            const row = userListBody.insertRow();
            row.insertCell().textContent = user.id;
            row.insertCell().textContent = user.username;
            row.insertCell().textContent = user.email;
            row.insertCell().textContent = user.discord_id || '-';
            row.insertCell().textContent = user.in_game_currency;
            row.insertCell().textContent = user.premium_currency;
            row.insertCell().textContent = user.is_admin ? 'Sim' : 'Não';
            
            const roleCell = row.insertCell();
            roleCell.textContent = user.role_name ? `${user.role_name} (ID: ${user.role_id})` : '-';

            const actionsCell = row.insertCell();
            actionsCell.className = 'action-buttons';
            
            const viewBtn = document.createElement('button');
            viewBtn.className = 'admin-btn secondary-button view-details-btn';
            viewBtn.textContent = 'Ver Detalhes';
            viewBtn.dataset.id = user.id;
            viewBtn.dataset.name = user.username;
            viewBtn.addEventListener('click', (e) => {
                openUserDetailsModal(e.target.dataset.id, e.target.dataset.name);
            });
            actionsCell.appendChild(viewBtn);

            const editBtn = document.createElement('button');
            editBtn.className = 'admin-btn edit-user-btn';
            editBtn.textContent = 'Editar Email';
            editBtn.dataset.id = user.id;
            editBtn.dataset.email = user.email;
            editBtn.dataset.name = user.username;
            editBtn.addEventListener('click', (e) => {
                openEditUserModal(e.target.dataset.id, e.target.dataset.email, e.target.dataset.name);
            });
            actionsCell.appendChild(editBtn);

            const resetBtn = document.createElement('button');
            resetBtn.className = 'admin-btn secondary-button reset-pass-btn';
            resetBtn.textContent = 'Forçar Reset Senha';
            resetBtn.dataset.id = user.id;
            resetBtn.dataset.name = user.username;
            resetBtn.addEventListener('click', (e) => {
                forcePasswordReset(e.target.dataset.id, e.target.dataset.name);
            });
            actionsCell.appendChild(resetBtn);
        });
    } catch (error) { userListBody.innerHTML = `<tr><td colspan="8" style="color:red;">Erro ao carregar usuários.</td></tr>`; }
}

async function refreshItemList() {
     if (!itemListBody) return;
     itemListBody.innerHTML = '<tr><td colspan="9">Carregando...</td></tr>';
    try {
        const items = await apiRequest('/admin/list_all_items');
        itemListBody.innerHTML = ''; 
        if (items.length === 0) { itemListBody.innerHTML = '<tr><td colspan="9">Nenhum item.</td></tr>'; return; }
        
        items.forEach(item => {
            const row = itemListBody.insertRow();
            const priceN = item.price_normal !== null ? item.price_normal : '-';
            const priceP = item.price_premium !== null ? item.price_premium : '-';
            row.insertCell().textContent = item.item_id;
            row.insertCell().textContent = item.item_name;
            row.insertCell().textContent = item.asset_key || '-';
            row.insertCell().textContent = `${item.item_type} ${item.category ? `(${item.category})` : ''}`;
            row.insertCell().textContent = item.rarity || 'common';
            row.insertCell().textContent = priceN;
            row.insertCell().textContent = priceP;
            row.insertCell().textContent = item.is_purchasable ? 'Sim' : 'Não';
            const actionsCell = row.insertCell();
            actionsCell.className = 'action-buttons';
            const itemData = JSON.stringify(item);
            const editBtn = document.createElement('button');
            editBtn.className = 'admin-btn edit-item-btn';
            editBtn.textContent = 'Editar';
            editBtn.dataset.item = itemData;
            editBtn.addEventListener('click', (e) => {
                 try {
                      const itemData = JSON.parse(e.target.dataset.item); 
                      populateEditItemForm(itemData);
                 } catch (parseError) { console.error("Erro ao parsear dados do item para edição:", parseError);}
            });
            actionsCell.appendChild(editBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'admin-btn delete-btn delete-item-btn';
            deleteBtn.textContent = 'Deletar';
            deleteBtn.dataset.itemId = item.item_id;
            deleteBtn.dataset.itemName = item.item_name;
            deleteBtn.addEventListener('click', (e) => {
                 deleteItemById(e.target.dataset.itemId, e.target.dataset.itemName);
            });
            actionsCell.appendChild(deleteBtn);
        });
    } catch (error) { itemListBody.innerHTML = `<tr><td colspan="8" style="color:red;">Erro ao carregar itens.</td></tr>`; }
}

async function refreshAchievementsList() {
    if (!achievementsListBody) return;
    achievementsListBody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';
    try {
        const achievements = await apiRequest('/achievements');
        achievementsListBody.innerHTML = ''; 
        if (achievements.length === 0) { achievementsListBody.innerHTML = '<tr><td colspan="5">Nenhuma conquista definida.</td></tr>'; return; }
        
        achievements.forEach(ach => {
            const row = achievementsListBody.insertRow();
            let rewards = [];
            if (ach.reward_currency > 0) rewards.push(`${ach.reward_currency} Moedas`);
            if (ach.reward_premium_currency > 0) rewards.push(`${ach.reward_premium_currency} Cash`);
            if (ach.reward_item_id) rewards.push(`Item ID: ${ach.reward_item_id}`);
            row.insertCell().textContent = ach.achievement_id;
            row.insertCell().textContent = ach.achievement_name;
            row.insertCell().textContent = ach.description;
            row.insertCell().textContent = rewards.join(', ') || 'Nenhuma';
            const actionsCell = row.insertCell();
            actionsCell.className = 'action-buttons';
            const editBtn = document.createElement('button');
            editBtn.className = 'admin-btn edit-ach-btn';
            editBtn.textContent = 'Editar';
            editBtn.dataset.id = ach.achievement_id;
            editBtn.addEventListener('click', (e) => {
                populateAchForm(e.target.dataset.id);
            });
            actionsCell.appendChild(editBtn);
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'admin-btn delete-btn delete-ach-btn';
            deleteBtn.textContent = 'Deletar';
            deleteBtn.dataset.achId = ach.achievement_id;
            deleteBtn.dataset.achName = ach.achievement_name;
            deleteBtn.addEventListener('click', (e) => {
                deleteAchievementById(e.target.dataset.achId, e.target.dataset.achName);
            });
            actionsCell.appendChild(deleteBtn);
        });
    } catch (error) { achievementsListBody.innerHTML = `<tr><td colspan="5" style="color:red;">Erro ao carregar conquistas.</td></tr>`; }
}

async function handleAdminCloseTicket(e) {
    e.preventDefault();
    const ticketId = document.getElementById('reply-ticket-id').value;
    const button = e.target;

    if (!ticketId) {
        alert("Erro: ID do ticket não encontrado.");
        return;
    }

    if (!confirm(`Tem certeza que deseja fechar (marcar como concluído) o Ticket ID ${ticketId}?`)) {
        return;
    }

    button.disabled = true;
    button.textContent = "Fechando...";

    try {
        const result = await apiRequest(`/admin/web_tickets/${ticketId}/close`, 'POST');
        alert(result.message);
        webTicketModal.classList.add('hidden');
        refreshTicketsList();
    } catch (error) {
        alert(`Erro ao fechar ticket: ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = "Fechar Ticket (Concluído)";
    }
}

function populateEditItemForm(item) {
    if (!createItemForm) return;
    
    document.getElementById('edit-item-id').value = item.item_id;
    document.getElementById('item_name').value = item.item_name || '';
    document.getElementById('item_category').value = item.category || '';
    document.getElementById('item_type').value = item.item_type || 'normal';
    document.getElementById('item_gender_lock').value = item.gender_lock || 'any';
    document.getElementById('item_rarity').value = item.rarity || 'common';
    document.getElementById('item_price_normal').value = item.price_normal ?? '';
    document.getElementById('item_price_premium').value = item.price_premium ?? '';
    document.getElementById('item_is_purchasable').checked = item.is_purchasable ?? true;
    document.getElementById('item_desc').value = item.description || '';
    document.getElementById('item_image_url').value = item.image_url || '';
    document.getElementById('asset_key').value = item.asset_key || '';
    document.getElementById('item_stats').value = item.stats ? JSON.stringify(item.stats, null, 2) : '';
    
    document.getElementById('item_discount_percent').value = item.discount_percent || 0;
    if (item.discount_expires) {
        const date = new Date(item.discount_expires);
        date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
        document.getElementById('item_discount_expires').value = date.toISOString().slice(0, 16);
    } else {
        document.getElementById('item_discount_expires').value = '';
    }

    document.getElementById('item-form-title').textContent = `Editando Item ID: ${item.item_id}`; 
    cancelEditItemBtn?.classList.remove('hidden');
    
    if (item.category === 'pet') {
        document.getElementById('ability_item_id').value = item.item_id;
        abilityPetName.textContent = `${item.item_name} (ID: ${item.item_id})`;
        refreshAbilitiesList(item.item_id);
        
        const petTabBtn = document.querySelector('[onclick="openTab(event, \'tab-items-pets\')"]');
        if (petTabBtn) petTabBtn.click();
    } else {
        hideAbilitiesManager();
        const createTabBtn = document.querySelector('[onclick="openTab(event, \'tab-items-create\')"]');
        if (createTabBtn) createTabBtn.click();
    }

    const usageInfoEl = document.getElementById('item-usage-info');
    if (usageInfoEl) {
        usageInfoEl.classList.remove('hidden');
        document.getElementById('item-usage-created-by').textContent = 'Carregando...';
        document.getElementById('item-usage-used-in').textContent = 'Carregando...';
        loadItemUsageInfo(item.item_id);
    }
}

function cancelEditItem() {
    document.getElementById('edit-item-id').value = '';
    createItemForm?.reset();
    document.getElementById('item-form-title').textContent = "Criar Novo Item"; 
    cancelEditItemBtn?.classList.add('hidden');
    hideAbilitiesManager();
    document.getElementById('item-usage-info')?.classList.add('hidden');
}

async function loadItemUsageInfo(itemId) {
    const createdByEl = document.getElementById('item-usage-created-by');
    const usedInEl = document.getElementById('item-usage-used-in');

    try {
        const usage = await apiRequest(`/admin/item/${itemId}/usage`);

        if (usage.created_by.length === 0) {
            createdByEl.textContent = "Nenhuma receita cria este item.";
        } else {
            createdByEl.textContent = usage.created_by
                .map(r => `Receita ID ${r.recipe_id} (Cria "${r.output_item_name}")`)
                .join('\n');
        }

        if (usage.used_in.length === 0) {
            usedInEl.textContent = "Este item não é usado em nenhuma receita.";
        } else {
            usedInEl.textContent = usage.used_in
                .map(r => `Receita ID ${r.recipe_id} (Cria "${r.output_item_name}" - Qtd: ${r.quantity_required})`)
                .join('\n');
        }

    } catch (error) {
        createdByEl.textContent = `Erro ao carregar: ${error.message}`;
        usedInEl.textContent = `Erro ao carregar: ${error.message}`;
    }
}

async function deleteItemById(itemId, itemName) {
    if (!confirm(`Deletar item '${itemName}' (ID: ${itemId})? CUIDADO: Isso pode afetar inventários.`)) return;
    try { 
        await apiRequest(`/admin/delete_item/${itemId}`, 'DELETE'); 
        alert('Item deletado!'); 
        refreshItemList(); 
        cancelEditItem(); 
    } catch(error){}
}

async function deleteAchievementById(achId, achName) {
    if (!confirm(`Deletar conquista '${achName}' (ID: ${achId})? CUIDADO: Se jogadores já a desbloquearam, a deleção falhará.`)) return;
    try { 
        await apiRequest(`/admin/achievements/${achId}`, 'DELETE'); 
        alert('Conquista deletada!'); 
        refreshAchievementsList(); 
    } catch(error){}
}

async function populateAchForm(achievementId) {
    try {
        const ach = await apiRequest(`/admin/achievements/${achievementId}`);
        
        document.getElementById('edit-ach-id').value = ach.achievement_id;
        document.getElementById('ach_id').value = ach.achievement_id;
        document.getElementById('ach_id').readOnly = true;
        
        document.getElementById('ach_name').value = ach.achievement_name;
        document.getElementById('ach_desc').value = ach.description;
        document.getElementById('ach_icon_url').value = ach.icon_url || '';
        document.getElementById('ach_reward_item_id').value = ach.reward_item_id || '';
        document.getElementById('ach_reward_currency').value = ach.reward_currency || 0;
        document.getElementById('ach_reward_premium').value = ach.reward_premium_currency || 0;

        document.getElementById('ach-form-title').textContent = `Editando Conquista: ${ach.achievement_id}`;
        cancelEditAchBtn?.classList.remove('hidden');
        createAchievementForm?.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        alert("Erro ao carregar dados da conquista.");
    }
}

function cancelEditAch() {
    document.getElementById('edit-ach-id').value = '';
    createAchievementForm?.reset();
    document.getElementById('ach_id').readOnly = false;
    document.getElementById('ach-form-title').textContent = "Criar Nova Conquista";
    cancelEditAchBtn?.classList.add('hidden');
}

async function refreshIngredientsList() {
    if (!ingredientsListBody) return;
    ingredientsListBody.innerHTML = '<tr><td colspan="7">Carregando...</td></tr>';
    try {
        const ingredients = await apiRequest('/admin/ingredients');
        ingredientsListBody.innerHTML = ''; 
        if (ingredients.length === 0) { ingredientsListBody.innerHTML = '<tr><td colspan="7">Nenhum ingrediente definido.</td></tr>'; return; }
        
        ingredients.forEach(ing => {
            const row = ingredientsListBody.insertRow();
            row.insertCell().textContent = ing.ingredient_id;
            row.insertCell().textContent = ing.name;
            row.insertCell().textContent = ing.item_id_link;
            row.insertCell().textContent = ing.is_toxic_raw ? 'Sim' : 'Não';
            row.insertCell().textContent = `${ing.cook_time_min}s`;
            row.insertCell().textContent = `${ing.cook_time_max}s`;
            const actionsCell = row.insertCell();
            actionsCell.className = 'action-buttons';
            const editBtn = document.createElement('button');
            editBtn.className = 'admin-btn edit-ingredient-btn';
            editBtn.textContent = 'Editar';
            editBtn.dataset.id = ing.ingredient_id;
            editBtn.addEventListener('click', (e) => {
                populateIngredientForm(e.target.dataset.id);
            });
            actionsCell.appendChild(editBtn);
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'admin-btn delete-btn delete-ingredient-btn';
            deleteBtn.textContent = 'Deletar';
            deleteBtn.dataset.id = ing.ingredient_id;
            deleteBtn.dataset.name = ing.name;
            deleteBtn.addEventListener('click', (e) => {
                deleteIngredientById(e.target.dataset.id, e.target.dataset.name);
            });
            actionsCell.appendChild(deleteBtn);
        });
    } catch (error) { ingredientsListBody.innerHTML = `<tr><td colspan="7" style="color:red;">Erro ao carregar ingredientes.</td></tr>`; }
}

async function deleteIngredientById(id, name) {
    if (!confirm(`Deletar ingrediente '${name}' (ID: ${id})? Falhará se estiver em uso por uma receita.`)) return;
    try { 
        await apiRequest(`/admin/ingredients/${id}`, 'DELETE'); 
        alert('Ingrediente deletado!'); 
        refreshIngredientsList(); 
    } catch(error){}
}

async function populateIngredientForm(ingredientId) {
    try {
        const ing = await apiRequest(`/admin/ingredient/${ingredientId}`);
        
        document.getElementById('edit-ingredient-id').value = ing.ingredient_id;
        document.getElementById('ing_item_id_link').value = ing.item_id_link;
        document.getElementById('ing_name').value = ing.name;
        document.getElementById('ing_is_toxic_raw').checked = ing.is_toxic_raw;
        document.getElementById('ing_needs_cooking').checked = ing.needs_cooking;
        document.getElementById('ing_cook_time_min').value = ing.cook_time_min || 0;
        document.getElementById('ing_cook_time_max').value = ing.cook_time_max || 0;
        document.getElementById('ing_tags').value = (ing.tags && Array.isArray(ing.tags)) ? ing.tags.join(', ') : '';
        document.getElementById('ing_is_liquid').checked = ing.is_liquid;
        document.getElementById('ing_attr_alcohol').value = ing.attr_alcohol;
        
        document.getElementById('ing_attr_salty').value = ing.attr_salty;
        document.getElementById('ing_attr_sweet').value = ing.attr_sweet;
        document.getElementById('ing_attr_sour').value = ing.attr_sour;
        document.getElementById('ing_attr_bitter').value = ing.attr_bitter;
        document.getElementById('ing_attr_umami').value = ing.attr_umami;
        document.getElementById('ing_attr_texture').value = ing.attr_texture;
        document.getElementById('ing_attr_aroma').value = ing.attr_aroma;
        document.getElementById('ing_toxicity_on_fail').value = ing.toxicity_on_fail;

        document.getElementById('ingredient-form-title').textContent = `Editando Ingrediente: ${ing.name}`;
        cancelEditIngredientBtn?.classList.remove('hidden');
        createIngredientForm?.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        alert("Erro ao carregar dados do ingrediente.");
    }
}

function cancelEditIngredient() {
    document.getElementById('edit-ingredient-id').value = '';
    createIngredientForm?.reset();
    document.getElementById('ingredient-form-title').textContent = "Criar Novo Ingrediente";
    cancelEditIngredientBtn?.classList.add('hidden');
}

async function refreshReportsList() {
    if (!moderationListBody || !reportStatusFilter) return;
    const status = reportStatusFilter.value;
    moderationListBody.innerHTML = '<tr><td colspan="8">Carregando...</td></tr>';

    try {
        const reports = await apiRequest(`/admin/player_reports?status=${status}`);
        moderationListBody.innerHTML = '';
        if (reports.length === 0) {
            moderationListBody.innerHTML = `<tr><td colspan="8">Nenhuma denúncia com status '${status}'.</td></tr>`;
            return;
        }

        reports.forEach(r => {
            const row = moderationListBody.insertRow();
            row.insertCell().textContent = r.report_id;
            row.insertCell().textContent = new Date(r.created_at).toLocaleString('pt-BR');
            row.insertCell().textContent = r.reporter_username || `ID: ${r.reporter_user_id}`;
            row.insertCell().textContent = r.reported_username || `ID: ${r.reported_user_id}`;
            row.insertCell().textContent = r.reason_code;
            row.insertCell().textContent = r.custom_note || '-';
            row.insertCell().textContent = r.match_id || '-';

            const actionsCell = row.insertCell();
            actionsCell.className = 'action-buttons';

            const viewBtn = document.createElement('button');
            viewBtn.className = 'admin-btn view-reported-btn';
            viewBtn.textContent = 'Ver Denunciado';
            viewBtn.dataset.id = r.reported_user_id;
            viewBtn.dataset.name = r.reported_username || 'ID: ' + r.reported_user_id;
            viewBtn.addEventListener('click', (e) => {
                openUserDetailsModal(e.target.dataset.id, e.target.dataset.name);
            });
            actionsCell.appendChild(viewBtn);

            if (status === 'pending') {
                const resolveBtn = document.createElement('button');
                resolveBtn.className = 'admin-btn secondary-button resolve-report-btn';
                resolveBtn.textContent = 'Marcar Resolvido';
                resolveBtn.dataset.id = r.report_id;
                resolveBtn.dataset.status = 'resolved';
                
                const ignoreBtn = document.createElement('button');
                ignoreBtn.className = 'admin-btn delete-btn resolve-report-btn';
                ignoreBtn.textContent = 'Ignorar';
                ignoreBtn.dataset.id = r.report_id;
                ignoreBtn.dataset.status = 'ignored';
                
                actionsCell.appendChild(resolveBtn);
                actionsCell.appendChild(ignoreBtn);
                
                actionsCell.querySelectorAll('.resolve-report-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const reportId = e.target.dataset.id;
                        const newStatus = e.target.dataset.status;
                        if (!confirm(`Marcar denúncia ${reportId} como '${newStatus}'?`)) return;
                        try {
                            await apiRequest(`/admin/player_reports/${reportId}/resolve?new_status=${newStatus}`, 'POST');
                            alert("Status da denúncia atualizado.");
                            refreshReportsList();
                        } catch(err) {}
                    });
                });
            } else {
                const resolverSpan = document.createElement('span');
                resolverSpan.textContent = `Por: ${r.resolver_username || 'N/A'}`; 
                actionsCell.appendChild(resolverSpan);
            }
        });

    } catch (error) {
        moderationListBody.innerHTML = `<tr><td colspan="8" style="color:red;">Erro ao carregar denúncias.</td></tr>`;
    }
}

async function refreshDailyRewardsList() {
    if (!dailyRewardsListBody) return;
    dailyRewardsListBody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';
    try {
        const rewards = await apiRequest('/admin/daily_rewards');
        dailyRewardsListBody.innerHTML = '';
        if (rewards.length === 0) {
            dailyRewardsListBody.innerHTML = '<tr><td colspan="5">Nenhuma recompensa diária configurada.</td></tr>';
            return;
        }

        rewards.forEach(r => {
            const row = dailyRewardsListBody.insertRow();
            let item = r.item_name ? `${r.item_name} (ID: ${r.reward_item_id})` : '-';
            row.insertCell().textContent = r.day_number;
            row.insertCell().textContent = r.reward_currency_normal;
            row.insertCell().textContent = r.reward_currency_premium;
            row.insertCell().textContent = item;
            const actionsCell = row.insertCell();
            actionsCell.className = 'action-buttons';
            const editBtn = document.createElement('button');
            editBtn.className = 'admin-btn edit-daily-reward-btn';
            editBtn.textContent = 'Editar';
            editBtn.dataset.reward = JSON.stringify(r); 
            editBtn.addEventListener('click', (e) => {
                const data = JSON.parse(e.target.dataset.reward);
                document.getElementById('reward_day_number').value = data.day_number;
                document.getElementById('reward_currency_normal').value = data.reward_currency_normal || 0;
                document.getElementById('reward_currency_premium').value = data.reward_currency_premium || 0;
                document.getElementById('reward_item_id').value = data.reward_item_id || '';
                createDailyRewardForm.scrollIntoView({ behavior: 'smooth' });
            });
            actionsCell.appendChild(editBtn);
        });

    } catch (error) {
        dailyRewardsListBody.innerHTML = '<tr><td colspan="5" style="color:red;">Erro ao carregar recompensas.</td></tr>';
    }
}

async function refreshJudgesList() {
    if (!judgesListBody) return;
    judgesListBody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';
    try {
        const judges = await apiRequest('/admin/judges');
        judgesListBody.innerHTML = ''; 
        if (judges.length === 0) { judgesListBody.innerHTML = '<tr><td colspan="5">Nenhum juiz definido.</td></tr>'; return; }
        
        judges.forEach(judge => {
            const row = judgesListBody.insertRow();
            row.insertCell().textContent = judge.judge_id;
            row.insertCell().textContent = judge.name;
            row.insertCell().textContent = judge.pref_attr_1;
            row.insertCell().textContent = judge.pref_attr_2;
            const actionsCell = row.insertCell();
            actionsCell.className = 'action-buttons';
            const editBtn = document.createElement('button');
            editBtn.className = 'admin-btn edit-judge-btn';
            editBtn.textContent = 'Editar';
            editBtn.dataset.id = judge.judge_id;
            editBtn.addEventListener('click', (e) => {
                populateJudgeForm(e.target.dataset.id);
            });
            actionsCell.appendChild(editBtn);
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'admin-btn delete-btn delete-judge-btn';
            deleteBtn.textContent = 'Deletar';
            deleteBtn.dataset.id = judge.judge_id;
            deleteBtn.dataset.name = judge.name;
            deleteBtn.addEventListener('click', (e) => {
                deleteJudgeById(e.target.dataset.id, e.target.dataset.name);
            });
            actionsCell.appendChild(deleteBtn);
        });
    } catch (error) { judgesListBody.innerHTML = `<tr><td colspan="5" style="color:red;">Erro ao carregar juízes.</td></tr>`; }
}

async function deleteJudgeById(id, name) {
    if (!confirm(`Deletar juiz '${name}' (ID: ${id})?`)) return;
    try { 
        await apiRequest(`/admin/judges/${id}`, 'DELETE'); 
        alert('Juiz deletado!'); 
        refreshJudgesList(); 
    } catch(error){}
}

async function populateJudgeForm(judgeId) {
    try {
        const judge = await apiRequest(`/admin/judge/${judgeId}`);
        
        document.getElementById('edit-judge-id').value = judge.judge_id;
        document.getElementById('judge_name').value = judge.name;
        document.getElementById('judge_pref_1').value = judge.pref_attr_1;
        document.getElementById('judge_pref_2').value = judge.pref_attr_2;

        document.getElementById('judge-form-title').textContent = `Editando Juiz: ${judge.name}`;
        cancelEditJudgeBtn?.classList.remove('hidden');
        createJudgeForm?.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        alert("Erro ao carregar dados do juiz.");
    }
}

function cancelEditJudge() {
    document.getElementById('edit-judge-id').value = '';
    createJudgeForm?.reset();
    document.getElementById('judge-form-title').textContent = "Criar Novo Juiz";
    cancelEditJudgeBtn?.classList.add('hidden');
}

async function refreshRecipesList() {
    if (!recipesListBody) return;
    recipesListBody.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';
    try {
        const recipes = await apiRequest('/admin/recipes');
        recipesListBody.innerHTML = ''; 
        if (recipes.length === 0) { recipesListBody.innerHTML = '<tr><td colspan="4">Nenhuma receita definida.</td></tr>'; return; }
        
        recipes.forEach(recipe => {
            const row = recipesListBody.insertRow();
            row.insertCell().textContent = recipe.recipe_id;
            row.insertCell().textContent = recipe.output_item_name;
            row.insertCell().textContent = recipe.ingredients_list;
            const actionsCell = row.insertCell();
            actionsCell.className = 'action-buttons';
            const editBtn = document.createElement('button');
            editBtn.className = 'admin-btn edit-recipe-btn';
            editBtn.textContent = 'Editar';
            editBtn.dataset.id = recipe.recipe_id;
            editBtn.addEventListener('click', (e) => {
                populateRecipeForm(e.target.dataset.id);
            });
            actionsCell.appendChild(editBtn);
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'admin-btn delete-btn delete-recipe-btn';
            deleteBtn.textContent = 'Deletar';
            deleteBtn.dataset.id = recipe.recipe_id;
            deleteBtn.dataset.name = recipe.output_item_name;
            deleteBtn.addEventListener('click', (e) => {
                deleteRecipeById(e.target.dataset.id, e.target.dataset.name);
            });
            actionsCell.appendChild(deleteBtn);
        });
    } catch (error) { recipesListBody.innerHTML = `<tr><td colspan="4" style="color:red;">Erro ao carregar receitas.</td></tr>`; }
}

async function deleteRecipeById(id, name) {
    if (!confirm(`Deletar receita '${name}' (ID: ${id})?`)) return;
    try { 
        await apiRequest(`/admin/recipes/${id}`, 'DELETE'); 
        alert('Receita deletada!'); 
        refreshRecipesList(); 
    } catch(error){}
}

async function populateRecipeForm(recipeId) {
    try {
        const recipe = await apiRequest(`/admin/recipe/${recipeId}`);
        
        document.getElementById('edit-recipe-id').value = recipe.recipe_id;
        document.getElementById('recipe_output_id').value = recipe.output_item_id;
        document.getElementById('recipe_output_qty').value = recipe.output_item_quantity;
        document.getElementById('recipe_ingredients').value = 
            JSON.stringify(recipe.ingredients, null, 2);

        document.getElementById('recipe-form-title').textContent = `Editando Receita ID: ${recipe.recipe_id}`;
        cancelEditRecipeBtn?.classList.remove('hidden');
        createRecipeForm?.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        alert("Erro ao carregar dados da receita.");
    }
}

function cancelEditRecipe() {
    document.getElementById('edit-recipe-id').value = '';
    createRecipeForm?.reset();
    document.getElementById('recipe-form-title').textContent = "Criar Nova Receita";
    cancelEditRecipeBtn?.classList.add('hidden');
}

async function refreshPrepStepsList() {
    if (!prepStepsListBody) return;
    prepStepsListBody.innerHTML = '<tr><td colspan="7">Carregando...</td></tr>';
    try {
        const steps = await apiRequest('/admin/prep_steps');
        prepStepsListBody.innerHTML = ''; 
        if (steps.length === 0) { prepStepsListBody.innerHTML = '<tr><td colspan="7">Nenhuma etapa de preparação definida.</td></tr>'; return; }
        
        steps.forEach(step => {
            const row = prepStepsListBody.insertRow();
            row.insertCell().textContent = step.prep_step_id;
            row.insertCell().textContent = step.input_item_name;
            row.insertCell().textContent = step.prep_type;
            row.insertCell().textContent = step.output_item_name;
            row.insertCell().textContent = step.required_tool_category || '-';
            row.insertCell().textContent = `${step.duration_seconds}s`;
            const actionsCell = row.insertCell();
            actionsCell.className = 'action-buttons';
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'admin-btn delete-btn delete-prep-step-btn';
            deleteBtn.textContent = 'Deletar';
            deleteBtn.dataset.id = step.prep_step_id;
            deleteBtn.dataset.name = step.input_item_name;
            deleteBtn.addEventListener('click', (e) => {
                deletePrepStepById(e.target.dataset.id, e.target.dataset.name);
            });
            actionsCell.appendChild(deleteBtn);
        });
    } catch (error) { prepStepsListBody.innerHTML = `<tr><td colspan="6" style="color:red;">Erro ao carregar etapas.</td></tr>`; }
}

async function deletePrepStepById(id, name) {
    if (!confirm(`Deletar etapa de preparação para '${name}' (ID: ${id})?`)) return;
    try { 
        await apiRequest(`/admin/prep_step/${id}`, 'DELETE'); 
        alert('Etapa deletada!'); 
        refreshPrepStepsList(); 
    } catch(error){}
}

async function refreshOrdersList() {
    if (!ordersListBody) return;
    ordersListBody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';
    try {
        const orders = await apiRequest('/admin/orders');
        ordersListBody.innerHTML = ''; 
        if (orders.length === 0) { ordersListBody.innerHTML = '<tr><td colspan="5">Nenhuma definição de pedido encontrada.</td></tr>'; return; }
        
        orders.forEach(order => {
            const row = ordersListBody.insertRow();
            const gameModesStr = (order.game_modes && order.game_modes.length > 0) ? order.game_modes.join(', ') : '-';
            row.insertCell().textContent = order.order_id;
            row.insertCell().textContent = order.order_name;
            row.insertCell().textContent = gameModesStr;
            row.insertCell().textContent = JSON.stringify(order.requirements);
            const actionsCell = row.insertCell();
            actionsCell.className = 'action-buttons';
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'admin-btn delete-btn delete-order-btn';
            deleteBtn.textContent = 'Deletar';
            deleteBtn.dataset.id = order.order_id;
            deleteBtn.dataset.name = order.order_name;
            deleteBtn.addEventListener('click', (e) => {
                deleteOrderById(e.target.dataset.id, e.target.dataset.name);
            });
            actionsCell.appendChild(deleteBtn);
        });
    } catch (error) { ordersListBody.innerHTML = `<tr><td colspan="5" style="color:red;">Erro ao carregar pedidos.</td></tr>`; } 
}

async function deleteOrderById(id, name) {
    if (!confirm(`Deletar o pedido '${name}' (ID: ${id})?`)) return;
    try { 
        await apiRequest(`/admin/orders/${id}`, 'DELETE'); 
        alert('Pedido deletado!'); 
        refreshOrdersList(); 
    } catch(error){}
}

async function refreshGameModesList() {
    if (!gameModesListBody) return;
    gameModesListBody.innerHTML = '<tr><td colspan="7">Carregando...</td></tr>'; 
    try {
        const modes = await apiRequest('/admin/game_modes');
        gameModesListBody.innerHTML = ''; 
        if (modes.length === 0) { gameModesListBody.innerHTML = '<tr><td colspan="7">Nenhum modo de jogo definido.</td></tr>'; return; }
        
        modes.forEach(mode => {
            const row = gameModesListBody.insertRow();
            const isTeam = mode.is_team_mode ? `Sim (${mode.team_size}p)` : 'Não';
            row.insertCell().textContent = mode.mode_key;
            row.insertCell().textContent = mode.display_name;
            row.insertCell().textContent = mode.mode_type;
            row.insertCell().textContent = `${mode.match_duration_seconds}s`;
            row.insertCell().textContent = mode.max_players;
            row.insertCell().textContent = isTeam;
            const actionsCell = row.insertCell();
            actionsCell.className = 'action-buttons';
            const modeData = JSON.stringify(mode);
            const editBtn = document.createElement('button');
            editBtn.className = 'admin-btn edit-game-mode-btn';
            editBtn.textContent = 'Editar';
            editBtn.dataset.mode = modeData;
            editBtn.addEventListener('click', (e) => {
                populateGameModeForm(JSON.parse(e.target.dataset.mode));
            });
            actionsCell.appendChild(editBtn);
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'admin-btn delete-btn delete-game-mode-btn';
            deleteBtn.textContent = 'Deletar';
            deleteBtn.dataset.key = mode.mode_key;
            deleteBtn.dataset.name = mode.display_name;
            deleteBtn.addEventListener('click', (e) => {
                deleteGameModeByKey(e.target.dataset.key, e.target.dataset.name);
            });
            actionsCell.appendChild(deleteBtn);
        });
    } catch (error) { 
        gameModesListBody.innerHTML = `<tr><td colspan="7" style="color:red;">Erro ao carregar modos de jogo.</td></tr>`; 
    }
}

function populateGameModeForm(mode) {
    document.getElementById('gm_mode_key').value = mode.mode_key;
    document.getElementById('gm_mode_key').readOnly = true; 
    
    document.getElementById('gm_display_name').value = mode.display_name;
    document.getElementById('gm_description').value = mode.description || '';
    document.getElementById('gm_mode_type').value = mode.mode_type || 'casual';
    document.getElementById('gm_duration').value = mode.match_duration_seconds;
    document.getElementById('gm_max_players').value = mode.max_players;
    document.getElementById('gm_is_team_mode').checked = mode.is_team_mode;
    document.getElementById('gm_team_size').value = mode.team_size;

    document.getElementById('game-mode-form-title').textContent = `Editando Modo: ${mode.display_name}`;
    cancelEditGameModeBtn?.classList.remove('hidden');
    createGameModeForm?.scrollIntoView({ behavior: 'smooth' });
}

function cancelEditGameMode() {
    document.getElementById('gm_mode_key').readOnly = false;
    createGameModeForm?.reset();
    document.getElementById('game-mode-form-title').textContent = "Criar/Editar Modo de Jogo";
    cancelEditGameModeBtn?.classList.add('hidden');
}

async function deleteGameModeByKey(modeKey, modeName) {
    if (!confirm(`Deletar o modo de jogo '${modeName}' (Chave: ${modeKey})?`)) return;
    try { 
        await apiRequest(`/admin/game_modes/${modeKey}`, 'DELETE'); 
        alert('Modo de Jogo deletado!'); 
        refreshGameModesList(); 
        cancelEditGameMode();
    } catch(error){}
}

const arrayToCsv = (arr) => (arr && Array.isArray(arr) ? arr.join(', ') : '');
const csvToNumArray = (str) => (str ? str.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)) : null);
const csvToStrArray = (str) => (str ? str.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0) : null);

async function refreshLevelsList() {
    if (!levelsListBody) return;
    levelsListBody.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';
    try {
        const levels = await apiRequest('/admin/levels');
        levelsListBody.innerHTML = ''; 
        if (levels.length === 0) { levelsListBody.innerHTML = '<tr><td colspan="4">Nenhum nível/prova definido.</td></tr>'; return; }
        
        levels.forEach(level => {
            const row = levelsListBody.insertRow();
            row.insertCell().textContent = level.level_key;
            row.insertCell().textContent = level.display_name;
            row.insertCell().textContent = arrayToCsv(level.allowed_game_modes) || '-';
            const actionsCell = row.insertCell();
            actionsCell.className = 'action-buttons';
            const levelData = JSON.stringify(level);
            const editBtn = document.createElement('button');
            editBtn.className = 'admin-btn edit-level-btn';
            editBtn.textContent = 'Editar';
            editBtn.dataset.level = levelData;
            editBtn.addEventListener('click', (e) => {
                populateLevelForm(JSON.parse(e.target.dataset.level));
            });
            actionsCell.appendChild(editBtn);
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'admin-btn delete-btn delete-level-btn';
            deleteBtn.textContent = 'Deletar';
            deleteBtn.dataset.key = level.level_key;
            deleteBtn.dataset.name = level.display_name;
            deleteBtn.addEventListener('click', (e) => {
                deleteLevelByKey(e.target.dataset.key, e.target.dataset.name);
            });
            actionsCell.appendChild(deleteBtn);
        });
    } catch (error) { levelsListBody.innerHTML = `<tr><td colspan="4" style="color:red;">Erro ao carregar níveis.</td></tr>`; }
}

function populateLevelForm(level) {
    document.getElementById('level_key').value = level.level_key;
    document.getElementById('level_key').readOnly = true;
    
    document.getElementById('level_display_name').value = level.display_name;
    document.getElementById('level_game_modes').value = arrayToCsv(level.allowed_game_modes);
    document.getElementById('level_market_ids').value = arrayToCsv(level.market_ingredient_ids);
    document.getElementById('level_required_tags').value = arrayToCsv(level.required_tags);
    document.getElementById('level_judge_pool').value = arrayToCsv(level.judge_pool_ids);

    document.getElementById('level-form-title').textContent = `Editando Nível: ${level.display_name}`;
    cancelEditLevelBtn?.classList.remove('hidden');
    createLevelForm?.scrollIntoView({ behavior: 'smooth' });
}

function cancelEditLevel() {
    document.getElementById('level_key').readOnly = false;
    createLevelForm?.reset();
    document.getElementById('level-form-title').textContent = "Criar/Editar Nível";
    cancelEditLevelBtn?.classList.add('hidden');
}

async function deleteLevelByKey(levelKey, levelName) {
    if (!confirm(`Deletar o nível '${levelName}' (Chave: ${levelKey})?`)) return;
    try { 
        await apiRequest(`/admin/levels/${levelKey}`, 'DELETE'); 
        alert('Nível deletado!'); 
        refreshLevelsList(); 
        cancelEditLevel();
    } catch(error){}
}

function openEditUserModal(userId, currentEmail, username) {
    if (!editUserModal) {
        console.error("Variável editUserModal é nula. O script carregou antes do DOM?");
        return;
    }
    document.getElementById('edit-user-id').value = userId;
    document.getElementById('edit-user-email').value = currentEmail;
    document.getElementById('edit-user-title').textContent = `Editar Usuário: ${username} (ID: ${userId})`;
    editUserModal.classList.remove('hidden');
}

function closeEditUserModal() {
    if (!editUserModal) return;
    editUserForm?.reset();
    editUserModal.classList.add('hidden');
}

async function forcePasswordReset(userId, username) {
    if (!confirm(`Tem certeza que deseja enviar um email de redefinição de senha para '${username}'?`)) {
        return;
    }
    try {
        const result = await apiRequest(`/admin/user/${userId}/force_reset`, 'POST');
        alert(result.message);
    } catch (error) {
    }
}

async function refreshAbilitiesList(itemId) {
    if (!abilitiesListBody || !petAbilitiesManager) return;
    
    petAbilitiesManager.classList.remove('hidden');
    abilitiesListBody.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';
    
    try {
        const abilities = await apiRequest(`/admin/abilities/${itemId}`);
        abilitiesListBody.innerHTML = ''; 
        if (abilities.length === 0) { abilitiesListBody.innerHTML = '<tr><td colspan="6">Nenhuma habilidade definida para este pet.</td></tr>'; return; }
        
        abilities.forEach(abi => {
            const row = abilitiesListBody.insertRow();
            row.insertCell().textContent = abi.ability_id;
            row.insertCell().textContent = abi.ability_name;
            row.insertCell().textContent = abi.mode;
            row.insertCell().textContent = abi.logic_key;
            row.insertCell().textContent = `${abi.cooldown_seconds}s`;
            const actionsCell = row.insertCell();
            actionsCell.className = 'action-buttons';
            const editBtn = document.createElement('button');
            editBtn.className = 'admin-btn edit-ability-btn';
            editBtn.textContent = 'Editar';
            editBtn.dataset.id = abi.ability_id;
            editBtn.addEventListener('click', (e) => {
                populateAbilityForm(e.target.dataset.id);
            });
            actionsCell.appendChild(editBtn);
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'admin-btn delete-btn delete-ability-btn';
            deleteBtn.textContent = 'Deletar';
            deleteBtn.dataset.id = abi.ability_id;
            deleteBtn.dataset.name = abi.ability_name;
            deleteBtn.addEventListener('click', (e) => {
                deleteAbilityById(e.target.dataset.id, e.target.dataset.name, itemId);
            });
            actionsCell.appendChild(deleteBtn);
        });
    } catch (error) { abilitiesListBody.innerHTML = `<tr><td colspan="6" style="color:red;">Erro ao carregar habilidades.</td></tr>`; }
}

async function deleteAbilityById(abilityId, abilityName, itemIdToRefresh) {
    if (!confirm(`Deletar habilidade '${abilityName}' (ID: ${abilityId})?`)) return;
    try { 
        await apiRequest(`/admin/abilities/${abilityId}`, 'DELETE'); 
        alert('Habilidade deletada!'); 
        refreshAbilitiesList(itemIdToRefresh);
    } catch(error){}
}

async function populateAbilityForm(abilityId) {
    try {
        const abi = await apiRequest(`/admin/ability/${abilityId}`);
        
        document.getElementById('edit-ability-id').value = abi.ability_id;
        
        document.getElementById('ability_name').value = abi.ability_name;
        document.getElementById('ability_mode').value = abi.mode;
        document.getElementById('ability_logic_key').value = abi.logic_key;
        document.getElementById('ability_description').value = abi.description || '';
        document.getElementById('ability_cooldown').value = abi.cooldown_seconds || 0;
        document.getElementById('ability_dmg').value = abi.damage || 0;
        document.getElementById('ability_stun').value = abi.stun_duration_seconds || 0;
        document.getElementById('ability_carry_s').value = abi.carry_capacity_small || 0;
        document.getElementById('ability_carry_l').value = abi.carry_capacity_large || 0;

        document.getElementById('ability-form-title').textContent = `Editando Habilidade: ${abi.ability_name}`;
        cancelEditAbilityBtn?.classList.remove('hidden');
        createAbilityForm?.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        alert("Erro ao carregar dados da habilidade.");
    }
}

function cancelEditAbility() {
    document.getElementById('edit-ability-id').value = '';
    document.getElementById('ability_name').value = '';
    document.getElementById('ability_mode').value = 'casual';
    document.getElementById('ability_logic_key').value = '';
    document.getElementById('ability_description').value = '';
    document.getElementById('ability_cooldown').value = 0;
    document.getElementById('ability_dmg').value = 0;
    document.getElementById('ability_stun').value = 0;
    document.getElementById('ability_carry_s').value = 0;
    document.getElementById('ability_carry_l').value = 0;

    document.getElementById('ability-form-title').textContent = "Adicionar Nova Habilidade";
    cancelEditAbilityBtn?.classList.add('hidden');
}

function hideAbilitiesManager() {
    petAbilitiesManager?.classList.add('hidden');
    abilityPetName.textContent = '';
    if (typeof cancelEditAbility === 'function') {
        cancelEditAbility();
    } else {
        createAbilityForm?.reset();
    }
    document.getElementById('ability_item_id').value = '';
}

let currentSelectedSeasonId = null;

async function toggleSeasonActive(seasonId) {
    if (!confirm(`Ativar/Desativar temporada ID ${seasonId}? (Isso pode desativar outra temporada ativa)`)) return;
    try {
        const r = await apiRequest(`/admin/battlepass/season/${seasonId}/toggle_active`, 'POST');
        alert(r.message);
        refreshSeasonsList();
    } catch (error) {}
}

async function refreshSeasonsList() {
    if (!seasonsListBody || !bpSeasonSelect) return;
    seasonsListBody.innerHTML = '<tr><td colspan="8">Carregando...</td></tr>';
    bpSeasonSelect.innerHTML = '<option value="">Carregando...</option>';
    try {
        const seasons = await apiRequest('/admin/battlepass/seasons');
        seasonsListBody.innerHTML = ''; 
        bpSeasonSelect.innerHTML = '<option value="">-- Selecione uma Temporada --</option>';

        if (seasons.length === 0) {
            seasonsListBody.innerHTML = '<tr><td colspan="8">Nenhuma temporada criada.</td></tr>';
            bpSeasonSelect.innerHTML = '<option value="">Crie uma temporada primeiro</option>';
            return;
        }

        let activeSeasonId = null;
        seasons.forEach(season => {
            const row = seasonsListBody.insertRow();
            row.insertCell().textContent = season.season_id;
            row.insertCell().textContent = season.season_name;
            row.insertCell().textContent = new Date(season.start_date).toLocaleString('pt-BR');
            row.insertCell().textContent = new Date(season.end_date).toLocaleString('pt-BR');
            row.insertCell().innerHTML = season.is_active ? '<span style="color:var(--success-color)">Sim</span>' : 'Não';
            row.insertCell().textContent = season.premium_pass_item_id || '-';
            row.insertCell().textContent = season.master_pass_item_id || '-';
            const actionsCell = row.insertCell();
            actionsCell.className = 'action-buttons';
            const editBtn = document.createElement('button');
            editBtn.className = 'admin-btn edit-season-btn';
            editBtn.textContent = 'Editar';
            editBtn.dataset.id = season.season_id;
            editBtn.addEventListener('click', (e) => populateSeasonForm(e.target.dataset.id));
            actionsCell.appendChild(editBtn);
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'admin-btn toggle-season-btn';
            toggleBtn.textContent = season.is_active ? 'Desativar' : 'Ativar';
            toggleBtn.dataset.id = season.season_id;
            toggleBtn.addEventListener('click', (e) => toggleSeasonActive(e.target.dataset.id));
            actionsCell.appendChild(toggleBtn);
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'admin-btn delete-btn delete-season-btn';
            deleteBtn.textContent = 'Deletar';
            deleteBtn.dataset.id = season.season_id;
            deleteBtn.dataset.name = season.season_name;
            deleteBtn.addEventListener('click', (e) => deleteSeason(e.target.dataset.id, e.target.dataset.name));
            actionsCell.appendChild(deleteBtn);
            const option = document.createElement('option');
            option.value = season.season_id;
            option.textContent = `${season.season_name} (ID: ${season.season_id})`;
            if (season.is_active) {
                option.textContent += " [ATIVA]";
                activeSeasonId = season.season_id;
            }
            bpSeasonSelect.appendChild(option);
        });

        if (activeSeasonId) {
            bpSeasonSelect.value = activeSeasonId;
            loadSeasonData(activeSeasonId);
        }

    } catch (error) { 
        seasonsListBody.innerHTML = `<tr><td colspan="8" style="color:red;">Erro ao carregar temporadas.</td></tr>`;
        bpSeasonSelect.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

function loadSeasonData(seasonId) {
    currentSelectedSeasonId = parseInt(seasonId);
    const rewardManager = document.getElementById('bp-reward-manager');
    const questManager = document.getElementById('bp-quest-manager');
    if (typeof cancelEditSeason === 'function') cancelEditSeason();
    if (typeof cancelEditReward === 'function') cancelEditReward();
    if (typeof cancelEditQuest === 'function') cancelEditQuest();

    if (!currentSelectedSeasonId) {
        rewardManager?.classList.add('hidden');
        questManager?.classList.add('hidden');
        return;
    }

    rewardManager?.classList.remove('hidden');
    questManager?.classList.remove('hidden');

    refreshRewardsList(currentSelectedSeasonId);
    refreshQuestsList(currentSelectedSeasonId);
}

async function refreshRewardsList(seasonId) {
    if (!rewardsListBody) return;
    rewardsListBody.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';
    try {
        const rewards = await apiRequest(`/admin/battlepass/rewards/${seasonId}`);
        rewardsListBody.innerHTML = '';
        if (rewards.length === 0) { 
            rewardsListBody.innerHTML = '<tr><td colspan="4">Nenhuma recompensa definida para esta temporada.</td></tr>';
            return; 
        }

        rewards.forEach(r => {
            const row = rewardsListBody.insertRow();
            let free = [];
            if (r.free_reward_currency > 0) free.push(`${r.free_reward_currency} Moedas`);
            if (r.free_reward_premium > 0) free.push(`${r.free_reward_premium} Cash`);
            if (r.free_reward_item_id) free.push(`Item ID: ${r.free_reward_item_id}`);

            let premium = [];
            if (r.premium_reward_currency > 0) premium.push(`${r.premium_reward_currency} Moedas`);
            if (r.premium_reward_premium > 0) premium.push(`${r.premium_reward_premium} Cash`);
            if (r.premium_reward_item_id) premium.push(`Item ID: ${r.premium_reward_item_id}`);
            row.insertCell().textContent = r.level;
            row.insertCell().textContent = free.join(', ') || 'Nenhuma';
            row.insertCell().textContent = premium.join(', ') || 'Nenhuma';
            const actionsCell = row.insertCell();
            actionsCell.className = 'action-buttons';
            const rewardData = JSON.stringify(r);
            const editBtn = document.createElement('button');
            editBtn.className = 'admin-btn edit-reward-btn';
            editBtn.textContent = 'Editar';
            editBtn.dataset.reward = rewardData;
            editBtn.addEventListener('click', (e) => {
                try {
                    populateRewardForm(JSON.parse(e.target.dataset.reward));
                } catch (err) { alert('Erro ao ler dados da recompensa.'); console.error(err); }
            });
            actionsCell.appendChild(editBtn);
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'admin-btn delete-btn delete-reward-btn';
            deleteBtn.textContent = 'Deletar';
            deleteBtn.dataset.level = r.level;
            deleteBtn.addEventListener('click', (e) => {
                deleteReward(seasonId, e.target.dataset.level);
            });
            actionsCell.appendChild(deleteBtn);
        });
    } catch (error) { 
        rewardsListBody.innerHTML = `<tr><td colspan="4" style="color:red;">Erro ao carregar recompensas.</td></tr>`;
    }
}

async function populateQuestForm(questId) {
    try {
        const quest = await apiRequest(`/admin/quest/${questId}`);
        document.getElementById('edit-quest-id').value = questId;
        document.getElementById('quest_name').value = quest.quest_name;
        document.getElementById('quest_desc').value = quest.description;
        document.getElementById('quest_type').value = quest.quest_type;
        document.getElementById('quest_objective_type').value = quest.objective_type;
        document.getElementById('quest_objective_value_string').value = quest.objective_value_string || '';
        document.getElementById('quest_objective_value_int').value = quest.objective_value_int;
        document.getElementById('quest_reward_xp').value = quest.reward_xp;

        document.getElementById('quest-form-title').textContent = `Editando Missão ID: ${questId}`;
        cancelEditQuestBtn?.classList.remove('hidden');
        createQuestForm?.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        alert("Erro ao carregar dados da missão.");
    }
}

function cancelEditQuest() {
    document.getElementById('edit-quest-id').value = '';
    createQuestForm?.reset();
    document.getElementById('quest-form-title').textContent = "Criar Nova Missão";
    cancelEditQuestBtn?.classList.add('hidden');
}

async function deleteQuest(questId) {
    if (!confirm(`Deletar missão ID ${questId}? (Pode falhar se houver progresso de jogador)`)) return;
    try {
        await apiRequest(`/admin/quest/${questId}`, 'DELETE');
        alert("Missão deletada.");
        refreshQuestsList(currentSelectedSeasonId);
    } catch (error) {}
}

async function refreshQuestsList(seasonId) {
    if (!questsListBody) return;
    questsListBody.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';
    try {
        const quests = await apiRequest(`/admin/quests/${seasonId}`);
        questsListBody.innerHTML = '';
        if (quests.length === 0) { questsListBody.innerHTML = '<tr><td colspan="6">Nenhuma missão definida para esta temporada.</td></tr>'; return; }

        quests.forEach(q => {
            const row = questsListBody.insertRow();
            let objective = q.objective_type;
            let value = q.objective_value_int;
            if (q.objective_value_string) {
                value = `${q.objective_value_string} (x${q.objective_value_int})`;
            }

            row.insertCell().textContent = q.quest_name;
            row.insertCell().textContent = q.quest_type;
            row.insertCell().textContent = objective;
            row.insertCell().textContent = value;
            row.insertCell().textContent = `${q.reward_xp} XP`;

            const actionsCell = row.insertCell();
            actionsCell.className = 'action-buttons';
            actionsCell.innerHTML = `
                <button class="admin-btn edit-quest-btn" data-id="${q.quest_id}">Editar</button>
                <button class="admin-btn delete-btn delete-quest-btn" data-id="${q.quest_id}">Deletar</button>
            `;
            row.querySelector('.edit-quest-btn').addEventListener('click', (e) => populateQuestForm(e.target.dataset.id));
            row.querySelector('.delete-quest-btn').addEventListener('click', (e) => deleteQuest(e.target.dataset.id));
        });
    } catch (error) { questsListBody.innerHTML = `<tr><td colspan="6" style="color:red;">Erro ao carregar missões.</td></tr>`; }
}

async function refreshVipRewardsList() {
    if (!vipRewardsListBody) return;
    vipRewardsListBody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';
    try {
        const rewards = await apiRequest('/admin/vip_rewards');
        vipRewardsListBody.innerHTML = ''; 
        if (rewards.length === 0) { vipRewardsListBody.innerHTML = '<tr><td colspan="5">Nenhum nível VIP definido.</td></tr>'; return; }

        rewards.forEach(r => {
            const row = vipRewardsListBody.insertRow();
            let fixedList = [];
            if (r.reward_currency > 0) fixedList.push(`${r.reward_currency} Moedas`);
            if (r.reward_premium > 0) fixedList.push(`${r.reward_premium} Cash`);

            let choiceList = [];
            if (r.reward_item_id_1) choiceList.push(r.reward_item_id_1);
            if (r.reward_item_id_2) choiceList.push(r.reward_item_id_2);
            if (r.reward_item_id_3) choiceList.push(r.reward_item_id_3);
            row.insertCell().textContent = r.level;
            row.insertCell().textContent = r.reward_description;
            row.insertCell().textContent = fixedList.join(', ') || 'Nenhum';
            row.insertCell().textContent = choiceList.join(', ') || 'Nenhum';
            const actionsCell = row.insertCell();
            actionsCell.className = 'action-buttons';
            const rewardData = JSON.stringify(r);
            const editBtn = document.createElement('button');
            editBtn.className = 'admin-btn edit-vip-btn';
            editBtn.textContent = 'Editar';
            editBtn.dataset.reward = rewardData;
            editBtn.addEventListener('click', (e) => {
                const data = JSON.parse(e.target.dataset.reward);
                document.getElementById('vip_level').value = data.level;
                document.getElementById('vip_reward_description').value = data.reward_description;
                document.getElementById('vip_reward_currency').value = data.reward_currency || 0;
                document.getElementById('vip_reward_premium').value = data.reward_premium || 0;
                document.getElementById('vip_reward_item_id_1').value = data.reward_item_id_1 || '';
                document.getElementById('vip_reward_item_id_2').value = data.reward_item_id_2 || '';
                document.getElementById('vip_reward_item_id_3').value = data.reward_item_id_3 || '';
                createVipRewardForm.scrollIntoView({ behavior: 'smooth' });
            });
            actionsCell.appendChild(editBtn);
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'admin-btn delete-btn delete-vip-btn';
            deleteBtn.textContent = 'Deletar';
            deleteBtn.dataset.level = r.level;
            deleteBtn.addEventListener('click', (e) => {
                deleteVipRewardByLevel(e.target.dataset.level);
            });
            actionsCell.appendChild(deleteBtn);
        });
    } catch (error) { vipRewardsListBody.innerHTML = `<tr><td colspan="5" style="color:red;">Erro ao carregar níveis VIP.</td></tr>`; }
}

async function deleteVipRewardByLevel(level) {
    if (!confirm(`Deletar recompensa do Nível VIP ${level}? (Pode falhar se já foi resgatado)`)) return;
    try { 
        await apiRequest(`/admin/vip_reward/${level}`, 'DELETE'); 
        alert('Recompensa VIP deletada!'); 
        refreshVipRewardsList(); 
    } catch(error){}
}

async function loadSystemSettings() {
    if (!settingsVipStatus || !toggleVipPurchasesBtn) return;
    settingsVipStatus.innerHTML = 'Carregando...';
    toggleVipPurchasesBtn.disabled = true;
    if (settingsDailyLoginStatus) settingsDailyLoginStatus.innerHTML = 'Carregando...';
    if (toggleDailyLoginBtn) toggleDailyLoginBtn.disabled = true;

    if (settingsMatchmakingStatus) settingsMatchmakingStatus.innerHTML = 'Carregando...';
    if (toggleMatchmakingBtn) toggleMatchmakingBtn.disabled = true;

    if (gameSettingsForm) {
        gameSettingsForm.querySelector('button[type="submit"]').disabled = true;
    }

    try {
        const settings = await apiRequest('/admin/settings');
        updateSettingsUI(settings);

        if (gameSettingsForm) {
            const inputs = gameSettingsForm.querySelectorAll('input');
            inputs.forEach(input => {
                const key = input.id.replace('setting_', '');
                if (key === 'vip_loyalty_access_tiers' && Array.isArray(settings[key])) {
                    input.value = settings[key].join(',');
                } else {
                    input.value = settings[key];
                }
            });
            gameSettingsForm.querySelector('button[type="submit"]').disabled = false;
        }

    } catch (error) {
        settingsVipStatus.innerHTML = '<span style="color:red">Erro ao carregar status.</span>';
        if (settingsMatchmakingStatus) settingsMatchmakingStatus.innerHTML = '<span style="color:red">Erro ao carregar status.</span>';
        if (toggleVipPurchasesBtn) toggleVipPurchasesBtn.textContent = 'Erro ao Carregar';
        if (toggleMatchmakingBtn) toggleMatchmakingBtn.textContent = 'Erro ao Carregar';
    }
}

function updateSettingsUI(settings) {
    if (settingsVipStatus && toggleVipPurchasesBtn) {
        toggleVipPurchasesBtn.disabled = false;
        if (settings.allow_vip_purchases) {
            settingsVipStatus.innerHTML = '<span style="color:var(--success-color); font-weight: bold;">ATIVADAS</span> (Jogadores podem comprar VIP)';
            toggleVipPurchasesBtn.textContent = 'Desativar Compras VIP (Modo Manutenção)';
            toggleVipPurchasesBtn.classList.add('delete-btn');
        } else {
            settingsVipStatus.innerHTML = '<span style="color:var(--error-color); font-weight: bold;">DESATIVADAS</span> (Modo Manutenção)';
            toggleVipPurchasesBtn.textContent = 'Ativar Compras VIP';
            toggleVipPurchasesBtn.classList.remove('delete-btn');
        }
    }
    
    if (settingsMatchmakingStatus && toggleMatchmakingBtn) {
        toggleMatchmakingBtn.disabled = false;
        if (settings.allow_matchmaking) {
            settingsMatchmakingStatus.innerHTML = '<span style="color:var(--success-color); font-weight: bold;">ATIVADO</span> (Jogadores podem iniciar novas partidas)';
            toggleMatchmakingBtn.textContent = 'Desativar Matchmaking (Proibir Novas Partidas)';
            toggleMatchmakingBtn.classList.add('delete-btn');
        } else {
            settingsMatchmakingStatus.innerHTML = '<span style="color:var(--error-color); font-weight: bold;">DESATIVADO</span> (Novas partidas estão proibidas)';
            toggleMatchmakingBtn.textContent = 'Ativar Matchmaking';
            toggleMatchmakingBtn.classList.remove('delete-btn');
        }
    }

    if (settingsDailyLoginStatus && toggleDailyLoginBtn) {
        toggleDailyLoginBtn.disabled = false;
        const allowDaily = settings.allow_daily_login ?? true;
        if (allowDaily) {
            settingsDailyLoginStatus.innerHTML = '<span style="color:var(--success-color); font-weight: bold;">ATIVADO</span>';
            toggleDailyLoginBtn.textContent = 'Desativar Resgate Diário';
            toggleDailyLoginBtn.classList.add('delete-btn');
        } else {
            settingsDailyLoginStatus.innerHTML = '<span style="color:var(--error-color); font-weight: bold;">DESATIVADO</span>';
            toggleDailyLoginBtn.textContent = 'Ativar Resgate Diário';
            toggleDailyLoginBtn.classList.remove('delete-btn');
        }
    }
}

async function refreshUpdatesList() {
    const tbody = document.getElementById('updates-table-body'); 
    
    if (!tbody) {
        console.warn("Tabela de updates não encontrada");
        return;
    }
    
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Carregando cronograma...</td></tr>';
    
    try {
        const updates = await apiRequest('/admin/updates');
        tbody.innerHTML = '';
        
        if(!updates || updates.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: #888;">Nenhum agendamento encontrado.</td></tr>'; 
            return;
        }
        
        updates.forEach(u => {
            const row = tbody.insertRow();
            
            let statusColor = '#888';
            let statusText = u.status.toUpperCase();
            if(u.status === 'active') { statusColor = 'var(--accent-orange)'; statusText += ' (EM ANDAMENTO)'; }
            if(u.status === 'completed') statusColor = 'var(--success-color)';
            if(u.status === 'cancelled') statusColor = 'var(--error-color)';
            if(u.status === 'pending') { statusColor = 'white'; statusText = 'PENDENTE'; }

            const typeIcon = u.is_maintenance ? '🔴' : '🟢';
            const typeLabel = u.is_maintenance ? 'MANUTENÇÃO (LOCK)' : 'EVENTO AO VIVO';

            row.insertCell().textContent = u.update_id;
            
            const titleCell = row.insertCell();
            titleCell.innerHTML = `<div>${typeIcon} <strong>${u.title}</strong></div><div style="font-size:0.75rem; color:#aaa;">${typeLabel}</div>`;
            
            row.insertCell().textContent = new Date(u.start_time).toLocaleString('pt-BR');
            row.insertCell().textContent = new Date(u.end_time).toLocaleString('pt-BR');
            
            const statusCell = row.insertCell();
            statusCell.innerHTML = `<span style="color:${statusColor}; font-weight:bold">${statusText}</span>`;

            const actionsCell = row.insertCell();
            actionsCell.className = 'action-buttons';
            actionsCell.style.display = 'flex';
            actionsCell.style.gap = '5px';
            
            if (u.status === 'pending') {
                const cancelBtn = document.createElement('button');
                cancelBtn.type = 'button';
                cancelBtn.className = 'admin-btn delete-btn';
                cancelBtn.innerHTML = '<i class="fa-solid fa-ban"></i>';
                cancelBtn.title = "Cancelar";
                cancelBtn.style.padding = '5px 10px';
                cancelBtn.onclick = (e) => { e.preventDefault(); cancelUpdate(u.update_id); };
                actionsCell.appendChild(cancelBtn);

                const nowBtn = document.createElement('button');
                nowBtn.type = 'button';
                nowBtn.className = 'admin-btn secondary-button';
                nowBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
                nowBtn.title = "Executar Agora";
                nowBtn.style.padding = '5px 10px';
                nowBtn.onclick = async (e) => {
                    e.preventDefault();
                    if(confirm("ATENÇÃO: Isso iniciará o agendamento em 1 minuto. Confirmar?")) {
                        try {
                            await apiRequest(`/admin/updates/${u.update_id}/anticipate`, 'POST');
                            alert("Iniciando em breve...");
                            refreshUpdatesList();
                        } catch(e) { alert(e.message); }
                    }
                };
                actionsCell.appendChild(nowBtn);

            } else if (u.status === 'active' && u.is_maintenance) {
                const endBtn = document.createElement('button');
                endBtn.type = 'button';
                endBtn.className = 'admin-btn';
                endBtn.innerHTML = '<i class="fa-solid fa-stop"></i> Fim';
                endBtn.style.padding = '5px 10px';
                endBtn.onclick = async (e) => {
                    e.preventDefault();
                    if(confirm("Reabrir o servidor imediatamente?")) {
                        try {
                            await apiRequest(`/admin/updates/${u.update_id}`, 'PUT', { end_time: new Date().toISOString() });
                            alert("O sistema reabrirá no próximo minuto.");
                            refreshUpdatesList();
                        } catch(e) { alert(e.message); }
                    }
                };
                actionsCell.appendChild(endBtn);
            } else {
                actionsCell.innerHTML = '<span style="color:#555">-</span>';
            }
        });
    } catch(e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="6" style="color:var(--error-color); text-align:center;">Erro: ${e.message}</td></tr>`;
    }
}

async function loadUpdateContextSelector() {
    const selector = document.getElementById('admin-context-selector');
    const indicator = document.getElementById('context-indicator');
    if (!selector) return;

    try {
        const updates = await apiRequest('/admin/updates');
        while (selector.options.length > 1) { selector.remove(1); }

        updates.forEach(u => {
            if (u.status === 'pending') {
                const opt = document.createElement('option');
                opt.value = u.update_id;
                opt.textContent = `🗓️ ${u.title} (ID: ${u.update_id})`;
                selector.appendChild(opt);
            }
        });

        selector.addEventListener('change', () => {
            currentAdminContext = selector.value;
            if (currentAdminContext === 'live') {
                selector.style.borderColor = 'var(--success-color)';
                indicator.textContent = "Alterações são aplicadas na hora.";
                indicator.style.color = 'var(--success-color)';
                updateSubmitButtonsText("Salvar");
            } else {
                selector.style.borderColor = 'var(--accent-orange)';
                indicator.textContent = `Alterações serão agendadas para ID ${currentAdminContext}.`;
                indicator.style.color = 'var(--accent-orange)';
                updateSubmitButtonsText("Agendar para Manutenção");
            }
        });

    } catch (e) { console.error("Erro ao carregar contextos:", e); }
}

function updateSubmitButtonsText(text) {
    const forms = ['create-item-form', 'game-settings-form', 'create-ability-form'];
    forms.forEach(fid => {
        const btn = document.querySelector(`#${fid} button[type="submit"]`);
        if(btn) btn.innerHTML = `<i class="fa-solid fa-save"></i> ${text}`;
    });
}

async function handleContextAwareSubmit(e, liveEndpoint, liveMethod, data, actionType) {
    e.preventDefault();
    
    if (currentAdminContext === 'live') {
        try {
            const r = await apiRequest(liveEndpoint, liveMethod, data);
            alert(r.message);
            if (liveMethod === 'POST') e.target.reset();
            return true;
        } catch (err) { return false; }
    } else {
        if (!confirm(`Confirma agendar esta alteração ('${actionType}') para a manutenção selecionada?`)) return false;
        
        try {
            const queueData = {
                action_type: actionType,
                payload: data
            };
            const r = await apiRequest(`/admin/updates/${currentAdminContext}/queue_change`, 'POST', queueData);
            alert(r.message);
            if (liveMethod === 'POST') e.target.reset();
            return true;
        } catch (err) { return false; }
    }
}

function populateRewardForm(rewardData) {
    if (!createRewardForm) return;
    
    document.getElementById('reward_level').value = rewardData.level;
    document.getElementById('reward_level').readOnly = true;
    
    document.getElementById('reward_free_item_id').value = rewardData.free_reward_item_id || '';
    document.getElementById('reward_free_currency').value = rewardData.free_reward_currency || 0;
    document.getElementById('reward_free_premium').value = rewardData.free_reward_premium || 0;
    
    document.getElementById('reward_premium_item_id').value = rewardData.premium_reward_item_id || '';
    document.getElementById('reward_premium_currency').value = rewardData.premium_reward_currency || 0;
    document.getElementById('reward_premium_premium').value = rewardData.premium_reward_premium || 0;

    document.getElementById('reward-form-title').textContent = `Editando Nível ${rewardData.level}`;
    cancelEditRewardBtn?.classList.remove('hidden');
    createRewardForm?.scrollIntoView({ behavior: 'smooth' });
}

function cancelEditReward() {
    if (createRewardForm) {
        createRewardForm.reset();
        document.getElementById('reward_level').readOnly = false;
    }
    document.getElementById('reward-form-title').textContent = "Adicionar/Editar Recompensa de Nível";
    cancelEditRewardBtn?.classList.add('hidden');
}

async function deleteReward(seasonId, level) {
    if (!confirm(`Deletar recompensa do Nível ${level} (Temporada ${seasonId})? (Pode falhar se já foi resgatado)`)) return;
    try {
        await apiRequest(`/admin/battlepass/reward/${seasonId}/${level}`, 'DELETE');
        alert("Recompensa deletada.");
        refreshRewardsList(seasonId);
        cancelEditReward();
    } catch (error) {}
}

async function populateSeasonForm(seasonId) {
    try {
        const season = await apiRequest(`/admin/battlepass/season/${seasonId}`);
        
        const toLocalISOString = (dateString) => {
            const date = new Date(dateString);
            date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
            return date.toISOString().slice(0, 16);
        };

        document.getElementById('edit-season-id').value = season.season_id;
        document.getElementById('season_name').value = season.season_name;
        document.getElementById('season_start_date').value = toLocalISOString(season.start_date);
        document.getElementById('season_end_date').value = toLocalISOString(season.end_date);
        
        document.getElementById('season_premium_pass_id').value = season.premium_pass_item_id || '';
        document.getElementById('season_master_pass_id').value = season.master_pass_item_id || '';

        document.getElementById('season-form-title').textContent = `Editando Temporada ID: ${season.season_id}`;
        cancelEditSeasonBtn?.classList.remove('hidden');
        createSeasonForm?.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        alert("Erro ao carregar dados da temporada.");
    }
}

function cancelEditSeason() {
    document.getElementById('edit-season-id').value = '';
    createSeasonForm?.reset();
    document.getElementById('season-form-title').textContent = "Criar Nova Temporada";
    cancelEditSeasonBtn?.classList.add('hidden');
}

async function deleteSeason(seasonId, seasonName) {
    if (!confirm(`Deletar temporada '${seasonName}' (ID: ${seasonId})? (Falhará se houver recompensas, missões ou progresso de jogadores associados)`)) return;
    try {
        await apiRequest(`/admin/battlepass/season/${seasonId}`, 'DELETE');
        alert("Temporada deletada.");
        refreshSeasonsList();
        cancelEditSeason();
    } catch (error) {}
}

async function loadDashboard() {
    const fields = ['db-total-users', 'db-new-users', 'db-online-users', 'db-active-servers', 'db-matches-today'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '...';
    });
    try {
        const stats = await apiRequest('/admin/dashboard/stats');
        document.getElementById('db-total-users').textContent = stats.total_users;
        document.getElementById('db-new-users').textContent = stats.new_users_today;
        document.getElementById('db-online-users').textContent = stats.online_users;
        document.getElementById('db-active-servers').textContent = stats.active_servers;
        document.getElementById('db-matches-today').textContent = stats.matches_today;
    } catch (error) {
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = 'Erro';
        });
    }
}

async function handleBroadcastSubmit(e) {
    e.preventDefault();
    const data = {
        message: e.target.broadcast_message.value,
        duration_minutes: parseInt(e.target.broadcast_duration.value)
    };
    if (!data.message || !data.duration_minutes) {
        alert("Mensagem e duração são obrigatórias.");
        return;
    }
    if (!confirm(`Enviar a mensagem global: "${data.message}"?`)) return;
    try {
        const r = await apiRequest('/admin/broadcast', 'POST', data);
        alert(r.message);
        e.target.reset();
    } catch (error) {}
}

async function refreshAdminLogs() {
    const tbody = document.getElementById('admin-logs-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Carregando logs...</td></tr>';
    
    try {
        const logs = await apiRequest('/admin/logs?limit=100');
        
        tbody.innerHTML = '';
        if (!logs || logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhum log encontrado.</td></tr>';
            return;
        }
        
        logs.forEach(log => {
            const row = tbody.insertRow();
            
            row.insertCell().textContent = new Date(log.log_timestamp).toLocaleString('pt-BR');
            
            let adminDisplay = log.admin_username;
            if (!adminDisplay) {
                adminDisplay = log.admin_user_id ? `ID: ${log.admin_user_id}` : 'Sistema';
            }
            row.insertCell().textContent = adminDisplay;
            
            row.insertCell().textContent = log.action_type;
            
            row.insertCell().textContent = log.target_username || (log.target_user_id ? `ID: ${log.target_user_id}` : '-');
            
            const detailsCell = row.insertCell();
            if (log.details) {
                const code = document.createElement('code');
                code.style.fontSize = '0.75rem';
                code.textContent = typeof log.details === 'object' ? JSON.stringify(log.details) : log.details;
                detailsCell.appendChild(code);
            } else {
                detailsCell.textContent = '-';
            }
        });
    } catch (error) {
        console.error("Erro logs:", error);
        tbody.innerHTML = `<tr><td colspan="5" style="color:var(--error-color); text-align:center;">Erro ao carregar logs: ${error.message}</td></tr>`;
    }
}

async function refreshNewsList() {
    if (!newsListBody) return;
    newsListBody.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';
    try {
        const news = await apiRequest('/admin/news');
        newsListBody.innerHTML = '';
        if (news.length === 0) {
            newsListBody.innerHTML = '<tr><td colspan="4">Nenhuma notícia criada.</td></tr>';
            return;
        }
        news.forEach(item => {
            const row = newsListBody.insertRow();
            row.insertCell().textContent = item.news_id;
            row.insertCell().textContent = item.title;
            row.insertCell().textContent = item.expires_at ? new Date(item.expires_at).toLocaleString('pt-BR') : 'Nunca';
            const actionsCell = row.insertCell();
            actionsCell.className = 'action-buttons';
            const newsData = JSON.stringify(item);
            const editBtn = document.createElement('button');
            editBtn.className = 'admin-btn edit-news-btn';
            editBtn.textContent = 'Editar';
            editBtn.dataset.news = newsData;
            editBtn.addEventListener('click', (e) => populateNewsForm(JSON.parse(e.target.dataset.news)));
            actionsCell.appendChild(editBtn);
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'admin-btn delete-btn delete-news-btn';
            deleteBtn.textContent = 'Deletar';
            deleteBtn.dataset.id = item.news_id;
            deleteBtn.dataset.name = item.title;
            deleteBtn.addEventListener('click', (e) => deleteNewsItem(e.target.dataset.id, e.target.dataset.name));
            actionsCell.appendChild(deleteBtn);
        });
    } catch (error) {
        newsListBody.innerHTML = '<tr><td colspan="4" style="color:red;">Erro ao carregar notícias.</td></tr>';
    }
}

async function handleNewsSubmit(e) {
    e.preventDefault();
    const editId = e.target['edit-news-id'].value;
    const expiresValue = e.target.news_expires_at.value;
    const data = {
        title: e.target.news_title.value,
        content: e.target.news_content.value,
        expires_at: expiresValue ? new Date(expiresValue).toISOString() : null
    };

    const endpoint = editId ? `/admin/news/${editId}` : '/admin/news';
    const method = editId ? 'PUT' : 'POST';

    try {
        const r = await apiRequest(endpoint, method, data);
        alert(editId ? 'Notícia atualizada!' : 'Notícia criada!');
        cancelEditNews();
        refreshNewsList();
    } catch (error) {}
}

function populateNewsForm(item) {
    document.getElementById('edit-news-id').value = item.news_id;
    document.getElementById('news_title').value = item.title;
    document.getElementById('news_content').value = item.content;
    
    if (item.expires_at) {
        const date = new Date(item.expires_at);
        date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
        document.getElementById('news_expires_at').value = date.toISOString().slice(0, 16);
    } else {
        document.getElementById('news_expires_at').value = '';
    }
    
    document.getElementById('news-form-title').textContent = `Editando Notícia ID: ${item.news_id}`;
    cancelEditNewsBtn?.classList.remove('hidden');
    createNewsForm?.scrollIntoView({ behavior: 'smooth' });
}

function cancelEditNews() {
    createNewsForm?.reset();
    document.getElementById('edit-news-id').value = '';
    document.getElementById('news-form-title').textContent = "Criar Nova Notícia";
    cancelEditNewsBtn?.classList.add('hidden');
}

async function deleteNewsItem(id, name) {
    if (!confirm(`Deletar notícia "${name}"?`)) return;
    try {
        await apiRequest(`/admin/news/${id}`, 'DELETE');
        alert("Notícia deletada.");
        refreshNewsList();
    } catch (error) {}
}

async function refreshEventsList() {
    if (!eventsListBody) return;
    eventsListBody.innerHTML = '<tr><td colspan="7">Carregando...</td></tr>';
    try {
        const events = await apiRequest('/admin/events');
        eventsListBody.innerHTML = '';
        if (events.length === 0) {
            eventsListBody.innerHTML = '<tr><td colspan="7">Nenhum evento criado.</td></tr>';
            return;
        }
        events.forEach(item => {
            const row = eventsListBody.insertRow();
            row.insertCell().textContent = item.event_id;
            row.insertCell().textContent = item.event_name;
            row.insertCell().textContent = item.event_type;
            row.insertCell().textContent = `${item.multiplier_value}x`;
            row.insertCell().textContent = new Date(item.start_time).toLocaleString('pt-BR');
            row.insertCell().textContent = new Date(item.end_time).toLocaleString('pt-BR');
            const actionsCell = row.insertCell();
            actionsCell.className = 'action-buttons';
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'admin-btn delete-btn delete-event-btn';
            deleteBtn.textContent = 'Deletar';
            deleteBtn.dataset.id = item.event_id;
            deleteBtn.dataset.name = item.event_name;
            deleteBtn.addEventListener('click', (e) => deleteEvent(e.target.dataset.id, e.target.dataset.name));
            actionsCell.appendChild(deleteBtn);
        });
    } catch (error) {
        eventsListBody.innerHTML = '<tr><td colspan="7" style="color:red;">Erro ao carregar eventos.</td></tr>';
    }
}

async function handleEventSubmit(e) {
    e.preventDefault();
    const data = {
        event_name: e.target.event_name.value,
        event_type: e.target.event_type.value,
        multiplier_value: parseFloat(e.target.event_multiplier.value),
        start_time: new Date(e.target.event_start_time.value).toISOString(),
        end_time: new Date(e.target.event_end_time.value).toISOString()
    };
    try {
        await apiRequest('/admin/events', 'POST', data);
        alert('Evento criado!');
        e.target.reset();
        refreshEventsList();
    } catch (error) {}
}

async function deleteEvent(id, name) {
    if (!confirm(`Deletar evento "${name}"?`)) return;
    try {
        await apiRequest(`/admin/events/${id}`, 'DELETE');
        alert("Evento deletado.");
        refreshEventsList();
    } catch (error) {}
}

function closeUserDetailsModal() {
    if (!userDetailsModal) return;
    userDetailsModal.classList.add('hidden');
    document.getElementById('edit-stats-user-id').value = '';
    editUserInventoryForm?.reset();
    wipeInventoryBtn.onclick = null;
    wipeStatsBtn.onclick = null;
    wipeBattlepassBtn.onclick = null;
}

async function handleEditUserInventorySubmit(e) {
    e.preventDefault();
    const userId = e.target['edit-inv-user-id'].value;
    const username = e.target['edit-inv-username'].value;
    
    const data = {
        item_id: parseInt(e.target['edit-inv-item-id'].value),
        new_quantity: parseInt(e.target['edit-inv-quantity'].value),
        username_for_log: username
    };

    if (isNaN(data.item_id) || isNaN(data.new_quantity)) {
        alert("Dados inválidos.");
        return;
    }

    try {
        const result = await apiRequest(`/admin/user/${userId}/inventory/manage_item`, 'POST', data);
        alert(result.message);
        
        const invRes = await apiRequest(`/admin/user/${userId}/inventory`);
        
        const formattedInv = invRes.map(i => 
            `${i.item_name} (ID: ${i.item_id}) - Qtd: ${i.total_quantity} - Nvl: ${i.item_level || 1}`
        );
        
        document.getElementById('user-details-inventory').textContent = JSON.stringify(formattedInv, null, 2);

    } catch (error) {
        alert(error.message);
    }
}

function openTab(evt, tabName) {
    if(evt) evt.preventDefault();
    const section = evt.target.closest('.admin-page');
    const tabContents = section.querySelectorAll('.tab-content');
    tabContents.forEach(content => content.classList.remove('active'));

    const tabLinks = section.querySelectorAll('.tab-link');
    tabLinks.forEach(link => link.classList.remove('active'));

    document.getElementById(tabName).classList.add('active');
    evt.currentTarget.classList.add('active');
}

async function openUserDetailsModal(userId, username) {
    if (!userDetailsModal) {
        console.error("Modal userDetailsModal não encontrado no HTML.");
        return;
    }

    document.getElementById('user-details-title').textContent = `Detalhes: ${username} (ID: ${userId})`;
    userDetailsContent.classList.add('hidden');
    userDetailsLoading.classList.remove('hidden');
    
    if (typeof editUserStatsForm !== 'undefined' && editUserStatsForm) editUserStatsForm.reset();
    const idInput = document.getElementById('edit-stats-user-id');
    if (idInput) idInput.value = userId;

    userDetailsModal.classList.remove('hidden');

    const safeSetText = (elementId, text) => {
        const el = document.getElementById(elementId);
        if (el) el.textContent = text;
    };

    safeSetText('user-details-stats', 'Carregando...');
    safeSetText('user-details-equipment', 'Carregando...');
    safeSetText('user-details-battlepass', 'Carregando...');
    safeSetText('user-details-social', 'Carregando...');
    safeSetText('user-details-inventory', 'Carregando...');
    safeSetText('user-details-chatlog', 'Carregando...');
    
    const securityEl = document.getElementById('user-details-security');
    if (securityEl) securityEl.innerHTML = '<p>Carregando logs de segurança...</p>';

    const scoreInput = document.getElementById('edit-user-score');
    const mmrInput = document.getElementById('edit-user-mmr');
    if(scoreInput) scoreInput.value = 0;
    if(mmrInput) mmrInput.value = 1000;

    try {
        const results = await Promise.allSettled([
            apiRequest(`/admin/user/${userId}/stats`),
            apiRequest(`/admin/user/${userId}/equipment`),
            apiRequest(`/admin/user/${userId}/battlepass_status`),
            apiRequest(`/admin/user/${userId}/social`),
            apiRequest(`/admin/user/${userId}/inventory`),
            apiRequest(`/admin/users`),
            apiRequest(`/admin/user/${userId}/chat_logs`),
            apiRequest(`/admin/user/${userId}/security_logs`)
        ]);

        const [statsRes, equipRes, bpRes, socialRes, invRes, usersRes, chatRes, securityRes] = results;

        if (statsRes.status === 'fulfilled') {
            safeSetText('user-details-stats', JSON.stringify(statsRes.value, null, 2));
            if(scoreInput) scoreInput.value = statsRes.value.total_score || 0;
        } else safeSetText('user-details-stats', `Erro: ${statsRes.reason.message}`);

        if (usersRes.status === 'fulfilled') {
            const user = usersRes.value.find(u => u.id == userId);
            if(mmrInput) mmrInput.value = user ? (user.mmr || 1000) : 1000;
        }

        if (equipRes.status === 'fulfilled') safeSetText('user-details-equipment', JSON.stringify(equipRes.value, null, 2));
        else safeSetText('user-details-equipment', `Erro: ${equipRes.reason.message}`);

        if (bpRes.status === 'fulfilled') safeSetText('user-details-battlepass', JSON.stringify(bpRes.value, null, 2));
        else safeSetText('user-details-battlepass', `Erro: ${bpRes.reason.message}`);

        if (socialRes.status === 'fulfilled') safeSetText('user-details-social', JSON.stringify(socialRes.value, null, 2));
        else safeSetText('user-details-social', `Erro: ${socialRes.reason.message}`);

        if (invRes.status === 'fulfilled') safeSetText('user-details-inventory', JSON.stringify(invRes.value, null, 2));
        else safeSetText('user-details-inventory', `Erro: ${invRes.reason.message}`);

        const chatLogEl = document.getElementById('user-details-chatlog');
        if (chatLogEl) {
            if (chatRes.status === 'fulfilled') {
                const logs = chatRes.value;
                if (logs.length === 0) chatLogEl.textContent = "Nenhuma mensagem encontrada.";
                else {
                    const safeLogText = logs.map(log => `[${new Date(log.timestamp).toLocaleString('pt-BR')}] (Match: ${log.match_id || '-'}) : ${log.message_content}`).join('\n');
                    setSafeHTML(chatLogEl, safeLogText);
                }
            } else chatLogEl.textContent = `Erro: ${chatRes.reason.message}`;
        }

        if (securityEl) {
            if (securityRes.status === 'fulfilled') {
                const data = securityRes.value;
                let html = '';

                html += '<h4 style="margin-top:0;">✅ Histórico de Login (Últimos 15)</h4>';
                if (data.valid_login_history.length === 0) {
                    html += '<p style="color:#888">Nenhum registro recente.</p>';
                } else {
                    html += '<ul style="padding-left: 1rem; margin-bottom: 1rem;">';
                    data.valid_login_history.forEach(log => {
                        const revokedBadge = log.is_revoked ? ' <span style="color:red; font-weight:bold;">[REVOGADO]</span>' : '';
                        html += `<li style="margin-bottom:4px;">
                            <span style="color: var(--accent-steel-blue)">${log.created_ip}</span> 
                            - ${new Date(log.created_at).toLocaleString('pt-BR')}
                            ${revokedBadge}
                        </li>`;
                    });
                    html += '</ul>';
                }

                html += '<h4 style="color: var(--error-color); margin-top: 1rem;">⚠️ Atividade Suspeita / Falhas</h4>';
                if (data.suspicious_activity.length === 0) {
                    html += '<p style="color:#888">Nenhuma atividade suspeita registrada.</p>';
                } else {
                    html += '<ul style="padding-left: 1rem;">';
                    data.suspicious_activity.forEach(log => {
                        let detailsStr = '';
                        if (log.details) {
                             detailsStr = `<br><small style="color:#ccc">${JSON.stringify(log.details)}</small>`;
                        }
                        html += `<li style="margin-bottom:8px; border-bottom: 1px dashed #444; padding-bottom: 4px;">
                            <strong style="color: var(--accent-orange)">${log.type}</strong><br>
                            IP: <span style="color: #fff">${log.ip_address || 'N/A'}</span> - ${new Date(log.created_at).toLocaleString('pt-BR')}
                            ${detailsStr}
                        </li>`;
                    });
                    html += '</ul>';
                }
                
                securityEl.innerHTML = html;
            } else {
                let errorMsg = securityRes.reason.message;
                if (typeof errorMsg === 'object') {
                    errorMsg = JSON.stringify(errorMsg);
                }
                securityEl.innerHTML = `<p style="color: var(--error-color)">Erro ao carregar logs: ${errorMsg}</p>`;
            }
        }

        if(typeof wipeInventoryBtn !== 'undefined' && wipeInventoryBtn) wipeInventoryBtn.onclick = () => handleWipe(userId, username, 'inventory');
        if(typeof wipeStatsBtn !== 'undefined' && wipeStatsBtn) wipeStatsBtn.onclick = () => handleWipe(userId, username, 'stats');

        userDetailsLoading.classList.add('hidden');
        userDetailsContent.classList.remove('hidden');

    } catch (error) {
        console.error("Erro crítico no modal:", error);
        alert(`Erro ao processar dados: ${error.message}`);
        closeUserDetailsModal();
    }
}

async function handleEditUserStatsSubmit(e) {
    e.preventDefault();
    const userId = e.target['edit-stats-user-id'].value;
    const dataScore = { new_total_score: parseInt(e.target['edit-user-score'].value) };
    const dataMMR = { new_mmr: parseInt(e.target['edit-user-mmr'].value) };
    
    if (!confirm(`Tem certeza que quer ATUALIZAR os stats do usuário ID ${userId}?`)) return;

    try {
        await Promise.all([
            apiRequest(`/admin/user/${userId}/set_score`, 'PUT', dataScore),
            apiRequest(`/admin/user/${userId}/set_mmr`, 'PUT', dataMMR)
        ]);
        alert("Stats atualizados com sucesso!");
        closeUserDetailsModal();
        refreshUserList();
    } catch (error) {}
}

async function handleWipe(userId, username, wipeType) {
    if (!confirm(`ZONA DE PERIGO!\n\nTem certeza que deseja ZERAR ${wipeType.toUpperCase()} de ${username} (ID: ${userId})?\n\nEsta ação NÃO PODE ser desfeita.`)) return;
    
    try {
        const result = await apiRequest(`/admin/user/${userId}/wipe_${wipeType}`, 'POST');
        alert(result.message);
        closeUserDetailsModal();
        refreshUserList();
    } catch (error) {}
}

async function refreshTransactionsList(params = "") {
    if (!transactionsListBody) return;
    transactionsListBody.innerHTML = '<tr><td colspan="7">Carregando...</td></tr>';
    try {
        const transactions = await apiRequest(`/admin/transactions${params}`);
        transactionsListBody.innerHTML = ''; 
        if (transactions.length === 0) { 
            transactionsListBody.innerHTML = '<tr><td colspan="7">Nenhuma transação encontrada.</td></tr>'; 
            return; 
        }
        transactions.forEach(t => {
            const row = transactionsListBody.insertRow();
            row.insertCell().textContent = t.transaction_id;
            row.insertCell().textContent = new Date(t.created_at).toLocaleString('pt-BR');
            row.insertCell().textContent = `${t.user_id || 'N/A'} (${t.username || 'N/A'})`;
            row.insertCell().textContent = t.product_name || 'N/A';
            row.insertCell().textContent = `${t.amount_paid_cents} (${t.currency})`;
            row.insertCell().textContent = t.payment_status;
            row.insertCell().textContent = t.stripe_session_id;
            });
    } catch (error) { 
        transactionsListBody.innerHTML = `<tr><td colspan="7" style="color:red;">Erro ao carregar transações.</td></tr>`; 
    }
}

async function refreshServersList() {
    if (!serversListBody) return;
    serversListBody.innerHTML = '<tr><td colspan="7">Carregando...</td></tr>';
    try {
        const servers = await apiRequest('/admin/servers/status');
        serversListBody.innerHTML = ''; 
        if (servers.length === 0) { 
            serversListBody.innerHTML = '<tr><td colspan="7">Nenhum servidor ativo reportando.</td></tr>'; 
            return; 
        }
        servers.forEach(s => {
            const row = serversListBody.insertRow();
            const statusColor = s.status === 'in_progress' ? 'var(--accent-orange)' : 'var(--success-color)';

            row.insertCell().textContent = s.server_id;
            row.insertCell().textContent = `${s.server_ip}:${s.server_port}`;
            row.insertCell().textContent = s.region || 'N/A';
            const statusCell = row.insertCell();
            statusCell.style.color = statusColor;
            statusCell.style.fontWeight = 'bold';
            statusCell.textContent = s.status;
            row.insertCell().textContent = `${s.current_players} / ${s.max_players}`;
            row.insertCell().textContent = s.current_map_id || 'N/A';
            row.insertCell().textContent = new Date(s.last_heartbeat).toLocaleString('pt-BR');
            });
    } catch (error) { 
        serversListBody.innerHTML = `<tr><td colspan="7" style="color:red;">Erro ao carregar servidores.</td></tr>`; 
    }
}

async function refreshApiKeysList() {
    if (!apiKeysListBody) return;
    apiKeysListBody.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';
    try {
        const keys = await apiRequest('/admin/api_keys');
        apiKeysListBody.innerHTML = ''; 
        if (keys.length === 0) { 
            apiKeysListBody.innerHTML = '<tr><td colspan="6">Nenhuma chave de API encontrada.</td></tr>'; 
            return; 
        }
        keys.forEach(k => {
            const row = apiKeysListBody.insertRow();
            const status = k.is_active ? `<span style="color:var(--success-color)">Ativa</span>` : `<span style="color:var(--error-color)">Revogada</span>`;
            row.insertCell().textContent = k.key_id;
            row.insertCell().textContent = k.key_hash_preview;
            row.insertCell().textContent = k.associated_username || `ID: ${k.associated_user_id}` || 'N/A';
            row.insertCell().innerHTML = status;
            const permsCell = row.insertCell();
            const permsPre = document.createElement('pre');
            permsPre.className = 'user-details-pre';
            permsPre.style.cssText = 'padding: 0.3rem; font-size: 0.75rem;';
            permsPre.textContent = JSON.stringify(k.permissions);
            permsCell.appendChild(permsPre);
            const actionsCell = row.insertCell();
            actionsCell.className = 'action-buttons';
            const permsData = JSON.stringify(k.permissions);
            const editBtn = document.createElement('button');
            editBtn.className = 'admin-btn edit-api-key-btn';
            editBtn.textContent = 'Editar Permissões';
            editBtn.dataset.keyId = k.key_id;
            editBtn.dataset.permissions = permsData;
            editBtn.addEventListener('click', (e) => {
                document.getElementById('edit-key-id').value = e.target.dataset.keyId;
                document.getElementById('edit-api-key-title').textContent = `Editar Chave ID: ${e.target.dataset.keyId}`;
                document.getElementById('edit_key_permissions').value = JSON.stringify(JSON.parse(e.target.dataset.permissions), null, 2);
                editApiKeyModal.classList.remove('hidden');
            });
            actionsCell.appendChild(editBtn);
            const toggleBtn = document.createElement('button');
            toggleBtn.className = `admin-btn toggle-api-key-btn ${k.is_active ? 'delete-btn' : 'secondary-button'}`;
            toggleBtn.textContent = k.is_active ? 'Revogar (Desativar)' : 'Reativar';
            toggleBtn.dataset.keyId = k.key_id;
            toggleBtn.addEventListener('click', async (e) => {
                const action = e.target.textContent.includes('Revogar') ? 'Revogar' : 'Reativar';
                if (confirm(`Tem certeza que deseja ${action.toLowerCase()} a chave ID ${k.key_id}?`)) {
                    try {
                        const r = await apiRequest(`/admin/api_keys/${k.key_id}/toggle_active`, 'POST');
                        alert(r.message);
                        refreshApiKeysList();
                    } catch (err) {}
                }
            });
            actionsCell.appendChild(toggleBtn);
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'admin-btn delete-btn delete-api-key-btn';
            deleteBtn.textContent = 'Deletar';
            deleteBtn.dataset.keyId = k.key_id;
            deleteBtn.dataset.serviceName = k.service_name || "Sem nome";
            deleteBtn.addEventListener('click', async (e) => {
                const keyId = e.target.dataset.keyId;
                const serviceName = e.target.dataset.serviceName;
                if (!confirm(`ZONA DE PERIGO!\n\nTem certeza que deseja DELETAR PERMANENTEMENTE a chave '${serviceName}' (ID: ${keyId})?\n\nEsta ação não pode ser desfeita.`)) return;
                try {
                    const r = await apiRequest(`/admin/api_keys/${keyId}`, 'DELETE');
                    alert(r.message);
                    refreshApiKeysList();
                } catch (err) {}
            });
            actionsCell.appendChild(deleteBtn);
        });
    } catch (error) { 
        apiKeysListBody.innerHTML = `<tr><td colspan="6" style="color:red;">Erro ao carregar chaves.</td></tr>`; 
    }
}

async function refreshTicketsList() {
    if (!ticketStatusFilter) return;

    const status = ticketStatusFilter.value;
    const category = ticketCategoryFilter.value;

    if (ticketsListBody) {
        ticketsListBody.innerHTML = '<tr><td colspan="7">Carregando...</td></tr>';
        try {
            const tickets = await apiRequest(`/admin/support_tickets?status=${status}`);
            ticketsListBody.innerHTML = ''; 
            if (tickets.length === 0) { 
                ticketsListBody.innerHTML = `<tr><td colspan="7">Nenhum ticket do Discord com status '${status}'.</td></tr>`; 
            } else {
                tickets.forEach(t => {
                    const row = ticketsListBody.insertRow();
                    let statusColor = 'var(--success-color)';
                    if (t.status === 'claimed') statusColor = 'var(--accent-orange)';
                    if (t.status === 'closed') statusColor = 'var(--text-secondary)';

                    row.insertCell().textContent = t.ticket_id;
                    row.insertCell().textContent = new Date(t.created_at).toLocaleString('pt-BR');
                    row.insertCell().textContent = `${t.discord_username} (${t.discord_user_id})`;
                    row.insertCell().textContent = t.ticket_type || 'N/A';
                    const statusCell = row.insertCell();
                    statusCell.style.color = statusColor;
                    statusCell.style.fontWeight = 'bold';
                    statusCell.textContent = t.status;
                    row.insertCell().textContent = t.claimed_by_staff_name || 'N/A';
                    row.insertCell().textContent = t.discord_channel_id;
                    });
            }
        } catch (error) { 
            ticketsListBody.innerHTML = `<tr><td colspan="7" style="color:red;">Erro ao carregar tickets do Discord.</td></tr>`; 
        }
    }

    if (webTicketsListBody) {
        webTicketsListBody.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';
        try {
            const params = new URLSearchParams();
            params.append('status', status);
            if (category) {
                params.append('ticket_type', category);
            }
            const tickets = await apiRequest(`/admin/web_tickets?${params.toString()}`);
            webTicketsListBody.innerHTML = ''; 
            if (tickets.length === 0) { 
                webTicketsListBody.innerHTML = `<tr><td colspan="6">Nenhum ticket da Web com status '${status}'.</td></tr>`; 
            } else {
                tickets.forEach(t => {
                    const row = webTicketsListBody.insertRow();
                    let statusColor = 'var(--success-color)';
                    if (t.status === 'user_reply') statusColor = 'var(--accent-orange)';
                    if (t.status === 'admin_reply') statusColor = 'var(--text-secondary)';
                    if (t.status === 'closed') statusColor = 'var(--error-color)';
                    row.insertCell().textContent = t.ticket_id;
                    row.insertCell().textContent = new Date(t.updated_at).toLocaleString('pt-BR');
                    row.insertCell().textContent = `${t.username} (ID: ${t.user_id})`;
                    row.insertCell().textContent = t.subject;
                    row.insertCell().textContent = t.ticket_type;
                    const statusCell = row.insertCell();
                    statusCell.style.color = statusColor;
                    statusCell.style.fontWeight = 'bold';
                    statusCell.textContent = t.status;
                    const actionsCell = row.insertCell();
                    actionsCell.className = 'action-buttons';
                    const viewBtn = document.createElement('button');
                    viewBtn.className = 'admin-btn secondary-button view-web-ticket-btn';
                    viewBtn.textContent = 'Ver/Responder';
                    viewBtn.dataset.id = t.ticket_id;
                    viewBtn.dataset.subject = t.subject;
                    viewBtn.addEventListener('click', (e) => {
                        openWebTicketModal(e.target.dataset.id, e.target.dataset.subject);
                    });
                    actionsCell.appendChild(viewBtn);
                });
            }
        } catch (error) { 
            webTicketsListBody.innerHTML = `<tr><td colspan="6" style="color:red;">Erro ao carregar tickets da Web.</td></tr>`; 
        }
    }
}

async function refreshAlertsList() {
    if (!alertsListBody) return;
    alertsListBody.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';
    try {
        const alerts = await apiRequest('/admin/suspicious_activity');
        alertsListBody.innerHTML = ''; 
        if (alerts.length === 0) { 
            alertsListBody.innerHTML = '<tr><td colspan="4">Nenhum alerta de atividade suspeita.</td></tr>'; 
            return; 
        }
        alerts.forEach(a => {
            const row = alertsListBody.insertRow();
            row.insertCell().textContent = new Date(a.log_timestamp).toLocaleString('pt-BR');
            row.insertCell().textContent = `${a.username || 'N/A'} (ID: ${a.user_id})`;
            row.insertCell().textContent = a.activity_type;
            row.insertCell().textContent = a.details ? JSON.stringify(a.details) : '-';
            });
    } catch (error) { 
        alertsListBody.innerHTML = `<tr><td colspan="4" style="color:red;">Erro ao carregar alertas.</td></tr>`; 
    }
}

async function refreshAnalytics(startTime = null, endTime = null) {
    if(analyticsTotalUsers) analyticsTotalUsers.textContent = '...';
    if(analyticsVerifiedUsers) analyticsVerifiedUsers.textContent = '...';
    if(analyticsBannedUsers) analyticsBannedUsers.textContent = '...';
    if(analyticsTotalCurrency) analyticsTotalCurrency.textContent = '...';
    if(analyticsTotalPremium) analyticsTotalPremium.textContent = '...';
    if(analyticsMonetizationBody) analyticsMonetizationBody.innerHTML = '<tr><td colspan="3">Carregando...</td></tr>';
    if(analyticsGameModesBody) analyticsGameModesBody.innerHTML = '<tr><td colspan="2">Carregando...</td></tr>';
    if(analyticsEconomySourcesBody) analyticsEconomySourcesBody.innerHTML = '<tr><td colspan="3">Carregando...</td></tr>';
    if(analyticsEconomySinksBody) analyticsEconomySinksBody.innerHTML = '<tr><td colspan="3">Carregando...</td></tr>';
    if(analyticsTotalRevenue) analyticsTotalRevenue.textContent = '...';
    if(analyticsTotalSales) analyticsTotalSales.textContent = '...';
    if(analyticsAvgSale) analyticsAvgSale.textContent = '...';


    let queryString = "";
    if (startTime && endTime) {
        queryString = `?start_time=${startTime}&end_time=${endTime}`;
    }

    try {
        const [usersRes, monetizationRes, modesRes, sourcesRes, sinksRes, revenueRes] = await Promise.allSettled([
            apiRequest('/admin/analytics/user_stats'),
            apiRequest(`/admin/analytics/monetization${queryString}`),
            apiRequest(`/admin/analytics/game_modes${queryString}`),
            apiRequest(`/admin/analytics/economy_sources${queryString}`),
            apiRequest(`/admin/analytics/economy_sinks${queryString}`),
            apiRequest(`/admin/analytics/revenue_summary${queryString}`)
        ]);

        if (usersRes.status === 'fulfilled' && usersRes.value) {
            const stats = usersRes.value;
            if(analyticsTotalUsers) analyticsTotalUsers.textContent = stats.total_users;
            if(analyticsVerifiedUsers) analyticsVerifiedUsers.textContent = stats.verified_users;
            if(analyticsBannedUsers) analyticsBannedUsers.textContent = stats.banned_users;
            if(analyticsTotalCurrency) analyticsTotalCurrency.textContent = stats.total_in_game_currency;
            if(analyticsTotalPremium) analyticsTotalPremium.textContent = stats.total_premium_currency;
        } else {
            if(analyticsTotalUsers) analyticsTotalUsers.textContent = 'Erro';
        }

        if (monetizationRes.status === 'fulfilled' && analyticsMonetizationBody) {
            const data = monetizationRes.value;
            analyticsMonetizationBody.innerHTML = '';
            if (data.length === 0) {
                analyticsMonetizationBody.innerHTML = '<tr><td colspan="3">Nenhuma venda registrada neste período.</td></tr>';
            } else {
                data.forEach(item => {
                    const row = analyticsMonetizationBody.insertRow();
                    row.insertCell().textContent = item.product_name;
                    row.insertCell().textContent = item.sales_count;
                    row.insertCell().textContent = item.total_revenue_cents;
                    });
            }
        } else if (analyticsMonetizationBody) {
            analyticsMonetizationBody.innerHTML = '<tr><td colspan="3" style="color:red;">Erro ao carregar dados.</td></tr>';
        }

        if (sourcesRes.status === 'fulfilled' && analyticsEconomySourcesBody) {
            const data = sourcesRes.value;
            analyticsEconomySourcesBody.innerHTML = '';
            if (data.length === 0) {
                analyticsEconomySourcesBody.innerHTML = '<tr><td colspan="3">Nenhum ganho registrado.</td></tr>';
            } else {
                data.forEach(item => {
                    const row = analyticsEconomySourcesBody.insertRow();
                    const type = item.currency_type === 'normal' ? 'Moedas' : 'Cash Premium';
                    const typeClass = item.currency_type === 'normal' ? '' : 'currency-premium';
                    row.insertCell().textContent = item.source;
                    const typeCell = row.insertCell();
                    typeCell.className = typeClass;
                    typeCell.textContent = type;
                    const totalCell = row.insertCell();
                    totalCell.style.color = 'var(--success-color)';
                    totalCell.textContent = `+${item.total_gained}`;
                    });
            }
        } else if (analyticsEconomySourcesBody) {
            analyticsEconomySourcesBody.innerHTML = '<tr><td colspan="3" style="color:red;">Erro ao carregar dados.</td></tr>';
        }

        if (sinksRes.status === 'fulfilled' && analyticsEconomySinksBody) {
            const data = sinksRes.value;
            analyticsEconomySinksBody.innerHTML = '';
            if (data.length === 0) {
                analyticsEconomySinksBody.innerHTML = '<tr><td colspan="3">Nenhum gasto registrado.</td></tr>';
            } else {
                data.forEach(item => {
                    const row = analyticsEconomySinksBody.insertRow();
                    const type = item.currency_type === 'normal' ? 'Moedas' : 'Cash Premium';
                    const typeClass = item.currency_type === 'normal' ? '' : 'currency-premium';

                    row.insertCell().textContent = item.source;

                    const typeCell = row.insertCell();
                    typeCell.className = typeClass;
                    typeCell.textContent = type;

                    const totalCell = row.insertCell();
                    totalCell.style.color = 'var(--error-color)';
                    totalCell.textContent = item.total_spent;
                });
            }
        } else if (analyticsEconomySinksBody) {
            analyticsEconomySinksBody.innerHTML = '<tr><td colspan="3" style="color:red;">Erro ao carregar dados.</td></tr>';
        }

        if (modesRes.status === 'fulfilled' && analyticsGameModesBody) {
            const data = modesRes.value;
            analyticsGameModesBody.innerHTML = '';
            if (data.length === 0) {
                analyticsGameModesBody.innerHTML = '<tr><td colspan="2">Nenhuma partida registrada neste período.</td></tr>';
            } else {
                data.forEach(item => {
                    const row = analyticsGameModesBody.insertRow();
                    row.insertCell().textContent = item.match_type;
                    row.insertCell().textContent = item.matches_played;
                });
            }
        } else if (analyticsGameModesBody) {
            analyticsGameModesBody.innerHTML = '<tr><td colspan="2" style="color:red;">Erro ao carregar dados.</td></tr>';
        }
        
        if (revenueRes.status === 'fulfilled' && revenueRes.value) {
            const summary = revenueRes.value;
            if(analyticsTotalRevenue) analyticsTotalRevenue.textContent = summary.total_revenue_cents;
            if(analyticsTotalSales) analyticsTotalSales.textContent = summary.total_sales_count;
            if(analyticsAvgSale) analyticsAvgSale.textContent = summary.average_sale_cents.toFixed(0);
        } else {
            if(analyticsTotalRevenue) analyticsTotalRevenue.textContent = 'Erro';
            if(analyticsTotalSales) analyticsTotalSales.textContent = 'Erro';
            if(analyticsAvgSale) analyticsAvgSale.textContent = 'Erro';
        }

    } catch (error) {
        console.error("Erro ao carregar analytics:", error);
    }
}

async function loadMaintenanceList() {
    const tbody = document.getElementById('updates-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Carregando lista...</td></tr>';

    try {
        const updates = await apiRequest("/admin/updates");
        tbody.innerHTML = '';

        if (updates.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: #888;">Nenhum agendamento encontrado.</td></tr>';
            return;
        }

        updates.forEach(up => {
            const row = tbody.insertRow();
            
            const startStr = new Date(up.start_time).toLocaleString('pt-BR');
            const endStr = new Date(up.end_time).toLocaleString('pt-BR');
            
            let statusColor = '#888';
            let statusText = up.status.toUpperCase();
            if(up.status === 'active') { statusColor = 'var(--accent-orange)'; statusText += ' (EM ANDAMENTO)'; }
            else if(up.status === 'completed') { statusColor = 'var(--success-color)'; }
            else if(up.status === 'cancelled') { statusColor = 'var(--error-color)'; }
            else if(up.status === 'pending') { statusColor = 'white'; statusText = 'PENDENTE'; }

            row.insertCell().textContent = up.update_id;
            row.insertCell().textContent = up.title;
            row.insertCell().textContent = startStr;
            row.insertCell().textContent = endStr;
            
            const statusCell = row.insertCell();
            statusCell.textContent = statusText;
            statusCell.style.color = statusColor;
            statusCell.style.fontWeight = 'bold';

            const actionsCell = row.insertCell();
            actionsCell.className = 'action-buttons';
            
            if (up.status === 'pending') {
                const cancelBtn = document.createElement('button');
                cancelBtn.textContent = 'Cancelar';
                cancelBtn.className = 'admin-btn delete-btn';
                cancelBtn.style.padding = '4px 8px';
                cancelBtn.style.fontSize = '0.8rem';
                cancelBtn.type = 'button';
                
                cancelBtn.onclick = (e) => {
                    e.preventDefault();
                    cancelUpdate(up.update_id);
                };
                actionsCell.appendChild(cancelBtn);
            } else {
                actionsCell.textContent = '-';
            }
        });

    } catch (error) {
        console.error(error);
        tbody.innerHTML = `<tr><td colspan="6" style="color:red; text-align:center;">Erro: ${error.message}</td></tr>`;
    }
}

async function cancelUpdate(updateId) {
    if (!confirm(`Tem certeza que deseja CANCELAR a manutenção #${updateId}?`)) return;

    try {
        const result = await apiRequest(`/admin/updates/${updateId}/cancel`, 'POST');
        alert(result.message || "Manutenção cancelada.");
        await refreshUpdatesList(); 
    } catch (error) {
        alert(`Erro ao cancelar: ${error.message}`);
    }
}

async function openWebTicketModal(ticketId, subject) {
    if (!webTicketModal) return;
    webTicketModalTitle.textContent = `Ticket ID: ${ticketId} - ${subject}`;
    webTicketMessagesView.innerHTML = '<p>Carregando mensagens...</p>';
    webTicketReplyForm['reply-ticket-id'].value = ticketId;
    webTicketModal.classList.remove('hidden');

    try {
        const messages = await apiRequest(`/admin/web_tickets/${ticketId}/messages`);
        webTicketMessagesView.innerHTML = '';
        if (messages.length === 0) {
            webTicketMessagesView.innerHTML = '<p>Nenhuma mensagem encontrada.</p>';
            return;
        }
        messages.forEach(msg => {
            const sender = msg.admin_username ? `Admin: ${msg.admin_username}` : `Jogador: ${msg.username}`;
            const senderClass = msg.admin_username ? 'chat-admin' : 'chat-user';

            const messageDiv = document.createElement('div');
            messageDiv.className = `web-ticket-message ${senderClass}`;

            const strong = document.createElement('strong');
            strong.textContent = sender;

            const small = document.createElement('small');
            small.appendChild(strong);
            small.appendChild(document.createTextNode(` (${new Date(msg.created_at).toLocaleString('pt-BR')})`));

            const p = document.createElement('p');
            setSafeHTML(p, msg.message_content);

            messageDiv.appendChild(small);
            messageDiv.appendChild(p);
            webTicketMessagesView.appendChild(messageDiv);
        });
        webTicketMessagesView.scrollTop = webTicketMessagesView.scrollHeight;
    } catch (error) {
        webTicketMessagesView.innerHTML = `<p style="color:red;">Erro ao carregar mensagens.</p>`;
    }
}

async function handleWebTicketReply(e) {
    e.preventDefault();
    const ticketId = e.target['reply-ticket-id'].value;
    const message = e.target['web-ticket-reply-message'].value;
    if (!ticketId || !message) return;

    try {
        await apiRequest(`/admin/web_tickets/${ticketId}/reply`, 'POST', { message: message });
        e.target.reset();
        await openWebTicketModal(ticketId, webTicketModalTitle.textContent.split(' - ')[1]);
        refreshTicketsList(); 
    } catch (error) {
        alert(`Erro ao enviar resposta: ${error.message}`);
    }
}

async function refreshOverridesList(itemId) {
    if (!overridesListBody) return;
    overridesListBody.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';
    try {
        const overrides = await apiRequest(`/admin/skin_overrides/${itemId}`);
        overridesListBody.innerHTML = '';
        if (overrides.length === 0) {
            overridesListBody.innerHTML = '<tr><td colspan="4">Nenhum override. Usa fórmula padrão.</td></tr>';
            return;
        }
        overrides.forEach(o => {
            const row = overridesListBody.insertRow();
            row.insertCell().textContent = o.item_id;
            row.insertCell().textContent = `Nível ${o.target_level}`;
            row.insertCell().textContent = `${o.cost_currency} Moedas`;
            
            const actionsCell = row.insertCell();
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'admin-btn delete-btn';
            deleteBtn.textContent = 'X';
            deleteBtn.style.padding = '2px 8px';
            deleteBtn.onclick = async () => {
                if(confirm("Deletar este custo manual?")) {
                    try {
                        await apiRequest(`/admin/skin_overrides/${o.override_id}`, 'DELETE');
                        refreshOverridesList(itemId);
                    } catch(e) {}
                }
            };
            actionsCell.appendChild(deleteBtn);
        });
    } catch (e) {
        overridesListBody.innerHTML = '<tr><td colspan="4" style="color:red">Erro.</td></tr>';
    }
}

function cancelEditCode() {
    document.getElementById('edit-code-id').value = '';
    createCodeForm?.reset();
    document.getElementById('code-form-title').textContent = "Criar Novo Código";
    cancelEditCodeBtn?.classList.add('hidden');
}

function cancelEditIngredient() {
    document.getElementById('edit-ingredient-id').value = '';
    createIngredientForm?.reset();
    document.getElementById('ingredient-form-title').textContent = "Criar Novo Ingrediente";
    cancelEditIngredientBtn?.classList.add('hidden');
}

function cancelEditJudge() {
    document.getElementById('edit-judge-id').value = '';
    createJudgeForm?.reset();
    document.getElementById('judge-form-title').textContent = "Criar Novo Juiz";
    cancelEditJudgeBtn?.classList.add('hidden');
}

function cancelEditRecipe() {
    document.getElementById('edit-recipe-id').value = '';
    createRecipeForm?.reset();
    document.getElementById('recipe-form-title').textContent = "Criar Nova Receita";
    cancelEditRecipeBtn?.classList.add('hidden');
}

function cancelEditSeason() {
    document.getElementById('edit-season-id').value = '';
    createSeasonForm?.reset();
    document.getElementById('season-form-title').textContent = "Criar Nova Temporada";
    cancelEditSeasonBtn?.classList.add('hidden');
}

function cancelEditReward() {
    if (createRewardForm) {
        createRewardForm.reset();
        document.getElementById('reward_level').readOnly = false;
    }
    document.getElementById('reward-form-title').textContent = "Adicionar/Editar Recompensa de Nível";
    cancelEditRewardBtn?.classList.add('hidden');
}

function cancelEditQuest() {
    document.getElementById('edit-quest-id').value = '';
    createQuestForm?.reset();
    document.getElementById('quest-form-title').textContent = "Criar Nova Missão";
    cancelEditQuestBtn?.classList.add('hidden');
}

function cancelEditAch() {
    document.getElementById('edit-ach-id').value = '';
    createAchievementForm?.reset();
    document.getElementById('ach_id').readOnly = false;
    document.getElementById('ach-form-title').textContent = "Criar Nova Conquista";
    cancelEditAchBtn?.classList.add('hidden');
}

function cancelEditGameMode() {
    document.getElementById('gm_mode_key').readOnly = false;
    createGameModeForm?.reset();
    document.getElementById('game-mode-form-title').textContent = "Criar/Editar Modo de Jogo";
    cancelEditGameModeBtn?.classList.add('hidden');
}

function cancelEditLevel() {
    document.getElementById('level_key').readOnly = false;
    createLevelForm?.reset();
    document.getElementById('level-form-title').textContent = "Criar/Editar Nível";
    cancelEditLevelBtn?.classList.add('hidden');
}

function cancelEditItem() {
    document.getElementById('edit-item-id').value = '';
    createItemForm?.reset();
    document.getElementById('item-form-title').textContent = "Criar Novo Item";
    cancelEditItemBtn?.classList.add('hidden');
    hideAbilitiesManager();
    document.getElementById('item-usage-info')?.classList.add('hidden');
}

function cancelEditAbility() {
    document.getElementById('edit-ability-id').value = '';
    createAbilityForm?.reset();
    document.getElementById('ability_mode').value = 'casual';
    document.getElementById('ability_cooldown').value = 0;
    document.getElementById('ability_dmg').value = 0;
    document.getElementById('ability_stun').value = 0;
    document.getElementById('ability-form-title').textContent = "Adicionar Nova Habilidade";
    cancelEditAbilityBtn?.classList.add('hidden');
}

function cancelEditNews() {
    createNewsForm?.reset();
    document.getElementById('edit-news-id').value = '';
    document.getElementById('news-form-title').textContent = "Criar Nova Notícia";
    cancelEditNewsBtn?.classList.add('hidden');
}

function getItemFormData() {
    const form = document.getElementById('create-item-form');
    if (!form) return null;

    let stats_data = null;
    try {
        const val = document.getElementById('item_stats').value;
        if (val) stats_data = JSON.parse(val);
    } catch (e) {
        alert("Erro no JSON de Stats: " + e.message);
        return null;
    }

    const discountDate = document.getElementById('item_discount_expires').value;
    
    return {
        item_name: document.getElementById('item_name').value,
        description: document.getElementById('item_desc').value || null,
        category: document.getElementById('item_category').value || null,
        item_type: document.getElementById('item_type').value,
        rarity: document.getElementById('item_rarity').value,
        gender_lock: document.getElementById('item_gender_lock').value,
        price_normal: parseInt(document.getElementById('item_price_normal').value) || null,
        price_premium: parseInt(document.getElementById('item_price_premium').value) || null,
        image_url: document.getElementById('item_image_url').value || null,
        is_purchasable: document.getElementById('item_is_purchasable').checked,
        asset_key: document.getElementById('asset_key').value || null,
        discount_percent: parseInt(document.getElementById('item_discount_percent').value) || 0,
        discount_expires: discountDate ? new Date(discountDate).toISOString() : null,
        stats: stats_data
    };
}

function getIngredientFormData() {
    const tagsVal = document.getElementById('ing_tags').value;
    const tagsArray = tagsVal ? tagsVal.split(',').map(t => t.trim()).filter(t => t) : null;

    return {
        item_id_link: parseInt(document.getElementById('ing_item_id_link').value),
        name: document.getElementById('ing_name').value,
        is_toxic_raw: document.getElementById('ing_is_toxic_raw').checked,
        needs_cooking: document.getElementById('ing_needs_cooking').checked,
        cook_time_min: parseFloat(document.getElementById('ing_cook_time_min').value) || 0,
        cook_time_max: parseFloat(document.getElementById('ing_cook_time_max').value) || 0,
        is_liquid: document.getElementById('ing_is_liquid').checked,
        attr_alcohol: parseFloat(document.getElementById('ing_attr_alcohol').value) || 0,
        toxicity_on_fail: parseFloat(document.getElementById('ing_toxicity_on_fail').value) || 0,
        tags: tagsArray,
        attr_salty: parseFloat(document.getElementById('ing_attr_salty').value) || 0,
        attr_sweet: parseFloat(document.getElementById('ing_attr_sweet').value) || 0,
        attr_sour: parseFloat(document.getElementById('ing_attr_sour').value) || 0,
        attr_bitter: parseFloat(document.getElementById('ing_attr_bitter').value) || 0,
        attr_umami: parseFloat(document.getElementById('ing_attr_umami').value) || 0,
        attr_texture: parseFloat(document.getElementById('ing_attr_texture').value) || 0,
        attr_aroma: parseFloat(document.getElementById('ing_attr_aroma').value) || 0
    };
}

function getRecipeFormData() {
    let ingredients = [];
    try {
        ingredients = JSON.parse(document.getElementById('recipe_ingredients').value);
        if (!Array.isArray(ingredients)) throw new Error("Deve ser uma lista []");
    } catch (e) {
        alert("Erro no JSON de Ingredientes: " + e.message);
        return null;
    }

    return {
        output_item_id: parseInt(document.getElementById('recipe_output_id').value),
        output_item_quantity: parseInt(document.getElementById('recipe_output_qty').value),
        ingredients: ingredients
    };
}

function getPrepStepFormData() {
    return {
        input_item_id: parseInt(document.getElementById('prep_input_item_id').value),
        prep_type: document.getElementById('prep_type').value.toLowerCase(),
        output_item_id: parseInt(document.getElementById('prep_output_item_id').value),
        duration_seconds: parseFloat(document.getElementById('prep_duration').value),
        required_tool_category: document.getElementById('prep_tool_category').value || null
    };
}

function getJudgeFormData() {
    return {
        name: document.getElementById('judge_name').value,
        pref_attr_1: document.getElementById('judge_pref_1').value,
        pref_attr_2: document.getElementById('judge_pref_2').value
    };
}

async function refreshFeaturedSlotsList() {
    if (!featuredItemsListBody) return;
    featuredItemsListBody.innerHTML = '<tr><td colspan="7">Carregando...</td></tr>';
    try {
        const slots = await apiRequest('/admin/featured_slots');
        featuredItemsListBody.innerHTML = '';
        if (slots.length === 0) {
            featuredItemsListBody.innerHTML = '<tr><td colspan="7">Nenhum slot de destaque criado.</td></tr>';
            return;
        }
        slots.forEach(slot => {
            const row = featuredItemsListBody.insertRow();
            const status = slot.is_active ? `<span style="color:var(--success-color)">Ativo</span>` : `<span style="color:var(--error-color)">Inativo</span>`;
            const expires = slot.expires_at ? new Date(slot.expires_at).toLocaleString('pt-BR') : '-';
            const nameCell = row.insertCell();
            nameCell.textContent = `${slot.display_name} (`;
            const code = document.createElement('code');
            code.textContent = slot.slot_key;
            nameCell.appendChild(code);
            nameCell.appendChild(document.createTextNode(')'));
            row.insertCell().textContent = slot.item_id || '-';
            row.insertCell().textContent = expires;
            row.insertCell().textContent = slot.override_price_normal ?? '-';
            row.insertCell().textContent = slot.override_price_premium ?? '-';
            row.insertCell().innerHTML = status;
            const actionsCell = row.insertCell();
            actionsCell.className = 'action-buttons';
            const slotData = JSON.stringify(slot);
            const editBtn = document.createElement('button');
            editBtn.className = 'admin-btn edit-featured-btn';
            editBtn.textContent = 'Definir Item';
            editBtn.dataset.slot = slotData;
            editBtn.addEventListener('click', (e) => {
                const data = JSON.parse(e.target.dataset.slot);
                document.getElementById('set-featured-item-title').textContent = `Definir Item para Slot: ${data.display_name}`;
                document.getElementById('edit_slot_key').value = data.slot_key;
                document.getElementById('edit_slot_display_name').value = data.display_name;
                document.getElementById('edit_item_id').value = data.item_id || '';
                document.getElementById('edit_override_price_normal').value = data.override_price_normal || '';
                document.getElementById('edit_override_price_premium').value = data.override_price_premium || '';
                document.getElementById('edit_is_active').checked = data.is_active;

                if (data.expires_at) {
                    const date = new Date(data.expires_at);
                    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
                    document.getElementById('edit_expires_at').value = date.toISOString().slice(0, 16);
                } else {
                    document.getElementById('edit_expires_at').value = '';
                }

                setFeaturedItemModal.classList.remove('hidden');
            });
            actionsCell.appendChild(editBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'admin-btn delete-btn delete-featured-btn';
            deleteBtn.textContent = 'Deletar Slot';
            deleteBtn.dataset.key = slot.slot_key;
            deleteBtn.dataset.name = slot.display_name;
            deleteBtn.addEventListener('click', async (e) => {
                const slotKey = e.target.dataset.key;
                const slotName = e.target.dataset.name;
                if (!confirm(`Tem certeza que deseja deletar o SLOT '${slotName}'?\nIsso não deleta o item, apenas o slot.`)) return;
                try {
                    await apiRequest(`/admin/featured_slot/${slotKey}`, 'DELETE');
                    alert("Slot deletado.");
                    refreshFeaturedSlotsList();
                } catch (err) {}
            });
            actionsCell.appendChild(deleteBtn);
        });
    } catch (error) {
        featuredItemsListBody.innerHTML = '<tr><td colspan="7" style="color:red;">Erro ao carregar slots.</td></tr>';
    }
}


document.addEventListener('DOMContentLoaded', () => {
    console.log("Inicializando Painel Admin...");

    function safeAddClick(id, handler) {
        const el = document.getElementById(id);
        if (el) {
            const newEl = el.cloneNode(true);
            el.parentNode.replaceChild(newEl, el);
            newEl.addEventListener('click', (e) => { 
                e.preventDefault(); 
                handler(e); 
            });
        }
    }

    createItemForm = document.getElementById('create-item-form');
    deleteItemForm = document.getElementById('delete-item-form');
    grantCurrencyForm = document.getElementById('grant-currency-form');
    grantPremiumCurrencyForm = document.getElementById('grant-premium-currency-form');
    grantItemForm = document.getElementById('grant-item-form');
    grantVipForm = document.getElementById('grant-vip-form');
    setAdminForm = document.getElementById('set-admin-form');
    setRoleForm = document.getElementById('set-role-form');
    createCodeForm = document.getElementById('create-code-form');
    banUserForm = document.getElementById('ban-user-form');
    unbanUserForm = document.getElementById('unban-user-form');
    createIngredientForm = document.getElementById('create-ingredient-form');
    createJudgeForm = document.getElementById('create-judge-form');
    createRecipeForm = document.getElementById('create-recipe-form');
    createPrepStepForm = document.getElementById('create-prep-step-form');
    createSeasonForm = document.getElementById('create-season-form');
    createRewardForm = document.getElementById('create-reward-form');
    createQuestForm = document.getElementById('create-quest-form');
    createAchievementForm = document.getElementById('create-achievement-form');
    createVipRewardForm = document.getElementById('create-vip-reward-form');
    createOrderForm = document.getElementById('create-order-form');
    createGameModeForm = document.getElementById('create-game-mode-form');
    createLevelForm = document.getElementById('create-level-form');
    editUserForm = document.getElementById('edit-user-form');
    createAbilityForm = document.getElementById('create-ability-form');
    broadcastForm = document.getElementById('broadcast-form');
    createNewsForm = document.getElementById('create-news-form');
    createEventForm = document.getElementById('create-event-form');
    editUserStatsForm = document.getElementById('edit-user-stats-form');
    editUserInventoryForm = document.getElementById('edit-user-inventory-form');
    batchDiscountForm = document.getElementById('batch-discount-form');
    archiveRankingForm = document.getElementById('archive-ranking-form');
    searchTransactionsForm = document.getElementById('search-transactions-form');
    editApiKeyForm = document.getElementById('edit-api-key-form');
    sendMailForm = document.getElementById('send-mail-form');
    sendMassMailForm = document.getElementById('send-mass-mail-form');
    createFeaturedSlotForm = document.getElementById('create-featured-slot-form');
    setFeaturedItemForm = document.getElementById('set-featured-item-form');
    gameSettingsForm = document.getElementById('game-settings-form');
    createDailyRewardForm = document.getElementById('create-daily-reward-form');
    webTicketReplyForm = document.getElementById('web-ticket-reply-form');
    analyticsFilterForm = document.getElementById('analytics-filter-form');
    searchChatLogsForm = document.getElementById('search-chat-logs-form');
    keyLoginForm = document.getElementById('admin-key-login-form');
    createSkinOverrideForm = document.getElementById('create-skin-override-form');
    createUpdateForm = document.getElementById('create-update-form');
    cancelEditCodeBtn = document.getElementById('cancel-edit-code-btn');
    cancelEditIngredientBtn = document.getElementById('cancel-edit-ingredient-btn');
    cancelEditJudgeBtn = document.getElementById('cancel-edit-judge-btn');
    cancelEditRecipeBtn = document.getElementById('cancel-edit-recipe-btn');
    cancelEditSeasonBtn = document.getElementById('cancel-edit-season-btn');
    cancelEditRewardBtn = document.getElementById('cancel-edit-reward-btn');
    cancelEditQuestBtn = document.getElementById('cancel-edit-quest-btn');
    cancelEditAchBtn = document.getElementById('cancel-edit-ach-btn');
    cancelEditGameModeBtn = document.getElementById('cancel-edit-game-mode-btn');
    cancelEditLevelBtn = document.getElementById('cancel-edit-level-btn');
    cancelEditUserBtn = document.getElementById('cancel-edit-user-btn');
    cancelEditItemBtn = document.getElementById('cancel-edit-item-btn');
    cancelEditAbilityBtn = document.getElementById('cancel-edit-ability-btn');
    cancelEditNewsBtn = document.getElementById('cancel-edit-news-btn');
    keyLoginSection = document.getElementById('admin-key-login-section');
    keyLoginError = document.getElementById('admin-key-login-error');
    adminApiKeyInput = document.getElementById('admin-api-key');
    mainContent = document.getElementById('admin-main-content');
    logoutBtn = document.getElementById('admin-logout-btn');
    userListBody = document.getElementById('user-list-body');
    itemListBody = document.getElementById('item-list-body');
    achievementsListBody = document.getElementById('achievements-list-body');
    ingredientsListBody = document.getElementById('ingredients-list-body');
    judgesListBody = document.getElementById('judges-list-body');
    recipesListBody = document.getElementById('recipes-list-body');
    prepStepsListBody = document.getElementById('prep-steps-list-body');
    seasonsListBody = document.getElementById('seasons-list-body');
    rewardsListBody = document.getElementById('rewards-list-body');
    questsListBody = document.getElementById('quests-list-body');
    abilitiesListBody = document.getElementById('abilities-list-body');
    redeemCodesListBody = document.getElementById('redeem-codes-list-body');
    ordersListBody = document.getElementById('orders-list-body');
    gameModesListBody = document.getElementById('game-modes-list-body');
    levelsListBody = document.getElementById('levels-list-body');
    transactionsListBody = document.getElementById('transactions-list-body');
    serversListBody = document.getElementById('servers-list-body');
    apiKeysListBody = document.getElementById('api-keys-list-body');
    ticketsListBody = document.getElementById('tickets-list-body');
    webTicketsListBody = document.getElementById('web-tickets-list-body');
    analyticsMonetizationBody = document.getElementById('analytics-monetization-body');
    featuredItemsListBody = document.getElementById('featured-items-list-body');
    moderationListBody = document.getElementById('moderation-list-body');
    dailyRewardsListBody = document.getElementById('daily-rewards-list-body');
    alertsListBody = document.getElementById('alerts-list-body');
    overridesListBody = document.getElementById('overrides-list-body');
    updatesListBody = document.getElementById('updates-list-body');
    roleIdSelect = document.getElementById('role_id_select');
    bpSeasonSelect = document.getElementById('bp_season_select');
    petAbilitiesManager = document.getElementById('pet-abilities-manager');
    abilityPetName = document.getElementById('ability-pet-name');
    navLinks = document.querySelectorAll('.admin-nav-link');
    adminPages = document.querySelectorAll('.admin-page');
    editUserModal = document.getElementById('edit-user-modal');
    userDetailsModal = document.getElementById('user-details-modal');
    userDetailsLoading = document.getElementById('user-details-loading');
    userDetailsContent = document.getElementById('user-details-content');
    editApiKeyModal = document.getElementById('edit-api-key-modal');
    setFeaturedItemModal = document.getElementById('set-featured-item-modal');
    webTicketModal = document.getElementById('web-ticket-modal');
    webTicketModalTitle = document.getElementById('web-ticket-modal-title');
    webTicketMessagesView = document.getElementById('web-ticket-messages-view');
    const scheduleModal = document.getElementById('schedule-selector-modal');
    const scheduleSelect = document.getElementById('schedule-target-select');
    ticketStatusFilter = document.getElementById('ticket-status-filter');
    ticketCategoryFilter = document.getElementById('ticket-category-filter');
    reportStatusFilter = document.getElementById('report-status-filter');
    analyticsTotalUsers = document.getElementById('analytics-total-users');
    analyticsVerifiedUsers = document.getElementById('analytics-verified-users');
    analyticsBannedUsers = document.getElementById('analytics-banned-users');
    analyticsTotalCurrency = document.getElementById('analytics-total-currency');
    analyticsTotalPremium = document.getElementById('analytics-total-premium');
    analyticsTotalRevenue = document.getElementById('analytics-total-revenue');
    analyticsTotalSales = document.getElementById('analytics-total-sales');
    analyticsAvgSale = document.getElementById('analytics-avg-sale');
    settingsVipStatus = document.getElementById('settings-vip-status');
    toggleVipPurchasesBtn = document.getElementById('toggle-vip-purchases-btn');
    settingsMatchmakingStatus = document.getElementById('settings-matchmaking-status');
    toggleMatchmakingBtn = document.getElementById('toggle-matchmaking-btn');
    settingsDailyLoginStatus = document.getElementById('settings-daily-login-status');
    toggleDailyLoginBtn = document.getElementById('toggle-daily-login-btn');
    resetDailyLoginBtn = document.getElementById('reset-daily-login-btn');
    wipeInventoryBtn = document.getElementById('wipe-inventory-btn');
    wipeStatsBtn = document.getElementById('wipe-stats-btn');
    wipeBattlepassBtn = document.getElementById('wipe-battlepass-btn');

    keyLoginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const key = adminApiKeyInput.value;
        const errorEl = keyLoginError;
        const submitBtn = keyLoginForm.querySelector('button');

        if (!key) { errorEl.textContent = "A chave de API é obrigatória."; return; }

        errorEl.textContent = '';
        submitBtn.disabled = true;
        submitBtn.textContent = "Verificando...";

        sessionStorage.setItem("admin_api_key", key);

        try {
            await apiRequest('/admin/logs?limit=1'); 
            keyLoginSection?.classList.add('hidden');
            mainContent?.classList.remove('hidden');
            loadDashboard();
        } catch (err) {
            sessionStorage.removeItem("admin_api_key");
            errorEl.textContent = `Chave inválida: ${err.message}`;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Entrar";
        }
    });

    logoutBtn?.addEventListener('click', () => {
        sessionStorage.removeItem("admin_api_key");
        keyLoginSection?.classList.remove('hidden');
        mainContent?.classList.add('hidden');
        keyLoginForm?.reset();
    });

    if (sessionStorage.getItem("admin_api_key")) {
        console.log("Auto-login...");
        apiRequest('/admin/logs?limit=1')
            .then(() => {
                keyLoginSection?.classList.add('hidden');
                mainContent?.classList.remove('hidden');
                loadDashboard();
            })
            .catch(() => {
                sessionStorage.removeItem("admin_api_key");
                keyLoginSection?.classList.remove('hidden');
                mainContent?.classList.add('hidden');
            });
    } else {
        keyLoginSection?.classList.remove('hidden');
        mainContent?.classList.add('hidden');
    }

    setupNavigation();
    loadUpdateContextSelector();

    safeAddClick('refresh-dashboard-btn', loadDashboard);
    safeAddClick('refresh-logs-btn', refreshAdminLogs);
    safeAddClick('refresh-users-btn', refreshUserList);
    safeAddClick('refresh-items-btn', refreshItemList);
    safeAddClick('refresh-achievements-btn', refreshAchievementsList);
    safeAddClick('refresh-ingredients-btn', refreshIngredientsList);
    safeAddClick('refresh-judges-btn', refreshJudgesList);
    safeAddClick('refresh-recipes-btn', refreshRecipesList);
    safeAddClick('refresh-prep-steps-btn', refreshPrepStepsList);
    safeAddClick('refresh-seasons-btn', refreshSeasonsList);
    safeAddClick('refresh-vip-rewards-btn', refreshVipRewardsList);
    safeAddClick('refresh-codes-btn', refreshCodesList);
    safeAddClick('refresh-orders-btn', refreshOrdersList);
    safeAddClick('refresh-game-modes-btn', refreshGameModesList);
    safeAddClick('refresh-levels-btn', refreshLevelsList);
    safeAddClick('refresh-servers-btn', refreshServersList);
    safeAddClick('refresh-tickets-btn', refreshTicketsList);
    safeAddClick('refresh-api-keys-btn', refreshApiKeysList);
    safeAddClick('refresh-featured-btn', refreshFeaturedSlotsList);
    safeAddClick('refresh-reports-btn', refreshReportsList);
    safeAddClick('refresh-daily-rewards-btn', refreshDailyRewardsList);
    safeAddClick('refresh-alerts-btn', refreshAlertsList);
    safeAddClick('refresh-news-btn', refreshNewsList);
    safeAddClick('refresh-events-btn', refreshEventsList);
    safeAddClick('refresh-analytics-btn', () => refreshAnalytics());
    safeAddClick('refresh-updates-btn', refreshUpdatesList);
    safeAddClick('btn-refresh-updates', refreshUpdatesList);

    safeAddClick('refresh-overrides-btn', () => {
        const id = document.getElementById('view_overrides_item_id').value;
        if(id) refreshOverridesList(id); else alert("Digite o ID do item.");
    });

    safeAddClick('cancel-edit-code-btn', cancelEditCode);
    safeAddClick('cancel-edit-ingredient-btn', cancelEditIngredient);
    safeAddClick('cancel-edit-judge-btn', cancelEditJudge);
    safeAddClick('cancel-edit-recipe-btn', cancelEditRecipe);
    safeAddClick('cancel-edit-season-btn', cancelEditSeason);
    safeAddClick('cancel-edit-reward-btn', cancelEditReward);
    safeAddClick('cancel-edit-quest-btn', cancelEditQuest);
    safeAddClick('cancel-edit-ach-btn', cancelEditAch);
    safeAddClick('cancel-edit-game-mode-btn', cancelEditGameMode);
    safeAddClick('cancel-edit-level-btn', cancelEditLevel);
    safeAddClick('cancel-edit-user-btn', closeEditUserModal);
    safeAddClick('cancel-edit-item-btn', cancelEditItem);
    safeAddClick('cancel-edit-ability-btn', cancelEditAbility);
    safeAddClick('cancel-edit-news-btn', cancelEditNews);

    safeAddClick('btn-schedule-broadcast', () => {
        const msg = document.getElementById('broadcast_message').value;
        const dur = document.getElementById('broadcast_duration').value;
        if(!msg) { alert("Digite a mensagem."); return; }
        const payload = { message: msg, duration: parseInt(dur) };
        openScheduleModalWithPayload('send_broadcast', payload);
    });

    safeAddClick('btn-schedule-discount', () => {
        const idsText = document.getElementById('batch_item_ids').value;
        const pct = document.getElementById('batch_discount_percent').value;
        const exp = document.getElementById('batch_discount_expires').value;
        if(!idsText || !pct || !exp) { alert("Preencha os campos."); return; }
        const item_ids = idsText.split(/[\s,]+/).map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        const payload = { item_ids: item_ids, discount_percent: parseInt(pct), expires_at: new Date(exp).toISOString() };
        openScheduleModalWithPayload('apply_batch_discount', payload);
    });

    safeAddClick('btn-schedule-featured', () => {
        const slotKey = document.getElementById('edit_slot_key').value;
        const itemId = document.getElementById('edit_item_id').value;
        const priceN = document.getElementById('edit_override_price_normal').value;
        const priceP = document.getElementById('edit_override_price_premium').value;
        const expires = document.getElementById('edit_expires_at').value;
        if(!itemId) { alert("Defina o ID do item."); return; }
        const payload = {
            slot_key: slotKey,
            item_id: parseInt(itemId),
            price_normal: priceN ? parseInt(priceN) : null,
            price_premium: priceP ? parseInt(priceP) : null,
            expires_at: expires ? new Date(expires).toISOString() : null
        };
        document.getElementById('set-featured-item-modal').classList.add('hidden');
        openScheduleModalWithPayload('rotate_featured_slot', payload);
    });

    safeAddClick('btn-schedule-vip-reset', () => {
        if(confirm("Isso agendará o ZERAMENTO de todo o progresso VIP. Confirmar?")) {
            openScheduleModalWithPayload('reset_vip_season', {});
        }
    });

    safeAddClick('btn-confirm-schedule', async () => {
        const select = document.getElementById('schedule-target-select');
        const updateId = select.value;
        if (!updateId || !window.pendingPayload) { alert("Selecione uma atualização."); return; }
        try {
            const queueData = { action_type: window.pendingActionType, payload: window.pendingPayload };
            const r = await apiRequest(`/admin/updates/${updateId}/queue_change`, 'POST', queueData);
            alert(r.message);
            document.getElementById('schedule-selector-modal').classList.add('hidden');
        } catch (err) { alert(err.message); }
    });

    document.getElementById('web-ticket-close-btn')?.addEventListener('click', handleAdminCloseTicket);
    const modalCloseBtns = document.querySelectorAll('.modal-close-btn, .modal-overlay');
    modalCloseBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            if(modal) modal.classList.add('hidden');
        });
    });

    createUpdateForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const titleEl = document.getElementById('upd_title');
        const descEl = document.getElementById('upd_desc');
        const startEl = document.getElementById('upd_start');
        const endEl = document.getElementById('upd_end');
        const broadcastEl = document.getElementById('upd_broadcast');
        const maintEl = document.getElementById('upd_is_maintenance');

        if (!titleEl.value || !startEl.value || !endEl.value) { alert("Preencha os campos obrigatórios."); return; }

        const data = {
            title: titleEl.value,
            description: descEl ? descEl.value : "",
            start_time: new Date(startEl.value).toISOString(),
            end_time: new Date(endEl.value).toISOString(),
            broadcast_message: broadcastEl ? broadcastEl.value : "",
            is_maintenance: maintEl ? maintEl.checked : true
        };

        try {
            const r = await apiRequest('/admin/updates', 'POST', data);
            alert(r.message);
            createUpdateForm.reset();
            refreshUpdatesList();
        } catch(err) { alert(err.message); }
    });

    createItemForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = getItemFormData();
        if (!data) return;
        const editId = document.getElementById('edit-item-id').value;
        const endpoint = editId ? `/admin/update_item/${editId}` : '/admin/create_item';
        const method = editId ? 'PUT' : 'POST';

        if(editId && currentAdminContext !== 'live') { alert("Edições devem ser 'Ao Vivo'."); return; }

        if(!editId) {
            const success = await handleContextAwareSubmit(e, '/admin/create_item', 'POST', data, 'create_item');
            if(success && currentAdminContext === 'live') { cancelEditItem(); refreshItemList(); }
        } else {
            try { const r = await apiRequest(endpoint, method, data); alert(r.message); cancelEditItem(); refreshItemList(); } catch(err){}
        }
    });

    createIngredientForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = getIngredientFormData();
        const editId = document.getElementById('edit-ingredient-id').value;
        if(editId) {
            try { await apiRequest(`/admin/ingredient/${editId}`, 'PUT', data); alert("Ingrediente atualizado!"); cancelEditIngredient(); refreshIngredientsList(); } catch(err){}
        } else {
            const success = await handleContextAwareSubmit(e, '/admin/ingredients', 'POST', data, 'create_ingredient');
            if(success && currentAdminContext === 'live') { cancelEditIngredient(); refreshIngredientsList(); }
        }
    });

    createRecipeForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = getRecipeFormData();
        if(!data) return;
        const editId = document.getElementById('edit-recipe-id').value;
        if(editId) {
            try { await apiRequest(`/admin/recipe/${editId}`, 'PUT', data); alert("Receita atualizada!"); cancelEditRecipe(); refreshRecipesList(); } catch(err){}
        } else {
            const success = await handleContextAwareSubmit(e, '/admin/recipes', 'POST', data, 'create_recipe');
            if(success && currentAdminContext === 'live') { cancelEditRecipe(); refreshRecipesList(); }
        }
    });

    createPrepStepForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = getPrepStepFormData();
        if(data.input_item_id === data.output_item_id) { alert("Entrada e Saída não podem ser iguais."); return; }
        const success = await handleContextAwareSubmit(e, '/admin/prep_step', 'POST', data, 'create_prep_step');
        if(success && currentAdminContext === 'live') refreshPrepStepsList();
    });

    createJudgeForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = getJudgeFormData();
        const editId = document.getElementById('edit-judge-id').value;
        if(editId) {
            try { await apiRequest(`/admin/judge/${editId}`, 'PUT', data); alert("Juiz atualizado!"); cancelEditJudge(); refreshJudgesList(); } catch(err){}
        } else {
            const success = await handleContextAwareSubmit(e, '/admin/judges', 'POST', data, 'create_judge');
            if(success && currentAdminContext === 'live') { cancelEditJudge(); refreshJudgesList(); }
        }
    });

    createAbilityForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const itemId = parseInt(document.getElementById('ability_item_id').value);
        const editId = e.target['edit-ability-id'].value;
        if (!itemId) { alert("Selecione um pet."); return; }
        
        const data = {
            item_id: itemId,
            mode: e.target.ability_mode.value,
            ability_name: e.target.ability_name.value,
            logic_key: e.target.ability_logic_key.value,
            description: e.target.ability_description.value || null,
            cooldown_seconds: parseFloat(e.target.ability_cooldown.value) || 0,
            damage: parseFloat(e.target.ability_dmg.value) || 0,
            stun_duration_seconds: parseFloat(e.target.ability_stun.value) || 0,
            carry_capacity_small: parseInt(e.target.ability_carry_s.value) || 0,
            carry_capacity_large: parseInt(e.target.ability_carry_l.value) || 0
        };

        if(editId) {
            try { await apiRequest(`/admin/ability/${editId}`, 'PUT', data); alert("Habilidade atualizada!"); cancelEditAbility(); refreshAbilitiesList(itemId); } catch(err){}
        } else {
            const success = await handleContextAwareSubmit(e, '/admin/abilities', 'POST', data, 'create_ability');
            if(success && currentAdminContext === 'live') { cancelEditAbility(); document.getElementById('ability_item_id').value = itemId; refreshAbilitiesList(itemId); }
        }
    });

    gameSettingsForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = collectSettingsData();
        if (!data) return;
        const success = await handleContextAwareSubmit(e, '/admin/settings/game_config', 'PUT', data, 'update_game_settings');
        if(success && currentAdminContext === 'live') loadSystemSettings();
    });

    broadcastForm?.addEventListener('submit', handleBroadcastSubmit);
    createNewsForm?.addEventListener('submit', handleNewsSubmit);
    createEventForm?.addEventListener('submit', handleEventSubmit);
    editUserStatsForm?.addEventListener('submit', handleEditUserStatsSubmit);
    editUserInventoryForm?.addEventListener('submit', handleEditUserInventorySubmit);
    webTicketReplyForm?.addEventListener('submit', handleWebTicketReply);
    analyticsFilterForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const start = e.target.analytics_start_time.value;
        const end = e.target.analytics_end_time.value;
        refreshAnalytics(start ? new Date(start).toISOString() : null, end ? new Date(end).toISOString() : null);
    });
    
    deleteItemForm?.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const id = parseInt(e.target.delete_item_id.value);
        if(!isNaN(id)) { await deleteItemById(id, `ID ${id}`); e.target.reset(); }
    });
    grantCurrencyForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try { await apiRequest('/admin/grant_currency', 'POST', { username: e.target.grant_username.value, amount: parseInt(e.target.grant_amount.value) }); alert("Sucesso"); e.target.reset(); refreshUserList(); } catch(err){}
    });
    grantPremiumCurrencyForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try { await apiRequest('/admin/grant_premium_currency', 'POST', { username: e.target.grant_premium_username.value, amount: parseInt(e.target.grant_premium_amount.value) }); alert("Sucesso"); e.target.reset(); refreshUserList(); } catch(err){}
    });
    grantItemForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try { await apiRequest('/admin/grant_item', 'POST', { username: e.target.grant_item_username.value, item_name: e.target.grant_item_name.value, quantity: parseInt(e.target.grant_item_quantity.value) }); alert("Sucesso"); e.target.reset(); } catch(err){}
    });
    setAdminForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try { await apiRequest('/admin/set_admin_role', 'POST', { username: e.target.admin_role_username.value, is_admin: (e.target.admin_role_status.value === 'true') }); alert("Sucesso"); e.target.reset(); refreshUserList(); } catch(err){}
    });
    unbanUserForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = e.target.unban_username.value;
        if (!username) return;
        try { await apiRequest('/admin/unban_user', 'POST', { username: username }); alert("Desbanido"); e.target.reset(); } catch(err){}
    });
    banUserForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = { username: e.target.ban_username.value, reason: e.target.ban_reason.value, duration_hours: parseInt(e.target.ban_duration.value) || null };
        if(!confirm(`Banir ${data.username}?`)) return;
        try { await apiRequest('/admin/ban_user', 'POST', data); alert("Banido"); e.target.reset(); } catch(err){}
    });
    editUserForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userId = e.target['edit-user-id'].value;
        try { await apiRequest(`/admin/user/${userId}/email`, 'PUT', { new_email: e.target['edit-user-email'].value }); alert("Email alterado"); closeEditUserModal(); refreshUserList(); } catch(err){}
    });
    searchTransactionsForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        let params = "";
        if (e.target.search_user_id.value) params = `?user_id=${e.target.search_user_id.value}`;
        else if (e.target.search_username.value) params = `?username=${e.target.search_username.value}`;
        else if (e.target.search_session_id.value) params = `?stripe_session_id=${e.target.search_session_id.value}`;
        refreshTransactionsList(params);
    });
    sendMailForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if(!confirm(`Enviar correio para ${e.target.mail_username.value}?`)) return;
        const data = {
            username: e.target.mail_username.value, subject: e.target.mail_subject.value, message: e.target.mail_message.value,
            reward_currency_normal: parseInt(e.target.mail_reward_currency.value)||0, reward_currency_premium: parseInt(e.target.mail_reward_premium.value)||0,
            reward_item_id: parseInt(e.target.mail_reward_item_id.value)||null, reward_item_quantity: parseInt(e.target.mail_reward_item_quantity.value)||0
        };
        try { await apiRequest('/admin/mailbox/send', 'POST', data); alert("Enviado"); e.target.reset(); } catch(err){}
    });
    sendMassMailForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if(!confirm("Tem certeza que deseja enviar EM MASSA?")) return;
        const data = {
            target_group: e.target.mass_mail_target.value, target_param: e.target.mass_mail_target_param.value,
            subject: e.target.mass_mail_subject.value, message: e.target.mass_mail_message.value,
            reward_currency_normal: parseInt(e.target.mass_mail_reward_currency.value)||0, reward_currency_premium: parseInt(e.target.mass_mail_reward_premium.value)||0,
            reward_item_id: parseInt(e.target.mass_mail_reward_item_id.value)||null, reward_item_quantity: parseInt(e.target.mass_mail_reward_item_quantity.value)||0
        };
        try { await apiRequest('/admin/mailbox/send_mass', 'POST', data); alert("Enviado em massa"); e.target.reset(); } catch(err){}
    });
    setRoleForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = e.target.role_username.value;
        const role_id = parseInt(e.target.role_id_select.value);
        if(!username || isNaN(role_id)) return;
        try {
            const users = await apiRequest('/admin/users');
            const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
            if(user) { await apiRequest(`/admin/user/${user.id}/set_role`, 'POST', { role_id: role_id }); alert("Cargo definido"); refreshUserList(); }
            else alert("Usuário não encontrado");
        } catch(err){}
    });
    
    bpSeasonSelect?.addEventListener('change', (e) => loadSeasonData(e.target.value));
    reportStatusFilter?.addEventListener('change', refreshReportsList);
    ticketStatusFilter?.addEventListener('change', refreshTicketsList);
    ticketCategoryFilter?.addEventListener('change', refreshTicketsList);

    toggleVipPurchasesBtn?.addEventListener('click', async () => {
        if(!confirm("Alternar status de compras VIP?")) return;
        toggleVipPurchasesBtn.disabled = true;
        try { const s = await apiRequest('/admin/settings/toggle_vip', 'POST'); updateSettingsUI(s); } catch(e) { toggleVipPurchasesBtn.disabled = false; }
    });
    toggleMatchmakingBtn?.addEventListener('click', async () => {
        if(!confirm("Alternar status do Matchmaking?")) return;
        toggleMatchmakingBtn.disabled = true;
        try { const s = await apiRequest('/admin/settings/toggle_matchmaking', 'POST'); updateSettingsUI(s); } catch(e) { toggleMatchmakingBtn.disabled = false; }
    });
    toggleDailyLoginBtn?.addEventListener('click', async () => {
        if(!confirm("Alternar status do Daily Login?")) return;
        toggleDailyLoginBtn.disabled = true;
        try { const s = await apiRequest('/admin/settings/toggle_daily_login', 'POST'); updateSettingsUI(s); } catch(e) { toggleDailyLoginBtn.disabled = false; }
    });
    resetDailyLoginBtn?.addEventListener('click', async () => {
        if(!confirm("DANGER: Resetar progresso diário de TODOS?")) return;
        try { const r = await apiRequest('/admin/daily_rewards/reset_all_progress', 'POST'); alert(r.message); } catch(e){}
    });

    if(document.getElementById('tab-set-updates')?.classList.contains('active')) {
        refreshUpdatesList();
    }
});