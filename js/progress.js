/* ============================================================
   Progression
   - level cap 20 on a slower curve; proficiency, sneak attack and feats keep growing past 10
   - Masteries: a point at every even level and every level past 10, spent on ranks (up to 5) of stacking bonuses
   - stacking upgrades from the dice: Momentum (kills), Frenzy (hit streaks), Runic Ward (absorb charges)
   - Ancient Runes: rare drops that teach a permanent, account-wide ability
   - shared rewards: every hero in the party gets their own loot from chests and quests
   ============================================================ */
'use strict';
(() => {
  G.LV_CAP = 20;
  G.XP_LV = [0, 0, 120, 300, 540, 840, 1200, 1640, 2160, 2760, 3440, 4220, 5100, 6080, 7160, 8360, 9680, 11120, 12680, 14360, 16160];
  G.FEAT_LV = [3, 5, 7, 9, 12, 15, 18];
  G.MASTERY_LV = [2, 4, 6, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  G.MASTERIES = {
    might: { icon: '⚔', name: 'Might', per: '+5% damage', ap: m => { m.dmg += 0.05; } },
    vigor: { icon: '♥', name: 'Vigor', per: '+6 maximum health', ap: m => { m.hp += 6; } },
    haste: { icon: '»', name: 'Haste', per: '+5% attack speed', ap: m => { m.atkSpd += 0.05; } },
    fleet: { icon: '➶', name: 'Fleetfoot', per: '+4% movement speed and +10 stamina', ap: m => { m.speed += 0.04; m.sta += 10; } },
    precision: { icon: '✦', name: 'Precision', per: '+3% critical chance', ap: m => { m.crit += 0.03; } },
    bulwark: { icon: '⛨', name: 'Bulwark', per: 'Take 3% less damage', ap: m => { m.armor += 0.03; } },
    focus: { icon: '⌛', name: 'Focus', per: 'Abilities recharge 5% faster', ap: m => { m.cdr += 0.05; } },
    arcana: { icon: '✧', name: 'Arcana', per: '+15 mana and +15% mana regeneration', cls: ['wizard', 'priest'], ap: m => { m.mana += 15; m.manaRegen += 0.15; } },
    fortune: { icon: '◎', name: 'Fortune', per: '+10% gold and better loot', ap: m => { m.greed += 0.1; } }
  };
  G.MASTERY_MAX = 5;

  /* ---------------- the sheet ---------------- */
  const S = G.sheet, init0 = S.init.bind(S), level0 = S.levelUp.bind(S);
  S.init = function (P) { init0(P); P.mastery = {}; P.masteryPending = 0; P.stk = { mom: 0, fr: 0, frT: 0, frApplied: 0, ward: 0, wardT: 0 }; };
  S.prof = P => P.level >= 17 ? 6 : P.level >= 13 ? 5 : P.level >= 9 ? 4 : P.level >= 5 ? 3 : 2;
  S.sneakDice = P => P.level >= 17 ? 6 : P.level >= 13 ? 5 : P.level >= 9 ? 4 : P.level >= 5 ? 3 : 2;
  S.gainXp = function (P, amt, why) {
    if (!P || P.level >= G.LV_CAP) return;
    amt = Math.round(amt * (P.relics.includes('quill') ? 1.3 : 1) * (G.hasPerma('scholar') ? 1.15 : 1));
    P.xp += amt;
    while (P.level < G.LV_CAP && P.xp >= G.XP_LV[P.level + 1]) this.levelUp(P);
  };
  S.levelUp = function (P) {
    level0(P);
    // once every feat this class can take is learned, a feat level gives ability points instead
    if (G.FEAT_LV.includes(P.level) && !Object.entries(G.FEATS).some(([id, f]) => !P.feats.includes(id) && (!f.cls || f.cls.includes(P.cls)))) { P.featPending = Math.max(0, P.featPending - 1); P.abPts += 2; }
    if (G.MASTERY_LV.includes(P.level)) { P.masteryPending = (P.masteryPending || 0) + 1; setTimeout(() => G.ui.toast(`Mastery point earned · press C to spend it`), 1600); G.ui.refreshSheetBadge(); }
  };
  S.learnMastery = function (P, id) {
    const Ms = G.MASTERIES[id]; if (!Ms || !(P.masteryPending > 0) || (P.mastery[id] || 0) >= G.MASTERY_MAX) return false;
    P.masteryPending--; this.applyChange(P, () => { P.mastery[id] = (P.mastery[id] || 0) + 1; Ms.ap(P.mods, P); }); return true;
  };
  // saving throws: Iron Will
  const bonus0 = S.bonus.bind(S); S.bonus = function (P, o) { return bonus0(P, o) + (o.save && G.hasPerma('ironwill') ? 1 : 0); };

  /* ---------------- interface ---------------- */
  const css = document.createElement('style');
  css.textContent = `#stackHud{position:absolute;left:50%;bottom:118px;transform:translateX(-50%);display:flex;gap:8px;pointer-events:none;font-family:var(--head);font-size:14px;z-index:5}
#stackHud span{background:rgba(20,14,30,.82);border:1px solid #7a5ab0;color:#e0d0ff;padding:2px 9px;border-radius:3px;min-width:44px;text-align:center}
.mastgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin-bottom:10px}
.mast{display:flex;gap:8px;align-items:center;background:rgba(30,22,10,.6);border:1px solid #5a4620;padding:6px 8px;border-radius:3px}
.mast .mi{font-size:20px;width:26px;text-align:center;color:#f3d998}.mast b{display:block}.mast small{opacity:.75;display:block}
.mast .pips{letter-spacing:2px;color:#f3d998;font-size:11px}.mast button{margin-left:auto}
.runes .tagx b{color:#c8a8ff}`;
  document.head.appendChild(css);
  const hud = document.createElement('div'); hud.id = 'stackHud'; hud.hidden = true; (document.getElementById('hud') || document.body).appendChild(hud);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const UI = G.ui, sheet0 = UI.sheetPanel.bind(UI), badge0 = UI.refreshSheetBadge.bind(UI), render0 = UI.renderPanel.bind(UI);
  G.ui.masteryHtml = function (P) {
    const pool = Object.entries(G.MASTERIES).filter(([, m]) => !m.cls || m.cls.includes(P.cls)), any = pool.some(([id]) => P.mastery[id]);
    if (!(P.masteryPending > 0) && !any) return `<h3 class="sh">Masteries</h3><p class="dim">A mastery point comes at every even level up to 10, then at every level to ${G.LV_CAP}. Each one stacks a lasting bonus for the rest of the run.</p>`;
    let h = `<h3 class="sh">Masteries${P.masteryPending > 0 ? ` · <span style="color:#f3d998">${P.masteryPending} point${P.masteryPending > 1 ? 's' : ''} to spend</span>` : ''}</h3><div class="mastgrid">`;
    h += pool.map(([id, m]) => { const r = P.mastery[id] || 0, can = P.masteryPending > 0 && r < G.MASTERY_MAX;
      return `<div class="mast"><span class="mi">${m.icon}</span><div><b>${esc(m.name)}</b><small>${esc(m.per)} per rank</small><span class="pips">${'◆'.repeat(r)}${'◇'.repeat(G.MASTERY_MAX - r)}</span></div>${can ? `<button class="btn small" data-mast="${id}">+1</button>` : ''}</div>`; }).join('');
    return h + '</div>';
  };
  G.ui.runeHtml = () => { const L = G.save.perma; if (!L.length) return ''; return `<h3 class="sh">Ancient Runes · permanent</h3><div class="taglist runes">${L.map(id => `<span class="tagx"><b>${G.PERMA[id].icon} ${esc(G.PERMA[id].name)}</b> ${esc(G.PERMA[id].desc)}</span>`).join('')}</div>`; };
  UI.sheetPanel = function (set) { const P = G.player, h = sheet0(set); if (!P || !P.dnd) return h; return G.ui.masteryHtml(P) + h + G.ui.runeHtml(); };
  UI.refreshSheetBadge = function () {
    badge0(); const P = G.player, el = document.getElementById('ptsBadge'); if (!P || !P.dnd || !el || !(P.masteryPending > 0) || !G.run.active) return;
    const pre = el.hidden ? '' : el.innerHTML.replace(/ <span class="kbd">C<\/span>$/, '') + ' · '; el.hidden = false;
    el.innerHTML = `${pre}${P.masteryPending} mastery point${P.masteryPending > 1 ? 's' : ''} <span class="kbd">C</span>`;
  };
  UI.renderPanel = function () {
    const r = render0(); const body = document.getElementById('panelBody') || document.querySelector('#panelM .body') || document;
    body.querySelectorAll('[data-mast]').forEach(b => b.onclick = () => { if (G.sheet.learnMastery(G.player, b.dataset.mast)) { G.sfx('level', 0.8); this.renderPanel(); this.refreshSheetBadge(); } });
    return r;
  };

  /* ---------------- stacking upgrades ---------------- */
  const bm = G.baseMods; G.baseMods = () => Object.assign(bm(), { momentum: 0, frenzy: 0, ward: 0 });
  G.UPGRADES.push(
    { id: 'momentum', t: 1, cat: 'off', icon: '☄', name: 'Momentum', desc: 'Every kill this floor adds +3% damage, up to 10 stacks. Each pick raises the cap by 10', ap: m => { m.momentum += 10; } },
    { id: 'frenzy', t: 1, cat: 'off', icon: '⚡', name: 'Frenzy', desc: 'Hits landed within 2 s of each other build Frenzy: +3% attack speed per stack, up to 8. Each pick adds 8 more', ap: m => { m.frenzy += 8; } },
    { id: 'ward', t: 2, cat: 'def', icon: '◈', name: 'Runic Ward', desc: 'Every 8 s gain a Ward charge that blocks the next hit outright. Holds 2 charges; each pick adds 2 more', ap: m => { m.ward += 2; } }
  );
  G.stacks = {
    onKill(P) { if (P.mods.momentum > 0 && P.stk.mom < P.mods.momentum) { P.stk.mom++; G.stacks.hud(); } },
    onHit(P) { if (!(P.mods.frenzy > 0)) return; const k = P.stk; k.fr = k.frT > 0 ? Math.min(P.mods.frenzy, k.fr + 1) : 1; k.frT = 2; this.applyFrenzy(P); },
    applyFrenzy(P) { const k = P.stk, want = k.fr * 0.03; P.mods.atkSpd += want - k.frApplied; k.frApplied = want; this.hud(); },
    floor(P) { if (P && P.stk) { P.stk.mom = 0; this.hud(); } },
    update(P, dt) {
      const k = P.stk; if (!k) return;
      if (k.frT > 0) { k.frT -= dt; if (k.frT <= 0 && k.fr) { k.fr = 0; this.applyFrenzy(P); } }
      if (P.mods.ward > 0 && k.ward < P.mods.ward && G.run.active) { k.wardT += dt; if (k.wardT >= 8) { k.wardT = 0; k.ward++; G.sfx('magic', 0.35); this.hud(); } }
    },
    absorb(P) { const k = P.stk; if (!k || !(k.ward > 0)) return false; k.ward--; G.fx.burst(new G.V3(P.pos.x, P.pos.y + 1.1, P.pos.z), 0x9ad0ff, 24, 3); G.sfx('shatter', 0.6); G.fx.textPop(new G.V3(P.pos.x, P.pos.y + 1.9, P.pos.z), 'WARDED', '#9ad0ff'); this.hud(); return true; },
    hud() {
      const P = G.player, el = document.getElementById('stackHud'); if (!el || !P || !P.stk) return; const k = P.stk, out = [];
      if (P.mods.momentum > 0) out.push(`<span title="Momentum: +3% damage per stack">☄ ${k.mom}</span>`);
      if (P.mods.frenzy > 0) out.push(`<span title="Frenzy: +3% attack speed per stack">⚡ ${k.fr}</span>`);
      if (P.mods.ward > 0) out.push(`<span title="Runic Ward charges">◈ ${k.ward}</span>`);
      el.innerHTML = out.join(''); el.hidden = !out.length;
    }
  };

  /* ---------------- Ancient Runes: permanent abilities ---------------- */
  G.PERMA = {
    battlehymn: { icon: '⚔', name: 'Battle Hymn', desc: 'Deal 8% more damage', ap: m => { m.dmg += 0.08; } },
    stoneskin: { icon: '⛨', name: 'Stoneskin', desc: 'Take 5% less damage', ap: m => { m.armor += 0.05; } },
    giantblood: { icon: '♥', name: "Giant's Blood", desc: '+10 maximum health', ap: m => { m.hp += 10; } },
    swiftsoul: { icon: '➶', name: 'Swift Soul', desc: '+6% movement speed', ap: m => { m.speed += 0.06; } },
    keeneye: { icon: '✦', name: 'Keen Eye', desc: '+4% critical chance', ap: m => { m.crit += 0.04; } },
    quickmind: { icon: '⌛', name: 'Quickened Soul', desc: 'Abilities recharge 8% faster', ap: m => { m.cdr += 0.08; } },
    deeppockets: { icon: '⚗', name: 'Deep Pockets', desc: 'Start every run with an extra healing flask', ap: (m, P) => { P.potions += 1; } },
    goldsense: { icon: '◎', name: 'Gold Sense', desc: '+15% gold and better loot', ap: m => { m.greed += 0.15; } },
    ironwill: { icon: '⛰', name: 'Iron Will', desc: '+1 to every saving throw' },
    scholar: { icon: '📜', name: "Scholar's Insight", desc: 'Earn 15% more experience' },
    undying: { icon: '☥', name: 'Undying', desc: 'Once per run, a blow that would drop you leaves you standing at 1 health' },
    secondwind: { icon: '❖', name: 'Second Wind', desc: '+25 stamina and faster stamina recovery', ap: m => { m.sta += 25; m.staRegen += 0.2; } }
  };
  G.save.perma = Array.isArray(G.save.perma) ? G.save.perma.filter(id => G.PERMA[id]) : [];
  G.hasPerma = id => G.save.perma.includes(id);
  G.unlockPerma = function () {
    const left = Object.keys(G.PERMA).filter(id => !G.hasPerma(id)); if (!left.length) return null;
    const id = G.pick(left), A = G.PERMA[id]; G.save.perma.push(id); G.persist();
    const P = G.player; if (P && A.ap) G.sheet.applyChange(P, () => A.ap(P.mods, P));
    G.ui.banner(`${A.icon} ${A.name}`, `Ancient Rune · a permanent ability for every hero: ${A.desc}`); G.sfx('level', 1); G.sfx('holy', 0.8);
    if (P) { G.fx.holy(new G.V3(P.pos.x, P.pos.y + 0.1, P.pos.z), 60, 1.6); G.fx.beam(new G.V3(P.pos.x, P.pos.y, P.pos.z), 0xc0a0ff, 10, 1.2, 1.2); }
    return id;
  };
  // every new hero starts with the runes already learned
  const mk0 = G.makePlayer;
  G.makePlayer = function (cls) {
    const P = mk0(cls);
    G.save.perma.forEach(id => { const A = G.PERMA[id]; if (A && A.ap) A.ap(P.mods, P); });
    P.hp = P.maxHp; P.sta = P.maxSta; P.mana = P.maxMana; P.undyingUsed = false;
    const td = P.takeDamage; P.takeDamage = (amt, src, o = {}) => { if (!o.dot && G.stacks.absorb(P)) return 0; return td(amt, src, o); };
    const cd = P.checkDeath; P.checkDeath = () => { if (P.hp <= 0 && G.hasPerma('undying') && !P.undyingUsed && !(G.pvp && G.pvp.meIn && G.pvp.meIn())) { P.undyingUsed = true; P.hp = 1; P.iframes = Math.max(P.iframes || 0, 1.2); G.fx.holy(new G.V3(P.pos.x, P.pos.y + 0.2, P.pos.z), 50, 1.2); G.sfx('holy', 1); G.ui.toast('Undying · the rune holds you up'); return; } return cd(); };
    const up = P.update; P.update = (dt, t) => { up(dt, t); G.stacks.update(P, dt); };
    setTimeout(() => G.stacks.hud(), 0);
    return P;
  };
  // the rune itself, lying on the floor
  M.loot.rune = () => { const g = new THREE.Group(), m = G.mat('col', { c: 0x2a2236, m: 0.5, r: 0.3 }); M.P(g, M.box(0.22, 0.05, 0.3), m); M.P(g, M.box(0.04, 0.012, 0.18), G.mat('emissive', { c: 0xc0a0ff, i: 3 }), [0, 0.03, 0]); M.P(g, M.box(0.12, 0.012, 0.04), G.mat('emissive', { c: 0xc0a0ff, i: 3 }), [0, 0.03, -0.03]); return g; };
  const spawn0 = G.game.spawnPickup.bind(G.game);
  G.game.spawnPickup = function (kind, at, amt, item) {
    if (kind !== 'rune') return spawn0(kind, at, amt, item);
    const p = spawn0('key', at, 0); p.kind = 'rune'; p.m.clear(); const r = M.loot.rune(); r.scale.setScalar(2.4); p.m.add(r);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.tex.sprite('glow'), color: 0xb080ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); s.scale.setScalar(1.8); p.m.add(s); return p;
  };
  const pk0 = G.game.updatePickups.bind(G.game);
  G.game.updatePickups = function (dt, t) {
    const P = G.player;
    if (P) for (let i = G.pickups.length - 1; i >= 0; i--) { const p = G.pickups[i]; if (p.kind !== 'rune') continue;
      p.t += dt; if (!p.rest) { p.v.y -= 14 * dt; p.m.position.addScaledVector(p.v, dt); const g = G.World.fy(p.m.position.x, p.m.position.z); if (G.World.W && G.World.isWall(p.m.position.x, p.m.position.z)) { p.m.position.x -= p.v.x * dt; p.m.position.z -= p.v.z * dt; p.v.x *= -0.5; p.v.z *= -0.5; } if (p.m.position.y < g + 0.3) { p.m.position.y = g + 0.3; p.v.y *= -0.3; p.v.x *= 0.6; p.v.z *= 0.6; if (Math.abs(p.v.y) < 0.6) p.rest = true; } }
      else p.m.position.y = G.World.fy(p.m.position.x, p.m.position.z) + 0.5 + Math.sin(t * 2 + i) * 0.1;
      p.m.rotation.y += dt * 1.5; if (Math.random() < 0.3) G.fx.emit(G.fx.add, p.m.position.x, p.m.position.y + 0.2, p.m.position.z, (Math.random() - 0.5) * 0.4, 0.8, (Math.random() - 0.5) * 0.4, 0.8, 0.1, 0, [1.4, 1.0, 2.0, 1], [0.4, 0.2, 0.8, 0]);
      if (p.t > 0.7 && !P.dead && !P.downed && Math.hypot(P.pos.x - p.m.position.x, P.pos.z - p.m.position.z) < 1.6) { G.scene.remove(p.m); G.pickups.splice(i, 1); if (!G.unlockPerma()) { P.runGold += 250; G.ui.toast('Every rune is already known · +250 gold'); } }
    }
    const keep = G.pickups.filter(p => p.kind === 'rune'); G.pickups = G.pickups.filter(p => p.kind !== 'rune');
    pk0(dt, t); G.pickups.push(...keep);
  };

  /* ---------------- kills: deeper dungeons teach more, stacks, rare runes ---------------- */
  const kill0 = G.game.onEnemyKilled.bind(G.game);
  G.game.onEnemyKilled = function (e, mine, kind) {
    const P = G.player, dg = G.DUNGEONS[G.run.dungeon] || G.DUNGEONS.crypt, xp0 = S.gainXp; let first = true;
    // experience scales with the danger of the dungeon
    S.gainXp = function (Pp, amt, why) { if (first && why === 'kill') { first = false; amt = Math.round(amt * (0.7 + 0.3 * dg.mult)); } return xp0.call(S, Pp, amt, why); };
    try { kill0(e, mine, kind); } finally { S.gainXp = xp0; }
    if (!P || kind === 'flee') return;
    if (mine) G.stacks.onKill(P);
    const final = e.boss && e.type === dg.bosses[1], chance = e.boss ? (final ? 0.4 : 0.22) : e.elite ? 0.05 : e.type === 'mimic' ? 0.08 : 0.0025 * (0.7 + 0.3 * dg.mult);
    if (G.run.active && Math.random() < chance) setTimeout(() => { if (G.run.active) G.game.spawnPickup('rune', new G.V3(e.pos.x, (e.pos.y || 0) + 1, e.pos.z), 0); }, e.boss ? 1200 : 0);
  };
  // momentum resets each floor
  const node0 = G.game.loadNode.bind(G.game);
  G.game.loadNode = async function (row, col) { G.stacks.floor(G.player); return node0(row, col); };

  /* ---------------- shared rewards ---------------- */
  // each hero rolls their own loot from a chest, whoever opened it
  G.game.chestLoot = function (c, shared) {
    const P = G.player; if (!P || !G.run.active) return;
    const dg = G.DUNGEONS[G.run.dungeon], at = new G.V3(c.x, 0.8, c.z), greed = 1 + P.mods.greed;
    const gold = Math.round(G.ri(20, 45) * (1 + c.tier) * dg.loot * greed * (shared ? 0.8 : 1));
    for (let k = 0; k < 8; k++) this.spawnPickup('gold', at, Math.ceil(gold / 8));
    const n = 1 + c.tier + (Math.random() < 0.4 * greed ? 1 : 0); for (let k = 0; k < n; k++) this.spawnPickup('item', at, 0, G.rollLoot(Math.random, c.tier * 0.5));
    if (c.tier >= 2 || (c.tier >= 1 && Math.random() < 0.4) || Math.random() < 0.08) this.spawnPickup('item', at, 0, G.makeMagic());
    if (Math.random() < 0.15 + c.tier * 0.1) this.spawnPickup('item', at, 0, G.SCROLL());
    if (Math.random() < (c.tier >= 2 ? 0.05 : 0.015)) this.spawnPickup('rune', at, 0);
    if (shared) { G.sheet.gainXp(P, 5, 'chest'); G.ui.toast('Your share of the chest'); }
  };
  G.game.openChest = function (c) {
    if (c.mimic) { this.mimicWake(c, false); return; }
    this.animateChest(c); G.net.sendFx({ k: 'chest', i: c.id }); G.sheet.gainXp(G.player, 5, 'chest');
    this.chestLoot(c, false);
  };
  const fx0 = G.net.onFx.bind(G.net);
  G.net.onFx = function (f, peer) {
    if (f && f.k === 'chest') { const c = G.World.chests && G.World.chests[f.i | 0], fresh = c && !c.opened && !c.mimic; fx0(f, peer); if (fresh && G.player && !G.player.dead) G.game.chestLoot(c, true); return; }
    return fx0(f, peer);
  };
  // quests reward everyone in the party, not just the hero who handed it in
  const qnet0 = G.Quests.onNet.bind(G.Quests);
  G.Quests.onNet = function (f, peer) {
    const Q = this.list.find(q => q.id === (f.i | 0)), was = Q && Q.done; qnet0(f, peer);
    if (!Q || was || !Q.done) return;
    if (f.s === 'back') this.reward(Q, 'fetch'); else if (f.s === 'free') this.reward(Q, 'rescue'); else if (f.s === 'open') this.reward(Q, 'guide');
  };
})();
