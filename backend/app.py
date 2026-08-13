import os
import sys
import csv
import sqlite3
import ctypes
import webview
from datetime import datetime
from pathlib import Path

# ============================================================
# Windows: Decouple taskbar identity from python.exe
# ============================================================
if sys.platform == "win32":
    try:
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(
            "AuditFlow.SmartExpenseTracker.App.1"
        )
    except Exception:
        pass

# ============================================================
# Paths
# ============================================================
BASE_DIR     = os.path.dirname(os.path.abspath(__file__))   # .../backend
PROJECT_ROOT = os.path.dirname(BASE_DIR)                    # .../expense_tracker
DB_PATH      = os.path.join(BASE_DIR, "expenses.db")
ICON_PATH    = os.path.join(PROJECT_ROOT, "frontend", "icon.ico")
HTML_PATH    = os.path.join(PROJECT_ROOT, "frontend", "index.html")

# ============================================================
# Database layer
# ============================================================
def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = _connect()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            type     TEXT NOT NULL CHECK(type IN ('income','expense')),
            amount   REAL NOT NULL CHECK(amount > 0),
            category TEXT NOT NULL,
            date     TEXT NOT NULL,
            notes    TEXT
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS budgets (
            category TEXT PRIMARY KEY,
            amount   REAL NOT NULL CHECK(amount >= 0)
        )
    """)
    _seed_budgets(cur)
    conn.commit()
    conn.close()

_DEFAULT_CATEGORIES = ["Food", "Rent", "Utilities", "Entertainment", "Travel", "Shopping", "Other"]

def _seed_budgets(cur):
    for cat in _DEFAULT_CATEGORIES:
        cur.execute("INSERT OR IGNORE INTO budgets (category, amount) VALUES (?, 0.0)", (cat,))

# --- Transactions ---
def db_add_transaction(t_type, amount, category, date, notes):
    conn = _connect()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO transactions (type,amount,category,date,notes) VALUES (?,?,?,?,?)",
        (t_type, amount, category, date, notes)
    )
    conn.commit()
    row_id = cur.lastrowid
    conn.close()
    return row_id

def db_get_transactions(filters=None):
    conn = _connect()
    cur = conn.cursor()
    query, params = "SELECT * FROM transactions WHERE 1=1", []
    if filters:
        if filters.get("type"):
            query += " AND type=?";     params.append(filters["type"])
        if filters.get("category"):
            query += " AND category=?"; params.append(filters["category"])
        if filters.get("start_date"):
            query += " AND date>=?";    params.append(filters["start_date"])
        if filters.get("end_date"):
            query += " AND date<=?";    params.append(filters["end_date"])
        if filters.get("search"):
            query += " AND (notes LIKE ? OR category LIKE ?)"
            p = f"%{filters['search']}%"; params.extend([p, p])
    query += " ORDER BY date DESC, id DESC"
    cur.execute(query, params)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows

def db_update_transaction(t_id, t_type, amount, category, date, notes):
    conn = _connect()
    cur = conn.cursor()
    cur.execute(
        "UPDATE transactions SET type=?,amount=?,category=?,date=?,notes=? WHERE id=?",
        (t_type, amount, category, date, notes, t_id)
    )
    conn.commit()
    changed = conn.total_changes
    conn.close()
    return changed > 0

def db_delete_transaction(t_id):
    conn = _connect()
    cur = conn.cursor()
    cur.execute("DELETE FROM transactions WHERE id=?", (t_id,))
    conn.commit()
    changed = conn.total_changes
    conn.close()
    return changed > 0

# --- Budgets ---
def db_get_budgets():
    conn = _connect()
    cur = conn.cursor()
    cur.execute("SELECT * FROM budgets")
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows

def db_set_budget(category, amount):
    conn = _connect()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO budgets (category, amount) VALUES (?,?)
        ON CONFLICT(category) DO UPDATE SET amount=excluded.amount
    """, (category, amount))
    conn.commit()
    conn.close()
    return True

def db_delete_budget(category):
    conn = _connect()
    cur = conn.cursor()
    cur.execute("DELETE FROM budgets WHERE category=?", (category,))
    conn.commit()
    changed = conn.total_changes
    conn.close()
    return changed > 0

# --- Summary ---
def db_get_dashboard_summary():
    conn = _connect()
    cur = conn.cursor()
    cur.execute("""
        SELECT
            SUM(CASE WHEN type='income'  THEN amount ELSE 0 END) AS total_income,
            SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS total_expense
        FROM transactions
    """)
    row = cur.fetchone()
    total_income  = row["total_income"]  or 0.0
    total_expense = row["total_expense"] or 0.0

    current_month = datetime.now().strftime("%Y-%m")
    cur.execute("""
        SELECT category, SUM(amount) AS total
        FROM transactions
        WHERE type='expense' AND date LIKE ?
        GROUP BY category
    """, (f"{current_month}%",))
    category_expenses = [dict(r) for r in cur.fetchall()]

    cur.execute("SELECT * FROM budgets")
    budgets_dict = {r["category"]: r["amount"] for r in cur.fetchall()}
    conn.close()
    return {
        "balance": total_income - total_expense,
        "total_income": total_income,
        "total_expense": total_expense,
        "category_expenses": category_expenses,
        "budgets": budgets_dict,
        "current_month": current_month,
    }

def db_clear_all_data():
    conn = _connect()
    cur = conn.cursor()
    cur.execute("DELETE FROM transactions")
    cur.execute("DELETE FROM budgets")
    _seed_budgets(cur)
    conn.commit()
    conn.close()
    return True

# ============================================================
# API exposed to JavaScript via PyWebView
# ============================================================
class ExpenseTrackerAPI:
    def __init__(self):
        self.window = None

    def set_window(self, window):
        self.window = window

    # --- Dashboard ---
    def get_dashboard_summary(self):
        try:
            return {"success": True, "data": db_get_dashboard_summary()}
        except Exception as e:
            return {"success": False, "message": str(e)}

    # --- Transactions ---
    def get_transactions(self, filters=None):
        try:
            return {"success": True, "data": db_get_transactions(filters)}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def add_transaction(self, t_type, amount, category, date, notes=""):
        try:
            if t_type not in ("income", "expense"):
                return {"success": False, "message": "Invalid transaction type."}
            amount = float(amount)
            if amount <= 0:
                return {"success": False, "message": "Amount must be greater than zero."}
            if not category:
                return {"success": False, "message": "Category is required."}
            if not date:
                return {"success": False, "message": "Date is required."}
            row_id = db_add_transaction(t_type, amount, category, date, notes)
            return {"success": True, "data": {"id": row_id}, "message": "Transaction added successfully."}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def update_transaction(self, t_id, t_type, amount, category, date, notes=""):
        try:
            t_id = int(t_id)
            if t_type not in ("income", "expense"):
                return {"success": False, "message": "Invalid transaction type."}
            amount = float(amount)
            if amount <= 0:
                return {"success": False, "message": "Amount must be greater than zero."}
            if not category:
                return {"success": False, "message": "Category is required."}
            if not date:
                return {"success": False, "message": "Date is required."}
            if db_update_transaction(t_id, t_type, amount, category, date, notes):
                return {"success": True, "message": "Transaction updated successfully."}
            return {"success": False, "message": "Transaction not found or no changes made."}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def delete_transaction(self, t_id):
        try:
            if db_delete_transaction(int(t_id)):
                return {"success": True, "message": "Transaction deleted successfully."}
            return {"success": False, "message": "Transaction not found."}
        except Exception as e:
            return {"success": False, "message": str(e)}

    # --- Budgets ---
    def get_budgets(self):
        try:
            return {"success": True, "data": db_get_budgets()}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def set_budget(self, category, amount):
        try:
            if not category:
                return {"success": False, "message": "Category is required."}
            amount = float(amount)
            if amount < 0:
                return {"success": False, "message": "Budget limit cannot be negative."}
            db_set_budget(category, amount)
            return {"success": True, "message": f"Budget for {category} set to {amount}."}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def delete_budget(self, category):
        try:
            if db_delete_budget(category):
                return {"success": True, "message": f"Budget for {category} deleted."}
            return {"success": False, "message": "Budget category not found."}
        except Exception as e:
            return {"success": False, "message": str(e)}

    # --- Data management ---
    def clear_all_data(self):
        try:
            db_clear_all_data()
            return {"success": True, "message": "All data cleared successfully."}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def export_csv(self):
        try:
            if not self.window:
                return {"success": False, "message": "Window not available."}
            file_path = self.window.create_file_dialog(
                webview.SAVE_DIALOG,
                save_filename="expenses_export.csv",
                file_types=("CSV Files (*.csv)", "All Files (*.*)")
            )
            if not file_path:
                return {"success": True, "cancelled": True, "message": "Export cancelled."}
            if isinstance(file_path, (tuple, list)):
                if not file_path:
                    return {"success": True, "cancelled": True, "message": "Export cancelled."}
                file_path = file_path[0]
            txs = db_get_transactions()
            with open(file_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(["ID", "Type", "Amount", "Category", "Date", "Notes"])
                for tx in txs:
                    writer.writerow([tx["id"], tx["type"], tx["amount"], tx["category"], tx["date"], tx["notes"]])
            return {"success": True, "message": f"Exported to {os.path.basename(file_path)}"}
        except Exception as e:
            return {"success": False, "message": f"Export failed: {str(e)}"}

    def import_csv(self):
        try:
            if not self.window:
                return {"success": False, "message": "Window not available."}
            file_path = self.window.create_file_dialog(
                webview.OPEN_DIALOG,
                file_types=("CSV Files (*.csv)", "All Files (*.*)")
            )
            if not file_path:
                return {"success": True, "cancelled": True, "message": "Import cancelled."}
            if isinstance(file_path, (tuple, list)):
                if not file_path:
                    return {"success": True, "cancelled": True, "message": "Import cancelled."}
                file_path = file_path[0]
            imported_count = 0
            with open(file_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                if not reader.fieldnames:
                    return {"success": False, "message": "Empty CSV or missing headers."}
                headers = [h.strip().lower() for h in reader.fieldnames]
                required = ["type", "amount", "category", "date"]
                if not all(r in headers for r in required):
                    return {"success": False, "message": f"CSV must have headers: {', '.join(required)}"}
                header_map = {h.strip().lower(): h for h in reader.fieldnames}
                for row in reader:
                    t_type   = row[header_map["type"]].strip().lower()
                    category = row[header_map["category"]].strip()
                    date     = row[header_map["date"]].strip()
                    notes    = row[header_map.get("notes", "")].strip() if "notes" in header_map else ""
                    if t_type not in ("income", "expense"):
                        continue
                    try:
                        amount = float(row[header_map["amount"]].strip())
                        if amount <= 0:
                            continue
                    except ValueError:
                        continue
                    db_add_transaction(t_type, amount, category, date, notes)
                    imported_count += 1
            return {"success": True, "message": f"Imported {imported_count} transactions.", "count": imported_count}
        except Exception as e:
            return {"success": False, "message": f"Import failed: {str(e)}"}

# ============================================================
# Window icon (Win32)
# ============================================================
def _apply_window_icon():
    if sys.platform != "win32" or not os.path.exists(ICON_PATH):
        return
    WM_SETICON, ICON_SMALL, ICON_BIG, IMAGE_ICON, LR_LOADFROMFILE = 0x0080, 0, 1, 1, 0x0010
    user32 = ctypes.windll.user32
    hsmall = user32.LoadImageW(None, ICON_PATH, IMAGE_ICON, 16, 16, LR_LOADFROMFILE)
    hbig   = user32.LoadImageW(None, ICON_PATH, IMAGE_ICON, 32, 32, LR_LOADFROMFILE)
    hwnd   = user32.FindWindowW(None, "Smart Expense Tracker")
    if hwnd:
        if hsmall: user32.SendMessageW(hwnd, WM_SETICON, ICON_SMALL, hsmall)
        if hbig:   user32.SendMessageW(hwnd, WM_SETICON, ICON_BIG,   hbig)

# ============================================================
# Entry point
# ============================================================
def main():
    if not os.path.exists(HTML_PATH):
        print(f"[ERROR] Frontend not found: {HTML_PATH}")
        sys.exit(1)

    init_db()
    api = ExpenseTrackerAPI()

    window = webview.create_window(
        title="Smart Expense Tracker",
        url=Path(HTML_PATH).as_uri(),
        js_api=api,
        width=1200,
        height=800,
        min_size=(950, 650),
        background_color="#12131C",
    )
    api.set_window(window)

    def on_loaded():
        _apply_window_icon()
        window.evaluate_js("setTimeout(() => { if(typeof refreshData === 'function') refreshData(); }, 300);")

    window.events.loaded += on_loaded
    webview.start()

if __name__ == "__main__":
    main()
