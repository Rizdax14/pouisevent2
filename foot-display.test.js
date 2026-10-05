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
