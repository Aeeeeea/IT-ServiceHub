
const express = require("express");
const router = express.Router();
const db = require("../database");
const { authenticateToken } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// =========================
// TICKET FILE UPLOAD
// =========================

const uploadDir = path.join(__dirname, "../uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${extension}`);
  },
});

const allowedTypes = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, GIF, WEBP, MP4, WEBM, and MOV files are allowed."));
    }
  },
});

function createNotification({ userId, ticketId = null, type = "general", title, message = "" }) {
  if (userId == null || !title) return;
  db.prepare("INSERT INTO notifications (user_id, ticket_id, type, title, message) VALUES (?, ?, ?, ?, ?)")
    .run(Number(userId), ticketId, type, title, message);
}
function notifyUsers(userIds, payload) {
  [...new Set((userIds || []).filter(id => id != null).map(Number))].forEach(userId => {
    if (payload.excludeUserId != null && userId === Number(payload.excludeUserId)) return;
    createNotification({ ...payload, userId });
  });
}


// =========================
// SLA STATUS HELPER
// =========================

function parseDatabaseDate(value) {
  if (!value) return null;

  const timestamp = String(value).trim().replace(" ", "T");
  const hasTimezone = /(?:Z|[+-]\\d{2}:?\\d{2})$/i.test(timestamp);

  const date = new Date(
    hasTimezone ? timestamp : `${timestamp}Z`
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

function getSLAStatus(ticket) {
  const status = String(ticket.status || "").trim().toLowerCase();
  const deadline = ticket.sla_deadline;

  if (["cancelled", "canceled"].includes(status)) {
    return "Cancelled / Detached";
  }

  if (["on hold", "paused", "pending"].includes(status)) {
    return "Paused / On Hold";
  }

  const dueAt = parseDatabaseDate(deadline);

  if (["resolved", "closed", "completed"].includes(status)) {
    if (!deadline) return "Met / Succeeded";

    const resolvedAt = parseDatabaseDate(ticket.resolved_at);

    if (resolvedAt && dueAt && resolvedAt <= dueAt) {
      return "Met / Succeeded";
    }

    return "Breached / Violated";
  }

  if (!deadline) return "In Progress / Running";

  const createdAt = parseDatabaseDate(ticket.created_at);
  const now = new Date();

  if (!dueAt || !createdAt) {
    return "In Progress / Running";
  }

  const remaining = dueAt.getTime() - now.getTime();

  if (remaining <= 0) {
    return "Breached / Violated";
  }

  const totalDuration = dueAt.getTime() - createdAt.getTime();

  if (totalDuration > 0 && remaining / totalDuration <= 0.2) {
    return "Warning / At Risk";
  }

  return "In Progress / Running";
}

// =========================
// HELPER: GET FULL TICKET
// =========================

function getFullTicket(id) {
  const ticket = db
    .prepare(`
      SELECT
        tickets.*,
        requester.name AS requester_name,
        requester.email AS requester_email,
        assignee.name AS assigned_to_name
      FROM tickets
      LEFT JOIN users AS requester
        ON tickets.requester_id = requester.id
      LEFT JOIN users AS assignee
        ON tickets.assigned_to = assignee.id
      WHERE tickets.id = ? OR tickets.ticket_number = ?
    `)
    .get(id, id);

  if (!ticket) return null;

  const attachments = db
    .prepare(`
      SELECT
        id,
        original_name,
        file_path,
        mime_type,
        file_size,
        created_at
      FROM ticket_attachments
      WHERE ticket_id = ?
      ORDER BY created_at ASC
    `)
    .all(ticket.id);

  return {
    ...ticket,
    attachments,
  };
}

// =========================
// GET ALL TICKETS
// =========================

router.get("/", (req, res) => {
  try {
    const tickets = db
      .prepare(`
        SELECT
          tickets.*,
          requester.name AS requester_name,
          requester.email AS requester_email,
          assignee.name AS assigned_to_name
        FROM tickets
        LEFT JOIN users AS requester
          ON tickets.requester_id = requester.id
        LEFT JOIN users AS assignee
          ON tickets.assigned_to = assignee.id
        ORDER BY tickets.created_at DESC
      `)
      .all();
    res.json(
      tickets.map((ticket) => ({
        ...ticket,
        sla_status: getSLAStatus(ticket),
      }))
    );
  } catch (error) {
    console.error("Failed to retrieve tickets:", error);

    res.status(500).json({
      message: "Failed to retrieve tickets.",
    });
  }
});

// =========================
// GET ONE TICKET
// =========================

router.get("/:id", (req, res) => {
  try {
    const ticket = getFullTicket(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        message: "Ticket not found.",
      });
    }

    res.json({
      ...ticket,
      sla_status: getSLAStatus(ticket),
    });
  } catch (error) {
    console.error("Failed to retrieve ticket:", error);

    res.status(500).json({
      message: "Failed to retrieve ticket.",
    });
  }
});

// =========================
// CREATE TICKET
// =========================

router.post(
  "/",
  authenticateToken,
  upload.array("attachments", 5),
  (req, res) => {
  try {
    const {
      title,
      description,
      category,
      priority,
      requester_id,
      assigned_to,
    } = req.body;

    if (!title || !category) {
      return res.status(400).json({
        message: "Title and category are required.",
      });
    }

    const ticketNumber = `IT-${Date.now()}`;

    const slaHours = {
      Critical: 4,
      High: 8,
      Medium: 12,
      Low: 24,
    };

    const selectedPriority = priority || "Medium";
    const slaTargetHours = slaHours[selectedPriority] || 24;

    const slaDeadline = new Date(
      Date.now() + slaTargetHours * 60 * 60 * 1000
    )
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    const result = db
      .prepare(`
        INSERT INTO tickets (
          ticket_number,
          title,
          description,
          category,
          priority,
          requester_id,
          assigned_to,
          sla_target_hours,
          sla_deadline
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        ticketNumber,
        title.trim(),
        description || "",
        category,
        selectedPriority,
        requester_id || null,
        assigned_to || null,
        slaTargetHours,
        slaDeadline
      );
// Save uploaded attachment information
if (req.files && req.files.length > 0) {
  const insertAttachment = db.prepare(`
    INSERT INTO ticket_attachments (
      ticket_id,
      original_name,
      stored_name,
      file_path,
      mime_type,
      file_size,
      uploaded_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const file of req.files) {
    insertAttachment.run(
      result.lastInsertRowid,
      file.originalname,
      file.filename,
      `/uploads/${file.filename}`,
      file.mimetype,
      file.size,
      req.user.id
    );
  }
}
    const ticket = getFullTicket(String(result.lastInsertRowid));

    res.status(201).json({
      message: "Ticket created successfully.",
      ticket: {
        ...ticket,
        sla_status: getSLAStatus(ticket),
      },
    });
  } catch (error) {
    console.error("Failed to create ticket:", error);

    res.status(500).json({
      message: "Failed to create ticket.",
    });
  }
});

// =========================
// UPDATE TICKET
// =========================

router.put("/:id", authenticateToken, (req, res) => {
  try {
    const {
      title,
      description,
      category,
      priority,
      status,
      assigned_to,
    } = req.body;

    const role = String(req.user?.role || "").toLowerCase();

    const existingTicket = db
      .prepare(`
        SELECT *
        FROM tickets
        WHERE id = ? OR ticket_number = ?
      `)
      .get(req.params.id, req.params.id);

    if (!existingTicket) {
      return res.status(404).json({
        message: "Ticket not found.",
      });
    }

    // Only admins can edit closed tickets.
    if (
      existingTicket.status === "Closed" &&
      role !== "admin"
    ) {
      return res.status(403).json({
        message: "Only administrators can modify closed tickets.",
      });
    }

    // ASSIGNMENT PERMISSIONS: ADMIN ONLY
    if (
      Object.prototype.hasOwnProperty.call(req.body, "assigned_to") &&
      role !== "admin"
    ) {
      return res.status(403).json({
        message: "Only administrators can assign tickets.",
      });
    }

    // Validate assignment target.
    if (
      Object.prototype.hasOwnProperty.call(req.body, "assigned_to") &&
      assigned_to !== null &&
      assigned_to !== ""
    ) {
      const assigneeId = Number(assigned_to);

      if (!Number.isInteger(assigneeId) || assigneeId <= 0) {
        return res.status(400).json({
          message: "Invalid assignee ID.",
        });
      }

      const assignee = db
        .prepare("SELECT id, role FROM users WHERE id = ?")
        .get(assigneeId);

      if (
        !assignee ||
        !["admin", "it_staff"].includes(
          String(assignee.role || "").toLowerCase()
        )
      ) {
        return res.status(400).json({
          message: "Tickets can only be assigned to an admin or IT staff member.",
        });
      }
    }

    // STATUS PERMISSIONS
    if (status !== undefined) {
      if (
        !["admin", "it_staff"].includes(role)
      ) {
        return res.status(403).json({
          message: "Only admins and IT staff can update ticket status.",
        });
      }

      const allowedStatuses =
        role === "admin"
          ? ["Open", "In Progress", "Resolved", "Closed"]
          : ["Open", "In Progress", "Resolved"];

      if (!allowedStatuses.includes(status)) {
        return res.status(403).json({
          message:
            role === "admin"
              ? "Invalid ticket status."
              : "IT staff can only set tickets to Open, In Progress, or Resolved.",
        });
      }

      // Only an admin or the assigned IT staff member can resolve.
      if (status === "Resolved" && role !== "admin") {
        const userId = req.user?.id;

        if (
          userId == null ||
          existingTicket.assigned_to == null ||
          String(existingTicket.assigned_to) !== String(userId)
        ) {
          return res.status(403).json({
            message: "Only the assigned IT staff member or an admin can resolve this ticket.",
          });
        }
      }

      // Only admins can close tickets.
      if (status === "Closed" && role !== "admin") {
        return res.status(403).json({
          message: "Only administrators can close tickets.",
        });
      }
    }

    const hasAssignedTo = Object.prototype.hasOwnProperty.call(
      req.body,
      "assigned_to"
    );

// UPDATE TICKET
db.prepare(`
  UPDATE tickets
  SET
    title = COALESCE(?, title),
    description = COALESCE(?, description),
    category = COALESCE(?, category),
    priority = COALESCE(?, priority),
    status = COALESCE(?, status),

    assigned_to = CASE
      WHEN ? = 1 THEN ?
      ELSE assigned_to
    END,

    resolved_at = CASE
      WHEN COALESCE(?, status) IN ('Resolved', 'Closed')
        AND status NOT IN ('Resolved', 'Closed')
        THEN CURRENT_TIMESTAMP

      WHEN COALESCE(?, status) NOT IN ('Resolved', 'Closed')
        THEN NULL

      ELSE resolved_at
    END,

    updated_at = CURRENT_TIMESTAMP

  WHERE id = ? OR ticket_number = ?
`).run(
  title ?? null,
  description ?? null,
  category ?? null,
  priority ?? null,
  status ?? null,
  hasAssignedTo ? 1 : 0,
  hasAssignedTo && assigned_to !== "" ? assigned_to ?? null : null,
  status ?? null,
  status ?? null,
  req.params.id,
  req.params.id
);

    const updatedTicket = getFullTicket(req.params.id);

    // Create notifications after the ticket update succeeds.
    try {
      const actorId = Number(req.user.id);
      const assignmentChanged =
        hasAssignedTo &&
        String(assigned_to ?? "") !== String(existingTicket.assigned_to ?? "");

      const statusChanged =
        status !== undefined && status !== existingTicket.status;

      if (statusChanged) {
        notifyUsers(
          [existingTicket.requester_id, updatedTicket.assigned_to],
          {
            ticketId: updatedTicket.id,
            type: "ticket_status",
            title: `Ticket ${updatedTicket.ticket_number} status updated`,
            message: `Status changed from ${existingTicket.status} to ${updatedTicket.status}.`,
            excludeUserId: actorId,
          }
        );
      }

      const generalFieldsChanged =
        (title !== undefined && title !== existingTicket.title) ||
        (description !== undefined && description !== existingTicket.description) ||
        (category !== undefined && category !== existingTicket.category) ||
        (priority !== undefined && priority !== existingTicket.priority);

      if (generalFieldsChanged && !statusChanged && !assignmentChanged) {
        notifyUsers([existingTicket.requester_id, updatedTicket.assigned_to], {
          ticketId: updatedTicket.id,
          type: "ticket_updated",
          title: `Ticket ${updatedTicket.ticket_number} updated`,
          message: `${updatedTicket.title} was updated.`,
          excludeUserId: actorId,
        });
      }

      if (assignmentChanged) {
        if (updatedTicket.assigned_to != null) {
          createNotification({
            userId: updatedTicket.assigned_to,
            ticketId: updatedTicket.id,
            type: "ticket_assigned",
            title: "A ticket has been assigned to you",
            message: `${updatedTicket.ticket_number}: ${updatedTicket.title}`,
          });
        }

        notifyUsers([existingTicket.requester_id], {
          ticketId: updatedTicket.id,
          type: "ticket_assignment",
          title: "Ticket assignment updated",
          message: updatedTicket.assigned_to_name
            ? `Assigned to ${updatedTicket.assigned_to_name}.`
            : "The ticket is no longer assigned.",
          excludeUserId: actorId,
        });
      }
    } catch (notificationError) {
      console.error("Ticket updated, but notification creation failed:", notificationError);
    }

    res.json({
      message: "Ticket updated successfully.",
      ticket: {
        ...updatedTicket,
        sla_status: getSLAStatus(updatedTicket),
      },
    });
  } catch (error) {
    console.error("Failed to update ticket:", error);

    res.status(500).json({
      message: "Failed to update ticket.",
    });
  }
});

// =========================
// DELETE TICKET
// ADMIN ONLY
// =========================

router.delete("/:id", authenticateToken, (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();

    if (role !== "admin") {
      return res.status(403).json({
        message: "Only administrators can delete tickets.",
      });
    }

    const { id } = req.params;

    const ticket = db
      .prepare(`
        SELECT id
        FROM tickets
        WHERE id = ? OR ticket_number = ?
      `)
      .get(id, id);

    if (!ticket) {
      return res.status(404).json({
        message: "Ticket not found.",
      });
    }

    const deleteTicket = db.transaction((ticketId) => {
      db.prepare(
        "DELETE FROM ticket_comments WHERE ticket_id = ?"
      ).run(ticketId);

      for (const table of ["ticket_logs", "sla_history"]) {
        const exists = db
          .prepare(`
            SELECT name
            FROM sqlite_master
            WHERE type = 'table' AND name = ?
          `)
          .get(table);

        if (exists) {
          db.prepare(
            `DELETE FROM "${table}" WHERE ticket_id = ?`
          ).run(ticketId);
        }
      }

      return db
        .prepare("DELETE FROM tickets WHERE id = ?")
        .run(ticketId);
    });

    const result = deleteTicket(ticket.id);

    if (result.changes === 0) {
      return res.status(404).json({
        message: "Ticket not found.",
      });
    }

    res.json({
      message: "Ticket deleted successfully.",
    });
  } catch (error) {
    console.error("Failed to delete ticket:", error);

    res.status(500).json({
      message: "Failed to delete ticket.",
    });
  }
});

module.exports = router;