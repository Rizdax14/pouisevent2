// lib/insta/templates.js
function h(type, style, ...children) {
  const kids = children.flat().filter((c) => c !== null && c !== undefined && c !== false);
  return { type, props: { style: type === "img" ? style : { display: "flex", ...style }, children: kids.length === 1 ? kids[0] : kids } };
}
function img(src, style) { return { type: "img", props: { src, style, width: style.width, height: style.height } }; }
function canvas(bgUri, ...children) {
  return h("div", { width: 1080, height: 1350, position: "relative", overflow: "hidden" }, img(bgUri, { position: "absolute", left: 0, top: 0, width: 1080, height: 1350 }), ...children);
}
// Sizes chosen so each title spans the canvas like in the Canva "26-27" mockups.
const TITLE_SIZES = { "MATCH DAY": 158, GROUPE: 234, RESULTAT: 180, NOTES: 200, BUTS: 180, "PASSE D": 180, "BUTS + PASSE D": 121 };
function title(text) {
  const size = TITLE_SIZES[text] || 150;
  return h("div", { position: "absolute", top: -Math.round(size * 0.07 + Math.max(0, size - 160) * 0.15), left: 0, width: 1080, justifyContent: "center", fontFamily: "Shrikhand", fontSize: size, lineHeight: 1.2, whiteSpace: "nowrap", color: "#ffffff", textShadow: "4px 7px 8px rgba(0,0,0,0.28)" }, text);
}
function photo(rect, src) {
  if (!rect || !src) return null;
  return img(src, { position: "absolute", left: rect.x, top: rect.y, width: rect.width, height: rect.height });
}
function pill(text, theme) {
  // Anchored to the right edge (bleeding off-canvas like the Canva mockup) and growing leftwards with the name.
  // Shrikhand capitals run up to ~0.7 em wide; keep the label under ~640px.
  const label = `vs ${text}`;
  const size = Math.min(70, Math.floor(640 / (label.length * 0.7)));
  return h("div", { position: "absolute", top: 180, right: -70, height: 120, borderRadius: 60, background: theme.pillBg, alignItems: "center", paddingLeft: 42, paddingRight: 70 + 40, fontFamily: "Shrikhand", fontSize: size, whiteSpace: "nowrap", color: theme.pillInk, boxShadow: "6px 8px 10px rgba(0,0,0,0.25)" }, label);
}
function band(text, theme) {
  return h("div", { position: "absolute", bottom: 22, left: 44, width: 992, height: 68, borderRadius: 34, background: theme.bandBg, justifyContent: "center", alignItems: "center", fontFamily: "Shrikhand", fontSize: text.length > 42 ? 30 : 35, whiteSpace: "nowrap", color: theme.bandInk, boxShadow: "6px 8px 10px rgba(0,0,0,0.25)" }, text);
}
function matchDayEl({ bg, theme, opponent, bandText, rect, photoUri }) {
  return canvas(bg, photo(rect, photoUri), title("MATCH DAY"), pill(opponent, theme), band(bandText, theme));
}
function listPanel(lines, theme, { left, top, width, height, max = 10 }) {
  // Contrail One averages ~0.43 em per character: shrink so the longest line fits, cap at the Canva size.
  const inner = width - 54;
  const longest = Math.max(1, ...lines.map((t) => t.length));
  const byWidth = Math.floor(inner / (longest * 0.43));
  const byHeight = Math.floor((height - 60) / Math.max(lines.length, max) / 1.12);
  const size = Math.max(30, Math.min(79, byWidth, byHeight));
  return h("div", { position: "absolute", left, top, width, height, borderRadius: 44, background: "rgba(255,255,255,0.94)", flexDirection: "column", justifyContent: "center", paddingLeft: 34, paddingRight: 20, boxShadow: "10px 12px 0 rgba(0,0,0,0.22)" },
    lines.map((t) => h("div", { fontFamily: "Contrail One", fontSize: size, lineHeight: 1.12, whiteSpace: "nowrap", color: theme.ink, textShadow: "2px 3px 0 rgba(0,0,0,0.12)" }, t)));
}
function groupeEl({ bg, theme, lines, rect, photoUri }) {
  const text = lines.map((l) => (l.number ? `${l.number}. ${l.name}` : l.name));
  return canvas(bg, photo(rect, photoUri), title("GROUPE"), listPanel(text, theme, { left: 608, top: 300, width: 412, height: 960 }));
}
function scoreBlock(opponent, bl, opp) {
  const line = (t, size, top) => h("div", { position: "absolute", top, left: 400, width: 680, justifyContent: "center", fontFamily: "Shrikhand", fontSize: size, whiteSpace: "nowrap", color: "#ffffff", textShadow: "4px 7px 8px rgba(0,0,0,0.28)" }, t);
  // Shrikhand averages ~0.65 em per character: shrink long names to fit the 680px column, abbreviate if unreadable.
  let name = opponent;
  let oppSize = Math.min(74, Math.floor(650 / (name.length * 0.65)));
  if (oppSize < 40) { name = require("../../insta-logic.js").opponentLabel(opponent); oppSize = Math.min(74, Math.floor(650 / (name.length * 0.65))); }
  return [line("LEVERCULSEC", 78, 225), line(`${bl} - ${opp}`, 132, 295), line(name, oppSize, 452 + (74 - oppSize) / 2)];
}

function resultEl({ bg, theme, opponent, bl, opp, goals, rect, photoUri }) {
  const lines = goals.length ? goals : ["Aucun but"];
  const longest = Math.max(...lines.map((t) => t.length));
  const size = Math.max(28, Math.min(54, Math.floor(440 / (longest * 0.43)), Math.floor(500 / lines.length / 1.12)));
  return canvas(bg, photo(rect, photoUri), title("RESULTAT"), ...scoreBlock(opponent, bl, opp),
    h("div", { position: "absolute", left: 395, top: 625, width: 505, height: 640, borderRadius: 44, background: "rgba(255,255,255,0.94)", flexDirection: "column", alignItems: "center", paddingTop: 22, boxShadow: "10px 12px 0 rgba(0,0,0,0.22)" },
      h("div", { fontFamily: "Shrikhand", fontSize: 66, color: theme.ink, marginBottom: 6 }, "buts :"),
      h("div", { flexDirection: "column", alignItems: "center" },
        lines.map((t) => h("div", { fontFamily: "Contrail One", fontSize: size, lineHeight: 1.12, whiteSpace: "nowrap", color: theme.ink, textShadow: "2px 3px 0 rgba(0,0,0,0.12)" }, t)))));
}

function rankingEl({ bg, theme, heading, entries, rows }) {
  let i = 0;
  const rowEls = rows.map((n, r) => {
    const d = r === 0 ? 250 : 212;
    const cells = entries.slice(i, i + n);
    i += n;
    return h("div", { justifyContent: "center", gap: 28, marginBottom: 16 },
      cells.map((e) => h("div", { flexDirection: "column", alignItems: "center", width: d + 30 },
        h("div", { width: d, height: d, borderRadius: d / 2, background: "#ffffff", overflow: "hidden", position: "relative", justifyContent: "center", alignItems: "center", boxShadow: "6px 8px 0 rgba(0,0,0,0.18)" },
          e.uri
            ? img(e.uri, { position: "absolute", left: (e.rect.x * d) / 300, top: (e.rect.y * d) / 300, width: (e.rect.width * d) / 300, height: (e.rect.height * d) / 300 })
            // No render photo yet: the first name, shrunk to fit the circle (Shrikhand ~0.65 em/char).
            : h("div", { fontFamily: "Shrikhand", fontSize: Math.min(Math.round(d / 4), Math.floor((d - 40) / (e.name.length * 0.65))), whiteSpace: "nowrap", color: theme.ink }, e.name)),
        h("div", { marginTop: -24, width: d * 0.74, height: 66, borderRadius: 33, background: theme.pill, justifyContent: "center", alignItems: "center", fontFamily: "Contrail One", fontSize: 46, color: "#ffffff", boxShadow: "4px 6px 0 rgba(0,0,0,0.18)" }, String(e.value)))));
  });
  return canvas(bg, title(heading),
    h("div", { position: "absolute", top: 185, left: 0, width: 1080, flexDirection: "column" }, rowEls));
}

// Podium cards for the top 3 (index 0 = 1st, centred and tallest). `rect` is relative to the card box.
const PODIUM = [
  { left: 375, top: 300, w: 330, h: 430 },
  { left: 45, top: 370, w: 300, h: 360 },
  { left: 735, top: 370, w: 300, h: 360 },
];
function podiumCard(r, i, theme) {
  const P = PODIUM[i];
  const fmt = (v) => (v == null ? "—" : v.toFixed(1));
  // The name shares the pill with the 104px rating chip.
  const nameSize = Math.min(i === 0 ? 50 : 44, Math.floor((P.w - 20 - 38 - 104 - 12) / (r.name.length * 0.48)));
  return h("div", { position: "absolute", left: P.left, top: P.top, width: P.w, flexDirection: "column", alignItems: "center" },
    h("div", { width: P.w, height: P.h, borderRadius: 40, background: "rgba(255,255,255,0.94)", overflow: "hidden", position: "relative", justifyContent: "center", alignItems: "center", boxShadow: "10px 12px 0 rgba(0,0,0,0.22)" },
      r.uri
        // rect is framed on the 330px-wide "podium" layout; smaller cards scale it down.
        ? img(r.uri, { position: "absolute", left: (r.rect.x * P.w) / 330, top: (r.rect.y * P.w) / 330, width: (r.rect.width * P.w) / 330, height: (r.rect.height * P.w) / 330 })
        : h("div", { fontFamily: "Shrikhand", fontSize: P.w / 2.6, color: theme.ink }, r.name.slice(0, 2).toUpperCase())),
    h("div", { position: "absolute", left: -14, top: -18, width: 92, height: 92, borderRadius: 46, background: theme.pill, border: "5px solid #ffffff", justifyContent: "center", alignItems: "center", fontFamily: "Shrikhand", fontSize: 50, color: "#ffffff", boxShadow: "4px 6px 0 rgba(0,0,0,0.18)" }, String(i + 1)),
    h("div", { marginTop: -46, width: P.w - 20, height: 92, borderRadius: 46, background: theme.pill, alignItems: "center", paddingLeft: 26, paddingRight: 12, boxShadow: "6px 8px 0 rgba(0,0,0,0.2)" },
      h("div", { flex: 1, fontFamily: "Contrail One", fontSize: nameSize, whiteSpace: "nowrap", color: "#ffffff" }, r.name),
      h("div", { width: 104, height: 70, borderRadius: 35, background: "#ffffff", justifyContent: "center", alignItems: "center", fontFamily: "Shrikhand", fontSize: 40, color: theme.ink }, fmt(r.match))),
    h("div", { marginTop: 8, fontFamily: "Contrail One", fontSize: 30, whiteSpace: "nowrap", color: "#ffffff", textShadow: "2px 3px 4px rgba(0,0,0,0.35)" }, r.season == null ? "" : `moy. saison ${fmt(r.season)}`));
}

function ratingsEl({ bg, theme, opponent, bl, opp, rows }) {
  const scoreLine = `LEVERCULSEC ${bl} - ${opp} ${opponent}`;
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  // Ranks 4+ go in a table under the podium: one column up to 8 rows, two columns beyond.
  const cols = rest.length > 8 ? 2 : 1;
  const perCol = Math.ceil(rest.length / cols);
  const colW = cols === 2 ? (940 - 60) / 2 : 660;
  const moyW = cols === 2 ? 2.6 : 4.8;
  const longest = Math.max(1, ...rest.map((r, i) => `${i + 4}. ${r.name}`.length));
  // Row width in em: name (~0.43 em/char) + rating chip 2.2 + gap + "moy." column.
  const byWidth = Math.floor((colW - (cols === 2 ? 24 : 0) - 14) / (longest * 0.43 + 2.2 + moyW + 0.4));
  const size = Math.max(24, Math.min(44, byWidth, Math.floor(400 / Math.max(perCol, 1) / 1.5)));
  const panelH = perCol * Math.round(size * 1.5) + 70;
  const row = (r, i) => h("div", { width: colW, alignItems: "center", height: Math.round(size * 1.5), paddingRight: cols === 2 ? 24 : 0 },
    h("div", { flex: 1, fontFamily: "Contrail One", fontSize: size, whiteSpace: "nowrap", color: theme.ink, textShadow: "2px 3px 0 rgba(0,0,0,0.12)" }, `${i + 4}. ${r.name}`),
    h("div", { width: Math.round(size * 2.2), height: Math.round(size * 1.2), borderRadius: size, background: theme.pill, justifyContent: "center", alignItems: "center", fontFamily: "Shrikhand", fontSize: Math.round(size * 0.78), color: "#ffffff", marginRight: 14 }, r.match == null ? "—" : r.match.toFixed(1)),
    h("div", { width: Math.round(size * moyW), justifyContent: "flex-end", fontFamily: "Contrail One", fontSize: Math.round(size * 0.62), whiteSpace: "nowrap", color: theme.ink }, r.season == null ? "" : `${cols === 2 ? "moy." : "moy. saison"} ${r.season.toFixed(1)}`));
  const columns = [];
  for (let c = 0; c < cols; c++) columns.push(h("div", { flexDirection: "column", alignSelf: "flex-start" }, rest.slice(c * perCol, (c + 1) * perCol).map((r, k) => row(r, c * perCol + k))));
  return canvas(bg, title("NOTES"),
    h("div", { position: "absolute", top: 222, left: 0, width: 1080, justifyContent: "center", fontFamily: "Shrikhand", fontSize: Math.min(52, Math.floor(1000 / (scoreLine.length * 0.65))), whiteSpace: "nowrap", color: "#ffffff", textShadow: "4px 7px 8px rgba(0,0,0,0.28)" }, scoreLine),
    top.map((r, i) => podiumCard(r, i, theme)),
    rest.length ? h("div", { position: "absolute", top: 860 + Math.max(0, Math.round((470 - panelH) / 2)), left: 70, width: 940, height: panelH, borderRadius: 44, background: "rgba(255,255,255,0.94)", alignItems: "flex-start", justifyContent: "center", paddingTop: 35, paddingLeft: 30, paddingRight: 30, boxShadow: "10px 12px 0 rgba(0,0,0,0.22)" }, columns) : null);
}

module.exports = { h, img, canvas, title, photo, pill, band, listPanel, matchDayEl, groupeEl, resultEl, rankingEl, ratingsEl };
