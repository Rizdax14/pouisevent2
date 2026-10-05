// lib/insta/render.js
const fs = require("fs");
const path = require("path");
const satoriMod = require("satori");
const satori = satoriMod.default || satoriMod;
const { Resvg } = require("@resvg/resvg-js");
const sharp = require("sharp");

const ROOT = process.cwd();
const FONTS = [
  { name: "Shrikhand", data: fs.readFileSync(path.join(ROOT, "fonts/Shrikhand-Regular.ttf")), weight: 400, style: "normal" },
  { name: "Contrail One", data: fs.readFileSync(path.join(ROOT, "fonts/ContrailOne-Regular.ttf")), weight: 400, style: "normal" },
];
const THEMES = {
  // Domicile inverts pill/band colours compared to extérieur (as in the Canva mockups).
  domicile: { ink: "#1f6b3d", pill: "#1f6b3d", pillBg: "#ffffff", pillInk: "#1f6b3d", bandBg: "#1f6b3d", bandInk: "#ffffff", bg: "assets/insta/bg-domicile.jpg" },
  exterieur: { ink: "#9b4f9f", pill: "#8e3f96", pillBg: "#8e3f96", pillInk: "#ffffff", bandBg: "#ffffff", bandInk: "#9b4f9f", bg: "assets/insta/bg-exterieur.jpg" },
};
const cache = new Map();
async function imageDataUri(src) {
  if (cache.has(src)) return cache.get(src);
  let buf, mime;
  if (/^https?:/.test(src)) {
    const r = await fetch(src);
    if (!r.ok) throw new Error(`image ${r.status}`);
    buf = Buffer.from(await r.arrayBuffer());
    mime = r.headers.get("content-type") || "image/png";
  } else {
    buf = fs.readFileSync(path.join(ROOT, src));
    mime = src.endsWith(".jpg") ? "image/jpeg" : "image/png";
  }
  const uri = `data:${mime};base64,${buf.toString("base64")}`;
  cache.set(src, uri);
  return uri;
}
// A photo zoomed far beyond the canvas (e.g. 5000px wide) is drawn wrongly or not at all by the SVG renderer.
// Only what shows on the canvas is kept: crop it from the source and place it at its visible position.
async function placePhoto(src, photo, rect, [cw, ch]) {
  const inside = rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= cw && rect.y + rect.height <= ch;
  if (inside) return { uri: await imageDataUri(src), rect };
  const x0 = Math.max(0, rect.x), y0 = Math.max(0, rect.y), x1 = Math.min(cw, rect.x + rect.width), y1 = Math.min(ch, rect.y + rect.height);
  if (x1 - x0 < 1 || y1 - y0 < 1) return { uri: null, rect: null };
  const r = await fetch(src);
  if (!r.ok) throw new Error(`image ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const meta = await sharp(buf).metadata();
  const k = meta.width / rect.width;
  const left = Math.max(0, Math.min(meta.width - 1, Math.round((x0 - rect.x) * k)));
  const top = Math.max(0, Math.min(meta.height - 1, Math.round((y0 - rect.y) * k)));
  const width = Math.max(1, Math.min(meta.width - left, Math.round((x1 - x0) * k)));
  const height = Math.max(1, Math.min(meta.height - top, Math.round((y1 - y0) * k)));
  const out = await sharp(buf).extract({ left, top, width, height }).resize(Math.round(x1 - x0), Math.round(y1 - y0), { fit: "fill", kernel: "lanczos3" }).png().toBuffer();
  return { uri: `data:image/png;base64,${out.toString("base64")}`, rect: { x: x0, y: y0, width: Math.round(x1 - x0), height: Math.round(y1 - y0) } };
}
async function renderJpeg(element, [width, height] = [1080, 1350]) {
  const svg = await satori(element, { width, height, fonts: FONTS });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();
  return sharp(png).jpeg({ quality: 90 }).toBuffer();
}
module.exports = { renderJpeg, imageDataUri, placePhoto, THEMES };
