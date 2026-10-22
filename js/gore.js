/* ============================================================
   Gore: streaked blood droplets that squirt and splatter,
   pulsing arterial wounds, slash/puncture wounds projected onto
   the actual body surface, directional floor & wall splatter
   ============================================================ */
'use strict';
G.gore = {
  N: 1400,
  COL: { red: [[0.62, 0.02, 0.02], [0.36, 0.0, 0.0]], rot: [[0.32, 0.22, 0.04], [0.18, 0.1, 0.02]], ichor: [[0.3, 0.75, 0.1], [0.16, 0.42, 0.05]], ecto: [[0.4, 0.8, 1.0], [0.15, 0.45, 0.7]], ember: [[1, 0.35, 0.05], [0.4, 0.06, 0]] },
  init() {
    if (this.mesh) { this.reset(); return; }
    const N = this.N;
    this.p = new Float32Array(N * 3); this.v = new Float32Array(N * 3); this.life = new Float32Array(N); this.w = new Float32Array(N); this.c = new Float32Array(N * 3); this.splat = new Uint8Array(N); this.next = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(N * 12); this.col = new Float32Array(N * 16); const uv = new Float32Array(N * 8), idx = new Uint32Array(N * 6);
    for (let i = 0; i < N; i++) { uv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8); idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6); }
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: this.tex('streak'), vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 3; G.scene.add(this.mesh);
    this.emitters = []; this.decals = []; this.ray = new THREE.Raycaster(); this.woundMats = {};
    this._a = new G.V3(); this._s = new G.V3(); this._cam = new G.V3();
  },
  reset() { this.life.fill(0); this.emitters = []; this.decals.forEach(d => G.scene.remove(d.m)); this.decals = []; },

  /* ---------------- textures (grayscale = shade, alpha = shape; tinted per blood) ---------------- */
  tex(kind) {
    const key = 'g_' + kind; if (G.tex.cache[key]) return G.tex.cache[key];
    const S = kind === 'streak' ? 64 : 256, c = document.createElement('canvas'); c.width = kind === 'streak' ? 32 : S; c.height = S; const x = c.getContext('2d'), r = G.mulberry(kind.length * 131 + 7);
    const blob = (cx, cy, rad, a = 1, shade = 1) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad); const v = Math.round(255 * shade); g.addColorStop(0, `rgba(${v},${v},${v},${a})`); g.addColorStop(0.75, `rgba(${Math.round(v * 0.75)},${Math.round(v * 0.75)},${Math.round(v * 0.75)},${a})`); g.addColorStop(1, `rgba(${Math.round(v * 0.5)},${Math.round(v * 0.5)},${Math.round(v * 0.5)},0)`); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, rad, 0, 7); x.fill(); };
    const ell = (cx, cy, rx, ry, rot, a, shade = 1) => { x.save(); x.translate(cx, cy); x.rotate(rot); x.scale(1, ry / rx); blob(0, 0, rx, a, shade); x.restore(); };
    if (kind === 'streak') { // droplet with a long thinning tail; head at the top
      const g = x.createLinearGradient(0, S, 0, 0); g.addColorStop(0, 'rgba(160,160,160,0)'); g.addColorStop(0.55, 'rgba(210,210,210,0.75)'); g.addColorStop(1, 'rgba(255,255,255,1)');
      x.fillStyle = g; x.beginPath(); x.moveTo(16, S); x.quadraticCurveTo(10, S * 0.4, 6, S * 0.2); x.arc(16, S * 0.2, 10, Math.PI, 0); x.quadraticCurveTo(22, S * 0.4, 16, S); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.9)'; x.beginPath(); x.arc(13, S * 0.17, 3, 0, 7); x.fill();
    } else if (kind === 'splat') { // impact splat with crown spikes and satellites
      blob(128, 128, 46, 1, 0.9);
      for (let i = 0; i < 9; i++) { const a = r() * 6.28, d = 18 + r() * 26; ell(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 14 + r() * 16, 10 + r() * 10, a, 0.95, 0.8 + r() * 0.2); }
      for (let i = 0; i < 14; i++) { const a = r() * 6.28, L = 50 + r() * 60; x.strokeStyle = 'rgba(200,200,200,0.9)'; x.lineWidth = 2 + r() * 5; x.lineCap = 'round'; x.beginPath(); x.moveTo(128 + Math.cos(a) * 30, 128 + Math.sin(a) * 30); x.lineTo(128 + Math.cos(a) * L, 128 + Math.sin(a) * L); x.stroke(); blob(128 + Math.cos(a) * L, 128 + Math.sin(a) * L, 3 + r() * 5, 1, 0.85); }
      for (let i = 0; i < 26; i++) { const a = r() * 6.28, d = 70 + r() * 50; blob(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 1.5 + r() * 4, 1, 0.8); }
    } else if (kind === 'dir') { // directional splash: travels to the right
      ell(80, 128, 40, 26, 0, 1, 0.9); for (let i = 0; i < 7; i++) ell(110 + i * 16 + r() * 8, 128 + (r() - 0.5) * 30, 18 - i * 2, 7 + r() * 5, (r() - 0.5) * 0.4, 0.95, 0.85);
      for (let i = 0; i < 24; i++) { const d = 120 + r() * 120, y = 128 + (r() - 0.5) * (30 + d * 0.4); ell(d, y, 2 + r() * 6, 1.5 + r() * 3, 0, 1, 0.8); }
      for (let i = 0; i < 6; i++) blob(60 + r() * 40, 128 + (r() - 0.5) * 70, 2 + r() * 4, 1, 0.8);
    } else if (kind === 'drip') { // wall splat whose drips run down (down = +y on the canvas)
      blob(128, 90, 40, 1, 0.9); for (let i = 0; i < 10; i++) { const a = r() * 6.28, d = 20 + r() * 34; blob(128 + Math.cos(a) * d, 90 + Math.sin(a) * d * 0.8, 8 + r() * 14, 0.95, 0.85); }
      for (let i = 0; i < 7; i++) { const sx = 92 + r() * 72, L = 60 + r() * 100, w = 3 + r() * 5; const g = x.createLinearGradient(0, 90, 0, 90 + L); g.addColorStop(0, 'rgba(210,210,210,1)'); g.addColorStop(1, 'rgba(160,160,160,0.6)'); x.fillStyle = g; x.fillRect(sx - w / 2, 90, w, L); blob(sx, 90 + L, w * 0.9, 1, 0.75); }
      for (let i = 0; i < 20; i++) { const a = r() * 6.28, d = 60 + r() * 50; blob(128 + Math.cos(a) * d, 90 + Math.sin(a) * d * 0.7, 1.5 + r() * 3.5, 1, 0.8); }
    } else if (kind === 'pool') { // irregular pooled blood, darker rim
      for (let i = 0; i < 16; i++) { const a = r() * 6.28, d = r() * 50; ell(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 34 + r() * 30, 26 + r() * 24, r() * 6, 1, 0.75 + r() * 0.2); }
      x.globalCompositeOperation = 'source-atop'; const g = x.createRadialGradient(128, 128, 30, 128, 128, 120); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(60,60,60,0.7)'); x.fillStyle = g; x.fillRect(0, 0, S, S);
    } else if (kind === 'gash') { // a laceration: dark ragged core, wet rim, thin smear tails (long axis = x)
      const L = S * 0.46;
      x.fillStyle = 'rgba(150,150,150,0.85)'; x.beginPath(); x.moveTo(128 - L, 128); for (let i = 0; i <= 20; i++) { const t = i / 20, px = 128 - L + t * 2 * L, w = Math.sin(t * Math.PI) * 26 * (0.8 + r() * 0.4); x.lineTo(px, 128 - w); } for (let i = 20; i >= 0; i--) { const t = i / 20, px = 128 - L + t * 2 * L, w = Math.sin(t * Math.PI) * 24 * (0.8 + r() * 0.4); x.lineTo(px, 128 + w); } x.closePath(); x.fill();
      x.fillStyle = 'rgba(40,40,40,1)'; x.beginPath(); x.moveTo(128 - L * 0.9, 128); for (let i = 0; i <= 20; i++) { const t = i / 20, px = 128 - L * 0.9 + t * 1.8 * L, w = Math.sin(t * Math.PI) * 8 * (0.7 + r() * 0.6); x.lineTo(px, 128 - w); } for (let i = 20; i >= 0; i--) { const t = i / 20, px = 128 - L * 0.9 + t * 1.8 * L, w = Math.sin(t * Math.PI) * 7 * (0.7 + r() * 0.6); x.lineTo(px, 128 + w); } x.closePath(); x.fill();
      x.strokeStyle = 'rgba(255,255,255,0.55)'; x.lineWidth = 2; x.beginPath(); x.moveTo(128 - L * 0.7, 120); x.quadraticCurveTo(128, 112, 128 + L * 0.7, 120); x.stroke();
      for (let i = 0; i < 6; i++) { const sx = 128 - L * 0.6 + r() * L * 1.2, len = 20 + r() * 60, w = 2 + r() * 4; const g = x.createLinearGradient(0, 128, 0, 128 + len); g.addColorStop(0, 'rgba(150,150,150,0.9)'); g.addColorStop(1, 'rgba(150,150,150,0)'); x.fillStyle = g; x.fillRect(sx, 130, w, len); }
    } else if (kind === 'puncture') {
      blob(128, 128, 40, 0.9, 0.7); blob(128, 128, 16, 1, 0.15);
      for (let i = 0; i < 3; i++) { const sx = 118 + r() * 20, len = 40 + r() * 70; const g = x.createLinearGradient(0, 140, 0, 140 + len); g.addColorStop(0, 'rgba(150,150,150,0.9)'); g.addColorStop(1, 'rgba(150,150,150,0)'); x.fillStyle = g; x.fillRect(sx, 140, 4 + r() * 3, len); }
    } else if (kind === 'crackmark') { // bone/stone chips: dark fracture lines
      x.strokeStyle = 'rgba(30,30,30,1)'; x.lineCap = 'round'; for (let i = 0; i < 7; i++) { let px = 128, py = 128, a = r() * 6.28; x.lineWidth = 4 - i * 0.3; x.beginPath(); x.moveTo(px, py); for (let j = 0; j < 7; j++) { a += (r() - 0.5) * 0.9; px += Math.cos(a) * 14; py += Math.sin(a) * 14; x.lineTo(px, py); } x.stroke(); }
    }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; G.tex.cache[key] = t; return t;
  },

  /* ---------------- streak particles ---------------- */
  drop(px, py, pz, vx, vy, vz, w, col, splat, life = 2.5) {
    const i = this.next; this.next = (this.next + 1) % this.N;
    this.p[i * 3] = px; this.p[i * 3 + 1] = py; this.p[i * 3 + 2] = pz; this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.life[i] = life; this.w[i] = w; this.c[i * 3] = col[0]; this.c[i * 3 + 1] = col[1]; this.c[i * 3 + 2] = col[2]; this.splat[i] = splat ? 1 : 0;
  },
  shade(type) { const C = this.COL[type] || this.COL.red, k = Math.random(); return [G.lerp(C[0][0], C[1][0], k), G.lerp(C[0][1], C[1][1], k), G.lerp(C[0][2], C[1][2], k)]; },
  liquid(type) { return type === 'red' || type === 'rot' || type === 'ichor' || type === 'ecto'; },
  // a coherent squirt: a stream of drops along dir with tight spread
  squirt(p, dir, type, n = 14, speed = 6, spread = 0.18, size = 1) {
    if (!G.settings.gore && (type === 'red' || type === 'rot')) return;
    const q = G.fx.q(); n = Math.ceil(n * q);
    for (let k = 0; k < n; k++) {
      const s = speed * (0.55 + Math.random() * 0.6), jit = spread * (0.4 + Math.random());
      this.drop(p.x + (Math.random() - 0.5) * 0.04, p.y + (Math.random() - 0.5) * 0.04, p.z + (Math.random() - 0.5) * 0.04,
        (dir.x + (Math.random() - 0.5) * jit) * s, (dir.y + (Math.random() - 0.5) * jit) * s, (dir.z + (Math.random() - 0.5) * jit) * s,
        (0.018 + Math.random() * 0.03) * size, this.shade(type), Math.random() < 0.45);
    }
  },
  // a fine mist of tiny drops for the moment of impact
  mist(p, dir, type, n = 10) { for (let k = 0; k < Math.ceil(n * G.fx.q()); k++) { const s = 3 + Math.random() * 6; this.drop(p.x, p.y, p.z, (dir.x + (Math.random() - 0.5) * 1.4) * s, (dir.y + Math.random() * 0.8) * s, (dir.z + (Math.random() - 0.5) * 1.4) * s, 0.008 + Math.random() * 0.012, this.shade(type), false, 0.8); } },

  /* ---------------- decals ---------------- */
  wetMat(kind, type, opacity = 0.95) {
    const C = this.COL[type] || this.COL.red;
    return new THREE.MeshStandardMaterial({ map: this.tex(kind), color: new THREE.Color(C[1][0] * 1.5, C[1][1] * 1.5, C[1][2] * 1.5), roughness: 0.16, metalness: 0.05, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  },
  addDecal(m, life, grow) {
    G.scene.add(m); const d = { m, life, max: life, grow, s: grow ? 0.15 : 1 }; this.decals.push(d);
    if (this.decals.length > 140) { const o = this.decals.shift(); G.scene.remove(o.m); o.m.material.dispose(); }
    return d;
  },
  floorSplat(x, z, size, type, vx = 0, vz = 0) {
    if (!this.liquid(type)) return;
    const sp = Math.hypot(vx, vz), dirn = sp > 1.5;
    const m = new THREE.Mesh(G.fx._dg || (G.fx._dg = new THREE.PlaneGeometry(1, 1)), this.wetMat(dirn ? 'dir' : 'splat', type));
    m.rotation.set(-Math.PI / 2, 0, dirn ? Math.atan2(-vz, vx) : Math.random() * 6.28); m.position.set(x, G.World.fy(x, z) + 0.012 + Math.random() * 0.006, z);
    m.scale.set(size * (dirn ? 1 + Math.min(1.6, sp * 0.18) : 1), size, 1); m.renderOrder = G.decalOrder();
    this.addDecal(m, 50, false);
  },
  wallSplat(x, y, z, nx, nz, size, type) {
    if (!this.liquid(type) || y > 4 || y < 0.05) return;
    const m = new THREE.Mesh(G.fx._dg, this.wetMat('drip', type)); m.position.set(x + nx * 0.02, y, z + nz * 0.02); m.rotation.set(0, Math.atan2(nx, nz), 0); m.scale.set(size, size, 1); m.renderOrder = G.decalOrder();
    this.addDecal(m, 50, false);
  },
  pool(x, z, size, type) {
    if (!this.liquid(type) || (!G.settings.gore && (type === 'red' || type === 'rot'))) return;
    const m = new THREE.Mesh(G.fx._dg, this.wetMat('pool', type, 0.92)); m.rotation.set(-Math.PI / 2, 0, Math.random() * 6.28); m.position.set(x, G.World.fy(x, z) + 0.015, z); m.renderOrder = G.decalOrder(); m.scale.setScalar(size * 0.15);
    const d = this.addDecal(m, 70, true); d.target = size;
  },

  /* ---------------- wounds on bodies ---------------- */
  // find where a strike meets the body: ray from the attacker toward the torso
  surfacePoint(e, eye, dx, dz, d) {
    const tgt = new G.V3(e.pos.x + (Math.random() - 0.5) * e.def.r * 0.5, Math.min(e.def.h * 0.62, 1.45) * (e.R.root.scale.y > 1.4 ? 1.4 : 1) + e.y + (Math.random() - 0.5) * 0.35, e.pos.z + (Math.random() - 0.5) * e.def.r * 0.5);
    const hit = this.cast(e, eye, tgt);
    if (hit) { e._ray = { t: G.now(), hit }; return hit.point.clone(); }
    e._ray = null; return new G.V3(e.pos.x - dx / (d + 1) * e.def.r * 0.5, tgt.y, e.pos.z - dz / (d + 1) * e.def.r * 0.5);
  },
  cast(e, from, to) {
    if (!e.root.visible) return null;
    e.root.updateMatrixWorld(true);
    const dir = to.clone().sub(from), len = dir.length(); dir.divideScalar(len || 1);
    this.ray.set(from, dir); this.ray.far = len + 2;
    const hits = this.ray.intersectObject(e.R.root, true);
    for (const h of hits) { const o = h.object; if (!o.isMesh || !o.visible || o.userData.wound || (o.material && o.material.transparent && o.material.opacity < 0.5)) continue; return h; }
    return null;
  },
  woundMat(kind, type) {
    const k = kind + type; if (this.woundMats[k]) return this.woundMats[k];
    const C = this.COL[type] || this.COL.red, col = kind === 'crackmark' ? new THREE.Color(0.15, 0.13, 0.1) : new THREE.Color(C[1][0] * 1.6, C[1][1] * 1.6, C[1][2] * 1.6);
    return (this.woundMats[k] = new THREE.MeshStandardMaterial({ map: this.tex(kind), color: col, roughness: kind === 'crackmark' ? 0.9 : 0.22, metalness: 0, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  },
  // project a gash/puncture/fracture decal onto the mesh that was struck, parented to its joint so it moves with the body
  wound(e, hit, swingDir, kind, type) {
    if (!THREE.DecalGeometry || !hit || (e.woundN || 0) >= 9) return null;
    const mesh = hit.object, joint = mesh.parent; if (!joint || !hit.face) return null;
    const n = hit.face.normal.clone().transformDirection(mesh.matrixWorld).normalize();
    let xa = swingDir ? swingDir.clone() : new G.V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
    xa.addScaledVector(n, -xa.dot(n)); if (xa.lengthSq() < 1e-4) xa.set(1, 0, 0).addScaledVector(n, -n.x); xa.normalize();
    const ya = new G.V3().crossVectors(n, xa).normalize(), rotM = new THREE.Matrix4().makeBasis(xa, ya, n), eu = new THREE.Euler().setFromRotationMatrix(rotM);
    const sc = Math.max(1, e.R.root.scale.x * 0.8), L = kind === 'gash' ? 0.34 : kind === 'puncture' ? 0.14 : 0.3, Wd = kind === 'gash' ? 0.11 : kind === 'puncture' ? 0.14 : 0.3;
    let geo;
    try { geo = new THREE.DecalGeometry(mesh, hit.point, eu, new G.V3(L * sc, Wd * sc, 0.35 * sc)); } catch (err) { return null; }
    if (!geo.attributes.position || geo.attributes.position.count < 3) { geo.dispose(); return null; }
    joint.updateMatrixWorld(true); geo.applyMatrix4(new THREE.Matrix4().copy(joint.matrixWorld).invert());
    const m = new THREE.Mesh(geo, this.woundMat(kind, type)); m.userData.wound = 1; m.renderOrder = 2; joint.add(m);
    e.woundN = (e.woundN || 0) + 1;
    return { joint, local: joint.worldToLocal(hit.point.clone()), nLocal: n.clone().transformDirection(new THREE.Matrix4().copy(joint.matrixWorld).invert()).normalize() };
  },
  // pulsing arterial bleed from a wound for a short while
  bleed(e, w, type, strong) { if (!w) return; this.emitters.push({ e, w, type, t: 0, dur: strong ? 1.6 : 0.9, strong, nextDrip: 0 }); },

  /* ---------------- per-hit entry point ---------------- */
  hit(e, type, point, dir, crit, info = {}) {
    const bt = e.def.blood, liquid = this.liquid(bt) && (G.settings.gore || (bt !== 'red' && bt !== 'rot'));
    const from = info.from || new G.V3(point.x - dir.x * 2, point.y, point.z - dir.z * 2);
    let hit = e._ray && G.now() - e._ray.t < 0.2 ? e._ray.hit : null;
    if (!hit) hit = this.cast(e, from, point.clone().addScaledVector(new G.V3(point.x - from.x, point.y - from.y, point.z - from.z).normalize(), 0.6));
    e._ray = null;
    const P = hit ? hit.point : point, n = hit && hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize() : dir.clone().multiplyScalar(-1);
    // swing direction in world space, from the attacker's view
    const cam = G.camera, right = new G.V3(1, 0, 0).applyQuaternion(cam.quaternion), up = new G.V3(0, 1, 0).applyQuaternion(cam.quaternion);
    const sw = info.swing, swingDir = sw === 'slashR' ? right.clone().multiplyScalar(-1).addScaledVector(up, -0.55) : sw === 'slashL' ? right.clone().addScaledVector(up, -0.55) : sw === 'overR' || sw === 'slam' || sw === 'smash' ? up.clone().multiplyScalar(-1) : null;
    const kind = bt === 'bone' || bt === 'stone' ? 'crackmark' : type === 'pierce' || sw === 'thrust' || sw === 'stab' || sw === 'stabL' ? 'puncture' : type === 'blunt' ? (Math.random() < 0.5 ? 'puncture' : 'crackmark') : 'gash';
    if (bt !== 'ember' && e.R.kind !== 'elem' && e.type !== 'wraith') {
      const w = this.wound(e, hit, swingDir || (kind === 'gash' ? new G.V3(Math.random() - 0.5, -0.4, Math.random() - 0.5) : null), kind === 'crackmark' && liquid ? 'puncture' : kind, bt === 'bone' || bt === 'stone' ? 'red' : bt);
      if (liquid) this.bleed(e, w, bt, crit || info.sneak);
    }
    if (!liquid) return false;
    // the squirt: blood sprays out of the wound along the surface normal and the direction of the blade
    const sd = swingDir ? swingDir.clone() : dir.clone(); const out = n.clone().multiplyScalar(0.8).addScaledVector(sd, 0.7); out.y += 0.35; out.normalize();
    this.squirt(P, out, bt, crit ? 30 : 18, crit ? 7.5 : 5.5, 0.35, crit ? 1.25 : 1);
    this.squirt(P, n.clone().setY(n.y + 0.5).normalize(), bt, crit ? 10 : 6, 3.2, 0.5, 0.8);
    this.mist(P, out, bt, crit ? 14 : 8);
    if (type === 'blunt') this.squirt(P, n.clone().setY(0.2).normalize(), bt, 10, 3, 1.2, 0.8);
    return true;
  },

  update(dt) {
    if (!this.mesh) return;
    const cam = G.camera.position, W = G.World, N = this.N, P = this.p, V = this.v, pos = this.pos, col = this.col;
    // emitters: arterial pulses then a slow drip
    for (let i = this.emitters.length - 1; i >= 0; i--) {
      const em = this.emitters[i]; em.t += dt;
      if (em.e.dead && em.e.death && em.e.death.removed || !em.w.joint.parent) { this.emitters.splice(i, 1); continue; }
      const wp = em.w.joint.localToWorld(em.w.local.clone()), wn = em.w.nLocal.clone().transformDirection(em.w.joint.matrixWorld).normalize();
      const beat = (em.t * (em.strong ? 2.6 : 3.2)) % 1, pulse = beat < 0.28 && em.t < em.dur;
      if (pulse) { const o = wn.clone(); o.y += 0.45; o.normalize(); this.squirt(wp, o, em.type, em.strong ? 4 : 2, em.strong ? 4.5 : 3, 0.16, 0.9); }
      em.nextDrip -= dt; if (em.nextDrip <= 0 && em.t < em.dur + 2.5) { em.nextDrip = 0.12 + Math.random() * 0.15; this.drop(wp.x, wp.y - 0.02, wp.z, wn.x * 0.3, -0.2, wn.z * 0.3, 0.014 + Math.random() * 0.01, this.shade(em.type), Math.random() < 0.3, 1.5); }
      if (em.t > em.dur + 2.5) this.emitters.splice(i, 1);
    }
    for (let i = 0; i < N; i++) {
      const o = i * 12;
      if (this.life[i] <= 0) { if (pos[o] !== 0 || pos[o + 1] !== -50) { for (let k = 0; k < 12; k += 3) { pos[o + k] = 0; pos[o + k + 1] = -50; pos[o + k + 2] = 0; } } continue; }
      this.life[i] -= dt;
      const j = i * 3, px = P[j], py = P[j + 1], pz = P[j + 2];
      V[j + 1] -= 13 * dt; V[j] *= 1 - dt * 0.4; V[j + 2] *= 1 - dt * 0.4;
      let nx = px + V[j] * dt, ny = py + V[j + 1] * dt, nz = pz + V[j + 2] * dt;
      if (ny <= (W.hc ? W.fy(nx, nz) : 0) + 0.015) { // hit the floor
        if (this.splat[i] && this.w[i] > 0.02) this.floorSplat(nx, nz, this.w[i] * (9 + Math.random() * 8), this.type || 'red', V[j], V[j + 2]), this.colorLast(i);
        this.life[i] = 0; continue;
      }
      if (W.W && W.isWall(nx, nz)) { // hit a wall: find which face
        if (this.splat[i] && this.w[i] > 0.016) { const cx = Math.floor(px / W.CS), cz = Math.floor(pz / W.CS), wx = Math.floor(nx / W.CS), wz = Math.floor(nz / W.CS); const fx = wx !== cx ? Math.sign(cx - wx) : 0, fz = wz !== cz ? Math.sign(cz - wz) : 0;
          if (fx || fz) { const sx = fx ? (fx > 0 ? (wx + 1) * W.CS : wx * W.CS) : nx, sz = fz ? (fz > 0 ? (wz + 1) * W.CS : wz * W.CS) : nz; this.wallSplat(sx, ny, sz, fx, fz, this.w[i] * (10 + Math.random() * 8), 'red'); this.colorLast(i); } }
        this.life[i] = 0; continue;
      }
      P[j] = nx; P[j + 1] = ny; P[j + 2] = nz;
      // camera-facing quad stretched along velocity
      const vx = V[j], vy = V[j + 1], vz = V[j + 2], sp = Math.hypot(vx, vy, vz) || 1, ax = vx / sp, ay = vy / sp, az = vz / sp;
      let tx = cam.x - nx, ty = cam.y - ny, tz = cam.z - nz; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      let sx = ay * tz - az * ty, sy = az * tx - ax * tz, sz = ax * ty - ay * tx; const sl = Math.hypot(sx, sy, sz) || 1; const w = this.w[i]; sx = sx / sl * w; sy = sy / sl * w; sz = sz / sl * w;
      const len = w * (1.6 + Math.min(5, sp * 0.55)), hx = ax * len * 0.25, hy = ay * len * 0.25, hz = az * len * 0.25, bx = ax * len * 0.75, by = ay * len * 0.75, bz = az * len * 0.75;
      pos[o] = nx - bx - sx; pos[o + 1] = ny - by - sy; pos[o + 2] = nz - bz - sz;
      pos[o + 3] = nx - bx + sx; pos[o + 4] = ny - by + sy; pos[o + 5] = nz - bz + sz;
      pos[o + 6] = nx + hx + sx; pos[o + 7] = ny + hy + sy; pos[o + 8] = nz + hz + sz;
      pos[o + 9] = nx + hx - sx; pos[o + 10] = ny + hy - sy; pos[o + 11] = nz + hz - sz;
      const c = i * 16, a = Math.min(1, this.life[i] * 3);
      for (let k = 0; k < 4; k++) { col[c + k * 4] = this.c[j]; col[c + k * 4 + 1] = this.c[j + 1]; col[c + k * 4 + 2] = this.c[j + 2]; col[c + k * 4 + 3] = a; }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true; this.mesh.geometry.attributes.color.needsUpdate = true;
    // decals: pools spread, everything fades late
    for (let i = this.decals.length - 1; i >= 0; i--) { const d = this.decals[i]; d.life -= dt; if (d.grow && d.s < 1) { d.s = Math.min(1, d.s + dt * 0.5); d.m.scale.setScalar(d.target * G.smooth(d.s)); } if (d.life < 4) d.m.material.opacity = Math.max(0, d.life / 4) * 0.95; if (d.life <= 0) { G.scene.remove(d.m); d.m.material.dispose(); this.decals.splice(i, 1); } }
  },
  // tint the decal that was just made with this droplet's own color
  colorLast(i) { const d = this.decals[this.decals.length - 1]; if (d) d.m.material.color.setRGB(this.c[i * 3] * 1.25, this.c[i * 3 + 1] * 1.25, this.c[i * 3 + 2] * 1.25); }
};
