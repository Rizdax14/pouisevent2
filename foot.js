function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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

// An admin can clear an answer (back to "no response").
async function clearMatchAttendance(matchId, playerId) {
  await sbFetch("foot_attendance", `?match_id=eq.${matchId}&player_id=eq.${playerId}`, {
    method: "DELETE"
  });
}
async function setActivityAttendance(activityId, playerId, status) {
  assertUpsertOk(await SUPABASE.from("foot_activity_attendance").upsert({
    activity_id: activityId,
    player_id: playerId,
    status,
    responded_at: new Date().toISOString()
  }, {
    onConflict: "activity_id,player_id"
  }));
}
async function clearActivityAttendance(activityId, playerId) {
  await sbFetch("foot_activity_attendance", `?activity_id=eq.${activityId}&player_id=eq.${playerId}`, {
    method: "DELETE"
  });
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

// "Prénom N" everywhere in the club; two club players with the same first name and initial keep their display name
let FOOT_POOL = null; // the club's players (roster + everyone on a sheet), set when the data loads
const footShortName = p => shortName(p, FOOT_POOL ? PLAYERS.filter(x => FOOT_POOL.has(x.id)) : PLAYERS);
const footNameOf = id => {
  const p = PLAYERS.find(x => x.id === id);
  return p ? footShortName(p) : "?";
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
// "19h" or "18h30" (Paris time)
function footHour(iso) {
  const [h, m] = footTime(iso).split(":");
  return `${Number(h)}h${m === "00" ? "" : m}`;
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
  const links = mapLinks(match);
  const [open, setOpen] = React.useState(false);
  const stop = e => e.stopPropagation();
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
  }), footDate(match.match_datetime)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      color: FC.text
    }
  }, /*#__PURE__*/React.createElement(FIcon, {
    name: "clock",
    size: 16
  }), /*#__PURE__*/React.createElement("span", null, "Heure du match : ", /*#__PURE__*/React.createElement("b", null, footHour(match.match_datetime)))), match.meeting_at && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      color: FC.text
    }
  }, /*#__PURE__*/React.createElement(FIcon, {
    name: "users",
    size: 16
  }), /*#__PURE__*/React.createElement("span", null, "Heure de RDV : ", /*#__PURE__*/React.createElement("b", null, footHour(match.meeting_at)))), place && (links ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      stop(e);
      setOpen(!open);
    },
    "aria-expanded": open,
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: 8,
      border: "none",
      background: "none",
      padding: 0,
      margin: 0,
      font: "inherit",
      color: FC.deep,
      textAlign: "left",
      cursor: "pointer",
      textDecoration: "underline",
      textUnderlineOffset: 3
    }
  }, /*#__PURE__*/React.createElement(FIcon, {
    name: "pin",
    size: 16,
    style: {
      marginTop: 1
    }
  }), /*#__PURE__*/React.createElement("span", null, place)), open && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      margin: "8px 0 2px 24px"
    }
  }, [["waze", "Waze"], ["plans", "Plans"], ["google", "Google Maps"]].map(([k, label]) => /*#__PURE__*/React.createElement("a", {
    key: k,
    href: links[k],
    target: "_blank",
    rel: "noreferrer",
    onClick: stop,
    style: {
      fontFamily: FF.ui,
      fontSize: 14,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      textDecoration: "none",
      color: "#fff",
      background: FC.accent,
      borderRadius: 999,
      padding: "8px 14px",
      minHeight: 20
    }
  }, label)))) : /*#__PURE__*/React.createElement("div", {
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
  }), /*#__PURE__*/React.createElement("span", null, place))));
}

// Portrait with a small status dot in its corner: green = present, red = absent, grey = no answer yet (no dot when unknown).
const FOOT_PRESENCE_LABEL = {
  present: "Présent",
  absent: "Absent",
  none: "Pas de réponse"
};
function FootPresenceAvatar({
  id,
  name,
  size,
  status
}) {
  if (!status) return /*#__PURE__*/React.createElement(FAvatar, {
    playerId: id,
    name: name,
    size: size
  });
  const color = status === "present" ? FC.good : status === "absent" ? FC.bad : FC.muted;
  const d = Math.max(10, Math.round(size * 0.36));
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      display: "inline-flex",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(FAvatar, {
    playerId: id,
    name: name,
    size: size
  }), /*#__PURE__*/React.createElement("span", {
    role: "img",
    "aria-label": FOOT_PRESENCE_LABEL[status],
    title: FOOT_PRESENCE_LABEL[status],
    style: {
      position: "absolute",
      right: -2,
      bottom: -2,
      width: d,
      height: d,
      borderRadius: d / 2,
      background: color,
      border: "2px solid #fff",
      boxSizing: "border-box"
    }
  }));
}
// player id → "present" | "absent" | "none" for one match.
function presenceMap(attendance, matchId) {
  const out = {};
  for (const a of attendance || []) if (a.match_id === matchId) out[a.player_id] = a.status === "present" ? "present" : a.status === "absent" ? "absent" : "none";
  return out;
}

// A player as a pill: round portrait, name, optional jersey number.
function FootPlayerPill({
  id,
  number,
  tone = "soft",
  dim,
  status
}) {
  const name = footNameOf(id);
  const {
    openPlayer
  } = React.useContext(FootCtx);
  const open = openPlayer ? {
    role: "button",
    tabIndex: 0,
    onClick: e => {
      e.stopPropagation();
      openPlayer(id);
    },
    onKeyDown: e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        openPlayer(id);
      }
    },
    "aria-label": `Voir les stats de ${name}`
  } : {};
  return /*#__PURE__*/React.createElement("span", _extends({}, open, {
    style: {
      cursor: openPlayer ? "pointer" : "inherit",
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
  }), /*#__PURE__*/React.createElement(FootPresenceAvatar, {
    id: id,
    name: name,
    size: 28,
    status: status
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
  disabled,
  presence
}) {
  const ids = [...new Set([...roster.map(r => r.player_id), ...(extraIds || [])])];
  const numberOf = id => (roster.find(r => r.player_id === id) || {}).jersey_number;
  const players = ids.map(id => PLAYERS.find(p => p.id === id)).filter(Boolean).sort((a, b) => (footShortName(a) || "").localeCompare(footShortName(b) || ""));
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
    }, /*#__PURE__*/React.createElement(FootPresenceAvatar, {
      id: p.id,
      name: footShortName(p),
      size: 34,
      status: presence ? presence[p.id] || "none" : null
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, footShortName(p)), numberOf(p.id) && /*#__PURE__*/React.createElement("span", {
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
  attendance,
  isAdmin,
  reload
}) {
  const current = lineupIdsFor(lineups, match.id);
  const presence = presenceMap(attendance, match.id);
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
  }, "Convocation ", /*#__PURE__*/React.createElement("span", {
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
    number: numberOf(id),
    status: presence[id] || "none"
  }))) : /*#__PURE__*/React.createElement(FEmpty, {
    icon: "users",
    title: "Pas encore de convocation",
    text: isAdmin ? "Choisis les joueurs convoqués pour ce match." : "La convocation n'est pas encore publiée."
  })), editing && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(FootLineupChecklist, {
    roster: roster,
    extraIds: current,
    checked: wanted,
    onToggle: toggle,
    disabled: saving,
    presence: presence
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
    venue: "domicile",
    min_players: "10",
    meeting_time: ""
  };
  const start = initial ? {
    ...empty,
    ...initial,
    match_datetime: toDatetimeLocalValue(initial.match_datetime),
    min_players: initial.min_players == null ? "" : String(initial.min_players),
    meeting_time: meetingTimeValue(initial.meeting_at)
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
        m: "Adversaire et date/heure du coup d'envoi sont obligatoires."
      });
      return;
    }
    const minRaw = String(f.min_players ?? "").trim();
    const min = minRaw === "" ? null : Number(minRaw);
    if (min !== null && !(Number.isInteger(min) && min >= 1 && min <= 50)) {
      setMsg({
        t: "bad",
        m: "Le minimum de joueurs doit être un nombre entre 1 et 50 (ou vide)."
      });
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
    label: "Date et heure du coup d'envoi"
  }, /*#__PURE__*/React.createElement("input", {
    style: FOOT_INPUT_STYLE,
    type: "datetime-local",
    value: f.match_datetime,
    onChange: set("match_datetime")
  })), /*#__PURE__*/React.createElement(FField, {
    label: "Heure du rendez-vous (optionnel)"
  }, /*#__PURE__*/React.createElement("input", {
    style: FOOT_INPUT_STYLE,
    type: "time",
    value: f.meeting_time || "",
    onChange: set("meeting_time"),
    "aria-label": "Heure du rendez-vous"
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
    label: "Joueurs minimum"
  }, /*#__PURE__*/React.createElement("input", {
    style: FOOT_INPUT_STYLE,
    inputMode: "numeric",
    placeholder: "Ex. 10 (vide = pas de limite)",
    value: f.min_players ?? "",
    onChange: set("min_players"),
    "aria-label": "Nombre minimum de joueurs"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: FC.muted,
      margin: "-6px 0 14px"
    }
  }, "Au-del\xE0, les joueurs qui r\xE9pondent \xAB pr\xE9sent \xBB passent en liste d'attente, dans l'ordre de leur r\xE9ponse."), /*#__PURE__*/React.createElement(FField, {
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
  total,
  min,
  waiting
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
  }, ids.length), " / ", min || total, " ", min ? "confirmés" : "présents", waiting ? ` · ${waiting} en attente` : ""));
}
function FootMatchHero({
  match,
  score,
  presentIds,
  waitingCount,
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
  }), (match.ball_keepers || []).length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: 14,
      color: FC.text,
      marginTop: 5
    }
  }, /*#__PURE__*/React.createElement(FIcon, {
    name: "ball",
    size: 16
  }), /*#__PURE__*/React.createElement("span", null, "Ballons : ", /*#__PURE__*/React.createElement("b", null, match.ball_keepers.map(footNameOf).join(" et ")))), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: "12px 0"
    }
  }, /*#__PURE__*/React.createElement(FootMetaChips, {
    match: match
  })), !live && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(FootPresenceStack, {
    ids: presentIds,
    total: rosterSize,
    min: match.min_players,
    waiting: waitingCount
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
  const unknown = finished && match.score_unknown;
  const out = finished && !unknown ? footOutcome(score) : null;
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
    title: unknown ? "Score inconnu" : FOOT_OUTCOME_LABEL[out],
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
      background: unknown ? FC.muted : FC[FOOT_OUTCOME_TONE[out]],
      color: "#fff"
    }
  }, unknown ? "?" : out) : /*#__PURE__*/React.createElement("span", {
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
  }, unknown ? "?–?" : `${score.bl}–${score.opponent}`) : /*#__PURE__*/React.createElement(FIcon, {
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
  activities,
  activityAttendance,
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
  const upcomingActivities = (activities || []).filter(a => new Date(a.starts_at).getTime() > Date.now() - 6 * 3600 * 1000).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  const activitiesBlock = upcomingActivities.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement(FTitle, {
    size: 20,
    style: {
      marginBottom: 10
    }
  }, "Activit\xE9s"), upcomingActivities.map(a => /*#__PURE__*/React.createElement(FootActivityCard, {
    key: a.id,
    activity: a,
    roster: roster,
    rows: (activityAttendance || []).filter(r => r.activity_id === a.id),
    currentPlayer: currentPlayer,
    isAdmin: isBureau(currentPlayer),
    reload: reload
  })));
  if (matches.length === 0) {
    if (activitiesBlock) return /*#__PURE__*/React.createElement("div", {
      className: "ft-page"
    }, activitiesBlock);
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
    presentIds: computeAttendanceQueue(presenceRoster, heroAttendance, featured.min_players).confirmed,
    waitingCount: computeAttendanceQueue(presenceRoster, heroAttendance, featured.min_players).waiting.length,
    rosterSize: presenceRoster.length,
    isOnRoster: isOnRoster,
    myStatus: heroAttendance.find(a => a.player_id === currentPlayer?.id)?.status || null,
    saving: savingMatchId === featured.id,
    onSetStatus: status => setStatus(featured.id, status)
  }), section("À venir", upcoming), activitiesBlock, section("Résultats", past));
}

// ---- roster & admin -------------------------------------------------------------------------------------------------------------
// Private details of one player (birth date, phone, e-mail). Stored server-side behind the admin key.
function FootPlayerDetailsEditor({
  player,
  detail,
  onSaved
}) {
  const [f, setF] = React.useState({
    birth_date: detail && detail.birth_date || "",
    phone: detail && detail.phone || "",
    email: detail && detail.email || "",
    instagram: detail && detail.instagram || ""
  });
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const set = k => e => setF({
    ...f,
    [k]: e.target.value
  });
  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await instaAdminFetch("player-details", {
        player_id: player.id,
        birth_date: f.birth_date,
        phone: f.phone,
        email: f.email,
        instagram: f.instagram
      });
      onSaved(r.detail);
      setMsg({
        t: "good",
        m: "Enregistré ✓"
      });
    } catch (e) {
      setMsg({
        t: "bad",
        m: e.message
      });
    }
    setBusy(false);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "6px 0 12px 48px"
    }
  }, /*#__PURE__*/React.createElement(FField, {
    label: "Date de naissance"
  }, /*#__PURE__*/React.createElement("input", {
    style: FOOT_INPUT_STYLE,
    type: "date",
    value: f.birth_date,
    onChange: set("birth_date"),
    max: new Date().toISOString().slice(0, 10),
    "aria-label": "Date de naissance"
  })), /*#__PURE__*/React.createElement(FField, {
    label: "T\xE9l\xE9phone"
  }, /*#__PURE__*/React.createElement("input", {
    style: FOOT_INPUT_STYLE,
    type: "tel",
    inputMode: "tel",
    placeholder: "06 12 34 56 78",
    value: f.phone,
    onChange: set("phone"),
    "aria-label": "T\xE9l\xE9phone",
    autoComplete: "off"
  })), /*#__PURE__*/React.createElement(FField, {
    label: "E-mail"
  }, /*#__PURE__*/React.createElement("input", {
    style: FOOT_INPUT_STYLE,
    type: "email",
    inputMode: "email",
    placeholder: "prenom@exemple.fr",
    value: f.email,
    onChange: set("email"),
    "aria-label": "E-mail",
    autoCapitalize: "off",
    autoComplete: "off"
  })), /*#__PURE__*/React.createElement(FField, {
    label: "Instagram"
  }, /*#__PURE__*/React.createElement("input", {
    style: FOOT_INPUT_STYLE,
    placeholder: "@pseudo",
    value: f.instagram,
    onChange: set("instagram"),
    "aria-label": "Pseudo Instagram",
    autoCapitalize: "off",
    autoCorrect: "off",
    autoComplete: "off",
    spellCheck: false
  })), msg && /*#__PURE__*/React.createElement(FMessage, {
    tone: msg.t
  }, msg.m), /*#__PURE__*/React.createElement(FBtn, {
    size: "sm",
    onClick: save,
    disabled: busy
  }, busy ? "…" : "Enregistrer les infos"));
}
function FootRosterManager({
  roster,
  reload
}) {
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
    instaAdminFetch("player-details", null, "GET").then(r => {
      setDetails(Object.fromEntries((r.details || []).map(d => [d.player_id, d])));
      setDetailsErr(null);
    }).catch(e => {
      setDetailsErr(e.message);
      setHasKey(!!readInstaKey());
    });
  }, [hasKey]);
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
  const nameOf = p => footShortName(p) || "";
  const byName = (a, b) => nameOf(a).localeCompare(nameOf(b));
  const team = PLAYERS.filter(p => roleByPlayer[p.id]).sort(byName);
  const visibleTeam = filterPlayersByName(team, search, nameOf);
  const others = PLAYERS.filter(p => !roleByPlayer[p.id]).sort(byName);
  const visibleOthers = filterPlayersByName(others, addSearch, nameOf);
  const ageOf = iso => {
    if (!iso) return null;
    const d = new Date(iso),
      n = new Date();
    let a = n.getFullYear() - d.getFullYear();
    if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--;
    return a;
  };
  return /*#__PURE__*/React.createElement(FCard, null, /*#__PURE__*/React.createElement(FHeading, {
    right: /*#__PURE__*/React.createElement(FChip, {
      tone: "soft"
    }, roster.length, " joueurs")
  }, "Effectif"), /*#__PURE__*/React.createElement("input", {
    style: FOOT_INPUT_STYLE,
    placeholder: "Rechercher dans l'effectif\u2026",
    value: search,
    onChange: e => setSearch(e.target.value),
    "aria-label": "Rechercher dans l'effectif"
  }), team.length === 0 && /*#__PURE__*/React.createElement(FEmpty, {
    icon: "users",
    title: "Effectif vide",
    text: "Ajoute des joueurs avec le bouton ci-dessous."
  }), team.length > 0 && visibleTeam.length === 0 && /*#__PURE__*/React.createElement(FEmpty, {
    icon: "users",
    title: "Aucun r\xE9sultat",
    text: `Aucun joueur de l'effectif ne correspond à « ${search} ».`
  }), detailsErr && /*#__PURE__*/React.createElement(FMessage, {
    tone: "warn"
  }, "Infos personnelles indisponibles (", detailsErr, ")."), !hasKey && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(FootInstaKeyBox, {
    onSaved: () => setHasKey(true)
  })), visibleTeam.map(p => {
    const d = details[p.id];
    const open = openId === p.id;
    return /*#__PURE__*/React.createElement("div", {
      key: p.id,
      style: {
        borderTop: `1px solid ${FC.line}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "8px 0"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement(FAvatar, {
      playerId: p.id,
      name: nameOf(p),
      size: 38,
      linkable: true
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 16,
        overflowWrap: "anywhere"
      }
    }, nameOf(p)), d && (d.birth_date || d.phone || d.email || d.instagram) && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: FC.muted,
        overflowWrap: "anywhere"
      }
    }, [d.birth_date ? `${ageOf(d.birth_date)} ans` : null, d.phone, d.email, d.instagram ? `@${d.instagram}` : null].filter(Boolean).join(" · "))), /*#__PURE__*/React.createElement(FIconBtn, {
      icon: "user",
      label: `Infos de ${nameOf(p)}`,
      tone: open ? "soft" : "ghost",
      onClick: () => setOpenId(open ? null : p.id)
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        margin: "6px 0 0 48px"
      }
    }, /*#__PURE__*/React.createElement("input", {
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
        width: 70,
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
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("option", {
      value: ""
    }, "Hors \xE9quipe"), /*#__PURE__*/React.createElement("option", {
      value: "regulier"
    }, "R\xE9gulier"), /*#__PURE__*/React.createElement("option", {
      value: "occasionnel"
    }, "Occasionnel"), /*#__PURE__*/React.createElement("option", {
      value: "invite"
    }, "Invit\xE9")))), open && (hasKey ? /*#__PURE__*/React.createElement(FootPlayerDetailsEditor, {
      key: `${p.id}-${d ? [d.phone, d.email, d.birth_date, d.instagram].join("|") : ""}`,
      player: p,
      detail: d,
      onSaved: row => setDetails({
        ...details,
        [p.id]: row
      })
    }) : /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: FC.muted,
        padding: "0 0 12px 48px"
      }
    }, "Saisis la cl\xE9 admin ci-dessus pour voir et modifier les infos.")));
  }), /*#__PURE__*/React.createElement(FBtn, {
    variant: "secondary",
    full: true,
    icon: "plus",
    onClick: () => setAdding(!adding),
    style: {
      marginTop: 14
    }
  }, adding ? "Fermer la liste" : "Ajouter un joueur"), adding && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("input", {
    style: {
      ...FOOT_INPUT_STYLE,
      marginBottom: 0,
      flex: 1
    },
    placeholder: "Chercher parmi tous les joueurs\u2026",
    value: addSearch,
    onChange: e => setAddSearch(e.target.value),
    "aria-label": "Chercher parmi tous les joueurs"
  }), /*#__PURE__*/React.createElement("select", {
    value: addRole,
    onChange: e => setAddRole(e.target.value),
    "aria-label": "R\xF4le \xE0 l'ajout",
    style: {
      ...FOOT_SELECT_STYLE,
      maxWidth: 124
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "regulier"
  }, "R\xE9gulier"), /*#__PURE__*/React.createElement("option", {
    value: "occasionnel"
  }, "Occasionnel"), /*#__PURE__*/React.createElement("option", {
    value: "invite"
  }, "Invit\xE9"))), visibleOthers.length === 0 && /*#__PURE__*/React.createElement(FEmpty, {
    icon: "users",
    title: "Aucun joueur",
    text: addSearch ? `Aucun joueur ne correspond à « ${addSearch} ».` : "Tous les joueurs sont déjà dans l'effectif."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: 360,
      overflowY: "auto"
    }
  }, visibleOthers.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.id,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "8px 0",
      borderTop: `1px solid ${FC.line}`
    }
  }, /*#__PURE__*/React.createElement(FAvatar, {
    playerId: p.id,
    name: nameOf(p),
    size: 34
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      fontSize: 15,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, nameOf(p)), /*#__PURE__*/React.createElement(FBtn, {
    size: "sm",
    icon: "plus",
    disabled: saving === p.id,
    onClick: () => setRole(p.id, addRole)
  }, "Ajouter"))))));
}

// ---- activities (free events, not matches) ------------------------------------------------------------------------------------
function FootActivityForm({
  title,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  resetOnSuccess
}) {
  const empty = {
    title: "",
    description: "",
    starts_at: "",
    location: "",
    min_players: ""
  };
  const [f, setF] = React.useState(initial ? {
    ...empty,
    ...initial,
    starts_at: toDatetimeLocalValue(initial.starts_at),
    min_players: initial.min_players == null ? "" : String(initial.min_players),
    description: initial.description || "",
    location: initial.location || ""
  } : empty);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const set = k => e => setF({
    ...f,
    [k]: e.target.value
  });
  async function submit() {
    if (!f.title.trim() || !f.starts_at) {
      setMsg({
        t: "bad",
        m: "Le titre et la date/heure sont obligatoires."
      });
      return;
    }
    const minRaw = String(f.min_players ?? "").trim();
    const min = minRaw === "" ? null : Number(minRaw);
    if (min !== null && !(Number.isInteger(min) && min >= 1 && min <= 200)) {
      setMsg({
        t: "bad",
        m: "Le minimum doit être un nombre entre 1 et 200 (ou vide)."
      });
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        title: f.title.trim(),
        description: f.description.trim() || null,
        starts_at: new Date(f.starts_at).toISOString(),
        location: f.location.trim() || null,
        min_players: min
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
    label: "Titre"
  }, /*#__PURE__*/React.createElement("input", {
    style: FOOT_INPUT_STYLE,
    placeholder: "Ex. Troisi\xE8me mi-temps, entra\xEEnement, resto d'\xE9quipe\u2026",
    value: f.title,
    onChange: set("title"),
    "aria-label": "Titre de l'activit\xE9"
  })), /*#__PURE__*/React.createElement(FField, {
    label: "Date et heure"
  }, /*#__PURE__*/React.createElement("input", {
    style: FOOT_INPUT_STYLE,
    type: "datetime-local",
    value: f.starts_at,
    onChange: set("starts_at"),
    "aria-label": "Date et heure"
  })), /*#__PURE__*/React.createElement(FField, {
    label: "Lieu"
  }, /*#__PURE__*/React.createElement("input", {
    style: FOOT_INPUT_STYLE,
    placeholder: "O\xF9 \xE7a se passe ?",
    value: f.location,
    onChange: set("location"),
    "aria-label": "Lieu"
  })), /*#__PURE__*/React.createElement(FField, {
    label: "D\xE9tails"
  }, /*#__PURE__*/React.createElement("textarea", {
    style: {
      ...FOOT_INPUT_STYLE,
      minHeight: 84,
      resize: "vertical",
      fontFamily: "inherit"
    },
    placeholder: "Programme, infos pratiques, \xE0 apporter\u2026",
    value: f.description,
    onChange: set("description"),
    "aria-label": "D\xE9tails"
  })), /*#__PURE__*/React.createElement(FField, {
    label: "Participants minimum"
  }, /*#__PURE__*/React.createElement("input", {
    style: FOOT_INPUT_STYLE,
    inputMode: "numeric",
    placeholder: "Vide = pas de limite",
    value: f.min_players,
    onChange: set("min_players"),
    "aria-label": "Participants minimum"
  })), msg && /*#__PURE__*/React.createElement(FMessage, {
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
function FootCreateActivityForm({
  reload
}) {
  const [open, setOpen] = React.useState(false);
  if (!open) return /*#__PURE__*/React.createElement(FBtn, {
    full: true,
    size: "lg",
    variant: "secondary",
    icon: "plus",
    onClick: () => setOpen(true),
    style: {
      marginBottom: 14
    }
  }, "Nouvelle activit\xE9");
  return /*#__PURE__*/React.createElement(FootActivityForm, {
    title: "Nouvelle activit\xE9",
    submitLabel: "Cr\xE9er l'activit\xE9",
    resetOnSuccess: true,
    onCancel: () => setOpen(false),
    onSubmit: async data => {
      await sbInsert("foot_activities", data);
      await reload();
      setOpen(false);
    }
  });
}

// Admin list of the activities: edit or delete.
function FootActivitiesAdmin({
  activities,
  reload
}) {
  const [editingId, setEditingId] = React.useState(null);
  const [busyId, setBusyId] = React.useState(null);
  if (!activities.length) return null;
  const sorted = [...activities].sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));
  async function remove(a) {
    if (!window.confirm(`Supprimer l'activité « ${a.title} » et ses réponses ?`)) return;
    setBusyId(a.id);
    try {
      await sbFetch("foot_activities", `?id=eq.${a.id}`, {
        method: "DELETE"
      });
      await reload();
    } catch (e) {
      console.warn("delete activity failed", e);
    }
    setBusyId(null);
  }
  return /*#__PURE__*/React.createElement(FCard, null, /*#__PURE__*/React.createElement(FHeading, {
    right: /*#__PURE__*/React.createElement(FChip, {
      tone: "soft"
    }, activities.length)
  }, "Activit\xE9s"), sorted.map(a => editingId === a.id ? /*#__PURE__*/React.createElement(FootActivityForm, {
    key: a.id,
    title: "Modifier l'activit\xE9",
    initial: a,
    submitLabel: "Enregistrer",
    onCancel: () => setEditingId(null),
    onSubmit: async data => {
      await sbUpdate("foot_activities", {
        id: a.id
      }, data);
      await reload();
      setEditingId(null);
    }
  }) : /*#__PURE__*/React.createElement("div", {
    key: a.id,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "8px 0",
      borderTop: `1px solid ${FC.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
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
  }, a.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: FC.muted
    }
  }, footDate(a.starts_at), " \xB7 ", footTime(a.starts_at), a.location ? ` · ${a.location}` : "")), /*#__PURE__*/React.createElement(FIconBtn, {
    icon: "pencil",
    label: `Modifier ${a.title}`,
    onClick: () => setEditingId(a.id)
  }), /*#__PURE__*/React.createElement(FIconBtn, {
    icon: "trash",
    label: `Supprimer ${a.title}`,
    tone: "danger",
    disabled: busyId === a.id,
    onClick: () => remove(a)
  }))));
}

// An activity on the Matchs page: details, my answer, and everybody's answers.
function FootActivityCard({
  activity,
  roster,
  rows,
  currentPlayer,
  isAdmin,
  reload
}) {
  const [saving, setSaving] = React.useState(false);
  const [showAll, setShowAll] = React.useState(false);
  const presenceRoster = attendanceRoster(roster);
  const isOnRoster = presenceRoster.some(r => r.player_id === currentPlayer?.id);
  const mine = rows.find(a => a.player_id === currentPlayer?.id);
  const q = computeAttendanceQueue(presenceRoster, rows, activity.min_players);
  const myPlace = q.order.find(o => o.playerId === currentPlayer?.id);
  async function setMine(status) {
    setSaving(true);
    try {
      await setActivityAttendance(activity.id, currentPlayer.id, status);
      await reload();
    } catch (e) {
      console.warn("activity attendance failed", e);
    }
    setSaving(false);
  }
  const setPlayer = async (id, status) => {
    if (status === null) await clearActivityAttendance(activity.id, id);else await setActivityAttendance(activity.id, id, status);
    await reload();
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(FCard, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement(FChip, {
    tone: "accent",
    icon: "calendar"
  }, "Activit\xE9"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: FF.ui,
      fontSize: 14,
      color: FC.deep
    }
  }, footRelative(activity.starts_at))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.display,
      fontSize: 24,
      lineHeight: 1.15,
      color: FC.deep,
      overflowWrap: "anywhere"
    }
  }, activity.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: FC.muted,
      margin: "6px 0"
    }
  }, footDate(activity.starts_at), " \xB7 ", footTime(activity.starts_at), activity.location ? ` · ${activity.location}` : ""), activity.description && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      lineHeight: 1.4,
      margin: "8px 0",
      whiteSpace: "pre-wrap",
      overflowWrap: "anywhere"
    }
  }, activity.description), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: "10px 0"
    }
  }, /*#__PURE__*/React.createElement(FChip, {
    tone: q.min && q.confirmed.length >= q.min ? "good" : "soft"
  }, q.confirmed.length, q.min ? ` / ${q.min}` : "", " ", q.min ? "confirmés" : "présents", q.waiting.length ? ` · ${q.waiting.length} en attente` : "")), isOnRoster && /*#__PURE__*/React.createElement(FootAttendanceButtons, {
    myStatus: mine ? mine.status : null,
    saving: saving,
    onSet: setMine,
    compact: true
  }), myPlace && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(FChip, {
    tone: myPlace.waiting ? "warn" : "good"
  }, myPlace.waiting ? `En liste d'attente · n°${myPlace.rank}` : `Confirmé · n°${myPlace.rank}`)), /*#__PURE__*/React.createElement(FBtn, {
    variant: "ghost",
    size: "sm",
    onClick: () => setShowAll(!showAll),
    style: {
      marginTop: 10
    }
  }, showAll ? "Masquer les réponses" : "Voir les réponses")), showAll && /*#__PURE__*/React.createElement(FootPresenceCard, {
    roster: presenceRoster,
    rows: rows,
    min: activity.min_players,
    isAdmin: isAdmin,
    onSetPlayer: setPlayer
  }));
}
function FootAdminPage({
  roster,
  activities,
  reload
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "ft-page"
  }, /*#__PURE__*/React.createElement(FootCreateMatchForm, {
    reload: reload
  }), /*#__PURE__*/React.createElement(FootCreateActivityForm, {
    reload: reload
  }), /*#__PURE__*/React.createElement(FootActivitiesAdmin, {
    activities: activities || [],
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
  const state = running ? formatEventMinute(Math.floor(secs / 60), match.half_duration_min) : match.clock_paused ? `pause (${Math.floor(secs / 60)}')` : secs > 0 ? "terminée" : "à démarrer";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      fontFamily: FF.ui,
      fontSize: 16,
      color: FC.deep,
      marginTop: 4
    }
  }, footHalfLabel(match.current_half || 1), " \xB7 ", state);
}
function FootTeamMark({
  name,
  logo
}) {
  const {
    themeName
  } = React.useContext(FootCtx);
  const pink = logo && themeName === "pink";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      minWidth: 0
    }
  }, pink ? /*#__PURE__*/React.createElement("img", {
    src: "/logo-bl-rose.png",
    alt: "",
    style: {
      width: 76,
      height: 54,
      objectFit: "contain",
      display: "block",
      margin: "0 auto 6px"
    }
  }) : logo ? /*#__PURE__*/React.createElement("img", {
    src: "/logo-bl.png",
    alt: "",
    style: {
      width: 76,
      height: 54,
      objectFit: "contain",
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
    finished = match.status === "finished",
    unknown = finished && match.score_unknown;
  const out = finished && !unknown ? footOutcome(score) : null;
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
  }, "En direct") : unknown ? /*#__PURE__*/React.createElement(FChip, null, "Score inconnu") : finished ? /*#__PURE__*/React.createElement(FChip, {
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
  }, unknown ? "? – ?" : live || finished ? `${score.bl} – ${score.opponent}` : "VS"), /*#__PURE__*/React.createElement(FootTeamMark, {
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
  }))), /*#__PURE__*/React.createElement(FLabel, null, "Convocation (", sheet.length, ")"), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: "0 0 16px"
    }
  }, /*#__PURE__*/React.createElement(FootLineupChecklist, {
    roster: roster,
    extraIds: existingSheet,
    checked: sheet,
    onToggle: toggle,
    disabled: saving,
    presence: presenceMap(attendance, match.id)
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
  const [playerId, setPlayerId] = React.useState(event?.own_goal ? "csc" : event?.player_id ? String(event.player_id) : "");
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
  }, footShortName(p))), /*#__PURE__*/React.createElement("option", {
    value: "csc"
  }, "CSC (but contre son camp)"))), playerId !== "csc" && /*#__PURE__*/React.createElement(FField, {
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
  }, footShortName(p)))))), err && /*#__PURE__*/React.createElement(FMessage, null, err), /*#__PURE__*/React.createElement("div", {
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
    }, formatEventMinute(e.minute, match && match.half_duration_min)), /*#__PURE__*/React.createElement("span", {
      style: {
        display: "block",
        fontSize: 11,
        color: FC.muted
      }
    }, e.half, e.half === 1 ? "re" : "e", " MT")), ours && e.own_goal ? /*#__PURE__*/React.createElement("span", {
      style: {
        width: 36,
        height: 36,
        borderRadius: 18,
        background: FC.accentSoft,
        color: FC.deep,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FF.ui,
        fontSize: 12
      }
    }, "CSC") : ours ? /*#__PURE__*/React.createElement(FAvatar, {
      playerId: e.player_id,
      name: footNameOf(e.player_id),
      size: 36,
      linkable: true
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
    }, ours ? e.own_goal ? "CSC (but contre son camp)" : /*#__PURE__*/React.createElement(FPlayerLink, {
      id: e.player_id
    }, footNameOf(e.player_id)) : "But adverse"), ours && e.assist_player_id && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: FC.muted
      }
    }, "Passe de ", /*#__PURE__*/React.createElement(FPlayerLink, {
      id: e.assist_player_id
    }, footNameOf(e.assist_player_id)))), editable && /*#__PURE__*/React.createElement("span", {
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
  }, footShortName(p))), /*#__PURE__*/React.createElement("option", {
    value: "csc"
  }, "CSC (but contre son camp)"))), withAssist && playerId !== "csc" && /*#__PURE__*/React.createElement(FField, {
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
  }, footShortName(p))))), /*#__PURE__*/React.createElement("div", {
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
    onClick: () => can && onConfirm(playerId === "csc" ? "csc" : Number(playerId), playerId !== "csc" && assistId ? Number(assistId) : null),
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
  const paused = !running && !!match.clock_paused;
  const clock = formatMatchClock(elapsedSeconds, match.half_duration_min);
  async function logGoal(type, playerId, assistId) {
    setBusy(true);
    try {
      const own = playerId === "csc";
      const scorer = own ? null : playerId;
      await saveGoalWithSheet(lineupIdsFor(lineups || [], match.id), {
        type,
        player_id: scorer,
        assist_player_id: assistId
      }, {
        addToSheet: ids => addToLineup(match.id, ids),
        writeGoal: () => sbInsert("foot_match_events", {
          match_id: match.id,
          half: match.current_half,
          minute: minutesElapsed,
          type,
          player_id: scorer,
          assist_player_id: assistId,
          own_goal: own
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
        half_started_at: new Date().toISOString(),
        clock_paused: false
      });
      await reload();
    } catch (e) {
      console.warn(e);
    }
    setBusy(false);
  }

  // Freezes the clock without ending the half; "Reprendre" (startHalf) carries on from the frozen time.
  async function pauseClock() {
    setBusy(true);
    try {
      const frozenElapsed = computeHalfElapsedSeconds(match.half_started_at, match.half_elapsed_seconds, Date.now());
      await sbUpdate("foot_matches", {
        id: match.id
      }, {
        half_elapsed_seconds: frozenElapsed,
        half_started_at: null,
        clock_paused: true
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
          clock_paused: false,
          current_half: next.half
        });
      } else {
        await sbUpdate("foot_matches", {
          id: match.id
        }, {
          half_elapsed_seconds: frozenElapsed,
          half_started_at: null,
          clock_paused: false
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
        half_started_at: null,
        clock_paused: false
      });
      await reload();
    } catch (e) {
      console.warn(e);
      setBusy(false);
    }
  }
  const isLastHalf = match.current_half >= match.nb_halves;
  const liveAction = nextLiveAction(running, isLastHalf, match.half_elapsed_seconds, paused);
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
      margin: "2px 0 14px",
      opacity: paused ? 0.55 : 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.display,
      fontSize: 60,
      lineHeight: 1.1,
      color: FC.deep,
      fontVariantNumeric: "tabular-nums"
    }
  }, clock.main, clock.extra && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 34,
      color: FC.bad,
      marginLeft: 8
    }
  }, clock.extra)), clock.extra && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.ui,
      fontSize: 13,
      color: FC.bad
    }
  }, "Temps additionnel : le chrono continue jusqu'\xE0 ce que tu termines la mi-temps"), paused && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.ui,
      fontSize: 14,
      color: FC.muted
    }
  }, "Chrono en pause")), liveAction === "start" && /*#__PURE__*/React.createElement(FBtn, {
    variant: "success",
    size: "lg",
    full: true,
    icon: "play",
    disabled: busy,
    onClick: startHalf
  }, "D\xE9marrer la mi-temps"), (liveAction === "playing" || liveAction === "paused") && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
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
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      marginTop: 10
    }
  }, paused ? /*#__PURE__*/React.createElement(FBtn, {
    variant: "success",
    icon: "play",
    disabled: busy,
    onClick: startHalf,
    style: {
      flex: 1
    }
  }, "Reprendre") : /*#__PURE__*/React.createElement(FBtn, {
    variant: "ghost",
    icon: "pause",
    disabled: busy,
    onClick: pauseClock,
    style: {
      flex: 1
    }
  }, "Pause"), /*#__PURE__*/React.createElement(FBtn, {
    variant: "secondary",
    icon: "flag",
    disabled: busy,
    onClick: endHalf,
    style: {
      flex: 1
    }
  }, isLastHalf ? "Fin du match" : "Fin de la mi-temps"))), liveAction === "close" && /*#__PURE__*/React.createElement(FBtn, {
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
  attendance,
  currentPlayer,
  isAdmin,
  reload,
  extra
}) {
  const matchEvents = events.filter(e => e.match_id === match.id);
  const score = computeFootScore(matchEvents);
  return /*#__PURE__*/React.createElement("div", {
    className: "ft-page"
  }, /*#__PURE__*/React.createElement(FootScoreboard, {
    match: match,
    score: score
  }), extra, /*#__PURE__*/React.createElement(FootLineupSection, {
    match: match,
    roster: roster,
    lineups: lineups,
    attendance: attendance,
    isAdmin: false,
    reload: reload
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
  })));
}
const FOOT_SCORE_OPTIONS = Array.from({
  length: 19
}, (_, i) => 1 + i * 0.5);

// Tap the face of the best player of the match.
function FootMotmPicker({
  ids,
  value,
  onPick,
  disabled
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "radiogroup",
    "aria-label": "Homme du match",
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
      gap: 8
    }
  }, ids.map(id => {
    const on = value === id;
    return /*#__PURE__*/React.createElement("button", {
      key: id,
      role: "radio",
      "aria-checked": on,
      disabled: disabled,
      onClick: () => onPick(id),
      style: {
        border: `2px solid ${on ? FC.accent : "transparent"}`,
        background: on ? FC.accentSoft : FC.softer,
        borderRadius: 18,
        padding: "8px 4px 6px",
        cursor: disabled ? "default" : "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        minWidth: 0,
        color: FC.text
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        position: "relative",
        display: "inline-flex"
      }
    }, /*#__PURE__*/React.createElement(FAvatar, {
      playerId: id,
      name: footNameOf(id),
      size: 52,
      ring: on ? FC.accent : undefined
    }), on && /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        right: -4,
        bottom: -4,
        width: 22,
        height: 22,
        borderRadius: 11,
        background: FC.accent,
        color: "#fff",
        border: "2px solid #fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, /*#__PURE__*/React.createElement(FIcon, {
      name: "check",
      size: 13,
      stroke: 3
    }))), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: FF.ui,
        fontSize: 12,
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, footNameOf(id)));
  }));
}
function FootRatingsTab({
  match,
  lineups,
  ratings,
  motmVotes,
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
  const myMotm = (motmVotes || []).find(v => v.match_id === match.id && v.voter_id === me);
  const [motm, setMotm] = React.useState(myMotm ? myMotm.player_id : null);
  const winners = validated ? motmWinners([match], motmVotes || [])[match.id] || [] : [];
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
    if (!motm) {
      setErr("Choisis ton homme du match en touchant son visage.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const result = await submitRatings({
        isValidated: async () => !!((await sbFetch("foot_matches", `?id=eq.${match.id}&select=ratings_validated_at`)) || [])[0]?.ratings_validated_at,
        writeRatings: async () => {
          assertUpsertOk(await SUPABASE.from("foot_motm_votes").upsert({
            match_id: match.id,
            voter_id: me,
            player_id: motm,
            updated_at: new Date().toISOString()
          }, {
            onConflict: "match_id,voter_id"
          }));
          assertUpsertOk(await SUPABASE.from("foot_ratings").upsert(rows.map(r => ({
            ...r,
            updated_at: new Date().toISOString()
          })), {
            onConflict: "match_id,rater_id,ratee_id"
          }));
        }
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
    text: "Il faut au moins deux joueurs sur la convocation pour noter."
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
  }, /*#__PURE__*/React.createElement(FLabel, null, "Ton homme du match"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(FootMotmPicker, {
    ids: sheetIds.filter(id => id !== me),
    value: motm,
    onPick: setMotm,
    disabled: busy
  })), /*#__PURE__*/React.createElement(FLabel, null, "Les notes"), sheetIds.filter(id => id !== me).map(id => /*#__PURE__*/React.createElement("div", {
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
  }, view.editLabel), winners.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      background: FC.accentSoft,
      borderRadius: 18,
      padding: "10px 12px",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex"
    }
  }, winners.map((id, i) => /*#__PURE__*/React.createElement("span", {
    key: id,
    style: {
      marginLeft: i ? -10 : 0
    }
  }, /*#__PURE__*/React.createElement(FAvatar, {
    playerId: id,
    name: footNameOf(id),
    size: 52,
    ring: FC.accent,
    linkable: true
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
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
  }, "Homme du match"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.display,
      fontSize: 22,
      color: FC.deep,
      lineHeight: 1.15,
      overflowWrap: "anywhere"
    }
  }, winners.map(footNameOf).join(" · ")))), view.showAverages && ranked.map(({
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
    size: 34,
    linkable: true
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
  }, /*#__PURE__*/React.createElement(FPlayerLink, {
    id: id
  }, nameOf(id))), /*#__PURE__*/React.createElement("div", {
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
  }, isVoter ? "Note tes coéquipiers pour voir les moyennes, ou attends la validation par le bureau." : "Les notes restent cachées jusqu'à leur validation par le bureau."), !validated && progress.pendingIds.length > 0 && /*#__PURE__*/React.createElement("div", {
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
    reload: reload
  }));
}

// Bureau only, write-only: an admin can set any player's votes and final notes but never reads what is already there.
function FootRatingsAdminPanel({
  match,
  sheetIds,
  reload
}) {
  const [open, setOpen] = React.useState(false);
  const [rater, setRater] = React.useState(sheetIds[0]);
  const [scores, setScores] = React.useState({});
  const [finals, setFinals] = React.useState({});
  const [resets, setResets] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const clear = () => {
    setScores({});
    setFinals({});
    setResets([]);
  };
  React.useEffect(() => {
    setScores({});
  }, [rater, open]);
  React.useEffect(() => {
    setFinals({});
    setResets([]);
  }, [open]);
  if (!open) return /*#__PURE__*/React.createElement(FBtn, {
    variant: "secondary",
    full: true,
    size: "sm",
    icon: "sliders",
    onClick: () => setOpen(true),
    style: {
      marginTop: 10
    }
  }, "Corriger des notes (bureau)");
  async function saveVotes() {
    const rows = sheetIds.filter(id => id !== rater && scores[id] !== undefined && scores[id] !== "").map(id => ({
      match_id: match.id,
      rater_id: rater,
      ratee_id: id,
      score: Number(scores[id]),
      updated_at: new Date().toISOString()
    }));
    if (!rows.length) {
      setMsg({
        t: "error",
        m: "Choisis au moins une note à enregistrer."
      });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      assertUpsertOk(await SUPABASE.from("foot_ratings").upsert(rows, {
        onConflict: "match_id,rater_id,ratee_id"
      }));
      await reload();
      setScores({});
      setMsg({
        t: "success",
        m: `${rows.length} note${rows.length > 1 ? "s" : ""} enregistrée${rows.length > 1 ? "s" : ""} ✓`
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
    let next;
    try {
      next = mergeFinalNotes(match.rating_overrides, finals, resets);
    } catch (e) {
      setMsg({
        t: "error",
        m: e.message
      });
      return;
    }
    if (!Object.values(finals).some(v => String(v || "").trim() !== "") && !resets.length) {
      setMsg({
        t: "error",
        m: "Écris au moins une note finale (ou remets un joueur en auto)."
      });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await sbUpdate("foot_matches", {
        id: match.id
      }, {
        rating_overrides: next,
        ratings_validated_at: match.ratings_validated_at || new Date().toISOString()
      });
      await reload();
      setFinals({});
      setResets([]);
      setMsg({
        t: "success",
        m: "Notes finales enregistrées et validées ✓"
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
      onClick: () => {
        clear();
        setOpen(false);
      }
    }, "Fermer")
  }, "Corriger des notes"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: FC.muted,
      marginBottom: 10,
      lineHeight: 1.4
    }
  }, "Tu peux modifier des notes sans jamais voir celles d\xE9j\xE0 enregistr\xE9es. Seules les cases remplies sont \xE9cras\xE9es."), /*#__PURE__*/React.createElement(FField, {
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
    "aria-label": `Nouvelle note de ${footNameOf(rater)} pour ${footNameOf(id)}`,
    style: {
      ...FOOT_SELECT_STYLE,
      minWidth: 96
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Inchang\xE9e"), opts))), /*#__PURE__*/React.createElement(FBtn, {
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
      marginBottom: 6,
      lineHeight: 1.4
    }
  }, "\xC9cris la note (ex : 6.1) ou remets \xAB auto \xBB (moyenne des votes). Enregistrer valide les notes : plus personne ne peut voter et tout le monde les voit."), sheetIds.map(id => /*#__PURE__*/React.createElement("div", {
    key: id,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 0",
      borderTop: `1px solid ${FC.line}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 15
    }
  }, footNameOf(id)), /*#__PURE__*/React.createElement("button", {
    disabled: busy,
    onClick: () => {
      setResets(resets.includes(id) ? resets.filter(x => x !== id) : [...resets, id]);
      setFinals({
        ...finals,
        [id]: ""
      });
    },
    "aria-pressed": resets.includes(id),
    style: {
      border: `1.5px solid ${resets.includes(id) ? FC.accent : FC.line}`,
      background: resets.includes(id) ? FC.accentSoft : "transparent",
      color: resets.includes(id) ? FC.deep : FC.muted,
      borderRadius: 12,
      padding: "6px 9px",
      fontFamily: FF.ui,
      fontSize: 12,
      cursor: "pointer"
    }
  }, "Auto"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    inputMode: "decimal",
    placeholder: "Inchang\xE9e",
    value: finals[id] ?? "",
    disabled: busy || resets.includes(id),
    onChange: e => setFinals({
      ...finals,
      [id]: e.target.value
    }),
    "aria-label": `Note finale de ${footNameOf(id)}`,
    style: {
      ...FOOT_INPUT_STYLE,
      width: 96,
      textAlign: "center"
    }
  }))), /*#__PURE__*/React.createElement(FBtn, {
    full: true,
    size: "sm",
    onClick: saveFinals,
    disabled: busy,
    style: {
      marginTop: 10
    }
  }, "Enregistrer et valider les notes finales"), msg && /*#__PURE__*/React.createElement(FMessage, {
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
  attendance,
  ratings,
  motmVotes,
  currentPlayer,
  isAdmin,
  reload,
  extra
}) {
  const [tab, setTab] = React.useState("resume");
  const matchEvents = events.filter(e => e.match_id === match.id);
  const score = computeFootScore(matchEvents);
  return /*#__PURE__*/React.createElement("div", {
    className: "ft-page"
  }, /*#__PURE__*/React.createElement(FootScoreboard, {
    match: match,
    score: score
  }), extra, /*#__PURE__*/React.createElement(FSegmented, {
    value: tab,
    onChange: setTab,
    options: [["resume", "Résumé", "ball"], ["notes", "Notes", "star"]],
    style: {
      marginBottom: 14,
      background: "rgba(255,255,255,0.92)"
    }
  }), tab === "resume" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(FootLineupSection, {
    match: match,
    roster: roster,
    lineups: lineups,
    attendance: attendance,
    isAdmin: false,
    reload: reload
  }), /*#__PURE__*/React.createElement(FCard, null, /*#__PURE__*/React.createElement(FHeading, null, "Buts"), /*#__PURE__*/React.createElement(FootEventTimeline, {
    events: matchEvents,
    editable: isAdmin,
    match: match,
    roster: roster,
    lineups: lineups,
    reload: reload
  }))), tab === "notes" && /*#__PURE__*/React.createElement(FootRatingsTab, {
    match: match,
    lineups: lineups,
    ratings: ratings || [],
    motmVotes: motmVotes || [],
    currentPlayer: currentPlayer,
    isAdmin: isAdmin,
    reload: reload
  }));
}

// Answers to a match or an activity: who is in (in order of answer), who waits, who is absent, who has not answered.
// `onSetPlayer(playerId, "present" | "absent" | null)` lets an admin set or clear anybody's answer.
function FootPresenceCard({
  roster,
  rows,
  min,
  isAdmin,
  onSetPlayer,
  emptyText
}) {
  const [editing, setEditing] = React.useState(false);
  const [busyId, setBusyId] = React.useState(null);
  const q = computeAttendanceQueue(roster, rows, min);
  const sections = [["Présents", q.confirmed, "good"], ["Liste d'attente", q.waiting, "warn"], ["Pas de réponse", q.noResponse, "plain"], ["Absents", q.absent, "bad"]];
  const rankOf = Object.fromEntries(q.order.map(o => [o.playerId, o.rank]));
  const statusOf = Object.fromEntries(rows.map(r => [r.player_id, r.status]));
  async function set(id, status) {
    setBusyId(id);
    try {
      await onSetPlayer(id, status);
    } catch (e) {
      console.warn("presence update failed", e);
    }
    setBusyId(null);
  }
  const names = [...roster].map(r => r.player_id).sort((a, b) => footNameOf(a).localeCompare(footNameOf(b)));
  return /*#__PURE__*/React.createElement(FCard, null, /*#__PURE__*/React.createElement(FHeading, {
    right: /*#__PURE__*/React.createElement(FChip, {
      tone: q.min && q.confirmed.length >= q.min ? "good" : "soft"
    }, q.confirmed.length, " / ", q.min || roster.length)
  }, "Pr\xE9sences"), roster.length === 0 ? /*#__PURE__*/React.createElement(FEmpty, {
    icon: "users",
    title: "Effectif vide",
    text: emptyText || "Ajoute des joueurs à l'effectif dans l'onglet Admin."
  }) : /*#__PURE__*/React.createElement(React.Fragment, null, q.min && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: FC.muted,
      marginBottom: 10
    }
  }, "Minimum ", q.min, " joueurs", q.waiting.length ? ` · ${q.waiting.length} en liste d'attente` : "", ". Class\xE9s par ordre de r\xE9ponse."), sections.map(([label, ids, tone]) => (ids.length > 0 || label === "Présents") && /*#__PURE__*/React.createElement("div", {
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
  }, ids.map(id => /*#__PURE__*/React.createElement("span", {
    key: id,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      maxWidth: "100%"
    }
  }, rankOf[id] && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: FF.ui,
      fontSize: 12,
      color: FC.muted,
      minWidth: 18,
      textAlign: "right"
    }
  }, rankOf[id], "."), /*#__PURE__*/React.createElement(FootPlayerPill, {
    id: id,
    tone: "line",
    dim: tone === "plain"
  })))))), isAdmin && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(FBtn, {
    variant: "secondary",
    size: "sm",
    icon: "pencil",
    onClick: () => setEditing(!editing),
    style: {
      marginTop: 4
    }
  }, editing ? "Fermer" : "Modifier les présences"), editing && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, names.map(id => /*#__PURE__*/React.createElement("div", {
    key: id,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 0",
      borderTop: `1px solid ${FC.line}`
    }
  }, /*#__PURE__*/React.createElement(FAvatar, {
    playerId: id,
    name: footNameOf(id),
    size: 30
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0,
      fontSize: 15,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, footNameOf(id), rankOf[id] ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: FC.muted,
      fontSize: 12
    }
  }, " \xB7 ", q.waiting.includes(id) ? "attente " : "n°", rankOf[id]) : null), [["present", "Présent", "good"], ["absent", "Absent", "bad"], [null, "—", "plain"]].map(([st, lab, tone]) => {
    const on = (statusOf[id] || null) === st;
    return /*#__PURE__*/React.createElement("button", {
      key: lab,
      disabled: busyId === id,
      onClick: () => !on && set(id, st),
      "aria-pressed": on,
      "aria-label": `${footNameOf(id)} : ${st === null ? "pas de réponse" : lab}`,
      style: {
        border: `1.5px solid ${on ? tone === "good" ? FC.good : tone === "bad" ? FC.bad : FC.muted : FC.line}`,
        background: on ? tone === "good" ? FC.goodSoft : tone === "bad" ? FC.badSoft : FC.soft : "transparent",
        color: on ? tone === "good" ? FC.good : tone === "bad" ? FC.bad : FC.text : FC.muted,
        borderRadius: 12,
        padding: "6px 9px",
        fontFamily: FF.ui,
        fontSize: 12,
        cursor: "pointer",
        minWidth: 40
      }
    }, lab);
  })))))));
}

// ---- ball keepers (2 players bring and bring back the balls) ------------------------------------------------------------------
function FootBallKeepersCard({
  match,
  matches,
  roster,
  canEdit,
  reload
}) {
  const [editing, setEditing] = React.useState(false);
  const [picked, setPicked] = React.useState(match.ball_keepers || []);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const season = seasonOf(match.match_datetime);
  const counts = ballKeeperCounts(matches.filter(m => seasonOf(m.match_datetime) === season));
  const keepers = match.ball_keepers || [];
  const pool = attendanceRoster(roster).map(r => r.player_id).sort((a, b) => (counts[a] || 0) - (counts[b] || 0) || footNameOf(a).localeCompare(footNameOf(b)));
  const times = id => {
    const n = counts[id] || 0;
    return `${n} fois cette saison`;
  };
  const toggle = id => setPicked(picked.includes(id) ? picked.filter(x => x !== id) : picked.length < 2 ? [...picked, id] : picked);
  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await sbUpdate("foot_matches", {
        id: match.id
      }, {
        ball_keepers: picked
      });
      await reload();
      setEditing(false);
    } catch (e) {
      setErr("Enregistrement impossible : " + e.message);
    }
    setBusy(false);
  }
  return /*#__PURE__*/React.createElement(FCard, {
    style: {
      border: `2px solid ${FC.accent}`
    }
  }, /*#__PURE__*/React.createElement(FHeading, {
    right: canEdit && !editing && /*#__PURE__*/React.createElement(FBtn, {
      size: "sm",
      variant: "secondary",
      icon: "pencil",
      onClick: () => {
        setPicked(keepers);
        setErr(null);
        setEditing(true);
      }
    }, keepers.length ? "Changer" : "Choisir")
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(FIcon, {
    name: "ball",
    size: 22
  }), "Responsables ballons")), !editing && (keepers.length ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: 10
    }
  }, keepers.map(id => /*#__PURE__*/React.createElement("div", {
    key: id,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      background: FC.accentSoft,
      borderRadius: 18,
      padding: "10px 12px",
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(FAvatar, {
    playerId: id,
    name: footNameOf(id),
    size: 44,
    linkable: true
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.ui,
      fontSize: 17,
      overflowWrap: "anywhere"
    }
  }, /*#__PURE__*/React.createElement(FPlayerLink, {
    id: id
  }, footNameOf(id))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: FC.muted
    }
  }, times(id)))))) : /*#__PURE__*/React.createElement(FEmpty, {
    icon: "ball",
    title: "Pas encore d\xE9sign\xE9s",
    text: canEdit ? "Choisis les 2 joueurs qui s'occupent des ballons pour ce match." : "Le bureau choisira 2 joueurs pour les ballons."
  })), editing && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: FC.muted,
      marginBottom: 8
    }
  }, "Choisis 2 joueurs (", picked.length, " / 2). Ceux qui l'ont fait le moins souvent sont en haut."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 6
    }
  }, pool.map(id => {
    const on = picked.includes(id);
    const full = !on && picked.length >= 2;
    return /*#__PURE__*/React.createElement("label", {
      key: id,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 10px 6px 6px",
        borderRadius: 16,
        background: on ? FC.accentSoft : FC.softer,
        border: `1.5px solid ${on ? FC.accent : "transparent"}`,
        opacity: full ? 0.55 : 1,
        cursor: full || busy ? "default" : "pointer",
        fontSize: 15
      }
    }, /*#__PURE__*/React.createElement(FAvatar, {
      playerId: id,
      name: footNameOf(id),
      size: 34
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, footNameOf(id)), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: FF.ui,
        fontSize: 13,
        color: FC.deep
      }
    }, counts[id] || 0, "\xD7"), /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: on,
      disabled: full || busy,
      onChange: () => toggle(id),
      "aria-label": `${footNameOf(id)} responsable ballons`
    }));
  })), err && /*#__PURE__*/React.createElement(FMessage, {
    style: {
      marginTop: 10
    }
  }, err), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(FBtn, {
    variant: "ghost",
    onClick: () => setEditing(false),
    disabled: busy,
    style: {
      flex: 1
    }
  }, "Annuler"), /*#__PURE__*/React.createElement(FBtn, {
    onClick: save,
    disabled: busy,
    style: {
      flex: 1
    }
  }, busy ? "…" : `Enregistrer (${picked.length})`))));
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
  onStartMatch,
  extra
}) {
  const matchAttendance = attendance.filter(a => a.match_id === match.id);
  const presenceRoster = attendanceRoster(roster);
  const queue = computeAttendanceQueue(presenceRoster, matchAttendance, match.min_players);
  const isOnRoster = presenceRoster.some(r => r.player_id === currentPlayer?.id);
  const myStatus = matchAttendance.find(a => a.player_id === currentPlayer?.id)?.status || null;
  const myPlace = queue.order.find(o => o.playerId === currentPlayer?.id);
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
  const setPlayer = async (id, status) => {
    if (status === null) await clearMatchAttendance(match.id, id);else await setMatchAttendance(match.id, id, status);
    await reload();
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "ft-page"
  }, /*#__PURE__*/React.createElement(FootScoreboard, {
    match: match,
    score: {
      bl: 0,
      opponent: 0
    }
  }), extra, /*#__PURE__*/React.createElement(FootLineupSection, {
    match: match,
    roster: roster,
    lineups: lineups || [],
    attendance: attendance,
    isAdmin: isAdmin,
    reload: reload
  }), isOnRoster && /*#__PURE__*/React.createElement(FCard, null, /*#__PURE__*/React.createElement(FHeading, null, "Ma pr\xE9sence"), /*#__PURE__*/React.createElement(FootAttendanceButtons, {
    myStatus: myStatus,
    saving: saving,
    onSet: setMyStatus
  }), myPlace && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(FChip, {
    tone: myPlace.waiting ? "warn" : "good"
  }, myPlace.waiting ? `En liste d'attente · n°${myPlace.rank}` : `Confirmé · n°${myPlace.rank}`))), /*#__PURE__*/React.createElement(FootPresenceCard, {
    roster: presenceRoster,
    rows: matchAttendance,
    min: match.min_players,
    isAdmin: isAdmin,
    onSetPlayer: setPlayer
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
  motmVotes,
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
  const [resetting, setResetting] = React.useState(false);
  if (!match) return /*#__PURE__*/React.createElement(FCard, null, /*#__PURE__*/React.createElement(FEmpty, {
    icon: "calendar",
    title: "Match introuvable",
    action: /*#__PURE__*/React.createElement(FBtn, {
      onClick: navBack
    }, "Retour aux matchs")
  }));
  const canReset = isBureau(currentPlayer) && match.status !== "scheduled";
  const balls = /*#__PURE__*/React.createElement(FootBallKeepersCard, {
    match: match,
    matches: matches,
    roster: roster,
    canEdit: isBureau(currentPlayer),
    reload: reload
  });
  async function resetMatch() {
    if (!window.confirm(`Remettre le match contre ${match.opponent_name} à « pas joué » ?\n\nLes buts, le chrono et les notes seront supprimés. La convocation et les présences sont conservées.`)) return;
    setResetting(true);
    try {
      await sbFetch("foot_match_events", `?match_id=eq.${match.id}`, {
        method: "DELETE"
      });
      await sbFetch("foot_ratings", `?match_id=eq.${match.id}`, {
        method: "DELETE"
      });
      await sbUpdate("foot_matches", {
        id: match.id
      }, {
        status: "scheduled",
        nb_halves: null,
        half_duration_min: null,
        current_half: null,
        half_started_at: null,
        half_elapsed_seconds: 0,
        clock_paused: false,
        started_by: null,
        ratings_validated_at: null,
        rating_overrides: {}
      });
      setStartingConfig(false);
      await reload();
    } catch (e) {
      console.warn("reset match failed", e);
      window.alert("Impossible de remettre le match à zéro : " + e.message);
    }
    setResetting(false);
  }
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
    onStartMatch: () => setStartingConfig(true),
    extra: balls
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
    attendance: attendance,
    currentPlayer: currentPlayer,
    isAdmin: isAdmin,
    reload: reload,
    extra: balls
  }), match.status === "finished" && /*#__PURE__*/React.createElement(FootFinishedView, {
    match: match,
    roster: roster,
    events: events,
    lineups: lineups,
    attendance: attendance,
    ratings: ratings,
    motmVotes: motmVotes,
    currentPlayer: currentPlayer,
    isAdmin: isAdmin,
    reload: reload,
    extra: balls
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
  }, deleting ? "…" : "Supprimer"))), canReset && /*#__PURE__*/React.createElement(FBtn, {
    variant: "ghost",
    full: true,
    icon: "refresh",
    onClick: resetMatch,
    disabled: resetting,
    style: {
      marginTop: 10,
      color: FC.bad,
      borderColor: withAlpha(FC.bad, 0.4),
      background: "rgba(255,255,255,0.9)"
    }
  }, resetting ? "Remise à zéro…" : "Remettre le match à « pas joué »"));
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
}, {
  key: "motm",
  label: "HDM",
  title: "Homme du match"
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
  motmVotes,
  roster,
  currentPlayer,
  subjectId
}) {
  const isOther = !!subjectId && subjectId !== currentPlayer?.id;
  const subject = subjectId || currentPlayer?.id;
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
  const filteredIds = new Set(filtered.map(m => m.id));
  const population = statsPopulation(roster, season, lineups.filter(l => filteredIds.has(l.match_id)));
  const ratingBy = Object.fromEntries(population.map(id => [id, averageRating(playerRatingSeries(filtered, ratings, lineups, id))]));
  const motmBy = motmWinners(filtered, motmVotes || []);
  const rows = buildStatsRows(population, computePlayerStats(filtered, lineups, events, motmBy), ratingBy);
  const pool = rows.filter(r => r.played > 0);
  const ratingPool = rows.filter(r => r.rating != null);
  const ranks = Object.fromEntries(FOOT_STAT_COLUMNS.map(c => [c.key, rankPlayers(c.key === "rating" ? ratingPool : pool, c.key, mode)]));
  // A player outside the regular roster (guest…) still has a page; he is just not ranked.
  const me = rows.find(r => r.playerId === subject) || (subject ? buildStatsRows([subject], computePlayerStats(filtered, lineups, events, motmBy), {
    [subject]: averageRating(playerRatingSeries(filtered, ratings, lineups, subject))
  })[0] : null);
  const series = subject ? playerRatingSeries(filtered, ratings, lineups, subject).slice(-10) : [];
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
  }, "Les statistiques concernent l'effectif r\xE9gulier et occasionnel."), me && !population.includes(subject) && /*#__PURE__*/React.createElement(FMessage, {
    tone: "warn"
  }, "Joueur hors effectif r\xE9gulier : pas de classement."), me && me.played === 0 && /*#__PURE__*/React.createElement(FMessage, {
    tone: "warn"
  }, "Pas encore de match termin\xE9 avec une convocation."), /*#__PURE__*/React.createElement(FCard, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(FAvatar, {
    playerId: subject,
    name: footNameOf(subject),
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
  }, isOther ? `Stats de ${footNameOf(subject)}` : "Mes stats"), /*#__PURE__*/React.createElement("div", {
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
    style: {
      ...tiles,
      marginBottom: 14
    }
  }, tilesFor(["goals", "assists", "decisive"])), /*#__PURE__*/React.createElement(FLabel, null, "Distinctions"), /*#__PURE__*/React.createElement("div", {
    style: tiles
  }, tilesFor(["motm"]))), /*#__PURE__*/React.createElement(FCard, null, /*#__PURE__*/React.createElement(FHeading, null, isOther ? "Évolution" : "Mon évolution"), /*#__PURE__*/React.createElement(FootRatingChart, {
    series: series
  })), !isOther && /*#__PURE__*/React.createElement(FootRankingsPanel, {
    seasonMatches: filtered,
    season: season,
    lineups: lineups,
    events: events,
    ratings: ratings,
    motmVotes: motmVotes,
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
  key: "decisive",
  label: "Décisifs",
  unit: "",
  icon: "chart"
}, {
  key: "rating",
  label: "Notes",
  unit: "",
  icon: "star"
}, {
  key: "motm",
  label: "HDM",
  unit: "fois",
  icon: "trophy"
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
    ring: first ? FC.accent : FC.line,
    linkable: true
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
  }, /*#__PURE__*/React.createElement(FPlayerLink, {
    id: entry.playerId
  }, entry.name)), /*#__PURE__*/React.createElement("div", {
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
  motmVotes,
  roster,
  currentPlayer,
  mode = "abs"
}) {
  const [tab, setTab] = React.useState(() => readPref("foot_rank_tab", "goals", ["goals", "assists", "decisive", "rating", "motm"]));
  const pick = v => {
    setTab(v);
    writePref("foot_rank_tab", v);
  };
  const ids = new Set(seasonMatches.map(m => m.id));
  const seasonLineups = lineups.filter(l => ids.has(l.match_id));
  const rows = buildStatsRows(statsPopulation(roster, season, seasonLineups), computePlayerStats(seasonMatches, seasonLineups, events.filter(e => ids.has(e.match_id)), motmWinners(seasonMatches, motmVotes || [])), {});
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
    options: FOOT_RANKING_TABS.map(x => [x.key, x.label]),
    style: {
      marginBottom: 16
    }
  }), entries.length === 0 ? /*#__PURE__*/React.createElement(FEmpty, {
    icon: "trophy",
    title: "Pas encore de classement",
    text: `Aucun joueur n'a encore de ${t.key === "rating" ? "note" : t.key === "goals" ? "but" : t.key === "motm" ? "titre d'homme du match" : t.key === "decisive" ? "but ni passe décisive" : "passe décisive"} sur cette période.`
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
    size: 34,
    linkable: true
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0,
      fontSize: 15,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, /*#__PURE__*/React.createElement(FPlayerLink, {
    id: e.playerId
  }, e.name)), /*#__PURE__*/React.createElement("span", {
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
  const sentKey = readInstaKey();
  const r = await fetch(`/api/insta/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Insta-Admin-Key": sentKey
    },
    body: method === "GET" ? undefined : JSON.stringify(body)
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && sentKey) {
    // the stored key is wrong: forget it and ask again
    try {
      localStorage.removeItem(INSTA_KEY_STORAGE);
    } catch (e) {}
    try {
      window.dispatchEvent(new Event("foot-insta-key-invalid"));
    } catch (e) {}
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

// Stand-in render (player_id 0) used for every player without a render of their own.
const FOOT_UNKNOWN_PLAYER = {
  id: DEFAULT_PHOTO_PLAYER_ID,
  name: "Joueur inconnu (photo par défaut)"
};
function FootPhotosTab({
  roster,
  photos,
  reload
}) {
  const nameOf = p => p.id === FOOT_UNKNOWN_PLAYER.id ? p.name : footShortName(p) || "";
  const real = roster.map(r => PLAYERS.find(p => p.id === r.player_id)).filter(Boolean).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  if (!real.length) return /*#__PURE__*/React.createElement(FCard, null, /*#__PURE__*/React.createElement(FEmpty, {
    icon: "users",
    title: "Aucun joueur",
    text: "Ajoute des joueurs \xE0 l'effectif (onglet Admin)."
  }));
  const players = [FOOT_UNKNOWN_PLAYER, ...real];
  const count = id => photos.filter(ph => ph.player_id === id).length;
  return /*#__PURE__*/React.createElement("div", null, players.map(p => /*#__PURE__*/React.createElement(FCard, {
    key: p.id,
    pad: 14
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: p.id === FOOT_UNKNOWN_PLAYER.id ? 4 : 12
    }
  }, /*#__PURE__*/React.createElement(FAvatar, {
    playerId: p.id || null,
    name: nameOf(p),
    size: 40
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontFamily: FF.display,
      fontSize: 18,
      color: FC.deep
    }
  }, nameOf(p)), p.id === FOOT_UNKNOWN_PLAYER.id ? /*#__PURE__*/React.createElement(FChip, {
    tone: count(p.id) >= 1 ? "good" : "soft"
  }, count(p.id), " / 2") : /*#__PURE__*/React.createElement(FChip, {
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
  }, label)), INSTA_KINDS.filter(([kind]) => p.id !== FOOT_UNKNOWN_PLAYER.id || kind === "render").map(([kind, kindLabel]) => /*#__PURE__*/React.createElement(React.Fragment, {
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
const FRAMING_LAYOUT_LABELS = [["result", "Résultat (référence)"], ["matchday", "Match Day (suit Résultat)"], ["groupe", "Groupe"], ["render", "Render (rond)"], ["podium_celebration", "Podium · Buts"], ["podium_dos", "Podium · Passe D / Notes"], ["podium_render", "Podium · Moyennes"]];

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
      src: `/assets/insta/bg-${photo ? photo.kit : kit}.jpg?v=crt1`,
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
    }, p.id === FOOT_UNKNOWN_PLAYER.id ? "Inconnu" : footShortName(p)), photo && /*#__PURE__*/React.createElement("span", {
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
  const nameOf = p => p.id === FOOT_UNKNOWN_PLAYER.id ? "Joueur inconnu" : footShortName(p) || "";
  const players = [...new Set(photos.map(p => p.player_id))].map(id => id === FOOT_UNKNOWN_PLAYER.id ? FOOT_UNKNOWN_PLAYER : PLAYERS.find(p => p.id === id)).filter(p => p && (p.id === FOOT_UNKNOWN_PLAYER.id || roster.some(r => r.player_id === p.id))).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const [playerId, setPlayerId] = React.useState(null);
  const [kit, setKit] = React.useState("domicile");
  const [layout, setLayout] = React.useState("result");
  const [mode, setMode] = React.useState("single");
  const [showGuides, setShowGuides] = React.useState(true);
  const pid = players.some(p => p.id === playerId) ? playerId : players[0] ? players[0].id : null;
  const photo = pid != null ? choosePhoto(photos, pid, PHOTO_KIND_FOR_LAYOUT[layout], kit) : null;
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
      const now = new Date().toISOString();
      const rows = [{
        photo_id: photo.id,
        layout,
        x: fr.x,
        y: fr.y,
        width: fr.width,
        updated_at: now
      }];
      if (layout === "result") {
        const md = await matchdayFromResult(fr);
        rows.push({
          photo_id: photo.id,
          layout: "matchday",
          x: md.x,
          y: md.y,
          width: md.width,
          updated_at: now
        });
      }
      assertUpsertOk(await SUPABASE.from("foot_photo_framings").upsert(rows, {
        onConflict: "photo_id,layout"
      }));
      await reload();
      setMsg({
        t: "success",
        m: layout === "result" ? "Cadrage enregistré ✓ (Match Day mis à jour : même zoom, joueur centré)" : "Cadrage enregistré ✓"
      });
    } catch (e) {
      setMsg({
        t: "error",
        m: "Erreur: " + e.message
      });
    }
    setSaving(false);
  }
  // Position of the player himself (0..1 across the photo), read from the photo's transparent background.
  async function personRatio() {
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
    return personCenterRatio(ctx.getImageData(0, 0, W, H).data, W, H);
  }
  // Slides the photo sideways so the player himself (not the picture) stands in the middle of the canvas.
  async function centerPlayer() {
    setCentering(true);
    setMsg(null);
    try {
      setFr(centerFramingOnPerson(fr, cw, await personRatio()));
    } catch (e) {
      setMsg({
        t: "error",
        m: "Centrage impossible : " + e.message
      });
    }
    setCentering(false);
  }
  // Match Day follows Résultat: same size (same zoom %) and same height, the player centred on the canvas.
  async function matchdayFromResult(f) {
    const shift = LAYOUTS.matchday.box.x - LAYOUTS.result.box.x;
    return centerFramingOnPerson({
      x: f.x + shift,
      y: f.y,
      width: f.width
    }, LAYOUTS.matchday.canvas[0], await personRatio());
  }
  async function previewServer() {
    const url = (l, f) => `/api/insta/render?${new URLSearchParams({
      kind: "frame",
      photo: String(photo.id),
      layout: l,
      ...(f ? {
        x: String(Math.round(f.x * 10) / 10),
        y: String(Math.round(f.y * 10) / 10),
        w: String(Math.round(f.width * 10) / 10)
      } : {}),
      t: String(Date.now())
    })}`;
    setMsg(null);
    try {
      if (layout === "result") {
        // Résultat is the one being placed; Match Day is derived from it (same zoom, centred).
        const md = await matchdayFromResult(fr);
        setServerPreview([{
          label: "Résultat (réglage en cours)",
          src: url("result", fr)
        }, {
          label: "Match Day (déduit : même zoom, centré)",
          src: url("matchday", md)
        }]);
      } else if (layout === "matchday") {
        setServerPreview([{
          label: "Match Day (réglage en cours)",
          src: url("matchday", fr)
        }, {
          label: "Résultat (enregistré)",
          src: url("result", null)
        }]);
      } else setServerPreview([{
        label: "",
        src: url(layout, fr)
      }]);
    } catch (e) {
      setMsg({
        t: "error",
        m: "Aperçu impossible : " + e.message
      });
    }
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
    value: pid ?? "",
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
  }, l)))), mode === "single" && (layout === "result" || layout === "matchday") && photo && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: FC.muted,
      marginBottom: 10,
      lineHeight: 1.4
    }
  }, layout === "result" ? "Place le joueur ici : en enregistrant, Match Day reprend le même zoom, avec le joueur centré." : "Match Day se met à jour quand tu enregistres Résultat. Tu peux le retoucher ici, mais le prochain enregistrement de Résultat le recalcule."), mode === "compare" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
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
    src: `/assets/insta/bg-${photo ? photo.kit : kit}.jpg?v=crt1`,
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
    max: 800,
    step: 1,
    value: Math.min(800, Math.max(50, pct)),
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
  onSaved,
  rejected
}) {
  const [v, setV] = React.useState("");
  const [show, setShow] = React.useState(false);
  function save() {
    const clean = v.replace(/[\s\u200B-\u200D\uFEFF]/g, ""); // spaces and invisible characters a phone keyboard may add
    if (!clean) return;
    try {
      localStorage.setItem(INSTA_KEY_STORAGE, clean);
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
  }, "Gard\xE9e uniquement dans ce navigateur, envoy\xE9e seulement \xE0 l'API du site."), rejected && /*#__PURE__*/React.createElement(FMessage, null, "Cette cl\xE9 a \xE9t\xE9 refus\xE9e par le serveur. V\xE9rifie-la (affiche-la avec la case ci-dessous) et r\xE9essaie."), /*#__PURE__*/React.createElement("input", {
    type: show ? "text" : "password",
    style: FOOT_INPUT_STYLE,
    placeholder: "Cl\xE9 admin",
    value: v,
    onChange: e => setV(e.target.value),
    "aria-label": "Cl\xE9 admin",
    autoCapitalize: "off",
    autoCorrect: "off",
    autoComplete: "off",
    spellCheck: false
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: 14,
      color: FC.muted,
      margin: "2px 0 12px"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: show,
    onChange: e => setShow(e.target.checked)
  }), " Afficher la cl\xE9"), /*#__PURE__*/React.createElement(FBtn, {
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
    name: footShortName(p) || "",
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
  const [rejected, setRejected] = React.useState(false);
  React.useEffect(() => {
    const onBad = () => {
      setHasKey(false);
      setRejected(true);
    };
    window.addEventListener("foot-insta-key-invalid", onBad);
    return () => window.removeEventListener("foot-insta-key-invalid", onBad);
  }, []);
  const pick = t => {
    setTab(t);
    writePref("foot_reseaux_tab", t);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "ft-page"
  }, !hasKey && /*#__PURE__*/React.createElement(FootInstaKeyBox, {
    rejected: rejected,
    onSaved: () => {
      setRejected(false);
      setHasKey(true);
    }
  }), /*#__PURE__*/React.createElement(FSegmented, {
    value: tab,
    onChange: pick,
    options: [["posts", "Posts", "send"], ["photos", "Photos", "photo"], ["cadrage", "Cadrage", "pencil"]],
    style: {
      marginBottom: 14,
      background: "rgba(255,255,255,0.92)"
    }
  }), tab === "posts" && /*#__PURE__*/React.createElement(FootPostsTab, {
    key: String(hasKey),
    matches: matches,
    lineups: lineups,
    events: events,
    ratings: ratings,
    roster: roster,
    photos: photos
  }), tab === "photos" && /*#__PURE__*/React.createElement(FootPhotosTab, {
    key: String(hasKey),
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
  calendar: ["Calendrier", "Bière Leverculsec"],
  rankings: ["Classement", null],
  stats: ["Stats", null],
  reseaux: ["Réseaux", "Instagram"],
  admin: ["Admin", "Matchs et effectif"]
};

// ---- opening screen -------------------------------------------------------------------------------------------------------------------
const FOOT_SPLASH_STEPS = [["calendar", "Calendrier", "calendar"], ["rankings", "Classement", "trophy"], ["stats", "Stats", "chart"]];
function FootSplash({
  steps,
  leaving,
  theme
}) {
  const done = FOOT_SPLASH_STEPS.filter(([k]) => steps[k]).length;
  const pct = Math.round(done / FOOT_SPLASH_STEPS.length * 100);
  return /*#__PURE__*/React.createElement("div", {
    role: "status",
    "aria-live": "polite",
    "aria-label": "Chargement du module foot",
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 400,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 26,
      padding: 24,
      color: "#fff",
      background: `radial-gradient(circle at 50% 30%, ${FC.accent} 0%, ${FC.deep} 78%)`,
      opacity: leaving ? 0 : 1,
      transition: "opacity 0.45s ease",
      pointerEvents: leaving ? "none" : "auto"
    }
  }, /*#__PURE__*/React.createElement("style", null, `
        @keyframes ftSplashBounce { 0%,100% { transform: translateY(0) scale(1,1); } 45% { transform: translateY(-34px) scale(0.98,1.02); } 50% { transform: translateY(-34px); } 92% { transform: translateY(0) scale(1.08,0.92); } }
        @keyframes ftSplashShadow { 0%,100% { transform: scale(1); opacity: .35; } 50% { transform: scale(.6); opacity: .15; } }
        @keyframes ftSplashIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .ft-splash-anim { animation: none !important; } }
      `), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 118,
      height: 96,
      background: "#fff",
      borderRadius: 28,
      boxShadow: "0 8px 0 rgba(0,0,0,0.18)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      animation: "ftSplashIn .5s ease both"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: theme === "pink" ? "/logo-bl-rose.png" : "/logo-bl.png",
    alt: "",
    style: {
      width: 96,
      height: 76,
      objectFit: "contain"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "ft-splash-anim",
    style: {
      fontSize: 46,
      lineHeight: 1,
      animation: "ftSplashBounce 1.05s cubic-bezier(.3,0,.6,1) infinite"
    },
    "aria-hidden": "true"
  }, "\u26BD"), /*#__PURE__*/React.createElement("div", {
    className: "ft-splash-anim",
    style: {
      width: 46,
      height: 8,
      borderRadius: 4,
      background: "rgba(0,0,0,0.5)",
      margin: "6px auto 0",
      animation: "ftSplashShadow 1.05s cubic-bezier(.3,0,.6,1) infinite"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.display,
      fontSize: 24,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      textShadow: "2px 2px 0 rgba(0,0,0,0.25)"
    }
  }, "Coup d'envoi\u2026"), /*#__PURE__*/React.createElement("div", {
    style: {
      width: "min(320px, 100%)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 12,
      borderRadius: 6,
      background: "rgba(0,0,0,0.28)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${Math.max(8, pct)}%`,
      height: "100%",
      borderRadius: 6,
      background: "#fff",
      transition: "width .45s ease"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginTop: 14
    }
  }, FOOT_SPLASH_STEPS.map(([k, label, icon]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 4,
      flex: 1,
      opacity: steps[k] ? 1 : 0.55,
      transition: "opacity .3s"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 34,
      height: 34,
      borderRadius: 17,
      background: steps[k] ? "#fff" : "rgba(255,255,255,0.18)",
      color: steps[k] ? FC.deep : "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "all .3s"
    }
  }, /*#__PURE__*/React.createElement(FIcon, {
    name: steps[k] ? "check" : icon,
    size: 18,
    stroke: 2.4
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: FF.ui,
      fontSize: 12,
      letterSpacing: "0.04em",
      textTransform: "uppercase"
    }
  }, label))))));
}

// ---- the club room: Calendrier / Classement / Vestiaire as three corners of one 3D locker room ------------------------------
// foot-room.js draws the room and reports taps; this screen feeds it the data and lays the readable bits over it.
const FOOT_ROOM_ZONES = {
  calendar: "desk",
  rankings: "board",
  vestiaire: "rack"
};
const FOOT_ROOM_TITLES = {
  calendar: "Calendrier",
  rankings: "Classement",
  vestiaire: "Vestiaire"
};
function FootRoomStat({
  label,
  value
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.display,
      fontSize: 22,
      lineHeight: 1.1,
      color: "#fff"
    }
  }, value), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.ui,
      fontSize: 10,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: "rgba(255,255,255,0.7)"
    }
  }, label));
}

// The extra numbers under a shirt (Vestiaire, "Plus de stats"): compact, so everything fits on a phone screen at once.
function FootShirtMore({
  st,
  onOpenMatch
}) {
  const label = {
    fontFamily: FF.ui,
    fontSize: 10,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.6)",
    margin: "9px 0 4px"
  };
  const box = {
    background: "rgba(255,255,255,0.07)",
    borderRadius: 11,
    padding: "5px 4px 4px",
    textAlign: "center",
    minWidth: 0
  };
  const small = {
    fontFamily: FF.ui,
    fontSize: 9,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.7)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  };
  const tile = (title, value) => /*#__PURE__*/React.createElement("div", {
    style: box
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.display,
      fontSize: 17,
      lineHeight: 1.1
    }
  }, value), /*#__PURE__*/React.createElement("div", {
    style: small
  }, title));
  const dash = (v, f = x => x) => v == null ? "–" : f(v);
  const two = v => v.toFixed(2),
    one = v => v.toFixed(1);
  // a rated match: the mark, who it was against; a tap opens the match
  const matchTile = (title, m, tone) => /*#__PURE__*/React.createElement("button", {
    disabled: !m,
    onClick: () => m && onOpenMatch(m.matchId),
    style: {
      ...box,
      border: "none",
      color: "#fff",
      cursor: m ? "pointer" : "default",
      background: m ? tone : box.background,
      font: "inherit"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.display,
      fontSize: 17,
      lineHeight: 1.1
    }
  }, m ? one(m.rating) : "–"), /*#__PURE__*/React.createElement("div", {
    style: small
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      color: "rgba(255,255,255,0.85)"
    }
  }, m ? `vs ${m.opponent} ›` : "pas de note"));
  const res = [["V", st.wins, "#2f9a55"], ["N", st.draws, "#b9a03a"], ["D", st.losses, "#c0262d"]];
  const grid = n => ({
    display: "grid",
    gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
    gap: 5
  });
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: label
  }, "R\xE9sultats \xB7 ", st.wins, " V \xB7 ", st.draws, " N \xB7 ", st.losses, " D"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      height: 10,
      borderRadius: 5,
      overflow: "hidden",
      background: "rgba(255,255,255,0.1)"
    }
  }, st.played > 0 && res.map(([k, n, c]) => n > 0 && /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      width: `${n / st.played * 100}%`,
      background: c
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.display,
      fontSize: 16,
      whiteSpace: "nowrap"
    }
  }, dash(st.winPct, v => `${v}%`), " ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: FF.ui,
      fontSize: 10,
      color: "rgba(255,255,255,0.6)"
    }
  }, "VICTOIRES"))), /*#__PURE__*/React.createElement("div", {
    style: label
  }, "Cette saison"), /*#__PURE__*/React.createElement("div", {
    style: grid(3)
  }, tile("Buts / match", dash(st.goalsPerMatch, two)), tile("Passes D / match", dash(st.assistsPerMatch, two)), tile("Décisifs / match", dash(st.decisivePerMatch, two))), /*#__PURE__*/React.createElement("div", {
    style: {
      ...grid(3),
      marginTop: 5
    }
  }, matchTile("Meilleure note", st.best, "rgba(47,154,85,0.75)"), matchTile("Pire note", st.worst, "rgba(192,38,45,0.7)"), tile("Note moyenne", dash(st.rating, one))), st.career && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: label
  }, "Carri\xE8re au club"), /*#__PURE__*/React.createElement("div", {
    style: grid(6)
  }, tile("Matchs", st.career.played), tile("Buts", st.career.goals), tile("Passes D", st.career.assists), tile("Décisifs", st.career.decisive), tile("Note", dash(st.career.rating, one)), tile("HDM", st.career.motm))));
}

// A compact season / matches picker floating over the 3D room (native select: easy on a phone).
function FootRoomPicker({
  label,
  value,
  options,
  onChange
}) {
  const current = options.find(([v]) => v === value);
  return /*#__PURE__*/React.createElement("label", {
    style: {
      position: "relative",
      pointerEvents: "auto",
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      background: "rgba(16,12,14,0.72)",
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      border: "1px solid rgba(255,255,255,0.18)",
      borderRadius: 999,
      padding: "7px 14px",
      color: "#fff",
      fontFamily: FF.ui,
      fontSize: 14,
      letterSpacing: "0.03em",
      whiteSpace: "nowrap"
    }
  }, current ? current[1] : value, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      opacity: 0.7
    }
  }, "\u25BE"), /*#__PURE__*/React.createElement("select", {
    "aria-label": label,
    value: value,
    onChange: e => onChange(e.target.value),
    style: {
      position: "absolute",
      inset: 0,
      opacity: 0,
      width: "100%",
      cursor: "pointer",
      fontSize: 16
    }
  }, options.map(([v, l]) => /*#__PURE__*/React.createElement("option", {
    key: v,
    value: v
  }, l))));
}
function FootRoomScreen({
  visible,
  page,
  theme,
  onHome,
  settings,
  roster,
  attendance,
  reload,
  matches,
  events,
  lineups,
  ratings,
  motmVotes,
  currentPlayer,
  nav,
  openPlayer,
  onLeaveRoom
}) {
  const host = React.useRef(null);
  const room = React.useRef(null);
  const [state, setState] = React.useState("loading");
  const [error, setError] = React.useState(null);
  const [shirt, setShirt] = React.useState(null);
  const [boardMode, setBoardModeState] = React.useState(() => readPref("foot_room_board", "indiv", ["indiv", "team"]));
  const [boardTab, setBoardTabState] = React.useState(() => readPref("foot_rank_tab", "goals", FOOT_RANKING_TABS.map(t => t.key)));
  const [month, setMonth] = React.useState(() => {
    const s = calendarStartMonth(matches);
    return s.year * 12 + s.month - 1;
  });
  const months = React.useMemo(() => matchMonths(matches), [matches]);
  const [paper, setPaper] = React.useState(null);
  const [savingPresence, setSavingPresence] = React.useState(false);
  const [presenceDraft, setPresenceDraft] = React.useState(null); // answer shown on the sheet while it is being saved
  const [statsOpen, setStatsOpen] = React.useState(false);
  const [arrived, setArrived] = React.useState(null);
  const roomSquad = React.useRef(null); // the squad the room is showing
  const pendingShirt = React.useRef(null); // shirt to show when arriving at the rack (a name tapped on the board)
  const [statsType, setStatsTypeState] = React.useState(() => readPref("foot_room_stats_type", "all", ["all", "championnat", "amical"]));
  const setStatsType = v => {
    setStatsTypeState(v);
    writePref("foot_room_stats_type", v);
  };
  // seasons: the current one, those with matches, those with a listed squad (newest first)
  const season = seasonOf(new Date().toISOString());
  const seasons = React.useMemo(() => [...new Set([season, ...seasonsFromMatches(matches), ...Object.keys(FOOT_SEASON_SQUADS)])].sort().reverse(), [matches, season]);
  const rackSeasons = seasons.filter(s => s === season || FOOT_SEASON_SQUADS[s]);
  const [boardSeason, setBoardSeasonState] = React.useState(() => readPref("foot_room_board_season", season, ["all", ...seasons]));
  const setBoardSeason = v => {
    setBoardSeasonState(v);
    writePref("foot_room_board_season", v);
  };
  const [boardType, setBoardTypeState] = React.useState(() => readPref("foot_room_board_type", "all", ["all", "championnat", "amical"]));
  const setBoardType = v => {
    setBoardTypeState(v);
    writePref("foot_room_board_type", v);
  };
  const [rackSeason, setRackSeason] = React.useState(season);
  const [rackAway, setRackAway] = React.useState(false); // home or away kit of the season (when it had two)
  const {
    photos,
    framings
  } = React.useContext(FootCtx);
  const meId = currentPlayer ? currentPlayer.id : null;
  const zone = FOOT_ROOM_ZONES[page] || "rack";
  const kits = seasonKits(rackSeason, season);
  const kit = rackAway && kits[1] ? kits[1] : kits[0];

  // ---- data ----
  const squad = React.useMemo(() => rackSeason === season ? rackSquad(roster, footNameOf) : seasonRack(FOOT_SEASON_SQUADS[rackSeason] || [], roster, footNameOf), [roster, rackSeason, season]);
  const scoreById = React.useMemo(() => {
    const by = {};
    for (const e of events) (by[e.match_id] = by[e.match_id] || []).push(e);
    return Object.fromEntries(matches.map(m => [m.id, computeFootScore(by[m.id] || [])]));
  }, [matches, events]);
  // stats rows of the matches of a season ("all": every season) and a type, for the given players
  const rowsFor = (s, type, population) => {
    const filtered = filterMatchesForStats(matches, {
      season: s,
      type
    });
    const ids = new Set(filtered.map(m => m.id));
    const ls = lineups.filter(l => ids.has(l.match_id));
    const out = buildStatsRows(population(ls), computePlayerStats(filtered, ls, events.filter(e => ids.has(e.match_id)), motmWinners(filtered, motmVotes || [])), {});
    for (const r of out) {
      const sr = playerRatingSeries(filtered, ratings, ls, r.playerId);
      r.rating = averageRating(sr);
      r.rated = sr.length;
    }
    return out;
  };
  const rows = React.useMemo(() => rowsFor(boardSeason, boardType, ls => statsPopulation(roster, boardSeason, ls)), [matches, lineups, events, ratings, motmVotes, roster, boardSeason, boardType]);
  const bounds = React.useMemo(() => calendarBounds(matches), [matches]);
  // face photo for the board's post-its (same framing as the avatars)
  const faceFor = id => {
    const ph = photoOrDefault(photos, id, "render", theme === "pink" ? "exterieur" : "domicile");
    return ph ? {
      url: instaPublicUrl(ph.path),
      rect: framedRect("render", ph, savedFraming(framings || [], ph.id, "render"))
    } : null;
  };
  const upcoming = React.useMemo(() => upcomingMatches(matches, 4), [matches]);
  // my final rating of each played match (only once the ratings are validated)
  const myRatings = React.useMemo(() => meId ? Object.fromEntries(playerRatingSeries(matches, ratings, lineups, meId).map(r => [r.matchId, r.rating])) : {}, [matches, ratings, lineups, meId]);
  async function answer(status, matchId) {
    const m = matchId != null ? matches.find(x => String(x.id) === String(matchId)) : upcoming[0];
    if (!m || !meId || m.status !== "scheduled") return;
    setPresenceDraft({
      id: m.id,
      status
    });
    try {
      await setMatchAttendance(m.id, meId, status);
      await reload();
    } catch (e) {
      console.warn("attendance failed", e);
    }
    setPresenceDraft(null);
  }
  const tap = React.useRef();
  tap.current = (surface, id) => {
    if (!id) {
      if (surface === "next" && upcoming[0]) setPaper(upcoming[0]);
      return;
    }
    const [kind, rest] = [id.split(":")[0], id.slice(id.indexOf(":") + 1)];
    if (kind === "mode") {
      setBoardModeState(rest);
      writePref("foot_room_board", rest);
    } else if (kind === "tab") {
      setBoardTabState(rest);
      writePref("foot_rank_tab", rest);
    } else if (kind === "player") {
      // profiles live in the vestiaire: open the one of the season the board shows
      const id = Number(rest);
      const has = s => (s === season ? rackSquad(roster, footNameOf) : seasonRack(FOOT_SEASON_SQUADS[s] || [], roster, footNameOf)).some(p => p.id === id);
      const target = boardSeason !== "all" && rackSeasons.includes(boardSeason) && has(boardSeason) ? boardSeason : rackSeasons.find(has);
      if (target) setRackSeason(target);
      pendingShirt.current = id;
      nav("vestiaire");
    } else if (kind === "next") {
      if (upcoming[0]) setPaper(upcoming[0]);
    } else if (kind === "match") {
      const m = matches.find(x => String(x.id) === rest);
      if (m) nav("matchDetail", {
        matchId: m.id
      });
    } else if (kind === "presence") answer(rest);else if (kind === "pres") {
      const [mid, st] = rest.split(":");
      answer(st, mid);
    } else if (kind === "cal") setMonth(v => {
      // jump to the previous / next month that has a match
      const k = rest === "next" ? months.find(x => x > v) : [...months].reverse().find(x => x < v);
      return k == null ? v : k;
    });
  };

  // ---- the room itself: created once, kept while the football app is open ----
  React.useEffect(() => {
    let alive = true;
    window.FootRoom.ensureLoaded().then(() => {
      if (!alive || !host.current) return;
      room.current = window.FootRoom.create(host.current, {
        zone,
        accent: FC.accent,
        accentDeep: FC.deep,
        onShirt: (i, p) => alive && setShirt(p || null),
        onArrive: z => alive && setArrived(z),
        onTap: (surface, id) => tap.current(surface, id)
      });
      setState("ready");
    }).catch(e => {
      if (alive) {
        setError(e.message);
        setState("error");
      }
    });
    return () => {
      alive = false;
      if (room.current) room.current.destroy();
      room.current = null;
    };
  }, []);
  React.useEffect(() => {
    if (room.current) room.current.pause(!visible);
  }, [visible, state]);
  React.useEffect(() => {
    if (!room.current) return;
    if (room.current.zone() !== zone) {
      setArrived(null);
      room.current.setZone(zone);
    } else setArrived(zone);
    setPaper(null);
    setStatsOpen(false);
    // (a name tapped on the board may change the season's rack: then the squad effect below selects it)
    if (zone === "rack") {
      const id = pendingShirt.current || meId;
      if (id) room.current.selectId(id);
      if (roomSquad.current === squad) pendingShirt.current = null;
    }
  }, [zone, state]);
  React.useEffect(() => {
    if (room.current) {
      room.current.setAccent(FC.accent, FC.deep);
      const keep = shirt && squad.some(p => p.id === shirt.id) ? shirt.id : currentPlayer?.id;
      room.current.setSquad(squad, kit, pendingShirt.current || keep);
      pendingShirt.current = null;
      roomSquad.current = squad;
    }
  }, [squad, kit, state]);
  React.useEffect(() => {
    if (!room.current) return;
    const entries = rankingEntries(rows, boardTab, footNameOf, 99).map(e => ({
      playerId: e.playerId,
      name: footNameOf(e.playerId),
      value: boardTab === "rating" ? e.value.toFixed(1) : formatStatValue(e.value, boardTab, "abs"),
      face: faceFor(e.playerId)
    }));
    const label = (boardSeason === "all" ? "Toutes les saisons" : `Saison ${shortSeason(boardSeason)}`) + (boardType === "championnat" ? " · Championnat" : boardType === "amical" ? " · Amicaux" : "");
    room.current.setBoard({
      mode: boardMode,
      tab: boardTab,
      tabs: FOOT_RANKING_TABS.map(({
        key,
        label
      }) => ({
        key,
        label
      })),
      season: label,
      entries
    });
  }, [rows, boardMode, boardTab, boardSeason, boardType, state, photos, framings, theme]);
  React.useEffect(() => {
    if (!room.current) return;
    const venue = m => m.venue === "exterieur" ? "Extérieur" : "Domicile";
    const next = upcoming[0];
    const presenceOf = m => !m || !meId ? "none" : presenceDraft && presenceDraft.id === m.id ? presenceDraft.status : presenceMap(attendance, m.id)[meId] || "none";
    const mine = presenceOf(next);
    const longDate = iso => new Date(iso).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "Europe/Paris"
    });
    const y = Math.floor(month / 12),
      mo = month % 12 + 1;
    room.current.setDesk({
      next: next && {
        kicker: [next.status === "live" ? "En direct" : footRelative(next.match_datetime), venue(next), next.match_type === "amical" ? "Amical" : null].filter(Boolean).join(" · "),
        opponent: next.opponent_name,
        date: longDate(next.match_datetime),
        hours: `Match ${footHour(next.match_datetime)}${next.meeting_at ? ` · RDV ${footHour(next.meeting_at)}` : ""}`,
        place: formatMatchPlace(next),
        presence: mine,
        canAnswer: !!meId && next.status === "scheduled",
        ballKeepers: (next.ball_keepers || []).map(id => ({
          name: footNameOf(id),
          face: faceFor(id)
        }))
      },
      upcoming: upcoming.slice(1, 4).map(m => ({
        id: m.id,
        date: longDate(m.match_datetime),
        opponent: m.opponent_name,
        sub: `${footHour(m.match_datetime)} · ${venue(m)}`,
        canAnswer: !!meId && m.status === "scheduled",
        presence: presenceOf(m)
      })),
      calendar: {
        ...monthMatches(matches, m => scoreById[m.id] || {
          bl: 0,
          opponent: 0
        }, month, m => myRatings[m.id]),
        hasPrev: months.some(x => x < month),
        hasNext: months.some(x => x > month)
      }
    });
  }, [upcoming, matches, scoreById, month, months, theme, state, attendance, presenceDraft, myRatings, photos, framings]);

  // the desk calendar's season (August → July) and the jump to another one
  const deskSeason = (() => {
    const y = Math.floor(month / 12),
      m0 = month % 12;
    const st = m0 >= 7 ? y : y - 1;
    return `${st}-${st + 1}`;
  })();
  const jumpToSeason = s => {
    if (s === season) {
      const st = calendarStartMonth(matches);
      setMonth(st.year * 12 + st.month - 1);
      return;
    }
    const first = months.find(k => {
      const y = Math.floor(k / 12),
        m0 = k % 12;
      return `${m0 >= 7 ? y : y - 1}-${(m0 >= 7 ? y : y - 1) + 1}` === s;
    });
    if (first != null) setMonth(first);
  };

  // ---- overlays ----
  const vestRows = React.useMemo(() => rowsFor(rackSeason, statsType, () => squad.map(p => p.id)), [statsType, squad, matches, lineups, events, ratings, motmVotes, rackSeason]);
  const row = shirt && vestRows.find(r => r.playerId === shirt.id);
  const more = React.useMemo(() => {
    if (!shirt) return null;
    const seasonMs = filterMatchesForStats(matches, {
      season: rackSeason,
      type: statsType
    });
    const ids = new Set(seasonMs.map(m => m.id));
    const careerMs = filterMatchesForStats(matches, {
      season: "all",
      type: statsType
    });
    const career = buildStatsRows([shirt.id], computePlayerStats(careerMs, lineups, events, motmWinners(careerMs, motmVotes || [])), {})[0];
    return shirtStats({
      row,
      careerRow: career,
      series: playerRatingSeries(seasonMs, ratings, lineups.filter(l => ids.has(l.match_id)), shirt.id),
      careerSeries: playerRatingSeries(careerMs, ratings, lineups, shirt.id)
    });
  }, [shirt, row, matches, lineups, events, ratings, motmVotes, scoreById, rackSeason, statsType]);
  const glass = {
    background: "rgba(16,12,14,0.72)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 22,
    color: "#fff"
  };
  const roundBtn = {
    width: 42,
    height: 42,
    borderRadius: 21,
    border: "1px solid rgba(255,255,255,0.22)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    fontSize: 20,
    cursor: "pointer",
    flex: "0 0 auto"
  };
  const hint = zone === "desk" ? "Touchez une feuille ou un match du calendrier" : null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 5,
      background: "#100c0e",
      display: visible ? "block" : "none"
    }
  }, /*#__PURE__*/React.createElement("style", null, footGlobalCss()), /*#__PURE__*/React.createElement("div", {
    ref: host,
    style: {
      position: "absolute",
      inset: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      padding: "calc(12px + env(safe-area-inset-top)) 16px 26px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      background: "linear-gradient(rgba(16,12,14,0.85) 40%, transparent)",
      pointerEvents: "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      pointerEvents: "auto"
    }
  }, /*#__PURE__*/React.createElement(FIconBtn, {
    icon: "home",
    label: "Retour \xE0 l'accueil",
    tone: "glass",
    onClick: onHome
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.display,
      fontSize: 26,
      color: "#fff",
      textShadow: "0 2px 0 rgba(0,0,0,0.4)"
    }
  }, FOOT_ROOM_TITLES[page]), /*#__PURE__*/React.createElement("div", {
    style: {
      pointerEvents: "auto",
      display: "flex",
      gap: 6,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(FSettingsMenu, {
    items: settings
  }))), state === "ready" && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      ...(zone === "board" ? {
        bottom: "calc(98px + env(safe-area-inset-bottom))"
      } : {
        top: "calc(66px + env(safe-area-inset-top))"
      }),
      display: "flex",
      justifyContent: "center",
      gap: 8,
      padding: "0 16px",
      pointerEvents: "none"
    }
  }, zone === "board" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(FootRoomPicker, {
    label: "Saison",
    value: boardSeason,
    onChange: setBoardSeason,
    options: [...seasons.map(s => [s, `Saison ${shortSeason(s)}`]), ["all", "Toutes les saisons"]]
  }), /*#__PURE__*/React.createElement(FootRoomPicker, {
    label: "Matchs",
    value: boardType,
    onChange: setBoardType,
    options: [["all", "Tous les matchs"], ["championnat", "Championnat"], ["amical", "Amicaux"]]
  })), zone === "rack" && /*#__PURE__*/React.createElement(FootRoomPicker, {
    label: "Saison",
    value: rackSeason,
    onChange: setRackSeason,
    options: rackSeasons.map(s => [s, `Vestiaire ${shortSeason(s)}`])
  }), zone === "rack" && kits.length > 1 && /*#__PURE__*/React.createElement(FootRoomPicker, {
    label: "Maillot",
    value: rackAway ? "away" : "home",
    onChange: v => setRackAway(v === "away"),
    options: [["home", "Domicile"], ["away", "Extérieur"]]
  }), zone === "desk" && /*#__PURE__*/React.createElement(FootRoomPicker, {
    label: "Saison",
    value: deskSeason,
    onChange: jumpToSeason,
    options: seasonsFromMatches(matches).map(s => [s, `Saison ${shortSeason(s)}`])
  })), state === "loading" && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      display: "grid",
      placeItems: "center",
      color: "rgba(255,255,255,0.7)",
      fontFamily: FF.ui,
      fontSize: 18
    }
  }, "On ouvre le vestiaire\u2026"), state === "error" && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 16,
      right: 16,
      top: "40%",
      ...glass,
      padding: 18,
      textAlign: "center",
      fontFamily: FF.ui
    }
  }, "Le vestiaire 3D n'a pas pu s'ouvrir (", error, "). ", /*#__PURE__*/React.createElement("button", {
    onClick: onLeaveRoom,
    style: {
      ...roundBtn,
      width: "auto",
      padding: "0 14px",
      marginTop: 10
    }
  }, "Pages classiques")), state === "ready" && zone === "rack" && shirt && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 12,
      right: 12,
      bottom: "calc(96px + env(safe-area-inset-bottom))",
      maxWidth: 560,
      margin: "0 auto",
      ...glass,
      background: statsOpen ? "rgba(16,12,14,0.9)" : glass.background,
      padding: statsOpen ? "10px 12px 8px" : "12px 12px 10px",
      opacity: arrived === "rack" ? 1 : 0,
      transform: arrived === "rack" ? "none" : "translateY(14px)",
      transition: "opacity 0.5s ease, transform 0.5s ease",
      pointerEvents: arrived === "rack" ? "auto" : "none"
    }
  }, meId && shirt.id !== meId && squad.some(p => p.id === meId) && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      top: -54,
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => room.current && room.current.selectId(meId),
    style: {
      ...glass,
      borderRadius: 999,
      padding: "9px 16px",
      fontFamily: FF.ui,
      fontSize: 14,
      letterSpacing: "0.04em",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(FIcon, {
    name: "shirt",
    size: 16
  }), " Revenir \xE0 mon maillot")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => room.current && room.current.step(-1),
    "aria-label": "Maillot pr\xE9c\xE9dent",
    style: roundBtn
  }, "\u2039"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      alignItems: "center",
      gap: 10,
      color: "#fff",
      textAlign: "left"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: FF.display,
      fontSize: 40,
      lineHeight: 0.9,
      color: "#fff",
      textShadow: `0 3px 0 ${FC.accent}`
    }
  }, shirt.num || "–"), /*#__PURE__*/React.createElement("span", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      fontFamily: FF.ui,
      fontSize: 20,
      lineHeight: 1.05,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, shirt.label || shirt.name), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      fontSize: 12,
      color: "rgba(255,255,255,0.7)"
    }
  }, shirt.name, " \xB7 ", shirt.role === "saison" ? `Saison ${shortSeason(rackSeason)}` : shirt.role === "occasionnel" ? "Occasionnel" : "Régulier"))), /*#__PURE__*/React.createElement("button", {
    onClick: () => room.current && room.current.step(1),
    "aria-label": "Maillot suivant",
    style: roundBtn
  }, "\u203A")), /*#__PURE__*/React.createElement("div", {
    role: "radiogroup",
    "aria-label": "Matchs pris en compte",
    style: {
      display: "flex",
      gap: 4,
      marginTop: 10,
      padding: 3,
      borderRadius: 999,
      background: "rgba(255,255,255,0.08)"
    }
  }, [["all", "Tous"], ["championnat", "Championnat"], ["amical", "Amicaux"]].map(([k, l]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    role: "radio",
    "aria-checked": statsType === k,
    onClick: () => setStatsType(k),
    style: {
      flex: 1,
      border: "none",
      borderRadius: 999,
      padding: "6px 0",
      cursor: "pointer",
      fontFamily: FF.ui,
      fontSize: 13,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      background: statsType === k ? FC.accent : "transparent",
      color: statsType === k ? "#fff" : "rgba(255,255,255,0.7)"
    }
  }, l))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 4,
      marginTop: 10,
      paddingTop: 10,
      borderTop: "1px solid rgba(255,255,255,0.12)"
    }
  }, /*#__PURE__*/React.createElement(FootRoomStat, {
    label: "Matchs",
    value: row ? row.played : 0
  }), /*#__PURE__*/React.createElement(FootRoomStat, {
    label: "Buts",
    value: row ? row.goals : 0
  }), /*#__PURE__*/React.createElement(FootRoomStat, {
    label: "Passes D",
    value: row ? row.assists : 0
  }), /*#__PURE__*/React.createElement(FootRoomStat, {
    label: "D\xE9cisifs",
    value: row ? row.decisive : 0
  }), /*#__PURE__*/React.createElement(FootRoomStat, {
    label: "Note",
    value: row && row.rating != null ? row.rating.toFixed(1) : "–"
  }), /*#__PURE__*/React.createElement(FootRoomStat, {
    label: "HDM",
    value: row ? row.motm : 0
  })), statsOpen && more && /*#__PURE__*/React.createElement(FootShirtMore, {
    st: more,
    onOpenMatch: id => nav("matchDetail", {
      matchId: id
    })
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => setStatsOpen(!statsOpen),
    "aria-expanded": statsOpen,
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      width: "100%",
      marginTop: statsOpen ? 8 : 10,
      border: "none",
      borderRadius: 14,
      padding: statsOpen ? "7px 0" : "9px 0",
      background: "rgba(255,255,255,0.1)",
      color: "#fff",
      fontFamily: FF.ui,
      fontSize: 14,
      letterSpacing: "0.05em",
      textTransform: "uppercase",
      cursor: "pointer"
    }
  }, statsOpen ? "Moins de stats ▴" : "Plus de stats ▾"), !statsOpen && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      fontSize: 10,
      color: "rgba(255,255,255,0.5)",
      marginTop: 6,
      letterSpacing: "0.04em"
    }
  }, "Saison ", shortSeason(rackSeason), statsType === "championnat" ? " · championnat" : statsType === "amical" ? " · amicaux" : "", " \xB7 glisse pour parcourir \xB7 touche le maillot pour le retourner")), state === "ready" && hint && !paper && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: "calc(98px + env(safe-area-inset-bottom))",
      textAlign: "center",
      pointerEvents: "none"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      ...glass,
      display: "inline-block",
      padding: "7px 14px",
      fontSize: 12,
      borderRadius: 999
    }
  }, hint)), paper && /*#__PURE__*/React.createElement("div", {
    onClick: () => setPaper(null),
    style: {
      position: "absolute",
      inset: 0,
      background: "rgba(0,0,0,0.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: "100%",
      maxWidth: 420,
      background: "#fbf9f3",
      borderRadius: 6,
      boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
      overflow: "hidden",
      transform: "rotate(-1deg)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: FC.accent,
      color: "#fff",
      fontFamily: FF.ui,
      fontSize: 18,
      letterSpacing: "0.06em",
      textAlign: "center",
      padding: "12px 0"
    }
  }, "PROCHAIN MATCH"), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "16px 18px 18px",
      color: "#1b1b1b"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.display,
      fontSize: 28,
      lineHeight: 1.1,
      marginBottom: 10
    }
  }, "vs ", paper.opponent_name), /*#__PURE__*/React.createElement(FootWhenWhere, {
    match: paper,
    size: 15
  }), currentPlayer && paper.status === "scheduled" && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(FootAttendanceButtons, {
    compact: true,
    myStatus: presenceMap(attendance, paper.id)[currentPlayer.id],
    saving: savingPresence,
    onSet: async st => {
      setSavingPresence(true);
      try {
        await setMatchAttendance(paper.id, currentPlayer.id, st);
        await reload();
      } catch (e) {
        console.warn("attendance failed", e);
      }
      setSavingPresence(false);
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(FBtn, {
    full: true,
    onClick: () => nav("matchDetail", {
      matchId: paper.id
    })
  }, "Ouvrir le match"), /*#__PURE__*/React.createElement(FBtn, {
    variant: "ghost",
    onClick: () => setPaper(null)
  }, "Fermer"))))));
}
function FootballApp({
  currentPlayer,
  onBack
}) {
  const theme = "green"; // one theme only: the green of the club
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
  // 3D club room (beta, bureau only for now): Calendrier / Classement / Vestiaire become corners of one locker room
  const [roomPref, setRoomPref] = React.useState(() => readPref("foot_room", "on", ["on", "off"]));
  const roomOn = roomPref === "on";
  const setRoom = on => {
    setRoomPref(on ? "on" : "off");
    writePref("foot_room", on ? "on" : "off");
    setPage(p => on && p === "stats" ? "vestiaire" : !on && p === "vestiaire" ? "stats" : p);
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
    const [r, m, a, e, l, rt, ph, fr, ac, aa, mv] = await Promise.all([sbFetch("foot_roster", "?select=*"), sbFetch("foot_matches", "?select=*&order=match_datetime"), sbFetch("foot_attendance", "?select=*"), sbFetch("foot_match_events", "?select=*"), sbFetch("foot_lineups", "?select=match_id,player_id"), sbFetch("foot_ratings", "?select=match_id,rater_id,ratee_id,score"), sbFetch("foot_player_photos", "?select=*").catch(() => []),
    // optional: absent until the insta migration is applied
    sbFetch("foot_photo_framings", "?select=*").catch(() => []), sbFetch("foot_activities", "?select=*&order=starts_at").catch(() => []),
    // optional: absent until the activities migration is applied
    sbFetch("foot_activity_attendance", "?select=*").catch(() => []), sbFetch("foot_motm_votes", "?select=match_id,voter_id,player_id").catch(() => []) // optional: absent until the man-of-the-match migration is applied
    ]);
    FOOT_POOL = new Set([...(r || []).map(x => x.player_id), ...(l || []).map(x => x.player_id), ...Object.values(FOOT_SEASON_SQUADS).flat()]);
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
    setRatings((rt || []).map(x => ({
      ...x,
      score: Number(x.score)
    })));
    return ph || [];
  }

  // Opening screen: loads everything the three main pages need (calendar data, player pictures, fonts and backgrounds)
  // so nothing pops in afterwards. The steps tick off for real; the screen stays at least MIN_MS so it never flashes.
  const [steps, setSteps] = React.useState({
    calendar: false,
    rankings: false,
    stats: false
  });
  const [leaving, setLeaving] = React.useState(false);
  const [splashOn, setSplashOn] = React.useState(true);
  React.useEffect(() => {
    let alive = true;
    const MIN_MS = 1500,
      started = Date.now();
    const tick = k => alive && setSteps(o => ({
      ...o,
      [k]: true
    }));
    const withTimeout = (p, ms) => Promise.race([p, new Promise(res => setTimeout(res, ms))]);
    const preload = url => new Promise(res => {
      const im = new Image();
      im.onload = im.onerror = () => res();
      im.src = url;
    });
    (async () => {
      let photoRows = [];
      try {
        photoRows = await reloadFoot();
      } catch (err) {
        console.warn("foot load failed", err);
        if (alive) setLoadError(err.message);
      }
      tick("calendar");
      const faces = photoRows.filter(x => x.kind === "render").map(x => instaPublicUrl(x.path));
      await withTimeout(Promise.all(faces.map(preload)), 5000);
      tick("rankings");
      const bgs = ["/assets/foot/bg-green.jpg?v=crt1", "/assets/foot/bg-pink.jpg?v=crt1", "/logo-bl.png", "/logo-bl-rose.png"];
      await withTimeout(Promise.all([document.fonts ? document.fonts.ready : null, ...bgs.map(preload)]), 4000);
      tick("stats");
      await new Promise(res => setTimeout(res, Math.max(350, MIN_MS - (Date.now() - started))));
      if (!alive) return;
      setLoaded(true);
      setLeaving(true);
      setTimeout(() => alive && setSplashOn(false), 450);
    })();
    return () => {
      alive = false;
    };
  }, []);
  function nav(p, s = {}) {
    setPage(p);
    setSub(s);
    window.scrollTo && window.scrollTo(0, 0);
  }
  const navItems = [{
    id: "calendar",
    label: "Calendrier",
    icon: "calendar"
  }, {
    id: "rankings",
    label: "Classement",
    icon: "trophy"
  }, roomOn ? {
    id: "vestiaire",
    label: "Vestiaire",
    icon: "shirt"
  } : {
    id: "stats",
    label: "Stats",
    icon: "chart"
  }];
  const settingsItems = [...(isAdmin ? [{
    id: "reseaux",
    label: "Réseaux",
    icon: "megaphone",
    on: page === "reseaux",
    onClick: () => nav("reseaux")
  }, {
    id: "admin",
    label: "Admin",
    icon: "sliders",
    on: page === "admin",
    onClick: () => nav("admin")
  }] : []), {
    id: "room",
    label: roomOn ? "Pages classiques" : "Vestiaire 3D",
    icon: "cube",
    onClick: () => setRoom(!roomOn)
  }, {
    id: "refresh",
    label: "Actualiser",
    icon: "refresh",
    onClick: () => window.location.reload()
  }];
  const detail = page === "matchDetail";
  const playerPage = page === "player";
  const openPlayer = id => nav("player", {
    playerId: id,
    from: {
      page: playerPage ? sub.from.page : page,
      sub: playerPage ? sub.from.sub : sub
    }
  });
  const backFromPlayer = () => nav(sub.from ? sub.from.page : roomOn ? "vestiaire" : "stats", sub.from ? sub.from.sub : {});
  const roomVisible = roomOn && loaded && !!FOOT_ROOM_ZONES[page];
  const openMatch = detail ? matches.find(m => m.id === sub.matchId) : null;
  const [title, subtitle] = playerPage ? [footNameOf(sub.playerId), "Stats du joueur"] : detail ? [openMatch ? {
    scheduled: "Match",
    live: "En direct",
    finished: "Résultat"
  }[openMatch.status] : "Match", openMatch ? `vs ${openMatch.opponent_name}` : null] : FOOT_PAGE_TITLES[page] || ["Foot", null];
  return /*#__PURE__*/React.createElement(FootCtx.Provider, {
    value: {
      photos,
      framings,
      themeName: theme,
      openPlayer
    }
  }, roomOn && loaded && /*#__PURE__*/React.createElement(FootRoomScreen, {
    visible: roomVisible,
    page: page,
    theme: theme,
    onHome: onBack,
    onLeaveRoom: () => setRoom(false),
    settings: settingsItems,
    roster: roster,
    attendance: attendance,
    reload: reloadFoot,
    matches: matches,
    events: events,
    lineups: lineups,
    ratings: ratings,
    motmVotes: motmVotes,
    currentPlayer: currentPlayer,
    nav: nav,
    openPlayer: openPlayer
  }), !roomVisible && /*#__PURE__*/React.createElement(FootShell, {
    wide: page === "stats" || page === "reseaux" || playerPage
  }, /*#__PURE__*/React.createElement(FTopBar, {
    title: title,
    subtitle: subtitle,
    theme: theme,
    onHome: onBack,
    onBack: detail ? () => nav("calendar") : playerPage ? backFromPlayer : undefined,
    right: /*#__PURE__*/React.createElement(FSettingsMenu, {
      items: settingsItems
    })
  }), loaded && loadError && /*#__PURE__*/React.createElement(FMessage, null, "Chargement incomplet : ", loadError), loaded && page === "calendar" && /*#__PURE__*/React.createElement(FootCalendarPage, {
    matches: matches,
    events: events,
    roster: roster,
    attendance: attendance,
    activities: activities,
    activityAttendance: activityAttendance,
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
    motmVotes: motmVotes,
    currentPlayer: currentPlayer,
    navBack: () => nav("calendar"),
    reload: reloadFoot
  }), loaded && page === "admin" && isAdmin && /*#__PURE__*/React.createElement(FootAdminPage, {
    roster: roster,
    activities: activities,
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
    motmVotes: motmVotes,
    roster: roster,
    currentPlayer: currentPlayer
  }), loaded && playerPage && /*#__PURE__*/React.createElement(FootStatsPage, {
    key: sub.playerId,
    matches: matches,
    lineups: lineups,
    events: events,
    ratings: ratings,
    motmVotes: motmVotes,
    roster: roster,
    currentPlayer: currentPlayer,
    subjectId: sub.playerId
  })), /*#__PURE__*/React.createElement(FNav, {
    page: detail ? "calendar" : playerPage ? roomOn ? "vestiaire" : "stats" : page,
    items: navItems,
    onGo: nav
  }), splashOn && /*#__PURE__*/React.createElement(FootSplash, {
    steps: steps,
    leaving: leaving,
    theme: theme
  }));
}
