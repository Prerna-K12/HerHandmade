const h = require("./helpers");

beforeEach(h.resetDb);
afterAll(() => h.pool.end());

test("login sets an httpOnly cookie and never returns the password hash", async () => {
  const admin = await h.makeAdmin();
  const res = await h.request(h.app).post("/api/auth/login").send({ phone: admin.phone, password: h.PASSWORD });
  expect(res.status).toBe(200);
  expect(res.headers["set-cookie"][0]).toMatch(/token=.*HttpOnly/);
  expect(res.body.user.role).toBe("admin");
  expect(JSON.stringify(res.body)).not.toMatch(/password/i);
});

test("wrong password and unknown phone give the same 401", async () => {
  const admin = await h.makeAdmin();
  const a = await h.request(h.app).post("/api/auth/login").send({ phone: admin.phone, password: "wrong-password" });
  const b = await h.request(h.app).post("/api/auth/login").send({ phone: "9999999999", password: "whatever123" });
  expect(a.status).toBe(401);
  expect(a.body.code).toBe("INVALID_CREDENTIALS");
  expect(b.body).toEqual(a.body);
});

test("/me needs a cookie", async () => {
  const anon = await h.request(h.app).get("/api/auth/me");
  expect(anon.status).toBe(401);
  expect(anon.body.code).toBe("UNAUTHENTICATED");

  const cap = await h.makeCaptain();
  const me = await cap.agent.get("/api/auth/me");
  expect(me.status).toBe(200);
  expect(me.body.user.group.village).toBe("Hosahalli");
});

test("a captain cannot use admin routes", async () => {
  const cap = await h.makeCaptain();
  const res = await cap.agent.get("/api/orders");
  expect(res.status).toBe(403);
  expect(res.body.code).toBe("FORBIDDEN");
});

test("deactivating a captain locks her out at once", async () => {
  const admin = await h.makeAdmin();
  const cap = await h.makeCaptain();
  await admin.agent.delete(`/api/captains/${cap.userId}`).expect(204);

  expect((await cap.agent.get("/api/auth/me")).status).toBe(401); // old cookie stops working
  const again = await h.request(h.app).post("/api/auth/login").send({ phone: cap.phone, password: h.PASSWORD });
  expect(again.status).toBe(401);
});

test("logout clears the cookie", async () => {
  const cap = await h.makeCaptain();
  await cap.agent.post("/api/auth/logout").expect(204);
  expect((await cap.agent.get("/api/auth/me")).status).toBe(401);
});

test("admin creates a captain with a group, and the captain can log in", async () => {
  const admin = await h.makeAdmin();
  const res = await admin.agent.post("/api/captains").send({
    name: "Savitri", phone: "9000000077", password: "captain123",
    group: { name: "Kesari Mandal", village: "Chikkahalli", district: "Mandya" },
  });
  expect(res.status).toBe(201);
  expect(res.body.group.accessCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);

  const login = await h.request(h.app).post("/api/auth/login").send({ phone: "9000000077", password: "captain123" });
  expect(login.status).toBe(200);
  expect(login.body.user.role).toBe("leader");

  const dup = await admin.agent.post("/api/captains").send({
    name: "Other", phone: "9000000077", password: "captain123",
    group: { name: "X", village: "Y", district: "Z" },
  });
  expect(dup.status).toBe(409);
  expect(dup.body.code).toBe("ALREADY_EXISTS");
});

test("a captain with open assignments cannot be deactivated", async () => {
  const f = await h.flow();
  await h.assign(f.admin, f.orderId, f.cap.groupId);
  const res = await f.admin.agent.delete(`/api/captains/${f.cap.userId}`);
  expect(res.status).toBe(409);
  expect(res.body.code).toBe("ASSIGNMENT_OPEN");
});
