import csv
import os
import webview
from backend import database

class ExpenseTrackerAPI:
    def __init__(self):
        self.window = None

    def set_window(self, window):
        self.window = window

    def get_dashboard_summary(self):
        try:
            summary = database.get_dashboard_summary()
            return {"success": True, "data": summary}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def get_transactions(self, filters=None):
        try:
            txs = database.get_transactions(filters)
            return {"success": True, "data": txs}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def add_transaction(self, t_type, amount, category, date, notes=""):
        try:
            if not t_type or t_type not in ['income', 'expense']:
                return {"success": False, "message": "Invalid transaction type."}
            try:
                amount = float(amount)
                if amount <= 0:
                    return {"success": False, "message": "Amount must be greater than zero."}
            except ValueError:
                return {"success": False, "message": "Amount must be a valid number."}
            
            if not category:
                return {"success": False, "message": "Category is required."}
            if not date:
                return {"success": False, "message": "Date is required."}

            row_id = database.add_transaction(t_type, amount, category, date, notes)
            return {"success": True, "data": {"id": row_id}, "message": "Transaction added successfully."}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def update_transaction(self, t_id, t_type, amount, category, date, notes=""):
        try:
            try:
                t_id = int(t_id)
            except ValueError:
                return {"success": False, "message": "Invalid transaction ID."}

            if not t_type or t_type not in ['income', 'expense']:
                return {"success": False, "message": "Invalid transaction type."}
            try:
                amount = float(amount)
                if amount <= 0:
                    return {"success": False, "message": "Amount must be greater than zero."}
            except ValueError:
                return {"success": False, "message": "Amount must be a valid number."}
            
            if not category:
                return {"success": False, "message": "Category is required."}
            if not date:
                return {"success": False, "message": "Date is required."}

            updated = database.update_transaction(t_id, t_type, amount, category, date, notes)
            if updated:
                return {"success": True, "message": "Transaction updated successfully."}
            else:
                return {"success": False, "message": "Transaction not found or no changes made."}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def delete_transaction(self, t_id):
        try:
            try:
                t_id = int(t_id)
            except ValueError:
                return {"success": False, "message": "Invalid transaction ID."}

            deleted = database.delete_transaction(t_id)
            if deleted:
                return {"success": True, "message": "Transaction deleted successfully."}
            else:
                return {"success": False, "message": "Transaction not found."}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def get_budgets(self):
        try:
            budgets = database.get_budgets()
            return {"success": True, "data": budgets}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def set_budget(self, category, amount):
        try:
            if not category:
                return {"success": False, "message": "Category is required."}
            try:
                amount = float(amount)
                if amount < 0:
                    return {"success": False, "message": "Budget limit cannot be negative."}
            except ValueError:
                return {"success": False, "message": "Budget limit must be a valid number."}

            database.set_budget(category, amount)
            return {"success": True, "message": f"Budget for {category} set to {amount}."}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def delete_budget(self, category):
        try:
            deleted = database.delete_budget(category)
            if deleted:
                return {"success": True, "message": f"Budget for {category} deleted."}
            else:
                return {"success": False, "message": "Budget category not found."}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def clear_all_data(self):
        try:
            database.clear_all_data()
            return {"success": True, "message": "All data cleared successfully."}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def export_csv(self):
        try:
            if not self.window:
                return {"success": False, "message": "Native window context not loaded."}
            
            file_path = self.window.create_file_dialog(
                webview.SAVE_FILE_DIALOG,
                save_filename="expenses_export.csv",
                file_types=("CSV Files (*.csv)", "All Files (*.*)")
            )
            
            if not file_path:
                return {"success": True, "cancelled": True, "message": "Export cancelled."}
            
            if isinstance(file_path, (tuple, list)):
                if len(file_path) > 0:
                    file_path = file_path[0]
                else:
                    return {"success": True, "cancelled": True, "message": "Export cancelled."}
            
            txs = database.get_transactions()
            with open(file_path, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow(['ID', 'Type', 'Amount', 'Category', 'Date', 'Notes'])
                for tx in txs:
                    writer.writerow([tx['id'], tx['type'], tx['amount'], tx['category'], tx['date'], tx['notes']])
            
            return {"success": True, "message": f"Exported successfully to {os.path.basename(file_path)}"}
        except Exception as e:
            return {"success": False, "message": f"Export failed: {str(e)}"}

    def import_csv(self):
        try:
            if not self.window:
                return {"success": False, "message": "Native window context not loaded."}
                
            file_path = self.window.create_file_dialog(
                webview.OPEN_FILE_DIALOG,
                file_types=("CSV Files (*.csv)", "All Files (*.*)")
            )
            
            if not file_path:
                return {"success": True, "cancelled": True, "message": "Import cancelled."}
                
            if isinstance(file_path, (tuple, list)):
                if len(file_path) > 0:
                    file_path = file_path[0]
                else:
                    return {"success": True, "cancelled": True, "message": "Import cancelled."}
                    
            imported_count = 0
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                
                # Check headers case-insensitively
                if not reader.fieldnames:
                    return {"success": False, "message": "Empty CSV file or missing headers."}
                
                headers = [h.strip().lower() for h in reader.fieldnames]
                required = ['type', 'amount', 'category', 'date']
                
                if not all(req in headers for req in required):
                    return {
                        "success": False, 
                        "message": f"CSV structure invalid. Must contain headers: {', '.join(required)}"
                    }
                
                header_map = {h.strip().lower(): h for h in reader.fieldnames}
                
                for row in reader:
                    t_type = row[header_map['type']].strip().lower()
                    amount_str = row[header_map['amount']].strip()
                    category = row[header_map['category']].strip()
                    date = row[header_map['date']].strip()
                    notes = row[header_map.get('notes', '')].strip() if 'notes' in header_map else ''
                    
                    if t_type not in ['income', 'expense']:
                        continue
                    try:
                        amount = float(amount_str)
                        if amount <= 0:
                            continue
                    except ValueError:
                        continue
                        
                    database.add_transaction(t_type, amount, category, date, notes)
                    imported_count += 1
            
            return {
                "success": True, 
                "message": f"Successfully imported {imported_count} transactions!",
                "count": imported_count
            }
        except Exception as e:
            return {"success": False, "message": f"Import failed: {str(e)}"}
