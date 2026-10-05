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
  const m = { match_datetime: "2026-10-08T17:30:00Z", stadium_name: "L'Étivallière", city: "Saint-Étienne", address: "x" };
  assert.equal(L.matchBand(m), "JEUDI 19H30 | L'ÉTIVALLIÈRE | SAINT-ÉTIENNE");
  assert.equal(L.matchBand({ ...m, stadium_name: null }), "JEUDI 19H30 | X | SAINT-ÉTIENNE");
});

test("matchBand always shows Paris time, whatever the server's timezone (summer, winter, near midnight)", () => {
  assert.match(L.matchBand({ match_datetime: "2026-10-08T17:30:00+00:00" }), /^JEUDI 19H30/); // CEST
  assert.match(L.matchBand({ match_datetime: "2026-12-10T18:30:00Z" }), /^JEUDI 19H30/); // CET
  assert.match(L.matchBand({ match_datetime: "2026-10-08T22:30:00Z" }), /^VENDREDI 00H30/); // past midnight in Paris
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

test("defaultFraming: podium layouts cover the card from the top, one per photo kind", () => {
  assert.equal(L.PHOTO_KIND_FOR_LAYOUT.podium_dos, "dos");
  assert.equal(L.PHOTO_KIND_FOR_LAYOUT.podium_celebration, "celebration");
  assert.equal(L.PHOTO_KIND_FOR_LAYOUT.podium_render, "render");
  for (const layout of ["podium_dos", "podium_celebration", "podium_render"]) {
    const f = L.defaultFraming(layout, { kind: "dos", width: 1000, height: 1000 });
    assert.deepEqual(f, { x: (330 - 430) / 2, y: 0, width: 430 });
  }
});

test("goalRows gives minute, scorer and assist in match order", () => {
  const players = [{ id: 1, name: "Louis" }, { id: 2, name: "Thisma" }];
  const ev = [
    { half: 2, minute: 5, type: "goal_bl", player_id: 2, assist_player_id: null },
    { half: 1, minute: 32, type: "goal_bl", player_id: 1, assist_player_id: 2 },
    { half: 1, minute: 40, type: "goal_opponent", player_id: null, assist_player_id: null },
  ];
  assert.deepEqual(L.goalRows(ev, players), [{ minute: 32, scorer: "Louis", assist: "Thisma" }, { minute: 5, scorer: "Thisma", assist: null }]);
});

test("RANKING_PAGES: Buts (célébration), Passes D (dos), Notes moyennes (render)", () => {
  assert.deepEqual(L.RANKING_PAGES.map((p) => [p.key, p.layout]), [["goals", "podium_celebration"], ["assists", "podium_dos"], ["rating", "podium_render"]]);
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

test("zoomFramingAt keeps the canvas point under the cursor fixed", () => {
  const f = { x: 100, y: 200, width: 400 };
  const g = L.zoomFramingAt(f, 1.5, 300, 350);
  assert.equal(g.width, 600);
  // point (300,350) sits at the same relative spot of the photo before and after
  assert.equal((300 - f.x) / f.width, (300 - g.x) / g.width);
  assert.equal((350 - f.y) / f.width, (350 - g.y) / g.width);
});

test("zoomFramingAt: factor 1 is a no-op and bad factors are ignored", () => {
  const f = { x: -20, y: 5, width: 300 };
  assert.deepEqual(L.zoomFramingAt(f, 1, 10, 10), f);
  assert.deepEqual(L.zoomFramingAt(f, 0, 10, 10), f);
  assert.deepEqual(L.zoomFramingAt(f, NaN, 10, 10), f);
});

test("zoomFramingAt clamps the width between 20% and 800% of the reference width", () => {
  const f = { x: 0, y: 0, width: 400 };
  assert.equal(L.zoomFramingAt(f, 100, 0, 0, 400).width, 3200);
  assert.equal(L.zoomFramingAt(f, 0.001, 0, 0, 400).width, 80);
});

test("framingZoomPercent: 100% is the reference width", () => {
  assert.equal(L.framingZoomPercent({ x: 0, y: 0, width: 500 }, 500), 100);
  assert.equal(L.framingZoomPercent({ x: 0, y: 0, width: 750 }, 500), 150);
});

test("Résultat has exactly the same placement as Match Day", () => {
  assert.deepEqual(L.LAYOUTS.result, L.LAYOUTS.matchday);
  assert.deepEqual(L.defaultFraming("result", raw), L.defaultFraming("matchday", raw));
  assert.deepEqual(L.defaultFraming("result", ret), L.defaultFraming("matchday", ret));
});

test("framingLayout: result shares the Match Day framing, other layouts are their own", () => {
  assert.equal(L.framingLayout("result"), "matchday");
  assert.equal(L.framingLayout("matchday"), "matchday");
  assert.equal(L.framingLayout("groupe"), "groupe");
  assert.equal(L.framingLayout("podium_dos"), "podium_dos");
});

test("savedFraming: Résultat reads the framing saved for Match Day", () => {
  const rows = [{ photo_id: 1, layout: "matchday", x: 5, y: 6, width: 700 }, { photo_id: 1, layout: "groupe", x: 1, y: 2, width: 3 }];
  assert.deepEqual(L.savedFraming(rows, 1, "result"), rows[0]);
  assert.deepEqual(L.savedFraming(rows, 1, "groupe"), rows[1]);
  assert.equal(L.savedFraming(rows, 2, "matchday"), null);
});

// ---------- Publication schedule: sections, Paris time, last / next post ----------
const NOW = new Date("2026-10-06T10:00:00Z"); // Tuesday 12:00 in Paris (CEST)

test("parisToDate converts a Paris wall-clock time to the right instant (summer and winter)", () => {
  assert.equal(L.parisToDate(2026, 7, 14, 9, 30).toISOString(), "2026-07-14T07:30:00.000Z");
  assert.equal(L.parisToDate(2026, 12, 14, 9, 30).toISOString(), "2026-12-14T08:30:00.000Z");
  assert.equal(L.parisToDate(2026, 10, 25, 12, 0).toISOString(), "2026-10-25T11:00:00.000Z"); // DST ended that morning
});

test("parisParts reads weekday and wall clock in Paris", () => {
  assert.deepEqual(L.parisParts(NOW), { y: 2026, m: 10, d: 6, hh: 12, mm: 0, wd: 2 });
  assert.equal(L.parisParts(new Date("2026-10-06T22:30:00Z")).d, 7); // already past midnight in Paris
});

test("isoWeekKey follows Paris ISO weeks", () => {
  assert.equal(L.isoWeekKey(new Date("2026-10-06T10:00:00Z")), "2026-W41");
  assert.equal(L.isoWeekKey(new Date("2026-01-01T10:00:00Z")), "2026-W01");
  assert.equal(L.isoWeekKey(new Date("2027-01-03T10:00:00Z")), "2026-W53");
});

test("defaultSettings: every section starts manual", () => {
  const s = L.defaultSettings();
  assert.deepEqual(Object.keys(s).sort(), ["groupe", "matchday", "rankings", "ratings", "result"]);
  for (const k of Object.keys(s)) assert.equal(s[k].mode, "manual");
});

test("normalizeSettings keeps valid values and falls back to defaults for junk", () => {
  const s = L.normalizeSettings({ matchday: { mode: "auto", rule: { type: "before_match", days: 1, time: "18:30" } }, groupe: { mode: "yolo", rule: { type: "nope" } }, rankings: { mode: "auto", rule: { type: "weekly", weekday: 9, time: "99:99" } }, extra: 1 });
  assert.deepEqual(s.matchday, { mode: "auto", rule: { type: "before_match", days: 1, time: "18:30" } });
  assert.equal(s.groupe.mode, "manual");
  assert.equal(s.groupe.rule.type, "before_match");
  assert.equal(s.rankings.mode, "auto");
  assert.deepEqual(s.rankings.rule, L.defaultSettings().rankings.rule);
  assert.equal(s.extra, undefined);
  assert.deepEqual(L.normalizeSettings(null), L.defaultSettings());
});

const M = (id, iso, status, extra = {}) => ({ id, opponent_name: `Adv${id}`, match_datetime: iso, status, ...extra });
const auto = (section, rule) => ({ ...L.defaultSettings(), [section]: { mode: "auto", rule } });

test("matchday next: nearest scheduled match; due once the slot has passed and the match has not started", () => {
  const matches = [M(1, "2026-10-01T17:30:00Z", "finished"), M(2, "2026-10-08T17:30:00Z", "scheduled"), M(3, "2026-10-15T17:30:00Z", "scheduled")];
  const rule = { type: "before_match", days: 0, time: "09:00" };
  let t = L.sectionState("matchday", { matches, lineups: [], posts: [], settings: auto("matchday", rule), now: NOW });
  assert.equal(t.next.matchId, 2);
  assert.equal(t.next.scheduledAt.toISOString(), "2026-10-08T07:00:00.000Z");
  assert.equal(t.next.due, false);
  t = L.sectionState("matchday", { matches, lineups: [], posts: [], settings: auto("matchday", rule), now: new Date("2026-10-08T07:05:00Z") });
  assert.equal(t.next.due, true);
  t = L.sectionState("matchday", { matches, lineups: [], posts: [], settings: auto("matchday", rule), now: new Date("2026-10-08T17:31:00Z") });
  assert.equal(t.next.matchId, 3); // match 2 has kicked off: its Match Day post expired
});

test("matchday 'days before' counts Paris calendar days", () => {
  const matches = [M(2, "2026-10-08T17:30:00Z", "scheduled")];
  const t = L.sectionState("matchday", { matches, lineups: [], posts: [], settings: auto("matchday", { type: "before_match", days: 1, time: "18:30" }), now: NOW });
  assert.equal(t.next.scheduledAt.toISOString(), "2026-10-07T16:30:00.000Z");
});

test("groupe needs a sheet: not available (never due) until at least one player is on it", () => {
  const matches = [M(2, "2026-10-08T17:30:00Z", "scheduled")];
  const rule = { type: "before_match", days: 0, time: "09:00" };
  const base = { matches, posts: [], settings: auto("groupe", rule), now: new Date("2026-10-08T08:00:00Z") };
  let t = L.sectionState("groupe", { ...base, lineups: [] });
  assert.equal(t.next.available, false);
  assert.equal(t.next.due, false);
  assert.match(t.next.waitingFor, /feuille de match/i);
  t = L.sectionState("groupe", { ...base, lineups: [{ match_id: 2, player_id: 7 }] });
  assert.equal(t.next.available, true);
  assert.equal(t.next.due, true);
});

test("manual mode is never due, even when available", () => {
  const matches = [M(2, "2026-10-08T17:30:00Z", "scheduled")];
  const t = L.sectionState("matchday", { matches, lineups: [], posts: [], settings: L.defaultSettings(), now: new Date("2026-10-08T08:00:00Z") });
  assert.equal(t.next.available, true);
  assert.equal(t.next.due, false);
  assert.equal(t.next.scheduledAt, null);
});

test("result: due after the slot on a finished match, with a 7-day window; waits for the match to finish", () => {
  const rule = { type: "after_match", days: 0, time: "22:00" };
  const live = [M(5, "2026-10-06T08:00:00Z", "live")];
  let t = L.sectionState("result", { matches: live, lineups: [], posts: [], settings: auto("result", rule), now: NOW });
  assert.equal(t.next.matchId, 5);
  assert.equal(t.next.available, false);
  assert.match(t.next.waitingFor, /terminé/i);
  const done = [M(5, "2026-10-06T08:00:00Z", "finished")];
  t = L.sectionState("result", { matches: done, lineups: [], posts: [], settings: auto("result", rule), now: NOW });
  assert.equal(t.next.due, false); // slot is 22:00 Paris
  t = L.sectionState("result", { matches: done, lineups: [], posts: [], settings: auto("result", rule), now: new Date("2026-10-06T20:30:00Z") });
  assert.equal(t.next.due, true);
  t = L.sectionState("result", { matches: done, lineups: [], posts: [], settings: auto("result", rule), now: new Date("2026-10-20T20:30:00Z") });
  assert.equal(t.next, null); // older than 7 days: not pushed automatically
});

test("ratings need validated notes", () => {
  const rule = { type: "after_match", days: 2, time: "12:00" };
  const base = { lineups: [], posts: [], settings: auto("ratings", rule), now: new Date("2026-10-10T12:30:00Z") };
  let t = L.sectionState("ratings", { ...base, matches: [M(5, "2026-10-08T08:00:00Z", "finished")] });
  assert.equal(t.next.available, false);
  assert.match(t.next.waitingFor, /notes/i);
  t = L.sectionState("ratings", { ...base, matches: [M(5, "2026-10-08T08:00:00Z", "finished", { ratings_validated_at: "2026-10-09T10:00:00Z" })] });
  assert.equal(t.next.due, true);
});

test("a published post is the 'last', is excluded from 'next', and keeps its link", () => {
  const matches = [M(2, "2026-10-08T17:30:00Z", "scheduled"), M(3, "2026-10-15T17:30:00Z", "scheduled")];
  const posts = [{ id: 1, kind: "matchday", match_id: 2, status: "published", published_at: "2026-10-08T07:00:10Z", permalink: "https://instagram.com/p/x", image_paths: ["a.jpg"] }];
  const t = L.sectionState("matchday", { matches, lineups: [], posts, settings: auto("matchday", { type: "before_match", days: 0, time: "09:00" }), now: new Date("2026-10-08T08:00:00Z") });
  assert.equal(t.last.published, true);
  assert.equal(t.last.post.permalink, "https://instagram.com/p/x");
  assert.equal(t.next.matchId, 3);
});

test("failed or publishing rows do not count as published", () => {
  const matches = [M(2, "2026-10-08T17:30:00Z", "scheduled")];
  const posts = [{ id: 1, kind: "matchday", match_id: 2, status: "failed", error: "boom" }];
  const t = L.sectionState("matchday", { matches, lineups: [], posts, settings: L.defaultSettings(), now: NOW });
  assert.equal(t.next.matchId, 2);
  assert.equal(t.next.failures, 1);
});

test("without any published post, 'last' falls back to the latest available match", () => {
  const matches = [M(1, "2026-09-24T17:30:00Z", "finished"), M(2, "2026-10-01T17:30:00Z", "finished"), M(3, "2026-10-15T17:30:00Z", "scheduled")];
  const t = L.sectionState("result", { matches, lineups: [], posts: [], settings: L.defaultSettings(), now: NOW });
  assert.equal(t.last.published, false);
  assert.equal(t.last.matchId, 2);
});

test("rankings: weekly slot, due within 24h after it, one per ISO week", () => {
  const matches = [M(1, "2026-10-01T17:30:00Z", "finished")];
  const rule = { type: "weekly", weekday: 2, time: "18:00" }; // Tuesday
  const mk = (now, posts = []) => L.sectionState("rankings", { matches, lineups: [], posts, settings: auto("rankings", rule), now });
  let t = mk(NOW); // Tuesday 12:00 Paris: slot is at 18:00
  assert.equal(t.next.scheduledAt.toISOString(), "2026-10-06T16:00:00.000Z");
  assert.equal(t.next.due, false);
  assert.equal(t.next.weekKey, "2026-W41");
  t = mk(new Date("2026-10-06T16:10:00Z"));
  assert.equal(t.next.due, true);
  t = mk(new Date("2026-10-06T16:10:00Z"), [{ kind: "rankings", week_key: "2026-W41", status: "published", published_at: "2026-10-06T16:01:00Z" }]);
  assert.equal(t.next.weekKey, "2026-W42");
  assert.equal(t.next.due, false);
  assert.equal(t.last.published, true);
  t = mk(new Date("2026-10-08T10:00:00Z")); // Thursday: slot missed by more than 24h → wait for next Tuesday
  assert.equal(t.next.weekKey, "2026-W42");
});

test("rankings are not available before any finished match", () => {
  const t = L.sectionState("rankings", { matches: [M(2, "2026-10-08T17:30:00Z", "scheduled")], lineups: [], posts: [], settings: auto("rankings", { type: "weekly", weekday: 2, time: "18:00" }), now: NOW });
  assert.equal(t.next.available, false);
});

test("targetKey identifies a post uniquely", () => {
  assert.equal(L.targetKey({ kind: "matchday", matchId: 2 }), "matchday:match:2");
  assert.equal(L.targetKey({ kind: "rankings", weekKey: "2026-W41" }), "rankings:week:2026-W41");
});

// ---------- Captions context shared by the app and the server ----------
const PL = [{ id: 1, name: "Louis", display_name: "Louis" }, { id: 2, name: "Nolan", display_name: "Nolan" }, { id: 3, name: "Solal", display_name: "Solal" }];
const CM = [{ id: 1, opponent_name: "FC Test", match_datetime: "2026-10-08T15:30:00Z", status: "finished", stadium_name: "Stade Y", city: "Paris" }];
const CL = [1, 2, 3].map((p) => ({ match_id: 1, player_id: p }));
const CE = [{ match_id: 1, type: "goal_bl", half: 1, minute: 12, player_id: 1, assist_player_id: 2 }, { match_id: 1, type: "goal_opponent", half: 1, minute: 30 }];
const CR = [{ match_id: 1, rater_id: 1, ratee_id: 2, score: 8 }, { match_id: 1, rater_id: 3, ratee_id: 2, score: 7 }, { match_id: 1, rater_id: 2, ratee_id: 1, score: 6 }];
const CD = { matches: CM, lineups: CL, events: CE, ratings: CR, players: PL, roster: [{ player_id: 1, jersey_number: "14" }] };

test("captionContextFor builds each caption's inputs from raw data", () => {
  assert.deepEqual(L.captionContextFor("matchday", { matchId: 1 }, CD), { opponent: "FC Test", band: L.matchBand(CM[0]) });
  const r = L.captionContextFor("result", { matchId: 1 }, CD);
  assert.deepEqual([r.opponent, r.bl, r.opp, r.goals], ["FC Test", 1, 1, ["12' Louis (Nolan)"]]);
  assert.deepEqual(L.captionContextFor("ratings", { matchId: 1 }, CD).top, [{ name: "Nolan", rating: 7.5 }, { name: "Louis", rating: 6 }]);
  assert.deepEqual(L.captionContextFor("rankings", { season: "2026-2027" }, CD), { season: "2026-2027" });
  assert.deepEqual(L.captionContextFor("groupe", { matchId: 1 }, CD).names, ["Louis", "Nolan", "Solal"]);
});

test("captionFor groupe lists the players", () => {
  const c = L.captionFor("groupe", { opponent: "FC Test", names: ["Louis", "Nolan"] });
  assert.match(c, /FC Test/);
  assert.match(c, /Louis · Nolan/);
});

test("isTargetAvailable mirrors the section rules", () => {
  const fin = { id: 1, status: "finished" }, sch = { id: 2, status: "scheduled" };
  assert.equal(L.isTargetAvailable("matchday", sch, []).ok, true);
  assert.equal(L.isTargetAvailable("groupe", sch, []).ok, false);
  assert.equal(L.isTargetAvailable("groupe", sch, [{ match_id: 2, player_id: 1 }]).ok, true);
  assert.equal(L.isTargetAvailable("result", sch, []).ok, false);
  assert.equal(L.isTargetAvailable("result", fin, []).ok, true);
  assert.equal(L.isTargetAvailable("ratings", fin, []).ok, false);
  assert.equal(L.isTargetAvailable("ratings", { ...fin, ratings_validated_at: "x" }, []).ok, true);
});

// ---------- Activation date: switching to automatic never posts the past ----------
test("normalizeSettings keeps a valid activation date and drops junk", () => {
  const ok = L.normalizeSettings({ matchday: { mode: "auto", since: "2026-10-08T07:00:00.000Z", rule: { type: "before_match", days: 0, time: "09:00" } } });
  assert.equal(ok.matchday.since, "2026-10-08T07:00:00.000Z");
  assert.equal(L.normalizeSettings({ matchday: { mode: "auto", since: "not a date" } }).matchday.since, undefined);
  assert.equal(L.normalizeSettings({ matchday: { mode: "manual", since: "2026-10-08T07:00:00.000Z" } }).matchday.since, undefined);
});

test("auto: a slot that passed before the activation is skipped (matchday)", () => {
  const matches = [M(2, "2026-10-08T17:30:00Z", "scheduled"), M(3, "2026-10-15T17:30:00Z", "scheduled")];
  const settings = { ...L.defaultSettings(), matchday: { mode: "auto", since: "2026-10-08T08:00:00.000Z", rule: { type: "before_match", days: 0, time: "09:00" } } };
  // match 2's slot (09:00 Paris = 07:00Z) was before the activation (08:00Z): the next automatic one is match 3
  const t = L.sectionState("matchday", { matches, lineups: [], posts: [], settings, now: new Date("2026-10-08T08:30:00Z") });
  assert.equal(t.next.matchId, 3);
  assert.equal(t.next.due, false);
});

test("auto: an old unpublished result is not posted when automatic mode is switched on", () => {
  const matches = [M(1, "2026-10-01T15:30:00Z", "finished"), M(5, "2026-10-08T08:00:00Z", "finished")];
  const settings = { ...L.defaultSettings(), result: { mode: "auto", since: "2026-10-08T07:00:00.000Z", rule: { type: "after_match", days: 0, time: "22:00" } } };
  const t = L.sectionState("result", { matches, lineups: [], posts: [], settings, now: new Date("2026-10-08T21:00:00Z") });
  assert.equal(t.next.matchId, 5); // match 1's slot (Oct 1) predates the activation
  const later = L.sectionState("result", { matches, lineups: [], posts: [], settings, now: new Date("2026-10-08T20:30:00Z") });
  assert.equal(later.next.due, true);
});

test("auto: a weekly slot before the activation is not posted late", () => {
  const matches = [M(1, "2026-10-01T17:30:00Z", "finished")];
  const settings = { ...L.defaultSettings(), rankings: { mode: "auto", since: "2026-10-06T16:05:00.000Z", rule: { type: "weekly", weekday: 2, time: "18:00" } } };
  const t = L.sectionState("rankings", { matches, lineups: [], posts: [], settings, now: new Date("2026-10-06T16:10:00Z") }); // slot 16:00Z passed 5 min before activation
  assert.equal(t.next.weekKey, "2026-W42");
  assert.equal(t.next.due, false);
});

test("manual mode ignores the activation date", () => {
  const matches = [M(1, "2026-10-01T15:30:00Z", "finished")];
  const settings = { ...L.defaultSettings(), result: { mode: "manual", rule: { type: "after_match", days: 0, time: "22:00" } } };
  assert.equal(L.sectionState("result", { matches, lineups: [], posts: [], settings, now: new Date("2026-10-03T10:00:00Z") }).next.matchId, 1);
});

// ---------- Featured player pool: the sheet first, then the roster ----------
test("featuredPool: sheet players with a photo come first", () => {
  const has = (id) => [1, 2, 9].includes(id);
  assert.deepEqual(L.featuredPool([1, 2, 3], [{ player_id: 9, role: "regulier" }], has), [1, 2]);
});

test("featuredPool: no sheet → regular and occasional roster players with a photo, never guests", () => {
  const roster = [{ player_id: 1, role: "regulier" }, { player_id: 2, role: "occasionnel" }, { player_id: 3, role: "invite" }, { player_id: 4, role: "regulier" }];
  const has = (id) => id !== 4;
  assert.deepEqual(L.featuredPool([], roster, has), [1, 2]);
});

test("featuredPool: nobody on the sheet has a photo → fall back to the roster; nobody anywhere → empty", () => {
  const roster = [{ player_id: 5, role: "regulier" }];
  assert.deepEqual(L.featuredPool([1, 2], roster, (id) => id === 5), [5]);
  assert.deepEqual(L.featuredPool([], roster, () => false), []);
});

test("zoom can reach 500% (and beyond via wheel up to 800%) of the reference width", () => {
  const f = { x: 0, y: 0, width: 400 };
  assert.equal(L.zoomFramingAt(f, 5, 0, 0, 400).width, 2000);
  assert.equal(L.framingZoomPercent(L.zoomFramingAt(f, 5, 0, 0, 400), 400), 500);
});
