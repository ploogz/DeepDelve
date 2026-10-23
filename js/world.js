/* ============================================================
   World: procedural dungeon generation & building, hideout,
   collision, flow-field pathing, light pool, atmosphere
   ============================================================ */
'use strict';
const W = G.World = {
  CS: 4, W: 0, H: 0, grid: null, rooms: [], solids: [], solidGrid: {}, lights: [], group: null, theme: 'crypt', explored: null,
  interact: [], decor: [], animated: [],

  /* ------------------ generation (deterministic from seed) ------------------ */
  // node: {type: combat|elite|miniboss|boss|event|shop|rest|treasure, depth, key, base, np}
  generate(seed, theme, node) {
    // boss levels must seal the arena behind a single great door; retry deterministically until the layout allows it
    let L = null; for (let a = 0; a < 16 && !L; a++) L = this.genTry(seed, theme, node, a);
    return L || this.genTry(seed, theme, Object.assign({}, node, { type: 'elite' }), 0);
  },
  genTry(seed, theme, node, attempt) {
    const kind = node.type, depth = node.depth || 0, CS = this.CS;
    const r = G.mulberry(seed * 7919 + (node.key || 0) * 104729 + 13 + attempt * 31337);
    if (['event', 'shop', 'rest', 'treasure', 'puzzle'].includes(kind)) return this.genChamber(seed, theme, node, r);
    const bossy = kind === 'miniboss' || kind === 'boss', Wd = kind === 'combat' ? 42 : 36, Ht = Wd;
    const grid = new Uint8Array(Wd * Ht), roomId = new Int16Array(Wd * Ht).fill(-1), rooms = [];
    const fits = (x, y, w, h) => { if (x < 2 || y < 2 || x + w > Wd - 2 || y + h > Ht - 2) return false; for (const o of rooms) if (x < o.x + o.w + 2 && x + w + 2 > o.x && y < o.y + o.h + 2 && y + h + 2 > o.y) return false; return true; };
    const add = (x, y, w, h, type) => { const ro = { x, y, w, h, type, cx: x + w / 2, cy: y + h / 2, id: rooms.length }; rooms.push(ro); for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { grid[j * Wd + i] = 1; roomId[j * Wd + i] = ro.id; } return ro; };
    const sx = r() < 0.5 ? 3 : Wd - 10, sy = G.ri(3, Ht - 10, r);
    add(sx, sy, 6, 6, 'start');
    const farType = bossy ? 'boss' : 'exit', fw = bossy ? [10, 12] : [5, 6];
    for (let tries = 0; tries < 500; tries++) { const w = G.ri(fw[0], fw[1], r), h = G.ri(fw[0], fw[1], r), x = G.ri(2, Wd - w - 2, r), y = G.ri(2, Ht - h - 2, r); if (Math.hypot(x + w / 2 - (sx + 3), y + h / 2 - (sy + 3)) > Wd * 0.5 && fits(x, y, w, h)) { add(x, y, w, h, farType); break; } }
    if (rooms.length < 2) add(Wd - 14, Ht - 14, fw[1], fw[1], farType);
    const target = kind === 'combat' ? 11 : bossy ? 7 : 8;
    for (let tries = 0; tries < 400 && rooms.length < target; tries++) { const w = G.ri(4, 9, r), h = G.ri(4, 9, r), x = G.ri(2, Wd - w - 2, r), y = G.ri(2, Ht - h - 2, r); if (fits(x, y, w, h)) { const o = add(x, y, w, h, 'normal'); this.shapeRoom(o, grid, roomId, Wd, r); } }
    // MST + a few loops
    const edges = [], inT = new Set([0]);
    const bossIdx = rooms.findIndex(o => o.type === 'boss'), BR = bossy ? rooms[bossIdx] : null;
    if (BR) inT.add(bossIdx);
    while (inT.size < rooms.length) { let best = null; for (const a of inT) for (let b = 0; b < rooms.length; b++) if (!inT.has(b) && a !== bossIdx) { const d = Math.hypot(rooms[a].cx - rooms[b].cx, rooms[a].cy - rooms[b].cy); if (!best || d < best.d) best = { a, b, d }; } edges.push(best); inT.add(best.b); }
    for (let i = 0; i < 3; i++) { const a = G.ri(1, rooms.length - 1, r), b = G.ri(1, rooms.length - 1, r); if (a !== b && rooms[a].type !== 'boss' && rooms[b].type !== 'boss') edges.push({ a, b }); }
    const inArena = (x, y) => BR && x >= BR.x - 1 && x <= BR.x + BR.w && y >= BR.y - 1 && y <= BR.y + BR.h;
    const carve = (x, y, wide) => { for (let dy = 0; dy < (wide ? 2 : 1); dy++) for (let dx = 0; dx < (wide ? 2 : 1); dx++) { const xx = x + dx, yy = y + dy; if (xx > 0 && yy > 0 && xx < Wd - 1 && yy < Ht - 1 && !grid[yy * Wd + xx] && !inArena(xx, yy)) grid[yy * Wd + xx] = 2; } };
    edges.forEach(e => {
      const A = rooms[e.a], B = rooms[e.b], wide = r() < 0.55; let x = Math.floor(A.cx), y = Math.floor(A.cy); const tx = Math.floor(B.cx), ty = Math.floor(B.cy);
      const hFirst = r() < 0.5;
      const stepX = () => { while (x !== tx) { carve(x, y, wide); x += Math.sign(tx - x); } }, stepY = () => { while (y !== ty) { carve(x, y, wide); y += Math.sign(ty - y); } };
      if (hFirst) { stepX(); stepY(); } else { stepY(); stepX(); } carve(x, y, wide);
    });
    // chasms: a big plain room may open onto a deep pit, ringed by a walkway and crossed by a narrow bridge
    const pitCells = []; { const big = G.shuffle(rooms.filter(o => o.type === 'normal' && !o.shape && o.w >= 6 && o.h >= 6), r); if (big.length && r() < (kind === 'combat' ? 0.7 : 0.45)) { const o = big[0]; const bx = r() < 0.5, mid = bx ? Math.floor(o.cy) : Math.floor(o.cx);
      for (let y = o.y + 2; y < o.y + o.h - 2; y++) for (let x = o.x + 2; x < o.x + o.w - 2; x++) { if ((bx ? y : x) === mid) continue; const i = y * Wd + x; grid[i] = 0; roomId[i] = -1; pitCells.push(i); }
      o.pit = true; o.bridge = bx ? 'x' : 'z'; } }
    // the arena: one great door on the side facing the nearest room, a short hall out, then a corridor to that room
    let bossDoor = null; this._arena = BR;
    if (BR) {
      const T = rooms.filter(o => o !== BR).sort((a, b) => Math.hypot(a.cx - BR.cx, a.cy - BR.cy) - Math.hypot(b.cx - BR.cx, b.cy - BR.cy))[0];
      const ddx = T.cx - BR.cx, ddy = T.cy - BR.cy; let dx, dy, ox = 0, oy = 0;
      if (Math.abs(ddx) > Math.abs(ddy)) { ox = Math.sign(ddx); dx = ox > 0 ? BR.x + BR.w : BR.x - 1; dy = BR.y + Math.floor(BR.h / 2); }
      else { oy = Math.sign(ddy); dy = oy > 0 ? BR.y + BR.h : BR.y - 1; dx = BR.x + Math.floor(BR.w / 2); }
      for (let k = 1; k <= 3; k++) { const xx = dx + ox * k, yy = dy + oy * k; if (xx < 1 || yy < 1 || xx >= Wd - 1 || yy >= Ht - 1) return null; grid[yy * Wd + xx] = 2; }
      let x = dx + ox * 3, y = dy + oy * 3; const tx = Math.floor(T.cx), ty = Math.floor(T.cy);
      const stepX = () => { while (x !== tx) { carve(x, y, false); x += Math.sign(tx - x); } }, stepY = () => { while (y !== ty) { carve(x, y, false); y += Math.sign(ty - y); } };
      if (ox) { stepX(); stepY(); } else { stepY(); stepX(); }
      bossDoor = { cx: dx, cy: dy, i: dy * Wd + dx, dir: [-ox, -oy] };
      // every room must be reachable from the start, with the arena only through its door
      const seen = new Uint8Array(Wd * Ht), q = [rooms[0].y * Wd + rooms[0].x]; seen[q[0]] = 1; grid[bossDoor.i] = 2;
      while (q.length) { const i = q.pop(), cx = i % Wd, cy = (i / Wd) | 0; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => { const j = (cy + b) * Wd + cx + a; if (grid[j] && !seen[j]) { seen[j] = 1; q.push(j); } }); }
      const ok = rooms.every(o => seen[Math.floor(o.cy) * Wd + Math.floor(o.cx)]);
      // the ring around the arena must be solid except the door
      let leak = false; for (let yy = BR.y - 1; yy <= BR.y + BR.h; yy++) for (let xx = BR.x - 1; xx <= BR.x + BR.w; xx++) { const onRing = xx === BR.x - 1 || xx === BR.x + BR.w || yy === BR.y - 1 || yy === BR.y + BR.h; if (onRing && grid[yy * Wd + xx] && yy * Wd + xx !== bossDoor.i) leak = true; }
      grid[bossDoor.i] = 0;
      if (!ok || leak) return null;
    }
    // room roles
    const normals = G.shuffle(rooms.filter(o => o.type === 'normal'), r);
    normals.sort((a, b) => (a.pit ? 1 : 0) - (b.pit ? 1 : 0));
    let ni = 0; const take = (type) => { if (ni < normals.length && !normals[ni].pit) { normals[ni].type = type; return normals[ni++]; } return null; };
    if (kind === 'combat' && r() < 0.6 || bossy) take('npc');
    if (kind === 'combat' && r() < 0.55 || kind === 'elite' && r() < 0.4) take('event');
    if (kind === 'combat' && r() < 0.45) take('treasure');
    // puzzle rooms need space: swap a big room to the front of the queue
    if ((kind === 'combat' && r() < 0.4) || (kind === 'elite' && r() < 0.2)) { const pi = normals.findIndex((q, k) => k >= ni && q.w >= 6 && q.h >= 6 && !q.shape && !q.pit); if (pi >= 0) { const tmp = normals[ni]; normals[ni] = normals[pi]; normals[pi] = tmp; take('puzzle'); } }
    const dg = G.DUNGEONS[theme], spawns = [], chests = [], npcs = [], events = [], pedestals = [], puzzles = [], shrines = [];
    let eid = (node.base || 0) + 1;
    const npcPool = G.shuffle(G.NPCS.slice(), r), evPool = G.shuffle(Object.keys(G.EVENTS), r);
    const affixes = Object.keys(G.enemies.AFFIX), mkElite = () => { const n = depth >= 4 ? 2 : 1; return G.shuffle(affixes.slice(), r).slice(0, n); };
    const elitesWanted = kind === 'elite' ? 3 : 0; let elitesMade = 0;
    const pickType = () => { const wts = [3, 2, 2, 2, 1.1, 1.4].slice(0, dg.enemies.length); let t = r() * wts.reduce((a, b) => a + b, 0), ti = 0; for (; ti < wts.length; ti++) { t -= wts[ti]; if (t <= 0) break; } return dg.enemies[Math.min(ti, dg.enemies.length - 1)]; };
    // a random point on real floor inside a room (shaped rooms and chasms leave holes in the rectangle)
    const cellsOf = o => { if (o._cells) return o._cells; const c = []; for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) if (grid[y * Wd + x] && roomId[y * Wd + x] === o.id) c.push([x, y]); return (o._cells = c); };
    const inRoom = (o, m = 0.25) => { const c = G.pick(cellsOf(o), r) || [Math.floor(o.cx), Math.floor(o.cy)]; return [(c[0] + m + r() * (1 - 2 * m)) * CS, (c[1] + m + r() * (1 - 2 * m)) * CS]; };
    rooms.forEach((o, i) => {
      const area = cellsOf(o).length;
      if (o.type === 'normal' || o.type === 'treasure' || o.type === 'exit') {
        const n = Math.round(area / 7 * (0.85 + depth * 0.07) * (kind === 'elite' ? 0.6 : 1) * (o.type === 'exit' ? 0.5 : 1) + r() * 2);
        let eliteHere = o.type !== 'exit' && ((kind === 'elite' && elitesMade < elitesWanted) || (kind === 'combat' && r() < 0.1 + depth * 0.02));
        for (let k = 0; k < n; k++) {
          const [sx0, sz0] = inRoom(o), s = { id: eid++, type: pickType(), x: sx0, z: sz0, room: i };
          if (eliteHere) { s.elite = mkElite(); eliteHere = false; elitesMade++; }
          spawns.push(s);
        }
        // every fight room of any size brings this dungeon's puller, so nobody can just snipe from the doorway
        if (dg.puller && o.type !== 'exit' && (n >= 3 || (n >= 2 && r() < 0.5))) { const pp = inRoom(o), s = { id: eid++, type: dg.puller, x: pp[0], z: pp[1], room: i }; if (n >= 9 && r() < 0.5) { const p2 = inRoom(o); spawns.push(Object.assign({}, s, { id: eid++, x: p2[0], z: p2[1] })); } spawns.push(s); }
        if (o.type === 'treasure') for (let k = 0; k < 2; k++) { const cp = inRoom(o, 0.3); chests.push({ id: chests.length, x: cp[0], z: cp[1], tier: 1 + (r() < 0.4 ? 1 : 0), rot: r() * 6, mimic: r() < 0.2 }); }
        else if (o.type === 'normal' && r() < 0.35) { const cp = inRoom(o, 0.3); chests.push({ id: chests.length, x: cp[0], z: cp[1], tier: 0, rot: r() * 6, mimic: r() < 0.18 }); }
      }
      if (o.type === 'npc') npcs.push({ def: npcPool[npcs.length % npcPool.length], x: o.cx * CS, z: o.cy * CS, room: i });
      if (o.type === 'puzzle') this.addPuzzle(puzzles, chests, o, r);
      if (o.type === 'event') events.push({ id: events.length, ev: evPool[events.length % evPool.length], x: o.cx * CS, z: o.cy * CS, room: i });
    });
    // a cornered, wounded foe who might be talked down
    if (kind === 'combat' && r() < 0.5) { const o = rooms.find(q => q.type === 'normal' && q.w >= 5); if (o) { const cp = inRoom(o, 0.3); spawns.push({ id: eid++, type: (dg.cower || { crypt: 'skeleton', warrens: 'orc', forge: 'imp' }[theme] || dg.enemies[0]), x: cp[0], z: cp[1], room: o.id, cower: true }); } }
    // corridor stragglers
    for (let i = 0; i < 5 + depth; i++) { for (let t = 0; t < 30; t++) { const x = G.ri(1, Wd - 2, r), y = G.ri(1, Ht - 2, r); if (grid[y * Wd + x] === 2) { spawns.push({ id: eid++, type: G.pick(dg.enemies.slice(0, 4), r), x: (x + 0.5) * CS, z: (y + 0.5) * CS, room: -1 }); break; } } }
    // annex rooms behind gates
    const gates = [], hidden = [];
    const annexCount = kind === 'combat' ? 2 + (r() < 0.5 ? 1 : 0) : 1; let vaultMade = false;
    for (let a = 0; a < annexCount; a++) {
      let type = G.pick(['secret', 'secret', 'locked', 'locked', 'vault'], r); if (type === 'vault' && vaultMade) type = 'secret';
      const g = this.tryAnnex(grid, roomId, rooms, Wd, Ht, r, type, gates.length);
      if (!g) continue; gates.push(g); if (type === 'vault') vaultMade = true;
      const an = rooms[g.annex];
      if (type === 'secret') { hidden.push(...g.cells); chests.push({ id: chests.length, x: an.cx * CS, z: an.cy * CS, tier: 1, rot: r() * 6, mimic: false }); if (r() < 0.35) pedestals.push({ id: pedestals.length, kind: 'relic', relic: G.rollRelic(r), x: (an.cx + 0.8) * CS, z: an.cy * CS }); }
      if (type === 'locked') { chests.push({ id: chests.length, x: (an.cx - 0.6) * CS, z: an.cy * CS, tier: 1, rot: r() * 6, mimic: r() < 0.25 }); }
      if (type === 'vault') { pedestals.push({ id: pedestals.length, kind: 'relic', relic: G.rollRelic(r), x: an.cx * CS, z: an.cy * CS }); chests.push({ id: chests.length, x: (an.cx - 0.9) * CS, z: (an.cy + 0.6) * CS, tier: 2, rot: r() * 6, mimic: false }); chests.push({ id: chests.length, x: (an.cx + 0.9) * CS, z: (an.cy + 0.6) * CS, tier: 2, rot: r() * 6, mimic: false }); }
    }
    // the vault key: in a locked storeroom, on a pedestal, or carried by an elite
    let keySpot = null;
    if (vaultMade) {
      const locked = gates.find(g => g.type === 'locked'), eliteS = spawns.find(s => s.elite);
      if (locked && r() < 0.5) { const an = rooms[locked.annex]; keySpot = { x: (an.cx + 0.7) * CS, z: an.cy * CS }; }
      else if (eliteS && r() < 0.4) eliteS.key = true;
      else { const o = G.pick(rooms.filter(q => q.type === 'normal'), r) || rooms[0]; const kp = inRoom(o, 0.3); keySpot = { x: kp[0], z: kp[1] }; }
      if (keySpot) pedestals.push({ id: pedestals.length, kind: 'key', x: keySpot.x, z: keySpot.z });
    }
    // rune-sealed shortcut between two rooms
    if (r() < 0.6) { const g = this.tryShortcut(grid, rooms, Wd, Ht, r, gates.length); if (g) gates.push(g); }
    if (kind === 'elite') { const ex = rooms.find(q => q.type === 'exit'); if (ex) pedestals.push({ id: pedestals.length, kind: 'relic', relic: G.rollRelic(r), x: ex.cx * CS, z: (ex.cy - 1) * CS }); }
    // descents: a few rooms sink a storey below the corridors, reached by flights of stairs at every doorway
    const { hc, stairs } = this.sinkRooms(grid, roomId, rooms, gates, Wd, Ht, r, kind === 'combat' ? 2 + (r() < 0.5 ? 1 : 0) : kind === 'elite' ? 2 : 1);
    // broken walls: tunnels knocked through the rock between two passages that are otherwise far apart
    const tunnels = this.tryTunnels(grid, roomId, rooms, hc, stairs, gates, Wd, Ht, r, kind === 'combat' ? 3 : 2);
    // pressure-plate traps
    const traps = [], tk = { crypt: ['darts', 'spikes', 'gas'], warrens: ['darts', 'gas', 'spikes'], forge: ['fire', 'spikes', 'darts'], abyss: ['spikes', 'gas', 'darts', 'fire'] }[theme] || ['spikes', 'darts'];
    const nearGate = (x, y) => gates.some(g => Math.abs(g.cx - x) + Math.abs(g.cy - y) <= 2) || (bossDoor && Math.abs(bossDoor.cx - x) + Math.abs(bossDoor.cy - y) <= 4);
    const nTraps = 3 + Math.floor(depth * 0.6) + (kind === 'elite' ? 2 : 0);
    for (let k = 0; k < nTraps; k++) for (let t = 0; t < 60; t++) {
      const x = G.ri(1, Wd - 2, r), y = G.ri(1, Ht - 2, r), v = grid[y * Wd + x], rid = roomId[y * Wd + x];
      if (!v || (v === 1 && r() < 0.6) || nearGate(x, y) || hc[y * Wd + x] || stairs[y * Wd + x]) continue; if (rid >= 0 && ['start', 'exit', 'boss', 'annex', 'npc', 'event', 'puzzle'].includes(rooms[rid].type)) continue;
      if (traps.some(q => Math.abs(q.cx - x) + Math.abs(q.cy - y) < 3)) continue;
      traps.push({ id: traps.length, kind: G.pick(tk, r), cx: x, cy: y, x: (x + 0.3 + r() * 0.4) * CS, z: (y + 0.3 + r() * 0.4) * CS, dc: 12 + Math.floor(depth / 2) + (r() < 0.3 ? 2 : 0) }); break;
    }
    // a Shrine of Returning, scarce: the only way back for an ally who has died
    if ((kind === 'combat' && r() < 0.3) || (kind === 'elite' && r() < 0.45) || (bossy && r() < 0.5)) { const o = G.pick(rooms.filter(q => q.type === 'normal' && q.w >= 5 && q.h >= 5 && !q.shape && !q.pit), r); if (o) shrines.push({ id: 0, x: (o.x + 1.3) * CS, z: (o.y + 1.3) * CS }); }
    const boss = rooms.find(o => o.type === 'boss'), exit = rooms.find(o => o.type === 'exit'), start = rooms[0];
    const quests = G.Quests.gen(r, kind, rooms, gates, CS, theme);
    return { hc, stairs, tunnels, pits: pitCells, kind, seed, theme, depth, Wd, Ht, grid, roomId, rooms, spawns, chests, npcs, events, pedestals, gates, traps, hidden, boss, exit, start, bossDoor, puzzles, shrines, quests, r: G.mulberry(seed * 31 + (node.key || 0)) };
  },
  /* sunken rooms: the whole room drops DROP below the corridors. Every cell that leads into it must be a straight
     corridor cell walled on both sides (or flanked by another stair heading the same way), with level floor behind,
     so it can become a flight of stairs; annexes behind the room's gates sink with it. */
  DROP: 2.0,
  sinkRooms(grid, roomId, rooms, gates, Wd, Ht, r, want) {
    const N = Wd * Ht, hc = new Float32Array(N), stairs = {}, D = this.DROP, gateAt = {};
    gates.forEach(g => gateAt[g.i] = g);
    const cand = G.shuffle(rooms.filter(o => (o.type === 'normal' || o.type === 'treasure') && o.w >= 4 && o.h >= 4 && !o.pit), r);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const o of cand) {
      if (want <= 0) break;
      const conns = new Map(), annexes = new Set(), gcells = []; let ok = true;
      for (let y = o.y; y < o.y + o.h && ok; y++) for (let x = o.x; x < o.x + o.w && ok; x++) {
        if (roomId[y * Wd + x] !== o.id) continue;
        for (const [dx, dz] of dirs) {
          const nx = x + dx, ny = y + dz, j = ny * Wd + nx;
          if (nx < 0 || ny < 0 || nx >= Wd || ny >= Ht) continue;
          const g = gateAt[j];
          if (g) { if (g.annex >= 0 && g.type !== 'rune') { annexes.add(g.annex); gcells.push(j); continue; } ok = false; break; }
          if (!grid[j] || roomId[j] === o.id) continue;
          if (roomId[j] >= 0) { if (rooms[roomId[j]].type === 'annex') { ok = false; break; } ok = false; break; }   // room touching room: no room for stairs
          if (conns.has(j)) { ok = false; break; }   // a corner cell reaching the room from two sides
          conns.set(j, { dir: [-dx, -dz] });          // the flight descends toward the room
        }
      }
      if (!ok || !conns.size) continue;
      for (const [j, c] of conns) {
        const [dx, dz] = c.dir, cx = j % Wd, cy = (j / Wd) | 0, bx = cx - dx, by = cy - dz, b = by * Wd + bx;
        if (stairs[j] || hc[j] || gateAt[j]) { ok = false; break; }
        if (bx < 0 || by < 0 || bx >= Wd || by >= Ht || !grid[b] || conns.has(b) || stairs[b] || hc[b] || roomId[b] === o.id) { ok = false; break; }
        for (const s of [-1, 1]) { const px = cx + dz * s, py = cy + dx * s, pj = py * Wd + px; if (!grid[pj] && !gateAt[pj]) continue; const pc = conns.get(pj); if (!pc || pc.dir[0] !== dx || pc.dir[1] !== dz) { ok = false; break; } }
        if (!ok) break;
      }
      if (!ok) continue;
      for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) if (roomId[y * Wd + x] === o.id) hc[y * Wd + x] = -D;
      annexes.forEach(a => { const A = rooms[a]; for (let y = A.y; y < A.y + A.h; y++) for (let x = A.x; x < A.x + A.w; x++) if (roomId[y * Wd + x] === a) hc[y * Wd + x] = -D; });
      gcells.forEach(j => hc[j] = -D);
      for (const [j, c] of conns) { stairs[j] = { dx: c.dir[0], dz: c.dir[1] }; hc[j] = -D / 2; }
      o.sunk = true; want--;
    }
    return { hc, stairs };
  },
  // carve a regular room into a rounder cavern, a cross, an L, or a hall of square columns
  shapeRoom(o, grid, roomId, Wd, r) {
    if (o.w < 6 || o.h < 6 || r() > 0.5) return;
    const kinds = ['round', 'round', 'cross', 'ell', 'columns'], k = G.pick(kinds, r), cut = [];
    for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) {
      const u = (x + 0.5 - o.x) / o.w, v = (y + 0.5 - o.y) / o.h, ix = x - o.x, iy = y - o.y; let out = false;
      if (k === 'round') out = ((u - 0.5) / 0.5) ** 2 + ((v - 0.5) / 0.5) ** 2 > 1.08;
      else if (k === 'cross') { const tw = Math.max(1, Math.floor(o.w / 3.2)), th = Math.max(1, Math.floor(o.h / 3.2)); out = (ix < tw || ix >= o.w - tw) && (iy < th || iy >= o.h - th); }
      else if (k === 'ell') { const q = o.id % 4; out = (q & 1 ? u > 0.55 : u < 0.45) && (q & 2 ? v > 0.55 : v < 0.45); }
      else if (k === 'columns') out = ix > 0 && iy > 0 && ix < o.w - 1 && iy < o.h - 1 && ix % 3 === 1 && iy % 3 === 1 && !(Math.abs(x + 0.5 - o.cx) < 1 && Math.abs(y + 0.5 - o.cy) < 1);
      if (out) cut.push(y * Wd + x);
    }
    // the centre always stays floor (corridors aim at it)
    const ci = Math.floor(o.cy) * Wd + Math.floor(o.cx); cut.forEach(i => { if (i !== ci) { grid[i] = 0; roomId[i] = -1; } });
    o.shape = k;
  },
  // straight bores through the rock: 1-3 wall cells between two level passages that are far apart on foot
  tryTunnels(grid, roomId, rooms, hc, stairs, gates, Wd, Ht, r, want) {
    const out = [], A0 = this._arena, gateSet = new Set(gates.map(g => g.i)), ok = (x, y) => x > 0 && y > 0 && x < Wd - 1 && y < Ht - 1;
    const endOk = i => grid[i] && !hc[i] && !stairs[i] && !gateSet.has(i) && (roomId[i] < 0 || rooms[roomId[i]].type === 'normal');
    const walk = (from) => { const d = new Int16Array(Wd * Ht).fill(-1), q = [from]; d[from] = 0; for (let h = 0; h < q.length; h++) { const i = q[h], x = i % Wd, y = (i / Wd) | 0; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (y + b) * Wd + x + a; if (grid[j] && d[j] < 0) { d[j] = d[i] + 1; q.push(j); } } } return d; };
    for (let tries = 0; tries < 900 && out.length < want; tries++) {
      const x0 = G.ri(1, Wd - 2, r), y0 = G.ri(1, Ht - 2, r), a = y0 * Wd + x0; if (!endOk(a)) continue;
      const [dx, dz] = G.pick([[1, 0], [-1, 0], [0, 1], [0, -1]], r), len = G.ri(1, 4, r), cells = []; let good = true;
      for (let k = 1; k <= len; k++) { const x = x0 + dx * k, y = y0 + dz * k, i = y * Wd + x; if (!ok(x, y) || grid[i] || gateSet.has(i) || grid[(y + dx) * Wd + x + dz] || grid[(y - dx) * Wd + x - dz] || gateSet.has((y + dx) * Wd + x + dz) || gateSet.has((y - dx) * Wd + x - dz)) { good = false; break; } if (A0 && x >= A0.x - 2 && x <= A0.x + A0.w + 1 && y >= A0.y - 2 && y <= A0.y + A0.h + 1) { good = false; break; } cells.push(i); }
      if (!good) continue; const bx = x0 + dx * (len + 1), by = y0 + dz * (len + 1), b = by * Wd + bx; if (!ok(bx, by) || !endOk(b)) continue;
      if (out.some(t => t.cells.some(c => Math.abs((c % Wd) - x0) + Math.abs(((c / Wd) | 0) - y0) < 4))) continue;
      const dist = walk(a)[b]; if (dist >= 0 && dist < 7) continue;   // only worth a tunnel if it saves a real detour
      cells.forEach(i => grid[i] = 2); out.push({ cells, dx, dz, a, b });
    }
    return out;
  },
  // a small room carved behind a single-cell gate on the side of an existing room
  tryAnnex(grid, roomId, rooms, Wd, Ht, r, type, gid) {
    const cand = rooms.filter(o => o.type === 'normal' || o.type === 'treasure' || o.type === 'exit');
    for (let tries = 0; tries < 220; tries++) {
      const R = G.pick(cand, r); if (!R) return null;
      const side = G.ri(0, 3, r), aw = G.ri(3, 4, r), ah = G.ri(3, 4, r);
      let gx, gy, ax, ay, dx = 0, dz = 0;
      if (side === 0) { gx = R.x + R.w; gy = R.y + G.ri(0, R.h - 1, r); ax = gx + 1; ay = gy - Math.floor(ah / 2); dx = 1; }
      else if (side === 1) { gx = R.x - 1; gy = R.y + G.ri(0, R.h - 1, r); ax = gx - aw; ay = gy - Math.floor(ah / 2); dx = -1; }
      else if (side === 2) { gy = R.y + R.h; gx = R.x + G.ri(0, R.w - 1, r); ay = gy + 1; ax = gx - Math.floor(aw / 2); dz = 1; }
      else { gy = R.y - 1; gx = R.x + G.ri(0, R.w - 1, r); ay = gy - ah; ax = gx - Math.floor(aw / 2); dz = -1; }
      if (ax < 2 || ay < 2 || ax + aw > Wd - 2 || ay + ah > Ht - 2) continue;
      const A0 = this._arena; if (A0 && ax - 2 <= A0.x + A0.w && ax + aw + 1 >= A0.x - 1 && ay - 2 <= A0.y + A0.h && ay + ah + 1 >= A0.y - 1) continue;
      let ok = !grid[gy * Wd + gx] && grid[(gy - dz) * Wd + gx - dx] && roomId[(gy - dz) * Wd + gx - dx] === R.id;   // the doorway must open onto the room's real floor
      for (let y = ay - 1; ok && y <= ay + ah; y++) for (let x = ax - 1; x <= ax + aw; x++) { if (x === gx && y === gy) continue; if (grid[y * Wd + x]) { ok = false; break; } }
      // the cells beside the gate must be wall so the doorway is a real doorway
      if (ok) { const sx = dz ? 1 : 0, sz = dx ? 1 : 0; if (grid[(gy + sz) * Wd + gx + sx] || grid[(gy - sz) * Wd + gx - sx]) ok = false; }
      if (!ok) continue;
      const ro = { x: ax, y: ay, w: aw, h: ah, type: 'annex', gate: type, cx: ax + aw / 2, cy: ay + ah / 2, id: rooms.length }; rooms.push(ro);
      const cells = []; for (let y = ay; y < ay + ah; y++) for (let x = ax; x < ax + aw; x++) { grid[y * Wd + x] = 1; roomId[y * Wd + x] = ro.id; cells.push(y * Wd + x); }
      return { id: gid, type, cx: gx, cy: gy, i: gy * Wd + gx, dir: [dx, dz], annex: ro.id, cells, hp: 3, dc: type === 'locked' ? 13 : type === 'rune' ? 14 : 0 };
    }
    return null;
  },
  // a straight one-cell corridor through solid rock between two rooms, sealed by runes in the middle
  tryShortcut(grid, rooms, Wd, Ht, r, gid) {
    const rs = rooms.filter(o => o.type !== 'annex' && o.type !== 'boss');
    for (let tries = 0; tries < 200; tries++) {
      const A = G.pick(rs, r), B = G.pick(rs, r); if (A === B) continue;
      const lo = Math.max(A.y, B.y), hi = Math.min(A.y + A.h, B.y + B.h) - 1, lox = Math.max(A.x, B.x), hix = Math.min(A.x + A.w, B.x + B.w) - 1;
      let cells = [];
      if (hi >= lo && B.x > A.x + A.w + 2) { const y = G.ri(lo, hi, r); for (let x = A.x + A.w; x < B.x; x++) cells.push([x, y]); }
      else if (hix >= lox && B.y > A.y + A.h + 2) { const x = G.ri(lox, hix, r); for (let y = A.y + A.h; y < B.y; y++) cells.push([x, y]); }
      if (cells.length < 3 || cells.length > 9) continue;
      { const [fx, fy0] = cells[0], [lx, ly] = cells[cells.length - 1], vx = cells.length > 1 ? Math.sign(lx - fx) : 0, vy = cells.length > 1 ? Math.sign(ly - fy0) : 0; if (!grid[(fy0 - vy) * Wd + fx - vx] || !grid[(ly + vy) * Wd + lx + vx]) continue; }   // both ends must open onto floor
      const A0 = this._arena; if (A0 && cells.some(([x, y]) => x >= A0.x - 2 && x <= A0.x + A0.w + 1 && y >= A0.y - 2 && y <= A0.y + A0.h + 1)) continue;
      const vert = cells[0][0] === cells[cells.length - 1][0];
      if (cells.some(([x, y]) => grid[y * Wd + x] || (vert ? grid[y * Wd + x - 1] || grid[y * Wd + x + 1] : grid[(y - 1) * Wd + x] || grid[(y + 1) * Wd + x]))) continue;
      cells.forEach(([x, y]) => grid[y * Wd + x] = 2);
      const [gx, gy] = cells[Math.floor(cells.length / 2)]; grid[gy * Wd + gx] = 0;
      return { id: gid, type: 'rune', cx: gx, cy: gy, i: gy * Wd + gx, dir: vert ? [0, 1] : [1, 0], annex: -1, cells: [], hp: 0, dc: 14 };
    }
    return null;
  },
  // single-room nodes: mystery events, the merchant, the campfire, a treasure vault
  genChamber(seed, theme, node, r) {
    const Wd = 13, Ht = 13, CS = this.CS, grid = new Uint8Array(Wd * Ht), roomId = new Int16Array(Wd * Ht).fill(-1);
    const ro = { x: 3, y: 3, w: 7, h: 7, type: 'chamber', cx: 6.5, cy: 6.5, id: 0 };
    for (let y = 3; y < 10; y++) for (let x = 3; x < 10; x++) { grid[y * Wd + x] = 1; roomId[y * Wd + x] = 0; }
    const L = { kind: node.type, seed, theme, depth: node.depth, Wd, Ht, grid, roomId, rooms: [ro], spawns: [], chests: [], npcs: [], events: [], pedestals: [], gates: [], traps: [], hidden: [], puzzles: [], shrines: [], boss: null, exit: ro, start: ro, chamber: true, r: G.mulberry(seed * 31 + (node.key || 0)) };
    const cx = ro.cx * CS, cz = ro.cy * CS;
    if (node.type === 'event') L.events.push({ id: 0, ev: G.pick(Object.keys(G.EVENTS), r), x: cx, z: cz });
    if (node.type === 'shop') L.shop = { x: cx, z: cz - 3, stock: this.shopStock(r) };
    if (node.type === 'rest') { L.rest = { x: cx, z: cz }; L.shrines.push({ id: 0, x: cx + 7, z: cz - 4 }); }
    if (node.type === 'puzzle') { ro.type = 'puzzle'; this.addPuzzle(L.puzzles, L.chests, ro, r); }
    if (node.type === 'treasure') {
      for (let k = 0; k < 3; k++) L.chests.push({ id: k, x: cx + (k - 1) * 4.5, z: cz + 2, tier: 1 + (k === 1 ? 1 : 0), rot: Math.PI, mimic: r() < 0.35 });
      const np = Math.max(1, node.np || 1); for (let k = 0; k < np; k++) L.pedestals.push({ id: k, kind: 'relic', relic: G.rollRelic(r), x: cx + (k - (np - 1) / 2) * 3, z: cz - 3 });
    }
    return L;
  },
  addPuzzle(puzzles, chests, o, r) {
    const CS = this.CS, kind = G.pick(['levers', 'watchers', 'flames', 'mirrors', 'plates', 'dials'], r), id = puzzles.length, cx = o.cx * CS, cz = o.cy * CS;
    const p = { id, kind, room: o.id, x: cx, z: cz, seed: Math.floor(r() * 1e9), chest: chests.length };
    chests.push({ id: chests.length, x: cx, z: cz + (kind === 'levers' || kind === 'dials' ? 5 : kind === 'plates' ? 5.2 : 0), tier: 2, rot: Math.PI, mimic: false, locked: true, puzzle: id });
    puzzles.push(p); return p;
  },
  shopStock(r) {
    const s = [];
    const rel = G.shuffle(G.RELIC_IDS.slice(), r).slice(0, 2); rel.forEach(id => s.push({ kind: 'relic', relic: id, price: 140 + Math.floor(r() * 60) }));
    const clean = () => { let it; do { it = G.makeMagic(r); } while (G.MAGIC[it.mid].cursed); const B = G.MAGIC_BASE[G.MAGIC[it.mid].base]; it.model = B[1]; it.v = B[2]; return it; };
    s.push({ kind: 'magic', item: clean(), price: 95 }); s.push({ kind: 'magic', item: clean(), price: 110 });
    s.push({ kind: 'scroll', price: 35 }); s.push({ kind: 'scroll', price: 35 });
    s.push({ kind: 'flask', price: 60 }); s.push({ kind: 'tutor', price: 130 });
    return s;
  },

  /* ------------------ queries ------------------ */
  cellOf(x, z) { return [Math.floor(x / this.CS), Math.floor(z / this.CS)]; },
  // floor height under a point: sunken rooms sit DROP below, stairs ramp smoothly between
  fy(x, z) {
    const hc = this.hc; if (!hc) return 0; const fx = x / this.CS, fz = z / this.CS, cx = Math.floor(fx), cz = Math.floor(fz);
    if (cx < 0 || cz < 0 || cx >= this.W || cz >= this.H) return 0; const i = cz * this.W + cx, st = this.stairs[i];
    if (st) { const u = fx - cx, v = fz - cz, t = st.dx > 0 ? u : st.dx < 0 ? 1 - u : st.dz > 0 ? v : 1 - v; return -this.DROP * G.clamp(t, 0, 1); }
    return hc[i];
  },
  // a point given in floor-relative height (most effects) lifted onto the real floor; absolute points pass through
  lift(v) { if (this.hc && v) { const g = this.fy(v.x, v.z); if (g < -1.5 && v.y > g + 1.9 && v.y < 4.2) v.y += g; } return v; },
  wallCell(cx, cz) { return cx < 0 || cz < 0 || cx >= this.W || cz >= this.H || !this.grid[cz * this.W + cx]; },
  isWall(x, z) { const c = this.cellOf(x, z); return this.wallCell(c[0], c[1]); },
  // a centre that ended up inside a wall cell leaves through the nearest face that opens onto floor
  eject(p, x, z, rad) {
    const CS = this.CS, opts = [[-1, 0, p.x - x * CS], [1, 0, (x + 1) * CS - p.x], [0, -1, p.z - z * CS], [0, 1, (z + 1) * CS - p.z]].filter(o => !this.wallCell(x + o[0], z + o[1])).sort((a, b) => a[2] - b[2]);
    const o = opts[0]; if (!o) return false;
    if (o[0]) p.x = o[0] < 0 ? x * CS - rad - 0.01 : (x + 1) * CS + rad + 0.01; else p.z = o[1] < 0 ? z * CS - rad - 0.01 : (z + 1) * CS + rad + 0.01;
    return true;
  },
  // swept move: sub-steps no longer than half the radius, colliding each step, so fast pushes (shield bash,
  // charges, explosions) slide along walls instead of tunnelling through them
  sweep(p, dx, dz, rad) {
    const L = Math.hypot(dx, dz), n = Math.max(1, Math.ceil(L / Math.max(0.1, rad * 0.5)));
    for (let i = 0; i < n; i++) { const ox = p.x, oz = p.z; p.x += dx / n; p.z += dz / n; this.collide(p, rad); if (this.isWall(p.x, p.z)) { p.x = ox; p.z = oz; return false; } }
    return true;
  },
  addSolid(x, z, rad) { const s = { x, z, r: rad }; this.solids.push(s); const c = this.cellOf(x, z), k = c[1] * 1000 + c[0]; (this.solidGrid[k] || (this.solidGrid[k] = [])).push(s); return s; },
  collide(p, rad) {
    const CS = this.CS, cx = Math.floor(p.x / CS), cz = Math.floor(p.z / CS);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx, z = cz + dz;
      if (this.wallCell(x, z)) {
        const nx = G.clamp(p.x, x * CS, x * CS + CS), nz = G.clamp(p.z, z * CS, z * CS + CS);
        const ddx = p.x - nx, ddz = p.z - nz, d2 = ddx * ddx + ddz * ddz;
        if (d2 < rad * rad) { if (d2 > 1e-6) { const d = Math.sqrt(d2), k = (rad - d) / d; p.x += ddx * k; p.z += ddz * k; } else this.eject(p, x, z, rad); }
      }
      const list = this.solidGrid[z * 1000 + x];
      if (list) for (const s of list) { const ddx = p.x - s.x, ddz = p.z - s.z, rr = rad + s.r, d2 = ddx * ddx + ddz * ddz; if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), k = (rr - d) / d; p.x += ddx * k; p.z += ddz * k; } }
    }
  },
  blocks(x, z) { if (!this.isWall(x, z)) return false; if (!this.pitSet || !this.pitSet.size) return true; const c = this.cellOf(x, z); return !this.pitSet.has(c[1] * this.W + c[0]); },   // walls stop sight and shots; chasms do not
  los(ax, az, bx, bz) { const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.8); for (let i = 1; i < n; i++) { const t = i / n; if (this.blocks(ax + (bx - ax) * t, az + (bz - az) * t)) return false; } return true; },
  rayWall(ox, oz, dx, dz, max) { for (let t = 0; t < max; t += 0.25) if (this.isWall(ox + dx * t, oz + dz * t)) return t; return max; },
  roomAt(x, z) { const c = this.cellOf(x, z); if (c[0] < 0 || c[1] < 0 || c[0] >= this.W || c[1] >= this.H) return -1; return this.roomId ? this.roomId[c[1] * this.W + c[0]] : -1; },
  // flow field toward a set of points
  flow(targets) {
    const N = this.W * this.H, dist = this.dist || (this.dist = new Int16Array(N)); dist.fill(32000);
    const q = new Int32Array(N); let h = 0, t = 0;
    targets.forEach(p => { const c = this.cellOf(p.x, p.z); if (!this.wallCell(c[0], c[1])) { const i = c[1] * this.W + c[0]; dist[i] = 0; q[t++] = i; } });
    while (h < t) { const i = q[h++], x = i % this.W, y = (i / this.W) | 0, d = dist[i] + 1;
      if (d > 60) continue;
      const nb = [i - 1, i + 1, i - this.W, i + this.W], ok = [x > 0, x < this.W - 1, y > 0, y < this.H - 1];
      for (let k = 0; k < 4; k++) if (ok[k] && this.grid[nb[k]] && dist[nb[k]] > d) { dist[nb[k]] = d; q[t++] = nb[k]; } }
  },
  flowDir(x, z, out) {
    const c = this.cellOf(x, z), i = c[1] * this.W + c[0]; if (!this.dist || this.wallCell(c[0], c[1])) return false;
    let best = this.dist[i], bi = -1;
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dz]) => { const xx = c[0] + dx, zz = c[1] + dz; if (this.wallCell(xx, zz)) return; const j = zz * this.W + xx; if (this.dist[j] < best) { best = this.dist[j]; bi = j; } });
    if (bi < 0) return false;
    out.x = ((bi % this.W) + 0.5) * this.CS - x; out.z = (((bi / this.W) | 0) + 0.5) * this.CS - z; return true;
  },

  /* ------------------ build ------------------ */
  clear() {
    if (this.group) { G.scene.remove(this.group); this.group.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); }
    this.group = new THREE.Group(); G.scene.add(this.group); this.chunks = []; this.arena = null; if (G.pvp) G.pvp.dummies = []; if (G.Quests) G.Quests.list = [];
    this.solids = []; this.solidGrid = {}; this.lights = []; this.interact = []; this.animated = []; G.flames = []; this.dist = null; this.roomId = null; this.lava = null; this.chests = []; this.npcs = []; this.hideNPCs = []; this.breakables = []; this.shrines = []; if (G.Puzzles) { G.Puzzles.list = []; G.Puzzles.playing = null; } this.gates = []; this.traps = []; this.pedestals = []; this.events = []; this.shop = null; this.rest = null; this.hiddenSet = new Set(); this.exitPortal = null; this.bossSpawn = null; this.bossRoom = null; this.hc = null; this.stairs = {}; this.pitSet = new Set(); this.tunnelSet = new Set();
  },
  addLight(obj, parentMatrixObj) {
    const L = obj.userData.light; if (!L) return;
    obj.updateMatrixWorld(true); const p = L.pos.clone().applyMatrix4(obj.matrixWorld);
    this.lights.push({ pos: p, color: L.color, intensity: L.intensity, dist: L.dist, seed: Math.random() * 10, flicker: true });
  },
  addBreakable(kind, x, z, ry, r) {
    const obj = kind === 'barrel' ? M.prop.barrel(r) : kind === 'crate' ? M.prop.crate() : kind === 'urn' ? M.prop.urn(r) : M.prop.pot(r);
    const rad = kind === 'crate' ? 0.48 : kind === 'barrel' ? 0.38 : 0.25;
    if (kind === 'crate' || kind === 'barrel') { const s = 0.85 + r() * 0.3; obj.scale.setScalar(s); }
    obj.userData.dynamic = true; this.place(obj, x, 0, z, ry, 0);
    const b = { id: this.breakables.length, kind, obj, x, z, rad, solid: this.addSolid(x, z, rad), broken: false, wood: kind === 'barrel' || kind === 'crate' };
    this.breakables.push(b); return b;
  },
  scatterBreakables(o, r, kinds, n) {
    const CS = this.CS;
    for (let k = 0; k < n; k++) {
      // cluster against a wall edge or room corner, like real storage
      const side = Math.floor(r() * 4), t = r();
      let x = (o.x + 0.6 + t * (o.w - 1.2)) * CS, z = (o.y + 0.6 + t * (o.h - 1.2)) * CS;
      if (side === 0) z = o.y * CS + 0.7; else if (side === 1) z = (o.y + o.h) * CS - 0.7; else if (side === 2) x = o.x * CS + 0.7; else x = (o.x + o.w) * CS - 0.7;
      const kind = G.pick(kinds, r), cnt = 1 + Math.floor(r() * 3);
      for (let j = 0; j < cnt; j++) { const bx = x + (r() - 0.5) * 1.6, bz = z + (r() - 0.5) * 1.6; if (this.isWall(bx, bz)) continue; this.addBreakable(j && r() < 0.4 ? G.pick(kinds, r) : kind, bx, bz, r() * 6, r); }
    }
  },
  hang(obj, x, y, z, ry = 0) { obj.position.set(x, y, z); obj.rotation.y = ry; this.group.add(obj); this.addLight(obj); return obj; },   // hung from the ceiling: no floor offset
  place(obj, x, y, z, ry = 0, solidR = 0) { obj.position.set(x, y + this.fy(x, z), z); obj.rotation.y = ry; this.group.add(obj); this.addLight(obj); if (solidR) { if (y < 0.5) this.solidFor(obj, x, z, ry, solidR === 'auto' ? 0 : solidR); else this.addSolid(x, z, solidR); } return obj; },
  /* collision that matches what you see: measure the prop's footprint at body height (ignoring glows and
     anything overhead) and cover it with one circle, or a row of circles for long things like coffins,
     tents and tables. min is the old hand-set radius, kept as a floor. */
  solidFor(obj, x, z, ry, min = 0) {
    obj.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert(), bb = new THREE.Box3(), mb = new THREE.Box3(), m = new THREE.Matrix4();
    obj.traverse(o => { if (!o.isMesh || o.isSprite || o.isPoints || !o.geometry || !o.visible) return; const mat = o.material; if (mat && (mat.blending === THREE.AdditiveBlending || (mat.transparent && mat.opacity < 0.5))) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); m.multiplyMatrices(inv, o.matrixWorld); mb.copy(o.geometry.boundingBox).applyMatrix4(m);
      if (mb.min.y > 1.7 || mb.max.y < 0.15) return; bb.union(mb); });
    if (bb.isEmpty()) { if (min) this.addSolid(x, z, min); return; }
    const sx = (bb.max.x - bb.min.x) * obj.scale.x * 0.82, sz = (bb.max.z - bb.min.z) * obj.scale.z * 0.82, cxl = (bb.max.x + bb.min.x) / 2 * obj.scale.x, czl = (bb.max.z + bb.min.z) / 2 * obj.scale.z;
    const c = Math.cos(ry), s = Math.sin(ry), toW = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    const long = Math.max(sx, sz), short = Math.min(sx, sz);
    if (long < 0.3) { if (min) this.addSolid(x, z, min); return; }
    if (long < short * 1.5) { const [wx, wz] = toW(cxl, czl); this.addSolid(wx, wz, Math.max(min, long / 2)); return; }
    const r = Math.max(0.25, short / 2), n = Math.max(2, Math.ceil((long - 2 * r) / r) + 1);
    for (let i = 0; i < n; i++) { const t = -long / 2 + r + (long - 2 * r) * (i / (n - 1)); const [wx, wz] = sx >= sz ? toW(cxl + t, czl) : toW(cxl, czl + t); this.addSolid(wx, wz, r); }
  },

  async build(L, prog = () => { }) {
    const tick = (pct, msg) => { prog(pct, msg); return new Promise(r => setTimeout(r, 0)); };
    await tick(8, 'Laying the foundations…');
    this.clear(); this.layout = L; this.theme = L.theme; this.W = L.Wd; this.H = L.Ht; this.grid = L.grid; this.roomId = L.roomId; this.rooms = L.rooms; this.hc = L.hc || null; this.stairs = L.stairs || {}; this.pitSet = new Set(L.pits || []); this.tunnelSet = new Set((L.tunnels || []).flatMap(t => t.cells));
    this.explored = new Uint8Array(this.W * this.H);
    const CS = this.CS, th = L.theme, dg = G.DUNGEONS[th], H = dg.wallH, r = L.r, grp = this.group;
    const wallTex = { crypt: 'cryptWall', warrens: 'cavernWall', forge: 'forgeWall', abyss: 'abyssWall' }[th], floorTex = { crypt: 'cryptFloor', warrens: 'cavernFloor', forge: 'forgeFloor', abyss: 'abyssFloor' }[th];
    const wt = G.tex.get(wallTex), ft = G.tex.get(floorTex);
    const wallMat = new THREE.MeshStandardMaterial({ map: wt.map, normalMap: wt.normalMap, roughness: 0.92, color: th === 'forge' ? 0xb0a0a0 : 0xffffff, emissiveMap: wt.emissiveMap || null, emissive: wt.emissiveMap ? new THREE.Color(th === 'abyss' ? 0xffffff : 0xff6020) : new THREE.Color(0), emissiveIntensity: wt.emissiveMap ? (th === 'abyss' ? 0.75 : 0.55) : 0 });
    const floorMat = new THREE.MeshStandardMaterial({ map: ft.map, normalMap: ft.normalMap, roughness: th === 'crypt' ? 0.75 : th === 'abyss' ? 0.32 : 0.9, metalness: th === 'forge' ? 0.3 : th === 'abyss' ? 0.4 : 0, emissiveMap: ft.emissiveMap || null, emissive: ft.emissiveMap ? new THREE.Color(th === 'abyss' ? 0xffffff : 0xff5010) : new THREE.Color(0), emissiveIntensity: ft.emissiveMap ? (th === 'abyss' ? 0.5 : 0.28) : 0 });
    const ceilMat = new THREE.MeshStandardMaterial({ map: wt.map, normalMap: wt.normalMap, color: 0x6a6a6a, roughness: 1 });
    this.wallMat = wallMat; this.floorMat = floorMat;
    // instancing
    const floors = [], walls = [], trims = [], gateSet = new Set((L.gates || []).map(g => g.i).concat(L.bossDoor ? [L.bossDoor.i] : []));
    // boss arenas get a much taller vault so big bosses never clip the ceiling
    const bossId = L.boss ? L.boss.id : -1, HA = Math.max(H * 2.1, 10.5); this.arenaH = HA; this.bossId = bossId;
    const isB = (x, z) => x >= 0 && z >= 0 && x < this.W && z < this.H && this.roomId[z * this.W + x] === bossId && bossId >= 0;
    const nearB = (x, z) => { for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (isB(x + dx, z + dz)) return true; return false; };
    this.hAt = (x, z) => isB(Math.floor(x / CS), Math.floor(z / CS)) ? HA : H;
    this.hiddenSet = new Set(L.hidden || []);
    for (let z = 0; z < this.H; z++) for (let x = 0; x < this.W; x++) {
      if (this.grid[z * this.W + x]) floors.push([x, z]);
      else if (gateSet.has(z * this.W + x) || this.pitSet.has(z * this.W + x)) continue;
      else { let adj = false; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (!this.wallCell(x + dx, z + dz)) adj = true; if (adj) walls.push([x, z]); }
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), ps = new THREE.Vector3();
    const inst = (geo, mat, list, fn) => { const im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((c, i) => { fn(c, ps, q, sc); m4.compose(ps, q, sc); im.setMatrixAt(i, m4); }); im.instanceMatrix.needsUpdate = true; grp.add(im); return im; };
    const fgeo = new THREE.BoxGeometry(CS, 0.4, CS, 2, 1, 2);
    const floorsR = floors.concat((L.gates || []).map(g => [g.cx, g.cy])).concat(L.bossDoor ? [[L.bossDoor.cx, L.bossDoor.cy]] : []);
    const wallsT = walls.filter(c => nearB(c[0], c[1]));
    const hcl = (x, z) => this.hc ? this.hc[z * this.W + x] : 0, isStair = (x, z) => !!this.stairs[z * this.W + x];
    inst(fgeo, floorMat, floorsR.filter(c => !isStair(c[0], c[1])), (c, p) => { p.set((c[0] + 0.5) * CS, -0.2 + hcl(c[0], c[1]), (c[1] + 0.5) * CS); q.identity(); sc.set(1, 1, 1); });
    // flights of stairs: eight steps per cell, each a solid block down to the lower floor, with a stone nosing
    { const st = Object.keys(this.stairs).map(Number), NS = 8, D = this.DROP, list = [];
      st.forEach(i => { const sd = this.stairs[i], cx = i % this.W, cz = (i / this.W) | 0; for (let k = 0; k < NS; k++) list.push([cx, cz, sd.dx, sd.dz, k]); });
      if (list.length) {
        const sp = (c, p) => { const [cx, cz, dx, dz, k] = c, t = (k + 0.5) / NS, top = -D * (k + 0.5) / NS; p.set((cx + 0.5 + (dx ? (dx > 0 ? t - 0.5 : 0.5 - t) : 0)) * CS, (top - D - 0.25) / 2, (cz + 0.5 + (dz ? (dz > 0 ? t - 0.5 : 0.5 - t) : 0)) * CS); q.setFromAxisAngle(new G.V3(0, 1, 0), dx ? Math.PI / 2 : 0); sc.set(CS, top + D + 0.25, CS / NS); };
        inst(new THREE.BoxGeometry(1, 1, 1), floorMat, list, sp);
        const nose = th === 'forge' ? G.mat('col', { c: 0x2a2020, m: 0.7, r: 0.4 }) : th === 'warrens' ? G.mat('col', { c: 0x6a5a48, r: 0.95, t: 'rock' }) : G.mat('col', { c: 0x8a867e, r: 0.85, t: 'rock' });
        inst(new THREE.BoxGeometry(1, 1, 1), nose, list, (c, p) => { const [cx, cz, dx, dz, k] = c, t = (k + 1) / NS - 0.012, top = -D * (k + 0.5) / NS; p.set((cx + 0.5 + (dx ? (dx > 0 ? t - 0.5 : 0.5 - t) : 0)) * CS, top - 0.03, (cz + 0.5 + (dz ? (dz > 0 ? t - 0.5 : 0.5 - t) : 0)) * CS); q.setFromAxisAngle(new G.V3(0, 1, 0), dx ? Math.PI / 2 : 0); sc.set(CS * 0.98, 0.07, 0.09); });
      }
    }
    const wgeo = th === 'warrens' ? (() => { const g = new THREE.BoxGeometry(CS, H, CS, 4, 6, 4), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = Math.sin(x * 2.1 + y * 1.3) * Math.cos(z * 1.7 - y * 0.9) * 0.35; p.setXYZ(i, x + (Math.abs(x) > CS / 2 - 0.01 ? Math.sign(x) * n : 0), y, z + (Math.abs(z) > CS / 2 - 0.01 ? Math.sign(z) * n : 0)); } g.computeVertexNormals(); return g; })() : new THREE.BoxGeometry(CS, H, CS);
    inst(wgeo, wallMat, walls, (c, p) => { p.set((c[0] + 0.5) * CS, H / 2, (c[1] + 0.5) * CS); q.setFromAxisAngle(new G.V3(0, 1, 0), th === 'warrens' ? ((c[0] * 7 + c[1] * 13) % 4) * Math.PI / 2 : 0); sc.set(1, 1, 1); });
    { const D = this.DROP;
      // walls bordering anything sunken continue down to the lower floor
      const sunkNear = (x, z) => { for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, zz = z + dz; if (xx >= 0 && zz >= 0 && xx < this.W && zz < this.H && hcl(xx, zz) < 0) return true; } return false; };
      const lowWalls = this.hc ? walls.filter(c => sunkNear(c[0], c[1])) : [];
      if (lowWalls.length) inst(wgeo, wallMat, lowWalls, (c, p) => { p.set((c[0] + 0.5) * CS, -(D + 0.3) / 2, (c[1] + 0.5) * CS); q.identity(); sc.set(1, (D + 0.3) / H, 1); });
      this._lowWalls = lowWalls; }
    this.buildChasms(th, H, wallMat, floorMat, inst, q, sc, r);
    this.buildTunnels(L, th, H, wallMat, inst, q, sc, r);
    const cgeo = new THREE.PlaneGeometry(CS, CS);
    if (wallsT.length) inst(wgeo, wallMat, wallsT, (c, p) => { p.set((c[0] + 0.5) * CS, H + (HA - H) / 2, (c[1] + 0.5) * CS); q.identity(); sc.set(1, (HA - H) / H, 1); });
    inst(cgeo, ceilMat, floorsR.concat([...this.pitSet].map(i => [i % this.W, (i / this.W) | 0])), (c, p) => { p.set((c[0] + 0.5) * CS, isB(c[0], c[1]) ? HA : H, (c[1] + 0.5) * CS); q.setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)); sc.set(1, 1, 1); });
    // wall trims (baseboard & cornice) along every floor/wall boundary
    const faces = [];
    floors.forEach(([x, z]) => { [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dz]) => { if (this.wallCell(x + dx, z + dz) && !gateSet.has((z + dz) * this.W + x + dx) && !this.pitSet.has((z + dz) * this.W + x + dx)) faces.push([x, z, dx, dz]); }); });
    this.faces = faces;
    if (th !== 'warrens') {
      const trimMat = th === 'forge' ? G.mat('col', { c: 0x2a2020, m: 0.7, r: 0.4 }) : th === 'abyss' ? G.mat('col', { c: 0x241c34, m: 0.6, r: 0.25 }) : G.mat('col', { c: 0x7a766e, r: 0.9, t: 'rock' });
      const tg = new THREE.BoxGeometry(CS, 0.35, 0.3), cg = new THREE.BoxGeometry(CS, 0.3, 0.45);
      const fp = (f, p, y) => { p.set((f[0] + 0.5 + f[2] * 0.5) * CS - f[2] * 0.15, y, (f[1] + 0.5 + f[3] * 0.5) * CS - f[3] * 0.15); q.setFromAxisAngle(new G.V3(0, 1, 0), f[2] ? Math.PI / 2 : 0); sc.set(1, 1, 1); };
      inst(tg, trimMat, faces.filter(f => !isStair(f[0], f[1])), (f, p) => fp(f, p, 0.17 + (f[2] ? 0.012 : 0) + hcl(f[0], f[1])));
      inst(cg, trimMat, faces, (f, p) => fp(f, p, (isB(f[0], f[1]) ? HA : H) - 0.15 - (f[2] ? 0.012 : 0)));
      const bf = faces.filter(f => isB(f[0], f[1])); if (bf.length) { inst(cg, trimMat, bf, (f, p) => fp(f, p, H + 0.6 + (f[2] ? 0.012 : 0))); inst(tg, trimMat, bf, (f, p) => fp(f, p, H * 0.5 + 0.2 + (f[2] ? 0.012 : 0))); }
      if (th === 'forge' || th === 'abyss') { // glowing seams under cornice
        inst(new THREE.BoxGeometry(CS, 0.06, 0.05), G.mat('emissive', th === 'abyss' ? { c: 0x9a50ff, i: 2.4 } : { c: 0xff4010, i: 2.5 }), faces, (f, p) => fp(f, p, (isB(f[0], f[1]) ? HA : H) - 0.34 - (f[2] ? 0.012 : 0)));
      }
    } else {
      // rock chunks along cave walls & stalactites
      const rockM = G.mat('col', { c: 0x7a6a58, r: 0.95, t: 'rock' }), rg = M.rockGeo(1, 1, 0.35, r), sg = M.cone(0.4, 1, 7);
      const pick = faces.filter((f, i) => r() < 0.45);
      inst(rg, rockM, pick, (f, p) => { p.set((f[0] + 0.5 + f[2] * 0.45) * CS + (r() - 0.5) * 2 * (1 - Math.abs(f[2])), r() * 1.0, (f[1] + 0.5 + f[3] * 0.45) * CS + (r() - 0.5) * 2 * (1 - Math.abs(f[3]))); q.setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3)); const s = 0.6 + r() * 0.9; sc.set(s, s * (0.7 + r() * 0.8), s); p.y += hcl(f[0], f[1]); });
      const stl = floors.filter(() => r() < 0.35);
      inst(sg, rockM, stl, (c, p) => { p.set((c[0] + r()) * CS, (isB(c[0], c[1]) ? HA : H) - 0.5, (c[1] + r()) * CS); q.setFromEuler(new THREE.Euler(Math.PI, 0, 0)); const s = 0.5 + r() * 1.2; sc.set(s, s * (1 + r()), s); });
    }
    // torches on walls
    const torchFaces = faces.filter((f, i) => { const rid = this.roomId[f[1] * this.W + f[0]]; return ((f[0] * 31 + f[1] * 17 + f[2] * 3 + f[3]) % (rid >= 0 ? 4 : 6)) === 0; });
    torchFaces.forEach(f => { const t = M.prop.torch(th); this.place(t, (f[0] + 0.5 + f[2] * 0.5) * CS - f[2] * 0.02, 2.3, (f[1] + 0.5 + f[3] * 0.5) * CS - f[3] * 0.02, Math.atan2(-f[2], -f[3])); });
    // per room decoration
    await tick(30, 'Raising the walls…');
    for (let i = 0; i < L.rooms.length; i++) { this.decorateRoom(L.rooms[i], i, th, i === bossId ? HA : H, r); if (i % 2 === 1) await tick(30 + Math.round((i + 1) / L.rooms.length * 40), 'Furnishing the halls…'); }
    // corridor decor
    floors.forEach(([x, z]) => { if (this.roomId[z * this.W + x] >= 0) return; const v = r();
      if (th === 'crypt' && v < 0.05) this.place(M.prop.bones(r), (x + 0.5) * CS, 0, (z + 0.5) * CS, r() * 6);
      if (th === 'warrens' && v < 0.06) this.place(M.prop.mushrooms(r, G.pick([0x40e0ff, 0x60ff90, 0xc070ff], r)), (x + 0.3 + r() * 0.4) * CS, 0, (z + 0.3 + r() * 0.4) * CS);
      if (th === 'forge' && v < 0.04) this.hang(M.prop.chains(1.5 + r() * 2), (x + 0.5) * CS, H, (z + 0.5) * CS);
      if (th === 'abyss' && v < 0.05) { const sh = M.abyss.shards(r); sh.userData.dynamic = true; this.place(sh, (x + 0.5) * CS, 0, (z + 0.5) * CS); sh.children.forEach(c => this.animated.push({ bob: c, y: c.position.y })); }
      if (th === 'abyss' && v > 0.95) this.place(M.abyss.tendrils(r), (x + 0.3 + r() * 0.4) * CS, 0, (z + 0.3 + r() * 0.4) * CS, r() * 6);
    });
    // cobwebs in wall corners
    if (th !== 'forge') faces.forEach(f => { if (r() < 0.06) { const w = M.prop.cobweb(); w.position.set((f[0] + 0.5 + f[2] * 0.48) * CS + (f[3] ? (r() < 0.5 ? -1.6 : 1.6) : 0), (isB(f[0], f[1]) ? HA : H) - 0.8, (f[1] + 0.5 + f[3] * 0.48) * CS + (f[2] ? (r() < 0.5 ? -1.6 : 1.6) : 0)); w.rotation.set(0, Math.atan2(f[2], f[3]) + Math.PI / 4, 0.3); grp.add(w); } });
    // chests
    await tick(74, 'Hiding the treasure…');
    this.chests = L.chests.map(c => { const m = M.prop.chest(c.tier); m.userData.dynamic = true; this.place(m, c.x, 0, c.z, c.rot, 0.55); return Object.assign({}, c, { mesh: m, opened: false }); });
    // NPCs
    this.npcs = L.npcs.map(n => { const R = M.npc[n.def.model](); if (R.kind === 'hum') M.batchRig(R); R.root.userData.dynamic = true; R.root.position.set(n.x, 0, n.z); grp.add(R.root);
      if (R.light) this.lights.push({ pos: new G.V3(n.x, 2.2, n.z), color: R.light.color, intensity: R.light.intensity, dist: R.light.dist, seed: 0, flicker: false });
      const ring = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ map: G.tex.sprite('rune'), color: 0xffd080, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(n.x, 0.045, n.z); ring.renderOrder = 0.7; ring.userData.dynamic = true; grp.add(ring); this.animated.push({ spin: ring, sp: 0.2 });
      this.addSolid(n.x, n.z, 0.6); return { def: n.def, R, x: n.x, z: n.z, used: {}, st: { t: 0, move: 0, atk: -1 } }; });
    // start room arrival ring
    const sr = L.start, spx = sr.cx * CS, spz = L.chamber ? (sr.y + sr.h - 1) * CS : sr.cy * CS;
    this.spawnPoint = new G.V3(spx, 0, spz);
    if (!L.chamber) { const arrival = M.prop.portal(0x6a8aff); arrival.userData.dynamic = true; arrival.scale.setScalar(0.8); this.place(arrival, spx, 0, (sr.y + 0.6) * CS, 0); this.animated.push({ portal: arrival }); }
    this.bossRoom = L.boss; this.bossSpawn = L.boss ? new G.V3(L.boss.cx * CS, 0, L.boss.cy * CS) : null;
    this.exitPortal = null;
    await tick(78, 'Setting the traps…');
    this.buildFeatures(L, th, H, wallMat);
    if (L.chamber) this.spawnExitPortal(false, sr.cx * CS, (sr.y + 1.1) * CS, true);
    else if (L.exit && L.kind !== 'boss' && L.kind !== 'miniboss') this.spawnExitPortal(false, L.exit.cx * CS, L.exit.cy * CS, true);
    await tick(82, 'Settling the dust…');
    this.batchStatic();
  },
  // merge every static prop mesh into per-chunk, per-material batches; cull chunks by distance
  batchStatic() {
    if (!THREE.BufferGeometryUtils) return;
    const buckets = new Map(), victims = [], CH = 14;
    this.group.updateMatrixWorld(true);
    const walk = (o) => {
      if (o.userData.dynamic || o.userData.flicker || o.isSprite || o.isPoints) return;
      if (o.isMesh && !o.isInstancedMesh && !o.userData.keep && !Array.isArray(o.material)) {
        if (o.visible && !o.material.transparent && o.material.map !== G.tex.sprite('web')) {
          const p = new G.V3().setFromMatrixPosition(o.matrixWorld), key = Math.floor(p.x / CH) + ',' + Math.floor(p.z / CH) + '|' + o.material.uuid;
          if (!buckets.has(key)) buckets.set(key, { mat: o.material, list: [] });
          buckets.get(key).list.push({ geo: o.geometry, matrix: o.matrixWorld.clone() }); victims.push(o);
        }
      }
      o.children.slice().forEach(walk);
    };
    this.group.children.slice().forEach(c => { if (!c.isInstancedMesh) walk(c); });
    victims.forEach(v => v.parent && v.parent.remove(v));
    this.chunks = [];
    buckets.forEach(b => { const g = M.mergeList(b.list); if (!g) return; const m = new THREE.Mesh(g, b.mat); this.group.add(m); this.chunks.push(m); });
    // drop now-empty prop groups
    this.group.children.slice().forEach(c => { if (c.type === 'Group' && !c.children.length) this.group.remove(c); });
  },
  cull(cam) {
    if (!this.chunks) return; const cx = cam.position.x, cz = cam.position.z, R2 = (this.theme === 'hideout' ? 200 : 46) ** 2;
    for (const m of this.chunks) { const s = m.geometry.boundingSphere; m.visible = (s.center.x - cx) ** 2 + (s.center.z - cz) ** 2 < R2 + s.radius * s.radius * 2; }
    const R3 = this.theme === 'hideout' ? R2 : 34 * 34; if (!this._chunkSet || this._chunkSrc !== this.chunks) { this._chunkSet = new Set(this.chunks); this._chunkSrc = this.chunks; }
    for (const o of this.group.children) { if (o.isInstancedMesh || this._chunkSet.has(o)) continue; o.visible = (o.position.x - cx) ** 2 + (o.position.z - cz) ** 2 < R3; }
  },

  decorateRoom(o, i, th, H, r) {
    const CS = this.CS, x0 = o.x * CS, z0 = o.y * CS, w = o.w * CS, d = o.h * CS, cx = o.cx * CS, cz = o.cy * CS;
    const keepClear = o.type === 'event' || o.type === 'chamber' || o.type === 'start' || o.type === 'puzzle';
    const rp = () => { let p; for (let k = 0; k < 14; k++) { p = [x0 + 1.5 + r() * (w - 3), z0 + 1.5 + r() * (d - 3)]; if (this.isWall(p[0], p[1]) || this.isWall(p[0] + 0.8, p[1]) || this.isWall(p[0] - 0.8, p[1]) || this.isWall(p[0], p[1] + 0.8) || this.isWall(p[0], p[1] - 0.8)) continue; if (!keepClear || Math.hypot(p[0] - cx, p[1] - cz) > 4.5) break; } return p; };
    // pillars at interior corners for large rooms
    if (o.w >= 6 && o.h >= 6 && th !== 'warrens') {
      [[1, 1], [o.w - 1, 1], [1, o.h - 1], [o.w - 1, o.h - 1]].forEach(([px, pz]) => { if (!this.isWall(x0 + px * CS, z0 + pz * CS)) this.place(M.prop.pillar(th, H - this.fy(x0 + px * CS, z0 + pz * CS)), x0 + px * CS, 0, z0 + pz * CS, 0, 0.45); });
      if (o.type === 'boss') for (let k = 1; k < 4; k++) { this.place(M.prop.pillar(th, H), x0 + k * w / 4, 0, z0 + CS * 2.2, 0, 0.45); this.place(M.prop.pillar(th, H), x0 + k * w / 4, 0, z0 + d - CS * 2.2, 0, 0.45); }
    }
    if (th === 'warrens' && o.w >= 5) for (let k = 0; k < 2; k++) if (!this.isWall(x0 + (k + 1) * w / 3, z0 + 0.6)) this.place(M.prop.pillar('warrens', H - this.fy(x0 + (k + 1) * w / 3, z0 + 0.6)), x0 + (k + 1) * w / 3, 0, z0 + 0.6, 0, 0.3);
    // vaulted ceiling ribs (crypt/forge)
    if (th !== 'warrens' && o.w >= 4) {
      const ribMat = th === 'forge' ? G.mat('col', { c: 0x2a2020, m: 0.6, r: 0.5 }) : th === 'abyss' ? G.mat('col', { c: 0x1c1626, m: 0.6, r: 0.3 }) : G.mat('col', { c: 0x8a8680, t: 'rock', r: 0.9 });
      const span = w / 2, ribs = Math.floor(o.h / 2);
      for (let k = 1; k <= ribs; k++) { const rib = new THREE.Mesh(M.tor(span, 0.18, 8, 32, Math.PI), ribMat); rib.position.set(cx, H - 1.5, z0 + (k / (ribs + 1)) * d); rib.scale.set(1, 1.5 / span, 1); this.group.add(rib); }
    }
    const big = o.w * o.h >= 40;
    if (th === 'crypt') {
      if (o.type === 'normal' || o.type === 'treasure') {
        if (r() < 0.6 && !o.shape && !o.pit) for (let k = 0; k < Math.min(4, o.h - 2); k += 2) { const s = M.prop.sarcophagus(); this.place(s, cx + (r() < 0.5 ? -1 : 1) * Math.min(w / 4, 4), 0, z0 + CS * (1.5 + k), 0, 0.9); }
        for (let k = 0; k < 2 + r() * 3; k++) { const p = rp(); this.place(M.prop.bones(r), p[0], 0, p[1], r() * 6); }
        this.scatterBreakables(o, r, ['urn', 'pot', 'pot', 'crate'], 2 + Math.floor(r() * 2));
        if (r() < 0.5) { const p = rp(); this.place(M.prop.coffin(r() < 0.6), p[0], 0, p[1], r() * 6, 0.6); }
        if (r() < 0.4) { const p = rp(); this.place(M.prop.cage(), p[0], 0, p[1], 0, 0.7); }
        for (let k = 0; k < 2; k++) { const p = rp(); this.place(M.prop.candles(5, r), p[0], 0, p[1]); }
      }
      if (big) this.hang(M.prop.chandelier(), cx, H - 2.6, cz);
      if (o.type === 'npc' || o.type === 'treasure') this.place(M.prop.altar(th), cx, 0, z0 + 1.2, 0, 0.9);
      if (o.type === 'boss') { this.place(M.prop.statue('crypt'), x0 + 2, 0, cz, Math.PI / 2, 0.7); this.place(M.prop.statue('crypt'), x0 + w - 2, 0, cz, -Math.PI / 2, 0.7); for (let k = 0; k < 6; k++) this.place(M.prop.candles(7, r), x0 + 3 + r() * (w - 6), 0, z0 + 3 + r() * (d - 6)); }
      this.bannerWalls(o, r, 0x5a1a1a, H);
    } else if (th === 'warrens') {
      for (let k = 0; k < 2 + r() * 3; k++) { const p = rp(); this.place(M.prop.mushrooms(r, G.pick([0x40e0ff, 0x60ff90, 0xc070ff], r)), p[0], 0, p[1], r() * 6, 'auto'); }
      for (let k = 0; k < 1 + r() * 2; k++) { const p = rp(); this.place(M.prop.crystals(r, G.pick([0x8a5aff, 0x40c0ff, 0x50ffb0], r)), p[0], 0, p[1], r() * 6, 0.3); }
      for (let k = 0; k < 2 + r() * 3; k++) { const p = rp(); this.place(M.prop.stalagmite(r, 0.8 + r() * 1.8), p[0], 0, p[1], r() * 6, 0.35); }
      if (o.type === 'normal' && r() < 0.5) { const p = rp(); this.place(M.prop.tent(), p[0], 0, p[1], r() * 6, 1.1); const q = rp(); this.place(M.prop.campfire(), q[0], 0, q[1], 0, 0.5); }
      this.scatterBreakables(o, r, ['barrel', 'crate', 'pot'], 2 + Math.floor(r() * 3));
      if (r() < 0.35 && o.w >= 5 && !o.shape && !o.pit) { this.place(M.prop.rails(o.h * CS - 2), cx, 0, cz, 0); this.place(M.prop.mineCart(), cx, 0, cz + r() * 4 - 2, 0, 0.7); }
      for (let k = 0; k < 2; k++) { const p = rp(); this.place(M.prop.bones(r), p[0], 0, p[1], r() * 6); }
      if (o.type === 'boss') { for (let k = 0; k < 10; k++) { const p = rp(); this.place(M.prop.stalagmite(r, 2 + r() * 3), p[0], 0, p[1], r() * 6, 0.5); } for (let k = 0; k < 6; k++) { const p = rp(); this.place(M.prop.crystals(r, 0xc060ff), p[0], 0, p[1], r() * 6, 0.3); } }
      // webs strung across room
      for (let k = 0; k < 3; k++) { const wbb = M.prop.cobweb(); wbb.scale.setScalar(2 + r() * 2); const p = rp(); wbb.position.set(p[0], H - 1.5 - r(), p[1]); wbb.rotation.set(r() * 0.6, r() * 6, 0); this.group.add(wbb); }
    } else if (th === 'forge') {
      if (r() < 0.55 && !o.shape && !o.pit && o.w >= 5 && o.h >= 5 && o.type !== 'start' && o.type !== 'npc' && o.type !== 'puzzle' && o.type !== 'chamber' && o.type !== 'exit') { const lw = Math.min(w - 6, 6 + r() * 4), ld = Math.min(d - 6, 4 + r() * 4); const lx = cx + (r() - 0.5) * 2, lz = cz + (r() - 0.5) * 2; this.place(M.prop.lavaPool(lw, ld), lx, 0, lz); this.lava = this.lava || []; this.lava.push({ x: lx, z: lz, w: lw / 2, d: ld / 2 }); }
      for (let k = 0; k < 2 + r() * 2; k++) { const p = rp(); this.place(M.prop.brazier(), p[0], 0, p[1], 0, 0.45); }
      for (let k = 0; k < 3; k++) { const p = rp(); this.hang(M.prop.chains(1 + r() * 2.5), p[0], H, p[1]); }
      if (r() < 0.5) { const p = rp(); this.place(M.prop.anvil(), p[0], 0, p[1], r() * 6, 0.4); }
      if (r() < 0.4) { const p = rp(); this.place(M.prop.cage(), p[0], 0, p[1], 0, 0.7); }
      for (let k = 0; k < 1 + r() * 2; k++) { const p = rp(); this.place(M.prop.spikes(r), p[0], 0, p[1], 0, 0.5); }
      this.scatterBreakables(o, r, ['barrel', 'crate', 'urn'], 1 + Math.floor(r() * 3));
      if (o.type === 'boss') { this.place(M.prop.statue('forge'), x0 + 2.5, 0, cz, Math.PI / 2, 1); this.place(M.prop.statue('forge'), x0 + w - 2.5, 0, cz, -Math.PI / 2, 1); for (let k = 0; k < 6; k++) { const p = rp(); this.place(M.prop.brazier(), p[0], 0, p[1], 0, 0.45); } }
      this.bannerWalls(o, r, 0x3a0808, H);
    } else if (th === 'abyss') {
      // the sanctum: obelisks, floating shards, void rifts, tendrils breaking the floor, crystal outcrops
      for (let k = 0; k < 1 + r() * 2; k++) { const p = rp(); this.place(M.abyss.obelisk(r), p[0], 0, p[1], r() * 6, 0.5); }
      for (let k = 0; k < 2 + r() * 2; k++) { const p = rp(); this.place(M.prop.crystals(r, G.pick([0x9a60ff, 0x6080ff, 0xc060ff], r)), p[0], 0, p[1], r() * 6, 0.3); }
      for (let k = 0; k < 1 + r() * 2; k++) { const p = rp(), sh = M.abyss.shards(r); sh.userData.dynamic = true; this.place(sh, p[0], 0, p[1]); sh.children.forEach(c => this.animated.push({ bob: c, y: c.position.y })); }
      if (!keepClear && r() < 0.55) { const p = rp(); this.place(M.abyss.rift(r), p[0], 0, p[1], r() * 6); }
      if (r() < 0.5) { const p = rp(); this.place(M.abyss.tendrils(r), p[0], 0, p[1], r() * 6, 0.5); }
      this.scatterBreakables(o, r, ['urn', 'urn', 'crate'], 1 + Math.floor(r() * 2));
      if (o.type === 'npc' || o.type === 'treasure') this.place(M.abyss.altar(r), cx, 0, z0 + 1.4, 0, 1.0);
      if (o.type === 'boss') { this.place(M.abyss.statue(r), x0 + 2.5, 0, cz, Math.PI / 2, 1); this.place(M.abyss.statue(r), x0 + w - 2.5, 0, cz, -Math.PI / 2, 1); for (let k = 0; k < 4; k++) { const p = rp(); this.place(M.abyss.obelisk(r), p[0], 0, p[1], r() * 6, 0.5); } }
      this.bannerWalls(o, r, 0x2a0a3a, H);
    }
    this.ambience(o, i, th, H, r);
    // keep NPC room center & start room clear: nothing else
  },
  /* chasms: shafts dropping into the dark, a curb at the lip, and something glowing far below */
  PD: 9,
  buildChasms(th, H, wallMat, floorMat, inst, q, sc, r) {
    if (!this.pitSet.size) return; const CS = this.CS, PD = this.PD, W = this.W, edges = [], curbs = [], deep = new Set();
    this.pitSet.forEach(i => { const x = i % W, z = (i / W) | 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (z + dz) * W + x + dx; if (this.pitSet.has(j)) continue; edges.push([x, z, dx, dz]); if (this.grid[j]) curbs.push([x, z, dx, dz]); else deep.add(j); } });
    const ep = (e, p, inset) => p.set((e[0] + 0.5 + e[2] * (0.5 - inset)) * CS, 0, (e[1] + 0.5 + e[3] * (0.5 - inset)) * CS);
    inst(new THREE.BoxGeometry(1, 1, 1), wallMat, edges, (e, p) => { ep(e, p, 0.04); p.y = -PD / 2 - 0.2; q.setFromAxisAngle(new G.V3(0, 1, 0), e[2] ? Math.PI / 2 : 0); sc.set(CS + 0.4, PD, 0.32); });
    const lip = th === 'forge' ? G.mat('col', { c: 0x2a2020, m: 0.7, r: 0.4 }) : th === 'warrens' ? G.mat('col', { c: 0x6a5a48, r: 0.95, t: 'rock' }) : G.mat('col', { c: 0x8a867e, r: 0.85, t: 'rock' });
    inst(new THREE.BoxGeometry(1, 1, 1), lip, curbs, (e, p) => { ep(e, p, -0.08); p.y = 0.16; q.setFromAxisAngle(new G.V3(0, 1, 0), e[2] ? Math.PI / 2 : 0); sc.set(CS + 0.3, 0.36, 0.42); });
    // the far bottom: black water, glowing fungus or lava, lit from below
    const pits = [...this.pitSet], bot = th === 'forge' ? G.mat('emissive', { c: 0xff4a10, i: 1.6 }) : th === 'warrens' ? G.mat('col', { c: 0x0a1a18, r: 0.3, e: 0x0a6a50, ei: 0.8 }) : th === 'abyss' ? G.mat('col', { c: 0x05020a, r: 0.2, e: 0x3a0a6a, ei: 1.2 }) : G.mat('col', { c: 0x050a0c, r: 0.05, m: 0.6, e: 0x0a2a2a, ei: 0.5 });
    inst(new THREE.PlaneGeometry(CS, CS), bot, pits, (i, p) => { p.set(((i % W) + 0.5) * CS, -PD, (((i / W) | 0) + 0.5) * CS); q.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)); sc.set(1, 1, 1); });
    const rockM = G.mat('col', { c: th === 'forge' ? 0x2a1a14 : 0x5a5650, r: 0.95, t: 'rock' }), rg = M.rockGeo(1, 1, 0.4, r);
    inst(rg, rockM, edges.filter(() => r() < 0.7), (e, p) => { ep(e, p, 0.22); p.y = -1.2 - r() * (PD - 2); p.x += (r() - 0.5) * CS * (e[2] ? 0 : 0.8); p.z += (r() - 0.5) * CS * (e[3] ? 0 : 0.8); q.setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3)); const k = 0.4 + r() * 0.7; sc.set(k, k * 1.4, k); });
    const col = th === 'forge' ? 0xff5a20 : th === 'warrens' ? 0x30e0b0 : th === 'abyss' ? 0x9a40ff : 0x4a9aa0;
    let cx = 0, cz = 0; pits.forEach(i => { cx += (i % W) + 0.5; cz += ((i / W) | 0) + 0.5; }); cx = cx / pits.length * CS; cz = cz / pits.length * CS;
    this.lights.push({ pos: new G.V3(cx, -PD + 1.5, cz), color: col, intensity: th === 'forge' ? 6 : 3.5, dist: PD + 8, seed: 3, flicker: th === 'forge' });
    this.chasm = { cx, cz, col, pits };
    if (deep.size) inst(new THREE.BoxGeometry(CS, PD, CS), wallMat, [...deep].map(j => [j % W, (j / W) | 0]), (c, p) => { p.set((c[0] + 0.5) * CS, -PD / 2 - 0.3, (c[1] + 0.5) * CS); q.identity(); sc.set(1, 1, 1); });
  },
  /* tunnels: a low rough bore with fallen rubble where the wall was broken through at each end */
  TH: 2.9,
  buildTunnels(L, th, H, wallMat, inst, q, sc, r) {
    const T = L.tunnels || []; if (!T.length) return; const CS = this.CS, TH = this.TH, W = this.W, cells = [];
    T.forEach(t => t.cells.forEach(i => cells.push([i % W, (i / W) | 0, t.dx, t.dz])));
    inst(new THREE.BoxGeometry(CS, 1, CS), wallMat, cells, (c, p) => { p.set((c[0] + 0.5) * CS, (H + TH) / 2, (c[1] + 0.5) * CS); q.identity(); sc.set(1, H - TH, 1); });
    const rockM = G.mat('col', { c: th === 'forge' ? 0x3a2a24 : th === 'warrens' ? 0x6a5a48 : 0x6a6660, r: 0.95, t: 'rock' }), rg = M.rockGeo(1, 1, 0.45, r), rocks = [];
    cells.forEach(([x, z, dx, dz]) => { for (let k = 0; k < 9; k++) { const along = (r() - 0.5) * CS, side = r() < 0.5 ? -1 : 1, up = k < 3; rocks.push([(x + 0.5) * CS + (dx ? along : side * CS * 0.46), up ? TH - 0.1 : r() * TH, (z + 0.5) * CS + (dz ? along : side * CS * 0.46), up ? 0.6 + r() * 0.5 : 0.35 + r() * 0.5]); } });
    // jagged frame round each broken opening, and rubble spilling out of it
    T.forEach(t => [[t.cells[0], -1], [t.cells[t.cells.length - 1], 1]].forEach(([i, s]) => {
      const x = i % W, z = (i / W) | 0, ox = (x + 0.5 + t.dx * 0.5 * s) * CS, oz = (z + 0.5 + t.dz * 0.5 * s) * CS;
      for (let k = 0; k < 12; k++) { const side = k < 3 ? -1 : k < 6 ? 1 : 0, lat = side ? side * CS * (0.47 - r() * 0.05) : (r() - 0.5) * CS * 0.9, y = side ? 0.3 + r() * (TH - 0.3) : TH + (r() - 0.2) * 0.35;
        rocks.push([ox + (t.dz ? lat : 0) + t.dx * s * 0.12, y, oz + (t.dx ? lat : 0) + t.dz * s * 0.12, 0.3 + r() * 0.3]); }
      const end = s > 0 ? t.b : t.a, ex = ((end % W) + 0.5) * CS, ez = (((end / W) | 0) + 0.5) * CS;
      { const sd = r() < 0.5 ? -1 : 1, rb = M.amb.rubble(th, r); rb.scale.setScalar(0.7); this.place(rb, ox + t.dx * s * 0.9 + sd * 1.35 * (t.dz ? 1 : 0), 0, oz + t.dz * s * 0.9 + sd * 1.35 * (t.dx ? 1 : 0), r() * 6); }   // fallen stone heaped to one side of the hole
      void ex; void ez;
    }));
    inst(rg, rockM, rocks, (k, p) => { p.set(k[0], k[1], k[2]); q.setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3)); sc.set(k[3], k[3] * (0.7 + r() * 0.6), k[3]); });
  },
  /* ------------------ spooky dressing per room ------------------ */
  ambience(o, i, th, H, r) {
    const CS = this.CS, x0 = o.x * CS, z0 = o.y * CS, w = o.w * CS, d = o.h * CS, cx = o.cx * CS, cz = o.cy * CS, boss = o.type === 'boss';
    const clearC = o.type === 'event' || o.type === 'chamber' || o.type === 'npc' || o.type === 'start' || o.type === 'puzzle';
    const rp = (m = 1.6) => { let p; for (let k = 0; k < 14; k++) { p = [x0 + m + r() * (w - 2 * m), z0 + m + r() * (d - 2 * m)]; if (this.isWall(p[0], p[1]) || this.isWall(p[0] + 0.8, p[1]) || this.isWall(p[0] - 0.8, p[1]) || this.isWall(p[0], p[1] + 0.8) || this.isWall(p[0], p[1] - 0.8)) continue; if (!clearC || Math.hypot(p[0] - cx, p[1] - cz) > 5) break; } return p; };
    const myFaces = (this.faces || []).filter(f => this.roomId[f[1] * this.W + f[0]] === o.id);
    const onWall = (obj, f, y = 0, off = 0.02) => this.place(obj, (f[0] + 0.5 + f[2] * 0.5) * CS - f[2] * off, y, (f[1] + 0.5 + f[3] * 0.5) * CS - f[3] * off, Math.atan2(-f[2], -f[3]));
    const used = new Set(), pickFace = () => { for (let k = 0; k < 12; k++) { const f = G.pick(myFaces, r); if (!f) return null; const key = f.join(','); if (used.has(key)) continue; used.add(key); return f; } return null; };
    // chandeliers: hang from the ceiling over most rooms
    if (boss) { const n = 3; for (let k = 0; k < n; k++) { const ch = M.amb.chandelier(th, 2.6, true); ch.userData.dynamic = true; this.hang(ch, cx + (k - 1) * w * 0.28, H - 2.6, cz); this.animated.push({ swing: ch, amp: 0.025, sp: 0.5 + k * 0.13 }); } }
    else if (o.w >= 4 && o.h >= 4 && o.type !== 'chamber' && r() < 0.8) { const drop = 1.3 + r() * 0.8; this.hang(M.amb.chandelier(th, drop), cx + (r() - 0.5) * 2, H - drop, cz + (r() - 0.5) * 2); if (o.w * o.h >= 48) this.hang(M.amb.chandelier(th, drop), cx + (o.w > o.h ? w * 0.28 : 0), H - drop, cz + (o.w > o.h ? 0 : d * 0.28)); }
    else if (o.type === 'chamber') { const drop = 1.8; this.hang(M.amb.chandelier(th, drop, true), cx, H - drop, cz - 2); }
    if (o.type === 'start' && o.type !== 'boss') return;
    const big = o.w * o.h >= 30;
    if (th === 'crypt') {
      for (let k = 0; k < (boss ? 6 : big ? 2 : 1); k++) { const f = pickFace(); if (f && r() < (boss ? 1 : 0.55)) onWall(M.amb.ossuary(r), f); }
      for (let k = 0; k < (boss ? 4 : 1); k++) { const f = pickFace(); if (f && r() < (boss ? 0.9 : 0.5)) onWall(M.amb.shackled(th), f); }
      for (let k = 0; k < (big ? 2 : 1); k++) if (r() < 0.7) { const f = pickFace(); if (f) onWall(M.amb.wallCandles(r), f); }
      for (let k = 0; k < (big ? 2 : 1); k++) if (!clearC && r() < 0.65) { const p = rp(); this.place(M.amb.skullPile(r), p[0], 0, p[1], r() * 6, 0.5); }
      if (!clearC && r() < 0.35 && o.w >= 5) { const p = rp(2); this.place(M.amb.graves(r), p[0], 0, p[1], r() * 6, 0.9); }
      if (!clearC && r() < 0.25 && o.w >= 5 && o.h >= 5) { const p = rp(2.4); this.place(M.amb.ritual(th, r), p[0], 0, p[1], r() * 6); }
      if (!clearC && r() < 0.3) { const p = rp(); this.place(M.amb.rubble(th, r), p[0], 0, p[1], r() * 6, 0.6); }
      if (r() < (boss ? 1 : 0.35)) for (let k = 0; k < (boss ? 3 : 1); k++) { const p = rp(1.4), len = 0.8 + r() * 1.0, cg = M.amb.hangCage(len); cg.userData.dynamic = true; this.hang(cg, p[0], H, p[1], r() * 6); this.animated.push({ swing: cg.userData.swing, amp: 0.06, sp: 0.7 + r() * 0.4 }); }
    } else if (th === 'warrens') {
      for (let k = 0; k < (boss ? 8 : 2 + Math.floor(r() * 3)); k++) { const p = rp(1.2), len = 0.6 + r() * 1.4, c = M.amb.cocoon(len); c.userData.dynamic = true; this.hang(c, p[0], H, p[1], r() * 6); this.animated.push({ swing: c, amp: 0.05, sp: 0.5 + r() * 0.5 }); }
      if (!clearC && r() < 0.6) { const p = rp(); this.place(M.amb.eggs(r), p[0], 0, p[1], r() * 6, 0.6); }
      if (!clearC && r() < 0.4) { const p = rp(); this.place(M.amb.totem(), p[0], 0, p[1], r() * 6, 0.2); }
      for (let k = 0; k < (big ? 2 : 1); k++) if (r() < 0.6) { const f = pickFace(); if (f) onWall(M.amb.lanternPost(), f, 0, 0.5); }
      if (!clearC && r() < 0.35) { const p = rp(); this.place(M.amb.impaled(r), p[0], 0, p[1], r() * 6, 0.4); }
      if (!clearC && r() < 0.4) { const p = rp(); this.place(M.amb.skullPile(r), p[0], 0, p[1], r() * 6, 0.5); }
      if (boss) for (let k = 0; k < 4; k++) { const f = pickFace(); if (f) onWall(M.amb.totem(), f, 0, 0.8); }
    } else if (th === 'forge') {
      if (r() < (boss ? 1 : 0.4)) for (let k = 0; k < (boss ? 3 : 1); k++) { const f = pickFace(); if (f) onWall(M.amb.idol(th), f, 0, 0.9); }
      if (!clearC && r() < 0.5) { const p = rp(); this.place(M.amb.skullBrazier(), p[0], 0, p[1], 0, 0.45); }
      for (let k = 0; k < (boss ? 4 : 1 + Math.floor(r() * 2)); k++) if (!clearC && r() < 0.6) { const p = rp(); this.place(M.amb.impaled(r), p[0], 0, p[1], r() * 6, 0.4); }
      for (let k = 0; k < (boss ? 10 : 3 + Math.floor(r() * 3)); k++) { const p = rp(0.8); this.place(M.amb.lavaCrack(1.5 + r() * 2.5), p[0], 0, p[1], r() * 6); }
      if (r() < 0.3) { const f = pickFace(); if (f) onWall(M.amb.shackled(th), f); }
      if (r() < (boss ? 1 : 0.3)) for (let k = 0; k < (boss ? 3 : 1); k++) { const p = rp(1.4), len = 1 + r() * 1.4, cg = M.amb.hangCage(len); cg.userData.dynamic = true; this.hang(cg, p[0], H, p[1], r() * 6); this.animated.push({ swing: cg.userData.swing, amp: 0.05, sp: 0.6 + r() * 0.4 }); }
    }
    else if (th === 'abyss') {
      for (let k = 0; k < (big ? 2 : 1); k++) if (!clearC && r() < 0.5) { const p = rp(); this.place(M.abyss.statue(r), p[0], 0, p[1], r() * 6, 0.7); }
      for (let k = 0; k < (boss ? 4 : 1); k++) { const f = pickFace(); if (f && r() < (boss ? 1 : 0.45)) onWall(M.amb.shackled('crypt'), f); }
      if (!clearC && r() < 0.35) { const p = rp(2.4); this.place(M.amb.ritual('abyss', r), p[0], 0, p[1], r() * 6); }
      if (!clearC && r() < 0.3) { const p = rp(); this.place(M.amb.rubble('crypt', r), p[0], 0, p[1], r() * 6, 0.6); }
    }
    if (boss) { // the arena: a ring of braziers and a ritual circle under the lord
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, rr = Math.min(w, d) * 0.36; this.place(th === 'warrens' ? M.amb.totem() : th === 'abyss' ? M.abyss.obelisk(r) :  M.amb.skullBrazier(), cx + Math.cos(a) * rr, 0, cz + Math.sin(a) * rr, 0, 0.45); }
      this.place(M.amb.ritual(th, r), cx, 0, cz, 0); this.bannerWalls(o, r, th === 'forge' ? 0x3a0808 : th === 'warrens' ? 0x1a3a2a : th === 'abyss' ? 0x2a0a3a : 0x5a1a1a, H);
    }
  },
  bannerWalls(o, r, color, H) {
    const CS = this.CS; if (r() < 0.4 && o.type !== 'boss') return;
    H = H || G.DUNGEONS[this.theme].wallH;
    this.faces.forEach(f => { if (this.roomId[f[1] * this.W + f[0]] !== o.id) return; if (r() > 0.18) return;
      const b = M.prop.banner(color); this.hang(b, (f[0] + 0.5 + f[2] * 0.5) * CS - f[2] * 0.25, H - 0.7, (f[1] + 0.5 + f[3] * 0.5) * CS - f[3] * 0.25, Math.atan2(-f[2], -f[3])); });
  },
  spawnExitPortal(final, x, z, quiet) {
    if (this.exitPortal) return;
    const b = x !== undefined ? { x, z: z + 2 } : this.bossSpawn; if (!b) return;
    const p = M.prop.portal(final ? 0xffc040 : 0x7a4aff); p.userData.dynamic = true;
    this.place(p, b.x, 0, b.z - 2, 0); this.animated.push({ portal: p }); this.exitPortal = { x: b.x, z: b.z - 0.6, final, mesh: p };
    if (!quiet) { G.fx.burst(new G.V3(b.x, 1.5, b.z - 2), final ? 0xffc040 : 0x9a6aff, 60, 8); G.sfx('portalwhoosh', 1, new G.V3(b.x, 0, b.z - 2)); }
  },

  /* ------------------ secrets, gates, traps, set-pieces ------------------ */
  buildFeatures(L, th, H, wallMat) {
    const CS = this.CS;
    this.gates = (L.gates || []).map(g => {
      const m = M.prop.gate(g.type, th, H, wallMat); m.userData.dynamic = true;
      const n0 = this.lights.length; this.place(m, (g.cx + 0.5) * CS, 0, (g.cy + 0.5) * CS, Math.atan2(g.dir[0], g.dir[1]));
      return Object.assign({}, g, { mesh: m, open: false, openT: 0, noticed: false, rolled: {}, tried: {}, light: this.lights.length > n0 ? this.lights[this.lights.length - 1] : null });
    });
    this.traps = (L.traps || []).map(t => { const m = M.prop.plate(t.kind, th); m.userData.dynamic = true; this.place(m, t.x, 0, t.z, 0); return Object.assign({}, t, { mesh: m, armed: true, found: false, rolled: {}, tried: {} }); });
    this.pedestals = (L.pedestals || []).map(p => { const m = M.prop.pedestal(p.kind, p.relic); m.userData.dynamic = true; this.place(m, p.x, 0, p.z, 0, 0.45); this.animated.push({ spin: m.userData.float, axis: 'y', sp: 0.8 }); this.animated.push({ bob: m.userData.float, y: 1.55 }); return Object.assign({}, p, { mesh: m, taken: false }); });
    this.events = (L.events || []).map(ev => {
      const E = G.EVENTS[ev.ev], m = M.ev[E.model](); m.userData.dynamic = true;
      this.place(m, ev.x, 0, ev.z, Math.atan2(this.spawnPoint.x - ev.x, this.spawnPoint.z - ev.z), E.solid || 1.0);
      return Object.assign({}, ev, { mesh: m, used: {}, def: E });
    });
    this.shrines = (L.shrines || []).map((sh, i) => { const m = M.amb.reviveShrine(); m.userData.dynamic = true; const n0 = this.lights.length; this.place(m, sh.x, 0, sh.z, Math.atan2(this.spawnPoint.x - sh.x, this.spawnPoint.z - sh.z), 1.1); return Object.assign({}, sh, { id: i, mesh: m, used: false, light: this.lights.length > n0 ? this.lights[this.lights.length - 1] : null }); });
    G.Puzzles.build(L, th); G.Quests.build(L, th);
    this.bossDoor = null;
    if (L.bossDoor) { const b = L.bossDoor, m = M.prop.bossDoor(th, H, this.arenaH || H * 2.1); m.userData.dynamic = true; this.place(m, (b.cx + 0.5) * CS, 0, (b.cy + 0.5) * CS, Math.atan2(b.dir[0], b.dir[1]));
      this.bossDoor = Object.assign({}, b, { mesh: m, open: 0, target: 0, entered: false, sealed: false }); }
    this.shop = null; this.rest = null;
    if (L.shop) { const st = M.prop.stall(); st.userData.dynamic = true; this.place(st, L.shop.x, 0, L.shop.z - 1.2, 0, 1.2); const R = M.npc.dwarf(); if (R.kind === 'hum') M.batchRig(R); R.root.position.set(L.shop.x, 0, L.shop.z); this.group.add(R.root); R.root.userData.dynamic = true; this.addSolid(L.shop.x, L.shop.z, 0.6);
      this.npcs.push({ def: { name: 'Grimble the Peddler', role: 'Merchant of the Deep', model: 'dwarf' }, R, x: L.shop.x, z: L.shop.z, used: {}, st: { t: 0, move: 0, atk: -1 }, shop: true });
      this.shop = Object.assign({}, L.shop, { bought: {} }); }
    if (L.rest) { const f = M.prop.campfire(); this.place(f, L.rest.x, 0, L.rest.z, 0, 0.6); for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + 0.5, b = M.prop.bed(); b.scale.set(0.8, 0.5, 0.8); this.place(b, L.rest.x + Math.sin(a) * 3.2, 0, L.rest.z + Math.cos(a) * 3.2, a); }
      this.lights.push({ pos: new G.V3(L.rest.x, 1.2, L.rest.z), color: 0xff9040, intensity: 3, dist: 12, seed: 2, flicker: true }); this.rest = Object.assign({}, L.rest, { used: {} }); }
  },
  // the arena door: target 1 swings it open into the arena, 0 shuts it; the grid follows so nothing can slip through
  shrineUsed(sh, mine) {
    const u = sh.mesh.userData; u.halo.visible = false; u.core.visible = false; u.ring.material.opacity = 0.08; if (sh.light) sh.light.intensity = 0.3;
    const c = new G.V3(sh.x, 2, sh.z); G.fx.holy(c, 70, 2); G.fx.beam(new G.V3(sh.x, 0, sh.z), 0xffe08a, 14, 1.4, 1.2); G.Lights.flash(c, 0xffd070, 6, 14, 1); G.sfx('holy', 1, c);
  },
  setBossDoor(open, quiet) {
    const d = this.bossDoor; if (!d) return; d.target = open ? 1 : 0; this.grid[d.i] = open ? 2 : 0;
    const c = new G.V3((d.cx + 0.5) * this.CS, 1.8, (d.cy + 0.5) * this.CS);
    if (!quiet) { G.sfx(open ? 'bigdoor' : 'creak', 1, c); }
  },
  updateBossDoor(dt) {
    const d = this.bossDoor; if (!d) return; const prev = d.open;
    d.open = d.target > d.open ? Math.min(d.target, d.open + dt / 1.6) : Math.max(d.target, d.open - dt / (d.fast ? 0.55 : 1.2));
    if (prev === d.open) return;
    const k = d.target ? G.smooth(d.open) : d.open * d.open;
    d.mesh.userData.leaves.forEach(h => h.rotation.y = -h.userData.s * k * 1.7);
    const c = new G.V3((d.cx + 0.5) * this.CS, 0.3, (d.cy + 0.5) * this.CS);
    if (Math.random() < 0.25) G.fx.smoke(c, 1, 0x7a7060, 1.2, 0.4);
    if (prev > 0 && d.open === 0) { G.sfx('doorslam', 1, c); G.fx.shake(0.7); G.fx.smoke(c, 22, 0x8a8070, 3, 1.2); G.fx.mist(c, 0xa09888, 20, 2.5, 3); G.Lights.flash(new G.V3(c.x, 2, c.z), 0xffa060, 4, 10, 0.4); }
  },
  gateById(id) { return (this.gates || []).find(g => g.id === id); },
  // open a gate for everyone; `mine` means this client caused it
  openGate(id, mine, sk) {
    const g = this.gateById(id); if (!g || g.open) return; g.open = true; g.openT = 0.001;
    if (g.type === 'vault' && !sk) G.run.keys = Math.max(0, (G.run.keys || 0) - 1);
    this.grid[g.i] = 2; const c = new G.V3((g.cx + 0.5) * this.CS, 1.6, (g.cy + 0.5) * this.CS);
    if (g.light) g.light.intensity = 0;
    if (g.type === 'secret') {
      const ud = g.mesh.userData; ud.block.visible = false; ud.cracks.visible = false; ud.glow.visible = false;
      g.cells.forEach(i => this.hiddenSet.delete(i));
      const rock = G.mat('col', { c: 0x8a8680, r: 0.9, t: 'rock' });
      for (let i = 0; i < 22; i++) { const m = new THREE.Mesh(M.rockGeo(0.12 + Math.random() * 0.22, 0, 0.3), rock); m.position.set(c.x + (Math.random() - 0.5) * 3, 0.5 + Math.random() * 3, c.z + (Math.random() - 0.5) * 3); G.scene.add(m); G.fx.bodies.push({ o: m, v: new G.V3((Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 5), av: new G.V3(Math.random() * 8, Math.random() * 8, Math.random() * 8), life: 12, r: 0.12, fade: true }); }
      G.fx.smoke(c, 18, 0x8a8070, 2.6, 1); G.fx.mist(c, 0xa09888, 16, 2, 3); G.sfx('boom', 0.8, c); G.sfx('stonehit', 1, c); G.fx.shake(0.35);
      if (mine && G.player) G.sheet.gainXp(G.player, 40, 'secret');
    } else if (g.type === 'locked') { G.sfx('chest', 0.7, c); G.sfx('dooropen', 1, c); }
    else if (g.type === 'vault') { G.sfx('boom', 0.6, c); G.sfx('stonegrind', 1, c); G.sfx('portalwhoosh', 0.5, c); G.fx.burst(c, 0xffc040, 40, 4); G.fx.shake(0.3); }
    else if (g.type === 'rune') { G.sfx('magic', 1, c); G.fx.burst(c, 0xa070ff, 50, 5); G.Lights.flash(c, 0xa070ff, 6, 10, 0.8); }
    if (mine) G.net.sendFx({ k: 'gate', i: g.id, sk: sk ? 1 : 0 });
  },
  updateGates(dt, t) {
    (this.gates || []).forEach(g => {
      const ud = g.mesh.userData;
      if (!g.open) {
        if (g.type === 'secret' && g.noticed) ud.glow.material.opacity = 0.35 + Math.sin(t * 3) * 0.2;
        if (g.type === 'rune') { ud.field.rotation.z += dt * 0.15; ud.veil.material.opacity = 0.3 + Math.sin(t * 2) * 0.08; ud.glyphs.forEach((m, i) => { m.position.y += Math.sin(t * 2 + i) * dt * 0.2; m.rotation.y += dt * 2; }); }
        return;
      }
      if (g.openT <= 0 || g.openT >= 1) return; g.openT = Math.min(1, g.openT + dt / (g.type === 'vault' ? 2.2 : 0.9)); const k = G.smooth(g.openT);
      if (g.type === 'locked') ud.hinge.rotation.y = -k * 1.75;
      if (g.type === 'vault') { ud.slab.position.y = -k * 3.6; if (Math.random() < 0.5) G.fx.smoke(new G.V3((g.cx + 0.5) * this.CS, 0.3, (g.cy + 0.5) * this.CS), 1, 0x7a7060, 1.2); }
      if (g.type === 'rune') { ud.field.material.opacity = 0.85 * (1 - k); ud.veil.material.opacity = 0.35 * (1 - k); ud.glyphs.forEach(m => { m.position.y += dt * 2; m.material = m.material; }); if (k >= 1) { ud.field.visible = ud.veil.visible = false; ud.glyphs.forEach(m => m.visible = false); } }
    });
    (this.traps || []).forEach(tr => { const m = tr.mesh.userData.mark; if (tr.found && tr.armed) m.material.opacity = 0.45 + Math.sin(t * 4) * 0.25; else if (!tr.armed) m.material.opacity *= 0.9; if (tr.spikeT !== undefined) { tr.spikeT += dt; const sp = tr.mesh.userData.spikes; if (sp) sp.position.y = tr.spikeT < 0.08 ? -0.9 + tr.spikeT / 0.08 * 0.9 : tr.spikeT < 1.8 ? 0 : Math.max(-0.9, -(tr.spikeT - 1.8) * 1.5); } });
  },
  // physical hits against cracked walls: three blows bring one down
  hitGateAt(x, z, n = 1) {
    const c = this.cellOf(x, z), g = (this.gates || []).find(q => !q.open && q.type === 'secret' && q.cx === c[0] && q.cy === c[1]);
    if (!g) return false;
    g.hp -= n; const ud = g.mesh.userData; ud.cracks.scale.setScalar(2.6 + (3 - g.hp) * 0.5); g.noticed = true;
    const p = new G.V3((g.cx + 0.5 - g.dir[0] * 0.5) * this.CS, 1.6, (g.cy + 0.5 - g.dir[1] * 0.5) * this.CS); G.fx.smoke(p, 5, 0x8a8070, 1.2, 0.4);
    for (let i = 0; i < 8; i++) G.fx.emit(G.fx.norm, p.x, p.y, p.z, (Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4, 0.8, 0.1, 0.05, [0.5, 0.48, 0.45, 1], [0.4, 0.38, 0.35, 0], 14, 0.6);
    if (g.hp <= 0) this.openGate(g.id, true);
    return true;
  },
  hitGatesNear(x, z, rad) { (this.gates || []).forEach(g => { if (g.open || g.type !== 'secret') return; const gx = (g.cx + 0.5) * this.CS, gz = (g.cy + 0.5) * this.CS; if (G.dist2(gx, gz, x, z) < (rad + 2.2) ** 2) this.hitGateAt(gx, gz, 1); }); },

  /* ------------------ hideout ------------------ */
  buildHideout() {
    this.clear(); this.theme = 'hideout';
    // main hall is 11 x 9 cells; the sparring arena adds 8 cells to the east, through an arch in the east wall
    // the tavern wing (rows 9..14 under the main hall) is reached through a door in the south wall
    // the Grand Arcade fills the east side (x 11..23, rows 1..15), entered through a skull gate in the main hall's east wall
    const Wm = 11, Wd = 25, Ht = 9, AX = 11, TZ = 9, TH = 6, AZ1 = 15, HT = 17; this.W = Wd; this.H = HT; this.grid = new Uint8Array(Wd * HT);
    for (let z = 1; z < Ht - 1; z++) for (let x = 1; x < Wm - 1; x++) this.grid[z * Wd + x] = 1;
    for (let z = 1; z <= AZ1; z++) for (let x = AX; x < Wd - 1; x++) this.grid[z * Wd + x] = 1;
    this.grid[3 * Wd + (Wm - 1)] = 1; this.grid[4 * Wd + (Wm - 1)] = 1;   // the gate
    for (let z = TZ; z < TZ + TH; z++) for (let x = 1; x < Wm - 1; x++) this.grid[z * Wd + x] = 1;
    this.grid[(Ht - 1) * Wd + 2] = 1;   // the tavern door
    this.roomId = new Int16Array(Wd * HT).fill(0); this.explored = new Uint8Array(Wd * HT).fill(1); this.rooms = [{ x: 1, y: 1, w: Wm - 2, h: Ht - 2, cx: Wm / 2, cy: Ht / 2, type: 'hideout' }, { x: AX, y: 1, w: Wd - 1 - AX, h: Ht - 2, cx: (AX + Wd - 1) / 2, cy: Ht / 2, type: 'arena' }];
    const CS = this.CS, Hh = 9, grp = this.group;
    const wt = G.tex.get('hideoutWall'), ft = G.tex.get('wood');
    const floorMat = new THREE.MeshStandardMaterial({ map: ft.map, normalMap: ft.normalMap, roughness: 0.7, color: 0xc8a888 });
    const wallMat = new THREE.MeshStandardMaterial({ map: wt.map, normalMap: wt.normalMap, roughness: 0.9 });
    const fl = new THREE.Mesh(new THREE.PlaneGeometry((Wm - 1) * CS, (Ht - 2) * CS), floorMat); fl.rotation.x = -Math.PI / 2; fl.position.set((Wm - 1) * CS / 2 + CS / 2, 0, Ht * CS / 2);
    floorMat.map = floorMat.map.clone(); floorMat.map.repeat.set(Wm - 1, Ht - 2); floorMat.map.needsUpdate = true; floorMat.normalMap = floorMat.normalMap.clone(); floorMat.normalMap.repeat.set(Wm - 1, Ht - 2); floorMat.normalMap.needsUpdate = true; grp.add(fl);
    // rug
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), G.mat('col', { c: 0x7a1a1a, t: 'cloth' })); rug.rotation.x = -Math.PI / 2; rug.position.set(Wm * CS / 2, 0.035, Ht * CS / 2 + 2); grp.add(rug);
    const rugB = new THREE.Mesh(new THREE.PlaneGeometry(10.6, 6.6), G.mat('col', { c: 0xc8a040, t: 'cloth' })); rugB.rotation.x = -Math.PI / 2; rugB.position.set(Wm * CS / 2, 0.012, Ht * CS / 2 + 2); grp.add(rugB);
    for (let z = 0; z < Ht; z++) for (let x = 0; x < AX; x++) if (!this.grid[z * Wd + x]) { const m = new THREE.Mesh(M.box(CS, Hh, CS), wallMat); m.position.set((x + 0.5) * CS, Hh / 2, (z + 0.5) * CS); grp.add(m); }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(AX * CS, Ht * CS), G.mat('col', { c: 0x3a2a1a, t: 'wood' })); ceil.rotation.x = Math.PI / 2; ceil.position.set(AX * CS / 2, Hh, Ht * CS / 2); grp.add(ceil);
    for (let k = 1; k < Wm - 1; k += 2) { const b = new THREE.Mesh(M.box(0.4, 0.5, (Ht - 2) * CS), G.mat('wood')); b.position.set(k * CS + CS / 2, Hh - 0.25, Ht * CS / 2); grp.add(b); }
    for (let k = 1; k < Ht - 1; k += 2) { const b = new THREE.Mesh(M.box((Wm - 2) * CS, 0.35, 0.35), G.mat('wood')); b.position.set(Wm * CS / 2, Hh - 0.6, k * CS + CS / 2); grp.add(b); }
    // torches along walls
    for (let x = 1; x < Wm - 1; x += 2) { this.place(M.prop.torch('crypt'), (x + 0.5) * CS, 2.6, CS + 0.02, 0); this.place(M.prop.torch('crypt'), (x + 0.5) * CS, 2.6, (Ht - 1) * CS - 0.02, Math.PI); }
    const S = (id, label, x, z, obj, ry, rad, desc) => { if (obj) this.place(obj, x, 0, z, ry, rad); this.interact.push({ id, label, x, z, r: 2.6, desc }); };
    const mx = Wm * CS / 2;
    // portal on north wall
    const portal = M.prop.portal(0x7a4aff); this.place(portal, mx, 0, CS + 1.0, 0); this.animated.push({ portal });
    this.interact.push({ id: 'portal', label: 'Dungeon Portal', x: mx, z: CS + 3.2, r: 3.2, desc: 'Choose a dungeon and descend' });
    // blacksmith (east)
    const forgeG = new THREE.Group(); const anv = M.prop.anvil(); anv.position.set(0, 0, 0.8); forgeG.add(anv); const br = M.prop.brazier(); br.position.set(1.4, 0, -0.8); forgeG.add(br); const rack = M.prop.weaponRack(); rack.position.set(-1.2, 0, -1.4); forgeG.add(rack);
    const smith = M.npc.dwarf(); smith.root.position.set(0.6, 0, -0.2); smith.root.rotation.y = -Math.PI / 2; forgeG.add(smith.root); this.hideNPCs = [smith];
    S('smith', 'Blacksmith', (Wm - 2) * CS - 1, CS * 2.6, forgeG, -Math.PI / 2, 1.4, 'Weapons & upgrades');
    // tailor (east-south)
    const tail = new THREE.Group(); const man = M.prop.mannequin(); tail.add(man); const tb = M.prop.table(); tb.position.set(1.4, 0, 0); tb.rotation.y = Math.PI / 2; tail.add(tb);
    S('tailor', 'Packmaker', (Wm - 2) * CS, CS * 5.5, tail, Math.PI / 2, 1.0, 'Larger backpacks');
    // armorer
    const arm = new THREE.Group(); const kn = M.hero('knight', 1); kn.root.traverse(o => { if (o.isMesh && o.material && o.material.map === undefined) { } }); M.animHum(kn, { t: 0, move: 0, atk: -1 }); arm.add(kn.root); const stand = M.P(arm, M.cyl(0.3, 0.35, 0.1, 16), G.mat('wood'), [0, 0.05, 0]); kn.root.position.y = 0.1;
    S('armor', 'Armorer', (Wm - 2) * CS + 0.5, CS * 7.2, arm, -Math.PI / 2, 0.8, 'Reinforce your armor');
    // library (west)
    const lib = new THREE.Group(); for (let k = 0; k < 3; k++) { const bs = M.prop.bookshelf(); bs.position.set(-1.2, 0, -2 + k * 1.7); bs.rotation.y = Math.PI / 2; lib.add(bs); }
    const lect = M.G(lib, [0.5, 0, 0]); M.P(lect, M.cyl(0.08, 0.12, 1.1, 10), G.mat('wood'), [0, 0.55, 0]); M.P(lect, M.box(0.6, 0.05, 0.45), G.mat('wood'), [0, 1.15, 0], [-0.4, 0, 0]); M.P(lect, M.box(0.5, 0.04, 0.35), G.mat('col', { c: 0xf2e8cc }), [0, 1.19, 0.01], [-0.4, 0, 0]);
    const orb = M.P(lib, M.ico(0.15, 2), G.mat('emissive', { c: 0x8a6aff, i: 3 }), [0.5, 1.7, 0]); this.animated.push({ bob: orb, y: 1.7 });
    lib.userData.light = { pos: new G.V3(0.5, 1.8, 0), color: 0x8a6aff, intensity: 2, dist: 8 };
    S('library', 'Arcane Library', CS * 1.4, CS * 3, lib, 0, 1.2, 'Learn new abilities');
    // shrine of fortune (west-south)
    const shrine = M.npc.shrine(); this.hideNPCs.push(shrine);
    S('luck', 'Shrine of Fortune', CS * 1.7, CS * 6.2, shrine.root, Math.PI / 2, 0.7, 'Bless your dice');
    if (shrine.light) this.lights.push({ pos: new G.V3(CS * 1.7, 2, CS * 6.2), color: shrine.light.color, intensity: 2, dist: 8, seed: 1, flicker: true });
    // alchemist
    const alc = new THREE.Group(); const at = M.prop.table(); alc.add(at); for (let k = 0; k < 6; k++) { const p = M.loot.potion(k); p.position.set(-0.7 + k * 0.28, 0.85, (k % 2) * 0.2 - 0.1); alc.add(p); }
    const cauldron = M.P(alc, M.lathe([0, 0, 0.4, 0.05, 0.55, 0.3, 0.5, 0.6, 0.45, 0.62], 24), G.mat('dark'), [0, 0, 1.2]); M.P(alc, M.cyl(0.46, 0.46, 0.02, 24), G.mat('emissive', { c: 0x40ff60, i: 1.6 }), [0, 0.55, 1.2]);
    alc.userData.light = { pos: new G.V3(0, 1.0, 1.2), color: 0x40ff60, intensity: 1.6, dist: 6 };
    S('alchemist', 'Alchemist', CS * 4.2, CS * 7.3, alc, Math.PI, 1.2, 'More healing flasks');
    // merchant
    const st = M.prop.stall(); const mer = M.npc.oracle(); mer.root.position.set(0, 0, -0.9); st.add(mer.root); this.hideNPCs.push(mer);
    S('merchant', 'Merchant', CS * 7.2, CS * 7.4, st, Math.PI, 1.4, 'Sell your loot');
    // class shrine (choose class)
    const cs = new THREE.Group(); M.P(cs, M.cyl(1.2, 1.4, 0.3, 32), G.mat('col', { c: 0x8a8070, t: 'rock' }), [0, 0.15, 0]);
    const rr = M.P(cs, M.cyl(1.0, 1.0, 0.02, 32), new THREE.MeshBasicMaterial({ map: G.tex.sprite('rune'), color: 0xffd080, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), [0, 0.32, 0]); this.animated.push({ spin: rr, sp: 0.3, axis: 'y' });
    S('class', 'Hall of Heroes', CS * 1.5, CS * 1.6, cs, 0, 0.9, 'Change your hero');
    // fireplace & table area
    this.place(M.prop.fireplace(), mx, 0, (Ht - 1) * CS - 0.4, Math.PI, 'auto');
    const t1 = M.prop.table(); this.place(t1, mx, 0, Ht * CS / 2 + 3, 0, 1.0);
    [[-1.4, 0], [1.4, 0]].forEach(([dx]) => { const b = M.prop.barrel(); this.place(b, mx + dx * 3, 0, Ht * CS / 2 + 5.5, 0, 0.4); });
    this.place(M.prop.bed(), CS * 8.4, 0, CS * 1.45, 0, 1.0);
    this.place(M.prop.banner(0x1d3f8a), mx - 6, Hh - 0.6, CS + 0.25, 0); this.place(M.prop.banner(0x1d3f8a), mx + 6, Hh - 0.6, CS + 0.25, 0);
    this.place(M.prop.chandelier(), mx, Hh - 2.4, Ht * CS / 2);
    if (this.buildTavern) this.buildTavern({ Wm, Wd, Ht, TZ, TH, HT, Hh, wallMat });
    this.buildArcade({ Wm, Wd, Ht, AX, AZ1, HT, Hh, wallMat });
    this.spawnPoint = new G.V3(mx, 0, Ht * CS / 2 + 1);
    this.chests = []; this.npcs = []; this.lava = null; this.exitPortal = null;
    portal.userData.dynamic = true; rr.userData.keep = true; orb.userData.keep = true; this.hideNPCs.forEach(R => { R.root.userData.dynamic = true; if (R.armL && !R._batched) { R._batched = true; M.batchRig(R); } });   // each NPC's parts merged per joint: a fraction of the draw calls (and shadow passes)
    this.batchStatic();
  },

  // the sparring ring: sand floor, a roped ring, weapon racks, braziers, training dummies
  buildArena(cx, cz, R, Hh) {
    const grp = this.group;
    const st = G.tex.get('cryptFloor'), sand = new THREE.MeshStandardMaterial({ map: st.map.clone(), normalMap: st.normalMap.clone(), color: 0xd8b880, roughness: 1 });
    sand.map.repeat.set(5, 5); sand.normalMap.repeat.set(5, 5); sand.map.needsUpdate = sand.normalMap.needsUpdate = true;
    const fl = new THREE.Mesh(new THREE.CircleGeometry(R + 0.8, 48), sand); fl.rotation.x = -Math.PI / 2; fl.position.set(cx, 0.008, cz); grp.add(fl);
    // ring of rope on posts, open toward the west
    const post = G.mat('wood'), rope = G.mat('col', { c: 0xb09060, r: 1, t: 'cloth' });
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; if (Math.abs(G.angDiff(a, Math.PI)) < 0.3) continue; const px = cx + Math.cos(a) * R, pz = cz + Math.sin(a) * R; M.P(grp, M.cyl(0.08, 0.1, 1.3, 8), post, [px, 0.65, pz]); M.P(grp, M.sph(0.1, 8, 6), G.mat('bronze'), [px, 1.32, pz]);
      const b = (i + 1) / 16 * Math.PI * 2; if (Math.abs(G.angDiff(b, Math.PI)) < 0.3) continue; const qx = cx + Math.cos(b) * R, qz = cz + Math.sin(b) * R; for (const y of [0.7, 1.15]) M.P(grp, M.tube([px, y, pz, (px + qx) / 2, y - 0.08, (pz + qz) / 2, qx, y, qz], 0.02, 8, 4), rope); }
    const em = new THREE.Mesh(new THREE.CircleGeometry(3.2, 48), new THREE.MeshBasicMaterial({ map: G.tex.sprite('rune'), color: 0xc04030, transparent: true, opacity: 0.55, depthWrite: false })); em.rotation.x = -Math.PI / 2; em.position.set(cx, 0.02, cz); grp.add(em);
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => { const x = cx + sx * (R + 1.4) * 0.72, z = cz + sz * (R + 1.4) * 0.72; this.place(M.prop.brazier(), x, 0, z, 0, 0.5); this.lights.push({ pos: new G.V3(x, 1.6, z), color: 0xff8030, intensity: 2.2, dist: 11, seed: x + z, flicker: true }); });
    this.interact.push({ id: 'arenaSign', label: 'Sparring Ring', x: cx - R - 0.6, z: cz, r: 2.4, desc: 'Friendly fire is on inside the ring' });
    this.arena = { cx, cz, r: R, x0: cx - R, x1: cx + R, z0: cz - R, z1: cz + R, spawns: [[cx - R * 0.7, cz - R * 0.7], [cx + R * 0.7, cz - R * 0.7], [cx - R * 0.7, cz + R * 0.7], [cx + R * 0.7, cz + R * 0.7]] };
    G.pvp.buildDummies([[cx + R - 1.7, cz - 2.6], [cx + R - 1.3, cz], [cx + R - 1.7, cz + 2.6]]);   // inside the ring, along its east rope
  },
  buildArcade(o) { },   // filled in by arcade.js (and the games that live there)

  /* ------------------ menu diorama ------------------ */
  buildMenu() {
    this.clear(); this.theme = 'menu'; this.W = this.H = 0; this.grid = new Uint8Array(1);
    const grp = this.group, ft = G.tex.get('cryptFloor');
    const fm = new THREE.MeshStandardMaterial({ map: ft.map.clone(), normalMap: ft.normalMap.clone(), roughness: 0.8 }); fm.map.repeat.set(6, 6); fm.normalMap.repeat.set(6, 6); fm.map.needsUpdate = fm.normalMap.needsUpdate = true;
    const fl = new THREE.Mesh(new THREE.CircleGeometry(24, 64), fm); fl.rotation.x = -Math.PI / 2; grp.add(fl);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; this.place(M.prop.pillar('crypt', 7), Math.cos(a) * 11, 0, Math.sin(a) * 11); if (i % 2 === 0) { const t = M.prop.torch('crypt'); t.rotation.y = -a - Math.PI / 2; this.place(t, Math.cos(a) * 10.6, 2.6, Math.sin(a) * 10.6, -a - Math.PI / 2); } }
    this.place(M.prop.campfire(), 0, 0, 0);
    this.menuHeroes = {};
    G.CLASSES.forEach((c, i) => {
      const a = Math.PI * 0.12 + (i / 5) * Math.PI * 0.76; const R = M.hero(c, G.save.cls[c].wpn, G.save.cls[c].arm | 0);
      R.root.position.set(Math.cos(a) * 3.6, 0, Math.sin(a) * 3.6); R.root.lookAt(0, 0, 0); grp.add(R.root);
      this.menuHeroes[c] = { R, a, st: { t: Math.random() * 10, move: 0, atk: -1 } };
    });
    for (let i = 0; i < 8; i++) { const p = M.prop.bones(); this.place(p, (Math.random() - 0.5) * 16, 0, -6 - Math.random() * 4, Math.random() * 6); }
    this.place(M.prop.sarcophagus(), -6, 0, -6, 0.6, 'auto'); this.place(M.prop.sarcophagus(), 6, 0, -6, -0.6, 'auto');
    this.place(M.prop.statue('crypt'), 0, 0, -8.5, 0, 'auto');
    this.place(M.prop.chandelier(), 0, 5.5, 0);
    for (let i = 0; i < 6; i++) this.place(M.prop.candles(6), (Math.random() - 0.5) * 14, 0, -4 - Math.random() * 5);
    this.spawnPoint = new G.V3(0, 0, 8);
    Object.values(this.menuHeroes).forEach(h => { h.R.root.userData.dynamic = true; M.batchRig(h.R); });
    this.batchStatic();
  }
};

/* ------------------ light pool ------------------ */
// lights carried by monsters, spells and staffs are 'virtual': they never enter the scene as real lights (adding or
// removing a real light makes every material recompile, which is what made fights hitch). Each frame they borrow
// a light from the fixed pool, nearest first, like the torches do.
G.VLight = class extends THREE.Object3D {
  constructor(color = 0xffffff, intensity = 1, distance = 8, decay = 2) { super(); this.isVLight = true; this.color = new THREE.Color(color); this.intensity = intensity; this.distance = distance; this.decay = decay; this._e = { pos: new THREE.Vector3(), color: 0xffffff, intensity: 0, dist: 8, seed: Math.random() * 9, flicker: false, vl: this }; G.Lights.virt.add(this); }
};
G.mkLight = (c, i, d, dec) => new G.VLight(c, i, d, dec);
G.Lights = {
  pool: [], playerLight: null, virt: new Set(),
  liveVirtual() { const out = [], t = G.now(); for (const v of this.virt) { let o = v, inScene = false, vis = true; while (o) { if (o === G.scene) { inScene = true; break; } if (o.visible === false) vis = false; o = o.parent; } if (!inScene) { if (!v._gone) v._gone = t; else if (t - v._gone > 12) this.virt.delete(v); continue; } v._gone = 0; if (!vis || v.intensity <= 0.02) continue; const e = v._e; v.getWorldPosition(e.pos); e.color = v.color.getHex(); e.intensity = v.intensity; e.dist = v.distance; out.push(e); } return out; },
  init() {
    this.pool.forEach(l => G.scene.remove(l)); this.pool = [];
    const n = { low: 5, med: 10, high: 20, ultra: 24 }[G.settings.quality] || 10;
    for (let i = 0; i < n; i++) { const l = new THREE.PointLight(0xffffff, 0, 10, 2); G.scene.add(l); this.pool.push(l); }
    if (!this.playerLight) { this.playerLight = new THREE.PointLight(0xffb070, 1.0, 14, 1.8); }
    G.scene.add(this.playerLight);
    // projectiles carry their own moving light (fireballs, frost arrows, souls) instead of random flickers
    (this.projPool || []).forEach(l => G.scene.remove(l)); this.projPool = []; for (let i = 0; i < (G.settings.quality === 'low' ? 2 : 8); i++) { const l = new THREE.PointLight(0xffffff, 0, 7, 2); G.scene.add(l); this.projPool.push(l); }
    (this.fxPool || []).forEach(s => G.scene.remove(s.l)); this.fxPool = []; for (let i = 0; i < (G.settings.quality === 'low' ? 4 : 10); i++) { const l = new THREE.PointLight(0xffffff, 0, 8, 2); G.scene.add(l); this.fxPool.push({ l, t: 0, dur: 1, i: 0 }); }
    this.timer = 0; this.shadowSetup();
  },
  // real-time shadows: the nearest torches/chandeliers, the newest spell flashes and the closest glowing
  // projectiles cast point-light (cube) shadows. The set of shadow casters is fixed per level so shaders never
  // recompile mid-fight; casters that are switched off simply skip their shadow pass.
  SHADOW: { off: [0, 0, 0, 0], standard: [4, 1, 1, 512], ultra: [8, 2, 2, 1024] },
  shadowSetup() {
    const R = G.renderer; if (!R) return;
    if (!R.shadowMap._npcHook) { const sm = R.shadowMap, r0 = sm.render.bind(sm); sm._npcHook = true;
      // two passes when it pays: the near casters render with everyone, the far ones without the hideout townsfolk
      sm.render = (lights, scene, cam) => {
        const L = G.Lights, npc = L.npcCasters || [], far = npc.length ? L.pool.filter((l, i) => i >= 3 && l.castShadow && l.shadow.needsUpdate) : [];
        if (!far.length) return r0(lights, scene, cam);
        far.forEach(l => { l.shadow.needsUpdate = false; }); r0(lights, scene, cam);
        const held = []; lights.forEach(l => { if (l.castShadow && l.shadow && !far.includes(l)) { held.push([l, l.shadow.autoUpdate, l.shadow.needsUpdate]); l.shadow.autoUpdate = false; l.shadow.needsUpdate = false; } });
        far.forEach(l => { l.shadow.needsUpdate = true; }); npc.forEach(m => { m.castShadow = false; });
        try { r0(lights, scene, cam); } finally { npc.forEach(m => { m.castShadow = true; }); held.forEach(([l, a, n]) => { l.shadow.autoUpdate = a; l.shadow.needsUpdate = n; }); }
      };
    }
    const lv = G.settings.quality === 'low' ? 'off' : (G.settings.shadows || 'ultra'), S = this.SHADOW[lv] || this.SHADOW.ultra;
    R.shadowMap.enabled = S[0] > 0; R.shadowMap.type = THREE.PCFSoftShadowMap;
    const set = (l, on, size) => { l.castShadow = on; if (!on) return; l.shadow.mapSize.set(size, size); l.shadow.bias = -0.0018; l.shadow.normalBias = 0.035; l.shadow.radius = 2; l.shadow.camera.near = 0.22; if (l.shadow.map) { l.shadow.map.dispose(); l.shadow.map = null; } };
    this.pool.forEach((l, i) => set(l, i < S[0], S[3])); (this.projPool || []).forEach((l, i) => set(l, i < S[1], S[3] / 2)); (this.fxPool || []).forEach((s, i) => set(s.l, i < S[2], S[3] / 2));
    this.shadowsOn = S[0] > 0; this.tagT = 0;
  },
  // flag meshes as shadow casters / receivers as they appear (glows, decals, particles and the viewmodel never cast)
  tagShadows() {
    const add = THREE.AdditiveBlending, npcRoots = new Set((G.World.hideNPCs || []).map(R => R.root)); this.npcCasters = G.World.theme === 'hideout' ? (this.npcCasters || []).filter(m => m.parent && m.castShadow) : [];
    const inNpc = o => { let p = o; while (p) { if (npcRoots.has(p)) return true; p = p.parent; } return false; };
    G.scene.traverse(o => {
      if (o === G.camera) return; if (o.userData.shT) return;
      if (o.isMesh || o.isInstancedMesh) {
        let par = o.parent, cam = false; while (par) { if (par === G.camera) { cam = true; break; } par = par.parent; }
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        const glow = !m || m.blending === add || (m.transparent && (m.opacity < 0.9 || m.depthWrite === false)) || m.isMeshBasicMaterial || m.isShaderMaterial || m.isPointsMaterial;
        let tiny = false; if (o.geometry && !o.isInstancedMesh) { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); const bs = o.geometry.boundingSphere; o.getWorldScale(G.tmpV2 || (G.tmpV2 = new THREE.Vector3())); tiny = bs && bs.radius * Math.max(G.tmpV2.x, G.tmpV2.y, G.tmpV2.z) < 0.03; }   // eyes, teeth, rivets: no visible shadow, but every one cost a draw in each of six cube faces per light
        o.castShadow = !cam && !glow && !tiny && !o.userData.noShadow; o.receiveShadow = !cam && !(m && (m.isMeshBasicMaterial || m.blending === add)); o.userData.shT = 1;
        // hideout townsfolk only throw shadows from the three nearest lights (see the shadow-map hook below)
        if (o.castShadow && npcRoots.size && inNpc(o)) this.npcCasters.push(o);
      }
    });
  },
  flash(pos, color, intensity = 4, dist = 9, dur = 0.4) {
    let s = this.fxPool.reduce((a, b) => (a.t <= 0 ? a : b.t < a.t ? b : a), this.fxPool[0]);
    s.l.position.copy(pos); W.lift(s.l.position); s.l.color.setHex(color); s.l.distance = dist; s.t = s.dur = dur; s.i = intensity;
  },
  update(dt, cam, t) {
    this.timer -= dt;
    const L = G.World.lights;
    if (this.timer <= 0) {
      this.timer = 0.15;
      const cp = cam.position, fwd = G.tmpV.set(0, 0, -1).applyQuaternion(cam.quaternion);
      this.sorted = L.concat(this.liveVirtual()).map(l => { const dx = l.pos.x - cp.x, dz = l.pos.z - cp.z, d = Math.hypot(dx, dz); const facing = (dx * fwd.x + dz * fwd.z) / (d + 0.01); return { l, s: d - facing * 6 }; }).sort((a, b) => a.s - b.s).slice(0, this.pool.length).map(o => o.l);
    }
    const S = this.sorted || [];
    this.pool.forEach((pl, i) => { const l = S[i]; if (!l) { pl.intensity = 0; return; } if (l.vl) { const v = l.vl; v.getWorldPosition(l.pos); l.color = v.color.getHex(); l.intensity = v.intensity; l.dist = v.distance; } pl.position.copy(l.pos); pl.color.setHex(l.color); pl.distance = l.dist;
      const tgt = l.intensity * (l.flicker ? 0.85 + Math.sin(t * 11 + l.seed) * 0.07 + Math.sin(t * 27 + l.seed * 3) * 0.05 : 1);
      pl.intensity = pl.userData.src === l ? tgt : pl.intensity * 0.6 + tgt * 0.4; pl.userData.src = l; });
    this.fxPool.forEach(s => { if (s.t > 0) { s.t -= dt; s.l.intensity = s.i * Math.max(0, s.t / s.dur); } else s.l.intensity = 0; });
    if (this.shadowsOn) { this.tagT -= dt; if (this.tagT <= 0) { this.tagT = 1.0; this.tagShadows(); }
      // lights that are dark this frame skip their (six-sided) shadow render
      // the three nearest casters redraw their shadows every frame, the farther ones every other frame (half the passes, no visible change)
      this.fN = (this.fN || 0) + 1; this.pool.forEach((l, i) => { if (!l.castShadow) return; l.shadow.autoUpdate = false; if (l.intensity > 0.03 && (i < 3 || (this.fN + i) % 2 === 0)) l.shadow.needsUpdate = true; }); this.fxPool.forEach(s => { if (s.l.castShadow) s.l.shadow.autoUpdate = s.l.intensity > 0.05; }); }
    // brightest/nearest glowing projectiles get the moving lights; intensity eases so lights never pop
    const cp = cam.position, pl = (G.proj && G.proj.list || []).filter(p => p.m.userData.col).sort((a, b) => a.m.position.distanceToSquared(cp) - b.m.position.distanceToSquared(cp));
    if (this.shadowsOn) this.projPool.forEach(l => { if (l.castShadow) l.shadow.autoUpdate = l.intensity > 0.05; });
    this.projPool.forEach((l, i) => { const p = pl[i]; if (p) { if (l.userData.src !== p) { l.userData.src = p; l.intensity = 0; } l.position.copy(p.m.position); l.color.setHex(p.m.userData.col); l.intensity = G.damp(l.intensity, 2.2 + Math.sin(t * 31 + i) * 0.25, 18, dt); } else { l.intensity = G.damp(l.intensity, 0, 14, dt); } });
  }
};

/* ------------------ atmosphere particles ------------------ */
G.Atmos = {
  pts: null,
  init(theme) {
    if (this.pts) { G.scene.remove(this.pts); this.pts.geometry.dispose(); }
    const n = G.settings.quality === 'low' ? 500 : 1400, pos = new Float32Array(n * 3), vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 40; pos[i * 3 + 1] = Math.random() * 7; pos[i * 3 + 2] = (Math.random() - 0.5) * 40; vel[i * 3] = (Math.random() - 0.5) * 0.2; vel[i * 3 + 1] = theme === 'forge' ? 0.4 + Math.random() * 0.8 : (Math.random() - 0.5) * 0.1; vel[i * 3 + 2] = (Math.random() - 0.5) * 0.2; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const col = { crypt: 0xa8c0d0, warrens: 0x80ffd0, forge: 0xff8030, hideout: 0xffd0a0, menu: 0xffc890, abyss: 0xb080ff }[theme] || 0xffffff;
    const m = new THREE.PointsMaterial({ size: theme === 'forge' ? 0.09 : 0.06, map: G.tex.sprite('spark'), color: col, transparent: true, opacity: theme === 'forge' ? 0.9 : 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    this.pts = new THREE.Points(g, m); this.vel = vel; this.theme = theme; this.pts.frustumCulled = false; G.scene.add(this.pts);
  },
  update(dt, cp, t) {
    if (!this.pts) return; const p = this.pts.geometry.attributes.position.array, v = this.vel, n = p.length / 3;
    for (let i = 0; i < n; i++) {
      p[i * 3] += (v[i * 3] + Math.sin(t * 0.5 + i) * 0.05) * dt; p[i * 3 + 1] += v[i * 3 + 1] * dt; p[i * 3 + 2] += v[i * 3 + 2] * dt;
      if (p[i * 3] - cp.x > 20) p[i * 3] -= 40; if (p[i * 3] - cp.x < -20) p[i * 3] += 40;
      if (p[i * 3 + 2] - cp.z > 20) p[i * 3 + 2] -= 40; if (p[i * 3 + 2] - cp.z < -20) p[i * 3 + 2] += 40;
      if (p[i * 3 + 1] > 7) p[i * 3 + 1] = 0; if (p[i * 3 + 1] < 0) p[i * 3 + 1] = 7;
    }
    this.pts.geometry.attributes.position.needsUpdate = true;
  }
};
