const express = require("express");
const db = require("../database");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Get notifications belonging only to the logged-in user
router.get("/", authenticateToken, (req, res) => {
  try {
    const userId = Number(req.user.id);

    const notifications = db.prepare(`
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
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT 50
    `).all(userId);

    res.json(notifications);
  } catch (error) {
    console.error("Failed to load notifications:", error);
    res.status(500).json({ message: "Failed to load notifications." });
  }
});

// Get unread notification count
router.get("/unread-count", authenticateToken, (req, res) => {
  try {
    const result = db.prepare(`
      SELECT COUNT(*) AS count
      FROM notifications
      WHERE user_id = ? AND is_read = 0
    `).get(Number(req.user.id));

    res.json({ count: result.count });
  } catch (error) {
    console.error("Failed to count notifications:", error);
    res.status(500).json({ message: "Failed to count notifications." });
  }
});

// Mark one of the current user's notifications as read
router.patch("/:id/read", authenticateToken, (req, res) => {
  try {
    const result = db.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE id = ? AND user_id = ?
    `).run(Number(req.params.id), Number(req.user.id));

    if (result.changes === 0) {
      return res.status(404).json({
        message: "Notification not found."
      });
    }

    res.json({ message: "Notification marked as read." });
  } catch (error) {
    console.error("Failed to update notification:", error);
    res.status(500).json({
      message: "Failed to update notification."
    });
  }
});

// Mark all notifications belonging to the current user as read
router.patch("/read-all", authenticateToken, (req, res) => {
  try {
    db.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE user_id = ? AND is_read = 0
    `).run(Number(req.user.id));

    res.json({ message: "All notifications marked as read." });
  } catch (error) {
    console.error("Failed to mark notifications as read:", error);
    res.status(500).json({
      message: "Failed to mark notifications as read."
    });
  }
});


router.post("/check-sla", authenticateToken, (req, res) => {
  try {
    const now = new Date();
    const limit = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const sqlDate = d => d.toISOString().slice(0, 19).replace("T", " ");
    const tickets = db.prepare(`
      SELECT id, ticket_number, title, requester_id, assigned_to
      FROM tickets
      WHERE sla_deadline > ? AND sla_deadline <= ?
        AND status NOT IN ('Resolved', 'Closed')
    `).all(sqlDate(now), sqlDate(limit));

    const insert = db.prepare(`
      INSERT INTO notifications (user_id, ticket_id, type, title, message)
      SELECT ?, ?, 'sla_approaching', ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE user_id = ? AND ticket_id = ? AND type = 'sla_approaching'
      )
    `);
    let created = 0;
    for (const ticket of tickets) {
      const recipients = [...new Set([ticket.requester_id, ticket.assigned_to].filter(x => x != null).map(Number))];
      for (const userId of recipients) {
        created += insert.run(userId, ticket.id,
          `SLA deadline approaching: ${ticket.ticket_number}`,
          `${ticket.title} is due within 2 hours.`,
          userId, ticket.id).changes;
      }
    }
    res.json({ message: "SLA notifications checked.", created });
  } catch (error) {
    console.error("Failed to check SLA notifications:", error);
    res.status(500).json({ message: "Failed to check SLA notifications." });
  }
});

module.exports = router;