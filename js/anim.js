/* ============================================================
   Attack choreography shared by first and third person.
   Every attack is a path for the weapon tip in eye space
   (metres; x right, y up, -z forward from the eyes). Swings
   pivot on the shoulder and carry the tip through the screen
   centre; the cutting edge always faces the direction of travel.
   First person places the viewmodel forearm and hand to match;
   third person solves a two-bone arm to the same weapon pose,
   so a friend watching sees the motion you see.
   ============================================================ */
'use strict';
G.anim = (() => {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const SR = V(0.3, -0.42, 0.1), SL = V(-0.3, -0.42, 0.1), SC = V(0.12, -0.4, 0.1);
  const C = V(0, 0.02, -1.0);
  const cat = (p0, p1, p2, p3, t, out) => { const t2 = t * t, t3 = t2 * t; for (const k of ['x', 'y', 'z']) out[k] = 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3); return out; };
  const ease = (f, e) => e === 'lin' ? f : e === 'in' ? f * f : e === 'out' ? 1 - (1 - f) * (1 - f) : e === 'snap' ? 1 - Math.pow(1 - f, 3) : G.smooth(f);
  function path(keys, p, out) {
    if (p <= keys[0][0]) return out.copy(keys[0][1]);
    for (let i = 0; i < keys.length - 1; i++) { const a = keys[i], b = keys[i + 1]; if (p <= b[0]) { const f = ease((p - a[0]) / Math.max(1e-4, b[0] - a[0]), b[2]); return cat((keys[i - 1] || a)[1], a[1], b[1], (keys[i + 2] || b)[1], f, out); } }
    return out.copy(keys[keys.length - 1][1]);
  }
  // a swing that sweeps the tip through the screen centre from one side to the other
  const arc = (S, wind, back, p0, p1, fol, o = {}) => (h) => ({ type: 'arc', S, n: null, keys: [[0, wind], [h - 0.15, back, 'io'], [h - 0.07, p0, 'in'], [h, C, 'lin'], [h + 0.07, p1, 'lin'], [h + 0.26, fol, 'out']], win: [0.14, Math.min(0.92, h + 0.3)], ...o });
  // a straight, punchy stab toward the centre
  const line = (S, wind, back, ext, hold, o = {}) => (h) => ({ type: 'line', S, keys: [[0, wind], [h - (o.pull || 0.12), back, 'io'], [h, ext, o.snap || 'snap'], [h + hold, ext, 'lin']], win: [o.win0 || 0.12, Math.min(0.94, h + hold + 0.05)], dir: ext.clone().sub(back).normalize(), ...o });
  const MOVES = {
    slashR: arc(SR, V(0.62, 0.36, -0.5), V(0.7, 0.42, -0.42), V(0.6, 0.24, -0.75), V(-0.62, -0.24, -0.72), V(-0.62, -0.4, -0.5)),
    slashL: arc(SR, V(-0.38, 0.3, -0.78), V(-0.48, 0.36, -0.72), V(-0.58, 0.22, -0.76), V(0.62, -0.22, -0.72), V(0.62, -0.38, -0.5)),
    overR: arc(SC, V(0.12, 0.75, -0.38), V(0.14, 0.85, -0.28), V(0.07, 0.6, -0.8), V(-0.03, -0.42, -1.0), V(-0.04, -0.58, -0.98), { lead: 0.1 }),
    thrust: line(SR, V(0.26, -0.16, -0.3), V(0.3, -0.2, -0.16), V(0.02, -0.01, -1.05), 0.16),
    stab: line(SR, V(0.2, -0.18, -0.34), V(0.23, -0.22, -0.22), V(0.02, -0.01, -0.86), 0.1, { pull: 0.1 }),
    bolt: line(SR, V(0.24, -0.14, -0.42), V(0.27, -0.12, -0.3), V(0.06, 0.0, -0.78), 0.18, { pull: 0.16, snap: 'out' }),
    swipe: arc(SR, V(0.55, 0.32, -0.55), V(0.6, 0.38, -0.48), V(0.5, 0.22, -0.75), V(-0.55, -0.18, -0.75), V(-0.5, -0.3, -0.55), { lead: 0.7 }),
    nova: (h) => ({ type: 'arc', S: SC, keys: [[0, V(0.1, 0.34, -0.62)], [h - 0.12, V(0.08, 0.6, -0.48), 'io'], [h, V(0.04, -0.3, -0.72), 'in'], [h + 0.25, V(0.04, -0.36, -0.68), 'out']], win: [0.08, h + 0.3] }),
    holy: (h) => ({ type: 'arc', S: SC, keys: [[0, V(0.1, 0.34, -0.62)], [h, V(0.05, 0.9, -0.42), 'out'], [h + 0.3, V(0.05, 0.9, -0.42), 'lin']], win: [0.08, h + 0.35] }),
    channel: () => ({ type: 'arc', S: SC, keys: [[0, V(0.12, 0.3, -0.62)]], win: [0.12, 2] })
  };
  MOVES.lslash = MOVES.slashR;   // left-hand cut: the right-hand slash mirrored onto the off hand
  const ALIAS = { slam: 'overR', smash: 'overR', stabL: 'stab', cross: 'stab', cast: 'bolt' };
  /* guards (eye space, like the moves): the weapon is held out in front of the face, below the line of sight,
     never pulled back into the head. g2 = two-handed haft across the body, g1 = one-handed blade up at the
     right, gd = daggers crossed in an X just under the crosshair */
  const GUARD = { i2: { tip: V(0.16, 0.62, -0.5), B: V(-0.08, 1, -0.2) }, i1: { tip: V(0.34, 0.02, -0.6), B: V(0.1, 1, -0.6) }, isp: { tip: V(0.32, 0.5, -0.48), B: V(0.02, 1, -0.12) }, ist: { tip: V(0.3, 0.42, -0.52), B: V(0.03, 1, -0.06) }, g2: { tip: V(-0.46, 0.02, -0.52), B: V(-1, 0.45, -0.12) }, g1: { tip: V(0.04, 0.3, -0.62), B: V(-0.3, 1, -0.22) }, gd: { tip: V(-0.07, 0.04, -0.5), B: V(-0.55, 0.85, -0.25) }, gb: { tip: V(-0.08, 0.3, -0.66), B: V(0.75, 0.62, -0.1) } };
  const GUARDK = { barbarian: 'g2', priest: 'g1', rogue: 'gd', archer: 'gb' };
  function guard(k, mirror) {
    const g = GUARD[k], sx = mirror ? -1 : 1, tip = g.tip.clone(), B = g.B.clone().normalize(), S = SR.clone(); tip.x *= sx; B.x *= sx; S.x *= sx;
    const up = V(0, 0.35, -1), E = up.addScaledVector(B, -up.dot(B)).normalize();
    return { tip, B, E, S, w: 1, hand: tip.clone().addScaledVector(B, -0.55), left: !!mirror };
  }
  const LEFT = { stabL: 1, lslash: 1 };
  // build the eye-space frame for a move at progress p: {tip, B, E, S, w}
  const tmp = V(0, 0, 0), tmp2 = V(0, 0, 0);
  function frame(kind, p, hitAt, mirror, t) {
    const mk = MOVES[ALIAS[kind] || kind]; if (!mk) return null;
    const m = mk(hitAt == null ? 0.45 : hitAt), sx = mirror ? -1 : 1;
    const S = m.S.clone(); S.x *= sx;
    const tip = path(m.keys, p, V(0, 0, 0)); tip.x *= sx;
    if (kind === 'channel') { tip.x += Math.sin(t * 31) * 0.004; tip.y += Math.sin(t * 23) * 0.004 + Math.min(1, p) * 0.05; }
    let B, E;
    if (m.type === 'line') { B = m.dir.clone(); B.x *= sx; E = V(1, 0, 0).addScaledVector(B, -B.x).normalize(); }
    else {
      B = tip.clone().sub(S).normalize();
      const H = hitAt == null ? 0.45 : hitAt, lead = (m.lead ?? 1) * G.smooth(G.clamp((p - (H - 0.12)) / 0.1, 0, 1)) * (1 - G.smooth(G.clamp((p - (H + 0.08)) / 0.22, 0, 1)));
      // the strike plane: centre direction x travel direction through the centre
      const k = m.keys, ci = k.findIndex(q => q[1] === C); let mv;
      if (ci > 0) mv = k[ci + 1][1].clone().sub(k[ci - 1][1]); else mv = k[k.length - 1][1].clone().sub(k[0][1]);
      if (mv.lengthSq() < 1e-6) mv.set(-1, 0, 0);
      mv.x *= sx; const bc = (ci > 0 ? C.clone() : tip.clone()).sub(S).normalize(); const n = bc.clone().cross(mv).normalize();
      if (lead > 0.001) B.addScaledVector(mv.clone().normalize(), lead).normalize();
      E = n.clone().cross(B); if (E.lengthSq() < 1e-6) E.set(1, 0, 0); E.normalize();
    }
    const w = Math.min(G.smooth(G.clamp(p / m.win[0], 0, 1)), 1 - G.smooth(G.clamp((p - m.win[1]) / Math.max(0.05, 1 - m.win[1]), 0, 1)));
    return { tip, B, E, S, w, hand: tip.clone().addScaledVector(B, -0.55), left: !!LEFT[kind] || !!mirror };
  }
  // weapon orientation: local x -> edge, local y -> blade axis
  const qBasis = (x, y, out) => { const z = tmp2.copy(x).cross(y).normalize(); const xx = V(0, 0, 0).copy(y).cross(z).normalize(); return out.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xx, y, z)); };
  const qW = new THREE.Quaternion(), qInv = new THREE.Quaternion(), qA = new THREE.Quaternion(), qH = new THREE.Quaternion(), m4 = new THREE.Matrix4();

  /* ---------- first person ---------- */
  // places viewmodel arm `arm` ({A, fore, hand}) so `weapon` matches the frame; blends by weight w (0..1)
  function fpArm(arm, weapon, f, w, tipLocal) {
    if (!f || w <= 0.001) return;
    const s = 1 / 0.62, S = f.S.clone().multiplyScalar(s), tip = f.tip.clone().multiplyScalar(s);
    qBasis(f.E, f.B, qW);
    weapon.updateMatrix();
    qH.copy(qW).multiply(qInv.copy(weapon.quaternion).invert());
    const tl = (tipLocal || V(0, weapon.userData.tip || 0.8, 0)).clone().applyMatrix4(weapon.matrix).applyQuaternion(qH);
    let hand = tip.sub(tl); const dmin = 0.45 / 0.62, hl = hand.length(); if (hl < dmin) hand.multiplyScalar(dmin / Math.max(hl, 1e-3));
    placeFore(arm, S, hand, w);
    qA.copy(arm.A.quaternion).invert().multiply(qH); arm.hand.quaternion.slerp(qA, w);
  }
  function placeFore(arm, S, hand, w) {
    const F = hand.clone().sub(S); if (F.lengthSq() < 1e-6) F.set(0, 0, -1); F.normalize();
    const elbow = hand.clone().addScaledVector(F, -0.47);
    const z = F.clone().negate(), up = Math.abs(z.y) > 0.95 ? V(0, 0, 1) : V(0, 1, 0), y = up.addScaledVector(z, -up.dot(z)).normalize(), x = y.clone().cross(z);
    const q = new THREE.Quaternion().setFromRotationMatrix(m4.makeBasis(x, y, z));
    arm.A.position.lerp(elbow, w); arm.A.quaternion.slerp(q, w);
  }

  /* ---------- third person ---------- */
  const EYE = V(0, 1.58, 0.12);
  const toWorld = (R, v, pitch, isDir) => { const e = v.clone().applyAxisAngle(V(1, 0, 0), pitch || 0); const c = V(-e.x, e.y, -e.z); return isDir ? c.transformDirection(R.root.matrixWorld) : R.root.localToWorld(c.add(EYE)); };
  const L1 = 0.31, L2 = 0.29;
  // two-bone arm: shoulder -> hand target, with the elbow dropping down and out
  function ik(R, A, side, target, w) {
    const S = A.sh.getWorldPosition(V(0, 0, 0)), d0 = target.clone().sub(S); let d = d0.length(); const u = d0.normalize();
    d = G.clamp(d, 0.1, L1 + L2 - 0.002);
    const pole = V(side * 0.6, -1, -0.35).transformDirection(R.root.matrixWorld); const pv = pole.addScaledVector(u, -pole.dot(u)); if (pv.lengthSq() < 1e-5) pv.set(0, -1, 0); pv.normalize();
    const ca = G.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1), sa = Math.sqrt(1 - ca * ca);
    const elbow = S.clone().addScaledVector(u, L1 * ca).addScaledVector(pv, L1 * sa), hand = S.clone().addScaledVector(u, d);
    const hinge = u.clone().cross(pv).normalize();
    const bone = (from, to) => { const y = from.clone().sub(to).normalize(), x = hinge.clone().addScaledVector(y, -hinge.dot(y)).normalize(), z = x.clone().cross(y); return new THREE.Quaternion().setFromRotationMatrix(m4.makeBasis(x, y, z)); };
    const qs = bone(S, elbow), qe = bone(elbow, hand), pq = A.sh.parent.getWorldQuaternion(new THREE.Quaternion());
    A.sh.quaternion.slerp(pq.invert().multiply(qs), w);
    A.el.quaternion.slerp(qs.clone().invert().multiply(qe), w);
    return { qe, hand };
  }
  function tpWeapon(R, A, side, weapon, f, pitch, w, two) {
    const S = A.sh.getWorldPosition(V(0, 0, 0));
    const hv = f.hand.clone().sub(f.S), dirW = toWorld(R, hv.clone().normalize(), pitch, true);
    const r = G.clamp(hv.length() * 1.25 + 0.08, 0.2, L1 + L2 - 0.02);
    const target = S.clone().addScaledVector(dirW, r);
    const res = ik(R, A, side, target, w);
    qBasis(toWorld(R, f.E, pitch, true), toWorld(R, f.B, pitch, true), qW);
    weapon.updateMatrix(); qH.copy(qW).multiply(qInv.copy(weapon.quaternion).invert());
    A.hand.quaternion.slerp(res.qe.clone().invert().multiply(qH), w);
    if (two) { R.root.updateMatrixWorld(true); const g2 = toWorld(R, f.B, pitch, true); const h2 = res.hand.clone().addScaledVector(g2, -0.24); const r2 = ik(R, two, -side, h2, w); const qH2 = R.gripL ? qW.clone().multiply(R.gripL.clone().invert()) : qH; two.hand.quaternion.slerp(r2.qe.clone().invert().multiply(qH2), w); }
  }
  const COARSE = { slash: 'slashR', overhead: 'overR', thrust: 'thrust', cast: 'bolt' };
  const HIT = { knight: 0.45, barbarian: 0.48, rogue: 0.45, priest: 0.46, wizard: 0.45 };
  function tp(R, st) {
    if (!R.cls || !R.weapon) return;
    const p = st.atk, pitch = st.pitch || 0;
    let kind = st.move2 || (p >= 0 ? (R.cls === 'wizard' && st.atkKind === 'cast' ? 'bolt' : COARSE[st.atkKind]) : null);
    if (st.cast >= 0 && R.cls !== 'archer') kind = 'channel';
    if (R.cls === 'archer' && st.block && !(st.draw > 0)) { R.root.updateMatrixWorld(true); tpWeapon(R, R.armL, 1, R.bow, guard('gb'), pitch, 1); return; }
    if (R.cls === 'archer') return tpBow(R, st);
    const gk = R.guardK || GUARDK[R.cls];
    if (st.block && !(p >= 0 && p <= 1) && kind !== 'channel' && gk) {
      R.root.updateMatrixWorld(true); if (R.weaponTwist) R.weaponTwist.rotation.y = 0;
      tpWeapon(R, R.armR, -1, R.weapon, guard(gk), pitch, 1, R.twoHand ? R.armL : null);
      if (gk === 'gd' && R.weapon2) { R.root.updateMatrixWorld(true); tpWeapon(R, R.armL, 1, R.weapon2, guard('gd', true), pitch, 1); }
      return;
    }
    if ((!kind || !(p >= 0 && p <= 1)) && kind !== 'channel') {
      // idle carry: weapons held up out of the fist in front of the body (dual wielders carry both)
      if (R.idleK && !st.block && !st.emote) { R.root.updateMatrixWorld(true); tpWeapon(R, R.armR, -1, R.weapon, guard(R.idleK), 0, 1); if (R.weapon2) { R.root.updateMatrixWorld(true); tpWeapon(R, R.armL, 1, R.weapon2, guard(R.idleK, true), 0, 1); } }
      return;
    }
    if (!MOVES[ALIAS[kind] || kind]) return;
    const f = frame(kind, kind === 'channel' ? st.cast : p, st.hitAt || HIT[R.cls], false, st.t); if (!f) return;
    R.root.updateMatrixWorld(true);
    if (R.weaponTwist) R.weaponTwist.rotation.y = 0;
    // the carry pose sits under the swing, so the blade rises out of guard and settles back into it instead of drooping
    if (R.twoHand && f.w < 0.999 && kind !== 'channel') { tpWeapon(R, R.armR, -1, R.weapon, guard('i2'), 0, 1, R.armL); R.root.updateMatrixWorld(true); }
    if (R.idleK && f.w < 0.999 && kind !== 'channel') { tpWeapon(R, R.armR, -1, R.weapon, guard(R.idleK), 0, 1); if (R.weapon2) tpWeapon(R, R.armL, 1, R.weapon2, guard(R.idleK, true), 0, 1); R.root.updateMatrixWorld(true); }
    const leftOnly = kind === 'stabL' || kind === 'lslash';
    if (!leftOnly) tpWeapon(R, R.armR, -1, R.weapon, f, pitch, f.w, R.twoHand ? R.armL : null);
    if ((kind === 'stabL' || kind === 'cross' || kind === 'lslash') && R.weapon2) { const fl = frame(kind === 'lslash' ? 'slashR' : 'stab', p, st.hitAt || HIT[R.cls], true, st.t); R.root.updateMatrixWorld(true); tpWeapon(R, R.armL, 1, R.weapon2, fl, pitch, fl.w); }
  }
  // archer in third person: bow arm straight at the target, draw hand to the string
  const G0 = V(-0.11, -0.045, -0.56);
  function bowFrame(pitch) { const F = V(0, 0, -30).sub(G0).normalize(); return { grip: G0, F }; }
  function tpBow(R, st) {
    const raise = st.draw !== undefined && st.draw >= 0 ? 1 : st.after > 0 && st.after < 0.7 ? 1 - G.smooth(Math.max(0, st.after - 0.45) / 0.25) : 0;
    if (raise <= 0.01) return;
    const pitch = st.pitch || 0, bf = bowFrame(pitch); R.root.updateMatrixWorld(true);
    const S = R.armL.sh.getWorldPosition(V(0, 0, 0)), dir = toWorld(R, bf.grip.clone().sub(SL).normalize().multiplyScalar(0.35).add(V(0, 0.05, -1).normalize().multiplyScalar(0.65)).normalize(), pitch, true);   // bow arm points almost straight at the target, so the wrist stays straight
    const res = ik(R, R.armL, 1, S.clone().addScaledVector(dir, 0.56), raise);
    const fw = toWorld(R, bf.F, pitch, true), up = toWorld(R, V(0, 1, 0), pitch, true);
    const z = fw.clone().negate(), y = up.addScaledVector(z, -up.dot(z)).normalize(), x = y.clone().cross(z);
    qW.setFromRotationMatrix(m4.makeBasis(x, y, z)); R.bow.updateMatrix(); qH.copy(qW).multiply(qInv.copy(R.bow.quaternion).invert());
    R.armL.hand.quaternion.slerp(res.qe.clone().invert().multiply(qH), raise);
    R.root.updateMatrixWorld(true);
    const draw = st.draw > 0 ? st.draw : 0, nock = R.bow.localToWorld(V(0, -0.0, 0.1 + draw * 0.62));
    ik(R, R.armR, -1, nock, raise);
    R._draw = draw; R._bowUp = raise; R._after = st.after || 0;
  }
  return { ik, guard, GUARDK, MOVES, ALIAS, frame, fpArm, placeFore, tp, isMove: k => !!MOVES[ALIAS[k] || k], G0, SR, SL };
})();
