// Runs once before all tests: recreates every table in the TEST database.
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

module.exports = async () => {
  require("./env");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await client.query(fs.readFileSync(path.join(__dirname, "../db/schema.sql"), "utf8"));
  await client.end();
};
