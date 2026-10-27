// npm run db:init   -> creates all tables from db/schema.sql (empty database)
// npm run db:reset  -> DELETES everything, then recreates the tables (development only)
const fs = require("fs");
const path = require("path");
const env = require("../src/config/env");
const { pool } = require("../src/db");

async function main() {
  const reset = process.argv.includes("--reset");
  if (reset && env.nodeEnv === "production" && !process.argv.includes("--force")) {
    throw new Error("Refusing to reset a production database. Add --force if you really mean it.");
  }
  if (reset) {
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    console.log("Old tables removed.");
  }
  const sql = fs.readFileSync(path.join(__dirname, "../db/schema.sql"), "utf8");
  await pool.query(sql);
  console.log("Database tables created.");
}

main()
  .catch((err) => {
    console.error("db:init failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
