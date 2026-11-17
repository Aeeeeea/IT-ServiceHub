const express = require("express");
const db = require("../database-pg");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// ==========================================
// GET NOTIFICATIONS
// ==========================================
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const role = String(req.user.role || "").toLowerCase();

    const result = await db.query(
      `
        SELECT
          n.id,
          n.user_id,
          n.ticket_id,
          n.type,
          n.title,
          n.message,
          n.is_read,
          n.created_at,
          t.ticket_number,
          t.title AS ticket_title
        FROM notifications n
        LEFT JOIN tickets t ON t.id = n.ticket_id
        WHERE
          n.user_id = $1
          AND (
            $2 = 'admin'
            OR (
              $2 = 'it_staff'
              AND t.assigned_to = $3
            )
            OR (
              $2 = 'employee'
              AND t.requester_id = $3
            )
          )
        ORDER BY n.created_at DESC, n.id DESC
        LIMIT 50
      `,
      [userId, role, userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Failed to load notifications:", error);

    res.status(500).json({
      message: "Failed to load notifications.",
    });
  }
});

// ==========================================
// GET UNREAD NOTIFICATION COUNT
// ==========================================
router.get("/unread-count", authenticateToken, async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const role = String(req.user.role || "").toLowerCase();

    const result = await db.query(
      `
        SELECT COUNT(*) AS count
        FROM notifications n
        LEFT JOIN tickets t ON t.id = n.ticket_id
        WHERE n.user_id = $1
          AND n.is_read = 0
          AND (
            $2 != 'employee'
            OR t.requester_id = $3
          )
      `,
      [userId, role, userId]
    );

    res.json({
      count: Number(result.rows[0].count),
    });
  } catch (error) {
    console.error("Failed to count notifications:", error);

    res.status(500).json({
      message: "Failed to count notifications.",
    });
  }
});

// ==========================================
// MARK ONE NOTIFICATION AS READ
// ==========================================
router.patch("/:id/read", authenticateToken, async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const role = String(req.user.role || "").toLowerCase();

    const result = await db.query(
      `
        UPDATE notifications
        SET is_read = 1
        WHERE id = $1
          AND user_id = $2
          AND (
            $3 != 'employee'
            OR EXISTS (
              SELECT 1
              FROM tickets t
              WHERE t.id = notifications.ticket_id
                AND t.requester_id = $4
            )
          )
        RETURNING id
      `,
      [Number(req.params.id), userId, role, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Notification not found.",
      });
    }

    res.json({
      message: "Notification marked as read.",
    });
  } catch (error) {
    console.error("Failed to update notification:", error);

    res.status(500).json({
      message: "Failed to update notification.",
    });
  }
});

// ==========================================
// MARK ALL NOTIFICATIONS AS READ
// ==========================================
router.patch("/read-all", authenticateToken, async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const role = String(req.user.role || "").toLowerCase();

    await db.query(
      `
        UPDATE notifications
        SET is_read = 1
        WHERE user_id = $1
          AND is_read = 0
          AND (
            $2 != 'employee'
            OR EXISTS (
              SELECT 1
              FROM tickets t
              WHERE t.id = notifications.ticket_id
                AND t.requester_id = $3
            )
          )
      `,
      [userId, role, userId]
    );

    res.json({
      message: "All notifications marked as read.",
    });
  } catch (error) {
    console.error("Failed to mark notifications as read:", error);

    res.status(500).json({
      message: "Failed to mark notifications as read.",
    });
  }
});

// ==========================================
// ADMIN: REMIND IT STAFF ABOUT OUTSTANDING TICKETS
// ==========================================
router.post("/remind-all", authenticateToken, async (req, res) => {
  try {
    if (String(req.user.role || "").toLowerCase() !== "admin") {
      return res.status(403).json({
        message: "Only Admin can send ticket reminders.",
      });
    }

    const ticketsResult = await db.query(`
      SELECT
        id,
        ticket_number,
        title,
        assigned_to
      FROM tickets
      WHERE assigned_to IS NOT NULL
        AND status NOT IN ('Resolved', 'Closed')
    `);

    let created = 0;

    for (const ticket of ticketsResult.rows) {
      const result = await db.query(
        `
          INSERT INTO notifications (
            user_id,
            ticket_id,
            type,
            title,
            message
          )
          SELECT $1, $2, 'admin_reminder', $3, $4
          WHERE NOT EXISTS (
            SELECT 1
            FROM notifications
            WHERE user_id = $1
              AND ticket_id = $2
              AND type = 'admin_reminder'
              AND created_at::date = CURRENT_DATE
          )
          RETURNING id
        `,
        [
          ticket.assigned_to,
          ticket.id,
          `Reminder: ${ticket.ticket_number}`,
          `${ticket.title} is still outstanding. Please review this ticket.`,
        ]
      );

      created += result.rowCount;
    }

    res.json({
      message: "IT Staff reminders sent successfully.",
      created,
    });
  } catch (error) {
    console.error("Failed to send ticket reminders:", error);

    res.status(500).json({
      message: "Failed to send ticket reminders.",
    });
  }
});

// ==========================================
// CHECK UPCOMING SLA DEADLINES
// ==========================================
router.post("/check-sla", authenticateToken, async (req, res) => {
  try {
    const now = new Date();
    const limit = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const ticketsResult = await db.query(
      `
        SELECT
          id,
          ticket_number,
          title,
          requester_id,
          assigned_to
        FROM tickets
        WHERE sla_deadline > $1
          AND sla_deadline <= $2
          AND status NOT IN ('Resolved', 'Closed')
      `,
      [now, limit]
    );

    let created = 0;

    for (const ticket of ticketsResult.rows) {
      const recipients = [
        ...new Set(
          [ticket.requester_id, ticket.assigned_to]
            .filter((id) => id != null)
            .map(Number)
        ),
      ];

      for (const userId of recipients) {
        const result = await db.query(
          `
            INSERT INTO notifications (
              user_id,
              ticket_id,
              type,
              title,
              message
            )
            SELECT $1, $2, 'sla_approaching', $3, $4
            WHERE NOT EXISTS (
              SELECT 1
              FROM notifications
              WHERE user_id = $1
                AND ticket_id = $2
                AND type = 'sla_approaching'
            )
            RETURNING id
          `,
          [
            userId,
            ticket.id,
            `SLA deadline approaching: ${ticket.ticket_number}`,
            `${ticket.title} is due within 2 hours.`,
          ]
        );

        created += result.rowCount;
      }
    }

    res.json({
      message: "SLA notifications checked.",
      created,
    });
  } catch (error) {
    console.error("Failed to check SLA notifications:", error);

    res.status(500).json({
      message: "Failed to check SLA notifications.",
    });
  }
});

module.exports = router;
