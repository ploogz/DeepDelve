/* ============================================================
   Skull bowling: two full-length lanes (60 feet from the foul line to the head pin) in the Grand Arcade
   - the ball is a skull, the pins are carved bone; real physics on the lane: an oiled front that lets the
     ball skid, a dry back end where your hook bites, gutters, pins that fly, topple and take each other out
   - ten frames, strikes and spares scored properly, the tenth frame's bonus balls, 1 to 6 bowlers per lane
   - walk up to the approach on your turn and press E · mouse aims · A/D slides your starting spot ·
     hold left click for power and move the mouse while holding to add hook · release to bowl
   ============================================================ */
'use strict';
(() => {
  const TB = G.tables, GM = TB.GAMES, UI = G.ui, R = Math.random, T = G.tavern;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LW = 1.066, GUT = 0.24, LEN = 18.29, BR = 0.109, PR = 0.06, PH = 0.381, STEP = 1 / 240, LY = 0.13, OIL = 12, MB = 7, MP = 1.5;
  const PINS = []; for (let row = 0; row < 4; row++) for (let j = 0; j <= row; j++) PINS.push([LEN + row * 0.2639, (j - row / 2) * 0.3048]);
  const B = G.bowl = { lanes: [], aim: null };
  const now = () => Date.now(), me = () => G.net.myId();

  /* ================= physics ================= */
  B.newSim = (pins, shot, no) => ({ no, t: 0, done: false, acc: 0, ball: { u: -0.3, v: shot.pos, vu: Math.cos(shot.ang) * (5.2 + shot.pow * 4.0), vv: Math.sin(shot.ang) * (5.2 + shot.pow * 4.0), hook: shot.hook, gutter: false, spin: 0 }, pins: PINS.map((p, i) => ({ u: p[0], v: p[1], vu: 0, vv: 0, on: !!pins[i], down: false, gone: !pins[i], tilt: 0, ax: 0, az: 1 })) });
  const knock = (S, p, nu, nv) => { if (!p.down) { p.down = true; const l = Math.hypot(nu, nv) || 1; p.ax = nv / l; p.az = -nu / l; S.clatter = (S.clatter || 0) + 1; } };
  B.step = (S) => {
    const b = S.ball, half = LW / 2;
    if (!b.out) {
      if (!b.gutter) { if (b.u > OIL && b.u < LEN) b.vv += b.hook * 1.9 * STEP; b.u += b.vu * STEP; b.v += b.vv * STEP; if (Math.abs(b.v) > half + 0.01 && b.u < LEN + 0.5) { b.gutter = true; b.v = Math.sign(b.v) * (half + GUT / 2); b.vv = 0; S.gutterSfx = 1; } }
      else b.u += b.vu * STEP;
      b.vu = Math.max(0, b.vu - 0.25 * STEP); b.spin += b.vu * STEP / BR;
      if (b.u > LEN + 1.6 || b.vu < 0.05) b.out = true;
    }
    // ball against pins
    if (!b.gutter && !b.out) for (const p of S.pins) { if (p.gone) continue; const du = p.u - b.u, dv = p.v - b.v, d = Math.sqrt(du * du + dv * dv), rr = BR + (p.down ? PR * 1.3 : PR); if (d >= rr) continue;
      const nu = du / (d || 1e-9), nv = dv / (d || 1e-9), vn = (b.vu - p.vu) * nu + (b.vv - p.vv) * nv; if (vn > 0) { const J = (1 + 0.55) * vn / (1 / MB + 1 / MP); p.vu += J / MP * nu; p.vv += J / MP * nv; b.vu -= J / MB * nu; b.vv -= J / MB * nv; knock(S, p, p.vu, p.vv); }
      const o = rr - d; p.u += nu * o; p.v += nv * o; }
    // pins against pins
    for (let i = 0; i < S.pins.length; i++) { const a = S.pins[i]; if (a.gone) continue; for (let j = i + 1; j < S.pins.length; j++) { const c = S.pins[j]; if (c.gone) continue; if (!a.down && !c.down) continue;
      const du = c.u - a.u, dv = c.v - a.v, d = Math.sqrt(du * du + dv * dv), rr = PR * (a.down ? 1.6 : 1) + PR * (c.down ? 1.6 : 1); if (d >= rr) continue;
      const nu = du / (d || 1e-9), nv = dv / (d || 1e-9), vn = (a.vu - c.vu) * nu + (a.vv - c.vv) * nv;
      if (vn > 0) { const J = (1 + 0.5) * vn / 2; a.vu -= J * nu; a.vv -= J * nv; c.vu += J * nu; c.vv += J * nv; if (J > 0.12) { knock(S, a, a.vu, a.vv); knock(S, c, c.vu, c.vv); } }
      const o = (rr - d) / 2; a.u -= nu * o; a.v -= nv * o; c.u += nu * o; c.v += nv * o; } }
    // pins slide, bounce off the kickbacks, drop into the pit
    let moving = false; const wall = half + GUT + 0.28;
    for (const p of S.pins) { if (p.gone) continue; const s = Math.sqrt(p.vu * p.vu + p.vv * p.vv); if (s > 0) { const ns = Math.max(0, s - 2.8 * STEP); p.vu *= ns / s; p.vv *= ns / s; } p.u += p.vu * STEP; p.v += p.vv * STEP;
      if (Math.abs(p.v) > wall) { p.v = Math.sign(p.v) * wall; p.vv = -p.vv * 0.45; } if (p.u > LEN + 1.15) { p.gone = true; p.down = true; } if (p.u < LEN - 1.2 && p.down) { p.u = LEN - 1.2; p.vu = Math.abs(p.vu) * 0.3; }
      if (p.down && p.tilt < 1) p.tilt = Math.min(1, p.tilt + STEP * 4); if (s > 0.04) moving = true; }
    S.t += STEP; if ((b.out && !moving && S.t > 0.5) || S.t > 9) S.done = true;
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
  B.pin = () => { const g = new THREE.Group(), boneM = G.mat('col', { c: 0xeee4cc, r: 0.35 });
    const prof = [0, 0, 0.026, 0.002, 0.04, 0.03, 0.056, 0.1, 0.06, 0.14, 0.052, 0.19, 0.032, 0.245, 0.025, 0.27, 0.03, 0.31, 0.035, 0.34, 0.03, 0.365, 0.016, 0.378, 0, 0.381];
    M.P(g, M.lathe(prof, 18), boneM); [0.262, 0.282].forEach(y => M.P(g, M.cyl(0.0255, 0.0255, 0.008, 14), G.mat('col', { c: 0x8a1018, r: 0.5 }), [0, y, 0]));
    M.mirror(k => M.P(g, M.sph(0.007, 6, 5), G.mat('col', { c: 0x100806 }), [k * 0.012, 0.34, 0.03]));
    g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g; };
  B.buildLane = (W, x0, z, li) => {
    const grp = W.group, wood = new THREE.MeshStandardMaterial({ map: B.laneTex(), roughness: 0.18, metalness: 0.05 });
    const FX = x0 + 6, cx = FX + (LEN + 1.6) / 2;
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(LEN + 1.6, LW), wood); lane.rotation.x = -Math.PI / 2; lane.position.set(cx, LY, z); grp.add(lane);
    const appr = new THREE.Mesh(new THREE.PlaneGeometry(6, LW + 2 * GUT + 0.4), wood); appr.rotation.x = -Math.PI / 2; appr.position.set(FX - 3, LY, z); grp.add(appr);
    M.P(grp, M.box(LEN + 1.6, LY - 0.02, LW - 0.01), G.mat('col', { c: 0x2a1a10, t: 'wood' }), [cx, (LY - 0.02) / 2, z]); M.P(grp, M.box(6, LY - 0.02, LW + 2 * GUT + 0.39), G.mat('col', { c: 0x2a1a10, t: 'wood' }), [FX - 3, (LY - 0.02) / 2, z]);
    [-1, 1].forEach(s => { const gm = new THREE.Mesh(new THREE.CylinderGeometry(GUT / 2, GUT / 2, LEN + 1.6, 12, 1, true, 0, Math.PI), G.mat('col', { c: 0x3a3438, r: 0.4, m: 0.4, ds: true })); gm.rotation.set(0, 0, Math.PI / 2); gm.rotation.x = 0; gm.position.set(cx, LY, z + s * (LW / 2 + GUT / 2)); gm.rotation.z = Math.PI / 2; gm.rotation.y = 0; gm.quaternion.setFromEuler(new THREE.Euler(Math.PI, 0, Math.PI / 2)); grp.add(gm);
      M.P(grp, M.box(LEN + 1.6, LY + 0.1, 0.08), G.mat('col', { c: 0x2a1a10, t: 'wood' }), [cx, (LY + 0.1) / 2, z + s * (LW / 2 + GUT + 0.04)]); });
    M.P(grp, M.box(0.03, 0.005, LW), G.mat('col', { c: 0x8a1018 }), [FX, LY + 0.004, z]);   // foul line
    for (let k = -2; k <= 2; k++) { const ar = new THREE.Mesh(new THREE.CircleGeometry(0.035, 3), G.mat('col', { c: 0x3a0a0a })); ar.rotation.set(-Math.PI / 2, 0, -Math.PI / 2); ar.position.set(FX + 4.6 + Math.abs(k) * 0.3, LY + 0.005, z + k * 0.2); grp.add(ar); }   // target arrows
    // the pin deck end: kickbacks of stacked bones, a pit, and a giant skull over the pins
    const deckX = FX + LEN; [-1, 1].forEach(s => M.P(grp, M.box(2.2, 1.0, 0.25), G.mat('col', { c: 0x2a1a10, t: 'wood' }), [deckX + 0.6, 0.5, z + s * (LW / 2 + GUT + 0.35)]));
    M.P(grp, M.box(1.4, 0.2, LW + 2 * GUT + 0.6), G.mat('col', { c: 0x050304 }), [deckX + 1.8, -0.02, z]);
    M.P(grp, M.box(0.3, 3.2, LW + 2 * GUT + 1.0), G.mat('col', { c: 0x140c0a }), [deckX + 2.6, 1.6, z]);
    const mask = new THREE.Group(); M.P(mask, M.box(0.2, 1.3, LW + 2 * GUT + 1.0), G.mat('col', { c: 0x1a0e0a, t: 'wood' }), [0, 0, 0]); const sk = G.arcade.skull(5.5, li ? 0xff4030 : 0x60ff90); sk.rotation.y = -Math.PI / 2; sk.position.set(-0.2, 0.05, 0); mask.add(sk); mask.position.set(deckX + 0.3, 1.9, z); grp.add(mask);
    W.lights.push({ pos: new G.V3(deckX - 2.6, 1.2, z), color: 0xfff0d0, intensity: 1.7, dist: 6, seed: 30 + li, flicker: false });
    W.lights.push({ pos: new G.V3(FX - 1.5, 3.0, z), color: 0xffc080, intensity: 2.0, dist: 9, seed: 32 + li, flicker: true });
    // a ball return beside the approach and a scoreboard hanging over the foul line
    const ret = new THREE.Group(); M.P(ret, M.box(1.2, 0.5, 0.5), G.mat('col', { c: 0x2a1a10, t: 'wood' }), [0, 0.25, 0]); const rs = G.arcade.skull(2.5, 0xffb040); rs.position.set(0, 0.62, 0); rs.rotation.y = -Math.PI / 2; ret.add(rs); W.place(ret, FX - 4.5, 0, z + LW / 2 + GUT + 0.9, 0, 0.6);
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 320; const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.31), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.7 })); board.position.set(FX + 0.5, 4.4, z); board.rotation.y = -Math.PI / 2; grp.add(board);
    const L = { li, FX, z, x0, cv, tex, pins: [], ball: null, sim: null, table: null };
    for (let i = 0; i < 10; i++) { const m = B.pin(); m.userData.dynamic = true; G.scene.add(m); L.pins.push(m); }
    const ball = new THREE.Mesh(new THREE.SphereGeometry(BR, 28, 20), new THREE.MeshStandardMaterial({ map: B.skullTex(), roughness: 0.3 })); ball.castShadow = true; G.scene.add(ball); L.ball = ball;
    for (let k = -2; k <= 2; k++) W.addSolid(FX + LEN * (k + 2) / 4, z, 0.9);
    W.interact.push({ id: 'bowl', label: `Skull Bowling · lane ${li + 1}`, x: FX - 3.5, z, r: 2.8, desc: 'Ten frames, 1 to 6 bowlers', lane: li });
    B.lanes[li] = L; B.setPins(L, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]); B.idleBall(L); B.drawBoard(L);
  };
  B.wpos = (L, u, v, y = 0) => new G.V3(L.FX + u, LY + y, L.z + v);
  B.setPins = (L, pins) => { L.pins.forEach((m, i) => { m.visible = !!pins[i]; m.position.copy(B.wpos(L, PINS[i][0], PINS[i][1])); m.rotation.set(0, R() * 6, 0); }); };
  B.idleBall = (L, pos = 0.25) => { L.ball.visible = true; L.ball.position.copy(B.wpos(L, -4.6, LW / 2 + GUT + 0.9 - 0.0, 0.6)); };
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
    rules: 'Ten frames, two balls a frame. A strike (all ten on the first ball) scores 10 plus your next two balls; a spare scores 10 plus your next ball. The tenth frame gives bonus balls for a strike or spare. Highest total takes the pot. On your turn, walk up to the lane and press E: the mouse aims, A and D slide your starting spot, hold left click for power and move the mouse while holding to hook it.',
    canOpen() { const used = Object.values(TB.list).filter(t => t.game === 'bowl' && !t.closed).map(t => t.opts.lane); if (used.length >= B.lanes.length) { G.ui.toast('Both lanes are taken. Join a game instead.'); return false; } return true; },
    formOpts() { const used = Object.values(TB.list).filter(t => t.game === 'bowl' && !t.closed).map(t => t.opts.lane), Pl = G.player, free = B.lanes.filter(L => !used.includes(L.li)); if (Pl && free.length) free.sort((x, y) => Math.abs(Pl.pos.z - x.z) - Math.abs(Pl.pos.z - y.z)); return { lane: free.length ? free[0].li : 0 }; },
    optLabel(t) { return `lane ${(t.opts.lane | 0) + 1}`; },
    start(t) { const st = t.st; Object.assign(st, { pl: t.seats.map(s => ({ id: s.id, name: s.name, npc: !!s.npc, f: Array.from({ length: 10 }, () => []) })), cur: 0, frame: 1, ball: 1, pins: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], phase: 'aim', shot: null, no: 0, pot: t.buy * t.seats.length, at: now() + 120000 }); TB.say(t, `${st.pl[0].name} is up`); },
    myTurn(t, id) { const st = t.st; return st && st.phase === 'aim' && st.pl[st.cur] && st.pl[st.cur].id === id; },
    act(t, id, a) { const st = t.st; if (a.t !== 'roll' || st.phase !== 'aim' || st.pl[st.cur].id !== id || (a.no | 0) !== st.no + 1) return false;
      st.shot = { no: st.no + 1, pos: G.clamp(+a.pos || 0, -0.45, 0.45), ang: G.clamp(+a.ang || 0, -0.09, 0.09), pow: G.clamp(+a.pow || 0, 0, 1), hook: G.clamp(+a.hook || 0, -1, 1), by: id }; st.pre = st.pins.slice(); st.phase = 'rolling'; st.at = now() + 30000; },
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
  B.enterAim = (L) => { B.aim = { L, pos: 0.15, ang: 0, pow: 0, hook: 0, charging: false, chargeT: 0, rolled: false, follow: 0 }; B.hud(); };
  B.endAim = () => { const A = B.aim; if (!A) return; B.aim = null; B.hud(); const pw = document.getElementById('poolPow'); if (pw) pw.hidden = true; if (B.guide) B.guide.visible = false; };
  B.aimInput = (dt) => {
    const A = B.aim, L = A.L, t = L.table, st = t.st, sens = G.settings.sens || 1;
    if (A.rolled) return;
    if (G.keys.KeyA) A.pos = G.clamp(A.pos - dt * 0.5, -0.42, 0.42); if (G.keys.KeyD) A.pos = G.clamp(A.pos + dt * 0.5, -0.42, 0.42);
    if (G.mouse.l) { A.charging = true; A.chargeT += dt; A.pow = 0.5 - 0.5 * Math.cos(A.chargeT / 1.4 * Math.PI); A.hook = G.clamp(A.hook + G.mouse.dx * 0.004 * sens, -1, 1); }
    else if (A.charging) { A.charging = false; if (A.pow < 0.03) { A.chargeT = 0; return; } A.rolled = true; G.sfx('swing', 0.6);
      const no = st.no + 1, shot = { t: 'roll', no, pos: A.pos, ang: A.ang + (R() - 0.5) * 0.01 * (T.amt ? T.amt() : 0), pow: A.pow, hook: A.hook };
      L.sim = B.newSim(st.pins, shot, no); L.sim.by = me(); TB.act(t.tid, shot); A.follow = 0.001; }
    else A.ang = G.clamp(A.ang + G.mouse.dx * 0.00035 * sens, -0.04, 0.04);
  };
  B.camAim = (dt) => {
    const A = B.aim, L = A.L, cam = G.camera;
    if (A.rolled && L.sim) { const b = L.sim.ball, bp = B.wpos(L, b.u, b.v); const want = B.wpos(L, Math.max(-3, b.u - 3.2), b.v * 0.5, 1.15); A.cp = (A.cp || want.clone()).lerp(want, Math.min(1, dt * 5)); cam.position.copy(A.cp); cam.lookAt(bp.x + 2, 0.25, bp.z); return; }
    const p = B.wpos(L, -3.3, A.pos * 0.6, 1.55); cam.position.copy(p); cam.lookAt(B.wpos(L, LEN, A.pos + Math.tan(A.ang) * LEN, 0.1));
  };
  // ball and pins move, the line shows where you're aiming
  const q = new THREE.Quaternion(), ax = new G.V3();
  B.update = (dt) => {
    B.lanes.forEach(L => {
      const S = L.sim;
      if (S && !S.done) { S.acc += Math.min(dt, 0.1); let n = 0; while (S.acc >= STEP && n < 60 && !S.done) { S.acc -= STEP; n++; B.step(S); } if (S.clatter) { G.sfx('bonecollapse', G.clamp(S.clatter / 6, 0.3, 1), B.wpos(L, LEN, 0)); G.sfx('bonehit', 0.6, B.wpos(L, LEN, 0)); S.clatter = 0; } if (S.gutterSfx) { G.sfx('rumble', 0.3, B.wpos(L, 10, 0)); S.gutterSfx = 0; }
        if (S.done) { if (L.pending) { L.hold = true; setTimeout(() => { L.hold = false; if (L.sim && L.sim.done) L.sim = null; if (L.pending) { B.setPins(L, L.pending); L.pending = null; } else if (L.table && L.table.st && L.table.st.phase !== 'rolling') B.setPins(L, L.table.st.pins); B.idleBall(L); }, 1400); }
          const t = L.table; if (t && TB.host[t.tid] && t.st.phase === 'rolling') { const ht = TB.host[t.tid]; setTimeout(() => { if (GM.bowl.resolve(ht, S) !== false) TB.commit(ht); }, 1200); }
          if (B.aim && B.aim.L === L && B.aim.rolled) setTimeout(() => { if (B.aim && B.aim.L === L) B.endAim(); }, 1300); } }
      if (S) { const b = S.ball; if (!b.out || b.u < LEN + 1.6) { L.ball.visible = b.u < LEN + 1.7; L.ball.position.copy(B.wpos(L, b.u, b.v, BR - (b.gutter ? 0.07 : 0))); ax.set(0, 0, -1); q.setFromAxisAngle(ax, b.vu * dt / BR); L.ball.quaternion.premultiply(q); }
        S.pins.forEach((p, i) => { const m = L.pins[i]; if (!p.on) { m.visible = false; return; } m.visible = !(p.gone && p.u > LEN + 1.3); m.position.copy(B.wpos(L, p.u, p.v, p.down ? 0.03 * p.tilt : 0)); if (p.down) { m.rotation.set(0, 0, 0); m.rotateOnWorldAxis(new G.V3(p.ax, 0, p.az), p.tilt * Math.PI / 2 * 0.98); } }); }
    });
    if (B.aim && !B.aim.rolled) { const A = B.aim, L = A.L; L.ball.visible = true; L.ball.position.copy(B.wpos(L, -0.4, A.pos, BR)); if (!B.guide) { B.guide = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new G.V3(), new G.V3()]), new THREE.LineDashedMaterial({ color: 0xf3e8c8, dashSize: 0.3, gapSize: 0.2, transparent: true, opacity: 0.7 })); G.scene.add(B.guide); }
      B.guide.geometry.setFromPoints([B.wpos(L, -0.2, A.pos, 0.01), B.wpos(L, OIL, A.pos + Math.tan(A.ang) * OIL, 0.01)]); B.guide.computeLineDistances(); B.guide.visible = true;
      const pb = document.getElementById('poolPow') || (() => { const d = document.createElement('div'); d.id = 'poolPow'; d.innerHTML = '<i></i>'; document.getElementById('hud').appendChild(d); return d; })(); pb.hidden = false; pb.firstChild.style.width = Math.round(A.pow * 100) + '%';
      const hd = document.getElementById('bowlHook'); if (hd) hd.textContent = `Hook ${A.hook < -0.05 ? '◀'.repeat(Math.ceil(-A.hook * 3)) : A.hook > 0.05 ? '▶'.repeat(Math.ceil(A.hook * 3)) : '•'}`; }
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
      if (!B.aim.rolled && (G.mouse.rPressed || G.pressed.KeyE)) { B.endAim(); G.pressed.KeyE = false; return up0(dt, t); }
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
#bowlHud{position:absolute;left:50%;top:70px;transform:translateX(-50%);background:rgba(20,12,6,.8);border:1px solid #6a5030;border-radius:4px;padding:6px 14px;font-size:13px;color:#e8d8b0;text-align:center;pointer-events:none}#bowlHud b{font-family:var(--head);color:#f3d998}`;
  document.head.appendChild(css);
  B.hud = () => {
    let el = document.getElementById('bowlHud'); const L = B.lanes.find(l => l.table && l.table.st && l.table.st.pl && l.table.st.pl.some(p => p.id === me())), t = L && L.table;
    if (!t || G.World.theme !== 'hideout' || t.phase !== 'play') { if (el) el.hidden = true; return; }
    if (!el) { el = document.createElement('div'); el.id = 'bowlHud'; document.getElementById('hud').appendChild(el); }
    const st = t.st, cur = st.pl[st.cur]; el.hidden = false;
    el.innerHTML = `<b>Lane ${L.li + 1}</b> · frame ${Math.min(10, st.frame)} · ${st.pl.map(p => `${esc(p.id === me() ? 'You' : p.name)} ${B.score(p.f).filter(v => v !== null).pop() || 0}`).join(' · ')}<br>${st.phase === 'over' ? esc(st.winner) + ' win' : cur.id === me() ? (st.phase === 'aim' ? (B.aim ? 'Mouse aims · A/D slide · hold left click for power, move while holding to hook · right click steps back' : 'Your ball · walk up to the lane and press E') : 'Rolling…') : esc(cur.name) + ' is bowling'}<br><span id="bowlHook"></span>`;
  };
})();
