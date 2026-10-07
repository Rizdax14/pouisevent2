// foot-logic.js
function computeFootScore(events) {
  let bl = 0, opponent = 0;
  for (const e of events) {
    if (e.type === "goal_bl") bl++;
    else if (e.type === "goal_opponent") opponent++;
  }
  return { bl, opponent };
}

// Presences in order of answer. With a minimum number of players, the first `min` "present" answers are confirmed and the
// following ones go on a waiting list (they come in automatically if someone drops out). `order` lists every present player.
function computeAttendanceQueue(roster, attendanceRows, minPlayers) {
  const ids = new Set(roster.map((r) => r.player_id));
  const rows = attendanceRows.filter((a) => ids.has(a.player_id));
  const present = rows.filter((a) => a.status === "present")
    .sort((a, b) => String(a.responded_at).localeCompare(String(b.responded_at)) || a.player_id - b.player_id);
  const min = Number.isInteger(minPlayers) && minPlayers > 0 ? minPlayers : null;
  const order = present.map((a, i) => ({ playerId: a.player_id, rank: i + 1, waiting: min != null && i >= min, respondedAt: a.responded_at }));
  const answered = new Set(rows.map((a) => a.player_id));
  return {
    order,
    confirmed: order.filter((o) => !o.waiting).map((o) => o.playerId),
    waiting: order.filter((o) => o.waiting).map((o) => o.playerId),
    absent: rows.filter((a) => a.status === "absent").map((a) => a.player_id),
    noResponse: roster.map((r) => r.player_id).filter((id) => !answered.has(id)),
    min,
  };
}

// How many times each player has been in charge of the balls, over the given matches. → { playerId: n }
function ballKeeperCounts(matches) {
  const out = {};
  for (const m of matches) for (const id of m.ball_keepers || []) out[id] = (out[id] || 0) + 1;
  return out;
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
    return { type, half: h, minute: m, player_id: null, assist_player_id: null, own_goal: false };
  }
  if (!playerId) throw new Error("Choisis un buteur");
  // Own goal (CSC): a goal for us with no scorer of ours.
  if (playerId === "csc") return { type: "goal_bl", half: h, minute: m, player_id: null, assist_player_id: null, own_goal: true };
  if (assistId && String(assistId) === String(playerId)) throw new Error("Le buteur ne peut pas faire la passe décisive");
  return { type: "goal_bl", half: h, minute: m, player_id: Number(playerId), assist_player_id: assistId ? Number(assistId) : null, own_goal: false };
}

const STAT_KEYS_PCT_OF_PLAYED = ["wins", "draws", "losses"];

// Man of the match: the player with the most votes of each validated match (ties share it). → { matchId: [playerId, …] }
function motmWinners(matches, votes) {
  const out = {};
  for (const m of matches) {
    if (m.status !== "finished" || !m.ratings_validated_at) continue;
    const tally = {};
    for (const v of votes) if (v.match_id === m.id) tally[v.player_id] = (tally[v.player_id] || 0) + 1;
    const top = Math.max(0, ...Object.values(tally));
    if (top > 0) out[m.id] = Object.keys(tally).filter((id) => tally[id] === top).map(Number);
  }
  return out;
}

function computePlayerStats(matches, lineups, events, motmByMatch) {
  const finished = new Set(matches.filter((m) => m.status === "finished").map((m) => m.id));
  const resultByMatch = {};
  for (const id of finished) {
    const s = computeFootScore(events.filter((e) => e.match_id === id));
    resultByMatch[id] = s.bl > s.opponent ? "wins" : s.bl === s.opponent ? "draws" : "losses";
  }
  const onSheet = new Set();
  const stats = {};
  for (const l of lineups) {
    if (!finished.has(l.match_id)) continue;
    onSheet.add(`${l.match_id}:${l.player_id}`);
    const st = stats[l.player_id] || (stats[l.player_id] = { playerId: l.player_id, played: 0, wins: 0, draws: 0, losses: 0, goals: 0, assists: 0, decisive: 0, motm: 0 });
    st.played++;
    st[resultByMatch[l.match_id]]++;
  }
  for (const e of events) {
    if (e.type !== "goal_bl" || !finished.has(e.match_id)) continue;
    if (e.player_id && onSheet.has(`${e.match_id}:${e.player_id}`)) stats[e.player_id].goals++;
    if (e.assist_player_id && onSheet.has(`${e.match_id}:${e.assist_player_id}`)) stats[e.assist_player_id].assists++;
  }
  for (const [matchId, ids] of Object.entries(motmByMatch || {})) {
    if (!finished.has(Number(matchId))) continue;
    for (const id of ids) if (onSheet.has(`${matchId}:${id}`)) stats[id].motm++;
  }
  return Object.values(stats).map((s) => ({ ...s, decisive: s.goals + s.assists }));
}

function statValue(stat, key, mode) {
  if (key === "rating") return stat.rating ?? null;
  const raw = stat[key] || 0;
  if (mode !== "pct" || key === "played") return raw;
  if (!stat.played) return 0;
  if (STAT_KEYS_PCT_OF_PLAYED.includes(key)) return (raw / stat.played) * 100;
  return raw / stat.played;
}

function rankPlayers(statsList, key, mode) {
  const asc = key === "losses";
  const vals = statsList.map((s) => ({ id: s.playerId, v: statValue(s, key, mode) }));
  const out = {};
  for (const a of vals) {
    const better = vals.filter((b) => (asc ? b.v < a.v : b.v > a.v)).length;
    const same = vals.filter((b) => b.v === a.v).length;
    out[a.id] = { rank: better + 1, total: vals.length, tied: same > 1 };
  }
  return out;
}

function formatRank(r) {
  if (!r) return "—";
  return `${r.rank === 1 ? "1er" : r.rank + "ème"}${r.tied ? " ex æquo" : ""} / ${r.total}`;
}

function formatStatValue(value, key, mode) {
  if (key === "rating") return value == null ? "—" : (Math.round(value * 10) / 10).toFixed(1);
  if (mode !== "pct" || key === "played") return String(Math.round(value));
  if (STAT_KEYS_PCT_OF_PLAYED.includes(key)) return `${(Math.round(value * 10) / 10).toFixed(1)}%`;
  return (Math.round(value * 100) / 100).toFixed(2);
}

function missingLineupPlayers(lineupPlayerIds, payload) {
  if (payload.type !== "goal_bl") return [];
  const have = new Set(lineupPlayerIds);
  return [payload.player_id, payload.assist_player_id].filter((id) => id && !have.has(id));
}

function diffLineup(currentIds, wantedIds) {
  const cur = new Set(currentIds);
  const want = new Set(wantedIds);
  return { add: wantedIds.filter((id) => !cur.has(id)), remove: currentIds.filter((id) => !want.has(id)) };
}

function diffLineupEdit(snapshotIds, currentIds, wantedIds) {
  const cur = new Set(currentIds);
  const want = new Set(wantedIds);
  return { add: wantedIds.filter((id) => !cur.has(id)), remove: snapshotIds.filter((id) => !want.has(id) && cur.has(id)) };
}

// Sheet first: the upsert is idempotent, so a failure here leaves nothing to duplicate on retry.
async function saveGoalWithSheet(lineupIds, payload, { addToSheet, writeGoal }) {
  const missing = missingLineupPlayers(lineupIds, payload);
  if (missing.length) await addToSheet(missing);
  await writeGoal();
}

function seasonOf(dateIso) {
  const d = new Date(dateIso);
  const start = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

function seasonsFromMatches(matches) {
  return [...new Set(matches.map((m) => seasonOf(m.match_datetime)))].sort().reverse();
}

function filterMatchesForStats(matches, { season, type }) {
  return matches.filter((m) => (season === "all" || seasonOf(m.match_datetime) === season) && (type === "all" || m.match_type === type));
}

function ratingProgress(sheetIds, matchRatings) {
  if (sheetIds.length < 2) return { doneIds: [], pendingIds: [...sheetIds], complete: false };
  const rated = new Set(matchRatings.map((r) => `${r.rater_id}:${r.ratee_id}`));
  const doneIds = sheetIds.filter((rater) => sheetIds.every((ratee) => ratee === rater || rated.has(`${rater}:${ratee}`)));
  const pendingIds = sheetIds.filter((id) => !doneIds.includes(id));
  return { doneIds, pendingIds, complete: pendingIds.length === 0 };
}

function matchAverages(sheetIds, matchRatings) {
  const out = {};
  for (const id of sheetIds) {
    const got = matchRatings.filter((r) => r.ratee_id === id && r.rater_id !== id && sheetIds.includes(r.rater_id)).map((r) => Number(r.score));
    out[id] = got.length ? got.reduce((a, b) => a + b, 0) / got.length : null;
  }
  return out;
}

// Average per player, with the final notes an admin may have set by hand on the match (rating_overrides: {playerId: score}).
function finalAverages(match, sheetIds, matchRatings) {
  const out = matchAverages(sheetIds, matchRatings);
  const over = (match && match.rating_overrides) || {};
  for (const id of sheetIds) if (over[id] != null && over[id] !== "") out[id] = Number(over[id]);
  return out;
}

// A final note typed by an admin: "6.1" or "6,1", between 1 and 10, one decimal. Empty = automatic (null).
function parseFinalNote(raw) {
  const t = String(raw ?? "").trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 1 || n > 10) throw new Error("La note finale doit être entre 1 et 10");
  return Math.round(n * 10) / 10;
}

// Final notes are write-only for admins: what they type is merged over the notes already set (which they never see);
// an id in `resetIds` goes back to the automatic average.
function mergeFinalNotes(existing, typed, resetIds) {
  const out = { ...(existing || {}) };
  for (const [id, raw] of Object.entries(typed || {})) { const n = parseFinalNote(raw); if (n != null) out[id] = n; }
  for (const id of resetIds || []) delete out[id];
  return out;
}

function playerRatingSeries(matches, ratings, lineups, playerId) {
  const series = [];
  for (const m of matches) {
    if (!m.ratings_validated_at) continue;
    const sheet = lineups.filter((l) => l.match_id === m.id).map((l) => l.player_id);
    if (!sheet.includes(playerId)) continue;
    const rating = finalAverages(m, sheet, ratings.filter((r) => r.match_id === m.id))[playerId];
    if (rating == null) continue;
    series.push({ matchId: m.id, date: m.match_datetime, opponent: m.opponent_name, rating });
  }
  return series.sort((a, b) => new Date(a.date) - new Date(b.date));
}

function averageRating(series) {
  return series.length ? series.reduce((a, s) => a + s.rating, 0) / series.length : null;
}

function buildRatingPayload(matchId, raterId, sheetIds, scoresByRatee) {
  return sheetIds.filter((id) => id !== raterId).map((id) => {
    const raw = scoresByRatee[id];
    const s = Number(raw);
    if (raw == null || raw === "" || !(s >= 1 && s <= 10) || s * 2 !== Math.floor(s * 2)) {
      throw new Error("Donne une note entre 1 et 10 (par demi-points) à chaque joueur");
    }
    return { match_id: matchId, rater_id: raterId, ratee_id: id, score: s };
  });
}

function statsRoster(roster) {
  return roster.filter((r) => r.role === "regulier" || r.role === "occasionnel").map((r) => r.player_id);
}

function buildStatsRows(rosterIds, stats, ratingByPlayer) {
  return rosterIds.map((id) => {
    const s = stats.find((x) => x.playerId === id) || { playerId: id, played: 0, wins: 0, draws: 0, losses: 0, goals: 0, assists: 0, decisive: 0, motm: 0 };
    return { ...s, rating: ratingByPlayer[id] ?? null };
  });
}

function sortStatsRows(rows, key, dir, mode, nameOf) {
  return [...rows].sort((a, b) => {
    const va = statValue(a, key, mode);
    const vb = statValue(b, key, mode);
    const byName = nameOf(a.playerId).localeCompare(nameOf(b.playerId));
    if (va == null || vb == null) return va == null && vb == null ? byName : va == null ? 1 : -1;
    return (va - vb) * dir || byName;
  });
}

// Saving a vote never validates the ratings: an admin does that by hand.
async function submitRatings({ isValidated, writeRatings }) {
  if (await isValidated()) return "closed";
  await writeRatings();
  return "saved";
}

function ratingsTabView({ validated, isVoter, hasVoted, editing, isAdmin }) {
  const showForm = editing && isVoter && !validated;
  const showAverages = !showForm && (validated || (isVoter && hasVoted));
  return {
    showForm,
    showAverages,
    showEditButton: !editing && isVoter && !validated,
    editLabel: hasVoted ? "Modifier mes notes" : "Noter",
    showHiddenMessage: !showForm && !showAverages,
  };
}

// Bureau = the 5 officers (Salomé, honorary member, is not part of it).
const FOOT_BUREAU_UIDS = ["louis-mar", "maxime-mar", "thisma-bru", "samuel-oll", "thomas-pey"];

function isBureau(player) {
  return !!player && FOOT_BUREAU_UIDS.includes(player.uid);
}

// Anyone logged in can start a scheduled match; the starter is then the only editor until the match is
// finished, after which the bureau can edit again. Legacy live matches (no recorded starter) go to the bureau.
function canEditMatch(match, player) {
  if (!match || !player) return false;
  if (match.status === "live" && match.started_by) return match.started_by === player.id;
  return isBureau(player);
}

function canStartMatch(match, player) {
  return !!match && !!player && match.status === "scheduled";
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    FOOT_BUREAU_UIDS,
    isBureau,
    canEditMatch,
    canStartMatch,
    computeFootScore,
    computeAttendanceBuckets,
    computeAttendanceQueue,
    ballKeeperCounts,
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
    motmWinners,
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
    finalAverages,
    parseFinalNote,
    mergeFinalNotes,
    playerRatingSeries,
    averageRating,
    buildRatingPayload,
    statsRoster,
    buildStatsRows,
    sortStatsRows,
    submitRatings,
    ratingsTabView,
  };
}
