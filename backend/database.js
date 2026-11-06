const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(
  path.join(__dirname, "it_servicehub.db")
);

db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_number TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'Medium',
    status TEXT NOT NULL DEFAULT 'Open',
    requester_id INTEGER,
    assigned_to INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sla_target_hours INTEGER,
    sla_deadline DATETIME,

    FOREIGN KEY (requester_id) REFERENCES users(id)
      ON DELETE SET NULL,

    FOREIGN KEY (assigned_to) REFERENCES users(id)
      ON DELETE SET NULL
  );
`);


// ==========================================
// NOTIFICATIONS
// ==========================================

db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ticket_id INTEGER,
    type TEXT NOT NULL DEFAULT 'general',
    title TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE,

    FOREIGN KEY (ticket_id) REFERENCES tickets(id)
      ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_notifications_user_read
    ON notifications(user_id, is_read, created_at);
`);

console.log("SQLite database connected successfully.");

module.exports = db;

// Add resolved_at column if it does not already exist
const ticketColumns = db.prepare("PRAGMA table_info(tickets)").all();

if (!ticketColumns.some((column) => column.name === "resolved_at")) {
  db.exec("ALTER TABLE tickets ADD COLUMN resolved_at DATETIME");
}

// Backfill existing resolved tickets using their last update time.
// This is an estimate for historical records, not a guaranteed resolution time.
db.exec(`
  UPDATE tickets
  SET resolved_at = updated_at
  WHERE status IN ('Resolved', 'Closed')
    AND resolved_at IS NULL
`);
// Knowledge Base
db.exec(`
  CREATE TABLE IF NOT EXISTS knowledge_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    content TEXT NOT NULL,
    keywords TEXT DEFAULT '',
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  );
`);
const articleCount = db.prepare("SELECT COUNT(*) AS count FROM knowledge_articles").get().count;
if (articleCount === 0) {
  const insertArticle = db.prepare("INSERT INTO knowledge_articles (title, category, content, keywords) VALUES (?, ?, ?, ?)");
  
const seedArticles = [
  [
    "Computer screen is black",
    "Hardware",
    "1. Check monitor power and input.\n2. Reconnect the display cable.\n3. Restart the computer.\n4. Try another monitor.\n5. Submit a ticket if unresolved.",
    "screen monitor display black"
  ],
  [
    "Keyboard and mouse not working",
    "Hardware",
    "1. Check USB connections or wireless batteries.\n2. Reconnect the devices.\n3. Try another USB port.\n4. Restart your computer.\n5. Contact IT support.",
    "keyboard mouse USB hardware"
  ],
  [
    "Wi-Fi or network connection problems",
    "Network",
    "1. Confirm Wi-Fi is enabled.\n2. Disconnect and reconnect to the network.\n3. Restart your computer.\n4. Check other devices.\n5. Submit a ticket if unresolved.",
    "wifi internet network connection"
  ],
  [
    "Troubleshooting slow internet",
    "Network",
    "1. Check your internet connection.\n2. Close unnecessary applications.\n3. Restart your router if authorized.\n4. Check other devices.\n5. Contact IT support.",
    "slow internet network speed"
  ],
  [
    "Reset your account password",
    "Account",
    "1. Open your organization's approved password reset page.\n2. Verify your identity.\n3. Create a strong, unique password.\n4. Never share your password.",
    "password account login reset"
  ],
  [
    "How to enable two-factor authentication",
    "Account",
    "1. Open account security settings.\n2. Select two-factor authentication.\n3. Choose an authentication method.\n4. Complete verification.\n5. Store recovery codes securely.",
    "2FA security authentication account"
  ],
  [
    "Printer is not printing",
    "Hardware",
    "1. Check printer power and paper.\n2. Select the correct printer.\n3. Check for paper jams.\n4. Clear stuck print jobs.\n5. Submit a ticket if unresolved.",
    "printer print paper queue"
  ],
  [
    "How to fix application crashes",
    "Software",
    "1. Close and reopen the application.\n2. Restart your computer.\n3. Check for software updates.\n4. Check available storage.\n5. Contact IT support.",
    "software application crash error"
  ]
];
}