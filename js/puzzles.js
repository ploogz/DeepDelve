/* ============================================================
   Puzzle rooms. Each one seals a vault chest behind bars.
   - Sigil Levers: a riddle tablet tells the order to pull four levers.
   - The Watchers: turn four statues to face the vault; each turn also
     turns its clockwise neighbour.
   - Flames of Memory: a rune stone plays a sequence of coloured
     braziers; light them in the same order.
   - Light of the Vault: turn mirrors to bounce a beam into the receiver crystal.
   - Rune Plates: nine plates, each press flips its neighbours too; wake them all.
   - Cipher Dial: three rings; their settings are painted on murals around the room.
   Actions are broadcast and applied identically on every client.
   ============================================================ */
'use strict';
G.Puzzles = {
  list: [],
  SYM: [['☾', 'Moon'], ['☀', 'Sun'], ['★', 'Star'], ['☠', 'Skull'], ['♆', 'Trident'], ['⚚', 'Serpent Staff'], ['♛', 'Crown'], ['⚔', 'Swords']],
  FLAME: [[0xff3a20, 'crimson'], [0x3a8aff, 'azure'], [0x40ff70, 'emerald'], [0xffc030, 'golden'], [0xc050ff, 'violet']],
  glyph(ch, col = '#ffd890') { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = 'rgba(20,14,10,0.0)'; x.fillRect(0, 0, 128, 128); x.font = '86px "Segoe UI Symbol","Noto Sans Symbols 2","DejaVu Sans",serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = col; x.shadowBlur = 18; x.fillStyle = col; x.fillText(ch, 64, 70); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; },
  build(L, th) {
    this.list = []; this.playing = null;
    (L.puzzles || []).forEach(p => { const P = this['make_' + p.kind](Object.assign({}, p), th); P.chestRef = G.World.chests[p.chest]; P.cage = this.cage(P.chestRef, th); this.list.push(P); });
  },
  stone(th) { return G.mat('col', { c: th === 'abyss' ? 0x241c34 : th === 'forge' ? 0x2a2222 : th === 'warrens' ? 0x6a5a48 : 0x8a867e, r: 0.9, t: 'rock' }); },
  // iron bars around the vault chest; they sink into the floor when the puzzle is solved
  cage(c, th) {
    if (!c) return null; const g = new THREE.Group(), ir = G.mat('col', { c: 0x2a2a30, m: 0.9, r: 0.4 });
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; M.P(g, M.cyl(0.035, 0.035, 1.6, 6), ir, [Math.cos(a) * 0.95, 0.8, Math.sin(a) * 0.95]); }
    M.P(g, M.tor(0.95, 0.05, 6, 32), ir, [0, 1.6, 0], [Math.PI / 2, 0, 0]); M.P(g, M.tor(0.95, 0.04, 6, 32), ir, [0, 0.4, 0], [Math.PI / 2, 0, 0]);
    M.P(g, M.cyl(1.15, 1.15, 0.08, 32), this.stone(th), [0, 0.04, 0]);
    g.position.set(c.x, 0, c.z); g.userData.dynamic = true; G.World.group.add(g); return g;
  },
  wallSpot(p, n, r) { // n spread-out wall positions inside the puzzle room, as faces
    const W = G.World, CS = W.CS, faces = G.shuffle((W.faces || []).filter(f => W.roomId[f[1] * W.W + f[0]] === p.room), r), out = [];
    for (const f of faces) { const x = (f[0] + 0.5) * CS, z = (f[1] + 0.5) * CS; if (out.every(o => Math.hypot(o.x - x, o.z - z) > 5.5)) out.push({ f, x, z }); if (out.length >= n) break; }
    return out;
  },
  /* ---------------- Sigil Levers ---------------- */
  make_levers(p, th) {
    const W = G.World, CS = W.CS, r = G.mulberry(p.seed), syms = G.shuffle(this.SYM.slice(), r).slice(0, 4), spots = this.wallSpot(p, 4, r);
    while (spots.length < 4) { const a = spots.length / 4 * Math.PI * 2; spots.push({ f: null, x: p.x + Math.cos(a) * 5, z: p.z + Math.sin(a) * 5 }); }
    p.order = G.shuffle([0, 1, 2, 3], r); p.prog = 0; p.syms = syms; p.read = {};
    p.levers = spots.map((s, i) => {
      const g = new THREE.Group(), st = this.stone(th), ir = G.mat('col', { c: 0x2a2a30, m: 0.9, r: 0.4 });
      M.P(g, M.box(0.6, 0.9, 0.12), st, [0, 1.2, 0.06]); M.P(g, M.box(0.08, 0.5, 0.06), G.mat('col', { c: 0x050505 }), [0, 1.2, 0.13]);
      const piv = M.G(g, [0, 1.2, 0.16]); M.P(piv, M.cyl(0.03, 0.03, 0.5, 8), ir, [0, 0.25, 0]); M.P(piv, M.sph(0.07, 12, 10), G.mat('col', { c: 0x8a1a1a, r: 0.4 }), [0, 0.5, 0]); piv.rotation.x = -0.5;
      const plaque = new THREE.Mesh(G.fx._dg || (G.fx._dg = new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ map: this.glyph(syms[i][0]), transparent: true, depthWrite: false })); plaque.position.set(0, 1.95, 0.14); plaque.scale.setScalar(0.55); plaque.renderOrder = 2; g.add(plaque);
      M.P(g, M.box(0.62, 0.62, 0.06), st, [0, 1.95, 0.08]);
      g.userData.dynamic = true;
      if (s.f) W.place(g, (s.f[0] + 0.5 + s.f[2] * 0.5) * CS - s.f[2] * 0.02, 0, (s.f[1] + 0.5 + s.f[3] * 0.5) * CS - s.f[3] * 0.02, Math.atan2(-s.f[2], -s.f[3]));
      else W.place(g, s.x, 0, s.z, Math.atan2(p.x - s.x, p.z - s.z));
      const fwd = s.f ? new G.V3(-s.f[2], 0, -s.f[3]) : new G.V3(p.x - s.x, 0, p.z - s.z).normalize();
      return { g, piv, x: g.position.x + fwd.x * 0.9, z: g.position.z + fwd.z * 0.9, down: 0, want: 0 };
    });
    // the riddle tablet at the heart of the room
    const tab = new THREE.Group(), st = this.stone(th); M.P(tab, M.box(1.4, 0.3, 0.6), st, [0, 0.15, 0]); M.P(tab, M.box(1.2, 1.6, 0.25), st, [0, 1.05, 0]); M.P(tab, M.cyl(0.6, 0.6, 0.25, 24, 1, false), st, [0, 1.85, 0], [Math.PI / 2, 0, 0], [1, 1, 0.5]);
    for (let k = 0; k < 6; k++) M.P(tab, M.box(0.8 - (k % 2) * 0.2, 0.03, 0.02), G.mat('emissive', { c: 0xffc070, i: 1.6 }), [0, 0.6 + k * 0.17, 0.14]);
    tab.userData.dynamic = true; tab.userData.light = { pos: new G.V3(0, 1.4, 0.8), color: 0xffc070, intensity: 1.2, dist: 5 }; W.place(tab, p.x, 0, p.z, Math.PI, 0.7);
    const n = p.order.map(i => syms[i][1]);
    p.clues = G.shuffle([`The ${n[1]} follows close behind the ${n[0]}.`, `The ${n[3]} rests last of all.`, `The ${n[2]} rises after the ${n[1]}, but before the ${n[3]}.`], r);
    return p;
  },
  /* ---------------- The Watchers ---------------- */
  make_watchers(p, th) {
    const W = G.World, r = G.mulberry(p.seed), st = this.stone(th), d = 3.6;
    const pos = [[-d, -d], [d, -d], [d, d], [-d, d]]; // clockwise around the vault
    p.f = [0, 0, 0, 0];
    const press = i => { p.f[i] = (p.f[i] + 1) % 4; p.f[(i + 1) % 4] = (p.f[(i + 1) % 4] + 1) % 4; };
    for (let k = 0; k < 3 + Math.floor(r() * 4); k++) press(Math.floor(r() * 4)); if (p.f.every(v => v === 0)) press(0);
    p.press = press; p.read = {};
    p.statues = pos.map(([dx, dz], i) => {
      const g = new THREE.Group(); M.P(g, M.box(1.0, 0.9, 1.0), st, [0, 0.45, 0]); M.P(g, M.box(1.1, 0.12, 1.1), st, [0, 0.96, 0]);
      const bust = M.G(g, [0, 1.02, 0]); M.P(bust, M.sph(0.42, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), st, [0, 0, 0], 0, [1.3, 0.8, 0.9]);
      M.P(bust, M.cyl(0.14, 0.17, 0.25, 12), st, [0, 0.4, 0]); M.P(bust, M.sph(0.25, 16, 12), st, [0, 0.72, 0], 0, [0.9, 1.05, 1]);
      M.P(bust, M.cone(0.05, 0.12, 6), st, [0, 0.7, 0.24], [Math.PI / 2, 0, 0]); M.P(bust, M.cone(0.32, 0.4, 6), st, [0, 1.0, -0.02], 0, [1, 1, 0.8]);
      const eyeM = new THREE.MeshBasicMaterial({ color: 0xff3020 }); M.mirror(s => M.P(bust, M.sph(0.04, 8, 6), eyeM, [s * 0.09, 0.76, 0.21]));
      // a carved beam of sight on the floor shows where each Watcher looks
      const beam = new THREE.Mesh(G.fx._dg, new THREE.MeshBasicMaterial({ map: G.tex.sprite('glow'), color: 0xff3020, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); beam.rotation.x = -Math.PI / 2; beam.position.set(0, 0.05, 1.6); beam.scale.set(0.5, 2.6, 1); beam.renderOrder = 0.7; bust.add(beam);
      g.userData.dynamic = true; const x = p.x + dx, z = p.z + dz, base = Math.atan2(p.x - x, p.z - z);
      W.place(g, x, 0, z, 0, 0.7); bust.rotation.y = base + p.f[i] * Math.PI / 2;
      return { g, bust, eyeM, beam, x, z, base, ang: bust.rotation.y };
    });
    const pl = new THREE.Group(); M.P(pl, M.box(0.9, 1.0, 0.25), st, [0, 0.5, 0]); for (let k = 0; k < 4; k++) M.P(pl, M.box(0.6, 0.03, 0.02), G.mat('emissive', { c: 0x9ad0ff, i: 1.5 }), [0, 0.35 + k * 0.14, 0.13]);
    pl.userData.dynamic = true; W.place(pl, p.x, 0, p.z + 2, 0, 0.4); p.plaque = { x: p.x, z: p.z + 2.6 };
    return p;
  },
  /* ---------------- Flames of Memory ---------------- */
  make_flames(p, th) {
    const W = G.World, r = G.mulberry(p.seed), st = this.stone(th);
    p.seq = G.shuffle([0, 1, 2, 3, 4], r); p.prog = 0; p.read = {};
    p.braziers = this.FLAME.map(([col], i) => {
      const a = Math.PI + 0.45 + i / 4 * (Math.PI - 0.9), x = p.x + Math.cos(a) * 4.8, z = p.z + Math.sin(a) * 4.8;
      const g = new THREE.Group(); M.P(g, M.cyl(0.35, 0.45, 0.8, 16), st, [0, 0.4, 0]); M.P(g, M.lathe([0.1, 0.8, 0.45, 0.85, 0.55, 1.05, 0.5, 1.08, 0.38, 0.92, 0, 0.9], 24), G.mat('dark'));
      M.P(g, M.tor(0.5, 0.03, 6, 28), G.mat('emissive', { c: col, i: 1.4 }), [0, 1.06, 0], [Math.PI / 2, 0, 0]);
      const fl = M.flame(g, 2.2, col); fl.position.y = 1.0; fl.visible = false;
      const num = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glyph(String(p.seq.indexOf(i) + 1), '#ffffff'), transparent: true, depthWrite: false, opacity: 0 })); num.position.y = 2.6; num.scale.setScalar(0.7); g.add(num);
      g.userData.dynamic = true; W.place(g, x, 0, z, 0, 0.5);
      const L = { pos: new G.V3(x, 1.6, z), color: col, intensity: 0, dist: 8, seed: i, flicker: true }; W.lights.push(L);
      return { g, fl, num, L, x, z, lit: false, flare: 0 };
    });
    const stn = new THREE.Group(); M.P(stn, M.ico(0.55, 1), st, [0, 0.55, 0], 0, [1, 1.3, 0.8]); for (let k = 0; k < 5; k++) M.P(stn, M.oct(0.05), G.mat('emissive', { c: this.FLAME[k][0], i: 2.5 }), [-0.3 + k * 0.15, 0.7 + (k % 2) * 0.12, 0.42]);
    stn.userData.dynamic = true; W.place(stn, p.x, 0, p.z + 3, 0, 0.5); p.stone = { x: p.x, z: p.z + 3.6 };
    return p;
  },
  /* ---------------- Light of the Vault (mirrors) ----------------
     A crystal shines a beam across a 5x5 floor grid. Turn the mirrors so the beam bounces into the vault's
     receiver crystal. Some mirrors are decoys. */
  make_mirrors(p, th) {
    const W = G.World, r = G.mulberry(p.seed), st = this.stone(th), S = 2.6, inG = (i, j) => Math.abs(i) <= 2 && Math.abs(j) <= 2;
    const refl = (t, d) => t === 0 ? [d[1], d[0]] : [-d[1], -d[0]];
    let plan = null;
    for (let tries = 0; tries < 400 && !plan; tries++) {
      const j0 = G.pick([-2, -1, 1, 2], r); let cur = [-3, j0], d = [1, 0]; const turns = [], used = new Set(['0,0']), path = [];
      const want = 3 + (r() < 0.5 ? 1 : 0); let ok = true;
      for (let t = 0; t < want && ok; t++) {
        const cands = []; for (let k = 1; k <= 5; k++) { const c = [cur[0] + d[0] * k, cur[1] + d[1] * k]; if (!inG(c[0], c[1]) || used.has(c + '')) break; cands.push(c); }
        if (!cands.length) { ok = false; break; }
        const c = G.pick(cands, r); for (let k = 1; ; k++) { const q = [cur[0] + d[0] * k, cur[1] + d[1] * k]; path.push(q + ''); used.add(q + ''); if (q[0] === c[0] && q[1] === c[1]) break; }
        const nd = r() < 0.5 ? [d[1], d[0]] : [-d[1], -d[0]]; const tt = nd[0] === d[1] && nd[1] === d[0] ? 0 : 1; turns.push({ i: c[0], j: c[1], t: tt }); d = nd; cur = c;
      }
      if (!ok) continue;
      const ends = []; for (let k = 1; k <= 5; k++) { const c = [cur[0] + d[0] * k, cur[1] + d[1] * k]; if (!inG(c[0], c[1]) || used.has(c + '')) break; ends.push(c); }
      if (!ends.length) continue; const end = G.pick(ends, r); for (let k = 1; ; k++) { const q = [cur[0] + d[0] * k, cur[1] + d[1] * k]; used.add(q + ''); if (q[0] === end[0] && q[1] === end[1]) break; }
      plan = { j0, turns, end, used };
    }
    if (!plan) return this.make_flames(Object.assign(p, { kind: 'flames' }), th);
    p.S = S; p.j0 = plan.j0; p.recv = plan.end; p.read = {};
    // decoy mirrors on free slots off the path
    const free = []; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (!plan.used.has([i, j] + '') && !(i === plan.end[0] && j === plan.end[1])) free.push([i, j]);
    const decoys = G.shuffle(free, r).slice(0, 2).map(([i, j]) => ({ i, j, t: r() < 0.5 ? 0 : 1, decoy: true }));
    p.mirrors = plan.turns.map(m => Object.assign({}, m, { sol: m.t })).concat(decoys);
    p.mirrors.forEach(m => { if (!m.decoy) m.t = r() < 0.75 ? 1 - m.sol : m.sol; });
    if (p.mirrors.filter(m => !m.decoy).every(m => m.t === m.sol)) p.mirrors[0].t = 1 - p.mirrors[0].sol;
    p.refl = refl; const wp = (i, j) => [p.x + i * S, p.z + j * S];
    // the light crystal on its plinth, the receiver above the vault grid slot, the mirrors
    const src = new THREE.Group(); M.P(src, M.cyl(0.4, 0.5, 1.1, 12), st, [0, 0.55, 0]); M.P(src, M.oct(0.28, 0), G.mat('emissive', { c: 0xfff0b0, i: 3 }), [0, 1.45, 0], 0, [1, 1.6, 1]);
    src.userData.dynamic = true; src.userData.light = { pos: new G.V3(0, 1.5, 0), color: 0xfff0b0, intensity: 1.6, dist: 6 }; const [sx, sz] = wp(-3, p.j0); W.place(src, sx, 0, sz, 0, 0.5);
    const rc = new THREE.Group(); M.P(rc, M.cyl(0.3, 0.42, 1.0, 12), st, [0, 0.5, 0]); p.recvGem = M.P(rc, M.oct(0.26, 0), new THREE.MeshStandardMaterial({ color: 0x405060, emissive: 0x000000, roughness: 0.2, metalness: 0.3 }), [0, 1.35, 0], 0, [1, 1.5, 1]);
    rc.userData.dynamic = true; const [rx, rz] = wp(p.recv[0], p.recv[1]); W.place(rc, rx, 0, rz, 0, 0.45);
    // floor grid inlay so the slots read clearly
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const [x, z] = wp(i, j); const t = new THREE.Mesh(G.fx._dg || (G.fx._dg = new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ map: G.tex.sprite('rune'), color: 0xffe0a0, transparent: true, opacity: 0.12, depthWrite: false })); t.rotation.x = -Math.PI / 2; t.position.set(x, 0.03, z); t.scale.setScalar(1.6); t.userData.dynamic = true; W.group.add(t); }
    p.mirrors.forEach(m => {
      const g = new THREE.Group(); M.P(g, M.cyl(0.32, 0.4, 0.5, 12), st, [0, 0.25, 0]);
      m.head = M.G(g, [0, 0.5, 0]); M.P(m.head, M.box(1.0, 1.0, 0.06), G.mat('col', { c: 0xd8e4f0, m: 1, r: 0.06 }), [0, 0.65, 0]); M.P(m.head, M.box(1.08, 1.08, 0.04), G.mat('bronze'), [0, 0.65, -0.04]);
      g.userData.dynamic = true; const [x, z] = wp(m.i, m.j); m.x = x; m.z = z; W.place(g, x, 0, z, 0, 0.45);
      m.ang = this.mAng(m.t); m.head.rotation.y = m.ang;
    });
    p.beam = new THREE.Group(); p.beam.userData.dynamic = true; W.group.add(p.beam);
    p.beamLight = { pos: new G.V3(sx, 1.4, sz), color: 0xfff0b0, intensity: 1.4, dist: 6, seed: 3 }; W.lights.push(p.beamLight);
    this.traceBeam(p);
    return p;
  },
  mAng(t) { return t === 0 ? -Math.PI / 4 : Math.PI / 4; },
  traceBeam(p) {
    const S = p.S, pts = [[-3, p.j0]]; let cur = [-3, p.j0], d = [1, 0], hit = false;
    for (let k = 0; k < 40; k++) {
      const n = [cur[0] + d[0], cur[1] + d[1]];
      if (Math.abs(n[0]) > 2 || Math.abs(n[1]) > 2) { pts.push([n[0] - d[0] * 0.5, n[1] - d[1] * 0.5]); break; }
      if (n[0] === 0 && n[1] === 0) { pts.push([n[0] - d[0] * 0.4, n[1] - d[1] * 0.4]); break; }
      if (n[0] === p.recv[0] && n[1] === p.recv[1]) { pts.push(n); hit = true; break; }
      const m = p.mirrors.find(q => q.i === n[0] && q.j === n[1]); cur = n;
      if (m) { pts.push(n); d = p.refl(m.t, d); }
    }
    while (p.beam.children.length) { const c = p.beam.children.pop(); c.material.dispose(); }
    const mat = new THREE.MeshBasicMaterial({ color: hit ? 0xa0ffb0 : 0xfff0b0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < pts.length - 1; i++) { const a = new G.V3(p.x + pts[i][0] * S, 1.45, p.z + pts[i][1] * S), b = new G.V3(p.x + pts[i + 1][0] * S, 1.45, p.z + pts[i + 1][1] * S), L = a.distanceTo(b); if (L < 0.01) continue;
      const c = new THREE.Mesh(gk('beamcyl', () => new THREE.CylinderGeometry(0.05, 0.05, 1, 8, 1, true)), mat.clone()); c.position.copy(a).add(b).multiplyScalar(0.5); c.quaternion.setFromUnitVectors(new G.V3(0, 1, 0), b.clone().sub(a).normalize()); c.scale.set(1, L, 1); p.beam.add(c); }
    const e = pts[pts.length - 1]; p.beamLight.pos.set(p.x + e[0] * S, 1.4, p.z + e[1] * S);
    p.recvGem.material.emissive.setHex(hit ? 0x40ff70 : 0x000000); p.recvGem.material.emissiveIntensity = hit ? 2.5 : 0;
    return hit;
  },
  /* ---------------- Rune Plates ----------------
     Nine plates in a 3x3 square. Pressing one flips it and its orthogonal neighbours. Light them all. */
  make_plates(p, th) {
    const W = G.World, r = G.mulberry(p.seed), st = this.stone(th), S = 2.4;
    p.on = new Array(9).fill(1); p.scr = [];
    const flip = i => { const x = i % 3, y = Math.floor(i / 3); [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const X = x + dx, Y = y + dy; if (X >= 0 && X < 3 && Y >= 0 && Y < 3) p.on[Y * 3 + X] ^= 1; }); };
    const presses = G.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8], r).slice(0, 3 + Math.floor(r() * 2)); presses.forEach(i => { flip(i); p.scr.push(i); });
    if (p.on.every(v => v)) { flip(4); p.scr.push(4); }
    p.flip = flip; p.read = {};
    p.plates = p.on.map((v, i) => {
      const g = new THREE.Group(); M.P(g, M.box(1.9, 0.12, 1.9), st, [0, 0.06, 0]);
      const m = new THREE.MeshStandardMaterial({ color: 0x302820, emissive: 0x60c0ff, emissiveIntensity: 0, roughness: 0.6 }); const top = M.P(g, M.box(1.5, 0.05, 1.5), m, [0, 0.14, 0]);
      const gl = new THREE.Mesh(G.fx._dg, new THREE.MeshBasicMaterial({ map: G.tex.sprite('rune'), color: 0x60c0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); gl.rotation.x = -Math.PI / 2; gl.position.y = 0.18; gl.scale.setScalar(1.4); g.add(gl);
      g.userData.dynamic = true; const x = p.x + (i % 3 - 1) * S, z = p.z + (Math.floor(i / 3) - 1) * S; W.place(g, x, 0, z, 0);
      return { g, m, gl, top, x, z, k: v };
    });
    const pl = new THREE.Group(); M.P(pl, M.box(0.9, 1.1, 0.25), st, [0, 0.55, 0]); for (let k = 0; k < 3; k++) for (let q = 0; q < 3; q++) M.P(pl, M.box(0.16, 0.16, 0.02), G.mat('emissive', { c: 0x60c0ff, i: 1.4 }), [(q - 1) * 0.22, 0.55 + (k - 1) * 0.22, 0.13]);
    pl.userData.dynamic = true; W.place(pl, p.x, 0, p.z - 4.6, 0, 0.4); p.plaque = { x: p.x, z: p.z - 4.0 };
    return p;
  },
  /* ---------------- Cipher Dial ----------------
     Three stone rings around a column, each carved with six symbols. Three murals hidden around the room each
     show one ring's symbol. Set all three to open the vault. */
  make_dials(p, th) {
    const W = G.World, r = G.mulberry(p.seed), st = this.stone(th), syms = G.shuffle(this.SYM.slice(), r).slice(0, 6);
    p.syms = syms; p.code = [0, 1, 2].map(() => Math.floor(r() * 6)); p.cur = [0, 1, 2].map((_, k) => (p.code[k] + 1 + Math.floor(r() * 5)) % 6); p.read = {}; p.seen = {};
    const col = new THREE.Group(); M.P(col, M.cyl(0.5, 0.65, 0.4, 20), st, [0, 0.2, 0]); M.P(col, M.cyl(0.32, 0.32, 3.0, 16), st, [0, 1.5, 0]); M.P(col, M.cyl(0.5, 0.4, 0.3, 20), st, [0, 3.1, 0]);
    p.rings = [0, 1, 2].map(k => {
      const ring = M.G(col, [0, 0.9 + k * 0.75, 0]), R0 = 0.62 - k * 0.04; M.P(ring, M.cyl(R0, R0, 0.5, 24), G.mat('col', { c: [0x8a7a5a, 0x7a6a8a, 0x5a7a7a][k], r: 0.8, t: 'rock' }));
      for (let s2 = 0; s2 < 6; s2++) { const a = s2 / 6 * Math.PI * 2, pl = new THREE.Mesh(G.fx._dg, new THREE.MeshBasicMaterial({ map: this.glyph(syms[s2][0], '#ffe0a0'), transparent: true, depthWrite: false })); pl.position.set(Math.sin(a) * (R0 + 0.01), 0, Math.cos(a) * (R0 + 0.01)); pl.rotation.y = a; pl.scale.setScalar(0.42); ring.add(pl); }
      ring.rotation.y = -p.cur[k] / 6 * Math.PI * 2; return { ring, ang: ring.rotation.y };
    });
    M.P(col, M.cone(0.08, 0.2, 4), G.mat('emissive', { c: 0xffd070, i: 2 }), [0, 0.9, 0.8], [-Math.PI / 2, 0, 0]);   // marker: the face pointing at the vault is the one that counts
    for (let k = 0; k < 3; k++) M.P(col, M.box(0.05, 0.45, 0.04), G.mat('emissive', { c: 0xffd070, i: 1.6 }), [0, 0.9 + k * 0.75, 0.72]);
    col.userData.dynamic = true; W.place(col, p.x, 0, p.z, 0, 0.8);
    // three ring handles around the column (low, middle, high ring)
    p.handles = [0, 1, 2].map(k => { const a = Math.PI + (k - 1) * 0.9, x = p.x + Math.sin(a) * 1.9, z = p.z + Math.cos(a) * 1.9; const g = new THREE.Group(); M.P(g, M.cyl(0.08, 0.1, 0.9 + k * 0.3, 8), G.mat('bronze'), [0, (0.9 + k * 0.3) / 2, 0]); M.P(g, M.tor(0.18, 0.03, 6, 16), G.mat('bronze'), [0, 0.9 + k * 0.3, 0], [Math.PI / 2, 0, 0]); g.userData.dynamic = true; W.place(g, x, 0, z, 0, 0.25); return { x, z }; });
    // the murals
    const spots = this.wallSpot(p, 3, r); while (spots.length < 3) { const a = spots.length * 2.1; spots.push({ f: null, x: p.x + Math.cos(a) * 7, z: p.z + Math.sin(a) * 7 }); }
    const names = ['lowest', 'middle', 'highest'];
    p.murals = spots.map((sp, k) => {
      const g = new THREE.Group(); M.P(g, M.box(1.5, 1.7, 0.08), st, [0, 1.7, 0.04]);
      const c = document.createElement('canvas'); c.width = 256; c.height = 300; const x = c.getContext('2d'); x.fillStyle = '#2a2018'; x.fillRect(0, 0, 256, 300); x.strokeStyle = '#a08040'; x.lineWidth = 8; x.strokeRect(8, 8, 240, 284);
      for (let q = 0; q < 3; q++) { x.fillStyle = q === k ? '#ffd070' : '#5a4a30'; x.fillRect(70, 200 - q * 60, 116, 40); }
      x.font = '96px "Segoe UI Symbol","Noto Sans Symbols 2","DejaVu Sans",serif'; x.textAlign = 'center'; x.fillStyle = '#ffe0a0'; x.shadowColor = '#ffc070'; x.shadowBlur = 16; x.fillText(syms[p.code[k]][0], 128, 100);
      const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; const m = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.52), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, emissive: 0x332211, emissiveMap: tex, emissiveIntensity: 0.6 })); m.position.set(0, 1.7, 0.09); g.add(m);
      g.userData.dynamic = true;
      if (sp.f) W.place(g, (sp.f[0] + 0.5 + sp.f[2] * 0.5) * W.CS - sp.f[2] * 0.02, 0, (sp.f[1] + 0.5 + sp.f[3] * 0.5) * W.CS - sp.f[3] * 0.02, Math.atan2(-sp.f[2], -sp.f[3]));
      else W.place(g, sp.x, 0, sp.z, Math.atan2(p.x - sp.x, p.z - sp.z));
      const fwd = sp.f ? new G.V3(-sp.f[2], 0, -sp.f[3]) : new G.V3(p.x - sp.x, 0, p.z - sp.z).normalize();
      return { x: g.position.x + fwd.x * 1.1, z: g.position.z + fwd.z * 1.1, k, name: names[k] };
    });
    return p;
  },
  /* ---------------- interaction ---------------- */
  targets(px, pz, consider) {
    const me = G.net.myId();
    this.list.forEach(p => {
      if (p.solved) return;
      if (p.kind === 'levers') {
        const d0 = Math.hypot(p.x - px, p.z - pz); if (d0 < 2.4) consider(d0, { k: 'pz', p, a: 'riddle', label: 'Read the riddle tablet' });
        p.levers.forEach((l, i) => { const d = Math.hypot(l.x - px, l.z - pz); if (d < 1.9 && !l.want) consider(d, { k: 'pz', p, a: 'lever', v: i, label: `Pull the lever of the ${p.syms[i][1]} ${p.syms[i][0]}` }); });
      } else if (p.kind === 'watchers') {
        const d0 = Math.hypot(p.plaque.x - px, p.plaque.z - pz); if (d0 < 1.8) consider(d0, { k: 'pz', p, a: 'plaque', label: 'Read the inscription' });
        p.statues.forEach((s, i) => { const d = Math.hypot(s.x - px, s.z - pz); if (d < 2.2) consider(d, { k: 'pz', p, a: 'turn', v: i, label: 'Turn the Watcher' }); });
      } else if (p.kind === 'flames') {
        const d0 = Math.hypot(p.stone.x - px, p.stone.z - pz); if (d0 < 2) consider(d0, { k: 'pz', p, a: 'stone', label: 'Touch the memory stone' });
        p.braziers.forEach((b, i) => { const d = Math.hypot(b.x - px, b.z - pz); if (d < 1.9 && !b.lit) consider(d, { k: 'pz', p, a: 'light', v: i, label: `Light the ${this.FLAME[i][1]} brazier` }); });
      } else if (p.kind === 'mirrors') {
        p.mirrors.forEach((m, i) => { const d = Math.hypot(m.x - px, m.z - pz); if (d < 1.7) consider(d, { k: 'pz', p, a: 'mirror', v: i, label: 'Turn the mirror' }); });
        const ds = Math.hypot(p.x - 3 * p.S - px, p.z + p.j0 * p.S - pz); if (ds < 2) consider(ds, { k: 'pz', p, a: 'lightstone', label: 'Examine the light crystal' });
      } else if (p.kind === 'plates') {
        const d0 = Math.hypot(p.plaque.x - px, p.plaque.z - pz); if (d0 < 1.8) consider(d0, { k: 'pz', p, a: 'platehint', label: 'Read the rune plaque' });
        p.plates.forEach((q, i) => { const d = Math.hypot(q.x - px, q.z - pz); if (d < 1.0) consider(d, { k: 'pz', p, a: 'plate', v: i, label: q.k ? 'Press the glowing plate' : 'Press the dark plate' }); });
      } else if (p.kind === 'dials') {
        p.handles.forEach((h, i) => { const d = Math.hypot(h.x - px, h.z - pz); if (d < 1.3) consider(d, { k: 'pz', p, a: 'dial', v: i, label: `Turn the ${['lowest', 'middle', 'highest'][i]} ring (showing ${p.syms[p.cur[i]][1]})` }); });
        p.murals.forEach(m => { const d = Math.hypot(m.x - px, m.z - pz); if (d < 1.8) consider(d, { k: 'pz', p, a: 'mural', v: m.k, label: 'Study the mural' }); });
        const dc = Math.hypot(p.x - px, p.z - pz); if (dc < 2.2) consider(dc + 0.3, { k: 'pz', p, a: 'dialcol', label: 'Examine the column' });
      }
    });
  },
  interact(T) {
    const p = T.p, P = G.player, me = G.net.myId(), dd = Math.floor((G.run.depth || 0) / 3);
    if (T.a === 'riddle') {
      const o = { skill: 'Investigation', dc: 12 + dd }, opts = [];
      if (!p.read[me]) opts.push({ label: `Study the worn grooves ${G.game.chkLabel(o)}`, fn: () => { p.read[me] = 1; G.dialog.close(false); G.dice.check(o, r => { if (r.success) G.dialog.open({ name: 'Riddle Tablet', role: 'Solved by study', color: '#ffc070', text: `Under the dust, faint scratches mark the true order: ${p.order.map(i => p.syms[i][1]).join(', then ')}.`, options: [{ label: 'Step back', fn: () => G.dialog.close() }] }); else G.ui.lockSoon(); }); } });
      opts.push({ label: 'Step back', fn: () => G.dialog.close() });
      G.dialog.open({ name: 'Riddle Tablet', role: 'Sigil Levers', color: '#ffc070', text: `Four sigils guard the vault. Pull them in the order the stone remembers. ${p.clues.join(' ')} Pull wrongly, and the walls will answer.`, options: opts });
      return;
    }
    if (T.a === 'plaque') {
      const o = { skill: 'Investigation', dc: 13 + dd }, opts = [];
      if (!p.read[me]) opts.push({ label: `Search the plinths for a mechanism ${G.game.chkLabel(o)}`, fn: () => { p.read[me] = 1; G.dialog.close(false); G.dice.check(o, r => { if (r.success) G.dialog.open({ name: 'The Watchers', role: 'Mechanism found', color: '#9ad0ff', text: 'Gears link each plinth to the next one clockwise. Turn a Watcher and its clockwise neighbour turns with it. A Watcher looking at the vault has green eyes.', options: [{ label: 'Step back', fn: () => G.dialog.close() }] }); else G.ui.lockSoon(); }); } });
      opts.push({ label: 'Step back', fn: () => G.dialog.close() });
      G.dialog.open({ name: 'The Watchers', role: 'Inscription', color: '#9ad0ff', text: 'Let every Watcher behold the treasure it guards. But know this: no Watcher turns alone.', options: opts });
      return;
    }
    if (T.a === 'stone') {
      const o = { skill: 'Arcana', dc: 13 + dd, adv: P.cls === 'wizard' }, opts = [{ label: 'Touch the stone (watch the flames)', fn: () => { G.dialog.close(); this.play(p, !!p.read[me + 'ok']); } }];
      if (!p.read[me]) opts.push({ label: `Read the runes as they flare ${G.game.chkLabel(o)}`, fn: () => { p.read[me] = 1; G.dialog.close(false); G.dice.check(o, r => { if (r.success) { p.read[me + 'ok'] = 1; G.ui.toast('The runes number each flame as it burns'); } this.play(p, r.success); G.ui.lockSoon(); }); } });
      opts.push({ label: 'Step back', fn: () => G.dialog.close() });
      G.dialog.open({ name: 'Memory Stone', role: 'Flames of Memory', color: '#ffb050', text: 'Five coloured gems are set in the stone. Touch it, and the braziers will burn in an order the vault remembers. Light them the same way. Light them wrong, and they burn you instead.', options: opts });
      return;
    }
    if (T.a === 'lightstone') {
      const o = { skill: 'Investigation', dc: 13 + dd }, opts = [];
      if (!p.read[me]) opts.push({ label: `Trace the light along the floor runes ${G.game.chkLabel(o)}`, fn: () => { p.read[me] = 1; G.dialog.close(false); G.dice.check(o, r => { if (r.success) { const m = p.mirrors.find(q => !q.decoy && q.t !== q.sol); G.dialog.open({ name: 'Light Crystal', role: 'Path traced', color: '#fff0b0', text: `${p.mirrors.filter(q => q.decoy).length} of the mirrors are decoys that the true path never touches.${m ? ' Scorch marks say one of the mirrors the light needs is turned the wrong way.' : ''} The light must bend ${p.mirrors.filter(q => !q.decoy).length} times.`, options: [{ label: 'Step back', fn: () => G.dialog.close() }] }); if (m) { G.fx.spark(new G.V3(m.x, 1.6, m.z), 0xffe080, 20, 3); } } else G.ui.lockSoon(); }); } });
      opts.push({ label: 'Step back', fn: () => G.dialog.close() });
      G.dialog.open({ name: 'Light Crystal', role: 'Light of the Vault', color: '#fff0b0', text: 'The crystal pours a beam of light across the floor. Mirrors stand on the grid; each turns a quarter. Guide the light into the dark crystal by the vault and the bars will fall.', options: opts }); return;
    }
    if (T.a === 'platehint') {
      const o = { skill: 'Arcana', dc: 13 + dd, adv: P.cls === 'wizard' || P.cls === 'priest' }, opts = [];
      if (!p.read[me]) opts.push({ label: `Feel the flow between the plates ${G.game.chkLabel(o)}`, fn: () => { p.read[me] = 1; G.dialog.close(false); G.dice.check(o, r => { if (r.success) { const k = p.scr[0]; G.dialog.open({ name: 'Rune Plaque', role: 'Flow sensed', color: '#60c0ff', text: `The magic pools under the ${['north-west', 'north', 'north-east', 'west', 'centre', 'east', 'south-west', 'south', 'south-east'][k]} plate. Press it once.`, options: [{ label: 'Step back', fn: () => G.dialog.close() }] }); } else G.ui.lockSoon(); }); } });
      opts.push({ label: 'Step back', fn: () => G.dialog.close() });
      G.dialog.open({ name: 'Rune Plaque', role: 'Rune Plates', color: '#60c0ff', text: 'Nine plates, one current. Press a plate and it changes, along with the plates beside it (not the corners). Wake all nine and the vault will open.', options: opts }); return;
    }
    if (T.a === 'mural') {
      const m = p.murals[T.v]; p.seen[m.k] = 1;
      G.dialog.open({ name: 'Faded Mural', role: 'Cipher Dial', color: '#ffd070', text: `A ${p.syms[p.code[m.k]][1].toLowerCase()} (${p.syms[p.code[m.k]][0]}) is painted above three stacked bars. The ${m.name} bar is gilded.`, options: [{ label: 'Remember it', fn: () => G.dialog.close() }] }); return;
    }
    if (T.a === 'dialcol') {
      const o = { skill: 'Perception', dc: 12 + dd }, known = [0, 1, 2].filter(k => p.seen[k]).map(k => `${['lowest', 'middle', 'highest'][k]}: ${p.syms[p.code[k]][1]}`), opts = [];
      if (!p.read[me]) opts.push({ label: `Look for wear on the rings ${G.game.chkLabel(o)}`, fn: () => { p.read[me] = 1; G.dialog.close(false); G.dice.check(o, r => { if (r.success) { const k = [0, 1, 2].find(q => !p.seen[q]) ?? 0; p.seen[k] = 1; G.dialog.open({ name: 'Cipher Column', role: 'Worn grooves', color: '#ffd070', text: `The ${['lowest', 'middle', 'highest'][k]} ring is worn smooth beside the ${p.syms[p.code[k]][1]}. That must be its setting.`, options: [{ label: 'Step back', fn: () => G.dialog.close() }] }); } else G.ui.lockSoon(); }); } });
      opts.push({ label: 'Step back', fn: () => G.dialog.close() });
      G.dialog.open({ name: 'Cipher Column', role: 'Cipher Dial', color: '#ffd070', text: `Three rings of carved symbols. A gold mark shows which face counts. Three murals somewhere in this room hold the answer.${known.length ? ' You remember: ' + known.join(', ') + '.' : ''}`, options: opts }); return;
    }
    this.act(p, T.a, T.v, true);
  },
  // play the flame sequence locally
  play(p, nums) { this.playing = { p, t: -0.4, i: -1, nums }; G.sfx('magic', 0.6, p); },
  act(p, a, v, mine) {
    if (!p || p.solved) return; const P = G.player;
    if (mine) G.net.sendFx({ k: 'pz', i: p.id, a, v });
    if (a === 'mirror' || a === 'plate' || a === 'dial') return this.actMore(p, a, v, mine);
    if (a === 'lever') {
      const l = p.levers[v]; if (!l || l.want) return; l.want = 1; G.sfx('thunk', 1, l); G.sfx('metalclank', 0.5, l);
      if (p.order[p.prog] === v) { p.prog++; G.sfx('click', 1, l); if (p.prog >= 4) this.solve(p, mine); }
      else { setTimeout(() => { p.levers.forEach(q => q.want = 0); G.sfx('chainrattle', 1, l); }, 500); p.prog = 0;
        G.fx.spark(new G.V3(l.x, 1.4, l.z), 0xffffff, 14, 4); if (mine) { G.dm.say('Click. Something in the walls answers your mistake.'); for (let k = 0; k < 5; k++) G.proj.spawn({ kind: 'arrow', pos: new G.V3(l.x + (Math.random() - 0.5) * 3, 1.3, l.z + (Math.random() - 0.5) * 3), dir: new G.V3(P.pos.x - l.x, 0, P.pos.z - l.z).normalize(), speed: 30, owner: 'remote', dmg: 0, life: 0.25 }); P.takeDamage(G.rollN(2, 4), { x: l.x + 0.01, z: l.z }, { unblockable: true, save: true, dc: 12, trap: true }); } }
    }
    if (a === 'turn') {
      p.press(v); [v, (v + 1) % 4].forEach(i => { const s = p.statues[i]; s.target = (s.target ?? s.ang) + Math.PI / 2; });
      G.sfx('rumble', 0.6, p.statues[v]); G.fx.smoke(new G.V3(p.statues[v].x, 0.5, p.statues[v].z), 4, 0x8a8070, 1.2);
      if (p.f.every(f => f === 0)) setTimeout(() => this.solve(p, mine), 900);
    }
    if (a === 'light') {
      const b = p.braziers[v]; if (!b || b.lit) return;
      if (p.seq[p.prog] === v) { b.lit = true; b.fl.visible = true; b.L.intensity = 2.4; p.prog++; G.sfx('note' + v, 0.9, b); G.sfx('fire', 0.5, b); if (p.prog >= 5) this.solve(p, mine); }
      else { p.prog = 0; p.braziers.forEach(q => { q.lit = false; q.fl.visible = false; q.L.intensity = 0; }); G.fx.fire(new G.V3(b.x, 1.2, b.z), 40, 0.8, 1.4, 5); G.sfx('firecast', 1, b); G.sfx('groan', 0.4, b);
        if (mine) { G.dm.say('The flame roars out of the brazier and lashes at you.'); P.takeDamage(G.rollN(2, 6), { x: b.x + 0.01, z: b.z }, { unblockable: true, save: true, dc: 12, trap: true, type: 'fire' }); } }
    }
  },
  actMore(p, a, v, mine) {
    if (a === 'mirror') { const m = p.mirrors[v]; if (!m) return; m.t = 1 - m.t; m.ang += Math.PI / 2; G.sfx('rumble', 0.5, m); G.sfx('metalclank', 0.4, m); if (this.traceBeam(p)) setTimeout(() => this.solve(p, mine), 700); }
    if (a === 'plate') { const q = p.plates[v]; if (!q) return; p.flip(v); p.plates.forEach((pl, i) => pl.k = p.on[i]); G.sfx('thunk', 0.8, q); G.sfx('magic', 0.4, q); q.top.position.y = 0.08; if (p.on.every(x => x)) setTimeout(() => this.solve(p, mine), 500); }
    if (a === 'dial') { p.cur[v] = (p.cur[v] + 1) % 6; G.sfx('rumble', 0.4, p); G.sfx('click', 0.8, p); if (p.cur.every((c, k) => c === p.code[k])) setTimeout(() => this.solve(p, mine), 800); }
  },
  solve(p, mine) {
    if (p.solved) return; p.solved = true;
    const c = p.chestRef; if (c) c.locked = false; p.cageT = 0.001;
    G.sfx('level', 1, p); G.sfx('portal', 0.7, p); G.fx.burst(new G.V3(p.x, 1.5, p.z), 0xffd080, 60, 5); G.Lights.flash(new G.V3(p.x, 2, p.z), 0xffd080, 5, 14, 1);
    G.ui.banner('Puzzle Solved', 'The vault bars sink into the stone'); G.dm.say(G.pick(['Somewhere deep in the walls, a great mechanism grinds into motion.', 'The vault yields to clever hands, not strong ones.']));
    if (G.player && G.player.dnd && Math.hypot(G.player.pos.x - p.x, G.player.pos.z - p.z) < 30) G.sheet.gainXp(G.player, 60, 'puzzle');
  },
  update(dt, t) {
    this.list.forEach(p => {
      if (p.levers) p.levers.forEach(l => { l.down = G.lerp(l.down, l.want, Math.min(1, dt * 10)); l.piv.rotation.x = -0.5 + l.down * 1.0; });
      if (p.statues) p.statues.forEach((s, i) => { if (s.target !== undefined) { s.ang = G.lerp(s.ang, s.target, Math.min(1, dt * 3)); s.bust.rotation.y = s.ang; } const ok = p.f[i] === 0; s.eyeM.color.setHex(ok ? 0x40ff70 : 0xff3020); s.beam.material.color.setHex(ok ? 0x40ff70 : 0xff3020); });
      if (p.mirrors) p.mirrors.forEach(m => { m.head.rotation.y = G.lerp(m.head.rotation.y, m.ang, Math.min(1, dt * 8)); });
      if (p.plates) p.plates.forEach(q => { const k = q.k ? 1 : 0; q.m.emissiveIntensity = G.lerp(q.m.emissiveIntensity, k * 1.4, Math.min(1, dt * 8)); q.gl.material.opacity = G.lerp(q.gl.material.opacity, k * 0.7, Math.min(1, dt * 8)); q.top.position.y = G.lerp(q.top.position.y, 0.14, Math.min(1, dt * 6)); });
      if (p.rings) p.rings.forEach((R2, k) => { const want = -p.cur[k] / 6 * Math.PI * 2; let d = want - R2.ang; d = Math.atan2(Math.sin(d), Math.cos(d)); R2.ang += d * Math.min(1, dt * 6); R2.ring.rotation.y = R2.ang; });
      if (p.cageT > 0 && p.cage) { p.cageT = Math.min(1, p.cageT + dt / 2); p.cage.position.y = -G.smooth(p.cageT) * 1.75; if (p.cageT < 1 && Math.random() < 0.4) G.fx.smoke(new G.V3(p.cage.position.x, 0.2, p.cage.position.z), 1, 0x7a7060, 1.4); }
    });
    // flame sequence playback
    const pl = this.playing; if (pl) {
      pl.t += dt; const step = Math.floor(pl.t / 0.85);
      if (step !== pl.i && step >= 0 && step < 5) { pl.i = step; const b = pl.p.braziers[pl.p.seq[step]]; b.flare = 0.7; G.sfx('note' + pl.p.seq[step], 0.9, b); G.fx.fire(new G.V3(b.x, 1.1, b.z), 18, 0.4, 0.8, 3); }
      pl.p.braziers.forEach(b => { b.flare = Math.max(0, b.flare - dt); if (!b.lit) { b.fl.visible = b.flare > 0; b.L.intensity = b.flare > 0 ? 3 : 0; } b.num.material.opacity = pl.nums ? 1 : 0; });
      if (pl.t > 5 * 0.85 + 0.5) { if (!pl.nums) pl.p.braziers.forEach(b => b.num.material.opacity = 0); this.playing = null; }
    }
  }
};
