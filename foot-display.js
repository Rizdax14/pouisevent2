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

// Links that open the match address in Waze, Apple Plans or Google Maps (null when there is no address).
function mapLinks(match) {
  const q = [match.stadium_name, match.address, [match.postal_code, match.city].filter(Boolean).join(" ")].filter((x) => x && String(x).trim()).join(", ");
  if (!q) return null;
  const e = encodeURIComponent(q);
  return {
    waze: `https://waze.com/ul?q=${e}&navigate=yes`,
    plans: `https://maps.apple.com/?q=${e}`,
    google: `https://www.google.com/maps/search/?api=1&query=${e}`,
  };
}

// ---- the club room (Vestiaire / Classement / Calendrier in 3D) ----
// Shirts on the rack: regular and occasional players, in alphabetical order.
function rackSquad(roster, nameOf) {
  return roster.filter((r) => r.role === "regulier" || r.role === "occasionnel")
    .map((r) => ({ id: r.player_id, num: r.jersey_number || "", name: nameOf(r.player_id), role: r.role }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
}

// "2025-2026" → "25-26"
function shortSeason(s) { return String(s).replace(/^20(\d\d)-20(\d\d)$/, "$1-$2"); }

// Shirts of a past season: its listed squad, alphabetical, numbers as on today's roster.
function seasonRack(ids, roster, nameOf) {
  const num = Object.fromEntries(roster.map((r) => [r.player_id, r.jersey_number || ""]));
  return ids.map((id) => ({ id, num: num[id] || "", name: nameOf(id), role: "saison" }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
}

// The cool numbers behind a shirt. seasonMatches: the season's matches; allMatches for the career line.
// row / careerRow: buildStatsRows rows; series: playerRatingSeries of the season (oldest first).
function shirtStats({ row, careerRow, series, seasonFinished, scoreOf, lineups, playerId, allMatches }) {
  const r = row || { played: 0, wins: 0, draws: 0, losses: 0, goals: 0, assists: 0, decisive: 0, motm: 0 };
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
  const per = (a, b) => (b ? Math.round((a / b) * 100) / 100 : null);
  const ratings = (series || []).map((s) => s.rating);
  // last matches played (on the sheet of a finished match), newest first, with the result
  const mine = new Set((lineups || []).filter((l) => l.player_id === playerId).map((l) => l.match_id));
  const lastPlayed = (allMatches || []).filter((m) => m.status === "finished" && !m.score_unknown && mine.has(m.id))
    .sort((a, b) => new Date(b.match_datetime) - new Date(a.match_datetime)).slice(0, 5)
    .map((m) => { const sc = scoreOf(m); return sc.bl > sc.opponent ? "V" : sc.bl < sc.opponent ? "D" : "N"; });
  return {
    played: r.played, wins: r.wins, draws: r.draws, losses: r.losses,
    winPct: pct(r.wins, r.played),
    goals: r.goals, assists: r.assists, decisive: r.decisive, motm: r.motm,
    goalsPerMatch: per(r.goals, r.played), decisivePerMatch: per(r.decisive, r.played),
    playedPct: pct(r.played, seasonFinished),
    rating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
    best: ratings.length ? Math.max(...ratings) : null,
    lastRatings: (series || []).slice(-3).reverse().map((s) => ({ opponent: s.opponent, rating: Math.round(s.rating * 10) / 10, date: s.date })),
    form: lastPlayed,
    career: careerRow ? { played: careerRow.played, goals: careerRow.goals, assists: careerRow.assists, motm: careerRow.motm } : null,
  };
}

// The match being played (if any) then the scheduled ones, soonest first.
function upcomingMatches(matches, limit = 4) {
  const live = matches.filter((m) => m.status === "live");
  const next = matches.filter((m) => m.status === "scheduled").sort((a, b) => new Date(a.match_datetime) - new Date(b.match_datetime));
  return [...live, ...next].slice(0, limit);
}

const FOOT_MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
// "19h" / "18h30" (Paris time)
function parisHour(iso) { const p = _parisParts(new Date(iso)); return `${p.hh}h${p.mm ? String(p.mm).padStart(2, "0") : ""}`; }
// "St-Max" from "Saint-Maximin FC": first word, at most 8 letters, for a calendar cell.
function shortOpponent(name) {
  const w = String(name || "?").replace(/^(FC|AS|US|SC|RC|AC|CS|ES|SO|OS)\s+/i, "").split(/[\s/]+/)[0] || "?";
  return w.length > 8 ? w.slice(0, 7) + "." : w;
}
// One month of the desk calendar, by Paris day. month is 1-12. scoreOf(match) → { bl, opponent } for a played match.
// A cell shows the opponent and either the score (played: tone win / loss / draw) or the kick-off hour.
// ratingOf(match) → my final rating of a played match (null when I didn't play it or it isn't rated yet).
function calendarMonth(matches, scoreOf, year, month, nowMs, ratingOf) {
  const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7; // Monday first
  const days = {};
  for (const m of [...matches].sort((a, b) => new Date(a.match_datetime) - new Date(b.match_datetime))) {
    const p = _parisParts(new Date(m.match_datetime));
    if (p.y !== year || p.m !== month || days[p.d]) continue;
    const played = m.status === "finished" && !m.score_unknown;
    const sc = played ? scoreOf(m) : null;
    days[p.d] = {
      id: m.id, top: shortOpponent(m.opponent_name),
      bottom: played ? `${sc.bl}-${sc.opponent}` : m.score_unknown ? "?-?" : m.status === "live" ? "En direct" : parisHour(m.match_datetime),
      tone: played ? { V: "win", D: "loss", N: "draw" }[footOutcome(sc)] : null,
      rating: m.status === "finished" && ratingOf ? (ratingOf(m) ?? null) : null,
    };
  }
  const t = _parisParts(new Date(nowMs === undefined ? Date.now() : nowMs));
  return { title: `${FOOT_MONTHS[month - 1]} ${year}`, year, month, offset, length, days, today: t.y === year && t.m === month ? t.d : null };
}
// Months (year*12 + month-1) that hold at least one match, oldest first.
function matchMonths(matches) {
  const set = new Set(matches.map((m) => { const p = _parisParts(new Date(m.match_datetime)); return p.y * 12 + p.m - 1; }));
  return [...set].sort((a, b) => a - b);
}
// The matches of one month for the desk sheet: date, opponent, score + result (played), hour (to come), my final rating.
function monthMatches(matches, scoreOf, key, ratingOf) {
  const year = Math.floor(key / 12), month = (key % 12) + 1;
  const rows = matches.filter((m) => { const p = _parisParts(new Date(m.match_datetime)); return p.y === year && p.m === month; })
    .sort((a, b) => new Date(a.match_datetime) - new Date(b.match_datetime))
    .map((m) => {
      const p = _parisParts(new Date(m.match_datetime));
      const played = m.status === "finished" && !m.score_unknown;
      const sc = played ? scoreOf(m) : null;
      return {
        id: m.id, day: p.d, wd: ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."][p.wd], opponent: m.opponent_name,
        score: played ? `${sc.bl} - ${sc.opponent}` : m.score_unknown ? "? - ?" : null, result: played ? footOutcome(sc) : null,
        hour: played || m.score_unknown ? null : m.status === "live" ? "En direct" : parisHour(m.match_datetime),
        rating: m.status === "finished" && ratingOf ? (ratingOf(m) ?? null) : null,
      };
    });
  return { key, title: `${FOOT_MONTHS[month - 1]} ${year}`, rows };
}

// The month the desk calendar opens on: the next match's month, else the current one.
function calendarStartMonth(matches, nowMs) {
  const next = upcomingMatches(matches, 1)[0];
  const p = _parisParts(next ? new Date(next.match_datetime) : new Date(nowMs === undefined ? Date.now() : nowMs));
  return { year: p.y, month: p.m };
}
// Months that hold a match: the calendar can't be paged past the first or the last one (nor before today's month).
function calendarBounds(matches, nowMs) {
  const t = _parisParts(new Date(nowMs === undefined ? Date.now() : nowMs));
  let lo = t.y * 12 + t.m - 1, hi = lo;
  for (const m of matches) { const p = _parisParts(new Date(m.match_datetime)); const k = p.y * 12 + p.m - 1; lo = Math.min(lo, k); hi = Math.max(hi, k); }
  return { min: lo, max: hi };
}

if (typeof module !== "undefined" && module.exports) module.exports = { shortSeason, seasonRack, matchMonths, monthMatches, shirtStats, footRelative, footOutcome, footFeaturedMatch, playerInitials, meetingIsoFor, meetingTimeValue, mapLinks, rackSquad, upcomingMatches, calendarMonth, calendarStartMonth, calendarBounds, shortOpponent, parisHour };
