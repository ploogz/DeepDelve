/* ============================================================
   Hold'em, easier to read
   - a card strip over the key bar: the board and your two cards, the five that make your best hand lit up,
     what you're holding in words ("Two pair, Witches and 7s"), the pot and what it costs you to stay in
   - "Your turn" rings a bell and flashes in the middle of the screen, with the price to call
   - each new street (the flop, the turn, the river) tells you what your hand has become
   - F: a close look straight down at the shared cards in the middle (F or V again to go back)
   - the magic deck floats high over the table, out of the way of the board, and the board cards are bigger
   ============================================================ */
'use strict';
(() => {
  const F = G.fp, TB = G.tables, GM = TB.GAMES, me = () => G.net.myId();
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const RN = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'Ghoul', 'Witch', 'Lich', 'Ace'], PL = ['2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s', '10s', 'Ghouls', 'Witches', 'Liches', 'Aces'];

  /* ================= what a hand is called ================= */
  const dec = (s) => { const k = []; let x = s; for (let i = 0; i < 5; i++) { k.unshift(x % 13); x = Math.floor(x / 13); } return { cat: x, k }; };
  TB.handDesc = (s) => { const { cat, k } = dec(s);
    switch (cat) {
      case 8: return k[0] === 12 ? 'Royal flush' : `Straight flush, ${RN[k[0]]} high`;
      case 7: return `Four ${PL[k[0]]}`;
      case 6: return `Full house, ${PL[k[0]]} full of ${PL[k[1]]}`;
      case 5: return `Flush, ${RN[k[0]]} high`;
      case 4: return `Straight, ${RN[k[0]]} high`;
      case 3: return `Three ${PL[k[0]]}`;
      case 2: return `Two pair, ${PL[k[0]]} and ${PL[k[1]]}`;
      case 1: return `Pair of ${PL[k[0]]}`;
      default: return `${RN[k[0]]} high`;
    } };
  const holeDesc = (h) => { const a = h[0] >> 2, b = h[1] >> 2, hi = Math.max(a, b), lo = Math.min(a, b); return a === b ? `Pocket ${PL[a]}` : `${RN[hi]} and ${RN[lo]}${(h[0] & 3) === (h[1] & 3) ? ', suited' : ''}`; };
  // the five cards (of up to seven) that make the best hand
  const best5 = (cards) => { if (cards.length < 5) return null; let bs = -1, bc = null; const n = cards.length;
    const combos = []; const pick = (st, cur) => { if (cur.length === 5) { combos.push(cur.slice()); return; } for (let i = st; i < n; i++) { cur.push(cards[i]); pick(i + 1, cur); cur.pop(); } }; pick(0, []);
    combos.forEach(c => { const s = TB.evalHand(c); if (s > bs) { bs = s; bc = c; } }); return { score: bs, cards: bc }; };
  TB.best5 = best5;

  /* ================= the strip, the banner ================= */
  const css = document.createElement('style');
  css.textContent = `#pkStrip{position:absolute;left:50%;bottom:200px;transform:translateX(-50%);display:flex;gap:16px;align-items:flex-end;padding:8px 14px 8px;background:linear-gradient(180deg,rgba(26,16,10,.82),rgba(12,8,6,.88));border:1px solid #7a5a30;border-radius:8px;pointer-events:none;box-shadow:0 6px 24px rgba(0,0,0,.55);transition:border-color .3s,box-shadow .3s}
#pkStrip.turn{border-color:#ffe08a;box-shadow:0 0 22px rgba(255,214,110,.45),0 6px 24px rgba(0,0,0,.55)}
#pkStrip .grp{display:flex;flex-direction:column;align-items:center;gap:3px}#pkStrip .lbl{font:600 10px var(--body);letter-spacing:.12em;text-transform:uppercase;color:#c8b088}#pkStrip .cards{display:flex}#pkStrip .tcard{margin-right:3px}
#pkStrip .tcard.dim{opacity:.4;filter:grayscale(.6)}#pkStrip .tcard.slot{background:rgba(255,255,255,.04);border:1px dashed rgba(200,170,100,.35);box-shadow:none}#pkStrip .tcard.slot::after{display:none}
#pkStrip .info{display:flex;flex-direction:column;justify-content:flex-end;min-width:170px;max-width:230px;color:#e8d8b0;font-size:12.5px;line-height:1.35;padding-bottom:2px}#pkStrip .info b.h{display:block;font-family:var(--head);font-size:16px;color:#ffe08a;letter-spacing:.02em}#pkStrip .info .yt{color:#ffe08a;font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:11px;animation:pkpulse 1s ease-in-out infinite}
@keyframes pkpulse{50%{opacity:.35}}
#pkBanner{position:absolute;left:50%;top:22%;transform:translate(-50%,-50%) scale(.92);text-align:center;pointer-events:none;opacity:0;transition:opacity .3s,transform .3s;font-family:var(--head);text-shadow:0 3px 12px #000,0 0 26px rgba(0,0,0,.85)}#pkBanner.on{opacity:1;transform:translate(-50%,-50%) scale(1)}
#pkBanner .a{font-size:46px;color:#ffe08a;letter-spacing:.06em}#pkBanner .b{margin-top:4px;font-size:21px;color:#f2e6c8}#pkBanner .c{margin-top:2px;font-size:15px;color:#c8b890;font-family:var(--body)}`;
  document.head.appendChild(css);
  const el = (id) => { let e = document.getElementById(id); if (!e) { e = document.createElement('div'); e.id = id; document.getElementById('hud').appendChild(e); } return e; };
  F.pkBanner = (a, b, c, ms = 2600) => { const e = el('pkBanner'); e.innerHTML = `<div class="a">${a}</div>${b ? `<div class="b">${b}</div>` : ''}${c ? `<div class="c">${c}</div>` : ''}`; e.classList.add('on'); clearTimeout(F.pkBT); F.pkBT = setTimeout(() => e.classList.remove('on'), ms); };
  const ding = () => { const A = G.audio; if (A.ctx && A.ctx.state === 'running' && A.bell) { const t = A.ctx.currentTime; A.bell(A.sfxBus, t, 784, 0.16); A.bell(A.sfxBus, t + 0.14, 1175, 0.14); } else G.sfx('coin', 0.7); };
  const hideStrip = () => { const e = document.getElementById('pkStrip'); if (e) e.hidden = true; F.pkBest = null; };
  const STREET = { flop: 'The flop', turn: 'The turn', river: 'The river' };

  /* ================= every frame at the poker table ================= */
  const sync0 = F.C.poker.sync;
  F.C.poker.sync = function (L, t, dt) {
    const r = sync0.call(this, L, t, dt);
    if (!F.seated || F.seated.L !== L || !t || !t.st) { if (F.seated && F.seated.L === L) hideStrip(); else if (!F.seated || F.seated.L.game !== 'poker') hideStrip(); return r; }
    const st = t.st, P = st.pl.find(p => p.id === me()); if (!P) { hideStrip(); return r; }
    const live = ['pre', 'flop', 'turn', 'river', 'done'].includes(st.street), inHand = live && P.inHand && !P.folded && P.hole.length === 2;
    const cards = inHand ? P.hole.concat(st.board) : [], B = cards.length >= 5 ? best5(cards) : null;
    F.pkBest = B ? new Set(B.cards) : null;
    const desc = !inHand ? (P.folded && live ? 'Folded' : P.chips <= 0 ? 'Out of chips' : 'Waiting for the next hand') : B ? TB.handDesc(B.score) : holeDesc(P.hole);
    const mine = GM.poker.myTurn(t, me()), pot = st.pl.reduce((a, p) => a + p.tot, 0), toCall = Math.max(0, st.curBet - P.bet);
    // the strip
    const s = el('pkStrip'), card = (c, cls) => c === undefined ? '<span class="tcard sm slot"></span>' : TB.card(c, { small: true, hl: F.pkBest && F.pkBest.has(c) }).replace('class="tcard', `class="tcard ${cls || ''}`);
    const boardH = [0, 1, 2, 3, 4].map(k => card(live ? st.board[k] : undefined, F.pkBest && st.board[k] !== undefined && !F.pkBest.has(st.board[k]) ? 'dim' : '')).join('');
    const holeH = P.hole.length === 2 && live ? P.hole.map(c => card(c, (P.folded ? 'dim' : '') + (F.pkBest && !F.pkBest.has(c) ? ' dim' : ''))).join('') : '<span class="tcard sm slot"></span><span class="tcard sm slot"></span>';
    const h = `<div class="grp"><span class="lbl">The board</span><div class="cards">${boardH}</div></div><div class="grp"><span class="lbl">Your hand</span><div class="cards">${holeH}</div></div><div class="info">${mine ? '<span class="yt">▶ Your turn</span>' : ''}<b class="h">${esc(desc)}</b><span>Pot ${pot}${inHand && st.street !== 'done' ? ` · ${toCall ? `${Math.min(toCall, P.chips)} to call` : 'nothing to call'}` : ''}</span><span>Your chips ${P.chips}</span></div>`;
    if (s._h !== h) { s.innerHTML = h; s._h = h; } s.hidden = !!(G.roulette && G.roulette._hh) || G.ui.modalOpen() || (F.pkBoard && F.tv.k > 0.5); s.classList.toggle('turn', mine);
    // your turn: a bell and a banner, once each time it comes round to you
    const tk = `${st.hand}|${st.street}|${st.turn}|${st.curBet}`;
    if (mine && L.pkTurnK !== tk) { L.pkTurnK = tk; ding(); F.pkBanner('Your turn', toCall ? `${Math.min(toCall, P.chips)} to call${toCall >= P.chips ? ' (all in)' : ''} · pot ${pot}` : `Check or bet · pot ${pot}`, esc(desc)); }
    if (!mine) L.pkTurnK = null;
    // a new street: what you've got now
    const sk = `${st.hand}|${st.street}`;
    if (L.pkStreetK !== sk) { const was = L.pkStreetK; L.pkStreetK = sk;
      if (was && inHand && STREET[st.street] && !mine) F.pkBanner(STREET[st.street], `You have <b>${esc(desc)}</b>`, '', 2400);
      if (was && st.street === 'pre' && inHand && !mine) F.pkBanner(`Hand ${st.hand}`, `You hold <b>${esc(desc)}</b>`, '', 2000);
      if (st.street === 'done' && st.result && was) { const w = st.result.find(x => x.id === me()); if (w) F.pkBanner(`You win ${w.amt}`, w.hand ? esc(w.hand) : 'Everyone else folded', '', 3200); else if (st.result.length) F.pkBanner(`${esc(st.result[0].name)} wins ${st.result[0].amt}`, st.result[0].hand ? esc(st.result[0].hand) : '', inHand ? `You had ${esc(desc)}` : '', 3000); } }
    return r;
  };
  // F: the close look at the board
  const in0 = F.C.poker.input;
  F.C.poker.input = function (L, t, dt) {
    if (F.key('KeyF')) { F.pkBoard = !(F.pkBoard && F.tv.on); F.tv.on = F.pkBoard; G.sfx('click', 0.3); }
    if (!F.tv.on) F.pkBoard = false;
    const o = in0.call(this, L, t, dt) || {}; o.keys = (o.keys || []).concat([['F', F.pkBoard ? 'back to your seat' : 'look at the board']]); return o;
  };
  const tv0 = F.tvPose;
  F.tvPose = () => { const S = F.seated; if (S && F.pkBoard && S.L.game === 'poker') { const L = S.L, st = L.seats[S.slot], dx = L.cx - st.x, dz = L.cz - st.z, l = Math.hypot(dx, dz) || 1, d = new G.V3(dx / l, 0, dz / l), c = new G.V3(L.cx, L.ty, L.cz - 0.02);
    return { pos: c.clone().add(new G.V3(0, 0.62, 0.2)), at: c.clone().add(new G.V3(0, 0, 0.16)), up: new G.V3(0, 0, -1) }; } return tv0(); };
  const st0 = F.stand; F.stand = () => { F.pkBoard = false; hideStrip(); return st0(); };
  if (F.HELP && F.HELP.poker) F.HELP.poker.c.splice(F.HELP.poker.c.length - 3, 0, ['F', 'look straight down at the board (the shared cards)']);
})();
