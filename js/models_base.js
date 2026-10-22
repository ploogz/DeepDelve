/* ============================================================
   Model kit: cached high-segment geometry, rigs, animation, weapons
   ============================================================ */
'use strict';
const M = G.M = {};
M.Q = () => G.settings.quality === 'low' ? 0.55 : G.settings.quality === 'med' ? 0.8 : G.settings.quality === 'ultra' ? 1.75 : 1.3;
const GC = {};
const gk = (k, f) => GC[k] || (GC[k] = f());
const seg = n => Math.max(3, Math.round(n * M.Q()));
M.sph = (r, w = 28, h = 20, ps = 0, pl = Math.PI * 2, ts = 0, tl = Math.PI) => gk(`s${r},${w},${h},${ps},${pl},${ts},${tl}`, () => new THREE.SphereGeometry(r, seg(w), seg(h), ps, pl, ts, tl));
M.cyl = (rt, rb, h, s = 22, hs = 1, open = false) => gk(`c${rt},${rb},${h},${s},${hs},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg(s), hs, open));
M.box = (w, h, d, sx = 1, sy = 1, sz = 1) => gk(`b${w},${h},${d},${sx},${sy},${sz}`, () => new THREE.BoxGeometry(w, h, d, sx, sy, sz));
M.cap = (r, l, cs = 8, rs = 18) => gk(`p${r},${l},${cs},${rs}`, () => new THREE.CapsuleGeometry(r, l, seg(cs), seg(rs)));
M.tor = (r, t, rs = 12, ts = 32, arc = Math.PI * 2) => gk(`t${r},${t},${rs},${ts},${arc}`, () => new THREE.TorusGeometry(r, t, seg(rs), seg(ts), arc));
M.cone = (r, h, s = 20, hs = 1, open = false) => gk(`k${r},${h},${s},${hs},${open}`, () => new THREE.ConeGeometry(r, h, seg(s), hs, open));
M.ico = (r, d = 1) => gk(`i${r},${d}`, () => new THREE.IcosahedronGeometry(r, d));
M.oct = (r, d = 0) => gk(`o${r},${d}`, () => new THREE.OctahedronGeometry(r, d));
M.dod = (r, d = 0) => gk(`d${r},${d}`, () => new THREE.DodecahedronGeometry(r, d));
M.lathe = (pts, s = 28) => gk('l' + pts.join(',') + s, () => { const v = []; for (let i = 0; i < pts.length; i += 2) v.push(new THREE.Vector2(pts[i], pts[i + 1])); if (v[0].y > v[v.length - 1].y) v.reverse(); const g = new THREE.LatheGeometry(v, seg(s)); g.computeVertexNormals(); return g; });
M.tube = (pts, r, s = 28, rs = 10, taper = 0) => gk('u' + pts.join(',') + r + s + rs + taper, () => {
  const v = []; for (let i = 0; i < pts.length; i += 3) v.push(new THREE.Vector3(pts[i], pts[i + 1], pts[i + 2]));
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(v), seg(s), r, seg(rs), false);
  if (taper) { // taper radius toward end
    const pos = g.attributes.position, path = new THREE.CatmullRomCurve3(v), rings = seg(s) + 1, per = seg(rs) + 1;
    for (let i = 0; i < rings; i++) { const c = path.getPointAt(i / (rings - 1)), k = 1 - (i / (rings - 1)) * taper; for (let j = 0; j < per; j++) { const idx = i * per + j; const x = pos.getX(idx), y = pos.getY(idx), z = pos.getZ(idx); pos.setXYZ(idx, c.x + (x - c.x) * k, c.y + (y - c.y) * k, c.z + (z - c.z) * k); } }
    g.computeVertexNormals();
  }
  return g;
});
M.ext = (key, shapeFn, depth, bevel = 0.01, bs = 3) => gk('e' + key + depth + bevel, () => {
  const s = new THREE.Shape(); shapeFn(s);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: bs, curveSegments: seg(16) });
  g.translate(0, 0, -depth / 2); g.computeVertexNormals(); return g;
});
// noisy rock geometry (unique per call, so no cache)
M.rockGeo = (r, detail = 2, amp = 0.25, rnd = Math.random) => {
  const g = new THREE.IcosahedronGeometry(r, detail), p = g.attributes.position, map = {};
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!(k in map)) map[k] = 1 + (rnd() - 0.5) * amp * 2;
    const f = map[k]; p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f);
  }
  g.computeVertexNormals(); return g;
};

// sculpted body from cross-section rings: [y, halfWidth, halfDepth, zOffset, squareness] bottom -> top.
// rings are resampled with Catmull-Rom so silhouettes flow, and each section is a superellipse
// (squareness 2 = round, higher = boxier), giving chests, waists and hips instead of tubes.
M.sculpt = (key, rings, rs = 32, steps = 5, caps = 3) => gk('sc' + key + M.Q(), () => {
  const n = rings.length, cr = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  const R = [];
  const dv = j => j === 5 ? 0 : 2;   // ring: [y, halfWidth, halfDepth, zOffset, squareness, xOffset]
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < steps; k++) { const t = k / steps, r = []; for (let j = 0; j < 6; j++) r.push(cr((rings[i - 1] || rings[i])[j] ?? dv(j), rings[i][j] ?? dv(j), rings[i + 1][j] ?? dv(j), (rings[i + 2] || rings[i + 1])[j] ?? dv(j), t)); R.push(r); }
  { const l = rings[n - 1]; R.push([0, 1, 2, 3, 4, 5].map(j => l[j] ?? dv(j))); }
  const segs = seg(rs), pos = [], uv = [], idx = [];
  // uvs in metres (0.5 m per tile) so textures keep one density across every sculpted piece
  const per = Math.max(...R.map(r => Math.PI * (r[1] + r[2]))), TL = 0.5;
  R.forEach((r, j) => { const [y, w, d, zo, sq, xo] = r, e = 2 / Math.max(1.2, sq || 2); for (let k = 0; k <= segs; k++) { const th = k / segs * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th); pos.push(Math.sign(sn) * Math.pow(Math.abs(sn), e) * Math.max(0, w) + (xo || 0), y, Math.sign(c) * Math.pow(Math.abs(c), e) * Math.max(0, d) + (zo || 0)); uv.push(k / segs * Math.max(1, Math.round(per / TL)), (r[0] - R[0][0]) / TL); } });
  for (let j = 0; j < R.length - 1; j++) for (let k = 0; k < segs; k++) { const a = j * (segs + 1) + k, b = a + segs + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  // caps
  const capV = (j, up) => { const base = pos.length / 3, r = R[j]; pos.push(r[5] || 0, r[1] > 0.001 ? r[0] + (up ? 0.004 : -0.004) : r[0], r[3] || 0); uv.push(0.5, up ? 1 : 0); for (let k = 0; k < segs; k++) { const a = j * (segs + 1) + k; if (up) idx.push(a + 1, base, a); else idx.push(a, base, a + 1); } };
  if (caps & 1) capV(0, false); if (caps & 2) capV(R.length - 1, true);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
});
// cloth: a sculpt with vertical folds that deepen toward the hem (folds = count, amp = depth), open by default
M.drape = (key, rings, folds = 9, amp = 0.05, caps = 0, rs = 40) => gk('dr' + key + M.Q(), () => {
  const g = M.sculpt('drsrc' + key, rings, rs, 5, caps).clone(), p = g.attributes.position;
  const y0 = rings[rings.length - 1][0], y1 = rings[0][0];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), th = Math.atan2(x, z), k = Math.pow(G.clamp((y0 - y) / (y0 - y1), 0, 1), 1.4);
    const f = 1 + (Math.sin(th * folds + Math.sin(th * 3) * 0.8) * 0.75 + Math.sin(th * folds * 2.3 + 1.7) * 0.25) * amp * k;
    p.setXYZ(i, x * f, y + Math.sin(th * folds * 0.5 + 0.6) * amp * 0.25 * k, z * f);
  }
  g.computeVertexNormals(); g.userData.per = seg(rs) + 1; return g;
});
// a trim strip that follows a drape's folded hem exactly (bottom rows of the drape, pushed outward)
M.drapeHem = (key, rows = 2, push = 0.006) => gk('dh' + key + M.Q() + rows, () => {
  const src = GC['dr' + key + M.Q()], p = src.attributes.position, per = src.userData.per, pos = [], idx = [];
  for (let j = 0; j <= rows; j++) for (let k = 0; k < per; k++) { const i = j * per + k, x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z) || 1; pos.push(x * (1 + push / r), p.getY(i), z * (1 + push / r)); }
  for (let j = 0; j < rows; j++) for (let k = 0; k < per - 1; k++) { const a = j * per + k, b = a + per; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
});
// taper an extruded blade/plate toward its cutting edges: z scale by 1 - edge * (|x - spine| / halfWidth)
M.extTaper = (key, shapeFn, depth, bevel, hw, edge = 0.8, spine = 0, axis = 'x') => gk('et' + key + depth + bevel + hw + edge, () => {
  const g = M.ext('src' + key, shapeFn, depth, bevel, 2).clone(), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const d = Math.abs((axis === 'x' ? p.getX(i) : p.getY(i)) - spine) / hw; p.setZ(i, p.getZ(i) * (1 - edge * G.clamp(d, 0, 1))); }
  g.computeVertexNormals(); return g;
});
// bend a flat piece around the vertical axis (shield faces, armour plates)
M.bend = (key, geo, k) => gk('bd' + key + k, () => { const g = geo.clone(), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, p.getZ(i) - x * x * k); } g.computeVertexNormals(); return g; });
M.P = (parent, geo, mat, p = [0, 0, 0], r = 0, s = 1) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(p[0], p[1], p[2]);
  if (r) m.rotation.set(r[0], r[1], r[2]);
  if (typeof s === 'number') m.scale.setScalar(s); else m.scale.set(s[0], s[1], s[2]);
  parent.add(m); return m;
};
M.G = (parent, p = [0, 0, 0], r = 0) => { const g = new THREE.Group(); g.position.set(p[0], p[1], p[2]); if (r) g.rotation.set(r[0], r[1], r[2]); if (parent) parent.add(g); return g; };
M.mirror = (fn) => { fn(1); fn(-1); };

/* ---------- humanoid rig ---------- */
/* ---------- sculpted humanoid rig ---------- */
// smooth profile helper: knots [[r, y], ...] bottom->top, resampled with smoothstep blending
M.profile = (knots, steps = 4) => {
  const out = [];
  for (let i = 0; i < knots.length - 1; i++) { const a = knots[i], b = knots[i + 1]; for (let s = 0; s < steps; s++) { const t = s / steps, k = G.smooth(t); out.push(G.lerp(a[0], b[0], k), G.lerp(a[1], b[1], t)); } }
  const l = knots[knots.length - 1]; out.push(l[0], l[1]); return out.map(v => Math.round(v * 10000) / 10000);
};
// tapered limb with a muscle swell, hanging from y=0 down to y=-len, rounded ends
M.limb = (len, r0, rm, r1, mPos = 0.35) => M.lathe(M.profile([[0, -len - r1 * 0.75], [r1 * 0.75, -len - r1 * 0.45], [r1, -len], [rm * 0.96, -len * (1 - mPos) - len * 0.2], [rm, -len * mPos], [r0, -r0 * 0.3], [r0 * 0.7, r0 * 0.55], [0, r0 * 0.85]], 3), 20);
/* ---------- sculpted limbs ----------
   rows run from the joint (t = 0) to the far end (t = 1): [t, halfWidth, halfDepth, zOffset (+front), xOffset (+lateral)]
   so calves bulge behind the shin, quads in front of the thigh, biceps and triceps on the upper arm, and the
   forearm flattens into the wrist. Ends are rounded so joints stay closed when they bend. */
M.LIMBS = {
  thigh: { len: 0.43, rows: [[0, 0.095, 0.098, 0, 0], [0.12, 0.097, 0.1, 0.006, 0.002], [0.3, 0.092, 0.097, 0.012, 0], [0.55, 0.08, 0.085, 0.01, -0.004], [0.78, 0.066, 0.068, 0.006, -0.006], [0.92, 0.057, 0.058, 0.003, -0.003], [1, 0.054, 0.056, 0, 0]] },
  shin: { len: 0.36, rows: [[0, 0.056, 0.056, 0, 0], [0.1, 0.058, 0.062, -0.006, 0], [0.22, 0.061, 0.071, -0.016, -0.004], [0.36, 0.058, 0.068, -0.016, -0.007], [0.52, 0.05, 0.055, -0.01, -0.004], [0.7, 0.043, 0.045, -0.004, 0], [0.88, 0.039, 0.04, 0, 0], [1, 0.038, 0.039, 0, 0]] },
  upper: { len: 0.29, rows: [[0, 0.06, 0.058, 0, 0], [0.15, 0.062, 0.061, 0.002, 0.002], [0.4, 0.061, 0.064, 0.006, 0], [0.62, 0.055, 0.057, 0.004, 0], [0.85, 0.047, 0.045, 0, 0], [1, 0.044, 0.043, 0, 0]] },
  fore: { len: 0.27, rows: [[0, 0.05, 0.046, 0, 0], [0.13, 0.058, 0.05, -0.002, 0.004], [0.3, 0.055, 0.046, 0, 0.002], [0.6, 0.045, 0.036, 0, 0], [0.88, 0.036, 0.027, 0, 0], [1, 0.034, 0.026, 0, 0]] },
  // first-person arms are longer and chunkier (they are seen from inside the elbow)
  vmFore: { len: 0.46, rows: [[0, 0.062, 0.056, 0, 0], [0.14, 0.069, 0.06, -0.003, 0.006], [0.34, 0.065, 0.054, 0, 0.003], [0.64, 0.054, 0.043, 0, 0], [0.9, 0.045, 0.034, 0, 0], [1, 0.043, 0.033, 0, 0]] },
  vmUpper: { len: 0.55, rows: [[0, 0.064, 0.062, 0, 0], [0.2, 0.073, 0.072, 0.008, 0], [0.45, 0.078, 0.078, 0.006, 0], [0.75, 0.076, 0.072, 0, 0], [1, 0.074, 0.07, 0, 0]] }
};
// radius profile of a limb at t, offset outward by `off` (for sleeves, bracers and greaves that hug the limb)
M.limbRings = (name, side, off = 0, t0 = 0, t1 = 1, ends = true, sq = 2.15) => {
  const L = typeof name === 'string' ? M.LIMBS[name] : name, rows = L.rows, at = t => { let i = 0; while (i < rows.length - 2 && rows[i + 1][0] < t) i++; const a = rows[i], b = rows[i + 1], k = G.smooth(G.clamp((t - a[0]) / (b[0] - a[0]), 0, 1)); return a.map((v, j) => v + (b[j] - v) * k); };
  const out = [], N = 10;
  for (let i = 0; i <= N; i++) { const t = t0 + (t1 - t0) * i / N, r = at(t); out.push([-t * L.len, r[1] + off, r[2] + off, r[3], sq, r[4] * side]); }
  if (ends) { const lo = out[out.length - 1], hi = out[0], rr = Math.min(lo[1], lo[2]), rh = Math.min(hi[1], hi[2]);
    out.push([lo[0] - rr * 0.45, lo[1] * 0.8, lo[2] * 0.8, lo[3], 2, lo[5]], [lo[0] - rr * 0.8, lo[1] * 0.38, lo[2] * 0.38, lo[3], 2, lo[5]]);
    out.unshift([hi[0] + rh * 0.8, hi[1] * 0.38, hi[2] * 0.38, hi[3], 2, hi[5]], [hi[0] + rh * 0.45, hi[1] * 0.8, hi[2] * 0.8, hi[3], 2, hi[5]]); }
  return out.reverse();   // bottom -> top
};
M.limbS = (name, side = 1) => M.sculpt('limb' + name + side, M.limbRings(name, side), 26, 3, 3);
// a sleeve, bracer or greave that wraps a limb from t0 to t1, standing `off` proud of the skin, with lipped ends
M.limbWrap = (name, side, t0, t1, off, key = '') => gk('lw' + name + side + t0 + t1 + off + key + M.Q(), () => {
  const rings = M.limbRings(name, side, off, t0, t1, false), lo = rings[0], hi = rings[rings.length - 1], lip = off * 0.85;
  rings.unshift([lo[0] - 0.004, lo[1] - lip, lo[2] - lip, lo[3], lo[4], lo[5]]); rings.push([hi[0] + 0.004, hi[1] - lip, hi[2] - lip, hi[3], hi[4], hi[5]]);
  return M.sculpt('lwsrc' + name + side + t0 + t1 + off + key, rings, 26, 2, 0);
});
// cloth version: soft folds that bunch toward the far end (sleeves and trouser legs)
M.limbCloth = (name, side, folds = 7, amp = 0.006) => gk('lc' + name + side + folds + amp + M.Q(), () => {
  const g = M.limbS(name, side).clone(), p = g.attributes.position, len = M.LIMBS[name].len;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), th = Math.atan2(x, z), k = G.clamp(-y / len, 0, 1);
    const w = (Math.sin(th * folds + y * 40) * 0.6 + Math.sin(th * folds * 1.7 - y * 70 + 1.3) * 0.4) * amp * (0.35 + k * 0.9) * (k > 0.02 && k < 0.98 ? 1 : 0), r = Math.hypot(x, z) || 1;
    p.setXYZ(i, x + x / r * w, y, z + z / r * w); }
  g.computeVertexNormals(); return g;
});
M.headGeo = () => gk('sculptHead2' + M.Q(), () => {
  const g = new THREE.SphereGeometry(0.13, seg(48), seg(40)), p = g.attributes.position;
  const bump = (x, y, cx, cy, rx, ry) => { const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; return d < 1 ? (1 - d) * (1 - d) : 0; };
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const ny = y / 0.13;
    x *= 0.86; z *= 1.06;
    if (ny < 0.1) { const k = G.clamp((0.1 - ny) / 1.1, 0, 1); x *= 1 - k * 0.36; z *= 1 - k * 0.12; if (z > 0) z += k * 0.02; }   // jaw taper & chin
    if (z > 0.04) {
      const ax = Math.abs(x);
      if (ny > 0.15 && ny < 0.45 && z > 0.07) z += (1 - Math.abs(ny - 0.3) / 0.15) * 0.008;                                   // brow ridge
      z -= bump(ax, y, 0.042, 0.017, 0.036, 0.026) * 0.019;                                                                    // eye sockets
      z += bump(ax, y, 0.062, -0.012, 0.03, 0.022) * 0.007; x += Math.sign(x) * bump(ax, y, 0.07, -0.01, 0.03, 0.025) * 0.004;   // cheekbones
      z -= bump(ax, y, 0.04, -0.05, 0.022, 0.03) * 0.004;                                                                      // hollow under the cheekbone
      z += bump(ax, y, 0.0, -0.052, 0.035, 0.022) * 0.005;                                                                     // muzzle over the teeth
      z += bump(ax, y, 0.0, -0.092, 0.024, 0.018) * 0.008;                                                                     // chin
      if (ny > -0.2 && ny < 0.15 && ax > 0.065) z -= 0.004;                                                                     // cheek planes
    }
    if (Math.abs(x) > 0.085 && ny > 0.1 && ny < 0.6 && z > -0.02) x *= 0.975;                                                 // temples
    if (ny > 0.55) y *= 0.97;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals(); return g;
});
M.face = (head, skin, o = {}) => {
  const eyeW = G.mat('col', { c: 0xf2efe6, r: 0.08 }), iris = G.mat('col', { c: o.eye || 0x2a4a6a, r: 0.06, e: o.eyeGlow, ei: 3 }), pupil = G.mat('col', { c: o.eyeGlow ? 0x200000 : 0x050505, r: 0.05 }), lip = G.mat('col', { c: o.lip || (skin.color ? skin.color.clone().multiplyScalar(0.78).lerp(new THREE.Color(0x9a3a32), 0.4).getHex() : 0x9a5048), r: 0.45 }), dark = G.mat('col', { c: 0x2a1410, r: 0.8 }), browM = G.mat('col', { c: o.brow || 0x3a2a1a, r: 0.95 });
  M.P(head, M.headGeo(), skin, [0, 0.1, 0]);
  M.mirror(s => {
    // eyeball, iris disc, pupil; lids hug the ball and a lash line darkens the upper lid
    M.P(head, M.sph(0.0205, 18, 14), eyeW, [s * 0.042, 0.117, 0.1]);
    M.P(head, M.sph(0.0108, 16, 10), iris, [s * 0.042, 0.117, 0.1175], 0, [1, 1, 0.42]);
    M.P(head, M.sph(0.005, 10, 8), pupil, [s * 0.042, 0.117, 0.1215], 0, [1, 1, 0.4]);
    M.P(head, M.sph(0.0232, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.3), skin, [s * 0.042, 0.1185, 0.1], [0.42, 0, 0]);                       // upper lid
    M.P(head, M.sph(0.0228, 18, 8, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.38), skin, [s * 0.042, 0.1165, 0.1], [-0.35, 0, 0]);         // lower lid
    M.P(head, M.tor(0.0222, 0.0016, 4, 16, Math.PI * 0.8), dark, [s * 0.042, 0.1205, 0.1072], [-0.2, 0, Math.PI * 0.1], [1.04, 0.62, 1]);   // lash line
    // brows follow the ridge: thick at the inner end, thinning outward
    M.P(head, M.tube([s * 0.015, 0.142, 0.13, s * 0.032, 0.15, 0.129, s * 0.052, 0.151, 0.123, s * 0.07, 0.144, 0.11], 0.0062, 14, 6, 0.55), browM, [0, o.browY || 0, 0]);
    if (!o.noEars) {
      M.P(head, M.tor(0.022, 0.0075, 8, 18, Math.PI * 1.55), skin, [s * 0.112, 0.108, -0.006], [0, s * 1.35, Math.PI * 0.62], [0.8, 1.25, 1]);   // helix
      M.P(head, M.sph(0.018, 12, 10), skin, [s * 0.108, 0.106, -0.006], 0, [0.4, 1.05, 0.8]);                                               // concha
      M.P(head, M.sph(0.009, 10, 8), skin, [s * 0.111, 0.08, -0.002], 0, [0.6, 1, 0.8]);                                                   // lobe
      M.P(head, M.sph(0.007, 8, 6), dark, [s * 0.103, 0.104, -0.002], 0, [0.4, 1, 0.8]);                                                   // ear canal
    }
    M.P(head, M.sph(0.0095, 10, 8), skin, [s * 0.0125, 0.075, 0.132], 0, [1.15, 0.85, 1]);                                                // nostril wings
    M.P(head, M.sph(0.0034, 6, 5), dark, [s * 0.0075, 0.0695, 0.1395], 0, [1.2, 0.7, 1]);                                                 // nostrils
    M.P(head, M.tube([s * 0.016, 0.071, 0.133, s * 0.026, 0.056, 0.126, s * 0.028, 0.046, 0.12], 0.0028, 8, 5, 0.5), skin);                // smile line
    M.P(head, M.cap(0.0024, 0.012, 2, 5), skin, [s * 0.0035, 0.062, 0.1385], [0.25, 0, 0]);                                               // philtrum ridges
  });
  // nose: bridge from the brow to a rounded tip
  M.P(head, M.tube([0, 0.137, 0.134, 0, 0.116, 0.139, 0, 0.096, 0.146, 0, 0.083, 0.151], 0.0085, 14, 8, 0.15), skin);
  M.P(head, M.sph(0.0128, 14, 10), skin, [0, 0.0805, 0.146], 0, [1.12, 0.92, 1]);
  // lips: a cupid's bow over a fuller lower lip, with a dark seam between
  M.P(head, M.tube([-0.023, 0.051, 0.124, -0.01, 0.0535, 0.1315, -0.003, 0.0525, 0.1335, 0, 0.0535, 0.1335, 0.003, 0.0525, 0.1335, 0.01, 0.0535, 0.1315, 0.023, 0.051, 0.124], 0.0048, 20, 8), lip);
  M.P(head, M.tube([-0.019, 0.045, 0.124, -0.008, 0.0405, 0.1305, 0, 0.0398, 0.132, 0.008, 0.0405, 0.1305, 0.019, 0.045, 0.124], 0.0062, 18, 8), lip);
  M.P(head, M.tube([-0.022, 0.0485, 0.124, 0, 0.0475, 0.1318, 0.022, 0.0485, 0.124], 0.0016, 14, 4), dark);
  M.P(head, M.sph(0.02, 14, 10), skin, [0, 0.014, 0.114], 0, [1.25, 0.8, 0.62]);                                                         // chin pad
  if (o.hair) M.P(head, M.sph(0.135, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2.1), G.mat('col', { c: o.hair, r: 0.9, t: 'hide' }), [0, 0.118, -0.012], 0, [0.92, 0.95, 1.08]);
};
M.handGeo = (s, b, hand, grip) => { // fingers curl around a grip by default
  const H = new THREE.Group();
  M.P(H, M.sculpt('palm2', [[-0.074, 0.03, 0.014, 0.006, 2.4], [-0.07, 0.036, 0.016, 0.006, 2.6], [-0.058, 0.04, 0.02, 0.004, 3], [-0.03, 0.038, 0.022, 0.002, 2.8], [-0.004, 0.031, 0.02, 0, 2.3], [0.004, 0.024, 0.016, 0, 2.1]], 20, 3), hand, [0, 0.005, 0.004], 0, [b, b, b]);
  for (let i = 0; i < 4; i++) {
    const f = M.G(H, [s * (-0.026 + i * 0.0175) * b, -0.066 * b, 0.01], [grip ? -1.05 : -0.2, 0, s * (i - 1.5) * -0.04]);
    const l = (i === 1 ? 0.03 : i === 2 ? 0.028 : i === 0 ? 0.026 : 0.022) * b, r = (i === 3 ? 0.0078 : 0.0088) * b;
    M.P(f, M.cap(r, l, 3, 8), hand, [0, -l / 2, 0]);
    const f2 = M.G(f, [0, -l, 0], [grip ? -1.15 : -0.25, 0, 0]); M.P(f2, M.cap(r * 0.94, l * 0.62, 3, 8), hand, [0, -l * 0.31, 0]);
    const f3 = M.G(f2, [0, -l * 0.62, 0], [grip ? -0.7 : -0.2, 0, 0]); M.P(f3, M.cap(r * 0.86, l * 0.42, 3, 8), hand, [0, -l * 0.2, 0]);
  }
  // knuckles and the tendons fanning over the back of the hand
  for (let i = 0; i < 4; i++) { const x = s * (-0.026 + i * 0.0175) * b; M.P(H, M.sph(0.0098 * b, 10, 8), hand, [x, -0.064 * b, -0.004], 0, [1, 0.85, 0.8]); M.P(H, M.cap(0.0035 * b, 0.034 * b, 2, 6), hand, [x * 0.8, -0.04 * b, -0.011], [0.08, 0, s * (i - 1.5) * 0.06], [1, 1, 0.7]); }
  const th = M.G(H, [s * -0.034 * b, -0.024 * b, 0.022], [-0.6, 0, s * 0.75]); M.P(th, M.cap(0.0115 * b, 0.026 * b, 3, 8), hand, [0, -0.016 * b, 0]);
  const th2 = M.G(th, [0, -0.034 * b, 0], [-0.5, 0, 0]); M.P(th2, M.cap(0.0105 * b, 0.02 * b, 3, 8), hand, [0, -0.012 * b, 0]);
  return H;
};
M.bootGeo = () => gk('boot', () => {
  const s = new THREE.Shape(); s.moveTo(-0.05, 0.06); s.lineTo(-0.058, -0.02); s.quadraticCurveTo(-0.06, -0.05, -0.04, -0.055); s.lineTo(0.11, -0.055); s.quadraticCurveTo(0.15, -0.05, 0.145, -0.02); s.quadraticCurveTo(0.12, 0.02, 0.05, 0.035); s.lineTo(0.045, 0.06); s.lineTo(-0.05, 0.06);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.085, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 10 });
  g.translate(0, 0, -0.0425); g.rotateY(-Math.PI / 2); g.computeVertexNormals(); return g;
});

M.humanoid = (o = {}) => {
  const b = o.bulk || 1, R = { kind: 'hum', root: new THREE.Group() };
  const skin = o.skin || G.mat('skin'), top = o.top || skin, bot = o.bottom || G.mat('col', { c: 0x4a3a2a, t: 'cloth' }), boot = o.boots || G.mat('darkleather'), hand = o.hands || skin;
  R.body = M.G(R.root);
  R.hips = M.G(R.body, [0, 0.95, 0]);
  // sculpted trunk: superellipse cross-sections give a real waist, rib cage, glutes and trapezius slope
  R.pelvis = M.P(R.hips, M.sculpt('pelvis', [[-0.155, 0.07, 0.06, -0.005, 2], [-0.12, 0.135, 0.1, -0.012, 2.3], [-0.06, 0.168, 0.118, -0.016, 2.6], [0.0, 0.172, 0.118, -0.01, 2.7], [0.06, 0.164, 0.11, -0.004, 2.6], [0.11, 0.156, 0.104, 0, 2.5]], 32), bot, [0, 0, 0], 0, [b, 1, b * 0.96]);
  R.torso = M.G(R.hips, [0, 0.08, 0]);
  // one continuous trunk from waist to collar (chest only breathes a few mm, so it rides on the torso)
  R.belly = R.chestM = M.P(R.torso, M.sculpt('trunk', [[-0.06, 0.16, 0.106, 0, 2.5], [0.02, 0.15, 0.102, 0.004, 2.4], [0.1, 0.146, 0.1, 0.006, 2.35], [0.19, 0.162, 0.108, 0.006, 2.45], [0.25, 0.182, 0.12, 0.008, 2.6], [0.3, 0.196, 0.128, 0.01, 2.75], [0.37, 0.212, 0.132, 0.012, 2.9], [0.43, 0.212, 0.118, 0.0, 2.9], [0.475, 0.168, 0.092, -0.01, 2.6], [0.508, 0.085, 0.066, -0.006, 2.2], [0.525, 0.04, 0.04, 0, 2]], 36, 4), top, [0, 0, 0], 0, [b, 1, b * 0.96]);
  R.chest = M.G(R.torso, [0, 0.28, 0]);
  M.mirror(s => {
    M.P(R.chest, M.sph(0.07, 18, 12), top, [s * 0.125 * b, 0.188, -0.012], [0, 0, s * -0.42], [1.35, 0.5, 0.85]);     // trapezius slope
  });
  R.neck = M.G(R.chest, [0, 0.2, 0]);
  M.P(R.neck, M.sculpt('neck', [[-0.04, 0.068, 0.06, -0.004, 2], [0.02, 0.054, 0.052, 0, 2], [0.07, 0.05, 0.05, 0.004, 2], [0.1, 0.052, 0.054, 0.006, 2]], 18), o.headSkin || skin, [0, 0, 0.005], 0, [b * 0.95 + 0.05, 1, b * 0.95 + 0.05]);
  R.head = M.G(R.neck, [0, 0.08, 0]);
  if (!o.noHead) M.face(R.head, o.headSkin || skin, o);
  R.head.scale.setScalar(0.95);
  const shX = 0.19 + 0.05 * b, hb = 1.12 * Math.sqrt(b); R.shX = shX; R.b = b;
  const arm = (s) => {
    const A = {};
    A.sh = M.G(R.chest, [s * shX, 0.135, 0], [0, 0, s * 0.08]);
    M.P(A.sh, M.sph(0.062 * b, 22, 16), top, [s * 0.01, -0.035, 0.004], [0, 0, s * 0.12], [1.04, 1.4, 1.1]); // deltoid cap, tapering into the arm
    const slv = o.sleeve || top, isCloth = m => m && m.userData && m.userData.kind === 'cloth';
    A.up = M.P(A.sh, isCloth(slv) ? M.limbCloth('upper', s, 6, 0.004) : M.limbS('upper', s), slv, [0, -0.02, 0], 0, [b, 1, b * 0.96]);
    M.P(A.sh, M.sph(0.042 * b, 14, 10), o.sleeve || top, [0, -0.15, -0.026 * b], 0, [1, 1.7, 0.85]);                // triceps
    A.el = M.G(A.sh, [0, -0.31, 0]);
    M.P(A.el, M.sph(0.043 * b, 14, 10), o.forearm || skin, [0, 0, -0.004]);                                              // elbow joint
    A.fore = M.P(A.el, M.limbS('fore', s), o.forearm || skin, [0, 0, 0], 0, [b, 1, b]);
    A.hand = M.G(A.el, [0, -0.29, 0]);
    A.hand.add(M.handGeo(s, hb, hand, true));
    return A;
  };
  R.armL = arm(1); R.armR = arm(-1);
  const leg = (s) => {
    const L = {};
    L.hip = M.G(R.hips, [s * 0.098 * b, -0.04, 0]);
    L.up = M.P(L.hip, M.limbS('thigh', s), bot, [0, 0, 0], 0, [b, 1, b]);   // quads in front, hamstrings behind, inner teardrop above the knee
    L.kn = M.G(L.hip, [0, -0.44, 0]);
    M.P(L.kn, M.sph(0.056 * b, 16, 12), o.shin || bot, [0, 0, 0.008]);                                                  // knee joint
    L.low = M.P(L.kn, M.limbS('shin', s), o.shin || bot, [0, 0, -0.002], 0, [b, 1, b]);   // flat shin in front, calf bulging behind (the inner head sits lower)
    L.foot = M.G(L.kn, [0, -0.43, 0]);
    M.P(L.foot, M.limb(0.13, 0.054 * b, 0.06 * b, 0.064 * b, 0.6), boot, [0, 0.14, -0.005]);   // boot shaft
    M.P(L.foot, M.tor(0.058 * b, 0.009, 8, 24), boot, [0, 0.14, -0.005], [Math.PI / 2, 0, 0]);   // boot cuff
    M.P(L.foot, M.bootGeo(), boot, [0, 0.005, 0], 0, [b * 0.95, 1, 1]);
    // sole, heel block, laces over the instep, a seam round the toe cap
    { const sole = G.mat('col', { c: 0x1c1610, r: 0.9, t: 'leather' }), lace = G.mat('col', { c: 0x2a1c12, r: 0.9 });
      M.P(L.foot, M.bootGeo(), sole, [0, -0.041, -0.003], 0, [b * 0.95 * 1.06, 0.2, 1.035]);
      M.P(L.foot, M.box(0.075 * b, 0.026, 0.06), sole, [0, -0.047, -0.03]);
      for (let k = 0; k < 3; k++) { const z = 0.018 + k * 0.026, y = 0.06 - k * 0.012; M.mirror(q => M.P(L.foot, M.cap(0.0032, 0.05 * b, 2, 5), lace, [0, y, z], [0.5, 0, q * 1.05 + Math.PI / 2])); }
      M.P(L.foot, M.tor(0.05 * b, 0.0035, 4, 18, Math.PI), sole, [0, -0.018, 0.085], [Math.PI / 2, 0, 0], [0.92, 1.05, 1]); }
    return L;
  };
  R.legL = leg(1); R.legR = leg(-1);
  R.height = 1.85;
  return R;
};

/* shared animation for humanoid rigs. st: {t, move, phase, atk, atkKind, block, cast, hurt, crouch, float} */
M.animHum = (R, st) => {
  M.preRig(R);
  const t = st.t, mv = G.clamp(st.move || 0, 0, 1.5), ph = st.phase || 0, cr = st.crouch || 0;
  const L = R.legL, Rg = R.legR, A = R.armL, B = R.armR, run = G.clamp(mv - 0.8, 0, 0.7);
  const idle = 1 - G.clamp(mv * 3, 0, 1);
  const breath = Math.sin(t * 2.1) * 0.022, shift = Math.sin(t * 0.55) * 0.03 * idle, glance = (Math.sin(t * 0.37) * 0.22 + Math.sin(t * 0.91) * 0.08) * idle;
  const s = Math.sin(ph), c = Math.cos(ph);
  // pelvis: double-frequency bob, side-to-side weight transfer, counter-twist against the shoulders
  R.body.position.set(Math.sin(ph) * 0.025 * mv + shift, 0, 0);
  R.hips.position.y = 0.95 - cr * 0.18 - (1 - Math.abs(c)) * 0.035 * mv - run * 0.04 + Math.abs(c) * 0.02 * mv;
  R.hips.rotation.set(0, -s * 0.14 * mv, Math.sin(ph) * 0.05 * mv + shift * 0.6);
  R.torso.rotation.set(cr * 0.35 + mv * 0.07 + run * 0.12, s * 0.18 * mv, -shift * 0.4);
  R.chest.rotation.set(breath, 0, 0);
  R.neck.rotation.set(-cr * 0.3 - mv * 0.05, -s * 0.12 * mv + glance, 0); R.head.rotation.set(Math.sin(t * 0.73) * 0.04 * idle, 0, 0);
  if (st.float) { L.hip.rotation.set(0.3, 0, 0.05); Rg.hip.rotation.set(0.2, 0, -0.05); L.kn.rotation.set(0.5, 0, 0); Rg.kn.rotation.set(0.6, 0, 0); L.foot.rotation.set(0.4, 0, 0); Rg.foot.rotation.set(0.5, 0, 0); }
  else {
    // turning on the spot shuffles the feet (st.turn) instead of sliding the whole body round
    const mvL = Math.max(mv, st.turn || 0), amp = (0.5 + run * 0.35) * mvL;
    // leg: swing, knee folds during the swing phase, stays soft at contact; foot rolls heel -> toe
    const leg = (Lg, p, side) => {
      const sp = Math.sin(p), cp = Math.cos(p);
      Lg.hip.rotation.set(-sp * amp - cr * 0.6 + idle * (side > 0 ? shift : -shift) * 2, 0, side * (0.02 + idle * 0.03));
      const swingPhase = Math.max(0, -Math.sin(p - 0.6));
      Lg.kn.rotation.set(0.08 * mvL + swingPhase * (1.0 + run * 0.6) * mvL + cr * 1.0 + Math.max(0, cp) * 0.12 * mvL, 0, 0);
      Lg.foot.rotation.set(-cr * 0.4 + (sp > 0 ? -0.25 * sp : 0.35 * -sp * Math.max(0, cp)) * mvL, 0, 0);
    };
    leg(L, ph, 1); leg(Rg, ph + Math.PI, -1);
  }
  // arms swing opposite the legs, elbows bend more when running
  const armAmp = (0.55 + run * 0.5) * mv;
  A.sh.rotation.set(s * armAmp + breath * 0.5, 0, 0.1 + idle * 0.03 + Math.abs(s) * 0.04 * mv);
  B.sh.rotation.set(-s * armAmp + breath * 0.5, 0, -0.1 - idle * 0.03 - Math.abs(s) * 0.04 * mv);
  A.el.rotation.set(-0.22 - mv * 0.3 - run * 0.6 - Math.max(0, -s) * 0.3 * mv, 0, 0); B.el.rotation.set(-0.22 - mv * 0.3 - run * 0.6 - Math.max(0, s) * 0.3 * mv, 0, 0);
  if (R.armPose) R.armPose(R, st);
  R.body.rotation.set(0, 0, 0);
  if (st.emote && G.emotes) G.emotes.pose(R, st);
  if (st.block && !st.emote) { A.sh.rotation.set(-1.3, 0.5, 0.25); A.el.rotation.set(-1.1, 0, 0); B.sh.rotation.set(-1.0, -0.3, -0.2); B.el.rotation.set(-0.9, 0, 0); R.torso.rotation.x += 0.12; R.hips.position.y -= 0.05; L.kn.rotation.x += 0.2; Rg.kn.rotation.x += 0.2; }
  const p = st.emote ? -1 : st.atk;
  let twist = 0;
  if (p >= 0 && p <= 1) {
    const k = st.atkKind || 'slash', e = (a, b) => G.smooth(G.clamp((p - a) / (b - a), 0, 1));
    // anticipation -> strike (fast, eased in) -> follow-through overshoot -> settle
    const strike = (a, b) => { const x = G.clamp((p - a) / (b - a), 0, 1); return x * x * (2.2 - 1.2 * x); };
    const lunge = (w0, s0, s1) => { const k2 = e(s0, s1) * (1 - e(0.72, 1)); R.body.position.z = k2 * 0.16 - e(0, w0) * (1 - e(s0, s1)) * 0.05; R.hips.position.y -= k2 * 0.06; L.kn.rotation.x += k2 * 0.35; Rg.hip.rotation.x += k2 * 0.25; };
    if (k === 'slash') {
      const w = e(0, 0.38), s2 = strike(0.38, 0.6), r = e(0.7, 1), ft = Math.sin(G.clamp((p - 0.55) / 0.25, 0, 1) * Math.PI) * 0.15;
      B.sh.rotation.set(G.lerp(G.lerp(0, -2.5, w), -0.75, s2) * (1 - r), G.lerp(0, -1.0, s2) * (1 - r) - ft, G.lerp(G.lerp(-0.1, -0.95, w), 0.45, s2) * (1 - r) - 0.1 * r);
      B.el.rotation.set(G.lerp(G.lerp(-0.25, -1.25, w), -0.12, s2) * (1 - r) - 0.25 * r, 0, 0);
      R.torso.rotation.y = G.lerp(G.lerp(0, 0.55, w), -0.7 - ft, s2) * (1 - r); R.hips.rotation.y += G.lerp(G.lerp(0, 0.25, w), -0.3, s2) * (1 - r);
      R.neck.rotation.y -= R.torso.rotation.y * 0.6; lunge(0.38, 0.38, 0.6);
    } else if (k === 'overhead' || k === 'slam') {
      const w = e(0, 0.45), s2 = strike(0.45, 0.62), r = e(0.75, 1);
      const sx = G.lerp(G.lerp(0, -2.95, w), -0.35, s2) * (1 - r);
      A.sh.rotation.set(sx, 0, 0.12); B.sh.rotation.set(sx, 0, -0.12); A.el.rotation.set(G.lerp(-0.9, -0.15, s2) * (1 - r) - 0.2 * r, 0, 0); B.el.rotation.set(G.lerp(-0.9, -0.15, s2) * (1 - r) - 0.2 * r, 0, 0);
      R.torso.rotation.x = G.lerp(G.lerp(0, -0.3, w), 0.55, s2) * (1 - r); R.neck.rotation.x += -R.torso.rotation.x * 0.5;
      lunge(0.45, 0.45, 0.62); twist = 1;
    } else if (k === 'thrust') {
      const w = e(0, 0.35), s2 = strike(0.35, 0.52), r = e(0.7, 1);
      B.sh.rotation.set(G.lerp(G.lerp(0, -0.4, w), -1.55, s2) * (1 - r), G.lerp(0, 0.15, s2), -0.1); B.el.rotation.set(G.lerp(G.lerp(-0.25, -1.9, w), 0, s2) * (1 - r) - 0.25 * r, 0, 0);
      R.torso.rotation.y = G.lerp(G.lerp(0, 0.45, w), -0.35, s2) * (1 - r); R.neck.rotation.y -= R.torso.rotation.y * 0.6; lunge(0.35, 0.35, 0.52);
    } else if (k === 'claw') {
      const w = e(0, 0.35), s2 = strike(0.35, 0.58), r = e(0.75, 1);
      A.sh.rotation.set(G.lerp(G.lerp(0, -2.2, w), -0.4, s2) * (1 - r), 0, G.lerp(0.2, 0.9, w) * (1 - s2));
      B.sh.rotation.set(G.lerp(G.lerp(0, -2.2, w), -0.4, s2) * (1 - r), 0, -G.lerp(0.2, 0.9, w) * (1 - s2));
      R.torso.rotation.x = G.lerp(-0.1 * w, 0.45, s2) * (1 - r); lunge(0.35, 0.35, 0.58);
    } else if (k === 'cast') {
      const w = e(0, 0.5), r = e(0.75, 1), pulse = Math.sin(G.clamp((p - 0.4) / 0.3, 0, 1) * Math.PI);
      A.sh.rotation.set(-1.4 * w * (1 - r), -0.2, 0.2); B.sh.rotation.set(-1.6 * w * (1 - r) - pulse * 0.2, 0.2, -0.2);
      A.el.rotation.set(-0.3 + pulse * 0.2, 0, 0); B.el.rotation.set(-0.2 + pulse * 0.2, 0, 0); R.torso.rotation.x = (-0.18 * w + pulse * 0.12) * (1 - r);
    } else if (k === 'shoot') {
      M.shootPose(R, st, p);
    } else if (k === 'bite' || k === 'roar') {
      const w = e(0, 0.4), r = e(0.7, 1);
      R.neck.rotation.x = (k === 'roar' ? -0.5 : 0.4) * w * (1 - r); R.torso.rotation.x = (k === 'roar' ? -0.25 : 0.3) * w * (1 - r);
      A.sh.rotation.set(-0.8 * w * (1 - r), 0, 0.6 * w); B.sh.rotation.set(-0.8 * w * (1 - r), 0, -0.6 * w);
    }
  }
  if (st.atkKind === 'shoot' && st.draw !== undefined && !(p >= 0 && p <= 1)) M.shootPose(R, st, -1);
  // axes chop edge-first: the head turns to face the direction of the swing
  if (R.weaponTwist) R.weaponTwist.rotation.y = twist * Math.PI / 2;   // eased by the smoothing layer
  if (st.hurt > 0) { R.torso.rotation.x -= st.hurt * 0.4; R.neck.rotation.x -= st.hurt * 0.35; R.neck.rotation.z += st.hurt * 0.2; A.sh.rotation.x -= st.hurt * 0.3; B.sh.rotation.x -= st.hurt * 0.3; }
  if (R.jaw) R.jaw.rotation.x = 0.1 + (st.atk >= 0 ? 0.4 : 0) + Math.sin(t * 3) * 0.05;
  if (R.extraAnim) R.extraAnim(R, st);
  if (R.cls && G.anim) G.anim.tp(R, st);
  if (R.cls && R.cls !== 'archer') M.wristLimit(R);
  { const rt = M.smoothRate(st); if (rt) M.smoothRig(R, st, rt); }
  if (R.bow) M.updateBow(R, st);
};
// a wrist can't fold a blade back toward its own elbow: whatever the swing asks for, the weapon leaves the fist
// on the thumb side (at most a little past square to the forearm), so nothing ever looks held upside down
M.wristLimit = (() => {
  const a = new THREE.Vector3(), d = new THREE.Vector3(), h = new THREE.Vector3(), e = new THREE.Vector3(), ax = new THREE.Vector3(), q = new THREE.Quaternion(), qw = new THREE.Quaternion(), qp = new THREE.Quaternion();
  const LIM = -0.12;
  const fix = (R, A, w) => {
    if (!w || !A || !A.hand) return;
    const tip = w.userData.tip || 0.6; w.localToWorld(a.set(0, 0, 0)); w.localToWorld(d.set(0, tip, 0)).sub(a).normalize();
    A.hand.getWorldPosition(h); A.el.getWorldPosition(e); const F = h.sub(e).normalize(), dot = d.dot(F);
    if (dot >= LIM) return;
    ax.copy(F).cross(d); if (ax.lengthSq() < 1e-8) ax.set(1, 0, 0).applyQuaternion(A.hand.getWorldQuaternion(qw)); ax.normalize();
    const ang = Math.acos(G.clamp(LIM, -1, 1)) - Math.acos(G.clamp(dot, -1, 1));   // negative: swing the blade back toward the thumb side
    q.setFromAxisAngle(ax, ang); A.hand.getWorldQuaternion(qw); qw.premultiply(q);
    A.hand.parent.getWorldQuaternion(qp); A.hand.quaternion.copy(qp.invert().multiply(qw)); A.hand.updateMatrixWorld(true);
  };
  return R => { if (R.twoHand) return; R.root.updateMatrixWorld(true); fix(R, R.armR, R.weapon); if (R.weapon2) fix(R, R.armL, R.weapon2); };
})();

/* ---------- pose smoothing ----------
   Every animator writes a target pose from scratch each frame. This layer eases the rig toward that target
   with a frame-rate independent exponential blend, so state changes (block, hurt, attack start/end, landing,
   float, crouch) flow instead of snapping. Fast strikes use a stiffer blend so they keep their snap. */
M.smoothRig = (R, st, rate) => {
  const t = st.t || 0, dt = R._lt === undefined ? -1 : t - R._lt; R._lt = t;
  if (!R._sm) { const n = []; R.root.traverse(o => { if (!o.isMesh && o !== R.root && !o.userData.noSmooth) n.push(o); }); R._sm = n.map(o => ({ o, q: o.quaternion.clone(), p: o.position.clone() })); return; }
  if (dt <= 0 || dt > 0.25) { for (const j of R._sm) { j.q.copy(j.o.quaternion); j.p.copy(j.o.position); j.te = null; } R._pre = false; return; }   // first frame, paused or teleported: snap
  const k = 1 - Math.exp(-dt * rate);
  for (const j of R._sm) { (j.te || (j.te = new THREE.Euler())).copy(j.o.rotation); (j.tp || (j.tp = new G.V3())).copy(j.o.position); j.q.slerp(j.o.quaternion, k); j.p.lerp(j.o.position, k); j.o.quaternion.copy(j.q); j.o.position.copy(j.p); }
  R._pre = true;
};
// animators sometimes write a single Euler channel (rotation.y = ...) and rely on the others; hand them back the
// exact target Eulers from last frame so the smoothed quaternion's re-derived Euler never leaks into the pose
M.preRig = R => { if (!R._pre) return; R._pre = false; for (const j of R._sm) if (j.te) { j.o.rotation.copy(j.te); j.o.position.copy(j.tp); } };
M.smoothRate = st => st.noSmooth ? 0 : st.atk >= 0 && st.atk <= 1 ? 30 : st.draw > 0 ? 26 : 16;
/* archery: raise -> nock -> draw to cheek -> hold -> release snap -> recover */
M.SHOOT = { L: [-1.45, 0.62, 0.05], Lel: -0.05, R0: [-1.5, -0.55, 0], Rel0: -0.25, R1: [-1.25, 0.2, -1.05], Rel1: -2.35, torso: -0.62, neck: 0.55, chest: 0.12 };
M.shootPose = (R, st, p) => {
  const S = M.SHOOT, A = R.armL, B = R.armR;
  let draw, up, after = 0;
  if (p < 0 || st.draw !== undefined && !(p >= 0)) { draw = st.draw || 0; after = st.after || 0; up = draw > 0 || after > 0 ? 1 : 0; if (after > 0.55) up = 1 - G.smooth((after - 0.55) / 0.45); }
  else {
    const rel = st.relAt || 0.62;
    up = G.smooth(G.clamp(p / 0.18, 0, 1));
    draw = p < rel ? G.smooth(G.clamp((p - 0.12) / (rel * 0.75 - 0.12), 0, 1)) : 0;
    after = p >= rel ? (p - rel) / (1 - rel) : 0;
    if (after > 0.55) up = 1 - G.smooth((after - 0.55) / 0.45);
  }
  const L = (a, b, k) => a + (b - a) * k, lerp3 = (o, a, b, k) => o.set(L(a[0], b[0], k), L(a[1], b[1], k), L(a[2], b[2], k));
  const rest = [o0(A.sh.rotation), o0(B.sh.rotation)];
  function o0(r) { return [r.x, r.y, r.z]; }
  lerp3(A.sh.rotation, rest[0], S.L, up); A.el.rotation.x = L(A.el.rotation.x, S.Lel, up);
  // draw hand: from string at the bow to the cheek; after release it flicks back and opens
  const rk = after > 0 ? Math.max(0, 1 - after * 3) : draw;
  const tgt = [L(S.R0[0], S.R1[0], rk), L(S.R0[1], S.R1[1], rk), L(S.R0[2], S.R1[2], rk)];
  if (after > 0 && after < 0.35) { tgt[1] += 0.25 * Math.sin(after / 0.35 * Math.PI); tgt[2] -= 0.2 * Math.sin(after / 0.35 * Math.PI); }
  lerp3(B.sh.rotation, rest[1], tgt, up); B.el.rotation.x = L(B.el.rotation.x, L(S.Rel0, S.Rel1, rk), up);
  R.torso.rotation.y = S.torso * up; R.neck.rotation.y = S.neck * up; R.chest.rotation.x = -S.chest * draw * up;
  R._draw = up > 0.5 ? draw : 0; R._after = after; R._bowUp = up;
};
// roll the bow hand about the forearm so the limbs stand as upright as the arm allows (a wrist can roll, not kink)
M.bowUpright = (() => { const F = new G.V3(), T = new G.V3(), U = new G.V3(), q = new THREE.Quaternion(), c = new G.V3();
  return (hand, thumbLocal, k = 1, up = new G.V3(0, 1, 0), axis = new G.V3(0, 1, 0)) => {
    hand.updateMatrixWorld(true); hand.getWorldQuaternion(q); F.copy(axis).applyQuaternion(q).normalize(); T.copy(thumbLocal).applyQuaternion(q);
    U.copy(up).addScaledVector(F, -up.dot(F)); if (U.lengthSq() < 0.02) return; U.normalize(); T.addScaledVector(F, -T.dot(F)).normalize();
    const ang = Math.atan2(c.copy(T).cross(U).dot(F), T.dot(U)); hand.rotateOnAxis(axis, ang * k); hand.updateMatrixWorld(true); }; })();
M.fanArrows = (bow, list, n, nock, spread = 0.085) => {
  const m = Math.max(0, n - 1);
  while (list.length < m) { const a = M.weapon.arrow(0); a.userData.noSmooth = true; a.traverse(o => o.userData.noSmooth = true); bow.add(a); list.push(a); }
  const d = new G.V3(), ax = new G.V3(0, 1, 0);
  const bx = new G.V3(1, 0, 0);
  list.forEach((a, i) => { a.visible = i < m; if (!a.visible) return; const j = i + 1, off = (j % 2 ? 1 : -1) * Math.ceil(j / 2) * spread; d.set(0, 0, -0.05).sub(nock).normalize().applyAxisAngle(ax, off).applyAxisAngle(bx, (j % 3 - 1) * 0.025); a.quaternion.setFromUnitVectors(new G.V3(0, 0, 1), d); a.position.copy(nock).addScaledVector(d, 0.33); });
};
M.updateBow = (R, st) => {
  const bow = R.bow, d = R._draw || 0;
  // at rest and while raising, keep the bow upright in the fist
  M.bowUpright(R.armL.hand, new G.V3(-1, 0, 0), 1 - (R._bowUp || 0));
  if (!R.nockArrow) { R.nockArrow = M.weapon.arrow(0); R.nockArrow.rotation.y = Math.PI; R.nockArrow.userData.noSmooth = true; R.nockArrow.traverse(o => o.userData.noSmooth = true); bow.add(R.nockArrow); if (R._sm) R._sm = R._sm.filter(j => !j.o.userData.noSmooth); }
  R.updateMatrixWorld && 0; R.root.updateMatrixWorld(true);
  let nock = bow.userData.rest.clone();
  if (d > 0.02) { const h = new G.V3(0, -0.05, 0.02); R.armR.hand.localToWorld(h); bow.worldToLocal(h); nock = new G.V3(G.clamp(h.x, -0.3, 0.3), G.clamp(h.y, -0.12, 0.12), Math.max(0.085, Math.min(0.78, h.z))); }
  else if (R._after > 0 && R._after < 0.25) { const k = R._after / 0.25; nock.z = 0.085 - Math.sin(k * Math.PI * 3) * 0.04 * (1 - k); }   // string vibrates after release
  bow.userData.setNock(nock);
  const showArrow = (R._bowUp || 0) > 0.3 && !(R._after > 0);
  R.nockArrow.visible = showArrow; if (showArrow) M.aimArrow(R.nockArrow, nock);
  M.fanArrows(bow, R.fan || (R.fan = []), showArrow ? (st.multi | 0) : 0, nock);
};
// lay an arrow from the nock point across the bow's grip
M.aimArrow = (arrow, nock) => { const d = new G.V3(0, 0, -0.05).sub(nock).normalize(); arrow.quaternion.setFromUnitVectors(new G.V3(0, 0, 1), d); arrow.position.copy(nock).addScaledVector(d, 0.33); };

/* ---------- weapon tiers ---------- */
M.tierMat = (tier, cls) => {
  return [G.mat('iron'), G.mat('steel'), G.mat('col', { c: 0xb4c6e2, m: 1, r: 0.16, e: 0x1a3a7a, ei: 0.22 }),
  G.mat('col', { c: 0x30333c, m: 0.9, r: 0.25, e: 0x00d8ff, ei: 0.35 }),
  G.mat('col', { c: 0xffd27a, m: 1, r: 0.18, e: 0xff7a00, ei: 0.45 })][G.clamp(tier, 0, 4)];
};
M.runeMat = tier => G.mat('emissive', { c: [0x000000, 0x000000, 0x4a9bff, 0x00e5ff, 0xffa020][G.clamp(tier, 0, 4)], i: 3 });
M.gripMat = () => G.mat('col', { c: 0x3b2414, r: 0.9, t: 'leather' });

M.weapon = {
  sword(tier = 0, len = 0.85) {
    const g = new THREE.Group(), bm = M.tierMat(tier), fit = tier >= 4 ? G.mat('gold') : G.mat('dark');
    // lenticular blade with a distal taper and a sharp point
    const blade = M.sculpt('blade' + len, [[0, 0.033, 0.0088, 0, 1.45], [len * 0.08, 0.034, 0.009, 0, 1.45], [len * 0.5, 0.031, 0.0085, 0, 1.45], [len * 0.8, 0.026, 0.0075, 0, 1.45], [len * 0.93, 0.014, 0.005, 0, 1.45], [len, 0.0012, 0.001, 0, 1.45]], 12, 4);
    M.P(g, blade, bm, [0, 0.12, 0]);
    M.P(g, M.box(0.009, len * 0.62, 0.0186), G.mat('dark'), [0, 0.12 + len * 0.36, 0]); // fuller
    if (tier >= 2) M.P(g, M.box(0.007, len * 0.5, 0.0192), M.runeMat(tier), [0, 0.12 + len * 0.34, 0]);
    // cross-guard with forward-curving quillons and a central langet
    M.P(g, M.tube([-0.13, 0.035, 0.01, -0.08, 0.004, 0, 0, -0.006, 0, 0.08, 0.004, 0, 0.13, 0.035, 0.01], 0.014, 24, 10, 0), fit, [0, 0.12, 0]);
    M.mirror(s => M.P(g, M.sph(0.02, 14, 10), fit, [s * 0.132, 0.157, 0.01]));
    M.P(g, M.box(0.046, 0.04, 0.03), fit, [0, 0.122, 0]);
    M.P(g, M.cyl(0.017, 0.019, 0.16, 16), M.gripMat(), [0, 0.03, 0]);
    for (let i = 0; i < 6; i++) M.P(g, M.tor(0.019, 0.0035, 6, 16), G.mat('darkleather'), [0, -0.04 + i * 0.026, 0], [Math.PI / 2, 0, 0]);
    // wheel pommel
    M.P(g, M.cyl(0.034, 0.034, 0.024, 24), tier >= 3 ? M.runeMat(tier) : fit, [0, -0.07, 0], [Math.PI / 2, 0, 0]);
    M.P(g, M.cyl(0.02, 0.02, 0.03, 16), fit, [0, -0.07, 0], [Math.PI / 2, 0, 0]);
    M.P(g, M.sph(0.012, 10, 8), fit, [0, -0.104, 0]);
    g.userData.tip = len + 0.12; return g;
  },
  axe(tier = 0, big = true) {
    const g = new THREE.Group(), bm = M.tierMat(tier), L = big ? 1.15 : 0.6, hs = big ? 1 : 0.72;
    M.P(g, M.tube([0, -0.12, 0, 0.008, L * 0.35, 0, -0.004, L * 0.7, 0, 0, L - 0.08, 0], 0.025, 24, 12, 0.08), G.mat('wood'));
    for (let i = 0; i < 6; i++) M.P(g, M.tor(0.028, 0.0045, 6, 16), G.mat('darkleather'), [0, -0.05 + i * 0.032, 0], [Math.PI / 2, 0, 0]);
    // bearded bit, thick at the eye and thin at the edge, with a bright honed edge
    const head = M.extTaper('axebit', s => { s.moveTo(0, -0.06); s.lineTo(0.06, -0.045); s.quadraticCurveTo(0.13, -0.08, 0.205, -0.17); s.quadraticCurveTo(0.27, -0.01, 0.205, 0.15); s.quadraticCurveTo(0.13, 0.075, 0.06, 0.045); s.lineTo(0, 0.06); s.lineTo(0, -0.06); }, 0.034, 0.004, 0.24, 0.82);
    const edge = M.tube([0.203, -0.165, 0, 0.235, -0.09, 0, 0.247, -0.01, 0, 0.234, 0.08, 0, 0.203, 0.145, 0], 0.0035, 24, 5);
    const bits = big ? [1, -1] : [1];
    bits.forEach(s => { const h = M.G(g, [s * 0.026, L - 0.2, 0], [0, s > 0 ? 0 : Math.PI, 0]); h.scale.set(hs, hs, 1); M.P(h, head, bm); M.P(h, edge, G.mat('steel')); if (tier >= 2) M.P(h, M.box(0.12, 0.01, 0.034), M.runeMat(tier), [0.12, 0, 0]); });
    if (!big) M.P(g, M.cone(0.02, 0.08, 8), bm, [-0.05, L - 0.2, 0], [0, 0, Math.PI / 2]);   // back spike on hand axes
    M.P(g, M.cyl(0.04, 0.04, 0.15, 8), G.mat('dark'), [0, L - 0.2, 0]);
    M.mirror(s => M.P(g, M.box(0.012, 0.16, 0.02), G.mat('dark'), [0, L - 0.33, s * 0.024]));   // langets
    M.P(g, M.cone(0.026, 0.12, 12), bm, [0, L - 0.065, 0]);
    M.P(g, M.cyl(0.032, 0.028, 0.04, 12), G.mat('dark'), [0, -0.13, 0]);
    g.userData.tip = L; return g;
  },
  dagger(tier = 0) {
    const g = new THREE.Group(), bm = M.tierMat(tier);
    const blade = M.extTaper('dagger', s => { s.moveTo(-0.025, 0); s.quadraticCurveTo(-0.03, 0.18, 0.01, 0.34); s.quadraticCurveTo(0.03, 0.2, 0.025, 0); s.lineTo(-0.025, 0); }, 0.012, 0.002, 0.03, 0.78);
    M.P(g, blade, bm, [0, 0.07, 0]);
    M.P(g, M.box(0.006, 0.2, 0.0125), G.mat('dark'), [0, 0.17, 0]);
    if (tier >= 2) M.P(g, M.box(0.005, 0.18, 0.013), M.runeMat(tier), [0, 0.17, 0]);
    M.P(g, M.tube([-0.06, 0.08, 0.008, -0.03, 0.068, 0, 0, 0.066, 0, 0.03, 0.068, 0, 0.06, 0.08, 0.008], 0.009, 18, 8), G.mat('dark'));
    M.P(g, M.cyl(0.015, 0.018, 0.1, 14), M.gripMat(), [0, 0.012, 0]);
    for (let i = 0; i < 3; i++) M.P(g, M.tor(0.017, 0.003, 5, 14), G.mat('darkleather'), [0, -0.02 + i * 0.03, 0], [Math.PI / 2, 0, 0]);
    M.P(g, M.oct(0.022, 1), tier >= 3 ? M.runeMat(tier) : G.mat('col', { c: 0x8a1020, m: 0.3, r: 0.2 }), [0, -0.05, 0]);
    g.userData.tip = 0.42; return g;
  },
  mace(tier = 0) {
    const g = new THREE.Group(), bm = M.tierMat(tier);
    M.P(g, M.cyl(0.021, 0.024, 0.6, 16), G.mat('wood'), [0, 0.2, 0]);
    for (let i = 0; i < 6; i++) M.P(g, M.tor(0.025, 0.0045, 6, 14), G.mat('darkleather'), [0, -0.07 + i * 0.026, 0], [Math.PI / 2, 0, 0]);
    // flanged head: core, seven shaped flanges, collars and a crown knob
    M.P(g, M.cyl(0.036, 0.036, 0.2, 14), bm, [0, 0.52, 0]);
    const fl = M.ext('maceflange', s => { s.moveTo(0, -0.1); s.lineTo(0.03, -0.09); s.quadraticCurveTo(0.088, -0.03, 0.08, 0.035); s.quadraticCurveTo(0.06, 0.09, 0, 0.105); s.lineTo(0, -0.1); }, 0.012, 0.004);
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; M.P(g, fl, bm, [0, 0.52, 0], [0, -a, 0]); }
    M.P(g, M.cyl(0.044, 0.04, 0.03, 16), G.mat('dark'), [0, 0.405, 0]);
    M.P(g, M.cyl(0.04, 0.044, 0.025, 16), G.mat('dark'), [0, 0.632, 0]);
    M.P(g, M.sph(0.028, 14, 10), bm, [0, 0.655, 0]);
    if (tier >= 2) M.P(g, M.tor(0.045, 0.007, 8, 24), M.runeMat(tier), [0, 0.52, 0], [Math.PI / 2, 0, 0]);
    M.P(g, M.sph(0.03, 14, 10), G.mat('gold'), [0, -0.11, 0]);
    g.userData.tip = 0.62; return g;
  },
  staff(tier = 0, orbColor = 0xff6a20) {
    const g = new THREE.Group(), metal = tier >= 4 ? G.mat('gold') : G.mat('bronze');
    M.P(g, M.tube([0, -0.5, 0, 0.012, -0.25, 0.006, -0.004, 0, 0.012, 0.014, 0.25, -0.006, -0.008, 0.55, -0.01, 0.006, 0.78, 0.004, 0.01, 0.95, 0], 0.024, 40, 12, 0.28), G.mat('wood'));
    for (let i = 0; i < 4; i++) M.P(g, M.sph(0.026 - i * 0.002, 10, 8), G.mat('wood'), [(i % 2 ? 0.014 : -0.012), -0.3 + i * 0.36, (i % 2 ? -0.008 : 0.01)], 0, [1, 1.5, 1]);   // knots
    M.P(g, M.cone(0.026, 0.06, 12), metal, [0, -0.53, 0], [Math.PI, 0, 0]);
    // claw holding orb
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; M.P(g, M.tube([0, 0.93, 0, Math.cos(a) * 0.06, 1.0, Math.sin(a) * 0.06, Math.cos(a) * 0.065, 1.1, Math.sin(a) * 0.065, Math.cos(a) * 0.02, 1.16, Math.sin(a) * 0.02], 0.009, 18, 6, 0.6), metal); }
    M.P(g, M.cyl(0.03, 0.022, 0.06, 14), metal, [0, 0.93, 0]);
    const orb = M.P(g, M.ico(0.055, 3), G.mat('emissive', { c: orbColor, i: 1.3 + tier * 0.4 }), [0, 1.07, 0]);
    M.P(g, M.ico(0.075, 2), G.mat('col', { c: orbColor, tr: 0.25, r: 0.1, e: orbColor, ei: 0.6 }), [0, 1.07, 0]);
    for (let i = 0; i < 3; i++) M.P(g, M.tor(0.027, 0.004, 6, 16), tier >= 2 ? M.runeMat(tier) : metal, [0, 0.2 + i * 0.05, 0], [Math.PI / 2, 0, 0]);
    g.userData.orb = orb; g.userData.tip = 1.07; return g;
  },
  // knight / priest warhammer: one-handed, square crushing face and a back spike
  warhammer(tier = 0, holy = false) {
    const g = new THREE.Group(), bm = M.tierMat(tier), fit = holy ? G.mat('gold') : G.mat('dark');
    M.P(g, M.cyl(0.02, 0.024, 0.72, 16), G.mat('wood'), [0, 0.24, 0]);
    for (let i = 0; i < 6; i++) M.P(g, M.tor(0.025, 0.0045, 6, 14), G.mat('darkleather'), [0, -0.07 + i * 0.026, 0], [Math.PI / 2, 0, 0]);
    M.P(g, M.box(0.075, 0.09, 0.07), bm, [0, 0.62, 0]);
    M.P(g, M.box(0.11, 0.075, 0.075), bm, [0.06, 0.62, 0]);
    for (let i = 0; i < 4; i++) M.P(g, M.box(0.014, 0.024, 0.024), fit, [0.12, 0.6 + (i % 2) * 0.04, (i < 2 ? -1 : 1) * 0.02]);   // waffled face
    M.P(g, M.cone(0.03, 0.15, 8), bm, [-0.11, 0.62, 0], [0, 0, Math.PI / 2]);
    M.P(g, M.cone(0.022, 0.09, 8), bm, [0, 0.71, 0]);
    M.mirror(s => M.P(g, M.box(0.012, 0.16, 0.02), fit, [0, 0.5, s * 0.03]));   // langets
    if (holy) { M.P(g, M.box(0.008, 0.05, 0.002), G.mat('emissive', { c: 0xffe08a, i: 3 }), [0.02, 0.62, 0.038]); M.P(g, M.box(0.03, 0.008, 0.002), G.mat('emissive', { c: 0xffe08a, i: 3 }), [0.02, 0.635, 0.038]); }
    if (tier >= 2) M.P(g, M.tor(0.05, 0.006, 8, 24), M.runeMat(tier), [0, 0.54, 0], [Math.PI / 2, 0, 0]);
    M.P(g, M.sph(0.028, 14, 10), fit, [0, -0.11, 0]);
    g.userData.tip = 0.68; return g;
  },
  // war spear: long ash haft, leaf blade, socket rings and a butt spike
  spear(tier = 0) {
    const g = new THREE.Group(), bm = M.tierMat(tier);
    M.P(g, M.cyl(0.018, 0.02, 2.0, 12), G.mat('wood'), [0, 0.3, 0]);
    const blade = M.extTaper('spearleaf', s => { s.moveTo(-0.035, 0); s.quadraticCurveTo(-0.05, 0.12, 0, 0.3); s.quadraticCurveTo(0.05, 0.12, 0.035, 0); s.lineTo(-0.035, 0); }, 0.012, 0.002, 0.04, 0.8);
    M.P(g, blade, bm, [0, 1.32, 0]);
    M.P(g, M.cyl(0.022, 0.026, 0.12, 12), G.mat('dark'), [0, 1.27, 0]);
    for (let i = 0; i < 2; i++) M.P(g, M.tor(0.024, 0.005, 6, 14), G.mat('dark'), [0, 1.21 - i * 0.03, 0], [Math.PI / 2, 0, 0]);
    M.P(g, M.box(0.12, 0.012, 0.012), G.mat('col', { c: 0x8a1a1a, t: 'cloth' }), [0, 1.2, 0]);   // tassel bar
    for (let i = 0; i < 6; i++) M.P(g, M.tor(0.022, 0.004, 6, 14), G.mat('darkleather'), [0, -0.06 + i * 0.024, 0], [Math.PI / 2, 0, 0]);
    M.P(g, M.cone(0.02, 0.1, 8), G.mat('dark'), [0, -0.76, 0], [Math.PI, 0, 0]);
    if (tier >= 2) M.P(g, M.box(0.006, 0.16, 0.014), M.runeMat(tier), [0, 1.42, 0]);
    g.userData.tip = 1.6; return g;
  },
  // barbarian maul: long haft along +y like the greataxe, so it uses the same two-handed grip
  maul(tier = 0) {
    const g = new THREE.Group(), bm = M.tierMat(tier), L = 1.2;
    M.P(g, M.tube([0, -0.12, 0, 0.006, L * 0.35, 0, -0.004, L * 0.7, 0, 0, L - 0.08, 0], 0.028, 24, 12, 0.08), G.mat('wood'));
    for (let i = 0; i < 7; i++) M.P(g, M.tor(0.031, 0.005, 6, 16), G.mat('darkleather'), [0, -0.05 + i * 0.032, 0], [Math.PI / 2, 0, 0]);
    const hd = M.G(g, [0, L - 0.16, 0]);
    M.P(hd, M.cyl(0.085, 0.085, 0.3, 10), bm, [0, 0, 0], [0, 0, Math.PI / 2]);
    M.mirror(s => { M.P(hd, M.cyl(0.097, 0.097, 0.035, 10), G.mat('dark'), [s * 0.13, 0, 0], [0, 0, Math.PI / 2]); M.P(hd, M.cyl(0.07, 0.085, 0.03, 10), bm, [s * 0.162, 0, 0], [0, 0, Math.PI / 2]); });
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; M.P(hd, M.box(0.17, 0.018, 0.018), G.mat('dark'), [0, Math.cos(a) * 0.087, Math.sin(a) * 0.087], [a, 0, 0]); }
    if (tier >= 2) M.mirror(s => M.P(hd, M.tor(0.1, 0.008, 8, 24), M.runeMat(tier), [s * 0.08, 0, 0], [0, Math.PI / 2, 0]));
    M.P(g, M.cyl(0.035, 0.03, 0.05, 12), G.mat('dark'), [0, -0.14, 0]);
    g.userData.tip = L; return g;
  },
  // rapier: slim long blade, swept hilt with a shell guard
  rapier(tier = 0) {
    const g = new THREE.Group(), bm = M.tierMat(tier), fit = tier >= 4 ? G.mat('gold') : G.mat('steel');
    M.P(g, M.sculpt('rapblade', [[0, 0.012, 0.006, 0, 1.6], [0.5, 0.009, 0.005, 0, 1.6], [0.88, 0.005, 0.003, 0, 1.6], [0.95, 0.0008, 0.0008, 0, 1.6]], 8, 3), bm, [0, 0.1, 0]);
    M.P(g, M.sph(0.055, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.2), fit, [0, 0.095, 0], [Math.PI, 0, 0], [1, 0.45, 1]);
    M.P(g, M.tube([0, 0.09, 0, 0.05, 0.05, 0.02, 0.055, -0.02, 0.02, 0.02, -0.07, 0.01], 0.006, 16, 6), fit);
    M.P(g, M.tube([-0.08, 0.1, 0, 0, 0.1, 0, 0.08, 0.1, 0], 0.007, 10, 6), fit);
    M.P(g, M.cyl(0.014, 0.016, 0.12, 12), M.gripMat(), [0, 0.02, 0]);
    M.P(g, M.sph(0.022, 12, 10), fit, [0, -0.06, 0]);
    if (tier >= 2) M.P(g, M.box(0.004, 0.4, 0.008), M.runeMat(tier), [0, 0.35, 0]);
    g.userData.tip = 1.05; return g;
  },
  // kukri: forward-bent blade with a dark venom sheen
  kukri(tier = 0) {
    const g = new THREE.Group(), bm = M.tierMat(tier);
    const blade = M.extTaper('kukri', s => { s.moveTo(-0.02, 0); s.quadraticCurveTo(-0.03, 0.15, 0.05, 0.3); s.quadraticCurveTo(0.09, 0.34, 0.06, 0.38); s.quadraticCurveTo(0.03, 0.2, 0.02, 0); s.lineTo(-0.02, 0); }, 0.014, 0.002, 0.03, 0.78);
    M.P(g, blade, bm, [0, 0.07, 0]);
    M.P(g, M.tube([0.0, 0.1, 0.012, 0.035, 0.27, 0.012, 0.06, 0.38, 0.01], 0.004, 14, 4), G.mat('emissive', { c: 0x60ff40, i: 1.6 }));
    M.P(g, M.box(0.07, 0.014, 0.03), G.mat('dark'), [0, 0.065, 0]);
    M.P(g, M.cyl(0.016, 0.019, 0.11, 12), G.mat('col', { c: 0x2a1a10, t: 'wood' }), [0, 0.01, 0]);
    M.P(g, M.box(0.03, 0.02, 0.03), G.mat('dark'), [0, -0.05, 0]);
    g.userData.tip = 0.45; return g;
  },
  // staff variants: frost crown, storm coils, or a priest's golden sun disc
  staffKind(tier, kind) {
    const col = kind === 'rime' ? 0x7ad8ff : kind === 'storm' ? 0xb08aff : kind === 'sun' ? 0xffd060 : 0xff6a20;
    const g = M.weapon.staff(tier, col);
    if (kind === 'rime') { for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; M.P(g, M.cone(0.018, 0.16, 5), G.mat('col', { c: 0xbfeaff, tr: 0.55, r: 0.05, e: 0x3a9ad0, ei: 0.8 }), [Math.cos(a) * 0.06, 1.12, Math.sin(a) * 0.06], [Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4]); } M.P(g, M.cone(0.022, 0.2, 5), G.mat('col', { c: 0xbfeaff, tr: 0.55, r: 0.05, e: 0x3a9ad0, ei: 0.8 }), [0, 1.22, 0]); }
    if (kind === 'storm') { for (let i = 0; i < 7; i++) M.P(g, M.tor(0.034, 0.005, 6, 16), G.mat('col', { c: 0xb87333, m: 0.9, r: 0.3 }), [0, 0.6 + i * 0.045, 0], [Math.PI / 2, 0, 0]); for (let i = 0; i < 3; i++) M.P(g, M.tor(0.11 + i * 0.015, 0.004, 6, 24), G.mat('emissive', { c: 0xc0a0ff, i: 2.2 }), [0, 1.07, 0], [i * 1.1, i * 0.6, 0]); }
    if (kind === 'sun') { M.P(g, M.tor(0.12, 0.012, 8, 32), G.mat('gold'), [0, 1.07, 0]); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; M.P(g, M.cone(0.014, 0.08, 4), G.mat('gold'), [Math.cos(a) * 0.16, 1.07 + Math.sin(a) * 0.16, 0], [0, 0, a - Math.PI / 2]); } }
    g.userData.kind = kind; return g;
  },
  bow(tier = 0) {
    const g = new THREE.Group(), wood = tier >= 3 ? G.mat('col', { c: 0x2a2a3a, r: 0.4, m: 0.4 }) : G.mat('wood');
    // tapered recurve limbs leaving the riser
    M.mirror(s => M.P(g, M.tube([0, s * 0.06, -0.035, 0, s * 0.2, -0.042, 0, s * 0.45, 0.012, 0, s * 0.57, 0.06, 0, s * 0.62, 0.09], 0.019, 30, 8, 0.55), wood));
    M.P(g, M.cyl(0.022, 0.022, 0.16, 14), wood, [0, 0, -0.032]);
    if (tier >= 2) M.mirror(s => M.P(g, M.tube([0, s * 0.1, -0.02, 0, s * 0.3, -0.025, 0, s * 0.5, 0.03], 0.006, 16, 5), M.runeMat(tier)));
    M.P(g, M.cyl(0.026, 0.026, 0.13, 14), M.gripMat(), [0, 0, -0.032]);
    for (let i = 0; i < 4; i++) M.P(g, M.tor(0.026, 0.003, 5, 14), G.mat('darkleather'), [0, -0.05 + i * 0.033, -0.032], [Math.PI / 2, 0, 0]);
    M.P(g, M.box(0.012, 0.02, 0.02), G.mat('darkleather'), [0.024, 0.07, -0.022]);   // arrow rest
    M.mirror(s => M.P(g, M.cone(0.013, 0.05, 8), tier >= 4 ? G.mat('gold') : G.mat('bone'), [0, s * 0.635, 0.095], [s > 0 ? -0.5 : Math.PI + 0.5, 0, 0]));
    // two-part string that bends toward the nock point
    const smat = G.mat('col', { c: 0xece4cc, r: 0.6 }), tips = [new G.V3(0, 0.62, 0.085), new G.V3(0, -0.62, 0.085)];
    const segs = tips.map(() => { const m = new THREE.Mesh(M.cyl(0.0035, 0.0035, 1, 4), smat); g.add(m); return m; });
    const up = new G.V3(0, 1, 0), d = new G.V3();
    g.userData.rest = new G.V3(0, 0, 0.085);
    g.userData.setNock = (p) => { tips.forEach((t, i) => { d.copy(p).sub(t); const L = d.length(); const m = segs[i]; m.position.copy(t).addScaledVector(d, 0.5); m.scale.set(1, L, 1); m.quaternion.setFromUnitVectors(up, d.divideScalar(L || 1)); }); g.userData.nock = p.clone(); };
    g.userData.setNock(g.userData.rest);
    g.userData.tip = 0.6; return g;
  },
  arrow(tier = 0) {
    const g = new THREE.Group();
    M.P(g, M.cyl(0.0055, 0.0055, 0.75, 6), G.mat('wood'), [0, 0, 0], [Math.PI / 2, 0, 0]);
    M.P(g, M.extTaper('broadhead', s => { s.moveTo(0, 0); s.lineTo(0.016, 0.012); s.quadraticCurveTo(0.012, 0.045, 0, 0.07); s.quadraticCurveTo(-0.012, 0.045, -0.016, 0.012); s.lineTo(0, 0); }, 0.006, 0.001, 0.016, 0.8), M.tierMat(tier), [0, 0, 0.365], [Math.PI / 2, 0, 0]);
    const vane = M.ext('vane', s => { s.moveTo(0, 0); s.lineTo(0, 0.11); s.quadraticCurveTo(0.012, 0.06, 0.024, 0.0); s.lineTo(0, 0); }, 0.001, 0);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const v = M.G(g, [0, 0, -0.36], [0, 0, a]); M.P(v, vane, G.mat('col', { c: i ? 0xd8d0c0 : 0xb03020, ds: true }), [0, 0.005, 0], [Math.PI / 2, 0, Math.PI / 2]); }
    M.P(g, M.cyl(0.007, 0.007, 0.02, 6), G.mat('darkleather'), [0, 0, -0.37], [Math.PI / 2, 0, 0]);
    return g;
  },
  shield(tier = 0, emblem = 0x1d3f8a) {
    const g = new THREE.Group();
    const body = M.bend('kite', M.ext('kite', s => { s.moveTo(0, 0.38); s.quadraticCurveTo(0.24, 0.36, 0.25, 0.18); s.quadraticCurveTo(0.22, -0.18, 0, -0.42); s.quadraticCurveTo(-0.22, -0.18, -0.25, 0.18); s.quadraticCurveTo(-0.24, 0.36, 0, 0.38); }, 0.03, 0.012), 0.55);
    M.P(g, body, G.mat('col', { c: emblem, r: 0.6, m: 0.2 }), [0, 0, 0]);
    const rim = M.bend('kiterim', M.ext('kiterim', s => { s.moveTo(0, 0.4); s.quadraticCurveTo(0.26, 0.38, 0.27, 0.18); s.quadraticCurveTo(0.24, -0.19, 0, -0.45); s.quadraticCurveTo(-0.24, -0.19, -0.27, 0.18); s.quadraticCurveTo(-0.26, 0.38, 0, 0.4);
      const h = new THREE.Path(); h.moveTo(0, 0.36); h.quadraticCurveTo(-0.22, 0.34, -0.23, 0.18); h.quadraticCurveTo(-0.2, -0.17, 0, -0.39); h.quadraticCurveTo(0.2, -0.17, 0.23, 0.18); h.quadraticCurveTo(0.22, 0.34, 0, 0.36); s.holes.push(h); }, 0.04, 0.008), 0.55);
    M.P(g, rim, M.tierMat(tier), [0, 0, 0]);
    // gold cross following the curve, boss, rivets along the rim
    M.P(g, M.box(0.05, 0.6, 0.012), G.mat('gold'), [0, -0.02, 0.022]);
    M.P(g, M.bend('shbar', M.box(0.36, 0.05, 0.012, 10, 1, 1), 0.55), G.mat('gold'), [0, 0.12, 0.022]);
    M.P(g, M.sph(0.055, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.tierMat(tier), [0, 0.12, 0.02], [Math.PI / 2, 0, 0]);
    M.P(g, M.sph(0.018, 10, 8), G.mat('gold'), [0, 0.12, 0.07]);
    const rv = [[0, 0.385], [0.13, 0.36], [0.235, 0.28], [0.255, 0.15], [0.235, 0.0], [0.185, -0.15], [0.11, -0.29], [0.04, -0.4]];
    rv.forEach(([x, y]) => M.mirror(s => { if (!x && s < 0) return; M.P(g, M.sph(0.011, 8, 6), G.mat('dark'), [s * x, y, 0.03 - x * x * 0.55]); }));
    if (tier >= 2) M.P(g, M.tor(0.07, 0.008, 6, 24), M.runeMat(tier), [0, 0.12, 0.025]);
    return g;
  }
};

/* ---------- winged & multi-legged rigs ---------- */
M.wing = (parent, side, span, mat, boneMat) => {
  const W = M.G(parent, [side * 0.12, 0, -0.1]);
  const shape = M.ext('wing' + span, s => { s.moveTo(0, 0); s.lineTo(span, span * 0.25); s.lineTo(span * 0.92, -span * 0.12); s.quadraticCurveTo(span * 0.75, -span * 0.05, span * 0.68, -span * 0.32); s.quadraticCurveTo(span * 0.5, -span * 0.2, span * 0.42, -span * 0.42); s.quadraticCurveTo(span * 0.28, -span * 0.25, span * 0.15, -span * 0.38); s.quadraticCurveTo(span * 0.08, -span * 0.15, 0, -0.06); }, 0.01, 0);
  const mem = M.P(W, shape, mat, [0, 0, 0], [0, side > 0 ? 0 : Math.PI, 0]);
  [[span, span * 0.25], [span * 0.68, -span * 0.32], [span * 0.42, -span * 0.42], [span * 0.15, -span * 0.38]].forEach(([x, y]) => {
    M.P(W, M.tube([0, 0, 0, side * x * 0.5, y * 0.3 + span * 0.08, 0, side * x, y, 0], span * 0.018, 12, 6, 0.6), boneMat);
  });
  return W;
};
M.animWings = (R, t, speed = 8, amp = 0.6) => { if (!R.wings) return; const a = Math.sin(t * speed) * amp; R.wings[0].rotation.set(0, -0.3, a + 0.15); R.wings[1].rotation.set(0, 0.3, -a - 0.15); };

// multi-segment legs used by spiders and quadrupeds
// leg chains for beasts, spiders and crawlers: each segment is sculpted (a muscled upper leg, a sinewy shank with
// the bulge behind, a thin pastern), with knobbly joints; spiders get banded chitin and bristles instead
M.legChain = (parent, segs, mat, radius, style) => {
  const joints = []; let cur = parent; const spider = style === 'spider' || (style === undefined && radius < 0.04 && segs.length === 3 && segs[1] > segs[0]);
  segs.forEach((len, i) => {
    const j = M.G(cur, i === 0 ? [0, 0, 0] : [0, -segs[i - 1], 0]), r = radius * (1 - i * 0.22);
    const rows = spider ? [[0, r * 1.05, r * 1.05, 0, 0], [0.08, r * 0.92, r * 0.92, 0, 0], [0.45, r * 1.08, r * 1.0, 0, 0], [0.9, r * 0.86, r * 0.86, 0, 0], [1, r * 0.95, r * 0.95, 0, 0]]
      : i === 0 ? [[0, r * 1.2, r * 1.25, 0, 0], [0.28, r * 1.32, r * 1.38, r * 0.16, 0], [0.62, r * 1.02, r * 1.05, r * 0.08, 0], [1, r * 0.78, r * 0.8, 0, 0]]
      : i === segs.length - 1 && segs.length > 2 ? [[0, r * 0.75, r * 0.8, 0, 0], [0.35, r * 0.62, r * 0.66, 0, 0], [1, r * 0.58, r * 0.62, 0, 0]]
      : [[0, r * 0.88, r * 0.9, 0, 0], [0.22, r * 0.95, r * 1.12, -r * 0.18, 0], [0.55, r * 0.72, r * 0.78, -r * 0.08, 0], [1, r * 0.62, r * 0.64, 0, 0]];
    const key = 'seg' + [len, r, i, spider ? 1 : 0, segs.length].join(',');
    M.P(j, M.sculpt(key, M.limbRings({ len, rows }, 1), 20, 3, 3), mat, [0, 0, 0]);
    M.P(j, M.sph(r * (spider ? 1.18 : i === 0 ? 1.15 : 0.82), 14, 10), mat, [0, 0, 0], 0, spider ? [1, 0.85, 1] : [1, 1, 1.08]);
    if (spider) { for (let k = 0; k < 3; k++) M.P(j, M.tor(r * 1.0, r * 0.12, 4, 12), mat, [0, -len * (0.2 + k * 0.28), 0], [Math.PI / 2, 0, 0]);
      for (let k = 0; k < 5; k++) M.P(j, M.cone(r * 0.12, r * 1.6, 4), mat, [Math.sin(k * 2.4) * r * 0.9, -len * (0.15 + k * 0.17), Math.cos(k * 2.4) * r * 0.9], [Math.cos(k * 2.4) * 0.9, 0, -Math.sin(k * 2.4) * 0.9]); }
    joints.push(j); cur = j;
  });
  return joints;
};

/* ---------- static batching: merge meshes that share a material ---------- */
M.prepGeo = (g, matrix) => {
  let ng = g.index ? g.toNonIndexed() : g.clone();
  Object.keys(ng.attributes).forEach(k => { if (k !== 'position' && k !== 'normal' && k !== 'uv') ng.deleteAttribute(k); });
  if (!ng.attributes.uv) ng.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(ng.attributes.position.count * 2), 2));
  if (!ng.attributes.normal) ng.computeVertexNormals();
  ng.clearGroups(); ng.morphAttributes = {};
  ng.applyMatrix4(matrix); return ng;
};
M.mergeList = (list) => { // list of {geo, matrix}
  const geos = list.map(o => M.prepGeo(o.geo, o.matrix));
  const out = THREE.BufferGeometryUtils.mergeBufferGeometries(geos, false);
  geos.forEach(g => g.dispose()); if (out) out.computeBoundingSphere(); return out;
};
// merge direct mesh children of every node in a rig, per material (joints keep animating)
M.batchRig = (R) => {
  if (!THREE.BufferGeometryUtils) return;
  const keep = new Set();
  const mark = v => { if (!v) return; if (v.isMesh) keep.add(v); else if (Array.isArray(v)) v.forEach(mark); };
  Object.values(R).forEach(v => { if (v && typeof v === 'object' && !v.isObject3D && !Array.isArray(v)) Object.values(v).forEach(mark); else mark(v); });
  const visit = (node) => {
    if (node.userData.flicker || node.userData.noBatch) return;
    const groups = new Map(), drop = [];
    node.children.forEach(c => {
      if (!c.isMesh || c.isInstancedMesh || keep.has(c) || c.children.length || Array.isArray(c.material)) return;
      if (!c.visible) { drop.push(c); return; }
      const k = c.material.uuid; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c);
    });
    drop.forEach(c => node.remove(c));
    groups.forEach(list => {
      if (list.length < 2) return;
      list.forEach(c => c.updateMatrix());
      const geo = M.mergeList(list.map(c => ({ geo: c.geometry, matrix: c.matrix })));
      if (!geo) return;
      const m = new THREE.Mesh(geo, list[0].material); m.renderOrder = list[0].renderOrder;
      list.forEach(c => node.remove(c)); node.add(m);
    });
    node.children.slice().forEach(c => { if (!c.isMesh || c.children.length) visit(c); });
  };
  visit(R.root);
};
