const express = require("express");
const router = express.Router();
const db = require("../database-pg");
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
      cb(
        new Error(
          "Only JPG, PNG, GIF, WEBP, MP4, WEBM, and MOV files are allowed."
        )
      );
    }
  },
});

// =========================
// NOTIFICATION HELPERS
// =========================

async function createNotification({
  userId,
  ticketId = null,
  type = "general",
  title,
  message = "",
}) {
  if (userId == null || !title) return;

  await db.query(
    `
      INSERT INTO notifications (
        user_id,
        ticket_id,
        type,
        title,
        message
      )
      VALUES ($1, $2, $3, $4, $5)
    `,
    [Number(userId), ticketId, type, title, message]
  );
}

async function notifyUsers(userIds, payload) {
  const uniqueUserIds = [
    ...new Set(
      (userIds || [])
        .filter((id) => id != null)
        .map(Number)
    ),
  ];

  await Promise.all(
    uniqueUserIds.map((userId) => {
      if (
        payload.excludeUserId != null &&
        userId === Number(payload.excludeUserId)
      ) {
        return Promise.resolve();
      }

      return createNotification({
        ...payload,
        userId,
      });
    })
  );
}

// =========================
// SLA STATUS HELPER
// =========================


function parseDatabaseDate(value) {
  if (!value) return null;

  // PostgreSQL may already return a JavaScript Date object.
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const timestamp = String(value).trim().replace(" ", "T");
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp);

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

async function getFullTicket(id) {
  const result = await db.query(
    `
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
      WHERE tickets.id::text = $1
         OR tickets.ticket_number = $1
      LIMIT 1
    `,
    [String(id)]
  );

  const ticket = result.rows[0];

  if (!ticket) return null;

  const attachmentResult = await db.query(
    `
      SELECT
        id,
        original_name,
        file_path,
        mime_type,
        file_size,
        created_at
      FROM ticket_attachments
      WHERE ticket_id = $1
      ORDER BY created_at ASC
    `,
    [ticket.id]
  );

  return {
    ...ticket,
    attachments: attachmentResult.rows,
  };
}

// =========================
// GET ALL TICKETS
// =========================

router.get("/", async (req, res) => {
  try {
    const result = await db.query(`
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
    `);

    res.json(
      result.rows.map((ticket) => ({
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

router.get("/:id", async (req, res) => {
  try {
    const ticket = await getFullTicket(req.params.id);

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
  async (req, res) => {
    const client = await db.connect();

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
      );

      await client.query("BEGIN");

      const ticketResult = await client.query(
        `
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
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id
        `,
        [
          ticketNumber,
          title.trim(),
          description || "",
          category,
          selectedPriority,
          requester_id || null,
          assigned_to || null,
          slaTargetHours,
          slaDeadline,
        ]
      );

      const ticketId = ticketResult.rows[0].id;

      // Save uploaded attachment information.
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          await client.query(
            `
              INSERT INTO ticket_attachments (
                ticket_id,
                original_name,
                stored_name,
                file_path,
                mime_type,
                file_size,
                uploaded_by
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `,
            [
              ticketId,
              file.originalname,
              file.filename,
              `/uploads/${file.filename}`,
              file.mimetype,
              file.size,
              req.user.id,
            ]
          );
        }
      }

      await client.query("COMMIT");

      // Notify all Admin users about the new ticket.
      const adminResult = await db.query(`
        SELECT id
        FROM users
        WHERE LOWER(TRIM(role)) = 'admin'
      `);

      await notifyUsers(
        adminResult.rows.map((user) => user.id),
        {
          ticketId,
          type:
            selectedPriority === "Critical"
              ? "critical_ticket"
              : "ticket_created",
          title:
            selectedPriority === "Critical"
              ? `New Critical Ticket: ${ticketNumber}`
              : `New Ticket: ${ticketNumber}`,
          message: `${title.trim()} - ${selectedPriority} priority ticket created.`,
        }
      );

      // Notify assigned IT staff.
      if (assigned_to) {
        await createNotification({
          userId: assigned_to,
          ticketId,
          type: "ticket_assigned",
          title: "A new ticket has been assigned to you",
          message: `${ticketNumber}: ${title.trim()}`,
        });
      }

      const ticket = await getFullTicket(String(ticketId));

      res.status(201).json({
        message: "Ticket created successfully.",
        ticket: {
          ...ticket,
          sla_status: getSLAStatus(ticket),
        },
      });
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Ticket creation rollback failed:", rollbackError);
      }

      console.error("Failed to create ticket:", error);

      res.status(500).json({
        message: "Failed to create ticket.",
      });
    } finally {
      client.release();
    }
  }
);

// =========================
// UPDATE TICKET
// =========================

router.put("/:id", authenticateToken, async (req, res) => {
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

    const existingResult = await db.query(
      `
        SELECT *
        FROM tickets
        WHERE id::text = $1 OR ticket_number = $1
        LIMIT 1
      `,
      [String(req.params.id)]
    );

    const existingTicket = existingResult.rows[0];

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

    const hasAssignedTo = Object.prototype.hasOwnProperty.call(
      req.body,
      "assigned_to"
    );

    // Assignment permissions: Admin only.
    if (hasAssignedTo && role !== "admin") {
      return res.status(403).json({
        message: "Only administrators can assign tickets.",
      });
    }

    // Validate assignment target.
    if (
      hasAssignedTo &&
      assigned_to !== null &&
      assigned_to !== ""
    ) {
      const assigneeId = Number(assigned_to);

      if (!Number.isInteger(assigneeId) || assigneeId <= 0) {
        return res.status(400).json({
          message: "Invalid assignee ID.",
        });
      }

      const assigneeResult = await db.query(
        "SELECT id, role FROM users WHERE id = $1",
        [assigneeId]
      );

      const assignee = assigneeResult.rows[0];

      if (
        !assignee ||
        !["admin", "it_staff"].includes(
          String(assignee.role || "").toLowerCase()
        )
      ) {
        return res.status(400).json({
          message:
            "Tickets can only be assigned to an admin or IT staff member.",
        });
      }
    }

    // Status permissions.
    if (status !== undefined) {
      if (!["admin", "it_staff"].includes(role)) {
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

      // Only an admin or assigned IT staff member can resolve.
      if (status === "Resolved" && role !== "admin") {
        const userId = req.user?.id;

        if (
          userId == null ||
          existingTicket.assigned_to == null ||
          String(existingTicket.assigned_to) !== String(userId)
        ) {
          return res.status(403).json({
            message:
              "Only the assigned IT staff member or an admin can resolve this ticket.",
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

    const assignedValue =
      hasAssignedTo && assigned_to !== ""
        ? assigned_to ?? null
        : null;

    // Update ticket using PostgreSQL parameters.
    await db.query(
      `
        UPDATE tickets
        SET
          title = COALESCE($1, title),
          description = COALESCE($2, description),
          category = COALESCE($3, category),
          priority = COALESCE($4, priority),
          status = COALESCE($5, status),

          assigned_to = CASE
            WHEN $6::boolean THEN $7::integer
            ELSE assigned_to
          END,

          resolved_at = CASE
            WHEN COALESCE($8, status) IN ('Resolved', 'Closed')
              AND status NOT IN ('Resolved', 'Closed')
              THEN CURRENT_TIMESTAMP

            WHEN COALESCE($9, status) NOT IN ('Resolved', 'Closed')
              THEN NULL

            ELSE resolved_at
          END,

          updated_at = CURRENT_TIMESTAMP

        WHERE id::text = $10 OR ticket_number = $10
      `,
      [
        title ?? null,
        description ?? null,
        category ?? null,
        priority ?? null,
        status ?? null,
        hasAssignedTo,
        assignedValue,
        status ?? null,
        status ?? null,
        String(req.params.id),
      ]
    );

    const updatedTicket = await getFullTicket(req.params.id);

    // Create notifications after the ticket update succeeds.
    try {
      const actorId = Number(req.user.id);

      const assignmentChanged =
        hasAssignedTo &&
        String(assignedValue ?? "") !==
          String(existingTicket.assigned_to ?? "");

      const statusChanged =
        status !== undefined &&
        status !== existingTicket.status;

      if (statusChanged) {
        await notifyUsers(
          [
            existingTicket.requester_id,
            updatedTicket.assigned_to,
          ],
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
        (description !== undefined &&
          description !== existingTicket.description) ||
        (category !== undefined &&
          category !== existingTicket.category) ||
        (priority !== undefined &&
          priority !== existingTicket.priority);

      if (
        generalFieldsChanged &&
        !statusChanged &&
        !assignmentChanged
      ) {
        await notifyUsers(
          [
            existingTicket.requester_id,
            updatedTicket.assigned_to,
          ],
          {
            ticketId: updatedTicket.id,
            type: "ticket_updated",
            title: `Ticket ${updatedTicket.ticket_number} updated`,
            message: `${updatedTicket.title} was updated.`,
            excludeUserId: actorId,
          }
        );
      }

      if (assignmentChanged) {
        if (updatedTicket.assigned_to != null) {
          await createNotification({
            userId: updatedTicket.assigned_to,
            ticketId: updatedTicket.id,
            type: "ticket_assigned",
            title: "A ticket has been assigned to you",
            message: `${updatedTicket.ticket_number}: ${updatedTicket.title}`,
          });
        }

        await notifyUsers(
          [existingTicket.requester_id],
          {
            ticketId: updatedTicket.id,
            type: "ticket_assignment",
            title: "Ticket assignment updated",
            message: updatedTicket.assigned_to_name
              ? `Assigned to ${updatedTicket.assigned_to_name}.`
              : "The ticket is no longer assigned.",
            excludeUserId: actorId,
          }
        );
      }
    } catch (notificationError) {
      console.error(
        "Ticket updated, but notification creation failed:",
        notificationError
      );
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

router.delete("/:id", authenticateToken, async (req, res) => {
  const client = await db.connect();

  try {
    const role = String(req.user?.role || "").toLowerCase();

    if (role !== "admin") {
      return res.status(403).json({
        message: "Only administrators can delete tickets.",
      });
    }

    const { id } = req.params;

    const ticketResult = await client.query(
      `
        SELECT id
        FROM tickets
        WHERE id::text = $1 OR ticket_number = $1
        LIMIT 1
      `,
      [String(id)]
    );

    const ticket = ticketResult.rows[0];

    if (!ticket) {
      return res.status(404).json({
        message: "Ticket not found.",
      });
    }

    await client.query("BEGIN");

    await client.query(
      "DELETE FROM ticket_comments WHERE ticket_id = $1",
      [ticket.id]
    );

    await client.query(
      "DELETE FROM ticket_attachments WHERE ticket_id = $1",
      [ticket.id]
    );

    await client.query(
      "DELETE FROM notifications WHERE ticket_id = $1",
      [ticket.id]
    );

    const deleteResult = await client.query(
      "DELETE FROM tickets WHERE id = $1",
      [ticket.id]
    );

    await client.query("COMMIT");

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({
        message: "Ticket not found.",
      });
    }

    res.json({
      message: "Ticket deleted successfully.",
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Ticket deletion rollback failed:", rollbackError);
    }

    console.error("Failed to delete ticket:", error);

    res.status(500).json({
      message: "Failed to delete ticket.",
    });
  } finally {
    client.release();
  }
});

module.exports = router;
