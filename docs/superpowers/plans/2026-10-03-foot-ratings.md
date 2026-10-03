# Football Ratings, Stats Filters & Match Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Players on a finished match's sheet rate each other (1–10, half points); validated ratings feed a "Note" stat and a "Mon évolution" chart; the Stats page gains Saison/Type filters and is limited to regular/occasional players; matches get an amical/championnat type; invités can't mark presence.

**Architecture:** One migration (match columns + `foot_ratings`). All rules are pure functions in `foot-logic.js` with `node:test` tests; `foot.jsx` wires data and renders. Validation is triggered client-side after each vote save (auto) or by the admin (forced).

**Tech Stack:** React 18 UMD + Babel (`npm run build`), Supabase REST helpers (`sbFetch`, `sbInsert`, `sbUpdate`, `SUPABASE`), `node:test`, inline SVG chart.

**Spec:** `docs/superpowers/specs/2026-10-03-foot-ratings-design.md`

## Global Constraints

- Ratings: `score` in 1–10, multiples of 0.5; no self-rating; PK `(match_id, rater_id, ratee_id)`.
- A voter is "done" when they rated **every other** sheet player; validation needs ≥ 2 sheet players.
- Only votes from raters currently on the sheet count toward averages.
- Season = September → August, label `"YYYY-YYYY+1"`, computed in local time.
- Stats population = roster players with role `regulier` or `occasionnel`; rank pool = population with `played ≥ 1` (for "Note": with a non-null rating).
- `foot_stats_season` / `foot_stats_type` in `localStorage`, read in try/catch; defaults: current season, `"all"`.
- Chart: single series, color `#3b82f6` (validated: dark surface `#0d0d1c`, contrast ≥ 3:1), 2px line, ≥ 8px markers, recessive grid, hover tooltip, `role="img"` + `aria-label` listing values, no legend (title names the series).
- Every task editing `foot.jsx`/`foot-logic.js` ends with `npm run build` and the same fresh `YYYYMMDDHHMMSS` on `foot-logic.js?v=` and `foot.js?v=` in `index.html` and `CACHE_VERSION` in `sw.js`.
- No real votes or validations are written to production data during verification without the user's explicit OK.

## Review Focus

- **A sheet player opens the Notes tab before voting** → sees the form, never the averages. (Task 4 render check)
- **The sheet has only 1 player** → no form, no auto-validation, message "Pas assez de joueurs pour noter". (Task 2 unit test + Task 4 render check)
- **A player on the roster as invité who played** → appears on the match sheet and can vote/be rated, but never in the Stats table or ranks. (Task 5 render check)
- **Stats season with no match** → empty-but-valid page (zeros, "—"), no NaN, chart message. (Task 5 render check)
- **Sorting the Stats table by "Note" with players without ratings** → those players stay at the bottom in both directions. (Task 5 render check)

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `supabase/migrations/20261003240000_foot_ratings.sql` | create | `match_type`, `ratings_validated_at`, `foot_ratings` |
| `foot-logic.js` / `foot-logic.test.js` | modify | season, filters, rating progress/averages/series, payload validation, stats rows |
| `foot.jsx` / `foot.js` | modify | load ratings; match type field + badge; invité presence; Notes tab; Stats filters, Note stat, evolution chart |
| `index.html`, `sw.js` | modify | cache-busting |

---

### Task 1: Migration and loading ratings

**Files:** Create `supabase/migrations/20261003240000_foot_ratings.sql`; Modify `foot.jsx` (`FootballApp`).

**Interfaces:**
- Produces: `foot_matches.match_type`, `foot_matches.ratings_validated_at`, table `foot_ratings`; `FootballApp` state `ratings` = array of `{match_id, rater_id, ratee_id, score:number}`.

- [ ] **Step 1: Migration**

```sql
alter table foot_matches add column if not exists match_type text not null default 'championnat';
alter table foot_matches drop constraint if exists foot_matches_match_type_check;
alter table foot_matches add constraint foot_matches_match_type_check check (match_type in ('amical','championnat'));
alter table foot_matches add column if not exists ratings_validated_at timestamptz;

create table if not exists foot_ratings (
  match_id bigint not null references foot_matches(id) on delete cascade,
  rater_id integer not null references players(id) on delete cascade,
  ratee_id integer not null references players(id) on delete cascade,
  score numeric(3,1) not null check (score between 1 and 10 and score * 2 = floor(score * 2)),
  updated_at timestamptz not null default now(),
  primary key (match_id, rater_id, ratee_id),
  check (rater_id <> ratee_id)
);
```

- [ ] **Step 2: Apply and verify**

Run: `supabase db push --password '<db password>'`, wait ~10 s for the API schema cache, then
`curl -s "$BASE/foot_ratings?select=*" -H "apikey: $ANON"` → `[]` and
`curl -s "$BASE/foot_matches?select=id,match_type,ratings_validated_at" -H "apikey: $ANON"` → existing matches with `"match_type":"championnat"`, `"ratings_validated_at":null`.

- [ ] **Step 3: Load ratings** — in `FootballApp`: `const [ratings, setRatings] = React.useState([]);`, add `sbFetch("foot_ratings", "?select=match_id,rater_id,ratee_id,score")` as a 6th entry of the `Promise.all` in `reloadFoot`, and `setRatings((rt || []).map((x) => ({ ...x, score: Number(x.score) })));`.

- [ ] **Step 4: Build, bump, commit**

```bash
npm run build && node --check foot.js
git add supabase/migrations/20261003240000_foot_ratings.sql foot.jsx foot.js index.html sw.js
git commit -m "feat: add football match type, ratings table and load ratings"
```

---

### Task 2: Pure logic

**Files:** Modify `foot-logic.js`, `foot-logic.test.js`.

**Interfaces — Produces:**
- `seasonOf(dateIso) -> string`, `seasonsFromMatches(matches) -> string[]` (desc)
- `filterMatchesForStats(matches, { season, type }) -> matches[]`
- `ratingProgress(sheetIds, matchRatings) -> { doneIds, pendingIds, complete }`
- `matchAverages(sheetIds, matchRatings) -> { [id]: number|null }`
- `playerRatingSeries(matches, ratings, lineups, playerId) -> [{ matchId, date, opponent, rating }]`
- `averageRating(series) -> number|null`
- `buildRatingPayload(matchId, raterId, sheetIds, scoresByRatee) -> rows[]` (throws on invalid)
- `statsRoster(roster) -> number[]`
- `buildStatsRows(rosterIds, stats, ratingByPlayer) -> rows[]` (zero rows for missing players, `rating` field)
- `statValue` / `formatStatValue` extended for key `"rating"` (raw, `null` → `"—"`, 1 decimal)

- [ ] **Step 1: Failing tests** (append; extend the `require` list with the 10 new names)

```js
test("seasonOf maps September–August to one season label", () => {
  assert.equal(seasonOf(new Date(2026, 8, 1).toISOString()), "2026-2027");
  assert.equal(seasonOf(new Date(2027, 7, 31, 12).toISOString()), "2026-2027");
  assert.equal(seasonOf(new Date(2026, 7, 31, 12).toISOString()), "2025-2026");
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
```

- [ ] **Step 2: Run** `npm test` → Expected: the 14 new tests fail, the 44 existing pass.

- [ ] **Step 3: Implement** (before `module.exports`; add the 10 names to the exports)

```js
function seasonOf(dateIso) {
  const d = new Date(dateIso);
  const start = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
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

function playerRatingSeries(matches, ratings, lineups, playerId) {
  const series = [];
  for (const m of matches) {
    if (!m.ratings_validated_at) continue;
    const sheet = lineups.filter((l) => l.match_id === m.id).map((l) => l.player_id);
    if (!sheet.includes(playerId)) continue;
    const rating = matchAverages(sheet, ratings.filter((r) => r.match_id === m.id))[playerId];
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
    const s = Number(scoresByRatee[id]);
    if (scoresByRatee[id] == null || scoresByRatee[id] === "" || !(s >= 1 && s <= 10) || s * 2 !== Math.floor(s * 2)) {
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
    const s = stats.find((x) => x.playerId === id) || { playerId: id, played: 0, wins: 0, draws: 0, losses: 0, goals: 0, assists: 0, decisive: 0 };
    return { ...s, rating: ratingByPlayer[id] ?? null };
  });
}
```

Extend the existing functions — first line of `statValue`: `if (key === "rating") return stat.rating ?? null;` — first line of `formatStatValue`: `if (key === "rating") return value == null ? "—" : (Math.round(value * 10) / 10).toFixed(1);`

- [ ] **Step 4: Run** `npm test` → Expected: 58/58.

- [ ] **Step 5: Bump + commit**

```bash
git add foot-logic.js foot-logic.test.js index.html sw.js
git commit -m "feat: pure logic for football ratings, seasons and stats rows"
```

---

### Task 3: Match type and invité presence

**Files:** Modify `foot.jsx`.

**Interfaces:** Consumes `match.match_type`. Produces `FootMatchForm` field `match_type`; `attendanceRoster(roster) -> roster rows without invités` (local helper in `foot.jsx`).

- [ ] **Step 1: Form field** — in `FootMatchForm`, add `match_type: "championnat"` to `empty`, include `match_type: f.match_type || "championnat"` in the object passed to `onSubmit`, and render after the date input:

```jsx
      <select style={FOOT_INPUT_STYLE} value={f.match_type || "championnat"} onChange={set("match_type")}>
        <option value="championnat">Championnat</option>
        <option value="amical">Match amical</option>
      </select>
```

- [ ] **Step 2: Badge** — in `FootMatchCard`, next to the status label:

```jsx
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 9, color: "#60607a", border: "1px solid #1e1e30", borderRadius: 4, padding: "1px 5px", textTransform: "uppercase" }}>{match.match_type === "amical" ? "Amical" : "Championnat"}</span>
          <div style={{ fontSize: 10, color: statusColor, textTransform: "uppercase", fontWeight: 700 }}>{statusLabel}</div>
        </div>
```
(replacing the lone status `<div>`). Show the same badge text in `FootMatchHeader` under the date.

- [ ] **Step 3: Invités can't mark presence** — add near `lineupIdsFor`:

```jsx
function attendanceRoster(roster) {
  return roster.filter((r) => r.role !== "invite");
}
```
In `FootCalendarPage` and `FootScheduledView`, compute `const presenceRoster = attendanceRoster(roster);` and use it for `isOnRoster`, `computeAttendanceBuckets(presenceRoster, ...)`, the "Aucun joueur" check and `rosterSize={presenceRoster.length}`.

- [ ] **Step 4: Verify** — `npm run build && node --check foot.js && npm test`; extend the scratch render check: an invité current player sees no Présent/Absent on the card and detail page; the card shows "Amical"/"Championnat"; the edit form shows the match type select with the current value.

- [ ] **Step 5: Bump + commit**

```bash
git add foot.jsx foot.js index.html sw.js
git commit -m "feat: football match type badge/field, invités cannot mark presence"
```

---

### Task 4: "Notes du match" tab

**Files:** Modify `foot.jsx`.

**Interfaces:** Consumes `ratings` (Task 1), `ratingProgress`, `matchAverages`, `buildRatingPayload` (Task 2), `lineupIdsFor`. Produces `FootRatingsTab({ match, lineups, ratings, currentPlayer, isAdmin, reload })`; `FootMatchDetailPage`/`FootFinishedView` gain a `ratings` prop.

- [ ] **Step 1: Component**

```jsx
const FOOT_SCORE_OPTIONS = Array.from({ length: 19 }, (_, i) => 1 + i * 0.5);

function FootRatingsTab({ match, lineups, ratings, currentPlayer, isAdmin, reload }) {
  const sheetIds = lineupIdsFor(lineups, match.id);
  const mr = ratings.filter((r) => r.match_id === match.id);
  const progress = ratingProgress(sheetIds, mr);
  const averages = matchAverages(sheetIds, mr);
  const validated = !!match.ratings_validated_at;
  const me = currentPlayer?.id;
  const isVoter = sheetIds.includes(me);
  const hasVoted = progress.doneIds.includes(me);
  const canSeeAverages = validated || isAdmin || (isVoter && hasVoted);
  const mine = Object.fromEntries(mr.filter((r) => r.rater_id === me).map((r) => [r.ratee_id, String(r.score)]));
  const [editing, setEditing] = React.useState(isVoter && !hasVoted && !validated);
  const [scores, setScores] = React.useState(mine);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const nameOf = (id) => { const p = PLAYERS.find((x) => x.id === id); return p ? getDisplayName(p, PLAYERS) : "?"; };

  async function save() {
    let rows;
    try { rows = buildRatingPayload(match.id, me, sheetIds, scores); } catch (e) { setErr(e.message); return; }
    setBusy(true); setErr(null);
    try {
      assertUpsertOk(await SUPABASE.from("foot_ratings").upsert(rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })), { onConflict: "match_id,rater_id,ratee_id" }));
      const fresh = await sbFetch("foot_ratings", `?match_id=eq.${match.id}&select=rater_id,ratee_id,score`);
      if (ratingProgress(sheetIds, fresh || []).complete) {
        await sbUpdate("foot_matches", { id: match.id }, { ratings_validated_at: new Date().toISOString() });
      }
      setEditing(false);
      await reload();
    } catch (e) { setErr("Erreur: " + e.message); }
    setBusy(false);
  }

  async function forceValidate() {
    if (!window.confirm("Valider les notes maintenant avec les votes déjà faits ?")) return;
    setBusy(true);
    try { await sbUpdate("foot_matches", { id: match.id }, { ratings_validated_at: new Date().toISOString() }); await reload(); }
    catch (e) { setErr("Erreur: " + e.message); }
    setBusy(false);
  }

  const card = { background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 12, padding: 16, marginTop: 16 };
  if (sheetIds.length < 2) return <div style={card}><div style={{ color: "#60607a", fontSize: 13 }}>Pas assez de joueurs sur la feuille de match pour noter.</div></div>;

  const ranked = sheetIds.map((id) => ({ id, avg: averages[id] })).sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 15 }}>Notes du match</div>
        <div style={{ fontSize: 11, color: validated ? "#34d399" : "#60607a", fontWeight: 700 }}>{validated ? "✓ Notes validées" : `${progress.doneIds.length} / ${sheetIds.length} ont voté`}</div>
      </div>

      {editing && (
        <div style={{ marginBottom: 14 }}>
          {sheetIds.filter((id) => id !== me).map((id) => (
            <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #1e1e30" }}>
              <span style={{ fontSize: 13 }}>{nameOf(id)}</span>
              <select value={scores[id] ?? ""} disabled={busy} onChange={(e) => setScores({ ...scores, [id]: e.target.value })} style={{ background: "#13131f", border: "1px solid #1e1e30", borderRadius: 6, color: "#eeeef5", padding: "5px 8px" }}>
                <option value="">—</option>
                {FOOT_SCORE_OPTIONS.map((s) => <option key={s} value={String(s)}>{s.toFixed(1)}</option>)}
              </select>
            </div>
          ))}
          {err && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 8 }}>{err}</div>}
          <button onClick={save} disabled={busy} style={{ width: "100%", marginTop: 10, background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "…" : "Enregistrer mes notes"}</button>
        </div>
      )}

      {!editing && isVoter && !validated && hasVoted && (
        <button onClick={() => { setScores(mine); setEditing(true); }} style={{ background: "none", border: "1px solid #1e1e30", borderRadius: 6, color: "#eeeef5", padding: "4px 10px", cursor: "pointer", fontSize: 12, marginBottom: 10 }}>✏️ Modifier mes notes</button>
      )}

      {canSeeAverages && !editing && ranked.map(({ id, avg }) => (
        <div key={id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13 }}>
          <span>{nameOf(id)}</span>
          <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18 }}>{avg == null ? "—" : avg.toFixed(1)}</span>
        </div>
      ))}
      {!canSeeAverages && !editing && <div style={{ fontSize: 12, color: "#60607a" }}>Les moyennes seront visibles après validation.</div>}

      {!validated && progress.pendingIds.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: "#60607a" }}>Pas encore voté : {progress.pendingIds.map(nameOf).join(" · ")}</div>
      )}

      {isAdmin && !validated && (
        <button onClick={forceValidate} disabled={busy} style={{ width: "100%", marginTop: 12, background: "#13131f", border: "1px solid #1e1e30", borderRadius: 8, color: "#eeeef5", padding: "8px", cursor: "pointer", fontSize: 12 }}>Valider les notes maintenant</button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Tabs on finished matches** — `FootFinishedView` gets `ratings`, `currentPlayer`, and `const [tab, setTab] = React.useState("resume");`. Render above the score card:

```jsx
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {[["resume", "Résumé"], ["notes", "Notes du match"]].map(([id, l]) => (
          <button key={id} onClick={() => setTab(id)} style={{ flex: 1, background: tab === id ? "#3b82f6" : "#13131f", color: tab === id ? "#fff" : "#60607a", border: "1px solid #1e1e30", borderRadius: 8, padding: "8px", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>{l}</button>
        ))}
      </div>
```
Wrap the existing score card + `FootLineupSection` in `{tab === "resume" && (<>…</>)}` and add `{tab === "notes" && <FootRatingsTab match={match} lineups={lineups} ratings={ratings} currentPlayer={currentPlayer} isAdmin={isAdmin} reload={reload} />}`. Thread `ratings` from `FootballApp` → `FootMatchDetailPage` → `FootFinishedView`, and pass `currentPlayer` to `FootFinishedView`.

- [ ] **Step 3: Verify** — build + `npm test`; scratch render of the Notes tab (render `FootRatingsTab` directly) for: voter before voting (form visible, no averages, contains "Enregistrer mes notes"), voter after voting (averages, "Modifier mes notes"), non-sheet non-admin before validation ("visibles après validation", pending list), admin (averages + "Valider les notes maintenant"), validated ("Notes validées", no form, averages), a 1-player sheet ("Pas assez de joueurs").

- [ ] **Step 4: Bump + commit**

```bash
git add foot.jsx foot.js index.html sw.js
git commit -m "feat: football match ratings tab with auto and admin validation"
```

---

### Task 5: Stats filters, Note stat and "Mon évolution"

**Files:** Modify `foot.jsx`.

**Interfaces:** Consumes `seasonOf`, `seasonsFromMatches`, `filterMatchesForStats`, `statsRoster`, `buildStatsRows`, `playerRatingSeries`, `averageRating`, extended `statValue`/`formatStatValue`. Produces `FootStatsPage({ matches, lineups, events, ratings, roster, currentPlayer })`, `FootRatingChart({ series })`.

- [ ] **Step 1: Chart**

```jsx
function FootRatingChart({ series }) {
  const [hover, setHover] = React.useState(null);
  if (series.length < 2) return <div style={{ color: "#60607a", fontSize: 13 }}>Il faut au moins 2 matchs notés pour afficher l'évolution.</div>;
  const W = 320, H = 150, L = 24, R = 10, T = 12, B = 22;
  const x = (i) => L + (i * (W - L - R)) / (series.length - 1);
  const y = (v) => T + ((10 - v) * (H - T - B)) / 9;
  const pts = series.map((s, i) => `${x(i)},${y(s.rating)}`).join(" ");
  const label = series.map((s) => `${s.opponent} ${s.rating.toFixed(1)}`).join(", ");
  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label={`Notes des derniers matchs : ${label}`}>
        {[2, 4, 6, 8, 10].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#1e1e30" strokeWidth="1" />
            <text x={L - 6} y={y(v) + 3} fontSize="8" fill="#60607a" textAnchor="end">{v}</text>
          </g>
        ))}
        <polyline points={pts} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />
        {series.map((s, i) => (
          <g key={s.matchId} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(hover === i ? null : i)}>
            <circle cx={x(i)} cy={y(s.rating)} r="12" fill="transparent" />
            <circle cx={x(i)} cy={y(s.rating)} r={hover === i ? 5 : 4} fill="#3b82f6" stroke="#0d0d1c" strokeWidth="2" />
            <title>{`${s.opponent} : ${s.rating.toFixed(1)}`}</title>
          </g>
        ))}
      </svg>
      {hover != null && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, textAlign: "center", fontSize: 12, color: "#eeeef5" }}>
          vs {series[hover].opponent} · <b>{series[hover].rating.toFixed(1)}</b> · {new Date(series[hover].date).toLocaleDateString("fr-FR")}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Stats page** — replace `FootStatsPage` signature with `({ matches, lineups, events, ratings, roster, currentPlayer })` and:
  - add `{ key: "rating", label: "Note", title: "Note" }` to `FOOT_STAT_COLUMNS` (last), widen the grid to `repeat(8, 52px)` and `minWidth: 580`;
  - state: `season` (read `foot_stats_season`, default `seasonOf(new Date().toISOString())`), `type` (read `foot_stats_type`, default `"all"`), each with a setter that writes `localStorage` in try/catch;
  - compute:

```jsx
  const seasons = seasonsFromMatches(matches);
  const current = seasonOf(new Date().toISOString());
  const seasonOptions = [...new Set([current, ...seasons])];
  const filtered = filterMatchesForStats(matches, { season, type });
  const population = statsRoster(roster);
  const ratingBy = Object.fromEntries(population.map((id) => [id, averageRating(playerRatingSeries(filtered, ratings, lineups, id))]));
  const rows = buildStatsRows(population, computePlayerStats(filtered, lineups, events), ratingBy);
  const pool = rows.filter((r) => r.played > 0);
  const ratingPool = rows.filter((r) => r.rating != null);
  const ranks = Object.fromEntries(FOOT_STAT_COLUMNS.map((c) => [c.key, rankPlayers(c.key === "rating" ? ratingPool : pool, c.key, mode)]));
  const me = rows.find((r) => r.playerId === currentPlayer?.id);
  const series = currentPlayer ? playerRatingSeries(filtered, ratings, lineups, currentPlayer.id).slice(-10) : [];
```
  - tiles: `me` drives values (rank shown only if the player is in that key's pool, else "—"); "Mes matchs" tiles become `["played","wins","draws","losses","rating"]`;
  - message: if `!me` → "Les statistiques concernent l'effectif régulier et occasionnel."; else if `me.played === 0` → "Pas encore de match terminé sur une feuille de match.";
  - table sort: rows with `statValue(...) == null` always last, otherwise the existing comparator with name tie-break;
  - filter row above the toggle:

```jsx
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={season} onChange={(e) => setSeason(e.target.value)} style={FOOT_SELECT_STYLE}>
            {seasonOptions.map((s) => <option key={s} value={s}>Saison {s}</option>)}
            <option value="all">Toutes les saisons</option>
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} style={FOOT_SELECT_STYLE}>
            <option value="all">Tous les matchs</option>
            <option value="championnat">Championnat</option>
            <option value="amical">Amical</option>
          </select>
        </div>
        <div style={{ display: "flex", borderRadius: 8, overflow: "hidden" }}>{toggleBtn("abs", "Valeurs")}{toggleBtn("pct", "%")}</div>
      </div>
```
  with `const FOOT_SELECT_STYLE = { background: "#13131f", border: "1px solid #1e1e30", borderRadius: 8, color: "#eeeef5", padding: "6px 10px", fontSize: 12 };`
  - after "Mes stats offensives", a card titled "Mon évolution" containing `<FootRatingChart series={series} />`.
  - `FootballApp` passes `ratings` and `roster` to `FootStatsPage`.

- [ ] **Step 3: Verify** — build + `npm test`; scratch render: invité who played is absent from table; a reg/occ player with 0 match appears with zeros and "—"; sorting by rating keeps null-rating rows last (call the comparator via rendering with `sortKey` state forced by clicking — or render twice with `localStorage` not involved and assert order using a helper `sortStatsRows(rows, key, dir, mode, nameOf)` extracted from the component); empty season shows zeros, no NaN, chart message; chart renders `<polyline` with ≥ 2 rated matches. Open the chart in Chrome (local dev server or prod) and look at it for label collisions.

Ruling allowed during execution: if testing the null-last sort requires it, extract `sortStatsRows` into `foot-logic.js` with a unit test.

- [ ] **Step 4: Bump + commit**

```bash
git add foot.jsx foot.js foot-logic.js foot-logic.test.js index.html sw.js
git commit -m "feat: football stats filters, Note stat and rating evolution chart"
```

---

### Task 6: Release and verification

- [ ] **Step 1:** `npm test` green, `node --check` on all JS.
- [ ] **Step 2:** Ask the user before `git push origin main`; wait for Vercel `● Ready`.
- [ ] **Step 3:** Chrome on leverculsec.com, read-only on real data: match card badge, invité presence hidden (if one exists), Notes tab on the finished match (the user's own state), Stats filters, Note column, Mon évolution message/chart; no console errors. Do not submit votes or validate ratings unless the user says so.
