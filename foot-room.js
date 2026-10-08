// foot-room.js — the club room behind the Calendrier / Classement / Vestiaire pages.
// One three.js scene (r128, loaded on demand by the page) with three corners the camera travels between:
//   rack  — the shirts of the squad on a rail (the real kits, with each player's real flocage),
//   board — a whiteboard with the rankings, trophies on a shelf,
//   desk  — the coach's desk: next match, the three after it, a month calendar of every match.
// The page owns the data and the readable overlays; this file only draws and reports taps.
(function () {
  "use strict";
  const KIT_BASE = "/assets/vestiaire/";
  const BX = 6.4; // board corner (x)
  const DX = -6.4, DY = -0.28, DZ = 0.28; // desk: papers' reference point (the desk itself runs from the wall to z = 1.38)
  const RAIL_Y = 1.15;
  const SP = 0.19, GAP = 0.62; // rack spacing: side-on shirts, gap around the one in front

  const FONT_MARKER = "'Permanent Marker', 'Comic Sans MS', cursive";
  const FONT_HAND = "'Caveat', 'Comic Sans MS', cursive";
  const FONT_UI = "'Contrail One', 'Outfit', sans-serif";
  const FONT_DISPLAY = "'Shrikhand', cursive";
  const FONT_FLOC = "'Bebas Neue', Impact, sans-serif";

  const ease = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const sm = (e0, e1, q) => { const k = Math.min(1, Math.max(0, (q - e0) / (e1 - e0))); return k * k * (3 - 2 * k); };
  const loadImg = (src) => new Promise((res) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });

  function create(container, opts = {}) {
    const THREE = window.THREE;
    const reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const low = (navigator.deviceMemory || 8) <= 3; // (iPhones report few cores but are fast: only memory counts)
    const HD = low ? 1 : 2; // text surfaces are drawn at twice their layout size, so they stay sharp on retina screens
    const cb = { onShirt: opts.onShirt || (() => {}), onTap: opts.onTap || (() => {}), onReady: opts.onReady || (() => {}), onArrive: opts.onArrive || (() => {}) };

    // ---------- renderer ----------
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(low ? 1.5 : 2.5, window.devicePixelRatio || 1));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.domElement.style.cssText = "display:block;width:100%;height:100%;touch-action:none";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#100c0e");
    scene.fog = new THREE.Fog("#100c0e", 6, 14);
    const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 40);
    // The three corners stand on the sides of a triangle around the room's centre, each facing it: the camera swings
    // from one to another around the centre and never passes in front of the third.
    const R = 3.6, UP = new THREE.Vector3(0, 1, 0);
    const corners = {};
    function corner(name, theta, originX) {
      const outer = new THREE.Group(), inner = new THREE.Group();
      outer.position.copy(new THREE.Vector3(0, 0, -R).applyAxisAngle(UP, theta)); outer.rotation.y = theta;
      inner.position.x = -originX; // the corner's own drawing keeps its x around originX
      outer.add(inner); scene.add(outer);
      corners[name] = { theta, originX };
      return inner;
    }
    const gRack = corner("rack", 0, 0), gBoard = corner("board", (2 * Math.PI) / 3, BX), gDesk = corner("desk", (-2 * Math.PI) / 3, DX);
    // soft studio surroundings, only used for reflections on metal
    const envMap = (function environment() {
      const env = new THREE.Scene();
      env.background = new THREE.Color("#2a2226");
      const panel = (color, w, h, x, y, z, ry, rx = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); env.add(m); };
      panel("#ffffff", 6, 1.2, 0, 4, 0, 0, Math.PI / 2);
      panel("#fff1dc", 3, 3, 5, 1, 0, -Math.PI / 2);
      panel("#d8e0ff", 3, 3, -5, 1, 0, Math.PI / 2);
      panel("#6b4a33", 10, 2, 0, -2, 0, 0, Math.PI / 2);
      const pm = new THREE.PMREMGenerator(renderer);
      const t = pm.fromScene(env, 0.04).texture;
      pm.dispose();
      return t;
    })();
    const finish = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.encoding = THREE.sRGBEncoding; t.anisotropy = renderer.capabilities.getMaxAnisotropy ? Math.min(16, renderer.capabilities.getMaxAnisotropy()) : 4; return t; };
    const canvas2d = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

    // ---------- lights ----------
    scene.add(new THREE.HemisphereLight("#fff2f8", "#2a1d22", 0.3));
    const spot = new THREE.SpotLight("#fff3f8", 1.3, 14, 0.62, 0.8, 1.0);
    spot.position.set(0.5, 3.6, 3.2);
    spot.target.position.set(0, 0.3, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0005; spot.shadow.normalBias = 0.02; spot.shadow.radius = 9; spot.shadow.blurSamples = 16;
    gRack.add(spot, spot.target);
    const fill = new THREE.DirectionalLight("#ffffff", 0.18); fill.position.set(0, 0.8, 4); scene.add(fill);
    const rim = new THREE.DirectionalLight("#e6c6ff", 0.4); rim.position.set(-3, 2, -1); scene.add(rim);
    const boardLight = new THREE.SpotLight("#fffaf0", 1.25, 9, 0.75, 0.7, 1.2);
    boardLight.position.set(BX, 2.9, 2.2); boardLight.target.position.set(BX, 0.5, -0.7); gBoard.add(boardLight, boardLight.target);
    const lamp = new THREE.PointLight("#ffd9a0", 1.1, 4.5, 1.6); lamp.position.set(DX + 0.9, DY + 1.0, DZ - 0.6); gDesk.add(lamp);
    const deskTop = new THREE.SpotLight("#fff6ea", 0.9, 8, 0.8, 0.8, 1.2);
    deskTop.position.set(DX, 2.8, DZ + 1.6); deskTop.target.position.set(DX, DY, DZ + 0.15); gDesk.add(deskTop, deskTop.target);

    // ---------- room ----------
    let aoTex = null;
    function aoBand() { // black → transparent, from the bottom edge up
      if (aoTex) return aoTex;
      const c = canvas2d(4, 128), ctx = c.getContext("2d"), g = ctx.createLinearGradient(0, 128, 0, 0);
      g.addColorStop(0, "rgba(0,0,0,0.55)"); g.addColorStop(0.35, "rgba(0,0,0,0.18)"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 128);
      return (aoTex = finish(c, false));
    }
    function woodTexture(hue = 20, light = 11) {
      const c = canvas2d(1024, 512), ctx = c.getContext("2d");
      let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let x = 0; x < c.width; x += 64) {
        ctx.fillStyle = `hsl(${hue}, 30%, ${light + rnd() * 6}%)`; ctx.fillRect(x, 0, 64, c.height);
        ctx.globalAlpha = 0.12;
        for (let i = 0; i < 26; i++) {
          ctx.strokeStyle = rnd() > 0.5 ? "#000" : "#6b4a33"; ctx.lineWidth = 1 + rnd() * 2;
          const gx = x + rnd() * 64;
          ctx.beginPath(); ctx.moveTo(gx, 0); ctx.bezierCurveTo(gx + 6, 170, gx - 6, 340, gx + 3, 512); ctx.stroke();
        }
        ctx.globalAlpha = 1; ctx.fillStyle = "rgba(0,0,0,0.65)"; ctx.fillRect(x, 0, 3, c.height);
      }
      const t = finish(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
    }
    const wood = woodTexture(); wood.repeat.set(6, 1);
    const WALL_W = 2 * Math.sqrt(3) * (R + 0.75); // the three walls close an equilateral triangle around the centre
    const wallMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.85 });
    const wallGeo = new THREE.PlaneGeometry(WALL_W, 5);
    for (const [g, x] of [[gRack, 0], [gBoard, BX], [gDesk, DX]]) {
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(x, 0.8, -0.75); wall.receiveShadow = true; g.add(wall);
      // where the wall meets the floor it gets darker (a soft band instead of computed ambient occlusion)
      const band = new THREE.Mesh(new THREE.PlaneGeometry(WALL_W, 0.9), new THREE.MeshBasicMaterial({ map: aoBand(), transparent: true, depthWrite: false }));
      band.position.set(x, -0.35, -0.745); g.add(band);
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(WALL_W, 1.1), new THREE.MeshBasicMaterial({ map: aoBand(), transparent: true, depthWrite: false }));
      strip.rotation.x = -Math.PI / 2; strip.position.set(x, -0.797, -0.2); strip.rotation.z = Math.PI; g.add(strip);
    }
    const floorMat = new THREE.MeshStandardMaterial({ map: (() => {
      const c = canvas2d(512, 512), ctx = c.getContext("2d");
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { ctx.fillStyle = (x + y) % 2 ? "#1d1a1c" : "#232023"; ctx.fillRect(x * 128, y * 128, 128, 128); }
      ctx.strokeStyle = "#0c0a0b"; ctx.lineWidth = 4; for (let k = 0; k <= 4; k++) { ctx.beginPath(); ctx.moveTo(k * 128, 0); ctx.lineTo(k * 128, 512); ctx.moveTo(0, k * 128); ctx.lineTo(512, k * 128); ctx.stroke(); }
      const t = finish(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(9, 9); return t;
    })(), roughness: 0.8 });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 48), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, -0.8, 0); floor.receiveShadow = true;
    const shelfMat = new THREE.MeshStandardMaterial({ color: "#35241b", roughness: 0.7 });
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.06, 0.7), shelfMat); shelf.position.set(0, RAIL_Y + 0.42, -0.4); shelf.castShadow = true;
    const benchWood = woodTexture(24, 16); benchWood.repeat.set(3, 1);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.08, 0.55), new THREE.MeshStandardMaterial({ map: benchWood, roughness: 0.6 }));
    bench.position.set(0, -0.42, -0.35); bench.castShadow = bench.receiveShadow = true;
    const steel = new THREE.MeshStandardMaterial({ color: "#cfc8cc", metalness: 0.9, roughness: 0.28, envMap });
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 8.2, 16), steel); rail.rotation.z = Math.PI / 2; rail.position.y = RAIL_Y;
    scene.add(floor); gRack.add(shelf, bench, rail);

    // Photographic materials (Poly Haven, CC0) replace the drawn ones once downloaded: nothing waits for them.
    const ROOM = "/assets/room/", SUF = low ? "-sm.jpg?v=1" : ".jpg?v=1";
    const baseLoader = new THREE.TextureLoader(), pending = [];
    // every download the room starts is tracked, so warm() can wait for all of them
    const texLoader = { load(url, onLoad, onProgress, onError) { pending.push(new Promise((res) => baseLoader.load(url, (t) => { try { onLoad && onLoad(t); } finally { res(); } }, onProgress, (e) => { try { onError && onError(e); } finally { res(); } }))); } };
    const loadTex = (name, srgb, rx, ry) => new Promise((res) => texLoader.load(ROOM + name + SUF, (t) => {
      if (srgb) t.encoding = THREE.sRGBEncoding;
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 4);
      res(t);
    }, undefined, () => res(null)));
    function pbr(mat, geo, base, rx, ry, extra) {
      Promise.all([loadTex(base + "-diff", true, rx, ry), loadTex(base + "-nor", false, rx, ry), loadTex(base + "-arm", false, rx, ry)]).then(([d, n, a]) => {
        if (!d) return;
        if (geo && !geo.attributes.uv2) geo.setAttribute("uv2", geo.attributes.uv);
        Object.assign(mat, { map: d, normalMap: n, roughnessMap: a, aoMap: geo ? a : null, roughness: 1, ...extra });
        if (n) mat.normalScale.set(0.9, 0.9);
        mat.needsUpdate = true;
      });
    }
    pbr(wallMat, wallGeo, "wall", WALL_W / 2.4, 5 / 2.4, { color: new THREE.Color("#b9a99a") });
    pbr(floorMat, floor.geometry, "floor", 7, 7, { color: new THREE.Color("#8a8a8e") });
    // a real gym, photographed all around, for what metal, glass and varnish reflect
    texLoader.load(ROOM + "env.jpg?v=1", (t) => {
      t.mapping = THREE.EquirectangularReflectionMapping; t.encoding = THREE.sRGBEncoding;
      const pm = new THREE.PMREMGenerator(renderer), env = pm.fromEquirectangular(t).texture; pm.dispose(); t.dispose();
      scene.traverse((o) => { const m = o.material; if (m && m.envMap) { m.envMap = env; m.needsUpdate = true; } });
      for (const m of reflective) { m.envMap = env; m.envMapIntensity = m.userData.envI || 0.6; m.needsUpdate = true; }
      roomEnv = env;
    });
    let roomEnv = null; const reflective = [], tickers = [];

    // ---------- shirts ----------
    const SW = 1.0;
    let SH = 0.864;
    const shirtMat = (map) => new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, alphaToCoverage: true, roughness: 0.78 });
    const depthMat = (map) => new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5 });

    // Both faces share one outline (the back, and the front seen from behind); the shirt is thin fabric over a torso that
    // pinches shut in the last ~2 cm before that outline, so side-on there is no gap and no padded look.
    function shirtGeometry(front, back) {
      const w = 160, h = Math.round(160 * back.height / back.width);
      const c = canvas2d(w, h), ctx = c.getContext("2d");
      ctx.drawImage(back, 0, 0, w, h);
      ctx.save(); ctx.translate(w, 0); ctx.scale(-1, 1); ctx.drawImage(front, 0, 0, w, h); ctx.restore();
      const a = ctx.getImageData(0, 0, w, h).data;
      const d = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) d[i] = a[i * 4 + 3] > 40 ? 1e6 : 0;
      const R2 = Math.SQRT2;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!d[i]) continue;
        d[i] = Math.min(d[i], x > 0 ? d[i - 1] + 1 : 1, y > 0 ? d[i - w] + 1 : 1, x > 0 && y > 0 ? d[i - w - 1] + R2 : 1, x < w - 1 && y > 0 ? d[i - w + 1] + R2 : 1); }
      for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; if (!d[i]) continue;
        d[i] = Math.min(d[i], x < w - 1 ? d[i + 1] + 1 : 1, y < h - 1 ? d[i + w] + 1 : 1, x < w - 1 && y < h - 1 ? d[i + w + 1] + R2 : 1, x > 0 && y < h - 1 ? d[i + w - 1] + R2 : 1); }
      const sample = (u, v) => {
        const fx = Math.min(w - 1.001, Math.max(0, u * w - 0.5)), fy = Math.min(h - 1.001, Math.max(0, v * h - 0.5));
        const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
        const p = d[y0 * w + x0], q = d[y0 * w + x0 + 1], r = d[(y0 + 1) * w + x0], s = d[(y0 + 1) * w + x0 + 1];
        return (p * (1 - tx) + q * tx) * (1 - ty) + (r * (1 - tx) + s * tx) * ty;
      };
      const px = SW / w;
      const g = new THREE.PlaneGeometry(SW, SH, low ? 90 : 130, Math.round((low ? 90 : 130) * SH / SW));
      const pos = g.attributes.position, pinches = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), u = x / SW + 0.5, v = 0.5 - y / SH;
        const dist = Math.max(0, sample(u, v) - 2.5) * px;
        const torso = 1 - sm(0.06, 0.36, Math.abs(x)), top = sm(0.0, 0.3, v);
        const body = 0.06 * torso * top + 0.008 + 0.01 * v * v * torso + 0.005 * Math.sin(x * 38 + v * 3) * Math.max(0, v - 0.35) * torso;
        const t = Math.min(1, dist / 0.025);
        pos.setZ(i, body); pinches[i] = t * t * (3 - 2 * t);
      }
      g.computeVertexNormals();
      for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) * pinches[i]);
      return g;
    }

    // Wooden hanger inside the shirt; only the steel neck and hook come out of the collar (the hook curls over the rail).
    function hanger() {
      const g = new THREE.Group();
      const woodMat = new THREE.MeshStandardMaterial({ color: "#8a6040", roughness: 0.45 });
      const R = 0.03, pts = [];
      for (let k = 0; k <= 24; k++) { const an = -0.35 + (Math.PI + 0.7) * (k / 24); pts.push(new THREE.Vector3(Math.cos(an) * R, Math.sin(an) * R, 0)); }
      const tip = pts[pts.length - 1].clone();
      const neck = new THREE.CatmullRomCurve3([...pts.reverse(), new THREE.Vector3(R * 0.95, -0.03, 0), new THREE.Vector3(0.012, -0.075, -0.004), new THREE.Vector3(0, -0.11, -0.013), new THREE.Vector3(0, -0.19, -0.013)]);
      const hook = new THREE.Mesh(new THREE.TubeGeometry(neck, 60, 0.0055, 8), steel);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 10, 8), steel); cap.position.copy(tip);
      const arm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.22, -0.27, 0), new THREE.Vector3(-0.11, -0.22, 0), new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(0.11, -0.22, 0), new THREE.Vector3(0.22, -0.27, 0),
      ]), 40, 0.008, 10), woodMat);
      hook.castShadow = arm.castShadow = true;
      g.add(hook, cap, arm);
      return g;
    }

    const rack = { kit: null, squad: [], shirts: [], scroll: 0, target: 0, art: null, geo: null, building: 0 };
    let rackBuilt; const rackReady = new Promise((r) => (rackBuilt = r));
    const kitCache = {};
    async function loadKit(kit) {
      if (kitCache[kit]) return kitCache[kit];
      const base = KIT_BASE + kit + "/";
      const [meta, front, back, collar] = await Promise.all([fetch(base + "kit.json?v=4").then((r) => r.json()), loadImg(base + "front.png?v=4"), loadImg(base + "back.png?v=4"), loadImg(base + "collar.png?v=4")]);
      kitCache[kit] = { kit, base, meta, front, back, collar, flocs: {} };
      return kitCache[kit];
    }
    async function flocageFor(K, p) {
      if (K.flocs[p.id] !== undefined) return K.flocs[p.id];
      const f = K.meta.flocages[p.id];
      K.flocs[p.id] = f ? { img: await loadImg(`${K.base}flocages/${p.id}.png?v=4`), x: f.x, y: f.y } : null;
      return K.flocs[p.id];
    }
    // A player the kit file doesn't have yet: name and number typeset on the fly where the others sit.
    function typeset(ctx, K, p) {
      const ref = K.meta.flocages[116] || Object.values(K.meta.flocages)[0];
      const color = K.kit === "home" ? "#09642e" : "#ffffff";
      const cx = K.back.width / 2, top = ref ? ref.y + 4 : K.back.height * 0.2;
      ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.font = `${Math.round(K.back.width * 0.068)}px ${FONT_FLOC}`; ctx.fillText((p.label || p.name || "").toUpperCase(), cx, top);
      ctx.font = `${Math.round(K.back.width * 0.33)}px ${FONT_FLOC}`; ctx.fillText(String(p.num || ""), cx, top + K.back.width * 0.11);
    }
    function clearShirts() {
      for (const s of rack.shirts) {
        gRack.remove(s.group);
        s.backMesh.material.map.dispose(); s.backMesh.material.dispose();
      }
      rack.shirts = [];
    }
    async function buildRack() {
      const token = ++rack.building;
      if (!rack.kit || !rack.squad.length) { clearShirts(); return; }
      const K = await loadKit(rack.kit);
      if (token !== rack.building || !K.front || !K.back) return;
      const flocs = await Promise.all(rack.squad.map((p) => flocageFor(K, p)));
      if (token !== rack.building) return;
      clearShirts();
      SH = SW * K.back.height / K.back.width;
      if (!K.geo) K.geo = shirtGeometry(K.front, K.back);
      if (!K.frontTex) K.frontTex = finish(K.front);
      if (!K.collarTex && K.collar) K.collarTex = finish(K.collar);
      const collarGeo = new THREE.PlaneGeometry(SW, SH);
      const scale = low ? 0.62 : 0.8; // back textures are per player: keep them light on the GPU
      rack.squad.forEach((p, i) => {
        const fm = K.meta.flocages[p.id];
        p.label = fm && !fm.typeset ? fm.label : (p.name || "").toUpperCase();
        if (fm && fm.num != null) p.num = fm.num; // the number worn that season
        const c = canvas2d(Math.round(K.back.width * scale), Math.round(K.back.height * scale)), ctx = c.getContext("2d");
        ctx.scale(scale, scale);
        ctx.drawImage(K.back, 0, 0);
        const f = flocs[i];
        if (f && f.img) ctx.drawImage(f.img, f.x, f.y); else typeset(ctx, K, p);
        const tex = finish(c);
        const group = new THREE.Group();
        const backMesh = new THREE.Mesh(K.geo, shirtMat(tex));
        const frontMesh = new THREE.Mesh(K.geo, shirtMat(K.frontTex));
        frontMesh.rotation.y = Math.PI;
        for (const m of [backMesh, frontMesh]) { m.position.y = -0.12 - SH / 2; m.castShadow = true; m.userData.shirt = i; }
        backMesh.customDepthMaterial = depthMat(tex);
        frontMesh.customDepthMaterial = depthMat(K.frontTex);
        group.add(hanger(), backMesh, frontMesh);
        if (K.collarTex) {
          const inner = new THREE.Mesh(collarGeo, new THREE.MeshStandardMaterial({ map: K.collarTex, alphaTest: 0.5, roughness: 0.9 }));
          inner.rotation.y = Math.PI; inner.position.set(0, -0.12 - SH / 2, -0.002); group.add(inner);
        }
        const d = i - rack.scroll, sign = Math.sign(d) || 0;
        const s = { group, backMesh, frontMesh, x: d * SP + sign * GAP * Math.min(1, Math.abs(d)), z: 0, ry: -sign * 1.45 * Math.min(1, Math.abs(d)), flip: 0, phase: i * 1.7 };
        group.position.set(s.x, RAIL_Y, 0);
        gRack.add(group);
        rack.shirts.push(s);
      });
      cb.onReady("rack");
      rackBuilt();
    }
    function selectShirt(i, instant) {
      i = Math.max(0, Math.min(rack.squad.length - 1, i));
      if (i !== Math.round(rack.target)) rack.shirts.forEach((s) => (s.flip = 0));
      rack.target = i;
      if (instant) rack.scroll = i;
      cb.onShirt(i, rack.squad[i]);
    }

    // ---------- board corner ----------
    const BOARD_W = 1.3, BOARD_H = 1.72, BOARD_Y = 1.02;
    const boardCanvas = canvas2d(1024 * HD, Math.round(1024 * HD * BOARD_H / BOARD_W)); boardCanvas.logical = 1024;
    const boardTex = finish(boardCanvas);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_W, BOARD_H), new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.35, metalness: 0.0 }));
    board.position.set(BX, BOARD_Y, -0.7);
    board.userData.surface = "board";
    const alu = new THREE.MeshStandardMaterial({ color: "#b9bcc2", metalness: 0.8, roughness: 0.35, envMap });
    const frameParts = [
      [BOARD_W + 0.08, 0.04, 0, BOARD_H / 2 + 0.02], [BOARD_W + 0.08, 0.04, 0, -BOARD_H / 2 - 0.02],
      [0.04, BOARD_H + 0.08, BOARD_W / 2 + 0.02, 0], [0.04, BOARD_H + 0.08, -BOARD_W / 2 - 0.02, 0],
    ];
    for (const [w, h, x, y] of frameParts) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), alu); m.position.set(BX + x, BOARD_Y + y, -0.69); gBoard.add(m); }
    const tray = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W * 0.8, 0.02, 0.07), alu); tray.position.set(BX, BOARD_Y - BOARD_H / 2 - 0.05, -0.66);
    gBoard.add(board, tray);
    // markers in the tray
    [["#1b2a8f", -0.25], ["#c0262d", -0.12], ["#151515", 0.02]].forEach(([col, x], k) => {
      const mk = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.13, 12), new THREE.MeshStandardMaterial({ color: col, roughness: 0.5 }));
      mk.rotation.z = Math.PI / 2 + (k - 1) * 0.05; mk.position.set(BX + x, BOARD_Y - BOARD_H / 2 - 0.028, -0.655); gBoard.add(mk);
    });
    // trophy shelf under the board
    const tShelf = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.36), shelfMat); tShelf.position.set(BX, -0.42, -0.55); tShelf.castShadow = tShelf.receiveShadow = true; gBoard.add(tShelf);
    const gold = new THREE.MeshStandardMaterial({ color: "#d9a93a", metalness: 1, roughness: 0.22, envMap });
    const silver = new THREE.MeshStandardMaterial({ color: "#d8dade", metalness: 1, roughness: 0.25, envMap });
    const marble = new THREE.MeshStandardMaterial({ color: "#1d1b1c", roughness: 0.4 });
    function trophy(mat, s) {
      const g = new THREE.Group();
      const prof = [[0, 0], [0.16, 0], [0.16, 0.05], [0.06, 0.07], [0.045, 0.2], [0.03, 0.27], [0.05, 0.3], [0.16, 0.36], [0.2, 0.52], [0.19, 0.6], [0.0, 0.6]].map(([x, y]) => new THREE.Vector2(x * s, y * s));
      const cup = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), mat); cup.castShadow = true;
      for (const sx of [-1, 1]) { const hnd = new THREE.Mesh(new THREE.TorusGeometry(0.075 * s, 0.014 * s, 8, 20, Math.PI), mat); hnd.rotation.z = sx * Math.PI / 2; hnd.position.set(sx * 0.2 * s, 0.47 * s, 0); g.add(hnd); }
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.36 * s, 0.12 * s, 0.36 * s), marble); base.position.y = -0.06 * s; base.castShadow = true;
      g.add(cup, base);
      return g;
    }
    // one big cup: polished gold, ear handles, a stepped black base with an engraved plate
    (function bigCup() {
      const g = new THREE.Group();
      const goldP = new THREE.MeshPhysicalMaterial({ color: "#e9b949", metalness: 1, roughness: 0.14, clearcoat: 0.6, clearcoatRoughness: 0.1, envMap });
      goldP.userData.envI = 1.4; reflective.push(goldP);
      const prof = [[0, 0.0], [0.11, 0.0], [0.11, 0.015], [0.085, 0.025], [0.05, 0.04], [0.035, 0.09], [0.03, 0.15], [0.042, 0.17], [0.03, 0.19], [0.05, 0.22], [0.1, 0.25], [0.15, 0.3], [0.18, 0.37], [0.195, 0.45], [0.2, 0.5], [0.215, 0.52], [0.205, 0.53], [0.19, 0.515], [0.0, 0.515]]
        .map(([x, y]) => new THREE.Vector2(x, y));
      const cupM = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), goldP); cupM.castShadow = true;
      // a band around the bowl
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.183, 0.006, 8, 64), goldP); band.rotation.x = Math.PI / 2; band.position.y = 0.38;
      for (const sx of [-1, 1]) {
        const hc = new THREE.CatmullRomCurve3([V3(sx * 0.17, 0.45, 0), V3(sx * 0.27, 0.48, 0), V3(sx * 0.3, 0.38, 0), V3(sx * 0.22, 0.29, 0), V3(sx * 0.14, 0.28, 0)]);
        const h = new THREE.Mesh(new THREE.TubeGeometry(hc, 40, 0.014, 10), goldP); h.castShadow = true; g.add(h);
      }
      const blk = new THREE.MeshPhysicalMaterial({ color: "#121113", roughness: 0.25, clearcoat: 0.8, envMap }); reflective.push(blk);
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.34), blk); b1.position.y = -0.105;
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.07, 0.27), blk); b2.position.y = -0.035;
      b1.castShadow = b2.castShadow = true;
      const c = canvas2d(512, 128), ctx = c.getContext("2d");
      const gg = ctx.createLinearGradient(0, 0, 0, 128); gg.addColorStop(0, "#f3d27a"); gg.addColorStop(1, "#b8862a"); ctx.fillStyle = gg; ctx.fillRect(0, 0, 512, 128);
      ctx.fillStyle = "#3a2a0c"; ctx.textAlign = "center"; ctx.font = `46px ${FONT_UI}`; ctx.fillText("BIÈRE LEVERCULSEC", 256, 62); ctx.font = `30px ${FONT_UI}`; ctx.fillText("CHAMPIONS · DEPUIS 2024", 256, 104);
      const plateM = new THREE.MeshStandardMaterial({ map: finish(c), metalness: 0.6, roughness: 0.3, envMap }); reflective.push(plateM);
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.06), plateM); plate.position.set(0, -0.105, 0.171);
      g.add(cupM, band, b1, b2, plate);
      g.scale.setScalar(0.74); g.position.set(BX, -0.395 + 0.14 * 0.74, -0.52); gBoard.add(g);
    })();
    // a ball and two cones on the floor
    function ballTexture() {
      const c = canvas2d(512, 256), ctx = c.getContext("2d");
      ctx.fillStyle = "#f4f2ee"; ctx.fillRect(0, 0, 512, 256);
      ctx.fillStyle = "#18181a";
      const spots = [[64, 128], [192, 128], [320, 128], [448, 128], [0, 40], [128, 40], [256, 40], [384, 40], [512, 40], [0, 216], [128, 216], [256, 216], [384, 216], [512, 216]];
      for (const [x, y] of spots) { ctx.beginPath(); for (let k = 0; k < 5; k++) { const an = -Math.PI / 2 + k * 2 * Math.PI / 5; ctx.lineTo(x + Math.cos(an) * 26, y + Math.sin(an) * 22); } ctx.closePath(); ctx.fill(); }
      return finish(c);
    }
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 24), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.55 }));
    ball.position.set(BX - 0.55, -0.69, 0.25); ball.rotation.set(0.4, 0.8, 0); ball.castShadow = true; gBoard.add(ball);
    const coneMat = new THREE.MeshStandardMaterial({ color: "#f26a1b", roughness: 0.6 });
    [[0.62, 0.15], [0.42, 0.42]].forEach(([x, z]) => { const cone = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 24, 1, true), coneMat); cone.position.set(BX + x, -0.7, z); cone.castShadow = true; gBoard.add(cone);
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.012, 24), coneMat); ring.position.set(BX + x, -0.794, z); gBoard.add(ring); });

    // ---------- desk corner ----------
    const deskWood = woodTexture(26, 22); deskWood.repeat.set(2, 1);
    const deskMat = new THREE.MeshStandardMaterial({ map: deskWood, roughness: 0.55 });
    const DESK_Z0 = -0.72, DESK_Z1 = 1.38, DESK_W = 2.6, deskZ = (DESK_Z0 + DESK_Z1) / 2;
    const desk = new THREE.Mesh(new THREE.BoxGeometry(DESK_W, 0.09, DESK_Z1 - DESK_Z0), deskMat); desk.position.set(DX, DY - 0.045, deskZ); desk.receiveShadow = desk.castShadow = true; gDesk.add(desk);
    pbr(deskMat, desk.geometry, "desk", 2.2, 1.8, { color: new THREE.Color("#c9b29a") });
    const edgeMat = new THREE.MeshStandardMaterial({ color: "#3a2416", roughness: 0.6 });
    const lip = new THREE.Mesh(new THREE.BoxGeometry(DESK_W + 0.02, 0.12, 0.05), edgeMat); lip.position.set(DX, DY - 0.07, DESK_Z1); gDesk.add(lip);
    const apron = new THREE.Mesh(new THREE.BoxGeometry(DESK_W - 0.2, 0.18, DESK_Z1 - DESK_Z0 - 0.2), edgeMat); apron.position.set(DX, DY - 0.18, deskZ); gDesk.add(apron);
    for (const [x, z] of [[-1.2, DESK_Z0 + 0.1], [1.2, DESK_Z0 + 0.1], [-1.2, DESK_Z1 - 0.1], [1.2, DESK_Z1 - 0.1]]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.08), edgeMat); leg.position.set(DX + x, DY - 0.36, z); leg.castShadow = true; gDesk.add(leg); }
    // leather desk mat under the papers
    // framed club crest above the desk
    loadImg("/logo-bl.png").then((im) => {
      if (!im) return;
      const c = canvas2d(512, 512), ctx = c.getContext("2d");
      ctx.fillStyle = "#f3efe6"; ctx.fillRect(0, 0, 512, 512);
      const s = 380 / Math.max(im.width, im.height); ctx.drawImage(im, 256 - im.width * s / 2, 256 - im.height * s / 2, im.width * s, im.height * s);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.03), new THREE.MeshStandardMaterial({ color: "#1c1512", roughness: 0.6 }));
      frame.position.set(DX, 0.36, -0.72);
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.54), new THREE.MeshStandardMaterial({ map: finish(c), roughness: 0.8 }));
      pic.position.set(DX, 0.36, -0.70);
      gDesk.add(frame, pic);
    });
    // papers lie flat on the desk (top of the sheet = away from the camera)
    function sheet(w, h, cw) {
      const c = canvas2d(cw * HD, Math.round(cw * HD * h / w)); c.logical = cw;
      const tex = finish(c);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
      m.rotation.x = -Math.PI / 2; m.receiveShadow = true;
      return { mesh: m, canvas: c, tex, regions: [] };
    }
    const nextSheet = sheet(0.68, 1.22, 760); nextSheet.mesh.position.set(DX - 0.36, DY + 0.008, DZ - 0.3); nextSheet.mesh.rotation.z = 0.025; nextSheet.mesh.userData.surface = "next";
    const listSheet = sheet(0.66, 1.22, 720); listSheet.mesh.position.set(DX + 0.36, DY + 0.009, DZ - 0.29); listSheet.mesh.rotation.z = -0.03; listSheet.mesh.userData.surface = "list";
    const calSheet = sheet(1.38, 0.63, 1280); calSheet.mesh.position.set(DX, DY + 0.012, DZ + 0.7); calSheet.mesh.userData.surface = "calendar";
    gDesk.add(nextSheet.mesh, listSheet.mesh, calSheet.mesh);
    // calendar pad thickness + binding rings
    // a desk calendar block: the months to come stacked under the page, a stiff back, a spiral along the top
    const pageMat = new THREE.MeshStandardMaterial({ color: "#efeadf", roughness: 0.95 });
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.012, 0.67), new THREE.MeshStandardMaterial({ color: "#1d3a2a", roughness: 0.8 })); back.position.set(DX, DY - 0.002, DZ + 0.705); back.castShadow = back.receiveShadow = true; gDesk.add(back);
    for (let k = 0; k < 3; k++) { const pg = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.0018, 0.63 - k * 0.004), pageMat); pg.position.set(DX + (k - 1) * 0.004, DY + 0.005 + k * 0.002, DZ + 0.7 + (k % 2 ? 0.003 : -0.002)); pg.receiveShadow = true; gDesk.add(pg); }
    for (let k = 0; k < 15; k++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.017, 0.0035, 8, 20, Math.PI * 1.25), steel);
      ring.rotation.y = Math.PI / 2; ring.rotation.z = -0.3; ring.position.set(DX - 0.63 + k * 0.09, DY + 0.017, DZ + 0.39); ring.castShadow = true; gDesk.add(ring);
    }
    // mug, pen, whistle, notebook, lamp
    const mugMat = new THREE.MeshStandardMaterial({ color: opts.accent || "#2f8f5b", roughness: 0.4 });
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.13, 24, 1, true), mugMat); mug.position.set(DX + 0.95, DY + 0.065, DZ + 0.45); mug.castShadow = true;
    const mugIn = new THREE.Mesh(new THREE.CircleGeometry(0.055, 24), new THREE.MeshStandardMaterial({ color: "#3b2416", roughness: 0.2 })); mugIn.rotation.x = -Math.PI / 2; mugIn.position.set(DX + 0.95, DY + 0.11, DZ + 0.45);
    const mugH = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.009, 8, 16), mugMat); mugH.position.set(DX + 1.015, DY + 0.07, DZ + 0.45); mugH.rotation.y = Math.PI / 2;
    const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.26, 10), new THREE.MeshStandardMaterial({ color: "#1b2a8f", roughness: 0.3 })); pen.rotation.set(Math.PI / 2, 0, 0.6); pen.position.set(DX + 0.78, DY + 0.009, DZ + 0.95); pen.castShadow = true;
    const nb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.66), new THREE.MeshStandardMaterial({ color: opts.accentDeep || "#1d5a3a", roughness: 0.7 })); nb.position.set(DX - 0.95, DY + 0.015, DZ + 0.8); nb.rotation.y = 0.12; nb.castShadow = true;
    const whistle = new THREE.Group();
    const wb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), steel); const wm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.025, 0.03), steel); wm.position.x = 0.045; whistle.add(wb, wm);
    whistle.position.set(DX - 0.95, DY + 0.035, DZ + 0.3); whistle.rotation.y = 0.8;
    const lampMat = new THREE.MeshStandardMaterial({ color: "#1a1a1c", metalness: 0.5, roughness: 0.4, envMap });
    const lampG = new THREE.Group();
    const lb = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.03, 24), lampMat);
    const la1 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.55, 8), lampMat); la1.position.set(0, 0.27, 0); la1.rotation.z = 0.25;
    const la2 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 8), lampMat); la2.position.set(-0.13, 0.6, 0.1); la2.rotation.set(0.9, 0, 0.6);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.16, 24, 1, true), lampMat); shade.position.set(-0.22, 0.72, 0.28); shade.rotation.x = 0.9;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), new THREE.MeshBasicMaterial({ color: "#ffe2a8" })); bulb.position.set(-0.22, 0.68, 0.31);
    lampG.add(lb, la1, la2, shade, bulb); lampG.position.set(DX + 1.0, DY + 0.015, DZ - 0.75); lampG.rotation.y = -0.5;
    gDesk.add(mug, mugIn, mugH, pen, nb, whistle, lampG);

    // ---------- club things lying around ----------
    const GREEN = "#17703a", GREEN_D = "#0f4f28", CREAM = "#f4f1e8";
    const crestImg = loadImg("/logo-bl.png"); pending.push(crestImg);
    // felt pennant on a little rod, hanging from a cord on the wall
    function pennant(bg, fg, text) {
      const c = canvas2d(512, 768), ctx = c.getContext("2d");
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(512, 0); ctx.lineTo(256, 768); ctx.closePath(); ctx.fillStyle = bg; ctx.fill();
      ctx.lineWidth = 22; ctx.strokeStyle = fg; ctx.beginPath(); ctx.moveTo(30, 18); ctx.lineTo(482, 18); ctx.lineTo(256, 712); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = fg; ctx.textAlign = "center"; ctx.font = `64px ${FONT_UI}`; ctx.fillText(text[0], 256, 330); ctx.font = `46px ${FONT_UI}`; ctx.fillText(text[1], 256, 392);
      // felt grain
      let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      ctx.globalCompositeOperation = "source-atop"; ctx.globalAlpha = 0.06;
      for (let k = 0; k < 2500; k++) { ctx.fillStyle = rnd() > 0.5 ? "#000" : "#fff"; ctx.fillRect(rnd() * 512, rnd() * 768, 2, 2); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      const tex = finish(c);
      crestImg.then((im) => { if (!im) return; const s = 210 / Math.max(im.width, im.height); ctx.drawImage(im, 256 - im.width * s / 2, 60, im.width * s, im.height * s); tex.needsUpdate = true; });
      const g = new THREE.Group();
      const geo = new THREE.PlaneGeometry(0.34, 0.51, 6, 10);
      const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, 0.012 * Math.sin(p.getY(i) * 9 + p.getX(i) * 4)); geo.computeVertexNormals();
      const flag = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.4, roughness: 0.95, side: THREE.DoubleSide }));
      flag.position.y = -0.27; flag.castShadow = true;
      const rodMat = new THREE.MeshStandardMaterial({ color: "#c9a24a", metalness: 0.9, roughness: 0.3, envMap }); reflective.push(rodMat);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.4, 8), rodMat); rod.rotation.z = Math.PI / 2;
      const cordMat = new THREE.MeshStandardMaterial({ color: "#d8d0c0", roughness: 0.9 });
      const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(-0.17, 0, 0), V3(0, 0.11, 0), V3(0.17, 0, 0)]), 16, 0.003, 5), cordMat);
      // tassels
      for (const sx of [-1, 1]) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.06, 8), new THREE.MeshStandardMaterial({ color: fg })); t.position.set(sx * 0.2, -0.03, 0); g.add(t); }
      g.add(flag, rod, cord);
      return g;
    }
    function V3(x, y, z) { return new THREE.Vector3(x, y, z); }
    const pen1 = pennant(GREEN, CREAM, ["BIÈRE", "LEVERCULSEC"]); pen1.position.set(DX - 0.52, 0.6, -0.72); pen1.rotation.z = 0.05; gDesk.add(pen1);
    const pen2 = pennant("#151515", "#c9a24a", ["SAISON", "25 · 26"]); pen2.position.set(DX + 0.52, 0.6, -0.72); pen2.rotation.z = -0.04; gDesk.add(pen2);
    // bunting: a string of little club flags along the shelf over the rail
    (function bunting() {
      const n = 48, span = 6.4, g = new THREE.Group();
      const pts = []; for (let k = 0; k <= 40; k++) { const t = k / 40, x = -span / 2 + span * t; pts.push(V3(x, RAIL_Y + 0.3 - 0.05 * Math.sin(Math.PI * ((t * 8) % 1)), -0.55)); }
      const curve = new THREE.CatmullRomCurve3(pts);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.003, 4), new THREE.MeshStandardMaterial({ color: "#e8e2d4", roughness: 0.9 })));
      const tri = new THREE.BufferGeometry(); tri.setAttribute("position", new THREE.Float32BufferAttribute([-0.045, 0, 0, 0.045, 0, 0, 0, -0.09, 0], 3)); tri.computeVertexNormals();
      const mats = [GREEN, CREAM, "#151515"].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, side: THREE.DoubleSide }));
      for (let k = 0; k < n; k++) { const p = curve.getPointAt((k + 0.5) / n); const f = new THREE.Mesh(tri, mats[k % 3]); f.position.copy(p); f.rotation.set(0.15, 0, (k % 2 ? 0.06 : -0.05)); g.add(f); }
      gRack.add(g);
    })();

    // knitted club scarf, thrown over the bench and hanging off its front
    function scarfTexture() {
      const c = canvas2d(256, 2048), ctx = c.getContext("2d");
      for (let y = 0; y < 2048; y += 128) { ctx.fillStyle = (y / 128) % 2 ? CREAM : GREEN; ctx.fillRect(0, y, 256, 128); }
      ctx.fillStyle = GREEN_D; ctx.fillRect(0, 0, 256, 300); ctx.fillRect(0, 1748, 256, 300);
      ctx.save(); ctx.translate(128, 150); ctx.fillStyle = CREAM; ctx.font = `64px ${FONT_UI}`; ctx.textAlign = "center"; ctx.fillText("BL", 0, 22); ctx.restore();
      ctx.save(); ctx.translate(128, 1900); ctx.fillStyle = CREAM; ctx.font = `64px ${FONT_UI}`; ctx.textAlign = "center"; ctx.fillText("BL", 0, 22); ctx.restore();
      // knit: little V stitches
      ctx.globalAlpha = 0.18; ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
      for (let y = 0; y < 2048; y += 10) for (let x = 0; x < 256; x += 12) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 6, y + 8); ctx.lineTo(x + 12, y); ctx.stroke(); }
      ctx.globalAlpha = 1;
      return finish(c);
    }
    (function scarf() {
      const path = new THREE.CatmullRomCurve3([V3(0, 0.01, -0.58), V3(0.02, 0.012, -0.3), V3(0.0, 0.012, -0.12), V3(-0.01, -0.03, -0.055), V3(0.01, -0.2, -0.04), V3(0.03, -0.36, -0.03)]);
      const N = 60, W = 0.17, pos = [], uv = [], idx = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N, p = path.getPointAt(t), tw = 0.02 * Math.sin(t * 9);
        pos.push(p.x - W / 2, p.y + tw * 0.2, p.z, p.x + W / 2, p.y - tw * 0.2, p.z); uv.push(0, 1 - t, 1, 1 - t);
        if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: scarfTexture(), roughness: 1, side: THREE.DoubleSide }));
      m.position.set(0.48, -0.37, 0); m.rotation.y = 0.5; m.castShadow = m.receiveShadow = true; gRack.add(m);
      // fringe at the hanging end
      const fr = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.06), new THREE.MeshStandardMaterial({ map: (() => { const c = canvas2d(64, 32), x = c.getContext("2d"); for (let k = 0; k < 16; k++) { x.fillStyle = k % 2 ? CREAM : GREEN; x.fillRect(k * 4, 0, 2, 32); } return finish(c); })(), alphaTest: 0.5, transparent: true, side: THREE.DoubleSide }));
      fr.position.set(0.48 + 0.03, -0.37 - 0.39, -0.03); fr.rotation.y = 0.5; gRack.add(fr);
    })();

    // duffel bag on the floor and a ball next to it
    (function bag() {
      const c = canvas2d(1024, 512), ctx = c.getContext("2d");
      ctx.fillStyle = "#18181b"; ctx.fillRect(0, 0, 1024, 512);
      ctx.fillStyle = GREEN; ctx.fillRect(0, 300, 1024, 46); ctx.fillStyle = CREAM; ctx.fillRect(0, 346, 1024, 10);
      ctx.fillStyle = CREAM; ctx.font = `70px ${FONT_UI}`; ctx.textAlign = "center"; ctx.fillText("BIÈRE LEVERCULSEC", 512, 250);
      let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      ctx.globalAlpha = 0.08; for (let k = 0; k < 6000; k++) { ctx.fillStyle = rnd() > 0.5 ? "#000" : "#888"; ctx.fillRect(rnd() * 1024, rnd() * 512, 2, 2); } ctx.globalAlpha = 1;
      const mat = new THREE.MeshStandardMaterial({ map: finish(c), roughness: 0.7 });
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.62, 32, 1), mat); body.rotation.z = Math.PI / 2; body.scale.set(1, 1, 0.85); body.castShadow = true;
      const capMat = new THREE.MeshStandardMaterial({ color: "#121214", roughness: 0.75 });
      for (const sx of [-1, 1]) { const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), capMat); cap.rotation.z = -sx * Math.PI / 2; cap.scale.set(1, 0.18, 0.85); cap.position.x = sx * 0.31; g.add(cap); }
      const strapMat = new THREE.MeshStandardMaterial({ color: "#0e0e10", roughness: 0.6 });
      for (const sx of [-0.12, 0.12]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 24, Math.PI), strapMat); h.position.set(sx, 0.13, 0); h.rotation.y = Math.PI / 2 * 0; g.add(h); }
      g.add(body); g.position.set(-0.46, -0.38 + 0.09, -0.4); g.rotation.y = 0.3; g.scale.setScalar(0.58); gRack.add(g);
      const ball2 = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 24), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.5 }));
      ball2.position.set(-0.62, -0.69, 0.42); ball2.rotation.set(1.1, 0.3, 0.2); ball2.castShadow = true; gRack.add(ball2);
    })();


    // framed photos of the team on the wall behind the shirts
    (function frames() {
      const frameMat = new THREE.MeshStandardMaterial({ color: "#151214", roughness: 0.5 });
      const matBoard = new THREE.MeshStandardMaterial({ color: "#f2eee6", roughness: 0.9 });
      [["photo-shoutoh", -0.6, 0.64, 0.27, 0.405, 0.03], ["photo-jardin", 0.6, 0.64, 0.27, 0.405, -0.025], ["photo-fete", 0, -0.08, 0.5, 0.333, 0]].forEach(([name, x, y, w, h, rz]) => {
        const g = new THREE.Group();
        const fr = new THREE.Mesh(new THREE.BoxGeometry(w + 0.07, h + 0.07, 0.025), frameMat); fr.castShadow = true;
        const mb = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.03, h + 0.03), matBoard); mb.position.z = 0.0131;
        const pm = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.35 });
        const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), pm); pic.position.z = 0.014;
        texLoader.load(ROOM + name + ".jpg?v=1", (t) => { t.encoding = THREE.sRGBEncoding; pm.map = t; pm.needsUpdate = true; });
        g.add(fr, mb, pic); g.position.set(x, y, -0.735); g.rotation.z = rz; gRack.add(g);
      });
    })();

    // a ball in the club colours on the trophy shelf
    (function clubBall() {
      const c = canvas2d(1024, 512), ctx = c.getContext("2d");
      ctx.fillStyle = GREEN; ctx.fillRect(0, 0, 1024, 512);
      ctx.fillStyle = CREAM;
      for (let r = 0; r < 4; r++) for (let k = 0; k < 8; k++) {
        const x = k * 128 + (r % 2) * 64, y = 64 + r * 128;
        ctx.beginPath(); for (let j = 0; j < 6; j++) { const an = j * Math.PI / 3; ctx.lineTo(x + Math.cos(an) * 46, y + Math.sin(an) * 40); } ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = GREEN_D; ctx.lineWidth = 5;
      for (let r = 0; r < 4; r++) for (let k = 0; k < 8; k++) { const x = k * 128 + (r % 2) * 64, y = 64 + r * 128; ctx.beginPath(); for (let j = 0; j < 6; j++) { const an = j * Math.PI / 3; ctx.lineTo(x + Math.cos(an) * 46, y + Math.sin(an) * 40); } ctx.closePath(); ctx.stroke(); }
      const tex = finish(c);
      crestImg.then((im) => { if (!im) return; for (const cx of [256, 768]) { ctx.fillStyle = CREAM; ctx.beginPath(); ctx.arc(cx, 256, 92, 0, Math.PI * 2); ctx.fill(); const s2 = 160 / Math.max(im.width, im.height); ctx.drawImage(im, cx - im.width * s2 / 2, 256 - im.height * s2 / 2, im.width * s2, im.height * s2); } tex.needsUpdate = true; });
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.11, 40, 28), new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.3 }));
      b.position.set(BX - 0.48, -0.395 + 0.11, -0.5); b.rotation.set(0.2, -0.6, 0.1); b.castShadow = true; gBoard.add(b);
    })();

    // a green smoke flare on the right of the shelf, smoking for real
    (function flare() {
      const g = new THREE.Group();
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.2, 20), new THREE.MeshStandardMaterial({ color: "#1d1d1f", roughness: 0.5 }));
      const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.0285, 0.0285, 0.08, 20, 1, true), new THREE.MeshStandardMaterial({ color: GREEN, roughness: 0.6 }));
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.03, 16), new THREE.MeshBasicMaterial({ color: "#c8ffd8" }));
      can.position.y = 0.1; lab.position.y = 0.1; tip.position.y = 0.215; can.castShadow = true;
      g.add(can, lab, tip); g.position.set(BX + 0.52, -0.395, -0.5); g.rotation.z = -0.25; gBoard.add(g);
      const glow = new THREE.PointLight("#3dff7a", 0.9, 1.6, 2); glow.position.set(BX + 0.47, -0.15, -0.4); gBoard.add(glow);
      // soft round puff, reused by every particle
      const c = canvas2d(128, 128), ctx = c.getContext("2d"), gr = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
      gr.addColorStop(0, "rgba(255,255,255,0.85)"); gr.addColorStop(0.5, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gr; ctx.fillRect(0, 0, 128, 128);
      const puffTex = finish(c, false);
      const N = low ? 22 : 40, puffs = [];
      const origin = new THREE.Vector3(BX + 0.47, -0.17, -0.5);
      for (let k = 0; k < N; k++) {
        const m = new THREE.SpriteMaterial({ map: puffTex, color: k % 3 ? "#4fd27e" : "#8be8a8", transparent: true, depthWrite: false, opacity: 0 });
        const sp = new THREE.Sprite(m); gBoard.add(sp);
        puffs.push({ sp, life: k / N, speed: 0.75 + Math.random() * 0.5, drift: (Math.random() - 0.5) * 0.25, spin: Math.random() * 6 });
      }
      tickers.push((dt, t) => {
        if (cam.zone !== "board" && cam.t >= 1) return; // only alive where it can be seen
        for (const p of puffs) {
          p.life += dt * 0.22 * p.speed; if (p.life > 1) { p.life -= 1; p.drift = (Math.random() - 0.5) * 0.25; }
          const L = p.life, rise = L * 1.25;
          p.sp.position.set(origin.x + p.drift * L * 1.5 + Math.sin(t * 0.8 + p.spin) * 0.05 * L + 0.2 * L + 0.9 * L * L, origin.y + rise * 0.8, origin.z + 0.1 * L);
          const sc = 0.1 + L * 0.7; p.sp.scale.set(sc, sc, 1);
          p.sp.material.opacity = Math.min(1, L * 8) * Math.pow(1 - L, 1.3) * 0.85;
          p.sp.material.rotation = p.spin + L * 1.5;
        }
        glow.intensity = 0.75 + 0.25 * Math.sin(t * 13) * Math.sin(t * 7.3);
      });
    })();

    // a cold one on the coach's desk
    (function bottle() {
      const glass = new THREE.MeshStandardMaterial({ color: "#5a2a08", roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.92, envMap });
      glass.userData.envI = 1.2; reflective.push(glass);
      const prof = [[0, 0], [0.033, 0], [0.034, 0.005], [0.034, 0.14], [0.03, 0.16], [0.014, 0.2], [0.012, 0.245], [0.014, 0.25], [0.0, 0.25]].map(([x, y]) => new THREE.Vector2(x, y));
      const b = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), glass); b.castShadow = true;
      const c = canvas2d(512, 128), ctx = c.getContext("2d");
      ctx.fillStyle = GREEN; ctx.fillRect(0, 0, 512, 128); ctx.fillStyle = "#c9a24a"; ctx.fillRect(0, 10, 512, 6); ctx.fillRect(0, 112, 512, 6);
      ctx.fillStyle = CREAM; ctx.font = `48px ${FONT_UI}`; ctx.textAlign = "center"; ctx.fillText("BIÈRE · BL · 2024", 256, 82);
      const label = new THREE.Mesh(new THREE.CylinderGeometry(0.0345, 0.0345, 0.07, 24, 1, true), new THREE.MeshStandardMaterial({ map: finish(c), roughness: 0.6 }));
      label.position.y = 0.07;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.012, 16), new THREE.MeshStandardMaterial({ color: "#c9a24a", metalness: 0.9, roughness: 0.3 }));
      cap.position.y = 0.255;
      const g = new THREE.Group(); g.add(b, label, cap); g.position.set(DX - 0.56, DY, -0.68); g.scale.setScalar(1.7); gDesk.add(g);
    })();

    // ---------- drawing helpers ----------
    function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function fitFont(ctx, text, family, size, maxW) { let s = size; ctx.font = `${s}px ${family}`; while (ctx.measureText(text).width > maxW && s > 10) { s -= 2; ctx.font = `${s}px ${family}`; } return s; }
    function wobbleLine(ctx, x1, y1, x2, y2, seed = 1) { ctx.beginPath(); ctx.moveTo(x1, y1); const n = 6; for (let k = 1; k <= n; k++) { const t = k / n; ctx.lineTo(x1 + (x2 - x1) * t + Math.sin(seed * 9 + k * 2.1) * 1.5, y1 + (y2 - y1) * t + Math.sin(seed * 7 + k * 1.7) * 2); } ctx.stroke(); }
    function circleAround(ctx, x, y, w, h, color) { ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2 + 12, h / 2 + 8, -0.03, 0.15, Math.PI * 2 + 0.35); ctx.stroke(); ctx.restore(); }

    // Whiteboard: Équipe / Individuel, the ranking categories and the table, in marker.
    const faceImgs = {}; let lastBoard = null, lastDesk = null;
    const initials = (n) => String(n || "?").split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    // surfaces to redraw once a face photo has loaded (one entry per surface, called from a snapshot)
    const redraws = new Map();
    function needFace(face, redraw, key) {
      const u = face && face.url;
      if (!u) return null;
      if (key) redraws.set(key, redraw);
      if (!faceImgs[u]) { faceImgs[u] = "loading"; loadImg(u).then((im) => { faceImgs[u] = im || "failed"; [...redraws.values()].forEach((f) => f()); }); }
      const img = faceImgs[u];
      return img && img !== "loading" && img !== "failed" ? img : null;
    }
    function drawFace(ctx, face, name, x, y, F, radius, redraw) {
      const img = needFace(face, redraw, "next");
      ctx.save(); roundRect(ctx, x, y, F, F, radius); ctx.clip();
      if (img) { const k = F / 300, r = face.rect; ctx.fillStyle = "#e9e4da"; ctx.fillRect(x, y, F, F); ctx.drawImage(img, x + r.x * k, y + r.y * k, r.width * k, r.height * k); }
      else { ctx.fillStyle = opts.accent || "#2f8f5b"; ctx.fillRect(x, y, F, F); ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = `${Math.round(F * 0.42)}px ${FONT_DISPLAY}`; ctx.fillText(initials(name), x + F / 2, y + F * 0.66); }
      ctx.restore();
    }
    const boardList = { scroll: 0, max: 0, key: null, top: 0, bottom: 0 }; // the rows under the podium scroll
    function drawBoard(m) {
      lastBoard = m;
      const key = [m.mode, m.tab, m.season, m.team && m.team.phase].join("|");
      if (key !== boardList.key) { boardList.key = key; boardList.scroll = 0; }
      for (const en of (m.entries || []).slice(0, 3)) {
        const u = en.face && en.face.url;
        if (u) needFace(en.face, () => lastBoard && drawBoard(lastBoard), "board");
      }
      const c = boardCanvas, ctx = c.getContext("2d"), S = c.width / c.logical, W = c.logical, H = c.height / S; ctx.setTransform(S, 0, 0, S, 0, 0); board.userData.scale = S;
      const regions = [];
      const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#fbfbf8"); g.addColorStop(1, "#eef0ee");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 0.022; ctx.fillStyle = "#4a5a70"; // old erased marks
      for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.ellipse(120 + k * 140, 300 + (k % 3) * 380, 160, 40, 0.2 * k, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
      const ink = "#1a1d24", blue = "#1b2a8f", red = "#c0262d";
      ctx.fillStyle = ink; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.font = `76px ${FONT_MARKER}`; ctx.fillText("CLASSEMENT", W / 2, 110);
      ctx.strokeStyle = red; ctx.lineWidth = 5; wobbleLine(ctx, W / 2 - 250, 130, W / 2 + 250, 126, 3);
      if (m.season) { ctx.fillStyle = blue; ctx.font = `40px ${FONT_MARKER}`; ctx.fillText(m.season, W / 2, 182); }
      // Équipe / Individuel
      const modes = [["team", "ÉQUIPE"], ["indiv", "INDIVIDUEL"]];
      modes.forEach(([key, label], k) => {
        const x = k === 0 ? W * 0.27 : W * 0.7, y = 258;
        ctx.font = `54px ${FONT_MARKER}`; ctx.fillStyle = m.mode === key ? ink : "#8a909a";
        const w = ctx.measureText(label).width; ctx.fillText(label, x, y);
        if (m.mode === key) circleAround(ctx, x - w / 2, y - 50, w, 60, red);
        regions.push({ id: "mode:" + key, x: x - w / 2 - 30, y: y - 70, w: w + 60, h: 100 });
      });
      ctx.strokeStyle = "#c9ccd2"; ctx.lineWidth = 3; wobbleLine(ctx, 60, 300, W - 60, 302, 5);
      if (m.mode === "team") {
        const T = m.team || {};
        const tables = T.tables || [];
        if (!tables.length) {
          ctx.fillStyle = ink; ctx.font = `56px ${FONT_MARKER}`; ctx.fillText(T.emptyTitle || "Pas encore de classement", W / 2, 620);
          ctx.fillStyle = blue; ctx.font = `36px ${FONT_MARKER}`; (T.emptyText || []).forEach((l, k) => ctx.fillText(l, W / 2, 690 + k * 48));
        } else {
          // phases, like the categories of the individual rankings
          ctx.font = `46px ${FONT_MARKER}`;
          const gap = 60, total = tables.reduce((a2, t) => a2 + ctx.measureText(t.label).width, 0) + gap * (tables.length - 1);
          let x = (W - total) / 2;
          const cur = tables.find((t) => t.key === T.phase) || tables[tables.length - 1];
          tables.forEach((t, k) => {
            const on = t === cur, y = 385, w = ctx.measureText(t.label).width;
            ctx.fillStyle = on ? blue : "#8a909a"; ctx.textAlign = "left"; ctx.fillText(t.label, x, y);
            if (on) { ctx.strokeStyle = blue; ctx.lineWidth = 5; wobbleLine(ctx, x - 4, y + 14, x + w + 4, y + 12, k + 1); }
            regions.push({ id: "phase:" + t.key, x: x - gap / 2, y: y - 60, w: w + gap, h: 95 });
            x += w + gap;
          });
          ctx.textAlign = "center"; ctx.fillStyle = "#8a909a"; ctx.font = `30px ${FONT_MARKER}`; ctx.fillText(cur.poule || "", W / 2, 432);
          // columns
          const cols = [["J", 556], ["V", 606], ["N", 656], ["D", 706], ["BP", 780], ["BC", 852], ["DIFF", 972]];
          const hy = 488; ctx.fillStyle = "#6a707a"; ctx.font = `30px ${FONT_MARKER}`;
          ctx.textAlign = "left"; ctx.fillText("ÉQUIPE", 175, hy);
          ctx.textAlign = "right"; cols.forEach(([l, cx]) => ctx.fillText(l, cx, hy));
          ctx.strokeStyle = "#c9ccd2"; ctx.lineWidth = 3; wobbleLine(ctx, 50, hy + 14, W - 40, hy + 16, 9);
          const listTop = hy + 22, listBottom = H - 18, rowH = 76, matchH = 62;
          const rows = cur.rows || [], open = T.selected, against = T.against || [];
          const contentH = rows.length * rowH + (open ? Math.max(1, against.length) * matchH + 24 : 0) + 20;
          boardList.top = listTop; boardList.bottom = listBottom;
          boardList.max = Math.max(0, contentH - (listBottom - listTop));
          boardList.scroll = Math.min(boardList.max, Math.max(0, boardList.scroll));
          ctx.save(); ctx.beginPath(); ctx.rect(0, listTop, W, listBottom - listTop); ctx.clip();
          let y = listTop - boardList.scroll;
          const visible = (y0, h) => y0 + h > listTop - 10 && y0 < listBottom + 10;
          rows.forEach((r) => {
            const mid = y + rowH / 2;
            if (visible(y, rowH)) {
              if (r.us) { ctx.fillStyle = "rgba(255,228,92,0.55)"; roundRect(ctx, 44, y + 6, W - 80, rowH - 12, 14); ctx.fill(); }
              if (open === r.name) { ctx.strokeStyle = blue; ctx.lineWidth = 4; roundRect(ctx, 44, y + 6, W - 80, rowH - 12, 14); ctx.stroke(); }
              ctx.textAlign = "right"; ctx.fillStyle = "#6a707a"; ctx.font = `36px ${FONT_MARKER}`; ctx.fillText(String(r.rank), 98, mid + 13);
              // badge: our crest colour for us, a colour of its own for the others
              const b = r.badge || { initials: "?", hue: 0 };
              ctx.fillStyle = r.us ? (opts.accent || "#2f8f5b") : `hsl(${b.hue}, 55%, 42%)`; ctx.beginPath(); ctx.arc(138, mid, 27, 0, Math.PI * 2); ctx.fill();
              ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 2; ctx.stroke();
              ctx.fillStyle = "#fff"; ctx.textAlign = "center"; fitFont(ctx, b.initials, FONT_UI, 24, 46); ctx.fillText(b.initials, 138, mid + 8);
              ctx.textAlign = "left"; ctx.fillStyle = ink; fitFont(ctx, r.label || r.name, FONT_MARKER, 36, 340); ctx.fillText(r.label || r.name, 180, mid + 12);
              ctx.textAlign = "right"; ctx.font = `36px ${FONT_MARKER}`;
              [[r.played, 556], [r.w, 606], [r.d, 656], [r.l, 706], [r.bp, 780], [r.bc, 852]].forEach(([v, cx]) => { ctx.fillStyle = ink; ctx.fillText(v == null ? "–" : String(v), cx, mid + 12); });
              ctx.fillStyle = r.diff > 0 ? "#2f8f5b" : r.diff < 0 ? red : ink; ctx.fillText((r.diff > 0 ? "+" : "") + r.diff, 972, mid + 12);
              if (!r.us && y >= listTop - 20 && y + rowH <= listBottom + 20) regions.push({ id: "team:" + r.name, x: 40, y, w: W - 80, h: rowH });
            }
            y += rowH;
            if (open === r.name) {
              // our matches against them, right under their line
              const list = against.length ? against : [null];
              list.forEach((g) => {
                const mm = y + matchH / 2;
                if (visible(y, matchH)) {
                  ctx.textAlign = "left"; ctx.fillStyle = blue; ctx.font = `32px ${FONT_MARKER}`;
                  if (!g) ctx.fillText("Pas encore de match prévu contre eux", 120, mm + 10);
                  else {
                    ctx.fillText(g.label, 120, mm + 10);
                    const tone = { V: "#2f8f5b", N: "#9a8a2a", D: "#c0262d" }[g.result] || "#8a909a";
                    ctx.fillStyle = tone; roundRect(ctx, W - 250, mm - 24, 170, 48, 12); ctx.fill();
                    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = `34px ${FONT_UI}`; fitFont(ctx, g.score || (g.upcoming ? "à venir" : "? - ?"), FONT_UI, 34, 150); ctx.fillText(g.score || (g.upcoming ? "à venir" : "? - ?"), W - 165, mm + 12);
                    if (y >= listTop - 10 && y + matchH <= listBottom + 10) regions.push({ id: "match:" + g.id, x: 80, y, w: W - 140, h: matchH });
                  }
                }
                y += matchH;
              });
              y += 24;
            }
          });
          ctx.restore();
          const fade = (y0, up) => { const gr = ctx.createLinearGradient(0, y0, 0, y0 + (up ? 60 : -60)); gr.addColorStop(0, "rgba(242,243,240,1)"); gr.addColorStop(1, "rgba(242,243,240,0)"); ctx.fillStyle = gr; ctx.fillRect(40, up ? y0 : y0 - 60, W - 80, 60); };
          if (boardList.scroll > 2) fade(listTop, true);
          if (boardList.scroll < boardList.max - 2) { fade(listBottom, false); ctx.fillStyle = "#8a909a"; ctx.beginPath(); ctx.moveTo(W - 70, listBottom - 30); ctx.lineTo(W - 46, listBottom - 30); ctx.lineTo(W - 58, listBottom - 14); ctx.closePath(); ctx.fill(); }
          ctx.textAlign = "center";
        }
      } else {
        // categories, as big as the board allows
        const tabs = m.tabs || [];
        let tf = 50; ctx.font = `${tf}px ${FONT_MARKER}`;
        const gap = 40, total = () => tabs.reduce((a, t) => a + ctx.measureText(t.label).width, 0) + gap * (tabs.length - 1);
        while (total() > W - 70 && tf > 30) { tf -= 2; ctx.font = `${tf}px ${FONT_MARKER}`; }
        let x = (W - total()) / 2;
        tabs.forEach((t, k) => {
          const on = t.key === m.tab, y = 385, w = ctx.measureText(t.label).width;
          ctx.fillStyle = on ? blue : "#8a909a"; ctx.textAlign = "left"; ctx.fillText(t.label, x, y);
          if (on) { ctx.strokeStyle = blue; ctx.lineWidth = 5; wobbleLine(ctx, x - 4, y + 14, x + w + 4, y + 12, k + 1); }
          regions.push({ id: "tab:" + t.key, x: x - gap / 2, y: y - 60, w: w + gap, h: 95 });
          x += w + gap;
        });
        ctx.textAlign = "center";
        const e = m.entries || [];
        if (!e.length) {
          ctx.fillStyle = "#6a707a"; ctx.font = `52px ${FONT_MARKER}`; ctx.fillText("Pas encore de classement", W / 2, 700);
        } else {
          // podium 2 - 1 - 3, a square post-it with the player's face stuck above each step
          const base = 905, colW = 310, heights = { 1: 150, 2: 105, 3: 75 }, P = 262;
          [[e[1], 2, W / 2 - colW], [e[0], 1, W / 2], [e[2], 3, W / 2 + colW]].forEach(([en, place, cx]) => {
            if (!en) return;
            const hgt = heights[place];
            ctx.strokeStyle = ink; ctx.lineWidth = 6; ctx.beginPath(); ctx.rect(cx - colW / 2 + 22, base - hgt, colW - 44, hgt); ctx.stroke();
            const top = base - hgt - 18 - P, tilt = place === 1 ? -0.02 : place === 2 ? -0.05 : 0.045;
            ctx.save(); ctx.translate(cx, top + P / 2); ctx.rotate(tilt);
            ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
            ctx.fillStyle = place === 1 ? "#ffe45c" : place === 2 ? "#ffd0e4" : "#c9f0ff"; ctx.fillRect(-P / 2, -P / 2, P, P);
            ctx.shadowColor = "transparent";
            ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.fillRect(-46, -P / 2 - 14, 92, 30); // tape
            const F = 140, fx = -F / 2, fy = -P / 2 + 22;
            const img = en.face && faceImgs[en.face.url];
            ctx.save(); roundRect(ctx, fx, fy, F, F, 14); ctx.clip();
            if (img && img !== "loading" && img !== "failed") {
              const k = F / 300, r = en.face.rect; ctx.fillStyle = "#e9e4da"; ctx.fillRect(fx, fy, F, F);
              ctx.drawImage(img, fx + r.x * k, fy + r.y * k, r.width * k, r.height * k);
            } else {
              ctx.fillStyle = opts.accent || "#2f8f5b"; ctx.fillRect(fx, fy, F, F);
              ctx.fillStyle = "#fff"; ctx.font = `64px ${FONT_DISPLAY}`; ctx.fillText(initials(en.name), 0, fy + F / 2 + 24);
            }
            ctx.restore();
            ctx.fillStyle = ink; fitFont(ctx, en.name, FONT_MARKER, 44, P - 24); ctx.fillText(en.name, 0, P / 2 - 46);
            ctx.fillStyle = blue; ctx.font = `40px ${FONT_MARKER}`; ctx.fillText(en.value, 0, P / 2 - 6);
            ctx.restore();
            regions.push({ id: "player:" + en.playerId, x: cx - colW / 2, y: top - 20, w: colW, h: base - top + 20 });
          });
          ctx.strokeStyle = ink; ctx.lineWidth = 6; wobbleLine(ctx, W / 2 - colW * 1.5 + 8, base + 2, W / 2 + colW * 1.5 - 8, base, 8);
          // 4th and after: as many as there are, scrolled by a vertical swipe on the board
          const listTop = base + 30, listBottom = H - 18, rowH = 72;
          boardList.top = listTop; boardList.bottom = listBottom;
          boardList.max = Math.max(0, (e.length - 3) * rowH + 30 - (listBottom - listTop));
          boardList.scroll = Math.min(boardList.max, Math.max(0, boardList.scroll));
          ctx.save(); ctx.beginPath(); ctx.rect(0, listTop, W, listBottom - listTop); ctx.clip();
          let y = base + 92 - boardList.scroll;
          e.slice(3).forEach((en, k) => {
            if (y < listTop - rowH || y > listBottom + rowH) { y += rowH; return; }
            ctx.textAlign = "left"; ctx.fillStyle = "#6a707a"; ctx.font = `46px ${FONT_MARKER}`; ctx.fillText(`${k + 4}.`, 90, y);
            ctx.fillStyle = ink; fitFont(ctx, en.name, FONT_MARKER, 50, 560); ctx.fillText(en.name, 175, y);
            ctx.textAlign = "right"; ctx.fillStyle = blue; ctx.font = `50px ${FONT_MARKER}`; ctx.fillText(en.value, W - 90, y);
            ctx.strokeStyle = "#d4d7dc"; ctx.lineWidth = 2; ctx.setLineDash([6, 10]); ctx.beginPath(); ctx.moveTo(175, y + 16); ctx.lineTo(W - 90, y + 16); ctx.stroke(); ctx.setLineDash([]);
            if (y - 56 >= listTop - 20 && y + 16 <= listBottom + 20) regions.push({ id: "player:" + en.playerId, x: 60, y: y - 56, w: W - 120, h: 72 });
            y += rowH;
          });
          ctx.restore();
          // the list goes on: a soft fade and an arrow at the edge that hides rows
          const fade = (y0, up) => { const gr = ctx.createLinearGradient(0, y0, 0, y0 + (up ? 60 : -60)); gr.addColorStop(0, "rgba(242,243,240,1)"); gr.addColorStop(1, "rgba(242,243,240,0)"); ctx.fillStyle = gr; ctx.fillRect(40, up ? y0 : y0 - 60, W - 80, 60); };
          if (boardList.scroll > 2) fade(listTop, true);
          if (boardList.scroll < boardList.max - 2) { fade(listBottom, false); ctx.fillStyle = "#8a909a"; ctx.beginPath(); ctx.moveTo(W - 70, listBottom - 30); ctx.lineTo(W - 46, listBottom - 30); ctx.lineTo(W - 58, listBottom - 14); ctx.closePath(); ctx.fill(); }
          ctx.textAlign = "center";
        }
      }
      board.userData.regions = regions;
      boardTex.needsUpdate = true;
    }

    function paper(ctx, W, H, lined) {
      ctx.fillStyle = "#fbf9f3"; ctx.fillRect(0, 0, W, H);
      const g = ctx.createRadialGradient(W * 0.3, H * 0.2, 10, W / 2, H / 2, W); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(120,100,70,0.12)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (lined) { ctx.strokeStyle = "rgba(70,110,190,0.25)"; ctx.lineWidth = 2; for (let y = 150; y < H - 30; y += 52) { ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(W - 30, y); ctx.stroke(); } ctx.strokeStyle = "rgba(200,60,60,0.35)"; ctx.beginPath(); ctx.moveTo(90, 0); ctx.lineTo(90, H); ctx.stroke(); }
    }
    function drawNext(m) {
      const s = nextSheet, c = s.canvas, ctx = c.getContext("2d"), S = c.width / c.logical, W = c.logical, H = c.height / S; ctx.setTransform(S, 0, 0, S, 0, 0); s.mesh.userData.scale = S;
      paper(ctx, W, H, false);
      const accent = m.accent || opts.accent || "#2f8f5b";
      ctx.fillStyle = accent; ctx.fillRect(0, 0, W, 150);
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = `64px ${FONT_UI}`; ctx.fillText("PROCHAIN MATCH", W / 2, 100);
      const wrap = (text, family, size, maxW, y, lh, maxLines = 3) => { // centred lines, shrinking the font if needed
        let s2 = size, lines;
        for (;;) {
          ctx.font = `${s2}px ${family}`; lines = []; let line = "";
          for (const w of String(text).split(" ")) { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
          if (line) lines.push(line);
          if (lines.length <= maxLines || s2 <= 26) break; s2 -= 4;
        }
        lines.forEach((l, k) => ctx.fillText(l, W / 2, y + k * lh * s2 / size));
        return y + lines.length * lh * s2 / size;
      };
      if (!m) {
        ctx.fillStyle = "#1b1b1b"; ctx.font = `72px ${FONT_HAND}`; ctx.fillText("Aucun match prévu", W / 2, H / 2);
      } else {
        ctx.fillStyle = accent; ctx.font = `44px ${FONT_UI}`; ctx.fillText(m.kicker || "", W / 2, 215);
        ctx.fillStyle = "#1b1b1b";
        let y = wrap("vs " + m.opponent, FONT_DISPLAY, 90, W - 70, 310, 100, 2);
        ctx.strokeStyle = "rgba(0,0,0,0.12)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(80, y - 40); ctx.lineTo(W - 80, y - 40); ctx.stroke();
        ctx.fillStyle = "#1b1b1b"; y = wrap(m.date, FONT_UI, 58, W - 70, y + 34, 66, 1);
        ctx.font = `54px ${FONT_UI}`; ctx.fillText(m.hours, W / 2, y + 22); y += 96;
        ctx.fillStyle = "#5d554b"; y = wrap(m.place || "", FONT_UI, 40, W - 90, y, 48, 2);
        // the two players bringing the balls, with their faces
        const keepers = (m.ballKeepers || []).slice(0, 2);
        if (!keepers.length) {
          const top = Math.max(y + 16, H - 520);
          ctx.fillStyle = accent; ctx.font = `40px ${FONT_UI}`; ctx.textAlign = "center"; ctx.fillText("⚽ RESPONSABLES BALLONS", W / 2, top + 40);
          ctx.fillStyle = "#8a7f72"; ctx.font = `54px ${FONT_HAND}`; ctx.fillText("pas encore choisis…", W / 2, top + 130);
        } else {
          const top = Math.max(y + 16, H - 520);
          ctx.fillStyle = accent; ctx.font = `40px ${FONT_UI}`; ctx.textAlign = "center"; ctx.fillText("⚽ RESPONSABLES BALLONS", W / 2, top + 40);
          const F = 160, gap = 90, x0 = W / 2 - (keepers.length * F + (keepers.length - 1) * gap) / 2;
          keepers.forEach((kp, k) => {
            const x = x0 + k * (F + gap);
            ctx.save(); ctx.translate(x + F / 2, top + 70 + F / 2); ctx.rotate(k ? 0.05 : -0.05);
            ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4; ctx.fillStyle = "#fff"; ctx.fillRect(-F / 2 - 10, -F / 2 - 10, F + 20, F + 54); ctx.shadowColor = "transparent";
            drawFace(ctx, kp.face, kp.name, -F / 2, -F / 2, F, 6, () => lastDesk && drawNext(lastDesk.next));
            ctx.fillStyle = "#1b1b1b"; ctx.textAlign = "center"; fitFont(ctx, kp.name, FONT_HAND, 40, F + 10); ctx.fillText(kp.name, 0, F / 2 + 36);
            ctx.restore();
          });
        }
      }
      const regions = [];
      if (m && m.canAnswer) {
        // Présent / Absent: grey until chosen, then green or red
        const bw = (W - 110) / 2, bh = 120, by = H - 200;
        [["present", "PRÉSENT", "#1f8a4c", 40], ["absent", "ABSENT", "#c0262d", 70 + bw]].forEach(([key, label, color, bx]) => {
          const on = m.presence === key, lock = key === "present" && m.presentLock;
          ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.18)"; ctx.shadowBlur = on ? 10 : 4; ctx.shadowOffsetY = 4; if (lock) ctx.globalAlpha = 0.5;
          ctx.fillStyle = on ? color : "#e3ded5"; roundRect(ctx, bx, by, bw, bh, 26); ctx.fill(); ctx.restore();
          if (!on) { ctx.strokeStyle = "#cfc8bc"; ctx.lineWidth = 3; roundRect(ctx, bx, by, bw, bh, 26); ctx.stroke(); }
          ctx.fillStyle = on ? "#fff" : "#7a7166"; ctx.font = `54px ${FONT_UI}`;
          if (lock) { fitFont(ctx, "🔒 " + lock, FONT_UI, 50, bw - 20); ctx.fillText("🔒 " + lock, bx + bw / 2, by + bh / 2 + 17); }
          else { ctx.fillText((key === "present" ? "✓ " : "✕ ") + label, bx + bw / 2, by + bh / 2 + 19); regions.push({ id: "presence:" + key, x: bx, y: by, w: bw, h: bh }); }
        });
      }
      ctx.fillStyle = "#9b8f80"; ctx.font = `28px ${FONT_UI}`; ctx.fillText("toucher la feuille pour ouvrir", W / 2, H - 28);
      regions.push({ id: "next", x: 0, y: 0, w: W, h: H });
      s.mesh.userData.regions = regions;
      s.tex.needsUpdate = true;
    }
    function drawList(items) {
      const s = listSheet, c = s.canvas, ctx = c.getContext("2d"), S = c.width / c.logical, W = c.logical, H = c.height / S; ctx.setTransform(S, 0, 0, S, 0, 0); s.mesh.userData.scale = S;
      paper(ctx, W, H, false);
      ctx.fillStyle = "#1b1b1b"; ctx.textAlign = "left"; ctx.font = `66px ${FONT_HAND}`; ctx.fillText("Les 3 prochains", 50, 100);
      const regions = [];
      if (!items || !items.length) { ctx.fillStyle = "#6b6257"; ctx.font = `58px ${FONT_HAND}`; ctx.fillText("Rien d'autre de prévu", 50, 320); }
      const cardH = 390, gap = 30;
      (items || []).slice(0, 3).forEach((it, k) => {
        const x = 30, y = 150 + k * (cardH + gap), w = W - 60;
        // the card: raised, with a chevron, so it reads as something to tap
        ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.2)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
        ctx.fillStyle = "#ffffff"; roundRect(ctx, x, y, w, cardH, 26); ctx.fill(); ctx.restore();
        ctx.strokeStyle = "rgba(0,0,0,0.12)"; ctx.lineWidth = 3; roundRect(ctx, x, y, w, cardH, 26); ctx.stroke();
        const acc = it.accent || opts.accent || "#2f8f5b"; // pink for an away match
        ctx.fillStyle = acc; roundRect(ctx, x, y, 16, cardH, 8); ctx.fill();
        ctx.textAlign = "left";
        ctx.fillStyle = acc; fitFont(ctx, it.date, FONT_UI, 48, w - 120); ctx.fillText(it.date, x + 44, y + 64);
        ctx.fillStyle = "#1b1b1b"; fitFont(ctx, "vs " + it.opponent, FONT_DISPLAY, 62, w - 120); ctx.fillText("vs " + it.opponent, x + 44, y + 138);
        ctx.fillStyle = "#6b6257"; ctx.font = `42px ${FONT_UI}`; ctx.fillText(it.sub || "", x + 44, y + 192);
        ctx.fillStyle = "#9b8f80"; ctx.font = `70px ${FONT_UI}`; ctx.textAlign = "right"; ctx.fillText("›", x + w - 26, y + 128);
        // where: the place, on up to 3 lines
        if (it.place) {
          ctx.textAlign = "left"; ctx.fillStyle = "#3f3a33"; ctx.font = `38px ${FONT_UI}`;
          const words = ("📍 " + it.place).split(" "), lines = [];
          let cur = "";
          for (const wd of words) { const t = cur ? cur + " " + wd : wd; if (ctx.measureText(t).width > w - 80 && cur) { lines.push(cur); cur = wd; } else cur = t; }
          if (cur) lines.push(cur);
          lines.slice(0, 3).forEach((l, i) => ctx.fillText(i === 2 && lines.length > 3 ? l + "…" : l, x + 44, y + 252 + i * 46));
        }
        regions.push({ id: "match:" + it.id, x, y, w, h: cardH });
      });
      s.mesh.userData.regions = regions;
      s.tex.needsUpdate = true;
    }
    // A desk-calendar page: punched top, the month in a coloured band, a small month grid with the match days marked,
    // and the month's matches listed beside it (score coloured by the result, or the hour, and my rating).
    function drawCalendar(m) {
      const s = calSheet, c = s.canvas, ctx = c.getContext("2d"), S = c.width / c.logical, W = c.logical, H = c.height / S; ctx.setTransform(S, 0, 0, S, 0, 0); s.mesh.userData.scale = S;
      const regions = [], accent = opts.accent || "#2f8f5b", tone = { V: "#2f8f5b", N: "#b39b2c", D: "#c0262d" };
      paper(ctx, W, H, false);
      // binding holes along the top
      for (let k = 0; k < 15; k++) { ctx.fillStyle = "#2a2622"; ctx.beginPath(); ctx.arc(W / 2 - 0.63 / 1.38 * W + k * (0.09 / 1.38) * W, 18, 9, 0, Math.PI * 2); ctx.fill(); }
      // month band
      const bandY = 38, bandH = 104;
      ctx.fillStyle = accent; ctx.fillRect(0, bandY, W, bandH);
      ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(0, bandY + bandH - 6, W, 6);
      const [mName, mYear] = String(m.title || "").split(" ");
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = `70px ${FONT_DISPLAY}`; ctx.fillText(mName || "", W / 2 - 40, bandY + 76);
      ctx.font = `46px ${FONT_UI}`; ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.textAlign = "left"; ctx.fillText(mYear || "", W / 2 - 40 + ctx.measureText(mName || "").width / 2 + 80, bandY + 72);
      for (const [id, x, dir, on] of [["prev", 70, -1, m.hasPrev], ["next", W - 70, 1, m.hasNext]]) {
        ctx.fillStyle = on ? "#fff" : "rgba(255,255,255,0.3)"; ctx.beginPath(); ctx.arc(x, bandY + bandH / 2, 36, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = on ? accent : "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.moveTo(x - 10 * dir, bandY + bandH / 2 - 17); ctx.lineTo(x + 13 * dir, bandY + bandH / 2); ctx.lineTo(x - 10 * dir, bandY + bandH / 2 + 17); ctx.closePath(); ctx.fill();
        if (on) regions.push({ id: "cal:" + id, x: x - 70, y: 0, w: 140, h: bandY + bandH + 10 });
      }
      // month grid on the left
      const key = m.key != null ? m.key : null;
      const top = bandY + bandH + 18, gx = 30, gw = 440, rows = m.rows || [];
      if (key != null) {
        const y = Math.floor(key / 12), mo = key % 12;
        const offset = (new Date(Date.UTC(y, mo, 1)).getUTCDay() + 6) % 7, len = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
        const cw = gw / 7, ch = Math.min(58, (H - top - 50) / 6.4);
        ctx.font = `28px ${FONT_UI}`; ctx.textAlign = "center";
        ["L", "M", "M", "J", "V", "S", "D"].forEach((d, k) => { ctx.fillStyle = k >= 5 ? "#c0262d" : "#8b8174"; ctx.fillText(d, gx + cw * k + cw / 2, top + 26); });
        const byDay = Object.fromEntries(rows.map((r) => [r.day, r]));
        for (let d = 1; d <= len; d++) {
          const i = offset + d - 1, cx = gx + cw * (i % 7) + cw / 2, cy = top + 44 + ch * Math.floor(i / 7) + ch / 2;
          const r = byDay[d];
          if (r) { ctx.fillStyle = r.result ? tone[r.result] : accent; ctx.beginPath(); ctx.arc(cx, cy, ch * 0.44, 0, Math.PI * 2); ctx.fill(); }
          ctx.fillStyle = r ? "#fff" : (i % 7 >= 5 ? "#c0262d" : "#3b352e"); ctx.font = `${r ? 32 : 30}px ${FONT_UI}`; ctx.fillText(String(d), cx, cy + 11);
          if (r) regions.push({ id: "match:" + r.id, x: cx - cw / 2, y: cy - ch / 2, w: cw, h: ch });
        }
      }
      // a line between the grid and the list, like a fold
      ctx.strokeStyle = "rgba(0,0,0,0.1)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gx + gw + 24, top); ctx.lineTo(gx + gw + 24, H - 24); ctx.stroke();
      // the matches of the month
      const lx = gx + gw + 50, lw = W - lx - 30;
      const rowH = Math.min(96, (H - top - 20) / Math.max(1, rows.length));
      if (!rows.length) { ctx.fillStyle = "#8a7f72"; ctx.textAlign = "center"; ctx.font = `48px ${FONT_HAND}`; ctx.fillText("Pas de match ce mois-ci", lx + lw / 2, top + 140); }
      rows.forEach((r, k) => {
        const y0 = top + k * rowH, mid = y0 + rowH / 2, fs = Math.min(44, rowH * 0.46);
        if (k) { ctx.strokeStyle = "rgba(0,0,0,0.08)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lx, y0); ctx.lineTo(lx + lw, y0); ctx.stroke(); }
        ctx.textAlign = "left"; ctx.fillStyle = r.result ? tone[r.result] : accent; ctx.font = `${fs}px ${FONT_UI}`; ctx.fillText(`${r.wd.replace(".", "")} ${r.day}`, lx, mid + fs * 0.35);
        ctx.fillStyle = "#1b1b1b"; fitFont(ctx, "vs " + r.opponent, FONT_UI, fs, lw - 400); ctx.fillText("vs " + r.opponent, lx + 130, mid + fs * 0.35);
        const sx = lx + lw - 200;
        if (r.score) { ctx.fillStyle = tone[r.result] || "#8a8a8a"; roundRect(ctx, sx - 75, mid - fs * 0.68, 150, fs * 1.36, 14); ctx.fill(); ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = `${fs * 0.95}px ${FONT_UI}`; ctx.fillText(r.score, sx, mid + fs * 0.32); }
        else { ctx.fillStyle = "#6b6257"; ctx.textAlign = "center"; ctx.font = `${fs * 0.85}px ${FONT_UI}`; ctx.fillText(r.hour || "", sx, mid + fs * 0.3); }
        if (r.rating != null) { const rx = lx + lw - 40; ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.arc(rx, mid, fs * 0.72, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#1b1b1b"; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = "#1b1b1b"; ctx.textAlign = "center"; ctx.font = `${fs * 0.62}px ${FONT_UI}`; ctx.fillText(r.rating.toFixed(1), rx, mid + fs * 0.22); }
        regions.push({ id: "match:" + r.id, x: lx - 10, y: y0, w: lw + 20, h: rowH });
      });
      s.mesh.userData.regions = regions;
      s.tex.needsUpdate = true;
    }

    // ---------- camera ----------
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const HALF = Math.tan(THREE.MathUtils.degToRad(18));
    function preset(zone) {
      const a = camera.aspect, fitW = (w) => w / (2 * HALF * a), fitH = (h) => h / (2 * HALF);
      // positions in the corner's own frame (x around 0, wall at z = -0.75, facing +z)
      if (zone === "board") { const d = Math.max(fitW(1.55), fitH(2.75)); return { theta: corners.board.theta, pos: V(0, 0.6, -0.7 + d), look: V(0, 0.55, -0.7) }; }
      if (zone === "desk") { const h = Math.max(fitW(1.46), fitH(2.14)); return { theta: corners.desk.theta, pos: V(0, DY + h, DZ + 0.03 + h * 0.18), look: V(0, DY, DZ + 0.03) }; }
      const d = Math.max(3.0, fitW(a < 0.8 ? 1.3 : 1.8));
      return { theta: corners.rack.theta, pos: V(0, a < 0.8 ? 0.42 : 0.6, d), look: V(0, a < 0.8 ? 0.2 : 0.42, 0) };
    }
    // corner frame → world: the frame sits at distance R from the centre, turned by theta
    const toWorld = (v, theta) => v.clone().add(V(0, 0, -R)).applyAxisAngle(UP, theta);
    const cam = { zone: opts.zone || "rack", from: null, to: null, t: 1, cur: null };
    function place(state) { camera.position.copy(toWorld(state.pos, state.theta)); camera.lookAt(toWorld(state.look, state.theta)); }
    function setZone(zone, instant) {
      if (zone === cam.zone && cam.t >= 1 && !instant) return;
      const target = preset(zone);
      cam.from = cam.cur ? { theta: cam.cur.theta, pos: cam.cur.pos.clone(), look: cam.cur.look.clone() } : target;
      // turn the short way round (120° between corners)
      let d = target.theta - cam.from.theta; d = ((d + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
      cam.to = { ...target, theta: cam.from.theta + d };
      cam.zone = zone; cam.t = instant || reduced ? 1 : 0; cam.start = performance.now();
      if (cam.t >= 1) { cam.cur = { theta: target.theta, pos: target.pos.clone(), look: target.look.clone() }; place(cam.cur); cb.onArrive(zone); }
    }
    function resize() {
      const w = container.clientWidth || 1, h = container.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      if (cam.t >= 1) setZone(cam.zone, true);
    }

    // ---------- input ----------
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    let drag = null;
    const pxPerShirt = () => Math.max(70, container.clientWidth / 6);
    function hit(ev, objects) {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.intersectObjects(objects, false)[0] || null;
    }
    function regionAt(h) {
      const mesh = h.object, regs = mesh.userData.regions || [], map = mesh.material.map, c = map && map.image;
      if (!c || !h.uv) return null;
      const k = mesh.userData.scale || 1, x = (h.uv.x * c.width) / k, y = ((1 - h.uv.y) * c.height) / k;
      return regs.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) || null;
    }
    const el = renderer.domElement;
    let boardRedraw = 0;
    function boardPxPerScreenPx() { // logical board height / its height on screen
      const box = new THREE.Box3().setFromObject(board), a = box.min.clone().project(camera), b = box.max.clone().project(camera);
      const screenH = Math.abs(a.y - b.y) / 2 * container.clientHeight;
      return screenH > 10 ? (boardCanvas.height / (board.userData.scale || 1)) / screenH : 1;
    }
    el.addEventListener("pointerdown", (e) => {
      drag = { x: e.clientX, y: e.clientY, last: e.clientX, t: performance.now(), scroll: rack.scroll, moved: 0, vel: 0 };
      if (cam.zone === "rack") el.setPointerCapture(e.pointerId);
      if (cam.zone === "board" && boardList.max > 0) { drag.boardScroll = boardList.scroll; el.setPointerCapture(e.pointerId); } // a vertical swipe scrolls the board's list
    });
    el.addEventListener("pointermove", (e) => {
      if (!drag) return;
      drag.moved = Math.max(drag.moved, Math.abs(e.clientX - drag.x), Math.abs(e.clientY - drag.y));
      if (cam.zone === "board" && drag.boardScroll != null && lastBoard) {
        // board units per screen pixel, from the board's height on screen (no hit test needed while the finger leaves it)
        const k = boardPxPerScreenPx();
        boardList.scroll = Math.min(boardList.max, Math.max(0, drag.boardScroll - (e.clientY - drag.y) * k));
        if (!boardRedraw) boardRedraw = requestAnimationFrame(() => { boardRedraw = 0; if (lastBoard) drawBoard(lastBoard); });
        return;
      }
      if (cam.zone !== "rack" || !rack.shirts.length) return;
      const now = performance.now();
      rack.scroll = Math.min(rack.squad.length - 0.7, Math.max(-0.3, drag.scroll - (e.clientX - drag.x) / pxPerShirt()));
      drag.vel = -(e.clientX - drag.last) / pxPerShirt() / Math.max(1, now - drag.t) * 1000;
      drag.last = e.clientX; drag.t = now; drag.active = drag.moved > 6;
    });
    el.addEventListener("pointerup", (e) => {
      const d = drag; drag = null;
      if (!d) return;
      if (cam.zone === "rack") {
        if (d.moved < 8) {
          const h = hit(e, rack.shirts.flatMap((s) => [s.backMesh, s.frontMesh]));
          if (!h) return;
          const i = h.object.userData.shirt;
          if (i === Math.round(rack.target)) { const s = rack.shirts[i]; s.flip = s.flip ? 0 : 1; }
          else selectShirt(i);
          return;
        }
        selectShirt(Math.round(rack.scroll + d.vel * 0.18));
        return;
      }
      if (d.moved >= 10) return;
      const surfaces = cam.zone === "board" ? [board] : [nextSheet.mesh, listSheet.mesh, calSheet.mesh];
      const h = hit(e, surfaces);
      if (!h) return;
      const r = regionAt(h);
      cb.onTap(h.object.userData.surface, r ? r.id : null);
    });
    el.addEventListener("pointercancel", () => { if (drag && cam.zone === "rack") selectShirt(Math.round(rack.scroll)); drag = null; });

    // ---------- loop ----------
    const clock = new THREE.Clock();
    let raf = 0, paused = false;
    function frame() {
      raf = requestAnimationFrame(frame);
      if (paused) return;
      const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
      // camera travel: an arc that pulls back and up between corners
      if (cam.t < 1) {
        cam.t = Math.min(1, (performance.now() - cam.start) / 1250); // real time, whatever the frame rate
        const e = easeInOut(cam.t), arc = Math.sin(Math.PI * e);
        const pos = new THREE.Vector3().lerpVectors(cam.from.pos, cam.to.pos, e), look = new THREE.Vector3().lerpVectors(cam.from.look, cam.to.look, e);
        cam.cur = { theta: cam.from.theta + (cam.to.theta - cam.from.theta) * e, pos, look };
        if (cam.t >= 1) { cam.cur.theta = ((cam.to.theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); cb.onArrive(cam.zone); }
        // swing around the centre, stepping back a little and up mid-way
        place({ theta: cam.cur.theta, pos: pos.clone().add(V(0, 0.3 * arc, 0.9 * arc)), look });
      }
      // rack
      const k = reduced ? 1 : 1 - Math.pow(0.0015, dt);
      if (!drag || cam.zone !== "rack") rack.scroll = ease(rack.scroll, rack.target, k);
      rack.shirts.forEach((s, i) => {
        const d = i - rack.scroll, ad = Math.abs(d), w = Math.max(0, 1 - ad), sign = Math.sign(d) || 0;
        const x = d * SP + sign * GAP * Math.min(1, ad);
        const ry = -sign * 1.45 * (1 - w) + s.flip * Math.PI;
        s.x = ease(s.x, x, k); s.z = ease(s.z, 0.6 * w * w, k); s.ry = ease(s.ry, ry, reduced ? 1 : 1 - Math.pow(0.01, dt));
        const sway = reduced ? 0 : Math.sin(t * 1.3 + s.phase) * (0.01 + 0.018 * w);
        s.group.position.set(s.x, RAIL_Y, s.z); s.group.rotation.set(0, s.ry, sway);
      });
      for (const f of tickers) f(dt, t);
      renderer.render(scene, camera);
    }

    const ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(container); else window.addEventListener("resize", resize);
    resize();
    setZone(cam.zone, true);
    frame();

    return {
      setZone,
      zone: () => cam.zone,
      setSquad(list, kit, selectedId) {
        const sameKit = kit === rack.kit, sameList = rack.squad.map((p) => p.id + ":" + p.num).join() === list.map((p) => p.id + ":" + p.num).join();
        rack.kit = kit; rack.squad = list.map((p) => ({ ...p }));
        if (selectedId != null) { const i = list.findIndex((p) => p.id === selectedId); if (i >= 0) { rack.target = rack.scroll = i; } }
        rack.target = Math.min(rack.target, Math.max(0, list.length - 1)); rack.scroll = Math.min(rack.scroll, rack.target + 0.5);
        if (!(sameKit && sameList)) buildRack().then(() => cb.onShirt(Math.round(rack.target), rack.squad[Math.round(rack.target)]));
        rack.shirts.forEach((s) => (s.flip = 0));
        // spin the shirts once when the kit changes
        if (!sameKit && rack.shirts.length) rack.shirts.forEach((s) => (s.ry += Math.PI * 2));
      },
      // Everything loaded and drawn once from each corner: the GPU has every texture and shader, so nothing stalls later.
      async warm(maxMs = 15000) {
        const until = (p) => Promise.race([p, new Promise((r) => setTimeout(r, maxMs))]);
        await until(Promise.all([rackReady, ...pending]));
        await until(new Promise((r) => { const check = () => (Object.values(faceImgs).some((v) => v === "loading") ? setTimeout(check, 120) : r()); check(); }));
        await until(Promise.all(pending)); // late ones (env reflections) started while waiting
        renderer.compile(scene, camera);
        const keep = cam.cur;
        for (const z of ["desk", "board", "rack"]) { place(preset(z)); renderer.render(scene, camera); }
        if (keep) place(keep); else place(preset(cam.zone));
        renderer.render(scene, camera);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      },
      select: (i) => selectShirt(i),
      selectId(id) { const i = rack.squad.findIndex((p) => p.id === id); if (i >= 0) selectShirt(i); return i >= 0; },
      step: (n) => selectShirt(Math.round(rack.target) + n),
      setBoard: drawBoard,
      setDesk(m) { lastDesk = m; drawNext(m.next); drawList(m.upcoming); drawCalendar(m.calendar); },
      setAccent(accent, deep) { mugMat.color.set(accent); nb.material.color.set(deep || accent); opts.accent = accent; },
      pause(p) { paused = !!p; if (!p) { clock.getDelta(); resize(); } },
      destroy() {
        cancelAnimationFrame(raf); if (ro) ro.disconnect(); else window.removeEventListener("resize", resize);
        clearShirts(); renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss();
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      },
    };
  }

  // three.js and the fonts the room draws with, loaded once, only when the room is opened.
  let loading = null;
  function ensureLoaded() {
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      let css = Promise.resolve();
      if (!document.getElementById("foot-room-fonts")) {
        const l = document.createElement("link"); l.id = "foot-room-fonts"; l.rel = "stylesheet";
        l.href = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Caveat:wght@600&family=Permanent+Marker&display=swap";
        css = new Promise((r) => { l.onload = l.onerror = r; setTimeout(r, 4000); }); // the @font-face rules must exist before fonts.load
        document.head.appendChild(l);
      }
      const fonts = () => document.fonts ? css.then(() => Promise.race([Promise.all(["40px 'Permanent Marker'", "40px Caveat", "40px 'Bebas Neue'", "40px 'Contrail One'", "40px Shrikhand"].map((f) => document.fonts.load(f).catch(() => {}))), new Promise((r) => setTimeout(r, 3000))])) : Promise.resolve();
      if (window.THREE) { fonts().then(resolve); return; }
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
      s.onload = () => fonts().then(resolve);
      s.onerror = () => { loading = null; reject(new Error("three.js n'a pas pu se charger")); };
      document.head.appendChild(s);
    });
    return loading;
  }

  window.FootRoom = { create, ensureLoaded };
})();
