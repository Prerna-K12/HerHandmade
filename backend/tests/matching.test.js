const h = require("./helpers");

beforeEach(h.resetDb);
afterAll(() => h.pool.end());

// Three groups, as in the design:
//   A: rating 5, free now        B: rating 5, busy until a later date        C: rating 4, free now
async function scenario() {
  const admin = await h.makeAdmin();
  const skill = await h.makeSkill("Rakhi", ["rakhee", "राखी"]);
  const A = await h.makeCaptain("A", "Group A");
  const B = await h.makeCaptain("B", "Group B");
  const C = await h.makeCaptain("C", "Group C");
  await h.rate(A.groupId, skill, 5);
  await h.rate(B.groupId, skill, 5);
  await h.rate(C.groupId, skill, 4);

  const order = await h.makeOrder({ item: "Rakhi box" });
  await h.pool.query(
    "INSERT INTO assignments (order_id, group_id, quantity, deadline, status) VALUES ($1, $2, 100, '2026-11-30', 'accepted')",
    [order.orderId, B.groupId]
  );
  return { admin, skill, A, B, C };
}

const names = (res) => res.body.results.map((r) => r.name);

test("best_rated: same rating -> the free group first; lower rating last", async () => {
  const { admin } = await scenario();
  const res = await admin.agent.get("/api/groups/match?q=rakhi&mode=best_rated");
  expect(res.status).toBe(200);
  expect(names(res)).toEqual(["Group A", "Group B", "Group C"]);
});

test("fastest: free groups first (by rating), busy group last", async () => {
  const { admin } = await scenario();
  const res = await admin.agent.get("/api/groups/match?q=rakhi&mode=fastest");
  expect(names(res)).toEqual(["Group A", "Group C", "Group B"]);
});

test("each result shows availability and the current task", async () => {
  const { admin } = await scenario();
  const res = await admin.agent.get("/api/groups/match?q=rakhi");
  const [a, b] = res.body.results;
  expect(a.nextFreeDate).toBeNull();
  expect(a.currentTask).toBeNull();
  expect(b.nextFreeDate).toBe("2026-11-30");
  expect(b.queueLength).toBe(1);
  expect(b.currentTask).toEqual({ item: "Rakhi box", deadline: "2026-11-30" });
});

test("the default mode is best_rated", async () => {
  const { admin } = await scenario();
  const res = await admin.agent.get("/api/groups/match?q=rakhi");
  expect(res.body.mode).toBe("best_rated");
});

test("a group that is busy for longer comes after one that frees up sooner", async () => {
  const { admin, skill } = await scenario();
  const D = await h.makeCaptain("D", "Group D");
  await h.rate(D.groupId, skill, 5);
  const order = await h.makeOrder();
  await h.pool.query(
    "INSERT INTO assignments (order_id, group_id, quantity, deadline, status) VALUES ($1, $2, 50, '2026-10-15', 'assigned')",
    [order.orderId, D.groupId]
  );
  const res = await admin.agent.get("/api/groups/match?q=rakhi&mode=best_rated");
  expect(names(res)).toEqual(["Group A", "Group D", "Group B", "Group C"]); // free, Oct 15, Nov 30, then rating 4
});

test("alias search works in English and Hindi, ignoring capitals", async () => {
  const { admin } = await scenario();
  for (const q of ["Rakhee", "RAKHI", "राखी"]) {
    const res = await admin.agent.get(`/api/groups/match?q=${encodeURIComponent(q)}`);
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(3);
  }
});

test("unknown skill gives SKILL_NOT_FOUND", async () => {
  const { admin } = await scenario();
  const res = await admin.agent.get("/api/groups/match?q=pottery");
  expect(res.status).toBe(404);
  expect(res.body.code).toBe("SKILL_NOT_FOUND");
});

test("declined and done assignments do not make a group busy", async () => {
  const { admin, B } = await scenario();
  await h.pool.query("UPDATE assignments SET status = 'done' WHERE group_id = $1", [B.groupId]);
  const res = await admin.agent.get("/api/groups/match?q=rakhi");
  expect(res.body.results.find((r) => r.name === "Group B").nextFreeDate).toBeNull();
});

test("inactive groups are left out and only the top 10 are returned", async () => {
  const admin = await h.makeAdmin();
  const skill = await h.makeSkill("Rakhi");
  const groups = [];
  for (let i = 0; i < 12; i++) {
    const g = await h.makeCaptain(`C${i}`, `Group ${String(i).padStart(2, "0")}`);
    await h.rate(g.groupId, skill, 3);
    groups.push(g);
  }
  await h.pool.query("UPDATE groups SET active = FALSE WHERE id = $1", [groups[0].groupId]);
  const res = await admin.agent.get("/api/groups/match?q=rakhi");
  expect(res.body.results).toHaveLength(10);
  expect(names(res)).not.toContain("Group 00");
  expect(names(res)[0]).toBe("Group 01"); // equal rating and availability: alphabetical
});

test("bad mode is rejected; captains cannot search", async () => {
  const { admin, A } = await scenario();
  expect((await admin.agent.get("/api/groups/match?q=rakhi&mode=cheapest")).status).toBe(400);
  expect((await A.agent.get("/api/groups/match?q=rakhi")).status).toBe(403);
});

describe("rating rules (ratingPolicy)", () => {
  test("admin sets ratings 1-5; anything else is rejected; captains cannot", async () => {
    const admin = await h.makeAdmin();
    const cap = await h.makeCaptain();
    const skill = await h.makeSkill("Rakhi");
    const put = (agent, rating) =>
      agent.put(`/api/groups/${cap.groupId}/skills`).send({ skills: [{ skillId: skill, rating, verified: true }] });

    const ok = await put(admin.agent, 4);
    expect(ok.status).toBe(200);
    expect(ok.body.group.skills[0]).toMatchObject({ name: "Rakhi", rating: 4, verified: true });
    expect((await put(admin.agent, 6)).status).toBe(400);
    expect((await put(admin.agent, 0)).status).toBe(400);
    expect((await put(cap.agent, 5)).status).toBe(403);
  });

  test("the list is replaced, and a skill listed twice is rejected", async () => {
    const admin = await h.makeAdmin();
    const cap = await h.makeCaptain();
    const s1 = await h.makeSkill("Rakhi");
    const s2 = await h.makeSkill("Candle");
    await admin.agent.put(`/api/groups/${cap.groupId}/skills`).send({ skills: [{ skillId: s1, rating: 5 }, { skillId: s2, rating: 3 }] }).expect(200);
    const replaced = await admin.agent.put(`/api/groups/${cap.groupId}/skills`).send({ skills: [{ skillId: s2, rating: 2 }] });
    expect(replaced.body.group.skills).toHaveLength(1);
    const dup = await admin.agent.put(`/api/groups/${cap.groupId}/skills`).send({ skills: [{ skillId: s1, rating: 5 }, { skillId: s1, rating: 4 }] });
    expect(dup.status).toBe(400);
  });
});

test("skills: aliases are stored lower-case and duplicates are refused", async () => {
  const admin = await h.makeAdmin();
  const res = await admin.agent.post("/api/skills").send({ name: "Rakhi", aliases: ["RAKHEE", "Rakshabandhan"] });
  expect(res.status).toBe(201);
  expect(res.body.skill.aliases).toEqual(["rakhee", "rakshabandhan"]);
  const dup = await admin.agent.post("/api/skills").send({ name: "Other", aliases: ["rakhee"] });
  expect(dup.status).toBe(409);
});
