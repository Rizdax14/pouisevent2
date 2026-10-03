# Football Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Foot" module to the Pouis Events / Bière Leverculsec app: match admin (create + roster), a calendar with presence tracking, and a live match engine (halves, chrono, goals/assists), wired into the existing menu.

**Architecture:** The new module lives in its own JSX source file (`foot.jsx`), compiled to plain JS (`foot.js`) the same way the existing `utopia-events.jsx` → `utopia-events.js` pair works, and loaded via an extra `<script>` tag after `utopia-events.js` so it shares the same global scope (`PLAYERS`, `ADMIN_UID`, `useIsMobile`, `BackBtn`, `getDisplayName`, `sbFetch`, `sbInsert`, `sbUpdate`, `SUPABASE`). Pure score/attendance/chrono logic is split into a small standalone file (`foot-logic.js`) with no framework dependency, so it can be unit-tested with Node's built-in test runner instead of only being verifiable by clicking through the browser.

**Tech Stack:** Plain React 18 (global UMD build, no bundler), Supabase REST (via the existing `sbFetch`/`sbInsert`/`sbUpdate`/`SUPABASE` helpers), Babel CLI (dev-only, to compile JSX → JS), Node's built-in `node:test` runner.

**Spec:** `docs/superpowers/specs/2026-10-03-foot-module-design.md`

## Global Constraints

- Keep the existing "no bundler, shared global scope via `<script>` tags" architecture — do not introduce webpack/vite/ESM imports.
- Admin-only actions are gated by `currentPlayer?.uid === ADMIN_UID` (the existing constant, currently `"louis-mar"`) — do not invent a second admin concept.
- The live chrono is for the admin's screen only; everyone else sees state as of their last page load/refresh (no Supabase Realtime in this plan — confirmed in the spec).
- The score is never stored as a column — it is always derived by counting `foot_match_events` rows (`computeFootScore`). Never add a `score_bl`/`score_opponent` column to `foot_matches`.
- Any task that edits `utopia-events.jsx`, `foot.jsx`, or `foot-logic.js` must, as its last step, run `npm run build` and bump that file's `?v=` query string in `index.html` to a fresh value (use the current UTC timestamp as `YYYYMMDDHHMMSS`), so a returning visitor's service worker fetches the new content instead of a cached copy.
- No new npm runtime dependencies for the shipped site — Babel and `serve` are dev-only tools that never reach `index.html`.
- French UI copy throughout (matches the rest of the app).

## Review Focus

- **Player not on the Foot roster opens a match.** They must see read-only match info, never a self-attendance toggle for themselves. (Task 9)
- **Admin double-clicks "Commencer le match" or "Terminer la mi-temps".** The button must disable itself immediately on click so a double network request can't push `current_half` past `nb_halves` or re-run the start transition on an already-live match. (Tasks 10, 11)
- **A non-admin player's page still shows `status:'live'` from before an admin action (stale state after a refresh at the wrong moment).** The live admin console must never render for a non-admin, strictly checked by `isAdmin`, not merely hidden by layout. (Task 11)
- **The Foot roster is empty** (no players assigned yet) when a match already exists. The attendance 3-column view and the admin roster manager must render an explicit "Aucun joueur dans l'effectif" message instead of crashing on an empty array. (Tasks 8, 9)
- **`nb_halves` equals `current_half` when "Terminer la mi-temps" is clicked.** `nextHalfState` must return `{type:'finish'}`, not try to advance to a non-existent half. (Task 3, exercised again in Task 11)

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `package.json` | new | Dev tooling: Babel (JSX→JS build) + `serve` (local dev server) + `node --test` |
| `.gitignore` | modify | Add `node_modules` |
| `supabase/migrations/20261003120000_foot_module.sql` | new | The 4 new tables |
| `foot-logic.js` | new | Pure, framework-free logic: score calc, attendance buckets, chrono math, timeline sort, half transition. Unit-tested. |
| `foot-logic.test.js` | new | `node:test` unit tests for the above |
| `foot.jsx` | new | All Football module React components (source) |
| `foot.js` | generated | Compiled output of `foot.jsx`, actually loaded by `index.html` — never hand-edited |
| `utopia-events.jsx` | modify | Flip the "Football" menu card to active, wire `App()`'s section router to `FootballApp` |
| `utopia-events.js` | generated | Rebuilt from `utopia-events.jsx` after each edit — never hand-edited |
| `index.html` | modify | New `<script>` tags for `foot-logic.js`/`foot.js`, version bumps |

---

### Task 1: Build tooling

**Files:**
- Create: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `npm run build` (compiles `utopia-events.jsx` and `foot.jsx` to their `.js` counterparts via Babel), `npm run dev` (static file server on port 3000), `npm test` (runs `node --test`)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "pouisevent2-build",
  "private": true,
  "scripts": {
    "build": "babel utopia-events.jsx --presets @babel/preset-react -o utopia-events.js && babel foot.jsx --presets @babel/preset-react -o foot.js",
    "dev": "serve -l 3000",
    "test": "node --test"
  },
  "devDependencies": {
    "@babel/cli": "^7.25.0",
    "@babel/core": "^7.25.0",
    "@babel/preset-react": "^7.24.0",
    "serve": "^14.2.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: completes with no errors, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 3: Ignore `node_modules`**

Add a line to `.gitignore`:
```
node_modules
```

- [ ] **Step 4: Verify the build round-trips the existing file unchanged in behavior**

Run: `npm run build`
Expected: no errors; `utopia-events.js` is rewritten (it will look different — recompiled, not re-minified by hand — that's expected and fine).

- [ ] **Step 5: Manually verify the app still works after the rebuild**

Run: `npm run dev`, open `http://localhost:3000` in a browser.
Expected: the login screen loads, you can log in, the Menu/Events/O2026/Rankings/Teams pages all still work exactly as before. This is the regression check for the build pipeline itself — if anything here breaks, the Babel output differs from the original in a way that matters, and must be fixed before continuing.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore utopia-events.js
git commit -m "chore: add Babel build tooling for JSX source files"
```

---

### Task 2: Supabase migration — Foot tables

**Files:**
- Create: `supabase/migrations/20261003120000_foot_module.sql`

**Interfaces:**
- Produces: tables `foot_roster`, `foot_matches`, `foot_attendance`, `foot_match_events` — exact columns consumed by Tasks 3, 6-12.

- [ ] **Step 1: Check the `players.id` column type**

Open the Supabase dashboard (Table Editor → `players` → check the `id` column type), or run `supabase db diff --schema public` if you have DB credentials configured. The migration below assumes `bigint`. If `players.id` is actually `integer`, change every `bigint references players(id)` below to `integer references players(id)` before applying.

- [ ] **Step 2: Write the migration**

```sql
-- supabase/migrations/20261003120000_foot_module.sql

create table if not exists foot_roster (
  player_id bigint primary key references players(id) on delete cascade,
  role text not null check (role in ('regulier','occasionnel','invite')),
  added_at timestamptz not null default now()
);

create table if not exists foot_matches (
  id bigint generated always as identity primary key,
  opponent_name text not null,
  match_datetime timestamptz not null,
  address text,
  postal_code text,
  city text,
  status text not null default 'scheduled' check (status in ('scheduled','live','finished')),
  nb_halves int check (nb_halves between 1 and 4),
  half_duration_min int,
  current_half int,
  half_started_at timestamptz,
  half_elapsed_seconds int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists foot_attendance (
  match_id bigint not null references foot_matches(id) on delete cascade,
  player_id bigint not null references players(id) on delete cascade,
  status text not null check (status in ('present','absent')),
  responded_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

create table if not exists foot_match_events (
  id bigint generated always as identity primary key,
  match_id bigint not null references foot_matches(id) on delete cascade,
  half int not null,
  minute int not null,
  type text not null check (type in ('goal_bl','goal_opponent')),
  player_id bigint references players(id),
  assist_player_id bigint references players(id),
  created_at timestamptz not null default now()
);

create index if not exists foot_match_events_match_id_idx on foot_match_events(match_id);
create index if not exists foot_attendance_match_id_idx on foot_attendance(match_id);
```

- [ ] **Step 3: Apply the migration**

Run: `supabase db push`
Expected: the CLI lists `20261003120000_foot_module.sql` as a pending migration and applies it with no errors.

- [ ] **Step 4: Verify the tables exist via the REST API**

Run (replace `$ANON_KEY` with the value of `SUPABASE_KEY` from `utopia-events.jsx`):
```bash
curl -s "https://daerxouhvmvqhirgyrjr.supabase.co/rest/v1/foot_matches?select=*" -H "apikey: $ANON_KEY"
```
Expected: `[]` (HTTP 200, empty array) — not a "relation does not exist" error.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261003120000_foot_module.sql
git commit -m "feat: add Supabase tables for the football module"
```

---

### Task 3: Pure logic helpers (`foot-logic.js`)

**Files:**
- Create: `foot-logic.js`
- Test: `foot-logic.test.js`

**Interfaces:**
- Produces: `computeFootScore(events) -> {bl, opponent}`, `computeAttendanceBuckets(roster, attendanceRows) -> {present, absent, noResponse}` (each an array of `player_id`), `computeHalfElapsedSeconds(halfStartedAt, halfElapsedSeconds, now) -> number`, `buildEventTimeline(events) -> events[]` (sorted), `nextHalfState(currentHalf, nbHalves) -> {type:'next', half} | {type:'finish'}`. Consumed by `foot.jsx` in Tasks 11-12.

- [ ] **Step 1: Write the failing tests**

```js
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
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './foot-logic.js'`.

- [ ] **Step 3: Implement `foot-logic.js`**

```js
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

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    computeFootScore,
    computeAttendanceBuckets,
    computeHalfElapsedSeconds,
    buildEventTimeline,
    nextHalfState,
  };
}
```

Note on the last `if` block: in Node, `module` is defined, so the functions get exported for the tests. In the browser (loaded via a plain `<script>` tag), `module` is undefined, that block is skipped, and the plain top-level `function` declarations become globals — exactly like every other helper in `utopia-events.jsx` (`getTeam`, `useIsMobile`, etc.).

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add foot-logic.js foot-logic.test.js
git commit -m "feat: add pure scoring/attendance/chrono logic for the football module"
```

---

### Task 4: Entry point wiring (stub)

**Files:**
- Modify: `utopia-events.jsx:6928` (flip the Football card to active)
- Modify: `utopia-events.jsx:8208-8216` (add the `football` case to the Menu's `onSection` handler and add the new section render block)
- Create: `foot.jsx` (just the `FootballApp` stub for now — fleshed out in Task 5)
- Modify: `index.html` (new script tags + version bump)

**Interfaces:**
- Produces: `FootballApp({currentPlayer, onBack})` — rendered by `App()` when `section==="football"`. Fleshed out (not replaced) in Task 5.

- [ ] **Step 1: Flip the Football card to active**

In `utopia-events.jsx` line 6928, change:
```js
    {id:"football",label:"Football",icon:"⚽",desc:"Bientôt disponible",color:"#60607a",active:false},
```
to:
```js
    {id:"football",label:"Football",icon:"⚽",desc:"Matchs & effectif",color:"#3b82f6",active:true},
```

- [ ] **Step 2: Wire the Menu's `onSection` handler**

In `utopia-events.jsx`, in the `if(section==="menu") return(...)` block (around line 8209), change:
```js
      else if(s==="games"){setSection("games");}
```
to:
```js
      else if(s==="games"){setSection("games");}
      else if(s==="football"){setSection("football");}
```

- [ ] **Step 3: Add the Football section render block**

Immediately after the `if(section==="games") return(...);` block (ends around line 8231 in the current file), add:
```js
  // Football section
  if(section==="football") return(
    <FootballApp currentPlayer={currentPlayer} onBack={()=>setSection("menu")}/>
  );
```

- [ ] **Step 4: Create the `FootballApp` stub in `foot.jsx`**

```jsx
// foot.jsx
function FootballApp({ currentPlayer, onBack }) {
  return (
    <div style={{ minHeight: "100vh", background: "#080810", color: "#eeeef5", fontFamily: "'Outfit',sans-serif", padding: 24 }}>
      <button onClick={onBack} style={{ background: "none", border: "1px solid #1e1e30", borderRadius: 8, color: "#eeeef5", padding: "8px 14px", cursor: "pointer" }}>
        ← Retour au menu
      </button>
      <div style={{ marginTop: 40, textAlign: "center", color: "#60607a" }}>Module Football — en construction</div>
    </div>
  );
}
```

- [ ] **Step 5: Add script tags to `index.html`**

In `index.html`, right after the existing `<script src="utopia-events.js?v=...">` line, add:
```html
  <script src="foot-logic.js?v=20261003120000"></script>
  <script src="foot.js?v=20261003120000"></script>
```
(These must load *after* `utopia-events.js` — `foot.jsx` references globals like `useIsMobile` and `ADMIN_UID` that `utopia-events.js` defines — and *before* the inline service-worker-registration `<script>` block at the bottom.)

- [ ] **Step 6: Rebuild and bump the `utopia-events.js` version**

Run: `npm run build`. In `index.html`, change the existing `utopia-events.js?v=20260520105101` to `utopia-events.js?v=20261003120000` (same fresh timestamp used for the two new files above, for simplicity).

- [ ] **Step 7: Manually verify**

Run: `npm run dev`, open `http://localhost:3000`, log in, click the "Football" card on the menu.
Expected: it now opens (no longer greyed out/locked), shows "Module Football — en construction", and "← Retour au menu" takes you back to the Menu.

- [ ] **Step 8: Commit**

```bash
git add utopia-events.jsx utopia-events.js foot.jsx foot.js index.html
git commit -m "feat: wire the football section into the app menu (stub page)"
```

---

### Task 5: `FootballApp` shell — navbar, data loading, placeholder pages

**Files:**
- Modify: `foot.jsx` (replace the Task 4 stub)

**Interfaces:**
- Consumes: `sbFetch(table, params, opts)` (global, from `utopia-events.jsx`), `PLAYERS` (global array), `ADMIN_UID` (global), `useIsMobile()` (global)
- Produces: `FootballApp` now owns `page`/`sub`/`roster`/`matches`/`attendance`/`events` state and a `reloadFoot()` function that later tasks' write-handlers call after every insert/update. `FootballNavBar({page, setPage, onBack, isAdmin})`.

- [ ] **Step 1: Replace the stub with the full shell**

```jsx
// foot.jsx

function FootballNavBar({ page, setPage, onBack, isAdmin }) {
  const m = useIsMobile();
  const items = [
    { id: "__back__", l: "Accueil", ic: "🏠", onClick: onBack },
    { id: "calendar", l: "Calendrier", ic: "📅" },
    { id: "rankings", l: "Classement", ic: "🏆" },
    { id: "stats", l: "Statistiques", ic: "📊" },
    ...(isAdmin ? [{ id: "admin", l: "Admin", ic: "🛠" }] : []),
  ];
  const wrapStyle = m
    ? { position: "fixed", bottom: 0, left: 0, right: 0, background: "#0d0d1c", borderTop: "1px solid #1e1e30", display: "flex", zIndex: 100, paddingBottom: "env(safe-area-inset-bottom)" }
    : { background: "#0d0d1c", borderBottom: "1px solid #1e1e30", padding: "0 32px", display: "flex", gap: 0, position: "sticky", top: 0, zIndex: 100 };
  return (
    <nav style={wrapStyle}>
      {items.map((item) => {
        const active = page === item.id;
        return (
          <button
            key={item.id}
            onClick={() => (item.onClick ? item.onClick() : setPage(item.id))}
            style={{
              flex: m ? 1 : "none", background: "none", border: "none", cursor: "pointer",
              padding: m ? "10px 4px 8px" : "16px 14px",
              display: "flex", flexDirection: m ? "column" : "row", alignItems: "center", gap: m ? 3 : 6,
              color: active ? "#3b82f6" : "#60607a", fontFamily: "'Outfit',sans-serif", fontSize: m ? 9 : 13, fontWeight: 600,
              borderBottom: !m && active ? "2px solid #3b82f6" : !m ? "2px solid transparent" : "none",
            }}
          >
            <span style={{ fontSize: m ? 18 : 15 }}>{item.ic}</span>
            <span style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>{item.l}</span>
          </button>
        );
      })}
    </nav>
  );
}

function FootPlaceholderPage({ label }) {
  return (
    <div style={{ padding: 40, textAlign: "center", color: "#60607a" }}>
      <div style={{ fontSize: 15 }}>{label}</div>
      <div style={{ fontSize: 11, marginTop: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>🔒 Bientôt disponible</div>
    </div>
  );
}

function FootballApp({ currentPlayer, onBack }) {
  const [page, setPage] = React.useState("calendar");
  const [sub, setSub] = React.useState({});
  const [loaded, setLoaded] = React.useState(false);
  const [roster, setRoster] = React.useState([]);
  const [matches, setMatches] = React.useState([]);
  const [attendance, setAttendance] = React.useState([]);
  const [events, setEvents] = React.useState([]);

  const isAdmin = currentPlayer?.uid === ADMIN_UID;

  async function reloadFoot() {
    const [r, m, a, e] = await Promise.all([
      sbFetch("foot_roster", "?select=*"),
      sbFetch("foot_matches", "?select=*&order=match_datetime"),
      sbFetch("foot_attendance", "?select=*"),
      sbFetch("foot_match_events", "?select=*"),
    ]);
    setRoster(r || []);
    setMatches(m || []);
    setAttendance(a || []);
    setEvents(e || []);
  }

  React.useEffect(() => {
    reloadFoot().then(() => setLoaded(true)).catch((err) => { console.warn("foot load failed", err); setLoaded(true); });
  }, []);

  function nav(p, s = {}) { setPage(p); setSub(s); }

  if (!loaded) {
    return <div style={{ minHeight: "100vh", background: "#080810", color: "#60607a", display: "flex", alignItems: "center", justifyContent: "center" }}>Chargement…</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#080810", color: "#eeeef5", fontFamily: "'Outfit',sans-serif", paddingBottom: 70 }}>
      <FootballNavBar page={page} setPage={nav} onBack={onBack} isAdmin={isAdmin} />
      {page === "calendar" && <FootPlaceholderPage label="Calendrier — Task 7" />}
      {page === "matchDetail" && <FootPlaceholderPage label="Détail du match — Tasks 9-12" />}
      {page === "admin" && isAdmin && <FootPlaceholderPage label="Admin — Tasks 6, 8" />}
      {page === "rankings" && <FootPlaceholderPage label="Classement" />}
      {page === "stats" && <FootPlaceholderPage label="Statistiques" />}
    </div>
  );
}
```

- [ ] **Step 2: Rebuild and bump versions**

Run: `npm run build`. In `index.html`, bump `foot.js?v=...` (and `foot-logic.js?v=...` if it changed — it didn't this task, but keep both in sync for simplicity) to a fresh timestamp.

- [ ] **Step 3: Manually verify**

Open the app, go to Football. Expected: the 4-5 tabs render (Admin only because you're logged in as the admin), clicking each switches the placeholder text, "Accueil" still returns to the Menu, and no console errors about failed Supabase fetches (empty arrays are fine — the tables are empty at this point).

- [ ] **Step 4: Commit**

```bash
git add foot.jsx foot.js index.html
git commit -m "feat: football navbar, data loading, and placeholder pages"
```

---

### Task 6: Admin — create match form

**Files:**
- Modify: `foot.jsx` (add `FootCreateMatchForm`, render it from the Admin page)

**Interfaces:**
- Consumes: `sbInsert(table, data)` (global)
- Produces: `FootCreateMatchForm({ reload })` — a self-contained form; `FootAdminPage({ roster, reload })` created now (roster management added in Task 8), rendered instead of the Task 5 Admin placeholder.

- [ ] **Step 1: Implement the form and the Admin page shell**

```jsx
// foot.jsx — add below FootPlaceholderPage

function FootCreateMatchForm({ reload }) {
  const [opponentName, setOpponentName] = React.useState("");
  const [matchDatetime, setMatchDatetime] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [postalCode, setPostalCode] = React.useState("");
  const [city, setCity] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState(null);

  async function submit() {
    if (!opponentName.trim() || !matchDatetime) {
      setMsg({ t: "error", m: "Adversaire et date/heure sont obligatoires." });
      return;
    }
    setSaving(true);
    try {
      await sbInsert("foot_matches", {
        opponent_name: opponentName.trim(),
        match_datetime: new Date(matchDatetime).toISOString(),
        address: address.trim() || null,
        postal_code: postalCode.trim() || null,
        city: city.trim() || null,
      });
      setOpponentName(""); setMatchDatetime(""); setAddress(""); setPostalCode(""); setCity("");
      setMsg({ t: "success", m: "Match créé ✓" });
      await reload();
    } catch (e) {
      setMsg({ t: "error", m: "Erreur: " + e.message });
    }
    setSaving(false);
  }

  const inputStyle = { width: "100%", background: "#13131f", border: "1px solid #1e1e30", borderRadius: 8, padding: "9px 12px", color: "#eeeef5", fontSize: 13, marginBottom: 10 };

  return (
    <div style={{ background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 12, padding: 18, marginBottom: 20 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, marginBottom: 12 }}>Créer un match</div>
      <input style={inputStyle} placeholder="Nom de l'équipe adverse" value={opponentName} onChange={(e) => setOpponentName(e.target.value)} />
      <input style={inputStyle} type="datetime-local" value={matchDatetime} onChange={(e) => setMatchDatetime(e.target.value)} />
      <input style={inputStyle} placeholder="Adresse" value={address} onChange={(e) => setAddress(e.target.value)} />
      <input style={inputStyle} placeholder="Code postal" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
      <input style={inputStyle} placeholder="Ville" value={city} onChange={(e) => setCity(e.target.value)} />
      {msg && <div style={{ color: msg.t === "error" ? "#ef4444" : "#34d399", fontSize: 12, marginBottom: 10 }}>{msg.m}</div>}
      <button onClick={submit} disabled={saving} style={{ background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
        {saving ? "Création…" : "Créer le match"}
      </button>
    </div>
  );
}

function FootAdminPage({ roster, reload }) {
  return (
    <div style={{ padding: 20 }}>
      <FootCreateMatchForm reload={reload} />
    </div>
  );
}
```

- [ ] **Step 2: Render `FootAdminPage` instead of the placeholder**

In `FootballApp`'s render, replace:
```jsx
      {page === "admin" && isAdmin && <FootPlaceholderPage label="Admin — Tasks 6, 8" />}
```
with:
```jsx
      {page === "admin" && isAdmin && <FootAdminPage roster={roster} reload={reloadFoot} />}
```

- [ ] **Step 3: Rebuild, bump version, verify manually**

Run: `npm run build`, bump `foot.js?v=...` in `index.html`.
Open the app → Football → Admin. Create a match with a future date. Expected: success message, form clears. Confirm it landed in Supabase:
```bash
curl -s "https://daerxouhvmvqhirgyrjr.supabase.co/rest/v1/foot_matches?select=*" -H "apikey: $ANON_KEY"
```
should now return one row.

- [ ] **Step 4: Commit**

```bash
git add foot.jsx foot.js index.html
git commit -m "feat: admin can create football matches"
```

---

### Task 7: Calendar page

**Files:**
- Modify: `foot.jsx` (add `FootMatchCard`, `FootCalendarPage`)

**Interfaces:**
- Consumes: `computeFootScore` (from `foot-logic.js`, already loaded as a global script before `foot.js`)
- Produces: `FootCalendarPage({ matches, events, roster, attendance, nav })`, rendered instead of the Task 5 Calendar placeholder. `nav("matchDetail", {matchId})` is how cards open detail (consumed by Task 9).

- [ ] **Step 1: Implement**

```jsx
// foot.jsx

function FootMatchCard({ match, score, presentCount, rosterSize, onClick }) {
  const dt = new Date(match.match_datetime);
  const dateLabel = dt.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) + " · " + dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const statusLabel = match.status === "scheduled" ? "À venir" : match.status === "live" ? "En cours" : "Terminé";
  const statusColor = match.status === "scheduled" ? "#60607a" : match.status === "live" ? "#ef4444" : "#34d399";
  return (
    <div onClick={onClick} style={{ background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 12, padding: 16, marginBottom: 10, cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16 }}>Bière Leverculsec vs {match.opponent_name}</div>
        <div style={{ fontSize: 10, color: statusColor, textTransform: "uppercase", fontWeight: 700 }}>{statusLabel}</div>
      </div>
      <div style={{ fontSize: 12, color: "#60607a", marginBottom: 4 }}>{dateLabel}</div>
      {match.city && <div style={{ fontSize: 12, color: "#60607a" }}>{match.city}</div>}
      {match.status !== "scheduled" && <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, marginTop: 6 }}>{score.bl} — {score.opponent}</div>}
      {match.status === "scheduled" && <div style={{ fontSize: 12, color: "#60607a", marginTop: 6 }}>{presentCount}/{rosterSize} présents</div>}
    </div>
  );
}

function FootCalendarPage({ matches, events, roster, attendance, nav }) {
  if (matches.length === 0) {
    return <div style={{ padding: 40, textAlign: "center", color: "#60607a" }}>Aucun match pour l'instant.</div>;
  }
  return (
    <div style={{ padding: 16 }}>
      {matches.map((match) => {
        const matchEvents = events.filter((e) => e.match_id === match.id);
        const score = computeFootScore(matchEvents);
        const presentCount = attendance.filter((a) => a.match_id === match.id && a.status === "present").length;
        return (
          <FootMatchCard
            key={match.id}
            match={match}
            score={score}
            presentCount={presentCount}
            rosterSize={roster.length}
            onClick={() => nav("matchDetail", { matchId: match.id })}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Wire it up**

In `FootballApp`'s render, replace:
```jsx
      {page === "calendar" && <FootPlaceholderPage label="Calendrier — Task 7" />}
```
with:
```jsx
      {page === "calendar" && <FootCalendarPage matches={matches} events={events} roster={roster} attendance={attendance} nav={nav} />}
```

- [ ] **Step 3: Rebuild, bump version, verify manually**

Expected: the match created in Task 6 shows up as a card, "À venir", with "0/0 présents" (roster is still empty — that's Task 8). Clicking it currently lands on the Task 5 "Détail du match" placeholder (expected — Task 9 replaces it).

- [ ] **Step 4: Commit**

```bash
git add foot.jsx foot.js index.html
git commit -m "feat: football calendar lists matches chronologically"
```

---

### Task 8: Admin — roster management

**Files:**
- Modify: `foot.jsx` (add `FootRosterManager`, render it in `FootAdminPage`)

**Interfaces:**
- Consumes: `PLAYERS` (global), `getDisplayName(player, allPlayers)` (global), `SUPABASE.from(table).upsert(data, {onConflict})` (global)
- Produces: nothing new consumed by later tasks beyond the `foot_roster` rows it writes.

- [ ] **Step 1: Implement**

```jsx
// foot.jsx

function FootRosterManager({ roster, reload }) {
  const [saving, setSaving] = React.useState(null); // player id currently being saved

  const roleByPlayer = {};
  roster.forEach((r) => { roleByPlayer[r.player_id] = r.role; });

  async function setRole(playerId, role) {
    setSaving(playerId);
    try {
      if (role === "") {
        await sbFetch("foot_roster", `?player_id=eq.${playerId}`, { method: "DELETE" });
      } else {
        await SUPABASE.from("foot_roster").upsert({ player_id: playerId, role }, { onConflict: "player_id" });
      }
      await reload();
    } catch (e) {
      console.warn("roster update failed", e);
    }
    setSaving(null);
  }

  const sortedPlayers = [...PLAYERS].sort((a, b) => (getDisplayName(a, PLAYERS) || "").localeCompare(getDisplayName(b, PLAYERS) || ""));

  if (sortedPlayers.length === 0) {
    return <div style={{ color: "#60607a", fontSize: 13 }}>Aucun joueur dans l'effectif.</div>;
  }

  return (
    <div style={{ background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 12, padding: 18 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, marginBottom: 12 }}>Effectif</div>
      {sortedPlayers.map((p) => (
        <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1e1e30" }}>
          <div style={{ fontSize: 13 }}>{getDisplayName(p, PLAYERS)}</div>
          <select
            value={roleByPlayer[p.id] || ""}
            disabled={saving === p.id}
            onChange={(e) => setRole(p.id, e.target.value)}
            style={{ background: "#13131f", border: "1px solid #1e1e30", borderRadius: 6, color: "#eeeef5", padding: "5px 8px", fontSize: 12 }}
          >
            <option value="">Pas dans l'équipe</option>
            <option value="regulier">Régulier</option>
            <option value="occasionnel">Occasionnel</option>
            <option value="invite">Invité</option>
          </select>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Render it from `FootAdminPage`**

```jsx
function FootAdminPage({ roster, reload }) {
  return (
    <div style={{ padding: 20 }}>
      <FootCreateMatchForm reload={reload} />
      <FootRosterManager roster={roster} reload={reload} />
    </div>
  );
}
```

- [ ] **Step 3: Rebuild, bump version, verify manually**

Assign a handful of players to Régulier/Occasionnel/Invité. Expected: the dropdown saves immediately (disables while saving), and reloading the Admin page shows the roles persisted. Confirm via:
```bash
curl -s "https://daerxouhvmvqhirgyrjr.supabase.co/rest/v1/foot_roster?select=*" -H "apikey: $ANON_KEY"
```

- [ ] **Step 4: Commit**

```bash
git add foot.jsx foot.js index.html
git commit -m "feat: admin can assign players to the football roster"
```

---

### Task 9: Match detail — scheduled view (attendance)

**Files:**
- Modify: `foot.jsx` (add `FootBackBar`, `FootScheduledView`, `FootMatchDetailPage`)

**Interfaces:**
- Consumes: `computeAttendanceBuckets` (from `foot-logic.js`), `getDisplayName`, `SUPABASE.from(...).upsert(...)`, `BackBtn` (global — reuse if its styling fits; otherwise a local back link is fine, see Step 1)
- Produces: `FootMatchDetailPage({ matchId, matches, roster, attendance, events, currentPlayer, isAdmin, navBack, reload })`, rendered instead of the Task 5 "Détail du match" placeholder. Branches on `match.status`; Task 9 implements the `'scheduled'` branch, Tasks 10-12 add the rest in the same function.

- [ ] **Step 1: Implement the scheduled view**

```jsx
// foot.jsx

function FootScheduledView({ match, roster, attendance, currentPlayer, isAdmin, reload, onStartMatch }) {
  const matchAttendance = attendance.filter((a) => a.match_id === match.id);
  const buckets = computeAttendanceBuckets(roster, matchAttendance);
  const isOnRoster = roster.some((r) => r.player_id === currentPlayer?.id);
  const myStatus = matchAttendance.find((a) => a.player_id === currentPlayer?.id)?.status || null;
  const [saving, setSaving] = React.useState(false);

  async function setMyStatus(status) {
    setSaving(true);
    try {
      await SUPABASE.from("foot_attendance").upsert(
        { match_id: match.id, player_id: currentPlayer.id, status },
        { onConflict: "match_id,player_id" }
      );
      await reload();
    } catch (e) {
      console.warn("attendance update failed", e);
    }
    setSaving(false);
  }

  function nameOf(playerId) {
    const p = PLAYERS.find((pl) => pl.id === playerId);
    return p ? getDisplayName(p, PLAYERS) : "?";
  }

  const dt = new Date(match.match_datetime);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18 }}>Bière Leverculsec vs {match.opponent_name}</div>
        <div style={{ fontSize: 12, color: "#60607a", marginTop: 4 }}>{dt.toLocaleString("fr-FR")}</div>
        {match.address && <div style={{ fontSize: 12, color: "#60607a" }}>{match.address}, {match.postal_code} {match.city}</div>}
      </div>

      {isOnRoster && (
        <div style={{ marginBottom: 16, display: "flex", gap: 10 }}>
          <button onClick={() => setMyStatus("present")} disabled={saving} style={{ flex: 1, background: myStatus === "present" ? "#34d399" : "#13131f", color: myStatus === "present" ? "#080810" : "#eeeef5", border: "1px solid #1e1e30", borderRadius: 8, padding: "10px", cursor: "pointer", fontWeight: 700 }}>
            Présent
          </button>
          <button onClick={() => setMyStatus("absent")} disabled={saving} style={{ flex: 1, background: myStatus === "absent" ? "#ef4444" : "#13131f", color: myStatus === "absent" ? "#080810" : "#eeeef5", border: "1px solid #1e1e30", borderRadius: 8, padding: "10px", cursor: "pointer", fontWeight: 700 }}>
            Absent
          </button>
        </div>
      )}

      {roster.length === 0 ? (
        <div style={{ color: "#60607a", fontSize: 13, marginBottom: 16 }}>Aucun joueur dans l'effectif.</div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          {[["Présents", buckets.present, "#34d399"], ["N'a pas répondu", buckets.noResponse, "#60607a"], ["Absents", buckets.absent, "#ef4444"]].map(([label, ids, color]) => (
            <div key={label} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>{label} ({ids.length})</div>
              {ids.map((id) => <div key={id} style={{ fontSize: 13, padding: "3px 0" }}>{nameOf(id)}</div>)}
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        <button onClick={onStartMatch} style={{ width: "100%", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontWeight: 700, cursor: "pointer" }}>
          COMMENCER LE MATCH
        </button>
      )}
    </div>
  );
}

function FootMatchDetailPage({ matchId, matches, roster, attendance, events, currentPlayer, isAdmin, navBack, reload }) {
  const match = matches.find((m) => m.id === matchId);
  const [startingConfig, setStartingConfig] = React.useState(false);

  if (!match) return <div style={{ padding: 20, color: "#60607a" }}>Match introuvable.</div>;

  return (
    <div>
      <div style={{ padding: "12px 20px 0" }}>
        <button onClick={navBack} style={{ background: "none", border: "1px solid #1e1e30", borderRadius: 8, color: "#eeeef5", padding: "6px 12px", cursor: "pointer", fontSize: 12 }}>← Retour</button>
      </div>
      {match.status === "scheduled" && !startingConfig && (
        <FootScheduledView match={match} roster={roster} attendance={attendance} currentPlayer={currentPlayer} isAdmin={isAdmin} reload={reload} onStartMatch={() => setStartingConfig(true)} />
      )}
      {match.status === "scheduled" && startingConfig && (
        <FootStartMatchConfig match={match} reload={reload} onCancel={() => setStartingConfig(false)} />
      )}
      {match.status === "live" && (
        <FootLiveView match={match} roster={roster} events={events} currentPlayer={currentPlayer} isAdmin={isAdmin} reload={reload} />
      )}
      {match.status === "finished" && (
        <FootFinishedView match={match} events={events} />
      )}
    </div>
  );
}
```

Note: `FootStartMatchConfig`, `FootLiveView`, and `FootFinishedView` are referenced here but implemented in Tasks 10, 11, and 12 respectively. That's expected — Task 9's manual test below only exercises the `scheduled` branch.

- [ ] **Step 2: Wire it up**

In `FootballApp`'s render, replace:
```jsx
      {page === "matchDetail" && <FootPlaceholderPage label="Détail du match — Tasks 9-12" />}
```
with:
```jsx
      {page === "matchDetail" && (
        <FootMatchDetailPage
          matchId={sub.matchId}
          matches={matches}
          roster={roster}
          attendance={attendance}
          events={events}
          currentPlayer={currentPlayer}
          isAdmin={isAdmin}
          navBack={() => nav("calendar")}
          reload={reloadFoot}
        />
      )}
```

- [ ] **Step 3: Rebuild, bump version, verify manually (this task will not fully run yet)**

This task's code references `FootStartMatchConfig` and `FootLiveView`/`FootFinishedView`, which don't exist until Tasks 10-12. Add temporary one-line stubs so the app doesn't crash before those tasks land:
```jsx
function FootStartMatchConfig() { return <div style={{ padding: 20, color: "#60607a" }}>Task 10</div>; }
function FootLiveView() { return <div style={{ padding: 20, color: "#60607a" }}>Task 11</div>; }
function FootFinishedView() { return <div style={{ padding: 20, color: "#60607a" }}>Task 12</div>; }
```
(Remove each stub in the task that actually implements it.)

Run the build, then from the Calendar click into the match you created. Expected: "← Retour" works, your own name shows a Présent/Absent toggle if you've been added to the roster (Task 8), and the 3-column list reflects it. Log in as a different player (or check with `currentPlayer` temporarily set to someone not on the roster) to confirm the Présent/Absent toggle is hidden for a non-roster player, and the 3-column list still renders correctly with an empty roster if you temporarily clear it.

- [ ] **Step 4: Commit**

```bash
git add foot.jsx foot.js index.html
git commit -m "feat: football match detail page with attendance tracking"
```

---

### Task 10: Admin — start match config

**Files:**
- Modify: `foot.jsx` (implement `FootStartMatchConfig` for real, remove its Task 9 stub)

**Interfaces:**
- Consumes: `sbUpdate(table, matchObj, data)` (global)
- Produces: transitions a match from `scheduled` to `live` with `nb_halves`, `half_duration_min`, `current_half:1`, `half_started_at:null`, `half_elapsed_seconds:0`. Consumed by Task 11 (the live console reads these columns).

- [ ] **Step 1: Remove the Task 9 stub**

Delete:
```jsx
function FootStartMatchConfig() { return <div style={{ padding: 20, color: "#60607a" }}>Task 10</div>; }
```

- [ ] **Step 2: Implement it**

```jsx
// foot.jsx

function FootStartMatchConfig({ match, reload, onCancel }) {
  const [nbHalves, setNbHalves] = React.useState(2);
  const [halfDuration, setHalfDuration] = React.useState(45);
  const [saving, setSaving] = React.useState(false);

  async function start() {
    setSaving(true);
    try {
      await sbUpdate("foot_matches", { id: match.id }, {
        status: "live",
        nb_halves: nbHalves,
        half_duration_min: halfDuration,
        current_half: 1,
        half_started_at: null,
        half_elapsed_seconds: 0,
      });
      await reload();
    } catch (e) {
      console.warn("start match failed", e);
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 12, padding: 18 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, marginBottom: 14 }}>Configuration du match</div>
        <label style={{ fontSize: 12, color: "#60607a" }}>Nombre de mi-temps</label>
        <select value={nbHalves} onChange={(e) => setNbHalves(Number(e.target.value))} style={{ display: "block", width: "100%", background: "#13131f", border: "1px solid #1e1e30", borderRadius: 8, color: "#eeeef5", padding: "9px 12px", marginTop: 4, marginBottom: 14 }}>
          {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <label style={{ fontSize: 12, color: "#60607a" }}>Durée par mi-temps (minutes)</label>
        <input type="number" min={1} value={halfDuration} onChange={(e) => setHalfDuration(Number(e.target.value))} style={{ display: "block", width: "100%", background: "#13131f", border: "1px solid #1e1e30", borderRadius: 8, color: "#eeeef5", padding: "9px 12px", marginTop: 4, marginBottom: 18 }} />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} disabled={saving} style={{ flex: 1, background: "#13131f", border: "1px solid #1e1e30", borderRadius: 8, color: "#eeeef5", padding: "10px", cursor: "pointer" }}>Annuler</button>
          <button onClick={start} disabled={saving} style={{ flex: 1, background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Démarrage…" : "Démarrer le match"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

The `disabled={saving}` on the "Démarrer le match" button, combined with `setSaving(true)` being the very first line of `start()`, is the double-click guard called out in Review Focus — a second click before the first request resolves is a no-op because the button is already disabled.

- [ ] **Step 3: Rebuild, bump version, verify manually**

From a scheduled match's detail page, click "COMMENCER LE MATCH", pick 2 mi-temps / 45 min, click "Démarrer le match". Expected: no crash (it'll render the Task 9 `FootLiveView` stub, "Task 11", since that's still a placeholder), and in Supabase the match row now shows `status:'live', nb_halves:2, half_duration_min:45, current_half:1`.

- [ ] **Step 4: Commit**

```bash
git add foot.jsx foot.js index.html
git commit -m "feat: admin can configure and start a football match"
```

---

### Task 11: Live match console

**Files:**
- Modify: `foot.jsx` (implement `FootLiveView` for real, remove its Task 9 stub)

**Interfaces:**
- Consumes: `computeFootScore`, `computeHalfElapsedSeconds`, `buildEventTimeline`, `nextHalfState` (all from `foot-logic.js`), `sbInsert`, `sbUpdate`
- Produces: inserts into `foot_match_events`, advances/finishes `foot_matches.current_half`/`status`. The score and timeline this renders are read again, read-only, by Task 12's `FootFinishedView` and by `FootCalendarPage` (Task 7) — same `computeFootScore`/`buildEventTimeline` calls, so they will always agree.

- [ ] **Step 1: Remove the Task 9 stub**

Delete:
```jsx
function FootLiveView() { return <div style={{ padding: 20, color: "#60607a" }}>Task 11</div>; }
```

- [ ] **Step 2: Implement the read-only part (score + timeline, shown to everyone)**

```jsx
// foot.jsx

function FootEventTimeline({ events }) {
  const sorted = buildEventTimeline(events);
  if (sorted.length === 0) return <div style={{ color: "#60607a", fontSize: 13 }}>Aucun but pour l'instant.</div>;
  return (
    <div>
      {sorted.map((e) => {
        const scorer = e.player_id ? PLAYERS.find((p) => p.id === e.player_id) : null;
        const assist = e.assist_player_id ? PLAYERS.find((p) => p.id === e.assist_player_id) : null;
        const label = e.type === "goal_bl"
          ? `⚽ ${scorer ? getDisplayName(scorer, PLAYERS) : "?"}${assist ? " (passe D: " + getDisplayName(assist, PLAYERS) + ")" : ""}`
          : `⚽ But adverse`;
        return (
          <div key={e.id} style={{ display: "flex", gap: 10, padding: "5px 0", fontSize: 13 }}>
            <span style={{ color: "#60607a", width: 50 }}>{e.half}e · {e.minute}'</span>
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Implement the admin-only live console**

```jsx
// foot.jsx

function FootGoalPicker({ roster, onConfirm, onCancel, withAssist }) {
  const [playerId, setPlayerId] = React.useState("");
  const [assistId, setAssistId] = React.useState("");
  const options = roster.map((r) => PLAYERS.find((p) => p.id === r.player_id)).filter(Boolean);
  return (
    <div style={{ background: "#13131f", border: "1px solid #1e1e30", borderRadius: 8, padding: 14, marginTop: 10 }}>
      <label style={{ fontSize: 11, color: "#60607a" }}>Buteur</label>
      <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} style={{ display: "block", width: "100%", background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 6, color: "#eeeef5", padding: "7px 10px", marginTop: 4, marginBottom: 10 }}>
        <option value="">— Choisir —</option>
        {options.map((p) => <option key={p.id} value={p.id}>{getDisplayName(p, PLAYERS)}</option>)}
      </select>
      {withAssist && (
        <>
          <label style={{ fontSize: 11, color: "#60607a" }}>Passe décisive (optionnel)</label>
          <select value={assistId} onChange={(e) => setAssistId(e.target.value)} style={{ display: "block", width: "100%", background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 6, color: "#eeeef5", padding: "7px 10px", marginTop: 4, marginBottom: 10 }}>
            <option value="">— Aucune —</option>
            {options.filter((p) => String(p.id) !== playerId).map((p) => <option key={p.id} value={p.id}>{getDisplayName(p, PLAYERS)}</option>)}
          </select>
        </>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button onClick={onCancel} style={{ flex: 1, background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 6, color: "#eeeef5", padding: "8px", cursor: "pointer" }}>Annuler</button>
        <button
          onClick={() => playerId && onConfirm(Number(playerId), assistId ? Number(assistId) : null)}
          disabled={!playerId}
          style={{ flex: 1, background: "#3b82f6", color: "#fff", border: "none", borderRadius: 6, padding: "8px", fontWeight: 700, cursor: playerId ? "pointer" : "default", opacity: playerId ? 1 : 0.5 }}
        >
          Valider
        </button>
      </div>
    </div>
  );
}

function FootLiveAdminConsole({ match, roster, events, reload }) {
  const [now, setNow] = React.useState(Date.now());
  const [picking, setPicking] = React.useState(null); // null | "bl" | "opponent"
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedSeconds = computeHalfElapsedSeconds(match.half_started_at, match.half_elapsed_seconds, now);
  const minutesElapsed = Math.floor(elapsedSeconds / 60);
  const running = !!match.half_started_at;

  async function logGoal(type, playerId, assistId) {
    setBusy(true);
    try {
      await sbInsert("foot_match_events", {
        match_id: match.id,
        half: match.current_half,
        minute: minutesElapsed,
        type,
        player_id: playerId,
        assist_player_id: assistId,
      });
      setPicking(null);
      await reload();
    } catch (e) {
      console.warn("log goal failed", e);
    }
    setBusy(false);
  }

  async function startHalf() {
    setBusy(true);
    try {
      await sbUpdate("foot_matches", { id: match.id }, { half_started_at: new Date().toISOString() });
      await reload();
    } catch (e) { console.warn(e); }
    setBusy(false);
  }

  async function endHalf() {
    setBusy(true);
    try {
      const frozenElapsed = computeHalfElapsedSeconds(match.half_started_at, match.half_elapsed_seconds, Date.now());
      const next = nextHalfState(match.current_half, match.nb_halves);
      if (next.type === "next") {
        await sbUpdate("foot_matches", { id: match.id }, {
          half_elapsed_seconds: 0,
          half_started_at: null,
          current_half: next.half,
        });
      } else {
        await sbUpdate("foot_matches", { id: match.id }, {
          half_elapsed_seconds: frozenElapsed,
          half_started_at: null,
        });
      }
      await reload();
    } catch (e) { console.warn(e); }
    setBusy(false);
  }

  async function closeMatch() {
    setBusy(true);
    try {
      await sbUpdate("foot_matches", { id: match.id }, { status: "finished", half_started_at: null });
      await reload();
    } catch (e) { console.warn(e); setBusy(false); }
  }

  const isLastHalf = match.current_half >= match.nb_halves;

  return (
    <div style={{ background: "#0d0d1c", border: "1px solid #3b82f655", borderRadius: 12, padding: 16, marginTop: 16 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 14, color: "#3b82f6" }}>CONSOLE ADMIN — Mi-temps {match.current_half}/{match.nb_halves}</div>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, margin: "8px 0" }}>{String(minutesElapsed).padStart(2, "0")}:{String(elapsedSeconds % 60).padStart(2, "0")}</div>

      {!running && <button onClick={startHalf} disabled={busy} style={{ width: "100%", background: "#34d399", color: "#080810", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, cursor: "pointer", marginBottom: 10 }}>▶ Démarrer la mi-temps</button>}

      {running && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button onClick={() => setPicking("bl")} disabled={busy} style={{ flex: 1, background: "#13131f", border: "1px solid #1e1e30", borderRadius: 8, color: "#eeeef5", padding: "10px", cursor: "pointer" }}>⚽ But Bière Leverculsec</button>
            <button onClick={() => logGoal("goal_opponent", null, null)} disabled={busy} style={{ flex: 1, background: "#13131f", border: "1px solid #1e1e30", borderRadius: 8, color: "#eeeef5", padding: "10px", cursor: "pointer" }}>⚽ But adverse</button>
          </div>
          {picking === "bl" && (
            <FootGoalPicker roster={roster} withAssist onCancel={() => setPicking(null)} onConfirm={(playerId, assistId) => logGoal("goal_bl", playerId, assistId)} />
          )}
          <button onClick={endHalf} disabled={busy} style={{ width: "100%", background: "#1e1e30", color: "#eeeef5", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, cursor: "pointer", marginTop: 10 }}>
            {isLastHalf ? "🏁 Fin de la dernière mi-temps" : "⏸ Terminer la mi-temps"}
          </button>
        </>
      )}

      {!running && isLastHalf && match.half_elapsed_seconds > 0 && (
        <button onClick={closeMatch} disabled={busy} style={{ width: "100%", background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, cursor: "pointer" }}>🏁 Clôturer le match</button>
      )}
    </div>
  );
}

function FootLiveView({ match, roster, events, currentPlayer, isAdmin, reload }) {
  const matchEvents = events.filter((e) => e.match_id === match.id);
  const score = computeFootScore(matchEvents);
  return (
    <div style={{ padding: 20 }}>
      <div style={{ background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 12, padding: 16 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18 }}>Bière Leverculsec vs {match.opponent_name}</div>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, margin: "10px 0" }}>{score.bl} — {score.opponent}</div>
        <FootEventTimeline events={matchEvents} />
      </div>
      {isAdmin && <FootLiveAdminConsole match={match} roster={roster} events={matchEvents} reload={reload} />}
    </div>
  );
}
```

`FootLiveAdminConsole` is only ever rendered from inside `{isAdmin && ...}` in `FootLiveView` above — a non-admin's render tree never reaches it, which satisfies the Review Focus item about the console never leaking to non-admins regardless of stale `match.status`.

- [ ] **Step 4: Rebuild, bump version, verify manually — full match playthrough**

From the match started in Task 10: start mi-temps 1, log 2 "But Bière Leverculsec" (one with an assist, one without), log 1 "But adverse", click "Terminer la mi-temps" (expected: moves to "Mi-temps 2/2", chrono resets, button changes to "▶ Démarrer la mi-temps"), start mi-temps 2, log 1 more BL goal, click "Fin de la dernière mi-temps" (expected: button changes to "🏁 Clôturer le match"), click it. Expected throughout: score updates immediately after each goal, timeline lists every goal with the right half/minute/scorer/assist, and double-clicking any action button does nothing extra (each button disables itself via `busy`/the per-form `saving` state during its own request).

- [ ] **Step 5: Commit**

```bash
git add foot.jsx foot.js index.html
git commit -m "feat: live football match console with chrono, goals, and assists"
```

---

### Task 12: Match detail — finished view

**Files:**
- Modify: `foot.jsx` (implement `FootFinishedView` for real, remove its Task 9 stub)

**Interfaces:**
- Consumes: `computeFootScore`, `FootEventTimeline` (from Task 11)

- [ ] **Step 1: Remove the Task 9 stub**

Delete:
```jsx
function FootFinishedView() { return <div style={{ padding: 20, color: "#60607a" }}>Task 12</div>; }
```

- [ ] **Step 2: Implement it**

```jsx
// foot.jsx

function FootFinishedView({ match, events }) {
  const matchEvents = events.filter((e) => e.match_id === match.id);
  const score = computeFootScore(matchEvents);
  return (
    <div style={{ padding: 20 }}>
      <div style={{ background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 12, padding: 16 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18 }}>Bière Leverculsec vs {match.opponent_name}</div>
        <div style={{ fontSize: 10, color: "#34d399", textTransform: "uppercase", fontWeight: 700, marginTop: 4 }}>Terminé</div>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, margin: "10px 0" }}>{score.bl} — {score.opponent}</div>
        <FootEventTimeline events={matchEvents} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Rebuild, bump version, verify manually**

Open the match closed at the end of Task 11. Expected: shows "Terminé", the correct final score, and the full goal timeline — matching exactly what the live view showed right before closing (same `computeFootScore`/`FootEventTimeline` calls, so this is guaranteed, but confirm visually anyway). Also check the Calendar page: this match's card should now show "Terminé" with the same score.

- [ ] **Step 4: Commit**

```bash
git add foot.jsx foot.js index.html
git commit -m "feat: finished football match view with final score and timeline"
```

---

### Task 13: Final integration pass

**Files:**
- Modify: `index.html` (final version bump for all three touched script files, if any task above left them mismatched)

**Interfaces:** none new — this task is a regression pass, not new functionality.

- [ ] **Step 1: Full rebuild**

Run: `npm run build`

- [ ] **Step 2: Confirm all three cache-busting versions match the latest build**

In `index.html`, confirm `utopia-events.js?v=...`, `foot-logic.js?v=...`, and `foot.js?v=...` all carry the same, current timestamp. Bump any that were missed in earlier tasks.

- [ ] **Step 3: Full manual regression (the spec's testing checklist)**

Run: `npm run dev`, open `http://localhost:3000` in a private/incognito window (avoids any stale service worker from earlier testing). Walk through the entire flow end to end on a fresh match:
1. Log in, go to Menu → Football.
2. Admin → create a new match.
3. Admin → assign at least 3 players to the roster (mix of régulier/occasionnel/invité).
4. Calendar → open the new match → mark yourself Présent, confirm the 3-column list updates.
5. Admin starts the match (2 mi-temps, 1 minute each, to keep the test fast) and plays it through both halves with a mix of BL goals (with and without assists) and opponent goals.
6. Close the match. Confirm the Calendar card and the match detail page show the same final score and timeline.
7. Also verify the rest of the app still works (Menu → Events/O2026/Teams/Profil) — this module should not have broken anything outside `section==="football"`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "chore: final cache-busting version sync for the football module"
```

- [ ] **Step 5: Deploy**

Push to the branch tracked by the linked Vercel project (`pouisevent3` / `leverculsec.com`) once the user confirms they're ready — this plan does not push automatically.
