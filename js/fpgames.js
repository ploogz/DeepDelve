/* ============================================================
   First-person play for every table game in the Grand Arcade
   Blackjack · Hold'em · Liar's Dice · Knucklebones · Dragon Dice · Bone Chess · Rat Races · the witch's tarot
   ============================================================ */
'use strict';
(() => {
  const F = G.fp, TB = G.tables, GM = TB.GAMES, T = G.tavern, TM = T.models, A = G.arcade, R = Math.random, UI = G.ui;
  const me = () => G.net.myId(), now = () => Date.now(), FACE = T.FACE;
  const V = (x, y, z) => new G.V3(x, y, z);
  const nm = (p) => p.id === me() ? 'You' : p.name;
  const seatIdx = (t, id, L) => { const r = TB.slotOf(t, id); return r < 0 ? -1 : L && L.order ? L.order[r % L.order.length] : r; };
  const occBySeats = (t, sub, hotId, L) => t.seats.map((s, i) => ({ slot: seatIdx(t, s.id, L), id: s.id, name: s.name, npc: !!s.npc, sub: sub ? sub(s, i) : '', hot: hotId && s.id === hotId }));
  const occL = (L, t, sub, hot) => occBySeats(t, sub, hot, L);
  const dirOf = (L, slot) => { const S = L.seats[slot], dx = S.x - L.cx, dz = S.z - L.cz, l = Math.hypot(dx, dz) || 1; return { x: dx / l, z: dz / l }; };
  const ryToward = (d) => Math.atan2(d.x, d.z);   // a card or die laid so its top points back at the table's centre
  const chipCols = [0x8a1a1a, 0x1a1a1a, 0xe8dcc0, 0x2a5a2a, 0x1a2a6a];

  /* ================= building the seats ================= */
  const layout = (W, key, game, cx, cz, seats, o = {}) => {
    const L = Object.assign({ key, game, cx, cz, seats, eye: 1.18, pitch: -0.55, ty: 0.84, idle: [], extra: [] }, o); F.L[key] = L;
    if (o.stools !== false) seats.forEach(S => { const st = TM.stool(); W.place(st, S.x, 0, S.z, 0, 0); });
    (o.idleAt || []).forEach(([slot, v]) => { const S = seats[slot], Rr = TM.patron(v); Rr.root.position.set(S.x, 0, S.z); Rr.root.rotation.y = Math.atan2(cx - S.x, cz - S.z); Rr.root.userData.dynamic = true; W.group.add(Rr.root); W.hideNPCs.push(Rr); L.idle.push(Rr); });
    return L;
  };
  const ba0 = G.World.buildArcade;
  G.World.buildArcade = function (o) {
    ba0.call(this, o); if (!o.spots) return; const W = this, sp = o.spots;
    // Blackjack: four on the round edge (south), the enchanted shoe floats over the flat side
    { const b = sp.blackjack, seats = [-0.95, -0.32, 0.32, 0.95].map(th => ({ x: b.x + Math.sin(th) * 1.72, z: b.z + Math.cos(th) * 1.72, th })); const L = layout(W, 'blackjack', 'blackjack', b.x, b.z + 0.45, seats, { deckAt: { x: b.x + 0.75, y: 1.12, z: b.z + 0.2 }, ty: 0.835, bj: b }); F.magicDeck(W, L.deckAt.x, L.deckAt.y, L.deckAt.z); }
    // Hold'em: six around the oval
    { const p = sp.poker, seats = F.ring(p.x, p.z, 1.75, 1.15, [0, 1, 2, 3, 4, 5].map(k => k / 6 * Math.PI * 2)); const L = layout(W, 'poker', 'poker', p.x, p.z, seats, { deckAt: { x: p.x, y: 1.25, z: p.z }, ty: 0.835, idleAt: [[3, 0], [1, 1]], order: [0, 3, 2, 5, 4, 1] }); F.magicDeck(W, L.deckAt.x, L.deckAt.y, L.deckAt.z); }
    // Liar's Dice: six around the round table, two regulars waiting
    { const l = sp.liars, seats = F.ring(l.x, l.z, 1.45, 1.45, [0, 1, 2, 3, 4, 5].map(k => -2.07 + k * Math.PI / 3)); layout(W, 'liars', 'liars', l.x, l.z, seats, { ty: 0.82, idleAt: [[3, 0], [1, 1]], order: [0, 3, 2, 5, 4, 1] }); }
    // Knucklebones: face to face across the little table, the dice tray between
    { const k = sp.knuckle, seats = [{ x: k.x, z: k.z - 1.2 }, { x: k.x, z: k.z + 1.2 }]; layout(W, 'knuckle', 'knuckle', k.x, k.z, seats, { ty: 0.85, arena: { cx: k.x, cz: k.z, y: 0.862, hx: 0.235, hz: 0.12 }, idleAt: [[1, 2]], eye: 1.2, pitch: -0.62 }); }
    // Dragon Dice: six round the oval, a bone-rimmed tray in the middle
    { const d = sp.dice, seats = F.ring(d.x, d.z, 1.55, 1.2, [0, 1, 2, 3, 4, 5].map(k => k / 6 * Math.PI * 2 + Math.PI / 6)); layout(W, 'dice', 'dice', d.x, d.z, seats, { ty: 0.83, arena: { cx: d.x, cz: d.z, y: 0.842, hx: 0.585, hz: 0.365 }, idleAt: [[4, 1]], order: [0, 3, 2, 5, 4, 1] }); }
    // Bone Chess: white sits on the south side of each board
    (sp.chess || []).forEach((c, bi) => { const L = layout(W, 'chess' + bi, 'chess', c.x, c.z, [{ x: c.x, z: c.z + 0.95 }, { x: c.x, z: c.z - 0.95 }], { stools: false, eye: 1.25, pitch: -0.85, board: bi, match: t => (t.opts.board | 0) === bi }); });
  };

  /* ================= chips ================= */
  const chipStack = (amt) => { const g = new THREE.Group(); let n = 0; [[100, 4], [25, 3], [5, 0], [1, 2]].forEach(([v, ci]) => { let k = Math.floor(amt / v); amt -= k * v; k = Math.min(k, 12); if (k) { const st = TM.chips(k, chipCols[ci]); st.position.set((n % 2) * 0.065 - 0.03, 0, Math.floor(n / 2) * 0.065); g.add(st); n++; } }); return g; };
  const setStack = (L, key, amt, x, y, z) => { L.stacks = L.stacks || {}; let s = L.stacks[key]; if (s && s.amt === amt) { s.g.position.lerp(V(x, y, z), 0.2); return; } if (s) G.scene.remove(s.g); if (!amt) { delete L.stacks[key]; return; } const g = chipStack(amt); g.position.set(x, y, z); g.userData.dynamic = true; G.scene.add(g); L.stacks[key] = { g, amt }; };
  const clearStacks = (L, keep) => { Object.keys(L.stacks || {}).forEach(k => { if (!keep || !keep.has(k)) { G.scene.remove(L.stacks[k].g); delete L.stacks[k]; } }); };

  /* ================= Blackjack ================= */
  F.C.blackjack = {
    slotOf: (L, t, id) => seatIdx(t, id, L),
    sync(L, t, dt) {
      if (!t) { F.occupy(L, []); F.syncCards(L, [], dt); clearStacks(L); return; }
      const st = t.st, bj = L.bj, want = [], keep = new Set();
      st.dealer.forEach((c, i) => want.push({ k: 'h' + i, c: st.hide && i === 1 ? null : c, x: bj.x - 0.08 + i * 0.1 - (st.dealer.length - 1) * 0.05 + 0.05, y: L.ty + 0.002, z: bj.z + 0.32, ry: Math.PI, up: !(st.hide && i === 1) }));
      st.pl.forEach(p => { const slot = seatIdx(t, p.id, L); if (slot < 0) return; const S = L.seats[slot], th = S.th, d = { x: Math.sin(th), z: Math.cos(th) }, px = { x: d.z, z: -d.x };
        p.hand.forEach((c, i) => { const off = (i - (p.hand.length - 1) / 2) * 0.07; want.push({ k: p.id + ':' + i, c, x: bj.x + d.x * 0.82 + px.x * off, y: L.ty + 0.002 + i * 0.0015, z: bj.z + d.z * 0.82 + px.z * off, ry: th, up: true, hl: st.phase === 'settle' && (p.res === 'win' || p.res === 'blackjack') }); });
        const k = 'b' + p.id; keep.add(k); setStack(L, k, p.bet, bj.x + d.x * 1.05, L.ty, bj.z + d.z * 1.05); });
      F.syncCards(L, want, dt); clearStacks(L, keep);
      F.occupy(L, occL(L, t, (s) => { const p = st.pl.find(q => q.id === s.id); if (!p) return ''; const v = TB.bjVal(p.hand).v; return p.res && st.phase === 'settle' ? ({ win: 'wins', blackjack: 'BLACKJACK', push: 'push', lose: 'loses', bust: 'bust' }[p.res] || '') : p.hand.length ? `${v}${p.res === 'bust' ? ' · bust' : ''}` : p.bet ? `bet ${p.bet}` : ''; }, st.turn));
    },
    input(L, t) {
      const st = t.st, p = st.pl.find(q => q.id === me()); if (!p) return {};
      const F2 = TB.form.bjBet || (TB.form.bjBet = { amt: t.buy }), dv = TB.bjVal(st.dealer.filter((c, i) => !(st.hide && i === 1))).v, mv = TB.bjVal(p.hand).v;
      const title = `Blackjack · bet ${t.buy}–${t.buy * 25}`;
      let status = st.dealer.length ? `House shows <b>${dv}${st.hide ? ' + ?' : ''}</b>` : 'Place your bets';
      if (p.hand.length) status += ` · you have <b>${mv}</b>${TB.bjVal(p.hand).soft && mv < 21 ? ' (soft)' : ''}`;
      if (st.phase === 'bet' && !p.bet) {
        const adj = (G.pressed.KeyW ? 1 : 0) - (G.pressed.KeyS ? 1 : 0) - F.wheel; F.wheel = 0; G.pressed.KeyW = G.pressed.KeyS = false; if (adj) F2.amt = G.clamp((F2.amt || t.buy) + Math.sign(adj) * t.buy, t.buy, t.buy * 25);
        F2.amt = G.clamp(F2.amt || t.buy, t.buy, t.buy * 25);
        if (F.key('Space')) { const amt = F2.amt; if (G.save.gold < amt) G.ui.toast('Not enough gold'); else { G.save.gold -= amt; G.persist(); G.sfx('coin', 0.6); TB.act(t.tid, { t: 'bet', amt }); } }
        if (t.host === me() && st.pl.some(x => x.bet) && F.key('KeyD')) TB.act(t.tid, { t: 'deal' });
        return { title, status: `Your bet: <b>${F2.amt}</b> gold`, keys: [['W/S', 'wheel: bet amount'], ['Space', 'place bet', G.save.gold >= F2.amt], t.host === me() && st.pl.some(x => x.bet) ? ['D', 'deal now'] : null] };
      }
      if (st.phase === 'play' && st.turn === me()) {
        if (F.key('Digit1')) TB.act(t.tid, { t: 'hit' }); else if (F.key('Digit2')) TB.act(t.tid, { t: 'stand' });
        else if (F.key('Digit3') && p.hand.length === 2 && G.save.gold >= p.bet) { G.save.gold -= p.bet; G.persist(); G.sfx('coin', 0.6); TB.act(t.tid, { t: 'double' }); }
        return { title, status: status + ' · <b>your move</b>', keys: [['1', 'hit'], ['2', 'stand'], ['3', 'double down', p.hand.length === 2 && G.save.gold >= p.bet]] };
      }
      if (st.phase === 'settle') status += ` · ${p.res ? ({ win: 'You win!', blackjack: 'Blackjack!', push: 'Push', lose: 'You lose', bust: 'Bust' }[p.res] || '') : ''}`;
      else if (st.phase === 'bet') status = 'Waiting for the others to bet…';
      else if (st.turn) status += ` · ${(st.pl.find(q => q.id === st.turn) || {}).name || ''} to play`;
      const canDeal = t.host === me() && st.phase === 'bet' && st.pl.some(x => x.bet); if (canDeal && F.key('KeyD')) TB.act(t.tid, { t: 'deal' });
      return { title, status, keys: canDeal ? [['D', 'deal now']] : [] };
    },
    clear(L) { clearStacks(L); }
  };

  /* ================= Texas Hold'em ================= */
  const potOf = st => st.pl.reduce((a, p) => a + p.tot, 0);
  F.C.poker = {
    slotOf: (L, t, id) => seatIdx(t, id, L),
    sync(L, t, dt) {
      if (!t) { F.occupy(L, []); F.syncCards(L, [], dt); clearStacks(L); if (L.btn) L.btn.visible = false; return; }
      const st = t.st, want = [], keep = new Set(), live = ['pre', 'flop', 'turn', 'river', 'done'].includes(st.street);
      if (live) st.board.forEach((c, i) => want.push({ k: 'b' + i, c, x: L.cx - 0.22 + i * 0.11, y: L.ty + 0.002, z: L.cz - 0.02, ry: Math.PI, up: true, hl: st.street === 'done' && st.result && st.result.some(r => r.hand) }));
      st.pl.forEach(p => { const slot = seatIdx(t, p.id, L); if (slot < 0) return; const S = L.seats[slot], a = S.a, d = { x: Math.cos(a), z: Math.sin(a) }, px = { x: d.z, z: -d.x }, ry = ryToward(d), mine = p.id === me();
        if (live && p.hole.length && p.inHand && !p.folded) p.hole.forEach((c, i) => { const off = (i - 0.5) * 0.075; want.push({ k: p.id + ':' + i, c: mine || p.shown ? c : null, x: L.cx + d.x * 1.0 + px.x * off, y: L.ty + 0.002 + i * 0.0015, z: L.cz + d.z * 0.62 + px.z * off, ry, up: mine || p.shown }); });
        const ks = 's' + p.id, kb = 'x' + p.id; keep.add(ks); keep.add(kb); setStack(L, ks, p.chips, L.cx + d.x * 1.12, L.ty, L.cz + d.z * 0.72); setStack(L, kb, p.bet, L.cx + d.x * 0.7, L.ty, L.cz + d.z * 0.42); });
      keep.add('pot'); setStack(L, 'pot', live ? potOf(st) - st.pl.reduce((a, p) => a + p.bet, 0) : 0, L.cx, L.ty, L.cz + 0.16);
      F.syncCards(L, want, dt); clearStacks(L, keep);
      // the dealer button
      if (!L.btn) { L.btn = new THREE.Group(); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.008, 20), new THREE.MeshStandardMaterial({ color: 0xf2ead2, roughness: 0.5 })); L.btn.add(m); const sk = A.skull(0.18); sk.position.y = 0.012; sk.rotation.x = -Math.PI / 2; L.btn.add(sk); G.scene.add(L.btn); L.extra.push(L.btn); }
      const bp = st.pl[st.btn]; L.btn.visible = !!bp; if (bp) { const slot = seatIdx(t, bp.id, L), S = L.seats[slot]; if (S) { const d = { x: Math.cos(S.a), z: Math.sin(S.a) }; L.btn.position.lerp(V(L.cx + d.x * 0.85 + d.z * 0.16, L.ty + 0.004, L.cz + d.z * 0.52 - d.x * 0.16), 0.15); } }
      F.occupy(L, occL(L, t, (s) => { const p = st.pl.find(q => q.id === s.id); if (!p) return ''; const r = st.result && st.street === 'done' && st.result.find(x => x.id === p.id); return r ? `wins ${r.amt}${r.hand ? ' · ' + r.hand : ''}` : p.folded ? `folded · ${p.chips}` : `💀 ${p.chips}${p.bet ? ' · bet ' + p.bet : ''}${p.allin ? ' · ALL IN' : ''}`; }, st.pl[st.turn] && st.pl[st.turn].id));
    },
    input(L, t) {
      const st = t.st, P = st.pl.find(p => p.id === me()), title = `Hold'em · blinds ${st.sb}/${st.bb}`; if (!P) return { title };
      const pot = potOf(st), toCall = st.curBet - P.bet, maxTo = P.bet + P.chips, minTo = Math.min(maxTo, st.curBet + st.minR), F2 = TB.form.pkRaise || (TB.form.pkRaise = { to: minTo });
      let status = `Pot <b>${pot}</b> · your chips <b>${P.chips}</b>`;
      if (P.hole.length && st.board.length >= 3 && P.inHand) { const sc = TB.evalHand(P.hole.concat(st.board)); status += ` · ${TB.handName ? TB.handName(sc) : ''}`; }
      if (GM.poker.myTurn(t, me())) {
        const adj = (G.pressed.KeyW ? 1 : 0) - (G.pressed.KeyS ? 1 : 0) - F.wheel; F.wheel = 0; G.pressed.KeyW = G.pressed.KeyS = false; const step = Math.max(st.bb, Math.round(pot / 10 / st.bb) * st.bb || st.bb);
        F2.to = G.clamp((F2.to < minTo ? minTo : F2.to) + adj * step, minTo, maxTo);
        if (F.key('Digit1')) TB.act(t.tid, { t: 'fold' }); else if (F.key('Digit2')) TB.act(t.tid, { t: toCall > 0 ? 'call' : 'check' }); else if (F.key('Digit3') && maxTo > st.curBet) TB.act(t.tid, { t: 'raise', to: F2.to }); else if (F.key('Digit4') && maxTo > st.curBet) TB.act(t.tid, { t: 'raise', to: maxTo });
        return { title, status: status + ' · <b>your action</b>', keys: [['1', 'fold'], ['2', toCall > 0 ? `call ${Math.min(toCall, P.chips)}` : 'check'], ['3', `${st.curBet ? 'raise to' : 'bet'} ${F2.to}`, maxTo > st.curBet], ['W/S', 'wheel: size', maxTo > st.curBet], ['4', 'all in', maxTo > st.curBet]] };
      }
      if (P.chips <= 0 && !(P.inHand && !P.folded)) { if (F.key('KeyB') && G.save.gold >= t.buy) { G.save.gold -= t.buy; G.persist(); G.sfx('coin', 0.7); TB.act(t.tid, { t: 'rebuy' }); } return { title, status: "You're out of chips", keys: [['B', `buy back in · ${t.buy} g`, G.save.gold >= t.buy]] }; }
      const cur = st.pl[st.turn]; return { title, status: status + (st.street === 'done' && st.result ? ' · ' + st.result.map(r => `${r.name} wins ${r.amt}`).join(', ') : cur ? ` · ${cur.name} to act` : st.street === 'wait' ? ' · waiting for players' : ''), keys: [] };
    },
    clear(L) { clearStacks(L); }
  };

  /* ================= Liar's Dice ================= */
  const bidSprite = () => { const s = F.label(); s.scale.set(1.1, 0.275, 1); return s; };
  F.C.liars = {
    slotOf: (L, t, id) => seatIdx(t, id, L),
    sync(L, t, dt) {
      L.cups = L.cups || {}; const used = new Set();
      if (t) { const st = t.st, reveal = st.phase === 'reveal' || st.phase === 'over', roundKey = st.pl.map(p => p.dice.join('')).join('|');
        if (roundKey !== L.roundKey) { L.roundKey = roundKey; L.shakeT = 1.1; G.sfx('dice', 0.6, V(L.cx, 1, L.cz)); }
        L.shakeT = Math.max(0, (L.shakeT || 0) - dt); const shake = L.shakeT > 0.25, slam = L.shakeT > 0 && !shake;
        st.pl.forEach(p => { const slot = seatIdx(t, p.id, L); if (slot < 0) return; used.add(p.id); const d = dirOf(L, slot), cx = L.cx + d.x * 0.6, cz = L.cz + d.z * 0.6, mine = p.id === me();
          let c = L.cups[p.id]; if (!c) { c = L.cups[p.id] = { cup: TM.diceCup(), dice: [] }; c.cup.scale.setScalar(1.25); c.cup.rotation.x = Math.PI; c.cup.userData.dynamic = true; G.scene.add(c.cup); }
          while (c.dice.length < 5) { const m = F.dieMesh(); m.visible = false; G.scene.add(m); c.dice.push(m); }
          c.dice.forEach((m, i) => { const v = p.dice[i]; m.visible = !!v && p.n > 0 && i < p.n; if (!v) return; const a = i / 5 * Math.PI * 2 + slot, r2 = i === 4 ? 0 : 0.04; m.position.set(cx + Math.cos(a) * r2 * (i < 4 ? 1 : 0), L.ty + F.DS / 2, cz + Math.sin(a) * r2 * (i < 4 ? 1 : 0)); if (m.userData.v !== v) { m.userData.v = v; m.quaternion.copy(F.faceUpQuat(v, R() * 6)); } const hit = reveal && st.reveal && (v === st.reveal.f || v === 1); F.dieGlow(m, hit ? 0xffc040 : 0, hit ? 0.6 + Math.sin(G.now() * 6) * 0.25 : 0); });
          // the cup: shaken at the start of a round, slammed down, lifted to peek (yours) or to count (everyone's)
          const peek = mine && F.seated && G.mouse.r && !reveal, up = reveal || peek || p.n <= 0;
          const ty = shake ? L.ty + 0.25 + Math.abs(Math.sin(G.now() * 30)) * 0.05 : up ? L.ty + (peek ? 0.16 : 0.24) + 0.095 : L.ty + 0.095;
          c.cup.position.set(cx + (shake ? Math.sin(G.now() * 37 + slot) * 0.03 : 0) - (peek ? d.x * 0.06 : 0), G.damp(c.cup.position.y || ty, ty, slam ? 30 : 10, dt), cz + (shake ? Math.cos(G.now() * 29 + slot) * 0.03 : 0) - (peek ? d.z * 0.06 : 0));
          c.cup.rotation.set(Math.PI + (peek ? -0.7 * d.z : up ? 0.4 : 0), 0, (peek ? 0.7 * d.x : 0));
          if (slam && !c.slammed) { c.slammed = true; G.sfx('thump', 0.5, c.cup.position); } if (shake) c.slammed = false;
        });
        // the standing bid hangs over the table
        if (!L.bid) { L.bid = bidSprite(); G.scene.add(L.bid); L.extra.push(L.bid); } L.bid.visible = !!st.bid; L.bid.position.set(L.cx, 1.08, L.cz);
        if (st.bid) F.setLabel(L.bid, `${st.bid.q} × ${FACE[st.bid.f]}`, `bid by ${st.pl[st.bid.by].name}${st.reveal && reveal ? ` · ${st.pl[st.reveal.loser].name} loses a die` : ''}`, true);
        F.occupy(L, occL(L, t, (s) => { const p = st.pl.find(q => q.id === s.id); return p ? (p.n > 0 ? `${p.n} ${p.n === 1 ? 'die' : 'dice'}` : 'out') : ''; }, st.phase === 'bid' && st.pl[st.turn] && st.pl[st.turn].id));
      } else { F.occupy(L, []); if (L.bid) L.bid.visible = false; }
      Object.keys(L.cups).forEach(k => { if (!used.has(k)) { const c = L.cups[k]; G.scene.remove(c.cup); c.dice.forEach(m => G.scene.remove(m)); delete L.cups[k]; } });
    },
    input(L, t) {
      const st = t.st, i = st.pl.findIndex(q => q.id === me()), p = st.pl[i], Fm = TB.form.liarsBid || (TB.form.liarsBid = { q: 1, f: 2 }), title = `Liar's Dice · pot ${st.pot}`; if (!p) return { title };
      const total = GM.liars.total(st);
      let status = `${total} dice on the table${st.bid ? ` · bid <b>${st.bid.q} × ${FACE[st.bid.f]}</b>` : ''}`;
      if (st.phase === 'bid' && st.turn === i) {
        if (!GM.liars.legal(st, Fm.q, Fm.f)) { Fm.q = st.bid ? (st.bid.f < 6 ? st.bid.q : st.bid.q + 1) : 1; Fm.f = st.bid ? (st.bid.f < 6 ? st.bid.f + 1 : 2) : 2; }
        const adj = (G.pressed.KeyW ? 1 : 0) - (G.pressed.KeyS ? 1 : 0) - F.wheel; F.wheel = 0; G.pressed.KeyW = G.pressed.KeyS = false; if (adj) Fm.q = G.clamp(Fm.q + Math.sign(adj), 1, total);
        [2, 3, 4, 5, 6].forEach(f => { if (F.key('Digit' + f)) Fm.f = f; });
        const ok = GM.liars.legal(st, Fm.q, Fm.f);
        if (F.key('Space') && ok) TB.act(t.tid, { t: 'bid', q: Fm.q, f: Fm.f }); else if (st.bid && F.key('KeyL')) TB.act(t.tid, { t: 'call' });
        return { title, status: status + ` · your bid: <b>${Fm.q} × ${FACE[Fm.f]}</b>`, keys: [['RMB', 'hold: peek'], ['W/S', 'wheel: how many'], ['2–6', 'face'], ['Space', 'bid', ok], ['L', 'call liar!', !!st.bid]] };
      }
      if (st.phase === 'reveal') status += ' · counting…'; else if (st.phase === 'bid') status += ` · ${st.pl[st.turn].name} is thinking`;
      return { title, status, keys: [['RMB', 'hold: peek under your cup', p.n > 0]] };
    },
    clear(L) { Object.values(L.cups || {}).forEach(c => { G.scene.remove(c.cup); c.dice.forEach(m => G.scene.remove(m)); }); L.cups = {}; }
  };

  /* ================= Knucklebones ================= */
  const kSlot = (L, slot, c, r) => { const dz = slot === 0 ? -1 : 1; return V(L.cx + (c - 1) * 0.12 * -dz, L.ty + F.DS / 2, L.cz + dz * (0.5 - r * 0.085)); };
  F.C.knuckle = {
    slotOf: (L, t, id) => seatIdx(t, id, L),
    sync(L, t, dt) {
      L.kd = L.kd || {}; const used = new Set();
      if (t) { const st = t.st;
        if (st.toss && st.toss.n !== L.tossN && L.arena) { L.tossN = st.toss.n; F.showToss(L, st.toss.n, L.seats[st.toss.seat], st.toss, 1, [st.toss.v]); }
        if (st.phase !== 'place' && L.toss && F.tossDone(L)) F.clearToss(L);
        st.pl.forEach((p, slot) => { p.b.forEach((col, c) => { const n = {}; col.forEach(v => n[v] = (n[v] || 0) + 1); col.forEach((v, r) => { const k = slot + ':' + c + ':' + r + ':' + v; used.add(k); let m = L.kd[k]; if (!m) { m = L.kd[k] = F.dieMesh(); m.quaternion.copy(F.faceUpQuat(v, slot ? Math.PI : 0)); const from = L.tossDice && L.tossDice[0] ? L.tossDice[0].position.clone() : kSlot(L, slot, c, r).add(V(0, 0.2, 0)); m.position.copy(from); m.userData.to = kSlot(L, slot, c, r); G.scene.add(m); if (L.tossDice && L.tossDice[0] && st.toss && st.toss.seat === slot) F.clearToss(L); } m.position.lerp(m.userData.to, Math.min(1, dt * 7)); F.dieGlow(m, n[v] === 3 ? 0xff4020 : n[v] === 2 ? 0xffc040 : 0, n[v] >= 2 ? 0.35 : 0); }); }); });
        F.occupy(L, occL(L, t, (s, i) => `${GM.knuckle.board ? '' : ''}${(st.pl[i] ? st.pl[i].b.reduce((a, col) => { const n = {}; col.forEach(v => n[v] = (n[v] || 0) + 1); return a + Object.entries(n).reduce((x, [v, k]) => x + v * k * k, 0); }, 0) : 0)} points`, st.pl[st.turn] && st.pl[st.turn].id));
      } else { F.occupy(L, []); F.clearToss(L); }
      Object.keys(L.kd).forEach(k => { if (!used.has(k)) { const m = L.kd[k]; G.fx.spark(m.position.clone(), 0xffe0a0, 10, 1.5, 0.4, 0.03); G.scene.remove(m); delete L.kd[k]; } });
      // the columns you can drop the die into
      if (!L.cols) { L.cols = [0, 1, 2].map(c => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.27), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0, depthWrite: false })); m.userData.c = c; G.scene.add(m); L.extra.push(m); return m; }); }
    },
    input(L, t, dt) {
      const st = t.st, i = st.pl.findIndex(q => q.id === me()), title = `Knucklebones · pot ${st.pot}`; if (i < 0) return { title };
      const mine = st.turn === i, score = b => b.reduce((a, col) => { const n = {}; col.forEach(v => n[v] = (n[v] || 0) + 1); return a + Object.entries(n).reduce((x, [v, k]) => x + v * k * k, 0); }, 0);
      const status = `You <b>${score(st.pl[i].b)}</b> · ${st.pl[1 - i] ? st.pl[1 - i].name : ''} <b>${st.pl[1 - i] ? score(st.pl[1 - i].b) : 0}</b>`;
      F.picks = []; L.cols.forEach((m, c) => { const p = kSlot(L, i, c, 1); m.position.set(p.x, L.ty + 0.01, p.z); m.material.opacity = 0; });
      if (mine && st.phase === 'roll') { F.shakeInput(dt, true, o => TB.act(t.tid, Object.assign({ t: 'roll' }, o))); return { title, status: status + ' · <b>your throw</b>', keys: [['LMB', 'hold to shake, release to throw']] }; }
      F.shakeInput(dt, false);
      if (mine && st.phase === 'place' && F.tossDone(L)) {
        L.cols.forEach((m, c) => { if (st.pl[i].b[c].length >= 3) return; F.picks.push({ obj: m, onHover: () => { m.material.opacity = 0.28; }, unhover: () => { m.material.opacity = 0; }, onClick: () => TB.act(t.tid, { t: 'place', c }) }); });
        return { title, status: status + ` · you rolled <b>${FACE[st.die]}</b>`, keys: [['LMB', 'click a column to place it']] };
      }
      return { title, status: status + (st.phase === 'over' ? (st.winner ? ` · ${st.winner} wins` : ' · a draw') : st.phase === 'place' && !F.tossDone(L) ? ' · the die is rolling…' : mine ? ' · your turn' : ` · ${st.pl[st.turn].name}'s turn`), keys: [] };
    },
    clear(L) { Object.values(L.kd || {}).forEach(m => G.scene.remove(m)); L.kd = {}; }
  };

  /* ================= Dragon Dice ================= */
  F.C.dice = {
    slotOf: (L, t, id) => seatIdx(t, id, L),
    sync(L, t, dt) {
      L.kept = L.kept || [];
      if (!t) { F.occupy(L, []); F.clearToss(L); L.kept.forEach(m => G.scene.remove(m)); L.kept = []; return; }
      const st = t.st;
      if (st.toss && st.toss.n !== L.tossN) { L.tossN = st.toss.n; F.showToss(L, st.toss.n, L.seats[st.toss.slot], st.toss, st.toss.count, st.dice.slice(), 'dragon'); F.sel = new Set(); }
      if (st.phase === 'roll' && L.toss && F.tossDone(L) && !(st.toss && st.toss.n === L.tossN && st.dice.length)) F.clearToss(L);
      // the dice set aside this turn, in a row in front of whoever is rolling
      const kept = st.kept || [], cur = st.pl[st.turn], slot = cur ? seatIdx(t, cur.id, L) : 0, d = slot >= 0 ? dirOf(L, slot) : { x: 0, z: 1 }, px = { x: d.z, z: -d.x };
      while (L.kept.length < kept.length) { const m = F.dieMesh('dragon'); G.scene.add(m); m.position.set(L.cx, L.ty + 0.2, L.cz); L.kept.push(m); }
      while (L.kept.length > kept.length) G.scene.remove(L.kept.pop());
      L.kept.forEach((m, i) => { const off = (i - (kept.length - 1) / 2) * 0.055; m.position.lerp(V(L.cx + d.x * 0.86 + px.x * off, L.ty + F.DS / 2, L.cz + d.z * 0.62 + px.z * off), Math.min(1, dt * 8)); if (m.userData.v !== kept[i]) { m.userData.v = kept[i]; m.quaternion.copy(F.faceUpQuat(kept[i], ryToward(d))); } });
      // selected dice glow and lift a little
      (L.tossDice || []).forEach((m, i) => { const s = F.sel && F.sel.has(i) && st.pl[st.turn] && st.pl[st.turn].id === me(); F.dieGlow(m, s ? 0xffd040 : st.phase === 'farkle' ? 0x802010 : 0, s ? 0.5 : st.phase === 'farkle' ? 0.4 : 0); if (s && F.tossDone(L)) m.position.y = L.arena.y + F.DS / 2 + 0.025; });
      F.occupy(L, occL(L, t, (s) => { const p = st.pl.find(q => q.id === s.id); return p ? `${p.score} / ${GM.dice.target}${p === cur && st.tp ? ` · +${st.tp}` : ''}` : ''; }, cur && cur.id));
    },
    input(L, t, dt) {
      const st = t.st, i = st.pl.findIndex(p => p.id === me()), title = `Dragon Dice · first to ${GM.dice.target} · pot ${st.pot}`; if (i < 0) return { title };
      const mine = st.turn === i, P = st.pl[i]; F.sel = F.sel || new Set(); F.picks = [];
      let status = `You <b>${P.score}</b>${mine && st.tp ? ` · <b>${st.tp}</b> at stake` : ''}`;
      if (!mine || !['roll', 'choose'].includes(st.phase)) { F.shakeInput(dt, false); return { title, status: status + (st.phase === 'farkle' ? ' · the dragon sleeps!' : st.phase === 'over' ? ` · ${st.winner} wins` : ` · ${st.pl[st.turn].name} is rolling`), keys: [] }; }
      if (st.phase === 'choose' && F.tossDone(L)) (L.tossDice || []).forEach((m, k) => F.picks.push({ obj: m, onClick: () => { if (F.sel.has(k)) F.sel.delete(k); else F.sel.add(k); G.sfx('click', 0.4); } }));
      const idx = [...F.sel].sort(), selScore = idx.length ? A.diceScore(idx.map(k => st.dice[k])) : -1;
      if (st.phase === 'choose' && F.key('KeyB')) { if (selScore < 0) G.ui.toast('Pick scoring dice to bank (click them)'); else { TB.act(t.tid, { t: 'bank', idx }); F.sel = new Set(); } }
      if (st.phase === 'choose' && F.key('KeyQ')) { const b = A.bestKeep(st.dice); F.sel = new Set(b.idx); }
      F.shakeInput(dt, st.phase === 'roll' || (F.tossDone(L) && selScore >= 0), o => { if (st.phase === 'roll') TB.act(t.tid, Object.assign({ t: 'roll' }, o)); else { TB.act(t.tid, Object.assign({ t: 'keep', idx }, o)); F.sel = new Set(); } });
      if (st.phase === 'roll') return { title, status: status + ' · <b>your throw</b>', keys: [['LMB', 'hold to shake, release to throw']] };
      return { title, status: status + (idx.length ? ` · selected <b>${selScore < 0 ? 'not scoring' : '+' + selScore}</b>` : ' · click the dice you keep'), keys: [['LMB', 'click dice to set aside'], ['Q', 'pick the best'], ['LMB', 'hold elsewhere: throw the rest', selScore >= 0], ['B', `bank ${selScore >= 0 ? st.tp + selScore : ''}`, selScore >= 0]] };
    },
    clear(L) { (L.kept || []).forEach(m => G.scene.remove(m)); L.kept = []; }
  };

  /* ================= Bone Chess ================= */
  const CH = G.chess, SQ = 0.085;
  F.C.chess = {
    slotOf: (L, t, id) => { const st = t.st; if (!st || !st.pl) return -1; return st.pl.findIndex(p => p.id === id); },
    sync(L, t) {
      if (!t || !t.st || !t.st.pl) { F.occupy(L, []); return; }
      const st = t.st; F.occupy(L, st.pl.map((p, i) => ({ slot: i, id: p.id, name: p.name, npc: p.npc, sub: (i === 0 ? 'bone legion' : 'obsidian court') + (+t.opts.clock ? ` · ${Math.max(0, Math.ceil((p.clock - (GM.chess.side(st) === p && st.phase === 'play' ? now() - st.turnAt : 0)) / 1000 / 60 * 10) / 10)}m` : ''), hot: st.phase === 'play' && GM.chess.side(st) === p })));
    },
    input(L, t) {
      const st = t.st, i = st.pl.findIndex(p => p.id === me()), B = CH.boards[L.board], title = `Bone Chess · pot ${st.pot}`; if (i < 0 || !B) return { title };
      const S = { b: st.b, w: st.w, cs: st.cs, ep: st.ep, hm: st.hm, fm: st.fm }, mine = GM.chess.myTurn(t, me());
      // an invisible plane over the board catches the crosshair; discs show where the chosen piece can go
      if (!L.plane) { L.plane = new THREE.Mesh(new THREE.PlaneGeometry(SQ * 8, SQ * 8), new THREE.MeshBasicMaterial({ visible: false })); L.plane.rotation.x = -Math.PI / 2; L.plane.position.set(B.x, 0.8, B.z); G.scene.add(L.plane); L.extra.push(L.plane); L.marks = []; }
      const sqAt = p => { const f = Math.round((p.x - B.x) / SQ + 3.5), r = Math.round(3.5 - (p.z - B.z) / SQ); return f >= 0 && f < 8 && r >= 0 && r < 8 ? r * 8 + f : -1; };
      const legal = mine ? CH.legal(Object.assign({}, S, { b: S.b.split('') })) : [];
      const selSq = F.chSel && F.chSel.tid === t.tid ? F.chSel.sq : -1, targets = legal.filter(m => m.f === selSq);
      // marks
      const want = targets.map(m => ({ sq: m.t, cap: st.b[m.t] !== '.' || m.k === 'ep' })).concat(selSq >= 0 ? [{ sq: selSq, sel: true }] : []).concat(st.last ? [{ sq: st.last.f, last: true }, { sq: st.last.t, last: true }] : []);
      while (L.marks.length < want.length) { const m = new THREE.Mesh(new THREE.RingGeometry(0.012, 0.03, 20), new THREE.MeshBasicMaterial({ color: 0x60ff90, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; G.scene.add(m); L.marks.push(m); L.extra.push(m); }
      L.marks.forEach((m, k) => { const w = want[k]; m.visible = !!w; if (!w) return; const p = CH.sqPos(B, w.sq); m.position.set(p.x, 0.796, p.z); m.material.color.setHex(w.sel ? 0xffe08a : w.last ? 0xb08040 : w.cap ? 0xff5040 : 0x60ff90); m.scale.setScalar(w.cap || w.sel ? 1.35 : w.last ? 1.2 : 0.8); m.material.opacity = w.last ? 0.4 : 0.85; });
      B.meshes.forEach(m => { const lift = m.userData.sq === selSq && !m.userData.from; m.position.y = G.damp(m.position.y, 0.792 + (lift ? 0.04 : 0), 12, 1 / 60); });
      F.picks = mine ? [{ obj: L.plane, onClick: () => { const sq = sqAt(F.hover && F.hover.pt || V(0, 0, 0)); if (sq < 0) return; const selSq = F.chSel && F.chSel.tid === t.tid ? F.chSel.sq : -1; if (selSq >= 0) { const ms = legal.filter(m => m.f === selSq && m.t === sq); if (ms.length) { if (ms[0].p) { F.chPromo = { tid: t.tid, f: selSq, t: sq }; return; } TB.act(t.tid, { t: 'move', f: selSq, to: sq }); F.chSel = null; G.sfx('click', 0.5); return; } } const c = st.b[sq]; F.chSel = c !== '.' && (c >= 'A' && c <= 'Z') === st.w && legal.some(m => m.f === sq) ? { tid: t.tid, sq } : null; if (F.chSel) G.sfx('click', 0.3); } }] : [];
      if (F.chPromo && F.chPromo.tid === t.tid) { const P2 = F.chPromo; ['q', 'r', 'b', 'n'].forEach((p, k) => { if (F.key('Digit' + (k + 1))) { TB.act(t.tid, { t: 'move', f: P2.f, to: P2.t, p }); F.chPromo = null; F.chSel = null; } }); return { title, status: 'Raise your skeleton to…', keys: [['1', 'Banshee Queen'], ['2', 'Crypt Tower'], ['3', 'Necromancer'], ['4', 'Bone Steed']] }; }
      if (F.key('KeyD') && st.phase === 'play') TB.act(t.tid, { t: 'draw' });
      if (F.key('KeyG') && st.phase === 'play') { if (F.resignT && now() - F.resignT < 2500) { TB.act(t.tid, { t: 'resign' }); F.resignT = 0; } else { F.resignT = now(); G.ui.toast('Press G again to resign'); } }
      const chk = CH.inCheck(Object.assign({}, S, { b: S.b.split('') })), side = GM.chess.side(st);
      const status = st.phase === 'over' ? `${st.result < 0 ? 'Draw' : st.pl[st.result].name + ' wins'} · ${st.why}` : `${mine ? '<b>Your move</b>' : side.name + ' is thinking'}${chk ? ' · <b>check!</b>' : ''}${st.last ? ` · last: ${st.last.san}` : ''}${st.drawOffer && st.drawOffer !== i + 1 ? ' · they offer a draw (D accepts)' : ''}`;
      return { title, status, keys: [['LMB', 'pick a piece, then its square', mine], ['D', st.drawOffer === i + 1 ? 'withdraw draw offer' : st.drawOffer ? 'accept draw' : 'offer a draw', st.phase === 'play'], ['G', 'resign (twice)', st.phase === 'play']] };
    },
    clear(L) { }
  };

  /* ================= Rat Races: bet from the rail ================= */
  F.preInput = (dt) => {
    const t = A.ratState, P = G.player, rt = A.spots && A.spots.rats; F.rats = false;
    if (!t || t.closed || !P || !rt || !t.seats.some(s => s.id === me()) || G.ui.modalOpen()) { if (F.ratHud) { F.ratHud = false; F.hud(null); } return; }
    if (Math.abs(P.pos.x - (rt.x + 7)) > 10 || Math.abs(P.pos.z - rt.z) > 7) { if (F.ratHud) { F.ratHud = false; F.hud(null); } return; }
    F.rats = true; F.ratHud = true; const st = t.st, Fm = TB.form.ratAmt || (TB.form.ratAmt = { amt: Math.min(50, t.buy) });
    if (F.wheel) { Fm.amt = G.clamp(Fm.amt - F.wheel * 10, 1, t.buy); F.wheel = 0; }
    if (st.phase === 'bet') for (let k = 1; k <= 6; k++) if (F.key('Digit' + k)) { const amt = Math.round(G.clamp(Fm.amt, 1, t.buy)); if (G.save.gold < amt) G.ui.toast('Not enough gold'); else { G.save.gold -= amt; G.persist(); G.sfx('coin', 0.6); TB.act(t.tid, { t: 'bet', rat: k - 1, amt }); } }
    if (st.phase === 'bet' && t.host === me() && st.bets.length && F.key('KeyG')) TB.act(t.tid, { t: 'go' });
    const mine = r => st.bets.filter(b => b.rat === r && b.id === me()).reduce((a, b) => a + b.amt, 0);
    F.hud({ title: st.phase === 'bet' ? (st.at ? `Bets close in ${Math.max(0, Math.ceil((st.at - now()) / 1000))}s` : 'Rat Races · place a bet to start the countdown') : st.phase === 'race' ? 'And they\'re off!' : `${st.rats[st.winner].n} wins!`,
      status: st.rats.map((r, i) => `<span style="white-space:nowrap">${i + 1}. ${r.n} <b>×${r.odds}</b>${mine(i) ? ` (${mine(i)})` : ''}</span>`).join(' · '),
      keys: st.phase === 'bet' ? [['1–6', `bet ${Fm.amt} on a rat`], ['wheel', 'stake'], t.host === me() && st.bets.length ? ['G', 'start the race'] : null] : [], log: st.log });
  };

  /* ================= Madame Morta's reading, face to face ================= */
  const TAROT_TEX = {};
  const tarotTex = (i, rev) => { const key = i + ':' + (rev ? 1 : 0); if (TAROT_TEX[key]) return TAROT_TEX[key]; const C = A.TAROT[i], c = document.createElement('canvas'); c.width = 256; c.height = 410; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 410); g.addColorStop(0, rev ? '#ead0c8' : '#f4e8c8'); g.addColorStop(1, rev ? '#b88c84' : '#c8b088'); x.fillStyle = g; x.fillRect(0, 0, 256, 410); x.strokeStyle = '#7a5a28'; x.lineWidth = 8; x.strokeRect(4, 4, 248, 402); x.strokeStyle = 'rgba(90,60,20,.5)'; x.lineWidth = 2; x.strokeRect(16, 16, 224, 378);
    x.fillStyle = '#2a1a10'; x.textAlign = 'center'; x.font = 'bold 28px Georgia'; x.fillText(['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'][i], 128, 52);
    x.save(); x.translate(128, 170); if (rev) x.rotate(Math.PI); x.font = '110px serif'; x.textBaseline = 'middle'; x.fillText(C.s, 0, 0); x.restore();
    x.font = '600 26px Georgia'; x.textBaseline = 'alphabetic'; x.fillText(C.n, 128, 290); if (rev) { x.fillStyle = '#8a1020'; x.font = 'italic 20px Georgia'; x.fillText('Reversed', 128, 318); }
    x.fillStyle = '#2a1a10'; x.font = '17px Georgia'; const words = (rev ? C.r : C.u).split(' '); let line = '', y = 346; words.forEach(w => { if (x.measureText(line + w).width > 210) { x.fillText(line, 128, y); line = ''; y += 21; } line += w + ' '; }); x.fillText(line, 128, y);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return (TAROT_TEX[key] = t); };
  const tarotBack = (() => { let t = null; return () => { if (t) return t; const c = document.createElement('canvas'); c.width = 256; c.height = 410; const x = c.getContext('2d'), g = x.createRadialGradient(128, 205, 10, 128, 205, 230); g.addColorStop(0, '#4a1060'); g.addColorStop(1, '#14041c'); x.fillStyle = g; x.fillRect(0, 0, 256, 410); x.strokeStyle = '#c8a040'; x.lineWidth = 6; x.strokeRect(10, 10, 236, 390); x.fillStyle = '#c8a040'; x.font = '120px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('☠', 128, 205); for (let k = 0; k < 8; k++) { x.beginPath(); x.arc(128, 205, 100 + k * 3, 0, 7); x.strokeStyle = `rgba(200,160,64,${0.15 - k * 0.015})`; x.stroke(); } t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; }; })();
  const tarotGeo = new THREE.BoxGeometry(0.12, 0.0015, 0.192);
  F.tarotStart = () => {
    const at = A.tarotAt; if (!at || F.seated) return;
    F.tarot = { L: { key: 'tarot', game: 'tarot', cx: at.x, cz: at.z, seats: [at.seat], eye: 1.2, pitch: -0.4, deckAt: at.deck }, cards: [], t: 0 };
    F.sit(F.tarot.L, 0); if (G.save.fortune) F.tarotLay(true);
  };
  F.tarotLay = (already) => {
    const X = F.tarot, at = A.tarotAt; X.cards.forEach(c => G.scene.remove(c.m)); X.cards = []; X.t = 0; X.done = !!already;
    (G.save.fortune || []).forEach((f, k) => { const face = new THREE.MeshStandardMaterial({ map: tarotTex(f.i, f.rev), roughness: 0.6, emissive: 0x6030a0, emissiveIntensity: 0 }), back = new THREE.MeshStandardMaterial({ map: tarotBack(), roughness: 0.6 }), edge = new THREE.MeshStandardMaterial({ color: 0xc8b088 });
      const m = new THREE.Mesh(tarotGeo, [edge, edge, face, back, edge, edge]); m.castShadow = true; const to = V(at.x + (k - 1) * 0.16, 0.845, at.z + 0.36); m.position.copy(already ? to : V(at.deck.x, at.deck.y, at.deck.z)); m.rotation.set(0, Math.PI, already ? 0 : Math.PI); G.scene.add(m);
      X.cards.push({ m, face, to, from: m.position.clone(), f, k, flip: already ? 1 : 0, at: already ? 0 : 0.35 + k * 0.45, flipAt: already ? 0 : 2.0 + k * 1.1 }); });
    if (!already && A.witchR) T.gesture(A.witchR, 'deal', 2.2);
  };
  F.tarotTick = (dt) => {
    const X = F.tarot; if (!X) return; X.t += dt;
    X.cards.forEach(c => { const m = c.m; const k = G.clamp((X.t - c.at) / 0.6, 0, 1), s = k * k * (3 - 2 * k); if (k < 1) { m.position.lerpVectors(c.from, c.to, s); m.position.y += Math.sin(s * Math.PI) * 0.18; }
      const fk = c.flipAt ? G.clamp((X.t - c.flipAt) / 0.5, 0, 1) : 1; if (fk > 0 && c.flip < 1 && fk >= 1) { G.fx.spark(m.position.clone().add(V(0, 0.05, 0)), c.f.rev ? 0xff4060 : 0xd0a0ff, 16, 1.4, 0.6, 0.03, 0); G.sfx(c.f.rev ? 'groan' : 'magic', 0.35); }
      c.flip = Math.max(c.flip, fk); m.rotation.z = (1 - c.flip) * Math.PI; if (k >= 1) m.position.y = 0.845 + Math.sin(c.flip * Math.PI) * 0.08 * (c.flip < 1 ? 1 : 0); c.face.emissiveIntensity = Math.sin(c.flip * Math.PI) * 1.2;
      m.rotation.y = c.f.rev ? 0 : Math.PI; });
    if (!X.done && X.cards.length && X.cards.every(c => c.flip >= 1)) { X.done = true; if (A.witchR && X.cards.filter(c => c.f.rev).length >= 2) { T.gesture(A.witchR, 'cackle', 1.6); G.sfx('cackle', 0.6); } }
  };
  F.tarotInput = () => {
    const X = F.tarot; if (!X) return; const has = !!G.save.fortune, cost = has ? 35 : 25;
    if (F.key('Space') && (X.done || !X.cards.length)) { if (G.save.gold < cost) G.ui.toast('Madame Morta does not read for free'); else { A.tarotRead(); F.tarotLay(false); } }
    const shown = X.cards.filter(c => c.flip >= 1).map(c => `<b>${A.TAROT[c.f.i].n}${c.f.rev ? ' (reversed)' : ''}</b>: ${c.f.rev ? A.TAROT[c.f.i].r : A.TAROT[c.f.i].u}`);
    F.hud({ title: "Madame Morta's Tarot", status: shown.length ? shown.join('<br>') + (X.done ? '<br><small>The reading holds until your next descent.</small>' : '') : has ? '' : '"Cross my palm, dearie, and I\'ll show you what waits below."', keys: [['Space', has ? `ask again · ${cost} g` : `cross her palm · ${cost} g`, G.save.gold >= cost && (X.done || !X.cards.length)]], log: [] });
  };
  F.tarotEnd = () => { const X = F.tarot; if (!X) return; X.cards.forEach(c => G.scene.remove(c.m)); F.tarot = null; F.stand(); };
})();
