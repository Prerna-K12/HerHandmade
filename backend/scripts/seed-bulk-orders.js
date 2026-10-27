// npm run seed:bulk
// Inserts 50,000 fake orders, then prints EXPLAIN ANALYZE for the main queries.
// Use the output for docs/PERFORMANCE.md. DELETE the fake rows afterwards:
//   DELETE FROM orders WHERE order_ref LIKE 'BULK-%';
require("../src/config/env");
const { pool } = require("../src/db");

async function explain(title, sql, params = []) {
  const { rows } = await pool.query(`EXPLAIN (ANALYZE, BUFFERS) ${sql}`, params);
  console.log(`\n=== ${title} ===`);
  rows.forEach((r) => console.log(r["QUERY PLAN"]));
}

async function main() {
  const existing = await pool.query("SELECT COUNT(*)::int AS n FROM orders WHERE order_ref LIKE 'BULK-%'");
  if (existing.rows[0].n === 0) {
    await pool.query(`
      INSERT INTO orders (order_ref, tracking_token, business_name, location, item, quantity,
                          delivery_date, email, status)
      SELECT 'BULK-' || g, md5(g::text || random()::text), 'Business ' || (g % 500), 'City ' || (g % 50),
             (ARRAY['Handmade rakhi','Gift hamper','Scented candle','Embroidered bag','Terracotta lamp'])[1 + g % 5],
             10 + (g % 990), current_date + (g % 365), 'b' || (g % 500) || '@example.com',
             (ARRAY['submitted','accepted','in_production','completed','dispatched','delivered'])[1 + g % 6]
        FROM generate_series(1, 50000) g`);
    console.log("Inserted 50,000 orders.");
  }
  await pool.query("ANALYZE orders");

  await explain("Admin list, filtered by status (uses idx_orders_status_id)",
    "SELECT id, order_ref, item, status FROM orders WHERE status = $1 ORDER BY id DESC LIMIT 20", ["submitted"]);
  await explain("Admin list, page 100 (offset)",
    "SELECT id, order_ref, item, status FROM orders ORDER BY id DESC LIMIT 20 OFFSET 1980");
  await explain("Search with ILIKE (no index can help a leading %)",
    "SELECT id, order_ref, item FROM orders WHERE item ILIKE $1 OR business_name ILIKE $1 ORDER BY id DESC LIMIT 20", ["%rakhi%"]);
  await explain("Tracking lookup by token (uses the UNIQUE index)",
    "SELECT id FROM orders WHERE tracking_token = (SELECT tracking_token FROM orders LIMIT 1)");
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
