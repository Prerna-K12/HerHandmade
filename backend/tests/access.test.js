// Privacy and access rules: who may see what.
const h = require("./helpers");

beforeEach(h.resetDb);
afterAll(() => h.pool.end());

// An order with one assignment that is accepted, has a photo, and is done.
async function finishedWork() {
  const f = await h.flow();
  const a = await h.assign(f.admin, f.orderId, f.cap.groupId, 300);
  await f.cap.agent.patch(`/api/assignments/${a.id}/response`).send({ action: "accept" }).expect(200);
  const up = await f.cap.agent.post(`/api/assignments/${a.id}/evidence`).attach("photos", h.JPEG, h.jpegFile).expect(201);
  await f.cap.agent.patch(`/api/assignments/${a.id}/done`).send({ producedQty: 300 }).expect(200);
  return { ...f, a, mediaId: up.body.assignment.evidence[0].id };
}

describe("captains never see business details", () => {
  test("assignment list and detail contain no business name, contact or location", async () => {
    const f = await h.flow({ businessName: "SecretBiz Pvt Ltd", email: "secret@biz.example", phone: "9811111111", location: "Hidden City" });
    const a = await h.assign(f.admin, f.orderId, f.cap.groupId);
    const list = await f.cap.agent.get("/api/assignments").expect(200);
    const detail = await f.cap.agent.get(`/api/assignments/${a.id}`).expect(200);
    const text = JSON.stringify([list.body, detail.body]);
    for (const secret of ["SecretBiz", "secret@biz", "9811111111", "Hidden City", "businessName", "email"]) {
      expect(text).not.toContain(secret);
    }
    expect(list.body.assignments[0]).toMatchObject({ orderRef: f.orderRef, item: "Handmade rakhi", quantity: 300 });
  });

  test("a captain cannot open another group's assignment", async () => {
    const f = await h.flow();
    const other = await h.makeCaptain("Other", "Other Group");
    const a = await h.assign(f.admin, f.orderId, f.cap.groupId);
    expect((await other.agent.get(`/api/assignments/${a.id}`)).status).toBe(404);
    expect((await other.agent.patch(`/api/assignments/${a.id}/response`).send({ action: "accept" })).status).toBe(404);
    expect((await other.agent.get("/api/assignments")).body.assignments).toHaveLength(0);
  });
});

describe("public tracking page", () => {
  test("shows only approved photos, labelled village and district, with no group or captain identity", async () => {
    const f = await finishedWork();
    const url = `/api/public/track/${f.token}`;

    // before approval: no photos
    const before = await h.request(h.app).get(url).expect(200);
    expect(before.body.photos).toEqual([]);
    expect((await h.request(h.app).get(`${url}/photos/${f.mediaId}`)).status).toBe(404);

    await f.admin.agent.patch(`/api/assignments/${f.a.id}/approve`).send({ approved: true }).expect(200);

    const after = await h.request(h.app).get(url).expect(200);
    expect(after.body.photos).toHaveLength(1);
    expect(after.body.photos[0].label).toBe("Hosahalli, Mysuru");
    expect(after.body.ngo.email).toBe("hello@herhandmade.example");

    const photo = await h.request(h.app).get(after.body.photos[0].url);
    expect(photo.status).toBe(200);
    expect(photo.headers["content-type"]).toMatch(/image\/jpeg/);

    const text = JSON.stringify(after.body);
    for (const secret of [f.cap.groupName, f.cap.name, f.cap.phone, "Lakshmi", "orders@bloomco.example", "9876543210"]) {
      expect(text).not.toContain(secret);
    }
  });

  test("a photo cannot be fetched through another order's link", async () => {
    const f = await finishedWork();
    await f.admin.agent.patch(`/api/assignments/${f.a.id}/approve`).send({ approved: true }).expect(200);
    const other = await h.makeOrder();
    const res = await h.request(h.app).get(`/api/public/track/${other.token}/photos/${f.mediaId}`);
    expect(res.status).toBe(404);
  });

  test("un-approving or deleting a photo hides it again", async () => {
    const f = await finishedWork();
    await f.admin.agent.patch(`/api/assignments/${f.a.id}/approve`).send({ approved: true }).expect(200);
    await f.admin.agent.patch(`/api/assignments/${f.a.id}/approve`).send({ approved: false }).expect(200);
    expect((await h.request(h.app).get(`/api/public/track/${f.token}`)).body.photos).toEqual([]);

    await f.admin.agent.patch(`/api/assignments/${f.a.id}/approve`).send({ approved: true }).expect(200);
    await f.admin.agent.delete(`/api/assignments/${f.a.id}/evidence/${f.mediaId}`).expect(204);
    expect((await h.request(h.app).get(`/api/public/track/${f.token}`)).body.photos).toEqual([]);
  });

  test("unknown or malformed links give 404 / 400, and the timeline is returned", async () => {
    const f = await finishedWork();
    expect((await h.request(h.app).get(`/api/public/track/${"a".repeat(32)}`)).status).toBe(404);
    expect((await h.request(h.app).get("/api/public/track/not-a-token")).status).toBe(400);
    const ok = await h.request(h.app).get(`/api/public/track/${f.token}`);
    expect(ok.body.timeline.map((t) => t.status)).toEqual(["submitted", "accepted"]);
    expect(ok.body.status).toBe("accepted");
  });
});

describe("media files", () => {
  test("need a login", async () => {
    const f = await finishedWork();
    const mine = await f.cap.agent.get(`/api/assignments/${f.a.id}`);
    const url = mine.body.assignment.evidence[0].url;
    expect((await h.request(h.app).get(url)).status).toBe(401);
    expect((await f.cap.agent.get(url)).status).toBe(200);
  });

  test("path tricks are refused", async () => {
    const cap = await h.makeCaptain();
    expect((await cap.agent.get("/api/media/..%2F..%2Fetc%2Fpasswd")).status).toBe(404);
    expect((await cap.agent.get("/api/media/" + "a".repeat(32) + ".jpg")).status).toBe(404);
  });
});

describe("worker group link (no login, read-only)", () => {
  test("shows the group's accepted tasks and feed, and nothing about the business", async () => {
    const f = await finishedWork();
    await f.admin.agent.post("/api/broadcasts").send({ audience: "all_groups", type: "text", text: "Welcome everyone" }).expect(201);

    const res = await h.request(h.app).get(`/api/public/group-view/${f.cap.code}`);
    expect(res.status).toBe(200);
    expect(res.body.group).toEqual({ name: "Sunehri Sakhi Group", village: "Hosahalli", district: "Mysuru" });
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0]).toMatchObject({ item: "Handmade rakhi", quantity: 300, status: "done" });
    expect(res.body.feed[0].text).toBe("Welcome everyone");
    const text = JSON.stringify(res.body);
    for (const secret of ["Bloom", "orders@bloomco", "Bengaluru", "9876543210"]) expect(text).not.toContain(secret);
  });

  test("tasks the captain has not accepted yet are not shown", async () => {
    const f = await h.flow();
    await h.assign(f.admin, f.orderId, f.cap.groupId);
    const res = await h.request(h.app).get(`/api/public/group-view/${f.cap.code}`);
    expect(res.body.tasks).toEqual([]);
  });

  test("wrong code gives 401; a worker cannot reach staff routes", async () => {
    const res = await h.request(h.app).get("/api/public/group-view/ZZZZ-9999");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_ACCESS_CODE");
    expect((await h.request(h.app).get("/api/orders")).status).toBe(401);
    expect((await h.request(h.app).post("/api/broadcasts").send({ audience: "all_groups", type: "text", text: "x" })).status).toBe(401);
  });

  test("regenerating the code kills the old link", async () => {
    const cap = await h.makeCaptain();
    const res = await cap.agent.post("/api/groups/me/access-code").expect(200);
    expect(res.body.accessCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect((await h.request(h.app).get(`/api/public/group-view/${cap.code}`)).status).toBe(401);
    expect((await h.request(h.app).get(`/api/public/group-view/${res.body.accessCode}`)).status).toBe(200);
  });

  test("a deactivated captain's link stops working", async () => {
    const admin = await h.makeAdmin();
    const cap = await h.makeCaptain();
    await admin.agent.delete(`/api/captains/${cap.userId}`).expect(204);
    expect((await h.request(h.app).get(`/api/public/group-view/${cap.code}`)).status).toBe(401);
  });
});

describe("broadcasts", () => {
  test("audience rules by role", async () => {
    const admin = await h.makeAdmin();
    const cap = await h.makeCaptain();
    const post = (agent, body) => agent.post("/api/broadcasts").send(body);

    expect((await post(cap.agent, { audience: "all_groups", type: "text", text: "hi" })).status).toBe(403);
    expect((await post(cap.agent, { audience: "one_leader", type: "text", text: "hi", targetGroupId: 1 })).status).toBe(403);
    expect((await post(admin.agent, { audience: "own_group", type: "text", text: "hi" })).status).toBe(403);
    expect((await post(admin.agent, { audience: "one_leader", type: "text", text: "hi" })).status).toBe(400); // no target
    expect((await post(admin.agent, { audience: "all_groups", type: "text", text: "" })).status).toBe(400);
    expect((await post(admin.agent, { audience: "all_groups", type: "video", videoUrl: "https://vimeo.com/123" })).status).toBe(400);
    expect((await post(admin.agent, { audience: "all_groups", type: "video", videoUrl: "http://youtube.com/watch?v=abc" })).status).toBe(400); // not https
    const ok = await post(admin.agent, { audience: "all_groups", type: "video", text: "Knot tutorial", videoUrl: "https://youtu.be/abc123" });
    expect(ok.status).toBe(201);
    expect(ok.body.broadcast.videoUrl).toBe("https://youtu.be/abc123");
  });

  test("a captain's post goes to her own group only; the server sets the target", async () => {
    const admin = await h.makeAdmin();
    const a = await h.makeCaptain("A", "Group A");
    const b = await h.makeCaptain("B", "Group B");
    // she tries to aim at someone else's group: ignored
    const res = await a.agent.post("/api/broadcasts").send({ audience: "own_group", type: "text", text: "Meeting at 4", targetGroupId: b.groupId });
    expect(res.body.broadcast.targetGroupId).toBe(a.groupId);

    await admin.agent.post("/api/broadcasts").send({ audience: "one_leader", type: "text", text: "For B only", targetGroupId: b.groupId }).expect(201);
    await admin.agent.post("/api/broadcasts").send({ audience: "all_groups", type: "text", text: "For all" }).expect(201);

    const texts = async (agent) => (await agent.get("/api/broadcasts")).body.items.map((i) => i.text).sort();
    expect(await texts(a.agent)).toEqual(["For all", "Meeting at 4"]);
    expect(await texts(b.agent)).toEqual(["For B only", "For all"]);
    expect(await texts(admin.agent)).toEqual(["For B only", "For all", "Meeting at 4"]);

    // the worker links see the same thing as their captain
    const viewA = await h.request(h.app).get(`/api/public/group-view/${a.code}`);
    expect(viewA.body.feed.map((i) => i.text).sort()).toEqual(["For all", "Meeting at 4"]);
  });

  test("image broadcasts: stored, shown to the target group, hidden from others, deletable by author or admin", async () => {
    const admin = await h.makeAdmin();
    const a = await h.makeCaptain("A", "Group A");
    const b = await h.makeCaptain("B", "Group B");
    const res = await admin.agent.post("/api/broadcasts")
      .field("audience", "one_leader").field("type", "image").field("text", "New design").field("targetGroupId", String(a.groupId))
      .attach("image", h.JPEG, h.jpegFile);
    expect(res.status).toBe(201);
    const url = res.body.broadcast.imageUrl;
    expect((await a.agent.get(url)).status).toBe(200);

    const fileName = url.split("/").pop();
    expect((await h.request(h.app).get(`/api/public/group-view/${a.code}/media/${fileName}`)).status).toBe(200);
    expect((await h.request(h.app).get(`/api/public/group-view/${b.code}/media/${fileName}`)).status).toBe(404);

    expect((await b.agent.delete(`/api/broadcasts/${res.body.broadcast.id}`)).status).toBe(403);
    expect((await admin.agent.delete(`/api/broadcasts/${res.body.broadcast.id}`)).status).toBe(204);
    expect((await a.agent.get(url)).status).toBe(404); // file removed with the post
  });

  test("an image post without a file is rejected", async () => {
    const admin = await h.makeAdmin();
    const res = await admin.agent.post("/api/broadcasts").send({ audience: "all_groups", type: "image" });
    expect(res.status).toBe(400);
  });
});

describe("captain roster", () => {
  test("add and remove members, only in her own group", async () => {
    const a = await h.makeCaptain("A", "Group A");
    const b = await h.makeCaptain("B", "Group B");
    const added = await a.agent.post("/api/groups/me/members").send({ name: "Sita" }).expect(201);
    const memberId = added.body.group.members[0].id;
    expect((await b.agent.delete(`/api/groups/me/members/${memberId}`)).status).toBe(404);
    expect((await a.agent.delete(`/api/groups/me/members/${memberId}`)).status).toBe(204);
    expect((await a.agent.get("/api/groups/me")).body.group.members).toEqual([]);
  });
});

test("unknown API routes return a JSON 404", async () => {
  const res = await h.request(h.app).get("/api/nothing-here");
  expect(res.status).toBe(404);
  expect(res.body.code).toBe("NOT_FOUND");
});

test("malformed JSON gives a 400, not a crash", async () => {
  const res = await h.request(h.app).post("/api/auth/login").set("Content-Type", "application/json").send("{oops");
  expect(res.status).toBe(400);
});
