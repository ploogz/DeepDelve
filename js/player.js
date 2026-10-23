/* ============================================================
   Local player: first-person controller, class combat, blocking,
   dodging, abilities, viewmodel animation, downed/revive
   ============================================================ */
'use strict';
G.CLASS_ATK = {
  knight: { dmg: 24, range: 2.8, arc: 1.9, time: 0.55, hitAt: 0.45, type: 'slash', combo: ['slashR', 'slashL', 'thrust'], block: 0.85, crit: 0.06 },
  barbarian: { dmg: 42, range: 3.2, arc: 2.5, time: 0.88, hitAt: 0.48, type: 'slash', combo: ['overR', 'slashR', 'slam'], block: 0.6, crit: 0.08 },
  rogue: { dmg: 14, range: 2.4, arc: 1.4, time: 0.3, hitAt: 0.45, type: 'pierce', combo: ['stab', 'stabL', 'stab', 'cross'], block: 0.5, crit: 0.22 },
  archer: { dmg: 20, maxDmg: 54, range: 0, time: 0.25, type: 'pierce', block: 0.45, crit: 0.12 },
  wizard: { dmg: 26, time: 0.5, mana: 7, speed: 30, splash: 1.7, type: 'fire', block: 0.7, crit: 0.08 },
  priest: { dmg: 27, range: 2.6, arc: 1.7, time: 0.62, hitAt: 0.46, type: 'blunt', combo: ['smash', 'slashL', 'smash'], block: 0.65, crit: 0.06 }
};
G.ABIL = {
  knight: { q: { cd: 7, name: 'Shield Bash' }, r: { cd: 12, name: 'Valor Charge' } },
  barbarian: { q: { cd: 18, name: 'Blood Rage' }, r: { cd: 10, name: 'Leap Slam' } },
  rogue: { q: { cd: 6, name: 'Shadow Step' }, r: { cd: 9, name: 'Fan of Knives' } },
  archer: { q: { cd: 8, name: 'Volley' }, r: { cd: 10, name: 'Frost Arrow' } },
  wizard: { q: { cd: 9, name: 'Frost Nova', mana: 25 }, r: { cd: 6, name: 'Chain Lightning', mana: 30 } },
  priest: { q: { cd: 14, name: 'Holy Light', mana: 35 }, r: { cd: 8, name: 'Smite', mana: 30 } }
};

G.makePlayer = function (cls) {
  const info = G.CLASS_INFO[cls], S = G.save, cs = S.cls[cls], WD = G.weaponDef(cls, cs.arm), A = G.weaponAtk(cls, cs.arm);
  const P = {
    cls, info, pos: new G.V3(), vel: new G.V3(), yaw: 0, pitch: 0, y: 0,
    mods: G.baseMods(), upgrades: [], potions: 1 + S.flaskLv, runGold: 0, backpack: [], kills: 0,
    swing: null, combo: 0, comboT: 0, atkCD: 0, charge: -1, blocking: false, blockT: 0, dodgeT: 0, iframes: 0, staDelay: 0,
    cd: { q: 0, r: 0, h: 0, g: 0, v: 0 }, rageT: 0, valorT: 0, critNext: false, slowT: 0, frozenT: 0, dots: [], healOT: 0, healRate: 0,
    dead: false, downed: false, ds: null, reviveP: 0, bob: 0, stepT: 0, attackCounter: 0, atkKind: 'slash', hurtFlash: 0, swayX: 0, swayY: 0, tempestN: 0, auraT: 0, secondWindUsed: false, phoenixUsed: 0,
    wpnLv: cs.wpn, wpnMul: 1, wid: cs.arm | 0, W: WD, A,
    get maxHp() { return G.sheet.maxHp(this); },
    get maxSta() { return info.sta + G.sheet.mod(this, 'CON') * 5 + this.mods.sta; },
    get maxMana() { return G.sheet.maxMana(this); },
    get armor() { return G.clamp(S.armorLv * G.HIDEOUT.armor.red + this.mods.armor + (this.valorT > 0 ? 0.5 : 0) + (this.rageT > 0 ? 0.25 : 0) + (G.sheet.attuned(this, 'ringprot') ? 0.1 : 0), -0.5, 0.75); },
    get dmgTakenMul() { return (this.relics.includes('lens') ? 1.2 : 1) * (G.sheet.attuned(this, 'vulnerability') ? 1.25 : 1); },
    get slots() { return G.HIDEOUT.backpack.slots[S.backpackLv]; },
    get ab2() { return cs.ab2; }, get ab2Lv() { return cs.ab2Lv; }
  };
  G.sheet.init(P);
  if (P.wid) P.dnd = Object.assign({}, P.dnd, { weapon: Object.assign({}, P.dnd.weapon, WD.dice || {}, { name: WD.name }) });
  P.hp = P.maxHp; P.sta = P.maxSta; P.mana = P.maxMana;

  /* ---------- viewmodel ---------- */
  P.buildVM = () => {
    if (P.V) G.camera.remove(P.V.root);
    P.V = M.viewmodel(cls, P.wpnLv, P.wid); G.camera.add(P.V.root);
    if (cls === 'wizard') { const b = new THREE.Mesh(new THREE.SphereGeometry(0.7, 32, 16, 0, Math.PI * 2, 0, Math.PI / 3), new THREE.MeshBasicMaterial({ color: 0x80a0ff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, wireframe: false })); b.rotation.x = -Math.PI / 2; b.position.z = -0.25; b.visible = false; P.V.root.add(b); P.V.barrier = b; }
    P.V.root.traverse(o => { o.frustumCulled = false; });
  };

  P.heal = (amt, silent, who) => { if (P.dead) return; if (P.downed) { if (who) P.revive(Math.max(0.1, Math.min(0.5, amt / P.maxHp)), who); return; } const before = P.hp; P.hp = Math.min(P.maxHp, P.hp + amt); if (!silent && P.hp > before) { G.fx.holy(new G.V3(P.pos.x, 0.2, P.pos.z), 14, 0.6); G.fx.dmgNumber(new G.V3(P.pos.x, 1.8, P.pos.z), P.hp - before, false, '#7aff8a'); } };
  /* ---------- spellbook (G / V): wizard and priest spells learned at the library ---------- */
  P.spellIn = (slot) => { const id = cs[slot === 'g' ? 'slotG' : 'slotV'], book = G.SPELLS[cls]; return id && book && book[id] && (cs.spells || []).includes(id) ? id : null; };
  P.spell = (slot) => {
    const id = P.spellIn(slot); if (!id) { if (G.SPELLS[cls]) G.ui.toast('Learn spells at the Arcane Library and bind them to G and V'); return; }
    const S = G.SPELLS[cls][id]; if (P.cd[slot] > 0 || P.cast) return;
    const cost = S.mana * (P.feats.includes('warcaster') ? 0.8 : 1); if (P.mana < cost) { G.ui.toast('Not enough mana'); return; }
    const go = () => { if (P.mana < cost) { G.ui.toast('Not enough mana'); return; } P.mana -= cost; P.cd[slot] = S.cd * (1 - P.mods.cdr); P.castSpell(id); };
    if (S.cast) P.beginCast(S.name, S.cast, go); else go();
  };
  P.castSpell = (id) => {
    const INT = G.sheet.mod(P, 'INT'), WIS = G.sheet.mod(P, 'WIS'), fy = P.yaw + Math.PI, fx = Math.sin(fy), fz = Math.cos(fy);
    const orbP = () => { const o = new G.V3(); if (P.V && P.V.weapon && P.V.weapon.userData.orb) P.V.weapon.userData.orb.getWorldPosition(o); else o.copy(P.eye()).addScaledVector(P.forward(), 0.6); return o; };
    const near = (x, z, r, f) => { G.pvp.areaHit(x, z, r, c => G.rollN(c ? 4 : 2, 6) + Math.max(INT, WIS), 'force', {}); for (const e of G.enemies.list) if (!e.dead && !e.cower && G.dist2(e.pos.x, e.pos.z, x, z) < (r + e.def.r) ** 2) f(e); };
    switch (id) {
      case 'meteor': { const aim = P.aim(35), x = aim.point.x, z = aim.point.z; P.startSwing('nova', 0.5, null, 0.4);
        G.fx.meteor(x, z, 0.85, () => { G.game.breakArea(x, z, 4.5, true); G.World.hitGatesNear(x, z, 4.5); near(x, z, 4.5, e => G.combat.deal(e, 0, 'fire', { roll: c => G.rollN(c ? 8 : 4, 8), noChain: true, knock: 1.5 })); for (let k = 0; k < 6; k++) G.fx.decal('scorch', x + (Math.random() - 0.5) * 6, z + (Math.random() - 0.5) * 6, 2, 0xffffff, 25); P.burnField = { x, z, t: 4, tick: 0 }; });
        G.net.sendFx({ k: 'meteor', x, z }); G.sfx('firecast', 1); break; }
      case 'missiles': P.mq = { n: 5, t: 0 }; P.startSwing('cast', 0.6, null, 0.2); break;
      case 'blink': { const from = P.pos.clone(), d = G.World.W ? Math.max(0, G.World.rayWall(P.pos.x, P.pos.z, fx, fz, 12) - 0.7) : 12, to = new G.V3(P.pos.x + fx * d, 0, P.pos.z + fz * d);
        G.fx.burst(new G.V3(from.x, 1, from.z), 0xb080ff, 30, 5, 0.3); G.fx.shockwave(from, 3, 0xb080ff, 0.35); G.fx.smoke(new G.V3(from.x, 0.8, from.z), 6, 0x2a1a40, 1.4);
        near(from.x, from.z, 3, e => G.combat.deal(e, 0, 'force', { roll: c => G.rollN(c ? 2 : 1, 6), noChain: true, slow: 2.5, knock: 1 }));
        P.pos.copy(to); P.iframes = Math.max(P.iframes, 0.3); P.vel.set(0, 0, 0); G.World.collide(P.pos, 0.42);
        G.fx.burst(new G.V3(P.pos.x, 1, P.pos.z), 0xd0b0ff, 24, 4, 0.25); G.sfx('zap', 0.8); G.net.sendFx({ k: 'shadow', x: from.x, z: from.z, x2: P.pos.x, z2: P.pos.z }); break; }
      case 'icelance': { const o = orbP(), aim = P.aim(60), d = aim.point.clone().sub(o).normalize();
        G.proj.spawn({ kind: 'icelance', pos: o, dir: d, speed: 55, owner: 'me', dmg: 0, roll: c => G.rollN(c ? 4 : 2, 8) + INT, dtype: 'ice', pierce: 5, shatter: 3, slow: 2, life: 1.6, r: 0.32 });
        G.net.sendFx({ k: 'proj', pk: 'icelance', p: [o.x, o.y, o.z], d: [d.x, d.y, d.z], s: 55 }); G.sfx('ice', 1); G.Lights.flash(o, 0x80d0ff, 4, 7, 0.25); P.startSwing('swipe', 0.4, null, 0.3); P.kickX = (P.kickX || 0) + 0.02; break; }
      case 'sanctuary': { const x = P.pos.x, z = P.pos.z; P.sanct = { x, z, t: 6, tick: 0 }; G.fx.healZone(x, z, 5, 6, 0xffe08a); G.fx.beam(new G.V3(x, 0, z), 0xffe08a, 12, 2.5, 0.9); G.sfx('holy', 0.9); P.startSwing('holy', 0.6, null, 0.4); G.net.sendFx({ k: 'hz', x, z, r: 5, d: 6 }); break; }
      case 'ward': { const amt = 15 + 3 * Math.max(0, WIS); P.addWard(amt, 8); G.net.sendSup({ k: 'ward', amt, x: P.pos.x, z: P.pos.z, r: 8 }); G.fx.shockwave(P.pos, 8, 0xffd070, 0.5); G.sfx('holy', 0.8); P.startSwing('holy', 0.5, null, 0.3); G.net.sendFx({ k: 'wardfx', x: P.pos.x, z: P.pos.z }); break; }
      case 'radiant': { P.startSwing('swipe', 0.45, () => {
          const o = P.eye(); for (let k = 0; k < 70 * G.fx.q(); k++) { const a = fy + (Math.random() - 0.5) * 1.2, sp = 10 + Math.random() * 8; G.fx.emit(G.fx.add, o.x + fx * 0.6, o.y - 0.3, o.z + fz * 0.6, Math.sin(a) * sp, (Math.random() - 0.4) * 2, Math.cos(a) * sp, 0.45, 0.35, 0.05, [2, 1.8, 1.1, 1], [1, 0.7, 0.2, 0]); }
          G.Lights.flash(new G.V3(P.pos.x + fx * 3, 1.5, P.pos.z + fz * 3), 0xfff0c0, 8, 12, 0.35); G.sfx('holy', 1); G.fx.shake(0.2);
          for (const e of G.enemies.list) { if (e.dead) continue; const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, d = Math.hypot(dx, dz) - e.def.r; if (d > 7 || Math.abs(G.angDiff(fy, Math.atan2(dx, dz))) > 0.62 || !G.World.los(P.pos.x, P.pos.z, e.pos.x, e.pos.z)) continue;
            const undead = ['bone', 'ecto', 'rot'].includes(e.def.blood); G.combat.deal(e, 0, 'holy', { roll: c => (G.rollN(c ? 6 : 3, 6) + WIS) * (undead ? 2 : 1), noChain: true, knock: 2, slow: 2.5 }); }
          G.net.sendFx({ k: 'radiant', x: P.pos.x, z: P.pos.z, a: Math.round(fy * 100) / 100 });
        }, 0.35); break; }
      case 'guardians': P.guardT = 10; P.guardTick = 0; G.fx.orbiters(() => P.pos, 3, 0xfff0b0, 10, 2.6); G.net.sendFx({ k: 'sg', d: 10 }); G.sfx('holy', 0.8); P.startSwing('holy', 0.5, null, 0.3); break;
    }
  };
  P.addWard = (amt, dur) => { P.ward = { hp: Math.max(P.ward ? P.ward.hp : 0, amt), t: dur }; G.fx.holy(new G.V3(P.pos.x, 0.2, P.pos.z), 24, 0.8); G.ui.toast(`Divine Ward · absorbs ${Math.round(amt)} damage`); };
  // lingering spell effects, ticked every frame
  P.updateSpells = (dt) => {
    if (P.ward) { P.ward.t -= dt; if (P.ward.t <= 0 || P.ward.hp <= 0) P.ward = null; }
    if (P.mq) { P.mq.t -= dt; if (P.mq.t <= 0 && P.mq.n > 0) { P.mq.n--; P.mq.t = 0.11;
        const o = (() => { const v = new G.V3(); if (P.V && P.V.weapon && P.V.weapon.userData.orb) P.V.weapon.userData.orb.getWorldPosition(v); else v.copy(P.eye()); return v; })(), f = P.forward();
        let best = null, bd = 30 * 30; for (const e of G.enemies.list) { if (e.dead) continue; const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, d2 = dx * dx + dz * dz; if (d2 < bd && (dx * f.x + dz * f.z) > 0 && G.World.los(P.pos.x, P.pos.z, e.pos.x, e.pos.z)) { bd = d2; best = e; } }
        const d = f.clone().applyAxisAngle(new G.V3(0, 1, 0), (Math.random() - 0.5) * 0.9); d.y += 0.15 + Math.random() * 0.2;
        G.proj.spawn({ kind: 'arcane', pos: o, dir: d, speed: 22, owner: 'me', dmg: 0, roll: c => G.rollN(c ? 2 : 1, 4) + G.sheet.mod(P, 'INT'), dtype: 'force', seek: best, life: 2.2, r: 0.3 });
        G.net.sendFx({ k: 'proj', pk: 'arcane', p: [o.x, o.y, o.z], d: [d.x, d.y, d.z], s: 22 }); G.sfx('magic', 0.45); }
      if (P.mq.n <= 0) P.mq = null; }
    if (P.burnField) { const B = P.burnField; B.t -= dt; B.tick -= dt; if (Math.random() < 0.6) G.fx.fire(new G.V3(B.x + (Math.random() - 0.5) * 7, 0.1, B.z + (Math.random() - 0.5) * 7), 1, 0.3, 0.6, 1.6);
      if (B.tick <= 0) { B.tick = 0.5; for (const e of G.enemies.list) if (!e.dead && G.dist2(e.pos.x, e.pos.z, B.x, B.z) < 16) G.combat.deal(e, 0, 'fire', { roll: () => G.rollN(1, 4), noChain: true, noCrit: true }); }
      if (B.t <= 0) P.burnField = null; }
    if (P.sanct) { const Z = P.sanct; Z.t -= dt; Z.tick -= dt; if (Z.tick <= 0) { Z.tick = 1; const WIS = G.sheet.mod(P, 'WIS'), h = G.rollN(1, 4) + Math.max(0, WIS);
        if (G.dist2(P.pos.x, P.pos.z, Z.x, Z.z) < 25) P.heal(h, true); G.net.sendSup({ k: 'heal', amt: h, x: Z.x, z: Z.z, r: 5, quiet: 1 });
        for (const e of G.enemies.list) if (!e.dead && G.dist2(e.pos.x, e.pos.z, Z.x, Z.z) < (5 + e.def.r) ** 2) G.combat.deal(e, 0, 'holy', { roll: c => G.rollN(c ? 2 : 1, 6), noChain: true, noCrit: true }); }
      if (Z.t <= 0) P.sanct = null; }
    if (P.guardT > 0) { P.guardT -= dt; P.guardTick -= dt; if (P.guardTick <= 0) { P.guardTick = 0.7;
        for (const e of G.enemies.list) if (!e.dead && !e.cower && G.dist2(e.pos.x, e.pos.z, P.pos.x, P.pos.z) < (3.5 + e.def.r) ** 2) { G.combat.deal(e, 0, 'holy', { roll: c => G.rollN(c ? 2 : 1, 8), noChain: true, noCrit: true, slow: 1 }); G.fx.holy(new G.V3(e.pos.x, 0.5, e.pos.z), 8, 0.4); } } }
  };
  P.addDot = (dps, dur, kind) => { P.dots.push({ dps, t: dur, kind }); };
  P.forward = () => new G.V3(-Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw) * Math.cos(P.pitch));
  P.eye = () => new G.V3(P.pos.x, P.pos.y + P.y + (P.downed ? 0.5 : 1.62), P.pos.z);
  P.aim = (max = 40) => {
    const o = P.eye(), f = P.forward(); let best = max, hitE = null;
    for (const e of G.enemies.list) { if (e.dead) continue; const c = new G.V3(e.pos.x, e.pos.y + e.def.h * 0.55 + e.y, e.pos.z), oc = c.clone().sub(o), t = oc.dot(f); if (t < 0 || t > best) continue; const d2 = oc.lengthSq() - t * t, rr = Math.max(e.def.r * 1.3, 0.7); if (d2 < rr * rr) { best = t; hitE = e; } }
    for (let t = 0.3; t < best; t += 0.3) { const p = o.clone().addScaledVector(f, t); if (p.y < G.World.fy(p.x, p.z) || p.y > (G.DUNGEONS[G.World.theme] ? G.DUNGEONS[G.World.theme].wallH : 6.5) || (G.World.W && G.World.blocks(p.x, p.z))) { best = t; hitE = null; break; } }
    return { point: o.addScaledVector(f, best), enemy: hitE, dist: best };
  };

  /* ---------- damage taken ---------- */
  P.takeDamage = (amt, src, o = {}) => {
    if (P.dead || P.downed || G.state !== 'play') return 0;
    if (P.emote && !o.dot) G.emotes.stop(P);
    if (P.iframes > 0 || G.mapOpen || G.cine.active) { G.fx.dmgNumber(new G.V3(P.pos.x, 1.6, P.pos.z), 0, false, '#9aa'); return 0; }
    if (!o.unblockable && !o.dot && G.sheet.attuned(P, 'displacement') && Math.random() < 0.15) { G.fx.textPop(new G.V3(P.pos.x, 1.9, P.pos.z), 'MISS', '#9ad0ff'); return 0; }
    amt *= P.dmgTakenMul;
    if (o.save) { // DEX saving throw: success halves (Ring of Evasion: success negates, failure halves)
      const sv = G.sheet.resolve(P, { ab: 'DEX', save: true, dc: o.dc || 12, trap: o.trap, noReroll: true }), ev = G.sheet.attuned(P, 'evasion');
      amt *= sv.success ? (ev ? 0 : 0.5) : (ev ? 0.5 : 1);
      G.ui.checkChip({ title: 'DEX save', nat: sv.nat, sides: 20, bonus: sv.bonus, dc: sv.dc, ok: sv.success, line: sv.success ? (ev ? 'You twist clear: no damage' : 'You dive aside: half damage') : (ev ? 'Clipped: half damage' : 'Full hit') , quiet: true });
      if (amt <= 0) return 0;
    }
    const toSrc = Math.atan2(src.x - P.pos.x, src.z - P.pos.z), facing = Math.abs(G.angDiff(P.yaw + Math.PI, toSrc)) < 1.75;
    if (P.blocking && facing && !o.unblockable) {
      if (P.blockT < (A.parry || 0.22)) { G.sfx('parry', 1); G.fx.spark(P.eye().addScaledVector(P.forward(), 0.8), 0xfff0c0, 30, 7, 0.4, 0.1); G.fx.shake(0.2); G.ui.flash('parry'); G.hitstop = 0.12;
        if (P.feats.includes('sentinel') && o.attacker && !o.attacker.dead) G.combat.deal(o.attacker, 0, 'slash', { roll: c => G.rollN(c ? 2 : 1, 8) + G.sheet.mod(P, 'STR'), stun: 1.5, noChain: true });
        return 'parry'; }
      const red = A.block;
      P.sta -= amt * 3 * (cls === 'knight' ? 0.6 : 1) * (1 + P.mods.blockCost); P.staDelay = 0.8;
      if (cls === 'wizard') P.mana = Math.max(0, P.mana - amt * 1.3);
      G.sfx(cls === 'knight' ? 'clang' : 'block', 0.8); G.fx.spark(P.eye().addScaledVector(P.forward(), 0.7), 0xffd090, 12, 4, 0.3, 0.07);
      if (P.sta <= 0) { P.sta = 0; P.blocking = false; P.blockBroken = 1.2; amt *= 0.8; G.ui.toast('Guard broken!'); }
      else { amt *= 1 - red; if (amt < 1) return 'blocked'; P.hp -= amt * (1 - P.armor); G.fx.shake(0.15); P.checkDeath(); return 'blocked'; }
    }
    if (!o.dot && G.run.active && G.ui.modalOpen()) G.ui.interrupt('You are attacked! You break off.');
    let d = amt * (1 - P.armor);
    if (P.ward && P.ward.hp > 0 && d > 0) { const a = Math.min(P.ward.hp, d); P.ward.hp -= a; d -= a; G.fx.spark(P.eye().addScaledVector(P.forward(), 0.6), 0xffd070, 10, 3, 0.3, 0.06); G.sfx('block', 0.5); if (d <= 0.01) { G.fx.dmgNumber(new G.V3(P.pos.x, 1.6, P.pos.z), 0, false, '#ffd070'); return 'blocked'; } }
    P.hp -= d; P.hurtFlash = 1;
    G.sfx('hurt', 0.8); G.fx.shake(0.25 + Math.min(0.5, d / P.maxHp)); G.ui.hurt(toSrc - P.yaw, d / P.maxHp);
    if (o.type === 'fire' || o.type === 'fireball') P.addDot(3 * G.enemies.diff().dmg, 3, 'fire');
    if (o.type === 'poison') P.addDot(3 * G.enemies.diff().dmg, 4, 'poison');
    if (P.hp > 0 && P.hp < P.maxHp * 0.25 && !P.lowWarned) { P.lowWarned = true; } if (P.hp > P.maxHp * 0.5) P.lowWarned = false;
    if (o.knock && !P.mods.titan) { const a = toSrc + Math.PI; P.vel.x += Math.sin(a) * o.knock; P.vel.z += Math.cos(a) * o.knock; }
    if (G.settings.gore) G.fx.blood(new G.V3(P.pos.x, 1.2, P.pos.z), new G.V3(Math.sin(toSrc + Math.PI), 0.3, Math.cos(toSrc + Math.PI)), 6, 'red', 0.8);
    P.checkDeath(); return d;
  };
  // caught by a hook / silk line: dragged to the thrower, then briefly rooted
  P.yanked = (e, o, proj) => {
    if (P.dead || P.downed || P.leap || P.yank) return;
    const d = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z), stop = e.def.r * (e.scale || 1) + (o.stop || 1.4);
    if (d <= stop + 0.3) return;
    P.yank = { e, t: 0, dur: Math.min(1.6, (d - stop) / (o.speed || 22) + 0.35), stop, speed: o.speed || 22, root: o.root ?? 0.6, lx: P.pos.x, lz: P.pos.z, stuck: 0 };
    P.dash = null; P.dodgeT = 0; G.fx.shake(0.45); G.sfx('chainrattle', 1); G.sfx('hurt', 0.4);
    G.ui.toast(o.style === 'silk' ? 'Snared! You are being reeled in!' : 'Hooked! You are being dragged in!');
    const T = proj && proj.tether; if (T) { T.kept = true; T.to = v => v.set(P.pos.x, P.pos.y + P.y + 1.0, P.pos.z); T.alive = () => !!P.yank && P.yank.e === e; T.dur = P.yank.dur + 0.6; T.slack = 0; }
    G.net.sendFx({ k: 'yank', id: e.id, s: o.style || 'chain', d: Math.round(P.yank.dur * 100) / 100 });
  };
  P.checkDeath = () => {
    if (P.hp > 0) return;
    if (G.pvp.meIn()) { G.pvp.ko(); return; }   // the sparring ring knocks you out instead
    if (P.mods.phoenix > P.phoenixUsed) { P.phoenixUsed++; P.hp = P.maxHp * 0.4; G.fx.fire(new G.V3(P.pos.x, 0.5, P.pos.z), 60, 1.5, 1.4, 5); G.fx.shockwave(P.pos, 6, 0xff8030); G.sfx('boom', 1); G.ui.toast('Rise from the ashes!'); for (const e of G.enemies.list) if (!e.dead && G.dist2(e.pos.x, e.pos.z, P.pos.x, P.pos.z) < 36) G.combat.deal(e, 0, 'fire', { roll: c => G.rollN(c ? 6 : 3, 8), noChain: true }); return; }
    P.hp = 0;
    // dropping to 0: you fall and start making death saving throws
    P.downed = true; P.blocking = false; P.swing = null; P.cast = null; P.charge = -1; P.volley = null;
    P.ds = { s: 0, f: 0, t: 3, stable: false, stableT: 0 };
    G.ui.toast(G.net.party ? 'You are down! Death saves begin. Allies can hold E to tend to you.' : 'You are down! Death saves begin.'); G.sfx('hurt', 1); G.sfx('groan', 0.6);
  };
  P.die = () => { P.downed = false; P.dead = true; P.hp = 0; P.ds = null; G.game.playerDied(); };
  P.revive = (pct = 0.25, who) => { if (!P.downed) return; P.downed = false; P.ds = null; P.hp = Math.max(1, Math.round(P.maxHp * pct)); P.iframes = 1.2; G.fx.holy(new G.V3(P.pos.x, 0.2, P.pos.z), 40, 1); G.sfx('heal', 1); G.ui.toast(who ? `${who} pulls you back to your feet!` : 'You rise again!'); };
  // one death saving throw: plain d20, 10+ succeeds; a natural 20 brings you back, a natural 1 counts twice
  P.deathSave = (from) => {
    const D = P.ds; if (!D || D.stable) return;
    let nat = G.d(20); if (P.relics.includes('coin') && nat === 1) nat = 10;
    const total = nat + (P.relics.includes('bonedice') ? 1 : 0), ok = total >= 10;
    if (nat === 20) { G.ui.checkChip({ title: 'Death save', nat, sides: 20, ok: true, line: 'Natural 20! You surge back to your feet.' }); G.sfx('crit20', 0.9); P.revive(0.15); return; }
    if (ok) D.s++; else D.f += nat === 1 ? 2 : 1;
    G.ui.checkChip({ title: from ? `Death save · ${from}` : 'Death save', nat, sides: 20, bonus: total - nat, dc: 10, ok, line: `${'✔'.repeat(D.s)}${'·'.repeat(Math.max(0, 3 - D.s))}  ${'✖'.repeat(Math.min(3, D.f))}${'·'.repeat(Math.max(0, 3 - D.f))}${nat === 1 ? ' · natural 1 counts twice' : ''}`, quiet: true });
    G.sfx(ok ? 'diceland' : 'groan', 0.6);
    if (D.f >= 3) { P.die(); return; }
    if (D.s >= 3) { D.stable = true; D.stableT = 6; G.ui.toast('Stabilized. You will come to in a few moments.'); }
  };

  /* ---------- attacks ---------- */
  P.startSwing = (kind, dur, onHit, hitAt) => { P.swing = { kind, t: 0, dur, onHit, hitAt: hitAt ?? 0.45, done: false }; P.attackCounter++; P.atkExact = kind; P.atkDur = dur; P.atkHit = hitAt ?? 0.45; P.atkKind = kind.startsWith('slash') ? 'slash' : kind.startsWith('over') || kind === 'slam' || kind === 'smash' ? 'overhead' : kind.startsWith('stab') || kind === 'thrust' || kind === 'cross' ? 'thrust' : kind === 'cast' ? 'cast' : kind === 'shoot' ? 'shoot' : 'slash'; };
  P.attack = () => {
    const spd = 1 + P.mods.atkSpd + (P.rageT > 0 ? 0.25 : 0);
    if (cls === 'wizard') {
      if (P.mana < A.mana) { G.ui.toast('Not enough mana'); P.atkCD = 0.3; return; }
      P.mana -= A.mana * (P.feats.includes('warcaster') ? 0.8 : 1);
      if (WD.prim) { P.startSwing('cast', A.time / spd, () => P.staffPrimary(), 0.3); P.atkCD = A.time / spd; return; }
      P.startSwing('cast', A.time / spd, () => {
        const orb = new G.V3(); P.V.weapon.userData.orb.getWorldPosition(orb); const aim = P.aim(50); const dir = aim.point.clone().sub(orb).normalize();
        const n = 1 + P.mods.multishot;
        for (let k = 0; k < n; k++) { const a = (k - (n - 1) / 2) * 0.12; const d = dir.clone().applyAxisAngle(new G.V3(0, 1, 0), a);
          G.proj.spawn({ kind: 'firebolt', pos: orb.clone(), dir: d, speed: A.speed, owner: 'me', dmg: 0, roll: (c, far) => G.sheet.weapon(P, c, { ranged: true, far }), splashRoll: () => Math.ceil(G.sheet.weapon(P, false) / 2), dtype: 'fire', splash: A.splash, life: 2.5, r: 0.3 });
          G.net.sendFx({ k: 'proj', pk: 'firebolt', p: [orb.x, orb.y, orb.z], d: [d.x, d.y, d.z], s: A.speed }); }
        G.sfx('firecast', 0.85); G.Lights.flash(orb, 0xff7020, 3, 6, 0.2); P.tempest();
      }, 0.3);
      P.atkCD = A.time / spd; return;
    }
    if (cls === 'archer') return;
    if (P.comboT <= 0) P.combo = 0;
    const kind = A.combo[P.combo % A.combo.length]; const finisher = P.combo % A.combo.length === A.combo.length - 1;
    const dur = A.time / spd * (finisher ? 1.15 : 1);
    P.startSwing(kind, dur, () => {
      const H = WD.hit || {}, F = finisher ? (WD.fin || {}) : {}, roll = c => G.sheet.weapon(P, c) + (finisher ? G.rollN(1, P.dnd.weapon.d) : 0);
      const mo = { knock: F.knock || (finisher ? 1.2 : 0.3), overkillHint: finisher, swing: kind, bleed: H.bleed, slow: H.slow, stun: F.stun };
      const hits = F.line ? G.combat.lineHit(A.range + 0.8, F.line, roll, A.type, mo) : G.combat.melee(A.range * (finisher ? 1.1 : 1), A.arc, roll, A.type, mo);
      if (H.venom && hits) G.fx.emit && (() => { const p = P.eye().addScaledVector(P.forward(), 1.4); for (let k = 0; k < 8; k++) G.fx.emit(G.fx.add, p.x, p.y - 0.3, p.z, (Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2, 0.5, 0.14, 0.02, [0.4, 1.6, 0.3, 1], [0.1, 0.5, 0.05, 0], 2); })();
      const shock = F.shock || (hits ? H.shock : 0);
      if (shock) { const fx = Math.sin(P.yaw + Math.PI), fz = Math.cos(P.yaw + Math.PI), cx = P.pos.x + fx * A.range * 0.7, cz = P.pos.z + fz * A.range * 0.7; G.fx.shockwave(new G.V3(cx, 0, cz), shock, 0xffc080); G.fx.decal('crack', cx, cz, shock * 1.2, 0x222222, 20); G.fx.smoke(new G.V3(cx, 0.2, cz), 6, 0x6a5a4a, 1.4); G.fx.shake(0.25); G.sfx('boom', 0.45);
        for (const e of G.enemies.list) if (!e.dead && G.dist2(e.pos.x, e.pos.z, cx, cz) < (shock + e.def.r) ** 2) G.combat.deal(e, 0, 'blunt', { roll: c => Math.ceil(G.sheet.weapon(P, c) / 2), noChain: true, stun: F.stun ? F.stun * 0.6 : 0.5, knock: 0.8 });
        G.game.breakArea(cx, cz, shock, true); G.net.sendFx({ k: 'slam', x: cx, z: cz }); }
      if (F.sun) P.sunPulse(F.sun);
      if (kind === 'slam') { G.fx.shockwave(new G.V3(P.pos.x + Math.sin(P.yaw + Math.PI) * 2, 0, P.pos.z + Math.cos(P.yaw + Math.PI) * 2), 3, 0xffc080); G.fx.decal('crack', P.pos.x + Math.sin(P.yaw + Math.PI) * 2, P.pos.z + Math.cos(P.yaw + Math.PI) * 2, 3, 0x222222, 20); G.fx.smoke(new G.V3(P.pos.x + Math.sin(P.yaw + Math.PI) * 2, 0.2, P.pos.z + Math.cos(P.yaw + Math.PI) * 2), 6, 0x6a5a4a, 1.5); G.fx.shake(0.3); G.sfx('boom', 0.5); }
      P.tempest();
    }, A.hitAt);
    G.sfx(A.time > 0.6 ? 'heavy' : A.time < 0.45 ? 'swingfast' : 'swing', 0.8);
    P.combo++; P.comboT = dur + 0.45; P.atkCD = dur * 0.92;
  };
  // alternative staff primaries: a fan of ice shards, or instant lightning at the aim point
  P.staffPrimary = () => {
    const orb = new G.V3(); P.V.weapon.userData.orb.getWorldPosition(orb); const aim = P.aim(50);
    if (WD.prim === 'shards') {
      const dir = aim.point.clone().sub(orb).normalize(), n = 3 + P.mods.multishot;
      for (let k = 0; k < n; k++) { const d = dir.clone().applyAxisAngle(new G.V3(0, 1, 0), (k - (n - 1) / 2) * 0.07);
        G.proj.spawn({ kind: 'iceshard', pos: orb.clone(), dir: d, speed: 42, owner: 'me', dmg: 0, roll: (c, far) => Math.max(1, Math.ceil(G.sheet.weapon(P, c, { ranged: true, far }) * 0.55)), dtype: 'ice', slow: 1.6, chill: 1, life: 1.6, r: 0.25 });
        G.net.sendFx({ k: 'proj', pk: 'iceshard', p: [orb.x, orb.y, orb.z], d: [d.x, d.y, d.z], s: 42 }); }
      G.sfx('ice', 0.7); G.Lights.flash(orb, 0x80d0ff, 3, 6, 0.2);
    } else {
      let target = aim.enemy; const b = target ? new G.V3(target.pos.x, target.def.h * 0.6 + target.y, target.pos.z) : aim.point.clone();
      { const pr = G.game.propOnSegment(orb.x, orb.y, orb.z, b.x, b.y, b.z, 0.3); if (pr) { const hp = new G.V3(pr.x, G.World.fy(pr.x, pr.z) + 0.5, pr.z); if (!target || G.dist2(orb.x, orb.z, pr.x, pr.z) < G.dist2(orb.x, orb.z, b.x, b.z)) { G.game.breakObj(pr, true, P.pos); if (!target) b.copy(hp); } } }   // the bolt smashes props in its path too
      G.fx.lightning(orb, b, 0xc0a0ff, 1.3); G.net.sendFx({ k: 'bolt', a: [orb.x, orb.y, orb.z], b: [b.x, b.y, b.z] }); G.sfx('lightning', 0.5); G.Lights.flash(b, 0xb08aff, 4, 8, 0.15);
      if (target) { G.combat.deal(target, 0, 'lightning', { roll: c => G.sheet.weapon(P, c, { ranged: true }), point: b }); G.combat.chain(target, Math.ceil(G.sheet.weapon(P, false) * 0.6), 1, false); }
      else { G.fx.spark(b, 0xc0a0ff, 12, 5, 0.3, 0.08); G.World.hitGateAt && G.World.hitGateAt(b.x, b.z, 1); }
    }
    P.tempest();
  };
  // sunstaff finisher: radiant pulse that burns foes and heals allies nearby
  P.sunPulse = (rad) => {
    const c = new G.V3(P.pos.x, 0.1, P.pos.z), wis = G.sheet.mod(P, 'WIS');
    G.fx.healZone(c.x, c.z, rad, 0.9, 0xffd060); G.fx.shockwave(c, rad, 0xffe08a, 0.45); G.fx.holy(c, 40, rad * 0.8); G.Lights.flash(new G.V3(c.x, 1.5, c.z), 0xffd070, 6, rad * 3, 0.4); G.sfx('holy', 0.6);
    for (const e of G.enemies.list) if (!e.dead && G.dist2(e.pos.x, e.pos.z, c.x, c.z) < (rad + e.def.r) ** 2) G.combat.deal(e, 0, 'holy', { roll: cr => G.rollN(cr ? 2 : 1, 8) + wis, noChain: true });
    const h = G.rollN(1, 6) + wis; P.heal(h, true); G.net.sendSup({ k: 'heal', amt: h, x: c.x, z: c.z, r: rad }); G.net.sendFx({ k: 'hz', x: c.x, z: c.z, r: rad });
  };
  P.tempest = () => {
    if (!P.mods.tempest) return; P.tempestN++;
    if (P.tempestN % Math.max(2, 5 - P.mods.tempest) === 0) {
      G.fx.shockwave(P.pos, 4.5, 0xd0e8ff, 0.4); for (let k = 0; k < 24; k++) { const a = k / 24 * 6.28; G.fx.emit(G.fx.add, P.pos.x + Math.sin(a) * 1.5, 1.1, P.pos.z + Math.cos(a) * 1.5, Math.cos(a) * 9, 0, -Math.sin(a) * 9, 0.35, 0.3, 0.05, [1.4, 1.6, 1.8, 1], [0.4, 0.6, 1, 0], 0, 2); }
      G.sfx('swing', 1); for (const e of G.enemies.list) if (!e.dead && G.dist2(e.pos.x, e.pos.z, P.pos.x, P.pos.z) < 20) G.combat.deal(e, 0, 'slash', { roll: c => G.sheet.weapon(P, c), noChain: true });
      G.net.sendFx({ k: 'tempest', x: P.pos.x, z: P.pos.z });
    }
  };
  // Volley: a fan of arrows is nocked together, drawn, and loosed from the bow on release
  P.updateVolley = (dt) => {
    const Vo = P.volley; if (!Vo) { P.volleyDraw = -1; return; }
    Vo.t += dt; P.atkCD = Math.max(P.atkCD, 0.05);
    P.volleyDraw = Vo.fired ? -1 : G.smooth(Math.min(1, Vo.t / (Vo.rel * 0.85)));
    if (!Vo.fired && Vo.t >= Vo.rel) {
      Vo.fired = true; P.relT = 0;
      const f = P.forward(), right = new G.V3(-f.z, 0, f.x).normalize(), o = P.eye().addScaledVector(f, 0.6).addScaledVector(right, -0.06).add(new G.V3(0, -0.04, 0)), n = Vo.n, roll = Vo.roll;
      for (let k = 0; k < n; k++) { const d = f.clone().applyAxisAngle(new G.V3(0, 1, 0), (k / (n - 1) - 0.5) * 0.7); d.y += 0.02; G.proj.spawn({ kind: 'parrow', pos: o.clone(), dir: d, speed: 50, owner: 'me', dmg: 0, roll: (c, far) => roll(c) + G.sheet.extraDice(P, c ? 2 : 1, { ranged: true, far }), dtype: 'pierce', life: 2, r: 0.3, tier: P.wpnLv }); G.net.sendFx({ k: 'proj', pk: 'arrow', p: [o.x, o.y, o.z], d: [d.x, d.y, d.z], s: 50 }); }
      G.sfx('arrow', 1); G.sfx('swingfast', 0.7); G.fx.spark(o.clone().addScaledVector(f, 0.3), 0xfff0c0, 10, 3, 0.25, 0.05); P.startSwing('shoot', 0.3, null, 1); P.kickX = (P.kickX || 0) - 0.02;
    }
    if (Vo.t >= Vo.dur) P.volley = null;
  };
  P.fireArrow = (ch) => {
    const full = ch >= 0.95, sp = G.lerp(32, 72, ch), scale = full ? 1 : 0.45 + 0.55 * ch;
    const roll = (c, far) => Math.max(1, Math.round(G.sheet.weapon(P, c, { n: full ? 2 : 1, ranged: true, far }) * scale));
    const o = P.eye().addScaledVector(P.forward(), 0.5); o.y -= 0.08; const aim = P.aim(60); const dir = aim.point.clone().sub(o).normalize();
    const spread = Math.pow(1 - ch, 1.5) * 0.11; if (spread > 0.001) { dir.x += (Math.random() - 0.5) * 2 * spread; dir.y += (Math.random() - 0.5) * 2 * spread * 0.7; dir.z += (Math.random() - 0.5) * 2 * spread; dir.normalize(); } P.relT = 0;
    const n = 1 + P.mods.multishot + (full && WD.fullExtra ? WD.fullExtra : 0);
    for (let k = 0; k < n; k++) { const d = dir.clone().applyAxisAngle(new G.V3(0, 1, 0), (k - (n - 1) / 2) * 0.08); d.y += 0.01;
      G.proj.spawn({ kind: 'parrow', pos: o.clone(), dir: d, speed: sp * (WD.fullPierce ? 1.15 : 1), owner: 'me', dmg: 0, roll, dtype: 'pierce', pierce: ch > 0.95 ? (WD.fullPierce || 2) : 0, life: 3, r: 0.25, tier: P.wpnLv, knock: ch > 0.9 ? (WD.fullKnock || 0.6) : 0 });
      G.net.sendFx({ k: 'proj', pk: 'arrow', p: [o.x, o.y, o.z], d: [d.x, d.y, d.z], s: sp }); }
    G.sfx('arrow', 0.9); P.startSwing('shoot', 0.25, null, 1); P.kickX = (P.kickX || 0) + 0.012 + ch * 0.012; P.tempest();
  };

  /* ---------- abilities ---------- */
  P.ability = (slot) => {
    const ab = G.ABIL[cls][slot]; if (P.cd[slot] > 0) return;
    if (slot === 'r' && !P.ab2) { G.ui.toast('Unlock this ability at the Arcane Library in your hideout'); return; }
    const manaCost = ab.mana ? ab.mana * (P.feats.includes('warcaster') ? 0.8 : 1) : 0;
    if (manaCost && P.mana < manaCost) { G.ui.toast('Not enough mana'); return; }
    const rank = slot === 'r' ? P.ab2Lv : 0, roll = (c) => G.sheet.abil(P, slot, c, rank);
    const fwd = P.yaw + Math.PI, fx = Math.sin(fwd), fz = Math.cos(fwd), here = P.pos.clone();
    let ok = true;
    const setCd = () => { P.cd[slot] = ab.cd * (1 - P.mods.cdr) * (P.relics.includes('hourglass') ? 0.8 : 1) * (cls === 'priest' && slot === 'q' && P.mods.massHeal ? 0.7 : 1); };
    const area = (x, z, rad, rf, type, o) => { G.game.breakArea(x, z, rad, true); G.World.hitGatesNear(x, z, rad); G.pvp.areaHit(x, z, rad, rf, type, o || {}); for (const e of G.enemies.list) if (!e.dead && G.dist2(e.pos.x, e.pos.z, x, z) < (rad + e.def.r) ** 2) G.combat.deal(e, 0, type, Object.assign({ roll: rf, noChain: true }, o)); };
    switch (cls + slot) {
      case 'knightq': P.startSwing('bash', 0.45, () => { for (const e of G.enemies.list) { if (e.dead) continue; const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, d = Math.hypot(dx, dz); if (d < 3.4 + e.def.r && Math.abs(G.angDiff(fwd, Math.atan2(dx, dz))) < 1.1) G.combat.deal(e, 0, 'blunt', { roll, stun: 2.2, knock: 2.5 }); } G.fx.shockwave(new G.V3(P.pos.x + fx * 1.5, 0, P.pos.z + fz * 1.5), 3, 0x9ab8ff); G.sfx('clang', 1); G.fx.shake(0.3); }, 0.35);
        G.net.sendFx({ k: 'bash', x: P.pos.x + fx * 1.5, z: P.pos.z + fz * 1.5 }); break;
      case 'knightr': P.dash = { t: 0.35, vx: fx * 26, vz: fz * 26, hit: new Set(), roll }; P.valorT = 3.5; P.iframes = 0.35; G.sfx('heavy', 1); G.fx.shockwave(here, 3, 0x9ab8ff); G.net.sendFx({ k: 'charge', x: here.x, z: here.z }); break;
      case 'barbarianq': P.rageT = 8; G.sfx('roar', 0.8); G.fx.burst(new G.V3(P.pos.x, 1, P.pos.z), 0xff2a10, 50, 5); G.ui.toast('BLOOD RAGE · +40% damage, +25% speed, −25% damage taken'); G.net.sendFx({ k: 'rage', x: here.x, z: here.z }); break;
      case 'barbarianr': { const aim = P.aim(10 + P.ab2Lv * 2); const t = aim.point; t.y = 0; const back = new G.V3(t.x - fx * 0.8, 0, t.z - fz * 0.8); if (G.World.W && G.World.isWall(back.x, back.z)) { back.copy(P.pos); }
        P.leap = { t: 0, dur: 0.6, from: P.pos.clone(), to: back, roll }; G.sfx('swing', 1); break; }
      case 'rogueq': { const aim = P.aim(14); let to;
        if (aim.enemy) { const e = aim.enemy; to = new G.V3(e.pos.x + Math.sin(e.rot + Math.PI) * (e.def.r + 0.8), 0, e.pos.z + Math.cos(e.rot + Math.PI) * (e.def.r + 0.8)); if (G.World.isWall(to.x, to.z)) to = new G.V3(e.pos.x - fx * (e.def.r + 0.8), 0, e.pos.z - fz * (e.def.r + 0.8)); }
        else { const d = G.World.W ? Math.max(0, G.World.rayWall(P.pos.x, P.pos.z, fx, fz, 8) - 0.6) : 8; to = new G.V3(P.pos.x + fx * d, 0, P.pos.z + fz * d); }
        G.fx.smoke(new G.V3(P.pos.x, 0.8, P.pos.z), 10, 0x1a1028, 1.8); G.fx.burst(new G.V3(P.pos.x, 1, P.pos.z), 0x9a6aff, 20, 3);
        G.net.sendFx({ k: 'shadow', x: P.pos.x, z: P.pos.z, x2: to.x, z2: to.z });
        P.pos.copy(to); if (aim.enemy) P.yaw = Math.atan2(-(aim.enemy.pos.x - to.x), -(aim.enemy.pos.z - to.z));
        G.fx.smoke(new G.V3(to.x, 0.8, to.z), 10, 0x1a1028, 1.8); P.critNext = true; P.sneakNext = true; P.iframes = 0.4; G.sfx('zap', 0.6); break; }
      case 'roguer': { const n = 12 + P.ab2Lv * 4; for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; const d = new G.V3(Math.sin(a), 0, Math.cos(a)); G.proj.spawn({ kind: 'knife', pos: new G.V3(P.pos.x, 1.1, P.pos.z), dir: d, speed: 26, owner: 'me', dmg: 0, roll: (c) => roll(c) + G.sheet.extraDice(P, c ? 2 : 1, { ranged: true }), dtype: 'pierce', bleed: 2.5, life: 0.8, r: 0.3, tier: P.wpnLv }); } G.sfx('swing', 1); G.net.sendFx({ k: 'knives', x: P.pos.x, z: P.pos.z, n }); P.startSwing('cross', 0.35); break; }
      case 'archerq': { const n = 7 + P.mods.multishot + (G.sheet.attuned(P, 'bracers') ? 2 : 0); P.charge = -1; P.volley = { t: 0, dur: 0.85, rel: 0.56, n, roll, fired: false }; G.sfx('bowdraw', 0.9); setTimeout(() => G.sfx('bowdraw', 0.5), 160); break; }
      case 'archerr': { const o = P.eye().addScaledVector(P.forward(), 0.5); const aim = P.aim(60); const d = aim.point.clone().sub(o).normalize(); G.proj.spawn({ kind: 'frostarrow', pos: o, dir: d, speed: 45, owner: 'me', dmg: 0, roll, splashRoll: () => G.rollN(2 + rank, 6) + G.sheet.mod(P, 'DEX'), dtype: 'ice', freeze: 1, life: 2.5, r: 0.3, tier: P.wpnLv }); G.net.sendFx({ k: 'proj', pk: 'frostarrow', p: [o.x, o.y, o.z], d: [d.x, d.y, d.z], s: 45 }); G.sfx('ice', 1); P.startSwing('shoot', 0.3, null, 1); break; }
      case 'wizardq': ok = false; P.beginCast('Frost Nova', 0.75, () => { if (P.mana < manaCost) { G.ui.toast('Not enough mana'); return; } P.mana -= manaCost; setCd(); G.sfx('magic', 0.7); P.startSwing('nova', 0.5, () => { G.enemies.aoeFx('frost', new G.V3(P.pos.x, 0.3, P.pos.z), 6, null); area(P.pos.x, P.pos.z, 6, roll, 'ice', { freeze: 1, freezeT: 3.2 }); G.net.sendFx({ k: 'nova', x: P.pos.x, z: P.pos.z }); G.fx.shake(0.25); }, 0.4); }); break;
      case 'wizardr': ok = false; P.beginCast('Chain Lightning', 0.55, () => { if (P.mana < manaCost) { G.ui.toast('Not enough mana'); return; } P.startSwing('swipe', 0.45, () => P.chainLightning(roll, manaCost, setCd), 0.45); }); break;
      case 'wizardr_': { const aim = P.aim(30); let target = aim.enemy; if (!target) { let bd = 400; for (const e of G.enemies.list) { if (e.dead) continue; const d = G.dist2(e.pos.x, e.pos.z, P.pos.x, P.pos.z); const ang = Math.abs(G.angDiff(fwd, Math.atan2(e.pos.x - P.pos.x, e.pos.z - P.pos.z))); if (d < bd && ang < 0.6 && G.World.los(P.pos.x, P.pos.z, e.pos.x, e.pos.z)) { bd = d; target = e; } } }
        if (!target) { G.ui.toast('No target'); ok = false; break; }
        P.mana -= manaCost; P.startSwing('cast', 0.35);
        const orb = new G.V3(); P.V.weapon.userData.orb.getWorldPosition(orb); const b = new G.V3(target.pos.x, target.def.h * 0.6, target.pos.z);
        G.fx.lightning(orb, b, 0x9ad0ff, 1.6); G.net.sendFx({ k: 'bolt', a: [orb.x, orb.y, orb.z], b: [b.x, b.y, b.z] });
        G.combat.deal(target, 0, 'lightning', { roll, noChain: true, stun: 0.6, point: b }); G.sfx('lightning', 1);
        G.combat.chain(target, G.rollN(2, 8, { adept: P.feats.includes('adept') }) + G.sheet.mod(P, 'INT'), 4 + P.ab2Lv * 2, false, true); break; }
      case 'priestq': ok = false; P.beginCast('Holy Light', 1.2, () => { if (P.mana < manaCost) { G.ui.toast('Not enough mana'); return; } setCd(); P.startSwing('holy', 0.6, null, 0.3); P.holyLight(manaCost, roll); }); break;
      case 'priestq_': { P.mana -= manaCost; const m = P.mods, rad = m.massHeal ? 18 : 9;
        const amt = Math.round((G.sheet.abil(P, 'q', false) + G.rollN(m.healDice, 6) + (P.feats.includes('healer') ? G.rollN(1, 8) : 0)) * m.healMul);
        G.fx.holy(new G.V3(P.pos.x, 0.1, P.pos.z), 80, 4); G.fx.shockwave(P.pos, rad, 0xffe08a, 0.7); G.fx.healZone(P.pos.x, P.pos.z, rad, 1.3); G.fx.beam(new G.V3(P.pos.x, 0, P.pos.z), 0xffe08a, 10, 1, 0.6); G.sfx('holy', 1);
        P.heal(amt); if (P.feats.includes('healer')) P.dots = [];
        area(P.pos.x, P.pos.z, 4.5, c => G.rollN(c ? 2 : 1, 8) + G.sheet.mod(P, 'WIS'), 'holy', {});
        G.net.sendFx({ k: 'holylight', x: P.pos.x, z: P.pos.z, r: rad }); G.net.sendSup({ k: 'heal', amt, x: P.pos.x, z: P.pos.z, r: rad, cl: P.feats.includes('healer') ? 1 : 0 }); P.startSwing('cast', 0.5); break; }
      case 'priestr': ok = false; P.beginCast('Smite', 0.6, () => { if (P.mana < manaCost) { G.ui.toast('Not enough mana'); return; } setCd(); P.startSwing('smash', 0.5, () => P.smite(manaCost, roll, area), 0.45); }); break;
      case 'priestr_': { const aim = P.aim(18); const t = aim.point; P.mana -= manaCost; P.startSwing('cast', 0.4); G.fx.beam(new G.V3(t.x, 0, t.z), 0xfff0b0, 16, 1.6, 0.9); G.fx.holy(new G.V3(t.x, 0.1, t.z), 50, 2); G.fx.shockwave(t, 4, 0xffe08a); G.fx.decal('rune', t.x, t.z, 5, 0xffd060, 8); G.sfx('holy', 1); G.sfx('boom', 0.4); G.fx.shake(0.2);
        area(t.x, t.z, 2.8 + P.ab2Lv * 0.4, roll, 'holy', { stun: 1.2 }); G.net.sendFx({ k: 'smite', x: t.x, z: t.z }); break; }
    }
    if (ok) setCd();
  };
  /* ---------- cast times: heavy and area spells channel before they release ---------- */
  P.beginCast = (name, dur, fn) => { if (P.cast) return false; P.cast = { name, dur: dur / (1 + P.mods.atkSpd * 0.5), t: 0, fn }; P.blocking = false; G.sfx('magic', 0.35); return true; };
  P.updateCast = (dt) => {
    const c = P.cast; if (!c) return;
    if (P.downed || P.dead || (G.mouse.r && G.state === 'play' && !G.ui.modalOpen())) { P.cast = null; G.ui.toast('Cast interrupted'); return; }
    c.t += dt;
    if (Math.random() < 0.5) { const o = P.V && P.V.weapon && P.V.weapon.userData.orb; const at = new G.V3(); if (o) o.getWorldPosition(at); else at.copy(P.eye()).addScaledVector(P.forward(), 0.6); G.fx.emit(G.fx.add, at.x + (Math.random() - 0.5) * 0.3, at.y + (Math.random() - 0.5) * 0.3, at.z + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.4, 0.3, (Math.random() - 0.5) * 0.4, 0.4, 0.06, 0, cls === 'priest' ? [1.8, 1.5, 0.7, 1] : c.name === 'Frost Nova' ? [0.6, 1.2, 1.9, 1] : [1.2, 0.9, 1.9, 1], [0.4, 0.3, 0.2, 0]); }
    if (c.t >= c.dur) { P.cast = null; c.fn(); }
  };
  P.chainLightning = (roll, manaCost, setCd) => {
    const fwd = P.yaw + Math.PI, aim = P.aim(30); let target = aim.enemy;
    if (!target) { let bd = 400; for (const e of G.enemies.list) { if (e.dead) continue; const d = G.dist2(e.pos.x, e.pos.z, P.pos.x, P.pos.z); const ang = Math.abs(G.angDiff(fwd, Math.atan2(e.pos.x - P.pos.x, e.pos.z - P.pos.z))); if (d < bd && ang < 0.6 && G.World.los(P.pos.x, P.pos.z, e.pos.x, e.pos.z)) { bd = d; target = e; } } }
    if (!target) { G.ui.toast('No target'); return; }
    P.mana -= manaCost; setCd();
    const orb = new G.V3(); P.V.weapon.userData.orb.getWorldPosition(orb); const b = new G.V3(target.pos.x, target.def.h * 0.6, target.pos.z);
    G.fx.lightning(orb, b, 0x9ad0ff, 1.6); G.net.sendFx({ k: 'bolt', a: [orb.x, orb.y, orb.z], b: [b.x, b.y, b.z] });
    G.combat.deal(target, 0, 'lightning', { roll, noChain: true, stun: 0.6, point: b }); G.sfx('lightning', 1);
    G.combat.chain(target, G.rollN(2, 8, { adept: P.feats.includes('adept') }) + G.sheet.mod(P, 'INT'), 4 + P.ab2Lv * 2, false, true);
  };
  P.holyLight = (manaCost, roll) => {
    P.mana -= manaCost; const m = P.mods, rad = m.massHeal ? 18 : 9;
    const amt = Math.round((G.sheet.abil(P, 'q', false) + G.rollN(m.healDice, 6) + (P.feats.includes('healer') ? G.rollN(1, 8) : 0)) * m.healMul);
    G.fx.holy(new G.V3(P.pos.x, 0.1, P.pos.z), 80, 4); G.fx.shockwave(P.pos, rad, 0xffe08a, 0.7); G.fx.beam(new G.V3(P.pos.x, 0, P.pos.z), 0xffe08a, 10, 1, 0.6); G.sfx('holy', 1);
    P.heal(amt); if (P.feats.includes('healer')) P.dots = [];
    G.game.breakArea(P.pos.x, P.pos.z, 4.5, true); for (const e of G.enemies.list) if (!e.dead && G.dist2(e.pos.x, e.pos.z, P.pos.x, P.pos.z) < (4.5 + e.def.r) ** 2) G.combat.deal(e, 0, 'holy', { roll: c => G.rollN(c ? 2 : 1, 8) + G.sheet.mod(P, 'WIS'), noChain: true });
    G.net.sendFx({ k: 'holylight', x: P.pos.x, z: P.pos.z }); G.net.sendSup({ k: 'heal', amt, x: P.pos.x, z: P.pos.z, r: rad, cl: P.feats.includes('healer') ? 1 : 0 });
  };
  P.smite = (manaCost, roll, area) => {
    const t = P.aim(18).point; P.mana -= manaCost; G.fx.beam(new G.V3(t.x, 0, t.z), 0xfff0b0, 16, 1.6, 0.9); G.fx.holy(new G.V3(t.x, 0.1, t.z), 50, 2); G.fx.shockwave(t, 4, 0xffe08a); G.fx.decal('rune', t.x, t.z, 5, 0xffd060, 8); G.sfx('holy', 1); G.sfx('boom', 0.4); G.fx.shake(0.2);
    area(t.x, t.z, 2.8 + P.ab2Lv * 0.4, roll, 'holy', { stun: 1.2 }); G.net.sendFx({ k: 'smite', x: t.x, z: t.z });
  };
  // priest: tap Q for a quick direct heal, hold Q to channel Holy Light
  // Healing Word lands on the ally nearest your crosshair (within 22 m), healing everyone inside WORD_R of them
  P.WORD_R = 2.2;
  P.wordTarget = () => { const fwd = P.yaw + Math.PI; let best = null, bd = 0.4;
    Object.entries(G.net.remotes).forEach(([peer, r]) => { if (!r.root.visible) return; const dx = r.pos.x - P.pos.x, dz = r.pos.z - P.pos.z, d = Math.hypot(dx, dz); if (d > 22) return; const a = Math.abs(G.angDiff(fwd, Math.atan2(dx, dz))); if (a < bd) { bd = a; best = r; } });
    return best; };
  // priest aim preview: a dim lit circle under whoever Healing Word would land on; holding Q to channel Holy
  // Light shows its full radius around you, brightening as the cast completes
  P.updateHealPreview = () => {
    if (cls !== 'priest' || P.dead || P.downed || G.state !== 'play') return;
    if (P.cast && P.cast.name === 'Holy Light') { const rad = P.mods.massHeal ? 18 : 9, k = 0.45 + 0.55 * Math.min(1, P.cast.t / P.cast.dur); G.fx.zonePreview('holy', P.pos.x, P.pos.z, rad, k); return; }
    const tgt = P.cd.h <= 0 && P.mana >= 15 ? P.wordTarget() : null;
    if (tgt) G.fx.zonePreview('word', tgt.pos.x, tgt.pos.z, P.WORD_R, P.qHold >= 0 ? 0.9 : 0.45);
  };
  P.healingWord = () => {
    if (P.cd.h > 0) { G.ui.toast(`Healing Word ready in ${Math.ceil(P.cd.h)}s`); return; }
    const cost = 15 * (P.feats.includes('warcaster') ? 0.8 : 1); if (P.mana < cost) { G.ui.toast('Not enough mana'); return; }
    P.beginCast('Healing Word', 0.35, () => {
      if (P.mana < cost) return; P.mana -= cost; P.cd.h = 4 * (1 - P.mods.cdr);
      const m = P.mods, amt = Math.round((G.rollN(1, 8) + G.sheet.mod(P, 'WIS') + G.rollN(m.healDice, 6) + (P.feats.includes('healer') ? G.rollN(1, 4) : 0)) * m.healMul);
      const best = P.wordTarget();
      P.startSwing('word', 0.4, null, 0.3); G.sfx('heal', 0.8);
      if (best) { G.fx.beam(new G.V3(best.pos.x, 0, best.pos.z), 0xffe08a, 6, 0.6, 0.5); G.fx.healZone(best.pos.x, best.pos.z, P.WORD_R, 1.1); G.net.sendFx({ k: 'hz', x: best.pos.x, z: best.pos.z, r: P.WORD_R }); G.net.sendSup({ k: 'heal', amt, x: best.pos.x, z: best.pos.z, r: P.WORD_R }); if (m.beacon) P.heal(Math.round(amt / 2)); }
      else { G.fx.healZone(P.pos.x, P.pos.z, 1.2, 0.9); P.heal(amt); }
    });
  };

  /* ---------- per-frame ---------- */
  P.update = (dt, t) => {
    const K = G.keys, inPlay = G.state === 'play' && !G.ui.modalOpen();
    // look
    if (inPlay) {
      const s = 0.0022 * G.settings.sens;
      P.yaw -= G.mouse.dx * s; P.pitch -= G.mouse.dy * s * (G.settings.invertY ? -1 : 1);
      if (K.ArrowLeft) P.yaw += dt * 2.4; if (K.ArrowRight) P.yaw -= dt * 2.4; if (K.ArrowUp) P.pitch += dt * 1.6; if (K.ArrowDown) P.pitch -= dt * 1.6;
      P.pitch = G.clamp(P.pitch, -1.45, 1.45);
      { const iv = 1 / Math.max(dt, 1 / 240); P.swayX = G.damp(P.swayX, G.clamp(-G.mouse.dx * iv * 0.000025, -0.05, 0.05), 9, dt); P.swayY = G.damp(P.swayY, G.clamp(G.mouse.dy * iv * 0.000025, -0.05, 0.05), 9, dt); }
    }
    // timers
    for (const k in P.cd) P.cd[k] = Math.max(0, P.cd[k] - dt);
    P.atkCD -= dt; P.comboT -= dt; P.iframes -= dt; P.slowT -= dt; P.rageT -= dt; P.valorT -= dt; P.hurtFlash = Math.max(0, P.hurtFlash - dt * 2); P.blockBroken = Math.max(0, (P.blockBroken || 0) - dt);
    if (P.dead) { P.updateCam(dt, t); return; }
    // dots
    for (let i = P.dots.length - 1; i >= 0; i--) { const d = P.dots[i]; d.t -= dt; P.hp -= d.dps * dt * (1 - P.armor * 0.5); if (d.kind === 'fire' && Math.random() < 0.3) G.fx.fire(new G.V3(P.pos.x + (Math.random() - 0.5) * 0.6, 0.3 + Math.random(), P.pos.z + (Math.random() - 0.5) * 0.6), 1, 0.2, 0.3); if (d.t <= 0) P.dots.splice(i, 1); }
    if (P.dots.length && P.hp <= 0) P.checkDeath();
    // regen
    if (!P.downed) {
      if (P.healOT > 0) { P.healOT -= dt; P.hp = Math.min(P.maxHp, P.hp + P.healRate * dt); if (Math.random() < 0.3) G.fx.emit(G.fx.add, P.pos.x + (Math.random() - 0.5), 0.2, P.pos.z + (Math.random() - 0.5), 0, 2, 0, 0.8, 0.15, 0, [0.4, 1.6, 0.5, 1], [0.1, 0.6, 0.2, 0]); }
      P.staDelay -= dt; if (P.staDelay <= 0) P.sta = Math.min(P.maxSta, P.sta + (28 + P.mods.staRegen * 28) * dt);
      if (P.maxMana) P.mana = Math.min(P.maxMana, P.mana + (cls === 'wizard' ? 7 : 5) * (1 + P.mods.manaRegen + G.sheet.mod(P, 'WIS') * 0.1 + (G.sheet.attuned(P, 'pearl') ? 0.5 : 0)) * dt);
      if (P.mods.aura) { P.auraT -= dt; if (P.auraT <= 0) { P.auraT = 0.5; for (const e of G.enemies.list) if (!e.dead && G.dist2(e.pos.x, e.pos.z, P.pos.x, P.pos.z) < 20) G.combat.deal(e, 0, 'holy', { roll: () => G.rollN(P.mods.aura, 4), noChain: true, raw: true, noCrit: true }); } if (Math.random() < 0.3) G.fx.holy(new G.V3(P.pos.x + (Math.random() - 0.5) * 6, 0.1, P.pos.z + (Math.random() - 0.5) * 6), 1, 0.1); }
      if (P.rageT > 0 && Math.random() < 0.4) G.fx.emit(G.fx.add, P.pos.x + (Math.random() - 0.5), 0.3 + Math.random() * 1.5, P.pos.z + (Math.random() - 0.5), 0, 1, 0, 0.6, 0.2, 0, [1.8, 0.2, 0.1, 1], [0.6, 0, 0, 0]);
    } else {
      const D = P.ds || (P.ds = { s: 0, f: 0, t: 3, stable: false, stableT: 0 });
      if (D.stable) { D.stableT -= dt; if (D.stableT <= 0) P.revive(0.1); }
      else if (!G.mapOpen && !G.cine.active) { D.t -= dt; if (D.t <= 0) { D.t = 3.5; P.deathSave(); } }
    }
    // lava
    if (G.World.lava && !P.leap) for (const L of G.World.lava) if (Math.abs(P.pos.x - L.x) < L.w * 0.9 && Math.abs(P.pos.z - L.z) < L.d * 0.9 && P.y < 0.1) { P.hp -= 7 * dt; if (Math.random() < 0.3) { G.fx.fire(new G.V3(P.pos.x, 0.2, P.pos.z), 3, 0.5, 0.5); } if (Math.random() < 0.05) G.sfx('hurt', 0.5); P.hurtFlash = 0.6; if (P.hp <= 0) P.checkDeath(); }
    // movement input
    let mx = 0, mz = 0;
    if (inPlay) { if (K.KeyW) mz -= 1; if (K.KeyS) mz += 1; if (K.KeyA) mx -= 1; if (K.KeyD) mx += 1; }
    if (P.emote && (mx || mz || G.mouse.l || G.mouse.r || G.pressed.Space || G.pressed.KeyQ || G.pressed.KeyR || G.pressed.KeyG || G.pressed.KeyV || G.pressed.KeyF || P.downed || P.dead)) G.emotes.stop(P);
    const ml = Math.hypot(mx, mz); if (ml) { mx /= ml; mz /= ml; }
    const cy = Math.cos(P.yaw), sy = Math.sin(P.yaw);
    let wx = mx * cy + mz * sy, wz = -mx * sy + mz * cy;
    const sprint = inPlay && K.ShiftLeft && ml && P.sta > 1 && !P.blocking && !P.downed;
    if (sprint) { P.sta -= 16 * dt; P.staDelay = 0.5; }
    // block
    const wantBlock = inPlay && G.mouse.r && !P.downed && !P.blockBroken && P.charge < 0;
    if (wantBlock && !P.blocking && P.sta > 5) { P.blocking = true; P.blockT = 0; }
    if (!wantBlock) P.blocking = false; if (P.blocking) { P.blockT += dt; if (cls === 'wizard') P.mana = Math.max(0, P.mana - dt * 3); }
    let speed = info.speed * (1 + P.mods.speed + (P.feats.includes('mobile') ? 0.15 : 0) + (G.sheet.attuned(P, 'bootsspeed') ? 0.2 : 0) + (P.rageT > 0 ? 0.15 : 0)) * (sprint ? 1.5 : 1) * (P.blocking ? 0.5 : 1) * (P.slowT > 0 ? 0.5 : 1) * (P.downed ? 0.18 : 1) * (P.charge >= 0 ? 0.6 : 1) * (P.swing && P.swing.kind === 'slam' ? 0.5 : 1) * (P.cast ? 0.55 : 1) * (P.rootT > 0 ? 0.08 : 1);
    if (G.state !== 'play' || P.emote) speed = 0;
    // dodge
    if (P.rootT > 0) P.rootT -= dt;
    if (inPlay && G.pressed.Space && !P.downed && P.dodgeT <= 0 && !P.yank && !(P.rootT > 0)) {
      const cost = 25 * Math.max(0.2, 1 - P.mods.dodgeCost - (P.feats.includes('mobile') ? 0.3 : 0) - (G.sheet.attuned(P, 'bootsspeed') ? 0.25 : 0));
      if (P.sta >= cost) { P.sta -= cost; P.staDelay = 0.6; const dx = ml ? wx : -Math.sin(P.yaw) * -1, dz = ml ? wz : -Math.cos(P.yaw) * -1; const dl = Math.hypot(dx, dz) || 1; P.vel.x = dx / dl * 15; P.vel.z = dz / dl * 15; P.dodgeT = 0.5; P.iframes = 0.3 + P.mods.dodgeIF; G.sfx('swing', 0.5); G.fx.smoke(new G.V3(P.pos.x, 0.1, P.pos.z), 3, 0x5a5048, 0.8, 0.3);
        if (P.relics.includes('frostlantern')) { G.fx.ice(new G.V3(P.pos.x, 0.5, P.pos.z), 20, 4); G.fx.decal('frost', P.pos.x, P.pos.z, 5, 0x9ad8ff, 6); for (const e of G.enemies.list) if (!e.dead && G.dist2(e.pos.x, e.pos.z, P.pos.x, P.pos.z) < 16) G.net.sendHit(e, 0, 'ice', false, null, { sl: 3 }); } }
    }
    P.dodgeT -= dt;
    const accel = P.dodgeT > 0.25 ? 2 : 14;
    P.vel.x = G.lerp(P.vel.x, wx * speed, Math.min(1, dt * accel)); P.vel.z = G.lerp(P.vel.z, wz * speed, Math.min(1, dt * accel));
    // special movement
    if (P.yank) { const Y = P.yank, e = Y.e; Y.t += dt; const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, d = Math.hypot(dx, dz) || 1;
      Y.stuck = Math.hypot(P.pos.x - Y.lx, P.pos.z - Y.lz) < Y.speed * dt * 0.15 && Y.t > 0.12 ? Y.stuck + 1 : 0; Y.lx = P.pos.x; Y.lz = P.pos.z;
      if (e.dead || G.enemies.map[e.id] !== e || P.downed || P.dead || d <= Y.stop || Y.t >= Y.dur || Y.stuck > 3) { P.yank = null; P.vel.multiplyScalar(0.1); P.rootT = Math.max(P.rootT || 0, e.dead ? 0 : Y.root); if (!e.dead) { G.fx.shake(0.3); G.sfx('thunk', 0.7); } }
      else { const sp = Math.min(Y.speed * Math.min(1, 0.35 + Y.t * 5), (d - Y.stop) / dt); P.vel.set(dx / d * sp, 0, dz / d * sp); if (Math.random() < 0.5) G.fx.smoke(new G.V3(P.pos.x, 0.1, P.pos.z), 1, 0x5a5048, 0.6, 0.2); } }
    if (P.dash) { P.dash.t -= dt; P.vel.set(P.dash.vx, 0, P.dash.vz); G.game.breakArea(P.pos.x, P.pos.z, 1.2, true); for (const e of G.enemies.list) if (!e.dead && !P.dash.hit.has(e.id) && G.dist2(e.pos.x, e.pos.z, P.pos.x, P.pos.z) < (e.def.r + 1.2) ** 2) { P.dash.hit.add(e.id); G.combat.deal(e, 0, 'blunt', { roll: P.dash.roll, knock: 3, stun: 1.2, noChain: true }); } if (Math.random() < 0.7) G.fx.spark(new G.V3(P.pos.x, 1, P.pos.z), 0x9ab8ff, 3, 3, 0.3, 0.1, 0); if (P.dash.t <= 0) { P.dash = null; P.vel.multiplyScalar(0.2); } }
    if (P.leap) { P.leap.t += dt / P.leap.dur; const k = Math.min(1, P.leap.t); P.pos.x = G.lerp(P.leap.from.x, P.leap.to.x, k); P.pos.z = G.lerp(P.leap.from.z, P.leap.to.z, k); P.y = Math.sin(k * Math.PI) * 3.5; P.iframes = 0.1; P.vel.set(0, 0, 0);
      if (k >= 1) { const L = P.leap; P.leap = null; P.y = 0; G.sfx('heavyStep', 1); G.game.breakArea(P.pos.x, P.pos.z, 4.5, true); G.enemies.aoeFx('slam', new G.V3(P.pos.x, 0.2, P.pos.z), 4.5, null); for (const e of G.enemies.list) if (!e.dead && G.dist2(e.pos.x, e.pos.z, P.pos.x, P.pos.z) < (4 + e.def.r) ** 2) G.combat.deal(e, 0, 'blunt', { roll: L.roll, knock: 2.5, stun: 1, noChain: true }); G.World.hitGatesNear(P.pos.x, P.pos.z, 4.5); G.net.sendFx({ k: 'slam', x: P.pos.x, z: P.pos.z }); } }
    else { P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt; }
    if (G.World.W) G.World.collide(P.pos, 0.42);
    { const g = G.World.fy(P.pos.x, P.pos.z); P.pos.y = P.pos.y === undefined || Math.abs(g - P.pos.y) > 1 ? g : G.damp(P.pos.y, g, 30, dt); }   // stand on the floor; stairs ramp smoothly
    // footsteps / bob
    const hs = Math.hypot(P.vel.x, P.vel.z);
    P.bob += dt * hs * 1.7; { const sp = Math.floor(P.bob / Math.PI); if (sp !== P.stepN) { P.stepN = sp; if (hs > 1 && P.y === 0) G.sfx('step', 0.75 + Math.min(0.3, hs / 30)); } }
    // attacks
    const archerDraw = cls === 'archer';
    P.updateCast(dt); P.updateSpells(dt); if (cls === 'archer') P.updateVolley(dt);
    if (inPlay && !P.downed && !P.leap && !P.cast) {
      if (archerDraw) {
        if (G.mouse.l && P.atkCD <= 0 && !P.blocking && !P.volley) { if (P.charge < 0) { P.charge = 0; G.sfx('bowdraw', 0.7); } P.charge = Math.min(1, P.charge + dt / (A.draw || 0.85) * (1 + P.mods.atkSpd)); }
        else if (P.charge >= 0) { const ch = P.charge; P.charge = -1; if (ch > 0.08) { P.fireArrow(ch); P.atkCD = 0.25 / (1 + P.mods.atkSpd); } }
      } else if (G.mouse.l && P.atkCD <= 0 && !P.blocking) P.attack();
      if (cls === 'priest') { if (G.pressed.KeyQ) P.qHold = 0; if (P.qHold >= 0) { if (G.keys.KeyQ) { P.qHold += dt; if (P.qHold > 0.25) { P.qHold = -1; P.ability('q'); } } else { P.qHold = -1; P.healingWord(); } } }
      else if (G.pressed.KeyQ) P.ability('q');
      if (G.pressed.KeyR) P.ability('r');
      if (G.pressed.KeyG) P.spell('g'); if (G.pressed.KeyV) P.spell('v');
      for (const E of G.emotes.LIST) if (G.pressed[E.key]) G.emotes.start(P, E.id);
      if (G.pressed.KeyC) G.ui.openPanel('sheet');
      if (G.pressed.KeyF) { if (P.potions > 0 && P.hp < P.maxHp) { P.potions--; P.healOT = 1.6; P.healRate = P.maxHp * 0.5 * P.mods.flaskMul / 1.6; G.sfx('heal', 0.8); G.ui.toast('Healing flask'); } else if (P.potions <= 0) G.ui.toast('No flasks left'); }
    }
    if (P.swing) { const s = P.swing; s.t += dt; const p = s.t / s.dur; if (!s.done && p >= s.hitAt) { s.done = true; s.onHit && s.onHit(); const K = { slashR: [0.012, 0.03], slashL: [0.012, -0.03], overR: [-0.045, 0], slam: [-0.06, 0], smash: [-0.04, 0], thrust: [0.02, 0], stab: [0.012, 0], stabL: [0.012, 0], lslash: [0.012, -0.03], cross: [0.012, 0], cast: [0.015, 0], bash: [-0.02, 0.02] }[s.kind]; if (K) { P.kickX = (P.kickX || 0) + K[0]; P.kickZ = (P.kickZ || 0) + K[1]; } } if (p >= 1) P.swing = null; }
    P.updateHealPreview();
    P.updateCam(dt, t);
  };

  P.updateCam = (dt, t) => {
    const cam = G.camera, sh = G.fx.shakeAmt * G.fx.shakeAmt;
    if (P.emote && G.emotes.update(P, dt)) return;
    // dead in a party: watch your allies over their shoulder (click to switch)
    if (P.dead && G.net.party && G.run.active) {
      const alive = Object.entries(G.net.remotes).filter(([peer, r]) => { const m = G.net.members().find(q => q.peer === peer); return r.root.visible && m && !m.presence.dd; });
      if (alive.length) {
        if (G.pressed.Space || G.mouse.lPressed) P.specIdx = (P.specIdx || 0) + 1;
        const [, r] = alive[(P.specIdx || 0) % alive.length], back = new G.V3(Math.sin(r.yaw), 0, Math.cos(r.yaw));
        P.specYaw = (P.specYaw ?? r.yaw) - G.mouse.dx * 0.003; P.specYaw = G.lerpAng(P.specYaw, r.yaw, dt * 0.6);
        const off = new G.V3(Math.sin(P.specYaw) * 3.6, 2.2, Math.cos(P.specYaw) * 3.6);
        const want = r.pos.clone().add(off); if (G.World.W && G.World.isWall(want.x, want.z)) want.copy(r.pos).add(off.multiplyScalar(0.4));
        P.specPos = (P.specPos || want.clone()).lerp(want, Math.min(1, dt * 6)); cam.position.copy(P.specPos); cam.lookAt(r.pos.x, 1.4, r.pos.z); cam.rotation.order = 'YXZ';
        if (P.V) P.V.root.visible = false; return;
      }
    }
    // head bob: amplitude eases with speed, cos^2 keeps the dip rounded (|cos| had a sharp corner every step)
    const spd = Math.hypot(P.vel.x, P.vel.z); P.bobAmp = G.damp(P.bobAmp || 0, Math.min(1, spd / 5), 8, dt);
    const cb = Math.cos(P.bob), bobY = cb * cb * 0.05 * P.bobAmp;
    // going down / dying lowers and rolls the view over a moment rather than in one frame
    P.eyeH = G.damp(P.eyeH ?? 1.62, P.dead ? 0.35 : P.downed ? 0.5 : 1.62, P.dead || P.downed ? 4 : 6, dt);
    P.camRoll = G.damp(P.camRoll || 0, P.dead ? 0.5 : P.downed ? 0.25 : 0, 3.5, dt);
    // strafing leans the view a touch; landings dip it with a single soft impulse
    const lat = P.vel.x * Math.cos(P.yaw) - P.vel.z * Math.sin(P.yaw); P.lean = G.damp(P.lean || 0, G.clamp(lat / 6, -1, 1), 7, dt);
    const wasAir = P.wasAir; P.wasAir = P.y > 0.05; if (wasAir && !P.wasAir) P.landT = 0; P.landT = (P.landT ?? 9) + dt;
    const lk = P.landT / 0.09, dip = P.landT < 1 ? 0.13 * lk * Math.exp(1 - lk) : 0;
    const tt = G.now(), n1 = G.noise1(tt * 2.2, 1), n2 = G.noise1(tt * 2.2, 2), n3 = G.noise1(tt * 2.2, 3);
    cam.position.set(P.pos.x + n1 * sh * 0.14, P.pos.y + P.y + P.eyeH + bobY - dip + n2 * sh * 0.14, P.pos.z + n3 * sh * 0.14);
    // recoil: impulses add to kickX/Z, the view rises to them over ~25 ms and settles back
    P.kickX = (P.kickX || 0) * Math.exp(-dt * 10); P.kickZ = (P.kickZ || 0) * Math.exp(-dt * 10);
    P.kX = G.damp(P.kX || 0, P.kickX, 40, dt); P.kZ = G.damp(P.kZ || 0, P.kickZ, 40, dt);
    const sway = Math.sin(P.bob) * 0.006 * P.bobAmp;
    cam.rotation.set(P.pitch + G.noise1(tt * 2.6, 4) * sh * 0.025 + P.kX + dip * 0.15, P.yaw, P.camRoll + sway + P.kZ - P.lean * 0.012 + G.noise1(tt * 2.1, 5) * sh * 0.012, 'YXZ');
    const sprinting = G.keys.ShiftLeft && Math.hypot(P.vel.x, P.vel.z) > 6;
    const tf = G.settings.fov + (sprinting ? 7 : 0) + (P.charge > 0 ? -P.charge * 10 : 0);
    if (Math.abs(cam.fov - tf) > 0.05) { cam.fov = G.damp(cam.fov, tf, 8, dt); cam.updateProjectionMatrix(); }
    if (G.Lights.playerLight) { G.Lights.playerLight.position.set(P.pos.x - Math.sin(P.yaw) * 0.4, P.pos.y + P.y + 1.9, P.pos.z - Math.cos(P.yaw) * 0.4); G.Lights.playerLight.intensity = (G.World.theme === 'hideout' ? 0.6 : 1.3) + Math.sin(t * 9) * 0.06; }
    P.animVM(dt, t);
  };

  /* ---------- viewmodel animation (elbow pivot + wrist snap) ---------- */
  // each pose: elbow pitch/yaw/roll (ex,ey,ez), wrist (wx,wz), pivot shift (px,py,pz); keyed rest -> windup -> strike -> recover
  P.pose = (kind, p) => {
    const e = (a, b) => G.smooth(G.clamp((p - a) / (b - a), 0, 1));
    const w = e(0, 0.36), s = e(0.36, 0.56), r = e(0.68, 1);
    const K = (wv, sv) => G.lerp(G.lerp(0, wv, w), sv, s) * (1 - r);
    const T = { slashR: [0.8, -0.55, -0.4, 0.9, -0.6, 0, 0.1, 0, 0.45, 0.9, 0.45, -0.35, 1.15, -0.04, 0.04, -0.2],
      slashL: [0.75, 0.55, 0.35, 0.8, 0.8, 0, 0.1, 0, 0.4, -0.85, -0.35, -0.35, -1.15, 0.04, 0.04, -0.18],
      thrust: [0.25, 0.05, 0, -0.9, 0, 0, 0.05, 0.1, 0.38, 0.2, 0, -1.28, 0, -0.03, 0.08, -0.26],
      overR: [1.15, -0.05, 0, 1.1, 0, 0, 0.12, -0.02, 0.18, 0.08, 0, -0.75, 0, 0, 0.03, -0.1],
      cross: [0.5, -0.5, -0.2, 0.5, -0.3, 0, 0.05, 0, 0.45, 0.6, 0.2, -0.6, 0.5, 0, 0.05, -0.1],
      cast: [0.25, 0, 0, 0, 0, 0, 0, 0.04, 0.12, 0.05, 0, -0.35, 0, 0, 0.02, -0.16] };
    const k = { stab: 'thrust', smash: 'overR', slam: 'overR' }[kind] || kind, a = T[k];
    if (!a) return null;
    return { ex: K(a[0], a[8]), ey: K(a[1], a[9]), ez: K(a[2], a[10]), wx: K(a[3], a[11]), wz: K(a[4], a[12]), px: K(a[5], a[13]), py: K(a[6], a[14]), pz: K(a[7], a[15]) };
  };
  // poses are computed as targets and blended in, so block/sprint/attack transitions ease instead of snapping
  const tE = new THREE.Euler(0, 0, 0, 'YXZ'), tQ = new THREE.Quaternion(), tP = new G.V3();
  const applyArm = (arm, rest, o, mir, base, bob, dt, sprint) => {
    tP.copy(base).add(bob); tE.set(rest[0], rest[1], rest[2]); let hx = -rest[0], hz = 0;
    if (sprint) { tE.x -= 0.42 * sprint; tE.y += 0.28 * sprint * mir; tP.y -= 0.05 * sprint; hx += 0.25 * sprint; hz += 0.2 * sprint * mir; }
    if (o) { const m = o.abs ? 1 : mir; tP.x += o.px * m; tP.y += o.py; tP.z += o.pz; tE.x += o.ex; tE.y += o.ey * m; tE.z += o.ez * m; hx += o.wx; hz += o.wz * m; }
    const k = 1 - Math.exp(-dt * (o ? 34 : 16));
    arm.A.position.lerp(tP, k); tQ.setFromEuler(tE); arm.A.quaternion.slerp(tQ, k);
    tE.set(hx + (arm.handRX || 0), 0, hz + (arm.handRZ || 0)); tQ.setFromEuler(tE); arm.hand.quaternion.slerp(tQ, k);
  };
  P.animVM = (dt, t) => {
    const V = P.V; if (!V) return;
    V.root.visible = !P.dead && !P.downed && G.state === 'play' && !P.emote;
    const hs = Math.min(1, Math.hypot(P.vel.x, P.vel.z) / 5);
    const bob = G.tmpV2.set(Math.sin(P.bob) * 0.018 * hs + P.swayX, -(Math.abs(Math.cos(P.bob)) * 0.018 * hs + Math.sin(t * 1.6) * 0.004 + P.swayY), 0);
    const sw = P.swing, p = sw ? sw.t / sw.dur : 0;
    let oR = null, oL = null;
    if (sw) {
      if (!G.anim.isMove(sw.kind)) { const o = P.pose(sw.kind, p); oR = o; }
      if (sw.kind === 'bash') { const e = Math.sin(Math.min(1, p) * Math.PI); oL = { abs: 1, ex: 0.25 * e, ey: -1.05 * e, ez: 0, wx: 0, wz: 0, px: 0.12 * e, py: 0.15 * e, pz: -0.25 * e }; }
      if (sw.kind === 'word' || sw.kind === 'holy') { const e = Math.sin(Math.min(1, p) * Math.PI); oL = { ex: 0.7 * e, ey: 0.35 * e, ez: 0, wx: -0.6 * e, wz: 0, px: 0.06 * e, py: 0.1 * e, pz: -0.22 * e }; }
      if (sw.kind === 'cast' && cls === 'priest') { const e = Math.sin(Math.min(1, p) * Math.PI); oL = { ex: 0.45 * e, ey: 0.2 * e, ez: 0, wx: -0.3 * e, wz: 0, px: 0, py: 0.05 * e, pz: -0.1 * e }; }
    }
    if (P.blocking) {
      if (V.shield) oL = { abs: 1, ex: 0.18, ey: -0.85, ez: 0.0, wx: 0, wz: 0, px: 0.08, py: 0.12, pz: -0.32 };
      else if (cls === 'wizard') oR = { ex: 0.15, ey: 0, ez: 0, wx: 0, wz: 0, px: 0, py: 0.04, pz: -0.06 };
      else if (!G.anim.GUARDK[cls]) { oR = { ex: 0.35, ey: 0.75, ez: 0, wx: -0.2, wz: 1.35, px: 0, py: 0.08, pz: -0.05 }; if (V.weapon2) oL = { ex: 0.35, ey: 0.75, ez: 0, wx: -0.2, wz: 1.35, px: 0, py: 0.05, pz: -0.05 }; }
    }
    const sprinting = G.keys.ShiftLeft && Math.hypot(P.vel.x, P.vel.z) > 6 && !sw && !P.blocking && P.charge < 0;
    P.sprintK = G.lerp(P.sprintK || 0, sprinting ? 1 : 0, 1 - Math.exp(-dt * 8));
    applyArm(V.R, V.rest.R, oR, 1, V.restR, bob, dt, P.sprintK); applyArm(V.L, V.rest.L, oL, -1, V.restL, bob, dt, V.shield ? P.sprintK * 0.5 : P.sprintK);
    if (V.axe) V.axe.rotation.y = 0;
    // shoulder-driven swings, stabs and casts (see anim.js): override the arm that holds the weapon
    if (P.cast && cls !== 'archer') { const f = G.anim.frame('channel', P.cast.t / P.cast.dur, 0.45, false, t); G.anim.fpArm(V.R, V.weapon, f, f.w); if (cls === 'priest') { const e = Math.min(1, P.cast.t / 0.2); applyArm(V.L, V.rest.L, { ex: 0.6 * e, ey: 0.3 * e, ez: 0, wx: -0.5 * e, wz: 0, px: 0.04 * e, py: 0.08 * e, pz: -0.16 * e }, -1, V.restL, bob, dt, 0); } }
    else if (sw && G.anim.isMove(sw.kind) && cls !== 'archer') {
      if (sw.kind === 'stabL' || sw.kind === 'cross' || sw.kind === 'lslash') { if (V.weapon2) { const f = G.anim.frame(sw.kind === 'lslash' ? 'slashR' : 'stabL', p, sw.hitAt, true, t); G.anim.fpArm(V.L, V.weapon2, f, f.w); } }
      if (sw.kind !== 'stabL' && sw.kind !== 'lslash') { const f = G.anim.frame(sw.kind === 'cross' ? 'stab' : sw.kind, p, sw.hitAt, false, t); G.anim.fpArm(V.R, V.weapon, f, f.w); }
    }
    // guard: weapon held out in front of the face (same eye-space pose the third-person body uses)
    { const gk = V.guard || G.anim.GUARDK[cls], want = P.blocking && gk && !sw && !P.cast && !(P.charge >= 0) ? 1 : 0; P.guardW = G.damp(P.guardW || 0, want, want ? 16 : 10, dt);
      if (gk && P.guardW > 0.01) { G.anim.fpArm(cls === 'archer' ? V.L : V.R, V.weapon, G.anim.guard(gk), P.guardW); if (gk === 'gd' && V.weapon2) G.anim.fpArm(V.L, V.weapon2, G.anim.guard('gd', true), P.guardW); } }
    if (V.twoHand) { // second hand grips the haft below the first
      V.root.updateMatrixWorld(true); const tg = new G.V3(0, -0.12, 0); V.weapon.localToWorld(tg);
      V.L.A.lookAt(tg); V.L.A.rotateY(Math.PI); V.L.hand.rotation.set(-0.3, 0, 0.6);
    }
    if (V.barrier) { V.barrier.visible = P.blocking; V.barrier.material.opacity = 0.18 + Math.sin(t * 8) * 0.06 + (P.blockT < 0.22 ? 0.25 : 0); }
    if (cls === 'archer') {
      // bow held upright in front, arrow on the rest aimed at the screen centre; draw hand pulls the string back
      P.relT = (P.relT ?? 9) + dt;
      const vd = P.volleyDraw ?? -1, chg = Math.max(P.charge, vd);
      const want = chg >= 0 || P.relT < 0.55 ? 1 : 0; P.bowRaise = G.lerp(P.bowRaise || 0, want, 1 - Math.exp(-dt * (want ? 14 : 6)));
      const bow = V.weapon, U = bow.userData, rk = P.bowRaise, s = 1 / 0.62;
      let nock = U.rest.clone();
      if (rk > 0.01) {
        const full = chg >= 0.999, g0 = G.anim.G0.clone(); if (full) { g0.x += (Math.random() - 0.5) * 0.004; g0.y += (Math.random() - 0.5) * 0.004; }
        const F = new G.V3(0, 0, -30).sub(g0).normalize(), z = F.clone().negate(), y = new G.V3(0, 1, 0).addScaledVector(z, -z.y).normalize(), x = y.clone().cross(z);
        const qB = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
        bow.updateMatrix(); const qH = qB.clone().multiply(bow.quaternion.clone().invert());
        const hand = g0.clone().multiplyScalar(s).sub(bow.position.clone().applyQuaternion(qH));
        G.anim.placeFore(V.L, hand.clone().add(new G.V3(-0.2, -0.26, 1).normalize()), hand, rk);   // forearm points nearly at the target: the bow leaves a straight wrist
        V.L.hand.quaternion.slerp(V.L.A.quaternion.clone().invert().multiply(qH), rk);
        const draw = Math.max(0, chg); if (chg >= 0) P.relDraw = draw;
        nock.set(0, 0, 0.085 + G.smooth(Math.min(1, draw * 1.15)) * 0.44);
        if (chg < 0 && P.relT < 0.3) nock.z = 0.085 - Math.sin(P.relT / 0.3 * Math.PI * 4) * 0.035 * (1 - P.relT / 0.3);
        // after the loose the draw hand stays back by the jaw and opens, instead of snapping forward to the string
        const hz = chg >= 0 ? nock.z : 0.085 + G.smooth(Math.min(1, (P.relDraw || 0) * 1.15)) * 0.44 + Math.sin(Math.min(1, P.relT / 0.18) * Math.PI / 2) * 0.08;
        V.root.updateMatrixWorld(true);
        const nw = V.root.worldToLocal(bow.localToWorld(new G.V3(chg >= 0 ? 0 : 0.03, chg >= 0 ? 0 : -0.03, hz))).add(new G.V3(0.03, -0.085, 0.05));
        G.anim.placeFore(V.R, nw.clone().add(new G.V3(0.55, -0.12, 1).normalize()), nw, rk);   // draw elbow up and back behind the arrow: the forearm stays out of the sight line
        V.R.hand.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0.9, 1.4)), rk);
        if (full) { P.kickX = (P.kickX || 0) + (Math.random() - 0.5) * 0.0016; P.kickZ = (P.kickZ || 0) + (Math.random() - 0.5) * 0.0016; if (!P.fullCue) { P.fullCue = true; G.sfx('cling', 0.25); G.sfx('bowdraw', 0.3); } } else P.fullCue = false;
      }
      // at rest the fist rolls so the bow leans up and inward instead of lying flat
      if (rk < 0.999) { const cq = G.camera.quaternion, up = new G.V3(0, 1, 0).applyQuaternion(cq).add(new G.V3(1, 0, 0).applyQuaternion(cq).multiplyScalar(0.55)).normalize(); M.bowUpright(V.L.hand, new G.V3(1, 0, 0), 1 - rk, up, new G.V3(0, 0, 1)); }
      U.setNock(nock);
      V.arrow.visible = chg >= 0 || (P.relT > 0.35 && P.atkCD <= 0.05 && !P.volley);
      M.aimArrow(V.arrow, nock);
      M.fanArrows(bow, V.fan || (V.fan = []), P.volley && !P.volley.fired ? Math.min(7, P.volley.n) : 0, nock, 0.15);
      // volley arrowheads gather light as the fan is drawn
      if (P.volley && !P.volley.fired && Math.random() < 0.7) { const all = [V.arrow, ...V.fan.filter(a => a.visible)], a = G.pick(all), tip = a.localToWorld(new G.V3(0, 0, 0.4)); G.fx.emit(G.fx.add, tip.x, tip.y, tip.z, 0, 0.05, 0, 0.18, 0.025, 0, [1.8, 1.5, 0.8, 1], [1, 0.6, 0.2, 0]); }
    }
    if (V.orbLight) V.orbLight.intensity = 0.8 + Math.sin(t * 7) * 0.2 + (sw && sw.kind === 'cast' ? 2 * Math.sin(p * Math.PI) : 0);
    // weapon inertia: arms trail strafes and landings, and a newly equipped weapon is raised into view
    if (P._vmRef !== V) { P._vmRef = V; P.equipT = 0; }
    P.equipT = (P.equipT ?? 1) + dt; const eq = 1 - G.smooth(Math.min(1, P.equipT / 0.4)), lk2 = (P.landT ?? 9) / 0.1, land = (P.landT ?? 9) < 1 ? lk2 * Math.exp(1 - lk2) : 0;
    const rg = P.rageT > 0 ? 0.002 : 0, tq = G.now();
    V.root.position.set(-(P.lean || 0) * 0.012 + G.noise1(tq * 6, 7) * rg, -0.22 * eq - land * 0.03 + G.noise1(tq * 6, 8) * rg, 0.04 * eq);
    V.root.rotation.set(-0.6 * eq - land * 0.05, 0, (P.lean || 0) * 0.04);
    // glowing trail from the blade tip during the strike
    if (sw && sw.kind !== 'cast' && sw.kind !== 'shoot' && p > 0.34 && p < 0.6 && V.weapon) {
      V.root.updateMatrixWorld(true);
      const c = P.wpnLv >= 4 ? [1.8, 0.9, 0.3, 0.9] : P.wpnLv >= 3 ? [0.3, 1.5, 1.8, 0.9] : P.wpnLv >= 2 ? [0.6, 0.9, 1.8, 0.8] : [1, 1, 1, 0.45];
      for (let k = 0; k < 3; k++) { const tip = new G.V3(0, (V.weapon.userData.tip || 0.8) * (1 - k * 0.12), 0); V.weapon.localToWorld(tip); G.fx.emit(G.fx.add, tip.x, tip.y, tip.z, 0, 0, 0, 0.16, 0.14 - k * 0.03, 0.01, c, [c[0], c[1], c[2], 0]); }
    }
    if (P.wpnLv >= 4 && V.weapon && Math.random() < 0.3) { const tip = new G.V3(0, (V.weapon.userData.tip || 0.8) * Math.random(), 0); V.weapon.localToWorld(tip); G.fx.emit(G.fx.add, tip.x, tip.y, tip.z, 0, 0.3, 0, 0.5, 0.06, 0, [1.8, 0.8, 0.2, 1], [1, 0.2, 0, 0]); }
  };
  return P;
};
