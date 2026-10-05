// Design tokens of the football app: two themes (green = domicile, pink = extérieur) that must stay readable.
const test = require("node:test");
const assert = require("node:assert/strict");
const T = require("./foot-theme.js");

test("two themes: green and pink, each with the same set of tokens", () => {
  assert.deepEqual(Object.keys(T.FOOT_THEMES).sort(), ["green", "pink"]);
  const keys = Object.keys(T.FOOT_THEMES.green).sort();
  assert.deepEqual(Object.keys(T.FOOT_THEMES.pink).sort(), keys);
  for (const k of ["accent", "deep", "soft", "line", "text", "muted", "good", "bad", "warn", "bgImage", "label"]) assert.ok(keys.includes(k), k);
});

test("contrast(): known values", () => {
  assert.ok(Math.abs(T.contrast("#000000", "#ffffff") - 21) < 0.01);
  assert.ok(Math.abs(T.contrast("#ffffff", "#ffffff") - 1) < 0.01);
});

for (const name of ["green", "pink"]) {
  test(`${name}: every text/background pair meets WCAG AA (4.5:1)`, () => {
    const t = T.FOOT_THEMES[name];
    const pairs = [
      ["body text on card", t.text, "#ffffff"], ["muted text on card", t.muted, "#ffffff"],
      ["body text on soft", t.text, t.soft], ["muted text on soft", t.muted, t.soft],
      ["deep ink on card", t.deep, "#ffffff"], ["deep ink on soft", t.deep, t.soft],
      ["white on accent (buttons, chips)", "#ffffff", t.accent],
      ["good on card", t.good, "#ffffff"], ["bad on card", t.bad, "#ffffff"], ["warn on card", t.warn, "#ffffff"],
      ["white on good", "#ffffff", t.good], ["white on bad", "#ffffff", t.bad],
    ];
    for (const [label, fg, bg] of pairs) assert.ok(T.contrast(fg, bg) >= 4.5, `${name}: ${label} ${fg} on ${bg} = ${T.contrast(fg, bg).toFixed(2)}`);
  });
}

test("themeFor: unknown values fall back to green", () => {
  assert.equal(T.themeFor("pink"), T.FOOT_THEMES.pink);
  assert.equal(T.themeFor("blue"), T.FOOT_THEMES.green);
  assert.equal(T.themeFor(undefined), T.FOOT_THEMES.green);
});

test("withAlpha builds an rgba() from a hex colour", () => {
  assert.equal(T.withAlpha("#1f6b3d", 0.5), "rgba(31, 107, 61, 0.5)");
});

// White titles sit straight on the textured background: its lightest areas, once tinted, must keep a readable contrast.
const sharp = require("sharp");
for (const name of ["green", "pink"]) {
  test(`${name}: white text stays readable on the lightest 2% of the tinted background`, async () => {
    const t = T.FOOT_THEMES[name];
    const { data } = await sharp(require("path").join(__dirname, t.bgImage)).resize({ width: 240 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const tint = [1, 3, 5].map((i) => parseInt(t.bgTint.slice(i, i + 2), 16));
    const hex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
    const px = [];
    for (let i = 0; i < data.length; i += 3) px.push([0, 1, 2].map((k) => Math.round((data[i + k] * tint[k]) / 255)));
    px.sort((a, b) => T.contrast("#ffffff", hex(a)) - T.contrast("#ffffff", hex(b))); // lightest first
    const lightest = px[Math.floor(px.length * 0.02)];
    assert.ok(T.contrast("#ffffff", hex(lightest)) >= 4.5, `${name}: ${hex(lightest)} → ${T.contrast("#ffffff", hex(lightest)).toFixed(2)}`);
  });
}
