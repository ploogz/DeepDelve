/* ============================================================
   The Abyssal Sanctum: the fourth dungeon.
   A drowned cathedral at the bottom of the world where the void seeps through: obsidian walls veined with
   violet light, floating crystal, eyes in the dark. Cultists, void stalkers, gazers, horrors, crystal
   shardlings and hollow knights; the Elder Gazer and the Harbinger guard the middle; the Hollow King and
   the Starving Dark wait at the bottom.
   ============================================================ */
'use strict';
(() => {
  const VOID = 0xa060ff;
  const mats = () => ({
    obs: G.mat('col', { c: 0x15111d, m: 0.55, r: 0.22 }), obs2: G.mat('col', { c: 0x241c34, m: 0.5, r: 0.3 }),
    glow: G.mat('emissive', { c: VOID, i: 2.6 }), glowB: G.mat('emissive', { c: 0x70a0ff, i: 2.4 }),
    crys: G.mat('col', { c: 0x9a70ff, tr: 0.55, r: 0.05, e: 0x5a20c0, ei: 1.3 }),
    robe: G.mat('col', { c: 0x1c1228, t: 'cloth', r: 0.95, ds: true }), robe2: G.mat('col', { c: 0x2e1c48, t: 'cloth', r: 0.95, ds: true }),
    pale: G.mat('col', { c: 0x8a8498, t: 'skin', r: 0.55 }), flesh: G.mat('col', { c: 0x3a2c4a, t: 'skin', r: 0.5, e: 0x14062a, ei: 0.5 }),
    gold: G.mat('col', { c: 0x8a7a50, m: 0.85, r: 0.35 })
  });
  const glowSprite = (par, col, s, pos = [0, 0, 0]) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.tex.sprite('glow'), color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); sp.scale.setScalar(s); sp.position.set(...pos); par.add(sp); return sp; };

  /* ---------------- data ---------------- */
  Object.assign(G.ENEMIES, {
    cultist: { name: 'Void Cultist', model: 'cultist', hp: 75, speed: 3.8, r: 0.42, h: 1.9, gold: [9, 16], blood: 'red', groan: 'groan', ranged: 11,
      atks: [{ k: 'proj', pk: 'arcane', min: 3, range: 21, wind: 0.6, dur: 1.0, dmg: 13, speed: 14, homing: 1.2, anim: 'cast', cd: 2.2 }, { k: 'aoe', at: 'target', min: 3, range: 18, radius: 2.4, delay: 1.1, wind: 0.6, dur: 1.3, dmg: 20, fx: 'implode', anim: 'cast', cd: 7, w: 0.8 },
        { k: 'blink', min: 0, range: 30, wind: 0.4, dur: 0.8, cd: 7, anim: 'cast', w: 0.5 }, { k: 'melee', range: 2.0, arc: 1.3, wind: 0.4, dur: 0.8, dmg: 11, anim: 'thrust', cd: 1.3 }] },
    stalker: { name: 'Void Stalker', model: 'stalker', hp: 115, speed: 6.6, r: 0.6, h: 1.2, gold: [9, 16], blood: 'ecto', groan: 'screech',
      atks: [{ k: 'melee', range: 2.4, arc: 1.2, wind: 0.28, dur: 0.6, dmg: 14, anim: 'bite', cd: 0.95 }, { k: 'blink', min: 0, range: 30, wind: 0.3, dur: 0.6, cd: 5, anim: 'roar', w: 0.8 }, { k: 'leap', min: 4, range: 12, wind: 0.4, dur: 1.0, dmg: 18, radius: 2.2, anim: 'bite', cd: 4.5, w: 0.8 }] },
    gazer: { name: 'Gazing Horror', model: 'gazer', hp: 100, speed: 2.8, r: 0.6, h: 2.0, gold: [11, 19], blood: 'ecto', groan: 'screech', fly: true, ranged: 12,
      atks: [{ k: 'beam', min: 2, range: 18, wind: 0.9, dur: 2.6, sweep: 1.1, width: 0.7, dmg: 6, tick: 0.2, color: VOID, anim: 'cast', cd: 7 }, { k: 'proj', pk: 'arcane', min: 3, range: 20, wind: 0.6, dur: 1.1, dmg: 9, speed: 13, count: 3, spread: 0.4, homing: 0.8, anim: 'cast', cd: 3.2 },
        { k: 'blink', min: 0, range: 30, wind: 0.4, dur: 0.8, cd: 8, anim: 'cast', w: 0.4 }] },
    horror: { armored: 1, name: 'Abyssal Horror', model: 'horror', hp: 270, speed: 3.1, r: 0.75, h: 2.7, gold: [14, 24], blood: 'ichor', groan: 'roar',
      atks: [{ k: 'melee', range: 3.0, arc: 1.7, wind: 0.65, dur: 1.2, dmg: 28, anim: 'claw', cd: 1.7 }, { k: 'ring', min: 0, range: 8, count: 1, speed: 9, maxR: 10, wind: 0.9, dur: 2.2, dmg: 20, color: VOID, anim: 'roar', cd: 6.5 },
        { k: 'vortex', at: 'self', off: 1.5, min: 0, range: 9, radius: 3.2, reach: 3, pull: 1.6, str: 5, wind: 0.7, dur: 2.6, dmg: 22, fx: 'implode', color: VOID, anim: 'roar', cd: 10, w: 0.8 }] },
    shardling: { name: 'Crystal Shardling', model: 'shardling', hp: 50, speed: 5.4, r: 0.4, h: 1.3, gold: [6, 12], blood: 'stone', groan: 'shatter', armor: 0.15,
      atks: [{ k: 'melee', range: 2.0, arc: 1.4, wind: 0.35, dur: 0.7, dmg: 10, anim: 'claw', cd: 1.1 }, { k: 'explode', min: 0, range: 2.8, radius: 3.6, wind: 1.1, dur: 1.2, dmg: 34, fx: 'implode', anim: 'roar', cd: 99, lowHp: 1, w: 3 }] },
    voidknight: { armored: 1, name: 'Hollow Knight', model: 'voidknight', hp: 210, speed: 3.3, r: 0.58, h: 2.2, gold: [13, 22], blood: 'ecto', groan: 'roar', armor: 0.2,
      atks: [{ k: 'melee', range: 2.8, arc: 1.5, wind: 0.55, dur: 1.1, dmg: 24, anim: 'slash', cd: 1.5 }, { k: 'shield', min: 0, range: 7, wind: 0.15, dur: 3.0, anim: 'slash', cd: 6.5, w: 1.4 }, { k: 'charge', min: 4, range: 14, wind: 0.7, dur: 1.5, dmg: 24, speed: 15, anim: 'roar', cd: 7 },
        { k: 'melee', range: 3.0, arc: 2.4, wind: 0.8, dur: 1.4, dmg: 32, anim: 'overhead', cd: 6, w: 0.6 }] },
    binder: { name: 'Void Binder', model: 'binder', hp: 120, speed: 3.4, r: 0.5, h: 2.1, gold: [11, 19], blood: 'ecto', groan: 'groan', puller: 1, fly: true,
      atks: [{ k: 'melee', range: 2.3, arc: 1.4, wind: 0.45, dur: 0.9, dmg: 16, anim: 'claw', cd: 1.4 }, { k: 'hook', pk: 'chain', tether: 'void', min: 5, range: 22, wind: 0.7, dur: 1.2, dmg: 9, speed: 27, stop: 1.3, root: 0.7, anim: 'cast', cd: 5.5, w: 2 },
        { k: 'vortex', at: 'target', min: 4, range: 20, radius: 2.8, reach: 2.6, pull: 1.5, str: 4.6, wind: 0.8, dur: 2.4, dmg: 18, fx: 'implode', color: VOID, anim: 'cast', cd: 8, w: 1.4 }] }
  });
  Object.assign(G.BOSSES, {
    eldergazer: { name: 'The Elder Gazer', title: 'Eye of the Sanctum', model: 'eldergazer', hp: 2300, speed: 2.4, r: 1.5, h: 4.4, gold: [220, 300], blood: 'ecto', groan: 'screech', boss: 1, fly: true, ranged: 12,
      atks: [{ k: 'beam', min: 0, range: 30, wind: 1.0, dur: 3.8, sweep: 2.2, width: 1.0, dmg: 10, tick: 0.2, color: VOID, anim: 'cast', cd: 7 }, { k: 'proj', pk: 'arcane', min: 0, range: 30, wind: 0.6, dur: 1.2, dmg: 13, speed: 12, count: 7, spread: 0.9, homing: 1.1, anim: 'cast', cd: 4 },
        { k: 'ring', min: 0, range: 30, count: 3, gap: 0.6, speed: 9, maxR: 18, wind: 0.9, dur: 3.4, dmg: 18, color: VOID, anim: 'roar', cd: 7 }, { k: 'summon', what: 'shardling', count: 3, wind: 1, dur: 1.4, anim: 'cast', cd: 14, min: 0, range: 99 }, { k: 'blink', min: 0, range: 30, wind: 0.4, dur: 0.8, cd: 9, anim: 'cast', w: 0.6 }] },
    harbinger: { name: 'The Harbinger', title: 'Voice of the Deep', model: 'harbinger', hp: 2200, speed: 3.2, r: 1.0, h: 3.8, gold: [220, 300], blood: 'red', groan: 'roar', boss: 1, fly: true, ranged: 11,
      atks: [{ k: 'aoe', at: 'target', min: 0, range: 34, radius: 2.6, count: 7, spread: 8, delay: 1.3, wind: 0.8, dur: 1.6, dmg: 26, fx: 'implode', anim: 'cast', cd: 6 }, { k: 'proj', pk: 'arcane', min: 0, range: 30, wind: 0.6, dur: 1.2, dmg: 15, speed: 12, count: 5, spread: 0.6, homing: 1.3, anim: 'cast', cd: 3.4 },
        { k: 'summon', what: 'cultist', count: 3, alt: 'stalker', wind: 1, dur: 1.6, anim: 'cast', cd: 15, min: 0, range: 99 }, { k: 'vortex', at: 'target', min: 0, range: 30, radius: 3.4, reach: 3, pull: 1.8, str: 5.4, wind: 0.8, dur: 2.8, dmg: 26, fx: 'implode', color: VOID, anim: 'cast', cd: 9 },
        { k: 'hook', pk: 'chain', tether: 'void', min: 7, range: 26, wind: 0.7, dur: 1.3, dmg: 12, speed: 28, stop: 2, root: 0.7, anim: 'cast', cd: 10, w: 1.2 }, { k: 'blink', min: 0, range: 99, wind: 0.5, dur: 1.0, anim: 'cast', cd: 8 }] },
    hollowking: { armored: 1, name: 'The Hollow King', title: 'Last Crown of the Sanctum', model: 'hollowking', hp: 3300, speed: 3.6, r: 1.3, h: 4.8, gold: [460, 600], blood: 'ecto', groan: 'roar', boss: 1, armor: 0.15,
      atks: [{ k: 'melee', range: 5.2, arc: 1.8, wind: 0.65, dur: 1.3, dmg: 40, anim: 'slash', cd: 1.7 }, { k: 'charge', min: 5, range: 26, wind: 0.8, dur: 1.8, dmg: 42, speed: 22, anim: 'roar', cd: 7 }, { k: 'shield', min: 0, range: 8, wind: 0.15, dur: 2.8, anim: 'slash', cd: 9, w: 1 },
        { k: 'aoe', at: 'self', min: 0, range: 7, radius: 7.5, ring: 1, delay: 0.4, wind: 1.0, dur: 1.9, dmg: 36, fx: 'implode', anim: 'overhead', cd: 7 }, { k: 'aoe', at: 'target', min: 0, range: 40, radius: 3, count: 8, spread: 10, delay: 1.5, wind: 0.9, dur: 2.0, dmg: 34, fx: 'implode', anim: 'roar', cd: 9 },
        { k: 'summon', what: 'voidknight', count: 2, alt: 'shardling', wind: 1.0, dur: 1.6, anim: 'roar', cd: 16, min: 0, range: 99 }, { k: 'hook', pk: 'chain', tether: 'void', min: 7, range: 28, wind: 0.7, dur: 1.3, dmg: 16, speed: 28, stop: 2, root: 0.6, anim: 'cast', cd: 9, w: 1.3 }] },
    devourer: { name: 'The Starving Dark', title: 'That Which Waits Below', model: 'devourer', hp: 3600, speed: 2.8, r: 1.8, h: 5.6, gold: [480, 640], blood: 'ichor', groan: 'roar', boss: 1,
      atks: [{ k: 'melee', range: 6, arc: 2.0, wind: 0.8, dur: 1.5, dmg: 42, anim: 'claw', cd: 2 }, { k: 'ring', min: 0, range: 30, count: 3, gap: 0.6, speed: 9, maxR: 20, wind: 1.0, dur: 3.6, dmg: 24, color: VOID, anim: 'roar', cd: 7 },
        { k: 'vortex', at: 'self', off: 3, min: 0, range: 30, radius: 4.2, reach: 4, pull: 2.2, str: 6.4, wind: 0.8, dur: 3.2, dmg: 36, fx: 'implode', color: VOID, anim: 'roar', cd: 10 }, { k: 'beam', min: 0, range: 30, wind: 1.1, dur: 3.8, sweep: 2.4, width: 1.0, dmg: 11, tick: 0.2, color: VOID, anim: 'cast', cd: 8 },
        { k: 'summon', what: 'horror', count: 1, alt: 'gazer', wind: 1.0, dur: 1.6, anim: 'roar', cd: 16, min: 0, range: 99 }, { k: 'aoe', at: 'target', min: 0, range: 40, radius: 3, count: 7, spread: 9, delay: 1.4, wind: 0.9, dur: 1.9, dmg: 32, fx: 'implode', anim: 'cast', cd: 8 }] }
  });
  G.DUNGEONS.forge.mult = 1.85;   // a gentler climb out of the forge, so the sanctum is the real step up
  G.DUNGEONS.abyss = { name: 'The Abyssal Sanctum', desc: 'A drowned cathedral at the bottom of the world, where the void leaks through the stone.', mult: 2.7, enemies: ['cultist', 'stalker', 'gazer', 'horror', 'shardling', 'voidknight'], bosses: ['hollowking', 'devourer'], minis: ['eldergazer', 'harbinger'], puller: 'binder', cower: 'cultist', wallH: 7.2, fog: 0x0a0614, fogD: 0.036, hemi: [0x5a4a9a, 0x0a0610], color: '#a070ff', loot: 3.1, rec: 'Runic weapon · armor 3+' };
  G.DUNGEONS.crypt.rec = 'Any hero'; G.DUNGEONS.warrens.rec = 'Steel weapon'; G.DUNGEONS.forge.rec = 'Mithril weapon';
  G.ALL_TYPES = Object.keys(G.ENEMIES).concat(Object.keys(G.BOSSES));

  /* ---------------- enemy models ---------------- */
  const E = M.enemy;
  // robed cultist: hood, pale masked face with burning eyes, a void orb in the left hand and a curved knife in the right
  E.cultist = (scale = 1, big = false, binder = false) => {
    const m = mats(), R = M.humanoid({ top: m.robe, bottom: m.robe, sleeve: m.robe, bulk: big ? 1.15 : 0.95, skin: m.pale, eye: 0xd0a0ff, eyeGlow: 0x9a40ff, brow: 0x1a1020 });
    R.legL.up.visible = R.legR.up.visible = false;
    M.P(R.hips, M.drape('cultrobe', [[-0.9, 0.33, 0.27, 0, 2.2], [-0.6, 0.28, 0.22, 0, 2.2], [-0.3, 0.23, 0.17, -0.006, 2.3], [-0.05, 0.19, 0.135, -0.008, 2.4], [0.12, 0.17, 0.12, -0.008, 2.5]], 13, 0.07, 0, 48), m.robe);
    M.P(R.hips, M.drapeHem('cultrobe'), m.glow);
    M.P(R.hips, M.box(0.1, 0.8, 0.01), m.robe2, [0, -0.46, 0.2], [-0.14, 0, 0]);
    M.hood(R.head, m.robe2, 0.16);
    M.P(R.head, M.sph(0.134, 28, 10, Math.PI / 2 - 1.1, 2.2, Math.PI * 0.52, Math.PI * 0.3), m.obs, [0, 0.1, 0], 0, [0.94, 1, 1.2]);   // dark veil over the mouth
    for (let i = 0; i < 3; i++) M.P(R.head, M.box(0.006, 0.05, 0.004), m.glow, [(i - 1) * 0.03, 0.06, 0.158]);   // sigils stitched on the veil
    [R.armL, R.armR].forEach(A => { M.P(A.el, M.drape('cultsleeve', [[-0.27, 0.12, 0.11, 0.01, 2], [-0.13, 0.09, 0.085, 0.004, 2], [0.03, 0.06, 0.055, 0, 2]], 7, 0.07, 0, 24), m.robe); });
    M.P(R.chest, M.tube([-0.12, 0.2, 0.06, -0.06, 0.12, 0.15, 0, 0.08, 0.16, 0.06, 0.12, 0.15, 0.12, 0.2, 0.06], 0.006, 30, 5), m.gold);
    M.P(R.chest, M.oct(0.03), m.glow, [0, 0.07, 0.165]);
    const orb = M.G(R.armL.hand, [0, -0.13, 0.07]); M.P(orb, M.ico(0.08, 3), m.glow); glowSprite(orb, VOID, 0.7); R.orb = orb;
    const rings = [0, 1].map(i => M.P(orb, M.tor(0.13 + i * 0.03, 0.005, 6, 28), m.glowB, [0, 0, 0], [i * 1.2, 0.4, 0]));
    const kn = M.weapon.kukri ? M.weapon.kukri(1) : M.weapon.dagger(1); M.grip(R.armR, kn, 1); R.weapon = kn;
    if (binder) { for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; M.P(R.chest, M.tor(0.04, 0.012, 5, 10), G.mat('iron'), [Math.cos(a) * 0.22, -0.05 + Math.sin(i) * 0.04, Math.sin(a) * 0.15], [a, 0, 0]); }
      M.P(R.head, M.tor(0.17, 0.012, 6, 30), m.glow, [0, 0.33, -0.03], [Math.PI / 2, 0, 0]); }
    if (big) { for (let i = 0; i < 3; i++) M.P(R.head, M.tor(0.24 + i * 0.07, 0.01, 6, 36), m.glow, [0, 0.36 + i * 0.04, -0.04], [Math.PI / 2 - 0.25, 0, 0]); for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; M.P(R.head, M.cone(0.02, 0.16, 6), m.gold, [Math.cos(a) * 0.16, 0.28, Math.sin(a) * 0.16 - 0.02]); } }
    R.armPose = (R, st) => { if (!(st.atk >= 0)) { R.armL.sh.rotation.x = -0.5; R.armL.el.rotation.x = -1.1; } };
    R.extraAnim = (R, st) => { rings.forEach((g, i) => { g.rotation.x += 0.03 + i * 0.02; g.rotation.y += 0.025; }); orb.position.y = -0.13 + Math.sin(st.t * 3) * 0.015; };
    R.root.scale.setScalar(scale); return R;
  };
  E.binder = () => { const R = E.cultist(1.08, false, true); R.float = true; return R; };
  E.harbinger = () => { const R = E.cultist(2.0, true); R.float = true; const l = new THREE.PointLight(VOID, 2.4, 14, 2); l.position.set(0, 2.2, 0.6); R.root.add(l); return R; };
  // void stalker: the hellhound's body made lean and black, with crystal spines and violet eyes
  E.stalker = (scale = 1.05) => {
    const m = mats(), R = E.hound(scale), hide = G.mat('col', { c: 0x1a1426, r: 0.45, t: 'hide', e: 0x12062a, ei: 0.4 });
    R.root.traverse(o => { if (!o.isMesh || !o.material) return; const mt = o.material; if (mt.emissive && mt.emissive.getHex() && mt.color && mt.color.getHex() === 0) o.material = m.glow; else if (mt.color && mt.color.getHex() === 0x111111) o.material = m.crys; else if (mt.color && mt.color.getHex() === 0x2a1612) o.material = hide; });
    if (R.mouthGlow) R.mouthGlow.material = m.glow; if (R.tailFire) { R.tailFire.material = m.crys; }
    for (let i = 0; i < 7; i++) { const z = 0.42 - i * 0.12; M.P(R.body, M.cone(0.05, 0.28 - Math.abs(i - 3) * 0.03, 5), m.crys, [Math.sin(i * 1.7) * 0.04, 0.24 + Math.max(0, 0.06 - Math.abs(z) * 0.1), z], [-0.45, 0, Math.sin(i) * 0.3]); }
    return R;
  };
  // gazer: a floating eye with lids, a slit pupil, eyestalks, hanging tentacles and orbiting shards (elemental rig)
  E.gazer = (scale = 1, elder = false) => {
    const m = mats(), R = { kind: 'elem', root: new THREE.Group() };
    R.body = M.G(R.root, [0, 1.2, 0]);
    M.P(R.body, M.sph(0.42, 36, 28), m.flesh, [0, 0, 0], 0, [1, 0.95, 1]);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; M.P(R.body, M.tube([Math.cos(a) * 0.18, Math.sin(a) * 0.18, 0.37, Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.22, Math.cos(a) * 0.38, Math.sin(a) * 0.38, 0.0], 0.008, 10, 4), G.mat('col', { c: 0x6a1a3a, r: 0.6, e: 0x300818, ei: 0.5 })); }
    M.P(R.body, M.sph(0.3, 28, 20), G.mat('col', { c: 0xe8e0d8, r: 0.15 }), [0, 0, 0.17]);
    R.core = M.P(R.body, M.sph(0.17, 24, 16), G.mat('emissive', { c: elder ? 0xff60a0 : VOID, i: 3 }), [0, 0, 0.34], 0, [1, 1, 0.45]);
    M.P(R.body, M.box(0.05, 0.24, 0.05), G.mat('col', { c: 0x050208, r: 0.1 }), [0, 0, 0.42]);
    M.mirror(s => M.P(R.body, M.sph(0.44, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.32), m.flesh, [0, 0, 0], [s > 0 ? 0.25 : Math.PI - 0.25, 0, 0]));   // heavy lids
    R.head = M.G(R.body, [0, 0.3, -0.05]);
    for (let i = 0; i < (elder ? 9 : 5); i++) { const a = (i / (elder ? 9 : 5) - 0.5) * 2.4, x = Math.sin(a) * 0.28, len = 0.35 + (i % 2) * 0.15; M.P(R.head, M.tube([x * 0.5, 0, 0, x, len * 0.6, -0.05, x * 1.2, len, 0.05], 0.025, 12, 6, 0.4), m.flesh); M.P(R.head, M.sph(0.05, 12, 10), G.mat('col', { c: 0xe8e0d8, r: 0.2 }), [x * 1.2, len + 0.02, 0.06]); M.P(R.head, M.sph(0.025, 10, 8), m.glow, [x * 1.2, len + 0.02, 0.1]); }
    R.arms = [];
    for (let k = 0; k < 4; k++) { const a = M.G(R.body, [(k - 1.5) * 0.18, -0.3, -0.05 + (k % 2) * 0.1]); let par = a; for (let j = 0; j < 5; j++) { const s2 = M.G(par, j ? [0, -0.13, 0] : [0, 0, 0], [0.15, 0, (k - 1.5) * 0.08]); M.P(s2, M.cap(0.04 - j * 0.006, 0.12, 4, 10), m.flesh, [0, -0.07, 0]); par = s2; } R.arms.push(a); }
    R.rocks = [];
    for (let i = 0; i < (elder ? 16 : 9); i++) { const r = M.P(R.body, M.oct(0.06 + (i % 3) * 0.03, 0), m.crys); r.userData.a = i * 0.7; r.userData.r = 0.62 + (i % 3) * 0.12; r.userData.y = (i % 4 - 1.5) * 0.18; r.userData.s = 0.6 + (i % 5) * 0.15; R.rocks.push(r); }
    const l = new THREE.PointLight(elder ? 0xff60a0 : VOID, elder ? 2.4 : 1.2, elder ? 14 : 7, 2); l.position.set(0, 0, 0.7); R.body.add(l);
    R.root.scale.setScalar(scale); return R;
  };
  E.eldergazer = () => E.gazer(2.4, true);
  // abyssal horror: hunched and long-armed, a bulbous head split by a maw of tentacles, a cluster of small eyes
  E.horror = (scale = 1.0, king = false) => {
    const m = mats(), R = M.humanoid({ skin: m.flesh, top: m.flesh, bottom: m.flesh, bulk: 1.45, noHead: true, hands: m.flesh, forearm: m.flesh, boots: m.obs });
    M.P(R.head, M.sculpt('horrorHead', [[-0.08, 0.06, 0.07, 0.02, 2], [-0.02, 0.15, 0.15, 0.03, 2.1], [0.1, 0.19, 0.19, 0.0, 2.2], [0.22, 0.17, 0.2, -0.04, 2.2], [0.32, 0.1, 0.14, -0.06, 2], [0.36, 0.02, 0.04, -0.06, 2]], 30, 4), m.flesh, [0, 0, 0]);
    for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 1.6, y = 0.18 + Math.cos(i * 1.9) * 0.05; M.P(R.head, M.sph(0.022, 10, 8), m.glow, [Math.sin(a) * 0.15, y, Math.cos(a) * 0.15 + 0.04]); }
    const tents = king ? 12 : 8; R.tents = [];
    for (let i = 0; i < tents; i++) { const a = (i / (tents - 1) - 0.5) * 1.8, base = M.G(R.head, [Math.sin(a) * 0.1, 0.04, 0.13 + Math.cos(a) * 0.02], [0.2, a * 0.3, 0]); let par = base; for (let j = 0; j < 5; j++) { const s2 = M.G(par, j ? [0, -0.07, 0] : [0, 0, 0], [0.1, 0, 0]); M.P(s2, M.cap(0.022 - j * 0.0035, 0.07, 3, 8), m.flesh, [0, -0.04, 0]); par = s2; } R.tents.push(base); }
    M.mirror(s => { for (let i = 0; i < 4; i++) M.P(R.chest, M.cone(0.04, 0.22, 6), m.crys, [s * (0.06 + i * 0.06), 0.18 - i * 0.02, -0.15], [-0.7, 0, s * 0.3]); });
    [R.armL, R.armR].forEach(A => { A.fore.scale.y *= 1.3; A.hand.position.y = -0.37; A.hand.scale.setScalar(1.4); for (let f = 0; f < 4; f++) M.P(A.hand, M.cone(0.014, 0.12, 6), m.obs, [(f - 1.5) * 0.02, -0.12, 0.03], [0.4, 0, 0]); });
    R.extraAnim = (R, st) => { R.tents.forEach((t, i) => { t.rotation.x = 0.2 + Math.sin(st.t * 3 + i) * 0.25; t.rotation.z = Math.sin(st.t * 2.3 + i * 1.7) * 0.2; }); };
    if (king) { const l = new THREE.PointLight(VOID, 2.6, 16, 2); l.position.set(0, 2.6, 0.8); R.root.add(l); }
    R.root.scale.setScalar(scale); return R;
  };
  E.devourer = () => E.horror(2.15, true);
  // crystal shardling: a small walker grown out of violet crystal, glowing from inside
  E.shardling = () => {
    const m = mats(), R = M.humanoid({ skin: m.obs2, top: m.obs2, bottom: m.obs2, boots: m.obs2, hands: m.obs2, bulk: 0.8, noHead: true });
    const rnd = G.mulberry(91), shard = (par, pos, h, rot) => M.P(par, M.cone(0.05 + rnd() * 0.03, h, 5), m.crys, pos, rot);
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; shard(R.chest, [Math.cos(a) * 0.12, 0.1 + rnd() * 0.15, Math.sin(a) * 0.1], 0.2 + rnd() * 0.2, [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6]); }
    for (let i = 0; i < 6; i++) shard(R.head, [(rnd() - 0.5) * 0.12, 0.1, (rnd() - 0.5) * 0.12], 0.25 + rnd() * 0.25, [(rnd() - 0.5) * 0.8, 0, (rnd() - 0.5) * 0.8]);
    M.P(R.head, M.ico(0.1, 1), m.crys, [0, 0.08, 0]); M.P(R.chest, M.ico(0.07, 2), m.glow, [0, 0.08, 0.1]);
    [R.armL, R.armR].forEach(A => shard(A.hand, [0, -0.08, 0], 0.22, [Math.PI, 0, 0]));
    const l = new THREE.PointLight(VOID, 1.0, 5, 2); l.position.set(0, 0.1, 0.25); R.chest.add(l);
    R.root.scale.setScalar(0.85); return R;
  };
  // hollow knight: black plate over nothing, a violet glow where the face should be, greatsword and tower shield
  E.voidknight = (scale = 1.08, king = false) => {
    const m = mats(), plate = G.mat('col', { c: 0x1c1826, m: 0.9, r: 0.28 }), trim = king ? G.mat('gold') : G.mat('col', { c: 0x5a4a7a, m: 0.85, r: 0.3 });
    const R = M.humanoid({ skin: plate, top: plate, bottom: G.mat('col', { c: 0x14101c, m: 0.7, r: 0.4 }), sleeve: plate, forearm: plate, shin: plate, boots: plate, hands: plate, bulk: 1.15, noHead: true });
    M.P(R.head, M.helmLathe(), plate, [0, -0.02, 0], 0, [1, 1.06, 1.04]);
    M.P(R.head, M.box(0.2, 0.03, 0.05), m.glow, [0, 0.13, 0.145]); M.P(R.head, M.box(0.03, 0.12, 0.05), m.glow, [0, 0.08, 0.15]);
    glowSprite(R.head, VOID, 0.35, [0, 0.12, 0.16]);
    for (let i = 0; i < (king ? 9 : 5); i++) { const a = (i / (king ? 8 : 4) - 0.5) * (king ? 2.6 : 1.4); M.P(R.head, M.cone(0.025, king ? 0.24 + (i % 2) * 0.12 : 0.12, 6), trim, [Math.sin(a) * 0.15, 0.33, Math.cos(a) * 0.12 - 0.02], [-0.15, 0, -Math.sin(a) * 0.4]); }
    M.mirror(sx => { for (let k = 0; k < 2; k++) M.P(R.chest, M.sph(0.15 - k * 0.02, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), k ? trim : plate, [sx * (R.shX + 0.04), 0.15 - k * 0.05, 0], [0, 0, sx * -0.45], [1, 0.8, 1]); });
    M.P(R.chest, M.sculpt('vkcuirass', [[-0.12, 0.18, 0.13, 0, 2.5], [0.05, 0.21, 0.15, 0.012, 2.6], [0.2, 0.2, 0.14, 0.0, 2.4]], 30, 3), plate);
    for (let i = 0; i < 5; i++) M.P(R.chest, M.box(0.006, 0.1 + (i % 2) * 0.05, 0.006), m.glow, [(i - 2) * 0.05, 0.02 + Math.sin(i) * 0.03, 0.155], [0, 0, (i - 2) * 0.3]);   // cracks of light through the breastplate
    for (let k = 0; k < 3; k++) M.P(R.hips, M.band(0.19 + k * 0.01, 0.13 + k * 0.006, 0.06, -0.006, 2.6, 0.06), k === 1 ? trim : plate, [0, -k * 0.05, 0]);
    const sw = M.weapon.sword(3, 1.25); M.grip(R.armR, sw, 1); R.weapon = sw;
    const sh = M.weapon.shield(2, 0x2a1a40); sh.scale.set(1.3, 1.55, 1.3); sh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new G.V3(0, 1, 0), new G.V3(0, 0, 1), new G.V3(1, 0, 0))); sh.position.set(0.08, -0.15, 0); R.armL.el.add(sh); R.shield = sh;
    if (king) { M.P(R.chest, M.drape('kingcape', [[-1.1, 0.36, 0.28, -0.12, 2], [-0.6, 0.3, 0.22, -0.08, 2], [-0.1, 0.24, 0.16, -0.04, 2], [0.2, 0.22, 0.13, -0.02, 2]], 11, 0.06, 0, 40), G.mat('col', { c: 0x2a0a3a, t: 'cloth', ds: true }), [0, 0, -0.06], 0, [1, 1, 0.8]);
      const l = new THREE.PointLight(VOID, 2.4, 16, 2); l.position.set(0, 2.4, 0.9); R.root.add(l); }
    R.armPose = (R, st) => { R.armL.sh.rotation.x = Math.min(R.armL.sh.rotation.x, st.block ? -1.2 : -0.25); R.armL.sh.rotation.z = st.block ? 0.5 : 0.22; R.armL.el.rotation.x = st.block ? -1.1 : -1.4; };
    R.extraAnim = (R, st) => { if (Math.random() < (king ? 0.4 : 0.08)) { const p = new G.V3(); R.head.getWorldPosition(p); G.fx.emit(G.fx.add, p.x, p.y + 0.1, p.z, (Math.random() - 0.5) * 0.3, 0.6, (Math.random() - 0.5) * 0.3, 0.9, 0.12, 0.02, [1.2, 0.6, 2, 0.8], [0.3, 0.1, 0.6, 0]); } };
    R.root.scale.setScalar(scale); return R;
  };
  E.hollowking = () => E.voidknight(2.2, true);

  /* ---------------- dungeon dressing ---------------- */
  // violet crystal sconce instead of a torch
  const torch0 = M.prop.torch; M.prop.torch = function (theme) {
    if (theme !== 'abyss') return torch0.call(this, theme);
    const m = mats(), g = new THREE.Group();
    M.P(g, M.box(0.16, 0.36, 0.05), m.obs, [0, 0, -0.02]); M.P(g, M.tor(0.07, 0.012, 6, 16, Math.PI), m.gold, [0, 0.12, 0.05], [0, 0, 0]);
    M.P(g, M.tube([0, -0.12, 0, 0, -0.1, 0.12, 0, -0.02, 0.2], 0.016, 12, 6), m.obs);
    const c = M.G(g, [0, 0.08, 0.22]); for (let i = 0; i < 4; i++) M.P(c, M.cone(0.03, 0.2 - i * 0.03, 5), m.crys, [(i - 1.5) * 0.02, 0.06, (i % 2) * 0.02], [(i - 1.5) * 0.15, 0, (i - 1.5) * 0.25]);
    M.flame(g, 0.7, 0xa060ff).position.set(0, 0.2, 0.23);
    g.userData.light = { pos: new THREE.Vector3(0, 0.4, 0.4), color: 0x9a60ff, intensity: 2.0, dist: 12 };
    return g;
  };
  // obsidian columns banded with runes
  const pillar0 = M.prop.pillar; M.prop.pillar = function (theme, h = 4) {
    if (theme !== 'abyss') return pillar0.call(this, theme, h);
    const m = mats(), g = new THREE.Group();
    M.P(g, M.cyl(0.5, 0.6, 0.35, 8), m.obs2, [0, 0.17, 0]);
    const shaft = M.cyl(0.32, 0.38, h - 0.9, 8, 6); M.P(g, shaft, m.obs, [0, h / 2, 0]);
    for (let k = 0; k < 3; k++) { const y = 1 + k * (h - 2) / 2; M.P(g, M.cyl(0.4, 0.4, 0.12, 8, 1, true), m.obs2, [0, y, 0]); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; M.P(g, M.box(0.05, 0.08, 0.01), m.glow, [Math.cos(a) * 0.405, y, Math.sin(a) * 0.405], [0, -a + Math.PI / 2, 0]); } }
    M.P(g, M.cyl(0.6, 0.38, 0.35, 8), m.obs2, [0, h - 0.17, 0]);
    return g;
  };
  // floating crystal clusters in place of chandeliers
  const chand0 = M.amb.chandelier; M.amb.chandelier = function (theme, drop = 1.6, big) {
    if (theme !== 'abyss') return chand0.call(this, theme, drop, big);
    const m = mats(), g = new THREE.Group(), s = big ? 1.6 : 1;
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; M.P(g, M.cone(0.08 * s, (0.6 + (i % 3) * 0.3) * s, 5), m.crys, [Math.cos(a) * 0.25 * s, -0.3 * s, Math.sin(a) * 0.25 * s], [Math.PI + Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4]); }
    M.P(g, M.oct(0.18 * s, 0), m.glow, [0, 0, 0]); M.P(g, M.tor(0.5 * s, 0.015, 6, 30), m.glow, [0, 0, 0], [Math.PI / 2, 0, 0]);
    g.userData.light = { pos: new G.V3(0, -0.4, 0), color: 0x9a60ff, intensity: 2.4 * (big ? 1.5 : 1), dist: 13 * (big ? 1.6 : 1) };
    return g;
  };
  M.prop.chandelier = (orig => function () { return G.World.theme === 'abyss' ? M.amb.chandelier('abyss', 1.8, true) : orig.apply(this, arguments); })(M.prop.chandelier);
  // set pieces for the sanctum's rooms
  M.abyss = {
    obelisk(r = Math.random) { const m = mats(), g = new THREE.Group(), h = 2.4 + r() * 1.6; M.P(g, M.box(0.9, 0.3, 0.9), m.obs2, [0, 0.15, 0]); M.P(g, M.cyl(0.18, 0.42, h, 4), m.obs, [0, h / 2 + 0.3, 0], [0, Math.PI / 4, 0]);
      for (let i = 0; i < 5; i++) M.P(g, M.box(0.08, 0.12, 0.02), m.glow, [0, 0.8 + i * (h - 1) / 5, 0.25 - i * 0.025]); g.userData.light = { pos: new G.V3(0, 1.5, 0.6), color: VOID, intensity: 1.0, dist: 6 }; return g; },
    shards(r = Math.random) { const m = mats(), g = new THREE.Group(); for (let i = 0; i < 6; i++) { const s = M.P(g, M.oct(0.15 + r() * 0.25, 0), r() < 0.3 ? m.glow : m.crys, [(r() - 0.5) * 1.6, 1.0 + r() * 2.2, (r() - 0.5) * 1.6], [r() * 3, r() * 3, r() * 3], [1, 1.6 + r(), 1]); s.userData.bob = r() * 6; } g.userData.floaters = true; return g; },
    rift(r = Math.random) { const m = mats(), g = new THREE.Group(); const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: 0x0a0018 })); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.025; disc.scale.set(1.3 + r() * 0.6, 0.6 + r() * 0.4, 1); g.add(disc);
      const rim = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.12, 40), new THREE.MeshBasicMaterial({ color: VOID, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); rim.rotation.x = -Math.PI / 2; rim.position.y = 0.03; rim.scale.copy(disc.scale); g.add(rim);
      for (let i = 0; i < 5; i++) M.P(g, M.cone(0.06, 0.3 + r() * 0.3, 5), m.crys, [(r() - 0.5) * 1.8 * disc.scale.x, 0.1, (r() - 0.5) * disc.scale.y], [(r() - 0.5) * 0.8, 0, (r() - 0.5) * 0.8]);
      g.userData.light = { pos: new G.V3(0, 0.4, 0), color: VOID, intensity: 1.4, dist: 6 }; return g; },
    tendrils(r = Math.random) { const m = mats(), g = new THREE.Group(); for (let i = 0; i < 4 + Math.floor(r() * 3); i++) { const x = (r() - 0.5) * 1.2, z = (r() - 0.5) * 1.2, h = 0.8 + r() * 1.4, bend = (r() - 0.5) * 0.8; M.P(g, M.tube([x, 0, z, x + bend * 0.3, h * 0.4, z, x + bend, h * 0.75, z + 0.1, x + bend * 1.3, h, z + 0.25], 0.07, 16, 8, 0.85), m.flesh); } return g; },
    altar(r = Math.random) { const m = mats(), g = new THREE.Group(); M.P(g, M.box(1.8, 0.9, 1.0), m.obs, [0, 0.45, 0]); M.P(g, M.box(2.0, 0.1, 1.15), m.obs2, [0, 0.92, 0]); M.P(g, M.ico(0.22, 2), m.glow, [0, 1.25, 0]); for (let i = 0; i < 3; i++) M.P(g, M.tor(0.35 + i * 0.1, 0.008, 6, 30), m.glowB, [0, 1.25, 0], [i, i * 0.6, 0]);
      for (let i = 0; i < 4; i++) M.P(g, M.box(0.04, 0.5, 0.02), m.glow, [-0.75 + i * 0.5, 0.45, 0.51]); g.userData.light = { pos: new G.V3(0, 1.5, 0), color: VOID, intensity: 2, dist: 9 }; return g; },
    statue(r = Math.random) { const m = mats(), g = new THREE.Group(); M.P(g, M.box(1.1, 0.5, 1.1), m.obs2, [0, 0.25, 0]); M.P(g, M.drape('abstatue', [[-1.6, 0.42, 0.35, 0, 2.2], [-1.0, 0.36, 0.3, 0, 2.2], [-0.3, 0.3, 0.24, 0, 2.3], [0.2, 0.22, 0.18, 0, 2.2], [0.35, 0.1, 0.1, 0, 2]], 10, 0.06, 1, 40), m.obs, [0, 2.1, 0]);
      M.P(g, M.sph(0.22, 18, 14), m.obs, [0, 2.65, 0.02], 0, [0.9, 1.1, 1]); M.P(g, M.box(0.2, 0.025, 0.05), m.glow, [0, 2.66, 0.2]); for (let i = 0; i < 5; i++) M.P(g, M.cone(0.025, 0.22, 5), m.obs, [(i - 2) * 0.07, 2.9, -0.03]); return g; }
  };

  /* ---------------- textures ---------------- */
  const texGet = G.tex.get.bind(G.tex);
  G.tex.get = function (key, force) {
    if (key !== 'abyssWall' && key !== 'abyssFloor') return texGet(key, force);
    if (this.cache[key] && !force) return this.cache[key];
    const s = this.size(), r = G.mulberry(key === 'abyssWall' ? 4417 : 8821), fb = this.fbm(s, r, 5, 4), fb2 = this.fbm(s, r, 4, 8), hash = n => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
    let out;
    if (key === 'abyssWall') out = this.paint(s, (x, y) => {
      // big obsidian ashlar, glassy, with violet light leaking through veins and carved runes in some blocks
      const b = this.bricks(x, y, s, 4, 3, 0.5), n = fb(x, y), n2 = fb2(x, y), hv = hash(b.id), mort = b.edge < 0.035;
      const vein = Math.abs(n2 - 0.5) < 0.011 + n * 0.006 && !mort, rune = hv > 0.72 && Math.abs(b.u - 0.5) < 0.18 && Math.abs(b.v - 0.5) < 0.3 && ((Math.floor(b.u * 30) + Math.floor(b.v * 18) * 3 + Math.floor(hv * 50)) % 5 === 0);
      const v = 18 + hv * 14 + n * 22, glow = vein ? 1 : rune ? 0.8 : mort ? 0.18 : 0;
      return [mort ? 10 : v * 0.85, mort ? 8 : v * 0.75, mort ? 14 : v * 1.15, mort ? 0.05 : 0.65 + n * 0.25 - (rune ? 0.15 : 0), glow * 170, glow * 80, glow * 255];
    }, true);
    else out = this.paint(s, (x, y) => {
      // polished basalt flags with silver flecks and faintly glowing grout; every few tiles a carved circle
      const b = this.bricks(x, y, s, 3, 3, 0.0), n = fb(x, y), hv = hash(b.id + 7), mort = b.edge < 0.025;
      const ring = hv > 0.86 && Math.abs(Math.hypot(b.u - 0.5, b.v - 0.5) - 0.32) < 0.008, fleck = hash(x * 31.7 + y * 11.3) > 0.996;
      const v = 22 + hv * 12 + n * 18, glow = mort ? 0.22 : ring ? 0.7 : 0;
      return [fleck ? 160 : v * 0.9, fleck ? 160 : v * 0.85, fleck ? 190 : v * 1.1, mort ? 0.04 : 0.6 + n * 0.25, glow * 150, glow * 70, glow * 240];
    }, true);
    if (this._defer) return { out, rep: 1, nStr: key.includes('Floor') ? 2 : 3 };
    return this.finish(key, out[0], out[1], out[2], 1, key.includes('Floor') ? 2 : 3);
  };
})();
