/* ==========================================================================
   SMART EXPENSE TRACKER - JAVASCRIPT CONTROLLER (SPA LOGIC & PYWEBVIEW BRIDGE)
   ========================================================================== */

// Global state variables
let currentTab = 'dashboard';
let editingTransactionId = null;
let categoryChartInstance = null;
let reportsChartInstance = null;

// Standard Category Lists
const expenseCategories = ["Food", "Rent", "Utilities", "Entertainment", "Travel", "Shopping", "Other"];
const incomeCategories = ["Salary", "Freelance", "Investment", "Other"];
const allCategories = [...new Set([...expenseCategories, ...incomeCategories])];

// DOM elements
const elements = {
    // Navigation & Themes
    navItems: document.querySelectorAll('.nav-item'),
    tabContents: document.querySelectorAll('.tab-content'),
    themeToggle: document.getElementById('theme-toggle'),
    themeToggleIcon: document.querySelector('#theme-toggle i'),
    themeToggleText: document.querySelector('#theme-toggle span'),

    // Summary widgets
    totalBalance: document.getElementById('total-balance'),
    totalIncome: document.getElementById('total-income'),
    totalExpense: document.getElementById('total-expense'),
    recentTransactionsList: document.getElementById('recent-transactions-list'),
    
    // Transactions View
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
    
    // Budgets View
    budgetsGrid: document.getElementById('budgets-grid'),
    btnAddBudget: document.getElementById('btn-add-budget'),
    
    // Reports View
    highestSpendingCategory: document.getElementById('highest-spending-category'),
    avgExpenseValue: document.getElementById('avg-expense-value'),
    savingsRateValue: document.getElementById('savings-rate-value'),
    budgetComplianceStatus: document.getElementById('budget-compliance-status'),
    
    // Settings View
    btnResetDb: document.getElementById('btn-reset-db'),

    // Modals
    txModal: document.getElementById('transaction-modal'),
    txForm: document.getElementById('transaction-form'),
    txIdInput: document.getElementById('tx-id'),
    txAmount: document.getElementById('tx-amount'),
    txCategory: document.getElementById('tx-category'),
    txDate: document.getElementById('tx-date'),
    txNotes: document.getElementById('tx-notes'),
    txTypeRadios: document.getElementsByName('tx-type'),
    btnSubmitTx: document.getElementById('btn-submit-tx'),
    modalTitle: document.getElementById('modal-title'),
    btnCloseTxModal: document.getElementById('btn-close-tx-modal'),
    btnCancelTxModal: document.getElementById('btn-cancel-tx-modal'),
    
    budgetModal: document.getElementById('budget-modal'),
    budgetForm: document.getElementById('budget-form'),
    budgetCategorySelect: document.getElementById('budget-category'),
    budgetAmountInput: document.getElementById('budget-amount'),
    btnCloseBudgetModal: document.getElementById('btn-close-budget-modal'),
    btnCancelBudgetModal: document.getElementById('btn-cancel-budget-modal')
};

// ==========================================================================
// TOAST NOTIFICATIONS
// ==========================================================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-circle-xmark';
    if (type === 'warning') iconClass = 'fa-triangle-exclamation';
    
    toast.innerHTML = `
        <i class="fa-solid ${iconClass}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Animate removal
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 3500);
}

// ==========================================================================
// THEME SWITCHER
// ==========================================================================
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
        elements.themeToggleIcon.className = 'fa-solid fa-sun';
        elements.themeToggleText.textContent = 'Light Mode';
    } else {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
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
        showToast('Switched to Light Mode', 'success');
    } else {
        document.body.classList.replace('light-theme', 'dark-theme');
        elements.themeToggleIcon.className = 'fa-solid fa-moon';
        elements.themeToggleText.textContent = 'Dark Mode';
        localStorage.setItem('theme', 'dark');
        showToast('Switched to Dark Mode', 'success');
    }
    // Redraw charts to match new theme if needed
    if (currentTab === 'dashboard' || currentTab === 'reports') {
        refreshData();
    }
}

// ==========================================================================
// ROUTING / TAB MANAGER
// ==========================================================================
function switchTab(tabId) {
    currentTab = tabId;
    
    // Toggle nav active classes
    elements.navItems.forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Toggle content panes
    elements.tabContents.forEach(pane => {
        if (pane.id === tabId) {
            pane.classList.add('active');
        } else {
            pane.classList.remove('active');
        }
    });

    // Refresh data corresponding to active view
    refreshData();
}

// ==========================================================================
// MODAL MANAGEMENT
// ==========================================================================
function openTxModal(tx = null) {
    // Populate categories select depending on transaction type
    const activeType = tx ? tx.type : 'expense';
    populateCategoryDropdown(activeType);

    // Set Default date to today
    const today = new Date().toISOString().split('T')[0];
    
    if (tx) {
        // Edit mode
        editingTransactionId = tx.id;
        elements.txIdInput.value = tx.id;
        elements.modalTitle.textContent = "Edit Transaction";
        elements.txAmount.value = tx.amount;
        elements.txCategory.value = tx.category;
        elements.txDate.value = tx.date;
        elements.txNotes.value = tx.notes || "";
        
        // Select correct radio
        elements.txTypeRadios.forEach(radio => {
            radio.checked = (radio.value === tx.type);
            const parentLabel = radio.parentElement;
            if (radio.checked) {
                parentLabel.classList.add('active');
            } else {
                parentLabel.classList.remove('active');
            }
        });
    } else {
        // Add mode
        editingTransactionId = null;
        elements.txIdInput.value = "";
        elements.modalTitle.textContent = "Add Transaction";
        elements.txForm.reset();
        elements.txDate.value = today;
        
        // Reset type selectors to default "expense"
        elements.txTypeRadios.forEach(radio => {
            radio.checked = (radio.value === 'expense');
            const parentLabel = radio.parentElement;
            if (radio.value === 'expense') {
                parentLabel.classList.add('active');
            } else {
                parentLabel.classList.remove('active');
            }
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
    // Populate budget categories
    elements.budgetCategorySelect.innerHTML = '';
    expenseCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        elements.budgetCategorySelect.appendChild(option);
    });

    if (category) {
        elements.budgetCategorySelect.value = category;
    }
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

// ==========================================================================
// PYWEBVIEW API INTERACTIONS
// ==========================================================================
async function saveTransaction(e) {
    e.preventDefault();
    
    const amount = parseFloat(elements.txAmount.value);
    const category = elements.txCategory.value;
    const date = elements.txDate.value;
    const notes = elements.txNotes.value;
    let type = 'expense';
    
    elements.txTypeRadios.forEach(radio => {
        if (radio.checked) type = radio.value;
    });

    if (isNaN(amount) || amount <= 0) {
        showToast("Please enter a valid amount greater than zero.", "error");
        return;
    }

    try {
        let result;
        if (editingTransactionId) {
            // Update
            result = await window.pywebview.api.update_transaction(
                editingTransactionId, type, amount, category, date, notes
            );
        } else {
            // Create
            result = await window.pywebview.api.add_transaction(
                type, amount, category, date, notes
            );
        }

        if (result && result.success) {
            showToast(result.message, "success");
            closeTxModal();
            refreshData();
        } else {
            showToast(result.message || "Failed to save transaction.", "error");
        }
    } catch (err) {
        console.error("API error adding transaction:", err);
        showToast("Error communicating with backend database.", "error");
    }
}

async function deleteTransaction(id) {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    
    try {
        const result = await window.pywebview.api.delete_transaction(id);
        if (result && result.success) {
            showToast(result.message, "success");
            refreshData();
        } else {
            showToast(result.message || "Failed to delete transaction.", "error");
        }
    } catch (err) {
        console.error("API error deleting transaction:", err);
        showToast("Error communicating with backend database.", "error");
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
            showToast(result.message, "success");
            closeBudgetModal();
            refreshData();
        } else {
            showToast(result.message || "Failed to save budget.", "error");
        }
    } catch (err) {
        console.error("API error saving budget:", err);
        showToast("Error communicating with backend database.", "error");
    }
}

async function exportCSV() {
    try {
        const result = await window.pywebview.api.export_csv();
        if (result && result.success) {
            if (result.cancelled) {
                showToast("CSV export cancelled.", "warning");
            } else {
                showToast(result.message, "success");
            }
        } else {
            showToast(result.message || "Failed to export data.", "error");
        }
    } catch (err) {
        console.error("CSV Export error:", err);
        showToast("Error saving file. Check write permissions.", "error");
    }
}

async function importCSV() {
    try {
        const result = await window.pywebview.api.import_csv();
        if (result && result.success) {
            if (result.cancelled) {
                showToast("CSV import cancelled.", "warning");
            } else {
                showToast(result.message, "success");
                refreshData();
            }
        } else {
            showToast(result.message || "Failed to import CSV.", "error");
        }
    } catch (err) {
        console.error("CSV Import error:", err);
        showToast("Error reading file or invalid layout.", "error");
    }
}

async function resetDatabase() {
    if (!confirm("CRITICAL WARNING: This will permanently delete ALL transactions and custom budgets. Are you sure you want to continue?")) return;
    
    try {
        const result = await window.pywebview.api.clear_all_data();
        if (result && result.success) {
            showToast(result.message, "success");
            refreshData();
        } else {
            showToast(result.message || "Failed to clear database.", "error");
        }
    } catch (err) {
        console.error("Database reset error:", err);
        showToast("Error clearing database.", "error");
    }
}



// ==========================================================================
// DATA REFRESH & RENDER CONTROLLER
// ==========================================================================
async function refreshData() {
    if (typeof window.pywebview === 'undefined' || !window.pywebview.api) {
        console.warn("PyWebView API not initialized yet.");
        return;
    }

    try {
        // Fetch dashboard stats from backend (reused on multiple tabs)
        const summaryRes = await window.pywebview.api.get_dashboard_summary();
        if (!summaryRes || !summaryRes.success) {
            console.error("Failed fetching summary:", summaryRes.message);
            return;
        }

        const data = summaryRes.data;

        // Render based on active tab
        if (currentTab === 'dashboard') {
            renderDashboard(data);
        } else if (currentTab === 'transactions') {
            loadTransactionsTable();
        } else if (currentTab === 'budgets') {
            renderBudgets(data);
        } else if (currentTab === 'reports') {
            renderReports(data);
        }
    } catch (err) {
        console.error("Database query failed:", err);
    }
}

// --------------------------------------------------------------------------
// DASHBOARD RENDERING
// --------------------------------------------------------------------------
async function renderDashboard(data) {
    // 1. Format Currency Summaries
    elements.totalBalance.textContent = formatCurrency(data.balance);
    elements.totalIncome.textContent = formatCurrency(data.total_income);
    elements.totalExpense.textContent = formatCurrency(data.total_expense);

    // Apply color logic to balance value
    if (data.balance < 0) {
        elements.totalBalance.style.color = "var(--color-expense)";
    } else {
        elements.totalBalance.style.color = "var(--text-primary)";
    }

    // 2. Render Recent Transactions List
    try {
        const txsRes = await window.pywebview.api.get_transactions();
        if (txsRes && txsRes.success) {
            const listContainer = elements.recentTransactionsList;
            listContainer.innerHTML = '';
            
            const recents = txsRes.data.slice(0, 5); // display only 5
            
            if (recents.length === 0) {
                listContainer.innerHTML = `
                    <div class="no-data-placeholder">
                        <i class="fa-solid fa-receipt"></i>
                        <p>No transactions recorded yet.</p>
                    </div>
                `;
            } else {
                recents.forEach(tx => {
                    const li = document.createElement('li');
                    li.className = 'recent-item';
                    
                    const prefix = tx.type === 'income' ? '+' : '-';
                    const amountClass = tx.type === 'income' ? 'income' : 'expense';
                    const dateFormatted = formatDateString(tx.date);
                    
                    li.innerHTML = `
                        <div class="recent-item-desc">
                            <span class="recent-item-title">${tx.notes || tx.category}</span>
                            <span class="recent-item-meta">${tx.category} &bull; ${dateFormatted}</span>
                        </div>
                        <span class="recent-item-amount ${amountClass}">
                            ${prefix}${formatCurrency(tx.amount)}
                        </span>
                    `;
                    listContainer.appendChild(li);
                });
            }
        }
    } catch (err) {
        console.error("Error loading recent transactions:", err);
    }

    // 3. Render Dashboard Chart
    const categories = [];
    const totals = [];
    
    data.category_expenses.forEach(cat => {
        categories.push(cat.category);
        totals.push(cat.total);
    });

    const hasData = totals.length > 0;
    const canvas = document.getElementById('categoryChart');
    const placeholder = document.getElementById('no-chart-data');

    if (hasData) {
        canvas.style.display = 'block';
        placeholder.classList.add('hidden');
        
        const isLightTheme = document.body.classList.contains('light-theme');
        const textLabelColor = isLightTheme ? '#475569' : '#94a3b8';
        const gridBorderColor = isLightTheme ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';

        if (categoryChartInstance) {
            categoryChartInstance.destroy();
        }

        categoryChartInstance = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: categories,
                datasets: [{
                    data: totals,
                    backgroundColor: [
                        '#6366f1', // Indigo
                        '#10b981', // Emerald
                        '#f59e0b', // Amber
                        '#ec4899', // Pink
                        '#3b82f6', // Blue
                        '#8b5cf6', // Purple
                        '#64748b'  // Slate
                    ],
                    borderWidth: isLightTheme ? 2 : 0,
                    borderColor: isLightTheme ? '#ffffff' : 'transparent'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: textLabelColor,
                            font: { family: 'Outfit', size: 11 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ` ${context.label}: ${formatCurrency(context.raw)}`;
                            }
                        }
                    }
                },
                cutout: '65%'
            }
        });
    } else {
        canvas.style.display = 'none';
        placeholder.classList.remove('hidden');
        if (categoryChartInstance) {
            categoryChartInstance.destroy();
            categoryChartInstance = null;
        }
    }
}

// --------------------------------------------------------------------------
// TRANSACTIONS TABLE RENDERING
// --------------------------------------------------------------------------
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
                    
                    const amountPrefix = tx.type === 'income' ? '+' : '-';
                    const amountClass = tx.type === 'income' ? 'income' : 'expense';
                    const badgeClass = tx.type === 'income' ? 'badge-income' : 'badge-expense';
                    
                    tr.innerHTML = `
                        <td>${formatDateString(tx.date)}</td>
                        <td>${tx.category}</td>
                        <td><span class="badge ${badgeClass}">${tx.type}</span></td>
                        <td>${escapeHTML(tx.notes) || '<span class="text-muted">None</span>'}</td>
                        <td class="text-right td-amount ${amountClass}">${amountPrefix}${formatCurrency(tx.amount)}</td>
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
        console.error("Error querying transactions:", err);
    }
}

// JS Helper to load editing
window.editTxInline = async function(id) {
    try {
        const res = await window.pywebview.api.get_transactions();
        if (res && res.success) {
            const tx = res.data.find(t => t.id === id);
            if (tx) {
                openTxModal(tx);
            }
        }
    } catch (err) {
        console.error("Error loading transaction for edit:", err);
    }
};

// --------------------------------------------------------------------------
// BUDGETS RENDERING
// --------------------------------------------------------------------------
function renderBudgets(data) {
    const grid = elements.budgetsGrid;
    grid.innerHTML = '';

    // Standard list of budget values
    expenseCategories.forEach(cat => {
        const budgetLimit = data.budgets[cat] || 0.0;
        
        // Find category total spent in current month
        const catSpentObj = data.category_expenses.find(x => x.category === cat);
        const spent = catSpentObj ? catSpentObj.total : 0.0;
        
        const pct = budgetLimit > 0 ? (spent / budgetLimit) * 100 : 0.0;
        
        let pctText = pct > 0 ? `${pct.toFixed(0)}%` : '0%';
        if (budgetLimit === 0) pctText = "No budget";

        // Determine progress-bar color indicator
        let barClass = 'normal';
        let msgText = 'Under budget';
        let msgClass = 'normal';

        if (budgetLimit > 0) {
            if (pct >= 100) {
                barClass = 'danger';
                msgText = 'Budget exceeded!';
                msgClass = 'danger';
            } else if (pct >= 80) {
                barClass = 'warning';
                msgText = 'Approaching limit';
                msgClass = 'warning';
            }
        } else {
            msgText = 'Set spending goal';
            msgClass = 'muted';
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

// --------------------------------------------------------------------------
// REPORTS RENDERING
// --------------------------------------------------------------------------
function renderReports(data) {
    const isLightTheme = document.body.classList.contains('light-theme');
    const textLabelColor = isLightTheme ? '#475569' : '#94a3b8';
    
    // 1. Fill Summary Panel Metrics
    // Calculate Average monthly expense - since this is a mini project, let's calculate average across available data
    const totalSpent = data.total_expense;
    elements.avgExpenseValue.textContent = formatCurrency(totalSpent);

    // Highest Spending Category
    let highestCat = 'N/A';
    let maxSpent = 0;
    
    data.category_expenses.forEach(cat => {
        if (cat.total > maxSpent) {
            maxSpent = cat.total;
            highestCat = cat.category;
        }
    });
    
    elements.highestSpendingCategory.textContent = highestCat === 'N/A' ? 'N/A' : `${highestCat} (${formatCurrency(maxSpent)})`;

    // Savings Rate (Income - Expenses) / Income * 100
    let savingsRate = 0;
    if (data.total_income > 0) {
        savingsRate = ((data.total_income - data.total_expense) / data.total_income) * 100;
    }
    
    if (data.total_income === 0) {
        elements.savingsRateValue.textContent = '0%';
        elements.savingsRateValue.style.color = 'var(--text-muted)';
    } else if (savingsRate < 0) {
        elements.savingsRateValue.textContent = `${savingsRate.toFixed(1)}%`;
        elements.savingsRateValue.style.color = 'var(--color-expense)';
    } else {
        elements.savingsRateValue.textContent = `${savingsRate.toFixed(1)}%`;
        elements.savingsRateValue.style.color = 'var(--color-income)';
    }

    // 2. Budget Compliance Breakdown List
    const complianceDiv = elements.budgetComplianceStatus;
    complianceDiv.innerHTML = '';

    expenseCategories.forEach(cat => {
        const limit = data.budgets[cat] || 0;
        const catSpentObj = data.category_expenses.find(x => x.category === cat);
        const spent = catSpentObj ? catSpentObj.total : 0;
        
        let complianceTag = 'No Budget';
        let tagClass = 'muted';

        if (limit > 0) {
            if (spent > limit) {
                complianceTag = 'Exceeded';
                tagClass = 'exceeded';
            } else if (spent >= limit * 0.8) {
                complianceTag = 'Warning';
                tagClass = 'warning';
            } else {
                complianceTag = 'OK';
                tagClass = 'ok';
            }
        }

        const row = document.createElement('div');
        row.className = 'compliance-category-row';
        row.innerHTML = `
            <span>${cat}</span>
            <span class="compliance-tag ${tagClass}">${complianceTag}</span>
        `;
        complianceDiv.appendChild(row);
    });

    // 3. Category Comparison Chart
    const canvas = document.getElementById('reportsCategoryChart');
    const categories = [];
    const totals = [];
    const budgetLimits = [];

    expenseCategories.forEach(cat => {
        categories.push(cat);
        const catSpentObj = data.category_expenses.find(x => x.category === cat);
        totals.push(catSpentObj ? catSpentObj.total : 0.0);
        budgetLimits.push(data.budgets[cat] || 0.0);
    });

    if (reportsChartInstance) {
        reportsChartInstance.destroy();
    }

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
                legend: {
                    position: 'top',
                    labels: {
                        color: textLabelColor,
                        font: { family: 'Outfit', size: 11 }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: textLabelColor, font: { family: 'Outfit' } },
                    grid: { color: 'rgba(255,255,255,0.03)' }
                },
                y: {
                    ticks: { color: textLabelColor, font: { family: 'Outfit' } },
                    grid: { color: 'rgba(255,255,255,0.03)' },
                    beginAtZero: true
                }
            }
        }
    });
}

// ==========================================================================
// BOOTSTRAP EVENT LISTENERS & TRIGGERS
// ==========================================================================
function setupEventListeners() {
    // Tab switching
    elements.navItems.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    // Theme toggle
    elements.themeToggle.addEventListener('click', toggleTheme);

    // Modal triggers (Add Transaction buttons)
    document.querySelectorAll('.btn-add-transaction').forEach(btn => {
        btn.addEventListener('click', () => openTxModal());
    });

    // Add budget button
    elements.btnAddBudget.addEventListener('click', () => openBudgetModal());

    // Modal Close actions
    elements.btnCloseTxModal.addEventListener('click', closeTxModal);
    elements.btnCancelTxModal.addEventListener('click', closeTxModal);
    
    elements.btnCloseBudgetModal.addEventListener('click', closeBudgetModal);
    elements.btnCancelBudgetModal.addEventListener('click', closeBudgetModal);

    // Form Submits
    elements.txForm.addEventListener('submit', saveTransaction);
    elements.budgetForm.addEventListener('submit', saveBudget);

    // Radio button changes to swap transaction categories
    elements.txTypeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const selectedType = e.target.value;
            populateCategoryDropdown(selectedType);
            
            // Toggle highlight class on parent label
            elements.txTypeRadios.forEach(r => {
                if (r.checked) {
                    r.parentElement.classList.add('active');
                } else {
                    r.parentElement.classList.remove('active');
                }
            });
        });
    });

    // Filtering inputs (live filters)
    const filtersList = [
        elements.searchInput,
        elements.filterType,
        elements.filterCategory,
        elements.filterStartDate,
        elements.filterEndDate
    ];
    filtersList.forEach(input => {
        input.addEventListener('change', loadTransactionsTable);
    });
    elements.searchInput.addEventListener('input', loadTransactionsTable); // Instant keydown search

    // Reset Filters button
    elements.btnResetFilters.addEventListener('click', () => {
        elements.searchInput.value = '';
        elements.filterType.value = '';
        elements.filterCategory.value = '';
        elements.filterStartDate.value = '';
        elements.filterEndDate.value = '';
        loadTransactionsTable();
        showToast("Filters reset", "success");
    });

    // Settings actions
    elements.btnResetDb.addEventListener('click', resetDatabase);

    // CSV action bindings
    elements.btnExportCSV.addEventListener('click', exportCSV);
    elements.btnImportCSV.addEventListener('click', importCSV);

    // View all on dashboard jumps to transactions tab
    const viewAllBtn = document.querySelector('.btn-view-all');
    if (viewAllBtn) {
        viewAllBtn.addEventListener('click', () => switchTab('transactions'));
    }
}

function initCategorySelectors() {
    // Populate the transaction category list in filters dropdown
    const filterCatSelect = elements.filterCategory;
    filterCatSelect.innerHTML = '<option value="">All Categories</option>';
    allCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        filterCatSelect.appendChild(option);
    });

    // Populate transaction categories in the Set Budget dropdown
    elements.budgetCategorySelect.innerHTML = '';
    expenseCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        elements.budgetCategorySelect.appendChild(option);
    });
}

// ==========================================================================
// STRING & CURRENCY FORMATTERS
// ==========================================================================
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
}

function formatDateString(dateStr) {
    if (!dateStr) return '';
    const dateObj = new Date(dateStr + 'T00:00:00');
    return dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ==========================================================================
// INITIALIZATION ON PYWEBVIEW READY
// ==========================================================================
window.addEventListener('pywebviewready', () => {
    console.log("PyWebView ready, initializing application modules.");
    
    // Bind all handlers
    setupEventListeners();
    
    // Fill option boxes
    initCategorySelectors();
    
    // Refresh stats
    refreshData();
});

// Run theme checker immediately (before wait ready, prevents flash)
initTheme();
