/* ============================================================
   Enemies runtime: spawn, host AI, synced attack timelines,
   hit reactions, status effects, death animations by damage type
   ============================================================ */
'use strict';
G.ALL_TYPES = Object.keys(G.ENEMIES).concat(Object.keys(G.BOSSES));
G.enemies = {
  list: [], map: {}, nextId: 5000, flowT: 0, snapT: 0,
  clear() { this.list.forEach(e => { if (e.root.parent) e.root.parent.remove(e.root); }); this.list = []; this.map = {}; this.deadIds = null; this.nextId = (G.run.step || 0) * 10000 + 6000 + Math.floor(Math.random() * 300) * 5; this.boss = null; this.eliteSaidT = 0; },
  // enemy numbers live on the same dice scale as heroes (a skeleton has ~21 HP and hits for ~4)
  diff() { const dg = G.DUNGEONS[G.run.dungeon] || G.DUNGEONS.crypt; const np = Math.max(1, G.net.partySize()), dp = G.run.depth || 0; return { hp: dg.mult * (1 + 0.55 * (np - 1)) * (1 + dp * 0.16) * 0.3 * (G.player && G.player.relics && G.player.relics.includes('crown') ? 1.15 : 1), dmg: Math.pow(dg.mult, 0.85) * (1 + dp * 0.13) * 0.3 }; },
  spawn(id, type, x, z, opts = {}) {
    if (this.map[id]) return this.map[id];
    const boss = !!G.BOSSES[type], def = boss ? G.BOSSES[type] : G.ENEMIES[type]; if (!def) return null;
    const R = M.enemy[def.model || type](); M.batchRig(R); const root = new THREE.Group(); root.add(R.root);
    const mats = []; R.root.traverse(o => { if (o.isMesh && o.material) { o.material = o.material.clone(); mats.push({ m: o.material, c: o.material.color ? o.material.color.clone() : null, e: o.material.emissive ? o.material.emissive.clone() : null, ei: o.material.emissiveIntensity || 0 }); } });
    const sh = new THREE.Mesh(G.fx._dg || (G.fx._dg = new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ map: G.tex.sprite('shadow'), transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.03; sh.renderOrder = 0.8; sh.scale.setScalar(def.r * 3.2); root.add(sh);
    let bar = null;
    if (!boss) { bar = new THREE.Group(); const bg = new THREE.Mesh(G.fx._dg, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthTest: false })); bg.scale.set(1.0, 0.1, 1); bar.add(bg); const fg = new THREE.Mesh(G.fx._dg, new THREE.MeshBasicMaterial({ color: 0xd02020, depthTest: false })); fg.scale.set(0.96, 0.06, 1); fg.position.z = 0.001; bar.add(fg); bar.userData.fg = fg; bar.position.y = def.h + 0.4; bar.visible = false; bar.renderOrder = 10; bg.renderOrder = 10; fg.renderOrder = 11; root.add(bar); }
    const d = this.diff(), el = opts.elite && opts.elite.length ? opts.elite : null, hpMul = el ? 2.6 : 1;
    const e = { id, type, def, R, root, mats, bar, boss, pos: new G.V3(x, 0, z), rot: opts.rot || Math.random() * 6.28, hp: def.hp * d.hp * hpMul, maxHp: def.hp * d.hp * hpMul, dmgMul: d.dmg * (el ? 1.25 : 1),
      elite: !!el, affix: el || null, cower: !!opts.cower, shield: el && el.includes('shielded') ? def.hp * d.hp * hpMul * 0.35 : 0, spd: def.speed * (el && el.includes('frenzied') ? 1.4 : 1), tpT: 4,
      st: { t: Math.random() * 10, move: 0, phase: 0, atk: -1, atkKind: 'slash', float: R.float || def.fly }, awake: !!opts.awake, cds: {}, atk: null, flash: 0, hurt: 0,
      burnT: 0, burnDps: 0, frozenT: 0, slowT: 0, stunT: 0, bleedT: 0, bleedDps: 0, flags: 0, char: 0, decals: 0, netPos: new G.V3(x, 0, z), netRot: 0, lastHitBy: null, hitLocalT: 0, y: 0, room: opts.room };
    if (R.crouch) e.st.crouch = R.crouch;
    if (e.cower) { e.st.crouch = 1; e.hp *= 0.4; }
    if (el) this.decorateElite(e);
    root.position.copy(e.pos); root.rotation.y = e.rot; G.scene.add(root);
    def.atks.forEach((a, i) => e.cds[i] = Math.random() * (a.cd || 1) * 0.5);
    this.list.push(e); this.map[id] = e; if (boss) this.boss = e;
    if (opts.summoned) { G.fx.burst(new G.V3(x, 0.8, z), 0x9a40ff, 20, 4); G.fx.smoke(new G.V3(x, 0.3, z), 4, 0x221133, 1.4); e.awake = true; }
    return e;
  },
  AFFIX: { frenzied: ['Frenzied', 0xff3a20], vampiric: ['Vampiric', 0xa0102a], explosive: ['Explosive', 0xff9a20], shielded: ['Shielded', 0x4aa8ff], teleporting: ['Blinking', 0xb060ff] },
  decorateElite(e) {
    const col = this.AFFIX[e.affix[0]][1];
    e.R.root.scale.multiplyScalar(1.18);
    const ring = new THREE.Mesh(G.fx._dg, new THREE.MeshBasicMaterial({ map: G.tex.sprite('rune'), color: col, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; ring.renderOrder = 0.85; ring.scale.setScalar(e.def.r * 5.5); e.root.add(ring); e.auraRing = ring;
    const light = new THREE.PointLight(col, 1.6, 6, 2); light.position.y = 1.2; e.root.add(light);
    for (const o of e.mats) if (o.m.emissive) { o.e = new THREE.Color(col).multiplyScalar(0.25); o.ei = Math.max(o.ei, 0.6); o.m.emissive.copy(o.e); o.m.emissiveIntensity = o.ei; }
    // name plate: affixes over the monster's name
    const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d');
    x.textAlign = 'center'; x.font = '700 30px Cinzel, Georgia, serif'; x.fillStyle = '#' + col.toString(16).padStart(6, '0'); x.shadowColor = '#000'; x.shadowBlur = 6;
    x.fillText(e.affix.map(a => this.AFFIX[a][0]).join(' · '), 256, 36); x.font = '600 26px Cinzel, Georgia, serif'; x.fillStyle = '#ffe6b0'; x.fillText(e.def.name, 256, 74);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })); sp.scale.set(2.6, 0.5, 1); sp.renderOrder = 12; sp.position.y = e.def.h * 1.18 + 0.95; e.root.add(sp); e.plate = sp;
    if (e.bar) e.bar.scale.set(1.5, 1.4, 1);
    if (e.shield) { const b = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0x5ab0ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })); b.scale.set(e.def.r * 2.2, e.def.h * 0.8, e.def.r * 2.2); b.position.y = e.def.h * 0.55; e.root.add(b); e.bubble = b; }
  },
  players() { return G.net.allPlayers().filter(p => !p.dead && !p.downed); },
  nearestPlayer(e) { let best = null, bd = 1e9; for (const p of this.players()) { const d = G.dist2(e.pos.x, e.pos.z, p.x, p.z); if (d < bd) { bd = d; best = p; } } return best ? { p: best, d: Math.sqrt(bd) } : null; },

  /* ---------------- per-frame ---------------- */
  update(dt, t) {
    const host = G.net.isHost();
    if (host) {
      this.flowT -= dt; if (this.flowT <= 0) { this.flowT = 0.4; const ps = this.players(); if (ps.length) G.World.flow(ps); }
      this.snapT -= dt; if (this.snapT <= 0) { this.snapT = 0.1; G.net.sendSnapshot(); }
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (e.dead) { this.updateDeath(e, dt, t); continue; }
      e.st.t += dt;
      const frozen = e.frozenT > 0 || (e.flags & 2), stunned = e.stunT > 0 || (e.flags & 8);
      let chrono = 1; if (G.player && G.player.mods.chrono && G.dist2(e.pos.x, e.pos.z, G.player.pos.x, G.player.pos.z) < 144) chrono = 1 - G.player.mods.chrono;
      const slow = ((e.slowT > 0 || (e.flags & 4)) ? 0.5 : 1) * chrono;
      if (host) this.hostStatus(e, dt);
      if (!frozen) {
        if (host && !stunned) this.hostAI(e, dt * slow);
        if (e.atk && !stunned) this.updateAttack(e, dt * slow, host);
      }
      if (!host) {
        const ox = e.pos.x, oz = e.pos.z, smp = e.nb && G.netBuf.sample(e.nb, 0.12, e._smp || (e._smp = {}), true);
        const tx = smp ? smp.x : e.netPos.x, tz = smp ? smp.z : e.netPos.z, tr = smp ? smp.r : e.netRot;
        if (!e.leap) { e.pos.x = G.damp(e.pos.x, tx, 25, dt); e.pos.z = G.damp(e.pos.z, tz, 25, dt); }
        e.rot = G.dampAng(e.rot, tr, 14, dt);
        const sp = Math.hypot(e.pos.x - ox, e.pos.z - oz) / Math.max(dt, 1e-4); e.st.move = G.damp(e.st.move, G.clamp(sp / e.spd, 0, 1.4), 10, dt);
      }
      if (e.kbx || e.kbz) { if (!e.leap) G.World.sweep(e.pos, e.kbx * dt, e.kbz * dt, e.def.r * 0.8); const f = Math.exp(-9 * dt); e.kbx *= f; e.kbz *= f; if (Math.abs(e.kbx) + Math.abs(e.kbz) < 0.05) e.kbx = e.kbz = 0; }
      // leap arc visual (all clients)
      if (e.leap) { e.leap.t += dt / e.leap.dur; const k = Math.min(1, e.leap.t); e.pos.x = G.lerp(e.leap.fx, e.leap.tx, k); e.pos.z = G.lerp(e.leap.fz, e.leap.tz, k); e.y = Math.sin(k * Math.PI) * e.leap.h; if (k >= 1) { e.leap = null; e.y = 0; } }
      e.st.phase += dt * e.st.move * (e.def.speed * 2.2) / Math.max(0.6, e.def.h * 0.55);
      { const ph = Math.floor(e.st.phase / Math.PI); if (ph !== e.lastStep) { e.lastStep = ph; if (e.st.move > 0.3 && !e.st.float && e.y < 0.1) { const heavy = e.boss || ['troll', 'minotaur', 'orc', 'warlord', 'colossus'].includes(e.type); G.sfx(e.def.blood === 'bone' ? 'boneStep' : heavy ? 'heavyStep' : e.R.kind === 'spider' ? 'skitter' : e.R.kind === 'quad' ? 'pawStep' : 'step', heavy ? (e.boss ? 1 : 0.7) : 0.35, e.pos); if (heavy && e.boss) G.fx.shake(0.08); } } }
      if (e.def.blood === 'bone' && e.awake && Math.random() < dt * 0.35) G.sfx('rattle', 0.45, e.pos);
      e.st.float = (e.R.float || e.def.fly) || (e.atk && e.atk.def.fly && e.atk.t > e.atk.def.wind - 0.3);
      // visual sync + distance culling
      // the body turns smoothly even when the AI snaps its facing (attack lock-on, sweeps)
      { const pv = e.vrot === undefined ? e.rot : e.vrot; e.vrot = G.dampAng(pv, e.rot, 16, dt);
        const tr = Math.abs(G.angDiff(pv, e.vrot)) / Math.max(dt, 1e-3); e.st.turn = G.damp(e.st.turn || 0, e.st.move < 0.3 && !e.atk ? G.clamp(tr * 0.16, 0, 0.45) : 0, 10, dt);
        if (e.st.turn > 0.02 && e.st.move < 0.3) e.st.phase += dt * e.st.turn * 9; }
      e.pos.y = G.World.fy(e.pos.x, e.pos.z); e.root.position.set(e.pos.x, e.pos.y + e.y, e.pos.z); e.root.rotation.y = e.vrot;
      const cd2 = G.dist2(e.pos.x, e.pos.z, G.camera.position.x, G.camera.position.z);
      e.root.visible = cd2 < (e.boss ? 3600 : 1300);
      if (!e.root.visible) continue;
      if (e.guardT > 0) e.guardT -= dt; e.st.block = e.guardT > 0 ? 1 : 0;
      if (!frozen) { if (e.atk) e.st.atk = e.atk.def.k === 'shield' ? -1 : G.clamp(e.atk.t / e.atk.def.dur, 0, 1); else e.st.atk = -1; e.hurt = Math.max(0, e.hurt - dt * 4); e.st.hurt = e.hurt; M.anim(e.R, e.st); }
      // flash & char & status visuals
      e.flash = Math.max(0, e.flash - dt * 9);
      const burning = e.burnT > 0 || (e.flags & 1);
      if (e.flash > 0 || burning || e.char > 0 || frozen || e._fx) {
        e._fx = e.flash > 0 || burning || frozen;
        const fl = Math.sin(t * 25) * 0.5 + 0.5;
        for (const o of e.mats) { if (!o.m.emissive) continue;
          if (o.c) o.m.color.copy(o.c).lerp(G._black || (G._black = new THREE.Color(0x0a0604)), Math.min(0.85, e.char));
          o.m.emissive.copy(o.e || G._black);
          o.m.emissiveIntensity = o.ei;
          if (burning) { o.m.emissive.setRGB(1, 0.3, 0.05); o.m.emissiveIntensity = Math.max(o.ei, 0.25 + fl * 0.3); }
          if (frozen) { o.m.emissive.setRGB(0.3, 0.6, 1); o.m.emissiveIntensity = Math.max(o.ei, 0.35); }
          if (e.flash > 0) { o.m.emissive.setRGB(1, 0.85, 0.75); o.m.emissiveIntensity = Math.max(o.m.emissiveIntensity, e.flash * 0.45); }
        }
      }
      if (burning && Math.random() < 0.6) G.fx.fire(new G.V3(e.pos.x + (Math.random() - 0.5) * e.def.r, e.y + Math.random() * e.def.h * (e.boss ? 1 : 0.8), e.pos.z + (Math.random() - 0.5) * e.def.r), 1, 0.2, 0.35, 1.5);
      if ((e.bleedT > 0 || (e.flags & 16)) && Math.random() < 0.25) G.fx.blood(new G.V3(e.pos.x, e.def.h * 0.6, e.pos.z), new G.V3(0, -1, 0), 1, e.def.blood, 0.5);
      if (frozen && !e.iceMesh) G.fx.iceBlock(e); if (!frozen && e.iceMesh) G.fx.removeIce(e, true);
      if (e.iceMesh && e.iceMesh.scale.x < 1) e.iceMesh.scale.setScalar(Math.min(1, e.iceMesh.scale.x + dt * 6));
      if (e.bar) { const show = e.hp < e.maxHp; e.bar.visible = show; if (show) { e.root.getWorldQuaternion(G.tmpQ); e.bar.quaternion.copy(G.tmpQ.invert().multiply(G.camera.quaternion)); e.bar.userData.fg.scale.x = 0.96 * Math.max(0, e.hp / e.maxHp); e.bar.userData.fg.position.x = -(0.96 - e.bar.userData.fg.scale.x) / 2; e.bar.position.y = e.def.h * (e.R.root.scale.y) + 0.35 + e.y; } }
      // elemental / fire enemies emit embers ambiently
      if (e.def.blood === 'ember' && Math.random() < 0.15) G.fx.embers(new G.V3(e.pos.x, e.y + e.def.h * 0.6, e.pos.z), 1, e.def.r);
      if (e.type === 'elemental' && Math.random() < 0.7) G.fx.fire(new G.V3(e.pos.x, 1.2 + e.y, e.pos.z), 2, 0.5, 0.6, 2);
      if (e.type === 'wraith' && Math.random() < 0.3) G.fx.mist(new G.V3(e.pos.x, 0.5 + e.y, e.pos.z), 0x304060, 1, 1.2, 0.3);
      if (e.auraRing) { e.auraRing.rotation.z += dt * 1.2; if (Math.random() < 0.3) G.fx.emit(G.fx.add, e.pos.x + (Math.random() - 0.5) * e.def.r * 2, 0.1, e.pos.z + (Math.random() - 0.5) * e.def.r * 2, 0, 1.6, 0, 0.8, 0.18, 0, G.fx.hex(this.AFFIX[e.affix[0]][1], 1, 1.4), [0, 0, 0, 0]); }
      if (e.bubble) { const up = host ? e.shield > 0 : !!(e.flags & 64); e.bubble.visible = up; if (up) e.bubble.material.opacity = 0.16 + Math.sin(t * 5) * 0.06; }
      if (e.plate) e.plate.position.y = e.def.h * 1.18 * (e.boss ? 1 : 1) + 0.95 + e.y;
      if (e.cower) { e.st.crouch = 1; e.st.move = 0; if (Math.random() < 0.02) G.sfx('groan', 0.25, e.pos); }
      if (e.elite && e.awake && G.now() - this.eliteSaidT > 40 && G.player && G.dist2(e.pos.x, e.pos.z, G.player.pos.x, G.player.pos.z) < 400) { this.eliteSaidT = G.now(); G.dm.say(G.pick(G.DM_LINES.elite)); }
      // boss awakening
      if (e.boss && e.awake && !e.announced) { e.announced = true; G.sfx('roar', 1); G.fx.shake(0.8); G.ui.bossIntro(e); G.dm.say(G.pick(G.DM_LINES.boss)); }
      // goblins cackle while they hunt
      if (e.awake && (e.type === 'goblin' || e.type === 'shaman')) { if (e.cackT === undefined) e.cackT = 0.3 + Math.random() * 0.8; e.cackT -= dt; if (e.cackT <= 0) { e.cackT = 5 + Math.random() * 9; G.sfx('cackle', 0.75, e.pos); } }
    }
    if (host) this.separate();
  },
  separate() {
    const L = this.list; for (let i = 0; i < L.length; i++) { const a = L[i]; if (a.dead || !a.awake) continue; for (let j = i + 1; j < L.length; j++) { const b = L[j]; if (b.dead) continue; const rr = (a.def.r + b.def.r) * 0.9, dx = a.pos.x - b.pos.x, dz = a.pos.z - b.pos.z, d2 = dx * dx + dz * dz; if (d2 < rr * rr && d2 > 1e-4) { const d = Math.sqrt(d2), k = (rr - d) / d * 0.5; const wa = a.boss ? 0.1 : 1, wb = b.boss ? 0.1 : 1; a.pos.x += dx * k * wa; a.pos.z += dz * k * wa; b.pos.x -= dx * k * wb; b.pos.z -= dz * k * wb; } } G.World.collide(a.pos, a.def.r * 0.8); }
  },
  hostStatus(e, dt) {
    let f = 0;
    if (e.burnT > 0) { e.burnT -= dt; f |= 1; this.dot(e, e.burnDps * dt, 'fire'); e.char = Math.min(0.85, e.char + dt * 0.12); }
    if (e.frozenT > 0) { e.frozenT -= dt; f |= 2; }
    if (e.slowT > 0) { e.slowT -= dt; f |= 4; }
    if (e.stunT > 0) { e.stunT -= dt; f |= 8; }
    if (e.bleedT > 0) { e.bleedT -= dt; f |= 16; this.dot(e, e.bleedDps * dt, 'slash'); }
    if (e.def.regen && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.def.regen * dt * e.dmgMul);
    if (e.cower) f |= 32; if (e.shield > 0) f |= 64;
    e.flags = f;
  },
  dot(e, amt, type) { if (e.dead) return; e.hp -= amt; e.dotAcc = (e.dotAcc || 0) + amt; if (e.dotAcc > 2) { G.fx.dmgNumber(new G.V3(e.pos.x, e.def.h + 0.2, e.pos.z), e.dotAcc, false, type === 'fire' ? '#ff9a3a' : '#ff4a4a'); e.dotAcc = 0; } if (e.hp <= 0) G.net.killEnemy(e, type); },

  /* ---------------- host AI ---------------- */
  hostAI(e, dt) {
    const tp = this.nearestPlayer(e); if (!tp) { e.st.move *= 0.9; return; }
    if (e.cower) { e.st.move = 0; e.rot = G.lerpAng(e.rot, Math.atan2(tp.p.x - e.pos.x, tp.p.z - e.pos.z), dt * 2); return; }
    if (e.affix && e.affix.includes('teleporting') && e.awake && !e.atk) { e.tpT -= dt; if (e.tpT <= 0 && tp.d > 3) { e.tpT = 5 + Math.random() * 3; const b = G.V3 ? new G.V3() : null; const ang = Math.random() * 6.28; const nx = tp.p.x + Math.sin(ang) * 2.2, nz = tp.p.z + Math.cos(ang) * 2.2; if (!G.World.isWall(nx, nz)) { G.fx.smoke(new G.V3(e.pos.x, 0.8, e.pos.z), 8, 0x2a1040, 1.6); G.fx.burst(new G.V3(e.pos.x, 1, e.pos.z), 0xb060ff, 18, 4); e.pos.set(nx, 0, nz); G.fx.smoke(new G.V3(nx, 0.8, nz), 8, 0x2a1040, 1.6); G.sfx('zap', 0.6, e.pos); } } }
    if (!e.awake) {
      if (tp.d < (e.boss ? 16 : 15) && G.World.los(e.pos.x, e.pos.z, tp.p.x, tp.p.z)) this.wake(e);
      else { e.st.move *= 0.9; return; }
    }
    if (e.boss && G.World.bossRoom) { /* bosses wait until a player enters the arena */ }
    for (const k in e.cds) e.cds[k] -= dt * (e.affix && e.affix.includes('frenzied') ? 1.5 : 1);
    const dx = tp.p.x - e.pos.x, dz = tp.p.z - e.pos.z, d = tp.d, face = Math.atan2(dx, dz);
    if (e.atk) {
      const A = e.atk, a = A.def;
      // track the target through the wind-up, aiming where they will be when the blow lands (no circle-strafing)
      const rem = Math.max(0, a.wind - A.t), lead = Math.min(0.5, rem + 0.12), px = tp.p.x + (tp.p.vx || 0) * lead, pz = tp.p.z + (tp.p.vz || 0) * lead, pface = Math.atan2(px - e.pos.x, pz - e.pos.z);
      if (a.k === 'hook' || (a.k === 'vortex' && a.at !== 'self')) e.rot = G.lerpAng(e.rot, Math.atan2(A.tx - e.pos.x, A.tz - e.pos.z), dt * 10);
      else if (a.k === 'cone' && a.sweep) e.rot += Math.sin(A.t * 2.5) * dt * 1.2;
      else if (A.t < a.wind || a.k === 'spin') e.rot += G.clamp(G.angDiff(e.rot, pface), -(a.turn || 7) * dt, (a.turn || 7) * dt);
      else if (a.k === 'melee' || a.k === 'cone') e.rot += G.clamp(G.angDiff(e.rot, pface), -2.5 * dt, 2.5 * dt);   // keeps following a little through the swing
      if (a.k === 'melee' && A.t < a.wind && d > a.range * 0.75 && d < a.range + 2.5) { const st = Math.min(d - a.range * 0.6, e.spd * 0.6 * dt); e.pos.x += Math.sin(e.rot) * st; e.pos.z += Math.cos(e.rot) * st; G.World.collide(e.pos, e.def.r * 0.8); e.st.move = 0.6; }   // step in while winding up
      else e.st.move *= 0.85;
      return;
    }
    // choose attack
    const los = d < 3 || G.World.los(e.pos.x, e.pos.z, tp.p.x, tp.p.z);
    const opts = [];
    e.def.atks.forEach((a, i) => {
      if (e.cds[i] > 0) return; if (d < (a.min || 0) || d > a.range) return;
      if ((a.k === 'proj' || a.k === 'leap' || a.k === 'charge' || a.k === 'cone' || a.k === 'beam') && !los) return;
      if (a.k === 'shield' && (e.guardT > 0 || d > 7)) return;
      if (a.k === 'heal') { if (!this.list.some(o => !o.dead && o !== e && o.hp < o.maxHp * 0.7 && G.dist2(o.pos.x, o.pos.z, e.pos.x, e.pos.z) < a.radius * a.radius)) return; }
      if (a.k === 'explode' && e.hp > e.maxHp * (a.lowHp || 0)) return;
      if (a.k === 'summon' && this.list.filter(o => !o.dead && o.summoner === e.id).length > 6) return;
      if (a.k === 'melee' && !a.behind && Math.abs(G.angDiff(e.rot, face)) > 2.3) return;
      if (a.behind && Math.abs(G.angDiff(e.rot, face)) < 1.8) return;
      if (a.k === 'blink' && d < 6 && !e.boss) return;
      if (a.k === 'hook') { const pt = this.pullTarget(e, a); if (!pt || pt.d < Math.max(a.min || 0, 5)) return; opts.push({ i, w: (a.w || 1) * (pt.d > 9 ? 4 : 1.5), pt }); return; }
      if (a.k === 'vortex' && a.at !== 'self' && d < 6 && !e.boss) return;
      opts.push({ i, w: (a.w || 1) * (a.k === 'vortex' && d > 9 ? 3 : 1) });
    });
    if (opts.length && Math.random() < dt * 6) {
      let tot = opts.reduce((s, o) => s + o.w, 0), r = Math.random() * tot, pick = opts[0];
      for (const o of opts) { r -= o.w; if (r <= 0) { pick = o; break; } }
      const a = e.def.atks[pick.i]; e.cds[pick.i] = a.cd * (0.8 + Math.random() * 0.4);
      let tx = tp.p.x, tz = tp.p.z, tgp = tp.p;
      if (pick.pt) { tgp = pick.pt.p; tx = tgp.x + (tgp.vx || 0) * pick.pt.d / (a.speed || 20) * 0.5; tz = tgp.z + (tgp.vz || 0) * pick.pt.d / (a.speed || 20) * 0.5; }
      if (a.k === 'proj' && tp.p.vx !== undefined) { const lead = d / (a.speed || 15) * 0.6; tx += (tp.p.vx || 0) * lead; tz += (tp.p.vz || 0) * lead; }
      G.net.enemyAttack(e, pick.i, tx, tz, Math.floor(Math.random() * 1e6), tgp.peer || null);
      return;
    }
    // movement
    const ranged = e.def.ranged;
    let mx = 0, mz = 0;
    // melee chasers aim ahead of a moving target, so running circles around them closes the gap instead
    const lk = !ranged && d < 8 ? Math.min(0.7, d / Math.max(1, e.spd) * 0.8) : 0, ldx = dx + (tp.p.vx || 0) * lk, ldz = dz + (tp.p.vz || 0) * lk;
    if (ranged && d < ranged * 0.55 && los) { mx = -dx; mz = -dz; }
    else if (d > (ranged ? ranged * 0.9 : e.def.r + 1.2) || !los) {
      if (los && d < 14) { mx = ldx; mz = ldz; }
      else { const o = { x: 0, z: 0 }; if (G.World.flowDir(e.pos.x, e.pos.z, o)) { mx = o.x; mz = o.z; } else { mx = dx; mz = dz; } }
    } else if (ranged) { const s = Math.sin(e.st.t * 0.7 + e.id) > 0 ? 1 : -1; mx = -dz * s; mz = dx * s; }
    const ml = Math.hypot(mx, mz);
    if (ml > 0.01) {
      const sp = e.spd * (ranged && d < ranged * 0.55 ? 0.8 : 1);
      e.pos.x += mx / ml * sp * dt; e.pos.z += mz / ml * sp * dt; e.rot = G.lerpAng(e.rot, ranged && d < ranged ? face : Math.atan2(mx, mz), dt * 8);
      e.st.move = G.lerp(e.st.move, 1, dt * 6);
    } else { e.st.move = G.lerp(e.st.move, 0, dt * 6); e.rot = G.lerpAng(e.rot, face, dt * 6); }
    G.World.collide(e.pos, e.def.r * 0.8);
  },
  // knockback is a short slide (the whole distance over ~0.25 s) moved with the swept collider, never a teleport
  push(e, dx, dz) { e.kbx = (e.kbx || 0) + dx * 9; e.kbz = (e.kbz || 0) + dz * 9; },
  wake(e) {
    if (e.awake) return; e.awake = true; G.sfx(e.def.groan === 'roar' ? 'roar' : e.def.groan, 0.5, e.pos);
    // alert room-mates
    this.list.forEach(o => { if (!o.awake && !o.boss && G.dist2(o.pos.x, o.pos.z, e.pos.x, e.pos.z) < 100 && G.World.los(o.pos.x, o.pos.z, e.pos.x, e.pos.z)) o.awake = true; });
  },

  /* ---------------- attack timelines (all clients) ---------------- */
  beginAttack(e, ai, tx, tz, seed, tg) {
    if (!e || e.dead) return; const a = e.def.atks[ai]; if (!a) return;
    e.awake = true;
    const r = G.mulberry(seed);
    e.atk = { ai, def: a, t: 0, tx, tz, r, resolved: false, tick: 0, hitMe: false, hits: 0, spots: [], fx: [], tg: tg || null };
    if (tg && this.isMe(tg) && G.player && G.ui.modalOpen() && G.dist2(e.pos.x, e.pos.z, G.player.pos.x, G.player.pos.z) < 225) G.ui.interrupt(`${e.def.name} attacks! You break off.`);
    e.st.atkKind = a.anim || 'slash'; e.st.relAt = a.wind / a.dur; e.rot = Math.atan2(tx - e.pos.x, tz - e.pos.z);
    if (e.R.kind !== 'hum' && ['slash', 'overhead', 'thrust', 'claw', 'cast', 'shoot', 'slam'].includes(e.st.atkKind)) e.st.atkKind = 'bite';
    if (a.k === 'aoe') {
      const n = a.count || 1;
      for (let k = 0; k < n; k++) {
        let x = a.at === 'self' ? e.pos.x : tx, z = a.at === 'self' ? e.pos.z : tz;
        if (k > 0 || (n > 1 && a.at === 'target')) { const ang = r() * 6.28, rad = Math.sqrt(r()) * (a.spread || 0); x += Math.cos(ang) * rad; z += Math.sin(ang) * rad; if (k === 0) { x = tx; z = tz; } }
        e.atk.spots.push({ x, z, tg: G.fx.telegraph(x, z, a.radius, a.wind + (a.delay || 0), a.fx === 'frost' ? 0x60c0ff : a.fx === 'acid' || a.fx === 'poison' ? 0x80ff30 : 0xff3010) });
        if (a.fx === 'meteor') { const m = new THREE.Group(); M.P(m, M.rockGeo(0.7, 1, 0.3), G.mat('col', { c: 0x2a1a10, e: 0xff3000, ei: 1.2, t: 'rock' })); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.tex.sprite('glow'), color: 0xff6010, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); s.scale.setScalar(5); m.add(s); m.position.set(x + 8, 30, z + 4); G.scene.add(m); e.atk.fx.push({ m, x, z }); }
      }
    }
    if (a.k === 'leap') e.atk.spots.push({ x: tx, z: tz, tg: G.fx.telegraph(tx, tz, a.radius, a.wind + 0.5, 0xff3010) });
    if (a.k === 'charge') { const ang = e.rot; e.atk.dir = { x: Math.sin(ang), z: Math.cos(ang) }; G.fx.shake(0.1); }
    if (a.k === 'explode') e.atk.spots.push({ x: e.pos.x, z: e.pos.z, tg: G.fx.telegraph(e.pos.x, e.pos.z, a.radius, a.wind, 0xff6010) });
    if (a.k === 'summon' || a.k === 'heal' || a.k === 'blink') G.fx.burst(new G.V3(e.pos.x, e.def.h * 0.7, e.pos.z), a.k === 'heal' ? 0x60ff60 : 0x9a40ff, 20, 3);
    if (a.anim === 'roar' || e.boss) G.sfx(e.def.groan === 'roar' ? 'roar' : e.def.groan, e.boss ? 0.9 : 0.5, e.pos);
    if (a.k === 'cone') G.sfx('fire', 0.5, e.pos);
    if (a.k === 'hook') G.sfx('chainrattle', 0.7, e.pos);
    if (a.k === 'shield') { e.guardT = a.dur; G.sfx('metalclank', 0.7, e.pos); }
    if (a.k === 'beam') {
      // the sweep is centred on the target, starting on a random side; a thin aiming line shows during the wind-up
      const A = e.atk, aim = Math.atan2(tx - e.pos.x, tz - e.pos.z); A.dir = r() < 0.5 ? 1 : -1; A.ang0 = aim - A.dir * (a.sweep || 1.2) / 2; e.rot = A.ang0;
      const g = new THREE.Group(), col = a.color || 0xff5020, mk = (rad, op) => new THREE.Mesh(gk('beamc' + rad, () => { const c = new THREE.CylinderGeometry(rad, rad, 1, 12, 1, true); c.rotateX(Math.PI / 2); c.translate(0, 0, 0.5); return c; }), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
      A.core = mk(0.12, 1); A.glow = mk(0.45, 0.35); A.aimL = mk(0.03, 0.8); g.add(A.core, A.glow, A.aimL); A.core.visible = A.glow.visible = false; G.scene.add(g); A.beam = g; A.fx.push({ m: g, x: 0, z: 0, beam: 1 });
      A.light = { pos: new G.V3(), color: col, intensity: 0, dist: 10, seed: 5 }; G.World.lights.push(A.light);
      G.sfx('portal', 0.5, e.pos);
    }
    if (a.k === 'ring') { G.fx.shockwave(new G.V3(e.pos.x, 0.1, e.pos.z), 2.5, a.color || 0xffc080, 0.6); e.atk.rings = []; }
    if (a.k === 'vortex') {
      let x = tx, z = tz; if (a.at === 'self') { x = e.pos.x + Math.sin(e.rot) * (e.def.r + (a.off || 0)); z = e.pos.z + Math.cos(e.rot) * (e.def.r + (a.off || 0)); }
      { const A = e.atk; A.vx = x; A.vz = z; const T = a.wind + (a.pull || 1.2), col = a.color || 0x9a60ff;
        A.vort = G.fx.vortex(x, z, a.radius, T + 0.35, col); A.spots.push({ x, z, tg: G.fx.telegraph(x, z, a.radius, T, col) }); }
      G.sfx('portal', 0.5, new G.V3(x, 0, z));
    }
  },
  // where a chain leaves the enemy: the throwing hand, else the head / mouth, else chest height
  anchor(e, v) {
    const R = e.R; const o = (R.armR && R.armR.hand) || R.head || null;
    if (o && e.root.visible) { o.getWorldPosition(v); return v; }
    return v.set(e.pos.x, e.y + e.def.h * 0.6, e.pos.z);
  },
  // the player a pull attack goes after: the farthest one it can see within reach (that is the one hiding at range)
  pullTarget(e, a) {
    let best = null, bd = -1;
    for (const p of this.players()) { const d = Math.hypot(p.x - e.pos.x, p.z - e.pos.z); if (d < (a.min || 0) || d > a.range || d <= bd) continue; if (d > 3 && !G.World.los(e.pos.x, e.pos.z, p.x, p.z)) continue; bd = d; best = p; }
    return best ? { p: best, d: bd } : null;
  },
  isMe(tg) { return tg === G.net.myId() || (!G.net.party && tg === 'me'); },
  meInRange(e, range, arc) {
    const p = G.player; if (!p || p.dead || p.downed) return false;
    const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z, d = Math.hypot(dx, dz);
    if (d > range + 0.4) return false; if (arc >= 3.1) return true;
    return Math.abs(G.angDiff(e.rot, Math.atan2(dx, dz))) < arc / 2 + Math.atan2(0.4, Math.max(d, 0.1));
  },
  updateAttack(e, dt, host) {
    const A = e.atk, a = A.def; A.t += dt;
    const D = a.dmg ? a.dmg * e.dmgMul : 0;
    if (a.k === 'melee') {
      const nh = a.hits || 1;
      for (let h = A.hits; h < nh; h++) if (A.t >= a.wind + h * 0.22) { A.hits = h + 1; if (this.meInRange(e, a.range + (A.tg && this.isMe(A.tg) ? 0.35 : 0), A.tg && this.isMe(A.tg) ? Math.min(6.3, a.arc + 2 * (a.track ?? 1.3)) : a.arc)) G.combat.enemyHitsMe(e, D, a); G.sfx(e.def.blood === 'bone' ? 'swing' : 'heavy', 0.5, e.pos); if (e.def.blood === 'bone') G.sfx('rattle', 0.4, e.pos); }
    } else if (a.k === 'proj' && !A.resolved && A.t >= a.wind) {
      A.resolved = true; const n = a.count || 1, base = Math.atan2(A.tx - e.pos.x, A.tz - e.pos.z);
      const sy = (e.def.fly ? 1.5 : Math.min(2.2, e.def.h * 0.65 * (e.boss ? 0.7 : 1))) + e.y + e.pos.y, ty = G.World.fy(A.tx, A.tz);
      for (let k = 0; k < n; k++) { const ang = base + (n > 1 ? (k / (n - 1) - 0.5) * (a.spread || 0.3) * 2 : 0); const dist = Math.hypot(A.tx - e.pos.x, A.tz - e.pos.z);
        const dir = new G.V3(Math.sin(ang), (ty + 1.2 - sy) / Math.max(4, dist) + (a.pk === 'arrow' ? 0.05 : 0), Math.cos(ang));
        G.proj.spawn({ kind: a.pk, pos: new G.V3(e.pos.x + Math.sin(ang) * e.def.r, sy, e.pos.z + Math.cos(ang) * e.def.r), dir, speed: a.speed, owner: 'enemy', dmg: D, dtype: a.pk === 'fireball' ? 'fire' : a.pk, homing: a.homing, burn: a.burn, slow: a.slow, life: 4, r: a.pk === 'web' ? 0.45 : 0.3 }); }
      G.sfx(a.pk === 'arrow' ? 'arrow' : a.pk === 'fireball' ? 'firecast' : a.pk === 'web' ? 'web' : 'magic', 0.6, e.pos);
    } else if (a.k === 'aoe') {
      const hitT = a.wind + (a.delay || 0);
      A.fx.forEach(f => { const k = G.clamp(A.t / hitT, 0, 1); f.m.position.set(G.lerp(f.x + 8, f.x, k), G.lerp(30, 0.5, k * k), G.lerp(f.z + 4, f.z, k)); f.m.rotation.x += dt * 4; if (Math.random() < 0.8) G.fx.fire(f.m.position, 3, 0.6, 1.0, 1); });
      if (!A.resolved && A.t >= hitT) {
        A.resolved = true; A.fx.forEach(f => G.scene.remove(f.m));
        A.spots.forEach(s => {
          G.scene.remove(s.tg.g); G.fx.tele.splice(G.fx.tele.indexOf(s.tg), 1);
          const p = new G.V3(s.x, 0.3, s.z); this.aoeFx(a.fx, p, a.radius, e);
          const me = G.player; if (me && !me.dead && !me.downed && G.dist2(me.pos.x, me.pos.z, s.x, s.z) < a.radius * a.radius) { if (!A.hitMe) { A.hitMe = true; G.combat.enemyHitsMe(e, D, a, true, 0, null, { save: true }); if (a.dot) G.player.addDot(a.dot * e.dmgMul, 3, 'acid'); } }
        });
      }
    } else if (a.k === 'leap') {
      if (!A.started && A.t >= a.wind) { A.started = true; e.leap = { fx: e.pos.x, fz: e.pos.z, tx: A.tx, tz: A.tz, t: 0, dur: 0.55, h: a.fly ? 4 : 2.2 }; G.sfx('swing', 0.6, e.pos); }
      if (A.started && !A.resolved && !e.leap) {
        A.resolved = true; if (host) { e.pos.x = A.tx; e.pos.z = A.tz; G.World.collide(e.pos, e.def.r); }
        A.spots.forEach(s => { G.scene.remove(s.tg.g); G.fx.tele.splice(G.fx.tele.indexOf(s.tg), 1); });
        this.aoeFx('slam', new G.V3(e.pos.x, 0.2, e.pos.z), a.radius, e);
        const me = G.player; if (me && !me.dead && !me.downed && G.dist2(me.pos.x, me.pos.z, e.pos.x, e.pos.z) < (a.radius + 0.4) ** 2) G.combat.enemyHitsMe(e, D, a, true, 0, null, { save: true });
      }
    } else if (a.k === 'charge') {
      if (A.t >= a.wind && A.t < a.dur - 0.2) {
        if (host) { e.pos.x += A.dir.x * a.speed * dt; e.pos.z += A.dir.z * a.speed * dt; const bx = e.pos.x, bz = e.pos.z; G.World.collide(e.pos, e.def.r); if (Math.hypot(bx - e.pos.x, bz - e.pos.z) > 0.05) { A.t = a.dur - 0.2; G.fx.shake(0.3); G.fx.spark(new G.V3(e.pos.x, 1, e.pos.z), 0xffd090, 20, 6); G.sfx('boom', 0.5, e.pos); } }
        if (Math.random() < 0.6) G.fx.smoke(new G.V3(e.pos.x, 0.2, e.pos.z), 1, 0x5a4a3a, 1, 0.3);
        e.st.move = 1.4;
        if (!A.hitMe && G.player && !G.player.dead && G.dist2(G.player.pos.x, G.player.pos.z, e.pos.x, e.pos.z) < (e.def.r + 0.9) ** 2) { A.hitMe = true; G.combat.enemyHitsMe(e, D, a, false, 14); }
      }
    } else if (a.k === 'cone' || a.k === 'spin') {
      if (A.t >= a.wind && A.t < a.dur) {
        const cr = a.k === 'spin' ? a.radius : a.range;
        if (a.k === 'spin') { e.R.root.rotation.y += dt * 14; if (Math.random() < 0.5) G.fx.spark(new G.V3(e.pos.x + Math.sin(A.t * 14) * cr * 0.7, 1.2, e.pos.z + Math.cos(A.t * 14) * cr * 0.7), 0xffe0b0, 2, 2, 0.3, 0.08, 2); if (Math.floor(A.t * 4) !== A.ss) { A.ss = Math.floor(A.t * 4); G.sfx('swing', 0.6, e.pos); } }
        else {
          const head = e.R.head || e.R.root; const hp = new G.V3(); head.getWorldPosition(hp); const fwd = new G.V3(Math.sin(e.rot), -0.05, Math.cos(e.rot));
          for (let k = 0; k < 4; k++) { const sp = new G.V3(fwd.x + (Math.random() - 0.5) * a.angle * 1.6, fwd.y + (Math.random() - 0.5) * 0.3, fwd.z + (Math.random() - 0.5) * a.angle * 1.6).normalize().multiplyScalar(a.range * 1.3);
            if (a.fx === 'fire') G.fx.emit(G.fx.add, hp.x, hp.y, hp.z, sp.x, sp.y, sp.z, 0.75, 0.35, 1.6, [1.7, 0.9, 0.3, 1], [0.9, 0.1, 0.0, 0], -0.4, 0.4);
            else G.fx.emit(G.fx.add, hp.x, hp.y, hp.z, sp.x, sp.y, sp.z, 0.75, 0.3, 1.4, [0.6, 1.6, 0.2, 0.9], [0.1, 0.5, 0.05, 0], 0.3, 0.4); }
          if (Math.random() < 0.3) G.Lights.flash(hp, a.fx === 'fire' ? 0xff6020 : 0x80ff40, 3, 9, 0.2);
        }
        A.tick -= dt;
        if (A.tick <= 0) { A.tick = a.tick || 0.25;
          const inside = a.k === 'spin' ? this.meInRange(e, cr, 6.3) : this.meInRange(e, a.range, a.angle * 2);
          if (inside) G.combat.enemyHitsMe(e, D, a, true, 0, a.fx === 'poison' ? 'poison' : a.fx === 'fire' ? 'fire' : null);
          if (a.fx === 'fire') { const p = new G.V3(e.pos.x + Math.sin(e.rot) * a.range * 0.6, 0, e.pos.z + Math.cos(e.rot) * a.range * 0.6); if (Math.random() < 0.4) G.fx.decal('scorch', p.x + (Math.random() - 0.5) * 2, p.z + (Math.random() - 0.5) * 2, 2, 0xffffff, 20); }
        }
      }
    } else if (a.k === 'hook' && !A.resolved && A.t >= a.wind) {
      // a chained hook / silk line: whoever it catches is reeled in to the thrower (resolved on the victim's own client)
      A.resolved = true; const n = a.count || 1, from = this.anchor(e, new G.V3()), base = Math.atan2(A.tx - from.x, A.tz - from.z), dist = Math.hypot(A.tx - from.x, A.tz - from.z);
      for (let k = 0; k < n; k++) {
        const ang = base + (n > 1 ? (k / (n - 1) - 0.5) * (a.spread || 0.3) * 2 : 0);
        const dir = new G.V3(Math.sin(ang), (G.World.fy(A.tx, A.tz) + 1.15 - from.y) / Math.max(4, dist), Math.cos(ang));
        const p = G.proj.spawn({ kind: a.pk, pos: from.clone(), dir, speed: a.speed, owner: 'enemy', dmg: D, dtype: 'pierce', homing: a.homing || 0.8, slow: a.slow, life: 3, r: a.pk === 'silk' ? 0.5 : 0.38,
          pull: { eid: e.id, reach: a.range + 3, stop: a.stop || 1.4, root: a.root ?? 0.6, speed: a.pullSpeed || 22, style: a.tether || 'chain' } });
        p.tether = G.fx.tether({ from: v => this.anchor(e, v), to: v => v.copy(p.m.position), style: a.tether || 'chain', dur: 4, alive: () => G.proj.list.includes(p) && !e.dead }); p.tether.slack = 1;
      }
      G.sfx(a.pk === 'silk' ? 'web' : 'swing', 0.8, e.pos);
    } else if (a.k === 'vortex') {
      // a gravity well drags everyone nearby toward its centre, then it bursts. Sprint or dash against it to escape.
      const t0 = a.wind * 0.35, t1 = a.wind + (a.pull || 1.2), me = G.player;
      if (A.t >= t0 && A.t < t1 && me && !me.dead && !me.downed && !me.leap && G.state === 'play') {
        const dx = A.vx - me.pos.x, dz = A.vz - me.pos.z, d = Math.hypot(dx, dz), R = a.radius * (a.reach || 2.4);
        if (d < R && d > 0.35) { const k = (a.str || 4.5) * (0.6 + 0.4 * (1 - d / R)) * Math.min(1, (A.t - t0) / 0.35); me.pos.x += dx / d * k * dt; me.pos.z += dz / d * k * dt; G.World.collide(me.pos, 0.42); me.pulledT = 0.2; }
      }
      if (A.t >= t0 && A.t < t1 && a.at === 'self') { this.list.forEach(o => { if (o === e || o.dead || o.boss || !host) return; const dx = A.vx - o.pos.x, dz = A.vz - o.pos.z, d = Math.hypot(dx, dz); if (d < a.radius * 2 && d > 1) { o.pos.x += dx / d * 1.2 * dt; o.pos.z += dz / d * 1.2 * dt; } }); }
      if (!A.resolved && A.t >= t1) {
        A.resolved = true; A.spots.forEach(s => { if (G.fx.tele.includes(s.tg)) { G.scene.remove(s.tg.g); G.fx.tele.splice(G.fx.tele.indexOf(s.tg), 1); } });
        const p = new G.V3(A.vx, 0.3, A.vz); this.aoeFx(a.fx || 'implode', p, a.radius, e);
        if (me && !me.dead && !me.downed && G.dist2(me.pos.x, me.pos.z, A.vx, A.vz) < (a.radius + 0.3) ** 2) G.combat.enemyHitsMe(e, D, a, true, a.knock || 0, a.fx === 'fire' || a.fx === 'meteor' ? 'fire' : a.fx === 'poison' ? 'poison' : null, { save: true });
      }
    } else if (a.k === 'beam') {
      // a channelled ray that sweeps across the room; walls stop it, standing in it burns
      const from = this.anchor(e, new G.V3()); if (e.R.head) e.R.head.getWorldPosition(from); from.y = Math.max(1.0, Math.min(from.y, e.def.h * 0.75 + e.y));
      const k = G.clamp((A.t - a.wind) / Math.max(0.1, a.dur - a.wind - 0.2), 0, 1), ang = A.t < a.wind ? A.ang0 : A.ang0 + A.dir * (a.sweep || 1.2) * k;
      e.rot = ang; const dx = Math.sin(ang), dz = Math.cos(ang), len = G.World.W ? Math.min(a.range, G.World.rayWall(e.pos.x, e.pos.z, dx, dz, a.range)) : a.range;
      A.beam.position.copy(from); A.beam.rotation.set(0, ang, 0); A.beam.scale.set(1, 1, len);
      const on = A.t >= a.wind && A.t < a.dur - 0.2; A.core.visible = A.glow.visible = on; A.aimL.visible = !on && A.t < a.wind; A.aimL.material.opacity = 0.3 + Math.sin(A.t * 30) * 0.3;
      A.glow.material.opacity = 0.3 + Math.sin(A.t * 40) * 0.08; A.light.intensity = on ? 3 : 0; A.light.pos.set(e.pos.x + dx * len * 0.6, 1.2, e.pos.z + dz * len * 0.6);
      if (on) { const ex = e.pos.x + dx * len, ez = e.pos.z + dz * len; if (Math.random() < 0.8) G.fx.spark(new G.V3(ex, from.y * 0.6, ez), a.color || 0xff5020, 3, 4, 0.3, 0.08); if (Math.random() < 0.15) G.fx.decal('scorch', ex, ez, 1.2, 0xffffff, 12);
        A.tick -= dt; if (A.tick <= 0) { A.tick = a.tick || 0.2; const me = G.player;
          if (me && !me.dead && !me.downed) { const px = me.pos.x - e.pos.x, pz = me.pos.z - e.pos.z, along = px * dx + pz * dz, side = Math.abs(px * dz - pz * dx); if (along > 0 && along < len + 0.3 && side < (a.width || 0.8)) G.combat.enemyHitsMe(e, D, a, false, 1.5, a.fx === 'soul' ? null : 'fire'); } } }
    } else if (a.k === 'ring') {
      // shockwaves roll outward one after another; time a dodge (or be far away) to pass through them
      const n = a.count || 1, me = G.player;
      for (let i = 0; i < n; i++) {
        const t0 = a.wind + i * (a.gap || 0.6), R = (A.t - t0) * (a.speed || 8);
        let rg = A.rings[i];
        if (R > 0 && !rg) { const m = new THREE.Mesh(gk('ringwall', () => new THREE.CylinderGeometry(1, 1, 0.75, 64, 1, true)), new THREE.MeshBasicMaterial({ color: a.color || 0xffc080, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.position.set(e.pos.x, 0.375, e.pos.z); G.scene.add(m); rg = A.rings[i] = { m, x: e.pos.x, z: e.pos.z, hit: false }; A.fx.push({ m, x: 0, z: 0, ring: 1 }); G.sfx('boom', 0.5, e.pos); G.fx.shake(0.15); }
        if (!rg) continue;
        if (R >= (a.maxR || 14)) { rg.m.visible = false; continue; }
        rg.m.scale.set(Math.max(0.1, R), 1, Math.max(0.1, R)); rg.m.material.opacity = 0.8 * (1 - R / (a.maxR || 14)) + 0.15;
        if (Math.random() < 0.6) { const q = Math.random() * 6.28; G.fx.emit(G.fx.add, rg.x + Math.cos(q) * R, 0.15, rg.z + Math.sin(q) * R, 0, 1.2, 0, 0.4, 0.3, 0.05, G.fx.hex(a.color || 0xffc080, 1, 1.5), [0.2, 0.1, 0, 0]); }
        if (!rg.hit && me && !me.dead && !me.downed) { const d = Math.hypot(me.pos.x - rg.x, me.pos.z - rg.z); if (Math.abs(d - R) < 0.6) { rg.hit = true; if (me.iframes <= 0) G.combat.enemyHitsMe(e, D, a, true, 5, a.poison ? 'poison' : a.burn ? 'fire' : null); else G.fx.textPop(new G.V3(me.pos.x, 1.8, me.pos.z), 'DODGED', '#9ad0ff'); } }
      }
    } else if (a.k === 'shield') {
      e.st.move = Math.min(e.st.move, 0.3);
    } else if (a.k === 'summon' && !A.resolved && A.t >= a.wind) {
      A.resolved = true; G.fx.shake(0.3);
      if (host) for (let k = 0; k < a.count; k++) { const ang = A.r() * 6.28, rad = 2.5 + A.r() * 3; let x = e.pos.x + Math.cos(ang) * rad, z = e.pos.z + Math.sin(ang) * rad; if (G.World.isWall(x, z)) { x = e.pos.x; z = e.pos.z; } const ne = this.spawn(this.nextId++, a.alt && k % 2 ? a.alt : a.what, x, z, { summoned: true, awake: true }); if (ne) ne.summoner = e.id; }
    } else if (a.k === 'heal' && !A.resolved && A.t >= a.wind) {
      A.resolved = true; G.sfx('heal', 0.5, e.pos);
      this.list.forEach(o => { if (!o.dead && G.dist2(o.pos.x, o.pos.z, e.pos.x, e.pos.z) < a.radius * a.radius) { if (host) o.hp = Math.min(o.maxHp, o.hp + a.amt * e.dmgMul); G.fx.holy(new G.V3(o.pos.x, 0.2, o.pos.z), 14, 0.6); } });
    } else if (a.k === 'blink' && !A.resolved && A.t >= a.wind) {
      A.resolved = true; G.fx.smoke(new G.V3(e.pos.x, 0.5, e.pos.z), 8, 0x101020, 1.8); G.fx.burst(new G.V3(e.pos.x, 1, e.pos.z), 0x60ff90, 20, 4);
      if (host) { for (let k = 0; k < 10; k++) { const ang = A.r() * 6.28, rad = (e.boss ? 7 : 4) + A.r() * 4, x = A.tx + Math.cos(ang) * rad, z = A.tz + Math.sin(ang) * rad; if (!G.World.isWall(x, z) && !G.World.isWall(x + 1, z) && !G.World.isWall(x - 1, z)) { e.pos.set(x, 0, z); break; } } }
      G.sfx('zap', 0.6, e.pos);
    } else if (a.k === 'explode' && !A.resolved && A.t >= a.wind) {
      A.resolved = true; A.spots.forEach(s => { G.scene.remove(s.tg.g); G.fx.tele.splice(G.fx.tele.indexOf(s.tg), 1); });
      this.aoeFx('explosion', new G.V3(e.pos.x, 1, e.pos.z), a.radius, e);
      if (this.meInRange(e, a.radius, 6.3)) G.combat.enemyHitsMe(e, D, a, true, 10, 'fire', { save: true });
      if (host) { e.hp = 0; G.net.killEnemy(e, 'fire', true); }
    }
    if (A.t >= a.dur) { if (A.light) { const i = G.World.lights.indexOf(A.light); if (i >= 0) G.World.lights.splice(i, 1); } if (A.vort && !A.resolved) A.vort.dur = Math.min(A.vort.dur, A.vort.t + 0.3); A.spots.forEach(s => { if (G.fx.tele.includes(s.tg)) { G.scene.remove(s.tg.g); G.fx.tele.splice(G.fx.tele.indexOf(s.tg), 1); } }); A.fx.forEach(f => G.scene.remove(f.m)); e.atk = null; }
  },
  aoeFx(kind, p, radius, e) {
    if (G.run.active && e) G.game.breakArea(p.x, p.z, radius * 0.8, false, p);
    G.fx.shake(e && e.boss ? 0.6 : 0.3);
    if (kind === 'slam') { G.fx.shockwave(p, radius * 1.2, 0xffd0a0, 0.5); G.fx.decal('crack', p.x, p.z, radius * 1.6, 0x222222, 30); G.fx.smoke(p, 12, 0x6a5a4a, 2, 0.8); for (let k = 0; k < 16; k++) { const a = k / 16 * 6.28; G.fx.chunks(new G.V3(p.x + Math.cos(a) * radius * 0.7, 0.2, p.z + Math.sin(a) * radius * 0.7), 1, 0x6a6058, 0.12); } G.sfx('boom', 0.8, p); }
    else if (kind === 'implode') { const c = e && e.def.blood === 'ember' ? 0xff7030 : e && e.def.blood === 'ichor' ? 0xd0ffd0 : 0xb080ff; G.fx.shockwave(p, radius * 1.3, c, 0.45); G.fx.burst(new G.V3(p.x, 1, p.z), c, 40, 7, 0.35); G.fx.spark(p, c, 30, 9, 0.6, 0.1); G.Lights.flash(new G.V3(p.x, 1.2, p.z), c, 7, radius * 4, 0.5); G.fx.decal('crack', p.x, p.z, radius * 1.4, 0x222222, 25); G.sfx('boom', 0.8, p); G.sfx('zap', 0.6, p); }
    else if (kind === 'spikes') { this.spikes(p, radius, e && e.def.blood === 'bone' ? 'bone' : 'rock'); G.sfx('bone', 0.8, p); }
    else if (kind === 'meteor' || kind === 'explosion' || kind === 'fire') { G.fx.fire(p, 40, radius * 0.8, 1.2, 4); G.fx.spark(p, 0xff9030, 40, 10, 0.8, 0.12); G.fx.smoke(p, 10, 0x1a1210, 2.5, 1.5); G.fx.shockwave(p, radius * 1.3, 0xff7020, 0.45); G.fx.decal('scorch', p.x, p.z, radius * 2.2, 0xffffff, 40); G.Lights.flash(p, 0xff6010, 8, radius * 4, 0.6); G.sfx('boom', 1, p); if (kind === 'meteor') G.fx.chunks(p, 8, 0x2a1a10, 0.25); }
    else if (kind === 'acid' || kind === 'poison') { G.fx.decal('acid', p.x, p.z, radius * 2.2, 0x80ff40, 8); G.fx.burst(p, 0x80ff40, 24, 4, 0.4); G.sfx('squish', 0.7, p); }
    else if (kind === 'frost') { G.sfx('frost', 1, p); G.fx.ice(p, 50, 9); G.fx.decal('frost', p.x, p.z, radius * 2.4, 0x9ad8ff, 15); G.fx.shockwave(p, radius * 1.2, 0x9ad8ff, 0.5); G.sfx('shatter', 1, p); this.spikes(p, radius, 'ice'); }
  },
  spikes(p, radius, mat) {
    const g = new THREE.Group(); g.position.set(p.x, 0, p.z); G.scene.add(g);
    const mt = mat === 'bone' ? G.mat('bone') : mat === 'ice' ? new THREE.MeshStandardMaterial({ color: 0xbfe8ff, roughness: 0.05, transparent: true, opacity: 0.8, emissive: 0x2a6a9a, emissiveIntensity: 0.6, flatShading: true }) : G.mat('rock');
    for (let k = 0; k < 9; k++) { const a = Math.random() * 6.28, r = Math.random() * radius * 0.8, h = 0.8 + Math.random() * 1.6; M.P(g, M.cone(0.15 + Math.random() * 0.12, h, 6), mt, [Math.cos(a) * r, h / 2, Math.sin(a) * r], [(Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5]); }
    g.scale.y = 0.01; const o = { g, t: 0 }; (this.spikeList || (this.spikeList = [])).push(o);
  },
  updateProps(dt) {
    if (this.spikeList) for (let i = this.spikeList.length - 1; i >= 0; i--) { const s = this.spikeList[i]; s.t += dt; s.g.scale.y = s.t < 0.12 ? s.t / 0.12 : s.t > 1.6 ? Math.max(0.01, 1 - (s.t - 1.6) * 2) : 1; if (s.t > 2.1) { G.scene.remove(s.g); this.spikeList.splice(i, 1); } }
  },

  /* ---------------- hits & death (all clients) ---------------- */
  hitFx(e, dmg, type, point, dir, crit, info = {}) {
    e.flash = 1; e.hurt = Math.min(1, e.hurt + 0.6); e.hitLocalT = G.now();
    const p = point || new G.V3(e.pos.x, e.def.h * 0.6 + e.y, e.pos.z), d = dir || new G.V3(0, 0, 1);
    const bt = e.def.blood;
    if (type === 'fire') { G.fx.fire(p, 10, 0.3, 0.5); G.fx.embers(p, 6); e.char = Math.min(0.85, e.char + 0.12); this.bodyMark(e, p, 'burn'); G.fx.decal('scorch', e.pos.x + (Math.random() - 0.5), e.pos.z + (Math.random() - 0.5), 1.2, 0xffffff, 30); }
    else if (type === 'ice') { G.fx.ice(p, 10, 3); this.bodyMark(e, p, 'frost'); }
    else if (type === 'holy' || type === 'lightning') { G.fx.holy(p, 10, 0.3); G.fx.spark(p, type === 'holy' ? 0xffe08a : 0x9ad0ff, 10, 4); }
    else {
      const wet = G.gore.hit(e, type, p, d, crit, info);
      if (!wet) G.fx.blood(p, d, crit ? 18 : 10, bt, type === 'blunt' ? 1.6 : 0.8);
      if (type === 'blunt') G.fx.mist(p, 0x998877, 3, 0.4, 2);
      G.fx.spark(p, 0xffffff, 2, 3, 0.12, 0.05, 0);
    }
    if (dmg > 0) G.fx.dmgNumber(new G.V3(p.x, p.y + 0.4, p.z), dmg, crit, type === 'fire' ? '#ffb05a' : type === 'ice' ? '#9ad8ff' : type === 'holy' ? '#ffe08a' : type === 'lightning' ? '#b0d8ff' : null);
    const blade = type === 'slash' || type === 'pierce';
    if (bt === 'bone') { G.sfx('bonehit', 0.9, e.pos); if (blade) G.sfx('cling', 0.55, e.pos); }
    else if (bt === 'stone') { G.sfx('stonehit', 0.9, e.pos); if (blade) G.sfx('cling', 0.6, e.pos); }
    else if (type === 'fire') { G.sfx('fire', 0.5, e.pos); G.sfx('sizzle', 0.5, e.pos); }
    else if (type === 'ice') G.sfx('ice', 0.7, e.pos);
    else if (type === 'holy') G.sfx('holy', 0.35, e.pos);
    else if (type === 'lightning') G.sfx('zap', 0.6, e.pos);
    else { if (type === 'blunt') G.sfx('thump', 1, e.pos); else G.sfx('slice', 0.8, e.pos); G.sfx('flesh', 0.8, e.pos); if (bt === 'ember') G.sfx('sizzle', 0.5, e.pos); }
    if (e.def.armored && blade && Math.random() < 0.6) G.sfx(e.boss ? 'clang' : 'cling', 0.6, e.pos);
    if (crit) { G.sfx('hitcrit', 0.9, e.pos); G.sfx('cling', 0.5, e.pos); }
    if ((e.type === 'goblin' || e.type === 'shaman') && Math.random() < 0.35) G.sfx('goblinhurt', 0.6, e.pos);
    if (Math.random() < 0.15) G.sfx(e.def.groan === 'roar' ? 'groan' : e.def.groan, 0.35, e.pos);
  },
  // wound / burn / frost marks stuck onto the body
  bodyMark(e, p, kind) {
    if (e.decals > 10 || e.R.kind === 'elem') return; e.decals++;
    const joints = [e.R.chest, e.R.head, e.R.torso, e.R.hips, e.R.body, e.R.abd, e.R.neck && e.R.neck[0] ? e.R.neck[0] : e.R.neck].filter(Boolean);
    let best = joints[0], bd = 1e9; const wp = new G.V3();
    joints.forEach(j => { j.getWorldPosition(wp); const d = wp.distanceToSquared(p); if (d < bd) { bd = d; best = j; } }); if (!best) return;
    best.getWorldPosition(wp); const local = best.worldToLocal(p.clone());
    const mat = kind === 'blood' ? G.mat('col', { c: 0x6a0000, r: 0.15, m: 0.1 }) : kind === 'burn' ? G.mat('col', { c: 0x0a0604, r: 1, e: 0x401000, ei: 0.6 }) : G.mat('col', { c: 0xd0f0ff, r: 0.1, e: 0x305080, ei: 0.5 });
    const ws = new G.V3(); best.getWorldScale(ws);
    const m = M.P(best, M.sph(0.07, 10, 8), mat, [local.x * 0.9, local.y, local.z * 0.9], 0, [(1 + Math.random()) / ws.x, (0.6 + Math.random() * 0.8) / ws.y, 0.6 / ws.z]);
    m.lookAt(wp);
  },
  kill(e, type, opts = {}) {
    if (!e || e.dead) return; e.dead = true; if (e.atk && e.atk.light) { const i = G.World.lights.indexOf(e.atk.light); if (i >= 0) G.World.lights.splice(i, 1); } e.guardT = 0;
    if (e.def.deathCloud) { const p = e.pos.clone(); G.enemies.aoeFx('acid', new G.V3(p.x, 0.3, p.z), 3, null); G.fx.mist(new G.V3(p.x, 0.8, p.z), 0x90ff40, 30, 2.4, 1.5); G.fx.decal('acid', p.x, p.z, 4, 0x80ff40, 10); const me = G.player; if (me && !me.dead && !me.downed && G.dist2(me.pos.x, me.pos.z, p.x, p.z) < 9) me.addDot(4 * this.diff().dmg, 4, 'poison'); } e.atk && e.atk.spots.forEach(s => { if (G.fx.tele.includes(s.tg)) { G.scene.remove(s.tg.g); G.fx.tele.splice(G.fx.tele.indexOf(s.tg), 1); } }); e.atk && e.atk.fx.forEach(f => G.scene.remove(f.m)); e.atk = null; e.leap = null; e.y = 0;
    if (e.bar) e.bar.visible = false;
    const bt = e.def.blood, p = new G.V3(e.pos.x, e.def.h * 0.55, e.pos.z);
    const killer = opts.from ? new G.V3(opts.from.x, 0, opts.from.z) : null; const away = killer ? new G.V3(e.pos.x - killer.x, 0, e.pos.z - killer.z).normalize() : new G.V3(Math.sin(e.rot + Math.PI), 0, Math.cos(e.rot + Math.PI));
    e.death = { t: 0, type, away, mode: 'fall' };
    if (type === 'flee') { e.death.mode = 'flee'; G.fx.smoke(new G.V3(e.pos.x, 0.8, e.pos.z), 14, 0x2a2430, 2); G.sfx('zap', 0.5, e.pos); e.root.visible = false; this.remove(e); return; }
    if (e.affix && e.affix.includes('explosive')) { const ex = e.pos.clone(), dm = 22 * e.dmgMul, tg = G.fx.telegraph(ex.x, ex.z, 4, 1.1, 0xff9020); G.sfx('sizzle', 0.8, ex);
      setTimeout(() => { if (G.fx.tele.includes(tg)) { G.scene.remove(tg.g); G.fx.tele.splice(G.fx.tele.indexOf(tg), 1); } G.enemies.aoeFx('explosion', new G.V3(ex.x, 1, ex.z), 4, null); const me = G.player; if (me && !me.dead && !me.downed && G.dist2(me.pos.x, me.pos.z, ex.x, ex.z) < 16) me.takeDamage(dm, ex, { save: true, dc: 13 + Math.floor((G.run.depth || 0) / 2), type: 'fire', unblockable: true }); }, 1100); }
    G.sfx(e.def.blood === 'bone' ? 'bonecollapse' : e.def.groan === 'roar' ? 'groan' : e.def.groan, 0.9, e.pos);
    if (e.iceMesh && type !== 'ice') G.fx.removeIce(e, true);
    if (type === 'ice') { G.fx.iceBlock(e); e.death.mode = 'shatter'; }
    else if (type === 'fire') { e.death.mode = 'char'; }
    else if (type === 'holy' || type === 'lightning') { e.death.mode = 'ascend'; G.sfx('holy', 0.6, e.pos); }
    else if (bt === 'bone' || bt === 'stone' || e.R.kind === 'elem') { e.death.mode = 'crumble'; }
    else if (type === 'blunt') { e.death.mode = 'launch'; e.death.v = new G.V3(away.x * 7, 5, away.z * 7); e.death.spin = (Math.random() - 0.5) * 8; G.fx.blood(p, away, 25, bt, 1.2); }
    else if (type === 'slash' && e.R.kind === 'hum' && e.R.head && (opts.overkill || Math.random() < 0.45) && G.settings.gore) { e.death.mode = 'decap'; G.fx.flyPart(e.R.head, new G.V3(away.x * 3 + (Math.random() - 0.5) * 2, 6 + Math.random() * 2, away.z * 3 + (Math.random() - 0.5) * 2), bt); e.death.fountain = 1.6; }
    else { e.death.mode = 'fall'; G.fx.blood(p, away, 18, bt, 1); }
    if (e.boss) { G.fx.shake(1); G.Lights.flash(p, 0xffffff, 8, 20, 1); }
    // shadow off
    e.root.children.forEach(c => { if (c.material && c.material.map === G.tex.sprite('shadow')) c.visible = false; });
  },
  updateDeath(e, dt, t) {
    const D = e.death; if (!D) return; D.t += dt; const R = e.R, root = R.root;
    const bt = e.def.blood, chest = new G.V3(e.pos.x, e.def.h * 0.5, e.pos.z);
    // every death pose is a target the smoothing layer eases into, so a body leaves whatever it was doing
    // (mid-swing, mid-stride) instead of snapping to a stiff plank
    e.st.t += dt; M.preRig(R);
    if (D.tw === undefined) { D.tw = (Math.random() - 0.5) * 0.5; D.side = Math.random() < 0.5 ? 1 : -1; D.ph = Math.random() * 6; }
    const fallTo = (dirSign, speed = 2.2) => {
      const tt = D.t * speed, f = tt < 1 ? tt * tt : 1 - 0.07 * Math.abs(Math.sin((tt - 1) * 9)) * Math.exp(-(tt - 1) * 5);   // gravity, then a small rebound on impact
      const buckle = G.smooth(Math.min(1, D.t * 3.2)), twitch = Math.sin(D.t * 23 + D.ph) * Math.exp(-D.t * 2.2) * (tt > 1 ? 1 : 0);
      if (R.kind === 'hum') {
        root.rotation.set(dirSign * (Math.PI / 2) * 0.96 * f, 0, D.tw * f); root.position.y = e.pos.y + f * 0.15 * e.def.r;
        R.hips.position.y = 0.95 - 0.22 * buckle * (1 - f * 0.8); R.body.position.set(0, 0, 0);
        R.legL.hip.rotation.set(-0.5 * buckle * (1 - f) + 0.15 * f, 0, 0.12 * f); R.legR.hip.rotation.set(-0.35 * buckle * (1 - f) - 0.1 * f, 0, -0.1 * f);
        R.legL.kn.rotation.set(1.0 * buckle * (1 - f * 0.75) + twitch * 0.15, 0, 0); R.legR.kn.rotation.set(0.75 * buckle * (1 - f * 0.6), 0, 0);
        R.legL.foot.rotation.set(0.3 * f, 0, 0); R.legR.foot.rotation.set(0.4 * f, 0, 0);
        R.torso.rotation.set(-dirSign * 0.25 * buckle * (1 - f) + dirSign * 0.12 * f, 0, D.tw * 0.5);
        R.chest.rotation.set(0, 0, 0); R.neck.rotation.set(dirSign * 0.45 * Math.sin(Math.min(1, tt) * Math.PI), 0, D.side * 0.45 * f); R.head.rotation.set(0, D.side * 0.3 * f, 0);
        R.armL.sh.rotation.set(-1.0 * f - 0.4 * Math.sin(Math.min(1, tt) * Math.PI), 0, 0.5 + 0.7 * f); R.armR.sh.rotation.set(-0.7 * f - 0.5 * Math.sin(Math.min(1, tt) * Math.PI), 0, -0.4 - 0.8 * f);
        R.armL.el.rotation.set(-0.3 - 0.4 * (1 - f) + twitch * 0.2, 0, 0); R.armR.el.rotation.set(-0.5 - 0.3 * (1 - f), 0, 0);
        if (R.wings) { R.wings[0].rotation.set(0, -0.6 * f, 0.9 * f); R.wings[1].rotation.set(0, 0.6 * f, -0.9 * f); }
        if (R.jaw) R.jaw.rotation.x = 0.35 * f;
      } else if (R.kind === 'spider') {
        // legs curl in under the body as it drops, with dying twitches
        R.body.position.y = G.lerp(0.55, 0.16, G.smooth(Math.min(1, D.t * 2.5))); R.body.rotation.set(0.1 * f, 0, D.tw * 0.3 * f);
        R.legs.forEach((L, i) => { const tw2 = Math.sin(D.t * 30 + i * 1.7) * Math.exp(-D.t * 1.6) * 0.25; L.base.rotation.set(0, L.by, 0); L.ch[0].rotation.set(0, 0, G.lerp(2.15, 0.7, buckle) + tw2); L.ch[1].rotation.set(0, 0, G.lerp(-1.55, -2.7, buckle)); L.ch[2].rotation.set(0, 0, G.lerp(-0.35, -1.3, buckle)); });
        if (R.fangs) R.fangs.forEach((g, i) => g.rotation.z = (i ? 1 : -1) * 0.6 * buckle); root.position.y = e.pos.y;
      } else if (R.kind === 'quad' || R.kind === 'dragon') {
        // topple onto a side; legs kick out stiff then go slack, head drops, tail goes limp
        root.rotation.set(0, 0, D.side * (Math.PI / 2) * 0.9 * f); root.position.y = e.pos.y + f * (R.kind === 'dragon' ? 0.5 : 0.18);
        R.legs.forEach((L, i) => { const k2 = Math.sin(D.t * 14 + i) * Math.exp(-D.t * 2.5) * 0.5; L.b.rotation.set((L.front ? -0.5 : 0.5) * f + k2, 0, 0); L.ch[1].rotation.set((L.front ? -0.2 : 0.3) * (1 - f) + (L.front ? -0.6 : 0.6) * f, 0, 0); });
        if (R.head) R.head.rotation.set((R.kind === 'dragon' ? 0.55 : 0.4) + 0.5 * f, 0, 0); if (R.jaw) R.jaw.rotation.x = 0.5 * f;
        if (R.tail) R.tail.forEach(j => j.rotation.set(0.05 * f, 0, 0)); if (R.neck && Array.isArray(R.neck)) R.neck.forEach(n => n.rotation.y = 0);
        if (R.wings) { R.wings[0].rotation.set(0, -0.3, -0.4 * f); R.wings[1].rotation.set(0, 0.3, 0.4 * f); }
      } else { root.rotation.x = dirSign * (Math.PI / 2) * f; root.position.y = e.pos.y + f * 0.15 * e.def.r; }
    };
    switch (D.mode) {
      case 'fall': fallTo(Math.random() < 0 ? 1 : -1); if (D.t < 0.5 && Math.random() < 0.4) G.fx.blood(chest, new G.V3(0, 1, 0), 2, bt, 0.6); if (!D.pool && D.t > 0.6) { D.pool = 1; G.fx.bloodPool(e.pos.x, e.pos.z, e.def.r * 4 * (e.boss ? 2 : 1), bt); G.sfx('thunk', 0.5, e.pos); } break;
      case 'decap': fallTo(1, 1.8); if (D.fountain > 0) { D.fountain -= dt; const n = R.neck || R.chest; const wp = new G.V3(); n.getWorldPosition(wp); const beat = (D.t * 3) % 1; if (beat < 0.3) G.gore.squirt(wp, new G.V3(Math.sin(e.rot) * 0.4 + (Math.random() - 0.5) * 0.2, 1, Math.cos(e.rot) * 0.4).normalize(), bt, 4, 5.5 * D.fountain / 1.6 + 1.5, 0.12, 1.1); } if (!D.pool && D.t > 0.7) { D.pool = 1; G.fx.bloodPool(e.pos.x, e.pos.z, e.def.r * 4.5, bt); } break;
      case 'launch': { D.v.y -= 18 * dt; e.pos.x += D.v.x * dt; e.pos.z += D.v.z * dt; G.World.collide(e.pos, e.def.r * 0.5); e.y = Math.max(0, (e.y || 0) + D.v.y * dt); if (e.y <= 0 && D.v.y < 0) { if (!D.landed) { D.landed = 1; G.fx.bloodPool(e.pos.x, e.pos.z, e.def.r * 4, bt); G.fx.smoke(new G.V3(e.pos.x, 0.2, e.pos.z), 4, 0x5a4a3a, 1.2); G.sfx('thunk', 0.7, e.pos); } D.v.set(D.v.x * 0.8, 0, D.v.z * 0.8); } { const rx = G.damp(root.rotation.x, -Math.PI / 2, 6, dt), rz = root.rotation.z + (D.landed ? 0 : D.spin * dt); if (R.kind === 'hum') { const fl = D.landed ? 0 : 1, s1 = Math.sin(D.t * 13) * fl; R.armL.sh.rotation.set(-2.2 + s1 * 0.6, 0, 0.9); R.armR.sh.rotation.set(-1.8 - s1 * 0.6, 0, -0.9); R.legL.hip.rotation.set(-0.6 * fl + s1 * 0.3, 0, 0.2); R.legR.hip.rotation.set(-0.2 * fl - s1 * 0.3, 0, -0.2); R.legL.kn.rotation.x = 0.9 * fl; R.legR.kn.rotation.x = 0.4; R.neck.rotation.set(-0.4 * fl, 0, D.landed ? 0.4 : 0); } root.rotation.x = rx; root.rotation.z = rz; } e.root.position.set(e.pos.x, e.y, e.pos.z); break; }
      case 'char': {
        const k = Math.min(1, D.t / 1.2); e.char = Math.max(e.char, k);
        for (const o of e.mats) { if (o.c) o.m.color.copy(o.c).lerp(G._black || (G._black = new THREE.Color(0x0a0604)), k * 0.95); if (o.m.emissive) { o.m.emissive.setRGB(1, 0.25, 0.02); o.m.emissiveIntensity = (1 - k * 0.6) * (0.4 + Math.sin(t * 30 + o.m.id) * 0.25); } }
        if (Math.random() < 0.8) G.fx.fire(new G.V3(e.pos.x + (Math.random() - 0.5) * e.def.r * 1.5, Math.random() * e.def.h * (1 - k * 0.5), e.pos.z + (Math.random() - 0.5) * e.def.r * 1.5), 2, 0.3, 0.6, 2);
        if (R.kind === 'hum') { R.torso.rotation.x = k * 0.6; R.armL.sh.rotation.x = -1.5 * k; R.armR.sh.rotation.x = -1.6 * k; R.hips.position.y = 0.95 - k * 0.5; R.legL.kn.rotation.x = R.legR.kn.rotation.x = k * 1.6; R.legL.hip.rotation.x = R.legR.hip.rotation.x = -k * 1.2; }
        if (D.t > 1.4 && !D.done) { D.done = 1; G.fx.decal('scorch', e.pos.x, e.pos.z, e.def.r * 5, 0xffffff, 60); G.fx.smoke(chest, 12, 0x1a1410, 2, 1.2); G.fx.embers(chest, 30, e.def.r * 2); G.fx.dismember(e.root, { cx: e.pos.x, cz: e.pos.z, up: 1.5, life: 4, max: 30, mat: G.mat('col', { c: 0x0a0806, r: 1, e: 0x401000, ei: 0.5 }) }); G.sfx('fire', 0.6, e.pos); this.remove(e); }
        break; }
      case 'shatter': if (D.t > 0.45 && !D.done) { D.done = 1; G.fx.removeIce(e, true); G.fx.dismember(e.root, { cx: e.pos.x, cz: e.pos.z, up: 5, life: 5, max: 50, mat: new THREE.MeshStandardMaterial({ color: 0xbfe8ff, roughness: 0.1, transparent: true, opacity: 0.85, emissive: 0x2a6a9a, emissiveIntensity: 0.6, flatShading: true }) }); this.remove(e); } break;
      case 'ascend': { const k = Math.min(1, D.t / 1.6); e.root.position.y = e.pos.y + k * 2.5; root.rotation.x = -0.4 * k; for (const o of e.mats) { o.m.transparent = true; o.m.opacity = 1 - k; if (o.m.emissive) { o.m.emissive.setRGB(1, 0.9, 0.6); o.m.emissiveIntensity = k * 2; } } if (Math.random() < 0.9) G.fx.holy(new G.V3(e.pos.x, e.root.position.y + Math.random() * e.def.h, e.pos.z), 3, e.def.r); if (k >= 1 && !D.done) { D.done = 1; G.fx.burst(new G.V3(e.pos.x, 3, e.pos.z), 0xffe08a, 40, 5); G.fx.decal('rune', e.pos.x, e.pos.z, 3, 0xffd080, 6); this.remove(e); } break; }
      case 'crumble': if (!D.done) { D.done = 1; if (bt === 'bone') G.sfx('bonecollapse', 0.8, e.pos); G.fx.dismember(e.root, { cx: e.pos.x, cz: e.pos.z, up: bt === 'stone' ? 2 : 3, life: e.boss ? 20 : 14, max: e.boss ? 120 : 60, push: D.away }); if (bt === 'ember') { G.fx.fire(chest, 30, 1, 1, 3); G.fx.decal('scorch', e.pos.x, e.pos.z, 4, 0xffffff, 40); } G.fx.mist(chest, bt === 'stone' ? 0x8a8a8a : 0xd8ccb0, 12, 1.5, 2); G.sfx(bt === 'stone' ? 'boom' : 'bone', 0.8, e.pos); this.remove(e); } break;
    }
    if (!D.removed && root.parent) M.smoothRig(R, e.st, D.mode === 'launch' ? 12 : 9);
    if (!D.removed && D.t > (e.boss ? 40 : 25)) { e.root.position.y -= dt * 0.3; if (D.t > (e.boss ? 44 : 29)) this.remove(e); }
  },
  remove(e) { if (e.atk) { const A = e.atk; if (A.light) { const i = G.World.lights.indexOf(A.light); if (i >= 0) G.World.lights.splice(i, 1); } (A.fx || []).forEach(f => G.scene.remove(f.m)); (A.spots || []).forEach(s => { if (G.fx.tele.includes(s.tg)) { G.scene.remove(s.tg.g); G.fx.tele.splice(G.fx.tele.indexOf(s.tg), 1); } }); e.atk = null; } if (e.root.parent) e.root.parent.remove(e.root); e.death && (e.death.removed = true); const i = this.list.indexOf(e); if (i >= 0) this.list.splice(i, 1); delete this.map[e.id]; },
  // non-host: apply snapshot
  applySnapshot(arr) {
    const seen = new Set();
    for (let i = 0; i < arr.length; i += 7) {
      const id = arr[i], ti = arr[i + 1]; let e = this.map[id];
      if (!e) { if (this.deadIds && this.deadIds.has(id)) continue; e = this.spawn(id, G.ALL_TYPES[ti], arr[i + 2] / 10, arr[i + 3] / 10, { awake: true, summoned: id % 10000 >= 5000 }); if (!e) continue; }
      if (e.dead) continue; seen.add(id);
      e.netPos.set(arr[i + 2] / 10, 0, arr[i + 3] / 10); e.netRot = arr[i + 4] / 100; G.netBuf.push(e.nb || (e.nb = []), e.netPos.x, e.netPos.z, e.netRot);
      const hp = arr[i + 5]; if (G.now() - e.hitLocalT > 0.6 || hp < e.hp) e.hp = hp; e.flags = arr[i + 6]; e.cower = !!(e.flags & 32);
      if (!e.awake) { e.awake = true; }
      if (Math.hypot(e.netPos.x - e.pos.x, e.netPos.z - e.pos.z) > 6 && !e.leap) { e.pos.copy(e.netPos); e.nb.length = 0; G.netBuf.push(e.nb, e.netPos.x, e.netPos.z, e.netRot); e.vrot = e.rot = e.netRot; }
    }
  }
};
