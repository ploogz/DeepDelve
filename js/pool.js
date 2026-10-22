/* ============================================================
   The Bone Table: eight-ball on a table built from the dead
   - femur legs, a ribcage skirt, vertebrae along the rails, a skull swallowing every pocket,
     blood-red felt with a faded summoning circle, carved bone and stone balls, a femur cue
   - real ball physics on the cloth: rolling friction, elastic ball-to-ball impulses, cushions,
     pocket jaws; every client simulates each shot from the same start and the table host's result is final
   - 1v1 or 2v2 (seats alternate teams), regulars fill empty seats, standard eight-ball:
     open table after the break, solids/stripes, fouls give ball in hand, sink the 8 last to win
   - controls: walk up and press E on your shot · mouse aims · hold left click for power, release to strike ·
     Space for the top view · right click or E to step back. With ball in hand, move the mouse and click to place.
   ============================================================ */
'use strict';
(() => {
  const T = G.tavern, TB = G.tables, GM = TB.GAMES, UI = G.ui, R = Math.random;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const L = 2.8, W = 1.4, r = 0.034, H = 0.82, CORNER_GAP = 0.1, SIDE_GAP = 0.075, ROLL = 0.22, DRAG = 0.28, E_BALL = 0.94, E_RAIL = 0.76, STEP = 1 / 300;
  const POCKETS = [[-L / 2 - 0.012, -W / 2 - 0.012, 0.078], [L / 2 + 0.012, -W / 2 - 0.012, 0.078], [-L / 2 - 0.012, W / 2 + 0.012, 0.078], [L / 2 + 0.012, W / 2 + 0.012, 0.078], [0, -W / 2 - 0.035, 0.07], [0, W / 2 + 0.035, 0.07]];
  const JAWS = []; [-1, 1].forEach(sx => [-1, 1].forEach(sz => { JAWS.push([sx * (L / 2 - CORNER_GAP), sz * W / 2], [sx * SIDE_GAP, sz * W / 2], [sx * L / 2, sz * (W / 2 - CORNER_GAP)]); }));
  const P = G.pool = { tableAt: null, meshes: [], sim: null, aim: null, lastSnap: -1 };
  const isSolid = id => id >= 1 && id <= 7, isStripe = id => id >= 9 && id <= 15;
  const COLORS = [0xf2ead2, 0xe0a020, 0x1a3a9a, 0xb01818, 0x5a1a8a, 0xe06010, 0x1a6a2a, 0x6a0a14, 0x101010];

  /* ================= physics ================= */
  P.rack = () => {
    const pos = [], fx = L / 4, dx = r * Math.sqrt(3) + 0.0006; let k = 0;
    const order = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];   // 8 in the middle of row three, a solid and a stripe in the back corners
    for (let row = 0; row < 5; row++) for (let j = 0; j <= row; j++) pos.push([order[k++], fx + row * dx, (j - row / 2) * (2 * r + 0.0006)]);
    const out = [[0, -L / 4, 0, 1]]; pos.forEach(p => out.push([p[0], p[1], p[2], 1])); out.sort((a, b) => a[0] - b[0]); return out;
  };
  const inGapLong = x => Math.abs(x) < SIDE_GAP || Math.abs(x) > L / 2 - CORNER_GAP, inGapShort = z => Math.abs(z) > W / 2 - CORNER_GAP;
  P.newSim = (balls, shot, no) => {
    const S = { no, balls: balls.map(b => ({ id: b[0], x: b[1], z: b[2], vx: 0, vz: 0, on: !!b[3], drop: null })), ev: { first: null, pocketed: [], cueIn: false, rail: false }, done: false, t: 0, acc: 0 };
    const cue = S.balls.find(b => b.id === 0);
    if (shot.cue) { cue.x = shot.cue[0]; cue.z = shot.cue[1]; cue.on = true; }
    const sp = 0.4 + Math.pow(G.clamp(shot.pow, 0, 1), 1.15) * 6.4; cue.vx = Math.cos(shot.ang) * sp; cue.vz = Math.sin(shot.ang) * sp;
    return S;
  };
  const pocketBall = (S, b) => { b.on = false; const pk = POCKETS.reduce((best, p) => { const d = (p[0] - b.x) ** 2 + (p[1] - b.z) ** 2; return d < best.d ? { d, p } : best; }, { d: 1e9, p: POCKETS[0] }).p; b.drop = { t: 0, x0: b.x, z0: b.z, px: pk[0], pz: pk[1] }; b.vx = b.vz = 0; S.ev.pocketed.push(b.id); if (b.id === 0) S.ev.cueIn = true; S.sfxPocket = (S.sfxPocket || 0) + 1; };
  P.step = (S) => {
    const B = S.balls, n = B.length;
    for (let i = 0; i < n; i++) { const b = B[i]; if (!b.on) continue; b.x += b.vx * STEP; b.z += b.vz * STEP; }
    // ball to ball
    for (let i = 0; i < n; i++) { const a = B[i]; if (!a.on) continue;
      for (let j = i + 1; j < n; j++) { const b = B[j]; if (!b.on) continue;
        const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz; if (d2 >= 4 * r * r) continue;
        const d = Math.sqrt(d2) || 1e-9, nx = dx / d, nz = dz / d, p = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
        if (p > 0) { const fa = a.vx * nx + a.vz * nz, fb = -(b.vx * nx + b.vz * nz), k = (1 + E_BALL) / 2 * p; a.vx -= k * nx; a.vz -= k * nz; b.vx += k * nx; b.vz += k * nz;
          // the striking ball keeps a little of its forward roll through the hit (natural follow)
          if (fa > 0 && fa >= fb) { a.vx += 0.12 * fa * nx; a.vz += 0.12 * fa * nz; } else if (fb > 0) { b.vx -= 0.12 * fb * nx; b.vz -= 0.12 * fb * nz; }
          if (S.ev.first === null && (a.id === 0 || b.id === 0)) S.ev.first = a.id === 0 ? b.id : a.id;
          S.click = Math.max(S.click || 0, p); }
        const o = (2 * r - d) / 2 + 1e-6; a.x -= nx * o; a.z -= nz * o; b.x += nx * o; b.z += nz * o; } }
    // cushions, jaws, pockets
    for (let i = 0; i < n; i++) { const b = B[i]; if (!b.on) continue;
      for (const p of POCKETS) { const dx = b.x - p[0], dz = b.z - p[1]; if (dx * dx + dz * dz < p[2] * p[2]) { pocketBall(S, b); break; } } if (!b.on) continue;
      const lx = L / 2 - r, lz = W / 2 - r;
      if (b.x > lx) { if (inGapShort(b.z)) { if (b.x > L / 2 + r * 0.5) pocketBall(S, b); } else { b.x = lx - (b.x - lx); b.vx = -b.vx * E_RAIL; b.vz *= 0.96; S.ev.rail = true; S.thud = Math.max(S.thud || 0, Math.abs(b.vx)); } }
      else if (b.x < -lx) { if (inGapShort(b.z)) { if (b.x < -L / 2 - r * 0.5) pocketBall(S, b); } else { b.x = -lx - (b.x + lx); b.vx = -b.vx * E_RAIL; b.vz *= 0.96; S.ev.rail = true; S.thud = Math.max(S.thud || 0, Math.abs(b.vx)); } }
      if (!b.on) continue;
      if (b.z > lz) { if (inGapLong(b.x)) { if (b.z > W / 2 + r * 0.5) pocketBall(S, b); } else { b.z = lz - (b.z - lz); b.vz = -b.vz * E_RAIL; b.vx *= 0.96; S.ev.rail = true; S.thud = Math.max(S.thud || 0, Math.abs(b.vz)); } }
      else if (b.z < -lz) { if (inGapLong(b.x)) { if (b.z < -W / 2 - r * 0.5) pocketBall(S, b); } else { b.z = -lz - (b.z + lz); b.vz = -b.vz * E_RAIL; b.vx *= 0.96; S.ev.rail = true; S.thud = Math.max(S.thud || 0, Math.abs(b.vz)); } }
      if (!b.on) continue;
      for (const j of JAWS) { const dx = b.x - j[0], dz = b.z - j[1], d2 = dx * dx + dz * dz, rr = r + 0.006; if (d2 < rr * rr) { const d = Math.sqrt(d2) || 1e-9, nx = dx / d, nz = dz / d, vn = b.vx * nx + b.vz * nz; if (vn < 0) { b.vx -= 1.7 * vn * nx; b.vz -= 1.7 * vn * nz; } b.x = j[0] + nx * rr; b.z = j[1] + nz * rr; } }
      // the cloth slows everything
      const s = Math.sqrt(b.vx * b.vx + b.vz * b.vz); if (s > 0) { const ns = s - (ROLL + DRAG * s) * STEP; if (ns <= 0.005) { b.vx = 0; b.vz = 0; } else { b.vx *= ns / s; b.vz *= ns / s; } } }
    S.t += STEP;
    if (!B.some(b => b.on && (b.vx || b.vz)) || S.t > 40) S.done = true;
  };
  P.simToArr = (S) => S.balls.map(b => [b.id, b.x, b.z, b.on ? 1 : 0]);

  /* ================= models ================= */
  P.ballTex = (id) => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d'), col = '#' + COLORS[id > 8 ? id - 8 : id].toString(16).padStart(6, '0');
    const bone = '#efe3c4';
    if (id === 0) { x.fillStyle = bone; x.fillRect(0, 0, 256, 128); }
    else if (id === 8) { x.fillStyle = '#121014'; x.fillRect(0, 0, 256, 128); }
    else if (isStripe(id)) { x.fillStyle = bone; x.fillRect(0, 0, 256, 128); x.fillStyle = col; x.fillRect(0, 34, 256, 60); }
    else { x.fillStyle = col; x.fillRect(0, 0, 256, 128); }
    // hairline cracks and grain: bone and stone, not plastic
    x.strokeStyle = id === 8 ? 'rgba(160,140,200,.25)' : 'rgba(60,40,20,.22)'; x.lineWidth = 1;
    for (let k = 0; k < 9; k++) { x.beginPath(); let px = Math.random() * 256, py = Math.random() * 128; x.moveTo(px, py); for (let s = 0; s < 5; s++) { px += (Math.random() - 0.5) * 30; py += (Math.random() - 0.5) * 18; x.lineTo(px, py); } x.stroke(); }
    // the number in a bone roundel (a skull for the eight, a rune for the cue)
    [64, 192].forEach(cx => { if (id === 0) { x.strokeStyle = 'rgba(120,20,30,.55)'; x.lineWidth = 3; x.beginPath(); x.arc(cx, 64, 11, 0, Math.PI * 2); x.moveTo(cx, 50); x.lineTo(cx, 78); x.moveTo(cx - 12, 64); x.lineTo(cx + 12, 64); x.stroke(); return; }
      x.fillStyle = id === 8 ? '#e8dcc0' : bone; x.beginPath(); x.ellipse(cx, 64, 20, 24, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#1a1208'; x.font = 'bold 26px Georgia'; x.textAlign = 'center'; x.textBaseline = 'middle';
      if (id === 8) { x.beginPath(); x.arc(cx, 60, 11, 0, Math.PI * 2); x.fill(); x.fillRect(cx - 7, 64, 14, 10); x.fillStyle = '#e8dcc0'; x.beginPath(); x.arc(cx - 4.5, 60, 3.2, 0, 7); x.arc(cx + 4.5, 60, 3.2, 0, 7); x.fill(); }
      else x.fillText(String(id), cx, 66); });
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
  };
  P.feltTex = () => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d');
    x.fillStyle = '#4a0a12'; x.fillRect(0, 0, 1024, 512);
    for (let k = 0; k < 9000; k++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '20,0,4' : '110,20,30'},${Math.random() * 0.12})`; x.fillRect(Math.random() * 1024, Math.random() * 512, 2, 2); }
    // a faded summoning circle and the head string
    x.strokeStyle = 'rgba(200,150,90,.13)'; x.lineWidth = 3; x.beginPath(); x.arc(512, 256, 150, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.arc(512, 256, 120, 0, Math.PI * 2); x.stroke();
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 - Math.PI / 2, b = (k + 2) / 5 * Math.PI * 2 - Math.PI / 2; x.beginPath(); x.moveTo(512 + Math.cos(a) * 120, 256 + Math.sin(a) * 120); x.lineTo(512 + Math.cos(b) * 120, 256 + Math.sin(b) * 120); x.stroke(); }
    x.strokeStyle = 'rgba(230,210,170,.18)'; x.lineWidth = 2; x.beginPath(); x.moveTo(256, 20); x.lineTo(256, 492); x.stroke();
    x.fillStyle = 'rgba(230,210,170,.35)'; [[256, 256], [768, 256]].forEach(([px, py]) => { x.beginPath(); x.arc(px, py, 5, 0, 7); x.fill(); });
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
  };
  P.cue = () => {
    const g = new THREE.Group(), bone = G.mat('col', { c: 0xe8dcbc, r: 0.4 }), wrap = G.mat('col', { c: 0x3a1a10, t: 'leather' });
    M.P(g, M.cyl(0.0065, 0.011, 0.95, 14), bone, [0, 0.28, 0]);                      // femur shaft
    M.P(g, M.cyl(0.011, 0.016, 0.5, 14), wrap, [0, -0.44, 0]);                        // leather-wrapped butt
    for (let i = 0; i < 7; i++) M.P(g, M.tor(0.0105 - i * 0.0004, 0.002, 6, 14), bone, [0, -0.1 + i * 0.12, 0], [Math.PI / 2, 0, 0]);   // vertebra rings
    M.P(g, M.sph(0.02, 12, 10), bone, [0, -0.7, 0], 0, [1.2, 0.8, 1]); M.P(g, M.sph(0.012, 10, 8), bone, [0.01, -0.72, 0]);           // knuckle end
    M.P(g, M.cyl(0.0068, 0.0068, 0.02, 12), G.mat('iron'), [0, 0.765, 0]); M.P(g, M.cyl(0.0062, 0.0066, 0.008, 12), G.mat('col', { c: 0x2a4a8a, r: 0.9 }), [0, 0.779, 0]);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;   // tip at local y = +0.783
  };
  P.buildTable = (world, cx, cz) => {
    const g = new THREE.Group(), bone = G.mat('col', { c: 0xb8aa8c, r: 0.92 }), wood = G.mat('col', { c: 0x22140c, t: 'wood', r: 0.5 }), leather = G.mat('col', { c: 0x2a0e0a, t: 'leather' }), iron = G.mat('iron'), inlay = G.mat('col', { c: 0x9a8c70, r: 0.8 });
    const RW = 0.15, OL = L + RW * 2, OW = W + RW * 2;
    // the bed and slate
    M.P(g, M.box(OL, 0.16, OW), wood, [0, H - 0.1, 0]);
    const felt = new THREE.Mesh(new THREE.PlaneGeometry(L + 0.04, W + 0.04), new THREE.MeshStandardMaterial({ map: P.feltTex(), roughness: 0.95 })); felt.rotation.x = -Math.PI / 2; felt.position.y = H; felt.receiveShadow = true; g.add(felt);
    // cushions with gaps at the pockets, rails on top with vertebrae inlaid
    const cush = (x0, x1, z, along) => { const len = Math.abs(x1 - x0), m = (x0 + x1) / 2; const c = M.P(g, M.box(along ? len : 0.05, 0.045, along ? 0.05 : len), leather, along ? [m, H + 0.022, z] : [z, H + 0.022, m]); return c; };
    [-1, 1].forEach(s => { cush(-L / 2 + CORNER_GAP, -SIDE_GAP, s * (W / 2 + 0.025), true); cush(SIDE_GAP, L / 2 - CORNER_GAP, s * (W / 2 + 0.025), true); cush(-W / 2 + CORNER_GAP, W / 2 - CORNER_GAP, s * (L / 2 + 0.025), false); });
    [-1, 1].forEach(s => { M.P(g, M.box(OL, 0.05, RW - 0.05), wood, [0, H + 0.045, s * (W / 2 + 0.05 + (RW - 0.05) / 2)]); M.P(g, M.box(RW - 0.05, 0.05, OW), wood, [s * (L / 2 + 0.05 + (RW - 0.05) / 2), H + 0.045, 0]); });
    for (let i = 0; i < 26; i++) { const t = i / 25; [-1, 1].forEach(s => { const px = -L / 2 + 0.15 + t * (L - 0.3); if (Math.abs(px) < 0.12) return; M.P(g, M.box(0.045, 0.012, 0.028), inlay, [px, H + 0.075, s * (W / 2 + 0.11)]); M.P(g, M.sph(0.008, 6, 5), inlay, [px, H + 0.083, s * (W / 2 + 0.11)]); }); }
    for (let i = 0; i < 12; i++) { const t = i / 11; [-1, 1].forEach(s => { const pz = -W / 2 + 0.15 + t * (W - 0.3); M.P(g, M.box(0.028, 0.012, 0.045), inlay, [s * (L / 2 + 0.11), H + 0.075, pz]); }); }
    // tiny skulls where the diamonds would be
    [-1, 1].forEach(s => [-3, -2, -1, 1, 2, 3].forEach(k => { const px = k * L / 8; const sk = new THREE.Group(); M.P(sk, M.sph(0.012, 8, 6), bone, [0, 0.006, 0], 0, [1, 0.9, 1.1]); M.P(sk, M.box(0.012, 0.006, 0.01), bone, [0, -0.002, 0.006]); sk.position.set(px, H + 0.072, s * (W / 2 + 0.135)); g.add(sk); }));
    // every pocket is a skull's mouth
    POCKETS.forEach(([px, pz, pr], i) => {
      const hole = M.P(g, M.cyl(pr * 1.02, pr * 0.9, 0.14, 20), G.mat('col', { c: 0x050304, r: 1 }), [px, H - 0.06, pz]);
      const out = Math.atan2(pz, px), sk = new THREE.Group(); sk.position.set(px + Math.cos(out) * 0.1, H - 0.02, pz + Math.sin(out) * 0.1); sk.rotation.y = -out + Math.PI / 2;
      M.P(sk, M.sph(0.11, 18, 14), bone, [0, 0.05, 0], 0, [1, 0.85, 1.05]); M.P(sk, M.box(0.12, 0.05, 0.1), bone, [0, -0.04, 0.03]);
      M.mirror(s2 => { M.P(sk, M.sph(0.03, 10, 8), G.mat('col', { c: 0x050304 }), [s2 * 0.04, 0.06, 0.085]); M.P(sk, M.sph(0.008, 6, 6), G.mat('emissive', { c: 0xff4020, i: 3 }), [s2 * 0.04, 0.06, 0.1]); });
      for (let k = -2; k <= 2; k++) M.P(sk, M.box(0.014, 0.022, 0.012), G.mat('col', { c: 0xf2ead2 }), [k * 0.018, -0.02, 0.085]);
      g.add(sk);
    });
    // femur legs and a ribcage skirt
    [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]].forEach(([sx, sz]) => { const lx = sx * (L / 2 - 0.05), lz = sz * (W / 2 - 0.02); M.P(g, M.cyl(0.045, 0.05, H - 0.2, 12), bone, [lx, (H - 0.2) / 2, lz]); [0.06, H - 0.24].forEach(y => { M.P(g, M.sph(0.065, 12, 10), bone, [lx - 0.035, y, lz]); M.P(g, M.sph(0.065, 12, 10), bone, [lx + 0.035, y, lz]); }); });
    [-1, 1].forEach(s => { for (let i = 0; i < 9; i++) { const px = -L / 2 + 0.2 + i * (L - 0.4) / 8; M.P(g, M.tor(0.13, 0.014, 6, 16, Math.PI), bone, [px, H - 0.18, s * (OW / 2 - 0.02)], [0, Math.PI / 2, Math.PI]); } M.P(g, M.cyl(0.02, 0.02, L, 10), bone, [0, H - 0.31, s * (OW / 2 - 0.02)], [0, 0, Math.PI / 2]); });
    // a skull chandelier with candles over the table
    const lamp = new THREE.Group(); lamp.position.y = 2.2;
    M.P(lamp, M.tor(0.5, 0.02, 6, 30), iron, [0, 0, 0], [Math.PI / 2, 0, 0], [1.6, 1, 1]);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; const skx = Math.cos(a) * 0.8, skz = Math.sin(a) * 0.5; M.P(lamp, M.sph(0.06, 10, 8), bone, [skx, -0.02, skz], 0, [1, 0.9, 1.1]); const cd = M.prop.candles(1); cd.position.set(skx, 0.04, skz); cd.scale.setScalar(0.45); lamp.add(cd); }
    [-1, 1].forEach(s => M.P(lamp, M.cyl(0.006, 0.006, 1.6, 4), iron, [s * 0.6, 0.8, 0], [0, 0, s * -0.3]));
    g.add(lamp);
    g.position.set(cx, 0, cz); world.place(g, cx, 0, cz, 0, 0);
    world.lights.push({ pos: new G.V3(cx, 2.0, cz), color: 0xffc080, intensity: 1.9, dist: 7, seed: 21, flicker: true });
    // solid footprint: a row of circles down the long axis
    for (let k = -3; k <= 3; k++) world.addSolid && world.addSolid(cx + k * (L / 7), cz, 0.95);
    // the balls live in the scene, not the static group
    P.meshes.forEach(m => m.parent && m.parent.remove(m)); P.meshes = [];
    const geo = new THREE.SphereGeometry(r, 28, 20);
    for (let id = 0; id <= 15; id++) { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: P.ballTex(id), roughness: id === 8 ? 0.42 : 0.5, metalness: 0, envMapIntensity: 0.35 })); m.castShadow = true; m.rotation.set(R() * 6, R() * 6, R() * 6); m.userData.dynamic = true; G.scene.add(m); P.meshes.push(m); }
    P.cueMesh = P.cue(); P.cueMesh.visible = false; G.scene.add(P.cueMesh);
    P.guide = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new G.V3(), new G.V3(), new G.V3()]), new THREE.LineBasicMaterial({ color: 0xf3e8c8, transparent: true, opacity: 0.6, depthTest: false })); P.guide.renderOrder = 30; P.guide.visible = false; G.scene.add(P.guide);
    P.ghost = new THREE.Mesh(new THREE.RingGeometry(r * 0.85, r, 24), new THREE.MeshBasicMaterial({ color: 0xf3e8c8, transparent: true, opacity: 0.7, depthTest: false, side: THREE.DoubleSide })); P.ghost.rotation.x = -Math.PI / 2; P.ghost.renderOrder = 31; P.ghost.visible = false; G.scene.add(P.ghost);
    P.tableAt = { x: cx, z: cz }; P.sim = null; P.aim = null; P.idleBalls = P.rack(); P.setBalls(P.idleBalls);
  };
  P.world = (x, z, y = 0) => new G.V3(P.tableAt.x + x, H + r + y, P.tableAt.z + z);
  P.setBalls = (arr) => { if (!P.tableAt) return; arr.forEach(([id, x, z, on]) => { const m = P.meshes[id]; if (!m) return; m.visible = !!on; m.position.copy(P.world(x, z)); }); };
  P.clearScene = () => { P.meshes.forEach(m => m.parent && m.parent.remove(m)); P.meshes = []; [P.cueMesh, P.guide, P.ghost].forEach(o => o && o.parent && o.parent.remove(o)); P.tableAt = null; P.sim = null; P.aim = null; };
  const ba0 = G.World.buildArcade;
  G.World.buildArcade = function (o) { ba0.call(this, o); if (!o.spots) return; P.buildTable(this, o.spots.pool.x, o.spots.pool.z); this.interact.push({ id: 'pool', label: 'The Bone Table', x: P.tableAt.x, z: P.tableAt.z + 1.35, r: 2.0, desc: 'Eight-ball for 2 or 4' }); };
  const hideout0 = G.game.enterHideout.bind(G.game);
  G.game.enterHideout = async function () { P.clearScene(); return hideout0(); };
  const ns0 = G.game.netStart.bind(G.game);
  G.game.netStart = function (d) { const r0 = ns0(d); if (G.run.active) P.clearScene(); return r0; };

  /* ================= the game on the table ================= */
  const teamName = (st, tm) => st.pl.filter(p => p.team === tm).map(p => p.name).join(' & ') || (tm ? 'Team B' : 'Team A');
  GM.pool = {
    name: 'The Bone Table', icon: '🎱', min: 2, max: 4, npc: true, minBuy: 0, maxBuy: 500, defBuy: 20, step: 5, buyLabel: 'Stake per player', defOpts: { mode: '1v1' },
    rules: 'Eight-ball. Break, then sink a solid or a stripe to claim that group. Pot your own group, then the skull-marked 8 to win. Hitting the wrong ball first, missing everything or sinking the cue ball is a foul: the other side gets ball in hand. Sink the 8 early and you lose. Walk up to the table and press E when it is your shot.',
    opts: { mode: true },
    canOpen() { if (Object.values(TB.list).some(t => t.game === 'pool' && !t.closed)) { G.ui.toast('The Bone Table is taken. Join that game instead.'); return false; } return true; },
    maxSeats(t) { return t.opts.mode === '2v2' ? 4 : 2; }, minSeats(t) { return t.opts.mode === '2v2' ? 4 : 2; },
    optLabel(t) { return t.opts.mode === '2v2' ? '2 vs 2' : '1 vs 1'; },
    teamTag(t, i) { return `<span class="tm" style="background:${i % 2 ? '#2a2a5a' : '#5a2a1a'}">${i % 2 ? 'B' : 'A'}</span>`; },
    hostOpts(t) { return `<select id="poolMode"><option value="1v1" ${t.opts.mode !== '2v2' ? 'selected' : ''}>1 vs 1</option><option value="2v2" ${t.opts.mode === '2v2' ? 'selected' : ''}>2 vs 2</option></select>`; },
    bindHost(body, t) { const s = body.querySelector('#poolMode'); if (s) s.onchange = () => TB.act(t.tid, { t: 'opt', k: 'mode', v: s.value }); },
    formExtra(F) { return `<label>Teams <select id="poolFormMode"><option value="1v1" ${F.mode !== '2v2' ? 'selected' : ''}>1 vs 1</option><option value="2v2" ${F.mode === '2v2' ? 'selected' : ''}>2 vs 2</option></select></label>`; },
    bindForm(body, F) { const s = body.querySelector('#poolFormMode'); if (s) s.onchange = () => { F.mode = s.value; }; },
    formOpts(F) { return { mode: F.mode === '2v2' ? '2v2' : '1v1' }; },
    start(t) { const st = t.st; Object.assign(st, { pl: t.seats.map((s, i) => ({ id: s.id, name: s.name, npc: !!s.npc, team: i % 2 })), pot: t.buy * t.seats.length, balls: P.rack(), groups: [null, null], turn: 0, phase: 'aim', bih: true, kitchen: true, brk: true, shot: null, no: 0, msg: '', at: now() + 90000 }); TB.say(t, `${st.pl[0].name} breaks`); },
    myTurn(t, id) { const st = t.st; return st && st.phase === 'aim' && st.pl[st.turn] && st.pl[st.turn].id === id; },
    act(t, id, a) {
      const st = t.st, i = st.pl.findIndex(p => p.id === id);
      if (a.t !== 'shot' || st.phase !== 'aim' || i !== st.turn || (a.no | 0) !== st.no + 1) return false;
      const ang = +a.ang || 0, pow = G.clamp(+a.pow || 0, 0, 1); let cue = null;
      if (st.bih) { cue = Array.isArray(a.cue) ? [+a.cue[0] || 0, +a.cue[1] || 0] : null; if (!cue || !P.validSpot(st.balls, cue, st.kitchen)) cue = P.freeSpot(st.balls, st.kitchen); }
      st.pre = st.balls.map(b => b.slice()); if (cue) { const c = st.pre.find(b => b[0] === 0); c[1] = cue[0]; c[2] = cue[1]; c[3] = 1; }
      st.shot = { no: st.no + 1, ang, pow, by: id }; st.phase = 'rolling'; st.at = now() + 45000;
    },
    resolve(t, S) {
      const st = t.st; if (!st.shot || S.no !== st.shot.no) return false;
      const ev = S.ev, balls = P.simToArr(S), sh = st.pl[st.turn], tm = sh.team, ot = 1 - tm, grp = st.groups[tm], msg = [];
      const own = (id, g) => g === 'solid' ? isSolid(id) : g === 'stripe' ? isStripe(id) : false;
      const clearedBefore = !!grp && !st.pre.some(b => b[3] && own(b[0], grp));
      let foul = null;
      if (ev.cueIn) foul = 'the cue ball went down'; else if (ev.first === null) foul = 'nothing was hit';
      else if (grp) { if (!own(ev.first, grp) && !(ev.first === 8 && clearedBefore)) foul = 'wrong ball first'; } else if (ev.first === 8 && !st.brk) foul = 'the 8 was hit first';
      const pk = ev.pocketed.filter(id => id !== 0);
      st.no = S.no; st.shot = null; st.balls = balls; st.phase = 'aim'; st.at = now() + 90000;
      if (pk.includes(8)) {
        if (st.brk) { const e8 = st.balls.find(b => b[0] === 8); const sp = P.freeSpot(st.balls.filter(b => b[0] !== 8), false, [L / 4, 0]); e8[1] = sp[0]; e8[2] = sp[1]; e8[3] = 1; msg.push('The 8 drops on the break and is set back on its spot'); }
        else { const win = !foul && clearedBefore; st.phase = 'over'; st.win = win ? tm : ot; st.winner = teamName(st, st.win); const wp = st.pl.filter(p => p.team === st.win); wp.forEach(p => TB.pay(t, p.id, st.pot / wp.length, 'Pool')); TB.say(t, win ? `${sh.name} sinks the 8! ${st.winner} win${wp.length > 1 ? '' : 's'}.` : `${sh.name} sinks the 8 ${foul ? 'on a foul' : 'too early'}. ${st.winner} win${wp.length > 1 ? '' : 's'}.`); st.msg = `${st.winner} win${wp.length > 1 ? '' : 's'} the pot of ${st.pot}`; return; }
      }
      if (!grp && !foul && !st.brk) { const f = pk.find(id => id !== 8); if (f) { st.groups[tm] = isSolid(f) ? 'solid' : 'stripe'; st.groups[ot] = isSolid(f) ? 'stripe' : 'solid'; msg.push(`${teamName(st, tm)} take${st.pl.filter(p => p.team === tm).length > 1 ? '' : 's'} ${st.groups[tm]}s`); } }
      const g2 = st.groups[tm], ownPk = pk.filter(id => id !== 8 && (g2 ? own(id, g2) : true));
      const cont = !foul && (st.brk ? pk.length > 0 : ownPk.length > 0);
      if (pk.length) msg.push(`${sh.name} sinks ${pk.map(id => id === 8 ? 'the 8' : id).join(', ')}`);
      st.brk = false; st.kitchen = false; st.bih = !!foul;
      if (ev.cueIn) { const c = st.balls.find(b => b[0] === 0); c[3] = 0; }
      if (foul) msg.push(`Foul: ${foul}. Ball in hand.`);
      if (!cont) { let k = 0; do { st.turn = (st.turn + 1) % st.pl.length; } while (st.pl[st.turn].left && k++ < 5); msg.push(`${st.pl[st.turn].name} to shoot`); } else msg.push(`${sh.name} shoots again`);
      st.msg = msg.join(' · '); msg.forEach(m => TB.say(t, m));
    },
    next(t) {
      const st = t.st; if (st.phase === 'over') return null;
      if (st.phase === 'rolling') return { wait: st.at - now(), fn: t => { if (P.sim && P.sim.no === st.shot.no) { while (!P.sim.done) P.step(P.sim); return this.resolve(t, P.sim); } const S = P.newSim(st.pre, st.shot, st.shot.no); while (!S.done) P.step(S); return this.resolve(t, S); } };
      const p = st.pl[st.turn]; if (!p) return null;
      if (p.npc) return { wait: 1800 + R() * 1200, fn: t => { const s = P.npcShot(st); return this.act(t, p.id, Object.assign({ t: 'shot', no: st.no + 1 }, s)); } };
      return { wait: st.at - now(), fn: t => { TB.say(t, `${p.name} takes too long and taps the cue ball`); return this.act(t, p.id, { t: 'shot', no: st.no + 1, ang: R() * 6.28, pow: 0.1, cue: st.bih ? P.freeSpot(st.balls, st.kitchen) : null }); } };
    },
    leave(t, id) {
      const st = t.st, i = st.pl.findIndex(p => p.id === id); if (i < 0 || st.phase === 'over') return 0; const p = st.pl[i];
      if (!st.pl.some(q => q !== p && q.team === p.team && !q.left)) { st.phase = 'over'; st.win = 1 - p.team; st.winner = teamName(st, st.win); const wp = st.pl.filter(q => q.team === st.win); wp.forEach(q => TB.pay(t, q.id, st.pot / wp.length, 'Pool')); TB.say(t, `${p.name} walks away. ${st.winner} win${wp.length > 1 ? '' : 's'}.`); return 0; }
      p.left = true; TB.say(t, `${p.name} hands their cue to their partner`); if (st.turn === i && st.phase === 'aim') { let k = 0; do { st.turn = (st.turn + 1) % st.pl.length; } while ((st.pl[st.turn].left || st.pl[st.turn].team !== p.team) && k++ < 5); }
      return 0;
    },
    closeOut(t) { return t.st && t.st.phase !== 'over' ? t.buy : 0; },
    onClose() { if (P.tableAt) { P.sim = null; P.idleBalls = P.rack(); P.setBalls(P.idleBalls); } P.hud(); },
    view(t, id) {
      const st = t.st, left = g => st.balls.filter(b => b[3] && (g === 'solid' ? isSolid(b[0]) : isStripe(b[0]))).length;
      let h = `<div class="tgame"><div class="goldline">Pot: ${st.pot} gold${st.phase === 'over' ? ' · ' + esc(st.winner) + ' win' : ''}</div>`;
      [0, 1].forEach(tm => { const g = st.groups[tm]; h += `<div class="seat ${st.phase !== 'over' && st.pl[st.turn] && st.pl[st.turn].team === tm ? 'turn' : ''}"><span class="nm">${tm ? 'Team B' : 'Team A'}<small>${esc(teamName(st, tm))}</small></span><span>${g ? `${g === 'solid' ? 'Solids' : 'Stripes'} · ${left(g)} left` : 'Open table'}</span></div>`; });
      if (st.phase !== 'over') h += `<p class="note">${st.pl[st.turn].id === id ? (st.phase === 'aim' ? '<b>Your shot.</b> Walk up to the table and press E.' : 'Rolling…') : `${esc(st.pl[st.turn].name)} is ${st.phase === 'aim' ? 'lining up a shot' : 'watching the balls roll'}.`}${st.bih && st.phase === 'aim' ? ' Ball in hand.' : ''}</p>`;
      if (st.msg) h += `<p class="note">${esc(st.msg)}</p>`;
      return h + '</div>';
    },
    onState(t, seat) {
      const st = t.st; P.table = t.closed ? null : t; P.hud();
      if (!st || !P.tableAt || t.closed) return;
      // a new shot: everyone plays it out from the same start
      if (st.phase === 'rolling' && st.shot && (!P.sim || P.sim.no < st.shot.no)) { P.sim = P.newSim(st.pre, st.shot, st.shot.no); P.sim.by = st.shot.by; P.strokeFx(st.pre, st.shot); }
      // the result: snap to it once our own playback has finished
      if (st.phase !== 'rolling') { if (!P.sim || P.sim.done) { P.setBalls(st.balls); P.sim = null; } else P.pendingSnap = st.balls; }
      if (st.phase !== 'aim' || st.pl[st.turn].id !== G.net.myId()) P.endAim();
    }
  };
  const now = () => Date.now();
  P.validSpot = (balls, [x, z], kitchen) => { if (Math.abs(x) > L / 2 - r || Math.abs(z) > W / 2 - r) return false; if (kitchen && x > -L / 4) return false; return !balls.some(b => b[0] !== 0 && b[3] && (b[1] - x) ** 2 + (b[2] - z) ** 2 < (2 * r + 0.002) ** 2); };
  P.freeSpot = (balls, kitchen, pref) => { const p = pref || [-L / 4, 0]; if (P.validSpot(balls, p, kitchen)) return p.slice(); for (let k = 1; k < 200; k++) { const a = k * 2.4, d = k * 0.012, c = [p[0] + Math.cos(a) * d, p[1] + Math.sin(a) * d]; if (P.validSpot(balls, c, kitchen)) return c; } return [-L / 4, 0]; };

  /* ================= the regulars play too ================= */
  P.npcShot = (st) => {
    const tm = st.pl[st.turn].team, grp = st.groups[tm], on = st.balls.filter(b => b[3]);
    let cue = on.find(b => b[0] === 0), place = null;
    if (st.bih || !cue) { place = P.freeSpot(st.balls, st.kitchen, st.kitchen ? [-L / 4 - 0.1, (R() - 0.5) * 0.3] : null); cue = [0, place[0], place[1], 1]; }
    if (st.brk) return { ang: Math.atan2(0 - cue[2], L / 4 - cue[1]) + (R() - 0.5) * 0.01, pow: 0.95 + R() * 0.05, cue: place };
    const own = id => grp === 'solid' ? isSolid(id) : grp === 'stripe' ? isStripe(id) : id !== 8;
    let targets = on.filter(b => b[0] !== 0 && own(b[0])); if (!targets.length) targets = on.filter(b => b[0] === 8);
    const others = on.filter(b => b[0] !== 0);
    const clear = (ax, az, bx, bz, skip) => { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-9; return !others.some(o => { if (skip.includes(o[0])) return false; const t = G.clamp(((o[1] - ax) * dx + (o[2] - az) * dz) / l2, 0, 1), px = ax + dx * t - o[1], pz = az + dz * t - o[2]; return px * px + pz * pz < (2 * r) * (2 * r) * 0.98; }); };
    let best = null;
    targets.forEach(b => POCKETS.forEach(pk => {
      const tx = pk[0] - b[1], tz = pk[1] - b[2], td = Math.hypot(tx, tz), ux = tx / td, uz = tz / td, gx = b[1] - ux * 2 * r, gz = b[2] - uz * 2 * r;
      const ax = gx - cue[1], az = gz - cue[2], ad = Math.hypot(ax, az); if (ad < 1e-3) return; const cut = (ax * ux + az * uz) / ad; if (cut < 0.3) return;
      if (!clear(cue[1], cue[2], gx, gz, [b[0]]) || !clear(b[1], b[2], pk[0], pk[1], [b[0]])) return;
      const score = cut * cut / (0.4 + ad + td * 1.3); if (!best || score > best.score) best = { score, ang: Math.atan2(az, ax), d1: ad, d2: td, cut };
    }));
    if (!best) { const b = targets.sort((p, q) => Math.hypot(p[1] - cue[1], p[2] - cue[2]) - Math.hypot(q[1] - cue[1], q[2] - cue[2]))[0]; return { ang: Math.atan2(b[2] - cue[2], b[1] - cue[1]) + (R() - 0.5) * 0.05, pow: 0.35 + R() * 0.15, cue: place }; }
    const need = (1.1 + best.d2 * 1.6) / Math.max(0.35, best.cut) + best.d1 * 0.9, pow = G.clamp(Math.pow(Math.max(0, need - 0.4) / 6.4, 1 / 1.15), 0.12, 0.9);
    return { ang: best.ang + (R() + R() + R() - 1.5) * 0.012, pow, cue: place };
  };

  /* ================= playing a shot ================= */
  const myTurnHere = () => { const t = P.table; if (!t || !t.st || t.closed) return false; const st = t.st; return st.phase === 'aim' && st.pl[st.turn] && st.pl[st.turn].id === G.net.myId(); };
  P.enterAim = () => {
    const t = P.table, st = t.st, cue = st.balls.find(b => b[0] === 0);
    const place = st.bih || !cue || !cue[3], start = place ? P.freeSpot(st.balls, st.kitchen) : [cue[1], cue[2]];
    const tgt = st.brk ? [L / 4, 0] : [0, 0];
    P.aim = { place, placed: place, x: start[0], z: start[1], ang: Math.atan2(tgt[1] - start[1], tgt[0] - start[0]), pow: 0, charging: false, chargeT: 0, top: place, pitch: 0.42, shotSent: false, t: 0 };
    G.ui.toast(place ? 'Ball in hand: move the mouse to place the cue ball, click to set it' : 'Mouse to aim · hold left click for power · Space for the top view · right click to step back'); G.net.pushPresence(true);
  };
  P.endAim = () => { if (!P.aim) return; P.aim = null; if (P.cueMesh) P.cueMesh.visible = false; if (P.guide) P.guide.visible = false; if (P.ghost) P.ghost.visible = false; const hb = document.getElementById('poolPow'); if (hb) hb.hidden = true; };
  P.aimInput = (dt) => {
    const A = P.aim, t = P.table, st = t.st; A.t += dt; const sens = G.settings.sens || 1, fine = G.keys.ShiftLeft ? 0.25 : 1;
    if (G.pressed.Space) A.top = !A.top;
    if (A.place) {
      A.x = G.clamp(A.x + G.mouse.dx * 0.0016 * sens, -L / 2 + r, st.kitchen ? -L / 4 : L / 2 - r); A.z = G.clamp(A.z + G.mouse.dy * 0.0016 * sens, -W / 2 + r, W / 2 - r);
      if (G.mouse.lPressed) { if (P.validSpot(st.balls, [A.x, A.z], st.kitchen)) { A.place = false; A.top = false; G.sfx('click', 0.8); G.mouse.lPressed = false; } else G.ui.toast(st.kitchen ? 'Place it behind the line, clear of other balls' : 'Too close to another ball'); }
      return;
    }
    A.ang += G.mouse.dx * 0.0022 * sens * fine; A.pitch = G.clamp(A.pitch - G.mouse.dy * 0.002 * sens, 0.12, 1.2);
    if (G.mouse.l && !A.shotSent) { A.charging = true; A.chargeT += dt; A.pow = 0.5 - 0.5 * Math.cos(A.chargeT / 1.3 * Math.PI); }
    else if (A.charging && !A.shotSent) {
      A.charging = false; if (A.pow < 0.02) { A.chargeT = 0; return; }
      A.shotSent = true; A.strokeT = 0; G.sfx('swing', 0.4);
      const no = st.no + 1, shot = { t: 'shot', no, ang: A.ang + (R() - 0.5) * 0.02 * (T.amt ? T.amt() : 0), pow: A.pow, cue: st.bih || st.brk ? [A.x, A.z] : null };
      // play it out immediately here; the table host will play the same shot and settle the rules
      const pre = st.balls.map(b => b.slice()); if (shot.cue) { const c = pre.find(b => b[0] === 0); c[1] = shot.cue[0]; c[2] = shot.cue[1]; c[3] = 1; }
      setTimeout(() => { P.sim = P.newSim(pre, shot, no); P.sim.by = G.net.myId(); TB.act(t.tid, shot); P.endAim(); }, 120);
    }
  };
  // the cue, the guide line and the ghost ball
  P.drawAim = () => {
    const A = P.aim, st = P.table.st; if (!A) return;
    const cb0 = st.balls.find(b => b[0] === 0), bx = A.placed || !cb0 ? A.x : cb0[1], bz = A.placed || !cb0 ? A.z : cb0[2];
    if (A.place) { const m = P.meshes[0]; m.visible = true; m.position.copy(P.world(A.x, A.z)); P.cueMesh.visible = false; P.guide.visible = false; P.ghost.visible = false; return; }
    const dx = Math.cos(A.ang), dz = Math.sin(A.ang);
    let tMin = 1e9, hit = null;
    st.balls.forEach(b => { if (!b[3] || b[0] === 0) return; const ox = b[1] - bx, oz = b[2] - bz, pr = ox * dx + oz * dz, q = ox * ox + oz * oz - pr * pr; if (pr <= 0 || q > 4 * r * r) return; const tt = pr - Math.sqrt(4 * r * r - q); if (tt < tMin) { tMin = tt; hit = b; } });
    const rail = Math.min(dx > 0 ? (L / 2 - r - bx) / dx : dx < 0 ? (-L / 2 + r - bx) / dx : 1e9, dz > 0 ? (W / 2 - r - bz) / dz : dz < 0 ? (-W / 2 + r - bz) / dz : 1e9);
    if (rail < tMin) { tMin = rail; hit = null; }
    const gx = bx + dx * tMin, gz = bz + dz * tMin, pts = [P.world(bx, bz, 0.002), P.world(gx, gz, 0.002)];
    if (hit) { const ox = hit[1] - gx, oz = hit[2] - gz, ol = Math.hypot(ox, oz) || 1; pts.push(P.world(hit[1] + ox / ol * 0.35, hit[2] + oz / ol * 0.35, 0.002)); } else pts.push(pts[1].clone());
    P.guide.geometry.setFromPoints(pts); P.guide.visible = true; P.ghost.visible = true; P.ghost.position.copy(P.world(gx, gz, -r + 0.003));
    // the femur cue, drawn back with the power
    const pull = 0.04 + A.pow * 0.32 - (A.strokeT !== undefined ? Math.min(1, A.strokeT / 0.1) * (0.04 + A.pow * 0.32 + 0.01) : 0);
    const dir = new G.V3(dx, Math.sin(0.07), dz).normalize(), tip = P.world(bx - dx * (r + pull), bz - dz * (r + pull), 0.005);
    P.cueMesh.visible = true; P.cueMesh.quaternion.setFromUnitVectors(new G.V3(0, 1, 0), dir); P.cueMesh.position.copy(tip).addScaledVector(dir, -0.783);
    const pb = document.getElementById('poolPow') || (() => { const d = document.createElement('div'); d.id = 'poolPow'; d.innerHTML = '<i></i>'; document.getElementById('hud').appendChild(d); return d; })(); pb.hidden = false; pb.firstChild.style.width = Math.round(A.pow * 100) + '%';
  };
  P.camAim = () => {
    const A = P.aim, cam = G.camera, st = P.table.st; if (!A) return;
    if (A.top) { cam.position.set(P.tableAt.x, H + 3.0, P.tableAt.z + 0.01); cam.lookAt(P.tableAt.x, H, P.tableAt.z); return; }
    const cb = st.balls.find(b => b[0] === 0), bx = A.placed || !cb ? A.x : cb[1], bz = A.placed || !cb ? A.z : cb[2], dx = Math.cos(A.ang), dz = Math.sin(A.ang), dist = 0.5 + A.pitch * 0.9;
    const c = P.world(bx - dx * dist * Math.cos(A.pitch), bz - dz * dist * Math.cos(A.pitch), dist * Math.sin(A.pitch) + 0.05);
    cam.position.copy(c); cam.lookAt(P.world(bx + dx * 0.6, bz + dz * 0.6, -0.1));
  };
  // others see the cue strike
  P.strokeFx = (pre, shot) => {
    if (!P.cueMesh || shot.by === G.net.myId()) return; const cb = pre.find(b => b[0] === 0); if (!cb) return;
    const c = shot.cue || [cb[1], cb[2]], dx = Math.cos(shot.ang), dz = Math.sin(shot.ang), dir = new G.V3(dx, Math.sin(0.07), dz).normalize(); let k = 0;
    P.cueMesh.visible = true; P.cueMesh.quaternion.setFromUnitVectors(new G.V3(0, 1, 0), dir);
    const iv = setInterval(() => { k += 0.05; const back = k < 0.5 ? 0.05 + k * 0.4 : Math.max(0, 0.25 - (k - 0.5) * 2.5); const tip = P.world(c[0] - dx * (r + back), c[1] - dz * (r + back), 0.005); P.cueMesh.position.copy(tip).addScaledVector(dir, -0.783); if (k > 1.2) { clearInterval(iv); if (!P.aim) P.cueMesh.visible = false; } }, 30);
  };
  // per frame: play out any shot, roll the balls, drop the pocketed ones
  const q = new THREE.Quaternion(), ax = new G.V3();
  P.update = (dt) => {
    if (!P.tableAt) return; const S = P.sim;
    if (S && !S.done) {
      S.acc += Math.min(dt, 0.1); let n = 0;
      while (S.acc >= STEP && n < 60 && !S.done) { S.acc -= STEP; n++; P.step(S);
        for (const b of S.balls) { if (!b.on || (!b.vx && !b.vz)) continue; const s = Math.sqrt(b.vx * b.vx + b.vz * b.vz); ax.set(b.vz / s, 0, -b.vx / s); q.setFromAxisAngle(ax, s * STEP / r); const m = P.meshes[b.id]; m.quaternion.premultiply(q); } }
      if (S.click > 0.05) { G.sfx('clink', G.clamp(S.click / 3, 0.15, 1), P.world(0, 0)); S.click = 0; } if (S.thud > 0.2) { G.sfx('thunk', G.clamp(S.thud / 5, 0.1, 0.5), P.world(0, 0)); S.thud = 0; } if (S.sfxPocket) { G.sfx('thunk', 0.8, P.world(0, 0)); G.sfx('bonecollapse', 0.3, P.world(0, 0)); S.sfxPocket = 0; }
      S.balls.forEach(b => { const m = P.meshes[b.id]; if (b.on) { m.visible = true; m.position.copy(P.world(b.x, b.z)); } });
      if (S.done) { if (P.pendingSnap) { P.setBalls(P.pendingSnap); P.pendingSnap = null; } // the host settles the rules on its own playback
        const t = P.table; if (t && TB.host[t.tid] && t.st.phase === 'rolling') { const ht = TB.host[t.tid]; if (GM.pool.resolve(ht, S) !== false) TB.commit(ht); } }
    }
    if (S) S.balls.forEach(b => { if (!b.drop) return; const D = b.drop, m = P.meshes[b.id]; D.t += dt; const k = Math.min(1, D.t / 0.35); m.position.copy(P.world(G.lerp(D.x0, D.px, k), G.lerp(D.z0, D.pz, k), -k * 0.12)); m.visible = D.t < 0.6; if (D.t > 0.6) b.drop = null; });
    if (P.aim) P.drawAim();
  };

  /* ================= hooks: input, camera, prompt, HUD ================= */
  const mk0 = G.makePlayer;
  G.makePlayer = function (cls) {
    const Pl = mk0(cls), up0 = Pl.update, cam0 = Pl.updateCam, vm0 = Pl.animVM;
    Pl.update = (dt, t) => {
      if (!P.aim) return up0(dt, t);
      if (!myTurnHere() || Pl.dead || G.ui.modalOpen()) { P.endAim(); return up0(dt, t); }
      if (G.mouse.rPressed || G.pressed.KeyE || G.pressed.Escape) { P.endAim(); G.pressed.KeyE = false; return up0(dt, t); }
      P.aimInput(dt);
      const keep = { dx: G.mouse.dx, dy: G.mouse.dy, l: G.mouse.l, r: G.mouse.r, lp: G.mouse.lPressed, sp: G.pressed.Space }, px = Pl.pos.x, pz = Pl.pos.z;
      G.mouse.dx = G.mouse.dy = 0; G.mouse.l = G.mouse.r = G.mouse.lPressed = false; G.pressed.Space = false; G.pressed.KeyQ = G.pressed.KeyR = G.pressed.KeyF = G.pressed.KeyG = G.pressed.KeyV = false;
      up0(dt, t); Pl.pos.x = px; Pl.pos.z = pz; Pl.vel.set(0, 0, 0);
      G.mouse.dx = keep.dx; G.mouse.dy = keep.dy; G.mouse.l = keep.l; G.mouse.r = keep.r; G.mouse.lPressed = keep.lp; G.pressed.Space = keep.sp;
    };
    Pl.updateCam = (dt, t) => { cam0(dt, t); if (P.aim) { P.camAim(); const f = G.settings.fov; if (Math.abs(G.camera.fov - f) > 0.05) { G.camera.fov = f; G.camera.updateProjectionMatrix(); } } };
    Pl.animVM = (dt, t) => { vm0(dt, t); if (P.aim && Pl.V) Pl.V.root.visible = false; };
    return Pl;
  };
  const it0 = G.game.interactTarget.bind(G.game);
  G.game.interactTarget = function () {
    if (P.aim) return null;
    const best = it0(), Pl = G.player; if (!Pl || !P.tableAt || !myTurnHere()) return best;
    const d = Math.max(Math.abs(Pl.pos.x - P.tableAt.x) - L / 2, Math.abs(Pl.pos.z - P.tableAt.z) - W / 2);
    if (d < 1.6) return { k: 'poolshot', label: `Take your shot${P.table.st.bih ? ' · ball in hand' : ''}` };
    return best;
  };
  const hi0 = G.game.handleInteract.bind(G.game);
  G.game.handleInteract = function (dt) {
    if (P.aim) { G.ui.setPrompt(null); return; }
    const Tg = G.player && !G.ui.modalOpen() && G.state === 'play' ? this.interactTarget() : null;
    if (Tg && Tg.k === 'poolshot') { G.ui.setPrompt(`<span class="kbd">E</span>${esc(Tg.label)}`); if (G.pressed.KeyE) { G.pressed.KeyE = false; P.enterAim(); } return; }
    return hi0(dt);
  };
  const pk0 = G.game.updatePickups.bind(G.game);
  G.game.updatePickups = function (dt, t) { pk0(dt, t); if (G.World.theme === 'hideout') P.update(dt); };
  // a small scoreboard while you're at the table
  const css = document.createElement('style');
  css.textContent = `#poolHud{position:absolute;left:50%;top:70px;transform:translateX(-50%);background:rgba(20,12,6,.8);border:1px solid #6a5030;border-radius:4px;padding:6px 14px;font-size:13px;color:#e8d8b0;text-align:center;pointer-events:none;max-width:70vw}
#poolHud b{font-family:var(--head);color:#f3d998}#poolHud .on{color:#ffe08a}#poolPow{position:absolute;left:50%;bottom:140px;transform:translateX(-50%);width:260px;height:12px;border:1px solid #c8a040;background:rgba(0,0,0,.6);border-radius:6px;overflow:hidden;pointer-events:none}#poolPow i{display:block;height:100%;background:linear-gradient(90deg,#e8dcc0,#ffb040,#d02020)}`;
  document.head.appendChild(css);
  P.hud = () => {
    let el = document.getElementById('poolHud'); const t = P.table, me = G.net.myId();
    const show = t && t.st && t.st.pl && !t.closed && t.phase === 'play' && t.st.pl.some(p => p.id === me) && G.World.theme === 'hideout';
    if (!show) { if (el) el.hidden = true; return; }
    if (!el) { el = document.createElement('div'); el.id = 'poolHud'; document.getElementById('hud').appendChild(el); }
    const st = t.st, left = g => st.balls.filter(b => b[3] && (g === 'solid' ? isSolid(b[0]) : isStripe(b[0]))).length, cur = st.pl[st.turn];
    el.hidden = false;
    el.innerHTML = `${[0, 1].map(tm => `<span class="${cur && cur.team === tm && st.phase !== 'over' ? 'on' : ''}"><b>${esc(teamName(st, tm))}</b> ${st.groups[tm] ? (st.groups[tm] === 'solid' ? 'Solids' : 'Stripes') + ' ' + left(st.groups[tm]) : 'open'}</span>`).join(' · ')}<br>${st.phase === 'over' ? esc(st.msg) : cur.id === me ? (st.phase === 'aim' ? 'Your shot' + (st.bih ? ' · ball in hand' : '') : 'Rolling…') : esc(cur.name) + "'s shot"}`;
  };
})();
