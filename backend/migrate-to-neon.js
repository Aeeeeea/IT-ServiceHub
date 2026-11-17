
require("dotenv").config();

const Database = require("better-sqlite3");
const { Pool } = require("pg");

const sqlite = new Database("it_servicehub.db", {
  readonly: true
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const tables = [
  "users",
  "tickets",
  "ticket_comments",
  "notifications",
  "knowledge_articles",
  "ticket_attachments"
];

async function migrate() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Confirm Neon is empty before importing.
    for (const table of tables) {
      const result = await client.query(
        `SELECT COUNT(*)::int AS total FROM "${table}"`
      );

      if (result.rows[0].total !== 0) {
        throw new Error(
          `Neon table ${table} is not empty. Migration stopped.`
        );
      }
    }

    console.log("Neon tables verified as empty.");

    // Import in foreign-key dependency order.
    for (const table of tables) {
      const rows = sqlite.prepare(
        `SELECT * FROM "${table}"`
      ).all();

      if (rows.length === 0) {
        console.log(`${table}: 0 records`);
        continue;
      }

      const columns = Object.keys(rows[0]);

      const columnNames = columns
        .map(column => `"${column}"`)
        .join(", ");

      const placeholders = columns
        .map((_, index) => `$${index + 1}`)
        .join(", ");

      const insertSQL = `
        INSERT INTO "${table}" (${columnNames})
        VALUES (${placeholders})
      `;

      for (const row of rows) {
        const values = columns.map(column => row[column]);

        await client.query(insertSQL, values);
      }

      console.log(`${table}: ${rows.length} records imported.`);
    }

    // Reset PostgreSQL auto-increment sequences.
    for (const table of [
      "users",
      "tickets",
      "ticket_comments",
      "notifications",
      "knowledge_articles",
      "ticket_attachments"
    ]) {
      await client.query(`
        SELECT setval(
          pg_get_serial_sequence('"${table}"', 'id'),
          COALESCE((SELECT MAX(id) FROM "${table}"), 1),
          EXISTS (SELECT 1 FROM "${table}")
        )
      `);
    }

    await client.query("COMMIT");

    console.log("\nSUCCESS: All SQLite records migrated to Neon!");

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("\nMIGRATION FAILED:", error.message);
  } finally {
    client.release();
    sqlite.close();
    await pool.end();
  }
}

migrate();

