// foot.jsx

function FootballNavBar({
  page,
  setPage,
  onBack,
  isAdmin
}) {
  const m = useIsMobile();
  const items = [{
    id: "__back__",
    l: "Accueil",
    ic: "🏠",
    onClick: onBack
  }, {
    id: "calendar",
    l: "Calendrier",
    ic: "📅"
  }, {
    id: "rankings",
    l: "Classement",
    ic: "🏆"
  }, {
    id: "stats",
    l: "Statistiques",
    ic: "📊"
  }, ...(isAdmin ? [{
    id: "admin",
    l: "Admin",
    ic: "🛠"
  }] : [])];
  const wrapStyle = m ? {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    background: "#0d0d1c",
    borderTop: "1px solid #1e1e30",
    display: "flex",
    zIndex: 100,
    paddingBottom: "env(safe-area-inset-bottom)"
  } : {
    background: "#0d0d1c",
    borderBottom: "1px solid #1e1e30",
    padding: "0 32px",
    display: "flex",
    gap: 0,
    position: "sticky",
    top: 0,
    zIndex: 100
  };
  return /*#__PURE__*/React.createElement("nav", {
    style: wrapStyle
  }, items.map(item => {
    const active = page === item.id;
    return /*#__PURE__*/React.createElement("button", {
      key: item.id,
      onClick: () => item.onClick ? item.onClick() : setPage(item.id),
      style: {
        flex: m ? 1 : "none",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: m ? "10px 4px 8px" : "16px 14px",
        display: "flex",
        flexDirection: m ? "column" : "row",
        alignItems: "center",
        gap: m ? 3 : 6,
        color: active ? "#3b82f6" : "#60607a",
        fontFamily: "'Outfit',sans-serif",
        fontSize: m ? 9 : 13,
        fontWeight: 600,
        borderBottom: !m && active ? "2px solid #3b82f6" : !m ? "2px solid transparent" : "none"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: m ? 18 : 15
      }
    }, item.ic), /*#__PURE__*/React.createElement("span", {
      style: {
        textTransform: "uppercase",
        letterSpacing: "0.05em"
      }
    }, item.l));
  }));
}
function FootPlaceholderPage({
  label
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 40,
      textAlign: "center",
      color: "#60607a"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      marginTop: 8,
      textTransform: "uppercase",
      letterSpacing: "0.1em"
    }
  }, "\uD83D\uDD12 Bient\xF4t disponible"));
}
const FOOT_INPUT_STYLE = {
  width: "100%",
  background: "#13131f",
  border: "1px solid #1e1e30",
  borderRadius: 8,
  padding: "9px 12px",
  color: "#eeeef5",
  fontSize: 13,
  marginBottom: 10
};
async function setMatchAttendance(matchId, playerId, status) {
  assertUpsertOk(await SUPABASE.from("foot_attendance").upsert({
    match_id: matchId,
    player_id: playerId,
    status,
    responded_at: new Date().toISOString()
  }, {
    onConflict: "match_id,player_id"
  }));
}
async function addToLineup(matchId, playerIds) {
  if (!playerIds.length) return;
  assertUpsertOk(await SUPABASE.from("foot_lineups").upsert(playerIds.map(player_id => ({
    match_id: matchId,
    player_id
  })), {
    onConflict: "match_id,player_id",
    ignoreDuplicates: true
  }));
}
async function saveLineup(matchId, currentIds, wantedIds) {
  const {
    add,
    remove
  } = diffLineup(currentIds, wantedIds);
  await addToLineup(matchId, add);
  if (remove.length) {
    await sbFetch("foot_lineups", `?match_id=eq.${matchId}&player_id=in.(${remove.join(",")})`, {
      method: "DELETE"
    });
  }
}
function lineupIdsFor(lineups, matchId) {
  return lineups.filter(l => l.match_id === matchId).map(l => l.player_id);
}
function FootLineupChecklist({
  roster,
  extraIds,
  checked,
  onToggle,
  disabled
}) {
  const ids = [...new Set([...roster.map(r => r.player_id), ...(extraIds || [])])];
  const players = ids.map(id => PLAYERS.find(p => p.id === id)).filter(Boolean).sort((a, b) => (getDisplayName(a, PLAYERS) || "").localeCompare(getDisplayName(b, PLAYERS) || ""));
  if (players.length === 0) return /*#__PURE__*/React.createElement("div", {
    style: {
      color: "#60607a",
      fontSize: 13
    }
  }, "Aucun joueur dans l'effectif.");
  return /*#__PURE__*/React.createElement("div", null, players.map(p => /*#__PURE__*/React.createElement("label", {
    key: p.id,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "6px 0",
      fontSize: 13,
      cursor: disabled ? "default" : "pointer"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: checked.includes(p.id),
    disabled: disabled,
    onChange: () => onToggle(p.id)
  }), getDisplayName(p, PLAYERS))));
}
function FootLineupSection({
  match,
  roster,
  lineups,
  isAdmin,
  reload
}) {
  const current = lineupIdsFor(lineups, match.id);
  const [editing, setEditing] = React.useState(false);
  const [wanted, setWanted] = React.useState(current);
  const [saving, setSaving] = React.useState(false);
  const toggle = id => setWanted(wanted.includes(id) ? wanted.filter(x => x !== id) : [...wanted, id]);
  async function save() {
    setSaving(true);
    try {
      await saveLineup(match.id, current, wanted);
      await reload();
      setEditing(false);
    } catch (e) {
      console.warn("lineup save failed", e);
    }
    setSaving(false);
  }
  const names = current.map(id => PLAYERS.find(p => p.id === id)).filter(Boolean).map(p => getDisplayName(p, PLAYERS));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#0d0d1c",
      border: "1px solid #1e1e30",
      borderRadius: 12,
      padding: 16,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Bebas Neue',sans-serif",
      fontSize: 14
    }
  }, "Feuille de match (", current.length, ")"), isAdmin && !editing && /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setWanted(current);
      setEditing(true);
    },
    style: {
      background: "none",
      border: "1px solid #1e1e30",
      borderRadius: 6,
      color: "#eeeef5",
      padding: "4px 10px",
      cursor: "pointer",
      fontSize: 12
    }
  }, "\u270F\uFE0F Modifier")), !editing && (names.length ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "#cccce0"
    }
  }, names.join(" · ")) : /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "#60607a"
    }
  }, "Personne sur la feuille.")), editing && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(FootLineupChecklist, {
    roster: roster,
    extraIds: current,
    checked: wanted,
    onToggle: toggle,
    disabled: saving
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setEditing(false),
    disabled: saving,
    style: {
      flex: 1,
      background: "#13131f",
      border: "1px solid #1e1e30",
      borderRadius: 6,
      color: "#eeeef5",
      padding: "8px",
      cursor: "pointer"
    }
  }, "Annuler"), /*#__PURE__*/React.createElement("button", {
    onClick: save,
    disabled: saving,
    style: {
      flex: 1,
      background: "#3b82f6",
      color: "#fff",
      border: "none",
      borderRadius: 6,
      padding: "8px",
      fontWeight: 700,
      cursor: "pointer",
      opacity: saving ? 0.6 : 1
    }
  }, saving ? "…" : "Enregistrer"))));
}
function formatMatchPlace(match) {
  const cityLine = [match.postal_code, match.city].filter(Boolean).join(" ");
  return [match.stadium_name, match.address, cityLine].filter(Boolean).join(" · ");
}
function FootMatchForm({
  title,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  resetOnSuccess
}) {
  const empty = {
    opponent_name: "",
    match_datetime: "",
    stadium_name: "",
    address: "",
    postal_code: "",
    city: ""
  };
  const start = initial ? {
    ...empty,
    ...initial,
    match_datetime: toDatetimeLocalValue(initial.match_datetime)
  } : empty;
  const [f, setF] = React.useState(start);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const set = k => e => setF({
    ...f,
    [k]: e.target.value
  });
  async function submit() {
    if (!f.opponent_name.trim() || !f.match_datetime) {
      setMsg({
        t: "error",
        m: "Adversaire et date/heure sont obligatoires."
      });
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        opponent_name: f.opponent_name.trim(),
        match_datetime: new Date(f.match_datetime).toISOString(),
        stadium_name: (f.stadium_name || "").trim() || null,
        address: (f.address || "").trim() || null,
        postal_code: (f.postal_code || "").trim() || null,
        city: (f.city || "").trim() || null
      });
      if (resetOnSuccess) setF(empty);
      setMsg({
        t: "success",
        m: "Enregistré ✓"
      });
    } catch (e) {
      setMsg({
        t: "error",
        m: "Erreur: " + e.message
      });
    }
    setSaving(false);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#0d0d1c",
      border: "1px solid #1e1e30",
      borderRadius: 12,
      padding: 18,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Bebas Neue',sans-serif",
      fontSize: 16,
      marginBottom: 12
    }
  }, title), /*#__PURE__*/React.createElement("input", {
    style: FOOT_INPUT_STYLE,
    placeholder: "Nom de l'\xE9quipe adverse",
    value: f.opponent_name,
    onChange: set("opponent_name")
  }), /*#__PURE__*/React.createElement("input", {
    style: FOOT_INPUT_STYLE,
    type: "datetime-local",
    value: f.match_datetime,
    onChange: set("match_datetime")
  }), /*#__PURE__*/React.createElement("input", {
    style: FOOT_INPUT_STYLE,
    placeholder: "Nom du stade",
    value: f.stadium_name || "",
    onChange: set("stadium_name")
  }), /*#__PURE__*/React.createElement("input", {
    style: FOOT_INPUT_STYLE,
    placeholder: "Adresse",
    value: f.address || "",
    onChange: set("address")
  }), /*#__PURE__*/React.createElement("input", {
    style: FOOT_INPUT_STYLE,
    placeholder: "Code postal",
    value: f.postal_code || "",
    onChange: set("postal_code")
  }), /*#__PURE__*/React.createElement("input", {
    style: FOOT_INPUT_STYLE,
    placeholder: "Ville",
    value: f.city || "",
    onChange: set("city")
  }), msg && /*#__PURE__*/React.createElement("div", {
    style: {
      color: msg.t === "error" ? "#ef4444" : "#34d399",
      fontSize: 12,
      marginBottom: 10
    }
  }, msg.m), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, onCancel && /*#__PURE__*/React.createElement("button", {
    onClick: onCancel,
    disabled: saving,
    style: {
      flex: 1,
      background: "#13131f",
      border: "1px solid #1e1e30",
      borderRadius: 8,
      color: "#eeeef5",
      padding: "9px 16px",
      cursor: "pointer"
    }
  }, "Annuler"), /*#__PURE__*/React.createElement("button", {
    onClick: submit,
    disabled: saving,
    style: {
      flex: 1,
      background: "#3b82f6",
      color: "#fff",
      border: "none",
      borderRadius: 8,
      padding: "9px 16px",
      fontWeight: 700,
      cursor: saving ? "default" : "pointer",
      opacity: saving ? 0.6 : 1
    }
  }, saving ? "Enregistrement…" : submitLabel)));
}
function FootCreateMatchForm({
  reload
}) {
  return /*#__PURE__*/React.createElement(FootMatchForm, {
    title: "Cr\xE9er un match",
    submitLabel: "Cr\xE9er le match",
    resetOnSuccess: true,
    onSubmit: async data => {
      await sbInsert("foot_matches", data);
      await reload();
    }
  });
}
function FootAttendanceButtons({
  myStatus,
  saving,
  onSet,
  compact
}) {
  const base = {
    flex: 1,
    border: "1px solid #1e1e30",
    borderRadius: 8,
    padding: compact ? "7px" : "10px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: compact ? 12 : 13
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: compact ? 8 : 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      onSet("present");
    },
    disabled: saving,
    style: {
      ...base,
      background: myStatus === "present" ? "#34d399" : "#13131f",
      color: myStatus === "present" ? "#080810" : "#eeeef5"
    }
  }, "Pr\xE9sent"), /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      onSet("absent");
    },
    disabled: saving,
    style: {
      ...base,
      background: myStatus === "absent" ? "#ef4444" : "#13131f",
      color: myStatus === "absent" ? "#080810" : "#eeeef5"
    }
  }, "Absent"));
}
function FootMatchCard({
  match,
  score,
  presentCount,
  rosterSize,
  onClick,
  isOnRoster,
  myStatus,
  onSetStatus,
  saving
}) {
  const dt = new Date(match.match_datetime);
  const dateLabel = dt.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short"
  }) + " · " + dt.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit"
  });
  const statusLabel = match.status === "scheduled" ? "À venir" : match.status === "live" ? "En cours" : "Terminé";
  const statusColor = match.status === "scheduled" ? "#60607a" : match.status === "live" ? "#ef4444" : "#34d399";
  const place = formatMatchPlace(match);
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    style: {
      background: "#0d0d1c",
      border: "1px solid #1e1e30",
      borderRadius: 12,
      padding: 16,
      marginBottom: 10,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Bebas Neue',sans-serif",
      fontSize: 16
    }
  }, "Bi\xE8re Leverculsec vs ", match.opponent_name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: statusColor,
      textTransform: "uppercase",
      fontWeight: 700
    }
  }, statusLabel)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#60607a",
      marginBottom: 4
    }
  }, dateLabel), place && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#60607a"
    }
  }, place), match.status !== "scheduled" && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Bebas Neue',sans-serif",
      fontSize: 22,
      marginTop: 6
    }
  }, score.bl, " \u2014 ", score.opponent), match.status === "scheduled" && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#60607a",
      marginTop: 6,
      marginBottom: isOnRoster ? 10 : 0
    }
  }, presentCount, "/", rosterSize, " pr\xE9sents"), match.status === "scheduled" && isOnRoster && /*#__PURE__*/React.createElement(FootAttendanceButtons, {
    compact: true,
    myStatus: myStatus,
    saving: saving,
    onSet: onSetStatus
  }));
}
function FootCalendarPage({
  matches,
  events,
  roster,
  attendance,
  nav,
  currentPlayer,
  reload
}) {
  const [savingMatchId, setSavingMatchId] = React.useState(null);
  const isOnRoster = roster.some(r => r.player_id === currentPlayer?.id);
  async function setStatus(matchId, status) {
    setSavingMatchId(matchId);
    try {
      await setMatchAttendance(matchId, currentPlayer.id, status);
      await reload();
    } catch (e) {
      console.warn("attendance update failed", e);
    }
    setSavingMatchId(null);
  }
  if (matches.length === 0) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: 40,
        textAlign: "center",
        color: "#60607a"
      }
    }, "Aucun match pour l'instant.");
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16
    }
  }, matches.map(match => {
    const matchEvents = events.filter(e => e.match_id === match.id);
    const score = computeFootScore(matchEvents);
    const matchAttendance = attendance.filter(a => a.match_id === match.id);
    const presentCount = computeAttendanceBuckets(roster, matchAttendance).present.length;
    const myStatus = matchAttendance.find(a => a.player_id === currentPlayer?.id)?.status || null;
    return /*#__PURE__*/React.createElement(FootMatchCard, {
      key: match.id,
      match: match,
      score: score,
      presentCount: presentCount,
      rosterSize: roster.length,
      onClick: () => nav("matchDetail", {
        matchId: match.id
      }),
      isOnRoster: isOnRoster,
      myStatus: myStatus,
      saving: savingMatchId === match.id,
      onSetStatus: status => setStatus(match.id, status)
    });
  }));
}
function FootRosterManager({
  roster,
  reload
}) {
  const [saving, setSaving] = React.useState(null); // player id currently being saved
  const [search, setSearch] = React.useState("");
  const roleByPlayer = {};
  roster.forEach(r => {
    roleByPlayer[r.player_id] = r.role;
  });
  async function setRole(playerId, role) {
    setSaving(playerId);
    try {
      if (role === "") {
        await sbFetch("foot_roster", `?player_id=eq.${playerId}`, {
          method: "DELETE"
        });
      } else {
        assertUpsertOk(await SUPABASE.from("foot_roster").upsert({
          player_id: playerId,
          role
        }, {
          onConflict: "player_id"
        }));
      }
      await reload();
    } catch (e) {
      console.warn("roster update failed", e);
    }
    setSaving(null);
  }
  const nameOf = p => getDisplayName(p, PLAYERS) || "";
  const sortedPlayers = [...PLAYERS].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const visiblePlayers = filterPlayersByName(sortedPlayers, search, nameOf);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#0d0d1c",
      border: "1px solid #1e1e30",
      borderRadius: 12,
      padding: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Bebas Neue',sans-serif",
      fontSize: 16,
      marginBottom: 12
    }
  }, "Effectif (", roster.length, ")"), /*#__PURE__*/React.createElement("input", {
    style: FOOT_INPUT_STYLE,
    placeholder: "\uD83D\uDD0D Rechercher un joueur\u2026",
    value: search,
    onChange: e => setSearch(e.target.value)
  }), visiblePlayers.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      color: "#60607a",
      fontSize: 13,
      padding: "8px 0"
    }
  }, "Aucun joueur ne correspond \xE0 \xAB ", search, " \xBB."), visiblePlayers.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.id,
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "8px 0",
      borderBottom: "1px solid #1e1e30"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13
    }
  }, getDisplayName(p, PLAYERS)), /*#__PURE__*/React.createElement("select", {
    value: roleByPlayer[p.id] || "",
    disabled: saving === p.id,
    onChange: e => setRole(p.id, e.target.value),
    style: {
      background: "#13131f",
      border: "1px solid #1e1e30",
      borderRadius: 6,
      color: "#eeeef5",
      padding: "5px 8px",
      fontSize: 12
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Pas dans l'\xE9quipe"), /*#__PURE__*/React.createElement("option", {
    value: "regulier"
  }, "R\xE9gulier"), /*#__PURE__*/React.createElement("option", {
    value: "occasionnel"
  }, "Occasionnel"), /*#__PURE__*/React.createElement("option", {
    value: "invite"
  }, "Invit\xE9")))));
}
function FootAdminPage({
  roster,
  reload
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20
    }
  }, /*#__PURE__*/React.createElement(FootCreateMatchForm, {
    reload: reload
  }), /*#__PURE__*/React.createElement(FootRosterManager, {
    roster: roster,
    reload: reload
  }));
}
function FootStartMatchConfig({
  match,
  roster,
  attendance,
  reload,
  onCancel
}) {
  const [nbHalves, setNbHalves] = React.useState(2);
  const [halfDuration, setHalfDuration] = React.useState(45);
  const [saving, setSaving] = React.useState(false);
  const presentIds = attendance.filter(a => a.match_id === match.id && a.status === "present").map(a => a.player_id);
  const [sheet, setSheet] = React.useState(presentIds.filter(id => roster.some(r => r.player_id === id)));
  const toggle = id => setSheet(sheet.includes(id) ? sheet.filter(x => x !== id) : [...sheet, id]);
  async function start() {
    setSaving(true);
    try {
      await addToLineup(match.id, sheet);
      await sbUpdate("foot_matches", {
        id: match.id
      }, {
        status: "live",
        nb_halves: nbHalves,
        half_duration_min: halfDuration,
        current_half: 1,
        half_started_at: null,
        half_elapsed_seconds: 0
      });
      await reload();
    } catch (e) {
      console.warn("start match failed", e);
      setSaving(false);
    }
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#0d0d1c",
      border: "1px solid #1e1e30",
      borderRadius: 12,
      padding: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Bebas Neue',sans-serif",
      fontSize: 16,
      marginBottom: 14
    }
  }, "Configuration du match"), /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 12,
      color: "#60607a"
    }
  }, "Nombre de mi-temps"), /*#__PURE__*/React.createElement("select", {
    value: nbHalves,
    onChange: e => setNbHalves(Number(e.target.value)),
    style: {
      display: "block",
      width: "100%",
      background: "#13131f",
      border: "1px solid #1e1e30",
      borderRadius: 8,
      color: "#eeeef5",
      padding: "9px 12px",
      marginTop: 4,
      marginBottom: 14
    }
  }, [1, 2, 3, 4].map(n => /*#__PURE__*/React.createElement("option", {
    key: n,
    value: n
  }, n))), /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 12,
      color: "#60607a"
    }
  }, "Dur\xE9e par mi-temps (minutes)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: 1,
    value: halfDuration,
    onChange: e => setHalfDuration(Number(e.target.value)),
    style: {
      display: "block",
      width: "100%",
      background: "#13131f",
      border: "1px solid #1e1e30",
      borderRadius: 8,
      color: "#eeeef5",
      padding: "9px 12px",
      marginTop: 4,
      marginBottom: 18
    }
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 12,
      color: "#60607a"
    }
  }, "Feuille de match (", sheet.length, ")"), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: "6px 0 18px"
    }
  }, /*#__PURE__*/React.createElement(FootLineupChecklist, {
    roster: roster,
    checked: sheet,
    onToggle: toggle,
    disabled: saving
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onCancel,
    disabled: saving,
    style: {
      flex: 1,
      background: "#13131f",
      border: "1px solid #1e1e30",
      borderRadius: 8,
      color: "#eeeef5",
      padding: "10px",
      cursor: "pointer"
    }
  }, "Annuler"), /*#__PURE__*/React.createElement("button", {
    onClick: start,
    disabled: saving,
    style: {
      flex: 1,
      background: "#3b82f6",
      color: "#fff",
      border: "none",
      borderRadius: 8,
      padding: "10px",
      fontWeight: 700,
      cursor: saving ? "default" : "pointer",
      opacity: saving ? 0.6 : 1
    }
  }, saving ? "Démarrage…" : "Démarrer le match"))));
}
function FootEventEditor({
  event,
  defaultHalf,
  roster,
  onSave,
  onCancel
}) {
  const [type, setType] = React.useState(event?.type || "goal_bl");
  const [half, setHalf] = React.useState(String(event?.half ?? defaultHalf ?? 1));
  const [minute, setMinute] = React.useState(String(event?.minute ?? 0));
  const [playerId, setPlayerId] = React.useState(event?.player_id ? String(event.player_id) : "");
  const [assistId, setAssistId] = React.useState(event?.assist_player_id ? String(event.assist_player_id) : "");
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState(null);

  // Keep a player who has since left the roster selectable when editing their old goal.
  const rosterIds = new Set(roster.map(r => r.player_id));
  [event?.player_id, event?.assist_player_id].forEach(id => {
    if (id) rosterIds.add(id);
  });
  const options = PLAYERS.filter(p => rosterIds.has(p.id));
  const selectStyle = {
    display: "block",
    width: "100%",
    background: "#0d0d1c",
    border: "1px solid #1e1e30",
    borderRadius: 6,
    color: "#eeeef5",
    padding: "7px 10px",
    marginTop: 4,
    marginBottom: 10
  };
  async function save() {
    let payload;
    try {
      payload = buildEventPayload({
        type,
        half,
        minute,
        playerId,
        assistId
      });
    } catch (e) {
      setErr(e.message);
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await onSave(payload);
    } catch (e) {
      setErr("Erreur: " + e.message);
      setSaving(false);
    }
  }
  return /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      background: "#13131f",
      border: "1px solid #1e1e30",
      borderRadius: 8,
      padding: 14,
      margin: "6px 0"
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 11,
      color: "#60607a"
    }
  }, "Type"), /*#__PURE__*/React.createElement("select", {
    value: type,
    onChange: e => setType(e.target.value),
    style: selectStyle
  }, /*#__PURE__*/React.createElement("option", {
    value: "goal_bl"
  }, "But Bi\xE8re Leverculsec"), /*#__PURE__*/React.createElement("option", {
    value: "goal_opponent"
  }, "But adverse")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 11,
      color: "#60607a"
    }
  }, "Mi-temps"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: 1,
    value: half,
    onChange: e => setHalf(e.target.value),
    style: selectStyle
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 11,
      color: "#60607a"
    }
  }, "Minute"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: 0,
    value: minute,
    onChange: e => setMinute(e.target.value),
    style: selectStyle
  }))), type === "goal_bl" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 11,
      color: "#60607a"
    }
  }, "Buteur"), /*#__PURE__*/React.createElement("select", {
    value: playerId,
    onChange: e => setPlayerId(e.target.value),
    style: selectStyle
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "\u2014 Choisir \u2014"), options.map(p => /*#__PURE__*/React.createElement("option", {
    key: p.id,
    value: p.id
  }, getDisplayName(p, PLAYERS)))), /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 11,
      color: "#60607a"
    }
  }, "Passe d\xE9cisive (optionnel)"), /*#__PURE__*/React.createElement("select", {
    value: assistId,
    onChange: e => setAssistId(e.target.value),
    style: selectStyle
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "\u2014 Aucune \u2014"), options.filter(p => String(p.id) !== playerId).map(p => /*#__PURE__*/React.createElement("option", {
    key: p.id,
    value: p.id
  }, getDisplayName(p, PLAYERS))))), err && /*#__PURE__*/React.createElement("div", {
    style: {
      color: "#ef4444",
      fontSize: 12,
      marginBottom: 8
    }
  }, err), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onCancel,
    disabled: saving,
    style: {
      flex: 1,
      background: "#0d0d1c",
      border: "1px solid #1e1e30",
      borderRadius: 6,
      color: "#eeeef5",
      padding: "8px",
      cursor: "pointer"
    }
  }, "Annuler"), /*#__PURE__*/React.createElement("button", {
    onClick: save,
    disabled: saving,
    style: {
      flex: 1,
      background: "#3b82f6",
      color: "#fff",
      border: "none",
      borderRadius: 6,
      padding: "8px",
      fontWeight: 700,
      cursor: saving ? "default" : "pointer",
      opacity: saving ? 0.6 : 1
    }
  }, saving ? "…" : "Enregistrer")));
}
function FootEventTimeline({
  events,
  editable,
  match,
  roster,
  lineups,
  reload
}) {
  const [editingId, setEditingId] = React.useState(null); // event id, "new", or null
  const [busyId, setBusyId] = React.useState(null);
  const sorted = buildEventTimeline(events);
  async function saveEvent(eventId, payload) {
    if (eventId === "new") {
      await sbInsert("foot_match_events", {
        match_id: match.id,
        ...payload
      });
    } else {
      await sbUpdate("foot_match_events", {
        id: eventId
      }, payload);
    }
    await addToLineup(match.id, missingLineupPlayers(lineupIdsFor(lineups || [], match.id), payload));
    setEditingId(null);
    await reload();
  }
  async function deleteEvent(e) {
    if (!window.confirm("Supprimer ce but ?")) return;
    setBusyId(e.id);
    try {
      await sbFetch("foot_match_events", `?id=eq.${e.id}`, {
        method: "DELETE"
      });
      await reload();
    } catch (err) {
      console.warn("delete event failed", err);
    }
    setBusyId(null);
  }
  const iconBtn = {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    padding: "0 4px"
  };
  return /*#__PURE__*/React.createElement("div", null, sorted.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      color: "#60607a",
      fontSize: 13
    }
  }, "Aucun but pour l'instant."), sorted.map(e => {
    if (editingId === e.id) {
      return /*#__PURE__*/React.createElement(FootEventEditor, {
        key: e.id,
        event: e,
        roster: roster,
        onSave: p => saveEvent(e.id, p),
        onCancel: () => setEditingId(null)
      });
    }
    const scorer = e.player_id ? PLAYERS.find(p => p.id === e.player_id) : null;
    const assist = e.assist_player_id ? PLAYERS.find(p => p.id === e.assist_player_id) : null;
    const label = e.type === "goal_bl" ? `⚽ ${scorer ? getDisplayName(scorer, PLAYERS) : "?"}${assist ? " (passe D: " + getDisplayName(assist, PLAYERS) + ")" : ""}` : `⚽ But adverse`;
    return /*#__PURE__*/React.createElement("div", {
      key: e.id,
      style: {
        display: "flex",
        gap: 10,
        padding: "5px 0",
        fontSize: 13,
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: "#60607a",
        width: 50
      }
    }, e.half, "e \xB7 ", e.minute, "'"), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1
      }
    }, label), editable && /*#__PURE__*/React.createElement("span", {
      style: {
        whiteSpace: "nowrap"
      }
    }, /*#__PURE__*/React.createElement("button", {
      title: "Modifier",
      onClick: () => setEditingId(e.id),
      disabled: busyId === e.id,
      style: iconBtn
    }, "\u270F\uFE0F"), /*#__PURE__*/React.createElement("button", {
      title: "Supprimer",
      onClick: () => deleteEvent(e),
      disabled: busyId === e.id,
      style: iconBtn
    }, "\uD83D\uDDD1\uFE0F")));
  }), editable && editingId === "new" && /*#__PURE__*/React.createElement(FootEventEditor, {
    defaultHalf: match.current_half || 1,
    roster: roster,
    onSave: p => saveEvent("new", p),
    onCancel: () => setEditingId(null)
  }), editable && editingId !== "new" && /*#__PURE__*/React.createElement("button", {
    onClick: () => setEditingId("new"),
    style: {
      marginTop: 8,
      background: "none",
      border: "1px dashed #1e1e30",
      borderRadius: 8,
      color: "#60607a",
      padding: "7px 12px",
      cursor: "pointer",
      fontSize: 12,
      width: "100%"
    }
  }, "\u2795 Ajouter un but"));
}
function FootGoalPicker({
  roster,
  onConfirm,
  onCancel,
  withAssist,
  busy
}) {
  const [playerId, setPlayerId] = React.useState("");
  const [assistId, setAssistId] = React.useState("");
  const options = roster.map(r => PLAYERS.find(p => p.id === r.player_id)).filter(Boolean);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#13131f",
      border: "1px solid #1e1e30",
      borderRadius: 8,
      padding: 14,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 11,
      color: "#60607a"
    }
  }, "Buteur"), /*#__PURE__*/React.createElement("select", {
    value: playerId,
    onChange: e => setPlayerId(e.target.value),
    style: {
      display: "block",
      width: "100%",
      background: "#0d0d1c",
      border: "1px solid #1e1e30",
      borderRadius: 6,
      color: "#eeeef5",
      padding: "7px 10px",
      marginTop: 4,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "\u2014 Choisir \u2014"), options.map(p => /*#__PURE__*/React.createElement("option", {
    key: p.id,
    value: p.id
  }, getDisplayName(p, PLAYERS)))), withAssist && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 11,
      color: "#60607a"
    }
  }, "Passe d\xE9cisive (optionnel)"), /*#__PURE__*/React.createElement("select", {
    value: assistId,
    onChange: e => setAssistId(e.target.value),
    style: {
      display: "block",
      width: "100%",
      background: "#0d0d1c",
      border: "1px solid #1e1e30",
      borderRadius: 6,
      color: "#eeeef5",
      padding: "7px 10px",
      marginTop: 4,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "\u2014 Aucune \u2014"), options.filter(p => String(p.id) !== playerId).map(p => /*#__PURE__*/React.createElement("option", {
    key: p.id,
    value: p.id
  }, getDisplayName(p, PLAYERS))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onCancel,
    style: {
      flex: 1,
      background: "#0d0d1c",
      border: "1px solid #1e1e30",
      borderRadius: 6,
      color: "#eeeef5",
      padding: "8px",
      cursor: "pointer"
    }
  }, "Annuler"), /*#__PURE__*/React.createElement("button", {
    onClick: () => canConfirmGoal(playerId, busy) && onConfirm(Number(playerId), assistId ? Number(assistId) : null),
    disabled: !canConfirmGoal(playerId, busy),
    style: {
      flex: 1,
      background: "#3b82f6",
      color: "#fff",
      border: "none",
      borderRadius: 6,
      padding: "8px",
      fontWeight: 700,
      cursor: canConfirmGoal(playerId, busy) ? "pointer" : "default",
      opacity: canConfirmGoal(playerId, busy) ? 1 : 0.5
    }
  }, "Valider")));
}
function FootLiveAdminConsole({
  match,
  roster,
  events,
  lineups,
  reload
}) {
  const [now, setNow] = React.useState(Date.now());
  const [picking, setPicking] = React.useState(null); // null | "bl" | "opponent"
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsedSeconds = computeHalfElapsedSeconds(match.half_started_at, match.half_elapsed_seconds, now);
  const minutesElapsed = Math.floor(elapsedSeconds / 60);
  const running = !!match.half_started_at;
  async function logGoal(type, playerId, assistId) {
    setBusy(true);
    try {
      await sbInsert("foot_match_events", {
        match_id: match.id,
        half: match.current_half,
        minute: minutesElapsed,
        type,
        player_id: playerId,
        assist_player_id: assistId
      });
      await addToLineup(match.id, missingLineupPlayers(lineupIdsFor(lineups || [], match.id), {
        type,
        player_id: playerId,
        assist_player_id: assistId
      }));
      setPicking(null);
      await reload();
    } catch (e) {
      console.warn("log goal failed", e);
    }
    setBusy(false);
  }
  async function startHalf() {
    setBusy(true);
    try {
      await sbUpdate("foot_matches", {
        id: match.id
      }, {
        half_started_at: new Date().toISOString()
      });
      await reload();
    } catch (e) {
      console.warn(e);
    }
    setBusy(false);
  }
  async function endHalf() {
    setBusy(true);
    try {
      const frozenElapsed = computeHalfElapsedSeconds(match.half_started_at, match.half_elapsed_seconds, Date.now());
      const next = nextHalfState(match.current_half, match.nb_halves);
      if (next.type === "next") {
        await sbUpdate("foot_matches", {
          id: match.id
        }, {
          half_elapsed_seconds: 0,
          half_started_at: null,
          current_half: next.half
        });
      } else {
        await sbUpdate("foot_matches", {
          id: match.id
        }, {
          half_elapsed_seconds: frozenElapsed,
          half_started_at: null
        });
      }
      await reload();
    } catch (e) {
      console.warn(e);
    }
    setBusy(false);
  }
  async function closeMatch() {
    setBusy(true);
    try {
      await sbUpdate("foot_matches", {
        id: match.id
      }, {
        status: "finished",
        half_started_at: null
      });
      await reload();
    } catch (e) {
      console.warn(e);
      setBusy(false);
    }
  }
  const isLastHalf = match.current_half >= match.nb_halves;
  const liveAction = nextLiveAction(running, isLastHalf, match.half_elapsed_seconds);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#0d0d1c",
      border: "1px solid #3b82f655",
      borderRadius: 12,
      padding: 16,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Bebas Neue',sans-serif",
      fontSize: 14,
      color: "#3b82f6"
    }
  }, "CONSOLE ADMIN \u2014 Mi-temps ", match.current_half, "/", match.nb_halves), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Bebas Neue',sans-serif",
      fontSize: 28,
      margin: "8px 0"
    }
  }, String(minutesElapsed).padStart(2, "0"), ":", String(elapsedSeconds % 60).padStart(2, "0")), liveAction === "start" && /*#__PURE__*/React.createElement("button", {
    onClick: startHalf,
    disabled: busy,
    style: {
      width: "100%",
      background: "#34d399",
      color: "#080810",
      border: "none",
      borderRadius: 8,
      padding: "10px",
      fontWeight: 700,
      cursor: "pointer",
      marginBottom: 10
    }
  }, "\u25B6 D\xE9marrer la mi-temps"), liveAction === "playing" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setPicking("bl"),
    disabled: busy,
    style: {
      flex: 1,
      background: "#13131f",
      border: "1px solid #1e1e30",
      borderRadius: 8,
      color: "#eeeef5",
      padding: "10px",
      cursor: "pointer"
    }
  }, "\u26BD But Bi\xE8re Leverculsec"), /*#__PURE__*/React.createElement("button", {
    onClick: () => logGoal("goal_opponent", null, null),
    disabled: busy,
    style: {
      flex: 1,
      background: "#13131f",
      border: "1px solid #1e1e30",
      borderRadius: 8,
      color: "#eeeef5",
      padding: "10px",
      cursor: "pointer"
    }
  }, "\u26BD But adverse")), picking === "bl" && /*#__PURE__*/React.createElement(FootGoalPicker, {
    roster: roster,
    withAssist: true,
    busy: busy,
    onCancel: () => setPicking(null),
    onConfirm: (playerId, assistId) => logGoal("goal_bl", playerId, assistId)
  }), /*#__PURE__*/React.createElement("button", {
    onClick: endHalf,
    disabled: busy,
    style: {
      width: "100%",
      background: "#1e1e30",
      color: "#eeeef5",
      border: "none",
      borderRadius: 8,
      padding: "10px",
      fontWeight: 700,
      cursor: "pointer",
      marginTop: 10
    }
  }, isLastHalf ? "🏁 Fin de la dernière mi-temps" : "⏸ Terminer la mi-temps")), liveAction === "close" && /*#__PURE__*/React.createElement("button", {
    onClick: closeMatch,
    disabled: busy,
    style: {
      width: "100%",
      background: "#ef4444",
      color: "#fff",
      border: "none",
      borderRadius: 8,
      padding: "10px",
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "\uD83C\uDFC1 Cl\xF4turer le match"));
}
function FootMatchHeader({
  match
}) {
  const place = formatMatchPlace(match);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Bebas Neue',sans-serif",
      fontSize: 18
    }
  }, "Bi\xE8re Leverculsec vs ", match.opponent_name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#60607a",
      marginTop: 4
    }
  }, new Date(match.match_datetime).toLocaleString("fr-FR")), place && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#60607a"
    }
  }, place));
}
function FootLiveView({
  match,
  roster,
  events,
  lineups,
  currentPlayer,
  isAdmin,
  reload
}) {
  const matchEvents = events.filter(e => e.match_id === match.id);
  const score = computeFootScore(matchEvents);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#0d0d1c",
      border: "1px solid #1e1e30",
      borderRadius: 12,
      padding: 16
    }
  }, /*#__PURE__*/React.createElement(FootMatchHeader, {
    match: match
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Bebas Neue',sans-serif",
      fontSize: 32,
      margin: "10px 0"
    }
  }, score.bl, " \u2014 ", score.opponent), /*#__PURE__*/React.createElement(FootEventTimeline, {
    events: matchEvents,
    editable: isAdmin,
    match: match,
    roster: roster,
    lineups: lineups,
    reload: reload
  })), isAdmin && /*#__PURE__*/React.createElement(FootLiveAdminConsole, {
    match: match,
    roster: roster,
    events: matchEvents,
    lineups: lineups,
    reload: reload
  }), /*#__PURE__*/React.createElement(FootLineupSection, {
    match: match,
    roster: roster,
    lineups: lineups,
    isAdmin: isAdmin,
    reload: reload
  }));
}
function FootFinishedView({
  match,
  roster,
  events,
  lineups,
  isAdmin,
  reload
}) {
  const matchEvents = events.filter(e => e.match_id === match.id);
  const score = computeFootScore(matchEvents);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#0d0d1c",
      border: "1px solid #1e1e30",
      borderRadius: 12,
      padding: 16
    }
  }, /*#__PURE__*/React.createElement(FootMatchHeader, {
    match: match
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: "#34d399",
      textTransform: "uppercase",
      fontWeight: 700,
      marginTop: 4
    }
  }, "Termin\xE9"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Bebas Neue',sans-serif",
      fontSize: 32,
      margin: "10px 0"
    }
  }, score.bl, " \u2014 ", score.opponent), /*#__PURE__*/React.createElement(FootEventTimeline, {
    events: matchEvents,
    editable: isAdmin,
    match: match,
    roster: roster,
    lineups: lineups,
    reload: reload
  })), /*#__PURE__*/React.createElement(FootLineupSection, {
    match: match,
    roster: roster,
    lineups: lineups,
    isAdmin: isAdmin,
    reload: reload
  }));
}
function FootScheduledView({
  match,
  roster,
  attendance,
  currentPlayer,
  isAdmin,
  reload,
  onStartMatch
}) {
  const matchAttendance = attendance.filter(a => a.match_id === match.id);
  const buckets = computeAttendanceBuckets(roster, matchAttendance);
  const isOnRoster = roster.some(r => r.player_id === currentPlayer?.id);
  const myStatus = matchAttendance.find(a => a.player_id === currentPlayer?.id)?.status || null;
  const [saving, setSaving] = React.useState(false);
  async function setMyStatus(status) {
    setSaving(true);
    try {
      await setMatchAttendance(match.id, currentPlayer.id, status);
      await reload();
    } catch (e) {
      console.warn("attendance update failed", e);
    }
    setSaving(false);
  }
  function nameOf(playerId) {
    const p = PLAYERS.find(pl => pl.id === playerId);
    return p ? getDisplayName(p, PLAYERS) : "?";
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#0d0d1c",
      border: "1px solid #1e1e30",
      borderRadius: 12,
      padding: 16,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(FootMatchHeader, {
    match: match
  })), isOnRoster && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(FootAttendanceButtons, {
    myStatus: myStatus,
    saving: saving,
    onSet: setMyStatus
  })), roster.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      color: "#60607a",
      fontSize: 13,
      marginBottom: 16
    }
  }, "Aucun joueur dans l'effectif.") : /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, [["Présents", buckets.present, "#34d399"], ["N'a pas répondu", buckets.noResponse, "#60607a"], ["Absents", buckets.absent, "#ef4444"]].map(([label, ids, color]) => /*#__PURE__*/React.createElement("div", {
    key: label,
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color,
      textTransform: "uppercase",
      fontWeight: 700,
      marginBottom: 4
    }
  }, label, " (", ids.length, ")"), ids.map(id => /*#__PURE__*/React.createElement("div", {
    key: id,
    style: {
      fontSize: 13,
      padding: "3px 0"
    }
  }, nameOf(id)))))), isAdmin && /*#__PURE__*/React.createElement("button", {
    onClick: onStartMatch,
    style: {
      width: "100%",
      background: "#3b82f6",
      color: "#fff",
      border: "none",
      borderRadius: 8,
      padding: "12px",
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "COMMENCER LE MATCH"));
}
function FootMatchDetailPage({
  matchId,
  matches,
  roster,
  attendance,
  events,
  lineups,
  currentPlayer,
  isAdmin,
  navBack,
  reload
}) {
  const match = matches.find(m => m.id === matchId);
  const [startingConfig, setStartingConfig] = React.useState(false);
  const [editingInfo, setEditingInfo] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  if (!match) return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20,
      color: "#60607a"
    }
  }, "Match introuvable.");
  async function deleteMatch() {
    if (!window.confirm(`Supprimer définitivement le match contre ${match.opponent_name} ? Les buts et présences associés seront aussi supprimés.`)) return;
    setDeleting(true);
    try {
      await sbFetch("foot_matches", `?id=eq.${match.id}`, {
        method: "DELETE"
      });
      await reload();
      navBack();
    } catch (e) {
      console.warn("delete match failed", e);
      setDeleting(false);
    }
  }
  const topBtn = {
    background: "none",
    border: "1px solid #1e1e30",
    borderRadius: 8,
    color: "#eeeef5",
    padding: "6px 12px",
    cursor: "pointer",
    fontSize: 12
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "12px 20px 0",
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: navBack,
    style: topBtn
  }, "\u2190 Retour"), isAdmin && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => setEditingInfo(!editingInfo),
    disabled: deleting,
    style: topBtn
  }, "\u270F\uFE0F Modifier"), /*#__PURE__*/React.createElement("button", {
    onClick: deleteMatch,
    disabled: deleting,
    style: {
      ...topBtn,
      color: "#ef4444",
      borderColor: "#ef444455"
    }
  }, deleting ? "…" : "🗑️ Supprimer"))), isAdmin && editingInfo && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "12px 20px 0"
    }
  }, /*#__PURE__*/React.createElement(FootMatchForm, {
    title: "Modifier le match",
    submitLabel: "Enregistrer",
    initial: match,
    onCancel: () => setEditingInfo(false),
    onSubmit: async data => {
      await sbUpdate("foot_matches", {
        id: match.id
      }, data);
      await reload();
      setEditingInfo(false);
    }
  })), match.status === "scheduled" && !startingConfig && /*#__PURE__*/React.createElement(FootScheduledView, {
    match: match,
    roster: roster,
    attendance: attendance,
    currentPlayer: currentPlayer,
    isAdmin: isAdmin,
    reload: reload,
    onStartMatch: () => setStartingConfig(true)
  }), match.status === "scheduled" && startingConfig && /*#__PURE__*/React.createElement(FootStartMatchConfig, {
    match: match,
    roster: roster,
    attendance: attendance,
    reload: reload,
    onCancel: () => setStartingConfig(false)
  }), match.status === "live" && /*#__PURE__*/React.createElement(FootLiveView, {
    match: match,
    roster: roster,
    events: events,
    lineups: lineups,
    currentPlayer: currentPlayer,
    isAdmin: isAdmin,
    reload: reload
  }), match.status === "finished" && /*#__PURE__*/React.createElement(FootFinishedView, {
    match: match,
    roster: roster,
    events: events,
    lineups: lineups,
    isAdmin: isAdmin,
    reload: reload
  }));
}
function FootballApp({
  currentPlayer,
  onBack
}) {
  const [page, setPage] = React.useState("calendar");
  const [sub, setSub] = React.useState({});
  const [loaded, setLoaded] = React.useState(false);
  const [roster, setRoster] = React.useState([]);
  const [matches, setMatches] = React.useState([]);
  const [attendance, setAttendance] = React.useState([]);
  const [events, setEvents] = React.useState([]);
  const [lineups, setLineups] = React.useState([]);
  const isAdmin = currentPlayer?.uid === ADMIN_UID;
  async function reloadFoot() {
    const [r, m, a, e, l] = await Promise.all([sbFetch("foot_roster", "?select=*"), sbFetch("foot_matches", "?select=*&order=match_datetime"), sbFetch("foot_attendance", "?select=*"), sbFetch("foot_match_events", "?select=*"), sbFetch("foot_lineups", "?select=match_id,player_id")]);
    setRoster(r || []);
    setMatches(m || []);
    setAttendance(a || []);
    setEvents(e || []);
    setLineups(l || []);
  }
  React.useEffect(() => {
    reloadFoot().then(() => setLoaded(true)).catch(err => {
      console.warn("foot load failed", err);
      setLoaded(true);
    });
  }, []);
  function nav(p, s = {}) {
    setPage(p);
    setSub(s);
  }
  if (!loaded) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        minHeight: "100vh",
        background: "#080810",
        color: "#60607a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, "Chargement\u2026");
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100vh",
      background: "#080810",
      color: "#eeeef5",
      fontFamily: "'Outfit',sans-serif",
      paddingBottom: 70
    }
  }, /*#__PURE__*/React.createElement(FootballNavBar, {
    page: page,
    setPage: nav,
    onBack: onBack,
    isAdmin: isAdmin
  }), page === "calendar" && /*#__PURE__*/React.createElement(FootCalendarPage, {
    matches: matches,
    events: events,
    roster: roster,
    attendance: attendance,
    nav: nav,
    currentPlayer: currentPlayer,
    reload: reloadFoot
  }), page === "matchDetail" && /*#__PURE__*/React.createElement(FootMatchDetailPage, {
    matchId: sub.matchId,
    matches: matches,
    roster: roster,
    attendance: attendance,
    events: events,
    lineups: lineups,
    currentPlayer: currentPlayer,
    isAdmin: isAdmin,
    navBack: () => nav("calendar"),
    reload: reloadFoot
  }), page === "admin" && isAdmin && /*#__PURE__*/React.createElement(FootAdminPage, {
    roster: roster,
    reload: reloadFoot
  }), page === "rankings" && /*#__PURE__*/React.createElement(FootPlaceholderPage, {
    label: "Classement"
  }), page === "stats" && /*#__PURE__*/React.createElement(FootPlaceholderPage, {
    label: "Statistiques"
  }));
}
