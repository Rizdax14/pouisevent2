// api/insta/photo-delete.js
const { requireAdmin } = require("../../lib/insta/auth");
const { sbWrite } = require("../../lib/insta/supabase");
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  if (!requireAdmin(req, res)) return;
  try {
    const id = Number((req.body || {}).id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "id invalide" });
    await sbWrite("DELETE", "foot_player_photos", `?id=eq.${id}`);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
