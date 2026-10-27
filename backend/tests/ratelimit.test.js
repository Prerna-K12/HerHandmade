// Own file so the rate-limit counter does not affect other tests.
const h = require("./helpers");

beforeEach(h.resetDb);
afterAll(() => {
  delete process.env.RATE_LIMIT_TEST;
  return h.pool.end();
});

test("the 11th failed login in a row is blocked with 429", async () => {
  process.env.RATE_LIMIT_TEST = "1";
  const admin = await h.makeAdmin();
  let last;
  for (let i = 0; i < 11; i++) {
    last = await h.request(h.app).post("/api/auth/login").send({ phone: admin.phone, password: "wrong-password" });
  }
  expect(last.status).toBe(429);
  expect(last.body.code).toBe("TOO_MANY_REQUESTS");
});
