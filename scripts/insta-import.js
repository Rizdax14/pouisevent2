// scripts/insta-import.js — one-off import of the Drive player photos and jersey numbers.
//
//   node scripts/insta-import.js [--dir <folder>]                       dry run (default): prints the mapping
//   node scripts/insta-import.js --apply --map Juju=<id>,Max=<id>        uploads + registers photos, sets jersey numbers
//
// Folder layout: <dir>/{celebration,dos,render}/{domicile,extérieur}/[retouché ]<Prénom>.png
// Needs SUPABASE_SERVICE_ROLE_KEY in the environment or in .env.local (from `vercel env pull`).
const fs = require("fs");
const path = require("path");

const DEFAULT_DIR = "G:\\My Drive\\leverculsec\\25 26\\PHOTOS Bière Leverculsec\\Canva\\26 27";
const MAX_SIDE = 1600;
const JERSEYS = { louis: "14", nolan: "02", solal: "6", timothee: "100", nathan: "11", samuel: "10", nils: "23", etienne: "28", leandre: "67", thisma: "8", maxime: "27", max: "27", juju: "4", thomas: "25", timo: "100" };
const ALIASES = { max: ["maxime"], maxime: ["max"], timo: ["timothee"], timothee: ["timo"] };

const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

function parseFileName(file) {
  if (!/\.png$/i.test(file)) return null;
  let name = file.replace(/\.png$/i, "").trim();
  const m = name.match(/^retouch[eé]e?[\s_-]*/i);
  if (m) name = name.slice(m[0].length);
  name = name.replace(/[\s_-]+gk$/i, ""); // "Timo GK" = the goalkeeper kit shot of Timo
  return { name: name.trim(), retouched: !!m };
}
function kitFromDir(d) { const n = norm(d); return n === "domicile" ? "domicile" : n === "exterieur" ? "exterieur" : null; }
function kindFromDir(d) { const n = norm(d); return ["render", "celebration", "dos"].includes(n) ? n : null; }
function firstWord(s) { return norm(s).split(/\s+/)[0] || ""; }

// Returns { id } | { ambiguous: [ids] } | { none: true }. Only roster players are candidates; nothing is guessed.
function matchPlayer(fileName, players, rosterIds) {
  const n = norm(fileName);
  const pool = players.filter((p) => rosterIds.includes(p.id));
  const exact = pool.filter((p) => norm(p.display_name) === n);
  if (exact.length === 1) return { id: exact[0].id };
  const wanted = [n, ...(ALIASES[n] || [])];
  const hits = pool.filter((p) => wanted.includes(firstWord(p.name)) || wanted.includes(firstWord(p.display_name)));
  if (hits.length === 1) return { id: hits[0].id };
  if (hits.length > 1) return { ambiguous: hits.map((p) => p.id) };
  return { none: true };
}
function parseMap(s) {
  const out = {};
  for (const part of String(s || "").split(",").filter(Boolean)) {
    const [k, v] = part.split("=");
    if (!/^\d+$/.test(v || "")) throw new Error(`--map invalide : ${part}`);
    out[norm(k)] = Number(v);
  }
  return out;
}
function jerseyFor(name) { return JERSEYS[norm(name)] || null; }
function storagePath(playerId, kit, kind, retouched, stamp) { return `${playerId}/${kit}/${kind}${retouched ? "-retouche" : ""}-${stamp}.png`; }

function scan(dir) {
  const files = [];
  for (const kindDir of fs.readdirSync(dir)) {
    const kind = kindFromDir(kindDir);
    if (!kind || !fs.statSync(path.join(dir, kindDir)).isDirectory()) continue;
    for (const kitDir of fs.readdirSync(path.join(dir, kindDir))) {
      const kit = kitFromDir(kitDir);
      if (!kit) continue;
      const kitPath = path.join(dir, kindDir, kitDir);
      const add = (folder, forceRetouched) => {
        for (const f of fs.readdirSync(folder)) {
          const parsed = parseFileName(f);
          if (parsed) files.push({ ...parsed, retouched: parsed.retouched || forceRetouched, kind, kit, file: path.join(folder, f) });
        }
      };
      add(kitPath, false);
      for (const sub of fs.readdirSync(kitPath)) {
        if (norm(sub) === "retouche" && fs.statSync(path.join(kitPath, sub)).isDirectory()) add(path.join(kitPath, sub), true);
      }
    }
  }
  return files;
}

function loadEnvLocal() {
  try {
    for (const line of fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  } catch (e) { /* no .env.local */ }
}

async function main(argv) {
  const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const apply = argv.includes("--apply");
  const dir = arg("--dir") || DEFAULT_DIR;
  const overrides = parseMap(arg("--map"));
  loadEnvLocal();
  const { sbGet, sbWrite, authHeaders, SUPABASE_URL } = require("../lib/insta/supabase");
  const sharp = require("sharp");

  const files = scan(dir);
  const [players, roster] = await Promise.all([sbGet("players", "?select=id,name,display_name"), sbGet("foot_roster", "?select=player_id,jersey_number")]);
  const rosterIds = roster.map((r) => r.player_id);
  const byName = new Map();
  for (const f of files) {
    const key = norm(f.name);
    if (!byName.has(key)) byName.set(key, { name: f.name, result: overrides[key] ? { id: overrides[key] } : matchPlayer(f.name, players, rosterIds) });
  }
  const label = (id) => { const p = players.find((x) => x.id === id); return p ? `${p.name}${p.display_name ? ` (${p.display_name})` : ""} #${id}` : `#${id}`; };
  console.log(`${files.length} fichier(s) dans ${dir}\n`);
  console.log("Prénom (fichier) → joueur | n° maillot");
  const unmatched = [];
  for (const { name, result } of byName.values()) {
    if (result.id) console.log(`  ${name} → ${label(result.id)} | ${jerseyFor(name) || "—"}`);
    else { unmatched.push(name); console.log(`  ${name} → ${result.ambiguous ? `AMBIGU : ${result.ambiguous.map(label).join(" / ")}` : "AUCUN joueur de l'effectif"}`); }
  }
  if (unmatched.length) console.log(`\nNon résolus : ${unmatched.join(", ")} — relancer avec --map ${unmatched.map((n) => `${n}=<id>`).join(",")}`);
  if (!apply) { console.log("\n(dry-run : rien n'a été écrit)"); return; }
  if (unmatched.length) throw new Error("Des prénoms ne sont pas résolus : --apply refusé.");

  let n = 0;
  for (const f of files) {
    const playerId = byName.get(norm(f.name)).result.id;
    const { data, info } = await sharp(f.file).resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true });
    const p = storagePath(playerId, f.kit, f.kind, f.retouched, Date.now() + n++);
    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/player-photos/${p}`, { method: "POST", headers: { ...authHeaders(), "Content-Type": "image/png", "x-upsert": "true" }, body: data });
    if (!up.ok) throw new Error(`Upload ${p} : ${up.status} ${await up.text()}`);
    const [old] = await sbGet("foot_player_photos", `?player_id=eq.${playerId}&kit=eq.${f.kit}&kind=eq.${f.kind}&retouched=eq.${f.retouched}&select=id,path`);
    await sbWrite("POST", "foot_player_photos", "?on_conflict=player_id,kit,kind,retouched", { player_id: playerId, kit: f.kit, kind: f.kind, retouched: f.retouched, path: p, width: info.width, height: info.height, updated_at: new Date().toISOString() });
    if (old && old.path !== p) await sbWrite("DELETE", "foot_photo_framings", `?photo_id=eq.${old.id}`);
    console.log(`  ✓ ${path.basename(f.file)} → ${p}`);
  }
  for (const { name, result } of byName.values()) {
    const num = jerseyFor(name);
    if (num) { await sbWrite("PATCH", "foot_roster", `?player_id=eq.${result.id}`, { jersey_number: num }); console.log(`  ✓ n° ${num} → ${label(result.id)}`); }
  }
}

if (require.main === module) main(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exit(1); });
module.exports = { norm, parseFileName, kitFromDir, kindFromDir, matchPlayer, parseMap, jerseyFor, storagePath, scan };
