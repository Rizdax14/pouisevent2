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
    { type: "goal_bl", half: 2, minute: 17, player_id: 4, assist_player_id: 9 }
  );
});

test("buildEventPayload clears scorer and assist for an opponent goal", () => {
  assert.deepEqual(
    buildEventPayload({ type: "goal_opponent", half: "1", minute: "3", playerId: "4", assistId: "9" }),
    { type: "goal_opponent", half: 1, minute: 3, player_id: null, assist_player_id: null }
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
