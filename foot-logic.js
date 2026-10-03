// foot-logic.js
function computeFootScore(events) {
  let bl = 0, opponent = 0;
  for (const e of events) {
    if (e.type === "goal_bl") bl++;
    else if (e.type === "goal_opponent") opponent++;
  }
  return { bl, opponent };
}

function computeAttendanceBuckets(roster, attendanceRows) {
  const statusByPlayer = {};
  for (const row of attendanceRows) statusByPlayer[row.player_id] = row.status;
  const present = [], absent = [], noResponse = [];
  for (const entry of roster) {
    const status = statusByPlayer[entry.player_id];
    if (status === "present") present.push(entry.player_id);
    else if (status === "absent") absent.push(entry.player_id);
    else noResponse.push(entry.player_id);
  }
  return { present, absent, noResponse };
}

function computeHalfElapsedSeconds(halfStartedAt, halfElapsedSeconds, now) {
  if (!halfStartedAt) return halfElapsedSeconds;
  const startedMs = new Date(halfStartedAt).getTime();
  const nowMs = now instanceof Date ? now.getTime() : now;
  const runningSeconds = Math.max(0, Math.floor((nowMs - startedMs) / 1000));
  return halfElapsedSeconds + runningSeconds;
}

function buildEventTimeline(events) {
  return [...events].sort((a, b) => a.half - b.half || a.minute - b.minute || a.id - b.id);
}

function nextHalfState(currentHalf, nbHalves) {
  if (currentHalf < nbHalves) return { type: "next", half: currentHalf + 1 };
  return { type: "finish" };
}

function canConfirmGoal(playerId, busy) {
  return !!playerId && !busy;
}

function nextLiveAction(running, isLastHalf, halfElapsedSeconds) {
  if (running) return "playing";
  if (isLastHalf && halfElapsedSeconds > 0) return "close";
  return "start";
}

function assertUpsertOk(result) {
  if (result && result.error) {
    throw new Error(result.error.message || String(result.error));
  }
}

function normalizeForSearch(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function filterPlayersByName(players, query, getName) {
  const q = normalizeForSearch(query).trim();
  if (!q) return players;
  return players.filter((p) => normalizeForSearch(getName(p)).includes(q));
}

function toDatetimeLocalValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildEventPayload({ type, half, minute, playerId, assistId }) {
  const h = Number(half);
  const m = Number(minute);
  if (!Number.isInteger(h) || h < 1) throw new Error("Mi-temps invalide");
  if (!Number.isInteger(m) || m < 0) throw new Error("Minute invalide");
  if (type === "goal_opponent") {
    return { type, half: h, minute: m, player_id: null, assist_player_id: null };
  }
  if (!playerId) throw new Error("Choisis un buteur");
  if (assistId && String(assistId) === String(playerId)) throw new Error("Le buteur ne peut pas faire la passe décisive");
  return { type: "goal_bl", half: h, minute: m, player_id: Number(playerId), assist_player_id: assistId ? Number(assistId) : null };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
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
  };
}
