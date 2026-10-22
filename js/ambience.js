/* ============================================================
   Living dungeon: eyes in the dark, bats, rats, drips, ground
   mist, ghost wisps, smoke vents and distant sounds. Everything
   here is cosmetic and local to each player.
   ============================================================ */
'use strict';
G.Amb = {
  init(theme) {
    this.clear(); this.theme = theme; if (!G.World.grid || theme === 'hideout' || theme === 'menu') return;
    const W = G.World, CS = W.CS, r = Math.random;
    this.group = new THREE.Group(); G.scene.add(this.group);
    const floors = []; for (let z = 0; z < W.H; z++) for (let x = 0; x < W.W; x++) if (W.grid[z * W.W + x] && !(W.hiddenSet && W.hiddenSet.has(z * W.W + x))) floors.push([x, z]);
    this.floors = floors;
    // eyes: pairs of glints watching from dark corners and corridor walls
    const eyeTex = G.tex.sprite('glow'), faces = (W.faces || []).filter(f => W.roomId[f[1] * W.W + f[0]] < 0 || r() < 0.3);
    this.eyes = [];
    for (let k = 0; k < Math.min(14, faces.length); k++) {
      const f = faces[Math.floor(r() * faces.length)], col = theme === 'forge' ? 0xff4010 : theme === 'warrens' ? 0xd0ff40 : theme === 'abyss' ? 0xc070ff : 0xff2020;
      const g = new THREE.Group(), y = 0.4 + r() * 1.6, along = (r() - 0.5) * 2.6;
      g.position.set((f[0] + 0.5 + f[2] * 0.42) * CS + (f[3] ? along : 0), y, (f[1] + 0.5 + f[3] * 0.42) * CS + (f[2] ? along : 0)); g.position.y += W.fy(g.position.x, g.position.z);
      const mk = (dx) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: eyeTex, color: col, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 })); s.scale.set(0.09, 0.06, 1); s.position.set(dx, 0, 0); g.add(s); return s; };
      const sep = 0.07 + r() * 0.05; g.userData.L = mk(-sep); g.userData.R = mk(sep); g.rotation.y = Math.atan2(-f[2], -f[3]);
      this.group.add(g); this.eyes.push({ g, a: 0, blink: r() * 4, gone: 0 });
    }
    // ground mist: big soft sprites hugging the floor near the player
    this.mist = [];
    if (theme !== 'forge') for (let k = 0; k < 22; k++) { const s = new THREE.Mesh(G.fx._dg || (G.fx._dg = new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ map: G.tex.sprite('smoke'), color: theme === 'warrens' ? 0x6a9a8a : theme === 'abyss' ? 0x6a4a9a : 0x8a9aaa, transparent: true, opacity: 0, depthWrite: false })); s.rotation.x = -Math.PI / 2; s.position.y = 0.25 + k * 0.02; s.renderOrder = 4 + k * 0.01; const sc = 4 + r() * 4; s.scale.set(sc, sc, 1); this.group.add(s); this.mist.push({ s, t: r() * 10, life: 0, sp: (r() - 0.5) * 0.15 }); }
    // wisps (crypt) and fireflies (warrens)
    this.wisps = [];
    const nW = theme === 'crypt' ? 5 : theme === 'warrens' ? 14 : theme === 'abyss' ? 10 : 0;
    for (let k = 0; k < nW; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.tex.sprite('glow'), color: theme === 'crypt' ? 0x9ad8ff : theme === 'abyss' ? 0xb080ff : 0xb0ff60, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 })); const sc = theme === 'crypt' ? 0.55 : 0.12; s.scale.setScalar(sc); this.group.add(s); this.wisps.push({ s, p: null, v: new G.V3(), t: 0, sc }); }
    // forge vents: floor spots that puff smoke and embers
    this.vents = theme === 'forge' ? Array.from({ length: 12 }, () => { const c = floors[Math.floor(r() * floors.length)]; return { x: (c[0] + 0.2 + r() * 0.6) * CS, z: (c[1] + 0.2 + r() * 0.6) * CS, t: r() * 4 }; }) : [];
    // ceiling drips
    this.drips = theme !== 'forge' ? Array.from({ length: 16 }, () => { const c = floors[Math.floor(r() * floors.length)]; return { x: (c[0] + 0.2 + r() * 0.6) * CS, z: (c[1] + 0.2 + r() * 0.6) * CS, t: r() * 3, every: 1.5 + r() * 3 }; }) : [];
    this.critters = []; this.batT = 12 + r() * 15; this.ratT = 6 + r() * 10; this.sndT = 4 + r() * 6;
  },
  clear() { if (this.group) G.scene.remove(this.group); this.group = null; this.eyes = []; this.mist = []; this.wisps = []; this.vents = []; this.drips = []; (this.critters || []).forEach(c => G.scene.remove(c.g)); this.critters = []; },
  near(maxD) { const P = G.player, W = G.World, CS = W.CS; for (let k = 0; k < 20; k++) { const c = G.pick(this.floors); const x = (c[0] + 0.5) * CS, z = (c[1] + 0.5) * CS; if (Math.hypot(x - P.pos.x, z - P.pos.z) < maxD) return new G.V3(x, 0, z); } return null; },
  update(dt, t) {
    if (!this.group || !G.player || G.loading) return;
    const P = G.player, cp = G.camera.position, W = G.World, r = Math.random;
    // eyes fade in when you are far, vanish when you come close or shine a light on them
    this.eyes.forEach(e => {
      const d = Math.hypot(e.g.position.x - cp.x, e.g.position.z - cp.z), want = d > 7 && d < 24 && !e.gone ? 1 : 0;
      if (d < 6 && e.a > 0.3 && !e.gone) { e.gone = 25 + r() * 30; G.sfx('skitter', 0.4, e.g.position); }
      if (e.gone) { e.gone -= dt; if (e.gone <= 0) e.gone = 0; }
      e.a = G.lerp(e.a, want, dt * (want ? 0.8 : 6)); e.blink -= dt; const open = e.blink > 0.12 ? 1 : 0.05; if (e.blink <= 0) e.blink = 2 + r() * 5;
      e.g.userData.L.material.opacity = e.g.userData.R.material.opacity = e.a * open * 0.95;
    });
    // mist drifts around the player
    this.mist.forEach(m => { m.t += dt; m.life -= dt; if (m.life <= 0 || Math.hypot(m.s.position.x - cp.x, m.s.position.z - cp.z) > 22) { const p = this.near(18); if (p) { if (m.y0 === undefined) m.y0 = m.s.position.y; m.s.position.set(p.x + (r() - 0.5) * 4, 0, p.z + (r() - 0.5) * 4); m.s.position.y = m.y0 + W.fy(m.s.position.x, m.s.position.z); } m.life = 10 + r() * 10; m.t = 0; } const k = Math.min(1, m.t / 3, m.life / 3); m.s.material.opacity = k * 0.14; m.s.rotation.z += dt * m.sp; m.s.position.x += dt * 0.15; });
    // wisps wander through the halls; fireflies hover and blink
    this.wisps.forEach(w => { w.t -= dt; if (!w.p || w.t <= 0) { w.p = this.near(20); w.t = 6 + r() * 8; if (w.p) { w.s.position.set(w.p.x, (this.theme === 'crypt' ? 1 + r() * 1.5 : 0.5 + r() * 2) + W.fy(w.p.x, w.p.z), w.p.z); w.v.set((r() - 0.5) * 0.8, (r() - 0.5) * 0.1, (r() - 0.5) * 0.8); } }
      if (!w.p) return; const age = Math.min(1, (6 - Math.max(0, w.t - 2)) / 2, w.t / 1.5); w.s.position.addScaledVector(w.v, dt); w.s.position.y += Math.sin(t * 1.3 + w.sc * 9) * dt * 0.2;
      if (W.isWall(w.s.position.x, w.s.position.z)) w.v.multiplyScalar(-1);
      w.s.material.opacity = Math.max(0, age) * (this.theme === 'crypt' ? 0.5 + Math.sin(t * 3) * 0.15 : (Math.sin(t * 4 + w.sc * 50) > 0.2 ? 0.9 : 0.15));
      if (this.theme === 'crypt' && Math.random() < 0.3) G.fx.emit(G.fx.add, w.s.position.x, w.s.position.y, w.s.position.z, 0, 0.2, 0, 0.8, 0.12, 0, [0.4, 0.7, 1.0, 0.6], [0.1, 0.2, 0.4, 0]); });
    // vents & drips near the player only
    this.vents.forEach(v => { if (Math.hypot(v.x - cp.x, v.z - cp.z) > 25) return; v.t -= dt; if (v.t <= 0) { v.t = 0.25 + r() * 0.4; G.fx.smoke(new G.V3(v.x, 0.2, v.z), 1, 0x3a2a24, 1.2, 0.4); if (r() < 0.4) G.fx.embers(new G.V3(v.x, 0.2, v.z), 2, 0.3); } });
    this.drips.forEach(d => { if (Math.hypot(d.x - cp.x, d.z - cp.z) > 18) return; d.t -= dt; if (d.t <= 0) { d.t = d.every; const h = (W.hAt ? W.hAt(d.x, d.z) : 5) - 0.1; G.fx.emit(G.fx.norm, d.x, h, d.z, 0, -1, 0, h / 8 + 0.05, 0.035, 0.03, [0.55, 0.65, 0.7, 0.9], [0.5, 0.6, 0.7, 0.7], 30, 0); setTimeout(() => { if (!this.group) return; G.fx.emit(G.fx.norm, d.x, 0.05, d.z, 0, 0.6, 0, 0.25, 0.05, 0.08, [0.6, 0.7, 0.8, 0.6], [0.6, 0.7, 0.8, 0], 6, 1); if (Math.hypot(d.x - cp.x, d.z - cp.z) < 12) G.sfx('drip', 0.6, new G.V3(d.x, 0, d.z)); }, Math.sqrt(2 * h / 30) * 1000); } });
    // bats burst across a room now and then
    if (this.theme !== 'forge') { this.batT -= dt; if (this.batT <= 0) { this.batT = 25 + r() * 35; this.spawnBats(); } }
    this.ratT -= dt; if (this.ratT <= 0) { this.ratT = 10 + r() * 18; this.spawnRat(); }
    for (let i = this.critters.length - 1; i >= 0; i--) { const c = this.critters[i]; c.t += dt; c.fn(c, dt, t); if (c.t > c.life) { G.scene.remove(c.g); this.critters.splice(i, 1); } }
    // distant sounds of the deep
    this.sndT -= dt; if (this.sndT <= 0) { this.sndT = 7 + r() * 10; const list = { crypt: ['moan', 'whisper', 'chainrattle', 'rattle', 'drip'], warrens: ['cackle', 'skitter', 'drip', 'squeak', 'screech'], forge: ['rumble', 'metalclank', 'chainrattle', 'rumble', 'sizzle'], abyss: ['whisper', 'moan', 'rumble', 'whisper', 'drip'] }[this.theme]; if (list) { const a = r() * 6.28, d = 10 + r() * 14; G.sfx(G.pick(list), 0.55, new G.V3(cp.x + Math.sin(a) * d, 0, cp.z + Math.cos(a) * d)); } }
  },
  spawnBats() {
    const W = G.World, P = G.player, p = this.near(14); if (!p) return; const h = (W.hAt ? W.hAt(p.x, p.z) : 5) - 0.8, n = 6 + Math.floor(Math.random() * 6);
    const body = G.mat('col', { c: 0x1a1214, r: 0.9 }), wing = G.mat('col', { c: 0x241a1c, r: 0.9, ds: true });
    const a0 = Math.random() * 6.28, dir = new G.V3(Math.sin(a0), 0, Math.cos(a0));
    for (let k = 0; k < n; k++) {
      const g = new THREE.Group(); M.P(g, M.sph(0.06, 8, 6), body, [0, 0, 0], 0, [1, 0.8, 1.4]); const wl = M.G(g), wr = M.G(g);
      M.P(wl, M.box(0.22, 0.01, 0.12), wing, [0.12, 0, 0]); M.P(wr, M.box(0.22, 0.01, 0.12), wing, [-0.12, 0, 0]);
      g.position.set(p.x - dir.x * 6 + (Math.random() - 0.5) * 2, h - Math.random() * 0.8, p.z - dir.z * 6 + (Math.random() - 0.5) * 2); G.scene.add(g);
      const v = dir.clone().multiplyScalar(6 + Math.random() * 3).add(new G.V3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2)), ph = Math.random() * 6;
      this.critters.push({ g, t: -k * 0.08, life: 3, fn: (c, dt, t) => { if (c.t < 0) return; c.g.position.addScaledVector(v, dt); c.g.position.y += Math.sin(t * 9 + ph) * dt * 1.5; c.g.rotation.y = Math.atan2(v.x, v.z); const f = Math.sin(t * 38 + ph) * 0.9; wl.rotation.z = f; wr.rotation.z = -f; } });
    }
    G.sfx('bats', 0.8, p);
  },
  spawnRat() {
    const W = G.World, cp = G.camera.position, faces = (W.faces || []).filter(f => { const x = (f[0] + 0.5) * W.CS, z = (f[1] + 0.5) * W.CS, d = Math.hypot(x - cp.x, z - cp.z); return d > 5 && d < 14; });
    const f = G.pick(faces); if (!f) return;
    const fur = G.mat('col', { c: 0x3a3028, r: 0.95 }), g = new THREE.Group();
    M.P(g, M.sph(0.08, 10, 8), fur, [0, 0.07, 0], 0, [0.8, 0.7, 1.6]); M.P(g, M.cone(0.04, 0.1, 8), fur, [0, 0.07, 0.15], [Math.PI / 2, 0, 0]); M.P(g, M.cyl(0.008, 0.003, 0.25, 4), G.mat('col', { c: 0x8a6a6a }), [0, 0.05, -0.22], [Math.PI / 2 - 0.2, 0, 0]);
    M.mirror(s => M.P(g, M.sph(0.008, 4, 4), G.mat('emissive', { c: 0xff2020, i: 2 }), [s * 0.025, 0.1, 0.17]));
    const along = f[2] ? new G.V3(0, 0, 1) : new G.V3(1, 0, 0); if (Math.random() < 0.5) along.negate();
    const x = (f[0] + 0.5 + f[2] * 0.42) * W.CS, z = (f[1] + 0.5 + f[3] * 0.42) * W.CS; g.position.set(x - along.x * 2, 0, z - along.z * 2); g.rotation.y = Math.atan2(along.x, along.z); G.scene.add(g);
    this.critters.push({ g, t: 0, life: 1.4, fn: (c, dt, t) => { c.g.position.addScaledVector(along, dt * 3); c.g.position.y = W.fy(c.g.position.x, c.g.position.z) + Math.abs(Math.sin(t * 30)) * 0.02; } });
    G.sfx('squeak', 0.6, g.position);
  }
};
