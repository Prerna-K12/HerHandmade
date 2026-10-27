const env = require("../../config/env");
const { query, withTransaction } = require("../../db");
const AppError = require("../../utils/AppError");
const camel = require("../../utils/camel");
const { trackingToken, orderRef } = require("../../utils/ids");
const { TRANSITIONS } = require("../../constants");
const mailer = require("../../services/mailer");
const assignmentsService = require("../assignments/assignments.service");

const ORDER_COLUMNS = `o.id, o.order_ref, o.business_name, o.location, o.item, o.quantity,
  o.delivery_date, o.email, o.phone, o.status, o.created_at,
  (SELECT COALESCE(SUM(a.quantity), 0)::int FROM assignments a
    WHERE a.order_id = o.id AND a.status <> 'declined') AS assigned_qty`;

// ---------------------------------------------------------------------------
// Business places an order (public form) with idempotency support
// ---------------------------------------------------------------------------
async function createFromPublic(data) {
  const key = data.idempotencyKey || null;

  const result = await withTransaction(async (client) => {
    let ref;

    for (let i = 0; i < 10; i++) {
      ref = orderRef();

      const taken = await client.query(
        "SELECT 1 FROM orders WHERE order_ref = $1",
        [ref]
      );

      if (taken.rowCount === 0) break;
    }

    const token = trackingToken();

    const inserted = await client.query(
      `INSERT INTO orders (
         order_ref,
         tracking_token,
         idempotency_key,
         business_name,
         location,
         item,
         quantity,
         delivery_date,
         email,
         phone
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id, order_ref, business_name, item, quantity, email`,
      [
        ref,
        token,
        key,
        data.businessName,
        data.location,
        data.item,
        data.quantity,
        data.deliveryDate,
        data.email,
        data.phone || null,
      ]
    );

    // This idempotency key has already created an order.
    if (inserted.rowCount === 0) {
      const existing = await client.query(
        `SELECT order_ref, tracking_token
           FROM orders
          WHERE idempotency_key = $1`,
        [key]
      );

      if (!existing.rows[0]) {
        throw new AppError(
          409,
          "ORDER_CONFLICT",
          "Could not retrieve the existing order. Please retry."
        );
      }

      return {
        replayed: true,
        orderRef: existing.rows[0].order_ref,
        token: existing.rows[0].tracking_token,
      };
    }

    const order = inserted.rows[0];

    await client.query(
      "INSERT INTO order_events (order_id, status) VALUES ($1, 'submitted')",
      [order.id]
    );

    return {
      replayed: false,
      order,
      orderRef: order.order_ref,
      token,
    };
  });

  // Send the confirmation email only for a newly created order.
  if (!result.replayed) {
    mailer.sendOrderReceived({
      orderRef: result.order.order_ref,
      businessName: result.order.business_name,
      item: result.order.item,
      quantity: result.order.quantity,
      email: result.order.email,
      trackingToken: result.token,
    });
  }

  return {
    replayed: result.replayed,
    response: {
      orderRef: result.orderRef,
      message: "Order received. We have emailed you a tracking link.",
      trackingUrl: mailer.trackingUrl(result.token),
    },
  };
}

// ---------------------------------------------------------------------------
// Admin: list with filter, search and page numbers
// ---------------------------------------------------------------------------
async function list({ status, q, page, limit }) {
  const like = q ? `%${q.replace(/[\\%_]/g, "\\$&")}%` : null;

  const where = `($1::text IS NULL OR o.status = $1)
             AND ($2::text IS NULL OR o.item ILIKE $2 OR o.business_name ILIKE $2 OR o.order_ref ILIKE $2)`;

  const items = await query(
    `SELECT ${ORDER_COLUMNS} FROM orders o WHERE ${where}
      ORDER BY o.id DESC LIMIT $3 OFFSET $4`,
    [status || null, like, limit, (page - 1) * limit]
  );

  const total = await query(
    `SELECT COUNT(*)::int AS n FROM orders o WHERE ${where}`,
    [status || null, like]
  );

  return {
    items: camel(items.rows),
    page,
    limit,
    total: total.rows[0].n,
  };
}

// ---------------------------------------------------------------------------
// Admin: one order with its timeline and assignments
// ---------------------------------------------------------------------------
async function get(id) {
  const o = await query(
    `SELECT ${ORDER_COLUMNS}, o.tracking_token
       FROM orders o
      WHERE o.id = $1`,
    [id]
  );

  if (!o.rows[0]) {
    throw new AppError(404, "NOT_FOUND", "Order not found");
  }

  const events = await query(
    `SELECT e.status, e.created_at AS at, u.name AS by
       FROM order_events e
       LEFT JOIN users u ON u.id = e.by_user_id
      WHERE e.order_id = $1
      ORDER BY e.id`,
    [id]
  );

  const { trackingToken: token, ...order } = camel(o.rows[0]);

  return {
    order: {
      ...order,
      trackingUrl: mailer.trackingUrl(token),
    },
    events: camel(events.rows),
    assignments: await assignmentsService.listForOrder(id),
  };
}

// ---------------------------------------------------------------------------
// Admin: change status. The ONLY place order status changes.
// ---------------------------------------------------------------------------
async function updateStatus(user, id, next) {
  const result = await withTransaction(async (client) => {
    const found = await client.query(
      `SELECT id, order_ref, business_name, item, quantity, email, status, tracking_token
         FROM orders
        WHERE id = $1
        FOR UPDATE`,
      [id]
    );

    const order = found.rows[0];

    if (!order) {
      throw new AppError(404, "NOT_FOUND", "Order not found");
    }

    const allowed = TRANSITIONS[order.status] || [];

    if (!allowed.includes(next)) {
      throw new AppError(
        409,
        "INVALID_TRANSITION",
        `Cannot move order from ${order.status} to ${next}`
      );
    }

    if (next === "completed") {
      const counts = await client.query(
        `SELECT
           COUNT(*) FILTER (WHERE status IN ('assigned', 'accepted'))::int AS open,
           COUNT(*) FILTER (WHERE status = 'done')::int AS done
         FROM assignments
         WHERE order_id = $1`,
        [id]
      );

      if (counts.rows[0].open > 0 || counts.rows[0].done === 0) {
        throw new AppError(
          409,
          "ASSIGNMENT_OPEN",
          "All assignments must be done before completing the order"
        );
      }
    }

    if (next === "cancelled") {
      await client.query(
        `UPDATE assignments
            SET status = 'declined',
                decline_reason = 'Order cancelled'
          WHERE order_id = $1
            AND status IN ('assigned', 'accepted')`,
        [id]
      );
    }

    await client.query(
      "UPDATE orders SET status = $1 WHERE id = $2",
      [next, id]
    );

    await client.query(
      "INSERT INTO order_events (order_id, status, by_user_id) VALUES ($1, $2, $3)",
      [id, next, user.id]
    );

    return order;
  });

  if (next === "dispatched") {
    mailer.sendDispatched({
      orderRef: result.order_ref,
      businessName: result.business_name,
      item: result.item,
      quantity: result.quantity,
      email: result.email,
      trackingToken: result.tracking_token,
    });
  }

  return (await get(id)).order;
}

// ---------------------------------------------------------------------------
// Public tracking page. Never exposes group names, captain names or phones.
// ---------------------------------------------------------------------------
async function findByToken(token) {
  const { rows } = await query(
    `SELECT id, order_ref, business_name, item, quantity, delivery_date, status
       FROM orders
      WHERE tracking_token = $1`,
    [token]
  );

  if (!rows[0]) {
    throw new AppError(404, "NOT_FOUND", "Tracking link not found");
  }

  return rows[0];
}

async function getTracking(token) {
  const o = await findByToken(token);

  const events = await query(
    "SELECT status, created_at AS at FROM order_events WHERE order_id = $1 ORDER BY id",
    [o.id]
  );

  const photos = await query(
    `SELECT m.id, g.village, g.district
       FROM assignment_media m
       JOIN assignments a ON a.id = m.assignment_id
       JOIN groups g ON g.id = a.group_id
      WHERE a.order_id = $1
        AND a.evidence_approved
        AND m.kind = 'evidence'
      ORDER BY m.id`,
    [o.id]
  );

  return {
    orderRef: o.order_ref,
    businessName: o.business_name,
    item: o.item,
    quantity: o.quantity,
    deliveryDate: o.delivery_date,
    status: o.status,
    timeline: camel(events.rows),
    photos: photos.rows.map((p) => ({
      id: p.id,
      url: `/api/public/track/${token}/photos/${p.id}`,
      label: `${p.village}, ${p.district}`,
    })),
    ngo: {
      name: env.ngo.name,
      email: env.ngo.email,
      phone: env.ngo.phone,
    },
  };
}

// ---------------------------------------------------------------------------
// File name of an approved photo that belongs to this tracking link, or 404.
// ---------------------------------------------------------------------------
async function getApprovedPhotoFile(token, mediaId) {
  const o = await findByToken(token);

  const { rows } = await query(
    `SELECT m.file_name
       FROM assignment_media m
       JOIN assignments a ON a.id = m.assignment_id
      WHERE m.id = $1
        AND a.order_id = $2
        AND a.evidence_approved
        AND m.kind = 'evidence'`,
    [mediaId, o.id]
  );

  if (!rows[0]) {
    throw new AppError(404, "NOT_FOUND", "Photo not found");
  }

  return rows[0].file_name;
}

module.exports = {
  createFromPublic,
  list,
  get,
  updateStatus,
  getTracking,
  getApprovedPhotoFile,
};