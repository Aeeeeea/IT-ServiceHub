require("dotenv").config();

const bcrypt = require("bcryptjs");
const db = require("./database-pg");

async function createAdmin() {
  const name = process.env.ADMIN_NAME;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error(
      "Please provide ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD."
    );
  }

  if (password.length < 8) {
    throw new Error("Admin password must contain at least 8 characters.");
  }

  try {
    const existingUser = await db.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    if (existingUser.rows.length > 0) {
      console.log("Admin account already exists.");
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.query(
      `
        INSERT INTO users (name, email, password, role)
        VALUES ($1, $2, $3, 'admin')
        RETURNING id, name, email, role
      `,
      [name, email, hashedPassword]
    );

    console.log("Admin account created successfully!");
    console.log(result.rows[0]);
  } finally {
    await db.end();
  }
}

createAdmin().catch((error) => {
  console.error("Failed to create admin:", error.message);
  process.exitCode = 1;
});
