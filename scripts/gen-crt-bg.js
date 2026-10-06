// scripts/gen-crt-bg.js — draws the "écran cathodique" backgrounds of the app and of the Instagram visuals.
// Run: node scripts/gen-crt-bg.js   (writes assets/foot/bg-*.jpg and assets/insta/bg-*.jpg)
// Layers, bottom to top: tube gradient, soft light reflections, RGB phosphor columns, scanlines, grain, dark tube corners.
const sharp = require("sharp");
const path = require("path");

const PALETTES = {
  green: { light: "#3f9460", mid: "#25703f", deep: "#0c3a20" },
  pink: { light: "#a352ab", mid: "#7f3487", deep: "#36103e" },
};

function svg(w, h, p, k) {
  const line = Math.max(2, Math.round(2 * k)); // scanline thickness
  const step = line * 2;
  const ph = Math.max(1, Math.round(k)); // phosphor column width
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <radialGradient id="tube" cx="25%" cy="15%" r="120%">
      <stop offset="0" stop-color="${p.light}"/><stop offset="0.42" stop-color="${p.mid}"/><stop offset="1" stop-color="${p.deep}"/>
    </radialGradient>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${60 * k}"/></filter>
    <pattern id="phos" width="${ph * 3}" height="10" patternUnits="userSpaceOnUse">
      <rect x="0" width="${ph}" height="10" fill="#ff3c3c" opacity="0.06"/>
      <rect x="${ph}" width="${ph}" height="10" fill="#3cff3c" opacity="0.06"/>
      <rect x="${ph * 2}" width="${ph}" height="10" fill="#3c3cff" opacity="0.06"/>
    </pattern>
    <pattern id="scan" width="10" height="${step}" patternUnits="userSpaceOnUse">
      <rect y="0" width="10" height="${line}" fill="#000" opacity="0.2"/>
    </pattern>
    <radialGradient id="vig" cx="50%" cy="46%" r="70%">
      <stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.6"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#tube)"/>
  <g filter="url(#soft)">
    <ellipse cx="${w * 0.7}" cy="${h * 0.33}" rx="${w * 0.42}" ry="${h * 0.12}" fill="#fff" opacity="0.16"/>
    <ellipse cx="${w * 0.22}" cy="${h * 0.74}" rx="${w * 0.36}" ry="${h * 0.1}" fill="#fff" opacity="0.1"/>
  </g>
  <rect width="${w}" height="${h}" fill="url(#phos)"/>
  <rect width="${w}" height="${h}" fill="url(#scan)"/>
  <rect width="${w}" height="${h}" fill="url(#vig)"/>
</svg>`;
}

// Grey noise centred on mid-grey: overlaid, it adds grain without shifting the colours.
function grain(w, h, amount) {
  const buf = Buffer.alloc(w * h);
  let s = 12345;
  for (let i = 0; i < buf.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; buf[i] = 128 + Math.round(((s / 0x7fffffff) - 0.5) * 2 * amount); }
  return sharp(buf, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
}

async function make(out, w, h, palette, k) {
  const base = await sharp(Buffer.from(svg(w, h, PALETTES[palette], k))).png().toBuffer();
  const noise = await grain(w, h, 34);
  await sharp(base).composite([{ input: noise, blend: "overlay" }]).jpeg({ quality: 86 }).toFile(path.join(__dirname, "..", out));
  console.log("wrote", out);
}

(async () => {
  await make("assets/foot/bg-green.jpg", 720, 900, "green", 1);
  await make("assets/foot/bg-pink.jpg", 720, 900, "pink", 1);
  await make("assets/insta/bg-domicile.jpg", 1080, 1350, "green", 1.5);
  await make("assets/insta/bg-exterieur.jpg", 1080, 1350, "pink", 1.5);
})();
