// api/insta/photo-sign.js
const { requireAdmin } = require("../../lib/insta/auth");
const { SUPABASE_URL, authHeaders } = require("../../lib/insta/supabase");
const { validKey } = require("../../lib/insta/photo-params");
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  if (!requireAdmin(req, res)) return;
  try {
    const b = req.body || {};
    if (!validKey(b)) return res.status(400).json({ error: "Paramètres invalides" });
    const path = `${b.player_id}/${b.kit}/${b.kind}${b.retouched ? "-retouche" : ""}-${Date.now()}.png`;
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/upload/sign/player-photos/${path}`, { method: "POST", headers: authHeaders() });
    if (!r.ok) return res.status(500).json({ error: await r.text() });
    const { url } = await r.json();
    res.status(200).json({ uploadUrl: `${SUPABASE_URL}/storage/v1${url}`, path });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
