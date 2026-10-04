// Tests of the admin photo endpoints with a stubbed fetch (no network, no database).
const test = require("node:test");
const assert = require("node:assert");

process.env.INSTA_ADMIN_KEY = "test-admin-key-123456";
process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_dummy";
const sign = require("./api/insta/photo-sign");
const register = require("./api/insta/photo-register");
const del = require("./api/insta/photo-delete");

function mockRes() {
  const r = { code: 200, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; }, end() { return r; } };
  return r;
}
const KEY = { "x-insta-admin-key": "test-admin-key-123456" };
const realFetch = global.fetch;
let calls;
function stubFetch(handler) { calls = []; global.fetch = async (url, opts = {}) => { calls.push({ url: String(url), opts }); return handler(String(url), opts); }; }
test.afterEach(() => { global.fetch = realFetch; });

test("wrong, missing or short key → 401 and no network call", async () => {
  stubFetch(() => { throw new Error("no network expected"); });
  for (const headers of [{}, { "x-insta-admin-key": "nope" }, { "x-insta-admin-key": "test-admin-key-12345X" }]) {
    for (const fn of [sign, register, del]) {
      const res = mockRes();
      await fn({ method: "POST", headers, body: { id: 1 } }, res);
      assert.strictEqual(res.code, 401);
      assert.strictEqual(res.body.error, "Clé admin invalide");
    }
  }
  assert.strictEqual(calls.length, 0);
});

test("INSTA_ADMIN_KEY unset or too short rejects everything", async () => {
  const saved = process.env.INSTA_ADMIN_KEY;
  process.env.INSTA_ADMIN_KEY = "short";
  const res = mockRes();
  await del({ method: "POST", headers: { "x-insta-admin-key": "short" }, body: { id: 1 } }, res);
  assert.strictEqual(res.code, 401);
  process.env.INSTA_ADMIN_KEY = saved;
});

test("GET → 405", async () => {
  const res = mockRes();
  await sign({ method: "GET", headers: KEY }, res);
  assert.strictEqual(res.code, 405);
});

test("photo-sign validates params then returns a signed upload URL", async () => {
  stubFetch(() => ({ ok: true, json: async () => ({ url: "/object/upload/sign/player-photos/x?token=T" }) }));
  let res = mockRes();
  await sign({ method: "POST", headers: KEY, body: { player_id: "3", kit: "domicile", kind: "dos" } }, res);
  assert.strictEqual(res.code, 400);
  res = mockRes();
  await sign({ method: "POST", headers: KEY, body: { player_id: 3, kit: "rouge", kind: "dos" } }, res);
  assert.strictEqual(res.code, 400);
  res = mockRes();
  await sign({ method: "POST", headers: KEY, body: { player_id: 3, kit: "exterieur", kind: "celebration", retouched: true } }, res);
  assert.strictEqual(res.code, 200);
  assert.match(res.body.path, /^3\/exterieur\/celebration-retouche-\d+\.png$/);
  assert.match(res.body.uploadUrl, /\/storage\/v1\/object\/upload\/sign\/player-photos\/x\?token=T$/);
  // new sb_secret_ keys go only in `apikey`, never as a Bearer token
  assert.strictEqual(calls[0].opts.headers.apikey, "sb_secret_dummy");
  assert.strictEqual(calls[0].opts.headers.Authorization, undefined);
});

test("photo-sign surfaces a storage failure as 500 without throwing", async () => {
  stubFetch(() => ({ ok: false, text: async () => "boom" }));
  const res = mockRes();
  await sign({ method: "POST", headers: KEY, body: { player_id: 3, kit: "domicile", kind: "dos" } }, res);
  assert.strictEqual(res.code, 500);
});

test("photo-register rejects a path that does not match the player/kit/kind", async () => {
  stubFetch(() => { throw new Error("no network expected"); });
  const base = { player_id: 3, kit: "domicile", kind: "dos", retouched: false, width: 800, height: 1200 };
  for (const path of ["4/domicile/dos-1.png", "3/domicile/dos/../../x.png", "3/exterieur/dos-1.png", 5, undefined]) {
    const res = mockRes();
    await register({ method: "POST", headers: KEY, body: { ...base, path } }, res);
    assert.strictEqual(res.code, 400, String(path));
  }
  const res = mockRes();
  await register({ method: "POST", headers: KEY, body: { ...base, width: 0, path: "3/domicile/dos-1.png" } }, res);
  assert.strictEqual(res.code, 400);
  assert.strictEqual(calls.length, 0);
});

test("photo-register: missing file → 400; ok → upsert, and replacing drops old framings", async () => {
  stubFetch((url, opts) => (opts.method === "HEAD" ? { ok: false } : { ok: true, status: 200, json: async () => [] }));
  const body = { player_id: 3, kit: "domicile", kind: "dos", retouched: false, width: 800, height: 1200, path: "3/domicile/dos-2.png" };
  let res = mockRes();
  await register({ method: "POST", headers: KEY, body }, res);
  assert.strictEqual(res.code, 400);
  assert.strictEqual(res.body.error, "Fichier introuvable");

  stubFetch((url, opts) => {
    if (opts.method === "HEAD") return { ok: true };
    if (!opts.method && url.includes("foot_player_photos?")) return { ok: true, json: async () => [{ id: 9, path: "3/domicile/dos-1.png" }] };
    if (opts.method === "POST") return { ok: true, status: 201, json: async () => [{ id: 9, ...body }] };
    return { ok: true, status: 204 };
  });
  res = mockRes();
  await register({ method: "POST", headers: KEY, body }, res);
  assert.strictEqual(res.code, 200);
  assert.strictEqual(res.body.id, 9);
  const del1 = calls.find((c) => c.opts.method === "DELETE");
  assert.ok(del1 && del1.url.endsWith("/foot_photo_framings?photo_id=eq.9"));

  // same path as before → framings are kept
  stubFetch((url, opts) => {
    if (opts.method === "HEAD") return { ok: true };
    if (!opts.method) return { ok: true, json: async () => [{ id: 9, path: body.path }] };
    return { ok: true, status: 201, json: async () => [{ id: 9 }] };
  });
  res = mockRes();
  await register({ method: "POST", headers: KEY, body }, res);
  assert.strictEqual(res.code, 200);
  assert.ok(!calls.some((c) => c.opts.method === "DELETE"));
});

test("photo-delete validates id and deletes the row", async () => {
  stubFetch(() => ({ ok: true, status: 204 }));
  let res = mockRes();
  await del({ method: "POST", headers: KEY, body: { id: "abc" } }, res);
  assert.strictEqual(res.code, 400);
  res = mockRes();
  await del({ method: "POST", headers: KEY, body: { id: 12 } }, res);
  assert.strictEqual(res.code, 200);
  assert.deepStrictEqual(res.body, { ok: true });
  assert.ok(calls[0].url.endsWith("/foot_player_photos?id=eq.12") && calls[0].opts.method === "DELETE");
});
