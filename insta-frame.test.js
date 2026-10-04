// Framing-preview render (kind=frame): runs the real Satori pipeline against a stubbed database and a synthetic cut-out photo.
const test = require("node:test");
const assert = require("node:assert/strict");
const sharp = require("sharp");

const supa = require("./lib/insta/supabase");
const PHOTO = { id: 5, player_id: 3, kit: "exterieur", kind: "celebration", retouched: false, path: "3/exterieur/celebration-1.png", width: 800, height: 1000 };
let framings = [];
supa.sbGet = async (table, query) => {
  if (table === "foot_player_photos") return query.includes("id=eq.5") ? [PHOTO] : [];
  if (table === "foot_photo_framings") return framings.filter((f) => query.includes(`layout=eq.${f.layout}`));
  throw new Error("unexpected table " + table);
};
const realFetch = global.fetch;
test.before(async () => {
  const body = await sharp({ create: { width: 800, height: 1000, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: Buffer.from('<svg width="800" height="1000"><ellipse cx="400" cy="600" rx="300" ry="400" fill="#c0392b"/></svg>'), top: 0, left: 0 }]).png().toBuffer();
  global.fetch = async (url) => (String(url).includes("/player-photos/") ? new Response(body, { headers: { "content-type": "image/png" } }) : realFetch(url));
});
test.after(() => { global.fetch = realFetch; });

const R = require("./api/insta/render");
const L = require("./insta-logic.js");
const { renderJpeg } = require("./lib/insta/render");

async function frame(q) {
  const el = await R.build("frame", q);
  const size = L.LAYOUTS[q.layout].canvas;
  const jpg = await renderJpeg(el, size);
  const m = await sharp(jpg).metadata();
  return { jpg, w: m.width, h: m.height };
}

test("every layout renders at its own canvas size, with and without a saved framing", async () => {
  for (const layout of Object.keys(L.LAYOUTS)) {
    const a = await frame({ photo: "5", layout });
    assert.deepEqual([a.w, a.h], L.LAYOUTS[layout].canvas, layout);
    framings = [{ photo_id: 5, layout, x: 10, y: 20, width: 300 }];
    const b = await frame({ photo: "5", layout });
    assert.deepEqual([b.w, b.h], L.LAYOUTS[layout].canvas, layout);
    assert.notDeepEqual(a.jpg, b.jpg, `${layout}: saved framing must change the picture`);
    framings = [];
  }
});

test("query x/y/w override the saved framing", async () => {
  framings = [{ photo_id: 5, layout: "render", x: 0, y: 0, width: 300 }];
  const saved = await frame({ photo: "5", layout: "render" });
  const over = await frame({ photo: "5", layout: "render", x: "-50", y: "-20", w: "400" });
  assert.notDeepEqual(saved.jpg, over.jpg);
  framings = [];
});

test("invalid inputs are rejected with an error, not rendered", async () => {
  await assert.rejects(() => R.build("frame", { photo: "5", layout: "constructor" }), /Layout inconnu/);
  await assert.rejects(() => R.build("frame", { photo: "5", layout: "toString" }), /Layout inconnu/);
  await assert.rejects(() => R.build("frame", { photo: "5", layout: "nope" }), /Layout inconnu/);
  await assert.rejects(() => R.build("frame", { photo: "5.5", layout: "render" }), /Photo invalide/);
  await assert.rejects(() => R.build("frame", { photo: "5&select=*", layout: "render" }), /Photo invalide/);
  await assert.rejects(() => R.build("frame", { photo: "99", layout: "render" }), /Photo introuvable/);
  await assert.rejects(() => R.build("frame", { photo: "5", layout: "render", x: "a", y: "0", w: "100" }), /Cadrage invalide/);
  await assert.rejects(() => R.build("frame", { photo: "5", layout: "render", x: "0", y: "0", w: "0" }), /Cadrage invalide/);
  await assert.rejects(() => R.build("frame", { photo: "5", layout: "render", x: "0" }), /Cadrage invalide/);
});
