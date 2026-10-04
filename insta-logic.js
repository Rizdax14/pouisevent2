// insta-logic.js — pure rules shared by the browser (globals) and Vercel functions (require)
var INSTA_FOOT_LOGIC = typeof module !== "undefined" && module.exports ? require("./foot-logic.js") : null;
function _footFn(name) { return INSTA_FOOT_LOGIC ? INSTA_FOOT_LOGIC[name] : globalThis[name]; }

const LAYOUTS = {
  matchday: { canvas: [1080, 1350], box: { x: 60, y: 230, w: 960, h: 1050 } },
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
  module.exports = { LAYOUTS, PHOTO_KIND_FOR_LAYOUT, RANKING_PAGES, goalRows, defaultFraming, framedRect, zoomFramingAt, framingZoomPercent, choosePhoto, pickFeatured, postName, opponentLabel, matchBand, groupeLines, goalLines, rankingEntries, ratingRows, rankingRows, captionFor, availablePosts };
}
