const jwt = require("jsonwebtoken");

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "it_servicehub_secret_change_this_later";

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;

  if (!token) {
    return res.status(401).json({
      message: "Authentication required.",
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token.",
    });
  }
}

function requireITAccess(req, res, next) {
  if (
    req.user.role !== "admin" &&
    req.user.role !== "it_staff"
  ) {
    return res.status(403).json({
      message:
        "Only Admin and IT Staff can assign tickets.",
    });
  }

  next();
}

module.exports = {
  authenticateToken,
  requireITAccess,
};