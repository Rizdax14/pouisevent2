// Endpoints for publishing, settings and the automatic run, with injected dependencies (nothing is posted).
const test = require("node:test");
const assert = require("node:assert/strict");
process.env.INSTA_ADMIN_KEY = "test-admin-key-123456";
process.env.CRON_SECRET = "cron-secret-1234567";
const L = require("./insta-logic.js");
const settingsH = require("./api/insta/settings");
const publishH = require("./api/insta/publish");
const cronH = require("./api/insta/cron");
const refreshH = require("./api/insta/refresh-token");

const res = () => { const r = { code: 200, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; }, end() { return r; } }; return r; };
const ADMIN = { "x-insta-admin-key": "test-admin-key-123456" };

const NOW = new Date("2026-10-08T07:05:00Z"); // Thursday 09:05 Paris
const data = () => ({
  players: [{ id: 1, name: "Louis" }], roster: [], events: [], ratings: [], posts: [],
  matches: [
    { id: 1, opponent_name: "Vieux FC", match_datetime: "2026-10-01T15:30:00Z", status: "finished" },
    { id: 2, opponent_name: "FC Test", match_datetime: "2026-10-08T15:30:00Z", status: "scheduled", city: "Paris", stadium_name: "Stade" },
  ],
  lineups: [{ match_id: 2, player_id: 1 }],
});
function fakePublisher(log, outcome = { status: "published" }) { return { publishTarget: async (t, o) => { log.push({ t, caption: o.caption }); return outcome; } }; }

test("settings: admin only, normalizes what is saved, GET returns defaults when nothing is stored", async () => {
  let r = res(); await settingsH({ method: "GET", headers: {} }, r); assert.equal(r.code, 401);
  let saved = null;
  settingsH.deps = { loadSettings: async () => L.defaultSettings(), save: async (s) => { saved = s; }, now: () => new Date("2026-10-08T07:00:00Z") };
  r = res(); await settingsH({ method: "GET", headers: ADMIN }, r);
  assert.equal(r.body.settings.matchday.mode, "manual");
  r = res(); await settingsH({ method: "POST", headers: ADMIN, body: { settings: { matchday: { mode: "auto", rule: { type: "before_match", days: 1, time: "18:00" } }, result: { mode: "hack" } } } }, r);
  assert.equal(r.code, 200);
  assert.equal(saved.matchday.mode, "auto");
  assert.equal(saved.result.mode, "manual");
  assert.equal(saved.groupe, undefined);
  assert.equal(r.body.settings.matchday.rule.time, "18:00");
});

test("publish: validates the section, the match and its availability before touching Instagram", async () => {
  const log = [];
  publishH.deps = { loadPublishData: async () => data(), makePublisher: async () => fakePublisher(log), loadFeatured: async () => ({}) };
  const call = async (body, headers = ADMIN) => { const r = res(); await publishH({ method: "POST", headers, body }, r); return r; };
  assert.equal((await call({ section: "matchday", match_id: 2 }, {})).code, 401);
  assert.equal((await call({ section: "nope", match_id: 2 })).code, 400);
  assert.equal((await call({ section: "matchday", match_id: 99 })).code, 400);
  assert.equal((await call({ section: "result", match_id: 2 })).code, 409); // not finished
  assert.equal((await call({ section: "ratings", match_id: 1 })).code, 409); // notes not validated
  assert.equal((await call({ section: "rankings", season: "x", week_key: "y" })).code, 400);
  assert.equal(log.length, 0);
  const ok = await call({ section: "matchday", match_id: 2, caption: "Texte" });
  assert.equal(ok.code, 200);
  assert.deepEqual(log[0], { t: { kind: "matchday", matchId: 2 }, caption: "Texte" });
  const rk = await call({ section: "rankings", season: "2026-2027", week_key: "2026-W41" });
  assert.equal(rk.code, 200);
  assert.deepEqual(log[1].t, { kind: "rankings", season: "2026-2027", weekKey: "2026-W41" });
});

test("publish: Match Day + Groupe with an empty sheet is refused; the old 'groupe' section no longer exists", async () => {
  const d = data(); d.lineups = [];
  publishH.deps = { loadPublishData: async () => d, makePublisher: async () => fakePublisher([]), loadFeatured: async () => ({}) };
  let r = res(); await publishH({ method: "POST", headers: ADMIN, body: { section: "matchday", match_id: 2 } }, r);
  assert.equal(r.code, 409);
  r = res(); await publishH({ method: "POST", headers: ADMIN, body: { section: "groupe", match_id: 2 } }, r);
  assert.equal(r.code, 400);
});

test("publish: an Instagram failure is a 502 with the message", async () => {
  publishH.deps = { loadPublishData: async () => data(), makePublisher: async () => fakePublisher([], { status: "failed", error: "Reconnecte le compte Instagram", expired: true }), loadFeatured: async () => ({}) };
  const r = res(); await publishH({ method: "POST", headers: ADMIN, body: { section: "matchday", match_id: 2 } }, r);
  assert.equal(r.code, 502);
  assert.match(r.body.error, /Reconnecte/);
  assert.equal(r.body.expired, true);
});

function cronSetup(settings, d = data(), log = []) {
  cronH.deps = { loadPublishData: async () => d, loadSettings: async () => settings, makePublisher: async () => fakePublisher(log), loadFeatured: async () => (d.__featured || {}), now: () => NOW };
  return log;
}
const run = async (query = {}, headers = ADMIN) => { const r = res(); await cronH({ method: "GET", headers, query }, r); return r; };

test("cron: refuses callers without the cron secret or admin key", async () => {
  cronSetup(L.defaultSettings());
  assert.equal((await run({}, {})).code, 401);
  assert.equal((await run({}, { authorization: "Bearer wrong-secret-1234567" })).code, 401);
  assert.equal((await run({}, { authorization: "Bearer cron-secret-1234567" })).code, 200);
  assert.equal((await run({}, ADMIN)).code, 200);
});

test("cron: manual sections are never published", async () => {
  const log = cronSetup(L.defaultSettings());
  const r = await run();
  assert.equal(log.length, 0);
  assert.ok(r.body.report.every((x) => x.action === "manuel"));
});

test("cron: an automatic section whose slot has come is published once; the others wait", async () => {
  const s = L.defaultSettings();
  const since = "2026-10-07T00:00:00.000Z";
  s.matchday = { mode: "auto", since, rule: { type: "before_match", days: 0, time: "09:00" } }; // due: 09:00 passed, now 09:05
  s.result = { mode: "auto", since, rule: { type: "after_match", days: 0, time: "22:00" } }; // match 1's slot predates the activation
  const log = cronSetup(s);
  const r = await run();
  assert.equal(log.length, 1);
  assert.deepEqual(log[0].t, { kind: "matchday", matchId: 2, weekKey: undefined, season: undefined, player: undefined }); // automatic rotation
  const by = Object.fromEntries(r.body.report.map((x) => [x.section, x.action]));
  assert.equal(by.matchday, "published");
  assert.equal(by.result, "en attente : Match pas encore terminé"); // old match 1 skipped; the next result waits for match 2
});

test("cron ?dry=1 reports without publishing", async () => {
  const s = L.defaultSettings();
  s.matchday = { mode: "auto", since: "2026-10-07T00:00:00.000Z", rule: { type: "before_match", days: 0, time: "09:00" } };
  const log = cronSetup(s);
  const r = await run({ dry: "1" });
  assert.equal(log.length, 0);
  assert.equal(r.body.report.find((x) => x.section === "matchday").action, "serait publié");
});

test("cron: waits for data (empty sheet) and gives up after 3 failures", async () => {
  const s = L.defaultSettings();
  s.matchday = { mode: "auto", since: "2026-10-07T00:00:00.000Z", rule: { type: "before_match", days: 0, time: "09:00" } };
  const empty = data(); empty.lineups = [];
  let log = cronSetup(s, empty);
  let r = await run();
  assert.equal(log.length, 0);
  assert.match(r.body.report.find((x) => x.section === "matchday").action, /convocation/i);
  const failing = data(); failing.posts = [1, 2, 3].map((i) => ({ id: i, kind: "matchday", match_id: 2, status: "failed" }));
  log = cronSetup(s, failing);
  r = await run();
  assert.equal(log.length, 0);
  assert.match(r.body.report.find((x) => x.section === "matchday").action, /3 échecs/);
});

test("cron: an already published post is not published again", async () => {
  const s = L.defaultSettings();
  s.matchday = { mode: "auto", since: "2026-10-07T00:00:00.000Z", rule: { type: "before_match", days: 0, time: "09:00" } };
  const d = data(); d.posts = [{ id: 1, kind: "matchday", match_id: 2, status: "published", published_at: "2026-10-08T07:00:30Z" }];
  const log = cronSetup(s, d);
  await run();
  assert.equal(log.length, 0);
});

test("refresh-token stores the renewed token; an expired one is a 401", async () => {
  let stored = null;
  refreshH.deps = { currentToken: async () => "OLD", refresh: async (t) => { assert.equal(t, "OLD"); return { token: "NEW", expiresIn: 1 }; }, store: async (t) => { stored = t; } };
  let r = res(); await refreshH({ method: "GET", headers: ADMIN }, r);
  assert.equal(r.code, 200); assert.equal(stored, "NEW");
  refreshH.deps.refresh = async () => { const e = new Error("expiré"); e.expired = true; throw e; };
  r = res(); await refreshH({ method: "GET", headers: ADMIN }, r);
  assert.equal(r.code, 401);
});

test("settings: switching a section to automatic stamps the activation date; staying automatic keeps it", async () => {
  const rule = { type: "before_match", days: 0, time: "09:00" };
  const before = { ...L.defaultSettings(), result: { mode: "auto", since: "2026-09-01T00:00:00.000Z", rule: { type: "after_match", days: 0, time: "22:00" } } };
  let saved = null;
  settingsH.deps = { loadSettings: async () => before, save: async (s) => { saved = s; }, now: () => new Date("2026-10-08T07:00:00Z") };
  const r = res();
  await settingsH({ method: "POST", headers: ADMIN, body: { settings: { matchday: { mode: "auto", rule }, result: { mode: "auto", since: "1999-01-01T00:00:00Z", rule: { type: "after_match", days: 0, time: "22:00" } }, ratings: { mode: "manual" } } } }, r);
  assert.equal(saved.matchday.since, "2026-10-08T07:00:00.000Z"); // newly automatic
  assert.equal(saved.result.since, "2026-09-01T00:00:00.000Z"); // already automatic: the client cannot rewrite it
  assert.equal(saved.ratings.since, undefined);
  // switching off then on again restarts the clock
  settingsH.deps.loadSettings = async () => ({ ...L.defaultSettings() });
  await settingsH({ method: "POST", headers: ADMIN, body: { settings: { result: { mode: "auto" } } } }, res());
  assert.equal(saved.result.since, "2026-10-08T07:00:00.000Z");
});

test("posts: admin only, returns the rows", async () => {
  const postsH = require("./api/insta/posts");
  postsH.deps = { list: async () => [{ id: 1, kind: "matchday", status: "published" }] };
  let r = res(); await postsH({ method: "GET", headers: {} }, r); assert.equal(r.code, 401);
  r = res(); await postsH({ method: "GET", headers: ADMIN }, r);
  assert.equal(r.code, 200);
  assert.equal(r.body.posts.length, 1);
  r = res(); await postsH({ method: "POST", headers: ADMIN }, r); assert.equal(r.code, 405);
});

// ---------- Choosing the player on the photo ----------
const featuredH = require("./api/insta/featured");

test("featured: admin only; stores a choice, clears it with null, rejects bad input", async () => {
  let stored = { "matchday:match:2": 5 };
  featuredH.deps = { load: async () => ({ ...stored }), save: async (m) => { stored = m; } };
  let r = res(); await featuredH({ method: "GET", headers: {} }, r); assert.equal(r.code, 401);
  r = res(); await featuredH({ method: "GET", headers: ADMIN }, r); assert.deepEqual(r.body.featured, { "matchday:match:2": 5 });
  r = res(); await featuredH({ method: "POST", headers: ADMIN, body: { key: "result:match:2", player_id: 7 } }, r);
  assert.equal(r.code, 200); assert.deepEqual(stored, { "matchday:match:2": 5, "result:match:2": 7 });
  r = res(); await featuredH({ method: "POST", headers: ADMIN, body: { key: "matchday:match:2", player_id: null } }, r);
  assert.deepEqual(stored, { "result:match:2": 7 });
  for (const body of [{ key: "rankings:week:2026-W41", player_id: 1 }, { key: "matchday:match:x", player_id: 1 }, { key: "matchday:match:2", player_id: "7" }, { key: "matchday:match:2", player_id: -1 }, {}]) {
    r = res(); await featuredH({ method: "POST", headers: ADMIN, body }, r); assert.equal(r.code, 400, JSON.stringify(body));
  }
});

test("publish: the saved choice is used; an explicit one overrides it; null forces the automatic rotation", async () => {
  const log = [];
  publishH.deps = { loadPublishData: async () => data(), makePublisher: async () => fakePublisher(log), loadFeatured: async () => ({ "matchday:match:2": 5 }) };
  const call = async (body) => { const r = res(); await publishH({ method: "POST", headers: ADMIN, body }, r); return r; };
  await call({ section: "matchday", match_id: 2 });
  await call({ section: "matchday", match_id: 2, player_id: 9 });
  await call({ section: "matchday", match_id: 2, player_id: null });
  assert.deepEqual(log.map((l) => l.t.player), [5, 9, undefined]);
});

test("cron: the chosen player is passed to the publication", async () => {
  const s = L.defaultSettings();
  s.matchday = { mode: "auto", since: "2026-10-07T00:00:00.000Z", rule: { type: "before_match", days: 0, time: "09:00" } };
  const d = data(); d.__featured = { "matchday:match:2": 7 };
  const log = cronSetup(s, d);
  await run();
  assert.equal(log.length, 1);
  assert.equal(log[0].t.player, 7);
});
