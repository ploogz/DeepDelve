/* ============================================================
   D&D core: ability scores, proficiency, dice, checks & saves,
   XP and levels, feats, relics, magic items, the narrator
   ============================================================ */
'use strict';
G.AB = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
G.AB_NAME = { STR: 'Strength', DEX: 'Dexterity', CON: 'Constitution', INT: 'Intelligence', WIS: 'Wisdom', CHA: 'Charisma' };
G.mod = s => Math.floor((s - 10) / 2);
G.fmt = n => (n >= 0 ? '+' : '') + n;
G.SKILLS = { Athletics: 'STR', Acrobatics: 'DEX', "Thieves' Tools": 'DEX', Endurance: 'CON', Arcana: 'INT', Investigation: 'INT', Perception: 'WIS', Religion: 'WIS', Insight: 'WIS', Medicine: 'WIS', Persuasion: 'CHA', Intimidation: 'CHA' };
// per-class sheet: starting scores, hit die, weapon dice, proficiencies
G.DND = {
  knight: { scores: { STR: 16, DEX: 10, CON: 15, INT: 9, WIS: 12, CHA: 13 }, hd: 10, base: 40, weapon: { name: 'Longsword', n: 1, d: 8, ab: 'STR', type: 'slash' }, skills: ['Athletics', 'Persuasion', 'Endurance'], saves: ['STR', 'CON'] },
  barbarian: { scores: { STR: 17, DEX: 13, CON: 15, INT: 8, WIS: 11, CHA: 9 }, hd: 12, base: 44, weapon: { name: 'Greataxe', n: 1, d: 12, ab: 'STR', type: 'slash' }, skills: ['Athletics', 'Endurance', 'Intimidation'], saves: ['STR', 'CON'] },
  rogue: { scores: { STR: 10, DEX: 17, CON: 13, INT: 12, WIS: 11, CHA: 14 }, hd: 8, base: 28, weapon: { name: 'Twin Daggers', n: 1, d: 4, ab: 'DEX', type: 'pierce' }, skills: ["Thieves' Tools", 'Acrobatics', 'Investigation', 'Persuasion'], saves: ['DEX', 'INT'] },
  archer: { scores: { STR: 11, DEX: 17, CON: 13, INT: 10, WIS: 14, CHA: 9 }, hd: 8, base: 30, weapon: { name: 'Longbow', n: 1, d: 8, ab: 'DEX', type: 'pierce' }, skills: ['Perception', 'Acrobatics', "Thieves' Tools"], saves: ['DEX', 'WIS'] },
  wizard: { scores: { STR: 8, DEX: 13, CON: 12, INT: 17, WIS: 13, CHA: 10 }, hd: 6, base: 24, weapon: { name: 'Firebolt', n: 1, d: 10, ab: 'INT', type: 'fire', spell: true }, skills: ['Arcana', 'Investigation'], saves: ['INT', 'WIS'] },
  priest: { scores: { STR: 12, DEX: 9, CON: 14, INT: 10, WIS: 17, CHA: 13 }, hd: 8, base: 32, weapon: { name: 'Mace', n: 1, d: 6, ab: 'STR', type: 'blunt' }, skills: ['Religion', 'Insight', 'Persuasion', 'Medicine'], saves: ['WIS', 'CHA'] }
};
// ability dice: [n, sides, ability, extra-die-per-rank]
G.ABIL_DICE = {
  knight: { q: [2, 6, 'STR'], r: [2, 8, 'STR', 1] }, barbarian: { r: [3, 8, 'STR', 1] }, rogue: { r: [1, 4, 'DEX'] },
  archer: { q: [1, 6, 'DEX'], r: [2, 8, 'DEX', 1] }, wizard: { q: [2, 6, 'INT'], r: [3, 8, 'INT', 1] }, priest: { q: [2, 8, 'WIS'], r: [3, 8, 'WIS', 1] }
};
G.XP_LV = [0, 0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700];
G.FEAT_LV = [3, 5, 7, 9];

/* ---------------- dice ---------------- */
G.d = (sides) => 1 + Math.floor(Math.random() * sides);
G.rollN = (n, sides, o = {}) => {
  const one = () => { let v = G.d(sides); if (o.gwf && v <= 2) v = G.d(sides); if (o.adept && v === 1) v = 2; return v; };
  const set = () => { let s = 0; for (let i = 0; i < n; i++) s += one(); return s; };
  let a = set(); if (o.savage) a = Math.max(a, set()); return a;
};
G.d20 = (adv, dis) => { const a = G.d(20), b = G.d(20); if (adv && !dis) return { nat: Math.max(a, b), rolls: [a, b], keep: a >= b ? 0 : 1 }; if (dis && !adv) return { nat: Math.min(a, b), rolls: [a, b], keep: a <= b ? 0 : 1 }; return { nat: a, rolls: [a], keep: 0 }; };

/* ---------------- relics ---------------- */
G.RELICS = {
  bonedice: { name: 'Bone Dice', icon: '⚄', desc: '+1 to every d20 you roll.' },
  owl: { name: 'Owl Feather', icon: '🪶', desc: 'Advantage on Perception: traps, mimics and secrets.' },
  thiefglove: { name: "Thief's Glove", icon: '🧤', desc: "Advantage on Thieves' Tools. Containers drop double gold." },
  emberheart: { name: 'Ember Heart', icon: '❤', desc: 'Burning enemies explode on death for 2d6 fire.' },
  frostlantern: { name: 'Frost Lantern', icon: '🏮', desc: 'Dodging releases a burst of frost that slows nearby enemies.' },
  warhorn: { name: 'War Horn', icon: '📯', desc: 'Elites and bosses take +25% damage from you.' },
  irontooth: { name: 'Iron Tooth', icon: '🦷', desc: 'Mimics can never surprise you and drop double treasure.' },
  rabbit: { name: "Rabbit's Foot", icon: '🐾', desc: 'Once per floor, a failed check is rerolled automatically.' },
  crown: { name: 'Shattered Crown', icon: '♛', desc: '+2 to all ability scores. Enemies have +15% health.' },
  map: { name: "Cartographer's Compass", icon: '🧭', desc: 'Secrets, traps and keys show on your minimap.' },
  lens: { name: 'Glass Cannon Lens', icon: '🔍', desc: 'Critical hits deal triple dice. You take +20% damage.' },
  idol: { name: 'Thunder Idol', icon: '⚡', desc: 'Every 7th hit calls lightning on the target for 2d8.' },
  hourglass: { name: 'Hourglass Shard', icon: '⧗', desc: 'Ability cooldowns are 20% shorter.' },
  scale: { name: "Merchant's Scale", icon: '⚖', desc: 'Shop prices are 25% lower.' },
  quill: { name: "Scholar's Quill", icon: '✒', desc: '+30% experience from every source.' },
  skeletonkey: { name: 'Skeleton Key', icon: '🗝', desc: 'Locked doors and rune seals open without a check.' },
  coin: { name: 'Two-Headed Coin', icon: '🪙', desc: 'Natural 1s on checks count as 10s.' },
  bloodpact: { name: 'Blood Pact Coin', icon: '🩸', desc: '+30% damage. Your maximum health is 15% lower.' }
};
G.RELIC_IDS = Object.keys(G.RELICS);
G.rollRelic = (r = Math.random, owned = []) => { const pool = G.RELIC_IDS.filter(id => !owned.includes(id)); return pool.length ? G.pick(pool, r) : G.pick(G.RELIC_IDS, r); };

/* ---------------- magic items ---------------- */
G.MAGIC = {
  ringprot: { name: 'Ring of Protection', base: 'ring', icon: '💍', desc: 'Take 10% less damage. +1 to all saving throws.' },
  ogre: { name: 'Gauntlets of Ogre Power', base: 'gauntlets', icon: '🥊', desc: 'Your Strength becomes 19.' },
  headband: { name: 'Headband of Intellect', base: 'circlet', icon: '👑', desc: 'Your Intelligence becomes 19.' },
  amulethealth: { name: 'Amulet of Health', base: 'amulet', icon: '📿', desc: 'Your Constitution becomes 19.' },
  bootsspeed: { name: 'Boots of Speed', base: 'boots', icon: '👢', desc: '+20% movement speed. Dodging costs 25% less stamina.' },
  displacement: { name: 'Cloak of Displacement', base: 'cloak', icon: '🧥', desc: '15% of attacks against you miss outright.' },
  flametongue: { name: 'Flame Tongue Charm', base: 'amulet', icon: '🔥', desc: 'Weapon and spell hits deal +1d6 fire.' },
  frostbrand: { name: 'Frost Brand Charm', base: 'ring', icon: '❄', desc: 'Weapon and spell hits deal +1d6 cold and may freeze.' },
  bracers: { name: 'Bracers of Archery', base: 'gauntlets', icon: '🏹', desc: 'Arrows and thrown knives deal +1d4. Volley fires 2 more arrows.' },
  evasion: { name: 'Ring of Evasion', base: 'ring', icon: '🌀', desc: 'Successful DEX saves take no damage; failed saves take half.' },
  pearl: { name: 'Pearl of Power', base: 'amulet', icon: '⚪', desc: '+30 mana and +50% mana regeneration.' },
  vicious: { name: 'Vicious Whetstone', base: 'trinket', icon: '🗡', desc: 'Critical hits deal an extra 2d6.' },
  eagle: { name: 'Eyes of the Eagle', base: 'circlet', icon: '👁', desc: 'Advantage on Perception checks.' },
  luckstone: { name: 'Stone of Good Luck', base: 'trinket', icon: '🍀', desc: '+1 to all ability checks and saving throws.' },
  // cursed: look ordinary until attuned or identified
  berserker: { name: 'Berserker Brand', base: 'gauntlets', icon: '🩸', cursed: true, desc: 'CURSED. Weapon hits deal +1d8, but you suffer −2 on every check and save. Cannot be removed.' },
  vulnerability: { name: 'Cloak of Vulnerability', base: 'cloak', icon: '🕸', cursed: true, desc: 'CURSED. You deal +15% damage but take +25% damage. Cannot be removed.' },
  clumsy: { name: 'Ring of Clumsiness', base: 'ring', icon: '🔗', cursed: true, desc: 'CURSED. Dexterity −2, but you find 50% more gold. Cannot be removed.' }
};
G.MAGIC_BASE = { ring: ['Unidentified Ring', 'ring', 0], amulet: ['Unidentified Amulet', 'amulet', 0], cloak: ['Unidentified Cloak', 'cloak', 0], gauntlets: ['Unidentified Gauntlets', 'gauntlets', 0], boots: ['Unidentified Boots', 'boots', 0], circlet: ['Unidentified Circlet', 'circlet', 0], trinket: ['Unidentified Trinket', 'idol', 1] };
G.makeMagic = (r = Math.random) => {
  const ids = Object.keys(G.MAGIC), cursedOk = r() < 0.2;
  const pool = ids.filter(id => !!G.MAGIC[id].cursed === cursedOk);
  const mid = G.pick(pool, r), M2 = G.MAGIC[mid], B = G.MAGIC_BASE[M2.base];
  return { magic: true, mid, name: B[0], model: B[1], v: B[2], value: 90, identified: false, attuned: false, idFail: -1 };
};
G.magicName = it => it.identified ? G.MAGIC[it.mid].name : it.name;

/* ---------------- feats ---------------- */
G.FEATS = {
  savage: { name: 'Savage Attacker', desc: 'Roll weapon damage dice twice and keep the higher total.' },
  gwf: { name: 'Great Weapon Fighter', desc: 'Reroll 1s and 2s on weapon damage dice.' },
  tough: { name: 'Tough', desc: '+2 maximum health per level, retroactively.' },
  alert: { name: 'Alert', desc: 'Advantage on Perception and on DEX saves against traps.' },
  lucky: { name: 'Lucky', desc: 'Three times per run, a failed d20 check is rerolled.' },
  mobile: { name: 'Mobile', desc: '+15% movement speed. Dodging costs 30% less stamina.' },
  adept: { name: 'Elemental Adept', desc: 'Spell and elemental damage dice treat 1s as 2s, and spells roll one extra die.' },
  brutal: { name: 'Brutal Critical', desc: 'Critical hits roll one extra weapon die. +5% critical chance.' },
  skilled: { name: 'Skilled', desc: '+2 to every ability check (locks, seals, parley, identify, events).' },
  resilient: { name: 'Resilient', desc: '+1 Constitution and advantage on all saving throws.' },
  sharpshooter: { name: 'Sharpshooter', desc: 'Arrows, knives and bolts deal +1d6 to targets more than 8 m away.' },
  sentinel: { name: 'Sentinel', desc: 'Parrying strikes back for 1d8 + STR and roots the attacker.' },
  healer: { name: 'Healer', desc: 'Priest only. Healing rolls one extra die and also cleanses poison and fire.', cls: ['priest'] },
  warcaster: { name: 'War Caster', desc: 'Wizard and priest only. Spells cost 20% less mana.', cls: ['wizard', 'priest'] }
};

/* ---------------- player sheet helpers ---------------- */
G.sheet = {
  init(P) {
    const D = G.DND[P.cls];
    P.dnd = D; P.level = 1; P.xp = 0; P.abPts = 0; P.abAdd = { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 }; P.hpRolls = []; P.feats = []; P.featPending = 0;
    P.relics = []; P.luck = 0; P.hex = 0; P.hitN = 0; P.rabbitUsed = false;
  },
  score(P, ab) {
    let s = P.dnd.scores[ab] + P.abAdd[ab];
    if (P.relics.includes('crown')) s += 2;
    if (ab === 'CON' && P.feats.includes('resilient')) s += 1;
    if (ab === 'DEX' && G.sheet.attuned(P, 'clumsy')) s -= 2;
    if (ab === 'STR' && G.sheet.attuned(P, 'ogre')) s = Math.max(s, 19);
    if (ab === 'INT' && G.sheet.attuned(P, 'headband')) s = Math.max(s, 19);
    if (ab === 'CON' && G.sheet.attuned(P, 'amulethealth')) s = Math.max(s, 19);
    return Math.min(s, 22);
  },
  mod(P, ab) { return G.mod(this.score(P, ab)); },
  prof(P) { return P.level >= 9 ? 4 : P.level >= 5 ? 3 : 2; },
  attuned(P, mid) { return P.backpack && P.backpack.some(it => it.magic && it.attuned && it.mid === mid); },
  // total bonus for a check or save
  bonus(P, o) {
    const ab = o.ab || G.SKILLS[o.skill];
    let b = this.mod(P, ab);
    if (o.skill && P.dnd.skills.includes(o.skill)) b += this.prof(P);
    if (o.save && P.dnd.saves.includes(ab)) b += this.prof(P);
    if (!o.save && P.feats.includes('skilled')) b += 2;
    if (o.save && this.attuned(P, 'ringprot')) b += 1;
    if (this.attuned(P, 'luckstone')) b += 1;
    if (this.attuned(P, 'berserker')) b -= 2;
    b -= P.hex || 0;
    return b;
  },
  advantage(P, o) {
    let adv = !!o.adv, dis = !!o.dis;
    if (o.skill === 'Perception' && (P.relics.includes('owl') || P.feats.includes('alert') || this.attuned(P, 'eagle'))) adv = true;
    if (o.skill === "Thieves' Tools" && P.relics.includes('thiefglove')) adv = true;
    if (o.save && P.feats.includes('resilient')) adv = true;
    if (o.save && o.trap && P.feats.includes('alert')) adv = true;
    return { adv, dis };
  },
  // resolve a d20 test; returns {nat, rolls, keep, bonus, total, dc, success, nat20, nat1}
  resolve(P, o) {
    const { adv, dis } = this.advantage(P, o), bonus = this.bonus(P, o) + (P.relics.includes('bonedice') ? 1 : 0) + (o.bonus || 0);
    let r = G.d20(adv, dis);
    if (r.nat === 1 && P.relics.includes('coin')) r = Object.assign({}, r, { nat: 10, coin: true });
    let res = this.finish(r, bonus, o.dc);
    if (!res.success && !o.noReroll) {
      if ((P.feats.includes('lucky') || P.fateLuck) && P.luck > 0) { P.luck--; const r2 = G.d20(adv, dis); res = Object.assign(this.finish(r2, bonus, o.dc), { rerolled: 'Lucky' }); }
      else if (P.relics.includes('rabbit') && !P.rabbitUsed) { P.rabbitUsed = true; const r2 = G.d20(adv, dis); res = Object.assign(this.finish(r2, bonus, o.dc), { rerolled: "Rabbit's Foot" }); }
    }
    res.adv = adv; res.dis = dis; return res;
  },
  finish(r, bonus, dc) { const total = r.nat + bonus; return { nat: r.nat, rolls: r.rolls, keep: r.keep, bonus, total, dc, nat20: r.nat === 20, nat1: r.nat === 1, success: r.nat === 20 || (r.nat !== 1 && total >= dc) }; },
  // ---- derived stats ----
  maxHp(P) {
    const D = P.dnd, con = this.mod(P, 'CON'), S = G.save;
    let hp = D.base + con * 4 + P.hpRolls.reduce((a, b) => a + b, 0) + con * (P.level - 1) + S.armorLv * 5 + P.mods.hp + (P.feats.includes('tough') ? 2 * P.level : 0);
    hp *= Math.max(0.3, 1 + (P.mods.hpPct || 0));
    if (P.relics.includes('bloodpact')) hp *= 0.85;
    return Math.max(1, Math.round(hp));
  },
  maxMana(P) {
    if (P.cls === 'wizard') return 100 + this.mod(P, 'INT') * 8 + P.mods.mana + (this.attuned(P, 'pearl') ? 30 : 0);
    if (P.cls === 'priest') return 90 + this.mod(P, 'WIS') * 8 + P.mods.mana + (this.attuned(P, 'pearl') ? 30 : 0);
    return 0;
  },
  critChance(P) { return Math.max(0, G.CLASS_ATK[P.cls].crit + this.mod(P, 'DEX') * 0.02 + P.mods.crit + (P.feats.includes('brutal') ? 0.05 : 0)); },
  tierBonus(P) { const t = P.wpnLv; return { flat: [0, 1, 2, 2, 3][t], dice: t >= 4 ? [1, 6] : t >= 3 ? [1, 4] : null }; },
  // weapon damage roll: returns number
  weapon(P, crit, o = {}) {
    const W = P.dnd.weapon, mult = crit ? (P.relics.includes('lens') ? 3 : 2) : 1, fo = { gwf: P.feats.includes('gwf') && !W.spell, savage: P.feats.includes('savage') && !W.spell, adept: P.feats.includes('adept') && W.spell };
    let n = (o.n || W.n) * mult + (crit && P.feats.includes('brutal') ? 1 : 0) + (W.spell && P.feats.includes('adept') ? 1 : 0);
    let dmg = G.rollN(n, o.d || W.d, fo) + this.mod(P, W.ab);
    const tb = this.tierBonus(P); dmg += tb.flat; if (tb.dice) dmg += G.rollN(tb.dice[0] * mult, tb.dice[1]);
    dmg += this.extraDice(P, mult, o);
    return Math.max(1, dmg);
  },
  // dice from magic items/feats/relics added to every weapon or spell hit
  extraDice(P, mult, o = {}) {
    let x = 0;
    if (this.attuned(P, 'flametongue')) x += G.rollN(mult, 6, { adept: P.feats.includes('adept') });
    if (this.attuned(P, 'frostbrand')) x += G.rollN(mult, 6, { adept: P.feats.includes('adept') });
    if (this.attuned(P, 'berserker')) x += G.rollN(mult, 8);
    if (mult > 1 && this.attuned(P, 'vicious')) x += G.rollN(2, 6);
    if (o.ranged && this.attuned(P, 'bracers')) x += G.rollN(mult, 4);
    if (o.ranged && o.far && P.feats.includes('sharpshooter')) x += G.rollN(mult, 6);
    return x;
  },
  // ability damage: [n, sides, ability, perRank]
  abil(P, slot, crit, rank = 0) {
    const A = G.ABIL_DICE[P.cls][slot]; if (!A) return 0;
    const spell = P.cls === 'wizard' || P.cls === 'priest', mult = crit ? 2 : 1;
    const n = (A[0] + (A[3] ? A[3] * rank : 0)) * mult + (spell && P.feats.includes('adept') ? 1 : 0);
    return Math.max(1, G.rollN(n, A[1], { adept: spell && P.feats.includes('adept'), gwf: !spell && P.feats.includes('gwf') }) + this.mod(P, A[2]) + this.extraDice(P, mult));
  },
  abilText(P, slot, rank = 0) { const A = G.ABIL_DICE[P.cls][slot]; if (!A) return ''; return `${A[0] + (A[3] ? A[3] * rank : 0)}d${A[1]}${G.fmt(this.mod(P, A[2]))}`; },
  weaponText(P) { const W = P.dnd.weapon, tb = this.tierBonus(P); const m = this.mod(P, W.ab) + tb.flat; return `${W.n}d${W.d}${tb.dice ? ` + ${tb.dice[0]}d${tb.dice[1]}` : ''}${G.fmt(m)}`; },
  // ---- XP & levels ----
  gainXp(P, amt, why) {
    if (!P || P.level >= 10) return; amt = Math.round(amt * (P.relics.includes('quill') ? 1.3 : 1));
    P.xp += amt;
    while (P.level < 10 && P.xp >= G.XP_LV[P.level + 1]) this.levelUp(P);
  },
  levelUp(P) {
    const before = this.maxHp(P), D = P.dnd, roll = G.d(D.hd), con = this.mod(P, 'CON');
    P.level++; P.hpRolls.push(roll); P.abPts += 2;
    if (G.FEAT_LV.includes(P.level)) P.featPending++;
    const gain = this.maxHp(P) - before; P.hp += gain;
    G.sfx('level', 1); G.ui.banner(`Level ${P.level}`, `Hit die d${D.hd}: ${roll} ${G.fmt(con)} CON · +${gain} max health`);
    G.ui.checkChip({ title: `Level ${P.level}`, nat: roll, sides: D.hd, line: `+${gain} max health · +2 ability points${G.FEAT_LV.includes(P.level) ? ' · choose a feat' : ''}`, ok: true });
    G.fx.holy(new G.V3(P.pos.x, 0.1, P.pos.z), 40, 1.2);
    G.ui.refreshSheetBadge();
  },
  applyChange(P, fn) { const before = this.maxHp(P), mb = this.maxMana(P); fn(); const after = this.maxHp(P); if (after > before) P.hp += after - before; else P.hp = Math.min(P.hp, after); const ma = this.maxMana(P); if (ma > mb) P.mana += ma - mb; G.ui.refreshSheetBadge(); },
  // plain-language list of what each ability changes for this hero (computed values)
  effects(P, ab) {
    const c = P.cls, m = this.mod(P, ab), f = G.fmt(m), out = [], W = P.dnd.weapon, sk = s => `${G.fmt(this.bonus(P, { skill: s }))}${P.dnd.skills.includes(s) ? ' (proficient)' : ''}`, sv = a => `${G.fmt(this.bonus(P, { ab: a, save: true }))}${P.dnd.saves.includes(a) ? ' (proficient)' : ''}`;
    const r2 = P.ab2Lv || 0;
    if (ab === 'STR') {
      if (W.ab === 'STR') out.push(`${W.name} damage ${this.weaponText(P)}`);
      if (c === 'knight') { out.push(`Shield Bash ${this.abilText(P, 'q')}`); out.push(`Valor Charge ${this.abilText(P, 'r', r2)}`); }
      if (c === 'barbarian') out.push(`Leap Slam ${this.abilText(P, 'r', r2)}`);
      out.push(`Athletics (force doors, smash, pry) ${sk('Athletics')}`); out.push(`STR saves ${sv('STR')}`);
    } else if (ab === 'DEX') {
      if (W.ab === 'DEX') out.push(`${W.name} damage ${this.weaponText(P)}${c === 'archer' ? ' · full draw rolls double dice' : ''}`);
      if (c === 'rogue') { out.push(`Fan of Knives ${this.abilText(P, 'r')} per knife`); out.push(`Sneak Attack +${this.sneakDice(P)}d6 from behind or after Shadow Step`); }
      if (c === 'archer') { out.push(`Volley ${this.abilText(P, 'q')} per arrow`); out.push(`Frost Arrow ${this.abilText(P, 'r', r2)}`); }
      out.push(`Critical chance ${Math.round(this.critChance(P) * 100)}% (${G.fmt(m * 2)}% from DEX)`);
      out.push(`Thieves' Tools (locks, disarm traps) ${sk("Thieves' Tools")}`); out.push(`DEX saves vs traps & blasts, success halves damage ${sv('DEX')}`);
    } else if (ab === 'CON') {
      out.push(`Max health ${this.maxHp(P)} · CON adds ${G.fmt(m * 4)} at level 1 and ${f} per level`); out.push(`Hit die d${P.dnd.hd}${f} each level`); out.push(`Stamina ${G.fmt(m * 5)}`); out.push(`Endurance ${sk('Endurance')} · CON saves vs poison ${sv('CON')}`);
    } else if (ab === 'INT') {
      if (c === 'wizard') { out.push(`Firebolt ${this.weaponText(P)} fire`); out.push(`Frost Nova ${this.abilText(P, 'q')} cold`); out.push(`Chain Lightning ${this.abilText(P, 'r', r2)}`); out.push(`Mana ${this.maxMana(P)} (${G.fmt(m * 8)} from INT)`); }
      out.push(`Arcana (rune seals) ${sk('Arcana')}`); out.push(`Investigation (identify items, puzzles) ${sk('Investigation')}`); out.push(`INT saves ${sv('INT')}`);
    } else if (ab === 'WIS') {
      if (c === 'priest') { out.push(`Holy Light heals the party ${this.abilText(P, 'q')}${P.feats.includes('healer') ? ' +1d8' : ''}`); out.push(`Smite ${this.abilText(P, 'r', r2)} radiant`); out.push(`Holy strike 1d4${f} radiant on mace hits`); out.push(`Mana ${this.maxMana(P)} (${G.fmt(m * 8)} from WIS)`); }
      out.push(`Perception (spot traps, mimics, secrets) ${sk('Perception')}`); out.push(`Religion (shrines, relics) ${sk('Religion')}`);
      if (c === 'wizard' || c === 'priest') out.push(`Mana regeneration ${G.fmt(m * 10)}%`);
      out.push(`WIS saves ${sv('WIS')}`);
    } else if (ab === 'CHA') {
      out.push(`Every NPC d20 roll ${G.fmt(m + G.save.luckLv)}${G.save.luckLv ? ` (${f} CHA, +${G.save.luckLv} shrine)` : ''}`); out.push(`Persuasion (parley with cornered foes) ${sk('Persuasion')}`); out.push(`Intimidation ${sk('Intimidation')}`); out.push(`Shop prices ${m > 0 ? '−' + m * 5 + '%' : 'normal'}`);
    }
    return out;
  },
  sneakDice(P) { return P.level >= 9 ? 4 : P.level >= 5 ? 3 : 2; }
};

/* ---------------- the narrator ---------------- */
G.DM_LINES = {
  arrive: {
    crypt: ['Cold water laps at your boots. Somewhere ahead, bones shift in the dark.', 'The air tastes of old candles and older graves. The dead here do not sleep well.', 'Names are carved into every wall. None of them are remembered.'],
    warrens: ['Fungus glows like a thousand watching eyes. Something chitters in the deep.', 'The tunnels breathe warm and damp. You smell goblin cookfires and worse.', 'Webs drift across the passage like curtains in a haunted house.'],
    abyss: ['The walls drink the light. Somewhere far below, something vast turns over in its sleep.', 'Violet light seeps through the stone like water through a cracked hull. The air hums.', 'You hear your own name whispered behind you. When you turn, the hall is empty.'],
    forge: ['Heat slams into you like a hammer. Lava rivers paint the ceiling red.', 'The anvils still ring, though no smith has worked here in a thousand years.', 'Brimstone and iron. Somewhere, a demon laughs.']
  },
  elite: ['A champion of the deep steps forward, wreathed in power. This one is different.', 'The air thickens. Whatever stands before you has fed well.'],
  boss: ['The doors grind shut behind you. There is no turning back now.', 'The chamber falls silent. Then the ground begins to shake.'],
  secret: ['A cold draft whispers through cracked stone. Something lies beyond.', 'Your eye catches a seam in the wall where no seam should be.'],
  secretOpen: ['Stone crumbles away, revealing a chamber forgotten by time.', 'The wall gives way. Dust settles over treasure no one has touched in centuries.'],
  trap: ['Your eye catches a loose flagstone. A pressure plate, waiting patiently.', 'Tiny holes line the walls ahead. Dart holes. You step carefully.'],
  trapHit: ['Click. Too late, you hear the mechanism engage.', 'The floor shifts beneath your boot. Then the trap springs.'],
  mimic: ['That chest is breathing. Ever so slightly, it is breathing.', 'You notice teeth marks on the floor around that chest. Fresh ones.'],
  mimicAmbush: ['The chest lid splits into a mouth full of teeth!', 'Treasure? No. Teeth. So many teeth.'],
  level: ['Your scars teach lessons. You have reached level {n}.', 'Power settles into your bones. Level {n}.'],
  key: ['An iron key, heavy with purpose. Somewhere, a vault waits.'],
  nat1: ['The dice are cruel tonight.', 'Fate laughs at you.'],
  nat20: ['The dice sing your name!', 'A perfect roll. Even the gods take notice.'],
  lowhp: ['Your vision blurs at the edges. One more mistake could be your last.'],
  floorDone: ['The way forward is open. Choose your path wisely.']
};
G.dm = {
  q: [], showing: false,
  say(text, dur) {
    if (!text) return;
    if (this.q.length > 2) this.q.shift();
    this.q.push({ text, dur: dur || Math.min(9, 2.8 + text.length * 0.045) });
    if (!this.showing) this.next();
  },
  next() {
    const el = document.getElementById('narrator'); if (!el) return;
    const it = this.q.shift(); if (!it) { this.showing = false; el.classList.remove('on'); return; }
    this.showing = true; el.classList.add('on'); const tx = el.querySelector('.nt'); tx.textContent = '';
    let i = 0; clearInterval(this.tw);
    this.tw = setInterval(() => { i += 2; tx.textContent = it.text.slice(0, i); if (i >= it.text.length) { clearInterval(this.tw); setTimeout(() => this.next(), it.dur * 1000); } }, 24);
  }
};
