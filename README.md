# Smart Expense Tracker

A simple desktop expense tracker built with Python, SQLite, and HTML/CSS/JS.

## How to Run

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Start the app:
   - Double-click `SmartExpenseTracker.vbs` (runs silently in background)
   - Or run `python backend/app.py` in your terminal

## Features
- Track daily income and expenses
- Set monthly category budgets with compliance status
- Visual charts and spending breakdown
- CSV import & export
- 100% offline (data stored locally in SQLite)

## Deploy to Netlify

The browser build is a static site. In the browser, transactions and budgets are stored in that browser's local storage on that device; they are not uploaded to a server or shared between users or devices. CSV import and export are supported. The desktop build continues to use its local SQLite database.

To deploy, connect this repository to Netlify and leave the build command blank. The included `netlify.toml` publishes the `frontend` directory. Each push to the connected branch will trigger a deploy.
