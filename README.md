# Smart Expense Tracker (Desktop GUI App)

A polished, desktop-based personal finance manager built using a hybrid stack of **Python (Backend & Database)** and **HTML/CSS/JS (Frontend)** rendered inside a native OS window. 

The application utilizes **SQLite** for secure data persistence, **PyWebView** to bridge the frontend with Python logic, and **Chart.js** for interactive data visualizations.

---

## Key Features

- **Executive Dashboard**: Get real-time summaries of your net balance, total income, and total expenses. Focuses on the current month's categorical breakdown.
- **Doughnut & Bar Charts**: Seamlessly view how much you spend per category (Food, Utilities, Entertainment, etc.) using interactive charts.
- **Transaction Ledger**: Add, edit, or delete transactions. Filter entries dynamically by date range, income/expense type, categories, and live text search.
- **Smart Budgets**: Establish custom monthly budget thresholds. View visual progress meters that change color (Green $\to$ Yellow $\to$ Red) when approaching or exceeding limits.
- **Native Data Portability**: Export your transactions database to a `.csv` file or import transaction logs from a `.csv` file via native Windows explorer dialogues.
- **Customizable Themes**: Responsive toggle for Dark Theme (default dark slate and indigo layout) and Light Theme.

---

## Project Architecture

```text
expense_tracker/
├── backend/
│   ├── database.py       # SQLite interface, schema creation, and raw CRUD queries
│   ├── tracker.py        # Python-JS API bridge and native file Dialog hooks
│   └── app.py            # Boots PyWebView, setups environment pathing, starts app
├── frontend/
│   ├── index.html        # Single Page Application structure & layout panels
│   ├── css/
│   │   └── style.css     # Dark/Light theme values, glassmorphic UI, animations
│   └── js/
│       └── main.js       # SPA tab router, Chart.js managers, and state controller
├── requirements.txt      # PyWebView dependency definitions
├── run.bat               # Windows batch file for one-click setup and launching
└── README.md             # Project documentation (this file)
```

---

## Prerequisites

- **Python**: Version 3.7 or higher installed.
- **OS**: Windows 10 or 11 (requires Microsoft Edge WebView2, which is pre-installed on modern Windows machines).

---

## Installation & Launching

Setting up and running the application is automated. 

1. **Clone the Repository** (or copy the project folder).
2. **Double-click `run.bat`** in the root directory.

### What `run.bat` does:
- Verifies Python is installed and accessible in the system PATH.
- Creates an isolated Python virtual environment (`.venv`) inside the project folder.
- Activates the virtual environment and updates `pip`.
- Installs the required `pywebview` dependency.
- Boots up the application window.

*Note: For subsequent launches, double-clicking `run.bat` will instantly start the app without re-downloading modules.*

---

## Usage Guide

1. **Set Budgets**: Navigate to **Budgets** and click **Set** on any card to update its monthly threshold limit.
2. **Log Transactions**: Click **Add Transaction** in the top right to log a new expense or income.
3. **Data Import/Export**: Go to the **Transactions** view to back up your records. Click **Export CSV** to open a native Windows File Saver dialogue, or **Import CSV** to ingest transactions.
4. **Clean Slate**: To clear out all records, navigate to **Settings** and click **Clear Database**.
