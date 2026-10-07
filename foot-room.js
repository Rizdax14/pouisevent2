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
  const DX = -6.4, DY = -0.28, DZ = 0.75; // desk top centre
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
    const low = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 4) <= 3;
    const cb = { onShirt: opts.onShirt || (() => {}), onTap: opts.onTap || (() => {}), onReady: opts.onReady || (() => {}) };

    // ---------- renderer ----------
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(low ? 1.5 : 2, window.devicePixelRatio || 1));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.domElement.style.cssText = "display:block;width:100%;height:100%;touch-action:none";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#100c0e");
    scene.fog = new THREE.Fog("#100c0e", 6, 14);
    const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 40);
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
    const finish = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.encoding = THREE.sRGBEncoding; t.anisotropy = renderer.capabilities.getMaxAnisotropy ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4; return t; };
    const canvas2d = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

    // ---------- lights ----------
    scene.add(new THREE.HemisphereLight("#fff2f8", "#2a1d22", 0.3));
    const spot = new THREE.SpotLight("#fff3f8", 1.3, 14, 0.62, 0.8, 1.0);
    spot.position.set(0.5, 3.6, 3.2);
    spot.target.position.set(0, 0.3, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0005; spot.shadow.normalBias = 0.02; spot.shadow.radius = 9; spot.shadow.blurSamples = 16;
    scene.add(spot, spot.target);
    const fill = new THREE.DirectionalLight("#ffffff", 0.18); fill.position.set(0, 0.8, 4); scene.add(fill);
    const rim = new THREE.DirectionalLight("#e6c6ff", 0.4); rim.position.set(-3, 2, -1); scene.add(rim);
    const boardLight = new THREE.SpotLight("#fffaf0", 1.25, 9, 0.75, 0.7, 1.2);
    boardLight.position.set(BX, 2.9, 2.2); boardLight.target.position.set(BX, 0.5, -0.7); scene.add(boardLight, boardLight.target);
    const lamp = new THREE.PointLight("#ffd9a0", 1.1, 4.5, 1.6); lamp.position.set(DX + 0.95, DY + 1.0, DZ - 0.55); scene.add(lamp);
    const deskTop = new THREE.SpotLight("#fff6ea", 0.9, 8, 0.8, 0.8, 1.2);
    deskTop.position.set(DX, 2.8, DZ + 1.2); deskTop.target.position.set(DX, DY, DZ); scene.add(deskTop, deskTop.target);

    // ---------- room ----------
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
    const wood = woodTexture(); wood.repeat.set(10, 1);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(26, 5), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.85 }));
    wall.position.set(0, 0.8, -0.75); wall.receiveShadow = true;
    const floorMat = new THREE.MeshStandardMaterial({ color: "#140e10", roughness: 0.95 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(26, 8), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, -0.8, 2); floor.receiveShadow = true;
    const shelfMat = new THREE.MeshStandardMaterial({ color: "#35241b", roughness: 0.7 });
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.06, 0.7), shelfMat); shelf.position.set(0, RAIL_Y + 0.42, -0.4); shelf.castShadow = true;
    const benchWood = woodTexture(24, 16); benchWood.repeat.set(3, 1);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.08, 0.55), new THREE.MeshStandardMaterial({ map: benchWood, roughness: 0.6 }));
    bench.position.set(0, -0.42, -0.35); bench.castShadow = bench.receiveShadow = true;
    const steel = new THREE.MeshStandardMaterial({ color: "#cfc8cc", metalness: 0.9, roughness: 0.28, envMap });
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 8.2, 16), steel); rail.rotation.z = Math.PI / 2; rail.position.y = RAIL_Y;
    scene.add(wall, floor, shelf, bench, rail);
    // separating posts between the corners
    for (const x of [-4.3, 4.3]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 5, 0.3), new THREE.MeshStandardMaterial({ color: "#241812", roughness: 0.8 }));
      post.position.set(x, 0.8, -0.6); scene.add(post);
    }

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
    const kitCache = {};
    async function loadKit(kit) {
      if (kitCache[kit]) return kitCache[kit];
      const base = KIT_BASE + kit + "/";
      const [meta, front, back, collar] = await Promise.all([fetch(base + "kit.json?v=2").then((r) => r.json()), loadImg(base + "front.png?v=2"), loadImg(base + "back.png?v=2"), loadImg(base + "collar.png?v=2")]);
      kitCache[kit] = { kit, base, meta, front, back, collar, flocs: {} };
      return kitCache[kit];
    }
    async function flocageFor(K, p) {
      if (K.flocs[p.id] !== undefined) return K.flocs[p.id];
      const f = K.meta.flocages[p.id];
      K.flocs[p.id] = f ? { img: await loadImg(`${K.base}flocages/${p.id}.png?v=2`), x: f.x, y: f.y } : null;
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
        scene.remove(s.group);
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
        scene.add(group);
        rack.shirts.push(s);
      });
      cb.onReady("rack");
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
    const boardCanvas = canvas2d(1024, Math.round(1024 * BOARD_H / BOARD_W));
    const boardTex = finish(boardCanvas);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_W, BOARD_H), new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.35, metalness: 0.0 }));
    board.position.set(BX, BOARD_Y, -0.7);
    board.userData.surface = "board";
    const alu = new THREE.MeshStandardMaterial({ color: "#b9bcc2", metalness: 0.8, roughness: 0.35, envMap });
    const frameParts = [
      [BOARD_W + 0.08, 0.04, 0, BOARD_H / 2 + 0.02], [BOARD_W + 0.08, 0.04, 0, -BOARD_H / 2 - 0.02],
      [0.04, BOARD_H + 0.08, BOARD_W / 2 + 0.02, 0], [0.04, BOARD_H + 0.08, -BOARD_W / 2 - 0.02, 0],
    ];
    for (const [w, h, x, y] of frameParts) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), alu); m.position.set(BX + x, BOARD_Y + y, -0.69); scene.add(m); }
    const tray = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W * 0.8, 0.02, 0.07), alu); tray.position.set(BX, BOARD_Y - BOARD_H / 2 - 0.05, -0.66);
    scene.add(board, tray);
    // markers in the tray
    [["#1b2a8f", -0.25], ["#c0262d", -0.12], ["#151515", 0.02]].forEach(([col, x], k) => {
      const mk = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.13, 12), new THREE.MeshStandardMaterial({ color: col, roughness: 0.5 }));
      mk.rotation.z = Math.PI / 2 + (k - 1) * 0.05; mk.position.set(BX + x, BOARD_Y - BOARD_H / 2 - 0.028, -0.655); scene.add(mk);
    });
    // trophy shelf under the board
    const tShelf = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.36), shelfMat); tShelf.position.set(BX, -0.42, -0.55); tShelf.castShadow = tShelf.receiveShadow = true; scene.add(tShelf);
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
    [[gold, 0.62, 0], [silver, 0.48, -0.45], [gold, 0.42, 0.46]].forEach(([m, s, x]) => { const t = trophy(m, s); t.position.set(BX + x, -0.395 + 0.12 * s, -0.55); scene.add(t); });
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
    ball.position.set(BX - 0.55, -0.69, 0.25); ball.rotation.set(0.4, 0.8, 0); ball.castShadow = true; scene.add(ball);
    const coneMat = new THREE.MeshStandardMaterial({ color: "#f26a1b", roughness: 0.6 });
    [[0.62, 0.15], [0.42, 0.42]].forEach(([x, z]) => { const cone = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 24, 1, true), coneMat); cone.position.set(BX + x, -0.7, z); cone.castShadow = true; scene.add(cone);
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.012, 24), coneMat); ring.position.set(BX + x, -0.794, z); scene.add(ring); });

    // ---------- desk corner ----------
    const deskWood = woodTexture(26, 22); deskWood.repeat.set(2, 1);
    const deskMat = new THREE.MeshStandardMaterial({ map: deskWood, roughness: 0.55 });
    const desk = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.07, 1.6), deskMat); desk.position.set(DX, DY - 0.035, DZ); desk.receiveShadow = true; scene.add(desk);
    for (const [x, z] of [[-1.15, -0.7], [1.15, -0.7], [-1.15, 0.7], [1.15, 0.7]]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.07), deskMat); leg.position.set(DX + x, DY - 0.32, DZ + z); scene.add(leg); }
    // framed club crest above the desk
    loadImg("/logo-bl.png").then((im) => {
      if (!im) return;
      const c = canvas2d(512, 512), ctx = c.getContext("2d");
      ctx.fillStyle = "#f3efe6"; ctx.fillRect(0, 0, 512, 512);
      const s = 380 / Math.max(im.width, im.height); ctx.drawImage(im, 256 - im.width * s / 2, 256 - im.height * s / 2, im.width * s, im.height * s);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.03), new THREE.MeshStandardMaterial({ color: "#1c1512", roughness: 0.6 }));
      frame.position.set(DX, 0.85, -0.72);
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.54), new THREE.MeshStandardMaterial({ map: finish(c), roughness: 0.8 }));
      pic.position.set(DX, 0.85, -0.70);
      scene.add(frame, pic);
    });
    // papers lie flat on the desk (top of the sheet = away from the camera)
    function sheet(w, h, cw) {
      const c = canvas2d(cw, Math.round(cw * h / w));
      const tex = finish(c);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
      m.rotation.x = -Math.PI / 2; m.receiveShadow = true;
      return { mesh: m, canvas: c, tex, regions: [] };
    }
    const nextSheet = sheet(0.56, 0.78, 720); nextSheet.mesh.position.set(DX - 0.31, DY + 0.002, DZ - 0.62); nextSheet.mesh.rotation.z = 0.05; nextSheet.mesh.userData.surface = "next";
    const listSheet = sheet(0.56, 0.78, 720); listSheet.mesh.position.set(DX + 0.31, DY + 0.003, DZ - 0.58); listSheet.mesh.rotation.z = -0.06; listSheet.mesh.userData.surface = "list";
    const calSheet = sheet(1.16, 0.92, 1280); calSheet.mesh.position.set(DX, DY + 0.004, DZ + 0.36); calSheet.mesh.userData.surface = "calendar";
    scene.add(nextSheet.mesh, listSheet.mesh, calSheet.mesh);
    // calendar pad thickness + binding rings
    const pad = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.02, 0.94), new THREE.MeshStandardMaterial({ color: "#e9e4d8", roughness: 0.9 })); pad.position.set(DX, DY - 0.008, DZ + 0.36); scene.add(pad);
    for (let k = 0; k < 9; k++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 16), steel); ring.position.set(DX - 0.48 + k * 0.12, DY + 0.01, DZ - 0.1); scene.add(ring); }
    // mug, pen, whistle, notebook, lamp
    const mugMat = new THREE.MeshStandardMaterial({ color: opts.accent || "#2f8f5b", roughness: 0.4 });
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.13, 24, 1, true), mugMat); mug.position.set(DX + 0.8, DY + 0.065, DZ + 0.05); mug.castShadow = true;
    const mugIn = new THREE.Mesh(new THREE.CircleGeometry(0.055, 24), new THREE.MeshStandardMaterial({ color: "#3b2416", roughness: 0.2 })); mugIn.rotation.x = -Math.PI / 2; mugIn.position.set(DX + 0.8, DY + 0.11, DZ + 0.05);
    const mugH = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.009, 8, 16), mugMat); mugH.position.set(DX + 0.865, DY + 0.07, DZ + 0.05); mugH.rotation.y = Math.PI / 2;
    const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.26, 10), new THREE.MeshStandardMaterial({ color: "#1b2a8f", roughness: 0.3 })); pen.rotation.set(Math.PI / 2, 0, 0.6); pen.position.set(DX + 0.68, DY + 0.009, DZ - 0.15); pen.castShadow = true;
    const nb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.66), new THREE.MeshStandardMaterial({ color: opts.accentDeep || "#1d5a3a", roughness: 0.7 })); nb.position.set(DX - 0.85, DY + 0.015, DZ + 0.2); nb.rotation.y = 0.18; nb.castShadow = true;
    const whistle = new THREE.Group();
    const wb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), steel); const wm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.025, 0.03), steel); wm.position.x = 0.045; whistle.add(wb, wm);
    whistle.position.set(DX + 0.72, DY + 0.035, DZ + 0.45); whistle.rotation.y = 0.8;
    const lampMat = new THREE.MeshStandardMaterial({ color: "#1a1a1c", metalness: 0.5, roughness: 0.4, envMap });
    const lampG = new THREE.Group();
    const lb = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.03, 24), lampMat);
    const la1 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.55, 8), lampMat); la1.position.set(0, 0.27, 0); la1.rotation.z = 0.25;
    const la2 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 8), lampMat); la2.position.set(-0.13, 0.6, 0.1); la2.rotation.set(0.9, 0, 0.6);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.16, 24, 1, true), lampMat); shade.position.set(-0.22, 0.72, 0.28); shade.rotation.x = 0.9;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), new THREE.MeshBasicMaterial({ color: "#ffe2a8" })); bulb.position.set(-0.22, 0.68, 0.31);
    lampG.add(lb, la1, la2, shade, bulb); lampG.position.set(DX + 1.0, DY + 0.015, DZ - 0.6); lampG.rotation.y = -0.5;
    scene.add(mug, mugIn, mugH, pen, nb, whistle, lampG);

    // ---------- drawing helpers ----------
    function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function fitFont(ctx, text, family, size, maxW) { let s = size; ctx.font = `${s}px ${family}`; while (ctx.measureText(text).width > maxW && s > 10) { s -= 2; ctx.font = `${s}px ${family}`; } return s; }
    function wobbleLine(ctx, x1, y1, x2, y2, seed = 1) { ctx.beginPath(); ctx.moveTo(x1, y1); const n = 6; for (let k = 1; k <= n; k++) { const t = k / n; ctx.lineTo(x1 + (x2 - x1) * t + Math.sin(seed * 9 + k * 2.1) * 1.5, y1 + (y2 - y1) * t + Math.sin(seed * 7 + k * 1.7) * 2); } ctx.stroke(); }
    function circleAround(ctx, x, y, w, h, color) { ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2 + 12, h / 2 + 8, -0.03, 0.15, Math.PI * 2 + 0.35); ctx.stroke(); ctx.restore(); }

    // Whiteboard: Équipe / Individuel, the ranking categories and the table, in marker.
    function drawBoard(m) {
      const c = boardCanvas, ctx = c.getContext("2d"), W = c.width, H = c.height;
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
      if (m.season) { ctx.fillStyle = blue; ctx.font = `34px ${FONT_MARKER}`; ctx.fillText(m.season, W / 2, 178); }
      // Équipe / Individuel
      const modes = [["team", "ÉQUIPE"], ["indiv", "INDIVIDUEL"]];
      modes.forEach(([key, label], k) => {
        const x = k === 0 ? W * 0.27 : W * 0.7, y = 258;
        ctx.font = `46px ${FONT_MARKER}`; ctx.fillStyle = m.mode === key ? ink : "#8a909a";
        const w = ctx.measureText(label).width; ctx.fillText(label, x, y);
        if (m.mode === key) circleAround(ctx, x - w / 2, y - 44, w, 52, red);
        regions.push({ id: "mode:" + key, x: x - w / 2 - 30, y: y - 70, w: w + 60, h: 100 });
      });
      ctx.strokeStyle = "#c9ccd2"; ctx.lineWidth = 3; wobbleLine(ctx, 60, 300, W - 60, 302, 5);
      if (m.mode === "team") {
        ctx.fillStyle = ink; ctx.font = `58px ${FONT_MARKER}`; ctx.fillText("Bientôt", W / 2, 620);
        ctx.fillStyle = blue; ctx.font = `36px ${FONT_MARKER}`; ctx.fillText("le classement du championnat", W / 2, 690); ctx.fillText("arrive ici", W / 2, 738);
        // a tactics doodle
        ctx.strokeStyle = blue; ctx.lineWidth = 4;
        [[300, 900], [500, 860], [720, 920], [420, 1040], [620, 1060]].forEach(([x, y], k) => { ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.stroke(); if (k) { ctx.save(); ctx.setLineDash([12, 10]); wobbleLine(ctx, x - 30, y + 10, 300 + 20, 900 + 20, k); ctx.restore(); } });
        ctx.strokeStyle = red; [[380, 960], [560, 960]].forEach(([x, y]) => { ctx.beginPath(); ctx.moveTo(x - 18, y - 18); ctx.lineTo(x + 18, y + 18); ctx.moveTo(x + 18, y - 18); ctx.lineTo(x - 18, y + 18); ctx.stroke(); });
      } else {
        // categories
        const tabs = m.tabs || [];
        ctx.font = `34px ${FONT_MARKER}`;
        const widths = tabs.map((t) => ctx.measureText(t.label).width), gap = 34;
        let x = (W - (widths.reduce((a, b) => a + b, 0) + gap * (tabs.length - 1))) / 2;
        tabs.forEach((t, k) => {
          const on = t.key === m.tab, y = 368;
          ctx.fillStyle = on ? blue : "#8a909a"; ctx.textAlign = "left"; ctx.fillText(t.label, x, y);
          if (on) { ctx.strokeStyle = blue; ctx.lineWidth = 4; wobbleLine(ctx, x - 4, y + 12, x + widths[k] + 4, y + 10, k + 1); }
          regions.push({ id: "tab:" + t.key, x: x - gap / 2, y: y - 50, w: widths[k] + gap, h: 80 });
          x += widths[k] + gap;
        });
        ctx.textAlign = "center";
        const e = m.entries || [];
        if (!e.length) {
          ctx.fillStyle = "#6a707a"; ctx.font = `40px ${FONT_MARKER}`; ctx.fillText("Pas encore de classement", W / 2, 640);
        } else {
          // podium 2 - 1 - 3
          const base = 820, colW = 270, heights = { 1: 210, 2: 150, 3: 110 };
          [[e[1], 2, W / 2 - colW], [e[0], 1, W / 2], [e[2], 3, W / 2 + colW]].forEach(([en, place, cx]) => {
            if (!en) return;
            const hgt = heights[place];
            ctx.strokeStyle = ink; ctx.lineWidth = 5; ctx.beginPath(); ctx.rect(cx - colW / 2 + 16, base - hgt, colW - 32, hgt); ctx.stroke();
            ctx.fillStyle = place === 1 ? red : ink; ctx.font = `${place === 1 ? 84 : 66}px ${FONT_MARKER}`; ctx.fillText(String(place), cx, base - hgt / 2 + 26);
            ctx.fillStyle = ink; fitFont(ctx, en.name, FONT_MARKER, place === 1 ? 44 : 38, colW - 20); ctx.fillText(en.name, cx, base - hgt - 62);
            ctx.fillStyle = blue; ctx.font = `${place === 1 ? 44 : 36}px ${FONT_MARKER}`; ctx.fillText(en.value, cx, base - hgt - 16);
            regions.push({ id: "player:" + en.playerId, x: cx - colW / 2, y: base - hgt - 120, w: colW, h: hgt + 120 });
          });
          ctx.strokeStyle = ink; ctx.lineWidth = 5; wobbleLine(ctx, W / 2 - colW * 1.5 + 4, base + 2, W / 2 + colW * 1.5 - 4, base, 8);
          // 4th and after
          let y = base + 92;
          e.slice(3, 10).forEach((en, k) => {
            ctx.textAlign = "left"; ctx.fillStyle = "#6a707a"; ctx.font = `36px ${FONT_MARKER}`; ctx.fillText(`${k + 4}.`, 150, y);
            ctx.fillStyle = ink; fitFont(ctx, en.name, FONT_MARKER, 38, 480); ctx.fillText(en.name, 220, y);
            ctx.textAlign = "right"; ctx.fillStyle = blue; ctx.font = `38px ${FONT_MARKER}`; ctx.fillText(en.value, W - 150, y);
            ctx.strokeStyle = "#d4d7dc"; ctx.lineWidth = 2; ctx.setLineDash([6, 10]); ctx.beginPath(); ctx.moveTo(220, y + 14); ctx.lineTo(W - 150, y + 14); ctx.stroke(); ctx.setLineDash([]);
            regions.push({ id: "player:" + en.playerId, x: 120, y: y - 48, w: W - 240, h: 64 });
            y += 66;
          });
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
      const s = nextSheet, c = s.canvas, ctx = c.getContext("2d"), W = c.width, H = c.height;
      paper(ctx, W, H, false);
      ctx.fillStyle = opts.accent || "#2f8f5b"; ctx.fillRect(0, 0, W, 120);
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = `46px ${FONT_UI}`; ctx.fillText("PROCHAIN MATCH", W / 2, 78);
      ctx.fillStyle = "#1b1b1b";
      if (!m) {
        ctx.font = `44px ${FONT_HAND}`; ctx.fillText("Aucun match prévu", W / 2, 360);
      } else {
        ctx.font = `34px ${FONT_UI}`; ctx.fillStyle = "#6b6257"; ctx.fillText(m.kicker || "", W / 2, 190);
        ctx.fillStyle = "#1b1b1b"; fitFont(ctx, "vs " + m.opponent, FONT_DISPLAY, 70, W - 80); ctx.fillText("vs " + m.opponent, W / 2, 290);
        ctx.font = `40px ${FONT_UI}`; ctx.fillText(m.date, W / 2, 380);
        ctx.font = `36px ${FONT_UI}`; ctx.fillText(m.hours, W / 2, 440);
        ctx.fillStyle = "#6b6257"; ctx.font = `30px ${FONT_UI}`;
        const words = (m.place || "").split(" "); let line = "", y = 520;
        for (const w of words) { if (ctx.measureText(line + w).width > W - 120) { ctx.fillText(line.trim(), W / 2, y); y += 40; line = ""; } line += w + " "; }
        if (line.trim()) ctx.fillText(line.trim(), W / 2, y);
        ctx.fillStyle = "#c0262d"; ctx.font = `48px ${FONT_HAND}`; ctx.save(); ctx.translate(W / 2, H - 110); ctx.rotate(-0.06); ctx.fillText(m.note || "Allez les gars !", 0, 0); ctx.restore();
      }
      ctx.fillStyle = "#9b8f80"; ctx.font = `24px ${FONT_UI}`; ctx.fillText("toucher pour ouvrir", W / 2, H - 30);
      s.mesh.userData.regions = [{ id: "next", x: 0, y: 0, w: W, h: H }];
      s.tex.needsUpdate = true;
    }
    function drawList(items) {
      const s = listSheet, c = s.canvas, ctx = c.getContext("2d"), W = c.width, H = c.height;
      paper(ctx, W, H, true);
      ctx.fillStyle = "#1b1b1b"; ctx.textAlign = "left"; ctx.font = `50px ${FONT_HAND}`; ctx.fillText("Les 3 prochains", 110, 110);
      const regions = [];
      if (!items || !items.length) { ctx.font = `40px ${FONT_HAND}`; ctx.fillText("Rien de prévu", 110, 300); }
      (items || []).slice(0, 3).forEach((it, k) => {
        const y = 230 + k * 156;
        ctx.fillStyle = "#1b2a8f"; ctx.font = `40px ${FONT_HAND}`; ctx.fillText(it.date, 110, y);
        ctx.fillStyle = "#1b1b1b"; fitFont(ctx, "vs " + it.opponent, FONT_HAND, 52, W - 140); ctx.fillText("vs " + it.opponent, 110, y + 54);
        ctx.fillStyle = "#6b6257"; ctx.font = `30px ${FONT_HAND}`; ctx.fillText(it.sub || "", 110, y + 96);
        regions.push({ id: "match:" + it.id, x: 0, y: y - 50, w: W, h: 150 });
      });
      s.mesh.userData.regions = regions;
      s.tex.needsUpdate = true;
    }
    function drawCalendar(m) {
      const s = calSheet, c = s.canvas, ctx = c.getContext("2d"), W = c.width, H = c.height;
      paper(ctx, W, H, false);
      const regions = [];
      ctx.fillStyle = "#1b1b1b"; ctx.textAlign = "center"; ctx.font = `64px ${FONT_UI}`; ctx.fillText(m.title, W / 2, 110);
      // month arrows
      ctx.fillStyle = opts.accent || "#2f8f5b";
      for (const [id, x, dir] of [["prev", 90, -1], ["next", W - 90, 1]]) {
        ctx.beginPath(); ctx.arc(x, 88, 48, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(x - 14 * dir, 66); ctx.lineTo(x + 16 * dir, 88); ctx.lineTo(x - 14 * dir, 110); ctx.closePath(); ctx.fill(); ctx.restore();
        regions.push({ id: "cal:" + id, x: x - 80, y: 20, w: 160, h: 140 });
      }
      const days = ["L", "M", "M", "J", "V", "S", "D"], cw = (W - 80) / 7, top = 170, rowH = (H - top - 30) / 6;
      ctx.font = `32px ${FONT_UI}`; ctx.fillStyle = "#8b8174";
      days.forEach((d, k) => ctx.fillText(d, 40 + cw * k + cw / 2, top));
      for (let k = 0; k < 42; k++) {
        const day = k - m.offset + 1; if (day < 1 || day > m.length) continue;
        const col = k % 7, row = Math.floor(k / 7), x = 40 + col * cw, y = top + 22 + row * rowH;
        const info = m.days[day];
        ctx.strokeStyle = "rgba(0,0,0,0.08)"; ctx.lineWidth = 2; ctx.strokeRect(x + 3, y, cw - 6, rowH - 6);
        if (m.today === day) { ctx.fillStyle = "rgba(255,210,80,0.35)"; ctx.fillRect(x + 3, y, cw - 6, rowH - 6); }
        ctx.textAlign = "left"; ctx.fillStyle = col >= 5 ? "#a3462d" : "#3b352e"; ctx.font = `30px ${FONT_UI}`; ctx.fillText(String(day), x + 12, y + 36);
        if (info) {
          const tone = info.tone === "win" ? "#2f8f5b" : info.tone === "loss" ? "#c0262d" : info.tone === "draw" ? "#8a7a2a" : (opts.accent || "#2f8f5b");
          ctx.fillStyle = tone; roundRect(ctx, x + 8, y + 46, cw - 16, rowH - 58, 12); ctx.fill();
          ctx.fillStyle = "#fff"; ctx.textAlign = "center";
          fitFont(ctx, info.top, FONT_UI, 30, cw - 26); ctx.fillText(info.top, x + cw / 2, y + 46 + (rowH - 58) / 2 - 2);
          fitFont(ctx, info.bottom, FONT_UI, 24, cw - 26); ctx.fillText(info.bottom, x + cw / 2, y + 46 + (rowH - 58) / 2 + 26);
          regions.push({ id: "match:" + info.id, x, y, w: cw, h: rowH });
        }
      }
      s.mesh.userData.regions = regions;
      s.tex.needsUpdate = true;
    }

    // ---------- camera ----------
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const HALF = Math.tan(THREE.MathUtils.degToRad(18));
    function preset(zone) {
      const a = camera.aspect, fitW = (w) => w / (2 * HALF * a), fitH = (h) => h / (2 * HALF);
      if (zone === "board") { const d = Math.max(fitW(1.55), fitH(2.75)); return { pos: V(BX, 0.6, -0.7 + d), look: V(BX, 0.55, -0.7) }; }
      if (zone === "desk") { const h = Math.max(fitW(1.32), fitH(2.15)); return { pos: V(DX, DY + h, DZ + 0.02 + h * 0.2), look: V(DX, DY, DZ + 0.02) }; }
      const d = Math.max(3.0, fitW(a < 0.8 ? 1.3 : 1.8));
      return { pos: V(0, a < 0.8 ? 0.42 : 0.6, d), look: V(0, a < 0.8 ? 0.2 : 0.42, 0) };
    }
    const cam = { zone: opts.zone || "rack", from: null, to: null, t: 1, look: V(0, 0.42, 0) };
    function setZone(zone, instant) {
      if (zone === cam.zone && cam.t >= 1 && !instant) return;
      const target = preset(zone);
      cam.from = { pos: camera.position.clone(), look: cam.look.clone() };
      cam.to = target; cam.zone = zone; cam.t = instant || reduced ? 1 : 0; cam.start = performance.now();
      if (cam.t >= 1) { camera.position.copy(target.pos); cam.look.copy(target.look); camera.lookAt(cam.look); }
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
      const x = h.uv.x * c.width, y = (1 - h.uv.y) * c.height;
      return regs.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) || null;
    }
    const el = renderer.domElement;
    el.addEventListener("pointerdown", (e) => {
      drag = { x: e.clientX, y: e.clientY, last: e.clientX, t: performance.now(), scroll: rack.scroll, moved: 0, vel: 0 };
      if (cam.zone === "rack") el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", (e) => {
      if (!drag) return;
      drag.moved = Math.max(drag.moved, Math.abs(e.clientX - drag.x), Math.abs(e.clientY - drag.y));
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
          if (i === Math.round(rack.target)) { const s = rack.shirts[i]; s.flip = s.flip ? 0 : 1; cb.onTap("shirt", rack.squad[i]); }
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
        camera.position.lerpVectors(cam.from.pos, cam.to.pos, e);
        camera.position.y += 0.35 * arc; camera.position.z += 1.1 * arc;
        cam.look.lerpVectors(cam.from.look, cam.to.look, e);
      }
      camera.lookAt(cam.look);
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
      select: (i) => selectShirt(i),
      step: (n) => selectShirt(Math.round(rack.target) + n),
      setBoard: drawBoard,
      setDesk(m) { drawNext(m.next); drawList(m.upcoming); drawCalendar(m.calendar); },
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
