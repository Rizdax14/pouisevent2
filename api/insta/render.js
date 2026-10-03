// api/insta/render.js
const L = require("../../insta-logic.js");
const F = require("../../foot-logic.js");
const { loadCommon, loadMatchContext, historyFor } = require("../../lib/insta/data");
const { publicUrl, sbGet } = require("../../lib/insta/supabase");
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
  if (kind === "result") {
    const ctx = await loadMatchContext(q.match);
    const theme = THEMES[ctx.theme];
    const sheetIds = ctx.lineups.map((l) => l.player_id);
    // Own rotation slot so Match Day and Résultat don't always feature the same player.
    const f = await featuredPhoto(ctx, "result", "celebration_result", sheetIds);
    const s = F.computeFootScore(ctx.events);
    return T.resultEl({ bg: await imageDataUri(theme.bg), theme, opponent: ctx.match.opponent_name.toUpperCase(), bl: s.bl, opp: s.opponent, goals: L.goalLines(ctx.events, ctx.players), rect: f.rect, photoUri: f.uri });
  }
  if (kind === "ratings") return buildRatings(q);
  if (kind === "rankings") return buildRankings(q);
  throw new Error(`Type inconnu : ${kind}`);
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
  await Promise.all(rows.slice(0, 3).map(async (r) => {
    const ph = L.choosePhoto(ctx.photos, r.playerId, "dos", ctx.theme);
    if (!ph) return;
    const fr = ctx.framings.find((f) => f.photo_id === ph.id && f.layout === "podium") || null;
    r.rect = L.framedRect("podium", ph, fr);
    r.uri = await imageDataUri(publicUrl("player-photos", ph.path));
  }));
  const s = F.computeFootScore(ctx.events);
  return T.ratingsEl({ bg: await imageDataUri(theme.bg), theme, opponent: L.opponentLabel(ctx.match.opponent_name), bl: s.bl, opp: s.opponent, rows });
}

const RANKING_PAGES = { 1: ["goals", "BUTS"], 2: ["assists", "PASSE D"], 3: ["decisive", "BUTS + PASSE D"] };

async function buildRankings(q) {
  const page = RANKING_PAGES[String(q.page || "1")];
  if (!page) throw new Error("Page de classement inconnue");
  const [key, heading] = page;
  const [common, matches, lineups, events] = await Promise.all([
    loadCommon(),
    sbGet("foot_matches", "?select=*"),
    sbGet("foot_lineups", "?select=match_id,player_id"),
    sbGet("foot_match_events", "?select=*"),
  ]);
  const season = q.season || F.seasonOf(new Date().toISOString());
  const seasonMatches = F.filterMatchesForStats(matches, { season, type: "all" });
  // Theme follows the venue of the latest finished match of the season.
  const last = seasonMatches.filter((m) => m.status === "finished").sort((a, b) => new Date(b.match_datetime) - new Date(a.match_datetime))[0];
  const themeName = last && last.venue === "exterieur" ? "exterieur" : "domicile";
  const theme = THEMES[themeName];
  const ids = new Set(seasonMatches.map((m) => m.id));
  const stats = F.computePlayerStats(seasonMatches, lineups.filter((l) => ids.has(l.match_id)), events.filter((e) => ids.has(e.match_id)));
  const rows = F.buildStatsRows(F.statsRoster(common.roster), stats, {});
  const nameOf = (id) => L.postName(common.players.find((p) => p.id === id), common.players);
  const entries = await Promise.all(L.rankingEntries(rows, key, nameOf).map(async (e) => {
    const name = nameOf(e.playerId);
    const ph = L.choosePhoto(common.photos, e.playerId, "render", themeName);
    if (!ph) return { ...e, name };
    const fr = common.framings.find((f) => f.photo_id === ph.id && f.layout === "render") || null;
    return { ...e, rect: L.framedRect("render", ph, fr), uri: await imageDataUri(publicUrl("player-photos", ph.path)) };
  }));
  return T.rankingEl({ bg: await imageDataUri(theme.bg), theme, heading, entries, rows: L.rankingRows(entries.length) });
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
module.exports.buildRankings = buildRankings;
