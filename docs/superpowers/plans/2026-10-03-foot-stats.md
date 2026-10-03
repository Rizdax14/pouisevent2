# Football Match Sheets & Statistics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real match sheet (`foot_lineups`) to football matches and build the Statistics page (personal cards with per-stat ranks, sortable team table, `Valeurs | %` toggle).

**Architecture:** One new Supabase table with a backfill migration. All stat math lives in pure functions in `foot-logic.js` (unit-tested with `node:test`); `foot.jsx` only wires data and renders. Lineup consistency (scorers/assisters auto-added) is enforced at write time in the two places goals are written.

**Tech Stack:** React 18 UMD + Babel build (`npm run build`), Supabase REST via existing `sbFetch`/`sbInsert`/`sbUpdate`/`SUPABASE` globals, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-03-foot-stats-design.md`

## Global Constraints

- Only matches with `status === "finished"` count in statistics.
- `foot_lineups.player_id` is `integer` (matches `players.id`); `match_id` is `bigint`; both FKs `on delete cascade`; PK `(match_id, player_id)`.
- Ranking: competition ranking (1, 2, 2, 4); descending for every stat except `losses` (ascending).
- `pct` mode: wins/draws/losses → % of `played` (0–100); goals/assists/decisive → per-match average; `played` stays raw.
- Rank denominator = number of players with `played ≥ 1`.
- The `Valeurs | %` choice is stored in `localStorage` key `foot_stats_mode` (`"abs"` | `"pct"`), read inside try/catch.
- Every task that edits `foot.jsx`/`foot-logic.js` ends with `npm run build` and a bump of the `?v=` on both `foot-logic.js` and `foot.js` in `index.html` plus `CACHE_VERSION` in `sw.js` (same fresh `YYYYMMDDHHMMSS` value).
- Supabase-js `upsert` results go through `assertUpsertOk`. French UI copy. Admin = `currentPlayer?.uid === ADMIN_UID`.

## Review Focus

- **Logged-in player has no finished match on a sheet** → cards show "—" and a message, no crash, no "NaN%". (Task 4: render check)
- **A finished match with 0 goals on both sides** → counts as a draw for everyone on the sheet. (Task 2: unit test)
- **Unchecking a player from the sheet who scored in that match** → allowed; their goal still counts in goals but the match no longer counts as played (spec: goals counted on matches where… — see ruling in Task 2 test). (Task 2: unit test pins "goals only counted when on the sheet")
- **`pct` mode for a player with 0 played** → never happens in the table (pool is `played ≥ 1`), but `statValue` must return 0, not NaN. (Task 2: unit test)
- **Sorting the table by a column with ties** → stable, secondary order by player name. (Task 4: render check of sort order)

Note on the third line: the spec says goals are counted "sur les matchs terminés où il est buteur". Because Task 3 auto-adds scorers to the sheet on every goal write, the only way to get a scorer off the sheet is a deliberate admin uncheck. We count goals **only for matches where the player is on the sheet**, so stats stay internally consistent (goals ≤ what you can earn in matches you played). The unit test pins this.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `supabase/migrations/20261003230000_foot_lineups.sql` | create | `foot_lineups` table + backfill |
| `foot-logic.js` | modify | `computePlayerStats`, `statValue`, `rankPlayers`, `formatRank`, `formatStatValue`, `missingLineupPlayers`, `diffLineup` |
| `foot-logic.test.js` | modify | tests for the above |
| `foot.jsx` / `foot.js` | modify | lineup loading, checklist at start, lineup section on detail page, auto-add on goal writes, `FootStatsPage` |
| `index.html`, `sw.js` | modify | cache-busting versions |

---

### Task 1: `foot_lineups` table, backfill, and loading

**Files:**
- Create: `supabase/migrations/20261003230000_foot_lineups.sql`
- Modify: `foot.jsx` (`FootballApp`: state + `reloadFoot`)

**Interfaces:**
- Produces: table `foot_lineups(match_id bigint, player_id integer, added_at timestamptz)`; `FootballApp` state `lineups` (array of `{match_id, player_id}`), passed down as a `lineups` prop by later tasks.

- [ ] **Step 1: Write the migration**

```sql
create table if not exists foot_lineups (
  match_id bigint not null references foot_matches(id) on delete cascade,
  player_id integer not null references players(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

insert into foot_lineups (match_id, player_id)
select m.id, src.player_id
from foot_matches m
join (
  select match_id, player_id from foot_attendance where status = 'present'
  union
  select match_id, player_id from foot_match_events where player_id is not null
  union
  select match_id, assist_player_id from foot_match_events where assist_player_id is not null
) src on src.match_id = m.id
where m.status = 'finished'
  and not exists (select 1 from foot_lineups l where l.match_id = m.id)
on conflict do nothing;
```

- [ ] **Step 2: Apply and verify**

Run: `supabase db push --password '<db password>'`
Expected: applies `20261003230000_foot_lineups.sql`.
Run: `curl -s "https://daerxouhvmvqhirgyrjr.supabase.co/rest/v1/foot_lineups?select=*" -H "apikey: $ANON_KEY"`
Expected: rows for existing finished match(es) (match 2 → players 116 and 59), not an error.

- [ ] **Step 3: Load lineups in `FootballApp`**

Add `const [lineups, setLineups] = React.useState([]);` and extend `reloadFoot`:

```jsx
    const [r, m, a, e, l] = await Promise.all([
      sbFetch("foot_roster", "?select=*"),
      sbFetch("foot_matches", "?select=*&order=match_datetime"),
      sbFetch("foot_attendance", "?select=*"),
      sbFetch("foot_match_events", "?select=*"),
      sbFetch("foot_lineups", "?select=match_id,player_id"),
    ]);
    setRoster(r || []);
    setMatches(m || []);
    setAttendance(a || []);
    setEvents(e || []);
    setLineups(l || []);
```

- [ ] **Step 4: Build, bump versions, commit**

```bash
npm run build && node --check foot.js
git add supabase/migrations/20261003230000_foot_lineups.sql foot.jsx foot.js index.html sw.js
git commit -m "feat: add football match sheets table with backfill and load it"
```

---

### Task 2: Stats and lineup pure logic

**Files:**
- Modify: `foot-logic.js`, `foot-logic.test.js`

**Interfaces:**
- Produces:
  - `computePlayerStats(matches, lineups, events) -> Array<{playerId, played, wins, draws, losses, goals, assists, decisive}>` (only players with `played ≥ 1`)
  - `statValue(stat, key, mode) -> number` (`key` ∈ `played|wins|draws|losses|goals|assists|decisive`, `mode` ∈ `abs|pct`)
  - `rankPlayers(statsList, key, mode) -> { [playerId]: { rank, total, tied } }`
  - `formatRank(r) -> string` e.g. `"1er / 13"`, `"2ème ex æquo / 13"`, `"—"` for `undefined`
  - `formatStatValue(value, key, mode) -> string` (`abs`: integer; `pct` wins/draws/losses: `"66.7%"`; `pct` goals/assists/decisive: `"0.75"`; `played`: integer)
  - `missingLineupPlayers(lineupPlayerIds, payload) -> number[]` (scorer/assister ids not yet on the sheet)
  - `diffLineup(currentIds, wantedIds) -> { add: number[], remove: number[] }`

- [ ] **Step 1: Write failing tests** (append to `foot-logic.test.js`, extend the `require` list with the seven names above)

```js
const M = (id, status) => ({ id, status });
const G = (match_id, player_id, assist_player_id = null) => ({ match_id, type: "goal_bl", player_id, assist_player_id, half: 1, minute: 0, id: Math.random() });
const O = (match_id) => ({ match_id, type: "goal_opponent", player_id: null, assist_player_id: null, half: 1, minute: 0, id: Math.random() });
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
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm test` — Expected: the 11 new tests fail (`... is not a function`), previous 29 still pass.

- [ ] **Step 3: Implement** (in `foot-logic.js`, before the `module.exports` block, and add the seven names to the export list)

```js
const STAT_KEYS_PCT_OF_PLAYED = ["wins", "draws", "losses"];
const STAT_KEYS_PER_MATCH = ["goals", "assists", "decisive"];

function computePlayerStats(matches, lineups, events) {
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
    const st = stats[l.player_id] || (stats[l.player_id] = { playerId: l.player_id, played: 0, wins: 0, draws: 0, losses: 0, goals: 0, assists: 0, decisive: 0 });
    st.played++;
    st[resultByMatch[l.match_id]]++;
  }
  for (const e of events) {
    if (e.type !== "goal_bl" || !finished.has(e.match_id)) continue;
    if (e.player_id && onSheet.has(`${e.match_id}:${e.player_id}`)) stats[e.player_id].goals++;
    if (e.assist_player_id && onSheet.has(`${e.match_id}:${e.assist_player_id}`)) stats[e.assist_player_id].assists++;
  }
  return Object.values(stats).map((s) => ({ ...s, decisive: s.goals + s.assists }));
}

function statValue(stat, key, mode) {
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
```

- [ ] **Step 4: Run and confirm pass**

Run: `npm test` — Expected: 40/40 pass.

- [ ] **Step 5: Commit**

```bash
git add foot-logic.js foot-logic.test.js
git commit -m "feat: football statistics and match-sheet pure logic"
```

---

### Task 3: Match sheet UI and auto-add on goal writes

**Files:**
- Modify: `foot.jsx`

**Interfaces:**
- Consumes: `lineups` state (Task 1), `missingLineupPlayers`, `diffLineup` (Task 2).
- Produces: `addToLineup(matchId, playerIds)`, `saveLineup(matchId, currentIds, wantedIds)` helpers; `FootLineupChecklist({ roster, extraIds, checked, onToggle, disabled })`; `FootLineupSection({ match, roster, lineups, isAdmin, reload })`. `FootMatchDetailPage`, `FootLiveView`, `FootFinishedView`, `FootLiveAdminConsole`, `FootEventTimeline`, `FootStartMatchConfig` gain a `lineups` prop (and `attendance` for the start config).

- [ ] **Step 1: Helpers** (next to `setMatchAttendance`)

```jsx
async function addToLineup(matchId, playerIds) {
  if (!playerIds.length) return;
  assertUpsertOk(await SUPABASE.from("foot_lineups").upsert(
    playerIds.map((player_id) => ({ match_id: matchId, player_id })),
    { onConflict: "match_id,player_id", ignoreDuplicates: true }
  ));
}

async function saveLineup(matchId, currentIds, wantedIds) {
  const { add, remove } = diffLineup(currentIds, wantedIds);
  await addToLineup(matchId, add);
  if (remove.length) {
    await sbFetch("foot_lineups", `?match_id=eq.${matchId}&player_id=in.(${remove.join(",")})`, { method: "DELETE" });
  }
}

function lineupIdsFor(lineups, matchId) {
  return lineups.filter((l) => l.match_id === matchId).map((l) => l.player_id);
}
```

- [ ] **Step 2: Checklist component**

```jsx
function FootLineupChecklist({ roster, extraIds, checked, onToggle, disabled }) {
  const ids = [...new Set([...roster.map((r) => r.player_id), ...(extraIds || [])])];
  const players = ids.map((id) => PLAYERS.find((p) => p.id === id)).filter(Boolean)
    .sort((a, b) => (getDisplayName(a, PLAYERS) || "").localeCompare(getDisplayName(b, PLAYERS) || ""));
  if (players.length === 0) return <div style={{ color: "#60607a", fontSize: 13 }}>Aucun joueur dans l'effectif.</div>;
  return (
    <div>
      {players.map((p) => (
        <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 13, cursor: disabled ? "default" : "pointer" }}>
          <input type="checkbox" checked={checked.includes(p.id)} disabled={disabled} onChange={() => onToggle(p.id)} />
          {getDisplayName(p, PLAYERS)}
        </label>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Start config writes the sheet**

`FootStartMatchConfig({ match, roster, attendance, reload, onCancel })`:
```jsx
  const presentIds = attendance.filter((a) => a.match_id === match.id && a.status === "present").map((a) => a.player_id);
  const [sheet, setSheet] = React.useState(presentIds.filter((id) => roster.some((r) => r.player_id === id)));
  const toggle = (id) => setSheet(sheet.includes(id) ? sheet.filter((x) => x !== id) : [...sheet, id]);
```
In `start()`, before `sbUpdate(...)`: `await addToLineup(match.id, sheet);`
Render, between the duration input and the buttons:
```jsx
        <label style={{ fontSize: 12, color: "#60607a" }}>Feuille de match ({sheet.length})</label>
        <div style={{ margin: "6px 0 18px" }}>
          <FootLineupChecklist roster={roster} checked={sheet} onToggle={toggle} disabled={saving} />
        </div>
```
Update the call site in `FootMatchDetailPage`: `<FootStartMatchConfig match={match} roster={roster} attendance={attendance} reload={reload} onCancel={...} />`.

- [ ] **Step 4: Lineup section on the detail page (live + finished)**

```jsx
function FootLineupSection({ match, roster, lineups, isAdmin, reload }) {
  const current = lineupIdsFor(lineups, match.id);
  const [editing, setEditing] = React.useState(false);
  const [wanted, setWanted] = React.useState(current);
  const [saving, setSaving] = React.useState(false);
  const toggle = (id) => setWanted(wanted.includes(id) ? wanted.filter((x) => x !== id) : [...wanted, id]);

  async function save() {
    setSaving(true);
    try { await saveLineup(match.id, current, wanted); await reload(); setEditing(false); }
    catch (e) { console.warn("lineup save failed", e); }
    setSaving(false);
  }

  const names = current.map((id) => PLAYERS.find((p) => p.id === id)).filter(Boolean).map((p) => getDisplayName(p, PLAYERS));
  return (
    <div style={{ background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 12, padding: 16, marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 14 }}>Feuille de match ({current.length})</div>
        {isAdmin && !editing && <button onClick={() => { setWanted(current); setEditing(true); }} style={{ background: "none", border: "1px solid #1e1e30", borderRadius: 6, color: "#eeeef5", padding: "4px 10px", cursor: "pointer", fontSize: 12 }}>✏️ Modifier</button>}
      </div>
      {!editing && (names.length ? <div style={{ fontSize: 13, color: "#cccce0" }}>{names.join(" · ")}</div> : <div style={{ fontSize: 13, color: "#60607a" }}>Personne sur la feuille.</div>)}
      {editing && (
        <>
          <FootLineupChecklist roster={roster} extraIds={current} checked={wanted} onToggle={toggle} disabled={saving} />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={() => setEditing(false)} disabled={saving} style={{ flex: 1, background: "#13131f", border: "1px solid #1e1e30", borderRadius: 6, color: "#eeeef5", padding: "8px", cursor: "pointer" }}>Annuler</button>
            <button onClick={save} disabled={saving} style={{ flex: 1, background: "#3b82f6", color: "#fff", border: "none", borderRadius: 6, padding: "8px", fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "…" : "Enregistrer"}</button>
          </div>
        </>
      )}
    </div>
  );
}
```
Render `<FootLineupSection match={match} roster={roster} lineups={lineups} isAdmin={isAdmin} reload={reload} />` at the bottom of `FootLiveView` and `FootFinishedView` (both receive `lineups`). Thread `lineups` from `FootballApp` → `FootMatchDetailPage` → both views.

- [ ] **Step 5: Auto-add scorer/assister on goal writes**

In `FootLiveAdminConsole.logGoal`, after `sbInsert(...)`:
```jsx
      await addToLineup(match.id, missingLineupPlayers(lineupIdsFor(lineups, match.id), { type, player_id: playerId, assist_player_id: assistId }));
```
In `FootEventTimeline.saveEvent`, after the insert/update:
```jsx
    await addToLineup(match.id, missingLineupPlayers(lineupIdsFor(lineups, match.id), payload));
```
Both components receive `lineups` as a prop from their parents.

- [ ] **Step 6: Build, verify, commit**

```bash
npm run build && node --check foot.js && npm test
```
Run the scratch render check (Task 4 Step 4 extends it) on live/finished detail pages for admin and non-admin: the "Feuille de match" section renders; the ✏️ button only for admin.
```bash
git add foot.jsx foot.js index.html sw.js
git commit -m "feat: football match sheet at kickoff, editable afterwards, auto-filled by goals"
```

---

### Task 4: Statistics page

**Files:**
- Modify: `foot.jsx`

**Interfaces:**
- Consumes: `computePlayerStats`, `statValue`, `rankPlayers`, `formatRank`, `formatStatValue` (Task 2); `lineups` (Task 1).
- Produces: `FootStatsPage({ matches, lineups, events, currentPlayer })` rendered for `page === "stats"`.

- [ ] **Step 1: Implement**

```jsx
const FOOT_STAT_COLUMNS = [
  { key: "played", label: "MJ", title: "Joués" },
  { key: "wins", label: "V", title: "Victoires" },
  { key: "draws", label: "N", title: "Nuls" },
  { key: "losses", label: "D", title: "Défaites" },
  { key: "goals", label: "Buts", title: "Buts" },
  { key: "assists", label: "PD", title: "Passes D" },
  { key: "decisive", label: "Déc.", title: "Décisifs" },
];

function readStatsMode() {
  try { return localStorage.getItem("foot_stats_mode") === "pct" ? "pct" : "abs"; } catch (e) { return "abs"; }
}

function FootStatTile({ title, value, rank }) {
  return (
    <div style={{ flex: "1 1 70px", background: "#13131f", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 10, color: "#60607a", textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</div>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 10, color: "#3b82f6" }}>{rank}</div>
    </div>
  );
}

function FootStatsPage({ matches, lineups, events, currentPlayer }) {
  const [mode, setModeState] = React.useState(readStatsMode);
  const [sortKey, setSortKey] = React.useState("played");
  const [sortDir, setSortDir] = React.useState(-1);
  const setMode = (m) => { setModeState(m); try { localStorage.setItem("foot_stats_mode", m); } catch (e) {} };

  const stats = computePlayerStats(matches, lineups, events);
  const me = stats.find((s) => s.playerId === currentPlayer?.id);
  const ranks = Object.fromEntries(FOOT_STAT_COLUMNS.map((c) => [c.key, rankPlayers(stats, c.key, mode)]));
  const nameOf = (id) => { const p = PLAYERS.find((x) => x.id === id); return p ? getDisplayName(p, PLAYERS) : "?"; };

  function tilesFor(keys) {
    return keys.map((k) => {
      const col = FOOT_STAT_COLUMNS.find((c) => c.key === k);
      return <FootStatTile key={k} title={col.title} value={me ? formatStatValue(statValue(me, k, mode), k, mode) : "—"} rank={me ? formatRank(ranks[k][me.playerId]) : "—"} />;
    });
  }

  function clickHeader(key) {
    if (key === sortKey) setSortDir(-sortDir); else { setSortKey(key); setSortDir(-1); }
  }

  const rows = [...stats].sort((a, b) => {
    const d = (statValue(a, sortKey, mode) - statValue(b, sortKey, mode)) * sortDir;
    return d !== 0 ? d : nameOf(a.playerId).localeCompare(nameOf(b.playerId));
  });

  const card = { background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 12, padding: 16, marginBottom: 14 };
  const toggleBtn = (m, label) => (
    <button onClick={() => setMode(m)} style={{ background: mode === m ? "#3b82f6" : "#13131f", color: mode === m ? "#fff" : "#60607a", border: "1px solid #1e1e30", padding: "6px 14px", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>{label}</button>
  );
  const grid = "minmax(110px,1fr) repeat(7, 52px)";

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <div style={{ display: "flex", borderRadius: 8, overflow: "hidden" }}>{toggleBtn("abs", "Valeurs")}{toggleBtn("pct", "%")}</div>
      </div>

      {!me && <div style={{ color: "#60607a", fontSize: 13, marginBottom: 10 }}>Pas encore de match terminé sur une feuille de match.</div>}

      <div style={card}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 15, marginBottom: 10 }}>Mes matchs</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{tilesFor(["played", "wins", "draws", "losses"])}</div>
      </div>
      <div style={card}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 15, marginBottom: 10 }}>Mes stats offensives</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{tilesFor(["goals", "assists", "decisive"])}</div>
      </div>

      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        <div style={{ minWidth: 520 }}>
          <div style={{ display: "grid", gridTemplateColumns: grid, gap: 4, padding: "9px 14px", background: "#13131f", borderBottom: "1px solid #1e1e30", fontSize: 10, color: "#60607a", textTransform: "uppercase" }}>
            <span>Joueur</span>
            {FOOT_STAT_COLUMNS.map((c) => (
              <span key={c.key} onClick={() => clickHeader(c.key)} style={{ textAlign: "center", cursor: "pointer", userSelect: "none", color: sortKey === c.key ? "#3b82f6" : "#60607a" }}>
                {c.label}{sortKey === c.key ? (sortDir === -1 ? " ▼" : " ▲") : ""}
              </span>
            ))}
          </div>
          {rows.length === 0 && <div style={{ padding: 16, color: "#60607a", fontSize: 13 }}>Aucune statistique pour l'instant.</div>}
          {rows.map((s) => (
            <div key={s.playerId} style={{ display: "grid", gridTemplateColumns: grid, gap: 4, padding: "9px 14px", borderBottom: "1px solid #1e1e30", fontSize: 13, alignItems: "center", background: s.playerId === currentPlayer?.id ? "#3b82f61a" : "transparent" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nameOf(s.playerId)}</span>
              {FOOT_STAT_COLUMNS.map((c) => <span key={c.key} style={{ textAlign: "center" }}>{formatStatValue(statValue(s, c.key, mode), c.key, mode)}</span>)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```
In `FootballApp`, replace the stats placeholder: `{page === "stats" && <FootStatsPage matches={matches} lineups={lineups} events={events} currentPlayer={currentPlayer} />}`.

- [ ] **Step 2: Build and unit tests**

Run: `npm run build && node --check foot.js && npm test` — Expected: build OK, 40/40.

- [ ] **Step 3: Bump versions** (`index.html` foot-logic/foot `?v=`, `sw.js` `CACHE_VERSION`).

- [ ] **Step 4: Render check (scratch, not committed)**

Extend the scratch `render.js` with: `FootStatsPage` for (a) a player with stats — assert markup contains `"Mes matchs"`, a `"1er / "` or `"ème / "` rank, the player's name in the table; (b) a player with no finished match — assert `"Pas encore de match terminé"` and no `"NaN"`; (c) `pct` mode via `localStorage` stub returning `"pct"` — assert a `%` value appears and no `"NaN"`. Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add foot.jsx foot.js index.html sw.js
git commit -m "feat: football statistics page with personal ranks, % toggle and sortable table"
```

---

### Task 5: Release and real-browser verification

**Files:** none new.

- [ ] **Step 1:** `npm test` (40/40) and `node --check` on all four JS files.
- [ ] **Step 2:** Ask the user to confirm the push, then `git push origin main`; wait for `vercel ls pouisevent3` → newest Production deployment `● Ready`.
- [ ] **Step 3: Chrome walkthrough on https://leverculsec.com** (logged in as admin, Football section), never clicking anything that opens a `window.confirm` dialog:
  1. Open the finished match "En Avant Guinguette" → "Feuille de match" section lists the backfilled players.
  2. Statistiques tab → cards show values and ranks for the logged-in player (or the "Pas encore…" message if they are not on a sheet); table lists the players on sheets.
  3. Click the `%` toggle → V/N/D become percentages, goals become averages; reload the page → still `%`.
  4. Click "Buts" header twice → ▼ then ▲ and row order flips.
  5. `read_console_messages` with `onlyErrors: true` → no errors.
- [ ] **Step 4:** Report results to the user with screenshots of the Statistics page.
