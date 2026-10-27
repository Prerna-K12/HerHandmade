const { query, withTransaction } = require("../../db");
const AppError = require("../../utils/AppError");
const storage = require("../../services/storage");

const MAX_EVIDENCE = 10;

// Only order_ref and item are taken from orders. Business name, contact and
// location are never selected here, so captains can never receive them.
const SELECT = `
  SELECT a.id, a.order_id, o.order_ref, o.item, a.group_id,
         g.name AS group_name, g.village, g.district,
         a.quantity, a.deadline, a.status, a.decline_reason, a.produced_qty,
         a.done_at, a.evidence_approved, a.created_at
    FROM assignments a
    JOIN orders o ON o.id = a.order_id
    JOIN groups g ON g.id = a.group_id`;

const mediaUrl = (m) => ({ id: m.id, url: `/api/media/${m.file_name}` });

// Attaches reference images and evidence photos to a list of assignment rows.
async function withMedia(rows, isAdmin) {
  if (rows.length === 0) return [];
  const media = await query(
    "SELECT id, assignment_id, kind, file_name FROM assignment_media WHERE assignment_id = ANY($1) ORDER BY id",
    [rows.map((r) => r.id)]
  );
  return rows.map((r) => {
    const mine = media.rows.filter((m) => m.assignment_id === r.id);
    const out = {
      id: r.id,
      orderRef: r.order_ref,
      item: r.item,
      quantity: r.quantity,
      deadline: r.deadline,
      status: r.status,
      declineReason: r.decline_reason,
      producedQty: r.produced_qty,
      doneAt: r.done_at,
      evidenceApproved: r.evidence_approved,
      createdAt: r.created_at,
      referenceMedia: mine.filter((m) => m.kind === "reference").map(mediaUrl),
      evidence: mine.filter((m) => m.kind === "evidence").map(mediaUrl),
    };
    if (isAdmin) {
      Object.assign(out, {
        orderId: r.order_id,
        groupId: r.group_id,
        groupName: r.group_name,
        village: r.village,
        district: r.district,
      });
    }
    return out;
  });
}

const ORDER_BY = `ORDER BY CASE a.status WHEN 'accepted' THEN 0 WHEN 'assigned' THEN 1 WHEN 'done' THEN 2 ELSE 3 END,
                           a.deadline, a.id`;

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------
async function list(user, { orderId, status }) {
  const isAdmin = user.role === "admin";
  const params = [];
  const where = [];
  if (!isAdmin) {
    params.push(user.groupId); // a captain only ever sees her own group's work
    where.push(`a.group_id = $${params.length}`);
  }
  if (orderId) { params.push(orderId); where.push(`a.order_id = $${params.length}`); }
  if (status) { params.push(status); where.push(`a.status = $${params.length}`); }

  const { rows } = await query(
    `${SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""} ${ORDER_BY} LIMIT 200`,
    params
  );
  return withMedia(rows, isAdmin);
}

async function listForOrder(orderId) {
  const { rows } = await query(`${SELECT} WHERE a.order_id = $1 ${ORDER_BY}`, [orderId]);
  return withMedia(rows, true);
}

async function get(user, id) {
  const isAdmin = user.role === "admin";
  const params = [id];
  let where = "a.id = $1";
  if (!isAdmin) { params.push(user.groupId); where += " AND a.group_id = $2"; }
  const { rows } = await query(`${SELECT} WHERE ${where}`, params);
  if (!rows[0]) throw new AppError(404, "NOT_FOUND", "Assignment not found");
  return (await withMedia(rows, isAdmin))[0];
}

// Locks the row of one of the captain's own assignments for the rest of the transaction.
async function lockOwned(client, user, id) {
  const { rows } = await client.query(
    "SELECT id, status FROM assignments WHERE id = $1 AND group_id = $2 FOR UPDATE",
    [id, user.groupId]
  );
  if (!rows[0]) throw new AppError(404, "NOT_FOUND", "Assignment not found");
  return rows[0];
}

const evidenceCount = async (client, id) =>
  (await client.query("SELECT COUNT(*)::int AS n FROM assignment_media WHERE assignment_id = $1 AND kind = 'evidence'", [id])).rows[0].n;

// ---------------------------------------------------------------------------
// Admin: create an assignment (give part of an order to a group)
// ---------------------------------------------------------------------------
async function create(user, orderId, { groupId, quantity, deadline }) {
  const newId = await withTransaction(async (client) => {
    // Lock the order so two admins cannot over-assign it at the same moment.
    const o = await client.query(
      "SELECT id, quantity, delivery_date, status FROM orders WHERE id = $1 FOR UPDATE",
      [orderId]
    );
    const order = o.rows[0];
    if (!order) throw new AppError(404, "NOT_FOUND", "Order not found");
    if (!["accepted", "in_production"].includes(order.status)) {
      throw new AppError(409, "INVALID_TRANSITION", "Accept the order before assigning work");
    }
    if (deadline > order.delivery_date) {
      throw new AppError(400, "DEADLINE_AFTER_DELIVERY", "Deadline cannot be after the delivery date");
    }

    const g = await client.query("SELECT id FROM groups WHERE id = $1 AND active", [groupId]);
    if (!g.rows[0]) throw new AppError(404, "NOT_FOUND", "Group not found");

    // Quantity cap: declined assignments do not count.
    const used = await client.query(
      "SELECT COALESCE(SUM(quantity), 0)::int AS n FROM assignments WHERE order_id = $1 AND status <> 'declined'",
      [orderId]
    );
    const left = order.quantity - used.rows[0].n;
    if (quantity > left) {
      throw new AppError(409, "QUANTITY_EXCEEDED", `Only ${left} left to assign`);
    }

    const ins = await client.query(
      "INSERT INTO assignments (order_id, group_id, quantity, deadline) VALUES ($1, $2, $3, $4) RETURNING id",
      [orderId, groupId, quantity, deadline]
    );
    return ins.rows[0].id;
  });
  return get(user, newId);
}

// ---------------------------------------------------------------------------
// Admin: reference images (visible to the group's captain)
// ---------------------------------------------------------------------------
async function addReference(user, id, files) {
  if (!files || files.length === 0) throw new AppError(400, "VALIDATION_ERROR", "Choose at least one image");
  const exists = await query("SELECT 1 FROM assignments WHERE id = $1", [id]);
  if (exists.rowCount === 0) throw new AppError(404, "NOT_FOUND", "Assignment not found");

  for (const f of files) {
    const name = await storage.save(f.buffer);
    await query("INSERT INTO assignment_media (assignment_id, kind, file_name) VALUES ($1, 'reference', $2)", [id, name]);
  }
  return get(user, id);
}

// ---------------------------------------------------------------------------
// Captain: accept or decline
// ---------------------------------------------------------------------------
async function respond(user, id, { action, reason }) {
  await withTransaction(async (client) => {
    const a = await lockOwned(client, user, id);
    const next = action === "accept" ? "accepted" : "declined";
    if (a.status !== "assigned") {
      throw new AppError(409, "INVALID_TRANSITION", `Cannot move assignment from ${a.status} to ${next}`);
    }
    await client.query("UPDATE assignments SET status = $1, decline_reason = $2 WHERE id = $3", [
      next,
      action === "decline" ? reason || null : null,
      id,
    ]);
  });
  return get(user, id);
}

// ---------------------------------------------------------------------------
// Captain: proof photos. Uploading resets the admin's approval.
// ---------------------------------------------------------------------------
async function addEvidence(user, id, files) {
  if (!files || files.length === 0) throw new AppError(400, "VALIDATION_ERROR", "Choose at least one photo");

  await withTransaction(async (client) => {
    const a = await lockOwned(client, user, id);
    if (!["accepted", "done"].includes(a.status)) {
      throw new AppError(409, "INVALID_TRANSITION", "Accept the assignment before uploading photos");
    }
    if ((await evidenceCount(client, id)) + files.length > MAX_EVIDENCE) {
      throw new AppError(400, "VALIDATION_ERROR", `At most ${MAX_EVIDENCE} photos per assignment`);
    }
    for (const f of files) {
      const name = await storage.save(f.buffer);
      await client.query("INSERT INTO assignment_media (assignment_id, kind, file_name) VALUES ($1, 'evidence', $2)", [id, name]);
    }
    await client.query("UPDATE assignments SET evidence_approved = FALSE WHERE id = $1", [id]);
  });
  return get(user, id);
}

// Captain taps "Done". At least one photo is required.
async function markDone(user, id, producedQty) {
  await withTransaction(async (client) => {
    const a = await lockOwned(client, user, id);
    if (a.status !== "accepted") {
      throw new AppError(409, "INVALID_TRANSITION", `Cannot move assignment from ${a.status} to done`);
    }
    if ((await evidenceCount(client, id)) === 0) {
      throw new AppError(409, "EVIDENCE_REQUIRED", "Upload at least one photo before marking done");
    }
    await client.query(
      "UPDATE assignments SET status = 'done', produced_qty = $1, done_at = now() WHERE id = $2",
      [producedQty, id]
    );
  });
  return get(user, id);
}

// ---------------------------------------------------------------------------
// Admin: review photos
// ---------------------------------------------------------------------------
async function removeEvidence(id, mediaId) {
  const { rows } = await query(
    "DELETE FROM assignment_media WHERE id = $1 AND assignment_id = $2 AND kind = 'evidence' RETURNING file_name",
    [mediaId, id]
  );
  if (!rows[0]) throw new AppError(404, "NOT_FOUND", "Photo not found");
  await storage.remove(rows[0].file_name);
}

async function setApproval(user, id, approved) {
  const a = await query("SELECT 1 FROM assignments WHERE id = $1", [id]);
  if (a.rowCount === 0) throw new AppError(404, "NOT_FOUND", "Assignment not found");
  if (approved && (await evidenceCount({ query }, id)) === 0) {
    throw new AppError(409, "EVIDENCE_REQUIRED", "There are no photos to approve");
  }
  await query("UPDATE assignments SET evidence_approved = $1 WHERE id = $2", [approved, id]);
  return get(user, id);
}

module.exports = {
  list, listForOrder, get, create, addReference, respond,
  addEvidence, markDone, removeEvidence, setApproval,
};
