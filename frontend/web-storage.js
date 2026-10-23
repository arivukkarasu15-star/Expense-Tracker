// Browser storage adapter for the static Netlify build. Desktop builds keep using
// the Python API exposed by pywebview.
(function () {
    if (window.pywebview && window.pywebview.api) return;

    const STORAGE_KEY = 'smart-expense-tracker-v1';
    const defaultCategories = ['Food', 'Rent', 'Utilities', 'Entertainment', 'Travel', 'Shopping', 'Other'];

    function readState() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            return {
                transactions: Array.isArray(saved.transactions) ? saved.transactions : [],
                budgets: saved.budgets && typeof saved.budgets === 'object'
                    ? saved.budgets
                    : Object.fromEntries(defaultCategories.map(category => [category, 0]))
            };
        } catch (_) {
            return { transactions: [], budgets: Object.fromEntries(defaultCategories.map(category => [category, 0])) };
        }
    }

    function saveState(state) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function result(data, message) {
        return { success: true, data, message };
    }

    function filteredTransactions(filters = {}) {
        const search = (filters.search || '').toLowerCase();
        return readState().transactions.filter(tx =>
            (!filters.type || tx.type === filters.type) &&
            (!filters.category || tx.category === filters.category) &&
            (!filters.start_date || tx.date >= filters.start_date) &&
            (!filters.end_date || tx.date <= filters.end_date) &&
            (!search || `${tx.notes || ''} ${tx.category}`.toLowerCase().includes(search))
        ).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    }

    function csvCell(value) {
        const text = String(value == null ? '' : value);
        return `"${text.replace(/"/g, '""')}"`;
    }

    const api = {
        async get_transactions(filters) { return result(filteredTransactions(filters)); },
        async get_dashboard_summary() {
            const state = readState();
            const transactions = state.transactions;
            const total_income = transactions.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
            const total_expense = transactions.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
            const current_month = new Date().toISOString().slice(0, 7);
            const byCategory = {};
            transactions.filter(tx => tx.type === 'expense' && tx.date.startsWith(current_month)).forEach(tx => {
                byCategory[tx.category] = (byCategory[tx.category] || 0) + tx.amount;
            });
            return result({
                balance: total_income - total_expense,
                total_income,
                total_expense,
                category_expenses: Object.entries(byCategory).map(([category, total]) => ({ category, total })),
                budgets: state.budgets,
                current_month
            });
        },
        async add_transaction(type, amount, category, date, notes = '') {
            if (!['income', 'expense'].includes(type) || !(Number(amount) > 0) || !category || !date) {
                return { success: false, message: 'Enter a valid type, amount, category, and date.' };
            }
            const state = readState();
            const id = Date.now() + Math.floor(Math.random() * 1000);
            state.transactions.push({ id, type, amount: Number(amount), category, date, notes: notes || '' });
            saveState(state);
            return result({ id }, 'Transaction added successfully.');
        },
        async update_transaction(id, type, amount, category, date, notes = '') {
            const state = readState();
            const tx = state.transactions.find(item => item.id === Number(id));
            if (!tx) return { success: false, message: 'Transaction not found.' };
            Object.assign(tx, { type, amount: Number(amount), category, date, notes: notes || '' });
            saveState(state);
            return result(null, 'Transaction updated successfully.');
        },
        async delete_transaction(id) {
            const state = readState();
            const originalLength = state.transactions.length;
            state.transactions = state.transactions.filter(tx => tx.id !== Number(id));
            if (state.transactions.length === originalLength) return { success: false, message: 'Transaction not found.' };
            saveState(state);
            return result(null, 'Transaction deleted successfully.');
        },
        async set_budget(category, amount) {
            const state = readState();
            state.budgets[category] = Number(amount);
            saveState(state);
            return result(null, `Budget for ${category} saved.`);
        },
        async delete_budget(category) {
            const state = readState();
            delete state.budgets[category];
            saveState(state);
            return result(null, `Budget for ${category} deleted.`);
        },
        async clear_all_data() {
            saveState({ transactions: [], budgets: Object.fromEntries(defaultCategories.map(category => [category, 0])) });
            return result(null, 'All data cleared successfully.');
        },
        async export_csv() {
            const rows = [['ID', 'Type', 'Amount', 'Category', 'Date', 'Notes'], ...filteredTransactions().map(tx =>
                [tx.id, tx.type, tx.amount, tx.category, tx.date, tx.notes]
            )];
            const blob = new Blob([rows.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'expenses_export.csv';
            link.click();
            URL.revokeObjectURL(link.href);
            return result(null, 'CSV downloaded.');
        },
        async import_csv() {
            return new Promise(resolve => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.csv,text/csv';
                input.onchange = async () => {
                    if (!input.files || !input.files[0]) return resolve({ success: true, cancelled: true });
                    try {
                        const text = await input.files[0].text();
                        const lines = text.split(/\r?\n/).filter(Boolean);
                        const parseRow = line => {
                            const cells = [];
                            let cell = '', quoted = false;
                            for (let i = 0; i < line.length; i++) {
                                if (line[i] === '"' && line[i + 1] === '"' && quoted) { cell += '"'; i++; }
                                else if (line[i] === '"') quoted = !quoted;
                                else if (line[i] === ',' && !quoted) { cells.push(cell); cell = ''; }
                                else cell += line[i];
                            }
                            cells.push(cell);
                            return cells;
                        };
                        const headers = parseRow(lines.shift()).map(value => value.trim().toLowerCase());
                        const positions = Object.fromEntries(headers.map((header, index) => [header, index]));
                        if (!['type', 'amount', 'category', 'date'].every(key => key in positions)) {
                            return resolve({ success: false, message: 'CSV must include type, amount, category, and date columns.' });
                        }
                        const state = readState();
                        let count = 0;
                        lines.forEach(line => {
                            const row = parseRow(line);
                            const type = row[positions.type]?.trim().toLowerCase();
                            const amount = Number(row[positions.amount]);
                            if (!['income', 'expense'].includes(type) || !(amount > 0)) return;
                            state.transactions.push({
                                id: Date.now() + count++, type, amount,
                                category: row[positions.category]?.trim() || 'Other',
                                date: row[positions.date]?.trim() || '',
                                notes: positions.notes === undefined ? '' : row[positions.notes] || ''
                            });
                        });
                        saveState(state);
                        resolve(result(null, `Imported ${count} transactions.`));
                    } catch (_) { resolve({ success: false, message: 'Could not read the selected CSV file.' }); }
                };
                input.oncancel = () => resolve({ success: true, cancelled: true });
                input.click();
            });
        }
    };

    window.pywebview = { api };
    window.expenseTrackerBrowserMode = true;
    window.addEventListener('DOMContentLoaded', () => {
        const subtitle = document.querySelector('#dashboard .subtitle');
        if (subtitle) subtitle.textContent = 'Your data is saved in this browser on this device.';
        window.dispatchEvent(new Event('pywebviewready'));
    }, { once: true });
})();
