const h = require("./helpers");
const mailer = require("../src/services/mailer");
beforeEach(h.resetDb);
afterAll(() => h.pool.end());

describe("public order form", () => {
  test("creates an order, a first timeline event and a tracking link", async () => {
    const res = await h.request(h.app).post("/api/public/orders").send(h.validOrder());
    expect(res.status).toBe(201);
    expect(res.body.orderRef).toMatch(/^HH-[A-Z0-9]{6}$/);
    expect(res.body.trackingUrl).toMatch(/\/track\/[a-f0-9]{32}$/);

    const events = await h.pool.query("SELECT status FROM order_events");
    expect(events.rows).toEqual([{ status: "submitted" }]);
  });

  test("honeypot: a bot gets a normal-looking answer but nothing is saved", async () => {
    const res = await h.request(h.app).post("/api/public/orders").send(h.validOrder({ website: "spam.example" }));
    expect(res.status).toBe(201);
    const count = await h.pool.query("SELECT COUNT(*)::int AS n FROM orders");
    expect(count.rows[0].n).toBe(0);
  });

  test.each([
    ["zero quantity", { quantity: 0 }],
    ["past delivery date", { deliveryDate: "2020-01-01" }],
    ["bad email", { email: "not-an-email" }],
    ["missing business name", { businessName: "" }],
    ["impossible date", { deliveryDate: "2030-02-31" }],
  ])("rejects %s", async (_name, bad) => {
    const res = await h.request(h.app).post("/api/public/orders").send(h.validOrder(bad));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});
describe("idempotency key (a repeat must not create a second order)", () => {
  const KEY = "3f9c8a1e-5b7d-4e8a-9c21-7d4e5f6a8b90";
  const post = (body) => h.request(h.app).post("/api/public/orders").send(h.validOrder(body));
  const count = async (table) => (await h.pool.query(`SELECT COUNT(*)::int AS n FROM ${table}`)).rows[0].n;

  test("the same key twice gives one order and the same answer", async () => {
    const first = await post({ idempotencyKey: KEY });
    const again = await post({ idempotencyKey: KEY });

    expect([first.status, again.status]).toEqual([201, 201]);
    expect(again.body).toEqual(first.body);
    expect(first.headers["idempotent-replayed"]).toBeUndefined();
    expect(again.headers["idempotent-replayed"]).toBe("true");
    expect(await count("orders")).toBe(1);
    expect(await count("order_events")).toBe(1);
  });

  test("five identical requests at the same moment still give one order", async () => {
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => post({ idempotencyKey: KEY })));
    expect(new Set(results.map((r) => r.body.orderRef)).size).toBe(1);
    expect(await count("orders")).toBe(1);
  });

  test("a repeat does not send a second email", async () => {
    const spy = jest.spyOn(mailer, "sendOrderReceived").mockResolvedValue();
    await post({ idempotencyKey: KEY });
    await post({ idempotencyKey: KEY });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  test("different keys, or no key at all, make separate orders", async () => {
    await post({ idempotencyKey: KEY });
    await post({ idempotencyKey: "7c1d2e3f-0a1b-4c2d-8e3f-9a0b1c2d3e4f" });
    await post({});
    await post({});
    expect(await count("orders")).toBe(4);
  });

  test("a key that is not a UUID is refused", async () => {
    const res = await post({ idempotencyKey: "not-a-uuid" });
    expect(res.status).toBe(400);
    expect(await count("orders")).toBe(0);
  });
});
describe("order status (admin only, one move at a time)", () => {
  test("allows accept, then production; rejects skipping steps", async () => {
    const admin = await h.makeAdmin();
    const { orderId } = await h.makeOrder();
    const move = (status) => admin.agent.patch(`/api/orders/${orderId}/status`).send({ status });

    const skip = await move("completed");
    expect(skip.status).toBe(409);
    expect(skip.body.code).toBe("INVALID_TRANSITION");
    expect(skip.body.message).toBe("Cannot move order from submitted to completed");

    expect((await move("accepted")).status).toBe(200);
    expect((await move("in_production")).body.order.status).toBe("in_production");
    expect((await move("accepted")).status).toBe(409); // no going backwards
  });

  test("every move is written to the timeline with who did it", async () => {
    const admin = await h.makeAdmin();
    const { orderId } = await h.makeOrder();
    await admin.agent.patch(`/api/orders/${orderId}/status`).send({ status: "accepted" }).expect(200);
    const res = await admin.agent.get(`/api/orders/${orderId}`).expect(200);
    expect(res.body.events.map((e) => e.status)).toEqual(["submitted", "accepted"]);
    expect(res.body.events[1].by).toBe("Admin");
  });

  test("a captain cannot change order status", async () => {
    const cap = await h.makeCaptain();
    const { orderId } = await h.makeOrder();
    const res = await cap.agent.patch(`/api/orders/${orderId}/status`).send({ status: "accepted" });
    expect(res.status).toBe(403);
  });

  test("rejected orders are final", async () => {
    const admin = await h.makeAdmin();
    const { orderId } = await h.makeOrder();
    await admin.agent.patch(`/api/orders/${orderId}/status`).send({ status: "rejected" }).expect(200);
    const res = await admin.agent.patch(`/api/orders/${orderId}/status`).send({ status: "accepted" });
    expect(res.status).toBe(409);
  });

  test("full journey: assign, captain works, admin completes, dispatches, delivers", async () => {
    const f = await h.flow();
    const a = await h.assign(f.admin, f.orderId, f.cap.groupId, 500);
    const move = (status) => f.admin.agent.patch(`/api/orders/${f.orderId}/status`).send({ status });

    await move("in_production").then((r) => expect(r.status).toBe(200));
    // not done yet -> cannot complete
    const early = await move("completed");
    expect(early.status).toBe(409);
    expect(early.body.code).toBe("ASSIGNMENT_OPEN");

    await f.cap.agent.patch(`/api/assignments/${a.id}/response`).send({ action: "accept" }).expect(200);
    await f.cap.agent.post(`/api/assignments/${a.id}/evidence`).attach("photos", h.JPEG, h.jpegFile).expect(201);
    await f.cap.agent.patch(`/api/assignments/${a.id}/done`).send({ producedQty: 500 }).expect(200);

    expect((await move("completed")).status).toBe(200);
    expect((await move("dispatched")).status).toBe(200);
    const last = await move("delivered");
    expect(last.body.order.status).toBe("delivered");
  });

  test("cancelling closes the group's open assignments", async () => {
    const f = await h.flow();
    const a = await h.assign(f.admin, f.orderId, f.cap.groupId);
    await f.admin.agent.patch(`/api/orders/${f.orderId}/status`).send({ status: "cancelled" }).expect(200);
    const res = await f.admin.agent.get(`/api/assignments/${a.id}`).expect(200);
    expect(res.body.assignment.status).toBe("declined");
    expect(res.body.assignment.declineReason).toBe("Order cancelled");
  });
});

describe("admin order list", () => {
  test("pages, filters by status and searches", async () => {
    const admin = await h.makeAdmin();
    for (let i = 0; i < 25; i++) await h.makeOrder({ item: i % 5 === 0 ? "Gift hamper" : "Handmade rakhi" });
    const second = await h.makeOrder({ businessName: "Lotus Gifts" });
    await admin.agent.patch(`/api/orders/${second.orderId}/status`).send({ status: "accepted" }).expect(200);

    const p1 = (await admin.agent.get("/api/orders?limit=10")).body;
    const p3 = (await admin.agent.get("/api/orders?limit=10&page=3")).body;
    expect(p1.items).toHaveLength(10);
    expect(p1.total).toBe(26);
    expect(p3.items).toHaveLength(6);
    expect(p1.items[0].id).toBeGreaterThan(p1.items[1].id); // newest first

    const accepted = (await admin.agent.get("/api/orders?status=accepted")).body;
    expect(accepted.items).toHaveLength(1);

    const hamper = (await admin.agent.get("/api/orders?q=hamper")).body;
    expect(hamper.total).toBe(5);
    const lotus = (await admin.agent.get("/api/orders?q=lotus")).body;
    expect(lotus.items[0].businessName).toBe("Lotus Gifts");
    expect((await admin.agent.get("/api/orders?q=100%25")).body.total).toBe(0); // % is taken literally, not as a wildcard
    expect((await admin.agent.get("/api/orders?status=bogus")).status).toBe(400);
  });
});
