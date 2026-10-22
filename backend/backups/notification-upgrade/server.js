const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./database");
const authRoutes = require("./routes/auth");
const ticketRoutes = require("./routes/tickets");
const userRoutes = require("./routes/users");
const commentRoutes = require("./routes/comments");

const app = express();
const PORT = process.env.PORT || 5001;

// ==========================================
// MIDDLEWARE & CORS PREFLIGHT
// ==========================================

app.use(
  cors({
    origin: true, // Dynamically allow incoming origin (localhost:5173, 5174, etc.)
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Handle preflight OPTIONS requests for all endpoints
app.options(/.*/, cors());

app.use(express.json());

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/", (req, res) => {
  res.json({
    message: "IT ServiceHub API is running.",
  });
});

// ==========================================
// ROUTES
// ==========================================

app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/users", userRoutes);
app.use("/api/comments", commentRoutes);

// Get single user by ID
app.get("/api/users/:id", (req, res) => {
  try {
    const user = db
      .prepare(`
        SELECT
          id,
          name,
          email,
          role,
          created_at
        FROM users
        WHERE id = ?
      `)
      .get(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    res.json(user);
  } catch (error) {
    console.error("Failed to load user:", error);
    res.status(500).json({
      message: "Failed to load user.",
    });
  }
});

// ==========================================
// 404 HANDLER
// ==========================================

app.use((req, res) => {
  res.status(404).json({
    message: "Route not found.",
  });
});

// ==========================================
// GLOBAL ERROR HANDLER
// ==========================================

app.use((error, req, res, next) => {
  console.error("Server error:", error);

  res.status(500).json({
    message: error.message || "Internal server error.",
  });
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {
  console.log(`IT ServiceHub API running on http://localhost:${PORT}`);
});