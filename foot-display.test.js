// Display rules of the football app (dates, results, featured match, initials).
const test = require("node:test");
const assert = require("node:assert/strict");
const D = require("./foot-display.js");

test("footRelative counts Paris calendar days, not 24h blocks", () => {
  const now = new Date("2026-10-06T10:00:00Z").getTime(); // Tue 12:00 Paris
  assert.equal(D.footRelative("2026-10-06T21:30:00Z", now), "Aujourd'hui");
  assert.equal(D.footRelative("2026-10-06T23:30:00Z", now), "Demain"); // already Wed 01:30 in Paris
  assert.equal(D.footRelative("2026-10-07T17:00:00Z", now), "Demain");
  assert.equal(D.footRelative("2026-10-10T17:00:00Z", now), "Dans 4 jours");
  assert.equal(D.footRelative("2026-10-05T17:00:00Z", now), "Hier");
  assert.equal(D.footRelative("2026-10-03T17:00:00Z", now), "Il y a 3 jours");
});

test("footOutcome: V / N / D from the goals", () => {
  assert.equal(D.footOutcome({ bl: 3, opponent: 1 }), "V");
  assert.equal(D.footOutcome({ bl: 2, opponent: 2 }), "N");
  assert.equal(D.footOutcome({ bl: 0, opponent: 1 }), "D");
});

test("footFeaturedMatch: the live match first, otherwise the nearest one to come", () => {
  const M = (id, iso, status) => ({ id, match_datetime: iso, status });
  const list = [M(1, "2026-10-01T10:00:00Z", "finished"), M(3, "2026-10-20T10:00:00Z", "scheduled"), M(2, "2026-10-10T10:00:00Z", "scheduled")];
  assert.equal(D.footFeaturedMatch(list).id, 2);
  assert.equal(D.footFeaturedMatch([...list, M(9, "2026-10-06T10:00:00Z", "live")]).id, 9);
  assert.equal(D.footFeaturedMatch([list[0]]), null);
  assert.equal(D.footFeaturedMatch([]), null);
});

test("playerInitials", () => {
  assert.equal(D.playerInitials("Louis Mar"), "LM");
  assert.equal(D.playerInitials("Maxime M"), "MM");
  assert.equal(D.playerInitials("Juju"), "J");
  assert.equal(D.playerInitials(""), "?");
  assert.equal(D.playerInitials(undefined), "?");
});

test("meetingIsoFor puts the meeting time on the match's Paris day (evening before if after kick-off)", () => {
  const kick = "2026-10-08T17:30:00Z"; // Thu 19:30 Paris
  assert.equal(D.meetingIsoFor(kick, "18:30"), "2026-10-08T16:30:00.000Z");
  assert.equal(D.meetingIsoFor(kick, ""), null);
  assert.equal(D.meetingIsoFor(kick, "25:00"), null);
  assert.equal(D.meetingIsoFor("2026-10-08T22:30:00Z", "23:30"), "2026-10-08T21:30:00.000Z"); // kick-off Fri 00:30 Paris → RDV Thu 23:30
  assert.equal(D.meetingTimeValue("2026-10-08T16:30:00.000Z"), "18:30");
  assert.equal(D.meetingTimeValue(null), "");
});

test("mapLinks builds Waze, Plans and Google Maps links from the match address", () => {
  const l = D.mapLinks({ stadium_name: "L'Etivaliere", address: "Rue X", postal_code: "42000", city: "Saint-Etienne" });
  const q = encodeURIComponent("L'Etivaliere, Rue X, 42000 Saint-Etienne");
  assert.equal(l.waze, `https://waze.com/ul?q=${q}&navigate=yes`);
  assert.equal(l.plans, `https://maps.apple.com/?q=${q}`);
  assert.equal(l.google, `https://www.google.com/maps/search/?api=1&query=${q}`);
  assert.equal(D.mapLinks({ city: "" }), null);
});

// ---- club room ----
test("rackSquad: regular and occasional players, alphabetical", () => {
  const roster = [
    { player_id: 1, jersey_number: "14", role: "regulier" }, { player_id: 2, jersey_number: "02", role: "occasionnel" },
    { player_id: 3, jersey_number: null, role: "regulier" }, { player_id: 4, jersey_number: "7", role: "ancien" }, { player_id: 5, jersey_number: "100", role: "regulier" },
  ];
  const names = { 1: "Louis", 2: "Nolan", 3: "Zed", 5: "Timo" };
  assert.deepEqual(D.rackSquad(roster, (id) => names[id]).map((p) => [p.id, p.num]), [[1, "14"], [2, "02"], [5, "100"], [3, ""]]);
});

test("upcomingMatches: the live match first, then scheduled ones soonest first", () => {
  const ms = [
    { id: 1, status: "scheduled", match_datetime: "2026-11-05T18:00:00Z" }, { id: 2, status: "finished", match_datetime: "2026-10-01T18:00:00Z" },
    { id: 3, status: "scheduled", match_datetime: "2026-10-20T18:00:00Z" }, { id: 4, status: "live", match_datetime: "2026-10-07T18:00:00Z" },
  ];
  assert.deepEqual(D.upcomingMatches(ms, 3).map((m) => m.id), [4, 3, 1]);
});

test("calendarMonth: Monday-first grid by Paris day, score and tone for played matches, hour for the others", () => {
  const ms = [
    { id: 1, status: "finished", match_datetime: "2026-10-01T17:00:00Z", opponent_name: "FC Montreuil Rouge" },
    { id: 2, status: "scheduled", match_datetime: "2026-10-31T23:30:00Z", opponent_name: "Les Lilas" }, // Nov 1st 00:30 in Paris
    { id: 3, status: "scheduled", match_datetime: "2026-10-15T17:30:00Z", opponent_name: "Bagnolet" },
  ];
  const cal = D.calendarMonth(ms, () => ({ bl: 3, opponent: 1 }), 2026, 10, new Date("2026-10-07T10:00:00Z").getTime());
  assert.equal(cal.title, "Octobre 2026");
  assert.equal(cal.offset, 3); // Oct 1st 2026 is a Thursday
  assert.equal(cal.length, 31);
  assert.equal(cal.today, 7);
  assert.deepEqual(cal.days[1], { id: 1, top: "Montreu.", bottom: "3-1", tone: "win", rating: null });
  assert.deepEqual(cal.days[15], { id: 3, top: "Bagnolet", bottom: "19h30", tone: null, rating: null });
  const rated = D.calendarMonth(ms, () => ({ bl: 3, opponent: 1 }), 2026, 10, 0, (m) => (m.id === 1 ? 6.4 : m.id === 3 ? 9 : null));
  assert.equal(rated.days[1].rating, 6.4);
  assert.equal(rated.days[15].rating, null); // not played yet: no rating shown
  assert.equal(cal.days[31], undefined); // belongs to November in Paris
});

test("a match whose score was never found shows ?-? and no result", () => {
  const ms = [{ id: 4, status: "finished", score_unknown: true, match_datetime: "2025-07-10T17:30:00Z", opponent_name: "Patronage Saint Joseph" }];
  const cal = D.calendarMonth(ms, () => ({ bl: 0, opponent: 0 }), 2025, 7, 0, () => 7);
  assert.deepEqual(cal.days[10], { id: 4, top: "Patrona.", bottom: "?-?", tone: null, rating: 7 });
  const row = D.monthMatches(ms, () => ({ bl: 0, opponent: 0 }), 2025 * 12 + 6).rows[0];
  assert.equal(row.score, "? - ?");
  assert.equal(row.result, null);
  assert.equal(row.hour, null);
});

test("calendarBounds spans the first match to the last one, today included", () => {
  const ms = [{ match_datetime: "2025-09-10T17:00:00Z" }, { match_datetime: "2026-12-10T17:00:00Z" }];
  const b = D.calendarBounds(ms, new Date("2026-10-07T10:00:00Z").getTime());
  assert.equal(b.min, 2025 * 12 + 8);
  assert.equal(b.max, 2026 * 12 + 11);
});

test("shirtStats: win rate, per-match numbers, best and worst rated match, career", () => {
  const series = [{ matchId: 1, opponent: "A", rating: 6 }, { matchId: 2, opponent: "B", rating: 7.25 }, { matchId: 3, opponent: "C", rating: 5 }, { matchId: 4, opponent: "D", rating: 8 }];
  const st = D.shirtStats({
    row: { played: 3, wins: 1, draws: 1, losses: 1, goals: 4, assists: 2, decisive: 6, motm: 1 },
    careerRow: { played: 10, goals: 9, assists: 4, decisive: 13, motm: 2 }, series, careerSeries: [...series, { matchId: 9, opponent: "E", rating: 4 }],
  });
  assert.equal(st.winPct, 33);
  assert.equal(st.goalsPerMatch, 1.33);
  assert.equal(st.assistsPerMatch, 0.67);
  assert.equal(st.decisivePerMatch, 2);
  assert.deepEqual(st.best, { rating: 8, opponent: "D", matchId: 4, date: undefined });
  assert.equal(st.worst.opponent, "C");
  assert.equal(st.rating, 6.6);
  assert.deepEqual(st.career, { played: 10, goals: 9, assists: 4, decisive: 13, motm: 2, rating: 6.1 });
  assert.equal(D.shirtStats({ row: null, careerRow: null, series: [] }).best, null);
});

test("monthMatches: the month's matches with score, result, hour or my rating", () => {
  const ms = [
    { id: 1, status: "finished", match_datetime: "2026-09-03T17:30:00Z", opponent_name: "En Avant Guinguette" },
    { id: 2, status: "scheduled", match_datetime: "2026-09-24T17:00:00Z", opponent_name: "Bagnolet" },
    { id: 3, status: "finished", match_datetime: "2026-10-01T17:00:00Z", opponent_name: "Autre" },
  ];
  assert.deepEqual(D.matchMonths(ms), [2026 * 12 + 8, 2026 * 12 + 9]);
  const sept = D.monthMatches(ms, () => ({ bl: 7, opponent: 3 }), 2026 * 12 + 8, (m) => (m.id === 1 ? 6.5 : null));
  assert.equal(sept.title, "Septembre 2026");
  assert.deepEqual(sept.rows.map((r) => [r.id, r.wd, r.day, r.score, r.result, r.hour, r.rating]), [
    [1, "jeu.", 3, "7 - 3", "V", null, 6.5],
    [2, "jeu.", 24, null, null, "19h", null],
  ]);
});

test("seasonKits: the kits of each season, the current ones for today", () => {
  assert.deepEqual(D.seasonKits("2024-2025", "2026-2027"), ["h2425"]);
  assert.deepEqual(D.seasonKits("2025-2026", "2026-2027"), ["h2526", "a2526"]);
  assert.deepEqual(D.seasonKits("2026-2027", "2026-2027"), ["home", "away"]);
  assert.equal(D.shortSeason("2025-2026"), "25-26");
});
