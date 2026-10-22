/* ============================================================
   Bone chess: full chess in the Grand Arcade with undead pieces
   - every rule: castling, en passant, promotion, check, mate, stalemate, the fifty-move rule,
     threefold repetition and dead positions
   - two boards with 3D pieces (bone legion vs. the obsidian court) that move as the game is played
   - play a party member, or one of the regulars (an alpha-beta engine at three strengths); optional clocks
   ============================================================ */
'use strict';
(() => {
  const TB = G.tables, GM = TB.GAMES, R = Math.random, UI = G.ui;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const now = () => Date.now(), me = () => G.net.myId();
  const C = G.chess = { boards: [] };

  /* ================= rules ================= */
  const NO = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]], KO = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const isW = c => c >= 'A' && c <= 'Z', FILES = 'abcdefgh';
  C.start = () => ({ b: 'RNBQKBNRPPPPPPPP' + '.'.repeat(32) + 'pppppppprnbqkbnr', w: true, cs: 'KQkq', ep: -1, hm: 0, fm: 1 });
  C.sqName = sq => FILES[sq & 7] + ((sq >> 3) + 1);
  C.attacked = (b, sq, byW) => {
    const r = sq >> 3, f = sq & 7, pr = byW ? r - 1 : r + 1, pc = byW ? 'P' : 'p';
    if (pr >= 0 && pr < 8) for (const df of [-1, 1]) { const ff = f + df; if (ff >= 0 && ff < 8 && b[pr * 8 + ff] === pc) return true; }
    const n = byW ? 'N' : 'n', k = byW ? 'K' : 'k', rq = byW ? 'RQ' : 'rq', bq = byW ? 'BQ' : 'bq';
    for (const [dr, df] of NO) { const rr = r + dr, ff = f + df; if (rr >= 0 && rr < 8 && ff >= 0 && ff < 8 && b[rr * 8 + ff] === n) return true; }
    for (const [dr, df] of KO) { const rr = r + dr, ff = f + df; if (rr >= 0 && rr < 8 && ff >= 0 && ff < 8 && b[rr * 8 + ff] === k) return true; }
    for (const [dr, df] of KO) { const set = dr && df ? bq : rq; let rr = r + dr, ff = f + df; while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) { const c = b[rr * 8 + ff]; if (c !== '.') { if (set.includes(c)) return true; break; } rr += dr; ff += df; } }
    return false;
  };
  C.pseudo = (S) => {
    const b = S.b, w = S.w, out = [], own = x => x !== '.' && isW(x) === w, foe = x => x !== '.' && isW(x) !== w;
    for (let sq = 0; sq < 64; sq++) {
      const c = b[sq]; if (c === '.' || isW(c) !== w) continue; const p = c.toLowerCase(), r = sq >> 3, f = sq & 7;
      if (p === 'p') {
        const d = w ? 1 : -1, last = w ? 7 : 0, add = (t, k) => { if ((t >> 3) === last) 'qrbn'.split('').forEach(pp => out.push({ f: sq, t, p: pp, k })); else out.push({ f: sq, t, k }); };
        const one = sq + 8 * d; if (b[one] === '.') { add(one); if (r === (w ? 1 : 6) && b[one + 8 * d] === '.') out.push({ f: sq, t: one + 8 * d, k: 'dbl' }); }
        for (const df of [-1, 1]) { const ff = f + df; if (ff < 0 || ff > 7) continue; const t = (r + d) * 8 + ff; if (foe(b[t])) add(t); else if (t === S.ep) out.push({ f: sq, t, k: 'ep' }); }
        continue;
      }
      if (p === 'n' || p === 'k') { for (const [dr, df] of p === 'n' ? NO : KO) { const rr = r + dr, ff = f + df; if (rr < 0 || rr > 7 || ff < 0 || ff > 7) continue; const t = rr * 8 + ff; if (!own(b[t])) out.push({ f: sq, t }); }
        if (p === 'k') { const base = w ? 0 : 56, K = w ? 'K' : 'k', Q = w ? 'Q' : 'q', Rk = w ? 'R' : 'r';
          if (sq === base + 4 && !C.attacked(b, sq, !w)) {
            if (S.cs.includes(K) && b[base + 5] === '.' && b[base + 6] === '.' && b[base + 7] === Rk && !C.attacked(b, base + 5, !w) && !C.attacked(b, base + 6, !w)) out.push({ f: sq, t: base + 6, k: 'O' });
            if (S.cs.includes(Q) && b[base + 3] === '.' && b[base + 2] === '.' && b[base + 1] === '.' && b[base] === Rk && !C.attacked(b, base + 3, !w) && !C.attacked(b, base + 2, !w)) out.push({ f: sq, t: base + 2, k: 'O' }); } }
        continue; }
      const dirs = p === 'b' ? KO.filter(([a, c2]) => a && c2) : p === 'r' ? KO.filter(([a, c2]) => !a || !c2) : KO;
      for (const [dr, df] of dirs) { let rr = r + dr, ff = f + df; while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) { const t = rr * 8 + ff; if (own(b[t])) break; out.push({ f: sq, t }); if (b[t] !== '.') break; rr += dr; ff += df; } }
    }
    return out;
  };
  C.make = (S, m) => {
    const b = Array.isArray(S.b) ? S.b.slice() : S.b.split(''), c = b[m.f]; let cap = b[m.t];
    b[m.t] = m.p ? (S.w ? m.p.toUpperCase() : m.p) : c; b[m.f] = '.';
    if (m.k === 'ep') { const cs = m.t + (S.w ? -8 : 8); cap = b[cs]; b[cs] = '.'; }
    if (m.k === 'O') { if (m.t === m.f + 2) { b[m.f + 1] = b[m.f + 3]; b[m.f + 3] = '.'; } else { b[m.f - 1] = b[m.f - 4]; b[m.f - 4] = '.'; } }
    let cs = S.cs; const strip = sq => { if (sq === 0) cs = cs.replace('Q', ''); if (sq === 7) cs = cs.replace('K', ''); if (sq === 56) cs = cs.replace('q', ''); if (sq === 63) cs = cs.replace('k', ''); if (sq === 4) cs = cs.replace(/[KQ]/g, ''); if (sq === 60) cs = cs.replace(/[kq]/g, ''); };
    strip(m.f); strip(m.t);
    return { b, w: !S.w, cs, ep: m.k === 'dbl' ? (m.f + m.t) / 2 : -1, hm: (c === 'P' || c === 'p' || cap !== '.') ? 0 : S.hm + 1, fm: S.fm + (S.w ? 0 : 1), cap: cap !== '.' ? cap : null };
  };
  C.inCheck = (S, w = S.w) => { const b = S.b, k = (Array.isArray(b) ? b.indexOf(w ? 'K' : 'k') : b.indexOf(w ? 'K' : 'k')); return k >= 0 && C.attacked(b, k, !w); };
  C.legal = (S) => C.pseudo(S).filter(m => { const N = C.make(S, m); return !C.inCheck(N, S.w); });
  C.key = S => (Array.isArray(S.b) ? S.b.join('') : S.b) + (S.w ? 'w' : 'b') + S.cs + S.ep;
  C.dead = (S) => { const pcs = (Array.isArray(S.b) ? S.b.join('') : S.b).replace(/[.kK]/g, ''); if (!pcs) return true; if (pcs.length === 1 && /[nNbB]/.test(pcs)) return true;
    if (/^[bB]+$/.test(pcs)) { const b = Array.isArray(S.b) ? S.b : S.b.split(''), cols = new Set(); b.forEach((c, i) => { if (c === 'b' || c === 'B') cols.add(((i >> 3) + (i & 7)) % 2); }); return cols.size === 1; } return false; };
  C.san = (S, m, legal) => {
    const b = Array.isArray(S.b) ? S.b : S.b.split(''), c = b[m.f], p = c.toUpperCase(); let s = '';
    if (m.k === 'O') s = m.t > m.f ? 'O-O' : 'O-O-O';
    else { const cap = b[m.t] !== '.' || m.k === 'ep';
      if (p === 'P') s = (cap ? FILES[m.f & 7] + 'x' : '') + C.sqName(m.t) + (m.p ? '=' + m.p.toUpperCase() : '');
      else { const amb = legal.filter(o => o.t === m.t && o.f !== m.f && b[o.f] === c); let d = ''; if (amb.length) { if (!amb.some(o => (o.f & 7) === (m.f & 7))) d = FILES[m.f & 7]; else if (!amb.some(o => (o.f >> 3) === (m.f >> 3))) d = String((m.f >> 3) + 1); else d = C.sqName(m.f); } s = p + d + (cap ? 'x' : '') + C.sqName(m.t); } }
    const N = C.make(S, m); if (C.inCheck(N)) s += C.legal(N).length ? '+' : '#'; return s;
  };

  /* ================= the engine ================= */
  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const PST = {
    p: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, -20, -20, 10, 10, 5, 5, -5, -10, 0, 0, -10, -5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, 5, 10, 25, 25, 10, 5, 5, 10, 10, 20, 30, 30, 20, 10, 10, 50, 50, 50, 50, 50, 50, 50, 50, 0, 0, 0, 0, 0, 0, 0, 0],
    n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 5, 5, 0, -20, -40, -30, 5, 10, 15, 15, 10, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 10, 15, 15, 10, 0, -30, -40, -20, 0, 0, 0, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 5, 0, 0, 0, 0, 5, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 0, 0, 0, 0, 0, 0, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    r: [0, 0, 0, 5, 5, 0, 0, 0, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 5, 10, 10, 10, 10, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 5, 0, 0, 0, 0, -10, -10, 5, 5, 5, 5, 5, 0, -10, 0, 0, 5, 5, 5, 5, 0, -5, -5, 0, 5, 5, 5, 5, 0, -5, -10, 0, 5, 5, 5, 5, 0, -10, -10, 0, 0, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    k: [20, 30, 10, 0, 0, 10, 30, 20, 20, 20, 0, 0, 0, 0, 20, 20, -10, -20, -20, -20, -20, -20, -20, -10, -20, -30, -30, -40, -40, -30, -30, -20, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30],
    ke: [-50, -30, -30, -30, -30, -30, -30, -50, -30, -30, 0, 0, 0, 0, -30, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -20, -10, 0, 0, -10, -20, -30, -50, -40, -30, -20, -20, -30, -40, -50]
  };
  C.eval = (S) => {   // from the side to move's point of view
    const b = S.b; let s = 0, mat = 0;
    for (let i = 0; i < 64; i++) { const c = b[i]; if (c !== '.' && c !== 'k' && c !== 'K' && c !== 'p' && c !== 'P') mat += VAL[c.toLowerCase()]; }
    const end = mat <= 1300;
    for (let i = 0; i < 64; i++) { const c = b[i]; if (c === '.') continue; const w = isW(c), p = c.toLowerCase(), idx = w ? i : (7 - (i >> 3)) * 8 + (i & 7), v = VAL[p] + (p === 'k' && end ? PST.ke : PST[p])[idx]; s += w ? v : -v; }
    return S.w ? s : -s;
  };
  const MATE = 100000;
  C.search = (S0, budgetMs = 400, maxDepth = 4, noise = 0) => {
    const S = Object.assign({}, S0, { b: Array.isArray(S0.b) ? S0.b : S0.b.split('') }), t0 = performance.now(); let nodes = 0, stop = false;
    const order = (S, ms) => ms.map(m => { const v = S.b[m.t]; return { m, s: (v !== '.' ? 10 * VAL[v.toLowerCase()] - VAL[S.b[m.f].toLowerCase()] / 10 + 1000 : 0) + (m.p === 'q' ? 900 : 0) }; }).sort((a, b) => b.s - a.s).map(o => o.m);
    const quiesce = (S, a, bt, qd) => { const sp = C.eval(S); if (sp >= bt) return bt; if (sp > a) a = sp; if (qd > 6) return a;
      for (const m of order(S, C.pseudo(S).filter(m => S.b[m.t] !== '.' || m.p))) { const N = C.make(S, m); if (C.inCheck(N, S.w)) continue; const v = -quiesce(N, -bt, -a, qd + 1); if (v >= bt) return bt; if (v > a) a = v; } return a; };
    const nega = (S, d, a, bt, ply) => {
      if ((++nodes & 1023) === 0 && performance.now() - t0 > budgetMs) stop = true; if (stop) return 0;
      if (d <= 0) return quiesce(S, a, bt, 0);
      let any = false, best = -Infinity;
      for (const m of order(S, C.pseudo(S))) { const N = C.make(S, m); if (C.inCheck(N, S.w)) continue; any = true; const v = -nega(N, d - 1, -bt, -a, ply + 1); if (stop) return 0; if (v > best) best = v; if (v > a) a = v; if (a >= bt) break; }
      if (!any) return C.inCheck(S) ? -MATE + ply : 0;
      if (S.hm >= 100) return 0;
      return best;
    };
    let root = C.legal(S); if (!root.length) return null; let bestM = root[0], bestScores = null;
    for (let d = 1; d <= maxDepth; d++) {
      const sc = []; let a = -Infinity;
      for (const m of order(S, root)) { const v = -nega(C.make(S, m), d - 1, -Infinity, -a + 1, 1); if (stop) break; sc.push({ m, v }); if (v > a) a = v; }
      if (stop && d > 1) break; if (sc.length === root.length || !bestScores) { bestScores = sc; root = sc.slice().sort((x, y) => y.v - x.v).map(o => o.m); bestM = root[0]; }
      if (Math.abs(a) > MATE - 100) break;
    }
    if (noise && bestScores) { const top = bestScores.map(o => ({ m: o.m, v: o.v + (R() - 0.5) * noise })).sort((x, y) => y.v - x.v); return top[0].m; }
    return bestM;
  };
  C.LEVELS = { novice: { name: 'Novice', ms: 120, d: 2, noise: 220 }, adept: { name: 'Adept', ms: 450, d: 3, noise: 40 }, master: { name: 'Grandmaster', ms: 900, d: 6, noise: 0 } };

  /* ================= pieces: the bone legion vs. the obsidian court ================= */
  const NAMES = { p: 'Skeleton', n: 'Bone Steed', b: 'Necromancer', r: 'Crypt Tower', q: 'Banshee Queen', k: 'Lich King' };
  C.svg = (c) => {
    const w = isW(c), p = c.toLowerCase(), fill = w ? '#efe3c4' : '#2a1d34', line = w ? '#4a3a26' : '#b89ad8', eye = w ? '#3a0a0a' : '#70ff9a';
    const skull = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${line}" stroke-width="2"/><rect x="${cx - r * 0.6}" y="${cy + r * 0.55}" width="${r * 1.2}" height="${r * 0.55}" rx="2" fill="${fill}" stroke="${line}" stroke-width="2"/><circle cx="${cx - r * 0.38}" cy="${cy}" r="${r * 0.26}" fill="${eye}"/><circle cx="${cx + r * 0.38}" cy="${cy}" r="${r * 0.26}" fill="${eye}"/><path d="M${cx} ${cy + r * 0.25}l-${r * 0.12} ${r * 0.28}h${r * 0.24}z" fill="${line}"/>`;
    const base = `<path d="M22 92h56l-4-10H26z" fill="${fill}" stroke="${line}" stroke-width="2.5"/><path d="M30 82h40l-6-14H36z" fill="${fill}" stroke="${line}" stroke-width="2.5"/>`;
    let top = '';
    if (p === 'p') top = `<path d="M40 68l4-16h12l4 16z" fill="${fill}" stroke="${line}" stroke-width="2.5"/>${skull(50, 40, 13)}`;
    if (p === 'r') top = `<path d="M33 68V34h34v34z" fill="${fill}" stroke="${line}" stroke-width="2.5"/><path d="M30 34V18h8v7h8v-7h8v7h8v-7h8v16z" fill="${fill}" stroke="${line}" stroke-width="2.5"/>${skull(50, 48, 8)}`;
    if (p === 'n') top = `<path d="M36 68c-2-14 2-26 10-34l-2-12 10 8c12 2 20 10 22 22l-8 4-10-6c-2 8 2 12 4 18z" fill="${fill}" stroke="${line}" stroke-width="2.5"/><circle cx="58" cy="36" r="4" fill="${eye}"/><path d="M68 48l6 2M64 52l6 3" stroke="${line}" stroke-width="2"/><path d="M44 30l-6 6M42 40l-7 4M42 50l-7 3" stroke="${line}" stroke-width="2"/>`;
    if (p === 'b') top = `<path d="M36 68c0-20 4-38 14-52 10 14 14 32 14 52z" fill="${fill}" stroke="${line}" stroke-width="2.5"/><path d="M50 22l-6 14" stroke="${line}" stroke-width="2.5"/>${skull(50, 50, 8)}`;
    if (p === 'q') top = `<path d="M34 68c2-12 6-20 16-22 10 2 14 10 16 22z" fill="${fill}" stroke="${line}" stroke-width="2.5"/>${skull(50, 36, 12)}<path d="M34 24l6 8 4-12 6 10 6-10 4 12 6-8-2 12H36z" fill="${w ? '#d9b46a' : '#7a4aa0'}" stroke="${line}" stroke-width="2"/>`;
    if (p === 'k') top = `<path d="M33 68c2-12 6-20 17-22 11 2 15 10 17 22z" fill="${fill}" stroke="${line}" stroke-width="2.5"/>${skull(50, 38, 12)}<path d="M36 28h28l-2-10-6 5-6-8-6 8-6-5z" fill="${w ? '#d9b46a' : '#7a4aa0'}" stroke="${line}" stroke-width="2"/><path d="M50 4v13M45 9h10" stroke="${w ? '#d9b46a' : '#9a6ac0'}" stroke-width="3.5"/>`;
    return `<svg viewBox="0 0 100 100" class="cpc">${base}${top}</svg>`;
  };
  // 3D pieces
  const pm = (w) => w ? { body: G.mat('col', { c: 0xe8dcc0, r: 0.45 }), dark: G.mat('col', { c: 0x2a1a10 }), eye: G.mat('emissive', { c: 0xffa040, i: 3 }), trim: G.mat('gold') }
    : { body: G.mat('col', { c: 0x241a2c, r: 0.25, m: 0.35 }), dark: G.mat('col', { c: 0x060408 }), eye: G.mat('emissive', { c: 0x60ff90, i: 4 }), trim: G.mat('col', { c: 0x6a3a90, r: 0.3, m: 0.6 }) };
  const mskull = (g, m, y, s) => { M.P(g, M.sph(0.016 * s, 12, 9), m.body, [0, y, 0], 0, [1, 0.92, 1.08]); M.P(g, M.box(0.017 * s, 0.008 * s, 0.013 * s), m.body, [0, y - 0.012 * s, 0.005 * s]); M.mirror(k => { M.P(g, M.sph(0.0048 * s, 6, 5), m.dark, [k * 0.006 * s, y + 0.001 * s, 0.013 * s]); M.P(g, M.sph(0.0018 * s, 5, 4), m.eye, [k * 0.006 * s, y + 0.001 * s, 0.0155 * s]); }); };
  C.piece3d = (c) => {
    const g = new THREE.Group(), w = isW(c), p = c.toLowerCase(), m = pm(w);
    M.P(g, M.lathe([0, 0, 0.034, 0, 0.034, 0.008, 0.028, 0.013, 0.022, 0.016, 0.022, 0.02, 0, 0.02], 20), m.body);
    if (p === 'p') { M.P(g, M.lathe([0, 0.02, 0.016, 0.02, 0.01, 0.045, 0.014, 0.05, 0, 0.05], 14), m.body); mskull(g, m, 0.068, 1.15); }
    if (p === 'r') { M.P(g, M.cyl(0.022, 0.026, 0.07, 12), m.body, [0, 0.055, 0]); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; M.P(g, M.box(0.012, 0.014, 0.01), m.body, [Math.cos(a) * 0.02, 0.097, Math.sin(a) * 0.02], [0, -a, 0]); } M.P(g, M.cyl(0.024, 0.024, 0.006, 12), m.body, [0, 0.09, 0]); M.P(g, M.box(0.012, 0.018, 0.004), m.dark, [0, 0.06, 0.024]); M.P(g, M.sph(0.003, 5, 4), m.eye, [0, 0.062, 0.026]); }
    if (p === 'n') { M.P(g, M.cyl(0.016, 0.02, 0.04, 10), m.body, [0, 0.04, 0]); const h = M.G(g, [0, 0.075, 0.006], [-0.5, 0, 0]); M.P(h, M.box(0.026, 0.05, 0.03), m.body, [0, 0, 0]); M.P(h, M.box(0.022, 0.03, 0.04), m.body, [0, 0.012, 0.03]); M.mirror(k => { M.P(h, M.sph(0.006, 6, 5), m.dark, [k * 0.013, 0.02, 0.012]); M.P(h, M.sph(0.0025, 5, 4), m.eye, [k * 0.014, 0.02, 0.014]); M.P(h, M.cone(0.005, 0.02, 5), m.body, [k * 0.008, 0.032, -0.006], [-0.3, 0, 0]); }); for (let i = 0; i < 4; i++) M.P(h, M.cone(0.004, 0.016, 4), m.trim, [0, 0.02 - i * 0.012, -0.016], [-1.2, 0, 0]); }
    if (p === 'b') { M.P(g, M.lathe([0, 0.02, 0.02, 0.02, 0.022, 0.06, 0.018, 0.09, 0.008, 0.115, 0, 0.122], 16), m.body); M.P(g, M.sph(0.017, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), m.dark, [0, 0.074, 0.006], [Math.PI / 2 - 0.2, 0, 0], [1, 0.6, 1]); mskull(g, m, 0.08, 0.8); M.P(g, M.sph(0.005, 6, 5), m.trim, [0, 0.122, 0]); }
    if (p === 'q' || p === 'k') { const k = p === 'k'; M.P(g, M.lathe([0, 0.02, 0.022, 0.02, 0.017, 0.07, 0.022, 0.08, 0, 0.082], 16), m.body); mskull(g, m, 0.1, 1.25); const cr = k ? 0.019 : 0.017; for (let i = 0; i < (k ? 6 : 8); i++) { const a = i / (k ? 6 : 8) * Math.PI * 2; M.P(g, M.cone(0.004, k ? 0.016 : 0.013, 4), m.trim, [Math.cos(a) * cr, 0.123, Math.sin(a) * cr]); } M.P(g, M.tor(cr, 0.003, 5, 16), m.trim, [0, 0.116, 0], [Math.PI / 2, 0, 0]); if (k) { M.P(g, M.box(0.005, 0.026, 0.005), m.trim, [0, 0.142, 0]); M.P(g, M.box(0.016, 0.005, 0.005), m.trim, [0, 0.146, 0]); } else M.P(g, M.sph(0.006, 8, 6), m.eye, [0, 0.126, 0]); }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  };
  C.boardTex = () => { const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d'); x.fillStyle = '#1a0e0a'; x.fillRect(0, 0, 1024, 1024);
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) { x.fillStyle = (r + f) % 2 ? '#d9cdb0' : '#3a2a34'; x.fillRect(64 + f * 112, 64 + r * 112, 112, 112); if ((r + f) % 2) { x.strokeStyle = 'rgba(90,70,40,.25)'; for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(64 + f * 112 + R() * 112, 64 + r * 112 + R() * 112); x.lineTo(64 + f * 112 + R() * 112, 64 + r * 112 + R() * 112); x.stroke(); } } }
    x.strokeStyle = '#d9b46a'; x.lineWidth = 6; x.strokeRect(60, 60, 904, 904); x.fillStyle = '#d9b46a'; x.font = '600 36px Georgia'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let i = 0; i < 8; i++) { x.fillText(FILES[i], 120 + i * 112, 1000); x.fillText(String(8 - i), 30, 120 + i * 112); }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t; };
  const SQ = 0.085, BOFF = 4 * SQ;
  C.buildBoard = (W, x, z, bi) => {
    const grp = new THREE.Group(), bone = G.mat('bone');
    M.P(grp, M.box(1.0, 0.06, 1.0), G.mat('col', { c: 0x2a1a10, t: 'wood' }), [0, 0.76, 0]);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(SQ * 8 * 1024 / 904, SQ * 8 * 1024 / 904), new THREE.MeshStandardMaterial({ map: C.boardTex(), roughness: 0.35 })); top.rotation.x = -Math.PI / 2; top.position.y = 0.792; grp.add(top);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { M.P(grp, M.cyl(0.035, 0.05, 0.74, 8), bone, [a * 0.4, 0.37, b * 0.4]); M.P(grp, M.sph(0.06, 10, 8), bone, [a * 0.4, 0.74, b * 0.4]); });
    const cand = T().models.skullCandle && T().models.skullCandle(); if (cand) { cand.position.set(0.44, 0.79, 0.44); grp.add(cand); }
    W.place(grp, x, 0, z, 0, 0.75);
    [-1, 1].forEach(s => { const st = T().models.stool(); W.place(st, x, 0, z + s * 0.95, 0, 0.3); });
    W.lights.push({ pos: new G.V3(x, 2.4, z), color: 0xffe0b0, intensity: 1.6, dist: 5, seed: 50 + bi, flicker: true });
    W.interact.push({ id: 'chess', label: `Bone Chess · board ${bi + 1}`, x, z, r: 1.8, desc: 'Two players, or take on a regular', board: bi });
    const B = { bi, x, z, meshes: [], pos: null, anim: null, table: null };
    C.boards[bi] = B; C.setPosition(B, C.start().b, null);
    return B;
  };
  const T = () => G.tavern;
  C.sqPos = (B, sq) => new G.V3(B.x + ((sq & 7) - 3.5) * SQ, 0.792, B.z - ((sq >> 3) - 3.5) * SQ);   // white plays from +z
  C.setPosition = (B, b, last) => {
    if (typeof b !== 'string') b = b.join('');
    if (B.pos === b) return; const prev = B.pos; B.pos = b;
    B.meshes.forEach(m => G.scene.remove(m)); B.meshes = [];
    for (let sq = 0; sq < 64; sq++) { const c = b[sq]; if (c === '.') continue; const m = C.piece3d(c); m.position.copy(C.sqPos(B, sq)); m.rotation.y = isW(c) ? Math.PI : 0; m.userData.dynamic = true; m.userData.sq = sq; G.scene.add(m); B.meshes.push(m); if (last && sq === last.t && prev) { m.userData.from = C.sqPos(B, last.f); m.userData.to = m.position.clone(); m.userData.k = 0; m.position.copy(m.userData.from); } }
  };
  C.update = (dt) => { C.boards.forEach(B => B.meshes.forEach(m => { if (m.userData.from) { m.userData.k = Math.min(1, m.userData.k + dt * 2.4); const k = m.userData.k, e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; m.position.lerpVectors(m.userData.from, m.userData.to, e); m.position.y += Math.sin(k * Math.PI) * 0.06; if (k >= 1) { m.userData.from = null; G.sfx('bonehit', 0.25, m.position); } } })); };

  /* ================= the game at the table ================= */
  const curS = st => ({ b: st.b, w: st.w, cs: st.cs, ep: st.ep, hm: st.hm, fm: st.fm });
  GM.chess = {
    name: 'Bone Chess', icon: '♟', min: 2, max: 2, npc: true, minBuy: 0, maxBuy: 1000, defBuy: 25, step: 5, buyLabel: 'Stake per player', defOpts: { clock: 10, ai: 'adept' }, opts: { clock: true, ai: true },
    rules: 'The bone legion (white) against the obsidian court (black). Every rule of chess applies: castling, en passant, promotion, check and mate. Stalemate, fifty quiet moves, threefold repetition or a dead position is a draw and splits the pot. Click a piece, then where it goes.',
    canOpen() { const used = Object.values(TB.list).filter(t => t.game === 'chess' && !t.closed).map(t => t.opts.board); if (used.length >= C.boards.length) { UI.toast('Both boards are in use. Join a game instead.'); return false; } return true; },
    formOpts() { const used = Object.values(TB.list).filter(t => t.game === 'chess' && !t.closed).map(t => t.opts.board), Pl = G.player, free = C.boards.filter(B => B && !used.includes(B.bi)); if (Pl && free.length) free.sort((a, b) => Math.hypot(Pl.pos.x - a.x, Pl.pos.z - a.z) - Math.hypot(Pl.pos.x - b.x, Pl.pos.z - b.z)); return { board: free.length ? free[0].bi : 0, clock: 10, ai: 'adept' }; },
    optLabel(t) { return `board ${(t.opts.board | 0) + 1} · ${+t.opts.clock ? t.opts.clock + ' min clocks' : 'no clock'}`; },
    hostOpts(t) { const ai = t.seats.some(s => s.npc); return `<select id="chClock">${[0, 3, 5, 10, 30].map(v => `<option value="${v}" ${+t.opts.clock === v ? 'selected' : ''}>${v ? v + ' min each' : 'No clock'}</option>`).join('')}</select>${ai ? `<select id="chAi">${Object.entries(C.LEVELS).map(([k, L]) => `<option value="${k}" ${t.opts.ai === k ? 'selected' : ''}>${L.name}</option>`).join('')}</select>` : ''}`; },
    bindHost(body, t) { const c = body.querySelector('#chClock'), a = body.querySelector('#chAi'); if (c) c.onchange = () => TB.act(t.tid, { t: 'opt', k: 'clock', v: +c.value }); if (a) a.onchange = () => TB.act(t.tid, { t: 'opt', k: 'ai', v: a.value }); },
    teamTag(t, i) { return `<span class="tm" style="background:${i ? '#2a1d34' : '#b8a888'};color:${i ? '#c8a8f0' : '#2a1a10'}">${i ? '♚' : '♔'}</span>`; },
    start(t) {
      const st = t.st, flip = R() < 0.5, seats = flip ? [t.seats[1], t.seats[0]] : [t.seats[0], t.seats[1]];
      Object.assign(st, C.start(), { pl: seats.map((s, i) => ({ id: s.id, name: s.name, npc: !!s.npc, white: i === 0, clock: (+t.opts.clock || 0) * 60000 })), phase: 'play', moves: [], hist: [], caps: [], last: null, pot: t.buy * 2, turnAt: now(), ply: 0 });
      st.hist.push(C.key(st)); TB.say(t, `${seats[0].name} leads the bone legion; ${seats[1].name} commands the obsidian court`);
    },
    side(st) { return st.pl[st.w ? 0 : 1]; },
    myTurn(t, id) { const st = t.st; return st && st.phase === 'play' && this.side(st).id === id; },
    finish(t, res, why) {   // res: 0 white wins, 1 black wins, -1 draw
      const st = t.st; st.phase = 'over'; st.result = res; st.why = why;
      if (res < 0) { TB.say(t, `Draw: ${why}`); st.pl.forEach(p => TB.pay(t, p.id, st.pot / 2, 'Bone Chess draw')); }
      else { const W = st.pl[res]; TB.say(t, `${W.name} wins: ${why}`); TB.pay(t, W.id, st.pot, 'Bone Chess'); }
    },
    play(t, m) {
      const st = t.st, S = curS(st), legal = C.legal(S), mv = legal.find(o => o.f === m.f && o.t === m.t && (o.p || '') === (o.p ? (m.p || 'q') : ''));
      if (!mv) return false;
      const p = this.side(st); if (+t.opts.clock) { p.clock -= now() - st.turnAt; if (p.clock <= 0) { p.clock = 0; this.flag(t); return; } }
      const san = C.san(S, mv, legal), N = C.make(S, mv);
      Object.assign(st, { b: N.b.join(''), w: N.w, cs: N.cs, ep: N.ep, hm: N.hm, fm: N.fm }); if (N.cap) st.caps.push(N.cap);
      st.moves.push(san); st.last = { f: mv.f, t: mv.t, san }; st.ply++; st.turnAt = now(); st.hist.push(C.key(st));
      const S2 = curS(st), next = C.legal(S2);
      if (!next.length) { if (C.inCheck(S2)) this.finish(t, st.w ? 1 : 0, 'checkmate'); else this.finish(t, -1, 'stalemate'); }
      else if (st.hm >= 100) this.finish(t, -1, 'fifty moves without a capture or a pawn move');
      else if (st.hist.filter(k => k === C.key(st)).length >= 3) this.finish(t, -1, 'threefold repetition');
      else if (C.dead(S2)) this.finish(t, -1, 'neither side can mate');
    },
    flag(t) { const st = t.st, loserWhite = st.w, other = st.pl[loserWhite ? 1 : 0], S = curS(st), b = S.b.split(''), oppMat = b.filter(c => c !== '.' && c.toLowerCase() !== 'k' && isW(c) === !loserWhite);
      if (!oppMat.length) this.finish(t, -1, 'time ran out, but there is no mating material'); else this.finish(t, loserWhite ? 1 : 0, `${this.side(st).name}'s time ran out`); },
    act(t, id, a) {
      const st = t.st; if (st.phase !== 'play') return false; const i = st.pl.findIndex(p => p.id === id); if (i < 0) return false;
      if (a.t === 'resign') { this.finish(t, i === 0 ? 1 : 0, `${st.pl[i].name} resigns`); return; }
      if (a.t === 'draw') { const other = st.pl[1 - i];
        if (st.drawOffer === i + 1) { st.drawOffer = null; TB.say(t, `${st.pl[i].name} withdraws the draw offer`); return; }
        if (st.drawOffer === 2 - i) { this.finish(t, -1, 'agreed'); return; }
        st.drawOffer = i + 1; TB.say(t, `${st.pl[i].name} offers a draw`);
        if (other.npc) { const ev = C.eval(Object.assign(curS(st), { b: st.b.split(''), w: i !== 0 })); if (ev < -150) { this.finish(t, -1, `${other.name} accepts the draw`); return; } TB.say(t, `${other.name} declines`); st.drawOffer = null; } return; }
      if (a.t === 'move' && this.side(st).id === id) { if (st.drawOffer && st.drawOffer !== i + 1) st.drawOffer = null; return this.play(t, { f: a.f | 0, t: a.to | 0, p: a.p }); }
      return false;
    },
    next(t) {
      const st = t.st; if (st.phase !== 'play') return null; const p = this.side(st), clock = +t.opts.clock;
      if (p.npc) { const L = C.LEVELS[t.opts.ai] || C.LEVELS.adept; return { wait: 500 + R() * 900 + (clock ? 0 : 400), fn: t => { const m = C.search(curS(st), L.ms, L.d, L.noise); if (!m) return false; return this.play(t, { f: m.f, t: m.t, p: m.p }); } }; }
      if (clock) return { wait: Math.max(0, p.clock - (now() - st.turnAt)) + 50, fn: t => { if (this.side(st) !== p) return false; p.clock -= now() - st.turnAt; st.turnAt = now(); this.flag(t); } };
      return { wait: Math.max(0, st.turnAt + 300000 - now()), fn: t => { TB.say(t, `${p.name} has been thinking a long time; a ghost moves for them`); const m = C.search(curS(st), 80, 1, 300); return m ? this.play(t, { f: m.f, t: m.t, p: m.p }) : false; } };
    },
    leave(t, id) { const st = t.st, i = st.pl.findIndex(p => p.id === id); if (i < 0 || st.phase !== 'play') return 0; this.finish(t, i === 0 ? 1 : 0, `${st.pl[i].name} left the board`); return 0; },
    closeOut(t) { return t.st && t.st.phase === 'play' ? t.buy : 0; },
    view(t, id) {
      const st = t.st, i = st.pl.findIndex(p => p.id === id), flip = i === 1, S = curS(st), mine = this.myTurn(t, id), chk = C.inCheck(S), sel = C.sel && C.sel.tid === t.tid ? C.sel.sq : -1;
      const legal = mine && sel >= 0 ? C.legal(S).filter(m => m.f === sel) : [], targets = new Set(legal.map(m => m.t)), ksq = chk ? st.b.indexOf(st.w ? 'K' : 'k') : -1;
      const clk = (p, on) => { if (!+t.opts.clock) return ''; let ms = p.clock - (on && st.phase === 'play' ? now() - st.turnAt : 0); ms = Math.max(0, ms); const s = Math.ceil(ms / 1000); return `<span class="cclk ${on ? 'on' : ''} ${s < 30 ? 'low' : ''}" data-clk="${st.pl.indexOf(p)}">${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}</span>`; };
      const capsOf = white => st.caps.filter(c => isW(c) === white).map(c => `<i>${C.svg(c)}</i>`).join('');
      const row = (p, white) => `<div class="cpl ${this.side(st) === p && st.phase === 'play' ? 'on' : ''}"><span class="cside">${white ? '♔' : '♚'}</span><b>${esc(p.id === id ? 'You' : p.name)}</b><span class="ccap">${capsOf(!white)}</span>${clk(p, this.side(st) === p)}</div>`;
      let h = `<div class="tgame chessw"><div class="goldline">Pot: ${st.pot} gold · board ${(t.opts.board | 0) + 1}${st.phase === 'over' ? ` · ${st.result < 0 ? 'draw' : esc(st.pl[st.result].name) + ' wins'} (${esc(st.why)})` : chk ? ' · <b class="ccheck">Check!</b>' : ''}</div>`;
      h += `<div class="cwrap"><div class="ccol">${row(st.pl[flip ? 0 : 1], flip)}<div class="cboard">`;
      for (let rr = 0; rr < 8; rr++) for (let ff = 0; ff < 8; ff++) { const r = flip ? rr : 7 - rr, f = flip ? 7 - ff : ff, sq = r * 8 + f, c = st.b[sq];
        const cls = ['csq', (r + f) % 2 ? 'lt' : 'dk', sq === sel ? 'sel' : '', targets.has(sq) ? (c !== '.' || (st.ep === sq) ? 'cap' : 'tgt') : '', st.last && (st.last.f === sq || st.last.t === sq) ? 'last' : '', sq === ksq ? 'chk' : ''].join(' ');
        h += `<div class="${cls}" data-sq="${sq}">${c !== '.' ? C.svg(c) : ''}${ff === 0 ? `<em class="rk">${r + 1}</em>` : ''}${rr === 7 ? `<em class="fl">${FILES[f]}</em>` : ''}</div>`; }
      h += `</div>${row(st.pl[flip ? 1 : 0], !flip)}</div><div class="cside2"><div class="cmoves">${st.moves.reduce((a, m, k) => a + (k % 2 ? ` ${m}</span>` : `<span><small>${k / 2 + 1}.</small> ${m}`), '')}${st.moves.length % 2 ? '</span>' : ''}</div>`;
      if (st.phase === 'play' && i >= 0) h += `<div class="tact"><button class="btn small ghost" id="chDraw">${st.drawOffer && st.drawOffer !== i + 1 ? 'Accept draw' : st.drawOffer === i + 1 ? 'Withdraw offer' : 'Offer draw'}</button><button class="btn small ghost" id="chResign">Resign</button></div>`;
      h += `<p class="note">${st.phase === 'over' ? '' : mine ? 'Your move.' : `${esc(this.side(st).name)} is thinking…`}</p>`;
      if (C.promo && C.promo.tid === t.tid) h += `<div class="cpromo">Raise your skeleton to: ${'qrbn'.split('').map(p => `<button class="btn small" data-promo="${p}">${C.svg(i === 0 ? p.toUpperCase() : p)}<small>${NAMES[p]}</small></button>`).join('')}</div>`;
      return h + `<p class="note small">${Object.entries(NAMES).map(([k, n]) => `${C.svg(k.toUpperCase()).replace('class="cpc"', 'class="cpc mini"')} ${n}`).join(' · ')}</p></div></div></div>`;
    },
    bind(body, t, id) {
      const st = t.st, S = curS(st);
      body.querySelectorAll('.csq').forEach(el => el.onclick = () => {
        if (!this.myTurn(t, id)) return; const sq = +el.dataset.sq, c = st.b[sq], legal = C.legal(S);
        if (C.sel && C.sel.tid === t.tid && C.sel.sq >= 0) { const ms = legal.filter(m => m.f === C.sel.sq && m.t === sq);
          if (ms.length) { if (ms[0].p) { C.promo = { tid: t.tid, f: C.sel.sq, t: sq }; UI.renderPanel(); return; } TB.act(t.tid, { t: 'move', f: C.sel.sq, to: sq }); C.sel = null; G.sfx('click', 0.5); UI.renderPanel(); return; } }
        C.promo = null; C.sel = c !== '.' && isW(c) === st.w && legal.some(m => m.f === sq) ? { tid: t.tid, sq } : null; UI.renderPanel();
      });
      body.querySelectorAll('[data-promo]').forEach(b => b.onclick = () => { const P = C.promo; C.promo = null; C.sel = null; TB.act(t.tid, { t: 'move', f: P.f, to: P.t, p: b.dataset.promo }); UI.renderPanel(); });
      const r = body.querySelector('#chResign'); if (r) r.onclick = () => { if (r.dataset.sure) TB.act(t.tid, { t: 'resign' }); else { r.dataset.sure = 1; r.textContent = 'Really resign?'; } };
      const d = body.querySelector('#chDraw'); if (d) d.onclick = () => TB.act(t.tid, { t: 'draw' });
      const mv = body.querySelector('.cmoves'); if (mv) mv.scrollTop = mv.scrollHeight;
    },
    onState(t) {
      const B = C.boards[t.opts.board | 0]; if (!B) return; B.table = t.closed ? null : t;
      if (t.closed || !t.st || !t.st.b) { C.setPosition(B, C.start().b, null); return; }
      const lastKey = t.st.ply; if (B.ply !== lastKey) { const had = B.ply !== undefined && lastKey === B.ply + 1; B.ply = lastKey; C.setPosition(B, t.st.b, had ? t.st.last : null); if (had) G.sfx(t.st.caps.length > (B.caps || 0) ? 'bonecollapse' : 'click', 0.35, new G.V3(B.x, 1, B.z)); B.caps = t.st.caps.length; }
      if (t.st.phase === 'over' && B.over !== t.round + ':' + t.st.ply && t.st.pl.some(p => p.id === me())) { B.over = t.round + ':' + t.st.ply; const i = t.st.pl.findIndex(p => p.id === me()); UI.banner(t.st.result < 0 ? 'Draw' : t.st.result === i ? 'Checkmate' : 'Defeat', t.st.why); }
      if (C.sel && C.sel.tid === t.tid && !this.myTurn(t, me())) C.sel = null;
    },
    onClose(t) { const B = C.boards[t.opts.board | 0]; if (B) { B.table = null; B.ply = undefined; C.setPosition(B, C.start().b, null); } }
  };
  // the clocks tick in the open panel
  setInterval(() => { if (UI.panelKind !== 'chess' || document.getElementById('panelM').hidden) return; const t = TB.mineFor('chess'); if (!t || !t.st || t.st.phase !== 'play' || !+t.opts.clock) return;
    document.querySelectorAll('[data-clk]').forEach(el => { const p = t.st.pl[+el.dataset.clk], on = GM.chess.side(t.st) === p; let ms = Math.max(0, p.clock - (on ? now() - t.st.turnAt : 0)); const s = Math.ceil(ms / 1000); el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; el.classList.toggle('low', s < 30); }); }, 250);

  /* ================= hooks ================= */
  const ba0 = G.World.buildArcade;
  G.World.buildArcade = function (o) { ba0.call(this, o); if (!o.spots || !o.spots.chess) return; C.boards.forEach(B => B.meshes.forEach(m => G.scene.remove(m))); C.boards = []; o.spots.chess.forEach((s, i) => C.buildBoard(this, s.x, s.z, i)); const a = o.spots.chess[0], b = o.spots.chess[o.spots.chess.length - 1]; G.arcade.hangSign(this, 'BONE CHESS', (a.x + b.x) / 2, a.z, 0, 4.2, 3.0); };
  const clear = () => { C.boards.forEach(B => B.meshes.forEach(m => G.scene.remove(m))); C.boards = []; };
  const hideout0 = G.game.enterHideout.bind(G.game); G.game.enterHideout = async function () { clear(); return hideout0(); };
  const ns0 = G.game.netStart.bind(G.game); G.game.netStart = function (d) { const r0 = ns0(d); if (G.run.active) clear(); return r0; };
  const pk0 = G.game.updatePickups.bind(G.game);
  G.game.updatePickups = function (dt, t) { pk0(dt, t); if (G.World.theme === 'hideout') C.update(dt); };
  const css = document.createElement('style');
  css.textContent = `.chessw .cwrap{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start}.chessw .ccol{flex:0 0 auto}
.cboard{display:grid;grid-template-columns:repeat(8,46px);grid-template-rows:repeat(8,46px);border:3px solid #8a6a30;box-shadow:0 0 0 2px #1a0e0a,0 6px 24px rgba(0,0,0,.6);user-select:none}
.csq{position:relative;cursor:pointer;display:flex;align-items:center;justify-content:center}.csq.lt{background:#d9cdb0}.csq.dk{background:#4a3442}
.csq.last{box-shadow:inset 0 0 0 100px rgba(217,180,106,.32)}.csq.sel{box-shadow:inset 0 0 0 3px #ffe08a,inset 0 0 0 100px rgba(255,224,138,.25)}.csq.chk{box-shadow:inset 0 0 18px 6px rgba(255,40,40,.85)}
.csq.tgt::after{content:'';width:14px;height:14px;border-radius:50%;background:rgba(40,160,80,.55)}.csq.cap::after{content:'';position:absolute;inset:3px;border-radius:50%;border:4px solid rgba(200,60,40,.65)}
.csq .cpc{width:42px;height:42px;filter:drop-shadow(0 2px 2px rgba(0,0,0,.5));pointer-events:none}.csq em{position:absolute;font-size:9px;font-style:normal;opacity:.6;color:#1a0e0a}.csq.dk em{color:#d9cdb0}.csq em.rk{left:2px;top:1px}.csq em.fl{right:3px;bottom:0}
.cpl{display:flex;align-items:center;gap:8px;padding:5px 2px;min-height:32px}.cpl.on b{color:#ffe08a}.cside{font-size:18px}.ccap{display:flex;flex-wrap:wrap;flex:1}.ccap i .cpc{width:18px;height:18px}
.cclk{font-family:monospace;font-size:16px;padding:2px 8px;border:1px solid #6a5030;border-radius:3px;background:#120a08}.cclk.on{border-color:#ffe08a;color:#ffe08a}.cclk.low{color:#ff6050}
.cside2{flex:1;min-width:160px}.cmoves{max-height:250px;overflow:auto;font-family:monospace;font-size:13px;line-height:1.7;background:rgba(0,0,0,.25);padding:6px 8px;border:1px solid #4a3820}.cmoves span{display:inline-block;min-width:110px}.cmoves small{opacity:.55}
.cpromo{margin:8px 0;display:flex;gap:6px;align-items:center;flex-wrap:wrap}.cpromo .btn{display:flex;flex-direction:column;align-items:center;padding:4px}.cpromo .cpc{width:38px;height:38px}
.cpc.mini{width:16px;height:16px;vertical-align:middle}.ccheck{color:#ff7050}
@media (max-width:520px){.cboard{grid-template-columns:repeat(8,36px);grid-template-rows:repeat(8,36px)}.csq .cpc{width:32px;height:32px}}`;
  document.head.appendChild(css);
})();
