// foot.jsx
function FootballApp({
  currentPlayer,
  onBack
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100vh",
      background: "#080810",
      color: "#eeeef5",
      fontFamily: "'Outfit',sans-serif",
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: {
      background: "none",
      border: "1px solid #1e1e30",
      borderRadius: 8,
      color: "#eeeef5",
      padding: "8px 14px",
      cursor: "pointer"
    }
  }, "\u2190 Retour au menu"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 40,
      textAlign: "center",
      color: "#60607a"
    }
  }, "Module Football \u2014 en construction"));
}
