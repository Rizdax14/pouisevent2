// api/insta/[route].js — the one Vercel function behind every /api/insta/<route> URL.
// The handlers live in lib/insta/routes/; a single function means the image toolchain (sharp, satori, resvg, fonts)
// is bundled once per deployment instead of once per route.
const ROUTES = {
  cron: () => require("../../lib/insta/routes/cron"),
  featured: () => require("../../lib/insta/routes/featured"),
  health: () => require("../../lib/insta/routes/health"),
  "photo-delete": () => require("../../lib/insta/routes/photo-delete"),
  "photo-register": () => require("../../lib/insta/routes/photo-register"),
  "photo-sign": () => require("../../lib/insta/routes/photo-sign"),
  "player-details": () => require("../../lib/insta/routes/player-details"),
  posts: () => require("../../lib/insta/routes/posts"),
  publish: () => require("../../lib/insta/routes/publish"),
  "refresh-token": () => require("../../lib/insta/routes/refresh-token"),
  render: () => require("../../lib/insta/routes/render"),
  settings: () => require("../../lib/insta/routes/settings"),
};

module.exports = async (req, res) => {
  const name = String((req.query && req.query.route) || "");
  const load = Object.prototype.hasOwnProperty.call(ROUTES, name) ? ROUTES[name] : null;
  if (!load) return res.status(404).json({ error: "not found" });
  if (req.query) delete req.query.route; // handlers only see their own parameters
  return load()(req, res);
};
module.exports.ROUTES = ROUTES;
