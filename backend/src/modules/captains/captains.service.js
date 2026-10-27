const bcrypt = require("bcryptjs");
const env = require("../../config/env");
const { query, withTransaction } = require("../../db");
const AppError = require("../../utils/AppError");
const camel = require("../../utils/camel");
const { accessCode } = require("../../utils/ids");

async function uniqueAccessCode(client) {
  for (let i = 0; i < 10; i++) {
    const code = accessCode();
    const taken = await client.query("SELECT 1 FROM groups WHERE access_code = $1", [code]);
    if (taken.rowCount === 0) return code;
  }
  throw new Error("Could not generate a unique access code");
}

async function list() {
  const { rows } = await query(
    `SELECT u.id, u.name, u.phone, u.active,
            g.id AS group_id, g.name AS group_name, g.village, g.district,
            COALESCE((SELECT json_agg(json_build_object('skillId', s.id, 'name', s.name,
                                                        'rating', gs.rating, 'verified', gs.verified)
                                      ORDER BY s.name)
                        FROM group_skills gs JOIN skills s ON s.id = gs.skill_id
                       WHERE gs.group_id = g.id), '[]'::json) AS skills,
            (SELECT COUNT(*)::int FROM assignments a
              WHERE a.group_id = g.id AND a.status IN ('assigned', 'accepted')) AS open_assignments
       FROM users u
       JOIN groups g ON g.leader_id = u.id
      WHERE u.role = 'leader'
      ORDER BY u.active DESC, u.name`
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    active: r.active,
    group: {
      id: r.group_id,
      name: r.group_name,
      village: r.village,
      district: r.district,
      skills: r.skills,
      openAssignments: r.open_assignments,
    },
  }));
}

// Creates the captain's login and her group together.
async function create({ name, phone, password, group }) {
  const hash = await bcrypt.hash(password, env.bcryptRounds);
  return withTransaction(async (client) => {
    const u = await client.query(
      `INSERT INTO users (name, phone, password_hash, role)
       VALUES ($1, $2, $3, 'leader') RETURNING id, name, phone, role, active`,
      [name, phone, hash]
    );
    const g = await client.query(
      `INSERT INTO groups (name, village, district, leader_id, access_code)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, village, district, access_code, active`,
      [group.name, group.village, group.district, u.rows[0].id, await uniqueAccessCode(client)]
    );
    return { captain: camel(u.rows[0]), group: { ...camel(g.rows[0]), skills: [], members: [] } };
  });
}

async function resetPassword(id, password) {
  const hash = await bcrypt.hash(password, env.bcryptRounds);
  const { rowCount } = await query(
    "UPDATE users SET password_hash = $1 WHERE id = $2 AND role = 'leader'",
    [hash, id]
  );
  if (rowCount === 0) throw new AppError(404, "NOT_FOUND", "Captain not found");
}

// Blocks her login, removes her group from matching and disables her group link.
async function deactivate(id) {
  await withTransaction(async (client) => {
    const found = await client.query(
      `SELECT g.id AS group_id FROM users u JOIN groups g ON g.leader_id = u.id
        WHERE u.id = $1 AND u.role = 'leader' FOR UPDATE OF u`,
      [id]
    );
    if (!found.rows[0]) throw new AppError(404, "NOT_FOUND", "Captain not found");
    const groupId = found.rows[0].group_id;

    const open = await client.query(
      "SELECT 1 FROM assignments WHERE group_id = $1 AND status IN ('assigned', 'accepted') LIMIT 1",
      [groupId]
    );
    if (open.rowCount > 0) {
      throw new AppError(409, "ASSIGNMENT_OPEN", "Reassign this group's open assignments first");
    }
    await client.query("UPDATE users SET active = FALSE WHERE id = $1", [id]);
    await client.query("UPDATE groups SET active = FALSE WHERE id = $1", [groupId]);
  });
}

module.exports = { list, create, resetPassword, deactivate };
