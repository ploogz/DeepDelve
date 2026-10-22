/* ============================================================
   Emotes on 1 2 3 4. The camera swings out to third person so you can watch yourself,
   and the party sees the same dance on your avatar.
     1  Twerk                 3  Ballet (pirouettes into an arabesque)
     2  Tip-Toe (Jordans)     4  Lay down and die
   Move, attack, dodge or press the key again to stop.
   ============================================================ */
'use strict';
G.emotes = {
  LIST: [
    { id: 'twerk', key: 'Digit1', name: 'Twerk' },
    { id: 'tiptoe', key: 'Digit2', name: 'Tip-Toe in my Jordans' },
    { id: 'ballet', key: 'Digit3', name: 'Ballet' },
    { id: 'die', key: 'Digit4', name: 'Lay down and die' }
  ],
  byId(id) { return this.LIST.find(e => e.id === id); },

  /* ---------------- poses (written after the base walk/idle pose, before smoothing) ---------------- */
  pose(R, st) {
    const E = st.emote; if (!E) return; const t = E.t, L = R.legL, Rg = R.legR, A = R.armL, B = R.armR, sm = G.smooth, cl = G.clamp;
    const inK = sm(cl(t / 0.35, 0, 1));
    const set = (o, x, y, z) => { o.rotation.set(G.lerp(o.rotation.x, x, inK), G.lerp(o.rotation.y, y, inK), G.lerp(o.rotation.z, z, inK)); };
    R.body.position.set(0, 0, 0); R.body.rotation.set(0, 0, 0);
    if (E.id === 'twerk') {
      // back to the camera, deep squat, hands on knees, hips popping to the beat, glancing over the shoulder
      const f = t * 15, pop = Math.sin(f), bob = Math.abs(Math.sin(f));
      R.body.rotation.y = Math.PI * inK;
      R.hips.position.y = G.lerp(0.95, 0.66 + bob * 0.035, inK); R.hips.rotation.set(pop * 0.32 * inK, 0, Math.sin(f * 0.5) * 0.06 * inK);
      set(R.torso, 1.05 - pop * 0.32, Math.sin(f * 0.5) * 0.05, 0); set(R.chest, 0.05, 0, 0);
      set(R.neck, -0.85, 0.75, 0.12); set(R.head, 0, 0.25, 0);
      for (const [Lg, sd] of [[L, 1], [Rg, -1]]) { const hx = -1.05 - pop * 0.32; set(Lg.hip, hx, sd * 0.28, sd * 0.24); set(Lg.kn, 1.45, 0, 0); set(Lg.foot, -(hx + 1.45) * 0.9, 0, 0); }
      set(A.sh, -0.85, 0, 0.32); set(B.sh, -0.85, 0, -0.32); set(A.el, -0.25, 0, 0); set(B.el, -0.25, 0, 0);
    } else if (E.id === 'tiptoe') {
      // up on the toes, knees bent, slow exaggerated steps with a bounce, shoulders hunched, elbows out
      const f = t * 4.4, drift = Math.sin(t * 1.1);
      R.body.position.set(drift * 0.35 * inK, 0, Math.sin(t * 0.55) * 0.25 * inK); R.body.rotation.y = drift * 0.25 * inK;
      R.hips.position.y = G.lerp(0.95, 0.86 + Math.abs(Math.sin(f)) * 0.07, inK); R.hips.rotation.set(0, Math.sin(f) * 0.18 * inK, Math.sin(f) * 0.08 * inK);
      set(R.torso, 0.28, -Math.sin(f) * 0.15, 0); set(R.chest, 0.12, 0, 0);
      set(R.neck, -0.25 + Math.sin(f * 2) * 0.14, Math.sin(f) * 0.2, Math.sin(f) * 0.16); set(R.head, 0, 0, 0);
      for (const [Lg, ph, sd] of [[L, 0, 1], [Rg, Math.PI, -1]]) { const lift = Math.max(0, Math.sin(f + ph)), hx = -0.35 - lift * 0.95, kx = 0.6 + lift * 1.25; set(Lg.hip, hx, sd * 0.15, sd * 0.06); set(Lg.kn, kx, 0, 0); set(Lg.foot, 0.95 - (hx + kx), 0, 0); }
      const sw = Math.sin(f); set(A.sh, 0.15 + sw * 0.35, 0, 0.5); set(B.sh, 0.15 - sw * 0.35, 0, -0.5); set(A.el, -1.45, 0.3, 0); set(B.el, -1.45, -0.3, 0);
    } else if (E.id === 'ballet') {
      // two pirouettes on relevé with the arms in fifth position, then an arabesque; repeat
      const T = 4.2, c = t % T, spin = sm(cl((c - 0.2) / 1.7, 0, 1)), arab = sm(cl((c - 2.2) / 0.5, 0, 1)) * (1 - sm(cl((c - 3.7) / 0.5, 0, 1)));
      R.body.rotation.y = (Math.floor(t / T) * 2 + spin * 2) * Math.PI * 2 * inK;
      R.hips.position.y = G.lerp(0.95, 1.03 - arab * 0.04, inK); R.hips.rotation.set(0, 0, 0);
      set(R.torso, arab * 0.55, 0, 0); set(R.chest, -0.05, 0, 0); set(R.neck, -0.2 - arab * 0.35, 0, 0); set(R.head, 0, 0, 0);
      // standing leg: straight on the toes; working leg: passé while spinning, extended back in arabesque
      set(L.hip, 0, 0, 0.02); set(L.kn, 0, 0, 0); set(L.foot, 0.95, 0, 0);
      set(Rg.hip, G.lerp(-0.85, 1.35, arab), 0, G.lerp(-0.55, -0.05, arab)); set(Rg.kn, G.lerp(1.95, 0.05, arab), 0, 0); set(Rg.foot, 0.9, 0, 0);
      set(A.sh, G.lerp(-2.85, -1.55, arab), 0, G.lerp(0.3, 0.1, arab)); set(B.sh, G.lerp(-2.85, -0.25, arab), 0, G.lerp(-0.3, -1.35, arab));
      set(A.el, G.lerp(-0.55, -0.1, arab), 0, 0); set(B.el, G.lerp(-0.55, -0.1, arab), 0, 0);
    } else if (E.id === 'die') {
      // clutch the chest, stagger, topple onto the back, splay out; a last twitch
      const clutch = sm(cl(t / 0.3, 0, 1)) * (1 - sm(cl((t - 0.7) / 0.3, 0, 1))), fall = cl((t - 0.45) / 0.75, 0, 1), k = fall * fall * (3 - 2 * fall), land = Math.max(0, Math.sin(cl((t - 1.2) / 0.3, 0, 1) * Math.PI)) * 0.06;
      const twitch = t > 2.2 && t < 2.5 ? Math.sin((t - 2.2) * 60) * 0.25 : 0;
      R.body.rotation.x = -1.52 * k; R.body.position.set(0, 0.12 * k + land, 0.1 * k);
      R.hips.position.y = 0.95 - clutch * 0.12; R.hips.rotation.set(0, 0, 0);
      R.torso.rotation.set(clutch * 0.35, 0, Math.sin(t * 9) * 0.08 * clutch); R.chest.rotation.set(0, 0, 0);
      R.neck.rotation.set(clutch * 0.3 - k * 0.15, k * 0.75, 0); R.head.rotation.set(0, 0, 0);
      L.hip.rotation.set(-0.45 * k - clutch * 0.2, 0, 0.12 * k); L.kn.rotation.set(0.9 * k + clutch * 0.3, 0, 0); L.foot.rotation.set(-0.2 * k + twitch, 0, 0);
      Rg.hip.rotation.set(0.05 * k, 0, -0.2 * k); Rg.kn.rotation.set(0.1 * k + clutch * 0.3, 0, 0); Rg.foot.rotation.set(0.3 * k, 0, 0);
      A.sh.rotation.set(G.lerp(-0.9 * clutch, 0.4, k), 0, G.lerp(0.25, 1.35, k)); B.sh.rotation.set(G.lerp(-0.9 * clutch, 0.2, k), 0, G.lerp(-0.25, -1.1, k));
      A.el.rotation.set(G.lerp(-1.9 * clutch, -0.35, k), 0, 0); B.el.rotation.set(G.lerp(-1.9 * clutch, -0.8, k), 0, 0);
    }
  },

  /* ---------------- outfit: high-top sneakers for the tip-toe (plain red, white and black, no logos) ---------------- */
  dress(R, id) {
    const want = id === 'tiptoe';
    [R.legL, R.legR].forEach((Lg, i) => {
      if (!Lg || !Lg.foot) return;
      if (want && !Lg.kicks) {
        const g = new THREE.Group(), white = G.mat('col', { c: 0xf2f2f0, r: 0.6 }), red = G.mat('col', { c: 0xc8102e, r: 0.45 }), black = G.mat('col', { c: 0x111111, r: 0.5 });
        M.P(g, M.box(0.13, 0.045, 0.3), white, [0, 0.022, 0.05]);                                       // sole
        M.P(g, M.box(0.12, 0.09, 0.27), red, [0, 0.09, 0.045]);                                          // upper
        M.P(g, M.box(0.125, 0.05, 0.1), white, [0, 0.085, 0.14]);                                        // toe box
        M.P(g, M.cyl(0.07, 0.072, 0.16, 16), red, [0, 0.19, -0.03]);                                     // high-top collar
        M.P(g, M.box(0.128, 0.03, 0.2), black, [0, 0.13, 0.03], [0.25, 0, 0]);                           // overlay panel
        for (let k = 0; k < 4; k++) M.P(g, M.box(0.09, 0.008, 0.012), white, [0, 0.13 + k * 0.03, 0.105 - k * 0.035], [0.5, 0, 0]);   // laces
        M.P(g, M.box(0.03, 0.12, 0.02), black, [0, 0.21, -0.11]);                                        // heel tab
        g.userData.noSmooth = true; g.traverse(o => o.userData.noSmooth = true); Lg.foot.add(g); Lg.kicks = g;
      }
      Lg.foot.children.forEach(o => { if (o === Lg.kicks) return; if (o.isMesh) { if (o.userData.bootVis === undefined) o.userData.bootVis = o.visible; o.visible = want ? false : o.userData.bootVis; } });
      if (Lg.kicks) Lg.kicks.visible = want;
    });
  },

  /* ---------------- the local player ---------------- */
  start(P, id) {
    if (P.emote && P.emote.id === id) { this.stop(P); return; }
    if (P.dead || P.downed || P.cast || P.swing || P.leap || P.dash || P.yank || P.charge >= 0) return;
    const E = this.byId(id); if (!E) return;
    P.emote = { id, t: 0 }; P.emCam = { a: P.yaw, d: 0, k: 0 }; P.blocking = false;
    if (!P.tpBody || P.tpBody.key !== P.cls + P.wpnLv + ':' + P.wid) { if (P.tpBody) G.scene.remove(P.tpBody.root); const R = M.hero(P.cls, P.wpnLv, P.wid); M.batchRig(R); P.tpBody = { R, root: new THREE.Group(), st: { t: 0, move: 0, atk: -1 }, key: P.cls + P.wpnLv + ':' + P.wid }; P.tpBody.root.add(R.root); }
    G.scene.add(P.tpBody.root); P.tpBody.root.visible = true; this.dress(P.tpBody.R, id);
    G.ui.toast(`${E.name} · move or press ${E.key.slice(-1)} to stop`); G.net.pushPresence(true);
    if (id === 'die') { G.sfx('groan', 0.8); G.sfx('hurt', 0.4); }
  },
  stop(P) {
    if (!P.emote) return; P.emote = null; if (P.tpBody) { P.tpBody.root.visible = false; G.scene.remove(P.tpBody.root); }
    G.net.pushPresence(true);
  },
  // per frame while emoting: animate the body, orbit the camera around it (mouse turns the view)
  update(P, dt) {
    const E = P.emote; if (!E) return false; E.t += dt;
    const B = P.tpBody, st = B.st; st.t += dt; st.move = 0; st.atk = -1; st.emote = E; st.block = false;
    B.root.position.set(P.pos.x, P.y, P.pos.z); B.R.root.rotation.y = P.yaw + Math.PI; M.animHum(B.R, st);
    const C = P.emCam; C.a -= G.mouse.dx * 0.0035 * G.settings.sens; C.k = G.damp(C.k, 1, 3.5, dt);
    const dist = 3.4, h = E.id === 'die' ? 1.9 : 1.5, fx = -Math.sin(C.a), fz = -Math.cos(C.a);
    let d = dist; if (G.World.W) d = Math.min(dist, Math.max(0.8, G.World.rayWall(P.pos.x, P.pos.z, fx, fz, dist + 0.4) - 0.4));
    C.d = G.damp(C.d || 0.3, d, 6, dt);
    const cam = G.camera, eye = new G.V3(P.pos.x, P.y + 1.62, P.pos.z), want = new G.V3(P.pos.x + fx * C.d, P.y + G.lerp(1.62, h, C.k), P.pos.z + fz * C.d);
    cam.position.copy(eye.lerp(want, C.k)); cam.lookAt(P.pos.x, P.y + (E.id === 'die' ? 0.3 : 1.0), P.pos.z); cam.rotation.order = 'YXZ';
    if (P.V) P.V.root.visible = false;
    return true;
  }
};
