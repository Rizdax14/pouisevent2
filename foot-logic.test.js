// foot-logic.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  computeFootScore,
  computeAttendanceBuckets,
  computeHalfElapsedSeconds,
  buildEventTimeline,
  nextHalfState,
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
