/* ============================================================
   Endless Delve: every dungeon in turn, then round again, deadlier each lap
   - each leg is a short map (6 levels: a Guardian at 3, the dungeon's lord at 5)
   - killing the lord opens the way down into the next dungeon instead of home
   - enemies grow 22% tougher every leg (on top of the dungeon's own danger), gold flows a little faster
   - no end: extract on any map vote to keep what you carry; the deepest floor reached is your record
   ============================================================ */
'use strict';
(() => {
  const Dv = G.delve = { ORDER: ['crypt', 'warrens', 'forge', 'abyss'], pending: false };
  const RM = G.RunMap;
  Object.defineProperty(RM, 'ROWS', { get: () => (G.run.delve || Dv.pending) ? 6 : 9, configurable: true });
  Object.defineProperty(RM, 'MINI', { get: () => (G.run.delve || Dv.pending) ? 3 : 4, configurable: true });
  Dv.mul = () => G.run.delve ? Math.pow(1.22, G.run.delve.leg) : 1;
  Dv.lapName = (leg) => `Lap ${Math.floor(leg / 4) + 1} · ${G.DUNGEONS[Dv.ORDER[leg % 4]].name}`;

  // tougher every leg
  const diff0 = G.enemies.diff.bind(G.enemies);
  G.enemies.diff = function () { const d = diff0(); if (!G.run.delve) return d; const m = Dv.mul(); return { hp: d.hp * m, dmg: d.dmg * Math.pow(m, 0.85) }; };

  // starting: the host picks 'delve'; everyone begins in the crypt on a short map
  const start0 = G.game.netStart.bind(G.game);
  G.game.netStart = function (d) {
    if (!d || d.dg !== 'delve') { Dv.pending = false; return start0(d); }
    Dv.pending = true;
    try { return start0(Object.assign({}, d, { dg: Dv.ORDER[0] })); } finally { Dv.pending = false; }
  };
  const node0 = G.game.loadNode.bind(G.game);
  G.game.loadNode = async function (row, col) {
    if (Dv.pending && G.run.active && !G.run.delve) G.run.delve = { leg: 0, floors: 0 };
    const D = G.run.delve; if (D) D.floors++;
    const r = await node0(row, col);
    if (D && G.run.active) {
      const sub = document.getElementById('floorSub'); if (sub) sub.textContent = `Endless Delve · depth ${D.floors}${G.save.delveBest ? ` (best ${G.save.delveBest})` : ''} · ${Dv.lapName(D.leg)}`;
      if (D.floors > (G.save.delveBest || 0) && D.floors > 1) { if (!D.toldBest && G.save.delveBest) { D.toldBest = true; setTimeout(() => G.ui.toast(`Deeper than ever before · depth ${D.floors}`), 2400); } }
    }
    return r;
  };
  // the lord's portal leads deeper, not home
  const open0 = G.game.openPortal.bind(G.game);
  G.game.openPortal = function () {
    const ep = G.World.exitPortal; if (!ep || !ep.final || !G.run.delve) return open0();
    Dv.nextLeg();
  };
  Dv.nextLeg = () => {
    const D = G.run.delve; D.leg++; const theme = Dv.ORDER[D.leg % 4];
    G.run.dungeon = theme; G.run.map = RM.gen(G.run.id + D.leg * 7919, theme); G.run.row = -1; G.run.col = 0; G.run.path = []; G.run.miniDone = false;
    const P = G.player; if (P) { P.mods.greed += 0.15; P.potions += 1; P.heal && P.heal(P.maxHp * 0.5, true); }
    G.sfx('portalwhoosh', 1);
    setTimeout(() => G.ui.banner(G.DUNGEONS[theme].name, `Endless Delve · lap ${Math.floor(D.leg / 4) + 1} · danger ×${Dv.mul().toFixed(2)}`), 600);
    G.game.loadNode(0, 0);
  };
  // the lord's death opens the way down, not home
  const kill0 = G.game.onEnemyKilled.bind(G.game);
  G.game.onEnemyKilled = function (e, mine, kind) {
    const r = kill0(e, mine, kind); const D = G.run.delve, dg = G.DUNGEONS[G.run.dungeon];
    if (D && e && e.boss && kind !== 'flee' && dg && e.type === dg.bosses[1]) { const nx = G.DUNGEONS[Dv.ORDER[(D.leg + 1) % 4]].name; G.ui.banner('The Way Down Opens', `Step through the golden portal to descend into ${nx}`); }
    return r;
  };
  // the record
  const end0 = G.game.netEnd.bind(G.game);
  G.game.netEnd = function (d) {
    const D = G.run.active && d && d.r === G.run.id ? G.run.delve : null;
    if (D) { Dv.last = { floors: D.floors, leg: D.leg, best: D.floors > (G.save.delveBest || 0) }; if (Dv.last.best) G.save.delveBest = D.floors; G.run.row = D.floors; }
    else Dv.last = null;
    return end0(d);
  };
  const res0 = G.ui.results.bind(G.ui);
  G.ui.results = function (win, st) {
    res0(win, st); const L = Dv.last; if (!L) return; Dv.last = null;
    document.getElementById('panelEye').textContent = 'Endless Delve';
    const box = document.querySelector('#panelBody .results'); if (box) { const p = document.createElement('p'); p.className = 'note'; p.style.textAlign = 'center'; p.innerHTML = `Reached depth <b>${L.floors}</b> · ${Dv.lapName(L.leg)}${L.best ? ' · <b style="color:#f3d998">a new record!</b>' : ` · record ${G.save.delveBest || L.floors}`}`; box.insertBefore(p, box.querySelector('.rgrid')); }
  };

  // the portal picker gets an Endless Delve card
  const render0 = G.ui.renderPanel.bind(G.ui);
  G.ui.renderPanel = function () {
    render0(); if (this.panelKind !== 'portal') return;
    const cards = document.querySelector('#panelBody .dgcards'); if (!cards) return;
    const party = G.net.party, host = G.net.isHost(), sel = this.dgSel === 'delve';
    const b = document.createElement('button'); b.className = 'dg delve' + (sel ? ' sel' : ''); b.style.setProperty('--dc', '#e8c870'); b.dataset.dg = 'delve'; if (party && !host) b.disabled = true;
    b.innerHTML = `<h3>Endless Delve</h3><p>Every dungeon in turn, then round again, each lap deadlier than the last. Lords open the way deeper instead of home. Extract on any map vote to keep what you carry.</p><small>Danger ◆◆ rising forever · Record: ${G.save.delveBest ? `depth ${G.save.delveBest}` : 'none yet'}</small>`;
    b.onclick = () => { this.dgSel = 'delve'; G.sfx('click'); this.renderPanel(); };
    cards.appendChild(b);
    if (sel) cards.querySelectorAll('.dg.sel:not(.delve)').forEach(x => x.classList.remove('sel'));
  };
})();
