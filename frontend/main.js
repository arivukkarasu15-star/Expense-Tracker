let currentTab = 'dashboard';
let editingTransactionId = null;
let categoryChartInstance = null;
let reportsChartInstance = null;

const expenseCategories = ["Food", "Rent", "Utilities", "Entertainment", "Travel", "Shopping", "Other"];
const incomeCategories = ["Salary", "Freelance", "Investment", "Other"];
const allCategories = [...new Set([...expenseCategories, ...incomeCategories])];

const elements = {
    navItems: document.querySelectorAll('.nav-item'),
    tabContents: document.querySelectorAll('.tab-content'),
    themeToggle: document.getElementById('theme-toggle'),
    themeToggleIcon: document.querySelector('#theme-toggle i'),
    themeToggleText: document.querySelector('#theme-toggle span'),

    totalBalance: document.getElementById('total-balance'),
    totalIncome: document.getElementById('total-income'),
    totalExpense: document.getElementById('total-expense'),
    recentTransactionsList: document.getElementById('recent-transactions-list'),

    transactionsTableBody: document.getElementById('transactions-table-body'),
    noTransactionsPlaceholder: document.getElementById('no-transactions-placeholder'),
    searchInput: document.getElementById('search-input'),
    filterType: document.getElementById('filter-type'),
    filterCategory: document.getElementById('filter-category'),
    filterStartDate: document.getElementById('filter-start-date'),
    filterEndDate: document.getElementById('filter-end-date'),
    btnResetFilters: document.getElementById('btn-reset-filters'),
    btnImportCSV: document.getElementById('btn-import-csv'),
    btnExportCSV: document.getElementById('btn-export-csv'),


    highestSpendingCategory: document.getElementById('highest-spending-category'),
    avgExpenseValue: document.getElementById('avg-expense-value'),
    savingsRateValue: document.getElementById('savings-rate-value'),
    budgetComplianceStatus: document.getElementById('budget-compliance-status'),

    btnResetDb: document.getElementById('btn-reset-db'),

    txModal: document.getElementById('transaction-modal'),
    txForm: document.getElementById('transaction-form'),
    txIdInput: document.getElementById('tx-id'),
    txAmount: document.getElementById('tx-amount'),
    txCategory: document.getElementById('tx-category'),
    txDate: document.getElementById('tx-date'),
    txNotes: document.getElementById('tx-notes'),
    txTypeRadios: Array.from(document.getElementsByName('tx-type')),
    btnSubmitTx: document.getElementById('btn-submit-tx'),
    modalTitle: document.getElementById('modal-title'),
    btnCloseTxModal: document.getElementById('btn-close-tx-modal'),
    btnCancelTxModal: document.getElementById('btn-cancel-tx-modal'),

};

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-circle-xmark';
    if (type === 'warning') iconClass = 'fa-triangle-exclamation';

    toast.innerHTML = `<i class="fa-solid ${iconClass}"></i><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => toast.remove());
    }, 3500);
}

function showConfirm(message, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = `
        <div class="modal-card modal-sm" style="max-width:400px">
            <div class="modal-header"><h3>Confirm</h3></div>
            <div class="modal-form" style="padding:1.5rem">
                <p style="color:var(--text-secondary);margin-bottom:1.5rem">${message}</p>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="confirm-cancel">Cancel</button>
                    <button class="btn btn-danger" id="confirm-ok">Confirm</button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    document.getElementById('confirm-cancel').onclick = () => overlay.remove();
    document.getElementById('confirm-ok').onclick = () => { overlay.remove(); onConfirm(); };
}


function initTheme() {
    const saved = localStorage.getItem('theme') || 'dark';
    if (saved === 'light') {
        document.body.classList.replace('dark-theme', 'light-theme');
        elements.themeToggleIcon.className = 'fa-solid fa-sun';
        elements.themeToggleText.textContent = 'Light Mode';
    } else {
        document.body.classList.replace('light-theme', 'dark-theme');
        elements.themeToggleIcon.className = 'fa-solid fa-moon';
        elements.themeToggleText.textContent = 'Dark Mode';
    }
}

function toggleTheme() {
    if (document.body.classList.contains('dark-theme')) {
        document.body.classList.replace('dark-theme', 'light-theme');
        elements.themeToggleIcon.className = 'fa-solid fa-sun';
        elements.themeToggleText.textContent = 'Light Mode';
        localStorage.setItem('theme', 'light');
        showToast('Switched to Light Mode');
    } else {
        document.body.classList.replace('light-theme', 'dark-theme');
        elements.themeToggleIcon.className = 'fa-solid fa-moon';
        elements.themeToggleText.textContent = 'Dark Mode';
        localStorage.setItem('theme', 'dark');
        showToast('Switched to Dark Mode');
    }
    if (currentTab === 'dashboard' || currentTab === 'reports') refreshData();
}

function switchTab(tabId) {
    currentTab = tabId;
    elements.navItems.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    elements.tabContents.forEach(pane => {
        pane.classList.toggle('active', pane.id === tabId);
    });
    refreshData();
}

function openTxModal(tx = null) {
    const activeType = tx ? tx.type : 'expense';
    populateCategoryDropdown(activeType);
    const today = new Date().toISOString().split('T')[0];

    if (tx) {
        editingTransactionId = tx.id;
        elements.txIdInput.value = tx.id;
        elements.modalTitle.textContent = "Edit Transaction";
        elements.txAmount.value = tx.amount;
        elements.txCategory.value = tx.category;
        elements.txDate.value = tx.date;
        elements.txNotes.value = tx.notes || "";
        elements.txTypeRadios.forEach(radio => {
            radio.checked = (radio.value === tx.type);
            radio.parentElement.classList.toggle('active', radio.checked);
        });
    } else {
        editingTransactionId = null;
        elements.txIdInput.value = "";
        elements.modalTitle.textContent = "Add Transaction";
        elements.txForm.reset();
        elements.txDate.value = today;
        elements.txTypeRadios.forEach(radio => {
            radio.checked = (radio.value === 'expense');
            radio.parentElement.classList.toggle('active', radio.value === 'expense');
        });
    }

    elements.txModal.classList.add('active');
}

function closeTxModal() {
    elements.txModal.classList.remove('active');
    elements.txForm.reset();
    editingTransactionId = null;
}

function openBudgetModal(category = '', amount = '') {
    elements.budgetCategorySelect.innerHTML = '';
    expenseCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        elements.budgetCategorySelect.appendChild(option);
    });
    if (category) elements.budgetCategorySelect.value = category;
    elements.budgetAmountInput.value = amount;
    elements.budgetModal.classList.add('active');
}

function closeBudgetModal() {
    elements.budgetModal.classList.remove('active');
    elements.budgetForm.reset();
}

function populateCategoryDropdown(type) {
    const categories = type === 'income' ? incomeCategories : expenseCategories;
    elements.txCategory.innerHTML = '';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        elements.txCategory.appendChild(option);
    });
}

async function saveTransaction(e) {
    e.preventDefault();

    const amount = parseFloat(elements.txAmount.value);
    const category = elements.txCategory.value;
    const date = elements.txDate.value;
    const notes = elements.txNotes.value;
    const checkedRadio = document.querySelector('input[name="tx-type"]:checked');
    const type = checkedRadio ? checkedRadio.value : 'expense';

    if (isNaN(amount) || amount <= 0) {
        showToast("Please enter a valid amount greater than zero.", "error");
        return;
    }

    try {
        let result;
        if (editingTransactionId) {
            result = await window.pywebview.api.update_transaction(editingTransactionId, type, amount, category, date, notes);
        } else {
            result = await window.pywebview.api.add_transaction(type, amount, category, date, notes);
        }

        if (result && result.success) {
            showToast(result.message);
            closeTxModal();
            setTimeout(() => refreshData(), 200);
        } else {
            showToast(result.message || "Failed to save transaction.", "error");
        }
    } catch (err) {
        showToast("Error communicating with backend.", "error");
    }
}

async function deleteTransaction(id) {
    // confirm() blocked in pywebview - proceed directly
    try {
        const result = await window.pywebview.api.delete_transaction(id);
        if (result && result.success) {
            showToast(result.message);
            refreshData();
        } else {
            showToast(result.message || "Failed to delete.", "error");
        }
    } catch (err) {
        showToast("Error communicating with backend.", "error");
    }
}

async function saveBudget(e) {
    e.preventDefault();
    const category = elements.budgetCategorySelect.value;
    const amount = parseFloat(elements.budgetAmountInput.value);

    if (isNaN(amount) || amount < 0) {
        showToast("Please enter a valid budget limit.", "error");
        return;
    }

    try {
        const result = await window.pywebview.api.set_budget(category, amount);
        if (result && result.success) {
            showToast(result.message);
            closeBudgetModal();
            refreshData();
        } else {
            showToast(result.message || "Failed to save budget.", "error");
        }
    } catch (err) {
        showToast("Error communicating with backend.", "error");
    }
}

async function exportCSV() {
    try {
        const result = await window.pywebview.api.export_csv();
        if (result && result.success) {
            showToast(result.cancelled ? "Export cancelled." : result.message, result.cancelled ? "warning" : "success");
        } else {
            showToast(result.message || "Failed to export.", "error");
        }
    } catch (err) {
        showToast("Error saving file.", "error");
    }
}

async function importCSV() {
    try {
        const result = await window.pywebview.api.import_csv();
        if (result && result.success) {
            if (result.cancelled) {
                showToast("Import cancelled.", "warning");
            } else {
                showToast(result.message);
                refreshData();
            }
        } else {
            showToast(result.message || "Failed to import.", "error");
        }
    } catch (err) {
        showToast("Error reading file.", "error");
    }
}

async function resetDatabase() {
    showConfirm("Delete ALL transactions? This cannot be undone.", async () => {
        try {
            const result = await window.pywebview.api.clear_all_data();
            if (result && result.success) {
                showToast(result.message);
                setTimeout(() => refreshData(), 200);
            } else {
                showToast(result.message || "Failed to clear database.", "error");
            }
        } catch (err) {
            showToast("Error clearing database.", "error");
        }
    });
}

async function refreshData() {
    if (typeof window.pywebview === 'undefined' || !window.pywebview.api) return;

    try {
        const summaryRes = await window.pywebview.api.get_dashboard_summary();
        if (!summaryRes || !summaryRes.success) return;

        const data = summaryRes.data;
        if (currentTab === 'dashboard') renderDashboard(data);
        else if (currentTab === 'transactions') loadTransactionsTable();
        else if (currentTab === 'budgets') renderBudgets(data);
        else if (currentTab === 'reports') renderReports(data);
    } catch (err) {
        console.error("refreshData failed:", err);
    }
}

async function renderDashboard(data) {
    elements.totalBalance.textContent = formatCurrency(data.balance);
    elements.totalIncome.textContent = formatCurrency(data.total_income);
    elements.totalExpense.textContent = formatCurrency(data.total_expense);
    elements.totalBalance.style.color = data.balance < 0 ? "var(--color-expense)" : "var(--text-primary)";

    try {
        const txsRes = await window.pywebview.api.get_transactions();
        if (txsRes && txsRes.success) {
            const listContainer = elements.recentTransactionsList;
            listContainer.innerHTML = '';
            const recents = txsRes.data.slice(0, 5);

            if (recents.length === 0) {
                listContainer.innerHTML = `<div class="no-data-placeholder"><i class="fa-solid fa-receipt"></i><p>No transactions recorded yet.</p></div>`;
            } else {
                recents.forEach(tx => {
                    const li = document.createElement('li');
                    li.className = 'recent-item';
                    const prefix = tx.type === 'income' ? '+' : '-';
                    const amountClass = tx.type === 'income' ? 'income' : 'expense';
                    li.innerHTML = `
                        <div class="recent-item-desc">
                            <span class="recent-item-title">${tx.notes || tx.category}</span>
                            <span class="recent-item-meta">${tx.category} &bull; ${formatDateString(tx.date)}</span>
                        </div>
                        <span class="recent-item-amount ${amountClass}">${prefix}${formatCurrency(tx.amount)}</span>
                    `;
                    listContainer.appendChild(li);
                });
            }
        }
    } catch (err) {
        console.error("Error loading recent transactions:", err);
    }

    const categories = data.category_expenses.map(c => c.category);
    const totals = data.category_expenses.map(c => c.total);
    const hasData = totals.length > 0;
    const canvas = document.getElementById('categoryChart');
    const placeholder = document.getElementById('no-chart-data');

    if (hasData) {
        canvas.style.display = 'block';
        placeholder.classList.add('hidden');
        const isLight = document.body.classList.contains('light-theme');
        const labelColor = isLight ? '#475569' : '#94a3b8';

        if (categoryChartInstance) categoryChartInstance.destroy();

        categoryChartInstance = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: categories,
                datasets: [{
                    data: totals,
                    backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6', '#64748b'],
                    borderWidth: isLight ? 2 : 0,
                    borderColor: isLight ? '#ffffff' : 'transparent'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: labelColor, font: { family: 'Outfit', size: 11 } }
                    },
                    tooltip: {
                        callbacks: { label: ctx => ` ${ctx.label}: ${formatCurrency(ctx.raw)}` }
                    }
                },
                cutout: '65%'
            }
        });
    } else {
        canvas.style.display = 'none';
        placeholder.classList.remove('hidden');
        if (categoryChartInstance) { categoryChartInstance.destroy(); categoryChartInstance = null; }
    }
}

async function loadTransactionsTable() {
    const filters = {
        type: elements.filterType.value,
        category: elements.filterCategory.value,
        start_date: elements.filterStartDate.value,
        end_date: elements.filterEndDate.value,
        search: elements.searchInput.value
    };

    try {
        const res = await window.pywebview.api.get_transactions(filters);
        if (res && res.success) {
            const tbody = elements.transactionsTableBody;
            tbody.innerHTML = '';
            const list = res.data;

            if (list.length === 0) {
                elements.noTransactionsPlaceholder.classList.remove('hidden');
            } else {
                elements.noTransactionsPlaceholder.classList.add('hidden');
                list.forEach(tx => {
                    const tr = document.createElement('tr');
                    const prefix = tx.type === 'income' ? '+' : '-';
                    const amountClass = tx.type === 'income' ? 'income' : 'expense';
                    const badgeClass = tx.type === 'income' ? 'badge-income' : 'badge-expense';
                    tr.innerHTML = `
                        <td>${formatDateString(tx.date)}</td>
                        <td>${tx.category}</td>
                        <td><span class="badge ${badgeClass}">${tx.type}</span></td>
                        <td>${escapeHTML(tx.notes) || '<span class="text-muted">None</span>'}</td>
                        <td class="text-right td-amount ${amountClass}">${prefix}${formatCurrency(tx.amount)}</td>
                        <td class="text-center">
                            <div class="table-actions">
                                <button class="btn-icon-edit" onclick="editTxInline(${tx.id})" title="Edit">
                                    <i class="fa-solid fa-pen-to-square"></i>
                                </button>
                                <button class="btn-icon-delete" onclick="deleteTransaction(${tx.id})" title="Delete">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        }
    } catch (err) {
        console.error("Error loading transactions:", err);
    }
}

window.editTxInline = async function(id) {
    try {
        const res = await window.pywebview.api.get_transactions();
        if (res && res.success) {
            const tx = res.data.find(t => t.id === id);
            if (tx) openTxModal(tx);
        }
    } catch (err) {
        console.error("Error loading transaction for edit:", err);
    }
};

function renderBudgets(data) {
    const grid = elements.budgetsGrid;
    grid.innerHTML = '';

    expenseCategories.forEach(cat => {
        const budgetLimit = data.budgets[cat] || 0.0;
        const catSpent = data.category_expenses.find(x => x.category === cat);
        const spent = catSpent ? catSpent.total : 0.0;
        const pct = budgetLimit > 0 ? (spent / budgetLimit) * 100 : 0.0;

        let pctText = budgetLimit === 0 ? "No budget" : `${pct.toFixed(0)}%`;
        let barClass = 'normal', msgText = 'Under budget', msgClass = 'normal';

        if (budgetLimit > 0) {
            if (pct >= 100) { barClass = 'danger'; msgText = 'Budget exceeded!'; msgClass = 'danger'; }
            else if (pct >= 80) { barClass = 'warning'; msgText = 'Approaching limit'; msgClass = 'warning'; }
        } else {
            msgText = 'Set spending goal'; msgClass = 'muted';
        }

        const card = document.createElement('div');
        card.className = 'card budget-card';
        card.innerHTML = `
            <div class="budget-card-header">
                <span class="budget-category-name">${cat}</span>
                <span class="budget-limit-val">Limit: ${budgetLimit > 0 ? formatCurrency(budgetLimit) : 'Not Set'}</span>
            </div>
            <div class="budget-status-row">
                <span class="budget-spent-val">${formatCurrency(spent)}</span>
                <span class="budget-pct-val">${pctText}</span>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar-fill ${barClass}" style="width: ${Math.min(pct, 100)}%"></div>
            </div>
            <div class="budget-card-footer">
                <span class="budget-message ${msgClass}">${msgText}</span>
                <button class="btn-edit-budget" onclick="openBudgetModal('${cat}', ${budgetLimit})">
                    <i class="fa-solid fa-pen"></i> Set
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function renderReports(data) {
    const isLight = document.body.classList.contains('light-theme');
    const labelColor = isLight ? '#475569' : '#94a3b8';

    elements.avgExpenseValue.textContent = formatCurrency(data.total_expense);

    let highestCat = 'N/A', maxSpent = 0;
    data.category_expenses.forEach(cat => {
        if (cat.total > maxSpent) { maxSpent = cat.total; highestCat = cat.category; }
    });
    elements.highestSpendingCategory.textContent = highestCat === 'N/A' ? 'N/A' : `${highestCat} (${formatCurrency(maxSpent)})`;

    let savingsRate = 0;
    if (data.total_income > 0) savingsRate = ((data.total_income - data.total_expense) / data.total_income) * 100;

    if (data.total_income === 0) {
        elements.savingsRateValue.textContent = '0%';
        elements.savingsRateValue.style.color = 'var(--text-muted)';
    } else {
        elements.savingsRateValue.textContent = `${savingsRate.toFixed(1)}%`;
        elements.savingsRateValue.style.color = savingsRate < 0 ? 'var(--color-expense)' : 'var(--color-income)';
    }

    const complianceDiv = elements.budgetComplianceStatus;
    complianceDiv.innerHTML = '';
    expenseCategories.forEach(cat => {
        const limit = data.budgets[cat] || 0;
        const catSpent = data.category_expenses.find(x => x.category === cat);
        const spent = catSpent ? catSpent.total : 0;
        let tag = 'No Budget', tagClass = 'muted';
        if (limit > 0) {
            if (spent > limit) { tag = 'Exceeded'; tagClass = 'exceeded'; }
            else if (spent >= limit * 0.8) { tag = 'Warning'; tagClass = 'warning'; }
            else { tag = 'OK'; tagClass = 'ok'; }
        }
        const row = document.createElement('div');
        row.className = 'compliance-category-row';
        row.innerHTML = `<span>${cat}</span><span class="compliance-tag ${tagClass}">${tag}</span>`;
        complianceDiv.appendChild(row);
    });

    const canvas = document.getElementById('reportsCategoryChart');
    const categories = [], totals = [], budgetLimits = [];
    expenseCategories.forEach(cat => {
        categories.push(cat);
        const catSpent = data.category_expenses.find(x => x.category === cat);
        totals.push(catSpent ? catSpent.total : 0.0);
        budgetLimits.push(data.budgets[cat] || 0.0);
    });

    if (reportsChartInstance) reportsChartInstance.destroy();

    reportsChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: categories,
            datasets: [
                {
                    label: 'Actual Spending (₹)',
                    data: totals,
                    backgroundColor: 'rgba(99, 102, 241, 0.75)',
                    borderColor: 'var(--color-primary)',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'Budget Limit (₹)',
                    data: budgetLimits,
                    backgroundColor: 'rgba(244, 63, 94, 0.2)',
                    borderColor: 'rgba(244, 63, 94, 0.7)',
                    borderWidth: 1.5,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { color: labelColor, font: { family: 'Outfit', size: 11 } } }
            },
            scales: {
                x: { ticks: { color: labelColor, font: { family: 'Outfit' } }, grid: { color: 'rgba(255,255,255,0.03)' } },
                y: { ticks: { color: labelColor, font: { family: 'Outfit' } }, grid: { color: 'rgba(255,255,255,0.03)' }, beginAtZero: true }
            }
        }
    });
}

function setupEventListeners() {
    elements.navItems.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
    });

    elements.themeToggle.addEventListener('click', toggleTheme);

    document.querySelectorAll('.btn-add-transaction').forEach(btn => {
        btn.addEventListener('click', () => openTxModal());
    });


    elements.btnCloseTxModal.addEventListener('click', closeTxModal);
    elements.btnCancelTxModal.addEventListener('click', closeTxModal);

    elements.txForm.addEventListener('submit', saveTransaction);

    elements.txTypeRadios.forEach(radio => {
        radio.addEventListener('change', e => {
            populateCategoryDropdown(e.target.value);
            elements.txTypeRadios.forEach(r => r.parentElement.classList.toggle('active', r.checked));
        });
    });

    [elements.searchInput, elements.filterType, elements.filterCategory, elements.filterStartDate, elements.filterEndDate]
        .forEach(input => input.addEventListener('change', loadTransactionsTable));
    elements.searchInput.addEventListener('input', loadTransactionsTable);

    elements.btnResetFilters.addEventListener('click', () => {
        elements.searchInput.value = '';
        elements.filterType.value = '';
        elements.filterCategory.value = '';
        elements.filterStartDate.value = '';
        elements.filterEndDate.value = '';
        loadTransactionsTable();
        showToast("Filters reset");
    });

    elements.btnResetDb.addEventListener('click', resetDatabase);
    elements.btnExportCSV.addEventListener('click', exportCSV);
    elements.btnImportCSV.addEventListener('click', importCSV);

    const viewAllBtn = document.querySelector('.btn-view-all');
    if (viewAllBtn) viewAllBtn.addEventListener('click', () => switchTab('transactions'));
}

function initCategorySelectors() {
    const filterCatSelect = elements.filterCategory;
    filterCatSelect.innerHTML = '<option value="">All Categories</option>';
    allCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        filterCatSelect.appendChild(option);
    });

    elements.budgetCategorySelect.innerHTML = '';
    expenseCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        elements.budgetCategorySelect.appendChild(option);
    });
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
}

function formatDateString(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

window.addEventListener('pywebviewready', () => {
    setupEventListeners();
    initCategorySelectors();
});

initTheme();