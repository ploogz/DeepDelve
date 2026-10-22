/* ============================================================
   Seeing the table properly
   - V: table view. The camera rises over the table (your side at the bottom of the screen), cards and dice
     grow a little so their faces read clearly, and the mouse moves a pointer instead of your head.
     Only what's public shows: other players' hole cards stay face down, other players' dice stay under their cups.
   - right mouse (hold): peek at your hand. Your own cards lift up in front of your eyes (Hold'em, Blackjack);
     in Liar's Dice it lifts your cup.
   - H: the rules and controls for the game you're playing, in a panel on the left. Open or closed is remembered per game.
   Also works away from the seated tables: V for an overhead of the Bone Table, the rat track, or your bowling lane.
   ============================================================ */
'use strict';
(() => {
  const F = G.fp, TB = G.tables, GM = TB.GAMES, T = G.tavern, A = G.arcade, UI = G.ui;
  const me = () => G.net.myId();
  const V3 = (x, y, z) => new G.V3(x, y, z);
  F.tv = { on: false, k: 0 }; F.cursor = { x: 0, y: -0.15 }; F.peekK = 0; F.cardScale = 1;
  // how high the table view sits over each table (metres above the cloth) and how far it leans back toward you
  const TV = { blackjack: [1.5, 0.35], poker: [1.75, 0.3], liars: [1.45, 0.3], knuckle: [1.0, 0.18], dice: [1.35, 0.28], chess: [0.82, 0.12], tarot: [0.85, 0.2] };

  /* ================= the pointer used in table view ================= */
  const css = document.createElement('style');
  css.textContent = `#fpCursor{position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;border:2px solid #ffe08a;border-radius:50%;box-shadow:0 0 6px #000,inset 0 0 4px #000;pointer-events:none;z-index:6}#fpCursor::after{content:'';position:absolute;left:8px;top:8px;width:2px;height:2px;background:#ffe08a;border-radius:1px}
#fpHelp{position:absolute;left:14px;top:84px;width:300px;max-height:calc(100vh - 210px);overflow:auto;background:linear-gradient(180deg,rgba(26,16,10,.9),rgba(12,8,6,.92));border:1px solid #7a5a30;border-radius:6px;padding:10px 12px 12px;color:#e8d8b0;font-size:12.5px;line-height:1.45;pointer-events:none;box-shadow:0 6px 24px rgba(0,0,0,.6)}
#fpHelp h3{margin:0 0 2px;font-family:var(--head);color:#f3d998;font-size:16px;letter-spacing:.03em}#fpHelp .hx{float:right;font-size:11px;opacity:.75}#fpHelp .hx kbd,#fpHelpTab kbd,#fpHelp table kbd{display:inline-block;min-width:16px;padding:0 5px;border:1px solid #c8a050;border-bottom-width:2px;border-radius:3px;background:#2a1a0c;color:#ffe08a;font:600 11px/15px var(--body);text-align:center}
#fpHelp h4{margin:10px 0 4px;font-family:var(--head);color:#d9b46a;font-size:12px;letter-spacing:.08em;text-transform:uppercase}#fpHelp p{margin:0}#fpHelp table{border-collapse:collapse;width:100%}#fpHelp td{padding:2px 0;vertical-align:top}#fpHelp td:first-child{white-space:nowrap;padding-right:8px;width:1%}
#fpHelpTab{position:absolute;left:14px;top:96px;background:rgba(14,10,8,.82);border:1px solid #7a5a30;border-radius:5px;padding:5px 10px;color:#e8d8b0;font-size:12px;pointer-events:none}`;
  document.head.appendChild(css);
  const cursorEl = () => { let el = document.getElementById('fpCursor'); if (!el) { el = document.createElement('div'); el.id = 'fpCursor'; document.getElementById('hud').appendChild(el); } return el; };

  /* ================= rules and controls ================= */
  const COMMON = [['V', 'table view (pointer instead of looking around)'], ['H', 'hide or show this panel'], ['hold X', 'get up and leave the table']];
  const HELP = {
    blackjack: { c: [['W/S, wheel', 'change your bet'], ['Space', 'place your bet'], ['D', 'deal now (table host)'], ['1', 'hit'], ['2', 'stand'], ['3', 'double down'], ['hold RMB', 'peek at your hand up close'], ...COMMON] },
    poker: { c: [['1', 'fold'], ['2', 'check or call'], ['3', 'bet or raise to the amount shown'], ['W/S, wheel', 'change the raise'], ['4', 'all in'], ['B', 'buy back in when you are out'], ['hold RMB', 'peek at your two cards'], ...COMMON], x: 'Hands, best to worst: straight flush, four of a kind, full house, flush, straight, three of a kind, two pair, pair, high card.' },
    liars: { c: [['hold RMB', 'lift your cup and look at your dice'], ['W/S, wheel', 'how many dice you bid'], ['2–6', 'which face you bid'], ['Space', 'make the bid'], ['L', 'call "Liar!" on the last bid'], ...COMMON], x: 'A bid must raise the count, or keep the count and raise the face. Ones are wild.' },
    knuckle: { c: [['hold LMB', 'shake the die in your fist'], ['release', 'throw it into the tray'], ['LMB on a column', 'drop the die into that column'], ...COMMON], x: 'Column score: each die × how many of that number the column holds. Two 4s = 16, three 4s = 36.' },
    dice: { c: [['hold LMB', 'shake (on your first throw, or after choosing)'], ['release', 'throw the dice'], ['LMB on a die', 'set it aside or put it back'], ['Q', 'pick the best scoring dice for you'], ['B', 'bank this turn\'s points'], ...COMMON], x: 'Scoring: 1 = 100, 5 = 50, three of a kind = 100 × face (three 1s = 1000), each extra die doubles it; 1–6 run = 1500; three pairs = 1000.' },
    chess: { c: [['LMB', 'pick up a piece, then click its square'], ['1–4', 'promote to Queen, Tower, Necromancer, Steed'], ['D', 'offer, accept or withdraw a draw'], ['G, G', 'resign'], ...COMMON] },
    pool: { c: [['E', 'step up to the table on your shot'], ['mouse', 'aim the cue'], ['hold LMB', 'draw back for power, release to strike'], ['Space', 'top view while aiming'], ['RMB', 'step back from the table'], ['V', 'overhead view while you wait'], ['H', 'hide or show this panel']] },
    bowl: { c: [['E', 'step up to your lane on your turn'], ['mouse', 'aim'], ['A/D', 'slide your starting spot'], ['hold LMB', 'power; move the mouse while holding to hook'], ['RMB', 'step back'], ['V', 'look down at the pins while you wait'], ['H', 'hide or show this panel']] },
    knives: { c: [['LMB', 'throw a dart'], ['hold RMB', 'steady your arm (until your breath runs out)'], ['H', 'hide or show this panel']], x: 'Your arm drifts in a slow figure of eight. Time the throw as the circle passes the bull. Darts drop a hair, aim just above.' },
    brawl: { c: [['LMB', 'punch'], ['WASD', 'move'], ['H', 'hide or show this panel']] },
    rats: { c: [['1–6', 'bet your stake on that rat'], ['wheel', 'change the stake'], ['G', 'start the race (table host)'], ['V', 'overhead of the track'], ['H', 'hide or show this panel']] },
    tarot: { name: "Madame Morta's Tarot", rules: 'Three cards for your next descent. Upright cards bless, reversed cards curse. The reading holds until you next go down into the dark; asking again replaces it.', c: [['Space', 'cross her palm (25 g, or 35 g to ask again)'], ['V', 'look down at the cards'], ['hold X', 'get up']] }
  };
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  F.helpOpen = (g) => { const v = store('dd_help_' + g); return v === null || v === undefined ? true : v === '1'; };
  F.context = () => {
    if (G.World.theme !== 'hideout' || !G.player) return null;
    if (F.seated) return F.seated.L.game;
    if (T.knives && T.knives.active) return 'knives';
    if (G.bowl && (G.bowl.aim || G.bowl.lanes.some(L => L.table && L.table.st && L.table.st.pl && L.table.st.pl.some(p => p.id === me())))) return 'bowl';
    const mine = g => { const t = TB.mineFor(g); return t && t.phase === 'play' ? t : null; };
    if (mine('pool')) return 'pool';
    if (mine('brawl')) return 'brawl';
    if (F.ratHud) return 'rats';
    return null;
  };
  F.renderHelp = (g) => {
    let el = document.getElementById('fpHelp'), tab = document.getElementById('fpHelpTab'); const hud = document.getElementById('hud');
    if (!g || G.ui.modalOpen()) { if (el) el.hidden = true; if (tab) tab.hidden = true; return; }
    if (!el) { el = document.createElement('div'); el.id = 'fpHelp'; hud.appendChild(el); tab = document.createElement('div'); tab.id = 'fpHelpTab'; hud.appendChild(tab); }
    const open = F.helpOpen(g), H = HELP[g] || { c: [] }, gm = GM[g] || {};
    if (!open) { el.hidden = true; tab.hidden = false; tab.innerHTML = `<kbd>H</kbd> ${(H.name || gm.name || 'Game')}: rules &amp; controls`; return; }
    tab.hidden = true; el.hidden = false;
    const key = g + (F.tv.on ? 1 : 0); if (el._k === key) return; el._k = key;
    el.innerHTML = `<span class="hx"><kbd>H</kbd> close</span><h3>${H.name || gm.name || ''}</h3><h4>Rules</h4><p>${H.rules || gm.rules || ''}</p>${H.x ? `<p style="margin-top:6px;opacity:.85">${H.x}</p>` : ''}<h4>Controls</h4><table>${H.c.map(([k, d]) => `<tr><td><kbd>${k}</kbd></td><td>${d}</td></tr>`).join('')}</table>`;
  };

  /* ================= seated: V, H, the pointer ================= */
  const in0 = F.input;
  F.input = (dt) => {
    const S = F.seated; if (!S) return in0(dt);
    F.peekWant = G.mouse.r;
    if (!G.ui.modalOpen()) {
      if (F.key('KeyV')) { F.tv.on = !F.tv.on; F.cursor.x = 0; F.cursor.y = -0.15; G.sfx('click', 0.3); }
      if (F.key('KeyH')) { const g = S.L.game; store('dd_help_' + g, F.helpOpen(g) ? '0' : '1'); G.sfx('click', 0.3); }
    }
    if (F.tv.on) { const s = 0.0016 * G.settings.sens; F.cursor.x = G.clamp(F.cursor.x + G.mouse.dx * s * (innerHeight / innerWidth), -0.97, 0.97); F.cursor.y = G.clamp(F.cursor.y - G.mouse.dy * s, -0.95, 0.95); G.mouse.dx = G.mouse.dy = 0; }
    in0(dt);
  };
  // the key bar always mentions the view and the rules
  const hud0 = F.hud;
  F.hud = (o) => { if (o) { const g = F.context(); if (F.seated) o.keys = (o.keys || []).concat([['V', F.tv.on ? 'back to your seat' : 'table view'], ['H', 'rules']]); else if (g === 'rats') o.keys = (o.keys || []).concat([['V', F.free ? 'back' : 'overhead'], ['H', 'rules']]); } return hud0(o); };
  // the pointer replaces the crosshair for picking while the table view is up
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  F.pick = () => {
    if (!F.picks.length) { F.setHover(null); return null; }
    if (F.tv.on && F.tv.k > 0.6) ndc.set(F.cursor.x, F.cursor.y); else ndc.set(0, 0);
    ray.setFromCamera(ndc, G.camera); ray.far = 6;
    const objs = F.picks.map(p => p.obj).filter(o => o.visible !== false), hit = ray.intersectObjects(objs, true)[0];
    if (!hit) { F.setHover(null); return null; }
    let o = hit.object; while (o && !F.picks.some(p => p.obj === o)) o = o.parent; const P = F.picks.find(p => p.obj === o) || null; F.setHover(P, hit.point); return P;
  };

  /* ================= away from the seats: overhead views, rules for pool, bowling, darts, the pit, the rats ================= */
  F.free = null;   // { kind } while an overhead is up
  const pre0 = F.preInput;
  F.preInput = (dt) => {
    if (pre0) pre0(dt);
    const g = F.context(); if (!g || G.ui.modalOpen()) { F.free = null; return; }
    if (F.key('KeyH')) { store('dd_help_' + g, F.helpOpen(g) ? '0' : '1'); G.sfx('click', 0.3); }
    const canView = (g === 'pool' && !(G.pool && G.pool.aim)) || g === 'rats' || (g === 'bowl' && !(G.bowl && G.bowl.aim));
    if (canView && F.key('KeyV')) { F.free = F.free ? null : { kind: g }; G.sfx('click', 0.3); }
    if (F.free && (!canView || G.keys.KeyW || G.keys.KeyA || G.keys.KeyS || G.keys.KeyD || G.pressed.KeyE)) F.free = null;
    if (F.free) { G.mouse.dx = G.mouse.dy = 0; }
  };
  const freePose = (kind) => {
    if (kind === 'pool' && G.pool && G.pool.tableAt) { const c = G.pool.tableAt; return { pos: V3(c.x, 3.3, c.z + 0.6), at: V3(c.x, 0.8, c.z), up: V3(0, 0, -1) }; }
    if (kind === 'rats' && A.trackAt) { const c = A.trackAt; return { pos: V3(c.x + 7, 6.2, c.z + 2.2), at: V3(c.x + 7, 0.7, c.z), up: V3(0, 0, -1) }; }
    if (kind === 'bowl' && G.bowl) { const L = G.bowl.lanes.find(l => l.table && l.table.st && l.table.st.pl && l.table.st.pl.some(p => p.id === me())) || G.bowl.lanes[0]; if (L) return { pos: V3(L.FX + 16.6, 2.2, L.z), at: V3(L.FX + 18.7, 0.2, L.z), up: V3(1, 0, 0) }; }
    return null;
  };

  /* ================= the camera ================= */
  const mx = new THREE.Matrix4(), qa = new THREE.Quaternion();
  F.tvPose = () => {
    const S = F.seated; if (!S) return null; const L = S.L, st = L.seats[S.slot], [h, back] = TV[L.game] || [1.4, 0.3];
    const dx = L.cx - st.x, dz = L.cz - st.z, l = Math.hypot(dx, dz) || 1, d = V3(dx / l, 0, dz / l), ty = L.ty || 0.83;
    let cx = L.cx, cz = L.cz; if (L.game === 'chess') { const B = G.chess.boards[L.board]; if (B) { cx = B.x; cz = B.z; } } if (L.game === 'tarot') { cx = L.cx; cz = L.cz + 0.15; }
    return { pos: V3(cx - d.x * back * h, ty + h, cz - d.z * back * h), at: V3(cx - d.x * 0.18 * h, ty, cz - d.z * 0.18 * h), up: d };
  };
  const mk0 = G.makePlayer;
  G.makePlayer = function (cls) {
    const P = mk0(cls), cam0 = P.updateCam;
    P.updateCam = (dt, t) => {
      cam0(dt, t);
      const want = (F.seated && F.tv.on) || !!F.free; F.tv.k = G.clamp(F.tv.k + (want ? 1 : -1) * dt * 3.2, 0, 1);
      if (!F.seated) F.tv.on = false;
      const pose = F.seated ? F.tvPose() : F.free ? freePose(F.free.kind) : (F.lastPose || null); if (pose) F.lastPose = pose;
      if (F.tv.k > 0.001 && pose) { const cam = G.camera, e = F.tv.k * F.tv.k * (3 - 2 * F.tv.k); mx.lookAt(pose.pos, pose.at, pose.up); qa.setFromRotationMatrix(mx); cam.position.lerp(pose.pos, e); cam.quaternion.slerp(qa, e); }
      // cards and dice read better from above: they grow a little in the table view
      F.cardScale = 1 + 0.45 * (F.seated ? F.tv.k : 0); const ds = 1 + 0.35 * (F.seated ? F.tv.k : 0);
      F.diceSet.forEach(m => { if (!m.parent) { F.diceSet.delete(m); return; } m.scale.setScalar(ds); });
      // peek at your hand
      const peekable = F.seated && ['poker', 'blackjack'].includes(F.seated.L.game) && !G.ui.modalOpen();
      F.peekK = G.clamp(F.peekK + (peekable && F.peekWant ? 1 : -1) * dt * 5, 0, 1);
      // pointer and rules
      const el = cursorEl(); el.hidden = !(F.seated && F.tv.on && F.tv.k > 0.6); if (!el.hidden) { el.style.left = ((F.cursor.x + 1) / 2 * innerWidth) + 'px'; el.style.top = ((1 - F.cursor.y) / 2 * innerHeight) + 'px'; }
      const ch = document.getElementById('cross'); if (ch) ch.style.visibility = el.hidden ? '' : 'hidden';
      F.renderHelp(F.context());
    };
    return P;
  };
  // the table view switches off when you stand up
  const st0 = F.stand; F.stand = () => { F.tv.on = false; F.peekK = 0; return st0(); };
})();
