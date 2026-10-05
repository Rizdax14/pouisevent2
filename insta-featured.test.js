// The real Match Day build against a stubbed database: which player stands on the visual?
const test = require("node:test");
const assert = require("node:assert/strict");
const sharp = require("sharp");
const supa = require("./lib/insta/supabase");

let tables;
const fetched = []; // photo files the renderer asked for: tells which player is on the visual
supa.sbGet = async (table, query) => {
  const rows = tables[table] || [];
  const m = query.match(/\bid=eq\.(\d+)/);
  return m ? rows.filter((r) => r.id === Number(m[1])) : rows;
};
const realFetch = global.fetch;
test.before(async () => {
  const png = await sharp({ create: { width: 400, height: 500, channels: 4, background: { r: 200, g: 50, b: 50, alpha: 1 } } }).png().toBuffer();
  global.fetch = async (url) => {
    if (String(url).includes("/player-photos/")) { fetched.push(decodeURIComponent(String(url).split("/player-photos/")[1])); return new Response(png, { headers: { "content-type": "image/png" } }); }
    return realFetch(url);
  };
});
test.after(() => { global.fetch = realFetch; });
const { build } = require("./api/insta/render");

let uid = 0; // unique file names: the renderer caches images by URL
const photo = (id, player, kind = "celebration", kit = "exterieur") => ({ id, player_id: player, kit, kind, retouched: false, path: `${player}/${kit}/${kind}-${++uid}.png`, width: 400, height: 500 });
const setup = (extra = {}) => {
  tables = {
    players: [1, 2, 3].map((id) => ({ id, name: `P${id}`, display_name: `P${id}` })),
    foot_roster: [{ player_id: 1, role: "regulier" }, { player_id: 2, role: "occasionnel" }, { player_id: 3, role: "invite" }],
    foot_player_photos: [photo(10, 1), photo(11, 2), photo(12, 3)],
    foot_photo_framings: [], foot_match_events: [], foot_ratings: [], foot_insta_posts: [],
    foot_matches: [{ id: 6, opponent_name: "En Avant Guinguette", match_datetime: "2026-10-15T17:30:00Z", status: "scheduled", venue: "exterieur" }],
    foot_lineups: [],
    ...extra,
  };
};
const hasPlayerPhoto = (el) => {
  const walk = (n) => (n && n.props ? (n.type === "img" && /^data:image\/png/.test(n.props.src || "") ? 1 : [].concat(n.props.children || []).reduce((a, c) => a + walk(c), 0)) : 0);
  return walk(el) > 0;
};

test("Match Day with no sheet still features a roster player", async () => {
  setup();
  assert.ok(hasPlayerPhoto(await build("matchday", { match: "6", page: 1 })));
});

test("with a sheet, the featured player comes from the sheet", async () => {
  setup({ foot_lineups: [{ match_id: 6, player_id: 2 }] });
  const el = await build("matchday", { match: "6", page: 1 });
  assert.ok(hasPlayerPhoto(el));
});

test("a guest alone has a photo → nobody is featured (guests are never picked from the roster)", async () => {
  setup({ foot_player_photos: [photo(12, 3)] });
  assert.ok(!hasPlayerPhoto(await build("matchday", { match: "6", page: 1 })));
});

test("nobody has any photo → the visual still renders, without a player", async () => {
  setup({ foot_player_photos: [] });
  assert.ok(!hasPlayerPhoto(await build("matchday", { match: "6", page: 1 })));
});

const who = async (q) => { fetched.length = 0; await build("matchday", q); return fetched.map((p) => Number(p.split("/")[0])); };

test("Match Day and Groupe feature the same player (preferring someone who has both photos)", async () => {
  setup({ foot_player_photos: [photo(10, 1), photo(11, 2), photo(12, 2, "dos")], foot_lineups: [{ match_id: 6, player_id: 1 }, { match_id: 6, player_id: 2 }] });
  assert.deepEqual(await who({ match: "6", page: 1 }), [2]);
  assert.deepEqual(await who({ match: "6", page: 2 }), [2]);
});

test("an explicit choice (?player=) puts that player on both images; a missing dos photo just leaves the Groupe image bare", async () => {
  setup({ foot_player_photos: [photo(10, 1), photo(11, 2), photo(12, 2, "dos")], foot_lineups: [{ match_id: 6, player_id: 1 }, { match_id: 6, player_id: 2 }] });
  assert.deepEqual(await who({ match: "6", page: 1, player: "1" }), [1]);
  assert.deepEqual(await who({ match: "6", page: 2, player: "1" }), []); // player 1 has no dos photo
  assert.deepEqual(await who({ match: "6", page: 2, player: "2" }), [2]);
});

test("a junk ?player= is ignored (automatic rotation)", async () => {
  setup({ foot_player_photos: [photo(10, 1)], foot_lineups: [{ match_id: 6, player_id: 1 }] });
  assert.deepEqual(await who({ match: "6", page: 1, player: "abc" }), [1]);
});

test("rotation: the player featured last time is skipped next time", async () => {
  setup({
    foot_player_photos: [photo(10, 1), photo(11, 2)],
    foot_lineups: [{ match_id: 6, player_id: 1 }, { match_id: 6, player_id: 2 }],
    foot_insta_posts: [{ status: "published", published_at: "2026-10-01T10:00:00Z", featured: { matchday: 1 } }],
  });
  assert.deepEqual(await who({ match: "6", page: 1 }), [2]);
});
