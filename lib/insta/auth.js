// lib/insta/auth.js
const crypto = require("crypto");
function requireAdmin(req, res) {
  const expected = process.env.INSTA_ADMIN_KEY || "";
  const got = String(req.headers["x-insta-admin-key"] || "");
  const ok = expected.length >= 12 && got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  if (!ok) res.status(401).json({ error: "Clé admin invalide" });
  return ok;
}
// Scheduled calls: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`; any other scheduler may use the admin key.
function requireCronOrAdmin(req, res) {
  const secret = process.env.CRON_SECRET || "";
  const auth = String(req.headers.authorization || "");
  if (secret.length >= 12 && auth.length === `Bearer ${secret}`.length && crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(`Bearer ${secret}`))) return true;
  return requireAdmin(req, res);
}
module.exports = { requireAdmin, requireCronOrAdmin };
