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
