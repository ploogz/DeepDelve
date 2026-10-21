/* ============================================================
   FX: particles, blood droplets, decals, telegraphs, lightning,
   shockwaves, damage numbers, debris physics, projectiles
   ============================================================ */
'use strict';
G.fx = {
  init() {
    if (this.ready) { this.reset(); return; }
    this.ready = true;
    const mk = (n, blending) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('col', new THREE.BufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
      const m = new THREE.ShaderMaterial({
        uniforms: { map: { value: G.tex.sprite(blending === THREE.AdditiveBlending ? 'spark' : 'smoke') }, pr: { value: G.renderer.getPixelRatio() } },
        vertexShader: 'attribute float size; attribute vec4 col; uniform float pr; varying vec4 vC; void main(){ vC=col; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*pr*(420.0/max(0.1,-mv.z)); gl_Position=projectionMatrix*mv; }',
        fragmentShader: 'uniform sampler2D map; varying vec4 vC; void main(){ vec4 t=texture2D(map,gl_PointCoord); gl_FragColor=vec4(vC.rgb*t.rgb, vC.a*t.a); if(gl_FragColor.a<0.01) discard; }',
        transparent: true, depthWrite: false, blending
      });
      const p = new THREE.Points(g, m); p.frustumCulled = false; G.scene.add(p);
      return { p, n, pos: new Float32Array(n * 3), vel: new Float32Array(n * 3), life: new Float32Array(n), max: new Float32Array(n), s0: new Float32Array(n), s1: new Float32Array(n), c0: new Float32Array(n * 4), c1: new Float32Array(n * 4), grav: new Float32Array(n), drag: new Float32Array(n), next: 0 };
    };
    this.add = mk(G.settings.quality === 'low' ? 1500 : G.settings.quality === 'med' ? 3500 : 10000, THREE.AdditiveBlending);
    this.norm = mk(G.settings.quality === 'low' ? 800 : G.settings.quality === 'med' ? 1800 : 5000, THREE.NormalBlending);
    // blood droplets (instanced, real volume)
    this.dropMax = G.settings.quality === 'high' ? 1500 : 500;
    this.drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0.1, emissive: 0x000000 }), this.dropMax);
    this.drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.drops.frustumCulled = false; this.drops.count = 0; G.scene.add(this.drops);
    this.dropData = []; this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new G.V3(); this._up = new G.V3(0, 1, 0);
    this.decals = []; this.decalMax = 160; this.tele = []; this.bolts = []; this.rings = []; this.bodies = []; this.nums = []; this.shakeAmt = 0; this.beams = [];
    this.numLayer = document.getElementById('dmgnums');
    G.gore.init();
    G.proj.init();
  },
  reset() {
    [this.add, this.norm].forEach(S => { S.life.fill(0); });
    this.dropData.length = 0; this.drops.count = 0;
    this.decals.forEach(d => G.scene.remove(d.m)); this.decals = [];
    this.tele.forEach(t => G.scene.remove(t.g)); this.tele = [];
    this.bolts.forEach(b => G.scene.remove(b.m)); this.bolts = [];
    this.rings.forEach(b => G.scene.remove(b.m)); this.rings = [];
    this.beams.forEach(b => G.scene.remove(b.g)); this.beams = [];
    this.bodies.forEach(b => b.o.parent && b.o.parent.remove(b.o)); this.bodies = [];
    this.nums.forEach(n => n.el.remove()); this.nums = [];
    (this.zones || []).forEach(Z => G.scene.remove(Z.g)); this.zones = []; Object.values(this.previews || {}).forEach(Z => G.scene.remove(Z.g)); this.previews = {};
    G.proj.reset(); G.gore.reset();
  },
  // core emitter
  emit(S, x, y, z, vx, vy, vz, life, s0, s1, c0, c1, grav = 0, drag = 0) {
    const i = S.next; S.next = (S.next + 1) % S.n;
    S.pos[i * 3] = x; S.pos[i * 3 + 1] = y; S.pos[i * 3 + 2] = z; S.vel[i * 3] = vx; S.vel[i * 3 + 1] = vy; S.vel[i * 3 + 2] = vz;
    S.life[i] = life; S.max[i] = life; S.s0[i] = s0; S.s1[i] = s1; S.grav[i] = grav; S.drag[i] = drag;
    for (let k = 0; k < 4; k++) { S.c0[i * 4 + k] = c0[k]; S.c1[i * 4 + k] = c1[k]; }
  },
  hex(c, a = 1, m = 1) { return [((c >> 16) & 255) / 255 * m, ((c >> 8) & 255) / 255 * m, (c & 255) / 255 * m, a]; },
  q() { return G.settings.quality === 'low' ? 0.45 : G.settings.quality === 'med' ? 0.75 : 1.6; },
  spark(p, color, n = 12, speed = 6, life = 0.5, size = 0.12, grav = 9) {
    const c = this.hex(color, 1, 1.6); n = Math.ceil(n * this.q());
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2, s = speed * (0.3 + Math.random() * 0.7);
      this.emit(this.add, p.x, p.y, p.z, Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s + speed * 0.3, Math.sin(a) * Math.cos(b) * s, life * (0.5 + Math.random() * 0.5), size, size * 0.2, c, [c[0], c[1] * 0.5, c[2] * 0.3, 0], grav, 1.5); }
  },
  burst(p, color, n = 30, speed = 5, size = 0.3) {
    const c = this.hex(color, 1, 1.4); n = Math.ceil(n * this.q());
    for (let i = 0; i < n; i++) { const v = new G.V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.6));
      this.emit(this.add, p.x, p.y, p.z, v.x, v.y, v.z, 0.5 + Math.random() * 0.6, size, 0, c, [c[0], c[1], c[2], 0], 0, 2.5); }
  },
  fire(p, n = 10, spread = 0.3, size = 0.45, up = 2.2) {
    n = Math.ceil(n * this.q());
    for (let i = 0; i < n; i++) this.emit(this.add, p.x + (Math.random() - 0.5) * spread, p.y + (Math.random() - 0.5) * spread * 0.5, p.z + (Math.random() - 0.5) * spread, (Math.random() - 0.5) * 0.6, up * (0.6 + Math.random() * 0.6), (Math.random() - 0.5) * 0.6, 0.35 + Math.random() * 0.4, size * (0.6 + Math.random() * 0.5), size * 0.15, [1.6, 0.9, 0.3, 1], [0.9, 0.12, 0.02, 0], -0.5, 0.8);
  },
  embers(p, n = 6, spread = 0.5) { n = Math.ceil(n * this.q()); for (let i = 0; i < n; i++) this.emit(this.add, p.x + (Math.random() - 0.5) * spread, p.y, p.z + (Math.random() - 0.5) * spread, (Math.random() - 0.5) * 1.5, 1 + Math.random() * 2.5, (Math.random() - 0.5) * 1.5, 1 + Math.random() * 1.5, 0.07, 0.02, [1.8, 0.8, 0.2, 1], [1, 0.2, 0, 0], -0.3, 0.5); },
  smoke(p, n = 6, color = 0x333333, size = 1.2, up = 1) {
    const c = this.hex(color, 0.55); n = Math.ceil(n * this.q());
    for (let i = 0; i < n; i++) this.emit(this.norm, p.x + (Math.random() - 0.5) * 0.4, p.y, p.z + (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.6, up * (0.4 + Math.random() * 0.6), (Math.random() - 0.5) * 0.6, 1.2 + Math.random() * 1.2, size * 0.4, size * 1.6, c, [c[0], c[1], c[2], 0], -0.2, 0.6);
  },
  mist(p, color, n = 8, size = 0.5, speed = 1.5) { const c = this.hex(color, 0.7); n = Math.ceil(n * this.q()); for (let i = 0; i < n; i++) this.emit(this.norm, p.x, p.y, p.z, (Math.random() - 0.5) * speed, (Math.random() - 0.2) * speed, (Math.random() - 0.5) * speed, 0.4 + Math.random() * 0.4, size * 0.3, size, c, [c[0], c[1], c[2], 0], 1, 2); },
  holy(p, n = 30, rad = 1) { n = Math.ceil(n * this.q()); for (let i = 0; i < n; i++) { const a = Math.random() * 7, r = Math.random() * rad; this.emit(this.add, p.x + Math.cos(a) * r, p.y + Math.random() * 0.5, p.z + Math.sin(a) * r, 0, 1.5 + Math.random() * 3, 0, 0.8 + Math.random() * 0.8, 0.2, 0.0, [1.8, 1.6, 0.9, 1], [1, 0.8, 0.3, 0], -0.5, 0.5); } },
  ice(p, n = 18, speed = 5) { n = Math.ceil(n * this.q()); for (let i = 0; i < n; i++) { const v = new G.V3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.3 + Math.random() * 0.7)); this.emit(this.add, p.x, p.y, p.z, v.x, v.y, v.z, 0.6 + Math.random() * 0.5, 0.16, 0.03, [0.8, 1.4, 1.8, 1], [0.3, 0.6, 1, 0], 9, 1); } this.mist(p, 0xc8eaff, 6, 1, 1); },

  /* blood: volumetric droplets that splat into decals */
  BLOOD: { red: [0x8a0000, 0x5a0000], rot: [0x4a3a08, 0x2a1a04], bone: [0xd8ccb0, 0x8a8070], ichor: [0x50c020, 0x2a6a10], ecto: [0x60d0ff, 0x2070a0], ember: [0xff6010, 0x501000], stone: [0x8a8a8a, 0x505050] },
  blood(p, dir, amount = 12, type = 'red', spray = 1) {
    if (!G.settings.gore && (type === 'red' || type === 'rot')) type = 'stone';
    if (G.gore.liquid(type)) { // streaked squirts, no round droplets
      const d = new G.V3(dir.x, dir.y + 0.35, dir.z); if (d.lengthSq() < 0.01) d.set(0, 1, 0); d.normalize();
      G.gore.squirt(p, d, type, Math.ceil(amount * 1.1 * Math.min(1.4, this.q())), 3.5 + spray * 2, 0.35 + spray * 0.35); G.gore.mist(p, d, type, Math.ceil(amount * 0.4)); return;
    }
    const [c1, c2] = this.BLOOD[type] || this.BLOOD.red, n = Math.ceil(amount * this.q());
    const isBlood = type === 'red' || type === 'rot' || type === 'ichor' || type === 'ecto';
    for (let i = 0; i < n; i++) {
      if (this.dropData.length >= this.dropMax) this.dropData.shift();
      const v = new G.V3(dir.x + (Math.random() - 0.5) * spray, dir.y + Math.random() * 0.9 + 0.2, dir.z + (Math.random() - 0.5) * spray).normalize().multiplyScalar(2.5 + Math.random() * 5);
      this.dropData.push({ p: p.clone().add(new G.V3((Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.15)), v, s: 0.6 + Math.random() * 1.4, c: new THREE.Color(Math.random() < 0.5 ? c1 : c2), type, life: 3, splat: isBlood && Math.random() < 0.35 });
    }
    if (type === 'ember') { this.fire(p, 8, 0.3, 0.35); this.embers(p, 10); }
    else if (type === 'bone') { this.mist(p, 0xd8ccb0, 6, 0.6, 2); }
    else if (type === 'stone') { this.mist(p, 0x8a8a8a, 6, 0.7, 2); }
    else if (type === 'ecto') { this.burst(p, 0x60d0ff, 10, 3, 0.25); }
    else this.mist(p, c2, 5, 0.45, 2.5);
  },
  // decals on floor
  decal(kind, x, z, size = 1.5, color, life = 40, y = 0.02) {
    const map = G.tex.sprite(kind);
    const mat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 - this.decals.length % 4, color: color !== undefined ? color : 0xffffff, opacity: 0.95, blending: kind === 'frost' || kind === 'rune' || kind === 'acid' ? THREE.AdditiveBlending : THREE.NormalBlending });
    const m = new THREE.Mesh(this._dg || (this._dg = new THREE.PlaneGeometry(1, 1)), mat);
    m.rotation.set(-Math.PI / 2, 0, Math.random() * 6.28); m.position.set(x, y + Math.random() * 0.005, z); m.scale.setScalar(size * 0.3); m.renderOrder = G.decalOrder();
    G.scene.add(m); const d = { m, life, max: life, grow: size, s: size * 0.3, kind };
    this.decals.push(d); if (this.decals.length > this.decalMax) { const o = this.decals.shift(); G.scene.remove(o.m); o.m.material.dispose(); }
    return d;
  },
  bloodPool(x, z, size, type = 'red') {
    if (!G.settings.gore && (type === 'red' || type === 'rot')) return;
    if (G.gore.liquid(type)) { G.gore.pool(x, z, size, type); return; }
    const col = { red: 0x9a0505, rot: 0x4a3a08, ichor: 0x40a018, ecto: 0x4ab0e0, ember: 0x1a0a05, bone: 0x6a6050, stone: 0x404040 }[type] || 0x9a0505;
    const d = this.decal(type === 'ember' ? 'scorch' : 'blood', x, z, size, col, 60); d.grow = size; d.s = size * 0.2; return d;
  },
  // telegraph rings: fill over delay then resolve
  telegraph(x, z, radius, delay, color = 0xff2a10, cone) {
    const g = new THREE.Group(); g.position.set(x, 0.05, z);
    const ring = new THREE.Mesh(this._dg || (this._dg = new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ map: G.tex.sprite('ring'), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
    ring.rotation.x = -Math.PI / 2; ring.scale.setScalar(radius * 2); g.add(ring);
    const fill = new THREE.Mesh(this._dg, new THREE.MeshBasicMaterial({ map: G.tex.sprite('disc'), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35 }));
    fill.rotation.x = -Math.PI / 2; fill.scale.setScalar(0.01); fill.position.y = 0.01; g.add(fill);
    G.scene.add(g); const t = { g, ring, fill, radius, delay: Math.max(0.05, delay), t: 0 }; this.tele.push(t); return t;
  },
  /* healing zones: a lit circle on the floor (glow disc, bright rim, turning rune), a soft pillar of light and
     rising motes, so everyone can see exactly where a heal lands and how wide it reaches. preview zones are
     persistent and dimmer (aiming / channelling); cast zones flare and fade. */
  zoneMat(sprite, color, op) { return new THREE.MeshBasicMaterial({ map: G.tex.sprite(sprite), color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending }); },
  makeZone(color) {
    const g = new THREE.Group(), dg = this._dg || (this._dg = new THREE.PlaneGeometry(1, 1));
    const flat = (sprite, op, y) => { const m = new THREE.Mesh(dg, this.zoneMat(sprite, color, op)); m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = 0.95; g.add(m); return m; };
    const disc = flat('disc', 0.32, 0.04), ring = flat('ring', 0.95, 0.05), rune = flat('rune', 0.55, 0.06);
    const colM = new THREE.ShaderMaterial({ uniforms: { c: { value: new THREE.Color(color) }, o: { value: 0.22 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying float vY; void main(){ vY=uv.y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 c; uniform float o; varying float vY; void main(){ float a=pow(1.0-vY,2.2)*o; gl_FragColor=vec4(c*a, a); }' });
    const col = new THREE.Mesh(this._zcol || (this._zcol = new THREE.CylinderGeometry(1, 1, 1, 40, 1, true)), colM); col.position.y = 1.4; col.renderOrder = 0.96; g.add(col);
    G.scene.add(g); return { g, disc, ring, rune, col, color };
  },
  setZone(z, x, zz, r, k, t) {
    z.g.position.set(x, 0, zz); z.g.visible = k > 0.01;
    const pulse = 1 + Math.sin(t * 5) * 0.04;
    z.disc.scale.setScalar(r * 2); z.ring.scale.setScalar(r * 2.1 * pulse); z.rune.scale.setScalar(r * 1.9); z.rune.rotation.z = t * 0.5;
    z.disc.material.opacity = 0.16 * k; z.ring.material.opacity = 0.8 * k; z.rune.material.opacity = 0.45 * k; z.col.material.uniforms.o.value = 0.14 * k; z.col.scale.set(r, 2.8, r);
  },
  healZone(x, z, r, dur = 1.1, color = 0xffc455) {
    const Z = this.makeZone(color); Z.x = x; Z.z = z; Z.r = r; Z.t = 0; Z.dur = dur; (this.zones || (this.zones = [])).push(Z);
    G.Lights.flash(new G.V3(x, 1.2, z), color, 2, Math.max(6, r * 3), dur);
    this.holy(new G.V3(x, 0.1, z), Math.round(10 + r * 6), r * 0.9);
  },
  // one persistent preview per key (e.g. the priest's aim); k = 0 hides it
  zonePreview(key, x, z, r, k, color = 0xffc455) {
    const P = this.previews || (this.previews = {}); let Z = P[key]; if (!Z) { if (k <= 0) return; Z = P[key] = this.makeZone(color); Z.k = 0; }
    Z.k = G.damp(Z.k, k, k > Z.k ? 10 : 6, 1 / 60); Z.x = x; Z.z = z; Z.r = G.damp(Z.r || r, r, 12, 1 / 60); Z.live = true;
  },
  shockwave(p, radius, color = 0xffc080, dur = 0.5) {
    const m = new THREE.Mesh(this._dg || (this._dg = new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ map: G.tex.sprite('ring'), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.12, p.z); G.scene.add(m); this.rings.push({ m, r: radius, t: 0, dur });
  },
  lightning(a, b, color = 0x9ad0ff, width = 1) {
    const pts = [], n = 10; for (let i = 0; i <= n; i++) { const t = i / n, p = a.clone().lerp(b, t); if (i && i < n) p.add(new G.V3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6)); pts.push(p); }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.035 * width, 4), new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    const core = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true }));
    const grp = new THREE.Group(); grp.add(tube); grp.add(core); G.scene.add(grp); this.bolts.push({ m: grp, t: 0.22 });
    G.Lights.flash(b, color, 5, 10, 0.25); this.spark(b, color, 10, 5, 0.4, 0.1);
  },
  beam(p, color = 0xffe08a, h = 14, r = 1.4, dur = 0.8) {
    const g = new THREE.Group(); g.position.copy(p);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, h, 24, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    c.position.y = h / 2; g.add(c);
    const c2 = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.4, r * 0.4, h, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); c2.position.y = h / 2; g.add(c2);
    G.scene.add(g); this.beams.push({ g, t: dur, dur });
    G.Lights.flash(new G.V3(p.x, 2, p.z), color, 8, 14, dur);
  },
  iceBlock(e) {
    if (e.iceMesh) return;
    const h = e.def.h * (e.scale || 1), r = e.def.r * 1.6;
    const g = M.rockGeo(1, 1, 0.18); g.scale(r, h * 0.62, r); g.translate(0, h * 0.5, 0);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xbfe8ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.45, emissive: 0x10304a, emissiveIntensity: 0.4, flatShading: true }));
    e.root.add(m); e.iceMesh = m; m.scale.setScalar(0.01); m.userData.grow = 0;
    G.sfx('ice', 0.8, e.pos); this.ice(new G.V3(e.pos.x, 1, e.pos.z), 14, 3);
    this.decal('frost', e.pos.x, e.pos.z, r * 2.6, 0x8acfff, 6);
  },
  removeIce(e, shatter) {
    if (!e.iceMesh) return; e.root.remove(e.iceMesh); e.iceMesh.geometry.dispose(); e.iceMesh = null;
    if (shatter) { this.ice(new G.V3(e.pos.x, 1, e.pos.z), 30, 6); G.sfx('shatter', 0.8, e.pos); this.chunks(new G.V3(e.pos.x, e.def.h * 0.5, e.pos.z), 10, 0xbfe8ff, 0.18, true); }
  },
  chunks(p, n, color, size = 0.15, ice) {
    const mat = ice ? new THREE.MeshStandardMaterial({ color, roughness: 0.05, transparent: true, opacity: 0.7, emissive: 0x2a6a9a, emissiveIntensity: 0.5, flatShading: true }) : G.mat('col', { c: color, r: 0.9 });
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(this._cg || (this._cg = new THREE.IcosahedronGeometry(1, 0)), mat); m.scale.setScalar(size * (0.5 + Math.random())); m.position.copy(p); G.scene.add(m);
      this.bodies.push({ o: m, v: new G.V3((Math.random() - 0.5) * 6, 2 + Math.random() * 5, (Math.random() - 0.5) * 6), av: new G.V3(Math.random() * 10, Math.random() * 10, 0), life: 2.5 + Math.random(), r: size, fade: true }); }
  },
  // detach parts of a rig into physics debris
  dismember(root, opts = {}) {
    const meshes = []; root.updateMatrixWorld(true); root.traverse(o => { if (o.isMesh && o.visible) meshes.push(o); });
    const cap = opts.max || 60; const pick = meshes.length > cap ? meshes.filter((_, i) => i % Math.ceil(meshes.length / cap) === 0) : meshes;
    pick.forEach(m => {
      const wp = new G.V3(), wq = new THREE.Quaternion(), ws = new G.V3(); m.matrixWorld.decompose(wp, wq, ws);
      m.parent.remove(m); m.position.copy(wp); m.quaternion.copy(wq); m.scale.copy(ws); G.scene.add(m);
      if (opts.mat) m.material = opts.mat;
      const out = new G.V3(wp.x - (opts.cx || wp.x), 0, wp.z - (opts.cz || wp.z)).normalize();
      this.bodies.push({ o: m, v: new G.V3(out.x * (1 + Math.random() * 3) + (opts.push ? opts.push.x : 0), (opts.up || 2) * Math.random() + 1, out.z * (1 + Math.random() * 3) + (opts.push ? opts.push.z : 0)), av: new G.V3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12), life: opts.life || 6, r: 0.06, fade: true, rest: 0 });
    });
    root.parent && root.parent.remove(root);
  },
  // flying body part (e.g., decapitated head) with blood trail
  flyPart(obj, vel, bloodType) {
    obj.updateMatrixWorld(true); const wp = new G.V3(), wq = new THREE.Quaternion(), ws = new G.V3(); obj.matrixWorld.decompose(wp, wq, ws);
    obj.parent.remove(obj); obj.position.copy(wp); obj.quaternion.copy(wq); obj.scale.copy(ws); G.scene.add(obj);
    this.bodies.push({ o: obj, v: vel, av: new G.V3(Math.random() * 8, Math.random() * 8, Math.random() * 8), life: 12, r: 0.12, trail: bloodType, fade: true, rest: 0 });
  },
  dmgNumber(p, amt, crit, color) {
    if (!this.numLayer) return;
    const el = document.createElement('div'); el.className = 'dnum' + (crit ? ' crit' : ''); el.textContent = Math.round(amt) + (crit ? '!' : '');
    if (color) el.style.color = color;
    this.numLayer.appendChild(el); this.nums.push({ el, p: p.clone(), t: 0, vx: (Math.random() - 0.5) * 1.2 });
    if (this.nums.length > 40) this.nums.shift().el.remove();
  },
  textPop(p, text, color) {
    if (!this.numLayer) return; const el = document.createElement('div'); el.className = 'dnum'; el.textContent = text; el.style.color = color || '#fff'; el.style.fontSize = '16px';
    this.numLayer.appendChild(el); this.nums.push({ el, p: p.clone(), t: 0, vx: 0 });
  },
  shake(a) { if (G.settings.shake) this.shakeAmt = Math.min(1.2, this.shakeAmt + a); },

  update(dt, t) {
    // healing zones
    if (this.zones) for (let i = this.zones.length - 1; i >= 0; i--) { const Z = this.zones[i]; Z.t += dt; const k = Math.min(1, Z.t / 0.12) * (1 - G.smooth(G.clamp((Z.t - Z.dur + 0.4) / 0.4, 0, 1)));
      this.setZone(Z, Z.x, Z.z, Z.r * (0.85 + 0.15 * Math.min(1, Z.t / 0.25)), k, t);
      if (Math.random() < dt * (20 + Z.r * 8) && k > 0.3) { const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * Z.r; this.emit(this.add, Z.x + Math.cos(a) * d, 0.1, Z.z + Math.sin(a) * d, 0, 1.4 + Math.random(), 0, 0.9, 0.14, 0.02, [1.8, 1.5, 0.7, 1], [1.2, 0.9, 0.3, 0]); }
      if (Z.t >= Z.dur) { G.scene.remove(Z.g); this.zones.splice(i, 1); } }
    if (this.previews) for (const key in this.previews) { const Z = this.previews[key]; if (!Z.live) Z.k = G.damp(Z.k, 0, 6, dt); Z.live = false; this.setZone(Z, Z.x, Z.z, Z.r, Z.k, t);
      if (Z.k > 0.3 && Math.random() < dt * (6 + Z.r * 2)) { const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * Z.r; this.emit(this.add, Z.x + Math.cos(a) * d, 0.1, Z.z + Math.sin(a) * d, 0, 0.9, 0, 0.8, 0.1, 0.02, [1.4, 1.2, 0.5, 0.8 * Z.k], [1, 0.7, 0.2, 0]); } }
    // particles
    [this.add, this.norm].forEach(S => {
      const P = S.p.geometry.attributes.position.array, C = S.p.geometry.attributes.col.array, Z = S.p.geometry.attributes.size.array;
      for (let i = 0; i < S.n; i++) {
        if (S.life[i] <= 0) { Z[i] = 0; continue; }
        S.life[i] -= dt; const k = 1 - Math.max(0, S.life[i]) / S.max[i], dr = Math.max(0, 1 - S.drag[i] * dt);
        S.vel[i * 3] *= dr; S.vel[i * 3 + 1] = S.vel[i * 3 + 1] * dr - S.grav[i] * dt; S.vel[i * 3 + 2] *= dr;
        S.pos[i * 3] += S.vel[i * 3] * dt; S.pos[i * 3 + 1] += S.vel[i * 3 + 1] * dt; S.pos[i * 3 + 2] += S.vel[i * 3 + 2] * dt;
        if (S.pos[i * 3 + 1] < 0.02 && S.grav[i] > 0) { S.pos[i * 3 + 1] = 0.02; S.vel[i * 3 + 1] *= -0.3; }
        P[i * 3] = S.pos[i * 3]; P[i * 3 + 1] = S.pos[i * 3 + 1]; P[i * 3 + 2] = S.pos[i * 3 + 2];
        for (let c = 0; c < 4; c++) C[i * 4 + c] = S.c0[i * 4 + c] + (S.c1[i * 4 + c] - S.c0[i * 4 + c]) * k;
        Z[i] = S.s0[i] + (S.s1[i] - S.s0[i]) * k;
      }
      S.p.geometry.attributes.position.needsUpdate = S.p.geometry.attributes.col.needsUpdate = S.p.geometry.attributes.size.needsUpdate = true;
    });
    // droplets
    let n = 0; const D = this.dropData;
    for (let i = D.length - 1; i >= 0; i--) {
      const d = D[i]; d.life -= dt; d.v.y -= 16 * dt; d.p.addScaledVector(d.v, dt);
      if (d.p.y < 0.02 || d.life <= 0) {
        if (d.splat && d.p.y < 0.1) this.decal('blood', d.p.x, d.p.z, 0.25 + Math.random() * 0.4, d.c.getHex(), 30);
        D.splice(i, 1); continue;
      }
      if (G.World.isWall && G.World.grid && G.World.W && G.World.isWall(d.p.x, d.p.z)) { if (d.splat && Math.random() < 0.5) { /* wall splatter */ } D.splice(i, 1); continue; }
    }
    for (const d of D) { if (n >= this.dropMax) break; const sp = d.v.length(); this._q.setFromUnitVectors(this._up, this._s.copy(d.v).divideScalar(sp || 1)); this._s.set(d.s, d.s * (1 + Math.min(3, sp * 0.25)), d.s); this._m.compose(d.p, this._q, this._s); this.drops.setMatrixAt(n, this._m); this.drops.setColorAt(n, d.c); n++; }
    this.drops.count = n; this.drops.instanceMatrix.needsUpdate = true; if (this.drops.instanceColor) this.drops.instanceColor.needsUpdate = true;
    // decals: grow pools, fade
    for (let i = this.decals.length - 1; i >= 0; i--) { const d = this.decals[i]; d.life -= dt; if (d.s < d.grow) { d.s = Math.min(d.grow, d.s + dt * d.grow * 0.6); d.m.scale.setScalar(d.s); } if (d.life < 3) d.m.material.opacity = Math.max(0, d.life / 3) * 0.95; if (d.life <= 0) { G.scene.remove(d.m); d.m.material.dispose(); this.decals.splice(i, 1); } }
    // telegraphs
    for (const tg of this.tele) { tg.t += dt; const k = Math.min(1, tg.t / tg.delay); tg.fill.scale.setScalar(Math.max(0.01, tg.radius * 2 * k)); tg.ring.material.opacity = 0.6 + Math.sin(t * 18) * 0.3; }
    // bolts, rings, beams
    for (let i = this.bolts.length - 1; i >= 0; i--) { const b = this.bolts[i]; b.t -= dt; b.m.children.forEach(c => c.material.opacity = Math.max(0, b.t / 0.22)); if (b.t <= 0) { G.scene.remove(b.m); b.m.children.forEach(c => { c.geometry.dispose(); c.material.dispose(); }); this.bolts.splice(i, 1); } }
    for (let i = this.rings.length - 1; i >= 0; i--) { const r = this.rings[i]; r.t += dt; const k = r.t / r.dur; r.m.scale.setScalar(r.r * 2 * G.smooth(Math.min(1, k))); r.m.material.opacity = 1 - k; if (k >= 1) { G.scene.remove(r.m); r.m.material.dispose(); this.rings.splice(i, 1); } }
    for (let i = this.beams.length - 1; i >= 0; i--) { const b = this.beams[i]; b.t -= dt; const k = b.t / b.dur; b.g.children.forEach(c => c.material.opacity = k * 0.8); b.g.scale.set(k, 1, k); if (b.t <= 0) { G.scene.remove(b.g); this.beams.splice(i, 1); } }
    // debris bodies
    for (let i = this.bodies.length - 1; i >= 0; i--) {
      const b = this.bodies[i]; b.life -= dt;
      if (!b.rest) {
        b.v.y -= 15 * dt; b.o.position.addScaledVector(b.v, dt);
        b.o.rotation.x += b.av.x * dt; b.o.rotation.y += b.av.y * dt; b.o.rotation.z += b.av.z * dt;
        if (G.World.W && G.World.isWall(b.o.position.x, b.o.position.z)) { b.o.position.x -= b.v.x * dt; b.o.position.z -= b.v.z * dt; b.v.x *= -0.4; b.v.z *= -0.4; }
        if (b.o.position.y < b.r) { b.o.position.y = b.r; if (Math.abs(b.v.y) < 1.2) { b.rest = 1; if (b.trail) this.bloodPool(b.o.position.x, b.o.position.z, 1.0, b.trail); } b.v.y *= -0.35; b.v.x *= 0.6; b.v.z *= 0.6; b.av.multiplyScalar(0.5); }
        if (b.trail && Math.random() < 0.6) this.blood(b.o.position, new G.V3(0, -0.5, 0), 1, b.trail, 0.3);
      }
      if (b.life < 1.5 && b.fade) b.o.position.y -= dt * 0.15;
      if (b.life <= 0) { G.scene.remove(b.o); this.bodies.splice(i, 1); }
    }
    // damage numbers
    if (G.camera) for (let i = this.nums.length - 1; i >= 0; i--) {
      const d = this.nums[i]; d.t += dt; d.p.y += dt * 1.4; d.p.x += d.vx * dt;
      const v = G.tmpV.copy(d.p).project(G.camera);
      if (v.z > 1 || d.t > 1.1) { d.el.style.display = v.z > 1 && d.t <= 1.1 ? 'none' : d.el.style.display; if (d.t > 1.1) { d.el.remove(); this.nums.splice(i, 1); } continue; }
      d.el.style.display = ''; d.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * innerWidth}px, ${(-v.y * 0.5 + 0.5) * innerHeight}px) translate(-50%,-50%) scale(${1 + Math.max(0, 0.3 - d.t) * 2})`; d.el.style.opacity = Math.min(1, (1.1 - d.t) * 3);
    }
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.5);
    G.gore.update(dt);
    G.proj.update(dt, t);
  }
};

/* ============================================================
   Projectiles (visuals for everyone, hit logic by owner)
   ============================================================ */
G.proj = {
  list: [],
  init() { this.list = []; },
  reset() { this.list.forEach(p => G.scene.remove(p.m)); this.list = []; },
  mesh(kind, tier) {
    const g = new THREE.Group();
    if (kind === 'arrow' || kind === 'parrow' || kind === 'frostarrow') { const a = M.weapon.arrow(tier || 0); g.add(a); if (kind === 'frostarrow') M.P(g, M.ico(0.08, 1), G.mat('emissive', { c: 0x80d8ff, i: 3 }), [0, 0, 0.4]); }
    else if (kind === 'knife') { const d = M.weapon.dagger(tier || 0); d.rotation.x = Math.PI / 2; g.add(d); }
    else if (kind === 'axe') { const a = M.weapon.axe(1, false); a.rotation.x = Math.PI / 2; a.scale.setScalar(1.3); g.add(a); }
    else {
      const col = { fireball: 0xff6a10, firebolt: 0xff7a20, soul: 0x60ff90, web: 0xf0f0f0, acid: 0x80ff40, lightning: 0x9ad0ff, holy: 0xffe08a }[kind] || 0xffffff;
      const sz = kind === 'web' ? 0.18 : kind === 'firebolt' ? 0.16 : 0.22;
      M.P(g, M.ico(sz, 2), kind === 'web' ? G.mat('col', { c: 0xf0f0f0, r: 1 }) : G.mat('emissive', { c: col, i: 3 }));
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.tex.sprite('glow'), color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.scale.setScalar(sz * 7); g.add(s);
      g.userData.col = col;
    }
    return g;
  },
  // o: {kind, pos, dir, speed, owner:'me'|'enemy'|'remote', dmg, dtype, homing, target, splash, burn, slow, freeze, pierce, tier, life}
  spawn(o) {
    const m = this.mesh(o.kind, o.tier); m.position.copy(o.pos); G.scene.add(m);
    const p = Object.assign({ life: 3, r: 0.25, hit: new Set() }, o, { m, vel: o.dir.clone().normalize().multiplyScalar(o.speed), t: 0, origin: o.pos.clone() });
    m.lookAt(G.tmpV.copy(o.pos).add(p.vel)); this.list.push(p); return p;
  },
  update(dt, t) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i]; p.t += dt; p.life -= dt;
      if (p.homing && p.owner === 'enemy' && G.player && !G.player.dead) { const to = G.tmpV.set(G.player.pos.x - p.m.position.x, 1.3 - p.m.position.y, G.player.pos.z - p.m.position.z).normalize().multiplyScalar(p.speed); p.vel.lerp(to, Math.min(1, p.homing * dt)); }
      if (p.kind === 'arrow' || p.kind === 'parrow' || p.kind === 'frostarrow' || p.kind === 'knife') p.vel.y -= 2.5 * dt;
      p.m.position.addScaledVector(p.vel, dt);
      if (p.kind === 'axe' || p.kind === 'knife') { p.m.children[0].rotation.z += dt * 18; } else p.m.lookAt(G.tmpV.copy(p.m.position).add(p.vel));
      // trails
      const pos = p.m.position;
      if (p.kind === 'fireball' || p.kind === 'firebolt') { G.fx.fire(pos, 2, 0.15, 0.4, 0.5); if (Math.random() < 0.3) G.fx.smoke(pos, 1, 0x222222, 0.6, 0.3); }
      else if (p.kind === 'soul') G.fx.emit(G.fx.add, pos.x, pos.y, pos.z, 0, 0.3, 0, 0.5, 0.35, 0, [0.4, 1.6, 0.6, 1], [0.1, 0.5, 0.2, 0]);
      else if (p.kind === 'frostarrow') G.fx.emit(G.fx.add, pos.x, pos.y, pos.z, 0, 0, 0, 0.4, 0.25, 0, [0.6, 1.2, 1.8, 1], [0.2, 0.5, 1, 0]);
      else if (p.kind === 'acid') G.fx.emit(G.fx.add, pos.x, pos.y, pos.z, 0, -0.3, 0, 0.4, 0.25, 0, [0.5, 1.6, 0.2, 1], [0.2, 0.6, 0, 0]);
      let done = p.life <= 0 || pos.y < 0;
      if (!done && G.World.W && G.World.isWall(pos.x, pos.z)) { done = true; this.impact(p, true); }
      if (!done && p.owner === 'me' && G.World.breakables) for (const b of G.World.breakables) { if (!b.broken && pos.y < 1.2 && G.dist2(pos.x, pos.z, b.x, b.z) < (b.rad + p.r) ** 2) { G.game.breakObj(b, true, G.player.pos); if (!p.pierce) { done = true; this.impact(p, false); } break; } }
      if (!done && p.owner === 'me') {
        for (const e of G.enemies.list) {
          if (e.dead || p.hit.has(e.id)) continue; const hy = e.def.fly ? 1.4 : e.def.h * (e.scale || 1) * 0.5, rr = e.def.r * (e.scale || 1) + p.r;
          if (G.dist2(pos.x, pos.z, e.pos.x, e.pos.z) < rr * rr && Math.abs(pos.y - (e.pos.y + hy)) < Math.max(1.2, hy + 0.4)) {
            p.hit.add(e.id); G.combat.playerProjHit(p, e);
            if (!p.pierce || p.hit.size > p.pierce) { done = true; this.impact(p, false); break; }
          }
        }
      } else if (!done && p.owner === 'enemy' && G.player && !G.player.dead && !G.player.downed) {
        const pl = G.player; if (G.dist2(pos.x, pos.z, pl.pos.x, pl.pos.z) < (0.5 + p.r) ** 2 && pos.y < 2.2) { done = true; G.combat.enemyProjHitMe(p); this.impact(p, false); }
      } else if (!done && p.owner === 'remote') {
        for (const e of G.enemies.list) { if (e.dead) continue; const rr = e.def.r * (e.scale || 1) + p.r; if (G.dist2(pos.x, pos.z, e.pos.x, e.pos.z) < rr * rr) { done = true; this.impact(p, false); break; } }
      }
      if (done) { if (p.life <= 0 && (p.splash || p.kind === 'frostarrow') && p.owner === 'me') this.impact(p, true); G.scene.remove(p.m); this.list.splice(i, 1); }
    }
  },
  impact(p, wall) {
    const pos = p.m.position.clone(); if (pos.y < 0.2) pos.y = 0.2;
    if (p.kind === 'fireball' || p.kind === 'firebolt') { G.fx.fire(pos, 14, 0.6, 0.6, 2.5); G.fx.spark(pos, 0xff8030, 14, 6); G.fx.smoke(pos, 4, 0x222222, 1.2); G.Lights.flash(pos, 0xff6020, 5, 9, 0.35); G.sfx('boom', p.kind === 'fireball' ? 0.7 : 0.45, pos); G.sfx('fire', 0.5, pos); G.fx.decal('scorch', pos.x, pos.z, p.splash ? p.splash * 1.4 : 1.2, 0xffffff, 25); if (p.splash && p.owner === 'me') G.combat.splash(pos, p.splash, p.splashRoll ? p.splashRoll() : p.dmg * 0.6, 'fire', p); }
    else if (p.kind === 'soul') { G.fx.burst(pos, 0x60ff90, 16, 4, 0.3); G.sfx('magic', 0.5, pos); }
    else if (p.kind === 'web') { G.fx.decal('web', pos.x, pos.z, 2.2, 0xffffff, 8); G.sfx('web', 0.5, pos); }
    else if (p.kind === 'acid') { G.fx.decal('acid', pos.x, pos.z, 2, 0x80ff40, 6); }
    else if (p.kind === 'frostarrow') { G.fx.ice(pos, 30, 7); G.fx.decal('frost', pos.x, pos.z, 5, 0x9ad8ff, 10); G.Lights.flash(pos, 0x80d0ff, 5, 10, 0.4); G.sfx('shatter', 0.7, pos); G.sfx('frost', 0.8, pos); G.fx.shockwave(pos, 4, 0x9ad8ff); if (p.owner === 'me') G.combat.splash(pos, 3.5, p.splashRoll ? p.splashRoll() : p.dmg * 0.7, 'ice', Object.assign({}, p, { freeze: 1 })); }
    else if (wall) { G.fx.spark(pos, 0xffd090, 6, 3, 0.3, 0.06); G.sfx('thunk', 0.6, pos); if (p.owner === 'me') G.World.hitGateAt(pos.x + p.vel.x * 0.02, pos.z + p.vel.z * 0.02, 1); }
  }
};
