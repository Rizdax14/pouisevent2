// insta-logic.js — pure rules shared by the browser (globals) and Vercel functions (require)
var INSTA_FOOT_LOGIC = typeof module !== "undefined" && module.exports ? require("./foot-logic.js") : null;
function _footFn(name) { return INSTA_FOOT_LOGIC ? INSTA_FOOT_LOGIC[name] : globalThis[name]; }

const LAYOUTS = {
  // Same size as Résultat, but perfectly centred on the canvas (Résultat sits on the left, leaving room for the score).
  matchday: { canvas: [1080, 1350], box: { x: 230, y: 260, w: 620, h: 1090 } },
  result: { canvas: [1080, 1350], box: { x: -40, y: 260, w: 620, h: 1090 } },
  groupe: { canvas: [1080, 1350], box: { x: -40, y: 180, w: 700, h: 1170 } },
  render: { canvas: [300, 300], box: { x: 0, y: 0, w: 300, h: 300 } },
  // Podium cards (1st place size; 2nd/3rd cards reuse it scaled down), one layout per photo kind.
  podium_dos: { canvas: [330, 430], box: { x: 0, y: 0, w: 330, h: 430 } },
  podium_celebration: { canvas: [330, 430], box: { x: 0, y: 0, w: 330, h: 430 } },
  podium_render: { canvas: [330, 430], box: { x: 0, y: 0, w: 330, h: 430 } },
};
const PHOTO_KIND_FOR_LAYOUT = { matchday: "celebration", result: "celebration", groupe: "dos", render: "render", podium_dos: "dos", podium_celebration: "celebration", podium_render: "render" };

// Tuesday carousel pages: stat key, title, podium photo layout.
const RANKING_PAGES = [
  { key: "goals", heading: "BUTS", layout: "podium_celebration" },
  { key: "assists", heading: "PASSE D", layout: "podium_dos" },
  { key: "rating", heading: "MOYENNES", layout: "podium_render" },
];

function savedFraming(framings, photoId, layout) {
  return framings.find((f) => f.photo_id === photoId && f.layout === layout) || null;
}

// Horizontal centre (0..1) of the player in a cut-out photo: the middle of its opaque pixels (alpha above `threshold`).
function personCenterRatio(rgba, width, height, threshold = 40) {
  let min = width, max = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] > threshold) { if (x < min) min = x; if (x > max) max = x; }
    }
  }
  return max < 0 ? 0.5 : (min + max + 1) / 2 / width;
}
// Slide a framing sideways so the player (at `ratio` of the photo width) stands in the middle of the canvas.
function centerFramingOnPerson(f, canvasWidth, ratio) {
  return { ...f, x: canvasWidth / 2 - ratio * f.width };
}

function defaultFraming(layout, photo) {
  const L = LAYOUTS[layout];
  if (layout === "render" || layout.startsWith("podium_")) {
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

// Zoom a framing by `factor` keeping the canvas point (px, py) fixed; width is clamped to 20%–800% of refWidth when given.
function zoomFramingAt(f, factor, px, py, refWidth) {
  if (!(factor > 0) || !isFinite(factor)) return f;
  let width = f.width * factor;
  if (refWidth > 0) width = Math.min(refWidth * 8, Math.max(refWidth * 0.2, width));
  const k = width / f.width;
  if (k === 1) return f;
  return { x: px - (px - f.x) * k, y: py - (py - f.y) * k, width };
}

function framingZoomPercent(f, refWidth) {
  return Math.round((f.width / refWidth) * 100);
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

// Who can be featured: players on the sheet that have a photo; with no sheet (or no photo on it) the roster, guests excluded.
function featuredPool(sheetIds, roster, hasPhoto) {
  const fromSheet = sheetIds.filter(hasPhoto);
  if (fromSheet.length) return fromSheet;
  return roster.filter((r) => r.role !== "invite").map((r) => r.player_id).filter(hasPhoto);
}

// The player standing on a post. One choice for all the images of a carousel: players who have a photo of EVERY needed kind
// come first (so Match Day and Groupe show the same person), then those with the first kind. `chosen` (set by the admin) always wins.
function featuredPlayerFor({ sheetIds, roster, hasPhoto, kinds, history, seed, chosen }) {
  if (chosen) return chosen;
  const both = (id) => kinds.every((k) => hasPhoto(id, k)), first = (id) => hasPhoto(id, kinds[0]);
  const rosterIds = roster.filter((r) => r.role !== "invite").map((r) => r.player_id);
  // the sheet first (both photos, then the first kind), then the roster (guests excluded)
  const pool = [sheetIds.filter(both), sheetIds.filter(first), rosterIds.filter(both), rosterIds.filter(first)].find((p) => p.length) || [];
  return pickFeatured(pool, history, seed);
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
  const skip = new Set(["DE", "DU", "DES", "LA", "LE", "LES", "ET", "L'", "D'"]);
  return up.split(/[\s-]+/).filter((w) => w && !skip.has(w)).map((w) => w[0]).join("") || up.slice(0, 12);
}

const JOURS = ["DIMANCHE", "LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI"];
function matchBand(match) {
  // Paris time on purpose: the server (UTC) and the phone must print the same hour.
  const d = parisParts(new Date(match.match_datetime));
  const time = `${String(d.hh).padStart(2, "0")}H${String(d.mm).padStart(2, "0")}`;
  const place = (match.stadium_name || match.address || "").toUpperCase();
  return [`${JOURS[d.wd]} ${time}`, place, (match.city || "").toUpperCase()].filter(Boolean).join(" | ");
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

function goalRows(events, players) {
  const nameOf = (id) => postName(players.find((p) => p.id === id), players);
  return events.filter((e) => e.type === "goal_bl")
    .sort((a, b) => a.half - b.half || a.minute - b.minute)
    .map((e) => ({ minute: e.minute, scorer: nameOf(e.player_id), assist: e.assist_player_id ? nameOf(e.assist_player_id) : null }));
}

function goalLines(events, players) {
  return goalRows(events, players).map((g) => `${g.minute}' ${g.scorer}${g.assist ? ` (${g.assist})` : ""}`);
}

function rankingEntries(rows, key, nameOf, limit = 15) {
  return rows.filter((r) => (r[key] || 0) > 0)
    .sort((a, b) => b[key] - a[key] || nameOf(a.playerId).localeCompare(nameOf(b.playerId)))
    .slice(0, limit).map((r) => ({ playerId: r.playerId, value: r[key] }));
}

function ratingRows(sheetIds, matchAvg, seasonAvg, nameOf) {
  return sheetIds.map((id) => ({ playerId: id, name: nameOf(id), match: matchAvg[id] ?? null, season: seasonAvg[id] ?? null }))
    .sort((a, b) => {
      if (a.match == null || b.match == null) return a.match == null && b.match == null ? a.name.localeCompare(b.name) : a.match == null ? 1 : -1;
      return b.match - a.match || a.name.localeCompare(b.name);
    });
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
  if (kind === "matchday") return `MATCH DAY ⚽ Bière Leverculsec vs ${c.opponent}\n${c.band}${c.names && c.names.length ? "\n\n" + c.names.join(" · ") : ""}`;
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


// ---------- Publication schedule: sections, Paris time, last / next post ----------
const INSTA_TZ = "Europe/Paris";
const INSTA_SECTIONS = [
  // Match Day + Groupe is ONE carousel post (two images, the same player on both). `featured`: the admin can pick the player.
  { key: "matchday", kind: "matchday", label: "Match Day + Groupe", rules: ["before_match"], featured: true },
  { key: "result", kind: "result", label: "Résultat", rules: ["after_match"], featured: true },
  { key: "ratings", kind: "ratings", label: "Notes", rules: ["after_match"] },
  { key: "rankings", kind: "rankings", label: "Classements", rules: ["weekly"] },
];
const RULE_DEFAULTS = {
  matchday: { type: "before_match", days: 0, time: "09:00" },
  result: { type: "after_match", days: 0, time: "22:00" },
  ratings: { type: "after_match", days: 2, time: "12:00" },
  rankings: { type: "weekly", weekday: 2, time: "18:00" },
};
// How long a slot stays valid after its time: weekly posts 24h, post-match posts 7 days; before-match posts end at kick-off.
const WEEKLY_GRACE_MS = 24 * 3600 * 1000;
const AFTER_MATCH_WINDOW_MS = 7 * 24 * 3600 * 1000;

function parisParts(date) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: INSTA_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" });
  const p = {};
  for (const x of f.formatToParts(date)) p[x.type] = x.value;
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour, mm: +p.minute, wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) };
}
// Paris wall-clock time → instant (handles the DST switch).
function parisToDate(y, m, d, hh, mm) {
  const want = Date.UTC(y, m - 1, d, hh, mm);
  let t = want;
  for (let i = 0; i < 2; i++) {
    const p = parisParts(new Date(t));
    t += want - Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm);
  }
  return new Date(t);
}
function addDays(parts, n) {
  const d = new Date(Date.UTC(parts.y, parts.m - 1, parts.d + n));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}
function isoWeekKey(date) {
  const p = parisParts(date);
  const d = new Date(Date.UTC(p.y, p.m - 1, p.d));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
function atTime(day, time) { const [hh, mm] = time.split(":").map(Number); return parisToDate(day.y, day.m, day.d, hh, mm); }

function defaultSettings() {
  const out = {};
  for (const sec of INSTA_SECTIONS) out[sec.key] = { mode: "manual", rule: { ...RULE_DEFAULTS[sec.key] } };
  return out;
}
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
function normalizeRule(sec, rule) {
  const def = RULE_DEFAULTS[sec.key];
  if (!rule || !sec.rules.includes(rule.type)) return { ...def };
  const time = TIME_RE.test(rule.time) ? rule.time : def.time;
  if (rule.type === "weekly") return { type: "weekly", weekday: Number.isInteger(rule.weekday) && rule.weekday >= 0 && rule.weekday <= 6 ? rule.weekday : def.weekday, time };
  const days = Number.isInteger(rule.days) && rule.days >= 0 && rule.days <= 14 ? rule.days : def.days;
  return { type: rule.type, days, time };
}
function normalizeSettings(raw) {
  const out = {};
  for (const sec of INSTA_SECTIONS) {
    const r = raw && raw[sec.key];
    const mode = r && r.mode === "auto" ? "auto" : "manual";
    out[sec.key] = { mode, rule: normalizeRule(sec, r && r.rule) };
    // Automatic posts only cover slots after the moment automatic mode was switched on.
    if (mode === "auto" && r.since && !isNaN(new Date(r.since))) out[sec.key].since = new Date(r.since).toISOString();
  }
  return out;
}

function isTargetAvailable(sectionKey, m, lineups) {
  if (sectionKey === "matchday") return lineups.some((l) => l.match_id === m.id) ? { ok: true } : { ok: false, why: "Feuille de match vide" };
  if (sectionKey === "result") return m.status === "finished" ? { ok: true } : { ok: false, why: "Match pas encore terminé" };
  if (sectionKey === "ratings") return m.ratings_validated_at ? { ok: true } : { ok: false, why: m.status === "finished" ? "Notes pas encore validées" : "Match pas encore terminé" };
  return { ok: true };
}

// Inputs of captionFor, built from raw rows (same code in the app and on the server).
function captionContextFor(kind, { matchId, season }, { matches, lineups, events, ratings, players }) {
  if (kind === "rankings") return { season };
  const match = matches.find((m) => m.id === matchId);
  const sheet = lineups.filter((l) => l.match_id === matchId).map((l) => l.player_id);
  const sheetPlayers = players.filter((p) => sheet.includes(p.id));
  const nameOf = (id) => postName(players.find((p) => p.id === id), sheetPlayers);
  if (kind === "matchday") return { opponent: match.opponent_name, band: matchBand(match), names: sheet.map(nameOf) };
  if (kind === "result") {
    const evs = events.filter((e) => e.match_id === matchId);
    const sc = _footFn("computeFootScore")(evs);
    return { opponent: match.opponent_name, bl: sc.bl, opp: sc.opponent, goals: goalLines(evs, players) };
  }
  const avg = _footFn("matchAverages")(sheet, ratings.filter((r) => r.match_id === matchId));
  const top = sheet.filter((id) => avg[id] != null).sort((a, b) => avg[b] - avg[a]).slice(0, 3).map((id) => ({ name: nameOf(id), rating: avg[id] }));
  return { opponent: match.opponent_name, top };
}

function targetKey(t) {
  return t.weekKey ? `${t.kind}:week:${t.weekKey}` : `${t.kind}:match:${t.matchId}`;
}

// Everything the UI and the cron need about one section: its last post and its next one.
function sectionState(sectionKey, { matches, lineups, posts, settings, now }) {
  const sec = INSTA_SECTIONS.find((x) => x.key === sectionKey);
  const cfg = (settings && settings[sectionKey]) || defaultSettings()[sectionKey];
  const rule = cfg.rule, isAuto = cfg.mode === "auto";
  const since = isAuto && cfg.since ? new Date(cfg.since) : null;
  const mine = posts.filter((p) => p.kind === sec.kind);
  const published = mine.filter((p) => p.status === "published").sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)));
  const failuresFor = (pred) => mine.filter((p) => p.status === "failed" && pred(p)).length;
  const byDate = [...matches].sort((a, b) => new Date(a.match_datetime) - new Date(b.match_datetime));
  const season = _footFn("seasonOf");
  const hasSheet = (m) => lineups.some((l) => l.match_id === m.id);

  const available = (m) => isTargetAvailable(sectionKey, m, lineups);

  const last = published[0] ? { published: true, post: published[0], matchId: published[0].match_id, weekKey: published[0].week_key } : { published: false };

  if (sectionKey === "rankings") {
    const finished = matches.some((m) => m.status === "finished");
    const seasonNow = season(now.toISOString());
    const pubWeeks = new Set(published.map((p) => p.week_key));
    if (!last.published) { last.season = seasonNow; last.available = finished; }
    // The slot that just passed (if still inside its grace window and unpublished), otherwise the next one.
    const p = parisParts(now);
    const todayDay = addDays(p, (rule.weekday - p.wd + 7) % 7);
    const todayAt = atTime(todayDay, rule.time);
    const past = todayAt <= now ? { day: todayDay, at: todayAt } : (() => { const d = addDays(todayDay, -7); return { day: d, at: atTime(d, rule.time) }; })();
    const upcoming = todayAt > now ? { day: todayDay, at: todayAt } : (() => { const d = addDays(todayDay, 7); return { day: d, at: atTime(d, rule.time) }; })();
    let { day: slotDay, at: slot } = now - past.at < WEEKLY_GRACE_MS && !pubWeeks.has(isoWeekKey(past.at)) && (!since || past.at >= since) ? past : upcoming;
    let weekKey = isoWeekKey(slot);
    while (pubWeeks.has(weekKey)) { slotDay = addDays(slotDay, 7); slot = atTime(slotDay, rule.time); weekKey = isoWeekKey(slot); }
    const ok = finished;
    const next = { kind: sec.kind, section: sectionKey, weekKey, season: season(slot.toISOString()), available: ok, waitingFor: ok ? null : "Aucun match terminé cette saison", scheduledAt: isAuto ? slot : null, previewable: ok, failures: failuresFor((x) => x.week_key === weekKey) };
    next.due = isAuto && ok && now >= slot && now - slot < WEEKLY_GRACE_MS;
    return { section: sec, last, next };
  }

  // Match-based sections
  const isPublishedFor = (m) => published.some((p) => p.match_id === m.id);
  if (!last.published) {
    const pool = byDate.filter((m) => available(m).ok && (m.status !== "scheduled" || new Date(m.match_datetime) <= now));
    const fb = pool[pool.length - 1];
    if (fb) { last.matchId = fb.id; last.available = true; }
  }
  const slotOf = (m) => atTime(addDays(parisParts(new Date(m.match_datetime)), rule.type === "before_match" ? -rule.days : rule.days), rule.time);
  const pool2 = sec.rules[0] === "before_match"
    ? byDate.filter((m) => m.status === "scheduled" && new Date(m.match_datetime) > now && !isPublishedFor(m))
    : byDate.filter((m) => !isPublishedFor(m) && now - new Date(m.match_datetime) < AFTER_MATCH_WINDOW_MS && (m.status !== "scheduled" || new Date(m.match_datetime) > now - AFTER_MATCH_WINDOW_MS));
  const cand = pool2.find((m) => !since || slotOf(m) >= since) || null;
  if (!cand) return { section: sec, last, next: null };
  const av = available(cand);
  const kickoff = new Date(cand.match_datetime);
  let scheduledAt = null, due = false;
  if (isAuto) {
    scheduledAt = slotOf(cand);
    due = av.ok && now >= scheduledAt && (rule.type === "before_match" ? now < kickoff : now - scheduledAt < AFTER_MATCH_WINDOW_MS);
  }
  return { section: sec, last, next: { kind: sec.kind, section: sectionKey, matchId: cand.id, available: av.ok, previewable: av.ok || sectionKey === "matchday", waitingFor: av.ok ? null : av.why, scheduledAt, due, failures: failuresFor((x) => x.match_id === cand.id) } };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { LAYOUTS, PHOTO_KIND_FOR_LAYOUT, RANKING_PAGES, goalRows, savedFraming, personCenterRatio, centerFramingOnPerson, defaultFraming, framedRect, zoomFramingAt, framingZoomPercent, choosePhoto, pickFeatured, featuredPool, featuredPlayerFor, postName, opponentLabel, matchBand, groupeLines, goalLines, rankingEntries, ratingRows, rankingRows, captionFor, availablePosts, INSTA_SECTIONS, RULE_DEFAULTS, parisParts, parisToDate, isoWeekKey, defaultSettings, normalizeSettings, sectionState, targetKey, isTargetAvailable, captionContextFor };
}
