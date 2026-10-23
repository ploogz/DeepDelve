/* ============================================================
   Cutscenes
   - portals: whenever the party commits (setting out from the hideout, a map vote, extracting, or the
     golden portal after a lord falls), the camera pulls out and watches every hero get dragged off their
     feet, spun, stretched and swallowed by the portal, then dives in after them
   - boss deaths: the camera circles the dying lord as light cracks out of it, it staggers, sinks to its
     knees, trembles and bursts apart
   Both run through G.cine (player input paused, damage ignored) as alternate "modes".
   ============================================================ */
'use strict';
(() => {
  const C = G.cinema = {}, cine = G.cine, upd0 = cine.update.bind(cine), abort0 = cine.abort.bind(cine);
  cine.update = function (dt, t) { if (this.mode) return this.mode.update(dt, t); return upd0(dt, t); };
  cine.abort = function () { if (this.mode) { const m = this.mode; m.end(true); return; } return abort0(); };
  const THEME_COL = { crypt: 0x9ad8ff, warrens: 0x9aff6a, forge: 0xff8a30, abyss: 0xb070ff, hideout: 0xffc060 };
  const sm = G.smooth, cl = G.clamp;
  const setFov = (f) => { const cam = G.camera; if (Math.abs(cam.fov - f) > 0.01) { cam.fov = f; cam.updateProjectionMatrix(); } };
  const flash = (rgb, a) => { if (G.screenFlash) G.screenFlash(rgb, a); };
  const fadeFlash = (rgb, from, dur) => { const t0 = performance.now(); const step = () => { const k = Math.min(1, (performance.now() - t0) / (dur * 1000)); flash(rgb, from * (1 - k)); if (k < 1) requestAnimationFrame(step); }; step(); };
  const begin = (mode, showRemotes) => {
    cine.active = true; cine.mode = mode; cine.showRemotes = showRemotes; document.body.classList.add('cine'); G.ui.releasePointer();
    const P = G.player; if (P && P.V) P.V.root.visible = false;
  };
  const finish = () => {
    cine.active = false; cine.mode = null; cine.showRemotes = false; document.body.classList.remove('cine');
    const P = G.player; if (P && P.V) P.V.root.visible = true; setFov(G.settings.fov); G.camera.rotation.order = 'YXZ';
  };
  // who is in the scene: you plus every visible ally
  const party = () => {
    const P = G.player, out = [];
    if (P && !P.dead) out.push({ cls: P.cls, w: P.wpnLv, wi: P.wid, x: P.pos.x, z: P.pos.z, yaw: P.yaw + Math.PI, me: true });
    Object.values(G.net.remotes).forEach(r => { if (r.root.visible) out.push({ cls: r.cls, w: r.w, wi: r.wi, x: r.pos.x, z: r.pos.z, yaw: r.yaw + Math.PI }); });
    return out;
  };

  /* ================= portals ================= */
  C.portal = function (o) {
    const P = G.player, W = G.World;
    if (!P || G.state !== 'play' || G.loading) { o.onDone(); return; }
    if (cine.active) { if (cine.mode && cine.mode.kind === 'boss') cine.mode.end(true); else { o.onDone(); return; } }
    // find the portal: the level's exit, the hideout's arch, or conjure one in front of the party
    let mesh = o.forceTemp ? null : o.mesh || (W.exitPortal && W.exitPortal.mesh) || ((W.animated || []).find(a => a.portal) || {}).portal, temp = null;
    if (!mesh || o.forceTemp || Math.hypot(mesh.position.x - P.pos.x, mesh.position.z - P.pos.z) > 40) {
      const f = P.forward ? P.forward() : new G.V3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)); let d = 5; if (W.W) d = Math.min(5, Math.max(2.5, W.rayWall(P.pos.x, P.pos.z, f.x, f.z, 6) - 1));
      temp = M.prop.portal(o.color); temp.position.set(P.pos.x + f.x * d, P.pos.y || 0, P.pos.z + f.z * d); temp.rotation.y = Math.atan2(-f.x, -f.z); G.scene.add(temp); mesh = temp;
      G.fx.burst(new G.V3(temp.position.x, temp.position.y + 1.2, temp.position.z), o.color, 60, 6);
    }
    const ry = mesh.rotation.y, n = new G.V3(Math.sin(ry), 0, Math.cos(ry)), side = new G.V3(n.z, 0, -n.x), base = mesh.position.clone(), Cc = base.clone().add(new G.V3(0, 1.0, 0));
    const list = party(); if (!list.length) { if (temp) G.scene.remove(temp); o.onDone(); return; }
    const S = { kind: 'portal', t: 0, n, side, C: Cc, base, temp, mesh, color: o.color, onDone: o.onDone, actors: [], done: false };
    list.sort((a, b) => (a.me ? -1 : 0) - (b.me ? -1 : 0));
    list.forEach((a, i) => {
      const R = M.hero(a.cls, a.w, a.wi); M.batchRig(R);
      // heroes far from the portal are brought into the shot, standing in front of it
      let p = new G.V3(a.x, 0, a.z); const rel = p.clone().sub(base), fwd = rel.dot(n);
      if (rel.length() > 13 || fwd < 1.2) { const lat = (i % 2 ? 1 : -1) * (0.9 + Math.floor(i / 2) * 0.9); p = base.clone().addScaledVector(n, 4.2 + Math.floor(i / 2) * 1.1).addScaledVector(side, lat); }
      if (W.W && W.isWall(p.x, p.z)) p = base.clone().addScaledVector(n, 3.5).addScaledVector(side, (i - list.length / 2) * 0.8);
      p.y = W.fy ? W.fy(p.x, p.z) : 0; R.root.position.copy(p); R.root.rotation.y = a.yaw; G.scene.add(R.root);
      const lat = (i - (list.length - 1) / 2) * 0.7;
      S.actors.push({ R, p0: p.clone(), stand: base.clone().addScaledVector(n, 1.9).addScaledVector(side, lat), st: { t: Math.random() * 5, move: 0, phase: 0, atk: -1 }, delay: 0.5 + i * 0.32, spin: 0, gone: false, me: a.me, pos: p.clone() });
    });
    // the camera starts wide and off to one side, clear of walls
    const camDir = n.clone().multiplyScalar(1).addScaledVector(side, 0.38).normalize(); let cd = 10; if (W.W) cd = Math.min(cd, Math.max(3, W.rayWall(base.x, base.z, camDir.x, camDir.z, 11) - 0.6));
    S.cam0 = base.clone().addScaledVector(camDir, cd).add(new G.V3(0, 3.3, 0)); S.cam1 = Cc.clone().addScaledVector(n, 0.4);
    S.update = (dt, t) => C.portalUpdate(S, dt, t); S.end = (aborted) => C.portalEnd(S, aborted);
    begin(S, false);
    G.sfx('portalwhoosh', 1); G.sfx('magic', 0.6); G.Lights.flash(Cc.clone(), o.color, 5, 16, 1.2);
    if (o.line) G.dm.say(o.line);
  };
  C.portalUpdate = (S, dt, t) => {
    S.t += dt; const T = S.t, cam = G.camera, Cc = S.C, col = S.color;
    // the portal roars: spin harder, suck the air in
    if (S.mesh && S.mesh.userData.spin) S.mesh.userData.spin.forEach((s, i) => s.rotation.z += dt * (i ? -1 : 1) * (2 + T * 3));
    for (let i = 0; i < 6; i++) { const a = Math.random() * 6.28, r = 2.2 + Math.random() * 1.6, px = Cc.x + S.side.x * Math.cos(a) * r + S.n.x * Math.random() * 1.5, py = Cc.y + Math.sin(a) * r * 0.8, pz = Cc.z + S.side.z * Math.cos(a) * r + S.n.z * Math.random() * 1.5; const v = Cc.clone().sub(new G.V3(px, py, pz)).multiplyScalar(1.6); G.fx.emit(G.fx.add, px, py, pz, v.x, v.y, v.z, 0.6, 0.12, 0.02, G.fx.hex(col, 1, 1.6), G.fx.hex(col, 0, 1)); }
    let last = 0;
    S.actors.forEach(a => {
      const u = T - a.delay, R = a.R, st = a.st; st.t += dt; last = Math.max(last, a.delay + 3.0);
      if (a.gone) return;
      if (u < 0.75) {
        // turn to the portal and take a few hesitant steps
        const k = cl(u / 0.75, 0, 1), tgt = a.p0.clone().lerp(a.stand, sm(k) * 0.55), was = a.pos.clone(); a.pos.copy(tgt);
        const sp = was.distanceTo(a.pos) / Math.max(dt, 1e-3); st.move = G.damp(st.move, cl(sp / 3, 0, 1), 10, dt); st.phase += dt * st.move * 9;
        R.root.rotation.y = G.lerpAng(R.root.rotation.y, Math.atan2(Cc.x - a.pos.x, Cc.z - a.pos.z), dt * 6);
        R.root.position.set(a.pos.x, (G.World.fy ? G.World.fy(a.pos.x, a.pos.z) : 0), a.pos.z); M.animHum(R, st);
      } else {
        // yanked off their feet: accelerating, spinning, stretched thin and shrinking into the light
        const k = u - 0.75, d = a.pos.distanceTo(Cc), sp = 0.7 + 4.2 * k * k; st.float = true; st.move = 0;
        const to = Cc.clone().sub(a.pos); if (d > 0.001) a.pos.addScaledVector(to.normalize(), Math.min(d, sp * dt));
        a.pos.y = G.lerp(a.pos.y, Cc.y - 0.9, cl(dt * 2, 0, 1)); a.spin += dt * (1.5 + 12 * k);
        const s = cl(d / 2.4, 0, 1), pull = cl(k / 0.8, 0, 1);
        R.root.position.copy(a.pos); R.root.rotation.set(0.6 * pull, Math.atan2(Cc.x - a.pos.x, Cc.z - a.pos.z) + a.spin, 0);
        R.root.scale.set(Math.max(0.02, s * (1 - 0.35 * pull)), Math.max(0.02, s * (1 + 0.45 * pull)), Math.max(0.02, s * (1 - 0.35 * pull)));
        M.animHum(R, st);
        R.armL.sh.rotation.set(-2.5 + Math.sin(st.t * 13) * 0.5, 0, 0.7); R.armR.sh.rotation.set(-2.3 + Math.cos(st.t * 11) * 0.5, 0, -0.7); R.legL.hip.rotation.x = Math.sin(st.t * 15) * 0.6; R.legR.hip.rotation.x = -Math.sin(st.t * 15) * 0.6;
        if (Math.random() < 0.6) G.fx.emit(G.fx.add, a.pos.x, a.pos.y + 1, a.pos.z, 0, 0, 0, 0.35, 0.18 * s + 0.03, 0, G.fx.hex(col, 1, 1.4), G.fx.hex(col, 0, 1));
        if (d < 0.35 || s < 0.06) { a.gone = true; R.root.visible = false; G.fx.burst(Cc.clone(), col, 40, 5); G.sfx('portalwhoosh', 0.8); G.Lights.flash(Cc.clone(), col, 6, 14, 0.5); if (a.me) G.fx.shake(0.3); }
      }
    });
    // camera: watch wide, drift in, then dive through after the last hero
    const allGone = S.actors.every(a => a.gone), endT = Math.max(2.6, Math.min(last, 6)), dive = sm(cl((T - endT + 0.4) / 1.1, 0, 1));
    const look = S.actors.reduce((s, a) => s.add(a.gone ? Cc : a.pos), new G.V3()).multiplyScalar(1 / S.actors.length).lerp(Cc, 0.45 + 0.55 * dive);
    const pos = S.cam0.clone().lerp(S.cam0.clone().lerp(Cc, 0.25), sm(cl(T / endT, 0, 1))).lerp(S.cam1, dive);
    const sh = G.fx.shakeAmt * G.fx.shakeAmt; cam.position.set(pos.x + (Math.random() - 0.5) * sh * 0.15, pos.y + (Math.random() - 0.5) * sh * 0.15, pos.z); cam.lookAt(look.x, look.y + 0.3, look.z);
    setFov(G.settings.fov + dive * 45);
    const fl = cl((T - endT - 0.3) / 0.45, 0, 1); flash([1, 1, 1], fl);
    if ((allGone && T > endT + 0.75) || T > 8) S.end(false);
  };
  C.portalEnd = (S, aborted) => {
    if (S.done) return; S.done = true;
    S.actors.forEach(a => G.scene.remove(a.R.root)); if (S.temp) G.scene.remove(S.temp);
    finish(); if (aborted) { flash([1, 1, 1], 0); return; }
    flash([1, 1, 1], 1);
    try { S.onDone(); } catch (e) { console.error(e); }
    setTimeout(() => fadeFlash([1, 1, 1], 1, 0.6), 250);
  };

  /* ================= boss deaths ================= */
  C.bossDeath = function (e) {
    const P = G.player; if (!P || G.state !== 'play') return;
    if (cine.active) return;   // never interrupt the door or a portal
    const th = G.World.theme, col = THEME_COL[th] || 0xffe0a0, sc = e.scale || 1, h = e.def.h * sc, r = e.def.r * sc;
    const S = { kind: 'boss', t: 0, e, col, h, r, beams: [], done: false, chest: new G.V3(e.pos.x, (e.pos.y || 0) + h * 0.55, e.pos.z) };
    S.a0 = Math.atan2(P.pos.x - e.pos.x, P.pos.z - e.pos.z) + 0.55; S.rad = Math.max(4.5, r * 3 + h * 0.95);
    // you can see yourself watching
    if (!P.dead) { const R = M.hero(P.cls, P.wpnLv, P.wid); M.batchRig(R); R.root.position.set(P.pos.x, P.pos.y || 0, P.pos.z); R.root.rotation.y = Math.atan2(e.pos.x - P.pos.x, e.pos.z - P.pos.z); G.scene.add(R.root); S.me = { R, st: { t: 0, move: 0, atk: -1 } }; }
    S.update = (dt, t) => C.bossUpdate(S, dt, t); S.end = (ab) => C.bossEnd(S, ab);
    begin(S, true); G.hitstop = Math.max(G.hitstop, 0.3);
    G.sfx('roar', 1, e.pos); G.sfx(e.def.groan || 'groan', 1, e.pos);
  };
  C.bossUpdate = (S, dt, t) => {
    S.t += dt; const T = S.t, e = S.e, cam = G.camera, P = G.player, W = G.World;
    // light splits out of the body: one beam after another
    if (!S.burst) {
      const want = Math.min(12, Math.floor(T / 0.28)); while (S.beams.length < want) { const d = new G.V3(Math.random() - 0.5, Math.random() * 0.9 - 0.15, Math.random() - 0.5).normalize(); const m = new THREE.Mesh(new THREE.ConeGeometry(0.12 * Math.max(1, S.r * 0.6), 1, 8, 1, true), new THREE.MeshBasicMaterial({ color: S.col, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); G.scene.add(m); S.beams.push({ m, d, len: 0 }); G.sfx('zap', 0.5, e.pos); }
      S.beams.forEach((b, i) => { b.len = Math.min(S.h * 2.2 + 3, b.len + dt * (5 + i)); const c = S.chest.clone().add(new G.V3(0, Math.sin(T * 3) * 0.05, 0)); b.m.position.copy(c).addScaledVector(b.d, b.len / 2); b.m.quaternion.setFromUnitVectors(new G.V3(0, -1, 0), b.d); b.m.scale.set(1 + Math.sin(T * 20 + i) * 0.2, b.len, 1 + Math.sin(T * 20 + i) * 0.2); });
      if (Math.random() < 0.7) G.fx.emit(G.fx.add, S.chest.x + (Math.random() - 0.5) * S.r * 2, S.chest.y + (Math.random() - 0.5) * S.h * 0.6, S.chest.z + (Math.random() - 0.5) * S.r * 2, 0, 1.5 + Math.random() * 2, 0, 1.2, 0.15, 0, G.fx.hex(S.col, 1, 1.6), G.fx.hex(S.col, 0, 1));
      if (Math.random() < dt * 4) G.fx.shake(0.15 + T * 0.05);
    }
    if (!S.burst && T > 4.0) {
      S.burst = true; const p = S.chest.clone();
      if (e.root.parent) G.fx.dismember(e.root, { cx: e.pos.x, cz: e.pos.z, up: 7, life: 16, max: 140 });
      G.enemies.remove(e); if (e.death) e.death.removed = true;
      S.beams.forEach(b => G.scene.remove(b.m)); S.beams = [];
      G.fx.burst(p, S.col, 160, 14, 0.5); G.fx.burst(p, 0xffffff, 60, 8, 0.4); G.fx.shockwave(new G.V3(e.pos.x, (e.pos.y || 0) + 0.2, e.pos.z), Math.max(10, S.r * 6), S.col, 0.9);
      G.fx.smoke(p, 20, 0x2a2430, 3, 1.5); G.fx.decal('scorch', e.pos.x, e.pos.z, Math.max(6, S.r * 8), 0xffffff, 120);
      G.Lights.flash(p, S.col, 14, 34, 1.4); G.fx.shake(1.3); G.sfx('boom', 1, e.pos); G.sfx('crit20', 0.8); flash([1, 1, 1], 0.6); fadeFlash([1, 1, 1], 0.6, 0.7);
    }
    if (S.burst && Math.random() < 0.8) G.fx.emit(G.fx.add, e.pos.x + (Math.random() - 0.5) * S.r * 4, (e.pos.y || 0) + Math.random() * 0.5, e.pos.z + (Math.random() - 0.5) * S.r * 4, 0, 1 + Math.random() * 2, 0, 2, 0.12, 0, G.fx.hex(S.col, 1, 1.4), G.fx.hex(S.col, 0, 1));
    // you, watching
    if (S.me) { S.me.st.t += dt; M.animHum(S.me.R, S.me.st); if (T > 4.1 && T < 4.6) { S.me.R.armR.sh.rotation.set(-1.6, 0.4, -0.2); S.me.R.armL.sh.rotation.set(-1.6, -0.4, 0.2); S.me.R.armL.el.rotation.x = S.me.R.armR.el.rotation.x = -1.8; } }
    // camera: a slow orbit, a pull back for the blast, then back into your eyes
    const a = S.a0 + T * 0.13, rad = S.rad * (T > 4 ? 1 + sm(cl((T - 4) / 0.6, 0, 1)) * 0.3 : 1 - T * 0.03), dx = Math.sin(a), dz = Math.cos(a);
    let rd = rad; if (W.W) rd = Math.min(rad, Math.max(2.5, W.rayWall(e.pos.x, e.pos.z, dx, dz, rad + 0.5) - 0.5));
    let pos = new G.V3(e.pos.x + dx * rd, (e.pos.y || 0) + S.h * 0.45 + 1.0 + T * 0.18, e.pos.z + dz * rd), look = S.chest.clone();
    if (T > 5.4 && P) { const k = sm(cl((T - 5.4) / 0.8, 0, 1)), eye = new G.V3(P.pos.x, (P.pos.y || 0) + 1.62, P.pos.z); pos.lerp(eye, k); look.lerp(eye.clone().add(new G.V3(-Math.sin(P.yaw) * 6, 0, -Math.cos(P.yaw) * 6)), k); if (S.me && k > 0.8) S.me.R.root.visible = false; }
    const sh = G.fx.shakeAmt * G.fx.shakeAmt; cam.position.set(pos.x + (Math.random() - 0.5) * sh * 0.2, pos.y + (Math.random() - 0.5) * sh * 0.2, pos.z); cam.lookAt(look);
    if (T > 6.2) S.end(false);
  };
  C.bossEnd = (S, aborted) => {
    if (S.done) return; S.done = true; if (S.pendingPortal) setTimeout(() => { if (G.run.active) sep0.apply(G.World, S.pendingPortal); }, 200); S.beams.forEach(b => G.scene.remove(b.m)); if (S.me) G.scene.remove(S.me.R.root);
    if (!S.burst && S.e) { const e = S.e; if (e.root.parent) G.fx.dismember(e.root, { cx: e.pos.x, cz: e.pos.z, up: 5, life: 12, max: 80 }); G.enemies.remove(e); }
    finish(); G.ui.lockSoon(); G.net.pushPresence(true);
  };
  // the lord's portal waits for the scene to end, so it doesn't open on top of the body
  const sep0 = G.World.spawnExitPortal.bind(G.World);
  G.World.spawnExitPortal = function (...args) { if (cine.mode && cine.mode.kind === 'boss' && !cine.mode.done) { cine.mode.pendingPortal = args; return; } return sep0(...args); };
  // the dying lord's body: stagger, kneel, tremble, glow
  const ud0 = G.enemies.updateDeath.bind(G.enemies);
  G.enemies.updateDeath = function (e, dt, t) {
    const D = e.death; if (!D || D.mode !== 'bossdie') return ud0(e, dt, t);
    if (D.removed) return; D.t += dt; const R = e.R, root = R.root, T = D.t, col = THEME_COL[G.World.theme] || 0xffe0a0;
    e.st.t += dt; M.preRig(R);
    const stag = sm(cl(T / 1.2, 0, 1)), kneel = sm(cl((T - 1.4) / 1.6, 0, 1)), trem = cl((T - 3.0) / 1.0, 0, 1), jit = (0.02 + trem * 0.06) * (e.def.r || 1);
    root.position.set((Math.random() - 0.5) * jit, (e.pos.y || 0) - kneel * 0.12 * e.def.h * (R.kind === 'hum' ? 0.6 : 1), (Math.random() - 0.5) * jit);
    root.rotation.x = -0.18 * stag * (1 - kneel) + 0.22 * kneel; root.rotation.z = Math.sin(T * 7) * 0.04 * stag;
    if (R.kind === 'hum') {
      R.hips.position.y = 0.95 - kneel * 0.45; R.legL.hip.rotation.set(-kneel * 1.2, 0, 0.1); R.legR.hip.rotation.set(-kneel * 0.3, 0, -0.1); R.legL.kn.rotation.set(kneel * 1.5, 0, 0); R.legR.kn.rotation.set(kneel * 1.9, 0, 0);
      R.torso.rotation.set(-0.35 * stag * (1 - kneel) + 0.35 * kneel, 0, 0); R.neck.rotation.set(-0.7 * stag * (1 - kneel * 0.6), Math.sin(T * 2) * 0.2, 0);
      R.armL.sh.rotation.set(-0.6 * stag - kneel * 0.4, 0, 1.0 * stag * (1 - kneel * 0.5)); R.armR.sh.rotation.set(-0.6 * stag - kneel * 0.4, 0, -1.0 * stag * (1 - kneel * 0.5)); R.armL.el.rotation.set(-0.3, 0, 0); R.armR.el.rotation.set(-0.3, 0, 0);
      if (R.jaw) R.jaw.rotation.x = 0.5 * stag;
    } else if (R.head) { R.head.rotation.x = -0.6 * stag * (1 - kneel) + 0.5 * kneel; if (R.jaw) R.jaw.rotation.x = 0.6 * stag; }
    if (D.bs === undefined) D.bs = root.scale.x; root.scale.setScalar(D.bs * (1 + trem * 0.05 * Math.sin(T * 40))); e.root.visible = true;
    const pulse = 0.6 + 0.4 * Math.sin(T * (8 + trem * 30));
    for (const o of e.mats || []) if (o.m.emissive) { o.m.emissive.setHex(col); o.m.emissiveIntensity = (0.12 + stag * 0.3 + trem * 0.9) * pulse; }
    M.smoothRig && M.smoothRig(R, e.st, 10);
  };
  // every lord dies on camera
  const kill0 = G.enemies.kill.bind(G.enemies);
  G.enemies.kill = function (e, type, opts) {
    const was = e && !e.dead; kill0(e, type, opts);
    if (was && e.boss && e.dead && e.death && e.death.mode !== 'flee' && G.run.active && G.state === 'play' && !cine.active) {
      if (e.iceMesh) G.fx.removeIce(e, false);
      e.death.mode = 'bossdie'; e.death.t = 0; e.root.rotation.set(0, e.root.rotation.y, 0); C.bossDeath(e);
    }
  };

  /* ================= when portals fire ================= */
  // the map vote resolves: dragged into the exit portal (or, extracting, a golden one home)
  const nf0 = G.game.netFloor.bind(G.game);
  G.game.netFloor = function (d) {
    if (d && !G.loading && G.run.active && d.r === G.run.id && !(cine.mode && cine.mode.kind === 'portal')) {
      if (d.k === 'go' && (d.s | 0) === G.run.row + 1) { G.RunMap.close(); C.portal({ color: 0x9a6aff, onDone: () => nf0(d), line: G.pick(['The portal takes you all, whether you are ready or not.', 'Down, then. The light swallows you whole.', 'The floor falls away into violet light.']) }); return; }
      if (d.k === 'x') { G.RunMap.close(); C.portal({ color: 0xffc040, forceTemp: true, onDone: () => nf0(d), line: 'A golden door opens. Home, with whatever you can carry.' }); return; }
    }
    return nf0(d);
  };
  // the golden portal after a lord falls
  const op0 = G.game.openPortal.bind(G.game);
  G.game.openPortal = function () {
    const ep = G.World.exitPortal;
    if (ep && ep.final && G.run.active && !cine.active) { C.portal({ color: 0xffc040, mesh: ep.mesh, onDone: () => op0(), line: G.run.delve ? 'Deeper still. The golden light pulls you down.' : 'The golden light carries you home.' }); return; }
    return op0();
  };
  // setting out from the hideout
  const ns0 = G.game.netStart.bind(G.game);
  G.game.netStart = function (d) {
    const ok = d && !G.run.active && G.state === 'play' && !G.loading && (G.DUNGEONS[d.dg] || d.dg === 'delve') && G.World.theme === 'hideout' && !cine.active;
    if (!ok) return ns0(d);
    if (G.ui.modalOpen()) { document.getElementById('panelM').hidden = true; G.dialog.close(false); }
    const dg = G.DUNGEONS[d.dg]; C.portal({ color: 0x9a6aff, onDone: () => ns0(d), line: `The portal flares. ${dg ? dg.name : 'The deep'} waits on the other side.` });
  };
})();
