const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const db = require("../database");
const { authenticateToken } = require("../middleware/auth");

// ==========================================
// ADMIN-ONLY MIDDLEWARE
// ==========================================
function requireUserManager(req, res, next) {
  const role = String(req.user?.role || "")
    .trim()
    .toLowerCase();

  if (!["admin", "it_staff"].includes(role)) {
    return res.status(403).json({
      message: "Only Admin and IT Staff can manage users.",
    });
  }

  next();
}
function requireAdmin(req, res, next) {
  const role = String(req.user?.role || "")
    .trim()
    .toLowerCase();

  if (role !== "admin") {
    return res.status(403).json({
      message: "Only Admin can delete users.",
    });
  }

  next();
}

// ==========================================
// GET ALL USERS (GET /api/users)
// ==========================================
router.get("/", authenticateToken, (req, res) => {
  try {
    const role = String(req.user?.role || "")
      .trim()
      .toLowerCase();

    let query = `
      SELECT id, name, email, role, created_at
      FROM users
    `;

    // Employees can only see IT Staff and Admin
    if (role === "employee") {
      query += ` WHERE role IN ('it_staff', 'admin')`;
    } else if (!["admin", "it_staff"].includes(role)) {
      return res.status(403).json({
        message: "You do not have permission to view users.",
      });
    }

    query += ` ORDER BY name ASC`;

    const users = db.prepare(query).all();

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
router.get("/:id", authenticateToken, (req, res) => {
  try {
    const role = String(req.user?.role || "")
      .trim()
      .toLowerCase();

    if (!["admin", "it_staff", "employee"].includes(role)) {
      return res.status(403).json({
        message: "You do not have permission to view users.",
      });
    }

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

    // Employees cannot view other employee accounts
    if (
      role === "employee" &&
      !["it_staff", "admin"].includes(
        String(user.role).toLowerCase()
      )
    ) {
      return res.status(403).json({
        message: "You cannot view this user.",
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
router.put("/:id", authenticateToken, requireAdmin, async (req, res) => {
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