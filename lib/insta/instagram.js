// lib/insta/instagram.js — Instagram Graph API (Instagram Login) content publishing, with an injectable fetch.
const GRAPH = "https://graph.instagram.com/v23.0";

class InstagramError extends Error {
  constructor(message, { code, expired } = {}) { super(message); this.name = "InstagramError"; this.code = code; this.expired = !!expired; }
}

function createClient({ token, userId, fetchFn = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), pollMs = 2000, maxPolls = 20 }) {
  if (!token || !userId) throw new InstagramError("Instagram non configuré (jeton ou identifiant manquant)");
  async function call(method, path, params = {}) {
    const body = new URLSearchParams({ ...params, access_token: token });
    const url = method === "GET" ? `${GRAPH}${path}?${body}` : `${GRAPH}${path}`;
    const r = await fetchFn(url, method === "GET" ? { method } : { method, headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.error) {
      const e = data.error || {};
      const expired = e.code === 190 || /token|session/i.test(e.message || "") && r.status === 400 && e.type === "OAuthException";
      throw new InstagramError(expired ? "Reconnecte le compte Instagram : le jeton est expiré ou invalide" : `Instagram : ${e.message || `erreur ${r.status}`}`, { code: e.code, expired });
    }
    return data;
  }
  async function waitFinished(id) {
    for (let i = 0; i < maxPolls; i++) {
      const { status_code } = await call("GET", `/${id}`, { fields: "status_code" });
      if (status_code === "FINISHED") return;
      if (status_code === "ERROR" || status_code === "EXPIRED") throw new InstagramError(`Instagram a refusé l'image (${status_code})`);
      await sleep(pollMs);
    }
    throw new InstagramError("Instagram met trop de temps à traiter l'image");
  }
  // One image → plain post; several → carousel (children first, then the CAROUSEL container).
  // userTags[i]: [{ username, x, y }] for image i (people tagged on it); empty or missing = nobody.
  async function publishImages({ urls, caption, userTags = [] }) {
    if (!urls.length) throw new InstagramError("Aucune image à publier");
    const tagsOf = (i) => (userTags[i] && userTags[i].length ? { user_tags: JSON.stringify(userTags[i]) } : {});
    let creation;
    if (urls.length === 1) {
      creation = (await call("POST", `/${userId}/media`, { image_url: urls[0], caption, ...tagsOf(0) })).id;
    } else {
      const kids = [];
      for (const [i, u] of urls.entries()) kids.push((await call("POST", `/${userId}/media`, { image_url: u, is_carousel_item: "true", ...tagsOf(i) })).id);
      for (const k of kids) await waitFinished(k);
      creation = (await call("POST", `/${userId}/media`, { media_type: "CAROUSEL", children: kids.join(","), caption })).id;
    }
    await waitFinished(creation);
    const { id: mediaId } = await call("POST", `/${userId}/media_publish`, { creation_id: creation });
    let permalink = null;
    try { permalink = (await call("GET", `/${mediaId}`, { fields: "permalink" })).permalink || null; } catch (e) { /* the post is live; the link is a nicety */ }
    return { mediaId, permalink };
  }
  async function refreshToken() {
    const r = await fetchFn(`https://graph.instagram.com/refresh_access_token?${new URLSearchParams({ grant_type: "ig_refresh_token", access_token: token })}`);
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.access_token) throw new InstagramError(`Rafraîchissement du jeton refusé : ${(data.error && data.error.message) || r.status}`, { expired: true });
    return { token: data.access_token, expiresIn: data.expires_in };
  }
  return { publishImages, refreshToken };
}

module.exports = { createClient, InstagramError, GRAPH };
