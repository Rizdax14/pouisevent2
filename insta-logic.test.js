const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("./insta-logic.js");

const raw = { id: 1, player_id: 7, kit: "domicile", kind: "celebration", retouched: false, width: 2230, height: 1888 };
const ret = { id: 2, player_id: 7, kit: "domicile", kind: "celebration", retouched: true, width: 1080, height: 1350 };

test("defaultFraming: retouched photos fill the canvas", () => {
  assert.deepEqual(L.defaultFraming("matchday", ret), { x: 0, y: 0, width: 1080 });
});

test("defaultFraming: raw photos fit the layout box, bottom-aligned and centred", () => {
  const f = L.defaultFraming("matchday", raw);
  const h = f.width * raw.height / raw.width;
  assert.ok(f.width <= 960 + 1e-9 && h <= 1050 + 1e-9);
  assert.equal(Math.round(f.y + h), 230 + 1050);
  assert.equal(Math.round(f.x + f.width / 2), 60 + 480);
});

test("defaultFraming: render covers the circle", () => {
  const r = { ...raw, kind: "render", width: 800, height: 1000 };
  const f = L.defaultFraming("render", r);
  assert.equal(f.width, 300);
  assert.equal(f.y, 0);
});

test("framedRect uses a saved framing and derives the height", () => {
  assert.deepEqual(L.framedRect("matchday", raw, { x: 10, y: 20, width: 1115 }), { x: 10, y: 20, width: 1115, height: 944 });
});

test("choosePhoto prefers same kit, retouched, then the other kit, else null", () => {
  const other = { ...raw, id: 3, kit: "exterieur" };
  assert.equal(L.choosePhoto([raw, ret, other], 7, "celebration", "domicile").id, 2);
  assert.equal(L.choosePhoto([other], 7, "celebration", "domicile").id, 3);
  assert.equal(L.choosePhoto([raw], 7, "dos", "domicile"), null);
});

test("pickFeatured: never-featured first, then least recent", () => {
  const hist = [{ playerId: 1, at: "2026-10-01" }, { playerId: 2, at: "2026-09-01" }];
  assert.equal(L.pickFeatured([1, 2, 3], hist, 5), 3);
  assert.equal(L.pickFeatured([1, 2], hist, 5), 2);
  assert.equal(L.pickFeatured([], hist, 5), null);
});

test("pickFeatured is stable for the same seed", () => {
  assert.equal(L.pickFeatured([4, 5, 6], [], 42), L.pickFeatured([4, 5, 6], [], 42));
});

test("postName uses first names unless two players share one", () => {
  const ps = [{ id: 1, name: "Louis", display_name: "Louis Mar" }, { id: 2, name: "Thomas", display_name: "Thomas" }, { id: 3, name: "Louis", display_name: "Louis B" }];
  assert.equal(L.postName(ps[1], ps), "Thomas");
  assert.equal(L.postName(ps[0], ps), "Louis Mar");
  assert.equal(L.postName(ps[0], [ps[0], ps[1]]), "Louis");
});

test("opponentLabel abbreviates long names", () => {
  assert.equal(L.opponentLabel("FC Caribou"), "FC CARIBOU");
  assert.equal(L.opponentLabel("Entente Sportive Saint-Priest"), "ESSP");
  assert.equal(L.opponentLabel("En Avant Guinguette"), "EAG");
});

test("matchBand formats day, time, stadium and city", () => {
  const m = { match_datetime: new Date(2026, 9, 8, 19, 30).toISOString(), stadium_name: "L'Étivallière", city: "Saint-Étienne", address: "x" };
  assert.equal(L.matchBand(m), "JEUDI 19H30 | L'ÉTIVALLIÈRE | SAINT-ÉTIENNE");
  assert.equal(L.matchBand({ ...m, stadium_name: null }), "JEUDI 19H30 | X | SAINT-ÉTIENNE");
});

test("groupeLines sorts by jersey number then name, numberless last", () => {
  const players = [{ id: 1, name: "Thomas" }, { id: 2, name: "Léandre" }, { id: 3, name: "Nolan" }, { id: 4, name: "Zed" }];
  const roster = [{ player_id: 1, jersey_number: "25" }, { player_id: 2, jersey_number: "67" }, { player_id: 3, jersey_number: "02" }, { player_id: 4, jersey_number: null }];
  assert.deepEqual(L.groupeLines([1, 2, 3, 4], roster, players), [
    { number: "02", name: "Nolan" }, { number: "25", name: "Thomas" }, { number: "67", name: "Léandre" }, { number: null, name: "Zed" },
  ]);
});

test("goalLines lists BL goals with assists in match order", () => {
  const players = [{ id: 1, name: "Louis" }, { id: 2, name: "Thisma" }];
  const ev = [
    { half: 2, minute: 5, type: "goal_bl", player_id: 2, assist_player_id: null },
    { half: 1, minute: 32, type: "goal_bl", player_id: 1, assist_player_id: 2 },
    { half: 1, minute: 40, type: "goal_opponent", player_id: null, assist_player_id: null },
  ];
  assert.deepEqual(L.goalLines(ev, players), ["32' Louis (Thisma)", "5' Thisma"]);
});

test("rankingEntries keeps positive values, sorted, limited", () => {
  const rows = [{ playerId: 1, goals: 2 }, { playerId: 2, goals: 0 }, { playerId: 3, goals: 5 }, { playerId: 4, goals: 2 }];
  const name = (id) => ({ 1: "B", 3: "C", 4: "A" })[id];
  assert.deepEqual(L.rankingEntries(rows, "goals", name, 2), [{ playerId: 3, value: 5 }, { playerId: 4, value: 2 }]);
});

test("rankingRows splits into 3 then 4s", () => {
  assert.deepEqual(L.rankingRows(13), [3, 4, 4, 2]);
  assert.deepEqual(L.rankingRows(2), [2]);
  assert.deepEqual(L.rankingRows(0), []);
});

test("captionFor builds the result caption", () => {
  assert.equal(L.captionFor("result", { opponent: "FC Caribou", bl: 8, opp: 6, goals: ["32' Louis (Thisma)"] }), "Victoire 8-6 contre FC Caribou ⚽\n\n32' Louis (Thisma)");
  assert.match(L.captionFor("result", { opponent: "X", bl: 1, opp: 1, goals: [] }), /^Match nul 1-1/);
});

test("availablePosts lists matchday, result, ratings and rankings when eligible", () => {
  const matches = [
    { id: 1, status: "scheduled", opponent_name: "A", match_datetime: "2026-10-20T17:30:00Z" },
    { id: 2, status: "finished", opponent_name: "B", match_datetime: "2026-10-10T17:30:00Z", ratings_validated_at: "x" },
  ];
  const lineups = [{ match_id: 1, player_id: 5 }];
  const kinds = L.availablePosts({ matches, lineups, now: new Date("2026-10-15T10:00:00Z") }).map((p) => `${p.kind}:${p.matchId ?? p.season}`);
  assert.deepEqual(kinds, ["matchday:1", "result:2", "ratings:2", "rankings:2026-2027"]);
});

test("defaultFraming: podium covers the card from the top, using the dos photo", () => {
  assert.equal(L.PHOTO_KIND_FOR_LAYOUT.podium, "dos");
  const f = L.defaultFraming("podium", { kind: "dos", width: 1000, height: 1000 });
  assert.equal(f.width, 430);
  assert.equal(f.y, 0);
  assert.equal(f.x, (330 - 430) / 2);
});

test("ratingRows: sorted by match rating desc, unrated last, with season averages", () => {
  const rows = L.ratingRows([1, 2, 3], { 1: 6, 2: 8.25, 3: null }, { 1: 7, 2: null, 3: 5 }, (id) => ({ 1: "Louis", 2: "Nolan", 3: "Solal" })[id]);
  assert.deepEqual(rows, [
    { playerId: 2, name: "Nolan", match: 8.25, season: null },
    { playerId: 1, name: "Louis", match: 6, season: 7 },
    { playerId: 3, name: "Solal", match: null, season: 5 },
  ]);
});

test("ratingRows: ties broken by name", () => {
  const rows = L.ratingRows([1, 2], { 1: 7, 2: 7 }, {}, (id) => (id === 1 ? "Zoé" : "Adam"));
  assert.deepEqual(rows.map((r) => r.name), ["Adam", "Zoé"]);
});
