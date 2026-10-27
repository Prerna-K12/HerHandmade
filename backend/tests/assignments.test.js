const h = require("./helpers");

beforeEach(h.resetDb);
afterAll(() => h.pool.end());

describe("creating assignments (admin)", () => {
  test("splits an order across groups and enforces the quantity cap", async () => {
    const f = await h.flow({ quantity: 500 });
    const other = await h.makeCaptain("Savitri", "Kesari", "Chikkahalli", "Mandya");

    await h.assign(f.admin, f.orderId, f.cap.groupId, 300);
    const tooMany = await f.admin.agent
      .post(`/api/orders/${f.orderId}/assignments`)
      .send({ groupId: other.groupId, quantity: 300, deadline: h.daysFromNow(30) });
    expect(tooMany.status).toBe(409);
    expect(tooMany.body.code).toBe("QUANTITY_EXCEEDED");
    expect(tooMany.body.message).toBe("Only 200 left to assign");

    await h.assign(f.admin, f.orderId, other.groupId, 200); // exactly the rest is fine
  });

  test("a declined assignment frees its quantity", async () => {
    const f = await h.flow({ quantity: 500 });
    const a = await h.assign(f.admin, f.orderId, f.cap.groupId, 500);
    await f.cap.agent.patch(`/api/assignments/${a.id}/response`).send({ action: "decline", reason: "Fully booked" }).expect(200);
    await h.assign(f.admin, f.orderId, f.cap.groupId, 500);
  });

  test("deadline cannot be after the delivery date", async () => {
    const f = await h.flow({ deliveryDate: h.daysFromNow(60) });
    const res = await f.admin.agent
      .post(`/api/orders/${f.orderId}/assignments`)
      .send({ groupId: f.cap.groupId, quantity: 10, deadline: h.daysFromNow(90) });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("DEADLINE_AFTER_DELIVERY");
  });

  test("work cannot be assigned before the order is accepted", async () => {
    const admin = await h.makeAdmin();
    const cap = await h.makeCaptain();
    const { orderId } = await h.makeOrder();
    const res = await admin.agent
      .post(`/api/orders/${orderId}/assignments`)
      .send({ groupId: cap.groupId, quantity: 10, deadline: h.daysFromNow(10) });
    expect(res.status).toBe(409);
  });

  test("an inactive or unknown group cannot receive work", async () => {
    const f = await h.flow();
    const res = await f.admin.agent
      .post(`/api/orders/${f.orderId}/assignments`)
      .send({ groupId: 9999, quantity: 10, deadline: h.daysFromNow(10) });
    expect(res.status).toBe(404);
  });
});

describe("captain flow", () => {
  test("accept once; a second accept is an invalid transition", async () => {
    const f = await h.flow();
    const a = await h.assign(f.admin, f.orderId, f.cap.groupId);
    const first = await f.cap.agent.patch(`/api/assignments/${a.id}/response`).send({ action: "accept" });
    expect(first.body.assignment.status).toBe("accepted");
    const again = await f.cap.agent.patch(`/api/assignments/${a.id}/response`).send({ action: "accept" });
    expect(again.status).toBe(409);
    expect(again.body.message).toBe("Cannot move assignment from accepted to accepted");
  });

  test("cannot mark done without a photo; can with one", async () => {
    const f = await h.flow();
    const a = await h.assign(f.admin, f.orderId, f.cap.groupId);
    await f.cap.agent.patch(`/api/assignments/${a.id}/response`).send({ action: "accept" }).expect(200);

    const no = await f.cap.agent.patch(`/api/assignments/${a.id}/done`).send({ producedQty: 300 });
    expect(no.status).toBe(409);
    expect(no.body.code).toBe("EVIDENCE_REQUIRED");

    await f.cap.agent.post(`/api/assignments/${a.id}/evidence`).attach("photos", h.JPEG, h.jpegFile).expect(201);
    const yes = await f.cap.agent.patch(`/api/assignments/${a.id}/done`).send({ producedQty: 300 });
    expect(yes.status).toBe(200);
    expect(yes.body.assignment.status).toBe("done");
    expect(yes.body.assignment.doneAt).toBeTruthy();
  });

  test("photos can only be added after accepting", async () => {
    const f = await h.flow();
    const a = await h.assign(f.admin, f.orderId, f.cap.groupId);
    const res = await f.cap.agent.post(`/api/assignments/${a.id}/evidence`).attach("photos", h.JPEG, h.jpegFile);
    expect(res.status).toBe(409);
  });

  test("a new photo resets the admin's approval", async () => {
    const f = await h.flow();
    const a = await h.assign(f.admin, f.orderId, f.cap.groupId);
    await f.cap.agent.patch(`/api/assignments/${a.id}/response`).send({ action: "accept" });
    await f.cap.agent.post(`/api/assignments/${a.id}/evidence`).attach("photos", h.JPEG, h.jpegFile).expect(201);

    const ok = await f.admin.agent.patch(`/api/assignments/${a.id}/approve`).send({ approved: true });
    expect(ok.body.assignment.evidenceApproved).toBe(true);

    const more = await f.cap.agent.post(`/api/assignments/${a.id}/evidence`).attach("photos", h.JPEG, h.jpegFile);
    expect(more.body.assignment.evidenceApproved).toBe(false);
    expect(more.body.assignment.evidence).toHaveLength(2);
  });

  test("approval needs at least one photo", async () => {
    const f = await h.flow();
    const a = await h.assign(f.admin, f.orderId, f.cap.groupId);
    const res = await f.admin.agent.patch(`/api/assignments/${a.id}/approve`).send({ approved: true });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("EVIDENCE_REQUIRED");
  });

  test("only the admin approves, only the captain responds", async () => {
    const f = await h.flow();
    const a = await h.assign(f.admin, f.orderId, f.cap.groupId);
    expect((await f.cap.agent.patch(`/api/assignments/${a.id}/approve`).send({ approved: true })).status).toBe(403);
    expect((await f.admin.agent.patch(`/api/assignments/${a.id}/response`).send({ action: "accept" })).status).toBe(403);
  });
});

describe("uploads", () => {
  async function accepted() {
    const f = await h.flow();
    const a = await h.assign(f.admin, f.orderId, f.cap.groupId);
    await f.cap.agent.patch(`/api/assignments/${a.id}/response`).send({ action: "accept" });
    return { f, a };
  }

  test("rejects a PDF", async () => {
    const { f, a } = await accepted();
    const res = await f.cap.agent.post(`/api/assignments/${a.id}/evidence`)
      .attach("photos", Buffer.from("%PDF-1.4 hello world"), { filename: "x.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(415);
    expect(res.body.code).toBe("UNSUPPORTED_FILE");
  });

  test("rejects a fake image (wrong bytes with an image content type)", async () => {
    const { f, a } = await accepted();
    const res = await f.cap.agent.post(`/api/assignments/${a.id}/evidence`)
      .attach("photos", Buffer.from("this is plain text, not a picture"), h.jpegFile);
    expect(res.status).toBe(415);
  });

  test("rejects an image over 1 MB", async () => {
    const { f, a } = await accepted();
    const big = Buffer.concat([h.JPEG, Buffer.alloc(1.5 * 1024 * 1024)]);
    const res = await f.cap.agent.post(`/api/assignments/${a.id}/evidence`).attach("photos", big, h.jpegFile);
    expect(res.status).toBe(413);
    expect(res.body.code).toBe("FILE_TOO_LARGE");
  });

  test("admin reference images are visible to the group's captain", async () => {
    const f = await h.flow();
    const a = await h.assign(f.admin, f.orderId, f.cap.groupId);
    const up = await f.admin.agent.post(`/api/assignments/${a.id}/reference`).attach("images", h.JPEG, h.jpegFile);
    expect(up.status).toBe(201);
    const mine = await f.cap.agent.get(`/api/assignments/${a.id}`);
    expect(mine.body.assignment.referenceMedia).toHaveLength(1);
    const img = await f.cap.agent.get(mine.body.assignment.referenceMedia[0].url);
    expect(img.status).toBe(200);
    expect(img.headers["content-type"]).toMatch(/image\/jpeg/);
  });
});
