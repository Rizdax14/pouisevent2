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
const TITLE_SIZES = { "MATCH DAY": 158, GROUPE: 234, RESULTAT: 180, NOTES: 200, BUTS: 180, "PASSE D": 180, MOYENNES: 150, "DÉCISIFS": 150, "HOMMES DU MATCH": 92 };
function title(text) {
  const size = TITLE_SIZES[text] || 150;
  return h("div", { position: "absolute", top: -Math.round(size * 0.07 + Math.max(0, size - 160) * 0.15), left: 0, width: 1080, justifyContent: "center", fontFamily: "Shrikhand", fontSize: size, lineHeight: 1.2, whiteSpace: "nowrap", color: "#ffffff", textShadow: "4px 7px 8px rgba(0,0,0,0.28)" }, text);
}
function photo(rect, src) {
  if (!rect || !src) return null;
  return img(src, { position: "absolute", left: rect.x, top: rect.y, width: rect.width, height: rect.height });
}
// "#rrggbb" + alpha → rgba(), so only the background of a chip fades, never its text.
function withAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
const PILL_ALPHA = 0.72;
// The opponent pill: centred just above the bottom band, in front of the player, translucent. It grows with the name.
const PILL_TOP = 1118;
function pill(text, theme) {
  // Shrikhand capitals run up to ~0.7 em wide; keep the label under ~640px.
  const label = `vs ${text}`;
  const size = Math.min(70, Math.floor(640 / (label.length * 0.7)));
  return h("div", { position: "absolute", top: PILL_TOP, left: 0, width: 1080, justifyContent: "center" },
    h("div", { height: 120, borderRadius: 60, background: withAlpha(theme.pillBg, PILL_ALPHA), alignItems: "center", paddingLeft: 52, paddingRight: 52, fontFamily: "Shrikhand", fontSize: size, whiteSpace: "nowrap", color: theme.pillInk, boxShadow: "6px 8px 10px rgba(0,0,0,0.25)" }, label));
}
// Shrikhand capitals average ~0.68 em: keep the text inside the 992px pill (with side padding), down to a readable minimum.
function bandFontSize(text) {
  return Math.max(18, Math.min(35, Math.floor(930 / (text.length * 0.68))));
}
function band(text, theme) {
  return h("div", { position: "absolute", bottom: 22, left: 44, width: 992, height: 68, borderRadius: 34, background: theme.bandBg, justifyContent: "center", alignItems: "center", fontFamily: "Shrikhand", fontSize: bandFontSize(text), whiteSpace: "nowrap", overflow: "hidden", color: theme.bandInk, boxShadow: "6px 8px 10px rgba(0,0,0,0.25)" }, text);
}
function matchDayEl({ bg, theme, opponent, bandText, rect, photoUri }) {
  // Layer order: the player stands in front of the "MATCH DAY" title; the translucent pill and the band sit on top of the player.
  return canvas(bg, title("MATCH DAY"), photo(rect, photoUri), pill(opponent, theme), band(bandText, theme));
}
function scoreBlock(opponent, bl, opp) {
  const line = (t, size, top) => h("div", { position: "absolute", top, left: 400, width: 680, justifyContent: "center", fontFamily: "Shrikhand", fontSize: size, whiteSpace: "nowrap", color: "#ffffff", textShadow: "4px 7px 8px rgba(0,0,0,0.28)" }, t);
  // Shrikhand averages ~0.65 em per character: shrink long names to fit the 680px column, abbreviate if unreadable.
  let name = opponent;
  let oppSize = Math.min(74, Math.floor(650 / (name.length * 0.65)));
  if (oppSize < 40) { name = require("../../insta-logic.js").opponentLabel(opponent); oppSize = Math.min(74, Math.floor(650 / (name.length * 0.65))); }
  return [line("LEVERCULSEC", 78, 225), line(`${bl} - ${opp}`, 132, 295), line(name, oppSize, 452 + (74 - oppSize) / 2)];
}

// Shared charter: white rounded cards with a hard shadow, theme-coloured chips with white Shrikhand.
const CARD = { borderRadius: 44, background: "rgba(255,255,255,0.94)", boxShadow: "10px 12px 0 rgba(0,0,0,0.22)" };
const INK_SHADOW = "2px 3px 0 rgba(0,0,0,0.12)";
function chip(text, theme, size, widthEm) {
  return h("div", { width: Math.round(size * widthEm), height: Math.round(size * 1.15), borderRadius: size, background: theme.pill, justifyContent: "center", alignItems: "center", fontFamily: "Shrikhand", fontSize: Math.round(size * 0.66), whiteSpace: "nowrap", color: "#ffffff", flexShrink: 0 }, text);
}

// The Groupe list card lets the player show through (70% white); the text on it stays fully opaque.
const GROUPE_CARD_BG = "rgba(255,255,255,0.70)";
function groupeEl({ bg, theme, lines, rect, photoUri }) {
  // The card hugs its rows: its height follows the number of players.
  const W = 412, padX = 28, padY = 30;
  const n = Math.max(lines.length, 1);
  const hasNum = lines.some((l) => l.number);
  const longest = Math.max(1, ...lines.map((l) => l.name.length));
  // Contrail One ~0.43 em/char; number chip 1.9 em + 0.35 em gap.
  const byWidth = Math.floor((W - 2 * padX) / (longest * 0.43 + (hasNum ? 2.25 : 0)));
  const byHeight = Math.floor((1260 - 300 - 2 * padY) / n / 1.3);
  const size = Math.max(28, Math.min(72, byWidth, byHeight));
  const rowH = Math.round(size * 1.3);
  // Layer order: background, title, player (in front of the title), then the list card.
  return canvas(bg, title("GROUPE"), photo(rect, photoUri),
    h("div", { position: "absolute", left: 608, top: 300, width: W, height: n * rowH + 2 * padY, ...CARD, background: GROUPE_CARD_BG, flexDirection: "column", justifyContent: "center", paddingLeft: padX, paddingRight: padX },
      lines.map((l) => h("div", { height: rowH, alignItems: "center" },
        hasNum ? (l.number ? chip(l.number, theme, size, 1.9) : h("div", { width: Math.round(size * 1.9), flexShrink: 0 })) : null,
        h("div", { marginLeft: hasNum ? Math.round(size * 0.35) : 0, fontFamily: "Contrail One", fontSize: size, whiteSpace: "nowrap", color: theme.ink, textShadow: INK_SHADOW }, l.name)))));
}

function resultEl({ bg, theme, opponent, bl, opp, goals, rect, photoUri }) {
  // goals: [{ minute, scorer, assist }] in match order; the card grows with the number of goals.
  const W = 505, padX = 28, head = 112;
  const n = Math.max(goals.length, 1);
  const label = (g) => (g.assist ? `${g.scorer} (${g.assist})` : g.scorer);
  const longest = Math.max(1, ...goals.map((g) => label(g).length));
  const byWidth = Math.floor((W - 2 * padX) / (longest * 0.43 + 2.15));
  const byHeight = Math.floor((700 - head - 34) / n / 1.3); // may grow down to the canvas bottom margin
  const size = Math.max(24, Math.min(48, byWidth, byHeight));
  const rowH = Math.round(size * 1.3);
  const rows = goals.length
    ? goals.map((g) => h("div", { height: rowH, alignItems: "center" },
        chip(`${g.minute}'`, theme, size, 1.8),
        h("div", { marginLeft: Math.round(size * 0.35), fontFamily: "Contrail One", fontSize: size, whiteSpace: "nowrap", color: theme.ink, textShadow: INK_SHADOW }, g.scorer),
        g.assist ? h("div", { marginLeft: Math.round(size * 0.22), fontFamily: "Contrail One", fontSize: Math.round(size * 0.72), whiteSpace: "nowrap", color: theme.ink }, `(${g.assist})`) : null))
    : [h("div", { height: rowH, justifyContent: "center", alignItems: "center", fontFamily: "Contrail One", fontSize: size, color: theme.ink }, "Aucun but")];
  // Layer order: background, title, player (in front of the title), then the score and goals card.
  return canvas(bg, title("RESULTAT"), photo(rect, photoUri), ...scoreBlock(opponent, bl, opp),
    // At least ~4 rows tall so a 1-goal match still reads as a card; rows are centred in it.
    h("div", { position: "absolute", left: 395, top: 625, width: W, height: head + Math.max(n * rowH, 4 * Math.round(48 * 1.3)) + 34, ...CARD, flexDirection: "column", paddingLeft: padX, paddingRight: padX, paddingBottom: 34 },
      h("div", { height: head, justifyContent: "center", alignItems: "center", fontFamily: "Shrikhand", fontSize: 66, color: theme.ink }, "buts :"),
      h("div", { flex: 1, flexDirection: "column", justifyContent: "center", alignItems: goals.length ? "flex-start" : "center" }, rows)));
}

// Podium cards for the top 3 (index 0 = 1st, centred and tallest).
const PODIUM = [
  { left: 375, top: 290, w: 330, h: 430 },
  { left: 45, top: 360, w: 300, h: 360 },
  { left: 735, top: 360, w: 300, h: 360 },
];
function podiumCard(r, i, theme, fmt, side) {
  const P = PODIUM[i];
  // The name shares the pill with the 104px value chip.
  const nameSize = Math.min(i === 0 ? 50 : 44, Math.floor((P.w - 20 - 38 - 104 - 12) / (r.name.length * 0.48)));
  return h("div", { position: "absolute", left: P.left, top: P.top, width: P.w, flexDirection: "column", alignItems: "center" },
    h("div", { width: P.w, height: P.h, ...CARD, borderRadius: 40, overflow: "hidden", position: "relative", justifyContent: "center", alignItems: "center" },
      r.uri
        // rect is framed on the 330px-wide podium layout; smaller cards scale it down.
        ? img(r.uri, { position: "absolute", left: (r.rect.x * P.w) / 330, top: (r.rect.y * P.w) / 330, width: (r.rect.width * P.w) / 330, height: (r.rect.height * P.w) / 330 })
        : h("div", { fontFamily: "Shrikhand", fontSize: P.w / 2.6, color: theme.ink }, r.name.slice(0, 2).toUpperCase())),
    h("div", { position: "absolute", left: -14, top: -18, width: 92, height: 92, borderRadius: 46, background: theme.pill, border: "5px solid #ffffff", justifyContent: "center", alignItems: "center", fontFamily: "Shrikhand", fontSize: 50, color: "#ffffff", boxShadow: "4px 6px 0 rgba(0,0,0,0.18)" }, String(i + 1)),
    h("div", { marginTop: -46, width: P.w - 20, height: 92, borderRadius: 46, background: theme.pill, alignItems: "center", paddingLeft: 26, paddingRight: 12, boxShadow: "6px 8px 0 rgba(0,0,0,0.2)" },
      h("div", { flex: 1, fontFamily: "Contrail One", fontSize: nameSize, whiteSpace: "nowrap", color: "#ffffff" }, r.name),
      h("div", { width: 104, height: 70, borderRadius: 35, background: "#ffffff", justifyContent: "center", alignItems: "center", fontFamily: "Shrikhand", fontSize: 40, color: theme.ink }, fmt(r.value))),
    h("div", { marginTop: 8, fontFamily: "Contrail One", fontSize: 30, whiteSpace: "nowrap", color: "#ffffff", textShadow: "2px 3px 4px rgba(0,0,0,0.35)" }, side(r, false)));
}

// Notes and Classements share one board: title, subtitle, podium for the top 3, table for the rest.
// rows: [{ name, value, uri?, rect? , ...}] already sorted; fmt(value) → chip text; side(row, short) → small right-hand text.
function podiumBoard({ bg, theme, heading, subtitle, rows, fmt, side }) {
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  // Ranks 4+ go in a table under the podium: one column up to 8 rows, two columns beyond.
  const cols = rest.length > 8 ? 2 : 1;
  const perCol = Math.ceil(rest.length / cols);
  const colW = cols === 2 ? (940 - 60) / 2 : 660;
  const sideW = cols === 2 ? 2.6 : 4.8;
  const longest = Math.max(1, ...rest.map((r, i) => `${i + 4}. ${r.name}`.length));
  // Row width in em: name (~0.43 em/char) + value chip 2.2 + gap + side column.
  const byWidth = Math.floor((colW - (cols === 2 ? 24 : 0) - 14) / (longest * 0.43 + 2.2 + sideW + 0.4));
  const size = Math.max(24, Math.min(44, byWidth, Math.floor(400 / Math.max(perCol, 1) / 1.5)));
  const panelH = perCol * Math.round(size * 1.5) + 70;
  const row = (r, i) => h("div", { width: colW, alignItems: "center", height: Math.round(size * 1.5), paddingRight: cols === 2 ? 24 : 0 },
    h("div", { flex: 1, fontFamily: "Contrail One", fontSize: size, whiteSpace: "nowrap", color: theme.ink, textShadow: INK_SHADOW }, `${i + 4}. ${r.name}`),
    h("div", { marginRight: 14, flexShrink: 0 }, chip(fmt(r.value), theme, size, 2.2)),
    h("div", { width: Math.round(size * sideW), justifyContent: "flex-end", fontFamily: "Contrail One", fontSize: Math.round(size * 0.62), whiteSpace: "nowrap", color: theme.ink }, side(r, cols === 2)));
  const columns = [];
  for (let c = 0; c < cols; c++) columns.push(h("div", { flexDirection: "column", alignSelf: "flex-start" }, rest.slice(c * perCol, (c + 1) * perCol).map((r, k) => row(r, c * perCol + k))));
  return canvas(bg, title(heading),
    h("div", { position: "absolute", top: 196, left: 0, width: 1080, justifyContent: "center", fontFamily: "Shrikhand", fontSize: Math.min(52, Math.floor(1000 / (subtitle.length * 0.65))), whiteSpace: "nowrap", color: "#ffffff", textShadow: "4px 7px 8px rgba(0,0,0,0.28)" }, subtitle),
    top.map((r, i) => podiumCard(r, i, theme, fmt, side)),
    rows.length ? null : h("div", { position: "absolute", top: 520, left: 140, width: 800, height: 200, ...CARD, justifyContent: "center", alignItems: "center", fontFamily: "Contrail One", fontSize: 54, color: theme.ink }, "Pas encore de classement"),
    rest.length ? h("div", { position: "absolute", top: 860 + Math.max(0, Math.round((470 - panelH) / 2)), left: 70, width: 940, height: panelH, ...CARD, alignItems: "flex-start", justifyContent: "center", paddingTop: 35, paddingLeft: 30, paddingRight: 30 }, columns) : null);
}

// Framing preview for the small layouts (Render circle, podium cards): the layout canvas is the mask.
function maskedPhotoEl({ w, h: height, radius, fill, rect, photoUri }) {
  return h("div", { width: w, height, position: "relative", overflow: "hidden", borderRadius: radius, background: fill }, photo(rect, photoUri));
}

const one = (v) => (v == null ? "—" : v.toFixed(1));

// rows: [{ name, match, season, uri?, rect? }] sorted by match rating.
function ratingsEl({ bg, theme, opponent, bl, opp, rows }) {
  return podiumBoard({ bg, theme, heading: "NOTES", subtitle: `LEVERCULSEC ${bl} - ${opp} ${opponent}`,
    rows: rows.map((r) => ({ ...r, value: r.match })), fmt: one,
    side: (r, short) => (r.season == null ? "" : `${short ? "moy." : "moy. saison"} ${one(r.season)}`) });
}

// entries: [{ name, value, matches, uri?, rect? }] sorted; decimals for the average-rating page.
function rankingEl({ bg, theme, heading, season, entries, decimals }) {
  return podiumBoard({ bg, theme, heading, subtitle: `SAISON ${season}`, rows: entries,
    fmt: decimals ? one : (v) => String(v),
    side: (r, short) => (r.matches == null ? "" : short ? `${r.matches} m.` : `${r.matches} match${r.matches > 1 ? "s" : ""}`) });
}

module.exports = { PODIUM, GROUPE_CARD_BG, bandFontSize, h, img, canvas, title, photo, pill, band, chip, matchDayEl, groupeEl, resultEl, podiumBoard, rankingEl, ratingsEl, maskedPhotoEl };
