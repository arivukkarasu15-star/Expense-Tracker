import os
import sqlite3
from datetime import datetime

DB_NAME = "expenses.db"

def get_db_path():
    # Store database in the project root directory
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base_dir, DB_NAME)

def get_connection():
    db_path = get_db_path()
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Create transactions table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
            amount REAL NOT NULL CHECK(amount > 0),
            category TEXT NOT NULL,
            date TEXT NOT NULL,
            notes TEXT
        )
    """)
    
    # Create budgets table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS budgets (
            category TEXT PRIMARY KEY,
            amount REAL NOT NULL CHECK(amount >= 0)
        )
    """)
    
    # Seed default budgets for standard categories if they don't exist
    default_categories = ["Food", "Rent", "Utilities", "Entertainment", "Travel", "Shopping"]
    for cat in default_categories:
        cursor.execute("""
            INSERT OR IGNORE INTO budgets (category, amount)
            VALUES (?, 0.0)
        """, (cat,))
        
    conn.commit()
    conn.close()

def add_transaction(t_type, amount, category, date, notes):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO transactions (type, amount, category, date, notes)
        VALUES (?, ?, ?, ?, ?)
    """, (t_type, amount, category, date, notes))
    conn.commit()
    row_id = cursor.lastrowid
    conn.close()
    return row_id

def get_transactions(filters=None):
    conn = get_connection()
    cursor = conn.cursor()
    
    query = "SELECT * FROM transactions WHERE 1=1"
    params = []
    
    if filters:
        if filters.get("type"):
            query += " AND type = ?"
            params.append(filters["type"])
        if filters.get("category"):
            query += " AND category = ?"
            params.append(filters["category"])
        if filters.get("start_date"):
            query += " AND date >= ?"
            params.append(filters["start_date"])
        if filters.get("end_date"):
            query += " AND date <= ?"
            params.append(filters["end_date"])
        if filters.get("search"):
            query += " AND (notes LIKE ? OR category LIKE ?)"
            search_pattern = f"%{filters['search']}%"
            params.append(search_pattern)
            params.append(search_pattern)
            
    query += " ORDER BY date DESC, id DESC"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    transactions = [dict(row) for row in rows]
    conn.close()
    return transactions

def update_transaction(t_id, t_type, amount, category, date, notes):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE transactions
        SET type = ?, amount = ?, category = ?, date = ?, notes = ?
        WHERE id = ?
    """, (t_type, amount, category, date, notes, t_id))
    conn.commit()
    changes = conn.total_changes
    conn.close()
    return changes > 0

def delete_transaction(t_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM transactions WHERE id = ?", (t_id,))
    conn.commit()
    changes = conn.total_changes
    conn.close()
    return changes > 0

def get_budgets():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM budgets")
    rows = cursor.fetchall()
    budgets = [dict(row) for row in rows]
    conn.close()
    return budgets

def set_budget(category, amount):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO budgets (category, amount)
        VALUES (?, ?)
        ON CONFLICT(category) DO UPDATE SET amount = excluded.amount
    """, (category, amount))
    conn.commit()
    conn.close()
    return True

def delete_budget(category):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM budgets WHERE category = ?", (category,))
    conn.commit()
    changes = conn.total_changes
    conn.close()
    return changes > 0

def get_dashboard_summary():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Total income & total expense
    cursor.execute("""
        SELECT 
            SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
            SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense
        FROM transactions
    """)
    totals_row = cursor.fetchone()
    total_income = totals_row["total_income"] or 0.0
    total_expense = totals_row["total_expense"] or 0.0
    balance = total_income - total_expense
    
    # Category wise expenses for current month
    current_month = datetime.now().strftime("%Y-%m")
    cursor.execute("""
        SELECT category, SUM(amount) as total
        FROM transactions
        WHERE type = 'expense' AND date LIKE ?
        GROUP BY category
    """, (f"{current_month}%",))
    category_expenses = [dict(row) for row in cursor.fetchall()]
    
    # Budgets for comparison
    cursor.execute("SELECT * FROM budgets")
    budgets_dict = {row["category"]: row["amount"] for row in cursor.fetchall()}
    
    conn.close()
    
    return {
        "balance": balance,
        "total_income": total_income,
        "total_expense": total_expense,
        "category_expenses": category_expenses,
        "budgets": budgets_dict,
        "current_month": current_month
    }

def clear_all_data():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM transactions")
    cursor.execute("DELETE FROM budgets")
    
    # Re-initialize default categories
    default_categories = ["Food", "Rent", "Utilities", "Entertainment", "Travel", "Shopping"]
    for cat in default_categories:
        cursor.execute("""
            INSERT OR IGNORE INTO budgets (category, amount)
            VALUES (?, 0.0)
        """, (cat,))
        
    conn.commit()
    conn.close()
    return True
