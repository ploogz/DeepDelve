/* ============================================================
   Co-op networking over the artifact "room" capability.
   Lobby room: open parties advertise via presence.
   Party room (named): presence = player state, topics = events.
   Host simulates enemies; everyone resolves hits on themselves.
   ============================================================ */
'use strict';
G.net = {
  room: null, party: null, code: null, myPeer: null, peers: [], partyPeers: [], remotes: {}, unsub: [], q: { hit: [], fx: [] }, flushT: 0, presT: 0, hostPeer: null, wantHost: false, jt: 0,
  async init() {
    try { if (window.claude && window.claude.use) this.room = await window.claude.use('room'); } catch (e) { this.room = null; }
    // outside Claude (e.g. GitHub Pages): direct peer-to-peer parties over PeerJS
    if (!this.room && G.p2p && G.p2p.available()) this.room = G.p2p.lobby();
    if (!this.room) { G.ui.netStatus(false); return; }
    G.ui.netStatus(true);
    this.room.onPeers(ch => { this.peers = ch.peers; ch.peers.forEach(p => { if (p.sameTab) this.myPeer = this.myPeer || p.peer; }); G.ui.refreshLobby && G.ui.refreshLobby(); }, err => { this.room = null; G.ui.netStatus(false); });
    this.room.presence({ v: 'dd1', n: G.settings.name || 'Adventurer' }).catch(() => { });
  },
  available() { return !!this.room; },
  myId() { return this.party ? (this.myPeer || 'me') : 'me'; },
  openParties() {
    if (this.isP2P()) return [];   // peer-to-peer parties are private: join by Room ID
    return this.peers.filter(p => p.presence && p.presence.v === 'dd1' && typeof p.presence.pc === 'string' && !p.sameTab).map(p => ({ code: String(p.presence.pc).slice(0, 6), name: String(p.presence.pn || 'Adventurer').slice(0, 20), members: Math.min(4, +p.presence.pm || 1), inRun: !!p.presence.pr }));
  },
  isP2P() { return !!(this.room && this.room.p2p); },
  async createParty() {
    const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', len = this.isP2P() ? 6 : 4;
    for (let tries = 0; tries < 4; tries++) {
      let c = ''; for (let i = 0; i < len; i++) c += A[Math.floor(Math.random() * A.length)];
      this.wantHost = true;
      try { return await this.joinParty(c); } catch (e) { if (String(e && e.message) !== 'id-taken') throw e; }   // Room ID already in use somewhere: roll another
    }
    throw new Error('Could not create a room');
  },
  async joinParty(code) {
    if (!this.room) throw new Error('offline');
    code = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); if (code.length < 3) throw new Error('bad code');
    const host = this.wantHost; await this.leaveParty(); this.wantHost = host;
    const pr = await this.room.join('dd-' + code.toLowerCase(), { host: host });
    this.party = pr; this.code = code; this.jt = Date.now();
    const on = (t, f) => this.unsub.push(pr.on(t, m => { try { f(m.data || {}, m); } catch (e) { console.warn(e); } }));
    this.unsub.push(pr.onPeers(ch => { this.partyPeers = ch.peers; ch.peers.forEach(p => { if (p.sameTab) this.myPeer = p.peer; }); ch.left.forEach(p => this.dropRemote(p.peer)); this.computeHost(); G.ui.refreshParty && G.ui.refreshParty(); }, (err) => { G.ui.toast(err && err.message ? err.message : 'Lost connection to the party'); this.leaveParty().then(() => G.ui.refreshParty && G.ui.refreshParty()); }));
    on('start', (d, m) => { if (!m.sameTab) G.game.netStart(d); });
    on('floor', (d, m) => { if (!m.sameTab) G.game.netFloor(d); });
    on('end', (d, m) => { if (!m.sameTab) G.game.netEnd(d); });
    on('es', (d, m) => { if (!this.isHost() && !m.sameTab && !G.loading && G.run.active && d.r === G.run.id && d.f === G.run.step && Array.isArray(d.a)) G.enemies.applySnapshot(d.a.map(Number)); });
    on('eatk', (d, m) => { if (m.sameTab || G.loading || !G.run.active || d.r !== G.run.id) return; G.enemies.beginAttack(G.enemies.map[d.i], d.a | 0, +d.x, +d.z, d.s | 0, typeof d.g === 'string' ? d.g : null); });
    on('hit', (d, m) => { if (m.sameTab || !G.run.active || !Array.isArray(d.h)) return; d.h.slice(0, 80).forEach(h => this.onHitMsg(h, m.peer)); });
    on('kill', (d, m) => { if (m.sameTab || !G.run.active || d.r !== G.run.id) return; this.onKill(d); });
    on('sup', (d, m) => { if (!m.sameTab) this.onSup(d, m.peer); });
    on('pvp', (d, m) => { if (!m.sameTab && d.to === this.myId()) G.pvp.receive(d, m.peer); });
    on('chat', (d, m) => { if (!m.sameTab && G.chat) G.chat.receive(d, m.peer); });
    on('pvpko', (d, m) => { if (!m.sameTab) G.pvp.onKO(d); });
    on('pvpp', (d, m) => { if (!m.sameTab && d.to === this.myId() && G.player) { G.player.slowT = Math.max(G.player.slowT, 1); G.player.atkCD = Math.max(G.player.atkCD, 0.6); G.ui.toast('Parried!'); G.sfx('parry', 0.8); } });
    on('fx', (d, m) => { if (m.sameTab || !Array.isArray(d.f)) return; d.f.slice(0, 30).forEach(f => this.onFx(f, m.peer)); });
    this.pushPresence(true);
    this.advertise();
    return code;
  },
  async leaveParty() {
    this.unsub.forEach(u => { try { u(); } catch (e) { } }); this.unsub = [];
    if (this.party) { try { await this.party.leave(); } catch (e) { } }
    this.party = null; this.code = null; this.partyPeers = []; this.wantHost = false; this.hostPeer = null;
    Object.keys(this.remotes).forEach(k => this.dropRemote(k));
    if (this.room) this.room.presence({ pc: null, pn: null, pm: null, pr: null }).catch(() => { });
  },
  advertise() {
    if (!this.room) return;
    if (this.party && this.isHost()) this.room.presence({ v: 'dd1', pc: this.code, pn: G.settings.name || 'Adventurer', pm: this.members().length, pr: G.run.active ? 1 : 0 }).catch(() => { });
    else this.room.presence({ pc: null, pn: null, pm: null, pr: null }).catch(() => { });
  },
  members() { return this.partyPeers.filter(p => p.presence && p.presence.v === 'dd1'); },
  computeHost() {
    const ms = this.members(); if (!this.party) { this.hostPeer = null; return; }
    const flagged = ms.filter(p => p.presence.h === 1).sort((a, b) => (a.presence.jt || 0) - (b.presence.jt || 0));
    let h = flagged[0] || ms.slice().sort((a, b) => (a.presence.jt || 0) - (b.presence.jt || 0) || (a.peer < b.peer ? -1 : 1))[0];
    const was = this.hostPeer; this.hostPeer = h ? h.peer : this.myPeer;
    if (this.hostPeer === this.myPeer && !this.wantHost) { this.wantHost = true; this.pushPresence(true); }
    if (was && was !== this.hostPeer && this.hostPeer === this.myPeer && G.run.active) G.ui.toast('You are now the party leader');
    this.advertise();
  },
  isHost() { return !this.party || !this.hostPeer || this.hostPeer === this.myPeer; },
  partySize() { return G.run.np || 1; },
  inMyScene(p) { return p.presence && p.presence.s === G.game.sceneId(); },
  allPlayers() {
    const out = []; const P = G.player;
    if (P && G.state === 'play') out.push({ x: P.pos.x, z: P.pos.z, vx: P.vel.x, vz: P.vel.z, dead: P.dead, downed: P.downed, me: true, peer: this.myId() });
    if (this.party) for (const p of this.members()) { if (p.sameTab || !this.inMyScene(p)) continue; const r = this.remotes[p.peer]; const pr = p.presence; out.push({ x: r ? r.pos.x : +pr.x || 0, z: r ? r.pos.z : +pr.z || 0, vx: r ? r.vx || 0 : 0, vz: r ? r.vz || 0 : 0, dead: !!pr.dd, downed: !!pr.d, peer: p.peer }); }
    return out;
  },
  aliveTeammates() { if (!this.party) return 0; return this.members().filter(p => !p.sameTab && this.inMyScene(p) && !p.presence.d && !p.presence.dd).length; },
  runMembers() { return this.members().filter(p => this.inMyScene(p)); },

  /* ---------------- presence (my player state) ---------------- */
  pushPresence(force) {
    if (!this.party) return; const P = G.player;
    const pr = { v: 'dd1', n: (G.settings.name || 'Adventurer').slice(0, 20), c: G.cls, w: G.save.cls[G.cls].wpn, wi: G.save.cls[G.cls].arm | 0, s: G.game.sceneId(), jt: this.jt, h: this.wantHost ? 1 : 0, rd: G.ui.ready ? 1 : 0 };
    if (P && G.state === 'play') Object.assign(pr, { x: Math.round(P.pos.x * 100) / 100, z: Math.round(P.pos.z * 100) / 100, y: Math.round(P.y * 100) / 100, r: Math.round(P.yaw * 100) / 100, p: Math.round(P.pitch * 100) / 100, m: Math.round(Math.hypot(P.vel.x, P.vel.z) * 10) / 10, ac: P.attackCounter, ak: P.atkKind, ax: P.atkExact || '', ad: Math.round((P.atkDur || 0.5) * 100), ah: Math.round((P.atkHit || 0.45) * 100), cs: P.cast ? Math.round(P.cast.t / P.cast.dur * 100) / 100 : -1, ch: Math.round(Math.max(P.charge, P.volleyDraw ?? -1) * 100) / 100, vm: P.volley && !P.volley.fired ? Math.min(7, P.volley.n) : 0, b: P.blocking ? 1 : 0, hp: Math.round(P.hp), mh: Math.round(P.maxHp), d: P.downed ? 1 : 0, dd: P.dead ? 1 : 0, rg: P.rageT > 0 ? 1 : 0, lv: P.level, ds: P.ds ? P.ds.s : 0, df: P.ds ? P.ds.f : 0, st: P.ds && P.ds.stable ? 1 : 0, bd: G.game.bossReady && G.run.active ? G.run.step : -1, pd: G.game.portalReady && G.run.active ? G.run.step : -1, em: P.emote ? P.emote.id : (P.actEm || 0), dk: G.tavern ? Math.round(G.tavern.drunk * 10) / 10 : 0 });
    pr.sit = G.fp && G.fp.seated ? 1 : 0;
    if (G.run.active && G.RunMap.isOpen() && G.RunMap.myVote != null) pr.mv = G.run.row + ':' + G.RunMap.myVote; else pr.mv = null;
    this.party.presence(pr).catch(() => { });
  },

  /* ---------------- sending ---------------- */
  emit(topic, data) { if (this.party) this.party.emit(topic, data).catch(() => { }); },
  enemyAttack(e, ai, tx, tz, seed, tg) { G.enemies.beginAttack(e, ai, tx, tz, seed, tg); this.emit('eatk', { r: G.run.id, i: e.id, a: ai, x: Math.round(tx * 10) / 10, z: Math.round(tz * 10) / 10, s: seed, g: tg || null }); },
  sendSnapshot() {
    if (!this.party || !G.run.active) return; const a = [];
    for (const e of G.enemies.list) { if (e.dead || !e.awake) continue; a.push(e.id, G.ALL_TYPES.indexOf(e.type), Math.round(e.pos.x * 10), Math.round(e.pos.z * 10), Math.round(e.rot * 100), Math.round(e.hp), e.flags); if (a.length > 7 * 60) break; }
    this.emit('es', { r: G.run.id, f: G.run.step, a });
  },
  sendHit(e, dmg, type, crit, point, st, ok) {
    if (this.isHost()) this.applyHit(e, dmg, type, st, this.myId(), ok);
    else { e.hp -= dmg; }
    if (this.party) this.q.hit.push([e.id, Math.round(dmg), type, crit ? 1 : 0, point ? [Math.round(point.x * 10), Math.round(point.y * 10), Math.round(point.z * 10)] : 0, st && Object.keys(st).length ? st : 0, ok ? 1 : 0]);
  },
  sendFx(f) { if (this.party) this.q.fx.push(f); },
  sendSup(d) { this.emit('sup', d); if (d.k === 'ehe' && this.isHost()) this.onSup(d, this.myPeer); },
  flush() {
    if (!this.party) { this.q.hit.length = this.q.fx.length = 0; return; }
    if (this.q.hit.length) { this.emit('hit', { h: this.q.hit.splice(0, 50) }); }
    if (this.q.fx.length) { this.emit('fx', { f: this.q.fx.splice(0, 20) }); }
  },
  update(dt) {
    this.flushT -= dt; if (this.flushT <= 0) { this.flushT = 0.066; this.flush(); }
    this.presT -= dt; if (this.presT <= 0) { this.presT = 0.05; this.pushPresence(); }
    if (this.party) this.updateRemotes(dt);
    // host: check party wipe
    if (this.party && this.isHost() && G.run.active && G.state === 'play') {
      this.wipeT = (this.wipeT || 0) - dt;
      if (this.wipeT <= 0) { this.wipeT = 1; const all = this.allPlayers(); if (all.length && all.every(p => p.dead)) G.game.endRun(false, 'Your party has fallen.'); }
    }
  },

  /* ---------------- receiving ---------------- */
  onHitMsg(h, peer) {
    if (!Array.isArray(h)) return; const e = G.enemies.map[h[0] | 0]; if (!e || e.dead) return;
    const dmg = Math.max(0, Math.min(5000, +h[1] || 0)), type = String(h[2]).slice(0, 10), crit = !!h[3], pt = Array.isArray(h[4]) ? new G.V3(h[4][0] / 10, h[4][1] / 10, h[4][2] / 10) : null, st = h[5] && typeof h[5] === 'object' ? h[5] : null;
    if (dmg > 0) { const from = this.remotes[peer]; G.enemies.hitFx(e, dmg, type, pt, from ? new G.V3(e.pos.x - from.pos.x, 0, e.pos.z - from.pos.z).normalize() : null, crit); }
    if (st && st.fz) G.fx.iceBlock(e);
    if (this.isHost()) this.applyHit(e, dmg, type, st, peer, !!h[6]);
  },
  applyHit(e, dmg, type, st, by, ok) {
    if (!e || e.dead) return;
    if (e.shield > 0 && dmg > 0) { const ab = Math.min(e.shield, dmg); e.shield -= ab; dmg -= ab; if (e.shield <= 0) { G.fx.burst(new G.V3(e.pos.x, e.def.h * 0.6, e.pos.z), 0x5ab0ff, 30, 4); G.sfx('ice', 0.8, e.pos); } }
    e.hp -= dmg; e.lastHitBy = by; e.lastHitType = type; if (!e.awake) G.enemies.wake(e);
    if (st) {
      if (st.b) { e.burnT = 4; e.burnDps = Math.min(20, +st.b); }
      if (st.fz) e.frozenT = Math.max(e.frozenT, e.boss ? 0.6 : Math.min(4, +st.fz));
      if (st.st) e.stunT = Math.max(e.stunT, e.boss ? Math.min(1, +st.st * 0.4) : Math.min(3, +st.st));
      if (st.sl) e.slowT = Math.max(e.slowT, Math.min(4, +st.sl));
      if (st.bl) { e.bleedT = 3; e.bleedDps = Math.min(40, +st.bl); }
      if (e.stunT > 0 && e.atk) { e.atk.spots.forEach(s => { if (G.fx.tele.includes(s.tg)) { G.scene.remove(s.tg.g); G.fx.tele.splice(G.fx.tele.indexOf(s.tg), 1); } }); e.atk.fx.forEach(f => G.scene.remove(f.m)); e.atk = null; }
    }
    if (e.hp <= 0) this.killEnemy(e, type, ok, by);
  },
  killEnemy(e, type, ok, by) {
    if (e.dead || !this.isHost()) return;
    const d = { r: G.run.id, i: e.id, k: type === 'stun' ? 'blunt' : type || 'slash', o: ok ? 1 : 0, by: by || e.lastHitBy || this.myId() };
    if (d.k === 'slash' && e.lastHitType && e.lastHitType !== 'slash' && type === 'slash' && e.bleedT > 0) d.k = 'slash';
    this.onKill(d); this.emit('kill', d);
  },
  onKill(d) {
    const e = G.enemies.map[d.i | 0]; (G.enemies.deadIds || (G.enemies.deadIds = new Set())).add(d.i | 0);
    if (!e || e.dead) return;
    const from = d.by === this.myId() && G.player ? G.player.pos : this.remotes[d.by] ? this.remotes[d.by].pos : null;
    G.enemies.kill(e, String(d.k), { overkill: !!d.o, from });
    G.game.onEnemyKilled(e, d.by === this.myId(), String(d.k));
  },
  onSup(d, peer) {
    const P = G.player; if (!P) return;
    if (d.k === 'heal' && G.state === 'play' && G.dist2(P.pos.x, P.pos.z, +d.x, +d.z) < (+d.r || 8) ** 2) { P.heal(Math.min(200, +d.amt || 0), !!d.quiet, (this.members().find(m => m.peer === peer) || { presence: {} }).presence.n || 'An ally'); if (d.cl) P.dots = []; }
    if (d.k === 'ehe' && this.isHost() && G.run.active) { const e = G.enemies.map[d.i | 0]; if (e && !e.dead) { e.hp = Math.min(e.maxHp, e.hp + Math.min(100, +d.amt || 0)); G.fx.emit(G.fx.add, e.pos.x, e.def.h * 0.6, e.pos.z, 0, 1.5, 0, 0.6, 0.3, 0, [1.4, 0.1, 0.2, 1], [0.4, 0, 0, 0]); } }
    if (d.k === 'ward' && G.state === 'play' && !P.dead && G.dist2(P.pos.x, P.pos.z, +d.x, +d.z) < (+d.r || 8) ** 2) P.addWard(G.clamp(+d.amt || 0, 0, 120), 8);
    if (d.k === 'revive' && d.to === this.myPeer) P.revive();
    if (d.k === 'dsave' && d.to === this.myPeer && P.downed && P.ds) { const by = String(d.by || 'An ally').slice(0, 20);
      if (d.ok) P.revive(d.pr ? 0.4 : 0.25, by);
      else { P.ds.f += (+d.nat === 1 ? 2 : 1); G.ui.checkChip({ title: `${by} failed to stabilize you`, ok: false, icon: '✖', line: `Death save failures: ${Math.min(3, P.ds.f)} of 3` }); if (P.ds.f >= 3) P.die(); } }
    if (d.k === 'resurrect' && d.to === this.myPeer) G.game.resurrect(d);
  },
  onFx(f, peer) {
    if (!f || typeof f !== 'object') return; const r = this.remotes[peer]; const V = (a) => Array.isArray(a) ? new G.V3(+a[0] || 0, +a[1] || 0, +a[2] || 0) : new G.V3();
    switch (f.k) {
      case 'proj': G.proj.spawn({ kind: f.pk === 'arrow' ? 'parrow' : String(f.pk), pos: V(f.p), dir: V(f.d), speed: Math.min(100, +f.s || 30), owner: 'remote', dmg: 0, life: 2.5 }); G.sfx(f.pk === 'firebolt' ? 'fire' : 'arrow', 0.4, V(f.p)); break;
      case 'bolt': G.fx.lightning(V(f.a), V(f.b), 0x9ad0ff); break;
      case 'bash': G.fx.shockwave(new G.V3(+f.x, 0, +f.z), 3, 0x9ab8ff); G.sfx('clang', 0.6, new G.V3(+f.x, 0, +f.z)); break;
      case 'charge': G.fx.shockwave(new G.V3(+f.x, 0, +f.z), 3, 0x9ab8ff); break;
      case 'rage': G.fx.burst(new G.V3(+f.x, 1, +f.z), 0xff2a10, 40, 5); G.sfx('roar', 0.5, new G.V3(+f.x, 0, +f.z)); break;
      case 'slam': G.enemies.aoeFx('slam', new G.V3(+f.x, 0.2, +f.z), 4.5, null); break;
      case 'shadow': G.fx.smoke(new G.V3(+f.x, 0.8, +f.z), 8, 0x1a1028, 1.8); G.fx.smoke(new G.V3(+f.x2, 0.8, +f.z2), 8, 0x1a1028, 1.8); break;
      case 'knives': for (let k = 0; k < Math.min(30, +f.n || 12); k++) { const a = k / (+f.n || 12) * Math.PI * 2; G.proj.spawn({ kind: 'knife', pos: new G.V3(+f.x, 1.1, +f.z), dir: new G.V3(Math.sin(a), 0, Math.cos(a)), speed: 26, owner: 'remote', dmg: 0, life: 0.8 }); } break;
      case 'nova': G.enemies.aoeFx('frost', new G.V3(+f.x, 0.3, +f.z), 6, null); break;
      case 'q': G.Quests.onNet(f, peer); break;
      case 'yank': { const e = G.enemies.map[f.id | 0]; if (e && r && !e.dead) { const st = ['chain', 'spectral', 'hell', 'silk', 'void'].includes(f.s) ? f.s : 'chain'; G.fx.tether({ from: v => G.enemies.anchor(e, v), to: v => v.set(r.pos.x, 1.1, r.pos.z), style: st, dur: G.clamp(+f.d || 1, 0.2, 2) + 0.4, alive: () => !e.dead && !!this.remotes[peer] }); G.sfx('chainrattle', 0.6, r.pos); } break; }
      case 'hz': G.fx.healZone(+f.x, +f.z, G.clamp(+f.r || 2, 0.5, 20), G.clamp(+f.d || 1.1, 0.3, 12)); break;
      case 'meteor': G.fx.meteor(+f.x, +f.z, 0.85, null); break;
      case 'wardfx': G.fx.shockwave(new G.V3(+f.x, 0, +f.z), 8, 0xffd070, 0.5); G.fx.holy(new G.V3(+f.x, 0.2, +f.z), 30, 1); break;
      case 'radiant': { const a = +f.a || 0, x = +f.x, z = +f.z; for (let k = 0; k < 50; k++) { const b = a + (Math.random() - 0.5) * 1.2, sp = 10 + Math.random() * 8; G.fx.emit(G.fx.add, x + Math.sin(a) * 0.6, 1.3, z + Math.cos(a) * 0.6, Math.sin(b) * sp, (Math.random() - 0.4) * 2, Math.cos(b) * sp, 0.45, 0.35, 0.05, [2, 1.8, 1.1, 1], [1, 0.7, 0.2, 0]); } G.sfx('holy', 0.7, new G.V3(x, 0, z)); break; }
      case 'sg': if (r) G.fx.orbiters(() => this.remotes[peer] ? this.remotes[peer].pos : null, 3, 0xfff0b0, G.clamp(+f.d || 10, 1, 12), 2.6); break;
      case 'holylight': G.fx.healZone(+f.x, +f.z, G.clamp(+f.r || 9, 1, 20), 1.3); G.fx.holy(new G.V3(+f.x, 0.1, +f.z), 60, 4); G.fx.beam(new G.V3(+f.x, 0, +f.z), 0xffe08a, 10, 1, 0.6); G.sfx('holy', 0.7, new G.V3(+f.x, 0, +f.z)); break;
      case 'smite': G.fx.beam(new G.V3(+f.x, 0, +f.z), 0xfff0b0, 16, 1.6, 0.9); G.fx.holy(new G.V3(+f.x, 0.1, +f.z), 40, 2); G.sfx('holy', 0.7, new G.V3(+f.x, 0, +f.z)); break;
      case 'tempest': G.fx.shockwave(new G.V3(+f.x, 0, +f.z), 4.5, 0xd0e8ff, 0.4); break;
      case 'meteor': G.enemies.aoeFx('meteor', new G.V3(+f.x, 0.3, +f.z), 3, null); break;
      case 'brk': { const b = G.World.breakables && G.World.breakables[f.i | 0]; const r = this.remotes[peer]; if (b) G.game.breakObj(b, false, r ? r.pos : null); break; }
      case 'chest': { const c = G.World.chests && G.World.chests[f.i | 0]; if (c && !c.mesh.userData.opening && !c.mimic) G.game.animateChest(c); break; }
      case 'pz': { const p = G.Puzzles.list[f.i | 0]; if (p && G.run.active && !G.loading) G.Puzzles.act(p, String(f.a), f.v | 0, false); break; }
      case 'shrine': { const sh = (G.World.shrines || [])[f.i | 0]; if (sh && !sh.used) { sh.used = true; G.World.shrineUsed(sh, false); } break; }
      case 'gate': if (G.run.active && !G.loading) G.World.openGate(f.i | 0, false, !!f.sk); break;
      case 'trap': { const t = (G.World.traps || [])[f.i | 0]; if (t) { if (f.d) { t.armed = false; } else G.game.triggerTrap(t, false); } break; }
      case 'tf': { const t = (G.World.traps || [])[f.i | 0]; if (t) t.found = true; break; }
      case 'gn': { const g = G.World.gateById(f.i | 0); if (g) g.noticed = true; break; }
      case 'ms': { const c = (G.World.chests || [])[f.i | 0]; if (c) c.seen = true; break; }
      case 'mimic': { const c = (G.World.chests || [])[f.i | 0]; if (c && G.run.active && !G.loading) G.game.mimicWake(c, true, true); break; }
      case 'ped': { const p = (G.World.pedestals || [])[f.i | 0]; if (p && !p.taken) G.game.takePedestal(p, false); break; }
      case 'keyget': G.run.keys++; if (f.rm) for (let i = G.pickups.length - 1; i >= 0; i--) if (G.pickups[i].kind === 'key') { G.scene.remove(G.pickups[i].m); G.pickups.splice(i, 1); } G.ui.toast(`${(this.members().find(p => p.peer === peer) || { presence: {} }).presence.n || 'An ally'} found a vault key`); break;
      case 'amb': if (Array.isArray(f.l) && G.run.active && !G.loading) G.game.spawnAmbush(f.l); break;
      case 'parley': { const e = G.enemies.map[f.i | 0]; if (e) G.game.parleyOutcome(e, f.o === 'flee' ? 'flee' : 'fight', false); break; }
    }
  },

  /* ---------------- remote avatars ---------------- */
  dropRemote(peer) { const r = this.remotes[peer]; if (!r) return; if (r.root.parent) r.root.parent.remove(r.root); delete this.remotes[peer]; },
  nameplate(name, cls) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
    x.font = '600 26px "Cinzel", Georgia, serif'; x.textAlign = 'center'; x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(28, 6, 200, 36); x.fillStyle = G.CLASS_INFO[cls] ? G.CLASS_INFO[cls].color : '#fff'; x.fillText(name.slice(0, 16), 128, 33);
    const t = new THREE.CanvasTexture(c); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); s.scale.set(1.6, 0.4, 1); s.renderOrder = 20; return s;
  },
  updateRemotes(dt) {
    const scene = G.game.sceneId(), t = G.now();
    for (const p of this.members()) {
      if (p.sameTab) continue; const pr = p.presence; let r = this.remotes[p.peer];
      const visible = pr.s === scene && G.state === 'play' && typeof pr.x === 'number' && !(G.cine.active && !G.cine.showRemotes);
      if (!visible) { if (r) r.root.visible = false; continue; }
      const cls = G.CLASSES.includes(pr.c) ? pr.c : 'knight', w = G.clamp(pr.w | 0, 0, 4), wi = G.clamp(pr.wi | 0, 0, (G.ARSENAL[cls] || [0]).length - 1);
      if (!r || r.cls !== cls || r.w !== w || r.wi !== wi) {
        if (r) this.dropRemote(p.peer);
        const R = M.hero(cls, w, wi); M.batchRig(R); const root = new THREE.Group(); root.add(R.root);
        const np = this.nameplate(String(pr.n || 'Adventurer'), cls); np.position.y = 2.35; root.add(np);
        const hb = new THREE.Group(); const bg = new THREE.Mesh(G.fx._dg || (G.fx._dg = new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthTest: false })); bg.scale.set(1.0, 0.08, 1); const fg = new THREE.Mesh(G.fx._dg, new THREE.MeshBasicMaterial({ color: 0x40d060, depthTest: false })); fg.scale.set(0.96, 0.05, 1); fg.position.z = 0.001; hb.add(bg); hb.add(fg); hb.position.y = 2.12; bg.renderOrder = fg.renderOrder = 20; root.add(hb);
        const sh = new THREE.Mesh(G.fx._dg, new THREE.MeshBasicMaterial({ map: G.tex.sprite('shadow'), transparent: true, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.03; sh.renderOrder = 0.8; sh.scale.setScalar(1.4); root.add(sh);
        const ring = new THREE.Mesh(G.fx._dg, new THREE.MeshBasicMaterial({ map: G.tex.sprite('ring'), color: 0x40ff80, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; ring.scale.setScalar(5); ring.visible = false; root.add(ring);
        r = this.remotes[p.peer] = { R, root, cls, w, wi, pos: new G.V3(+pr.x, 0, +pr.z), yaw: +pr.r || 0, st: { t: 0, move: 0, phase: 0, atk: -1 }, lastAc: pr.ac, atkT: -1, hb: fg, ring, light: null };
        G.scene.add(root);
      }
      r.root.visible = true;
      // interpolate presence samples ~0.1 s in the past, then a light damp hides delivery jitter
      G.netBuf.push(r.nb || (r.nb = []), +pr.x, +pr.z, +pr.r || 0, true);
      if (Math.hypot(+pr.x - r.pos.x, +pr.z - r.pos.z) > 8) { r.pos.set(+pr.x, 0, +pr.z); r.yaw = +pr.r || 0; r.nb.length = 0; G.netBuf.push(r.nb, +pr.x, +pr.z, r.yaw); }
      const smp = G.netBuf.sample(r.nb, 0.1, r._smp || (r._smp = {}));
      { const ox = r.pos.x, oz = r.pos.z; r.pos.x = G.damp(r.pos.x, smp.x, 22, dt); r.pos.z = G.damp(r.pos.z, smp.z, 22, dt); const id = 1 / Math.max(dt, 1e-3); r.vx = G.damp(r.vx || 0, (r.pos.x - ox) * id, 8, dt); r.vz = G.damp(r.vz || 0, (r.pos.z - oz) * id, 8, dt); } r.yaw = G.dampAng(r.yaw, smp.r, 18, dt);
      r.vy = G.damp(r.vy || 0, +pr.y || 0, 20, dt);
      r.pos.y = G.World.fy(r.pos.x, r.pos.z); r.root.position.set(r.pos.x, r.pos.y + r.vy, r.pos.z); r.R.root.rotation.y = r.yaw + Math.PI;
      r.st.t += dt; r.st.move = G.damp(r.st.move, G.clamp((+pr.m || 0) / 5, 0, 1.5), 10, dt);
      { const ty = r._py === undefined ? r.yaw : r._py; const tr = Math.abs(G.angDiff(ty, r.yaw)) / Math.max(dt, 1e-3); r._py = r.yaw; r.st.turn = G.damp(r.st.turn || 0, r.st.move < 0.3 ? G.clamp(tr * 0.16, 0, 0.45) : 0, 10, dt); if (r.st.move < 0.3) r.st.phase += dt * r.st.turn * 9; } r.st.phase += dt * r.st.move * 9; { const sp = Math.floor(r.st.phase / Math.PI); if (sp !== r.stepN) { r.stepN = sp; if (r.st.move > 0.25 && !(+pr.y > 0.1)) G.sfx('step', 0.55, r.pos); } }
      if (cls === 'archer') {
        if (pr.ac !== r.lastAc && pr.ak === 'shoot') { r.lastAc = pr.ac; r.relT = 0; }
        r.st.multi = +pr.vm || 0;
        if (+pr.ch >= 0) { r.st.atkKind = 'shoot'; r.st.draw = +pr.ch; r.st.after = 0; r.relT = -1; }
        else if (r.relT >= 0) { r.relT += dt; r.st.atkKind = 'shoot'; r.st.draw = 0; r.st.after = Math.min(1, r.relT / 0.6); if (r.relT > 0.6) { r.relT = -1; r.st.draw = undefined; r.st.after = 0; } }
        else r.st.draw = undefined;
        r.lastAc = pr.ac;
      }
      if (pr.ac !== r.lastAc) { r.lastAc = pr.ac; r.atkT = 0; r.atkDur = G.clamp((+pr.ad || 55) / 100, 0.15, 2); r.st.atkKind = { slash: 'slash', overhead: 'overhead', thrust: 'thrust', cast: 'cast', shoot: 'shoot' }[pr.ak] || 'slash'; r.st.move2 = typeof pr.ax === 'string' && G.anim.isMove(pr.ax) ? pr.ax : null; r.st.hitAt = (+pr.ah || 45) / 100; }
      if (r.atkT >= 0) { r.atkT += dt / (r.atkDur || 0.55); r.st.atk = r.atkT; if (r.atkT > 1) { r.atkT = -1; r.st.atk = -1; r.st.move2 = null; } }
      r.st.pitch = +pr.p || 0; r.st.cast = typeof pr.cs === 'number' ? pr.cs : -1;
      r.st.block = !!pr.b; r.st.crouch = 0;
      { const em = typeof pr.em === 'string' && G.emotes.byId(pr.em) ? pr.em : 0; if (em !== (r.emId || 0)) { r.emId = em; r.st.emote = em ? { id: em, t: 0 } : null; G.emotes.dress(r.R, em); } if (r.st.emote) r.st.emote.t += dt; }
      M.animHum(r.R, r.st);
      if (+pr.dk > 0.7 && G.tavern) G.tavern.swayRig(r, +pr.dk, dt);
      // going down / getting back up: a knee-buckle then a fall, eased both ways
      r.downK = G.damp(r.downK || 0, pr.d || pr.dd ? 1 : 0, pr.d || pr.dd ? 4.5 : 3, dt);
      { const dk = r.downK, fall = G.smooth(G.clamp((dk - 0.15) / 0.85, 0, 1)), buckle = Math.sin(Math.min(1, dk * 1.6) * Math.PI) * (1 - fall);
        r.R.root.rotation.x = -Math.PI / 2 * 0.9 * fall; r.R.root.position.y = 0.25 * fall - 0.18 * buckle;
        if (dk > 0.01) { r.R.legL.kn.rotation.x += buckle * 1.1; r.R.legR.kn.rotation.x += buckle * 0.9; r.R.legL.hip.rotation.x -= buckle * 0.5; r.R.legR.hip.rotation.x -= buckle * 0.4; r.R.torso.rotation.x += buckle * 0.35; r.R.neck.rotation.z += fall * 0.35; } }
      r.ring.visible = !!pr.d; if (pr.d) r.ring.rotation.z += dt;
      const hpk = G.clamp((+pr.hp || 0) / Math.max(1, +pr.mh || 1), 0, 1); r.hb.scale.x = 0.96 * hpk; r.hb.position.x = -(0.96 - r.hb.scale.x) / 2; r.root.getWorldQuaternion(G.tmpQ); r.hb.parent.quaternion.copy(G.tmpQ.invert().multiply(G.camera.quaternion));
      if (pr.rg && Math.random() < 0.3) G.fx.emit(G.fx.add, r.pos.x + (Math.random() - 0.5), 0.3 + Math.random() * 1.5, r.pos.z + (Math.random() - 0.5), 0, 1, 0, 0.6, 0.2, 0, [1.8, 0.2, 0.1, 1], [0.6, 0, 0, 0]);
    }
  }
};
