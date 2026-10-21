/* ============================================================
   Game: renderer, post-processing, main loop, run lifecycle,
   pickups, chests, interactions, menu diorama camera
   ============================================================ */
'use strict';
G.run = { active: false, id: 0, row: 0, step: 0, depth: 0, dungeon: 'crypt', np: 1, keys: 0 };
G.state = 'boot'; G.hitstop = 0; G.pickups = [];
G.cls = G.store.get('dd_cls', 'knight'); if (!G.CLASSES.includes(G.cls)) G.cls = 'knight';

/* ---------------- cinematic: the party walks into the arena and the door slams shut ---------------- */
G.cine = {
  active: false,
  play(list) {
    const W = G.World, d = W.bossDoor, CS = W.CS, P = G.player; if (!d) return;
    const dir = new G.V3(d.dir[0], 0, d.dir[1]), side = new G.V3(dir.z, 0, -dir.x), C = new G.V3((d.cx + 0.5) * CS, 0, (d.cy + 0.5) * CS), n = list.length;
    this.dir = dir; this.C = C; this.t = 0; this.dur = 6.2; this.active = true; this.closed = false; this.opened = false;
    this.actors = list.map((a, i) => {
      const lat = n > 1 ? (i % 2 ? 1 : -1) * (0.9 + Math.floor(i / 2) * 0.2) : 0, row = Math.floor(i / 2);
      const from = C.clone().addScaledVector(dir, -(CS * 0.5 + 2.4 + row * 1.5)).addScaledVector(side, lat), to = C.clone().addScaledVector(dir, CS * 0.5 + 4.2 + row * 1.4).addScaledVector(side, lat * 1.3);
      const R = M.hero(a.cls, a.w); M.batchRig(R); R.root.position.copy(from); R.root.rotation.y = Math.atan2(dir.x, dir.z); G.scene.add(R.root);
      return { R, from, to, me: a.me, st: { t: Math.random() * 5, move: 0, phase: Math.random() * 6, atk: -1 }, delay: i * 0.18 };
    });
    this.me = this.actors.find(a => a.me);
    this.camFrom = C.clone().addScaledVector(dir, CS * 0.5 + 10.5).add(new G.V3(0, 2.9, 0)).addScaledVector(side, 1.8);
    if (P && P.V) P.V.root.visible = false; document.body.classList.add('cine'); G.ui.releasePointer();
    G.dm.say(G.pick(['The great door groans open. Beyond it, something vast stirs in the dark.', 'You cross the threshold together. Behind you, the door begins to close.', 'Ancient hinges shriek. There is no turning back from here.']));
  },
  update(dt, t) {
    const W = G.World, cam = G.camera, P = G.player; this.t += dt; const T = this.t;
    if (!this.opened && T > 0.3) { this.opened = true; W.setBossDoor(true); W.grid[W.bossDoor.i] = 2; G.Lights.flash(this.C.clone().setY(2.5), 0xffb060, 3, 12, 1.2); }
    if (!this.closed && T > 3.9) { this.closed = true; W.bossDoor.fast = true; W.setBossDoor(false); setTimeout(() => G.sfx('doorslam', 1, this.C), 450); }
    this.actors.forEach(a => {
      const k = G.clamp((T - 1.2 - a.delay) / 2.6, 0, 1), e = G.smooth(k);
      const was = a.R.root.position.clone(); a.R.root.position.lerpVectors(a.from, a.to, e);
      const sp = was.distanceTo(a.R.root.position) / Math.max(dt, 1e-3); a.st.move = G.damp(a.st.move, G.clamp(sp / 3.2, 0, 1.2), 12, dt); a.st.phase += dt * a.st.move * 9; a.st.t += dt;
      if (Math.floor(a.st.phase / Math.PI) !== a.stepN) { a.stepN = Math.floor(a.st.phase / Math.PI); if (a.st.move > 0.3) G.sfx('step', 0.5, a.R.root.position); }
      if (k >= 1) a.R.root.rotation.y = G.lerpAng(a.R.root.rotation.y, Math.atan2(this.dir.x, this.dir.z), dt * 3);
      M.animHum(a.R, a.st);
    });
    // camera: watch from inside the arena, then fly into your own eyes
    const group = this.actors.reduce((s, a) => s.add(a.R.root.position), new G.V3()).multiplyScalar(1 / Math.max(1, this.actors.length));
    const look0 = this.C.clone().setY(2.1).lerp(group.clone().setY(1.5), G.clamp((T - 1.6) / 2, 0, 1) * 0.8);
    let pos = this.camFrom.clone().addScaledVector(this.dir, -Math.min(T, 4.8) * 0.25), look = look0;
    if (this.me && T > 4.9) { const k = G.smooth(G.clamp((T - 4.9) / 1.2, 0, 1)), eye = this.me.to.clone().setY(1.62); pos.lerp(eye, k); look = look0.clone().lerp(eye.clone().addScaledVector(this.dir, 6).setY(1.55), k); if (k > 0.85) this.me.R.root.visible = false; }
    const sh = G.fx.shakeAmt * G.fx.shakeAmt; cam.position.set(pos.x + (Math.random() - 0.5) * sh * 0.2, pos.y + (Math.random() - 0.5) * sh * 0.2, pos.z); cam.lookAt(look);
    if (T >= this.dur) this.finish();
  },
  finish() {
    const P = G.player, W = G.World;
    this.actors.forEach(a => G.scene.remove(a.R.root)); this.actors = []; this.active = false; document.body.classList.remove('cine');
    if (W.bossDoor) { W.bossDoor.fast = true; W.setBossDoor(false, true); W.bossDoor.sealed = true; }
    if (P && this.me) { P.pos.copy(this.me.to); P.pos.y = 0; P.yaw = Math.atan2(-this.dir.x, -this.dir.z); P.pitch = 0; P.vel.set(0, 0, 0); }
    if (P && P.V) P.V.root.visible = true;
    G.camera.rotation.order = 'YXZ'; G.ui.lockSoon(); G.net.pushPresence(true);
    if (G.net.isHost()) setTimeout(() => { const b = G.enemies.boss; if (b && !b.dead) G.enemies.wake(b); }, 600);
    G.ui.banner(G.enemies.boss ? G.enemies.boss.def.name : 'The Arena', 'The door is sealed');
  },
  abort() { (this.actors || []).forEach(a => G.scene.remove(a.R.root)); this.actors = []; this.active = false; document.body.classList.remove('cine'); }
};

G.game = {
  async init() {
    const R = G.renderer = new THREE.WebGLRenderer({ antialias: G.settings.quality !== 'low', powerPreference: 'high-performance' });
    R.outputEncoding = THREE.sRGBEncoding; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.15;
    R.setPixelRatio(this.pr()); R.setSize(innerWidth, innerHeight);
    document.getElementById('stage').appendChild(R.domElement);
    G.scene = new THREE.Scene(); G.scene.background = new THREE.Color(0x0b0910); G.scene.fog = new THREE.FogExp2(0x0b0910, 0.04);
    G.camera = new THREE.PerspectiveCamera(G.settings.fov, innerWidth / innerHeight, 0.05, 160); G.scene.add(G.camera);
    G.hemi = new THREE.HemisphereLight(0x5a6a7a, 0x10100c, 0.35); G.scene.add(G.hemi);
    // post
    G.composer = new THREE.EffectComposer(R);
    G.composer.addPass(new THREE.RenderPass(G.scene, G.camera));
    G.composer.addPass(G.post.init(G.composer, R));
    G.bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.85, 0.55, 0.78); G.bloomPass.enabled = G.settings.bloom; G.composer.addPass(G.bloomPass);
    G.composer.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
    G.composer.setPixelRatio && G.composer.setPixelRatio(this.pr());
    addEventListener('resize', () => this.resize());
    // boot: warm textures & models with progress
    const steps = [['cryptWall', 'Carving crypt stone…'], ['cryptFloor', 'Laying flagstones…'], ['cavernWall', 'Hollowing caverns…'], ['cavernFloor', 'Scattering pebbles…'], ['forgeWall', 'Stoking the forge…'], ['forgeFloor', 'Pouring iron…'], ['wood', 'Splitting timber…'], ['hideoutWall', 'Raising the hideout…'], ['metal', 'Tempering steel…'], ['rock', 'Breaking rock…'], ['leather', 'Tanning hides…'], ['cloth', 'Weaving cloth…'], ['bone', 'Gathering bones…'], ['scales', 'Growing scales…'], ['skin', 'Sculpting heroes…']];
    for (let i = 0; i < steps.length; i++) { document.getElementById('bootMsg').textContent = steps[i][1]; document.getElementById('bootBar').style.width = (i / (steps.length + 3) * 100) + '%'; document.getElementById('bootPct').textContent = Math.round(i / (steps.length + 3) * 100) + '%'; await new Promise(r => setTimeout(r, 10)); G.tex.get(steps[i][0]); }
    document.getElementById('bootMsg').textContent = 'Summoning the party…'; await new Promise(r => setTimeout(r, 10));
    G.fx.init(); G.Lights.init(); G.ui.init();
    this.buildMenuScene();
    document.getElementById('bootBar').style.width = '100%'; document.getElementById('bootPct').textContent = '100%';
    await new Promise(r => setTimeout(r, 10));
    // show the menu first; shaders compile on the first frames instead of blocking the loading screen
    G.ui.show('menu'); G.state = 'menu';
    try { G.net.init().catch(e => console.warn('net init', e)); } catch (e) { console.warn('net init', e); }
    try { G.ui.applySettings(); } catch (e) { console.warn('settings', e); }
    this.last = performance.now(); requestAnimationFrame(t => this.loop(t));
    addEventListener('pointerdown', () => { if (!G.audio.ctx) { G.audio.init(); G.audio.ambient(G.state === 'play' ? (G.run.active ? G.run.dungeon : 'hideout') : 'menu'); } }, { once: true });
  },
  pr() { return G.settings.quality === 'low' ? 0.7 : G.settings.quality === 'med' ? 1 : Math.min(devicePixelRatio, 1.5); },
  resize() { G.renderer.setPixelRatio(this.pr()); G.renderer.setSize(innerWidth, innerHeight); G.composer.setSize(innerWidth, innerHeight); G.post.resize(); G.camera.aspect = innerWidth / innerHeight; G.camera.updateProjectionMatrix(); if (G.fx.add) G.fx.add.p.material.uniforms.pr.value = G.fx.norm.p.material.uniforms.pr.value = G.renderer.getPixelRatio(); },
  sceneId() { return G.state !== 'play' ? 'menu' : G.run.active ? `run:${G.run.id}:${G.run.step}` : 'hideout'; },
  setAtmos(theme) {
    const fog = { crypt: [0x0c1012, 0.05], warrens: [0x081412, 0.046], forge: [0x1a0806, 0.04], hideout: [0x140e0a, 0.022], menu: [0x0b0910, 0.045] }[theme];
    G.scene.fog.color.setHex(fog[0]); G.scene.fog.density = fog[1]; G.scene.background.setHex(fog[0]);
    const h = G.DUNGEONS[theme] ? G.DUNGEONS[theme].hemi : theme === 'hideout' ? [0x8a7060, 0x201810] : [0x5a5a7a, 0x10100c];
    G.hemi.color.setHex(h[0]); G.hemi.groundColor.setHex(h[1]); G.hemi.intensity = theme === 'hideout' ? 0.55 : theme === 'forge' ? 0.45 : 0.35;
    G.Lights.init(); G.Atmos.init(theme);
    if (G.audio.ctx) G.audio.ambient(theme);
  },

  /* ---------------- menu diorama ---------------- */
  buildMenuScene() {
    G.World.buildMenu(); this.setAtmos('menu'); G.enemies.clear(); G.fx.reset();
    G.Lights.playerLight.position.set(0, 3, 6); G.Lights.playerLight.intensity = 0.6;
    this.menuT = 0;
  },
  updateMenu(dt, t) {
    this.menuT += dt; const W = G.World, H = W.menuHeroes || {};
    Object.entries(H).forEach(([c, h]) => { h.st.t += dt; const foc = this.menuFocus === c; if (foc && Math.random() < dt * 0.3 && h.st.atk < 0) { h.st.atk = 0; h.st.atkKind = c === 'archer' ? 'shoot' : c === 'wizard' || c === 'priest' ? 'cast' : 'slash'; } if (h.st.atk >= 0) { h.st.atk += dt * 1.6; if (h.st.atk > 1) h.st.atk = -1; } M.anim(h.R, h.st); });
    let cp, look;
    if (this.menuFocus && H[this.menuFocus]) { const h = H[this.menuFocus], p = h.R.root.position; cp = new G.V3(p.x * 2.1, 1.7, p.z * 2.1 + 0.6); look = new G.V3(p.x, 1.25, p.z); }
    else { const a = this.menuT * 0.06; cp = new G.V3(Math.sin(a) * 8.5, 3.2 + Math.sin(this.menuT * 0.2) * 0.4, Math.cos(a) * 8.5); look = new G.V3(0, 1.2, 0); }
    G.camera.position.lerp(cp, Math.min(1, dt * 2.2)); this.menuLook = (this.menuLook || look.clone()).lerp(look, Math.min(1, dt * 3)); G.camera.lookAt(this.menuLook);
    if (Math.random() < 0.5) G.fx.fire(new G.V3(0, 0.3, 0), 1, 0.3, 0.6, 2); if (Math.random() < 0.2) G.fx.embers(new G.V3(0, 0.6, 0), 2, 0.4);
  },
  toMenu() {
    if (G.run.active) { G.run.active = false; }
    G.state = 'menu'; this.clearPlayer(); document.getElementById('hud').hidden = true; G.ui.releasePointer();
    this.buildMenuScene(); G.ui.show('menu'); this.menuFocus = null; G.net.pushPresence(true);
  },
  clearPlayer() { if (G.player && G.player.V) G.camera.remove(G.player.V.root); G.player = null; G.pickups.forEach(p => G.scene.remove(p.m)); G.pickups = []; G.proj.reset(); Object.keys(G.net.remotes).forEach(k => G.net.dropRemote(k)); },

  /* ---------------- hideout ---------------- */
  async enterHideout() {
    G.loading = true; G.ui.loader.show('The Hideout', 'Returning to safety', '#d9b46a');
    await G.ui.loader.step(10, 'Lighting the hearth…');
    G.run.active = false; this.clearPlayer(); G.enemies.clear(); G.fx.reset(); G.Amb.clear(); G.ui.deathScreen(false); if (G.cine.active) G.cine.abort();
    await G.ui.loader.step(35, 'Sweeping the floors…');
    G.World.buildHideout(); this.setAtmos('hideout');
    await G.ui.loader.step(80, 'Waking the merchants…');
    G.player = G.makePlayer(G.cls); G.player.buildVM();
    const sp = G.World.spawnPoint; G.player.pos.set(sp.x + (Math.random() - 0.5) * 3, 0, sp.z + (Math.random() - 0.5) * 2); G.player.yaw = 0;
    G.state = 'play'; G.ui.show(null); document.getElementById('hud').hidden = false; document.getElementById('boss').hidden = true; G.ui.bossE = null;
    G.ui.buildAbBar(); G.ui.refreshUpgrades(); G.ui.ready = false;
    document.getElementById('floorName').textContent = 'The Hideout'; document.getElementById('floorSub').textContent = G.net.party ? `Party ${G.net.code}` : 'Safe haven';
    G.ui.banner('The Hideout', 'Rest · Upgrade · Prepare'); G.net.pushPresence(true); G.net.advertise();
    try { G.renderer.compile(G.scene, G.camera); } catch (e) { }
    await G.ui.loader.step(100, 'Ready');
    G.loading = false; G.ui.loader.hide(); G.ui.lockSoon();
    if (this.pendingStart) { const d = this.pendingStart; this.pendingStart = null; this.netStart(d); }
  },
  rebuildPlayerGear(newClass) {
    const P = G.player; if (!P) return;
    if (newClass) { const pos = P.pos.clone(), yaw = P.yaw; G.camera.remove(P.V.root); G.player = G.makePlayer(G.cls); G.player.pos.copy(pos); G.player.yaw = yaw; }
    else { P.wpnLv = G.save.cls[P.cls].wpn; P.wpnMul = 1 + P.wpnLv * 0.3; }
    G.player.buildVM(); G.ui.buildAbBar(); G.net.pushPresence(true);
  },

  /* ---------------- runs ---------------- */
  hostStartRun(dg) {
    const np = G.net.party ? Math.max(1, G.net.members().filter(p => p.presence.s === 'hideout').length) : 1;
    const d = { id: Math.floor(Math.random() * 2e9), dg, np };
    if (G.net.party) G.net.emit('start', d);
    this.netStart(d);
  },
  netStart(d) {
    if (G.loading && !G.run.active) { this.pendingStart = d; return; }
    if (G.run.active || G.state !== 'play' || !G.DUNGEONS[d.dg]) return;
    if (G.ui.modalOpen()) { document.getElementById('panelM').hidden = true; G.dialog.close(false); }
    const id = d.id | 0;
    G.run = { active: true, id, dungeon: d.dg, np: Math.min(4, Math.max(1, d.np | 0)), row: -1, col: 0, step: -1, depth: 0, map: G.RunMap.gen(id, d.dg), path: [], keys: 0, miniDone: false, kills: 0, bosses: 0, reveal: -1 };
    const keepCls = G.cls; this.clearPlayer(); G.player = G.makePlayer(keepCls); G.player.buildVM();
    G.ui.buildAbBar(); G.ui.refreshUpgrades(); G.ui.refreshSheetBadge(); G.ui.refreshRelics(); G.ui.ready = false;
    G.net.advertise(); G.sfx('portal', 1);
    this.loadNode(0, 0);
  },
  NODE_INTRO: {
    elite: ['Banners of dead champions hang here. Their killers still walk these halls.', 'The stones are scored with claw marks. Something strong hunts on this level.'],
    puzzle: ['A sealed vault, and an old riddle carved in stone. Whoever built this wanted to be outwitted, not overpowered.'],
    treasure: ['Gold glints in the torchlight. Too much gold. Something is guarding it, or pretending to be it.'],
    shop: ['A lantern sways over a cluttered stall. "Customers! Down here! Come, come, everything must go!"'],
    rest: ['A campfire crackles in a quiet chamber. For a moment, the dungeon holds its breath.'],
    event: ['The air here feels different. The Dungeon Master leans forward.'],
    miniboss: ['A great door looms ahead, carved with warnings in a dead tongue. The Guardian waits beyond.'],
    boss: ['This is the bottom of the world. Its master is waiting for you.']
  },
  async loadNode(row, col) {
    const node = G.RunMap.node(row, col); if (!node) return;
    G.RunMap.close();
    G.run.row = row; G.run.col = col; G.run.step = row; G.run.depth = row; G.run.path.push([row, col]);
    const dg = G.DUNGEONS[G.run.dungeon], LD = G.ui.loader, N = G.NODE[node.type];
    G.loading = true; LD.show(dg.name, `${N.name} · Depth ${row}`, dg.color);
    await LD.step(3, 'Clearing the way…');
    G.enemies.clear(); G.fx.reset(); G.pickups.forEach(p => G.scene.remove(p.m)); G.pickups = [];
    const L = G.World.generate(G.run.id, G.run.dungeon, { type: node.type, depth: row, key: row * 10 + col + 1, base: row * 10000, np: G.run.np });
    await LD.step(6, 'Carving the dungeon…');
    await G.World.build(L, (p, m) => LD.set(p, m)); this.setAtmos(G.run.dungeon);
    await LD.step(88, 'Rousing the monsters…');
    L.spawns.forEach(s => { const e = G.enemies.spawn(s.id, s.type, s.x, s.z, { room: s.room, elite: s.elite, cower: s.cower }); if (e && s.key) e.key = true; });
    if (L.boss) { const b = G.World.bossSpawn, bt = node.type === 'miniboss' ? dg.bosses[0] : dg.bosses[1], bd = L.bossDoor; const rot = bd ? Math.atan2((bd.cx + 0.5) * 4 - b.x, (bd.cy + 0.5) * 4 - b.z) : Math.PI; G.enemies.spawn(row * 10000 + 3999, bt, b.x, b.z, { rot }); }
    G.Amb.init(G.run.dungeon); this.bossReady = false; this.arenaSent = false; if (G.cine.active) G.cine.abort();
    const P = G.player, sp = G.World.spawnPoint, idx = G.net.party ? Math.max(0, G.net.members().map(p => p.peer).sort().indexOf(G.net.myPeer)) : 0;
    P.pos.set(sp.x + (idx % 2 ? 1.2 : -1.2) * (idx > 0 ? 1 : 0), 0, sp.z + (L.chamber ? -1 : 1.5) + Math.floor(idx / 2) * 1.2); P.yaw = L.chamber ? 0 : Math.PI; P.downed = false; P.rabbitUsed = false;
    P.ds = null; if (P.dead) { P.pos.set(-400, 0, -400); }
    document.getElementById('floorName').textContent = dg.name; document.getElementById('floorSub').textContent = `${N.name} · Depth ${row} of ${G.RunMap.ROWS - 1}`;
    document.getElementById('boss').hidden = true; G.ui.bossE = null;
    this.percT = 0; this.lastTrapLine = 0;
    G.net.pushPresence(true);
    await LD.step(95, 'Kindling the torches…');
    try { G.renderer.compile(G.scene, G.camera); } catch (e) { }
    await LD.step(100, 'Descend');
    G.loading = false; LD.hide();
    G.ui.banner(N.name, row === 0 ? dg.name : `Depth ${row}`);
    setTimeout(() => G.dm.say(row === 0 ? G.pick(G.DM_LINES.arrive[G.run.dungeon]) : G.pick(this.NODE_INTRO[node.type] || G.DM_LINES.arrive[G.run.dungeon])), 1400);
    G.ui.lockSoon();
  },
  netFloor(d) {
    if (G.loading) { setTimeout(() => this.netFloor(d), 300); return; }
    if (!G.run.active || d.r !== G.run.id) return;
    if (d.k === 'map') { if ((d.s | 0) === G.run.row) G.RunMap.open(); return; }
    if (d.k === 'arena') { if ((d.s | 0) === G.run.step) this.enterArena(); return; }
    if (d.k === 'go') { if ((d.s | 0) === G.run.row + 1) this.loadNode(d.s | 0, d.c | 0); return; }
    if (d.k === 'x') { G.RunMap.close(); this.netEnd({ r: G.run.id, win: 1, x: 1, reason: 'The party slipped out of the dungeon with its spoils.' }); }
  },
  useExitPortal() {
    const ep = G.World.exitPortal; if (!ep) return;
    G.sfx('portal', 1);
    if (ep.final) { this.endRun(true, `${G.DUNGEONS[G.run.dungeon].name} has been conquered.`); return; }
    G.net.emit('floor', { k: 'map', r: G.run.id, s: G.run.row }); G.RunMap.open();
  },
  endRun(win, reason) { if (!G.run.active) return; const d = { r: G.run.id, win: win ? 1 : 0, reason: String(reason || '').slice(0, 120) }; G.net.emit('end', d); this.netEnd(d); },
  netEnd(d) {
    if (!G.run.active || d.r !== G.run.id) return;
    G.RunMap.close(); G.events.close && document.getElementById('dmCard') && (document.getElementById('dmCard').hidden = true);
    const P = G.player, win = !!d.win, S = G.save, conquered = win && !d.x;
    const bounty = conquered ? Math.round(P.runGold * 0.25) : 0;
    const keptGold = win ? P.runGold + bounty : Math.floor(P.runGold / 2), items = win ? P.backpack.map(it => Object.assign({}, it, { name: it.magic ? G.magicName(it) : it.name, attuned: false })) : [];
    S.gold += keptGold; items.forEach(it => S.stash.push(it)); S.runs++; S.kills += P.kills; S.bossKills += G.run.bosses; G.persist();
    const st = { dungeon: G.run.dungeon, kills: P.kills, bosses: G.run.bosses, gold: keptGold, bounty, items: items.length, upgrades: P.upgrades.slice(), level: P.level, depth: G.run.row, relics: P.relics.slice(), reason: d.reason || (win ? 'Victory!' : 'Your expedition has ended.'), extracted: !!d.x };
    G.run.active = false; this.enterHideout().then(() => G.ui.results(win, st));
    G.sfx(win ? 'crit20' : 'groan', 1);
  },
  leaveRunSolo() { const d = { r: G.run.id, win: 0, reason: 'You abandoned the expedition.' }; this.netEnd(d); },
  playerDied() {
    G.ui.toast('You have fallen…'); G.sfx('groan', 1); G.net.pushPresence(true);
    if (!G.net.party) { setTimeout(() => { if (G.run.active) this.endRun(false, 'You have fallen in the depths. You wake in the hideout.'); }, 2500); return; }
    G.ui.deathScreen(true);
  },
  /* ---------------- death saves from allies, shrines of returning ---------------- */
  tendAlly(peer, name) {
    const P = G.player, o = { skill: 'Medicine', dc: 10, adv: P.cls === 'priest', noReroll: true }, r = G.sheet.resolve(P, o);
    G.sfx('dice', 0.6);
    G.ui.checkChip({ title: `Medicine · tending ${name}`, nat: r.nat, sides: 20, bonus: r.bonus, dc: 10, ok: r.success, line: r.success ? `You get ${name} back on their feet` : `${name} slips further away${r.nat1 ? ' (counts twice)' : ''}` });
    G.net.sendSup({ k: 'dsave', to: peer, ok: r.success ? 1 : 0, nat: r.nat, by: G.settings.name || 'An ally', pr: P.cls === 'priest' ? 1 : 0 });
    if (r.success) { const rp = G.net.remotes[peer]; if (rp) G.fx.holy(new G.V3(rp.pos.x, 0.2, rp.pos.z), 30, 1); G.sfx('heal', 1); G.sheet.gainXp(P, 20, 'rescue'); }
  },
  useShrine(sh, peer) {
    if (sh.used) return; sh.used = true; G.World.shrineUsed(sh, true);
    G.net.sendSup({ k: 'resurrect', to: peer, x: sh.x, z: sh.z, by: G.settings.name || 'An ally' }); G.net.sendFx({ k: 'shrine', i: sh.id });
    G.ui.toast('The shrine flares. A soul is called back.'); G.sheet.gainXp(G.player, 30, 'shrine');
  },
  resurrect(d) {
    const P = G.player; if (!P || !P.dead) return;
    P.dead = false; P.downed = false; P.ds = null; P.hp = Math.round(P.maxHp * 0.5); P.pos.set(+d.x + 1.4, 0, +d.z + 1.4); P.iframes = 2;
    G.ui.deathScreen(false); G.fx.holy(new G.V3(P.pos.x, 0.2, P.pos.z), 60, 1.5); G.fx.beam(new G.V3(P.pos.x, 0, P.pos.z), 0xffe08a, 10, 1, 0.8); G.sfx('holy', 1);
    G.ui.banner('Returned', `${String(d.by || 'An ally').slice(0, 20)} called you back from death`); G.dm.say('Light pours into the dark. You draw breath again, cold and shaking, but alive.');
    G.net.pushPresence(true); G.ui.lockSoon();
  },
  applyUpgrade(u) { const P = G.player; G.sheet.applyChange(P, () => { u.ap(P.mods, P); P.upgrades.push(u); }); P.hp = Math.min(P.hp, P.maxHp); P.sta = Math.min(P.maxSta, P.sta + 30); G.ui.refreshUpgrades(); G.fx.burst(new G.V3(P.pos.x, 1, P.pos.z), parseInt(G.TIERS[u.t].color.slice(1), 16), 40, 4); },

  /* ---------------- items, relics, keys ---------------- */
  giveItem(it) {
    const P = G.player, dg = G.DUNGEONS[G.run.dungeon || 'crypt'];
    const copy = Object.assign({}, it, { value: Math.round(it.value * (it.magic || it.scroll ? 1 : dg.loot)) });
    if (P.backpack.length < P.slots) { P.backpack.push(copy); G.sfx('pickup', 0.8); G.ui.toast(`${copy.magic ? G.magicName(copy) : copy.name} added to your pack`); }
    else { const f = P.forward(); const pk = this.spawnPickup('item', new G.V3(P.pos.x + f.x, 1, P.pos.z + f.z), 0, Object.assign({}, it)); pk.v.set(0, 2, 0); G.ui.toast('Backpack full · the item falls at your feet'); }
  },
  gainRelic(id) {
    const P = G.player, R = G.RELICS[id];
    if (P.relics.includes(id)) { P.runGold += 100; G.ui.toast(`You already carry the ${R.name} · +100 gold`); G.sfx('coin', 1); return; }
    G.sheet.applyChange(P, () => P.relics.push(id));
    if (id === 'lucky') P.luck = 3;
    G.sfx('level', 1); G.ui.banner(R.name, R.desc); G.ui.refreshRelics();
    G.ui.checkChip({ title: 'Relic', icon: R.icon, line: `${R.name}: ${R.desc}`, ok: true });
    G.fx.burst(new G.V3(P.pos.x, 1.2, P.pos.z), 0xffc060, 40, 4);
    if (id === 'map') this.revealFloor(true);
  },
  identifyAll() { let n = 0; G.player.backpack.forEach(it => { if (it.magic && !it.identified) { it.identified = true; n++; } }); if (n) G.sfx('magic', 0.8); return n; },
  revealFloor(quiet) { (G.World.gates || []).forEach(g => { if (g.type === 'secret') g.noticed = true; }); (G.World.traps || []).forEach(t => t.found = true); if (!quiet) G.sfx('magic', 0.6); },
  ambush(x, z, types, elite) {
    const W = G.World, list = [], affixes = Object.keys(G.enemies.AFFIX);
    types.forEach((t, i) => { let px = x, pz = z; for (let k = 0; k < 14; k++) { const a = Math.random() * 6.28, r = 3 + Math.random() * 4; px = x + Math.sin(a) * r; pz = z + Math.cos(a) * r; if (!W.isWall(px, pz) && W.los(x, z, px, pz)) break; px = x; pz = z; }
      list.push([G.run.step * 10000 + 8000 + Math.floor(Math.random() * 1999), G.ALL_TYPES.indexOf(t), Math.round(px * 10) / 10, Math.round(pz * 10) / 10, elite && i === 0 ? 1 + Math.floor(Math.random() * affixes.length) : 0]); });
    this.spawnAmbush(list); G.net.sendFx({ k: 'amb', l: list });
  },
  spawnAmbush(list) {
    const affixes = Object.keys(G.enemies.AFFIX);
    list.slice(0, 6).forEach(a => { const t = G.ALL_TYPES[a[1] | 0]; if (!t) return; const e = G.enemies.spawn(a[0] | 0, t, +a[2], +a[3], { awake: true, summoned: true, elite: a[4] ? [affixes[(a[4] - 1) % affixes.length]] : null }); if (e) e.awake = true; });
    G.sfx('roar', 0.7); G.fx.shake(0.3);
  },
  /* ---------------- mimics ---------------- */
  mimicWake(c, struck, remote) {
    if (!c || c.opened) return; c.opened = true; c.woke = true;
    if (c.mesh.parent) c.mesh.parent.remove(c.mesh);
    const e = G.enemies.spawn(G.run.step * 10000 + 4000 + c.id, 'mimic', c.x, c.z, { awake: true, rot: c.rot });
    if (e) { e.awake = true; e.mimicTier = c.tier; }
    G.fx.smoke(new G.V3(c.x, 0.6, c.z), 8, 0x2a1a10, 1.4); G.sfx('roar', 0.8, c); G.fx.shake(0.3);
    G.dm.say(G.pick(G.DM_LINES.mimicAmbush));
    if (remote) return;
    const P = G.player;
    if (!struck && !P.relics.includes('irontooth')) { const dmg = Math.round(G.rollN(2, 8) * G.enemies.diff().dmg / 0.3 * 0.8); P.takeDamage(dmg, { x: c.x, z: c.z }, { unblockable: true }); G.ui.toast('The chest bites!'); }
    G.net.sendFx({ k: 'mimic', i: c.id });
  },
  /* ---------------- kills, loot, pickups ---------------- */
  onEnemyKilled(e, mine, kind) {
    const P = G.player; if (!P) return; G.run.kills++; if (mine) P.kills++;
    if (kind === 'flee') return;
    const dg = G.DUNGEONS[G.run.dungeon], greed = 1 + P.mods.greed + (G.sheet.attuned(P, 'clumsy') ? 0.5 : 0);
    const mimic = e.type === 'mimic', tooth = mimic && P.relics.includes('irontooth');
    // experience is shared by everyone who was there
    const xp = e.boss ? (e.type === dg.bosses[0] ? 220 : 400) : Math.round((e.def.xp || e.def.hp / 3.5) * (e.elite ? 2.5 : 1));
    G.sheet.gainXp(P, xp, 'kill');
    const g = Math.round(G.ri(e.def.gold[0], e.def.gold[1]) * dg.loot * greed * (e.elite ? 2 : 1) * (tooth ? 2 : 1) / Math.max(1, G.run.np * 0.7));
    const at = new G.V3(e.pos.x, 1, e.pos.z);
    for (let k = 0; k < Math.min(10, Math.ceil(g / 6)); k++) this.spawnPickup('gold', at, Math.ceil(g / Math.min(10, Math.ceil(g / 6))));
    const ic = e.boss ? 3 : mimic ? (tooth ? 4 : 2) : e.elite ? 1 : Math.random() < 0.08 * greed ? 1 : 0;
    for (let k = 0; k < ic; k++) this.spawnPickup('item', at, 0, G.rollLoot(Math.random, e.boss || mimic ? 1 : 0));
    if (mimic || (e.elite && Math.random() < 0.3) || (e.boss && Math.random() < 0.6)) this.spawnPickup('item', at, 0, G.makeMagic());
    if (e.boss || (e.elite && Math.random() < 0.25)) this.spawnPickup('item', at, 0, G.SCROLL());
    if (e.key) this.spawnPickup('key', at, 0);
    if (e.boss) {
      G.run.bosses++; const final = e.type === dg.bosses[1];
      if (!final) G.run.miniDone = true;
      G.ui.banner(final ? 'Dungeon Conquered' : 'The Guardian Falls', final ? 'Step through the golden portal to return home' : 'A portal opens. The party may press on, or vote to extract.');
      setTimeout(() => { if (G.run.active) G.World.spawnExitPortal(final); }, 1800); G.sfx('crit20', 0.8);
      setTimeout(() => { if (G.run.active && G.World.bossDoor) { G.World.bossDoor.fast = false; G.World.setBossDoor(true); } }, 3000);
    }
    if (mine && P.relics.includes('emberheart') && (e.burnT > 0 || (e.flags & 1))) { G.enemies.aoeFx('explosion', new G.V3(e.pos.x, 0.8, e.pos.z), 3, null); G.net.sendFx({ k: 'meteor', x: e.pos.x, z: e.pos.z }); for (const o of G.enemies.list) if (!o.dead && o !== e && G.dist2(o.pos.x, o.pos.z, e.pos.x, e.pos.z) < 12) G.combat.deal(o, 0, 'fire', { roll: c => G.rollN(c ? 4 : 2, 6), noChain: true }); }
    if (mine && P.mods.explodeKill) { G.enemies.aoeFx('explosion', new G.V3(e.pos.x, 0.8, e.pos.z), 3, null); for (const o of G.enemies.list) if (!o.dead && o !== e && G.dist2(o.pos.x, o.pos.z, e.pos.x, e.pos.z) < 12) G.combat.deal(o, 0, 'fire', { roll: c => G.rollN(2 * P.mods.explodeKill * (c ? 2 : 1), 8), noChain: true }); G.net.sendFx({ k: 'meteor', x: e.pos.x, z: e.pos.z }); }
    if (mine && P.mods.meteorKill) { let best = null, bd = 400; for (const o of G.enemies.list) { if (o.dead || o === e) continue; const d = G.dist2(o.pos.x, o.pos.z, P.pos.x, P.pos.z); if (d < bd) { bd = d; best = o; } } if (best) { const tx = best.pos.x, tz = best.pos.z; const tg = G.fx.telegraph(tx, tz, 3, 0.6, 0xffa030); setTimeout(() => { G.scene.remove(tg.g); G.fx.tele.splice(G.fx.tele.indexOf(tg), 1); G.enemies.aoeFx('meteor', new G.V3(tx, 0.3, tz), 3, null); G.net.sendFx({ k: 'meteor', x: tx, z: tz }); for (const o of G.enemies.list) if (!o.dead && G.dist2(o.pos.x, o.pos.z, tx, tz) < 12) G.combat.deal(o, 0, 'fire', { roll: c => G.rollN(4 * P.mods.meteorKill * (c ? 2 : 1), 6), noChain: true }); }, 600); } }
  },
  dropItem(i) {
    const P = G.player; if (P.backpack[i] && P.backpack[i].attuned && G.MAGIC[P.backpack[i].mid].cursed) { G.ui.toast('The curse will not let go of it'); G.sfx('groan', 0.5); return; }
    const item = P.backpack.splice(i, 1)[0]; if (!item) return; if (item.attuned) G.sheet.applyChange(P, () => item.attuned = false);
    const f = P.forward(); const at = new G.V3(P.pos.x + f.x * 1.1, 1.1, P.pos.z + f.z * 1.1); if (G.World.W && G.World.isWall(at.x, at.z)) at.set(P.pos.x, 1.1, P.pos.z);
    const p = this.spawnPickup('item', at, 0, Object.assign({}, item, { value: item.magic || item.scroll ? item.value : item.value / G.DUNGEONS[G.run.dungeon || 'crypt'].loot }));
    p.v.set(f.x * 2.5, 2, f.z * 2.5); p.noPick = true; G.sfx('thunk', 0.6); G.ui.toast(`Dropped ${item.magic ? G.magicName(item) : item.name}`);
  },
  spawnPickup(kind, at, amt, item) {
    const m = new THREE.Group();
    if (kind === 'gold') { M.P(m, M.cyl(0.07, 0.07, 0.015, 14), G.mat('gold'), [0, 0, 0], [Math.PI / 2, 0, 0]); }
    else if (kind === 'key') { const k = M.loot.key(); k.scale.setScalar(3); m.add(k); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.tex.sprite('glow'), color: 0xffc040, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); s.scale.setScalar(1.4); m.add(s); }
    else if (kind === 'heal') { const it = M.loot.potion(0); it.scale.setScalar(1.6); m.add(it); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.tex.sprite('glow'), color: 0xff4040, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); s.scale.setScalar(1); s.position.y = 0.2; m.add(s); }
    else { const it = M.loot[item.model](item.v); it.scale.setScalar(1.6); m.add(it); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.tex.sprite('glow'), color: item.value >= 70 ? 0xffb030 : 0x9ad0ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); s.scale.setScalar(1.2); s.position.y = 0.2; m.add(s); }
    m.position.copy(at); G.scene.add(m);
    const v = new G.V3((Math.random() - 0.5) * 4, 3 + Math.random() * 3, (Math.random() - 0.5) * 4);
    const pk = { m, kind, amt, item, v, t: 0, rest: false }; G.pickups.push(pk); return pk;
  },
  updatePickups(dt, t) {
    const P = G.player; if (!P) return;
    for (let i = G.pickups.length - 1; i >= 0; i--) {
      const p = G.pickups[i]; p.t += dt;
      const d = Math.hypot(P.pos.x - p.m.position.x, P.pos.z - p.m.position.z);
      if (p.kind === 'gold' && d < 3.2 && p.t > 0.5 && !P.dead && !P.downed) { const to = G.tmpV.set(P.pos.x - p.m.position.x, 1 - p.m.position.y, P.pos.z - p.m.position.z); p.m.position.addScaledVector(to, Math.min(1, dt * 9)); if (d < 0.7) { P.runGold += p.amt; G.sfx('coin', 0.5); G.scene.remove(p.m); G.pickups.splice(i, 1); continue; } }
      else if (!p.rest) { p.v.y -= 14 * dt; p.m.position.addScaledVector(p.v, dt); if (G.World.W && G.World.isWall(p.m.position.x, p.m.position.z)) { p.m.position.x -= p.v.x * dt; p.m.position.z -= p.v.z * dt; p.v.x *= -0.5; p.v.z *= -0.5; } if (p.m.position.y < 0.12) { p.m.position.y = 0.12; p.v.y *= -0.4; p.v.x *= 0.7; p.v.z *= 0.7; if (Math.abs(p.v.y) < 0.6) p.rest = true; } }
      p.m.rotation.y += dt * 2; if (p.rest && p.kind === 'item') p.m.position.y = 0.2 + Math.sin(t * 2.5 + i) * 0.08;
      if (p.kind === 'heal' && d < 1.4 && p.t > 0.5 && !P.dead && !P.downed) { P.heal(P.maxHp * 0.25); G.sfx('heal', 0.8); G.ui.toast('Health potion'); G.scene.remove(p.m); G.pickups.splice(i, 1); continue; }
      if (p.kind === 'heal' && p.rest) p.m.position.y = 0.2 + Math.sin(t * 2.5 + i) * 0.08;
      if (p.noPick && d > 2.6) p.noPick = false;
      if (p.kind === 'key' && p.rest) p.m.position.y = 0.4 + Math.sin(t * 2.5 + i) * 0.1;
      if (p.kind === 'key' && d < 1.6 && p.t > 0.6 && !P.dead && !P.downed) { G.run.keys++; G.net.sendFx({ k: 'keyget', rm: 1 }); G.sfx('pickup', 1); G.sfx('level', 0.5); G.ui.toast('Vault key · a sealed vault waits somewhere'); G.dm.say(G.pick(G.DM_LINES.key)); G.scene.remove(p.m); G.pickups.splice(i, 1); continue; }
      if (p.kind === 'item' && !p.noPick && d < 1.6 && p.t > 0.6 && !P.dead && !P.downed) {
        const mag = p.item.magic || p.item.scroll, val = mag ? p.item.value : Math.round(p.item.value * G.DUNGEONS[G.run.dungeon || 'crypt'].loot);
        if (P.backpack.length < P.slots) { P.backpack.push(Object.assign({}, p.item, { value: val })); G.sfx('pickup', 0.8); G.ui.toast(p.item.magic ? `${G.magicName(p.item)} · press Tab to inspect` : `${p.item.name} (+${val} g)`); G.scene.remove(p.m); G.pickups.splice(i, 1); }
        else if (!this.fullT || t - this.fullT > 3) { this.fullT = t; G.ui.toast('Backpack full · upgrade it in the hideout'); }
      }
    }
  },
  /* ---------------- breakable containers ---------------- */
  breakObj(b, mine, from) {
    if (!b || b.broken) return; b.broken = true; b.solid.r = 0;
    const W = G.World, o = b.obj; if (o.parent) o.parent.remove(o);
    const c = new G.V3(b.x, 0.45 * o.scale.y, b.z), away = from ? new G.V3(b.x - from.x, 0, b.z - from.z).normalize() : new G.V3();
    const piece = (geo, mat, sc, lift) => { const m = new THREE.Mesh(geo, mat); m.scale.copy(sc); m.position.set(b.x + (Math.random() - 0.5) * 0.4, lift + Math.random() * 0.4, b.z + (Math.random() - 0.5) * 0.4); m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); G.scene.add(m);
      const out = new G.V3(m.position.x - b.x, 0, m.position.z - b.z).normalize();
      G.fx.bodies.push({ o: m, v: new G.V3(out.x * (1.5 + Math.random() * 3) + away.x * 3, 2.5 + Math.random() * 4, out.z * (1.5 + Math.random() * 3) + away.z * 3), av: new G.V3((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16), life: 7 + Math.random() * 3, r: 0.04, fade: true }); };
    if (b.wood) {
      const wood = G.mat('wood'), dark = G.mat('dark');
      const n = b.kind === 'crate' ? 12 : 10;
      for (let i = 0; i < n; i++) piece(M.box(1, 1, 1), wood, new G.V3(0.05 + Math.random() * 0.06, 0.25 + Math.random() * 0.35, 0.025), 0.2);
      for (let i = 0; i < 8; i++) piece(M.box(1, 1, 1), wood, new G.V3(0.015, 0.06 + Math.random() * 0.1, 0.015), 0.4);   // splinters
      if (b.kind === 'barrel') for (let i = 0; i < 3; i++) piece(M.tor(0.3, 0.015, 6, 20, Math.PI * (0.6 + Math.random() * 0.8)), dark, new G.V3(1, 1, 1), 0.3);
      for (let i = 0; i < 26; i++) G.fx.emit(G.fx.norm, b.x, 0.4 + Math.random() * 0.4, b.z, (Math.random() - 0.5) * 7 + away.x * 3, 1 + Math.random() * 5, (Math.random() - 0.5) * 7 + away.z * 3, 0.9, 0.12, 0.08, [0.45, 0.3, 0.16, 1], [0.3, 0.2, 0.1, 0], 12, 1);
      G.fx.smoke(c, 6, 0x8a7a60, 1.3, 0.6); G.sfx('woodbreak', 1, c);
      if (b.kind === 'barrel' && Math.random() < 0.5) { G.fx.decal('blood', b.x, b.z, 2, 0x3a2410, 30); for (let i = 0; i < 10; i++) G.fx.emit(G.fx.norm, b.x, 0.5, b.z, (Math.random() - 0.5) * 4, 2 + Math.random() * 2, (Math.random() - 0.5) * 4, 0.7, 0.18, 0.1, [0.25, 0.14, 0.05, 0.9], [0.2, 0.1, 0.03, 0], 14, 0.5); }
    } else {
      const src = []; o.traverse(m => { if (m.isMesh && m.material) src.push(m.material); }); const clay = src[0] || G.mat('rock');
      const shard = () => new THREE.SphereGeometry(0.22, 4, 3, Math.random() * 6, 0.7 + Math.random() * 0.6, 0.6 + Math.random() * 1.6, 0.5 + Math.random() * 0.5);
      for (let i = 0; i < 14; i++) { const g = shard(); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: clay.color, map: clay.map || null, roughness: 0.85, side: THREE.DoubleSide })); m.scale.setScalar(0.7 + Math.random() * 0.6); m.position.set(b.x, 0.3 + Math.random() * 0.4, b.z); G.scene.add(m);
        const a = Math.random() * 6.28; G.fx.bodies.push({ o: m, v: new G.V3(Math.cos(a) * (2 + Math.random() * 3) + away.x * 3, 2 + Math.random() * 4, Math.sin(a) * (2 + Math.random() * 3) + away.z * 3), av: new G.V3((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18), life: 7 + Math.random() * 3, r: 0.03, fade: true }); }
      G.fx.smoke(c, 8, b.kind === 'urn' ? 0x6a6a6a : 0xa0805a, 1.4, 0.7); G.fx.mist(c, 0xb09a7a, 10, 0.6, 3); G.sfx('potbreak', 1, c);
      if (b.kind === 'urn') { G.fx.emit(G.fx.norm, b.x, 0.6, b.z, 0, 1.5, 0, 2, 0.6, 2.2, [0.3, 0.3, 0.32, 0.8], [0.3, 0.3, 0.32, 0], -0.2, 0.4); if (Math.random() < 0.4) { const sk = new THREE.Group(); M.prop.skull(sk, [0, 0, 0], 0); sk.position.set(b.x, 0.3, b.z); G.scene.add(sk); G.fx.bodies.push({ o: sk, v: new G.V3(away.x * 2, 3, away.z * 2), av: new G.V3(4, 6, 2), life: 12, r: 0.09, fade: true }); } }
    }
    G.fx.decal('crack', b.x, b.z, 1.2, 0x332a20, 20);
    if (mine) {
      G.fx.shake(0.12); G.hitstop = Math.max(G.hitstop, 0.03); G.net.sendFx({ k: 'brk', i: b.id });
      if (!G.run.active) return;
      const roll = Math.random(), greed = 1 + G.player.mods.greed, dg = G.DUNGEONS[G.run.dungeon];
      if (roll < 0.55) { const g = Math.round(G.ri(3, 10) * dg.loot * greed * (G.player.relics.includes('thiefglove') ? 2 : 1)); for (let k = 0; k < Math.min(5, Math.ceil(g / 4)); k++) this.spawnPickup('gold', c, Math.ceil(g / Math.ceil(g / 4))); }
      if (Math.random() < 0.12 * greed) this.spawnPickup('item', c, 0, G.rollLoot(Math.random, 0));
      if (Math.random() < 0.1) this.spawnPickup('heal', c, 0);
    }
  },
  breakArea(x, z, rad, mine, from) { const L = G.World.breakables; if (!L) return; for (const b of L) if (!b.broken && G.dist2(x, z, b.x, b.z) < (rad + b.rad) ** 2) this.breakObj(b, mine, from || { x, z }); },
  animateChest(c) {
    if (c.mesh.userData.opening) return; c.mesh.userData.opening = 0.001; c.opened = true; G.sfx('chest', 0.9, c);
    const lid = c.mesh.userData.lid, start = performance.now();
    const gl = c.mesh.userData.glow; const step = () => { const k = Math.min(1, (performance.now() - start) / 600); lid.rotation.x = -G.smooth(k) * 1.9; if (gl) gl.intensity = k * 1.6; if (k < 1) requestAnimationFrame(step); };
    step(); G.fx.burst(new G.V3(c.x, 0.8, c.z), c.tier >= 2 ? 0xffc040 : 0xffe0a0, 30, 3); G.Lights.flash(new G.V3(c.x, 1, c.z), 0xffc060, 4, 8, 0.8);
  },
  openChest(c) {
    if (c.mimic) { this.mimicWake(c, false); return; }
    this.animateChest(c); G.net.sendFx({ k: 'chest', i: c.id }); G.sheet.gainXp(G.player, 5, 'chest');
    const dg = G.DUNGEONS[G.run.dungeon], at = new G.V3(c.x, 0.8, c.z), greed = 1 + G.player.mods.greed;
    const gold = Math.round(G.ri(20, 45) * (1 + c.tier) * dg.loot * greed);
    for (let k = 0; k < 8; k++) this.spawnPickup('gold', at, Math.ceil(gold / 8));
    const n = 1 + c.tier + (Math.random() < 0.4 * greed ? 1 : 0); for (let k = 0; k < n; k++) this.spawnPickup('item', at, 0, G.rollLoot(Math.random, c.tier * 0.5));
    if (c.tier >= 2 || (c.tier >= 1 && Math.random() < 0.4) || Math.random() < 0.08) this.spawnPickup('item', at, 0, G.makeMagic());
    if (Math.random() < 0.15 + c.tier * 0.1) this.spawnPickup('item', at, 0, G.SCROLL());
  },

  /* ---------------- interaction ---------------- */
  interactTarget() {
    const P = G.player; if (!P || P.dead) return null; const W = G.World, px = P.pos.x, pz = P.pos.z, me = G.net.myId(), CS = W.CS;
    let best = null, bd = 1e9; const consider = (d, o) => { if (d < bd) { bd = d; best = o; } };
    if (!P.downed) {
      (W.npcs || []).forEach(n => { const d = Math.hypot(n.x - px, n.z - pz); if (d < 3.4) consider(d, n.shop ? { k: 'shop', label: 'Browse Grimble\'s wares' } : { k: 'npc', n, label: n.used[me] ? `${n.def.name} · consulted` : `Talk to ${n.def.name}` }); });
      (W.chests || []).forEach(c => { if (c.opened) return; const d = Math.hypot(c.x - px, c.z - pz); if (d < 2.6) consider(d, c.locked ? { k: 'sealed', label: 'Sealed vault · solve the puzzle to lower the bars' } : c.mimic && c.seen ? { k: 'mimic', c, label: 'Mimic! Strike first' } : { k: 'chest', c, label: 'Open chest' }); });
      if (W.exitPortal) { const d = Math.hypot(W.exitPortal.x - px, W.exitPortal.z - pz); if (d < 3.4) consider(d, { k: 'exit', label: W.exitPortal.final ? 'Return home victorious' : G.net.party ? 'Gather the party and choose a path' : 'Choose your path deeper' }); }
      if (W.theme === 'hideout') W.interact.forEach(s => { const d = Math.hypot(s.x - px, s.z - pz); if (d < s.r) consider(d, { k: 'station', s, label: `${s.label} · ${s.desc}` }); });
      if (G.run.active && W.bossDoor && !W.bossDoor.entered && W.bossDoor.target === 0) {
        const bd = W.bossDoor, ox = (bd.cx + 0.5 - bd.dir[0] * 0.85) * CS, oz = (bd.cy + 0.5 - bd.dir[1] * 0.85) * CS, d = Math.hypot(ox - px, oz - pz);
        if (d < 4.5) { const st = this.arenaCount(); consider(d - 1, { k: 'arena', label: !G.net.party ? 'Push open the great door' : this.bossReady ? `Waiting at the great door (${st.ready}/${st.all}) · E to step back` : `Ready up at the great door (${st.ready}/${st.all})` }); }
      }
      if (G.run.active) G.Puzzles.targets(px, pz, consider);
      if (G.run.active) {
        (W.gates || []).forEach(g => { if (g.open) return; const gx = (g.cx + 0.5) * CS, gz = (g.cy + 0.5) * CS, d = Math.hypot(gx - px, gz - pz); if (d > 3.6) return;
          if (g.type === 'secret') { if (g.noticed) consider(d, { k: 'gate', g, label: g.tried[me] ? 'Cracked wall · strike it to break through' : 'Cracked wall · shoulder through or strike it' }); return; }
          consider(d, { k: 'gate', g, label: g.type === 'locked' ? 'Locked door' : g.type === 'vault' ? (G.run.keys || P.relics.includes('skeletonkey') ? `Unlock the vault${G.run.keys ? ' (uses a key)' : ''}` : 'Sealed vault · it needs a key') : 'Rune-sealed passage' }); });
        (W.traps || []).forEach(t => { if (!t.armed || !t.found) return; const d = Math.hypot(t.x - px, t.z - pz); if (d < 2.2) consider(d + 0.5, { k: 'trap', t, label: t.tried[me] ? 'Pressure plate · step around it' : 'Disarm the pressure plate' }); });
        (W.pedestals || []).forEach(p => { if (p.taken) return; const d = Math.hypot(p.x - px, p.z - pz); if (d < 2.4) consider(d, { k: 'ped', p, label: p.kind === 'key' ? 'Take the vault key' : `Take the ${G.RELICS[p.relic].name} · ${G.RELICS[p.relic].desc}` }); });
        (W.events || []).forEach(ev => { if (ev.used[me]) return; const d = Math.hypot(ev.x - px, ev.z - pz); if (d < 3.4) consider(d, { k: 'event', ev, label: `${ev.def.name} · investigate` }); });
        if (W.rest && !W.rest.used[me]) { const d = Math.hypot(W.rest.x - px, W.rest.z - pz); if (d < 4) consider(d, { k: 'rest', label: 'Sit by the campfire' }); }
        G.enemies.list.forEach(e => { if (e.dead || !e.cower || e.parleyed) return; const d = Math.hypot(e.pos.x - px, e.pos.z - pz); if (d < 3.4) consider(d - 0.5, { k: 'parley', e, label: `Wounded ${e.def.name} · talk it down` }); });
      }
      Object.entries(G.net.remotes).forEach(([peer, r]) => { const m = G.net.members().find(p => p.peer === peer); if (!m || !m.presence.d || !r.root.visible) return; const d = Math.hypot(r.pos.x - px, r.pos.z - pz); if (d < 2.6) { const pr = m.presence, sv = `${'✔'.repeat(pr.ds | 0)}${'✖'.repeat(Math.min(3, pr.df | 0))}`; consider(d - 1, { k: 'revive', peer, name: pr.n || 'ally', label: pr.st ? `${pr.n || 'Ally'} is stable · hold to help them up` : `Hold to tend to ${pr.n || 'ally'} · Medicine ${G.fmt(G.sheet.bonus(P, { skill: 'Medicine' }))} vs DC 10${sv ? ' · ' + sv : ''}` }); } });
      if (G.run.active) (W.shrines || []).forEach(sh => { if (sh.used) return; const d = Math.hypot(sh.x - px, sh.z - pz); if (d > 3.2) return; const dead = G.net.party ? G.net.runMembers().filter(m => !m.sameTab && m.presence.dd) : []; consider(d, dead.length ? { k: 'shrine', sh, peer: dead[0].peer, label: `Shrine of Returning · call ${dead[0].presence.n || 'your ally'} back from death` } : { k: 'shrineIdle', label: 'Shrine of Returning · it waits for the fallen' }); });
    }
    return best;
  },
  handleInteract(dt) {
    const P = G.player; if (!P || G.ui.modalOpen() || G.state !== 'play') { G.ui.setPrompt(null); return; }
    const T = this.interactTarget();
    if (!T) { G.ui.setPrompt(null); P.reviveP = 0; return; }
    if (T.k === 'revive') { const held = G.keys.KeyE; P.reviveP = held ? P.reviveP + dt : 0; G.ui.setPrompt(`<span class="kbd">E</span>${esc(T.label)}${P.reviveP > 0 ? ` · ${Math.round(P.reviveP / 2 * 100)}%` : ''}`); if (P.reviveP >= 2) { P.reviveP = 0; this.tendAlly(T.peer, T.name); } return; }
    G.ui.setPrompt(`<span class="kbd">E</span>${esc(T.label)}`);
    if (!G.pressed.KeyE) return;
    if (T.k === 'npc') { if (!T.n.used[G.net.myId()]) G.npcTalk(T.n); else G.ui.toast(`${T.n.def.name} has nothing more for you`); }
    else if (T.k === 'chest') this.openChest(T.c);
    else if (T.k === 'mimic') { this.mimicWake(T.c, true); }
    else if (T.k === 'exit') this.useExitPortal();
    else if (T.k === 'station') { G.sfx('click'); G.ui.openPanel(T.s.id === 'portal' ? 'portal' : T.s.id); }
    else if (T.k === 'gate') this.gateDialog(T.g);
    else if (T.k === 'pz') G.Puzzles.interact(T);
    else if (T.k === 'sealed') G.ui.toast('Iron bars seal this chest. The room itself is the lock.');
    else if (T.k === 'shrine') this.useShrine(T.sh, T.peer);
    else if (T.k === 'shrineIdle') G.ui.toast('The shrine is dormant. If an ally falls for good, bring them here to call them back.');
    else if (T.k === 'arena') { if (!G.net.party) this.enterArena(); else { this.bossReady = !this.bossReady; G.net.pushPresence(true); G.sfx(this.bossReady ? 'thunk' : 'click', 0.7); G.ui.toast(this.bossReady ? 'You stand ready at the door. It opens when the whole party is here.' : 'You step back from the door'); } }
    else if (T.k === 'trap') this.disarm(T.t);
    else if (T.k === 'ped') this.takePedestal(T.p, true);
    else if (T.k === 'event') G.events.open(T.ev);
    else if (T.k === 'shop') { G.sfx('coin', 0.6); G.ui.openPanel('shop'); }
    else if (T.k === 'rest') { G.sfx('fire', 0.5); G.ui.openPanel('rest'); }
    else if (T.k === 'parley') this.parley(T.e);
  },
  // describe a check for a dialog button: "Thieves' Tools · DEX +5 · DC 13 · Advantage"
  chkLabel(o) { const P = G.player, ab = o.ab || G.SKILLS[o.skill], b = G.sheet.bonus(P, o) + (P.relics.includes('bonedice') ? 1 : 0), adv = G.sheet.advantage(P, o).adv; return `<small class="chk">${o.skill || G.AB_NAME[ab] + (o.save ? ' save' : '')} · ${ab} ${G.fmt(b)} · DC ${o.dc}${adv ? ' · Advantage' : ''}</small>`; },
  gateDialog(g) {
    const P = G.player, me = G.net.myId(), depthDc = Math.floor((G.run.depth || 0) / 3), sk = P.relics.includes('skeletonkey');
    const opts = [], close = () => G.dialog.close();
    const tryCheck = (key, o, ok, fail) => { g.tried[me + key] = true; G.dialog.close(false); G.dice.check(o, res => { if (res.success) { G.World.openGate(g.id, true); G.sheet.gainXp(P, 25, 'gate'); ok && ok(res); } else fail && fail(res); G.ui.lockSoon(); }); };
    if (g.type === 'secret') {
      const o = { skill: 'Athletics', dc: 11 + depthDc };
      if (!g.tried[me]) opts.push({ label: `Shoulder through the crumbling stone ${this.chkLabel(o)}`, fn: () => { g.tried[me] = true; tryCheck('', o, null, r => { G.ev.hurt(G.rollN(1, 4)); G.ui.toast('The wall holds. Your shoulder does not.'); }); } });
      opts.push({ label: 'Step back', fn: close });
      G.dialog.open({ name: 'Cracked Wall', role: 'Secret', color: '#9ad8ff', text: 'Hairline cracks spider across this section of wall, and cold air hisses through them. Three solid blows would bring it down. Or you could put your shoulder into it.', options: opts }); return;
    }
    if (g.type === 'vault') {
      if (G.run.keys > 0 || sk) { G.World.openGate(g.id, true, sk && !G.run.keys); G.sheet.gainXp(P, 30, 'vault'); G.ui.toast(sk && !G.run.keys ? 'The Skeleton Key turns in the lock' : 'The key turns. The vault grinds open.'); }
      else { G.ui.toast('The vault needs a key. Search the level, or hunt the elite who carries it.'); G.sfx('thunk', 0.5); }
      return;
    }
    if (g.type === 'locked') {
      const pick = { skill: "Thieves' Tools", dc: g.dc + depthDc, adv: P.cls === 'rogue' }, force = { skill: 'Athletics', dc: g.dc + 2 + depthDc };
      if (sk) opts.push({ label: 'Use the Skeleton Key', fn: () => { G.dialog.close(); G.World.openGate(g.id, true); } });
      if (!g.tried[me + 'pick']) opts.push({ label: `Pick the lock ${this.chkLabel(pick)}`, fn: () => tryCheck('pick', pick, () => G.ui.toast('Click. The door swings open.'), r => { if (r.nat1) { G.ui.toast('Your pick snaps and gouges your hand'); G.ev.hurt(G.rollN(1, 4)); } else G.ui.toast('The tumblers will not set'); }) });
      if (!g.tried[me + 'force']) opts.push({ label: `Force it open ${this.chkLabel(force)}`, fn: () => tryCheck('force', force, () => { G.ui.toast('The frame splinters!'); G.fx.shake(0.4); }, r => { if (r.nat1) { G.ui.toast('You bounce off and wrench your shoulder'); G.ev.hurt(G.rollN(1, 6)); } else G.ui.toast('The door shudders but holds'); }) });
      if (!opts.length) { G.ui.toast('You have done all you can with this door. Perhaps an ally can open it.'); return; }
      opts.push({ label: 'Leave it', fn: close });
      G.dialog.open({ name: 'Iron-Banded Door', role: 'Locked', color: '#b07040', text: P.cls === 'rogue' ? 'An old lock, but a good one. Your fingers itch for your picks. This is your kind of door.' : 'Heavy oak bound in iron, with a lock the size of your fist. Something worth guarding lies beyond.', options: opts }); return;
    }
    if (g.type === 'rune') {
      const o = { skill: 'Arcana', dc: g.dc + depthDc, adv: P.cls === 'wizard' };
      if (sk) opts.push({ label: 'Use the Skeleton Key', fn: () => { G.dialog.close(); G.World.openGate(g.id, true); } });
      if (!g.tried[me]) opts.push({ label: `Speak the words of unsealing ${this.chkLabel(o)}`, fn: () => { g.tried[me] = true; tryCheck('', o, () => G.ui.toast('The runes unravel into light'), r => { const n = G.rollN(r.nat1 ? 3 : 2, 6); G.ev.hurt(n, 'magic'); G.fx.burst(G.player.pos.clone().setY(1.2), 0xa070ff, 30, 4); G.ui.toast(`Arcane backlash! ${n} damage`); }); } });
      if (!opts.length) { G.ui.toast('The runes reject you. Perhaps an ally can read them.'); return; }
      opts.push({ label: 'Leave it', fn: close });
      G.dialog.open({ name: 'Rune Seal', role: 'Arcane shortcut', color: '#a070ff', text: P.cls === 'wizard' ? 'A warding glyph of the old school. You know this script. With care, you can unweave it and open a shortcut through the rock.' : 'Violet runes crawl across a sealed archway. Beyond, a passage cuts straight through the rock. Misread them, and they will burn.', options: opts });
    }
  },
  disarm(t) {
    const P = G.player, me = G.net.myId(); if (t.tried[me]) { G.ui.toast('You won\'t risk it again. Step around it.'); return; }
    t.tried[me] = true;
    G.dice.check({ skill: "Thieves' Tools", dc: t.dc, adv: P.cls === 'rogue' }, res => {
      if (res.success) { t.armed = false; G.sheet.gainXp(P, 20, 'trap'); G.ui.toast('Trap disarmed'); G.sfx('thunk', 0.8); G.net.sendFx({ k: 'trap', i: t.id, d: 1 }); }
      else if (res.nat1 || res.total <= t.dc - 5) { G.ui.toast('Click.'); this.triggerTrap(t, true); }
      else G.ui.toast('Too risky. Better to step around it.');
      G.ui.lockSoon();
    });
  },
  triggerTrap(t, mine) {
    if (!t.armed) return; t.armed = false;
    const P = G.player, c = new G.V3(t.x, 0.2, t.z), k = 1 + (G.run.depth || 0) * 0.12;
    t.mesh.position.y = -0.04; G.sfx('thunk', 1, c);
    if (t.kind === 'darts') { for (let i = 0; i < 6; i++) { const a = Math.random() * 6.28, o = new G.V3(t.x + Math.sin(a) * 3, 1 + Math.random() * 0.6, t.z + Math.cos(a) * 3), d = new G.V3(t.x - o.x, 0.2 - o.y + 1, t.z - o.z).normalize(); G.proj.spawn({ kind: 'arrow', pos: o, dir: d, speed: 40, owner: 'remote', dmg: 0, life: 0.3 }); } G.sfx('arrow', 1, c); }
    if (t.kind === 'spikes') { t.spikeT = 0; G.sfx('stab', 1, c); G.sfx('clang', 0.6, c); G.fx.spark(new G.V3(t.x, 0.4, t.z), 0xffffff, 14, 4); }
    if (t.kind === 'fire') { G.fx.fire(new G.V3(t.x, 0.2, t.z), 60, 0.8, 1.6, 7); G.Lights.flash(new G.V3(t.x, 1.5, t.z), 0xff6020, 6, 9, 0.8); G.sfx('firecast', 1, c); G.sfx('boom', 0.4, c); G.fx.decal('scorch', t.x, t.z, 2.6, 0xffffff, 40); }
    if (t.kind === 'gas') { G.fx.mist(new G.V3(t.x, 0.6, t.z), 0x70c040, 30, 2.5, 4); G.fx.smoke(new G.V3(t.x, 0.6, t.z), 14, 0x4a7a30, 2.4, 1.4); G.sfx('sizzle', 1, c); }
    if (!mine) return;
    G.net.sendFx({ k: 'trap', i: t.id });
    if (Date.now() - (this.lastTrapLine || 0) > 20000) { this.lastTrapLine = Date.now(); G.dm.say(G.pick(G.DM_LINES.trapHit)); }
    if (t.kind === 'gas') { const sv = G.sheet.resolve(P, { ab: 'CON', save: true, dc: t.dc }); const n = Math.round(G.rollN(2, 6) * k * (sv.success ? 0.5 : 1)); P.addDot(n / 4, 4, 'poison'); G.ui.checkChip({ title: 'CON save', nat: sv.nat, sides: 20, bonus: sv.bonus, dc: sv.dc, ok: sv.success, line: sv.success ? `You hold your breath: ${n} poison` : `You choke on the fumes: ${n} poison`, quiet: true }); return; }
    const dice = t.kind === 'darts' ? 2 : 3, dmg = Math.round(G.rollN(dice, t.kind === 'darts' ? 6 : 6) * k);
    P.takeDamage(dmg, { x: t.x + 0.01, z: t.z + 0.01 }, { unblockable: true, save: true, dc: t.dc, trap: true, type: t.kind === 'fire' ? 'fire' : 'phys' });
  },
  takePedestal(p, mine) {
    if (p.taken) return; const P = G.player;
    if (mine && p.kind === 'relic' && G.World.layout && G.World.layout.chamber && P.pedClaim === G.run.step) { G.ui.toast('You have already claimed your relic here. Leave the rest for your allies.'); return; }
    p.taken = true; const fl = p.mesh.userData.float; fl.visible = false; G.fx.burst(new G.V3(p.x, 1.5, p.z), 0xffc060, 30, 3);
    if (p.kind === 'key') { G.run.keys++; if (mine) { G.sfx('pickup', 1); G.ui.toast('Vault key'); G.dm.say(G.pick(G.DM_LINES.key)); } }
    else if (mine) { P.pedClaim = G.run.step; this.gainRelic(p.relic); }
    if (mine) G.net.sendFx({ k: 'ped', i: p.id });
  },
  parley(e) {
    const P = G.player, dc = 12 + Math.floor((G.run.depth || 0) / 3); e.parleyed = true;
    const pers = { skill: 'Persuasion', dc }, intim = { skill: 'Intimidation', dc: dc + 1 };
    const fight = (why) => { G.ui.toast(why); this.parleyOutcome(e, 'fight', true); };
    const after = (fn) => (res) => { fn(res); G.ui.lockSoon(); };
    G.dialog.open({ name: `Wounded ${e.def.name}`, role: 'Cornered', color: '#a03030', text: G.pick(['It cowers against the wall, weapon shaking in its grip. It will not last long, and it knows it.', 'Bleeding and cornered, it bares its teeth, but there is fear in its eyes. Maybe it can be reasoned with.', 'It drops to its knees as you approach, gibbering something that might be a plea.']),
      options: [
        { label: `Persuade it to talk ${this.chkLabel(pers)}`, fn: () => { G.dialog.close(false); G.dice.check(pers, after(r => { if (r.success) { G.game.revealFloor(); G.run.reveal = G.run.step; G.sheet.gainXp(P, 30, 'parley'); G.dm.say('It whispers where the traps lie and where the walls are hollow, then flees into the dark.'); this.parleyOutcome(e, 'flee', true); } else fight(r.nat1 ? 'It shrieks for help!' : 'It lunges at you!'); if (r.nat1) G.ev.ambush(2); })); } },
        { label: `Demand its loot ${this.chkLabel(intim)}`, fn: () => { G.dialog.close(false); G.dice.check(intim, after(r => { if (r.success) { const at = new G.V3(e.pos.x, 1, e.pos.z), g = Math.round(G.ri(25, 50) * G.DUNGEONS[G.run.dungeon].loot); for (let k = 0; k < 6; k++) this.spawnPickup('gold', at, Math.ceil(g / 6)); if (Math.random() < 0.6) this.spawnPickup('item', at, 0, Math.random() < 0.3 ? G.makeMagic() : G.rollLoot(Math.random, 0.3)); G.sheet.gainXp(P, 20, 'parley'); G.dm.say('It throws down everything it carries and scrambles away.'); this.parleyOutcome(e, 'flee', true); } else fight('It decides it has nothing left to lose!'); })); } },
        { label: 'Show mercy', fn: () => { G.dialog.close(); G.sheet.gainXp(P, 15, 'mercy'); G.dm.say('It stares at you, then limps away into the dark.'); this.parleyOutcome(e, 'flee', true); } },
        { label: 'Finish it', fn: () => { G.dialog.close(); e.cower = false; G.combat.deal(e, e.hp + 50, 'slash', { raw: true, noChain: true, noCrit: true }); } }
      ] });
  },
  parleyOutcome(e, o, mine) {
    if (!e || e.dead) return;
    if (o === 'fight') { e.cower = false; e.st.crouch = 0; e.awake = true; if (G.net.isHost()) { G.enemies.wake(e); e.cds && Object.keys(e.cds).forEach(k => e.cds[k] = 0); } }
    if (o === 'flee' && G.net.isHost()) G.net.killEnemy(e, 'flee');
    if (mine) G.net.sendFx({ k: 'parley', i: e.id, o });
  },
  /* ---------------- the boss arena: ready up, enter together, the door seals ---------------- */
  arenaCount() {
    if (!G.net.party) return { ready: 0, all: 1 };
    const alive = G.net.runMembers().filter(p => !p.presence.dd);
    return { all: alive.length, ready: alive.filter(p => p.sameTab ? this.bossReady : p.presence.bd === G.run.step).length };
  },
  updateArena() {
    const W = G.World; if (!G.run.active || !W.bossDoor || W.bossDoor.entered || this.arenaSent || !G.net.party || !G.net.isHost() || G.loading) return;
    const st = this.arenaCount(); if (st.all && st.ready >= st.all) { this.arenaSent = true; const d = { k: 'arena', r: G.run.id, s: G.run.step }; G.net.emit('floor', d); this.netFloor(d); }
  },
  enterArena() {
    const W = G.World, P = G.player; if (!W.bossDoor || W.bossDoor.entered || G.cine.active) return;
    W.bossDoor.entered = true; this.bossReady = false; G.net.pushPresence(true);
    const list = []; if (P && !P.dead) list.push({ key: G.net.myPeer || 'me', cls: P.cls, w: P.wpnLv, me: true, name: G.settings.name });
    if (G.net.party) G.net.members().forEach(p => { if (p.sameTab || !G.net.inMyScene(p) || p.presence.dd) return; list.push({ key: p.peer, cls: G.CLASSES.includes(p.presence.c) ? p.presence.c : 'knight', w: G.clamp(p.presence.w | 0, 0, 4), name: p.presence.n }); });
    list.sort((a, b) => a.key < b.key ? -1 : 1);
    G.cine.play(list);
  },
  /* ---------------- perception: traps, mimics, secrets ---------------- */
  perceive(dt, t) {
    const P = G.player, W = G.World; if (!P || !G.run.active || P.dead) return;
    this.percT = (this.percT || 0) - dt; if (this.percT > 0) return; this.percT = 0.3;
    const me = G.net.myId(), dd = Math.floor((G.run.depth || 0) / 3), seeAll = P.relics.includes('map') || G.run.reveal === G.run.step;
    const roll = (o, ok, what) => { const r = G.sheet.resolve(P, Object.assign({ skill: 'Perception', noReroll: true }, o)); if (r.success) { G.ui.checkChip({ title: 'Perception', nat: r.nat, sides: 20, bonus: r.bonus, dc: r.dc, ok: true, line: what, quiet: true }); G.sheet.gainXp(P, 10, 'spot'); ok(); } };
    (W.traps || []).forEach(tr => { if (!tr.armed || tr.found || tr.rolled[me]) return; const d = Math.hypot(tr.x - P.pos.x, tr.z - P.pos.z); if (d > 6.5) return; tr.rolled[me] = true;
      roll({ dc: tr.dc }, () => { tr.found = true; G.net.sendFx({ k: 'tf', i: tr.id }); if (Date.now() - (this.lastTrapLine || 0) > 20000) { this.lastTrapLine = Date.now(); G.dm.say(G.pick(G.DM_LINES.trap)); } }, 'A pressure plate in the floor ahead'); });
    (W.chests || []).forEach(c => { if (!c.mimic || c.opened || c.seen || c.rolled) return; const d = Math.hypot(c.x - P.pos.x, c.z - P.pos.z); if (d > 6) return; c.rolled = true;
      if (P.relics.includes('irontooth')) { c.seen = true; G.ui.checkChip({ title: 'Iron Tooth', icon: '🦷', line: 'That chest is a mimic', ok: true, quiet: true }); return; }
      roll({ dc: 14 + dd }, () => { c.seen = true; G.net.sendFx({ k: 'ms', i: c.id }); G.dm.say(G.pick(G.DM_LINES.mimic)); }, 'That chest is breathing'); });
    (W.gates || []).forEach(g => { if (g.open || g.type !== 'secret' || g.noticed || g.rolled[me]) return; const d = Math.hypot((g.cx + 0.5) * W.CS - P.pos.x, (g.cy + 0.5) * W.CS - P.pos.z); if (d > 8) return;
      if (!W.los(P.pos.x, P.pos.z, (g.cx + 0.5 - g.dir[0]) * W.CS, (g.cy + 0.5 - g.dir[1]) * W.CS)) return; g.rolled[me] = true;
      if (seeAll) { g.noticed = true; return; }
      roll({ dc: 13 + dd }, () => { g.noticed = true; G.net.sendFx({ k: 'gn', i: g.id }); G.dm.say(G.pick(G.DM_LINES.secret)); }, 'A draft from a cracked wall'); });
    if (seeAll) (W.traps || []).forEach(tr => tr.found = true);
  },
  updateTraps(dt, t) {
    const P = G.player, W = G.World; if (!P || !G.run.active || P.dead || P.downed || G.mapOpen) return;
    (W.traps || []).forEach(tr => { if (!tr.armed) return; if (Math.hypot(tr.x - P.pos.x, tr.z - P.pos.z) < 0.85 && P.y < 0.15) this.triggerTrap(tr, true); });
    (W.chests || []).forEach(c => { if (!c.mimic || c.opened) return; c.mesh.scale.y = 1 + Math.sin(t * 1.6 + c.id) * 0.012; if (c.seen && c.mesh.userData.lid) c.mesh.userData.lid.rotation.x = -0.04 - Math.abs(Math.sin(t * 2.4)) * 0.07; });
  },

  /* ---------------- loop ---------------- */
  loop(now) {
    requestAnimationFrame(t => this.loop(t));
    let dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; const t = now / 1000;
    if (G.hitstop > 0) { G.hitstop -= dt; dt *= 0.08; }
    if (G.state === 'menu') { this.updateMenu(dt, t); }
    else if (G.state === 'play' && G.loading) { /* level is assembling behind the loading screen */ }
    else if (G.state === 'play') {
      const P = G.player;
      if (G.cine.active) G.cine.update(dt, t); else if (P) P.update(dt, t);
      if (G.run.active) G.enemies.update(dt, t);
      G.enemies.updateProps(dt);
      this.updatePickups(dt, t);
      this.handleInteract(dt); this.perceive(dt, t); this.updateTraps(dt, t); G.World.updateGates(dt, t); G.World.updateBossDoor(dt); G.Puzzles.update(dt, t); G.Amb.update(dt, t); this.updateArena(); G.RunMap.update(dt);
      G.net.update(dt);
      // npc animation & facing
      const npcs = (G.World.npcs || []).filter(n => n.st).concat((G.World.hideNPCs || []).map(R => ({ R, st: R._st || (R._st = { t: Math.random() * 9, move: 0, atk: -1 }) })));
      npcs.forEach(n => { n.st.t += dt; if (n.R.kind === 'hum') M.animHum(n.R, n.st); if (n.x !== undefined && P) { const a = Math.atan2(P.pos.x - n.x, P.pos.z - n.z); n.R.root.rotation.y = G.lerpAng(n.R.root.rotation.y, a, dt * 2); } if (n.R.skull) n.R.skull.rotation.y = Math.sin(n.st.t) * 0.3; });
      G.ui.update(dt);
      this.partyHudT = (this.partyHudT || 0) - dt; if (this.partyHudT <= 0) { this.partyHudT = 0.5; G.ui.partyFrames(); }
    }
    // world ambience
    G.World.animated.forEach(a => { if (a.portal) a.portal.userData.spin.forEach((s, i) => s.rotation.z += dt * (i ? -0.6 : 0.4)); if (a.spin) { if (a.axis === 'y') a.spin.rotation.y += dt * a.sp; else a.spin.rotation.z += dt * a.sp; } if (a.bob) a.bob.position.y = a.y + Math.sin(t * 2) * 0.1; if (a.swing) { a.swing.rotation.x = Math.sin(t * a.sp + (a.ph || (a.ph = Math.random() * 9))) * a.amp; a.swing.rotation.z = Math.cos(t * a.sp * 0.77 + a.ph) * a.amp * 0.7; } });
    M.flickerFlames(t); if (G._lava) G._lava.uniforms.t.value = t;
    if (G.state === 'play' && G.World.theme === 'forge' && Math.random() < 0.3 && G.World.lava) { const L = G.pick(G.World.lava); G.fx.embers(new G.V3(L.x + (Math.random() - 0.5) * L.w * 2, 0.1, L.z + (Math.random() - 0.5) * L.d * 2), 1, 0.5); }
    this.cullT = (this.cullT || 0) - dt; if (this.cullT <= 0) { this.cullT = 0.25; G.World.cull(G.camera); }
    G.fx.update(dt, t); G.Lights.update(dt, G.camera, t); G.Atmos.update(dt, G.camera.position, t);
    if (G.state !== 'play' && G.state !== 'menu') return;
    G.post.update(G.camera); G.composer.render();
    G.endFrameInput();
  }
};
window.addEventListener('load', () => G.game.init().catch(e => { console.error(e); const m = document.getElementById('bootMsg'); if (m) m.textContent = 'Something went wrong while loading: ' + e.message; }));
