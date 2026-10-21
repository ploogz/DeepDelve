/* ============================================================
   The branching descent: a map of 9 levels between the
   entrance and the final boss. The party votes on each path,
   and on whether to extract early with what they carry.
   ============================================================ */
'use strict';
G.NODE = {
  combat: { icon: '⚔', name: 'Dungeon Halls', desc: 'Monsters, traps, secrets and treasure.' },
  elite: { icon: '☠', name: 'Champion\'s Lair', desc: 'Elite foes with dark powers. A relic waits at the end.' },
  event: { icon: '?', name: 'Mystery', desc: 'Something strange. The Dungeon Master is smiling.' },
  puzzle: { icon: '✦', name: 'Puzzle Vault', desc: 'A sealed vault guarded by an old riddle. Solve it for rich treasure.' },
  shop: { icon: '⚖', name: 'Peddler', desc: 'Buy relics, magic items and scrolls with run gold.' },
  rest: { icon: '🔥', name: 'Campfire', desc: 'Rest, train or study before going on.' },
  treasure: { icon: '◆', name: 'Treasure Vault', desc: 'Chests and a relic for every hero. Watch for teeth.' },
  miniboss: { icon: '♜', name: 'Guardian', desc: 'The first great foe of this dungeon.' },
  boss: { icon: '♛', name: 'The Final Lord', desc: 'Defeat it to conquer the dungeon.' }
};
G.RunMap = {
  ROWS: 9, MINI: 4,
  gen(seed, dungeon) {
    const r = G.mulberry(seed * 13 + 7), rows = [];
    let shopUsed = [false, false];
    for (let row = 0; row < this.ROWS; row++) {
      const fixed = row === 0 ? 'combat' : row === this.MINI ? 'miniboss' : row === this.ROWS - 1 ? 'boss' : null;
      const n = fixed ? 1 : G.ri(2, 4, r), list = [];
      for (let col = 0; col < n; col++) {
        let type = fixed;
        if (!type) {
          const seg = row < this.MINI ? 0 : 1, pre = row === this.MINI - 1 || row === this.ROWS - 2;
          const w = { combat: 40, elite: row === 1 ? 0 : 13 + row, event: 17, puzzle: 9, shop: shopUsed[seg] ? 0 : 8, rest: pre ? 26 : 8, treasure: row === 1 ? 4 : 10 };
          let t = r() * Object.values(w).reduce((a, b) => a + b, 0); for (const k in w) { t -= w[k]; if (t <= 0) { type = k; break; } }
          type = type || 'combat'; if (type === 'shop') shopUsed[seg] = true;
        }
        list.push({ row, col, type, x: (col + 0.5) / n + (fixed ? 0 : (r() - 0.5) * 0.08), links: [] });
      }
      // at least one fight on every wide row
      if (!fixed && !list.some(q => q.type === 'combat' || q.type === 'elite')) list[G.ri(0, n - 1, r)].type = 'combat';
      rows.push(list);
    }
    for (let row = 0; row < this.ROWS - 1; row++) {
      const A = rows[row], B = rows[row + 1];
      A.forEach(a => { const s = B.slice().sort((p, q) => Math.abs(p.x - a.x) - Math.abs(q.x - a.x)); a.links.push(s[0].col); if (s[1] && Math.abs(s[1].x - a.x) < 0.42 && r() < 0.65) a.links.push(s[1].col); });
      B.forEach(b => { if (!A.some(a => a.links.includes(b.col))) { const a = A.slice().sort((p, q) => Math.abs(p.x - b.x) - Math.abs(q.x - b.x))[0]; a.links.push(b.col); } });
    }
    return { rows };
  },
  node(row, col) { const m = G.run.map; return m && m.rows[row] ? m.rows[row][col] : null; },
  options() { const cur = this.node(G.run.row, G.run.col); return cur ? cur.links.slice() : [0]; },
  /* ---------------- overlay ---------------- */
  open() {
    if (!G.run.active || this.isOpen()) return;
    G.mapOpen = true; this.myVote = null; this.t0 = G.now(); G.ui.releasePointer(); G.net.pushPresence(true);
    if (G.ui.modalOpen()) { document.getElementById('panelM').hidden = true; G.dialog.close(false); }
    document.getElementById('runMap').hidden = false; this.render(); G.sfx('portal', 0.6);
    G.dm.say(G.pick(G.DM_LINES.floorDone));
  },
  close() { this.scrolledFor = null; G.mapOpen = false; this.myVote = null; document.getElementById('runMap').hidden = true; G.net.pushPresence(true); },
  isOpen() { return !document.getElementById('runMap').hidden; },
  votes() { // [{peer, name, cls, v}]
    const out = [], key = G.run.row + ':';
    if (!G.net.party) { if (this.myVote != null) out.push({ peer: 'me', name: G.settings.name, cls: G.cls, v: this.myVote, me: true }); return out; }
    G.net.members().forEach(p => { const pr = p.presence; if (!G.net.inMyScene(p) && !p.sameTab) return; const mv = p.sameTab ? (this.myVote != null ? key + this.myVote : null) : pr.mv; if (typeof mv === 'string' && mv.startsWith(key)) out.push({ peer: p.peer, name: pr.n || 'Adventurer', cls: pr.c, v: mv.slice(key.length), me: p.sameTab }); });
    return out;
  },
  vote(v) {
    if (!this.isOpen()) return; G.sfx('click', 1);
    if (!G.net.party) { this.decide(String(v)); return; }
    this.myVote = String(v); G.net.pushPresence(true); this.render();
  },
  // host (or solo) applies the decision for everyone
  decide(v) {
    if (v === 'x') { const d = { k: 'x', r: G.run.id }; G.net.emit('floor', d); G.game.netFloor(d); return; }
    const d = { k: 'go', r: G.run.id, s: G.run.row + 1, c: v | 0 }; G.net.emit('floor', d); G.game.netFloor(d);
  },
  update(dt) {
    if (!this.isOpen()) return;
    this.rt = (this.rt || 0) - dt; if (this.rt <= 0) { this.rt = 0.4; this.render(); }
    if (!G.net.party || !G.net.isHost()) return;
    const voters = G.net.runMembers().length, vs = this.votes(), waited = G.now() - this.t0;
    if ((vs.length >= voters && vs.length) || waited > 35) {
      if (!vs.length) { this.decide(String(this.options()[0])); return; }
      const tally = {}; vs.forEach(o => tally[o.v] = (tally[o.v] || 0) + 1);
      const best = Math.max(...Object.values(tally)), tops = Object.keys(tally).filter(k => tally[k] === best);
      const mine = vs.find(o => o.me); const pick = mine && tops.includes(mine.v) ? mine.v : tops[0];
      this.decide(pick);
    }
  },
  render() {
    const el = document.getElementById('rmBody'); if (!el || !G.run.map) return;
    const rows = G.run.map.rows, opts = this.options(), vs = this.votes(), party = !!G.net.party;
    const H = 100 / (rows.length), y = row => 100 - (row + 0.5) * H;
    let svg = '<svg class="rmLines" viewBox="0 0 100 100" preserveAspectRatio="none">';
    rows.forEach((list, row) => list.forEach(n => n.links.forEach(c => { const m = rows[row + 1][c]; const walked = row === G.run.row - 1 ? false : (G.run.path || []).some(p => p[0] === row && p[1] === n.col) && (G.run.path || []).some(p => p[0] === row + 1 && p[1] === c); const live = row === G.run.row && n.col === G.run.col; svg += `<line x1="${n.x * 100}" y1="${y(row)}" x2="${m.x * 100}" y2="${y(row + 1)}" class="${walked ? 'walked' : live ? 'live' : ''}" vector-effect="non-scaling-stroke"/>`; })));
    svg += '</svg>';
    let nodes = '';
    rows.forEach((list, row) => list.forEach(n => {
      const N = G.NODE[n.type], here = row === G.run.row && n.col === G.run.col, done = (G.run.path || []).some(p => p[0] === row && p[1] === n.col) && !here;
      const avail = row === G.run.row + 1 && opts.includes(n.col), chips = vs.filter(o => o.v === String(n.col)).map(o => `<i style="background:${(G.CLASS_INFO[o.cls] || G.CLASS_INFO.knight).color}" title="${esc(o.name)}"></i>`).join('');
      const cls = ['rmNode', n.type, here ? 'here' : '', done ? 'done' : '', avail ? 'avail' : '', !avail && !here && !done ? 'dim' : '', avail && this.myVote === String(n.col) ? 'mine' : ''].join(' ');
      nodes += `<button class="${cls}" style="left:${n.x * 100}%;top:${y(row)}%" ${avail ? `data-v="${n.col}"` : 'tabindex="-1"'} aria-label="${N.name}"><span class="ic">${N.icon}</span>${chips ? `<span class="chips">${chips}</span>` : ''}<span class="tip"><b>${N.name}</b>${N.desc}${row ? `<em>Depth ${row}</em>` : ''}</span></button>`;
    }));
    el.innerHTML = `<div class="rmInner" style="height:${rows.length * 74}px">${svg}${nodes}</div>`;
    if (this.scrolledFor !== G.run.row) { this.scrolledFor = G.run.row; const yy = (1 - (G.run.row + 1.5) / rows.length) * rows.length * 74; el.scrollTop = Math.max(0, yy - el.clientHeight * 0.6); }
    el.querySelectorAll('[data-v]').forEach(b => b.onclick = () => this.vote(b.dataset.v));
    const xv = vs.filter(o => o.v === 'x').length, waited = Math.max(0, 35 - Math.floor(G.now() - this.t0));
    document.getElementById('rmSub').textContent = `Level ${G.run.row + 1} of ${rows.length} cleared · ${G.run.miniDone ? 'The Guardian has fallen' : 'The Guardian waits at depth ' + this.MINI}`;
    document.getElementById('rmVote').innerHTML = party ? `${vs.length}/${G.net.runMembers().length} heroes have voted${G.net.isHost() ? ` · deciding in ${waited}s` : ''}` : 'Choose where to go next';
    const xb = document.getElementById('rmExtract'); xb.innerHTML = `Extract now${xv ? ` <span class="tag">${xv} vote${xv > 1 ? 's' : ''}</span>` : ''}`; xb.classList.toggle('mine', this.myVote === 'x'); xb.onclick = () => this.vote('x');
  }
};
