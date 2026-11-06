
const express = require("express");
const db = require("../database");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

function getAccessibleTicket(ticketId, user) {
  const ticket = db
    .prepare("SELECT * FROM tickets WHERE id = ? OR ticket_number = ?")
    .get(ticketId, ticketId);

  if (!ticket) return { error: "Ticket not found.", status: 404 };

  const isAdmin = user.role === "admin";
  const isRequester = Number(ticket.requester_id) === Number(user.id);
  const isAssignedStaff =
    user.role === "it_staff" &&
    Number(ticket.assigned_to) === Number(user.id);

  if (!isAdmin && !isRequester && !isAssignedStaff) {
    return { error: "You do not have permission to access this ticket.", status: 403 };
  }

  return { ticket };
}

function getCommentById(id) {
  return db
    .prepare(`
      SELECT
        ticket_comments.id,
        ticket_comments.ticket_id,
        ticket_comments.user_id,
        ticket_comments.comment,
        ticket_comments.created_at,
        users.name AS user_name,
        users.role AS user_role
      FROM ticket_comments
      JOIN users ON ticket_comments.user_id = users.id
      WHERE ticket_comments.id = ?
    `)
    .get(id);
}

// Load comments for an authorized ticket
router.get("/ticket/:ticketId", authenticateToken, (req, res) => {
  try {
    const access = getAccessibleTicket(req.params.ticketId, req.user);

    if (access.error) {
      return res.status(access.status).json({ message: access.error });
    }

    const comments = db
      .prepare(`
        SELECT
          ticket_comments.id,
          ticket_comments.ticket_id,
          ticket_comments.user_id,
          ticket_comments.comment,
          ticket_comments.created_at,
          users.name AS user_name,
          users.role AS user_role
        FROM ticket_comments
        JOIN users ON ticket_comments.user_id = users.id
        WHERE ticket_comments.ticket_id = ?
        ORDER BY ticket_comments.created_at ASC, ticket_comments.id ASC
      `)
      .all(access.ticket.id);

    res.json(comments);
  } catch (error) {
    console.error("Failed to load comments:", error);
    res.status(500).json({ message: "Failed to load comments." });
  }
});

// Add a comment to an authorized ticket
router.post("/ticket/:ticketId", authenticateToken, (req, res) => {
  try {
    const access = getAccessibleTicket(req.params.ticketId, req.user);

    if (access.error) {
      return res.status(access.status).json({ message: access.error });
    }

    const comment =
      typeof req.body.comment === "string" ? req.body.comment.trim() : "";

    if (!comment) {
      return res.status(400).json({ message: "Comment cannot be empty." });
    }

    if (comment.length > 5000) {
      return res.status(400).json({ message: "Comment must be 5,000 characters or fewer." });
    }

    const result = db
      .prepare(`
        INSERT INTO ticket_comments (ticket_id, user_id, comment)
        VALUES (?, ?, ?)
      `)
      .run(access.ticket.id, req.user.id, comment);

    try {
      const recipients = [...new Set(
        [access.ticket.requester_id, access.ticket.assigned_to]
          .filter(id => id != null).map(Number)
      )];
      recipients.forEach(userId => {
        if (userId === Number(req.user.id)) return;
        db.prepare("INSERT INTO notifications (user_id, ticket_id, type, title, message) VALUES (?, ?, ?, ?, ?)")
          .run(userId, access.ticket.id, "ticket_comment",
            `New comment on ${access.ticket.ticket_number}`,
            `${req.user.name || "Someone"} added a comment.`);
      });
    } catch (notificationError) {
      console.error("Comment added, but notification creation failed:", notificationError);
    }

    res.status(201).json({
      message: "Comment added successfully.",
      comment: getCommentById(result.lastInsertRowid),
    });
  } catch (error) {
    console.error("Failed to add comment:", error);
    res.status(500).json({ message: "Failed to add comment." });
  }
});

module.exports = router;