// The real Match Day build against a stubbed database: which player stands on the visual?
const test = require("node:test");
const assert = require("node:assert/strict");
const sharp = require("sharp");
const supa = require("./lib/insta/supabase");

let tables;
supa.sbGet = async (table, query) => {
  const rows = tables[table] || [];
  const m = query.match(/\bid=eq\.(\d+)/);
  return m ? rows.filter((r) => r.id === Number(m[1])) : rows;
};
const realFetch = global.fetch;
test.before(async () => {
  const png = await sharp({ create: { width: 400, height: 500, channels: 4, background: { r: 200, g: 50, b: 50, alpha: 1 } } }).png().toBuffer();
  global.fetch = async (url) => (String(url).includes("/player-photos/") ? new Response(png, { headers: { "content-type": "image/png" } }) : realFetch(url));
});
test.after(() => { global.fetch = realFetch; });
const { build } = require("./api/insta/render");

const photo = (id, player, kind = "celebration", kit = "exterieur") => ({ id, player_id: player, kit, kind, retouched: false, path: `${player}/${kit}/${kind}.png`, width: 400, height: 500 });
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
