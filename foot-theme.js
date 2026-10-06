// foot-theme.js — design tokens of the football app (browser global + module.exports, like foot-logic.js).
// Two themes taken from the Instagram visuals: green (domicile) and pink (extérieur).
// bgTint is multiplied with the texture so white titles stay readable even on its lightest streaks (checked in foot-theme.test.js).
var FOOT_THEMES = {
  green: {
    label: "Vert", accent: "#1f6b3d", deep: "#14502b", soft: "#e8f3ec", softer: "#f4faf6", line: "#cfe3d6",
    text: "#1c2420", muted: "#52605a", good: "#17803d", bad: "#b3261e", warn: "#8f5600",
    bgImage: "/assets/foot/bg-green.jpg?v=crt1", bgColor: "#1f6b3d", bgTint: "#ffffff",
  },
  pink: {
    label: "Rose", accent: "#8e3f96", deep: "#722d79", soft: "#f6e9f7", softer: "#fbf4fb", line: "#e6cde8",
    text: "#261d28", muted: "#5f5062", good: "#17803d", bad: "#b3261e", warn: "#8f5600",
    bgImage: "/assets/foot/bg-pink.jpg?v=crt1", bgColor: "#a24fa9", bgTint: "#ffffff",
  },
};

function themeFor(name) { return FOOT_THEMES[name] || FOOT_THEMES.green; }

function _lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
// WCAG contrast ratio between two "#rrggbb" colours.
function contrast(a, b) {
  const [hi, lo] = [_lum(a), _lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
function withAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

if (typeof module !== "undefined" && module.exports) module.exports = { FOOT_THEMES, themeFor, contrast, withAlpha };
