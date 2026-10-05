// api/insta/featured.js — GET the chosen players, POST { key, player_id | null } to choose (null = automatic).
const { requireAdmin } = require("../../lib/insta/auth");
const F = require("../../lib/insta/featured");
async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return res.status(405).end();
  if (!requireAdmin(req, res)) return;
  try {
    if (req.method === "GET") return res.status(200).json({ featured: await handler.deps.load() });
    const { key, player_id } = req.body || {};
    if (!F.KEY_RE.test(String(key || ""))) return res.status(400).json({ error: "Post invalide" });
    if (player_id !== null && !(Number.isInteger(player_id) && player_id > 0)) return res.status(400).json({ error: "Joueur invalide" });
    const map = await handler.deps.load();
    if (player_id === null) delete map[key]; else map[key] = player_id;
    await handler.deps.save(map);
    res.status(200).json({ featured: map });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
handler.deps = { load: () => F.loadFeatured(), save: (m) => F.saveFeatured(m) };
module.exports = handler;
