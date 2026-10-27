// One connection pool for the whole app. All SQL goes through query() or
// withTransaction().
const { Pool, types } = require("pg");
const env = require("./config/env");

// DATE columns come back as plain "YYYY-MM-DD" strings (not JS Dates),
// so there are no timezone surprises.
types.setTypeParser(1082, (value) => value);
// COUNT()/SUM() produce bigint; return them as numbers.
types.setTypeParser(20, (value) => parseInt(value, 10));

const pool = new Pool({ connectionString: env.databaseUrl });

const query = (text, params) => pool.query(text, params);

// Runs fn(client) inside BEGIN ... COMMIT. Rolls back if fn throws.
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
