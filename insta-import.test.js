const test = require("node:test");
const assert = require("node:assert/strict");
const I = require("./scripts/insta-import.js");

test("parseFileName: retouched prefix, accents, extension", () => {
  assert.deepEqual(I.parseFileName("Louis.png"), { name: "Louis", retouched: false });
  assert.deepEqual(I.parseFileName("retouché Timothée.png"), { name: "Timothée", retouched: true });
  assert.deepEqual(I.parseFileName("Retouché-Juju.PNG"), { name: "Juju", retouched: true });
  assert.deepEqual(I.parseFileName("retouchéNolan.png"), { name: "Nolan", retouched: true });
  assert.equal(I.parseFileName("notes.txt"), null);
});

test("norm: case and accent insensitive", () => {
  assert.equal(I.norm("  Timothée "), "timothee");
  assert.equal(I.norm("LÉANDRE"), "leandre");
});

test("kitFromDir / kindFromDir accept extérieur with or without accent", () => {
  assert.equal(I.kitFromDir("extérieur"), "exterieur");
  assert.equal(I.kitFromDir("Exterieur"), "exterieur");
  assert.equal(I.kitFromDir("domicile"), "domicile");
  assert.equal(I.kitFromDir("autre"), null);
  assert.equal(I.kindFromDir("celebration"), "celebration");
  assert.equal(I.kindFromDir("Dos"), "dos");
  assert.equal(I.kindFromDir("x"), null);
});

const players = [
  { id: 1, name: "Louis Marcoux", display_name: "Louis" },
  { id: 2, name: "Nolan Dupont", display_name: null },
  { id: 3, name: "Maxime Durand", display_name: "Max" },
  { id: 4, name: "Thomas Petit", display_name: "Thomas P" },
  { id: 5, name: "Thomas Grand", display_name: "Thomas G" },
  { id: 6, name: "Julien Roux", display_name: "Juju" },
  { id: 7, name: "Étienne Lac", display_name: null },
];

test("matchPlayer: first name, display name or alias, accent-insensitive", () => {
  assert.deepEqual(I.matchPlayer("Louis", players, [1, 2, 3, 4, 5, 6, 7]), { id: 1 });
  assert.deepEqual(I.matchPlayer("etienne", players, [7]), { id: 7 });
  assert.deepEqual(I.matchPlayer("Max", players, [3]), { id: 3 });
  assert.deepEqual(I.matchPlayer("Juju", players, [6]), { id: 6 });
});

test("matchPlayer: ambiguous and unknown names are reported, not guessed", () => {
  assert.deepEqual(I.matchPlayer("Thomas", players, [4, 5]), { ambiguous: [4, 5] });
  assert.deepEqual(I.matchPlayer("Inconnu", players, [1]), { none: true });
});

test("matchPlayer only considers roster players", () => {
  assert.deepEqual(I.matchPlayer("Louis", players, [2, 3]), { none: true });
});

test("--map overrides: Juju=6,Max=3", () => {
  assert.deepEqual(I.parseMap("Juju=6,Max=3"), { juju: 6, max: 3 });
  assert.deepEqual(I.parseMap(undefined), {});
  assert.throws(() => I.parseMap("Juju=abc"));
});

test("jerseyFor: numbers from the plan, text kept (leading zero, 3 digits)", () => {
  assert.equal(I.jerseyFor("Nolan"), "02");
  assert.equal(I.jerseyFor("timothée"), "100");
  assert.equal(I.jerseyFor("Max"), "27");
  assert.equal(I.jerseyFor("Maxime"), "27");
  assert.equal(I.jerseyFor("Inconnu"), null);
});

test("storagePath mirrors photo-sign", () => {
  assert.equal(I.storagePath(3, "exterieur", "dos", true, 17), "3/exterieur/dos-retouche-17.png");
  assert.equal(I.storagePath(3, "domicile", "render", false, 17), "3/domicile/render-17.png");
});
