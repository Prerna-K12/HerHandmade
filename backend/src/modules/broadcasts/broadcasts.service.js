const { query } = require("../../db");
const AppError = require("../../utils/AppError");
const storage = require("../../services/storage");

const defaultUrl = (fileName) => `/api/media/${fileName}`;

function shape(r, urlFor) {
  return {
    id: r.id,
    audience: r.audience,
    targetGroupId: r.target_group_id,
    type: r.type,
    text: r.body,
    videoUrl: r.video_url,
    imageUrl: r.file_name ? urlFor(r.file_name) : null,
    author: { id: r.author_id, name: r.author_name, role: r.author_role },
    createdAt: r.created_at,
  };
}

// ---------------------------------------------------------------------------
// Create. The rules differ by role:
//   admin  -> all_groups, or one_leader (needs targetGroupId)
//   leader -> own_group only (the server sets the target, whatever the client sent)
// ---------------------------------------------------------------------------
async function create(user, body, file) {
  let audience = body.audience;
  let targetGroupId = null;

  if (user.role === "leader") {
    if (audience !== "own_group") throw new AppError(403, "FORBIDDEN", "Captains can only post to their own group");
    targetGroupId = user.groupId;
  } else {
    if (audience === "own_group") throw new AppError(403, "FORBIDDEN", "Admins post to all groups or one captain");
    if (audience === "one_leader") {
      const g = await query("SELECT id FROM groups WHERE id = $1 AND active", [body.targetGroupId]);
      if (!g.rows[0]) throw new AppError(404, "NOT_FOUND", "Group not found");
      targetGroupId = g.rows[0].id;
    }
  }

  let fileName = null;
  if (body.type === "image") {
    if (!file) throw new AppError(400, "VALIDATION_ERROR", "Choose an image");
    fileName = await storage.save(file.buffer);
  }

  const { rows } = await query(
    `INSERT INTO broadcasts (author_id, audience, target_group_id, type, body, file_name, video_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [user.id, audience, targetGroupId, body.type, body.text || null, fileName, body.type === "video" ? body.videoUrl : null]
  );
  return getOne(rows[0].id);
}

async function getOne(id) {
  const { rows } = await query(
    `SELECT b.*, u.name AS author_name, u.role AS author_role
       FROM broadcasts b JOIN users u ON u.id = b.author_id WHERE b.id = $1`,
    [id]
  );
  return shape(rows[0], defaultUrl);
}

// ---------------------------------------------------------------------------
// Feed. A group sees every "all_groups" post plus posts aimed at it. Admin sees all.
// groupId = null means "no filter" (admin).
// ---------------------------------------------------------------------------
async function feedFor(groupId, { page, limit }, urlFor = defaultUrl) {
  const where = "($1::int IS NULL OR b.audience = 'all_groups' OR b.target_group_id = $1)";
  const { rows } = await query(
    `SELECT b.*, u.name AS author_name, u.role AS author_role
       FROM broadcasts b JOIN users u ON u.id = b.author_id
      WHERE ${where} ORDER BY b.id DESC LIMIT $2 OFFSET $3`,
    [groupId, limit, (page - 1) * limit]
  );
  const total = await query(`SELECT COUNT(*)::int AS n FROM broadcasts b WHERE ${where}`, [groupId]);
  return { items: rows.map((r) => shape(r, urlFor)), page, limit, total: total.rows[0].n };
}

const feed = (user, paging) => feedFor(user.role === "admin" ? null : user.groupId, paging);

async function remove(user, id) {
  const { rows } = await query("SELECT author_id, file_name FROM broadcasts WHERE id = $1", [id]);
  if (!rows[0]) throw new AppError(404, "NOT_FOUND", "Post not found");
  if (user.role !== "admin" && rows[0].author_id !== user.id) {
    throw new AppError(403, "FORBIDDEN", "You can only delete your own posts");
  }
  await query("DELETE FROM broadcasts WHERE id = $1", [id]);
  if (rows[0].file_name) await storage.remove(rows[0].file_name);
}

module.exports = { create, feed, feedFor, remove };
