/* ============================================================
   Roulette in the Grand Arcade: a single-zero wheel that spins itself
   - full European rules: straight, split, street, corner, six line, trio, first four, columns, dozens,
     red/black, odd/even, 1–18/19–36. La partage: even-money bets lose only half when the ball finds zero.
   - first person and seated like every other table: you place chips with the crosshair on the layout,
     the chips fly there by magic, the losers are swallowed by the wheel and the winnings float back to you
   - no croupier: the ball is launched by magic, rides the track, drops, skitters over the frets and lands
   - every real spin swoops your camera down over the wheel to watch the ball, then glides you back to your seat
   - a spooky tarantella plays while the ball runs, speeding and slowing with it, and lands on a final chord
   - the host's roll is the truth: everyone replays the same ball path, choreographed to land on that pocket
   ============================================================ */
'use strict';
(() => {
  const F = G.fp, TB = G.tables, GM = TB.GAMES, T = G.tavern, TM = T.models, A = G.arcade, UI = G.ui, R = Math.random;
  const me = () => G.net.myId(), now = () => Date.now(), V = (x, y, z) => new G.V3(x, y, z);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const RL = G.roulette = { undo: [] };

  /* ================= the wheel and the rules ================= */
  const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const colorOf = n => n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black';
  RL.ORDER = ORDER; RL.colorOf = colorOf;
  const cOf = n => Math.floor((n - 1) / 3), rOf = n => (n - 1) % 3;
  const span = (a, b) => { const o = []; for (let i = a; i <= b; i++) o.push(i); return o; };
  const OUT = ['low', 'even', 'red', 'black', 'odd', 'high'];
  const OUTN = { low: n => n >= 1 && n <= 18, high: n => n >= 19, even: n => n > 0 && n % 2 === 0, odd: n => n % 2 === 1, red: n => REDS.has(n), black: n => n > 0 && !REDS.has(n) };
  const OUTNAME = { low: '1 to 18', high: '19 to 36', even: 'Even', odd: 'Odd', red: 'Red', black: 'Black' };
  // a bet key -> the numbers it covers, what it pays (to 1), its name, and where its chips sit on the layout (u, v in cells)
  const cache = {};
  RL.bet = (k) => {
    if (k in cache) return cache[k]; let b = null, m;
    if ((m = /^n(\d+)$/.exec(k)) && +m[1] <= 36) { const n = +m[1]; b = { nums: [n], pay: 35, name: `Straight up ${n}`, u: n ? cOf(n) + 0.5 : -0.5, v: n ? rOf(n) + 0.5 : 1.5 }; }
    else if ((m = /^s(\d+)_(\d+)$/.exec(k))) { const a = +m[1], c = +m[2];
      if (a === 0 && c >= 1 && c <= 3) b = { u: 0, v: c - 0.5 };
      else if (a >= 1 && c - a === 3 && c <= 36) b = { u: cOf(a) + 1, v: rOf(a) + 0.5 };
      else if (a >= 1 && c - a === 1 && a % 3 !== 0 && c <= 36) b = { u: cOf(a) + 0.5, v: rOf(a) + 1 };
      if (b) Object.assign(b, { nums: [a, c], pay: 17, name: `Split ${a}/${c}` }); }
    else if ((m = /^t(\d+)$/.exec(k)) && +m[1] % 3 === 1 && +m[1] <= 34) { const a = +m[1]; b = { nums: span(a, a + 2), pay: 11, name: `Street ${a}–${a + 2}`, u: cOf(a) + 0.5, v: 0 }; }
    else if ((m = /^c(\d+)$/.exec(k)) && +m[1] % 3 !== 0 && +m[1] >= 1 && +m[1] <= 32) { const a = +m[1]; b = { nums: [a, a + 1, a + 3, a + 4], pay: 8, name: `Corner ${a}/${a + 1}/${a + 3}/${a + 4}`, u: cOf(a) + 1, v: rOf(a) + 1 }; }
    else if ((m = /^l(\d+)$/.exec(k)) && +m[1] % 3 === 1 && +m[1] <= 31) { const a = +m[1]; b = { nums: span(a, a + 5), pay: 5, name: `Six line ${a}–${a + 5}`, u: cOf(a) + 1, v: 0 }; }
    else if (k === 'z1') b = { nums: [0, 1, 2], pay: 11, name: 'Trio 0/1/2', u: 0, v: 1 };
    else if (k === 'z2') b = { nums: [0, 2, 3], pay: 11, name: 'Trio 0/2/3', u: 0, v: 2 };
    else if (k === 'ff') b = { nums: [0, 1, 2, 3], pay: 8, name: 'First four 0–3', u: 0, v: 0 };
    else if ((m = /^col([123])$/.exec(k))) { const r = +m[1] - 1; b = { nums: span(1, 36).filter(n => rOf(n) === r), pay: 2, name: `Column ${r + 1} (${r + 1}, ${r + 4} … ${r + 34})`, u: 12.5, v: r + 0.5, rect: [12, r, 13, r + 1] }; }
    else if ((m = /^dz([123])$/.exec(k))) { const d = +m[1] - 1; b = { nums: span(d * 12 + 1, d * 12 + 12), pay: 2, name: `${['1st', '2nd', '3rd'][d]} dozen (${d * 12 + 1}–${d * 12 + 12})`, u: d * 4 + 2, v: -0.5, rect: [d * 4, -1, d * 4 + 4, 0] }; }
    else if (OUT.includes(k)) { const i = OUT.indexOf(k); b = { nums: span(0, 36).filter(OUTN[k]), pay: 1, even: true, name: OUTNAME[k], u: i * 2 + 1, v: -1.5, rect: [i * 2, -2, i * 2 + 2, -1] }; }
    return (cache[k] = b);
  };
  // every chip spot on the edges and corners of the number grid, for snapping the crosshair
  const INSIDE = [];
  { const add = k => { const b = RL.bet(k); if (b) INSIDE.push({ k, u: b.u, v: b.v }); };
    for (let n = 1; n <= 36; n++) { add(`s${n}_${n + 3}`); if (n % 3) add(`s${n}_${n + 1}`); if (n % 3 === 1) { add('t' + n); add('l' + n); } if (n % 3) add('c' + n); }
    [1, 2, 3].forEach(c => add(`s0_${c}`)); add('z1'); add('z2'); add('ff'); }
  RL.keyAt = (u, v) => {
    if (u > -0.3 && u < 12.2 && v > -0.24 && v < 3.12) { let best = null, bd = 0.21; INSIDE.forEach(s => { const d = Math.hypot(s.u - u, s.v - v); if (d < bd) { bd = d; best = s.k; } }); if (best) return best; }
    if (v >= 0 && v < 3) { if (u >= -1 && u < 0) return 'n0'; if (u >= 0 && u < 12) return 'n' + (Math.floor(u) * 3 + Math.floor(v) + 1); if (u >= 12 && u < 13) return 'col' + (Math.floor(v) + 1); }
    if (u >= 0 && u < 12 && v >= -1 && v < 0) return 'dz' + (Math.floor(u / 4) + 1);
    if (u >= 0 && u < 12 && v >= -2 && v < -1) return OUT[Math.floor(u / 2)];
    return null;
  };
  RL.payout = (k, amt, n) => { const b = RL.bet(k); if (!b) return 0; if (b.nums.includes(n)) return amt * (b.pay + 1); if (n === 0 && b.even) return Math.floor(amt / 2); return 0; };
  const CHIPS = [1, 5, 25, 100];
  RL.SPIN_MS = 8400;
  const TS = 7.2, TD = 4.5;   // the ball settles at TS seconds; it leaves the track at TD

  /* ================= the game, run by the table's host ================= */
  const gest = (id, act, dur) => { const m = TB.npcModel && TB.npcModel(id); if (m && T.gesture) T.gesture(m, act, dur); };
  const tot = p => p.bets.reduce((a, b) => a + b.amt, 0);
  GM.roulette = {
    name: 'Roulette', icon: '🎡', min: 1, max: 5, npc: true, payOnSeat: false, joinLate: true, minBuy: 1, maxBuy: 100, defBuy: 5, step: 1, buyLabel: 'Table minimum', leaveLabel: 'Leave table',
    rules: 'A single-zero wheel that spins itself. Put chips anywhere on the layout, then the ball is launched. Straight up pays 35 to 1, split 17, street 11, trio 11, corner 8, first four 8, six line 5, column and dozen 2, red/black, odd/even and 1–18/19–36 pay even money. La partage: when the ball lands on zero, even-money bets lose only half.',
    newP(s) { return { id: s.id, name: s.name, npc: !!s.npc, bets: [], last: [], ready: false, nb: 0, want: s.npc ? 1 + Math.floor(R() * 3) : 0 }; },
    start(t) { const st = t.st; Object.assign(st, { pl: t.seats.map(s => this.newP(s)), hist: [], sn: 0, rn: 1, phase: 'bet', at: 0, spin: null, res: null }); TB.say(t, 'Place your bets'); },
    addLate(t, s) { t.st.pl.push(this.newP(s)); },
    act(t, id, a) {
      const st = t.st, p = st.pl.find(x => x.id === id); if (!p) return false;
      if (a.t === 'bet') {
        const list = Array.isArray(a.list) ? a.list.slice(0, 60) : []; let refund = 0, placed = 0;
        list.forEach(x => { const k = String(x.k || ''), amt = Math.round(+x.amt || 0), B = RL.bet(k); if (amt <= 0) return;
          const cur = p.bets.find(b => b.k === k), ok = st.phase === 'bet' && !p.left && B && amt >= t.buy && tot(p) + amt <= t.buy * 500 && (cur ? cur.amt : 0) + amt <= t.buy * 100;
          if (!ok) { refund += amt; return; } if (cur) cur.amt += amt; else p.bets.push({ k, amt }); placed += amt; });
        if (refund && !p.npc) TB.pay(t, id, refund, 'Bet returned', true);
        if (placed && !p.npc) { p.ready = false; if (!st.at) st.at = now() + 30000; }
        return;
      }
      if (a.t === 'unbet') {
        if (st.phase !== 'bet') return false; let back = 0;
        if (a.all) { back = tot(p); p.bets = []; }
        else { const b = p.bets.find(x => x.k === a.k); if (!b) return false; const take = Math.min(b.amt, Math.round(+a.amt || b.amt)); b.amt -= take; back = take; if (b.amt < t.buy) { back += b.amt; p.bets = p.bets.filter(x => x !== b); } }
        if (back && !p.npc) TB.pay(t, id, back, 'Bet taken back', true); p.ready = false; return;
      }
      if (a.t === 'ready') {
        if (st.phase !== 'bet' || !p.bets.length) return false; p.ready = true; TB.say(t, `${p.name} is ready`);
        const hum = st.pl.filter(x => !x.npc && !x.left); if (hum.every(x => x.ready)) this.spin(t); return;
      }
      return false;
    },
    spin(t) {
      const st = t.st; if (st.phase !== 'bet' || !st.pl.some(p => p.bets.length)) return;
      const res = Math.floor(R() * 37); st.spin = { n: ++st.sn, res }; st.phase = 'spin'; st.at = now() + RL.SPIN_MS; st.res = null;
      st.pl.forEach(p => { p.ready = false; }); TB.say(t, 'No more bets! The wheel spins itself…');
    },
    settle(t) {
      const st = t.st, n = st.spin.res; st.res = {};
      st.pl.forEach(p => { let back = 0, staked = 0; p.bets.forEach(b => { staked += b.amt; back += RL.payout(b.k, b.amt, n); });
        st.res[p.id] = { back, staked };
        if (back && !p.npc) TB.pay(t, p.id, back, `Roulette · ${n}`);
        if (staked) { if (back > staked) { TB.say(t, `${p.name} wins ${back - staked}`); gest(p.id, 'cheer', 1.6); } else if (back < staked && R() < 0.4) gest(p.id, 'slam', 0.6); } });
      st.hist.unshift(n); st.hist = st.hist.slice(0, 14);
      TB.say(t, `${n} ${n === 0 ? 'green' : colorOf(n)}${n ? `, ${n % 2 ? 'odd' : 'even'}, ${n <= 18 ? 'low' : 'high'}` : ''}`);
      st.phase = 'settle'; st.at = now() + 6200;
    },
    round(t) {
      const st = t.st; st.pl = st.pl.filter(p => !p.left);
      st.pl.forEach(p => { p.last = p.bets.map(b => ({ k: b.k, amt: b.amt })); p.bets = []; p.ready = false; p.nb = 0; if (p.npc) p.want = 1 + Math.floor(R() * 3); });
      st.phase = 'bet'; st.at = 0; st.rn++; st.res = null; TB.say(t, 'Place your bets');
    },
    npcBet(t, p) {
      const st = t.st; if (st.phase !== 'bet') return; let k; const r = R(), lucky = [...p.name].reduce((a, c) => a + c.charCodeAt(0), 0) % 37;
      if (p.nb === 0 && r < 0.5) k = 'n' + lucky;
      else if (r < 0.42) k = ['red', 'black', 'odd', 'even', 'low', 'high', 'dz1', 'dz2', 'dz3', 'col1', 'col2', 'col3'][Math.floor(R() * 12)];
      else if (r < 0.62) k = 'n' + Math.floor(R() * 37);
      else if (r < 0.76) k = 'c' + (Math.floor(R() * 11) * 3 + 1 + Math.floor(R() * 2));
      else if (r < 0.86) k = 't' + (Math.floor(R() * 12) * 3 + 1);
      else if (r < 0.93) k = 'l' + (Math.floor(R() * 11) * 3 + 1);
      else { const a = Math.floor(R() * 11) * 3 + 1 + Math.floor(R() * 3); k = `s${a}_${a + 3}`; }
      const amt = t.buy * [1, 1, 2, 3, 5][Math.floor(R() * 5)], cur = p.bets.find(b => b.k === k);
      if (cur) cur.amt += amt; else p.bets.push({ k, amt }); p.nb++; gest(p.id, 'point', 0.8);
    },
    next(t) {
      const st = t.st;
      if (st.phase === 'spin') {   // the host settles once its own ball has landed (a slow frame never pays out before the ball is down)
        const L = F.L.roulette, a = L && L.anim;
        if (L && G.World.theme === 'hideout' && now() < st.at + 30000) { if (!a || a.n !== st.spin.n || !a.done) return { wait: 250, fn: () => false }; if (a.hold < 0.9) return { wait: (0.9 - a.hold) * 1000, fn: () => false }; return { wait: 0, fn: t => this.settle(t) }; }
        return { wait: Math.max(0, st.at - now()), fn: t => this.settle(t) }; }
      if (st.phase === 'settle') { const L = F.L.roulette; if (L && G.World.theme === 'hideout' && L.setN === st.spin.n && (L.setT || 0) < 3.4 && now() < st.at + 20000) return { wait: Math.max(250, st.at - now()), fn: () => (L.setT || 0) < 3.4 && now() < st.at + 20000 ? false : this.round(t) }; return { wait: st.at - now(), fn: t => this.round(t) }; }
      if (st.phase !== 'bet') return null;
      const cd = st.at ? st.at - now() : Infinity, npc = st.pl.find(p => p.npc && p.nb < p.want);
      if (npc) { const w = 1300 + R() * 2600; if (w < cd) return { wait: w, fn: t => this.npcBet(t, npc) }; }
      if (st.at) return { wait: cd, fn: t => { if (st.pl.some(p => p.bets.length)) this.spin(t); else st.at = 0; } };
      return null;
    },
    leave(t, id) { const st = t.st, i = st.pl.findIndex(x => x.id === id); if (i < 0) return 0; const p = st.pl[i];
      if (st.phase === 'bet') { const back = tot(p); st.pl.splice(i, 1); const hum = st.pl.filter(x => !x.npc && !x.left); if (hum.length && hum.every(x => x.ready)) this.spin(t); return back; }
      p.left = true; return 0; },
    closeOut(t, id) { const p = t.st && t.st.pl && t.st.pl.find(x => x.id === id); return p && (t.st.phase === 'bet' || t.st.phase === 'spin') ? tot(p) : 0; },
    view(t, id) {
      const st = t.st, p = st.pl.find(x => x.id === id);
      return `<div class="felt"><p class="note">Last numbers: ${st.hist.map(n => `<b style="color:${n === 0 ? '#5ad07a' : REDS.has(n) ? '#ff6a6a' : '#e8e0d0'}">${n}</b>`).join(' · ') || 'none yet'}</p>${p ? `<p class="note">Your bets: ${p.bets.map(b => `${esc(RL.bet(b.k).name)} (${b.amt})`).join(', ') || 'none'}</p>` : ''}<p class="note">Take your seat at the table to play.</p></div>`;
    }
  };

  /* ================= textures ================= */
  const CELL = 0.1, LX0 = -0.28, LZ0 = 0.22, TY = 0.8325, WY = 0.842, RD = 0.3, RP = 0.229, BR = 0.0095, SEG = Math.PI * 2 / 37;
  const uvW = (L, u, v, y = TY) => V(L.tx + LX0 + u * CELL, y, L.tz + LZ0 - v * CELL);
  const wUV = (L, p) => ({ u: (p.x - L.tx - LX0) / CELL, v: (L.tz + LZ0 - p.z) / CELL });
  const RED = '#9a1424', BLK = '#161012', GRN = '#1d7a3c';
  RL.layoutTex = () => {
    const P = 128, U0 = -1.15, V1 = 3.15, c = document.createElement('canvas'); c.width = Math.round(14.3 * P); c.height = Math.round(5.3 * P); const x = c.getContext('2d');
    const X = u => (u - U0) * P, Y = v => (V1 - v) * P;
    const g = x.createRadialGradient(c.width / 2, c.height / 2, 50, c.width / 2, c.height / 2, c.width * 0.6); g.addColorStop(0, '#1f5a2c'); g.addColorStop(1, '#123a1c'); x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${R() * 0.05})`; x.fillRect(R() * c.width, R() * c.height, 2, 2); }
    const line = '#e2cf9a', box = (u0, v0, u1, v1) => { x.strokeStyle = line; x.lineWidth = 4; x.strokeRect(X(u0), Y(v1), (u1 - u0) * P, (v1 - v0) * P); };
    const text = (s, u, v, size, col = '#f2e6c8', font = 'Georgia') => { x.fillStyle = col; x.font = `600 ${size}px ${font}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(s, X(u), Y(v)); };
    for (let n = 1; n <= 36; n++) { const u = cOf(n), v = rOf(n); x.fillStyle = REDS.has(n) ? RED : BLK; x.beginPath(); x.ellipse(X(u + 0.5), Y(v + 0.5), P * 0.4, P * 0.36, 0, 0, Math.PI * 2); x.fill(); x.strokeStyle = 'rgba(226,207,154,.35)'; x.lineWidth = 2; x.stroke(); text(String(n), u + 0.5, v + 0.47, 62); box(u, v, u + 1, v + 1); }
    // zero: a pointed cell with a skull
    x.fillStyle = GRN; x.beginPath(); x.moveTo(X(0), Y(0)); x.lineTo(X(-0.55), Y(0)); x.lineTo(X(-1), Y(1.5)); x.lineTo(X(-0.55), Y(3)); x.lineTo(X(0), Y(3)); x.closePath(); x.fill(); x.strokeStyle = line; x.lineWidth = 4; x.stroke();
    text('0', -0.45, 1.25, 80); text('☠', -0.45, 2.1, 56, '#e8dcc0', 'serif');
    for (let r = 0; r < 3; r++) { box(12, r, 13, r + 1); text('2 to 1', 12.5, r + 0.5, 34); }
    ['1st 12', '2nd 12', '3rd 12'].forEach((s, d) => { box(d * 4, -1, d * 4 + 4, 0); text(s, d * 4 + 2, -0.5, 54); });
    OUT.forEach((k, i) => { box(i * 2, -2, i * 2 + 2, -1); const cu = i * 2 + 1, cv = -1.5;
      if (k === 'red' || k === 'black') { x.fillStyle = k === 'red' ? RED : BLK; x.beginPath(); x.moveTo(X(cu - 0.55), Y(cv)); x.lineTo(X(cu), Y(cv + 0.34)); x.lineTo(X(cu + 0.55), Y(cv)); x.lineTo(X(cu), Y(cv - 0.34)); x.closePath(); x.fill(); x.strokeStyle = line; x.lineWidth = 3; x.stroke(); }
      else text({ low: '1–18', even: 'EVEN', odd: 'ODD', high: '19–36' }[k], cu, cv, 50); });
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
  };
  RL.wheelTex = () => {
    const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), k = S / 2 / RD, C = S / 2;
    const g = x.createRadialGradient(C, C, 10, C, C, 0.2 * k); g.addColorStop(0, '#7a4a22'); g.addColorStop(1, '#2e180a'); x.fillStyle = g; x.beginPath(); x.arc(C, C, 0.205 * k, 0, 7); x.fill();
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; x.strokeStyle = 'rgba(214,170,80,.55)'; x.lineWidth = 6; x.beginPath(); x.moveTo(C, C); x.lineTo(C + Math.cos(a) * 0.2 * k, C + Math.sin(a) * 0.2 * k); x.stroke(); }
    ORDER.forEach((n, i) => { const a0 = -(i + 0.5) * SEG, a1 = -(i - 0.5) * SEG, col = colorOf(n);
      x.fillStyle = col === 'red' ? '#5e0c14' : col === 'black' ? '#0c0909' : '#11502a'; x.beginPath(); x.arc(C, C, 0.258 * k, a0, a1); x.arc(C, C, 0.2 * k, a1, a0, true); x.closePath(); x.fill();
      x.fillStyle = col === 'red' ? RED : col === 'black' ? '#1c1618' : GRN; x.beginPath(); x.arc(C, C, RD * k, a0, a1); x.arc(C, C, 0.258 * k, a1, a0, true); x.closePath(); x.fill();
      const a = -i * SEG; x.save(); x.translate(C + Math.cos(a) * 0.279 * k, C + Math.sin(a) * 0.279 * k); x.rotate(a - Math.PI / 2); x.fillStyle = '#f2e6c8'; x.font = 'bold 30px Georgia'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(n), 0, 0); x.restore();
      x.strokeStyle = 'rgba(214,190,130,.7)'; x.lineWidth = 2; x.beginPath(); x.moveTo(C + Math.cos(a0) * 0.258 * k, C + Math.sin(a0) * 0.258 * k); x.lineTo(C + Math.cos(a0) * RD * k, C + Math.sin(a0) * RD * k); x.stroke(); });
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
  };
  // chips: one mesh per stack, striped edge and a skull on the top, in the colour of the seat that owns them
  const SEATC = ['#7a3ac8', '#1f9a90', '#d89a18', '#c8407e', '#3a72d0'];
  const chipTex = {}, chipMat = {}, chipGeo = {}, CR = 0.024, CHH = 0.0048;
  const chipMats = (col) => { if (chipMat[col]) return chipMat[col];
    const s = document.createElement('canvas'); s.width = 128; s.height = 16; let x = s.getContext('2d'); x.fillStyle = col; x.fillRect(0, 0, 128, 16); x.fillStyle = '#f2ead6'; for (let i = 0; i < 6; i++) x.fillRect(i * 21.3 + 4, 0, 9, 16); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 0, 128, 2); x.fillRect(0, 14, 128, 2);
    const tp = document.createElement('canvas'); tp.width = tp.height = 128; x = tp.getContext('2d'); x.fillStyle = col; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#f2ead6'; x.lineWidth = 10; x.setLineDash([14, 12]); x.beginPath(); x.arc(64, 64, 56, 0, 7); x.stroke(); x.setLineDash([]); x.lineWidth = 3; x.beginPath(); x.arc(64, 64, 40, 0, 7); x.stroke(); x.fillStyle = '#f2ead6'; x.font = '48px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('☠', 64, 66);
    const ts = new THREE.CanvasTexture(s), tt = new THREE.CanvasTexture(tp); ts.wrapT = THREE.RepeatWrapping; ts.wrapS = THREE.RepeatWrapping; [ts, tt].forEach(t => { t.encoding = THREE.sRGBEncoding; });
    const side = new THREE.MeshStandardMaterial({ map: ts, roughness: 0.45 }), top = new THREE.MeshStandardMaterial({ map: tt, roughness: 0.4 }); return (chipMat[col] = [side, top, top]); };
  const stackGeo = (n) => { if (chipGeo[n]) return chipGeo[n]; const g = new THREE.CylinderGeometry(CR, CR, n * CHH, 20, 1); const uv = g.attributes.uv; for (let i = 0; i < 21 * 2; i++) uv.setY(i, uv.getY(i) * n); uv.needsUpdate = true; g.translate(0, n * CHH / 2, 0); return (chipGeo[n] = g); };
  const chipCount = (amt, unit) => { let n = 0; for (const v of [100, 25, 5, 1]) { const c = Math.floor(amt / (v * unit)); n += c; amt -= c * v * unit; } return G.clamp(n, 1, 16); };
  RL.stack = (n, col) => { const m = new THREE.Mesh(stackGeo(n), chipMats(col)); m.castShadow = true; m.userData.dynamic = true; m.userData.n = n; return m; };

  /* ================= building the table ================= */
  RL.build = (W, tx, tz) => {
    const grp = W.group, wood = G.mat('col', { c: 0x2a1a10, t: 'wood' }), bone = G.mat('col', { c: 0xb8ab90, r: 0.9 }), felt = G.mat('col', { c: 0x14401e, t: 'cloth', r: 0.95 }), rail = G.mat('col', { c: 0x3a0c12, t: 'cloth', r: 0.8 });
    const X0 = -1.45, X1 = 1.45, HW = 0.75, cx = (X0 + X1) / 2, len = X1 - X0;
    M.P(grp, M.box(len, 0.07, HW * 2), wood, [tx + cx, 0.78, tz]); M.P(grp, M.box(len - 0.1, 0.02, HW * 2 - 0.1), felt, [tx + cx, 0.82, tz]);
    [-1, 1].forEach(s => { M.P(grp, M.cyl(0.035, 0.035, len - 0.04, 10), rail, [tx + cx, 0.835, tz + s * (HW - 0.035)], [0, 0, Math.PI / 2]); M.P(grp, M.cyl(0.035, 0.035, HW * 2 - 0.04, 10), rail, [tx + cx + s * (len / 2 - 0.035), 0.835, tz], [Math.PI / 2, 0, 0]); });
    [[X0 + 0.25, -0.5], [X0 + 0.25, 0.5], [X1 - 0.25, -0.5], [X1 - 0.25, 0.5], [cx, -0.5], [cx, 0.5]].forEach(([x, z]) => { M.P(grp, M.cyl(0.035, 0.04, 0.68, 10), bone, [tx + x, 0.4, tz + z]); [0.08, 0.72].forEach(y => M.mirror(k => M.P(grp, M.sph(0.05, 10, 8), bone, [tx + x + k * 0.025, y, tz + z]))); });
    // the layout
    const lay = new THREE.Mesh(new THREE.PlaneGeometry(14.3 * CELL, 5.3 * CELL), new THREE.MeshStandardMaterial({ map: RL.layoutTex(), roughness: 0.92 })); lay.rotation.x = -Math.PI / 2; lay.position.set(tx + LX0 + 6 * CELL, TY - 0.001, tz + LZ0 - 0.5 * CELL); lay.receiveShadow = true; grp.add(lay);
    const hit = new THREE.Mesh(new THREE.PlaneGeometry(14.6 * CELL, 5.6 * CELL), new THREE.MeshBasicMaterial({ visible: false })); hit.rotation.x = -Math.PI / 2; hit.position.copy(lay.position); hit.position.y += 0.004; hit.userData.dynamic = true; grp.add(hit);
    // the wheel: a polished bowl set into the table, the rotor turning inside it
    const wx = tx - 0.95, wz = tz, bowlW = new THREE.MeshStandardMaterial({ color: 0x3a2010, roughness: 0.35, metalness: 0.1, side: THREE.DoubleSide }), track = new THREE.MeshStandardMaterial({ color: 0xa8743a, roughness: 0.28, metalness: 0.05, side: THREE.DoubleSide });
    { const b = new THREE.Mesh(M.lathe([0.298, -0.004, 0.30, 0.0, 0.355, 0.026, 0.392, 0.03, 0.40, 0.032], 64), track); b.position.set(wx, WY, wz); grp.add(b);
      const w = new THREE.Mesh(M.lathe([0.40, 0.03, 0.402, 0.072, 0.448, 0.074, 0.456, 0.06, 0.458, -0.02], 64), bowlW); w.position.set(wx, WY, wz); grp.add(w);
      const brass = G.mat('gold');
      M.P(grp, M.tor(0.448, 0.006, 6, 64), brass, [wx, WY + 0.074, wz], [Math.PI / 2, 0, 0]);
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.2, d = new THREE.Mesh(new THREE.OctahedronGeometry(0.011), brass); d.scale.set(1, 0.45, 2.2); d.position.set(wx + Math.cos(a) * 0.335, WY + 0.0175, wz - Math.sin(a) * 0.335); d.rotation.y = a + (i % 2 ? Math.PI / 2 : 0); grp.add(d); } }
    const rotor = new THREE.Group(); rotor.position.set(wx, WY, wz); rotor.userData.dynamic = true; grp.add(rotor);
    { const disk = new THREE.Mesh(new THREE.CircleGeometry(RD, 74), new THREE.MeshStandardMaterial({ map: RL.wheelTex(), roughness: 0.4 })); disk.rotation.x = -Math.PI / 2; disk.receiveShadow = true; rotor.add(disk);
      const silver = new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.25, metalness: 0.8 });
      const frets = new THREE.InstancedMesh(new THREE.BoxGeometry(0.058, 0.011, 0.0025), silver, 37), mx = new THREE.Matrix4(), q = new THREE.Quaternion(), s1 = V(1, 1, 1);
      for (let i = 0; i < 37; i++) { const a = (i + 0.5) * SEG; q.setFromAxisAngle(V(0, 1, 0), a); mx.compose(V(Math.cos(a) * 0.229, 0.0055, -Math.sin(a) * 0.229), q, s1); frets.setMatrixAt(i, mx); } frets.userData.noShadow = true; frets.frustumCulled = false; rotor.add(frets);
      [0.2, 0.258].forEach(r => M.P(rotor, M.tor(r, 0.0035, 6, 74), silver, [0, 0.003, 0], [Math.PI / 2, 0, 0]));
      M.P(rotor, M.lathe([0.2, 0.0, 0.14, 0.012, 0.07, 0.024, 0.03, 0.03, 0, 0.031], 48), new THREE.MeshStandardMaterial({ color: 0x5a3418, roughness: 0.3, metalness: 0.1 }));
      const brass = G.mat('gold'); M.P(rotor, M.cyl(0.012, 0.018, 0.07, 12), brass, [0, 0.065, 0]);
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, arm = M.P(rotor, M.cyl(0.005, 0.005, 0.09, 6), bone, [Math.cos(a) * 0.045, 0.085, -Math.sin(a) * 0.045], [0, a, Math.PI / 2]); M.P(rotor, M.sph(0.011, 8, 6), bone, [Math.cos(a) * 0.09, 0.085, -Math.sin(a) * 0.09]); }
      const sk = A.skull(0.26, 0xb070ff); sk.position.y = 0.118; rotor.add(sk); }
    const ball = new THREE.Mesh(M.sph(BR, 14, 10), new THREE.MeshStandardMaterial({ color: 0xf4ecd8, roughness: 0.22, emissive: 0x6040a0, emissiveIntensity: 0.25 })); ball.castShadow = true; ball.userData.dynamic = true; grp.add(ball);
    // the board of past numbers on a bone post behind the wheel
    const bc = document.createElement('canvas'); bc.width = 256; bc.height = 512; const btex = new THREE.CanvasTexture(bc); btex.encoding = THREE.sRGBEncoding;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.0), new THREE.MeshStandardMaterial({ map: btex, emissive: 0xffffff, emissiveMap: btex, emissiveIntensity: 0.55 })); board.position.set(tx - 1.62, 1.55, tz - 0.62); board.rotation.y = 0.5; board.userData.dynamic = true; grp.add(board);
    M.P(grp, M.box(0.54, 1.04, 0.04), wood, [tx - 1.62 - Math.sin(0.5) * 0.025, 1.55, tz - 0.62 - Math.cos(0.5) * 0.025], [0, 0.5, 0]); M.P(grp, M.cyl(0.03, 0.04, 1.05, 10), bone, [tx - 1.62 - Math.sin(0.5) * 0.05, 0.525, tz - 0.62 - Math.cos(0.5) * 0.05]);
    W.addSolid(tx - 1.65, tz - 0.66, 0.25);
    // seats: four along the near side, one at the far end
    const seats = [-0.6, 0.1, 0.8, 1.5].map((x, i) => ({ x: tx + x, z: tz + 1.18, bank: { x: tx + G.clamp(x, -0.5, 1.3), z: tz + 0.6 }, look: { x: tx + x * 0.8 + 0.05, z: tz - 0.3 } })).concat([{ x: tx + 2.15, z: tz + 0.15, bank: { x: tx + 1.32, z: tz + 0.3 }, look: { x: tx + 0.3, z: tz + 0.17 } }]);
    seats.forEach(S => W.place(TM.stool(), S.x, 0, S.z, 0, 0));
    for (let x = X0 + 0.3; x <= X1 - 0.2; x += 0.45) W.addSolid(tx + x, tz, 0.72);
    W.lights.push({ pos: V(tx - 0.1, 2.4, tz + 0.2), color: 0xffd8a0, intensity: 2.6, dist: 9, seed: 91, flicker: false }); { const ch = M.prop.chandelier(); ch.scale.setScalar(1.2); W.hang(ch, tx - 0.9, 6.0, tz + 0.75); }
    W.lights.push({ pos: V(wx, 1.35, wz), color: 0xb080ff, intensity: 0.7, dist: 3.2, seed: 92, flicker: false });
    { const sc = TM.skullCandle(); sc.position.set(tx + 1.25, 0.835, tz - 0.55); grp.add(sc); }
    A.hangSign(W, 'ROULETTE', tx, tz, 0, 4.8, 2.8);
    W.interact.push({ id: 'roulette', label: 'Roulette', x: tx + 0.45, z: tz + 1.75, r: 2.7, desc: 'Up to five players · the wheel spins itself' });
    const L = F.L.roulette = { key: 'roulette', game: 'roulette', cx: tx + 0.32, cz: tz + 0.17, seats, eye: 1.2, pitch: -0.62, ty: TY, idle: [], extra: [], tx, tz, wx, wz, rotor, ball, hit, board, bc, btex, rot: 0, rw: 0.35, ballIdx: 0, ch: {}, spinN: null, hist: '' };
    { const S = seats[2], Rr = TM.patron(2); Rr.root.position.set(S.x, 0, S.z); Rr.root.rotation.y = Math.atan2(S.look.x - S.x, S.look.z - S.z); Rr.root.userData.dynamic = true; grp.add(Rr.root); W.hideNPCs.push(Rr); L.idle.push(Rr); }
    RL.drawBoard(L, []);
  };
  RL.drawBoard = (L, hist) => {
    const x = L.bc.getContext('2d'); x.fillStyle = '#120a08'; x.fillRect(0, 0, 256, 512); x.strokeStyle = '#c8a040'; x.lineWidth = 8; x.strokeRect(4, 4, 248, 504);
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#c8a040'; x.font = '600 26px Georgia'; x.fillText('☠ THE WHEEL ☠', 128, 34);
    const fill = n => n === 0 ? '#2ab85a' : REDS.has(n) ? '#e0283a' : '#e8e0d0';
    if (hist.length) { const n = hist[0]; x.fillStyle = n === 0 ? '#14602e' : REDS.has(n) ? '#7a0c18' : '#1a1416'; x.beginPath(); x.arc(128, 118, 62, 0, 7); x.fill(); x.strokeStyle = '#c8a040'; x.lineWidth = 4; x.stroke(); x.fillStyle = '#f6ecd2'; x.font = 'bold 76px Georgia'; x.fillText(String(n), 128, 122); }
    else { x.fillStyle = '#8a7a5a'; x.font = 'italic 24px Georgia'; x.fillText('no spins yet', 128, 118); }
    hist.slice(1, 12).forEach((n, i) => { const y = 216 + i * 27, xx = n === 0 ? 128 : REDS.has(n) ? 70 : 186; x.fillStyle = fill(n); x.font = 'bold 30px Georgia'; x.fillText(String(n), xx, y); });
    x.strokeStyle = 'rgba(200,160,64,.3)'; x.lineWidth = 2; x.beginPath(); x.moveTo(20, 196); x.lineTo(236, 196); x.stroke();
    L.btex.needsUpdate = true;
  };
  const ba0 = G.World.buildArcade;
  G.World.buildArcade = function (o) { ba0.call(this, o); if (!o.spots || !A.bounds) return; const sp = o.spots.roulette = { x: A.bounds.x0 + 40, z: A.bounds.z0 + 35 }; RL.build(this, sp.x, sp.z); };

  /* ================= the ball ================= */
  // relative to the rotor the ball runs down from far away to its pocket: psi(t) = target + D (1 - t/TS)^(P+1), plus skitter while it bounces
  const PW = 1.5, AMAX = 15, DREL = AMAX * TS / (PW + 1);
  const smooth = k => k * k * (3 - 2 * k);
  RL.ballAt = (a, t) => {   // -> { psi, r, h, speed (relative), hop }
    const tt = Math.min(t, TS), f = 1 - tt / TS; let psi = a.idx * SEG + DREL * Math.pow(f, PW + 1), r, h, hop = 0;
    const surf = rr => G.clamp((rr - 0.30) / 0.092, 0, 1) * 0.03;
    if (tt < TD) { r = 0.389 - Math.abs(Math.sin(tt * 7)) * 0.002 * (tt / TD); h = surf(0.392) + BR; }
    else if (tt < TD + 0.55) { const k = smooth((tt - TD) / 0.55); r = G.lerp(0.389, 0.305, k); h = surf(r) + BR + Math.sin(k * Math.PI) * 0.006; }
    else { const u = G.clamp((tt - TD - 0.55) / (TS - 0.5 - TD - 0.55), 0, 1), dec = 1 - u; r = G.lerp(0.305, RP, smooth(u)) + 0.018 * dec * Math.sin(u * 19); hop = Math.abs(Math.sin(u * Math.PI * 5)); h = BR + 0.022 * Math.pow(dec, 1.5) * hop + (r > 0.258 ? 0.002 : 0); psi += 0.16 * dec * dec * Math.sin(u * Math.PI * 5); }
    return { psi, r, h, speed: AMAX * Math.pow(f, PW), hop };
  };
  RL.launch = (L, sp) => {
    L.anim = { n: sp.n, res: sp.res, idx: ORDER.indexOf(sp.res), t: 0, done: false, hold: 0, lastHop: 0, dropped: false };
    const b = RL.ballAt(L.anim, 0), a = L.rot + b.psi, p = V(L.wx + Math.cos(a) * b.r, WY + b.h, L.wz - Math.sin(a) * b.r);
    G.fx.spark(p, 0xd0a0ff, 18, 1.6, 0.6, 0.025, 0); G.sfx('magic', 0.45, p); RL.tuneStart(L);
  };
  RL.tickWheel = (L, t, dt) => {
    const st = t && t.st, sp = st && st.spin, A2 = L.anim;
    if (sp && sp.n !== L.spinN) { L.spinN = sp.n; if (st.phase === 'spin') RL.launch(L, sp); else { L.anim = { n: sp.n, res: sp.res, idx: ORDER.indexOf(sp.res), t: TS, done: true, hold: 99 }; } }
    const a = L.anim, live = a && !a.done;
    const want = live ? 0.9 + 1.6 * Math.exp(-a.t / 2.6) : a && a.hold < 3 ? 0.12 : 0.35;
    L.rw = G.damp(L.rw, want, live && a.t < 0.3 ? 6 : 1.2, dt); L.rot += L.rw * dt; L.rotor.rotation.y = L.rot;
    let psi, r, h;
    if (live) {
      a.t += dt; const b = RL.ballAt(a, a.t); psi = b.psi; r = b.r; h = b.h;
      if (!a.dropped && a.t > TD) { a.dropped = true; RL.click(L, 0.5); }
      if (a.t > TD + 0.55 && b.hop < 0.15 && a.lastHop >= 0.15) RL.click(L, 0.35 * (1 - (a.t - TD) / (TS - TD)) + 0.08);
      a.lastHop = b.hop; RL.whir(L, a.t < TS - 0.4 ? b.speed : 0);
      if (a.t >= TS) { a.done = true; a.hold = 0; L.ballIdx = a.idx; RL.click(L, 0.3); RL.tuneEnd(L); RL.landed(L, a.res); }
    }
    if (!live) { if (a) { a.hold += dt; L.ballIdx = a.idx; } psi = L.ballIdx * SEG; r = RP; h = BR; RL.whir(L, 0); }
    const ang = L.rot + psi; L.ball.position.set(L.wx + Math.cos(ang) * r, WY + h, L.wz - Math.sin(ang) * r);
    if (live && R() < dt * 30 && a.t < TD) G.fx.spark(L.ball.position.clone(), 0xb080ff, 1, 0.2, 0.25, 0.012, 0);
    RL.tuneTick(L);
  };
  RL.click = (L, v) => G.sfx('click', v, L.ball.position);
  // the ball's roll: a looping noise that follows its speed
  RL.whir = (L, speed) => {
    const A2 = G.audio; if (!A2.ctx || A2.ctx.state !== 'running' || !A2.noiseBuf) return; const c = A2.ctx, near = RL.near(L);
    if (!RL.wh && speed > 0.5 && near > 0) { const s = c.createBufferSource(); s.buffer = A2.noiseBuf; s.loop = true; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4; f.frequency.value = 2400; const g = c.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(A2.sfxBus); s.start(); RL.wh = { s, f, g, off: 0 }; }
    const W2 = RL.wh; if (!W2) return; const v = speed > 0.5 ? Math.min(1, speed / 12) : 0;
    W2.g.gain.setTargetAtTime(v * 0.16 * near, c.currentTime, 0.06); W2.f.frequency.setTargetAtTime(900 + v * 2600, c.currentTime, 0.08);
    if (!v) { W2.off += 1; if (W2.off > 90) { try { W2.s.stop(); W2.s.disconnect(); W2.g.disconnect(); } catch (e) { } RL.wh = null; } } else W2.off = 0;
  };
  RL.near = (L) => { const c = G.camera; if (!c || G.World.theme !== 'hideout') return 0; const d = Math.hypot(c.position.x - L.wx, c.position.z - L.wz); return G.clamp(1 - (d - 3) / 11, 0, 1); };

  /* ================= the spin tune: a spooky tarantella ================= */
  // A minor, 6/8; eight bars of eighths (semitones from A4), looping while the ball runs; the tempo follows the ball
  const MEL = [[7, 12, 11, 12, 7, 3], [5, 2, -1, 2, 5, 8], [7, 3, 0, 3, 7, 12], [11, 7, 5, 2, -1, -5], [-4, 0, 5, 8, 5, 0], [-5, 0, 3, 7, 3, 0], [2, 5, 11, 14, 11, 7], [12, 7, 3, 0, 7, 12]];
  const CH = { a: { root: -24, tones: [-12, -9, -5] }, e: { root: -29, tones: [-13, -10, -7] }, d: { root: -19, tones: [-7, -4, 0] } }, PROG = ['a', 'e', 'a', 'e', 'd', 'a', 'e', 'a'];
  const hz = s => 440 * Math.pow(2, s / 12);
  RL.tuneStart = (L) => {
    const A2 = G.audio; if (!A2.ctx || A2.ctx.state !== 'running') return; const c = A2.ctx; RL.tuneStop(); if (RL.near(L) <= 0) return;
    const out = c.createGain(); out.gain.value = 0.0001; out.connect(A2.musicBus); const lead = c.createBiquadFilter(); lead.type = 'lowpass'; lead.frequency.value = 3200; lead.Q.value = 0.7; lead.connect(out);
    const acc = c.createBiquadFilter(); acc.type = 'lowpass'; acc.frequency.value = 1300; acc.Q.value = 1.5; acc.connect(out); const vb = c.createGain(); vb.gain.value = 0.18; out.connect(vb); if (A2.verb) vb.connect(A2.verb);
    RL.tune = { L, out, lead, acc, vb, on: true, next: c.currentTime + 0.08, step: 0 };
    // a pickup: a quick run up into the first bar
    [-12, -5, 0, 3].forEach((s, i) => RL.mando(c.currentTime + 0.02 + i * 0.055, hz(s), 0.13));
  };
  RL.mando = (t, f, v) => { const A2 = G.audio, M2 = RL.tune; if (!M2) return; A2.osc(M2.lead, t, f, f, 0.24, v, 'triangle', 0.002); A2.osc(M2.lead, t, f * 2.002, f * 2, 0.11, v * 0.28, 'square', 0.001); A2.osc(M2.lead, t + 0.045, f, f, 0.12, v * 0.35, 'triangle', 0.002); };
  RL.tuneTick = (L) => {
    const A2 = G.audio, M2 = RL.tune; if (!M2 || !M2.on || M2.L !== L || !A2.ctx) return; const c = A2.ctx, a = L.anim;
    M2.out.gain.setTargetAtTime(0.8 * RL.near(L) * (G.settings.music > 0 ? 1 : 0) + 0.0001, c.currentTime, 0.15);
    if (M2.next < c.currentTime - 0.25) M2.next = c.currentTime + 0.02;
    const sp = a && !a.done ? G.clamp(RL.ballAt(a, a.t).speed / AMAX, 0, 1) : 0, dur = G.lerp(0.2, 0.108, Math.pow(sp, 0.7));
    while (M2.next < c.currentTime + 0.14) {
      const t = M2.next, s = M2.step % 6, bar = Math.floor(M2.step / 6) % 8, ch = CH[PROG[bar]], note = MEL[bar][s];
      RL.mando(t, hz(note), s === 0 || s === 3 ? 0.17 : 0.12);
      if (s === 0) { A2.osc(M2.out, t, hz(ch.root), hz(ch.root), 0.32, 0.34, 'triangle', 0.004); if (A2.bell && bar % 2 === 0) A2.bell(M2.out, t, hz(note + 12), 0.045); }
      if (s === 3) A2.osc(M2.out, t, hz(ch.root + 7), hz(ch.root + 7), 0.26, 0.26, 'triangle', 0.004);
      if (s === 1 || s === 2 || s === 4 || s === 5) ch.tones.forEach(tn => A2.osc(M2.acc, t, hz(tn), hz(tn) * 0.995, 0.09, 0.05, 'sawtooth', 0.008));
      A2.nz(M2.out, t, s === 0 || s === 3 ? 0.11 : 0.05, 8000, 6500, 0.8, s === 0 || s === 3 ? 0.12 : 0.05, 'highpass', 0.001);
      M2.next += dur; M2.step++;
    }
  };
  RL.tuneEnd = (L) => {
    const A2 = G.audio, M2 = RL.tune; if (!M2 || !M2.on || !A2.ctx) return; M2.on = false; const c = A2.ctx, t = Math.max(c.currentTime + 0.03, M2.next - 0.05);
    A2.osc(M2.out, t, hz(-29), hz(-29), 0.3, 0.3, 'triangle', 0.004);   // E, then home to A
    [-13, -10, -7, -1].forEach((s, i) => RL.mando(t + i * 0.05, hz(s), 0.12));
    const t2 = t + 0.32; A2.osc(M2.out, t2, hz(-24), hz(-24), 1.6, 0.4, 'triangle', 0.004); A2.osc(M2.out, t2, hz(-36), hz(-36), 1.6, 0.3, 'sine', 0.004);
    [-12, -9, -5, 0, 3, 7, 12].forEach((s, i) => RL.mando(t2 + i * 0.045, hz(s), 0.13)); if (A2.bell) A2.bell(M2.out, t2 + 0.32, hz(24), 0.08);
    A2.nz(M2.out, t2, 0.4, 9000, 7000, 0.8, 0.14, 'highpass', 0.001);
    const out = M2.out; setTimeout(() => { try { out.disconnect(); M2.vb.disconnect(); } catch (e) { } if (RL.tune === M2) RL.tune = null; }, 4000);
  };
  RL.tuneStop = () => { const M2 = RL.tune; if (!M2) return; M2.on = false; try { M2.out.gain.setTargetAtTime(0.0001, G.audio.ctx.currentTime, 0.1); } catch (e) { } const out = M2.out; setTimeout(() => { try { out.disconnect(); M2.vb.disconnect(); } catch (e) { } }, 800); RL.tune = null; };

  /* ================= the big number when the ball lands ================= */
  const css = document.createElement('style');
  css.textContent = `#rlBanner{position:absolute;left:50%;top:24%;transform:translate(-50%,-50%) scale(.9);text-align:center;pointer-events:none;opacity:0;transition:opacity .35s,transform .35s;font-family:var(--head);text-shadow:0 3px 12px #000,0 0 30px rgba(0,0,0,.8)}#rlBanner.on{opacity:1;transform:translate(-50%,-50%) scale(1)}
#rlBanner .n{display:inline-block;min-width:120px;padding:6px 26px;border:3px solid #e2cf9a;border-radius:60px;font-size:72px;line-height:1.05;color:#f6ecd2;box-shadow:0 6px 30px rgba(0,0,0,.6)}#rlBanner .w{margin-top:8px;font-size:22px;letter-spacing:.12em;color:#f3d998;text-transform:uppercase}#rlBanner .y{margin-top:4px;font-size:20px;color:#9ef08a}#rlBanner .y.lose{color:#e8a090}`;
  document.head.appendChild(css);
  RL.banner = (n, line) => {
    let el = document.getElementById('rlBanner'); if (!el) { el = document.createElement('div'); el.id = 'rlBanner'; document.getElementById('hud').appendChild(el); }
    const col = colorOf(n); el.innerHTML = `<div class="n" style="background:${col === 'red' ? '#8a1020' : col === 'black' ? '#141012' : '#16703a'}">${n}</div><div class="w">${col}${n ? ` · ${n % 2 ? 'odd' : 'even'} · ${n <= 18 ? '1 to 18' : '19 to 36'}` : ' · zero'}</div>${line ? `<div class="y ${line.lose ? 'lose' : ''}">${line.text}</div>` : ''}`;
    el.classList.add('on'); clearTimeout(RL.bT); RL.bT = setTimeout(() => el.classList.remove('on'), 3200);
  };
  RL.landed = (L, n) => {
    const t = F.tableFor(L), seated = F.seated && F.seated.L === L; G.fx.spark(L.ball.position.clone().add(V(0, 0.02, 0)), n === 0 ? 0x40ff80 : REDS.has(n) ? 0xff4050 : 0xe8e0d0, 16, 1.2, 0.5, 0.02, 0);
    if (!seated && RL.near(L) < 0.5) return;
    let line = null; const p = t && t.st && t.st.pl && t.st.pl.find(x => x.id === me());
    if (p && p.bets.length) { const staked = p.bets.reduce((a, b) => a + b.amt, 0), back = p.bets.reduce((a, b) => a + RL.payout(b.k, b.amt, n), 0); line = back > staked ? { text: `You win ${back - staked} gold` } : back > 0 ? { text: back === staked ? 'You break even' : `${staked - back} lost · ${back} back${n === 0 ? ' (la partage)' : ''}`, lose: back < staked } : { text: `${staked} lost to the wheel`, lose: true }; if (back > staked) G.sfx('coin', 0.9); }
    RL.banner(n, line);
  };

  /* ================= first person at the table ================= */
  const slotOf = (t, id) => TB.slotOf(t, id);
  const bankPos = (L, slot) => { const S = L.seats[slot]; return S ? V(S.bank.x, TY, S.bank.z) : V(L.cx, TY, L.cz + 0.6); };
  const colFor = (slot) => SEATC[((slot % 5) + 5) % 5];
  const spotPos = (L, k, slot) => { const b = RL.bet(k), p = uvW(L, b.u, b.v); p.x += ((slot % 5) - 2) * 0.0065; p.z += ((slot % 3) - 1) * 0.0045; return p; };
  const quad = (col, op) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.renderOrder = 4; m.visible = false; m.userData.noShadow = true; G.scene.add(m); return m; };
  const rectOf = (n) => n === 0 ? [-1, 0, 0, 3] : [cOf(n), rOf(n), cOf(n) + 1, rOf(n) + 1];
  const placeQuad = (L, m, r, y) => { const [u0, v0, u1, v1] = r; m.scale.set((u1 - u0) * CELL * 0.94, (v1 - v0) * CELL * 0.94, 1); const p = uvW(L, (u0 + u1) / 2, (v0 + v1) / 2, y); m.position.copy(p); m.visible = true; };
  F.C.roulette = {
    slotOf: (L, t, id) => slotOf(t, id),
    sync(L, t, dt) {
      RL.tickWheel(L, t, dt);
      if (!L.hl) { L.hl = []; for (let i = 0; i < 20; i++) { const q = quad(0xffe08a, 0.26); L.hl.push(q); L.extra.push(q); } L.winQ = quad(0xffd060, 0.3); L.extra.push(L.winQ);
        L.ghost = new THREE.Mesh(new THREE.CylinderGeometry(CR, CR, CHH * 2, 20), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.55, depthWrite: false })); L.ghost.visible = false; G.scene.add(L.ghost); L.extra.push(L.ghost);
        L.dolly = A.skull(0.17, 0xffc040); L.dolly.visible = false; L.dolly.userData.dynamic = true; G.scene.add(L.dolly); L.extra.push(L.dolly); }
      const st = t && t.st, a = L.anim;
      // the board of past numbers
      const hk = st ? st.hist.join(',') : L.hist; if (hk !== L.hist) { L.hist = hk; RL.drawBoard(L, st ? st.hist : []); }
      // the dolly and a glow on the winning number, from the moment the ball lands until the next spin
      const showWin = a && a.done && a.hold > 0.25 && (!st || st.phase !== 'spin' || (st.spin && st.spin.n === a.n));
      L.dolly.visible = !!showWin && !!st; L.winQ.visible = false;
      if (L.dolly.visible) { const r = rectOf(a.res), p = uvW(L, (r[0] + r[2]) / 2, (r[1] + r[3]) / 2, TY + 0.018); L.dolly.position.copy(p); L.dolly.position.y += Math.sin(G.now() * 3) * 0.004; placeQuad(L, L.winQ, r, TY + 0.0015); L.winQ.material.opacity = 0.22 + Math.sin(G.now() * 5) * 0.12; }
      // highlights for the spot under the crosshair
      const hk2 = F.seated && F.seated.L === L && st && st.phase === 'bet' ? L.hoverK : null, hb = hk2 && RL.bet(hk2);
      L.hl.forEach(q => q.visible = false); L.ghost.visible = false;
      if (hb) { const rects = hb.nums.map(rectOf); if (hb.rect) rects.push(hb.rect); rects.slice(0, 20).forEach((r, i) => placeQuad(L, L.hl[i], r, TY + 0.001)); const gp = spotPos(L, hk2, slotOf(t, me())); L.ghost.position.set(gp.x, TY + CHH + 0.004 + Math.sin(G.now() * 6) * 0.002, gp.z); L.ghost.visible = true; }
      if (!t) { F.occupy(L, []); RL.chips(L, null, {}, dt); return; }
      // who's sitting where, and what they have riding
      F.occupy(L, t.seats.map(s => { const p = st.pl.find(q => q.id === s.id), slot = slotOf(t, s.id), r = st.res && st.res[s.id]; let sub = '';
        if (p) { const on = tot(p); sub = st.phase === 'settle' && r && r.staked && a && a.done ? (r.back > r.staked ? `wins ${r.back - r.staked}` : r.back ? `${r.back} back` : `lost ${r.staked}`) : on ? `${on} on the table${p.ready ? ' · ready' : ''}` : st.phase === 'bet' ? 'thinking…' : ''; }
        return { slot, id: s.id, name: s.name, npc: !!s.npc, sub, hot: p && p.ready }; }));
      // chips
      const want = {}, landed = !a || a.done, settling = st.phase === 'settle' && landed && st.spin, res = settling ? st.spin.res : null;
      if (settling) { if (L.setN !== st.spin.n) { L.setN = st.spin.n; L.setT = 0; } L.setT += dt; } const sT = L.setT || 0;
      st.pl.forEach(p => { const slot = slotOf(t, p.id); if (slot < 0 && !p.left) return; const col = colFor(Math.max(0, slot));
        if (slot >= 0) want['bank|' + p.id] = { n: 6, col, pos: bankPos(L, slot), id: p.id, slot, kind: 'bank' };
        p.bets.forEach(b => { const key = p.id + '|' + b.k, B = RL.bet(b.k); if (!B) return; const pos = spotPos(L, b.k, Math.max(0, slot)), n = chipCount(b.amt, t.buy);
          if (!settling) { want[key] = { n, col, pos, id: p.id, slot, k: b.k, kind: 'bet' }; return; }
          const win = B.nums.includes(res), half = !win && res === 0 && B.even;
          if ((win && sT < 2.6) || (half && sT < 1.0)) want[key] = { n, col, pos, id: p.id, slot, k: b.k, kind: 'bet', win, half };
          if (win && sT > 0.75 && sT < 2.6) want[key + '|pay'] = { n: chipCount(b.amt * B.pay, t.buy), col, pos: pos.clone().add(V(0.026, 0, -0.014)), id: p.id, slot, k: b.k, kind: 'pay' }; }); });
      RL.chips(L, t, want, dt, res);
    },
    input(L, t, dt) {
      const st = t.st, p = st.pl.find(q => q.id === me()), title = `Roulette · chips ${t.buy} to ${t.buy * 100}`; if (!p) return { title };
      if (L.rn !== st.rn) { L.rn = st.rn; RL.undo = []; }
      const Fm = TB.form.rlChip || (TB.form.rlChip = { i: 0 }), chip = CHIPS[Fm.i] * t.buy, mine = tot(p), last = st.hist.length ? st.hist[0] : null;
      F.picks = []; L.hoverK = null;
      const spinning = L.anim && !L.anim.done;
      if (st.phase === 'bet' && !spinning) {
        const adj = (G.pressed.KeyW ? 1 : 0) - (G.pressed.KeyS ? 1 : 0) - F.wheel; F.wheel = 0; G.pressed.KeyW = G.pressed.KeyS = false; if (adj) { Fm.i = G.clamp(Fm.i + Math.sign(adj), 0, CHIPS.length - 1); G.sfx('click', 0.25); }
        const hp = F.hover && F.hover.obj === L.hit && F.hover.pt ? wUV(L, F.hover.pt) : null, k = hp ? RL.keyAt(hp.u, hp.v) : null; L.hoverK = k;
        const send = (list) => { const sum = list.reduce((s, x) => s + x.amt, 0); if (!list.length) return; if (G.save.gold < sum) { G.ui.toast('Not enough gold'); return; } if (mine + sum > t.buy * 500) { G.ui.toast(`Table limit: ${t.buy * 500} a spin`); return; } G.save.gold -= sum; G.persist(); G.sfx('coin', 0.45); TB.act(t.tid, { t: 'bet', list }); list.forEach(x => RL.undo.push(x)); };
        F.picks.push({ obj: L.hit, onClick: () => { if (!L.hoverK) return; const cur = p.bets.find(b => b.k === L.hoverK); if ((cur ? cur.amt : 0) + chip > t.buy * 100) { G.ui.toast(`That spot is full (${t.buy * 100} max)`); return; } send([{ k: L.hoverK, amt: chip }]); } });
        if (G.mouse.rPressed && k) { G.mouse.rPressed = false; const cur = p.bets.find(b => b.k === k); if (cur) { TB.act(t.tid, { t: 'unbet', k }); G.sfx('click', 0.4); } }
        if (F.key('KeyZ')) { const u = RL.undo.pop(); if (u && p.bets.some(b => b.k === u.k)) { TB.act(t.tid, { t: 'unbet', k: u.k, amt: u.amt }); G.sfx('click', 0.4); } }
        if (F.key('KeyC') && p.bets.length) { TB.act(t.tid, { t: 'unbet', all: true }); RL.undo = []; G.sfx('click', 0.4); }
        if (F.key('KeyF') && p.last && p.last.length) send(p.last.map(b => ({ k: b.k, amt: b.amt })));
        if (F.key('KeyD') && p.bets.length) send(p.bets.map(b => ({ k: b.k, amt: b.amt })));
        if (F.key('Space')) { if (!p.bets.length) G.ui.toast('Put a chip down first'); else if (!p.ready) { TB.act(t.tid, { t: 'ready' }); G.sfx('click', 0.5); } }
        const B = k && RL.bet(k), cd = st.at ? Math.max(0, Math.ceil((st.at - now()) / 1000)) : 0, others = st.pl.filter(x => !x.npc && !x.left && x.id !== me());
        const status = `Chip <b>${chip}</b> · on the table <b>${mine}</b>${B ? ` · <b>${B.name}</b> pays ${B.pay} to 1` : ''}${cd ? ` · spins in ${cd}s` : ''}${p.ready && others.length ? ' · waiting for the others' : ''}`;
        return { title, status, keys: [['LMB', 'place a chip'], ['RMB', 'take chips back', !!(k && p.bets.some(b => b.k === k))], ['W/S', 'wheel: chip value'], ['Z', 'undo', RL.undo.length > 0], ['C', 'clear', p.bets.length > 0], ['F', 'same bets again', !!(p.last && p.last.length)], ['D', 'double', p.bets.length > 0], ['Space', p.ready ? 'ready ✓' : 'ready: spin', p.bets.length > 0 && !p.ready]] };
      }
      if (spinning) return { title, status: `No more bets! · <b>${mine}</b> riding on the ball`, keys: [] };
      const r = st.res && st.res[me()];
      return { title, status: last === null ? 'The wheel waits' : `<b>${last} ${colorOf(last)}</b>${r && r.staked ? ` · ${r.back > r.staked ? `you win <b>${r.back - r.staked}</b>` : r.back ? `${r.back} back` : `you lose ${r.staked}`}` : ''} · new bets in a moment`, keys: [] };
    },
    clear(L) { RL.chips(L, null, {}, 0, null, true); RL.tuneStop(); RL.whir(L, 0); }
  };
  // chips fly to their spots from the owner's place at the table; losers fly into the wheel, winnings fly home
  RL.chips = (L, t, want, dt, res, wipe) => {
    L.ch = L.ch || {};
    Object.keys(want).forEach(key => { const w = want[key]; let o = L.ch[key];
      if (o && o.gone) { G.scene.remove(o.m); delete L.ch[key]; o = null; }
      if (!o) { const m = RL.stack(w.n, w.col), from = w.kind === 'bank' ? w.pos.clone() : w.kind === 'pay' ? V(L.wx, WY + 0.12, L.wz) : bankPos(L, w.slot).add(V(0, 0.02, 0)); m.position.copy(from); G.scene.add(m); o = L.ch[key] = { m, n: w.n, from, to: w.pos.clone(), t: w.kind === 'bank' ? 1 : 0, w };
        if (w.kind === 'pay') { G.fx.spark(w.pos.clone().add(V(0, 0.03, 0)), 0xffd060, 10, 1.0, 0.45, 0.018, 0); G.sfx('coin', 0.35, w.pos); } }
      o.w = w; if (o.n !== w.n) { o.n = w.n; o.m.geometry = stackGeo(w.n); }
      if (o.to.distanceToSquared(w.pos) > 1e-8) { o.from = o.m.position.clone(); o.to = w.pos.clone(); o.t = 0; } });
    Object.keys(L.ch).forEach(key => { const o = L.ch[key]; if (wipe) { G.scene.remove(o.m); delete L.ch[key]; return; }
      if (!want[key] && !o.gone) { o.gone = true; o.t = 0; o.from = o.m.position.clone();
        const w = o.w, lost = res !== null && res !== undefined && w.kind === 'bet' && !w.win && !w.half;
        o.lost = lost; o.to = lost ? V(L.wx, WY + 0.06, L.wz) : w.kind === 'bank' ? w.pos.clone() : bankPos(L, w.slot); } });
    Object.keys(L.ch).forEach(key => { const o = L.ch[key], m = o.m; if (o.t >= 1 && !o.gone) return;
      const was = o.t; o.t = Math.min(1, o.t + dt * (o.gone ? (o.lost ? 1.25 : 1.5) : 2.6)); const e = smooth(o.t), d = o.from.distanceTo(o.to);
      m.position.lerpVectors(o.from, o.to, e); m.position.y += Math.sin(e * Math.PI) * (0.04 + d * 0.3);
      if (o.lost) { m.rotation.y += dt * 9; m.scale.setScalar(1 - e * 0.85); } else if (o.gone && o.w.kind === 'bank') m.scale.setScalar(1 - e);
      if (!o.gone && was < 1 && o.t >= 1 && o.w.kind === 'bet') G.sfx('click', 0.18, m.position);
      if (o.gone && o.t >= 1) { if (o.lost) G.fx.spark(m.position.clone(), 0xb070ff, 6, 0.8, 0.35, 0.015, 0); G.scene.remove(m); delete L.ch[key]; } });
  };

  /* ================= the camera swoop to the wheel ================= */
  RL.cam = { k: 0, pos: V(0, 0, 0), look: V(0, 0, 0), init: false };
  const mx = new THREE.Matrix4(), qa = new THREE.Quaternion();
  RL.camTarget = (L) => {
    const a = L.anim, W0 = V(L.wx, WY, L.wz), S = L.seats[F.seated.slot], az = Math.atan2(S.x - L.wx, S.z - L.wz) * 0.35 + 0.35;
    if (!a.done && a.t < TD) { const al = az + a.t * 0.05, dir = V(Math.sin(al), 0, Math.cos(al)); return { pos: W0.clone().addScaledVector(dir, 0.46).add(V(0, 0.6, 0)), look: W0.clone().add(V(0, 0.01, -0.02)) }; }
    if (!a.done) { const al = az + TD * 0.05, dir = V(Math.sin(al), 0, Math.cos(al)); return { pos: W0.clone().addScaledVector(dir, 0.34).add(V(0, 0.42, 0)), look: W0.clone().lerp(L.ball.position, 0.55) }; }
    const b = L.ball.position, out = V(b.x - L.wx, 0, b.z - L.wz).normalize(), side = V(Math.sin(az), 0, Math.cos(az)), dir = out.clone().lerp(side, 0.35).normalize();
    return { pos: b.clone().addScaledVector(dir, 0.26).add(V(0, 0.3, 0)), look: b.clone() };
  };
  RL.camApply = (dt) => {
    const L = F.L.roulette, C = RL.cam; if (!L) { C.k = 0; return; }
    const a = L.anim, on = !!(F.seated && F.seated.L === L && a && (!a.done || a.hold < 2.8) && !G.ui.modalOpen());
    C.k = G.clamp(C.k + (on ? 1 : -1) * dt * (on ? 1.4 : 1.1), 0, 1); if (C.k <= 0) { C.init = false; RL.hudHide(false); return; }
    const cam = G.camera; if (on) { const tg = RL.camTarget(L); if (!C.init) { C.init = true; C.pos.copy(cam.position); C.look.copy(cam.position).add(V(0, 0, -1).applyQuaternion(cam.quaternion)); }
      const kk = 1 - Math.exp(-dt * 3.2); C.pos.lerp(tg.pos, kk); C.look.lerp(tg.look, 1 - Math.exp(-dt * 5)); }
    const e = smooth(C.k); mx.lookAt(C.pos, C.look, V(0, 1, 0)); qa.setFromRotationMatrix(mx); cam.position.lerp(C.pos, e); cam.quaternion.slerp(qa, e);
    const ch = document.getElementById('cross'); if (ch && C.k > 0.5) ch.style.visibility = 'hidden';
    RL.hudHide(C.k > 0.15);
  };
  RL.hudHide = (on) => { if (RL._hh === on) return; RL._hh = on; ['fpHud', 'fpLog', 'fpHelp', 'fpHelpTab', 'fpCursor'].forEach(id => { const el = document.getElementById(id); if (el) el.style.visibility = on ? 'hidden' : ''; }); };
  const mk0 = G.makePlayer;
  G.makePlayer = function (cls) { const P = mk0(cls), cam0 = P.updateCam; P.updateCam = (dt, t) => { cam0(dt, t); try { RL.camApply(dt); } catch (e) { console.error('rl cam', e); } }; return P; };

  /* ================= rules panel, table view ================= */
  if (F.HELP) F.HELP.roulette = { c: [['LMB', 'place a chip where the crosshair points (edges and corners split it)'], ['RMB', 'take back your chips on that spot'], ['W/S, wheel', 'chip value: ×1, ×5, ×25, ×100 the table minimum'], ['Z', 'undo your last chip'], ['C', 'clear all your bets'], ['F', 'the same bets as last spin'], ['D', 'double your bets'], ['Space', 'ready: the wheel spins when everyone is ready (or 30 s after the first bet)'], ['V', 'table view (pointer instead of looking around)'], ['H', 'hide or show this panel'], ['hold X', 'get up and leave the table']],
    x: 'Aim at a number for a straight bet; at the line between two for a split; the corner where four meet for a corner; the outer edge of a column of three for a street, or where two columns meet on that edge for a six line. Zero\'s edges give 0/1, 0/2, 0/3, the trios and first four.' };
  if (F.TV) F.TV.roulette = [1.3, 0.28];
  // the panel opens to the lobby; sitting down happens by itself when the game starts
})();
// the table view over the roulette layout looks straight down the table, numbers the right way up, the wheel at the left edge
(() => { const F = G.fp, tv0 = F.tvPose; F.tvPose = () => { const S = F.seated; if (S && S.L.game === 'roulette') { const L = S.L; return { pos: new G.V3(L.cx - 0.2, L.ty + 0.82, L.cz + 0.36), at: new G.V3(L.cx - 0.2, L.ty, L.cz + 0.04), up: new G.V3(0, 0, -1) }; } return tv0(); }; })();
