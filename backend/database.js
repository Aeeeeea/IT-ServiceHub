
const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(
  path.join(__dirname, "it_servicehub.db")
);

db.pragma("foreign_keys = ON");

// ==========================================
// USERS AND TICKETS
// ==========================================

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
    resolved_at DATETIME,

    FOREIGN KEY (requester_id) REFERENCES users(id)
      ON DELETE SET NULL,

    FOREIGN KEY (assigned_to) REFERENCES users(id)
      ON DELETE SET NULL
  );
`);

// ==========================================
// TICKET MIGRATION
// ==========================================

const ticketColumns = db
  .prepare("PRAGMA table_info(tickets)")
  .all();

if (!ticketColumns.some(column => column.name === "resolved_at")) {
  db.exec("ALTER TABLE tickets ADD COLUMN resolved_at DATETIME");
}

db.exec(`
  UPDATE tickets
  SET resolved_at = updated_at
  WHERE status IN ('Resolved', 'Closed')
    AND resolved_at IS NULL
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

// ==========================================
// KNOWLEDGE BASE
// ==========================================

db.exec(`
  CREATE TABLE IF NOT EXISTS knowledge_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    content TEXT NOT NULL,
    keywords TEXT DEFAULT '',
    external_url TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (created_by) REFERENCES users(id)
      ON DELETE SET NULL
  );
`);

// Add external_url to existing databases.
const articleColumns = db
  .prepare("PRAGMA table_info(knowledge_articles)")
  .all();

if (!articleColumns.some(column => column.name === "external_url")) {
  db.exec("ALTER TABLE knowledge_articles ADD COLUMN external_url TEXT");
}

// ==========================================
// KNOWLEDGE BASE ARTICLE DATA
// ==========================================

const seedArticles = [
  {
    title: "Computer screen is black",
    category: "Hardware",
    content: "1. Check monitor power and input.\n2. Reconnect the display cable.\n3. Restart the computer.\n4. Try another monitor.\n5. Submit a ticket if unresolved.",
    keywords: "screen monitor display black",
    url: "https://support.microsoft.com/search/results?query=black%20screen"
  },
  {
    title: "Keyboard and mouse not working",
    category: "Hardware",
    content: "1. Check USB connections or wireless batteries.\n2. Reconnect the devices.\n3. Try another USB port.\n4. Restart your computer.\n5. Contact IT support.",
    keywords: "keyboard mouse USB hardware",
    url: "https://support.microsoft.com/search/results?query=keyboard%20mouse%20problems"
  },
  {
    title: "Wi-Fi or network connection problems",
    category: "Network",
    content: "1. Confirm Wi-Fi is enabled.\n2. Disconnect and reconnect to the network.\n3. Restart your computer.\n4. Check other devices.\n5. Submit a ticket if unresolved.",
    keywords: "wifi internet network connection",
    url: "https://support.microsoft.com/search/results?query=network%20connection%20problems"
  },
  {
    title: "Troubleshooting slow internet",
    category: "Network",
    content: "1. Check your internet connection.\n2. Close unnecessary applications.\n3. Restart your router if authorized.\n4. Check other devices.\n5. Contact IT support.",
    keywords: "slow internet network speed",
    url: "https://support.microsoft.com/search/results?query=slow%20internet"
  },
  {
    title: "Reset your account password",
    category: "Account",
    content: "1. Open your organization's approved password reset page.\n2. Verify your identity.\n3. Create a strong, unique password.\n4. Never share your password.",
    keywords: "password account login reset",
    url: "https://support.microsoft.com/search/results?query=password%20reset"
  },
  {
    title: "How to enable two-factor authentication",
    category: "Account",
    content: "1. Open account security settings.\n2. Select two-factor authentication.\n3. Choose an authentication method.\n4. Complete verification.\n5. Store recovery codes securely.",
    keywords: "2FA security authentication account",
    url: "https://support.microsoft.com/search/results?query=two%20factor%20authentication"
  },
  {
    title: "Printer is not printing",
    category: "Hardware",
    content: "1. Check printer power and paper.\n2. Select the correct printer.\n3. Check for paper jams.\n4. Clear stuck print jobs.\n5. Submit a ticket if unresolved.",
    keywords: "printer print paper queue",
    url: "https://support.microsoft.com/search/results?query=printer%20problems"
  },
  {
    title: "How to fix application crashes",
    category: "Software",
    content: "1. Close and reopen the application.\n2. Restart your computer.\n3. Check for software updates.\n4. Check available storage.\n5. Contact IT support.",
    keywords: "software application crash error",
    url: "https://support.microsoft.com/search/results?query=application%20crashes"
  },
  {
    title: "Fix problems with apps from Microsoft Store",
    category: "Software",
    content: "Find solutions for Microsoft Store app installation, updates, and application errors.",
    keywords: "software app microsoft store installation update",
    url: "https://support.microsoft.com/search/results?query=Microsoft%20Store%20app%20problems"
  },
  {
    title: "Update Windows",
    category: "Software",
    content: "Learn how to check for and install Windows updates and troubleshoot update problems.",
    keywords: "windows update upgrade installation software",
    url: "https://support.microsoft.com/search/results?query=Windows%20Update"
  },
  {
    title: "Troubleshoot Microsoft Office applications",
    category: "Software",
    content: "Find help for Microsoft Word, Excel, PowerPoint, and other Office application issues.",
    keywords: "office word excel powerpoint application error",
    url: "https://support.microsoft.com/office"
  },
  {
    title: "Windows help and learning",
    category: "General",
    content: "Explore Windows tutorials, setup instructions, and general troubleshooting guides.",
    keywords: "windows help computer guide tutorial",
    url: "https://support.microsoft.com/windows"
  },
  {
    title: "Google Workspace troubleshooting",
    category: "General",
    content: "Find help for Gmail, Google Drive, Google Docs, and other Google Workspace services.",
    keywords: "google workspace gmail drive docs help",
    url: "https://support.google.com/"
  },
  {
    title: "HP Computer Support",
    category: "General",
    content: "Find computer setup, maintenance, diagnostics, and troubleshooting resources.",
    keywords: "computer laptop hp support diagnostics maintenance",
    url: "https://support.hp.com/"
  }
];

// ==========================================
// INSERT STARTER ARTICLES IF EMPTY
// ==========================================

const articleCount = db
  .prepare("SELECT COUNT(*) AS count FROM knowledge_articles")
  .get().count;

if (articleCount === 0) {
  const insertArticle = db.prepare(`
    INSERT INTO knowledge_articles (
      title,
      category,
      content,
      keywords,
      external_url
    )
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertStarterArticles = db.transaction(() => {
    for (const article of seedArticles) {
      insertArticle.run(
        article.title,
        article.category,
        article.content,
        article.keywords,
        article.url
      );
    }
  });

  insertStarterArticles();
}

// ==========================================
// UPDATE LINKS ON EXISTING ARTICLES
// ==========================================

const updateArticle = db.prepare(`
  UPDATE knowledge_articles
  SET external_url = ?
  WHERE LOWER(TRIM(title)) = LOWER(TRIM(?))
`);

const updateExistingLinks = db.transaction(() => {
  for (const article of seedArticles) {
    updateArticle.run(
      article.url,
      article.title
    );
  }
});

updateExistingLinks();
// ==========================================
// TICKET ATTACHMENTS
// ==========================================

db.exec(`
  CREATE TABLE IF NOT EXISTS ticket_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    uploaded_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (ticket_id) REFERENCES tickets(id)
      ON DELETE CASCADE,

    FOREIGN KEY (uploaded_by) REFERENCES users(id)
      ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket
    ON ticket_attachments(ticket_id);
`);
console.log("SQLite database connected successfully.");

module.exports = db;
