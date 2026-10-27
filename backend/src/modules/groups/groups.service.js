const { query, withTransaction } = require("../../db");
const AppError = require("../../utils/AppError");
const camel = require("../../utils/camel");
const { accessCode } = require("../../utils/ids");
const ratingPolicy = require("./ratingPolicy");

// ---------------------------------------------------------------------------
// GROUP MATCHING (the headline feature)
// "Which groups should make 500 rakhis?"  Returns the top 10 groups.
//
//  best_rated: rating high -> low, then free-now first, then soonest free
//  fastest:    free-now first, then soonest free, then rating high -> low
//
// "free now" = the group has no open assignment (next_free_date is null).
// "next free date" = the latest deadline among the group's open assignments.
// ---------------------------------------------------------------------------
async function findSkill(q) {
  const term = q.toLowerCase();
  const { rows } = await query(
    `SELECT id, name FROM skills
      WHERE lower(name) = $1 OR $1 = ANY(aliases)
         OR lower(name) LIKE $1 || '%'
      ORDER BY (lower(name) = $1 OR $1 = ANY(aliases)) DESC, name
      LIMIT 1`,
    [term]
  );
  if (!rows[0]) throw new AppError(404, "SKILL_NOT_FOUND", `No skill matches "${q}"`);
  return rows[0];
}

// Date strings (YYYY-MM-DD) compare correctly as text. "" sorts before any date, so null = free now.
const freeAt = (g) => g.nextFreeDate || "";
const byRating = (a, b) => ratingPolicy.effectiveRating(b) - ratingPolicy.effectiveRating(a);
const byFree = (a, b) => (freeAt(a) < freeAt(b) ? -1 : freeAt(a) > freeAt(b) ? 1 : 0);
const byName = (a, b) => a.name.localeCompare(b.name);

const SORTS = {
  best_rated: (a, b) => byRating(a, b) || byFree(a, b) || byName(a, b),
  fastest: (a, b) => byFree(a, b) || byRating(a, b) || byName(a, b),
};

async function matchGroups(q, mode) {
  const skill = await findSkill(q);

  const { rows } = await query(
    `SELECT g.id AS group_id, g.name, g.village, g.district, gs.rating, gs.verified,
            COUNT(a.id)::int AS queue_length,
            MIN(a.deadline)  AS first_deadline,
            MAX(a.deadline)  AS next_free_date,
            (ARRAY_AGG(o.item ORDER BY a.deadline))[1] AS current_item
       FROM group_skills gs
       JOIN groups g ON g.id = gs.group_id AND g.active
       LEFT JOIN assignments a ON a.group_id = g.id AND a.status IN ('assigned', 'accepted')
       LEFT JOIN orders o ON o.id = a.order_id
      WHERE gs.skill_id = $1
      GROUP BY g.id, gs.rating, gs.verified`,
    [skill.id]
  );

  const groups = rows.map((r) => ({
    groupId: r.group_id,
    name: r.name,
    village: r.village,
    district: r.district,
    rating: r.rating,
    verified: r.verified,
    currentTask: r.current_item ? { item: r.current_item, deadline: r.first_deadline } : null,
    queueLength: r.queue_length,
    nextFreeDate: r.next_free_date,
  }));

  return {
    query: q,
    mode,
    skill,
    results: groups.sort(SORTS[mode]).slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// Admin: set a group's skills and ratings (replaces the whole list)
// ---------------------------------------------------------------------------
async function setSkills(user, groupId, skills) {
  ratingPolicy.assertCanSetRating(user);
  ratingPolicy.assertValidEntries(skills);

  return withTransaction(async (client) => {
    const g = await client.query("SELECT id, name FROM groups WHERE id = $1 AND active", [groupId]);
    if (!g.rows[0]) throw new AppError(404, "NOT_FOUND", "Group not found");

    await client.query("DELETE FROM group_skills WHERE group_id = $1", [groupId]);
    for (const s of skills) {
      await client.query(
        "INSERT INTO group_skills (group_id, skill_id, rating, verified) VALUES ($1, $2, $3, $4)",
        [groupId, s.skillId, s.rating, s.verified]
      );
    }
    const out = await client.query(
      `SELECT s.id AS skill_id, s.name, gs.rating, gs.verified
         FROM group_skills gs JOIN skills s ON s.id = gs.skill_id
        WHERE gs.group_id = $1 ORDER BY s.name`,
      [groupId]
    );
    return { id: g.rows[0].id, name: g.rows[0].name, skills: camel(out.rows) };
  });
}

// ---------------------------------------------------------------------------
// Captain: her own group, roster and group link
// ---------------------------------------------------------------------------
async function getMine(user) {
  const g = await query(
    "SELECT id, name, village, district, access_code FROM groups WHERE id = $1",
    [user.groupId]
  );
  const members = await query("SELECT id, name FROM members WHERE group_id = $1 ORDER BY name", [user.groupId]);
  const skills = await query(
    `SELECT s.id AS skill_id, s.name, gs.rating, gs.verified
       FROM group_skills gs JOIN skills s ON s.id = gs.skill_id
      WHERE gs.group_id = $1 ORDER BY s.name`,
    [user.groupId]
  );
  return { ...camel(g.rows[0]), members: members.rows, skills: camel(skills.rows) };
}

async function addMember(user, name) {
  await query("INSERT INTO members (group_id, name) VALUES ($1, $2)", [user.groupId, name]);
  return getMine(user);
}

async function removeMember(user, memberId) {
  const { rowCount } = await query("DELETE FROM members WHERE id = $1 AND group_id = $2", [memberId, user.groupId]);
  if (rowCount === 0) throw new AppError(404, "NOT_FOUND", "Member not found");
}

// New code: the old group link stops working immediately.
async function regenerateCode(user) {
  for (let i = 0; i < 10; i++) {
    const code = accessCode();
    const taken = await query("SELECT 1 FROM groups WHERE access_code = $1", [code]);
    if (taken.rowCount === 0) {
      await query("UPDATE groups SET access_code = $1 WHERE id = $2", [code, user.groupId]);
      return code;
    }
  }
  throw new Error("Could not generate a unique access code");
}

module.exports = { matchGroups, setSkills, getMine, addMember, removeMember, regenerateCode };
