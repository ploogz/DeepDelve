/* ============================================================
   Hideout sparring arena: friendly fire between party members while both stand on the sand,
   knock-outs instead of deaths, and training dummies that read out your damage per second.
   Every hit is resolved by the attacker (range, arc, dice) and applied by the victim's own client,
   so blocks and parries still work against a friend.
   ============================================================ */
'use strict';
G.pvp = {
  SCALE: 0.6,              // friendly blows land softer than on monsters, so duels last a few exchanges
  dummies: [], score: {}, lastBy: null, inside: false,
  area() { return G.World.arena || null; },
  inArena(x, z) { const A = this.area(); if (!A || G.run.active) return false; if (A.r) return (x - A.cx) ** 2 + (z - A.cz) ** 2 < A.r * A.r; return x > A.x0 && x < A.x1 && z > A.z0 && z < A.z1; },
  meIn() { const P = G.player; return !!P && G.state === 'play' && this.inArena(P.pos.x, P.pos.z); },
  // remote party members currently standing in the arena
  foes() { if (!this.meIn() || !G.net.party) return []; const out = []; for (const peer in G.net.remotes) { const r = G.net.remotes[peer]; if (r && r.root.visible && this.inArena(r.pos.x, r.pos.z)) out.push({ peer, r }); } return out; },
  // the damage a friendly hit would deal: the same dice and run modifiers as against monsters
  dmgOf(rollFn, o = {}) {
    const P = G.player, m = P.mods, crit = !!o.crit || Math.random() < G.sheet.critChance(P) || P.critNext;
    let d = rollFn ? rollFn(crit) : 0; d *= (1 + m.dmg) * (P.rageT > 0 ? 1.4 : 1); if (o.mul) d *= o.mul;
    return { dmg: Math.max(1, Math.round(d * this.SCALE)), crit };
  },
  send(peer, r, dmg, crit, type, o = {}) {
    const P = G.player, pt = new G.V3(r.pos.x, 1.2, r.pos.z);
    G.net.emit('pvp', { to: peer, d: dmg, c: crit ? 1 : 0, t: String(type || 'slash').slice(0, 12), x: Math.round(P.pos.x * 100) / 100, z: Math.round(P.pos.z * 100) / 100, k: +(o.knock || 0).toFixed(2), st: +(o.stun || 0).toFixed(2), n: (G.settings.name || 'Adventurer').slice(0, 20) });
    G.fx.dmgNumber(pt, dmg, crit, crit ? '#ffcc33' : '#ff8a6a'); G.fx.blood(pt, new G.V3(r.pos.x - P.pos.x, 0.3, r.pos.z - P.pos.z).normalize(), 6, 'red', 0.8);
    G.ui.hitMarker(crit); G.fx.shake(0.1);
  },
  /* ---- attacker side ---- */
  melee(range, arc, rollFn, type, o = {}) {
    let hits = this.dummyMelee(range, arc, rollFn, o); const P = G.player, fy = P.yaw + Math.PI;
    for (const { peer, r } of this.foes()) {
      const dx = r.pos.x - P.pos.x, dz = r.pos.z - P.pos.z, d = Math.hypot(dx, dz) - 0.35;
      if (d > range || (Math.abs(G.angDiff(fy, Math.atan2(dx, dz))) > arc / 2 && d > 0.6)) continue;
      const h = this.dmgOf(rollFn, o); this.send(peer, r, h.dmg, h.crit, type, o); hits++;
    }
    return hits;
  },
  areaHit(x, z, rad, rollFn, type, o = {}) {
    let hits = 0;
    for (const D of this.dummies) if (G.dist2(D.x, D.z, x, z) < (rad + D.r) ** 2) { this.hitDummy(D, rollFn, o); hits++; }
    for (const { peer, r } of this.foes()) if (G.dist2(r.pos.x, r.pos.z, x, z) < (rad + 0.4) ** 2) { const h = this.dmgOf(rollFn, o); this.send(peer, r, h.dmg, h.crit, type, o); hits++; }
    return hits;
  },
  // a projectile I fired: returns true when it struck someone
  projHit(p) {
    const pos = p.m.position; p.pvpHit = p.pvpHit || new Set();
    for (const D of this.dummies) { if (p.pvpHit.has(D)) continue; if (G.dist2(pos.x, pos.z, D.x, D.z) < (D.r + p.r) ** 2 && pos.y < 2.2) { p.pvpHit.add(D); this.hitDummy(D, p.roll ? c => p.roll(c, false) : () => p.dmg); return true; } }
    for (const { peer, r } of this.foes()) { if (p.pvpHit.has(peer)) continue; if (G.dist2(pos.x, pos.z, r.pos.x, r.pos.z) < (0.45 + p.r) ** 2 && pos.y < 2.1) { p.pvpHit.add(peer); const h = this.dmgOf(p.roll ? c => p.roll(c, false) : () => p.dmg); this.send(peer, r, h.dmg, h.crit, p.dtype, { knock: p.knock }); return true; } }
    return false;
  },
  /* ---- victim side ---- */
  receive(d, peer) {
    const P = G.player; if (!P || P.dead || !this.meIn() || !this.inArena(+d.x, +d.z)) return;
    this.lastBy = { peer, name: String(d.n || 'An ally').slice(0, 20), t: G.now() };
    const res = P.takeDamage(G.clamp(+d.d || 0, 0, 150), { x: +d.x, z: +d.z }, { type: d.t === 'fire' ? 'fire' : 'phys', knock: G.clamp(+d.k || 0, 0, 4) * 6, pvp: true });
    if (+d.st > 0 && res !== 'parry' && res !== 'blocked' && res > 0) P.slowT = Math.max(P.slowT, Math.min(1.5, +d.st));
    if (res === 'parry') G.net.emit('pvpp', { to: peer });
  },
  // instead of dying on the sand you are knocked out and stand up at the edge of the arena
  ko() {
    const P = G.player, A = this.area(), by = this.lastBy && G.now() - this.lastBy.t < 8 ? this.lastBy : null;
    G.fx.burst(new G.V3(P.pos.x, 1, P.pos.z), 0xffd070, 40, 5); G.sfx('groan', 0.8); G.fx.shake(0.6);
    const sp = A.spawns[Math.floor(Math.random() * A.spawns.length)]; P.pos.set(sp[0], 0, sp[1]); P.vel.set(0, 0, 0); P.yaw = Math.atan2(-(A.cx - sp[0]), -(A.cz - sp[1]));
    P.hp = P.maxHp; P.sta = P.maxSta; P.mana = P.maxMana; P.dots = []; P.iframes = 2; P.yank = null; P.rootT = 0;
    G.ui.toast(by ? `Knocked out by ${by.name}! Back on your feet at the edge of the ring.` : 'Knocked out! Back on your feet at the edge of the ring.');
    if (by) { G.net.emit('pvpko', { by: by.peer, n: (G.settings.name || 'Adventurer').slice(0, 20) }); this.score[by.name] = this.score[by.name] || 0; }
    this.lastBy = null; this.renderHud();
  },
  onKO(d) { if (d.by !== G.net.myId()) { this.renderHud(); return; } const me = (G.settings.name || 'You').slice(0, 20); this.score[me] = (this.score[me] || 0) + 1; G.ui.toast(`You knocked out ${String(d.n || 'your rival').slice(0, 20)}!`); G.sfx('crit20', 0.8); this.renderHud(); },
  /* ---- training dummies ---- */
  buildDummies(list) {
    this.dummies = list.map(([x, z]) => {
      const g = new THREE.Group(); g.position.set(x, 0, z);
      const wood = G.mat('wood'), straw = G.mat('col', { c: 0xc8a050, r: 1, t: 'cloth' }), sack = G.mat('col', { c: 0x9a7a50, r: 1, t: 'cloth' });
      M.P(g, M.cyl(0.07, 0.09, 1.0, 10), wood, [0, 0.5, 0]); M.P(g, M.cyl(0.4, 0.45, 0.12, 16), wood, [0, 0.06, 0]);
      const body = M.G(g, [0, 1.0, 0]);
      M.P(body, M.cyl(0.24, 0.2, 0.75, 14), sack, [0, 0.35, 0]); M.P(body, M.sph(0.17, 14, 10), sack, [0, 0.9, 0]);
      M.P(body, M.box(0.95, 0.07, 0.07), wood, [0, 0.62, 0]);
      for (let i = 0; i < 3; i++) M.P(body, M.tor(0.235, 0.012, 5, 18), G.mat('darkleather'), [0, 0.08 + i * 0.25, 0], [Math.PI / 2, 0, 0]);
      for (let i = 0; i < 10; i++) M.P(body, M.cone(0.01, 0.12, 4), straw, [Math.cos(i) * 0.2, 0.75, Math.sin(i) * 0.14], [Math.random(), 0, Math.random()]);
      M.P(body, M.cyl(0.08, 0.08, 0.01, 16), G.mat('col', { c: 0xc02020 }), [0, 0.45, 0.21], [Math.PI / 2, 0, 0]);   // target
      const c = document.createElement('canvas'); c.width = 256; c.height = 64; const tex = new THREE.CanvasTexture(c);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })); label.scale.set(1.8, 0.45, 1); label.position.y = 2.45; label.renderOrder = 20; g.add(label);
      G.World.group.add(g); G.World.addSolid(x, z, 0.35);
      const D = { x, z, r: 0.45, g, body, c, tex, hits: [], wob: 0, wv: 0, total: 0 }; this.drawLabel(D); return D;
    });
  },
  drawLabel(D) {
    const x = D.c.getContext('2d'), now = G.now(), recent = D.hits.filter(h => now - h.t < 5), dps = recent.length ? recent.reduce((a, h) => a + h.d, 0) / Math.max(1, Math.min(5, now - recent[0].t + 0.5)) : 0;
    x.clearRect(0, 0, 256, 64); x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(16, 6, 224, 52);
    x.font = '600 22px "Cinzel", Georgia, serif'; x.textAlign = 'center'; x.fillStyle = '#ffd070'; x.fillText(dps ? `DPS ${dps.toFixed(1)}` : 'Training Dummy', 128, 30);
    x.font = '16px Georgia, serif'; x.fillStyle = '#d8ccb8'; x.fillText(D.total ? `last 5 s: ${Math.round(recent.reduce((a, h) => a + h.d, 0))} · total ${Math.round(D.total)}` : 'hit me', 128, 50); D.tex.needsUpdate = true;
  },
  hitDummy(D, rollFn, o = {}) {
    const P = G.player, m = P.mods, crit = Math.random() < G.sheet.critChance(P); let d = rollFn ? rollFn(crit) : 0; d *= (1 + m.dmg) * (P.rageT > 0 ? 1.4 : 1); d = Math.max(1, Math.round(d));
    D.hits.push({ t: G.now(), d }); D.total += d; D.wv += (crit ? 9 : 5) * (Math.random() < 0.5 ? -1 : 1);
    const pt = new G.V3(D.x, 1.5, D.z); G.fx.dmgNumber(pt, d, crit, crit ? '#ffcc33' : '#fff'); G.fx.chunks(pt, 3, 0xc8a050, 0.06); G.sfx('thunk', 0.6, pt); G.ui.hitMarker(crit); this.drawLabel(D);
  },
  dummyMelee(range, arc, rollFn, o) {
    if (!this.dummies.length || !this.meIn()) return 0; const P = G.player, fy = P.yaw + Math.PI; let n = 0;
    for (const D of this.dummies) { const dx = D.x - P.pos.x, dz = D.z - P.pos.z, d = Math.hypot(dx, dz) - D.r; if (d > range || (Math.abs(G.angDiff(fy, Math.atan2(dx, dz))) > arc / 2 && d > 0.5)) continue; this.hitDummy(D, rollFn, o); n++; }
    return n;
  },
  /* ---- per frame ---- */
  update(dt) {
    if (!G.World.arena || G.run.active) { if (this.hud && !this.hud.hidden) this.hud.hidden = true; return; }
    const was = this.inside; this.inside = this.meIn();
    if (this.inside !== was) { G.ui.toast(this.inside ? 'You step onto the sand. Friendly fire is ON: strike your party to spar!' : 'You leave the arena. Friendly fire is off.'); G.sfx(this.inside ? 'roar' : 'click', 0.4); this.renderHud(); }
    for (const D of this.dummies) { D.wv += (-D.wob * 60 - D.wv * 6) * dt; D.wob += D.wv * dt; D.body.rotation.z = D.wob * 0.05; D.body.rotation.x = D.wob * 0.02; if (D.hits.length && (D.lt = (D.lt || 0) - dt) <= 0) { D.lt = 0.5; D.hits = D.hits.filter(h => G.now() - h.t < 5); this.drawLabel(D); } }
  },
  renderHud() {
    if (!this.hud) { this.hud = document.createElement('div'); this.hud.id = 'pvpHud'; document.body.appendChild(this.hud); }
    this.hud.hidden = !this.inside; if (!this.inside) return;
    const rows = Object.entries(this.score).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([n, s]) => `<div><span>${n.replace(/[<>&]/g, '')}</span><b>${s}</b></div>`).join('');
    this.hud.innerHTML = `<h4>⚔ Sparring Ring</h4><p>Friendly fire on · knock-outs, not deaths</p>${rows}`;
  }
};
