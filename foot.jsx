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

function FootCreateMatchForm({ reload }) {
  const [opponentName, setOpponentName] = React.useState("");
  const [matchDatetime, setMatchDatetime] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [postalCode, setPostalCode] = React.useState("");
  const [city, setCity] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState(null);

  async function submit() {
    if (!opponentName.trim() || !matchDatetime) {
      setMsg({ t: "error", m: "Adversaire et date/heure sont obligatoires." });
      return;
    }
    setSaving(true);
    try {
      await sbInsert("foot_matches", {
        opponent_name: opponentName.trim(),
        match_datetime: new Date(matchDatetime).toISOString(),
        address: address.trim() || null,
        postal_code: postalCode.trim() || null,
        city: city.trim() || null,
      });
      setOpponentName(""); setMatchDatetime(""); setAddress(""); setPostalCode(""); setCity("");
      setMsg({ t: "success", m: "Match créé ✓" });
      await reload();
    } catch (e) {
      setMsg({ t: "error", m: "Erreur: " + e.message });
    }
    setSaving(false);
  }

  const inputStyle = { width: "100%", background: "#13131f", border: "1px solid #1e1e30", borderRadius: 8, padding: "9px 12px", color: "#eeeef5", fontSize: 13, marginBottom: 10 };

  return (
    <div style={{ background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 12, padding: 18, marginBottom: 20 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, marginBottom: 12 }}>Créer un match</div>
      <input style={inputStyle} placeholder="Nom de l'équipe adverse" value={opponentName} onChange={(e) => setOpponentName(e.target.value)} />
      <input style={inputStyle} type="datetime-local" value={matchDatetime} onChange={(e) => setMatchDatetime(e.target.value)} />
      <input style={inputStyle} placeholder="Adresse" value={address} onChange={(e) => setAddress(e.target.value)} />
      <input style={inputStyle} placeholder="Code postal" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
      <input style={inputStyle} placeholder="Ville" value={city} onChange={(e) => setCity(e.target.value)} />
      {msg && <div style={{ color: msg.t === "error" ? "#ef4444" : "#34d399", fontSize: 12, marginBottom: 10 }}>{msg.m}</div>}
      <button onClick={submit} disabled={saving} style={{ background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
        {saving ? "Création…" : "Créer le match"}
      </button>
    </div>
  );
}

function FootMatchCard({ match, score, presentCount, rosterSize, onClick }) {
  const dt = new Date(match.match_datetime);
  const dateLabel = dt.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) + " · " + dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const statusLabel = match.status === "scheduled" ? "À venir" : match.status === "live" ? "En cours" : "Terminé";
  const statusColor = match.status === "scheduled" ? "#60607a" : match.status === "live" ? "#ef4444" : "#34d399";
  return (
    <div onClick={onClick} style={{ background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 12, padding: 16, marginBottom: 10, cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16 }}>Bière Leverculsec vs {match.opponent_name}</div>
        <div style={{ fontSize: 10, color: statusColor, textTransform: "uppercase", fontWeight: 700 }}>{statusLabel}</div>
      </div>
      <div style={{ fontSize: 12, color: "#60607a", marginBottom: 4 }}>{dateLabel}</div>
      {match.city && <div style={{ fontSize: 12, color: "#60607a" }}>{match.city}</div>}
      {match.status !== "scheduled" && <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, marginTop: 6 }}>{score.bl} — {score.opponent}</div>}
      {match.status === "scheduled" && <div style={{ fontSize: 12, color: "#60607a", marginTop: 6 }}>{presentCount}/{rosterSize} présents</div>}
    </div>
  );
}

function FootCalendarPage({ matches, events, roster, attendance, nav }) {
  if (matches.length === 0) {
    return <div style={{ padding: 40, textAlign: "center", color: "#60607a" }}>Aucun match pour l'instant.</div>;
  }
  return (
    <div style={{ padding: 16 }}>
      {matches.map((match) => {
        const matchEvents = events.filter((e) => e.match_id === match.id);
        const score = computeFootScore(matchEvents);
        const presentCount = attendance.filter((a) => a.match_id === match.id && a.status === "present").length;
        return (
          <FootMatchCard
            key={match.id}
            match={match}
            score={score}
            presentCount={presentCount}
            rosterSize={roster.length}
            onClick={() => nav("matchDetail", { matchId: match.id })}
          />
        );
      })}
    </div>
  );
}

function FootRosterManager({ roster, reload }) {
  const [saving, setSaving] = React.useState(null); // player id currently being saved

  const roleByPlayer = {};
  roster.forEach((r) => { roleByPlayer[r.player_id] = r.role; });

  async function setRole(playerId, role) {
    setSaving(playerId);
    try {
      if (role === "") {
        await sbFetch("foot_roster", `?player_id=eq.${playerId}`, { method: "DELETE" });
      } else {
        await SUPABASE.from("foot_roster").upsert({ player_id: playerId, role }, { onConflict: "player_id" });
      }
      await reload();
    } catch (e) {
      console.warn("roster update failed", e);
    }
    setSaving(null);
  }

  const sortedPlayers = [...PLAYERS].sort((a, b) => (getDisplayName(a, PLAYERS) || "").localeCompare(getDisplayName(b, PLAYERS) || ""));

  if (sortedPlayers.length === 0) {
    return <div style={{ color: "#60607a", fontSize: 13 }}>Aucun joueur dans l'effectif.</div>;
  }

  return (
    <div style={{ background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 12, padding: 18 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, marginBottom: 12 }}>Effectif</div>
      {sortedPlayers.map((p) => (
        <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1e1e30" }}>
          <div style={{ fontSize: 13 }}>{getDisplayName(p, PLAYERS)}</div>
          <select
            value={roleByPlayer[p.id] || ""}
            disabled={saving === p.id}
            onChange={(e) => setRole(p.id, e.target.value)}
            style={{ background: "#13131f", border: "1px solid #1e1e30", borderRadius: 6, color: "#eeeef5", padding: "5px 8px", fontSize: 12 }}
          >
            <option value="">Pas dans l'équipe</option>
            <option value="regulier">Régulier</option>
            <option value="occasionnel">Occasionnel</option>
            <option value="invite">Invité</option>
          </select>
        </div>
      ))}
    </div>
  );
}

function FootAdminPage({ roster, reload }) {
  return (
    <div style={{ padding: 20 }}>
      <FootCreateMatchForm reload={reload} />
      <FootRosterManager roster={roster} reload={reload} />
    </div>
  );
}

function FootStartMatchConfig({ match, reload, onCancel }) {
  const [nbHalves, setNbHalves] = React.useState(2);
  const [halfDuration, setHalfDuration] = React.useState(45);
  const [saving, setSaving] = React.useState(false);

  async function start() {
    setSaving(true);
    try {
      await sbUpdate("foot_matches", { id: match.id }, {
        status: "live",
        nb_halves: nbHalves,
        half_duration_min: halfDuration,
        current_half: 1,
        half_started_at: null,
        half_elapsed_seconds: 0,
      });
      await reload();
    } catch (e) {
      console.warn("start match failed", e);
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 12, padding: 18 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, marginBottom: 14 }}>Configuration du match</div>
        <label style={{ fontSize: 12, color: "#60607a" }}>Nombre de mi-temps</label>
        <select value={nbHalves} onChange={(e) => setNbHalves(Number(e.target.value))} style={{ display: "block", width: "100%", background: "#13131f", border: "1px solid #1e1e30", borderRadius: 8, color: "#eeeef5", padding: "9px 12px", marginTop: 4, marginBottom: 14 }}>
          {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <label style={{ fontSize: 12, color: "#60607a" }}>Durée par mi-temps (minutes)</label>
        <input type="number" min={1} value={halfDuration} onChange={(e) => setHalfDuration(Number(e.target.value))} style={{ display: "block", width: "100%", background: "#13131f", border: "1px solid #1e1e30", borderRadius: 8, color: "#eeeef5", padding: "9px 12px", marginTop: 4, marginBottom: 18 }} />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} disabled={saving} style={{ flex: 1, background: "#13131f", border: "1px solid #1e1e30", borderRadius: 8, color: "#eeeef5", padding: "10px", cursor: "pointer" }}>Annuler</button>
          <button onClick={start} disabled={saving} style={{ flex: 1, background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Démarrage…" : "Démarrer le match"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FootEventTimeline({ events }) {
  const sorted = buildEventTimeline(events);
  if (sorted.length === 0) return <div style={{ color: "#60607a", fontSize: 13 }}>Aucun but pour l'instant.</div>;
  return (
    <div>
      {sorted.map((e) => {
        const scorer = e.player_id ? PLAYERS.find((p) => p.id === e.player_id) : null;
        const assist = e.assist_player_id ? PLAYERS.find((p) => p.id === e.assist_player_id) : null;
        const label = e.type === "goal_bl"
          ? `⚽ ${scorer ? getDisplayName(scorer, PLAYERS) : "?"}${assist ? " (passe D: " + getDisplayName(assist, PLAYERS) + ")" : ""}`
          : `⚽ But adverse`;
        return (
          <div key={e.id} style={{ display: "flex", gap: 10, padding: "5px 0", fontSize: 13 }}>
            <span style={{ color: "#60607a", width: 50 }}>{e.half}e · {e.minute}'</span>
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function FootGoalPicker({ roster, onConfirm, onCancel, withAssist }) {
  const [playerId, setPlayerId] = React.useState("");
  const [assistId, setAssistId] = React.useState("");
  const options = roster.map((r) => PLAYERS.find((p) => p.id === r.player_id)).filter(Boolean);
  return (
    <div style={{ background: "#13131f", border: "1px solid #1e1e30", borderRadius: 8, padding: 14, marginTop: 10 }}>
      <label style={{ fontSize: 11, color: "#60607a" }}>Buteur</label>
      <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} style={{ display: "block", width: "100%", background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 6, color: "#eeeef5", padding: "7px 10px", marginTop: 4, marginBottom: 10 }}>
        <option value="">— Choisir —</option>
        {options.map((p) => <option key={p.id} value={p.id}>{getDisplayName(p, PLAYERS)}</option>)}
      </select>
      {withAssist && (
        <>
          <label style={{ fontSize: 11, color: "#60607a" }}>Passe décisive (optionnel)</label>
          <select value={assistId} onChange={(e) => setAssistId(e.target.value)} style={{ display: "block", width: "100%", background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 6, color: "#eeeef5", padding: "7px 10px", marginTop: 4, marginBottom: 10 }}>
            <option value="">— Aucune —</option>
            {options.filter((p) => String(p.id) !== playerId).map((p) => <option key={p.id} value={p.id}>{getDisplayName(p, PLAYERS)}</option>)}
          </select>
        </>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button onClick={onCancel} style={{ flex: 1, background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 6, color: "#eeeef5", padding: "8px", cursor: "pointer" }}>Annuler</button>
        <button
          onClick={() => playerId && onConfirm(Number(playerId), assistId ? Number(assistId) : null)}
          disabled={!playerId}
          style={{ flex: 1, background: "#3b82f6", color: "#fff", border: "none", borderRadius: 6, padding: "8px", fontWeight: 700, cursor: playerId ? "pointer" : "default", opacity: playerId ? 1 : 0.5 }}
        >
          Valider
        </button>
      </div>
    </div>
  );
}

function FootLiveAdminConsole({ match, roster, events, reload }) {
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
        assist_player_id: assistId,
      });
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
      await sbUpdate("foot_matches", { id: match.id }, { half_started_at: new Date().toISOString() });
      await reload();
    } catch (e) { console.warn(e); }
    setBusy(false);
  }

  async function endHalf() {
    setBusy(true);
    try {
      const frozenElapsed = computeHalfElapsedSeconds(match.half_started_at, match.half_elapsed_seconds, Date.now());
      const next = nextHalfState(match.current_half, match.nb_halves);
      if (next.type === "next") {
        await sbUpdate("foot_matches", { id: match.id }, {
          half_elapsed_seconds: 0,
          half_started_at: null,
          current_half: next.half,
        });
      } else {
        await sbUpdate("foot_matches", { id: match.id }, {
          half_elapsed_seconds: frozenElapsed,
          half_started_at: null,
        });
      }
      await reload();
    } catch (e) { console.warn(e); }
    setBusy(false);
  }

  async function closeMatch() {
    setBusy(true);
    try {
      await sbUpdate("foot_matches", { id: match.id }, { status: "finished", half_started_at: null });
      await reload();
    } catch (e) { console.warn(e); setBusy(false); }
  }

  const isLastHalf = match.current_half >= match.nb_halves;

  return (
    <div style={{ background: "#0d0d1c", border: "1px solid #3b82f655", borderRadius: 12, padding: 16, marginTop: 16 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 14, color: "#3b82f6" }}>CONSOLE ADMIN — Mi-temps {match.current_half}/{match.nb_halves}</div>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, margin: "8px 0" }}>{String(minutesElapsed).padStart(2, "0")}:{String(elapsedSeconds % 60).padStart(2, "0")}</div>

      {!running && <button onClick={startHalf} disabled={busy} style={{ width: "100%", background: "#34d399", color: "#080810", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, cursor: "pointer", marginBottom: 10 }}>▶ Démarrer la mi-temps</button>}

      {running && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button onClick={() => setPicking("bl")} disabled={busy} style={{ flex: 1, background: "#13131f", border: "1px solid #1e1e30", borderRadius: 8, color: "#eeeef5", padding: "10px", cursor: "pointer" }}>⚽ But Bière Leverculsec</button>
            <button onClick={() => logGoal("goal_opponent", null, null)} disabled={busy} style={{ flex: 1, background: "#13131f", border: "1px solid #1e1e30", borderRadius: 8, color: "#eeeef5", padding: "10px", cursor: "pointer" }}>⚽ But adverse</button>
          </div>
          {picking === "bl" && (
            <FootGoalPicker roster={roster} withAssist onCancel={() => setPicking(null)} onConfirm={(playerId, assistId) => logGoal("goal_bl", playerId, assistId)} />
          )}
          <button onClick={endHalf} disabled={busy} style={{ width: "100%", background: "#1e1e30", color: "#eeeef5", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, cursor: "pointer", marginTop: 10 }}>
            {isLastHalf ? "🏁 Fin de la dernière mi-temps" : "⏸ Terminer la mi-temps"}
          </button>
        </>
      )}

      {!running && isLastHalf && match.half_elapsed_seconds > 0 && (
        <button onClick={closeMatch} disabled={busy} style={{ width: "100%", background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, cursor: "pointer" }}>🏁 Clôturer le match</button>
      )}
    </div>
  );
}

function FootLiveView({ match, roster, events, currentPlayer, isAdmin, reload }) {
  const matchEvents = events.filter((e) => e.match_id === match.id);
  const score = computeFootScore(matchEvents);
  return (
    <div style={{ padding: 20 }}>
      <div style={{ background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 12, padding: 16 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18 }}>Bière Leverculsec vs {match.opponent_name}</div>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, margin: "10px 0" }}>{score.bl} — {score.opponent}</div>
        <FootEventTimeline events={matchEvents} />
      </div>
      {isAdmin && <FootLiveAdminConsole match={match} roster={roster} events={matchEvents} reload={reload} />}
    </div>
  );
}
function FootFinishedView() { return <div style={{ padding: 20, color: "#60607a" }}>Task 12</div>; }

function FootScheduledView({ match, roster, attendance, currentPlayer, isAdmin, reload, onStartMatch }) {
  const matchAttendance = attendance.filter((a) => a.match_id === match.id);
  const buckets = computeAttendanceBuckets(roster, matchAttendance);
  const isOnRoster = roster.some((r) => r.player_id === currentPlayer?.id);
  const myStatus = matchAttendance.find((a) => a.player_id === currentPlayer?.id)?.status || null;
  const [saving, setSaving] = React.useState(false);

  async function setMyStatus(status) {
    setSaving(true);
    try {
      await SUPABASE.from("foot_attendance").upsert(
        { match_id: match.id, player_id: currentPlayer.id, status },
        { onConflict: "match_id,player_id" }
      );
      await reload();
    } catch (e) {
      console.warn("attendance update failed", e);
    }
    setSaving(false);
  }

  function nameOf(playerId) {
    const p = PLAYERS.find((pl) => pl.id === playerId);
    return p ? getDisplayName(p, PLAYERS) : "?";
  }

  const dt = new Date(match.match_datetime);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18 }}>Bière Leverculsec vs {match.opponent_name}</div>
        <div style={{ fontSize: 12, color: "#60607a", marginTop: 4 }}>{dt.toLocaleString("fr-FR")}</div>
        {match.address && <div style={{ fontSize: 12, color: "#60607a" }}>{match.address}, {match.postal_code} {match.city}</div>}
      </div>

      {isOnRoster && (
        <div style={{ marginBottom: 16, display: "flex", gap: 10 }}>
          <button onClick={() => setMyStatus("present")} disabled={saving} style={{ flex: 1, background: myStatus === "present" ? "#34d399" : "#13131f", color: myStatus === "present" ? "#080810" : "#eeeef5", border: "1px solid #1e1e30", borderRadius: 8, padding: "10px", cursor: "pointer", fontWeight: 700 }}>
            Présent
          </button>
          <button onClick={() => setMyStatus("absent")} disabled={saving} style={{ flex: 1, background: myStatus === "absent" ? "#ef4444" : "#13131f", color: myStatus === "absent" ? "#080810" : "#eeeef5", border: "1px solid #1e1e30", borderRadius: 8, padding: "10px", cursor: "pointer", fontWeight: 700 }}>
            Absent
          </button>
        </div>
      )}

      {roster.length === 0 ? (
        <div style={{ color: "#60607a", fontSize: 13, marginBottom: 16 }}>Aucun joueur dans l'effectif.</div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          {[["Présents", buckets.present, "#34d399"], ["N'a pas répondu", buckets.noResponse, "#60607a"], ["Absents", buckets.absent, "#ef4444"]].map(([label, ids, color]) => (
            <div key={label} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>{label} ({ids.length})</div>
              {ids.map((id) => <div key={id} style={{ fontSize: 13, padding: "3px 0" }}>{nameOf(id)}</div>)}
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        <button onClick={onStartMatch} style={{ width: "100%", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontWeight: 700, cursor: "pointer" }}>
          COMMENCER LE MATCH
        </button>
      )}
    </div>
  );
}

function FootMatchDetailPage({ matchId, matches, roster, attendance, events, currentPlayer, isAdmin, navBack, reload }) {
  const match = matches.find((m) => m.id === matchId);
  const [startingConfig, setStartingConfig] = React.useState(false);

  if (!match) return <div style={{ padding: 20, color: "#60607a" }}>Match introuvable.</div>;

  return (
    <div>
      <div style={{ padding: "12px 20px 0" }}>
        <button onClick={navBack} style={{ background: "none", border: "1px solid #1e1e30", borderRadius: 8, color: "#eeeef5", padding: "6px 12px", cursor: "pointer", fontSize: 12 }}>← Retour</button>
      </div>
      {match.status === "scheduled" && !startingConfig && (
        <FootScheduledView match={match} roster={roster} attendance={attendance} currentPlayer={currentPlayer} isAdmin={isAdmin} reload={reload} onStartMatch={() => setStartingConfig(true)} />
      )}
      {match.status === "scheduled" && startingConfig && (
        <FootStartMatchConfig match={match} reload={reload} onCancel={() => setStartingConfig(false)} />
      )}
      {match.status === "live" && (
        <FootLiveView match={match} roster={roster} events={events} currentPlayer={currentPlayer} isAdmin={isAdmin} reload={reload} />
      )}
      {match.status === "finished" && (
        <FootFinishedView match={match} events={events} />
      )}
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
      {page === "calendar" && <FootCalendarPage matches={matches} events={events} roster={roster} attendance={attendance} nav={nav} />}
      {page === "matchDetail" && (
        <FootMatchDetailPage
          matchId={sub.matchId}
          matches={matches}
          roster={roster}
          attendance={attendance}
          events={events}
          currentPlayer={currentPlayer}
          isAdmin={isAdmin}
          navBack={() => nav("calendar")}
          reload={reloadFoot}
        />
      )}
      {page === "admin" && isAdmin && <FootAdminPage roster={roster} reload={reloadFoot} />}
      {page === "rankings" && <FootPlaceholderPage label="Classement" />}
      {page === "stats" && <FootPlaceholderPage label="Statistiques" />}
    </div>
  );
}
