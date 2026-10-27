// npm run seed                  -> admin account + starter skills (safe to run again)
// npm run seed:demo             -> also 3 demo captains with ratings and one demo order
// node scripts/seed.js --reset-admin -> set the admin's password back to SEED_ADMIN_PASSWORD
const bcrypt = require("bcryptjs");
const env = require("../src/config/env");
const { pool, query } = require("../src/db");
const { accessCode, trackingToken, orderRef } = require("../src/utils/ids");

const SKILLS = [
  ["Rakhi", ["rakhee", "राखी", "ರಾಖಿ", "rakshabandhan"]],
  ["Gift hamper", ["hamper", "gift box", "giftbox"]],
  ["Scented candle", ["candle", "candles"]],
  ["Embroidered bag", ["bag", "embroidery", "jute bag"]],
  ["Terracotta craft", ["terracotta", "pottery", "clay"]],
  ["Bamboo craft", ["bamboo", "basket"]],
];

async function seedAdmin(resetOnly) {
  if (env.nodeEnv === "production" && !process.env.SEED_ADMIN_PASSWORD) {
    throw new Error("Set SEED_ADMIN_PASSWORD in .env before creating the admin on a live server.");
  }
  const hash = await bcrypt.hash(env.seed.adminPassword, env.bcryptRounds);
  const existing = await query("SELECT id FROM users WHERE phone = $1", [env.seed.adminPhone]);
  if (existing.rows[0]) {
    if (resetOnly) {
      await query("UPDATE users SET password_hash = $1, active = TRUE WHERE id = $2", [hash, existing.rows[0].id]);
      console.log(`Admin password reset for ${env.seed.adminPhone}.`);
    } else {
      console.log("Admin already exists.");
    }
    return;
  }
  await query(
    "INSERT INTO users (name, phone, password_hash, role) VALUES ($1, $2, $3, 'admin')",
    [env.seed.adminName, env.seed.adminPhone, hash]
  );
  console.log(`Admin created. Login: ${env.seed.adminPhone} / ${env.seed.adminPassword}`);
}

async function seedSkills() {
  for (const [name, aliases] of SKILLS) {
    await query(
      "INSERT INTO skills (name, aliases) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [name, aliases.map((a) => a.toLowerCase())]
    );
  }
  console.log("Starter skills ready.");
}

async function seedDemo() {
  const done = await query("SELECT 1 FROM users WHERE role = 'leader' LIMIT 1");
  if (done.rowCount > 0) return console.log("Demo data skipped: captains already exist.");

  const hash = await bcrypt.hash("captain123", env.bcryptRounds);
  const demo = [
    ["Lakshmi Devi", "9000000011", "Sunehri Sakhi Group", "Hosahalli", "Mysuru", { Rakhi: 5, "Gift hamper": 4 }],
    ["Savitri Bai", "9000000012", "Kesari Mahila Mandal", "Chikkahalli", "Mandya", { Rakhi: 5, "Scented candle": 4 }],
    ["Radha Gowda", "9000000013", "Nayi Kiran Collective", "Doddabetta", "Kodagu", { Rakhi: 4, "Bamboo craft": 5 }],
  ];
  const skills = (await query("SELECT id, name FROM skills")).rows;

  for (const [name, phone, gName, village, district, rated] of demo) {
    const u = await query(
      "INSERT INTO users (name, phone, password_hash, role) VALUES ($1, $2, $3, 'leader') RETURNING id",
      [name, phone, hash]
    );
    const g = await query(
      "INSERT INTO groups (name, village, district, leader_id, access_code) VALUES ($1, $2, $3, $4, $5) RETURNING id, access_code",
      [gName, village, district, u.rows[0].id, accessCode()]
    );
    for (const [skillName, rating] of Object.entries(rated)) {
      const skill = skills.find((s) => s.name === skillName);
      await query("INSERT INTO group_skills (group_id, skill_id, rating, verified) VALUES ($1, $2, $3, TRUE)", [g.rows[0].id, skill.id, rating]);
    }
    console.log(`Demo captain: ${phone} / captain123  (${gName}, group link code ${g.rows[0].access_code})`);
  }

  const next = new Date();
  next.setFullYear(next.getFullYear() + 1);
  const o = await query(
    `INSERT INTO orders (order_ref, tracking_token, business_name, location, item, quantity, delivery_date, email, phone)
     VALUES ($1, $2, 'Bloom & Co', 'Bengaluru, Karnataka', 'Handmade rakhi', 500, $3, 'orders@bloomco.example', '9876543210')
     RETURNING id, order_ref, tracking_token`,
    [orderRef(), trackingToken(), next.toISOString().slice(0, 10)]
  );
  await query("INSERT INTO order_events (order_id, status) VALUES ($1, 'submitted')", [o.rows[0].id]);
  console.log(`Demo order ${o.rows[0].order_ref} created. Tracking link: ${env.publicBaseUrl}/track/${o.rows[0].tracking_token}`);
}

async function main() {
  const resetOnly = process.argv.includes("--reset-admin");
  await seedAdmin(resetOnly);
  if (resetOnly) return;
  await seedSkills();
  if (process.argv.includes("--demo")) await seedDemo();
}

main()
  .catch((err) => {
    console.error("seed failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
