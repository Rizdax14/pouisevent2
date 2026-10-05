// foot.jsx — screens of the football app (design system: foot-ui.jsx, tokens: foot-theme.js)

// ---- data helpers ------------------------------------------------------------------------------------------
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
  await applyLineupChange(matchId, diffLineup(currentIds, wantedIds));
}
async function applyLineupChange(matchId, {
  add,
  remove
}) {
  await addToLineup(matchId, add);
  if (remove.length) {
    await sbFetch("foot_lineups", `?match_id=eq.${matchId}&player_id=in.(${remove.join(",")})`, {
      method: "DELETE"
    });
  }
}
function attendanceRoster(roster) {
  return roster.filter(r => r.role !== "invite");
}
function lineupIdsFor(lineups, matchId) {
  return lineups.filter(l => l.match_id === matchId).map(l => l.player_id);
}
function formatMatchPlace(match) {
  const cityLine = [match.postal_code, match.city].filter(Boolean).join(" ");
  return [match.stadium_name, match.address, cityLine].filter(Boolean).join(" · ");
}
const footNameOf = id => {
  const p = PLAYERS.find(x => x.id === id);
  return p ? getDisplayName(p, PLAYERS) : "?";
};
const footDayMs = 86400000;
function footDate(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/Paris"
  });
}
function footTime(iso) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris"
  });
}
const FOOT_OUTCOME_TONE = {
  V: "good",
  N: "warn",
  D: "bad"
};
const FOOT_OUTCOME_LABEL = {
  V: "Victoire",
  N: "Nul",
  D: "Défaite"
};

// ---- small shared bits ---------------------------------------------------------------------------------------
function FootMetaChips({
  match
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(FChip, {
    tone: "soft"
  }, match.venue === "exterieur" ? "Extérieur" : "Domicile"), /*#__PURE__*/React.createElement(FChip, {
    tone: "soft"
  }, match.match_type === "amical" ? "Amical" : "Championnat"));
}
function FootWhenWhere({
  match,
  size = 14
}) {
  const place = formatMatchPlace(match);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 5,
      fontSize: size,
      color: FC.muted
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(FIcon, {
    name: "calendar",
    size: 16
  }), footDate(match.match_datetime), " \xB7 ", footTime(match.match_datetime)), place && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(FIcon, {
    name: "pin",
    size: 16,
    style: {
      marginTop: 1
    }
  }), /*#__PURE__*/React.createElement("span", null, place)));
}

// A player as a pill: round portrait, name, optional jersey number.
function FootPlayerPill({
  id,
  number,
  tone = "soft",
  dim
}) {
  const name = footNameOf(id);
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 7,
      background: tone === "soft" ? FC.soft : "transparent",
      border: tone === "soft" ? "none" : `1px solid ${FC.line}`,
      borderRadius: 999,
      padding: "4px 12px 4px 4px",
      fontSize: 14,
      color: dim ? FC.muted : FC.text,
      maxWidth: "100%"
    }
  }, /*#__PURE__*/React.createElement(FAvatar, {
    playerId: id,
    name: name,
    size: 28
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, name), number && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: FF.ui,
      fontSize: 12,
      color: FC.deep,
      background: FC.solid,
      borderRadius: 999,
      padding: "1px 7px"
    }
  }, number));
}
function FootAttendanceButtons({
  myStatus,
  saving,
  onSet,
  compact
}) {
  const pick = status => e => {
    e.stopPropagation();
    onSet(status);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(FBtn, {
    variant: myStatus === "present" ? "success" : "ghost",
    size: compact ? "md" : "lg",
    icon: "check",
    disabled: saving,
    onClick: pick("present"),
    style: {
      flex: 1
    }
  }, "Pr\xE9sent"), /*#__PURE__*/React.createElement(FBtn, {
    variant: myStatus === "absent" ? "danger" : "ghost",
    size: compact ? "md" : "lg",
    icon: "x",
    disabled: saving,
    onClick: pick("absent"),
    style: {
      flex: 1
    }
  }, "Absent"));
}

// ---- lineup (feuille de match) ------------------------------------------------------------------------------------
function FootLineupChecklist({
  roster,
  extraIds,
  checked,
  onToggle,
  disabled
}) {
  const ids = [...new Set([...roster.map(r => r.player_id), ...(extraIds || [])])];
  const numberOf = id => (roster.find(r => r.player_id === id) || {}).jersey_number;
  const players = ids.map(id => PLAYERS.find(p => p.id === id)).filter(Boolean).sort((a, b) => (getDisplayName(a, PLAYERS) || "").localeCompare(getDisplayName(b, PLAYERS) || ""));
  if (players.length === 0) return /*#__PURE__*/React.createElement(FEmpty, {
    icon: "users",
    title: "Aucun joueur",
    text: "Ajoute des joueurs \xE0 l'effectif dans l'onglet Admin."
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 6
    }
  }, players.map(p => {
    const on = checked.includes(p.id);
    return /*#__PURE__*/React.createElement("label", {
      key: p.id,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 10px 6px 6px",
        borderRadius: 16,
        background: on ? FC.accentSoft : FC.softer,
        border: `1.5px solid ${on ? FC.accent : "transparent"}`,
        cursor: disabled ? "default" : "pointer",
        fontSize: 15
      }
    }, /*#__PURE__*/React.createElement(FAvatar, {
      playerId: p.id,
      name: getDisplayName(p, PLAYERS),
      size: 34
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, getDisplayName(p, PLAYERS)), numberOf(p.id) && /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: FF.ui,
        fontSize: 13,
        color: FC.deep
      }
    }, "n\xB0", numberOf(p.id)), /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: on,
      disabled: disabled,
      onChange: () => onToggle(p.id)
    }));
  }));
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
  const [snapshot, setSnapshot] = React.useState(current);
  const [wanted, setWanted] = React.useState(current);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const toggle = id => setWanted(wanted.includes(id) ? wanted.filter(x => x !== id) : [...wanted, id]);
  async function save() {
    setSaving(true);
    setErr(null);
    try {
      await applyLineupChange(match.id, diffLineupEdit(snapshot, current, wanted));
      await reload();
      setEditing(false);
    } catch (e) {
      console.warn("lineup save failed", e);
      setErr("Enregistrement impossible : " + e.message);
    }
    setSaving(false);
  }
  const numberOf = id => (roster.find(r => r.player_id === id) || {}).jersey_number;
  const ordered = [...current].sort((a, b) => (Number(numberOf(a)) || 999) - (Number(numberOf(b)) || 999) || footNameOf(a).localeCompare(footNameOf(b)));
  return /*#__PURE__*/React.createElement(FCard, null, /*#__PURE__*/React.createElement(FHeading, {
    right: isAdmin && !editing && /*#__PURE__*/React.createElement(FBtn, {
      size: "sm",
      variant: "secondary",
      icon: "pencil",
      onClick: () => {
        setSnapshot(current);
        setWanted(current);
        setEditing(true);
      }
    }, "Modifier")
  }, "Feuille de match ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: FF.ui,
      fontSize: 15,
      color: FC.muted
    }
  }, "(", current.length, ")")), !editing && (ordered.length ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8
    }
  }, ordered.map(id => /*#__PURE__*/React.createElement(FootPlayerPill, {
    key: id,
    id: id,
    number: numberOf(id)
  }))) : /*#__PURE__*/React.createElement(FEmpty, {
    icon: "users",
    title: "Pas encore de feuille",
    text: isAdmin ? "Choisis les joueurs qui seront sur la feuille de match." : "La feuille de match n'est pas encore publiée."
  })), editing && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(FootLineupChecklist, {
    roster: roster,
    extraIds: current,
    checked: wanted,
    onToggle: toggle,
    disabled: saving
  }), err && /*#__PURE__*/React.createElement(FMessage, {
    style: {
      marginTop: 10
    }
  }, err), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(FBtn, {
    variant: "ghost",
    onClick: () => setEditing(false),
    disabled: saving,
    style: {
      flex: 1
    }
  }, "Annuler"), /*#__PURE__*/React.createElement(FBtn, {
    onClick: save,
    disabled: saving,
    style: {
      flex: 1
    }
  }, saving ? "…" : `Enregistrer (${wanted.length})`))));
}

// ---- match form (create / edit) ----------------------------------------------------------------------------------------
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
    city: "",
    match_type: "championnat",
    venue: "domicile"
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
        t: "bad",
        m: "Adversaire et date/heure sont obligatoires."
      });
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
        city: (f.city || "").trim() || null
      });
      if (resetOnSuccess) setF(empty);
      setMsg({
        t: "good",
        m: "Enregistré ✓"
      });
    } catch (e) {
      setMsg({
        t: "bad",
        m: "Erreur : " + e.message
      });
    }
    setSaving(false);
  }
  return /*#__PURE__*/React.createElement(FCard, null, /*#__PURE__*/React.createElement(FHeading, null, title), /*#__PURE__*/React.createElement(FField, {
    label: "\xC9quipe adverse"
  }, /*#__PURE__*/React.createElement("input", {
    style: FOOT_INPUT_STYLE,
    placeholder: "Ex. En Avant Guinguette",
    value: f.opponent_name,
    onChange: set("opponent_name")
  })), /*#__PURE__*/React.createElement(FField, {
    label: "Date et heure"
  }, /*#__PURE__*/React.createElement("input", {
    style: FOOT_INPUT_STYLE,
    type: "datetime-local",
    value: f.match_datetime,
    onChange: set("match_datetime")
  })), /*#__PURE__*/React.createElement(FLabel, null, "Lieu"), /*#__PURE__*/React.createElement(FSegmented, {
    value: f.venue || "domicile",
    onChange: v => setF({
      ...f,
      venue: v
    }),
    options: [["domicile", "Domicile"], ["exterieur", "Extérieur"]],
    style: {
      marginBottom: 12
    }
  }), /*#__PURE__*/React.createElement(FLabel, null, "Type"), /*#__PURE__*/React.createElement(FSegmented, {
    value: f.match_type || "championnat",
    onChange: v => setF({
      ...f,
      match_type: v
    }),
    options: [["championnat", "Championnat"], ["amical", "Amical"]],
    style: {
      marginBottom: 14
    }
  }), /*#__PURE__*/React.createElement(FField, {
    label: "Stade"
  }, /*#__PURE__*/React.createElement("input", {
    style: FOOT_INPUT_STYLE,
    placeholder: "Nom du stade",
    value: f.stadium_name || "",
    onChange: set("stadium_name")
  })), /*#__PURE__*/React.createElement(FField, {
    label: "Adresse"
  }, /*#__PURE__*/React.createElement("input", {
    style: FOOT_INPUT_STYLE,
    placeholder: "Adresse",
    value: f.address || "",
    onChange: set("address")
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(FField, {
    label: "Code postal",
    style: {
      flex: "0 0 38%"
    }
  }, /*#__PURE__*/React.createElement("input", {
    style: FOOT_INPUT_STYLE,
    inputMode: "numeric",
    placeholder: "42000",
    value: f.postal_code || "",
    onChange: set("postal_code")
  })), /*#__PURE__*/React.createElement(FField, {
    label: "Ville",
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("input", {
    style: FOOT_INPUT_STYLE,
    placeholder: "Ville",
    value: f.city || "",
    onChange: set("city")
  }))), msg && /*#__PURE__*/React.createElement(FMessage, {
    tone: msg.t
  }, msg.m), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, onCancel && /*#__PURE__*/React.createElement(FBtn, {
    variant: "ghost",
    onClick: onCancel,
    disabled: saving,
    style: {
      flex: 1
    }
  }, "Annuler"), /*#__PURE__*/React.createElement(FBtn, {
    onClick: submit,
    disabled: saving,
    style: {
      flex: 1
    }
  }, saving ? "Enregistrement…" : submitLabel)));
}
function FootCreateMatchForm({
  reload
}) {
  const [open, setOpen] = React.useState(false);
  if (!open) return /*#__PURE__*/React.createElement(FBtn, {
    full: true,
    size: "lg",
    icon: "plus",
    onClick: () => setOpen(true),
    style: {
      marginBottom: 14
    }
  }, "Nouveau match");
  return /*#__PURE__*/React.createElement(FootMatchForm, {
    title: "Nouveau match",
    submitLabel: "Cr\xE9er le match",
    resetOnSuccess: true,
    onCancel: () => setOpen(false),
    onSubmit: async data => {
      await sbInsert("foot_matches", data);
      await reload();
      setOpen(false);
    }
  });
}

// ---- calendar ---------------------------------------------------------------------------------------------------------------
function FootPresenceStack({
  ids,
  total
}) {
  const shown = ids.slice(0, 6);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex"
    }
  }, shown.map((id, i) => /*#__PURE__*/React.createElement("span", {
    key: id,
    style: {
      marginLeft: i ? -9 : 0,
      borderRadius: 20,
      boxShadow: `0 0 0 2px ${FC.solid}`
    }
  }, /*#__PURE__*/React.createElement(FAvatar, {
    playerId: id,
    name: footNameOf(id),
    size: 30
  })))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: FC.muted
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      color: FC.text,
      fontFamily: FF.ui,
      fontSize: 16
    }
  }, ids.length), " / ", total, " pr\xE9sents"));
}
function FootMatchHero({
  match,
  score,
  presentIds,
  rosterSize,
  onOpen,
  isOnRoster,
  myStatus,
  onSetStatus,
  saving
}) {
  const live = match.status === "live";
  return /*#__PURE__*/React.createElement(FCard, {
    onClick: onOpen,
    pad: 20,
    style: {
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10
    }
  }, live ? /*#__PURE__*/React.createElement(FChip, {
    tone: "live"
  }, "En direct") : /*#__PURE__*/React.createElement(FChip, {
    tone: "accent"
  }, "Prochain match"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: FF.ui,
      fontSize: 14,
      color: FC.deep
    }
  }, footRelative(match.match_datetime))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.ui,
      fontSize: 14,
      color: FC.muted,
      letterSpacing: "0.05em",
      textTransform: "uppercase"
    }
  }, "Bi\xE8re Leverculsec"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.display,
      fontSize: 30,
      lineHeight: 1.15,
      color: FC.deep,
      minWidth: 0,
      overflowWrap: "anywhere"
    }
  }, "vs ", match.opponent_name), live && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.display,
      fontSize: 34,
      color: FC.deep,
      whiteSpace: "nowrap"
    }
  }, score.bl, "\u2013", score.opponent)), /*#__PURE__*/React.createElement(FootWhenWhere, {
    match: match
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: "12px 0"
    }
  }, /*#__PURE__*/React.createElement(FootMetaChips, {
    match: match
  })), !live && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(FootPresenceStack, {
    ids: presentIds,
    total: rosterSize
  }), isOnRoster && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(FootAttendanceButtons, {
    myStatus: myStatus,
    saving: saving,
    onSet: onSetStatus
  }))));
}
function FootMatchRow({
  match,
  score,
  onOpen
}) {
  const finished = match.status !== "scheduled";
  const out = finished ? footOutcome(score) : null;
  const dt = new Date(match.match_datetime);
  return /*#__PURE__*/React.createElement(FCard, {
    onClick: onOpen,
    pad: 12,
    style: {
      marginBottom: 10,
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, finished ? /*#__PURE__*/React.createElement("span", {
    title: FOOT_OUTCOME_LABEL[out],
    style: {
      width: 44,
      height: 44,
      borderRadius: 22,
      flexShrink: 0,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: FF.display,
      fontSize: 20,
      background: FC[FOOT_OUTCOME_TONE[out]],
      color: "#fff"
    }
  }, out) : /*#__PURE__*/React.createElement("span", {
    style: {
      width: 44,
      flexShrink: 0,
      textAlign: "center",
      lineHeight: 1.05
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      fontFamily: FF.display,
      fontSize: 22,
      color: FC.deep
    }
  }, dt.toLocaleDateString("fr-FR", {
    day: "numeric",
    timeZone: "Europe/Paris"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      fontFamily: FF.ui,
      fontSize: 12,
      color: FC.muted,
      textTransform: "uppercase"
    }
  }, dt.toLocaleDateString("fr-FR", {
    month: "short",
    timeZone: "Europe/Paris"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.ui,
      fontSize: 18,
      lineHeight: 1.2,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, match.opponent_name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: FC.muted,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, finished ? footDate(match.match_datetime) : `${footDate(match.match_datetime)} · ${footTime(match.match_datetime)}`, " \xB7 ", match.venue === "exterieur" ? "Extérieur" : "Domicile", match.match_type === "amical" ? " · Amical" : "")), finished ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.display,
      fontSize: 26,
      color: FC.deep,
      whiteSpace: "nowrap"
    }
  }, score.bl, "\u2013", score.opponent) : /*#__PURE__*/React.createElement(FIcon, {
    name: "chevron",
    size: 20,
    style: {
      color: FC.muted
    }
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
  const presenceRoster = attendanceRoster(roster);
  const isOnRoster = presenceRoster.some(r => r.player_id === currentPlayer?.id);
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
    return /*#__PURE__*/React.createElement(FCard, null, /*#__PURE__*/React.createElement(FEmpty, {
      icon: "calendar",
      title: "Aucun match",
      text: "Les matchs appara\xEEtront ici d\xE8s qu'ils seront cr\xE9\xE9s."
    }));
  }
  const scoreOf = m => computeFootScore(events.filter(e => e.match_id === m.id));
  const featured = footFeaturedMatch(matches);
  const upcoming = matches.filter(m => m.status === "scheduled" && m !== featured).sort((a, b) => new Date(a.match_datetime) - new Date(b.match_datetime));
  const past = matches.filter(m => m.status === "finished" || m.status === "live" && m !== featured).sort((a, b) => new Date(b.match_datetime) - new Date(a.match_datetime));
  const open = m => () => nav("matchDetail", {
    matchId: m.id
  });
  const heroAttendance = featured ? attendance.filter(a => a.match_id === featured.id) : [];
  const section = (label, list) => list.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement(FTitle, {
    size: 20,
    style: {
      marginBottom: 10
    }
  }, label), list.map(m => /*#__PURE__*/React.createElement(FootMatchRow, {
    key: m.id,
    match: m,
    score: scoreOf(m),
    onOpen: open(m)
  })));
  return /*#__PURE__*/React.createElement("div", {
    className: "ft-page"
  }, featured && /*#__PURE__*/React.createElement(FootMatchHero, {
    match: featured,
    score: scoreOf(featured),
    onOpen: open(featured),
    presentIds: computeAttendanceBuckets(presenceRoster, heroAttendance).present,
    rosterSize: presenceRoster.length,
    isOnRoster: isOnRoster,
    myStatus: heroAttendance.find(a => a.player_id === currentPlayer?.id)?.status || null,
    saving: savingMatchId === featured.id,
    onSetStatus: status => setStatus(featured.id, status)
  }), section("À venir", upcoming), section("Résultats", past));
}

// ---- roster & admin -------------------------------------------------------------------------------------------------------------
function FootRosterManager({
  roster,
  reload
}) {
  const [saving, setSaving] = React.useState(null); // player id currently being saved
  const [search, setSearch] = React.useState("");
  const roleByPlayer = {};
  const numberByPlayer = {};
  roster.forEach(r => {
    roleByPlayer[r.player_id] = r.role;
    numberByPlayer[r.player_id] = r.jersey_number;
  });
  async function setNumber(playerId, v) {
    if (v !== "" && !/^[0-9]{1,3}$/.test(v)) {
      console.warn("invalid jersey number", v);
      await reload();
      return;
    }
    setSaving(playerId);
    try {
      await sbUpdate("foot_roster", {
        player_id: playerId
      }, {
        jersey_number: v || null
      });
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
  // Team members first, then everybody else (to add them).
  const sortedPlayers = [...PLAYERS].sort((a, b) => (roleByPlayer[b.id] ? 1 : 0) - (roleByPlayer[a.id] ? 1 : 0) || nameOf(a).localeCompare(nameOf(b)));
  const visiblePlayers = filterPlayersByName(sortedPlayers, search, nameOf);
  return /*#__PURE__*/React.createElement(FCard, null, /*#__PURE__*/React.createElement(FHeading, {
    right: /*#__PURE__*/React.createElement(FChip, {
      tone: "soft"
    }, roster.length, " joueurs")
  }, "Effectif"), /*#__PURE__*/React.createElement("input", {
    style: FOOT_INPUT_STYLE,
    placeholder: "Rechercher un joueur\u2026",
    value: search,
    onChange: e => setSearch(e.target.value),
    "aria-label": "Rechercher un joueur"
  }), visiblePlayers.length === 0 && /*#__PURE__*/React.createElement(FEmpty, {
    icon: "users",
    title: "Aucun r\xE9sultat",
    text: `Aucun joueur ne correspond à « ${search} ».`
  }), visiblePlayers.map(p => {
    const inTeam = !!roleByPlayer[p.id];
    return /*#__PURE__*/React.createElement("div", {
      key: p.id,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 0",
        borderTop: `1px solid ${FC.line}`,
        opacity: inTeam ? 1 : 0.75
      }
    }, /*#__PURE__*/React.createElement(FAvatar, {
      playerId: p.id,
      name: nameOf(p),
      size: 38
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0,
        fontSize: 15,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, nameOf(p)), inTeam && /*#__PURE__*/React.createElement("input", {
      key: `${p.id}-${numberByPlayer[p.id] || ""}`,
      defaultValue: numberByPlayer[p.id] || "",
      placeholder: "n\xB0",
      inputMode: "numeric",
      maxLength: 3,
      "aria-label": `Numéro de ${nameOf(p)}`,
      onBlur: e => {
        const v = e.target.value.trim();
        if (v !== (numberByPlayer[p.id] || "")) setNumber(p.id, v);
      },
      style: {
        ...FOOT_INPUT_STYLE,
        width: 58,
        marginBottom: 0,
        textAlign: "center",
        padding: "8px 6px",
        minHeight: 40,
        fontFamily: FF.ui
      }
    }), /*#__PURE__*/React.createElement("select", {
      value: roleByPlayer[p.id] || "",
      disabled: saving === p.id,
      onChange: e => setRole(p.id, e.target.value),
      "aria-label": `Rôle de ${nameOf(p)}`,
      style: {
        ...FOOT_SELECT_STYLE,
        maxWidth: 138
      }
    }, /*#__PURE__*/React.createElement("option", {
      value: ""
    }, "Hors \xE9quipe"), /*#__PURE__*/React.createElement("option", {
      value: "regulier"
    }, "R\xE9gulier"), /*#__PURE__*/React.createElement("option", {
      value: "occasionnel"
    }, "Occasionnel"), /*#__PURE__*/React.createElement("option", {
      value: "invite"
    }, "Invit\xE9")));
  }));
}
function FootAdminPage({
  roster,
  reload
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "ft-page"
  }, /*#__PURE__*/React.createElement(FootCreateMatchForm, {
    reload: reload
  }), /*#__PURE__*/React.createElement(FootRosterManager, {
    roster: roster,
    reload: reload
  }));
}

// ---- match detail ----------------------------------------------------------------------------------------------------------------
function footHalfLabel(n) {
  return n === 1 ? "1re mi-temps" : `${n}e mi-temps`;
}

// "1re mi-temps · 17'" — ticks every second while the half is running.
function FootLiveClock({
  match
}) {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    if (!match.half_started_at) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [match.half_started_at]);
  const secs = computeHalfElapsedSeconds(match.half_started_at, match.half_elapsed_seconds, now);
  const running = !!match.half_started_at;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      fontFamily: FF.ui,
      fontSize: 16,
      color: FC.deep,
      marginTop: 4
    }
  }, footHalfLabel(match.current_half || 1), " \xB7 ", running ? `${Math.floor(secs / 60)}'` : secs > 0 ? "terminée" : "à démarrer");
}
function FootTeamMark({
  name,
  logo
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      minWidth: 0
    }
  }, logo ? /*#__PURE__*/React.createElement("img", {
    src: "/logo-bl.png",
    alt: "",
    style: {
      width: 54,
      height: 54,
      borderRadius: 27,
      objectFit: "cover",
      background: FC.soft,
      display: "block",
      margin: "0 auto 6px"
    }
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      width: 54,
      height: 54,
      borderRadius: 27,
      background: FC.soft,
      color: FC.deep,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: FF.display,
      fontSize: 21,
      margin: "0 auto 6px"
    }
  }, playerInitials(name)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.ui,
      fontSize: 16,
      lineHeight: 1.15,
      overflowWrap: "anywhere"
    }
  }, name));
}
function FootScoreboard({
  match,
  score
}) {
  const live = match.status === "live",
    finished = match.status === "finished";
  const out = finished ? footOutcome(score) : null;
  return /*#__PURE__*/React.createElement(FCard, {
    pad: 20
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 14
    }
  }, live ? /*#__PURE__*/React.createElement(FChip, {
    tone: "live"
  }, "En direct") : finished ? /*#__PURE__*/React.createElement(FChip, {
    tone: FOOT_OUTCOME_TONE[out]
  }, FOOT_OUTCOME_LABEL[out]) : /*#__PURE__*/React.createElement(FChip, {
    tone: "accent"
  }, "\xC0 venir"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: FF.ui,
      fontSize: 14,
      color: FC.muted
    }
  }, footRelative(match.match_datetime))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr auto 1fr",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(FootTeamMark, {
    name: "Bi\xE8re Leverculsec",
    logo: true
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.display,
      fontSize: live || finished ? 46 : 32,
      color: FC.deep,
      whiteSpace: "nowrap",
      lineHeight: 1
    }
  }, live || finished ? `${score.bl} – ${score.opponent}` : "VS"), /*#__PURE__*/React.createElement(FootTeamMark, {
    name: match.opponent_name
  })), live && /*#__PURE__*/React.createElement(FootLiveClock, {
    match: match
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: FC.line,
      margin: "16px 0 12px"
    }
  }), /*#__PURE__*/React.createElement(FootWhenWhere, {
    match: match
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(FootMetaChips, {
    match: match
  })));
}
function FootStartMatchConfig({
  match,
  roster,
  attendance,
  lineups,
  currentPlayer,
  reload,
  onCancel
}) {
  const [nbHalves, setNbHalves] = React.useState(2);
  const [halfDuration, setHalfDuration] = React.useState(45);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const presentIds = attendance.filter(a => a.match_id === match.id && a.status === "present").map(a => a.player_id);
  const existingSheet = lineupIdsFor(lineups || [], match.id);
  const [sheet, setSheet] = React.useState(existingSheet.length ? existingSheet : presentIds.filter(id => roster.some(r => r.player_id === id)));
  const toggle = id => setSheet(sheet.includes(id) ? sheet.filter(x => x !== id) : [...sheet, id]);
  async function start() {
    setSaving(true);
    setErr(null);
    try {
      await saveLineup(match.id, lineupIdsFor(lineups || [], match.id), sheet);
      await sbUpdate("foot_matches", {
        id: match.id
      }, {
        status: "live",
        started_by: currentPlayer.id,
        nb_halves: nbHalves,
        half_duration_min: halfDuration,
        current_half: 1,
        half_started_at: null,
        half_elapsed_seconds: 0
      });
      await reload();
    } catch (e) {
      console.warn("start match failed", e);
      setErr("Impossible de démarrer : " + e.message);
      setSaving(false);
    }
  }
  return /*#__PURE__*/React.createElement(FCard, null, /*#__PURE__*/React.createElement(FHeading, null, "Lancer le match"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(FField, {
    label: "Mi-temps",
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("select", {
    value: nbHalves,
    onChange: e => setNbHalves(Number(e.target.value)),
    style: FOOT_INPUT_STYLE
  }, [1, 2, 3, 4].map(n => /*#__PURE__*/React.createElement("option", {
    key: n,
    value: n
  }, n)))), /*#__PURE__*/React.createElement(FField, {
    label: "Dur\xE9e (min)",
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: 1,
    inputMode: "numeric",
    value: halfDuration,
    onChange: e => setHalfDuration(Number(e.target.value)),
    style: FOOT_INPUT_STYLE
  }))), /*#__PURE__*/React.createElement(FLabel, null, "Feuille de match (", sheet.length, ")"), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: "0 0 16px"
    }
  }, /*#__PURE__*/React.createElement(FootLineupChecklist, {
    roster: roster,
    extraIds: existingSheet,
    checked: sheet,
    onToggle: toggle,
    disabled: saving
  })), err && /*#__PURE__*/React.createElement(FMessage, null, err), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(FBtn, {
    variant: "ghost",
    onClick: onCancel,
    disabled: saving,
    style: {
      flex: 1
    }
  }, "Annuler"), /*#__PURE__*/React.createElement(FBtn, {
    variant: "success",
    icon: "play",
    onClick: start,
    disabled: saving,
    style: {
      flex: 2
    }
  }, saving ? "Démarrage…" : "Coup d'envoi")));
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
      setErr("Erreur : " + e.message);
      setSaving(false);
    }
  }
  return /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      background: FC.softer,
      border: `1.5px solid ${FC.line}`,
      borderRadius: 18,
      padding: 14,
      margin: "8px 0"
    }
  }, /*#__PURE__*/React.createElement(FSegmented, {
    value: type,
    onChange: setType,
    options: [["goal_bl", "Nos buts"], ["goal_opponent", "But adverse"]],
    style: {
      marginBottom: 12
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(FField, {
    label: "Mi-temps",
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: 1,
    inputMode: "numeric",
    value: half,
    onChange: e => setHalf(e.target.value),
    style: FOOT_INPUT_STYLE
  })), /*#__PURE__*/React.createElement(FField, {
    label: "Minute",
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: 0,
    inputMode: "numeric",
    value: minute,
    onChange: e => setMinute(e.target.value),
    style: FOOT_INPUT_STYLE
  }))), type === "goal_bl" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(FField, {
    label: "Buteur"
  }, /*#__PURE__*/React.createElement("select", {
    value: playerId,
    onChange: e => setPlayerId(e.target.value),
    style: FOOT_INPUT_STYLE
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "\u2014 Choisir \u2014"), options.map(p => /*#__PURE__*/React.createElement("option", {
    key: p.id,
    value: p.id
  }, getDisplayName(p, PLAYERS))))), /*#__PURE__*/React.createElement(FField, {
    label: "Passe d\xE9cisive (optionnel)"
  }, /*#__PURE__*/React.createElement("select", {
    value: assistId,
    onChange: e => setAssistId(e.target.value),
    style: FOOT_INPUT_STYLE
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "\u2014 Aucune \u2014"), options.filter(p => String(p.id) !== playerId).map(p => /*#__PURE__*/React.createElement("option", {
    key: p.id,
    value: p.id
  }, getDisplayName(p, PLAYERS)))))), err && /*#__PURE__*/React.createElement(FMessage, null, err), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(FBtn, {
    variant: "ghost",
    onClick: onCancel,
    disabled: saving,
    style: {
      flex: 1
    }
  }, "Annuler"), /*#__PURE__*/React.createElement(FBtn, {
    onClick: save,
    disabled: saving,
    style: {
      flex: 1
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
    await saveGoalWithSheet(lineupIdsFor(lineups || [], match.id), payload, {
      addToSheet: ids => addToLineup(match.id, ids),
      writeGoal: () => eventId === "new" ? sbInsert("foot_match_events", {
        match_id: match.id,
        ...payload
      }) : sbUpdate("foot_match_events", {
        id: eventId
      }, payload)
    });
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
  return /*#__PURE__*/React.createElement("div", null, sorted.length === 0 && /*#__PURE__*/React.createElement(FEmpty, {
    icon: "ball",
    title: "Aucun but",
    text: "Les buts appara\xEEtront ici au fil du match."
  }), sorted.map(e => {
    if (editingId === e.id) return /*#__PURE__*/React.createElement(FootEventEditor, {
      key: e.id,
      event: e,
      roster: roster,
      onSave: p => saveEvent(e.id, p),
      onCancel: () => setEditingId(null)
    });
    const ours = e.type === "goal_bl";
    return /*#__PURE__*/React.createElement("div", {
      key: e.id,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 0",
        borderTop: `1px solid ${FC.line}`
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: "0 0 52px",
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "block",
        fontFamily: FF.display,
        fontSize: 18,
        color: FC.deep,
        lineHeight: 1.1
      }
    }, e.minute, "'"), /*#__PURE__*/React.createElement("span", {
      style: {
        display: "block",
        fontSize: 11,
        color: FC.muted
      }
    }, e.half, e.half === 1 ? "re" : "e", " MT")), ours ? /*#__PURE__*/React.createElement(FAvatar, {
      playerId: e.player_id,
      name: footNameOf(e.player_id),
      size: 36
    }) : /*#__PURE__*/React.createElement("span", {
      style: {
        width: 36,
        height: 36,
        borderRadius: 18,
        background: FC.badSoft,
        color: FC.bad,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(FIcon, {
      name: "ball",
      size: 18
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        fontWeight: 600,
        color: ours ? FC.text : FC.muted
      }
    }, ours ? footNameOf(e.player_id) : "But adverse"), ours && e.assist_player_id && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: FC.muted
      }
    }, "Passe de ", footNameOf(e.assist_player_id))), editable && /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex"
      }
    }, /*#__PURE__*/React.createElement(FIconBtn, {
      icon: "pencil",
      label: "Modifier le but",
      onClick: () => setEditingId(e.id),
      disabled: busyId === e.id
    }), /*#__PURE__*/React.createElement(FIconBtn, {
      icon: "trash",
      label: "Supprimer le but",
      tone: "danger",
      onClick: () => deleteEvent(e),
      disabled: busyId === e.id
    })));
  }), editable && editingId === "new" && /*#__PURE__*/React.createElement(FootEventEditor, {
    defaultHalf: match.current_half || 1,
    roster: roster,
    onSave: p => saveEvent("new", p),
    onCancel: () => setEditingId(null)
  }), editable && editingId !== "new" && /*#__PURE__*/React.createElement(FBtn, {
    variant: "ghost",
    full: true,
    size: "sm",
    icon: "plus",
    onClick: () => setEditingId("new"),
    style: {
      marginTop: 10,
      borderStyle: "dashed"
    }
  }, "Ajouter un but"));
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
  const can = canConfirmGoal(playerId, busy);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: FC.softer,
      border: `1.5px solid ${FC.line}`,
      borderRadius: 18,
      padding: 14,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(FField, {
    label: "Buteur"
  }, /*#__PURE__*/React.createElement("select", {
    value: playerId,
    onChange: e => setPlayerId(e.target.value),
    style: FOOT_INPUT_STYLE
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "\u2014 Choisir \u2014"), options.map(p => /*#__PURE__*/React.createElement("option", {
    key: p.id,
    value: p.id
  }, getDisplayName(p, PLAYERS))))), withAssist && /*#__PURE__*/React.createElement(FField, {
    label: "Passe d\xE9cisive (optionnel)"
  }, /*#__PURE__*/React.createElement("select", {
    value: assistId,
    onChange: e => setAssistId(e.target.value),
    style: FOOT_INPUT_STYLE
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "\u2014 Aucune \u2014"), options.filter(p => String(p.id) !== playerId).map(p => /*#__PURE__*/React.createElement("option", {
    key: p.id,
    value: p.id
  }, getDisplayName(p, PLAYERS))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(FBtn, {
    variant: "ghost",
    onClick: onCancel,
    style: {
      flex: 1
    }
  }, "Annuler"), /*#__PURE__*/React.createElement(FBtn, {
    icon: "check",
    onClick: () => can && onConfirm(Number(playerId), assistId ? Number(assistId) : null),
    disabled: !can,
    style: {
      flex: 1
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
      await saveGoalWithSheet(lineupIdsFor(lineups || [], match.id), {
        type,
        player_id: playerId,
        assist_player_id: assistId
      }, {
        addToSheet: ids => addToLineup(match.id, ids),
        writeGoal: () => sbInsert("foot_match_events", {
          match_id: match.id,
          half: match.current_half,
          minute: minutesElapsed,
          type,
          player_id: playerId,
          assist_player_id: assistId
        })
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
  return /*#__PURE__*/React.createElement(FCard, {
    style: {
      border: `2px solid ${FC.accent}`
    }
  }, /*#__PURE__*/React.createElement(FHeading, {
    right: /*#__PURE__*/React.createElement(FChip, {
      tone: "accent"
    }, "Console admin")
  }, footHalfLabel(match.current_half), " ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: FF.ui,
      fontSize: 15,
      color: FC.muted
    }
  }, "/ ", match.nb_halves)), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      fontFamily: FF.display,
      fontSize: 60,
      lineHeight: 1.1,
      color: FC.deep,
      margin: "2px 0 14px",
      fontVariantNumeric: "tabular-nums"
    }
  }, String(minutesElapsed).padStart(2, "0"), ":", String(elapsedSeconds % 60).padStart(2, "0")), liveAction === "start" && /*#__PURE__*/React.createElement(FBtn, {
    variant: "success",
    size: "lg",
    full: true,
    icon: "play",
    disabled: busy,
    onClick: startHalf
  }, "D\xE9marrer la mi-temps"), liveAction === "playing" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(FBtn, {
    size: "lg",
    icon: "ball",
    disabled: busy,
    onClick: () => setPicking("bl"),
    style: {
      flex: 1
    }
  }, "But BL"), /*#__PURE__*/React.createElement(FBtn, {
    variant: "ghost",
    size: "lg",
    icon: "ball",
    disabled: busy,
    onClick: () => logGoal("goal_opponent", null, null),
    style: {
      flex: 1
    }
  }, "But adverse")), picking === "bl" && /*#__PURE__*/React.createElement(FootGoalPicker, {
    roster: roster,
    withAssist: true,
    busy: busy,
    onCancel: () => setPicking(null),
    onConfirm: (playerId, assistId) => logGoal("goal_bl", playerId, assistId)
  }), /*#__PURE__*/React.createElement(FBtn, {
    variant: "secondary",
    full: true,
    icon: isLastHalf ? "flag" : "pause",
    disabled: busy,
    onClick: endHalf,
    style: {
      marginTop: 10
    }
  }, isLastHalf ? "Fin de la dernière mi-temps" : "Terminer la mi-temps")), liveAction === "close" && /*#__PURE__*/React.createElement(FBtn, {
    variant: "danger",
    size: "lg",
    full: true,
    icon: "flag",
    disabled: busy,
    onClick: closeMatch
  }, "Cl\xF4turer le match"));
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
    className: "ft-page"
  }, /*#__PURE__*/React.createElement(FootScoreboard, {
    match: match,
    score: score
  }), isAdmin && /*#__PURE__*/React.createElement(FootLiveAdminConsole, {
    match: match,
    roster: roster,
    events: matchEvents,
    lineups: lineups,
    reload: reload
  }), /*#__PURE__*/React.createElement(FCard, null, /*#__PURE__*/React.createElement(FHeading, null, "Buts"), /*#__PURE__*/React.createElement(FootEventTimeline, {
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
    isAdmin: false,
    reload: reload
  }));
}
const FOOT_SCORE_OPTIONS = Array.from({
  length: 19
}, (_, i) => 1 + i * 0.5);
function FootRatingsTab({
  match,
  lineups,
  ratings,
  currentPlayer,
  isAdmin,
  reload
}) {
  const sheetIds = lineupIdsFor(lineups, match.id);
  const mr = ratings.filter(r => r.match_id === match.id);
  const progress = ratingProgress(sheetIds, mr);
  const averages = finalAverages(match, sheetIds, mr);
  const validated = !!match.ratings_validated_at;
  const me = currentPlayer?.id;
  const isVoter = sheetIds.includes(me);
  const hasVoted = progress.doneIds.includes(me);
  const mine = Object.fromEntries(mr.filter(r => r.rater_id === me).map(r => [r.ratee_id, String(r.score)]));
  const [editing, setEditing] = React.useState(isVoter && !hasVoted && !validated);
  const [scores, setScores] = React.useState(mine);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const nameOf = footNameOf;
  async function save() {
    let rows;
    try {
      rows = buildRatingPayload(match.id, me, sheetIds, scores);
    } catch (e) {
      setErr(e.message);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const result = await submitRatings({
        isValidated: async () => !!((await sbFetch("foot_matches", `?id=eq.${match.id}&select=ratings_validated_at`)) || [])[0]?.ratings_validated_at,
        writeRatings: async () => assertUpsertOk(await SUPABASE.from("foot_ratings").upsert(rows.map(r => ({
          ...r,
          updated_at: new Date().toISOString()
        })), {
          onConflict: "match_id,rater_id,ratee_id"
        }))
      });
      if (result === "closed") setErr("Les notes de ce match ont déjà été validées, tes notes n'ont pas été enregistrées.");
      setEditing(false);
      await reload();
    } catch (e) {
      setErr("Erreur : " + e.message);
    }
    setBusy(false);
  }
  async function forceValidate() {
    if (!window.confirm("Valider les notes avec les votes déjà faits ? Les joueurs ne pourront plus les modifier.")) return;
    setBusy(true);
    try {
      await sbUpdate("foot_matches", {
        id: match.id
      }, {
        ratings_validated_at: new Date().toISOString()
      });
      await reload();
    } catch (e) {
      setErr("Erreur : " + e.message);
    }
    setBusy(false);
  }
  if (sheetIds.length < 2) return /*#__PURE__*/React.createElement(FCard, null, /*#__PURE__*/React.createElement(FEmpty, {
    icon: "star",
    title: "Pas de notes",
    text: "Il faut au moins deux joueurs sur la feuille de match pour noter."
  }));
  const view = ratingsTabView({
    validated,
    isVoter,
    hasVoted,
    editing,
    isAdmin
  });
  const ranked = sheetIds.map(id => ({
    id,
    avg: averages[id]
  })).sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
  return /*#__PURE__*/React.createElement(FCard, null, /*#__PURE__*/React.createElement(FHeading, {
    right: validated ? /*#__PURE__*/React.createElement(FChip, {
      tone: "good",
      icon: "check"
    }, "Valid\xE9es") : /*#__PURE__*/React.createElement(FChip, {
      tone: "soft"
    }, progress.doneIds.length, " / ", sheetIds.length, " ont vot\xE9")
  }, "Notes du match"), view.showForm && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, sheetIds.filter(id => id !== me).map(id => /*#__PURE__*/React.createElement("div", {
    key: id,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "7px 0",
      borderTop: `1px solid ${FC.line}`
    }
  }, /*#__PURE__*/React.createElement(FAvatar, {
    playerId: id,
    name: nameOf(id),
    size: 34
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0,
      fontSize: 15,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, nameOf(id)), /*#__PURE__*/React.createElement("select", {
    value: scores[id] ?? "",
    disabled: busy,
    onChange: e => setScores({
      ...scores,
      [id]: e.target.value
    }),
    "aria-label": `Note pour ${nameOf(id)}`,
    style: {
      ...FOOT_SELECT_STYLE,
      minWidth: 82
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "\u2014"), FOOT_SCORE_OPTIONS.map(s => /*#__PURE__*/React.createElement("option", {
    key: s,
    value: String(s)
  }, s.toFixed(1)))))), /*#__PURE__*/React.createElement(FBtn, {
    full: true,
    size: "lg",
    onClick: save,
    disabled: busy,
    style: {
      marginTop: 12
    }
  }, busy ? "…" : "Enregistrer mes notes")), err && /*#__PURE__*/React.createElement(FMessage, null, err), view.showEditButton && /*#__PURE__*/React.createElement(FBtn, {
    size: "sm",
    variant: "secondary",
    icon: "pencil",
    onClick: () => {
      setScores(mine);
      setErr(null);
      setEditing(true);
    },
    style: {
      marginBottom: 12
    }
  }, view.editLabel), view.showAverages && ranked.map(({
    id,
    avg
  }, i) => /*#__PURE__*/React.createElement("div", {
    key: id,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "7px 0",
      borderTop: `1px solid ${FC.line}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 22,
      textAlign: "center",
      fontFamily: FF.display,
      fontSize: 16,
      color: i < 3 ? FC.deep : FC.muted
    }
  }, i + 1), /*#__PURE__*/React.createElement(FAvatar, {
    playerId: id,
    name: nameOf(id),
    size: 34
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, nameOf(id)), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 6,
      borderRadius: 3,
      background: FC.soft,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${avg == null ? 0 : Math.max(4, avg / 10 * 100)}%`,
      height: "100%",
      borderRadius: 3,
      background: FC.accent
    }
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: FF.display,
      fontSize: 22,
      color: FC.deep,
      minWidth: 42,
      textAlign: "right"
    }
  }, avg == null ? "—" : avg.toFixed(1)))), view.showHiddenMessage && /*#__PURE__*/React.createElement(FMessage, {
    tone: "warn"
  }, "Note tes co\xE9quipiers pour voir les moyennes."), !validated && progress.pendingIds.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      fontSize: 13,
      color: FC.muted
    }
  }, "Pas encore vot\xE9 : ", progress.pendingIds.map(nameOf).join(" · ")), isAdmin && !validated && /*#__PURE__*/React.createElement(FBtn, {
    variant: "success",
    full: true,
    size: "sm",
    onClick: forceValidate,
    disabled: busy,
    style: {
      marginTop: 12
    }
  }, "Valider les notes"), isAdmin && /*#__PURE__*/React.createElement(FootRatingsAdminPanel, {
    match: match,
    sheetIds: sheetIds,
    mr: mr,
    averages: averages,
    reload: reload
  }));
}

// Bureau only: edit any player's votes and the final note of each player. Nobody else ever sees this table.
function FootRatingsAdminPanel({
  match,
  sheetIds,
  mr,
  averages,
  reload
}) {
  const [open, setOpen] = React.useState(false);
  const [rater, setRater] = React.useState(sheetIds[0]);
  const [scores, setScores] = React.useState({});
  const [finals, setFinals] = React.useState({});
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const over = match.rating_overrides || {};
  React.useEffect(() => {
    setScores(Object.fromEntries(mr.filter(r => r.rater_id === rater).map(r => [r.ratee_id, String(r.score)])));
  }, [rater, mr.length, open]);
  React.useEffect(() => {
    setFinals(Object.fromEntries(sheetIds.map(id => [id, over[id] != null ? String(over[id]) : ""])));
  }, [match.rating_overrides, open]);
  if (!open) return /*#__PURE__*/React.createElement(FBtn, {
    variant: "secondary",
    full: true,
    size: "sm",
    icon: "sliders",
    onClick: () => setOpen(true),
    style: {
      marginTop: 10
    }
  }, "Tableau des notes (bureau)");
  async function saveVotes() {
    const rows = sheetIds.filter(id => id !== rater && scores[id] !== undefined && scores[id] !== "").map(id => ({
      match_id: match.id,
      rater_id: rater,
      ratee_id: id,
      score: Number(scores[id]),
      updated_at: new Date().toISOString()
    }));
    setBusy(true);
    setMsg(null);
    try {
      if (rows.length) assertUpsertOk(await SUPABASE.from("foot_ratings").upsert(rows, {
        onConflict: "match_id,rater_id,ratee_id"
      }));
      await reload();
      setMsg({
        t: "success",
        m: "Notes enregistrées ✓"
      });
    } catch (e) {
      setMsg({
        t: "error",
        m: "Erreur : " + e.message
      });
    }
    setBusy(false);
  }
  async function saveFinals() {
    const next = {};
    for (const id of sheetIds) if (finals[id] !== "" && finals[id] != null) next[id] = Number(finals[id]);
    setBusy(true);
    setMsg(null);
    try {
      await sbUpdate("foot_matches", {
        id: match.id
      }, {
        rating_overrides: next
      });
      await reload();
      setMsg({
        t: "success",
        m: "Notes finales enregistrées ✓"
      });
    } catch (e) {
      setMsg({
        t: "error",
        m: "Erreur : " + e.message
      });
    }
    setBusy(false);
  }
  const opts = FOOT_SCORE_OPTIONS.map(x => /*#__PURE__*/React.createElement("option", {
    key: x,
    value: String(x)
  }, x.toFixed(1)));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      paddingTop: 12,
      borderTop: `1px solid ${FC.line}`
    }
  }, /*#__PURE__*/React.createElement(FHeading, {
    right: /*#__PURE__*/React.createElement(FBtn, {
      size: "sm",
      variant: "ghost",
      onClick: () => setOpen(false)
    }, "Fermer")
  }, "Tableau des notes"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: FC.muted,
      marginBottom: 10
    }
  }, "Visible et modifiable uniquement par le bureau."), /*#__PURE__*/React.createElement(FField, {
    label: "Notes donn\xE9es par"
  }, /*#__PURE__*/React.createElement("select", {
    value: rater,
    onChange: e => setRater(Number(e.target.value)),
    style: FOOT_SELECT_STYLE
  }, sheetIds.map(id => /*#__PURE__*/React.createElement("option", {
    key: id,
    value: id
  }, footNameOf(id))))), sheetIds.filter(id => id !== rater).map(id => /*#__PURE__*/React.createElement("div", {
    key: id,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "6px 0",
      borderTop: `1px solid ${FC.line}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 15
    }
  }, footNameOf(id)), /*#__PURE__*/React.createElement("select", {
    value: scores[id] ?? "",
    disabled: busy,
    onChange: e => setScores({
      ...scores,
      [id]: e.target.value
    }),
    style: {
      ...FOOT_SELECT_STYLE,
      minWidth: 82
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "\u2014"), opts))), /*#__PURE__*/React.createElement(FBtn, {
    full: true,
    size: "sm",
    onClick: saveVotes,
    disabled: busy,
    style: {
      margin: "10px 0 16px"
    }
  }, "Enregistrer les notes de ", footNameOf(rater)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.ui,
      fontSize: 16,
      marginBottom: 4
    }
  }, "Note finale par joueur"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: FC.muted,
      marginBottom: 6
    }
  }, "\xAB Auto \xBB = moyenne des votes."), sheetIds.map(id => /*#__PURE__*/React.createElement("div", {
    key: id,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "6px 0",
      borderTop: `1px solid ${FC.line}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 15
    }
  }, footNameOf(id)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: FC.muted
    }
  }, averages[id] == null ? "—" : averages[id].toFixed(1)), /*#__PURE__*/React.createElement("select", {
    value: finals[id] ?? "",
    disabled: busy,
    onChange: e => setFinals({
      ...finals,
      [id]: e.target.value
    }),
    style: {
      ...FOOT_SELECT_STYLE,
      minWidth: 82
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Auto"), opts))), /*#__PURE__*/React.createElement(FBtn, {
    full: true,
    size: "sm",
    onClick: saveFinals,
    disabled: busy,
    style: {
      marginTop: 10
    }
  }, "Enregistrer les notes finales"), msg && /*#__PURE__*/React.createElement(FMessage, {
    tone: msg.t === "error" ? "bad" : "good",
    style: {
      marginTop: 10
    }
  }, msg.m));
}
function FootFinishedView({
  match,
  roster,
  events,
  lineups,
  ratings,
  currentPlayer,
  isAdmin,
  reload
}) {
  const [tab, setTab] = React.useState("resume");
  const matchEvents = events.filter(e => e.match_id === match.id);
  const score = computeFootScore(matchEvents);
  return /*#__PURE__*/React.createElement("div", {
    className: "ft-page"
  }, /*#__PURE__*/React.createElement(FootScoreboard, {
    match: match,
    score: score
  }), /*#__PURE__*/React.createElement(FSegmented, {
    value: tab,
    onChange: setTab,
    options: [["resume", "Résumé", "ball"], ["notes", "Notes", "star"]],
    style: {
      marginBottom: 14,
      background: "rgba(255,255,255,0.92)"
    }
  }), tab === "resume" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(FCard, null, /*#__PURE__*/React.createElement(FHeading, null, "Buts"), /*#__PURE__*/React.createElement(FootEventTimeline, {
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
    isAdmin: false,
    reload: reload
  })), tab === "notes" && /*#__PURE__*/React.createElement(FootRatingsTab, {
    match: match,
    lineups: lineups,
    ratings: ratings || [],
    currentPlayer: currentPlayer,
    isAdmin: isAdmin,
    reload: reload
  }));
}
function FootScheduledView({
  match,
  roster,
  attendance,
  lineups,
  currentPlayer,
  isAdmin,
  canStart,
  reload,
  onStartMatch
}) {
  const matchAttendance = attendance.filter(a => a.match_id === match.id);
  const presenceRoster = attendanceRoster(roster);
  const buckets = computeAttendanceBuckets(presenceRoster, matchAttendance);
  const isOnRoster = presenceRoster.some(r => r.player_id === currentPlayer?.id);
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
  const groups = [["Présents", buckets.present, "good"], ["Pas de réponse", buckets.noResponse, "plain"], ["Absents", buckets.absent, "bad"]];
  return /*#__PURE__*/React.createElement("div", {
    className: "ft-page"
  }, /*#__PURE__*/React.createElement(FootScoreboard, {
    match: match,
    score: {
      bl: 0,
      opponent: 0
    }
  }), isOnRoster && /*#__PURE__*/React.createElement(FCard, null, /*#__PURE__*/React.createElement(FHeading, null, "Ma pr\xE9sence"), /*#__PURE__*/React.createElement(FootAttendanceButtons, {
    myStatus: myStatus,
    saving: saving,
    onSet: setMyStatus
  })), /*#__PURE__*/React.createElement(FCard, null, /*#__PURE__*/React.createElement(FHeading, {
    right: /*#__PURE__*/React.createElement(FChip, {
      tone: "soft"
    }, buckets.present.length, " / ", presenceRoster.length)
  }, "Pr\xE9sences"), presenceRoster.length === 0 ? /*#__PURE__*/React.createElement(FEmpty, {
    icon: "users",
    title: "Effectif vide",
    text: "Ajoute des joueurs \xE0 l'effectif dans l'onglet Admin."
  }) : groups.map(([label, ids, tone]) => /*#__PURE__*/React.createElement("div", {
    key: label,
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement(FChip, {
    tone: tone
  }, label, " \xB7 ", ids.length)), ids.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6
    }
  }, ids.map(id => /*#__PURE__*/React.createElement(FootPlayerPill, {
    key: id,
    id: id,
    tone: "line",
    dim: tone === "plain"
  })))))), /*#__PURE__*/React.createElement(FootLineupSection, {
    match: match,
    roster: roster,
    lineups: lineups || [],
    isAdmin: isAdmin,
    reload: reload
  }), canStart && /*#__PURE__*/React.createElement(FBtn, {
    variant: "success",
    size: "lg",
    full: true,
    icon: "play",
    onClick: onStartMatch
  }, "Commencer le match"));
}
function FootMatchDetailPage({
  matchId,
  matches,
  roster,
  attendance,
  events,
  lineups,
  ratings,
  currentPlayer,
  navBack,
  reload
}) {
  const match = matches.find(m => m.id === matchId);
  const isAdmin = canEditMatch(match, currentPlayer);
  const canStart = canStartMatch(match, currentPlayer);
  const [startingConfig, setStartingConfig] = React.useState(false);
  const [editingInfo, setEditingInfo] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  if (!match) return /*#__PURE__*/React.createElement(FCard, null, /*#__PURE__*/React.createElement(FEmpty, {
    icon: "calendar",
    title: "Match introuvable",
    action: /*#__PURE__*/React.createElement(FBtn, {
      onClick: navBack
    }, "Retour aux matchs")
  }));
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
  return /*#__PURE__*/React.createElement("div", null, match.status === "scheduled" && !startingConfig && /*#__PURE__*/React.createElement(FootScheduledView, {
    match: match,
    roster: roster,
    attendance: attendance,
    lineups: lineups,
    currentPlayer: currentPlayer,
    isAdmin: isAdmin,
    canStart: canStart,
    reload: reload,
    onStartMatch: () => setStartingConfig(true)
  }), match.status === "scheduled" && startingConfig && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(FootScoreboard, {
    match: match,
    score: {
      bl: 0,
      opponent: 0
    }
  }), /*#__PURE__*/React.createElement(FootStartMatchConfig, {
    match: match,
    roster: roster,
    attendance: attendance,
    lineups: lineups,
    currentPlayer: currentPlayer,
    reload: reload,
    onCancel: () => setStartingConfig(false)
  })), match.status === "live" && /*#__PURE__*/React.createElement(FootLiveView, {
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
    ratings: ratings,
    currentPlayer: currentPlayer,
    isAdmin: isAdmin,
    reload: reload
  }), isAdmin && /*#__PURE__*/React.createElement(React.Fragment, null, editingInfo ? /*#__PURE__*/React.createElement(FootMatchForm, {
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
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement(FBtn, {
    variant: "secondary",
    icon: "pencil",
    onClick: () => setEditingInfo(true),
    disabled: deleting,
    style: {
      flex: 1
    }
  }, "Modifier"), /*#__PURE__*/React.createElement(FBtn, {
    variant: "ghost",
    icon: "trash",
    onClick: deleteMatch,
    disabled: deleting,
    style: {
      flex: 1,
      color: FC.bad,
      borderColor: withAlpha(FC.bad, 0.4),
      background: "rgba(255,255,255,0.9)"
    }
  }, deleting ? "…" : "Supprimer"))));
}

// ---- stats ---------------------------------------------------------------------------------------------------------------------------
const FOOT_STAT_COLUMNS = [{
  key: "played",
  label: "MJ",
  title: "Joués"
}, {
  key: "wins",
  label: "V",
  title: "Victoires"
}, {
  key: "draws",
  label: "N",
  title: "Nuls"
}, {
  key: "losses",
  label: "D",
  title: "Défaites"
}, {
  key: "goals",
  label: "Buts",
  title: "Buts"
}, {
  key: "assists",
  label: "PD",
  title: "Passes D"
}, {
  key: "decisive",
  label: "Déc.",
  title: "Décisifs"
}, {
  key: "rating",
  label: "Note",
  title: "Note"
}];
function readPref(key, fallback, allowed) {
  try {
    const v = localStorage.getItem(key);
    return v && (!allowed || allowed.includes(v)) ? v : fallback;
  } catch (e) {
    return fallback;
  }
}
function writePref(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {}
}
function FootStatTile({
  title,
  value,
  rank
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: FC.soft,
      borderRadius: 18,
      padding: "12px 8px",
      textAlign: "center",
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.ui,
      fontSize: 12,
      color: FC.muted,
      textTransform: "uppercase",
      letterSpacing: "0.06em"
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.display,
      fontSize: 28,
      lineHeight: 1.25,
      color: FC.deep
    }
  }, value), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.ui,
      fontSize: 13,
      color: FC.muted
    }
  }, rank));
}
function FootRatingChart({
  series
}) {
  const [hover, setHover] = React.useState(null);
  if (series.length < 2) return /*#__PURE__*/React.createElement(FEmpty, {
    icon: "chart",
    title: "Pas encore de courbe",
    text: "Il faut au moins 2 matchs not\xE9s pour afficher ton \xE9volution."
  });
  const W = 320,
    H = 150,
    L = 32,
    R = 12,
    T = 12,
    B = 12;
  const x = i => L + i * (W - L - R) / (series.length - 1);
  const y = v => T + (10 - v) * (H - T - B) / 9;
  const pts = series.map((s, i) => `${x(i)},${y(s.rating)}`).join(" ");
  const label = series.map(s => `${s.opponent} ${s.rating.toFixed(1)}`).join(", ");
  const h = hover != null ? series[hover] : null;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: 20,
      textAlign: "center",
      fontSize: 14,
      color: FC.text
    }
  }, h ? /*#__PURE__*/React.createElement(React.Fragment, null, "vs ", h.opponent, " \xB7 ", /*#__PURE__*/React.createElement("b", {
    style: {
      fontFamily: FF.display,
      color: FC.deep
    }
  }, h.rating.toFixed(1)), " \xB7 ", new Date(h.date).toLocaleDateString("fr-FR")) : /*#__PURE__*/React.createElement("span", {
    style: {
      color: FC.muted
    }
  }, "Touche un point pour le d\xE9tail")), /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${W} ${H}`,
    style: {
      width: "100%",
      height: "auto",
      display: "block"
    },
    role: "img",
    "aria-label": `Notes des derniers matchs : ${label}`
  }, [2, 4, 6, 8, 10].map(v => /*#__PURE__*/React.createElement("g", {
    key: v
  }, /*#__PURE__*/React.createElement("line", {
    x1: L,
    x2: W - R,
    y1: y(v),
    y2: y(v),
    stroke: FC.line,
    strokeWidth: "1"
  }), /*#__PURE__*/React.createElement("text", {
    x: L - 10,
    y: y(v) + 3.5,
    fontSize: "10",
    fill: FC.muted,
    textAnchor: "end"
  }, v))), h && /*#__PURE__*/React.createElement("line", {
    x1: x(hover),
    x2: x(hover),
    y1: T,
    y2: H - B,
    stroke: FC.muted,
    strokeWidth: "1",
    strokeDasharray: "2 2"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: pts,
    fill: "none",
    stroke: FC.accent,
    strokeWidth: "3",
    strokeLinejoin: "round",
    strokeLinecap: "round"
  }), series.map((s, i) => /*#__PURE__*/React.createElement("g", {
    key: s.matchId,
    onMouseEnter: () => setHover(i),
    onMouseLeave: () => setHover(null),
    onClick: () => setHover(hover === i ? null : i),
    style: {
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: x(i),
    cy: y(s.rating),
    r: "14",
    fill: "transparent"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: x(i),
    cy: y(s.rating),
    r: hover === i ? 6 : 4.5,
    fill: FC.accent,
    stroke: "#fff",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("title", null, `${s.opponent} : ${s.rating.toFixed(1)}`)))));
}
function FootStatsPage({
  matches,
  lineups,
  events,
  ratings,
  roster,
  currentPlayer
}) {
  const currentSeason = seasonOf(new Date().toISOString());
  const [mode, setModeState] = React.useState(() => readPref("foot_stats_mode", "abs", ["abs", "pct"]));
  const [season, setSeasonState] = React.useState(() => readPref("foot_stats_season", currentSeason));
  const [type, setTypeState] = React.useState(() => readPref("foot_stats_type", "all", ["all", "amical", "championnat"]));
  const setMode = v => {
    setModeState(v);
    writePref("foot_stats_mode", v);
  };
  const setSeason = v => {
    setSeasonState(v);
    writePref("foot_stats_season", v);
  };
  const setType = v => {
    setTypeState(v);
    writePref("foot_stats_type", v);
  };
  const seasonOptions = [...new Set([currentSeason, ...seasonsFromMatches(matches), ...(season !== "all" ? [season] : [])])].sort().reverse();
  const filtered = filterMatchesForStats(matches, {
    season,
    type
  });
  const population = statsRoster(roster);
  const ratingBy = Object.fromEntries(population.map(id => [id, averageRating(playerRatingSeries(filtered, ratings, lineups, id))]));
  const rows = buildStatsRows(population, computePlayerStats(filtered, lineups, events), ratingBy);
  const pool = rows.filter(r => r.played > 0);
  const ratingPool = rows.filter(r => r.rating != null);
  const ranks = Object.fromEntries(FOOT_STAT_COLUMNS.map(c => [c.key, rankPlayers(c.key === "rating" ? ratingPool : pool, c.key, mode)]));
  const me = rows.find(r => r.playerId === currentPlayer?.id);
  const series = currentPlayer ? playerRatingSeries(filtered, ratings, lineups, currentPlayer.id).slice(-10) : [];
  const nameOf = footNameOf;
  function tilesFor(keys) {
    return keys.map(k => {
      const col = FOOT_STAT_COLUMNS.find(c => c.key === k);
      const value = me ? formatStatValue(statValue(me, k, mode), k, mode) : "—";
      const rank = me && ranks[k][me.playerId] ? String(formatRank(ranks[k][me.playerId])).split(" / ")[0] : "—"; // "1er ex æquo / 13" → "1er ex æquo"
      return /*#__PURE__*/React.createElement(FootStatTile, {
        key: k,
        title: col.title,
        value: value,
        rank: rank
      });
    });
  }
  const tiles = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(84px, 1fr))",
    gap: 8
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "ft-page"
  }, /*#__PURE__*/React.createElement(FCard, {
    pad: 12
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("select", {
    value: season,
    onChange: e => setSeason(e.target.value),
    "aria-label": "Saison",
    style: {
      ...FOOT_SELECT_STYLE,
      flex: 1,
      minWidth: 0
    }
  }, seasonOptions.map(s => /*#__PURE__*/React.createElement("option", {
    key: s,
    value: s
  }, "Saison ", s)), /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "Toutes les saisons")), /*#__PURE__*/React.createElement("select", {
    value: type,
    onChange: e => setType(e.target.value),
    "aria-label": "Type de match",
    style: {
      ...FOOT_SELECT_STYLE,
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "Tous les matchs"), /*#__PURE__*/React.createElement("option", {
    value: "championnat"
  }, "Championnat"), /*#__PURE__*/React.createElement("option", {
    value: "amical"
  }, "Amical"))), /*#__PURE__*/React.createElement(FSegmented, {
    value: mode,
    onChange: setMode,
    options: [["abs", "Valeurs"], ["pct", "En %"]]
  })), !me && /*#__PURE__*/React.createElement(FMessage, {
    tone: "warn"
  }, "Les statistiques concernent l'effectif r\xE9gulier et occasionnel."), me && me.played === 0 && /*#__PURE__*/React.createElement(FMessage, {
    tone: "warn"
  }, "Pas encore de match termin\xE9 sur une feuille de match."), /*#__PURE__*/React.createElement(FCard, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(FAvatar, {
    playerId: currentPlayer?.id,
    name: currentPlayer?.name || footNameOf(currentPlayer?.id),
    size: 56
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.display,
      fontSize: 22,
      color: FC.deep,
      lineHeight: 1.15
    }
  }, "Mes stats"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: FC.muted
    }
  }, season === "all" ? "Toutes saisons" : `Saison ${season}`))), /*#__PURE__*/React.createElement(FLabel, null, "Matchs"), /*#__PURE__*/React.createElement("div", {
    style: {
      ...tiles,
      marginBottom: 14
    }
  }, tilesFor(["played", "wins", "draws", "losses", "rating"])), /*#__PURE__*/React.createElement(FLabel, null, "Attaque"), /*#__PURE__*/React.createElement("div", {
    style: tiles
  }, tilesFor(["goals", "assists", "decisive"]))), /*#__PURE__*/React.createElement(FCard, null, /*#__PURE__*/React.createElement(FHeading, null, "Mon \xE9volution"), /*#__PURE__*/React.createElement(FootRatingChart, {
    series: series
  })), /*#__PURE__*/React.createElement(FootRankingsPanel, {
    seasonMatches: filtered,
    season: season,
    lineups: lineups,
    events: events,
    ratings: ratings,
    roster: roster,
    currentPlayer: currentPlayer,
    mode: mode
  }));
}

// ---- rankings (podium of the season) --------------------------------------------------------------------------------------------------------
const FOOT_RANKING_TABS = [{
  key: "goals",
  label: "Buts",
  unit: "buts",
  icon: "ball"
}, {
  key: "assists",
  label: "Passe D",
  unit: "passes",
  icon: "send"
}, {
  key: "rating",
  label: "Moyennes",
  unit: "",
  icon: "star"
}];
function FootPodiumSlot({
  entry,
  place,
  size
}) {
  const first = place === 1;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      textAlign: "center",
      marginTop: first ? 0 : 26
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "inline-block",
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement(FAvatar, {
    playerId: entry.playerId,
    name: entry.name,
    size: size,
    ring: first ? FC.accent : FC.line
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      left: -6,
      top: -6,
      width: 28,
      height: 28,
      borderRadius: 14,
      background: FC.accent,
      color: "#fff",
      border: "3px solid #fff",
      fontFamily: FF.display,
      fontSize: 14,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, place)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.ui,
      fontSize: first ? 18 : 16,
      lineHeight: 1.15,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, entry.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.display,
      fontSize: first ? 30 : 24,
      color: FC.deep,
      lineHeight: 1.2
    }
  }, entry.shown), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: FC.muted
    }
  }, entry.matches, " match", entry.matches > 1 ? "s" : ""));
}

// Podium of goals / assists / average rating for the matches given (the Stats page passes its filtered ones).
function FootRankingsPanel({
  seasonMatches,
  season,
  lineups,
  events,
  ratings,
  roster,
  currentPlayer,
  mode = "abs"
}) {
  const [tab, setTab] = React.useState(() => readPref("foot_rank_tab", "goals", ["goals", "assists", "rating"]));
  const pick = v => {
    setTab(v);
    writePref("foot_rank_tab", v);
  };
  const ids = new Set(seasonMatches.map(m => m.id));
  const seasonLineups = lineups.filter(l => ids.has(l.match_id));
  const rows = buildStatsRows(statsRoster(roster), computePlayerStats(seasonMatches, seasonLineups, events.filter(e => ids.has(e.match_id))), {});
  for (const r of rows) {
    const series = playerRatingSeries(seasonMatches, ratings, seasonLineups, r.playerId);
    r.rating = averageRating(series);
    r.rated = series.length;
  }
  const byId = Object.fromEntries(rows.map(r => [r.playerId, r]));
  const t = FOOT_RANKING_TABS.find(x => x.key === tab);
  const pct = mode === "pct" && tab !== "rating";
  const rankRows = pct ? rows.map(r => ({
    ...r,
    [tab]: statValue(r, tab, "pct")
  })) : rows;
  const entries = rankingEntries(rankRows, tab, footNameOf, 15).map(e => ({
    ...e,
    name: footNameOf(e.playerId),
    shown: tab === "rating" ? e.value.toFixed(1) : formatStatValue(e.value, tab, pct ? "pct" : "abs"),
    matches: tab === "rating" ? byId[e.playerId].rated : byId[e.playerId].played
  }));
  const podium = entries.slice(0, 3),
    rest = entries.slice(3);
  const order = podium.length === 3 ? [[podium[1], 2, 66], [podium[0], 1, 84], [podium[2], 3, 66]] : podium.map((e, i) => [e, i + 1, i === 0 ? 84 : 66]);
  return /*#__PURE__*/React.createElement(FCard, null, /*#__PURE__*/React.createElement(FHeading, {
    right: /*#__PURE__*/React.createElement(FChip, {
      tone: "soft"
    }, season === "all" ? "Toutes saisons" : `Saison ${season}`)
  }, mode === "pct" && tab !== "rating" ? "Classements (par match)" : "Classements"), /*#__PURE__*/React.createElement(FSegmented, {
    value: tab,
    onChange: pick,
    options: FOOT_RANKING_TABS.map(x => [x.key, x.label, x.icon]),
    style: {
      marginBottom: 16
    }
  }), entries.length === 0 ? /*#__PURE__*/React.createElement(FEmpty, {
    icon: "trophy",
    title: "Pas encore de classement",
    text: `Aucun joueur n'a encore de ${t.key === "rating" ? "note" : t.key === "goals" ? "but" : "passe décisive"} sur cette période.`
  }) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: 8,
      marginBottom: rest.length ? 14 : 0
    }
  }, order.map(([e, place, size]) => /*#__PURE__*/React.createElement(FootPodiumSlot, {
    key: e.playerId,
    entry: e,
    place: place,
    size: size
  }))), rest.map((e, i) => /*#__PURE__*/React.createElement("div", {
    key: e.playerId,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "8px 8px",
      marginInline: -8,
      borderTop: `1px solid ${FC.line}`,
      borderRadius: 12,
      background: e.playerId === currentPlayer?.id ? FC.accentSoft : "transparent"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 24,
      textAlign: "center",
      fontFamily: FF.display,
      fontSize: 16,
      color: FC.muted
    }
  }, i + 4), /*#__PURE__*/React.createElement(FAvatar, {
    playerId: e.playerId,
    name: e.name,
    size: 34
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0,
      fontSize: 15,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, e.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: FC.muted
    }
  }, e.matches, " m."), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: FF.display,
      fontSize: 20,
      color: FC.deep,
      minWidth: 36,
      textAlign: "right"
    }
  }, e.shown)))));
}

// The Classement page is kept for later: empty for now.
function FootRankingsPage() {
  return /*#__PURE__*/React.createElement("div", {
    className: "ft-page"
  }, /*#__PURE__*/React.createElement(FCard, null, /*#__PURE__*/React.createElement(FEmpty, {
    icon: "trophy",
    title: "Bient\xF4t disponible",
    text: "Cette page arrive bient\xF4t."
  })));
}
const INSTA_KEY_STORAGE = "foot_insta_admin_key";
function readInstaKey() {
  try {
    return localStorage.getItem(INSTA_KEY_STORAGE) || "";
  } catch (e) {
    return "";
  }
}
async function instaAdminFetch(path, body, method = "POST") {
  const r = await fetch(`/api/insta/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Insta-Admin-Key": readInstaKey()
    },
    body: method === "GET" ? undefined : JSON.stringify(body)
  });
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
      const width = Math.round(img.naturalWidth * scale),
        height = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => blob ? resolve({
        blob,
        width,
        height
      }) : reject(new Error("Conversion de l'image impossible")), "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image illisible"));
    };
    img.src = url;
  });
}
function FootPhotoCell({
  playerId,
  kit,
  kind,
  photos,
  reload
}) {
  const mine = photos.filter(p => p.player_id === playerId && p.kit === kit && p.kind === kind);
  const shown = mine.find(p => p.retouched) || mine[0] || null;
  const [retouched, setRetouched] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const inputRef = React.useRef(null);
  async function onFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const {
        blob,
        width,
        height
      } = await prepareInstaPhoto(file);
      const {
        uploadUrl,
        path
      } = await instaAdminFetch("photo-sign", {
        player_id: playerId,
        kit,
        kind,
        retouched
      });
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "image/png",
          "x-upsert": "true"
        },
        body: blob
      });
      if (!put.ok) throw new Error(`Envoi refusé (${put.status})`);
      await instaAdminFetch("photo-register", {
        player_id: playerId,
        kit,
        kind,
        retouched,
        path,
        width,
        height
      });
      await reload();
    } catch (ex) {
      setErr(ex.message);
    }
    setBusy(false);
  }
  async function remove() {
    if (!shown || !window.confirm("Supprimer cette photo ?")) return;
    setBusy(true);
    setErr(null);
    try {
      await instaAdminFetch("photo-delete", {
        id: shown.id
      });
      await reload();
    } catch (ex) {
      setErr(ex.message);
    }
    setBusy(false);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: FC.softer,
      border: `1px solid ${FC.line}`,
      borderRadius: 16,
      padding: 8,
      textAlign: "center",
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 76,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
      borderRadius: 12,
      background: FC.soft,
      overflow: "hidden"
    }
  }, shown ? /*#__PURE__*/React.createElement("img", {
    src: instaPublicUrl(shown.path),
    alt: "",
    style: {
      maxHeight: 76,
      maxWidth: "100%",
      objectFit: "contain"
    }
  }) : /*#__PURE__*/React.createElement(FIcon, {
    name: "photo",
    size: 22,
    style: {
      color: FC.line
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: 20,
      marginBottom: 4
    }
  }, shown && /*#__PURE__*/React.createElement(FChip, {
    tone: shown.retouched ? "good" : "plain",
    style: {
      fontSize: 10,
      padding: "2px 8px"
    }
  }, shown.retouched ? "retouchée" : "brute")), /*#__PURE__*/React.createElement("input", {
    ref: inputRef,
    type: "file",
    accept: "image/png",
    onChange: onFile,
    style: {
      display: "none"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 4,
      justifyContent: "center",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(FBtn, {
    size: "sm",
    disabled: busy,
    onClick: () => inputRef.current && inputRef.current.click(),
    style: {
      padding: "5px 12px",
      minHeight: 32,
      fontSize: 12
    }
  }, busy ? "…" : shown ? "Remplacer" : "Envoyer"), shown && /*#__PURE__*/React.createElement(FIconBtn, {
    icon: "trash",
    tone: "danger",
    label: "Supprimer la photo",
    onClick: remove,
    disabled: busy,
    style: {
      width: 32,
      height: 32
    }
  })), /*#__PURE__*/React.createElement("label", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      fontSize: 12,
      color: FC.muted,
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: retouched,
    onChange: e => setRetouched(e.target.checked)
  }), " retouch\xE9e"), err && /*#__PURE__*/React.createElement(FMessage, {
    style: {
      marginTop: 6,
      fontSize: 11,
      padding: "5px 8px"
    }
  }, err));
}
function FootPhotosTab({
  roster,
  photos,
  reload
}) {
  const nameOf = p => getDisplayName(p, PLAYERS) || "";
  const players = roster.map(r => PLAYERS.find(p => p.id === r.player_id)).filter(Boolean).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  if (!players.length) return /*#__PURE__*/React.createElement(FCard, null, /*#__PURE__*/React.createElement(FEmpty, {
    icon: "users",
    title: "Aucun joueur",
    text: "Ajoute des joueurs \xE0 l'effectif (onglet Admin)."
  }));
  const count = id => photos.filter(ph => ph.player_id === id).length;
  return /*#__PURE__*/React.createElement("div", null, players.map(p => /*#__PURE__*/React.createElement(FCard, {
    key: p.id,
    pad: 14
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(FAvatar, {
    playerId: p.id,
    name: nameOf(p),
    size: 40
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontFamily: FF.display,
      fontSize: 18,
      color: FC.deep
    }
  }, nameOf(p)), /*#__PURE__*/React.createElement(FChip, {
    tone: count(p.id) >= 6 ? "good" : "soft"
  }, count(p.id), " / 6")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "58px minmax(0, 1fr) minmax(0, 1fr)",
      gap: 8,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", null), INSTA_KITS.map(([kit, label]) => /*#__PURE__*/React.createElement(FLabel, {
    key: kit,
    style: {
      textAlign: "center",
      marginBottom: 0
    }
  }, label)), INSTA_KINDS.map(([kind, kindLabel]) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: kind
  }, /*#__PURE__*/React.createElement(FLabel, {
    style: {
      marginBottom: 0
    }
  }, kindLabel), INSTA_KITS.map(([kit]) => /*#__PURE__*/React.createElement(FootPhotoCell, {
    key: kit,
    playerId: p.id,
    kit: kit,
    kind: kind,
    photos: photos,
    reload: reload
  }))))))));
}

// Overlay boxes (canvas px) showing what covers the photo in each layout.
// They mirror lib/insta/templates.js — keep them in sync when a template moves.
const FRAMING_GUIDES = {
  matchday: [{
    label: "MATCH DAY",
    x: 0,
    y: 0,
    w: 1080,
    h: 180,
    font: 158,
    behind: true
  },
  // title: drawn behind the player, like the render
  {
    label: "vs ADVERSAIRE",
    x: 340,
    y: 1118,
    w: 400,
    h: 120
  }, {
    label: "bandeau",
    x: 44,
    y: 1260,
    w: 992,
    h: 68
  }],
  result: [{
    label: "RESULTAT",
    x: 0,
    y: 0,
    w: 1080,
    h: 200,
    font: 180,
    behind: true
  },
  // title: drawn behind the player
  {
    label: "score",
    x: 400,
    y: 225,
    w: 680,
    h: 300
  }, {
    label: "buts",
    x: 395,
    y: 625,
    w: 505,
    h: 394
  }],
  groupe: [{
    label: "GROUPE",
    x: 0,
    y: 0,
    w: 1080,
    h: 254,
    font: 234,
    behind: true
  },
  // title: drawn behind the player
  {
    label: "liste (10 joueurs)",
    x: 608,
    y: 300,
    w: 412,
    h: 960
  }],
  render: [],
  podium_dos: [{
    label: "n°",
    x: 0,
    y: 0,
    w: 78,
    h: 74
  }, {
    label: "nom + valeur",
    x: 10,
    y: 384,
    w: 310,
    h: 46
  }],
  podium_celebration: [{
    label: "n°",
    x: 0,
    y: 0,
    w: 78,
    h: 74
  }, {
    label: "nom + valeur",
    x: 10,
    y: 384,
    w: 310,
    h: 46
  }],
  podium_render: [{
    label: "n°",
    x: 0,
    y: 0,
    w: 78,
    h: 74
  }, {
    label: "nom + valeur",
    x: 10,
    y: 384,
    w: 310,
    h: 46
  }]
};
const FRAMING_LAYOUT_LABELS = [["matchday", "Match Day"], ["result", "Résultat"], ["groupe", "Groupe"], ["render", "Render (rond)"], ["podium_celebration", "Podium · Buts"], ["podium_dos", "Podium · Passe D / Notes"], ["podium_render", "Podium · Moyennes"]];

// One layout guide. `behind` guides (a title the player stands in front of) are drawn as plain text; the others as dashed boxes over the photo.
function FootGuideBox({
  g,
  scale,
  text
}) {
  const pos = {
    position: "absolute",
    left: g.x * scale,
    top: g.y * scale,
    width: g.w * scale,
    height: g.h * scale,
    pointerEvents: "none"
  };
  if (g.behind) {
    return text ? /*#__PURE__*/React.createElement("div", {
      style: {
        ...pos,
        fontFamily: "'Shrikhand',cursive",
        fontSize: g.font * scale,
        lineHeight: 1.2,
        display: "flex",
        justifyContent: "center",
        whiteSpace: "nowrap",
        color: "#fff",
        textShadow: `${4 * scale}px ${7 * scale}px ${8 * scale}px rgba(0,0,0,0.28)`
      }
    }, g.label) : null;
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...pos,
      background: "rgba(255,255,255,0.28)",
      border: "1px dashed rgba(255,255,255,0.8)",
      color: "#fff",
      fontFamily: g.font ? "'Shrikhand',cursive" : "'Outfit',sans-serif",
      fontSize: text ? g.font ? g.font * scale : 11 : 0,
      lineHeight: 1.1,
      display: "flex",
      alignItems: g.font ? "flex-start" : "center",
      justifyContent: "center",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textShadow: "0 1px 3px rgba(0,0,0,0.5)"
    }
  }, text ? g.label : null);
}

// Every player's photo for one kit + layout, framed as saved (or by default), to compare them side by side.
function FootFramingCompare({
  players,
  photos,
  framings,
  kit,
  layout,
  showGuides,
  onPick
}) {
  const [cw, ch] = LAYOUTS[layout].canvas;
  const W = 150,
    scale = W / cw;
  const isMask = layout === "render" || layout.startsWith("podium_");
  const kind = PHOTO_KIND_FOR_LAYOUT[layout];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: `repeat(auto-fill, ${W}px)`,
      gap: 12,
      justifyContent: "center"
    }
  }, players.map(p => {
    const photo = choosePhoto(photos, p.id, kind, kit);
    const saved = photo ? savedFraming(framings, photo.id, layout) : null;
    const rect = photo ? framedRect(layout, photo, saved) : null;
    return /*#__PURE__*/React.createElement("div", {
      key: p.id,
      style: {
        width: W
      }
    }, /*#__PURE__*/React.createElement("div", {
      onClick: () => onPick(p.id),
      style: {
        position: "relative",
        width: W,
        height: ch * scale,
        overflow: "hidden",
        cursor: "pointer",
        borderRadius: layout === "render" ? "50%" : isMask ? 40 * scale : 0,
        background: isMask ? "#ffffff" : "#222",
        border: `1px solid ${FC.line}`,
        boxSizing: "border-box"
      }
    }, !isMask && /*#__PURE__*/React.createElement("img", {
      src: `/assets/insta/bg-${photo ? photo.kit : kit}.jpg`,
      alt: "",
      draggable: false,
      style: {
        position: "absolute",
        left: 0,
        top: 0,
        width: W,
        height: ch * scale
      }
    }), showGuides && (FRAMING_GUIDES[layout] || []).filter(g => g.behind).map(g => /*#__PURE__*/React.createElement(FootGuideBox, {
      key: g.label,
      g: g,
      scale: scale,
      text: true
    })), photo && rect && /*#__PURE__*/React.createElement("img", {
      src: instaPublicUrl(photo.path),
      alt: "",
      draggable: false,
      style: {
        position: "absolute",
        left: rect.x * scale,
        top: rect.y * scale,
        width: rect.width * scale,
        height: rect.height * scale
      }
    }), !photo && /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: FC.muted,
        fontSize: 11,
        textAlign: "center",
        padding: 8
      }
    }, "Pas de photo"), showGuides && (FRAMING_GUIDES[layout] || []).filter(g => !g.behind).map(g => /*#__PURE__*/React.createElement(FootGuideBox, {
      key: g.label,
      g: g,
      scale: scale
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 4,
        gap: 4
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, getDisplayName(p, PLAYERS)), photo && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        color: saved ? FC.good : FC.muted,
        textTransform: "uppercase",
        flexShrink: 0
      }
    }, saved ? "réglé" : "défaut")));
  }));
}
function FootFramingTool({
  roster,
  photos,
  framings,
  reload
}) {
  const nameOf = p => getDisplayName(p, PLAYERS) || "";
  const players = [...new Set(photos.map(p => p.player_id))].map(id => PLAYERS.find(p => p.id === id)).filter(p => p && roster.some(r => r.player_id === p.id)).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const [playerId, setPlayerId] = React.useState(null);
  const [kit, setKit] = React.useState("domicile");
  const [layout, setLayout] = React.useState("matchday");
  const [mode, setMode] = React.useState("single");
  const [showGuides, setShowGuides] = React.useState(true);
  const pid = players.some(p => p.id === playerId) ? playerId : players[0] && players[0].id || null;
  const photo = pid ? choosePhoto(photos, pid, PHOTO_KIND_FOR_LAYOUT[layout], kit) : null;
  const saved = photo ? savedFraming(framings, photo.id, layout) : null;
  const L = LAYOUTS[layout];
  const [cw, ch] = L.canvas;
  const boxRef = React.useRef(null);
  const [boxW, setBoxW] = React.useState(340);
  React.useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.parentElement ? el.parentElement.clientWidth : 0;
      if (w) setBoxW(Math.min(w, ch > cw ? 420 : 520));
    };
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
    setMsg(null);
    setServerPreview(null);
    setFr(photo ? saved ? {
      x: saved.x,
      y: saved.y,
      width: saved.width
    } : defaultFraming(layout, photo) : null);
  }, [frKey]);
  const ref = photo ? defaultFraming(layout, photo).width : 1;
  const rect = photo && fr ? framedRect(layout, photo, fr) : null;
  const frRef = React.useRef(fr);
  frRef.current = fr;

  // Pointer interactions: one pointer drags, two pointers pinch.
  const ptrs = React.useRef(new Map());
  const last = React.useRef(null);
  const toCanvas = e => {
    const r = boxRef.current.getBoundingClientRect();
    return {
      px: (e.clientX - r.left) / scale,
      py: (e.clientY - r.top) / scale
    };
  };
  function onDown(e) {
    if (!fr) return;
    boxRef.current.setPointerCapture && boxRef.current.setPointerCapture(e.pointerId);
    ptrs.current.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY
    });
    last.current = null;
  }
  function onMove(e) {
    if (!ptrs.current.has(e.pointerId) || !frRef.current) return;
    const prev = ptrs.current.get(e.pointerId);
    const cur = {
      x: e.clientX,
      y: e.clientY
    };
    if (ptrs.current.size === 1) {
      const f = frRef.current;
      setFr({
        ...f,
        x: f.x + (cur.x - prev.x) / scale,
        y: f.y + (cur.y - prev.y) / scale
      });
      ptrs.current.set(e.pointerId, cur);
    } else if (ptrs.current.size === 2) {
      const other = [...ptrs.current.entries()].find(([id]) => id !== e.pointerId)[1];
      const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      const d0 = dist(prev, other),
        d1 = dist(cur, other);
      ptrs.current.set(e.pointerId, cur);
      if (d0 > 0 && d1 > 0) {
        const r = boxRef.current.getBoundingClientRect();
        const mx = ((cur.x + other.x) / 2 - r.left) / scale,
          my = ((cur.y + other.y) / 2 - r.top) / scale;
        setFr(zoomFramingAt(frRef.current, d1 / d0, mx, my, ref));
      }
    }
  }
  function onUp(e) {
    ptrs.current.delete(e.pointerId);
  }
  function onWheel(e) {
    if (!fr) return;
    const {
      px,
      py
    } = toCanvas(e);
    setFr(zoomFramingAt(fr, Math.exp(-e.deltaY * 0.0015), px, py, ref));
  }
  // React attaches wheel listeners as passive: add a native one so the page doesn't scroll while zooming.
  const wheelRef = React.useRef();
  wheelRef.current = onWheel;
  React.useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const fn = e => {
      e.preventDefault();
      wheelRef.current(e);
    };
    el.addEventListener("wheel", fn, {
      passive: false
    });
    return () => el.removeEventListener("wheel", fn);
  }, [layout, photo && photo.id, boxW]);
  const pct = fr ? framingZoomPercent(fr, ref) : 100;
  function onSlider(e) {
    const target = Number(e.target.value) / 100;
    setFr(zoomFramingAt(fr, ref * target / fr.width, cw / 2, ch / 2, ref));
  }
  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      assertUpsertOk(await SUPABASE.from("foot_photo_framings").upsert({
        photo_id: photo.id,
        layout,
        x: fr.x,
        y: fr.y,
        width: fr.width,
        updated_at: new Date().toISOString()
      }, {
        onConflict: "photo_id,layout"
      }));
      await reload();
      setMsg({
        t: "success",
        m: "Cadrage enregistré ✓"
      });
    } catch (e) {
      setMsg({
        t: "error",
        m: "Erreur: " + e.message
      });
    }
    setSaving(false);
  }
  // Slides the photo sideways so the player himself (not the picture) stands in the middle of the canvas.
  async function centerPlayer() {
    setCentering(true);
    setMsg(null);
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error("Photo illisible"));
        i.src = instaPublicUrl(photo.path);
      });
      const W = 240,
        H = Math.max(1, Math.round(W * img.naturalHeight / img.naturalWidth));
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, W, H);
      setFr(centerFramingOnPerson(fr, cw, personCenterRatio(ctx.getImageData(0, 0, W, H).data, W, H)));
    } catch (e) {
      setMsg({
        t: "error",
        m: "Centrage impossible : " + e.message
      });
    }
    setCentering(false);
  }
  function previewServer() {
    const url = (l, withFraming) => `/api/insta/render?${new URLSearchParams({
      kind: "frame",
      photo: String(photo.id),
      layout: l,
      ...(withFraming ? {
        x: String(Math.round(fr.x * 10) / 10),
        y: String(Math.round(fr.y * 10) / 10),
        w: String(Math.round(fr.width * 10) / 10)
      } : {}),
      t: String(Date.now())
    })}`;
    // Match Day and Résultat are framed separately: show the one being adjusted next to the other, as saved.
    const other = {
      matchday: "result",
      result: "matchday"
    }[layout];
    const name = {
      matchday: "Match Day",
      result: "Résultat"
    };
    setServerPreview(other ? [{
      label: `${name[layout]} (réglage en cours)`,
      src: url(layout, true)
    }, {
      label: `${name[other]} (enregistré)`,
      src: url(other, false)
    }] : [{
      label: "",
      src: url(layout, true)
    }]);
  }
  const sel = {
    ...FOOT_SELECT_STYLE,
    width: "100%",
    marginBottom: 8
  };
  const btn = primary => ({
    flex: "1 1 auto",
    background: primary ? FC.accent : FC.soft,
    color: primary ? "#fff" : FC.text,
    border: primary ? "none" : `1px solid ${FC.line}`,
    borderRadius: 8,
    padding: "9px 6px",
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer"
  });
  const isMask = layout === "render" || layout.startsWith("podium_");
  if (!players.length) return /*#__PURE__*/React.createElement(FCard, null, /*#__PURE__*/React.createElement(FEmpty, {
    icon: "photo",
    title: "Aucune photo",
    text: "Envoie d'abord des photos dans l'onglet Photos."
  }));
  return /*#__PURE__*/React.createElement(FCard, null, /*#__PURE__*/React.createElement(FSegmented, {
    value: mode,
    onChange: setMode,
    options: [["single", "Un joueur"], ["compare", "Comparer tous"]],
    style: {
      marginBottom: 12
    }
  }), mode === "single" && /*#__PURE__*/React.createElement("select", {
    style: sel,
    value: pid || "",
    onChange: e => setPlayerId(Number(e.target.value))
  }, players.map(p => /*#__PURE__*/React.createElement("option", {
    key: p.id,
    value: p.id
  }, nameOf(p)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("select", {
    style: sel,
    value: kit,
    onChange: e => setKit(e.target.value)
  }, INSTA_KITS.map(([k, l]) => /*#__PURE__*/React.createElement("option", {
    key: k,
    value: k
  }, l))), /*#__PURE__*/React.createElement("select", {
    style: sel,
    value: layout,
    onChange: e => setLayout(e.target.value)
  }, FRAMING_LAYOUT_LABELS.map(([k, l]) => /*#__PURE__*/React.createElement("option", {
    key: k,
    value: k
  }, l)))), mode === "compare" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: 14,
      color: FC.muted,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: showGuides,
    onChange: e => setShowGuides(e.target.checked)
  }), " Afficher les rep\xE8res (zones couvertes par le texte)"), /*#__PURE__*/React.createElement(FootFramingCompare, {
    players: players,
    photos: photos,
    framings: framings,
    kit: kit,
    layout: layout,
    showGuides: showGuides,
    onPick: id => {
      setPlayerId(id);
      setMode("single");
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: FC.muted,
      textAlign: "center",
      marginTop: 12
    }
  }, "Touche un joueur pour ajuster son cadrage.")), mode === "single" && !photo && /*#__PURE__*/React.createElement(FEmpty, {
    icon: "photo",
    title: "Pas de photo",
    text: "Aucune photo pour cet emplacement : envoie-la dans l'onglet Photos."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: mode === "single" && photo ? "block" : "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    ref: boxRef,
    onPointerDown: onDown,
    onPointerMove: onMove,
    onPointerUp: onUp,
    onPointerCancel: onUp,
    style: {
      position: "relative",
      width: boxW,
      height: ch * scale,
      overflow: "hidden",
      touchAction: "none",
      cursor: "grab",
      userSelect: "none",
      borderRadius: layout === "render" ? "50%" : isMask ? 40 * scale : 0,
      background: isMask ? "#ffffff" : "#222"
    }
  }, !isMask && /*#__PURE__*/React.createElement("img", {
    src: `/assets/insta/bg-${photo ? photo.kit : kit}.jpg`,
    alt: "",
    draggable: false,
    style: {
      position: "absolute",
      left: 0,
      top: 0,
      width: cw * scale,
      height: ch * scale
    }
  }), (FRAMING_GUIDES[layout] || []).filter(g => g.behind).map(g => /*#__PURE__*/React.createElement(FootGuideBox, {
    key: g.label,
    g: g,
    scale: scale,
    text: true
  })), photo && rect && /*#__PURE__*/React.createElement("img", {
    src: instaPublicUrl(photo.path),
    alt: "",
    draggable: false,
    style: {
      position: "absolute",
      left: rect.x * scale,
      top: rect.y * scale,
      width: rect.width * scale,
      height: rect.height * scale,
      pointerEvents: "none"
    }
  }), (FRAMING_GUIDES[layout] || []).filter(g => !g.behind).map(g => /*#__PURE__*/React.createElement(FootGuideBox, {
    key: g.label,
    g: g,
    scale: scale,
    text: true
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      margin: "14px 0"
    }
  }, /*#__PURE__*/React.createElement(FLabel, {
    style: {
      marginBottom: 0
    }
  }, "Zoom"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: 50,
    max: 500,
    step: 1,
    value: Math.min(500, Math.max(50, pct)),
    onChange: onSlider,
    style: {
      flex: 1
    },
    "aria-label": "Zoom"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: FF.ui,
      fontSize: 15,
      color: FC.deep,
      width: 48,
      textAlign: "right"
    }
  }, pct, "%")), msg && /*#__PURE__*/React.createElement(FMessage, {
    tone: msg.t === "error" ? "bad" : "good"
  }, msg.m), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(FBtn, {
    icon: "check",
    disabled: saving || !fr,
    onClick: save,
    style: {
      flex: "1 1 auto"
    }
  }, saving ? "…" : "Enregistrer"), /*#__PURE__*/React.createElement(FBtn, {
    variant: "secondary",
    disabled: !photo,
    onClick: () => {
      setMsg(null);
      setFr(defaultFraming(layout, photo));
    },
    style: {
      flex: "1 1 auto"
    }
  }, "R\xE9initialiser"), /*#__PURE__*/React.createElement(FBtn, {
    variant: "secondary",
    disabled: !fr || centering,
    onClick: centerPlayer,
    style: {
      flex: "1 1 auto"
    }
  }, centering ? "…" : "Centrer le joueur"), /*#__PURE__*/React.createElement(FBtn, {
    variant: "ghost",
    icon: "photo",
    disabled: !fr,
    onClick: previewServer,
    style: {
      flex: "1 1 auto"
    }
  }, "Aper\xE7u serveur")), serverPreview && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement(FLabel, null, "Aper\xE7u serveur (rendu r\xE9el)"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      justifyContent: "center"
    }
  }, serverPreview.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.label || "one",
    style: {
      flex: serverPreview.length > 1 ? "1 1 0" : "none",
      minWidth: 0,
      width: serverPreview.length > 1 ? undefined : boxW
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: p.src,
    alt: `Aperçu serveur ${p.label}`.trim(),
    onError: () => setMsg({
      t: "error",
      m: "Aperçu serveur indisponible"
    }),
    style: {
      display: "block",
      width: "100%",
      borderRadius: layout === "render" ? "50%" : 0
    }
  }), p.label && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: FC.muted,
      marginTop: 4
    }
  }, p.label)))))));
}
function FootInstaKeyBox({
  onSaved
}) {
  const [v, setV] = React.useState("");
  function save() {
    if (!v.trim()) return;
    try {
      localStorage.setItem(INSTA_KEY_STORAGE, v.trim());
    } catch (e) {}
    onSaved();
  }
  return /*#__PURE__*/React.createElement(FCard, null, /*#__PURE__*/React.createElement(FHeading, null, "Cl\xE9 admin"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: FC.muted,
      marginBottom: 12,
      lineHeight: 1.4
    }
  }, "Gard\xE9e uniquement dans ce navigateur, envoy\xE9e seulement \xE0 l'API du site."), /*#__PURE__*/React.createElement("input", {
    type: "password",
    style: FOOT_INPUT_STYLE,
    placeholder: "Cl\xE9 admin",
    value: v,
    onChange: e => setV(e.target.value),
    "aria-label": "Cl\xE9 admin"
  }), /*#__PURE__*/React.createElement(FBtn, {
    full: true,
    onClick: save
  }, "Enregistrer la cl\xE9"));
}

// Images of one post: Match Day + Groupe is a 2-image carousel (same player on both), Classements a 3-image one.
// `player` is the admin's pick for the player on the photo (none = automatic rotation).
function instaImages(kind, {
  matchId,
  season
}, v, player) {
  const url = params => `/api/insta/render?${new URLSearchParams({
    ...params,
    v,
    ...(player ? {
      player
    } : {})
  })}`;
  if (kind === "matchday") return [{
    label: "Match Day",
    src: url({
      kind: "matchday",
      match: matchId,
      page: 1
    })
  }, {
    label: "Groupe",
    src: url({
      kind: "matchday",
      match: matchId,
      page: 2
    })
  }];
  if (kind === "rankings") return RANKING_PAGES.map((pg, i) => ({
    label: pg.heading,
    src: url({
      kind: "rankings",
      season,
      page: i + 1
    })
  }));
  return [{
    label: kind === "ratings" ? "Notes" : "Résultat",
    src: url({
      kind,
      match: matchId
    })
  }];
}

// Short fingerprint of everything a post's images and caption are drawn from: the URL changes when the match does,
// so the browser never reuses an outdated render.
function instaDataKey(kind, target, {
  matches,
  lineups,
  events,
  ratings
}) {
  const mid = target.matchId;
  const slice = kind === "rankings" ? [matches.map(m => [m.id, m.status, m.venue, m.ratings_validated_at]), events, lineups, ratings] : [matches.filter(m => m.id === mid), lineups.filter(l => l.match_id === mid), events.filter(e => e.match_id === mid), ratings.filter(r => r.match_id === mid)];
  const str = JSON.stringify(slice);
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33 ^ str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
const INSTA_DAY_LABELS = ["le jour même", "la veille", "2 jours avant", "3 jours avant", "4 jours avant", "5 jours avant", "6 jours avant"];
const INSTA_AFTER_LABELS = ["le jour même", "le lendemain", "2 jours après", "3 jours après", "4 jours après", "5 jours après", "6 jours après"];
const INSTA_WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const INSTA_WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const instaWhen = d => d ? new Date(d).toLocaleString("fr-FR", {
  timeZone: "Europe/Paris",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit"
}) : "";
const instaPublicImageUrl = path => `${SUPABASE_URL}/storage/v1/object/public/insta-posts/${path.split("/").map(encodeURIComponent).join("/")}`;
function FootInstaImages({
  images
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      overflowX: "auto",
      marginBottom: 10,
      paddingBottom: 2
    }
  }, images.map(im => /*#__PURE__*/React.createElement("a", {
    key: im.src,
    href: im.src,
    target: "_blank",
    rel: "noreferrer",
    style: {
      flex: "0 0 auto",
      width: 124,
      textAlign: "center",
      textDecoration: "none"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: im.src,
    alt: im.label,
    loading: "lazy",
    style: {
      width: 124,
      height: 155,
      objectFit: "cover",
      background: FC.soft,
      borderRadius: 14,
      display: "block",
      boxShadow: FC.shadowSm
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.ui,
      fontSize: 12,
      color: FC.muted,
      marginTop: 4,
      textTransform: "uppercase"
    }
  }, im.label))));
}

// How and when a section is sent: manual, or automatic with a slot.
function FootSectionSchedule({
  sec,
  cfg,
  onChange
}) {
  const rule = cfg.rule;
  const set = patch => onChange({
    ...cfg,
    rule: {
      ...rule,
      ...patch
    }
  });
  const field = {
    ...FOOT_SELECT_STYLE
  };
  const typeChoice = sec.rules.length > 1 ? /*#__PURE__*/React.createElement("select", {
    value: rule.type,
    onChange: e => onChange({
      ...cfg,
      rule: e.target.value === "on_close" ? {
        type: "on_close",
        days: 0,
        time: "00:00"
      } : {
        type: "after_match",
        days: 0,
        time: "22:00"
      }
    }),
    style: field
  }, /*#__PURE__*/React.createElement("option", {
    value: "on_close"
  }, "D\xE8s la cl\xF4ture du match"), /*#__PURE__*/React.createElement("option", {
    value: "after_match"
  }, "\xC0 une heure pr\xE9cise apr\xE8s le match")) : null;
  if (rule.type === "on_close") return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 8,
      fontSize: 15,
      color: FC.text
    }
  }, typeChoice);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 8,
      fontSize: 15,
      color: FC.text
    }
  }, typeChoice, rule.type === "weekly" ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", null, "Chaque"), /*#__PURE__*/React.createElement("select", {
    value: rule.weekday,
    onChange: e => set({
      weekday: Number(e.target.value)
    }),
    style: field
  }, INSTA_WEEKDAY_ORDER.map(d => /*#__PURE__*/React.createElement("option", {
    key: d,
    value: d
  }, INSTA_WEEKDAYS[d])))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", null, "Envoyer"), /*#__PURE__*/React.createElement("select", {
    value: rule.days,
    onChange: e => set({
      days: Number(e.target.value)
    }),
    style: field
  }, (rule.type === "before_match" ? INSTA_DAY_LABELS : INSTA_AFTER_LABELS).map((l, i) => /*#__PURE__*/React.createElement("option", {
    key: i,
    value: i
  }, l))), /*#__PURE__*/React.createElement("span", null, "du match")), /*#__PURE__*/React.createElement("span", null, "\xE0"), /*#__PURE__*/React.createElement("input", {
    type: "time",
    value: rule.time,
    onChange: e => e.target.value && set({
      time: e.target.value
    }),
    style: field
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: FC.muted
    }
  }, "(heure de Paris)"));
}
function FootInstaNext({
  sec,
  next,
  cfg,
  data,
  posts,
  featuredId,
  candidates,
  onPickPlayer,
  onPublished
}) {
  const target = {
    kind: sec.kind,
    matchId: next.matchId,
    weekKey: next.weekKey,
    season: next.season
  };
  const match = next.matchId ? data.matches.find(m => m.id === next.matchId) : null;
  const key = instaDataKey(sec.kind, target, data);
  const [caption, setCaption] = React.useState(() => next.available ? captionFor(sec.kind, captionContextFor(sec.kind, target, {
    ...data,
    players: PLAYERS
  })) : "");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const [copied, setCopied] = React.useState(false);
  const failed = posts.filter(p => p.kind === sec.kind && p.status === "failed" && (next.weekKey ? p.week_key === next.weekKey : p.match_id === next.matchId)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
  const images = next.previewable ? instaImages(sec.kind, target, key, featuredId) : [];
  const chosen = candidates.find(c => c.id === featuredId);
  async function publish() {
    if (!window.confirm(`Publier maintenant sur Instagram ?\n\n${caption.slice(0, 200)}`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await instaAdminFetch("publish", {
        section: sec.key,
        match_id: next.matchId,
        week_key: next.weekKey,
        season: next.season,
        caption
      });
      setMsg(r.status === "published" ? {
        t: "success",
        m: "Publié ✓"
      } : r.status === "in_progress" ? {
        t: "error",
        m: "Une publication est déjà en cours"
      } : {
        t: "success",
        m: "Déjà publié"
      });
      await onPublished();
    } catch (e) {
      setMsg({
        t: "error",
        m: e.message
      });
    }
    setBusy(false);
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.warn("copy failed", e);
    }
  }
  let badge;
  if (!next.available) badge = ["warn", "En attente : " + next.waitingFor];else if (cfg.mode !== "auto") badge = ["accent", "Prêt — envoi manuel"];else if (next.due) badge = ["warn", "Part au prochain passage (≤ 10 min)"];else if (!next.scheduledAt) badge = ["good", "Part dès la clôture du match"];else badge = ["good", `Programmé : ${instaWhen(next.scheduledAt)}`];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.ui,
      fontSize: 18,
      lineHeight: 1.2,
      marginBottom: 6
    }
  }, match ? `vs ${match.opponent_name}` : `Saison ${next.season}`, match && /*#__PURE__*/React.createElement("span", {
    style: {
      color: FC.muted,
      fontSize: 14
    }
  }, " \xB7 ", instaWhen(match.match_datetime))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(FChip, {
    tone: badge[0]
  }, badge[1])), failed && /*#__PURE__*/React.createElement(FMessage, null, "Dernier essai \xE9chou\xE9 : ", failed.error), next.previewable && /*#__PURE__*/React.createElement(FootInstaImages, {
    images: images
  }), sec.featured && next.previewable && /*#__PURE__*/React.createElement(FField, {
    label: "Joueur sur la photo"
  }, /*#__PURE__*/React.createElement("select", {
    value: featuredId || "",
    onChange: e => onPickPlayer(targetKey(target), e.target.value ? Number(e.target.value) : null),
    style: {
      ...FOOT_INPUT_STYLE,
      marginBottom: 0
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Automatique (rotation)"), candidates.map(c => /*#__PURE__*/React.createElement("option", {
    key: c.id,
    value: c.id
  }, c.name))), sec.key === "matchday" && chosen && !chosen.hasDos && /*#__PURE__*/React.createElement(FMessage, {
    tone: "warn",
    style: {
      marginTop: 8
    }
  }, "Pas de photo \xAB dos \xBB pour ce joueur : l'image Groupe sera sans joueur.")), next.available && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(FField, {
    label: "L\xE9gende"
  }, /*#__PURE__*/React.createElement("textarea", {
    value: caption,
    onChange: e => setCaption(e.target.value),
    rows: 4,
    style: {
      ...FOOT_INPUT_STYLE,
      marginBottom: 0,
      resize: "vertical",
      lineHeight: 1.4
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(FBtn, {
    icon: "send",
    onClick: publish,
    disabled: busy,
    style: {
      flex: "1 1 auto"
    }
  }, busy ? "Publication…" : "Publier maintenant"), /*#__PURE__*/React.createElement(FBtn, {
    variant: "secondary",
    onClick: copy,
    style: {
      flex: "1 1 auto"
    }
  }, copied ? "Copié ✓" : "Copier la légende"))), msg && /*#__PURE__*/React.createElement(FMessage, {
    tone: msg.t === "error" ? "bad" : "good",
    style: {
      marginTop: 10
    }
  }, msg.m));
}
function FootInstaLast({
  sec,
  last,
  data
}) {
  if (last.published) {
    const p = last.post;
    const m = p.match_id ? data.matches.find(x => x.id === p.match_id) : null;
    const images = (p.image_paths || []).map((path, i) => ({
      label: `${i + 1}`,
      src: instaPublicImageUrl(path)
    }));
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: FF.ui,
        fontSize: 18,
        lineHeight: 1.2,
        marginBottom: 6
      }
    }, m ? `vs ${m.opponent_name}` : `Saison ${p.season || ""}`), /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 10
      }
    }, /*#__PURE__*/React.createElement(FChip, {
      tone: "good",
      icon: "check"
    }, "Publi\xE9 le ", instaWhen(p.published_at))), images.length > 0 && /*#__PURE__*/React.createElement(FootInstaImages, {
      images: images
    }), p.permalink && /*#__PURE__*/React.createElement(FBtn, {
      size: "sm",
      variant: "secondary",
      onClick: () => window.open(p.permalink, "_blank", "noopener")
    }, "Voir sur Instagram"));
  }
  const m = last.matchId ? data.matches.find(x => x.id === last.matchId) : null;
  if (!last.available) return /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: FC.muted
    }
  }, "Aucun post pour l'instant.");
  const target = {
    kind: sec.kind,
    matchId: last.matchId,
    season: last.season
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.ui,
      fontSize: 18,
      lineHeight: 1.2,
      marginBottom: 6
    }
  }, m ? `vs ${m.opponent_name}` : `Saison ${last.season}`), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(FChip, {
    tone: "plain"
  }, "Jamais publi\xE9 \xB7 dernier visuel")), /*#__PURE__*/React.createElement(FootInstaImages, {
    images: instaImages(sec.kind, target, instaDataKey(sec.kind, target, data))
  }));
}
function FootInstaSection({
  sec,
  saved,
  data,
  posts,
  featured,
  candidates,
  onPickPlayer,
  onSave,
  onPublished
}) {
  const [draft, setDraft] = React.useState(saved);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState(null);
  React.useEffect(() => {
    setDraft(saved);
  }, [JSON.stringify(saved)]);
  const dirty = JSON.stringify({
    m: draft.mode,
    r: draft.rule
  }) !== JSON.stringify({
    m: saved.mode,
    r: saved.rule
  });
  const state = sectionState(sec.key, {
    matches: data.matches,
    lineups: data.lineups,
    posts,
    settings: {
      [sec.key]: saved
    },
    now: new Date()
  });
  async function save() {
    setSaving(true);
    setErr(null);
    try {
      await onSave(sec.key, draft);
    } catch (e) {
      setErr(e.message);
    }
    setSaving(false);
  }
  return /*#__PURE__*/React.createElement(FCard, null, /*#__PURE__*/React.createElement(FHeading, {
    right: /*#__PURE__*/React.createElement(FChip, {
      tone: saved.mode === "auto" ? "good" : "plain"
    }, saved.mode === "auto" ? "Automatique" : "Manuel")
  }, sec.label), /*#__PURE__*/React.createElement(FSegmented, {
    value: draft.mode,
    onChange: m => setDraft({
      ...draft,
      mode: m
    }),
    options: [["manual", "Manuel"], ["auto", "Automatique"]],
    style: {
      marginBottom: 12
    }
  }), draft.mode === "auto" && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(FootSectionSchedule, {
    sec: sec,
    cfg: draft,
    onChange: setDraft
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: FC.muted,
      marginTop: 8,
      lineHeight: 1.4
    }
  }, "Seuls les cr\xE9neaux \xE0 venir partent tout seuls", saved.mode === "auto" && saved.since ? ` (activé le ${instaWhen(saved.since)})` : ", à partir de l'enregistrement", ". Rien d'ancien n'est publi\xE9.")), dirty && /*#__PURE__*/React.createElement(FBtn, {
    full: true,
    onClick: save,
    disabled: saving,
    style: {
      marginBottom: 12
    }
  }, saving ? "Enregistrement…" : "Enregistrer le réglage"), err && /*#__PURE__*/React.createElement(FMessage, null, err), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 20,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: "1 1 260px",
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(FLabel, null, "Dernier post"), /*#__PURE__*/React.createElement(FootInstaLast, {
    sec: sec,
    last: state.last,
    data: data
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: "1 1 260px",
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(FLabel, null, "Prochain post"), state.next ? /*#__PURE__*/React.createElement(FootInstaNext, {
    key: `${targetKey(state.next)}-${instaDataKey(sec.kind, state.next, data)}`,
    sec: sec,
    next: state.next,
    cfg: saved,
    data: data,
    posts: posts,
    featuredId: featured[targetKey(state.next)],
    candidates: candidates,
    onPickPlayer: onPickPlayer,
    onPublished: onPublished
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: FC.muted
    }
  }, "Rien de pr\xE9vu pour l'instant."))));
}
function FootPostsTab({
  matches,
  lineups,
  events,
  ratings,
  roster,
  photos
}) {
  const [settings, setSettings] = React.useState(null);
  const [featured, setFeatured] = React.useState({});
  const [instaPosts, setInstaPosts] = React.useState([]);
  const [loadErr, setLoadErr] = React.useState(null);
  const data = {
    matches,
    lineups,
    events,
    ratings
  };
  const reloadPosts = () => instaAdminFetch("posts", null, "GET").then(r => setInstaPosts(r.posts || [])).catch(e => setLoadErr(prev => prev || e.message));
  // Players that can be put on a photo: roster players with a celebration photo.
  const candidates = roster.map(r => PLAYERS.find(p => p.id === r.player_id)).filter(Boolean).filter(p => photos.some(ph => ph.player_id === p.id && ph.kind === "celebration")).map(p => ({
    id: p.id,
    name: getDisplayName(p, PLAYERS) || "",
    hasDos: photos.some(ph => ph.player_id === p.id && ph.kind === "dos")
  })).sort((a, b) => a.name.localeCompare(b.name));
  async function pickPlayer(key, id) {
    const before = featured;
    const next = {
      ...featured
    };
    if (id) next[key] = id;else delete next[key];
    setFeatured(next); // instant feedback; the server answer is the truth
    try {
      const r = await instaAdminFetch("featured", {
        key,
        player_id: id
      });
      setFeatured(r.featured || {});
    } catch (e) {
      setFeatured(before);
      setLoadErr(e.message);
    }
  }
  React.useEffect(() => {
    instaAdminFetch("featured", null, "GET").then(r => setFeatured(r.featured || {})).catch(() => {});
    reloadPosts();
    instaAdminFetch("settings", null, "GET").then(r => setSettings(normalizeSettings(r.settings))).catch(e => {
      setLoadErr(e.message);
      setSettings(defaultSettings());
    });
  }, []);
  async function saveSection(key, cfg) {
    const r = await instaAdminFetch("settings", {
      settings: {
        ...settings,
        [key]: {
          mode: cfg.mode,
          rule: cfg.rule
        }
      }
    });
    setSettings(normalizeSettings(r.settings));
  }
  if (!settings) return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(FSkeleton, {
    h: 260
  }), /*#__PURE__*/React.createElement(FSkeleton, {
    h: 260
  }));
  return /*#__PURE__*/React.createElement("div", null, loadErr && /*#__PURE__*/React.createElement(FMessage, null, "R\xE9glages indisponibles (", loadErr, "). Valeurs par d\xE9faut (manuel) affich\xE9es."), INSTA_SECTIONS.map(sec => /*#__PURE__*/React.createElement(FootInstaSection, {
    key: sec.key,
    sec: sec,
    saved: settings[sec.key],
    data: data,
    posts: instaPosts,
    featured: featured,
    candidates: candidates,
    onPickPlayer: pickPlayer,
    onSave: saveSection,
    onPublished: reloadPosts
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      color: "rgba(255,255,255,0.9)",
      fontSize: 13,
      textAlign: "center",
      textShadow: "1px 1px 0 rgba(0,0,0,0.25)"
    }
  }, "Envoi automatique : un planificateur v\xE9rifie toutes les ~10 minutes ce qui doit partir."));
}
function FootReseauxPage({
  roster,
  photos,
  framings,
  matches,
  lineups,
  events,
  ratings,
  reload
}) {
  const [tab, setTab] = React.useState(() => readPref("foot_reseaux_tab", "photos", ["posts", "photos", "cadrage"]));
  const [hasKey, setHasKey] = React.useState(() => !!readInstaKey());
  const pick = t => {
    setTab(t);
    writePref("foot_reseaux_tab", t);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "ft-page"
  }, !hasKey && /*#__PURE__*/React.createElement(FootInstaKeyBox, {
    onSaved: () => setHasKey(true)
  }), /*#__PURE__*/React.createElement(FSegmented, {
    value: tab,
    onChange: pick,
    options: [["posts", "Posts", "send"], ["photos", "Photos", "photo"], ["cadrage", "Cadrage", "pencil"]],
    style: {
      marginBottom: 14,
      background: "rgba(255,255,255,0.92)"
    }
  }), tab === "posts" && /*#__PURE__*/React.createElement(FootPostsTab, {
    matches: matches,
    lineups: lineups,
    events: events,
    ratings: ratings,
    roster: roster,
    photos: photos
  }), tab === "photos" && /*#__PURE__*/React.createElement(FootPhotosTab, {
    roster: roster,
    photos: photos,
    reload: reload
  }), tab === "cadrage" && /*#__PURE__*/React.createElement(FootFramingTool, {
    roster: roster,
    photos: photos,
    framings: framings,
    reload: reload
  }), hasKey && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      try {
        localStorage.removeItem(INSTA_KEY_STORAGE);
      } catch (e) {}
      setHasKey(false);
    },
    style: {
      background: "none",
      border: "none",
      color: "rgba(255,255,255,0.9)",
      fontSize: 13,
      cursor: "pointer",
      textDecoration: "underline",
      textShadow: "1px 1px 0 rgba(0,0,0,0.25)"
    }
  }, "Changer la cl\xE9 admin")));
}

// ---- app shell --------------------------------------------------------------------------------------------------------------------------
const FOOT_PAGE_TITLES = {
  calendar: ["Matchs", "Bière Leverculsec"],
  rankings: ["Classement", null],
  stats: ["Stats", null],
  reseaux: ["Réseaux", "Instagram"],
  admin: ["Admin", "Matchs et effectif"]
};
function FootballApp({
  currentPlayer,
  onBack
}) {
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
  const isAdmin = isBureau(currentPlayer);
  const setTheme = t => {
    setThemeState(t);
    writePref("foot_theme", t);
  };
  React.useEffect(() => {
    // the browser bar follows the theme
    const meta = document.querySelector('meta[name="theme-color"]');
    const previous = meta ? meta.getAttribute("content") : null;
    if (meta) meta.setAttribute("content", FC.accent);
    return () => {
      if (meta && previous) meta.setAttribute("content", previous);
    };
  }, [theme]);
  async function reloadFoot() {
    const [r, m, a, e, l, rt, ph, fr] = await Promise.all([sbFetch("foot_roster", "?select=*"), sbFetch("foot_matches", "?select=*&order=match_datetime"), sbFetch("foot_attendance", "?select=*"), sbFetch("foot_match_events", "?select=*"), sbFetch("foot_lineups", "?select=match_id,player_id"), sbFetch("foot_ratings", "?select=match_id,rater_id,ratee_id,score"), sbFetch("foot_player_photos", "?select=*").catch(() => []),
    // optional: absent until the insta migration is applied
    sbFetch("foot_photo_framings", "?select=*").catch(() => [])]);
    setRoster(r || []);
    setMatches(m || []);
    setAttendance(a || []);
    setEvents(e || []);
    setLineups(l || []);
    setPhotos(ph || []);
    setFramings(fr || []);
    setRatings((rt || []).map(x => ({
      ...x,
      score: Number(x.score)
    })));
  }
  React.useEffect(() => {
    reloadFoot().then(() => setLoaded(true)).catch(err => {
      console.warn("foot load failed", err);
      setLoadError(err.message);
      setLoaded(true);
    });
  }, []);
  function nav(p, s = {}) {
    setPage(p);
    setSub(s);
    window.scrollTo && window.scrollTo(0, 0);
  }
  const navItems = [{
    id: "calendar",
    label: "Matchs",
    icon: "calendar"
  }, {
    id: "rankings",
    label: "Classement",
    icon: "trophy"
  }, {
    id: "stats",
    label: "Stats",
    icon: "chart"
  }, ...(isAdmin ? [{
    id: "reseaux",
    label: "Réseaux",
    icon: "megaphone"
  }, {
    id: "admin",
    label: "Admin",
    icon: "sliders"
  }] : [])];
  const detail = page === "matchDetail";
  const openMatch = detail ? matches.find(m => m.id === sub.matchId) : null;
  const [title, subtitle] = detail ? [openMatch ? {
    scheduled: "Match",
    live: "En direct",
    finished: "Résultat"
  }[openMatch.status] : "Match", openMatch ? `vs ${openMatch.opponent_name}` : null] : FOOT_PAGE_TITLES[page] || ["Foot", null];
  return /*#__PURE__*/React.createElement(FootCtx.Provider, {
    value: {
      photos,
      framings,
      themeName: theme
    }
  }, /*#__PURE__*/React.createElement(FootShell, {
    wide: page === "stats" || page === "reseaux"
  }, /*#__PURE__*/React.createElement(FTopBar, {
    title: title,
    subtitle: subtitle,
    theme: theme,
    onTheme: setTheme,
    onHome: onBack,
    onBack: detail ? () => nav("calendar") : undefined
  }), !loaded && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(FSkeleton, {
    h: 190
  }), /*#__PURE__*/React.createElement(FSkeleton, {
    h: 76
  }), /*#__PURE__*/React.createElement(FSkeleton, {
    h: 76
  })), loaded && loadError && /*#__PURE__*/React.createElement(FMessage, null, "Chargement incomplet : ", loadError), loaded && page === "calendar" && /*#__PURE__*/React.createElement(FootCalendarPage, {
    matches: matches,
    events: events,
    roster: roster,
    attendance: attendance,
    nav: nav,
    currentPlayer: currentPlayer,
    reload: reloadFoot
  }), loaded && detail && /*#__PURE__*/React.createElement(FootMatchDetailPage, {
    matchId: sub.matchId,
    matches: matches,
    roster: roster,
    attendance: attendance,
    events: events,
    lineups: lineups,
    ratings: ratings,
    currentPlayer: currentPlayer,
    navBack: () => nav("calendar"),
    reload: reloadFoot
  }), loaded && page === "admin" && isAdmin && /*#__PURE__*/React.createElement(FootAdminPage, {
    roster: roster,
    reload: reloadFoot
  }), loaded && page === "reseaux" && isAdmin && /*#__PURE__*/React.createElement(FootReseauxPage, {
    roster: roster,
    photos: photos,
    framings: framings,
    matches: matches,
    lineups: lineups,
    events: events,
    ratings: ratings,
    reload: reloadFoot
  }), loaded && page === "rankings" && /*#__PURE__*/React.createElement(FootRankingsPage, null), loaded && page === "stats" && /*#__PURE__*/React.createElement(FootStatsPage, {
    matches: matches,
    lineups: lineups,
    events: events,
    ratings: ratings,
    roster: roster,
    currentPlayer: currentPlayer
  })), /*#__PURE__*/React.createElement(FNav, {
    page: detail ? "calendar" : page,
    items: navItems,
    onGo: nav
  }));
}
