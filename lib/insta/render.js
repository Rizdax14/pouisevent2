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
async function renderJpeg(element, [width, height] = [1080, 1350]) {
  const svg = await satori(element, { width, height, fonts: FONTS });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();
  return sharp(png).jpeg({ quality: 90 }).toBuffer();
}
module.exports = { renderJpeg, imageDataUri, THEMES };
