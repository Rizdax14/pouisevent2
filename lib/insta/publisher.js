// lib/insta/publisher.js — publishes one post exactly once (manual button or automatic run).
const L = require("../../insta-logic.js");
const DRAFT_LOCK_MS = 10 * 60 * 1000; // a 'draft' younger than this means a publication is in progress

function keyQuery(t) {
  return t.weekKey ? `kind=eq.${t.kind}&week_key=eq.${encodeURIComponent(t.weekKey)}` : `kind=eq.${t.kind}&match_id=eq.${Number(t.matchId)}`;
}

function createPublisher(deps) {
  const now = deps.now || (() => new Date());

  async function rowsFor(target) {
    return deps.sbGet("foot_insta_posts", `?${keyQuery(target)}&select=id,status,created_at,permalink`);
  }
  const inProgress = (r) => r.status === "draft" && now() - new Date(r.created_at) < DRAFT_LOCK_MS;

  // target: { kind, matchId } or { kind: "rankings", weekKey, season }
  async function publishTarget(target, { caption, data } = {}) {
    const rows = await rowsFor(target);
    const done = rows.find((r) => r.status === "published");
    if (done) return { status: "already_published", post: done };
    if (rows.some(inProgress)) return { status: "in_progress" };

    const text = caption != null && String(caption).trim() ? String(caption) : L.captionFor(target.kind, L.captionContextFor(target.kind, target, data));
    const [mine] = await deps.sbWrite("POST", "foot_insta_posts", "", {
      kind: target.kind, match_id: target.matchId || null, week_key: target.weekKey || null, season: target.season || null, caption: text, status: "draft",
    });
    // Two runs may have inserted at the same time: the oldest wins, the other backs off.
    const again = await rowsFor(target);
    const winner = again.filter((r) => r.status === "published" || inProgress(r)).sort((a, b) => a.id - b.id)[0];
    if (winner && winner.id !== mine.id) {
      await deps.sbWrite("DELETE", "foot_insta_posts", `?id=eq.${mine.id}`);
      return winner.status === "published" ? { status: "already_published", post: winner } : { status: "in_progress" };
    }
    try {
      const buffers = await deps.renderImages(target, data);
      const stamp = Date.now();
      const base = target.weekKey ? `${target.kind}/${target.weekKey}` : `${target.kind}/${target.matchId}`;
      const paths = buffers.map((_, i) => `${base}-${stamp}-${i + 1}.jpg`);
      await Promise.all(buffers.map((b, i) => deps.uploadImage(paths[i], b)));
      // Tag the players who gave their Instagram username, where each image shows them.
      const userTags = (buffers.points || []).map((pts) => L.userTagsFor(pts, (data && data.instagram) || {}));
      const { mediaId, permalink } = await deps.igClient().publishImages({ urls: paths.map((p) => deps.publicUrl(p)), caption: text, userTags });
      // Remember who was on the post: the rotation then moves on to somebody else next time.
      let featured = {};
      try { const pid = deps.featuredId ? await deps.featuredId(target) : null; if (pid) featured = { [target.kind]: pid }; } catch (e) { /* the post is live; the rotation is a nicety */ }
      const [post] = await deps.sbWrite("PATCH", "foot_insta_posts", `?id=eq.${mine.id}`, { status: "published", ig_media_id: mediaId, permalink, image_paths: paths, featured, error: null, published_at: now().toISOString() });
      return { status: "published", post };
    } catch (e) {
      await deps.sbWrite("PATCH", "foot_insta_posts", `?id=eq.${mine.id}`, { status: "failed", error: String(e.message || e).slice(0, 500) }).catch(() => {});
      return { status: "failed", error: e.message, expired: !!e.expired };
    }
  }
  return { publishTarget };
}

// Wired to the real world (Supabase service role, Satori render, Instagram).
function realDeps() {
  const supa = require("./supabase");
  const { renderJpeg } = require("./render");
  return {
    sbGet: supa.sbGet, sbWrite: supa.sbWrite,
    publicUrl: (p) => supa.publicUrl("insta-posts", p),
    async uploadImage(path, buf) {
      const r = await fetch(`${supa.SUPABASE_URL}/storage/v1/object/insta-posts/${path}`, { method: "POST", headers: { ...supa.authHeaders(), "Content-Type": "image/jpeg", "x-upsert": "true" }, body: buf });
      if (!r.ok) throw new Error(`Envoi de l'image refusé (${r.status})`);
    },
    async renderImages(t) {
      const { build } = require("./routes/render");
      const player = t.player || undefined; // the admin's pick; undefined = automatic rotation
      const q = t.kind === "rankings"
        ? L.RANKING_PAGES.map((_, i) => ["rankings", { season: t.season, page: i + 1 }])
        : t.kind === "matchday" ? [1, 2].map((page) => ["matchday", { match: t.matchId, page, player }]) // carousel: Match Day, then Groupe
        : [[t.kind, { match: t.matchId, player }]];
      const points = [];
      const buffers = await Promise.all(q.map(async ([kind, params], i) => { const out = {}; const el = await build(kind, params, out); points[i] = out.points || []; return renderJpeg(el); }));
      buffers.points = points;
      return buffers;
    },
    featuredId: (t) => (t.kind === "matchday" || t.kind === "result") ? require("./routes/render").featuredPlayerOf(t.kind, { match: t.matchId, player: t.player || undefined }) : null,
    igClient() { throw new Error("Instagram non configuré"); }, // replaced by makeRealPublisher
  };
}

// The refreshed token (stored by the weekly refresh) wins over the environment one.
async function currentIgToken(sbGet) {
  try {
    const [row] = await sbGet("app_secrets", "?key=eq.instagram_token&select=value");
    if (row && row.value) return row.value;
  } catch (e) { /* fall back to the environment */ }
  return process.env.INSTAGRAM_ACCESS_TOKEN || "";
}

async function loadPublishData() {
  const { sbGet } = require("./supabase");
  const [players, roster, matches, lineups, events, ratings, posts, details] = await Promise.all([
    sbGet("players", "?select=id,name,display_name"), sbGet("foot_roster", "?select=player_id,role,jersey_number"),
    sbGet("foot_matches", "?select=*"), sbGet("foot_lineups", "?select=match_id,player_id"),
    sbGet("foot_match_events", "?select=*"), sbGet("foot_ratings", "?select=*"), sbGet("foot_insta_posts", "?select=*"),
    sbGet("foot_player_details", "?select=player_id,instagram").catch(() => []),
  ]);
  const instagram = Object.fromEntries(details.filter((d) => d.instagram).map((d) => [d.player_id, d.instagram]));
  return { players, roster, matches, lineups, events, ratings: ratings.map((r) => ({ ...r, score: Number(r.score) })), posts, instagram };
}

async function loadSettings() {
  const { sbGet } = require("./supabase");
  try {
    const [row] = await sbGet("app_secrets", "?key=eq.insta_settings&select=value");
    return L.normalizeSettings(row ? JSON.parse(row.value) : null);
  } catch (e) { return L.defaultSettings(); }
}

async function makeRealPublisher() {
  const { sbGet } = require("./supabase");
  const deps = realDeps();
  const token = await currentIgToken(sbGet);
  deps.igClient = () => require("./instagram").createClient({ token, userId: process.env.INSTAGRAM_USER_ID });
  return createPublisher(deps);
}

module.exports = { createPublisher, makeRealPublisher, loadPublishData, loadSettings, currentIgToken, DRAFT_LOCK_MS };
