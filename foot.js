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
  }), page === "calendar" && /*#__PURE__*/React.createElement(FootPlaceholderPage, {
    label: "Calendrier \u2014 Task 7"
  }), page === "matchDetail" && /*#__PURE__*/React.createElement(FootPlaceholderPage, {
    label: "D\xE9tail du match \u2014 Tasks 9-12"
  }), page === "admin" && isAdmin && /*#__PURE__*/React.createElement(FootPlaceholderPage, {
    label: "Admin \u2014 Tasks 6, 8"
  }), page === "rankings" && /*#__PURE__*/React.createElement(FootPlaceholderPage, {
    label: "Classement"
  }), page === "stats" && /*#__PURE__*/React.createElement(FootPlaceholderPage, {
    label: "Statistiques"
  }));
}
