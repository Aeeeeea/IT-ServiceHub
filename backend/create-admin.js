const bcrypt = require("bcryptjs");
const db = require("./database");

const name = "System Admin";
const email = "admin@servicehub.com";
const password = "Admin123!";

try {
  const existingUser = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(email);

  if (existingUser) {
    console.log("Admin account already exists.");
    process.exit(0);
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  const result = db
    .prepare(`
      INSERT INTO users (name, email, password, role)
      VALUES (?, ?, ?, ?)
    `)
    .run(name, email, hashedPassword, "admin");

  console.log("Admin account created successfully!");
  console.log("--------------------------------");
  console.log("Name:", name);
  console.log("Email:", email);
  console.log("Password:", password);
  console.log("Role: admin");
  console.log("User ID:", result.lastInsertRowid);
} catch (error) {
  console.error("Failed to create admin:", error);
} finally {
  db.close();
}