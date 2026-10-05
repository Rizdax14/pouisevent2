// api/insta/settings.js — GET returns, POST saves the manual/automatic mode and timing of each section.
const L = require("../../insta-logic.js");
const { requireAdmin } = require("../../lib/insta/auth");
const supa = require("../../lib/insta/supabase");
const { loadSettings } = require("../../lib/insta/publisher");
async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return res.status(405).end();
  if (!requireAdmin(req, res)) return;
  try {
    if (req.method === "GET") return res.status(200).json({ settings: await handler.deps.loadSettings() });
    const settings = L.normalizeSettings((req.body || {}).settings);
    // The activation date is set here, never trusted from the browser: only slots after it are published automatically.
    const before = await handler.deps.loadSettings();
    const stamp = handler.deps.now().toISOString();
    for (const key of Object.keys(settings)) {
      if (settings[key].mode !== "auto") delete settings[key].since;
      else settings[key].since = before[key].mode === "auto" && before[key].since ? before[key].since : stamp;
    }
    await handler.deps.save(settings);
    res.status(200).json({ settings });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
handler.deps = {
  now: () => new Date(),
  loadSettings,
  save: (settings) => supa.sbWrite("POST", "app_secrets", "?on_conflict=key", { key: "insta_settings", value: JSON.stringify(settings), updated_at: new Date().toISOString() }),
};
module.exports = handler;
