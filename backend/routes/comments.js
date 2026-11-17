
const express = require("express");
const db = require("../database-pg");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

async function getAccessibleTicket(ticketId, user) {
  const result = await db.query(
    `SELECT * FROM tickets
     WHERE id::text = $1 OR ticket_number = $1
     LIMIT 1`,
    [String(ticketId)]
  );

  const ticket = result.rows[0];

  if (!ticket) {
    return { error: "Ticket not found.", status: 404 };
  }

  const isAdmin = user.role === "admin";
  const isRequester =
    Number(ticket.requester_id) === Number(user.id);

  const isAssignedStaff =
    user.role === "it_staff" &&
    Number(ticket.assigned_to) === Number(user.id);

  if (!isAdmin && !isRequester && !isAssignedStaff) {
    return {
      error: "You do not have permission to access this ticket.",
      status: 403,
    };
  }

  return { ticket };
}

async function getCommentById(id) {
  const result = await db.query(
    `SELECT
       ticket_comments.id,
       ticket_comments.ticket_id,
       ticket_comments.user_id,
       ticket_comments.comment,
       ticket_comments.created_at,
       users.name AS user_name,
       users.role AS user_role
     FROM ticket_comments
     JOIN users ON ticket_comments.user_id = users.id
     WHERE ticket_comments.id = $1`,
    [id]
  );

  return result.rows[0];
}

// Load comments for an authorized ticket
router.get("/ticket/:ticketId", authenticateToken, async (req, res) => {
  try {
    const access = await getAccessibleTicket(
      req.params.ticketId,
      req.user
    );

    if (access.error) {
      return res.status(access.status).json({
        message: access.error,
      });
    }

    const result = await db.query(
      `SELECT
         ticket_comments.id,
         ticket_comments.ticket_id,
         ticket_comments.user_id,
         ticket_comments.comment,
         ticket_comments.created_at,
         users.name AS user_name,
         users.role AS user_role
       FROM ticket_comments
       JOIN users ON ticket_comments.user_id = users.id
       WHERE ticket_comments.ticket_id = $1
       ORDER BY ticket_comments.created_at ASC,
                ticket_comments.id ASC`,
      [access.ticket.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Failed to load comments:", error);

    res.status(500).json({
      message: "Failed to load comments.",
    });
  }
});

// Add a comment to an authorized ticket
router.post("/ticket/:ticketId", authenticateToken, async (req, res) => {
  try {
    const access = await getAccessibleTicket(
      req.params.ticketId,
      req.user
    );

    if (access.error) {
      return res.status(access.status).json({
        message: access.error,
      });
    }

    const comment =
      typeof req.body.comment === "string"
        ? req.body.comment.trim()
        : "";

    if (!comment) {
      return res.status(400).json({
        message: "Comment cannot be empty.",
      });
    }

    if (comment.length > 5000) {
      return res.status(400).json({
        message: "Comment must be 5,000 characters or fewer.",
      });
    }

    const result = await db.query(
      `INSERT INTO ticket_comments (ticket_id, user_id, comment)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [access.ticket.id, req.user.id, comment]
    );

    try {
      const recipients = [
        ...new Set(
          [access.ticket.requester_id, access.ticket.assigned_to]
            .filter(id => id != null)
            .map(Number)
        ),
      ];

      for (const userId of recipients) {
        if (userId === Number(req.user.id)) continue;

        await db.query(
          `INSERT INTO notifications
             (user_id, ticket_id, type, title, message)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            userId,
            access.ticket.id,
            "ticket_comment",
            `New comment on ${access.ticket.ticket_number}`,
            `${req.user.name || "Someone"} added a comment.`,
          ]
        );
      }
    } catch (notificationError) {
      console.error(
        "Comment added, but notification creation failed:",
        notificationError
      );
    }

    const newComment = await getCommentById(result.rows[0].id);

    res.status(201).json({
      message: "Comment added successfully.",
      comment: newComment,
    });
  } catch (error) {
    console.error("Failed to add comment:", error);

    res.status(500).json({
      message: "Failed to add comment.",
    });
  }
});

module.exports = router;
