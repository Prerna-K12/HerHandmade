const request = require("supertest");
const bcrypt = require("bcryptjs");
const { pool } = require("../src/db");
const app = require("../src/app");

const PASSWORD = "password123";
let counter = 0;

const daysFromNow = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

// A tiny valid JPEG header (the API checks the first bytes, not the file name).
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 1)]);
const jpegFile = { filename: "photo.jpg", contentType: "image/jpeg" };

async function resetDb() {
  await pool.query(
    `TRUNCATE users, groups, members, skills, group_skills, orders, order_events,
              assignments, assignment_media, broadcasts RESTART IDENTITY CASCADE`
  );
}

async function login(phone) {
  const agent = request.agent(app); // keeps the cookie, like a browser
  await agent.post("/api/auth/login").send({ phone, password: PASSWORD }).expect(200);
  return agent;
}

async function makeAdmin() {
  const hash = await bcrypt.hash(PASSWORD, 4);
  const phone = `90000${String(++counter).padStart(5, "0")}`;
  const u = await pool.query(
    "INSERT INTO users (name, phone, password_hash, role) VALUES ('Admin', $1, $2, 'admin') RETURNING id",
    [phone, hash]
  );
  return { id: u.rows[0].id, phone, agent: await login(phone) };
}

async function makeCaptain(name = "Captain", groupName = "Group", village = "Hosahalli", district = "Mysuru") {
  const hash = await bcrypt.hash(PASSWORD, 4);
  const phone = `91000${String(++counter).padStart(5, "0")}`;
  const u = await pool.query(
    "INSERT INTO users (name, phone, password_hash, role) VALUES ($1, $2, $3, 'leader') RETURNING id",
    [name, phone, hash]
  );
  const code = `T${String(counter).padStart(3, "0")}-ABCD`;
  const g = await pool.query(
    "INSERT INTO groups (name, village, district, leader_id, access_code) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [groupName, village, district, u.rows[0].id, code]
  );
  return { userId: u.rows[0].id, groupId: g.rows[0].id, phone, name, groupName, village, district, code, agent: await login(phone) };
}

async function makeSkill(name, aliases = []) {
  const r = await pool.query("INSERT INTO skills (name, aliases) VALUES ($1, $2) RETURNING id", [name, aliases]);
  return r.rows[0].id;
}

const rate = (groupId, skillId, rating) =>
  pool.query("INSERT INTO group_skills (group_id, skill_id, rating, verified) VALUES ($1, $2, $3, TRUE)", [groupId, skillId, rating]);

const validOrder = (overrides = {}) => ({
  businessName: "Bloom & Co",
  location: "Bengaluru, Karnataka",
  item: "Handmade rakhi",
  quantity: 500,
  deliveryDate: daysFromNow(120),
  email: "orders@bloomco.example",
  phone: "9876543210",
  website: "",
  ...overrides,
});

// Places an order through the public form and returns its ids.
async function makeOrder(overrides = {}) {
  const res = await request(app).post("/api/public/orders").send(validOrder(overrides)).expect(201);
  const row = await pool.query("SELECT id, tracking_token FROM orders WHERE order_ref = $1", [res.body.orderRef]);
  return { orderId: row.rows[0].id, orderRef: res.body.orderRef, token: row.rows[0].tracking_token };
}

// Admin + captain + an accepted order of 500 pieces, ready for assignments.
async function flow(overrides = {}) {
  const admin = await makeAdmin();
  const cap = await makeCaptain("Lakshmi", "Sunehri Sakhi Group", "Hosahalli", "Mysuru");
  const order = await makeOrder(overrides);
  await admin.agent.patch(`/api/orders/${order.orderId}/status`).send({ status: "accepted" }).expect(200);
  return { admin, cap, ...order };
}

async function assign(admin, orderId, groupId, quantity = 300, deadline = daysFromNow(30)) {
  const res = await admin.agent.post(`/api/orders/${orderId}/assignments`).send({ groupId, quantity, deadline }).expect(201);
  return res.body.assignment;
}

module.exports = {
  app, pool, request, PASSWORD, JPEG, jpegFile, daysFromNow,
  resetDb, login, makeAdmin, makeCaptain, makeSkill, rate, validOrder, makeOrder, flow, assign,
};
