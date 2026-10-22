/* ============================================================
   Hero models (third person) + first-person viewmodels
   ============================================================ */
'use strict';
G.CLASS_INFO = {
  knight: { name: 'Knight', color: '#5b8cff', hp: 160, sta: 100, mana: 0, speed: 5.2, desc: 'Plate armor, sword and kite shield. Blocks absorb almost everything.', weapon: 'Longsword', abil: 'Shield Bash', abil2: 'Valor Charge', dmgType: 'slash' },
  barbarian: { name: 'Barbarian', color: '#e0583a', hp: 175, sta: 110, mana: 0, speed: 5.4, desc: 'Greataxe cleaves through crowds. Rage turns hits into healing.', weapon: 'Greataxe', abil: 'Blood Rage', abil2: 'Leap Slam', dmgType: 'slash' },
  rogue: { name: 'Rogue', color: '#9d6bff', hp: 115, sta: 130, mana: 0, speed: 6.4, desc: 'Twin daggers, fast combos and brutal crits. Strikes from shadow.', weapon: 'Twin Daggers', abil: 'Shadow Step', abil2: 'Fan of Knives', dmgType: 'pierce' },
  archer: { name: 'Archer', color: '#5fc46a', hp: 120, sta: 115, mana: 0, speed: 5.9, desc: 'Longbow with charged shots. Keeps the horde at range.', weapon: 'Longbow', abil: 'Volley', abil2: 'Frost Arrow', dmgType: 'pierce' },
  wizard: { name: 'Wizard', color: '#ff8a3a', hp: 100, sta: 90, mana: 120, speed: 5.4, desc: 'Firebolts on click, Frost Nova to freeze. Learns new spells at the library.', weapon: 'Ember Staff', abil: 'Frost Nova', abil2: 'Chain Lightning', dmgType: 'fire' },
  priest: { name: 'Priest', color: '#ffd76a', hp: 135, sta: 100, mana: 110, speed: 5.3, desc: 'Holy mace and healing light for the whole party.', weapon: 'Sanctified Mace', abil: 'Holy Light', abil2: 'Smite', dmgType: 'holy' }
};

M.helmLathe = (h = 0.3) => M.lathe([0, 0.34, 0.08, 0.33, 0.13, 0.3, 0.155, 0.24, 0.165, 0.14, 0.16, 0.02, 0.15, -0.05, 0.155, -0.06], 32);
// a closed elliptical band (belts, plate lames, cuffs); flare widens the lower edge
M.band = (w, d, h, zo = 0, sq = 2.6, flare = 0) => M.sculpt(`band${w},${d},${h},${zo},${sq},${flare}`, [[-h / 2, w * (1 + flare), d * (1 + flare), zo, sq], [0, w * (1 + flare * 0.4), d * (1 + flare * 0.4), zo, sq], [h / 2, w, d, zo, sq]], 36, 2, 0);
// hood with the face left open; tail droops down the back
M.hood = (head, mat, r = 0.16, tail = true) => {
  M.P(head, M.sph(r, 32, 20, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.7), mat, [0, 0.105, -0.012], 0, [0.98, 1.08, 1.1]);
  { const pts = [], ph = [Math.PI / 2 + 0.95, Math.PI / 2 - 0.95], C = [0, 0.105, -0.012], S = [0.98, 1.08, 1.1], rr = r * 1.005;   // rolled rim along the edges of the face opening
    for (let k = 0; k <= 14; k++) { const th = 0.7 * Math.PI * (1 - k / 14); pts.push(C[0] - rr * Math.cos(ph[0]) * Math.sin(th) * S[0], C[1] + rr * Math.cos(th) * S[1], C[2] + rr * Math.sin(ph[0]) * Math.sin(th) * S[2]); }
    for (let k = 1; k <= 14; k++) { const th = 0.7 * Math.PI * k / 14; pts.push(C[0] - rr * Math.cos(ph[1]) * Math.sin(th) * S[0], C[1] + rr * Math.cos(th) * S[1], C[2] + rr * Math.sin(ph[1]) * Math.sin(th) * S[2]); }
    M.P(head, M.tube(pts, 0.011, 60, 8), mat); }
  if (tail) M.P(head, M.tube([0, 0.2, -0.12, 0, 0.12, -0.22, 0, -0.02, -0.26, 0, -0.14, -0.24], 0.06, 20, 12, 0.9), mat);
};
// diagonal strap across the chest (bandolier / quiver strap)
M.strap = (R, mat, ang, y = 0.08, bk = 1) => { const g = M.G(R.chest, [0, y, 0.004], [0, 0, ang]); M.P(g, M.band(0.226 * bk, 0.146 * bk, 0.035, 0.008, 2.4), mat); return g; };

// seat a weapon in a closed fist: the haft runs through the curled fingers, the blade leaves on the thumb side
// and the edge faces the knuckles (right thumb is +x in hand space, left is -x)
M.grip = (A, w, side) => {
  const sx = side, X = new G.V3(0, -1, 0), Y = new G.V3(sx, 0, 0), Z = X.clone().cross(Y);
  w.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z)); w.position.set(0, -0.07, 0.028); A.hand.add(w); return w;
};
// a bow sits in the fist like a hammer haft: the riser runs through the curled fingers (limbs out of the thumb
// side and the little-finger side), the arrow leaves along the forearm, the string faces back toward the elbow.
// thumb = hand-space thumb direction (+-1 on x), fwd = the direction the forearm points out of the fist
M.bowGrip = (bow, thumb, fwd = new G.V3(0, -1, 0), fist = new G.V3(0, -0.07, 0.028)) => {
  const Y = new G.V3(thumb, 0, 0), Z = fwd.clone().negate(), X = Y.clone().cross(Z);
  bow.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
  bow.position.copy(fist).sub(new G.V3(0, 0, -0.032).applyQuaternion(bow.quaternion)); return bow;
};
M.hero = (cls, tier = 0, wi = 0) => {
  let R;
  const hand = (A, w) => M.grip(A, w, A === R.armR ? 1 : -1);
  const belt = (R, b, mat, buckle, y = 0.06) => { M.P(R.hips, M.band(0.172, 0.12, 0.05, -0.008, 2.7), mat, [0, y, 0], 0, [b, 1, b]); if (buckle) M.P(R.hips, M.tor(0.026, 0.007, 6, 16), buckle, [0, y, 0.125 * b], 0, [1.2, 1, 1]); };
  const sleeve = (A, mat, w0, w1, len, folds = 6) => M.P(A.el, M.drape(`slv${w0}${w1}${len}`, [[-len, w1, w1 * 0.95, 0.01, 2], [-len * 0.5, (w0 + w1) / 2, (w0 + w1) / 2 * 0.95, 0.004, 2], [0.03, w0, w0 * 0.92, 0, 2]], folds, 0.07, 0, 24), mat, [0, 0, 0]);
  if (cls === 'knight') {
    const plate = G.mat('col', { c: 0xb8bcc6, m: 0.9, r: 0.28 }), dark = G.mat('col', { c: 0x6c717c, m: 0.85, r: 0.38 }), mail = G.mat('col', { c: 0x555a66, m: 0.8, r: 0.45 }), cloth = G.mat('col', { c: 0x1d3f8a, t: 'cloth', r: 0.9, ds: true }), trim = G.mat('gold'), lea = G.mat('darkleather');
    const b = 1.1;
    R = M.humanoid({ top: plate, bottom: mail, boots: plate, hands: plate, forearm: plate, shin: plate, sleeve: mail, bulk: b, noHead: true });
    // great helm: dome, brow band, vision slit with breaths, crest ridge, plume
    M.P(R.head, M.helmLathe(), plate, [0, -0.02, 0], 0, [0.98, 1, 1.02]);
    M.P(R.head, M.box(0.21, 0.016, 0.06), G.mat('col', { c: 0x050505 }), [0, 0.13, 0.14]);
    M.P(R.head, M.tor(0.16, 0.009, 8, 36, Math.PI), trim, [0, 0.152, 0.0], [Math.PI / 2, 0, 0], [0.98, 1.02, 1]);
    M.P(R.head, M.box(0.016, 0.15, 0.03), plate, [0, 0.07, 0.158]);
    M.P(R.head, M.tube([0, 0.33, 0.06, 0, 0.345, -0.02, 0, 0.33, -0.1], 0.012, 12, 6), plate);
    for (let i = 0; i < 5; i++) M.mirror(s => M.P(R.head, M.cyl(0.0045, 0.0045, 0.03, 6), G.mat('col', { c: 0x050505 }), [s * (0.03 + i * 0.016), 0.06 - i * 0.004, 0.148 - i * 0.008], [Math.PI / 2, 0, 0]));
    for (let i = 0; i < 9; i++) M.P(R.head, M.tube([0, 0.33, 0, 0, 0.45, -0.06 - i * 0.015, 0, 0.42 - i * 0.02, -0.22 - i * 0.02], 0.022 - i * 0.0015, 16, 8, 0.8), G.mat('col', { c: 0xb01e1e, r: 0.9 }), [((i % 3) - 1) * 0.012, 0, 0]);
    // gorget, breastplate ridge and belly lames
    M.P(R.neck, M.sculpt('gorget', [[-0.06, 0.11, 0.092, 0, 2.3], [-0.01, 0.088, 0.078, 0.004, 2.2], [0.05, 0.068, 0.064, 0.006, 2]], 28, 3, 0), plate, [0, 0, 0.005], 0, [b, 1, b]);
    M.P(R.neck, M.band(0.1, 0.086, 0.012, 0.002, 2.3), trim, [0, -0.04, 0.005], 0, [b, 1, b]);
    M.P(R.chest, M.tube([0, -0.05, 0.131, 0, 0.02, 0.149, 0, 0.09, 0.155, 0, 0.15, 0.129, 0, 0.19, 0.093], 0.007, 18, 6), plate);
    for (let i = 0; i < 3; i++) M.P(R.torso, M.band(0.152 + i * 0.006, 0.108 + i * 0.004, 0.06, 0.008, 2.6, 0.04), i % 2 ? dark : plate, [0, 0.19 - i * 0.065, 0], 0, [b, 1, b]);
    // layered pauldrons with gold edge, couters, flared gauntlet cuffs
    [R.armL, R.armR].forEach((A, i) => { const s = i ? -1 : 1;
      for (let k = 0; k < 3; k++) M.P(A.sh, M.sph(0.108 - k * 0.01, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), k === 1 ? dark : plate, [s * 0.018, 0.03 - k * 0.045, 0], [0, 0, s * -0.32], [1, 0.72, 1.06]);
      M.P(A.sh, M.tor(0.104, 0.007, 6, 28), trim, [s * 0.018, 0.03, 0], [Math.PI / 2, 0, s * -0.32], [1, 1.06, 0.8]);
      M.P(A.el, M.sph(0.052, 18, 12), plate, [0, 0, -0.005]);
      M.P(A.el, M.cone(0.05, 0.03, 16), dark, [s * 0.045, 0, -0.01], [0, 0, s * -Math.PI / 2]);
      M.P(A.el, M.cyl(0.055, 0.04, 0.08, 18, 1, true), plate, [0, -0.235, 0]); });
    // faulds, tassets, poleyns
    for (let k = 0; k < 3; k++) M.P(R.hips, M.band(0.18 + k * 0.008, 0.124 + k * 0.006, 0.055, -0.006, 2.6, 0.05), k === 1 ? dark : plate, [0, 0.0 - k * 0.048, 0], 0, [b, 1, b]);
    const tas = M.bend('tasset', M.box(0.15, 0.17, 0.012, 6, 2, 1), 2.2);
    [R.legL, R.legR].forEach((L, i) => { const s = i ? -1 : 1;
      M.P(L.hip, tas, plate, [s * 0.01, -0.08, 0.098 * b], [-0.1, 0, 0]); M.P(L.hip, M.box(0.15, 0.012, 0.014), trim, [s * 0.01, -0.006, 0.106 * b], [-0.1, 0, 0]);
      M.P(L.kn, M.sph(0.066, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), plate, [0, 0, 0.012], [Math.PI / 2, 0, 0], [1, 1, 0.7]);
      M.P(L.kn, M.cone(0.04, 0.025, 14), dark, [s * 0.058, 0, 0.0], [0, 0, s * -Math.PI / 2]); });
    // skirted tabard below the belt, front and back, with heraldry
    const tab = M.bend('tabard', M.box(0.22, 0.46, 0.01, 6, 8, 1), 1.6);
    M.P(R.hips, tab, cloth, [0, -0.2, 0.152 * b], [-0.06, 0, 0]); M.P(R.hips, tab, cloth, [0, -0.2, -0.15 * b], [0.06, Math.PI, 0]);
    M.P(R.hips, M.box(0.22, 0.018, 0.014), trim, [0, -0.425, 0.168 * b], [-0.06, 0, 0]);
    M.P(R.hips, M.box(0.075, 0.075, 0.014), trim, [0, -0.17, 0.168 * b], [-0.06, 0, Math.PI / 4]);
    M.P(R.chest, M.box(0.07, 0.07, 0.012), trim, [0.0, 0.035, 0.158], [0.12, 0, Math.PI / 4]);
    // sword belt and scabbard on the left hip
    belt(R, b, lea, trim, 0.055);
    { const sc = M.G(R.hips, [0.2 * b, -0.05, -0.02], [0.35, 0, 0.12]); M.P(sc, M.cyl(0.03, 0.022, 0.72, 12), lea, [0, -0.34, 0]); M.P(sc, M.cyl(0.033, 0.033, 0.05, 12), trim, [0, -0.02, 0]); M.P(sc, M.cone(0.024, 0.05, 12), trim, [0, -0.72, 0], [Math.PI, 0, 0]); }
    R.weapon = hand(R.armR, M.weapon.sword(tier));
    R.shield = M.weapon.shield(tier); R.shield.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new G.V3(0, 1, 0), new G.V3(0, 0, 1), new G.V3(1, 0, 0)));
    R.shield.position.set(0.075, -0.15, 0.0); R.armL.el.add(R.shield);
    R.armPose = (R, st) => { if (!(st.atk >= 0) || st.atkKind !== 'bash') { R.armL.sh.rotation.x = Math.min(R.armL.sh.rotation.x, -0.25); R.armL.sh.rotation.z = 0.22; if (!st.block) R.armL.el.rotation.x = -1.4; } };
  } else if (cls === 'barbarian') {
    const skin = G.mat('col', { c: 0xc98a62, r: 0.6, t: 'skin' }), fur = G.mat('col', { c: 0x6b4a2c, r: 1, ds: true }), fur2 = G.mat('col', { c: 0x4e3420, r: 1 }), leather = G.mat('leather'), iron = G.mat('iron'), bronze = G.mat('bronze');
    const b = 1.25;
    R = M.humanoid({ skin, top: skin, bottom: G.mat('col', { c: 0x4a3020, t: 'leather' }), bulk: b, boots: G.mat('col', { c: 0x5a3a22, r: 0.9 }), brow: 0x7a3010 });
    // muscle definition: pecs, abs, obliques
    M.mirror(s => { M.P(R.chest, M.sph(0.085, 22, 14), skin, [s * 0.09 * b, 0.075, 0.118 * b], [0, 0, s * 0.2], [1.18, 0.74, 0.5]);
      for (let i = 0; i < 3; i++) M.P(R.torso, M.sph(0.034, 14, 10), skin, [s * 0.04 * b, 0.21 - i * 0.065, 0.11 * b], 0, [1.15, 0.8, 0.4]);
      M.P(R.torso, M.sph(0.05, 14, 10), skin, [s * 0.13 * b, 0.07, 0.06 * b], 0, [0.6, 1.6, 0.9]); });
    [R.armL, R.armR].forEach(A => { M.P(A.sh, M.sph(0.06, 18, 14), skin, [0, -0.13, 0.025], 0, [1.05, 1.5, 1]);
      const sd = A === R.armL ? 1 : -1; M.P(A.el, M.limbWrap('fore', sd, 0.36, 0.88, 0.008), leather, [0, 0, 0], 0, [b, 1, b]); for (let k = 0; k < 2; k++) M.P(A.el, M.limbWrap('fore', sd, 0.42 + k * 0.36, 0.47 + k * 0.36, 0.013, 'br'), bronze, [0, 0, 0], 0, [b, 1, b]); });
    // war paint
    M.mirror(s => { for (let k = 0; k < 2; k++) M.P(R.head, M.tube([s * 0.026, 0.094 - k * 0.014, 0.1315, s * 0.05, 0.091 - k * 0.014, 0.1295, s * 0.074, 0.086 - k * 0.014, 0.117], 0.0042, 10, 5), G.mat('col', { c: 0x2050c0, r: 0.8 })); });   // war paint across the cheekbones
    // horned helm with nasal guard and rivets
    M.P(R.head, M.sph(0.142, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), iron, [0, 0.13, -0.005], 0, [1, 1.04, 1.06]);
    M.P(R.head, M.band(0.142, 0.15, 0.03, -0.005, 2), bronze, [0, 0.135, 0]);
    M.P(R.head, M.box(0.026, 0.09, 0.016), iron, [0, 0.11, 0.152]);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; M.P(R.head, M.sph(0.008, 6, 5), bronze, [Math.sin(a) * 0.143, 0.137, Math.cos(a) * 0.15 - 0.005]); }
    M.mirror(s => M.P(R.head, M.tube([s * 0.12, 0.18, 0, s * 0.21, 0.23, 0.02, s * 0.26, 0.33, 0.04, s * 0.23, 0.42, 0.07], 0.034, 28, 14, 0.94), G.mat('bone')));
    // braided beard and moustache
    for (let i = 0; i < 3; i++) M.P(R.head, M.tube([(i - 1) * 0.028, 0.045, 0.11, (i - 1) * 0.032, -0.03, 0.125, (i - 1) * 0.028, -0.13, 0.105], 0.02, 18, 10, 0.55), G.mat('col', { c: 0x7a3010, r: 1 }));
    M.mirror(s => M.P(R.head, M.tube([0, 0.065, 0.13, s * 0.035, 0.06, 0.125, s * 0.05, 0.03, 0.115], 0.01, 10, 6, 0.6), G.mat('col', { c: 0x7a3010, r: 1 })));
    // fur mantle over the shoulders
    M.P(R.chest, M.drape('mantle', [[0.04, 0.42, 0.25, -0.012, 2.2], [0.12, 0.4, 0.24, -0.01, 2.2], [0.2, 0.32, 0.2, -0.005, 2.2], [0.25, 0.14, 0.11, 0, 2]], 15, 0.1, 0, 44), fur, [0, 0, 0]);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; M.P(R.chest, M.cone(0.05, 0.12, 7), fur2, [Math.sin(a) * 0.41, 0.05 + Math.sin(i * 1.7) * 0.012, Math.cos(a) * 0.245 - 0.012], [Math.PI + Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35]); }
    // belt, skull buckle, leather kilt
    belt(R, b, leather, null, 0.05);
    M.P(R.hips, M.sph(0.045, 16, 12), G.mat('bone'), [0, 0.05, 0.15 * b], 0, [1, 1.1, 0.8]);
    M.mirror(s => M.P(R.hips, M.sph(0.009, 6, 6), G.mat('col', { c: 0x111111 }), [s * 0.016, 0.06, 0.188 * b]));
    for (let i = 0; i < 11; i++) { const a = (i / 11) * Math.PI * 2 + 0.15; M.P(R.hips, M.box(0.075, 0.27, 0.014), G.mat('col', { c: i % 2 ? 0x5a3a22 : 0x4a2e1a, t: 'leather' }), [Math.sin(a) * 0.19 * b, -0.11, Math.cos(a) * 0.13 * b - 0.01], [Math.cos(a) * -0.12, a, Math.sin(a) * 0.12]); }
    // hammer grip: the haft leaves the fist on the thumb side, so the head rises above the hand, and the
    // edges face the knuckles (forward and back when carried upright)
    { const tw = new THREE.Group(), axe = M.weapon.axe(tier, true); tw.add(axe); tw.userData.tip = axe.userData.tip;
      const basis = (x, y, z) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
      tw.quaternion.copy(basis(new G.V3(0, -1, 0), new G.V3(1, 0, 0), new G.V3(0, 0, 1)));
      tw.position.set(0, -0.1, 0.035).sub(new G.V3(0, 0.16, 0).applyQuaternion(tw.quaternion));   // the right fist sits a little up the haft
      R.armR.hand.add(tw); R.weapon = tw;
      R.gripL = basis(new G.V3(0, -1, 0), new G.V3(-1, 0, 0), new G.V3(0, 0, -1));
      // at rest: carried upright in front, both hands on the haft
      const qW = new THREE.Quaternion(), qL = new THREE.Quaternion(), tg = new G.V3(), qR = new THREE.Quaternion(), qD = new THREE.Quaternion(), qE = new THREE.Quaternion(), qT = new THREE.Quaternion(), mD = new THREE.Matrix4();
      const hD = new G.V3(-0.08, 0.96, 0.22).normalize(), eD = new G.V3(0, -0.22, 0.96).projectOnPlane(hD).normalize(), zD = eD.clone().cross(hD);
      R.armPose = (R, st) => {
        if ((st.atk >= 0 && st.atk <= 1) || st.block || !G.anim || !G.anim.ik) return;
        const B = R.armR, A = R.armL;
        B.sh.rotation.set(-0.3 + B.sh.rotation.x * 0.25, 0.3, -0.25); B.el.rotation.set(-1.35, 0, 0);
        // orient the fist so the axe stands upright (leaning a touch forward) with its bits facing front and back
        R.root.updateMatrixWorld(true); R.root.getWorldQuaternion(qR);
        qD.setFromRotationMatrix(mD.makeBasis(eD, hD, zD)).premultiply(qR);
        B.el.getWorldQuaternion(qE); B.hand.quaternion.copy(qE.invert().multiply(qD).multiply(qT.copy(R.weapon.quaternion).invert()));
        R.root.updateMatrixWorld(true); R.weapon.localToWorld(tg.set(0, -0.08, 0));
        const res = G.anim.ik(R, A, 1, tg, 1); R.weapon.getWorldQuaternion(qW); qL.copy(qW).multiply(R.gripL.clone().invert());
        A.hand.quaternion.copy(res.qe.clone().invert().multiply(qL));
      }; }
  } else if (cls === 'rogue') {
    const lea = G.mat('col', { c: 0x2c2533, r: 0.7, t: 'hide' }), cloak = G.mat('col', { c: 0x2b1f3d, r: 0.95, t: 'cloth', ds: true }), strapM = G.mat('col', { c: 0x3a2c22, t: 'leather' }), dark = G.mat('col', { c: 0x111015, r: 0.8, ds: true });
    const b = 0.95;
    R = M.humanoid({ top: lea, bottom: G.mat('col', { c: 0x221d28, r: 0.75, t: 'hide' }), bulk: b, boots: G.mat('col', { c: 0x15121a, r: 0.7 }), hands: G.mat('col', { c: 0x15121a }), forearm: G.mat('col', { c: 0x1d1822, r: 0.8, t: 'hide' }), eye: 0x7a40ff });
    M.hood(R.head, cloak, 0.158);
    M.P(R.head, M.sph(0.134, 32, 12, Math.PI / 2 - 1.2, 2.4, Math.PI * 0.5, Math.PI * 0.26), dark, [0, 0.1, 0.0], 0, [0.92, 1, 1.2]);   // face mask, standing proud of the nose and lips
    M.P(R.head, M.tube([-0.09, 0.098, 0.1, -0.05, 0.1, 0.148, 0, 0.101, 0.162, 0.05, 0.1, 0.148, 0.09, 0.098, 0.1], 0.0045, 24, 6), dark);   // hem over the bridge of the nose
    // cowl over the shoulders, cape behind
    M.P(R.chest, M.drape('cowl', [[0.0, 0.345, 0.205, -0.012, 2.3], [0.09, 0.33, 0.195, -0.01, 2.3], [0.17, 0.275, 0.17, -0.005, 2.2], [0.225, 0.17, 0.125, 0, 2.1], [0.265, 0.095, 0.085, 0.004, 2]], 11, 0.06, 0, 44), cloak, [0, 0, 0], 0, [b, 1, b]);
    { const cg = new THREE.CylinderGeometry(0.21, 0.34, 1.0, 32, 14, true, Math.PI * 0.62, Math.PI * 0.76), cp = cg.attributes.position;
      for (let i = 0; i < cp.count; i++) { const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i), th = Math.atan2(x, z), k = (0.5 - y); const f = 1 + (Math.sin(th * 9) * 0.05 + Math.sin(th * 17 + 1) * 0.015) * k; cp.setXYZ(i, x * f, y + (Math.abs(Math.sin(th * 4.5)) * 0.04) * k * k, z * f - k * 0.05); }
      cg.computeVertexNormals(); R.cape = M.P(R.chest, cg, cloak, [0, -0.36, -0.02], 0, [1.0, 1, 0.78]);
      M.mirror(s => M.P(R.chest, M.cyl(0.024, 0.024, 0.01, 14), G.mat('gold'), [s * 0.13, 0.19, 0.075], [Math.PI / 2 - 0.4, 0, 0])); }
    // crossed bandoliers with throwing knives, belt with pouches and potions
    M.strap(R, strapM, 0.55, 0.05, b); M.strap(R, strapM, -0.55, 0.05, b);
    for (let i = 0; i < 4; i++) { const k = M.G(R.chest, [-0.05 - i * 0.032, 0.0 + i * 0.045, 0.142]); M.P(k, M.box(0.016, 0.07, 0.006), G.mat('steel'), [0, 0.035, 0], [0, 0, 0.55]); M.P(k, M.box(0.02, 0.022, 0.012), strapM, [0, 0, 0], [0, 0, 0.55]); }
    belt(R, b, strapM, G.mat('gold'), 0.05);
    M.mirror(s => { M.P(R.hips, M.box(0.07, 0.075, 0.045), G.mat('leather'), [s * 0.13, 0.0, 0.1], [0, s * 0.45, 0]); M.P(R.hips, M.cyl(0.018, 0.02, 0.08, 10), G.mat('col', { c: 0x40c040, tr: 0.7, e: 0x104010 }), [s * 0.17, 0.02, -0.07]); M.P(R.hips, M.cyl(0.01, 0.01, 0.02, 8), G.mat('wood'), [s * 0.17, 0.07, -0.07]); });
    [R.legL, R.legR].forEach((L, i) => { const s = i ? -1 : 1; M.P(L.hip, M.band(0.1, 0.105, 0.02, 0, 2), strapM, [0, -0.2, 0], 0, [b, 1, b]); const sh = M.G(L.hip, [s * 0.085, -0.22, 0.02], [0, 0, s * 0.1]); M.P(sh, M.cyl(0.018, 0.012, 0.2, 10), strapM, [0, 0, 0]); M.P(sh, M.cyl(0.012, 0.012, 0.06, 8), M.gripMat(), [0, 0.13, 0]); });
    R.weapon = hand(R.armR, M.weapon.dagger(tier));
    R.weapon2 = hand(R.armL, M.weapon.dagger(tier));
  } else if (cls === 'archer') {
    const green = G.mat('col', { c: 0x2f5a2a, t: 'cloth', r: 0.9, ds: true }), dgreen = G.mat('col', { c: 0x23461f, t: 'cloth', ds: true }), lea = G.mat('leather'), dlea = G.mat('darkleather');
    const b = 0.92;
    R = M.humanoid({ top: green, bottom: G.mat('col', { c: 0x4a3a28, t: 'leather' }), bulk: b, forearm: lea, boots: dlea, brow: 0xb07a3a, hair: 0x8a5a2a });
    M.hood(R.head, dgreen, 0.155);
    M.P(R.head, M.tube([0.1, 0.2, -0.02, 0.17, 0.3, -0.07, 0.2, 0.41, -0.15], 0.011, 14, 6, 0.8), G.mat('col', { c: 0xc03020 }));   // feather
    // dagged chaperon over the shoulders
    M.P(R.chest, M.drape('chaperon', [[0.02, 0.345, 0.205, -0.012, 2.3], [0.1, 0.33, 0.195, -0.01, 2.3], [0.175, 0.272, 0.168, -0.005, 2.2], [0.228, 0.165, 0.122, 0, 2.1], [0.265, 0.09, 0.082, 0.004, 2]], 16, 0.08, 0, 48), dgreen, [0, 0, 0], 0, [b, 1, b]);
    // tunic skirt, belt, pouch
    M.P(R.hips, M.drape('tunic', [[-0.36, 0.225, 0.165, 0, 2.3], [-0.28, 0.215, 0.157, 0, 2.3], [-0.06, 0.19, 0.134, -0.006, 2.4], [0.1, 0.175, 0.122, -0.008, 2.5]], 9, 0.045, 0, 40), green, [0, 0, 0], 0, [b, 1, b]);
    belt(R, b, lea, G.mat('bronze'), 0.07);
    M.P(R.hips, M.box(0.08, 0.09, 0.04), dlea, [-0.12, -0.02, 0.1], [0, -0.4, 0]);
    // quiver on the back with its strap
    const q = M.G(R.chest, [0.08, 0.05, -0.18], [0.2, 0, -0.35]);
    M.P(q, M.cyl(0.058, 0.048, 0.5, 20, 1, true), lea, [0, 0, 0]); M.P(q, M.cyl(0.048, 0.048, 0.02, 18), dlea, [0, -0.25, 0]);
    M.P(q, M.tor(0.058, 0.007, 6, 20), dlea, [0, 0.24, 0], [Math.PI / 2, 0, 0]); M.P(q, M.tor(0.054, 0.007, 6, 20), dlea, [0, -0.2, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 7; i++) { const a = M.weapon.arrow(0); a.rotation.set(-Math.PI / 2, 0, 0); a.position.set(Math.cos(i) * 0.025, 0.2, Math.sin(i) * 0.025); q.add(a); }
    M.strap(R, dlea, 0.62, 0.04, b);
    // laced leather bracers that follow the forearm
    [R.armL, R.armR].forEach((A, i) => { const sd = i ? -1 : 1; M.P(A.el, M.limbWrap('fore', sd, 0.24, 0.93, 0.007), dlea, [0, 0, 0], 0, [b, 1, b]); for (let k = 0; k < 3; k++) M.P(A.el, M.limbWrap('fore', sd, 0.34 + k * 0.2, 0.39 + k * 0.2, 0.011, 'st'), lea, [0, 0, 0], 0, [b, 1, b]); });
    R.weapon = M.weapon.bow(tier); R.bow = R.weapon; M.bowGrip(R.weapon, -1); R.armL.hand.add(R.weapon);
    // bow rides along the arm at rest and stands upright when drawn
    R.armPose = (R, st) => { if (!(st.atk >= 0) && !st.block && !(st.draw > 0)) { R.armL.sh.rotation.x -= 0.3; R.armL.sh.rotation.z += 0.12; R.armL.el.rotation.x = -1.25; } };
  } else if (cls === 'wizard') {
    const robe = G.mat('col', { c: 0x3a2a7a, t: 'cloth', r: 0.95, ds: true }), robe2 = G.mat('col', { c: 0x2c1f60, t: 'cloth', r: 0.95, ds: true }), trim = G.mat('col', { c: 0xffc14d, m: 0.7, r: 0.3 }), white = G.mat('col', { c: 0xbdbcb8, r: 1 });
    const b = 0.95;
    R = M.humanoid({ top: robe, bottom: robe, bulk: b, sleeve: robe, brow: 0xdddddd, skin: G.mat('col', { c: 0xe0b090, t: 'skin', r: 0.7 }) });
    R.legL.up.visible = R.legR.up.visible = false;
    // flowing robe with hem trim, open front panel, sash
    M.P(R.hips, M.drape('wizrobe', [[-0.9, 0.34, 0.27, 0, 2.2], [-0.62, 0.29, 0.22, 0, 2.2], [-0.3, 0.235, 0.17, -0.006, 2.3], [-0.05, 0.19, 0.135, -0.008, 2.4], [0.12, 0.17, 0.12, -0.008, 2.5]], 12, 0.06, 0, 48), robe, [0, 0, 0], 0, [b, 1, b]);
    M.P(R.hips, M.drapeHem('wizrobe'), trim, [0, 0, 0], 0, [b, 1, b]);
    M.P(R.hips, M.box(0.1, 0.84, 0.01), robe2, [0, -0.48, 0.2 * b], [-0.14, 0, 0]);
    for (let i = 0; i < 2; i++) M.P(R.hips, M.box(0.012, 0.84, 0.012), trim, [(i ? 1 : -1) * 0.05, -0.48, 0.205 * b], [-0.14, 0, 0]);
    M.P(R.torso, M.band(0.158, 0.11, 0.05, 0.006, 2.4), trim, [0, 0.0, 0], 0, [b, 1, b]);
    M.P(R.torso, M.box(0.05, 0.3, 0.01), trim, [0.09, -0.17, 0.115], [-0.05, 0, 0.08]);
    // high collar with trim, stole down the front
    M.P(R.chest, M.drape('wizcollar', [[0.17, 0.17, 0.12, -0.012, 2.2], [0.24, 0.12, 0.1, -0.01, 2.1], [0.32, 0.13, 0.115, -0.02, 2]], 8, 0.04, 0, 32), robe2, [0, 0, 0], 0, [b, 1, b]);
    M.mirror(s => M.P(R.chest, M.box(0.045, 0.3, 0.012), trim, [s * 0.06, 0.06, 0.15 - 0.012], [0.1, 0, s * -0.12]));
    // bell sleeves
    [R.armL, R.armR].forEach(A => { sleeve(A, robe, 0.06, 0.13, 0.27, 7); M.P(A.el, M.band(0.128, 0.122, 0.018, 0.01, 2), trim, [0, -0.262, 0]); });
    // pointed hat: drooping brim, bent crown, band and stars
    M.P(R.head, M.sculpt('wizbrim', [[-0.03, 0.25, 0.25, 0, 2], [-0.018, 0.235, 0.235, 0, 2], [0.0, 0.18, 0.18, 0, 2], [0.01, 0.12, 0.12, 0, 2], [0.012, 0.0, 0.0, 0, 2]], 44, 3), robe2, [0, 0.215, -0.01]);
    M.P(R.head, M.tube([0, 0.2, -0.01, 0, 0.33, -0.025, 0.012, 0.45, -0.065, 0.055, 0.54, -0.15, 0.1, 0.56, -0.2], 0.112, 32, 22, 0.96), robe, [0, 0, 0]);
    M.P(R.head, M.band(0.114, 0.114, 0.03, -0.01, 2), trim, [0, 0.245, 0]);
    for (let i = 0; i < 5; i++) M.P(R.head, M.oct(0.016), G.mat('emissive', { c: 0xffd060, i: 2 }), [Math.cos(i * 1.3) * 0.085, 0.3 + i * 0.045, Math.sin(i * 1.3) * 0.085 - i * 0.016]);
    // long beard, moustache, hair at the back
    M.P(R.head, M.sculpt('wizbeard', [[-0.27, 0.0, 0.0, 0.07, 2], [-0.22, 0.03, 0.022, 0.075, 2], [-0.1, 0.07, 0.045, 0.08, 2], [0.0, 0.088, 0.058, 0.07, 2], [0.07, 0.092, 0.07, 0.05, 2], [0.1, 0.08, 0.06, 0.04, 2]], 26), white, [0, 0, 0]);
    M.mirror(s => M.P(R.head, M.tube([0, 0.066, 0.128, s * 0.04, 0.06, 0.126, s * 0.07, 0.02, 0.105], 0.012, 12, 8, 0.6), white));
    M.P(R.head, M.sculpt('wizhair', [[-0.08, 0.1, 0.07, -0.06, 2], [0.02, 0.122, 0.09, -0.04, 2], [0.12, 0.128, 0.11, -0.02, 2]], 26, 4, 1), white, [0, 0.0, 0]);
    R.weapon = hand(R.armR, M.weapon.staff(tier));
    R.armPose = (R, st) => { if (!(st.atk >= 0)) { R.armR.sh.rotation.x = -0.15; R.armR.sh.rotation.z = -0.18; R.armR.el.rotation.x = -1.25; } };
  } else if (cls === 'priest') {
    const robe = G.mat('col', { c: 0xeee8d8, t: 'cloth', r: 0.95, ds: true }), trim = G.mat('col', { c: 0xe8b84a, m: 0.6, r: 0.35 }), red = G.mat('col', { c: 0x9a1a1a, t: 'cloth', ds: true });
    const b = 1.02;
    R = M.humanoid({ top: robe, bottom: robe, bulk: b, sleeve: robe, brow: 0x6a4a2a, hair: 0x6a4a2a });
    R.legL.up.visible = R.legR.up.visible = false;
    M.P(R.hips, M.drape('prrobe', [[-0.9, 0.33, 0.27, 0, 2.2], [-0.6, 0.29, 0.225, 0, 2.2], [-0.3, 0.24, 0.175, -0.006, 2.3], [-0.05, 0.195, 0.14, -0.008, 2.4], [0.12, 0.172, 0.12, -0.008, 2.5]], 10, 0.05, 0, 48), robe, [0, 0, 0], 0, [b, 1, b]);
    M.P(R.hips, M.drapeHem('prrobe'), trim, [0, 0, 0], 0, [b, 1, b]);
    // red stole: crossed over the chest, falling straight to the hem
    M.mirror(s => { M.P(R.chest, M.box(0.065, 0.27, 0.012), red, [s * 0.07, 0.08, 0.142], [0.12, 0, s * -0.3]); M.P(R.chest, M.box(0.065, 0.01, 0.014), trim, [s * 0.11, 0.2, 0.124], [0.3, 0, s * -0.3]); });
    M.P(R.hips, M.box(0.14, 0.78, 0.012), red, [0, -0.47, 0.198 * b], [-0.125, 0, 0]);
    for (let i = 0; i < 3; i++) M.P(R.hips, M.box(0.14, 0.012, 0.016), trim, [0, -0.1 - i * 0.3, 0.16 * b + i * 0.036], [-0.125, 0, 0]);
    M.P(R.hips, M.box(0.03, 0.12, 0.014), trim, [0, -0.66, 0.24 * b], [-0.125, 0, 0]); M.P(R.hips, M.box(0.08, 0.03, 0.014), trim, [0, -0.635, 0.236 * b], [-0.125, 0, 0]);
    M.P(R.torso, M.band(0.156, 0.108, 0.04, 0.006, 2.4), G.mat('col', { c: 0xc8b890, t: 'cloth' }), [0, 0.0, 0], 0, [b, 1, b]);
    // mitre: pointed front and back panels, gold orphreys and band, lappets behind
    M.P(R.head, M.sculpt('mitre', [[0.15, 0.118, 0.13, -0.008, 2.2], [0.24, 0.124, 0.11, -0.008, 2.2], [0.33, 0.112, 0.078, -0.008, 2.1], [0.4, 0.078, 0.048, -0.008, 2], [0.445, 0.03, 0.022, -0.008, 2], [0.46, 0.0, 0.0, -0.008, 2]], 34), robe, [0, 0, 0]);
    M.P(R.head, M.band(0.122, 0.132, 0.03, -0.008, 2.2), trim, [0, 0.165, 0]);
    M.mirror(s => M.P(R.head, M.tube([0, 0.17, s * 0.124 - 0.008, 0, 0.26, s * 0.106 - 0.008, 0, 0.35, s * 0.072 - 0.008, 0, 0.43, s * 0.03 - 0.008], 0.011, 16, 6), trim, [0, 0, 0], 0, [1.6, 1, 1]));
    M.P(R.head, M.box(0.012, 0.06, 0.012), trim, [0, 0.29, 0.104], [-0.25, 0, 0]); M.P(R.head, M.box(0.04, 0.012, 0.012), trim, [0, 0.3, 0.102], [-0.25, 0, 0]);
    M.mirror(s => M.P(R.head, M.box(0.04, 0.22, 0.006), robe, [s * 0.05, 0.06, -0.135], [0.08, 0, 0]));
    // halo + holy symbol on a chain
    M.P(R.head, M.tor(0.2, 0.008, 8, 48), G.mat('emissive', { c: 0xffe08a, i: 2 }), [0, 0.3, -0.12], [Math.PI / 2 - 0.3, 0, 0]);
    M.P(R.chest, M.tube([-0.072, 0.205, 0.05, -0.068, 0.155, 0.115, -0.04, 0.1, 0.143, 0, 0.083, 0.153, 0.04, 0.1, 0.143, 0.068, 0.155, 0.115, 0.072, 0.205, 0.05], 0.0035, 40, 5), trim, [0, 0, 0], 0, [b, 1, b]);   // chain resting on the chest
    M.P(R.chest, M.box(0.022, 0.075, 0.01), trim, [0, 0.06, 0.158], [0.1, 0, 0]); M.P(R.chest, M.box(0.055, 0.02, 0.01), trim, [0, 0.075, 0.158], [0.1, 0, 0]);
    [R.armL, R.armR].forEach(A => { sleeve(A, robe, 0.058, 0.12, 0.25, 6); M.P(A.el, M.band(0.118, 0.112, 0.018, 0.01, 2), trim, [0, -0.243, 0]); });
    // tome on the hip
    M.P(R.hips, M.box(0.12, 0.16, 0.05), G.mat('col', { c: 0x5a1a1a, t: 'leather' }), [0.2, -0.05, 0.05], [0, 0.4, 0]);
    M.P(R.hips, M.box(0.11, 0.15, 0.04), G.mat('col', { c: 0xe8dcc0, r: 0.9 }), [0.205, -0.05, 0.052], [0, 0.4, 0]);
    R.weapon = hand(R.armR, M.weapon.mace(tier));
  }
  R.cls = cls; R.twoHand = cls === 'barbarian'; R.wi = wi | 0;
  R.idleK = { knight: 'i1', rogue: 'i1', priest: 'i1', wizard: 'ist' }[cls] || null;
  if (wi) M.heroWeapon(R, cls, tier, wi);
  // name plate light & blob shadow handled elsewhere
  return R;
};
// swap the default weapon for one from the arsenal (third-person body)
M.heroWeapon = (R, cls, tier, wi) => {
  const W = G.weaponDef(cls, wi), drop = o => { if (o && o.parent) o.parent.remove(o); };
  const hand = (A, w) => M.grip(A, w, A === R.armR ? 1 : -1);
  if (W.id === 'spear') R.idleK = 'isp'; else if (W.id === 'sunstaff') R.idleK = 'ist'; else if (W.id === 'twinaxes') R.idleK = 'i1';
  if (cls === 'knight' || cls === 'priest') { drop(R.weapon); R.weapon = hand(R.armR, W.id === 'spear' ? M.weapon.spear(tier) : W.id === 'sunstaff' ? M.weapon.staffKind(tier, 'sun') : M.weapon.warhammer(tier, cls === 'priest')); }
  else if (cls === 'barbarian') {
    if (W.id === 'maul') { const tw = R.weapon; tw.children.slice().forEach(c => tw.remove(c)); const m = M.weapon.maul(tier); tw.add(m); tw.userData.tip = m.userData.tip; }
    else { drop(R.weapon); R.armPose = null; R.twoHand = false; R.gripL = null; R.weapon = hand(R.armR, M.weapon.axe(tier, false)); R.weapon2 = hand(R.armL, M.weapon.axe(tier, false)); R.guardK = 'gd'; }
  } else if (cls === 'rogue') { drop(R.weapon); R.weapon = hand(R.armR, W.id === 'rapier' ? M.weapon.rapier(tier) : M.weapon.kukri(tier)); if (W.id === 'kukris') { drop(R.weapon2); R.weapon2 = hand(R.armL, M.weapon.kukri(tier)); } }
  else if (cls === 'archer') { R.weapon.scale.setScalar(W.scale || 1); if (W.dark) { const wood = G.mat('wood'), dk = G.mat('col', { c: 0x241812, r: 0.45, m: 0.2 }); R.weapon.traverse(o => { if (o.isMesh && o.material === wood) o.material = dk; }); } }
  else if (cls === 'wizard') { drop(R.weapon); R.weapon = hand(R.armR, M.weapon.staffKind(tier, W.id)); }
};
// the same swap for the first-person viewmodel
M.vmWeapon = (V, cls, w, wi) => {
  const W = G.weaponDef(cls, wi), drop = o => { if (o && o.parent) o.parent.remove(o); };
  if (cls === 'knight' || cls === 'priest') {
    drop(V.weapon); V.weapon = W.id === 'spear' ? M.weapon.spear(w) : W.id === 'sunstaff' ? M.weapon.staffKind(w, 'sun') : M.weapon.warhammer(w, cls === 'priest');
    if (cls === 'knight') { V.weapon.rotation.set(-0.35, 0.15, -0.25); V.weapon.position.set(0, 0.02, -0.03); } else V.weapon.rotation.set(-0.45, 0.1, -0.25);
    V.R.hand.add(V.weapon);
  } else if (cls === 'barbarian') {
    if (W.id === 'maul') { V.weapon.remove(V.axe); V.axe = M.weapon.maul(w); V.weapon.add(V.axe); V.weapon.userData.tip = V.axe.userData.tip; }
    else { drop(V.weapon); V.axe = null; delete V.R.handRZ; delete V.R.handRX; V.twoHand = false; V.guard = 'gd';
      V.weapon = M.weapon.axe(w, false); V.weapon.rotation.set(-0.6, 0, -0.2); V.R.hand.add(V.weapon);
      V.weapon2 = M.weapon.axe(w, false); V.weapon2.rotation.set(-0.6, 0, 0.2); V.L.hand.add(V.weapon2); }
  } else if (cls === 'rogue') {
    drop(V.weapon); V.weapon = W.id === 'rapier' ? M.weapon.rapier(w) : M.weapon.kukri(w); V.weapon.rotation.set(-0.6, 0, -0.2); V.R.hand.add(V.weapon);
    if (W.id === 'kukris') { drop(V.weapon2); V.weapon2 = M.weapon.kukri(w); V.weapon2.rotation.set(-0.6, 0, 0.2); V.L.hand.add(V.weapon2); }
  } else if (cls === 'archer') { V.weapon.scale.multiplyScalar(W.scale || 1); if (W.dark) { const wood = G.mat('wood'), dk = G.mat('col', { c: 0x241812, r: 0.45, m: 0.2 }); V.weapon.traverse(o => { if (o.isMesh && o.material === wood) o.material = dk; }); } }
  else if (cls === 'wizard') {
    const r = V.weapon.rotation.clone(), p = V.weapon.position.clone(), sc = V.weapon.scale.x; drop(V.weapon);
    V.weapon = M.weapon.staffKind(w, W.id); V.weapon.rotation.copy(r); V.weapon.position.copy(p); V.weapon.scale.setScalar(sc); V.R.hand.add(V.weapon);
    V.orbLight = new THREE.PointLight(W.orb || 0xff7a30, 0.8, 4, 2); V.orbLight.position.set(0, 1.07, 0); V.weapon.add(V.orbLight);
  }
};

/* ---------- first-person viewmodels ---------- */
M.viewmodel = (cls, tier = 0, wi = 0) => {
  const V = { root: new THREE.Group(), cls, twoHand: cls === 'barbarian' };
  const gaunt = {
    knight: G.mat('col', { c: 0xb8bcc6, m: 0.9, r: 0.28 }), barbarian: G.mat('col', { c: 0xc98a62, r: 0.6, t: 'skin' }), rogue: G.mat('col', { c: 0x15121a, r: 0.7 }),
    archer: G.mat('col', { c: 0x2f5a2a, t: 'cloth' }), wizard: G.mat('col', { c: 0x3a2a7a, t: 'cloth' }), priest: G.mat('col', { c: 0xeee8d8, t: 'cloth' })
  }[cls];
  const handMat = cls === 'knight' ? gaunt : cls === 'rogue' ? gaunt : G.mat('col', { c: 0xd9a07a, t: 'skin' });
  // arms pivot at the elbow (just off-screen) so swings and stabs never detach the forearm from the screen edge
  const mkArm = (side) => {
    const A = M.G(V.root, [side * 0.36, -0.58, 0.08]); A.rotation.order = 'YXZ';
    const fore = M.G(A);
    const cloth = cls === 'archer' || cls === 'wizard' || cls === 'priest';
    M.P(fore, cloth ? M.limbCloth('vmFore', side, 8, 0.007) : M.limbS('vmFore', side), gaunt, [0, 0, 0], [Math.PI / 2, 0, 0]);
    if (cls === 'knight') { M.P(fore, M.cyl(0.07, 0.064, 0.18, 18), gaunt, [0, 0, -0.32], [Math.PI / 2, 0, 0]); M.P(fore, M.tor(0.07, 0.008, 6, 20), G.mat('gold'), [0, 0, -0.24]); M.P(fore, M.tor(0.05, 0.009, 6, 18), gaunt, [0, 0, -0.43]); }
    if (cls === 'archer' || cls === 'barbarian') { M.P(fore, M.limbWrap('vmFore', side, 0.5, 0.95, 0.008), G.mat('darkleather'), [0, 0, 0], [Math.PI / 2, 0, 0]); for (let k = 0; k < 3; k++) M.P(fore, M.limbWrap('vmFore', side, 0.56 + k * 0.13, 0.6 + k * 0.13, 0.013, 'st'), cls === 'barbarian' ? G.mat('bronze') : G.mat('leather'), [0, 0, 0], [Math.PI / 2, 0, 0]); }
    if (cls === 'wizard' || cls === 'priest') M.P(fore, M.cone(0.1, 0.3, 20, 1, true), gaunt, [0, 0, -0.2], [-Math.PI / 2, 0, 0]);
    // upper arm runs straight back from the elbow toward the shoulder, so swung arms always reach the screen edge
    M.P(fore, cloth ? M.limbCloth('vmUpper', side, 7, 0.008) : M.limbS('vmUpper', side), gaunt, [0, 0, 0.02], [-Math.PI / 2, 0, 0]);
    const hand = M.G(fore, [0, 0, -0.47]); hand.rotation.order = 'YXZ';
    const hg = M.handGeo(side, 1.15, handMat, true); hg.rotation.set(Math.PI / 2, 0, 0); hg.position.z = 0.02; hand.add(hg);
    return { A, fore, hand };
  };
  V.R = mkArm(1); V.L = mkArm(-1);
  V.rest = { R: [0.55, 0.16, 0], L: [0.55, -0.16, 0] };
  const w = tier;
  if (cls === 'knight') {
    V.weapon = M.weapon.sword(w); V.weapon.rotation.set(-0.35, 0.15, -0.25); V.weapon.position.set(0, 0.02, -0.03); V.R.hand.add(V.weapon);
    V.shield = M.weapon.shield(w); V.shield.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new G.V3(0, 0, 1), new G.V3(0, 1, 0), new G.V3(-1, 0, 0))); V.shield.position.set(-0.075, 0.02, -0.28); V.shield.scale.setScalar(0.85); V.L.fore.add(V.shield); V.rest.L = [0.42, -0.5, 0.12];
  } else if (cls === 'barbarian') {
    // haft rises from the top of the fist to the head; the bits are turned edge-forward at rest in animVM
    V.weapon = new THREE.Group(); V.axe = M.weapon.axe(w, true); V.weapon.add(V.axe); V.weapon.userData.tip = V.axe.userData.tip;
    // hammer grip in the viewmodel hand (hand space: thumb -x, knuckles -z): haft out of the thumb side, edges toward the knuckles
    V.weapon.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new G.V3(0, 0, -1), new G.V3(-1, 0, 0), new G.V3(0, 1, 0)));
    V.weapon.position.set(0, -0.04, -0.07).sub(new G.V3(0, 0.12, 0).applyQuaternion(V.weapon.quaternion)); V.R.handRZ = -2.2; V.R.handRX = -0.25; V.R.hand.add(V.weapon);   // at rest the head rides at the upper right, edge-on
  } else if (cls === 'rogue') {
    V.weapon = M.weapon.dagger(w); V.weapon.rotation.set(-0.6, 0, -0.2); V.R.hand.add(V.weapon);
    V.weapon2 = M.weapon.dagger(w); V.weapon2.rotation.set(-0.6, 0, 0.2); V.L.hand.add(V.weapon2);
  } else if (cls === 'archer') {
    V.weapon = M.weapon.bow(w); M.bowGrip(V.weapon, 1, new G.V3(0, 0, -1), new G.V3(0, -0.034, -0.062)); V.L.hand.add(V.weapon);
    V.arrow = M.weapon.arrow(w); V.arrow.rotation.y = Math.PI; V.weapon.add(V.arrow); V.rest.L = [0.7, -0.65, 0]; V.rest.R = [0.4, 0.6, 0]; V.L.A.position.set(-0.2, -0.38, -0.45);   // bow held canted across the body, its curve in view V.R.A.position.set(0.3, -0.42, -0.1);
  } else if (cls === 'wizard') {
    V.weapon = M.weapon.staff(w, 0xff6a20); V.weapon.rotation.set(-0.3, 0, -0.16); V.weapon.position.set(0, -0.62, 0); V.weapon.scale.setScalar(0.85); V.R.hand.add(V.weapon); V.rest.R = [0.5, 0.16, 0];
    V.orbLight = new THREE.PointLight(0xff7a30, 0.8, 4, 2); V.orbLight.position.set(0, 1.07, 0); V.weapon.add(V.orbLight);
  } else if (cls === 'priest') {
    V.weapon = M.weapon.mace(w); V.weapon.rotation.set(-0.45, 0.1, -0.25); V.R.hand.add(V.weapon);
    V.rest.L = [0.3, -0.32, 0];
    V.tome = M.G(V.L.hand, [0, 0.06, -0.08], [-1.15, 0.35, 0]);
    M.P(V.tome, M.box(0.2, 0.03, 0.26), G.mat('col', { c: 0x5a1a1a, t: 'leather' }));
    M.P(V.tome, M.box(0.19, 0.025, 0.25), G.mat('col', { c: 0x9a8a6a, r: 0.9 }), [0, 0.025, 0]);
    M.P(V.tome, M.box(0.03, 0.005, 0.12), G.mat('emissive', { c: 0xffd060, i: 2 }), [0, 0.04, 0]); M.P(V.tome, M.box(0.08, 0.005, 0.03), G.mat('emissive', { c: 0xffd060, i: 2 }), [0, 0.04, -0.02]);
  }
  if (wi) M.vmWeapon(V, cls, w, wi);
  V.root.scale.setScalar(0.62);
  V.restR = V.R.A.position.clone(); V.restL = V.L.A.position.clone();
  V.R.A.rotation.set(...V.rest.R); V.L.A.rotation.set(...V.rest.L);
  return V;
};
