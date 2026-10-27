const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const env = require("../../config/env");
const { query } = require("../../db");
const AppError = require("../../utils/AppError");

// Compared when the phone is unknown, so response time does not reveal which phones exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", env.bcryptRounds);

async function profile(userId) {
  const { rows } = await query(
    `SELECT u.id, u.name, u.phone, u.role,
            g.id AS group_id, g.name AS group_name, g.village, g.district
       FROM users u
       LEFT JOIN groups g ON g.leader_id = u.id
      WHERE u.id = $1`,
    [userId]
  );
  const r = rows[0];
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    role: r.role,
    group: r.group_id ? { id: r.group_id, name: r.group_name, village: r.village, district: r.district } : null,
  };
}

async function login(phone, password) {
  const { rows } = await query(
    "SELECT id, password_hash, role, active FROM users WHERE phone = $1",
    [phone]
  );
  const user = rows[0];
  const passwordOk = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !user.active || !passwordOk) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid phone or password");
  }
  const token = jwt.sign({ id: user.id, role: user.role }, env.jwtSecret, { expiresIn: "7d" });
  return { token, user: await profile(user.id) };
}

module.exports = { login, profile };
