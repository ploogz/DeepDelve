/* ============================================================
   Event rooms: the Dungeon Master sets a scene, you choose,
   the dice decide. Every option names its check before you roll.
   ============================================================ */
'use strict';
// helpers used by event outcomes (all local to the acting player)
G.ev = {
  P: () => G.player,
  dc: (n) => n + Math.floor((G.run.depth || 0) / 3),
  xp(n) { G.sheet.gainXp(G.player, n, 'event'); return `+${n} XP`; },
  gold(n) { const P = G.player; P.runGold = Math.max(0, P.runGold + n); G.sfx('coin', 0.8); return n >= 0 ? `+${n} gold` : `${n} gold`; },
  points(n) { const P = G.player; P.abPts += n; G.ui.refreshSheetBadge(); G.sfx('level', 0.8); return `+${n} ability point${n > 1 ? 's' : ''} (press C)`; },
  score(ab, n) { const P = G.player; G.sheet.applyChange(P, () => P.abAdd[ab] += n); return `${G.fmt(n)} ${G.AB_NAME[ab]}`; },
  hex(n) { const P = G.player; P.hex += n; G.sfx('groan', 0.6); return `${G.fmt(-n)} to every check and save this run`; },
  hurt(n, type) { const P = G.player; P.takeDamage(n, P.pos, { unblockable: true, type: type || 'phys' }); return `${n} damage`; },
  poison(dice) { const P = G.player; const t = G.rollN(dice, 6); P.addDot(t / 4, 4, 'poison'); return `${t} poison over 4 seconds`; },
  item(it) { G.game.giveItem(it); return it.magic ? G.magicName(it) : it.name; },
  magic(o = {}) { const it = G.makeMagic(); if (o.cleanOnly && G.MAGIC[it.mid].cursed) return this.magic(o); if (o.mid) { it.mid = o.mid; const B = G.MAGIC_BASE[G.MAGIC[o.mid].base]; it.name = B[0]; it.model = B[1]; it.v = B[2]; } if (o.identified) it.identified = true; G.game.giveItem(it); return o.identified ? G.MAGIC[it.mid].name : 'an unidentified ' + it.model; },
  relic() { const id = G.rollRelic(Math.random, G.player.relics); G.game.gainRelic(id); return `the ${G.RELICS[id].name}`; },
  scroll() { G.game.giveItem(G.SCROLL()); return 'a Scroll of Identify'; },
  reveal() { G.run.reveal = G.run.step; G.game.revealFloor(); return 'traps, secrets and keys on this level are marked on your map'; },
  key() { G.run.keys++; G.net.sendFx({ k: 'keyget' }); G.sfx('pickup', 1); return 'a vault key'; },
  identifyAll() { const n = G.game.identifyAll(); return n ? `${n} item${n > 1 ? 's' : ''} identified` : 'nothing in your pack needed identifying'; },
  ambush(n, elite) { const ev = G.events.cur; const dg = G.DUNGEONS[G.run.dungeon]; const types = []; for (let i = 0; i < n; i++) types.push(elite && i === 0 ? dg.enemies[3] : G.pick(dg.enemies.slice(0, 3))); G.game.ambush(ev ? ev.x : G.player.pos.x, ev ? ev.z : G.player.pos.z, types, elite); return elite ? 'something terrible answers' : 'they come for you'; },
  cursed() { setTimeout(() => G.dice.offerCursed('The ink is still wet. Choose your price.'), 300); return 'the contract binds you'; }
};

G.EVENTS = {
  shrine: {
    name: 'The Forgotten Shrine', model: 'shrine', solid: 1.2,
    text: 'A statue of a nameless saint kneels over a slumped skeleton. Clutched in the dead pilgrim\'s fingers is an amulet, faintly warm. The candles still burn. Someone, or something, keeps them lit.',
    options: [
      { label: 'Pray at the statue', skill: 'Religion', dc: 13, go: (r, E) => r.nat20 ? `The saint's light floods through you. ${E.points(2)}, ${E.xp(40)}.` : r.success ? `Warmth settles in your chest. The saint remembers you. ${E.points(1)}, ${E.xp(30)}.` : r.nat1 ? `The candles gutter out together. Something cold settles on your shoulders. ${E.hex(1)}.` : 'Silence. The saint does not answer.' },
      { label: 'Take the pilgrim\'s amulet', go: (r, E) => { const a = E.magic(); if (Math.random() < 0.45) return `You pry the amulet free. You take ${a}. The skeleton's jaw falls open, and the room fills with the clatter of bones. ${E.ambush(2)}.`; return `You pry the amulet loose. You take ${a}. Nothing stirs. This time.`; } },
      { label: 'Leave it in peace', leave: true }
    ]
  },
  well: {
    name: 'The Wishing Well', model: 'well', solid: 1.3,
    text: 'An old well, its stones slick with moss. Coins glimmer far below in black water. A voice, or perhaps the echo of your own breath, whispers: make a wish.',
    options: [
      { label: 'Toss in 25 gold and wish', skill: 'Persuasion', dc: 12, cost: 25, go: (r, E) => r.nat20 ? `The water turns to light. Something rises into your palm: ${E.relic()}.` : r.success ? `The water ripples gold. ${E.gold(75)}, ${E.xp(40)}.` : r.nat1 ? `Something in the water takes the coin, then climbs up after more. ${E.ambush(1, true)}.` : 'Plink. The coin sinks. Nothing else happens.' },
      { label: 'Climb down for the coins', skill: 'Athletics', dc: 14, go: (r, E) => r.success ? `You inch down the slick stones and come back up heavier. ${E.gold(60)}, and you find ${E.magic()}.` : `Your grip fails. You crack against the stones on the way down. ${E.hurt(G.rollN(2, 6))}.` },
      { label: 'Walk away', leave: true }
    ]
  },
  gambler: {
    name: 'The Imp Gambler', model: 'gambler', solid: 1.2,
    text: 'An imp lounges behind a card table, shuffling a deck of bone cards. "A wager, mortal? Double or nothing. Or perhaps something more interesting?" Its tail flicks toward a contract signed in something red.',
    options: [
      { label: 'Wager 40 gold on a dice duel', skill: 'Persuasion', dc: 'imp', cost: 40, go: (r, E) => r.success ? `The imp curses in a language that smells of sulphur and pays up. ${E.gold(80)}, ${E.xp(20)}.` : 'The imp cackles and sweeps your coins away.' },
      { label: 'Sign the contract', go: (r, E) => `You sign. The imp grins far too wide. ${E.cursed()}.` },
      { label: 'Accuse it of cheating', skill: 'Insight', dc: 14, go: (r, E) => r.success ? `You spot the marked cards. Embarrassed, the imp pays you to keep quiet. ${E.gold(50)}, ${E.xp(30)}.` : `The imp hisses, vanishes, and the shadows come for you. ${E.ambush(2)}.` },
      { label: 'Decline', leave: true }
    ]
  },
  caged: {
    name: 'The Caged Prisoner', model: 'caged', solid: 0.9,
    text: 'A hooded figure crouches in a hanging cage. "Please. They\'re coming back for me. Get me out and I\'ll tell you everything I know about this place."',
    options: [
      { label: 'Pick the cage lock', skill: "Thieves' Tools", dc: 13, adv: P => P.cls === 'rogue', go: (r, E) => r.success ? `The cage swings open. The prisoner presses something into your hand and whispers the dungeon's secrets: ${E.reveal()}. You receive ${E.key()}. ${E.xp(40)}.` : r.nat1 ? `Your pick snaps loudly in the lock. Something heard that. ${E.ambush(2)}.` : 'The lock is rusted solid. Your tools find no purchase.' },
      { label: 'Wrench the bars apart', skill: 'Athletics', dc: 15, go: (r, E) => r.success ? `Iron shrieks and gives. The grateful prisoner hands you ${E.key()} and tells you ${E.reveal()}. ${E.xp(40)}.` : `The bars hold. The noise carries down the halls. ${E.ambush(2)}.` },
      { label: 'Question them through the bars', skill: 'Insight', dc: 11, go: (r, E) => r.success ? `Their story checks out, and they tell you where to look: ${E.reveal()}. ${E.xp(20)}.` : 'They\'re lying about something. You can\'t tell which parts.' },
      { label: 'Leave them', leave: true }
    ]
  },
  alchemy: {
    name: 'The Abandoned Laboratory', model: 'alchemy', solid: 1.3,
    text: 'Glassware glitters across a scorched workbench. A cauldron still bubbles with something violet, and beside it lies a stack of half-burned notes and a sealed scroll.',
    options: [
      { label: 'Study the notes', skill: 'Investigation', dc: 12, go: (r, E) => r.success ? `The notes are a field guide to enchantment. ${E.identifyAll()}. ${E.xp(25)}.` : 'The handwriting is a disaster. You learn nothing useful.' },
      { label: 'Drink from the cauldron', ab: 'CON', save: true, dc: 13, go: (r, E) => r.success ? `It burns going down, then settles into your bones. ${E.score('CON', 1)} for this run.` : r.nat1 ? `Your blood turns to fire. ${E.poison(4)}, and ${E.hex(1)}.` : `Your stomach heaves. ${E.poison(3)}.` },
      { label: 'Take the sealed scroll', go: (r, E) => `You tuck away ${E.scroll()}.` },
      { label: 'Leave', leave: true }
    ]
  },
  throne: {
    name: 'The Bone Throne', model: 'throne', solid: 1.4,
    text: 'A throne of fused skulls rises from a carpet of bones. A green gem burns in its crown, pulsing like a slow heartbeat. The skulls\' eyes seem to follow you.',
    options: [
      { label: 'Sit upon the throne', ab: 'CHA', save: true, dc: 14, go: (r, E) => r.success ? `The dead bow their heads. Their king's last treasure is yours: ${E.relic()}.` : r.nat1 ? `The skulls scream, and the bones rise to answer. ${E.ambush(3)}.` : `The skulls scream. Their curse sinks into you. ${E.hex(1)}.` },
      { label: 'Pry out the burning gem', skill: "Thieves' Tools", dc: 13, adv: P => P.cls === 'rogue', go: (r, E) => r.success ? `The gem pops free into your palm. You take the ${E.item({ id: 'throneGem', name: 'Throne Emerald', model: 'gem', v: 2, value: 150 })}. ${E.xp(20)}.` : `The gem holds fast, and the bones begin to stir. ${E.ambush(3)}.` },
      { label: 'Leave the dead their throne', leave: true }
    ]
  },
  knight: {
    name: 'The Dying Knight', model: 'knight', solid: 1.0,
    text: 'A knight lies against the wall in a spreading pool of blood, sword still in hand. His breath rattles. "You\'re going further down. Take what I can give you."',
    options: [
      { label: 'Hear his last words', skill: 'Insight', dc: 10, go: (r, E) => r.success ? `With his last breath he describes the halls ahead: ${E.reveal()}. ${E.xp(60)}.` : `His words are lost to fever. ${E.xp(20)}.` },
      { label: 'Ease his passing', skill: 'Religion', dc: 12, go: (r, E) => r.success ? `He dies at peace. Something of his strength passes to you. ${E.points(1)}, ${E.xp(30)}.` : 'He dies afraid. You carry that with you.' },
      { label: 'Take his sword', go: (r, E) => `You pry the blade from his fingers. You take the ${E.item({ id: 'knightBlade', name: "Fallen Knight's Blade", model: 'idol', v: 0, value: 110 })}. His dying glare follows you. ${E.hex(1)}.` },
      { label: 'Leave him', leave: true }
    ]
  },
  sarcophagus: {
    name: 'The Rune-Sealed Sarcophagus', model: 'sarcophagus', solid: 1.3,
    text: 'Glowing runes crawl across the lid of a great stone coffin. The seal is old, and it is failing. Whatever lies inside was buried with treasure, or buried for a reason.',
    options: [
      { label: 'Read the runes of unbinding', skill: 'Arcana', dc: 14, adv: P => P.cls === 'wizard', go: (r, E) => r.success ? `You speak the words, and the lid slides aside peacefully. ${E.gold(80)}, and you find ${E.magic()}. ${E.xp(40)}.` : `The runes flare white. The occupant is awake. ${E.ambush(1, true)}.` },
      { label: 'Force the lid', skill: 'Athletics', dc: 15, go: (r, E) => r.success ? `Stone grinds on stone. ${E.gold(60)}, and you find ${E.magic()}. The runes dim, angry.` : `The lid slips and crushes your hand. ${E.hurt(G.rollN(3, 6))}.` },
      { label: 'Let it rest', leave: true }
    ]
  },
  mirror: {
    name: 'The Mirror of Fates', model: 'mirror', solid: 0.9,
    text: 'A tall mirror in a gilded frame. Your reflection moves half a second late, and it is smiling. You are not.',
    options: [
      { label: 'Gaze into the glass', ab: 'WIS', save: true, dc: 13, go: (r, E) => r.success ? `You see every path ahead, and you choose. ${E.points(2)}.` : `Your reflection steps out of the glass, and it wants your place. ${E.ambush(1, true)}.` },
      { label: 'Shatter the mirror', go: (r, E) => `Glass explodes across the floor. You gather the ${E.item({ id: 'shards', name: 'Silvered Mirror Shards', model: 'gem', v: 1, value: 60 })}. Seven years of bad luck, give or take: ${E.hex(1)}.` },
      { label: 'Look away', leave: true }
    ]
  },
  merc: {
    name: 'The Veteran Sellsword', model: 'merc', solid: 1.4,
    text: 'A scarred barbarian sharpens an axe beside a battered training dummy. "Going deeper? Ha. Show me you won\'t die on the first stair."',
    options: [
      { label: 'Spar with him', skill: 'Athletics', dc: 13, go: (r, E) => { const ab = G.player.dnd.weapon.ab; return r.success ? `You land a clean blow, and he laughs and shows you a trick. ${E.score(ab, 1)}, ${E.xp(60)}.` : `He knocks you flat. "Again, when you've grown." ${E.hurt(G.rollN(2, 6))}, ${E.xp(25)}.`; } },
      { label: 'Buy his whetstone (60 gold)', cost: 60, go: (r, E) => `"Keep it sharp." You receive the ${E.magic({ mid: 'vicious', identified: true })}.` },
      { label: 'Ask for advice', skill: 'Persuasion', dc: 12, go: (r, E) => r.success ? `He draws a rough map in the dust: ${E.reveal()}. ${E.xp(30)}.` : '"Advice? Don\'t die." He goes back to his axe.' },
      { label: 'Move on', leave: true }
    ]
  }
};
G.SCROLL = () => ({ id: 'scrollId', scroll: true, name: 'Scroll of Identify', model: 'scroll', v: 0, value: 20 });

/* ---------------- the Dungeon Master's card ---------------- */
G.events = {
  cur: null,
  open(ev) {
    const P = G.player, me = G.net.myId(); if (!P) return;
    if (ev.used[me]) { G.ui.toast('You have already dealt with this'); return; }
    this.cur = ev; G.ui.releasePointer();
    const E = ev.def, el = document.getElementById('dmCard'); el.hidden = false;
    document.getElementById('dmcTitle').textContent = E.name;
    this.type(E.text, () => this.renderOpts(ev));
    G.sfx('portal', 0.3);
  },
  type(text, done) {
    const tx = document.getElementById('dmcText'), opts = document.getElementById('dmcOpts'); opts.innerHTML = ''; tx.textContent = ''; let i = 0; clearInterval(this.tw);
    this.tw = setInterval(() => { i += 2; tx.textContent = text.slice(0, i); if (i >= text.length) { clearInterval(this.tw); done && done(); } }, 18);
    this.skip = () => { clearInterval(this.tw); tx.textContent = text; done && done(); this.skip = null; };
  },
  checkLabel(o) {
    const P = G.player, ab = o.ab || G.SKILLS[o.skill], b = G.sheet.bonus(P, { skill: o.skill, ab: o.ab, save: o.save }) + (P.relics.includes('bonedice') ? 1 : 0);
    const adv = G.sheet.advantage(P, { skill: o.skill, save: o.save, adv: o.adv && o.adv(P) }).adv;
    const dc = o.dc === 'imp' ? 'vs the imp' : `DC ${G.ev.dc(o.dc)}`;
    return `${o.skill || G.AB_NAME[ab] + (o.save ? ' save' : '')} · ${ab} ${G.fmt(b)} · ${dc}${adv ? ' · Advantage' : ''}`;
  },
  renderOpts(ev) {
    const P = G.player, opts = document.getElementById('dmcOpts'); opts.innerHTML = '';
    ev.def.options.forEach((o, k) => {
      const b = document.createElement('button'); b.className = 'dlg-opt' + (k === 0 ? ' primary' : '');
      const poor = o.cost && P.runGold < o.cost;
      b.innerHTML = `<span class="key">${k + 1}</span><span>${esc(o.label)}${o.cost ? ` <em class="cost">${o.cost} g</em>` : ''}${o.dc ? `<small class="chk">${esc(this.checkLabel(o))}</small>` : ''}</span>`;
      if (poor) b.disabled = true;
      b.onclick = () => { G.sfx('click'); this.choose(ev, o); };
      opts.appendChild(b);
    });
  },
  choose(ev, o) {
    const P = G.player, me = G.net.myId(), E = G.ev;
    if (o.leave) { this.close(); return; }
    if (o.cost) { if (P.runGold < o.cost) return; P.runGold -= o.cost; G.sfx('coin', 0.7); }
    ev.used[me] = true;
    const finish = (res) => {
      let txt = ''; try { txt = o.go(res || {}, E); } catch (err) { console.warn(err); txt = 'The moment passes.'; }
      if (res && res.success && o.dc) G.sheet.gainXp(P, 15, 'check');
      document.getElementById('dmCard').hidden = false;
      this.type(txt, () => { const opts = document.getElementById('dmcOpts'); opts.innerHTML = ''; const b = document.createElement('button'); b.className = 'dlg-opt primary'; b.innerHTML = '<span class="key">1</span>Continue'; b.onclick = () => this.close(); opts.appendChild(b); });
      G.dm.say(txt.split('. ')[0] + '.');
    };
    if (!o.dc) { finish(null); return; }
    let dc = o.dc === 'imp' ? 3 + G.d(20) : G.ev.dc(o.dc);
    document.getElementById('dmCard').hidden = true;
    G.dice.check({ skill: o.skill, ab: o.ab, save: o.save, dc, adv: o.adv && o.adv(P), title: o.dc === 'imp' ? `The imp rolled ${dc - 3} + 3` : null }, finish);
  },
  close() { clearInterval(this.tw); document.getElementById('dmCard').hidden = true; this.cur = null; G.ui.lockSoon(); },
  isOpen() { return !document.getElementById('dmCard').hidden || (this.cur && G.dice.isOpen()); }
};
addEventListener('keydown', e => {
  if (document.getElementById('dmCard').hidden) return;
  if (e.code === 'Space' || e.code === 'KeyE') { G.events.skip && G.events.skip(); }
  const n = parseInt(e.key); if (n >= 1 && n <= 4) { const b = document.querySelectorAll('#dmcOpts .dlg-opt')[n - 1]; if (b && !b.disabled) b.click(); }
  if (e.code === 'Escape') G.events.close();
});
