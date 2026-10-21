/* ============================================================
   UI: screens, HUD, minimap, station panels, party lobby
   ============================================================ */
'use strict';
const $ = id => document.getElementById(id);
G.ui = {
  ready: false,
  loader: {
    tips: ['When you drop to 0 health you make death saving throws: three 10s and you stabilize, three failures and you die. Allies can tend to you, and a Shrine of Returning can bring back the dead.', 'Puzzle vaults reward clever hands. Read the riddle, or roll Investigation for a hint.', 'Tap block right before a hit lands to parry and stun the attacker.', 'Smash pots, urns, barrels and crates. They hide gold, loot and potions.', 'Natural 20s offer four Legendary choices instead of three.', 'Fire burns, ice freezes, and holy light lifts the dead clean away.', 'Your backpack is lost if you fall. Carry your loot home to sell it.', 'The Shrine of Fortune adds +1 to every die you roll.', 'Archers fire harder and farther the longer they draw.', 'Hold E beside a downed ally to bring them back.', 'Weapons upgraded at the forge change their look as they grow stronger.'],
    show(title, sub, color) { const el = $('loading'); el.hidden = false; el.style.setProperty('--lc', color || '#d9b46a'); $('ldTitle').textContent = title; $('ldSub').textContent = sub || ''; $('ldTip').textContent = G.pick(this.tips); this.set(0, ''); },
    set(p, msg) { p = Math.round(G.clamp(p, 0, 100)); $('ldFill').style.width = p + '%'; $('ldPct').textContent = p + '%'; if (msg) $('ldMsg').textContent = msg; },
    step(p, msg) { this.set(p, msg); return new Promise(r => requestAnimationFrame(() => setTimeout(r, 0))); },
    hide() { const el = $('loading'); el.classList.add('out'); setTimeout(() => { el.hidden = true; el.classList.remove('out'); }, 350); }
  },
  init() {
    // menu
    $('bPlay').onclick = () => { G.audio.init(); G.sfx('click'); this.showHeroSelect(); };
    $('bSettings').onclick = () => { G.audio.init(); this.openSettings(); };
    $('bHow').onclick = () => { $('howM').hidden = false; };
    $('bBack').onclick = () => { this.show('menu'); G.game.menuFocus = null; };
    $('bSolo').onclick = () => { G.audio.init(); this.saveName(); G.net.leaveParty(); G.game.enterHideout(); };
    $('bCoop').onclick = () => { G.audio.init(); this.saveName(); this.openParty(); };
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { $(b.dataset.close).hidden = true; if (b.dataset.close === 'settingsM' && this.pausedFromSettings) { $('pauseM').hidden = false; } });
    $('panelX').onclick = () => this.closePanel();
    $('pResume').onclick = () => this.resume();
    $('pSettings').onclick = () => { $('pauseM').hidden = true; this.pausedFromSettings = true; this.openSettings(); };
    $('pHow').onclick = () => { $('howM').hidden = false; };
    $('pAbandon').onclick = () => { $('pauseM').hidden = true; if (G.run.active) { if (G.net.party && !G.net.isHost()) { G.game.leaveRunSolo(); } else G.game.endRun(false, 'You abandoned the expedition.'); } };
    $('pMenu').onclick = () => { $('pauseM').hidden = true; G.game.toMenu(); };
    $('resume').onclick = () => { $('resume').hidden = true; G.lockPointer(); };
    $('stage').addEventListener('click', () => { if (G.state === 'play' && !this.modalOpen()) G.lockPointer(); });
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && G.state === 'play' && !this.modalOpen() && !this.releasing) $('pauseM').hidden = false, this.pauseNote();
      this.releasing = false; if (document.pointerLockElement) $('resume').hidden = true;
    });
    document.addEventListener('pointerlockerror', () => { G.noLock = true; });
    addEventListener('keydown', e => {
      if (e.code === 'Escape') {
        if (!$('fullMap').hidden) { this.toggleMap(false); return; }
        if (G.dice.isOpen && G.dice.isOpen()) return;
        if (!$('dmCard').hidden || !$('runMap').hidden) return;
        if (!$('panelM').hidden) { this.closePanel(); return; }
        if (G.dialog.isOpen()) { G.dialog.close(); return; }
        if (!$('settingsM').hidden || !$('howM').hidden) { $('settingsM').hidden = $('howM').hidden = true; if (this.pausedFromSettings) $('pauseM').hidden = false; return; }
        if (G.state === 'play') { if ($('pauseM').hidden) { $('pauseM').hidden = false; this.pauseNote(); this.releasePointer(); } else this.resume(); }
      }
      if (e.code === 'KeyC' && G.state === 'play' && this.panelKind === 'sheet' && !$('panelM').hidden) { this.closePanel(); return; }
      if (e.code === 'KeyM' && G.state === 'play' && !e.repeat && !(document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName))) { this.toggleMap(); return; }
      if (e.code === 'Tab' && G.state === 'play') { e.preventDefault(); if (!$('panelM').hidden && this.panelKind === 'pack') this.closePanel(); else if (!this.modalOpen()) this.openPanel('pack'); }
    });
    // settings
    const S = G.settings, bind = (id, key, num) => { const el = $(id); if (el.type === 'checkbox') { el.checked = S[key]; el.onchange = () => { S[key] = el.checked; G.saveSettings(); this.applySettings(); }; } else { el.value = S[key]; el.oninput = () => { S[key] = num ? +el.value : el.value; G.saveSettings(); this.applySettings(); }; } };
    bind('sSens', 'sens', 1); bind('sFov', 'fov', 1); bind('sVol', 'vol', 1); bind('sMus', 'music', 1); bind('sQual', 'quality'); bind('sBloom', 'bloom'); bind('sGore', 'gore'); bind('sShake', 'shake'); bind('sInv', 'invertY'); bind('sFps', 'fps');
    $('nameIn').value = S.name || '';
    // hero cards
    const box = $('classes');
    G.CLASSES.forEach(c => { const I = G.CLASS_INFO[c], b = document.createElement('button'); b.className = 'cls'; b.style.setProperty('--cc', I.color); b.innerHTML = `<b>${I.name}</b><span>${I.weapon}</span><em>${G.HIDEOUT.weapon.names[G.save.cls[c].wpn]}</em>`; b.onclick = () => { G.sfx('click'); this.pickClass(c); }; b.dataset.c = c; box.appendChild(b); });
    this.hurtCtx = $('hurtDir').getContext('2d');
  },
  saveName() { const n = $('nameIn').value.trim().slice(0, 16); G.settings.name = n || 'Adventurer'; G.saveSettings(); },
  applySettings() { G.audio.apply(); if (G.camera) { G.camera.fov = G.settings.fov; G.camera.updateProjectionMatrix(); } if (G.bloomPass) G.bloomPass.enabled = G.settings.bloom; $('fps').hidden = !G.settings.fps; },
  openSettings() { $('settingsM').hidden = false; },
  show(id) { ['menu', 'heroSel', 'boot'].forEach(s => $(s).hidden = s !== id); },
  netStatus(on) { const b = $('netBadge'); b.classList.toggle('on', on); b.querySelector('span').textContent = on ? (G.net.isP2P() ? 'Online co-op ready · Host a room or join with a Room ID' : 'Co-op ready · parties sync through this page') : 'Solo only here · online co-op could not load'; },
  showHeroSelect() { this.show('heroSel'); this.pickClass(G.cls || 'knight'); },
  pickClass(c) {
    G.cls = c; G.store.set('dd_cls', c);
    document.querySelectorAll('.cls').forEach(b => { b.classList.toggle('sel', b.dataset.c === c); b.querySelector('em').textContent = G.HIDEOUT.weapon.names[G.save.cls[b.dataset.c].wpn]; });
    const I = G.CLASS_INFO[c], A = G.ABIL[c], at = G.CLASS_ATK[c];
    const dmg = at.dmg / (at.time || 0.5);
    const st = [['Vitality', I.hp / 180], ['Speed', I.speed / 6.5], ['Might', Math.min(1, dmg / 60)], ['Guard', at.block]];
    $('hsDetail').style.setProperty('--cc', I.color);
    $('hsDetail').innerHTML = `<div class="d"><div class="eyebrow">${I.weapon}</div><h2>${I.name}</h2><p>${I.desc}</p>
      <div class="stats">${st.map(s => `<span>${s[0]}</span><div class="sb"><i style="width:${Math.round(s[1] * 100)}%"></i></div><span></span>`).join('')}</div></div>
      <div class="d" style="text-align:right"><div class="abrow">${G.AB.map(ab => `<span class="${['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].indexOf(ab) >= 0 && G.DND[c].weapon.ab === ab ? 'key' : ''}"><b>${G.DND[c].scores[ab]}</b><i>${ab} ${G.fmt(G.mod(G.DND[c].scores[ab]))}</i></span>`).join('')}</div>
      <div class="hsdice">${G.DND[c].weapon.name} ${G.DND[c].weapon.n}d${G.DND[c].weapon.d} ${G.fmt(G.mod(G.DND[c].scores[G.DND[c].weapon.ab]))} ${G.DND[c].weapon.ab} · Hit die d${G.DND[c].hd} · Proficient: ${G.DND[c].skills.join(', ')}</div>
      <div class="stats" style="grid-template-columns:auto auto;justify-content:end"><span class="kbd">Q</span><span style="color:var(--parch)">${A.q.name}</span><span class="kbd">R</span><span style="color:var(--parch)">${A.r.name}${G.save.cls[c].ab2 ? '' : ' · locked'}</span></div></div>`;
    G.game.menuFocus = c;
  },
  /* ---------- party ---------- */
  openParty() { $('partyM').hidden = false; this.refreshParty(); },
  refreshLobby() { if (!$('partyM').hidden && !G.net.party) this.refreshParty(); },
  refreshParty() {
    const body = $('partyBody'); if (!body || $('partyM').hidden) { G.game.updatePartyHud && G.game.updatePartyHud(); return; }
    if (!G.net.available()) { body.innerHTML = `<p class="sub">Co-op isn't available in this view. It works when the game is opened as a shared page in Claude, where friends who open the same page can join your party.</p><button class="btn" onclick="document.getElementById('partyM').hidden=true;G.game.enterHideout()">Play Solo Instead</button>`; return; }
    if (!G.net.party) {
      const list = G.net.openParties();
      if (G.net.isP2P()) {
        body.innerHTML = `<p class="sub">Host a room and send its Room ID to up to three friends, or paste a friend's Room ID to join their game. Players connect directly to the host.</p>
          <div class="row"><button class="btn" id="pCreate">Host</button><span class="note">or join a friend</span><input class="input" id="pCode" maxlength="6" placeholder="ROOM ID" aria-label="Room ID" autocomplete="off" spellcheck="false"><button class="btn small" id="pJoin">Join</button></div>
          <p class="note" id="pStatus" style="margin-top:14px"></p>`;
        const st = $('pStatus');
        $('pCreate').onclick = async () => { st.textContent = 'Opening a room…'; try { await G.net.createParty(); this.refreshParty(); } catch (e) { st.textContent = e && e.message ? e.message : 'Could not host a room'; } };
        $('pJoin').onclick = async () => { const c = $('pCode').value.trim(); if (c.length < 3) { st.textContent = 'Enter the Room ID your friend sent you.'; return; } st.textContent = 'Connecting…'; try { await G.net.joinParty(c); this.refreshParty(); } catch (e) { st.textContent = e && e.message && e.message !== 'bad code' ? e.message : 'Enter a valid Room ID'; } };
        $('pCode').onkeydown = e => { if (e.key === 'Enter') $('pJoin').click(); };
        return;
      }
      body.innerHTML = `<p class="sub">Start a party and share its code, or join one that's already gathering on this page.</p>
        <div class="row"><button class="btn" id="pCreate">Create Party</button><span class="note">or join by code</span><input class="input" id="pCode" maxlength="6" placeholder="CODE" aria-label="Party code"><button class="btn small" id="pJoin">Join</button></div>
        <h3 style="margin-top:22px;font-size:15px;color:var(--gilt)">Open parties</h3>
        <div class="plist">${list.length ? list.map(p => `<div class="pitem"><div><div class="nm">${esc(p.name)}'s party</div><div class="meta">Code ${esc(p.code)} · ${p.members}/4 heroes${p.inRun ? ' · in a dungeon' : ''}</div></div><button class="btn small" data-join="${esc(p.code)}" ${p.members >= 4 ? 'disabled' : ''}>Join</button></div>`).join('') : '<div class="note">No open parties right now. Create one and tell your friends the code.</div>'}</div>`;
      $('pCreate').onclick = async () => { try { await G.net.createParty(); this.refreshParty(); } catch (e) { this.toast('Could not create a party'); } };
      $('pJoin').onclick = () => this.joinCode($('pCode').value);
      body.querySelectorAll('[data-join]').forEach(b => b.onclick = () => this.joinCode(b.dataset.join));
      return;
    }
    const ms = G.net.members();
    body.innerHTML = `<p class="sub">Share this code with up to three friends. Everyone meets in the hideout, then the leader opens the portal.</p>
      <div class="row" style="justify-content:space-between"><div><div class="eyebrow">${G.net.isP2P() ? 'Room ID' : 'Party code'}</div><div class="code">${esc(G.net.code)}</div></div><button class="btn small ghost" id="pCopy">Copy code</button></div>
      <div class="plist">${ms.map(p => { const pr = p.presence, I = G.CLASS_INFO[pr.c] || G.CLASS_INFO.knight; return `<div class="member" style="--cc:${I.color}"><span class="dot"></span><span>${esc(pr.n || 'Adventurer')}${p.sameTab ? ' (you)' : ''} · <span style="color:var(--muted)">${I.name}</span></span>${p.peer === G.net.hostPeer ? '<span class="tag gold">Leader</span>' : '<span></span>'}<span class="tag">${String(pr.s || 'menu').startsWith('run') ? 'In dungeon' : pr.s === 'hideout' ? 'Hideout' : 'Choosing'}</span></div>`; }).join('')}</div>
      ${ms.length > 4 ? '<p class="note" style="color:var(--blood)">This party has more than four heroes. Extra members should leave and form a new party.</p>' : ''}
      <div class="row"><button class="btn" id="pEnter">Enter Hideout</button><button class="btn ghost small" id="pLeave">Leave Party</button></div>`;
    $('pCopy').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(G.net.code).then(() => this.toast('Code copied'), () => this.toast('Code: ' + G.net.code)); };
    $('pEnter').onclick = () => { $('partyM').hidden = true; G.game.enterHideout(); };
    $('pLeave').onclick = async () => { await G.net.leaveParty(); this.refreshParty(); };
  },
  async joinCode(c) { try { await G.net.joinParty(c); setTimeout(() => { if (G.net.members().length > 4) { this.toast('That party is full'); G.net.leaveParty().then(() => this.refreshParty()); } }, 1500); this.refreshParty(); } catch (e) { this.toast('Enter a valid party code'); } },

  /* ---------- pointer & modals ---------- */
  releasePointer() { if (document.pointerLockElement) { this.releasing = true; document.exitPointerLock(); } },
  lockSoon() { if (G.state === 'play' && !this.modalOpen()) { G.lockPointer(); setTimeout(() => { if (!document.pointerLockElement && !G.noLock && G.state === 'play' && !this.modalOpen()) $('resume').hidden = false; }, 250); } },
  modalOpen() { return !$('panelM').hidden || !$('dmCard').hidden || !$('runMap').hidden || !$('pauseM').hidden || !$('settingsM').hidden || !$('howM').hidden || !$('partyM').hidden || G.dialog.isOpen() || (G.dice.isOpen && G.dice.isOpen()); },
  resume() { $('pauseM').hidden = true; this.pausedFromSettings = false; G.lockPointer(); },
  pauseNote() { $('pNote').textContent = G.net.party ? 'The world keeps moving while you are paused in co-op.' : ''; $('pAbandon').hidden = !G.run.active; },

  /* ---------- HUD bits ---------- */
  // a small roll readout: "DEX save · 14 + 3 = 17 vs DC 13 · Success"
  checkChip(o) {
    const box = $('chips'); if (!box) return; const el = document.createElement('div'); el.className = 'chip ' + (o.ok ? 'ok' : 'bad');
    const math = o.nat !== undefined && o.bonus !== undefined ? `${o.nat} ${o.bonus >= 0 ? '+' : '−'} ${Math.abs(o.bonus)} = <b>${o.nat + o.bonus}</b>${o.dc ? ` vs DC ${o.dc}` : ''}` : o.nat !== undefined ? `rolled <b>${o.nat}</b> on d${o.sides || 20}` : '';
    el.innerHTML = `<div class="cdie">${o.icon || (o.nat !== undefined ? o.nat : '✦')}</div><div><div class="ct">${esc(o.title)}${o.nat !== undefined && o.dc ? ` · ${o.ok ? 'Success' : 'Failure'}` : ''}</div>${math ? `<div class="cm">${math}</div>` : ''}${o.line ? `<div class="cl">${esc(o.line)}</div>` : ''}</div>`;
    box.appendChild(el); while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, o.quiet ? 3200 : 5200);
  },
  // dead in a party: wait for a Shrine of Returning, or go home
  deathScreen(on) {
    const el = $('deathM'); el.hidden = !on; if (!on) return; this.releasePointer();
    $('dmReturn').onclick = () => { el.hidden = true; G.game.leaveRunSolo(); };
  },
  deathSaves() {
    const P = G.player, el = $('dsHud'), D = P && P.downed ? P.ds : null; if (!D) { if (!el.hidden) el.hidden = true; return; }
    el.hidden = false; const pip = (n, ch, cls) => Array.from({ length: 3 }, (_, i) => `<i class="${i < n ? cls : ''}">${i < n ? ch : ''}</i>`).join('');
    const key = `${D.s}|${D.f}|${D.stable}|${Math.ceil(D.stable ? D.stableT : D.t)}`; if (el.dataset.k === key) return; el.dataset.k = key;
    el.innerHTML = `<div class="dsT">Death Saves</div><div class="dsRow"><span>Successes</span>${pip(D.s, '✔', 'ok')}</div><div class="dsRow"><span>Failures</span>${pip(Math.min(3, D.f), '✖', 'bad')}</div><div class="dsN">${D.stable ? `Stable · rising in ${Math.ceil(D.stableT)}s` : `Next roll in ${Math.ceil(D.t)}s · 10 or higher succeeds`}</div>`;
  },
  refreshSheetBadge() {
    const P = G.player; if (!P || !P.dnd) return;
    $('lvBadge').textContent = P.level; const nx = G.XP_LV[P.level + 1], pv = G.XP_LV[P.level];
    $('xpBar').querySelector('i').style.width = (nx ? G.clamp((P.xp - pv) / (nx - pv), 0, 1) * 100 : 100) + '%';
    $('xpBar').querySelector('span').textContent = nx ? `${P.xp} / ${nx} XP` : 'Max level';
    const pts = P.abPts > 0 || P.featPending > 0; $('ptsBadge').hidden = !pts || !G.run.active;
    if (pts) $('ptsBadge').innerHTML = `${P.abPts ? `+${P.abPts} ability point${P.abPts > 1 ? 's' : ''}` : ''}${P.abPts && P.featPending ? ' · ' : ''}${P.featPending ? 'choose a feat' : ''} <span class="kbd">C</span>`;
    this.xpSeen = P.xp;
    if (this.panelKind === 'sheet' && !$('panelM').hidden) this.renderPanel();
  },
  refreshRelics() {
    const P = G.player; if (!P) return;
    $('relicStrip').innerHTML = P.relics.map(id => `<span title="${esc(G.RELICS[id].name)}: ${esc(G.RELICS[id].desc)}">${G.RELICS[id].icon}</span>`).join('') + P.backpack.filter(it => it.magic && it.attuned).map(it => `<span class="att" title="${esc(G.magicName(it))} (attuned)">${G.MAGIC[it.mid].icon}</span>`).join('');
  },
  toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; $('toasts').appendChild(t); setTimeout(() => t.remove(), 2500); while ($('toasts').children.length > 4) $('toasts').firstChild.remove(); },
  banner(title, sub) { $('banner').innerHTML = `<h1>${esc(title)}</h1><p>${esc(sub || '')}</p>`; clearTimeout(this.bt); this.bt = setTimeout(() => $('banner').innerHTML = '', 4100); },
  bossIntro(e) { this.banner(e.def.name, e.def.title); $('boss').hidden = false; $('bossName').textContent = e.def.name; this.bossE = e; },
  hurt(rel, amt) { this.hurtA = { a: rel, t: 1, s: Math.min(1, 0.4 + amt * 3) }; },
  flash(kind) { const v = $('vignette'); v.style.background = kind === 'parry' ? 'radial-gradient(ellipse at center, rgba(255,240,200,.18), transparent 60%)' : ''; setTimeout(() => v.style.background = '', 120); },
  hitMarker(crit) { const c = $('cross'); c.classList.add('hit'); if (crit) c.classList.add('crit'); clearTimeout(this.hm); this.hm = setTimeout(() => c.classList.remove('hit', 'crit'), 120); },
  buildAbBar() {
    const P = G.player, A = G.ABIL[P.cls], at = G.CLASS_ATK[P.cls];
    const ic = { knight: ['⚔', '⛨', '⛊', '➹'], barbarian: ['🪓', '⛨', '☠', '⤒'], rogue: ['🗡', '⛨', '☾', '✷'], archer: ['🏹', '⛨', '➶', '❄'], wizard: ['🔥', '◈', '❄', '⚡'], priest: ['✚', '⛨', '☀', '⚚'] }[P.cls];
    const slots = [['LMB', ic[0], 'atk'], ['RMB', ic[1], 'blk'], ['Q', ic[2], 'q'], ['R', ic[3], 'r'], ['F', '⚗', 'f'], ['SPC', '↯', 'dodge']];
    $('abBar').innerHTML = slots.map(s => `<div class="ab" id="ab_${s[2]}" title="${s[2] === 'q' ? (P.cls === 'priest' ? 'Tap: Healing Word · Hold: Holy Light' : A.q.name) : s[2] === 'r' ? A.r.name : ''}"><span class="k">${s[0]}</span>${s[1]}<div class="cd"></div><span class="cdt"></span><span class="n"></span></div>`).join('');
    $('manaBar').hidden = !P.maxMana;
  },
  update(dt) {
    const P = G.player; if (!P || $('hud').hidden) return;
    const hpk = G.clamp(P.hp / P.maxHp, 0, 1);
    $('hpBar').querySelector('.f').style.width = hpk * 100 + '%'; $('hpBar').querySelector('.ghost').style.width = hpk * 100 + '%';
    $('hpBar').querySelector('span').textContent = `${Math.ceil(Math.max(0, P.hp))} / ${Math.round(P.maxHp)}`;
    $('staBar').querySelector('.f').style.width = G.clamp(P.sta / P.maxSta, 0, 1) * 100 + '%';
    if (P.maxMana) { $('manaBar').querySelector('.f').style.width = G.clamp(P.mana / P.maxMana, 0, 1) * 100 + '%'; $('manaBar').querySelector('span').textContent = Math.floor(P.mana); }
    const setCd = (id, cd, max, locked, n) => { const el = $('ab_' + id); if (!el) return; el.querySelector('.cd').style.setProperty('--p', (max ? cd / max * 100 : 0) + '%'); el.querySelector('.cdt').textContent = cd > 0.05 ? Math.ceil(cd) : ''; el.classList.toggle('locked', !!locked); el.classList.toggle('ready', !locked && cd <= 0); if (n !== undefined) el.querySelector('.n').textContent = n; };
    const A = G.ABIL[P.cls];
    setCd('q', P.cd.q, A.q.cd * (1 - P.mods.cdr), A.q.mana && P.mana < A.q.mana);
    setCd('r', P.cd.r, A.r.cd * (1 - P.mods.cdr), !P.ab2 || (A.r.mana && P.mana < A.r.mana));
    setCd('f', 0, 0, P.potions <= 0, P.potions);
    setCd('dodge', Math.max(0, P.dodgeT), 0.5, P.sta < 25 * (1 - P.mods.dodgeCost));
    setCd('blk', 0, 0, false); setCd('atk', Math.max(0, P.atkCD), 1, false);
    $('goldV').textContent = G.run.active ? `${P.runGold} (+${G.save.gold})` : G.save.gold;
    $('packV').textContent = `${P.backpack.length}/${P.slots}`; $('killV').textContent = P.kills;
    if (this.xpSeen !== P.xp) this.refreshSheetBadge();
    const kv = G.run.active ? G.run.keys || 0 : 0; if (this.keySeen !== kv) { this.keySeen = kv; $('keyStat').hidden = !kv; $('keyV').textContent = kv; }
    const cb = $('castBar'); if (P.cast) { if (cb.hidden) { cb.hidden = false; $('castName').textContent = P.cast.name; cb.classList.toggle('holy', P.cls === 'priest'); } cb.querySelector('i').style.width = Math.min(100, P.cast.t / P.cast.dur * 100) + '%'; } else if (!cb.hidden) cb.hidden = true;
    $('chargeRing').hidden = !(P.charge >= 0); if (P.charge >= 0) $('chargeRing').style.setProperty('--p', P.charge * 100 + '%');
    // vignette (low hp, rage, hurt)
    const low = P.downed ? 0.85 : Math.max(0, 0.35 - hpk) * 2.2 + P.hurtFlash * 0.5;
    const v = $('vignette');
    if (!v.style.background || v.dataset.k !== String(Math.round(low * 20)) + (P.rageT > 0)) { v.dataset.k = String(Math.round(low * 20)) + (P.rageT > 0); v.style.background = low > 0.02 || P.rageT > 0 ? `radial-gradient(ellipse at center, transparent ${45 - low * 20}%, rgba(${P.rageT > 0 ? '170,10,0' : '120,0,0'},${Math.min(0.85, low * 0.8 + (P.rageT > 0 ? 0.35 : 0))}) 100%)` : ''; }
    // hurt direction arcs
    const hc = this.hurtCtx, cv = $('hurtDir'); if (cv.width !== innerWidth) { cv.width = innerWidth; cv.height = innerHeight; }
    hc.clearRect(0, 0, cv.width, cv.height);
    if (this.hurtA && this.hurtA.t > 0) { this.hurtA.t -= dt * 1.5; const a = -this.hurtA.a + Math.PI, cx = cv.width / 2, cy = cv.height / 2, r = Math.min(cx, cy) * 0.55; hc.strokeStyle = `rgba(220,30,20,${this.hurtA.t * this.hurtA.s})`; hc.lineWidth = 10; hc.beginPath(); hc.arc(cx, cy, r, a - Math.PI / 2 - 0.35, a - Math.PI / 2 + 0.35); hc.stroke(); }
    // boss
    if (this.bossE) { const e = this.bossE; const k = Math.max(0, e.hp / e.maxHp); $('bossBar').querySelector('.f').style.width = k * 100 + '%'; $('bossBar').querySelector('.ghost').style.width = k * 100 + '%'; if (e.dead) { this.bossE = null; setTimeout(() => $('boss').hidden = true, 1500); } }
    this.fpsT = (this.fpsT || 0) + dt; this.fpsN = (this.fpsN || 0) + 1; if (this.fpsT > 0.5) { if (G.settings.fps) $('fps').textContent = Math.round(this.fpsN / this.fpsT) + ' fps'; this.fpsT = 0; this.fpsN = 0; }
    this.deathSaves();
    this.mmT = (this.mmT || 0) - dt; if (this.mmT <= 0) { this.mmT = 0.1; this.minimap(); }
    if (!$('fullMap').hidden) { if (G.state !== 'play' || this.modalOpen()) $('fullMap').hidden = true; else { this.fmT = (this.fmT || 0) - dt; if (this.fmT <= 0) { this.fmT = 0.12; this.fullMap(); } } }
  },
  setPrompt(html) { const p = $('prompt'); if (!html) { p.hidden = true; return; } if (p.innerHTML !== html) p.innerHTML = html; p.hidden = false; },
  refreshUpgrades() { const P = G.player; $('upgStrip').innerHTML = P.upgrades.map(u => `<span style="--tc:${G.TIERS[u.t].color}" title="${esc(u.name)}: ${esc(u.desc)}">${u.icon}</span>`).join(''); },
  // exploration: everything within two cells of you, and the whole room once you step inside it
  explore(W, pcx, pcz) {
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { const xx = pcx + dx, zz = pcz + dz; if (xx >= 0 && zz >= 0 && xx < W.W && zz < W.H) W.explored[zz * W.W + xx] = 1; }
    const rid = W.roomId && pcx >= 0 && pcz >= 0 && pcx < W.W && pcz < W.H ? W.roomId[pcz * W.W + pcx] : -1;
    if (rid >= 0 && W._litRoom !== rid && W.rooms[rid]) { W._litRoom = rid; const ro = W.rooms[rid]; for (let z = ro.y - 1; z <= ro.y + ro.h; z++) for (let x = ro.x - 1; x <= ro.x + ro.w; x++) if (x >= 0 && z >= 0 && x < W.W && z < W.H) W.explored[z * W.W + x] = 1; }
  },
  /* ---------- full map (M): explored floor in full, the edge of the unknown drawn as drifting fog with
     hatched "continues here" cells so you can see where unexplored passages lead ---------- */
  toggleMap(on) {
    const el = $('fullMap'); on = on === undefined ? el.hidden : on;
    if (on && (G.state !== 'play' || this.modalOpen())) return;
    el.hidden = !on; if (on) { this.fmT = 0; this.fullMap(); }
  },
  fullMap() {
    const c = $('fmCanvas'), x = c.getContext('2d'), W = G.World, P = G.player; if (!P || !W.W) return;
    const S = c.width, CS = W.CS, pad = 40, sc = Math.min((S - pad * 2) / (W.W * CS), (S - pad * 2) / (W.H * CS)), ox = (S - W.W * CS * sc) / 2, oz = (S - W.H * CS * sc) / 2;
    const t = G.now(), seeAll = G.run.active && (P.relics.includes('map') || G.run.reveal === G.run.step);
    const ex = i => seeAll || W.explored[i], floor = i => W.grid[i] && !(W.hiddenSet && W.hiddenSet.has(i));
    const X = v => ox + v * sc, Z = v => oz + v * sc, cw = CS * sc;
    // parchment-dark ground with a soft vignette
    const bg = x.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.75); bg.addColorStop(0, '#17121c'); bg.addColorStop(1, '#09070b'); x.fillStyle = bg; x.fillRect(0, 0, S, S);
    // distance (in cells) from explored floor, for the fog fringe
    const N = W.W * W.H, dist = this._fmDist && this._fmDist.length === N ? this._fmDist : (this._fmDist = new Uint8Array(N)); dist.fill(9);
    for (let i = 0; i < N; i++) if (floor(i) && ex(i)) dist[i] = 0;
    for (let pass = 1; pass <= 3; pass++) for (let z = 0; z < W.H; z++) for (let xx = 0; xx < W.W; xx++) { const i = z * W.W + xx; if (dist[i] < 9 || !floor(i)) continue; const n = [i - 1, i + 1, i - W.W, i + W.W].some(j => j >= 0 && j < N && dist[j] === pass - 1); if (n) dist[i] = pass; }
    let total = 0, seen = 0;
    for (let z = 0; z < W.H; z++) for (let xx = 0; xx < W.W; xx++) {
      const i = z * W.W + xx; if (!floor(i)) continue; total++;
      if (dist[i] === 0) { seen++; const rid = W.roomId ? W.roomId[i] : -1, ro = rid >= 0 ? W.rooms[rid] : null;
        x.fillStyle = ro && ro.type === 'boss' ? '#5a2020' : ro && ro.type === 'npc' ? '#4a3a22' : ro ? '#4a4252' : '#383040'; x.fillRect(X(xx * CS), Z(z * CS), cw + 0.6, cw + 0.6); }
      else if (dist[i] <= 3) { // the unknown: fog fringe that fades out, with a diagonal hatch
        const a = [0, 0.6, 0.34, 0.15][dist[i]], wob = 0.85 + 0.15 * Math.sin(t * 1.3 + xx * 0.7 + z * 1.1);
        x.fillStyle = `rgba(110,140,190,${a * 0.75 * wob})`; x.fillRect(X(xx * CS), Z(z * CS), cw + 0.6, cw + 0.6);
        x.save(); x.beginPath(); x.rect(X(xx * CS), Z(z * CS), cw, cw); x.clip(); x.strokeStyle = `rgba(190,215,255,${a * 0.7})`; x.lineWidth = 1.2;
        for (let k = -cw; k < cw * 2; k += 7) { x.beginPath(); x.moveTo(X(xx * CS) + k, Z(z * CS)); x.lineTo(X(xx * CS) + k - cw, Z(z * CS) + cw); x.stroke(); } x.restore(); }
    }
    // walls: gold edge wherever explored floor meets rock
    x.strokeStyle = 'rgba(217,180,106,0.55)'; x.lineWidth = 2; x.beginPath();
    for (let z = 0; z < W.H; z++) for (let xx = 0; xx < W.W; xx++) { const i = z * W.W + xx; if (!floor(i) || dist[i] !== 0) continue; const x0 = X(xx * CS), z0 = Z(z * CS);
      if (xx > 0 && !floor(i - 1)) { x.moveTo(x0, z0); x.lineTo(x0, z0 + cw); } if (xx < W.W - 1 && !floor(i + 1)) { x.moveTo(x0 + cw, z0); x.lineTo(x0 + cw, z0 + cw); }
      if (z > 0 && !floor(i - W.W)) { x.moveTo(x0, z0); x.lineTo(x0 + cw, z0); } if (z < W.H - 1 && !floor(i + W.W)) { x.moveTo(x0, z0 + cw); x.lineTo(x0 + cw, z0 + cw); } }
    x.stroke();
    // markers (same rules as the minimap: only what you have seen)
    const seenAt = (px, pz) => seeAll || W.explored[Math.floor(pz / CS) * W.W + Math.floor(px / CS)];
    const glyph = (px, pz, ch, col, sz = 22) => { x.fillStyle = col; x.font = `700 ${sz}px Cinzel, serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = 'rgba(0,0,0,.8)'; x.shadowBlur = 6; x.fillText(ch, X(px), Z(pz) + 1); x.shadowBlur = 0; };
    const dot = (px, pz, col, r) => { x.fillStyle = col; x.beginPath(); x.arc(X(px), Z(pz), r, 0, 7); x.fill(); };
    (W.npcs || []).forEach(n => { if (seenAt(n.x, n.z)) dot(n.x, n.z, '#ffd060', 7); });
    (W.chests || []).forEach(ch => { if (!ch.opened && seenAt(ch.x, ch.z)) { x.fillStyle = ch.mimic && ch.seen ? '#ff4030' : '#c08040'; x.fillRect(X(ch.x) - 6, Z(ch.z) - 4, 12, 9); } });
    (W.traps || []).forEach(tr => { if (tr.armed && tr.found && seenAt(tr.x, tr.z)) glyph(tr.x, tr.z, '✕', '#ff5040', 18); });
    (W.gates || []).forEach(g => { if (g.open) return; const gx = (g.cx + 0.5) * CS, gz = (g.cy + 0.5) * CS; if (g.type === 'secret') { if (g.noticed && seenAt(gx, gz)) glyph(gx, gz, '◇', '#9ad8ff'); } else if (seenAt(gx, gz)) glyph(gx, gz, g.type === 'vault' ? '▣' : g.type === 'rune' ? '✧' : '▮', g.type === 'vault' ? '#ffc040' : g.type === 'rune' ? '#b080ff' : '#c08040'); });
    (W.pedestals || []).forEach(p => { if (!p.taken && (seenAt(p.x, p.z) || (p.kind === 'key' && seeAll))) glyph(p.x, p.z, p.kind === 'key' ? '⚷' : '★', '#ffd060'); });
    (W.events || []).forEach(ev => { if (!ev.used[G.net.myId()] && seenAt(ev.x, ev.z)) glyph(ev.x, ev.z, '?', '#c080ff', 26); });
    (W.shrines || []).forEach(sh => { if (!sh.used && seenAt(sh.x, sh.z)) glyph(sh.x, sh.z, '☥', '#ffd070', 24); });
    (G.Puzzles.list || []).forEach(p => { if (!p.solved && seenAt(p.x, p.z)) glyph(p.x, p.z, '✦', '#8ad8ff', 24); });
    G.pickups.forEach(p => { if (p.kind === 'key') glyph(p.m.position.x, p.m.position.z, '⚷', '#ffd060'); });
    if (W.bossDoor) { const bx = (W.bossDoor.cx + 0.5) * CS, bz = (W.bossDoor.cy + 0.5) * CS; if (seenAt(bx, bz)) glyph(bx, bz, '☠', '#ff5a40', 26); }
    if (W.exitPortal) { const pr = 9 + Math.sin(t * 3) * 2; dot(W.exitPortal.x, W.exitPortal.z, '#b080ff', pr); }
    if (W.theme === 'hideout') W.interact.forEach(s => dot(s.x, s.z, '#d9b46a', 6));
    if (W.theme !== 'hideout') G.enemies.list.forEach(e => { if (!e.dead && e.awake && G.dist2(e.pos.x, e.pos.z, P.pos.x, P.pos.z) < 900) dot(e.pos.x, e.pos.z, e.boss ? '#ff3020' : '#d04040', e.boss ? 9 : 4); });
    Object.values(G.net.remotes).forEach(r => { if (r.root.visible) { dot(r.pos.x, r.pos.z, G.CLASS_INFO[r.cls].color, 8); x.strokeStyle = '#000'; x.lineWidth = 2; x.beginPath(); x.arc(X(r.pos.x), Z(r.pos.z), 8, 0, 7); x.stroke(); } });
    // you: arrow pointing the way you face, with a pulsing halo
    x.save(); x.translate(X(P.pos.x), Z(P.pos.z)); x.fillStyle = `rgba(255,220,140,${0.18 + 0.1 * Math.sin(t * 4)})`; x.beginPath(); x.arc(0, 0, 20, 0, 7); x.fill();
    x.rotate(-P.yaw + Math.PI); x.fillStyle = G.CLASS_INFO[P.cls].color; x.strokeStyle = '#000'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -14); x.lineTo(10, 11); x.lineTo(0, 5); x.lineTo(-10, 11); x.closePath(); x.fill(); x.stroke(); x.restore();
    // side panel
    const pct = total ? Math.round(seen / total * 100) : 100, D = G.DUNGEONS[G.run.dungeon];
    $('fmTitle').textContent = G.run.active ? (D ? D.name : 'The Depths') : 'The Hideout';
    $('fmDepth').textContent = G.run.active ? `Floor ${G.run.step + 1}` : 'Safe haven';
    $('fmBarI').style.width = pct + '%'; $('fmPct').textContent = seeAll ? 'Revealed by your map' : `${pct}% explored`;
    if (!this._fmLeg) { this._fmLeg = 1; $('fmLegend').innerHTML = [['sw', '#4a4252', 'Explored'], ['sw', 'repeating-linear-gradient(135deg, rgba(110,140,190,.55) 0 3px, rgba(190,215,255,.6) 3px 5px)', 'Unexplored — leads on'], ['☠', '#ff5a40', 'Boss door'], ['?', '#c080ff', 'Event'], ['✦', '#8ad8ff', 'Puzzle'], ['☥', '#ffd070', 'Shrine of Returning'], ['⚷', '#ffd060', 'Key'], ['▣', '#ffc040', 'Vault'], ['✕', '#ff5040', 'Trap'], ['●', '#b080ff', 'Exit portal']].map(([g, c, l]) => g === 'sw' ? `<li><b><span class="sw" style="background:${c}"></span></b>${l}</li>` : `<li><b style="color:${c}">${g}</b>${l}</li>`).join(''); }
  },
  minimap() {
    const c = $('minimap'), x = c.getContext('2d'), W = G.World, P = G.player; if (!P || !W.W) return;
    const S = c.width, scale = S / 72, cx = S / 2, cy = S / 2;
    x.clearRect(0, 0, S, S); x.save(); x.beginPath(); x.arc(cx, cy, S / 2 - 2, 0, 7); x.clip();
    x.fillStyle = 'rgba(8,6,10,0.75)'; x.fillRect(0, 0, S, S);
    x.translate(cx, cy); x.rotate(P.yaw); x.translate(-P.pos.x * scale, -P.pos.z * scale);
    const CS = W.CS, pcx = Math.floor(P.pos.x / CS), pcz = Math.floor(P.pos.z / CS);
    this.explore(W, pcx, pcz);
    const seeAll = G.run.active && (P.relics.includes('map') || G.run.reveal === G.run.step);
    for (let z = 0; z < W.H; z++) for (let xx = 0; xx < W.W; xx++) { const i = z * W.W + xx; if (!W.grid[i] || !W.explored[i] || (W.hiddenSet && W.hiddenSet.has(i))) continue; const rid = W.roomId ? W.roomId[i] : -1; const ro = rid >= 0 ? W.rooms[rid] : null; x.fillStyle = ro && ro.type === 'boss' ? '#4a1a1a' : ro && ro.type === 'npc' ? '#3a2e1a' : ro ? '#3a3440' : '#2a2530'; x.fillRect(xx * CS * scale, z * CS * scale, CS * scale + 0.5, CS * scale + 0.5); }
    const dot = (px, pz, col, r = 4) => { x.fillStyle = col; x.beginPath(); x.arc(px * scale, pz * scale, r, 0, 7); x.fill(); };
    (W.npcs || []).forEach(n => { if (W.explored[Math.floor(n.z / CS) * W.W + Math.floor(n.x / CS)]) dot(n.x, n.z, '#ffd060', 6); });
    (W.chests || []).forEach(ch => { if (!ch.opened && W.explored[Math.floor(ch.z / CS) * W.W + Math.floor(ch.x / CS)]) { x.fillStyle = '#c08040'; x.fillRect(ch.x * scale - 4, ch.z * scale - 3, 8, 6); } });
    if (W.theme !== 'hideout') G.enemies.list.forEach(e => { if (!e.dead && e.awake && G.dist2(e.pos.x, e.pos.z, P.pos.x, P.pos.z) < 900) dot(e.pos.x, e.pos.z, e.boss ? '#ff3020' : '#d04040', e.boss ? 8 : 3.5); });
    if (W.exitPortal) dot(W.exitPortal.x, W.exitPortal.z, '#b080ff', 8);
    const seen = (px, pz) => seeAll || W.explored[Math.floor(pz / CS) * W.W + Math.floor(px / CS)];
    const glyph = (px, pz, ch, col, sz = 18) => { x.save(); x.translate(px * scale, pz * scale); x.rotate(-P.yaw); x.fillStyle = col; x.font = `700 ${sz}px Cinzel, serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, 0, 1); x.restore(); };
    (W.traps || []).forEach(t => { if (t.armed && t.found && seen(t.x, t.z)) glyph(t.x, t.z, '✕', '#ff5040', 16); });
    (W.gates || []).forEach(g => { if (g.open) return; const gx = (g.cx + 0.5) * CS, gz = (g.cy + 0.5) * CS; if (g.type === 'secret') { if (g.noticed && seen(gx, gz)) glyph(gx, gz, '◇', '#9ad8ff'); } else if (seen(gx, gz)) glyph(gx, gz, g.type === 'vault' ? '▣' : g.type === 'rune' ? '✧' : '▮', g.type === 'vault' ? '#ffc040' : g.type === 'rune' ? '#b080ff' : '#c08040'); });
    (W.pedestals || []).forEach(p => { if (!p.taken && (seen(p.x, p.z) || (p.kind === 'key' && seeAll))) glyph(p.x, p.z, p.kind === 'key' ? '⚷' : '★', '#ffd060'); });
    (W.events || []).forEach(ev => { if (!ev.used[G.net.myId()] && seen(ev.x, ev.z)) glyph(ev.x, ev.z, '?', '#c080ff', 22); });
    G.pickups.forEach(p => { if (p.kind === 'key') glyph(p.m.position.x, p.m.position.z, '⚷', '#ffd060'); });
    (W.chests || []).forEach(c => { if (c.mimic && c.seen && !c.opened) glyph(c.x, c.z, '!', '#ff4030', 20); });
    (W.shrines || []).forEach(sh => { if (!sh.used && seen(sh.x, sh.z)) glyph(sh.x, sh.z, '☥', '#ffd070', 20); });
    (G.Puzzles.list || []).forEach(p => { if (!p.solved && seen(p.x, p.z)) glyph(p.x, p.z, '✦', '#8ad8ff', 20); });
    if (W.theme === 'hideout') W.interact.forEach(s => dot(s.x, s.z, '#d9b46a', 5));
    Object.values(G.net.remotes).forEach(r => { if (r.root.visible) dot(r.pos.x, r.pos.z, G.CLASS_INFO[r.cls].color, 6); });
    x.restore();
    // player arrow
    x.fillStyle = G.CLASS_INFO[P.cls].color; x.beginPath(); x.moveTo(cx, cy - 11); x.lineTo(cx + 7, cy + 8); x.lineTo(cx, cy + 4); x.lineTo(cx - 7, cy + 8); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(217,180,106,0.5)'; x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, S / 2 - 2, 0, 7); x.stroke();
    x.fillStyle = '#d9b46a'; x.font = '700 22px Cinzel, serif'; x.textAlign = 'center'; const nx = cx + Math.sin(-P.yaw + Math.PI) * (S / 2 - 18), ny = cy + Math.cos(-P.yaw + Math.PI) * (S / 2 - 18); x.fillText('N', nx, ny + 8);
  },
  partyFrames() {
    const box = $('party'); if (!G.net.party) { box.innerHTML = ''; return; }
    const ms = G.net.members().filter(p => !p.sameTab && G.net.inMyScene(p));
    box.innerHTML = ms.map(p => { const pr = p.presence, I = G.CLASS_INFO[pr.c] || G.CLASS_INFO.knight; return `<div class="pf ${pr.d || pr.dd ? 'down' : ''}" style="--cc:${I.color}"><div class="nm"><span>${esc(pr.n || 'Adventurer')}</span></div><div class="hb"><i style="width:${G.clamp((+pr.hp || 0) / Math.max(1, +pr.mh || 1), 0, 1) * 100}%"></i></div></div>`; }).join('');
  },

  /* ---------- panels ---------- */
  openPanel(kind, data) {
    this.panelKind = kind; this.panelData = data; this.releasePointer();
    $('panelM').hidden = false; this.renderPanel();
  },
  closePanel() { $('panelM').hidden = true; this.panelKind = null; if (this.onPanelClose) { const f = this.onPanelClose; this.onPanelClose = null; f(); } this.lockSoon(); },
  buy(cost, fn) { if (G.save.gold < cost) { this.toast('Not enough gold'); G.sfx('click'); return; } G.save.gold -= cost; fn(); G.persist(); G.sfx('coin'); G.sfx('level', 0.6); this.renderPanel(); },
  renderPanel() {
    const k = this.panelKind, S = G.save, P = G.player, H = G.HIDEOUT; const body = $('panelBody');
    const set = (eye, title, sub) => { $('panelEye').textContent = eye; $('panelTitle').textContent = title; $('panelSub').textContent = sub; };
    const gold = `<div class="goldline">Gold: ${S.gold}</div>`;
    const pips = (n, max) => `<div class="pips">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div>`;
    const item = (ic, title, desc, lvl, max, cost, id) => `<div class="shopitem"><div class="ic">${ic}</div><div style="min-width:0"><h3>${title}</h3><p>${desc}</p>${max ? pips(lvl, max) : ''}</div>${cost === null ? '<span class="tag gold">Mastered</span>' : `<button class="btn small" data-buy="${id}" ${S.gold < cost ? 'disabled' : ''}>${cost} g</button>`}</div>`;
    let html = '';
    if (k === 'smith') {
      set('Blacksmith', 'Brom\'s Forge', 'Permanent weapon upgrades for each hero. Each tier adds 30% damage and reforges the weapon.');
      html = gold + '<div class="shop">' + G.CLASSES.map(c => { const lv = S.cls[c].wpn, I = G.CLASS_INFO[c]; return item(`<span style="color:${I.color}">⚔</span>`, `${I.name} · ${I.weapon}`, `${H.weapon.names[lv]}${lv < 4 ? ' → ' + H.weapon.names[lv + 1] : ''} · +${lv * 30}% damage`, lv, 4, lv < 4 ? H.weapon.costs[lv] : null, 'w_' + c); }).join('') + '</div>';
    } else if (k === 'tailor') {
      const lv = S.backpackLv; set('Packmaker', 'Packs & Satchels', 'Carry more treasure out of the dark.');
      html = gold + '<div class="shop">' + item(`<img src="${G.dice.icon('backpack')}" alt="">`, H.backpack.names[lv], `${H.backpack.slots[lv]} slots${lv < 4 ? ` → ${H.backpack.names[lv + 1]}: ${H.backpack.slots[lv + 1]} slots` : ''}`, lv, 4, lv < 4 ? H.backpack.costs[lv] : null, 'bp') + '</div>';
    } else if (k === 'armor') {
      const lv = S.armorLv; set('Armorer', 'Reinforced Armor', 'Every hero benefits from layered plate and padding.');
      html = gold + '<div class="shop">' + item('⛨', `Armor rank ${lv}`, `+${lv * H.armor.hp} max health · ${Math.round(lv * H.armor.red * 100)}% damage reduction`, lv, 5, lv < 5 ? H.armor.costs[lv] : null, 'ar') + '</div>';
    } else if (k === 'library') {
      set('Arcane Library', 'Tomes of Power', 'Unlock and empower each hero\'s second ability (R). Wizards and priests learn new spells here.');
      html = gold + '<div class="shop">' + G.CLASSES.map(c => { const cs = S.cls[c], I = G.CLASS_INFO[c], ab = G.ABIL[c].r, mage = c === 'wizard' || c === 'priest'; const desc = { knight: 'Charge forward, trampling foes; take half damage for 3s.', barbarian: 'Leap to your aim point and slam the ground.', rogue: 'Hurl a ring of bleeding knives around you.', archer: 'An arrow that bursts into a freezing blast.', wizard: 'Lightning that leaps between enemies.', priest: 'Call a pillar of holy light at your aim point.' }[c];
        const cost = !cs.ab2 ? H.ab2.unlock : cs.ab2Lv < 2 ? H.ab2.ranks[cs.ab2Lv] : null;
        return item(`<span style="color:${I.color}">${mage ? '✧' : '✦'}</span>`, `${I.name} · ${ab.name}${mage ? ' <span class="tag gold">Spell</span>' : ''}`, `${desc} ${cs.ab2 ? `Rank ${cs.ab2Lv + 1}/3` : 'Locked'}`, cs.ab2 ? cs.ab2Lv + 1 : 0, 3, cost, 'ab_' + c); }).join('') + '</div>';
    } else if (k === 'luck') {
      const lv = S.luckLv; set('Shrine of Fortune', 'Bless the Bones', 'Each blessing adds +1 to every d20 you roll in the dungeon.');
      html = gold + '<div class="shop">' + item('🎲', `Fortune +${lv}`, `Dice rolls get +${lv}${lv < 3 ? ` → +${lv + 1}` : ''}`, lv, 3, lv < 3 ? H.luck.costs[lv] : null, 'lk') + '</div>';
    } else if (k === 'alchemist') {
      const lv = S.flaskLv; set('Alchemist', 'Healing Flasks', 'Each flask restores half your health over a moment.');
      html = gold + '<div class="shop">' + item(`<img src="${G.dice.icon('potion', 0)}" alt="">`, `${1 + lv} flask${lv ? 's' : ''} per run`, lv < 3 ? `Brew another → ${2 + lv} per run` : 'Your belt is full', lv, 3, lv < 3 ? H.flask.costs[lv] : null, 'fl') + '</div>';
    } else if (k === 'merchant') {
      set('Merchant', 'Seer Maelis\' Curios', 'Treasure carried home waits here until you sell it.');
      const total = S.stash.reduce((a, b) => a + b.value, 0);
      html = gold + (S.stash.length ? `<div class="row" style="margin-bottom:12px"><button class="btn small" id="sellAll">Sell everything · ${total} g</button></div><div class="bp">${S.stash.map((it, i) => `<button class="slot" data-sell="${i}" title="Sell ${esc(it.name)}"><img src="${G.dice.icon(it.model, it.v)}" alt=""><small>${it.value} g</small></button>`).join('')}</div>` : '<p class="note">Nothing to sell. Bring loot back from the dungeons.</p>');
    } else if (k === 'class') {
      set('Hall of Heroes', 'Choose Your Hero', 'Swap heroes freely while in the hideout.');
      html = '<div class="shop">' + G.CLASSES.map(c => { const I = G.CLASS_INFO[c]; return `<div class="shopitem"><div class="ic" style="color:${I.color}">◆</div><div style="min-width:0"><h3 style="color:${I.color}">${I.name}</h3><p>${I.desc}</p></div>${G.cls === c ? '<span class="tag ok">Current</span>' : `<button class="btn small" data-cls="${c}">Choose</button>`}</div>`; }).join('') + '</div>';
    } else if (k === 'portal') {
      set('Dungeon Portal', 'Choose Your Descent', 'Nine levels deep, with a Guardian halfway and a dungeon lord at the bottom. Between levels the party chooses a path on the map, and can vote to extract early with everything it carries.');
      const sel = this.dgSel || 'crypt', party = G.net.party, host = G.net.isHost(), ms = party ? G.net.members() : [];
      html = `<div class="dgcards">${Object.entries(G.DUNGEONS).map(([id, d]) => `<button class="dg ${sel === id ? 'sel' : ''}" style="--dc:${d.color}" data-dg="${id}" ${party && !host ? 'disabled' : ''}><h3>${d.name}</h3><p>${d.desc}</p><small>Danger ${'◆'.repeat(Math.round(d.mult * 1.5))} · Loot ×${d.loot}</small><p style="margin-top:8px">Bosses: ${d.bosses.map(b => G.BOSSES[b].name.split(',')[0]).join(', ')}</p></button>`).join('')}</div>`;
      if (party) html += `<h3 style="margin:18px 0 8px;font-size:15px;color:var(--gilt)">Party</h3><div class="plist">${ms.map(p => { const pr = p.presence, I = G.CLASS_INFO[pr.c] || G.CLASS_INFO.knight, here = pr.s === 'hideout'; return `<div class="member" style="--cc:${I.color}"><span class="dot"></span><span>${esc(pr.n || 'Adventurer')}${p.sameTab ? ' (you)' : ''}</span>${p.peer === G.net.hostPeer ? '<span class="tag gold">Leader</span>' : '<span></span>'}<span class="tag ${pr.rd && here ? 'ok' : ''}">${!here ? 'Not in hideout' : pr.rd ? 'Ready' : 'Not ready'}</span></div>`; }).join('')}</div>`;
      html += `<div class="row" style="margin-top:16px">${!party || host ? `<button class="btn" id="goDescend">Begin Descent</button>` : ''}${party ? `<button class="btn ${this.ready ? '' : 'ghost'}" id="readyBtn">${this.ready ? 'Ready ✓' : 'Mark Ready'}</button>` : ''}${party && !host ? '<span class="note">The party leader opens the portal.</span>' : ''}</div>`;
    } else if (k === 'pack') {
      set('Backpack', `${H.backpack.names[S.backpackLv]} · ${P.backpack.length}/${P.slots}`, G.run.active ? 'Loot is lost if you fall. Carry it home to sell at the merchant.' : 'Your pack is empty between runs. Loot you extracted waits at the merchant.');
      const slots = Array.from({ length: P.slots }, (_, i) => P.backpack[i]);
      const sel = P.backpack[this.selItem] ? this.selItem : -1;
      html = `${P.backpack.length && G.run.active ? '<p class="note" style="margin:-8px 0 12px">Click an item to inspect it. Drag it outside this window to drop it.</p>' : ''}<div class="bp">${slots.map((it, i) => it ? `<div class="slot drag ${it.magic ? 'magic' : ''} ${it.magic && it.attuned ? 'attuned' : ''} ${i === sel ? 'sel' : ''}" data-i="${i}" title="${esc(it.magic ? G.magicName(it) : it.name)}"><img src="${G.dice.icon(it.model, it.v)}" alt="" draggable="false">${it.magic && !it.identified ? '<em class="q">?</em>' : ''}${it.magic && it.attuned ? '<em class="a">✦</em>' : ''}<small>${it.value} g</small></div>` : '<div class="slot empty"></div>').join('')}</div>`;
      if (sel >= 0) html += this.itemInfo(P.backpack[sel], sel);
      html += `<h3 style="margin:20px 0 8px;font-size:15px;color:var(--gilt)">Run upgrades</h3>` + (P.upgrades.length ? `<div class="shop">${P.upgrades.map(u => `<div class="shopitem" style="grid-template-columns:40px 1fr"><div class="ic" style="width:40px;height:40px;font-size:20px;border-color:${G.TIERS[u.t].color}">${u.icon}</div><div><h3 style="color:${G.TIERS[u.t].color}">${u.name}</h3><p>${u.desc}</p></div></div>`).join('')}</div>` : '<p class="note">None yet. Seek out the strangers of the deep and roll the d20.</p>');
    }
    else if (k === 'sheet') { const r = this.sheetPanel(set); html = r; }
    else if (k === 'shop') html = this.shopPanel(set);
    else if (k === 'rest') html = this.restPanel(set);
    body.innerHTML = html;
    this.bindExtra(k, body);
    if (k === 'pack' && G.run.active) body.querySelectorAll('.slot.drag').forEach(el => el.onpointerdown = ev => this.startDrag(ev, el));
    body.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
      const id = b.dataset.buy;
      if (id.startsWith('w_')) { const c = id.slice(2); this.buy(H.weapon.costs[S.cls[c].wpn], () => { S.cls[c].wpn++; if (c === G.cls) G.game.rebuildPlayerGear(); G.World.hideNPCs && G.fx.spark(new G.V3(G.World.interact.find(s => s.id === 'smith').x, 1, G.World.interact.find(s => s.id === 'smith').z), 0xffa040, 40, 6); }); }
      else if (id === 'bp') this.buy(H.backpack.costs[S.backpackLv], () => S.backpackLv++);
      else if (id === 'ar') this.buy(H.armor.costs[S.armorLv], () => { S.armorLv++; G.player.hp = G.player.maxHp; });
      else if (id === 'lk') this.buy(H.luck.costs[S.luckLv], () => S.luckLv++);
      else if (id === 'fl') this.buy(H.flask.costs[S.flaskLv], () => { S.flaskLv++; G.player.potions = 1 + S.flaskLv; });
      else if (id.startsWith('ab_')) { const c = id.slice(3), cs = S.cls[c]; this.buy(!cs.ab2 ? H.ab2.unlock : H.ab2.ranks[cs.ab2Lv], () => { if (!cs.ab2) cs.ab2 = true; else cs.ab2Lv++; if (c === G.cls) this.buildAbBar(); }); }
    });
    body.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => { const i = +b.dataset.sell, it = S.stash[i]; if (!it) return; S.stash.splice(i, 1); S.gold += it.value; G.persist(); G.sfx('coin'); this.renderPanel(); });
    const sa = $('sellAll'); if (sa) sa.onclick = () => { const t = S.stash.reduce((a, b) => a + b.value, 0); S.gold += t; S.stash = []; G.persist(); for (let i = 0; i < 4; i++) setTimeout(() => G.sfx('coin'), i * 80); this.toast(`Sold for ${t} gold`); this.renderPanel(); };
    body.querySelectorAll('[data-cls]').forEach(b => b.onclick = () => { G.cls = b.dataset.cls; G.store.set('dd_cls', G.cls); G.game.rebuildPlayerGear(true); G.sfx('level'); this.renderPanel(); });
    body.querySelectorAll('[data-dg]').forEach(b => b.onclick = () => { this.dgSel = b.dataset.dg; G.sfx('click'); this.renderPanel(); });
    const go = $('goDescend'); if (go) go.onclick = () => { const party = G.net.party; if (party) { const ms = G.net.members(), notReady = ms.filter(p => !p.sameTab && (p.presence.s !== 'hideout' || !p.presence.rd)); if (notReady.length && !this.forceArm) { this.toast(`${notReady.length} hero${notReady.length > 1 ? 'es aren\'t' : ' isn\'t'} ready. Press again to go anyway.`); this.forceArm = true; setTimeout(() => this.forceArm = false, 3000); return; } } this.forceArm = false; this.closePanel(); G.game.hostStartRun(this.dgSel || 'crypt'); };
    const rb = $('readyBtn'); if (rb) rb.onclick = () => { this.ready = !this.ready; G.net.pushPresence(true); G.sfx('click'); this.renderPanel(); };
  },
  startDrag(ev, el) {
    ev.preventDefault(); const i = +el.dataset.i, item = G.player.backpack[i], sx = ev.clientX, sy = ev.clientY; if (!item) return;
    const box = $('panelM').querySelector('.panelbox'), ghost = document.createElement('div'); ghost.className = 'dragGhost';
    ghost.innerHTML = `<img src="${G.dice.icon(item.model, item.v)}" alt=""><span>Drop</span>`; document.body.appendChild(ghost);
    el.classList.add('lifted'); box.classList.add('dropzone'); G.sfx('click');
    const move = e => { ghost.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`; const r = box.getBoundingClientRect(); const out = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom; ghost.classList.toggle('out', out); box.classList.toggle('armed', out); };
    const up = e => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); ghost.remove(); el.classList.remove('lifted'); box.classList.remove('dropzone', 'armed');
      const r = box.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { G.game.dropItem(i); this.selItem = -1; this.renderPanel(); G.ui.refreshRelics(); } else if (Math.hypot(e.clientX - sx, e.clientY - sy) < 8) { this.selItem = this.selItem === i ? -1 : i; this.renderPanel(); } };
    move(ev); addEventListener('pointermove', move); addEventListener('pointerup', up);
  },
  itemInfo(it, i) {
    const P = G.player, me = G.player;
    if (it.scroll) return `<div class="iteminfo"><h3>${esc(it.name)}</h3><p>Read it to learn the true nature of every magic item in your pack.</p><div class="row"><button class="btn small" data-act="read" data-i="${i}">Read the scroll</button></div></div>`;
    if (!it.magic) return `<div class="iteminfo"><h3>${esc(it.name)}</h3><p>Treasure. Sell it at the hideout merchant for ${it.value} gold.</p></div>`;
    const D = G.MAGIC[it.mid], att = P.backpack.filter(x => x.magic && x.attuned).length, cursedLocked = it.attuned && D.cursed;
    const idO = { skill: 'Investigation', dc: 12 + Math.floor((G.run.depth || 0) / 3) }, canId = !it.identified && it.idFail !== P.level;
    let h = `<div class="iteminfo ${it.identified && D.cursed ? 'cursed' : ''}"><h3>${it.identified ? `${D.icon} ${esc(D.name)}` : esc(it.name)}${it.attuned ? ' <span class="tag gold">Attuned</span>' : ''}</h3>`;
    h += `<p>${it.identified ? esc(D.desc) : 'Its magic hums against your palm, but its nature is hidden. Identify it, or attune to it and learn the hard way. Some items are cursed.'}</p><div class="row">`;
    if (canId && G.run.active) h += `<button class="btn small" data-act="ident" data-i="${i}">Identify ${G.game.chkLabel(idO)}</button>`;
    else if (!it.identified && G.run.active) h += `<span class="note">You failed to identify this. Try again after you level up, or read a scroll.</span>`;
    if (!it.attuned) h += `<button class="btn small ${att >= 3 ? '' : 'ghost'}" data-act="attune" data-i="${i}" ${att >= 3 ? 'disabled' : ''}>Attune (${att}/3)</button>`;
    else if (!cursedLocked) h += `<button class="btn small ghost" data-act="unattune" data-i="${i}">End attunement</button>`;
    else h += `<span class="note" style="color:#d070ff">Cursed. It will not let you go.</span>`;
    return h + '</div></div>';
  },
  sheetPanel(set) {
    const P = G.player, S = G.sheet; if (!P || !P.dnd) return '';
    const I = G.CLASS_INFO[P.cls], nx = G.XP_LV[P.level + 1];
    set('Character Sheet', `${I.name} · Level ${P.level}`, `${nx ? `${P.xp} / ${nx} XP` : 'Maximum level'} · Proficiency +${S.prof(P)} · Hit die d${P.dnd.hd} · ${P.dnd.weapon.name} ${S.weaponText(P)}`);
    let h = '';
    if (P.abPts > 0) h += `<p class="pts">You have <b>${P.abPts}</b> ability point${P.abPts > 1 ? 's' : ''} to spend. Each point raises a score by 1. Every 2 points of score is +1 to its modifier.</p>`;
    h += '<div class="abgrid">' + G.AB.map(ab => { const sc = S.score(P, ab), m = S.mod(P, ab), base = P.dnd.scores[ab] + P.abAdd[ab], nextMod = G.mod(sc + 1) > m;
      return `<div class="abcard ${P.dnd.weapon.ab === ab ? 'key' : ''}"><div class="abh"><span class="abn">${ab}<small>${G.AB_NAME[ab]}</small></span><span class="abs">${sc}</span><span class="abm">${G.fmt(m)}</span>${P.abPts > 0 && base < 20 ? `<button class="btn small plus" data-ab="${ab}" title="${nextMod ? 'Raises the modifier' : 'Next point raises the modifier'}">+1${nextMod ? ' ★' : ''}</button>` : ''}</div><ul>${S.effects(P, ab).map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`; }).join('') + '</div>';
    if (P.featPending > 0) { const pool = Object.entries(G.FEATS).filter(([id, f]) => !P.feats.includes(id) && (!f.cls || f.cls.includes(P.cls))); h += `<h3 class="sh">Choose a feat</h3><div class="featgrid">${pool.map(([id, f]) => `<button class="feat" data-feat="${id}"><b>${esc(f.name)}</b><span>${esc(f.desc)}</span></button>`).join('')}</div>`; }
    if (P.feats.length) h += `<h3 class="sh">Feats</h3><div class="taglist">${P.feats.map(id => `<span class="tagx" title="${esc(G.FEATS[id].desc)}"><b>${esc(G.FEATS[id].name)}</b> ${esc(G.FEATS[id].desc)}</span>`).join('')}</div>`;
    h += `<h3 class="sh">Combat</h3><div class="taglist"><span class="tagx"><b>Health</b> ${Math.ceil(P.hp)} / ${P.maxHp}</span><span class="tagx"><b>Critical chance</b> ${Math.round(S.critChance(P) * 100)}%</span><span class="tagx"><b>Damage reduction</b> ${Math.round(P.armor * 100)}%</span><span class="tagx"><b>Saves</b> ${G.AB.map(a => `${a} ${G.fmt(S.bonus(P, { ab: a, save: true }))}`).join(' · ')}</span>${P.hex ? `<span class="tagx bad"><b>Cursed</b> −${P.hex} to every check and save</span>` : ''}</div>`;
    if (P.relics.length) h += `<h3 class="sh">Relics</h3><div class="taglist">${P.relics.map(id => `<span class="tagx"><b>${G.RELICS[id].icon} ${esc(G.RELICS[id].name)}</b> ${esc(G.RELICS[id].desc)}</span>`).join('')}</div>`;
    const att = P.backpack.filter(it => it.magic && it.attuned); if (att.length) h += `<h3 class="sh">Attuned items</h3><div class="taglist">${att.map(it => `<span class="tagx ${G.MAGIC[it.mid].cursed ? 'bad' : ''}"><b>${G.MAGIC[it.mid].icon} ${esc(G.MAGIC[it.mid].name)}</b> ${esc(G.MAGIC[it.mid].desc)}</span>`).join('')}</div>`;
    return h;
  },
  shopPrice(base) { const P = G.player, m = Math.max(0, G.sheet.mod(P, 'CHA')); return Math.round(base * (1 - Math.min(0.25, m * 0.05)) * (P.relics.includes('scale') ? 0.75 : 1)); },
  shopPanel(set) {
    const P = G.player, W = G.World, sh = W.shop; if (!sh) return ''; const me = G.net.myId();
    set('Grimble the Peddler', 'Wares of the Deep', `Run gold: ${P.runGold}. Prices reflect your Charisma${P.relics.includes('scale') ? " and your Merchant's Scale" : ''}.`);
    return '<div class="shop">' + sh.stock.map((s, i) => { const price = this.shopPrice(s.price), sold = sh.bought[me + ':' + i];
      let ic, t, d; if (s.kind === 'relic') { const R = G.RELICS[s.relic]; ic = R.icon; t = `${R.name} <span class="tag gold">Relic</span>`; d = R.desc; } else if (s.kind === 'magic') { const D = G.MAGIC[s.item.mid]; ic = D.icon; t = `${D.name} <span class="tag">Magic item</span>`; d = D.desc; } else if (s.kind === 'scroll') { ic = '📜'; t = 'Scroll of Identify'; d = 'Reveals every magic item in your pack.'; } else if (s.kind === 'flask') { ic = '⚗'; t = 'Healing Flask'; d = 'One more flask for this run.'; } else { ic = '🎓'; t = 'Lessons from a Tutor'; d = '+1 ability point to spend.'; }
      return `<div class="shopitem"><div class="ic">${ic}</div><div style="min-width:0"><h3>${t}</h3><p>${esc(d)}</p></div>${sold ? '<span class="tag ok">Bought</span>' : `<button class="btn small" data-shop="${i}" ${P.runGold < price ? 'disabled' : ''}>${price} g</button>`}</div>`; }).join('') + '</div>';
  },
  restPanel(set) {
    const P = G.player, n = Math.ceil(P.level / 2) + 1, con = G.sheet.mod(P, 'CON');
    set('The Campfire', 'A Moment of Rest', 'You have time for one thing before the dungeon stirs again.');
    return `<div class="shop">
      <div class="shopitem"><div class="ic">🔥</div><div><h3>Short Rest</h3><p>Spend hit dice to recover: ${n}d${P.dnd.hd} ${G.fmt(con)} CON each.</p></div><button class="btn small" data-rest="heal">Rest</button></div>
      <div class="shopitem"><div class="ic">⚔</div><div><h3>Train</h3><p>Drill until your arms burn. +1 ability point.</p></div><button class="btn small" data-rest="train">Train</button></div>
      <div class="shopitem"><div class="ic">📖</div><div><h3>Study</h3><p>Pore over your finds by firelight. Identify every magic item you carry, +40 XP.</p></div><button class="btn small" data-rest="study">Study</button></div></div>`;
  },
  bindExtra(k, body) {
    const P = G.player;
    body.querySelectorAll('[data-ab]').forEach(b => b.onclick = () => { const ab = b.dataset.ab; if (P.abPts <= 0) return; P.abPts--; G.sheet.applyChange(P, () => P.abAdd[ab]++); G.sfx('level', 0.7); this.renderPanel(); this.refreshSheetBadge(); });
    body.querySelectorAll('[data-feat]').forEach(b => b.onclick = () => { const id = b.dataset.feat; if (P.featPending <= 0) return; P.featPending--; G.sheet.applyChange(P, () => P.feats.push(id)); if (id === 'lucky') P.luck = 3; G.sfx('crit20', 0.6); this.toast(`Feat learned: ${G.FEATS[id].name}`); this.renderPanel(); this.refreshSheetBadge(); });
    body.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
      const i = +b.dataset.i, it = P.backpack[i]; if (!it) return; const act = b.dataset.act;
      if (act === 'read') { const n = G.game.identifyAll(); P.backpack.splice(i, 1); this.selItem = -1; this.toast(n ? `The scroll crumbles. ${n} item${n > 1 ? 's' : ''} identified.` : 'The scroll crumbles. Nothing needed identifying.'); this.renderPanel(); return; }
      if (act === 'ident') { const o = { skill: 'Investigation', dc: 12 + Math.floor((G.run.depth || 0) / 3) }; $('panelM').hidden = true; G.dice.check(o, r => { if (r.success) { it.identified = true; G.sheet.gainXp(P, 15, 'identify'); this.toast(`It is a ${G.MAGIC[it.mid].name}`); } else it.idFail = P.level; this.openPanel('pack'); }); return; }
      if (act === 'attune') { if (P.backpack.filter(x => x.magic && x.attuned).length >= 3) return; const was = it.identified; G.sheet.applyChange(P, () => { it.attuned = true; it.identified = true; }); const D = G.MAGIC[it.mid]; G.sfx(D.cursed ? 'groan' : 'magic', 1); if (D.cursed) { G.dm.say(`The ${D.name.toLowerCase()} tightens around you. You cannot take it off.`); this.banner(D.name, 'Cursed'); } else this.toast(`${was ? '' : 'Attuning reveals it: '}${D.name}`); this.refreshRelics(); this.renderPanel(); return; }
      if (act === 'unattune') { G.sheet.applyChange(P, () => it.attuned = false); this.refreshRelics(); this.renderPanel(); }
    });
    body.querySelectorAll('[data-shop]').forEach(b => b.onclick = () => {
      const sh = G.World.shop, i = +b.dataset.shop, s = sh.stock[i], price = this.shopPrice(s.price), me = G.net.myId(); if (!s || sh.bought[me + ':' + i] || P.runGold < price) return;
      P.runGold -= price; sh.bought[me + ':' + i] = true; G.sfx('coin', 1);
      if (s.kind === 'relic') G.game.gainRelic(s.relic); else if (s.kind === 'magic') G.game.giveItem(Object.assign({}, s.item, { identified: true })); else if (s.kind === 'scroll') G.game.giveItem(G.SCROLL()); else if (s.kind === 'flask') { P.potions++; this.toast('+1 healing flask'); } else { P.abPts++; this.refreshSheetBadge(); this.toast('+1 ability point · press C'); }
      this.renderPanel();
    });
    body.querySelectorAll('[data-rest]').forEach(b => b.onclick = () => {
      const R = G.World.rest, me = G.net.myId(); if (!R || R.used[me]) return; R.used[me] = true; const k = b.dataset.rest;
      if (k === 'heal') { const n = Math.ceil(P.level / 2) + 1; let tot = 0; for (let j = 0; j < n; j++) tot += Math.max(1, G.d(P.dnd.hd) + G.sheet.mod(P, 'CON')); P.heal(tot); this.checkChip({ title: 'Short rest', icon: '🔥', line: `${n}d${P.dnd.hd} hit dice: recovered ${tot} health`, ok: true }); }
      if (k === 'train') { P.abPts++; this.refreshSheetBadge(); this.toast('+1 ability point · press C'); }
      if (k === 'study') { const n = G.game.identifyAll(); G.sheet.gainXp(P, 40, 'study'); this.toast(n ? `${n} item${n > 1 ? 's' : ''} identified` : 'Nothing to identify, but you learned a great deal'); }
      G.sfx('level', 0.6); this.closePanel();
    });
  },
  results(win, st) {
    this.openPanel('results'); this.panelKind = 'results';
    $('panelEye').textContent = G.DUNGEONS[st.dungeon].name; $('panelTitle').textContent = ''; $('panelSub').textContent = '';
    $('panelBody').innerHTML = `<div class="results"><h1 class="${win ? 'win' : 'lose'}">${win ? 'Victorious' : 'Fallen'}</h1><p class="sub" style="text-align:center">${esc(st.reason || '')}</p>
      <div class="rgrid"><div><b>${st.depth ?? 0}</b><span>Depth</span></div><div><b>${st.level || 1}</b><span>Level</span></div><div><b>${st.kills}</b><span>Kills</span></div><div><b>${st.bosses}</b><span>Bosses</span></div><div><b>${st.gold}</b><span>Gold kept${st.bounty ? ` (+${st.bounty} bounty)` : ''}</span></div><div><b>${st.items}</b><span>Loot kept</span></div></div>
      ${st.extracted ? '<p class="note" style="text-align:center">You extracted by party vote. Everything you carried came home with you.</p>' : ''}
      ${st.relics && st.relics.length ? `<p class="note" style="text-align:center">Relics carried: ${st.relics.map(id => `${G.RELICS[id].icon} ${esc(G.RELICS[id].name)}`).join(' · ')}</p>` : ''}
      ${st.upgrades.length ? `<p class="note" style="text-align:center">Upgrades this run: ${st.upgrades.map(u => `<span style="color:${G.TIERS[u.t].color}">${esc(u.name)}</span>`).join(' · ')}</p>` : ''}
      <div class="row" style="justify-content:center;margin-top:14px"><button class="btn" id="resOk">Return to Hideout</button></div></div>`;
    $('resOk').onclick = () => this.closePanel();
  }
};
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
