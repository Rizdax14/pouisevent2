// foot-display.js — display rules of the football app (browser global + module.exports).
// resolved at call time: in the browser parisParts comes from insta-logic.js, whatever the script order
function _parisParts(d) { return (typeof module !== "undefined" && module.exports ? require("./insta-logic.js").parisParts : parisParts)(d); }

// "Aujourd'hui", "Demain", "Dans 4 jours", "Hier", "Il y a 3 jours" — by Paris calendar day.
function footRelative(iso, nowMs) {
  nowMs = nowMs === undefined ? Date.now() : nowMs;
  const day = (ms) => { const p = _parisParts(new Date(ms)); return Date.UTC(p.y, p.m - 1, p.d); };
  const diff = Math.round((day(new Date(iso).getTime()) - day(nowMs)) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  if (diff === -1) return "Hier";
  return diff > 0 ? `Dans ${diff} jours` : `Il y a ${-diff} jours`;
}
// V / N / D from the goals of a finished match.
function footOutcome(score) { return score.bl > score.opponent ? "V" : score.bl < score.opponent ? "D" : "N"; }

// The match the app puts forward: the one being played, otherwise the next one to come.
function footFeaturedMatch(matches) {
  const live = matches.find((m) => m.status === "live");
  if (live) return live;
  return [...matches].filter((m) => m.status === "scheduled").sort((a, b) => new Date(a.match_datetime) - new Date(b.match_datetime))[0] || null;
}

function playerInitials(name) {
  const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
  return ((parts[0] || "?")[0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function _parisToDate(y, m, d, hh, mm) { return (typeof module !== "undefined" && module.exports ? require("./insta-logic.js").parisToDate : parisToDate)(y, m, d, hh, mm); }

// Meeting time ("HH:MM", Paris) on the day of the match → ISO instant. A time later than kick-off means the evening before.
function meetingIsoFor(matchIso, hhmm) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(hhmm || "").trim());
  if (!m) return null;
  const kick = new Date(matchIso);
  const d = _parisParts(kick);
  let at = _parisToDate(d.y, d.m, d.d, Number(m[1]), Number(m[2]));
  if (at > kick) { const prev = new Date(Date.UTC(d.y, d.m - 1, d.d - 1)); at = _parisToDate(prev.getUTCFullYear(), prev.getUTCMonth() + 1, prev.getUTCDate(), Number(m[1]), Number(m[2])); }
  return at.toISOString();
}
// ISO instant → "HH:MM" in Paris ("" when none).
function meetingTimeValue(iso) {
  if (!iso) return "";
  const p = _parisParts(new Date(iso));
  return `${String(p.hh).padStart(2, "0")}:${String(p.mm).padStart(2, "0")}`;
}

if (typeof module !== "undefined" && module.exports) module.exports = { footRelative, footOutcome, footFeaturedMatch, playerInitials, meetingIsoFor, meetingTimeValue };
