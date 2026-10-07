// lib/insta/routes/photo-register.js
const { requireAdmin } = require("../../../lib/insta/auth");
const { sbWrite, sbGet, publicUrl } = require("../../../lib/insta/supabase");
const { validKey } = require("../../../lib/insta/photo-params");
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  if (!requireAdmin(req, res)) return;
  try {
    const { player_id, kit, kind, retouched, path, width, height } = req.body || {};
    const okDims = Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0;
    // The path must be one photo-sign produced for this very player/kit/kind.
    const okPath = typeof path === "string" && path.startsWith(`${player_id}/${kit}/${kind}`) && !path.includes("..");
    if (!validKey({ player_id, kit, kind }) || !okDims || !okPath) return res.status(400).json({ error: "Paramètres invalides" });
    const head = await fetch(publicUrl("player-photos", path), { method: "HEAD" });
    if (!head.ok) return res.status(400).json({ error: "Fichier introuvable" });
    const [old] = await sbGet("foot_player_photos", `?player_id=eq.${player_id}&kit=eq.${kit}&kind=eq.${kind}&retouched=eq.${!!retouched}&select=id,path`);
    const row = { player_id, kit, kind, retouched: !!retouched, path, width, height, updated_at: new Date().toISOString() };
    const saved = await sbWrite("POST", "foot_player_photos", "?on_conflict=player_id,kit,kind,retouched", row);
    if (old && old.path !== path) await sbWrite("DELETE", "foot_photo_framings", `?photo_id=eq.${old.id}`);
    res.status(200).json(saved[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
