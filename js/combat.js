/* ============================================================
   Combat resolution: dice-rolled player damage, procs, relics,
   enemy -> player hits with saving throws
   ============================================================ */
'use strict';
G.combat = {
  // o.roll(crit) returns the rolled dice total; base is used for flat damage
  deal(e, base, type, o = {}) {
    const P = G.player; if (!e || e.dead || !P) return 0;
    const m = P.mods;
    const primary = !o.noChain;
    let crit = !!o.crit || (!o.noCrit && Math.random() < G.sheet.critChance(P)) || (primary && P.critNext);
    const sneak = P.cls === 'rogue' && (o.sneak || (primary && P.sneakNext));
    if (primary) { P.critNext = false; P.sneakNext = false; }
    let dmg = o.roll ? o.roll(crit) : base * (crit ? 2 : 1);
    if (sneak) dmg += G.rollN(G.sheet.sneakDice(P) * (crit ? 2 : 1), 6);
    if (!o.raw) {
      dmg *= (1 + m.dmg) * (P.rageT > 0 ? 1.4 : 1) * (m.berserk && P.hp < P.maxHp * 0.5 ? 1 + m.berserk : 1) * (m.lastStand && P.hp < P.maxHp * 0.3 ? 1 + m.lastStand : 1)
        * (P.relics.includes('bloodpact') ? 1.3 : 1) * (G.sheet.attuned(P, 'vulnerability') ? 1.15 : 1) * (P.relics.includes('warhorn') && (e.boss || e.elite) ? 1.25 : 1)
        * (P.stk && P.stk.mom ? 1 + P.stk.mom * 0.03 : 1);
    }
    if (e.def.immune && e.def.immune === type) dmg *= 0.3;
    // a raised shield turns aside blows from the front: circle round it
    if (e.guardT > 0 && Math.abs(G.angDiff(e.rot, Math.atan2(P.pos.x - e.pos.x, P.pos.z - e.pos.z))) < 1.15) { dmg *= 0.12; if (primary) { G.fx.spark(new G.V3(e.pos.x + Math.sin(e.rot) * 0.6, 1.2, e.pos.z + Math.cos(e.rot) * 0.6), 0xffe0b0, 14, 4, 0.3, 0.07); G.sfx('clang', 0.8, e.pos); G.fx.textPop(new G.V3(e.pos.x, e.def.h + 0.4, e.pos.z), 'BLOCKED · flank it', '#c8d8ff'); } }
    if (e.def.armor && e.st.move < 0.2 && (type === 'slash' || type === 'pierce')) dmg *= 1 - e.def.armor;
    if (o.mul) dmg *= o.mul;
    dmg = Math.max(1, Math.round(dmg));
    // procs
    const st = {};
    if (type === 'fire') st.b = 2;
    if (m.ignite && Math.random() < m.ignite) st.b = 2.5;
    if (G.sheet.attuned(P, 'flametongue') && primary && Math.random() < 0.2) st.b = 2.5;
    if (o.freeze || (m.freeze && Math.random() < m.freeze) || (G.sheet.attuned(P, 'frostbrand') && primary && Math.random() < 0.1)) st.fz = o.freezeT || 2.5;
    if (o.stun) st.st = o.stun;
    if (o.slow) st.sl = o.slow;
    if (m.bleed && (type === 'slash' || type === 'pierce' || type === 'blunt')) st.bl = m.bleed;
    if (o.bleed) st.bl = (st.bl || 0) + o.bleed;
    const point = o.point || new G.V3(e.pos.x, e.pos.y + e.def.h * (e.scale || 1) * 0.6 + e.y, e.pos.z);
    const dir = new G.V3(e.pos.x - P.pos.x, 0, e.pos.z - P.pos.z).normalize();
    // local prediction & fx
    G.enemies.hitFx(e, dmg, type, point, dir, crit, { from: P.eye(), swing: o.swing, sneak });
    if (primary && G.voice) G.voice.taunt(e);
    if (st.fz) G.fx.iceBlock(e);
    if (o.knock && !e.boss && !e.elite) G.enemies.push(e, dir.x * o.knock, dir.z * o.knock);
    G.net.sendHit(e, dmg, type, crit, point, st, o.overkillHint);
    if (primary && G.stacks) G.stacks.onHit(P);
    // relic: every 7th hit calls lightning
    if (primary && P.relics.includes('idol') && ++P.hitN % 7 === 0) { const top = new G.V3(e.pos.x, 9, e.pos.z); G.fx.lightning(top, point, 0xcfe4ff, 2); G.sfx('lightning', 0.8, e.pos); G.net.sendFx({ k: 'bolt', a: [top.x, top.y, top.z], b: [point.x, point.y, point.z] }); this.deal(e, 0, 'lightning', { roll: () => G.rollN(2, 8), noChain: true, raw: true, noCrit: true }); }
    if (m.chain && primary) this.chain(e, dmg * m.chainDmg, m.chain, m.ignite > 0.4);
    G.ui.hitMarker(crit);
    return dmg;
  },
  chain(from, dmg, n, ignite, raw) {
    const hit = new Set([from.id]); let cur = from;
    for (let k = 0; k < n; k++) {
      let best = null, bd = 64;
      for (const e of G.enemies.list) { if (e.dead || hit.has(e.id)) continue; const d = G.dist2(e.pos.x, e.pos.z, cur.pos.x, cur.pos.z); if (d < bd) { bd = d; best = e; } }
      if (!best) break; hit.add(best.id);
      const a = new G.V3(cur.pos.x, cur.def.h * 0.6 + cur.y, cur.pos.z), b = new G.V3(best.pos.x, best.def.h * 0.6 + best.y, best.pos.z);
      G.fx.lightning(a, b, 0x9ad0ff); G.net.sendFx({ k: 'bolt', a: [a.x, a.y, a.z], b: [b.x, b.y, b.z] });
      this.deal(best, dmg, 'lightning', { noChain: true, raw: !raw ? true : false, noCrit: true, point: b });
      if (ignite) G.net.sendHit(best, 0, 'fire', false, b, { b: 2.5 });
      cur = best;
    }
    if (n > 0) G.sfx('zap', 0.6, from.pos);
  },
  // a straight skewer: every enemy within a narrow line in front, up to n of them
  lineHit(range, n, rollFn, type, o = {}) {
    const P = G.player, fy = P.yaw + Math.PI, fx = Math.sin(fy), fz = Math.cos(fy); let hits = 0;
    const list = G.enemies.list.filter(e => { if (e.dead || e.cower) return false; const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx); return along > -0.3 && along < range + e.def.r && side < 0.7 + e.def.r * (e.scale || 1) && G.World.los(P.pos.x, P.pos.z, e.pos.x, e.pos.z); })
      .sort((a, b) => G.dist2(a.pos.x, a.pos.z, P.pos.x, P.pos.z) - G.dist2(b.pos.x, b.pos.z, P.pos.x, P.pos.z)).slice(0, n);
    list.forEach((e, i) => { this.deal(e, 0, type, Object.assign({ roll: rollFn, noChain: i > 0 }, o)); hits++; });
    const tip = P.eye().addScaledVector(P.forward(), Math.min(range, 4)); for (let k = 0; k < 10; k++) G.fx.emit(G.fx.add, tip.x, tip.y - 0.2, tip.z, Math.sin(fy) * 8 + (Math.random() - 0.5), (Math.random() - 0.5), Math.cos(fy) * 8 + (Math.random() - 0.5), 0.2, 0.12, 0.02, [1.6, 1.5, 1.3, 1], [0.6, 0.5, 0.4, 0]);
    if (hits) { G.fx.shake(0.15 + hits * 0.04); G.hitstop = 0.05; }
    return hits + this.melee(range, 0.5, rollFn, type, Object.assign({}, o, { onlyProps: 1 }));
  },
  // melee sweep from the local player; rollFn(crit) rolls the weapon dice
  melee(range, arc, rollFn, type, o = {}) {
    const P = G.player; let hits = 0; range *= 1 + P.mods.reach; arc *= 1 + P.mods.reach * 0.5;
    const fwdYaw = P.yaw + Math.PI;
    for (const e of G.enemies.list) {
      if (e.dead || o.onlyProps) continue; const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, d = Math.hypot(dx, dz) - e.def.r * (e.scale || 1) * 0.8;
      if (d > range) continue; const ang = Math.atan2(dx, dz);
      if (Math.abs(G.angDiff(fwdYaw, ang)) > arc / 2 && d > 0.6) continue;
      if (!G.World.los(P.pos.x, P.pos.z, e.pos.x, e.pos.z)) continue;
      if (e.cower) continue;
      const hp = G.gore.surfacePoint(e, P.eye(), dx, dz, d);
      const back = Math.abs(G.angDiff(e.rot, ang)) < 0.9;
      this.deal(e, 0, type, Object.assign({ point: hp, roll: rollFn, sneak: P.cls === 'rogue' && back }, o));
      if (e.chest) G.game.mimicWake(e.chest, true);
      hits++;
      if (P.cls === 'priest') {
        if (Math.random() < 0.35) { G.fx.holy(hp, 12, 0.3); this.deal(e, 0, 'holy', { roll: c => G.rollN(c ? 2 : 1, 4) + G.sheet.mod(P, 'WIS'), noChain: true, noCrit: true, point: hp }); }
        if (P.mods.beacon && (!P.beaconT || G.now() - P.beaconT > 1)) { P.beaconT = G.now(); const h = G.rollN(1, 4); P.heal(h, true); G.net.sendSup({ k: 'heal', amt: h, x: P.pos.x, z: P.pos.z, r: 6, quiet: 1 }); }
      }
    }
    hits += G.pvp.melee(range, arc, rollFn, type, o);
    for (const b of (G.World.breakables || [])) {
      if (b.broken) continue; const dx = b.x - P.pos.x, dz = b.z - P.pos.z, d = Math.hypot(dx, dz) - b.rad;
      if (d > range || (Math.abs(G.angDiff(fwdYaw, Math.atan2(dx, dz))) > arc / 2 && d > 0.4)) continue;
      G.game.breakObj(b, true, P.pos); hits++;
    }
    for (const c of (G.World.chests || [])) { if (c.opened || !c.mimic) continue; const d = Math.hypot(c.x - P.pos.x, c.z - P.pos.z); if (d < range + 0.6 && Math.abs(G.angDiff(fwdYaw, Math.atan2(c.x - P.pos.x, c.z - P.pos.z))) < arc / 2) { G.game.mimicWake(c, false); hits++; } }
    if (!hits && !o.onlyProps) { // strike the wall? cracked walls can be broken
      const fx = Math.sin(fwdYaw), fz = Math.cos(fwdYaw), t = G.World.rayWall(P.pos.x, P.pos.z, fx, fz, range);
      if (t < range) { const p = new G.V3(P.pos.x + fx * t, 1.2 + P.pitch * 0.8, P.pos.z + fz * t);
        const hitGate = G.World.hitGateAt(P.pos.x + fx * (t + 0.3), P.pos.z + fz * (t + 0.3), 1);
        G.fx.spark(p, 0xffd090, 10, 4, 0.35, 0.07); G.sfx(hitGate ? 'stonehit' : P.cls === 'priest' || P.cls === 'barbarian' ? 'stonehit' : 'cling', 0.8); G.fx.shake(hitGate ? 0.2 : 0.08); if (hitGate) G.fx.smoke(p, 4, 0x8a8070, 1, 0.3); }
    } else { G.fx.shake(0.12 + hits * 0.03); G.hitstop = 0.045; }
    return hits;
  },
  splash(pos, radius, dmg, type, p = {}) {
    G.game.breakArea(pos.x, pos.z, radius, true); G.World.hitGatesNear(pos.x, pos.z, radius);
    for (const e of G.enemies.list) { if (e.dead || e.cower || (p.hit && p.hit.has(e.id))) continue; if (G.dist2(pos.x, pos.z, e.pos.x, e.pos.z) < (radius + e.def.r) ** 2) this.deal(e, dmg, type, { freeze: p.freeze, noChain: true, noCrit: true, freezeT: 3 }); }
  },
  playerProjHit(p, e) {
    const pt = p.m.position.clone(), far = p.origin ? p.origin.distanceTo(pt) > 8 : false;
    let fz = p.freeze && p.kind !== 'frostarrow';
    if (p.chill) { e.chill = (e.chill || 0) + 1; if (e.chill >= 3) { e.chill = 0; fz = true; } }
    const frozen = (e.flags & 2) || e.frozenT > 0 || !!e.iceMesh;
    if (p.shatter && frozen) { G.fx.chunks(pt, 10, 0x9ad8ff, 0.14, true); G.fx.textPop(pt.clone().setY(pt.y + 0.5), 'SHATTER', '#9ad8ff'); G.sfx('shatter', 1, e.pos); }
    this.deal(e, p.dmg, p.dtype || 'pierce', { point: pt, roll: p.roll ? (c) => p.roll(c, far) : null, freeze: fz, freezeT: p.chill ? 2 : undefined, slow: p.slow, bleed: p.bleed, knock: p.knock, swing: 'thrust', mul: p.shatter && frozen ? p.shatter : undefined });
    if (p.kind === 'parrow' || p.kind === 'arrow' || p.kind === 'knife') { // stick the arrow into the body
      if (!e.dead && (e.R.chest || e.R.body)) { const host = e.R.chest || e.R.body; const a = p.m; G.scene.remove(a); const keep = a.clone(); host.worldToLocal(pt); keep.position.copy(pt); const q = new THREE.Quaternion(); host.getWorldQuaternion(q); keep.quaternion.copy(q.invert().multiply(a.quaternion)); const s = new G.V3(); host.getWorldScale(s); keep.scale.set(1 / s.x, 1 / s.y, 1 / s.z); host.add(keep); }
    }
  },
  // enemy -> me
  enemyHitsMe(e, dmg, atk, unblockable, knock, dtype, so = {}) {
    const P = G.player; if (!P || P.dead || P.downed) return;
    const dc = 11 + Math.floor((G.run.depth || 0) / 2) + (e.boss ? 2 : 0) + (e.elite ? 1 : 0);
    const res = P.takeDamage(dmg, { x: e.pos.x, z: e.pos.z }, { unblockable, knock: knock || (e.boss ? 6 : 0), type: dtype || (atk && atk.burn ? 'fire' : atk && atk.poison ? 'poison' : 'phys'), attacker: e, melee: atk && atk.k === 'melee', save: so.save, dc });
    if (res === 'parry' && !e.boss) G.net.sendHit(e, 0, 'stun', false, null, { st: 1.6 });
    if (res === 'parry' && e.boss) G.net.sendHit(e, 0, 'stun', false, null, { st: 0.5 });
    if (res === 'blocked' && P.mods.iceBlock && atk && atk.k === 'melee') G.net.sendHit(e, 0, 'ice', false, null, { fz: 2 });
    if (res > 0 && P.mods.thorns && atk && atk.k === 'melee') this.deal(e, res * P.mods.thorns, 'pierce', { noChain: true, raw: true, noCrit: true });
    if (res > 0 && ((atk && atk.drain) || (e.affix && e.affix.includes('vampiric')))) G.net.sendSup({ k: 'ehe', i: e.id, amt: Math.round(res * 1.5) });
  },
  enemyProjHitMe(p) {
    const P = G.player; const src = { x: p.m.position.x - p.vel.x, z: p.m.position.z - p.vel.z };
    const res = P.takeDamage(p.dmg, src, { type: p.burn ? 'fire' : p.kind, proj: true });
    if (res !== 'parry' && res !== 'blocked' && res > 0) { if (p.slow) P.slowT = Math.max(P.slowT, p.slow); if (p.burn) P.addDot(4 * G.enemies.diff().dmg, 3, 'fire'); }
    // hooks and silk lines reel you in unless you parried or dodged clear (a plain block still gets you caught)
    if (p.pull && res !== 'parry' && res !== 0) { const e = G.enemies.map[p.pull.eid]; if (e && !e.dead) P.yanked(e, p.pull, p); }
  }
};
