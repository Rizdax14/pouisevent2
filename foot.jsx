// foot.jsx — screens of the football app (design system: foot-ui.jsx, tokens: foot-theme.js)

// ---- data helpers ------------------------------------------------------------------------------------------
async function setMatchAttendance(matchId, playerId, status) {
  assertUpsertOk(await SUPABASE.from("foot_attendance").upsert(
    { match_id: matchId, player_id: playerId, status, responded_at: new Date().toISOString() },
    { onConflict: "match_id,player_id" }
  ));
}

// An admin can clear an answer (back to "no response").
async function clearMatchAttendance(matchId, playerId) {
  await sbFetch("foot_attendance", `?match_id=eq.${matchId}&player_id=eq.${playerId}`, { method: "DELETE" });
}
async function setActivityAttendance(activityId, playerId, status) {
  assertUpsertOk(await SUPABASE.from("foot_activity_attendance").upsert(
    { activity_id: activityId, player_id: playerId, status, responded_at: new Date().toISOString() },
    { onConflict: "activity_id,player_id" }
  ));
}
async function clearActivityAttendance(activityId, playerId) {
  await sbFetch("foot_activity_attendance", `?activity_id=eq.${activityId}&player_id=eq.${playerId}`, { method: "DELETE" });
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

function formatMatchPlace(match) {
  const cityLine = [match.postal_code, match.city].filter(Boolean).join(" ");
  return [match.stadium_name, match.address, cityLine].filter(Boolean).join(" · ");
}

const footNameOf = (id) => { const p = PLAYERS.find((x) => x.id === id); return p ? getDisplayName(p, PLAYERS) : "?"; };
const footDayMs = 86400000;
function footDate(iso) { return new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Paris" }); }
// "19h" or "18h30" (Paris time)
function footHour(iso) { const [h, m] = footTime(iso).split(":"); return `${Number(h)}h${m === "00" ? "" : m}`; }
function footTime(iso) { return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }); }
const FOOT_OUTCOME_TONE = { V: "good", N: "warn", D: "bad" };
const FOOT_OUTCOME_LABEL = { V: "Victoire", N: "Nul", D: "Défaite" };

// ---- small shared bits ---------------------------------------------------------------------------------------
function FootMetaChips({ match }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      <FChip tone="soft">{match.venue === "exterieur" ? "Extérieur" : "Domicile"}</FChip>
      <FChip tone="soft">{match.match_type === "amical" ? "Amical" : "Championnat"}</FChip>
    </div>
  );
}

function FootWhenWhere({ match, size = 14 }) {
  const place = formatMatchPlace(match);
  const links = mapLinks(match);
  const [open, setOpen] = React.useState(false);
  const stop = (e) => e.stopPropagation();
  return (
    <div style={{ display: "grid", gap: 5, fontSize: size, color: FC.muted }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}><FIcon name="calendar" size={16} />{footDate(match.match_datetime)}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: FC.text }}><FIcon name="clock" size={16} /><span>Heure du match : <b>{footHour(match.match_datetime)}</b></span></div>
      {match.meeting_at && <div style={{ display: "flex", alignItems: "center", gap: 8, color: FC.text }}><FIcon name="users" size={16} /><span>Heure de RDV : <b>{footHour(match.meeting_at)}</b></span></div>}
      {place && (links ? (
        <div>
          <button onClick={(e) => { stop(e); setOpen(!open); }} aria-expanded={open} style={{ display: "flex", alignItems: "flex-start", gap: 8, border: "none", background: "none", padding: 0, margin: 0, font: "inherit", color: FC.deep, textAlign: "left", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>
            <FIcon name="pin" size={16} style={{ marginTop: 1 }} /><span>{place}</span>
          </button>
          {open && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0 2px 24px" }}>
              {[["waze", "Waze"], ["plans", "Plans"], ["google", "Google Maps"]].map(([k, label]) => (
                <a key={k} href={links[k]} target="_blank" rel="noreferrer" onClick={stop} style={{ fontFamily: FF.ui, fontSize: 14, letterSpacing: "0.04em", textTransform: "uppercase", textDecoration: "none", color: "#fff", background: FC.accent, borderRadius: 999, padding: "8px 14px", minHeight: 20 }}>{label}</a>
              ))}
            </div>
          )}
        </div>
      ) : <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}><FIcon name="pin" size={16} style={{ marginTop: 1 }} /><span>{place}</span></div>)}
    </div>
  );
}

// Portrait with a small status dot in its corner: green = present, red = absent, grey = no answer yet (no dot when unknown).
const FOOT_PRESENCE_LABEL = { present: "Présent", absent: "Absent", none: "Pas de réponse" };
function FootPresenceAvatar({ id, name, size, status }) {
  if (!status) return <FAvatar playerId={id} name={name} size={size} />;
  const color = status === "present" ? FC.good : status === "absent" ? FC.bad : FC.muted;
  const d = Math.max(10, Math.round(size * 0.36));
  return (
    <span style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
      <FAvatar playerId={id} name={name} size={size} />
      <span role="img" aria-label={FOOT_PRESENCE_LABEL[status]} title={FOOT_PRESENCE_LABEL[status]} style={{ position: "absolute", right: -2, bottom: -2, width: d, height: d, borderRadius: d / 2, background: color, border: "2px solid #fff", boxSizing: "border-box" }} />
    </span>
  );
}
// player id → "present" | "absent" | "none" for one match.
function presenceMap(attendance, matchId) {
  const out = {};
  for (const a of attendance || []) if (a.match_id === matchId) out[a.player_id] = a.status === "present" ? "present" : a.status === "absent" ? "absent" : "none";
  return out;
}

// A player as a pill: round portrait, name, optional jersey number.
function FootPlayerPill({ id, number, tone = "soft", dim, status }) {
  const name = footNameOf(id);
  const { openPlayer } = React.useContext(FootCtx);
  const open = openPlayer ? { role: "button", tabIndex: 0, onClick: (e) => { e.stopPropagation(); openPlayer(id); }, onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); openPlayer(id); } }, "aria-label": `Voir les stats de ${name}` } : {};
  return (
    <span {...open} style={{ cursor: openPlayer ? "pointer" : "inherit", display: "inline-flex", alignItems: "center", gap: 7, background: tone === "soft" ? FC.soft : "transparent", border: tone === "soft" ? "none" : `1px solid ${FC.line}`, borderRadius: 999, padding: "4px 12px 4px 4px", fontSize: 14, color: dim ? FC.muted : FC.text, maxWidth: "100%" }}>
      <FootPresenceAvatar id={id} name={name} size={28} status={status} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
      {number && <span style={{ fontFamily: FF.ui, fontSize: 12, color: FC.deep, background: FC.solid, borderRadius: 999, padding: "1px 7px" }}>{number}</span>}
    </span>
  );
}

function FootAttendanceButtons({ myStatus, saving, onSet, compact }) {
  const pick = (status) => (e) => { e.stopPropagation(); onSet(status); };
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <FBtn variant={myStatus === "present" ? "success" : "ghost"} size={compact ? "md" : "lg"} icon="check" disabled={saving} onClick={pick("present")} style={{ flex: 1 }}>Présent</FBtn>
      <FBtn variant={myStatus === "absent" ? "danger" : "ghost"} size={compact ? "md" : "lg"} icon="x" disabled={saving} onClick={pick("absent")} style={{ flex: 1 }}>Absent</FBtn>
    </div>
  );
}

// ---- lineup (feuille de match) ------------------------------------------------------------------------------------
function FootLineupChecklist({ roster, extraIds, checked, onToggle, disabled, presence }) {
  const ids = [...new Set([...roster.map((r) => r.player_id), ...(extraIds || [])])];
  const numberOf = (id) => (roster.find((r) => r.player_id === id) || {}).jersey_number;
  const players = ids.map((id) => PLAYERS.find((p) => p.id === id)).filter(Boolean)
    .sort((a, b) => (getDisplayName(a, PLAYERS) || "").localeCompare(getDisplayName(b, PLAYERS) || ""));
  if (players.length === 0) return <FEmpty icon="users" title="Aucun joueur" text="Ajoute des joueurs à l'effectif dans l'onglet Admin." />;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {players.map((p) => {
        const on = checked.includes(p.id);
        return (
          <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px 6px 6px", borderRadius: 16, background: on ? FC.accentSoft : FC.softer, border: `1.5px solid ${on ? FC.accent : "transparent"}`, cursor: disabled ? "default" : "pointer", fontSize: 15 }}>
            <FootPresenceAvatar id={p.id} name={getDisplayName(p, PLAYERS)} size={34} status={presence ? presence[p.id] || "none" : null} />
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getDisplayName(p, PLAYERS)}</span>
            {numberOf(p.id) && <span style={{ fontFamily: FF.ui, fontSize: 13, color: FC.deep }}>n°{numberOf(p.id)}</span>}
            <input type="checkbox" checked={on} disabled={disabled} onChange={() => onToggle(p.id)} />
          </label>
        );
      })}
    </div>
  );
}

function FootLineupSection({ match, roster, lineups, attendance, isAdmin, reload }) {
  const current = lineupIdsFor(lineups, match.id);
  const presence = presenceMap(attendance, match.id);
  const [editing, setEditing] = React.useState(false);
  const [snapshot, setSnapshot] = React.useState(current);
  const [wanted, setWanted] = React.useState(current);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const toggle = (id) => setWanted(wanted.includes(id) ? wanted.filter((x) => x !== id) : [...wanted, id]);

  async function save() {
    setSaving(true); setErr(null);
    try { await applyLineupChange(match.id, diffLineupEdit(snapshot, current, wanted)); await reload(); setEditing(false); }
    catch (e) { console.warn("lineup save failed", e); setErr("Enregistrement impossible : " + e.message); }
    setSaving(false);
  }

  const numberOf = (id) => (roster.find((r) => r.player_id === id) || {}).jersey_number;
  const ordered = [...current].sort((a, b) => (Number(numberOf(a)) || 999) - (Number(numberOf(b)) || 999) || footNameOf(a).localeCompare(footNameOf(b)));
  return (
    <FCard>
      <FHeading right={isAdmin && !editing && <FBtn size="sm" variant="secondary" icon="pencil" onClick={() => { setSnapshot(current); setWanted(current); setEditing(true); }}>Modifier</FBtn>}>
        Convocation <span style={{ fontFamily: FF.ui, fontSize: 15, color: FC.muted }}>({current.length})</span>
      </FHeading>
      {!editing && (ordered.length
        ? <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{ordered.map((id) => <FootPlayerPill key={id} id={id} number={numberOf(id)} status={presence[id] || "none"} />)}</div>
        : <FEmpty icon="users" title="Pas encore de convocation" text={isAdmin ? "Choisis les joueurs convoqués pour ce match." : "La convocation n'est pas encore publiée."} />)}
      {editing && (
        <>
          <FootLineupChecklist roster={roster} extraIds={current} checked={wanted} onToggle={toggle} disabled={saving} presence={presence} />
          {err && <FMessage style={{ marginTop: 10 }}>{err}</FMessage>}
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <FBtn variant="ghost" onClick={() => setEditing(false)} disabled={saving} style={{ flex: 1 }}>Annuler</FBtn>
            <FBtn onClick={save} disabled={saving} style={{ flex: 1 }}>{saving ? "…" : `Enregistrer (${wanted.length})`}</FBtn>
          </div>
        </>
      )}
    </FCard>
  );
}

// ---- match form (create / edit) ----------------------------------------------------------------------------------------
function FootMatchForm({ title, initial, submitLabel, onSubmit, onCancel, resetOnSuccess }) {
  const empty = { opponent_name: "", match_datetime: "", stadium_name: "", address: "", postal_code: "", city: "", match_type: "championnat", venue: "domicile", min_players: "10", meeting_time: "" };
  const start = initial ? { ...empty, ...initial, match_datetime: toDatetimeLocalValue(initial.match_datetime), min_players: initial.min_players == null ? "" : String(initial.min_players), meeting_time: meetingTimeValue(initial.meeting_at) } : empty;
  const [f, setF] = React.useState(start);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState(null);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit() {
    if (!f.opponent_name.trim() || !f.match_datetime) {
      setMsg({ t: "bad", m: "Adversaire et date/heure du coup d'envoi sont obligatoires." });
      return;
    }
    const minRaw = String(f.min_players ?? "").trim();
    const min = minRaw === "" ? null : Number(minRaw);
    if (min !== null && !(Number.isInteger(min) && min >= 1 && min <= 50)) {
      setMsg({ t: "bad", m: "Le minimum de joueurs doit être un nombre entre 1 et 50 (ou vide)." });
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        min_players: min,
        meeting_at: meetingIsoFor(new Date(f.match_datetime).toISOString(), f.meeting_time),
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
      setMsg({ t: "good", m: "Enregistré ✓" });
    } catch (e) {
      setMsg({ t: "bad", m: "Erreur : " + e.message });
    }
    setSaving(false);
  }

  return (
    <FCard>
      <FHeading>{title}</FHeading>
      <FField label="Équipe adverse"><input style={FOOT_INPUT_STYLE} placeholder="Ex. En Avant Guinguette" value={f.opponent_name} onChange={set("opponent_name")} /></FField>
      <FField label="Date et heure du coup d'envoi"><input style={FOOT_INPUT_STYLE} type="datetime-local" value={f.match_datetime} onChange={set("match_datetime")} /></FField>
      <FField label="Heure du rendez-vous (optionnel)"><input style={FOOT_INPUT_STYLE} type="time" value={f.meeting_time || ""} onChange={set("meeting_time")} aria-label="Heure du rendez-vous" /></FField>
      <FLabel>Lieu</FLabel>
      <FSegmented value={f.venue || "domicile"} onChange={(v) => setF({ ...f, venue: v })} options={[["domicile", "Domicile"], ["exterieur", "Extérieur"]]} style={{ marginBottom: 12 }} />
      <FLabel>Type</FLabel>
      <FSegmented value={f.match_type || "championnat"} onChange={(v) => setF({ ...f, match_type: v })} options={[["championnat", "Championnat"], ["amical", "Amical"]]} style={{ marginBottom: 14 }} />
      <FField label="Joueurs minimum"><input style={FOOT_INPUT_STYLE} inputMode="numeric" placeholder="Ex. 10 (vide = pas de limite)" value={f.min_players ?? ""} onChange={set("min_players")} aria-label="Nombre minimum de joueurs" /></FField>
      <div style={{ fontSize: 12, color: FC.muted, margin: "-6px 0 14px" }}>Au-delà, les joueurs qui répondent « présent » passent en liste d'attente, dans l'ordre de leur réponse.</div>
      <FField label="Stade"><input style={FOOT_INPUT_STYLE} placeholder="Nom du stade" value={f.stadium_name || ""} onChange={set("stadium_name")} /></FField>
      <FField label="Adresse"><input style={FOOT_INPUT_STYLE} placeholder="Adresse" value={f.address || ""} onChange={set("address")} /></FField>
      <div style={{ display: "flex", gap: 10 }}>
        <FField label="Code postal" style={{ flex: "0 0 38%" }}><input style={FOOT_INPUT_STYLE} inputMode="numeric" placeholder="42000" value={f.postal_code || ""} onChange={set("postal_code")} /></FField>
        <FField label="Ville" style={{ flex: 1 }}><input style={FOOT_INPUT_STYLE} placeholder="Ville" value={f.city || ""} onChange={set("city")} /></FField>
      </div>
      {msg && <FMessage tone={msg.t}>{msg.m}</FMessage>}
      <div style={{ display: "flex", gap: 10 }}>
        {onCancel && <FBtn variant="ghost" onClick={onCancel} disabled={saving} style={{ flex: 1 }}>Annuler</FBtn>}
        <FBtn onClick={submit} disabled={saving} style={{ flex: 1 }}>{saving ? "Enregistrement…" : submitLabel}</FBtn>
      </div>
    </FCard>
  );
}

function FootCreateMatchForm({ reload }) {
  const [open, setOpen] = React.useState(false);
  if (!open) return <FBtn full size="lg" icon="plus" onClick={() => setOpen(true)} style={{ marginBottom: 14 }}>Nouveau match</FBtn>;
  return (
    <FootMatchForm
      title="Nouveau match"
      submitLabel="Créer le match"
      resetOnSuccess
      onCancel={() => setOpen(false)}
      onSubmit={async (data) => { await sbInsert("foot_matches", data); await reload(); setOpen(false); }}
    />
  );
}

// ---- calendar ---------------------------------------------------------------------------------------------------------------
function FootPresenceStack({ ids, total, min, waiting }) {
  const shown = ids.slice(0, 6);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ display: "flex" }}>
        {shown.map((id, i) => <span key={id} style={{ marginLeft: i ? -9 : 0, borderRadius: 20, boxShadow: `0 0 0 2px ${FC.solid}` }}><FAvatar playerId={id} name={footNameOf(id)} size={30} /></span>)}
      </div>
      <span style={{ fontSize: 14, color: FC.muted }}><b style={{ color: FC.text, fontFamily: FF.ui, fontSize: 16 }}>{ids.length}</b> / {min || total} {min ? "confirmés" : "présents"}{waiting ? ` · ${waiting} en attente` : ""}</span>
    </div>
  );
}

function FootMatchHero({ match, score, presentIds, waitingCount, rosterSize, onOpen, isOnRoster, myStatus, onSetStatus, saving }) {
  const live = match.status === "live";
  return (
    <FCard onClick={onOpen} pad={20} style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        {live ? <FChip tone="live">En direct</FChip> : <FChip tone="accent">Prochain match</FChip>}
        <span style={{ fontFamily: FF.ui, fontSize: 14, color: FC.deep }}>{footRelative(match.match_datetime)}</span>
      </div>
      <div style={{ fontFamily: FF.ui, fontSize: 14, color: FC.muted, letterSpacing: "0.05em", textTransform: "uppercase" }}>Bière Leverculsec</div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div style={{ fontFamily: FF.display, fontSize: 30, lineHeight: 1.15, color: FC.deep, minWidth: 0, overflowWrap: "anywhere" }}>vs {match.opponent_name}</div>
        {live && <div style={{ fontFamily: FF.display, fontSize: 34, color: FC.deep, whiteSpace: "nowrap" }}>{score.bl}–{score.opponent}</div>}
      </div>
      <FootWhenWhere match={match} />
      {(match.ball_keepers || []).length > 0 && <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: FC.text, marginTop: 5 }}><FIcon name="ball" size={16} /><span>Ballons : <b>{match.ball_keepers.map(footNameOf).join(" et ")}</b></span></div>}
      <div style={{ margin: "12px 0" }}><FootMetaChips match={match} /></div>
      {!live && (
        <>
          <FootPresenceStack ids={presentIds} total={rosterSize} min={match.min_players} waiting={waitingCount} />
          {isOnRoster && <div style={{ marginTop: 14 }}><FootAttendanceButtons myStatus={myStatus} saving={saving} onSet={onSetStatus} /></div>}
        </>
      )}
    </FCard>
  );
}

function FootMatchRow({ match, score, onOpen }) {
  const finished = match.status !== "scheduled";
  const out = finished ? footOutcome(score) : null;
  const dt = new Date(match.match_datetime);
  return (
    <FCard onClick={onOpen} pad={12} style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 12 }}>
      {finished ? (
        <span title={FOOT_OUTCOME_LABEL[out]} style={{ width: 44, height: 44, borderRadius: 22, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: FF.display, fontSize: 20, background: FC[FOOT_OUTCOME_TONE[out]], color: "#fff" }}>{out}</span>
      ) : (
        <span style={{ width: 44, flexShrink: 0, textAlign: "center", lineHeight: 1.05 }}>
          <span style={{ display: "block", fontFamily: FF.display, fontSize: 22, color: FC.deep }}>{dt.toLocaleDateString("fr-FR", { day: "numeric", timeZone: "Europe/Paris" })}</span>
          <span style={{ display: "block", fontFamily: FF.ui, fontSize: 12, color: FC.muted, textTransform: "uppercase" }}>{dt.toLocaleDateString("fr-FR", { month: "short", timeZone: "Europe/Paris" })}</span>
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FF.ui, fontSize: 18, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{match.opponent_name}</div>
        <div style={{ fontSize: 13, color: FC.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {finished ? footDate(match.match_datetime) : `${footDate(match.match_datetime)} · ${footTime(match.match_datetime)}`} · {match.venue === "exterieur" ? "Extérieur" : "Domicile"}{match.match_type === "amical" ? " · Amical" : ""}
        </div>
      </div>
      {finished ? <div style={{ fontFamily: FF.display, fontSize: 26, color: FC.deep, whiteSpace: "nowrap" }}>{score.bl}–{score.opponent}</div> : <FIcon name="chevron" size={20} style={{ color: FC.muted }} />}
    </FCard>
  );
}

function FootCalendarPage({ matches, events, roster, attendance, activities, activityAttendance, nav, currentPlayer, reload }) {
  const [savingMatchId, setSavingMatchId] = React.useState(null);
  const presenceRoster = attendanceRoster(roster);
  const isOnRoster = presenceRoster.some((r) => r.player_id === currentPlayer?.id);

  async function setStatus(matchId, status) {
    setSavingMatchId(matchId);
    try { await setMatchAttendance(matchId, currentPlayer.id, status); await reload(); }
    catch (e) { console.warn("attendance update failed", e); }
    setSavingMatchId(null);
  }

  const upcomingActivities = (activities || []).filter((a) => new Date(a.starts_at).getTime() > Date.now() - 6 * 3600 * 1000).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  const activitiesBlock = upcomingActivities.length > 0 && (
    <div style={{ marginBottom: 8 }}>
      <FTitle size={20} style={{ marginBottom: 10 }}>Activités</FTitle>
      {upcomingActivities.map((a) => <FootActivityCard key={a.id} activity={a} roster={roster} rows={(activityAttendance || []).filter((r) => r.activity_id === a.id)} currentPlayer={currentPlayer} isAdmin={isBureau(currentPlayer)} reload={reload} />)}
    </div>
  );
  if (matches.length === 0) {
    if (activitiesBlock) return <div className="ft-page">{activitiesBlock}</div>;
    return <FCard><FEmpty icon="calendar" title="Aucun match" text="Les matchs apparaîtront ici dès qu'ils seront créés." /></FCard>;
  }
  const scoreOf = (m) => computeFootScore(events.filter((e) => e.match_id === m.id));
  const featured = footFeaturedMatch(matches);
  const upcoming = matches.filter((m) => m.status === "scheduled" && m !== featured).sort((a, b) => new Date(a.match_datetime) - new Date(b.match_datetime));
  const past = matches.filter((m) => m.status === "finished" || (m.status === "live" && m !== featured)).sort((a, b) => new Date(b.match_datetime) - new Date(a.match_datetime));
  const open = (m) => () => nav("matchDetail", { matchId: m.id });
  const heroAttendance = featured ? attendance.filter((a) => a.match_id === featured.id) : [];
  const section = (label, list) => list.length > 0 && (
    <div style={{ marginBottom: 8 }}>
      <FTitle size={20} style={{ marginBottom: 10 }}>{label}</FTitle>
      {list.map((m) => <FootMatchRow key={m.id} match={m} score={scoreOf(m)} onOpen={open(m)} />)}
    </div>
  );
  return (
    <div className="ft-page">
      {featured && (
        <FootMatchHero
          match={featured} score={scoreOf(featured)} onOpen={open(featured)}
          presentIds={computeAttendanceQueue(presenceRoster, heroAttendance, featured.min_players).confirmed} waitingCount={computeAttendanceQueue(presenceRoster, heroAttendance, featured.min_players).waiting.length} rosterSize={presenceRoster.length}
          isOnRoster={isOnRoster} myStatus={heroAttendance.find((a) => a.player_id === currentPlayer?.id)?.status || null}
          saving={savingMatchId === featured.id} onSetStatus={(status) => setStatus(featured.id, status)}
        />
      )}
      {section("À venir", upcoming)}
      {activitiesBlock}
      {section("Résultats", past)}
    </div>
  );
}

// ---- roster & admin -------------------------------------------------------------------------------------------------------------
// Private details of one player (birth date, phone, e-mail). Stored server-side behind the admin key.
function FootPlayerDetailsEditor({ player, detail, onSaved }) {
  const [f, setF] = React.useState({ birth_date: (detail && detail.birth_date) || "", phone: (detail && detail.phone) || "", email: (detail && detail.email) || "", instagram: (detail && detail.instagram) || "" });
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function save() {
    setBusy(true); setMsg(null);
    try {
      const r = await instaAdminFetch("player-details", { player_id: player.id, birth_date: f.birth_date, phone: f.phone, email: f.email, instagram: f.instagram });
      onSaved(r.detail);
      setMsg({ t: "good", m: "Enregistré ✓" });
    } catch (e) { setMsg({ t: "bad", m: e.message }); }
    setBusy(false);
  }
  return (
    <div style={{ padding: "6px 0 12px 48px" }}>
      <FField label="Date de naissance"><input style={FOOT_INPUT_STYLE} type="date" value={f.birth_date} onChange={set("birth_date")} max={new Date().toISOString().slice(0, 10)} aria-label="Date de naissance" /></FField>
      <FField label="Téléphone"><input style={FOOT_INPUT_STYLE} type="tel" inputMode="tel" placeholder="06 12 34 56 78" value={f.phone} onChange={set("phone")} aria-label="Téléphone" autoComplete="off" /></FField>
      <FField label="E-mail"><input style={FOOT_INPUT_STYLE} type="email" inputMode="email" placeholder="prenom@exemple.fr" value={f.email} onChange={set("email")} aria-label="E-mail" autoCapitalize="off" autoComplete="off" /></FField>
      <FField label="Instagram"><input style={FOOT_INPUT_STYLE} placeholder="@pseudo" value={f.instagram} onChange={set("instagram")} aria-label="Pseudo Instagram" autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false} /></FField>
      {msg && <FMessage tone={msg.t}>{msg.m}</FMessage>}
      <FBtn size="sm" onClick={save} disabled={busy}>{busy ? "…" : "Enregistrer les infos"}</FBtn>
    </div>
  );
}

function FootRosterManager({ roster, reload }) {
  const [saving, setSaving] = React.useState(null); // player id currently being saved
  const [search, setSearch] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [addSearch, setAddSearch] = React.useState("");
  const [addRole, setAddRole] = React.useState("regulier");
  const [openId, setOpenId] = React.useState(null);
  const [hasKey, setHasKey] = React.useState(() => !!readInstaKey());
  const [details, setDetails] = React.useState({});
  const [detailsErr, setDetailsErr] = React.useState(null);

  React.useEffect(() => {
    if (!hasKey) return;
    instaAdminFetch("player-details", null, "GET").then((r) => { setDetails(Object.fromEntries((r.details || []).map((d) => [d.player_id, d]))); setDetailsErr(null); })
      .catch((e) => { setDetailsErr(e.message); setHasKey(!!readInstaKey()); });
  }, [hasKey]);

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
  const byName = (a, b) => nameOf(a).localeCompare(nameOf(b));
  const team = PLAYERS.filter((p) => roleByPlayer[p.id]).sort(byName);
  const visibleTeam = filterPlayersByName(team, search, nameOf);
  const others = PLAYERS.filter((p) => !roleByPlayer[p.id]).sort(byName);
  const visibleOthers = filterPlayersByName(others, addSearch, nameOf);
  const ageOf = (iso) => { if (!iso) return null; const d = new Date(iso), n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a; };

  return (
    <FCard>
      <FHeading right={<FChip tone="soft">{roster.length} joueurs</FChip>}>Effectif</FHeading>
      <input style={FOOT_INPUT_STYLE} placeholder="Rechercher dans l'effectif…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Rechercher dans l'effectif" />
      {team.length === 0 && <FEmpty icon="users" title="Effectif vide" text="Ajoute des joueurs avec le bouton ci-dessous." />}
      {team.length > 0 && visibleTeam.length === 0 && <FEmpty icon="users" title="Aucun résultat" text={`Aucun joueur de l'effectif ne correspond à « ${search} ».`} />}
      {detailsErr && <FMessage tone="warn">Infos personnelles indisponibles ({detailsErr}).</FMessage>}
      {!hasKey && <div style={{ marginTop: 10 }}><FootInstaKeyBox onSaved={() => setHasKey(true)} /></div>}
      {visibleTeam.map((p) => {
        const d = details[p.id];
        const open = openId === p.id;
        return (
          <div key={p.id} style={{ borderTop: `1px solid ${FC.line}` }}>
            <div style={{ padding: "8px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <FAvatar playerId={p.id} name={nameOf(p)} size={38} linkable />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, overflowWrap: "anywhere" }}>{nameOf(p)}</div>
                  {d && (d.birth_date || d.phone || d.email || d.instagram) && <div style={{ fontSize: 12, color: FC.muted, overflowWrap: "anywhere" }}>{[d.birth_date ? `${ageOf(d.birth_date)} ans` : null, d.phone, d.email, d.instagram ? `@${d.instagram}` : null].filter(Boolean).join(" · ")}</div>}
                </div>
                <FIconBtn icon="user" label={`Infos de ${nameOf(p)}`} tone={open ? "soft" : "ghost"} onClick={() => setOpenId(open ? null : p.id)} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0 0 48px" }}>
                <input key={`${p.id}-${numberByPlayer[p.id] || ""}`} defaultValue={numberByPlayer[p.id] || ""} placeholder="n°" inputMode="numeric" maxLength={3} aria-label={`Numéro de ${nameOf(p)}`}
                  onBlur={(e) => { const v = e.target.value.trim(); if (v !== (numberByPlayer[p.id] || "")) setNumber(p.id, v); }}
                  style={{ ...FOOT_INPUT_STYLE, width: 70, marginBottom: 0, textAlign: "center", padding: "8px 6px", minHeight: 40, fontFamily: FF.ui }} />
                <select value={roleByPlayer[p.id] || ""} disabled={saving === p.id} onChange={(e) => setRole(p.id, e.target.value)} aria-label={`Rôle de ${nameOf(p)}`} style={{ ...FOOT_SELECT_STYLE, flex: 1, minWidth: 0 }}>
                  <option value="">Hors équipe</option>
                  <option value="regulier">Régulier</option>
                  <option value="occasionnel">Occasionnel</option>
                  <option value="invite">Invité</option>
                </select>
              </div>
            </div>
            {open && (hasKey ? <FootPlayerDetailsEditor key={`${p.id}-${d ? [d.phone, d.email, d.birth_date, d.instagram].join("|") : ""}`} player={p} detail={d} onSaved={(row) => setDetails({ ...details, [p.id]: row })} /> : <div style={{ fontSize: 13, color: FC.muted, padding: "0 0 12px 48px" }}>Saisis la clé admin ci-dessus pour voir et modifier les infos.</div>)}
          </div>
        );
      })}

      <FBtn variant="secondary" full icon="plus" onClick={() => setAdding(!adding)} style={{ marginTop: 14 }}>{adding ? "Fermer la liste" : "Ajouter un joueur"}</FBtn>
      {adding && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <input style={{ ...FOOT_INPUT_STYLE, marginBottom: 0, flex: 1 }} placeholder="Chercher parmi tous les joueurs…" value={addSearch} onChange={(e) => setAddSearch(e.target.value)} aria-label="Chercher parmi tous les joueurs" />
            <select value={addRole} onChange={(e) => setAddRole(e.target.value)} aria-label="Rôle à l'ajout" style={{ ...FOOT_SELECT_STYLE, maxWidth: 124 }}>
              <option value="regulier">Régulier</option>
              <option value="occasionnel">Occasionnel</option>
              <option value="invite">Invité</option>
            </select>
          </div>
          {visibleOthers.length === 0 && <FEmpty icon="users" title="Aucun joueur" text={addSearch ? `Aucun joueur ne correspond à « ${addSearch} ».` : "Tous les joueurs sont déjà dans l'effectif."} />}
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {visibleOthers.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${FC.line}` }}>
                <FAvatar playerId={p.id} name={nameOf(p)} size={34} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nameOf(p)}</div>
                <FBtn size="sm" icon="plus" disabled={saving === p.id} onClick={() => setRole(p.id, addRole)}>Ajouter</FBtn>
              </div>
            ))}
          </div>
        </div>
      )}
    </FCard>
  );
}

// ---- activities (free events, not matches) ------------------------------------------------------------------------------------
function FootActivityForm({ title, initial, submitLabel, onSubmit, onCancel, resetOnSuccess }) {
  const empty = { title: "", description: "", starts_at: "", location: "", min_players: "" };
  const [f, setF] = React.useState(initial ? { ...empty, ...initial, starts_at: toDatetimeLocalValue(initial.starts_at), min_players: initial.min_players == null ? "" : String(initial.min_players), description: initial.description || "", location: initial.location || "" } : empty);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit() {
    if (!f.title.trim() || !f.starts_at) { setMsg({ t: "bad", m: "Le titre et la date/heure sont obligatoires." }); return; }
    const minRaw = String(f.min_players ?? "").trim();
    const min = minRaw === "" ? null : Number(minRaw);
    if (min !== null && !(Number.isInteger(min) && min >= 1 && min <= 200)) { setMsg({ t: "bad", m: "Le minimum doit être un nombre entre 1 et 200 (ou vide)." }); return; }
    setSaving(true);
    try {
      await onSubmit({ title: f.title.trim(), description: f.description.trim() || null, starts_at: new Date(f.starts_at).toISOString(), location: f.location.trim() || null, min_players: min });
      if (resetOnSuccess) setF(empty);
      setMsg({ t: "good", m: "Enregistré ✓" });
    } catch (e) { setMsg({ t: "bad", m: "Erreur : " + e.message }); }
    setSaving(false);
  }
  return (
    <FCard>
      <FHeading>{title}</FHeading>
      <FField label="Titre"><input style={FOOT_INPUT_STYLE} placeholder="Ex. Troisième mi-temps, entraînement, resto d'équipe…" value={f.title} onChange={set("title")} aria-label="Titre de l'activité" /></FField>
      <FField label="Date et heure"><input style={FOOT_INPUT_STYLE} type="datetime-local" value={f.starts_at} onChange={set("starts_at")} aria-label="Date et heure" /></FField>
      <FField label="Lieu"><input style={FOOT_INPUT_STYLE} placeholder="Où ça se passe ?" value={f.location} onChange={set("location")} aria-label="Lieu" /></FField>
      <FField label="Détails"><textarea style={{ ...FOOT_INPUT_STYLE, minHeight: 84, resize: "vertical", fontFamily: "inherit" }} placeholder="Programme, infos pratiques, à apporter…" value={f.description} onChange={set("description")} aria-label="Détails" /></FField>
      <FField label="Participants minimum"><input style={FOOT_INPUT_STYLE} inputMode="numeric" placeholder="Vide = pas de limite" value={f.min_players} onChange={set("min_players")} aria-label="Participants minimum" /></FField>
      {msg && <FMessage tone={msg.t}>{msg.m}</FMessage>}
      <div style={{ display: "flex", gap: 10 }}>
        {onCancel && <FBtn variant="ghost" onClick={onCancel} disabled={saving} style={{ flex: 1 }}>Annuler</FBtn>}
        <FBtn onClick={submit} disabled={saving} style={{ flex: 1 }}>{saving ? "Enregistrement…" : submitLabel}</FBtn>
      </div>
    </FCard>
  );
}

function FootCreateActivityForm({ reload }) {
  const [open, setOpen] = React.useState(false);
  if (!open) return <FBtn full size="lg" variant="secondary" icon="plus" onClick={() => setOpen(true)} style={{ marginBottom: 14 }}>Nouvelle activité</FBtn>;
  return <FootActivityForm title="Nouvelle activité" submitLabel="Créer l'activité" resetOnSuccess onCancel={() => setOpen(false)} onSubmit={async (data) => { await sbInsert("foot_activities", data); await reload(); setOpen(false); }} />;
}

// Admin list of the activities: edit or delete.
function FootActivitiesAdmin({ activities, reload }) {
  const [editingId, setEditingId] = React.useState(null);
  const [busyId, setBusyId] = React.useState(null);
  if (!activities.length) return null;
  const sorted = [...activities].sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));
  async function remove(a) {
    if (!window.confirm(`Supprimer l'activité « ${a.title} » et ses réponses ?`)) return;
    setBusyId(a.id);
    try { await sbFetch("foot_activities", `?id=eq.${a.id}`, { method: "DELETE" }); await reload(); } catch (e) { console.warn("delete activity failed", e); }
    setBusyId(null);
  }
  return (
    <FCard>
      <FHeading right={<FChip tone="soft">{activities.length}</FChip>}>Activités</FHeading>
      {sorted.map((a) => editingId === a.id ? (
        <FootActivityForm key={a.id} title="Modifier l'activité" initial={a} submitLabel="Enregistrer" onCancel={() => setEditingId(null)} onSubmit={async (data) => { await sbUpdate("foot_activities", { id: a.id }, data); await reload(); setEditingId(null); }} />
      ) : (
        <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${FC.line}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div>
            <div style={{ fontSize: 12, color: FC.muted }}>{footDate(a.starts_at)} · {footTime(a.starts_at)}{a.location ? ` · ${a.location}` : ""}</div>
          </div>
          <FIconBtn icon="pencil" label={`Modifier ${a.title}`} onClick={() => setEditingId(a.id)} />
          <FIconBtn icon="trash" label={`Supprimer ${a.title}`} tone="danger" disabled={busyId === a.id} onClick={() => remove(a)} />
        </div>
      ))}
    </FCard>
  );
}

// An activity on the Matchs page: details, my answer, and everybody's answers.
function FootActivityCard({ activity, roster, rows, currentPlayer, isAdmin, reload }) {
  const [saving, setSaving] = React.useState(false);
  const [showAll, setShowAll] = React.useState(false);
  const presenceRoster = attendanceRoster(roster);
  const isOnRoster = presenceRoster.some((r) => r.player_id === currentPlayer?.id);
  const mine = rows.find((a) => a.player_id === currentPlayer?.id);
  const q = computeAttendanceQueue(presenceRoster, rows, activity.min_players);
  const myPlace = q.order.find((o) => o.playerId === currentPlayer?.id);
  async function setMine(status) {
    setSaving(true);
    try { await setActivityAttendance(activity.id, currentPlayer.id, status); await reload(); } catch (e) { console.warn("activity attendance failed", e); }
    setSaving(false);
  }
  const setPlayer = async (id, status) => { if (status === null) await clearActivityAttendance(activity.id, id); else await setActivityAttendance(activity.id, id, status); await reload(); };
  return (
    <div style={{ marginBottom: 12 }}>
      <FCard>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <FChip tone="accent" icon="calendar">Activité</FChip>
          <span style={{ fontFamily: FF.ui, fontSize: 14, color: FC.deep }}>{footRelative(activity.starts_at)}</span>
        </div>
        <div style={{ fontFamily: FF.display, fontSize: 24, lineHeight: 1.15, color: FC.deep, overflowWrap: "anywhere" }}>{activity.title}</div>
        <div style={{ fontSize: 14, color: FC.muted, margin: "6px 0" }}>{footDate(activity.starts_at)} · {footTime(activity.starts_at)}{activity.location ? ` · ${activity.location}` : ""}</div>
        {activity.description && <div style={{ fontSize: 15, lineHeight: 1.4, margin: "8px 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{activity.description}</div>}
        <div style={{ margin: "10px 0" }}>
          <FChip tone={q.min && q.confirmed.length >= q.min ? "good" : "soft"}>{q.confirmed.length}{q.min ? ` / ${q.min}` : ""} {q.min ? "confirmés" : "présents"}{q.waiting.length ? ` · ${q.waiting.length} en attente` : ""}</FChip>
        </div>
        {isOnRoster && <FootAttendanceButtons myStatus={mine ? mine.status : null} saving={saving} onSet={setMine} compact />}
        {myPlace && <div style={{ marginTop: 10 }}><FChip tone={myPlace.waiting ? "warn" : "good"}>{myPlace.waiting ? `En liste d'attente · n°${myPlace.rank}` : `Confirmé · n°${myPlace.rank}`}</FChip></div>}
        <FBtn variant="ghost" size="sm" onClick={() => setShowAll(!showAll)} style={{ marginTop: 10 }}>{showAll ? "Masquer les réponses" : "Voir les réponses"}</FBtn>
      </FCard>
      {showAll && <FootPresenceCard roster={presenceRoster} rows={rows} min={activity.min_players} isAdmin={isAdmin} onSetPlayer={setPlayer} />}
    </div>
  );
}

function FootAdminPage({ roster, activities, reload }) {
  return (
    <div className="ft-page">
      <FootCreateMatchForm reload={reload} />
      <FootCreateActivityForm reload={reload} />
      <FootActivitiesAdmin activities={activities || []} reload={reload} />
      <FootRosterManager roster={roster} reload={reload} />
    </div>
  );
}

// ---- match detail ----------------------------------------------------------------------------------------------------------------
function footHalfLabel(n) { return n === 1 ? "1re mi-temps" : `${n}e mi-temps`; }

// "1re mi-temps · 17'" — ticks every second while the half is running.
function FootLiveClock({ match }) {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    if (!match.half_started_at) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [match.half_started_at]);
  const secs = computeHalfElapsedSeconds(match.half_started_at, match.half_elapsed_seconds, now);
  const running = !!match.half_started_at;
  const state = running ? formatEventMinute(Math.floor(secs / 60), match.half_duration_min) : match.clock_paused ? `pause (${Math.floor(secs / 60)}')` : secs > 0 ? "terminée" : "à démarrer";
  return (
    <div style={{ textAlign: "center", fontFamily: FF.ui, fontSize: 16, color: FC.deep, marginTop: 4 }}>
      {footHalfLabel(match.current_half || 1)} · {state}
    </div>
  );
}

function FootTeamMark({ name, logo }) {
  const { themeName } = React.useContext(FootCtx);
  const pink = logo && themeName === "pink";
  return (
    <div style={{ textAlign: "center", minWidth: 0 }}>
      {pink
        ? <img src="/logo-bl-rose.png" alt="" style={{ width: 76, height: 54, objectFit: "contain", display: "block", margin: "0 auto 6px" }} />
        : logo
        ? <img src="/logo-bl.png" alt="" style={{ width: 76, height: 54, objectFit: "contain", display: "block", margin: "0 auto 6px" }} />
        : <span style={{ width: 54, height: 54, borderRadius: 27, background: FC.soft, color: FC.deep, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FF.display, fontSize: 21, margin: "0 auto 6px" }}>{playerInitials(name)}</span>}
      <div style={{ fontFamily: FF.ui, fontSize: 16, lineHeight: 1.15, overflowWrap: "anywhere" }}>{name}</div>
    </div>
  );
}

function FootScoreboard({ match, score }) {
  const live = match.status === "live", finished = match.status === "finished";
  const out = finished ? footOutcome(score) : null;
  return (
    <FCard pad={20}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 14 }}>
        {live ? <FChip tone="live">En direct</FChip> : finished ? <FChip tone={FOOT_OUTCOME_TONE[out]}>{FOOT_OUTCOME_LABEL[out]}</FChip> : <FChip tone="accent">À venir</FChip>}
        <span style={{ fontFamily: FF.ui, fontSize: 14, color: FC.muted }}>{footRelative(match.match_datetime)}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8 }}>
        <FootTeamMark name="Bière Leverculsec" logo />
        <div style={{ fontFamily: FF.display, fontSize: live || finished ? 46 : 32, color: FC.deep, whiteSpace: "nowrap", lineHeight: 1 }}>{live || finished ? `${score.bl} – ${score.opponent}` : "VS"}</div>
        <FootTeamMark name={match.opponent_name} />
      </div>
      {live && <FootLiveClock match={match} />}
      <div style={{ height: 1, background: FC.line, margin: "16px 0 12px" }} />
      <FootWhenWhere match={match} />
      <div style={{ marginTop: 10 }}><FootMetaChips match={match} /></div>
    </FCard>
  );
}

function FootStartMatchConfig({ match, roster, attendance, lineups, currentPlayer, reload, onCancel }) {
  const [nbHalves, setNbHalves] = React.useState(2);
  const [halfDuration, setHalfDuration] = React.useState(45);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const presentIds = attendance.filter((a) => a.match_id === match.id && a.status === "present").map((a) => a.player_id);
  const existingSheet = lineupIdsFor(lineups || [], match.id);
  const [sheet, setSheet] = React.useState(existingSheet.length ? existingSheet : presentIds.filter((id) => roster.some((r) => r.player_id === id)));
  const toggle = (id) => setSheet(sheet.includes(id) ? sheet.filter((x) => x !== id) : [...sheet, id]);

  async function start() {
    setSaving(true); setErr(null);
    try {
      await saveLineup(match.id, lineupIdsFor(lineups || [], match.id), sheet);
      await sbUpdate("foot_matches", { id: match.id }, {
        status: "live", started_by: currentPlayer.id, nb_halves: nbHalves, half_duration_min: halfDuration, current_half: 1, half_started_at: null, half_elapsed_seconds: 0,
      });
      await reload();
    } catch (e) {
      console.warn("start match failed", e);
      setErr("Impossible de démarrer : " + e.message);
      setSaving(false);
    }
  }

  return (
    <FCard>
      <FHeading>Lancer le match</FHeading>
      <div style={{ display: "flex", gap: 10 }}>
        <FField label="Mi-temps" style={{ flex: 1 }}>
          <select value={nbHalves} onChange={(e) => setNbHalves(Number(e.target.value))} style={FOOT_INPUT_STYLE}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select>
        </FField>
        <FField label="Durée (min)" style={{ flex: 1 }}>
          <input type="number" min={1} inputMode="numeric" value={halfDuration} onChange={(e) => setHalfDuration(Number(e.target.value))} style={FOOT_INPUT_STYLE} />
        </FField>
      </div>
      <FLabel>Convocation ({sheet.length})</FLabel>
      <div style={{ margin: "0 0 16px" }}><FootLineupChecklist roster={roster} extraIds={existingSheet} checked={sheet} onToggle={toggle} disabled={saving} presence={presenceMap(attendance, match.id)} /></div>
      {err && <FMessage>{err}</FMessage>}
      <div style={{ display: "flex", gap: 10 }}>
        <FBtn variant="ghost" onClick={onCancel} disabled={saving} style={{ flex: 1 }}>Annuler</FBtn>
        <FBtn variant="success" icon="play" onClick={start} disabled={saving} style={{ flex: 2 }}>{saving ? "Démarrage…" : "Coup d'envoi"}</FBtn>
      </div>
    </FCard>
  );
}

function FootEventEditor({ event, defaultHalf, roster, onSave, onCancel }) {
  const [type, setType] = React.useState(event?.type || "goal_bl");
  const [half, setHalf] = React.useState(String(event?.half ?? defaultHalf ?? 1));
  const [minute, setMinute] = React.useState(String(event?.minute ?? 0));
  const [playerId, setPlayerId] = React.useState(event?.own_goal ? "csc" : event?.player_id ? String(event.player_id) : "");
  const [assistId, setAssistId] = React.useState(event?.assist_player_id ? String(event.assist_player_id) : "");
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState(null);

  // Keep a player who has since left the roster selectable when editing their old goal.
  const rosterIds = new Set(roster.map((r) => r.player_id));
  [event?.player_id, event?.assist_player_id].forEach((id) => { if (id) rosterIds.add(id); });
  const options = PLAYERS.filter((p) => rosterIds.has(p.id));

  async function save() {
    let payload;
    try { payload = buildEventPayload({ type, half, minute, playerId, assistId }); } catch (e) { setErr(e.message); return; }
    setSaving(true); setErr(null);
    try { await onSave(payload); } catch (e) { setErr("Erreur : " + e.message); setSaving(false); }
  }

  return (
    <div onClick={(e) => e.stopPropagation()} style={{ background: FC.softer, border: `1.5px solid ${FC.line}`, borderRadius: 18, padding: 14, margin: "8px 0" }}>
      <FSegmented value={type} onChange={setType} options={[["goal_bl", "Nos buts"], ["goal_opponent", "But adverse"]]} style={{ marginBottom: 12 }} />
      <div style={{ display: "flex", gap: 10 }}>
        <FField label="Mi-temps" style={{ flex: 1 }}><input type="number" min={1} inputMode="numeric" value={half} onChange={(e) => setHalf(e.target.value)} style={FOOT_INPUT_STYLE} /></FField>
        <FField label="Minute" style={{ flex: 1 }}><input type="number" min={0} inputMode="numeric" value={minute} onChange={(e) => setMinute(e.target.value)} style={FOOT_INPUT_STYLE} /></FField>
      </div>
      {type === "goal_bl" && (
        <>
          <FField label="Buteur">
            <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} style={FOOT_INPUT_STYLE}>
              <option value="">— Choisir —</option>
              {options.map((p) => <option key={p.id} value={p.id}>{getDisplayName(p, PLAYERS)}</option>)}
              <option value="csc">CSC (but contre son camp)</option>
            </select>
          </FField>
          {playerId !== "csc" && (
            <FField label="Passe décisive (optionnel)">
              <select value={assistId} onChange={(e) => setAssistId(e.target.value)} style={FOOT_INPUT_STYLE}>
                <option value="">— Aucune —</option>
                {options.filter((p) => String(p.id) !== playerId).map((p) => <option key={p.id} value={p.id}>{getDisplayName(p, PLAYERS)}</option>)}
              </select>
            </FField>
          )}
        </>
      )}
      {err && <FMessage>{err}</FMessage>}
      <div style={{ display: "flex", gap: 10 }}>
        <FBtn variant="ghost" onClick={onCancel} disabled={saving} style={{ flex: 1 }}>Annuler</FBtn>
        <FBtn onClick={save} disabled={saving} style={{ flex: 1 }}>{saving ? "…" : "Enregistrer"}</FBtn>
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
    try { await sbFetch("foot_match_events", `?id=eq.${e.id}`, { method: "DELETE" }); await reload(); }
    catch (err) { console.warn("delete event failed", err); }
    setBusyId(null);
  }

  return (
    <div>
      {sorted.length === 0 && <FEmpty icon="ball" title="Aucun but" text="Les buts apparaîtront ici au fil du match." />}
      {sorted.map((e) => {
        if (editingId === e.id) return <FootEventEditor key={e.id} event={e} roster={roster} onSave={(p) => saveEvent(e.id, p)} onCancel={() => setEditingId(null)} />;
        const ours = e.type === "goal_bl";
        return (
          <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${FC.line}` }}>
            <span style={{ flex: "0 0 52px", textAlign: "center" }}>
              <span style={{ display: "block", fontFamily: FF.display, fontSize: 18, color: FC.deep, lineHeight: 1.1 }}>{formatEventMinute(e.minute, match && match.half_duration_min)}</span>
              <span style={{ display: "block", fontSize: 11, color: FC.muted }}>{e.half}{e.half === 1 ? "re" : "e"} MT</span>
            </span>
            {ours && e.own_goal ? <span style={{ width: 36, height: 36, borderRadius: 18, background: FC.accentSoft, color: FC.deep, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: FF.ui, fontSize: 12 }}>CSC</span> : ours ? <FAvatar playerId={e.player_id} name={footNameOf(e.player_id)} size={36} linkable /> : <span style={{ width: 36, height: 36, borderRadius: 18, background: FC.badSoft, color: FC.bad, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><FIcon name="ball" size={18} /></span>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: ours ? FC.text : FC.muted }}>{ours ? (e.own_goal ? "CSC (but contre son camp)" : <FPlayerLink id={e.player_id}>{footNameOf(e.player_id)}</FPlayerLink>) : "But adverse"}</div>
              {ours && e.assist_player_id && <div style={{ fontSize: 13, color: FC.muted }}>Passe de <FPlayerLink id={e.assist_player_id}>{footNameOf(e.assist_player_id)}</FPlayerLink></div>}
            </div>
            {editable && (
              <span style={{ display: "inline-flex" }}>
                <FIconBtn icon="pencil" label="Modifier le but" onClick={() => setEditingId(e.id)} disabled={busyId === e.id} />
                <FIconBtn icon="trash" label="Supprimer le but" tone="danger" onClick={() => deleteEvent(e)} disabled={busyId === e.id} />
              </span>
            )}
          </div>
        );
      })}
      {editable && editingId === "new" && (
        <FootEventEditor defaultHalf={match.current_half || 1} roster={roster} onSave={(p) => saveEvent("new", p)} onCancel={() => setEditingId(null)} />
      )}
      {editable && editingId !== "new" && (
        <FBtn variant="ghost" full size="sm" icon="plus" onClick={() => setEditingId("new")} style={{ marginTop: 10, borderStyle: "dashed" }}>Ajouter un but</FBtn>
      )}
    </div>
  );
}

function FootGoalPicker({ roster, onConfirm, onCancel, withAssist, busy }) {
  const [playerId, setPlayerId] = React.useState("");
  const [assistId, setAssistId] = React.useState("");
  const options = roster.map((r) => PLAYERS.find((p) => p.id === r.player_id)).filter(Boolean);
  const can = canConfirmGoal(playerId, busy);
  return (
    <div style={{ background: FC.softer, border: `1.5px solid ${FC.line}`, borderRadius: 18, padding: 14, marginTop: 10 }}>
      <FField label="Buteur">
        <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} style={FOOT_INPUT_STYLE}>
          <option value="">— Choisir —</option>
          {options.map((p) => <option key={p.id} value={p.id}>{getDisplayName(p, PLAYERS)}</option>)}
          <option value="csc">CSC (but contre son camp)</option>
        </select>
      </FField>
      {withAssist && playerId !== "csc" && (
        <FField label="Passe décisive (optionnel)">
          <select value={assistId} onChange={(e) => setAssistId(e.target.value)} style={FOOT_INPUT_STYLE}>
            <option value="">— Aucune —</option>
            {options.filter((p) => String(p.id) !== playerId).map((p) => <option key={p.id} value={p.id}>{getDisplayName(p, PLAYERS)}</option>)}
          </select>
        </FField>
      )}
      <div style={{ display: "flex", gap: 10 }}>
        <FBtn variant="ghost" onClick={onCancel} style={{ flex: 1 }}>Annuler</FBtn>
        <FBtn icon="check" onClick={() => can && onConfirm(playerId === "csc" ? "csc" : Number(playerId), playerId !== "csc" && assistId ? Number(assistId) : null)} disabled={!can} style={{ flex: 1 }}>Valider</FBtn>
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
  const paused = !running && !!match.clock_paused;
  const clock = formatMatchClock(elapsedSeconds, match.half_duration_min);

  async function logGoal(type, playerId, assistId) {
    setBusy(true);
    try {
      const own = playerId === "csc";
      const scorer = own ? null : playerId;
      await saveGoalWithSheet(lineupIdsFor(lineups || [], match.id), { type, player_id: scorer, assist_player_id: assistId }, {
        addToSheet: (ids) => addToLineup(match.id, ids),
        writeGoal: () => sbInsert("foot_match_events", { match_id: match.id, half: match.current_half, minute: minutesElapsed, type, player_id: scorer, assist_player_id: assistId, own_goal: own }),
      });
      setPicking(null);
      await reload();
    } catch (e) { console.warn("log goal failed", e); }
    setBusy(false);
  }

  async function startHalf() {
    setBusy(true);
    try { await sbUpdate("foot_matches", { id: match.id }, { half_started_at: new Date().toISOString(), clock_paused: false }); await reload(); }
    catch (e) { console.warn(e); }
    setBusy(false);
  }

  // Freezes the clock without ending the half; "Reprendre" (startHalf) carries on from the frozen time.
  async function pauseClock() {
    setBusy(true);
    try {
      const frozenElapsed = computeHalfElapsedSeconds(match.half_started_at, match.half_elapsed_seconds, Date.now());
      await sbUpdate("foot_matches", { id: match.id }, { half_elapsed_seconds: frozenElapsed, half_started_at: null, clock_paused: true });
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
        await sbUpdate("foot_matches", { id: match.id }, { half_elapsed_seconds: 0, half_started_at: null, clock_paused: false, current_half: next.half });
      } else {
        await sbUpdate("foot_matches", { id: match.id }, { half_elapsed_seconds: frozenElapsed, half_started_at: null, clock_paused: false });
      }
      await reload();
    } catch (e) { console.warn(e); }
    setBusy(false);
  }

  async function closeMatch() {
    setBusy(true);
    try { await sbUpdate("foot_matches", { id: match.id }, { status: "finished", half_started_at: null, clock_paused: false }); await reload(); }
    catch (e) { console.warn(e); setBusy(false); }
  }

  const isLastHalf = match.current_half >= match.nb_halves;
  const liveAction = nextLiveAction(running, isLastHalf, match.half_elapsed_seconds, paused);

  return (
    <FCard style={{ border: `2px solid ${FC.accent}` }}>
      <FHeading right={<FChip tone="accent">Console admin</FChip>}>{footHalfLabel(match.current_half)} <span style={{ fontFamily: FF.ui, fontSize: 15, color: FC.muted }}>/ {match.nb_halves}</span></FHeading>
      <div style={{ textAlign: "center", margin: "2px 0 14px", opacity: paused ? 0.55 : 1 }}>
        <div style={{ fontFamily: FF.display, fontSize: 60, lineHeight: 1.1, color: FC.deep, fontVariantNumeric: "tabular-nums" }}>
          {clock.main}{clock.extra && <span style={{ fontSize: 34, color: FC.bad, marginLeft: 8 }}>{clock.extra}</span>}
        </div>
        {clock.extra && <div style={{ fontFamily: FF.ui, fontSize: 13, color: FC.bad }}>Temps additionnel : le chrono continue jusqu'à ce que tu termines la mi-temps</div>}
        {paused && <div style={{ fontFamily: FF.ui, fontSize: 14, color: FC.muted }}>Chrono en pause</div>}
      </div>

      {liveAction === "start" && <FBtn variant="success" size="lg" full icon="play" disabled={busy} onClick={startHalf}>Démarrer la mi-temps</FBtn>}

      {(liveAction === "playing" || liveAction === "paused") && (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <FBtn size="lg" icon="ball" disabled={busy} onClick={() => setPicking("bl")} style={{ flex: 1 }}>But BL</FBtn>
            <FBtn variant="ghost" size="lg" icon="ball" disabled={busy} onClick={() => logGoal("goal_opponent", null, null)} style={{ flex: 1 }}>But adverse</FBtn>
          </div>
          {picking === "bl" && <FootGoalPicker roster={roster} withAssist busy={busy} onCancel={() => setPicking(null)} onConfirm={(playerId, assistId) => logGoal("goal_bl", playerId, assistId)} />}
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            {paused
              ? <FBtn variant="success" icon="play" disabled={busy} onClick={startHalf} style={{ flex: 1 }}>Reprendre</FBtn>
              : <FBtn variant="ghost" icon="pause" disabled={busy} onClick={pauseClock} style={{ flex: 1 }}>Pause</FBtn>}
            <FBtn variant="secondary" icon="flag" disabled={busy} onClick={endHalf} style={{ flex: 1 }}>{isLastHalf ? "Fin du match" : "Fin de la mi-temps"}</FBtn>
          </div>
        </>
      )}

      {liveAction === "close" && <FBtn variant="danger" size="lg" full icon="flag" disabled={busy} onClick={closeMatch}>Clôturer le match</FBtn>}
    </FCard>
  );
}

function FootLiveView({ match, roster, events, lineups, attendance, currentPlayer, isAdmin, reload, extra }) {
  const matchEvents = events.filter((e) => e.match_id === match.id);
  const score = computeFootScore(matchEvents);
  return (
    <div className="ft-page">
      <FootScoreboard match={match} score={score} />
      {extra}
      <FootLineupSection match={match} roster={roster} lineups={lineups} attendance={attendance} isAdmin={false} reload={reload} />
      {isAdmin && <FootLiveAdminConsole match={match} roster={roster} events={matchEvents} lineups={lineups} reload={reload} />}
      <FCard>
        <FHeading>Buts</FHeading>
        <FootEventTimeline events={matchEvents} editable={isAdmin} match={match} roster={roster} lineups={lineups} reload={reload} />
      </FCard>
    </div>
  );
}

const FOOT_SCORE_OPTIONS = Array.from({ length: 19 }, (_, i) => 1 + i * 0.5);

// Tap the face of the best player of the match.
function FootMotmPicker({ ids, value, onPick, disabled }) {
  return (
    <div role="radiogroup" aria-label="Homme du match" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 8 }}>
      {ids.map((id) => {
        const on = value === id;
        return (
          <button key={id} role="radio" aria-checked={on} disabled={disabled} onClick={() => onPick(id)}
            style={{ border: `2px solid ${on ? FC.accent : "transparent"}`, background: on ? FC.accentSoft : FC.softer, borderRadius: 18, padding: "8px 4px 6px", cursor: disabled ? "default" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 0, color: FC.text }}>
            <span style={{ position: "relative", display: "inline-flex" }}>
              <FAvatar playerId={id} name={footNameOf(id)} size={52} ring={on ? FC.accent : undefined} />
              {on && <span style={{ position: "absolute", right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11, background: FC.accent, color: "#fff", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center" }}><FIcon name="check" size={13} stroke={3} /></span>}
            </span>
            <span style={{ fontFamily: FF.ui, fontSize: 12, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{footNameOf(id)}</span>
          </button>
        );
      })}
    </div>
  );
}

function FootRatingsTab({ match, lineups, ratings, motmVotes, currentPlayer, isAdmin, reload }) {
  const sheetIds = lineupIdsFor(lineups, match.id);
  const mr = ratings.filter((r) => r.match_id === match.id);
  const progress = ratingProgress(sheetIds, mr);
  const averages = finalAverages(match, sheetIds, mr);
  const validated = !!match.ratings_validated_at;
  const me = currentPlayer?.id;
  const isVoter = sheetIds.includes(me);
  const hasVoted = progress.doneIds.includes(me);
  const mine = Object.fromEntries(mr.filter((r) => r.rater_id === me).map((r) => [r.ratee_id, String(r.score)]));
  const myMotm = (motmVotes || []).find((v) => v.match_id === match.id && v.voter_id === me);
  const [motm, setMotm] = React.useState(myMotm ? myMotm.player_id : null);
  const winners = validated ? (motmWinners([match], motmVotes || [])[match.id] || []) : [];
  const [editing, setEditing] = React.useState(isVoter && !hasVoted && !validated);
  const [scores, setScores] = React.useState(mine);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const nameOf = footNameOf;

  async function save() {
    let rows;
    try { rows = buildRatingPayload(match.id, me, sheetIds, scores); } catch (e) { setErr(e.message); return; }
    if (!motm) { setErr("Choisis ton homme du match en touchant son visage."); return; }
    setBusy(true); setErr(null);
    try {
      const result = await submitRatings({
        isValidated: async () => !!((await sbFetch("foot_matches", `?id=eq.${match.id}&select=ratings_validated_at`)) || [])[0]?.ratings_validated_at,
        writeRatings: async () => {
          assertUpsertOk(await SUPABASE.from("foot_motm_votes").upsert({ match_id: match.id, voter_id: me, player_id: motm, updated_at: new Date().toISOString() }, { onConflict: "match_id,voter_id" }));
          assertUpsertOk(await SUPABASE.from("foot_ratings").upsert(rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })), { onConflict: "match_id,rater_id,ratee_id" }));
        },
      });
      if (result === "closed") setErr("Les notes de ce match ont déjà été validées, tes notes n'ont pas été enregistrées.");
      setEditing(false);
      await reload();
    } catch (e) { setErr("Erreur : " + e.message); }
    setBusy(false);
  }

  async function forceValidate() {
    if (!window.confirm("Valider les notes avec les votes déjà faits ? Les joueurs ne pourront plus les modifier.")) return;
    setBusy(true);
    try { await sbUpdate("foot_matches", { id: match.id }, { ratings_validated_at: new Date().toISOString() }); await reload(); }
    catch (e) { setErr("Erreur : " + e.message); }
    setBusy(false);
  }

  if (sheetIds.length < 2) return <FCard><FEmpty icon="star" title="Pas de notes" text="Il faut au moins deux joueurs sur la convocation pour noter." /></FCard>;

  const view = ratingsTabView({ validated, isVoter, hasVoted, editing, isAdmin });
  const ranked = sheetIds.map((id) => ({ id, avg: averages[id] })).sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));

  return (
    <FCard>
      <FHeading right={validated ? <FChip tone="good" icon="check">Validées</FChip> : <FChip tone="soft">{progress.doneIds.length} / {sheetIds.length} ont voté</FChip>}>Notes du match</FHeading>

      {view.showForm && (
        <div style={{ marginBottom: 14 }}>
          <FLabel>Ton homme du match</FLabel>
          <div style={{ marginBottom: 14 }}><FootMotmPicker ids={sheetIds.filter((id) => id !== me)} value={motm} onPick={setMotm} disabled={busy} /></div>
          <FLabel>Les notes</FLabel>
          {sheetIds.filter((id) => id !== me).map((id) => (
            <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: `1px solid ${FC.line}` }}>
              <FAvatar playerId={id} name={nameOf(id)} size={34} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nameOf(id)}</span>
              <select value={scores[id] ?? ""} disabled={busy} onChange={(e) => setScores({ ...scores, [id]: e.target.value })} aria-label={`Note pour ${nameOf(id)}`} style={{ ...FOOT_SELECT_STYLE, minWidth: 82 }}>
                <option value="">—</option>
                {FOOT_SCORE_OPTIONS.map((s) => <option key={s} value={String(s)}>{s.toFixed(1)}</option>)}
              </select>
            </div>
          ))}
          <FBtn full size="lg" onClick={save} disabled={busy} style={{ marginTop: 12 }}>{busy ? "…" : "Enregistrer mes notes"}</FBtn>
        </div>
      )}

      {err && <FMessage>{err}</FMessage>}

      {view.showEditButton && <FBtn size="sm" variant="secondary" icon="pencil" onClick={() => { setScores(mine); setErr(null); setEditing(true); }} style={{ marginBottom: 12 }}>{view.editLabel}</FBtn>}

      {winners.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: FC.accentSoft, borderRadius: 18, padding: "10px 12px", marginBottom: 12 }}>
          <div style={{ display: "flex" }}>{winners.map((id, i) => <span key={id} style={{ marginLeft: i ? -10 : 0 }}><FAvatar playerId={id} name={footNameOf(id)} size={52} ring={FC.accent} linkable /></span>)}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: FF.ui, fontSize: 12, color: FC.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Homme du match</div>
            <div style={{ fontFamily: FF.display, fontSize: 22, color: FC.deep, lineHeight: 1.15, overflowWrap: "anywhere" }}>{winners.map(footNameOf).join(" · ")}</div>
          </div>
        </div>
      )}

      {view.showAverages && ranked.map(({ id, avg }, i) => (
        <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: `1px solid ${FC.line}` }}>
          <span style={{ width: 22, textAlign: "center", fontFamily: FF.display, fontSize: 16, color: i < 3 ? FC.deep : FC.muted }}>{i + 1}</span>
          <FAvatar playerId={id} name={nameOf(id)} size={34} linkable />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><FPlayerLink id={id}>{nameOf(id)}</FPlayerLink></div>
            <div style={{ height: 6, borderRadius: 3, background: FC.soft, marginTop: 4 }}><div style={{ width: `${avg == null ? 0 : Math.max(4, (avg / 10) * 100)}%`, height: "100%", borderRadius: 3, background: FC.accent }} /></div>
          </div>
          <span style={{ fontFamily: FF.display, fontSize: 22, color: FC.deep, minWidth: 42, textAlign: "right" }}>{avg == null ? "—" : avg.toFixed(1)}</span>
        </div>
      ))}
      {view.showHiddenMessage && <FMessage tone="warn">{isVoter ? "Note tes coéquipiers pour voir les moyennes, ou attends la validation par le bureau." : "Les notes restent cachées jusqu'à leur validation par le bureau."}</FMessage>}

      {!validated && progress.pendingIds.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 13, color: FC.muted }}>Pas encore voté : {progress.pendingIds.map(nameOf).join(" · ")}</div>
      )}

      {isAdmin && !validated && <FBtn variant="success" full size="sm" onClick={forceValidate} disabled={busy} style={{ marginTop: 12 }}>Valider les notes</FBtn>}
      {isAdmin && <FootRatingsAdminPanel match={match} sheetIds={sheetIds} reload={reload} />}
    </FCard>
  );
}

// Bureau only, write-only: an admin can set any player's votes and final notes but never reads what is already there.
function FootRatingsAdminPanel({ match, sheetIds, reload }) {
  const [open, setOpen] = React.useState(false);
  const [rater, setRater] = React.useState(sheetIds[0]);
  const [scores, setScores] = React.useState({});
  const [finals, setFinals] = React.useState({});
  const [resets, setResets] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const clear = () => { setScores({}); setFinals({}); setResets([]); };
  React.useEffect(() => { setScores({}); }, [rater, open]);
  React.useEffect(() => { setFinals({}); setResets([]); }, [open]);
  if (!open) return <FBtn variant="secondary" full size="sm" icon="sliders" onClick={() => setOpen(true)} style={{ marginTop: 10 }}>Corriger des notes (bureau)</FBtn>;

  async function saveVotes() {
    const rows = sheetIds.filter((id) => id !== rater && scores[id] !== undefined && scores[id] !== "").map((id) => ({ match_id: match.id, rater_id: rater, ratee_id: id, score: Number(scores[id]), updated_at: new Date().toISOString() }));
    if (!rows.length) { setMsg({ t: "error", m: "Choisis au moins une note à enregistrer." }); return; }
    setBusy(true); setMsg(null);
    try {
      assertUpsertOk(await SUPABASE.from("foot_ratings").upsert(rows, { onConflict: "match_id,rater_id,ratee_id" }));
      await reload(); setScores({}); setMsg({ t: "success", m: `${rows.length} note${rows.length > 1 ? "s" : ""} enregistrée${rows.length > 1 ? "s" : ""} ✓` });
    } catch (e) { setMsg({ t: "error", m: "Erreur : " + e.message }); }
    setBusy(false);
  }
  async function saveFinals() {
    let next;
    try { next = mergeFinalNotes(match.rating_overrides, finals, resets); }
    catch (e) { setMsg({ t: "error", m: e.message }); return; }
    if (!Object.values(finals).some((v) => String(v || "").trim() !== "") && !resets.length) { setMsg({ t: "error", m: "Écris au moins une note finale (ou remets un joueur en auto)." }); return; }
    setBusy(true); setMsg(null);
    try { await sbUpdate("foot_matches", { id: match.id }, { rating_overrides: next, ratings_validated_at: match.ratings_validated_at || new Date().toISOString() }); await reload(); setFinals({}); setResets([]); setMsg({ t: "success", m: "Notes finales enregistrées et validées ✓" }); }
    catch (e) { setMsg({ t: "error", m: "Erreur : " + e.message }); }
    setBusy(false);
  }
  const opts = FOOT_SCORE_OPTIONS.map((x) => <option key={x} value={String(x)}>{x.toFixed(1)}</option>);
  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${FC.line}` }}>
      <FHeading right={<FBtn size="sm" variant="ghost" onClick={() => { clear(); setOpen(false); }}>Fermer</FBtn>}>Corriger des notes</FHeading>
      <div style={{ fontSize: 13, color: FC.muted, marginBottom: 10, lineHeight: 1.4 }}>Tu peux modifier des notes sans jamais voir celles déjà enregistrées. Seules les cases remplies sont écrasées.</div>
      <FField label="Notes données par">
        <select value={rater} onChange={(e) => setRater(Number(e.target.value))} style={FOOT_SELECT_STYLE}>{sheetIds.map((id) => <option key={id} value={id}>{footNameOf(id)}</option>)}</select>
      </FField>
      {sheetIds.filter((id) => id !== rater).map((id) => (
        <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderTop: `1px solid ${FC.line}` }}>
          <span style={{ flex: 1, fontSize: 15 }}>{footNameOf(id)}</span>
          <select value={scores[id] ?? ""} disabled={busy} onChange={(e) => setScores({ ...scores, [id]: e.target.value })} aria-label={`Nouvelle note de ${footNameOf(rater)} pour ${footNameOf(id)}`} style={{ ...FOOT_SELECT_STYLE, minWidth: 96 }}><option value="">Inchangée</option>{opts}</select>
        </div>
      ))}
      <FBtn full size="sm" onClick={saveVotes} disabled={busy} style={{ margin: "10px 0 16px" }}>Enregistrer les notes de {footNameOf(rater)}</FBtn>
      <div style={{ fontFamily: FF.ui, fontSize: 16, marginBottom: 4 }}>Note finale par joueur</div>
      <div style={{ fontSize: 13, color: FC.muted, marginBottom: 6, lineHeight: 1.4 }}>Écris la note (ex : 6.1) ou remets « auto » (moyenne des votes). Enregistrer valide les notes : plus personne ne peut voter et tout le monde les voit.</div>
      {sheetIds.map((id) => (
        <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: `1px solid ${FC.line}` }}>
          <span style={{ flex: 1, fontSize: 15 }}>{footNameOf(id)}</span>
          <button disabled={busy} onClick={() => { setResets(resets.includes(id) ? resets.filter((x) => x !== id) : [...resets, id]); setFinals({ ...finals, [id]: "" }); }} aria-pressed={resets.includes(id)} style={{ border: `1.5px solid ${resets.includes(id) ? FC.accent : FC.line}`, background: resets.includes(id) ? FC.accentSoft : "transparent", color: resets.includes(id) ? FC.deep : FC.muted, borderRadius: 12, padding: "6px 9px", fontFamily: FF.ui, fontSize: 12, cursor: "pointer" }}>Auto</button>
          <input type="text" inputMode="decimal" placeholder="Inchangée" value={finals[id] ?? ""} disabled={busy || resets.includes(id)} onChange={(e) => setFinals({ ...finals, [id]: e.target.value })} aria-label={`Note finale de ${footNameOf(id)}`} style={{ ...FOOT_INPUT_STYLE, width: 96, textAlign: "center" }} />
        </div>
      ))}
      <FBtn full size="sm" onClick={saveFinals} disabled={busy} style={{ marginTop: 10 }}>Enregistrer et valider les notes finales</FBtn>
      {msg && <FMessage tone={msg.t === "error" ? "bad" : "good"} style={{ marginTop: 10 }}>{msg.m}</FMessage>}
    </div>
  );
}

function FootFinishedView({ match, roster, events, lineups, attendance, ratings, motmVotes, currentPlayer, isAdmin, reload, extra }) {
  const [tab, setTab] = React.useState("resume");
  const matchEvents = events.filter((e) => e.match_id === match.id);
  const score = computeFootScore(matchEvents);
  return (
    <div className="ft-page">
      <FootScoreboard match={match} score={score} />
      {extra}
      <FSegmented value={tab} onChange={setTab} options={[["resume", "Résumé", "ball"], ["notes", "Notes", "star"]]} style={{ marginBottom: 14, background: "rgba(255,255,255,0.92)" }} />
      {tab === "resume" && (
        <>
          <FootLineupSection match={match} roster={roster} lineups={lineups} attendance={attendance} isAdmin={false} reload={reload} />
          <FCard>
            <FHeading>Buts</FHeading>
            <FootEventTimeline events={matchEvents} editable={isAdmin} match={match} roster={roster} lineups={lineups} reload={reload} />
          </FCard>
        </>
      )}
      {tab === "notes" && <FootRatingsTab match={match} lineups={lineups} ratings={ratings || []} motmVotes={motmVotes || []} currentPlayer={currentPlayer} isAdmin={isAdmin} reload={reload} />}
    </div>
  );
}

// Answers to a match or an activity: who is in (in order of answer), who waits, who is absent, who has not answered.
// `onSetPlayer(playerId, "present" | "absent" | null)` lets an admin set or clear anybody's answer.
function FootPresenceCard({ roster, rows, min, isAdmin, onSetPlayer, emptyText }) {
  const [editing, setEditing] = React.useState(false);
  const [busyId, setBusyId] = React.useState(null);
  const q = computeAttendanceQueue(roster, rows, min);
  const sections = [["Présents", q.confirmed, "good"], ["Liste d'attente", q.waiting, "warn"], ["Pas de réponse", q.noResponse, "plain"], ["Absents", q.absent, "bad"]];
  const rankOf = Object.fromEntries(q.order.map((o) => [o.playerId, o.rank]));
  const statusOf = Object.fromEntries(rows.map((r) => [r.player_id, r.status]));
  async function set(id, status) {
    setBusyId(id);
    try { await onSetPlayer(id, status); } catch (e) { console.warn("presence update failed", e); }
    setBusyId(null);
  }
  const names = [...roster].map((r) => r.player_id).sort((a, b) => footNameOf(a).localeCompare(footNameOf(b)));
  return (
    <FCard>
      <FHeading right={<FChip tone={q.min && q.confirmed.length >= q.min ? "good" : "soft"}>{q.confirmed.length} / {q.min || roster.length}</FChip>}>Présences</FHeading>
      {roster.length === 0 ? <FEmpty icon="users" title="Effectif vide" text={emptyText || "Ajoute des joueurs à l'effectif dans l'onglet Admin."} /> : (
        <>
          {q.min && <div style={{ fontSize: 13, color: FC.muted, marginBottom: 10 }}>Minimum {q.min} joueurs{q.waiting.length ? ` · ${q.waiting.length} en liste d'attente` : ""}. Classés par ordre de réponse.</div>}
          {sections.map(([label, ids, tone]) => (ids.length > 0 || label === "Présents") && (
            <div key={label} style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 6 }}><FChip tone={tone}>{label} · {ids.length}</FChip></div>
              {ids.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ids.map((id) => (
                    <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 4, maxWidth: "100%" }}>
                      {rankOf[id] && <span style={{ fontFamily: FF.ui, fontSize: 12, color: FC.muted, minWidth: 18, textAlign: "right" }}>{rankOf[id]}.</span>}
                      <FootPlayerPill id={id} tone="line" dim={tone === "plain"} />
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {isAdmin && (
            <>
              <FBtn variant="secondary" size="sm" icon="pencil" onClick={() => setEditing(!editing)} style={{ marginTop: 4 }}>{editing ? "Fermer" : "Modifier les présences"}</FBtn>
              {editing && (
                <div style={{ marginTop: 10 }}>
                  {names.map((id) => (
                    <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: `1px solid ${FC.line}` }}>
                      <FAvatar playerId={id} name={footNameOf(id)} size={30} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{footNameOf(id)}{rankOf[id] ? <span style={{ color: FC.muted, fontSize: 12 }}> · {q.waiting.includes(id) ? "attente " : "n°"}{rankOf[id]}</span> : null}</span>
                      {[["present", "Présent", "good"], ["absent", "Absent", "bad"], [null, "—", "plain"]].map(([st, lab, tone]) => {
                        const on = (statusOf[id] || null) === st;
                        return <button key={lab} disabled={busyId === id} onClick={() => !on && set(id, st)} aria-pressed={on} aria-label={`${footNameOf(id)} : ${st === null ? "pas de réponse" : lab}`}
                          style={{ border: `1.5px solid ${on ? (tone === "good" ? FC.good : tone === "bad" ? FC.bad : FC.muted) : FC.line}`, background: on ? (tone === "good" ? FC.goodSoft : tone === "bad" ? FC.badSoft : FC.soft) : "transparent", color: on ? (tone === "good" ? FC.good : tone === "bad" ? FC.bad : FC.text) : FC.muted, borderRadius: 12, padding: "6px 9px", fontFamily: FF.ui, fontSize: 12, cursor: "pointer", minWidth: 40 }}>{lab}</button>;
                      })}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </FCard>
  );
}

// ---- ball keepers (2 players bring and bring back the balls) ------------------------------------------------------------------
function FootBallKeepersCard({ match, matches, roster, canEdit, reload }) {
  const [editing, setEditing] = React.useState(false);
  const [picked, setPicked] = React.useState(match.ball_keepers || []);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const season = seasonOf(match.match_datetime);
  const counts = ballKeeperCounts(matches.filter((m) => seasonOf(m.match_datetime) === season));
  const keepers = match.ball_keepers || [];
  const pool = attendanceRoster(roster).map((r) => r.player_id)
    .sort((a, b) => (counts[a] || 0) - (counts[b] || 0) || footNameOf(a).localeCompare(footNameOf(b)));
  const times = (id) => { const n = counts[id] || 0; return `${n} fois cette saison`; };
  const toggle = (id) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : picked.length < 2 ? [...picked, id] : picked);
  async function save() {
    setBusy(true); setErr(null);
    try { await sbUpdate("foot_matches", { id: match.id }, { ball_keepers: picked }); await reload(); setEditing(false); }
    catch (e) { setErr("Enregistrement impossible : " + e.message); }
    setBusy(false);
  }
  return (
    <FCard style={{ border: `2px solid ${FC.accent}` }}>
      <FHeading right={canEdit && !editing && <FBtn size="sm" variant="secondary" icon="pencil" onClick={() => { setPicked(keepers); setErr(null); setEditing(true); }}>{keepers.length ? "Changer" : "Choisir"}</FBtn>}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><FIcon name="ball" size={22} />Responsables ballons</span>
      </FHeading>
      {!editing && (keepers.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          {keepers.map((id) => (
            <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, background: FC.accentSoft, borderRadius: 18, padding: "10px 12px", minWidth: 0 }}>
              <FAvatar playerId={id} name={footNameOf(id)} size={44} linkable />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: FF.ui, fontSize: 17, overflowWrap: "anywhere" }}><FPlayerLink id={id}>{footNameOf(id)}</FPlayerLink></div>
                <div style={{ fontSize: 12, color: FC.muted }}>{times(id)}</div>
              </div>
            </div>
          ))}
        </div>
      ) : <FEmpty icon="ball" title="Pas encore désignés" text={canEdit ? "Choisis les 2 joueurs qui s'occupent des ballons pour ce match." : "Le bureau choisira 2 joueurs pour les ballons."} />)}
      {editing && (
        <>
          <div style={{ fontSize: 13, color: FC.muted, marginBottom: 8 }}>Choisis 2 joueurs ({picked.length} / 2). Ceux qui l'ont fait le moins souvent sont en haut.</div>
          <div style={{ display: "grid", gap: 6 }}>
            {pool.map((id) => {
              const on = picked.includes(id);
              const full = !on && picked.length >= 2;
              return (
                <label key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px 6px 6px", borderRadius: 16, background: on ? FC.accentSoft : FC.softer, border: `1.5px solid ${on ? FC.accent : "transparent"}`, opacity: full ? 0.55 : 1, cursor: full || busy ? "default" : "pointer", fontSize: 15 }}>
                  <FAvatar playerId={id} name={footNameOf(id)} size={34} />
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{footNameOf(id)}</span>
                  <span style={{ fontFamily: FF.ui, fontSize: 13, color: FC.deep }}>{counts[id] || 0}×</span>
                  <input type="checkbox" checked={on} disabled={full || busy} onChange={() => toggle(id)} aria-label={`${footNameOf(id)} responsable ballons`} />
                </label>
              );
            })}
          </div>
          {err && <FMessage style={{ marginTop: 10 }}>{err}</FMessage>}
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <FBtn variant="ghost" onClick={() => setEditing(false)} disabled={busy} style={{ flex: 1 }}>Annuler</FBtn>
            <FBtn onClick={save} disabled={busy} style={{ flex: 1 }}>{busy ? "…" : `Enregistrer (${picked.length})`}</FBtn>
          </div>
        </>
      )}
    </FCard>
  );
}

function FootScheduledView({ match, roster, attendance, lineups, currentPlayer, isAdmin, canStart, reload, onStartMatch, extra }) {
  const matchAttendance = attendance.filter((a) => a.match_id === match.id);
  const presenceRoster = attendanceRoster(roster);
  const queue = computeAttendanceQueue(presenceRoster, matchAttendance, match.min_players);
  const isOnRoster = presenceRoster.some((r) => r.player_id === currentPlayer?.id);
  const myStatus = matchAttendance.find((a) => a.player_id === currentPlayer?.id)?.status || null;
  const myPlace = queue.order.find((o) => o.playerId === currentPlayer?.id);
  const [saving, setSaving] = React.useState(false);

  async function setMyStatus(status) {
    setSaving(true);
    try { await setMatchAttendance(match.id, currentPlayer.id, status); await reload(); }
    catch (e) { console.warn("attendance update failed", e); }
    setSaving(false);
  }

  const setPlayer = async (id, status) => { if (status === null) await clearMatchAttendance(match.id, id); else await setMatchAttendance(match.id, id, status); await reload(); };
  return (
    <div className="ft-page">
      <FootScoreboard match={match} score={{ bl: 0, opponent: 0 }} />
      {extra}

      <FootLineupSection match={match} roster={roster} lineups={lineups || []} attendance={attendance} isAdmin={isAdmin} reload={reload} />

      {isOnRoster && (
        <FCard>
          <FHeading>Ma présence</FHeading>
          <FootAttendanceButtons myStatus={myStatus} saving={saving} onSet={setMyStatus} />
          {myPlace && <div style={{ marginTop: 10 }}><FChip tone={myPlace.waiting ? "warn" : "good"}>{myPlace.waiting ? `En liste d'attente · n°${myPlace.rank}` : `Confirmé · n°${myPlace.rank}`}</FChip></div>}
        </FCard>
      )}

      <FootPresenceCard roster={presenceRoster} rows={matchAttendance} min={match.min_players} isAdmin={isAdmin} onSetPlayer={setPlayer} />

      {canStart && <FBtn variant="success" size="lg" full icon="play" onClick={onStartMatch}>Commencer le match</FBtn>}
    </div>
  );
}

function FootMatchDetailPage({ matchId, matches, roster, attendance, events, lineups, ratings, motmVotes, currentPlayer, navBack, reload }) {
  const match = matches.find((m) => m.id === matchId);
  const isAdmin = canEditMatch(match, currentPlayer);
  const canStart = canStartMatch(match, currentPlayer);
  const [startingConfig, setStartingConfig] = React.useState(false);
  const [editingInfo, setEditingInfo] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);

  if (!match) return <FCard><FEmpty icon="calendar" title="Match introuvable" action={<FBtn onClick={navBack}>Retour aux matchs</FBtn>} /></FCard>;

  const canReset = isBureau(currentPlayer) && match.status !== "scheduled";
  const balls = <FootBallKeepersCard match={match} matches={matches} roster={roster} canEdit={isBureau(currentPlayer)} reload={reload} />;
  async function resetMatch() {
    if (!window.confirm(`Remettre le match contre ${match.opponent_name} à « pas joué » ?\n\nLes buts, le chrono et les notes seront supprimés. La convocation et les présences sont conservées.`)) return;
    setResetting(true);
    try {
      await sbFetch("foot_match_events", `?match_id=eq.${match.id}`, { method: "DELETE" });
      await sbFetch("foot_ratings", `?match_id=eq.${match.id}`, { method: "DELETE" });
      await sbUpdate("foot_matches", { id: match.id }, { status: "scheduled", nb_halves: null, half_duration_min: null, current_half: null, half_started_at: null, half_elapsed_seconds: 0, clock_paused: false, started_by: null, ratings_validated_at: null, rating_overrides: {} });
      setStartingConfig(false);
      await reload();
    } catch (e) { console.warn("reset match failed", e); window.alert("Impossible de remettre le match à zéro : " + e.message); }
    setResetting(false);
  }

  async function deleteMatch() {
    if (!window.confirm(`Supprimer définitivement le match contre ${match.opponent_name} ? Les buts et présences associés seront aussi supprimés.`)) return;
    setDeleting(true);
    try { await sbFetch("foot_matches", `?id=eq.${match.id}`, { method: "DELETE" }); await reload(); navBack(); }
    catch (e) { console.warn("delete match failed", e); setDeleting(false); }
  }

  return (
    <div>
      {match.status === "scheduled" && !startingConfig && (
        <FootScheduledView match={match} roster={roster} attendance={attendance} lineups={lineups} currentPlayer={currentPlayer} isAdmin={isAdmin} canStart={canStart} reload={reload} onStartMatch={() => setStartingConfig(true)} extra={balls} />
      )}
      {match.status === "scheduled" && startingConfig && (
        <>
          <FootScoreboard match={match} score={{ bl: 0, opponent: 0 }} />
          <FootStartMatchConfig match={match} roster={roster} attendance={attendance} lineups={lineups} currentPlayer={currentPlayer} reload={reload} onCancel={() => setStartingConfig(false)} />
        </>
      )}
      {match.status === "live" && <FootLiveView match={match} roster={roster} events={events} lineups={lineups} attendance={attendance} currentPlayer={currentPlayer} isAdmin={isAdmin} reload={reload} extra={balls} />}
      {match.status === "finished" && <FootFinishedView match={match} roster={roster} events={events} lineups={lineups} attendance={attendance} ratings={ratings} motmVotes={motmVotes} currentPlayer={currentPlayer} isAdmin={isAdmin} reload={reload} extra={balls} />}

      {isAdmin && (
        <>
          {editingInfo ? (
            <FootMatchForm title="Modifier le match" submitLabel="Enregistrer" initial={match} onCancel={() => setEditingInfo(false)}
              onSubmit={async (data) => { await sbUpdate("foot_matches", { id: match.id }, data); await reload(); setEditingInfo(false); }} />
          ) : (
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <FBtn variant="secondary" icon="pencil" onClick={() => setEditingInfo(true)} disabled={deleting} style={{ flex: 1 }}>Modifier</FBtn>
              <FBtn variant="ghost" icon="trash" onClick={deleteMatch} disabled={deleting} style={{ flex: 1, color: FC.bad, borderColor: withAlpha(FC.bad, 0.4), background: "rgba(255,255,255,0.9)" }}>{deleting ? "…" : "Supprimer"}</FBtn>
            </div>
          )}
        </>
      )}
      {canReset && <FBtn variant="ghost" full icon="refresh" onClick={resetMatch} disabled={resetting} style={{ marginTop: 10, color: FC.bad, borderColor: withAlpha(FC.bad, 0.4), background: "rgba(255,255,255,0.9)" }}>{resetting ? "Remise à zéro…" : "Remettre le match à « pas joué »"}</FBtn>}
    </div>
  );
}

// ---- stats ---------------------------------------------------------------------------------------------------------------------------
const FOOT_STAT_COLUMNS = [
  { key: "played", label: "MJ", title: "Joués" },
  { key: "wins", label: "V", title: "Victoires" },
  { key: "draws", label: "N", title: "Nuls" },
  { key: "losses", label: "D", title: "Défaites" },
  { key: "goals", label: "Buts", title: "Buts" },
  { key: "assists", label: "PD", title: "Passes D" },
  { key: "decisive", label: "Déc.", title: "Décisifs" },
  { key: "rating", label: "Note", title: "Note" },
  { key: "motm", label: "HDM", title: "Homme du match" },
];

function readPref(key, fallback, allowed) {
  try { const v = localStorage.getItem(key); return v && (!allowed || allowed.includes(v)) ? v : fallback; } catch (e) { return fallback; }
}

function writePref(key, value) {
  try { localStorage.setItem(key, value); } catch (e) {}
}

function FootStatTile({ title, value, rank }) {
  return (
    <div style={{ background: FC.soft, borderRadius: 18, padding: "12px 8px", textAlign: "center", minWidth: 0 }}>
      <div style={{ fontFamily: FF.ui, fontSize: 12, color: FC.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</div>
      <div style={{ fontFamily: FF.display, fontSize: 28, lineHeight: 1.25, color: FC.deep }}>{value}</div>
      <div style={{ fontFamily: FF.ui, fontSize: 13, color: FC.muted }}>{rank}</div>
    </div>
  );
}

function FootRatingChart({ series }) {
  const [hover, setHover] = React.useState(null);
  if (series.length < 2) return <FEmpty icon="chart" title="Pas encore de courbe" text="Il faut au moins 2 matchs notés pour afficher ton évolution." />;
  const W = 320, H = 150, L = 32, R = 12, T = 12, B = 12;
  const x = (i) => L + (i * (W - L - R)) / (series.length - 1);
  const y = (v) => T + ((10 - v) * (H - T - B)) / 9;
  const pts = series.map((s, i) => `${x(i)},${y(s.rating)}`).join(" ");
  const label = series.map((s) => `${s.opponent} ${s.rating.toFixed(1)}`).join(", ");
  const h = hover != null ? series[hover] : null;
  return (
    <div>
      <div style={{ minHeight: 20, textAlign: "center", fontSize: 14, color: FC.text }}>
        {h ? <>vs {h.opponent} · <b style={{ fontFamily: FF.display, color: FC.deep }}>{h.rating.toFixed(1)}</b> · {new Date(h.date).toLocaleDateString("fr-FR")}</> : <span style={{ color: FC.muted }}>Touche un point pour le détail</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label={`Notes des derniers matchs : ${label}`}>
        {[2, 4, 6, 8, 10].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={FC.line} strokeWidth="1" />
            <text x={L - 10} y={y(v) + 3.5} fontSize="10" fill={FC.muted} textAnchor="end">{v}</text>
          </g>
        ))}
        {h && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke={FC.muted} strokeWidth="1" strokeDasharray="2 2" />}
        <polyline points={pts} fill="none" stroke={FC.accent} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {series.map((s, i) => (
          <g key={s.matchId} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(hover === i ? null : i)} style={{ cursor: "pointer" }}>
            <circle cx={x(i)} cy={y(s.rating)} r="14" fill="transparent" />
            <circle cx={x(i)} cy={y(s.rating)} r={hover === i ? 6 : 4.5} fill={FC.accent} stroke="#fff" strokeWidth="2" />
            <title>{`${s.opponent} : ${s.rating.toFixed(1)}`}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}

function FootStatsPage({ matches, lineups, events, ratings, motmVotes, roster, currentPlayer, subjectId }) {
  const isOther = !!subjectId && subjectId !== currentPlayer?.id;
  const subject = subjectId || currentPlayer?.id;
  const currentSeason = seasonOf(new Date().toISOString());
  const [mode, setModeState] = React.useState(() => readPref("foot_stats_mode", "abs", ["abs", "pct"]));
  const [season, setSeasonState] = React.useState(() => readPref("foot_stats_season", currentSeason));
  const [type, setTypeState] = React.useState(() => readPref("foot_stats_type", "all", ["all", "amical", "championnat"]));
  const setMode = (v) => { setModeState(v); writePref("foot_stats_mode", v); };
  const setSeason = (v) => { setSeasonState(v); writePref("foot_stats_season", v); };
  const setType = (v) => { setTypeState(v); writePref("foot_stats_type", v); };

  const seasonOptions = [...new Set([currentSeason, ...seasonsFromMatches(matches), ...(season !== "all" ? [season] : [])])].sort().reverse();
  const filtered = filterMatchesForStats(matches, { season, type });
  const population = statsRoster(roster);
  const ratingBy = Object.fromEntries(population.map((id) => [id, averageRating(playerRatingSeries(filtered, ratings, lineups, id))]));
  const motmBy = motmWinners(filtered, motmVotes || []);
  const rows = buildStatsRows(population, computePlayerStats(filtered, lineups, events, motmBy), ratingBy);
  const pool = rows.filter((r) => r.played > 0);
  const ratingPool = rows.filter((r) => r.rating != null);
  const ranks = Object.fromEntries(FOOT_STAT_COLUMNS.map((c) => [c.key, rankPlayers(c.key === "rating" ? ratingPool : pool, c.key, mode)]));
  // A player outside the regular roster (guest…) still has a page; he is just not ranked.
  const me = rows.find((r) => r.playerId === subject) || (subject ? buildStatsRows([subject], computePlayerStats(filtered, lineups, events, motmBy), { [subject]: averageRating(playerRatingSeries(filtered, ratings, lineups, subject)) })[0] : null);
  const series = subject ? playerRatingSeries(filtered, ratings, lineups, subject).slice(-10) : [];
  const nameOf = footNameOf;

  function tilesFor(keys) {
    return keys.map((k) => {
      const col = FOOT_STAT_COLUMNS.find((c) => c.key === k);
      const value = me ? formatStatValue(statValue(me, k, mode), k, mode) : "—";
      const rank = me && ranks[k][me.playerId] ? String(formatRank(ranks[k][me.playerId])).split(" / ")[0] : "—"; // "1er ex æquo / 13" → "1er ex æquo"
      return <FootStatTile key={k} title={col.title} value={value} rank={rank} />;
    });
  }

  const tiles = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(84px, 1fr))", gap: 8 };

  return (
    <div className="ft-page">
      <FCard pad={12}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <select value={season} onChange={(e) => setSeason(e.target.value)} aria-label="Saison" style={{ ...FOOT_SELECT_STYLE, flex: 1, minWidth: 0 }}>
            {seasonOptions.map((s) => <option key={s} value={s}>Saison {s}</option>)}
            <option value="all">Toutes les saisons</option>
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type de match" style={{ ...FOOT_SELECT_STYLE, flex: 1, minWidth: 0 }}>
            <option value="all">Tous les matchs</option>
            <option value="championnat">Championnat</option>
            <option value="amical">Amical</option>
          </select>
        </div>
        <FSegmented value={mode} onChange={setMode} options={[["abs", "Valeurs"], ["pct", "En %"]]} />
      </FCard>

      {!me && <FMessage tone="warn">Les statistiques concernent l'effectif régulier et occasionnel.</FMessage>}
      {me && !population.includes(subject) && <FMessage tone="warn">Joueur hors effectif régulier : pas de classement.</FMessage>}
      {me && me.played === 0 && <FMessage tone="warn">Pas encore de match terminé avec une convocation.</FMessage>}

      <FCard>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <FAvatar playerId={subject} name={footNameOf(subject)} size={56} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: FF.display, fontSize: 22, color: FC.deep, lineHeight: 1.15 }}>{isOther ? `Stats de ${footNameOf(subject)}` : "Mes stats"}</div>
            <div style={{ fontSize: 14, color: FC.muted }}>{season === "all" ? "Toutes saisons" : `Saison ${season}`}</div>
          </div>
        </div>
        <FLabel>Matchs</FLabel>
        <div style={{ ...tiles, marginBottom: 14 }}>{tilesFor(["played", "wins", "draws", "losses", "rating"])}</div>
        <FLabel>Attaque</FLabel>
        <div style={{ ...tiles, marginBottom: 14 }}>{tilesFor(["goals", "assists", "decisive"])}</div>
        <FLabel>Distinctions</FLabel>
        <div style={tiles}>{tilesFor(["motm"])}</div>
      </FCard>

      <FCard>
        <FHeading>{isOther ? "Évolution" : "Mon évolution"}</FHeading>
        <FootRatingChart series={series} />
      </FCard>

      {!isOther && <FootRankingsPanel seasonMatches={filtered} season={season} lineups={lineups} events={events} ratings={ratings} motmVotes={motmVotes} roster={roster} currentPlayer={currentPlayer} mode={mode} />}
    </div>
  );
}

// ---- rankings (podium of the season) --------------------------------------------------------------------------------------------------------
const FOOT_RANKING_TABS = [
  { key: "goals", label: "Buts", unit: "buts", icon: "ball" },
  { key: "assists", label: "Passe D", unit: "passes", icon: "send" },
  { key: "decisive", label: "Décisifs", unit: "", icon: "chart" },
  { key: "rating", label: "Notes", unit: "", icon: "star" },
  { key: "motm", label: "HDM", unit: "fois", icon: "trophy" },
];

function FootPodiumSlot({ entry, place, size }) {
  const first = place === 1;
  return (
    <div style={{ flex: 1, minWidth: 0, textAlign: "center", marginTop: first ? 0 : 26 }}>
      <div style={{ position: "relative", display: "inline-block", marginBottom: 8 }}>
        <FAvatar playerId={entry.playerId} name={entry.name} size={size} ring={first ? FC.accent : FC.line} linkable />
        <span style={{ position: "absolute", left: -6, top: -6, width: 28, height: 28, borderRadius: 14, background: FC.accent, color: "#fff", border: "3px solid #fff", fontFamily: FF.display, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>{place}</span>
      </div>
      <div style={{ fontFamily: FF.ui, fontSize: first ? 18 : 16, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><FPlayerLink id={entry.playerId}>{entry.name}</FPlayerLink></div>
      <div style={{ fontFamily: FF.display, fontSize: first ? 30 : 24, color: FC.deep, lineHeight: 1.2 }}>{entry.shown}</div>
      <div style={{ fontSize: 12, color: FC.muted }}>{entry.matches} match{entry.matches > 1 ? "s" : ""}</div>
    </div>
  );
}

// Podium of goals / assists / average rating for the matches given (the Stats page passes its filtered ones).
function FootRankingsPanel({ seasonMatches, season, lineups, events, ratings, motmVotes, roster, currentPlayer, mode = "abs" }) {
  const [tab, setTab] = React.useState(() => readPref("foot_rank_tab", "goals", ["goals", "assists", "decisive", "rating", "motm"]));
  const pick = (v) => { setTab(v); writePref("foot_rank_tab", v); };
  const ids = new Set(seasonMatches.map((m) => m.id));
  const seasonLineups = lineups.filter((l) => ids.has(l.match_id));
  const rows = buildStatsRows(statsRoster(roster), computePlayerStats(seasonMatches, seasonLineups, events.filter((e) => ids.has(e.match_id)), motmWinners(seasonMatches, motmVotes || [])), {});
  for (const r of rows) {
    const series = playerRatingSeries(seasonMatches, ratings, seasonLineups, r.playerId);
    r.rating = averageRating(series);
    r.rated = series.length;
  }
  const byId = Object.fromEntries(rows.map((r) => [r.playerId, r]));
  const t = FOOT_RANKING_TABS.find((x) => x.key === tab);
  const pct = mode === "pct" && tab !== "rating";
  const rankRows = pct ? rows.map((r) => ({ ...r, [tab]: statValue(r, tab, "pct") })) : rows;
  const entries = rankingEntries(rankRows, tab, footNameOf, 15).map((e) => ({
    ...e, name: footNameOf(e.playerId), shown: tab === "rating" ? e.value.toFixed(1) : formatStatValue(e.value, tab, pct ? "pct" : "abs"), matches: tab === "rating" ? byId[e.playerId].rated : byId[e.playerId].played,
  }));
  const podium = entries.slice(0, 3), rest = entries.slice(3);
  const order = podium.length === 3 ? [[podium[1], 2, 66], [podium[0], 1, 84], [podium[2], 3, 66]] : podium.map((e, i) => [e, i + 1, i === 0 ? 84 : 66]);

  return (
    <FCard>
      <FHeading right={<FChip tone="soft">{season === "all" ? "Toutes saisons" : `Saison ${season}`}</FChip>}>{mode === "pct" && tab !== "rating" ? "Classements (par match)" : "Classements"}</FHeading>
      <FSegmented value={tab} onChange={pick} options={FOOT_RANKING_TABS.map((x) => [x.key, x.label])} style={{ marginBottom: 16 }} />
      {entries.length === 0 ? (
        <FEmpty icon="trophy" title="Pas encore de classement" text={`Aucun joueur n'a encore de ${t.key === "rating" ? "note" : t.key === "goals" ? "but" : t.key === "motm" ? "titre d'homme du match" : t.key === "decisive" ? "but ni passe décisive" : "passe décisive"} sur cette période.`} />
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: rest.length ? 14 : 0 }}>
            {order.map(([e, place, size]) => <FootPodiumSlot key={e.playerId} entry={e} place={place} size={size} />)}
          </div>
          {rest.map((e, i) => (
            <div key={e.playerId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 8px", marginInline: -8, borderTop: `1px solid ${FC.line}`, borderRadius: 12, background: e.playerId === currentPlayer?.id ? FC.accentSoft : "transparent" }}>
              <span style={{ width: 24, textAlign: "center", fontFamily: FF.display, fontSize: 16, color: FC.muted }}>{i + 4}</span>
              <FAvatar playerId={e.playerId} name={e.name} size={34} linkable />
              <span style={{ flex: 1, minWidth: 0, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><FPlayerLink id={e.playerId}>{e.name}</FPlayerLink></span>
              <span style={{ fontSize: 12, color: FC.muted }}>{e.matches} m.</span>
              <span style={{ fontFamily: FF.display, fontSize: 20, color: FC.deep, minWidth: 36, textAlign: "right" }}>{e.shown}</span>
            </div>
          ))}
        </>
      )}
    </FCard>
  );
}

// The Classement page is kept for later: empty for now.
function FootRankingsPage() {
  return (
    <div className="ft-page">
      <FCard><FEmpty icon="trophy" title="Bientôt disponible" text="Cette page arrive bientôt." /></FCard>
    </div>
  );
}

const INSTA_KEY_STORAGE = "foot_insta_admin_key";
function readInstaKey() { try { return localStorage.getItem(INSTA_KEY_STORAGE) || ""; } catch (e) { return ""; } }
async function instaAdminFetch(path, body, method = "POST") {
  const sentKey = readInstaKey();
  const r = await fetch(`/api/insta/${path}`, { method, headers: { "Content-Type": "application/json", "X-Insta-Admin-Key": sentKey }, body: method === "GET" ? undefined : JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && sentKey) {
    // the stored key is wrong: forget it and ask again
    try { localStorage.removeItem(INSTA_KEY_STORAGE); } catch (e) {}
    try { window.dispatchEvent(new Event("foot-insta-key-invalid")); } catch (e) {}
  }
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

  return (
    <div style={{ background: FC.softer, border: `1px solid ${FC.line}`, borderRadius: 16, padding: 8, textAlign: "center", minWidth: 0 }}>
      <div style={{ height: 76, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6, borderRadius: 12, background: FC.soft, overflow: "hidden" }}>
        {shown ? <img src={instaPublicUrl(shown.path)} alt="" style={{ maxHeight: 76, maxWidth: "100%", objectFit: "contain" }} /> : <FIcon name="photo" size={22} style={{ color: FC.line }} />}
      </div>
      <div style={{ minHeight: 20, marginBottom: 4 }}>{shown && <FChip tone={shown.retouched ? "good" : "plain"} style={{ fontSize: 10, padding: "2px 8px" }}>{shown.retouched ? "retouchée" : "brute"}</FChip>}</div>
      <input ref={inputRef} type="file" accept="image/png" onChange={onFile} style={{ display: "none" }} />
      <div style={{ display: "flex", gap: 4, justifyContent: "center", alignItems: "center" }}>
        <FBtn size="sm" disabled={busy} onClick={() => inputRef.current && inputRef.current.click()} style={{ padding: "5px 12px", minHeight: 32, fontSize: 12 }}>{busy ? "…" : shown ? "Remplacer" : "Envoyer"}</FBtn>
        {shown && <FIconBtn icon="trash" tone="danger" label="Supprimer la photo" onClick={remove} disabled={busy} style={{ width: 32, height: 32 }} />}
      </div>
      <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, color: FC.muted, marginTop: 6 }}>
        <input type="checkbox" checked={retouched} onChange={(e) => setRetouched(e.target.checked)} /> retouchée
      </label>
      {err && <FMessage style={{ marginTop: 6, fontSize: 11, padding: "5px 8px" }}>{err}</FMessage>}
    </div>
  );
}

// Stand-in render (player_id 0) used for every player without a render of their own.
const FOOT_UNKNOWN_PLAYER = { id: DEFAULT_PHOTO_PLAYER_ID, name: "Joueur inconnu (photo par défaut)" };

function FootPhotosTab({ roster, photos, reload }) {
  const nameOf = (p) => p.id === FOOT_UNKNOWN_PLAYER.id ? p.name : getDisplayName(p, PLAYERS) || "";
  const real = roster.map((r) => PLAYERS.find((p) => p.id === r.player_id)).filter(Boolean).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  if (!real.length) return <FCard><FEmpty icon="users" title="Aucun joueur" text="Ajoute des joueurs à l'effectif (onglet Admin)." /></FCard>;
  const players = [FOOT_UNKNOWN_PLAYER, ...real];
  const count = (id) => photos.filter((ph) => ph.player_id === id).length;
  return (
    <div>
      {players.map((p) => (
        <FCard key={p.id} pad={14}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: p.id === FOOT_UNKNOWN_PLAYER.id ? 4 : 12 }}>
            <FAvatar playerId={p.id || null} name={nameOf(p)} size={40} />
            <div style={{ flex: 1, fontFamily: FF.display, fontSize: 18, color: FC.deep }}>{nameOf(p)}</div>
            {p.id === FOOT_UNKNOWN_PLAYER.id ? <FChip tone={count(p.id) >= 1 ? "good" : "soft"}>{count(p.id)} / 2</FChip> : <FChip tone={count(p.id) >= 6 ? "good" : "soft"}>{count(p.id)} / 6</FChip>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "58px minmax(0, 1fr) minmax(0, 1fr)", gap: 8, alignItems: "center" }}>
            <span />
            {INSTA_KITS.map(([kit, label]) => <FLabel key={kit} style={{ textAlign: "center", marginBottom: 0 }}>{label}</FLabel>)}
            {INSTA_KINDS.filter(([kind]) => p.id !== FOOT_UNKNOWN_PLAYER.id || kind === "render").map(([kind, kindLabel]) => (
              <React.Fragment key={kind}>
                <FLabel style={{ marginBottom: 0 }}>{kindLabel}</FLabel>
                {INSTA_KITS.map(([kit]) => <FootPhotoCell key={kit} playerId={p.id} kit={kit} kind={kind} photos={photos} reload={reload} />)}
              </React.Fragment>
            ))}
          </div>
        </FCard>
      ))}
    </div>
  );
}

// Overlay boxes (canvas px) showing what covers the photo in each layout.
// They mirror lib/insta/templates.js — keep them in sync when a template moves.
const FRAMING_GUIDES = {
  matchday: [
    { label: "MATCH DAY", x: 0, y: 0, w: 1080, h: 180, font: 158, behind: true }, // title: drawn behind the player, like the render
    { label: "vs ADVERSAIRE", x: 340, y: 1118, w: 400, h: 120 },
    { label: "bandeau", x: 44, y: 1260, w: 992, h: 68 },
  ],
  result: [
    { label: "RESULTAT", x: 0, y: 0, w: 1080, h: 200, font: 180, behind: true }, // title: drawn behind the player
    { label: "score", x: 400, y: 225, w: 680, h: 300 },
    { label: "buts", x: 395, y: 625, w: 505, h: 394 },
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
  ["result", "Résultat (référence)"], ["matchday", "Match Day (suit Résultat)"], ["groupe", "Groupe"], ["render", "Render (rond)"],
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
              style={{ position: "relative", width: W, height: ch * scale, overflow: "hidden", cursor: "pointer", borderRadius: layout === "render" ? "50%" : isMask ? 40 * scale : 0, background: isMask ? "#ffffff" : "#222", border: `1px solid ${FC.line}`, boxSizing: "border-box" }}
            >
              {!isMask && <img src={`/assets/insta/bg-${photo ? photo.kit : kit}.jpg?v=crt1`} alt="" draggable={false} style={{ position: "absolute", left: 0, top: 0, width: W, height: ch * scale }} />}
              {showGuides && (FRAMING_GUIDES[layout] || []).filter((g) => g.behind).map((g) => <FootGuideBox key={g.label} g={g} scale={scale} text />)}
              {photo && rect && <img src={instaPublicUrl(photo.path)} alt="" draggable={false} style={{ position: "absolute", left: rect.x * scale, top: rect.y * scale, width: rect.width * scale, height: rect.height * scale }} />}
              {!photo && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: FC.muted, fontSize: 11, textAlign: "center", padding: 8 }}>Pas de photo</div>}
              {showGuides && (FRAMING_GUIDES[layout] || []).filter((g) => !g.behind).map((g) => <FootGuideBox key={g.label} g={g} scale={scale} />)}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, gap: 4 }}>
              <span style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.id === FOOT_UNKNOWN_PLAYER.id ? "Inconnu" : getDisplayName(p, PLAYERS)}</span>
              {photo && <span style={{ fontSize: 9, color: saved ? FC.good : FC.muted, textTransform: "uppercase", flexShrink: 0 }}>{saved ? "réglé" : "défaut"}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FootFramingTool({ roster, photos, framings, reload }) {
  const nameOf = (p) => p.id === FOOT_UNKNOWN_PLAYER.id ? "Joueur inconnu" : getDisplayName(p, PLAYERS) || "";
  const players = [...new Set(photos.map((p) => p.player_id))].map((id) => id === FOOT_UNKNOWN_PLAYER.id ? FOOT_UNKNOWN_PLAYER : PLAYERS.find((p) => p.id === id)).filter((p) => p && (p.id === FOOT_UNKNOWN_PLAYER.id || roster.some((r) => r.player_id === p.id))).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const [playerId, setPlayerId] = React.useState(null);
  const [kit, setKit] = React.useState("domicile");
  const [layout, setLayout] = React.useState("result");
  const [mode, setMode] = React.useState("single");
  const [showGuides, setShowGuides] = React.useState(true);
  const pid = players.some((p) => p.id === playerId) ? playerId : players[0] ? players[0].id : null;
  const photo = pid != null ? choosePhoto(photos, pid, PHOTO_KIND_FOR_LAYOUT[layout], kit) : null;
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
  const [centering, setCentering] = React.useState(false);
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
      const now = new Date().toISOString();
      const rows = [{ photo_id: photo.id, layout, x: fr.x, y: fr.y, width: fr.width, updated_at: now }];
      if (layout === "result") { const md = await matchdayFromResult(fr); rows.push({ photo_id: photo.id, layout: "matchday", x: md.x, y: md.y, width: md.width, updated_at: now }); }
      assertUpsertOk(await SUPABASE.from("foot_photo_framings").upsert(
        rows,
        { onConflict: "photo_id,layout" }
      ));
      await reload();
      setMsg({ t: "success", m: layout === "result" ? "Cadrage enregistré ✓ (Match Day mis à jour : même zoom, joueur centré)" : "Cadrage enregistré ✓" });
    } catch (e) { setMsg({ t: "error", m: "Erreur: " + e.message }); }
    setSaving(false);
  }
  // Position of the player himself (0..1 across the photo), read from the photo's transparent background.
  async function personRatio() {
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => resolve(i); i.onerror = () => reject(new Error("Photo illisible")); i.src = instaPublicUrl(photo.path); });
    const W = 240, H = Math.max(1, Math.round((W * img.naturalHeight) / img.naturalWidth));
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0, W, H);
    return personCenterRatio(ctx.getImageData(0, 0, W, H).data, W, H);
  }
  // Slides the photo sideways so the player himself (not the picture) stands in the middle of the canvas.
  async function centerPlayer() {
    setCentering(true); setMsg(null);
    try { setFr(centerFramingOnPerson(fr, cw, await personRatio())); }
    catch (e) { setMsg({ t: "error", m: "Centrage impossible : " + e.message }); }
    setCentering(false);
  }
  // Match Day follows Résultat: same size (same zoom %) and same height, the player centred on the canvas.
  async function matchdayFromResult(f) {
    const shift = LAYOUTS.matchday.box.x - LAYOUTS.result.box.x;
    return centerFramingOnPerson({ x: f.x + shift, y: f.y, width: f.width }, LAYOUTS.matchday.canvas[0], await personRatio());
  }
  async function previewServer() {
    const url = (l, f) => `/api/insta/render?${new URLSearchParams({ kind: "frame", photo: String(photo.id), layout: l, ...(f ? { x: String(Math.round(f.x * 10) / 10), y: String(Math.round(f.y * 10) / 10), w: String(Math.round(f.width * 10) / 10) } : {}), t: String(Date.now()) })}`;
    setMsg(null);
    try {
      if (layout === "result") {
        // Résultat is the one being placed; Match Day is derived from it (same zoom, centred).
        const md = await matchdayFromResult(fr);
        setServerPreview([{ label: "Résultat (réglage en cours)", src: url("result", fr) }, { label: "Match Day (déduit : même zoom, centré)", src: url("matchday", md) }]);
      } else if (layout === "matchday") {
        setServerPreview([{ label: "Match Day (réglage en cours)", src: url("matchday", fr) }, { label: "Résultat (enregistré)", src: url("result", null) }]);
      } else setServerPreview([{ label: "", src: url(layout, fr) }]);
    } catch (e) { setMsg({ t: "error", m: "Aperçu impossible : " + e.message }); }
  }

  const sel = { ...FOOT_SELECT_STYLE, width: "100%", marginBottom: 8 };
  const btn = (primary) => ({ flex: "1 1 auto", background: primary ? FC.accent : FC.soft, color: primary ? "#fff" : FC.text, border: primary ? "none" : `1px solid ${FC.line}`, borderRadius: 8, padding: "9px 6px", fontWeight: 700, fontSize: 12, cursor: "pointer" });
  const isMask = layout === "render" || layout.startsWith("podium_");

  if (!players.length) return <FCard><FEmpty icon="photo" title="Aucune photo" text="Envoie d'abord des photos dans l'onglet Photos." /></FCard>;
  return (
    <FCard>
      <FSegmented value={mode} onChange={setMode} options={[["single", "Un joueur"], ["compare", "Comparer tous"]]} style={{ marginBottom: 12 }} />
      {mode === "single" && (
      <select style={sel} value={pid ?? ""} onChange={(e) => setPlayerId(Number(e.target.value))}>
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
      {mode === "single" && (layout === "result" || layout === "matchday") && photo && (
        <div style={{ fontSize: 13, color: FC.muted, marginBottom: 10, lineHeight: 1.4 }}>{layout === "result" ? "Place le joueur ici : en enregistrant, Match Day reprend le même zoom, avec le joueur centré." : "Match Day se met à jour quand tu enregistres Résultat. Tu peux le retoucher ici, mais le prochain enregistrement de Résultat le recalcule."}</div>
      )}
      {mode === "compare" && (
        <div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: FC.muted, marginBottom: 12 }}>
            <input type="checkbox" checked={showGuides} onChange={(e) => setShowGuides(e.target.checked)} /> Afficher les repères (zones couvertes par le texte)
          </label>
          <FootFramingCompare players={players} photos={photos} framings={framings} kit={kit} layout={layout} showGuides={showGuides} onPick={(id) => { setPlayerId(id); setMode("single"); }} />
          <div style={{ fontSize: 11, color: FC.muted, textAlign: "center", marginTop: 12 }}>Touche un joueur pour ajuster son cadrage.</div>
        </div>
      )}
      {mode === "single" && !photo && <FEmpty icon="photo" title="Pas de photo" text="Aucune photo pour cet emplacement : envoie-la dans l'onglet Photos." />}
      <div style={{ display: mode === "single" && photo ? "block" : "none" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div
            ref={boxRef}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
            style={{ position: "relative", width: boxW, height: ch * scale, overflow: "hidden", touchAction: "none", cursor: "grab", userSelect: "none", borderRadius: layout === "render" ? "50%" : isMask ? 40 * scale : 0, background: isMask ? "#ffffff" : "#222" }}
          >
            {!isMask && <img src={`/assets/insta/bg-${photo ? photo.kit : kit}.jpg?v=crt1`} alt="" draggable={false} style={{ position: "absolute", left: 0, top: 0, width: cw * scale, height: ch * scale }} />}
            {(FRAMING_GUIDES[layout] || []).filter((g) => g.behind).map((g) => <FootGuideBox key={g.label} g={g} scale={scale} text />)}
            {photo && rect && <img src={instaPublicUrl(photo.path)} alt="" draggable={false} style={{ position: "absolute", left: rect.x * scale, top: rect.y * scale, width: rect.width * scale, height: rect.height * scale, pointerEvents: "none" }} />}
            {(FRAMING_GUIDES[layout] || []).filter((g) => !g.behind).map((g) => <FootGuideBox key={g.label} g={g} scale={scale} text />)}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0" }}>
          <FLabel style={{ marginBottom: 0 }}>Zoom</FLabel>
          <input type="range" min={50} max={800} step={1} value={Math.min(800, Math.max(50, pct))} onChange={onSlider} style={{ flex: 1 }} aria-label="Zoom" />
          <span style={{ fontFamily: FF.ui, fontSize: 15, color: FC.deep, width: 48, textAlign: "right" }}>{pct}%</span>
        </div>
        {msg && <FMessage tone={msg.t === "error" ? "bad" : "good"}>{msg.m}</FMessage>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <FBtn icon="check" disabled={saving || !fr} onClick={save} style={{ flex: "1 1 auto" }}>{saving ? "…" : "Enregistrer"}</FBtn>
          <FBtn variant="secondary" disabled={!photo} onClick={() => { setMsg(null); setFr(defaultFraming(layout, photo)); }} style={{ flex: "1 1 auto" }}>Réinitialiser</FBtn>
          <FBtn variant="secondary" disabled={!fr || centering} onClick={centerPlayer} style={{ flex: "1 1 auto" }}>{centering ? "…" : "Centrer le joueur"}</FBtn>
          <FBtn variant="ghost" icon="photo" disabled={!fr} onClick={previewServer} style={{ flex: "1 1 auto" }}>Aperçu serveur</FBtn>
        </div>
        {serverPreview && (
          <div style={{ marginTop: 14, textAlign: "center" }}>
            <FLabel>Aperçu serveur (rendu réel)</FLabel>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              {serverPreview.map((p) => (
                <div key={p.label || "one"} style={{ flex: serverPreview.length > 1 ? "1 1 0" : "none", minWidth: 0, width: serverPreview.length > 1 ? undefined : boxW }}>
                  <img src={p.src} alt={`Aperçu serveur ${p.label}`.trim()} onError={() => setMsg({ t: "error", m: "Aperçu serveur indisponible" })} style={{ display: "block", width: "100%", borderRadius: layout === "render" ? "50%" : 0 }} />
                  {p.label && <div style={{ fontSize: 11, color: FC.muted, marginTop: 4 }}>{p.label}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </FCard>
  );
}

function FootInstaKeyBox({ onSaved, rejected }) {
  const [v, setV] = React.useState("");
  const [show, setShow] = React.useState(false);
  function save() {
    const clean = v.replace(/[\s\u200B-\u200D\uFEFF]/g, ""); // spaces and invisible characters a phone keyboard may add
    if (!clean) return;
    try { localStorage.setItem(INSTA_KEY_STORAGE, clean); } catch (e) {}
    onSaved();
  }
  return (
    <FCard>
      <FHeading>Clé admin</FHeading>
      <div style={{ fontSize: 14, color: FC.muted, marginBottom: 12, lineHeight: 1.4 }}>Gardée uniquement dans ce navigateur, envoyée seulement à l'API du site.</div>
      {rejected && <FMessage>Cette clé a été refusée par le serveur. Vérifie-la (affiche-la avec la case ci-dessous) et réessaie.</FMessage>}
      <input type={show ? "text" : "password"} style={FOOT_INPUT_STYLE} placeholder="Clé admin" value={v} onChange={(e) => setV(e.target.value)} aria-label="Clé admin" autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false} />
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: FC.muted, margin: "2px 0 12px" }}><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Afficher la clé</label>
      <FBtn full onClick={save}>Enregistrer la clé</FBtn>
    </FCard>
  );
}

// Images of one post: Match Day + Groupe is a 2-image carousel (same player on both), Classements a 3-image one.
// `player` is the admin's pick for the player on the photo (none = automatic rotation).
function instaImages(kind, { matchId, season }, v, player) {
  const url = (params) => `/api/insta/render?${new URLSearchParams({ ...params, v, ...(player ? { player } : {}) })}`;
  if (kind === "matchday") return [{ label: "Match Day", src: url({ kind: "matchday", match: matchId, page: 1 }) }, { label: "Groupe", src: url({ kind: "matchday", match: matchId, page: 2 }) }];
  if (kind === "rankings") return RANKING_PAGES.map((pg, i) => ({ label: pg.heading, src: url({ kind: "rankings", season, page: i + 1 }) }));
  return [{ label: kind === "ratings" ? "Notes" : "Résultat", src: url({ kind, match: matchId }) }];
}

// Short fingerprint of everything a post's images and caption are drawn from: the URL changes when the match does,
// so the browser never reuses an outdated render.
function instaDataKey(kind, target, { matches, lineups, events, ratings }) {
  const mid = target.matchId;
  const slice = kind === "rankings"
    ? [matches.map((m) => [m.id, m.status, m.venue, m.ratings_validated_at]), events, lineups, ratings]
    : [matches.filter((m) => m.id === mid), lineups.filter((l) => l.match_id === mid), events.filter((e) => e.match_id === mid), ratings.filter((r) => r.match_id === mid)];
  const str = JSON.stringify(slice);
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const INSTA_DAY_LABELS = ["le jour même", "la veille", "2 jours avant", "3 jours avant", "4 jours avant", "5 jours avant", "6 jours avant"];
const INSTA_AFTER_LABELS = ["le jour même", "le lendemain", "2 jours après", "3 jours après", "4 jours après", "5 jours après", "6 jours après"];
const INSTA_WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const INSTA_WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const instaWhen = (d) => d ? new Date(d).toLocaleString("fr-FR", { timeZone: "Europe/Paris", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
const instaPublicImageUrl = (path) => `${SUPABASE_URL}/storage/v1/object/public/insta-posts/${path.split("/").map(encodeURIComponent).join("/")}`;

function FootInstaImages({ images }) {
  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 10, paddingBottom: 2 }}>
      {images.map((im) => (
        <a key={im.src} href={im.src} target="_blank" rel="noreferrer" style={{ flex: "0 0 auto", width: 124, textAlign: "center", textDecoration: "none" }}>
          <img src={im.src} alt={im.label} loading="lazy" style={{ width: 124, height: 155, objectFit: "cover", background: FC.soft, borderRadius: 14, display: "block", boxShadow: FC.shadowSm }} />
          <div style={{ fontFamily: FF.ui, fontSize: 12, color: FC.muted, marginTop: 4, textTransform: "uppercase" }}>{im.label}</div>
        </a>
      ))}
    </div>
  );
}

// How and when a section is sent: manual, or automatic with a slot.
function FootSectionSchedule({ sec, cfg, onChange }) {
  const rule = cfg.rule;
  const set = (patch) => onChange({ ...cfg, rule: { ...rule, ...patch } });
  const field = { ...FOOT_SELECT_STYLE };
  const typeChoice = sec.rules.length > 1 ? (
    <select value={rule.type} onChange={(e) => onChange({ ...cfg, rule: e.target.value === "on_close" ? { type: "on_close", days: 0, time: "00:00" } : { type: "after_match", days: 0, time: "22:00" } })} style={field}>
      <option value="on_close">Dès la clôture du match</option>
      <option value="after_match">À une heure précise après le match</option>
    </select>
  ) : null;
  if (rule.type === "on_close") return <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 15, color: FC.text }}>{typeChoice}</div>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 15, color: FC.text }}>
      {typeChoice}
      {rule.type === "weekly" ? (
        <>
          <span>Chaque</span>
          <select value={rule.weekday} onChange={(e) => set({ weekday: Number(e.target.value) })} style={field}>
            {INSTA_WEEKDAY_ORDER.map((d) => <option key={d} value={d}>{INSTA_WEEKDAYS[d]}</option>)}
          </select>
        </>
      ) : (
        <>
          <span>Envoyer</span>
          <select value={rule.days} onChange={(e) => set({ days: Number(e.target.value) })} style={field}>
            {(rule.type === "before_match" ? INSTA_DAY_LABELS : INSTA_AFTER_LABELS).map((l, i) => <option key={i} value={i}>{l}</option>)}
          </select>
          <span>du match</span>
        </>
      )}
      <span>à</span>
      <input type="time" value={rule.time} onChange={(e) => e.target.value && set({ time: e.target.value })} style={field} />
      <span style={{ color: FC.muted }}>(heure de Paris)</span>
    </div>
  );
}

function FootInstaNext({ sec, next, cfg, data, posts, featuredId, candidates, onPickPlayer, onPublished }) {
  const target = { kind: sec.kind, matchId: next.matchId, weekKey: next.weekKey, season: next.season };
  const match = next.matchId ? data.matches.find((m) => m.id === next.matchId) : null;
  const key = instaDataKey(sec.kind, target, data);
  const [caption, setCaption] = React.useState(() => next.available ? captionFor(sec.kind, captionContextFor(sec.kind, target, { ...data, players: PLAYERS })) : "");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const [copied, setCopied] = React.useState(false);
  const failed = posts.filter((p) => p.kind === sec.kind && p.status === "failed" && (next.weekKey ? p.week_key === next.weekKey : p.match_id === next.matchId)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
  const images = next.previewable ? instaImages(sec.kind, target, key, featuredId) : [];
  const chosen = candidates.find((c) => c.id === featuredId);

  async function publish() {
    if (!window.confirm(`Publier maintenant sur Instagram ?\n\n${caption.slice(0, 200)}`)) return;
    setBusy(true); setMsg(null);
    try {
      const r = await instaAdminFetch("publish", { section: sec.key, match_id: next.matchId, week_key: next.weekKey, season: next.season, caption });
      setMsg(r.status === "published" ? { t: "success", m: "Publié ✓" } : r.status === "in_progress" ? { t: "error", m: "Une publication est déjà en cours" } : { t: "success", m: "Déjà publié" });
      await onPublished();
    } catch (e) { setMsg({ t: "error", m: e.message }); }
    setBusy(false);
  }
  async function copy() { try { await navigator.clipboard.writeText(caption); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (e) { console.warn("copy failed", e); } }

  let badge;
  if (!next.available) badge = ["warn", "En attente : " + next.waitingFor];
  else if (cfg.mode !== "auto") badge = ["accent", "Prêt — envoi manuel"];
  else if (next.due) badge = ["warn", "Part au prochain passage (≤ 10 min)"];
  else if (!next.scheduledAt) badge = ["good", "Part dès la clôture du match"];
  else badge = ["good", `Programmé : ${instaWhen(next.scheduledAt)}`];
  return (
    <div>
      <div style={{ fontFamily: FF.ui, fontSize: 18, lineHeight: 1.2, marginBottom: 6 }}>{match ? `vs ${match.opponent_name}` : `Saison ${next.season}`}{match && <span style={{ color: FC.muted, fontSize: 14 }}> · {instaWhen(match.match_datetime)}</span>}</div>
      <div style={{ marginBottom: 10 }}><FChip tone={badge[0]}>{badge[1]}</FChip></div>
      {failed && <FMessage>Dernier essai échoué : {failed.error}</FMessage>}
      {next.previewable && <FootInstaImages images={images} />}
      {sec.featured && next.previewable && (
        <FField label="Joueur sur la photo">
          <select value={featuredId || ""} onChange={(e) => onPickPlayer(targetKey(target), e.target.value ? Number(e.target.value) : null)} style={{ ...FOOT_INPUT_STYLE, marginBottom: 0 }}>
            <option value="">Automatique (rotation)</option>
            {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {sec.key === "matchday" && chosen && !chosen.hasDos && <FMessage tone="warn" style={{ marginTop: 8 }}>Pas de photo « dos » pour ce joueur : l'image Groupe sera sans joueur.</FMessage>}
        </FField>
      )}
      {next.available && (
        <>
          <FField label="Légende"><textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={4} style={{ ...FOOT_INPUT_STYLE, marginBottom: 0, resize: "vertical", lineHeight: 1.4 }} /></FField>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <FBtn icon="send" onClick={publish} disabled={busy} style={{ flex: "1 1 auto" }}>{busy ? "Publication…" : "Publier maintenant"}</FBtn>
            <FBtn variant="secondary" onClick={copy} style={{ flex: "1 1 auto" }}>{copied ? "Copié ✓" : "Copier la légende"}</FBtn>
          </div>
        </>
      )}
      {msg && <FMessage tone={msg.t === "error" ? "bad" : "good"} style={{ marginTop: 10 }}>{msg.m}</FMessage>}
    </div>
  );
}

function FootInstaLast({ sec, last, data }) {
  if (last.published) {
    const p = last.post;
    const m = p.match_id ? data.matches.find((x) => x.id === p.match_id) : null;
    const images = (p.image_paths || []).map((path, i) => ({ label: `${i + 1}`, src: instaPublicImageUrl(path) }));
    return (
      <div>
        <div style={{ fontFamily: FF.ui, fontSize: 18, lineHeight: 1.2, marginBottom: 6 }}>{m ? `vs ${m.opponent_name}` : `Saison ${p.season || ""}`}</div>
        <div style={{ marginBottom: 10 }}><FChip tone="good" icon="check">Publié le {instaWhen(p.published_at)}</FChip></div>
        {images.length > 0 && <FootInstaImages images={images} />}
        {p.permalink && <FBtn size="sm" variant="secondary" onClick={() => window.open(p.permalink, "_blank", "noopener")}>Voir sur Instagram</FBtn>}
      </div>
    );
  }
  const m = last.matchId ? data.matches.find((x) => x.id === last.matchId) : null;
  if (!last.available) return <div style={{ fontSize: 14, color: FC.muted }}>Aucun post pour l'instant.</div>;
  const target = { kind: sec.kind, matchId: last.matchId, season: last.season };
  return (
    <div>
      <div style={{ fontFamily: FF.ui, fontSize: 18, lineHeight: 1.2, marginBottom: 6 }}>{m ? `vs ${m.opponent_name}` : `Saison ${last.season}`}</div>
      <div style={{ marginBottom: 10 }}><FChip tone="plain">Jamais publié · dernier visuel</FChip></div>
      <FootInstaImages images={instaImages(sec.kind, target, instaDataKey(sec.kind, target, data))} />
    </div>
  );
}

function FootInstaSection({ sec, saved, data, posts, featured, candidates, onPickPlayer, onSave, onPublished }) {
  const [draft, setDraft] = React.useState(saved);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState(null);
  React.useEffect(() => { setDraft(saved); }, [JSON.stringify(saved)]);
  const dirty = JSON.stringify({ m: draft.mode, r: draft.rule }) !== JSON.stringify({ m: saved.mode, r: saved.rule });
  const state = sectionState(sec.key, { matches: data.matches, lineups: data.lineups, posts, settings: { [sec.key]: saved }, now: new Date() });
  async function save() {
    setSaving(true); setErr(null);
    try { await onSave(sec.key, draft); } catch (e) { setErr(e.message); }
    setSaving(false);
  }
  return (
    <FCard>
      <FHeading right={<FChip tone={saved.mode === "auto" ? "good" : "plain"}>{saved.mode === "auto" ? "Automatique" : "Manuel"}</FChip>}>{sec.label}</FHeading>
      <FSegmented value={draft.mode} onChange={(m) => setDraft({ ...draft, mode: m })} options={[["manual", "Manuel"], ["auto", "Automatique"]]} style={{ marginBottom: 12 }} />
      {draft.mode === "auto" && (
        <div style={{ marginBottom: 12 }}>
          <FootSectionSchedule sec={sec} cfg={draft} onChange={setDraft} />
          <div style={{ fontSize: 13, color: FC.muted, marginTop: 8, lineHeight: 1.4 }}>Seuls les créneaux à venir partent tout seuls{saved.mode === "auto" && saved.since ? ` (activé le ${instaWhen(saved.since)})` : ", à partir de l'enregistrement"}. Rien d'ancien n'est publié.</div>
        </div>
      )}
      {dirty && <FBtn full onClick={save} disabled={saving} style={{ marginBottom: 12 }}>{saving ? "Enregistrement…" : "Enregistrer le réglage"}</FBtn>}
      {err && <FMessage>{err}</FMessage>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginTop: 4 }}>
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <FLabel>Dernier post</FLabel>
          <FootInstaLast sec={sec} last={state.last} data={data} />
        </div>
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <FLabel>Prochain post</FLabel>
          {state.next
            ? <FootInstaNext key={`${targetKey(state.next)}-${instaDataKey(sec.kind, state.next, data)}`} sec={sec} next={state.next} cfg={saved} data={data} posts={posts} featuredId={featured[targetKey(state.next)]} candidates={candidates} onPickPlayer={onPickPlayer} onPublished={onPublished} />
            : <div style={{ fontSize: 14, color: FC.muted }}>Rien de prévu pour l'instant.</div>}
        </div>
      </div>
    </FCard>
  );
}

function FootPostsTab({ matches, lineups, events, ratings, roster, photos }) {
  const [settings, setSettings] = React.useState(null);
  const [featured, setFeatured] = React.useState({});
  const [instaPosts, setInstaPosts] = React.useState([]);
  const [loadErr, setLoadErr] = React.useState(null);
  const data = { matches, lineups, events, ratings };
  const reloadPosts = () => instaAdminFetch("posts", null, "GET").then((r) => setInstaPosts(r.posts || [])).catch((e) => setLoadErr((prev) => prev || e.message));
  // Players that can be put on a photo: roster players with a celebration photo.
  const candidates = roster.map((r) => PLAYERS.find((p) => p.id === r.player_id)).filter(Boolean)
    .filter((p) => photos.some((ph) => ph.player_id === p.id && ph.kind === "celebration"))
    .map((p) => ({ id: p.id, name: getDisplayName(p, PLAYERS) || "", hasDos: photos.some((ph) => ph.player_id === p.id && ph.kind === "dos") }))
    .sort((a, b) => a.name.localeCompare(b.name));
  async function pickPlayer(key, id) {
    const before = featured;
    const next = { ...featured }; if (id) next[key] = id; else delete next[key];
    setFeatured(next); // instant feedback; the server answer is the truth
    try { const r = await instaAdminFetch("featured", { key, player_id: id }); setFeatured(r.featured || {}); }
    catch (e) { setFeatured(before); setLoadErr(e.message); }
  }
  React.useEffect(() => {
    instaAdminFetch("featured", null, "GET").then((r) => setFeatured(r.featured || {})).catch(() => {});
    reloadPosts();
    instaAdminFetch("settings", null, "GET").then((r) => setSettings(normalizeSettings(r.settings))).catch((e) => { setLoadErr(e.message); setSettings(defaultSettings()); });
  }, []);
  async function saveSection(key, cfg) {
    const r = await instaAdminFetch("settings", { settings: { ...settings, [key]: { mode: cfg.mode, rule: cfg.rule } } });
    setSettings(normalizeSettings(r.settings));
  }
  if (!settings) return <><FSkeleton h={260} /><FSkeleton h={260} /></>;
  return (
    <div>
      {loadErr && <FMessage>Réglages indisponibles ({loadErr}). Valeurs par défaut (manuel) affichées.</FMessage>}
      {INSTA_SECTIONS.map((sec) => (
        <FootInstaSection key={sec.key} sec={sec} saved={settings[sec.key]} data={data} posts={instaPosts} featured={featured} candidates={candidates} onPickPlayer={pickPlayer} onSave={saveSection} onPublished={reloadPosts} />
      ))}
      <div style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, textAlign: "center", textShadow: "1px 1px 0 rgba(0,0,0,0.25)" }}>Envoi automatique : un planificateur vérifie toutes les ~10 minutes ce qui doit partir.</div>
    </div>
  );
}

function FootReseauxPage({ roster, photos, framings, matches, lineups, events, ratings, reload }) {
  const [tab, setTab] = React.useState(() => readPref("foot_reseaux_tab", "photos", ["posts", "photos", "cadrage"]));
  const [hasKey, setHasKey] = React.useState(() => !!readInstaKey());
  const [rejected, setRejected] = React.useState(false);
  React.useEffect(() => {
    const onBad = () => { setHasKey(false); setRejected(true); };
    window.addEventListener("foot-insta-key-invalid", onBad);
    return () => window.removeEventListener("foot-insta-key-invalid", onBad);
  }, []);
  const pick = (t) => { setTab(t); writePref("foot_reseaux_tab", t); };
  return (
    <div className="ft-page">
      {!hasKey && <FootInstaKeyBox rejected={rejected} onSaved={() => { setRejected(false); setHasKey(true); }} />}
      <FSegmented value={tab} onChange={pick} options={[["posts", "Posts", "send"], ["photos", "Photos", "photo"], ["cadrage", "Cadrage", "pencil"]]} style={{ marginBottom: 14, background: "rgba(255,255,255,0.92)" }} />
      {tab === "posts" && <FootPostsTab key={String(hasKey)} matches={matches} lineups={lineups} events={events} ratings={ratings} roster={roster} photos={photos} />}
      {tab === "photos" && <FootPhotosTab key={String(hasKey)} roster={roster} photos={photos} reload={reload} />}
      {tab === "cadrage" && <FootFramingTool roster={roster} photos={photos} framings={framings} reload={reload} />}
      {hasKey && (
        <div style={{ textAlign: "center", marginTop: 4 }}>
          <button onClick={() => { try { localStorage.removeItem(INSTA_KEY_STORAGE); } catch (e) {} setHasKey(false); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.9)", fontSize: 13, cursor: "pointer", textDecoration: "underline", textShadow: "1px 1px 0 rgba(0,0,0,0.25)" }}>Changer la clé admin</button>
        </div>
      )}
    </div>
  );
}

// ---- app shell --------------------------------------------------------------------------------------------------------------------------
const FOOT_PAGE_TITLES = {
  calendar: ["Calendrier", "Bière Leverculsec"], rankings: ["Classement", null], stats: ["Stats", null], reseaux: ["Réseaux", "Instagram"], admin: ["Admin", "Matchs et effectif"],
};

// ---- opening screen -------------------------------------------------------------------------------------------------------------------
const FOOT_SPLASH_STEPS = [["calendar", "Calendrier", "calendar"], ["rankings", "Classement", "trophy"], ["stats", "Stats", "chart"]];

function FootSplash({ steps, leaving, theme }) {
  const done = FOOT_SPLASH_STEPS.filter(([k]) => steps[k]).length;
  const pct = Math.round((done / FOOT_SPLASH_STEPS.length) * 100);
  return (
    <div role="status" aria-live="polite" aria-label="Chargement du module foot"
      style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26, padding: 24, color: "#fff",
        background: `radial-gradient(circle at 50% 30%, ${FC.accent} 0%, ${FC.deep} 78%)`, opacity: leaving ? 0 : 1, transition: "opacity 0.45s ease", pointerEvents: leaving ? "none" : "auto" }}>
      <style>{`
        @keyframes ftSplashBounce { 0%,100% { transform: translateY(0) scale(1,1); } 45% { transform: translateY(-34px) scale(0.98,1.02); } 50% { transform: translateY(-34px); } 92% { transform: translateY(0) scale(1.08,0.92); } }
        @keyframes ftSplashShadow { 0%,100% { transform: scale(1); opacity: .35; } 50% { transform: scale(.6); opacity: .15; } }
        @keyframes ftSplashIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .ft-splash-anim { animation: none !important; } }
      `}</style>
      <div style={{ width: 118, height: 96, background: "#fff", borderRadius: 28, boxShadow: "0 8px 0 rgba(0,0,0,0.18)", display: "flex", alignItems: "center", justifyContent: "center", animation: "ftSplashIn .5s ease both" }}>
        <img src={theme === "pink" ? "/logo-bl-rose.png" : "/logo-bl.png"} alt="" style={{ width: 96, height: 76, objectFit: "contain" }} />
      </div>
      <div style={{ textAlign: "center" }}>
        <div className="ft-splash-anim" style={{ fontSize: 46, lineHeight: 1, animation: "ftSplashBounce 1.05s cubic-bezier(.3,0,.6,1) infinite" }} aria-hidden="true">⚽</div>
        <div className="ft-splash-anim" style={{ width: 46, height: 8, borderRadius: 4, background: "rgba(0,0,0,0.5)", margin: "6px auto 0", animation: "ftSplashShadow 1.05s cubic-bezier(.3,0,.6,1) infinite" }} />
      </div>
      <div style={{ fontFamily: FF.display, fontSize: 24, letterSpacing: "0.04em", textTransform: "uppercase", textShadow: "2px 2px 0 rgba(0,0,0,0.25)" }}>Coup d'envoi…</div>
      <div style={{ width: "min(320px, 100%)" }}>
        <div style={{ height: 12, borderRadius: 6, background: "rgba(0,0,0,0.28)", overflow: "hidden" }}>
          <div style={{ width: `${Math.max(8, pct)}%`, height: "100%", borderRadius: 6, background: "#fff", transition: "width .45s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
          {FOOT_SPLASH_STEPS.map(([k, label, icon]) => (
            <div key={k} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1, opacity: steps[k] ? 1 : 0.55, transition: "opacity .3s" }}>
              <span style={{ width: 34, height: 34, borderRadius: 17, background: steps[k] ? "#fff" : "rgba(255,255,255,0.18)", color: steps[k] ? FC.deep : "#fff", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .3s" }}>
                <FIcon name={steps[k] ? "check" : icon} size={18} stroke={2.4} />
              </span>
              <span style={{ fontFamily: FF.ui, fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- the club room: Calendrier / Classement / Vestiaire as three corners of one 3D locker room ------------------------------
// foot-room.js draws the room and reports taps; this screen feeds it the data and lays the readable bits over it.
const FOOT_ROOM_ZONES = { calendar: "desk", rankings: "board", vestiaire: "rack" };
const FOOT_ROOM_TITLES = { calendar: "Calendrier", rankings: "Classement", vestiaire: "Vestiaire" };

function FootRoomStat({ label, value }) {
  return (
    <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
      <div style={{ fontFamily: FF.display, fontSize: 22, lineHeight: 1.1, color: "#fff" }}>{value}</div>
      <div style={{ fontFamily: FF.ui, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>{label}</div>
    </div>
  );
}

function FootRoomScreen({ visible, page, theme, setTheme, onHome, roster, matches, events, lineups, ratings, motmVotes, currentPlayer, nav, openPlayer, onLeaveRoom }) {
  const host = React.useRef(null);
  const room = React.useRef(null);
  const [state, setState] = React.useState("loading");
  const [error, setError] = React.useState(null);
  const [shirt, setShirt] = React.useState(null);
  const [boardMode, setBoardModeState] = React.useState(() => readPref("foot_room_board", "indiv", ["indiv", "team"]));
  const [boardTab, setBoardTabState] = React.useState(() => readPref("foot_rank_tab", "goals", FOOT_RANKING_TABS.map((t) => t.key)));
  const [month, setMonth] = React.useState(() => { const s = calendarStartMonth(matches); return s.year * 12 + s.month - 1; });
  const [paper, setPaper] = React.useState(null);
  const zone = FOOT_ROOM_ZONES[page] || "rack";
  const kit = theme === "pink" ? "away" : "home";

  // ---- data ----
  const squad = React.useMemo(() => rackSquad(roster, footNameOf), [roster]);
  const scoreById = React.useMemo(() => {
    const by = {}; for (const e of events) (by[e.match_id] = by[e.match_id] || []).push(e);
    return Object.fromEntries(matches.map((m) => [m.id, computeFootScore(by[m.id] || [])]));
  }, [matches, events]);
  const season = seasonOf(new Date().toISOString());
  const rows = React.useMemo(() => {
    const filtered = filterMatchesForStats(matches, { season, type: "all" });
    const ids = new Set(filtered.map((m) => m.id));
    const ls = lineups.filter((l) => ids.has(l.match_id));
    const out = buildStatsRows(statsRoster(roster), computePlayerStats(filtered, ls, events.filter((e) => ids.has(e.match_id)), motmWinners(filtered, motmVotes || [])), {});
    for (const r of out) { const s = playerRatingSeries(filtered, ratings, ls, r.playerId); r.rating = averageRating(s); r.rated = s.length; }
    return out;
  }, [matches, lineups, events, ratings, motmVotes, roster, season]);
  const bounds = React.useMemo(() => calendarBounds(matches), [matches]);
  const upcoming = React.useMemo(() => upcomingMatches(matches, 4), [matches]);

  const tap = React.useRef();
  tap.current = (surface, id) => {
    if (!id) { if (surface === "next" && upcoming[0]) setPaper(upcoming[0]); return; }
    const [kind, rest] = [id.split(":")[0], id.slice(id.indexOf(":") + 1)];
    if (kind === "mode") { setBoardModeState(rest); writePref("foot_room_board", rest); }
    else if (kind === "tab") { setBoardTabState(rest); writePref("foot_rank_tab", rest); }
    else if (kind === "player") openPlayer(Number(rest));
    else if (kind === "next") { if (upcoming[0]) setPaper(upcoming[0]); }
    else if (kind === "match") { const m = matches.find((x) => String(x.id) === rest); if (m) nav("matchDetail", { matchId: m.id }); }
    else if (kind === "cal") setMonth((v) => Math.max(bounds.min, Math.min(bounds.max, v + (rest === "next" ? 1 : -1))));
  };

  // ---- the room itself: created once, kept while the football app is open ----
  React.useEffect(() => {
    let alive = true;
    window.FootRoom.ensureLoaded().then(() => {
      if (!alive || !host.current) return;
      room.current = window.FootRoom.create(host.current, {
        zone, accent: FC.accent, accentDeep: FC.deep,
        onShirt: (i, p) => alive && setShirt(p || null),
        onTap: (surface, id) => tap.current(surface, id),
      });
      setState("ready");
    }).catch((e) => { if (alive) { setError(e.message); setState("error"); } });
    return () => { alive = false; if (room.current) room.current.destroy(); room.current = null; };
  }, []);

  React.useEffect(() => { if (room.current) room.current.pause(!visible); }, [visible, state]);
  React.useEffect(() => { if (room.current) room.current.setZone(zone); setPaper(null); }, [zone, state]);
  React.useEffect(() => { if (room.current) { room.current.setAccent(FC.accent, FC.deep); room.current.setSquad(squad, kit, currentPlayer?.id); } }, [squad, kit, state]);

  React.useEffect(() => {
    if (!room.current) return;
    const entries = rankingEntries(rows, boardTab, footNameOf, 10).map((e) => ({
      playerId: e.playerId, name: footNameOf(e.playerId), value: boardTab === "rating" ? e.value.toFixed(1) : formatStatValue(e.value, boardTab, "abs"),
    }));
    room.current.setBoard({ mode: boardMode, tab: boardTab, tabs: FOOT_RANKING_TABS.map(({ key, label }) => ({ key, label })), season: `Saison ${season}`, entries });
  }, [rows, boardMode, boardTab, state]);

  React.useEffect(() => {
    if (!room.current) return;
    const venue = (m) => (m.venue === "exterieur" ? "Extérieur" : "Domicile");
    const next = upcoming[0];
    const longDate = (iso) => new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });
    const y = Math.floor(month / 12), mo = month % 12 + 1;
    room.current.setDesk({
      next: next && {
        kicker: [next.status === "live" ? "En direct" : footRelative(next.match_datetime), venue(next), next.match_type === "amical" ? "Amical" : null].filter(Boolean).join(" · "),
        opponent: next.opponent_name, date: longDate(next.match_datetime),
        hours: `Match ${footHour(next.match_datetime)}${next.meeting_at ? ` · RDV ${footHour(next.meeting_at)}` : ""}`,
        place: formatMatchPlace(next),
      },
      upcoming: upcoming.slice(1, 4).map((m) => ({ id: m.id, date: longDate(m.match_datetime), opponent: m.opponent_name, sub: `${footHour(m.match_datetime)} · ${venue(m)}` })),
      calendar: calendarMonth(matches, (m) => scoreById[m.id] || { bl: 0, opponent: 0 }, y, mo),
    });
  }, [upcoming, matches, scoreById, month, theme, state]);

  // ---- overlays ----
  const row = shirt && rows.find((r) => r.playerId === shirt.id);
  const glass = { background: "rgba(16,12,14,0.72)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 22, color: "#fff" };
  const roundBtn = { width: 42, height: 42, borderRadius: 21, border: "1px solid rgba(255,255,255,0.22)", background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: 20, cursor: "pointer", flex: "0 0 auto" };
  const hint = zone === "board" ? "Touchez le tableau pour changer de classement" : zone === "desk" ? "Touchez une feuille ou un match du calendrier" : null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 5, background: "#100c0e", display: visible ? "block" : "none" }}>
      <style>{footGlobalCss()}</style>
      <div ref={host} style={{ position: "absolute", inset: 0 }} />
      {/* top bar */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, padding: "calc(12px + env(safe-area-inset-top)) 16px 26px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "linear-gradient(rgba(16,12,14,0.85) 40%, transparent)", pointerEvents: "none" }}>
        <div style={{ pointerEvents: "auto" }}><FIconBtn icon="home" label="Retour à l'accueil" tone="glass" onClick={onHome} /></div>
        <div style={{ fontFamily: FF.display, fontSize: 26, color: "#fff", textShadow: "0 2px 0 rgba(0,0,0,0.4)" }}>{FOOT_ROOM_TITLES[page]}</div>
        <div style={{ pointerEvents: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <FIconBtn icon="cube" label="Revenir aux pages classiques" tone="glass" onClick={onLeaveRoom} />
          <FThemeSwitch value={theme} onChange={setTheme} />
        </div>
      </div>
      {state === "loading" && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "rgba(255,255,255,0.7)", fontFamily: FF.ui, fontSize: 18 }}>On ouvre le vestiaire…</div>}
      {state === "error" && (
        <div style={{ position: "absolute", left: 16, right: 16, top: "40%", ...glass, padding: 18, textAlign: "center", fontFamily: FF.ui }}>
          Le vestiaire 3D n'a pas pu s'ouvrir ({error}). <button onClick={onLeaveRoom} style={{ ...roundBtn, width: "auto", padding: "0 14px", marginTop: 10 }}>Pages classiques</button>
        </div>
      )}
      {/* vestiaire: the shirt in front */}
      {state === "ready" && zone === "rack" && shirt && (
        <div style={{ position: "absolute", left: 12, right: 12, bottom: "calc(96px + env(safe-area-inset-bottom))", maxWidth: 560, margin: "0 auto", ...glass, padding: "12px 12px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => room.current && room.current.step(-1)} aria-label="Maillot précédent" style={roundBtn}>‹</button>
            <button onClick={() => openPlayer(shirt.id)} style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0, textAlign: "left" }}>
              <span style={{ fontFamily: FF.display, fontSize: 40, lineHeight: 0.9, color: "#fff", textShadow: `0 3px 0 ${FC.accent}` }}>{shirt.num || "–"}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontFamily: FF.ui, fontSize: 20, lineHeight: 1.05, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shirt.label || shirt.name}</span>
                <span style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{shirt.name} · {shirt.role === "occasionnel" ? "Occasionnel" : "Régulier"} · voir sa fiche</span>
              </span>
            </button>
            <button onClick={() => room.current && room.current.step(1)} aria-label="Maillot suivant" style={roundBtn}>›</button>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
            <FootRoomStat label="Matchs" value={row ? row.played : 0} />
            <FootRoomStat label="Buts" value={row ? row.goals : 0} />
            <FootRoomStat label="Passes D" value={row ? row.assists : 0} />
            <FootRoomStat label="Note" value={row && row.rating != null ? row.rating.toFixed(1) : "–"} />
            <FootRoomStat label="HDM" value={row ? row.motm : 0} />
          </div>
          <div style={{ textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 6, letterSpacing: "0.04em" }}>Saison {season} · glisse pour parcourir · touche le maillot pour le retourner</div>
        </div>
      )}
      {state === "ready" && hint && !paper && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: "calc(98px + env(safe-area-inset-bottom))", textAlign: "center", pointerEvents: "none" }}>
          <span style={{ ...glass, display: "inline-block", padding: "7px 14px", fontSize: 12, borderRadius: 999 }}>{hint}</span>
        </div>
      )}
      {/* the next-match sheet, readable */}
      {paper && (
        <div onClick={() => setPaper(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "#fbf9f3", borderRadius: 6, boxShadow: "0 20px 50px rgba(0,0,0,0.5)", overflow: "hidden", transform: "rotate(-1deg)" }}>
            <div style={{ background: FC.accent, color: "#fff", fontFamily: FF.ui, fontSize: 18, letterSpacing: "0.06em", textAlign: "center", padding: "12px 0" }}>PROCHAIN MATCH</div>
            <div style={{ padding: "16px 18px 18px", color: "#1b1b1b" }}>
              <div style={{ fontFamily: FF.display, fontSize: 28, lineHeight: 1.1, marginBottom: 10 }}>vs {paper.opponent_name}</div>
              <FootWhenWhere match={paper} size={15} />
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <FBtn full onClick={() => nav("matchDetail", { matchId: paper.id })}>Ouvrir le match</FBtn>
                <FBtn variant="ghost" onClick={() => setPaper(null)}>Fermer</FBtn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FootballApp({ currentPlayer, onBack }) {
  const [theme, setThemeState] = React.useState(() => readPref("foot_theme", "green", ["green", "pink"]));
  setFootTheme(theme); // the colour tokens must be current before any child renders
  const [page, setPage] = React.useState("calendar");
  const [sub, setSub] = React.useState({});
  const [loaded, setLoaded] = React.useState(false);
  const [loadError, setLoadError] = React.useState(null);
  const [roster, setRoster] = React.useState([]);
  const [matches, setMatches] = React.useState([]);
  const [attendance, setAttendance] = React.useState([]);
  const [events, setEvents] = React.useState([]);
  const [lineups, setLineups] = React.useState([]);
  const [ratings, setRatings] = React.useState([]);
  const [photos, setPhotos] = React.useState([]);
  const [framings, setFramings] = React.useState([]);
  const [activities, setActivities] = React.useState([]);
  const [motmVotes, setMotmVotes] = React.useState([]);
  const [activityAttendance, setActivityAttendance_] = React.useState([]);

  const isAdmin = isBureau(currentPlayer);
  const setTheme = (t) => { setThemeState(t); writePref("foot_theme", t); };
  // 3D club room (beta, bureau only for now): Calendrier / Classement / Vestiaire become corners of one locker room
  const [roomPref, setRoomPref] = React.useState(() => readPref("foot_room", "off", ["on", "off"]));
  const roomOn = isAdmin && roomPref === "on";
  const setRoom = (on) => {
    setRoomPref(on ? "on" : "off"); writePref("foot_room", on ? "on" : "off");
    setPage((p) => (on && p === "stats" ? "vestiaire" : !on && p === "vestiaire" ? "stats" : p));
  };

  React.useEffect(() => {
    // the browser bar follows the theme
    const meta = document.querySelector('meta[name="theme-color"]');
    const previous = meta ? meta.getAttribute("content") : null;
    if (meta) meta.setAttribute("content", FC.accent);
    return () => { if (meta && previous) meta.setAttribute("content", previous); };
  }, [theme]);

  async function reloadFoot() {
    const [r, m, a, e, l, rt, ph, fr, ac, aa, mv] = await Promise.all([
      sbFetch("foot_roster", "?select=*"),
      sbFetch("foot_matches", "?select=*&order=match_datetime"),
      sbFetch("foot_attendance", "?select=*"),
      sbFetch("foot_match_events", "?select=*"),
      sbFetch("foot_lineups", "?select=match_id,player_id"),
      sbFetch("foot_ratings", "?select=match_id,rater_id,ratee_id,score"),
      sbFetch("foot_player_photos", "?select=*").catch(() => []), // optional: absent until the insta migration is applied
      sbFetch("foot_photo_framings", "?select=*").catch(() => []),
      sbFetch("foot_activities", "?select=*&order=starts_at").catch(() => []), // optional: absent until the activities migration is applied
      sbFetch("foot_activity_attendance", "?select=*").catch(() => []),
      sbFetch("foot_motm_votes", "?select=match_id,voter_id,player_id").catch(() => []), // optional: absent until the man-of-the-match migration is applied
    ]);
    setMotmVotes(mv || []);
    setActivities(ac || []);
    setActivityAttendance_(aa || []);
    setRoster(r || []);
    setMatches(m || []);
    setAttendance(a || []);
    setEvents(e || []);
    setLineups(l || []);
    setPhotos(ph || []);
    setFramings(fr || []);
    setRatings((rt || []).map((x) => ({ ...x, score: Number(x.score) })));
    return ph || [];
  }

  // Opening screen: loads everything the three main pages need (calendar data, player pictures, fonts and backgrounds)
  // so nothing pops in afterwards. The steps tick off for real; the screen stays at least MIN_MS so it never flashes.
  const [steps, setSteps] = React.useState({ calendar: false, rankings: false, stats: false });
  const [leaving, setLeaving] = React.useState(false);
  const [splashOn, setSplashOn] = React.useState(true);
  React.useEffect(() => {
    let alive = true;
    const MIN_MS = 1500, started = Date.now();
    const tick = (k) => alive && setSteps((o) => ({ ...o, [k]: true }));
    const withTimeout = (p, ms) => Promise.race([p, new Promise((res) => setTimeout(res, ms))]);
    const preload = (url) => new Promise((res) => { const im = new Image(); im.onload = im.onerror = () => res(); im.src = url; });
    (async () => {
      let photoRows = [];
      try { photoRows = await reloadFoot(); } catch (err) { console.warn("foot load failed", err); if (alive) setLoadError(err.message); }
      tick("calendar");
      const faces = photoRows.filter((x) => x.kind === "render").map((x) => instaPublicUrl(x.path));
      await withTimeout(Promise.all(faces.map(preload)), 5000);
      tick("rankings");
      const bgs = ["/assets/foot/bg-green.jpg?v=crt1", "/assets/foot/bg-pink.jpg?v=crt1", "/logo-bl.png", "/logo-bl-rose.png"];
      await withTimeout(Promise.all([document.fonts ? document.fonts.ready : null, ...bgs.map(preload)]), 4000);
      tick("stats");
      await new Promise((res) => setTimeout(res, Math.max(350, MIN_MS - (Date.now() - started))));
      if (!alive) return;
      setLoaded(true);
      setLeaving(true);
      setTimeout(() => alive && setSplashOn(false), 450);
    })();
    return () => { alive = false; };
  }, []);

  function nav(p, s = {}) { setPage(p); setSub(s); window.scrollTo && window.scrollTo(0, 0); }

  const navItems = [
    { id: "calendar", label: "Calendrier", icon: "calendar" },
    { id: "rankings", label: "Classement", icon: "trophy" },
    roomOn ? { id: "vestiaire", label: "Vestiaire", icon: "shirt" } : { id: "stats", label: "Stats", icon: "chart" },
    ...(isAdmin ? [{ id: "reseaux", label: "Réseaux", icon: "megaphone" }, { id: "admin", label: "Admin", icon: "sliders" }] : []),
  ];
  const detail = page === "matchDetail";
  const playerPage = page === "player";
  const openPlayer = (id) => nav("player", { playerId: id, from: { page: playerPage ? sub.from.page : page, sub: playerPage ? sub.from.sub : sub } });
  const backFromPlayer = () => nav(sub.from ? sub.from.page : roomOn ? "vestiaire" : "stats", sub.from ? sub.from.sub : {});
  const roomVisible = roomOn && loaded && !!FOOT_ROOM_ZONES[page];
  const openMatch = detail ? matches.find((m) => m.id === sub.matchId) : null;
  const [title, subtitle] = playerPage ? [footNameOf(sub.playerId), "Stats du joueur"] : detail
    ? [openMatch ? { scheduled: "Match", live: "En direct", finished: "Résultat" }[openMatch.status] : "Match", openMatch ? `vs ${openMatch.opponent_name}` : null]
    : FOOT_PAGE_TITLES[page] || ["Foot", null];

  return (
    <FootCtx.Provider value={{ photos, framings, themeName: theme, openPlayer }}>
      {roomOn && loaded && (
        <FootRoomScreen visible={roomVisible} page={page} theme={theme} setTheme={setTheme} onHome={onBack} onLeaveRoom={() => setRoom(false)}
          roster={roster} matches={matches} events={events} lineups={lineups} ratings={ratings} motmVotes={motmVotes} currentPlayer={currentPlayer} nav={nav} openPlayer={openPlayer} />
      )}
      {!roomVisible && <FootShell wide={page === "stats" || page === "reseaux" || playerPage}>
        <FTopBar title={title} subtitle={subtitle} theme={theme} onTheme={setTheme} onHome={onBack} onBack={detail ? () => nav("calendar") : playerPage ? backFromPlayer : undefined}
          right={isAdmin && !roomOn ? <FIconBtn icon="cube" label="Essayer le vestiaire 3D" tone="glass" onClick={() => setRoom(true)} /> : null} />
        {loaded && loadError && <FMessage>Chargement incomplet : {loadError}</FMessage>}
        {loaded && page === "calendar" && <FootCalendarPage matches={matches} events={events} roster={roster} attendance={attendance} activities={activities} activityAttendance={activityAttendance} nav={nav} currentPlayer={currentPlayer} reload={reloadFoot} />}
        {loaded && detail && (
          <FootMatchDetailPage
            matchId={sub.matchId} matches={matches} roster={roster} attendance={attendance} events={events} lineups={lineups} ratings={ratings} motmVotes={motmVotes}
            currentPlayer={currentPlayer} navBack={() => nav("calendar")} reload={reloadFoot}
          />
        )}
        {loaded && page === "admin" && isAdmin && <FootAdminPage roster={roster} activities={activities} reload={reloadFoot} />}
        {loaded && page === "reseaux" && isAdmin && <FootReseauxPage roster={roster} photos={photos} framings={framings} matches={matches} lineups={lineups} events={events} ratings={ratings} reload={reloadFoot} />}
        {loaded && page === "rankings" && <FootRankingsPage />}
        {loaded && page === "stats" && <FootStatsPage matches={matches} lineups={lineups} events={events} ratings={ratings} motmVotes={motmVotes} roster={roster} currentPlayer={currentPlayer} />}
        {loaded && playerPage && <FootStatsPage key={sub.playerId} matches={matches} lineups={lineups} events={events} ratings={ratings} motmVotes={motmVotes} roster={roster} currentPlayer={currentPlayer} subjectId={sub.playerId} />}
      </FootShell>}
      <FNav page={detail ? "calendar" : playerPage ? (roomOn ? "vestiaire" : "stats") : page} items={navItems} onGo={nav} />
      {splashOn && <FootSplash steps={steps} leaving={leaving} theme={theme} />}
    </FootCtx.Provider>
  );
}
