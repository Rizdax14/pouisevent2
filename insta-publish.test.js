// Instagram client and publisher against fakes: no network, nothing is ever posted.
const test = require("node:test");
const assert = require("node:assert/strict");
const { createClient, InstagramError } = require("./lib/insta/instagram");

function fakeGraph(script = {}) {
  const calls = [];
  let n = 0;
  const fetchFn = async (url, opts = {}) => {
    const u = new URL(url);
    const body = opts.body ? Object.fromEntries(new URLSearchParams(String(opts.body))) : Object.fromEntries(u.searchParams);
    calls.push({ method: opts.method || "GET", path: u.pathname.replace("/v23.0", ""), body });
    const key = `${opts.method || "GET"} ${u.pathname.replace("/v23.0", "")}`;
    if (script[key]) return script[key](body);
    if (key.startsWith("POST") && key.endsWith("/media")) return { ok: true, status: 200, json: async () => ({ id: `c${++n}` }) };
    if (key.startsWith("POST") && key.endsWith("/media_publish")) return { ok: true, status: 200, json: async () => ({ id: "m1" }) };
    if (body.fields === "status_code") return { ok: true, status: 200, json: async () => ({ status_code: "FINISHED" }) };
    if (body.fields === "permalink") return { ok: true, status: 200, json: async () => ({ permalink: "https://instagram.com/p/abc" }) };
    return { ok: false, status: 404, json: async () => ({ error: { message: "unexpected " + key } }) };
  };
  return { fetchFn, calls };
}
const mk = (g, extra = {}) => createClient({ token: "T", userId: "U", fetchFn: g.fetchFn, sleep: async () => {}, ...extra });

test("single image: container → wait FINISHED → publish → permalink", async () => {
  const g = fakeGraph();
  const r = await mk(g).publishImages({ urls: ["https://x/1.jpg"], caption: "Salut" });
  assert.deepEqual(r, { mediaId: "m1", permalink: "https://instagram.com/p/abc" });
  assert.deepEqual(g.calls.map((c) => `${c.method} ${c.path}`), ["POST /U/media", "GET /c1", "POST /U/media_publish", "GET /m1"]);
  assert.equal(g.calls[0].body.image_url, "https://x/1.jpg");
  assert.equal(g.calls[0].body.caption, "Salut");
  assert.equal(g.calls[0].body.access_token, "T");
  assert.equal(g.calls[2].body.creation_id, "c1");
});

test("carousel: children first (no caption), then the CAROUSEL container with the caption, then publish", async () => {
  const g = fakeGraph();
  await mk(g).publishImages({ urls: ["a", "b", "c"], caption: "Classements" });
  const media = g.calls.filter((c) => c.path === "/U/media");
  assert.equal(media.length, 4);
  assert.ok(media.slice(0, 3).every((c) => c.body.is_carousel_item === "true" && !c.body.caption));
  assert.equal(media[3].body.media_type, "CAROUSEL");
  assert.equal(media[3].body.children, "c1,c2,c3");
  assert.equal(media[3].body.caption, "Classements");
  const order = g.calls.map((c) => c.path);
  assert.ok(order.lastIndexOf("/U/media") < order.indexOf("/U/media_publish"));
});

test("media_publish is never called when a container errors", async () => {
  const g = fakeGraph({ "GET /c1": () => ({ ok: true, status: 200, json: async () => ({ status_code: "ERROR" }) }) });
  await assert.rejects(() => mk(g).publishImages({ urls: ["a"], caption: "x" }), /refusé l'image/);
  assert.ok(!g.calls.some((c) => c.path.endsWith("/media_publish")));
});

test("polls until FINISHED, and gives up with a clear message", async () => {
  let k = 0;
  const g = fakeGraph({ "GET /c1": () => ({ ok: true, status: 200, json: async () => ({ status_code: ++k < 3 ? "IN_PROGRESS" : "FINISHED" }) }) });
  await mk(g).publishImages({ urls: ["a"], caption: "x" });
  assert.equal(k, 3);
  const slow = fakeGraph({ "GET /c1": () => ({ ok: true, status: 200, json: async () => ({ status_code: "IN_PROGRESS" }) }) });
  await assert.rejects(() => mk(slow, { maxPolls: 3 }).publishImages({ urls: ["a"], caption: "x" }), /trop de temps/);
});

test("an expired token is reported as such", async () => {
  const g = fakeGraph({ "POST /U/media": () => ({ ok: false, status: 400, json: async () => ({ error: { message: "Error validating access token", code: 190, type: "OAuthException" } }) }) });
  await assert.rejects(() => mk(g).publishImages({ urls: ["a"], caption: "x" }), (e) => e instanceof InstagramError && e.expired && /Reconnecte/.test(e.message));
});

test("other Instagram errors keep their message", async () => {
  const g = fakeGraph({ "POST /U/media": () => ({ ok: false, status: 400, json: async () => ({ error: { message: "Media ID is not available", code: 9007 } }) }) });
  await assert.rejects(() => mk(g).publishImages({ urls: ["a"], caption: "x" }), /Media ID is not available/);
});

test("a failing permalink lookup does not fail a published post", async () => {
  const g = fakeGraph({ "GET /m1": () => ({ ok: false, status: 500, json: async () => ({ error: { message: "x" } }) }) });
  const r = await mk(g).publishImages({ urls: ["a"], caption: "x" });
  assert.deepEqual(r, { mediaId: "m1", permalink: null });
});

test("missing token or user id fails early", () => {
  assert.throws(() => createClient({ token: "", userId: "U" }), /non configuré/);
});

test("refreshToken returns the new token", async () => {
  const fetchFn = async () => ({ ok: true, status: 200, json: async () => ({ access_token: "NEW", expires_in: 5184000 }) });
  assert.deepEqual(await createClient({ token: "T", userId: "U", fetchFn }).refreshToken(), { token: "NEW", expiresIn: 5184000 });
  const bad = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: "nope" } }) });
  await assert.rejects(() => createClient({ token: "T", userId: "U", fetchFn: bad }).refreshToken(), /refusé/);
});

// ---------- Publisher: exactly-once publication ----------
const { createPublisher } = require("./lib/insta/publisher");

function fakeWorld({ rows = [], igFail = null, uploadFail = false, featuredFail = false, badTag = false } = {}) {
  const w = { badTag };
  const db = rows.map((r) => ({ ...r }));
  let id = 100;
  const log = [];
  const deps = {
    now: () => new Date("2026-10-08T07:00:00Z"),
    async sbGet(table, q) {
      const m = q.match(/kind=eq\.(\w+)&(match_id|week_key)=eq\.([^&]+)/);
      return db.filter((r) => r.kind === m[1] && String(r[m[2]]) === decodeURIComponent(m[3])).map((r) => ({ ...r }));
    },
    async sbWrite(method, table, q, body) {
      log.push(`${method} ${q || ""}`);
      if (method === "POST") { const r = { id: ++id, created_at: "2026-10-08T07:00:00Z", ...body }; db.push(r); return [{ ...r }]; }
      const idm = Number(q.match(/id=eq\.(\d+)/)[1]);
      if (method === "DELETE") { db.splice(db.findIndex((r) => r.id === idm), 1); return null; }
      Object.assign(db.find((r) => r.id === idm), body); return [{ ...db.find((r) => r.id === idm) }];
    },
    async renderImages(t) { log.push("render"); if (t.kind === "result") { const b = [Buffer.from("1")]; b.points = [[{ playerId: 1, x: 86, y: 1242 }, { playerId: 9, x: 10, y: 10 }]]; return b; } return t.kind === "rankings" ? [Buffer.from("1"), Buffer.from("2"), Buffer.from("3"), Buffer.from("4"), Buffer.from("5")] : t.kind === "matchday" ? [Buffer.from("1"), Buffer.from("2")] : [Buffer.from("1")]; },
    featuredId: async (t) => { if (featuredFail) throw new Error("db down"); log.push(`featured ${t.player || "auto"}`); return t.player || 21; },
    async uploadImage(p) { log.push("upload " + p); if (uploadFail) throw new Error("storage down"); },
    publicUrl: (p) => `https://pub/${p}`,
    igClient: () => ({ async taggable(names) { return new Set(names.filter((u) => u !== w.badTag)); }, async publishImages({ urls, caption, userTags }) { log.push(`ig ${urls.length} ${caption}`); const tagged = userTags && userTags.some((t) => t.length); if (tagged) log.push("tags " + JSON.stringify(userTags)); if (igFail) throw igFail; if (tagged && w.badTag && userTags.flat().some((t) => t.username === w.badTag)) throw new Error("Instagram : Invalid user id"); return { mediaId: "m9", permalink: "https://instagram.com/p/z" }; } }),
  };
  return { db, log, pub: createPublisher(deps) };
}
const DATA = { matches: [{ id: 2, opponent_name: "FC Test", match_datetime: "2026-10-08T15:30:00Z", status: "scheduled", city: "Paris", stadium_name: "Stade" }], lineups: [{ match_id: 2, player_id: 1 }], events: [], ratings: [], players: [{ id: 1, name: "Louis" }] };

test("publishes once: row created, images uploaded, Instagram called, row marked published", async () => {
  const w = fakeWorld();
  const r = await w.pub.publishTarget({ kind: "matchday", matchId: 2 }, { data: DATA });
  assert.equal(r.status, "published");
  assert.equal(w.db.length, 1);
  assert.equal(w.db[0].status, "published");
  assert.equal(w.db[0].ig_media_id, "m9");
  assert.equal(w.db[0].permalink, "https://instagram.com/p/z");
  assert.match(w.db[0].image_paths[0], /^matchday\/2-\d+-1\.jpg$/);
  assert.match(w.log.find((l) => l.startsWith("ig ")), /^ig 2 MATCH DAY/); // Match Day + Groupe: a two-image carousel
});

test("a tagged account Instagram refuses (private): the post goes out with the other tags and says who was left out", async () => {
  const w = fakeWorld({ badTag: "priv.acc" });
  const r = await w.pub.publishTarget({ kind: "result", matchId: 2 }, { data: { ...DATA, matches: [{ ...DATA.matches[0], status: "finished" }], instagram: { 1: "@Louis.BL ", 9: "priv.acc" } } });
  assert.equal(r.status, "published");
  const tags = w.log.filter((l) => l.startsWith("tags "));
  assert.equal(tags.length, 2);
  assert.match(tags[1], /louis\.bl/);
  assert.doesNotMatch(tags[1], /priv\.acc/);
  assert.match(w.db[0].error, /sans identifier priv\.acc/);
});

test("a second publish of the same post never calls Instagram again", async () => {
  const w = fakeWorld();
  await w.pub.publishTarget({ kind: "matchday", matchId: 2 }, { data: DATA });
  const before = w.log.length;
  const r = await w.pub.publishTarget({ kind: "matchday", matchId: 2 }, { data: DATA });
  assert.equal(r.status, "already_published");
  assert.equal(w.log.length, before);
});

test("an edited caption is used as is; an empty one falls back to the default", async () => {
  let w = fakeWorld();
  await w.pub.publishTarget({ kind: "matchday", matchId: 2 }, { data: DATA, caption: "Mon texte" });
  assert.ok(w.log.includes("ig 2 Mon texte"));
  w = fakeWorld();
  await w.pub.publishTarget({ kind: "matchday", matchId: 2 }, { data: DATA, caption: "   " });
  assert.match(w.log.find((l) => l.startsWith("ig ")), /MATCH DAY/);
});

test("a fresh draft means a publication is in progress: nothing is rendered or sent", async () => {
  const w = fakeWorld({ rows: [{ id: 1, kind: "matchday", match_id: 2, status: "draft", created_at: "2026-10-08T06:58:00Z" }] });
  const r = await w.pub.publishTarget({ kind: "matchday", matchId: 2 }, { data: DATA });
  assert.equal(r.status, "in_progress");
  assert.ok(!w.log.includes("render"));
});

test("a stale draft (crashed run) does not block a new publication", async () => {
  const w = fakeWorld({ rows: [{ id: 1, kind: "matchday", match_id: 2, status: "draft", created_at: "2026-10-08T06:00:00Z" }] });
  assert.equal((await w.pub.publishTarget({ kind: "matchday", matchId: 2 }, { data: DATA })).status, "published");
});

test("a failed post can be retried; an Instagram error is recorded on the row and reported", async () => {
  const bad = new Error("Instagram : boom");
  const w = fakeWorld({ igFail: bad });
  const r = await w.pub.publishTarget({ kind: "matchday", matchId: 2 }, { data: DATA });
  assert.equal(r.status, "failed");
  assert.match(r.error, /boom/);
  assert.equal(w.db[0].status, "failed");
  assert.match(w.db[0].error, /boom/);
  const w2 = fakeWorld({ rows: [{ id: 1, kind: "matchday", match_id: 2, status: "failed", created_at: "2026-10-08T06:00:00Z" }] });
  assert.equal((await w2.pub.publishTarget({ kind: "matchday", matchId: 2 }, { data: DATA })).status, "published");
});

test("a storage failure is a failed post and Instagram is never called", async () => {
  const w = fakeWorld({ uploadFail: true });
  const r = await w.pub.publishTarget({ kind: "matchday", matchId: 2 }, { data: DATA });
  assert.equal(r.status, "failed");
  assert.ok(!w.log.some((l) => l.startsWith("ig ")));
});

test("rankings publish a 5-image carousel keyed by ISO week", async () => {
  const w = fakeWorld();
  const r = await w.pub.publishTarget({ kind: "rankings", weekKey: "2026-W41", season: "2026-2027" }, { data: DATA });
  assert.equal(r.status, "published");
  assert.equal(w.db[0].week_key, "2026-W41");
  assert.equal(w.db[0].match_id, null);
  assert.equal(w.db[0].image_paths.length, 5);
  assert.ok(w.log.includes("ig 5 Les classements mis à jour après cette nouvelle semaine de compétition !"));
  assert.equal((await w.pub.publishTarget({ kind: "rankings", weekKey: "2026-W41", season: "2026-2027" }, { data: DATA })).status, "already_published");
  assert.equal((await w.pub.publishTarget({ kind: "rankings", weekKey: "2026-W42", season: "2026-2027" }, { data: DATA })).status, "published");
});

test("Match Day + Groupe is published as a 2-image carousel and the featured player is recorded for the rotation", async () => {
  const w = fakeWorld();
  await w.pub.publishTarget({ kind: "matchday", matchId: 2, player: 5 }, { data: DATA });
  assert.equal(w.db[0].image_paths.length, 2);
  assert.deepEqual(w.db[0].featured, { matchday: 5 });
  assert.ok(w.log.some((l) => /^ig 2 MATCH DAY/.test(l)));
});

test("a failure while recording the featured player never fails a published post", async () => {
  const w = fakeWorld({ featuredFail: true });
  const r = await w.pub.publishTarget({ kind: "matchday", matchId: 2 }, { data: DATA });
  assert.equal(r.status, "published");
  assert.deepEqual(w.db[0].featured, {});
});

test("players with an Instagram username are tagged where the image shows them", async () => {
  const w = fakeWorld();
  const data = { ...DATA, matches: [{ ...DATA.matches[0], status: "finished" }], instagram: { 1: "louis.bl" } };
  await w.pub.publishTarget({ kind: "result", matchId: 2 }, { data });
  assert.ok(w.log.includes('tags [[{"username":"louis.bl","x":0.08,"y":0.92}]]'), w.log.join("\n"));
});

test("Instagram client sends user_tags on the images that have some", async () => {
  const { createClient } = require("./lib/insta/instagram");
  const calls = [];
  const fetchFn = async (url, opts) => {
    const body = opts && opts.body ? Object.fromEntries(new URLSearchParams(String(opts.body))) : {};
    calls.push({ url: String(url), body });
    const ok = (d) => ({ ok: true, json: async () => d });
    if (String(url).includes("fields=status_code")) return ok({ status_code: "FINISHED" });
    if (String(url).includes("fields=permalink")) return ok({ permalink: "p" });
    return ok({ id: "c" + calls.length });
  };
  const c = createClient({ token: "t", userId: "u", fetchFn, sleep: async () => {} });
  await c.publishImages({ urls: ["a", "b"], caption: "x", userTags: [[], [{ username: "louis.bl", x: 0.1, y: 0.9 }]] });
  const kids = calls.filter((k) => k.body.is_carousel_item);
  assert.equal(kids[0].body.user_tags, undefined);
  assert.deepEqual(JSON.parse(kids[1].body.user_tags), [{ username: "louis.bl", x: 0.1, y: 0.9 }]);
});
