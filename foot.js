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
function FootCreateMatchForm({
  reload
}) {
  const [opponentName, setOpponentName] = React.useState("");
  const [matchDatetime, setMatchDatetime] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [postalCode, setPostalCode] = React.useState("");
  const [city, setCity] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  async function submit() {
    if (!opponentName.trim() || !matchDatetime) {
      setMsg({
        t: "error",
        m: "Adversaire et date/heure sont obligatoires."
      });
      return;
    }
    setSaving(true);
    try {
      await sbInsert("foot_matches", {
        opponent_name: opponentName.trim(),
        match_datetime: new Date(matchDatetime).toISOString(),
        address: address.trim() || null,
        postal_code: postalCode.trim() || null,
        city: city.trim() || null
      });
      setOpponentName("");
      setMatchDatetime("");
      setAddress("");
      setPostalCode("");
      setCity("");
      setMsg({
        t: "success",
        m: "Match créé ✓"
      });
      await reload();
    } catch (e) {
      setMsg({
        t: "error",
        m: "Erreur: " + e.message
      });
    }
    setSaving(false);
  }
  const inputStyle = {
    width: "100%",
    background: "#13131f",
    border: "1px solid #1e1e30",
    borderRadius: 8,
    padding: "9px 12px",
    color: "#eeeef5",
    fontSize: 13,
    marginBottom: 10
  };
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
  }, "Cr\xE9er un match"), /*#__PURE__*/React.createElement("input", {
    style: inputStyle,
    placeholder: "Nom de l'\xE9quipe adverse",
    value: opponentName,
    onChange: e => setOpponentName(e.target.value)
  }), /*#__PURE__*/React.createElement("input", {
    style: inputStyle,
    type: "datetime-local",
    value: matchDatetime,
    onChange: e => setMatchDatetime(e.target.value)
  }), /*#__PURE__*/React.createElement("input", {
    style: inputStyle,
    placeholder: "Adresse",
    value: address,
    onChange: e => setAddress(e.target.value)
  }), /*#__PURE__*/React.createElement("input", {
    style: inputStyle,
    placeholder: "Code postal",
    value: postalCode,
    onChange: e => setPostalCode(e.target.value)
  }), /*#__PURE__*/React.createElement("input", {
    style: inputStyle,
    placeholder: "Ville",
    value: city,
    onChange: e => setCity(e.target.value)
  }), msg && /*#__PURE__*/React.createElement("div", {
    style: {
      color: msg.t === "error" ? "#ef4444" : "#34d399",
      fontSize: 12,
      marginBottom: 10
    }
  }, msg.m), /*#__PURE__*/React.createElement("button", {
    onClick: submit,
    disabled: saving,
    style: {
      background: "#3b82f6",
      color: "#fff",
      border: "none",
      borderRadius: 8,
      padding: "9px 16px",
      fontWeight: 700,
      cursor: saving ? "default" : "pointer",
      opacity: saving ? 0.6 : 1
    }
  }, saving ? "Création…" : "Créer le match"));
}
function FootMatchCard({
  match,
  score,
  presentCount,
  rosterSize,
  onClick
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
  }, dateLabel), match.city && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#60607a"
    }
  }, match.city), match.status !== "scheduled" && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Bebas Neue',sans-serif",
      fontSize: 22,
      marginTop: 6
    }
  }, score.bl, " \u2014 ", score.opponent), match.status === "scheduled" && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#60607a",
      marginTop: 6
    }
  }, presentCount, "/", rosterSize, " pr\xE9sents"));
}
function FootCalendarPage({
  matches,
  events,
  roster,
  attendance,
  nav
}) {
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
    const presentCount = attendance.filter(a => a.match_id === match.id && a.status === "present").length;
    return /*#__PURE__*/React.createElement(FootMatchCard, {
      key: match.id,
      match: match,
      score: score,
      presentCount: presentCount,
      rosterSize: roster.length,
      onClick: () => nav("matchDetail", {
        matchId: match.id
      })
    });
  }));
}
function FootRosterManager({
  roster,
  reload
}) {
  const [saving, setSaving] = React.useState(null); // player id currently being saved

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
        await SUPABASE.from("foot_roster").upsert({
          player_id: playerId,
          role
        }, {
          onConflict: "player_id"
        });
      }
      await reload();
    } catch (e) {
      console.warn("roster update failed", e);
    }
    setSaving(null);
  }
  const sortedPlayers = [...PLAYERS].sort((a, b) => (getDisplayName(a, PLAYERS) || "").localeCompare(getDisplayName(b, PLAYERS) || ""));
  if (sortedPlayers.length === 0) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        color: "#60607a",
        fontSize: 13
      }
    }, "Aucun joueur dans l'effectif.");
  }
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
  }, "Effectif"), sortedPlayers.map(p => /*#__PURE__*/React.createElement("div", {
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
  const isAdmin = currentPlayer?.uid === ADMIN_UID;
  async function reloadFoot() {
    const [r, m, a, e] = await Promise.all([sbFetch("foot_roster", "?select=*"), sbFetch("foot_matches", "?select=*&order=match_datetime"), sbFetch("foot_attendance", "?select=*"), sbFetch("foot_match_events", "?select=*")]);
    setRoster(r || []);
    setMatches(m || []);
    setAttendance(a || []);
    setEvents(e || []);
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
    nav: nav
  }), page === "matchDetail" && /*#__PURE__*/React.createElement(FootPlaceholderPage, {
    label: "D\xE9tail du match \u2014 Tasks 9-12"
  }), page === "admin" && isAdmin && /*#__PURE__*/React.createElement(FootAdminPage, {
    roster: roster,
    reload: reloadFoot
  }), page === "rankings" && /*#__PURE__*/React.createElement(FootPlaceholderPage, {
    label: "Classement"
  }), page === "stats" && /*#__PURE__*/React.createElement(FootPlaceholderPage, {
    label: "Statistiques"
  }));
}
