// requireAuth: reads the httpOnly cookie, checks the user is still active.
// requireRole: allows only the listed roles.
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { query } = require("../db");
const AppError = require("../utils/AppError");

const notLoggedIn = () => new AppError(401, "UNAUTHENTICATED", "Please log in");

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies && req.cookies.token;
    if (!token) throw notLoggedIn();

    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch {
      throw notLoggedIn();
    }

    // Checked on every request, so a deactivated captain is locked out immediately.
    const { rows } = await query(
      `SELECT u.id, u.name, u.phone, u.role, g.id AS group_id
         FROM users u
         LEFT JOIN groups g ON g.leader_id = u.id
        WHERE u.id = $1 AND u.active`,
      [payload.id]
    );
    if (!rows[0]) throw notLoggedIn();

    const u = rows[0];
    req.user = { id: u.id, name: u.name, phone: u.phone, role: u.role, groupId: u.group_id };
    next();
  } catch (err) {
    next(err);
  }
}

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role)
    ? next()
    : next(new AppError(403, "FORBIDDEN", "Not allowed for your role"));

module.exports = { requireAuth, requireRole };
