/* ============================================================
   Wandering souls with something to ask of you. One or two per floor:
   - Guide: "Follow me" - they lead the party through the floor to a hidden passage and open it.
   - Heirloom: they lost something on this floor; find it (they tell you roughly where) and bring it back.
   - Prisoner: someone caged in a guarded room; clear the room, break the lock, and they reward you.
   The player who starts a guide quest steers the guide; everyone else sees its position over the network.
   ============================================================ */
'use strict';
G.Quests = {
  list: [],
  WHO: {
    crypt: [['Ser Aldric\'s Shade', 'Restless Knight', 'ghost'], ['Brother Tobin', 'Lost Novice', 'monk'], ['Old Merrit', 'Gravedigger', 'thrall']],
    warrens: [['Snik', 'Goblin Turncoat', 'goblin'], ['Ysolde', 'Spore-Blind Herbalist', 'monk'], ['Hob', 'Cave Scout', 'goblin']],
    abyss: [['Brother Ilvane', 'Lapsed Cultist', 'monk'], ['Ser Aldric\'s Shade', 'Restless Knight', 'ghost'], ['Wren', 'Lost Pilgrim', 'thrall']],
    forge: [['Brannoc', 'Escaped Thrall', 'thrall'], ['Ember-Eyes', 'Runaway Imp', 'imp'], ['Kessa', 'Forge Slave', 'thrall']]
  },
  ITEMS: [['locket', 'silver locket'], ['ring', 'signet ring'], ['book', 'prayer book'], ['idol', 'little bone idol']],
  // ---- generation (deterministic, called from World.generate with the floor's rng) ----
  gen(r, kind, rooms, gates, CS, theme) {
    const qs = []; if (kind !== 'combat' && kind !== 'elite') return qs;
    const normals = rooms.map((o, i) => Object.assign({ idx: i }, o)).filter(o => o.type === 'normal' && o.w >= 3 && o.h >= 3 && !o.shape && !o.pit && !o.sunk), start = rooms[0];
    const who = () => G.pick(this.WHO[theme] || this.WHO.crypt, r), roll = r();
    const secret = gates.find(g => g.type === 'secret');
    if (secret && roll < 0.6) { const w = who(); qs.push({ id: qs.length, kind: 'guide', gate: secret.id, x: (start.x + 1.0) * CS, z: (start.y + start.h - 1.0) * CS, name: w[0], role: w[1], look: w[2] }); }
    else if (roll < 0.9 && normals.length) {
      const far = normals.slice().sort((a, b) => Math.hypot(b.cx - start.cx, b.cy - start.cy) - Math.hypot(a.cx - start.cx, a.cy - start.cy)).slice(0, Math.max(1, Math.ceil(normals.length / 2)));
      const o = G.pick(far, r), it = G.pick(this.ITEMS, r), w = who();
      qs.push({ id: qs.length, kind: 'fetch', x: (start.x + start.w - 1.0) * CS, z: (start.y + 1.0) * CS, ix: (o.x + 0.6 + r() * (o.w - 1.2)) * CS, iz: (o.y + 0.6 + r() * (o.h - 1.2)) * CS, item: it[0], itemName: it[1], name: w[0], role: w[1], look: w[2] });
    }
    if (r() < 0.4 && normals.length) { const o = G.pick(normals, r), w = who(); qs.push({ id: qs.length, kind: 'rescue', x: (o.x + 0.8) * CS, z: (o.y + o.h - 0.8) * CS, room: o.idx, name: w[0], role: w[1], look: w[2] }); }
    return qs;
  },
  // ---- models ----
  model(look) {
    let R;
    if (look === 'ghost') R = M.npc.ghost();
    else if (look === 'goblin') { R = M.enemy.goblin(); if (R.weapon && R.weapon.parent) R.weapon.parent.remove(R.weapon); }
    else if (look === 'imp') { R = M.enemy.imp(); R.root.scale.setScalar(0.8); }
    else {
      const robe = look === 'monk' ? G.mat('col', { c: 0x6a5a40, t: 'cloth', ds: true }) : G.mat('col', { c: 0x5a4a3a, t: 'cloth', ds: true });
      R = M.humanoid({ top: robe, bottom: G.mat('col', { c: 0x3a3028, t: 'cloth' }), bulk: look === 'thrall' ? 1.1 : 0.95, brow: 0x5a4030, hair: 0x5a4030 });
      if (look === 'monk') M.hood(R.head, robe, 0.15);
      if (look === 'thrall') [R.armL, R.armR].forEach(A => { M.P(A.fore, M.limbWrap('fore', A === R.armL ? 1 : -1, 0.74, 0.88, 0.008, 'cuff'), G.mat('iron')); for (let k = 0; k < 4; k++) M.P(A.hand, M.tor(0.02, 0.006, 5, 10), G.mat('iron'), [0, 0.02 - k * 0.04, 0.05], [k % 2 ? Math.PI / 2 : 0, 0, 0], [1, 1.5, 1]); });
    }
    if (R.kind === 'hum') M.batchRig(R);
    return R;
  },
  sign(ch, col) { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.font = 'bold 54px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = col; x.shadowBlur = 12; x.fillStyle = col; x.fillText(ch, 32, 36); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })); s.scale.setScalar(0.6); s.renderOrder = 19; return s; },
  build(L, th) {
    this.list = [];
    (L.quests || []).forEach(q => {
      const Q = Object.assign({}, q, { state: 'idle', t: 0, pos: new G.V3(q.x, 0, q.z), rot: Math.PI, st: { t: Math.random() * 9, move: 0, atk: -1 }, path: null, wi: 0, sendT: 0, sayT: 0, fade: 1, done: false });
      const g = new THREE.Group(); Q.R = this.model(q.look); g.add(Q.R.root); g.position.copy(Q.pos); G.World.group.add(g); Q.g = g; g.userData.dynamic = true;
      Q.mark = this.sign(q.kind === 'rescue' ? '!' : '!', '#ffd24a'); Q.mark.position.y = 2.5; g.add(Q.mark);
      if (q.kind === 'rescue') {
        Q.cage = new THREE.Group(); const ir = G.mat('col', { c: 0x2a2a30, m: 0.9, r: 0.4 });
        for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; M.P(Q.cage, M.cyl(0.03, 0.03, 2.2, 6), ir, [Math.cos(a) * 0.75, 1.1, Math.sin(a) * 0.75]); }
        M.P(Q.cage, M.tor(0.75, 0.04, 6, 28), ir, [0, 2.2, 0], [Math.PI / 2, 0, 0]); M.P(Q.cage, M.cyl(0.8, 0.8, 0.08, 28), ir, [0, 2.24, 0]); M.P(Q.cage, M.box(0.16, 0.2, 0.08), G.mat('bronze'), [0, 1.0, 0.78]);
        Q.cage.position.set(q.x, G.World.fy(q.x, q.z), q.z); Q.cage.userData.dynamic = true; G.World.group.add(Q.cage); Q.st.crouch = 1; Q.solid = G.World.addSolid(q.x, q.z, 0.85);
      }
      if (q.kind === 'fetch') {
        const it = new THREE.Group(), gold = G.mat('col', { c: 0xd8d0c0, m: 1, r: 0.25 });
        if (q.item === 'locket') { M.P(it, M.tor(0.07, 0.012, 8, 20), gold); M.P(it, M.oct(0.04, 0), G.mat('emissive', { c: 0x60c0ff, i: 2 }), [0, 0, 0.01]); }
        else if (q.item === 'ring') { M.P(it, M.tor(0.05, 0.015, 8, 20), G.mat('gold'), [0, 0, 0], [Math.PI / 2, 0, 0]); M.P(it, M.oct(0.03, 0), G.mat('emissive', { c: 0xff4060, i: 2 }), [0, 0.06, 0]); }
        else if (q.item === 'book') { M.P(it, M.box(0.2, 0.05, 0.28), G.mat('col', { c: 0x5a1a1a, t: 'leather' })); M.P(it, M.box(0.04, 0.06, 0.1), G.mat('emissive', { c: 0xffd060, i: 1.5 }), [0, 0.01, 0]); }
        else { M.P(it, M.cap(0.05, 0.12, 4, 10), G.mat('bone')); M.P(it, M.sph(0.04, 10, 8), G.mat('bone'), [0, 0.12, 0]); }
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.tex.sprite('glow'), color: 0x9ad0ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); sp.scale.setScalar(0.9); it.add(sp);
        it.position.set(q.ix, 0.45 + G.World.fy(q.ix, q.iz), q.iz); it.userData.dynamic = true; G.World.group.add(it); Q.item3 = it;
        G.World.lights.push({ pos: new G.V3(q.ix, 0.8 + G.World.fy(q.ix, q.iz), q.iz), color: 0x9ad0ff, intensity: 0.9, dist: 5, seed: 7, flicker: true }); Q.itemLight = G.World.lights[G.World.lights.length - 1];
      }
      this.list.push(Q);
    });
  },
  // a speech bubble over the NPC's head
  say(Q, text, dur = 4) {
    if (!Q.bub) { const c = document.createElement('canvas'); c.width = 512; c.height = 128; Q.bubC = c; Q.bub = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })); Q.bub.scale.set(3.2, 0.8, 1); Q.bub.position.y = 3.05; Q.bub.renderOrder = 21; Q.g.add(Q.bub); }
    const x = Q.bubC.getContext('2d'); x.clearRect(0, 0, 512, 128); x.fillStyle = 'rgba(16,12,8,0.82)'; x.strokeStyle = '#c8a050'; x.lineWidth = 4; x.beginPath(); x.roundRect ? x.roundRect(6, 6, 500, 96, 18) : x.rect(6, 6, 500, 96); x.fill(); x.stroke();
    x.font = '24px Georgia, serif'; x.fillStyle = '#f4e6c8'; x.textAlign = 'center'; const words = text.split(' '); let line = '', lines = []; for (const w of words) { if (x.measureText(line + w).width > 470) { lines.push(line); line = ''; } line += w + ' '; } lines.push(line); lines = lines.slice(0, 3);
    lines.forEach((l, i) => x.fillText(l.trim(), 256, 56 - (lines.length - 1) * 15 + i * 30)); Q.bub.material.map.needsUpdate = true; Q.bub.visible = true; Q.bubT = dur;
    if (G.voice) G.voice.say(text, G.voice.forQuest(Q), { at: () => Q.pos, prio: 'npc', key: 'q' + Q.id });
    if (G.player && Q.pos.distanceTo(G.player.pos) < 14) G.sfx('click', 0.3, Q.pos);
  },
  dirWord(dx, dz) { const a = Math.atan2(dx, -dz), k = Math.round(a / (Math.PI / 4)); return ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north'][(k + 8) % 8]; },
  // ---- interaction ----
  targets(px, pz, consider) {
    const me = G.net.myId();
    this.list.forEach(Q => {
      if (Q.done && !(Q.kind === 'fetch' && Q.carrier)) return;
      const d = Math.hypot(Q.pos.x - px, Q.pos.z - pz);
      if (Q.kind === 'guide' && Q.state === 'idle' && d < 2.6) consider(d, { k: 'quest', Q, a: 'talk', label: `Talk to ${Q.name}` });
      if (Q.kind === 'fetch') {
        if (d < 2.6 && Q.state === 'idle') consider(d, { k: 'quest', Q, a: 'talk', label: `Talk to ${Q.name}` });
        if (d < 2.6 && Q.state === 'seek' && Q.carrier === me) consider(d, { k: 'quest', Q, a: 'return', label: `Give back the ${Q.itemName}` });
        if (!Q.carrier && Q.item3 && Q.item3.visible) { const di = Math.hypot(Q.ix - px, Q.iz - pz); if (di < 2) consider(di, { k: 'quest', Q, a: 'take', label: Q.state === 'seek' ? `Pick up the ${Q.itemName}` : `A ${Q.itemName}, glinting in the dust` }); }
      }
      if (Q.kind === 'rescue' && Q.state === 'idle' && d < 2.4) consider(d, { k: 'quest', Q, a: 'free', label: `Break the cage lock · ${Q.name}` });
    });
  },
  interact(T) {
    const Q = T.Q, me = G.net.myId();
    if (Q.kind === 'guide' && T.a === 'talk') {
      G.dialog.open({ name: Q.name, role: Q.role, voice: G.voice.forQuest(Q), at: Q.pos, color: '#9ad0ff', text: { crypt: 'Psst. The dead walk these halls, but they never found the old ossuary passage. I know where the stones are loose. Follow me, and stay close.', warrens: 'Psst! Snik knows a secret tunnel. Big shinies inside. Follow Snik, quick quick, before the spiders hear.', forge: 'You are not one of them. Good. There is a sealed storeroom the overseers forgot. Follow me and I will open it for you.' }[G.World.theme] || 'Follow me, I know a secret way.',
        options: [{ label: 'Lead the way', fn: () => { G.dialog.close(); this.startGuide(Q, me, true); } }, { label: 'Not now', fn: () => G.dialog.close() }] });
      return;
    }
    if (Q.kind === 'fetch' && T.a === 'talk') {
      const dir = this.dirWord(Q.ix - Q.x, Q.iz - Q.z);
      G.dialog.open({ name: Q.name, role: Q.role, voice: G.voice.forQuest(Q), at: Q.pos, color: '#ffd070', text: `My ${Q.itemName}... I dropped it running from the things down here. It is somewhere to the ${dir}, in one of the far rooms. Bring it back to me and I will make it worth your while.`,
        options: [{ label: 'I will find it', fn: () => { G.dialog.close(); this.net(Q, 'seek'); this.apply(Q, 'seek', me); } }, { label: 'Not now', fn: () => G.dialog.close() }] });
      return;
    }
    if (Q.kind === 'fetch' && T.a === 'take') { if (Q.state !== 'seek') { this.net(Q, 'seek'); this.apply(Q, 'seek', me); } this.net(Q, 'got'); this.apply(Q, 'got', me); G.ui.toast(`You pocket the ${Q.itemName}. Bring it back to ${Q.name}.`); G.sfx('pickup', 0.8); return; }
    if (Q.kind === 'fetch' && T.a === 'return') { this.net(Q, 'back'); this.apply(Q, 'back', me); this.reward(Q, 'fetch'); return; }
    if (Q.kind === 'rescue' && T.a === 'free') {
      const foes = G.enemies.list.filter(e => !e.dead && !e.cower && G.dist2(e.pos.x, e.pos.z, Q.x, Q.z) < 13 * 13).length;
      if (foes) { G.ui.toast(`Not with ${foes} foe${foes > 1 ? 's' : ''} still about. Clear the room first.`); this.say(Q, foes > 2 ? 'Behind you! They are still here!' : 'Hurry, before it comes back!', 2.5); return; }
      this.net(Q, 'free'); this.apply(Q, 'free', me); this.reward(Q, 'rescue'); return;
    }
  },
  net(Q, s, extra) { G.net.sendFx(Object.assign({ k: 'q', i: Q.id, s }, extra || {})); },
  onNet(f, peer) {
    const Q = this.list.find(q => q.id === (f.i | 0)); if (!Q) return;
    if (f.s === 'qp') { Q.netPos = new G.V3(+f.x || 0, 0, +f.z || 0); Q.netRot = +f.r || 0; if (f.w) Q.st.move = 1; else Q.st.move = 0; return; }
    if (f.s === 'lead') { this.startGuide(Q, peer, false); return; }
    if (f.s === 'say' && typeof f.t === 'string') { this.say(Q, f.t.slice(0, 120)); return; }
    this.apply(Q, f.s, peer);
  },
  apply(Q, s, who) {
    if (s === 'seek') { Q.state = 'seek'; Q.mark.material.map = this.sign('?', '#9ad0ff').material.map; }
    if (s === 'got') { Q.state = 'seek'; Q.carrier = who; if (Q.item3) Q.item3.visible = false; if (Q.itemLight) Q.itemLight.intensity = 0; Q.mark.material.map = this.sign('?', '#ffd24a').material.map; }
    if (s === 'back') { Q.state = 'done'; Q.done = true; Q.carrier = null; Q.mark.visible = false; this.say(Q, 'You found it! Bless you, truly.', 4); Q.leaveT = 6; G.fx.holy(new G.V3(Q.pos.x, 0.2, Q.pos.z), 30, 1); G.sfx('level', 0.6, Q.pos); }
    if (s === 'free') { Q.state = 'freed'; Q.done = true; Q.mark.visible = false; Q.cageT = 0.001; Q.st.crouch = 0; if (Q.solid) { Q.solid.r = 0; } this.say(Q, 'Free! Thank you, thank you. Here, take what luck I have left.', 5); Q.leaveT = 9; G.sfx('chest', 0.8, Q.pos); G.sfx('metalclank', 1, Q.pos); }
    if (s === 'open') { Q.state = 'shown'; Q.done = true; Q.mark.visible = false; Q.leaveT = 8; }
  },
  reward(Q, kind) {
    const P = G.player, depth = G.run.depth || 0;
    if (kind === 'fetch') { const gold = Math.round((40 + depth * 18) * (G.DUNGEONS[G.run.dungeon] || { loot: 1 }).loot); P.runGold += gold; P.potions += 1; P.heal(P.maxHp, true); G.sheet.gainXp(P, 70, 'quest'); G.ui.banner('Quest Complete', `${Q.name}'s ${Q.itemName} returned · +${gold} gold, a healing flask`); G.sfx('coin', 1); }
    if (kind === 'rescue') { G.sheet.gainXp(P, 70, 'quest'); G.ui.banner('Prisoner Freed', `${Q.name} offers you a blessing`); setTimeout(() => { const def = G.pick(G.NPCS); G.npcTalk({ def: Object.assign({}, def, { name: Q.name, role: 'Grateful ' + Q.role.toLowerCase() }), used: {} }); }, 900); }
    if (kind === 'guide') { G.sheet.gainXp(P, 50, 'quest'); G.ui.banner('Secret Revealed', `${Q.name} showed you the hidden way`); }
  },
  // ---- guide: path to the main-room side of the secret wall ----
  startGuide(Q, leader, mine) {
    if (Q.state !== 'idle') return; const W = G.World, g = W.gateById(Q.gate); if (!g || g.open) { this.say(Q, 'Ah. Someone already found it.', 3); Q.done = true; return; }
    Q.leader = leader; Q.state = 'lead'; Q.mark.visible = false; Q.path = this.findPath(Q.pos.x, Q.pos.z, g.cx - g.dir[0], g.cy - g.dir[1]) || []; Q.wi = 0; Q.gateRef = g;
    this.say(Q, mine ? 'This way. Stay close!' : `${Q.name} leads the way.`, 3); if (mine) this.net(Q, 'lead'); Q.mine = mine;
  },
  findPath(x, z, tx, ty) {
    const W = G.World, CS = W.CS, w = W.W, h = W.H, sx = Math.floor(x / CS), sy = Math.floor(z / CS), prev = new Int32Array(w * h).fill(-1), q = [sy * w + sx]; prev[q[0]] = q[0];
    for (let qi = 0; qi < q.length; qi++) { const c = q[qi]; if (c === ty * w + tx) break; const cx = c % w, cy = (c / w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy, n = ny * w + nx; if (nx < 0 || ny < 0 || nx >= w || ny >= h || prev[n] >= 0 || !W.grid[n]) continue; prev[n] = c; q.push(n); } }
    const end = ty * w + tx; if (prev[end] < 0) return null; const cells = []; for (let c = end; c !== sy * w + sx; c = prev[c]) cells.push(c); cells.reverse();
    const pts = cells.map(c => new G.V3((c % w + 0.5) * CS, 0, (((c / w) | 0) + 0.5) * CS)), out = [];
    // drop waypoints that are in plain view of the previous kept one, so the walk is smooth
    let last = new G.V3(x, 0, z); for (let i = 0; i < pts.length; i++) { const nx = pts[i + 1]; if (nx && W.los(last.x, last.z, nx.x, nx.z)) continue; out.push(pts[i]); last = pts[i]; }
    return out;
  },
  // ---- per frame ----
  update(dt) {
    const P = G.player, me = G.net.myId();
    for (const Q of this.list) {
      Q.st.t += dt;
      if (Q.bub && Q.bubT !== undefined) { Q.bubT -= dt; Q.bub.visible = Q.bubT > 0; }
      Q.mark.position.y = 2.5 + Math.sin(Q.st.t * 3) * 0.08;
      if (Q.kind === 'guide' && Q.state === 'lead') {
        if (Q.mine) {
          const tgt = Q.path[Q.wi], far = P && Q.pos.distanceTo(P.pos) > 9;
          if (!tgt) { this.arrive(Q); }
          else if (far) { Q.st.move = G.damp(Q.st.move, 0, 8, dt); Q.rot = G.lerpAng(Q.rot, Math.atan2(P.pos.x - Q.pos.x, P.pos.z - Q.pos.z), dt * 5); Q.sayT -= dt; if (Q.sayT <= 0) { Q.sayT = 5; const t = G.pick(['Over here! Keep up!', 'This way, quickly!', 'Do not lose me in the dark!']); this.say(Q, t, 2.5); this.net(Q, 'say', { t }); } }
          else { const dx = tgt.x - Q.pos.x, dz = tgt.z - Q.pos.z, d = Math.hypot(dx, dz), sp = 3.6; if (d < 0.3) Q.wi++; else { Q.pos.x += dx / d * Math.min(d, sp * dt); Q.pos.z += dz / d * Math.min(d, sp * dt); Q.rot = G.lerpAng(Q.rot, Math.atan2(dx, dz), dt * 8); Q.st.move = G.damp(Q.st.move, 0.8, 6, dt); } }
          Q.sendT -= dt; if (Q.sendT <= 0) { Q.sendT = 0.2; this.net(Q, 'qp', { x: Math.round(Q.pos.x * 100) / 100, z: Math.round(Q.pos.z * 100) / 100, r: Math.round(Q.rot * 100) / 100, w: Q.st.move > 0.3 ? 1 : 0 }); }
        } else if (Q.netPos) { Q.pos.x = G.damp(Q.pos.x, Q.netPos.x, 8, dt); Q.pos.z = G.damp(Q.pos.z, Q.netPos.z, 8, dt); Q.rot = G.lerpAng(Q.rot, Q.netRot, dt * 8); }
        Q.st.phase = (Q.st.phase || 0) + dt * Q.st.move * 7;
      } else if (Q.kind === 'guide' && Q.state === 'reveal' && Q.mine) {
        Q.t += dt; Q.st.move = 0;
        if (Q.t > 1.6 && !Q.opened) { Q.opened = true; G.World.openGate(Q.gateRef.id, true); this.net(Q, 'open'); this.apply(Q, 'open', me); this.reward(Q, 'guide'); const t = 'There. Whatever the old ones hid is yours now.'; this.say(Q, t, 4); this.net(Q, 'say', { t }); }
      } else if (P && !Q.done && Q.state === 'idle') Q.rot = G.lerpAng(Q.rot, Math.atan2(P.pos.x - Q.pos.x, P.pos.z - Q.pos.z), dt * 2);
      if (Q.cage && Q.cageT > 0) { Q.cageT = Math.min(1, Q.cageT + dt / 1.2); Q.cage.position.y = G.smooth(Q.cageT) * 3.2; Q.cage.children.forEach(c => c.material && (c.material.transparent = true, c.material.opacity = 1 - Q.cageT)); }
      if (Q.kind === 'fetch' && Q.item3 && Q.item3.visible) { Q.item3.rotation.y += dt * 1.5; Q.item3.position.y = G.World.fy(Q.item3.position.x, Q.item3.position.z) + 0.45 + Math.sin(Q.st.t * 2) * 0.08; }
      if (Q.leaveT !== undefined) { Q.leaveT -= dt; if (Q.leaveT < 1.2) { Q.fade = Math.max(0, Q.leaveT / 1.2); Q.g.scale.setScalar(0.4 + Q.fade * 0.6); if (Math.random() < 0.5) G.fx.holy(new G.V3(Q.pos.x, 0.5, Q.pos.z), 2, 0.5); if (Q.leaveT <= 0) { Q.g.visible = false; Q.leaveT = undefined; } } }
      if (!Q.g.visible) continue;
      Q.g.position.copy(Q.pos); Q.g.position.y = G.World.fy(Q.pos.x, Q.pos.z); Q.R.root.rotation.y = Q.rot;
      if (Q.R.kind === 'hum') M.animHum(Q.R, Q.st); else M.anim(Q.R, Q.st);
    }
  },
  arrive(Q) {
    const g = Q.gateRef; Q.state = 'reveal'; Q.t = 0; Q.rot = Math.atan2(g.dir[0], g.dir[1]);
    const t = { crypt: 'Here. Feel the draught through the mortar? Stand back.', warrens: 'Here here! Snik pushes the wobbly stone...', forge: 'This wall. They bricked it up in a hurry. Watch.' }[G.World.theme] || 'Here it is.';
    this.say(Q, t, 3); this.net(Q, 'say', { t }); G.sfx('stonehit', 0.6, Q.pos);
  }
};
