# Football Instagram — Plan 1: Visuals & Réseaux Space

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the five Instagram visuals (Match Day, Groupe, Résultat, Notes, Classements ×3) from app data as 1080×1350 JPEGs matching the Canva "26-27" mockups, and give the admin a Réseaux space to upload player photos, frame them per layout, and preview/download ready posts with captions. Publishing to Instagram is **Plan 2**.

**Architecture:** Vercel Node functions under `api/insta/` render visuals with Satori → resvg → sharp. All rules (layouts, default framing, rotation, captions, list building) live in a new isomorphic `insta-logic.js` (same pattern as `foot-logic.js`: browser global + `module.exports`), unit-tested with `node:test`, and shared by the API and the browser. Photos live in a public Supabase Storage bucket; uploads go through a server-signed URL protected by an admin key.

**Tech Stack:** Vercel Functions (Node 24), `satori`, `@resvg/resvg-js`, `sharp`, Supabase REST + Storage, React 18 UMD (`foot.jsx` → `foot.js` via Babel), `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-03-foot-instagram-design.md` (sections: Thème, Photos, Feuille de match = Groupe, Joueur mis en avant, Visuels, Cadrage, Espace Réseaux, Légendes, Sécurité). Plan 2 covers: publish endpoints, `foot_insta_posts` writes, token refresh cron.

## Global Constraints

- Canvas 1080×1350 (4:5); output JPEG quality 90. Render circle canvas 300×300.
- Fonts: `fonts/Shrikhand-Regular.ttf` (titles), `fonts/ContrailOne-Regular.ttf` (lists, bands, scores) — OFL, from `github.com/google/fonts`.
- Themes: `domicile` → `assets/insta/bg-domicile.jpg`, ink `#1f6b3d`; `exterieur` → `assets/insta/bg-exterieur.jpg`, ink `#9b4f9f`.
- Photo kinds `render | celebration | dos`; kits `domicile | exterieur`; retouched preferred over raw.
- Layouts `matchday | result | groupe | render`; framing stored as `{x, y, width}` in layout pixel space.
- Jersey numbers are text (1–3 digits, leading zeros kept).
- Admin = `currentPlayer.uid === ADMIN_UID` in the UI; server endpoints that write require header `X-Insta-Admin-Key` === env `INSTA_ADMIN_KEY`.
- Server reads Supabase with env `SUPABASE_SERVICE_ROLE_KEY` (never shipped to the browser).
- Secrets are entered by the user directly in Vercel; never pasted into the conversation. `SUPABASE_SERVICE_ROLE_KEY` and `INSTA_ADMIN_KEY` must exist for Development (non-sensitive, so `vercel env pull` works) and Production/Preview (sensitive).
- Every task touching `foot.jsx`/`foot-logic.js`/`insta-logic.js` ends with `npm run build`, and the same fresh `YYYYMMDDHHMMSS` on `?v=` of `foot-logic.js`, `insta-logic.js`, `foot.js` in `index.html` and `CACHE_VERSION` in `sw.js` (add `insta-logic.js` to the SW network-first list).
- Visual fidelity is judged by looking: each template task ends with a side-by-side image of the render and the Canva thumbnail, inspected before commit.

## Review Focus

- **Opponent name longer than the pill** ("Entente Sportive Saint-Priest") → abbreviation, never overflowing. (Task 3 unit test + Task 4 render)
- **A match with no photo for anyone on the sheet** → visual renders without a player, no error. (Task 3 choosePhoto test + Task 4 render)
- **Groupe with 18 players** → list shrinks and stays inside the panel. (Task 4 render)
- **Résultat with 0 goals / 12 goals** → "Aucun but" / list shrinks to fit. (Task 5 render)
- **Upload of a 4.5 MB raw PNG from a phone** → resized client-side before upload, succeeds under function limits. (Task 8 manual check)

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `package.json` | modify | runtime deps `satori`, `@resvg/resvg-js`, `sharp`; script `test` covers `*.test.js` |
| `vercel.json` | modify | `functions` config (includeFiles fonts/assets, memory, maxDuration) |
| `fonts/*.ttf`, `assets/insta/bg-*.jpg` | create | render assets |
| `supabase/migrations/20261003250000_foot_insta.sql` | create | venue, jersey_number, photos, framings, posts, app_secrets, buckets |
| `insta-logic.js` / `insta-logic.test.js` | create | layouts, framing, photo choice, rotation, names, lists, captions, availability |
| `lib/insta/supabase.js` | create | server REST helpers (service role) |
| `lib/insta/data.js` | create | load match/season context for rendering |
| `lib/insta/render.js` | create | Satori/resvg/sharp pipeline, asset loading, theme tokens |
| `lib/insta/templates.js` | create | element trees for the five visuals + framing preview |
| `api/insta/render.js` | create | `GET` JPEG endpoint |
| `api/insta/photo-sign.js`, `api/insta/photo-register.js`, `api/insta/photo-delete.js` | create | admin photo management |
| `lib/insta/auth.js` | create | admin key check |
| `scripts/insta-import.js` | create | one-off import of Drive photos + jersey numbers |
| `foot.jsx` / `foot.js` | modify | venue, jersey numbers, pre-match sheet, Réseaux space |
| `index.html`, `sw.js` | modify | load `insta-logic.js`, cache versions |

---

### Task 1: Tooling, assets and a function skeleton

**Files:** Modify `package.json`, `vercel.json`, `.gitignore`; Create `fonts/`, `assets/insta/`, `api/insta/health.js`.

**Interfaces — Produces:** runtime deps available to `api/`; `GET /api/insta/health` → `{ ok: true, fonts: 2, backgrounds: 2 }`.

- [ ] **Step 1: Dependencies** — `npm install satori @resvg/resvg-js sharp` (they go to `dependencies`). Change `"test": "node --test"` to `"test": "node --test *.test.js"` so future test files are picked up explicitly.

- [ ] **Step 2: Fonts** (OFL, google/fonts repo)

```bash
mkdir -p fonts assets/insta
curl -sL -o fonts/Shrikhand-Regular.ttf "https://github.com/google/fonts/raw/main/ofl/shrikhand/Shrikhand-Regular.ttf"
curl -sL -o fonts/ContrailOne-Regular.ttf "https://github.com/google/fonts/raw/main/ofl/contrailone/ContrailOne-Regular.ttf"
file fonts/*.ttf   # Expected: both "TrueType Font data"
```

- [ ] **Step 3: Backgrounds** — convert the Drive PNGs (`G:\My Drive\leverculsec\25 26\PHOTOS Bière Leverculsec\Canva\26 27\background\{domicile,exterieur}.png`, 1080×1350) to `assets/insta/bg-domicile.jpg` / `bg-exterieur.jpg` with sharp (`.jpeg({ quality: 92 })`) via a one-line `node -e`. Expected: two JPEGs, each < 1 MB.

- [ ] **Step 4: vercel.json** — add, keeping existing keys:

```json
  "functions": {
    "api/insta/*.js": { "memory": 1024, "maxDuration": 30, "includeFiles": "{fonts/**,assets/insta/**,insta-logic.js,foot-logic.js}" }
  }
```

- [ ] **Step 5: Health function**

```js
// api/insta/health.js
const fs = require("fs");
const path = require("path");
module.exports = (req, res) => {
  const root = process.cwd();
  const fonts = fs.readdirSync(path.join(root, "fonts")).filter((f) => f.endsWith(".ttf")).length;
  const backgrounds = fs.readdirSync(path.join(root, "assets/insta")).filter((f) => f.startsWith("bg-")).length;
  res.status(200).json({ ok: true, fonts, backgrounds });
};
```

- [ ] **Step 6: Verify locally** — `npx vercel dev --listen 3300` (background), `curl -s localhost:3300/api/insta/health` → `{"ok":true,"fonts":2,"backgrounds":2}`; `curl -s -o /dev/null -w "%{http_code}" localhost:3300/` → `200` (static site still served). Stop the server.

- [ ] **Step 7: Commit** `chore: add Instagram render tooling, fonts and backgrounds`.

---

### Task 2: Database and storage

**Files:** Create `supabase/migrations/20261003250000_foot_insta.sql`.

**Interfaces — Produces:** columns `foot_matches.venue`, `foot_roster.jersey_number`; tables `foot_player_photos`, `foot_photo_framings`, `foot_insta_posts`, `app_secrets`; public buckets `player-photos`, `insta-posts`.

- [ ] **Step 1: Migration**

```sql
alter table foot_matches add column if not exists venue text not null default 'domicile';
alter table foot_matches drop constraint if exists foot_matches_venue_check;
alter table foot_matches add constraint foot_matches_venue_check check (venue in ('domicile','exterieur'));

alter table foot_roster add column if not exists jersey_number text;
alter table foot_roster drop constraint if exists foot_roster_jersey_number_check;
alter table foot_roster add constraint foot_roster_jersey_number_check check (jersey_number is null or jersey_number ~ '^[0-9]{1,3}$');

create table if not exists foot_player_photos (
  id bigint generated always as identity primary key,
  player_id integer not null references players(id) on delete cascade,
  kit text not null check (kit in ('domicile','exterieur')),
  kind text not null check (kind in ('render','celebration','dos')),
  retouched boolean not null default false,
  path text not null,
  width integer not null,
  height integer not null,
  updated_at timestamptz not null default now(),
  unique (player_id, kit, kind, retouched)
);

create table if not exists foot_photo_framings (
  photo_id bigint not null references foot_player_photos(id) on delete cascade,
  layout text not null check (layout in ('matchday','result','groupe','render')),
  x real not null,
  y real not null,
  width real not null check (width > 0),
  updated_at timestamptz not null default now(),
  primary key (photo_id, layout)
);

create table if not exists foot_insta_posts (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('matchday','result','ratings','rankings')),
  match_id bigint references foot_matches(id) on delete set null,
  season text,
  week_key text,
  featured jsonb not null default '{}'::jsonb,
  image_paths text[] not null default '{}',
  caption text,
  status text not null default 'draft' check (status in ('draft','published','failed')),
  ig_media_id text,
  permalink text,
  error text,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists app_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table app_secrets enable row level security;

insert into storage.buckets (id, name, public) values ('player-photos','player-photos', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('insta-posts','insta-posts', true) on conflict (id) do nothing;
```

- [ ] **Step 2: Apply** — `supabase db push --password '<db password>'`; wait 10 s.

- [ ] **Step 3: Verify** with the anon key:
  - `GET foot_matches?select=id,venue` → every row `"venue":"domicile"`;
  - `GET foot_player_photos?select=*` → `[]`; `GET foot_photo_framings?select=*` → `[]`;
  - `GET app_secrets?select=*` → `[]` (RLS hides rows from anon — insert a probe row with the service role later in Task 4 and confirm anon still gets `[]`);
  - `GET https://<ref>.supabase.co/storage/v1/bucket/player-photos` with anon → bucket info or 400 "not found" means the insert failed (then re-run).

- [ ] **Step 4: Commit** `feat: football Instagram tables, storage buckets and locked secrets table`.

---

### Task 3: `insta-logic.js` (pure rules) — TDD

**Files:** Create `insta-logic.js`, `insta-logic.test.js`.

**Interfaces — Produces:**
- `LAYOUTS` = `{ matchday:{canvas:[1080,1350], box:{x:60,y:230,w:960,h:1050}}, result:{canvas:[1080,1350], box:{x:-40,y:260,w:620,h:1090}}, groupe:{canvas:[1080,1350], box:{x:-40,y:180,w:700,h:1170}}, render:{canvas:[300,300], box:{x:0,y:0,w:300,h:300}} }`
- `PHOTO_KIND_FOR_LAYOUT` = `{ matchday:"celebration", result:"celebration", groupe:"dos", render:"render" }`
- `defaultFraming(layout, photo) -> {x,y,width}`
- `framedRect(layout, photo, framing|null) -> {x,y,width,height}`
- `choosePhoto(photos, playerId, kind, kit) -> photo|null` (prefers kit match, retouched; falls back to the other kit)
- `pickFeatured(candidateIds, history, seed) -> id|null` (history: `[{playerId, at}]`, least recent first, never-featured first, ties broken by seeded order)
- `postName(player, players) -> string` (first name, or display_name if two players in `players` share that first name)
- `opponentLabel(name) -> string` (≤ 12 chars as-is uppercased, else initials of words ≥ 3 letters, uppercased)
- `matchBand(match) -> "JEUDI 19H30 | STADE | VILLE"`
- `groupeLines(sheetIds, roster, players) -> [{number, name}]` sorted by number (numeric) then name, numberless last
- `goalLines(events, players) -> string[]` (`32' Louis (Thisma)`, BL goals only, by half then minute)
- `rankingEntries(statsRows, key, limit) -> [{playerId, value}]` (value > 0, desc, ties by name via `nameOf`), signature `rankingEntries(rows, key, nameOf, limit = 15)`
- `rankingRows(n) -> number[]` (row sizes: first row 3, then 4s, e.g. 13 → [3,4,4,2])
- `captionFor(kind, ctx) -> string`
- `availablePosts({ matches, lineups, ratings, now }) -> [{kind, matchId?, season?, label}]`

- [ ] **Step 1: Failing tests** (`insta-logic.test.js`)

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("./insta-logic.js");

const raw = { id: 1, player_id: 7, kit: "domicile", kind: "celebration", retouched: false, width: 2230, height: 1888 };
const ret = { id: 2, player_id: 7, kit: "domicile", kind: "celebration", retouched: true, width: 1080, height: 1350 };

test("defaultFraming: retouched photos fill the canvas", () => {
  assert.deepEqual(L.defaultFraming("matchday", ret), { x: 0, y: 0, width: 1080 });
});

test("defaultFraming: raw photos fit the layout box, bottom-aligned and centred", () => {
  const f = L.defaultFraming("matchday", raw);
  const h = f.width * raw.height / raw.width;
  assert.ok(f.width <= 960 + 1e-9 && h <= 1050 + 1e-9);
  assert.equal(Math.round(f.y + h), 230 + 1050);
  assert.equal(Math.round(f.x + f.width / 2), 60 + 480);
});

test("defaultFraming: render covers the circle", () => {
  const r = { ...raw, kind: "render", width: 800, height: 1000 };
  const f = L.defaultFraming("render", r);
  assert.equal(f.width, 300);
  assert.equal(f.y, 0);
});

test("framedRect uses a saved framing and derives the height", () => {
  assert.deepEqual(L.framedRect("matchday", raw, { x: 10, y: 20, width: 1115 }), { x: 10, y: 20, width: 1115, height: 944 });
});

test("choosePhoto prefers same kit, retouched, then the other kit, else null", () => {
  const other = { ...raw, id: 3, kit: "exterieur" };
  assert.equal(L.choosePhoto([raw, ret, other], 7, "celebration", "domicile").id, 2);
  assert.equal(L.choosePhoto([other], 7, "celebration", "domicile").id, 3);
  assert.equal(L.choosePhoto([raw], 7, "dos", "domicile"), null);
});

test("pickFeatured: never-featured first, then least recent", () => {
  const hist = [{ playerId: 1, at: "2026-10-01" }, { playerId: 2, at: "2026-09-01" }];
  assert.equal(L.pickFeatured([1, 2, 3], hist, 5), 3);
  assert.equal(L.pickFeatured([1, 2], hist, 5), 2);
  assert.equal(L.pickFeatured([], hist, 5), null);
});

test("pickFeatured is stable for the same seed", () => {
  assert.equal(L.pickFeatured([4, 5, 6], [], 42), L.pickFeatured([4, 5, 6], [], 42));
});

test("postName uses first names unless two players share one", () => {
  const ps = [{ id: 1, name: "Louis", display_name: "Louis Mar" }, { id: 2, name: "Thomas", display_name: "Thomas" }, { id: 3, name: "Louis", display_name: "Louis B" }];
  assert.equal(L.postName(ps[1], ps), "Thomas");
  assert.equal(L.postName(ps[0], ps), "Louis Mar");
  assert.equal(L.postName(ps[0], [ps[0], ps[1]]), "Louis");
});

test("opponentLabel abbreviates long names", () => {
  assert.equal(L.opponentLabel("FC Caribou"), "FC CARIBOU");
  assert.equal(L.opponentLabel("Entente Sportive Saint-Priest"), "ESSP");
  assert.equal(L.opponentLabel("En Avant Guinguette"), "EAG");
});

test("matchBand formats day, time, stadium and city", () => {
  const m = { match_datetime: new Date(2026, 9, 8, 19, 30).toISOString(), stadium_name: "L'Étivallière", city: "Saint-Étienne", address: "x" };
  assert.equal(L.matchBand(m), "JEUDI 19H30 | L'ÉTIVALLIÈRE | SAINT-ÉTIENNE");
  assert.equal(L.matchBand({ ...m, stadium_name: null }), "JEUDI 19H30 | X | SAINT-ÉTIENNE");
});

test("groupeLines sorts by jersey number then name, numberless last", () => {
  const players = [{ id: 1, name: "Thomas" }, { id: 2, name: "Léandre" }, { id: 3, name: "Nolan" }, { id: 4, name: "Zed" }];
  const roster = [{ player_id: 1, jersey_number: "25" }, { player_id: 2, jersey_number: "67" }, { player_id: 3, jersey_number: "02" }, { player_id: 4, jersey_number: null }];
  assert.deepEqual(L.groupeLines([1, 2, 3, 4], roster, players), [
    { number: "02", name: "Nolan" }, { number: "25", name: "Thomas" }, { number: "67", name: "Léandre" }, { number: null, name: "Zed" },
  ]);
});

test("goalLines lists BL goals with assists in match order", () => {
  const players = [{ id: 1, name: "Louis" }, { id: 2, name: "Thisma" }];
  const ev = [
    { half: 2, minute: 5, type: "goal_bl", player_id: 2, assist_player_id: null },
    { half: 1, minute: 32, type: "goal_bl", player_id: 1, assist_player_id: 2 },
    { half: 1, minute: 40, type: "goal_opponent", player_id: null, assist_player_id: null },
  ];
  assert.deepEqual(L.goalLines(ev, players), ["32' Louis (Thisma)", "5' Thisma"]);
});

test("rankingEntries keeps positive values, sorted, limited", () => {
  const rows = [{ playerId: 1, goals: 2 }, { playerId: 2, goals: 0 }, { playerId: 3, goals: 5 }, { playerId: 4, goals: 2 }];
  const name = (id) => ({ 1: "B", 3: "C", 4: "A" })[id];
  assert.deepEqual(L.rankingEntries(rows, "goals", name, 2), [{ playerId: 3, value: 5 }, { playerId: 4, value: 2 }]);
});

test("rankingRows splits into 3 then 4s", () => {
  assert.deepEqual(L.rankingRows(13), [3, 4, 4, 2]);
  assert.deepEqual(L.rankingRows(2), [2]);
  assert.deepEqual(L.rankingRows(0), []);
});

test("captionFor builds the result caption", () => {
  assert.equal(L.captionFor("result", { opponent: "FC Caribou", bl: 8, opp: 6, goals: ["32' Louis (Thisma)"] }), "Victoire 8-6 contre FC Caribou ⚽\n\n32' Louis (Thisma)");
  assert.match(L.captionFor("result", { opponent: "X", bl: 1, opp: 1, goals: [] }), /^Match nul 1-1/);
});

test("availablePosts lists matchday, result, ratings and rankings when eligible", () => {
  const matches = [
    { id: 1, status: "scheduled", opponent_name: "A", match_datetime: "2026-10-20T17:30:00Z" },
    { id: 2, status: "finished", opponent_name: "B", match_datetime: "2026-10-10T17:30:00Z", ratings_validated_at: "x" },
  ];
  const lineups = [{ match_id: 1, player_id: 5 }];
  const kinds = L.availablePosts({ matches, lineups, now: new Date("2026-10-15T10:00:00Z") }).map((p) => `${p.kind}:${p.matchId ?? p.season}`);
  assert.deepEqual(kinds, ["matchday:1", "result:2", "ratings:2", "rankings:2026-2027"]);
});
```

- [ ] **Step 2: Run** `npm test` → Expected: `insta-logic.test.js` fails (`Cannot find module './insta-logic.js'`); existing tests still pass.

- [ ] **Step 3: Implement** (`insta-logic.js`)

```js
// insta-logic.js — pure rules shared by the browser (globals) and Vercel functions (require)
var INSTA_FOOT_LOGIC = typeof module !== "undefined" && module.exports ? require("./foot-logic.js") : null;
function _footFn(name) { return INSTA_FOOT_LOGIC ? INSTA_FOOT_LOGIC[name] : globalThis[name]; }

const LAYOUTS = {
  matchday: { canvas: [1080, 1350], box: { x: 60, y: 230, w: 960, h: 1050 } },
  result: { canvas: [1080, 1350], box: { x: -40, y: 260, w: 620, h: 1090 } },
  groupe: { canvas: [1080, 1350], box: { x: -40, y: 180, w: 700, h: 1170 } },
  render: { canvas: [300, 300], box: { x: 0, y: 0, w: 300, h: 300 } },
};
const PHOTO_KIND_FOR_LAYOUT = { matchday: "celebration", result: "celebration", groupe: "dos", render: "render" };

function defaultFraming(layout, photo) {
  const L = LAYOUTS[layout];
  if (layout === "render") {
    const width = Math.max(L.box.w, (L.box.h * photo.width) / photo.height);
    return { x: (L.box.w - width) / 2, y: 0, width };
  }
  if (photo.retouched) return { x: 0, y: 0, width: L.canvas[0] };
  const s = Math.min(L.box.w / photo.width, L.box.h / photo.height);
  const width = photo.width * s;
  const height = photo.height * s;
  return { x: L.box.x + (L.box.w - width) / 2, y: L.box.y + L.box.h - height, width };
}

function framedRect(layout, photo, framing) {
  const f = framing || defaultFraming(layout, photo);
  return { x: f.x, y: f.y, width: f.width, height: Math.round((f.width * photo.height) / photo.width) };
}

function choosePhoto(photos, playerId, kind, kit) {
  const mine = photos.filter((p) => p.player_id === playerId && p.kind === kind);
  const rank = (p) => (p.kit === kit ? 0 : 2) + (p.retouched ? 0 : 1);
  return mine.sort((a, b) => rank(a) - rank(b))[0] || null;
}

function _seeded(id, seed) {
  let x = (id * 2654435761 + seed * 97) >>> 0;
  x ^= x >>> 13; x = Math.imul(x, 1274126177) >>> 0;
  return x;
}

function pickFeatured(candidateIds, history, seed) {
  if (!candidateIds.length) return null;
  const last = {};
  for (const h of history) if (!last[h.playerId] || h.at > last[h.playerId]) last[h.playerId] = h.at;
  return [...candidateIds].sort((a, b) => {
    const la = last[a] || "", lb = last[b] || "";
    if (la !== lb) return la < lb ? -1 : 1;
    return _seeded(a, seed) - _seeded(b, seed);
  })[0];
}

function postName(player, players) {
  if (!player) return "?";
  const same = players.filter((p) => p.name === player.name);
  return same.length > 1 ? (player.display_name || player.name) : player.name;
}

function opponentLabel(name) {
  const up = String(name || "").trim().toUpperCase();
  if (up.length <= 12) return up;
  return up.split(/[\s-]+/).filter((w) => w.length >= 3).map((w) => w[0]).join("") || up.slice(0, 12);
}

const JOURS = ["DIMANCHE", "LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI"];
function matchBand(match) {
  const d = new Date(match.match_datetime);
  const time = `${String(d.getHours()).padStart(2, "0")}H${String(d.getMinutes()).padStart(2, "0")}`;
  const place = (match.stadium_name || match.address || "").toUpperCase();
  return [`${JOURS[d.getDay()]} ${time}`, place, (match.city || "").toUpperCase()].filter(Boolean).join(" | ");
}

function groupeLines(sheetIds, roster, players) {
  return sheetIds.map((id) => {
    const r = roster.find((x) => x.player_id === id);
    const p = players.find((x) => x.id === id);
    return { number: r && r.jersey_number ? r.jersey_number : null, name: postName(p, players.filter((x) => sheetIds.includes(x.id))) };
  }).sort((a, b) => {
    if (a.number == null || b.number == null) return a.number == null && b.number == null ? a.name.localeCompare(b.name) : a.number == null ? 1 : -1;
    return Number(a.number) - Number(b.number) || a.name.localeCompare(b.name);
  });
}

function goalLines(events, players) {
  const nameOf = (id) => postName(players.find((p) => p.id === id), players);
  return events.filter((e) => e.type === "goal_bl")
    .sort((a, b) => a.half - b.half || a.minute - b.minute)
    .map((e) => `${e.minute}' ${nameOf(e.player_id)}${e.assist_player_id ? ` (${nameOf(e.assist_player_id)})` : ""}`);
}

function rankingEntries(rows, key, nameOf, limit = 15) {
  return rows.filter((r) => (r[key] || 0) > 0)
    .sort((a, b) => b[key] - a[key] || nameOf(a.playerId).localeCompare(nameOf(b.playerId)))
    .slice(0, limit).map((r) => ({ playerId: r.playerId, value: r[key] }));
}

function rankingRows(n) {
  if (n <= 0) return [];
  if (n <= 3) return [n];
  const rows = [3];
  let left = n - 3;
  while (left > 0) { rows.push(Math.min(4, left)); left -= 4; }
  return rows;
}

function captionFor(kind, c) {
  if (kind === "matchday") return `MATCH DAY ⚽ Bière Leverculsec vs ${c.opponent}\n${c.band}`;
  if (kind === "result") {
    const word = c.bl > c.opp ? "Victoire" : c.bl === c.opp ? "Match nul" : "Défaite";
    return `${word} ${c.bl}-${c.opp} contre ${c.opponent} ⚽${c.goals.length ? "\n\n" + c.goals.join("\n") : ""}`;
  }
  if (kind === "ratings") return `Les notes du match contre ${c.opponent} 📝${c.top.length ? "\n\n" + c.top.map((t, i) => `${i + 1}. ${t.name} ${t.rating.toFixed(1)}`).join("\n") : ""}`;
  if (kind === "rankings") return `Classements de la saison ${c.season} 📊`;
  return "";
}

function availablePosts({ matches, lineups, now }) {
  const seasonOf = _footFn("seasonOf");
  const out = [];
  const byDate = [...matches].sort((a, b) => new Date(a.match_datetime) - new Date(b.match_datetime));
  for (const m of byDate) {
    const sheet = lineups.filter((l) => l.match_id === m.id);
    if (m.status === "scheduled" && sheet.length) out.push({ kind: "matchday", matchId: m.id, label: `Match Day + Groupe — vs ${m.opponent_name}` });
  }
  for (const m of [...byDate].reverse()) {
    if (m.status === "finished") out.push({ kind: "result", matchId: m.id, label: `Résultat — vs ${m.opponent_name}` });
    if (m.status === "finished" && m.ratings_validated_at) out.push({ kind: "ratings", matchId: m.id, label: `Notes — vs ${m.opponent_name}` });
  }
  if (matches.some((m) => m.status === "finished")) out.push({ kind: "rankings", season: seasonOf(now.toISOString()), label: "Classements de la saison" });
  return out;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { LAYOUTS, PHOTO_KIND_FOR_LAYOUT, defaultFraming, framedRect, choosePhoto, pickFeatured, postName, opponentLabel, matchBand, groupeLines, goalLines, rankingEntries, rankingRows, captionFor, availablePosts };
}
```

- [ ] **Step 4: Run** `npm test` → all pass. If a test fails, fix the code, not the test (unless the test contradicts the spec — then ledger a ruling).

- [ ] **Step 5: Wire into the page** — `index.html`: `<script src="insta-logic.js?v=…"></script>` after `foot-logic.js`; `sw.js`: add `url.includes('insta-logic.js')` to the network-first list and `'/insta-logic.js'` to `ASSETS`. Bump versions.

- [ ] **Step 6: Commit** `feat: pure rules for football Instagram visuals`.

---

### Task 4: Render pipeline, Match Day & Groupe, render endpoint

**Files:** Create `lib/insta/supabase.js`, `lib/insta/data.js`, `lib/insta/render.js`, `lib/insta/templates.js`, `api/insta/render.js`.

**Interfaces:**
- Consumes: `insta-logic.js` (Task 3), `foot-logic.js` (`computeFootScore`, `lineupIdsFor`-equivalent via filter).
- Produces:
  - `sbGet(table, query) -> rows` (service role), `publicUrl(bucket, path) -> string`
  - `loadMatchContext(matchId) -> { match, players, roster, lineups, events, ratings, photos, framings, history, theme }`
  - `renderJpeg(element, [w,h]) -> Buffer`, `imageDataUri(urlOrPath) -> string` (cached), `THEMES`
  - templates: `matchDayEl(ctx)`, `groupeEl(ctx)` returning Satori element trees; shared `h()`, `bg()`, `photoEl(rect, src)`, `titleEl(text, theme)`
  - `GET /api/insta/render?kind=matchday&match=ID&page=1|2` → `image/jpeg`

- [ ] **Step 1: Server Supabase helpers**

```js
// lib/insta/supabase.js
const SUPABASE_URL = "https://daerxouhvmvqhirgyrjr.supabase.co";
function key() {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante");
  return k;
}
async function sbGet(table, query = "") {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, { headers: { apikey: key(), Authorization: `Bearer ${key()}` } });
  if (!r.ok) throw new Error(`${table} ${r.status}: ${await r.text()}`);
  return r.json();
}
async function sbWrite(method, table, query, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query || ""}`, {
    method,
    headers: { apikey: key(), Authorization: `Bearer ${key()}`, "Content-Type": "application/json", Prefer: "return=representation,resolution=merge-duplicates" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${table} ${r.status}: ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}
function publicUrl(bucket, path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
}
module.exports = { SUPABASE_URL, sbGet, sbWrite, publicUrl, serviceKey: key };
```

- [ ] **Step 2: Data loader**

```js
// lib/insta/data.js
const { sbGet } = require("./supabase");
async function loadCommon() {
  const [players, roster, photos, framings] = await Promise.all([
    sbGet("players", "?select=id,name,display_name"),
    sbGet("foot_roster", "?select=player_id,role,jersey_number"),
    sbGet("foot_player_photos", "?select=*"),
    sbGet("foot_photo_framings", "?select=*"),
  ]);
  return { players, roster, photos, framings };
}
async function loadMatchContext(matchId) {
  const id = Number(matchId);
  const [common, [match], lineups, events, ratings, history] = await Promise.all([
    loadCommon(),
    sbGet("foot_matches", `?id=eq.${id}&select=*`),
    sbGet("foot_lineups", `?match_id=eq.${id}&select=match_id,player_id`),
    sbGet("foot_match_events", `?match_id=eq.${id}&select=*`),
    sbGet("foot_ratings", `?match_id=eq.${id}&select=*`),
    sbGet("foot_insta_posts", "?status=eq.published&select=featured,published_at"),
  ]);
  if (!match) throw new Error("Match introuvable");
  return { ...common, match, lineups, events, ratings, history, theme: match.venue === "exterieur" ? "exterieur" : "domicile" };
}
function historyFor(history, slot) {
  return history.filter((h) => h.featured && h.featured[slot]).map((h) => ({ playerId: h.featured[slot], at: h.published_at }));
}
module.exports = { loadCommon, loadMatchContext, historyFor };
```

- [ ] **Step 3: Render pipeline**

```js
// lib/insta/render.js
const fs = require("fs");
const path = require("path");
const satoriMod = require("satori");
const satori = satoriMod.default || satoriMod;
const { Resvg } = require("@resvg/resvg-js");
const sharp = require("sharp");

const ROOT = process.cwd();
const FONTS = [
  { name: "Shrikhand", data: fs.readFileSync(path.join(ROOT, "fonts/Shrikhand-Regular.ttf")), weight: 400, style: "normal" },
  { name: "Contrail One", data: fs.readFileSync(path.join(ROOT, "fonts/ContrailOne-Regular.ttf")), weight: 400, style: "normal" },
];
const THEMES = {
  domicile: { ink: "#1f6b3d", pill: "#1f6b3d", bg: "assets/insta/bg-domicile.jpg" },
  exterieur: { ink: "#9b4f9f", pill: "#8e3f96", bg: "assets/insta/bg-exterieur.jpg" },
};
const cache = new Map();
async function imageDataUri(src) {
  if (cache.has(src)) return cache.get(src);
  let buf, mime;
  if (/^https?:/.test(src)) {
    const r = await fetch(src);
    if (!r.ok) throw new Error(`image ${r.status}`);
    buf = Buffer.from(await r.arrayBuffer());
    mime = r.headers.get("content-type") || "image/png";
  } else {
    buf = fs.readFileSync(path.join(ROOT, src));
    mime = src.endsWith(".jpg") ? "image/jpeg" : "image/png";
  }
  const uri = `data:${mime};base64,${buf.toString("base64")}`;
  cache.set(src, uri);
  return uri;
}
async function renderJpeg(element, [width, height] = [1080, 1350]) {
  const svg = await satori(element, { width, height, fonts: FONTS });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();
  return sharp(png).jpeg({ quality: 90 }).toBuffer();
}
module.exports = { renderJpeg, imageDataUri, THEMES };
```

- [ ] **Step 4: Templates — shared pieces, Match Day, Groupe** (geometry measured on the Canva thumbnails ×2.7; tuned in Step 7)

```js
// lib/insta/templates.js
function h(type, style, ...children) {
  const kids = children.flat().filter((c) => c !== null && c !== undefined && c !== false);
  return { type, props: { style: type === "img" ? style : { display: "flex", ...style }, children: kids.length === 1 ? kids[0] : kids } };
}
function img(src, style) { return { type: "img", props: { src, style, width: style.width, height: style.height } }; }
function canvas(bgUri, ...children) {
  return h("div", { width: 1080, height: 1350, position: "relative", overflow: "hidden" }, img(bgUri, { position: "absolute", left: 0, top: 0, width: 1080, height: 1350 }), ...children);
}
function title(text, size = 210) {
  return h("div", { position: "absolute", top: -40, left: 0, width: 1080, justifyContent: "center", fontFamily: "Shrikhand", fontSize: size, color: "#ffffff", textShadow: "6px 8px 0 rgba(0,0,0,0.18)", letterSpacing: -4 }, text);
}
function photo(rect, src) {
  if (!rect || !src) return null;
  return img(src, { position: "absolute", left: rect.x, top: rect.y, width: rect.width, height: rect.height });
}
function pill(text, theme) {
  return h("div", { position: "absolute", top: 205, left: 660, width: 480, height: 110, borderRadius: 55, background: theme.pill, alignItems: "center", paddingLeft: 40, fontFamily: "Shrikhand", fontSize: 72, color: "#ffffff" }, `vs ${text}`);
}
function band(text, theme) {
  return h("div", { position: "absolute", bottom: 26, left: 40, width: 1000, height: 66, borderRadius: 33, background: "#ffffff", justifyContent: "center", alignItems: "center", fontFamily: "Shrikhand", fontSize: text.length > 42 ? 30 : 36, color: theme.ink }, text);
}
function matchDayEl({ bg, theme, opponent, bandText, rect, photoUri }) {
  return canvas(bg, photo(rect, photoUri), title("MATCH DAY"), pill(opponent, theme), band(bandText, theme));
}
function listPanel(lines, theme, { left, top, width, height, max = 10 }) {
  const size = lines.length <= max ? 78 : Math.max(40, Math.floor((height - 40) / lines.length / 1.05));
  return h("div", { position: "absolute", left, top, width, height, borderRadius: 48, background: "rgba(255,255,255,0.93)", flexDirection: "column", justifyContent: "center", paddingLeft: 36, paddingRight: 24 },
    lines.map((t) => h("div", { fontFamily: "Contrail One", fontSize: size, lineHeight: 1.05, color: theme.ink }, t)));
}
function groupeEl({ bg, theme, lines, rect, photoUri }) {
  const text = lines.map((l) => (l.number ? `${l.number}. ${l.name}` : l.name));
  return canvas(bg, photo(rect, photoUri), title("GROUPE"), listPanel(text, theme, { left: 610, top: 330, width: 410, height: 920 }));
}
module.exports = { h, img, canvas, title, photo, pill, band, listPanel, matchDayEl, groupeEl };
```

- [ ] **Step 5: Render endpoint (Match Day / Groupe)**

```js
// api/insta/render.js
const L = require("../../insta-logic.js");
const F = require("../../foot-logic.js");
const { loadMatchContext, historyFor } = require("../../lib/insta/data");
const { publicUrl } = require("../../lib/insta/supabase");
const { renderJpeg, imageDataUri, THEMES } = require("../../lib/insta/render");
const T = require("../../lib/insta/templates");

async function featuredPhoto(ctx, layout, slot, sheetIds) {
  const kind = L.PHOTO_KIND_FOR_LAYOUT[layout];
  const withPhoto = sheetIds.filter((id) => L.choosePhoto(ctx.photos, id, kind, ctx.theme));
  const pid = L.pickFeatured(withPhoto, historyFor(ctx.history, slot), ctx.match.id);
  if (!pid) return { pid: null, rect: null, uri: null };
  const ph = L.choosePhoto(ctx.photos, pid, kind, ctx.theme);
  const fr = ctx.framings.find((f) => f.photo_id === ph.id && f.layout === layout) || null;
  return { pid, rect: L.framedRect(layout, ph, fr), uri: await imageDataUri(publicUrl("player-photos", ph.path)) };
}

async function build(kind, q) {
  if (kind === "matchday") {
    const ctx = await loadMatchContext(q.match);
    const theme = THEMES[ctx.theme];
    const bg = await imageDataUri(theme.bg);
    const sheetIds = ctx.lineups.map((l) => l.player_id);
    if (String(q.page || "1") === "2") {
      const f = await featuredPhoto(ctx, "groupe", "dos", sheetIds);
      return T.groupeEl({ bg, theme, lines: L.groupeLines(sheetIds, ctx.roster, ctx.players), rect: f.rect, photoUri: f.uri });
    }
    const f = await featuredPhoto(ctx, "matchday", "celebration", sheetIds);
    return T.matchDayEl({ bg, theme, opponent: L.opponentLabel(ctx.match.opponent_name), bandText: L.matchBand(ctx.match), rect: f.rect, photoUri: f.uri });
  }
  throw new Error(`Type inconnu : ${kind}`);
}

module.exports = async (req, res) => {
  try {
    const el = await build(req.query.kind, req.query);
    const jpg = await renderJpeg(el);
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(jpg);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};
module.exports.build = build;
module.exports.featuredPhoto = featuredPhoto;
```

- [ ] **Step 6: Render locally** — prerequisite: the user has added `SUPABASE_SERVICE_ROLE_KEY` (Development, non-sensitive) in Vercel; `vercel env pull .env.local`. Start `npx vercel dev --listen 3300`; render the user's scheduled match (match id from `foot_matches?status=eq.scheduled`, or a finished one if none: add `&force=1` handling is NOT needed — render works for any match status) into scratch: `curl -s "localhost:3300/api/insta/render?kind=matchday&match=<id>&page=1" -o md.jpg` and `page=2 -o groupe.jpg`. Expected: two JPEGs; with no photos uploaded yet, no player appears (fallback) and nothing errors.

- [ ] **Step 7: Look and tune** — build a side-by-side PNG (sharp `composite`) of each render next to the Canva thumbnail export (`mcp__claude_ai_Canva__read-design` thumbnails of pages 2 and 1 of design `DAHW9dRBQec`), view it, and tune `title`/`pill`/`band`/`listPanel` geometry until title size/position, pill, band and panel match within a few pixels at thumbnail scale. Also render: an opponent of 30 characters (abbreviation shown), a 18-player groupe (fits the panel) — by temporarily calling `build` from a node script with a hand-made context (`templates` only).

- [ ] **Step 8: Commit** `feat: render Match Day and Groupe Instagram visuals`.

---

### Task 5: Résultat & Classements

**Files:** Modify `lib/insta/templates.js`, `api/insta/render.js`.

**Interfaces — Produces:** `resultEl(ctx)`, `rankingEl(ctx)`, `renderCircle(entry)`; render kinds `result` (`match`) and `rankings` (`season`, `page` 1=Buts, 2=Passes D, 3=Buts+Passes D).

- [ ] **Step 1: Templates**

```js
function scoreBlock(opponent, bl, opp) {
  const line = (t, size, top) => h("div", { position: "absolute", top, left: 430, width: 650, justifyContent: "center", fontFamily: "Shrikhand", fontSize: size, color: "#ffffff", textShadow: "5px 6px 0 rgba(0,0,0,0.18)" }, t);
  return [line("LEVERCULSEC", 74, 235), line(`${bl} - ${opp}`, 130, 315), line(opponent, opponent.length > 14 ? 54 : 74, 465)];
}
function resultEl({ bg, theme, opponent, bl, opp, goals, rect, photoUri }) {
  const lines = goals.length ? goals : ["Aucun but"];
  return canvas(bg, photo(rect, photoUri), title("RESULTAT"), ...scoreBlock(opponent, bl, opp),
    h("div", { position: "absolute", left: 395, top: 620, width: 500, height: 640, borderRadius: 48, background: "rgba(255,255,255,0.93)", flexDirection: "column", alignItems: "center", paddingTop: 24 },
      h("div", { fontFamily: "Shrikhand", fontSize: 70, color: theme.ink }, "buts :"),
      h("div", { flexDirection: "column", alignItems: "center" },
        lines.map((t) => h("div", { fontFamily: "Contrail One", fontSize: lines.length <= 8 ? 54 : Math.max(30, Math.floor(480 / lines.length)), lineHeight: 1.1, color: theme.ink }, t)))));
}
function rankingEl({ bg, theme, heading, entries }) {
  const rows = require("../../insta-logic.js").rankingRows(entries.length);
  let i = 0;
  const big = 230, small = 200;
  const rowEls = rows.map((n, r) => {
    const d = r === 0 ? big : small;
    const cells = entries.slice(i, i + n); i += n;
    return h("div", { justifyContent: "center", gap: 26, marginBottom: 14 },
      cells.map((e) => h("div", { flexDirection: "column", alignItems: "center" },
        h("div", { width: d, height: d, borderRadius: d / 2, background: "#ffffff", overflow: "hidden", position: "relative", justifyContent: "center", alignItems: "center" },
          e.uri ? img(e.uri, { position: "absolute", left: (e.rect.x * d) / 300, top: (e.rect.y * d) / 300, width: (e.rect.width * d) / 300, height: (e.rect.height * d) / 300 })
                : h("div", { fontFamily: "Shrikhand", fontSize: d / 3, color: theme.ink }, e.initials)),
        h("div", { marginTop: -18, width: d * 0.72, height: 62, borderRadius: 31, background: theme.pill, justifyContent: "center", alignItems: "center", fontFamily: "Contrail One", fontSize: 44, color: "#ffffff" }, String(e.value)))));
  });
  return canvas(bg, title(heading, heading.length > 8 ? 150 : 210),
    h("div", { position: "absolute", top: 240, left: 0, width: 1080, flexDirection: "column" }, rowEls));
}
```
Export them.

- [ ] **Step 2: Render endpoint** — add to `build`:

```js
  if (kind === "result") {
    const ctx = await loadMatchContext(q.match);
    const theme = THEMES[ctx.theme];
    const sheetIds = ctx.lineups.map((l) => l.player_id);
    const f = await featuredPhoto(ctx, "result", "celebration_result", sheetIds);
    const s = F.computeFootScore(ctx.events);
    return T.resultEl({ bg: await imageDataUri(theme.bg), theme, opponent: ctx.match.opponent_name.toUpperCase(), bl: s.bl, opp: s.opponent, goals: L.goalLines(ctx.events, ctx.players), rect: f.rect, photoUri: f.uri });
  }
  if (kind === "rankings") return buildRankings(q);
```
and `buildRankings` (loads all matches/lineups/events, latest finished match venue for theme, `F.filterMatchesForStats(matches, { season, type: "all" })`, `F.buildStatsRows(F.statsRoster(roster), F.computePlayerStats(...), {})`, `L.rankingEntries(rows, key, nameOf)` with key `goals` / `assists` / `decisive` and headings `BUTS` / `PASSE D` / `BUTS + PASSE D`; each entry gets its render photo via `L.choosePhoto(photos, id, "render", theme)` + framing layout `render`, else `initials`).

Note: the result uses its own rotation slot `celebration_result` so Match Day and Résultat don't always show the same player.

- [ ] **Step 3: Render, look, tune** — render a finished match (`kind=result`) and the three ranking pages; build side-by-sides with Canva pages 3 and 4; tune score block, panel and circle grid. Edge renders via template-only node script: 0 goals ("Aucun but"), 12 goals (shrinks), 13 and 15 ranking entries, 30-char opponent.

- [ ] **Step 4: Commit** `feat: render Résultat and Classements Instagram visuals`.

---

### Task 6: Notes visual (new design, user checkpoint)

**Files:** Modify `lib/insta/templates.js`, `api/insta/render.js`.

**Interfaces — Produces:** `ratingsEl({ bg, theme, opponent, bl, opp, rows:[{name, match, season}] })`; render kind `ratings` (`match`).

- [ ] **Step 1: Template** (same charter: Shrikhand title "NOTES", score line under it, white rounded panel with one row per sheet player: name left (Contrail One), match rating in a theme-coloured pill, season average small "moy. 7.2" on the right; sorted by match rating desc; shrinks beyond 10 rows)

```js
function ratingsEl({ bg, theme, opponent, bl, opp, rows }) {
  const size = rows.length <= 10 ? 52 : Math.max(32, Math.floor(820 / rows.length / 1.4));
  return canvas(bg, title("NOTES"),
    h("div", { position: "absolute", top: 225, left: 0, width: 1080, justifyContent: "center", fontFamily: "Shrikhand", fontSize: 58, color: "#ffffff", textShadow: "4px 5px 0 rgba(0,0,0,0.18)" }, `LEVERCULSEC ${bl} - ${opp} ${opponent}`),
    h("div", { position: "absolute", top: 330, left: 70, width: 940, height: 950, borderRadius: 48, background: "rgba(255,255,255,0.93)", flexDirection: "column", justifyContent: "center", paddingLeft: 44, paddingRight: 44 },
      rows.map((r) => h("div", { alignItems: "center", justifyContent: "space-between", marginBottom: Math.round(size * 0.28) },
        h("div", { fontFamily: "Contrail One", fontSize: size, color: theme.ink, flex: 1 }, r.name),
        h("div", { width: size * 2.3, height: size * 1.25, borderRadius: size, background: theme.pill, justifyContent: "center", alignItems: "center", fontFamily: "Contrail One", fontSize: size * 0.9, color: "#fff" }, r.match == null ? "—" : r.match.toFixed(1)),
        h("div", { width: size * 3.4, justifyContent: "flex-end", fontFamily: "Contrail One", fontSize: size * 0.62, color: theme.ink }, r.season == null ? "" : `moy. ${r.season.toFixed(1)}`)))));
}
```
Render kind `ratings`: rows from `F.matchAverages(sheetIds, ctx.ratings)` for match ratings, season averages via `F.averageRating(F.playerRatingSeries(seasonMatches, seasonRatings, seasonLineups, id))` (season = `F.seasonOf(match.match_datetime)`), names via `L.postName`.

- [ ] **Step 2: Render both themes** with real or hand-made data (11 rows), save JPEGs.

- [ ] **Step 3: CHECKPOINT — show the user** the two Notes renders (domicile + extérieur) and ask for approval or changes. The spec requires this approval before integration; apply requested changes and re-show until approved. Ledger the decision.

- [ ] **Step 4: Commit** `feat: Notes Instagram visual`.

---

### Task 7: App — venue, jersey numbers, pre-match sheet

**Files:** Modify `foot.jsx`.

**Interfaces — Consumes:** `foot_matches.venue`, `foot_roster.jersey_number`. **Produces:** match form field `venue`; roster manager number input; `FootLineupSection` rendered on scheduled matches; kickoff checklist pre-filled from an existing sheet.

- [ ] **Step 1: Venue** — `FootMatchForm`: `venue: "domicile"` in `empty`, sent in `onSubmit` payload, select after the type select:

```jsx
      <select style={FOOT_INPUT_STYLE} value={f.venue || "domicile"} onChange={set("venue")}>
        <option value="domicile">Domicile</option>
        <option value="exterieur">Extérieur</option>
      </select>
```
Show "Domicile"/"Extérieur" next to the type badge in `FootMatchCard` and in `FootMatchHeader`.

- [ ] **Step 2: Jersey numbers** — in `FootRosterManager`, for players in the roster, an input left of the role select:

```jsx
          {roleByPlayer[p.id] && (
            <input defaultValue={numberByPlayer[p.id] || ""} placeholder="n°" inputMode="numeric" maxLength={3}
              onBlur={(e) => setNumber(p.id, e.target.value.trim())}
              style={{ width: 52, marginRight: 8, background: "#13131f", border: "1px solid #1e1e30", borderRadius: 6, color: "#eeeef5", padding: "5px 6px", fontSize: 12, textAlign: "center" }} />
          )}
```
with `numberByPlayer` built from `roster`, and `setNumber(pid, v)`: if `v !== "" && !/^[0-9]{1,3}$/.test(v)` → `console.warn` + reload (ignore), else `sbUpdate("foot_roster", { player_id: pid }, { jersey_number: v || null })` then `reload()`.

- [ ] **Step 3: Pre-match sheet** — in `FootScheduledView`, render `<FootLineupSection match={match} roster={roster} lineups={lineups} isAdmin={isAdmin} reload={reload} />` below the presence lists (thread `lineups` into `FootScheduledView` from `FootMatchDetailPage`). In `FootStartMatchConfig`, initialise `sheet` with `lineupIdsFor(lineups, match.id)` when non-empty, else the present roster members (current behaviour).

- [ ] **Step 4: Verify** — build, `npm test`, extend the scratch render check: scheduled match page (admin) shows "Feuille de match" with ✏️; start config pre-checks an existing sheet over presences; edit form shows the venue select with the stored value; roster manager shows the number input only for roster members.

- [ ] **Step 5: Bump + commit** `feat: football venue, jersey numbers and pre-match sheet`.

---

### Task 8: Réseaux space — shell + Photos

**Files:** Create `lib/insta/auth.js`, `api/insta/photo-sign.js`, `api/insta/photo-register.js`, `api/insta/photo-delete.js`; Modify `foot.jsx`.

**Interfaces — Produces:** `requireAdmin(req, res) -> boolean`; endpoints (all `POST`, JSON, header `X-Insta-Admin-Key`): `photo-sign {player_id, kit, kind, retouched}` → `{ uploadUrl, path }`; `photo-register {player_id, kit, kind, retouched, path, width, height}` → photo row; `photo-delete {id}` → `{ ok }`. UI: navbar tab `reseaux` (admin only), `FootReseauxPage` with sub-tabs `posts | photos | cadrage`; `instaAdminFetch(path, body)` helper reading the key from `localStorage["foot_insta_admin_key"]`.

- [ ] **Step 1: Auth**

```js
// lib/insta/auth.js
const crypto = require("crypto");
function requireAdmin(req, res) {
  const expected = process.env.INSTA_ADMIN_KEY || "";
  const got = String(req.headers["x-insta-admin-key"] || "");
  const ok = expected.length >= 12 && got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  if (!ok) res.status(401).json({ error: "Clé admin invalide" });
  return ok;
}
module.exports = { requireAdmin };
```

- [ ] **Step 2: Endpoints**

```js
// api/insta/photo-sign.js
const { requireAdmin } = require("../../lib/insta/auth");
const { SUPABASE_URL, serviceKey } = require("../../lib/insta/supabase");
const KITS = ["domicile", "exterieur"], KINDS = ["render", "celebration", "dos"];
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  if (!requireAdmin(req, res)) return;
  const { player_id, kit, kind, retouched } = req.body || {};
  if (!Number.isInteger(player_id) || !KITS.includes(kit) || !KINDS.includes(kind)) return res.status(400).json({ error: "Paramètres invalides" });
  const path = `${player_id}/${kit}/${kind}${retouched ? "-retouche" : ""}-${Date.now()}.png`;
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/upload/sign/player-photos/${path}`, { method: "POST", headers: { apikey: serviceKey(), Authorization: `Bearer ${serviceKey()}` } });
  if (!r.ok) return res.status(500).json({ error: await r.text() });
  const { url } = await r.json();
  res.status(200).json({ uploadUrl: `${SUPABASE_URL}/storage/v1${url}`, path });
};
```

```js
// api/insta/photo-register.js
const { requireAdmin } = require("../../lib/insta/auth");
const { sbWrite, sbGet, publicUrl } = require("../../lib/insta/supabase");
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  if (!requireAdmin(req, res)) return;
  const { player_id, kit, kind, retouched, path, width, height } = req.body || {};
  const head = await fetch(publicUrl("player-photos", path), { method: "HEAD" });
  if (!head.ok) return res.status(400).json({ error: "Fichier introuvable" });
  const [old] = await sbGet("foot_player_photos", `?player_id=eq.${player_id}&kit=eq.${kit}&kind=eq.${kind}&retouched=eq.${!!retouched}&select=id,path`);
  const row = { player_id, kit, kind, retouched: !!retouched, path, width, height, updated_at: new Date().toISOString() };
  const saved = await sbWrite("POST", "foot_player_photos", "?on_conflict=player_id,kit,kind,retouched", row);
  if (old && old.path !== path) await sbWrite("DELETE", "foot_photo_framings", `?photo_id=eq.${old.id}`);
  res.status(200).json(saved[0]);
};
```
(Replacing a photo drops its framings — a new image needs a new framing. The old storage object is left in place; cleanup is out of scope.)

```js
// api/insta/photo-delete.js
const { requireAdmin } = require("../../lib/insta/auth");
const { sbWrite } = require("../../lib/insta/supabase");
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  if (!requireAdmin(req, res)) return;
  const id = Number((req.body || {}).id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "id invalide" });
  await sbWrite("DELETE", "foot_player_photos", `?id=eq.${id}`);
  res.status(200).json({ ok: true });
};
```

- [ ] **Step 3: UI shell** — `FootballApp`: load `foot_player_photos` and `foot_photo_framings` in `reloadFoot` (state `photos`, `framings`); navbar item `{ id: "reseaux", l: "Réseaux", ic: "📣" }` when `isAdmin`; render `{page === "reseaux" && isAdmin && <FootReseauxPage ... />}`. `FootReseauxPage` has the three sub-tab buttons (same style as the Résumé/Notes tabs) and, at the top, an admin-key box shown when `localStorage.foot_insta_admin_key` is empty: password input + "Enregistrer la clé" (stored in localStorage, never sent anywhere except the `X-Insta-Admin-Key` header).

```jsx
const INSTA_KEY_STORAGE = "foot_insta_admin_key";
function readInstaKey() { try { return localStorage.getItem(INSTA_KEY_STORAGE) || ""; } catch (e) { return ""; } }
async function instaAdminFetch(path, body) {
  const r = await fetch(`/api/insta/${path}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Insta-Admin-Key": readInstaKey() }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Erreur ${r.status}`);
  return data;
}
```

- [ ] **Step 4: Photos tab** — for each roster player (sorted by name): a row with the name and a 3×2 grid (kinds × kits). Each cell shows the thumbnail (retouched if present, else raw, via `publicUrl`), a badge "retouchée"/"brute", an upload button (file input `accept="image/png"`) with a "retouchée" checkbox, and a delete button. Upload flow:
  1. read the file into an `Image`; if the longer side > 1600 px, draw onto a canvas scaled to 1600 and export PNG (`canvas.toBlob(..., "image/png")`) — keeps transparency, keeps uploads small;
  2. `instaAdminFetch("photo-sign", {...})` → `uploadUrl`;
  3. `fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "image/png", "x-upsert": "true" }, body: blob })`;
  4. `instaAdminFetch("photo-register", {..., path, width, height})` with the final pixel size;
  5. `reload()`. Errors shown in the cell.

`publicUrl` on the client: `${SUPABASE_URL}/storage/v1/object/public/player-photos/${path}`.

- [ ] **Step 5: Verify** — `npx vercel dev`; with the admin key set in Vercel (user) and entered in the page, upload one raw PNG of ~4.5 MB from the Drive folder through Chrome on localhost: expect resize to ≤ 1600 px, row created, thumbnail shown; delete it again. Wrong key → error "Clé admin invalide" in the cell. Render check: non-admin never sees the Réseaux tab.

- [ ] **Step 6: Bump + commit** `feat: Réseaux space with admin-key protected player photo uploads`.

---

### Task 9: Cadrage tool

**Files:** Modify `foot.jsx`, `api/insta/render.js`.

**Interfaces — Consumes:** `LAYOUTS`, `framedRect`, `defaultFraming`, `PHOTO_KIND_FOR_LAYOUT` (browser globals from `insta-logic.js`). **Produces:** `FootFramingTool`; render kind `frame` (`photo`, `layout`, optional `x`,`y`,`w`) rendering the layout with sample text.

- [ ] **Step 1: Server preview kind** — in `build`: `kind === "frame"` loads the photo row (`foot_player_photos?id=eq.<photo>`), uses `{x,y,width}` from the query when present else the saved framing, and renders: `matchday` → `matchDayEl` with opponent "ADVERSAIRE" and band "JEUDI 19H30 | STADE | VILLE"; `result` → `resultEl` with "ADVERSAIRE 3 - 1" and two sample goal lines; `groupe` → `groupeEl` with 10 sample lines; `render` → a 300×300 canvas with the white circle and the photo (`renderJpeg(el, [300, 300])`). Theme = the photo's kit.

- [ ] **Step 2: Tool UI** — selectors: player (roster players having at least one photo), kit, layout; the photo used is `choosePhoto(photos, player, PHOTO_KIND_FOR_LAYOUT[layout], kit)` (show "Aucune photo pour cet emplacement" otherwise). Preview box: a `div` with fixed aspect (1080×1350, or 300×300 for render) scaled to the available width (`scale = boxWidthPx / canvasWidth`), containing:
  - the background (`/assets/insta/bg-<kit>.jpg`, which Vercel serves statically) — for `render`, a white circle instead;
  - the photo `<img>` absolutely positioned at `rect * scale`;
  - overlay guides: the title text (Shrikhand from Google Fonts, already loadable via a `<link>` added to `index.html`) and a translucent rectangle where the layout's panel/pill/band sits, so the admin sees what will cover the photo.
  Interactions: pointer drag moves `x/y` (in canvas px = delta / scale); wheel and a range slider (50–300 %) change `width` keeping the point under the cursor fixed; two-finger pinch on touch screens via pointer events. Buttons: **Enregistrer** (upsert `foot_photo_framings` `{photo_id, layout, x, y, width}` with `SUPABASE.from(...).upsert(..., { onConflict: "photo_id,layout" })` + `assertUpsertOk`, then `reload()`), **Réinitialiser** (back to `defaultFraming`, unsaved), **Aperçu serveur** (opens `/api/insta/render?kind=frame&photo=..&layout=..&x=..&y=..&w=..` in an `<img>` under the tool).
  Overlay geometry constants (panel/pill/band boxes) live next to the tool in `foot.jsx` as `FRAMING_GUIDES` and must mirror `templates.js` values; a comment there points to `lib/insta/templates.js`.

- [ ] **Step 3: Verify** — render check (tool renders for each layout with and without photo); in Chrome on `vercel dev`: drag + zoom a raw photo for `matchday`, save, then compare the client preview with "Aperçu serveur": the player must sit at the same place (screenshot both, side by side). Repeat for `render`.

- [ ] **Step 4: Bump + commit** `feat: per-layout photo framing tool with server preview`.

---

### Task 10: Posts tab and photo import

**Files:** Modify `foot.jsx`; Create `scripts/insta-import.js`.

**Interfaces — Consumes:** `availablePosts`, `captionFor`, `goalLines`, `matchBand`, `opponentLabel` (Task 3), render endpoint (Tasks 4–6).

- [ ] **Step 1: Posts tab** — `availablePosts({ matches, lineups, now: new Date() })`; one card per post: label, the images as `<img src="/api/insta/render?...">` (matchday: pages 1–2; rankings: pages 1–3; others: single), a caption textarea pre-filled with `captionFor(kind, ctx)` built client-side from loaded data, buttons **Copier la légende** (`navigator.clipboard.writeText`) and, per image, **Ouvrir** (new tab on the render URL; the user long-presses/saves on phone). A note "Publication automatique : bientôt (plan 2)".

- [ ] **Step 2: Import script** (`scripts/insta-import.js`, run locally with `.env.local` from `vercel env pull`):
  - scans `G:\My Drive\leverculsec\25 26\PHOTOS Bière Leverculsec\Canva\26 27\{celebration,dos,render}\{domicile,extérieur}\[retouché\]<Prénom>.png`;
  - loads players + roster, proposes a mapping `fileName → player` by case/accent-insensitive first-name match against roster players, plus the jersey numbers from the plan's table (Louis 14, Nolan 02, Solal 6, Timothée 100, Nathan 11, Samuel 10, Nils 23, Etienne 28, Léandre 67, Thisma 8, Maxime/Max 27, Juju 4, Thomas 25);
  - `--dry-run` (default) prints the mapping and unmatched names;
  - `--apply --map Juju=<id>,Max=<id>,Timothée=<id>` uploads (sharp resize ≤ 1600 px, PNG) with the service role straight to Storage, upserts `foot_player_photos`, and updates `foot_roster.jersey_number`.

- [ ] **Step 3: CHECKPOINT — mapping** — run the dry run, show the mapping table to the user, get confirmation/corrections, then run `--apply`. Verify in the Photos tab that thumbnails appear and numbers show in the roster manager.

- [ ] **Step 4: Bump + commit** `feat: Réseaux posts tab with previews and captions, Drive photo import`.

---

### Task 11: Release

- [ ] **Step 1:** `npm test`, `node --check` on all JS, scratch render checks.
- [ ] **Step 2:** Confirm with the user that `SUPABASE_SERVICE_ROLE_KEY` and `INSTA_ADMIN_KEY` exist in Vercel for Production. Ask before `git push origin main`; wait for `● Ready`; `curl https://leverculsec.com/api/insta/health`.
- [ ] **Step 3:** Chrome on leverculsec.com: Réseaux tab visible for admin only; Photos thumbnails; framing a photo and "Aperçu serveur"; Posts tab previews for the real matches; no console errors. Nothing is published to Instagram in this plan.
