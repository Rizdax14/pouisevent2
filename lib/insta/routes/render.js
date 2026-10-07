// lib/insta/routes/render.js
const L = require("../../../insta-logic.js");
const F = require("../../../foot-logic.js");
const { loadCommon, loadMatchContext, historyFor } = require("../../../lib/insta/data");
const { publicUrl, sbGet } = require("../../../lib/insta/supabase");
const { renderJpeg, imageDataUri, placePhoto, THEMES } = require("../../../lib/insta/render");
const T = require("../../../lib/insta/templates");

// The player standing on a post. `kinds` lists the photo kinds of every image of the post (Match Day + Groupe: celebration and dos),
// so all its images show the same person; `chosen` is the admin's explicit pick (?player=).
function featuredId(ctx, slot, sheetIds, kinds, chosen) {
  return L.featuredPlayerFor({
    sheetIds, roster: ctx.roster, kinds, chosen: Number.isInteger(chosen) && chosen > 0 ? chosen : null,
    hasPhoto: (id, kind) => !!L.choosePhoto(ctx.photos, id, kind, ctx.theme),
    history: historyFor(ctx.history, slot), seed: ctx.match.id,
  });
}
const CHOSEN = (q) => (q && q.player !== undefined && /^\d+$/.test(String(q.player)) ? Number(q.player) : null);

async function featuredPhoto(ctx, layout, slot, sheetIds, kinds, chosen) {
  const kind = L.PHOTO_KIND_FOR_LAYOUT[layout];
  const pid = featuredId(ctx, slot, sheetIds, kinds || [kind], chosen);
  if (!pid) return { pid: null, rect: null, uri: null };
  const ph = L.photoOrDefault(ctx.photos, pid, kind, ctx.theme);
  if (!ph) return { pid, rect: null, uri: null };
  const fr = L.savedFraming(ctx.framings, ph.id, layout);
  const full = L.framedRect(layout, ph, fr); // the whole photo, even where it leaves the canvas
  const placed = await placePhoto(publicUrl("player-photos", ph.path), ph, full, L.LAYOUTS[layout].canvas);
  return { pid, rect: placed.rect, uri: placed.uri, full };
}

// Where each player is tagged on the post (canvas px), collected in `out.points` when asked.
// Podiums: bottom-left of each of the 3 photo cards (above the name pill).
function podiumPoints(rows) {
  return rows.slice(0, 3).map((r, i) => ({ playerId: r.playerId, x: T.PODIUM[i].left + 44, y: T.PODIUM[i].top + T.PODIUM[i].h - 74 }));
}

async function build(kind, q, out) {
  const tag = (pts) => { if (out) out.points = (pts || []).filter((p) => p && p.playerId); };
  if (kind === "matchday") {
    const ctx = await loadMatchContext(q.match);
    const theme = THEMES[ctx.theme];
    const bg = await imageDataUri(theme.bg);
    const sheetIds = ctx.lineups.map((l) => l.player_id);
    if (String(q.page || "1") === "2") {
      const f = await featuredPhoto(ctx, "groupe", "matchday", sheetIds, ["celebration", "dos"], CHOSEN(q));
      // On his back photo: the name printed on the shirt, about halfway down the photo (as shot), centred.
      tag(f.full ? [{ playerId: f.pid, x: Math.min(1050, Math.max(30, f.full.x + f.full.width * 0.5)), y: Math.min(1320, Math.max(30, f.full.y + f.full.height * 0.48)) }] : []);
      return T.groupeEl({ bg, theme, lines: L.groupeLines(sheetIds, ctx.roster, ctx.players), rect: f.rect, photoUri: f.uri });
    }
    const f = await featuredPhoto(ctx, "matchday", "matchday", sheetIds, ["celebration", "dos"], CHOSEN(q));
    tag([]);
    return T.matchDayEl({ bg, theme, opponent: L.opponentLabel(ctx.match.opponent_name), bandText: L.matchBand(ctx.match), rect: f.rect, photoUri: f.uri });
  }
  if (kind === "result") {
    const ctx = await loadMatchContext(q.match);
    const theme = THEMES[ctx.theme];
    const sheetIds = ctx.lineups.map((l) => l.player_id);
    // Own rotation slot so Match Day and Résultat don't always feature the same player.
    const f = await featuredPhoto(ctx, "result", "result", sheetIds, ["celebration"], CHOSEN(q));
    const s = F.computeFootScore(ctx.events);
    tag([{ playerId: f.pid, x: 86, y: 1242 }]); // bottom-left of the post
    return T.resultEl({ bg: await imageDataUri(theme.bg), theme, opponent: ctx.match.opponent_name.toUpperCase(), bl: s.bl, opp: s.opponent, goals: L.goalRows(ctx.events, ctx.players), rect: f.rect, photoUri: f.uri });
  }
  if (kind === "frame") return buildFrame(q);
  if (kind === "ratings") return buildRatings(q, tag);
  if (kind === "rankings") return buildRankings(q, tag);
  throw new Error(`Type inconnu : ${kind}`);
}

// Framing preview: one layout with sample text and a photo placed by ?x&y&w, or by its saved framing.
async function buildFrame(q) {
  const layout = q.layout;
  if (!Object.prototype.hasOwnProperty.call(L.LAYOUTS, layout)) throw new Error("Layout inconnu");
  const id = Number(q.photo);
  if (!Number.isInteger(id)) throw new Error("Photo invalide");
  const [ph] = await sbGet("foot_player_photos", `?id=eq.${id}&select=*`);
  if (!ph) throw new Error("Photo introuvable");
  let fr = null;
  if (q.x !== undefined || q.y !== undefined || q.w !== undefined) {
    fr = { x: Number(q.x), y: Number(q.y), width: Number(q.w) };
    if (![fr.x, fr.y, fr.width].every(Number.isFinite) || fr.width <= 0) throw new Error("Cadrage invalide");
  } else {
    [fr = null] = await sbGet("foot_photo_framings", `?photo_id=eq.${id}&layout=eq.${layout}&select=*`);
  }
  const { uri: photoUri, rect } = await placePhoto(publicUrl("player-photos", ph.path), ph, L.framedRect(layout, ph, fr), L.LAYOUTS[layout].canvas);
  const theme = THEMES[ph.kit];
  const [w, h] = L.LAYOUTS[layout].canvas;
  if (layout === "render") return T.maskedPhotoEl({ w, h, radius: 150, fill: "#ffffff", rect, photoUri });
  if (layout.startsWith("podium_")) return T.maskedPhotoEl({ w, h, radius: 40, fill: "#ffffff", rect, photoUri });
  const bg = await imageDataUri(theme.bg);
  if (layout === "matchday") return T.matchDayEl({ bg, theme, opponent: "ADVERSAIRE", bandText: "JEUDI 19H30 | STADE | VILLE", rect, photoUri });
  if (layout === "result") return T.resultEl({ bg, theme, opponent: "ADVERSAIRE", bl: 3, opp: 1, goals: [{ minute: 12, scorer: "Joueur", assist: "Passeur" }, { minute: 47, scorer: "Joueur", assist: null }], rect, photoUri });
  const lines = Array.from({ length: 10 }, (_, i) => ({ number: String(i + 1), name: "Joueur" }));
  return T.groupeEl({ bg, theme, lines, rect, photoUri });
}

async function buildRatings(q, tag = () => {}) {
  const ctx = await loadMatchContext(q.match);
  const theme = THEMES[ctx.theme];
  const sheetIds = ctx.lineups.map((l) => l.player_id);
  const season = F.seasonOf(ctx.match.match_datetime);
  const [matches, lineups, ratings] = await Promise.all([
    sbGet("foot_matches", "?select=*"),
    sbGet("foot_lineups", "?select=match_id,player_id"),
    sbGet("foot_ratings", "?select=*"),
  ]);
  const seasonMatches = F.filterMatchesForStats(matches, { season, type: "all" });
  const seasonAvg = {};
  for (const id of sheetIds) seasonAvg[id] = F.averageRating(F.playerRatingSeries(seasonMatches, ratings, lineups, id));
  const sheetPlayers = ctx.players.filter((p) => sheetIds.includes(p.id));
  const nameOf = (id) => L.postName(ctx.players.find((p) => p.id === id), sheetPlayers);
  const rows = L.ratingRows(sheetIds, F.finalAverages(ctx.match, sheetIds, ctx.ratings), seasonAvg, nameOf);
  // Top 3 get their "dos" photo on the podium; missing photos fall back to initials in the template.
  await withPodiumPhotos(rows, ctx, "podium_dos", ctx.theme);
  tag(podiumPoints(rows));
  const s = F.computeFootScore(ctx.events);
  return T.ratingsEl({ bg: await imageDataUri(theme.bg), theme, opponent: L.opponentLabel(ctx.match.opponent_name), bl: s.bl, opp: s.opponent, rows });
}

// Adds { uri, rect } to the first 3 rows from each player's photo of the layout's kind.
async function withPodiumPhotos(rows, data, layout, kit) {
  const kind = L.PHOTO_KIND_FOR_LAYOUT[layout];
  await Promise.all(rows.slice(0, 3).map(async (r) => {
    const ph = L.photoOrDefault(data.photos, r.playerId, kind, kit);
    if (!ph) return;
    const fr = L.savedFraming(data.framings, ph.id, layout);
    const placed = await placePhoto(publicUrl("player-photos", ph.path), ph, L.framedRect(layout, ph, fr), L.LAYOUTS[layout].canvas);
    r.rect = placed.rect;
    r.uri = placed.uri;
  }));
  return rows;
}

async function buildRankings(q, tag = () => {}) {
  const page = L.RANKING_PAGES[Number(q.page || 1) - 1];
  if (!page) throw new Error("Page de classement inconnue");
  const [common, matches, lineups, events, ratings, motmVotes] = await Promise.all([
    loadCommon(),
    sbGet("foot_matches", "?select=*"),
    sbGet("foot_lineups", "?select=match_id,player_id"),
    sbGet("foot_match_events", "?select=*"),
    sbGet("foot_ratings", "?select=*"),
    sbGet("foot_motm_votes", "?select=match_id,voter_id,player_id").catch(() => []),
  ]);
  const season = q.season || F.seasonOf(new Date().toISOString());
  const seasonMatches = F.filterMatchesForStats(matches, { season, type: "all" });
  // Theme follows the venue of the latest finished match of the season.
  const last = seasonMatches.filter((m) => m.status === "finished").sort((a, b) => new Date(b.match_datetime) - new Date(a.match_datetime))[0];
  const themeName = last && last.venue === "exterieur" ? "exterieur" : "domicile";
  const theme = THEMES[themeName];
  const ids = new Set(seasonMatches.map((m) => m.id));
  const seasonLineups = lineups.filter((l) => ids.has(l.match_id));
  const stats = F.computePlayerStats(seasonMatches, seasonLineups, events.filter((e) => ids.has(e.match_id)), F.motmWinners(seasonMatches, motmVotes));
  const rows = F.buildStatsRows(F.statsPopulation(common.roster, season, seasonLineups), stats, {});
  // Season average rating + number of rated matches, for the "MOYENNES" page.
  for (const r of rows) {
    const series = F.playerRatingSeries(seasonMatches, ratings, seasonLineups, r.playerId);
    r.rating = F.averageRating(series);
    r.rated = series.length;
    if (season === "all") r.ratedSeasons = L.ratedSeasonsOf(series, F.seasonOf);
  }
  const nameOf = (id) => L.postName(common.players.find((p) => p.id === id), common.players);
  const byId = Object.fromEntries(rows.map((r) => [r.playerId, r]));
  const entries = L.rankingEntries(rows, page.key, nameOf).map((e) => ({
    ...e, name: nameOf(e.playerId), matches: page.key === "rating" ? byId[e.playerId].rated : byId[e.playerId].played,
  }));
  await withPodiumPhotos(entries, common, page.layout, themeName);
  tag(podiumPoints(entries));
  return T.rankingEl({ bg: await imageDataUri(theme.bg), theme, heading: page.heading, season, entries, decimals: page.key === "rating" });
}

module.exports = async (req, res) => {
  try {
    const el = await build(req.query.kind, req.query);
    const size = req.query.kind === "frame" && L.LAYOUTS[req.query.layout] ? L.LAYOUTS[req.query.layout].canvas : undefined;
    const jpg = await renderJpeg(el, size);
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(jpg);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};
module.exports.build = build;
module.exports.featuredPhoto = featuredPhoto;
// Who will be on a post (used to record it for the rotation): same inputs as the render itself.
module.exports.featuredPlayerOf = async (kind, q) => {
  const ctx = await loadMatchContext(q.match);
  const sheetIds = ctx.lineups.map((l) => l.player_id);
  return featuredId(ctx, kind, sheetIds, kind === "matchday" ? ["celebration", "dos"] : ["celebration"], CHOSEN(q));
};
module.exports.buildRankings = buildRankings;
module.exports.buildRatings = buildRatings;
