const express = require("express");
const db = require("../database-pg");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// ==========================================
// EXTERNAL SUPPORT ARTICLES
// ==========================================

const externalArticles = [
  {
    id: "external-1",
    title: "Troubleshoot Wi-Fi and network connection problems",
    category: "Network",
    content: "Learn how to diagnose and fix internet and network connection problems.",
    keywords: "wifi internet network connection",
    source: "Microsoft Support",
    url: "https://support.microsoft.com/search/results?query=network%20connection%20problems"
  },
  {
    id: "external-2",
    title: "Fix Windows startup and black screen problems",
    category: "Hardware",
    content: "Find troubleshooting guidance for Windows startup and black screen issues.",
    keywords: "black screen startup display monitor",
    source: "Microsoft Support",
    url: "https://support.microsoft.com/search/results?query=black%20screen"
  },
  {
    id: "external-3",
    title: "Troubleshoot printer problems",
    category: "Hardware",
    content: "Find solutions for printer connection, printing, and driver problems.",
    keywords: "printer printing driver offline",
    source: "HP Support",
    url: "https://support.hp.com/"
  },
  {
    id: "external-4",
    title: "Troubleshoot network connectivity",
    category: "Network",
    content: "Explore networking support and troubleshooting resources.",
    keywords: "network connectivity router cisco",
    source: "Cisco Support",
    url: "https://www.cisco.com/c/en/us/support/index.html"
  },
  {
    id: "external-5",
    title: "Protect your Microsoft account",
    category: "Security",
    content: "Learn about account security and protecting your sign-in information.",
    keywords: "account security password protection",
    source: "Microsoft Support",
    url: "https://support.microsoft.com/search/results?query=account%20security"
  },
  {
    id: "external-6",
    title: "Fix problems with apps from Microsoft Store",
    category: "Software",
    content: "Find solutions for Microsoft Store app installation, updates, and application errors.",
    keywords: "software app microsoft store installation update",
    source: "Microsoft Support",
    url: "https://support.microsoft.com/search/results?query=Microsoft%20Store%20app%20problems"
  },
  {
    id: "external-7",
    title: "Update Windows",
    category: "Software",
    content: "Learn how to check for and install Windows updates and troubleshoot update problems.",
    keywords: "windows update upgrade installation software",
    source: "Microsoft Support",
    url: "https://support.microsoft.com/search/results?query=Windows%20Update"
  },
  {
    id: "external-8",
    title: "Troubleshoot Microsoft Office applications",
    category: "Software",
    content: "Find help for Microsoft Word, Excel, PowerPoint, and other Office application issues.",
    keywords: "office word excel powerpoint application error",
    source: "Microsoft Support",
    url: "https://support.microsoft.com/search/results?query=Office%20application%20troubleshooting"
  },
  {
    id: "external-9",
    title: "Windows help and learning",
    category: "General",
    content: "Explore Windows tutorials, setup instructions, and general troubleshooting guides.",
    keywords: "windows help computer guide tutorial",
    source: "Microsoft Support",
    url: "https://support.microsoft.com/windows"
  },
  {
    id: "external-10",
    title: "Google Workspace troubleshooting",
    category: "General",
    content: "Find help for Gmail, Google Drive, Google Docs, and other Google Workspace services.",
    keywords: "google workspace gmail drive docs help",
    source: "Google Support",
    url: "https://support.google.com/"
  },
  {
    id: "external-11",
    title: "HP Computer Support",
    category: "General",
    content: "Find computer setup, maintenance, diagnostics, and troubleshooting resources.",
    keywords: "computer laptop hp support diagnostics maintenance",
    source: "HP Support",
    url: "https://support.hp.com/"
  }
];

// ==========================================
// GET KNOWLEDGE BASE ARTICLES
// ==========================================

router.get("/", authenticateToken, async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().toLowerCase();
    const category = String(req.query.category || "").trim().toLowerCase();

    const searchTerm = `%${q}%`;
    const categoryTerm = `%${category}%`;

    const result = await db.query(
      `
        SELECT
          id,
          title,
          category,
          content,
          keywords,
          external_url,
          created_by,
          created_at,
          updated_at
        FROM knowledge_articles
        WHERE
          (
            $1 = ''
            OR LOWER(title) LIKE $2
            OR LOWER(category) LIKE $2
            OR LOWER(content) LIKE $2
            OR LOWER(keywords) LIKE $2
          )
          AND (
            $3 = ''
            OR LOWER(category) LIKE $4
          )
        ORDER BY updated_at DESC
        LIMIT 100
      `,
      [q, searchTerm, category, categoryTerm]
    );

    const localArticles = result.rows.map((article) => ({
      ...article,
      source: article.external_url
        ? "External Support"
        : "Local Knowledge Base",
      type: "local",
      url: article.external_url || null,
    }));

    const filteredExternal = externalArticles
      .filter((article) => {
        const searchableText = [
          article.title,
          article.category,
          article.content,
          article.keywords,
          article.source,
        ]
          .join(" ")
          .toLowerCase();

        const matchesSearch =
          !q || searchableText.includes(q);

        const matchesCategory =
          !category ||
          article.category.toLowerCase().includes(category);

        return matchesSearch && matchesCategory;
      })
      .map((article) => ({
        ...article,
        type: "external",
      }));

    res.json([
      ...localArticles,
      ...filteredExternal,
    ]);
  } catch (error) {
    console.error("Knowledge Base search failed:", error);

    res.status(500).json({
      message: "Failed to search Knowledge Base.",
    });
  }
});

// ==========================================
// CREATE KNOWLEDGE BASE ARTICLE
// ==========================================

router.post("/", authenticateToken, async (req, res) => {
  try {
    const role = String(req.user.role || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");

    if (!["admin", "staff", "it_staff"].includes(role)) {
      return res.status(403).json({
        message: "Only administrators and IT staff can create articles.",
      });
    }

    const title = String(req.body.title || "").trim();

    const category =
      String(req.body.category || "General").trim() || "General";

    const content = String(req.body.content || "").trim();

    const keywords = String(req.body.keywords || "").trim();

    const external_url =
      String(req.body.external_url || "").trim();

    if (!title || !content) {
      return res.status(400).json({
        message: "Title and content are required.",
      });
    }

    if (external_url) {
      try {
        const parsedUrl = new URL(external_url);

        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          throw new Error("Invalid URL protocol");
        }
      } catch {
        return res.status(400).json({
          message: "Please enter a valid HTTP or HTTPS URL.",
        });
      }
    }

    const result = await db.query(
      `
        INSERT INTO knowledge_articles (
          title,
          category,
          content,
          keywords,
          external_url,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        title,
        category,
        content,
        keywords,
        external_url || null,
        Number(req.user.id),
      ]
    );

    const createdArticle = result.rows[0];

    res.status(201).json({
      ...createdArticle,
      source: createdArticle.external_url
        ? "External Support"
        : "Local Knowledge Base",
      type: "local",
      url: createdArticle.external_url || null,
    });
  } catch (error) {
    console.error("Failed to create Knowledge Base article:", error);

    res.status(500).json({
      message: "Failed to create article.",
    });
  }
});

module.exports = router;
