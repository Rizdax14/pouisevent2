// lib/insta/auth.js
const crypto = require("crypto");
function requireAdmin(req, res) {
  const expected = process.env.INSTA_ADMIN_KEY || "";
  const got = String(req.headers["x-insta-admin-key"] || "");
  const ok = expected.length >= 12 && got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  if (!ok) res.status(401).json({ error: "Clé admin invalide" });
  return ok;
}
module.exports = { requireAdmin };
