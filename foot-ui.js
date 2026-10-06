function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// foot-ui.jsx — design system of the football app: the Instagram visual identity (Shrikhand + Contrail One,
// white rounded cards with hard shadows, textured green / pink backgrounds) as reusable pieces.

// ---- live colour tokens (rewritten by setFootTheme before each render) ----------------------------------
const FC = {};
const FF = {
  display: "'Shrikhand',cursive",
  ui: "'Contrail One','Outfit',sans-serif",
  body: "'Outfit',sans-serif"
};
let FOOT_THEME_NAME = "green";
function setFootTheme(name) {
  const t = themeFor(name);
  FOOT_THEME_NAME = FOOT_THEMES[name] ? name : "green";
  Object.assign(FC, {
    accent: t.accent,
    deep: t.deep,
    soft: t.soft,
    softer: t.softer,
    line: t.line,
    text: t.text,
    muted: t.muted,
    good: t.good,
    bad: t.bad,
    warn: t.warn,
    bgImage: t.bgImage,
    bgColor: t.bgColor,
    bgTint: t.bgTint,
    card: "rgba(255,255,255,0.95)",
    solid: "#ffffff",
    onAccent: "#ffffff",
    accentSoft: withAlpha(t.accent, 0.12),
    goodSoft: withAlpha(t.good, 0.12),
    badSoft: withAlpha(t.bad, 0.1),
    warnSoft: withAlpha(t.warn, 0.12),
    shadow: "0 5px 0 rgba(0,0,0,0.16), 0 14px 28px rgba(0,0,0,0.12)",
    shadowSm: "0 3px 0 rgba(0,0,0,0.14)"
  });
}
setFootTheme("green");

// Style objects that must follow the theme (they are read at render time, not at load time).
function liveStyle(make) {
  const o = {};
  for (const k of Object.keys(make())) Object.defineProperty(o, k, {
    enumerable: true,
    get: () => make()[k]
  });
  return o;
}
const FootCtx = React.createContext({
  photos: [],
  framings: [],
  themeName: "green",
  openPlayer: null
});

// ---- icons ----------------------------------------------------------------------------------------------
const FOOT_ICONS = {
  home: "M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V11z",
  calendar: "M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  trophy: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3",
  chart: "M4 20V10M10 20V4M16 20v-8M22 20H2",
  megaphone: "M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11",
  refresh: "M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5",
  sliders: "M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4",
  back: "M15 5l-7 7 7 7",
  plus: "M12 5v14M5 12h14",
  clock: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  user: "M20 21v-1a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  pencil: "M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  check: "M5 12l5 5 9-10",
  x: "M6 6l12 12M18 6L6 18",
  pin: "M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  clock: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  ball: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8l3.2 2.3-1.2 3.7h-4l-1.2-3.7L12 8zM12 3v5M5.2 8.5l3.6 1.8M18.8 8.5l-3.6 1.8M8 19l2-5M16 19l-2-5",
  users: "M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 20v-1a4 4 0 0 0-3-3.9M16 4.2a3.5 3.5 0 0 1 0 6.6",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z",
  photo: "M4 7h3l2-2h6l2 2h3v12H4V7zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  send: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  play: "M7 4l13 8-13 8V4z",
  pause: "M8 5v14M16 5v14",
  flag: "M5 21V4M5 4h12l-2 4 2 4H5",
  chevron: "M9 6l6 6-6 6"
};
function FIcon({
  name,
  size = 20,
  stroke = 2,
  style
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    style: {
      flexShrink: 0,
      ...style
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: FOOT_ICONS[name] || ""
  }));
}

// ---- base pieces ----------------------------------------------------------------------------------------
// Page / big titles sit on the textured background: white Shrikhand with a soft drop shadow, like the visuals.
function FTitle({
  children,
  size = 34,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.display,
      fontSize: size,
      lineHeight: 1.15,
      color: "#fff",
      textShadow: "3px 4px 0 rgba(0,0,0,0.18)",
      ...style
    }
  }, children);
}
function FCard({
  children,
  style,
  onClick,
  pad = 16,
  tone,
  as
}) {
  const base = {
    background: tone === "soft" ? FC.soft : FC.card,
    borderRadius: 24,
    padding: pad,
    boxShadow: tone === "flat" ? "none" : FC.shadow,
    color: FC.text,
    fontFamily: FF.body,
    marginBottom: 14,
    border: tone === "flat" ? `1px solid ${FC.line}` : "none",
    position: "relative",
    ...style
  };
  const Tag = as || "div";
  if (onClick) return /*#__PURE__*/React.createElement(Tag, {
    onClick: onClick,
    role: "button",
    tabIndex: 0,
    onKeyDown: e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onClick(e)),
    style: {
      ...base,
      cursor: "pointer"
    }
  }, children);
  return /*#__PURE__*/React.createElement(Tag, {
    style: base
  }, children);
}

// Heading of a card: Shrikhand in the theme's deep colour, with an optional element on the right.
function FHeading({
  children,
  right,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 12,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.display,
      fontSize: 19,
      lineHeight: 1.2,
      color: FC.deep
    }
  }, children), right);
}
function FLabel({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.ui,
      fontSize: 12,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: FC.muted,
      marginBottom: 6,
      ...style
    }
  }, children);
}
const CHIP_TONES = () => ({
  accent: [FC.accent, "#fff"],
  soft: [FC.soft, FC.deep],
  good: [FC.goodSoft, FC.good],
  bad: [FC.badSoft, FC.bad],
  warn: [FC.warnSoft, FC.warn],
  live: [FC.bad, "#fff"],
  plain: ["transparent", FC.muted]
});
function FChip({
  children,
  tone = "soft",
  icon,
  style
}) {
  const [bg, fg] = CHIP_TONES()[tone] || CHIP_TONES().soft;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      background: bg,
      color: fg,
      fontFamily: FF.ui,
      fontSize: 12,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      padding: "4px 10px",
      borderRadius: 999,
      whiteSpace: "nowrap",
      border: tone === "plain" ? `1px solid ${FC.line}` : "none",
      ...style
    }
  }, tone === "live" && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: 4,
      background: "#fff",
      animation: "ftpulse 1.2s ease-in-out infinite"
    }
  }), icon && /*#__PURE__*/React.createElement(FIcon, {
    name: icon,
    size: 13
  }), children);
}

// Buttons are pills with a hard shadow, like the chips of the visuals. Variants: primary, secondary, ghost, danger, success.
function FBtn({
  variant = "primary",
  size = "md",
  icon,
  children,
  style,
  full,
  ...rest
}) {
  const sizes = {
    sm: {
      padding: "7px 14px",
      fontSize: 13,
      minHeight: 34
    },
    md: {
      padding: "11px 20px",
      fontSize: 15,
      minHeight: 44
    },
    lg: {
      padding: "14px 24px",
      fontSize: 17,
      minHeight: 52
    }
  };
  const variants = {
    primary: {
      background: FC.accent,
      color: "#fff",
      border: "none",
      boxShadow: `0 3px 0 ${FC.deep}`
    },
    secondary: {
      background: FC.soft,
      color: FC.deep,
      border: "none",
      boxShadow: "none"
    },
    ghost: {
      background: "transparent",
      color: FC.deep,
      border: `1.5px solid ${FC.line}`,
      boxShadow: "none"
    },
    danger: {
      background: FC.bad,
      color: "#fff",
      border: "none",
      boxShadow: "0 3px 0 rgba(0,0,0,0.25)"
    },
    success: {
      background: FC.good,
      color: "#fff",
      border: "none",
      boxShadow: "0 3px 0 rgba(0,0,0,0.25)"
    }
  };
  return /*#__PURE__*/React.createElement("button", _extends({}, rest, {
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      fontFamily: FF.ui,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      borderRadius: 999,
      cursor: rest.disabled ? "default" : "pointer",
      opacity: rest.disabled ? 0.55 : 1,
      width: full ? "100%" : undefined,
      transition: "transform .08s",
      ...sizes[size],
      ...variants[variant],
      ...style
    }
  }), icon && /*#__PURE__*/React.createElement(FIcon, {
    name: icon,
    size: size === "sm" ? 15 : 18
  }), children);
}
function FIconBtn({
  icon,
  label,
  onClick,
  tone = "ghost",
  disabled,
  style
}) {
  const bg = {
    ghost: "transparent",
    soft: FC.soft,
    danger: FC.badSoft,
    glass: "rgba(255,255,255,0.92)"
  }[tone];
  const fg = {
    ghost: FC.deep,
    soft: FC.deep,
    danger: FC.bad,
    glass: FC.deep
  }[tone];
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    disabled: disabled,
    title: label,
    "aria-label": label,
    style: {
      width: 38,
      height: 38,
      borderRadius: 19,
      border: "none",
      background: bg,
      color: fg,
      cursor: disabled ? "default" : "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      opacity: disabled ? 0.5 : 1,
      boxShadow: tone === "glass" ? FC.shadowSm : "none",
      ...style
    }
  }, /*#__PURE__*/React.createElement(FIcon, {
    name: icon,
    size: 18
  }));
}

// Form controls (16px on purpose: smaller text makes iOS zoom into the page when a field is focused).
const FIELD_STYLE = liveStyle(() => ({
  width: "100%",
  background: FC.solid,
  border: `1.5px solid ${FC.line}`,
  borderRadius: 14,
  padding: "11px 14px",
  color: FC.text,
  fontSize: 16,
  fontFamily: FF.body,
  marginBottom: 12,
  minHeight: 46
}));
const FOOT_INPUT_STYLE = FIELD_STYLE;
const FOOT_SELECT_STYLE = liveStyle(() => ({
  background: FC.solid,
  border: `1.5px solid ${FC.line}`,
  borderRadius: 12,
  color: FC.text,
  padding: "8px 12px",
  fontSize: 15,
  fontFamily: FF.body,
  minHeight: 40
}));
function FField({
  label,
  children,
  hint,
  style
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "block",
      marginBottom: 12,
      ...style
    }
  }, label && /*#__PURE__*/React.createElement(FLabel, {
    style: {
      marginBottom: 4
    }
  }, label), children, hint && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: FC.muted,
      marginTop: 4
    }
  }, hint));
}

// Segmented control (tabs, filters).
function FSegmented({
  value,
  options,
  onChange,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    style: {
      display: "flex",
      gap: 4,
      background: FC.soft,
      borderRadius: 999,
      padding: 4,
      ...style
    }
  }, options.map(([id, label, icon]) => {
    const on = value === id;
    return /*#__PURE__*/React.createElement("button", {
      key: id,
      role: "tab",
      "aria-selected": on,
      onClick: () => onChange(id),
      style: {
        flex: 1,
        minWidth: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        border: "none",
        borderRadius: 999,
        padding: "9px 10px",
        background: on ? FC.accent : "transparent",
        color: on ? "#fff" : FC.deep,
        fontFamily: FF.ui,
        fontSize: 14,
        letterSpacing: "0.03em",
        textTransform: "uppercase",
        cursor: "pointer",
        boxShadow: on ? `0 2px 0 ${FC.deep}` : "none",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, icon && /*#__PURE__*/React.createElement(FIcon, {
      name: icon,
      size: 15
    }), label);
  }));
}
function FEmpty({
  icon = "ball",
  title,
  text,
  action
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "28px 12px",
      color: FC.muted
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 54,
      height: 54,
      borderRadius: 27,
      background: FC.soft,
      color: FC.deep,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(FIcon, {
    name: icon,
    size: 26
  })), title && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FF.display,
      fontSize: 18,
      color: FC.deep,
      marginBottom: 4
    }
  }, title), text && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      lineHeight: 1.45
    }
  }, text), action && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, action));
}
function FMessage({
  tone = "bad",
  children,
  style
}) {
  const [bg, fg] = {
    bad: [FC.badSoft, FC.bad],
    good: [FC.goodSoft, FC.good],
    warn: [FC.warnSoft, FC.warn]
  }[tone];
  return /*#__PURE__*/React.createElement("div", {
    role: tone === "bad" ? "alert" : "status",
    style: {
      background: bg,
      color: fg,
      borderRadius: 14,
      padding: "9px 12px",
      fontSize: 13,
      fontWeight: 600,
      marginBottom: 10,
      ...style
    }
  }, children);
}
function FSkeleton({
  h = 90
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: h,
      borderRadius: 24,
      background: "rgba(255,255,255,0.55)",
      marginBottom: 14,
      animation: "ftpulse 1.4s ease-in-out infinite"
    }
  });
}

// ---- players ---------------------------------------------------------------------------------------------
// Round portrait: the "render" photo cropped exactly like the Instagram circle (its saved framing), initials otherwise.
// Tap a name or a portrait to open that player's stats page (when the app provides openPlayer).
function FPlayerLink({
  id,
  children,
  style
}) {
  const {
    openPlayer
  } = React.useContext(FootCtx);
  if (!id || !openPlayer) return /*#__PURE__*/React.createElement("span", {
    style: style
  }, children);
  return /*#__PURE__*/React.createElement("span", {
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
    "aria-label": `Voir les stats de ${footNameOf(id)}`,
    style: {
      cursor: "pointer",
      ...style
    }
  }, children);
}
function FAvatar({
  playerId,
  name,
  size = 36,
  ring,
  linkable
}) {
  const {
    photos,
    framings,
    themeName
  } = React.useContext(FootCtx);
  const inner = FAvatarInner({
    playerId,
    name,
    size,
    ring,
    photos,
    framings,
    themeName
  });
  return linkable && playerId ? /*#__PURE__*/React.createElement(FPlayerLink, {
    id: playerId,
    style: {
      display: "inline-flex",
      verticalAlign: "middle",
      flexShrink: 0
    }
  }, inner) : inner;
}
function FAvatarInner({
  playerId,
  name,
  size,
  ring,
  photos,
  framings,
  themeName
}) {
  const kit = themeName === "pink" ? "exterieur" : "domicile";
  const ph = playerId ? photoOrDefault(photos, playerId, "render", kit) : null;
  const common = {
    display: "inline-block",
    verticalAlign: "middle",
    width: size,
    height: size,
    borderRadius: size / 2,
    flexShrink: 0,
    overflow: "hidden",
    position: "relative",
    background: FC.soft,
    boxShadow: ring ? `0 0 0 3px ${ring}` : "none"
  };
  if (ph) {
    const r = framedRect("render", ph, savedFraming(framings || [], ph.id, "render")); // in the 300px render canvas
    const k = size / 300;
    return /*#__PURE__*/React.createElement("span", {
      style: common
    }, /*#__PURE__*/React.createElement("img", {
      src: instaPublicUrl(ph.path),
      alt: "",
      loading: "lazy",
      draggable: false,
      style: {
        position: "absolute",
        left: r.x * k,
        top: r.y * k,
        width: r.width * k,
        height: r.height * k,
        maxWidth: "none"
      }
    }));
  }
  return /*#__PURE__*/React.createElement("span", {
    style: {
      ...common,
      display: "inline-flex",
      verticalAlign: "middle",
      alignItems: "center",
      justifyContent: "center",
      background: FC.accent,
      color: "#fff",
      fontFamily: FF.display,
      fontSize: Math.round(size * 0.4)
    }
  }, playerInitials(name));
}

// ---- shell -----------------------------------------------------------------------------------------------
function footGlobalCss() {
  return `
    .ft, .ft * { box-sizing: border-box; }
    .ft button { font-family: inherit; -webkit-tap-highlight-color: transparent; }
    .ft button:not(:disabled):active { transform: translateY(2px); }
    .ft input:focus-visible, .ft select:focus-visible, .ft textarea:focus-visible, .ft button:focus-visible, .ft [role=button]:focus-visible { outline: 3px solid ${FC.accent}; outline-offset: 2px; }
    .ft select { appearance: none; -webkit-appearance: none; padding-right: 34px !important; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23${FC.deep.slice(1)}' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><path d='M6 9l6 6 6-6'/></svg>"); background-repeat: no-repeat; background-position: right 12px center; }
    .ft input[type=date], .ft input[type=time], .ft input[type=datetime-local] { -webkit-appearance: none; appearance: none; display: block; width: 100%; min-width: 0; max-width: 100%; min-height: 52px; text-align: left; }
    .ft input[type=date]::-webkit-date-and-time-value, .ft input[type=time]::-webkit-date-and-time-value, .ft input[type=datetime-local]::-webkit-date-and-time-value { text-align: left; min-height: 1.4em; }
    .ft input[type=checkbox] { accent-color: ${FC.accent}; width: 20px; height: 20px; }
    .ft input[type=range] { accent-color: ${FC.accent}; }
    .ft a { color: ${FC.deep}; }
    @keyframes ftpulse { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
    @keyframes ftrise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
    .ft-page { animation: ftrise .22s ease-out; }
    @media (prefers-reduced-motion: reduce) { .ft *, .ft-page { animation: none !important; transition: none !important; } }
  `;
}

// Textured background + centred column. Everything of the football app lives inside.
// The texture is its own fixed layer (background-attachment: fixed is unreliable on iOS).
function FootShell({
  children,
  wide
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "ft",
    style: {
      position: "relative",
      minHeight: "100vh",
      color: FC.text,
      fontFamily: FF.body,
      background: FC.bgColor
    }
  }, /*#__PURE__*/React.createElement("style", null, footGlobalCss()), /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 0,
      backgroundColor: FC.bgTint,
      backgroundImage: `url(${FC.bgImage})`,
      backgroundPosition: "center top",
      backgroundSize: "cover",
      backgroundRepeat: "no-repeat",
      backgroundBlendMode: "multiply"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      zIndex: 1,
      maxWidth: wide ? 920 : 620,
      margin: "0 auto",
      padding: "14px 16px calc(112px + env(safe-area-inset-bottom))"
    }
  }, children));
}

// Green / pink switch.
function FThemeSwitch({
  value,
  onChange
}) {
  const dot = (name, color) => /*#__PURE__*/React.createElement("button", {
    key: name,
    onClick: () => onChange(name),
    "aria-label": `Thème ${FOOT_THEMES[name].label.toLowerCase()}`,
    "aria-pressed": value === name,
    style: {
      width: 30,
      height: 30,
      borderRadius: 15,
      border: value === name ? "3px solid #fff" : "3px solid transparent",
      background: color,
      cursor: "pointer",
      boxShadow: value === name ? `0 0 0 2px ${color}` : "none",
      padding: 0
    }
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      gap: 6,
      background: "rgba(255,255,255,0.92)",
      borderRadius: 999,
      padding: 5,
      boxShadow: FC.shadowSm
    }
  }, dot("green", FOOT_THEMES.green.accent), dot("pink", FOOT_THEMES.pink.accent));
}
function FTopBar({
  title,
  subtitle,
  onHome,
  onBack,
  theme,
  onTheme,
  right
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 10
    }
  }, onBack ? /*#__PURE__*/React.createElement(FIconBtn, {
    icon: "back",
    label: "Retour",
    tone: "glass",
    onClick: onBack
  }) : /*#__PURE__*/React.createElement(FIconBtn, {
    icon: "home",
    label: "Retour \xE0 l'accueil",
    tone: "glass",
    onClick: onHome
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, right, /*#__PURE__*/React.createElement(FThemeSwitch, {
    value: theme,
    onChange: onTheme
  }))), /*#__PURE__*/React.createElement(FTitle, null, title), subtitle && /*#__PURE__*/React.createElement("div", {
    style: {
      color: "rgba(255,255,255,0.92)",
      fontFamily: FF.ui,
      fontSize: 15,
      letterSpacing: "0.03em",
      marginTop: 2,
      textShadow: "1px 2px 0 rgba(0,0,0,0.18)"
    }
  }, subtitle));
}

// Floating bottom bar.
function FNav({
  page,
  items,
  onGo
}) {
  return /*#__PURE__*/React.createElement("nav", {
    "aria-label": "Navigation du module foot",
    style: {
      position: "fixed",
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 100,
      display: "flex",
      justifyContent: "center",
      padding: "0 12px calc(12px + env(safe-area-inset-bottom))",
      pointerEvents: "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      pointerEvents: "auto",
      display: "flex",
      gap: 2,
      width: "100%",
      maxWidth: 560,
      background: "rgba(255,255,255,0.97)",
      borderRadius: 30,
      padding: 6,
      boxShadow: "0 6px 0 rgba(0,0,0,0.16), 0 16px 34px rgba(0,0,0,0.22)"
    }
  }, items.map(it => {
    const on = page === it.id;
    return /*#__PURE__*/React.createElement("button", {
      key: it.id,
      onClick: () => onGo(it.id),
      "aria-current": on ? "page" : undefined,
      style: {
        flex: 1,
        minWidth: 0,
        border: "none",
        borderRadius: 24,
        padding: "8px 2px 7px",
        background: on ? FC.accent : "transparent",
        color: on ? "#fff" : FC.muted,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        cursor: "pointer",
        boxShadow: on ? `0 3px 0 ${FC.deep}` : "none"
      }
    }, /*#__PURE__*/React.createElement(FIcon, {
      name: it.icon,
      size: 21,
      stroke: on ? 2.4 : 2
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: FF.ui,
        fontSize: "clamp(9px, 2.6vw, 11px)",
        letterSpacing: 0,
        textTransform: "uppercase",
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, it.label));
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => window.location.reload(),
    "aria-label": "Actualiser la page",
    style: {
      flex: "0 0 auto",
      width: 44,
      border: "none",
      borderRadius: 24,
      padding: "8px 2px 7px",
      background: "transparent",
      color: FC.muted,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 2,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(FIcon, {
    name: "refresh",
    size: 21
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: FF.ui,
      fontSize: 11,
      letterSpacing: "0.03em",
      textTransform: "uppercase"
    }
  }, "Actu."))));
}
