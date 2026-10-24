/* ============================================================
   Tavern tables: every game can seat your party
   - a player opens a table (with a buy-in they choose), friends in the hideout join it, empty seats can be
     filled with tavern regulars, and the opener's game runs the table and tells everyone what happens
   - buy-ins come out of each player's own gold; winnings and cash-outs are paid back the same way
   - games: Liar's Dice, Knucklebones, a knife-throwing contest, Blackjack (against the house) and
     Texas Hold'em (a cash game: buy in, play hands, cash out when you like). Pool lives in pool.js.
   - the cards are the tavern's own deck: Skulls, Blood, Gems and Bones; Ghouls, Witches and Liches
   ============================================================ */
'use strict';
(() => {
  const T = G.tavern, UI = G.ui, R = Math.random;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const TB = G.tables = { list: {}, host: {}, paid: new Set(), seated: {}, form: {}, timers: {}, turnSeen: {} };
  const GM = TB.GAMES = {};
  const me = () => G.net.myId(), myName = () => (G.settings.name || 'Adventurer').slice(0, 20), now = () => Date.now();
  const NPC_NAMES = ['Old Hollis', 'Mara Quickfingers', 'Dorrin', 'Grimsby the Gravedigger', 'Sister Ash', 'Skarn One-Eye', 'Pell the Lucky'];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* ================= messaging ================= */
  TB.send = (m) => { if (G.net.party) G.net.emit('sup', Object.assign({ k: 'tav' }, m)); };
  const sup0 = G.net.onSup.bind(G.net);
  G.net.onSup = function (d, peer) { if (d && d.k === 'tav') { try { TB.recv(d, peer); } catch (e) { console.warn(e); } return; } return sup0(d, peer); };
  TB.recv = (d, peer) => {
    if (d.op === 'tbl' && d.t && d.t.tid && GM[d.t.game]) { TB.absorb(d.t); return; }
    const t = TB.host[d.tid]; if (!t) return;   // only the table's host answers requests
    if (d.op === 'join') TB.hostJoin(t, peer, d.name);
    else if (d.op === 'leave') TB.hostLeave(t, peer, d.nopay);
    else if (d.op === 'act') TB.hostAct(t, peer, d.a || {});
  };
  TB.slotOf = (t, id) => { const s = t.seats.find(x => x.id === id); return s ? (s.slot ?? t.seats.indexOf(s)) : -1; };
  TB.clone = (t) => JSON.parse(JSON.stringify(t));
  TB.commit = (t) => {
    t.seats.forEach(s => { if (s.slot === undefined) { let k = 0; while (t.seats.some(o => o.slot === k)) k++; s.slot = k; } });   // a seat keeps its chair when others come and go
    t.ver = (t.ver || 0) + 1; if (t.pays.length > 40) t.pays = t.pays.slice(-40);
    const c = TB.clone(t); TB.send({ op: 'tbl', t: c }); TB.absorb(c); TB.plan(t);
  };
  TB.pay = (t, to, amt, why, quiet) => { amt = Math.round(amt || 0); if (!to || amt <= 0 || String(to).startsWith('npc:')) return; t.pays.push(Object.assign({ p: t.tid + ':' + (++t.pc), to, amt, why: why || '' }, quiet ? { q: 1 } : {})); };
  TB.say = (t, line) => { if (!t.st) return; t.st.log = t.st.log || []; t.st.log.unshift(line); t.st.log = t.st.log.slice(0, 14); };

  // every client (the host too) folds table updates in here
  TB.absorb = (t) => {
    const old = TB.list[t.tid]; if (old && (old.ver || 0) > (t.ver || 0)) return;
    TB.list[t.tid] = t; const id = me(), g = GM[t.game], seat = t.seats.findIndex(s => s.id === id);
    // buy in when first seated (and again for a rematch)
    if (seat >= 0 && TB.leftVer && TB.leftVer[t.tid] !== undefined && (t.ver || 0) <= TB.leftVer[t.tid]) { delete TB.list[t.tid]; if (UI.panelKind === t.game && !document.getElementById('panelM').hidden) UI.renderPanel(); return; }
    if (seat >= 0 && g.payOnSeat !== false && !t.closed) {
      const paidR = TB.seated[t.tid];
      if (paidR === undefined || paidR < (t.round || 0)) {
        if (G.save.gold < t.buy) { G.ui.toast('Not enough gold for the buy-in'); TB.seated[t.tid] = t.round || 0; TB.leave(t.tid, true); }
        else { TB.seated[t.tid] = t.round || 0; if (t.buy) { G.save.gold -= t.buy; G.persist(); G.sfx('coin', 0.6); } }
      }
    } else if (seat >= 0) TB.seated[t.tid] = TB.seated[t.tid] ?? (t.round || 0);
    if (seat < 0 && !t.closed) delete TB.seated[t.tid];
    (t.pays || []).forEach(p => { if (p.to === id && !TB.paid.has(p.p)) { TB.paid.add(p.p); G.save.gold += p.amt; G.persist(); G.sfx('coin', p.q ? 0.3 : 0.9); if (!p.q) G.ui.toast(`${p.why ? p.why + ' · ' : ''}+${p.amt} gold`); } });
    if (t.closed) { delete TB.list[t.tid]; delete TB.seated[t.tid]; }
    if (g.onState) g.onState(t, seat);
    // a nudge when it becomes your turn and the table isn't open in front of you
    const mine = !t.closed && seat >= 0 && t.phase === 'play' && g.myTurn && g.myTurn(t, id), key = t.tid;
    if (mine && !TB.turnSeen[key] && (UI.panelKind !== t.game || document.getElementById('panelM').hidden)) { G.ui.toast(`Your turn · ${g.name}`); G.sfx('click', 0.8); }
    TB.turnSeen[key] = !!mine;
    if (UI.panelKind === t.game && !document.getElementById('panelM').hidden) UI.renderPanel();
  };
  // the host runs regulars' turns and timed steps
  TB.plan = (t) => {
    clearTimeout(TB.timers[t.tid]); if (t.closed || t.phase !== 'play' || TB.host[t.tid] !== t) return;
    const g = GM[t.game], n = g.next && g.next(t); if (!n) return;
    TB.timers[t.tid] = setTimeout(() => { if (TB.host[t.tid] !== t || t.closed) return; if (n.fn(t) !== false) TB.commit(t); else TB.plan(t); }, Math.max(0, n.wait));
  };

  /* ================= opening, joining, leaving ================= */
  TB.create = (game, buy, opts) => {
    const g = GM[game]; buy = Math.round(G.clamp(+buy || g.defBuy, g.minBuy, g.maxBuy));
    if (g.payOnSeat !== false && G.save.gold < buy) { G.ui.toast('Not enough gold for that buy-in'); return; }
    if (TB.mineFor(game)) { G.ui.toast('You are already at a table for this game'); return; }
    if (g.canOpen && !g.canOpen()) return;
    const t = { tid: String(me()).slice(-6) + (now() % 1e8).toString(36) + Math.floor(R() * 999), game, host: me(), hostName: myName(), buy, opts: Object.assign({}, g.defOpts || {}, opts || {}), seats: [{ id: me(), name: myName() }], phase: 'lobby', st: null, ver: 0, pays: [], pc: 0, round: 0 };
    TB.host[t.tid] = t; TB.commit(t); G.sfx('dice', 0.4);
    if (G.net.party) TB.send({ op: 'tbl', t: TB.clone(t) });
  };
  TB.join = (tid) => {
    const t = TB.list[tid]; if (!t) return; const g = GM[t.game];
    if (g.payOnSeat !== false && G.save.gold < t.buy) { G.ui.toast('Not enough gold for the buy-in'); return; }
    if (TB.mineFor(t.game)) { G.ui.toast('Leave your other table first'); return; }
    if (t.host === me()) TB.hostJoin(TB.host[tid], me(), myName()); else TB.send({ op: 'join', tid, name: myName() });
  };
  TB.hostJoin = (t, id, name) => {
    const g = GM[t.game]; if (!t || t.closed || t.seats.some(s => s.id === id) || t.seats.length >= TB.maxSeats(t)) return;
    if (t.phase !== 'lobby' && !g.joinLate) return;
    const s = { id, name: String(name || 'Adventurer').slice(0, 20) }; t.seats.push(s);
    if (t.phase === 'play' && g.addLate) g.addLate(t, s);
    TB.say(t, `${s.name} sits down`); TB.commit(t);
  };
  TB.leave = (tid, nopay) => {
    const t = TB.list[tid]; if (!t) return;
    if (t.host === me()) { TB.close(tid); return; }
    (TB.leftVer || (TB.leftVer = {}))[tid] = t.ver || 0; TB.send({ op: 'leave', tid, nopay: !!nopay });
  };
  TB.hostLeave = (t, id, nopay) => {
    const i = t.seats.findIndex(s => s.id === id); if (i < 0) return; const g = GM[t.game], s = t.seats[i];
    const amt = nopay ? 0 : t.phase === 'lobby' ? (g.payOnSeat !== false ? t.buy : 0) : (g.leave ? g.leave(t, id) : 0);
    TB.pay(t, id, amt, t.phase === 'lobby' ? 'Buy-in returned' : 'Cashed out');
    t.seats.splice(i, 1); TB.say(t, `${s.name} leaves the table`);
    if (!t.seats.some(x => !x.npc)) { TB.close(t.tid); return; }
    TB.commit(t);
  };
  TB.close = (tid) => {
    const t = TB.host[tid]; if (!t) return; const g = GM[t.game];
    t.seats.forEach(s => { if (s.npc) return; const amt = t.phase === 'lobby' ? (g.payOnSeat !== false ? t.buy : 0) : (g.closeOut ? g.closeOut(t, s.id) : 0); TB.pay(t, s.id, amt, 'Table closed'); });
    t.closed = true; clearTimeout(TB.timers[tid]); TB.commit(t); delete TB.host[tid];
    if (g.onClose) g.onClose(t);
  };
  TB.act = (tid, a) => { const t = TB.list[tid]; if (!t) return; if (t.host === me()) TB.hostAct(TB.host[tid], me(), a); else TB.send({ op: 'act', tid, a }); };
  TB.maxSeats = (t) => { const g = GM[t.game]; return g.maxSeats ? g.maxSeats(t) : g.max; };
  TB.hostAct = (t, id, a) => {
    if (!t || t.closed) return; const g = GM[t.game], isHost = id === t.host;
    if (a.t === 'rematch' && isHost && (t.phase === 'over' || (t.st && t.st.phase === 'over'))) { t.phase = 'lobby'; t.st = null; t.round = (t.round || 0) + 1; TB.commit(t); return; }
    if (t.phase === 'lobby') {
      if (!isHost) return;
      if (a.t === 'npc' && g.npc && t.seats.length < TB.maxSeats(t)) { const used = t.seats.map(s => s.name); const nm = NPC_NAMES.find(n => !used.includes(n)) || 'A regular'; t.seats.push({ id: 'npc:' + nm, name: nm, npc: true }); }
      else if (a.t === 'kick') { const s = t.seats[a.i | 0]; if (s && s.npc) t.seats.splice(a.i | 0, 1); }
      else if (a.t === 'opt' && g.opts && g.opts[a.k]) { t.opts[a.k] = a.v; while (t.seats.length > TB.maxSeats(t)) { const j = t.seats.map(s => !!s.npc).lastIndexOf(true); if (j < 0) break; t.seats.splice(j, 1); } }
      else if (a.t === 'start') { if (t.seats.length < (g.minSeats ? g.minSeats(t) : g.min)) { return; } t.phase = 'play'; t.st = { log: [] }; g.start(t); TB.say(t, 'The game begins'); }
      else return;
      TB.commit(t); return;
    }
    if (t.phase === 'play' && g.act(t, id, a) !== false) TB.commit(t);
  };
  TB.mineFor = (game) => Object.values(TB.list).find(t => t.game === game && !t.closed && t.seats.some(s => s.id === me()));
  // housekeeping: hosts re-announce their tables (late arrivals see them) and drop absent players;
  // guests notice when a host vanishes and take back what's theirs
  setInterval(() => {
    const ids = G.net.party ? new Set(G.net.members().filter(p => p.presence && p.presence.s === 'hideout').map(p => p.peer)) : null;
    Object.values(TB.host).forEach(t => { if (G.net.party) TB.send({ op: 'tbl', t: TB.clone(t) }); if (ids) t.seats.filter(s => !s.npc && s.id !== me() && !ids.has(s.id)).forEach(s => TB.hostLeave(t, s.id, false)); });
    Object.values(TB.list).forEach(t => {
      if (t.host === me() || t.closed) return; const gone = !G.net.party || !G.net.members().some(p => p.peer === t.host && p.presence && p.presence.s === 'hideout');
      if (!gone) return; const g = GM[t.game], seated = t.seats.some(s => s.id === me()), key = t.tid + ':gone';
      if (seated && !TB.paid.has(key)) { TB.paid.add(key); const amt = t.phase === 'lobby' ? (g.payOnSeat !== false ? t.buy : 0) : (g.closeOut ? g.closeOut(t, me()) : 0); if (amt > 0) { G.save.gold += Math.round(amt); G.persist(); G.ui.toast(`The table's host left · +${Math.round(amt)} gold returned`); } }
      delete TB.list[t.tid]; delete TB.seated[t.tid]; if (g.onClose) g.onClose(t);
      if (UI.panelKind === t.game && !document.getElementById('panelM').hidden) UI.renderPanel();
    });
  }, 4000);
  // leaving the hideout gets up from every table
  TB.leaveAll = () => { Object.values(TB.list).forEach(t => { if (t.seats.some(s => s.id === me())) TB.leave(t.tid); }); Object.keys(TB.host).forEach(tid => TB.close(tid)); };
  const ns0 = G.game.netStart.bind(G.game);
  G.game.netStart = function (d) { if (!G.run.active && G.state === 'play' && d && !G.loading) TB.leaveAll(); return ns0(d); };

  /* ================= the tavern's cards ================= */
  const SUIT_SVG = [
    // skulls
    '<svg viewBox="0 0 20 20"><path d="M10 1.8a7.2 7.2 0 0 0-7.2 7.2c0 2.6 1.3 4.2 3 5.2v3.2h8.4v-3.2c1.7-1 3-2.6 3-5.2A7.2 7.2 0 0 0 10 1.8z" fill="currentColor"/><circle cx="7" cy="9.4" r="1.9" fill="#f2e6c8"/><circle cx="13" cy="9.4" r="1.9" fill="#f2e6c8"/><path d="M9.1 12.8h1.8L10 14.6z" fill="#f2e6c8"/><path d="M8 16.4v1.4M10 16.4v1.4M12 16.4v1.4" stroke="#f2e6c8" stroke-width=".7"/></svg>',
    // blood
    '<svg viewBox="0 0 20 20"><path d="M10 1.5C10 1.5 3.8 9 3.8 13a6.2 6.2 0 0 0 12.4 0C16.2 9 10 1.5 10 1.5z" fill="currentColor"/><path d="M7 12.5a3 3 0 0 0 2 3" stroke="#f2e6c8" stroke-width="1" fill="none" opacity=".7"/></svg>',
    // gems
    '<svg viewBox="0 0 20 20"><path d="M5 3h10l3.5 5L10 18.5 1.5 8z" fill="currentColor"/><path d="M1.5 8h17M5 3l2.6 5L10 18.5 12.4 8 15 3M7.6 8L10 3l2.4 5" stroke="#f2e6c8" stroke-width=".6" fill="none" opacity=".75"/></svg>',
    // bones
    '<svg viewBox="0 0 20 20"><g fill="currentColor"><g transform="rotate(45 10 10)"><rect x="3.2" y="8.6" width="13.6" height="2.8" rx="1.4"/><circle cx="3.2" cy="8.4" r="1.9"/><circle cx="3.2" cy="11.6" r="1.9"/><circle cx="16.8" cy="8.4" r="1.9"/><circle cx="16.8" cy="11.6" r="1.9"/></g><g transform="rotate(-45 10 10)"><rect x="3.2" y="8.6" width="13.6" height="2.8" rx="1.4"/><circle cx="3.2" cy="8.4" r="1.9"/><circle cx="3.2" cy="11.6" r="1.9"/><circle cx="16.8" cy="8.4" r="1.9"/><circle cx="16.8" cy="11.6" r="1.9"/></g></g></svg>'
  ];
  const SUIT_NAME = ['Skulls', 'Blood', 'Gems', 'Bones'], RANK = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'], FACE_NAME = { 9: 'Ghoul', 10: 'Witch', 11: 'Lich', 12: 'Ace' };
  const cr = c => c >> 2, cs = c => c & 3;
  TB.SUIT_SVG = SUIT_SVG; TB.RANK = RANK; TB.SUIT_NAME = SUIT_NAME;
  TB.card = (c, o = {}) => {
    if (c === undefined || c === null || o.back) return `<span class="tcard back ${o.small ? 'sm' : ''}">${SUIT_SVG[0]}</span>`;
    const r = cr(c), s = cs(c), red = s === 1 || s === 2;
    const mid = r >= 9 && r <= 11 ? `<span class="fc">${{ 9: '☠', 10: '🜏', 11: '♛' }[r]}</span><small class="fn">${FACE_NAME[r]}</small>` : `<span class="pip">${SUIT_SVG[s]}</span>`;
    return `<span class="tcard ${red ? 'red' : ''} ${o.small ? 'sm' : ''} ${o.hl ? 'hl' : ''}" title="${RANK[r]} of ${SUIT_NAME[s]}"><b class="rk">${RANK[r]}</b><i class="cs">${SUIT_SVG[s]}</i>${mid}<b class="rk2">${RANK[r]}</b></span>`;
  };
  TB.deck = (n = 1) => { const d = []; for (let k = 0; k < n; k++) for (let c = 0; c < 52; c++) d.push(c); return shuffle(d); };

  /* ================= styles ================= */
  const css = document.createElement('style');
  css.textContent = `.tbhead{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin-bottom:10px;font-family:var(--head);color:#f3d998}.tbhead small{color:#c8b890;font-family:inherit;opacity:.85}
.tseats{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 12px}.tseat{display:flex;align-items:center;gap:8px;background:rgba(30,22,10,.6);border:1px solid #5a4620;padding:6px 10px;border-radius:4px}.tseat.npc{border-style:dashed}.tseat.me{border-color:#f3d998}.tseat .tm{font-size:11px;padding:1px 6px;border-radius:3px;background:#3a2a10}
.tlist{display:flex;flex-direction:column;gap:6px;margin-bottom:14px}.trow{display:flex;align-items:center;gap:10px;background:rgba(30,22,10,.55);border:1px solid #5a4620;padding:8px 10px;border-radius:4px}.trow span{flex:1}
.tform{display:flex;flex-wrap:wrap;gap:10px;align-items:center;background:rgba(0,0,0,.25);border:1px solid #4a3a1a;padding:10px;border-radius:4px}.tform input[type=number]{width:90px;background:#1a140c;color:#f3d998;border:1px solid #6a5426;padding:5px 8px;font:inherit;border-radius:3px}.tform input[type=range]{width:160px}.tform select{background:#1a140c;color:#f3d998;border:1px solid #6a5426;padding:5px;font:inherit}
.tcard{position:relative;display:inline-block;width:54px;height:78px;border-radius:7px;background:linear-gradient(160deg,#f6ecd2,#ddcba0);border:2px solid #7a6038;box-shadow:0 2px 6px rgba(0,0,0,.5),inset 0 0 0 2px rgba(255,255,255,.25);color:#1a1410;margin-right:5px;vertical-align:middle;overflow:hidden}
.tcard.red{color:#8a0c1c}.tcard .rk{position:absolute;top:2px;left:4px;font:700 15px Georgia,serif;line-height:1}.tcard .rk2{position:absolute;bottom:2px;right:4px;font:700 15px Georgia,serif;line-height:1;transform:rotate(180deg)}.tcard .cs{position:absolute;top:18px;left:3px;width:12px;height:12px}.tcard svg{width:100%;height:100%;display:block}
.tcard .pip{position:absolute;left:50%;top:50%;width:28px;height:28px;transform:translate(-50%,-50%)}.tcard .fc{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);font-size:26px}.tcard .fn{position:absolute;left:0;right:0;bottom:12px;text-align:center;font:600 8px Georgia;letter-spacing:.08em;text-transform:uppercase}
.tcard::after{content:'';position:absolute;inset:3px;border:1px solid rgba(122,96,56,.45);border-radius:5px;pointer-events:none}
.tcard.back{background:radial-gradient(circle at 50% 50%,#5a1420,#24060c 70%);border-color:#c8a040;color:#c8a040}.tcard.back svg{position:absolute;left:50%;top:50%;width:30px;height:30px;transform:translate(-50%,-50%)}.tcard.back::after{border-color:rgba(200,160,64,.5);background:repeating-linear-gradient(45deg,transparent 0 5px,rgba(200,160,64,.08) 5px 6px)}
.tcard.sm{width:40px;height:58px}.tcard.sm .pip{width:20px;height:20px}.tcard.sm .rk,.tcard.sm .rk2{font-size:12px}.tcard.sm .fc{font-size:18px}.tcard.sm .fn{display:none}.tcard.hl{box-shadow:0 0 12px #f3d998,0 2px 6px rgba(0,0,0,.5);border-color:#f3d998}
.felt{background:radial-gradient(ellipse at center,#3a0c14,#1a0408 75%);border:3px solid #6a5030;border-radius:60px/40px;padding:14px 18px;box-shadow:inset 0 0 30px rgba(0,0,0,.7)}
.pk{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-top:10px}.pkseat{background:rgba(20,12,6,.75);border:1px solid #5a4620;border-radius:6px;padding:6px 8px;font-size:13px}.pkseat.turn{border-color:#f3d998;box-shadow:0 0 10px rgba(243,217,152,.3)}.pkseat.fold{opacity:.45}.pkseat.win{border-color:#7ac860;box-shadow:0 0 12px rgba(122,200,96,.4)}
.pkseat b{font-family:var(--head);color:#f3d998}.pkseat .chips{color:#e8d8b0}.pkseat .bet{color:#ffb060}.pkboard{display:flex;justify-content:center;gap:2px;min-height:82px;align-items:center}.pkpot{text-align:center;color:#f3d998;font-family:var(--head);margin:6px 0}
.tact{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px}.tact .note{margin:0}
.bjrow{display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:rgba(20,12,6,.6);border:1px solid #5a4620;border-radius:6px;padding:6px 10px;margin-top:8px}.bjrow.turn{border-color:#f3d998}.bjrow .who{min-width:130px;font-family:var(--head);color:#f3d998}.bjrow .who small{display:block;color:#c8b890;font-family:inherit}.bjv{font-family:var(--head);font-size:18px;color:#f3d998;min-width:40px}
.res-win{color:#8ad870}.res-lose{color:#e07060}.res-push{color:#c8c0a0}`;
  document.head.appendChild(css);

  /* ================= the shared panel: lobby, seats, game ================= */
  const render0 = UI.renderPanel.bind(UI);
  UI.renderPanel = function () {
    const k = this.panelKind, g = GM[k]; if (!g) return render0();
    const body = document.getElementById('panelBody'), set = (eye, title, sub) => { document.getElementById('panelEye').textContent = eye; document.getElementById('panelTitle').textContent = title; document.getElementById('panelSub').textContent = sub; };
    set(g.eye || 'The Grand Arcade', g.name, g.rules);
    const keep = body.querySelector('.tlog'); const scroll = keep ? keep.scrollTop : 0;
    body.innerHTML = TB.html(k); TB.bind(body, k);
  };
  TB.html = (k) => {
    const g = GM[k], t = TB.mineFor(k), S = G.save; let h = `<div class="goldline">Gold: ${S.gold}</div>`;
    if (!t) {
      const open = Object.values(TB.list).filter(x => x.game === k && !x.closed && (x.phase === 'lobby' || g.joinLate) && x.seats.length < TB.maxSeats(x));
      if (open.length) h += `<h3 class="sh">Open tables</h3><div class="tlist">${open.map(x => `<div class="trow"><span><b>${esc(x.hostName)}'s table</b> · ${x.seats.length}/${TB.maxSeats(x)} seated${g.optLabel ? ' · ' + g.optLabel(x) : ''} · ${x.phase === 'lobby' ? 'waiting to start' : 'in play'}</span><span>${g.buyLabel} ${x.buy} g</span><button class="btn small" data-join="${x.tid}" ${g.payOnSeat !== false && S.gold < x.buy ? 'disabled' : ''}>Join</button></div>`).join('')}</div>`;
      else h += `<p class="note">${G.net.party ? 'No open tables yet. Open one and your party can join from here.' : 'Open a table and fill the seats with tavern regulars. In a party, your friends can join it too.'}</p>`;
      const F = TB.form[k] || (TB.form[k] = { buy: g.defBuy });
      h += `<h3 class="sh">Open a table</h3><div class="tform"><label>${g.buyLabel} <input type="number" id="tbBuy" min="${g.minBuy}" max="${g.maxBuy}" step="${g.step || 5}" value="${F.buy}"></label><input type="range" id="tbBuyR" min="${g.minBuy}" max="${g.maxBuy}" step="${g.step || 5}" value="${F.buy}">${g.formExtra ? g.formExtra(F) : ''}<button class="btn small" id="tbOpen">Open table</button></div>`;
      if (g.lobbyExtra) h += g.lobbyExtra();
      return h;
    }
    const isHost = t.host === me(), mx = TB.maxSeats(t);
    h += `<div class="tbhead">${esc(t.hostName)}'s table <small>${g.buyLabel} ${t.buy} g · ${t.seats.length}/${mx} seats${g.optLabel ? ' · ' + g.optLabel(t) : ''}</small></div>`;
    if (t.phase === 'lobby') {
      h += `<div class="tseats">${t.seats.map((s, i) => `<span class="tseat ${s.npc ? 'npc' : ''} ${s.id === me() ? 'me' : ''}">${g.teamTag ? g.teamTag(t, i) : ''}${esc(s.name)}${s.id === t.host ? ' ★' : ''}${isHost && s.npc ? ` <button class="btn small" data-kick="${i}">✕</button>` : ''}</span>`).join('')}</div>`;
      if (isHost) {
        h += `<div class="tact">${g.npc && t.seats.length < mx ? '<button class="btn small" id="tbNpc">Add a regular</button>' : ''}${g.hostOpts ? g.hostOpts(t) : ''}<button class="btn small" id="tbStart" ${t.seats.length < (g.minSeats ? g.minSeats(t) : g.min) ? 'disabled' : ''}>Start</button><button class="btn small ghost" id="tbLeave">Close table</button></div>`;
        if (t.seats.length < (g.minSeats ? g.minSeats(t) : g.min)) h += `<p class="note">Needs ${g.minSeats ? g.minSeats(t) : g.min} players. ${g.npc ? 'Add a regular, or wait for friends to join.' : 'Wait for friends to join.'}</p>`;
      } else h += `<div class="tact"><span class="note">Waiting for ${esc(t.hostName)} to start…</span><button class="btn small ghost" id="tbLeave">Leave</button></div>`;
      return h;
    }
    h += g.view(t, me());
    const over = t.st && t.st.phase === 'over';
    h += `<div class="tact">${over && isHost ? '<button class="btn small" id="tbRematch">Rematch</button>' : ''}<button class="btn small ghost" id="tbLeave">${isHost ? 'Close table' : g.leaveLabel || 'Leave table'}</button></div>`;
    if (t.st && t.st.log && t.st.log.length) h += `<div class="tlog">${t.st.log.map(l => `<p>${esc(l)}</p>`).join('')}</div>`;
    return h;
  };
  TB.bind = (body, k) => {
    const g = GM[k], t = TB.mineFor(k), $ = id => body.querySelector('#' + id), F = TB.form[k] || (TB.form[k] = { buy: g.defBuy });
    body.querySelectorAll('[data-join]').forEach(b => b.onclick = () => TB.join(b.dataset.join));
    const bi = $('tbBuy'), br = $('tbBuyR'); if (bi) { bi.oninput = () => { F.buy = +bi.value; if (br) br.value = bi.value; }; } if (br) br.oninput = () => { F.buy = +br.value; if (bi) bi.value = br.value; };
    if ($('tbOpen')) $('tbOpen').onclick = () => TB.create(k, F.buy, g.formOpts ? g.formOpts(F, body) : {});
    if (g.bindForm) g.bindForm(body, F);
    if (!t) { if (g.bindLobby) g.bindLobby(body); return; }
    if ($('tbNpc')) $('tbNpc').onclick = () => TB.act(t.tid, { t: 'npc' });
    body.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => TB.act(t.tid, { t: 'kick', i: +b.dataset.kick }));
    if ($('tbStart')) $('tbStart').onclick = () => TB.act(t.tid, { t: 'start' });
    if ($('tbRematch')) $('tbRematch').onclick = () => TB.act(t.tid, { t: 'rematch' });
    if ($('tbLeave')) $('tbLeave').onclick = () => { TB.leave(t.tid); if (t.host !== me()) { delete TB.list[t.tid]; delete TB.seated[t.tid]; } setTimeout(() => UI.renderPanel(), 50); };
    if (g.bindHost) g.bindHost(body, t);
    if (t.phase === 'play' && g.bind) g.bind(body, t, me());
  };
  const seatOf = (t, id) => t.st && t.st.pl ? t.st.pl.findIndex(p => p.id === id) : -1;
  TB.seatOf = seatOf;
  const gest = (id, act, dur) => { const map = { 'npc:Old Hollis': () => G.World.liarsSeat && G.World.liarsSeat.npcs[0], 'npc:Mara Quickfingers': () => G.World.liarsSeat && G.World.liarsSeat.npcs[1], 'npc:Dorrin': () => G.World.knuckleNPC }; const f = (TB.npcModel && TB.npcModel(id)) ? () => TB.npcModel(id) : map[id]; if (f && T.gesture) T.gesture(f(), act, dur); };

  /* ================= Liar's Dice ================= */
  const FACE = T.FACE;
  GM.liars = {
    name: "Liar's Dice", icon: '🎲', min: 2, max: 6, npc: true, minBuy: 0, maxBuy: 500, defBuy: 20, step: 5, buyLabel: 'Stake',
    rules: 'Everyone rolls in secret. Bid how many of a face are on the whole table; ones are wild and count as anything. Raise the bid or call "Liar!" Wrong calls and false bids cost a die. Last one with dice takes the pot.',
    start(t) { const st = t.st; st.pl = t.seats.map(s => ({ id: s.id, name: s.name, npc: !!s.npc, n: 5, dice: [] })); st.pot = t.buy * t.seats.length; this.round(t, Math.floor(R() * st.pl.length)); },
    alive(st) { return st.pl.filter(p => p.n > 0); },
    total(st) { return this.alive(st).reduce((a, p) => a + p.n, 0); },
    round(t, starter) { const st = t.st; st.pl.forEach(p => p.dice = Array.from({ length: Math.max(0, p.n) }, () => G.ri(1, 6))); st.pl.forEach(p => gest(p.id, 'shake', 0.9)); st.bid = null; st.phase = 'bid'; st.turn = starter; st.reveal = null; let k = 0; while (st.pl[st.turn].n <= 0 && k++ < 9) st.turn = (st.turn + 1) % st.pl.length; TB.say(t, `New round. ${st.pl[st.turn].name} opens the bidding.`); st.at = now() + 60000; },
    legal(st, q, f) { const b = st.bid; if (f < 2 || f > 6 || q < 1) return false; return !b || q > b.q || (q === b.q && f > b.f); },
    myTurn(t, id) { const st = t.st; return st && st.phase === 'bid' && st.pl[st.turn] && st.pl[st.turn].id === id; },
    act(t, id, a) {
      const st = t.st, i = seatOf(t, id); if (i < 0 || st.phase !== 'bid' || st.turn !== i) return false;
      if (a.t === 'bid') { const q = a.q | 0, f = a.f | 0; if (!this.legal(st, q, f)) return false; st.bid = { q, f, by: i }; TB.say(t, `${st.pl[i].name} bids ${q} × ${FACE[f]}`); gest(id, 'point', 0.8); this.advance(t); return; }
      if (a.t === 'call' && st.bid) { this.call(t, i); return; }
      return false;
    },
    advance(t) { const st = t.st; let k = 0; do { st.turn = (st.turn + 1) % st.pl.length; } while (st.pl[st.turn].n <= 0 && k++ < 9); st.at = now() + 60000; },
    call(t, i) {
      const st = t.st, b = st.bid, caller = st.pl[i], count = this.alive(st).reduce((a, p) => a + p.dice.filter(d => d === b.f || d === 1).length, 0);
      const loser = count >= b.q ? i : b.by, L = st.pl[loser];
      TB.say(t, `${caller.name} calls "Liar!" There ${count === 1 ? 'is' : 'are'} ${count} × ${FACE[b.f]}. ${L.name} loses a die.`); gest(caller.id, 'slam', 0.6); gest(L.id, 'drink', 1.6);
      L.n--; st.phase = 'reveal'; st.reveal = { f: b.f, loser }; st.turn = loser; st.at = now() + 4500; this.checkOver(t);
    },
    checkOver(t) { const st = t.st, left = this.alive(st); if (left.length <= 1) { st.phase = 'over'; const w = left[0]; st.winner = w ? w.name : null; if (w) { TB.say(t, `${w.name} wins the pot of ${st.pot} gold!`); TB.pay(t, w.id, st.pot, "Liar's Dice"); } } },
    next(t) {
      const st = t.st;
      if (st.phase === 'reveal') return { wait: st.at - now(), fn: t => { let s = st.reveal.loser; if (st.pl[s].n <= 0) { let k = 0; do { s = (s + 1) % st.pl.length; } while (st.pl[s].n <= 0 && k++ < 9); } this.round(t, s); } };
      if (st.phase !== 'bid') return null; const p = st.pl[st.turn];
      if (p.npc) return { wait: 1100 + R() * 900, fn: t => this.npc(t, st.turn) };
      return { wait: st.at - now(), fn: t => { if (st.bid) this.call(t, st.turn); else { st.bid = { q: 1, f: 2, by: st.turn }; TB.say(t, `${p.name} dithers and mumbles "one two"`); this.advance(t); } } };
    },
    npc(t, i) {
      const st = t.st, p = st.pl[i], N = this.total(st), U = N - p.n, mine = f => p.dice.filter(d => d === f || d === 1).length, exp = f => mine(f) + U / 3, b = st.bid, slack = 0.4 + (p.name.length % 4) * 0.25, bluff = 0.12 + (p.name.length % 3) * 0.08;
      if (b && b.q > exp(b.f) + slack + (R() - 0.5)) { this.call(t, i); return; }
      let f = 2; for (let k = 3; k <= 6; k++) if (mine(k) > mine(f) || (mine(k) === mine(f) && R() < 0.3)) f = k;
      let q; if (!b) q = Math.max(1, Math.round(exp(f) - 0.8 - R()));
      else { q = f > b.f ? b.q : b.q + 1; if (q > exp(f) + 0.6 && R() > bluff) { if (b.q > exp(b.f) - 0.2) { this.call(t, i); return; } f = b.f; q = b.q + 1; } }
      if (b && R() < bluff * 0.5) q += 1;
      if (!this.legal(st, q, f)) { q = b ? b.q + 1 : 1; }
      st.bid = { q, f, by: i }; TB.say(t, `${p.name} bids ${q} × ${FACE[f]}`); gest(p.id, 'point', 0.8); this.advance(t);
    },
    leave(t, id) { const st = t.st, i = seatOf(t, id); if (i < 0) return 0; const p = st.pl[i]; if (st.phase !== 'over' && p.n > 0) { p.n = 0; p.dice = []; TB.say(t, `${p.name} folds their dice and walks away`); if (st.turn === i && st.phase === 'bid') { st.bid = null; this.advance(t); } this.checkOver(t); } return 0; },
    closeOut(t, id) { return t.st && t.st.phase !== 'over' ? t.buy : 0; },
    view(t, id) {
      const st = t.st, mi = seatOf(t, id), show = st.phase !== 'bid', blur = T.blur();
      let h = `<div class="tgame"><div class="goldline">Pot: ${st.pot} gold · ${this.total(st)} dice on the table${st.bid ? ` · Current bid: <b>${st.bid.q} × ${FACE[st.bid.f]}</b> by ${esc(st.pl[st.bid.by].name)}` : ''}</div>`;
      st.pl.forEach((p, i) => { const hit = d => show && st.reveal && (d === st.reveal.f || d === 1), mine = i === mi, cnt = p.dice.length;
        h += `<div class="seat ${st.turn === i && st.phase === 'bid' ? 'turn' : ''} ${p.n <= 0 && !(show && st.reveal && st.reveal.loser === i) ? 'out' : ''}"><span class="nm">${esc(mine ? 'You' : p.name)}<small>${p.n} ${p.n === 1 ? 'die' : 'dice'}${st.turn === i && st.phase === 'bid' && !mine ? ' · thinking…' : ''}</small></span><span class="dice" style="${mine ? blur : ''}">${p.dice.slice(0, cnt).map(d => mine || show ? `<span class="die ${hit(d) ? 'hit' : ''} ${d === 1 ? 'wild' : ''}">${FACE[d]}</span>` : '<span class="die hid">?</span>').join('')}</span></div>`; });
      if (st.phase === 'bid' && st.turn === mi) { const F = TB.form.liarsBid || (TB.form.liarsBid = { q: 1, f: 2 }); if (!this.legal(st, F.q, F.f)) { F.q = st.bid ? (st.bid.f < 6 ? st.bid.q : st.bid.q + 1) : 1; F.f = st.bid ? (st.bid.f < 6 ? st.bid.f + 1 : 2) : 2; }
        h += `<div class="bidrow"><span>Your bid:</span><button class="btn small" data-q="-1">−</button><span class="q">${F.q}</span><button class="btn small" data-q="1">+</button><span>×</span>${[2, 3, 4, 5, 6].map(f => `<button class="btn small facebtn ${F.f === f ? 'sel' : ''}" data-f="${f}">${FACE[f]}</button>`).join('')}<button class="btn small" id="ldBid" ${this.legal(st, F.q, F.f) ? '' : 'disabled'}>Bid</button>${st.bid ? '<button class="btn small" id="ldCall">Liar!</button>' : ''}</div>`; }
      else if (st.phase === 'reveal') h += '<p class="note">Counting the dice… the next round starts in a moment.</p>';
      else if (st.phase === 'over') h += `<p class="note">${st.winner ? esc(st.winner) + ' takes the pot.' : 'Nobody wins.'}</p>`;
      return h + '</div>';
    },
    bind(body, t, id) {
      const st = t.st, F = TB.form.liarsBid || (TB.form.liarsBid = { q: 1, f: 2 });
      body.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { F.q = G.clamp(F.q + +b.dataset.q, 1, this.total(st)); UI.renderPanel(); });
      body.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { F.f = +b.dataset.f; UI.renderPanel(); });
      const bb = body.querySelector('#ldBid'), bc = body.querySelector('#ldCall');
      if (bb) bb.onclick = () => TB.act(t.tid, { t: 'bid', q: F.q, f: F.f }); if (bc) bc.onclick = () => TB.act(t.tid, { t: 'call' });
    }
  };

  /* ================= Knucklebones ================= */
  const colScore = c => { const n = {}; c.forEach(v => n[v] = (n[v] || 0) + 1); return Object.entries(n).reduce((a, [v, k]) => a + v * k * k, 0); };
  const boardScore = b => b.reduce((a, c) => a + colScore(c), 0);
  GM.knuckle = {
    name: 'Knucklebones', icon: '🦴', min: 2, max: 2, npc: true, minBuy: 0, maxBuy: 500, defBuy: 10, step: 5, buyLabel: 'Stake',
    rules: 'Roll a die and place it in one of your three columns. Matching dice in a column multiply. Placing a die destroys every die of the same number in the opponent\'s matching column. When either board fills, the higher total takes the pot.',
    start(t) { const st = t.st; st.pl = t.seats.map(s => ({ id: s.id, name: s.name, npc: !!s.npc, b: [[], [], []] })); st.pot = t.buy * 2; st.turn = R() < 0.5 ? 0 : 1; st.phase = 'roll'; st.die = 0; st.tn = 0; st.at = now() + 60000; TB.say(t, `${st.pl[st.turn].name} goes first`); },
    myTurn(t, id) { const st = t.st; return st && (st.phase === 'place' || st.phase === 'roll') && st.pl[st.turn].id === id; },
    act(t, id, a) { const st = t.st, i = seatOf(t, id); if (st.turn !== i) return false; if (a.t === 'roll' && st.phase === 'roll') return this.roll(t, i, a); if (a.t !== 'place' || st.phase !== 'place') return false; return this.place(t, i, a.c | 0); },
    roll(t, i, a) { const st = t.st, o = { pow: G.clamp(+a.pow || 0.5, 0, 1), aim: G.clamp(+a.aim || 0, -0.6, 0.6), seed: (a.seed >>> 0) || ((R() * 4e9) >>> 0) }, L = G.fp && G.fp.L.knuckle; st.die = L ? G.fp.tossResult(L.arena, L.seats[i], o, 1)[0] : G.ri(1, 6); st.toss = Object.assign({ n: ++st.tn, seat: i, v: st.die }, o); st.phase = 'place'; st.at = now() + 60000; G.sfx('dice', 0.4); },
    place(t, i, c) {
      const st = t.st, P = st.pl[i], O = st.pl[1 - i]; if (!P.b[c] || P.b[c].length >= 3) return false;
      const v = st.die; P.b[c].push(v); const kn = O.b[c].filter(x => x === v).length; O.b[c] = O.b[c].filter(x => x !== v);
      TB.say(t, `${P.name} places ${FACE[v]} in column ${c + 1}${kn ? ` and knocks out ${kn} of ${O.name}'s!` : ''}`); if (kn) gest(O.id, 'slam', 0.7); else gest(P.id, 'point', 0.6);
      if (P.b.every(x => x.length >= 3) || O.b.every(x => x.length >= 3)) {
        const a = boardScore(st.pl[0].b), b = boardScore(st.pl[1].b); st.phase = 'over';
        if (a === b) { TB.say(t, `A draw, ${a} to ${b}. Stakes returned.`); st.pl.forEach(p => TB.pay(t, p.id, t.buy, 'Knucklebones draw')); st.winner = null; }
        else { const w = a > b ? st.pl[0] : st.pl[1]; st.winner = w.name; TB.say(t, `${w.name} wins ${Math.max(a, b)} to ${Math.min(a, b)}!`); TB.pay(t, w.id, st.pot, 'Knucklebones'); gest(w.id, 'cheer', 1.4); }
        return;
      }
      st.turn = 1 - i; st.die = 0; st.phase = 'roll'; st.at = now() + 60000;
    },
    next(t) { const st = t.st; if (st.phase !== 'place' && st.phase !== 'roll') return null; const p = st.pl[st.turn];
      if (st.phase === 'roll') return { wait: p.npc ? 1400 + R() * 800 : st.at - now(), fn: t => this.roll(t, st.turn, { pow: 0.3 + R() * 0.6, aim: (R() - 0.5) * 0.6 }) };
      if (p.npc) return { wait: 3200 + R() * 900, fn: t => this.ai(t) }; return { wait: st.at - now(), fn: t => { const c = [0, 1, 2].find(k => p.b[k].length < 3); this.place(t, st.turn, c); } }; },
    ai(t) { const st = t.st, i = st.turn, P = st.pl[i], O = st.pl[1 - i], v = st.die; let best = 0, bv = -1e9; for (let c = 0; c < 3; c++) { if (P.b[c].length >= 3) continue; const s = colScore(P.b[c].concat([v])) - colScore(P.b[c]) + (colScore(O.b[c]) - colScore(O.b[c].filter(x => x !== v))) * 1.1 + R() * 2; if (s > bv) { bv = s; best = c; } } this.place(t, i, best); },
    leave(t, id) { const st = t.st, i = seatOf(t, id); if (i < 0 || st.phase === 'over') return 0; const w = st.pl[1 - i]; st.phase = 'over'; st.winner = w.name; TB.say(t, `${st.pl[i].name} walks away. ${w.name} takes the pot.`); TB.pay(t, w.id, st.pot, 'Knucklebones'); return 0; },
    closeOut(t) { return t.st && t.st.phase !== 'over' ? t.buy : 0; },
    board(b, can) { return `<div class="kb">${b.map((c, i) => { const n = {}; c.forEach(v => n[v] = (n[v] || 0) + 1); return `<div class="col ${can && c.length < 3 ? 'can' : ''}" ${can && c.length < 3 ? `data-col="${i}"` : ''}>${c.map(v => `<span class="die ${n[v] === 2 ? 'x2' : n[v] === 3 ? 'x3' : ''}">${FACE[v]}</span>`).join('')}</div>`; }).join('')}</div><div class="kbsum">${b.map(c => `<span>${colScore(c)}</span>`).join('')}</div>`; },
    view(t, id) {
      const st = t.st, mi = Math.max(0, seatOf(t, id)), oi = 1 - mi, my = st.turn === mi && st.phase === 'place', blur = T.blur();
      let h = `<div class="tgame"><div class="goldline">Pot: ${st.pot} gold · ${st.phase === 'over' ? (st.winner ? esc(st.winner) + ' wins' : 'A draw') : my ? 'Your turn' : esc(st.pl[st.turn].name) + "'s turn"}</div><div class="kbwrap">`;
      h += `<div><h4>${esc(st.pl[oi].name)} · ${boardScore(st.pl[oi].b)}</h4>${this.board(st.pl[oi].b, false)}</div>`;
      h += `<div style="text-align:center"><h4>${my ? 'Your roll' : 'Their roll'}</h4><span class="die" style="width:64px;height:64px;font-size:58px;${my ? blur : ''}">${st.phase === 'place' ? FACE[st.die] : ''}</span></div>`;
      h += `<div><h4>You · ${boardScore(st.pl[mi].b)}</h4><div style="${blur}">${this.board(st.pl[mi].b, my)}</div>${my ? '<p class="note">Click a column to place your die.</p>' : ''}</div></div></div>`;
      return h;
    },
    bind(body, t) { body.querySelectorAll('[data-col]').forEach(b => b.onclick = () => TB.act(t.tid, { t: 'place', c: +b.dataset.col })); }
  };

  /* ================= knife-throwing contest ================= */
  GM.knives = {
    name: 'Darts', icon: '🎯', eye: 'The Gilded Tankard', min: 2, max: 6, npc: true, minBuy: 0, maxBuy: 500, defBuy: 20, step: 5, buyLabel: 'Stake',
    rules: 'Five darts each at the board in the tavern. Bull 50, then 25, 15, 10, 5 and 2 out to the rim. Your arm sways; hold right click to steady it while your breath lasts. Highest total takes the pot. Practice rounds cost 10 gold and pay out by score.',
    lobbyExtra() { return `<h3 class="sh">Practice</h3><div class="shop"><div class="shopitem"><div class="ic">🎯</div><div><h3>Five darts</h3><p>10 gold. Score 40+ for a little back, 175+ for 60 gold.${G.save.knifeBest ? ` Your best: ${G.save.knifeBest}.` : ''}</p></div><button class="btn small" id="knPractice" ${G.save.gold < 10 ? 'disabled' : ''}>Throw</button></div></div>`; },
    bindLobby(body) { const b = body.querySelector('#knPractice'); if (b) b.onclick = () => { UI.closePanel(); setTimeout(() => T.knifeStart(), 100); }; },
    start(t) { const st = t.st; st.pl = t.seats.map(s => ({ id: s.id, name: s.name, npc: !!s.npc, score: null, hits: [] })); st.pot = t.buy * t.seats.length; st.phase = 'throw'; st.at = now() + 180000; TB.say(t, 'Take your places at the lane'); },
    myTurn(t, id) { const st = t.st, p = st && st.pl.find(x => x.id === id); return st.phase === 'throw' && p && p.score === null && !(T.knives && T.knives.active); },
    act(t, id, a) { const st = t.st, i = seatOf(t, id); if (a.t !== 'done' || i < 0 || st.pl[i].score !== null) return false; st.pl[i].score = Math.max(0, Math.min(250, a.score | 0)); st.pl[i].hits = (Array.isArray(a.hits) ? a.hits : []).slice(0, 5).map(h => [+h[0] || 0, +h[1] || 0]); TB.say(t, `${st.pl[i].name} scores ${st.pl[i].score}`); this.check(t); },
    check(t) { const st = t.st; if (st.pl.some(p => p.score === null)) return; st.phase = 'over'; const best = Math.max(...st.pl.map(p => p.score)), w = st.pl.filter(p => p.score === best); st.winner = w.map(p => p.name).join(' & '); TB.say(t, `${st.winner} ${w.length > 1 ? 'tie' : 'wins'} with ${best}!`); w.forEach(p => { TB.pay(t, p.id, st.pot / w.length, 'Darts'); gest(p.id, 'cheer', 1.4); }); },
    next(t) { const st = t.st; if (st.phase !== 'throw') return null; const n = st.pl.find(p => p.npc && p.score === null); if (n) return { wait: 5000 + R() * 5000, fn: t => { const hits = []; let s = 0; for (let k = 0; k < 5; k++) { const d = Math.abs((R() + R() + R() - 1.5) * 0.2), a = R() * 6.28; let pts = 0; for (const [r, v] of T.RINGS) if (d <= r) { pts = v; break; } s += pts; if (pts) hits.push([Math.sin(a) * d, Math.cos(a) * d]); } n.score = s; n.hits = hits; TB.say(t, `${n.name} throws: ${s}`); this.check(t); } }; return { wait: st.at - now(), fn: t => { st.pl.forEach(p => { if (p.score === null) p.score = 0; }); this.check(t); } }; },
    leave(t, id) { const st = t.st, i = seatOf(t, id); if (i >= 0 && st.phase === 'throw') { st.pl.splice(i, 1); if (st.pl.length) this.check(t); } return 0; },
    closeOut(t) { return t.st && t.st.phase !== 'over' ? t.buy : 0; },
    view(t, id) { const st = t.st, p = st.pl.find(x => x.id === id); let h = `<div class="tgame"><div class="goldline">Pot: ${st.pot} gold</div>${st.pl.map(q => `<div class="seat ${q.score === null ? 'turn' : ''}"><span class="nm">${esc(q.id === id ? 'You' : q.name)}<small>${q.score === null ? 'still to throw' : 'done'}</small></span><span style="font-family:var(--head);font-size:20px;color:#f3d998">${q.score === null ? '…' : q.score}</span></div>`).join('')}`;
      if (st.phase === 'throw' && p && p.score === null) h += `<div class="tact"><button class="btn" id="knGo">Throw your five darts</button><span class="note">You'll be put on the line.</span></div>`;
      if (st.phase === 'over') h += `<p class="note">${esc(st.winner)} take${st.winner.includes('&') ? '' : 's'} the pot.</p>`;
      return h + '</div>'; },
    bind(body, t) { const b = body.querySelector('#knGo'); if (b) b.onclick = () => { UI.closePanel(); setTimeout(() => T.knifeStart({ contest: t.tid }), 100); }; },
    // everyone's knives show up in the board
    onState(t) { const st = t.st; if (!st || !st.pl || !G.World.knifeLane) return; TB.knifeShown = TB.knifeShown || {}; st.pl.forEach(p => { const key = t.tid + ':' + (t.round || 0) + ':' + p.id; if (p.id === me() || !p.hits.length || TB.knifeShown[key]) return; TB.knifeShown[key] = true; const L = G.World.knifeLane; p.hits.forEach(([dy, dz]) => { const m = T.knifeMesh(); m.scale.setScalar(1.4); m.position.set(L.bx + 0.07, L.by + dy, L.bz + dz); m.rotation.set(0, 0, Math.PI / 2 + (R() - 0.5) * 0.3); G.scene.add(m); setTimeout(() => G.scene.remove(m), 40000); }); G.sfx('thunk', 0.6); }); }
  };
  TB.knifeDone = (tid, score, hits) => TB.act(tid, { t: 'done', score, hits });

  /* ================= Blackjack ================= */
  const bjVal = (h) => { let v = 0, a = 0; h.forEach(c => { const r = cr(c); if (r === 12) { v += 11; a++; } else v += r >= 8 ? 10 : r + 2; }); while (v > 21 && a) { v -= 10; a--; } return { v, soft: a > 0 }; };
  TB.bjVal = bjVal;
  GM.blackjack = {
    name: 'Blackjack', icon: '🂡', min: 1, max: 4, npc: false, payOnSeat: false, joinLate: true, minBuy: 5, maxBuy: 200, defBuy: 10, step: 5, buyLabel: 'Minimum bet', leaveLabel: 'Leave table',
    rules: 'Up to four sit on the round edge; an enchanted shoe of four tavern decks deals itself to the house at the flat side. Get closer to 21 than the house without going over. The house stands on 17. Blackjack pays 3 to 2; doubling down doubles your bet for exactly one more card.',
    start(t) { const st = t.st; st.shoe = TB.deck(4); st.dealer = []; st.hide = true; st.pl = t.seats.map(s => ({ id: s.id, name: s.name, bet: 0, hand: [], done: false, res: null, dbl: false })); st.phase = 'bet'; st.at = 0; st.turn = null; TB.say(t, 'Place your bets'); },
    addLate(t, s) { t.st.pl.push({ id: s.id, name: s.name, bet: 0, hand: [], done: false, res: null, dbl: false }); },
    myTurn(t, id) { const st = t.st; if (!st) return false; const p = st.pl.find(x => x.id === id); return !!p && ((st.phase === 'bet' && !p.bet) || (st.phase === 'play' && st.turn === id)); },
    draw(st) { if (st.shoe.length < 20) st.shoe = TB.deck(4); return st.shoe.pop(); },
    act(t, id, a) {
      const st = t.st, p = st.pl.find(x => x.id === id); if (!p) return false;
      if (a.t === 'bet' && st.phase === 'bet' && !p.bet) { p.bet = Math.round(G.clamp(+a.amt || t.buy, t.buy, t.buy * 25)); TB.say(t, `${p.name} bets ${p.bet}`); if (!st.at) st.at = now() + 12000; if (st.pl.every(x => x.bet)) this.deal(t); return; }
      if (a.t === 'deal' && st.phase === 'bet' && id === t.host && st.pl.some(x => x.bet)) { this.deal(t); return; }
      if (st.phase !== 'play' || st.turn !== id) return false;
      if (a.t === 'hit') { p.hand.push(this.draw(st)); const v = bjVal(p.hand).v; if (v > 21) { p.done = true; p.res = 'bust'; TB.say(t, `${p.name} busts with ${v}`); } else if (v === 21) p.done = true; }
      else if (a.t === 'stand') p.done = true;
      else if (a.t === 'double' && p.hand.length === 2 && !p.dbl) { p.bet *= 2; p.dbl = true; p.hand.push(this.draw(st)); p.done = true; const v = bjVal(p.hand).v; TB.say(t, `${p.name} doubles down: ${v}`); if (v > 21) p.res = 'bust'; }
      else return false;
      if (p.done) this.advance(t); else st.at = now() + 30000;
    },
    deal(t) {
      const st = t.st; st.dealer = [this.draw(st), this.draw(st)]; st.hide = true;
      st.pl.forEach(p => { p.hand = []; p.done = false; p.res = null; p.dbl = false; if (p.bet) { p.hand = [this.draw(st), this.draw(st)]; if (bjVal(p.hand).v === 21) { p.done = true; p.res = 'bj'; } } else p.done = true; });
      st.phase = 'play'; G.sfx('dice', 0.3); TB.say(t, 'The shoe deals itself');
      if (bjVal(st.dealer).v === 21) { st.hide = false; TB.say(t, 'The house has blackjack!'); this.settle(t); return; }
      st.turn = null; this.advance(t);
    },
    advance(t) { const st = t.st, cur = st.pl.findIndex(x => x.id === st.turn), nx = st.pl.find((x, i) => i > cur && x.bet && !x.done); if (nx) { st.turn = nx.id; st.at = now() + 30000; return; } st.turn = null; st.phase = 'dealer'; st.hide = false; st.at = now() + 900; },
    settle(t) {
      const st = t.st, d = bjVal(st.dealer), dbj = d.v === 21 && st.dealer.length === 2;
      st.pl.forEach(p => { if (!p.bet) return; const v = bjVal(p.hand).v; let mult = 0;
        if (p.res === 'bust') mult = 0; else if (p.res === 'bj' && !dbj) { mult = 2.5; } else if (dbj) mult = p.res === 'bj' ? 1 : 0; else if (d.v > 21 || v > d.v) mult = 2; else if (v === d.v) mult = 1;
        p.res = mult === 2.5 ? 'blackjack' : mult === 2 ? 'win' : mult === 1 ? 'push' : 'lose'; if (mult) TB.pay(t, p.id, p.bet * mult, p.res === 'push' ? 'Push' : 'Blackjack win'); });
      st.phase = 'settle'; st.at = now() + 5000; TB.say(t, `The house ${d.v > 21 ? 'busts with ' + d.v : 'stands on ' + d.v}`);
    },
    next(t) {
      const st = t.st;
      if (st.phase === 'bet' && st.at) return { wait: st.at - now(), fn: t => { if (st.pl.some(x => x.bet)) this.deal(t); else st.at = 0; } };
      if (st.phase === 'dealer') return { wait: st.at - now(), fn: t => { const d = bjVal(st.dealer); if (d.v < 17) { st.dealer.push(this.draw(st)); st.at = now() + 850; } else this.settle(t); } };
      if (st.phase === 'settle') return { wait: st.at - now(), fn: t => { st.pl.forEach(p => { p.bet = 0; p.hand = []; p.done = false; p.res = null; p.dbl = false; }); st.dealer = []; st.hide = true; st.phase = 'bet'; st.at = 0; TB.say(t, 'Place your bets'); } };
      if (st.phase === 'play' && st.turn) return { wait: st.at - now(), fn: t => this.act(t, st.turn, { t: 'stand' }) };
      return null;
    },
    leave(t, id) { const st = t.st, i = st.pl.findIndex(x => x.id === id); if (i < 0) return 0; const p = st.pl[i], refund = st.phase === 'bet' ? p.bet : 0; if (st.turn === id) { p.done = true; this.advance(t); } st.pl.splice(i, 1); return refund; },
    closeOut(t, id) { const p = t.st && t.st.pl.find(x => x.id === id); return p && p.bet && t.st.phase !== 'settle' ? p.bet : 0; },
    view(t, id) {
      const st = t.st, me0 = st.pl.find(x => x.id === id), d = bjVal(st.dealer);
      let h = `<div class="felt"><div class="bjrow" style="background:none;border:none"><span class="who">Silas the Dealer<small>${st.phase === 'bet' ? 'waiting for bets' : st.hide ? 'one card face down' : ''}</small></span>${st.dealer.map((c, i) => TB.card(c, { back: st.hide && i === 1 })).join('')}<span class="bjv">${st.dealer.length ? (st.hide ? bjVal([st.dealer[0]]).v + ' + ?' : d.v) : ''}</span></div>`;
      st.pl.forEach(p => { const v = bjVal(p.hand); h += `<div class="bjrow ${st.turn === p.id ? 'turn' : ''}"><span class="who">${esc(p.id === id ? 'You' : p.name)}<small>${p.bet ? 'bet ' + p.bet + (p.dbl ? ' (doubled)' : '') : 'no bet'}</small></span>${p.hand.map(c => TB.card(c)).join('')}<span class="bjv">${p.hand.length ? v.v : ''}</span>${p.res && st.phase === 'settle' ? `<span class="res-${p.res === 'lose' ? 'lose' : p.res === 'push' ? 'push' : 'win'}">${p.res === 'blackjack' ? 'Blackjack! ' : ''}${{ win: 'Win', blackjack: '', push: 'Push', lose: 'Lose', bust: 'Bust' }[p.res] || ''}</span>` : p.res === 'bust' ? '<span class="res-lose">Bust</span>' : ''}</div>`; });
      h += '</div>';
      if (me0 && st.phase === 'bet' && !me0.bet) { const F = TB.form.bjBet || (TB.form.bjBet = { amt: t.buy }); F.amt = G.clamp(F.amt, t.buy, t.buy * 25); h += `<div class="tact"><label>Bet <input type="number" id="bjAmt" min="${t.buy}" max="${t.buy * 25}" step="${t.buy}" value="${F.amt}" style="width:80px;background:#1a140c;color:#f3d998;border:1px solid #6a5426;padding:5px"></label><button class="btn small" id="bjBet" ${G.save.gold < F.amt ? 'disabled' : ''}>Place bet</button>${t.host === id && st.pl.some(x => x.bet) ? '<button class="btn small ghost" id="bjDeal">Deal now</button>' : ''}</div>`; }
      else if (st.phase === 'bet') h += `<p class="note">Waiting for bets${st.at ? ' · dealing soon' : ''}…</p>${t.host === id && st.pl.some(x => x.bet) ? '<div class="tact"><button class="btn small ghost" id="bjDeal">Deal now</button></div>' : ''}`;
      if (me0 && st.phase === 'play' && st.turn === id) h += `<div class="tact"><button class="btn small" id="bjHit">Hit</button><button class="btn small" id="bjStand">Stand</button>${me0.hand.length === 2 && G.save.gold >= me0.bet ? '<button class="btn small" id="bjDbl">Double down</button>' : ''}</div>`;
      return h;
    },
    bind(body, t) {
      const $ = id => body.querySelector('#' + id), F = TB.form.bjBet || (TB.form.bjBet = { amt: t.buy });
      if ($('bjAmt')) $('bjAmt').oninput = () => { F.amt = +$('bjAmt').value; };
      if ($('bjBet')) $('bjBet').onclick = () => { const amt = Math.round(G.clamp(F.amt, t.buy, t.buy * 25)); if (G.save.gold < amt) { G.ui.toast('Not enough gold'); return; } G.save.gold -= amt; G.persist(); G.sfx('coin', 0.6); TB.act(t.tid, { t: 'bet', amt }); };
      if ($('bjDeal')) $('bjDeal').onclick = () => TB.act(t.tid, { t: 'deal' });
      if ($('bjHit')) $('bjHit').onclick = () => TB.act(t.tid, { t: 'hit' });
      if ($('bjStand')) $('bjStand').onclick = () => TB.act(t.tid, { t: 'stand' });
      if ($('bjDbl')) $('bjDbl').onclick = () => { const p = t.st.pl.find(x => x.id === me()); if (!p || G.save.gold < p.bet) return; G.save.gold -= p.bet; G.persist(); G.sfx('coin', 0.6); TB.act(t.tid, { t: 'double' }); };
    }
  };

  /* ================= Texas Hold'em ================= */
  const straightHigh = (mask) => { const ext = (mask << 1) | ((mask >> 12) & 1); for (let top = 13; top >= 4; top--) if (((ext >> (top - 4)) & 31) === 31) return top - 1; return -1; };
  const HAND_NAMES = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];
  const evalHand = TB.evalHand = (cards) => {
    const cnt = new Array(13).fill(0), suits = [[], [], [], []]; let mask = 0;
    cards.forEach(c => { const r = cr(c); cnt[r]++; suits[cs(c)].push(r); mask |= 1 << r; });
    const score = (cat, ks) => { let s = cat; for (let i = 0; i < 5; i++) s = s * 13 + (ks[i] || 0); return s; };
    const fs = suits.find(s => s.length >= 5);
    if (fs) { let fm = 0; fs.forEach(r => fm |= 1 << r); const sh = straightHigh(fm); if (sh >= 0) return score(8, [sh]); }
    const byCnt = (n) => { const out = []; for (let r = 12; r >= 0; r--) if (cnt[r] === n) out.push(r); return out; };
    const q = byCnt(4), t3 = byCnt(3), p2 = byCnt(2), singles = byCnt(1);
    const high = (ex, n) => { const out = []; for (let r = 12; r >= 0 && out.length < n; r--) if (cnt[r] > 0 && !ex.includes(r)) out.push(r); return out; };
    if (q.length) return score(7, [q[0], ...high([q[0]], 1)]);
    if (t3.length && (t3.length > 1 || p2.length)) { const tr = t3[0], pr = t3.length > 1 ? Math.max(t3[1], p2[0] ?? -1) : p2[0]; return score(6, [tr, pr]); }
    if (fs) return score(5, fs.slice().sort((a, b) => b - a).slice(0, 5));
    const sh = straightHigh(mask); if (sh >= 0) return score(4, [sh]);
    if (t3.length) return score(3, [t3[0], ...high([t3[0]], 2)]);
    if (p2.length >= 2) return score(2, [p2[0], p2[1], ...high([p2[0], p2[1]], 1)]);
    if (p2.length) return score(1, [p2[0], ...high([p2[0]], 3)]);
    return score(0, high([], 5));
  };
  const handName = TB.handName = (s) => HAND_NAMES[Math.floor(s / Math.pow(13, 5))];
  const equity = (hole, board, nOpp, sims = 140) => {
    const known = new Set(hole.concat(board)), rest = []; for (let c = 0; c < 52; c++) if (!known.has(c)) rest.push(c);
    let win = 0;
    for (let s = 0; s < sims; s++) {
      for (let i = rest.length - 1; i > rest.length - 1 - (5 - board.length + nOpp * 2) && i > 0; i--) { const j = Math.floor(R() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
      let k = rest.length - 1; const b = board.slice(); while (b.length < 5) b.push(rest[k--]);
      const mine = evalHand(hole.concat(b)); let best = 0, tie = 0;
      for (let o = 0; o < nOpp; o++) { const v = evalHand([rest[k--], rest[k--]].concat(b)); if (v > best) { best = v; tie = 0; } if (v === best) tie++; }
      if (mine > best) win += 1; else if (mine === best) win += 1 / (tie + 1);
    }
    return win / sims;
  };
  TB.equity = equity;
  GM.poker = {
    name: "Texas Hold'em", icon: '♠', min: 2, max: 6, npc: true, joinLate: true, minBuy: 20, maxBuy: 2000, defBuy: 100, step: 10, buyLabel: 'Buy-in', leaveLabel: 'Cash out',
    rules: 'A cash game: your buy-in becomes chips, blinds are 1% and 2% of the buy-in. Two cards each, five shared; make the best five-card hand. Cash out whenever you like and your chips come back as gold. Bust out and you can buy back in.',
    blinds(t) { const sb = Math.max(1, Math.round(t.buy / 100)); return [sb, sb * 2]; },
    start(t) { const st = t.st, [sb, bb] = this.blinds(t); Object.assign(st, { pl: t.seats.map(s => this.newP(s, t.buy)), btn: -1, board: [], deck: [], street: 'wait', turn: -1, curBet: 0, minR: bb, sb, bb, hand: 0, at: now() + 1500, result: null }); },
    newP(s, chips) { return { id: s.id, name: s.name, npc: !!s.npc, chips, hole: [], bet: 0, tot: 0, folded: false, allin: false, acted: false, inHand: false, left: false }; },
    addLate(t, s) { t.st.pl.push(this.newP(s, t.buy)); TB.say(t, `${s.name} buys in for ${t.buy}`); },
    myTurn(t, id) { const st = t.st; return st && ['pre', 'flop', 'turn', 'river'].includes(st.street) && st.pl[st.turn] && st.pl[st.turn].id === id; },
    nextIdx(st, i, ok) { const n = st.pl.length; for (let k = 1; k <= n; k++) { const j = (i + k + n) % n; if (ok(st.pl[j])) return j; } return -1; },
    canAct: p => p.inHand && !p.folded && !p.allin,
    put(st, p, amt) { amt = Math.min(amt, p.chips); p.chips -= amt; p.bet += amt; p.tot += amt; if (p.chips === 0 && p.inHand) p.allin = true; return amt; },
    newHand(t) {
      const st = t.st; st.pl = st.pl.filter(p => !p.left); if (st.pl.filter(p => p.npc && p.chips <= 0).length) { st.pl.filter(p => p.npc && p.chips <= 0).forEach(p => TB.say(t, `${p.name} is cleaned out and leaves`)); st.pl = st.pl.filter(p => !(p.npc && p.chips <= 0)); }
      const elig = st.pl.filter(p => p.chips > 0); st.result = null; st.board = [];
      st.pl.forEach(p => Object.assign(p, { hole: [], bet: 0, tot: 0, folded: false, allin: false, acted: false, inHand: p.chips > 0, shown: false }));
      if (elig.length < 2) { st.street = 'wait'; st.at = now() + 3000; return; }
      st.hand++; st.deck = TB.deck(1);
      st.btn = this.nextIdx(st, st.btn, p => p.inHand);
      const sbI = elig.length === 2 ? st.btn : this.nextIdx(st, st.btn, p => p.inHand), bbI = this.nextIdx(st, sbI, p => p.inHand);
      st.pl.forEach(p => { if (p.inHand) p.hole = [st.deck.pop(), st.deck.pop()]; });
      this.put(st, st.pl[sbI], st.sb); this.put(st, st.pl[bbI], st.bb); st.curBet = st.bb; st.minR = st.bb; st.street = 'pre';
      st.turn = this.nextIdx(st, bbI, this.canAct); TB.say(t, `Hand ${st.hand}: ${st.pl[st.btn].name} has the button`);
      st.at = now() + 45000; if (st.turn < 0) this.proceed(t, true);
    },
    act(t, id, a) {
      const st = t.st, i = st.pl.findIndex(p => p.id === id); if (i < 0) return false; const p = st.pl[i];
      if (a.t === 'rebuy') { if (p.inHand && !p.folded) return false; p.chips += t.buy; TB.say(t, `${p.name} buys back in for ${t.buy}`); if (st.street === 'wait') st.at = now() + 1000; return; }
      if (!this.myTurn(t, id)) return false;
      const toCall = st.curBet - p.bet;
      if (a.t === 'fold') { p.folded = true; TB.say(t, `${p.name} folds`); }
      else if (a.t === 'check') { if (toCall > 0) return false; TB.say(t, `${p.name} checks`); }
      else if (a.t === 'call') { const c = this.put(st, p, toCall); TB.say(t, `${p.name} ${p.allin ? 'calls all-in' : 'calls'} ${c}`); }
      else if (a.t === 'raise') {
        let to = Math.round(+a.to || 0); const maxTo = p.bet + p.chips; to = Math.min(to, maxTo);
        if (to <= st.curBet) return false; if (to < st.curBet + st.minR && to < maxTo) to = Math.min(maxTo, st.curBet + st.minR);
        const raiseBy = to - st.curBet; this.put(st, p, to - p.bet); if (raiseBy >= st.minR) st.minR = raiseBy; st.curBet = Math.max(st.curBet, p.bet);
        st.pl.forEach(q => { if (q !== p) q.acted = false; }); TB.say(t, `${p.name} ${p.allin ? 'goes all-in for' : st.curBet === raiseBy && st.street !== 'pre' ? 'bets' : 'raises to'} ${p.bet}`);
      } else return false;
      p.acted = true; gest(p.id, a.t === 'fold' ? 'drink' : 'point', 0.8); this.proceed(t);
    },
    proceed(t) {
      const st = t.st, live = st.pl.filter(p => p.inHand && !p.folded);
      if (live.length === 1) { this.award(t, [{ amt: st.pl.reduce((a, p) => a + p.tot, 0), elig: [live[0]] }], false); return; }
      const j = this.nextIdx(st, st.turn, p => this.canAct(p) && (!p.acted || p.bet < st.curBet));
      if (j >= 0 && st.pl.filter(this.canAct).length > (st.pl.filter(this.canAct).length === 1 && st.pl[j].bet >= st.curBet ? 1 : 0)) { st.turn = j; st.at = now() + 45000; return; }
      // the street is over
      st.pl.forEach(p => { p.bet = 0; p.acted = false; }); st.curBet = 0; st.minR = st.bb;
      if (st.street === 'river') { this.showdown(t); return; }
      if (st.pl.filter(this.canAct).length <= 1) { st.runout = true; st.turn = -1; st.at = now() + 1200; return; }
      this.dealStreet(t); st.turn = this.nextIdx(st, st.btn, this.canAct); st.at = now() + 45000;
    },
    dealStreet(t) { const st = t.st; if (st.street === 'pre') { st.deck.pop(); st.board.push(st.deck.pop(), st.deck.pop(), st.deck.pop()); st.street = 'flop'; } else if (st.street === 'flop') { st.deck.pop(); st.board.push(st.deck.pop()); st.street = 'turn'; } else if (st.street === 'turn') { st.deck.pop(); st.board.push(st.deck.pop()); st.street = 'river'; } G.sfx('click', 0.4); },
    pots(st) {
      const c = st.pl.map(p => p.tot), pots = [];
      while (c.some(x => x > 0)) { const m = Math.min(...c.filter(x => x > 0)); let amt = 0; const elig = []; c.forEach((x, i) => { if (x > 0) { amt += Math.min(x, m); c[i] -= Math.min(x, m); if (!st.pl[i].folded && st.pl[i].inHand) elig.push(st.pl[i]); } }); if (elig.length) pots.push({ amt, elig }); else if (pots.length) pots[pots.length - 1].amt += amt; }
      return pots;
    },
    showdown(t) { const st = t.st; st.turn = -1; st.pl.forEach(p => { if (p.inHand && !p.folded) { p.shown = true; p.score = evalHand(p.hole.concat(st.board)); } }); this.award(t, this.pots(st), true); },
    award(t, pots, shown) {
      const st = t.st, res = {};
      pots.forEach(pt => { const best = Math.max(...pt.elig.map(p => shown ? p.score : 1)), w = pt.elig.filter(p => (shown ? p.score : 1) === best), share = Math.floor(pt.amt / w.length); let rem = pt.amt - share * w.length; w.forEach(p => { const g = share + (rem-- > 0 ? 1 : 0); p.chips += g; res[p.id] = (res[p.id] || 0) + g; }); });
      st.result = Object.entries(res).map(([id, amt]) => { const p = st.pl.find(x => x.id === id); return { id, name: p.name, amt, hand: shown ? (TB.handDesc || handName)(p.score) : null }; });
      st.result.forEach(r => { TB.say(t, `${r.name} wins ${r.amt}${r.hand ? ' with ' + r.hand.toLowerCase() : ''}`); gest(r.id, 'cheer', 1.3); });
      st.pl.forEach(p => { p.bet = 0; }); st.street = 'done'; st.turn = -1; st.at = now() + (shown ? 6500 : 3000); st.runout = false;
    },
    next(t) {
      const st = t.st;
      if (st.street === 'wait' || st.street === 'done') return { wait: st.at - now(), fn: t => this.newHand(t) };
      if (st.runout) return { wait: st.at - now(), fn: t => { if (st.street === 'river') { st.runout = false; this.showdown(t); } else { this.dealStreet(t); st.at = now() + 1200; } } };
      const p = st.pl[st.turn]; if (!p) return null;
      if (p.npc) return { wait: 1000 + R() * 1300, fn: t => this.npc(t, st.turn) };
      if (p.left) return { wait: 0, fn: t => this.act(t, p.id, { t: 'fold' }) };
      return { wait: st.at - now(), fn: t => this.act(t, p.id, { t: st.curBet - p.bet > 0 ? 'fold' : 'check' }) };
    },
    npc(t, i) {
      const st = t.st, p = st.pl[i], live = st.pl.filter(q => q.inHand && !q.folded).length, eq = equity(p.hole, st.board, Math.max(1, live - 1), st.board.length ? 140 : 90);
      const pot = st.pl.reduce((a, q) => a + q.tot, 0), toCall = st.curBet - p.bet, odds = toCall / Math.max(1, pot + toCall), bold = (p.name.length % 5) * 0.03, r = R();
      const raiseTo = () => Math.min(p.bet + p.chips, st.curBet + Math.max(st.minR, Math.round(pot * (0.5 + R() * 0.4))));
      if (toCall <= 0) { if (eq > 0.62 - bold || r < 0.06 + bold) this.act(t, p.id, { t: 'raise', to: raiseTo() }); else this.act(t, p.id, { t: 'check' }); return; }
      if (eq < odds * 0.95 && r > 0.05 + bold) { this.act(t, p.id, { t: 'fold' }); return; }
      if (eq > 0.72 - bold && r < 0.7) this.act(t, p.id, { t: 'raise', to: raiseTo() }); else this.act(t, p.id, { t: 'call' });
    },
    leave(t, id) { const st = t.st, i = st.pl.findIndex(p => p.id === id); if (i < 0) return 0; const p = st.pl[i], cash = p.chips; p.chips = 0; p.left = true; if (p.inHand && !p.folded) { p.folded = true; TB.say(t, `${p.name} folds and cashes out`); if (st.turn === i) this.proceed(t); else if (st.pl.filter(q => q.inHand && !q.folded).length === 1 && ['pre', 'flop', 'turn', 'river'].includes(st.street)) this.proceed(t); } else TB.say(t, `${p.name} cashes out ${cash}`); return cash; },
    closeOut(t, id) { const p = t.st && t.st.pl.find(x => x.id === id); if (!p) return 0; const mid = ['pre', 'flop', 'turn', 'river'].includes(t.st.street); return p.chips + (mid ? p.tot : 0); },
    view(t, id) {
      const st = t.st, mi = st.pl.findIndex(p => p.id === id), P = st.pl[mi], pot = st.pl.reduce((a, p) => a + p.tot, 0), blur = T.blur(), win = new Set((st.result || []).map(r => r.id));
      let h = `<div class="felt"><div class="pkpot">Blinds ${st.sb}/${st.bb} · Pot ${pot}${st.street === 'wait' ? ' · waiting for players' : ''}</div><div class="pkboard">${[0, 1, 2, 3, 4].map(k => st.board[k] !== undefined ? TB.card(st.board[k]) : '<span class="tcard back" style="opacity:.25">' + '</span>').join('')}</div>`;
      h += `<div class="pk">${st.pl.map((p, i) => { const mine = i === mi, showCards = mine || p.shown; return `<div class="pkseat ${st.turn === i ? 'turn' : ''} ${p.folded || !p.inHand ? 'fold' : ''} ${win.has(p.id) && st.street === 'done' ? 'win' : ''}"><b>${esc(mine ? 'You' : p.name)}</b>${i === st.btn ? ' <span title="Dealer button">Ⓓ</span>' : ''}<div class="chips">💀 ${p.chips}${p.allin ? ' · ALL IN' : ''}</div>${p.bet ? `<div class="bet">bet ${p.bet}</div>` : '<div class="bet">&nbsp;</div>'}<div style="${mine ? blur : ''}">${p.hole.length ? p.hole.map(c => showCards ? TB.card(c, { small: true }) : TB.card(null, { small: true })).join('') : ''}</div>${p.shown && p.score !== undefined ? `<small>${handName(p.score)}</small>` : ''}</div>`; }).join('')}</div></div>`;
      if (st.result && st.street === 'done') h += `<p class="note" style="text-align:center">${st.result.map(r => `${esc(r.name)} wins ${r.amt}${r.hand ? ' with ' + r.hand.toLowerCase() : ''}`).join(' · ')}</p>`;
      if (P && this.myTurn(t, id)) {
        const toCall = st.curBet - P.bet, maxTo = P.bet + P.chips, minTo = Math.min(maxTo, st.curBet + st.minR), F = TB.form.pkRaise || (TB.form.pkRaise = { to: minTo }); F.to = G.clamp(F.to, minTo, maxTo);
        h += `<div class="tact"><button class="btn small" id="pkFold">Fold</button>${toCall > 0 ? `<button class="btn small" id="pkCall">Call ${Math.min(toCall, P.chips)}</button>` : '<button class="btn small" id="pkCheck">Check</button>'}${maxTo > st.curBet ? `<input type="range" id="pkTo" min="${minTo}" max="${maxTo}" step="1" value="${F.to}"><button class="btn small" id="pkRaise">${st.curBet ? 'Raise to' : 'Bet'} <span id="pkToV">${F.to}</span></button><button class="btn small ghost" data-pk="0.5">½ pot</button><button class="btn small ghost" data-pk="1">Pot</button><button class="btn small ghost" data-pk="all">All in</button>` : ''}</div>`;
      } else if (P && P.chips <= 0 && !(P.inHand && !P.folded)) h += `<div class="tact"><span class="note">You're out of chips.</span><button class="btn small" id="pkRebuy" ${G.save.gold < t.buy ? 'disabled' : ''}>Buy back in · ${t.buy} g</button></div>`;
      return h;
    },
    bind(body, t, id) {
      const st = t.st, $ = x => body.querySelector('#' + x), P = st.pl.find(p => p.id === id), F = TB.form.pkRaise || (TB.form.pkRaise = { to: 0 });
      if ($('pkFold')) $('pkFold').onclick = () => TB.act(t.tid, { t: 'fold' });
      if ($('pkCall')) $('pkCall').onclick = () => TB.act(t.tid, { t: 'call' });
      if ($('pkCheck')) $('pkCheck').onclick = () => TB.act(t.tid, { t: 'check' });
      if ($('pkTo')) $('pkTo').oninput = () => { F.to = +$('pkTo').value; $('pkToV').textContent = F.to; };
      if ($('pkRaise')) $('pkRaise').onclick = () => TB.act(t.tid, { t: 'raise', to: F.to });
      body.querySelectorAll('[data-pk]').forEach(b => b.onclick = () => { const pot = st.pl.reduce((a, p) => a + p.tot, 0), v = b.dataset.pk; const to = v === 'all' ? P.bet + P.chips : st.curBet + Math.round(pot * +v); TB.act(t.tid, { t: 'raise', to }); });
      if ($('pkRebuy')) $('pkRebuy').onclick = () => { if (G.save.gold < t.buy) return; G.save.gold -= t.buy; G.persist(); G.sfx('coin', 0.7); TB.act(t.tid, { t: 'rebuy' }); };
    }
  };

  /* ================= the tables in the tavern ================= */
  const TM = T.models;
  TM.dealer = () => {
    const Rr = M.humanoid({ top: G.mat('col', { c: 0x1a1a22, t: 'cloth' }), bottom: G.mat('col', { c: 0x2a2224, t: 'cloth' }), skin: G.mat('col', { c: 0xc8b8a8, t: 'skin' }), brow: 0x2a2a2a, bulk: 1.0 });
    M.P(Rr.torso, M.box(0.33, 0.4, 0.02), G.mat('col', { c: 0x5a0a14, t: 'cloth' }), [0, 0.15, 0.15]);   // crimson waistcoat
    M.P(Rr.head, M.cyl(0.15, 0.15, 0.015, 20, 1, false), G.mat('col', { c: 0x1a4a2a, tr: 0.75 }), [0, 0.1, 0.06], [-0.25, 0, 0]);   // green visor
    M.P(Rr.head, M.sph(0.115, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), G.mat('col', { c: 0x1a1a1a, r: 0.5 }), [0, 0.02, -0.01]);
    for (let i = 0; i < 7; i++) { const a = (i - 3) * 0.32; M.P(Rr.chest, M.ico(0.018, 0), G.mat('col', { c: 0xe8dcc0 }), [Math.sin(a) * 0.12, 0.13 - Math.abs(Math.sin(a)) * 0.08, 0.15 + Math.cos(a) * 0.02]); }   // a necklace of finger bones
    Rr.armPose = (R2, st) => { const t = st.t; R2.armL.sh.rotation.set(-0.75, 0.25, 0.2); R2.armL.el.rotation.set(-0.8, 0, 0); R2.armR.sh.rotation.set(-0.8 + Math.sin(t * 2.2) * 0.08, -0.25, -0.2); R2.armR.el.rotation.set(-0.8 + Math.sin(t * 2.2) * 0.1, 0, 0); };
    return Rr;
  };
  TM.chips = (n, col) => { const g = new THREE.Group(); for (let i = 0; i < n; i++) M.P(g, M.cyl(0.03, 0.03, 0.008, 14), G.mat('col', { c: col, r: 0.5 }), [0, 0.004 + i * 0.009, 0]); M.P(g, M.cyl(0.031, 0.031, 0.001, 14), G.mat('col', { c: 0xe8dcc0 }), [0, n * 0.009 + 0.001, 0]); return g; };
  TM.skullCandle = () => { const g = new THREE.Group(); const sk = M.prop.skull(g, [0, 0.05, 0], 0); if (sk) sk.scale.setScalar(0.9); const c = M.prop.candles(1); c.position.y = 0.12; c.scale.setScalar(0.5); g.add(c); return g; };
  TM.boneTable = (w, d, felt, shape) => {
    const g = new THREE.Group(), bone = G.mat('col', { c: 0xb8ab90, r: 0.9 }), dark = G.mat('col', { c: 0x2a1a10, t: 'wood' }), fm = G.mat('col', { c: felt, t: 'cloth', r: 0.95 });
    const top = shape === 'half' ? new THREE.CylinderGeometry(w / 2, w / 2, 0.06, 40, 1, false, -Math.PI / 2, Math.PI) : null;
    if (shape === 'half') { M.P(g, top, dark, [0, 0.78, 0]); M.P(g, new THREE.CylinderGeometry(w / 2 - 0.1, w / 2 - 0.1, 0.02, 40, 1, false, -Math.PI / 2, Math.PI), fm, [0, 0.82, 0]); M.P(g, M.tor(w / 2 - 0.05, 0.04, 8, 40, Math.PI), bone, [0, 0.83, 0], [Math.PI / 2, 0, 0]); }
    else { const o = M.P(g, M.cyl(1, 1, 0.07, 40), dark, [0, 0.78, 0], 0, [w / 2, 1, d / 2]); M.P(g, M.cyl(1, 1, 0.02, 40), fm, [0, 0.82, 0], 0, [w / 2 - 0.1, 1, d / 2 - 0.1]); for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; M.P(g, M.sph(0.035, 8, 6), bone, [Math.cos(a) * (w / 2 - 0.03), 0.83, Math.sin(a) * (d / 2 - 0.03)], 0, [1.6, 0.7, 1]); } }
    // legs: femurs with knobbed ends
    const legs = shape === 'half' ? [[-w * 0.3, 0.16], [w * 0.3, 0.16], [0, w * 0.33]] : [[-w * 0.3, -d * 0.25], [w * 0.3, -d * 0.25], [-w * 0.3, d * 0.25], [w * 0.3, d * 0.25]];
    legs.forEach(([x, z]) => { M.P(g, M.cyl(0.035, 0.04, 0.68, 10), bone, [x, 0.4, z]); [0.08, 0.72].forEach(y => { M.P(g, M.sph(0.05, 10, 8), bone, [x - 0.025, y, z]); M.P(g, M.sph(0.05, 10, 8), bone, [x + 0.025, y, z]); }); });
    return g;
  };
  const ba0 = G.World.buildArcade;
  G.World.buildArcade = function (o) {
    ba0.call(this, o); if (!o.spots) return;
    const grp = this.group;
    // Blackjack: a half-moon table, the flat side to the north where the enchanted shoe floats; players sit around the round edge
    const bj = o.spots.blackjack, bt = TM.boneTable(2.6, 0, 0x14401e, 'half'); this.place(bt, bj.x, 0, bj.z, 0, 'auto');
    { const sc = TM.skullCandle(); sc.position.set(bj.x + 1.05, 0.83, bj.z + 0.12); grp.add(sc); this.lights.push({ pos: new G.V3(bj.x, 1.6, bj.z + 0.4), color: 0xffa040, intensity: 1.5, dist: 7, seed: 13, flicker: false }); }
    this.interact.push({ id: 'blackjack', label: 'Blackjack', x: bj.x, z: bj.z + 2.2, r: 2.6, desc: 'Up to four players · the cards deal themselves' });
    // Texas Hold'em: an oval table ringed with knucklebones
    const pk = o.spots.poker;
    const pt = TM.boneTable(2.6, 1.6, 0x4a0a14, 'oval'); this.place(pt, pk.x, 0, pk.z, 0, 'auto');
    { const sc = TM.skullCandle(); sc.position.set(pk.x, 0.83, pk.z - 0.3); grp.add(sc); }
    this.interact.push({ id: 'poker', label: "Texas Hold'em", x: pk.x, z: pk.z, r: 2.9, desc: 'Buy in, take a seat, play hands, cash out' });
  };
})();
