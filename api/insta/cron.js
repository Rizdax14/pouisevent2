// api/insta/cron.js — runs often (external scheduler) and publishes every automatic post whose slot has come.
// `?dry=1` only reports what would be published.
const L = require("../../insta-logic.js");
const { requireCronOrAdmin } = require("../../lib/insta/auth");
const P = require("../../lib/insta/publisher");
const MAX_FAILURES = 3; // an automatic post that failed this many times stays for a manual retry

async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return res.status(405).end();
  if (!requireCronOrAdmin(req, res)) return;
  try {
    const dry = String((req.query || {}).dry || "") === "1";
    const [data, settings, featured] = await Promise.all([handler.deps.loadPublishData(), handler.deps.loadSettings(), handler.deps.loadFeatured()]);
    const now = handler.deps.now();
    const report = [];
    let publisher = null;
    for (const sec of L.INSTA_SECTIONS) {
      if (settings[sec.key].mode !== "auto") { report.push({ section: sec.key, action: "manuel" }); continue; }
      const { next } = L.sectionState(sec.key, { matches: data.matches, lineups: data.lineups, posts: data.posts, settings, now });
      if (!next) { report.push({ section: sec.key, action: "rien à publier" }); continue; }
      if (!next.due) { report.push({ section: sec.key, action: next.available ? "pas encore l'heure" : `en attente : ${next.waitingFor}`, scheduledAt: next.scheduledAt }); continue; }
      if (next.failures >= MAX_FAILURES) { report.push({ section: sec.key, action: "abandon automatique après 3 échecs : à republier à la main" }); continue; }
      if (dry) { report.push({ section: sec.key, action: "serait publié", target: L.targetKey(next) }); continue; }
      publisher = publisher || (await handler.deps.makePublisher());
      const player = featured[L.targetKey(next)] || undefined; // the admin's pick for this match, if any
      const r = await publisher.publishTarget({ kind: next.kind, matchId: next.matchId, weekKey: next.weekKey, season: next.season, player }, { data });
      report.push({ section: sec.key, action: r.status, target: L.targetKey(next), error: r.error });
    }
    res.status(200).json({ ok: true, dry, now, report });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
handler.deps = { loadPublishData: P.loadPublishData, loadSettings: P.loadSettings, makePublisher: P.makeRealPublisher, loadFeatured: () => require("../../lib/insta/featured").loadFeatured(), now: () => new Date() };
module.exports = handler;
