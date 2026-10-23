"""Serve Ledgerly and its SQLite-backed practice API using the Python standard library."""

import argparse
from contextlib import closing
import json
from pathlib import Path
import secrets
import sqlite3
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
SEED_PATH = ROOT / "data" / "questions.json"
DB_PATH = ROOT / "data" / "questions.sqlite3"
WORK_DB_PATH = ROOT / "data" / "ledgerly-work.sqlite3"
SESSION_SIZE = 10
WORK_SCHEMA_VERSION = 1
TOPICS = {
    "golden-rules": "Golden rules",
    "debit-credit": "Debit & credit",
    "journal-entries": "Journal entries",
    "ledgers": "Ledgers & balances",
    "tally-prime": "Tally Prime",
    "fundamentals": "Accounting basics",
}


def initialize_database():
    seed = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    rows = seed["questions"]
    ids, prompts = set(), set()
    for row in rows:
        if len(row) != 6:
            raise ValueError("Every question needs six fields.")
        question_id, topic, prompt, options, answer, explanation = row
        if question_id in ids or prompt in prompts:
            raise ValueError(f"Duplicate question: {question_id}")
        if topic not in TOPICS or len(options) != 4 or len(set(options)) != 4:
            raise ValueError(f"Invalid topic or choices: {question_id}")
        if not isinstance(answer, int) or not 0 <= answer < len(options) or not prompt or not explanation:
            raise ValueError(f"Invalid answer or explanation: {question_id}")
        ids.add(question_id)
        prompts.add(prompt)
    if len(rows) < 200:
        raise ValueError("The practice bank must contain at least 200 questions.")

    with closing(sqlite3.connect(DB_PATH)) as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS questions (
                id TEXT PRIMARY KEY,
                topic TEXT NOT NULL,
                question TEXT NOT NULL UNIQUE,
                options TEXT NOT NULL,
                answer INTEGER NOT NULL CHECK (answer BETWEEN 0 AND 3),
                explanation TEXT NOT NULL
            )
        """)
        connection.execute("CREATE INDEX IF NOT EXISTS questions_topic ON questions(topic)")
        # The versioned JSON is the editable source; the persistent SQLite table serves sessions.
        connection.execute("DELETE FROM questions")
        connection.executemany(
            "INSERT INTO questions VALUES (?, ?, ?, ?, ?, ?)",
            [(row[0], row[1], row[2], json.dumps(row[3], ensure_ascii=False), row[4], row[5]) for row in rows],
        )
        connection.commit()
    return len(rows)


def bank_summary():
    with closing(sqlite3.connect(DB_PATH)) as connection:
        counts = dict(connection.execute("SELECT topic, COUNT(*) FROM questions GROUP BY topic"))
    return {
        "total": sum(counts.values()),
        "sessionSize": SESSION_SIZE,
        "topics": [{"id": topic, "label": label, "count": counts.get(topic, 0)} for topic, label in TOPICS.items()],
    }


def create_session(topic, exclude_ids):
    with closing(sqlite3.connect(DB_PATH)) as connection:
        connection.row_factory = sqlite3.Row
        if topic == "all":
            rows = connection.execute("SELECT * FROM questions").fetchall()
        else:
            rows = connection.execute("SELECT * FROM questions WHERE topic = ?", (topic,)).fetchall()

    # Exclude the immediately previous session, while allowing a fallback if a future topic is small.
    available = [row for row in rows if row["id"] not in exclude_ids]
    if len(available) < SESSION_SIZE:
        available = rows
    randomizer = secrets.SystemRandom()
    if topic == "all":
        # A mixed session samples every topic, then fills the remaining slots at random.
        selected = [randomizer.choice([row for row in available if row["topic"] == key]) for key in TOPICS]
        selected_ids = {row["id"] for row in selected}
        selected.extend(randomizer.sample([row for row in available if row["id"] not in selected_ids], SESSION_SIZE - len(selected)))
    else:
        selected = randomizer.sample(available, SESSION_SIZE)
    randomizer.shuffle(selected)

    questions = []
    for row in selected:
        original_options = json.loads(row["options"])
        option_order = list(range(len(original_options)))
        randomizer.shuffle(option_order)
        questions.append({
            "id": row["id"], "topic": row["topic"], "topicLabel": TOPICS[row["topic"]],
            "question": row["question"], "options": [original_options[index] for index in option_order],
            "answer": option_order.index(row["answer"]), "explanation": row["explanation"],
        })
    return {"id": secrets.token_hex(12), "topic": topic, "questions": questions, "size": SESSION_SIZE}


def initialize_work_database():
    """Create the relational Work-mode foundation without changing the practice DB.

    The current browser UI remains local-first for demo/practice use. This schema is
    intentionally ready for authenticated API persistence when a deployment adds
    identity, authorization, backups and encrypted file storage.
    """
    with closing(sqlite3.connect(WORK_DB_PATH)) as connection:
        connection.executescript("""
            PRAGMA foreign_keys = ON;
            CREATE TABLE IF NOT EXISTS schema_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                display_name TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'Viewer',
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS companies (
                id TEXT PRIMARY KEY,
                owner_user_id TEXT,
                name TEXT NOT NULL,
                legal_name TEXT NOT NULL,
                trade_name TEXT,
                pan TEXT,
                tan TEXT,
                business_type TEXT,
                state TEXT,
                state_code TEXT,
                address TEXT,
                city TEXT,
                email TEXT,
                phone TEXT,
                registration_type TEXT,
                composition INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (owner_user_id) REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS gstins (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                gstin TEXT NOT NULL UNIQUE,
                state TEXT NOT NULL,
                state_code TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Active',
                taxpayer_type TEXT,
                registration_date TEXT,
                principal_place TEXT,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS financial_years (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                label TEXT NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 0,
                UNIQUE(company_id, label),
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS customers (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                name TEXT NOT NULL,
                legal_name TEXT,
                trade_name TEXT,
                gstin TEXT,
                pan TEXT,
                state TEXT,
                state_code TEXT,
                billing_address TEXT,
                shipping_address TEXT,
                email TEXT,
                phone TEXT,
                payment_terms INTEGER NOT NULL DEFAULT 0,
                opening_balance REAL NOT NULL DEFAULT 0,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS suppliers (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                name TEXT NOT NULL,
                legal_name TEXT,
                trade_name TEXT,
                gstin TEXT,
                pan TEXT,
                state TEXT,
                state_code TEXT,
                address TEXT,
                email TEXT,
                phone TEXT,
                payment_terms INTEGER NOT NULL DEFAULT 0,
                opening_balance REAL NOT NULL DEFAULT 0,
                itc_relevance TEXT,
                rcm INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                name TEXT NOT NULL,
                sku TEXT,
                hsn_sac TEXT,
                unit TEXT,
                purchase_rate REAL NOT NULL DEFAULT 0,
                sales_rate REAL NOT NULL DEFAULT 0,
                gst_rate REAL NOT NULL DEFAULT 0,
                cess_rate REAL NOT NULL DEFAULT 0,
                tax_category TEXT,
                itc_eligible INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS invoices (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                gstin_id TEXT,
                financial_year_id TEXT,
                document_number TEXT NOT NULL,
                document_type TEXT NOT NULL,
                invoice_date TEXT NOT NULL,
                due_date TEXT,
                party_id TEXT,
                party_type TEXT,
                party_gstin TEXT,
                place_of_supply TEXT,
                category TEXT,
                reverse_charge INTEGER NOT NULL DEFAULT 0,
                taxable_value REAL NOT NULL DEFAULT 0,
                cgst REAL NOT NULL DEFAULT 0,
                sgst REAL NOT NULL DEFAULT 0,
                igst REAL NOT NULL DEFAULT 0,
                cess REAL NOT NULL DEFAULT 0,
                total_value REAL NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'Draft',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(company_id, document_number),
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (gstin_id) REFERENCES gstins(id)
            );
            CREATE TABLE IF NOT EXISTS invoice_items (
                id TEXT PRIMARY KEY,
                invoice_id TEXT NOT NULL,
                product_id TEXT,
                description TEXT,
                hsn_sac TEXT,
                quantity REAL NOT NULL DEFAULT 0,
                unit TEXT,
                rate REAL NOT NULL DEFAULT 0,
                discount REAL NOT NULL DEFAULT 0,
                taxable_value REAL NOT NULL DEFAULT 0,
                gst_rate REAL NOT NULL DEFAULT 0,
                cgst REAL NOT NULL DEFAULT 0,
                sgst REAL NOT NULL DEFAULT 0,
                igst REAL NOT NULL DEFAULT 0,
                cess REAL NOT NULL DEFAULT 0,
                FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id)
            );
            CREATE TABLE IF NOT EXISTS journal_entries (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                invoice_id TEXT,
                entry_date TEXT NOT NULL,
                narration TEXT,
                source TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (invoice_id) REFERENCES invoices(id)
            );
            CREATE TABLE IF NOT EXISTS ledger_lines (
                id TEXT PRIMARY KEY,
                journal_entry_id TEXT NOT NULL,
                account_name TEXT NOT NULL,
                debit REAL NOT NULL DEFAULT 0,
                credit REAL NOT NULL DEFAULT 0,
                FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS gst_returns (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                gstin_id TEXT,
                financial_year TEXT NOT NULL,
                period TEXT NOT NULL,
                form_name TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Preparation',
                taxable_value REAL NOT NULL DEFAULT 0,
                tax_value REAL NOT NULL DEFAULT 0,
                arn TEXT,
                filed_at TEXT,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (gstin_id) REFERENCES gstins(id)
            );
            CREATE TABLE IF NOT EXISTS return_items (
                id TEXT PRIMARY KEY,
                gst_return_id TEXT NOT NULL,
                invoice_id TEXT,
                section_name TEXT,
                validation_status TEXT,
                FOREIGN KEY (gst_return_id) REFERENCES gst_returns(id) ON DELETE CASCADE,
                FOREIGN KEY (invoice_id) REFERENCES invoices(id)
            );
            CREATE TABLE IF NOT EXISTS reconciliations (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                invoice_id TEXT,
                source TEXT NOT NULL,
                external_invoice_number TEXT,
                external_gstin TEXT,
                external_tax REAL NOT NULL DEFAULT 0,
                status TEXT NOT NULL,
                difference REAL NOT NULL DEFAULT 0,
                note TEXT,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (invoice_id) REFERENCES invoices(id)
            );
            CREATE TABLE IF NOT EXISTS gst_ledger_entries (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                ledger_type TEXT NOT NULL,
                entry_date TEXT NOT NULL,
                source_type TEXT,
                source_id TEXT,
                debit REAL NOT NULL DEFAULT 0,
                credit REAL NOT NULL DEFAULT 0,
                reference TEXT,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS compliance_tasks (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                gstin_id TEXT,
                task_type TEXT NOT NULL,
                title TEXT NOT NULL,
                due_date TEXT,
                status TEXT NOT NULL DEFAULT 'Open',
                assigned_user_id TEXT,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS notices (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                notice_number TEXT NOT NULL,
                form_name TEXT,
                notice_date TEXT,
                issue TEXT,
                due_date TEXT,
                response_date TEXT,
                status TEXT NOT NULL DEFAULT 'New',
                assigned_user_id TEXT,
                notes TEXT,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                record_type TEXT,
                record_id TEXT,
                category TEXT NOT NULL,
                file_name TEXT NOT NULL,
                storage_key TEXT,
                version INTEGER NOT NULL DEFAULT 1,
                uploaded_by TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS audit_logs (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                user_id TEXT,
                action TEXT NOT NULL,
                record_type TEXT,
                record_id TEXT,
                old_value TEXT,
                new_value TEXT,
                source TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS tax_rates (
                id TEXT PRIMARY KEY,
                code TEXT NOT NULL,
                rate REAL NOT NULL,
                cess_rate REAL NOT NULL DEFAULT 0,
                valid_from TEXT NOT NULL,
                valid_to TEXT,
                is_active INTEGER NOT NULL DEFAULT 1
            );
            CREATE INDEX IF NOT EXISTS invoices_company_date ON invoices(company_id, invoice_date);
            CREATE INDEX IF NOT EXISTS invoices_party_gstin ON invoices(party_gstin);
            CREATE INDEX IF NOT EXISTS ledger_lines_account ON ledger_lines(account_name);
            CREATE INDEX IF NOT EXISTS reconciliations_status ON reconciliations(company_id, status);
            CREATE INDEX IF NOT EXISTS tasks_due_date ON compliance_tasks(company_id, due_date);
            CREATE INDEX IF NOT EXISTS audit_record ON audit_logs(company_id, record_id, created_at);
            INSERT INTO schema_meta(key, value) VALUES('version', '1') ON CONFLICT(key) DO UPDATE SET value = excluded.value;
        """)
        connection.commit()
    return WORK_SCHEMA_VERSION


class LedgerlyHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def normalized_path(self):
        path = unquote(urlsplit(self.path).path)
        if path == "/Ledgerly":
            return "/"
        return path[len("/Ledgerly"):] if path.startswith("/Ledgerly/") else path

    def send_json(self, status, body):
        payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        path = self.normalized_path()
        if path == "/api/practice/bank":
            self.send_json(HTTPStatus.OK, bank_summary())
        elif path == "/api/work/health":
            self.send_json(HTTPStatus.OK, {"ok": True, "schemaVersion": WORK_SCHEMA_VERSION, "database": WORK_DB_PATH.name, "mode": "schema-ready; browser Work mode is local-first until authenticated persistence is configured"})
        elif path.startswith("/api/"):
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "API endpoint not found."})
        else:
            self.path = path
            super().do_GET()

    def do_HEAD(self):
        self.path = self.normalized_path()
        super().do_HEAD()

    def do_POST(self):
        if self.normalized_path() != "/api/practice/session":
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "API endpoint not found."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 8192:
                raise ValueError("Invalid request size.")
            request = json.loads(self.rfile.read(length))
            if not isinstance(request, dict):
                raise ValueError("Expected a JSON object.")
            topic = request.get("topic", "all")
            if not isinstance(topic, str) or topic not in {"all", *TOPICS}:
                raise ValueError("Choose a valid topic.")
            exclude = request.get("excludeIds", [])
            if not isinstance(exclude, list) or len(exclude) > SESSION_SIZE or any(not isinstance(item, str) for item in exclude):
                raise ValueError("Invalid previous-session IDs.")
            self.send_json(HTTPStatus.OK, create_session(topic, set(exclude)))
        except (ValueError, TypeError, UnicodeDecodeError) as error:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
        except sqlite3.Error:
            self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "Could not load the question bank. Please try again."})

    def translate_path(self, path):
        candidate = Path(super().translate_path(path)).resolve()
        if candidate == ROOT:
            return str(ROOT / "index.html")
        # Serve the application, keeping its SQLite and source files out of the static file routes.
        allowed = {ROOT / name for name in (
             "index.html", "favicon.svg", "styles.css", "script.js", "practice.js", "theme-controller.js", "theme-presets.css", "statement-lab.js", "statement-learning.css",
            "tally-model.js", "tally-lab.js", "tally-lab.css", "gst-model.js", "document-coach.js", "document-coach.css", "gst-learning.js", "gst-learning.css", "gst-tools.js", "gst-suite.css", "work-model.js", "work.js", "work-suite.css", "workspace.js", "studio-theme.css", "learning-layout.css",
        )}
        return str(candidate) if candidate in allowed else str(ROOT / "not-found")

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--bind", default="0.0.0.0")
    args = parser.parse_args()
    total = initialize_database()
    work_schema = initialize_work_database()
    server = ThreadingHTTPServer((args.bind, args.port), LedgerlyHandler)
    print(f"Ledgerly is running: http://localhost:{args.port}/Ledgerly/", flush=True)
    print(f"SQLite question bank: {total} questions in {DB_PATH}", flush=True)
    print(f"Work relational schema: v{work_schema} in {WORK_DB_PATH}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
