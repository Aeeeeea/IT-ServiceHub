const db = require("../database");

const insertNotification = db.prepare(`
  INSERT INTO notifications (
    user_id,
    ticket_id,
    type,
    title,
    message
  )
  VALUES (?, ?, ?, ?, ?)
`);

function createNotification({
  userId,
  ticketId = null,
  type = "general",
  title,
  message = "",
}) {
  const recipientId = Number(userId);

  if (!Number.isInteger(recipientId) || recipientId <= 0) {
    return null;
  }

  if (typeof title !== "string" || !title.trim()) {
    return null;
  }

  const result = insertNotification.run(
    recipientId,
    ticketId == null ? null : Number(ticketId),
    type,
    title.trim(),
    typeof message === "string" ? message.trim() : ""
  );

  return result.lastInsertRowid;
}

function notifyUsers(userIds, notification) {
  const uniqueIds = [...new Set(
    (userIds || [])
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0)
  )];

  return uniqueIds
    .filter((id) => id !== Number(notification.excludeUserId))
    .map((userId) =>
      createNotification({
        ...notification,
        userId,
      })
    );
}

module.exports = {
  createNotification,
  notifyUsers,
};
