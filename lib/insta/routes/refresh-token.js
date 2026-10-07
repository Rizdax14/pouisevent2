// lib/insta/routes/refresh-token.js — weekly: renews the long-lived Instagram token and stores the new one.
const { requireCronOrAdmin } = require("../../../lib/insta/auth");
const supa = require("../../../lib/insta/supabase");
const { createClient } = require("../../../lib/insta/instagram");
const P = require("../../../lib/insta/publisher");
async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return res.status(405).end();
  if (!requireCronOrAdmin(req, res)) return;
  try {
    const token = await handler.deps.currentToken();
    const { token: fresh, expiresIn } = await handler.deps.refresh(token);
    await handler.deps.store(fresh);
    res.status(200).json({ ok: true, expiresIn });
  } catch (e) {
    res.status(e.expired ? 401 : 500).json({ error: e.message });
  }
}
handler.deps = {
  currentToken: () => P.currentIgToken(supa.sbGet),
  refresh: (token) => createClient({ token, userId: process.env.INSTAGRAM_USER_ID || "x" }).refreshToken(),
  store: (t) => supa.sbWrite("POST", "app_secrets", "?on_conflict=key", { key: "instagram_token", value: t, updated_at: new Date().toISOString() }),
};
module.exports = handler;
