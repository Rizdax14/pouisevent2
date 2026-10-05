// lib/insta/featured.js — the admin's explicit "player on the photo" choices, kept server-side next to the settings.
// Shape: { "<kind>:match:<id>": <playerId> }. No entry = automatic rotation.
const supa = require("./supabase");
const KEY = "insta_featured";
const KEY_RE = /^(matchday|result):match:\d+$/;

async function loadFeatured(sbGet = supa.sbGet) {
  try {
    const [row] = await sbGet("app_secrets", `?key=eq.${KEY}&select=value`);
    const map = row ? JSON.parse(row.value) : {};
    return map && typeof map === "object" ? map : {};
  } catch (e) { return {}; }
}
async function saveFeatured(map, sbWrite = supa.sbWrite) {
  await sbWrite("POST", "app_secrets", "?on_conflict=key", { key: KEY, value: JSON.stringify(map), updated_at: new Date().toISOString() });
}
module.exports = { loadFeatured, saveFeatured, KEY_RE };
