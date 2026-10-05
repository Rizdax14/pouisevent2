// api/insta/publish.js — "Publier maintenant": publishes one post, exactly once.
const L = require("../../insta-logic.js");
const { requireAdmin } = require("../../lib/insta/auth");
const P = require("../../lib/insta/publisher");

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!requireAdmin(req, res)) return;
  try {
    const b = req.body || {};
    const sec = L.INSTA_SECTIONS.find((s) => s.key === b.section);
    if (!sec) return res.status(400).json({ error: "Section inconnue" });
    const data = await handler.deps.loadPublishData();
    let target;
    if (sec.key === "rankings") {
      const season = /^\d{4}-\d{4}$/.test(b.season || "") ? b.season : null;
      const weekKey = /^\d{4}-W\d{2}$/.test(b.week_key || "") ? b.week_key : null;
      if (!season || !weekKey) return res.status(400).json({ error: "Saison ou semaine invalide" });
      if (!data.matches.some((m) => m.status === "finished")) return res.status(409).json({ error: "Aucun match terminé : pas de classement" });
      target = { kind: "rankings", season, weekKey };
    } else {
      const matchId = Number(b.match_id);
      const match = data.matches.find((m) => m.id === matchId);
      if (!match) return res.status(400).json({ error: "Match introuvable" });
      const av = L.isTargetAvailable(sec.key, match, data.lineups);
      if (!av.ok) return res.status(409).json({ error: av.why });
      target = { kind: sec.kind, matchId };
      if (sec.featured) {
        const asked = b.player_id === undefined ? undefined : b.player_id;
        const saved = (await handler.deps.loadFeatured())[L.targetKey(target)];
        const player = asked === null ? null : Number.isInteger(asked) && asked > 0 ? asked : saved;
        if (player) target.player = player;
      }
    }
    const publisher = await handler.deps.makePublisher();
    const r = await publisher.publishTarget(target, { caption: b.caption, data });
    if (r.status === "failed") return res.status(502).json({ error: r.error, expired: r.expired });
    res.status(200).json(r);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
handler.deps = { loadPublishData: P.loadPublishData, makePublisher: P.makeRealPublisher, loadFeatured: () => require("../../lib/insta/featured").loadFeatured() };
module.exports = handler;
