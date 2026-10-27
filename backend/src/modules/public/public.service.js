const { query } = require("../../db");
const AppError = require("../../utils/AppError");
const camel = require("../../utils/camel");
const broadcasts = require("../broadcasts/broadcasts.service");

// The worker link: no login. The code identifies the group (read-only).
async function findGroupByCode(code) {
  const { rows } = await query(
    `SELECT g.id, g.name, g.village, g.district
       FROM groups g JOIN users u ON u.id = g.leader_id
      WHERE g.access_code = $1 AND g.active AND u.active`,
    [code]
  );
  if (!rows[0]) throw new AppError(401, "INVALID_ACCESS_CODE", "This group link is not valid");
  return rows[0];
}

async function groupView(code) {
  const group = await findGroupByCode(code);

  // Workers see accepted and finished tasks, with no business details.
  const tasks = await query(
    `SELECT a.id, o.order_ref, o.item, a.quantity, a.deadline, a.status
       FROM assignments a JOIN orders o ON o.id = a.order_id
      WHERE a.group_id = $1 AND a.status IN ('accepted', 'done')
      ORDER BY (a.status = 'done'), a.deadline`,
    [group.id]
  );
  const feed = await broadcasts.feedFor(
    group.id,
    { page: 1, limit: 20 },
    (fileName) => `/api/public/group-view/${code}/media/${fileName}`
  );

  return {
    group: { name: group.name, village: group.village, district: group.district },
    tasks: camel(tasks.rows),
    feed: feed.items,
  };
}

// An image in a broadcast, served only if this group is allowed to see that broadcast.
async function groupMediaFile(code, fileName) {
  const group = await findGroupByCode(code);
  const { rows } = await query(
    "SELECT 1 FROM broadcasts WHERE file_name = $1 AND (audience = 'all_groups' OR target_group_id = $2)",
    [fileName, group.id]
  );
  if (!rows[0]) throw new AppError(404, "NOT_FOUND", "File not found");
  return fileName;
}

module.exports = { groupView, groupMediaFile };
