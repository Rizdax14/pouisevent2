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

// "Présent" opens on the Sunday 17:00 (Paris) before the match day; "Absent" can be said any time.
function presenceOpensAt(matchIso) {
  const p = _parisParts(new Date(matchIso));
  const back = p.wd === 0 ? 7 : p.wd; // the Sunday before (a week earlier for a Sunday match)
  const d = new Date(Date.UTC(p.y, p.m - 1, p.d - back));
  return _parisToDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), 17, 0);
}
function presenceOpen(matchIso, nowMs) { return (nowMs === undefined ? Date.now() : nowMs) >= presenceOpensAt(matchIso).getTime(); }

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

// The kits on the rack for a season: [home, away?] (assets/vestiaire/<kit>/). Today's season: the current kits.
const FOOT_SEASON_KITS = { "2024-2025": ["h2425"], "2025-2026": ["h2526", "a2526"] };
function seasonKits(season, current) { return FOOT_SEASON_KITS[season] || (season === current ? ["home", "away"] : ["home"]); }

// Shirts of a past season: its listed squad, alphabetical, numbers as on today's roster.
function seasonRack(ids, roster, nameOf) {
  const num = Object.fromEntries(roster.map((r) => [r.player_id, r.jersey_number || ""]));
  return ids.map((id) => ({ id, num: num[id] || "", name: nameOf(id), role: "saison" }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
}

// The numbers behind a shirt. row / careerRow: buildStatsRows rows (season, career);
// series / careerSeries: playerRatingSeries of the season and of the whole career (oldest first).
function shirtStats({ row, careerRow, series, careerSeries }) {
  const r = row || { played: 0, wins: 0, draws: 0, losses: 0, goals: 0, assists: 0, decisive: 0, motm: 0 };
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
  const per = (a, b) => (b ? Math.round((a / b) * 100) / 100 : null);
  const r1 = (v) => Math.round(v * 10) / 10;
  const avg = (ss) => (ss && ss.length ? r1(ss.reduce((a, s) => a + s.rating, 0) / ss.length) : null);
  const pick = (better) => ((series || []).length ? series.reduce((a, s) => (better(s.rating, a.rating) ? s : a)) : null);
  const match = (s) => s && { rating: r1(s.rating), opponent: s.opponent, matchId: s.matchId, date: s.date };
  const c = careerRow;
  return {
    played: r.played, wins: r.wins, draws: r.draws, losses: r.losses, winPct: pct(r.wins, r.played),
    goals: r.goals, assists: r.assists, decisive: r.decisive, motm: r.motm,
    goalsPerMatch: per(r.goals, r.played), assistsPerMatch: per(r.assists, r.played), decisivePerMatch: per(r.decisive, r.played),
    rating: avg(series), best: match(pick((a, b) => a > b)), worst: match(pick((a, b) => a < b)),
    career: c ? { played: c.played, goals: c.goals, assists: c.assists, decisive: c.decisive ?? c.goals + c.assists, motm: c.motm, rating: avg(careerSeries),
      wins: c.wins || 0, draws: c.draws || 0, losses: c.losses || 0, winPct: pct(c.wins || 0, c.played) } : null,
  };
}

// Every finished match a player was on the sheet of, newest first: score + result, his goals / assists, his final rating, man of the match.
// ratingByMatch: { matchId: rating }; motmByMatch: motmWinners(); scoreOf(match) → { bl, opponent }.
function playerMatchRows({ matches, lineups, events, ratingByMatch, motmByMatch, scoreOf, playerId }) {
  const mine = new Set(lineups.filter((l) => l.player_id === playerId).map((l) => l.match_id));
  return matches.filter((m) => m.status === "finished" && mine.has(m.id))
    .sort((a, b) => new Date(b.match_datetime) - new Date(a.match_datetime))
    .map((m) => {
      const sc = m.score_unknown ? null : scoreOf(m);
      const ev = events.filter((e) => e.match_id === m.id && e.type === "goal_bl");
      return {
        id: m.id, date: m.match_datetime, opponent: m.opponent_name, type: m.match_type,
        score: sc ? `${sc.bl} - ${sc.opponent}` : "? - ?", result: sc ? footOutcome(sc) : null,
        goals: ev.filter((e) => e.player_id === playerId).length, assists: ev.filter((e) => e.assist_player_id === playerId).length,
        rating: ratingByMatch[m.id] ?? null, motm: ((motmByMatch || {})[m.id] || []).includes(playerId),
      };
    });
}

// ---- the league tables (FSGT Loire, foot à 7 du jeudi) ----
// Our poule each phase, from the FSGT tables: [team, played, won, drawn, lost, goals for, goals against]
// (24-25 phase 1 only has the goals). The FSGT ranks on goal difference: "pts" = for − against.
const FOOT_STANDINGS = {"2024-2025": [{"key": "p1", "label": "Phase 1", "poule": "Poule de brassage", "teams": [
      ["FC DUNIERES", null, null, null, null, 49, 12],
      ["AL RICAMARIE", null, null, null, null, 37, 11],
      ["CREDIT AGRICOLE", null, null, null, null, 36, 21],
      ["CELDA", null, null, null, null, 24, 19],
      ["INTER MITEMPS", null, null, null, null, 33, 29],
      ["BIERE LEVERCULSEC", null, null, null, null, 24, 21],
      ["CITY STADE TEAM", null, null, null, null, 19, 42],
      ["JVB", null, null, null, null, 11, 43],
      ["FC CLOS PASCAL", null, null, null, null, 10, 45]]}, {"key": "p2", "label": "Phase 2", "poule": "Seniors D", "teams": [
      ["ABH 2", 16, 14, 0, 2, 96, 48],
      ["LES PANTHERES", 16, 12, 0, 4, 104, 57],
      ["FC KISS COOL", 16, 9, 1, 6, 67, 50],
      ["AS LINKS", 16, 10, 1, 5, 77, 63],
      ["FC CARIBOU", 16, 9, 1, 6, 90, 77],
      ["FC COIFFEURS", 16, 4, 1, 11, 75, 91],
      ["BIERE LEVERCULSEC", 15, 4, 2, 9, 59, 75],
      ["FC GENILAC 1", 15, 6, 0, 9, 40, 65],
      ["TOTTENAAM HOTWINGS", 16, 0, 0, 16, 30, 112]]}], "2025-2026": [{"key": "p1", "label": "Phase 1", "poule": "Poule de brassage", "teams": [
      ["ABH 1", 9, 8, 0, 1, 74, 40],
      ["BELLEGARDE SPORT", 9, 6, 2, 1, 54, 27],
      ["BASSET ATHLETIC 1", 8, 5, 2, 1, 42, 29],
      ["FC PASTEQUE 2", 9, 5, 0, 4, 48, 39],
      ["BIERE LEVERCULSEC", 9, 3, 1, 5, 54, 50],
      ["ATHLETIC CLUB SAINTE", 9, 5, 0, 4, 40, 37],
      ["VERALLIA", 8, 4, 0, 4, 48, 53],
      ["LA DETENTE", 9, 3, 0, 6, 34, 43],
      ["FC FIFOU", 9, 1, 0, 8, 22, 58],
      ["FC LOIRE ASCENSEURS", 9, 1, 0, 8, 21, 61]]}, {"key": "p2", "label": "Phase 2", "poule": "Seniors D", "teams": [
      ["FC CARIBOU", 16, 11, 2, 3, 83, 50],
      ["ATHLETIC CLUB SAINTE", 16, 11, 2, 3, 92, 60],
      ["PSV HEINEKEN", 16, 8, 3, 5, 81, 71],
      ["FC DUNIERES", 16, 7, 2, 7, 91, 82],
      ["BIERE LEVERCULSEC", 16, 7, 1, 8, 83, 81],
      ["COPAINS CHOPINES", 16, 5, 4, 7, 63, 66],
      ["AS TRV", 16, 4, 2, 10, 51, 75],
      ["SHOUF TEAM", 16, 5, 3, 8, 48, 74],
      ["FC ARSENUL", 16, 4, 1, 11, 61, 94]]}], "2026-2027": [{"key": "p1", "label": "Phase 1", "poule": "Poule de brassage", "teams": [
      ["ABH 1", 0, 0, 0, 0, 0, 0], ["LUDO TEAM", 0, 0, 0, 0, 0, 0], ["PATROLD SCHOOL FC", 0, 0, 0, 0, 0, 0], ["BIERE LEVERCULSEC", 0, 0, 0, 0, 0, 0], ["SHOUF TEAM", 0, 0, 0, 0, 0, 0],
      ["FC CAF LOIRE", 0, 0, 0, 0, 0, 0], ["FC GENILAC 5", 0, 0, 0, 0, 0, 0], ["AS LES COLLEGUES", 0, 0, 0, 0, 0, 0], ["EN AVANT GUINGUETTE", 0, 0, 0, 0, 0, 0], ["FC FIFOU", 0, 0, 0, 0, 0, 0]]}]};
const FOOT_US = "BIERE LEVERCULSEC";
// "FC Dunières", "DUNIERES FC", "Shouf Team (forfait)" → one key; the FSGT and our sheets don't always spell a team the same way
const TEAM_ALIASES = { jbv: "jvb" };
function teamKey(name) {
  const k = String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\(.*?\)/g, " ")
    .split(/[^a-z0-9]+/).filter((w) => w && w !== "fc" && w !== "as").sort().join(" ");
  return TEAM_ALIASES[k] || k;
}
// A season's tables, ranked: goal difference, then goals scored. [] when the FSGT hasn't published them.
function leagueTables(season) {
  return (FOOT_STANDINGS[season] || []).map((ph) => ({
    key: ph.key, label: ph.label, poule: ph.poule,
    rows: ph.teams.map(([name, played, w, d, l, bp, bc]) => ({ name, played, w, d, l, bp, bc, diff: bp - bc, us: teamKey(name) === teamKey(FOOT_US) }))
      .sort((a, b) => b.diff - a.diff || b.bp - a.bp).map((r, i) => ({ ...r, rank: i + 1 })),
  }));
}
// Our league matches of the season against a team, oldest first, with the score and its result.
// phase "p1" = autumn (brassage, until December), "p2" = from January; none = the whole season.
function matchesAgainst(matches, season, team, scoreOf, seasonOfFn, phase) {
  const key = teamKey(team);
  const inPhase = (iso) => !phase || (phase === "p1") === (_parisParts(new Date(iso)).m >= 8);
  // played ones with their score, the ones to come too (no score yet)
  return matches.filter((m) => m.match_type === "championnat" && seasonOfFn(m.match_datetime) === season && teamKey(m.opponent_name) === key && inPhase(m.match_datetime))
    .sort((a, b) => new Date(a.match_datetime) - new Date(b.match_datetime))
    .map((m) => {
      if (m.status !== "finished" || m.score_unknown) return { id: m.id, date: m.match_datetime, venue: m.venue, score: null, result: null, upcoming: m.status !== "finished" };
      const sc = scoreOf(m); return { id: m.id, date: m.match_datetime, venue: m.venue, score: `${sc.bl} - ${sc.opponent}`, result: footOutcome(sc) };
    });
}
// A small badge for a team without a logo: up to 3 initials on a colour of its own.
function teamBadge(name) {
  const words = String(name || "").replace(/\(.*?\)/g, "").split(/\s+/).filter((w) => w && !/^(FC|AS|US|AL|ES|SC|LA|LE|LES|DE|DU)$/i.test(w));
  // a short word (ABH, PSV, 2) is kept whole, a long one gives its first letter
  const initials = (words.length === 1 ? words[0].slice(0, 3) : words.map((w) => (w.length <= 3 ? w : w[0])).join("").slice(0, 4)).toUpperCase();
  let h = 0; for (const c of teamKey(name)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return { initials, hue: h };
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

if (typeof module !== "undefined" && module.exports) module.exports = { presenceOpensAt, presenceOpen, FOOT_STANDINGS, teamKey, leagueTables, matchesAgainst, teamBadge, playerMatchRows, FOOT_SEASON_KITS, seasonKits, shortSeason, seasonRack, matchMonths, monthMatches, shirtStats, footRelative, footOutcome, footFeaturedMatch, playerInitials, meetingIsoFor, meetingTimeValue, mapLinks, rackSquad, upcomingMatches, calendarMonth, calendarStartMonth, calendarBounds, shortOpponent, parisHour };
