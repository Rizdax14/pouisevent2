// Player details endpoint: key required, input validated, saved through the stubbed dependency.
const test = require("node:test");
const assert = require("node:assert");

process.env.INSTA_ADMIN_KEY = "test-admin-key-123456";
const handler = require("./api/insta/player-details");
const KEY = { "x-insta-admin-key": "test-admin-key-123456" };
function mockRes() { const r = { code: 200, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; }, end() { return r; } }; return r; }

test("player-details: wrong key → 401, nothing read or written", async () => {
  let touched = false;
  handler.deps = { list: async () => { touched = true; return []; }, save: async () => { touched = true; } };
  for (const method of ["GET", "POST"]) {
    const res = mockRes();
    await handler({ method, headers: { "x-insta-admin-key": "nope" }, body: { player_id: 1 } }, res);
    assert.strictEqual(res.code, 401);
  }
  assert.strictEqual(touched, false);
});

test("player-details: GET lists, POST validates then saves", async () => {
  const saved = [];
  handler.deps = { list: async () => [{ player_id: 1, phone: "0600000000" }], save: async (r) => { saved.push(r); } };
  let res = mockRes();
  await handler({ method: "GET", headers: KEY }, res);
  assert.deepStrictEqual(res.body.details, [{ player_id: 1, phone: "0600000000" }]);
  res = mockRes();
  await handler({ method: "POST", headers: KEY, body: { player_id: 5, birth_date: "1995-03-02", phone: "06 12 34 56 78", email: " a@b.fr " } }, res);
  assert.strictEqual(res.code, 200);
  assert.deepStrictEqual([saved[0].player_id, saved[0].birth_date, saved[0].phone, saved[0].email], [5, "1995-03-02", "06 12 34 56 78", "a@b.fr"]);
  res = mockRes();
  await handler({ method: "POST", headers: KEY, body: { player_id: 6, birth_date: "", phone: "", email: "" } }, res);
  assert.deepStrictEqual([saved[1].birth_date, saved[1].phone, saved[1].email], [null, null, null]);
  res = mockRes();
  await handler({ method: "POST", headers: KEY, body: { player_id: 7, instagram: " @louis.mar " } }, res);
  assert.strictEqual(saved[2].instagram, "louis.mar");
  res = mockRes();
  await handler({ method: "POST", headers: KEY, body: { player_id: 7, instagram: "https://www.instagram.com/nolan_bl/?hl=fr" } }, res);
  assert.strictEqual(saved[3].instagram, "nolan_bl");
  for (const bad of [{ player_id: 5, instagram: "pas valide !" }, { player_id: 0 }, { player_id: 5, birth_date: "02/03/1995" }, { player_id: 5, birth_date: "2999-01-01" }, { player_id: 5, phone: "abc" }, { player_id: 5, email: "pas-un-mail" }]) {
    res = mockRes();
    await handler({ method: "POST", headers: KEY, body: bad }, res);
    assert.strictEqual(res.code, 400, JSON.stringify(bad));
  }
  assert.strictEqual(saved.length, 4);
});
