/* ============================================================
   Skull bowling: two full-length lanes (60 feet from the foul line to the head pin) in the Grand Arcade
   - the ball is a skull, the pins are carved bone; real physics on the lane: an oiled front that lets the
     ball skid, a dry back end where your hook bites, gutters, pins that fly, topple and take each other out
   - ten frames, strikes and spares scored properly, the tenth frame's bonus balls, 1 to 6 bowlers per lane
   - walk up to the approach on your turn and press E · mouse aims · A/D slides your starting spot ·
     click to start the spin needle, click to set the hook, click to stop the power bar and bowl · right click backs up
   ============================================================ */
'use strict';
(() => {
  const TB = G.tables, GM = TB.GAMES, UI = G.ui, R = Math.random, T = G.tavern;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // everything a touch bigger than regulation (SC), so the pins and ball read well from the approach
  const SC = 1.18, LW = 1.066 * SC, LEN = 18.29 * SC, PR = 0.06 * SC, PH = 0.381 * SC, BR = PH * 0.573 / 2, GUT = BR * 2 * 1.12, STEP = 1 / 240, LY = 0.13, OIL = 12 * SC, MB = 7, MP = 1.5;
  const DECK = LEN + 0.95 * SC, PIT = LEN + 2.7 * SC, PIT_Y = -0.5, GUT_Y = -GUT / 2;   // a ball in the gutter rests on the bottom of the channel   // the pin deck ends at DECK; the pit runs back to PIT and is half a metre deep
  const PINS = []; for (let row = 0; row < 4; row++) for (let j = 0; j <= row; j++) PINS.push([LEN + row * 0.2639 * SC, (j - row / 2) * 0.3048 * SC]);
  const B = G.bowl = { lanes: [], aim: null, LEN, SC, DECK, PIT };
  const now = () => Date.now(), me = () => G.net.myId();

  /* ================= physics =================
     The ball rolls (skids on the oil, hooks on the dry back end) and drops into a gutter if it leaves the lane.
     Each pin has a base that slides and hops, and a tilt that behaves like an inverted pendulum: a small nudge
     rocks it and it settles back, a real hit tips it past its balance point and it falls. A falling pin is a
     capsule from base to head, so its head sweeps through its neighbours and takes them with it. Pins fly off
     the kickbacks, drop into the gutters, or go over the back of the deck into the pit. */
  const TC = 0.16, KT = 9.8 / (0.55 * PH), II = 3 / (MP * PH * PH), HALF = LW / 2;
  const jit = (i, k) => (((i + 1) * 2654435761 + (k + 1) * 40503) >>> 0) / 4294967296;   // deterministic per pin, no Math.random in the sim
  B.newSim = (pins, shot, no) => { const sp = 5.6 + shot.pow * 4.6;
    return { no, t: 0, done: false, acc: 0, clatter: 0, rest: 0,
      ball: { u: -0.3, v: shot.pos, h: 0, vh: 0, vu: Math.cos(shot.ang) * sp, vv: Math.sin(shot.ang) * sp, hook: shot.hook, gutter: false, pit: false, out: false },
      pins: PINS.map((p, i) => ({ i, u: p[0], v: p[1], h: 0, vh: 0, vu: 0, vv: 0, th: 0, om: 0, ax: 1, az: 0, psi: jit(i, 7) * 6.28, on: !!pins[i], gone: !pins[i], down: !pins[i], gut: false, pit: false, hits: 0 })) }; };
  // a pin's head in plan view (its base is at u, v)
  const head = (p) => { const r = PH * Math.sin(p.th); return [p.u + p.ax * r, p.v + p.az * r]; };
  const prad = (p) => PR * (p.th < 0.3 ? 1 : 0.82);
  // closest points between segments AB and CD in the plane: [s, t, dx, dz, dist] (s, t along each)
  const segseg = (ax, az, bx, bz, cx, cz, dx, dz) => {
    const d1x = bx - ax, d1z = bz - az, d2x = dx - cx, d2z = dz - cz, rx = ax - cx, rz = az - cz, a = d1x * d1x + d1z * d1z, e = d2x * d2x + d2z * d2z, f = d2x * rx + d2z * rz;
    let s0 = 0, t0 = 0;
    if (a < 1e-9 && e < 1e-9) { s0 = t0 = 0; }
    else if (a < 1e-9) { t0 = G.clamp(f / e, 0, 1); }
    else { const c = d1x * rx + d1z * rz; if (e < 1e-9) { s0 = G.clamp(-c / a, 0, 1); } else { const b = d1x * d2x + d1z * d2z, den = a * e - b * b; s0 = den > 1e-9 ? G.clamp((b * f - c * e) / den, 0, 1) : 0; t0 = (b * s0 + f) / e; if (t0 < 0) { t0 = 0; s0 = G.clamp(-c / a, 0, 1); } else if (t0 > 1) { t0 = 1; s0 = G.clamp((b - c) / a, 0, 1); } } }
    const px = ax + d1x * s0, pz = az + d1z * s0, qx = cx + d2x * t0, qz = cz + d2z * t0; return [s0, t0, qx - px, qz - pz, Math.hypot(qx - px, qz - pz)];
  };
  // the velocity of a point a fraction s along a pin (base slide plus the head's swing)
  const pvel = (p, s) => { const k = p.om * PH * Math.cos(p.th) * s; return [p.vu + p.ax * k, p.vv + p.az * k]; };
  // an impulse (jx, jz) at height arm above the base: the pin slides, tips toward the blow, and hops a little
  const hitPin = (S, p, jx, jz, arm) => {
    p.vu += jx / MP * 0.85; p.vv += jz / MP * 0.85;
    if (p.th < 0.35) { const wx = p.ax * p.om + jx * arm * II, wz = p.az * p.om + jz * arm * II, m = Math.hypot(wx, wz); if (m > 1e-6) { p.ax = wx / m; p.az = wz / m; p.om = m; } }
    else p.om += (jx * p.ax + jz * p.az) * arm * II;
    const J = Math.hypot(jx, jz); p.vh += J / MP * 0.09 * (0.5 + jit(p.i, p.hits++)); if (J > 1.2) S.clatter++;
  };
  B.step = (S) => {
    const b = S.ball, dt = STEP;
    // ---- the ball ----
    if (!b.out) {
      if (!b.gutter && !b.pit) { if (b.u > OIL && b.u < LEN) b.vv += b.hook * 0.95 * SC * dt; b.u += b.vu * dt; b.v += b.vv * dt;
        if (Math.abs(b.v) > HALF + 0.01 && b.u < DECK) { b.gutter = true; S.gutterSfx = 1; } }
      else { b.u += b.vu * dt; if (b.gutter) { const c = Math.sign(b.v) * (HALF + GUT / 2); b.v += (c - b.v) * Math.min(1, dt * 12); b.vv = 0; b.h += (GUT_Y - b.h) * Math.min(1, dt * 10); } }
      if (!b.pit && b.u > DECK) { b.pit = true; b.gutter = false; }
      if (b.pit) { b.vh -= 9.8 * dt; b.h += b.vh * dt; if (b.h < PIT_Y) { b.h = PIT_Y; b.vh = 0; } if (b.u > PIT - BR) { b.u = PIT - BR; b.vu = 0; } }
      b.vu = Math.max(0, b.vu - 0.25 * dt);
      if (b.vu < 0.05 || (b.pit && b.h <= PIT_Y + 0.01 && b.vu < 0.5)) b.out = true;
    }
    // ---- ball against pins ----
    if (!b.gutter && !b.out && b.u > LEN - 0.6) for (const p of S.pins) { if (p.gone || p.gut) continue; const [hx, hz] = head(p), r = BR + prad(p);
      const [, t, dx, dz, d] = segseg(b.u, b.v, b.u, b.v, p.u, p.v, hx, hz); if (d >= r || d < 1e-9) continue;
      const nx = dx / d, nz = dz / d, [pvx, pvz] = pvel(p, t), vn = (b.vu - pvx) * nx + (b.vv - pvz) * nz;
      if (vn > 0) { const J = (1 + 0.62) * vn / (1 / MB + 1 / MP); b.vu -= J / MB * nx; b.vv -= J / MB * nz; hitPin(S, p, J * nx, J * nz, p.th < 0.35 ? BR * 0.95 : t * PH); }
      const o = r - d; p.u += nx * o; p.v += nz * o; }
    // ---- pins against pins: capsules, so a falling pin's head sweeps its neighbours ----
    for (let i = 0; i < 10; i++) { const a = S.pins[i]; if (a.gone || a.pit) continue; const aMov = a.om !== 0 || a.vu * a.vu + a.vv * a.vv > 1e-4 || a.th > 0.01;
      for (let j = i + 1; j < 10; j++) { const c = S.pins[j]; if (c.gone || c.pit || (a.gut !== c.gut)) continue; const cMov = c.om !== 0 || c.vu * c.vu + c.vv * c.vv > 1e-4 || c.th > 0.01; if (!aMov && !cMov) continue;
        const [ahx, ahz] = head(a), [chx, chz] = head(c), r = prad(a) + prad(c);
        const [sa, sc, dx, dz, d] = segseg(a.u, a.v, ahx, ahz, c.u, c.v, chx, chz); if (d >= r || d < 1e-9) continue;
        const nx = dx / d, nz = dz / d, [avx, avz] = pvel(a, sa), [cvx, cvz] = pvel(c, sc), vn = (avx - cvx) * nx + (avz - cvz) * nz;
        if (vn > 0) { const J = (1 + 0.45) * vn / (2 / MP), ha = sa * PH * Math.cos(a.th), hc = sc * PH * Math.cos(c.th), arm = Math.max(ha, hc, 0.05);
          hitPin(S, a, -J * nx, -J * nz, a.th < 0.35 ? arm : sa * PH); hitPin(S, c, J * nx, J * nz, c.th < 0.35 ? arm : sc * PH); }
        const o = (r - d) / 2; a.u -= nx * o; a.v -= nz * o; c.u += nx * o; c.v += nz * o; } }
    // ---- each pin: tilt, slide, hop, and where it ends up ----
    let busy = !b.out;
    for (const p of S.pins) { if (p.gone && !p.pit) continue;
      // tilt: rocks back below the balance point, falls past it, thuds when it lands flat
      if (p.th > 0 || p.om !== 0) { const acc = p.th < TC ? KT * (Math.sin(p.th) - Math.sin(TC)) * 1.6 : KT * Math.sin(p.th); p.om += acc * dt; if (p.th < TC) p.om *= 0.985; p.th += p.om * dt;
        if (p.th <= 0) { p.th = 0; p.om = Math.abs(p.om) < 0.4 ? 0 : -p.om * 0.25; }
        if (p.th >= Math.PI / 2) { if (p.om > 1.5) S.clatter++; p.th = Math.PI / 2; p.om = p.om > 0.6 ? -p.om * 0.12 : 0; } }
      if (p.th > 0.6) p.down = true;
      // slide: lying pins drag harder and roll about their own axis
      const sp = Math.hypot(p.vu, p.vv), fr = (p.th > 1.2 ? 4.2 : 2.8) * dt; if (sp > 0) { const k = Math.max(0, sp - fr) / sp; p.vu *= k; p.vv *= k; }
      p.u += p.vu * dt; p.v += p.vv * dt; if (p.th > 1.2) p.psi += sp * dt / (PR * 0.8);
      // hop and land
      const floor = p.pit ? PIT_Y : p.gut ? GUT_Y : 0; p.vh -= 9.8 * dt; p.h += p.vh * dt; if (p.h < floor) { p.h = floor; p.vh = p.vh < -0.8 ? -p.vh * 0.25 : 0; }
      // kickbacks: a pin flying wide hits the side boards and bounces back into the deck
      if (!p.gut && !p.pit && Math.abs(p.v) > HALF + GUT + 0.02 && p.u > LEN - 1.0) { p.v = Math.sign(p.v) * (HALF + GUT + 0.02); p.vv = -p.vv * 0.55; S.clatter++; }
      // gutters: a pin that lands past the edge of the deck drops into the channel and runs along it
      if (!p.gut && !p.pit && Math.abs(p.v) > HALF + PR * 0.3 && p.h < 0.08) { p.gut = true; p.down = true; p.th = Math.max(p.th, 1.2); p.om = Math.max(p.om, 3); }
      if (p.gut) { const c = Math.sign(p.v) * (HALF + GUT / 2); p.v += (c - p.v) * Math.min(1, dt * 8); p.vv *= 0.9; p.ax = Math.sign(p.vu || 1); p.az = 0; }
      // over the back: into the pit, which is deep and padded at the far end
      if (!p.pit && p.u > DECK) { p.pit = true; p.gone = true; p.down = true; p.gut = false; }
      if (p.pit && p.u > PIT - 0.1) { p.u = PIT - 0.1; p.vu = -Math.abs(p.vu) * 0.2; }
      if (p.u < LEN - 1.6) { p.u = LEN - 1.6; p.vu = Math.abs(p.vu) * 0.3; }
      if (Math.abs(p.om) > 0.05 || sp > 0.03 || Math.abs(p.vh) > 0.05 || (p.th > 0.001 && p.th < Math.PI / 2 - 0.001 && p.th > TC)) busy = true;
    }
    S.t += dt; S.rest = busy ? 0 : S.rest + dt;
    if (S.rest > 0.4 || S.t > 10) { S.done = true; S.pins.forEach(p => { if (p.gut || p.pit || p.th > 0.5) p.down = true; }); }
  };

  /* ================= scoring ================= */
  B.score = (frames) => { const rolls = frames.flat(); const out = []; let s = 0, i = 0;
    for (let f = 0; f < 10; f++) { const a = rolls[i], b = rolls[i + 1], c = rolls[i + 2]; if (a === undefined) break;
      if (a === 10) { if (b === undefined || c === undefined) { out.push(null); break; } s += 10 + b + c; i += 1; }
      else { if (b === undefined) break; if (a + b === 10) { if (c === undefined) { out.push(null); break; } s += 10 + c; } else s += a + b; i += 2; }
      out.push(s); }
    return out; };
  B.marks = (fr, f) => { const d = k => k === 0 ? '–' : String(k), [a, b, c] = fr, o = [];
    if (a === undefined) return o; o.push(a === 10 ? 'X' : d(a)); if (b === undefined) return o;
    if (a === 10) o.push(f === 9 && b === 10 ? 'X' : d(b)); else o.push(a + b === 10 ? '/' : d(b));
    if (c === undefined) return o; if (a === 10 && b !== 10) o.push(b + c === 10 ? '/' : d(c)); else o.push(c === 10 ? 'X' : d(c)); return o; };

  /* ================= models ================= */
  B.skullTex = () => { const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#e8dcc0'; x.fillRect(0, 0, 512, 256);
    for (let k = 0; k < 14; k++) { x.strokeStyle = 'rgba(80,60,30,.25)'; x.beginPath(); let px = R() * 512, py = R() * 256; x.moveTo(px, py); for (let s = 0; s < 6; s++) { px += (R() - 0.5) * 40; py += (R() - 0.5) * 24; x.lineTo(px, py); } x.stroke(); }
    x.fillStyle = '#120a06'; [[200, 110], [312, 110]].forEach(([px, py]) => { x.beginPath(); x.ellipse(px, py, 34, 30, 0, 0, Math.PI * 2); x.fill(); }); x.beginPath(); x.moveTo(256, 140); x.lineTo(242, 170); x.lineTo(270, 170); x.fill();
    for (let k = 0; k < 8; k++) { x.fillStyle = '#f6eedb'; x.fillRect(208 + k * 13, 188, 11, 22); x.strokeStyle = '#5a4630'; x.strokeRect(208 + k * 13, 188, 11, 22); }
    x.fillStyle = '#7a1a1a'; [[60, 128], [452, 128], [256, 236]].forEach(([px, py]) => { x.beginPath(); x.arc(px, py, 10, 0, 7); x.fill(); });   // finger holes
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; };
  B.laneTex = () => {   // 39 maple boards running the length of the lane, a little darker toward the pins
    if (B._lt) return B._lt; const c = document.createElement('canvas'); c.width = 2048; c.height = 312; const x = c.getContext('2d'), bh = 8;
    for (let i = 0; i < 39; i++) { const h = 30 + R() * 6, l = 62 + R() * 8; const g = x.createLinearGradient(0, 0, 2048, 0); g.addColorStop(0, `hsl(${h},55%,${l}%)`); g.addColorStop(0.75, `hsl(${h - 2},55%,${l - 6}%)`); g.addColorStop(1, `hsl(${h - 6},50%,${l - 14}%)`); x.fillStyle = g; x.fillRect(0, i * bh, 2048, bh);
      x.strokeStyle = 'rgba(90,50,20,.18)'; x.lineWidth = 1; for (let k = 0; k < 3; k++) { x.beginPath(); let yy = i * bh + 1 + R() * (bh - 2); x.moveTo(0, yy); for (let xx = 0; xx < 2048; xx += 64) { yy += (R() - 0.5) * 0.8; yy = Math.max(i * bh + 1, Math.min(i * bh + bh - 1, yy)); x.lineTo(xx, yy); } x.stroke(); }
      x.fillStyle = 'rgba(40,20,10,.35)'; x.fillRect(0, i * bh, 2048, 1); }
    // dots and arrows are drawn in the wood: the approach dots at 2 m, arrows at 4.6 m (texture spans the lane, 19.9 m)
    const T = new THREE.CanvasTexture(c); T.encoding = THREE.sRGBEncoding; T.anisotropy = 8; return (B._lt = T); };
  // a glass bowling ball with a real skull suspended in it: the glass (with its finger holes and a few trapped
  // bubbles) rolls, the skull stays upright and drifts a little, as if it were floating in the middle
  B.glassBall = (li) => {
    const root = new THREE.Group(), spin = new THREE.Group(); root.add(spin);
    const glass = new THREE.MeshPhysicalMaterial({ color: li ? 0xffc8b0 : 0xb8e8ff, transparent: true, opacity: 0.26, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, reflectivity: 0.9, depthWrite: false, side: THREE.FrontSide });
    const inner = new THREE.MeshPhysicalMaterial({ color: li ? 0xff9a80 : 0x80c8ff, transparent: true, opacity: 0.14, roughness: 0.1, metalness: 0, depthWrite: false, side: THREE.BackSide });
    const shell = new THREE.Mesh(new THREE.SphereGeometry(BR, 64, 48), glass); shell.renderOrder = 3; shell.userData.noShadow = true; spin.add(shell);
    const back = new THREE.Mesh(new THREE.SphereGeometry(BR * 0.985, 64, 48), inner); back.renderOrder = 2; back.userData.noShadow = true; spin.add(back);
    // three finger holes drilled into the glass, and bubbles caught in it: these are what show the ball turning
    const hole = new THREE.MeshStandardMaterial({ color: 0x0a1418, transparent: true, opacity: 0.55, roughness: 0.3, depthWrite: false });
    [[0, 0.35, 0.92], [0.22, 0.6, 0.77], [-0.22, 0.6, 0.77]].forEach(([x, y, z2], k) => { const d = new G.V3(x, y, z2).normalize(), h = new THREE.Mesh(new THREE.CylinderGeometry(k ? 0.012 * SC : 0.014 * SC, k ? 0.012 * SC : 0.014 * SC, BR * 0.35, 14, 1, true), hole); h.position.copy(d).multiplyScalar(BR * 0.83); h.quaternion.setFromUnitVectors(new G.V3(0, 1, 0), d); h.renderOrder = 2.5; h.userData.noShadow = true; spin.add(h); });
    const bub = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false });
    for (let k = 0; k < 9; k++) { const a = jit(k, 3) * 6.28, e = (jit(k, 4) - 0.5) * 2.6, r = BR * (0.55 + jit(k, 5) * 0.35); const m = new THREE.Mesh(new THREE.SphereGeometry(0.0035 + jit(k, 6) * 0.005, 6, 5), bub); m.position.set(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); m.userData.noShadow = true; spin.add(m); }
    // the skull: real bone, about two thirds the ball across, glowing faintly in the sockets
    const sk = G.arcade.skull(BR * 0.62 / 0.16 * 0.95, li ? 0xff5030 : 0x60ff90); sk.position.y = -BR * 0.04; root.add(sk);
    root.userData = { spin, skull: sk, dynamic: true }; root.traverse(o => { if (o.isMesh && o.material === sk.material) o.castShadow = true; });
    return root;
  };
  B.pin = () => { const g = new THREE.Group(), boneM = G.mat('col', { c: 0xeee4cc, r: 0.35 });
    const prof = [0, 0, 0.026, 0.002, 0.04, 0.03, 0.056, 0.1, 0.06, 0.14, 0.052, 0.19, 0.032, 0.245, 0.025, 0.27, 0.03, 0.31, 0.035, 0.34, 0.03, 0.365, 0.016, 0.378, 0, 0.381];
    M.P(g, M.lathe(prof, 18), boneM); [0.262, 0.282].forEach(y => M.P(g, M.cyl(0.0255, 0.0255, 0.008, 14), G.mat('col', { c: 0x8a1018, r: 0.5 }), [0, y, 0]));
    M.mirror(k => M.P(g, M.sph(0.007, 6, 5), G.mat('col', { c: 0x100806 }), [k * 0.012, 0.34, 0.03]));
    g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g; };
  { const raw = B.pin; B.pin = () => M.fromProto('bowlpin', raw); }
  B.buildLane = (W, x0, z, li) => {
    const grp = W.group, wood = new THREE.MeshStandardMaterial({ map: B.laneTex(), roughness: 0.18, metalness: 0.05 });
    const FX = x0 + 6, LL = DECK, cx = FX + LL / 2, dark = G.mat('col', { c: 0x2a1a10, t: 'wood' }), steel = G.mat('col', { c: 0x3a3438, r: 0.35, m: 0.5, ds: true });
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(LL, LW), wood); lane.rotation.x = -Math.PI / 2; lane.position.set(cx, LY, z); grp.add(lane);
    const appr = new THREE.Mesh(new THREE.PlaneGeometry(6, LW + 2 * GUT + 0.4), wood); appr.rotation.x = -Math.PI / 2; appr.position.set(FX - 3, LY, z); grp.add(appr);
    M.P(grp, M.box(LL, LY - 0.02, LW - 0.01), dark, [cx, (LY - 0.02) / 2, z]); M.P(grp, M.box(6, LY - 0.02, LW + 2 * GUT + 0.39), dark, [FX - 3, (LY - 0.02) / 2, z]);
    // gutters: rounded steel channels the whole length of the lane and the deck, with a capping board outside
    [-1, 1].forEach(s => { const gm = new THREE.Mesh(new THREE.CylinderGeometry(GUT / 2, GUT / 2, LL, 16, 1, true, 0, Math.PI), steel); gm.quaternion.setFromEuler(new THREE.Euler(Math.PI, 0, Math.PI / 2)); gm.position.set(cx, LY, z + s * (HALF + GUT / 2)); grp.add(gm);
      M.P(grp, M.box(LL, LY + 0.1, 0.08), dark, [cx, (LY + 0.1) / 2, z + s * (HALF + GUT + 0.04)]); });
    M.P(grp, M.box(0.03, 0.005, LW), G.mat('col', { c: 0x8a1018 }), [FX, LY + 0.004, z]);   // foul line
    for (let k = -2; k <= 2; k++) { const ar = new THREE.Mesh(new THREE.CircleGeometry(0.035 * SC, 3), G.mat('col', { c: 0x3a0a0a })); ar.rotation.set(-Math.PI / 2, 0, -Math.PI / 2); ar.position.set(FX + 4.6 * SC + Math.abs(k) * 0.3, LY + 0.005, z + k * 0.2 * SC); grp.add(ar); }   // target arrows
    // the back end: kickbacks of dark wood along the deck, a deep pit behind it with a padded curtain, the masking skull above
    const deckX = FX + LEN, pitX = FX + DECK, backX = FX + PIT, kz = HALF + GUT + 0.17;
    [-1, 1].forEach(s => M.P(grp, M.box(backX - deckX + 1.0, 1.1, 0.3), dark, [(deckX - 1.0 + backX) / 2, 0.55, z + s * kz]));
    M.P(grp, M.box(backX - pitX, 0.06, kz * 2), G.mat('col', { c: 0x050304 }), [(pitX + backX) / 2, LY + PIT_Y - 0.03, z]);   // the pit floor
    M.P(grp, M.box(0.04, -PIT_Y + 0.02, LW + 2 * GUT), G.mat('col', { c: 0x0a0605 }), [pitX + 0.02, LY + PIT_Y / 2, z]);       // the deck's back edge
    { const cur = new THREE.Mesh(new THREE.PlaneGeometry(kz * 2, 1.4), G.mat('col', { c: 0x2a0608, t: 'cloth', r: 1 })); cur.rotation.y = -Math.PI / 2; cur.position.set(backX - 0.05, 0.5, z); grp.add(cur); }
    M.P(grp, M.box(0.3, 3.4, kz * 2 + 0.6), G.mat('col', { c: 0x140c0a }), [backX + 0.15, 1.7, z]);
    const mask = new THREE.Group(); M.P(mask, M.box(0.2, 1.3, kz * 2 + 0.6), G.mat('col', { c: 0x1a0e0a, t: 'wood' }), [0, 0, 0]); const sk = G.arcade.skull(5.5, li ? 0xff4030 : 0x60ff90); sk.rotation.y = -Math.PI / 2; sk.position.set(-0.2, 0.05, 0); mask.add(sk); mask.position.set(pitX + 0.5, 2.0, z); grp.add(mask);
    W.lights.push({ pos: new G.V3(deckX - 2.6, 1.3, z), color: 0xfff0d0, intensity: 1.8, dist: 7, seed: 30 + li, flicker: false });
    W.lights.push({ pos: new G.V3(FX - 1.5, 3.0, z), color: 0xffc080, intensity: 2.0, dist: 9, seed: 32 + li, flicker: true });
    // a ball return beside the approach and a scoreboard hanging over the foul line
    const ret = new THREE.Group(); M.P(ret, M.box(1.2, 0.5, 0.5), G.mat('col', { c: 0x2a1a10, t: 'wood' }), [0, 0.25, 0]); const rs = G.arcade.skull(2.5, 0xffb040); rs.position.set(0, 0.62, 0); rs.rotation.y = -Math.PI / 2; ret.add(rs); W.place(ret, FX - 4.5, 0, z + HALF + GUT + 0.9, 0, 0.6);
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 320; const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.31), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.7 })); board.position.set(FX + 0.5, 4.4, z); board.rotation.y = -Math.PI / 2; grp.add(board);
    const L = { li, FX, z, x0, cv, tex, pins: [], ball: null, sim: null, table: null };
    for (let i = 0; i < 10; i++) { const m = B.pin(); m.scale.setScalar(SC); m.userData.dynamic = true; G.scene.add(m); L.pins.push(m); }
    const ball = B.glassBall(li); G.scene.add(ball); L.ball = ball;
    for (let k = -2; k <= 2; k++) W.addSolid(FX + PIT * (k + 2) / 4, z, 0.9 * SC);
    W.interact.push({ id: 'bowl', label: `Skull Bowling · lane ${li + 1}`, x: FX - 3.5, z, r: 2.8, desc: 'Ten frames, 1 to 6 bowlers', lane: li });
    B.lanes[li] = L; B.setPins(L, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]); B.idleBall(L); B.drawBoard(L);
  };
  const UP = new G.V3(0, 1, 0);
  B.wpos = (L, u, v, y = 0) => new G.V3(L.FX + u, LY + y, L.z + v);
  B.setPins = (L, pins) => { L.pins.forEach((m, i) => { m.visible = !!pins[i]; m.position.copy(B.wpos(L, PINS[i][0], PINS[i][1])); m.quaternion.setFromAxisAngle(UP, jit(i, 7) * 6.28); }); };
  B.idleBall = (L) => { L.ball.visible = true; L.retT = 0.001; B.retPos(L, 0); };   // the ball comes back up the return and rolls out to rest
  B.retPos = (L, k) => { const e = k * k * (3 - 2 * k), x = -4.5 + 0.5 - e * 0.9, y = 0.62 + 0.25 * (1 - e) + Math.abs(Math.sin(e * Math.PI * 2)) * 0.05 * (1 - e); L.ball.position.copy(B.wpos(L, x, HALF + GUT + 0.9, y)); L.ball.userData.spin.rotation.z = -e * 6; };
  B.drawBoard = (L) => {
    const x = L.cv.getContext('2d'), t = L.table; x.fillStyle = '#120a08'; x.fillRect(0, 0, 1024, 320); x.strokeStyle = '#d9b46a'; x.lineWidth = 6; x.strokeRect(6, 6, 1012, 308);
    x.fillStyle = '#f3d998'; x.font = '600 34px Georgia'; x.textAlign = 'left'; x.fillText(`LANE ${L.li + 1}`, 24, 46);
    if (!t || !t.st || !t.st.pl) { x.textAlign = 'center'; x.font = '600 56px Georgia'; x.fillText('SKULL BOWLING', 512, 180); L.tex.needsUpdate = true; return; }
    const st = t.st, rows = st.pl.slice(0, 4), fw = 78; x.font = '22px Georgia';
    rows.forEach((p, ri) => { const y = 74 + ri * 60, sc = B.score(p.f); x.fillStyle = st.cur === st.pl.indexOf(p) && st.phase !== 'over' ? '#ffe08a' : '#c8b890'; x.textAlign = 'left'; x.fillText(p.name.slice(0, 12), 20, y + 36);
      for (let f = 0; f < 10; f++) { const bx = 190 + f * fw; x.strokeStyle = '#6a5426'; x.lineWidth = 2; x.strokeRect(bx, y, fw - 4, 52); x.fillStyle = '#f3d998'; x.textAlign = 'center'; x.fillText(B.marks(p.f[f] || [], f).join(' '), bx + fw / 2 - 2, y + 22); if (sc[f] !== undefined && sc[f] !== null) x.fillText(String(sc[f]), bx + fw / 2 - 2, y + 47); } });
    L.tex.needsUpdate = true;
  };

  /* ================= the game ================= */
  const pinCount = p => p.reduce((a, b) => a + (b ? 1 : 0), 0);
  GM.bowl = {
    name: 'Skull Bowling', icon: '💀', min: 1, max: 6, npc: true, minBuy: 0, maxBuy: 500, defBuy: 20, step: 5, buyLabel: 'Stake per bowler',
    rules: 'Ten frames, two balls a frame. A strike (all ten on the first ball) scores 10 plus your next two balls; a spare scores 10 plus your next ball. The tenth frame gives bonus balls for a strike or spare. Highest total takes the pot. On your turn, walk up to the lane and press E: the mouse aims and A and D slide your starting spot; click to start the spin needle swinging and click again to set your hook, then click to stop the power bar and bowl. Right click backs up a step.',
    canOpen() { const used = Object.values(TB.list).filter(t => t.game === 'bowl' && !t.closed).map(t => t.opts.lane); if (used.length >= B.lanes.length) { G.ui.toast('Both lanes are taken. Join a game instead.'); return false; } return true; },
    formOpts() { const used = Object.values(TB.list).filter(t => t.game === 'bowl' && !t.closed).map(t => t.opts.lane), Pl = G.player, free = B.lanes.filter(L => !used.includes(L.li)); if (Pl && free.length) free.sort((x, y) => Math.abs(Pl.pos.z - x.z) - Math.abs(Pl.pos.z - y.z)); return { lane: free.length ? free[0].li : 0 }; },
    optLabel(t) { return `lane ${(t.opts.lane | 0) + 1}`; },
    start(t) { const st = t.st; Object.assign(st, { pl: t.seats.map(s => ({ id: s.id, name: s.name, npc: !!s.npc, f: Array.from({ length: 10 }, () => []) })), cur: 0, frame: 1, ball: 1, pins: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], phase: 'aim', shot: null, no: 0, pot: t.buy * t.seats.length, at: now() + 120000 }); TB.say(t, `${st.pl[0].name} is up`); },
    myTurn(t, id) { const st = t.st; return st && st.phase === 'aim' && st.pl[st.cur] && st.pl[st.cur].id === id; },
    act(t, id, a) { const st = t.st; if (a.t !== 'roll' || st.phase !== 'aim' || st.pl[st.cur].id !== id || (a.no | 0) !== st.no + 1) return false;
      st.shot = { no: st.no + 1, pos: G.clamp(+a.pos || 0, -0.45 * SC, 0.45 * SC), ang: G.clamp(+a.ang || 0, -0.09, 0.09), pow: G.clamp(+a.pow || 0, 0, 1), hook: G.clamp(+a.hook || 0, -1, 1), by: id }; st.pre = st.pins.slice(); st.phase = 'rolling'; st.at = now() + 30000; },
    resolve(t, S) {
      const st = t.st; if (!st.shot || S.no !== st.shot.no) return false;
      const after = S.pins.map(p => p.down || p.gone ? 0 : 1), k = pinCount(st.pins) - pinCount(after), p = st.pl[st.cur], fr = p.f[st.frame - 1];
      fr.push(k); st.no = S.no; st.shot = null; st.phase = 'aim'; st.at = now() + 120000; let done = false, reset = false;
      const tag = k === 10 && st.ball === 1 || (st.frame === 10 && k === pinCount(st.pins) && pinCount(st.pins) === 10) ? 'Strike!' : (pinCount(after) === 0 ? 'Spare!' : k === 0 ? (S.ball.gutter ? 'Gutter ball' : 'Nothing') : `${k} down`);
      TB.say(t, `${p.name}: ${tag}`); st.last = { by: p.name, tag, n: S.no };
      if (st.frame < 10) { if (st.ball === 1 && k === 10) done = true; else if (st.ball === 2) done = true; else { st.ball = 2; st.pins = after; } }
      else { if (st.ball === 1) { st.ball = 2; if (k === 10) reset = true; else st.pins = after; }
        else if (st.ball === 2) { if (fr[0] === 10 || fr[0] + fr[1] === 10) { st.ball = 3; if (pinCount(after) === 0) reset = true; else st.pins = after; } else done = true; }
        else done = true; }
      if (reset) st.pins = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
      if (done) { st.pins = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]; st.ball = 1; st.cur++; if (st.cur >= st.pl.length) { st.cur = 0; st.frame++; } let g = 0; while (st.frame <= 10 && st.pl[st.cur].left && g++ < 12) { st.cur++; if (st.cur >= st.pl.length) { st.cur = 0; st.frame++; } }
        if (st.frame > 10) { st.phase = 'over'; const sc = st.pl.filter(q => !q.left).map(q => ({ q, s: B.score(q.f).filter(v => v !== null).pop() || 0 })), best = Math.max(...sc.map(o => o.s)), w = sc.filter(o => o.s === best); st.winner = w.map(o => o.q.name).join(' & '); TB.say(t, `${st.winner} win${w.length > 1 ? '' : 's'} with ${best}!`); w.forEach(o => TB.pay(t, o.q.id, st.pot / w.length, 'Skull Bowling')); }
        else TB.say(t, `${st.pl[st.cur].name} is up · frame ${st.frame}`); }
    },
    next(t) {
      const st = t.st; if (st.phase === 'over') return null;
      if (st.phase === 'rolling') return { wait: st.at - now(), fn: t => { const S = B.newSim(st.pre, st.shot, st.shot.no); while (!S.done) B.step(S); return this.resolve(t, S); } };
      const p = st.pl[st.cur]; if (!p) return null;
      if (p.npc) return { wait: 2000 + R() * 1200, fn: t => this.act(t, p.id, Object.assign({ t: 'roll', no: st.no + 1 }, B.npcShot(st))) };
      return { wait: st.at - now(), fn: t => { TB.say(t, `${p.name} dawdles; the ball rolls itself`); return this.act(t, p.id, { t: 'roll', no: st.no + 1, pos: 0, ang: 0, pow: 0.4, hook: 0 }); } };
    },
    leave(t, id) { const st = t.st, i = st.pl.findIndex(p => p.id === id); if (i < 0 || st.phase === 'over') return 0; st.pl[i].left = true; if (st.pl.every(p => p.left || p.npc) && !st.pl.some(p => !p.left && !p.npc)) { /* only regulars left */ } if (st.cur === i && st.phase === 'aim') { st.ball = 1; st.pins = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]; let g = 0; do { st.cur++; if (st.cur >= st.pl.length) { st.cur = 0; st.frame++; } } while (st.frame <= 10 && st.pl[st.cur].left && g++ < 12); if (st.frame > 10) st.phase = 'over'; } return 0; },
    closeOut(t) { return t.st && t.st.phase !== 'over' ? t.buy : 0; },
    view(t, id) {
      const st = t.st; let h = `<div class="tgame"><div class="goldline">Pot: ${st.pot} gold · lane ${(t.opts.lane | 0) + 1} · frame ${Math.min(10, st.frame)}${st.phase === 'over' ? ' · ' + esc(st.winner) + ' win' : ''}</div><div style="overflow-x:auto"><table class="bwl"><tr><th></th>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(f => `<th>${f}</th>`).join('')}<th>Total</th></tr>`;
      st.pl.forEach((p, i) => { const sc = B.score(p.f); h += `<tr class="${i === st.cur && st.phase !== 'over' ? 'on' : ''} ${p.left ? 'out' : ''}"><td>${esc(p.id === id ? 'You' : p.name)}</td>${p.f.map((fr, f) => `<td><small>${B.marks(fr, f).join(' ')}</small><br>${sc[f] ?? ''}</td>`).join('')}<td><b>${sc.filter(v => v !== null).pop() || 0}</b></td></tr>`; });
      h += '</table></div>';
      if (st.phase !== 'over') h += `<p class="note">${st.pl[st.cur].id === id ? (st.phase === 'aim' ? `<b>Your ball</b> (${st.ball === 1 ? 'first' : st.ball === 2 ? 'second' : 'bonus'} ball). Walk up to lane ${(t.opts.lane | 0) + 1} and press E.` : 'Rolling…') : `${esc(st.pl[st.cur].name)} is bowling.`}</p>`;
      return h + '</div>';
    },
    onState(t) {
      const L = B.lanes[t.opts.lane | 0]; if (!L) return; L.table = t.closed ? null : t; const st = t.st; B.drawBoard(L); B.hud();
      if (t.closed || !st || !st.pl) { L.sim = null; B.setPins(L, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]); B.idleBall(L); return; }
      if (st.phase === 'rolling' && st.shot && (!L.sim || L.sim.no < st.shot.no)) { L.sim = B.newSim(st.pre, st.shot, st.shot.no); L.sim.by = st.shot.by; }
      if (st.phase !== 'rolling') { if (!L.sim || L.sim.done) { if (!L.hold) { L.sim = null; B.setPins(L, st.pins); B.idleBall(L); } L.pending = null; } else L.pending = st.pins; }
      if (st.last && st.last.n !== L.lastBanner && st.pl.some(p => p.id === me())) { L.lastBanner = st.last.n; if (st.last.tag === 'Strike!' || st.last.tag === 'Spare!') { G.ui.banner(st.last.tag, st.last.by); G.sfx('cheer', 0.7); } }
      if (!this.myTurn(t, me()) && B.aim && B.aim.L === L && !B.aim.rolled) B.endAim();
    },
    onClose(t) { const L = B.lanes[t.opts.lane | 0]; if (L) { L.table = null; L.sim = null; B.setPins(L, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]); B.idleBall(L); B.drawBoard(L); } B.hud(); }
  };
  B.npcShot = (st) => { const standing = PINS.map((p, i) => st.pins[i] ? p : null).filter(Boolean); let tv = 0.06; if (pinCount(st.pins) < 10 && standing.length) tv = standing.reduce((a, p) => a + p[1], 0) / standing.length; const pos = 0.12 * (R() < 0.5 ? 1 : -1) * R(), ang = Math.atan((tv - pos) / LEN) + (R() + R() - 1) * 0.008; return { pos, ang, pow: 0.55 + R() * 0.4, hook: (R() - 0.5) * 0.15 }; };

  /* ================= bowling a ball ================= */
  const myLane = () => B.lanes.find(L => L.table && L.table.st && GM.bowl.myTurn(L.table, me()));
  B.enterAim = (L) => { B.aim = { L, pos: 0.15, ang: 0, pow: 0, hook: 0, step: 'aim', mt: 0, rolled: false, follow: 0 }; B.hud(); };
  B.endAim = () => { const A = B.aim; if (!A) return; B.aim = null; B.hud(); const pw = document.getElementById('bowlMeters'); if (pw) pw.hidden = true; if (B.guide) B.guide.visible = false; };
  // three steps: aim (mouse, A/D), then click to stop the swinging spin needle, then click to stop the power bar and bowl
  B.SPIN_P = 0.95; B.POW_P = 0.8;   // quick: holding a consistent line takes timing
  B.aimInput = (dt) => {
    const A = B.aim, L = A.L, t = L.table, st = t.st, sens = G.settings.sens || 1;
    if (A.rolled) return;
    if (A.step === 'aim') {
      if (G.keys.KeyA) A.pos = G.clamp(A.pos - dt * 0.55, -0.42 * SC, 0.42 * SC); if (G.keys.KeyD) A.pos = G.clamp(A.pos + dt * 0.55, -0.42 * SC, 0.42 * SC);
      A.ang = G.clamp(A.ang + G.mouse.dx * 0.00035 * sens, -0.04, 0.04);
      if (G.mouse.lPressed) { A.step = 'spin'; A.mt = 0; G.sfx('click', 0.5); B.hud(); }
      return;
    }
    A.mt += dt;
    if (A.step === 'spin') {
      A.hook = Math.sin(A.mt / B.SPIN_P * Math.PI * 2);   // sweeps hard left … straight … hard right and back
      if (G.mouse.lPressed) { A.step = 'power'; A.mt = 0; G.sfx('click', 0.6); B.hud(); }
      return;
    }
    if (A.step === 'power') {
      A.pow = 0.5 - 0.5 * Math.cos(A.mt / B.POW_P * Math.PI * 2);   // fills and empties
      if (G.mouse.lPressed) { if (A.pow < 0.03) A.pow = 0.03; A.rolled = true; G.sfx('swing', 0.6);
        const no = st.no + 1, shot = { t: 'roll', no, pos: A.pos, ang: A.ang + (R() - 0.5) * 0.01 * (T.amt ? T.amt() : 0), pow: A.pow, hook: A.hook };
        L.sim = B.newSim(st.pins, shot, no); L.sim.by = me(); TB.act(t.tid, shot); A.follow = 0.001; B.hud(); }
    }
  };
  // right click backs up a step (power → spin → aim), and from aiming steps away from the lane
  B.back = () => { const A = B.aim; if (!A || A.rolled) return false; if (A.step === 'power') { A.step = 'spin'; A.mt = 0; A.pow = 0; } else if (A.step === 'spin') { A.step = 'aim'; A.hook = 0; } else return false; G.sfx('click', 0.3); B.hud(); return true; };
  B.camAim = (dt) => {
    const A = B.aim, L = A.L, cam = G.camera;
    if (A.rolled && L.sim) { const b = L.sim.ball, bp = B.wpos(L, b.u, b.v); const want = B.wpos(L, Math.max(-3, b.u - 3.2), b.v * 0.5, 1.15); A.cp = (A.cp || want.clone()).lerp(want, Math.min(1, dt * 5)); cam.position.copy(A.cp); cam.lookAt(bp.x + 2, 0.25, bp.z); return; }
    const p = B.wpos(L, -3.3, A.pos * 0.6, 1.55); cam.position.copy(p); cam.lookAt(B.wpos(L, LEN, A.pos + Math.tan(A.ang) * LEN, 0.1));
  };
  // ball and pins move, the line shows where you're aiming
  const q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), ax = new G.V3(), tAx = new G.V3();
  B.update = (dt) => {
    B.lanes.forEach(L => {
      // the skull floats in the glass: upright, drifting, looking at you while you line up and turning to face the pins as it rolls
      { const sk = L.ball.userData.skull, t = G.now() + L.li * 2.3; if (sk) { const want = L.sim && !L.sim.done ? Math.PI / 2 : -Math.PI / 2; L.skYaw = G.dampAng(L.skYaw ?? want, want, 3, dt); sk.rotation.set(Math.sin(t * 1.1) * 0.07, L.skYaw + Math.sin(t * 0.7) * 0.18, Math.sin(t * 1.3) * 0.09); sk.position.set(Math.sin(t * 0.9) * BR * 0.04, -BR * 0.04 + Math.sin(t * 1.7) * BR * 0.05, Math.cos(t * 1.1) * BR * 0.04); } }
      const S = L.sim;
      if (S && !S.done) { S.acc += Math.min(dt, 0.1); let n = 0; while (S.acc >= STEP && n < 60 && !S.done) { S.acc -= STEP; n++; B.step(S); } if (S.clatter) { G.sfx('bonecollapse', G.clamp(S.clatter / 6, 0.3, 1), B.wpos(L, LEN, 0)); G.sfx('bonehit', 0.6, B.wpos(L, LEN, 0)); S.clatter = 0; } if (S.gutterSfx) { G.sfx('rumble', 0.3, B.wpos(L, 10, 0)); S.gutterSfx = 0; }
        if (S.done) { if (L.pending) { L.hold = true; setTimeout(() => { L.hold = false; if (L.sim && L.sim.done) L.sim = null; if (L.pending) { B.setPins(L, L.pending); L.pending = null; } else if (L.table && L.table.st && L.table.st.phase !== 'rolling') B.setPins(L, L.table.st.pins); B.idleBall(L); }, 1400); }
          const t = L.table; if (t && TB.host[t.tid] && t.st.phase === 'rolling') { const ht = TB.host[t.tid]; setTimeout(() => { if (GM.bowl.resolve(ht, S) !== false) TB.commit(ht); }, 1200); }
          if (B.aim && B.aim.L === L && B.aim.rolled) setTimeout(() => { if (B.aim && B.aim.L === L) B.endAim(); }, 1300); } }
      if (S) { const b = S.ball; L.ball.visible = true; L.ball.position.copy(B.wpos(L, b.u, b.v, BR + b.h)); if (!b.out) { ax.set(-b.vv, 0, b.vu).normalize(); q.setFromAxisAngle(ax, Math.hypot(b.vu, b.vv) * dt / BR); L.ball.userData.spin.quaternion.premultiply(q); }
        S.pins.forEach((p, i) => { const m = L.pins[i]; if (!p.on) { m.visible = false; return; } m.visible = true; m.position.copy(B.wpos(L, p.u, p.v, p.h));
          // tip about the base toward the fall direction, and spin about the pin's own axis (it rolls when it lies flat)
          tAx.set(p.az, 0, -p.ax); if (tAx.lengthSq() < 1e-9) tAx.set(0, 0, -1); tAx.normalize(); m.quaternion.setFromAxisAngle(tAx, p.th).multiply(q2.setFromAxisAngle(UP, p.psi)); }); }
      else if (L.retT > 0) { L.retT = Math.min(1, L.retT + dt / 0.9); B.retPos(L, L.retT); if (L.retT >= 1) L.retT = 0; }
    });
    if (B.aim && !B.aim.rolled) { const A = B.aim, L = A.L; L.ball.visible = true; L.ball.position.copy(B.wpos(L, -0.4, A.pos, BR)); if (!B.guide) { B.guide = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new G.V3(), new G.V3()]), new THREE.LineDashedMaterial({ color: 0xf3e8c8, dashSize: 0.3, gapSize: 0.2, transparent: true, opacity: 0.7 })); G.scene.add(B.guide); }
      B.guide.geometry.setFromPoints([B.wpos(L, -0.2, A.pos, 0.01), B.wpos(L, OIL, A.pos + Math.tan(A.ang) * OIL, 0.01)]); B.guide.computeLineDistances(); B.guide.visible = true;
      let mt = document.getElementById('bowlMeters'); if (!mt) { mt = document.createElement('div'); mt.id = 'bowlMeters'; mt.innerHTML = '<div class="bm sp"><span>SPIN</span><div class="trk"><i class="ctr"></i><i class="nd"></i></div><small>◀ hook left · straight · hook right ▶</small></div><div class="bm pw"><span>POWER</span><div class="trk"><i class="fl"></i></div></div>'; document.getElementById('hud').appendChild(mt); }
      mt.hidden = false; mt.querySelector('.sp').classList.toggle('on', A.step === 'spin'); mt.querySelector('.pw').classList.toggle('on', A.step === 'power'); mt.querySelector('.sp').classList.toggle('dim', A.step === 'aim'); mt.querySelector('.pw').classList.toggle('dim', A.step !== 'power');
      mt.querySelector('.nd').style.left = Math.round((A.hook + 1) / 2 * 100) + '%'; mt.querySelector('.fl').style.width = Math.round(A.pow * 100) + '%'; }
    else { const mt = document.getElementById('bowlMeters'); if (mt && !(B.aim && B.aim.rolled)) mt.hidden = true; }
  };
  const pk0 = G.game.updatePickups.bind(G.game);
  G.game.updatePickups = function (dt, t) { pk0(dt, t); if (G.World.theme === 'hideout') B.update(dt); };

  /* ================= hooks: building, prompts, input, camera, HUD ================= */
  const ba0 = G.World.buildArcade;
  G.World.buildArcade = function (o) { ba0.call(this, o); if (!o.spots) return; B.lanes.forEach(L => { L.pins.forEach(m => G.scene.remove(m)); G.scene.remove(L.ball); }); B.lanes = []; o.spots.bowl.lanes.forEach((z, li) => B.buildLane(this, o.spots.bowl.x, z, li)); G.arcade.hangSign(this, 'SKULL BOWLING', o.spots.bowl.x + 3, (o.spots.bowl.lanes[0] + o.spots.bowl.lanes[1]) / 2, Math.PI / 2, 5.6, 4.2); };
  const clear = () => { B.lanes.forEach(L => { L.pins.forEach(m => G.scene.remove(m)); G.scene.remove(L.ball); }); B.lanes = []; if (B.guide) { G.scene.remove(B.guide); B.guide = null; } B.aim = null; };
  const hideout0 = G.game.enterHideout.bind(G.game); G.game.enterHideout = async function () { clear(); return hideout0(); };
  const ns0 = G.game.netStart.bind(G.game); G.game.netStart = function (d) { const r0 = ns0(d); if (G.run.active) clear(); return r0; };
  const it0 = G.game.interactTarget.bind(G.game);
  G.game.interactTarget = function () { if (B.aim) return null; const best = it0(), Pl = G.player, L = myLane(); if (!Pl || !L) return best; const dx = Pl.pos.x - (L.FX - 2), dz = Pl.pos.z - L.z; if (Math.abs(dx) < 4.5 && Math.abs(dz) < 2.4) return { k: 'bowlshot', label: `Bowl · lane ${L.li + 1}` }; return best; };
  const hi0 = G.game.handleInteract.bind(G.game);
  G.game.handleInteract = function (dt) { if (B.aim) { G.ui.setPrompt(null); return; } const Tg = G.player && !G.ui.modalOpen() && G.state === 'play' ? this.interactTarget() : null; if (Tg && Tg.k === 'bowlshot') { G.ui.setPrompt(`<span class="kbd">E</span>${esc(Tg.label)}`); if (G.pressed.KeyE) { G.pressed.KeyE = false; B.enterAim(myLane()); } return; } return hi0(dt); };
  const mk0 = G.makePlayer;
  G.makePlayer = function (cls) {
    const Pl = mk0(cls), up0 = Pl.update, cam0 = Pl.updateCam, vm0 = Pl.animVM;
    Pl.update = (dt, t) => {
      if (!B.aim) return up0(dt, t);
      if (!B.aim.rolled && (!myLane() || Pl.dead || G.ui.modalOpen())) { B.endAim(); return up0(dt, t); }
      if (!B.aim.rolled && G.mouse.rPressed && B.back()) { G.mouse.rPressed = false; }
      else if (!B.aim.rolled && (G.mouse.rPressed || G.pressed.KeyE)) { B.endAim(); G.pressed.KeyE = false; return up0(dt, t); }
      B.aimInput(dt);
      const keep = { dx: G.mouse.dx, dy: G.mouse.dy, l: G.mouse.l, r: G.mouse.r, lp: G.mouse.lPressed }, px = Pl.pos.x, pz = Pl.pos.z, kA = G.keys.KeyA, kD = G.keys.KeyD;
      G.mouse.dx = G.mouse.dy = 0; G.mouse.l = G.mouse.r = G.mouse.lPressed = false; G.keys.KeyA = G.keys.KeyD = false; G.pressed.Space = G.pressed.KeyQ = G.pressed.KeyR = G.pressed.KeyF = false;
      up0(dt, t); Pl.pos.x = px; Pl.pos.z = pz; Pl.vel.set(0, 0, 0);
      G.mouse.dx = keep.dx; G.mouse.dy = keep.dy; G.mouse.l = keep.l; G.mouse.r = keep.r; G.mouse.lPressed = keep.lp; G.keys.KeyA = kA; G.keys.KeyD = kD;
    };
    Pl.updateCam = (dt, t) => { cam0(dt, t); if (B.aim) B.camAim(dt); };
    Pl.animVM = (dt, t) => { vm0(dt, t); if (B.aim && Pl.V) Pl.V.root.visible = false; };
    return Pl;
  };
  const css = document.createElement('style');
  css.textContent = `table.bwl{border-collapse:collapse;font-size:12px;width:100%}table.bwl th,table.bwl td{border:1px solid #5a4620;padding:3px 4px;text-align:center;min-width:34px}table.bwl td:first-child{text-align:left;min-width:90px;font-family:var(--head)}table.bwl tr.on td{background:rgba(243,217,152,.12)}table.bwl tr.out{opacity:.4}table.bwl small{color:#c8b890}
#bowlMeters{position:absolute;left:50%;top:56%;transform:translateX(-50%);display:flex;flex-direction:column;gap:10px;width:300px;pointer-events:none}#bowlMeters .bm{background:rgba(20,12,6,.82);border:1px solid #6a5030;border-radius:5px;padding:6px 10px;color:#e8d8b0;font-size:11px;transition:opacity .2s}#bowlMeters .bm.dim{opacity:.4}#bowlMeters .bm.on{border-color:#ffe08a;box-shadow:0 0 10px rgba(255,224,138,.35)}#bowlMeters span{font-family:var(--head);color:#f3d998;letter-spacing:.1em}#bowlMeters small{display:block;text-align:center;opacity:.7;margin-top:2px}
#bowlMeters .trk{position:relative;height:12px;margin-top:4px;border-radius:6px;background:linear-gradient(90deg,#3a6ad0,#2a2a2a 45%,#2a2a2a 55%,#d04a3a);overflow:hidden}#bowlMeters .pw .trk{background:rgba(0,0,0,.55)}#bowlMeters .ctr{position:absolute;left:50%;top:0;bottom:0;width:2px;background:rgba(255,255,255,.5)}#bowlMeters .nd{position:absolute;top:-2px;bottom:-2px;width:4px;margin-left:-2px;background:#ffe08a;box-shadow:0 0 6px #ffe08a}#bowlMeters .fl{display:block;height:100%;width:0;background:linear-gradient(90deg,#4a8a3a,#e8c040,#d04030)}
#bowlHud{position:absolute;left:50%;top:70px;transform:translateX(-50%);background:rgba(20,12,6,.8);border:1px solid #6a5030;border-radius:4px;padding:6px 14px;font-size:13px;color:#e8d8b0;text-align:center;pointer-events:none}#bowlHud b{font-family:var(--head);color:#f3d998}`;
  document.head.appendChild(css);
  B.hud = () => {
    let el = document.getElementById('bowlHud'); const L = B.lanes.find(l => l.table && l.table.st && l.table.st.pl && l.table.st.pl.some(p => p.id === me())), t = L && L.table;
    if (!t || G.World.theme !== 'hideout' || t.phase !== 'play') { if (el) el.hidden = true; return; }
    if (!el) { el = document.createElement('div'); el.id = 'bowlHud'; document.getElementById('hud').appendChild(el); }
    const st = t.st, cur = st.pl[st.cur]; el.hidden = false;
    el.innerHTML = `<b>Lane ${L.li + 1}</b> · frame ${Math.min(10, st.frame)} · ${st.pl.map(p => `${esc(p.id === me() ? 'You' : p.name)} ${B.score(p.f).filter(v => v !== null).pop() || 0}`).join(' · ')}<br>${st.phase === 'over' ? esc(st.winner) + ' win' : cur.id === me() ? (st.phase === 'aim' ? (B.aim ? (B.aim.step === 'aim' ? 'Mouse aims · A/D slide · click to set the spin' : B.aim.step === 'spin' ? '<b>Click</b> to stop the spin needle · right click to go back' : '<b>Click</b> to stop the power bar and bowl · right click to go back') : 'Your ball · walk up to the lane and press E') : 'Rolling…') : esc(cur.name) + ' is bowling'}`;
  };
})();
