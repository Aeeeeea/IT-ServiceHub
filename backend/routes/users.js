const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();
const db = require("../database-pg");
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
// GET ALL USERS
// ==========================================
router.get("/", authenticateToken, async (req, res) => {
  try {
    const role = String(req.user?.role || "")
      .trim()
      .toLowerCase();

    let query = `
      SELECT id, name, email, role, created_at
      FROM users
    `;

    if (role === "employee") {
      query += ` WHERE role IN ('it_staff', 'admin')`;
    } else if (!["admin", "it_staff"].includes(role)) {
      return res.status(403).json({
        message: "You do not have permission to view users.",
      });
    }

    query += ` ORDER BY name ASC`;

    const result = await db.query(query);

    res.json(result.rows);
  } catch (error) {
    console.error("Failed to load users:", error);

    res.status(500).json({
      message: "Failed to load users.",
    });
  }
});

// ==========================================
// GET IT STAFF MEMBERS
// ==========================================
router.get("/it-staff", authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, email
      FROM users
      WHERE role = 'it_staff'
      ORDER BY name ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Failed to load IT Staff:", error);

    res.status(500).json({
      message: "Failed to load IT Staff.",
    });
  }
});

// ==========================================
// GET ONE USER
// ==========================================
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const role = String(req.user?.role || "")
      .trim()
      .toLowerCase();

    if (!["admin", "it_staff", "employee"].includes(role)) {
      return res.status(403).json({
        message: "You do not have permission to view users.",
      });
    }

    const result = await db.query(
      `
        SELECT id, name, email, role, created_at
        FROM users
        WHERE id = $1
      `,
      [req.params.id]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

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
// CREATE USER
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

    const existingUser = await db.query(
      "SELECT id FROM users WHERE email = $1",
      [cleanEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.query(
      `
        INSERT INTO users (name, email, password, role)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, email, role, created_at
      `,
      [name.trim(), cleanEmail, hashedPassword, userRole]
    );

    res.status(201).json({
      message: "User created successfully.",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Failed to create user:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    res.status(500).json({
      message: error.message || "Failed to create user.",
    });
  }
});

// ==========================================
// UPDATE USER
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

    const existingUser = await db.query(
      `
        SELECT id
        FROM users
        WHERE email = $1
        AND id != $2
      `,
      [cleanEmail, userId]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        message: "Another account with this email already exists.",
      });
    }

    const user = await db.query(
      "SELECT id FROM users WHERE id = $1",
      [userId]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const result = await db.query(
      `
        UPDATE users
        SET name = $1, email = $2, role = $3
        WHERE id = $4
        RETURNING id, name, email, role, created_at
      `,
      [name.trim(), cleanEmail, role, userId]
    );

    res.json({
      message: "User updated successfully.",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Failed to update user:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        message: "Another account with this email already exists.",
      });
    }

    res.status(500).json({
      message: "Failed to update user.",
    });
  }
});

// ==========================================
// DELETE USER
// ==========================================
router.delete("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    if (Number(userId) === Number(req.user?.id)) {
      return res.status(400).json({
        message: "You cannot delete your own account.",
      });
    }

    const user = await db.query(
      `
        SELECT id, name, email, role
        FROM users
        WHERE id = $1
      `,
      [userId]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    await db.query(
      "DELETE FROM users WHERE id = $1",
      [userId]
    );

    res.json({
      message: "User deleted successfully.",
    });
  } catch (error) {
    console.error("Failed to delete user:", error);

    if (error.code === "23503") {
      return res.status(409).json({
        message: "This user is linked to existing records and cannot be deleted.",
      });
    }

    res.status(500).json({
      message: "Failed to delete user.",
    });
  }
});

module.exports = router;
