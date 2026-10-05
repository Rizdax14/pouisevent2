// api/insta/render.js
const L = require("../../insta-logic.js");
const F = require("../../foot-logic.js");
const { loadCommon, loadMatchContext, historyFor } = require("../../lib/insta/data");
const { publicUrl, sbGet } = require("../../lib/insta/supabase");
const { renderJpeg, imageDataUri, THEMES } = require("../../lib/insta/render");
const T = require("../../lib/insta/templates");

async function featuredPhoto(ctx, layout, slot, sheetIds) {
  const kind = L.PHOTO_KIND_FOR_LAYOUT[layout];
  const withPhoto = L.featuredPool(sheetIds, ctx.roster, (id) => L.choosePhoto(ctx.photos, id, kind, ctx.theme));
  const pid = L.pickFeatured(withPhoto, historyFor(ctx.history, slot), ctx.match.id);
  if (!pid) return { pid: null, rect: null, uri: null };
  const ph = L.choosePhoto(ctx.photos, pid, kind, ctx.theme);
  const fr = L.savedFraming(ctx.framings, ph.id, layout);
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
  if (kind === "result") {
    const ctx = await loadMatchContext(q.match);
    const theme = THEMES[ctx.theme];
    const sheetIds = ctx.lineups.map((l) => l.player_id);
    // Own rotation slot so Match Day and Résultat don't always feature the same player.
    const f = await featuredPhoto(ctx, "result", "celebration_result", sheetIds);
    const s = F.computeFootScore(ctx.events);
    return T.resultEl({ bg: await imageDataUri(theme.bg), theme, opponent: ctx.match.opponent_name.toUpperCase(), bl: s.bl, opp: s.opponent, goals: L.goalRows(ctx.events, ctx.players), rect: f.rect, photoUri: f.uri });
  }
  if (kind === "frame") return buildFrame(q);
  if (kind === "ratings") return buildRatings(q);
  if (kind === "rankings") return buildRankings(q);
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
  const rect = L.framedRect(layout, ph, fr);
  const photoUri = await imageDataUri(publicUrl("player-photos", ph.path));
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

async function buildRatings(q) {
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
  const rows = L.ratingRows(sheetIds, F.matchAverages(sheetIds, ctx.ratings), seasonAvg, nameOf);
  // Top 3 get their "dos" photo on the podium; missing photos fall back to initials in the template.
  await withPodiumPhotos(rows, ctx, "podium_dos", ctx.theme);
  const s = F.computeFootScore(ctx.events);
  return T.ratingsEl({ bg: await imageDataUri(theme.bg), theme, opponent: L.opponentLabel(ctx.match.opponent_name), bl: s.bl, opp: s.opponent, rows });
}

// Adds { uri, rect } to the first 3 rows from each player's photo of the layout's kind.
async function withPodiumPhotos(rows, data, layout, kit) {
  const kind = L.PHOTO_KIND_FOR_LAYOUT[layout];
  await Promise.all(rows.slice(0, 3).map(async (r) => {
    const ph = L.choosePhoto(data.photos, r.playerId, kind, kit);
    if (!ph) return;
    const fr = L.savedFraming(data.framings, ph.id, layout);
    r.rect = L.framedRect(layout, ph, fr);
    r.uri = await imageDataUri(publicUrl("player-photos", ph.path));
  }));
  return rows;
}

async function buildRankings(q) {
  const page = L.RANKING_PAGES[Number(q.page || 1) - 1];
  if (!page) throw new Error("Page de classement inconnue");
  const [common, matches, lineups, events, ratings] = await Promise.all([
    loadCommon(),
    sbGet("foot_matches", "?select=*"),
    sbGet("foot_lineups", "?select=match_id,player_id"),
    sbGet("foot_match_events", "?select=*"),
    sbGet("foot_ratings", "?select=*"),
  ]);
  const season = q.season || F.seasonOf(new Date().toISOString());
  const seasonMatches = F.filterMatchesForStats(matches, { season, type: "all" });
  // Theme follows the venue of the latest finished match of the season.
  const last = seasonMatches.filter((m) => m.status === "finished").sort((a, b) => new Date(b.match_datetime) - new Date(a.match_datetime))[0];
  const themeName = last && last.venue === "exterieur" ? "exterieur" : "domicile";
  const theme = THEMES[themeName];
  const ids = new Set(seasonMatches.map((m) => m.id));
  const seasonLineups = lineups.filter((l) => ids.has(l.match_id));
  const stats = F.computePlayerStats(seasonMatches, seasonLineups, events.filter((e) => ids.has(e.match_id)));
  const rows = F.buildStatsRows(F.statsRoster(common.roster), stats, {});
  // Season average rating + number of rated matches, for the "MOYENNES" page.
  for (const r of rows) {
    const series = F.playerRatingSeries(seasonMatches, ratings, seasonLineups, r.playerId);
    r.rating = F.averageRating(series);
    r.rated = series.length;
  }
  const nameOf = (id) => L.postName(common.players.find((p) => p.id === id), common.players);
  const byId = Object.fromEntries(rows.map((r) => [r.playerId, r]));
  const entries = L.rankingEntries(rows, page.key, nameOf).map((e) => ({
    ...e, name: nameOf(e.playerId), matches: page.key === "rating" ? byId[e.playerId].rated : byId[e.playerId].played,
  }));
  await withPodiumPhotos(entries, common, page.layout, themeName);
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
module.exports.buildRankings = buildRankings;
module.exports.buildRatings = buildRatings;
