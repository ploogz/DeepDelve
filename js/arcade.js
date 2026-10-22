/* ============================================================
   The Grand Arcade: the hideout's east wing, through a gate of stacked skulls
   - every game lives here: pool, poker, blackjack, Liar's Dice, Knucklebones, knife throwing,
     skull bowling (bowl.js), chess (chess.js), and from this file: rat races, Dragon Dice,
     Madame Morta's tarot, and the bar brawl in the sparring pit
   ============================================================ */
'use strict';
(() => {
  const T = G.tavern, TB = G.tables, GM = TB.GAMES, UI = G.ui, R = Math.random, TM = T.models;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const now = () => Date.now(), me = () => G.net.myId();
  const A = G.arcade = { bulbs: [], rats: [], brawlers: {}, fists: null };
  const AH = 9;   // the arcade's ceiling height

  /* ================= small builders ================= */
  const bone = () => G.mat('col', { c: 0xe2d6b8, r: 0.55 });
  A.skull = (s = 1, glow) => {
    const g = new THREE.Group(), b = bone();
    M.P(g, M.sph(0.16 * s, 14, 10), b, [0, 0.05 * s, 0], 0, [1, 0.9, 1.08]); M.P(g, M.box(0.17 * s, 0.07 * s, 0.13 * s), b, [0, -0.08 * s, 0.05 * s]);
    M.mirror(k => { M.P(g, M.sph(0.045 * s, 8, 6), G.mat('col', { c: 0x0a0806 }), [k * 0.058 * s, 0.06 * s, 0.13 * s]); if (glow) M.P(g, M.sph(0.016 * s, 6, 5), G.mat('emissive', { c: glow, i: 4 }), [k * 0.058 * s, 0.06 * s, 0.155 * s]); });
    M.P(g, M.box(0.03 * s, 0.03 * s, 0.02 * s), G.mat('col', { c: 0x0a0806 }), [0, -0.005 * s, 0.155 * s]);
    for (let i = -2; i <= 2; i++) M.P(g, M.box(0.02 * s, 0.03 * s, 0.015 * s), G.mat('col', { c: 0xf2ead2 }), [i * 0.026 * s, -0.11 * s, 0.11 * s]);
    return g;
  };
  // Madame Morta: green-grey skin, a hooked nose, long grey hair under a crooked pointed hat, seated, dealing
  A.witch = () => {
    const robe = G.mat('col', { c: 0x2a1a34, t: 'cloth', ds: true }), skin = G.mat('col', { c: 0x9aae84, t: 'skin' }), Rr = M.humanoid({ top: robe, bottom: robe, skin, eye: 0xc0ff60, eyeGlow: 0x60a020, brow: 0x9a9a9a, bulk: 0.95 });
    const hair = G.mat('col', { c: 0x8a8a8a, r: 1 }); TM.hair(Rr.head, hair); for (let i = 0; i < 9; i++) { const a = 1.3 + i * 0.46; M.P(Rr.head, M.tube([Math.sin(a) * 0.1, 0.17, Math.cos(a) * 0.1 - 0.02, Math.sin(a) * 0.13, 0.02, Math.cos(a) * 0.12 - 0.04, Math.sin(a) * 0.15, -0.22, Math.cos(a) * 0.11 - 0.06], 0.014, 12, 5), hair); }
    M.P(Rr.head, M.cone(0.018, 0.07, 8), skin, [0, 0.085, 0.15], [1.25, 0, 0]); M.P(Rr.head, M.sph(0.009, 6, 5), skin, [0.02, 0.06, 0.14]);   // the nose, a wart
    const hm = G.mat('col', { c: 0x1a1020, t: 'cloth' }), hat = M.G(Rr.head, [0, 0.215, -0.01], [-0.12, 0, 0.08]); M.P(hat, M.cyl(0.25, 0.25, 0.012, 28), hm, [0, 0, 0], 0, [1, 1, 1.05]); M.P(hat, M.cyl(0.12, 0.125, 0.06, 20), hm, [0, 0.03, 0]);
    { const tip = M.G(hat, [0, 0.06, 0]); M.P(tip, M.cone(0.12, 0.26, 20), hm, [0, 0.13, 0]); const t2 = M.G(tip, [0, 0.24, 0], [0.5, 0, 0.2]); M.P(t2, M.cone(0.05, 0.16, 12), hm, [0, 0.07, 0]); M.P(hat, M.cyl(0.124, 0.124, 0.025, 20), G.mat('col', { c: 0x6a3a8a, t: 'cloth' }), [0, 0.04, 0]); M.P(hat, M.box(0.04, 0.035, 0.01), G.mat('gold'), [0, 0.04, 0.124]); }
    M.P(Rr.hips, M.lathe([0.16, 0.25, 0.24, 0, 0.3, -0.4, 0.33, -0.6], 24), robe);
    Rr.extraAnim = (R2, st) => { const t = st.t, act = R2._act, k = R2._actT || 0; G.fp && G.fp.sitPose(R2); R2.torso.rotation.set(0.15 + Math.sin(t * 0.6) * 0.03, Math.sin(t * 0.35) * 0.1, 0);
      R2.armL.sh.rotation.set(-0.95, 0.1, 0.25); R2.armL.el.rotation.set(-1.1 + Math.sin(t * 1.3) * 0.08, 0, 0); R2.armR.sh.rotation.set(-1.0, -0.1, -0.2); R2.armR.el.rotation.set(-1.0, 0, 0);
      if (act === 'deal' && k > 0) { const p = Math.sin(k * 6); R2.armR.sh.rotation.set(-1.25 - p * 0.25, -0.3 + p * 0.3, -0.25); R2.armR.el.rotation.set(-0.4, 0, 0); }
      else if (act === 'cackle' && k > 0) { R2.neck.rotation.x -= 0.3; R2.torso.rotation.x -= 0.15 + Math.sin(t * 22) * 0.04; R2.armL.sh.rotation.set(-1.6, 0, 0.4); R2.armR.sh.rotation.set(-1.6, 0, -0.4); }
      if (k > 0) R2._actT = Math.max(0, k - 1 / 60); };
    Rr.light = { color: 0x9060ff, intensity: 0.8, dist: 4 };
    return Rr;
  };
  A.cat = () => { const g = new THREE.Group(), fur = G.mat('col', { c: 0x141016, r: 0.9, t: 'cloth' }); M.P(g, M.sph(0.08, 14, 10), fur, [0, 0.07, 0], 0, [0.9, 0.85, 1.3]); M.P(g, M.sph(0.055, 12, 10), fur, [0, 0.15, 0.07]); M.mirror(k => { M.P(g, M.cone(0.022, 0.05, 4), fur, [k * 0.032, 0.2, 0.07]); M.P(g, M.sph(0.009, 6, 5), G.mat('emissive', { c: 0xd0ff40, i: 3 }), [k * 0.02, 0.155, 0.12]); }); M.P(g, M.tube([0, 0.05, -0.1, 0.06, 0.03, -0.16, 0.1, 0.1, -0.2, 0.08, 0.18, -0.18], 0.012, 12, 5), fur); return g; };
  // signs are drawn at a fixed pixels-per-metre, and the lettering always fits inside the frame
  const PPM = 280, signFont = (px) => `600 ${px}px "Cinzel", Georgia, serif`;
  A.signWidth = (text, w, h) => { const lines = text.split('\n'), x = document.createElement('canvas').getContext('2d'), fs = Math.min(h * PPM / lines.length * 0.62, 150); x.font = signFont(fs); const tw = Math.max(...lines.map(l => x.measureText(l).width)); return Math.max(w, (tw + fs * 1.2 + 80) / PPM); };
  A.sign = (text, w, h, opts = {}) => {
    const c = document.createElement('canvas'); c.width = Math.min(4096, Math.round(w * PPM)); c.height = Math.round(c.width * h / w); const x = c.getContext('2d');
    x.fillStyle = opts.bg || '#1a0e0a'; x.fillRect(0, 0, c.width, c.height); x.strokeStyle = opts.edge || '#d9b46a'; x.lineWidth = 10; x.strokeRect(10, 10, c.width - 20, c.height - 20);
    x.strokeStyle = 'rgba(217,180,106,.35)'; x.lineWidth = 3; x.strokeRect(26, 26, c.width - 52, c.height - 52);
    x.fillStyle = opts.color || '#f3d998'; x.textAlign = 'center'; x.textBaseline = 'middle'; const lines = text.split('\n'); let fs = Math.min(c.height / lines.length * 0.62, 150 * c.width / 1024);
    x.font = signFont(fs); const tw = Math.max(...lines.map(l => x.measureText(l).width)), room = c.width - 90; if (tw > room) { fs *= room / tw; x.font = signFont(fs); }
    x.shadowColor = opts.glow || '#ff9a30'; x.shadowBlur = 18;
    lines.forEach((l, i) => x.fillText(l, c.width / 2, c.height * (i + 0.5) / lines.length));
    const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 8;
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55 }));
  };
  // a hanging sign over each game: as long as its name needs
  A.hangSign = (W, text, x, z, ry = 0, y = 5.2, w = 3.6) => { const h = w * 0.28 * (text.includes('\n') ? 1.5 : 1); w = A.signWidth(text, w, h); const g = new THREE.Group(); const s = A.sign(text, w, h); g.add(s); const s2 = s.clone(); s2.rotation.y = Math.PI; s2.position.z = -0.01; g.add(s2); M.mirror(k => M.P(g, M.cyl(0.01, 0.01, AH - y - 0.5, 4), G.mat('iron'), [k * w * 0.4, (AH - y) / 2 + 0.2, 0])); W.hang(g, x, y, z, ry); };
  // strings of bulbs that chase in the dark
  A.bulbString = (W, pts, col, n) => { for (let i = 0; i < n; i++) { const k = i / (n - 1), seg = k * (pts.length - 1), j = Math.min(pts.length - 2, Math.floor(seg)), f = seg - j, p = pts[j].clone().lerp(pts[j + 1], f); const m = new THREE.Mesh(M.sph(0.07, 8, 6), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.4 })); m.position.copy(p); m.userData.dynamic = true; W.group.add(m); A.bulbs.push({ m, i, col }); } };

  /* ================= the wing ================= */
  const ba0 = G.World.buildArcade;
  G.World.buildArcade = function (o) {
    const CS = this.CS, grp = this.group, Wd = o.Wd, x0 = o.AX * CS, x1 = (Wd - 1) * CS, z0 = CS, z1 = (o.AZ1 + 1) * CS, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    A.bulbs = []; A.ratMeshes = []; A.bounds = { x0, x1, z0, z1 };
    // where everything goes (world coordinates)
    o.spots = { tarot: { x: x0 + 5, z: z0 + 4 }, rats: { x: x0 + 14, z: z0 + 3.5 }, ring: { x: x0 + 43, z: z0 + 12, r: 8 },
      liars: { x: x0 + 6, z: z0 + 24.5 }, knuckle: { x: x0 + 6, z: z0 + 31.5 }, knives: { bx: x0 + 0.06, bz: z0 + 38 },
      pool: { x: x0 + 18, z: z0 + 26 }, poker: { x: x0 + 28.5, z: z0 + 26 }, blackjack: { x: x0 + 37.5, z: z0 + 26 }, chess: [{ x: x0 + 44.5, z: z0 + 27 }, { x: x0 + 48.5, z: z0 + 27 }],
      dice: { x: x0 + 28.5, z: z0 + 35.5 }, bowl: { x: x0 + 12, lanes: [z0 + 48, z0 + 53] } };
    A.spots = o.spots;
    // walls (taller than the main hall), a dark flagstone floor with gold-lined runners, a vaulted ceiling
    const wt = G.tex.get('hideoutWall'), wm = new THREE.MeshStandardMaterial({ map: wt.map, normalMap: wt.normalMap, roughness: 0.9, color: 0x9a8a7a });
    for (let z = 0; z < o.HT; z++) for (let x = o.AX - 1; x < Wd; x++) { const solid = !this.grid[z * Wd + x]; if (x === o.AX - 1) { if ((z >= o.AZ1 + 1 || solid || (z >= 3 && z <= 4)) && AH - o.Hh > 0.01) { const m = new THREE.Mesh(M.box(CS, AH - o.Hh, CS), wm); m.position.set((x + 0.5) * CS, o.Hh + (AH - o.Hh) / 2, (z + 0.5) * CS); grp.add(m); if (z >= o.AZ1 + 1) { const m2 = new THREE.Mesh(M.box(CS, o.Hh, CS), wm); m2.position.set((x + 0.5) * CS, o.Hh / 2, (z + 0.5) * CS); grp.add(m2); } } continue; }
      if (solid) { const m = new THREE.Mesh(M.box(CS, AH, CS), wm); m.position.set((x + 0.5) * CS, AH / 2, (z + 0.5) * CS); grp.add(m); } }
    const ft = G.tex.get('cryptFloor'), fm = new THREE.MeshStandardMaterial({ map: ft.map.clone(), normalMap: ft.normalMap.clone(), roughness: 0.5, metalness: 0.15, color: 0x6a5a6a });
    fm.map.repeat.set((x1 - x0) / 4, (z1 - z0) / 4); fm.normalMap.repeat.set((x1 - x0) / 4, (z1 - z0) / 4); fm.map.needsUpdate = fm.normalMap.needsUpdate = true;
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), fm); fl.rotation.x = -Math.PI / 2; fl.position.set(cx, 0.001, cz); fl.receiveShadow = true; grp.add(fl);
    const run = (x, z, w, d) => { const r = new THREE.Mesh(new THREE.PlaneGeometry(w, d), G.mat('col', { c: 0x5a0a14, t: 'cloth' })); r.rotation.x = -Math.PI / 2; r.position.set(x, 0.012, z); grp.add(r); const r2 = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.3, d + 0.3), G.mat('col', { c: 0xc8a040 })); r2.rotation.x = -Math.PI / 2; r2.position.set(x, 0.008, z); grp.add(r2); };
    run(x0 + 6, z0 + 12, 12, 2.6); run(x0 + 24, z0 + 18.5, 34, 2.2); run(x0 + 24, z0 + 41.5, 40, 2.2);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), G.mat('col', { c: 0x1a1218, t: 'rock' })); ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, AH, cz); grp.add(ceil);
    for (let x = x0 + 4; x < x1; x += 8) { M.P(grp, M.box(0.6, 0.6, z1 - z0), G.mat('col', { c: 0x2a1a14, t: 'rock' }), [x, AH - 0.3, cz]); }
    for (let z = z0 + 6; z < z1; z += 12) { M.P(grp, M.box(x1 - x0, 0.5, 0.5), G.mat('col', { c: 0x2a1a14, t: 'rock' }), [cx, AH - 0.5, z]); }
    // pillars of stacked bones and skull lamps along the walls
    [[x0 + 0.6, z0 + 6], [x0 + 0.6, z1 - 6], [x1 - 0.6, z0 + 30], [x1 - 0.6, z1 - 6]].forEach(([x, z]) => { const s = A.skull(2.2, 0x40ff80); this.place(s, x, 3.2, z, x < cx ? Math.PI / 2 : -Math.PI / 2); this.lights.push({ pos: new G.V3(x + (x < cx ? 0.8 : -0.8), 3.4, z), color: 0x60ff90, intensity: 1.6, dist: 9, seed: x + z, flicker: true }); });
    for (let x = x0 + 8; x < x1 - 2; x += 10) { this.place(M.prop.torch('crypt'), x, 3.2, z0 + 0.02, 0); this.place(M.prop.torch('crypt'), x, 3.2, z1 - 0.02, Math.PI); }
    // big skull chandeliers
    [[x0 + 18, z0 + 26], [x0 + 33, z0 + 26], [x0 + 12, z0 + 12], [x0 + 28, z0 + 36]].forEach(([x, z]) => { const ch = M.prop.chandelier(); ch.scale.setScalar(1.5); this.hang(ch, x, AH - 3.0, z); });
    // bulb strings looping across the ceiling
    const cols = [0xffb040, 0xff4060, 0x60ff90, 0xb070ff];
    for (let k = 0; k < 4; k++) { const z = z0 + 8 + k * 12, pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new G.V3(x0 + 2 + t * (x1 - x0 - 4), AH - 1.2 - Math.sin(t * Math.PI * 4) ** 2 * 1.2, z)); } A.bulbString(this, pts, cols[k], 60); }
    // ---- the gate: an arch of skulls in the main hall's east wall ----
    const gz0 = 3 * CS, gz1 = 5 * CS, gzc = (gz0 + gz1) / 2, gx = (o.AX - 0.5) * CS, half = (gz1 - gz0) / 2, Hh = o.Hh;
    { // one outline that goes up and over the opening (a hole closed along the floor left a sliver of face lying on the floor, which flickered)
      const hw = half - 0.9, sideH = 3.3, archH = 2.4, sh = new THREE.Shape(); sh.moveTo(-half, 0); sh.lineTo(-hw, 0); sh.lineTo(-hw, sideH); sh.absellipse(0, sideH, hw, archH, Math.PI, 0, true); sh.lineTo(hw, 0); sh.lineTo(half, 0); sh.lineTo(half, Hh); sh.lineTo(-half, Hh); sh.lineTo(-half, 0);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: CS, bevelEnabled: false, curveSegments: 24 }); const arch = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x3a3030, roughness: 0.85 })); arch.rotation.y = Math.PI / 2; arch.position.set(gx - CS / 2, 0, gzc); grp.add(arch); for (let k = -1.5; k <= 1.5; k += 1) [gz0 + 0.45, gz1 - 0.45].forEach(z => this.addSolid(gx + k, z, 0.5));
      { const gf = new THREE.Mesh(new THREE.PlaneGeometry(CS / 2, gz1 - gz0), G.mat('col', { c: 0x4a3a34, t: 'rock' })); gf.rotation.x = -Math.PI / 2; gf.position.set(o.AX * CS - CS / 4, 0, gzc); gf.receiveShadow = true; grp.add(gf); }
      // skulls packed around the arch on both faces, every few with glowing eyes
      [gx - CS / 2 - 0.12, gx + CS / 2 + 0.12].forEach((fx, side) => {
        for (let i = 0; i <= 28; i++) { const a = Math.PI - i / 28 * Math.PI, pz = gzc + Math.cos(a) * (hw + 0.25), py = sideH + Math.sin(a) * (archH + 0.25); const s = A.skull(1.5, i % 4 === 0 ? (side ? 0xff3020 : 0x40ff80) : null); s.position.set(fx, py, pz); s.rotation.set(0, side ? Math.PI / 2 : -Math.PI / 2, 0); grp.add(s); }
        for (let y = 0.3; y < sideH - 0.25; y += 0.42) [-1, 1].forEach(k => { const s = A.skull(1.5, (Math.round(y * 10) % 3 === 0) ? 0xffb040 : null); s.position.set(fx, y, gzc + k * (hw + 0.25)); s.rotation.y = side ? Math.PI / 2 : -Math.PI / 2; grp.add(s); });
        const signY = side ? 7.6 : Math.min(Hh - 0.7, sideH + archH + 0.75), signW = side ? 7.5 : 6.2, signH = side ? 1.1 : 0.9;
        for (let py = 0.35; py < (side ? AH : Hh) - 0.25; py += 0.46) for (let pz0 = gzc - half + 0.25; pz0 < gzc + half - 0.2; pz0 += 0.44) {
          const pz = pz0 + (R() - 0.5) * 0.12 + ((Math.round(py / 0.46) % 2) * 0.22), yy = py + (R() - 0.5) * 0.1; if (Math.abs(pz - gzc) > half - 0.2) continue;
          const dzc = Math.abs(pz - gzc), inside = dzc < hw + 0.55 && (yy < sideH + 0.4 || ((pz - gzc) / (hw + 0.6)) ** 2 + ((yy - sideH) / (archH + 0.6)) ** 2 < 1); if (inside) continue;
          if (Math.abs(pz - gzc) < signW / 2 + 0.15 && Math.abs(yy - signY) < signH / 2 + 0.18) continue;
          const s = A.skull(1.25 + R() * 0.5, R() < 0.08 ? (side ? 0xff3020 : 0x40ff80) : null); s.position.set(fx + (side ? 0.05 : -0.05), yy, pz); s.rotation.set((R() - 0.5) * 0.35, (side ? Math.PI / 2 : -Math.PI / 2) + (R() - 0.5) * 0.5, (R() - 0.5) * 0.35); grp.add(s); }
        // a marquee of bulbs tracing the arch
        const pts = []; for (let i = 0; i <= 24; i++) { const a = Math.PI - i / 24 * Math.PI; pts.push(new G.V3(fx + (side ? 0.18 : -0.18), sideH + Math.sin(a) * (archH + 0.62), gzc + Math.cos(a) * (hw + 0.62))); }
        pts.unshift(new G.V3(pts[0].x, 0.3, pts[0].z)); pts.push(new G.V3(pts[pts.length - 1].x, 0.3, pts[pts.length - 1].z)); A.bulbString(this, pts, side ? 0xff5030 : 0xffc040, 54);
      });
      // a giant skull crowning the gate on the hall side, and a sign over it
      const sg = A.sign('THE GRAND ARCADE', 6.2, 0.9, { glow: '#ff7020' }); sg.position.set(gx - CS / 2 - 0.25, Math.min(Hh - 0.7, sideH + archH + 0.75), gzc); sg.rotation.y = -Math.PI / 2; grp.add(sg);
      const sg2 = A.sign('THE GRAND ARCADE', 7.5, 1.1, { glow: '#ff7020' }); sg2.position.set(gx + CS / 2 + 0.2, 7.6, gzc); sg2.rotation.y = Math.PI / 2; grp.add(sg2);
      [[gx - CS / 2 - 1.2, 0x80ff90], [gx + CS / 2 + 1.2, 0xff6040]].forEach(([lx, c]) => { this.lights.push({ pos: new G.V3(lx, 4.2, gzc), color: c, intensity: 3.2, dist: 14, seed: lx, flicker: true }); this.lights.push({ pos: new G.V3(lx, 2.0, gzc - half + 0.6), color: 0xffb040, intensity: 2, dist: 8, seed: lx + 1, flicker: true }); this.lights.push({ pos: new G.V3(lx, 2.0, gzc + half - 0.6), color: 0xffb040, intensity: 2, dist: 8, seed: lx + 2, flicker: true }); });
    }
    // ---- the sparring pit doubles as the brawl ring ----
    const rg = o.spots.ring; this.buildArena(rg.x, rg.z, rg.r, AH); A.hangSign(this, 'THE PIT', rg.x - rg.r - 1, rg.z, Math.PI / 2, 5.5, 3.2);
    this.interact.push({ id: 'brawl', label: 'Bar Brawl', x: rg.x - rg.r - 1.4, z: rg.z + 2.4, r: 2.2, desc: 'Fists only · last one standing takes the pot' });
    // ---- the old tavern corners: Liar's Dice, Knucklebones, knives ----
    const lane = o.spots.knives; T.buildGameCorners.call(this, { lx: o.spots.liars.x, lz: o.spots.liars.z, kx: o.spots.knuckle.x, kz: o.spots.knuckle.z });
    A.hangSign(this, "LIAR'S DICE", o.spots.liars.x, o.spots.liars.z, Math.PI / 2, 4.6, 2.8); A.hangSign(this, 'KNUCKLEBONES', o.spots.knuckle.x, o.spots.knuckle.z, Math.PI / 2, 4.6, 2.8);
    // ---- Madame Morta: a witch at a little table, her crystal ball, her cat and her cauldron ----
    const tp = o.spots.tarot, W = A.witch(); W.root.position.set(tp.x, 0, tp.z - 0.75); W.root.rotation.y = 0; W.root.userData.dynamic = true; grp.add(W.root); this.hideNPCs.push(W); A.witchR = W;
    { const tb = TM.roundTable(); tb.scale.set(0.62, 1, 0.62); this.place(tb, tp.x, 0, tp.z + 0.15, 0, 0.85);
      M.P(grp, M.cyl(0.66, 0.7, 0.36, 24, 1, true), G.mat('col', { c: 0x2a0a3a, t: 'cloth', ds: true }), [tp.x, 0.66, tp.z + 0.15]); M.P(grp, M.cyl(0.66, 0.66, 0.012, 24), G.mat('col', { c: 0x2a0a3a, t: 'cloth' }), [tp.x, 0.835, tp.z + 0.15]);
      const ball = new THREE.Group(); M.P(ball, M.cyl(0.07, 0.09, 0.05, 12), G.mat('bronze') || G.mat('gold'), [0, 0.025, 0]); M.P(ball, M.sph(0.11, 24, 18), G.mat('col', { c: 0x9070d0, tr: 0.5, e: 0x4020a0, ei: 0.5 }), [0, 0.15, 0]); M.P(ball, M.ico(0.04, 2), G.mat('emissive', { c: 0xb080ff, i: 1.3 }), [0, 0.15, 0]); ball.position.set(tp.x - 0.38, 0.84, tp.z - 0.05); grp.add(ball);
      for (let k = 0; k < 3; k++) { const cd = M.prop.candles(1); cd.position.set(tp.x + 0.42 - k * 0.06, 0.84, tp.z - 0.1 + k * 0.12); cd.scale.setScalar(0.45); grp.add(cd); }
      const cat = A.cat(); cat.position.set(tp.x + 0.3, 0.84, tp.z - 0.2); cat.rotation.y = 0.6; grp.add(cat);
      const cau = new THREE.Group(); M.P(cau, M.lathe([0, 0, 0.3, 0.04, 0.4, 0.22, 0.36, 0.44, 0.33, 0.46], 24), G.mat('dark')); M.P(cau, M.cyl(0.33, 0.33, 0.02, 24), G.mat('emissive', { c: 0x40ff60, i: 1.4 }), [0, 0.4, 0]); for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; M.P(cau, M.cyl(0.03, 0.03, 0.2, 6), G.mat('iron'), [Math.cos(a) * 0.26, -0.06, Math.sin(a) * 0.26]); } cau.userData.light = { pos: new THREE.Vector3(0, 0.6, 0), color: 0x40ff60, intensity: 1.2, dist: 5 }; this.place(cau, tp.x - 1.3, 0.08, tp.z - 0.7, 0, 0.5);
      for (let k = 0; k < 5; k++) { const hb = new THREE.Group(); M.P(hb, M.cyl(0.004, 0.004, 0.5, 4), G.mat('col', { c: 0x2a2a1a }), [0, 0.25, 0]); M.P(hb, M.cone(0.06, 0.22, 6), G.mat('col', { c: [0x4a5a2a, 0x6a4a2a, 0x5a2a3a][k % 3], t: 'cloth' }), [0, -0.05, 0], [Math.PI, 0, 0]); this.hang(hb, tp.x - 1.2 + k * 0.55, 3.0, tp.z - 1.4); }
      const stool = TM.stool(); this.place(stool, tp.x, 0, tp.z + 1.05, 0, 0.3);
      this.lights.push({ pos: new G.V3(tp.x - 0.2, 1.5, tp.z + 0.2), color: 0xc8a0ff, intensity: 1.3, dist: 6, seed: 77, flicker: false }); this.addSolid(tp.x, tp.z - 0.6, 0.6); }
    A.tarotAt = { x: tp.x, z: tp.z + 0.15, seat: { x: tp.x, z: tp.z + 1.05 }, deck: { x: tp.x + 0.2, y: 0.88, z: tp.z - 0.18 } };
    A.hangSign(this, "MADAME MORTA\nFORTUNES TOLD", tp.x + 2.6, tp.z + 1.5, 0, 4.0, 2.6);
    this.interact.push({ id: 'tarot', label: "Madame Morta's Tarot", x: tp.x, z: tp.z + 1.7, r: 1.8, desc: 'Sit with the witch · three cards for your next descent' });
    // ---- the rat track: six lanes along the north wall ----
    const rp = o.spots.rats, track = new THREE.Group(), LEN = A.RAT_LEN = 14, lanes = 6;
    M.P(track, M.box(LEN + 2, 0.7, lanes * 0.6 + 0.4), G.mat('col', { c: 0x2a1a10, t: 'wood' }), [LEN / 2, 0.35, 0]);
    M.P(track, M.box(LEN + 1.6, 0.02, lanes * 0.6), G.mat('col', { c: 0x6a5a3a, t: 'cloth', r: 1 }), [LEN / 2, 0.71, 0]);
    for (let i = 0; i <= lanes; i++) M.P(track, M.box(LEN + 1.6, 0.12, 0.03), G.mat('wood'), [LEN / 2, 0.77, (i - lanes / 2) * 0.6]);
    M.P(track, M.box(0.08, 0.02, lanes * 0.6), G.mat('col', { c: 0xe8e0d0 }), [0, 0.73, 0]); M.P(track, M.box(0.12, 0.02, lanes * 0.6), G.mat('col', { c: 0xc02020, e: 0x801010, ei: 0.6 }), [LEN, 0.73, 0]);
    M.mirror(k => M.P(track, M.cyl(0.04, 0.04, 1.2, 8), G.mat('iron'), [LEN, 1.3, k * (lanes * 0.3 + 0.1)]));
    this.place(track, rp.x, 0, rp.z, 0, 0); for (let k = 0; k <= 8; k++) this.addSolid(rp.x + k * (LEN / 8), rp.z, 1.6);
    A.trackAt = { x: rp.x, z: rp.z, y: 0.72 };
    const keeper = TM.patron(1); keeper.root.position.set(rp.x + LEN + 2.4, 0, rp.z); keeper.root.rotation.y = -Math.PI / 2; keeper.root.userData.dynamic = true; grp.add(keeper.root); this.hideNPCs.push(keeper); keeper._stand = true; A.ratKeeper = keeper;
    A.hangSign(this, 'RAT RACES', rp.x + LEN / 2, rp.z + 2.6, 0, 5.4, 4.0);
    this.interact.push({ id: 'rats', label: 'Rat Races', x: rp.x + LEN / 2, z: rp.z + 3.0, r: 3.6, desc: 'Bet on a rat' });
    for (let i = 0; i < lanes; i++) { const rm = A.ratModel(A.RAT_COLORS[i]); rm.position.set(rp.x, 0.72, rp.z + (i - lanes / 2 + 0.5) * 0.6); rm.rotation.y = Math.PI / 2; rm.scale.setScalar(1.6); rm.userData.dynamic = true; grp.add(rm); A.ratMeshes.push(rm); }
    // ---- the Dragon Dice table ----
    const dp = o.spots.dice, dt = TM.boneTable(2.0, 1.4, 0x2a3a14, 'oval'); this.place(dt, dp.x, 0, dp.z, 0, 'auto');
    { const tray = new THREE.Group(), fl = G.mat('col', { c: 0x3a0a0a, t: 'cloth' }), bn = G.mat('col', { c: 0xc8bba0, r: 0.8 }); M.P(tray, M.box(1.2, 0.012, 0.76), fl, [0, 0.006, 0]); M.mirror(k => { M.P(tray, M.box(1.24, 0.06, 0.03), bn, [0, 0.03, k * 0.395]); M.P(tray, M.box(0.03, 0.06, 0.82), bn, [k * 0.615, 0.03, 0]); }); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { M.P(tray, M.sph(0.03, 10, 8), bn, [a * 0.615, 0.065, b * 0.395]); }); tray.position.set(dp.x, 0.83, dp.z); grp.add(tray); }
    A.hangSign(this, 'DRAGON DICE', dp.x, dp.z, 0, 4.6, 3.0); this.interact.push({ id: 'dice', label: 'Dragon Dice', x: dp.x, z: dp.z, r: 2.6, desc: 'Push your luck · first to 4000' });
    A.hangSign(this, 'THE BONE TABLE', o.spots.pool.x, o.spots.pool.z, 0, 5.6, 3.6); A.hangSign(this, "HOLD'EM", o.spots.poker.x, o.spots.poker.z, 0, 4.8, 2.6); A.hangSign(this, 'BLACKJACK', o.spots.blackjack.x, o.spots.blackjack.z, 0, 4.8, 2.8);
    ba0.call(this, o);
    // keep the wing bright but steady: every light inside it a touch dimmer, and none of them flicker
    this.lights.forEach(L => { if (L.pos.x > x0 - 0.5 && L.pos.x < x1 + 0.5 && L.pos.z > z0 - 0.5 && L.pos.z < z1 + 0.5) { L.intensity *= 0.72; L.flicker = false; } });
    this.spawnPointArcade = new G.V3(x0 + 3, 0, gzc);
  };

  /* ================= marquee bulbs chase ================= */
  A.tick = (dt, t) => {
    if (G.World.theme !== 'hideout') return;
    A.bulbs.forEach(b => { b.m.material.emissiveIntensity = 1.35 + 0.25 * Math.sin(t * 1.2 - b.i * 0.35); });   // a slow, soft shimmer rather than a hard chase
    A.tickRats(dt, t); A.tickBrawl(dt, t);
    const K = A.ratKeeper; if (K) { K._st = K._st || { t: 0, move: 0, atk: -1 }; }
  };
  const pk0 = G.game.updatePickups.bind(G.game);
  G.game.updatePickups = function (dt, t) { pk0(dt, t); A.tick(dt, t); };

  /* ================= Madame Morta's tarot ================= */
  const X = (up, rev) => ({ up, rev });
  A.TAROT = [
    { n: 'The Fool', s: '🃏', u: '+8% movement speed', r: 'Start with one fewer healing flask', ...X((m) => { m.speed += 0.08; }, (m, P) => { P.potions = Math.max(0, P.potions - 1); }) },
    { n: 'The Magician', s: '✦', u: 'Abilities recharge 12% faster', r: '−20 mana', ...X((m) => { m.cdr += 0.12; }, (m) => { m.mana -= 20; }) },
    { n: 'The High Priestess', s: '☾', u: '+25 mana and +20% mana regeneration', r: '−20% mana regeneration', ...X((m) => { m.mana += 25; m.manaRegen += 0.2; }, (m) => { m.manaRegen -= 0.2; }) },
    { n: 'The Empress', s: '♀', u: 'Healing flasks heal 25% more', r: 'Healing flasks heal 15% less', ...X((m) => { m.flaskMul += 0.25; }, (m) => { m.flaskMul -= 0.15; }) },
    { n: 'The Emperor', s: '♔', u: '+12 maximum health and 3% less damage taken', r: 'Take 4% more damage', ...X((m) => { m.hp += 12; m.armor += 0.03; }, (m) => { m.armor -= 0.04; }) },
    { n: 'The Hierophant', s: '⛪', u: '+15% experience', r: '−10% experience', ...X((m, P) => { P.fortuneXp = (P.fortuneXp || 1) * 1.15; }, (m, P) => { P.fortuneXp = (P.fortuneXp || 1) * 0.9; }) },
    { n: 'The Lovers', s: '❦', u: '+15 maximum health', r: '−10 maximum health', ...X((m) => { m.hp += 15; }, (m) => { m.hp -= 10; }) },
    { n: 'The Chariot', s: '⚔', u: '+10% speed and +20 stamina', r: '−6% movement speed', ...X((m) => { m.speed += 0.1; m.sta += 20; }, (m) => { m.speed -= 0.06; }) },
    { n: 'Strength', s: '✊', u: '+10% damage', r: '−6% damage', ...X((m) => { m.dmg += 0.1; }, (m) => { m.dmg -= 0.06; }) },
    { n: 'The Hermit', s: '🏮', u: '+10% experience, −10% gold', r: '−15% gold', ...X((m, P) => { P.fortuneXp = (P.fortuneXp || 1) * 1.1; m.greed -= 0.1; }, (m) => { m.greed -= 0.15; }) },
    { n: 'Wheel of Fortune', s: '☸', u: 'Two lucky rerolls of a d20', r: '−1 to every check and save', ...X((m, P) => { P.luck = (P.luck || 0) + 2; P.fateLuck = true; }, (m, P) => { P.hex = (P.hex || 0) + 1; }) },
    { n: 'Justice', s: '⚖', u: 'Take 5% less damage', r: 'Take 3% more damage', ...X((m) => { m.armor += 0.05; }, (m) => { m.armor -= 0.03; }) },
    { n: 'The Hanged Man', s: '⚓', u: 'Take 6% less damage, 4% slower', r: '−6% movement speed', ...X((m) => { m.armor += 0.06; m.speed -= 0.04; }, (m) => { m.speed -= 0.06; }) },
    { n: 'Death', s: '☠', u: '+18% damage, −10 maximum health', r: '−15 maximum health', ...X((m) => { m.dmg += 0.18; m.hp -= 10; }, (m) => { m.hp -= 15; }) },
    { n: 'Temperance', s: '⚱', u: 'Faster stamina and mana recovery', r: 'Slower stamina recovery', ...X((m) => { m.staRegen += 0.3; m.manaRegen += 0.15; }, (m) => { m.staRegen -= 0.2; }) },
    { n: 'The Devil', s: '😈', u: '+25% damage, take 6% more damage', r: '−10 health but +20% gold', ...X((m) => { m.dmg += 0.25; m.armor -= 0.06; }, (m) => { m.hp -= 10; m.greed += 0.2; }) },
    { n: 'The Tower', s: '♜', u: '+6% critical chance', r: 'Take 5% more damage', ...X((m) => { m.crit += 0.06; }, (m) => { m.armor -= 0.05; }) },
    { n: 'The Star', s: '★', u: 'An extra healing flask', r: '−3% critical chance', ...X((m, P) => { P.potions += 1; }, (m) => { m.crit -= 0.03; }) },
    { n: 'The Moon', s: '☽', u: '+5% critical chance and +10% gold', r: '−1 to every check and save', ...X((m) => { m.crit += 0.05; m.greed += 0.1; }, (m, P) => { P.hex = (P.hex || 0) + 1; }) },
    { n: 'The Sun', s: '☀', u: '+25% gold and better loot', r: '−10% gold', ...X((m) => { m.greed += 0.25; }, (m) => { m.greed -= 0.1; }) },
    { n: 'Judgement', s: '📯', u: '+8 health and +5% damage', r: '−4% damage', ...X((m) => { m.hp += 8; m.dmg += 0.05; }, (m) => { m.dmg -= 0.04; }) },
    { n: 'The World', s: '🌍', u: 'A little better at everything', r: 'A little worse at everything', ...X((m) => { m.dmg += 0.05; m.hp += 8; m.speed += 0.04; m.armor += 0.02; }, (m) => { m.dmg -= 0.03; m.speed -= 0.02; }) }
  ];
  const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];
  A.tarotCard = (c, flipped) => { if (!flipped) return '<div class="tarot back"><span>☠</span></div>'; const C = A.TAROT[c.i]; return `<div class="tarot ${c.rev ? 'rev' : ''}"><div class="tin"><small>${ROMAN[c.i]}</small><span class="ts">${C.s}</span><b>${C.n}</b>${c.rev ? '<em>Reversed</em>' : ''}<p>${c.rev ? C.r : C.u}</p></div></div>`; };
  A.tarotRead = () => {
    const cost = G.save.fortune ? 35 : 25; if (G.save.gold < cost) { G.ui.toast('Madame Morta does not read for free'); return; }
    G.save.gold -= cost; const deck = A.TAROT.map((_, i) => i); for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    G.save.fortune = deck.slice(0, 3).map(i => ({ i, rev: R() < 0.33 })); G.persist(); G.sfx('magic', 0.7); G.sfx('coin', 0.6);
    A.flip = 0; [1, 2, 3].forEach(k => setTimeout(() => { A.flip = k; G.sfx('click', 0.8); if (k === 3) G.sfx(G.save.fortune.filter(c => c.rev).length >= 2 ? 'groan' : 'holy', 0.6); if (UI.panelKind === 'tarot') UI.renderPanel(); }, 700 * k));
    if (UI.panelKind === 'tarot') UI.renderPanel();
  };
  const css = document.createElement('style');
  css.textContent = `.tarots{display:flex;gap:16px;justify-content:center;margin:14px 0}.tarot{width:150px;height:240px;border-radius:10px;background:linear-gradient(170deg,#f2e6c4,#cdb88a);border:3px solid #8a6a30;box-shadow:0 6px 18px rgba(0,0,0,.6);padding:8px;color:#2a1a10;text-align:center;transition:transform .5s}
.tarot .tin{height:100%;border:1px solid rgba(90,60,20,.5);border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:8px 6px}.tarot small{font-family:Georgia;font-weight:700}.tarot .ts{font-size:48px;line-height:1}.tarot b{font-family:var(--head);font-size:15px}.tarot em{color:#8a1020;font-size:12px}.tarot p{font-size:12px;margin:0}
.tarot.rev{background:linear-gradient(170deg,#e8c8c0,#b08880)}.tarot.rev .ts{transform:rotate(180deg)}.tarot.back{background:radial-gradient(circle,#4a1060,#1a0420);border-color:#c8a040;display:grid;place-items:center;color:#c8a040;font-size:60px}
.dd{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.dd .die{cursor:pointer;width:48px;height:48px;font-size:42px}.dd .die.sel{outline:3px solid #f3d998;transform:translateY(-4px)}.dd .die.keep{opacity:.35;cursor:default}.dd .die.drag{color:#a01010}
.rats{display:flex;flex-direction:column;gap:6px}.ratrow{display:grid;grid-template-columns:24px 140px 1fr 70px auto;gap:8px;align-items:center;background:rgba(30,22,10,.55);border:1px solid #5a4620;padding:6px 8px;border-radius:4px}.ratrow .bar{height:10px;background:rgba(0,0,0,.4);border-radius:5px;overflow:hidden}.ratrow .bar i{display:block;height:100%;background:linear-gradient(90deg,#c8a040,#ffe08a)}.ratrow.win{border-color:#8ad870}
#brawlHud{position:absolute;left:50%;bottom:150px;transform:translateX(-50%);font-family:var(--head);color:#ffb0a0;font-size:18px;text-shadow:0 2px 6px #000;pointer-events:none;text-align:center}`;
  document.head.appendChild(css);
  const render0 = UI.renderPanel.bind(UI);
  UI.renderPanel = function () {
    if (this.panelKind !== 'tarot') return render0();
    const set = (e, t, s) => { document.getElementById('panelEye').textContent = e; document.getElementById('panelTitle').textContent = t; document.getElementById('panelSub').textContent = s; };
    set('The Grand Arcade', "Madame Morta's Tarot", 'Three cards turned for your next descent. Upright cards bless, reversed cards curse. The reading holds until you next go down into the dark.');
    const F = G.save.fortune, n = A.flip === undefined ? 3 : A.flip;
    let h = `<div class="goldline">Gold: ${G.save.gold}</div>`;
    if (F) h += `<div class="tarots">${F.map((c, k) => A.tarotCard(c, k < n)).join('')}</div><p class="note" style="text-align:center">${n >= 3 ? 'This reading waits for your next descent.' : 'Madame Morta turns the cards…'}</p><div class="row" style="justify-content:center"><button class="btn small ghost" id="tarRe" ${G.save.gold < 35 ? 'disabled' : ''}>Ask again · 35 g</button></div>`;
    else h += `<div class="tarots">${[0, 1, 2].map(() => A.tarotCard(null, false)).join('')}</div><div class="row" style="justify-content:center"><button class="btn" id="tarGo" ${G.save.gold < 25 ? 'disabled' : ''}>Cross her palm · 25 g</button></div>`;
    const body = document.getElementById('panelBody'); body.innerHTML = h;
    const go = body.querySelector('#tarGo') || body.querySelector('#tarRe'); if (go) go.onclick = () => A.tarotRead();
  };
  // the reading takes hold when you set out
  const ns0 = G.game.netStart.bind(G.game);
  G.game.netStart = function (d) {
    const was = G.run.active, F = G.save.fortune, r = ns0(d);
    if (!was && G.run.active && F && G.player) { const P = G.player; G.sheet.applyChange(P, () => F.forEach(c => { const C = A.TAROT[c.i]; (c.rev ? C.rev : C.up)(P.mods, P); })); P.hp = P.maxHp; delete G.save.fortune; G.persist(); setTimeout(() => G.ui.toast(`Madame Morta's reading: ${F.map(c => A.TAROT[c.i].n + (c.rev ? ' (reversed)' : '')).join(' · ')}`), 3200); }
    return r;
  };
  const xp0 = G.sheet.gainXp.bind(G.sheet);
  G.sheet.gainXp = function (P, amt, why) { return xp0(P, P && P.fortuneXp ? amt * P.fortuneXp : amt, why); };

  /* ================= Dragon Dice (push-your-luck) ================= */
  const FACE = T.FACE;
  A.diceScore = (vals) => {   // score of exactly these dice, or -1 if any die doesn't score
    if (!vals.length) return -1; const c = [0, 0, 0, 0, 0, 0, 0]; vals.forEach(v => c[v]++);
    if (vals.length === 6 && c.slice(1).every(n => n === 1)) return 1500;
    if (vals.length === 6 && c.filter(n => n === 2).length === 3) return 1000;
    let s = 0; for (let f = 1; f <= 6; f++) { const n = c[f]; if (n >= 3) { s += (f === 1 ? 1000 : f * 100) * (n - 2); c[f] = 0; } }
    s += c[1] * 100 + c[5] * 50; c[1] = c[5] = 0; if (c.some(n => n > 0)) return -1; return s;
  };
  A.bestKeep = (vals) => { let best = { s: -1, idx: [] }; const n = vals.length; for (let m = 1; m < (1 << n); m++) { const idx = []; for (let i = 0; i < n; i++) if (m & (1 << i)) idx.push(i); const s = A.diceScore(idx.map(i => vals[i])); if (s > best.s || (s === best.s && idx.length < best.idx.length)) best = { s, idx }; } return best; };
  GM.dice = {
    name: 'Dragon Dice', icon: '🐉', min: 1, max: 6, npc: true, minBuy: 0, maxBuy: 500, defBuy: 20, step: 5, buyLabel: 'Stake',
    rules: 'Roll six dice and set aside scoring ones: 1s are dragon eyes (100), 5s are 50, three of a kind is 100× the face (three 1s are 1000), each extra die doubles it, a 1-to-6 run is 1500, three pairs 1000. Roll the rest to push your luck or bank your points. A roll with nothing scoring loses everything this turn. Use all six and you roll them all again. First to 4000 takes the pot.',
    target: 4000,
    start(t) { const st = t.st; st.pl = t.seats.map(s => ({ id: s.id, name: s.name, npc: !!s.npc, score: 0 })); st.pot = t.buy * t.seats.length; st.turn = 0; this.newTurn(t); },
    newTurn(t) { const st = t.st; st.dice = []; st.left = 6; st.tp = 0; st.phase = 'roll'; st.sel = []; st.kept = []; st.at = now() + 60000; st.last = null; },
    roll(t, a = {}) { const st = t.st, id = st.pl[st.turn].id, slot = (() => { const raw = Math.max(0, TB.slotOf(t, id)), Ld = G.fp && G.fp.L.dice; return Ld && Ld.order ? Ld.order[raw % Ld.order.length] : raw; })(), o = { pow: G.clamp(+a.pow || 0.3 + R() * 0.6, 0, 1), aim: G.clamp(+a.aim || (R() - 0.5) * 0.6, -0.6, 0.6), seed: (a.seed >>> 0) || ((R() * 4e9) >>> 0) }, L = G.fp && G.fp.L.dice;
      st.dice = L ? G.fp.tossResult(L.arena, L.seats[slot], o, st.left) : Array.from({ length: st.left }, () => G.ri(1, 6)); st.tn = (st.tn || 0) + 1; st.toss = Object.assign({ n: st.tn, slot, count: st.left }, o); st.sel = []; G.sfx('dice', 0.6); const b = A.bestKeep(st.dice); if (b.s < 0) { TB.say(t, `${st.pl[st.turn].name} rolls ${st.dice.map(v => FACE[v]).join('')} — the dragon sleeps! ${st.tp} lost.`); st.phase = 'farkle'; st.at = now() + 2600; } else { st.phase = 'choose'; st.at = now() + 60000; } },
    myTurn(t, id) { const st = t.st; return st && (st.phase === 'roll' || st.phase === 'choose') && st.pl[st.turn].id === id; },
    act(t, id, a) {
      const st = t.st, i = st.pl.findIndex(p => p.id === id); if (i !== st.turn) return false;
      if (a.t === 'roll' && st.phase === 'roll') { this.roll(t, a); return; }
      if ((a.t === 'keep' || a.t === 'bank') && st.phase === 'choose') {
        const idx = [...new Set((a.idx || []).map(n => n | 0))].filter(n => n >= 0 && n < st.dice.length), s = A.diceScore(idx.map(n => st.dice[n])); if (s < 0) return false;
        st.tp += s; st.kept = (st.kept || []).concat(idx.map(n => st.dice[n])); st.left -= idx.length; if (st.left === 0) { st.left = 6; st.kept = []; TB.say(t, `${st.pl[i].name} uses all six dice: hot dice!`); }
        if (a.t === 'bank') { st.pl[i].score += st.tp; TB.say(t, `${st.pl[i].name} banks ${st.tp} (total ${st.pl[i].score})`); if (st.pl[i].score >= this.target) { st.phase = 'over'; st.winner = st.pl[i].name; TB.say(t, `${st.pl[i].name} wins the pot of ${st.pot}!`); TB.pay(t, st.pl[i].id, st.pot, 'Dragon Dice'); return; } this.pass(t); return; }
        TB.say(t, `${st.pl[i].name} keeps ${idx.map(n => FACE[st.dice[n]]).join('')} (${st.tp} this turn) and rolls ${st.left}`); this.roll(t, a); return;
      }
      return false;
    },
    pass(t) { const st = t.st; st.turn = (st.turn + 1) % st.pl.length; this.newTurn(t); },
    next(t) {
      const st = t.st; if (st.phase === 'over') return null;
      if (st.phase === 'farkle') return { wait: st.at - now(), fn: t => this.pass(t) };
      const p = st.pl[st.turn];
      if (p.npc) return { wait: (st.phase === 'roll' ? 1500 : 3400) + R() * 900, fn: t => { if (st.phase === 'roll') return this.act(t, p.id, { t: 'roll' }); const b = A.bestKeep(st.dice), left = st.left - b.idx.length, tp = st.tp + b.s, bank = p.score + tp >= this.target || (left === 0 ? tp >= 1200 : left <= 2 ? tp >= 250 : left === 3 ? tp >= 450 : tp >= 800); return this.act(t, p.id, { t: bank ? 'bank' : 'keep', idx: b.idx }); } };
      return { wait: st.at - now(), fn: t => { if (st.phase === 'roll') return this.act(t, p.id, { t: 'roll' }); const b = A.bestKeep(st.dice); return this.act(t, p.id, { t: 'bank', idx: b.idx }); } };
    },
    leave(t, id) { const st = t.st, i = st.pl.findIndex(p => p.id === id); if (i < 0 || st.phase === 'over') return 0; st.pl.splice(i, 1); if (st.pl.length === 1) { const w = st.pl[0]; st.phase = 'over'; st.winner = w.name; TB.pay(t, w.id, st.pot, 'Dragon Dice'); return 0; } if (st.turn >= st.pl.length) st.turn = 0; if (i === st.turn || i < st.turn) { st.turn = Math.max(0, (i < st.turn ? st.turn - 1 : st.turn) % st.pl.length); this.newTurn(t); } return 0; },
    closeOut(t) { return t.st && t.st.phase !== 'over' ? t.buy : 0; },
    view(t, id) {
      const st = t.st, cur = st.pl[st.turn], mine = cur && cur.id === id, F = TB.form.ddSel || (TB.form.ddSel = []), blur = T.blur();
      let h = `<div class="tgame"><div class="goldline">Pot: ${st.pot} gold · first to ${this.target}</div>${st.pl.map((p, i) => `<div class="seat ${i === st.turn && st.phase !== 'over' ? 'turn' : ''}"><span class="nm">${esc(p.id === id ? 'You' : p.name)}<small>${i === st.turn && st.phase !== 'over' ? `${st.tp} at stake this turn` : ''}</small></span><span style="font-family:var(--head);font-size:20px;color:#f3d998">${p.score}</span></div>`).join('')}`;
      if (st.dice.length && st.phase !== 'over') { const sel = mine && st.phase === 'choose' ? F : []; const s = A.diceScore(sel.map(n => st.dice[n])); h += `<div class="dd" style="${mine ? blur : ''}">${st.dice.map((v, n) => `<span class="die ${sel.includes(n) ? 'sel' : ''} ${v === 1 ? 'drag' : ''}" ${mine && st.phase === 'choose' ? `data-dd="${n}"` : ''}>${FACE[v]}</span>`).join('')}</div>`;
        if (mine && st.phase === 'choose') h += `<div class="tact"><span class="note">${sel.length ? (s >= 0 ? `Selected: ${s}` : 'Those dice do not all score') : 'Click scoring dice to set them aside'}</span><button class="btn small" id="ddKeep" ${s < 0 ? 'disabled' : ''}>Keep &amp; roll ${st.left - sel.length || 6}</button><button class="btn small" id="ddBank" ${s < 0 ? 'disabled' : ''}>Bank ${s >= 0 ? st.tp + s : ''}</button><button class="btn small ghost" id="ddBest">Pick best</button></div>`; }
      if (mine && st.phase === 'roll') h += `<div class="tact"><button class="btn" id="ddRoll">Roll ${st.left} dice</button></div>`;
      if (st.phase === 'over') h += `<p class="note">${esc(st.winner)} takes the pot.</p>`;
      return h + '</div>';
    },
    bind(body, t) {
      const st = t.st, F = TB.form.ddSel || (TB.form.ddSel = []);
      if (st.phase !== 'choose' || (TB.form.ddKey !== st.dice.join('') + st.tp)) { F.length = 0; TB.form.ddKey = st.dice.join('') + st.tp; }
      body.querySelectorAll('[data-dd]').forEach(b => b.onclick = () => { const n = +b.dataset.dd, k = F.indexOf(n); if (k >= 0) F.splice(k, 1); else F.push(n); UI.renderPanel(); });
      const $ = x => body.querySelector('#' + x);
      if ($('ddRoll')) $('ddRoll').onclick = () => TB.act(t.tid, { t: 'roll' });
      if ($('ddKeep')) $('ddKeep').onclick = () => TB.act(t.tid, { t: 'keep', idx: F.slice() });
      if ($('ddBank')) $('ddBank').onclick = () => TB.act(t.tid, { t: 'bank', idx: F.slice() });
      if ($('ddBest')) $('ddBest').onclick = () => { F.length = 0; A.bestKeep(st.dice).idx.forEach(n => F.push(n)); UI.renderPanel(); };
    }
  };

  /* ================= Rat Races ================= */
  A.RAT_NAMES = ['Whiskers McGee', 'Lady Squeakington', 'Old Grey Bones', 'Plague Lord', 'Nibbles the Swift', 'Sir Gnaws-a-Lot', 'Mudtail', 'The Sewer King', 'Tiny Tim', 'Crumbsnatcher', 'Black Pip', 'Duchess Vermin'];
  A.RAT_COLORS = [0x8a7a6a, 0xe8e0d0, 0x4a3a30, 0x6a6a6a, 0xa07040, 0x2a2420];
  A.ratModel = (col) => {
    const g = new THREE.Group(), fur = G.mat('col', { c: col, r: 0.9, t: 'cloth' }), pink = G.mat('col', { c: 0xd89090, r: 0.6 });
    const body = M.P(g, M.sph(0.08, 14, 10), fur, [0, 0.07, 0], 0, [1, 0.8, 1.7]); const head = M.P(g, M.sph(0.05, 12, 8), fur, [0, 0.08, 0.15], 0, [0.9, 0.85, 1.3]);
    M.P(g, M.sph(0.012, 6, 5), pink, [0, 0.075, 0.215]); M.mirror(k => { M.P(g, M.sph(0.022, 8, 6), pink, [k * 0.03, 0.125, 0.12], 0, [1, 1, 0.4]); M.P(g, M.sph(0.008, 6, 5), G.mat('col', { c: 0x050304 }), [k * 0.022, 0.095, 0.185]); });
    const tail = M.P(g, M.tube([0, 0.05, -0.12, 0, 0.04, -0.22, 0.03, 0.03, -0.32, -0.02, 0.02, -0.4], 0.008, 10, 5), pink); g.userData.tail = tail; g.userData.body = body;
    for (let i = 0; i < 4; i++) M.P(g, M.cyl(0.01, 0.01, 0.05, 5), pink, [(i % 2 ? 1 : -1) * 0.04, 0.02, i < 2 ? 0.07 : -0.06]);
    return g;
  };
  // a race: each rat has a pace, a stamina and a temper; host simulates it once and everyone replays it
  A.ratRun = (rats, rnd) => { const L = A.RAT_LEN || 14, pos = rats.map(() => 0), fin = [], samples = rats.map(() => [0]); let t = 0; const st = rats.map(() => ({ burst: 0, stall: 0 }));
    while (fin.length < rats.length && t < 40) { t += 0.1; rats.forEach((r, i) => { if (pos[i] >= L) { samples[i].push(L); return; } const s = st[i]; if (s.burst > 0) s.burst -= 0.1; else if (rnd() < r.temper * 0.05) s.burst = 0.6 + rnd() * 0.8; if (s.stall > 0) s.stall -= 0.1; else if (rnd() < (1 - r.temper) * 0.02) s.stall = 0.3 + rnd() * 0.6;
      const tired = Math.max(0.55, 1 - Math.max(0, t - 3) * (1 - r.stam) * 0.09); let v = r.pace * tired * (0.85 + rnd() * 0.3) * (s.burst > 0 ? 1.6 : 1) * (s.stall > 0 ? 0.15 : 1); pos[i] = Math.min(L, pos[i] + v * 0.1); if (pos[i] >= L && !fin.includes(i)) fin.push(i); samples[i].push(Math.round(pos[i] * 100) / 100); }); }
    return { samples, order: fin, dur: t };
  };
  A.newRats = () => { const names = A.RAT_NAMES.slice().sort(() => R() - 0.5).slice(0, 6); const rats = names.map((n, i) => ({ n, c: i, pace: 1.25 + R() * 0.45, stam: 0.4 + R() * 0.6, temper: 0.2 + R() * 0.7 }));
    const wins = rats.map(() => 0); for (let k = 0; k < 300; k++) { const res = A.ratRun(rats, Math.random); wins[res.order[0]]++; } rats.forEach((r, i) => { const p = Math.max(0.02, wins[i] / 300); r.odds = Math.max(1.2, Math.round((0.88 / p) * 2) / 2); }); return rats; };
  GM.rats = {
    name: 'Rat Races', icon: '🐀', min: 1, max: 8, npc: false, payOnSeat: false, joinLate: true, minBuy: 10, maxBuy: 1000, defBuy: 100, step: 10, buyLabel: 'Bet limit',
    rules: 'Six rats, six lanes, fourteen metres of sawdust. Each rat shows its odds: a winning bet pays that many times your stake. Bets close fifteen seconds after the first coin hits the counter.',
    start(t) { const st = t.st; st.rats = A.newRats(); st.phase = 'bet'; st.bets = []; st.at = 0; st.race = null; st.n = 0; },
    myTurn(t, id) { return false; },
    act(t, id, a) {
      const st = t.st, seat = t.seats.find(s => s.id === id); if (!seat) return false;
      if (a.t === 'bet' && st.phase !== 'bet') { const amt = Math.round(G.clamp(+a.amt || 0, 1, t.buy)); TB.pay(t, id, amt, 'Bet returned, the gates had closed'); return; }
      if (a.t === 'bet' && st.phase === 'bet') { const rat = a.rat | 0, amt = Math.round(G.clamp(+a.amt || 0, 1, t.buy)); if (!st.rats[rat]) return false; st.bets.push({ id, name: seat.name, rat, amt }); TB.say(t, `${seat.name} puts ${amt} on ${st.rats[rat].n} (×${st.rats[rat].odds})`); if (!st.at) st.at = now() + 15000; if (R() < 0.6) { const who = ['Old Hollis', 'Mara', 'Grimsby', 'Pell'][G.ri(0, 3)], r2 = G.ri(0, 5); TB.say(t, `${who} backs ${st.rats[r2].n}`); } return; }
      if (a.t === 'go' && st.phase === 'bet' && id === t.host && st.bets.length) { this.run(t); return; }
      return false;
    },
    run(t) { const st = t.st, seed = Math.floor(R() * 1e9); let s = seed; const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; const res = A.ratRun(st.rats, rnd); st.race = { samples: res.samples, order: res.order, dur: res.dur, n: ++st.n }; st.phase = 'race'; st.at = now() + res.dur * 1000 + 600; TB.say(t, 'And they\'re off!'); },
    next(t) {
      const st = t.st;
      if (st.phase === 'bet' && st.at) return { wait: st.at - now(), fn: t => { if (st.bets.length) this.run(t); else st.at = 0; } };
      if (st.phase === 'race') return { wait: st.at - now(), fn: t => { const w = st.race.order[0], rat = st.rats[w]; st.phase = 'result'; st.winner = w; TB.say(t, `${rat.n} wins! (×${rat.odds})`); st.bets.forEach(b => { if (b.rat === w) { TB.pay(t, b.id, b.amt * rat.odds, `${rat.n} wins`); TB.say(t, `${b.name} collects ${Math.round(b.amt * rat.odds)}`); } }); st.at = now() + 6500; } };
      if (st.phase === 'result') return { wait: st.at - now(), fn: t => { st.rats = A.newRats(); st.bets = []; st.phase = 'bet'; st.at = 0; st.race = null; TB.say(t, 'New rats in the gates. Place your bets!'); } };
      return null;
    },
    leave(t, id) { const st = t.st; if (st.phase !== 'bet') return 0; const mine = st.bets.filter(b => b.id === id); st.bets = st.bets.filter(b => b.id !== id); return mine.reduce((a, b) => a + b.amt, 0); },
    closeOut(t, id) { const st = t.st; if (!st || st.phase === 'result') return 0; return st.bets.filter(b => b.id === id).reduce((a, b) => a + b.amt, 0); },
    onState(t) { A.ratState = t.closed ? null : t; if (t.st && t.st.race && (!A.ratRace || A.ratRace.n !== t.st.race.n || A.ratRace.tid !== t.tid)) { A.ratRace = { n: t.st.race.n, tid: t.tid, t0: performance.now(), samples: t.st.race.samples }; G.sfx('roar', 0.3); } if (t.st && !t.st.race) A.ratRace = null; },
    onClose() { A.ratState = null; A.ratRace = null; },
    view(t, id) {
      const st = t.st, F = TB.form.ratAmt || (TB.form.ratAmt = { amt: Math.min(50, t.buy) }), race = A.ratRace, el = race ? (performance.now() - race.t0) / 1000 : 0, k = Math.min(race ? race.samples[0].length - 1 : 0, Math.floor(el * 10));
      let h = `<div class="tgame"><div class="goldline">${st.phase === 'bet' ? (st.at ? `Bets close in ${Math.max(0, Math.ceil((st.at - now()) / 1000))}s` : 'Place a bet to start the countdown') : st.phase === 'race' ? 'The race is on!' : `${esc(st.rats[st.winner].n)} wins!`}</div><div class="rats">`;
      st.rats.forEach((r, i) => { const pos = race && race.samples[i] ? race.samples[i][Math.min(race.samples[i].length - 1, k)] / (A.RAT_LEN || 14) : 0, myBets = st.bets.filter(b => b.rat === i && b.id === id).reduce((a, b) => a + b.amt, 0);
        h += `<div class="ratrow ${st.phase === 'result' && st.winner === i ? 'win' : ''}"><span style="color:#${A.RAT_COLORS[i].toString(16).padStart(6, '0')}">●</span><span>${esc(r.n)}<br><small>pays ×${r.odds}${myBets ? ` · your bet ${myBets}` : ''}</small></span><span class="bar"><i style="width:${Math.round(pos * 100)}%"></i></span><span>×${r.odds}</span>${st.phase === 'bet' ? `<button class="btn small" data-rat="${i}" ${G.save.gold < F.amt ? 'disabled' : ''}>Bet</button>` : '<span></span>'}</div>`; });
      h += '</div>';
      if (st.phase === 'bet') h += `<div class="tact"><label>Stake <input type="number" id="ratAmt" min="1" max="${t.buy}" value="${F.amt}" style="width:80px;background:#1a140c;color:#f3d998;border:1px solid #6a5426;padding:5px"></label>${t.host === id && st.bets.length ? '<button class="btn small ghost" id="ratGo">Start the race</button>' : ''}</div>`;
      return h + '</div>';
    },
    bind(body, t) {
      const F = TB.form.ratAmt || (TB.form.ratAmt = { amt: 50 }), i = body.querySelector('#ratAmt'); if (i) i.oninput = () => { F.amt = +i.value; };
      body.querySelectorAll('[data-rat]').forEach(b => b.onclick = () => { const amt = Math.round(G.clamp(F.amt, 1, t.buy)); if (G.save.gold < amt) { G.ui.toast('Not enough gold'); return; } G.save.gold -= amt; G.persist(); G.sfx('coin', 0.6); TB.act(t.tid, { t: 'bet', rat: +b.dataset.rat, amt }); });
      const g = body.querySelector('#ratGo'); if (g) g.onclick = () => TB.act(t.tid, { t: 'go' });
      if (t.st.phase === 'race' || (t.st.phase === 'bet' && t.st.at)) { clearTimeout(A.ratPanelT); A.ratPanelT = setTimeout(() => { if (UI.panelKind === 'rats' && !document.getElementById('panelM').hidden) UI.renderPanel(); }, 250); }
    }
  };
  A.tickRats = (dt, t) => {
    const at = A.trackAt; if (!at || !A.ratMeshes.length) return; const race = A.ratRace;
    A.ratMeshes.forEach((m, i) => {
      let u = 0, moving = false;
      if (race && race.samples[i]) { const el = (performance.now() - race.t0) / 1000 * 10, s = race.samples[i], k = Math.min(s.length - 1, Math.floor(el)), f = Math.min(1, el - k), a = s[k], b = s[Math.min(s.length - 1, k + 1)]; u = a + (b - a) * f; moving = b > a; }
      m.position.x = at.x + u; m.position.y = at.y + (moving ? Math.abs(Math.sin(t * 22 + i)) * 0.02 : 0);
      if (m.userData.tail) m.userData.tail.rotation.y = Math.sin(t * (moving ? 18 : 3) + i) * 0.4;
    });
  };

  /* ================= Bar brawl: fists only, last one standing ================= */
  const BR_HP = 30;
  const inRing = (x, z) => { const r = A.spots && A.spots.ring; return !!r && (x - r.x) ** 2 + (z - r.z) ** 2 < (r.r - 0.3) ** 2; };
  const posOf = (id) => { if (id === me()) return G.player ? G.player.pos : null; const r = G.net.remotes[id]; return r && r.root.visible ? r.pos : null; };
  GM.brawl = {
    name: 'Bar Brawl', icon: '👊', min: 2, max: 6, npc: true, minBuy: 0, maxBuy: 500, defBuy: 20, step: 5, buyLabel: 'Stake',
    rules: 'Into the pit, fists only. Everyone has 30 brawl health that has nothing to do with your real health. Step out of the ring and you forfeit. Last one standing takes the pot.',
    start(t) { const st = t.st, rg = A.spots.ring; st.pl = t.seats.map((s, i) => { const a = i / t.seats.length * Math.PI * 2; return { id: s.id, name: s.name, npc: !!s.npc, hp: BR_HP, ko: false, x: rg.x + Math.cos(a) * rg.r * 0.6, z: rg.z + Math.sin(a) * rg.r * 0.6, yaw: 0, cd: 0, pt: 0 }; }); st.pot = t.buy * t.seats.length; st.phase = 'gather'; st.at = now() + 12000; st.hits = []; st.hn = 0; TB.say(t, 'Into the pit! The bell rings in twelve seconds.'); },
    myTurn() { return false; },
    act(t, id, a) {
      const st = t.st; if (st.phase !== 'fight' || a.t !== 'hit') return false; const by = st.pl.find(p => p.id === id), to = st.pl.find(p => p.id === a.to); if (!by || !to || by.ko || to.ko || by === to) return false;
      this.hit(t, by, to, G.clamp(a.dmg | 0, 1, 9));
    },
    hit(t, by, to, d) { const st = t.st; to.hp = Math.max(0, to.hp - d); st.hits.push({ n: ++st.hn, to: to.id, by: by.id, d }); if (st.hits.length > 12) st.hits.shift(); if (to.hp <= 0) { to.ko = true; TB.say(t, `${by.name} knocks out ${to.name}!`); } this.check(t); },
    check(t) { const st = t.st, up = st.pl.filter(p => !p.ko); if (up.length <= 1 && st.phase === 'fight') { st.phase = 'over'; const w = up[0]; st.winner = w ? w.name : 'Nobody'; if (w) { TB.say(t, `${w.name} is the last one standing and takes ${st.pot}!`); TB.pay(t, w.id, st.pot, 'Bar brawl'); } } },
    next(t) {
      const st = t.st;
      if (st.phase === 'gather') return { wait: st.at - now(), fn: t => { st.pl.forEach(p => { if (p.npc) return; const ps = posOf(p.id); if (!ps || !inRing(ps.x, ps.z)) { p.ko = true; p.hp = 0; TB.say(t, `${p.name} never stepped into the pit`); } }); st.phase = 'fight'; TB.say(t, 'DING! Fight!'); this.check(t); } };
      if (st.phase !== 'fight') return null;
      return { wait: 200, fn: t => {
        const rg = A.spots.ring;
        st.pl.forEach(p => { if (p.ko || p.npc) return; const ps = posOf(p.id); if (ps && !inRing(ps.x, ps.z)) { p.ko = true; p.hp = 0; TB.say(t, `${p.name} steps out of the pit and forfeits`); } });
        st.pl.forEach(p => { if (!p.npc || p.ko) return; p.cd = Math.max(0, p.cd - 0.2);
          let best = null, bd = 1e9; st.pl.forEach(q => { if (q === p || q.ko) return; const ps = q.npc ? q : posOf(q.id); if (!ps) return; const d = Math.hypot(ps.x - p.x, ps.z - p.z); if (d < bd) { bd = d; best = { q, ps }; } });
          if (!best) return; const dx = best.ps.x - p.x, dz = best.ps.z - p.z; p.yaw = Math.atan2(dx, dz);
          if (bd > 1.1) { const sp = Math.min(bd - 1.0, 0.5 + R() * 0.15); p.x += dx / bd * sp; p.z += dz / bd * sp; const rr = Math.hypot(p.x - rg.x, p.z - rg.z); if (rr > rg.r - 0.8) { p.x = rg.x + (p.x - rg.x) / rr * (rg.r - 0.8); p.z = rg.z + (p.z - rg.z) / rr * (rg.r - 0.8); } }
          else if (p.cd <= 0) { p.cd = 0.9 + R() * 0.5; p.pt++; if (R() < 0.62) this.hit(t, p, best.q, G.ri(2, 5)); }
        });
        this.check(t);
      } };
    },
    leave(t, id) { const st = t.st, p = st.pl.find(q => q.id === id); if (p && !p.ko && st.phase !== 'over') { p.ko = true; p.hp = 0; TB.say(t, `${p.name} slinks away`); this.check(t); } return 0; },
    closeOut(t) { return t.st && t.st.phase !== 'over' ? t.buy : 0; },
    onState(t, seat) {
      const st = t.st; A.brawlT = t.closed ? null : t; if (!st || !st.pl) return;
      const mine = st.pl.find(p => p.id === me()); A.brawling = !!(mine && !mine.ko && st.phase === 'fight' && !t.closed);
      // hits: numbers, sounds, and a jolt when it's you
      A.hitSeen = A.hitSeen || {}; const k = t.tid + ':' + (t.round || 0); st.hits.forEach(h => { if (h.n <= (A.hitSeen[k] || 0)) return; A.hitSeen[k] = h.n; const tp = st.pl.find(p => p.id === h.to), pos = tp && (tp.npc ? (A.brawlers[t.tid + tp.id] || {}).pos || tp : posOf(tp.id)); if (pos) { G.fx.dmgNumber(new G.V3(pos.x, 1.7, pos.z), h.d, false, '#ffb0a0'); G.sfx('thunk', 0.8, new G.V3(pos.x, 1, pos.z)); } if (h.to === me()) { G.fx.shake(0.35); G.ui.flash && G.ui.flash('hurt'); G.sfx('hurt', 0.6); if (G.player) G.player.kickX = (G.player.kickX || 0) + 0.06; } });
      if (mine && mine.ko && !A.koSeen) { A.koSeen = true; G.ui.toast('You are knocked out!'); G.sfx('groan', 0.8); A.koT = 2.2; } if (mine && !mine.ko) A.koSeen = false;
      A.brawlHud(); if (t.closed || st.phase === 'over') A.clearBrawlers(t);
    },
    onClose(t) { A.brawling = false; A.brawlT = null; A.clearBrawlers(t); A.brawlHud(); },
    view(t, id) { const st = t.st; let h = `<div class="tgame"><div class="goldline">Pot: ${st.pot} gold · ${st.phase === 'gather' ? `bell in ${Math.max(0, Math.ceil((st.at - now()) / 1000))}s, get into the pit!` : st.phase === 'fight' ? 'FIGHT!' : esc(st.winner) + ' wins'}</div>${st.pl.map(p => `<div class="seat ${p.ko ? 'out' : ''}"><span class="nm">${esc(p.id === id ? 'You' : p.name)}<small>${p.ko ? 'knocked out' : 'standing'}</small></span><span class="bar" style="flex:1;height:10px;background:rgba(0,0,0,.4);border-radius:5px;overflow:hidden"><i style="display:block;height:100%;width:${Math.round(p.hp / BR_HP * 100)}%;background:#c84030"></i></span><span>${p.hp}</span></div>`).join('')}`;
      if (st.phase === 'gather') h += '<p class="note">Close this and walk into the sparring pit. Left click throws a punch.</p>'; return h + '</div>'; }
  };
  A.clearBrawlers = (t) => { Object.keys(A.brawlers).forEach(k => { if (!t || k.startsWith(t.tid)) { const B = A.brawlers[k]; if (B.R.root.parent) B.R.root.parent.remove(B.R.root); delete A.brawlers[k]; } }); };
  A.brawlHud = () => { let el = document.getElementById('brawlHud'); const t = A.brawlT, mine = t && t.st && t.st.pl && t.st.pl.find(p => p.id === me()); if (!mine || t.closed || t.st.phase === 'over') { if (el) el.hidden = true; return; } if (!el) { el = document.createElement('div'); el.id = 'brawlHud'; document.getElementById('hud').appendChild(el); } el.hidden = false; el.innerHTML = mine.ko ? 'Knocked out · watch the rest' : `👊 Brawl ${mine.hp}/${BR_HP}${t.st.phase === 'gather' ? ' · get into the pit!' : ''}`; };
  A.tickBrawl = (dt, t) => {
    const T0 = A.brawlT; if (!T0 || !T0.st || !T0.st.pl) return; const st = T0.st;
    st.pl.forEach(p => { if (!p.npc) return; const key = T0.tid + p.id; let B = A.brawlers[key];
      if (!B && st.phase !== 'over') { const R2 = TM.patron(G.ri(0, 2)); R2.extraAnim = null; R2._brawl = true; R2.armPose = (Rr, s) => { const pt = s.punch || 0, k = Math.max(0, Math.sin(Math.min(1, pt) * Math.PI)); Rr.armL.sh.rotation.set(-1.3, 0.3, 0.3); Rr.armL.el.rotation.set(-1.6, 0, 0); Rr.armR.sh.rotation.set(-1.2 - k * 0.6, -0.3, -0.3); Rr.armR.el.rotation.set(-1.6 + k * 1.5, 0, 0); Rr.torso.rotation.y += k * 0.3; }; G.scene.add(R2.root); B = A.brawlers[key] = { R: R2, st: { t: R() * 5, move: 0, phase: 0, atk: -1 }, pos: { x: p.x, z: p.z }, pt: p.pt, punchT: 0 }; }
      if (!B) return; const was = { x: B.pos.x, z: B.pos.z }; B.pos.x = G.damp(B.pos.x, p.x, 8, dt); B.pos.z = G.damp(B.pos.z, p.z, 8, dt);
      const sp = Math.hypot(B.pos.x - was.x, B.pos.z - was.z) / Math.max(dt, 1e-3); B.st.move = G.damp(B.st.move, G.clamp(sp / 3, 0, 1), 8, dt); B.st.phase += dt * B.st.move * 9; B.st.t += dt;
      if (p.pt !== B.pt) { B.pt = p.pt; B.punchT = 0.001; G.sfx('swing', 0.4, new G.V3(B.pos.x, 1, B.pos.z)); } if (B.punchT > 0) { B.punchT += dt * 3; if (B.punchT > 1) B.punchT = 0; } B.st.punch = B.punchT;
      B.R.root.position.set(B.pos.x, 0, B.pos.z); B.R.root.rotation.y = G.lerpAng(B.R.root.rotation.y, p.yaw, dt * 8);
      if (p.ko) { B.R.root.rotation.x = G.damp(B.R.root.rotation.x, -1.45, 4, dt); B.R.root.position.y = 0.2; } else M.animHum(B.R, B.st);
    });
    // knocked out: the world tips over for a moment
    if (A.koT > 0) { A.koT -= dt; }
  };
  // fists: in a brawl your weapon stays on your belt and left click throws punches
  A.makeFists = () => { const g = new THREE.Group(), skin = G.mat('col', { c: 0xd8a888, r: 0.6, t: 'skin' }), wrap = G.mat('col', { c: 0xe8e0d0, r: 0.95, t: 'cloth' }), sleeve = G.mat('col', { c: 0x5a3a24, t: 'leather' });
    M.mirror(k => { const f = M.G(g, [k * 0.17, -0.2, -0.42], [0, -k * 0.12, 0]); const h = M.handGeo(k, 1.55, skin, true); h.rotation.set(Math.PI / 2, 0, 0); f.add(h);
      M.P(f, M.cyl(0.05, 0.05, 0.05, 14, 1, true), wrap, [0, 0.006, -0.055], [Math.PI / 2, 0, 0], [1.05, 1, 0.62]); M.P(f, M.cyl(0.036, 0.036, 0.04, 12), wrap, [0, 0, 0.012], [Math.PI / 2, 0, 0], [1.1, 1, 0.8]);
      M.P(f, M.cyl(0.033, 0.042, 0.3, 12), skin, [0, 0, 0.17], [Math.PI / 2, 0, 0], [1.1, 1, 0.85]); M.P(f, M.cyl(0.05, 0.05, 0.16, 12), sleeve, [0, 0, 0.36], [Math.PI / 2, 0, 0]); f.userData.k = k; });
    g.traverse(o => { o.frustumCulled = false; }); return g; };
  const mk0 = G.makePlayer;
  G.makePlayer = function (cls) {
    const Pl = mk0(cls), up0 = Pl.update, vm0 = Pl.animVM, cam0 = Pl.updateCam;
    Pl.update = (dt, t) => {
      if (!A.brawling) { if (A.fists) A.fists.visible = false; return up0(dt, t); }
      const clicked = G.mouse.lPressed, keep = { l: G.mouse.l, lp: G.mouse.lPressed, r: G.mouse.r };
      G.mouse.l = G.mouse.lPressed = false; G.pressed.KeyQ = G.pressed.KeyR = G.pressed.KeyG = G.pressed.KeyV = false;
      up0(dt, t); G.mouse.l = keep.l; G.mouse.lPressed = keep.lp;
      if (!A.fists) { A.fists = A.makeFists(); } if (A.fists.parent !== G.camera) G.camera.add(A.fists); A.fists.visible = true;
      A.punchCd = Math.max(0, (A.punchCd || 0) - dt); A.punchT = Math.max(0, (A.punchT || 0) - dt * 4);
      A.fists.children.forEach(f => { const jab = f.userData.k === (A.punchSide || 1) ? Math.sin(Math.min(1, 1 - A.punchT) * Math.PI) * (A.punchT > 0 ? 1 : 0) : 0; f.position.set(f.userData.k * 0.18 - f.userData.k * jab * 0.12, -0.2 + jab * 0.08 + Math.sin(t * 3 + f.userData.k) * 0.01, -0.42 - jab * 0.3); });
      if (clicked && A.punchCd <= 0 && !G.ui.modalOpen()) {
        A.punchCd = 0.42; A.punchT = 1; A.punchSide = -(A.punchSide || 1); G.sfx('swing', 0.5);
        const t0 = A.brawlT, st = t0.st, fy = Pl.yaw + Math.PI; let best = null, bd = 1.9;
        st.pl.forEach(p => { if (p.id === me() || p.ko) return; const ps = p.npc ? (A.brawlers[t0.tid + p.id] || {}).pos : posOf(p.id); if (!ps) return; const dx = ps.x - Pl.pos.x, dz = ps.z - Pl.pos.z, d = Math.hypot(dx, dz); if (d < bd && Math.abs(G.angDiff(fy, Math.atan2(dx, dz))) < 0.9) { bd = d; best = p; } });
        if (best) { const dmg = G.ri(1, 4) + 1 + Math.max(0, G.sheet.mod(Pl, 'STR')); TB.act(t0.tid, { t: 'hit', to: best.id, dmg }); G.fx.shake(0.12); G.ui.hitMarker && G.ui.hitMarker(false); }
      }
    };
    Pl.animVM = (dt, t) => { vm0(dt, t); if (A.brawling && Pl.V) Pl.V.root.visible = false; };
    Pl.updateCam = (dt, t) => { cam0(dt, t); if (A.koT > 0) { const k = Math.sin(Math.min(1, A.koT / 2.2) * Math.PI); G.camera.rotation.z += k * 0.6; G.camera.position.y -= k * 0.9; } };
    return Pl;
  };
})();
