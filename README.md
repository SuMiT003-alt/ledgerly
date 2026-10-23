# Ledgerly

A practical accounting and GST learning desk with connected preparation tools, golden rules, journals, ledgers, four visual theme presets, and randomized practice sessions.

## Run

Requires Python 3.9 or newer. No packages need to be installed.

```bash
python3 server.py
```

On Windows, use `py server.py` from this folder, or double-click `start.bat`.

Open **http://localhost:8765/Ledgerly/**. Keep the server terminal open while using the website. To use a different port: `python3 server.py --port 9000`.

## Learning navigation

The sticky top tabs open one learning screen at a time: **Start here → Golden rules → Journal entries → Ledgers → Trial balance → Profit & Loss → Balance sheet → Tally Prime → GST essentials → Practice**. The Start screen provides a clickable roadmap, eleven saved milestones, and a Continue button that remembers the last topic you used. Previous/Next controls guide you through the sequence.

The top workspace switch keeps **Learn**, **Practice** and **Work** separate. Learn contains the guided accounting lessons, GST lifecycle route, examples and knowledge center. Practice contains GST calculation, invoice building, registration assessment, reconciliation, return preparation, compliance practice, the Document Coach, Tally entry trainer and shortcut desk. Work is the local-first connected business workspace.

## Work mode / connected transaction model

- **Company switcher:** three isolated demo companies are seeded, with company-specific GSTINs, customers, suppliers, products, transactions, notices, documents, month-end tasks and audit records. Add another company from the Work header.
- **Transaction register:** sales, purchases, expenses, credit notes and debit notes can be entered once. A transaction uses the shared GST engine, creates accounting debit/credit lines, contributes to ledgers, return summaries, ITC/reconciliation status and the audit trail.
- **Follow one transaction:** open any Work transaction to see source document → accounting entry → customer/supplier ledger → GST → GSTR-1 or GSTR-2B → ITC/GSTR-3B → liability/payment → document → audit stages. Payment and filing remain user-recorded/official-portal handoffs.
- **Work dashboard:** GSTIN, tax liability, ITC, cash/credit ledger, deadline, notices, monthly sales/purchases, action-required exceptions and a GST Health Score are derived from the active company.
- **Work views:** Overview, Transactions, Masters, GST & returns, Reconciliation, Reports, Month-end lab, Compliance and Audit trail. Reports include receivables ageing, payables ageing, cash flow and settlement recording. The Month-end lab includes source documents, closing adjustments, statements, trial balance and decision checks. The existing Practice Invoice Studio can post an invoice into Work so it becomes part of the same transaction lifecycle.
- **Work guide:** Start with the active company, add one transaction, open Transactions to follow its connected lifecycle, then use Reconciliation and Compliance before the official GST portal handoff. The same four-step guide is open at the top of the Work screen.
- Work data is currently stored in browser local storage so the demo remains usable without authentication. The Python server also creates `data/ledgerly-work.sqlite3` with relational tables for users, companies, GSTINs, financial years, masters, invoices, invoice items, journal entries, ledgers, returns, reconciliation, GST ledgers, tasks, notices, documents and audit logs. `/api/work/health` confirms the schema foundation. An authenticated persistence layer should be added before using sensitive production data.
- **Reports and month-end lab:** Work → Reports shows customer receivables ageing, supplier payables ageing and cash-flow movement. The report includes a local settlement recorder so receipts and payments update the linked balances and audit trail. Work → Month-end lab provides a complete April case with source documents, closing stock, salary/depreciation/insurance adjustments, trial balance, Profit & Loss, balance sheet tie-out and seven decision checks.

## GST workspace

- **GST essentials** teaches the connected cycle: eligibility and REG-01 preparation, invoice and place-of-supply decisions, purchase / GSTR-2B reconciliation, GSTR-1 and GSTR-3B working papers, ledgers, payment review, filing handoff, notices and record keeping.
- **GST calculator** supports intra-state (CGST + SGST), inter-state (IGST), exempt / nil-rated, inclusive / exclusive amounts, discounts and configurable demo rates. GST calculation is shared through `gst-model.js`.
- **Invoice studio** creates an Indian GST invoice preview with seller/buyer GSTINs, HSN/SAC, place of supply and tax split. It saves a browser-local working paper and offers print / PDF through the browser.
- **Reconciliation desk** demonstrates matched, partial, missing, extra and mismatch states; it accepts a simple CSV and exports the filtered review report.
- **Return prep** provides illustrative GSTR-1, GSTR-3B, GSTR-9 and CMP-08 summaries plus a pre-filing checklist. **Registration desk** provides a configurable indicative assessment and REG-01 document plan. **Compliance desk** shows ledger balances, reminders, notices and a portal handoff.
- The GST screens deliberately do not claim to log in, submit returns, generate IRNs, generate e-way bills, pay challans or confirm filing. Those steps link to `https://www.gst.gov.in/` and require the official portal, an authorised API or an approved GSP/ASP integration. OTPs and portal passwords are never requested or stored.
- State selectors in Company Setup and the Registration desk include all 28 Indian states and 8 Union Territories with GST state codes.
- Rates, thresholds, due dates, forms and late-fee / interest rules are presented as configurable or illustrative practice data. Verify current law and portal requirements with official sources or a qualified tax professional.

Exercises stay in place when switching tabs during the same visit. Direct hash links and browser Back/Forward also work. Use arrow keys on the top tabs, or search across all topics with Ctrl+K / Cmd+K. Choose Sage desk, Violet studio, Sunset ledger, or Midnight neon from the top theme picker; the selection is saved on this browser. Focus mode and printing are also available from the top header. `learning-layout.css` styles the focused learning layout.

The Start screen also includes a personal learning dashboard. It reads the local Practice history, shows per-topic accuracy, recommends the next lesson, and keeps a retryable mistake notebook on the same device.

## Practice database

- `data/questions.json`: 200 editable questions, with topics, four choices, correct-answer indexes, and explanations. The `columns` array documents the row format. Answer indexes are zero-based.
- `data/questions.sqlite3`: persistent SQLite database created and seeded when the server starts. The JSON file is the source of truth and synchronizes the database at startup.
- `server.py`: serves the website and reads SQLite to create 10-question sessions. Mixed sessions cover all six topics. Topic-specific sessions are also available.
- Each session has unique questions and shuffled answer choices. The previous session's questions are excluded whenever at least 10 other questions are available.
- Scores and the last 20 completed sessions are saved in the learner's browser on the same origin and device.

Practice examples explicitly state when GST, inventory-cost postings, or a specific accounting method are excluded or assumed.

## Tally Prime and balance-sheet labs

- **Tally Prime lab** (`#tally`): eight voucher guides, official shortcut reference, and a fictional 20-document trading month. Enter the date, voucher, debit/credit ledgers and amounts to post correct entries into the live training Day Book. Enable **Practise keys** while focused inside the trainer to use F4–F9, Alt+F5/Alt+F6, F2, Ctrl+H and Ctrl+A. Alt+C from a ledger field opens practice master creation.
- **Document Coach** (inside `#tally`): upload or drop a Word document (`.docx` or `.doc`), scanned PDF, image, CSV or JSON, or choose a sample invoice. DOCX files use local in-browser Word extraction with a reader fallback; PDFs first use their text layer and then render image-only pages for in-browser OCR; image uploads can also use OCR. The coach classifies likely voucher type, amount, date, party, debit/credit ledgers and Tally groups. Every suggestion is editable, explained step by step, copyable, and can be handed into the Tally voucher trainer. If a legacy `.doc`, scan or OCR/readability step has no usable text, add a short description in the capture box; source content stays in the browser.
- **GST decision desk** (inside the Journal entries learning screen): interactively compare same-state supplies (CGST + SGST), different-state supplies (IGST), and exempt/nil-rated supplies (no GST). Enter a taxable value, rate and sale/purchase type to see the full input/output tax entry and the reason for each tax ledger.
- **Balance sheet lab** (`#balance-sheet`): random sample companies with financial statements calculated from the same 20-document accounting model. Drill into accounts, inspect the profit/closing-stock calculation, download source transactions as CSV, and classify 15 balances.
- `tally-model.js` contains the pure accounting model; `tally-lab.js` drives the learning UI; `tally-lab.css` styles both labs in light and dark modes.
- The case assumes zero opening balances, one stock item at a constant cost, no GST and periodic inventory. Closing-stock valuation and the net-profit transfer are included in the statement calculation. These browser exercises are learning simulations; the CSV is a reference dataset for entering the case in Tally.
- Tally shortcut source: https://help.tallysolutions.com/keyboard-shortcuts-tally-prime/

## API

- `GET /api/practice/bank`: total question count and topic counts.
- `POST /api/practice/session`: JSON body `{"topic":"all","excludeIds":[]}`; returns a randomized session.

Both endpoints also work under `/Ledgerly/api/…`. Use the included server for practice sessions; a generic static HTTP server cannot serve these API routes.

## Public discovery pages

- `gst-calculator.html`: search-friendly GST calculation guide covering CGST, SGST, IGST, inclusive prices and discounts.
- `journal-entry-practice.html`: accounting journal-entry practice guide with debit-credit and ledger explanations.
- `tally-practice.html`: Tally Prime voucher practice guide covering the fictional trading month, Day Book and statement labs.
- `robots.txt` and `sitemap.xml`: public discovery files for the deployed Ledgerly origin. Update the sitemap if the production hostname changes.

These pages are educational entry points into the main app. They do not replace current GST law, official portal guidance or advice from a qualified professional.
