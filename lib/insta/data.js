// lib/insta/data.js
const { sbGet } = require("./supabase");
async function loadCommon() {
  const [players, roster, photos, framings] = await Promise.all([
    sbGet("players", "?select=id,name,display_name"),
    sbGet("foot_roster", "?select=player_id,role,jersey_number"),
    sbGet("foot_player_photos", "?select=*"),
    sbGet("foot_photo_framings", "?select=*"),
  ]);
  return { players, roster, photos, framings };
}
async function loadMatchContext(matchId) {
  const id = Number(matchId);
  const [common, [match], lineups, events, ratings, history] = await Promise.all([
    loadCommon(),
    sbGet("foot_matches", `?id=eq.${id}&select=*`),
    sbGet("foot_lineups", `?match_id=eq.${id}&select=match_id,player_id`),
    sbGet("foot_match_events", `?match_id=eq.${id}&select=*`),
    sbGet("foot_ratings", `?match_id=eq.${id}&select=*`),
    sbGet("foot_insta_posts", "?status=eq.published&select=featured,published_at"),
  ]);
  if (!match) throw new Error("Match introuvable");
  return { ...common, match, lineups, events, ratings, history, theme: match.venue === "exterieur" ? "exterieur" : "domicile" };
}
function historyFor(history, slot) {
  return history.filter((h) => h.featured && h.featured[slot]).map((h) => ({ playerId: h.featured[slot], at: h.published_at }));
}
module.exports = { loadCommon, loadMatchContext, historyFor };
