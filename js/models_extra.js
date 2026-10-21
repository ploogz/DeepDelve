/* ============================================================
   Models for secrets & encounters: gates, traps, pedestals,
   keys, wearable magic items, event set-pieces, the mimic
   ============================================================ */
'use strict';
/* ---------- gates: built facing +z (from the room into the annex) ---------- */
M.prop.gate = (type, theme, H, wallMat) => {
  const g = new THREE.Group(), CS = 4, st = theme === 'forge' ? G.mat('col', { c: 0x2a2424, r: 0.8, t: 'rock' }) : theme === 'warrens' ? G.mat('col', { c: 0x6a5a48, r: 0.95, t: 'rock' }) : G.mat('col', { c: 0x8a8680, r: 0.9, t: 'rock' });
  g.userData.type = type;
  if (type === 'secret') { // looks like wall, but cracked
    const block = M.P(g, M.box(CS, H, CS), wallMat, [0, H / 2, 0]);
    const cracks = new THREE.Mesh(G.fx._dg || (G.fx._dg = new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ map: G.tex.sprite('crack'), color: 0x111111, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    cracks.position.set(0, 1.6, -CS / 2 - 0.01); cracks.rotation.y = Math.PI; cracks.scale.set(2.6, 2.6, 1); g.add(cracks);
    const glow = new THREE.Mesh(G.fx._dg, new THREE.MeshBasicMaterial({ map: G.tex.sprite('crack'), color: 0x9ad8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.position.set(0, 1.6, -CS / 2 - 0.02); glow.rotation.y = Math.PI; glow.scale.set(2.7, 2.7, 1); g.add(glow);
    for (let i = 0; i < 5; i++) M.P(g, M.rockGeo(0.15 + Math.random() * 0.12, 0, 0.3), st, [(Math.random() - 0.5) * 2.5, 0.1, -CS / 2 - 0.2]);
    g.userData.block = block; g.userData.cracks = cracks; g.userData.glow = glow; return g;
  }
  // frame: two posts and a lintel, wall above
  M.mirror(s => M.P(g, M.box(0.55, H, CS * 0.5), st, [s * (CS / 2 - 0.275), H / 2, 0]));
  M.P(g, M.box(CS, H - 3.4, CS * 0.5), st, [0, 3.4 + (H - 3.4) / 2, 0]);
  M.P(g, M.box(3.1, 0.25, CS * 0.55), st, [0, 3.42, 0]);
  if (type === 'locked') {
    const hinge = M.G(g, [-1.45, 0, -0.35]); const door = M.G(hinge, [1.45, 0, 0]);
    for (let i = 0; i < 6; i++) M.P(door, M.box(0.47, 3.3, 0.12), G.mat('col', { c: [0x5a3418, 0x4e2c14, 0x623a1c][i % 3], r: 0.85, t: 'wood' }), [-1.2 + i * 0.48, 1.67, 0]);
    [0.6, 1.7, 2.8].forEach(y => M.P(door, M.box(2.95, 0.12, 0.16), G.mat('iron'), [0, y, 0]));
    for (let i = 0; i < 9; i++) M.P(door, M.sph(0.035, 8, 6), G.mat('dark'), [-1.3 + (i % 3) * 1.3, [0.6, 1.7, 2.8][Math.floor(i / 3)], -0.09]);
    M.P(door, M.box(0.3, 0.42, 0.04), G.mat('iron'), [1.05, 1.5, -0.09]); M.P(door, M.cyl(0.04, 0.04, 0.05, 10), G.mat('col', { c: 0x050505 }), [1.05, 1.52, -0.12], [Math.PI / 2, 0, 0]);
    M.P(door, M.tor(0.11, 0.022, 8, 18), G.mat('iron'), [0.85, 1.35, -0.14]);
    g.userData.hinge = hinge;
  } else if (type === 'vault') {
    const slab = M.G(g, [0, 0, -0.3]);
    M.P(slab, M.box(3.0, 3.35, 0.3), G.mat('col', { c: 0x34363c, m: 0.9, r: 0.4 }), [0, 1.7, 0]);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 6; x++) M.P(slab, M.sph(0.045, 8, 6), G.mat('bronze'), [-1.25 + x * 0.5, 0.4 + y * 0.7, -0.16]);
    M.P(slab, M.cyl(0.42, 0.42, 0.08, 32), G.mat('gold'), [0, 1.7, -0.18], [Math.PI / 2, 0, 0]);
    M.P(slab, M.tor(0.42, 0.04, 8, 32), G.mat('bronze'), [0, 1.7, -0.22]);
    const kh = M.P(slab, M.ext('keyhole', s => { s.absarc(0, 0.06, 0.07, 0, Math.PI * 2, false); }, 0.02, 0), G.mat('emissive', { c: 0xffc040, i: 3 }), [0, 1.72, -0.24]);
    M.P(slab, M.box(0.05, 0.16, 0.02), G.mat('emissive', { c: 0xffc040, i: 3 }), [0, 1.6, -0.24]);
    M.mirror(s => { const ch = M.prop.chains(1.6); ch.position.set(s * 1.1, 3.3, -0.2); ch.rotation.z = s * 0.5; slab.add(ch); });
    g.userData.slab = slab; g.userData.light = { pos: new G.V3(0, 1.8, -1), color: 0xffb040, intensity: 1.2, dist: 5 };
  } else if (type === 'rune') {
    const field = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.35), new THREE.MeshBasicMaterial({ map: G.tex.sprite('rune'), color: 0xa070ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    field.position.y = 1.7; g.add(field);
    const veil = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.35), new THREE.MeshBasicMaterial({ color: 0x4a2a8a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    veil.position.y = 1.7; g.add(veil);
    const glyphs = []; for (let i = 0; i < 8; i++) { const m = M.P(g, M.oct(0.07), G.mat('emissive', { c: 0xc090ff, i: 3 }), [(Math.random() - 0.5) * 2.6, 0.4 + Math.random() * 2.8, 0]); glyphs.push(m); }
    g.userData.field = field; g.userData.veil = veil; g.userData.glyphs = glyphs; g.userData.light = { pos: new G.V3(0, 1.8, -0.6), color: 0x9a6aff, intensity: 1.6, dist: 6 };
  }
  return g;
};

/* ---------- pressure plate ---------- */
M.prop.plate = (kind, theme) => {
  const g = new THREE.Group(), st = G.mat('col', { c: theme === 'forge' ? 0x3a3030 : theme === 'warrens' ? 0x6a5a48 : 0x7e7a72, r: 0.9, t: 'rock' });
  M.P(g, M.box(1.2, 0.07, 1.2, 2, 1, 2), st, [0, 0.035, 0]);
  M.P(g, M.box(1.0, 0.01, 0.03), G.mat('col', { c: 0x1a1612 }), [0, 0.078, 0.3]); M.P(g, M.box(1.0, 0.01, 0.03), G.mat('col', { c: 0x1a1612 }), [0, 0.078, -0.3]);
  if (kind === 'spikes') for (let i = 0; i < 9; i++) M.P(g, M.cyl(0.035, 0.035, 0.01, 8), G.mat('col', { c: 0x050505 }), [-0.35 + (i % 3) * 0.35, 0.078, -0.35 + Math.floor(i / 3) * 0.35]);
  if (kind === 'fire' || kind === 'gas') for (let i = 0; i < 5; i++) M.P(g, M.box(0.8, 0.01, 0.04), G.mat('dark'), [0, 0.078, -0.4 + i * 0.2]);
  const mark = new THREE.Mesh(G.fx._dg || (G.fx._dg = new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ map: G.tex.sprite('ring'), color: 0xff3020, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  mark.rotation.x = -Math.PI / 2; mark.position.y = 0.1; mark.renderOrder = 0.7; mark.scale.setScalar(1.9); g.add(mark); g.userData.mark = mark;
  if (kind === 'spikes') { const sp = M.G(g, [0, -0.9, 0]); for (let i = 0; i < 9; i++) M.P(sp, M.cone(0.06, 0.8, 6), G.mat('iron'), [-0.35 + (i % 3) * 0.35, 0.4, -0.35 + Math.floor(i / 3) * 0.35]); g.userData.spikes = sp; }
  return g;
};

/* ---------- pedestals: relic or key ---------- */
M.relicSprite = (icon, color = 0xffd080) => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, 'rgba(255,220,150,0.65)'); g.addColorStop(1, 'rgba(255,200,100,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  x.font = '72px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(icon, 64, 70);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.setScalar(0.9); return s;
};
M.prop.pedestal = (kind, relic) => {
  const g = new THREE.Group(), st = G.mat('col', { c: 0x9a9488, r: 0.85, t: 'rock' });
  M.P(g, M.box(0.9, 0.18, 0.9), st, [0, 0.09, 0]); M.P(g, M.lathe([0.28, 0.18, 0.2, 0.4, 0.17, 0.75, 0.24, 0.95, 0.34, 1.0, 0.34, 1.08, 0, 1.08], 20), st);
  M.P(g, M.tor(0.3, 0.02, 6, 24), G.mat('gold'), [0, 1.04, 0], [Math.PI / 2, 0, 0]);
  const float = M.G(g, [0, 1.55, 0]);
  if (kind === 'key') { const k = M.loot.key(); k.scale.setScalar(2.2); float.add(k); g.userData.light = { pos: new G.V3(0, 1.6, 0), color: 0xffc040, intensity: 1.6, dist: 6 }; }
  else { float.add(M.relicSprite(G.RELICS[relic].icon)); const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.tex.sprite('glow'), color: 0xffb050, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); halo.scale.setScalar(1.6); float.add(halo); g.userData.light = { pos: new G.V3(0, 1.6, 0), color: 0xffb050, intensity: 2, dist: 7 }; }
  g.userData.float = float; return g;
};

/* ---------- loot additions ---------- */
M.loot.key = () => { const g = new THREE.Group(), m = G.mat('gold'); M.P(g, M.tor(0.05, 0.014, 8, 20), m, [0, 0.12, 0]); M.P(g, M.cyl(0.012, 0.012, 0.16, 8), m, [0, 0.0, 0]); M.P(g, M.box(0.05, 0.02, 0.012), m, [0.022, -0.06, 0]); M.P(g, M.box(0.035, 0.02, 0.012), m, [0.016, -0.025, 0]); M.P(g, M.oct(0.02), G.mat('col', { c: 0xff3040, e: 0x801020, ei: 1 }), [0, 0.12, 0]); return g; };
M.loot.amulet = () => { const g = new THREE.Group(); M.P(g, M.tor(0.07, 0.006, 6, 24), G.mat('gold'), [0, 0.1, 0]); M.P(g, M.oct(0.04), G.mat('col', { c: 0x9a40ff, e: 0x401080, ei: 1.2, tr: 0.9 }), [0, 0.03, 0], 0, [1, 1.3, 0.6]); return g; };
M.loot.cloak = () => { const g = new THREE.Group(); const c = M.cone(0.16, 0.34, 14, 1, true); M.P(g, c, G.mat('col', { c: 0x3a2a6a, t: 'cloth', ds: true }), [0, 0.17, 0]); M.P(g, M.sph(0.03, 10, 8), G.mat('gold'), [0, 0.33, 0.05]); return g; };
M.loot.gauntlets = () => { const g = new THREE.Group(); M.mirror(s => { M.P(g, M.cyl(0.05, 0.06, 0.16, 12), G.mat('iron'), [s * 0.08, 0.08, 0], [0, 0, s * 0.2]); M.P(g, M.sph(0.055, 12, 10), G.mat('iron'), [s * 0.1, 0.18, 0], 0, [1, 0.8, 0.7]); }); return g; };
M.loot.boots = () => { const g = new THREE.Group(); M.mirror(s => { M.P(g, M.cyl(0.045, 0.05, 0.16, 12), G.mat('leather'), [s * 0.07, 0.1, 0]); M.P(g, M.bootGeo(), G.mat('leather'), [s * 0.07, 0.02, 0.02], 0, 0.9); M.P(g, M.cone(0.03, 0.08, 6), G.mat('gold'), [s * 0.12, 0.15, -0.02], [0, 0, s * -1.2]); }); return g; };
M.loot.circlet = () => { const g = new THREE.Group(); M.P(g, M.tor(0.1, 0.01, 8, 28), G.mat('gold'), [0, 0.06, 0], [Math.PI / 2, 0, 0]); M.P(g, M.oct(0.03), G.mat('col', { c: 0x40c0ff, e: 0x1060a0, ei: 1.2 }), [0, 0.07, 0.1]); return g; };

/* ---------- event set-pieces ---------- */
M.ev = {
  shrine() { const g = new THREE.Group(); const s = M.prop.statue('crypt'); g.add(s); const sk = M.skeleton(); M.batchRig(sk); M.animHum(sk, { t: 0, move: 0, atk: -1, crouch: 1 }); sk.root.position.set(0, 0, 1.3); sk.root.rotation.y = Math.PI; g.add(sk.root); const am = M.loot.amulet(); am.position.set(0, 0.95, 0.9); am.scale.setScalar(1.6); g.add(am); for (let i = 0; i < 3; i++) { const c = M.prop.candles(4); c.position.set(-1 + i, 0.6, 0.6); c.scale.setScalar(0.6); g.add(c); } g.userData.light = { pos: new G.V3(0, 2.2, 1), color: 0xffc070, intensity: 2, dist: 8 }; return g; },
  well() { const g = new THREE.Group(), st = G.mat('col', { c: 0x8a8274, t: 'rock' }); M.P(g, M.lathe([0.95, 0, 1.05, 0.05, 1.05, 0.85, 0.9, 0.9, 0.85, 0.05], 28), st); M.P(g, M.cyl(0.88, 0.88, 0.02, 28), G.mat('col', { c: 0x05070a, r: 0.05, m: 0.4 }), [0, 0.3, 0]); M.mirror(s => M.P(g, M.box(0.15, 2.2, 0.15), G.mat('wood'), [s * 1.0, 1.1, 0])); M.P(g, M.cyl(0.07, 0.07, 2.2, 10), G.mat('wood'), [0, 2.1, 0], [0, 0, Math.PI / 2]); M.P(g, M.cyl(0.006, 0.006, 1.2, 4), G.mat('col', { c: 0x8a7050 }), [0, 1.5, 0]); M.P(g, M.lathe([0, 0, 0.14, 0, 0.16, 0.22, 0, 0.22], 14), G.mat('wood'), [0, 0.8, 0]); for (let i = 0; i < 10; i++) M.P(g, M.cyl(0.03, 0.03, 0.008, 10), G.mat('gold'), [(Math.random() - 0.5) * 1.2, 0.31, (Math.random() - 0.5) * 1.2]); g.userData.light = { pos: new G.V3(0, 0.6, 0), color: 0x60c0ff, intensity: 1.2, dist: 5 }; return g; },
  gambler() { const g = new THREE.Group(); const t = M.prop.table(); t.scale.set(0.6, 1, 0.8); g.add(t); const imp = M.enemy.imp(); M.batchRig(imp); imp.root.position.set(0, 0.2, -0.9); imp.float = false; g.add(imp.root); g.userData.R = imp; for (let i = 0; i < 6; i++) M.P(g, M.box(0.08, 0.005, 0.12), G.mat('col', { c: i % 2 ? 0xf0e8d0 : 0xa02020 }), [(Math.random() - 0.5) * 0.7, 0.86, (Math.random() - 0.5) * 0.4], [0, Math.random() * 3, 0]); const coins = M.loot.coins(); coins.position.set(0.3, 0.86, 0.1); g.add(coins); const c = M.prop.candles(3); c.position.set(-0.4, 0.85, 0); c.scale.setScalar(0.5); g.add(c); g.userData.light = { pos: new G.V3(0, 1.4, 0), color: 0xff6030, intensity: 1.6, dist: 7 }; return g; },
  caged() { const g = new THREE.Group(); M.P(g, M.cyl(0.7, 0.7, 0.08, 20), G.mat('dark'), [0, 0.04, 0]); M.P(g, M.cone(0.75, 0.4, 20), G.mat('dark'), [0, 2.2, 0]); for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; M.P(g, M.cyl(0.015, 0.015, 2, 6), G.mat('dark'), [Math.cos(a) * 0.68, 1.05, Math.sin(a) * 0.68]); } const h = M.hero('rogue', 0); M.batchRig(h); M.animHum(h, { t: 0, move: 0, atk: -1, crouch: 0.8 }); h.root.scale.setScalar(0.92); g.add(h.root); g.userData.R = h; return g; },
  alchemy() { const g = new THREE.Group(); const t = M.prop.table(); g.add(t); for (let k = 0; k < 7; k++) { const p = M.loot.potion(k % 3); p.position.set(-0.75 + k * 0.25, 0.85, (k % 2) * 0.2 - 0.1); g.add(p); } const c = M.P(g, M.lathe([0, 0, 0.4, 0.05, 0.55, 0.3, 0.5, 0.6, 0.45, 0.62], 24), G.mat('dark'), [0, 0, 1.3]); M.P(g, M.cyl(0.46, 0.46, 0.02, 24), G.mat('emissive', { c: 0x6040ff, i: 1.6 }), [0, 0.55, 1.3]); const s = M.loot.scroll(); s.position.set(0.6, 0.86, 0.25); g.add(s); g.userData.light = { pos: new G.V3(0, 1.0, 1.3), color: 0x7a5aff, intensity: 1.8, dist: 6 }; return g; },
  throne() { const g = new THREE.Group(), b = G.mat('bone'); M.P(g, M.box(1.4, 0.5, 1.2), b, [0, 0.25, 0]); M.P(g, M.box(1.4, 1.9, 0.25), b, [0, 1.4, -0.5]); for (let i = 0; i < 26; i++) M.prop.skull(g, [(i % 7 - 3) * 0.2, 0.55 + Math.floor(i / 7) * 0.45, -0.38], 0); M.mirror(s => { M.P(g, M.box(0.2, 0.5, 1.0), b, [s * 0.7, 0.75, 0]); M.prop.skull(g, [s * 0.7, 1.08, 0.4], 0); }); M.P(g, M.ico(0.12, 2), G.mat('emissive', { c: 0x60ff90, i: 3 }), [0, 2.5, -0.5]); g.userData.light = { pos: new G.V3(0, 2.4, 0), color: 0x60ff90, intensity: 2, dist: 8 }; return g; },
  knight() { const g = new THREE.Group(); const k = M.hero('knight', 1); M.batchRig(k); M.animHum(k, { t: 0, move: 0, atk: -1 }); k.root.rotation.set(-1.35, 0, 0); k.root.position.set(0, 0.3, 0.6); k.armR.sh.rotation.x = -0.6; g.add(k.root); const sw = M.weapon.sword(1); sw.rotation.set(Math.PI / 2, 0, 0.4); sw.position.set(0.7, 0.05, 0.3); g.add(sw); const d = new THREE.Mesh(G.fx._dg || (G.fx._dg = new THREE.PlaneGeometry(1, 1)), G.gore.wetMat('pool', 'red', 0.9)); d.rotation.x = -Math.PI / 2; d.position.y = 0.02; d.scale.setScalar(2.4); g.add(d); return g; },
  sarcophagus() { const g = new THREE.Group(); g.add(M.prop.sarcophagus()); for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(G.fx._dg, new THREE.MeshBasicMaterial({ map: G.tex.sprite('rune'), color: 0x60e0ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.79, -0.75 + i * 0.5); m.scale.setScalar(0.42); g.add(m); } g.userData.light = { pos: new G.V3(0, 1.2, 0), color: 0x60e0ff, intensity: 1.6, dist: 6 }; return g; },
  mirror() { const g = new THREE.Group(); M.P(g, M.box(1.6, 2.8, 0.15), G.mat('gold'), [0, 1.6, 0]); M.P(g, M.box(1.35, 2.5, 0.05), new THREE.MeshStandardMaterial({ color: 0xbcc8d8, metalness: 1, roughness: 0.05, emissive: 0x203050, emissiveIntensity: 0.6 }), [0, 1.6, 0.06]); M.mirror(s => M.P(g, M.box(0.2, 0.3, 0.4), G.mat('gold'), [s * 0.6, 0.1, 0])); M.P(g, M.oct(0.12), G.mat('emissive', { c: 0xc0a0ff, i: 3 }), [0, 3.15, 0.05]); g.userData.light = { pos: new G.V3(0, 1.8, 1), color: 0xa0b8ff, intensity: 1.6, dist: 6 }; return g; },
  merc() { const g = new THREE.Group(); const b = M.hero('barbarian', 0); M.batchRig(b); M.animHum(b, { t: 0, move: 0, atk: -1 }); b.root.position.set(-0.9, 0, 0); b.root.rotation.y = 0.5; g.add(b.root); g.userData.R = b; const dm = M.G(g, [0.9, 0, 0]); M.P(dm, M.cyl(0.06, 0.06, 1.6, 8), G.mat('wood'), [0, 0.8, 0]); M.P(dm, M.cap(0.22, 0.4, 6, 14), G.mat('col', { c: 0xc8b080, t: 'cloth' }), [0, 1.3, 0]); M.P(dm, M.sph(0.15, 14, 10), G.mat('col', { c: 0xc8b080, t: 'cloth' }), [0, 1.85, 0]); M.P(dm, M.cyl(0.04, 0.04, 0.9, 8), G.mat('wood'), [0, 1.4, 0], [0, 0, Math.PI / 2]); return g; }
};

/* ---------- the mimic ---------- */
M.enemy.mimic = () => {
  const R = { kind: 'mimic', root: new THREE.Group() };
  const w = G.mat('col', { c: 0x6a3a1a, r: 0.75, t: 'wood', ds: true }), band = G.mat('iron'), flesh = G.mat('col', { c: 0x8a1a2a, r: 0.35, t: 'skin' }), tooth = G.mat('col', { c: 0xf0e6c8, r: 0.35 });
  R.body = M.G(R.root, [0, 0.35, 0]);
  M.P(R.body, M.box(0.9, 0.45, 0.55), w, [0, 0.22, 0]);
  for (let i = 0; i < 3; i++) M.P(R.body, M.box(0.06, 0.47, 0.57), band, [-0.35 + i * 0.35, 0.22, 0]);
  M.P(R.body, M.box(0.82, 0.05, 0.47), flesh, [0, 0.43, 0]);
  for (let i = 0; i < 12; i++) M.P(R.body, M.cone(0.028, 0.11, 6), tooth, [-0.39 + i * 0.071, 0.47, 0.25], [0, 0, 0]);
  for (let i = 0; i < 10; i++) M.P(R.body, M.cone(0.025, 0.09, 6), tooth, [-0.38 + i * 0.085, 0.46, -0.22]);
  R.jaw = M.G(R.body, [0, 0.45, -0.275]);
  if (!G._chestLid) G._chestLid = new THREE.CylinderGeometry(0.275, 0.275, 0.9, 24, 1, false, 0, Math.PI);
  M.P(R.jaw, G._chestLid, w, [0, 0, 0.275], [0, 0, Math.PI / 2]);
  M.P(R.jaw, new THREE.CylinderGeometry(0.26, 0.26, 0.86, 20, 1, true, 0, Math.PI), flesh, [0, 0, 0.275], [0, 0, Math.PI / 2]);
  for (let i = 0; i < 12; i++) M.P(R.jaw, M.cone(0.028, 0.12, 6), tooth, [-0.39 + i * 0.071, -0.04, 0.52], [Math.PI, 0, 0]);
  for (let i = 0; i < 3; i++) M.P(R.jaw, M.tor(0.28, 0.025, 6, 20, Math.PI), band, [-0.35 + i * 0.35, 0, 0.275], [0, Math.PI / 2, 0]);
  M.mirror(s => M.P(R.jaw, M.sph(0.05, 12, 10), G.mat('emissive', { c: 0xffd020, i: 3 }), [s * 0.22, 0.2, 0.45]));
  R.tongue = []; let par = R.body;
  for (let i = 0; i < 6; i++) { const j = M.G(par, i ? [0, 0, 0.12] : [0, 0.44, 0.1]); M.P(j, M.sph(0.06 - i * 0.005, 10, 8), flesh, [0, 0, 0.06], 0, [1.3, 0.5, 1.4]); R.tongue.push(j); par = j; }
  R.legs = [];
  [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sz], i) => { const b = M.G(R.body, [sx * 0.36, 0.05, sz * 0.2]); const ch = M.legChain(b, [0.28, 0.26], flesh, 0.05); ch[0].rotation.z = sx * 0.7; ch[1].rotation.z = -sx * 1.1; R.legs.push({ b, ch, sx, sz }); });
  R.root.scale.setScalar(1.15);
  return R;
};
M.animMimic = (R, st) => {
  const t = st.t, mv = st.move || 0, ph = st.phase || 0, p = st.atk;
  const hop = Math.abs(Math.sin(ph * 1.2)) * 0.25 * mv;
  R.body.position.y = 0.35 + hop + Math.sin(t * 3) * 0.015;
  R.body.rotation.x = Math.sin(ph * 1.2) * 0.12 * mv;
  const bite = p >= 0 ? Math.sin(G.clamp(p, 0, 1) * Math.PI) : 0;
  R.jaw.rotation.x = -(0.35 + Math.sin(t * 4) * 0.08 + bite * 0.9);
  R.tongue.forEach((j, i) => { j.rotation.x = Math.sin(t * 6 - i * 0.7) * 0.35 + (bite ? -0.4 : 0.25); j.rotation.y = Math.sin(t * 4 + i) * 0.3; });
  R.legs.forEach((L, i) => { const w = Math.sin(ph * 1.2 + (i % 2) * Math.PI); L.b.rotation.x = w * 0.5 * mv; });
};
(() => { const base = M.anim; M.anim = (R, st) => { if (R.kind === 'mimic') return M.animMimic(R, st); return base(R, st); }; })();

/* ---------- the great door to a boss arena ----------
   built in a 4x4 wall cell; -z faces the corridor, +z the arena. Leaves swing into the arena. */
M.prop.bossDoor = (theme, H, HA) => {
  const g = new THREE.Group(), CS = 4;
  const st = theme === 'forge' ? G.mat('col', { c: 0x241c1c, r: 0.8, t: 'rock' }) : theme === 'warrens' ? G.mat('col', { c: 0x5a4a3a, r: 0.95, t: 'rock' }) : G.mat('col', { c: 0x7e7a72, r: 0.9, t: 'rock' });
  const dh = Math.min(H - 0.45, 4.3), half = 1.62;
  // jambs, lintel, and stone filling the arena-side wall above
  M.mirror(s => { M.P(g, M.box(0.38, dh, CS), st, [s * (half + 0.19), dh / 2, 0]); M.P(g, M.box(0.6, dh + 0.3, 0.5), st, [s * (half + 0.3), (dh + 0.3) / 2, -CS / 2 + 0.25]); M.P(g, M.box(0.6, dh + 0.3, 0.5), st, [s * (half + 0.3), (dh + 0.3) / 2, CS / 2 - 0.25]); });
  M.P(g, M.box(CS, HA - dh, CS), st, [0, dh + (HA - dh) / 2, 0]);
  M.P(g, M.box(CS * 0.95, 0.35, 0.6), st, [0, dh + 0.17, -CS / 2 + 0.3]);
  // carved keystone with a sigil above the corridor side
  const sig = theme === 'forge' ? 0xff4010 : theme === 'warrens' ? 0x50ffb0 : 0x9ad0ff;
  M.P(g, M.box(0.7, 0.8, 0.3), st, [0, dh + 0.55, -CS / 2 - 0.05]);
  if (theme === 'crypt') M.prop.skull(g, [0, dh + 0.62, -CS / 2 - 0.25], 0);
  else M.P(g, M.oct(0.18), G.mat('emissive', { c: sig, i: 3 }), [0, dh + 0.6, -CS / 2 - 0.22], 0, [1, 1.4, 0.4]);
  // two leaves of iron-bound timber
  const wood = G.mat('col', { c: theme === 'forge' ? 0x2a1a14 : 0x4a2c16, r: 0.85, t: 'wood' }), iron = G.mat('col', { c: 0x2a2a30, m: 0.9, r: 0.45 }), gold = theme === 'forge' ? G.mat('col', { c: 0x8a2a10, m: 0.8, r: 0.3, e: 0x401000, ei: 0.4 }) : G.mat('bronze');
  const leaves = [];
  M.mirror(s => {
    const hinge = M.G(g, [s * half, 0, 0]), leaf = M.G(hinge, [-s * half / 2, 0, 0]);
    for (let i = 0; i < 5; i++) M.P(leaf, M.box(half / 5 - 0.01, dh, 0.22), wood, [(-half / 2 + half / 10 + i * half / 5), dh / 2, 0]);
    [0.5, dh * 0.38, dh * 0.7, dh - 0.35].forEach(y => { M.P(leaf, M.box(half, 0.16, 0.26), iron, [0, y, 0]); for (let k = 0; k < 4; k++) M.P(leaf, M.sph(0.045, 8, 6), iron, [-half / 2 + 0.2 + k * (half - 0.4) / 3, y, -0.14]); });
    M.P(leaf, M.box(0.12, dh - 0.2, 0.25), iron, [s * (half / 2 - 0.08), dh / 2, 0]);
    // ring knocker and half of the emblem on each leaf
    M.P(leaf, M.tor(0.16, 0.03, 8, 22), gold, [-s * (half / 2 - 0.35), dh * 0.48, -0.2]);
    M.P(leaf, M.cyl(0.07, 0.07, 0.06, 14), gold, [-s * (half / 2 - 0.35), dh * 0.48 + 0.16, -0.14], [Math.PI / 2, 0, 0]);
    M.P(leaf, M.cyl(0.42, 0.42, 0.06, 32, 1, false), gold, [-s * half / 2, dh * 0.62, -0.13], [Math.PI / 2, 0, 0], [0.5, 1, 1]);
    hinge.userData.s = s; leaves.push(hinge);
  });
  M.P(g, M.box(0.08, dh, 0.3), iron, [0, dh / 2, 0]);
  // skull torches flanking the corridor side
  M.mirror(s => { const t = M.prop.torch(theme); t.position.set(s * (half + 0.62), 2.4, -CS / 2 - 0.02); t.rotation.y = Math.PI; g.add(t); });
  // the arena face: a towering carved frame so the door reads as a gate of judgement from inside
  const fz = CS / 2 + 0.25, top = dh + 3.2;
  M.mirror(s2 => { M.P(g, M.box(0.7, top, 0.6), st, [s2 * 2.35, top / 2, fz]); M.P(g, M.box(0.9, 0.35, 0.8), st, [s2 * 2.35, 0.17, fz]); M.P(g, M.box(0.9, 0.3, 0.8), st, [s2 * 2.35, top - 0.15, fz]);
    if (theme === 'crypt') for (let k = 0; k < 4; k++) M.prop.skull(g, [s2 * 2.35, 1.2 + k * 1.1, fz + 0.36], 0);
    else M.P(g, M.box(0.08, top - 1, 0.08), G.mat('emissive', { c: sig, i: 2.5 }), [s2 * 2.35, top / 2, fz + 0.31]); });
  M.P(g, M.box(5.6, 0.6, 0.7), st, [0, top + 0.3, fz]);
  const ped = M.ext('pediment', sh => { sh.moveTo(-2.9, 0); sh.lineTo(0, 1.4); sh.lineTo(2.9, 0); sh.lineTo(-2.9, 0); }, 0.5, 0.02); M.P(g, ped, st, [0, top + 0.6, fz - 0.25]);
  M.P(g, M.box(2.2, top - dh - 0.4, 0.3), st, [0, dh + (top - dh) / 2, fz - 0.05]);
  if (theme === 'crypt') { const sk = M.G(g, [0, dh + 1.5, fz + 0.2]); sk.scale.setScalar(3); M.prop.skull(sk, [0, 0, 0], 0); }
  else M.P(g, M.oct(0.35), G.mat('emissive', { c: sig, i: 3 }), [0, dh + 1.5, fz + 0.2], 0, [1, 1.4, 0.4]);
  M.mirror(s2 => { const t = M.prop.torch(theme); t.position.set(s2 * 1.6, dh + 1.2, fz + 0.12); g.add(t); });
  g.userData.leaves = leaves; g.userData.dh = dh;
  g.userData.light = { pos: new G.V3(0, 2.4, -CS / 2 - 1.2), color: theme === 'warrens' ? 0x60e0ff : 0xff7a30, intensity: 2.4, dist: 11 };
  return g;
};

/* ---------- spooky ambience props ---------- */
M.amb = {
  // a chandelier hung from the ceiling `drop` metres below it
  chandelier(theme, drop = 1.6, big) {
    const g = new THREE.Group(), s = big ? 1.7 : 1, dk = G.mat('dark');
    M.P(g, M.cyl(0.015, 0.015, drop, 5), dk, [0, drop / 2, 0]);
    if (theme === 'warrens') {
      const w = G.mat('wood'); M.P(g, M.tor(0.75 * s, 0.06, 6, 24), w, [0, 0, 0], [Math.PI / 2, 0, 0]);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; M.P(g, M.box(0.05, 0.05, 1.5 * s), w, [0, 0, 0], [0, a, 0]); }
      for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4, x = Math.cos(a) * 0.75 * s, z = Math.sin(a) * 0.75 * s; M.P(g, M.cyl(0.006, 0.006, 0.4, 4), dk, [x, -0.2, z]); M.P(g, M.box(0.16, 0.22, 0.16), G.mat('col', { c: 0x40ffc0, tr: 0.55, r: 0.1, e: 0x30c0a0, ei: 1.4 }), [x, -0.5, z]); M.P(g, M.box(0.2, 0.03, 0.2), dk, [x, -0.38, z]); M.P(g, M.box(0.2, 0.03, 0.2), dk, [x, -0.62, z]); }
      for (let i = 0; i < 8; i++) { const a = r8(i); M.P(g, M.cyl(0.004, 0.004, 0.6 + (i % 3) * 0.3, 3), G.mat('col', { c: 0x4a6a3a, t: 'cloth' }), [Math.cos(a) * 0.6 * s, -0.4 - (i % 3) * 0.15, Math.sin(a) * 0.6 * s]); }
      g.userData.light = { pos: new G.V3(0, -0.5, 0), color: 0x50ffc0, intensity: 2.2 * (big ? 1.5 : 1), dist: 12 * (big ? 1.6 : 1) };
      return g;
    }
    const forge = theme === 'forge', ring = M.tor(0.7 * s, 0.045 * s, 8, 40), ring2 = M.tor(0.38 * s, 0.03 * s, 8, 30);
    M.P(g, ring, dk, [0, 0, 0], [Math.PI / 2, 0, 0]); M.P(g, ring2, dk, [0, 0.35 * s, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; M.P(g, M.tube([Math.cos(a) * 0.7 * s, 0, Math.sin(a) * 0.7 * s, Math.cos(a) * 0.45 * s, 0.3 * s, Math.sin(a) * 0.45 * s, 0, 0.9 * s, 0], 0.012, 10, 5), dk); }
    const n = forge ? 6 : 10;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, x = Math.cos(a) * 0.7 * s, z = Math.sin(a) * 0.7 * s;
      if (forge) { M.P(g, M.lathe([0, 0, 0.12, 0.02, 0.16, 0.12, 0.14, 0.13, 0.0, 0.1], 14), dk, [x, 0.02, z]); M.flame(g, 0.9, 0xff5a10).position.set(x, 0.14, z); for (let k = 0; k < 2; k++) M.P(g, M.cone(0.025, 0.25, 5), dk, [x * 1.15, -0.1, z * 1.15], [Math.PI, 0, 0]); }
      else { M.P(g, M.cyl(0.04, 0.03, 0.04, 10), dk, [x, 0.03, z]); const ch = 0.12 + ((i * 37) % 7) * 0.025; M.P(g, M.cyl(0.024, 0.026, ch, 10), G.mat('col', { c: 0xeee6c8, r: 0.6 }), [x, 0.05 + ch / 2, z]); M.flame(g, 0.24).position.set(x, 0.06 + ch, z); M.P(g, M.cone(0.012, 0.08 + (i % 3) * 0.05, 5), G.mat('col', { c: 0xeee6c8, r: 0.6 }), [x, -0.06, z], [Math.PI, 0, 0]); }
    }
    if (theme === 'crypt') for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4, x = Math.cos(a) * 0.5 * s, z = Math.sin(a) * 0.5 * s; M.P(g, M.cyl(0.005, 0.005, 0.5, 3), dk, [x, -0.25, z]); M.prop.skull(g, [x, -0.55, z], a); }
    g.userData.light = { pos: new G.V3(0, 0.1, 0), color: forge ? 0xff6a20 : 0xffb060, intensity: 2.6 * (big ? 1.5 : 1), dist: 13 * (big ? 1.6 : 1) };
    return g;
  },
  skullPile(r = Math.random) { const g = new THREE.Group(); let n = 0; for (let ly = 0; ly < 4; ly++) { const c = 7 - ly * 2; for (let i = 0; i < c; i++) { const a = r() * 6.28, rr = (0.35 - ly * 0.08) * Math.sqrt(r()); M.prop.skull(g, [Math.cos(a) * rr, 0.08 + ly * 0.12, Math.sin(a) * rr], r() * 6); n++; } } for (let i = 0; i < 4; i++) { const b = M.prop.bones(r); b.scale.setScalar(0.6); b.position.set((r() - 0.5) * 0.8, 0, (r() - 0.5) * 0.8); g.add(b); } return g; },
  // wall of stacked skulls and long bones in recessed niches (faces +z)
  ossuary(r = Math.random) {
    const g = new THREE.Group(), st = G.mat('col', { c: 0x6a665e, r: 0.95, t: 'rock' }), dark = G.mat('col', { c: 0x0c0a08, r: 1 }), bone = G.mat('bone');
    M.P(g, M.box(3.2, 2.6, 0.15), dark, [0, 1.55, -0.05]);
    for (let row = 0; row < 3; row++) { M.P(g, M.box(3.3, 0.12, 0.45), st, [0, 0.3 + row * 0.85, 0.12]);
      for (let k = 0; k < 9; k++) { if (r() < 0.12) continue; M.prop.skull(g, [-1.45 + k * 0.36 + (r() - 0.5) * 0.05, 0.44 + row * 0.85, 0.12], (r() - 0.5) * 0.5); }
      for (let k = 0; k < 7; k++) M.P(g, M.cap(0.022, 0.42, 3, 6), bone, [-1.4 + k * 0.46, 0.62 + row * 0.85 + (r() - 0.5) * 0.03, 0.02], [0, 0, Math.PI / 2 + (r() - 0.5) * 0.2]); }
    M.mirror(s => M.P(g, M.box(0.2, 2.8, 0.5), st, [s * 1.65, 1.4, 0.1]));
    M.P(g, M.box(3.5, 0.2, 0.5), st, [0, 2.85, 0.1]);
    return g;
  },
  // a skeleton chained to the wall by its wrists (faces +z)
  shackled(theme) {
    const g = new THREE.Group(), sk = M.skeleton(); M.hideBase(sk); sk.root.traverse(o => { if (o.isMesh && o.material === sk.boneMat) o.visible = true; });
    M.animHum(sk, { t: 0, move: 0, atk: -1 }); sk.armL.sh.rotation.set(-2.6, 0, 0.5); sk.armR.sh.rotation.set(-2.6, 0, -0.5); sk.armL.el.rotation.x = -0.3; sk.armR.el.rotation.x = -0.3;
    sk.neck.rotation.set(0.5, 0.3, 0.2); sk.legL.hip.rotation.set(0.1, 0, 0.05); sk.legR.kn.rotation.x = 0.3;
    sk.root.position.set(0, 0.35, 0.28); g.add(sk.root);
    M.mirror(s => { const ch = M.prop.chains(0.6); ch.position.set(s * 0.42, 2.85, 0.12); g.add(ch); M.P(g, M.box(0.12, 0.12, 0.1), G.mat('dark'), [s * 0.42, 2.9, 0.05]); });
    if (theme !== 'warrens') { const d = new THREE.Mesh(G.fx._dg || (G.fx._dg = new THREE.PlaneGeometry(1, 1)), G.gore.wetMat('drip', 'red', 0.6)); d.position.set(0, 1.4, 0.02); d.scale.set(1.2, 2.2, 1); g.add(d); }
    return g;
  },
  hangCage(len = 2) {
    const g = new THREE.Group(), pivot = M.G(g), ch = M.prop.chains(len); pivot.add(ch);
    const c = M.prop.cage(); c.scale.setScalar(0.75); c.position.y = -len - 2.05 * 0.75; pivot.add(c);
    g.userData.swing = pivot; return g;
  },
  // a ritual circle: glowing glyphs, candles, blood (faces up)
  ritual(theme, r = Math.random) {
    const g = new THREE.Group(), col = theme === 'forge' ? 0xff3010 : theme === 'warrens' ? 0x40ff90 : 0xc03030;
    const rune = new THREE.Mesh(G.fx._dg || (G.fx._dg = new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ map: G.tex.sprite('rune'), color: col, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    rune.rotation.x = -Math.PI / 2; rune.position.y = 0.04; rune.renderOrder = 0.7; rune.scale.setScalar(3.6); g.add(rune); g.userData.rune = rune;
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, c = M.prop.candles(3, r); c.scale.setScalar(0.7); c.position.set(Math.cos(a) * 1.75, 0, Math.sin(a) * 1.75); c.userData.light = null; g.add(c); }
    M.prop.skull(g, [0, 0.09, 0], r() * 6);
    const pool = new THREE.Mesh(G.fx._dg, G.gore.wetMat('pool', 'red', 0.85)); pool.rotation.x = -Math.PI / 2; pool.position.set(0.3, 0.02, 0.2); pool.renderOrder = 0.6; pool.scale.setScalar(1.3); g.add(pool);
    g.userData.light = { pos: new G.V3(0, 0.8, 0), color: col, intensity: 1.8, dist: 7 };
    return g;
  },
  graves(r = Math.random) {
    const g = new THREE.Group(), st = G.mat('col', { c: 0x7a776e, r: 0.95, t: 'rock' }), dirt = G.mat('col', { c: 0x2a2018, r: 1, t: 'rock' });
    const n = 2 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 1.2 + (r() - 0.5) * 0.3, z = (r() - 0.5) * 0.5, k = M.G(g, [x, 0, z], [(r() - 0.5) * 0.25, (r() - 0.5) * 0.4, (r() - 0.5) * 0.25]);
      const shape = M.ext('grave' + (i % 2), s => { s.moveTo(-0.3, 0); s.lineTo(-0.3, 0.6); if (i % 2) { s.lineTo(-0.1, 0.6); s.lineTo(-0.1, 0.85); s.lineTo(0.1, 0.85); s.lineTo(0.1, 0.6); s.lineTo(0.3, 0.6); } else s.quadraticCurveTo(0, 1.0, 0.3, 0.6); s.lineTo(0.3, 0); s.lineTo(-0.3, 0); }, 0.14, 0.02);
      M.P(k, shape, st, [0, 0, -0.07]);
      M.P(g, M.sph(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), dirt, [x, 0, z + 0.75], 0, [0.6, 0.25, 1.1]);
    }
    return g;
  },
  rubble(theme, r = Math.random) {
    const g = new THREE.Group(), st = theme === 'forge' ? G.mat('col', { c: 0x2a2220, r: 0.8, t: 'rock' }) : G.mat('col', { c: 0x8a8a84, r: 0.9, t: 'rock' });
    const col = M.cyl(0.28, 0.3, 1.6, 20); M.P(g, col, st, [0, 0.28, 0], [0, 0, Math.PI / 2 + (r() - 0.5) * 0.1], 1).rotation.y = r() * 3;
    M.P(g, M.cyl(0.3, 0.28, 0.7, 20), st, [1.2, 0.35, 0.4], [0, 0, 0.1]);
    for (let i = 0; i < 8; i++) M.P(g, M.rockGeo(0.1 + r() * 0.2, 0, 0.35, r), st, [(r() - 0.5) * 2.4, 0.06, (r() - 0.5) * 1.6]);
    return g;
  },
  cocoon(len = 1.5) {
    const g = new THREE.Group(), silk = G.mat('col', { c: 0xd8d4c8, r: 0.9, t: 'cloth' });
    M.P(g, M.cyl(0.006, 0.006, len, 3), silk, [0, -len / 2, 0]);
    const body = M.P(g, M.cap(0.22, 0.9, 6, 12), silk, [0, -len - 0.65, 0]);
    for (let i = 0; i < 5; i++) M.P(g, M.tor(0.215, 0.012, 4, 14), silk, [0, -len - 0.3 - i * 0.18, 0], [Math.PI / 2 + (i % 2 ? 0.2 : -0.2), 0, 0]);
    M.prop.skull(g, [0.02, -len - 0.2, 0.15], 0);
    g.userData.swing = g; return g;
  },
  eggs(r = Math.random) { const g = new THREE.Group(); for (let i = 0; i < 7; i++) M.P(g, M.sph(0.18 + r() * 0.1, 14, 10), G.mat('col', { c: 0xb0d080, r: 0.25, tr: 0.75, e: 0x40a040, ei: 0.8 }), [(r() - 0.5) * 0.9, 0.18, (r() - 0.5) * 0.9], 0, [1, 1.25, 1]); M.P(g, M.sph(0.7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), G.mat('col', { c: 0xd8d4c8, r: 1, tr: 0.35 }), [0, 0, 0], 0, [1, 0.5, 1]); g.userData.light = { pos: new G.V3(0, 0.5, 0), color: 0x80ff60, intensity: 1.0, dist: 5 }; return g; },
  totem() {
    const g = new THREE.Group(), w = G.mat('wood'), bone = G.mat('bone');
    M.P(g, M.cyl(0.08, 0.11, 2.6, 8), w, [0, 1.3, 0]);
    for (let i = 0; i < 3; i++) M.prop.skull(g, [0, 1.1 + i * 0.45, 0.08], 0);
    M.mirror(s => { M.P(g, M.cone(0.05, 0.5, 6), bone, [s * 0.25, 2.5, 0], [0, 0, -s * 1.0]); for (let k = 0; k < 3; k++) M.P(g, M.box(0.02, 0.35, 0.08), G.mat('col', { c: [0x8a2010, 0x204a8a, 0xd0a020][k], ds: true }), [s * 0.12, 0.85 - k * 0.1, 0.1], [0, 0, s * 0.3]); });
    M.P(g, M.lathe([0.05, 0, 0.16, 0.05, 0.2, 0.15, 0, 0.14], 12), G.mat('dark'), [0, 2.6, 0]); M.flame(g, 0.9, 0x60ff90).position.y = 2.72;
    g.userData.light = { pos: new G.V3(0, 2.9, 0), color: 0x60ff90, intensity: 1.6, dist: 8 };
    return g;
  },
  lanternPost() { const g = new THREE.Group(), w = G.mat('wood'); M.P(g, M.cyl(0.05, 0.06, 2.2, 8), w, [0, 1.1, 0]); M.P(g, M.box(0.6, 0.06, 0.06), w, [0.25, 2.15, 0]); M.P(g, M.cyl(0.005, 0.005, 0.3, 3), G.mat('dark'), [0.5, 2.0, 0]); M.P(g, M.box(0.16, 0.24, 0.16), G.mat('col', { c: 0xffd080, tr: 0.6, e: 0xffa040, ei: 1.5 }), [0.5, 1.75, 0]); M.P(g, M.cone(0.13, 0.1, 4), G.mat('dark'), [0.5, 1.92, 0], [0, Math.PI / 4, 0]); g.userData.light = { pos: new G.V3(0.5, 1.7, 0), color: 0xffa040, intensity: 1.6, dist: 8 }; return g; },
  impaled(r = Math.random) { const g = new THREE.Group(), ir = G.mat('col', { c: 0x15101a, r: 0.3, m: 0.7 }); for (let i = 0; i < 3; i++) { const x = (i - 1) * 0.5, h = 1.6 + r() * 0.8; M.P(g, M.cone(0.04, h, 6), ir, [x, h / 2, (r() - 0.5) * 0.3], [(r() - 0.5) * 0.15, 0, (r() - 0.5) * 0.15]); M.prop.skull(g, [x, h * 0.7, 0], r() * 6); } return g; },
  idol(theme) {
    const g = new THREE.Group(), st = G.mat('col', { c: theme === 'forge' ? 0x1e1616 : 0x5a564e, r: 0.85, t: 'rock' });
    M.P(g, M.box(1.3, 0.5, 0.9), st, [0, 0.25, 0]);
    const head = M.G(g, [0, 1.5, 0]); M.P(head, M.sph(0.6, 18, 14), st, [0, 0, 0], 0, [1, 1.15, 0.85]);
    M.mirror(s => { M.P(head, M.tube([s * 0.4, 0.35, 0, s * 0.75, 0.75, -0.1, s * 0.65, 1.2, -0.2], 0.09, 14, 8, 0.85), st); M.P(head, M.sph(0.08, 10, 8), G.mat('emissive', { c: theme === 'forge' ? 0xff3000 : 0x60ffa0, i: 4 }), [s * 0.2, 0.1, 0.48]); });
    M.P(head, M.box(0.5, 0.12, 0.3), G.mat('col', { c: 0x050404 }), [0, -0.3, 0.42]);
    for (let i = 0; i < 6; i++) M.P(head, M.cone(0.03, 0.12, 5), st, [-0.2 + i * 0.08, -0.22, 0.5], [Math.PI, 0, 0]);
    const c = M.prop.candles(5); c.position.set(0, 0.5, 0.25); c.scale.setScalar(0.8); g.add(c);
    g.userData.light = { pos: new G.V3(0, 1.6, 0.9), color: theme === 'forge' ? 0xff3000 : 0x60ffa0, intensity: 1.8, dist: 7 };
    return g;
  },
  skullBrazier() { const g = M.prop.brazier(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; M.prop.skull(g, [Math.cos(a) * 0.46, 1.05, Math.sin(a) * 0.46], -a + Math.PI / 2); } return g; },
  // a ledge of candles with wax running down the wall (faces +z)
  wallCandles(r = Math.random) {
    const g = new THREE.Group(), st = G.mat('col', { c: 0x6a665e, r: 0.95, t: 'rock' }), wax = G.mat('col', { c: 0xeee6c8, r: 0.6 });
    M.P(g, M.box(1.6, 0.1, 0.3), st, [0, 1.3, 0.15]);
    for (let i = 0; i < 9; i++) { const x = -0.7 + i * 0.175 + (r() - 0.5) * 0.05, h = 0.1 + r() * 0.3; M.P(g, M.cyl(0.025, 0.028, h, 10), wax, [x, 1.35 + h / 2, 0.15 + (r() - 0.5) * 0.12]); if (r() < 0.75) M.flame(g, 0.24).position.set(x, 1.36 + h, 0.15); if (r() < 0.6) M.P(g, M.cyl(0.012, 0.004, 0.2 + r() * 0.5, 5), wax, [x, 1.2 - r() * 0.2, 0.31]); }
    M.prop.skull(g, [0.55, 1.43, 0.15], 0.3);
    g.userData.light = { pos: new G.V3(0, 1.8, 0.5), color: 0xffb060, intensity: 1.5, dist: 6 };
    return g;
  },
  // glowing lava fissure on the floor
  lavaCrack(len = 2.5) { const m = new THREE.Mesh(G.fx._dg || (G.fx._dg = new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ map: G.tex.sprite('crack'), color: 0xff5010, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = 0.025; m.renderOrder = 0.55; m.scale.set(len, len * 0.6, 1); m.userData.dynamic = true; return m; },
  gargoyleStatue(theme) { const s = M.prop.statue(theme); return s; }
};
function r8(i) { return i / 8 * Math.PI * 2; }

/* ---------- Shrine of Returning: brings a fallen ally back once ---------- */
M.amb.reviveShrine = () => {
  const g = new THREE.Group(), st = G.mat('col', { c: 0xb8b0a0, r: 0.8, t: 'rock' }), gold = G.mat('gold');
  M.P(g, M.cyl(1.3, 1.45, 0.25, 32), st, [0, 0.12, 0]); M.P(g, M.cyl(1.0, 1.1, 0.2, 32), st, [0, 0.35, 0]);
  M.P(g, M.box(0.5, 2.2, 0.5), st, [0, 1.55, 0]); M.P(g, M.cone(0.42, 0.5, 4), st, [0, 2.9, 0], [0, Math.PI / 4, 0]);
  // the ankh of returning, glowing gold
  const ankh = M.G(g, [0, 1.85, 0.27]);
  M.P(ankh, M.tor(0.13, 0.035, 10, 24), gold, [0, 0.35, 0]); M.P(ankh, M.box(0.07, 0.55, 0.06), gold, [0, -0.05, 0]); M.P(ankh, M.box(0.42, 0.07, 0.06), gold, [0, 0.17, 0]);
  const core = M.P(ankh, M.sph(0.06, 12, 8), G.mat('emissive', { c: 0xffe08a, i: 4 }), [0, 0.35, 0.03]);
  M.mirror(s => { const w = M.G(g, [s * 0.28, 2.0, 0]); for (let i = 0; i < 5; i++) M.P(w, M.box(0.08, 0.5 - i * 0.07, 0.03), G.mat('col', { c: 0xeee8d8, r: 0.6 }), [s * (0.08 + i * 0.09), -i * 0.06, 0], [0, 0, s * (0.5 + i * 0.12)]); });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.tex.sprite('glow'), color: 0xffd070, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); halo.scale.setScalar(2.6); halo.position.set(0, 2.2, 0.3); g.add(halo);
  const ring = new THREE.Mesh(G.fx._dg || (G.fx._dg = new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ map: G.tex.sprite('rune'), color: 0xffd070, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.47; ring.scale.setScalar(2.2); ring.renderOrder = 0.7; g.add(ring);
  g.userData.halo = halo; g.userData.ring = ring; g.userData.core = core;
  g.userData.light = { pos: new G.V3(0, 2.2, 0.6), color: 0xffd070, intensity: 2.6, dist: 10 };
  return g;
};

/* ---------- polished loot: faceted gems, settings, filigree ---------- */
M.gemGeo = (cut = 0) => gk('gemcut' + cut, () => {
  const pts = cut ? [0, -0.11, 0.05, -0.04, 0.062, 0.0, 0.05, 0.05, 0, 0.11] : [0, 0, 0.078, 0.075, 0.1, 0.095, 0.1, 0.105, 0.072, 0.14, 0, 0.15];
  const v = []; for (let i = 0; i < pts.length; i += 2) v.push(new THREE.Vector2(pts[i], pts[i + 1]));
  const g = new THREE.LatheGeometry(v, cut ? 6 : 10).toNonIndexed(); g.computeVertexNormals(); return g;   // flat facets
});
M.gemMat = c => G.mat('col', { c, r: 0.04, m: 0.2, e: c, ei: 0.5, tr: 0.88 });
(() => {
  const gold = () => G.mat('gold'), rnd = G.mulberry ? G.mulberry(77) : Math.random;
  Object.assign(M.loot, {
    gem(v = 0) { const g = new THREE.Group(), c = [0xff2a4a, 0x2aa0ff, 0x30ff70, 0xc040ff][v % 4]; M.P(g, M.gemGeo(0), M.gemMat(c), [0, 0.02, 0], [0, 0.3, 0], [1.1, 1.1, 1.1]); M.P(g, M.gemGeo(1), M.gemMat(c), [0.12, 0.05, 0.04], [0.5, 0, 0.9], 0.45); return g; },
    idol(v = 0) { const g = new THREE.Group(), m = gold();
      M.P(g, M.cyl(0.1, 0.11, 0.035, 8), G.mat('dark'), [0, 0.018, 0]); M.P(g, M.cyl(0.085, 0.095, 0.04, 8), m, [0, 0.055, 0]);
      M.P(g, M.sculpt('idolBody', [[0.0, 0.07, 0.06, 0, 2.2], [0.04, 0.085, 0.072, 0.005, 2.2], [0.1, 0.075, 0.06, 0.01, 2.2], [0.15, 0.05, 0.045, 0, 2], [0.17, 0.03, 0.03, 0, 2]], 24, 4), m, [0, 0.075, 0]);
      M.P(g, M.sph(0.055, 20, 16), m, [0, 0.29, 0.005], 0, [1, 1.05, 0.95]);
      M.mirror(s => { M.P(g, M.sph(0.022, 10, 8), m, [s * 0.055, 0.29, -0.005], 0, [0.5, 1.2, 0.8]); M.P(g, M.tube([s * 0.075, 0.22, 0, s * 0.07, 0.16, 0.05, s * 0.01, 0.15, 0.08], 0.016, 12, 6), m); M.P(g, M.oct(0.011), G.mat('col', { c: 0xff2020, e: 0xff0000, ei: 1.5 }), [s * 0.02, 0.3, 0.05]); });
      M.P(g, M.cone(0.05, 0.08, 12), m, [0, 0.36, -0.005]); M.P(g, M.sph(0.013, 8, 6), m, [0, 0.405, -0.005]); return g; },
    chalice(v = 0) { const g = new THREE.Group(), m = v ? gold() : G.mat('col', { c: 0xc0c0c8, m: 1, r: 0.2 });
      M.P(g, M.lathe(M.profile([[0, 0], [0.085, 0.004], [0.088, 0.016], [0.05, 0.03], [0.022, 0.06], [0.018, 0.12], [0.03, 0.15], [0.07, 0.19], [0.095, 0.25], [0.1, 0.32], [0.094, 0.322], [0.088, 0.26], [0.0, 0.2]], 3), 32), m);
      M.P(g, M.tor(0.024, 0.009, 8, 20), m, [0, 0.1, 0], [Math.PI / 2, 0, 0]); M.P(g, M.tor(0.097, 0.005, 6, 32), m, [0, 0.27, 0], [Math.PI / 2, 0, 0]);
      for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; M.P(g, M.gemGeo(1), M.gemMat([0xff2040, 0x2080ff, 0x30d060][i]), [Math.sin(a) * 0.088, 0.23, Math.cos(a) * 0.088], [Math.PI / 2, a, 0], 0.22); }
      return g; },
    coins() { const g = new THREE.Group(), m = gold(), r = G.mulberry ? G.mulberry(9) : Math.random;
      for (let i = 0; i < 14; i++) { const c = M.G(g, [(r() - 0.5) * 0.16 * (1 - i / 16), 0.006 + Math.min(i, 9) * 0.011, (r() - 0.5) * 0.16 * (1 - i / 16)], [r() * 0.25, r() * 6, r() * 0.25]); M.P(c, M.cyl(0.042, 0.042, 0.01, 20), m); M.P(c, M.tor(0.04, 0.003, 4, 20), m, [0, 0, 0], [Math.PI / 2, 0, 0], [1, 1, 1]); M.P(c, M.cyl(0.022, 0.022, 0.012, 6), m); }
      const st = M.G(g, [0.1, 0.045, 0.02], [0.2, 0.6, Math.PI / 2 - 0.25]); M.P(st, M.cyl(0.042, 0.042, 0.01, 20), m); return g; },
    potion(v = 0) { const g = new THREE.Group(), c = [0xff2a2a, 0x2a6aff, 0x40ff60][v % 3];
      M.P(g, M.lathe(M.profile([[0.0, 0.0], [0.07, 0.004], [0.095, 0.05], [0.098, 0.1], [0.08, 0.15], [0.032, 0.185], [0.026, 0.22], [0.03, 0.255], [0.035, 0.26]], 3), 28), G.mat('col', { c: 0xeef8ff, tr: 0.35, r: 0.04, ds: true }));
      M.P(g, M.lathe(M.profile([[0.0, 0.008], [0.064, 0.012], [0.088, 0.05], [0.09, 0.1], [0.075, 0.13], [0, 0.132]], 3), 24), G.mat('col', { c, e: c, ei: 0.7, tr: 0.85 }));
      M.P(g, M.cyl(0.029, 0.025, 0.05, 12), G.mat('wood'), [0, 0.27, 0]); M.P(g, M.sph(0.03, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), G.mat('col', { c: 0x8a1010, r: 0.4 }), [0, 0.292, 0], 0, [1, 0.6, 1]);
      M.P(g, M.tor(0.028, 0.004, 5, 18), G.mat('col', { c: 0xc8b080, t: 'cloth' }), [0, 0.215, 0], [Math.PI / 2, 0, 0]);
      M.P(g, M.bend('plabel', M.box(0.09, 0.06, 0.003, 6, 1, 1), 5), G.mat('col', { c: 0xe0d0a8, r: 0.9 }), [0, 0.09, 0.096]); return g; },
    scroll() { const g = new THREE.Group(), paper = G.mat('col', { c: 0xa8987a, r: 0.95, ds: true });
      M.P(g, M.cyl(0.042, 0.042, 0.28, 20), paper, [0, 0.05, 0], [0, 0, Math.PI / 2]);
      M.P(g, M.bend('scrflap', M.box(0.26, 0.004, 0.14, 1, 1, 6), 0), paper, [0, 0.01, 0.1], [0.12, 0, 0]);
      M.mirror(s => { M.P(g, M.cyl(0.014, 0.014, 0.05, 10), G.mat('wood'), [s * 0.16, 0.05, 0], [0, 0, Math.PI / 2]); M.P(g, M.sph(0.022, 12, 8), G.mat('wood'), [s * 0.19, 0.05, 0]); });
      M.P(g, M.tor(0.044, 0.006, 6, 20), G.mat('col', { c: 0xa01010, t: 'cloth' }), [0, 0.05, 0], [0, Math.PI / 2, 0]);
      M.P(g, M.cyl(0.02, 0.022, 0.008, 14), G.mat('col', { c: 0x8a0a0a, r: 0.35 }), [0, 0.05, 0.046], [Math.PI / 2, 0, 0]); return g; },
    crown() { const g = new THREE.Group(), m = gold();
      M.P(g, M.lathe(M.profile([[0.115, 0], [0.12, 0.012], [0.116, 0.07], [0.124, 0.08], [0.118, 0.085]], 2), 40), m);
      M.P(g, M.sph(0.112, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2.4), G.mat('col', { c: 0x6a0a1a, t: 'cloth', r: 0.9 }), [0, 0.02, 0]);
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, tall = i % 2 === 0;
        const p = M.G(g, [Math.sin(a) * 0.12, 0.08, Math.cos(a) * 0.12], [0, a, 0]);
        M.P(p, M.ext('crownpt' + tall, s => { const h = tall ? 0.09 : 0.05; s.moveTo(-0.035, 0); s.quadraticCurveTo(-0.01, h * 0.4, 0, h); s.quadraticCurveTo(0.01, h * 0.4, 0.035, 0); s.lineTo(-0.035, 0); }, 0.008, 0.003), m, [0, 0, 0], [-0.08, 0, 0]);
        M.P(p, M.sph(0.012, 10, 8), m, [0, tall ? 0.095 : 0.055, -0.004]);
        M.P(g, M.gemGeo(1), M.gemMat([0xff2040, 0x2080ff][i % 2]), [Math.sin(a) * 0.123, 0.042, Math.cos(a) * 0.123], [Math.PI / 2, a, 0], 0.24); }
      M.P(g, M.sph(0.018, 10, 8), m, [0, 0.135, 0]); return g; },
    relic() { const g = new THREE.Group(), m = gold();
      M.P(g, M.lathe(M.profile([[0, 0], [0.09, 0.0], [0.09, 0.02], [0.06, 0.035], [0.03, 0.07], [0.055, 0.095], [0.0, 0.1]], 3), 28), m);
      M.P(g, M.skullGeo(), G.mat('bone'), [0, 0.165, 0], 0, 0.85);
      M.mirror(s => M.P(g, M.sph(0.02, 12, 10), G.mat('col', { c: 0x050404 }), [s * 0.026, 0.159, 0.071], 0, [1, 0.95, 0.6]));
      M.P(g, M.band(0.07, 0.085, 0.016, 0, 2), m, [0, 0.19, 0]);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; M.P(g, M.cone(0.009, 0.03, 6), m, [Math.sin(a) * 0.065, 0.21, Math.cos(a) * 0.08]); }
      return g; },
    ring(v = 0) { const g = new THREE.Group(), m = gold();
      M.P(g, M.tor(0.055, 0.011, 12, 36), m, [0, 0.07, 0]);
      M.P(g, M.cyl(0.022, 0.016, 0.018, 16), m, [0, 0.132, 0]);
      for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.78; M.P(g, M.cyl(0.003, 0.003, 0.025, 4), m, [Math.cos(a) * 0.019, 0.148, Math.sin(a) * 0.019], [Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4]); }
      M.P(g, M.gemGeo(0), M.gemMat(0x30ff90), [0, 0.13, 0], 0, 0.22); return g; },
    backpack() { const g = new THREE.Group(), l = G.mat('leather'), dl = G.mat('darkleather');
      M.P(g, M.sculpt('pack', [[-0.22, 0.14, 0.08, 0, 3], [-0.18, 0.18, 0.1, 0, 3.2], [0.1, 0.18, 0.1, 0, 3.2], [0.2, 0.16, 0.09, 0, 3], [0.23, 0.1, 0.06, 0, 2.6]], 28, 3), l);
      M.P(g, M.bend('packflap', M.box(0.33, 0.2, 0.012, 6, 4, 1), 1.2), dl, [0, 0.12, -0.105], [0.15, Math.PI, 0]);
      M.P(g, M.box(0.27, 0.14, 0.06), l, [0, -0.09, -0.12]);
      M.mirror(s => { M.P(g, M.box(0.03, 0.4, 0.008), dl, [s * 0.08, 0.0, -0.165]); M.P(g, M.box(0.035, 0.03, 0.012), gold(), [s * 0.08, 0.02, -0.17]); M.P(g, M.box(0.04, 0.42, 0.012), dl, [s * 0.09, 0.0, 0.1]); });
      M.P(g, M.cyl(0.085, 0.085, 0.38, 18), G.mat('col', { c: 0x6a4a2a, t: 'cloth' }), [0, 0.3, 0], [0, 0, Math.PI / 2]);
      M.mirror(s => M.P(g, M.tor(0.087, 0.008, 6, 20), dl, [s * 0.1, 0.3, 0], [0, Math.PI / 2, 0]));
      M.P(g, M.box(0.04, 0.05, 0.02), gold(), [0, -0.0, -0.155]); return g; }
  });
  M.loot.key = () => { const g = new THREE.Group(), m = gold();
    M.P(g, M.tor(0.048, 0.011, 10, 28), m, [0, 0.13, 0]);
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; M.P(g, M.tor(0.016, 0.005, 6, 14), m, [Math.cos(a) * 0.022, 0.13 + Math.sin(a) * 0.022, 0]); }
    M.P(g, M.cyl(0.011, 0.011, 0.19, 12), m, [0, -0.005, 0]);
    for (let i = 0; i < 2; i++) M.P(g, M.tor(0.014, 0.004, 6, 14), m, [0, 0.07 - i * 0.022, 0], [Math.PI / 2, 0, 0]);
    M.P(g, M.box(0.055, 0.026, 0.01), m, [0.03, -0.075, 0]); M.P(g, M.box(0.012, 0.016, 0.01), m, [0.048, -0.093, 0]); M.P(g, M.box(0.012, 0.012, 0.01), m, [0.024, -0.091, 0]);
    M.P(g, M.box(0.04, 0.02, 0.01), m, [0.022, -0.042, 0]);
    M.P(g, M.gemGeo(1), M.gemMat(0xff3040), [0, 0.13, 0], [Math.PI / 2, 0, 0], 0.24); return g; };
  M.loot.amulet = () => { const g = new THREE.Group(), m = gold();
    M.P(g, M.tor(0.075, 0.004, 4, 40, Math.PI * 1.6), m, [0, 0.13, 0], [0, 0, -Math.PI * 0.3]);
    M.P(g, M.cyl(0.042, 0.042, 0.012, 24), m, [0, 0.04, 0], [Math.PI / 2, 0, 0]);
    M.P(g, M.tor(0.042, 0.005, 6, 28), m, [0, 0.04, 0.004]);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; M.P(g, M.sph(0.007, 6, 5), m, [Math.cos(a) * 0.05, 0.04 + Math.sin(a) * 0.05, 0.004]); }
    M.P(g, M.sph(0.03, 18, 12), M.gemMat(0x9a40ff), [0, 0.04, 0.008], 0, [1, 1, 0.55]);
    M.P(g, M.tor(0.008, 0.003, 5, 10), m, [0, 0.087, 0], [0, Math.PI / 2, 0]); return g; };
  M.loot.cloak = () => { const g = new THREE.Group(), cl = G.mat('col', { c: 0x3a2a6a, t: 'cloth', ds: true });
    M.P(g, M.drape('lootcloak', [[0.0, 0.17, 0.11, 0, 2.2], [0.12, 0.14, 0.09, 0, 2.2], [0.26, 0.09, 0.06, 0, 2.1], [0.32, 0.05, 0.04, 0, 2]], 10, 0.12, 0, 36), cl);
    M.P(g, M.sph(0.075, 18, 12, Math.PI / 2 + 0.9, Math.PI * 2 - 1.8, 0, Math.PI * 0.6), cl, [0, 0.33, -0.02], 0, [1, 1, 1.1]);
    M.P(g, M.drapeHem('lootcloak', 1, 0.004), G.mat('col', { c: 0xd8b04a, m: 0.6, r: 0.4 }));
    M.mirror(s => M.P(g, M.cyl(0.018, 0.018, 0.008, 14), gold(), [s * 0.03, 0.29, 0.055], [Math.PI / 2, 0, 0])); return g; };
  M.loot.gauntlets = () => { const g = new THREE.Group(), iron = G.mat('iron'), st = G.mat('steel');
    M.mirror(s => { const h = M.G(g, [s * 0.075, 0, 0], [0, s * 0.25, s * 0.08]);
      M.P(h, M.cyl(0.058, 0.044, 0.1, 18, 1, true), iron, [0, 0.06, 0]); M.P(h, M.tor(0.057, 0.005, 6, 20), st, [0, 0.11, 0], [Math.PI / 2, 0, 0]);
      M.P(h, M.sculpt('gauntback', [[0, 0.042, 0.028, 0, 2.6], [0.05, 0.046, 0.026, 0.004, 2.8], [0.08, 0.042, 0.02, 0.006, 2.6]], 18, 3), iron, [0, 0.105, 0.01]);
      for (let f = 0; f < 4; f++) { const fg = M.G(h, [(f - 1.5) * 0.02, 0.19, 0.012], [0.4, 0, 0]); for (let k = 0; k < 3; k++) M.P(fg, M.cap(0.009, 0.014, 3, 8), k % 2 ? st : iron, [0, k * 0.022, k * 0.006]); }
      M.P(h, M.cap(0.01, 0.025, 3, 8), iron, [s * -0.045, 0.16, 0.02], [0, 0, s * 0.8]); });
    return g; };
  M.loot.boots = () => { const g = new THREE.Group(), l = G.mat('leather'), dl = G.mat('darkleather');
    M.mirror(s => { M.P(g, M.sculpt('lootboot', [[0, 0.048, 0.055, 0, 2.2], [0.09, 0.044, 0.05, -0.004, 2.2], [0.17, 0.052, 0.056, -0.006, 2.2]], 20, 3, 0), l, [s * 0.07, 0.03, 0]); M.P(g, M.bootGeo(), l, [s * 0.07, 0.02, 0.02], 0, 0.9);
      M.P(g, M.band(0.058, 0.062, 0.035, -0.006, 2), dl, [s * 0.07, 0.205, 0]); M.P(g, M.band(0.05, 0.056, 0.014, -0.004, 2), dl, [s * 0.07, 0.11, 0]); M.P(g, M.box(0.02, 0.018, 0.01), gold(), [s * 0.07, 0.11, 0.055]);
      M.P(g, M.ext('bootwing', w => { w.moveTo(0, 0); w.quadraticCurveTo(0.03, 0.05, 0.09, 0.07); w.quadraticCurveTo(0.06, 0.03, 0.08, 0.015); w.quadraticCurveTo(0.04, 0.01, 0, 0); }, 0.004, 0.002), gold(), [s * 0.12, 0.17, -0.02], [0, s > 0 ? -0.3 : Math.PI + 0.3, 0]); });
    return g; };
  M.loot.circlet = () => { const g = new THREE.Group(), m = gold();
    M.P(g, M.band(0.1, 0.11, 0.016, 0, 2), m, [0, 0.06, 0]);
    M.P(g, M.ext('circletpt', s => { s.moveTo(-0.04, 0); s.quadraticCurveTo(-0.012, 0.012, 0, 0.05); s.quadraticCurveTo(0.012, 0.012, 0.04, 0); s.lineTo(-0.04, 0); }, 0.005, 0.002), m, [0, 0.066, 0.108]);
    M.mirror(s => M.P(g, M.tube([s * 0.012, 0.06, 0.11, s * 0.04, 0.075, 0.1, s * 0.07, 0.065, 0.075], 0.004, 10, 5), m));
    M.P(g, M.gemGeo(1), M.gemMat(0x40c0ff), [0, 0.085, 0.114], [Math.PI / 2, 0, 0], 0.3); return g; };
})();
