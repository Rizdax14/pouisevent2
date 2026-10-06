// api/insta/player-details.js — private player details (birth date, phone, email), bureau only.
// Kept out of the browser's reach: the table has row level security and no policy, so only this endpoint (service key) touches it.
const { requireAdmin } = require("../../lib/insta/auth");
const supa = require("../../lib/insta/supabase");

function clean(b) {
  const id = Number(b.player_id);
  if (!Number.isInteger(id) || id <= 0) throw new Error("Joueur invalide");
  const text = (v) => (v == null ? "" : String(v).trim());
  const birth = text(b.birth_date), phone = text(b.phone), email = text(b.email);
  if (birth && !/^\d{4}-\d{2}-\d{2}$/.test(birth)) throw new Error("Date de naissance invalide");
  if (birth && (Number.isNaN(new Date(birth).getTime()) || birth > new Date().toISOString().slice(0, 10) || birth < "1900-01-01")) throw new Error("Date de naissance invalide");
  if (phone && !/^[0-9+().\s-]{6,25}$/.test(phone)) throw new Error("Numéro de téléphone invalide");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error("Adresse e-mail invalide");
  if (email.length > 200) throw new Error("Adresse e-mail trop longue");
  return { player_id: id, birth_date: birth || null, phone: phone || null, email: email || null, updated_at: new Date().toISOString() };
}

async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return res.status(405).end();
  if (!requireAdmin(req, res)) return;
  try {
    if (req.method === "GET") return res.status(200).json({ details: await handler.deps.list() });
    let row;
    try { row = clean(req.body || {}); } catch (e) { return res.status(400).json({ error: e.message }); }
    await handler.deps.save(row);
    res.status(200).json({ detail: row });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
handler.deps = {
  list: () => supa.sbGet("foot_player_details", "?select=player_id,birth_date,phone,email"),
  save: (row) => supa.sbWrite("POST", "foot_player_details", "?on_conflict=player_id", row),
};
module.exports = handler;
