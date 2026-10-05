// api/insta/posts.js — GET the published / failed Instagram posts (read server-side, admin only).
const { requireAdmin } = require("../../lib/insta/auth");
const supa = require("../../lib/insta/supabase");
async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  if (!requireAdmin(req, res)) return;
  try {
    res.status(200).json({ posts: await handler.deps.list() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
handler.deps = { list: () => supa.sbGet("foot_insta_posts", "?select=*&order=created_at.desc&limit=500") };
module.exports = handler;
