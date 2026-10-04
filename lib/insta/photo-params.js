// lib/insta/photo-params.js — shared validation for the photo endpoints
const KITS = ["domicile", "exterieur"], KINDS = ["render", "celebration", "dos"];
function validKey(b) {
  return Number.isInteger(b.player_id) && b.player_id > 0 && KITS.includes(b.kit) && KINDS.includes(b.kind);
}
module.exports = { KITS, KINDS, validKey };
