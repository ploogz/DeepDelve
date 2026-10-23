/* ============================================================
   Game data: enemies, bosses, dungeons, upgrades, loot, NPCs
   ============================================================ */
'use strict';
/* attack kinds: melee | proj | leap | charge | aoe | cone | summon | heal | explode | blink | buff */
G.ENEMIES = {
  // ---- Sunken Crypt ----
  skeleton: { armored: 1, name: 'Skeleton Warrior', hp: 70, speed: 3.4, r: 0.45, h: 1.8, gold: [4, 9], blood: 'bone', groan: 'bone', atks: [{ k: 'melee', range: 2.2, arc: 1.4, wind: 0.45, dur: 0.9, dmg: 12, anim: 'slash', cd: 1.4 }, { k: 'melee', range: 2.0, arc: 1.0, wind: 0.6, dur: 1.2, dmg: 20, anim: 'overhead', cd: 4, w: 0.4 }] },
  skelarcher: { name: 'Skeleton Archer', hp: 50, speed: 3.0, r: 0.4, h: 1.8, gold: [4, 9], blood: 'bone', groan: 'bone', ranged: 10, atks: [{ k: 'proj', pk: 'arrow', min: 4, range: 22, wind: 0.75, dur: 1.2, dmg: 11, speed: 24, anim: 'shoot', cd: 2.0 }, { k: 'proj', pk: 'arrow', min: 6, range: 22, wind: 1.1, dur: 1.6, dmg: 8, speed: 22, count: 3, spread: 0.25, anim: 'shoot', cd: 6, w: 0.5 }] },
  zombie: { name: 'Rotting Zombie', hp: 130, speed: 2.1, r: 0.5, h: 1.8, gold: [3, 7], blood: 'rot', groan: 'groan', atks: [{ k: 'melee', range: 2.0, arc: 1.4, wind: 0.6, dur: 1.1, dmg: 15, anim: 'claw', cd: 1.6 }, { k: 'aoe', at: 'target', min: 2, range: 9, radius: 2.2, delay: 1.3, wind: 0.6, dur: 1.2, dmg: 6, dot: 4, fx: 'acid', anim: 'roar', cd: 7, w: 0.6 }] },
  ghoul: { name: 'Crypt Ghoul', hp: 80, speed: 5.4, r: 0.42, h: 1.5, gold: [5, 10], blood: 'red', groan: 'screech', atks: [{ k: 'melee', range: 2.0, arc: 1.4, wind: 0.3, dur: 0.6, dmg: 9, anim: 'claw', cd: 0.9 }, { k: 'leap', min: 4, range: 10, wind: 0.5, dur: 1.2, dmg: 18, radius: 2.0, anim: 'claw', cd: 5 }] },
  wraith: { name: 'Wailing Wraith', hp: 75, speed: 3.6, r: 0.45, h: 2.0, gold: [6, 12], blood: 'ecto', groan: 'screech', fly: true, ranged: 9, atks: [{ k: 'proj', pk: 'soul', min: 3, range: 18, wind: 0.6, dur: 1.0, dmg: 13, speed: 9, homing: 2.2, anim: 'cast', cd: 2.4 }, { k: 'blink', min: 0, range: 30, wind: 0.4, dur: 0.8, cd: 6, anim: 'cast', w: 0.5 }, { k: 'melee', range: 2.0, arc: 1.4, wind: 0.4, dur: 0.8, dmg: 10, anim: 'claw', cd: 1.5, drain: 1 }] },
  // ---- Gloomroot Warrens ----
  goblin: { name: 'Goblin Cutthroat', hp: 55, speed: 4.8, r: 0.38, h: 1.3, gold: [4, 10], blood: 'red', groan: 'screech', atks: [{ k: 'melee', range: 2.3, arc: 1.0, wind: 0.3, dur: 0.6, dmg: 9, anim: 'thrust', cd: 0.9 }, { k: 'melee', range: 2.3, arc: 1.0, wind: 0.25, dur: 1.0, dmg: 6, hits: 3, anim: 'thrust', cd: 4, w: 0.5 }] },
  shaman: { name: 'Goblin Shaman', hp: 60, speed: 3.6, r: 0.38, h: 1.3, gold: [7, 14], blood: 'red', groan: 'screech', ranged: 11, atks: [{ k: 'proj', pk: 'fireball', min: 3, range: 20, wind: 0.8, dur: 1.2, dmg: 15, speed: 14, burn: 1, splash: 1.8, anim: 'cast', cd: 2.6 }, { k: 'heal', min: 0, range: 99, radius: 9, amt: 40, wind: 0.8, dur: 1.4, anim: 'cast', cd: 9, w: 0.6 }] },
  spider: { name: 'Giant Spider', hp: 85, speed: 5.0, r: 0.6, h: 1.0, gold: [5, 11], blood: 'ichor', groan: 'screech', atks: [{ k: 'melee', range: 2.2, arc: 1.2, wind: 0.35, dur: 0.7, dmg: 11, poison: 1, anim: 'bite', cd: 1.1 }, { k: 'proj', pk: 'web', min: 4, range: 14, wind: 0.5, dur: 0.9, dmg: 4, speed: 16, slow: 2.5, anim: 'bite', cd: 5, w: 0.7 }] },
  orc: { armored: 1, name: 'Orc Brute', hp: 170, speed: 3.3, r: 0.6, h: 2.2, gold: [8, 16], blood: 'red', groan: 'roar', atks: [{ k: 'melee', range: 2.6, arc: 1.5, wind: 0.6, dur: 1.1, dmg: 22, anim: 'slash', cd: 1.6 }, { k: 'charge', min: 5, range: 14, wind: 0.8, dur: 1.6, dmg: 26, speed: 15, anim: 'roar', cd: 6 }] },
  troll: { name: 'Cave Troll', hp: 260, speed: 2.8, r: 0.8, h: 2.9, gold: [12, 22], blood: 'red', groan: 'roar', regen: 4, atks: [{ k: 'melee', range: 3.2, arc: 1.6, wind: 0.8, dur: 1.4, dmg: 28, anim: 'overhead', cd: 2 }, { k: 'aoe', at: 'self', min: 0, range: 4, radius: 4.5, delay: 0.0, wind: 1.1, dur: 1.8, dmg: 30, fx: 'slam', anim: 'slam', cd: 7, w: 0.6 }] },
  // ---- Infernal Forge ----
  imp: { name: 'Cackling Imp', hp: 55, speed: 4.6, r: 0.4, h: 1.2, gold: [6, 12], blood: 'ember', groan: 'screech', fly: true, ranged: 9, atks: [{ k: 'proj', pk: 'fireball', min: 3, range: 18, wind: 0.5, dur: 0.9, dmg: 11, speed: 16, burn: 1, anim: 'cast', cd: 1.8 }, { k: 'proj', pk: 'fireball', min: 3, range: 18, wind: 0.6, dur: 1.2, dmg: 7, speed: 15, count: 4, spread: 0.35, burn: 1, anim: 'cast', cd: 6, w: 0.5 }] },
  hound: { name: 'Hellhound', hp: 110, speed: 6.2, r: 0.6, h: 1.2, gold: [7, 14], blood: 'ember', groan: 'roar', atks: [{ k: 'melee', range: 2.4, arc: 1.2, wind: 0.3, dur: 0.6, dmg: 13, burn: 1, anim: 'bite', cd: 1.0 }, { k: 'cone', min: 0, range: 6, angle: 0.55, wind: 0.5, dur: 1.6, dmg: 6, tick: 0.2, fx: 'fire', anim: 'breath', cd: 6, w: 0.7 }, { k: 'leap', min: 5, range: 11, wind: 0.4, dur: 1.0, dmg: 15, radius: 2, anim: 'bite', cd: 5, w: 0.5 }] },
  elemental: { name: 'Fire Elemental', hp: 140, speed: 3.2, r: 0.6, h: 2.2, gold: [10, 18], blood: 'ember', groan: 'fire', immune: 'fire', atks: [{ k: 'melee', range: 2.4, arc: 1.6, wind: 0.5, dur: 0.9, dmg: 15, burn: 1, anim: 'claw', cd: 1.4 }, { k: 'explode', min: 0, range: 3, radius: 4.0, wind: 1.6, dur: 1.7, dmg: 45, fx: 'fire', anim: 'claw', cd: 99, lowHp: 0.4 }] },
  minotaur: { armored: 1, name: 'Minotaur', hp: 300, speed: 3.6, r: 0.8, h: 2.8, gold: [14, 26], blood: 'red', groan: 'roar', atks: [{ k: 'melee', range: 3.0, arc: 1.8, wind: 0.7, dur: 1.3, dmg: 30, anim: 'slash', cd: 1.8 }, { k: 'charge', min: 5, range: 18, wind: 1.0, dur: 2.0, dmg: 35, speed: 17, anim: 'roar', cd: 7 }, { k: 'aoe', at: 'self', min: 0, range: 3.5, radius: 4, delay: 0, wind: 0.9, dur: 1.5, dmg: 25, fx: 'slam', anim: 'overhead', cd: 8, w: 0.5 }] },
  gargoyle: { armored: 1, name: 'Gargoyle', hp: 150, speed: 4.2, r: 0.55, h: 2.0, gold: [10, 18], blood: 'stone', groan: 'screech', armor: 0.35, atks: [{ k: 'melee', range: 2.3, arc: 1.4, wind: 0.4, dur: 0.8, dmg: 16, anim: 'claw', cd: 1.2 }, { k: 'leap', min: 4, range: 16, wind: 0.7, dur: 1.6, dmg: 24, radius: 2.8, fly: 1, anim: 'claw', cd: 6 }] },
  // ---- pullers: one per dungeon, built to drag ranged heroes into the fight ----
  revenant: { armored: 1, name: 'Chain Revenant', hp: 115, speed: 3.3, r: 0.45, h: 1.95, gold: [7, 13], blood: 'bone', groan: 'bone', puller: 1,
    atks: [{ k: 'melee', range: 2.4, arc: 1.5, wind: 0.5, dur: 1.0, dmg: 15, anim: 'slash', cd: 1.5 }, { k: 'hook', pk: 'chain', tether: 'spectral', min: 5, range: 21, wind: 0.75, dur: 1.3, dmg: 8, speed: 27, stop: 1.3, root: 0.7, anim: 'overhead', cd: 5.5, w: 2 }] },
  ensnarer: { name: 'Silk Ensnarer', model: 'ensnarer', hp: 95, speed: 4.6, r: 0.62, h: 1.1, gold: [7, 13], blood: 'ichor', groan: 'screech', puller: 1,
    atks: [{ k: 'melee', range: 2.3, arc: 1.3, wind: 0.35, dur: 0.7, dmg: 12, poison: 1, anim: 'bite', cd: 1.1 }, { k: 'hook', pk: 'silk', tether: 'silk', min: 5, range: 19, wind: 0.6, dur: 1.1, dmg: 5, speed: 23, slow: 2, stop: 1.2, root: 1.0, anim: 'bite', cd: 5, w: 2 }] },
  warden: { armored: 1, name: 'Brimstone Warden', model: 'warden', hp: 190, speed: 3.0, r: 0.6, h: 2.3, gold: [11, 19], blood: 'ember', groan: 'roar', immune: 'fire', puller: 1,
    atks: [{ k: 'melee', range: 2.6, arc: 1.6, wind: 0.55, dur: 1.1, dmg: 22, burn: 1, anim: 'overhead', cd: 1.6 }, { k: 'vortex', at: 'target', min: 4, range: 22, radius: 2.8, reach: 2.7, pull: 1.5, str: 4.8, wind: 0.8, dur: 2.6, dmg: 24, fx: 'fire', color: 0xff6020, anim: 'cast', cd: 7, w: 2 },
      { k: 'hook', pk: 'hellhook', tether: 'hell', min: 7, range: 20, wind: 0.8, dur: 1.3, dmg: 10, speed: 25, burn: 1, stop: 1.4, root: 0.5, anim: 'overhead', cd: 9, w: 1 }] },
  // ---- shield-bearers, spore bloaters and golems: one more line per dungeon ----
  tombguard: { armored: 1, name: 'Tomb Guardian', model: 'tombguard', hp: 165, speed: 3.0, r: 0.55, h: 2.0, gold: [8, 15], blood: 'bone', groan: 'bone',
    atks: [{ k: 'melee', range: 2.5, arc: 1.4, wind: 0.5, dur: 1.0, dmg: 18, anim: 'slash', cd: 1.5 }, { k: 'shield', min: 0, range: 7, wind: 0.15, dur: 3.2, anim: 'slash', cd: 6.5, w: 1.6 }, { k: 'charge', min: 4, range: 12, wind: 0.7, dur: 1.5, dmg: 20, speed: 13, anim: 'roar', cd: 7 }] },
  sporeling: { name: 'Sporeling Bloater', model: 'sporeling', hp: 125, speed: 2.6, r: 0.6, h: 1.7, gold: [7, 14], blood: 'ichor', groan: 'squish', deathCloud: 1,
    atks: [{ k: 'melee', range: 2.2, arc: 1.5, wind: 0.55, dur: 1.0, dmg: 12, poison: 1, anim: 'claw', cd: 1.4 }, { k: 'ring', min: 0, range: 8, count: 2, gap: 0.7, speed: 6, maxR: 9, wind: 0.9, dur: 3.0, dmg: 10, poison: 1, color: 0x9aff40, anim: 'roar', cd: 6.5, w: 1.4 }, { k: 'aoe', at: 'target', min: 3, range: 13, radius: 2.6, delay: 1.0, wind: 0.6, dur: 1.4, dmg: 6, dot: 4, fx: 'acid', anim: 'cast', cd: 7 }] },
  golem: { armored: 1, name: 'Ember Golem', model: 'golem', hp: 250, speed: 2.4, r: 0.75, h: 2.6, gold: [12, 22], blood: 'stone', groan: 'roar', immune: 'fire', armor: 0.2,
    atks: [{ k: 'melee', range: 3.0, arc: 1.6, wind: 0.75, dur: 1.4, dmg: 26, burn: 1, anim: 'overhead', cd: 1.9 }, { k: 'ring', min: 0, range: 7, count: 1, speed: 10, maxR: 10, wind: 1.0, dur: 2.2, dmg: 22, burn: 1, color: 0xff7030, anim: 'slam', cd: 6 }, { k: 'beam', min: 3, range: 16, wind: 1.0, dur: 3.0, sweep: 1.2, width: 0.8, dmg: 7, tick: 0.2, color: 0xff6020, anim: 'cast', cd: 9 }] },
  // summons
  mimic: { name: 'Mimic', hp: 150, speed: 4.4, r: 0.6, h: 1.0, gold: [30, 60], xp: 60, blood: 'ichor', groan: 'squish', atks: [{ k: 'melee', range: 2.4, arc: 1.6, wind: 0.35, dur: 0.75, dmg: 16, anim: 'bite', cd: 1.2 }, { k: 'leap', min: 3, range: 10, wind: 0.45, dur: 1.1, dmg: 20, radius: 2.2, anim: 'bite', cd: 4.5 }] },
  spiderling: { name: 'Spiderling', hp: 25, speed: 6, r: 0.3, h: 0.5, gold: [0, 2], blood: 'ichor', groan: 'screech', atks: [{ k: 'melee', range: 1.5, arc: 1.4, wind: 0.25, dur: 0.5, dmg: 5, poison: 1, anim: 'bite', cd: 0.9 }] }
};
G.BOSSES = {
  abbess: { name: 'The Drowned Abbess', title: 'Choir of the Sunken Crypt', model: 'abbess', hp: 1900, speed: 3.2, r: 0.9, h: 3.4, gold: [170, 240], blood: 'ecto', groan: 'screech', boss: 1, fly: true, ranged: 10,
    atks: [{ k: 'beam', min: 0, range: 26, wind: 1.1, dur: 3.6, sweep: 1.9, width: 0.9, dmg: 9, tick: 0.2, color: 0x60ffa0, fx: 'soul', anim: 'cast', cd: 8 }, { k: 'ring', min: 0, range: 30, count: 3, gap: 0.55, speed: 9, maxR: 20, wind: 0.8, dur: 3.6, dmg: 18, color: 0x80ffc0, anim: 'roar', cd: 7 },
      { k: 'proj', pk: 'soul', min: 0, range: 28, wind: 0.6, dur: 1.2, dmg: 14, speed: 11, count: 5, spread: 0.7, homing: 1.4, anim: 'cast', cd: 4 }, { k: 'summon', what: 'wraith', count: 2, wind: 1, dur: 1.6, anim: 'cast', cd: 16, min: 0, range: 99 },
      { k: 'hook', pk: 'chain', tether: 'spectral', min: 8, range: 26, wind: 0.6, dur: 1.2, dmg: 10, speed: 28, stop: 2, root: 0.8, anim: 'cast', cd: 10, w: 1.4 }, { k: 'blink', min: 0, range: 30, wind: 0.4, dur: 0.8, cd: 9, anim: 'cast', w: 0.6 }] },
  mycelid: { name: 'Mother Mycelid', title: 'Heart of the Gloomroot', model: 'mycelid', hp: 2100, speed: 2.3, r: 1.6, h: 4.6, gold: [190, 270], blood: 'ichor', groan: 'squish', boss: 1,
    atks: [{ k: 'melee', range: 5.0, arc: 1.8, wind: 0.8, dur: 1.4, dmg: 30, poison: 1, anim: 'overhead', cd: 2 }, { k: 'ring', min: 0, range: 30, count: 2, gap: 0.8, speed: 7, maxR: 16, wind: 1.0, dur: 3.6, dmg: 16, poison: 1, color: 0x9aff40, anim: 'roar', cd: 7 },
      { k: 'aoe', at: 'target', min: 0, range: 30, radius: 2.4, count: 6, spread: 7, delay: 1.2, wind: 0.8, dur: 1.6, dmg: 12, dot: 5, fx: 'acid', anim: 'cast', cd: 7 }, { k: 'summon', what: 'sporeling', count: 3, wind: 1, dur: 1.6, anim: 'roar', cd: 15, min: 0, range: 99 },
      { k: 'vortex', at: 'self', off: 2.5, min: 0, range: 30, radius: 3.6, reach: 3, pull: 1.8, str: 5.6, wind: 0.7, dur: 2.9, dmg: 30, fx: 'implode', color: 0x9aff40, anim: 'roar', cd: 11, w: 1.2 }] },
  forgetyrant: { armored: 1, name: 'The Forge Tyrant', title: 'Molten Heart of the Forge', model: 'forgetyrant', hp: 2600, speed: 2.6, r: 1.7, h: 5.4, gold: [300, 400], blood: 'stone', groan: 'roar', boss: 1, immune: 'fire', armor: 0.15,
    atks: [{ k: 'melee', range: 5.5, arc: 1.8, wind: 0.8, dur: 1.5, dmg: 36, burn: 1, anim: 'overhead', cd: 2 }, { k: 'beam', min: 0, range: 30, wind: 1.1, dur: 3.8, sweep: 2.4, width: 1.0, dmg: 10, tick: 0.2, color: 0xff6020, anim: 'cast', cd: 8 },
      { k: 'ring', min: 0, range: 30, count: 2, gap: 0.7, speed: 9, maxR: 18, wind: 1.0, dur: 3.4, dmg: 24, burn: 1, color: 0xff7030, anim: 'slam', cd: 7 }, { k: 'aoe', at: 'target', min: 0, range: 40, radius: 3, count: 6, spread: 9, delay: 1.5, wind: 1.0, dur: 2.0, dmg: 30, fx: 'meteor', anim: 'roar', cd: 10 },
      { k: 'hook', pk: 'hellhook', tether: 'hell', min: 7, range: 28, wind: 0.8, dur: 1.4, dmg: 16, speed: 28, burn: 1, stop: 2, root: 0.6, anim: 'cast', cd: 9, w: 1.4 }] },
  colossus: { armored: 1, name: 'The Bone Colossus', title: 'Warden of the Ossuary', model: 'colossus', hp: 1700, speed: 2.6, r: 1.6, h: 6, gold: [150, 220], blood: 'bone', groan: 'roar', boss: 1,
    atks: [{ k: 'melee', range: 5.5, arc: 2.0, wind: 1.0, dur: 1.8, dmg: 34, anim: 'slash', cd: 2.2 }, { k: 'aoe', at: 'self', min: 0, range: 7, radius: 8, delay: 0, ring: 1, wind: 1.3, dur: 2.2, dmg: 30, fx: 'slam', anim: 'slam', cd: 6 }, { k: 'aoe', at: 'target', min: 4, range: 30, radius: 2.4, count: 5, spread: 6, delay: 1.2, wind: 0.8, dur: 1.6, dmg: 26, fx: 'spikes', anim: 'roar', cd: 7 }, { k: 'summon', what: 'skeleton', count: 3, wind: 1, dur: 1.6, anim: 'roar', cd: 18, min: 0, range: 99 }, { k: 'hook', pk: 'hook', tether: 'chain', min: 8, range: 28, wind: 0.8, dur: 1.4, dmg: 16, speed: 29, stop: 2.2, root: 0.6, anim: 'slash', cd: 9, w: 1.5 }] },
  lich: { name: 'Malthus the Lich King', title: 'Lord of the Sunken Crypt', model: 'lich', hp: 2100, speed: 3.0, r: 0.8, h: 3.2, gold: [260, 360], blood: 'bone', groan: 'roar', boss: 1, fly: false, ranged: 12,
    atks: [{ k: 'proj', pk: 'soul', min: 0, range: 30, wind: 0.7, dur: 1.4, dmg: 16, speed: 10, count: 5, spread: 0.6, homing: 1.4, anim: 'cast', cd: 3 }, { k: 'aoe', at: 'target', min: 0, range: 30, radius: 2.2, count: 7, spread: 7, delay: 1.3, wind: 0.8, dur: 1.4, dmg: 28, fx: 'spikes', anim: 'cast', cd: 6 }, { k: 'summon', what: 'skeleton', count: 4, alt: 'skelarcher', wind: 1, dur: 1.8, anim: 'cast', cd: 15, min: 0, range: 99 }, { k: 'blink', min: 0, range: 99, wind: 0.5, dur: 1.0, anim: 'cast', cd: 9 }, { k: 'aoe', at: 'self', min: 0, range: 5, radius: 6.5, ring: 1, delay: 0.9, wind: 0.6, dur: 1.6, dmg: 30, fx: 'frost', freeze: 1, anim: 'cast', cd: 10 }, { k: 'vortex', at: 'target', min: 6, range: 30, radius: 3.2, reach: 2.6, pull: 1.7, str: 5.6, wind: 0.8, dur: 2.9, dmg: 30, fx: 'implode', color: 0x60ff90, anim: 'cast', cd: 10, w: 1.5 }, { k: 'hook', pk: 'chain', tether: 'spectral', min: 9, range: 28, wind: 0.6, dur: 1.2, dmg: 10, speed: 28, stop: 2, root: 0.8, anim: 'cast', cd: 12, w: 1 }] },
  spiderqueen: { name: 'Vyrilla, Brood Mother', title: 'Queen of the Webbed Deep', model: 'spiderqueen', hp: 1900, speed: 4.2, r: 1.6, h: 2.6, gold: [180, 260], blood: 'ichor', groan: 'screech', boss: 1,
    atks: [{ k: 'melee', range: 4.0, arc: 1.6, wind: 0.6, dur: 1.1, dmg: 28, poison: 1, anim: 'bite', cd: 1.8 }, { k: 'cone', min: 0, range: 10, angle: 0.6, wind: 0.6, dur: 1.8, dmg: 7, tick: 0.2, fx: 'poison', anim: 'bite', cd: 7 }, { k: 'summon', what: 'spiderling', count: 6, wind: 0.8, dur: 1.4, anim: 'bite', cd: 12, min: 0, range: 99 }, { k: 'proj', pk: 'web', min: 3, range: 25, wind: 0.6, dur: 1.2, dmg: 6, speed: 18, count: 5, spread: 0.5, slow: 3, anim: 'bite', cd: 6 }, { k: 'leap', min: 6, range: 20, wind: 0.8, dur: 1.6, dmg: 32, radius: 4, anim: 'bite', cd: 9 }, { k: 'hook', pk: 'silk', tether: 'silk', min: 7, range: 28, wind: 0.6, dur: 1.2, dmg: 8, speed: 26, slow: 3, stop: 1.6, root: 1.2, anim: 'bite', cd: 8, w: 1.5 }] },
  warlord: { armored: 1, name: 'Grukk the Warlord', title: 'Chieftain of Gloomroot', model: 'warlord', hp: 2300, speed: 4.0, r: 1.0, h: 3.4, gold: [280, 380], blood: 'red', groan: 'roar', boss: 1,
    atks: [{ k: 'melee', range: 3.6, arc: 1.8, wind: 0.5, dur: 1.0, dmg: 30, anim: 'slash', cd: 1.4 }, { k: 'spin', min: 0, range: 4.5, radius: 4.5, wind: 0.6, dur: 3.0, dmg: 14, tick: 0.35, anim: 'slash', cd: 8 }, { k: 'charge', min: 5, range: 25, wind: 0.9, dur: 2.0, dmg: 38, speed: 20, anim: 'roar', cd: 7 }, { k: 'proj', pk: 'axe', min: 4, range: 25, wind: 0.7, dur: 1.2, dmg: 24, speed: 20, count: 2, spread: 0.2, anim: 'slash', cd: 5 }, { k: 'summon', what: 'goblin', count: 3, alt: 'orc', wind: 1.0, dur: 1.6, anim: 'roar', cd: 16, min: 0, range: 99 }, { k: 'hook', pk: 'harpoon', tether: 'chain', min: 7, range: 27, wind: 0.7, dur: 1.3, dmg: 18, speed: 30, stop: 1.6, root: 0.5, anim: 'slash', cd: 8, w: 1.5 }] },
  dragon: { armored: 1, name: 'Ignaroth the Red', title: 'Scourge of the Forge', model: 'dragon', hp: 2600, speed: 3.6, r: 2.2, h: 4, gold: [320, 420], blood: 'ember', groan: 'roar', boss: 1, immune: 'fire',
    atks: [{ k: 'melee', range: 5.5, arc: 1.4, wind: 0.6, dur: 1.2, dmg: 34, anim: 'bite', cd: 2 }, { k: 'cone', min: 0, range: 14, angle: 0.55, wind: 0.8, dur: 2.4, dmg: 9, tick: 0.2, fx: 'fire', sweep: 1, anim: 'breath', cd: 7 }, { k: 'aoe', at: 'target', min: 0, range: 40, radius: 3, count: 6, spread: 9, delay: 1.5, wind: 1.0, dur: 2.0, dmg: 34, fx: 'meteor', anim: 'roar', cd: 9 }, { k: 'melee', range: 6, arc: 3.2, wind: 0.7, dur: 1.4, dmg: 26, anim: 'tail', cd: 5, behind: 1 }, { k: 'aoe', at: 'self', min: 0, range: 7, radius: 7.5, ring: 1, wind: 1.0, dur: 1.8, dmg: 30, fx: 'slam', anim: 'stomp', cd: 8 }, { k: 'vortex', at: 'self', off: 4.5, min: 0, range: 34, radius: 4.2, reach: 3.2, pull: 1.9, str: 6.2, wind: 0.7, dur: 3.0, dmg: 42, fx: 'fire', color: 0xff5010, anim: 'roar', cd: 11, w: 1.2 }] },
  demonlord: { armored: 1, name: 'Azhrakal, Demon Lord', title: 'Master of the Infernal Forge', model: 'demonlord', hp: 3000, speed: 3.8, r: 1.2, h: 4.4, gold: [420, 560], blood: 'ember', groan: 'roar', boss: 1, immune: 'fire',
    atks: [{ k: 'melee', range: 5.0, arc: 1.8, wind: 0.7, dur: 1.3, dmg: 38, burn: 1, anim: 'slash', cd: 1.8 }, { k: 'aoe', at: 'target', min: 0, range: 40, radius: 3.2, count: 9, spread: 11, delay: 1.6, wind: 1.0, dur: 2.0, dmg: 36, fx: 'meteor', anim: 'cast', cd: 8 }, { k: 'summon', what: 'imp', count: 4, alt: 'hound', wind: 1.0, dur: 1.6, anim: 'roar', cd: 15, min: 0, range: 99 }, { k: 'charge', min: 5, range: 25, wind: 0.8, dur: 1.8, dmg: 40, speed: 22, anim: 'overhead', cd: 8 }, { k: 'aoe', at: 'self', min: 0, range: 6, radius: 7, ring: 1, delay: 0.5, wind: 1.1, dur: 2.0, dmg: 34, fx: 'fire', anim: 'overhead', cd: 9 }, { k: 'hook', pk: 'hellhook', tether: 'hell', count: 2, spread: 0.06, min: 7, range: 30, wind: 0.8, dur: 1.4, dmg: 16, speed: 28, burn: 1, stop: 1.8, root: 0.6, anim: 'cast', cd: 9, w: 1.5 }, { k: 'vortex', at: 'target', min: 8, range: 32, radius: 3.4, reach: 2.6, pull: 1.6, str: 5.8, wind: 0.9, dur: 2.9, dmg: 34, fx: 'fire', color: 0xff3010, anim: 'cast', cd: 12, w: 1 }] }
};

G.DUNGEONS = {
  crypt: { name: 'The Sunken Crypt', desc: 'Flooded catacombs where the dead refuse their rest.', mult: 1, enemies: ['skeleton', 'skelarcher', 'zombie', 'ghoul', 'wraith', 'tombguard'], bosses: ['colossus', 'lich'], minis: ['colossus', 'abbess'], puller: 'revenant', wallH: 4.6, fog: 0x0c1012, fogD: 0.05, hemi: [0x5a6a7a, 0x10100c], color: '#7fa6c8', loot: 1 },
  warrens: { name: 'Gloomroot Warrens', desc: 'Glowing fungal caverns crawling with goblins and spiders.', mult: 1.45, enemies: ['goblin', 'shaman', 'spider', 'orc', 'troll', 'sporeling'], bosses: ['spiderqueen', 'warlord'], minis: ['spiderqueen', 'mycelid'], puller: 'ensnarer', wallH: 5.4, fog: 0x081412, fogD: 0.048, hemi: [0x3a7a7a, 0x100a06], color: '#5fd0b8', loot: 1.6 },
  forge: { name: 'The Infernal Forge', desc: 'Rivers of lava under a citadel of demons.', mult: 2.1, enemies: ['imp', 'hound', 'elemental', 'minotaur', 'gargoyle', 'golem'], bosses: ['dragon', 'demonlord'], minis: ['dragon', 'forgetyrant'], puller: 'warden', wallH: 6.4, fog: 0x1a0806, fogD: 0.042, hemi: [0x8a4a3a, 0x1a0604], color: '#ff7a3a', loot: 2.4 }
};

/* ---------- per-run upgrades (dice) ---------- */
G.TIERS = [
  { name: 'Common', color: '#c9c3b6', range: [1, 6] },
  { name: 'Uncommon', color: '#57d26a', range: [7, 12] },
  { name: 'Rare', color: '#4a9cff', range: [13, 17] },
  { name: 'Legendary', color: '#ffb02e', range: [18, 20] }
];
G.TIERS[-1] = { name: 'Cursed', color: '#c040ff', range: [0, 0] };
G.tierOf = n => n >= 18 ? 3 : n >= 13 ? 2 : n >= 7 ? 1 : 0;
// cat: off | def | mag | util
// cls: limits an upgrade to certain heroes. Only the priest heals; everyone else gets other ways to survive.
G.UPGRADES = [
  // Common
  { id: 'dmg1', t: 0, cat: 'off', icon: '⚔', name: 'Whetstone', desc: '+15% damage', ap: m => m.dmg += 0.15 },
  { id: 'hp1', t: 0, cat: 'def', icon: '♥', name: 'Hearty Stew', desc: '+8 maximum health', ap: m => m.hp += 8 },
  { id: 'as1', t: 0, cat: 'off', icon: '»', name: 'Quick Hands', desc: '+12% attack speed', ap: m => m.atkSpd += 0.12 },
  { id: 'ms1', t: 0, cat: 'util', icon: '➶', name: 'Light Boots', desc: '+10% movement speed', ap: m => m.speed += 0.1 },
  { id: 'st1', t: 0, cat: 'util', icon: '◆', name: 'Second Breath', desc: '+30 stamina and faster stamina recovery', ap: m => { m.sta += 30; m.staRegen += 0.25; } },
  { id: 'cr1', t: 0, cat: 'off', icon: '✦', name: 'Keen Edge', desc: '+8% critical hit chance', ap: m => m.crit += 0.08 },
  { id: 'mn1', t: 0, cat: 'mag', icon: '✧', name: 'Mana Draught', desc: '+30 mana and +40% mana regeneration', cls: ['wizard', 'priest'], ap: m => { m.mana += 30; m.manaRegen += 0.4; } },
  { id: 'ar1', t: 0, cat: 'def', icon: '⛨', name: 'Riveted Plates', desc: 'Take 8% less damage', ap: m => m.armor += 0.08 },
  { id: 'ab1', t: 0, cat: 'util', icon: '📖', name: 'Training Manual', desc: '+1 ability point to spend on your character sheet (C)', ap: (m, p) => { p.abPts += 1; } },
  { id: 'pr1', t: 0, cat: 'mag', icon: '📿', name: 'Prayer Beads', desc: 'Holy Light heals an extra 1d6', cls: ['priest'], ap: m => m.healDice += 1 },
  // Uncommon
  { id: 'chain1', t: 1, cat: 'off', icon: '⚡', name: 'Arcing Strikes', desc: 'Hits chain to 1 nearby enemy for 50% damage', ap: m => { m.chain += 1; } },
  { id: 'ign1', t: 1, cat: 'mag', icon: '🔥', name: 'Ember Coating', desc: '25% chance on hit to ignite: 1d4 fire each second for 4 seconds', ap: m => m.ignite += 0.25 },
  { id: 'frz1', t: 1, cat: 'mag', icon: '❄', name: 'Rime Touch', desc: '18% chance on hit to freeze the target solid', ap: m => m.freeze += 0.18 },
  { id: 'thn1', t: 1, cat: 'def', icon: '✹', name: 'Barbed Mail', desc: 'Reflect 40% of melee damage you take', ap: m => m.thorns += 0.4 },
  { id: 'dmg2', t: 1, cat: 'off', icon: '⚔', name: 'Tempered Steel', desc: '+30% damage', ap: m => m.dmg += 0.3 },
  { id: 'last1', t: 1, cat: 'off', icon: '☠', name: 'Last Stand', desc: 'Below 30% health you deal +40% damage', ap: m => m.lastStand += 0.4 },
  { id: 'cd1', t: 1, cat: 'mag', icon: '⌛', name: 'Quickened Mind', desc: 'Abilities recharge 20% faster', ap: m => m.cdr += 0.2 },
  { id: 'dash1', t: 1, cat: 'util', icon: '↯', name: 'Shadowstep Boots', desc: 'Dodging costs 40% less stamina and grants 0.2 s more invulnerability', ap: m => { m.dodgeCost += 0.4; m.dodgeIF += 0.2; } },
  { id: 'bleed1', t: 1, cat: 'off', icon: '🗡', name: 'Serrated Edge', desc: 'Physical hits cause bleeding: 1d4 each second for 3 seconds', ap: m => m.bleed += 2.5 },
  { id: 'gold1', t: 1, cat: 'util', icon: '◎', name: 'Lucky Coin', desc: '+50% gold and better loot drops', ap: m => m.greed += 0.5 },
  { id: 'ab2', t: 1, cat: 'util', icon: '📘', name: 'Tome of Understanding', desc: '+2 ability points to spend on your character sheet (C)', ap: (m, p) => { p.abPts += 2; } },
  { id: 'pr2', t: 1, cat: 'def', icon: '☼', name: 'Beacon of Light', desc: 'When you heal allies, you heal for half as much', cls: ['priest'], ap: m => m.beacon = 1 },
  // Rare
  { id: 'chain3', t: 2, cat: 'mag', icon: '⚡', name: 'Storm Conduit', desc: 'Hits chain lightning to 3 enemies for 60% damage', ap: m => { m.chain += 3; m.chainDmg = Math.max(m.chainDmg, 0.6); } },
  { id: 'boom', t: 2, cat: 'off', icon: '✺', name: 'Volatile Corpses', desc: 'Slain enemies explode for 2d8 fire', ap: m => m.explodeKill += 1 },
  { id: 'storm', t: 2, cat: 'off', icon: '⟳', name: 'Blade Tempest', desc: 'Every 4th attack unleashes a whirlwind that rolls your weapon dice against everything nearby', ap: m => m.tempest += 1 },
  { id: 'bers', t: 2, cat: 'off', icon: '☠', name: 'Berserker Blood', desc: '+60% damage while below half health', ap: m => m.berserk += 0.6 },
  { id: 'icearm', t: 2, cat: 'def', icon: '❄', name: 'Glacial Bulwark', desc: 'Blocking freezes melee attackers. Take 12% less damage', ap: m => { m.iceBlock = 1; m.armor += 0.12; } },
  { id: 'wide', t: 2, cat: 'off', icon: '⤧', name: 'Sweeping Reach', desc: '+35% melee reach and arc. +2 projectiles per shot', ap: m => { m.reach += 0.35; m.multishot += 2; } },
  { id: 'aura', t: 2, cat: 'mag', icon: '☀', name: 'Radiant Aura', desc: 'Searing light burns nearby enemies for 1d4 each half second', ap: m => m.aura += 1 },
  { id: 'ab3', t: 2, cat: 'util', icon: '📕', name: 'Manual of Bodily Health', desc: '+3 ability points to spend on your character sheet (C)', ap: (m, p) => { p.abPts += 3; } },
  { id: 'pr3', t: 2, cat: 'mag', icon: '✚', name: 'Mass Healing Word', desc: 'Holy Light reaches twice as far, heals 50% more and recharges 30% faster', cls: ['priest'], ap: m => { m.massHeal = 1; m.healMul += 0.5; } },
  // Legendary
  { id: 'phoenix', t: 3, cat: 'def', icon: '🜂', name: 'Phoenix Feather', desc: 'The first time you would die, rise in flames with 40% health instead', ap: m => m.phoenix += 1 },
  { id: 'doom', t: 3, cat: 'mag', icon: '⚡', name: 'Wrath of the Storm God', desc: 'Hits chain to 6 enemies, igniting each one', ap: m => { m.chain += 6; m.chainDmg = Math.max(m.chainDmg, 0.75); m.ignite += 0.5; } },
  { id: 'avatar', t: 3, cat: 'off', icon: '♛', name: 'Avatar of War', desc: '+60% damage, +25% speed, +15 maximum health', ap: m => { m.dmg += 0.6; m.speed += 0.25; m.hp += 15; } },
  { id: 'meteor', t: 3, cat: 'mag', icon: '☄', name: 'Starfall', desc: 'Every kill calls a 4d6 meteor onto the nearest enemy', ap: m => m.meteorKill += 1 },
  { id: 'chrono', t: 3, cat: 'util', icon: '⧗', name: 'Chrono Shard', desc: 'Enemies near you move and attack 25% slower. +30% attack speed', ap: m => { m.chrono += 0.25; m.atkSpd += 0.3; } },
  { id: 'titan', t: 3, cat: 'def', icon: '⛰', name: 'Titan Heart', desc: '+30 maximum health, 25% less damage taken, immune to knockback', ap: m => { m.hp += 30; m.armor += 0.25; m.titan = 1; } },
  { id: 'ab4', t: 3, cat: 'util', icon: '🌟', name: 'Wish', desc: '+5 ability points to spend on your character sheet (C)', ap: (m, p) => { p.abPts += 5; } }
];
// offered when an NPC roll comes up a natural 1: real power with a real price
G.CURSED = [
  { id: 'c_blood', t: -1, cat: 'off', icon: '🩸', name: 'Blood Price', desc: '+40% damage. Your maximum health is 20% lower', ap: m => { m.dmg += 0.4; m.hpPct -= 0.2; } },
  { id: 'c_glass', t: -1, cat: 'util', icon: '🫙', name: 'Glass Bones', desc: '+3 ability points. You take 25% more damage', ap: (m, p) => { p.abPts += 3; m.armor -= 0.25; } },
  { id: 'c_hunger', t: -1, cat: 'off', icon: '🦴', name: 'Hollow Hunger', desc: '+30% attack speed. Healing flasks restore half as much', ap: m => { m.atkSpd += 0.3; m.flaskMul *= 0.5; } },
  { id: 'c_mark', t: -1, cat: 'util', icon: '👁', name: "Gambler's Mark", desc: '+60% gold found. −2 to every check and save', ap: (m, p) => { m.greed += 0.6; p.hex += 2; } },
  { id: 'c_frenzy', t: -1, cat: 'off', icon: '🔪', name: 'Red Frenzy', desc: '+20% critical chance. Blocking costs twice the stamina', ap: m => { m.crit += 0.2; m.blockCost += 1; } }
];
G.baseMods = () => ({ dmg: 0, hp: 0, hpPct: 0, atkSpd: 0, speed: 0, sta: 0, staRegen: 0, crit: 0, mana: 0, manaRegen: 0, armor: 0, chain: 0, chainDmg: 0.5, ignite: 0, freeze: 0, thorns: 0, lastStand: 0, cdr: 0, dodgeCost: 0, dodgeIF: 0, bleed: 0, greed: 0, explodeKill: 0, tempest: 0, berserk: 0, iceBlock: 0, reach: 0, multishot: 0, aura: 0, phoenix: 0, meteorKill: 0, chrono: 0, titan: 0, healDice: 0, healMul: 1, massHeal: 0, beacon: 0, flaskMul: 1, blockCost: 0 });

/* ---------- hideout upgrades ---------- */
/* ---------- the arsenal: weapons each hero can buy at the smith and swap between in the hideout ----------
   atk overrides G.CLASS_ATK, dice overrides the D&D weapon dice, hit applies to every hit, fin to the combo finisher */
G.ARSENAL = {
  knight: [
    { id: 'sword', name: 'Longsword', icon: '🗡', desc: 'Balanced cuts and a lunging thrust. Sword and board.' },
    { id: 'warhammer', name: 'Warhammer', icon: '🔨', cost: 480, desc: 'Slow, crushing overhead blows (1d10 blunt, ignores armor). The third strike stuns and sends out a shockwave.', atk: { dmg: 30, time: 0.68, range: 2.7, arc: 1.7, type: 'blunt', hitAt: 0.5, combo: ['overR', 'slashL', 'smash'] }, dice: { n: 1, d: 10, type: 'blunt' }, fin: { stun: 1.6, shock: 2.6, knock: 1.6 } },
    { id: 'spear', name: 'War Spear', icon: '⟋', cost: 450, desc: 'Fast thrusts with long reach (1d8 pierce, 3.9 m). The finisher skewers every foe in a line.', atk: { dmg: 22, time: 0.48, range: 3.9, arc: 0.75, type: 'pierce', combo: ['thrust', 'stab', 'thrust'] }, dice: { n: 1, d: 8, type: 'pierce' }, fin: { line: 5, knock: 2 } }
  ],
  barbarian: [
    { id: 'greataxe', name: 'Greataxe', icon: '🪓', desc: 'Huge cleaving arcs that hit everything in front of you.', twoHand: 1 },
    { id: 'twinaxes', name: 'Twin Hand Axes', icon: '⚔', cost: 520, desc: 'A storm of alternating chops (1d6 slash each, very fast). Every hit opens a bleeding wound.', dual: 1, guard: 'gd', atk: { dmg: 20, time: 0.4, range: 2.6, arc: 1.9, combo: ['slashR', 'lslash', 'slashR', 'cross'] }, dice: { n: 1, d: 6 }, hit: { bleed: 1.5 } },
    { id: 'maul', name: 'Earthsplitter Maul', icon: '🔨', cost: 620, desc: 'Monstrous two-handed hammer (2d6 blunt, ignores armor). Every blow cracks the ground around the target; the slam stuns.', twoHand: 1, atk: { dmg: 48, time: 1.05, range: 3.0, arc: 2.2, type: 'blunt', hitAt: 0.52, combo: ['overR', 'slam'] }, dice: { n: 2, d: 6, type: 'blunt' }, hit: { shock: 2.2 }, fin: { stun: 1.4, shock: 4, knock: 2.2 } }
  ],
  rogue: [
    { id: 'daggers', name: 'Twin Daggers', icon: '🗡', desc: 'Lightning-quick stabs, deadly from behind.', dual: 1 },
    { id: 'rapier', name: "Duelist's Rapier", icon: '🤺', cost: 460, desc: 'Precise lunges with reach (1d8 pierce, 2.9 m) and a parrying dagger: parry window is twice as wide, +10% crit.', dual: 1, atk: { dmg: 18, time: 0.36, range: 2.9, arc: 0.95, crit: 0.32, combo: ['thrust', 'stab', 'stabL', 'thrust'], parry: 0.44 }, dice: { n: 1, d: 8 } },
    { id: 'kukris', name: 'Venom Kukris', icon: '☠', cost: 500, desc: 'Curved slashing blades (1d6 slash) coated in venom: every hit poisons and slows.', dual: 1, atk: { dmg: 15, time: 0.32, range: 2.4, arc: 1.7, type: 'slash', combo: ['slashR', 'lslash', 'slashR', 'cross'] }, dice: { n: 1, d: 6, type: 'slash' }, hit: { bleed: 1.2, slow: 1.5, venom: 1 } }
  ],
  archer: [
    { id: 'longbow', name: 'Longbow', icon: '🏹', desc: 'Hold to draw, release to fire. Full draws pierce.' },
    { id: 'shortbow', name: "Hunter's Shortbow", icon: '🏹', cost: 450, desc: 'Draws twice as fast (1d6 pierce). A full draw looses two arrows at once.', atk: { draw: 0.42, dmg: 14 }, dice: { n: 1, d: 6 }, fullExtra: 1, scale: 0.82 },
    { id: 'warbow', name: 'Siege Warbow', icon: '🏹', cost: 600, desc: 'A massive bow with a slow draw (1d12 pierce). Full draws punch through four foes and knock them back.', atk: { draw: 1.3, dmg: 30 }, dice: { n: 1, d: 12 }, fullPierce: 4, fullKnock: 1.6, scale: 1.2, dark: 1 }
  ],
  wizard: [
    { id: 'ember', name: 'Ember Staff', icon: '🔥', desc: 'Firebolts that burst on impact.' },
    { id: 'rime', name: 'Rime Staff', icon: '❄', cost: 480, desc: 'Fires a fan of three ice shards that slow (each about half a 1d6 cold roll); three hits on one foe freeze it solid.', atk: { mana: 6, time: 0.44 }, dice: { n: 1, d: 6, type: 'ice' }, prim: 'shards', orb: 0x7ad8ff },
    { id: 'storm', name: 'Tempest Staff', icon: '⚡', cost: 560, desc: 'Instant lightning at whatever you point at (1d8), arcing to a second foe.', atk: { mana: 9, time: 0.5 }, dice: { n: 1, d: 8, type: 'lightning' }, prim: 'bolt', orb: 0xb08aff }
  ],
  priest: [
    { id: 'mace', name: 'Sanctified Mace', icon: '✚', desc: 'Holy mace; blows sometimes burst with radiant light.' },
    { id: 'warhammer', name: 'Templar Warhammer', icon: '🔨', cost: 480, desc: 'Heavy blessed hammer (1d10 blunt). The finisher stuns and rings out a shockwave.', atk: { dmg: 32, time: 0.74, type: 'blunt', hitAt: 0.5, combo: ['overR', 'slashL', 'smash'] }, dice: { n: 1, d: 10 }, fin: { stun: 1.5, shock: 2.6, knock: 1.4 } },
    { id: 'sunstaff', name: 'Sunstaff', icon: '☀', cost: 540, desc: 'Long sweeping staff (1d6, 3.0 m). The finisher releases a pulse of sunlight that burns foes and heals allies around you.', atk: { dmg: 20, time: 0.55, range: 3.0, arc: 2.0, combo: ['slashR', 'slashL', 'smash'] }, dice: { n: 1, d: 6 }, fin: { sun: 3.8 } }
  ]
};
G.weaponDef = (cls, i) => { const L = G.ARSENAL[cls] || []; return L[G.clamp(i | 0, 0, L.length - 1)] || L[0] || {}; };
G.weaponAtk = (cls, i) => Object.assign({}, G.CLASS_ATK[cls], G.weaponDef(cls, i).atk || {});

/* ---------- spellbooks: extra spells wizards and priests learn at the library and bind to G and V ---------- */
G.SPELLS = {
  wizard: {
    meteor: { name: 'Meteor', icon: '☄', cost: 520, mana: 45, cd: 14, cast: 0.9, desc: 'Call down a burning meteor at your aim point (35 m): 4d8 fire in 4.5 m and sets the ground ablaze.' },
    missiles: { name: 'Arcane Missiles', icon: '✶', cost: 380, mana: 28, cd: 7, desc: 'Five seeking bolts of force (1d4 + INT each) that home in on the foes in front of you.' },
    blink: { name: 'Blink', icon: '⤳', cost: 340, mana: 15, cd: 6, desc: 'Teleport up to 12 m where you look. The space you leave implodes: 1d6 force and a slow on anything nearby.' },
    icelance: { name: 'Ice Lance', icon: '❅', cost: 440, mana: 24, cd: 5, cast: 0.4, desc: 'A spear of ice that pierces five foes (2d8 + INT cold). Frozen targets shatter for triple damage.' }
  },
  priest: {
    sanctuary: { name: 'Sanctuary', icon: '۞', cost: 480, mana: 40, cd: 20, cast: 0.6, desc: 'Consecrate the ground around you (5 m) for 6 s: allies inside heal 1d4 + WIS every second, foes burn for 1d6 radiant.' },
    ward: { name: 'Divine Ward', icon: '⛉', cost: 420, mana: 30, cd: 16, desc: 'A golden shell on you and every ally within 8 m that absorbs 15 + 3×WIS damage for 8 s.' },
    radiant: { name: 'Radiant Burst', icon: '✺', cost: 380, mana: 28, cd: 9, desc: 'A blinding cone of light (7 m): 3d6 + WIS radiant, double against the undead, knocks foes back and slows them.' },
    guardians: { name: 'Spirit Guardians', icon: '❂', cost: 560, mana: 45, cd: 22, desc: 'Three spirits circle you for 10 s, striking every foe within 3.5 m for 1d8 radiant and slowing them.' }
  }
};

G.HIDEOUT = {
  weapon: { costs: [150, 420, 950, 1900], names: ['Iron', 'Steel', 'Mithril', 'Runic', 'Legendary'] },
  backpack: { costs: [100, 320, 750, 1600], slots: [8, 12, 16, 22, 30], names: ['Satchel', 'Rucksack', 'Explorer Pack', 'Bag of Holding', 'Dimensional Hoard'] },
  armor: { costs: [120, 300, 650, 1200, 2200], hp: 5, red: 0.04 },
  luck: { costs: [250, 700, 1600], },
  flask: { costs: [100, 350, 800] },
  ab2: { unlock: 300, ranks: [500, 1100] }
};

/* ---------- loot ---------- */
G.LOOT = [
  { id: 'coinpurse', name: 'Coin Purse', model: 'coins', v: 0, value: 18, w: 10 },
  { id: 'ring', name: 'Jade Signet Ring', model: 'ring', v: 0, value: 32, w: 7 },
  { id: 'ruby', name: 'Blood Ruby', model: 'gem', v: 0, value: 45, w: 6 },
  { id: 'sapph', name: 'Deep Sapphire', model: 'gem', v: 1, value: 55, w: 5 },
  { id: 'emer', name: 'Glowing Emerald', model: 'gem', v: 2, value: 60, w: 5 },
  { id: 'amethyst', name: 'Void Amethyst', model: 'gem', v: 3, value: 85, w: 3 },
  { id: 'chalice', name: 'Silver Chalice', model: 'chalice', v: 0, value: 40, w: 6 },
  { id: 'gchalice', name: 'Gilded Chalice', model: 'chalice', v: 1, value: 90, w: 3 },
  { id: 'idol', name: 'Golden Idol', model: 'idol', v: 0, value: 120, w: 2 },
  { id: 'scroll', name: 'Ancient Scroll', model: 'scroll', v: 0, value: 35, w: 6 },
  { id: 'relic', name: 'Saint\'s Reliquary', model: 'relic', v: 0, value: 75, w: 4 },
  { id: 'crown', name: 'Forgotten Crown', model: 'crown', v: 0, value: 200, w: 1 },
  { id: 'elixir', name: 'Alchemist\'s Elixir', model: 'potion', v: 2, value: 28, w: 6 }
];
G.rollLoot = (r = Math.random, bonus = 0) => {
  const pool = G.LOOT.map(l => ({ l, w: l.w * (l.value > 70 ? 1 + bonus : 1) }));
  let t = pool.reduce((a, b) => a + b.w, 0) * r();
  for (const p of pool) { t -= p.w; if (t <= 0) return p.l; }
  return pool[0].l;
};

/* ---------- NPCs ---------- */
G.NPCS = [
  { id: 'oracle', name: 'Seer Maelis', role: 'Blind Oracle', cat: ['mag', 'util'], model: 'oracle',
    hello: ['The bones whisper your name, wanderer. Shall we ask them what fate you carry?', 'I have seen this moment in the smoke. Cast the die, and I will shape what the stars allow.', 'Sit. The dark is long, and the dice are honest. More honest than the gods.'],
    good: 'The stars bend low for you. Choose well.', bad: 'A thin thread of fortune. Still, a thread.', legend: 'A crown of fate! Even the dead would kneel.' },
  { id: 'dwarf', name: 'Brom Ironbrow', role: 'Wandering Smith', cat: ['off', 'def'], model: 'dwarf',
    hello: ['Oi! Another fool down the hole. Toss the bones and I\'ll sharpen whatever luck you\'ve got.', 'Forge is cold but me hammer\'s warm. Roll, and let\'s see what steel you deserve.', 'Ha! Ye look like ye could use a better edge. Roll the die, friend.'],
    good: 'Now THAT\'S a roll worth a hammer-swing!', bad: 'Bah. Even scrap can cut if ye swing it hard enough.', legend: 'By the deep forges! A masterwork roll!' },
  { id: 'ghost', name: 'Sir Aldric', role: 'Lost Knight', cat: ['def', 'off'], model: 'ghost',
    hello: ['I fell here a hundred winters past. Let my oath live on in you. Roll, and receive my blessing.', 'You fight as I once did. Take a measure of my strength, as fortune allows.', 'Halt, traveler. The dead remember valor. Cast the die.'],
    good: 'Valor answers valor. Rise stronger.', bad: 'Even a small blessing has turned a battle.', legend: 'My full oath, then. Carry it to the end of the dark.' },
  { id: 'shrine', name: 'The Whispering Skull', role: 'Shrine of Chance', cat: ['mag', 'off', 'def', 'util'], model: 'shrine',
    hello: ['heh heh heh... a gamble, a gamble! Roll the bones, fleshling, roll them!', 'Twenty faces, twenty fates! Which one wears your doom? Roll!', 'Feed me your luck... and I shall feed you power. Roll, roll, roll!'],
    good: 'Ooooh, delicious fortune!', bad: 'Heh. Pathetic. Take your scraps.', legend: 'TWENTY! THE BONES SING! TAKE IT ALL!' }
];
G.QUIPS = {
  floorStart: ['The air turns cold as you descend.', 'Somewhere below, something is waiting.', 'Stone groans. The dungeon shifts.'],
  bossNear: 'A terrible presence stirs ahead...'
};
