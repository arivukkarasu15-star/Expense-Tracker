import os
import sys
import webview
from pathlib import Path

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend import database
from backend.tracker import ExpenseTrackerAPI

def main():
    database.init_db()

    api = ExpenseTrackerAPI()

    html_path = os.path.join(project_root, "frontend", "index.html")
    if not os.path.exists(html_path):
        print(f"frontend not found: {html_path}")
        sys.exit(1)

    file_url = Path(html_path).as_uri()

    window = webview.create_window(
        title="Smart Expense Tracker",
        url=file_url,
        js_api=api,
        width=1200,
        height=800,
        min_size=(950, 650),
        background_color="#12131C"
    )

    api.set_window(window)

    def on_loaded():
        # trigger JS refresh after page fully loads
        window.evaluate_js("setTimeout(() => { if(typeof refreshData === 'function') refreshData(); }, 300);")

    window.events.loaded += on_loaded

    webview.start()

if __name__ == "__main__":
    main()