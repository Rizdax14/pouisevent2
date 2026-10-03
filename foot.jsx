// foot.jsx

function FootballNavBar({ page, setPage, onBack, isAdmin }) {
  const m = useIsMobile();
  const items = [
    { id: "__back__", l: "Accueil", ic: "🏠", onClick: onBack },
    { id: "calendar", l: "Calendrier", ic: "📅" },
    { id: "rankings", l: "Classement", ic: "🏆" },
    { id: "stats", l: "Statistiques", ic: "📊" },
    ...(isAdmin ? [{ id: "admin", l: "Admin", ic: "🛠" }] : []),
  ];
  const wrapStyle = m
    ? { position: "fixed", bottom: 0, left: 0, right: 0, background: "#0d0d1c", borderTop: "1px solid #1e1e30", display: "flex", zIndex: 100, paddingBottom: "env(safe-area-inset-bottom)" }
    : { background: "#0d0d1c", borderBottom: "1px solid #1e1e30", padding: "0 32px", display: "flex", gap: 0, position: "sticky", top: 0, zIndex: 100 };
  return (
    <nav style={wrapStyle}>
      {items.map((item) => {
        const active = page === item.id;
        return (
          <button
            key={item.id}
            onClick={() => (item.onClick ? item.onClick() : setPage(item.id))}
            style={{
              flex: m ? 1 : "none", background: "none", border: "none", cursor: "pointer",
              padding: m ? "10px 4px 8px" : "16px 14px",
              display: "flex", flexDirection: m ? "column" : "row", alignItems: "center", gap: m ? 3 : 6,
              color: active ? "#3b82f6" : "#60607a", fontFamily: "'Outfit',sans-serif", fontSize: m ? 9 : 13, fontWeight: 600,
              borderBottom: !m && active ? "2px solid #3b82f6" : !m ? "2px solid transparent" : "none",
            }}
          >
            <span style={{ fontSize: m ? 18 : 15 }}>{item.ic}</span>
            <span style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>{item.l}</span>
          </button>
        );
      })}
    </nav>
  );
}

function FootPlaceholderPage({ label }) {
  return (
    <div style={{ padding: 40, textAlign: "center", color: "#60607a" }}>
      <div style={{ fontSize: 15 }}>{label}</div>
      <div style={{ fontSize: 11, marginTop: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>🔒 Bientôt disponible</div>
    </div>
  );
}

function FootballApp({ currentPlayer, onBack }) {
  const [page, setPage] = React.useState("calendar");
  const [sub, setSub] = React.useState({});
  const [loaded, setLoaded] = React.useState(false);
  const [roster, setRoster] = React.useState([]);
  const [matches, setMatches] = React.useState([]);
  const [attendance, setAttendance] = React.useState([]);
  const [events, setEvents] = React.useState([]);

  const isAdmin = currentPlayer?.uid === ADMIN_UID;

  async function reloadFoot() {
    const [r, m, a, e] = await Promise.all([
      sbFetch("foot_roster", "?select=*"),
      sbFetch("foot_matches", "?select=*&order=match_datetime"),
      sbFetch("foot_attendance", "?select=*"),
      sbFetch("foot_match_events", "?select=*"),
    ]);
    setRoster(r || []);
    setMatches(m || []);
    setAttendance(a || []);
    setEvents(e || []);
  }

  React.useEffect(() => {
    reloadFoot().then(() => setLoaded(true)).catch((err) => { console.warn("foot load failed", err); setLoaded(true); });
  }, []);

  function nav(p, s = {}) { setPage(p); setSub(s); }

  if (!loaded) {
    return <div style={{ minHeight: "100vh", background: "#080810", color: "#60607a", display: "flex", alignItems: "center", justifyContent: "center" }}>Chargement…</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#080810", color: "#eeeef5", fontFamily: "'Outfit',sans-serif", paddingBottom: 70 }}>
      <FootballNavBar page={page} setPage={nav} onBack={onBack} isAdmin={isAdmin} />
      {page === "calendar" && <FootPlaceholderPage label="Calendrier — Task 7" />}
      {page === "matchDetail" && <FootPlaceholderPage label="Détail du match — Tasks 9-12" />}
      {page === "admin" && isAdmin && <FootPlaceholderPage label="Admin — Tasks 6, 8" />}
      {page === "rankings" && <FootPlaceholderPage label="Classement" />}
      {page === "stats" && <FootPlaceholderPage label="Statistiques" />}
    </div>
  );
}
