import os
import sys
import webview

# Add project root directory to python path to resolve modules correctly
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend import database
from backend.tracker import ExpenseTrackerAPI

def main():
    # Disable automatic DevTools opening in debug mode (prevents external window)
    webview.settings['OPEN_DEVTOOLS_IN_DEBUG'] = False

    # Initialize SQLite database and tables
    print("[INFO] Initializing SQLite database...")
    database.init_db()

    # Create the API instance
    api = ExpenseTrackerAPI()

    # Determine HTML entry point
    html_path = os.path.join(project_root, "frontend", "index.html")
    if not os.path.exists(html_path):
        print(f"[ERROR] Frontend HTML file not found at: {html_path}")
        sys.exit(1)

    print(f"[INFO] Launching UI window loading: {html_path}")

    # Create native window
    window = webview.create_window(
        title="Smart Expense Tracker",
        url=html_path,
        js_api=api,
        width=1200,
        height=800,
        min_size=(950, 650),
        background_color="#12131C"  # Dark background to match theme before render
    )

    # Link window to API for dialogues
    api.set_window(window)

    # Start PyWebView loop in debug mode to avoid WebView2 threading bugs on Windows,
    # but with DevTools automatic popup disabled via settings above.
    webview.start(debug=True)

if __name__ == "__main__":
    main()
