const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const db = require("../database");
const { authenticateToken } = require("../middleware/auth");

// ==========================================
// ADMIN-ONLY MIDDLEWARE
// ==========================================
function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      message: "Only Admin can perform this action.",
    });
  }
  next();
}

// ==========================================
// GET ALL USERS (GET /api/users)
// ==========================================
router.get("/", (req, res) => {
  try {
    const users = db
      .prepare(`
        SELECT
          id,
          name,
          email,
          role,
          created_at
        FROM users
        ORDER BY name ASC
      `)
      .all();

    res.json(users);
  } catch (error) {
    console.error("Failed to load users:", error);
    res.status(500).json({
      message: "Failed to load users.",
    });
  }
});
// GET IT STAFF MEMBERS (for ticket assignment)
router.get("/it-staff", authenticateToken, (req, res) => {
  try {
    const members = db
      .prepare(`
        SELECT id, name, email
        FROM users
        WHERE role = 'it_staff'
        ORDER BY name ASC
      `)
      .all();

    res.json(members);
  } catch (error) {
    console.error("Failed to load IT Staff:", error);
    res.status(500).json({
      message: "Failed to load IT Staff.",
    });
  }
});
// ==========================================
// GET ONE USER (GET /api/users/:id)
// ==========================================
router.get("/:id", (req, res) => {
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
// CREATE USER (POST /api/users)
// ==========================================
router.post("/", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email, and password are required.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters.",
      });
    }

    const userRole = role || "employee";
    const allowedRoles = ["employee", "it_staff", "admin"];

    if (!allowedRoles.includes(userRole)) {
      return res.status(400).json({
        message: "Invalid user role.",
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // Check if account already exists
    const existingUser = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(cleanEmail);

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    // Hash password securely
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = db
      .prepare(`
        INSERT INTO users (name, email, password, role)
        VALUES (?, ?, ?, ?)
      `)
      .run(name.trim(), cleanEmail, hashedPassword, userRole);

    const newUser = db
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
      .get(result.lastInsertRowid);

    res.status(201).json({
      message: "User created successfully.",
      user: newUser,
    });
  } catch (error) {
    console.error("Failed to create user:", error);
    res.status(500).json({
      message: error.message || "Failed to create user.",
    });
  }
});

// ==========================================
// UPDATE USER (PUT /api/users/:id)
// ==========================================
router.put("/:id", async (req, res) => {
  try {
    const { name, email, role } = req.body;
    const userId = req.params.id;

    if (!name || !email || !role) {
      return res.status(400).json({
        message: "Name, email, and role are required.",
      });
    }

    const allowedRoles = ["employee", "it_staff", "admin"];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        message: "Invalid user role.",
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    const existingUser = db
      .prepare(`
        SELECT id
        FROM users
        WHERE email = ?
        AND id != ?
      `)
      .get(cleanEmail, userId);

    if (existingUser) {
      return res.status(409).json({
        message: "Another account with this email already exists.",
      });
    }

    const user = db
      .prepare("SELECT id FROM users WHERE id = ?")
      .get(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    db.prepare(`
      UPDATE users
      SET
        name = ?,
        email = ?,
        role = ?
      WHERE id = ?
    `).run(name.trim(), cleanEmail, role, userId);

    const updatedUser = db
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
      .get(userId);

    res.json({
      message: "User updated successfully.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Failed to update user:", error);
    res.status(500).json({
      message: "Failed to update user.",
    });
  }
});

// ==========================================
// DELETE USER (DELETE /api/users/:id)
// ==========================================
router.delete("/:id", authenticateToken, requireAdmin, (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent Admin from deleting their own account
    if (Number(userId) === Number(req.user?.id)) {
      return res.status(400).json({
        message: "You cannot delete your own account.",
      });
    }

    const user = db
      .prepare("SELECT id, name, email, role FROM users WHERE id = ?")
      .get(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    db.prepare("DELETE FROM users WHERE id = ?").run(userId);

    res.json({
      message: "User deleted successfully.",
    });
  } catch (error) {
    console.error("Failed to delete user:", error);
    res.status(500).json({
      message: "Failed to delete user.",
    });
  }
});

module.exports = router;