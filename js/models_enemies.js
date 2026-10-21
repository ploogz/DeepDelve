/* ============================================================
   Enemy & boss models — 15 monsters + 6 bosses
   ============================================================ */
'use strict';
M.hideBase = R => { R.root.traverse(o => { if (o.isMesh) o.visible = false; }); };

/* ---------- skeleton family ---------- */
// skull: long cranium, narrowed face, flat skull base
M.skullGeo = () => gk('skull', () => {
  const g = new THREE.SphereGeometry(0.1, seg(34), seg(26)), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    x *= 0.74; y *= 0.88; z *= z > 0 ? 0.92 : 1.04;
    if (y < 0) { const k = G.clamp(-y / 0.088, 0, 1); if (z > 0) { x *= 1 - 0.32 * k; z += 0.012 * k; } else y = Math.max(y, -0.028 - z * 0.25); }
    if (Math.abs(x) > 0.05 && y > -0.02 && y < 0.04) x *= 0.95;
    if (z > 0.05 && y > 0.0 && y < 0.03) z += 0.004;   // brow ridge
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals(); return g;
});
// long bone: knobbed ends, slim shaft
M.boneGeo = (len, r) => M.lathe(M.profile([[0, -len - r * 1.2], [r * 1.5, -len - r * 0.6], [r * 1.25, -len + r * 0.8], [r * 0.9, -len * 0.8], [r, -len * 0.5], [r * 0.95, -len * 0.2], [r * 1.35, -r * 0.6], [r * 1.6, 0], [0, r * 1.5]], 3), 14);
M.skeleton = (o = {}) => {
  const R = M.humanoid({ bulk: o.bulk || 0.9, noHead: true }); M.hideBase(R);
  const bone = o.bone || G.mat('bone'), dark = G.mat('col', { c: 0x050404, r: 1 }), eye = G.mat('emissive', { c: o.eye || 0x40e0ff, i: 4 }), tooth = G.mat('col', { c: 0xf0ead6, r: 0.4 });
  const b = o.bulk || 0.9;
  // skull
  M.P(R.head, M.skullGeo(), bone, [0, 0.13, -0.005]);
  M.mirror(s => {
    M.P(R.head, M.sph(0.026, 16, 12), dark, [s * 0.031, 0.123, 0.068], 0, [1, 0.95, 0.65]);
    M.P(R.head, M.sph(0.009, 10, 8), eye, [s * 0.031, 0.122, 0.074]);
    M.P(R.head, M.cap(0.01, 0.04, 4, 8), bone, [s * 0.055, 0.1, 0.035], [0.15, s * -0.35, Math.PI / 2]);   // cheekbones
  });
  M.P(R.head, M.cone(0.014, 0.034, 3), dark, [0, 0.092, 0.084], [Math.PI + 0.25, 0, 0]);
  for (let i = 0; i < 8; i++) { const a = -0.82 + i * 0.235; M.P(R.head, M.box(0.011, 0.017, 0.008), tooth, [Math.sin(a) * 0.04, 0.062, Math.cos(a) * 0.052 + 0.024], [0, a, 0]); }
  R.jaw = M.G(R.head, [0, 0.075, -0.005]);
  M.P(R.jaw, M.tube([-0.05, 0.012, -0.03, -0.046, -0.025, 0.02, -0.024, -0.036, 0.064, 0, -0.038, 0.074, 0.024, -0.036, 0.064, 0.046, -0.025, 0.02, 0.05, 0.012, -0.03], 0.011, 28, 8), bone);
  M.P(R.jaw, M.sph(0.016, 10, 8), bone, [0, -0.034, 0.072], 0, [1.4, 1, 0.8]);
  for (let i = 0; i < 8; i++) { const a = -0.8 + i * 0.23; M.P(R.jaw, M.box(0.01, 0.016, 0.008), tooth, [Math.sin(a) * 0.038, -0.018, Math.cos(a) * 0.048 + 0.022], [0, a, 0]); }
  // neck & spine
  for (let i = 0; i < 4; i++) M.P(R.neck, M.cyl(0.02, 0.022, 0.018, 10), bone, [0, -0.02 + i * 0.03, -0.015]);
  for (let i = 0; i < 9; i++) { const y = -0.06 + i * 0.055; M.P(R.torso, M.cyl(0.026, 0.028, 0.03, 12), bone, [0, y, -0.06 + Math.sin(i * 0.4) * 0.012]); M.P(R.torso, M.box(0.012, 0.026, 0.035), bone, [0, y - 0.006, -0.088 + Math.sin(i * 0.4) * 0.012], [0.4, 0, 0]); }
  // rib cage: curved ribs from spine to sternum, sternum, clavicles, shoulder blades
  for (let i = 0; i < 6; i++) { const y = 0.17 - i * 0.05, w = (0.11 + Math.min(i, 3) * 0.012) * b, f = i < 5 ? 1 : 0.6;
    M.mirror(s => M.P(R.chest, M.tube([s * 0.02, y, -0.07, s * w * 0.95, y - 0.012, -0.045, s * w, y - 0.035, 0.03, s * w * 0.6 * f, y - 0.055, 0.1 * f, s * 0.025, y - 0.06, 0.11 * f], 0.0095, 22, 6), bone)); }
  M.P(R.chest, M.box(0.034, 0.2, 0.016), bone, [0, 0.05, 0.112], [-0.12, 0, 0]);
  M.mirror(s => {
    M.P(R.chest, M.tube([s * 0.02, 0.195, 0.1, s * 0.1, 0.205, 0.07, s * 0.19 * b, 0.18, 0.0], 0.011, 14, 6), bone);
    M.P(R.chest, M.ext('scapula', sh => { sh.moveTo(0, 0); sh.lineTo(0.09, 0.03); sh.lineTo(0.06, -0.12); sh.lineTo(0, 0); }, 0.008, 0.004), bone, [s * 0.04, 0.17, -0.1], [0.15, s > 0 ? 0 : Math.PI, 0]);
  });
  // pelvis: iliac bowls, sacrum, pubic arch
  M.mirror(s => M.P(R.hips, M.sph(0.075, 18, 12, 0, Math.PI, 0, Math.PI / 2), bone, [s * 0.065, 0.02, -0.01], [Math.PI, s * 0.6 + Math.PI / 2, 0], [1, 0.9, 0.5]));
  M.P(R.hips, M.box(0.05, 0.1, 0.03), bone, [0, -0.02, -0.07], [0.3, 0, 0]);
  M.P(R.hips, M.tube([-0.09, -0.04, 0.0, -0.05, -0.07, 0.06, 0, -0.08, 0.075, 0.05, -0.07, 0.06, 0.09, -0.04, 0.0], 0.013, 20, 6), bone);
  // limbs: humerus, radius+ulna, femur, kneecap, tibia+fibula, hands and feet
  [R.armL, R.armR].forEach((A, i) => { const s = i ? -1 : 1;
    M.P(A.sh, M.boneGeo(0.29, 0.016), bone, [0, -0.005, 0]);
    M.P(A.el, M.boneGeo(0.26, 0.011), bone, [0.012, -0.005, 0]); M.P(A.el, M.boneGeo(0.26, 0.009), bone, [-0.012, -0.005, -0.006]);
    M.P(A.hand, M.box(0.05, 0.05, 0.014), bone, [0, -0.02, 0]);
    for (let f = 0; f < 4; f++) { const fg = M.G(A.hand, [(f - 1.5) * 0.014, -0.045, 0.004], [-0.6, 0, 0]); M.P(fg, M.cyl(0.0055, 0.005, 0.034, 6), bone, [0, -0.017, 0]); const f2 = M.G(fg, [0, -0.034, 0], [-0.7, 0, 0]); M.P(f2, M.cyl(0.005, 0.004, 0.026, 6), bone, [0, -0.013, 0]); }
    const th = M.G(A.hand, [s * -0.028, -0.012, 0.01], [-0.5, 0, s * 0.6]); M.P(th, M.cyl(0.006, 0.005, 0.04, 6), bone, [0, -0.02, 0]); });
  [R.legL, R.legR].forEach(L => {
    M.P(L.hip, M.boneGeo(0.42, 0.02), bone, [0, -0.01, 0]);
    M.P(L.kn, M.sph(0.024, 12, 10), bone, [0, 0.0, 0.03], 0, [1, 1.2, 0.7]);
    M.P(L.kn, M.boneGeo(0.4, 0.016), bone, [0, -0.01, 0.004]); M.P(L.kn, M.boneGeo(0.38, 0.008), bone, [0.022, -0.02, -0.008]);
    M.P(L.foot, M.box(0.06, 0.03, 0.08), bone, [0, -0.018, 0.0]);
    for (let t = 0; t < 4; t++) M.P(L.foot, M.cyl(0.007, 0.006, 0.07, 6), bone, [(t - 1.5) * 0.015, -0.03, 0.07], [Math.PI / 2, 0, 0]);
  });
  R.boneMat = bone; return R;
};

/* ---------- builders keyed by enemy type ---------- */
M.enemy = {
  skeleton(tier) {
    const R = M.skeleton();
    // rusty half-helm, sword, round shield
    const rust = G.mat('col', { c: 0x6a5a48, m: 0.7, r: 0.6 });
    M.P(R.head, M.sph(0.1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2.1), rust, [0, 0.14, -0.006], 0, [0.86, 1, 1.08]);
    M.P(R.head, M.band(0.088, 0.11, 0.018, -0.006, 2), rust, [0, 0.146, 0]);
    M.P(R.head, M.box(0.016, 0.075, 0.016), rust, [0, 0.13, 0.104]);
    M.P(R.head, M.tube([0, 0.24, 0.07, 0, 0.25, -0.02, 0, 0.23, -0.1], 0.008, 10, 5), rust);
    const w = M.weapon.sword(0, 0.7); w.rotation.set(1.0, 0, 0); R.armR.hand.add(w); R.weapon = w;
    const sh = M.G(R.armL.el, [0.08, -0.15, 0.03], [0, Math.PI / 2, 0]);
    M.P(sh, M.cyl(0.24, 0.24, 0.03, 32), G.mat('wood'), [0, 0, 0], [Math.PI / 2, 0, 0]);
    M.P(sh, M.tor(0.24, 0.015, 8, 32), G.mat('col', { c: 0x5a4a3a, m: 0.8, r: 0.6 }));
    M.P(sh, M.sph(0.06, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), G.mat('iron'), [0, 0, 0.015], [Math.PI / 2, 0, 0]);
    M.P(sh, M.box(0.03, 0.2, 0.01), G.mat('col', { c: 0x2a2018 }), [0.08, 0.05, 0.02], [0, 0, 0.4]); // crack
    return R;
  },
  skelarcher() {
    const R = M.skeleton({ eye: 0x7aff6a });
    M.hood(R.head, G.mat('col', { c: 0x3a3428, t: 'cloth', ds: true }), 0.125, true);
    for (let i = 0; i < 6; i++) M.P(R.chest, M.box(0.06, 0.25 + (i % 3) * 0.08, 0.01), G.mat('col', { c: 0x3a3428, t: 'cloth', ds: true }), [-0.15 + i * 0.06, -0.05, -0.12], [0.1, 0, (i - 3) * 0.05]);
    const bow = M.weapon.bow(0); bow.rotation.set(Math.PI / 2, Math.PI, 0); bow.position.set(0, -0.04, 0); R.armL.hand.add(bow); R.weapon = bow; R.bow = bow;
    R.armPose = (R, st) => { if (!(st.atk >= 0)) { R.armL.sh.rotation.x -= 0.3; R.armL.el.rotation.x = -1.1; } };
    const q = M.G(R.chest, [0.06, 0.05, -0.15], [0.2, 0, -0.4]); M.P(q, M.cyl(0.05, 0.045, 0.45, 14, 1, true), G.mat('darkleather'));
    for (let i = 0; i < 5; i++) { const a = M.weapon.arrow(0); a.rotation.set(-Math.PI / 2, 0, 0); a.position.set(Math.cos(i * 1.3) * 0.02, 0.2, Math.sin(i * 1.3) * 0.02); q.add(a); }
    return R;
  },
  zombie() {
    const skin = G.mat('col', { c: 0x7a9068, r: 0.85, t: 'skin' });
    const R = M.humanoid({ skin, top: G.mat('col', { c: 0x5a4a3a, t: 'cloth', r: 1, ds: true }), bottom: G.mat('col', { c: 0x3a3a4a, t: 'cloth' }), bulk: 1.1, eye: 0xd0d020, eyeGlow: 0x504000, brow: 0x303020 });
    R.jaw = M.G(R.head, [0, 0.03, 0.03]); M.P(R.jaw, M.sph(0.08, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), skin, [0, 0, 0.02], 0, [1, 0.7, 1.1]);
    // exposed ribs & wounds
    for (let i = 0; i < 4; i++) M.P(R.chest, M.tor(0.07, 0.01, 6, 14, Math.PI), G.mat('bone'), [0.1, 0.05 - i * 0.04, 0.152], [0, 0.4, Math.PI]);
    M.P(R.chest, M.sph(0.08, 16, 12), G.mat('col', { c: 0x4a0a0a, r: 0.4 }), [0.1, 0, 0.12], 0, [1, 1.3, 0.4]);
    M.P(R.head, M.sph(0.03, 12, 8), G.mat('col', { c: 0x5a1010, r: 0.3 }), [-0.07, 0.17, 0.09]);
    // torn shirt strips
    for (let i = 0; i < 7; i++) M.P(R.torso, M.box(0.05, 0.15 + (i % 3) * 0.06, 0.01), G.mat('col', { c: 0x5a4a3a, t: 'cloth', ds: true }), [-0.15 + i * 0.05, -0.05, 0.126], [0.1, 0, (i % 2 - 0.5) * 0.3]);
    R.armPose = (R, st) => { R.armL.sh.rotation.x = -1.4 + Math.sin(st.t * 2) * 0.1; R.armR.sh.rotation.x = -1.2 + Math.sin(st.t * 2 + 1) * 0.1; R.torso.rotation.x += 0.25; R.neck.rotation.z = 0.3; };
    return R;
  },
  ghoul() {
    const skin = G.mat('col', { c: 0xb0b0a0, r: 0.6, t: 'skin' });
    const R = M.humanoid({ skin, top: skin, bottom: G.mat('col', { c: 0x2a2a20, t: 'cloth' }), bulk: 0.82, eye: 0xff3010, eyeGlow: 0xff2000, noEars: true, brow: 0x606050 });
    R.head.scale.set(1.1, 1, 1.2);
    R.jaw = M.G(R.head, [0, 0.04, 0.03]); M.P(R.jaw, M.sph(0.085, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), skin, [0, 0, 0.03], 0, [1, 0.8, 1.3]);
    for (let i = 0; i < 10; i++) M.P(R.jaw, M.cone(0.007, 0.03, 4), G.mat('col', { c: 0xe0d8b0 }), [-0.05 + i * 0.011, 0.012, 0.1 - Math.abs(i - 4.5) * 0.008]);
    M.mirror(s => M.P(R.head, M.tube([s * 0.095, 0.11, -0.01, s * 0.15, 0.15, -0.06, s * 0.19, 0.19, -0.13], 0.026, 14, 8, 0.95), skin, [0, 0, 0], 0, [1, 1, 0.55]));
    [R.armL, R.armR].forEach(A => { A.fore.scale.y = 1.35; A.hand.position.y = -0.36; for (let f = 0; f < 4; f++) M.P(A.hand, M.cone(0.008, 0.12, 6), G.mat('col', { c: 0x2a2018, r: 0.3 }), [(f - 1.5) * 0.018, -0.08, 0.02], [0.2, 0, 0]); });
    for (let i = 0; i < 5; i++) M.P(R.chest, M.tor(0.13, 0.008, 6, 20, Math.PI), skin, [0, 0.08 - i * 0.04, 0.05], [0, 0, Math.PI], [1.1, 0.5, 1]);
    R.armPose = (R, st) => { R.torso.rotation.x += 0.45; R.neck.rotation.x -= 0.35; R.armL.sh.rotation.z = 0.5; R.armR.sh.rotation.z = -0.5; };
    R.crouch = 0.45; return R;
  },
  wraith(scale = 1, boss = false) {
    const R = M.humanoid({ bulk: 0.9, noHead: true }); M.hideBase(R); R.kind = 'hum'; R.float = true;
    const robe = G.mat('col', { c: boss ? 0x1a1030 : 0x202838, r: 1, ds: true, tr: 0.82, e: boss ? 0x200a40 : 0x0a1a30, ei: 1 });
    const robeGeo = M.drape('wraithrobe', [[-0.86, 0.47, 0.44, 0, 2], [-0.5, 0.36, 0.33, 0, 2], [-0.1, 0.26, 0.22, 0, 2.1], [0.3, 0.19, 0.15, 0, 2.2], [0.6, 0.12, 0.1, 0, 2]], 9, 0.13, 0, 48).clone(), p = robeGeo.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) < -0.55) { const a = Math.atan2(p.getZ(i), p.getX(i)), k = G.clamp((-0.55 - p.getY(i)) / 0.35, 0, 1); p.setY(i, p.getY(i) + (Math.abs(Math.sin(a * 7)) * 0.28 + Math.abs(Math.sin(a * 17 + 1)) * 0.08) * k - 0.08 * k); }
    robeGeo.computeVertexNormals();
    R.robe = M.P(R.torso, robeGeo, robe, [0, -0.1, 0]);
    M.P(R.head, M.sph(0.17, 28, 16, 0, Math.PI * 2, 0, Math.PI / 1.6), robe, [0, 0.12, -0.02], 0, [1, 1.15, 1.15]);
    M.P(R.head, M.sph(0.12, 20, 14), G.mat('col', { c: 0x000000, r: 1 }), [0, 0.1, 0.03]);
    M.mirror(s => M.P(R.head, M.sph(0.02, 12, 10), G.mat('emissive', { c: boss ? 0x60ff80 : 0x80d0ff, i: 5 }), [s * 0.04, 0.12, 0.13]));
    [R.armL, R.armR].forEach(A => {
      M.P(A.sh, M.drape('wraithsleeve', [[-0.5, 0.13, 0.12, 0.01, 2], [-0.25, 0.09, 0.085, 0, 2], [0.02, 0.07, 0.065, 0, 2]], 7, 0.12, 0, 24), robe, [0, 0, 0]);
      for (let f = 0; f < 4; f++) M.P(A.hand, M.cyl(0.006, 0.004, 0.11, 6), G.mat('bone'), [(f - 1.5) * 0.015, -0.06, 0.02], [0.3, 0, 0]);
    });
    R.legL.hip.visible = R.legR.hip.visible = false;
    R.extraAnim = (R, st) => { R.body.position.y = 0.35 + Math.sin(st.t * 2) * 0.12; if (R.robe) R.robe.rotation.y = Math.sin(st.t * 1.3) * 0.1; };
    R.root.scale.setScalar(scale); return R;
  },
  lich() {
    const R = M.skeleton({ eye: 0x60ff80, bulk: 0.95 });
    const robe = G.mat('col', { c: 0x241a3a, t: 'cloth', r: 0.95, ds: true }), trim = G.mat('col', { c: 0x9a7a30, m: 0.9, r: 0.3 });
    M.P(R.hips, M.drape('lichrobe', [[-0.95, 0.4, 0.33, 0, 2.1], [-0.6, 0.33, 0.27, 0, 2.2], [-0.25, 0.26, 0.2, 0, 2.3], [0.1, 0.2, 0.15, 0, 2.4], [0.45, 0.17, 0.13, 0, 2.4]], 13, 0.08, 0, 48), robe);
    M.P(R.hips, M.drapeHem('lichrobe', 2, 0.006), trim);
    M.P(R.chest, M.drape('lichmantle', [[-0.3, 0.27, 0.2, -0.01, 2.2], [-0.1, 0.31, 0.22, -0.01, 2.3], [0.1, 0.32, 0.21, -0.01, 2.3], [0.2, 0.26, 0.17, -0.01, 2.2], [0.26, 0.12, 0.11, 0, 2]], 10, 0.06, 0, 44), robe);
    M.P(R.chest, M.drape('lichcowl', [[0.2, 0.16, 0.13, -0.03, 2], [0.32, 0.17, 0.15, -0.05, 2], [0.42, 0.13, 0.13, -0.07, 2]], 6, 0.04, 0, 30), G.mat('col', { c: 0x1a1228, t: 'cloth', r: 0.95, ds: true }));
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; M.P(R.head, M.cone(0.025, 0.12 + (i % 2) * 0.06, 6), trim, [Math.cos(a) * 0.11, 0.26, Math.sin(a) * 0.11]); }
    M.P(R.head, M.tor(0.115, 0.015, 8, 32), trim, [0, 0.22, 0], [Math.PI / 2, 0, 0]);
    M.P(R.head, M.oct(0.025), G.mat('emissive', { c: 0x60ff80, i: 3 }), [0, 0.23, 0.115]);
    M.mirror(s => { M.P(R.chest, M.sph(0.12, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), trim, [s * (R.shX + 0.03), 0.15, 0], [0, 0, s * -0.4], [1, 0.75, 1]); for (let k = 0; k < 3; k++) M.P(R.chest, M.cone(0.018, 0.09, 6), trim, [s * (R.shX + 0.02 + k * 0.035), 0.22 - k * 0.02, -0.04 + k * 0.04], [0, 0, s * -0.5]); });
    const st = M.G(R.armR.hand, [0, -0.035, 0.03], [Math.PI / 2, 0, 0]);
    R.armPose = (R, s) => { if (!(s.atk >= 0)) { R.armR.sh.rotation.x = -0.2; R.armR.el.rotation.x = -1.25; } };
    M.P(st, M.tube([0, -0.9, 0, 0.01, 0, 0, 0, 0.7, 0], 0.025, 20, 8), G.mat('col', { c: 0x2a2a2a, r: 0.5, m: 0.5 }));
    M.P(st, M.sph(0.08, 20, 16), G.mat('bone'), [0, 0.78, 0]);
    M.P(st, M.ico(0.05, 2), G.mat('emissive', { c: 0x60ff80, i: 4 }), [0, 0.95, 0]);
    R.orbs = []; for (let i = 0; i < 4; i++) { const o = M.P(R.root, M.ico(0.08, 2), G.mat('emissive', { c: 0x60ff80, i: 3 }), [0, 2, 0]); R.orbs.push(o); }
    R.extraAnim = (R, st) => { R.orbs.forEach((o, i) => { const a = st.t * 1.2 + i * Math.PI / 2; o.position.set(Math.cos(a) * 0.9, 1.6 + Math.sin(st.t * 2 + i) * 0.2, Math.sin(a) * 0.9); }); };
    R.legL.hip.visible = R.legR.hip.visible = false;
    R.root.scale.setScalar(1.6); return R;
  },
  colossus() {
    const R = M.skeleton({ eye: 0xff5020, bulk: 1.3 });
    // extra skulls & spikes fused to the body
    const bone = R.boneMat;
    for (let i = 0; i < 9; i++) { const a = i * 2.1; const g = M.G(R.chest, [Math.cos(a) * 0.2, -0.1 + (i % 3) * 0.1, Math.sin(a) * 0.15 + 0.02]); M.P(g, M.sph(0.06, 14, 10), bone); M.mirror(s => M.P(g, M.sph(0.015, 8, 6), G.mat('emissive', { c: 0xff5020, i: 3 }), [s * 0.022, 0.005, 0.05])); }
    for (let i = 0; i < 8; i++) M.P(R.torso, M.cone(0.03, 0.2, 8), bone, [0, -0.0 + i * 0.06, -0.08], [-1.2, 0, 0]);
    [R.armL, R.armR].forEach(A => { A.sh.scale.setScalar(1.35); for (let i = 0; i < 4; i++) M.P(A.el, M.cone(0.025, 0.14, 8), bone, [0.03, -0.05 - i * 0.06, -0.03], [-1.4, 0, 0.3]); for (let f = 0; f < 3; f++) M.P(A.hand, M.cone(0.008, 0.07, 6), bone, [(f - 1) * 0.016, -0.1, 0.012], [Math.PI + 0.25, 0, 0]); A.hand.scale.setScalar(1.25); });
    M.P(R.chest, M.ico(0.07, 2), G.mat('emissive', { c: 0xff5020, i: 3 }), [0, 0.03, 0.02]);
    R.root.scale.setScalar(3.1); return R;
  },
  goblin(shaman = false) {
    const skin = G.mat('col', { c: shaman ? 0x6a8a3a : 0x5a9a3a, r: 0.7, t: 'skin' });
    const R = M.humanoid({ skin, top: skin, bottom: G.mat('col', { c: 0x5a4028, t: 'leather' }), bulk: 0.9, eye: 0xffd000, eyeGlow: 0x604000, noEars: true, brow: 0x203010 });
    R.head.scale.set(1.25, 1.1, 1.15);
    M.mirror(s => M.P(R.head, M.cone(0.045, 0.24, 10), skin, [s * 0.15, 0.13, -0.01], [0.2, 0, s * -1.3], [1, 1, 0.4]));
    M.P(R.head, M.cone(0.03, 0.11, 10), skin, [0, 0.09, 0.15], [Math.PI / 2 - 0.1, 0, 0]);
    M.mirror(s => M.P(R.head, M.cone(0.008, 0.03, 4), G.mat('col', { c: 0xf0e0b0 }), [s * 0.03, 0.04, 0.115], [Math.PI, 0, 0]));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; M.P(R.hips, M.box(0.07, 0.18, 0.012), G.mat('col', { c: 0x6a4a28, t: 'leather' }), [Math.cos(a) * 0.17, -0.1, Math.sin(a) * 0.13], [0, -a + Math.PI / 2, 0]); }
    if (shaman) {
      M.P(R.head, M.sph(0.1, 18, 12, 0, Math.PI * 2, 0, Math.PI / 1.6), G.mat('bone'), [0, 0.13, 0.04], 0, [1, 1, 0.9]);
      M.mirror(s => M.P(R.head, M.sph(0.025, 10, 8), G.mat('col', { c: 0 }), [s * 0.035, 0.13, 0.13]));
      for (let i = 0; i < 7; i++) { const a = -0.9 + i * 0.3; M.P(R.head, M.tube([0, 0.2, -0.05, Math.sin(a) * 0.12, 0.35, -0.08, Math.sin(a) * 0.2, 0.45, -0.15], 0.018, 12, 6, 0.9), G.mat('col', { c: [0xc03020, 0x2050c0, 0xf0c020][i % 3] })); }
      const st = M.weapon.staff(0, 0xff4010); st.rotation.x = Math.PI / 2; st.position.set(0, -0.035, 0.03); R.armR.hand.add(st); R.weapon = st;
      R.armPose = (R, s) => { if (!(s.atk >= 0)) { R.armR.sh.rotation.x = -0.15; R.armR.el.rotation.x = -1.25; } };
      for (let i = 0; i < 4; i++) M.P(R.chest, M.sph(0.025, 10, 8), G.mat('bone'), [-0.1 + i * 0.065, 0.06 - Math.abs(i - 1.5) * 0.03, 0.15]);
    } else {
      const sp = M.G(R.armR.hand, [0, 0, 0], [1.0, 0, 0]);
      M.P(sp, M.cyl(0.016, 0.016, 1.1, 8), G.mat('wood'), [0, 0.2, 0]);
      M.P(sp, M.cone(0.04, 0.16, 4), G.mat('col', { c: 0x6a5a48, m: 0.7, r: 0.6 }), [0, 0.8, 0]);
      M.P(sp, M.tor(0.02, 0.006, 6, 12), G.mat('darkleather'), [0, 0.7, 0], [Math.PI / 2, 0, 0]);
      R.weapon = sp;
    }
    R.root.scale.setScalar(0.72); return R;
  },
  shaman() { return M.enemy.goblin(true); },
  spider(scale = 1, queen = false) {
    const R = { kind: 'spider', root: new THREE.Group() };
    const chit = G.mat('col', { c: queen ? 0x2a1030 : 0x2a2420, r: 0.35, m: 0.3, t: 'scales' }), hair = G.mat('col', { c: queen ? 0x4a2050 : 0x3a3028, r: 1 });
    R.body = M.G(R.root, [0, 0.55, 0]);
    R.abd = M.G(R.body, [0, 0.12, -0.45]);
    M.P(R.abd, M.sculpt('spiderAbd', [[-0.48, 0.0, 0.0, 0, 2], [-0.42, 0.18, 0.15, 0.02, 2], [-0.22, 0.36, 0.3, 0.0, 2], [0.05, 0.39, 0.33, -0.02, 2], [0.28, 0.3, 0.27, -0.01, 2], [0.4, 0.14, 0.13, 0.02, 2], [0.44, 0.04, 0.04, 0.03, 2]], 32, 4), chit, [0, 0, 0], [-Math.PI / 2, 0, 0]);
    M.P(R.abd, M.cone(0.04, 0.07, 10), chit, [0, -0.04, -0.46], [-Math.PI / 2, 0, 0]);
    for (let i = 0; i < 5; i++) M.P(R.abd, M.sph(0.06 - i * 0.006, 14, 10), G.mat('col', { c: queen ? 0xa040ff : 0xc02020, e: queen ? 0x5010a0 : 0x400000, ei: 1 }), [0, 0.3, 0.2 - i * 0.12], 0, [1.5, 0.4, 1]);
    for (let i = 0; i < 40; i++) { const a = i * 2.4, y = (i / 40) * 2 - 1; M.P(R.abd, M.cone(0.01, 0.06, 4), hair, [Math.cos(a) * 0.37 * Math.sqrt(1 - y * y), y * 0.32, Math.sin(a) * 0.46 * Math.sqrt(1 - y * y)], [Math.random(), Math.random(), Math.random()]); }
    M.P(R.body, M.sph(0.24, 28, 20), chit, [0, 0, 0.05], 0, [1, 0.62, 1.12]);
    M.P(R.body, M.sph(0.07, 14, 10), G.mat('col', { c: 0x111111, r: 0.3 }), [0, 0.13, 0.04], 0, [1, 0.3, 1.4]);
    R.head = M.G(R.body, [0, 0.02, 0.28]);
    M.P(R.head, M.sph(0.15, 24, 16), chit, [0, 0, 0], 0, [1, 0.8, 0.9]);
    const eye = G.mat('emissive', { c: queen ? 0x8030d0 : 0xb01010, i: 1.1 });
    [[0.05, 0.08, 0.12, 0.035], [-0.05, 0.08, 0.12, 0.035], [0.09, 0.06, 0.09, 0.022], [-0.09, 0.06, 0.09, 0.022], [0.03, 0.11, 0.1, 0.018], [-0.03, 0.11, 0.1, 0.018], [0.11, 0.09, 0.05, 0.016], [-0.11, 0.09, 0.05, 0.016]].forEach(e => M.P(R.head, M.sph(e[3], 12, 10), eye, [e[0], e[1], e[2]]));
    R.fangs = [];
    M.mirror(s => { const f = M.G(R.head, [s * 0.045, -0.04, 0.11]); M.P(f, M.sph(0.035, 12, 10), chit, [0, 0, 0]); M.P(f, M.tube([0, 0, 0, s * 0.01, -0.06, 0.03, -s * 0.01, -0.11, 0.0], 0.014, 10, 6, 0.85), G.mat('col', { c: 0x111111, r: 0.2, m: 0.5 })); R.fangs.push(f); });
    if (queen) { for (let i = 0; i < 7; i++) { const a = -0.9 + i * 0.3; M.P(R.head, M.cone(0.02, 0.18, 6), G.mat('col', { c: 0xc0a060, m: 0.9, r: 0.3 }), [Math.sin(a) * 0.12, 0.13, Math.cos(a) * 0.04 - 0.03], [-0.3, 0, -Math.sin(a) * 0.5]); }
      M.P(R.abd, M.sph(0.18, 20, 16), G.mat('col', { c: 0xd0e0a0, tr: 0.7, e: 0x608020, ei: 0.8 }), [0, -0.15, -0.38]); }
    R.legs = [];
    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? 1 : -1, k = i % 4, base = M.G(R.body, [side * 0.16, 0, 0.18 - k * 0.12]);
      base.rotation.y = (side > 0 ? 0 : Math.PI) + side * (k - 1.5) * 0.45;
      const ch = M.legChain(base, [0.38, 0.5, 0.35], chit, 0.035);
      ch[0].rotation.z = 0; R.legs.push({ base, ch, side, k, by: base.rotation.y });
    }
    R.root.scale.setScalar(scale); return R;
  },
  orc(scale = 1.15, warlord = false) {
    const skin = G.mat('col', { c: warlord ? 0x5a6a48 : 0x6a7a50, r: 0.7, t: 'skin' });
    const R = M.humanoid({ skin, top: skin, bottom: G.mat('col', { c: 0x3a3028, t: 'leather' }), bulk: 1.45, eye: 0xff4000, eyeGlow: 0x401000, brow: 0x202010, boots: G.mat('col', { c: 0x2a2018, r: 0.8 }) });
    R.head.scale.set(1.15, 1, 1.05);
    M.mirror(s => { M.P(R.head, M.cone(0.018, 0.08, 10), G.mat('col', { c: 0xf0e8c8, r: 0.4 }), [s * 0.05, 0.06, 0.1], [0.2, 0, s * 0.2]); M.P(R.chest, M.sph(0.12, 18, 12), skin, [s * 0.12, 0.06, 0.1], 0, [1.1, 0.8, 0.6]); });
    const plate = G.mat('col', { c: 0x4a4440, m: 0.85, r: 0.45 });
    M.P(R.armL.sh, M.sph(0.15, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), plate, [0.02, 0.03, 0], [0, 0, -0.3]);
    for (let i = 0; i < 3; i++) M.P(R.armL.sh, M.cone(0.025, 0.12, 8), plate, [0.05 + i * 0.03, 0.12, -0.05 + i * 0.05], [0, 0, -0.4]);
    M.P(R.chest, M.tor(0.27, 0.025, 8, 28), G.mat('darkleather'), [0, 0, 0], [Math.PI / 2 + 0.7, 0.7, 0], [1, 0.75, 1]);
    M.P(R.hips, M.band(0.175, 0.122, 0.06, -0.008, 2.6), G.mat('darkleather'), [0, 0.05, 0], 0, [1.45, 1, 1.45]);
    M.P(R.hips, M.box(0.1, 0.1, 0.03), G.mat('iron'), [0, 0.05, 0.172]);
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + 0.2; M.P(R.hips, M.box(0.09, 0.24, 0.014), G.mat('col', { c: 0x3a2a1c, t: 'leather' }), [Math.sin(a) * 0.255, -0.12, Math.cos(a) * 0.175 - 0.01], [Math.cos(a) * -0.1, a, 0]); }
    if (warlord) {
      M.P(R.head, M.sph(0.15, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), plate, [0, 0.14, 0]);
      M.mirror(s => M.P(R.head, M.tube([s * 0.13, 0.2, 0, s * 0.25, 0.2, 0.05, s * 0.32, 0.32, 0.1, s * 0.28, 0.42, 0.15], 0.03, 20, 10, 0.92), G.mat('col', { c: 0x2a2018, r: 0.5 })));
      M.P(R.armR.sh, M.sph(0.15, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), plate, [-0.02, 0.03, 0], [0, 0, 0.3]);
      M.P(R.chest, M.sph(0.21, 24, 16), plate, [0, 0.05, 0.03], 0, [1.3, 1.0, 0.85]);
      const ban = M.G(R.chest, [0, 0.1, -0.22]); M.P(ban, M.cyl(0.015, 0.015, 1.4, 8), G.mat('wood'), [0, 0.5, 0]);
      M.P(ban, M.box(0.45, 0.6, 0.01, 6, 6, 1), G.mat('col', { c: 0x7a1010, t: 'cloth', ds: true }), [0.23, 0.9, 0]);
      M.P(ban, M.sph(0.06, 12, 10), G.mat('bone'), [0.23, 0.95, 0.01]);
      const a1 = M.weapon.axe(1, false); a1.rotation.set(1.0, 0, 0); a1.scale.setScalar(1.3); R.armR.hand.add(a1);
      const a2 = M.weapon.axe(1, false); a2.rotation.set(1.0, 0, 0); a2.scale.setScalar(1.3); R.armL.hand.add(a2); R.weapon = a1;
    } else {
      const c = M.G(R.armR.hand, [0, 0, 0], [1.0, 0, 0]);
      M.P(c, M.cyl(0.025, 0.025, 0.3, 10), M.gripMat(), [0, 0, 0]);
      M.P(c, M.ext('cleaver', s => { s.moveTo(-0.04, 0); s.lineTo(-0.06, 0.7); s.lineTo(0.18, 0.75); s.quadraticCurveTo(0.2, 0.3, 0.06, 0); s.lineTo(-0.04, 0); }, 0.02, 0.006), G.mat('col', { c: 0x6a6a6a, m: 0.85, r: 0.5 }), [0, 0.13, 0]);
      R.weapon = c;
    }
    R.root.scale.setScalar(scale); return R;
  },
  troll() {
    const skin = G.mat('col', { c: 0x5a6a5a, r: 0.9, t: 'rock' });
    const R = M.humanoid({ skin, top: skin, bottom: G.mat('col', { c: 0x3a3020, t: 'leather' }), bulk: 1.3, eye: 0xffa000, eyeGlow: 0x402000, brow: 0x202010 });
    [R.armL, R.armR].forEach(A => { A.sh.scale.set(1.2, 1.45, 1.2); A.hand.scale.setScalar(1.45); for (let f = 0; f < 4; f++) M.P(A.hand, M.cone(0.007, 0.03, 5), G.mat('col', { c: 0x2a2018, r: 0.4 }), [(f - 1.5) * 0.017, -0.115, 0.03], [Math.PI - 0.6, 0, 0]); });
    M.P(R.head, M.cone(0.05, 0.16, 12), skin, [0, 0.09, 0.16], [Math.PI / 2 + 0.3, 0, 0]);
    M.mirror(s => M.P(R.head, M.cone(0.04, 0.18, 10), skin, [s * 0.14, 0.12, -0.02], [0, 0, s * -1.4]));
    for (let i = 0; i < 18; i++) M.P(i < 9 ? R.chest : R.armL.sh, M.sph(0.04, 8, 6), G.mat('col', { c: 0x3a6a2a, r: 1 }), [Math.cos(i * 2.3) * 0.2, 0.05 + Math.sin(i * 1.7) * 0.1, Math.sin(i * 2.3) * 0.12], 0, [1.5, 0.5, 1.5]);
    for (let i = 0; i < 6; i++) M.P(R.chest, M.cone(0.03, 0.1, 6), G.mat('col', { c: 0x8a8a7a, r: 1 }), [0, 0.15 - i * 0.03, -0.15 - i * 0.01], [-1.5, 0, 0]);
    const club = M.G(R.armR.hand, [0, 0, 0], [1.0, 0, 0]);
    M.P(club, M.tube([0, -0.1, 0, 0.03, 0.4, 0.02, -0.02, 0.9, 0], 0.07, 20, 10), G.mat('wood'));
    M.P(club, M.sph(0.115, 18, 14), G.mat('wood'), [-0.02, 0.9, 0], 0, [1, 1.25, 1]);
    for (let i = 0; i < 5; i++) M.P(club, M.cone(0.02, 0.1, 6), G.mat('iron'), [Math.cos(i * 1.3) * 0.13, 0.9 + Math.sin(i * 2) * 0.05, Math.sin(i * 1.3) * 0.13], [Math.sin(i * 1.3) * 1.5, 0, -Math.cos(i * 1.3) * 1.5]);
    R.armPose = (R) => { R.torso.rotation.x += 0.3; R.neck.rotation.x -= 0.25; };
    R.weapon = club; R.root.scale.setScalar(1.6); return R;
  },
  imp() {
    const skin = G.mat('col', { c: 0xb02818, r: 0.55, t: 'skin', e: 0x300800, ei: 0.5 });
    const R = M.humanoid({ skin, top: skin, bottom: skin, bulk: 0.85, eye: 0xffe000, eyeGlow: 0xffa000, brow: 0x200000 });
    M.mirror(s => M.P(R.head, M.tube([s * 0.07, 0.2, 0, s * 0.12, 0.28, -0.04, s * 0.11, 0.36, -0.1], 0.025, 12, 8, 0.9), G.mat('col', { c: 0x1a1010, r: 0.4 })));
    R.wings = [M.wing(R.chest, 1, 0.55, G.mat('col', { c: 0x701010, r: 0.7, ds: true, tr: 0.92 }), skin), M.wing(R.chest, -1, 0.55, G.mat('col', { c: 0x701010, r: 0.7, ds: true, tr: 0.92 }), skin)];
    R.tail = M.P(R.hips, M.tube([0, 0, -0.1, 0, -0.2, -0.3, 0, -0.1, -0.55, 0, 0.1, -0.65], 0.025, 20, 8, 0.8), skin);
    M.P(R.hips, M.cone(0.04, 0.08, 3), skin, [0, 0.12, -0.67], [-0.5, 0, 0]);
    [R.armL, R.armR].forEach(A => { for (let f = 0; f < 3; f++) M.P(A.hand, M.cone(0.008, 0.06, 5), G.mat('col', { c: 0x111111 }), [(f - 1) * 0.02, -0.06, 0.02]); });
    R.float = true;
    R.extraAnim = (R, st) => { R.body.position.y = 0.9 + Math.sin(st.t * 4) * 0.15; M.animWings(R, st.t, 16, 0.7); };
    R.root.scale.setScalar(0.62); return R;
  },
  hound(scale = 1) {
    const R = { kind: 'quad', root: new THREE.Group() };
    const skin = G.mat('col', { c: 0x2a1612, r: 0.55, t: 'hide', e: 0x300600, ei: 0.18 }), fire = G.mat('emissive', { c: 0xff5010, i: 3 });
    R.body = M.G(R.root, [0, 0.75, 0]);
    // deep chest, tucked waist, heavy haunches (rings run tail -> neck)
    M.P(R.body, M.sculpt('houndBody', [[-0.6, 0.03, 0.03, -0.04, 2], [-0.56, 0.11, 0.11, -0.03, 2], [-0.46, 0.19, 0.2, -0.02, 2.2], [-0.3, 0.2, 0.22, 0.0, 2.3], [-0.1, 0.165, 0.19, 0.01, 2.2], [0.12, 0.2, 0.26, 0.05, 2.3], [0.34, 0.23, 0.3, 0.07, 2.4], [0.52, 0.2, 0.26, 0.04, 2.3], [0.64, 0.12, 0.15, -0.02, 2]], 30, 4), skin, [0, 0, 0], [Math.PI / 2, 0, 0]);
    M.mirror(s => { M.P(R.body, M.sph(0.13, 18, 14), skin, [s * 0.14, -0.04, -0.33], 0, [0.7, 1.15, 1.1]); M.P(R.body, M.sph(0.11, 18, 14), skin, [s * 0.15, -0.06, 0.38], 0, [0.65, 1.2, 1]); });
    for (let i = 0; i < 10; i++) { const z = 0.48 - i * 0.1, h = z > 0 ? 0.2 + Math.min(z, 0.34) * 0.08 : 0.18 + z * 0.08; M.P(R.body, M.cone(0.032, 0.17 - Math.abs(i - 3) * 0.013, 8), G.mat('col', { c: 0x111111, r: 0.3 }), [0, h, z], [-0.5, 0, 0]); }
    for (let i = 0; i < 6; i++) M.P(R.body, M.box(0.01, 0.15, 0.01), fire, [0.23 * (i % 2 ? 1 : -1), -0.02, 0.3 - i * 0.12], [0, 0, (i % 2 ? 1 : -1) * 0.3]);
    R.neck = M.G(R.body, [0, 0.12, 0.5], [-0.4, 0, 0]);
    M.P(R.neck, M.cap(0.14, 0.2, 6, 16), skin, [0, 0.1, 0.05], [0.6, 0, 0]);
    R.head = M.G(R.neck, [0, 0.22, 0.12], [0.4, 0, 0]);
    M.P(R.head, M.sph(0.16, 24, 16), skin, [0, 0, 0], 0, [1, 0.85, 1.1]);
    M.P(R.head, M.cap(0.08, 0.18, 6, 16), skin, [0, -0.02, 0.18], [Math.PI / 2, 0, 0], [1.1, 1, 0.8]);
    M.mirror(s => { M.P(R.head, M.sph(0.025, 12, 10), fire, [s * 0.08, 0.06, 0.1]); M.P(R.head, M.cone(0.04, 0.16, 8), skin, [s * 0.09, 0.14, -0.06], [-0.6, 0, s * -0.3]); });
    R.jaw = M.G(R.head, [0, -0.06, 0.05]);
    M.P(R.jaw, M.cap(0.06, 0.18, 6, 14), skin, [0, -0.02, 0.12], [Math.PI / 2, 0, 0], [1, 1, 0.6]);
    for (let i = 0; i < 6; i++) { M.P(R.jaw, M.cone(0.008, 0.035, 4), G.mat('col', { c: 0xe8e0c0 }), [(i % 2 ? 1 : -1) * 0.04, 0.02, 0.06 + Math.floor(i / 2) * 0.05]); }
    R.mouthGlow = M.P(R.jaw, M.sph(0.04, 10, 8), fire, [0, 0.03, 0.08]);
    R.legs = [];
    [[1, 0.35], [-1, 0.35], [1, -0.35], [-1, -0.35]].forEach(([s, z], i) => { const b = M.G(R.body, [s * 0.18, -0.05, z]); const ch = M.legChain(b, [0.32, 0.3, 0.18], skin, 0.07); ch[1].rotation.x = i < 2 ? -0.4 : 0.5; ch[2].rotation.x = i < 2 ? 0.4 : -0.4; R.legs.push({ b, ch, front: i < 2 }); M.P(ch[2], M.sph(0.06, 12, 10), skin, [0, -0.18, 0.04], 0, [1, 0.5, 1.4]); });
    R.tail = []; let par = R.body, pz = -0.42;
    for (let i = 0; i < 6; i++) { const j = M.G(par, [0, i ? 0 : 0.08, i ? -0.12 : pz]); M.P(j, M.sph(0.06 - i * 0.008, 12, 10), skin, [0, 0, -0.06], 0, [1, 1, 1.6]); R.tail.push(j); par = j; }
    R.tailFire = M.P(R.tail[5], M.cone(0.06, 0.2, 10), fire, [0, 0.05, -0.12], [-1.2, 0, 0]);
    R.root.scale.setScalar(scale); return R;
  },
  elemental(scale = 1) {
    const R = { kind: 'elem', root: new THREE.Group() };
    R.body = M.G(R.root, [0, 1.2, 0]);
    R.core = M.P(R.body, M.ico(0.28, 3), G.mat('emissive', { c: 0xffa030, i: 4 }), [0, 0, 0]);
    M.P(R.body, M.ico(0.4, 2), G.mat('col', { c: 0xff6010, tr: 0.35, e: 0xff4000, ei: 2 }), [0, 0, 0]);
    R.rocks = [];
    const rockM = G.mat('col', { c: 0x2a1a14, r: 0.9, t: 'rock', e: 0x501000, ei: 0.6 });
    for (let i = 0; i < 14; i++) { const r = M.P(R.body, M.rockGeo(0.12 + Math.random() * 0.1, 1, 0.35), rockM); r.userData.a = Math.random() * 7; r.userData.r = 0.45 + Math.random() * 0.25; r.userData.y = (Math.random() - 0.5) * 0.9; r.userData.s = 0.5 + Math.random(); R.rocks.push(r); }
    R.arms = [];
    M.mirror(s => { const a = M.G(R.body, [s * 0.5, 0.1, 0]); for (let i = 0; i < 4; i++) M.P(a, M.rockGeo(0.13 - i * 0.015, 1, 0.3), rockM, [s * i * 0.16, -i * 0.12, 0]); M.P(a, M.ico(0.07, 1), G.mat('emissive', { c: 0xffc040, i: 4 }), [s * 0.5, -0.38, 0]); R.arms.push(a); });
    R.head = M.G(R.body, [0, 0.5, 0]); M.P(R.head, M.rockGeo(0.16, 1, 0.3), rockM);
    M.mirror(s => M.P(R.head, M.sph(0.03, 10, 8), G.mat('emissive', { c: 0xffffa0, i: 6 }), [s * 0.06, 0.02, 0.13]));
    R.root.scale.setScalar(scale); return R;
  },
  minotaur() {
    const fur = G.mat('col', { c: 0x4a3020, r: 1, t: 'leather' }), skin = G.mat('col', { c: 0x6a4a38, r: 0.7, t: 'skin' });
    const R = M.humanoid({ skin, top: skin, bottom: fur, bulk: 1.38, noHead: true, boots: G.mat('col', { c: 0x1a1410, r: 0.4 }) });
    M.mirror(s => M.P(R.chest, M.sph(0.12, 18, 12), skin, [s * 0.12, 0.06, 0.1], 0, [1.1, 0.8, 0.6]));
    // bull head
    M.P(R.head, M.sph(0.17, 28, 20), fur, [0, 0.12, 0.02], 0, [1, 1, 1.1]);
    M.P(R.head, M.cap(0.1, 0.12, 8, 18), fur, [0, 0.06, 0.17], [Math.PI / 2 - 0.3, 0, 0], [1.2, 1, 0.9]);
    M.P(R.head, M.sph(0.08, 16, 12), G.mat('col', { c: 0x2a1a14, r: 0.4 }), [0, 0.03, 0.25], 0, [1.3, 0.7, 0.6]);
    M.P(R.head, M.tor(0.03, 0.008, 6, 16), G.mat('gold'), [0, -0.0, 0.29], [0, 0, 0]);
    M.mirror(s => { M.P(R.head, M.sph(0.02, 12, 10), G.mat('emissive', { c: 0xff2000, i: 3 }), [s * 0.08, 0.15, 0.15]);
      M.P(R.head, M.tube([s * 0.13, 0.2, 0, s * 0.3, 0.25, 0.02, s * 0.4, 0.38, 0.08, s * 0.38, 0.5, 0.14], 0.045, 24, 12, 0.9), G.mat('col', { c: 0xe8dcc0, r: 0.5 }));
      M.P(R.head, M.cone(0.04, 0.1, 10), fur, [s * 0.17, 0.16, -0.02], [0, 0, s * -1.4]); });
    R.jaw = M.G(R.head, [0, 0.0, 0.15]); M.P(R.jaw, M.box(0.12, 0.03, 0.1), fur, [0, -0.01, 0.04]);
    for (let i = 0; i < 30; i++) M.P(R.legL.hip.children.length && i < 15 ? R.legL.hip : R.legR.hip, M.cone(0.03, 0.08, 5), fur, [Math.cos(i) * 0.08, -0.05 - (i % 15) * 0.025, Math.sin(i) * 0.08], [Math.PI, 0, 0]);
    M.P(R.hips, M.band(0.175, 0.122, 0.055, -0.008, 2.6), G.mat('darkleather'), [0, 0.05, 0], 0, [1.38, 1, 1.38]);
    for (let i = 0; i < 3; i++) M.P(R.armL.sh, M.tor(0.07, 0.012, 6, 20), G.mat('iron'), [0, -0.1 - i * 0.04, 0], [Math.PI / 2, 0, 0]);
    const ax = M.weapon.axe(1, true); ax.rotation.set(1.0, 0, 0); ax.scale.setScalar(1.25); R.armR.hand.add(ax); R.weapon = ax;
    R.root.scale.setScalar(1.55); return R;
  },
  gargoyle() {
    const stone = G.mat('col', { c: 0x7a7a80, r: 0.95, t: 'rock' });
    const R = M.humanoid({ skin: stone, top: stone, bottom: stone, boots: stone, bulk: 1.1, eye: 0xff3000, eyeGlow: 0xff2000, brow: 0x404040 });
    M.mirror(s => { M.P(R.head, M.tube([s * 0.08, 0.2, 0, s * 0.14, 0.28, -0.08, s * 0.12, 0.34, -0.2], 0.03, 14, 8, 0.85), stone); M.P(R.head, M.cone(0.04, 0.12, 6), stone, [s * 0.13, 0.12, -0.02], [0, 0, s * -1.2]); });
    R.jaw = M.G(R.head, [0, 0.03, 0.04]); M.P(R.jaw, M.sph(0.08, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), stone, [0, 0, 0.04], 0, [1, 0.8, 1.2]);
    R.wings = [M.wing(R.chest, 1, 0.9, G.mat('col', { c: 0x5a5a60, r: 0.95, ds: true, t: 'rock' }), stone), M.wing(R.chest, -1, 0.9, G.mat('col', { c: 0x5a5a60, r: 0.95, ds: true, t: 'rock' }), stone)];
    [R.armL, R.armR].forEach(A => { for (let f = 0; f < 3; f++) M.P(A.hand, M.cone(0.012, 0.09, 6), G.mat('col', { c: 0x333336 }), [(f - 1) * 0.025, -0.07, 0.02]); });
    for (let i = 0; i < 7; i++) M.P(R.torso, M.cone(0.025, 0.1, 6), stone, [0, 0.0 + i * 0.07, -0.13], [-1.3, 0, 0]);
    R.tail = M.P(R.hips, M.tube([0, 0, -0.1, 0, -0.3, -0.35, 0, -0.5, -0.5, 0, -0.6, -0.7], 0.03, 16, 8, 0.8), stone);
    R.extraAnim = (R, st) => { M.animWings(R, st.t, st.float ? 12 : 1.5, st.float ? 0.7 : 0.08); if (st.float) R.body.position.y = 0.8 + Math.sin(st.t * 5) * 0.12; else R.body.position.y = 0; };
    R.root.scale.setScalar(1.1); return R;
  },
  dragon() {
    const R = { kind: 'dragon', root: new THREE.Group() };
    const sc = G.mat('col', { c: 0x8a1a10, r: 0.45, m: 0.2, t: 'scales' }), belly = G.mat('col', { c: 0xc89a5a, r: 0.6, t: 'scales' }), horn = G.mat('col', { c: 0x1a1410, r: 0.3 });
    R.body = M.G(R.root, [0, 1.4, 0]);
    M.P(R.body, M.sculpt('dragonBody', [[-1.2, 0.28, 0.27, -0.02, 2], [-0.85, 0.42, 0.4, 0, 2.1], [-0.35, 0.53, 0.5, 0.02, 2.2], [0.2, 0.58, 0.56, 0.05, 2.3], [0.7, 0.53, 0.53, 0.03, 2.2], [1.05, 0.38, 0.4, -0.04, 2.1], [1.25, 0.27, 0.29, -0.08, 2]], 36, 4), sc, [0, 0, 0], [Math.PI / 2, 0, 0]);
    M.P(R.body, M.sculpt('dragonBelly', [[-1.0, 0.2, 0.2, 0.12, 2.4], [-0.5, 0.36, 0.38, 0.18, 2.6], [0.2, 0.42, 0.44, 0.19, 2.7], [0.8, 0.36, 0.4, 0.15, 2.6], [1.15, 0.2, 0.24, 0.08, 2.4]], 30, 4), belly, [0, 0, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 12; i++) { const z = 0.95 - i * 0.18; M.P(R.body, M.cone(0.07, 0.3 - Math.abs(i - 5) * 0.015, 8), horn, [0, 0.42 + 0.12 * Math.cos(z * 1.2), z], [-0.35, 0, 0]); }
    R.neck = []; let par = R.body;
    for (let i = 0; i < 6; i++) { const j = M.G(par, i ? [0, 0.12, 0.22] : [0, 0.25, 1.05], [i ? -0.08 : -0.5, 0, 0]); M.P(j, M.sph(0.3 - i * 0.025, 20, 16), sc, [0, 0, 0.1], 0, [1, 1, 1.3]); M.P(j, M.cone(0.04, 0.16, 6), horn, [0, 0.27 - i * 0.02, 0.05], [-0.4, 0, 0]); R.neck.push(j); par = j; }
    R.head = M.G(par, [0, 0.12, 0.3], [0.55, 0, 0]);
    M.P(R.head, M.sph(0.3, 28, 20), sc, [0, 0, 0], 0, [1, 0.8, 1.1]);
    M.P(R.head, M.cap(0.17, 0.4, 8, 20), sc, [0, -0.02, 0.38], [Math.PI / 2, 0, 0], [1.1, 1, 0.75]);
    M.mirror(s => { M.P(R.head, M.sph(0.05, 16, 12), G.mat('emissive', { c: 0xffcc00, i: 4 }), [s * 0.15, 0.1, 0.18]); M.P(R.head, M.tube([s * 0.12, 0.15, -0.1, s * 0.25, 0.3, -0.35, s * 0.28, 0.4, -0.65], 0.06, 20, 10, 0.92), horn); M.P(R.head, M.tube([s * 0.22, 0.0, -0.05, s * 0.35, 0.0, -0.3], 0.03, 10, 6, 0.9), horn); M.P(R.head, M.sph(0.03, 10, 8), G.mat('col', { c: 0x000000 }), [s * 0.07, 0.04, 0.62]); });
    R.jaw = M.G(R.head, [0, -0.12, 0.1]);
    M.P(R.jaw, M.cap(0.13, 0.4, 6, 18), sc, [0, -0.04, 0.3], [Math.PI / 2, 0, 0], [1.05, 1, 0.5]);
    for (let i = 0; i < 12; i++) { const s = i % 2 ? 1 : -1, z = 0.15 + Math.floor(i / 2) * 0.07; M.P(R.jaw, M.cone(0.015, 0.07, 5), G.mat('col', { c: 0xf0e8d0 }), [s * 0.1, 0.04, z]); M.P(R.head, M.cone(0.015, 0.07, 5), G.mat('col', { c: 0xf0e8d0 }), [s * 0.11, -0.12, z + 0.1], [Math.PI, 0, 0]); }
    R.mouthGlow = M.P(R.jaw, M.sph(0.08, 12, 10), G.mat('emissive', { c: 0xff6010, i: 0 }), [0, 0.05, 0.25]);
    const mem = G.mat('col', { c: 0x5a0a08, r: 0.7, ds: true, tr: 0.95, e: 0x200000, ei: 0.5 });
    R.wings = [M.wing(R.body, 1, 2.6, mem, sc), M.wing(R.body, -1, 2.6, mem, sc)];
    R.wings[0].position.set(0.4, 0.45, 0.4); R.wings[1].position.set(-0.4, 0.45, 0.4);
    R.legs = [];
    [[1, 0.7], [-1, 0.7], [1, -0.7], [-1, -0.7]].forEach(([s, z], i) => { const b = M.G(R.body, [s * 0.45, -0.2, z]); const ch = M.legChain(b, [0.55, 0.5, 0.25], sc, 0.15); ch[1].rotation.x = i < 2 ? -0.5 : 0.6; ch[2].rotation.x = i < 2 ? 0.5 : -0.5; for (let c = 0; c < 3; c++) M.P(ch[2], M.cone(0.04, 0.16, 6), horn, [(c - 1) * 0.08, -0.25, 0.12], [Math.PI / 2, 0, 0]); R.legs.push({ b, ch, front: i < 2 }); });
    R.tail = []; par = R.body;
    for (let i = 0; i < 10; i++) { const j = M.G(par, i ? [0, 0, -0.32] : [0, 0.05, -1.0]); M.P(j, M.sph(0.3 - i * 0.025, 16, 12), sc, [0, 0, -0.15], 0, [1, 0.9, 1.4]); M.P(j, M.cone(0.04, 0.16 - i * 0.01, 6), horn, [0, 0.25 - i * 0.02, -0.15], [-0.6, 0, 0]); R.tail.push(j); par = j; }
    M.P(R.tail[9], M.ext('tailspade', s => { s.moveTo(0, 0); s.lineTo(0.2, -0.15); s.lineTo(0, -0.45); s.lineTo(-0.2, -0.15); }, 0.04, 0.01), horn, [0, 0, -0.2], [Math.PI / 2, 0, 0]);
    R.root.scale.setScalar(1.6); return R;
  },
  demonlord() {
    const skin = G.mat('col', { c: 0x6a1010, r: 0.55, t: 'skin', e: 0x200000, ei: 0.5 }), arm = G.mat('col', { c: 0x1a1414, m: 0.9, r: 0.3 }), fire = G.mat('emissive', { c: 0xff6010, i: 3 });
    const R = M.humanoid({ skin, top: arm, bottom: G.mat('col', { c: 0x2a0a0a, t: 'leather' }), bulk: 1.3, eye: 0xffd000, eyeGlow: 0xffa000, sleeve: skin, boots: arm, brow: 0x000000 });
    M.mirror(s => { M.P(R.head, M.tube([s * 0.1, 0.18, -0.02, s * 0.22, 0.2, -0.1, s * 0.26, 0.1, -0.15, s * 0.2, 0.0, -0.08, s * 0.15, 0.02, 0.0], 0.04, 30, 12, 0.85), G.mat('col', { c: 0x2a2018, r: 0.4 }));
      M.P(R.chest, M.sph(0.16, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), arm, [s * 0.3, 0.14, 0], [0, 0, s * -0.4]);
      for (let i = 0; i < 3; i++) M.P(R.chest, M.cone(0.03, 0.18, 6), arm, [s * (0.3 + i * 0.04), 0.25, -0.05 + i * 0.05], [0, 0, s * -0.5]); });
    M.P(R.chest, M.tor(0.1, 0.015, 8, 24), fire, [0, 0.05, 0.16]);
    for (let i = 0; i < 6; i++) M.P(R.chest, M.box(0.008, 0.1, 0.01), fire, [Math.cos(i) * 0.15, 0.05 + Math.sin(i * 2) * 0.1, 0.17], [0, 0, i]);
    R.wings = [M.wing(R.chest, 1, 1.4, G.mat('col', { c: 0x2a0606, r: 0.7, ds: true, tr: 0.95 }), skin), M.wing(R.chest, -1, 1.4, G.mat('col', { c: 0x2a0606, r: 0.7, ds: true, tr: 0.95 }), skin)];
    const sw = M.weapon.sword(4, 1.3); sw.rotation.set(1.0, 0, 0); R.armR.hand.add(sw); R.weapon = sw;
    R.blade = M.P(sw, M.box(0.09, 1.2, 0.05), G.mat('col', { c: 0xff4000, tr: 0.35, e: 0xff3000, ei: 2 }), [0, 0.75, 0]);
    R.extraAnim = (R, st) => M.animWings(R, st.t, 2, 0.15);
    R.root.scale.setScalar(2.3); return R;
  }
};
M.enemy.spiderqueen = () => M.enemy.spider(2.4, true);
M.enemy.warlord = () => M.enemy.orc(1.55, true);
M.enemy.spiderling = () => M.enemy.spider(0.55);

/* ---------- non-humanoid animation ---------- */
M.animOther = (R, st) => {
  const t = st.t, mv = st.move || 0, ph = st.phase || 0, p = st.atk;
  if (R.kind === 'spider') {
    R.body.position.y = 0.55 + Math.sin(ph * 2) * 0.03 * mv + Math.sin(t * 2) * 0.01;
    R.legs.forEach((L, i) => {
      const grp = (L.k + (L.side > 0 ? 0 : 1)) % 2, w = Math.sin(ph + grp * Math.PI);
      L.base.rotation.y = L.by + w * 0.35 * mv * L.side;
      L.ch[0].rotation.set(0, 0, 2.15 + Math.max(0, w) * 0.35 * mv);
      L.ch[1].rotation.set(0, 0, -1.55); L.ch[2].rotation.set(0, 0, -0.35);
    });
    if (R.abd) R.abd.rotation.x = Math.sin(t * 1.5) * 0.05;
    const a = p >= 0 ? Math.sin(p * Math.PI) : 0;
    R.head.rotation.x = -a * 0.5; R.body.rotation.x = -a * 0.35;
    R.fangs.forEach((f, i) => f.rotation.z = (i ? 1 : -1) * (0.2 + a * 0.6));
    if (a > 0) { R.legs[0].ch[0].rotation.z += a * 0.8; R.legs[4].ch[0].rotation.z += a * 0.8; R.legs[0].base.rotation.x = R.legs[4].base.rotation.x = -a * 0.6; }
  } else if (R.kind === 'quad' || R.kind === 'dragon') {
    const big = R.kind === 'dragon';
    R.legs.forEach((L, i) => { const w = Math.sin(ph + (i === 0 || i === 3 ? 0 : Math.PI)); L.b.rotation.x = w * 0.55 * mv; L.ch[1].rotation.x = (L.front ? -0.4 : 0.5) + Math.max(0, w) * 0.4 * mv * (L.front ? -1 : 1); });
    R.body.position.y = (big ? 1.4 : 0.75) + Math.abs(Math.sin(ph)) * 0.05 * mv + Math.sin(t * 1.5) * 0.02;
    if (R.tail) R.tail.forEach((j, i) => { j.rotation.y = Math.sin(t * 2 - i * 0.5) * 0.12; j.rotation.x = big ? 0.04 : -0.15 + i * 0.05; });
    const a = p >= 0 ? G.smooth(Math.sin(G.clamp(p, 0, 1) * Math.PI)) : 0;
    const k = st.atkKind;
    if (R.head) {
      if (k === 'breath') { R.head.rotation.x = (big ? 0.55 : 0.4) - a * 0.2; if (R.jaw) R.jaw.rotation.x = a * 0.7; }
      else if (k === 'roar') { R.head.rotation.x = (big ? 0.55 : 0.4) - a * 0.9; if (R.jaw) R.jaw.rotation.x = a * 0.9; }
      else { R.head.rotation.x = (big ? 0.55 : 0.4) + a * 0.5; if (R.jaw) R.jaw.rotation.x = 0.1 + a * 0.6; }
    }
    if (R.neck) { if (Array.isArray(R.neck)) R.neck.forEach((n, i) => n.rotation.y = Math.sin(t * 0.8 + i * 0.3) * 0.05 + (st.look || 0) / R.neck.length); else R.neck.rotation.x = -0.4 + a * (k === 'bite' ? 0.5 : -0.2); }
    if (k === 'tail' && R.tail) R.tail.forEach((j, i) => j.rotation.y = Math.sin(p * Math.PI * 2) * 0.35);
    if (k === 'stomp' && R.legs) { R.legs[0].b.rotation.x = -a * 1.1; R.legs[1].b.rotation.x = -a * 1.1; R.body.rotation.x = -a * 0.3; } else R.body.rotation.x = 0;
    if (R.mouthGlow) R.mouthGlow.material.emissiveIntensity = k === 'breath' ? a * 6 : 0.5;
    if (R.wings) M.animWings(R, t, st.float ? 6 : 1.2, st.float ? 0.8 : 0.15);
    if (R.tailFire) R.tailFire.scale.setScalar(0.8 + Math.sin(t * 20) * 0.2);
  } else if (R.kind === 'elem') {
    R.body.position.y = 1.2 + Math.sin(t * 2) * 0.12;
    R.rocks.forEach(r => { const a = r.userData.a + t * r.userData.s; r.position.set(Math.cos(a) * r.userData.r, r.userData.y + Math.sin(t + r.userData.a) * 0.1, Math.sin(a) * r.userData.r); r.rotation.set(t * r.userData.s, t, 0); });
    R.core.scale.setScalar(1 + Math.sin(t * 8) * 0.08 + (p >= 0 ? p * 0.6 : 0));
    const a = p >= 0 ? Math.sin(p * Math.PI) : 0;
    R.arms.forEach((A, i) => { A.rotation.set(-a * 1.2 + Math.sin(t * 2 + i) * 0.1, 0, (i ? -1 : 1) * (0.3 + Math.sin(t * 1.5) * 0.1)); });
  }
};
M.anim = (R, st) => { if (R.kind === 'hum') M.animHum(R, st); else { M.preRig(R); M.animOther(R, st); const rt = M.smoothRate(st); if (rt) M.smoothRig(R, st, rt * 0.9); } };
