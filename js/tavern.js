/* ============================================================
   The Gilded Tankard: a tavern wing off the hideout
   - Bartender Ulla serves cheap drinks (they get you drunk) and top-shelf brews (a bonus for your next descent)
   - drinking plays in first person (the mug comes up to your face) and allies see you tip it back
   - drunk: the world sways and doubles, your feet wander, you hiccup, and push it far enough and you'll puke
   - three tavern games for gold: Liar's Dice, Knucklebones, and knife throwing at a board on the wall
   ============================================================ */
'use strict';
(() => {
  const T = G.tavern = { drunk: 0 };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const R = Math.random, V3 = (x, y, z) => new G.V3(x, y, z);

  /* ================= drinks ================= */
  T.DRINKS = [
    { id: 'water', name: 'Cup of Water', icon: '💧', cost: 0, pot: -1.5, vessel: 'cup', desc: 'Sobers you up a little. Ulla judges you silently.' },
    { id: 'ale', name: 'Mug of Ale', icon: '🍺', cost: 3, pot: 1, vessel: 'mug', liquid: 0xc88a2a, desc: 'House ale. Warm, flat, and cheap.' },
    { id: 'mead', name: 'Honey Mead', icon: '🍯', cost: 5, pot: 1.5, vessel: 'horn', liquid: 0xe0a840, desc: 'Sweet as a summer field and twice as dangerous.' },
    { id: 'grog', name: 'Pirate Grog', icon: '🏴', cost: 4, pot: 2, vessel: 'mug', liquid: 0x6a3a1a, desc: 'Rum, water and regret. Mostly rum.' },
    { id: 'shot', name: 'Firewhisky Shot', icon: '🔥', cost: 8, pot: 3, vessel: 'shot', liquid: 0xd06a10, desc: 'Goes down like a lit torch.' },
    { id: 'cure', name: 'Hangover Cure', icon: '🥚', cost: 12, pot: -99, vessel: 'cup', liquid: 0x9aa040, desc: 'Raw egg, pickle brine and something that moved. Instantly sober.' }
  ];
  T.BREWS = {
    stout: { name: 'Dwarven Stout', icon: '🛡', cost: 60, pot: 1.5, vessel: 'mug', liquid: 0x2a1a10, desc: '+20 maximum health on your next descent', ap: (m) => { m.hp += 20; } },
    giant: { name: "Giant's Grog", icon: '🦶', cost: 70, pot: 2, vessel: 'mug', liquid: 0x7a5a2a, desc: '+40 stamina and +8% movement speed on your next descent', ap: (m) => { m.sta += 40; m.speed += 0.08; } },
    moonwine: { name: 'Elven Moonwine', icon: '🌙', cost: 85, pot: 1.5, vessel: 'goblet', liquid: 0xb0c0ff, desc: '+6% critical chance and abilities recharge 10% faster on your next descent', ap: (m) => { m.crit += 0.06; m.cdr += 0.1; } },
    dragon: { name: "Dragon's Breath Brandy", icon: '🐉', cost: 110, pot: 3, vessel: 'goblet', liquid: 0xff5a10, desc: '+15% damage on your next descent', ap: (m) => { m.dmg += 0.15; } },
    luck: { name: 'Liquid Luck', icon: '🍀', cost: 130, pot: 1, vessel: 'flask', liquid: 0xffd040, desc: '+25% gold and two lucky rerolls of a d20 on your next descent', ap: (m, P) => { m.greed += 0.25; P.luck = (P.luck || 0) + 2; } },
    absinthe: { name: 'Abyssal Absinthe', icon: '🧪', cost: 150, pot: 3.5, vessel: 'flask', liquid: 0x6aff6a, desc: '+25% experience on your next descent', ap: () => { } }
  };
  T.level = () => { const d = T.drunk; return d < 0.5 ? 'Sober' : d < 2 ? 'Tipsy' : d < 4 ? 'Merry' : d < 6 ? 'Drunk' : d < 8 ? 'Smashed' : 'Legless'; };
  T.amt = () => G.clamp(T.drunk / 7, 0, 1);

  /* ================= sounds ================= */
  const A = G.audio, play0 = A.play;
  const S = {
    gulp(o, t) { for (let i = 0; i < 2; i++) { const tt = t + i * 0.16; this.osc(o, tt, 180 + R() * 40, 90, 0.11, 0.55, 'sine', 0.01); this.nz(o, tt, 0.08, 500, 250, 3, 0.25, 'lowpass', 0.01); } },
    hic(o, t) { this.voice(o, t, 520 + R() * 80, 380, 0.09, 0.6, 1300); this.nz(o, t, 0.04, 2500, 1400, 2, 0.3); },
    burp(o, t) { const g = this.voice(o, t, 95 + R() * 25, 70, 0.55, 0.9, 420); this.trem && this.trem(g, t, 0.55, 28, 0.4); },
    aah(o, t) { this.voice(o, t, 210, 150, 0.5, 0.45, 800); },
    puke(o, t) { const g = this.voice(o, t, 140, 80, 0.4, 0.9, 520); this.trem && this.trem(g, t, 0.4, 18, 0.5); this.nz(o, t + 0.25, 0.9, 900, 300, 1, 0.9, 'lowpass', 0.05); this.nz(o, t + 0.9, 0.5, 600, 200, 1, 0.5, 'lowpass', 0.02); for (let i = 0; i < 6; i++) this.nz(o, t + 0.5 + i * 0.12, 0.05, 1500, 600, 3, 0.3); },
    pour(o, t) { this.nz(o, t, 0.9, 1800, 900, 1.5, 0.35, 'bandpass', 0.08); for (let i = 0; i < 8; i++) { const f = 500 + R() * 600; this.osc(o, t + i * 0.1, f, f * 1.5, 0.05, 0.12); } },
    clink(o, t) { this.ring(o, t, 2400 + R() * 400, [[1, 0.5, 0.5], [2.6, 0.3, 0.3], [4.1, 0.15, 0.2]], 0.3); },
    cheer(o, t) { for (let i = 0; i < 4; i++) this.voice(o, t + i * 0.05, 260 + R() * 160, 360 + R() * 160, 0.6, 0.25, 900 + R() * 400); },
    boo(o, t) { for (let i = 0; i < 3; i++) this.voice(o, t + i * 0.05, 200 + R() * 40, 140, 0.8, 0.25, 600); },
    knife(o, t) { this.nz(o, t, 0.14, 2600, 4800, 2, 0.4, 'bandpass', 0.02); }
  };
  A.play = function (name, vol = 1, pos) {
    const fn = S[name]; if (!fn) return play0.call(this, name, vol, pos);
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (pos && G.camera) { const cp = G.camera.position, d = Math.hypot(pos.x - cp.x, pos.z - cp.z); vol *= G.clamp(1.25 - d / 30, 0, 1); if (vol < 0.03) return; }
    fn.call(this, this.bus(vol, pos), this.ctx.currentTime + 0.005);
  };

  /* ================= models ================= */
  const TM = T.models = {
    // a cap of hair that hugs the skull: the hemisphere is tipped back so its front edge sits above the brows
    hair(head, mat) { return M.P(head, M.sph(0.136, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat, [0, 0.108, -0.012], [-0.5, 0, 0], [0.9, 1.0, 1.08]); },
    vessel(kind, liquid) {
      const g = new THREE.Group(), wood = G.mat('wood'), brass = G.mat('bronze') || G.mat('gold'), glass = G.mat('col', { c: 0xd8e8f0, tr: 0.35, r: 0.05 });
      const liq = liquid !== undefined ? G.mat('col', { c: liquid, r: 0.1, e: liquid, ei: 0.15 }) : G.mat('col', { c: 0x9ac0d8, tr: 0.7, r: 0.05 });
      if (kind === 'mug') { M.P(g, M.cyl(0.055, 0.05, 0.13, 16, 1, true), wood, [0, 0.065, 0]); M.P(g, M.cyl(0.05, 0.05, 0.005, 16), wood, [0, 0.002, 0]); [0.02, 0.11].forEach(y => M.P(g, M.cyl(0.058, 0.058, 0.012, 16), G.mat('iron'), [0, y, 0])); M.P(g, M.tor(0.035, 0.009, 6, 12, Math.PI), wood, [0.06, 0.065, 0], [0, 0, -Math.PI / 2]); M.P(g, M.cyl(0.049, 0.047, 0.12, 16, 1, true), G.mat('col', { c: 0x2a180c, r: 0.9, ds: true }), [0, 0.065, 0]); g.liq = M.P(g, M.cyl(0.05, 0.05, 0.004, 16), liq, [0, 0.115, 0]); g.foam = M.P(g, M.sph(0.05, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), G.mat('col', { c: 0xf2ead8, r: 1 }), [0, 0.118, 0], 0, [1, 0.35, 1]); }
      else if (kind === 'horn') { M.P(g, M.tube([0, 0, 0, 0.02, 0.08, 0.01, 0.0, 0.17, 0.04], 0.03, 12, 10), G.mat('col', { c: 0xd8c8a0, r: 0.5 }), [0, 0, 0]); M.P(g, M.cyl(0.04, 0.04, 0.02, 14), brass, [0, 0.17, 0.04]); g.liq = M.P(g, M.cyl(0.035, 0.035, 0.004, 14), liq, [0, 0.175, 0.04]); }
      else if (kind === 'shot') { M.P(g, M.cyl(0.028, 0.022, 0.06, 14, 1, true), glass, [0, 0.03, 0]); g.liq = M.P(g, M.cyl(0.024, 0.021, 0.04, 14), liq, [0, 0.022, 0]); }
      else if (kind === 'goblet') { M.P(g, M.lathe([0, 0, 0.05, 0.005, 0.012, 0.02, 0.008, 0.08, 0.045, 0.11, 0.055, 0.18], 18), brass, [0, 0, 0]); g.liq = M.P(g, M.cyl(0.05, 0.05, 0.004, 16), liq, [0, 0.165, 0]); M.P(g, M.ico(0.01, 0), G.mat('col', { c: 0xc02030, r: 0.1 }), [0.04, 0.12, 0.025]); }
      else if (kind === 'flask') { M.P(g, M.lathe([0, 0, 0.055, 0.01, 0.06, 0.06, 0.03, 0.11, 0.018, 0.13, 0.02, 0.18], 18), glass, [0, 0, 0]); g.liq = M.P(g, M.sph(0.052, 16, 10), liq, [0, 0.055, 0], 0, [1, 0.9, 1]); M.P(g, M.cyl(0.016, 0.014, 0.025, 10), G.mat('wood'), [0, 0.19, 0]); }
      else { M.P(g, M.cyl(0.04, 0.035, 0.1, 14, 1, true), G.mat('col', { c: 0x8a7a6a, t: 'rock' }), [0, 0.05, 0]); g.liq = M.P(g, M.cyl(0.036, 0.036, 0.004, 14), liq, [0, 0.085, 0]); }
      g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
      return g;
    },
    stool() { const g = new THREE.Group(), w = G.mat('wood'); M.P(g, M.cyl(0.24, 0.24, 0.06, 18), w, [0, 0.55, 0]); for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; M.P(g, M.cyl(0.025, 0.03, 0.56, 8), w, [Math.cos(a) * 0.16, 0.27, Math.sin(a) * 0.16], [Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12]); } M.P(g, M.tor(0.15, 0.012, 6, 18), w, [0, 0.2, 0], [Math.PI / 2, 0, 0]); return g; },
    roundTable() { const g = new THREE.Group(), w = G.mat('wood'); M.P(g, M.cyl(1.0, 1.0, 0.08, 32), w, [0, 0.78, 0]); M.P(g, M.cyl(1.02, 1.0, 0.03, 32), G.mat('col', { c: 0x3a2412, t: 'wood' }), [0, 0.73, 0]); M.P(g, M.cyl(0.1, 0.14, 0.72, 12), w, [0, 0.38, 0]); for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; M.P(g, M.box(0.08, 0.06, 0.6), w, [Math.cos(a) * 0.28, 0.04, Math.sin(a) * 0.28], [0, -a + Math.PI / 2, 0]); } return g; },
    diceCup() { const g = new THREE.Group(); M.P(g, M.cyl(0.07, 0.06, 0.15, 16, 1, true), G.mat('col', { c: 0x5a2a14, t: 'leather' }), [0, 0.075, 0]); M.P(g, M.cyl(0.072, 0.072, 0.015, 16), G.mat('bronze') || G.mat('gold'), [0, 0.145, 0]); return g; },
    die(v = 1) { const g = new THREE.Group(); M.P(g, M.box(0.04, 0.04, 0.04), G.mat('col', { c: 0xf2ead8, r: 0.4 }), [0, 0.02, 0]); g.rotation.y = R() * 6; return g; },
    bottle(c) { const g = new THREE.Group(), m = G.mat('col', { c, tr: 0.25, r: 0.08, e: c, ei: 0.08 }); M.P(g, M.lathe([0, 0, 0.06, 0.005, 0.065, 0.18, 0.04, 0.23, 0.02, 0.26, 0.02, 0.32], 14), m, [0, 0, 0]); M.P(g, M.cyl(0.022, 0.02, 0.03, 8), G.mat('wood'), [0, 0.33, 0]); M.P(g, M.box(0.08, 0.06, 0.002), G.mat('col', { c: 0xe8dcb8 }), [0, 0.11, 0.063]); return g; },
    keg() { const g = new THREE.Group(), b = M.prop.barrel(); b.rotation.z = Math.PI / 2; b.scale.setScalar(0.85); g.add(b); M.P(g, M.box(1.0, 0.08, 0.9), G.mat('wood'), [0, -0.05, 0]); const tap = M.G(g, [0, 0.35, 0.46]); M.P(tap, M.cyl(0.02, 0.02, 0.14, 8), G.mat('bronze') || G.mat('gold'), [0, 0, 0.06], [Math.PI / 2, 0, 0]); M.P(tap, M.cyl(0.015, 0.015, 0.1, 8), G.mat('wood'), [0, 0.07, 0.12]); return g; },
    lantern() { const g = new THREE.Group(); M.P(g, M.cyl(0.008, 0.008, 0.9, 6), G.mat('iron'), [0, 0.45, 0]); M.P(g, M.cyl(0.09, 0.11, 0.04, 8), G.mat('iron'), [0, 0.02, 0]); M.P(g, M.cyl(0.08, 0.08, 0.2, 8, 1, true), G.mat('col', { c: 0xffd890, tr: 0.4, e: 0xffa040, ei: 1.4 }), [0, -0.1, 0]); M.P(g, M.cyl(0.1, 0.09, 0.03, 8), G.mat('iron'), [0, -0.22, 0]); g.userData.light = { pos: new THREE.Vector3(0, -0.1, 0), color: 0xffa040, intensity: 1.7, dist: 9 }; return g; },
    dartboard() {
      const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'), C = 256;
      const ring = (r, col) => { x.beginPath(); x.arc(C, C, r, 0, Math.PI * 2); x.fillStyle = col; x.fill(); };
      ring(256, '#2a1a10'); for (let i = 0; i < 20; i++) { x.beginPath(); x.moveTo(C, C); x.arc(C, C, 205, i / 20 * Math.PI * 2, (i + 1) / 20 * Math.PI * 2); x.fillStyle = i % 2 ? '#e8dcb8' : '#1a1410'; x.fill(); }
      const band = (r0, r1) => { for (let i = 0; i < 20; i++) { x.beginPath(); x.arc(C, C, r1, i / 20 * Math.PI * 2, (i + 1) / 20 * Math.PI * 2); x.arc(C, C, r0, (i + 1) / 20 * Math.PI * 2, i / 20 * Math.PI * 2, true); x.fillStyle = i % 2 ? '#2a7a3a' : '#b02020'; x.fill(); } };
      band(190, 205); band(110, 125); ring(42, '#2a7a3a'); ring(17, '#b02020');
      x.strokeStyle = '#c8b070'; x.lineWidth = 2; [17, 42, 110, 125, 190, 205].forEach(r => { x.beginPath(); x.arc(C, C, r, 0, Math.PI * 2); x.stroke(); });
      x.fillStyle = '#e8dcb8'; x.font = 'bold 28px Georgia'; x.textAlign = 'center'; x.textBaseline = 'middle'; [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5].forEach((n, i) => { const a = (i / 20) * Math.PI * 2 - Math.PI / 2 + Math.PI / 20 - Math.PI / 20; x.fillText(n, C + Math.cos(a) * 232, C + Math.sin(a) * 232); });
      const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
      const g = new THREE.Group(); M.P(g, M.cyl(0.8, 0.8, 0.06, 40), G.mat('col', { c: 0x3a2412, t: 'wood' }), [0, 0, -0.03], [Math.PI / 2, 0, 0]);
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.75, 48), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 })); face.position.z = 0.002; g.add(face);
      return g;
    },
    // a stocky bartender with an apron, a fine moustache and a mug she's always polishing
    bartender() {
      const R = M.humanoid({ top: G.mat('col', { c: 0xd8cfc0, t: 'cloth' }), bottom: G.mat('col', { c: 0x3a2a20, t: 'cloth' }), bulk: 1.25, skin: G.mat('col', { c: 0xe0a888, t: 'skin' }), brow: 0x8a3a1a });
      const apron = G.mat('col', { c: 0x6a4a2a, t: 'leather' });
      M.P(R.torso, M.box(0.36, 0.42, 0.02), apron, [0, 0.12, 0.155]); M.P(R.hips, M.box(0.4, 0.5, 0.02), apron, [0, -0.2, 0.17]);
      TM.hair(R.head, G.mat('col', { c: 0xa8401a, r: 1 }));
      M.P(R.head, M.sph(0.06, 12, 10), G.mat('col', { c: 0xa8401a, r: 1 }), [0, 0.17, -0.13]);   // bun
      R.mug = TM.vessel('mug', 0xc88a2a); R.mug.position.set(0, -0.06, 0.05); R.armR.hand.add(R.mug);
      const rag = M.P(R.armL.hand, M.box(0.12, 0.02, 0.16), G.mat('col', { c: 0xe8e0d0, t: 'cloth' }), [0, -0.05, 0.04]);
      R.armPose = (R, st) => { const t = st.t, act = R._act || 'wipe', k = R._actT || 0;
        if (act === 'pour') { R.armR.sh.rotation.set(-1.25, 0.2, -0.3); R.armR.el.rotation.set(-0.6, 0, 0); R.armL.sh.rotation.set(-0.9, -0.3, 0.3); R.armL.el.rotation.set(-1.1, 0, 0); R.neck.rotation.x += 0.3; }
        else { R.armR.sh.rotation.set(-0.85, 0.3, -0.15); R.armR.el.rotation.set(-1.4, 0, 0); R.armL.sh.rotation.set(-0.9 + Math.sin(t * 5) * 0.12, -0.35 + Math.cos(t * 5) * 0.12, 0.25); R.armL.el.rotation.set(-1.3, 0, 0); R.neck.rotation.x += 0.25; } };
      R.light = { color: 0xffb060, intensity: 1.4, dist: 7 };
      return R;
    },
    patron(v) {
      const P = [{ top: 0x4a5a2a, bot: 0x3a3028, skin: 0xd8a888, hair: 0x2a1a10, beard: true, hat: 'hood' }, { top: 0x7a2a3a, bot: 0x2a2a3a, skin: 0xc89878, hair: 0x101010, hat: 'cap' }, { top: 0x5a4030, bot: 0x3a3a4a, skin: 0xd89a7a, hair: 0xb05a1a, beard: true, dwarf: true }][v % 3];
      const R = M.humanoid({ top: G.mat('col', { c: P.top, t: 'cloth' }), bottom: G.mat('col', { c: P.bot, t: 'cloth' }), skin: G.mat('col', { c: P.skin, t: 'skin' }), brow: P.hair, bulk: P.dwarf ? 1.35 : 1.05 });
      if (P.dwarf) { R.root.scale.set(0.95, 0.72, 0.95); R.head.scale.set(1.2, 1.45, 1.2); }
      if (P.beard) M.P(R.head, M.lathe([0, 0.08, 0.11, 0.06, 0.12, -0.02, 0.08, -0.12, 0.03, -0.2, 0, -0.21], 20), G.mat('col', { c: P.hair, r: 1 }), [0, -0.02, 0.05], 0, [1.05, 1, 0.65]);
      if (P.hat === 'hood') { const hm = G.mat('col', { c: 0x3a4a22, t: 'cloth', ds: true }); M.P(R.head, new THREE.SphereGeometry(0.152, 22, 14, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.66), hm, [0, 0.1, -0.012], 0, [0.98, 1.06, 1.08]); M.P(R.head, M.cyl(0.13, 0.17, 0.12, 18, 1, true), hm, [0, -0.06, -0.03]); }
      else if (P.hat === 'cap') { TM.hair(R.head, G.mat('col', { c: P.hair, r: 1 })); const cm = G.mat('col', { c: 0x2a2a3a, t: 'cloth' }); M.P(R.head, M.cyl(0.108, 0.122, 0.085, 20), cm, [0, 0.235, -0.008], [-0.12, 0, 0], [1, 1, 1.18]); M.P(R.head, M.cyl(0.19, 0.19, 0.01, 22), cm, [0, 0.2, -0.004], [-0.12, 0, 0], [1, 1, 1.08]); M.P(R.head, M.box(0.01, 0.13, 0.035), G.mat('col', { c: 0xc8a040 }), [0.11, 0.28, -0.02], [0, 0, -0.35]); }
      else TM.hair(R.head, G.mat('col', { c: P.hair, r: 1 }));
      R.mug = TM.vessel('mug', 0xc88a2a); R.mug.position.set(0, -0.06, 0.05); R.armL.hand.add(R.mug);
      // seated: thighs level, shins down, forearms on the table; gestures play on top
      R.extraAnim = (R, st) => {
        const t = st.t, act = R._act, k = R._actT || 0;
        R.hips.position.y = 0.6; R.body.position.set(0, 0, 0);
        R.legL.hip.rotation.set(-1.5, 0, 0.12); R.legR.hip.rotation.set(-1.5, 0, -0.12); R.legL.kn.rotation.set(1.45, 0, 0); R.legR.kn.rotation.set(1.5, 0, 0); R.legL.foot.rotation.set(0.05, 0, 0); R.legR.foot.rotation.set(0.05, 0, 0);
        R.torso.rotation.set(0.12 + Math.sin(t * 0.7) * 0.03, Math.sin(t * 0.4) * 0.08, 0);
        R.armL.sh.rotation.set(-0.85, 0, 0.18); R.armL.el.rotation.set(-1.0, 0, 0); R.armR.sh.rotation.set(-0.9, 0, -0.15); R.armR.el.rotation.set(-0.95, 0, 0);
        if (act === 'shake' && k > 0) { R.armR.sh.rotation.set(-1.4 + Math.sin(t * 26) * 0.18, 0, -0.2); R.armR.el.rotation.set(-1.2 + Math.sin(t * 26 + 1) * 0.2, 0, 0); }
        else if (act === 'point' && k > 0) { R.armR.sh.rotation.set(-1.6, -0.4, -0.1); R.armR.el.rotation.set(-0.1, 0, 0); R.neck.rotation.x -= 0.15; }
        else if (act === 'drink' && k > 0) { const p = Math.sin(Math.min(1, k) * Math.PI); R.armL.sh.rotation.set(-0.85 - p * 1.3, 0, 0.18 + p * 0.25); R.armL.el.rotation.set(-1.0 - p * 0.9, 0, 0); R.neck.rotation.x -= p * 0.45; }
        else if (act === 'cheer' && k > 0) { R.armR.sh.rotation.set(-2.7, 0, -0.3); R.armR.el.rotation.set(-0.3, 0, 0); R.armL.sh.rotation.set(-2.6, 0, 0.3); R.armL.el.rotation.set(-0.4, 0, 0); R.neck.rotation.x -= 0.25; R.torso.rotation.x -= 0.2; }
        if (R._sleep) { R.torso.rotation.set(0.95, 0, 0.1); R.neck.rotation.set(0.45, 0.6, 0.2); R.armL.sh.rotation.set(-1.3, 0.3, 0.5); R.armL.el.rotation.set(-1.9, 0, 0); R.armR.sh.rotation.set(-1.3, -0.3, -0.5); R.armR.el.rotation.set(-1.9, 0, 0); R.chest.rotation.x = Math.sin(t * 1.1) * 0.05; return; }
        else if (act === 'slam' && k > 0) { const p = Math.max(0, Math.sin(k * 9)); R.armR.sh.rotation.set(-1.7 + p * 0.9, 0, -0.2); R.armR.el.rotation.set(-0.4, 0, 0); R.torso.rotation.x += 0.15; }
      };
      return R;
    }
  };
  // patrons and the bartender gesture for a moment, then settle
  T.gesture = (R, act, dur = 1.4) => { if (!R) return; R._act = act; R._actT = dur; };
  T.tickNPCs = (dt) => {
    const Z = G.World.sleeper; if (Z && Math.random() < dt * 0.4) { const p = new G.V3(); Z.head.getWorldPosition(p); G.fx.textPop(p.add(new G.V3(0, 0.35, 0)), 'z', '#c8c0d8'); } (G.World.tavernNPCs || []).forEach(R => { if (R._actT > 0) { R._actT -= dt; if (R._actT <= 0) R._act = null; } if (Math.random() < dt * 0.04 && !R._act && !R._sleep && R !== G.World.bartender) T.gesture(R, 'drink', 1.8); }); };

  /* ================= the tavern wing ================= */
  G.World.buildTavern = function (o) {
    const CS = this.CS, grp = this.group, { Wm, TZ, TH, Hh, wallMat } = o;
    const x0 = CS, x1 = (Wm - 1) * CS, z0 = TZ * CS, z1 = (TZ + TH) * CS, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, CH = 4.6;
    // walls around the wing, a dark plank floor, a low beamed ceiling
    for (let z = TZ; z <= TZ + TH; z++) for (let x = 0; x < Wm; x++) if (!this.grid[z * this.W + x]) { const m = new THREE.Mesh(M.box(CS, Hh, CS), wallMat); m.position.set((x + 0.5) * CS, Hh / 2, (z + 0.5) * CS); grp.add(m); }
    const ft = G.tex.get('wood'), fm = new THREE.MeshStandardMaterial({ map: ft.map.clone(), normalMap: ft.normalMap.clone(), roughness: 0.6, color: 0x8a6448 });
    fm.map.repeat.set(Wm - 2, TH); fm.normalMap.repeat.set(Wm - 2, TH); fm.map.needsUpdate = fm.normalMap.needsUpdate = true;
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0 + CS), fm); fl.rotation.x = -Math.PI / 2; fl.position.set(cx, 0.001, cz - CS / 2); grp.add(fl);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), G.mat('col', { c: 0x2a1c12, t: 'wood' })); ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, CH, cz); grp.add(ceil);
    for (let x = x0 + 2; x < x1; x += 4) M.P(grp, M.box(0.3, 0.35, z1 - z0), G.mat('wood'), [x, CH - 0.17, cz]);
    for (let z = z0 + 3; z < z1; z += 6) M.P(grp, M.box(x1 - x0, 0.28, 0.28), G.mat('wood'), [cx, CH - 0.45, z]);
    // the doorway: a stone lintel with a hanging sign on both sides
    const dx = 2.5 * CS, dz = (o.Ht - 0.5) * CS, stone = G.mat('col', { c: 0x6a5a48, t: 'rock' });
    M.P(grp, M.box(CS, Hh - 3.2, CS), wallMat, [dx, 3.2 + (Hh - 3.2) / 2, dz]);
    M.mirror(s => M.P(grp, M.box(0.35, 3.3, CS + 0.1), stone, [dx + s * (CS / 2 - 0.1), 1.65, dz]));
    M.P(grp, M.box(CS + 0.2, 0.4, CS + 0.12), stone, [dx, 3.3, dz]);
    const sc = document.createElement('canvas'); sc.width = 512; sc.height = 160; const sx = sc.getContext('2d'); sx.fillStyle = '#2a1a10'; sx.fillRect(0, 0, 512, 160); sx.strokeStyle = '#d9b46a'; sx.lineWidth = 6; sx.strokeRect(8, 8, 496, 144);
    sx.fillStyle = '#e8c870'; sx.textAlign = 'center'; sx.font = '600 50px "Cinzel", Georgia, serif'; sx.fillText('The Gilded', 256, 66); sx.fillText('Tankard', 256, 124);
    const sm = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(sc), roughness: 0.8 });
    [[-1, Math.PI], [1, 0]].forEach(([s, ry]) => { const sg = M.G(grp, [dx, 4.1, dz + s * (CS / 2 + 0.06)]); sg.rotation.y = ry; const p = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.75), sm); sg.add(p); });
    // the bar: a long counter down the east side, kegs and bottle shelves behind it, stools in front
    const bx = x1 - 7, bz0 = z0 + 3.2, bz1 = z1 - 3.4, bl = bz1 - bz0, bcz = (bz0 + bz1) / 2, dark = G.mat('col', { c: 0x3a2214, t: 'wood' }), top = G.mat('col', { c: 0x7a4a26, t: 'wood', r: 0.35 });
    const bar = new THREE.Group(); M.P(bar, M.box(0.9, 1.06, bl), dark, [0, 0.53, 0]); M.P(bar, M.box(1.1, 0.07, bl + 0.2), top, [-0.05, 1.1, 0]);
    for (let z = -bl / 2 + 0.6; z < bl / 2; z += 1.2) M.P(bar, M.box(0.03, 0.8, 1.0), top, [-0.46, 0.53, z]);
    M.P(bar, M.cyl(0.025, 0.025, bl, 8), G.mat('bronze') || G.mat('gold'), [-0.6, 0.22, 0], [Math.PI / 2, 0, 0]);
    this.place(bar, bx, 0, bcz, 0, 'auto');
    const backX = x1 - 0.35;
    for (let k = 0; k < 3; k++) { const kg = TM.keg(); kg.rotation.y = -Math.PI / 2; this.place(kg, backX - 0.25, 0.85 + (k === 1 ? 0 : 0), bz0 + 1.5 + k * 1.3); }
    for (let row = 0; row < 3; row++) { const y = 1.4 + row * 0.55, z = bcz + 2.5; M.P(grp, M.box(0.35, 0.05, 5.0), G.mat('wood'), [backX - 0.1, y, z]); for (let b = 0; b < 9; b++) { const bt = TM.bottle([0x2a6a2a, 0x7a2a1a, 0x3a3a8a, 0xc89a2a, 0x5a2a6a, 0x2a5a6a][(b + row * 2) % 6]); bt.position.set(backX - 0.12, y + 0.025, z - 2.2 + b * 0.55); bt.scale.setScalar(0.9 + R() * 0.3); grp.add(bt); } }
    for (let k = 0; k < 5; k++) { const st = TM.stool(); this.place(st, bx - 1.05, 0, bz0 + 1.2 + k * (bl - 2.4) / 4, 0, 0.3); }
    for (let k = 0; k < 4; k++) { const m = TM.vessel(k % 2 ? 'mug' : 'goblet', 0xc88a2a); m.position.set(bx - 0.2 + R() * 0.2, 1.135, bz0 + 1 + k * 3.1 + R()); m.rotation.y = R() * 6; grp.add(m); }
    // Ulla, behind the counter
    const ulla = TM.bartender(); ulla.root.position.set(bx + 1.25, 0, bcz - 1); ulla.root.rotation.y = -Math.PI / 2; ulla.root.userData.dynamic = true; grp.add(ulla.root);
    this.hideNPCs.push(ulla); this.bartender = ulla; this.tavernNPCs = [ulla];
    this.lights.push({ pos: new G.V3(bx + 0.6, 2.6, bcz), color: 0xffb060, intensity: 2.4, dist: 12, seed: 3, flicker: true });
    // two drinking tables where the regulars nurse their mugs (their games moved to the Grand Arcade)
    [[x0 + 14, z0 + 6, 0], [x0 + 14, z1 - 6, 1]].forEach(([tx, tz, v]) => { this.place(TM.roundTable(), tx, 0, tz, 0, 1.05); [[-Math.PI / 2 - 0.5, v], [-0.4, 2 - v]].forEach(([a, vv]) => { const sx2 = tx + Math.cos(a) * 1.45, sz2 = tz + Math.sin(a) * 1.45, st = TM.stool(); this.place(st, sx2, 0, sz2, 0); const Rr = TM.patron(vv); Rr.root.position.set(sx2, 0, sz2); Rr.root.rotation.y = Math.atan2(tx - sx2, tz - sz2); Rr.root.userData.dynamic = true; grp.add(Rr.root); this.hideNPCs.push(Rr); this.tavernNPCs.push(Rr); });
      for (let i = 0; i < 3; i++) { const m = TM.vessel(i % 2 ? 'mug' : 'goblet', 0xc88a2a); m.position.set(tx + (R() - 0.5) * 1.0, 0.82, tz + (R() - 0.5) * 0.9); grp.add(m); } const cd = M.prop.candles(3); cd.position.set(tx, 0.82, tz); cd.scale.setScalar(0.6); grp.add(cd); this.lights.push({ pos: new G.V3(tx, 1.3, tz), color: 0xffa040, intensity: 1.5, dist: 7, seed: tx + tz, flicker: true }); });
    // a regular asleep in his cups, and a spare table
    { const tx = x0 + 22.5, tz = z0 + 5; this.place(TM.roundTable(), tx, 0, tz, 0, 1.05); const st = TM.stool(); this.place(st, tx, 0, tz - 1.4, 0); const Rr = TM.patron(1); Rr._sleep = true; Rr.root.position.set(tx, 0, tz - 1.4); Rr.root.rotation.y = 0; Rr.root.userData.dynamic = true; grp.add(Rr.root); this.hideNPCs.push(Rr); this.sleeper = Rr;
      for (let i = 0; i < 4; i++) { const m = TM.vessel(i % 2 ? 'mug' : 'horn', 0xc88a2a); m.position.set(tx + (R() - 0.5) * 1.2, 0.82, tz + (R() - 0.5) * 1.0); m.rotation.set(i === 2 ? Math.PI / 2 : 0, R() * 6, 0); grp.add(m); } const cd = M.prop.candles(2); cd.position.set(tx + 0.3, 0.82, tz + 0.2); cd.scale.setScalar(0.5); grp.add(cd); }
    // a hearth, barrels, lanterns, a chandelier
    this.place(M.prop.fireplace(), x0 + 7, 0, z1 - 0.4, Math.PI, 'auto');
    [[x0 + 1, z1 - 1], [x0 + 1, z1 - 2.1], [x0 + 2.1, z1 - 1], [x1 - 1.2, z0 + 1.2]].forEach(([x, z]) => this.place(M.prop.barrel(), x, 0, z, R() * 6, 0.45));
    [[cx - 6, cz - 6], [cx + 2, cz + 4], [cx - 6, cz + 6], [cx + 2, cz - 7]].forEach(([x, z]) => this.hang(TM.lantern(), x, CH - 0.3, z));
    this.hang(M.prop.chandelier(), cx - 2, CH - 1.6, cz);
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 3), G.mat('col', { c: 0x5a2a1a, t: 'cloth' })); rug.rotation.x = -Math.PI / 2; rug.position.set(dx, 0.02, z0 + 2); grp.add(rug);
    T.buildDarts.call(this, { bx: x0 + 0.06, bz: z0 + 12 });
    // interaction spots
    this.interact.push({ id: 'bar', label: 'Ulla the Bartender', x: bx - 1.0, z: bcz, r: 3.4, desc: 'Drinks and top-shelf brews' });
  };

  /* ================= game corners (built in the Grand Arcade) ================= */
  // darts: a board on the tavern's west wall, an oche of brass four and a half metres out, a rack of darts
  T.buildDarts = function (o) {
    const grp = this.group, board = TM.dartboard(), by = 1.73, bzz = o.bz, x0 = o.bx - 0.06; board.scale.setScalar(0.6); board.position.set(x0 + 0.04, by, bzz); board.rotation.y = Math.PI / 2; grp.add(board);
    const lineX = x0 + 4.5; M.P(grp, M.box(0.05, 0.02, 1.4), G.mat('bronze') || G.mat('gold'), [lineX, 0.01, bzz]);
    const cab = new THREE.Group(); M.mirror(k => M.P(cab, M.box(0.04, 1.3, 0.62), G.mat('col', { c: 0x3a2214, t: 'wood' }), [0.3, 0, k * 0.66])); M.P(cab, M.box(0.36, 0.05, 1.36), G.mat('col', { c: 0x3a2214, t: 'wood' }), [0.17, 0.66, 0]); M.P(cab, M.box(0.36, 0.05, 1.36), G.mat('col', { c: 0x3a2214, t: 'wood' }), [0.17, -0.66, 0]);
    cab.position.set(x0 + 0.02, by, bzz); grp.add(cab);
    const chalk = document.createElement('canvas'); chalk.width = 256; chalk.height = 320; const cx = chalk.getContext('2d'); cx.fillStyle = '#1a1a18'; cx.fillRect(0, 0, 256, 320); cx.strokeStyle = '#8a6a40'; cx.lineWidth = 10; cx.strokeRect(5, 5, 246, 310); cx.fillStyle = '#e8e4d8'; cx.font = '26px Georgia'; cx.textAlign = 'center'; cx.fillText('DARTS', 128, 44); cx.font = '18px Georgia'; ['Bull 50', 'Inner 25', 'Treble ring 15', 'Bed 10', 'Double ring 5', 'Rim 2', '', 'Hold right click', 'to steady your arm'].forEach((l, k) => cx.fillText(l, 128, 84 + k * 26));
    const cb = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.62), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(chalk), roughness: 1 })); cb.position.set(x0 + 0.03, by, bzz + 1.25); cb.rotation.y = Math.PI / 2; grp.add(cb);
    const rack = new THREE.Group(); M.P(rack, M.cyl(0.03, 0.04, 1.0, 8), G.mat('wood'), [0, 0.5, 0]); M.P(rack, M.box(0.3, 0.08, 0.2), G.mat('wood'), [0, 1.02, 0]); for (let i = 0; i < 5; i++) { const kn = T.knifeMesh(); kn.position.set(-0.1 + i * 0.05, 1.12, 0); kn.rotation.set(0, 0, Math.PI); rack.add(kn); }
    this.place(rack, lineX + 0.8, 0, bzz + 1.3, 0, 0.3);
    this.lights.push({ pos: new G.V3(x0 + 1.2, 2.6, bzz), color: 0xffd0a0, intensity: 1.8, dist: 6, seed: 9, flicker: false });
    this.knifeLane = { bx: x0 + 0.04, by, bz: bzz, lineX };
    this.interact.push({ id: 'knives', label: 'Darts', x: lineX + 0.4, z: bzz, r: 2.2, desc: 'Practice, or a match with your party' });
  };
  T.buildGameCorners = function (o) {
    const grp = this.group; this.tavernNPCs = this.tavernNPCs || [];
    // Liar's Dice: a round table for up to six (the seats, cups and regulars are set by the first-person tables)
    const lt = { x: o.lx, z: o.lz }; this.place(TM.roundTable(), lt.x, 0, lt.z, 0, 1.05);
    { this.lights.push({ pos: new G.V3(lt.x, 2.2, lt.z), color: 0xffa040, intensity: 1.5, dist: 7, seed: 5, flicker: false }); }
    this.liarsSeat = { x: lt.x, z: lt.z, npcs: [] };
    // Knucklebones: a small table with a dice tray between the two boards
    const kt = { x: o.kx, z: o.kz }; const ktab = M.prop.table(); ktab.scale.set(0.7, 1, 1.0); this.place(ktab, kt.x, 0, kt.z, Math.PI / 2, 'auto');
    { const tray = new THREE.Group(), wd = G.mat('col', { c: 0x3a2214, t: 'wood' }), fl = G.mat('col', { c: 0x1a3a1a, t: 'cloth' }); M.P(tray, M.box(0.5, 0.012, 0.28), fl, [0, 0.006, 0]); M.mirror(k => { M.P(tray, M.box(0.54, 0.05, 0.02), wd, [0, 0.025, k * 0.15]); M.P(tray, M.box(0.02, 0.05, 0.3), wd, [k * 0.26, 0.025, 0]); }); tray.position.set(kt.x, 0.85, kt.z); grp.add(tray); }
    { const cd = M.prop.candles(2); cd.position.set(kt.x + 0.36, 0.85, kt.z); cd.scale.setScalar(0.5); grp.add(cd); this.lights.push({ pos: new G.V3(kt.x, 1.9, kt.z), color: 0xffa040, intensity: 1.3, dist: 6, seed: 7, flicker: false }); }
    this.knuckleNPC = null;
    this.interact.push({ id: 'liars', label: "Liar's Dice", x: lt.x, z: lt.z, r: 2.6, desc: 'Bluff the regulars for gold' });
    this.interact.push({ id: 'knuckle', label: 'Knucklebones', x: kt.x + 0.9, z: kt.z, r: 2.3, desc: 'Challenge Dorrin to a game of bones' });
  };

  /* ================= drunkenness ================= */
  // a post-process pass: double vision, warping, smearing; it also carries a full-screen flash for cutscenes
  T.initPass = () => {
    if (T.pass || !G.composer) return;
    const mat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, amt: { value: 0 }, time: { value: 0 }, flash: { value: new THREE.Vector4(1, 1, 1, 0) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform sampler2D tDiffuse; uniform float amt, time; uniform vec4 flash; varying vec2 vUv;
        void main(){
          vec2 uv=vUv;
          if(amt>0.001){
            uv+=vec2(sin(uv.y*7.0+time*1.3), cos(uv.x*6.0+time*1.1))*0.006*amt;
            vec2 c=uv-0.5; uv=0.5+c*(1.0-0.025*amt*(0.5+0.5*sin(time*0.8)));
          }
          vec4 col=texture2D(tDiffuse,uv);
          if(amt>0.001){
            vec2 off=vec2(sin(time*0.9), cos(time*0.7))*0.018*amt;
            vec4 b=texture2D(tDiffuse,uv+off); vec4 b2=texture2D(tDiffuse,uv-off*0.6);
            col=mix(col,(b+b2)*0.5,0.45*amt);
            vec4 s=vec4(0.0); for(int i=0;i<6;i++){ float a=float(i)*1.047; s+=texture2D(tDiffuse,uv+vec2(cos(a),sin(a))*0.004*amt); }
            col=mix(col,s/6.0,0.6*amt);
            float l=dot(col.rgb,vec3(0.299,0.587,0.114)); col.rgb=mix(vec3(l),col.rgb,1.0+0.35*amt);
            vec2 c=vUv-0.5; col.rgb*=1.0-amt*0.55*dot(c,c)*2.0;
          }
          col.rgb=mix(col.rgb,flash.rgb,flash.a);
          gl_FragColor=col;
        }`,
      depthTest: false, depthWrite: false
    });
    T.pass = new THREE.ShaderPass(mat); T.passMat = mat;
    const C = G.composer, i = C.passes.indexOf(G.bloomPass); C.insertPass ? C.insertPass(T.pass, i < 0 ? C.passes.length - 1 : i) : C.passes.splice(i < 0 ? C.passes.length - 1 : i, 0, T.pass);
    G.screenFlash = (rgb, a) => { mat.uniforms.flash.value.set(rgb[0], rgb[1], rgb[2], a); };
  };
  const init0 = G.game.init.bind(G.game);
  G.game.init = async function () { await init0(); T.initPass(); };

  T.addDrunk = (n) => { const was = T.drunk; T.drunk = n <= -50 ? 0 : G.clamp(T.drunk + n, 0, 12); if (Math.floor(was / 2) !== Math.floor(T.drunk / 2)) G.net.pushPresence(true); };
  T.tick = (P, dt, t) => {
    if (T.drunk > 0) T.drunk = Math.max(0, T.drunk - dt / 28);
    const a = T.amt();
    if (T.passMat) { T.passMat.uniforms.amt.value = G.damp(T.passMat.uniforms.amt.value, a, 2, dt); T.passMat.uniforms.time.value = t; }
    if (!P || P.dead || P.downed || a < 0.05) return;
    // hiccups
    if (Math.random() < dt * 0.06 * a * (T.drunk > 2 ? 1 : 0)) { G.sfx('hic', 0.8); P.kickX = (P.kickX || 0) + 0.035; }
    // a sudden lurch sideways
    if (Math.random() < dt * 0.22 * a && !P.puke) { const s = Math.random() < 0.5 ? -1 : 1, rx = Math.cos(P.yaw) * s, rz = -Math.sin(P.yaw) * s; P.vel.x += rx * 4 * a; P.vel.z += rz * 4 * a; G.sfx('step', 0.6); }
    // past the edge: the stomach votes
    if (T.drunk >= 8 && !P.puke && !P.drinkA && Math.random() < dt * 0.12) T.puke(P);
  };
  T.puke = (P) => {
    if (P.puke) return; P.puke = { t: 0, dur: 2.6 }; P.actEm = 'puke'; G.net.pushPresence(true);
    G.ui.toast(G.pick(['Your stomach lurches…', 'Oh no. Oh no no no.', 'The room spins one time too many…']));
  };
  T.updatePuke = (P, dt) => {
    const K = P.puke; if (!K) return; K.t += dt;
    if (K.t > 0.6 && !K.fired) { K.fired = true; G.sfx('puke', 1); G.net.sendFx({ k: 'puke', x: Math.round(P.pos.x * 10) / 10, z: Math.round(P.pos.z * 10) / 10, r: Math.round(P.yaw * 100) / 100 }); }
    if (K.t > 0.6 && K.t < 1.9) T.pukeFx(P.pos.x, P.pos.z, P.yaw, P.pos.y || 0, dt, K);
    if (K.t >= K.dur) { P.puke = null; P.actEm = 0; T.addDrunk(-3.5); G.net.pushPresence(true); G.ui.toast(G.pick(['You feel… better. Sort of.', 'Ulla tosses a bucket of sawdust over it without a word.', 'Somewhere, a patron applauds.'])); G.sfx('cheer', 0.4); }
  };
  T.pukeFx = (x, z, yaw, y0, dt, K) => {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), mx = x + fx * 0.3, mz = z + fz * 0.3;
    for (let i = 0; i < 6; i++) G.fx.emit(G.fx.norm, mx, y0 + 1.45, mz, fx * (1.6 + Math.random()) + (Math.random() - 0.5) * 0.5, -0.2 + Math.random() * 0.4, fz * (1.6 + Math.random()) + (Math.random() - 0.5) * 0.5, 0.9, 0.07, 0.04, [0.55, 0.6, 0.16, 1], [0.4, 0.42, 0.1, 0.8], 12, 0.5);
    if (K && !K.decal && K.t > 1.0) { K.decal = true; G.fx.decal('blood', x + fx * 1.0, z + fz * 1.0, 2.2, 0x8a9a30, 60); }
  };
  // remote avatars sway when their player is drunk
  T.swayRig = (r, dk, dt) => { const a = G.clamp(dk / 7, 0, 1), t = G.now() + (r.seed || (r.seed = Math.random() * 9)); r.R.body.rotation.z += Math.sin(t * 0.9) * 0.12 * a; r.R.body.rotation.x += Math.sin(t * 0.63) * 0.06 * a; r.R.neck.rotation.z += Math.sin(t * 1.3) * 0.15 * a; };

  /* ================= drinking (first person, with a third-person pose for allies) ================= */
  T.drink = (def, brewId) => {
    const P = G.player; if (!P || P.drinkA || P.puke) return;
    const mesh = TM.vessel(def.vessel, def.liquid); mesh.traverse(o => { if (o.isMesh && o.material) { o.material = o.material.clone(); o.material.side = THREE.DoubleSide; } }); mesh.scale.setScalar(0.9); if (mesh.foam) mesh.foam.visible = false; G.camera.add(mesh);
    P.drinkA = { def, brewId, t: 0, dur: def.vessel === 'shot' ? 1.7 : 2.5, mesh, g: 0 }; P.actEm = 'drink'; G.net.pushPresence(true);
    G.sfx('clink', 0.6);
  };
  T.updateDrink = (P, dt) => {
    const D = P.drinkA; if (!D) return; D.t += dt; const k = D.t / D.dur, m = D.mesh, sm = G.smooth;
    const up = sm(G.clamp(k / 0.25, 0, 1)), down = sm(G.clamp((k - 0.82) / 0.18, 0, 1)), tip = sm(G.clamp((k - 0.2) / 0.15, 0, 1)) * (1 - down), shot = D.def.vessel === 'shot';
    m.position.set(G.lerp(0.3, 0.07, up) + down * 0.25, G.lerp(-0.55, -0.24, up) + tip * 0.05 - down * 0.45 + Math.sin(D.t * 14) * 0.003 * tip, G.lerp(-0.5, -0.36, up) + tip * 0.06);
    m.rotation.set(tip * (shot ? 1.7 : 1.05) + Math.sin(D.t * 3) * 0.04 * tip, 0.35 * (1 - up) - 0.35, -0.25 * (1 - up) + 0.1 * tip);
    if (m.liq) m.liq.scale.setScalar(Math.max(0.2, 1 - G.clamp((k - 0.35) / 0.45, 0, 1) * 0.8));
    const gulps = shot ? [0.45] : [0.4, 0.55, 0.7]; while (D.g < gulps.length && k > gulps[D.g]) { D.g++; G.sfx('gulp', 0.8); }
    P.drinkTilt = tip * (shot ? 0.35 : 0.22);
    if (k >= 1) {
      G.camera.remove(m); P.drinkA = null; P.actEm = 0; P.drinkTilt = 0; G.net.pushPresence(true);
      const def = D.def; T.addDrunk(def.pot);
      if (D.brewId) { G.save.brew = D.brewId; G.persist(); G.ui.toast(`${def.name} · ${def.desc}`); }
      if (def.id === 'water') G.ui.toast('Refreshing. Ulla raises an eyebrow.');
      else if (def.id === 'cure') { G.ui.toast('You gag, shudder, and see clearly again.'); G.sfx('groan', 0.5); }
      else if (Math.random() < 0.35) G.sfx(Math.random() < 0.5 ? 'burp' : 'aah', 0.8);
      if (T.drunk >= 10 && !P.puke) setTimeout(() => G.player && T.puke(G.player), 1500);
      else if (def.pot > 0) G.ui.toast(`You feel ${T.level().toLowerCase()}.`);
    }
  };

  // third-person poses for allies: a mug in the hand tipped back, or doubled over
  G.emotes.LIST.push({ id: 'drink', key: 'NoKey_drink', name: 'Drinking', hidden: true }, { id: 'puke', key: 'NoKey_puke', name: 'Puking', hidden: true });
  const pose0 = G.emotes.pose.bind(G.emotes), dress0 = G.emotes.dress.bind(G.emotes);
  G.emotes.pose = function (Rr, st) {
    const E = st.emote; if (!E || (E.id !== 'drink' && E.id !== 'puke')) return pose0(Rr, st);
    const t = E.t, B = Rr.armR, A2 = Rr.armL;
    if (E.id === 'drink') { const up = G.smooth(G.clamp(t / 0.5, 0, 1)), tip = G.smooth(G.clamp((t - 0.5) / 0.4, 0, 1)); B.sh.rotation.set(-0.3 - up * 1.6 - tip * 0.5, 0.3 * up, -0.2 - 0.3 * up); B.el.rotation.set(-0.3 - up * 1.6 + tip * 0.4, 0, 0); Rr.neck.rotation.x -= tip * 0.55; Rr.torso.rotation.x -= tip * 0.12; }
    else { const k = G.smooth(G.clamp(t / 0.5, 0, 1)), heave = t > 0.6 && t < 1.9 ? Math.sin(t * 16) * 0.08 : 0; Rr.torso.rotation.x += k * 0.95 + heave; Rr.neck.rotation.x += k * 0.35; Rr.hips.position.y -= k * 0.08; Rr.legL.kn.rotation.x += k * 0.4; Rr.legR.kn.rotation.x += k * 0.4; Rr.legL.hip.rotation.x -= k * 0.4; Rr.legR.hip.rotation.x -= k * 0.4; A2.sh.rotation.set(-0.9 * k, 0, 0.3); A2.el.rotation.set(-0.3, 0, 0); B.sh.rotation.set(-0.9 * k, 0, -0.3); B.el.rotation.set(-0.3, 0, 0); }
  };
  G.emotes.dress = function (Rr, id) {
    dress0(Rr, id === 'drink' || id === 'puke' ? 0 : id);
    const want = id === 'drink'; if (want && !Rr.tavMug) { Rr.tavMug = TM.vessel('mug', 0xc88a2a); Rr.tavMug.scale.setScalar(1.2); Rr.tavMug.position.set(0, -0.08, 0.06); Rr.armR.hand.add(Rr.tavMug); }
    if (Rr.tavMug) { Rr.tavMug.visible = want; Rr.armR.hand.children.forEach(o => { if (o !== Rr.tavMug && o.userData.wasVis === undefined && want) { o.userData.wasVis = o.visible; o.visible = false; } else if (o !== Rr.tavMug && !want && o.userData.wasVis !== undefined) { o.visible = o.userData.wasVis; delete o.userData.wasVis; } }); }
  };
  const fx0 = G.net.onFx.bind(G.net);
  G.net.onFx = function (f, peer) { if (f && f.k === 'puke') { const K = { t: 0 }; let n = 0; const iv = setInterval(() => { K.t += 0.05; T.pukeFx(+f.x || 0, +f.z || 0, +f.r || 0, G.World.fy ? G.World.fy(+f.x || 0, +f.z || 0) : 0, 0.05, K); if (++n > 26) clearInterval(iv); }, 50); G.sfx('puke', 0.9, new G.V3(+f.x, 0, +f.z)); return; } return fx0(f, peer); };

  /* ================= the player hooks: drunk camera and feet, drinking, knife throwing ================= */
  const mk0 = G.makePlayer;
  G.makePlayer = function (cls) {
    const P = mk0(cls);
    // the top-shelf brew bought before this descent
    if (G.run.active && G.run.brew && T.BREWS[G.run.brew]) { const B = T.BREWS[G.run.brew]; B.ap(P.mods, P); P.hp = P.maxHp; P.sta = P.maxSta; }
    const up0 = P.update, cam0 = P.updateCam, vm0 = P.animVM;
    P.update = (dt, t) => {
      const K = T.knives, busy = P.drinkA || P.puke || (K && K.active), keep = busy ? { l: G.mouse.l, lp: G.mouse.lPressed, q: G.pressed.KeyQ, r: G.pressed.KeyR, f: G.pressed.KeyF } : null;
      const lp = G.mouse.lPressed, px = P.pos.x, pz = P.pos.z;
      const rHeld = G.mouse.r; if (busy) { G.mouse.l = false; G.mouse.lPressed = false; G.pressed.KeyQ = G.pressed.KeyR = G.pressed.KeyF = false; if (K && K.active) G.mouse.r = false; }
      up0(dt, t);
      if (keep) { G.mouse.l = keep.l; G.mouse.lPressed = keep.lp; G.mouse.r = rHeld; }
      if (K && K.active) K.rHeld = rHeld;
      if (P.puke) { P.pos.x = px; P.pos.z = pz; P.vel.set(0, 0, 0); }
      // drunk feet: a slow figure-eight drift on top of whatever you're doing
      const a = T.amt(); if (a > 0.1 && !P.dead && G.state === 'play') { const tt = G.now(); P.pos.x += (Math.sin(tt * 0.83) * Math.cos(P.yaw) + Math.sin(tt * 0.37) * 0.5) * a * 0.9 * dt; P.pos.z += (-Math.sin(tt * 0.83) * Math.sin(P.yaw) + Math.cos(tt * 0.41) * 0.5) * a * 0.9 * dt; if (G.World.W) G.World.collide(P.pos, 0.42); }
      T.updateDrink(P, dt); T.updatePuke(P, dt); T.tick(P, dt, t);
      if (K && K.active) T.knifeUpdate(P, dt, lp);
    };
    P.updateCam = (dt, t) => {
      cam0(dt, t); if (P.emote) return;
      const cam = G.camera, a = T.amt(), tt = G.now();
      if (a > 0.02) { cam.rotation.z += Math.sin(tt * 0.9) * 0.075 * a + Math.sin(tt * 2.3) * 0.02 * a; cam.rotation.x += Math.sin(tt * 0.7) * 0.03 * a; cam.rotation.y += Math.sin(tt * 0.5) * 0.035 * a; }
      if (P.drinkTilt) cam.rotation.x += P.drinkTilt;
      if (T.knives && T.knives.active && T.knives.sw) { cam.rotation.y += T.knives.sw[0]; cam.rotation.x += T.knives.sw[1]; }
      if (P.puke) { const k = G.smooth(G.clamp(P.puke.t / 0.5, 0, 1)) * (1 - G.smooth(G.clamp((P.puke.t - 2.1) / 0.5, 0, 1))); cam.rotation.x = G.lerp(cam.rotation.x, -0.95, k); cam.position.y -= k * 0.25; cam.rotation.z += Math.sin(P.puke.t * 14) * 0.02 * k; }
    };
    P.animVM = (dt, t) => { vm0(dt, t); if (P.V && (P.drinkA || P.puke || (T.knives && T.knives.active))) P.V.root.visible = false; };
    return P;
  };
  // experience brew
  const xp0 = G.sheet.gainXp.bind(G.sheet);
  G.sheet.gainXp = function (P, amt, why) { return xp0(P, G.run.active && G.run.brew === 'absinthe' ? amt * 1.25 : amt, why); };
  // a brew is drunk before the descent and lasts the whole of it; the portal also sobers you up some
  const start0 = G.game.netStart.bind(G.game);
  G.game.netStart = function (d) {
    const was = G.run.active, brew = G.save.brew; G.run.brew = null;
    const P0 = G.player; if (P0 && P0.drinkA) { G.camera.remove(P0.drinkA.mesh); P0.drinkA = null; }
    if (T.knives && T.knives.active) T.knifeEnd(true); if (T.knives) { (T.knives.list || []).concat(T.knives.flying || []).forEach(k => G.scene.remove(k.m)); T.knives.list = []; T.knives.flying = []; }
    const r = start0(d);
    if (!was && G.run.active) { if (brew && T.BREWS[brew]) { G.run.brew = brew; delete G.save.brew; G.persist(); const B = T.BREWS[brew]; const P = G.player; B.ap(P.mods, P); P.hp = P.maxHp; P.sta = P.maxSta; setTimeout(() => G.ui.toast(`${B.icon} ${B.name} warms your blood · ${B.desc.replace(' on your next descent', '')}`), 2500); } T.drunk = Math.min(T.drunk, 3); }
    return r;
  };
  const pz0 = G.game.updatePickups.bind(G.game);
  G.game.updatePickups = function (dt, t) { pz0(dt, t); if (G.World.theme === 'hideout') { T.tickNPCs(dt); T.tickKnives(dt); } if (!G.player) T.tick(null, dt, t); };

  /* ================= the bar panel and the two table games ================= */
  const UI = G.ui, open0 = UI.openPanel.bind(UI), render0 = UI.renderPanel.bind(UI), close0 = UI.closePanel.bind(UI);
  UI.openPanel = function (kind, data) {
    if (kind === 'bar') { G.sfx('pour', 0.6); T.gesture(G.World.bartender, 'pour', 1.6); }
    return open0(kind, data);
  };
  const css = document.createElement('style');
  css.textContent = `.drunkbar{display:flex;align-items:center;gap:10px;margin:-6px 0 14px}.drunkbar .m{flex:1;height:8px;background:rgba(0,0,0,.5);border:1px solid #5a4620;border-radius:4px;overflow:hidden}.drunkbar .m i{display:block;height:100%;background:linear-gradient(90deg,#c8a040,#d06a20,#a02030)}
.brewnote{background:rgba(40,60,20,.35);border:1px solid #6a8a3a;padding:6px 10px;margin-bottom:12px;border-radius:3px}
.tgame{display:flex;flex-direction:column;gap:12px}.tgame .seat{display:flex;align-items:center;gap:10px;background:rgba(30,22,10,.55);border:1px solid #5a4620;padding:8px 10px;border-radius:4px}.tgame .seat.turn{border-color:#f3d998;box-shadow:0 0 12px rgba(243,217,152,.25)}.tgame .seat.out{opacity:.45}
.tgame .nm{min-width:150px;font-family:var(--head)}.tgame .nm small{display:block;opacity:.7;font-family:inherit}
.dice{display:flex;gap:6px;flex-wrap:wrap}.die{width:34px;height:34px;border-radius:7px;background:#f2ead8;color:#1a1206;display:grid;place-items:center;font-size:30px;line-height:1;box-shadow:inset 0 -3px 0 rgba(0,0,0,.25)}.die.hid{background:#5a2a14;color:#c8a070;font-size:18px}.die.hit{background:#f3d998;box-shadow:0 0 10px #f3d998}.die.wild{background:#d8e8ff}
.bidrow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.bidrow .q{font-size:22px;min-width:36px;text-align:center;font-family:var(--head)}.facebtn{font-size:26px;width:44px;height:44px;padding:0}.facebtn.sel{outline:2px solid #f3d998}
.tlog{max-height:120px;overflow:auto;font-size:13px;opacity:.85;background:rgba(0,0,0,.25);padding:6px 10px;border-radius:3px}.tlog p{margin:2px 0}
.kb{display:grid;grid-template-columns:repeat(3,64px);gap:6px}.kb .col{display:flex;flex-direction:column;gap:4px;padding:4px;background:rgba(0,0,0,.3);border:1px solid #5a4620;border-radius:4px;min-height:120px;cursor:default}.kb .col.can{cursor:pointer;border-color:#f3d998}.kb .col.can:hover{background:rgba(243,217,152,.12)}
.kb .col .die{width:56px;height:34px;font-size:28px}.kb .col .die.x2{background:#f3d998}.kb .col .die.x3{background:#ffb060}.kbsum{display:grid;grid-template-columns:repeat(3,64px);gap:6px;text-align:center;font-family:var(--head);color:#f3d998}
.kbwrap{display:flex;gap:28px;align-items:flex-start;flex-wrap:wrap}.kbwrap h4{margin:0 0 6px;font-family:var(--head)}.rolling{animation:shk .12s infinite}@keyframes shk{0%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}100%{transform:rotate(-8deg)}}
#knifeHud{position:absolute;left:50%;bottom:150px;transform:translateX(-50%);font-family:var(--head);color:#f3d998;font-size:20px;text-shadow:0 2px 6px #000;pointer-events:none;text-align:center}`;
  document.head.appendChild(css);
  const FACE = T.FACE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  const blur = T.blur = () => T.drunk > 1.5 ? `filter:blur(${Math.min(2.5, (T.drunk - 1.5) * 0.45).toFixed(2)}px)` : '';

  UI.renderPanel = function () {
    const k = this.panelKind; if (k !== 'bar') return render0();
    const body = document.getElementById('panelBody'), set = (eye, title, sub) => { document.getElementById('panelEye').textContent = eye; document.getElementById('panelTitle').textContent = title; document.getElementById('panelSub').textContent = sub; };
    body.innerHTML = T.barHtml(set); T.barBind(body);
  };

  T.barHtml = (set) => {
    const S = G.save, line = G.pick(['"What\'ll it be, love?"', '"You look like you need a drink. Or six."', '"No fighting in here. Take it to the ring."', '"Top shelf\'s for heroes. Bottom shelf\'s for the rest of you."']);
    set('The Gilded Tankard', 'Ulla\'s Bar', `${line} Ulla polishes a mug that was clean an hour ago.`);
    const dk = T.drunk, lv = T.level();
    let h = `<div class="goldline">Gold: ${S.gold}</div><div class="drunkbar"><span>${lv}</span><span class="m"><i style="width:${Math.min(100, dk / 10 * 100)}%"></i></span></div>`;
    if (S.brew && T.BREWS[S.brew]) h += `<div class="brewnote">${T.BREWS[S.brew].icon} <b>${T.BREWS[S.brew].name}</b> is in your blood for the next descent · ${T.BREWS[S.brew].desc.replace(' on your next descent', '')}. Drinking another top-shelf brew replaces it.</div>`;
    h += '<h3 class="sh">On tap</h3><div class="shop">' + T.DRINKS.map(d => `<div class="shopitem"><div class="ic">${d.icon}</div><div style="min-width:0"><h3>${d.name}</h3><p>${d.desc}</p></div><button class="btn small" data-drink="${d.id}" ${S.gold < d.cost ? 'disabled' : ''}>${d.cost ? d.cost + ' g' : 'Free'}</button></div>`).join('') + '</div>';
    h += '<h3 class="sh">Top shelf · lasts through your next descent</h3><div class="shop">' + Object.entries(T.BREWS).map(([id, b]) => `<div class="shopitem"><div class="ic">${b.icon}</div><div style="min-width:0"><h3>${b.name}</h3><p>${b.desc}</p></div><button class="btn small" data-brew="${id}" ${S.gold < b.cost ? 'disabled' : ''}>${b.cost} g</button></div>`).join('') + '</div>';
    return h;
  };
  T.barBind = (body) => {
    const go = (def, cost, brew) => { if (G.save.gold < cost) { G.ui.toast('Not enough gold'); return; } if (G.player && (G.player.drinkA || G.player.puke)) return; G.save.gold -= cost; G.persist(); if (cost) G.sfx('coin', 0.6); G.sfx('pour', 0.7); T.gesture(G.World.bartender, 'pour', 1.2); G.ui.closePanel(); setTimeout(() => T.drink(def, brew), 250); };
    body.querySelectorAll('[data-drink]').forEach(b => b.onclick = () => { const d = T.DRINKS.find(x => x.id === b.dataset.drink); go(d, d.cost); });
    body.querySelectorAll('[data-brew]').forEach(b => b.onclick = () => { const id = b.dataset.brew, B = T.BREWS[id]; go(Object.assign({ id }, B), B.cost, id); });
  };

  /* ---------- knife throwing ---------- */
  T.knifeMesh = () => { const g = new THREE.Group(), steel = G.mat('steel') || G.mat('iron'), brass = G.mat('col', { c: 0xc8a050, m: 0.8, r: 0.3 }), fl = G.mat('col', { c: 0x8a1018, r: 0.7, ds: true });   // a dart: steel point, knurled brass barrel, shaft, three flights; points along +y
    M.P(g, M.cyl(0.0, 0.0028, 0.04, 6), steel, [0, 0.13, 0]); M.P(g, M.cyl(0.0045, 0.0055, 0.06, 10), brass, [0, 0.08, 0]); for (let k = 0; k < 4; k++) M.P(g, M.tor(0.0052, 0.0008, 4, 10), brass, [0, 0.062 + k * 0.012, 0], [Math.PI / 2, 0, 0]);
    M.P(g, M.cyl(0.0022, 0.0022, 0.05, 6), G.mat('col', { c: 0x1a1a1a }), [0, 0.025, 0]); for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.022, 0.032), fl); f.position.set(Math.cos(k * 2.094) * 0.011, -0.005, Math.sin(k * 2.094) * 0.011); f.rotation.y = -k * 2.094; g.add(f); } return g; };
  T.knives = { active: false, list: [] };
  T.RINGS = [[0.042, 50], [0.108, 25], [0.192, 15], [0.3, 10], [0.372, 5], [0.45, 2]];
  T.knifeStart = (o = {}) => {
    const K = T.knives, L = G.World.knifeLane, P = G.player; if (!L || !P || K.active) return;
    if (!o.contest) { if (G.save.gold < 10) { G.ui.toast('Ten gold for five darts'); return; } G.save.gold -= 10; G.persist(); G.sfx('coin', 0.6); }
    if (Math.hypot(P.pos.x - L.lineX - 0.6, P.pos.z - L.bz) > 4) { P.pos.set(L.lineX + 0.45, P.pos.y || 0, L.bz); P.yaw = Math.PI / 2; P.pitch = 0.02; }
    K.list.forEach(k => G.scene.remove(k.m)); Object.assign(K, { active: true, left: 5, score: 0, list: [], flying: [], hits: [], contest: o.contest || null, breath: 1, steady: 0 });
    K.hand = T.knifeMesh(); K.hand.scale.setScalar(1.4); K.hand.position.set(0.16, -0.16, -0.36); K.hand.rotation.set(-1.45, 0.05, 0.12); G.camera.add(K.hand);
    let hud = document.getElementById('knifeHud'); if (!hud) { hud = document.createElement('div'); hud.id = 'knifeHud'; document.getElementById('hud').appendChild(hud); } hud.hidden = false;
    T.knifeHud(); G.ui.toast('Toe the brass line. Your arm sways: hold right click to steady it, left click to throw. Bull is 50.');
  };
  T.knifeHud = () => { const K = T.knives, h = document.getElementById('knifeHud'); if (h) h.innerHTML = K.active ? `Darts ${'➶'.repeat(K.left)}<br><small>Score ${K.score}${G.save.knifeBest ? ` · best ${G.save.knifeBest}` : ''}</small><div style="width:120px;height:5px;background:rgba(0,0,0,.5);margin:4px auto 0;border-radius:3px;overflow:hidden"><i id="dartBreath" style="display:block;height:100%;width:100%;background:#c8d8f0"></i></div><small style="opacity:.7">hold right click to steady</small>` : ''; };
  T.knifeUpdate = (P, dt, clicked) => {
    const K = T.knives, L = G.World.knifeLane; if (!L) return;
    // the arm sways in a lazy figure of eight; holding right click steadies it until your breath runs out, then it shakes
    K.st = (K.st || 0) + dt; const held = K.rHeld && K.left > 0;
    if (held && K.breath > 0) { K.breath = Math.max(0, K.breath - dt / 2.4); K.steady = Math.min(1, K.steady + dt * 3); } else { K.steady = Math.max(0, K.steady - dt * 4); if (!held) K.breath = Math.min(1, K.breath + dt / 3.5); }
    const shake = held && K.breath <= 0 ? 1 : 0, amp = (0.013 + 0.022 * T.amt()) * (1 - 0.72 * K.steady) * (1 + shake * 0.9), tt = K.st;
    K.sw = [amp * (Math.sin(tt * 1.25) + 0.45 * Math.sin(tt * 2.9 + 1.3)) + shake * 0.004 * Math.sin(tt * 37), amp * 0.8 * (Math.sin(tt * 2.1 + 0.7) + 0.35 * Math.sin(tt * 3.7)) + shake * 0.004 * Math.sin(tt * 41 + 1)];
    const bh = document.getElementById('dartBreath'); if (bh) { bh.style.width = Math.round(K.breath * 100) + '%'; bh.style.background = K.breath < 0.25 ? '#c84030' : '#c8d8f0'; }
    if (Math.hypot(P.pos.x - L.lineX, P.pos.z - L.bz) > 7) { G.ui.toast('You wander off from the lane'); T.knifeEnd(true); return; }
    if (K.hand) { K.hand.visible = K.left > 0; K.cool = Math.max(0, (K.cool || 0) - dt); K.hand.position.y = -0.22 - (K.cool || 0) * 0.6; }
    if (clicked && K.left > 0 && !(K.cool > 0) && !G.ui.modalOpen()) {
      if (P.pos.x < L.lineX - 0.15) { G.ui.toast('Behind the line, cheater!'); G.sfx('boo', 0.4); return; }
      K.left--; K.cool = 0.45; G.sfx('knife', 0.9);
      const cam = G.camera, dir = new G.V3(0, 0, -1).applyQuaternion(cam.quaternion), a = T.amt();
      dir.x += (Math.random() - 0.5) * 0.03 * a; dir.y += (Math.random() - 0.5) * 0.03 * a; dir.z += (Math.random() - 0.5) * 0.03 * a; dir.normalize();
      const m = T.knifeMesh(); m.scale.setScalar(1.4); const p = cam.position.clone().add(dir.clone().multiplyScalar(0.4)).add(new G.V3(0, -0.02, 0)); m.position.copy(p); G.scene.add(m);
      K.flying.push({ m, v: dir.multiplyScalar(14), spin: 0, dart: true }); T.knifeHud();
    }
  };
  T.tickKnives = (dt) => {
    const K = T.knives, L = G.World.knifeLane; if (!L || !K.flying) return;
    for (let i = K.flying.length - 1; i >= 0; i--) {
      const f = K.flying[i], prev = f.m.position.clone(); f.v.y -= (f.dart && !f.dropping ? 2.2 : 6) * dt; f.m.position.addScaledVector(f.v, dt); f.spin += dt * 22;
      const dirN = f.v.clone().normalize(); f.m.quaternion.setFromUnitVectors(new G.V3(0, 1, 0), dirN); f.m.rotateY(f.spin * 0.3);
      const px = L.bx + 0.03;
      if (f.m.position.x <= px && prev.x > px) {
        const k = (prev.x - px) / (prev.x - f.m.position.x), hy = G.lerp(prev.y, f.m.position.y, k), hz = G.lerp(prev.z, f.m.position.z, k), d = Math.hypot(hy - L.by, hz - L.bz);
        let pts = 0; for (const [r, s] of T.RINGS) if (d <= r) { pts = s; break; }
        f.m.position.set(px + 0.07, hy, hz); f.m.quaternion.setFromUnitVectors(new G.V3(0, 1, 0), dirN.clone().setY(dirN.y * 0.3).normalize());
        K.flying.splice(i, 1);
        if (pts) { K.list.push(f); K.score += pts; K.hits.push([Math.round((hy - L.by) * 1000) / 1000, Math.round((hz - L.bz) * 1000) / 1000]); G.sfx('thunk', 1, f.m.position); G.fx.spark(f.m.position.clone(), 0xffe0a0, 8, 2, 0.3, 0.05); G.fx.textPop(new G.V3(px + 0.4, hy + 0.25, hz), pts === 50 ? 'BULLSEYE!' : `+${pts}`, pts >= 25 ? '#ffd040' : '#f3d998'); if (pts === 50) G.sfx('cheer', 0.8); }
        else if (Math.hypot(hy - L.by, hz - L.bz) < 0.5) { G.sfx('thunk', 0.5, f.m.position); K.list.push(f); }
        else { G.sfx('cling', 0.8, f.m.position); f.v.set(1.5, 0.5, (Math.random() - 0.5) * 2); f.dropping = true; K.flying.push(f); G.fx.spark(f.m.position.clone(), 0xffffff, 6, 2, 0.2, 0.04); }
        T.knifeHud();
      } else if (f.m.position.y < 0.05 || f.m.position.x < L.bx - 0.5 || (f.dropping && f.m.position.y < 0.08)) { f.m.position.y = 0.03; K.flying.splice(i, 1); K.list.push(f); if (!f.dropping) G.sfx('cling', 0.5, f.m.position); }
    }
    if (K.active && K.left === 0 && !K.flying.length && !K.ending) { K.ending = true; setTimeout(() => T.knifeEnd(false), 900); }
  };
  T.knifeEnd = (quit) => {
    const K = T.knives; if (!K.active) return; K.active = false; K.ending = false; if (K.hand) { G.camera.remove(K.hand); K.hand = null; }
    const h = document.getElementById('knifeHud'); if (h) h.hidden = true;
    if (K.contest) { G.tables && G.tables.knifeDone(K.contest, K.score, K.hits); K.contest = null; G.ui.banner(`${K.score} points`, 'Your score is in. Check the table to see who wins.'); G.sfx('cheer', 0.5); return; }
    if (!quit) {
      const s = K.score, pay = s >= 175 ? 60 : s >= 120 ? 30 : s >= 75 ? 15 : s >= 40 ? 5 : 0, best = s > (G.save.knifeBest || 0);
      if (best) G.save.knifeBest = s; G.save.gold += pay; G.persist();
      G.ui.banner(`${s} points`, `${pay ? `+${pay} gold` : 'No prize'}${best ? ' · a new personal best!' : ''}`); G.sfx(pay ? 'cheer' : 'boo', 0.6); if (pay) G.sfx('coin', 0.9);
    }
    if (quit) { K.list.forEach(k => G.scene.remove(k.m)); K.list = []; }   // otherwise the knives stay in the board until the next round
  };
  // leaving the hideout clears the lane
  const hide0 = G.game.enterHideout.bind(G.game);
  G.game.enterHideout = async function () { const K = T.knives; if (K.active) T.knifeEnd(true); (K.flying || []).concat(K.list || []).forEach(f => G.scene.remove(f.m)); K.flying = []; K.list = []; return hide0(); };
})();
