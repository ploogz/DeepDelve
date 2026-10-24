/* ============================================================
   Talking dungeon
   - party text chat: Enter to type, the line floats above your head for everyone and is
     read aloud in your chosen voice, from where you stand (muffled through walls)
   - NPCs, quest givers and inscriptions speak their dialog; the Dungeon Master narrates
   - monsters quip when you hit them, bosses taunt at the start and as they weaken
   ============================================================ */
'use strict';
(() => {
  const V = G.voice, $ = id => document.getElementById(id);
  const PLAYER_VOICES = ['hero', 'baritone', 'gravel', 'bard', 'lady', 'sorceress', 'sprite', 'shadow', 'golem'];
  V.P.abbess = { v: 'f5', p: 12, s: 120, r: 0.86, echo: 0.22, chorus: 1 };
  V.P.lich = { v: 'm7', p: 4, s: 120, r: 0.76, ring: 28, echo: 0.2, sub: 0.35 };
  V.P.cult = { v: 'whisper', p: 30, s: 140, r: 0.92, echo: 0.12, chorus: 1 }; V.P.eldritch = { v: 'm7', p: 0, s: 120, r: 0.7, ring: 45, echo: 0.2, sub: 0.45, chorus: 1 };
  V.P.queen = { v: 'whisperf', p: 40, s: 140, r: 0.84, ring: 55, echo: 0.12, sub: 0.3 };

  /* ---------------- who sounds like what ---------------- */
  V.forQuest = Q => ({ ghost: 'ghost', goblin: 'goblin', imp: 'imp', monk: /Ysolde/.test(Q.name) ? 'oracle' : 'monk', thrall: /Kessa/.test(Q.name) ? 'lady' : 'thrall' })[Q.look] || 'thrall';
  const FAM = {
    undead: ['skeleton', 'skelarcher', 'zombie', 'ghoul', 'wraith', 'revenant', 'tombguard', 'warden'],
    goblin: ['goblin', 'shaman'], imp: ['imp'], spider: ['spider', 'ensnarer', 'spiderqueen'],
    brute: ['orc', 'troll', 'minotaur', 'warlord', 'mimic'], demon: ['elemental', 'dragon', 'demonlord', 'forgetyrant'],
    stone: ['gargoyle', 'golem', 'colossus', 'shardling'], cult: ['cultist', 'binder', 'harbinger'], hollow: ['voidknight', 'hollowking'], eldritch: ['gazer', 'eldergazer', 'horror', 'devourer'], fungus: ['sporeling', 'mycelid'], abbess: ['abbess'], lich: ['lich']
  };
  const famOf = type => Object.keys(FAM).find(k => FAM[k].includes(type));
  const VOICE_OF = { cult: 'cult', hollow: 'lich', eldritch: 'eldritch', undead: 'undead', goblin: 'goblin', imp: 'imp', spider: 'spider', brute: 'brute', demon: 'demon', stone: 'stone', fungus: 'fungus', abbess: 'abbess', lich: 'lich' };
  V.forEnemy = e => e.type === 'spiderqueen' ? 'queen' : VOICE_OF[famOf(e.type)] || null;
  const QUIPS = {
    undead: ['Your bones will join mine.', 'I have waited centuries for warm blood.', 'Death is patient.', 'You cannot kill what is already dead.', 'Join us, in the dark.', 'Flesh is so weak.'],
    goblin: ['Ow! Stabby stab back!', 'Shinies! Give us the shinies!', 'Ha! Missed! Wait. No.', 'You smell like soap!', 'Boss! Boss, help!', 'Not the face!'],
    imp: ['Hee hee! Burn, burn!', 'That tickles! Again!', 'Your soul smells delicious.', 'Ow! Rude!', 'Catch me if you can!'],
    brute: ['Grah! Crush you!', 'That all you got?', 'Me smash tiny one!', 'You hit like goblin.', 'Bones break. Your bones.'],
    demon: ['Kneel, mortal.', 'Your pain is music.', 'I will wear your skull.', 'The fire hungers for you.', 'Pathetic.'],
    spider: ['So warm. So tasty.', 'Into the web you go.', 'Many eyes see you.', 'Squeal for me.'],
    fungus: ['Grow with us.', 'Rot is patient.', 'Breathe deep, little meat.'],
    stone: ['I do not break.', 'Stone remembers.', 'You chip. I endure.'],
    abbess: ['Hush now, child.', 'The water is so cold. Come and see.'],
    cult: ['The deep remembers you.', 'Kneel, and be emptied.', 'Your light will go out.', 'We are the door.'], hollow: ['There is nothing inside.', 'My oath outlived my flesh.', 'Turn back.'], eldritch: ['I see you.', 'Little light. Little light.', 'Come closer.'], lich: ['Insolence.', 'I have buried kings.']
  };
  const BOSS = {
    colossus: ['Who wakes the stone?', 'Cracks. Only cracks.', 'I fall... the hall falls with me!', 'Return... to dust.'],
    lich: ['Kneel before Malthus, last of the living kings.', 'You think pain can end me? I am beyond pain.', 'My phylactery... no! I will drag you down with me!', 'This is not... the end... of Malthus.'],
    spiderqueen: ['More meat for my children.', 'You have killed my young. I will have yours.', 'My brood! Devour them!', 'My children... avenge me...'],
    warlord: ['Fresh blood for the warband!', 'Good! A real fight at last!', 'Bring every blade! Kill them!', 'Ha... a good death...'],
    dragon: ['You dare enter my hoard?', 'Your armour will melt like wax.', 'Enough! Burn, all of you, burn!', 'The flame... goes out...'],
    demonlord: ['At last. Souls worth the taking.', 'You only make me stronger.', 'I am eternal! I am the forge!', 'This realm... is not... yours...'],
    abbess: ['Have you come to pray with me?', 'The tide is rising, child.', 'Drown with me. Drown with me forever.', 'Finally... silence.'],
    mycelid: ['You walk in my garden, little meat.', 'Every wound blooms.', 'My spores are in your lungs already.', 'We... will... grow again.'],
    eldergazer: ['I have watched you since the first stair.', 'Look at me. Look at me!', 'Close your eyes. It will not help.', 'Darkness... at last.'],
    harbinger: ['The Deep sends its regards.', 'Every wound is a doorway.', 'Open! Open the way!', 'He will still come for you...'],
    hollowking: ['Kneel before the last crown.', 'My kingdom drowned. So will you.', 'Rise, my hollow host! Rise!', 'At last... I may rest.'],
    devourer: ['Hungry.', 'So small. So bright. So hungry.', 'COME INTO THE DARK.', 'Not... the end... only... sleep.'],
    forgetyrant: ['Back to the anvil, slaves!', 'I will hammer you flat.', 'Stoke the fires! Hotter!', 'The forge... goes cold.']
  };
  // speak a line from an enemy, with a bubble above its head
  V.enemyLine = function (e, text, vol = 1) {
    const pr = this.forEnemy(e); if (!pr) return;
    const h = e.def.h * (e.scale || 1) + 0.9; this.bubble(e.root, text, h, 2.5 + text.length * 0.05);
    this.say(text, pr, { at: () => e.pos, vol, prio: e.boss ? 'npc' : 'quip', key: 'e' + e.id });
  };
  V.taunt = function (e) {
    if (!e || e.dead || e.boss || !this.enabled()) return; const now = G.now(); if (now - (this.tauntT || 0) < 7 || now - (e.tauntT || -99) < 15 || Math.random() > 0.28) return;
    const fam = famOf(e.type), list = QUIPS[fam]; if (!list) return; this.tauntT = e.tauntT = now;
    setTimeout(() => { if (!e.dead) this.enemyLine(e, G.pick(list), 1.1); }, 150 + Math.random() * 300);
  };
  // boss intro, 50% and 25% health, death
  V.bossWatch = function () {
    const b = G.enemies && G.enemies.boss; if (!b || !b.announced) return; const L = BOSS[b.type]; if (!L) return; b.said = b.said || {};
    const k = b.hp / b.maxHp;
    if (!b.said.i) { b.said.i = 1; setTimeout(() => this.enemyLine(b, L[0], 1.4), 1200); return; }
    if (b.dead) { if (!b.said.d) { b.said.d = 1; this.enemyLine(b, L[3], 1.4); } return; }
    if (k < 0.5 && !b.said.h) { b.said.h = 1; this.enemyLine(b, L[1], 1.4); }
    if (k < 0.25 && !b.said.q) { b.said.q = 1; this.enemyLine(b, L[2], 1.4); }
  };

  /* ---------------- dialog, events and the Dungeon Master ---------------- */
  const dOpen = G.dialog.open;
  G.dialog.open = function (o) {
    dOpen.call(this, o);
    const npc = !!o.voice; if (!npc && G.settings.narrator === false) return;
    V.say(o.text, o.voice || 'narrator', { at: o.at || null, prio: 'npc', key: 'dlg' });
  };
  const dmNext = G.dm.next;
  G.dm.next = function () { const it = this.q[0]; dmNext.call(this); if (it && this.showing && G.settings.narrator !== false && G.state === 'play') V.say(it.text, 'narrator', { prio: 'narr', key: 'narr' }); };
  if (G.events && G.events.type) { const eType = G.events.type; G.events.type = function (text, done) { eType.call(this, text, done); if (G.settings.narrator !== false) V.say(text, 'narrator', { prio: 'npc', key: 'dlg' }); }; }
  // a talking window that closes takes its voice with it
  V.dlgWatch = function () {
    if (!this.active.some(v => v.key === 'dlg')) return;
    const open = G.dialog.isOpen() || ($('dmCard') && !$('dmCard').hidden) || (G.dice.isOpen && G.dice.isOpen());
    if (!open) this.active.filter(v => v.key === 'dlg').forEach(v => this.stop(v));
  };

  /* ---------------- party chat ---------------- */
  G.chat = {
    lines: [], max: 140,
    init() {
      if (this.el) return;
      const st = document.createElement('style'); st.textContent = `
#chat { position: fixed; left: 22px; bottom: 210px; width: min(400px, calc(100vw - 44px)); z-index: 30; pointer-events: none; font-family: var(--body); }
#chatLog { display: flex; flex-direction: column; gap: 3px; max-height: 210px; overflow: hidden; justify-content: flex-end; }
#chatLog .cl { background: rgba(10,8,14,.62); border-left: 2px solid var(--gilt, #c9a24a); padding: 4px 9px; font-size: 14px; line-height: 1.35; color: #f0e4c8; border-radius: 0 6px 6px 0; transition: opacity .8s; text-shadow: 0 1px 2px #000; overflow-wrap: anywhere; }
#chatLog .cl b { color: var(--cc, #e8c070); font-weight: 600; margin-right: 6px; }
#chatLog .cl.far::after { content: ' · elsewhere'; font-size: 11px; opacity: .55; }
#chatLog .cl.fade { opacity: 0; }
#chat.open #chatLog .cl.fade { opacity: .85; }
#chatBox { display: none; margin-top: 6px; pointer-events: auto; position: relative; }
#chat.open #chatBox { display: block; }
#chatIn { width: 100%; box-sizing: border-box; background: rgba(12,9,16,.9); border: 1px solid var(--gilt, #c9a24a); color: #f6ead0; font: 15px var(--body); padding: 8px 52px 8px 10px; border-radius: 6px; outline: none; }
#chatIn:focus { box-shadow: 0 0 0 2px rgba(201,162,74,.35); }
#chatCnt { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 11px; color: #a89878; }
#chatHint { font-size: 11px; color: #a89878; margin-top: 3px; letter-spacing: .04em; }
@media (max-width: 700px) { #chat { bottom: 170px; } }`;
      document.head.appendChild(st);
      const el = this.el = document.createElement('div'); el.id = 'chat';
      el.innerHTML = '<div id="chatLog" aria-live="polite"></div><div id="chatBox"><input id="chatIn" maxlength="140" autocomplete="off" spellcheck="true" placeholder="Say something to your party"><span id="chatCnt">140</span><div id="chatHint">Enter to send · Esc to cancel · read aloud in your voice</div></div>';
      document.body.appendChild(el); this.log = $('chatLog'); this.inp = $('chatIn');
      this.inp.addEventListener('input', () => { $('chatCnt').textContent = this.max - this.inp.value.length; });
      this.inp.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); const t = this.inp.value.trim(); this.close(); if (t) this.send(t); }
        else if (e.key === 'Escape') { e.preventDefault(); this.close(); }
      });
      this.inp.addEventListener('blur', () => { if (this.isOpen) setTimeout(() => { if (this.isOpen && document.activeElement !== this.inp) this.close(); }, 50); });
      addEventListener('keydown', e => {
        if (e.key !== 'Enter' || this.isOpen || e.repeat) return;
        if (G.state !== 'play' || G.loading || (G.ui.modalOpen && G.ui.modalOpen()) || (G.n64 && G.n64.sitting)) return;   // Enter is START while you hold a Skull-64 controller
        if (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
        e.preventDefault(); this.open();
      });
    },
    open() { this.isOpen = true; this.el.classList.add('open'); G.keys = {}; this.inp.value = ''; $('chatCnt').textContent = this.max; setTimeout(() => this.inp.focus(), 0); },
    close() { this.isOpen = false; this.el.classList.remove('open'); this.inp.blur(); G.keys = {}; },
    send(text) {
      text = text.replace(/\s+/g, ' ').slice(0, this.max); const now = G.now(); if (now - (this.sentT || -9) < 0.7) return; this.sentT = now;
      const v = V.myPreset(); G.net.emit('chat', { t: text, v });
      this.show(G.settings.name || 'You', text, G.cls, false);
      const P = G.player; if (P && P.tpBody && P.tpBody.root.visible) V.bubble(P.tpBody.root, text, 2.95);
      if (G.settings.hearSelf !== false) V.say(text, v, { prio: 'chat', vol: 0.6, key: 'chatme' });
    },
    receive(d, peer) {
      if (!d || typeof d.t !== 'string') return; const text = d.t.replace(/\s+/g, ' ').trim().slice(0, this.max); if (!text) return;
      const m = G.net.members().find(p => p.peer === peer), pr = (m && m.presence) || {}, name = String(pr.n || 'Adventurer').slice(0, 20), cls = G.CLASSES.includes(pr.c) ? pr.c : 'knight';
      const voice = PLAYER_VOICES.includes(d.v) ? d.v : V.CLASS[cls] || 'hero', r = G.net.remotes[peer], here = !!(r && r.root.visible && G.state === 'play');
      this.show(name, text, cls, !here);
      if (here) { V.bubble(r.root, text, 2.95); V.say(text, voice, { at: () => r.pos, prio: 'chat', key: 'chat' + peer, vol: 1.15 }); }
      else V.say(text, voice, { radio: true, prio: 'chat', key: 'chat' + peer });
      G.sfx('click', 0.25);
    },
    show(name, text, cls, far) {
      if (!this.el) return; const d = document.createElement('div'); d.className = 'cl' + (far ? ' far' : '');
      const I = G.CLASS_INFO && G.CLASS_INFO[cls]; if (I && I.color) d.style.setProperty('--cc', I.color);
      const b = document.createElement('b'); b.textContent = name; d.appendChild(b); d.appendChild(document.createTextNode(text));
      this.log.appendChild(d); while (this.log.children.length > 8) this.log.firstChild.remove();
      setTimeout(() => d.classList.add('fade'), 12000);
    }
  };

  /* ---------------- per-frame ---------------- */
  V.tick = function (dt) { this.update(); this.updateBubbles(dt); this.bossWatch(); this.dlgWatch(); };
})();
