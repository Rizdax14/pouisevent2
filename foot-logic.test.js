// foot-logic.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  computeFootScore,
  computeAttendanceBuckets,
  computeHalfElapsedSeconds,
  buildEventTimeline,
  nextHalfState,
  canConfirmGoal,
  nextLiveAction,
  assertUpsertOk,
  filterPlayersByName,
  toDatetimeLocalValue,
  buildEventPayload,
  computePlayerStats,
  statValue,
  rankPlayers,
  formatRank,
  formatStatValue,
  missingLineupPlayers,
  diffLineup,
  diffLineupEdit,
  saveGoalWithSheet,
  seasonOf,
  seasonsFromMatches,
  filterMatchesForStats,
  ratingProgress,
  matchAverages,
  playerRatingSeries,
  averageRating,
  buildRatingPayload,
  statsRoster,
  buildStatsRows,
  sortStatsRows,
  submitRatings,
  ratingsTabView,
} = require("./foot-logic.js");

test("computeFootScore counts goal_bl and goal_opponent separately", () => {
  const events = [{ type: "goal_bl" }, { type: "goal_bl" }, { type: "goal_opponent" }];
  assert.deepEqual(computeFootScore(events), { bl: 2, opponent: 1 });
});

test("computeFootScore returns zeros for no events", () => {
  assert.deepEqual(computeFootScore([]), { bl: 0, opponent: 0 });
});

test("computeAttendanceBuckets sorts roster into present/absent/noResponse", () => {
  const roster = [{ player_id: 1 }, { player_id: 2 }, { player_id: 3 }];
  const attendance = [
    { player_id: 1, status: "present" },
    { player_id: 2, status: "absent" },
  ];
  assert.deepEqual(computeAttendanceBuckets(roster, attendance), {
    present: [1],
    absent: [2],
    noResponse: [3],
  });
});

test("computeAttendanceBuckets handles an empty roster", () => {
  assert.deepEqual(computeAttendanceBuckets([], []), { present: [], absent: [], noResponse: [] });
});

test("computeHalfElapsedSeconds returns the stored value when paused", () => {
  assert.equal(computeHalfElapsedSeconds(null, 120, Date.now()), 120);
});

test("computeHalfElapsedSeconds adds running time when the half is active", () => {
  const startedAt = new Date(Date.now() - 30000).toISOString(); // 30s ago
  const result = computeHalfElapsedSeconds(startedAt, 60, Date.now());
  assert.ok(result >= 89 && result <= 91, `expected ~90, got ${result}`);
});

test("buildEventTimeline sorts by half then minute", () => {
  const events = [
    { id: 3, half: 2, minute: 5 },
    { id: 1, half: 1, minute: 20 },
    { id: 2, half: 1, minute: 3 },
  ];
  assert.deepEqual(buildEventTimeline(events).map((e) => e.id), [2, 1, 3]);
});

test("nextHalfState advances to the next half when more remain", () => {
  assert.deepEqual(nextHalfState(1, 3), { type: "next", half: 2 });
});

test("nextHalfState signals finish on the last half", () => {
  assert.deepEqual(nextHalfState(3, 3), { type: "finish" });
});

test("nextHalfState signals finish even if currentHalf somehow exceeds nbHalves", () => {
  assert.deepEqual(nextHalfState(4, 3), { type: "finish" });
});

test("canConfirmGoal is false with no player selected", () => {
  assert.equal(canConfirmGoal("", false), false);
});

test("canConfirmGoal is false while a request is already in flight (double-click guard)", () => {
  assert.equal(canConfirmGoal("12", true), false);
});

test("canConfirmGoal is true with a player selected and no request in flight", () => {
  assert.equal(canConfirmGoal("12", false), true);
});

test("nextLiveAction is 'start' when the half hasn't started and isn't the finished last half", () => {
  assert.equal(nextLiveAction(false, false, 0), "start");
});

test("nextLiveAction is 'playing' while the half is running, even on the last half", () => {
  assert.equal(nextLiveAction(true, true, 0), "playing");
});

test("nextLiveAction is 'close' once the last half has been played and stopped", () => {
  assert.equal(nextLiveAction(false, true, 900), "close");
});

test("nextLiveAction never returns both 'start' and 'close' for the same paused-last-half state", () => {
  // Regression: the old UI rendered both the \"Démarrer\" and \"Clôturer\" buttons at once here.
  const action = nextLiveAction(false, true, 900);
  assert.notEqual(action, "start");
});

test("assertUpsertOk does nothing when there is no error", () => {
  assert.doesNotThrow(() => assertUpsertOk({ data: [{ id: 1 }], error: null }));
});

test("assertUpsertOk throws when supabase-js returns an error object (it never rejects the promise)", () => {
  assert.throws(() => assertUpsertOk({ data: null, error: { message: "permission denied" } }), /permission denied/);
});

const SAMPLE_PLAYERS = [
  { id: 1, name: "Quentin" },
  { id: 2, name: "Ferdi" },
  { id: 3, name: "Élodie" },
];
const nameOf = (p) => p.name;

test("filterPlayersByName returns everyone for an empty or blank query", () => {
  assert.deepEqual(filterPlayersByName(SAMPLE_PLAYERS, "", nameOf).map((p) => p.id), [1, 2, 3]);
  assert.deepEqual(filterPlayersByName(SAMPLE_PLAYERS, "   ", nameOf).map((p) => p.id), [1, 2, 3]);
});

test("filterPlayersByName matches a case-insensitive substring", () => {
  assert.deepEqual(filterPlayersByName(SAMPLE_PLAYERS, "fER", nameOf).map((p) => p.id), [2]);
});

test("filterPlayersByName ignores accents so 'elo' finds 'Élodie'", () => {
  assert.deepEqual(filterPlayersByName(SAMPLE_PLAYERS, "elo", nameOf).map((p) => p.id), [3]);
});

test("toDatetimeLocalValue renders an ISO timestamp as a local datetime-local input value", () => {
  const d = new Date(2026, 10, 15, 19, 5); // 15 Nov 2026, 19:05 local time
  assert.equal(toDatetimeLocalValue(d.toISOString()), "2026-11-15T19:05");
});

test("toDatetimeLocalValue returns an empty string for a missing value", () => {
  assert.equal(toDatetimeLocalValue(null), "");
});

test("buildEventPayload keeps scorer and assist for a BL goal", () => {
  assert.deepEqual(
    buildEventPayload({ type: "goal_bl", half: "2", minute: "17", playerId: "4", assistId: "9" }),
    { type: "goal_bl", half: 2, minute: 17, player_id: 4, assist_player_id: 9, own_goal: false }
  );
});

test("buildEventPayload: CSC is a goal for us with no scorer and no assist", () => {
  assert.deepEqual(
    buildEventPayload({ type: "goal_bl", half: "1", minute: "9", playerId: "csc", assistId: "4" }),
    { type: "goal_bl", half: 1, minute: 9, player_id: null, assist_player_id: null, own_goal: true }
  );
});

test("buildEventPayload clears scorer and assist for an opponent goal", () => {
  assert.deepEqual(
    buildEventPayload({ type: "goal_opponent", half: "1", minute: "3", playerId: "4", assistId: "9" }),
    { type: "goal_opponent", half: 1, minute: 3, player_id: null, assist_player_id: null, own_goal: false }
  );
});

test("buildEventPayload rejects a BL goal without a scorer", () => {
  assert.throws(() => buildEventPayload({ type: "goal_bl", half: "1", minute: "3", playerId: "", assistId: "" }), /buteur/i);
});

test("buildEventPayload rejects an assist by the scorer themself", () => {
  assert.throws(() => buildEventPayload({ type: "goal_bl", half: "1", minute: "3", playerId: "4", assistId: "4" }), /passe/i);
});

test("buildEventPayload rejects a half below 1 or a negative minute", () => {
  assert.throws(() => buildEventPayload({ type: "goal_opponent", half: "0", minute: "3" }), /mi-temps/i);
  assert.throws(() => buildEventPayload({ type: "goal_opponent", half: "1", minute: "-1" }), /minute/i);
});

const M = (id, status) => ({ id, status });
let evSeq = 1000;
const G = (match_id, player_id, assist_player_id = null) => ({ id: evSeq++, match_id, type: "goal_bl", player_id, assist_player_id, half: 1, minute: 0 });
const O = (match_id) => ({ id: evSeq++, match_id, type: "goal_opponent", player_id: null, assist_player_id: null, half: 1, minute: 0 });
const L = (match_id, player_id) => ({ match_id, player_id });
const byId = (list) => Object.fromEntries(list.map((s) => [s.playerId, s]));

test("computePlayerStats counts W/D/L from finished matches on the sheet only", () => {
  const matches = [M(1, "finished"), M(2, "finished"), M(3, "finished"), M(4, "live")];
  const lineups = [L(1, 10), L(2, 10), L(3, 10), L(4, 10), L(1, 20)];
  const events = [G(1, 10), O(2), O(4)]; // m1 win 1-0, m2 loss 0-1, m3 draw 0-0, m4 ignored (live)
  const s = byId(computePlayerStats(matches, lineups, events));
  assert.deepEqual(s[10], { playerId: 10, played: 3, wins: 1, draws: 1, losses: 1, goals: 1, assists: 0, decisive: 1 });
  assert.deepEqual(s[20], { playerId: 20, played: 1, wins: 1, draws: 0, losses: 0, goals: 0, assists: 0, decisive: 0 });
});

test("computePlayerStats only counts goals/assists for matches where the player is on the sheet", () => {
  const s = byId(computePlayerStats([M(1, "finished")], [L(1, 10)], [G(1, 10, 30), G(1, 30)]));
  assert.equal(s[10].goals, 1);
  assert.equal(s[30], undefined);
});

test("computePlayerStats omits players with no finished match", () => {
  assert.deepEqual(computePlayerStats([M(1, "scheduled")], [L(1, 10)], []), []);
});

test("statValue converts W/D/L to percentages and goals to per-match averages in pct mode", () => {
  const st = { playerId: 1, played: 4, wins: 3, draws: 0, losses: 1, goals: 3, assists: 1, decisive: 4 };
  assert.equal(statValue(st, "wins", "pct"), 75);
  assert.equal(statValue(st, "goals", "pct"), 0.75);
  assert.equal(statValue(st, "played", "pct"), 4);
  assert.equal(statValue(st, "wins", "abs"), 3);
});

test("statValue never returns NaN for a player with 0 played", () => {
  const st = { playerId: 1, played: 0, wins: 0, draws: 0, losses: 0, goals: 0, assists: 0, decisive: 0 };
  assert.equal(statValue(st, "wins", "pct"), 0);
  assert.equal(statValue(st, "goals", "pct"), 0);
});

test("rankPlayers uses competition ranking with shared ties", () => {
  const list = [
    { playerId: 1, goals: 5 }, { playerId: 2, goals: 3 }, { playerId: 3, goals: 3 }, { playerId: 4, goals: 1 },
  ];
  const r = rankPlayers(list, "goals", "abs");
  assert.deepEqual([r[1].rank, r[2].rank, r[3].rank, r[4].rank], [1, 2, 2, 4]);
  assert.equal(r[2].tied, true);
  assert.equal(r[1].tied, false);
  assert.equal(r[1].total, 4);
});

test("rankPlayers ranks losses ascending (fewest losses is 1st)", () => {
  const r = rankPlayers([{ playerId: 1, losses: 4 }, { playerId: 2, losses: 0 }], "losses", "abs");
  assert.equal(r[2].rank, 1);
  assert.equal(r[1].rank, 2);
});

test("formatRank renders 1er, Nème and ex æquo", () => {
  assert.equal(formatRank({ rank: 1, total: 13, tied: false }), "1er / 13");
  assert.equal(formatRank({ rank: 2, total: 13, tied: true }), "2ème ex æquo / 13");
  assert.equal(formatRank(undefined), "—");
});

test("formatStatValue formats by key and mode", () => {
  assert.equal(formatStatValue(66.6666, "wins", "pct"), "66.7%");
  assert.equal(formatStatValue(0.75, "goals", "pct"), "0.75");
  assert.equal(formatStatValue(3, "wins", "abs"), "3");
  assert.equal(formatStatValue(4, "played", "pct"), "4");
});

test("missingLineupPlayers returns scorer/assister not yet on the sheet", () => {
  assert.deepEqual(missingLineupPlayers([1], { type: "goal_bl", player_id: 1, assist_player_id: 2 }), [2]);
  assert.deepEqual(missingLineupPlayers([], { type: "goal_opponent", player_id: null, assist_player_id: null }), []);
});

test("diffLineup computes additions and removals", () => {
  assert.deepEqual(diffLineup([1, 2, 3], [2, 3, 4]), { add: [4], remove: [1] });
});

test("diffLineupEdit keeps a player auto-added while the editor was open", () => {
  // Editor opened on [1,2]; meanwhile a goal auto-added 9; admin unchecks 2 and adds 3.
  assert.deepEqual(diffLineupEdit([1, 2], [1, 2, 9], [1, 3]), { add: [3], remove: [2] });
});

test("diffLineupEdit removes only players that were on the sheet when editing started", () => {
  assert.deepEqual(diffLineupEdit([1, 2], [1, 2], []), { add: [], remove: [1, 2] });
});

test("saveGoalWithSheet writes the sheet before the goal", async () => {
  const calls = [];
  await saveGoalWithSheet([1], { type: "goal_bl", player_id: 1, assist_player_id: 2 }, {
    addToSheet: async (ids) => calls.push(["sheet", ids]),
    writeGoal: async () => calls.push(["goal"]),
  });
  assert.deepEqual(calls, [["sheet", [2]], ["goal"]]);
});

test("saveGoalWithSheet does not write the goal when the sheet write fails (no duplicate on retry)", async () => {
  let goalWritten = false;
  await assert.rejects(saveGoalWithSheet([], { type: "goal_bl", player_id: 1, assist_player_id: null }, {
    addToSheet: async () => { throw new Error("network"); },
    writeGoal: async () => { goalWritten = true; },
  }), /network/);
  assert.equal(goalWritten, false);
});

test("seasonOf maps August–July to one season label", () => {
  assert.equal(seasonOf(new Date(2026, 7, 1, 12).toISOString()), "2026-2027");
  assert.equal(seasonOf(new Date(2026, 7, 27, 19).toISOString()), "2026-2027");
  assert.equal(seasonOf(new Date(2027, 6, 31, 12).toISOString()), "2026-2027");
  assert.equal(seasonOf(new Date(2026, 6, 31, 12).toISOString()), "2025-2026");
});

test("seasonsFromMatches lists distinct seasons newest first", () => {
  const ms = [{ match_datetime: new Date(2025, 9, 1).toISOString() }, { match_datetime: new Date(2026, 9, 1).toISOString() }, { match_datetime: new Date(2026, 10, 1).toISOString() }];
  assert.deepEqual(seasonsFromMatches(ms), ["2026-2027", "2025-2026"]);
});

test("filterMatchesForStats filters by season and type", () => {
  const ms = [
    { id: 1, match_type: "amical", match_datetime: new Date(2026, 9, 1).toISOString() },
    { id: 2, match_type: "championnat", match_datetime: new Date(2026, 9, 2).toISOString() },
    { id: 3, match_type: "championnat", match_datetime: new Date(2025, 9, 2).toISOString() },
  ];
  assert.deepEqual(filterMatchesForStats(ms, { season: "2026-2027", type: "all" }).map((m) => m.id), [1, 2]);
  assert.deepEqual(filterMatchesForStats(ms, { season: "all", type: "championnat" }).map((m) => m.id), [2, 3]);
});

const R = (rater_id, ratee_id, score) => ({ match_id: 1, rater_id, ratee_id, score });

test("ratingProgress: a voter is done only after rating every other sheet player", () => {
  const p = ratingProgress([1, 2, 3], [R(1, 2, 7), R(1, 3, 6), R(2, 1, 8)]);
  assert.deepEqual(p.doneIds, [1]);
  assert.deepEqual(p.pendingIds, [2, 3]);
  assert.equal(p.complete, false);
});

test("ratingProgress is complete when everyone voted", () => {
  assert.equal(ratingProgress([1, 2], [R(1, 2, 7), R(2, 1, 8)]).complete, true);
});

test("ratingProgress never completes with fewer than 2 sheet players", () => {
  assert.equal(ratingProgress([1], []).complete, false);
});

test("matchAverages averages received scores and ignores raters no longer on the sheet", () => {
  const avg = matchAverages([1, 2, 3], [R(1, 2, 7), R(3, 2, 8), R(9, 2, 1), R(2, 1, 6.5)]);
  assert.equal(avg[2], 7.5);
  assert.equal(avg[1], 6.5);
  assert.equal(avg[3], null);
});

test("playerRatingSeries uses validated matches only, sorted by date", () => {
  const matches = [
    { id: 1, match_datetime: "2026-10-10T18:00:00Z", opponent_name: "B", ratings_validated_at: "x" },
    { id: 2, match_datetime: "2026-10-01T18:00:00Z", opponent_name: "A", ratings_validated_at: "x" },
    { id: 3, match_datetime: "2026-10-20T18:00:00Z", opponent_name: "C", ratings_validated_at: null },
  ];
  const lineups = [{ match_id: 1, player_id: 1 }, { match_id: 1, player_id: 2 }, { match_id: 2, player_id: 1 }, { match_id: 2, player_id: 2 }, { match_id: 3, player_id: 1 }, { match_id: 3, player_id: 2 }];
  const ratings = [
    { match_id: 1, rater_id: 2, ratee_id: 1, score: 8 },
    { match_id: 2, rater_id: 2, ratee_id: 1, score: 6 },
    { match_id: 3, rater_id: 2, ratee_id: 1, score: 10 },
  ];
  const s = playerRatingSeries(matches, ratings, lineups, 1);
  assert.deepEqual(s.map((x) => [x.matchId, x.rating, x.opponent]), [[2, 6, "A"], [1, 8, "B"]]);
  assert.equal(averageRating(s), 7);
  assert.equal(averageRating([]), null);
});

test("buildRatingPayload returns one row per other sheet player", () => {
  assert.deepEqual(buildRatingPayload(5, 1, [1, 2, 3], { 2: "7.5", 3: 9 }), [
    { match_id: 5, rater_id: 1, ratee_id: 2, score: 7.5 },
    { match_id: 5, rater_id: 1, ratee_id: 3, score: 9 },
  ]);
});

test("buildRatingPayload rejects a missing, out-of-range or non-half-point score", () => {
  assert.throws(() => buildRatingPayload(5, 1, [1, 2, 3], { 2: 7 }), /note/i);
  assert.throws(() => buildRatingPayload(5, 1, [1, 2], { 2: 11 }), /note/i);
  assert.throws(() => buildRatingPayload(5, 1, [1, 2], { 2: 7.3 }), /note/i);
});

test("statsRoster keeps regular and occasional players only", () => {
  assert.deepEqual(statsRoster([{ player_id: 1, role: "regulier" }, { player_id: 2, role: "invite" }, { player_id: 3, role: "occasionnel" }]), [1, 3]);
});

test("buildStatsRows adds zero rows and ratings for the roster only", () => {
  const rows = buildStatsRows([1, 2], [{ playerId: 1, played: 2, wins: 1, draws: 0, losses: 1, goals: 1, assists: 0, decisive: 1 }, { playerId: 9, played: 1, wins: 1, draws: 0, losses: 0, goals: 0, assists: 0, decisive: 0 }], { 1: 7.25 });
  assert.deepEqual(rows.map((r) => [r.playerId, r.played, r.rating]), [[1, 2, 7.25], [2, 0, null]]);
});

test("statValue and formatStatValue handle the rating key", () => {
  assert.equal(statValue({ rating: 7.25, played: 2 }, "rating", "pct"), 7.25);
  assert.equal(formatStatValue(7.25, "rating", "abs"), "7.3");
  assert.equal(formatStatValue(null, "rating", "pct"), "—");
});

test("sortStatsRows keeps rows without a rating last in both directions", () => {
  const rows = [{ playerId: 1, rating: null }, { playerId: 2, rating: 6 }, { playerId: 3, rating: 8 }];
  const name = (id) => ({ 1: "A", 2: "B", 3: "C" })[id];
  assert.deepEqual(sortStatsRows(rows, "rating", -1, "abs", name).map((r) => r.playerId), [3, 2, 1]);
  assert.deepEqual(sortStatsRows(rows, "rating", 1, "abs", name).map((r) => r.playerId), [2, 3, 1]);
});

test("sortStatsRows breaks ties by name", () => {
  const rows = [{ playerId: 1, played: 2 }, { playerId: 2, played: 2 }];
  const name = (id) => ({ 1: "Zoé", 2: "Alex" })[id];
  assert.deepEqual(sortStatsRows(rows, "played", -1, "abs", name).map((r) => r.playerId), [2, 1]);
});

test("submitRatings refuses to write once the match is already validated", async () => {
  let wrote = false;
  const r = await submitRatings({ isValidated: async () => true, writeRatings: async () => { wrote = true; } });
  assert.equal(r, "closed");
  assert.equal(wrote, false);
});

test("submitRatings only saves, even when every vote is in (an admin validates)", async () => {
  let wrote = false;
  const r = await submitRatings({ isValidated: async () => false, writeRatings: async () => { wrote = true; } });
  assert.equal(r, "saved");
  assert.equal(wrote, true);
});

test("finalAverages applies the admin's hand-set final notes", () => {
  const { finalAverages } = require("./foot-logic.js");
  const rs = [{ rater_id: 1, ratee_id: 2, score: 6 }, { rater_id: 3, ratee_id: 2, score: 8 }, { rater_id: 2, ratee_id: 1, score: 5 }];
  assert.equal(finalAverages({}, [1, 2, 3], rs)[2], 7);
  const f = finalAverages({ rating_overrides: { 2: 9.5 } }, [1, 2, 3], rs);
  assert.equal(f[2], 9.5);
  assert.equal(f[1], 5);
});

test("ratingsTabView hides the form once validated, even if it was open", () => {
  const v = ratingsTabView({ validated: true, isVoter: true, hasVoted: false, editing: true, isAdmin: true });
  assert.equal(v.showForm, false);
  assert.equal(v.showAverages, true);
});

test("ratingsTabView gives a pending voter a way back to the form", () => {
  const v = ratingsTabView({ validated: false, isVoter: true, hasVoted: false, editing: false, isAdmin: false });
  assert.equal(v.showEditButton, true);
  assert.equal(v.editLabel, "Noter");
  assert.equal(v.showAverages, false);
});

test("ratingsTabView keeps averages hidden from a sheet player before voting", () => {
  const v = ratingsTabView({ validated: false, isVoter: true, hasVoted: false, editing: true, isAdmin: false });
  assert.equal(v.showForm, true);
  assert.equal(v.showAverages, false);
});

test("permissions : bureau, démarrage et édition d'un match", () => {
  const L = require("./foot-logic.js");
  const bureau = L.FOOT_BUREAU_UIDS.map((uid, i) => ({ id: 100 + i, uid }));
  assert.equal(bureau.length, 5);
  assert.ok(bureau.every((p) => L.isBureau(p)));
  const membre = { id: 1, uid: "nils-bra" }, starter = { id: 2, uid: "emma-gar" };
  assert.equal(L.isBureau(membre), false);
  assert.equal(L.isBureau({ id: 9, uid: "salome-dev" }), false);
  assert.equal(L.isBureau(null), false);
  // tout le monde peut démarrer un match programmé
  assert.equal(L.canStartMatch({ status: "scheduled" }, membre), true);
  assert.equal(L.canStartMatch({ status: "live" }, membre), false);
  assert.equal(L.canStartMatch({ status: "scheduled" }, null), false);
  // en cours : seul celui qui l'a lancé
  const live = { status: "live", started_by: starter.id };
  assert.equal(L.canEditMatch(live, starter), true);
  assert.equal(L.canEditMatch(live, membre), false);
  assert.equal(L.canEditMatch(live, bureau[0]), false);
  // ancien match en cours sans lanceur : le bureau
  assert.equal(L.canEditMatch({ status: "live", started_by: null }, bureau[1]), true);
  assert.equal(L.canEditMatch({ status: "live", started_by: null }, membre), false);
  // terminé : le bureau, y compris pour un match lancé par un membre
  const done = { status: "finished", started_by: starter.id };
  assert.equal(L.canEditMatch(done, bureau[2]), true);
  assert.equal(L.canEditMatch(done, starter), false);
  assert.equal(L.canEditMatch({ status: "scheduled" }, bureau[3]), true);
  assert.equal(L.canEditMatch({ status: "scheduled" }, membre), false);
});

test("ratingsTabView: tables only for voters who voted, or everyone once validated (admins get no special view)", () => {
  assert.equal(ratingsTabView({ validated: false, isVoter: false, hasVoted: false, editing: false, isAdmin: false }).showAverages, false);
  assert.equal(ratingsTabView({ validated: false, isVoter: true, hasVoted: false, editing: false, isAdmin: false }).showAverages, false);
  assert.equal(ratingsTabView({ validated: false, isVoter: true, hasVoted: true, editing: false, isAdmin: false }).showAverages, true);
  assert.equal(ratingsTabView({ validated: false, isVoter: false, hasVoted: false, editing: false, isAdmin: true }).showAverages, false);
  assert.equal(ratingsTabView({ validated: true, isVoter: false, hasVoted: false, editing: false, isAdmin: false }).showAverages, true);
});

test("mergeFinalNotes: typed notes overwrite, the rest is kept, resets go back to auto", () => {
  const { mergeFinalNotes } = require("./foot-logic.js");
  assert.deepEqual(mergeFinalNotes({ 1: 7, 2: 5 }, { 1: "8,5", 3: "" }, []), { 1: 8.5, 2: 5 });
  assert.deepEqual(mergeFinalNotes({ 1: 7, 2: 5 }, {}, [2]), { 1: 7 });
  assert.deepEqual(mergeFinalNotes(null, { 4: "6.1" }, []), { 4: 6.1 });
  assert.throws(() => mergeFinalNotes({}, { 1: "12" }, []));
});

test("parseFinalNote accepts decimals, comma, empty = auto, rejects out of range", () => {
  const { parseFinalNote } = require("./foot-logic.js");
  assert.equal(parseFinalNote("6.1"), 6.1);
  assert.equal(parseFinalNote(" 6,14 "), 6.1);
  assert.equal(parseFinalNote(""), null);
  assert.equal(parseFinalNote(null), null);
  assert.throws(() => parseFinalNote("11"));
  assert.throws(() => parseFinalNote("0.5"));
  assert.throws(() => parseFinalNote("abc"));
});

test("computeAttendanceQueue: answers in order, the first `min` confirmed, the rest on the waiting list", () => {
  const { computeAttendanceQueue } = require("./foot-logic.js");
  const roster = [1, 2, 3, 4, 5].map((player_id) => ({ player_id }));
  const rows = [
    { player_id: 3, status: "present", responded_at: "2026-10-01T10:00:00Z" },
    { player_id: 1, status: "present", responded_at: "2026-10-01T09:00:00Z" },
    { player_id: 2, status: "present", responded_at: "2026-10-01T11:00:00Z" },
    { player_id: 4, status: "absent", responded_at: "2026-10-01T08:00:00Z" },
    { player_id: 99, status: "present", responded_at: "2026-10-01T07:00:00Z" }, // not in the roster
  ];
  const q = computeAttendanceQueue(roster, rows, 2);
  assert.deepEqual(q.order.map((o) => [o.playerId, o.rank, o.waiting]), [[1, 1, false], [3, 2, false], [2, 3, true]]);
  assert.deepEqual(q.confirmed, [1, 3]);
  assert.deepEqual(q.waiting, [2]);
  assert.deepEqual(q.absent, [4]);
  assert.deepEqual(q.noResponse, [5]);
  // no minimum: nobody waits
  const all = computeAttendanceQueue(roster, rows, null);
  assert.deepEqual(all.waiting, []);
  assert.equal(all.min, null);
  // someone drops out: the waiting player comes in
  const after = computeAttendanceQueue(roster, rows.map((r) => (r.player_id === 1 ? { ...r, status: "absent" } : r)), 2);
  assert.deepEqual(after.confirmed, [3, 2]);
});
