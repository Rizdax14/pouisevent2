// foot.jsx

function FootballNavBar({ page, setPage, onBack, isAdmin }) {
  const m = useIsMobile();
  const items = [
    { id: "__back__", l: "Accueil", ic: "🏠", onClick: onBack },
    { id: "calendar", l: "Calendrier", ic: "📅" },
    { id: "rankings", l: "Classement", ic: "🏆" },
    { id: "stats", l: "Statistiques", lm: "Stats", ic: "📊" },
    ...(isAdmin ? [{ id: "reseaux", l: "Réseaux", ic: "📣" }, { id: "admin", l: "Admin", ic: "🛠" }] : []),
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
              flex: m ? "1 1 0" : "none", minWidth: 0, background: "none", border: "none", cursor: "pointer",
              padding: m ? "10px 1px 8px" : "16px 14px",
              display: "flex", flexDirection: m ? "column" : "row", alignItems: "center", gap: m ? 3 : 6,
              color: active ? "#3b82f6" : "#60607a", fontFamily: "'Outfit',sans-serif", fontSize: m ? 8 : 13, fontWeight: 600,
              borderBottom: !m && active ? "2px solid #3b82f6" : !m ? "2px solid transparent" : "none",
            }}
          >
            <span style={{ fontSize: m ? 18 : 15 }}>{item.ic}</span>
            <span style={{ textTransform: "uppercase", letterSpacing: m ? "0" : "0.05em", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m && item.lm ? item.lm : item.l}</span>
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

const FOOT_INPUT_STYLE = { width: "100%", background: "#13131f", border: "1px solid #1e1e30", borderRadius: 8, padding: "9px 12px", color: "#eeeef5", fontSize: 13, marginBottom: 10 };

async function setMatchAttendance(matchId, playerId, status) {
  assertUpsertOk(await SUPABASE.from("foot_attendance").upsert(
    { match_id: matchId, player_id: playerId, status, responded_at: new Date().toISOString() },
    { onConflict: "match_id,player_id" }
  ));
}

async function addToLineup(matchId, playerIds) {
  if (!playerIds.length) return;
  assertUpsertOk(await SUPABASE.from("foot_lineups").upsert(
    playerIds.map((player_id) => ({ match_id: matchId, player_id })),
    { onConflict: "match_id,player_id", ignoreDuplicates: true }
  ));
}

async function saveLineup(matchId, currentIds, wantedIds) {
  await applyLineupChange(matchId, diffLineup(currentIds, wantedIds));
}

async function applyLineupChange(matchId, { add, remove }) {
  await addToLineup(matchId, add);
  if (remove.length) {
    await sbFetch("foot_lineups", `?match_id=eq.${matchId}&player_id=in.(${remove.join(",")})`, { method: "DELETE" });
  }
}

function attendanceRoster(roster) {
  return roster.filter((r) => r.role !== "invite");
}

function lineupIdsFor(lineups, matchId) {
  return lineups.filter((l) => l.match_id === matchId).map((l) => l.player_id);
}

function FootLineupChecklist({ roster, extraIds, checked, onToggle, disabled }) {
  const ids = [...new Set([...roster.map((r) => r.player_id), ...(extraIds || [])])];
  const players = ids.map((id) => PLAYERS.find((p) => p.id === id)).filter(Boolean)
    .sort((a, b) => (getDisplayName(a, PLAYERS) || "").localeCompare(getDisplayName(b, PLAYERS) || ""));
  if (players.length === 0) return <div style={{ color: "#60607a", fontSize: 13 }}>Aucun joueur dans l'effectif.</div>;
  return (
    <div>
      {players.map((p) => (
        <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 13, cursor: disabled ? "default" : "pointer" }}>
          <input type="checkbox" checked={checked.includes(p.id)} disabled={disabled} onChange={() => onToggle(p.id)} />
          {getDisplayName(p, PLAYERS)}
        </label>
      ))}
    </div>
  );
}

function FootLineupSection({ match, roster, lineups, isAdmin, reload }) {
  const current = lineupIdsFor(lineups, match.id);
  const [editing, setEditing] = React.useState(false);
  const [snapshot, setSnapshot] = React.useState(current);
  const [wanted, setWanted] = React.useState(current);
  const [saving, setSaving] = React.useState(false);
  const toggle = (id) => setWanted(wanted.includes(id) ? wanted.filter((x) => x !== id) : [...wanted, id]);

  async function save() {
    setSaving(true);
    try { await applyLineupChange(match.id, diffLineupEdit(snapshot, current, wanted)); await reload(); setEditing(false); }
    catch (e) { console.warn("lineup save failed", e); }
    setSaving(false);
  }

  const names = current.map((id) => PLAYERS.find((p) => p.id === id)).filter(Boolean).map((p) => getDisplayName(p, PLAYERS));
  return (
    <div style={{ background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 12, padding: 16, marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 14 }}>Feuille de match ({current.length})</div>
        {isAdmin && !editing && <button onClick={() => { setSnapshot(current); setWanted(current); setEditing(true); }} style={{ background: "none", border: "1px solid #1e1e30", borderRadius: 6, color: "#eeeef5", padding: "4px 10px", cursor: "pointer", fontSize: 12 }}>✏️ Modifier</button>}
      </div>
      {!editing && (names.length ? <div style={{ fontSize: 13, color: "#cccce0" }}>{names.join(" · ")}</div> : <div style={{ fontSize: 13, color: "#60607a" }}>Personne sur la feuille.</div>)}
      {editing && (
        <>
          <FootLineupChecklist roster={roster} extraIds={current} checked={wanted} onToggle={toggle} disabled={saving} />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={() => setEditing(false)} disabled={saving} style={{ flex: 1, background: "#13131f", border: "1px solid #1e1e30", borderRadius: 6, color: "#eeeef5", padding: "8px", cursor: "pointer" }}>Annuler</button>
            <button onClick={save} disabled={saving} style={{ flex: 1, background: "#3b82f6", color: "#fff", border: "none", borderRadius: 6, padding: "8px", fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "…" : "Enregistrer"}</button>
          </div>
        </>
      )}
    </div>
  );
}

function formatMatchPlace(match) {
  const cityLine = [match.postal_code, match.city].filter(Boolean).join(" ");
  return [match.stadium_name, match.address, cityLine].filter(Boolean).join(" · ");
}

function FootMatchForm({ title, initial, submitLabel, onSubmit, onCancel, resetOnSuccess }) {
  const empty = { opponent_name: "", match_datetime: "", stadium_name: "", address: "", postal_code: "", city: "", match_type: "championnat", venue: "domicile" };
  const start = initial ? { ...empty, ...initial, match_datetime: toDatetimeLocalValue(initial.match_datetime) } : empty;
  const [f, setF] = React.useState(start);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState(null);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit() {
    if (!f.opponent_name.trim() || !f.match_datetime) {
      setMsg({ t: "error", m: "Adversaire et date/heure sont obligatoires." });
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        opponent_name: f.opponent_name.trim(),
        match_type: f.match_type || "championnat",
        venue: f.venue === "exterieur" ? "exterieur" : "domicile",
        match_datetime: new Date(f.match_datetime).toISOString(),
        stadium_name: (f.stadium_name || "").trim() || null,
        address: (f.address || "").trim() || null,
        postal_code: (f.postal_code || "").trim() || null,
        city: (f.city || "").trim() || null,
      });
      if (resetOnSuccess) setF(empty);
      setMsg({ t: "success", m: "Enregistré ✓" });
    } catch (e) {
      setMsg({ t: "error", m: "Erreur: " + e.message });
    }
    setSaving(false);
  }

  return (
    <div style={{ background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 12, padding: 18, marginBottom: 20 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, marginBottom: 12 }}>{title}</div>
      <input style={FOOT_INPUT_STYLE} placeholder="Nom de l'équipe adverse" value={f.opponent_name} onChange={set("opponent_name")} />
      <input style={FOOT_INPUT_STYLE} type="datetime-local" value={f.match_datetime} onChange={set("match_datetime")} />
      <select style={FOOT_INPUT_STYLE} value={f.match_type || "championnat"} onChange={set("match_type")}>
        <option value="championnat">Championnat</option>
        <option value="amical">Match amical</option>
      </select>
      <select style={FOOT_INPUT_STYLE} value={f.venue || "domicile"} onChange={set("venue")}>
        <option value="domicile">Domicile</option>
        <option value="exterieur">Extérieur</option>
      </select>
      <input style={FOOT_INPUT_STYLE} placeholder="Nom du stade" value={f.stadium_name || ""} onChange={set("stadium_name")} />
      <input style={FOOT_INPUT_STYLE} placeholder="Adresse" value={f.address || ""} onChange={set("address")} />
      <input style={FOOT_INPUT_STYLE} placeholder="Code postal" value={f.postal_code || ""} onChange={set("postal_code")} />
      <input style={FOOT_INPUT_STYLE} placeholder="Ville" value={f.city || ""} onChange={set("city")} />
      {msg && <div style={{ color: msg.t === "error" ? "#ef4444" : "#34d399", fontSize: 12, marginBottom: 10 }}>{msg.m}</div>}
      <div style={{ display: "flex", gap: 10 }}>
        {onCancel && <button onClick={onCancel} disabled={saving} style={{ flex: 1, background: "#13131f", border: "1px solid #1e1e30", borderRadius: 8, color: "#eeeef5", padding: "9px 16px", cursor: "pointer" }}>Annuler</button>}
        <button onClick={submit} disabled={saving} style={{ flex: 1, background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Enregistrement…" : submitLabel}
        </button>
      </div>
    </div>
  );
}

function FootCreateMatchForm({ reload }) {
  return (
    <FootMatchForm
      title="Créer un match"
      submitLabel="Créer le match"
      resetOnSuccess
      onSubmit={async (data) => { await sbInsert("foot_matches", data); await reload(); }}
    />
  );
}

function FootAttendanceButtons({ myStatus, saving, onSet, compact }) {
  const base = { flex: 1, border: "1px solid #1e1e30", borderRadius: 8, padding: compact ? "7px" : "10px", cursor: "pointer", fontWeight: 700, fontSize: compact ? 12 : 13 };
  return (
    <div style={{ display: "flex", gap: compact ? 8 : 10 }}>
      <button onClick={(e) => { e.stopPropagation(); onSet("present"); }} disabled={saving} style={{ ...base, background: myStatus === "present" ? "#34d399" : "#13131f", color: myStatus === "present" ? "#080810" : "#eeeef5" }}>
        Présent
      </button>
      <button onClick={(e) => { e.stopPropagation(); onSet("absent"); }} disabled={saving} style={{ ...base, background: myStatus === "absent" ? "#ef4444" : "#13131f", color: myStatus === "absent" ? "#080810" : "#eeeef5" }}>
        Absent
      </button>
    </div>
  );
}

function FootMatchCard({ match, score, presentCount, rosterSize, onClick, isOnRoster, myStatus, onSetStatus, saving }) {
  const dt = new Date(match.match_datetime);
  const dateLabel = dt.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) + " · " + dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const statusLabel = match.status === "scheduled" ? "À venir" : match.status === "live" ? "En cours" : "Terminé";
  const statusColor = match.status === "scheduled" ? "#60607a" : match.status === "live" ? "#ef4444" : "#34d399";
  const place = formatMatchPlace(match);
  return (
    <div onClick={onClick} style={{ background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 12, padding: 16, marginBottom: 10, cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16 }}>Bière Leverculsec vs {match.opponent_name}</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 9, color: "#60607a", border: "1px solid #1e1e30", borderRadius: 4, padding: "1px 5px", textTransform: "uppercase" }}>{match.match_type === "amical" ? "Amical" : "Championnat"}</span>
          <span style={{ fontSize: 9, color: "#60607a", border: "1px solid #1e1e30", borderRadius: 4, padding: "1px 5px", textTransform: "uppercase" }}>{match.venue === "exterieur" ? "Extérieur" : "Domicile"}</span>
          <div style={{ fontSize: 10, color: statusColor, textTransform: "uppercase", fontWeight: 700 }}>{statusLabel}</div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: "#60607a", marginBottom: 4 }}>{dateLabel}</div>
      {place && <div style={{ fontSize: 12, color: "#60607a" }}>{place}</div>}
      {match.status !== "scheduled" && <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, marginTop: 6 }}>{score.bl} — {score.opponent}</div>}
      {match.status === "scheduled" && <div style={{ fontSize: 12, color: "#60607a", marginTop: 6, marginBottom: isOnRoster ? 10 : 0 }}>{presentCount}/{rosterSize} présents</div>}
      {match.status === "scheduled" && isOnRoster && (
        <FootAttendanceButtons compact myStatus={myStatus} saving={saving} onSet={onSetStatus} />
      )}
    </div>
  );
}

function FootCalendarPage({ matches, events, roster, attendance, nav, currentPlayer, reload }) {
  const [savingMatchId, setSavingMatchId] = React.useState(null);
  const presenceRoster = attendanceRoster(roster);
  const isOnRoster = presenceRoster.some((r) => r.player_id === currentPlayer?.id);

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
    return <div style={{ padding: 40, textAlign: "center", color: "#60607a" }}>Aucun match pour l'instant.</div>;
  }
  return (
    <div style={{ padding: 16 }}>
      {matches.map((match) => {
        const matchEvents = events.filter((e) => e.match_id === match.id);
        const score = computeFootScore(matchEvents);
        const matchAttendance = attendance.filter((a) => a.match_id === match.id);
        const presentCount = computeAttendanceBuckets(presenceRoster, matchAttendance).present.length;
        const myStatus = matchAttendance.find((a) => a.player_id === currentPlayer?.id)?.status || null;
        return (
          <FootMatchCard
            key={match.id}
            match={match}
            score={score}
            presentCount={presentCount}
            rosterSize={presenceRoster.length}
            onClick={() => nav("matchDetail", { matchId: match.id })}
            isOnRoster={isOnRoster}
            myStatus={myStatus}
            saving={savingMatchId === match.id}
            onSetStatus={(status) => setStatus(match.id, status)}
          />
        );
      })}
    </div>
  );
}

function FootRosterManager({ roster, reload }) {
  const [saving, setSaving] = React.useState(null); // player id currently being saved
  const [search, setSearch] = React.useState("");

  const roleByPlayer = {};
  const numberByPlayer = {};
  roster.forEach((r) => { roleByPlayer[r.player_id] = r.role; numberByPlayer[r.player_id] = r.jersey_number; });

  async function setNumber(playerId, v) {
    if (v !== "" && !/^[0-9]{1,3}$/.test(v)) { console.warn("invalid jersey number", v); await reload(); return; }
    setSaving(playerId);
    try {
      await sbUpdate("foot_roster", { player_id: playerId }, { jersey_number: v || null });
      await reload();
    } catch (e) {
      console.warn("jersey number update failed", e);
    }
    setSaving(null);
  }

  async function setRole(playerId, role) {
    setSaving(playerId);
    try {
      if (role === "") {
        await sbFetch("foot_roster", `?player_id=eq.${playerId}`, { method: "DELETE" });
      } else {
        assertUpsertOk(await SUPABASE.from("foot_roster").upsert({ player_id: playerId, role }, { onConflict: "player_id" }));
      }
      await reload();
    } catch (e) {
      console.warn("roster update failed", e);
    }
    setSaving(null);
  }

  const nameOf = (p) => getDisplayName(p, PLAYERS) || "";
  const sortedPlayers = [...PLAYERS].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const visiblePlayers = filterPlayersByName(sortedPlayers, search, nameOf);

  return (
    <div style={{ background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 12, padding: 18 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, marginBottom: 12 }}>Effectif ({roster.length})</div>
      <input style={FOOT_INPUT_STYLE} placeholder="🔍 Rechercher un joueur…" value={search} onChange={(e) => setSearch(e.target.value)} />
      {visiblePlayers.length === 0 && <div style={{ color: "#60607a", fontSize: 13, padding: "8px 0" }}>Aucun joueur ne correspond à « {search} ».</div>}
      {visiblePlayers.map((p) => (
        <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1e1e30" }}>
          <div style={{ fontSize: 13 }}>{getDisplayName(p, PLAYERS)}</div>
          <div style={{ display: "flex", alignItems: "center" }}>
          {roleByPlayer[p.id] && (
            <input key={`${p.id}-${numberByPlayer[p.id] || ""}`} defaultValue={numberByPlayer[p.id] || ""} placeholder="n°" inputMode="numeric" maxLength={3}
              onBlur={(e) => { const v = e.target.value.trim(); if (v !== (numberByPlayer[p.id] || "")) setNumber(p.id, v); }}
              style={{ width: 52, marginRight: 8, background: "#13131f", border: "1px solid #1e1e30", borderRadius: 6, color: "#eeeef5", padding: "5px 6px", fontSize: 12, textAlign: "center" }} />
          )}
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

function FootStartMatchConfig({ match, roster, attendance, lineups, reload, onCancel }) {
  const [nbHalves, setNbHalves] = React.useState(2);
  const [halfDuration, setHalfDuration] = React.useState(45);
  const [saving, setSaving] = React.useState(false);
  const presentIds = attendance.filter((a) => a.match_id === match.id && a.status === "present").map((a) => a.player_id);
  const existingSheet = lineupIdsFor(lineups || [], match.id);
  const [sheet, setSheet] = React.useState(existingSheet.length ? existingSheet : presentIds.filter((id) => roster.some((r) => r.player_id === id)));
  const toggle = (id) => setSheet(sheet.includes(id) ? sheet.filter((x) => x !== id) : [...sheet, id]);

  async function start() {
    setSaving(true);
    try {
      await saveLineup(match.id, lineupIdsFor(lineups || [], match.id), sheet);
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
        <label style={{ fontSize: 12, color: "#60607a" }}>Feuille de match ({sheet.length})</label>
        <div style={{ margin: "6px 0 18px" }}>
          <FootLineupChecklist roster={roster} extraIds={existingSheet} checked={sheet} onToggle={toggle} disabled={saving} />
        </div>
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

function FootEventEditor({ event, defaultHalf, roster, onSave, onCancel }) {
  const [type, setType] = React.useState(event?.type || "goal_bl");
  const [half, setHalf] = React.useState(String(event?.half ?? defaultHalf ?? 1));
  const [minute, setMinute] = React.useState(String(event?.minute ?? 0));
  const [playerId, setPlayerId] = React.useState(event?.player_id ? String(event.player_id) : "");
  const [assistId, setAssistId] = React.useState(event?.assist_player_id ? String(event.assist_player_id) : "");
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState(null);

  // Keep a player who has since left the roster selectable when editing their old goal.
  const rosterIds = new Set(roster.map((r) => r.player_id));
  [event?.player_id, event?.assist_player_id].forEach((id) => { if (id) rosterIds.add(id); });
  const options = PLAYERS.filter((p) => rosterIds.has(p.id));

  const selectStyle = { display: "block", width: "100%", background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 6, color: "#eeeef5", padding: "7px 10px", marginTop: 4, marginBottom: 10 };

  async function save() {
    let payload;
    try {
      payload = buildEventPayload({ type, half, minute, playerId, assistId });
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

  return (
    <div onClick={(e) => e.stopPropagation()} style={{ background: "#13131f", border: "1px solid #1e1e30", borderRadius: 8, padding: 14, margin: "6px 0" }}>
      <label style={{ fontSize: 11, color: "#60607a" }}>Type</label>
      <select value={type} onChange={(e) => setType(e.target.value)} style={selectStyle}>
        <option value="goal_bl">But Bière Leverculsec</option>
        <option value="goal_opponent">But adverse</option>
      </select>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: "#60607a" }}>Mi-temps</label>
          <input type="number" min={1} value={half} onChange={(e) => setHalf(e.target.value)} style={selectStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: "#60607a" }}>Minute</label>
          <input type="number" min={0} value={minute} onChange={(e) => setMinute(e.target.value)} style={selectStyle} />
        </div>
      </div>
      {type === "goal_bl" && (
        <>
          <label style={{ fontSize: 11, color: "#60607a" }}>Buteur</label>
          <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} style={selectStyle}>
            <option value="">— Choisir —</option>
            {options.map((p) => <option key={p.id} value={p.id}>{getDisplayName(p, PLAYERS)}</option>)}
          </select>
          <label style={{ fontSize: 11, color: "#60607a" }}>Passe décisive (optionnel)</label>
          <select value={assistId} onChange={(e) => setAssistId(e.target.value)} style={selectStyle}>
            <option value="">— Aucune —</option>
            {options.filter((p) => String(p.id) !== playerId).map((p) => <option key={p.id} value={p.id}>{getDisplayName(p, PLAYERS)}</option>)}
          </select>
        </>
      )}
      {err && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCancel} disabled={saving} style={{ flex: 1, background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 6, color: "#eeeef5", padding: "8px", cursor: "pointer" }}>Annuler</button>
        <button onClick={save} disabled={saving} style={{ flex: 1, background: "#3b82f6", color: "#fff", border: "none", borderRadius: 6, padding: "8px", fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
          {saving ? "…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

function FootEventTimeline({ events, editable, match, roster, lineups, reload }) {
  const [editingId, setEditingId] = React.useState(null); // event id, "new", or null
  const [busyId, setBusyId] = React.useState(null);
  const sorted = buildEventTimeline(events);

  async function saveEvent(eventId, payload) {
    await saveGoalWithSheet(lineupIdsFor(lineups || [], match.id), payload, {
      addToSheet: (ids) => addToLineup(match.id, ids),
      writeGoal: () => (eventId === "new"
        ? sbInsert("foot_match_events", { match_id: match.id, ...payload })
        : sbUpdate("foot_match_events", { id: eventId }, payload)),
    });
    setEditingId(null);
    await reload();
  }

  async function deleteEvent(e) {
    if (!window.confirm("Supprimer ce but ?")) return;
    setBusyId(e.id);
    try {
      await sbFetch("foot_match_events", `?id=eq.${e.id}`, { method: "DELETE" });
      await reload();
    } catch (err) {
      console.warn("delete event failed", err);
    }
    setBusyId(null);
  }

  const iconBtn = { background: "none", border: "none", cursor: "pointer", fontSize: 13, padding: "0 4px" };

  return (
    <div>
      {sorted.length === 0 && <div style={{ color: "#60607a", fontSize: 13 }}>Aucun but pour l'instant.</div>}
      {sorted.map((e) => {
        if (editingId === e.id) {
          return <FootEventEditor key={e.id} event={e} roster={roster} onSave={(p) => saveEvent(e.id, p)} onCancel={() => setEditingId(null)} />;
        }
        const scorer = e.player_id ? PLAYERS.find((p) => p.id === e.player_id) : null;
        const assist = e.assist_player_id ? PLAYERS.find((p) => p.id === e.assist_player_id) : null;
        const label = e.type === "goal_bl"
          ? `⚽ ${scorer ? getDisplayName(scorer, PLAYERS) : "?"}${assist ? " (passe D: " + getDisplayName(assist, PLAYERS) + ")" : ""}`
          : `⚽ But adverse`;
        return (
          <div key={e.id} style={{ display: "flex", gap: 10, padding: "5px 0", fontSize: 13, alignItems: "center" }}>
            <span style={{ color: "#60607a", width: 50 }}>{e.half}e · {e.minute}'</span>
            <span style={{ flex: 1 }}>{label}</span>
            {editable && (
              <span style={{ whiteSpace: "nowrap" }}>
                <button title="Modifier" onClick={() => setEditingId(e.id)} disabled={busyId === e.id} style={iconBtn}>✏️</button>
                <button title="Supprimer" onClick={() => deleteEvent(e)} disabled={busyId === e.id} style={iconBtn}>🗑️</button>
              </span>
            )}
          </div>
        );
      })}
      {editable && editingId === "new" && (
        <FootEventEditor defaultHalf={match.current_half || 1} roster={roster} onSave={(p) => saveEvent("new", p)} onCancel={() => setEditingId(null)} />
      )}
      {editable && editingId !== "new" && (
        <button onClick={() => setEditingId("new")} style={{ marginTop: 8, background: "none", border: "1px dashed #1e1e30", borderRadius: 8, color: "#60607a", padding: "7px 12px", cursor: "pointer", fontSize: 12, width: "100%" }}>
          ➕ Ajouter un but
        </button>
      )}
    </div>
  );
}

function FootGoalPicker({ roster, onConfirm, onCancel, withAssist, busy }) {
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
          onClick={() => canConfirmGoal(playerId, busy) && onConfirm(Number(playerId), assistId ? Number(assistId) : null)}
          disabled={!canConfirmGoal(playerId, busy)}
          style={{ flex: 1, background: "#3b82f6", color: "#fff", border: "none", borderRadius: 6, padding: "8px", fontWeight: 700, cursor: canConfirmGoal(playerId, busy) ? "pointer" : "default", opacity: canConfirmGoal(playerId, busy) ? 1 : 0.5 }}
        >
          Valider
        </button>
      </div>
    </div>
  );
}

function FootLiveAdminConsole({ match, roster, events, lineups, reload }) {
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
      await saveGoalWithSheet(lineupIdsFor(lineups || [], match.id), { type, player_id: playerId, assist_player_id: assistId }, {
        addToSheet: (ids) => addToLineup(match.id, ids),
        writeGoal: () => sbInsert("foot_match_events", {
          match_id: match.id,
          half: match.current_half,
          minute: minutesElapsed,
          type,
          player_id: playerId,
          assist_player_id: assistId,
        }),
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
  const liveAction = nextLiveAction(running, isLastHalf, match.half_elapsed_seconds);

  return (
    <div style={{ background: "#0d0d1c", border: "1px solid #3b82f655", borderRadius: 12, padding: 16, marginTop: 16 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 14, color: "#3b82f6" }}>CONSOLE ADMIN — Mi-temps {match.current_half}/{match.nb_halves}</div>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, margin: "8px 0" }}>{String(minutesElapsed).padStart(2, "0")}:{String(elapsedSeconds % 60).padStart(2, "0")}</div>

      {liveAction === "start" && <button onClick={startHalf} disabled={busy} style={{ width: "100%", background: "#34d399", color: "#080810", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, cursor: "pointer", marginBottom: 10 }}>▶ Démarrer la mi-temps</button>}

      {liveAction === "playing" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button onClick={() => setPicking("bl")} disabled={busy} style={{ flex: 1, background: "#13131f", border: "1px solid #1e1e30", borderRadius: 8, color: "#eeeef5", padding: "10px", cursor: "pointer" }}>⚽ But Bière Leverculsec</button>
            <button onClick={() => logGoal("goal_opponent", null, null)} disabled={busy} style={{ flex: 1, background: "#13131f", border: "1px solid #1e1e30", borderRadius: 8, color: "#eeeef5", padding: "10px", cursor: "pointer" }}>⚽ But adverse</button>
          </div>
          {picking === "bl" && (
            <FootGoalPicker roster={roster} withAssist busy={busy} onCancel={() => setPicking(null)} onConfirm={(playerId, assistId) => logGoal("goal_bl", playerId, assistId)} />
          )}
          <button onClick={endHalf} disabled={busy} style={{ width: "100%", background: "#1e1e30", color: "#eeeef5", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, cursor: "pointer", marginTop: 10 }}>
            {isLastHalf ? "🏁 Fin de la dernière mi-temps" : "⏸ Terminer la mi-temps"}
          </button>
        </>
      )}

      {liveAction === "close" && (
        <button onClick={closeMatch} disabled={busy} style={{ width: "100%", background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, cursor: "pointer" }}>🏁 Clôturer le match</button>
      )}
    </div>
  );
}

function FootMatchHeader({ match }) {
  const place = formatMatchPlace(match);
  return (
    <>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18 }}>Bière Leverculsec vs {match.opponent_name}</div>
      <div style={{ fontSize: 12, color: "#60607a", marginTop: 4 }}>{new Date(match.match_datetime).toLocaleString("fr-FR")} · {match.match_type === "amical" ? "Amical" : "Championnat"} · {match.venue === "exterieur" ? "Extérieur" : "Domicile"}</div>
      {place && <div style={{ fontSize: 12, color: "#60607a" }}>{place}</div>}
    </>
  );
}

function FootLiveView({ match, roster, events, lineups, currentPlayer, isAdmin, reload }) {
  const matchEvents = events.filter((e) => e.match_id === match.id);
  const score = computeFootScore(matchEvents);
  return (
    <div style={{ padding: 20 }}>
      <div style={{ background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 12, padding: 16 }}>
        <FootMatchHeader match={match} />
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, margin: "10px 0" }}>{score.bl} — {score.opponent}</div>
        <FootEventTimeline events={matchEvents} editable={isAdmin} match={match} roster={roster} lineups={lineups} reload={reload} />
      </div>
      {isAdmin && <FootLiveAdminConsole match={match} roster={roster} events={matchEvents} lineups={lineups} reload={reload} />}
      <FootLineupSection match={match} roster={roster} lineups={lineups} isAdmin={isAdmin} reload={reload} />
    </div>
  );
}

const FOOT_SCORE_OPTIONS = Array.from({ length: 19 }, (_, i) => 1 + i * 0.5);

function FootRatingsTab({ match, lineups, ratings, currentPlayer, isAdmin, reload }) {
  const sheetIds = lineupIdsFor(lineups, match.id);
  const mr = ratings.filter((r) => r.match_id === match.id);
  const progress = ratingProgress(sheetIds, mr);
  const averages = matchAverages(sheetIds, mr);
  const validated = !!match.ratings_validated_at;
  const me = currentPlayer?.id;
  const isVoter = sheetIds.includes(me);
  const hasVoted = progress.doneIds.includes(me);
  const mine = Object.fromEntries(mr.filter((r) => r.rater_id === me).map((r) => [r.ratee_id, String(r.score)]));
  const [editing, setEditing] = React.useState(isVoter && !hasVoted && !validated);
  const [scores, setScores] = React.useState(mine);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const nameOf = (id) => { const p = PLAYERS.find((x) => x.id === id); return p ? getDisplayName(p, PLAYERS) : "?"; };

  async function save() {
    let rows;
    try { rows = buildRatingPayload(match.id, me, sheetIds, scores); } catch (e) { setErr(e.message); return; }
    setBusy(true); setErr(null);
    try {
      const result = await submitRatings({
        sheetIds,
        isValidated: async () => !!((await sbFetch("foot_matches", `?id=eq.${match.id}&select=ratings_validated_at`)) || [])[0]?.ratings_validated_at,
        writeRatings: async () => assertUpsertOk(await SUPABASE.from("foot_ratings").upsert(rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })), { onConflict: "match_id,rater_id,ratee_id" })),
        readRatings: () => sbFetch("foot_ratings", `?match_id=eq.${match.id}&select=rater_id,ratee_id,score`),
        markValidated: () => sbUpdate("foot_matches", { id: match.id }, { ratings_validated_at: new Date().toISOString() }),
      });
      if (result === "closed") setErr("Les notes de ce match ont déjà été validées, tes notes n'ont pas été enregistrées.");
      setEditing(false);
      await reload();
    } catch (e) { setErr("Erreur: " + e.message); }
    setBusy(false);
  }

  async function forceValidate() {
    if (!window.confirm("Valider les notes maintenant avec les votes déjà faits ?")) return;
    setBusy(true);
    try { await sbUpdate("foot_matches", { id: match.id }, { ratings_validated_at: new Date().toISOString() }); await reload(); }
    catch (e) { setErr("Erreur: " + e.message); }
    setBusy(false);
  }

  const card = { background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 12, padding: 16 };
  if (sheetIds.length < 2) return <div style={card}><div style={{ color: "#60607a", fontSize: 13 }}>Pas assez de joueurs sur la feuille de match pour noter.</div></div>;

  const view = ratingsTabView({ validated, isVoter, hasVoted, editing, isAdmin });
  const ranked = sheetIds.map((id) => ({ id, avg: averages[id] })).sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 15 }}>Notes du match</div>
        <div style={{ fontSize: 11, color: validated ? "#34d399" : "#60607a", fontWeight: 700 }}>{validated ? "✓ Notes validées" : `${progress.doneIds.length} / ${sheetIds.length} ont voté`}</div>
      </div>

      {view.showForm && (
        <div style={{ marginBottom: 14 }}>
          {sheetIds.filter((id) => id !== me).map((id) => (
            <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #1e1e30" }}>
              <span style={{ fontSize: 13 }}>{nameOf(id)}</span>
              <select value={scores[id] ?? ""} disabled={busy} onChange={(e) => setScores({ ...scores, [id]: e.target.value })} style={{ background: "#13131f", border: "1px solid #1e1e30", borderRadius: 6, color: "#eeeef5", padding: "5px 8px" }}>
                <option value="">—</option>
                {FOOT_SCORE_OPTIONS.map((s) => <option key={s} value={String(s)}>{s.toFixed(1)}</option>)}
              </select>
            </div>
          ))}
          <button onClick={save} disabled={busy} style={{ width: "100%", marginTop: 10, background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "…" : "Enregistrer mes notes"}</button>
        </div>
      )}

      {err && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>{err}</div>}

      {view.showEditButton && (
        <button onClick={() => { setScores(mine); setErr(null); setEditing(true); }} style={{ background: "none", border: "1px solid #1e1e30", borderRadius: 6, color: "#eeeef5", padding: "4px 10px", cursor: "pointer", fontSize: 12, marginBottom: 10 }}>✏️ {view.editLabel}</button>
      )}

      {view.showAverages && ranked.map(({ id, avg }) => (
        <div key={id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13 }}>
          <span>{nameOf(id)}</span>
          <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18 }}>{avg == null ? "—" : avg.toFixed(1)}</span>
        </div>
      ))}
      {view.showHiddenMessage && <div style={{ fontSize: 12, color: "#60607a" }}>Les moyennes seront visibles après validation.</div>}

      {!validated && progress.pendingIds.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: "#60607a" }}>Pas encore voté : {progress.pendingIds.map(nameOf).join(" · ")}</div>
      )}

      {isAdmin && !validated && (
        <button onClick={forceValidate} disabled={busy} style={{ width: "100%", marginTop: 12, background: "#13131f", border: "1px solid #1e1e30", borderRadius: 8, color: "#eeeef5", padding: "8px", cursor: "pointer", fontSize: 12 }}>Valider les notes maintenant</button>
      )}
    </div>
  );
}

function FootFinishedView({ match, roster, events, lineups, ratings, currentPlayer, isAdmin, reload }) {
  const [tab, setTab] = React.useState("resume");
  const matchEvents = events.filter((e) => e.match_id === match.id);
  const score = computeFootScore(matchEvents);
  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {[["resume", "Résumé"], ["notes", "Notes du match"]].map(([id, l]) => (
          <button key={id} onClick={() => setTab(id)} style={{ flex: 1, background: tab === id ? "#3b82f6" : "#13131f", color: tab === id ? "#fff" : "#60607a", border: "1px solid #1e1e30", borderRadius: 8, padding: "8px", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>{l}</button>
        ))}
      </div>
      {tab === "resume" && (
        <>
          <div style={{ background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 12, padding: 16 }}>
            <FootMatchHeader match={match} />
            <div style={{ fontSize: 10, color: "#34d399", textTransform: "uppercase", fontWeight: 700, marginTop: 4 }}>Terminé</div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, margin: "10px 0" }}>{score.bl} — {score.opponent}</div>
            <FootEventTimeline events={matchEvents} editable={isAdmin} match={match} roster={roster} lineups={lineups} reload={reload} />
          </div>
          <FootLineupSection match={match} roster={roster} lineups={lineups} isAdmin={isAdmin} reload={reload} />
        </>
      )}
      {tab === "notes" && <FootRatingsTab match={match} lineups={lineups} ratings={ratings || []} currentPlayer={currentPlayer} isAdmin={isAdmin} reload={reload} />}
    </div>
  );
}

function FootScheduledView({ match, roster, attendance, lineups, currentPlayer, isAdmin, reload, onStartMatch }) {
  const matchAttendance = attendance.filter((a) => a.match_id === match.id);
  const presenceRoster = attendanceRoster(roster);
  const buckets = computeAttendanceBuckets(presenceRoster, matchAttendance);
  const isOnRoster = presenceRoster.some((r) => r.player_id === currentPlayer?.id);
  const myStatus = matchAttendance.find((a) => a.player_id === currentPlayer?.id)?.status || null;
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
    const p = PLAYERS.find((pl) => pl.id === playerId);
    return p ? getDisplayName(p, PLAYERS) : "?";
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <FootMatchHeader match={match} />
      </div>

      {isOnRoster && (
        <div style={{ marginBottom: 16 }}>
          <FootAttendanceButtons myStatus={myStatus} saving={saving} onSet={setMyStatus} />
        </div>
      )}

      {presenceRoster.length === 0 ? (
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

      <FootLineupSection match={match} roster={roster} lineups={lineups || []} isAdmin={isAdmin} reload={reload} />

      {isAdmin && (
        <button onClick={onStartMatch} style={{ marginTop: 16, width: "100%", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontWeight: 700, cursor: "pointer" }}>
          COMMENCER LE MATCH
        </button>
      )}
    </div>
  );
}

function FootMatchDetailPage({ matchId, matches, roster, attendance, events, lineups, ratings, currentPlayer, isAdmin, navBack, reload }) {
  const match = matches.find((m) => m.id === matchId);
  const [startingConfig, setStartingConfig] = React.useState(false);
  const [editingInfo, setEditingInfo] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  if (!match) return <div style={{ padding: 20, color: "#60607a" }}>Match introuvable.</div>;

  async function deleteMatch() {
    if (!window.confirm(`Supprimer définitivement le match contre ${match.opponent_name} ? Les buts et présences associés seront aussi supprimés.`)) return;
    setDeleting(true);
    try {
      await sbFetch("foot_matches", `?id=eq.${match.id}`, { method: "DELETE" });
      await reload();
      navBack();
    } catch (e) {
      console.warn("delete match failed", e);
      setDeleting(false);
    }
  }

  const topBtn = { background: "none", border: "1px solid #1e1e30", borderRadius: 8, color: "#eeeef5", padding: "6px 12px", cursor: "pointer", fontSize: 12 };

  return (
    <div>
      <div style={{ padding: "12px 20px 0", display: "flex", gap: 8 }}>
        <button onClick={navBack} style={topBtn}>← Retour</button>
        {isAdmin && (
          <>
            <span style={{ flex: 1 }} />
            <button onClick={() => setEditingInfo(!editingInfo)} disabled={deleting} style={topBtn}>✏️ Modifier</button>
            <button onClick={deleteMatch} disabled={deleting} style={{ ...topBtn, color: "#ef4444", borderColor: "#ef444455" }}>{deleting ? "…" : "🗑️ Supprimer"}</button>
          </>
        )}
      </div>
      {isAdmin && editingInfo && (
        <div style={{ padding: "12px 20px 0" }}>
          <FootMatchForm
            title="Modifier le match"
            submitLabel="Enregistrer"
            initial={match}
            onCancel={() => setEditingInfo(false)}
            onSubmit={async (data) => { await sbUpdate("foot_matches", { id: match.id }, data); await reload(); setEditingInfo(false); }}
          />
        </div>
      )}
      {match.status === "scheduled" && !startingConfig && (
        <FootScheduledView match={match} roster={roster} attendance={attendance} lineups={lineups} currentPlayer={currentPlayer} isAdmin={isAdmin} reload={reload} onStartMatch={() => setStartingConfig(true)} />
      )}
      {match.status === "scheduled" && startingConfig && (
        <FootStartMatchConfig match={match} roster={roster} attendance={attendance} lineups={lineups} reload={reload} onCancel={() => setStartingConfig(false)} />
      )}
      {match.status === "live" && (
        <FootLiveView match={match} roster={roster} events={events} lineups={lineups} currentPlayer={currentPlayer} isAdmin={isAdmin} reload={reload} />
      )}
      {match.status === "finished" && (
        <FootFinishedView match={match} roster={roster} events={events} lineups={lineups} ratings={ratings} currentPlayer={currentPlayer} isAdmin={isAdmin} reload={reload} />
      )}
    </div>
  );
}

const FOOT_STAT_COLUMNS = [
  { key: "played", label: "MJ", title: "Joués" },
  { key: "wins", label: "V", title: "Victoires" },
  { key: "draws", label: "N", title: "Nuls" },
  { key: "losses", label: "D", title: "Défaites" },
  { key: "goals", label: "Buts", title: "Buts" },
  { key: "assists", label: "PD", title: "Passes D" },
  { key: "decisive", label: "Déc.", title: "Décisifs" },
  { key: "rating", label: "Note", title: "Note" },
];

const FOOT_SELECT_STYLE = { background: "#13131f", border: "1px solid #1e1e30", borderRadius: 8, color: "#eeeef5", padding: "6px 10px", fontSize: 12 };

function readPref(key, fallback, allowed) {
  try { const v = localStorage.getItem(key); return v && (!allowed || allowed.includes(v)) ? v : fallback; } catch (e) { return fallback; }
}

function writePref(key, value) {
  try { localStorage.setItem(key, value); } catch (e) {}
}

function FootStatTile({ title, value, rank }) {
  return (
    <div style={{ flex: "1 1 70px", background: "#13131f", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 10, color: "#60607a", textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</div>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 10, color: "#3b82f6" }}>{rank}</div>
    </div>
  );
}

function FootRatingChart({ series }) {
  const [hover, setHover] = React.useState(null);
  if (series.length < 2) return <div style={{ color: "#60607a", fontSize: 13 }}>Il faut au moins 2 matchs notés pour afficher l'évolution.</div>;
  const W = 320, H = 150, L = 32, R = 12, T = 12, B = 12;
  const x = (i) => L + (i * (W - L - R)) / (series.length - 1);
  const y = (v) => T + ((10 - v) * (H - T - B)) / 9;
  const pts = series.map((s, i) => `${x(i)},${y(s.rating)}`).join(" ");
  const label = series.map((s) => `${s.opponent} ${s.rating.toFixed(1)}`).join(", ");
  const h = hover != null ? series[hover] : null;
  return (
    <div>
      <div style={{ minHeight: 18, textAlign: "center", fontSize: 12, color: "#eeeef5" }}>
        {h ? <>vs {h.opponent} · <b>{h.rating.toFixed(1)}</b> · {new Date(h.date).toLocaleDateString("fr-FR")}</> : <span style={{ color: "#60607a" }}>Touche un point pour le détail</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label={`Notes des derniers matchs : ${label}`}>
        {[2, 4, 6, 8, 10].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#1e1e30" strokeWidth="1" />
            <text x={L - 10} y={y(v) + 3.5} fontSize="10" fill="#60607a" textAnchor="end">{v}</text>
          </g>
        ))}
        {h && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="#60607a" strokeWidth="1" strokeDasharray="2 2" />}
        <polyline points={pts} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {series.map((s, i) => (
          <g key={s.matchId} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(hover === i ? null : i)} style={{ cursor: "pointer" }}>
            <circle cx={x(i)} cy={y(s.rating)} r="12" fill="transparent" />
            <circle cx={x(i)} cy={y(s.rating)} r={hover === i ? 5 : 4} fill="#3b82f6" stroke="#0d0d1c" strokeWidth="2" />
            <title>{`${s.opponent} : ${s.rating.toFixed(1)}`}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}

function FootStatsPage({ matches, lineups, events, ratings, roster, currentPlayer }) {
  const currentSeason = seasonOf(new Date().toISOString());
  const [mode, setModeState] = React.useState(() => readPref("foot_stats_mode", "abs", ["abs", "pct"]));
  const [season, setSeasonState] = React.useState(() => readPref("foot_stats_season", currentSeason));
  const [type, setTypeState] = React.useState(() => readPref("foot_stats_type", "all", ["all", "amical", "championnat"]));
  const [sortKey, setSortKey] = React.useState("played");
  const [sortDir, setSortDir] = React.useState(-1);
  const setMode = (v) => { setModeState(v); writePref("foot_stats_mode", v); };
  const setSeason = (v) => { setSeasonState(v); writePref("foot_stats_season", v); };
  const setType = (v) => { setTypeState(v); writePref("foot_stats_type", v); };

  const seasonOptions = [...new Set([currentSeason, ...seasonsFromMatches(matches), ...(season !== "all" ? [season] : [])])].sort().reverse();
  const filtered = filterMatchesForStats(matches, { season, type });
  const population = statsRoster(roster);
  const ratingBy = Object.fromEntries(population.map((id) => [id, averageRating(playerRatingSeries(filtered, ratings, lineups, id))]));
  const rows = buildStatsRows(population, computePlayerStats(filtered, lineups, events), ratingBy);
  const pool = rows.filter((r) => r.played > 0);
  const ratingPool = rows.filter((r) => r.rating != null);
  const ranks = Object.fromEntries(FOOT_STAT_COLUMNS.map((c) => [c.key, rankPlayers(c.key === "rating" ? ratingPool : pool, c.key, mode)]));
  const me = rows.find((r) => r.playerId === currentPlayer?.id);
  const series = currentPlayer ? playerRatingSeries(filtered, ratings, lineups, currentPlayer.id).slice(-10) : [];
  const nameOf = (id) => { const p = PLAYERS.find((x) => x.id === id); return p ? getDisplayName(p, PLAYERS) : "?"; };

  function tilesFor(keys) {
    return keys.map((k) => {
      const col = FOOT_STAT_COLUMNS.find((c) => c.key === k);
      const value = me ? formatStatValue(statValue(me, k, mode), k, mode) : "—";
      const rank = me && ranks[k][me.playerId] ? formatRank(ranks[k][me.playerId]) : "—";
      return <FootStatTile key={k} title={col.title} value={value} rank={rank} />;
    });
  }

  function clickHeader(key) {
    if (key === sortKey) setSortDir(-sortDir); else { setSortKey(key); setSortDir(-1); }
  }

  const sorted = sortStatsRows(rows, sortKey, sortDir, mode, nameOf);
  const card = { background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 12, padding: 16, marginBottom: 14 };
  const toggleBtn = (m, label) => (
    <button onClick={() => setMode(m)} style={{ background: mode === m ? "#3b82f6" : "#13131f", color: mode === m ? "#fff" : "#60607a", border: "1px solid #1e1e30", padding: "6px 14px", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>{label}</button>
  );
  const grid = "minmax(110px,1fr) repeat(8, 52px)";

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={season} onChange={(e) => setSeason(e.target.value)} style={FOOT_SELECT_STYLE}>
            {seasonOptions.map((s) => <option key={s} value={s}>Saison {s}</option>)}
            <option value="all">Toutes les saisons</option>
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} style={FOOT_SELECT_STYLE}>
            <option value="all">Tous les matchs</option>
            <option value="championnat">Championnat</option>
            <option value="amical">Amical</option>
          </select>
        </div>
        <div style={{ display: "flex", borderRadius: 8, overflow: "hidden" }}>{toggleBtn("abs", "Valeurs")}{toggleBtn("pct", "%")}</div>
      </div>

      {!me && <div style={{ color: "#60607a", fontSize: 13, marginBottom: 10 }}>Les statistiques concernent l'effectif régulier et occasionnel.</div>}
      {me && me.played === 0 && <div style={{ color: "#60607a", fontSize: 13, marginBottom: 10 }}>Pas encore de match terminé sur une feuille de match.</div>}

      <div style={card}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 15, marginBottom: 10 }}>Mes matchs</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{tilesFor(["played", "wins", "draws", "losses", "rating"])}</div>
      </div>
      <div style={card}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 15, marginBottom: 10 }}>Mes stats offensives</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{tilesFor(["goals", "assists", "decisive"])}</div>
      </div>
      <div style={card}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 15, marginBottom: 6 }}>Mon évolution</div>
        <FootRatingChart series={series} />
      </div>

      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        <div style={{ minWidth: 600 }}>
          <div style={{ display: "grid", gridTemplateColumns: grid, gap: 4, padding: "9px 14px", background: "#13131f", borderBottom: "1px solid #1e1e30", fontSize: 10, color: "#60607a", textTransform: "uppercase" }}>
            <span>Joueur</span>
            {FOOT_STAT_COLUMNS.map((c) => (
              <span key={c.key} onClick={() => clickHeader(c.key)} style={{ textAlign: "center", cursor: "pointer", userSelect: "none", color: sortKey === c.key ? "#3b82f6" : "#60607a" }}>
                {c.label}{sortKey === c.key ? (sortDir === -1 ? " ▼" : " ▲") : ""}
              </span>
            ))}
          </div>
          {sorted.length === 0 && <div style={{ padding: 16, color: "#60607a", fontSize: 13 }}>Aucun joueur régulier ou occasionnel dans l'effectif.</div>}
          {sorted.map((s) => (
            <div key={s.playerId} style={{ display: "grid", gridTemplateColumns: grid, gap: 4, padding: "9px 14px", borderBottom: "1px solid #1e1e30", fontSize: 13, alignItems: "center", background: s.playerId === currentPlayer?.id ? "#3b82f61a" : "transparent" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nameOf(s.playerId)}</span>
              {FOOT_STAT_COLUMNS.map((c) => <span key={c.key} style={{ textAlign: "center" }}>{formatStatValue(statValue(s, c.key, mode), c.key, mode)}</span>)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


const INSTA_KEY_STORAGE = "foot_insta_admin_key";
function readInstaKey() { try { return localStorage.getItem(INSTA_KEY_STORAGE) || ""; } catch (e) { return ""; } }
async function instaAdminFetch(path, body) {
  const r = await fetch(`/api/insta/${path}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Insta-Admin-Key": readInstaKey() }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Erreur ${r.status}`);
  return data;
}
function instaPublicUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/player-photos/${path.split("/").map(encodeURIComponent).join("/")}`;
}

const INSTA_KINDS = [["render", "Render"], ["celebration", "Célébr."], ["dos", "Dos"]];
const INSTA_KITS = [["domicile", "Domicile"], ["exterieur", "Extérieur"]];
const INSTA_MAX_SIDE = 1600;

// Reads an image file; downsizes it so the longer side is at most INSTA_MAX_SIDE (PNG keeps transparency).
function prepareInstaPhoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, INSTA_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const width = Math.round(img.naturalWidth * scale), height = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => (blob ? resolve({ blob, width, height }) : reject(new Error("Conversion de l'image impossible"))), "image/png");
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image illisible")); };
    img.src = url;
  });
}

function FootPhotoCell({ playerId, kit, kind, photos, reload }) {
  const mine = photos.filter((p) => p.player_id === playerId && p.kit === kit && p.kind === kind);
  const shown = mine.find((p) => p.retouched) || mine[0] || null;
  const [retouched, setRetouched] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const inputRef = React.useRef(null);

  async function onFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true); setErr(null);
    try {
      const { blob, width, height } = await prepareInstaPhoto(file);
      const { uploadUrl, path } = await instaAdminFetch("photo-sign", { player_id: playerId, kit, kind, retouched });
      const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "image/png", "x-upsert": "true" }, body: blob });
      if (!put.ok) throw new Error(`Envoi refusé (${put.status})`);
      await instaAdminFetch("photo-register", { player_id: playerId, kit, kind, retouched, path, width, height });
      await reload();
    } catch (ex) { setErr(ex.message); }
    setBusy(false);
  }

  async function remove() {
    if (!shown || !window.confirm("Supprimer cette photo ?")) return;
    setBusy(true); setErr(null);
    try { await instaAdminFetch("photo-delete", { id: shown.id }); await reload(); }
    catch (ex) { setErr(ex.message); }
    setBusy(false);
  }

  const mini = { background: "#13131f", border: "1px solid #1e1e30", borderRadius: 6, color: "#eeeef5", padding: "3px 6px", fontSize: 11, cursor: busy ? "default" : "pointer" };
  return (
    <div style={{ background: "#13131f", borderRadius: 8, padding: 6, textAlign: "center" }}>
      <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
        {shown ? <img src={instaPublicUrl(shown.path)} alt="" style={{ maxHeight: 64, maxWidth: "100%", objectFit: "contain" }} /> : <span style={{ color: "#60607a", fontSize: 11 }}>—</span>}
      </div>
      {shown && <div style={{ fontSize: 9, color: shown.retouched ? "#34d399" : "#60607a", textTransform: "uppercase", marginBottom: 4 }}>{shown.retouched ? "retouchée" : "brute"}</div>}
      <input ref={inputRef} type="file" accept="image/png" onChange={onFile} style={{ display: "none" }} />
      <div style={{ display: "flex", gap: 4, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
        <button disabled={busy} onClick={() => inputRef.current && inputRef.current.click()} style={mini}>{busy ? "…" : "⬆ Envoyer"}</button>
        {shown && <button disabled={busy} onClick={remove} style={{ ...mini, color: "#ef4444" }}>🗑</button>}
      </div>
      <label style={{ display: "block", fontSize: 10, color: "#60607a", marginTop: 4 }}>
        <input type="checkbox" checked={retouched} onChange={(e) => setRetouched(e.target.checked)} /> retouchée
      </label>
      {err && <div style={{ color: "#ef4444", fontSize: 10, marginTop: 4 }}>{err}</div>}
    </div>
  );
}

function FootPhotosTab({ roster, photos, reload }) {
  const nameOf = (p) => getDisplayName(p, PLAYERS) || "";
  const players = roster.map((r) => PLAYERS.find((p) => p.id === r.player_id)).filter(Boolean).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  if (!players.length) return <div style={{ color: "#60607a", fontSize: 13 }}>Aucun joueur dans l'effectif.</div>;
  return (
    <div>
      {players.map((p) => (
        <div key={p.id} style={{ background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 12, padding: 12, marginBottom: 10 }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 15, marginBottom: 8 }}>{nameOf(p)}</div>
          <div style={{ display: "grid", gridTemplateColumns: "52px minmax(0, 1fr) minmax(0, 1fr)", gap: 6, alignItems: "center" }}>
            <span />
            {INSTA_KITS.map(([kit, label]) => <div key={kit} style={{ fontSize: 10, color: "#60607a", textTransform: "uppercase", textAlign: "center" }}>{label}</div>)}
            {INSTA_KINDS.map(([kind, kindLabel]) => (
              <React.Fragment key={kind}>
                <div style={{ fontSize: 10, color: "#60607a", textTransform: "uppercase" }}>{kindLabel}</div>
                {INSTA_KITS.map(([kit]) => <FootPhotoCell key={kit} playerId={p.id} kit={kit} kind={kind} photos={photos} reload={reload} />)}
              </React.Fragment>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Overlay boxes (canvas px) showing what covers the photo in each layout.
// They mirror lib/insta/templates.js — keep them in sync when a template moves.
const FRAMING_GUIDES = {
  matchday: [
    { label: "MATCH DAY", x: 0, y: 0, w: 1080, h: 180, font: 158, behind: true }, // title: drawn behind the player, like the render
    { label: "vs ADVERSAIRE", x: 360, y: 180, w: 720, h: 120 },
    { label: "bandeau", x: 44, y: 1260, w: 992, h: 68 },
    // Résultat uses the very same placement: its score and goals card also sit over the player
    { label: "Résultat : score", x: 400, y: 225, w: 680, h: 300 },
    { label: "Résultat : buts", x: 395, y: 625, w: 505, h: 394 },
  ],
  groupe: [
    { label: "GROUPE", x: 0, y: 0, w: 1080, h: 254, font: 234, behind: true }, // title: drawn behind the player
    { label: "liste (10 joueurs)", x: 608, y: 300, w: 412, h: 960 },
  ],
  render: [],
  podium_dos: [{ label: "n°", x: 0, y: 0, w: 78, h: 74 }, { label: "nom + valeur", x: 10, y: 384, w: 310, h: 46 }],
  podium_celebration: [{ label: "n°", x: 0, y: 0, w: 78, h: 74 }, { label: "nom + valeur", x: 10, y: 384, w: 310, h: 46 }],
  podium_render: [{ label: "n°", x: 0, y: 0, w: 78, h: 74 }, { label: "nom + valeur", x: 10, y: 384, w: 310, h: 46 }],
};
const FRAMING_LAYOUT_LABELS = [
  ["matchday", "Match Day + Résultat"], ["groupe", "Groupe"], ["render", "Render (rond)"],
  ["podium_celebration", "Podium · Buts"], ["podium_dos", "Podium · Passe D / Notes"], ["podium_render", "Podium · Moyennes"],
];

// One layout guide. `behind` guides (a title the player stands in front of) are drawn as plain text; the others as dashed boxes over the photo.
function FootGuideBox({ g, scale, text }) {
  const pos = { position: "absolute", left: g.x * scale, top: g.y * scale, width: g.w * scale, height: g.h * scale, pointerEvents: "none" };
  if (g.behind) {
    return text ? <div style={{ ...pos, fontFamily: "'Shrikhand',cursive", fontSize: g.font * scale, lineHeight: 1.2, display: "flex", justifyContent: "center", whiteSpace: "nowrap", color: "#fff", textShadow: `${4 * scale}px ${7 * scale}px ${8 * scale}px rgba(0,0,0,0.28)` }}>{g.label}</div> : null;
  }
  return (
    <div style={{ ...pos, background: "rgba(255,255,255,0.28)", border: "1px dashed rgba(255,255,255,0.8)", color: "#fff", fontFamily: g.font ? "'Shrikhand',cursive" : "'Outfit',sans-serif", fontSize: text ? (g.font ? g.font * scale : 11) : 0, lineHeight: 1.1, display: "flex", alignItems: g.font ? "flex-start" : "center", justifyContent: "center", whiteSpace: "nowrap", overflow: "hidden", textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>{text ? g.label : null}</div>
  );
}

// Every player's photo for one kit + layout, framed as saved (or by default), to compare them side by side.
function FootFramingCompare({ players, photos, framings, kit, layout, showGuides, onPick }) {
  const [cw, ch] = LAYOUTS[layout].canvas;
  const W = 150, scale = W / cw;
  const isMask = layout === "render" || layout.startsWith("podium_");
  const kind = PHOTO_KIND_FOR_LAYOUT[layout];
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, ${W}px)`, gap: 12, justifyContent: "center" }}>
      {players.map((p) => {
        const photo = choosePhoto(photos, p.id, kind, kit);
        const saved = photo ? savedFraming(framings, photo.id, layout) : null;
        const rect = photo ? framedRect(layout, photo, saved) : null;
        return (
          <div key={p.id} style={{ width: W }}>
            <div
              onClick={() => onPick(p.id)}
              style={{ position: "relative", width: W, height: ch * scale, overflow: "hidden", cursor: "pointer", borderRadius: layout === "render" ? "50%" : isMask ? 40 * scale : 0, background: isMask ? "#ffffff" : "#222", border: "1px solid #1e1e30", boxSizing: "border-box" }}
            >
              {!isMask && <img src={`/assets/insta/bg-${photo ? photo.kit : kit}.jpg`} alt="" draggable={false} style={{ position: "absolute", left: 0, top: 0, width: W, height: ch * scale }} />}
              {showGuides && (FRAMING_GUIDES[layout] || []).filter((g) => g.behind).map((g) => <FootGuideBox key={g.label} g={g} scale={scale} text />)}
              {photo && rect && <img src={instaPublicUrl(photo.path)} alt="" draggable={false} style={{ position: "absolute", left: rect.x * scale, top: rect.y * scale, width: rect.width * scale, height: rect.height * scale }} />}
              {!photo && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#60607a", fontSize: 11, textAlign: "center", padding: 8 }}>Pas de photo</div>}
              {showGuides && (FRAMING_GUIDES[layout] || []).filter((g) => !g.behind).map((g) => <FootGuideBox key={g.label} g={g} scale={scale} />)}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, gap: 4 }}>
              <span style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{getDisplayName(p, PLAYERS)}</span>
              {photo && <span style={{ fontSize: 9, color: saved ? "#34d399" : "#60607a", textTransform: "uppercase", flexShrink: 0 }}>{saved ? "réglé" : "défaut"}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FootFramingTool({ roster, photos, framings, reload }) {
  const nameOf = (p) => getDisplayName(p, PLAYERS) || "";
  const players = [...new Set(photos.map((p) => p.player_id))].map((id) => PLAYERS.find((p) => p.id === id)).filter((p) => p && roster.some((r) => r.player_id === p.id)).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const [playerId, setPlayerId] = React.useState(null);
  const [kit, setKit] = React.useState("domicile");
  const [layout, setLayout] = React.useState("matchday");
  const [mode, setMode] = React.useState("single");
  const [showGuides, setShowGuides] = React.useState(true);
  const pid = players.some((p) => p.id === playerId) ? playerId : (players[0] && players[0].id) || null;
  const photo = pid ? choosePhoto(photos, pid, PHOTO_KIND_FOR_LAYOUT[layout], kit) : null;
  const saved = photo ? savedFraming(framings, photo.id, layout) : null;
  const L = LAYOUTS[layout];
  const [cw, ch] = L.canvas;

  const boxRef = React.useRef(null);
  const [boxW, setBoxW] = React.useState(340);
  React.useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => { const w = el.parentElement ? el.parentElement.clientWidth : 0; if (w) setBoxW(Math.min(w, ch > cw ? 420 : 520)); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [layout, photo && photo.id]);
  const scale = boxW / cw;

  const [fr, setFr] = React.useState(null);
  const [msg, setMsg] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [serverPreview, setServerPreview] = React.useState(null);
  const frKey = photo ? `${photo.id}:${layout}:${saved ? `${saved.x},${saved.y},${saved.width}` : "-"}` : "none";
  React.useEffect(() => {
    setMsg(null); setServerPreview(null);
    setFr(photo ? (saved ? { x: saved.x, y: saved.y, width: saved.width } : defaultFraming(layout, photo)) : null);
  }, [frKey]);

  const ref = photo ? defaultFraming(layout, photo).width : 1;
  const rect = photo && fr ? framedRect(layout, photo, fr) : null;
  const frRef = React.useRef(fr); frRef.current = fr;

  // Pointer interactions: one pointer drags, two pointers pinch.
  const ptrs = React.useRef(new Map());
  const last = React.useRef(null);
  const toCanvas = (e) => { const r = boxRef.current.getBoundingClientRect(); return { px: (e.clientX - r.left) / scale, py: (e.clientY - r.top) / scale }; };
  function onDown(e) {
    if (!fr) return;
    boxRef.current.setPointerCapture && boxRef.current.setPointerCapture(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    last.current = null;
  }
  function onMove(e) {
    if (!ptrs.current.has(e.pointerId) || !frRef.current) return;
    const prev = ptrs.current.get(e.pointerId);
    const cur = { x: e.clientX, y: e.clientY };
    if (ptrs.current.size === 1) {
      const f = frRef.current;
      setFr({ ...f, x: f.x + (cur.x - prev.x) / scale, y: f.y + (cur.y - prev.y) / scale });
      ptrs.current.set(e.pointerId, cur);
    } else if (ptrs.current.size === 2) {
      const other = [...ptrs.current.entries()].find(([id]) => id !== e.pointerId)[1];
      const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      const d0 = dist(prev, other), d1 = dist(cur, other);
      ptrs.current.set(e.pointerId, cur);
      if (d0 > 0 && d1 > 0) {
        const r = boxRef.current.getBoundingClientRect();
        const mx = ((cur.x + other.x) / 2 - r.left) / scale, my = ((cur.y + other.y) / 2 - r.top) / scale;
        setFr(zoomFramingAt(frRef.current, d1 / d0, mx, my, ref));
      }
    }
  }
  function onUp(e) { ptrs.current.delete(e.pointerId); }
  function onWheel(e) {
    if (!fr) return;
    const { px, py } = toCanvas(e);
    setFr(zoomFramingAt(fr, Math.exp(-e.deltaY * 0.0015), px, py, ref));
  }
  // React attaches wheel listeners as passive: add a native one so the page doesn't scroll while zooming.
  const wheelRef = React.useRef(); wheelRef.current = onWheel;
  React.useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const fn = (e) => { e.preventDefault(); wheelRef.current(e); };
    el.addEventListener("wheel", fn, { passive: false });
    return () => el.removeEventListener("wheel", fn);
  }, [layout, photo && photo.id, boxW]);

  const pct = fr ? framingZoomPercent(fr, ref) : 100;
  function onSlider(e) {
    const target = Number(e.target.value) / 100;
    setFr(zoomFramingAt(fr, (ref * target) / fr.width, cw / 2, ch / 2, ref));
  }

  async function save() {
    setSaving(true); setMsg(null);
    try {
      assertUpsertOk(await SUPABASE.from("foot_photo_framings").upsert(
        { photo_id: photo.id, layout: framingLayout(layout), x: fr.x, y: fr.y, width: fr.width, updated_at: new Date().toISOString() },
        { onConflict: "photo_id,layout" }
      ));
      await reload();
      setMsg({ t: "success", m: "Cadrage enregistré ✓" });
    } catch (e) { setMsg({ t: "error", m: "Erreur: " + e.message }); }
    setSaving(false);
  }
  function previewServer() {
    const q = new URLSearchParams({ kind: "frame", photo: String(photo.id), layout, x: String(Math.round(fr.x * 10) / 10), y: String(Math.round(fr.y * 10) / 10), w: String(Math.round(fr.width * 10) / 10), t: String(Date.now()) });
    setServerPreview(`/api/insta/render?${q}`);
  }

  const sel = { ...FOOT_SELECT_STYLE, width: "100%", marginBottom: 8 };
  const btn = (primary) => ({ flex: 1, background: primary ? "#3b82f6" : "#13131f", color: primary ? "#fff" : "#eeeef5", border: primary ? "none" : "1px solid #1e1e30", borderRadius: 8, padding: "9px 6px", fontWeight: 700, fontSize: 12, cursor: "pointer" });
  const isMask = layout === "render" || layout.startsWith("podium_");

  if (!players.length) return <div style={{ color: "#60607a", fontSize: 13 }}>Importez d'abord des photos (onglet Photos).</div>;
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button style={{ ...btn(mode === "single"), padding: "7px 6px" }} onClick={() => setMode("single")}>Un joueur</button>
        <button style={{ ...btn(mode === "compare"), padding: "7px 6px" }} onClick={() => setMode("compare")}>Comparer tous</button>
      </div>
      {mode === "single" && (
      <select style={sel} value={pid || ""} onChange={(e) => setPlayerId(Number(e.target.value))}>
        {players.map((p) => <option key={p.id} value={p.id}>{nameOf(p)}</option>)}
      </select>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <select style={sel} value={kit} onChange={(e) => setKit(e.target.value)}>
          {INSTA_KITS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select style={sel} value={layout} onChange={(e) => setLayout(e.target.value)}>
          {FRAMING_LAYOUT_LABELS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      {mode === "compare" && (
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#60607a", marginBottom: 10 }}>
            <input type="checkbox" checked={showGuides} onChange={(e) => setShowGuides(e.target.checked)} /> Afficher les repères (zones couvertes par le texte)
          </label>
          <FootFramingCompare players={players} photos={photos} framings={framings} kit={kit} layout={layout} showGuides={showGuides} onPick={(id) => { setPlayerId(id); setMode("single"); }} />
          <div style={{ fontSize: 11, color: "#60607a", textAlign: "center", marginTop: 12 }}>Touche un joueur pour ajuster son cadrage.</div>
        </div>
      )}
      {mode === "single" && !photo && <div style={{ color: "#60607a", fontSize: 13, padding: "12px 0" }}>Aucune photo pour cet emplacement.</div>}
      <div style={{ display: mode === "single" && photo ? "block" : "none" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div
            ref={boxRef}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
            style={{ position: "relative", width: boxW, height: ch * scale, overflow: "hidden", touchAction: "none", cursor: "grab", userSelect: "none", borderRadius: layout === "render" ? "50%" : isMask ? 40 * scale : 0, background: isMask ? "#ffffff" : "#222" }}
          >
            {!isMask && <img src={`/assets/insta/bg-${photo ? photo.kit : kit}.jpg`} alt="" draggable={false} style={{ position: "absolute", left: 0, top: 0, width: cw * scale, height: ch * scale }} />}
            {(FRAMING_GUIDES[layout] || []).filter((g) => g.behind).map((g) => <FootGuideBox key={g.label} g={g} scale={scale} text />)}
            {photo && rect && <img src={instaPublicUrl(photo.path)} alt="" draggable={false} style={{ position: "absolute", left: rect.x * scale, top: rect.y * scale, width: rect.width * scale, height: rect.height * scale, pointerEvents: "none" }} />}
            {(FRAMING_GUIDES[layout] || []).filter((g) => !g.behind).map((g) => <FootGuideBox key={g.label} g={g} scale={scale} text />)}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0" }}>
          <span style={{ fontSize: 11, color: "#60607a" }}>Zoom</span>
          <input type="range" min={50} max={300} step={1} value={Math.min(300, Math.max(50, pct))} onChange={onSlider} style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: "#eeeef5", width: 40, textAlign: "right" }}>{pct}%</span>
        </div>
        {msg && <div style={{ color: msg.t === "error" ? "#ef4444" : "#34d399", fontSize: 12, marginBottom: 8 }}>{msg.m}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btn(true)} disabled={saving || !fr} onClick={save}>{saving ? "…" : "Enregistrer"}</button>
          <button style={btn(false)} disabled={!photo} onClick={() => { setMsg(null); setFr(defaultFraming(layout, photo)); }}>Réinitialiser</button>
          <button style={btn(false)} disabled={!fr} onClick={previewServer}>Aperçu serveur</button>
        </div>
        {serverPreview && (
          <div style={{ marginTop: 14, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#60607a", marginBottom: 6 }}>Aperçu serveur (rendu réel)</div>
            <img src={serverPreview} alt="Aperçu serveur" onError={() => setMsg({ t: "error", m: "Aperçu serveur indisponible" })} style={{ maxWidth: "100%", width: boxW, borderRadius: layout === "render" ? "50%" : 0 }} />
          </div>
        )}
      </div>
    </div>
  );
}

function FootInstaKeyBox({ onSaved }) {
  const [v, setV] = React.useState("");
  function save() {
    if (!v.trim()) return;
    try { localStorage.setItem(INSTA_KEY_STORAGE, v.trim()); } catch (e) {}
    onSaved();
  }
  return (
    <div style={{ background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 12, padding: 14, marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: "#60607a", marginBottom: 8 }}>Clé admin Réseaux (gardée uniquement dans ce navigateur, envoyée seulement à l'API du site).</div>
      <input type="password" style={FOOT_INPUT_STYLE} placeholder="Clé admin" value={v} onChange={(e) => setV(e.target.value)} />
      <button onClick={save} style={{ background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, cursor: "pointer" }}>Enregistrer la clé</button>
    </div>
  );
}

// Images of one post: Match Day + Groupe, the three ranking pages, or a single visual.
function instaPostImages(post, v) {
  // `v` fingerprints the data behind the post: the URL changes when the match does, so the browser never reuses an outdated render.
  const url = (params) => `/api/insta/render?${new URLSearchParams({ ...params, v })}`;
  if (post.kind === "matchday") return [1, 2].map((page) => ({ label: page === 1 ? "Match Day" : "Groupe", src: url({ kind: "matchday", match: post.matchId, page }) }));
  if (post.kind === "rankings") return RANKING_PAGES.map((pg, i) => ({ label: pg.heading, src: url({ kind: "rankings", season: post.season, page: i + 1 }) }));
  return [{ label: post.kind === "ratings" ? "Notes" : "Résultat", src: url({ kind: post.kind, match: post.matchId }) }];
}

// Everything captionFor needs, built from the data already loaded in the app.
function instaCaptionContext(post, { matches, lineups, events, ratings }) {
  const match = matches.find((m) => m.id === post.matchId);
  const nameOf = (id) => postName(PLAYERS.find((p) => p.id === id), PLAYERS.filter((p) => lineups.some((l) => l.match_id === post.matchId && l.player_id === p.id)));
  if (post.kind === "matchday") return { opponent: match.opponent_name, band: matchBand(match) };
  if (post.kind === "result") {
    const evs = events.filter((e) => e.match_id === match.id);
    const sc = computeFootScore(evs);
    return { opponent: match.opponent_name, bl: sc.bl, opp: sc.opponent, goals: goalLines(evs, PLAYERS) };
  }
  if (post.kind === "ratings") {
    const sheet = lineups.filter((l) => l.match_id === match.id).map((l) => l.player_id);
    const avg = matchAverages(sheet, ratings.filter((r) => r.match_id === match.id));
    const top = sheet.filter((id) => avg[id] != null).sort((a, b) => avg[b] - avg[a]).slice(0, 3).map((id) => ({ name: nameOf(id), rating: avg[id] }));
    return { opponent: match.opponent_name, top };
  }
  return { season: post.season };
}

// Short fingerprint of everything a post's images are drawn from.
function instaDataKey(post, { matches, lineups, events, ratings }) {
  const mid = post.matchId;
  const slice = post.kind === "rankings"
    ? [matches.map((m) => [m.id, m.status, m.venue, m.ratings_validated_at]), events, lineups, ratings]
    : [matches.filter((m) => m.id === mid), lineups.filter((l) => l.match_id === mid), events.filter((e) => e.match_id === mid), ratings.filter((r) => r.match_id === mid)];
  const str = JSON.stringify(slice);
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function FootPostCard({ post, data }) {
  const [caption, setCaption] = React.useState(() => captionFor(post.kind, instaCaptionContext(post, data)));
  const [copied, setCopied] = React.useState(false);
  const images = instaPostImages(post, instaDataKey(post, data));
  async function copy() {
    try { await navigator.clipboard.writeText(caption); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (e) { console.warn("copy failed", e); }
  }
  const mini = { background: "#13131f", border: "1px solid #1e1e30", borderRadius: 6, color: "#eeeef5", padding: "5px 10px", fontSize: 12, cursor: "pointer", textDecoration: "none" };
  return (
    <div style={{ background: "#0d0d1c", border: "1px solid #1e1e30", borderRadius: 12, padding: 14, marginBottom: 14 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, marginBottom: 10 }}>{post.label}</div>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", marginBottom: 10 }}>
        {images.map((im) => (
          <div key={im.label} style={{ flex: "0 0 auto", width: 200, textAlign: "center" }}>
            <img src={im.src} alt={im.label} loading="lazy" style={{ width: 200, height: 250, objectFit: "cover", background: "#13131f", borderRadius: 8 }} />
            <div style={{ fontSize: 11, color: "#60607a", margin: "4px 0" }}>{im.label}</div>
            <a href={im.src} target="_blank" rel="noreferrer" style={mini}>Ouvrir</a>
          </div>
        ))}
      </div>
      <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={5} style={{ ...FOOT_INPUT_STYLE, boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
      <button onClick={copy} style={{ ...mini, fontWeight: 700 }}>{copied ? "Copié ✓" : "Copier la légende"}</button>
    </div>
  );
}

function FootPostsTab({ matches, lineups, events, ratings }) {
  const posts = availablePosts({ matches, lineups, now: new Date() });
  const data = { matches, lineups, events, ratings };
  return (
    <div>
      {posts.length === 0 && <div style={{ color: "#60607a", fontSize: 13 }}>Aucun post disponible pour l'instant.</div>}
      {posts.map((post) => <FootPostCard key={`${post.kind}-${post.matchId || post.season}-${instaDataKey(post, data)}`} post={post} data={data} />)}
      <div style={{ color: "#60607a", fontSize: 11, textAlign: "center", marginTop: 8 }}>Publication automatique : bientôt (plan 2)</div>
    </div>
  );
}

function FootReseauxPage({ roster, photos, framings, matches, lineups, events, ratings, reload }) {
  const [tab, setTab] = React.useState(() => readPref("foot_reseaux_tab", "photos", ["posts", "photos", "cadrage"]));
  const [hasKey, setHasKey] = React.useState(() => !!readInstaKey());
  const pick = (t) => { setTab(t); writePref("foot_reseaux_tab", t); };
  const tabBtn = (id, label) => (
    <button key={id} onClick={() => pick(id)} style={{ flex: 1, background: tab === id ? "#3b82f6" : "#13131f", color: tab === id ? "#fff" : "#eeeef5", border: "1px solid #1e1e30", borderRadius: 8, padding: "8px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{label}</button>
  );
  return (
    <div style={{ padding: 16 }}>
      {!hasKey && <FootInstaKeyBox onSaved={() => setHasKey(true)} />}
      {hasKey && (
        <div style={{ textAlign: "right", marginBottom: 8 }}>
          <button onClick={() => { try { localStorage.removeItem(INSTA_KEY_STORAGE); } catch (e) {} setHasKey(false); }} style={{ background: "none", border: "none", color: "#60607a", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}>Changer la clé admin</button>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {tabBtn("posts", "Posts")}{tabBtn("photos", "Photos")}{tabBtn("cadrage", "Cadrage")}
      </div>
      {tab === "posts" && <FootPostsTab matches={matches} lineups={lineups} events={events} ratings={ratings} />}
      {tab === "photos" && <FootPhotosTab roster={roster} photos={photos} reload={reload} />}
      {tab === "cadrage" && <FootFramingTool roster={roster} photos={photos} framings={framings} reload={reload} />}
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
  const [lineups, setLineups] = React.useState([]);
  const [ratings, setRatings] = React.useState([]);
  const [photos, setPhotos] = React.useState([]);
  const [framings, setFramings] = React.useState([]);

  const isAdmin = currentPlayer?.uid === ADMIN_UID;

  async function reloadFoot() {
    const [r, m, a, e, l, rt, ph, fr] = await Promise.all([
      sbFetch("foot_roster", "?select=*"),
      sbFetch("foot_matches", "?select=*&order=match_datetime"),
      sbFetch("foot_attendance", "?select=*"),
      sbFetch("foot_match_events", "?select=*"),
      sbFetch("foot_lineups", "?select=match_id,player_id"),
      sbFetch("foot_ratings", "?select=match_id,rater_id,ratee_id,score"),
      sbFetch("foot_player_photos", "?select=*").catch(() => []), // optional: absent until the insta migration is applied
      sbFetch("foot_photo_framings", "?select=*").catch(() => []),
    ]);
    setRoster(r || []);
    setMatches(m || []);
    setAttendance(a || []);
    setEvents(e || []);
    setLineups(l || []);
    setPhotos(ph || []);
    setFramings(fr || []);
    setRatings((rt || []).map((x) => ({ ...x, score: Number(x.score) })));
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
      {page === "calendar" && <FootCalendarPage matches={matches} events={events} roster={roster} attendance={attendance} nav={nav} currentPlayer={currentPlayer} reload={reloadFoot} />}
      {page === "matchDetail" && (
        <FootMatchDetailPage
          matchId={sub.matchId}
          matches={matches}
          roster={roster}
          attendance={attendance}
          events={events}
          lineups={lineups}
          ratings={ratings}
          currentPlayer={currentPlayer}
          isAdmin={isAdmin}
          navBack={() => nav("calendar")}
          reload={reloadFoot}
        />
      )}
      {page === "admin" && isAdmin && <FootAdminPage roster={roster} reload={reloadFoot} />}
      {page === "reseaux" && isAdmin && <FootReseauxPage roster={roster} photos={photos} framings={framings} matches={matches} lineups={lineups} events={events} ratings={ratings} reload={reloadFoot} />}
      {page === "rankings" && <FootPlaceholderPage label="Classement" />}
      {page === "stats" && <FootStatsPage matches={matches} lineups={lineups} events={events} ratings={ratings} roster={roster} currentPlayer={currentPlayer} />}
    </div>
  );
}
