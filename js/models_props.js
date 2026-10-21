/* ============================================================
   Props, set dressing, NPCs, loot item models
   ============================================================ */
'use strict';
M.flame = (parent, scale = 1, color = 0xff8a30) => {
  const f = M.G(parent);
  const core = M.P(f, M.cone(0.05 * scale, 0.22 * scale, 12), G.mat('emissive', { c: 0xffd890, i: 4 }), [0, 0.1 * scale, 0]);
  // small candle flames skip the outer shell: two draws instead of three, and there are hundreds of them
  const outer = scale < 0.35 ? core : M.P(f, M.cone(0.08 * scale, 0.32 * scale, 12), G.mat('col', { c: color, tr: 0.55, e: color, ei: 3 }), [0, 0.13 * scale, 0]);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.tex.sprite('glow'), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
  spr.scale.setScalar(0.9 * scale); spr.position.y = 0.12 * scale; f.add(spr);
  f.userData.flicker = { core, outer, spr, s: scale, seed: Math.random() * 10 };
  G.flames && G.flames.push(f);
  return f;
};
M.flickerFlames = (t) => {
  if (!G.flames) return;
  for (const f of G.flames) {
    const u = f.userData.flicker, k = 1 + Math.sin(t * 13 + u.seed) * 0.08 + Math.sin(t * 23 + u.seed * 2) * 0.06;
    u.outer.scale.set(1, k * (1 + Math.sin(t * 7 + u.seed) * 0.1), 1); u.core.scale.set(1, k, 1);
    u.outer.rotation.y = t * 2; u.spr.scale.setScalar(0.9 * u.s * k);
  }
};

M.prop = {
  torch(theme) {
    const g = new THREE.Group();
    M.P(g, M.box(0.12, 0.25, 0.04), G.mat('dark'), [0, 0, -0.02]);
    M.P(g, M.tube([0, -0.05, 0, 0, -0.04, 0.1, 0, 0.0, 0.18], 0.015, 12, 6), G.mat('dark'));
    M.P(g, M.tor(0.045, 0.012, 6, 16), G.mat('dark'), [0, 0.0, 0.18], [Math.PI / 2, 0, 0]);
    M.P(g, M.cyl(0.03, 0.022, 0.42, 10), G.mat('wood'), [0, 0.05, 0.18], [0.25, 0, 0]);
    M.P(g, M.cyl(0.045, 0.04, 0.1, 12), G.mat('col', { c: 0x2a1a10, t: 'cloth' }), [0, 0.25, 0.23], [0.25, 0, 0]);
    const col = theme === 'warrens' ? 0x50e0ff : theme === 'forge' ? 0xff5020 : 0xff8a30;
    M.flame(g, 1, col).position.set(0, 0.3, 0.245);
    g.userData.light = { pos: new THREE.Vector3(0, 0.45, 0.4), color: col, intensity: 2.2, dist: 11 };
    return g;
  },
  candles(n = 5, r = Math.random) {
    const g = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const h = 0.08 + r() * 0.22, x = (r() - 0.5) * 0.4, z = (r() - 0.5) * 0.4;
      M.P(g, M.cyl(0.025, 0.028, h, 12), G.mat('col', { c: 0xeee6c8, r: 0.6 }), [x, h / 2, z]);
      M.P(g, M.sph(0.03, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), G.mat('col', { c: 0xeee6c8, r: 0.6 }), [x, 0.005, z], 0, [1.5, 0.5, 1.5]);
      if (i < 3) M.flame(g, 0.25).position.set(x, h, z);
    }
    g.userData.light = { pos: new THREE.Vector3(0, 0.4, 0), color: 0xffb060, intensity: 1.0, dist: 5 };
    return g;
  },
  chandelier() {
    const g = new THREE.Group();
    M.P(g, M.tor(0.6, 0.03, 8, 40), G.mat('dark'), [0, 0, 0], [Math.PI / 2, 0, 0]);
    M.P(g, M.tor(0.3, 0.02, 8, 30), G.mat('dark'), [0, 0.15, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; M.P(g, M.cyl(0.008, 0.008, 2.5, 4), G.mat('dark'), [Math.cos(a) * 0.3, 1.3, Math.sin(a) * 0.3], [Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2]); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; M.P(g, M.cyl(0.04, 0.03, 0.04, 10), G.mat('dark'), [Math.cos(a) * 0.6, 0.03, Math.sin(a) * 0.6]); M.P(g, M.cyl(0.025, 0.025, 0.15, 10), G.mat('col', { c: 0xeee6c8 }), [Math.cos(a) * 0.6, 0.12, Math.sin(a) * 0.6]); M.flame(g, 0.25).position.set(Math.cos(a) * 0.6, 0.2, Math.sin(a) * 0.6); }
    g.userData.light = { pos: new THREE.Vector3(0, 0.1, 0), color: 0xffb060, intensity: 2.5, dist: 12 };
    return g;
  },
  sarcophagus() {
    const g = new THREE.Group(), st = G.mat('col', { c: 0x9a948a, r: 0.9, t: 'rock' });
    M.P(g, M.box(0.9, 0.6, 2.1, 2, 2, 4), st, [0, 0.3, 0]);
    M.P(g, M.box(1.0, 0.1, 2.2), st, [0, 0.05, 0]);
    M.P(g, M.box(0.98, 0.12, 2.18), st, [0, 0.66, 0]);
    // carved effigy on lid
    const ef = M.skeleton({ bone: st }); M.hideBase(ef); ef.root.traverse(o => { if (o.isMesh && o.material === st) o.visible = true; });
    ef.root.rotation.x = -Math.PI / 2; ef.root.position.set(0, 0.72, 0.95); ef.root.scale.setScalar(0.95); g.add(ef.root);
    for (let i = 0; i < 6; i++) M.P(g, M.box(0.04, 0.4, 0.04), st, [i < 3 ? 0.46 : -0.46, 0.3, -0.8 + (i % 3) * 0.8]);
    return g;
  },
  coffin(open = false) {
    const g = new THREE.Group(), w = G.mat('col', { c: 0x4a2a18, r: 0.8, t: 'wood' });
    const shape = s => { s.moveTo(-0.25, -0.95); s.lineTo(0.25, -0.95); s.lineTo(0.35, 0.45); s.lineTo(0.22, 0.95); s.lineTo(-0.22, 0.95); s.lineTo(-0.35, 0.45); s.lineTo(-0.25, -0.95); };
    M.P(g, M.ext('coffin', shape, 0.35, 0.02), w, [0, 0.2, 0], [Math.PI / 2, 0, 0]);
    const lid = M.P(g, M.ext('coffinlid', shape, 0.06, 0.015), w, open ? [0.55, 0.15, 0.1] : [0, 0.4, 0], [Math.PI / 2, open ? 0.4 : 0, open ? 0.3 : 0]);
    M.P(lid, M.box(0.06, 0.6, 0.02), G.mat('iron'), [0, -0.15, 0.04]); M.P(lid, M.box(0.3, 0.06, 0.02), G.mat('iron'), [0, 0.0, 0.04]);
    if (open) { const sk = M.skeleton(); M.hideBase(sk); sk.root.traverse(o => { if (o.isMesh && o.material === sk.boneMat) o.visible = true; }); sk.root.rotation.x = -Math.PI / 2; sk.root.position.set(0, 0.3, 0.85); sk.root.scale.setScalar(0.85); g.add(sk.root); }
    return g;
  },
  bones(r = Math.random) {
    const g = new THREE.Group(), b = G.mat('bone');
    for (let i = 0; i < 9; i++) { const l = 0.2 + r() * 0.25; const m = M.P(g, M.cyl(0.018, 0.015, l, 8), b, [(r() - 0.5) * 0.6, 0.03, (r() - 0.5) * 0.6], [Math.PI / 2, r() * 3, 0]); M.P(m, M.sph(0.03, 8, 6), b, [0, l / 2, 0]); M.P(m, M.sph(0.03, 8, 6), b, [0, -l / 2, 0]); }
    for (let i = 0; i < 2 + r() * 2; i++) M.prop.skull(g, [(r() - 0.5) * 0.5, 0.08, (r() - 0.5) * 0.5], r() * 6);
    return g;
  },
  skull(parent, p, ry = 0) {
    const s = M.G(parent, p, [0, ry, 0]), b = G.mat('bone'), d = G.mat('col', { c: 0x050404 });
    M.P(s, M.sph(0.09, 20, 16), b, [0, 0, 0], 0, [0.9, 0.95, 1.1]);
    M.mirror(k => M.P(s, M.sph(0.026, 10, 8), d, [k * 0.032, 0.0, 0.08]));
    M.P(s, M.sph(0.06, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), b, [0, -0.04, 0.03], 0, [1, 0.6, 1.1]);
    return s;
  },
  urn(r = Math.random) {
    const g = new THREE.Group();
    M.P(g, M.lathe([0, 0, 0.12, 0, 0.14, 0.03, 0.2, 0.2, 0.18, 0.38, 0.1, 0.48, 0.09, 0.55, 0.12, 0.58, 0.0, 0.58], 28), G.mat('col', { c: [0x6a4a3a, 0x3a4a5a, 0x5a5a4a][Math.floor(r() * 3)], r: 0.5, m: 0.2, t: 'rock' }));
    M.P(g, M.tor(0.2, 0.012, 6, 28), G.mat('gold'), [0, 0.2, 0], [Math.PI / 2, 0, 0]);
    return g;
  },
  pot(r = Math.random) {
    const g = new THREE.Group(), clay = G.mat('col', { c: [0x9a5a38, 0x7a4a30, 0xa8784a][Math.floor(r() * 3)], r: 0.8, t: 'rock' });
    const h = 0.45 + r() * 0.35;
    M.P(g, M.lathe([0, 0, 0.1, 0, 0.16, h * 0.15, 0.2, h * 0.45, 0.17, h * 0.75, 0.08, h * 0.9, 0.07, h, 0.1, h * 1.04, 0.08, h * 1.06, 0, h * 1.02], 24), clay);
    M.P(g, M.tor(0.195, 0.01, 6, 24), G.mat('col', { c: 0x2a1a10, r: 0.9 }), [0, h * 0.4, 0], [Math.PI / 2, 0, 0]);
    M.P(g, M.tor(0.15, 0.008, 6, 24), G.mat('col', { c: 0xd8c8a0, r: 0.9 }), [0, h * 0.65, 0], [Math.PI / 2, 0, 0]);
    return g;
  },
  banner(color = 0x7a1010) {
    const g = new THREE.Group();
    M.P(g, M.cyl(0.02, 0.02, 1.0, 8), G.mat('dark'), [0, 0, 0.05], [0, 0, Math.PI / 2]);
    const cloth = M.box(0.8, 1.8, 0.015, 8, 16, 1).clone(), p = cloth.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, p.getZ(i) + Math.sin(y * 3 + p.getX(i) * 2) * 0.03); if (y < -0.85) p.setY(i, y - Math.abs(p.getX(i)) * 0.3 + 0.15); }
    cloth.computeVertexNormals();
    M.P(g, cloth, G.mat('col', { c: color, t: 'cloth', ds: true }), [0, -0.92, 0.06]);
    M.P(g, M.box(0.7, 0.04, 0.02), G.mat('gold'), [0, -0.12, 0.07]);
    M.P(g, M.ico(0.12, 0), G.mat('gold'), [0, -0.6, 0.08], 0, [1, 1, 0.3]);
    return g;
  },
  pillar(theme, h = 4) {
    const g = new THREE.Group();
    const mat = theme === 'forge' ? G.mat('col', { c: 0x2a2220, r: 0.8, t: 'rock' }) : theme === 'warrens' ? G.mat('col', { c: 0x6a5a48, r: 0.95, t: 'rock' }) : theme === 'hideout' ? G.mat('col', { c: 0xb0a090, r: 0.8, t: 'rock' }) : G.mat('col', { c: 0x8a8a84, r: 0.85, t: 'rock' });
    if (theme === 'warrens') {
      M.P(g, M.cyl(0.14, 0.16, h, 12), G.mat('wood'), [0, h / 2, 0]);
      M.P(g, M.box(1.6, 0.2, 0.22), G.mat('wood'), [0, h - 0.1, 0]);
      M.mirror(s => M.P(g, M.box(0.12, 0.8, 0.12), G.mat('wood'), [s * 0.4, h - 0.45, 0], [0, 0, s * 0.8]));
      return g;
    }
    M.P(g, M.box(0.75, 0.25, 0.75), mat, [0, 0.12, 0]);
    M.P(g, M.cyl(0.32, 0.36, 0.15, 24), mat, [0, 0.32, 0]);
    const shaft = M.cyl(0.28, 0.3, h - 0.9, 24, 6).clone(), p = shaft.attributes.position;
    for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), f = 1 - Math.max(0, Math.cos(a * 12)) * 0.06; p.setX(i, p.getX(i) * f); p.setZ(i, p.getZ(i) * f); }
    shaft.computeVertexNormals(); M.P(g, shaft, mat, [0, h / 2, 0]);
    M.P(g, M.cyl(0.4, 0.3, 0.2, 24), mat, [0, h - 0.35, 0]);
    M.P(g, M.box(0.85, 0.22, 0.85), mat, [0, h - 0.13, 0]);
    if (theme === 'forge') for (let i = 0; i < 4; i++) M.P(g, M.box(0.02, h - 1.0, 0.02), G.mat('emissive', { c: 0xff4010, i: 2 }), [Math.cos(i * 1.57 + 0.4) * 0.29, h / 2, Math.sin(i * 1.57 + 0.4) * 0.29]);
    return g;
  },
  cobweb() {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: G.tex.sprite('web'), transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.6 }));
    return m;
  },
  statue(theme) {
    const g = new THREE.Group(), st = theme === 'forge' ? G.mat('col', { c: 0x2a2424, r: 0.8, t: 'rock' }) : G.mat('col', { c: 0x9a9890, r: 0.9, t: 'rock' });
    M.P(g, M.box(1, 0.5, 1), st, [0, 0.25, 0]); M.P(g, M.box(1.1, 0.1, 1.1), st, [0, 0.55, 0]);
    const R = theme === 'forge' ? M.enemy.demonlord() : M.hero('knight', 0);
    R.root.traverse(o => { if (o.isMesh) { o.material = st; } });
    R.root.scale.setScalar(theme === 'forge' ? 0.85 : 1.15); R.root.position.y = 0.6;
    M.animHum(R, { t: 0, move: 0, atk: -1 }); R.armR.sh.rotation.x = -0.3; R.armL.sh.rotation.x = -0.6;
    if (theme === 'forge') R.blade.visible = false;
    g.add(R.root);
    return g;
  },
  altar(theme) {
    const g = new THREE.Group(), st = G.mat('col', { c: theme === 'forge' ? 0x1a1414 : 0x7a7670, r: 0.85, t: 'rock' });
    M.P(g, M.box(1.6, 0.9, 0.8), st, [0, 0.45, 0]); M.P(g, M.box(1.75, 0.12, 0.9), st, [0, 0.96, 0]);
    M.P(g, M.box(1.65, 0.02, 0.6), G.mat('col', { c: theme === 'forge' ? 0x5a0a0a : 0x6a1a1a, t: 'cloth' }), [0, 1.03, 0]);
    const c = M.prop.candles(5); c.position.set(0.5, 1.03, 0); g.add(c);
    M.prop.skull(g, [-0.4, 1.12, 0], 0.3);
    M.P(g, M.lathe([0, 0, 0.06, 0, 0.03, 0.05, 0.02, 0.15, 0.08, 0.2, 0.09, 0.27, 0, 0.25], 20), G.mat('gold'), [0, 1.04, 0]);
    g.userData.light = c.userData.light; return g;
  },
  chest(tier = 0) {
    const g = new THREE.Group(), w = G.mat('col', { c: 0x6a3a1a, r: 0.75, t: 'wood', ds: true }), band = tier >= 2 ? G.mat('gold') : G.mat('iron');
    const inner = G.mat('col', { c: 0x2a160c, r: 0.95, t: 'wood', ds: true }), felt = G.mat('col', { c: 0x5a1020, r: 1, t: 'cloth' });
    const W = 0.9, D = 0.55, H = 0.45, T = 0.05;
    // hollow body: floor + four walls with a darker lining
    M.P(g, M.box(W, T, D), w, [0, T / 2, 0]);
    M.P(g, M.box(W, H, T), w, [0, H / 2, D / 2 - T / 2]); M.P(g, M.box(W, H, T), w, [0, H / 2, -D / 2 + T / 2]);
    M.P(g, M.box(T, H, D - 2 * T), w, [W / 2 - T / 2, H / 2, 0]); M.P(g, M.box(T, H, D - 2 * T), w, [-W / 2 + T / 2, H / 2, 0]);
    M.P(g, M.box(W - 2 * T - 0.01, 0.01, D - 2 * T - 0.01), felt, [0, T + 0.005, 0]);
    M.P(g, M.box(W - 2 * T - 0.004, H - T - 0.02, 0.006), inner, [0, H / 2 + T / 2, D / 2 - T - 0.003]); M.P(g, M.box(W - 2 * T - 0.004, H - T - 0.02, 0.006), inner, [0, H / 2 + T / 2, -D / 2 + T + 0.003]);
    // treasure heaped inside
    for (let i = 0; i < 26; i++) M.P(g, M.cyl(0.035, 0.035, 0.01, 12), G.mat('gold'), [(Math.random() - 0.5) * 0.65, T + 0.04 + Math.random() * 0.12 * (1 - Math.abs(i / 13 - 1)), (Math.random() - 0.5) * 0.32], [Math.random() * 0.8, Math.random() * 3, Math.random() * 0.8]);
    M.P(g, M.oct(0.04), G.mat('col', { c: tier >= 1 ? 0x30a0ff : 0xff2a40, e: tier >= 1 ? 0x1050a0 : 0x800010, ei: 1.2 }), [0.12, T + 0.17, 0.02]);
    if (tier >= 1) { const c = M.loot.chalice(1); c.position.set(-0.2, T + 0.08, 0); c.rotation.z = 0.3; g.add(c); }
    const lid = M.G(g, [0, H, -D / 2]);
    if (!G._chestLid) G._chestLid = new THREE.CylinderGeometry(0.275, 0.275, W, 24, 1, false, 0, Math.PI);
    M.P(lid, G._chestLid, w, [0, 0, 0.275], [0, 0, Math.PI / 2]);
    M.P(lid, G._chestLidIn || (G._chestLidIn = new THREE.CylinderGeometry(0.26, 0.26, W - 0.02, 24, 1, true, 0, Math.PI)), inner, [0, 0, 0.275], [0, 0, Math.PI / 2]);
    for (let i = 0; i < 3; i++) { M.P(g, M.box(0.06, H + 0.02, D + 0.02), band, [-0.35 + i * 0.35, H / 2, 0]); M.P(lid, M.tor(0.28, 0.025, 6, 20, Math.PI), band, [-0.35 + i * 0.35, 0, 0.275], [0, Math.PI / 2, 0]); }
    M.P(g, M.box(0.12, 0.14, 0.04), band, [0, 0.4, D / 2 + 0.02]);
    M.P(g, M.sph(0.025, 8, 6), G.mat('dark'), [0, 0.38, D / 2 + 0.045]);
    g.userData.lid = lid; return g;
  },
  barrel(r = Math.random) {
    const g = new THREE.Group();
    const geo = M.lathe([0, 0, 0.28, 0, 0.33, 0.25, 0.35, 0.45, 0.33, 0.65, 0.28, 0.9, 0, 0.9], 24);
    M.P(g, geo, G.mat('col', { c: 0xffffff, r: 0.85, t: 'wood' }));
    [0.08, 0.3, 0.6, 0.82].forEach(y => M.P(g, M.tor(y < 0.2 || y > 0.7 ? 0.3 : 0.345, 0.015, 6, 28), G.mat('dark'), [0, y, 0], [Math.PI / 2, 0, 0]));
    return g;
  },
  crate() { const g = new THREE.Group(), w = G.mat('wood'); M.P(g, M.box(0.7, 0.7, 0.7), w, [0, 0.35, 0]); [[0, 0.35, 0.36], [0, 0.35, -0.36]].forEach(p => { M.P(g, M.box(0.08, 0.9, 0.03), w, p, [0, 0, 0.78]); }); [0.02, 0.68].forEach(y => M.P(g, M.box(0.72, 0.06, 0.72), G.mat('col', { c: 0x5a3a20, t: 'wood' }), [0, y, 0])); return g; },
  mushrooms(r = Math.random, glow = 0x40e0ff) {
    const g = new THREE.Group();
    for (let i = 0; i < 4 + r() * 4; i++) {
      const h = 0.15 + r() * 0.7, s = 0.1 + h * 0.4, x = (r() - 0.5) * 0.8, z = (r() - 0.5) * 0.8;
      M.P(g, M.cyl(0.03 + s * 0.12, 0.05 + s * 0.15, h, 10), G.mat('col', { c: 0xd8d0c0, r: 0.7 }), [x, h / 2, z], [r() * 0.2, 0, r() * 0.2]);
      M.P(g, M.sph(s, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), G.mat('col', { c: glow, r: 0.4, e: glow, ei: 1.3 }), [x, h, z], 0, [1, 0.6, 1]);
      M.P(g, M.cyl(s * 0.95, s * 0.95, 0.01, 20), G.mat('col', { c: 0x2a6a7a, e: glow, ei: 0.4 }), [x, h, z]);
      for (let d = 0; d < 4; d++) { const a = r() * 7; M.P(g, M.sph(0.012, 6, 4), G.mat('emissive', { c: 0xffffff, i: 2 }), [x + Math.cos(a) * s * 0.6, h + s * 0.45, z + Math.sin(a) * s * 0.6]); }
    }
    g.userData.light = { pos: new THREE.Vector3(0, 0.6, 0), color: glow, intensity: 1.4, dist: 7 };
    return g;
  },
  crystals(r = Math.random, col = 0x8a5aff) {
    const g = new THREE.Group();
    for (let i = 0; i < 5 + r() * 4; i++) { const h = 0.3 + r() * 0.9; const c = M.P(g, M.cyl(0, 0.08 + h * 0.06, h, 6), G.mat('col', { c: col, r: 0.1, m: 0.2, e: col, ei: 1.2, tr: 0.85 }), [(r() - 0.5) * 0.4, h / 2 - 0.05, (r() - 0.5) * 0.4], [(r() - 0.5) * 0.8, r() * 3, (r() - 0.5) * 0.8]); }
    g.userData.light = { pos: new THREE.Vector3(0, 0.6, 0), color: col, intensity: 1.4, dist: 7 };
    return g;
  },
  stalagmite(r = Math.random, h = 1.5, mat) {
    const g = new THREE.Group(), m = mat || G.mat('col', { c: 0x6a5a48, r: 0.95, t: 'rock' });
    const geo = M.cone(0.35, h, 10, 6).clone(), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const f = 1 + (Math.sin(p.getY(i) * 7 + i) * 0.12); p.setX(i, p.getX(i) * f); p.setZ(i, p.getZ(i) * f); }
    geo.computeVertexNormals(); M.P(g, geo, m, [0, h / 2, 0]);
    M.P(g, M.cone(0.15, h * 0.5, 8), m, [0.25, h * 0.25, 0.1]);
    return g;
  },
  mineCart() {
    const g = new THREE.Group(), w = G.mat('wood'), ir = G.mat('iron');
    M.P(g, M.box(0.8, 0.45, 1.1), w, [0, 0.45, 0]); M.P(g, M.box(0.7, 0.4, 1.0), G.mat('col', { c: 0x2a1a10 }), [0, 0.5, 0]);
    for (let i = 0; i < 6; i++) M.P(g, M.rockGeo(0.12 + Math.random() * 0.08, 1, 0.3), G.mat('rock'), [(Math.random() - 0.5) * 0.5, 0.7, (Math.random() - 0.5) * 0.7]);
    M.P(g, M.oct(0.06), G.mat('col', { c: 0x40e0ff, e: 0x2080a0, ei: 1 }), [0.1, 0.8, 0.1]);
    [[0.42, 0.35], [-0.42, 0.35], [0.42, -0.35], [-0.42, -0.35]].forEach(([x, z]) => { M.P(g, M.cyl(0.14, 0.14, 0.05, 20), ir, [x, 0.15, z], [0, 0, Math.PI / 2]); M.P(g, M.cyl(0.03, 0.03, 0.06, 8), ir, [x, 0.15, z], [0, 0, Math.PI / 2]); });
    [0.24, 0.66].forEach(y => M.P(g, M.box(0.84, 0.04, 1.14), ir, [0, y, 0]));
    return g;
  },
  rails(len) { const g = new THREE.Group(); M.mirror(s => M.P(g, M.box(0.05, 0.05, len), G.mat('iron'), [s * 0.42, 0.04, 0])); for (let i = 0; i < len / 0.5; i++) M.P(g, M.box(1.1, 0.05, 0.16), G.mat('wood'), [0, 0.02, -len / 2 + i * 0.5 + 0.25]); return g; },
  tent() {
    const g = new THREE.Group(); const hide = G.mat('col', { c: 0x8a6a4a, t: 'leather', ds: true });
    M.P(g, M.cone(1.3, 1.8, 7, 1, true), hide, [0, 0.9, 0]);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; M.P(g, M.cyl(0.025, 0.025, 2.3, 6), G.mat('wood'), [Math.cos(a) * 0.25, 1.4, Math.sin(a) * 0.25], [Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4]); }
    M.prop.skull(g, [0, 1.55, 0.2], 0);
    return g;
  },
  campfire() {
    const g = new THREE.Group();
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; M.P(g, M.rockGeo(0.12, 1, 0.3), G.mat('rock'), [Math.cos(a) * 0.45, 0.06, Math.sin(a) * 0.45]); }
    for (let i = 0; i < 5; i++) M.P(g, M.cyl(0.05, 0.05, 0.7, 8), G.mat('col', { c: 0x2a1a10, t: 'wood', e: 0x401000, ei: 0.5 }), [0, 0.08, 0], [Math.PI / 2, i * 0.6, 0.15]);
    M.P(g, M.sph(0.2, 12, 8), G.mat('emissive', { c: 0xff4a10, i: 2 }), [0, 0.05, 0], 0, [1.5, 0.3, 1.5]);
    M.flame(g, 2.6, 0xff7020).position.y = 0.05;
    g.userData.light = { pos: new THREE.Vector3(0, 0.7, 0), color: 0xff8030, intensity: 3, dist: 13 };
    return g;
  },
  brazier() {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; M.P(g, M.tube([Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35, Math.cos(a) * 0.15, 0.5, Math.sin(a) * 0.15, Math.cos(a) * 0.3, 0.9, Math.sin(a) * 0.3], 0.03, 16, 6), G.mat('dark')); }
    M.P(g, M.lathe([0.1, 0.85, 0.35, 0.9, 0.45, 1.1, 0.42, 1.12, 0.32, 0.95, 0.0, 0.92], 28), G.mat('dark'));
    for (let i = 0; i < 9; i++) M.P(g, M.rockGeo(0.08, 0, 0.3), G.mat('emissive', { c: 0xff3a08, i: 2.5 }), [(Math.random() - 0.5) * 0.4, 1.05, (Math.random() - 0.5) * 0.4]);
    M.flame(g, 2.2, 0xff5a10).position.y = 1.05;
    g.userData.light = { pos: new THREE.Vector3(0, 1.6, 0), color: 0xff6020, intensity: 3, dist: 12 };
    return g;
  },
  chains(len = 3) {
    const g = new THREE.Group();
    for (let i = 0; i < len / 0.09; i++) M.P(g, M.tor(0.045, 0.012, 6, 14), G.mat('dark'), [0, -i * 0.09, 0], [0, i % 2 ? Math.PI / 2 : 0, 0], [1, 1.4, 1]);
    M.P(g, M.tube([0, -len, 0, 0.1, -len - 0.15, 0, 0.05, -len - 0.3, 0.05], 0.02, 10, 6), G.mat('dark'));
    return g;
  },
  anvil() {
    const g = new THREE.Group(), ir = G.mat('col', { c: 0x3a3a40, m: 0.9, r: 0.35 });
    M.P(g, M.cyl(0.25, 0.32, 0.5, 12), G.mat('wood'), [0, 0.25, 0]);
    M.P(g, M.box(0.25, 0.2, 0.35), ir, [0, 0.6, 0]); M.P(g, M.box(0.32, 0.14, 0.8), ir, [0, 0.77, 0]);
    M.P(g, M.cone(0.07, 0.35, 12), ir, [0, 0.77, 0.55], [Math.PI / 2, 0, 0], [1, 1, 0.8]);
    return g;
  },
  lavaPool(w, d) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 8, 8), G.lavaMat());
    m.rotation.x = -Math.PI / 2; m.position.y = 0.05; g.add(m);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; M.P(g, M.rockGeo(0.25, 1, 0.4), G.mat('col', { c: 0x1a1414, r: 0.8, t: 'rock' }), [Math.cos(a) * w * 0.52, 0.05, Math.sin(a) * d * 0.52]); }
    g.userData.light = { pos: new THREE.Vector3(0, 0.6, 0), color: 0xff4a10, intensity: 3.5, dist: 10 };
    return g;
  },
  cage() {
    const g = new THREE.Group();
    M.P(g, M.cyl(0.6, 0.6, 0.08, 20), G.mat('dark'), [0, 0.04, 0]); M.P(g, M.cone(0.65, 0.4, 20), G.mat('dark'), [0, 2.2, 0]);
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; M.P(g, M.cyl(0.015, 0.015, 2, 6), G.mat('dark'), [Math.cos(a) * 0.58, 1.05, Math.sin(a) * 0.58]); }
    const sk = M.skeleton(); M.hideBase(sk); sk.root.traverse(o => { if (o.isMesh && o.material === sk.boneMat) o.visible = true; });
    M.animHum(sk, { t: 0, move: 0, atk: -1, crouch: 1 }); sk.root.position.y = -0.3; sk.root.scale.setScalar(0.9); g.add(sk.root);
    return g;
  },
  spikes(r = Math.random) { const g = new THREE.Group(); for (let i = 0; i < 7; i++) { const h = 0.6 + r() * 1.6; M.P(g, M.cone(0.12, h, 6), G.mat('col', { c: 0x15101a, r: 0.15, m: 0.6 }), [(r() - 0.5) * 0.8, h / 2, (r() - 0.5) * 0.8], [(r() - 0.5) * 0.4, 0, (r() - 0.5) * 0.4]); } return g; },
  bookshelf() {
    const g = new THREE.Group(), w = G.mat('col', { c: 0x4a2a14, t: 'wood' });
    M.P(g, M.box(1.6, 2.4, 0.08), w, [0, 1.2, -0.2]); M.mirror(s => M.P(g, M.box(0.08, 2.4, 0.45), w, [s * 0.8, 1.2, 0]));
    for (let sh = 0; sh < 5; sh++) { M.P(g, M.box(1.6, 0.05, 0.45), w, [0, 0.05 + sh * 0.55, 0]); if (sh < 4) { let x = -0.72; while (x < 0.7) { const bw = 0.05 + Math.random() * 0.06, bh = 0.3 + Math.random() * 0.15; M.P(g, M.box(bw, bh, 0.3), G.mat('col', { c: [0x6a1a1a, 0x1a3a6a, 0x2a5a2a, 0x5a4a2a, 0x3a1a4a][Math.floor(Math.random() * 5)], r: 0.8 }), [x + bw / 2, 0.08 + sh * 0.55 + bh / 2, 0.02], [0, 0, Math.random() < 0.1 ? 0.3 : 0]); x += bw + 0.008; } } }
    return g;
  },
  table() { const g = new THREE.Group(), w = G.mat('wood'); M.P(g, M.box(1.8, 0.1, 0.9), w, [0, 0.8, 0]); [[0.8, 0.38], [-0.8, 0.38], [0.8, -0.38], [-0.8, -0.38]].forEach(([x, z]) => M.P(g, M.cyl(0.05, 0.04, 0.8, 10), w, [x, 0.4, z])); return g; },
  bed() { const g = new THREE.Group(), w = G.mat('wood'); M.P(g, M.box(1.0, 0.35, 2.0), w, [0, 0.25, 0]); M.P(g, M.box(0.95, 0.15, 1.9), G.mat('col', { c: 0x7a2a2a, t: 'cloth' }), [0, 0.5, 0]); M.P(g, M.cap(0.12, 0.6, 4, 10), G.mat('col', { c: 0xe8e0d0, t: 'cloth' }), [0, 0.62, -0.75], [0, 0, Math.PI / 2]); M.P(g, M.box(1.0, 0.8, 0.08), w, [0, 0.6, -1.0]); return g; },
  fireplace() {
    const g = new THREE.Group(), st = G.mat('col', { c: 0x8a7a6a, t: 'rock' });
    M.P(g, M.box(2.4, 2.2, 0.8), st, [0, 1.1, -0.2]); M.P(g, M.box(1.4, 1.1, 0.7), G.mat('col', { c: 0x0a0806 }), [0, 0.6, 0.0]);
    M.P(g, M.box(2.7, 0.18, 1.0), G.mat('wood'), [0, 2.25, 0]); M.P(g, M.box(1.8, 2.5, 0.6), st, [0, 3.5, -0.3]);
    const f = M.prop.campfire(); f.scale.setScalar(0.8); f.position.set(0, 0.05, 0.1); g.add(f);
    g.userData.light = { pos: new THREE.Vector3(0, 0.9, 0.9), color: 0xff8030, intensity: 4, dist: 16 };
    return g;
  },
  weaponRack() {
    const g = new THREE.Group(), w = G.mat('wood');
    M.P(g, M.box(1.6, 0.08, 0.2), w, [0, 0.4, 0]); M.P(g, M.box(1.6, 0.08, 0.2), w, [0, 1.5, 0]); M.mirror(s => M.P(g, M.box(0.08, 1.7, 0.2), w, [s * 0.8, 0.85, 0]));
    [M.weapon.sword(1), M.weapon.axe(0, false), M.weapon.mace(0), M.weapon.sword(2)].forEach((wp, i) => { wp.position.set(-0.55 + i * 0.37, 0.45, 0.06); g.add(wp); });
    return g;
  },
  portal(color = 0x7a4aff) {
    const g = new THREE.Group(), st = G.mat('col', { c: 0x4a4650, r: 0.8, t: 'rock' });
    for (let i = 0; i < 13; i++) { const a = Math.PI * (i / 12); const b = M.P(g, M.box(0.5, 0.42, 0.6), st, [Math.cos(a) * 1.6, Math.sin(a) * 1.6 + 0.2, 0], [0, 0, a]); M.P(b, M.box(0.08, 0.08, 0.62), G.mat('emissive', { c: color, i: 2 }), [0, 0, 0]); }
    M.mirror(s => M.P(g, M.box(0.55, 0.45, 0.65), st, [s * 1.6, 0.0, 0]));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.4, 48), new THREE.MeshBasicMaterial({ map: G.tex.sprite('rune'), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    disc.position.y = 0.4; g.add(disc);
    const swirl = new THREE.Mesh(new THREE.CircleGeometry(1.35, 48), new THREE.MeshBasicMaterial({ map: G.tex.sprite('glow'), color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    swirl.position.y = 0.4; swirl.position.z = 0.01; g.add(swirl);
    const floorRune = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshBasicMaterial({ map: G.tex.sprite('rune'), color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    floorRune.rotation.x = -Math.PI / 2; floorRune.position.set(0, 0.03, 1.4); g.add(floorRune);
    g.userData.spin = [disc, swirl, floorRune]; g.userData.light = { pos: new THREE.Vector3(0, 1.2, 0.6), color, intensity: 4, dist: 14 };
    return g;
  },
  stall() {
    const g = new THREE.Group(), w = G.mat('wood');
    M.P(g, M.box(2.4, 0.9, 0.8), w, [0, 0.45, 0]);
    [[1.15, 0.35], [-1.15, 0.35], [1.15, -0.35], [-1.15, -0.35]].forEach(([x, z]) => M.P(g, M.cyl(0.05, 0.05, 2.5, 8), w, [x, 1.25, z]));
    const cl = M.box(2.6, 0.02, 1.2, 10, 1, 4).clone(), p = cl.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + Math.abs(Math.sin(p.getX(i) * 4)) * 0.08); cl.computeVertexNormals();
    M.P(g, cl, G.mat('col', { c: 0x8a2020, t: 'cloth', ds: true }), [0, 2.5, 0.1], [0.15, 0, 0]);
    for (let i = 0; i < 7; i++) { const it = M.loot[['gem', 'chalice', 'idol', 'coins', 'potion', 'scroll', 'crown'][i]](i % 3); it.position.set(-1 + i * 0.33, 0.95, 0); g.add(it); }
    return g;
  },
  mannequin() {
    const g = new THREE.Group(), w = G.mat('wood');
    M.P(g, M.cyl(0.25, 0.3, 0.06, 16), w, [0, 0.03, 0]); M.P(g, M.cyl(0.03, 0.03, 1.1, 8), w, [0, 0.6, 0]);
    M.P(g, M.sph(0.22, 20, 14), G.mat('col', { c: 0xc8b090, r: 0.9 }), [0, 1.3, 0], 0, [1.1, 1.4, 0.7]);
    const bp = M.loot.backpack(); bp.position.set(0, 1.3, -0.2); bp.rotation.y = Math.PI; g.add(bp);
    return g;
  }
};

/* lava material: animated shader */
G.lavaMat = () => {
  if (G._lava) return G._lava;
  G._lava = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: `uniform float t; varying vec2 vUv; varying vec3 vW;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      float fb(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p*=2.03;a*=.5;}return v;}
      void main(){ vec2 p=vW.xz*0.6; float q=fb(p+vec2(t*0.15,t*0.1)); float r=fb(p*1.7+q*2.5-vec2(t*0.2,-t*0.12));
        vec3 c=mix(vec3(0.25,0.02,0.0),vec3(1.6,0.45,0.05),smoothstep(0.35,0.75,r)); c=mix(c,vec3(2.4,1.6,0.6),smoothstep(0.72,0.9,r)); gl_FragColor=vec4(c,1.0);}`
  });
  return G._lava;
};

/* ---------- loot item models ---------- */
M.loot = {
  gem(v = 0) { const g = new THREE.Group(), c = [0xff2a4a, 0x2aa0ff, 0x30ff70, 0xc040ff][v % 4]; M.P(g, M.oct(0.12, 0), G.mat('col', { c, r: 0.05, m: 0.3, e: c, ei: 0.6, tr: 0.9 }), [0, 0.12, 0], 0, [1, 1.4, 1]); return g; },
  idol(v = 0) { const g = new THREE.Group(); M.P(g, M.cyl(0.08, 0.1, 0.06, 16), G.mat('gold'), [0, 0.03, 0]); M.P(g, M.cap(0.06, 0.12, 4, 12), G.mat('gold'), [0, 0.15, 0]); M.P(g, M.sph(0.06, 16, 12), G.mat('gold'), [0, 0.3, 0]); M.mirror(s => M.P(g, M.sph(0.015, 8, 6), G.mat('col', { c: 0xff2020, e: 0xff0000, ei: 1 }), [s * 0.022, 0.31, 0.05])); return g; },
  chalice(v = 0) { const g = new THREE.Group(); M.P(g, M.lathe([0, 0, 0.09, 0, 0.08, 0.02, 0.02, 0.05, 0.02, 0.15, 0.09, 0.22, 0.1, 0.32, 0.09, 0.32, 0.0, 0.25], 24), G.mat(v ? 'gold' : 'col', v ? undefined : { c: 0xc0c0c8, m: 1, r: 0.2 })); M.P(g, M.oct(0.025), G.mat('col', { c: 0xff2040, e: 0x800010, ei: 1 }), [0, 0.24, 0.09]); return g; },
  coins() { const g = new THREE.Group(); for (let i = 0; i < 9; i++) M.P(g, M.cyl(0.05, 0.05, 0.012, 16), G.mat('gold'), [(Math.random() - 0.5) * 0.12, i * 0.013, (Math.random() - 0.5) * 0.12], [Math.random() * 0.2, 0, Math.random() * 0.2]); return g; },
  potion(v = 0) { const g = new THREE.Group(), c = [0xff2a2a, 0x2a6aff, 0x40ff60][v % 3]; M.P(g, M.lathe([0, 0, 0.08, 0.01, 0.1, 0.08, 0.08, 0.16, 0.03, 0.2, 0.03, 0.26, 0, 0.26], 20), G.mat('col', { c: 0xeef8ff, tr: 0.4, r: 0.05 })); M.P(g, M.sph(0.085, 16, 12), G.mat('col', { c, e: c, ei: 0.8 }), [0, 0.09, 0], 0, [1, 0.85, 1]); M.P(g, M.cyl(0.032, 0.03, 0.05, 10), G.mat('wood'), [0, 0.27, 0]); return g; },
  scroll() { const g = new THREE.Group(); M.P(g, M.cyl(0.05, 0.05, 0.3, 16), G.mat('col', { c: 0xe8dcb8, r: 0.9 }), [0, 0.06, 0], [0, 0, Math.PI / 2]); M.P(g, M.tor(0.052, 0.008, 6, 16), G.mat('col', { c: 0xa01010 }), [0, 0.06, 0], [0, Math.PI / 2, 0]); M.mirror(s => M.P(g, M.cyl(0.02, 0.02, 0.04, 8), G.mat('wood'), [s * 0.17, 0.06, 0], [0, 0, Math.PI / 2])); return g; },
  crown() { const g = new THREE.Group(); M.P(g, M.cyl(0.12, 0.12, 0.08, 28, 1, true), G.mat('gold'), [0, 0.04, 0]); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; M.P(g, M.cone(0.025, 0.08, 6), G.mat('gold'), [Math.cos(a) * 0.12, 0.12, Math.sin(a) * 0.12]); M.P(g, M.oct(0.018), G.mat('col', { c: [0xff2040, 0x2080ff][i % 2], e: [0x800010, 0x002080][i % 2], ei: 1 }), [Math.cos(a) * 0.125, 0.04, Math.sin(a) * 0.125]); } return g; },
  relic() { const g = new THREE.Group(); M.prop.skull(g, [0, 0.09, 0], 0); M.P(g, M.tor(0.08, 0.01, 6, 20), G.mat('gold'), [0, 0.16, 0], [Math.PI / 2, 0, 0]); return g; },
  ring(v = 0) { const g = new THREE.Group(); M.P(g, M.tor(0.06, 0.015, 10, 28), G.mat('gold'), [0, 0.07, 0]); M.P(g, M.oct(0.025), G.mat('col', { c: 0x30ff90, e: 0x108040, ei: 1.2 }), [0, 0.135, 0]); return g; },
  backpack() { const g = new THREE.Group(), l = G.mat('leather'); M.P(g, M.box(0.36, 0.45, 0.2, 2, 2, 2), l, [0, 0, 0]); M.P(g, M.cyl(0.1, 0.1, 0.36, 16), G.mat('col', { c: 0x6a4a2a, t: 'cloth' }), [0, 0.28, 0], [0, 0, Math.PI / 2]); M.P(g, M.box(0.3, 0.18, 0.06), l, [0, -0.08, -0.12]); M.P(g, M.box(0.04, 0.05, 0.02), G.mat('gold'), [0, -0.0, -0.155]); return g; }
};

/* ---------- NPC models ---------- */
M.npc = {
  oracle() {
    const robe = G.mat('col', { c: 0x2a3a5a, t: 'cloth', ds: true }), R = M.humanoid({ top: robe, bottom: robe, skin: G.mat('col', { c: 0xb8a090, t: 'skin' }), eye: 0x9a60ff, eyeGlow: 0x5020a0, brow: 0xd0d0d0 });
    R.legL.up.visible = R.legR.up.visible = false;
    M.P(R.hips, M.lathe([0.16, 0.25, 0.22, 0, 0.3, -0.5, 0.35, -0.9, 0.34, -0.92], 30), robe);
    M.P(R.head, M.lathe([0, 0.3, 0.09, 0.29, 0.14, 0.24, 0.17, 0.14, 0.17, 0.0, 0.18, -0.08], 28), robe, [0, 0, -0.02], 0, [1, 1, 1.1]);
    for (let i = 0; i < 6; i++) M.P(R.head, M.tube([(i - 2.5) * 0.03, 0.18, 0.06, (i - 2.5) * 0.04, 0.05, 0.1, (i - 2.5) * 0.05, -0.15, 0.06], 0.012, 12, 5), G.mat('col', { c: 0xd8d8d8 }));
    R.ball = M.G(R.root, [0, 1.35, 0.45]);
    M.P(R.ball, M.sph(0.16, 32, 24), G.mat('col', { c: 0xb090ff, tr: 0.45, r: 0.02, e: 0x4020a0, ei: 1.5 }));
    M.P(R.ball, M.ico(0.07, 2), G.mat('emissive', { c: 0xd0a0ff, i: 4 }));
    R.armPose = (R, st) => { R.armL.sh.rotation.set(-1.1, -0.3, 0.2); R.armR.sh.rotation.set(-1.1, 0.3, -0.2); R.armL.el.rotation.x = -0.4; R.armR.el.rotation.x = -0.4; R.ball.position.y = 1.35 + Math.sin(st.t * 1.5) * 0.05; R.ball.rotation.y = st.t; };
    R.light = { color: 0xb080ff, intensity: 2, dist: 8 };
    return R;
  },
  dwarf() {
    const R = M.humanoid({ top: G.mat('col', { c: 0x5a3a20, t: 'leather' }), bottom: G.mat('col', { c: 0x3a3a4a, t: 'cloth' }), bulk: 1.4, skin: G.mat('col', { c: 0xd89a7a, t: 'skin' }), brow: 0xa04a10 });
    R.root.scale.set(0.95, 0.7, 0.95); R.head.scale.set(1.2, 1.5, 1.2);
    M.P(R.head, M.lathe([0, 0.08, 0.11, 0.07, 0.13, 0.0, 0.1, -0.12, 0.05, -0.2, 0, -0.22], 22), G.mat('col', { c: 0xb05a1a, r: 1 }), [0, 0.0, 0.05], 0, [1.1, 1, 0.7]);
    M.P(R.head, M.sph(0.14, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), G.mat('iron'), [0, 0.14, 0]);
    M.P(R.torso, M.box(0.36, 0.5, 0.02), G.mat('col', { c: 0x3a2010, t: 'leather' }), [0, 0.0, 0.17]);
    const hm = M.G(R.armR.hand, [0, 0, 0], [Math.PI / 2, 0, 0]); M.P(hm, M.cyl(0.02, 0.02, 0.5, 8), G.mat('wood'), [0, 0.15, 0]); M.P(hm, M.box(0.18, 0.1, 0.1), G.mat('iron'), [0, 0.4, 0]);
    R.light = { color: 0xffa040, intensity: 1.6, dist: 7 };
    return R;
  },
  ghost() {
    const R = M.hero('knight', 2); const gm = G.mat('col', { c: 0x9ad8ff, tr: 0.45, e: 0x3080c0, ei: 1.4 });
    R.root.traverse(o => { if (o.isMesh) o.material = gm; });
    R.extraAnim = (R, st) => { R.body.position.y = 0.15 + Math.sin(st.t * 1.6) * 0.06; };
    R.light = { color: 0x80c8ff, intensity: 2.2, dist: 8 };
    return R;
  },
  shrine() {
    // a talking skull shrine
    const R = { kind: 'static', root: new THREE.Group() };
    M.P(R.root, M.box(0.9, 1.0, 0.9), G.mat('col', { c: 0x5a5650, t: 'rock' }), [0, 0.5, 0]);
    M.P(R.root, M.cyl(0.55, 0.6, 0.15, 24), G.mat('col', { c: 0x5a5650, t: 'rock' }), [0, 1.08, 0]);
    R.skull = M.prop.skull(R.root, [0, 1.3, 0], 0); R.skull.scale.setScalar(2.2);
    M.mirror(s => M.P(R.skull, M.sph(0.012, 8, 6), G.mat('emissive', { c: 0xffd040, i: 6 }), [s * 0.032, 0, 0.09]));
    for (let i = 0; i < 6; i++) { const c = M.prop.candles(2); c.position.set(Math.cos(i) * 0.4, 1.15, Math.sin(i) * 0.4); c.scale.setScalar(0.6); R.root.add(c); }
    R.light = { color: 0xffc060, intensity: 2, dist: 8 };
    return R;
  }
};
