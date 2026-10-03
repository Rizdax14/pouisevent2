// foot.jsx
function FootballApp({ currentPlayer, onBack }) {
  return (
    <div style={{ minHeight: "100vh", background: "#080810", color: "#eeeef5", fontFamily: "'Outfit',sans-serif", padding: 24 }}>
      <button onClick={onBack} style={{ background: "none", border: "1px solid #1e1e30", borderRadius: 8, color: "#eeeef5", padding: "8px 14px", cursor: "pointer" }}>
        ← Retour au menu
      </button>
      <div style={{ marginTop: 40, textAlign: "center", color: "#60607a" }}>Module Football — en construction</div>
    </div>
  );
}
