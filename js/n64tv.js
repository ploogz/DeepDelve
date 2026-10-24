/* ============================================================
   Skull-64: a big old television in the Grand Arcade that plays Nintendo 64 games from ROM files you own
   - press E at the couch and pick a ROM from your own computer. It never leaves your machine: the emulator
     (EmulatorJS + mupen64plus, in emu/) runs in a hidden frame in your browser, and only the picture,
     the sound and the controller presses travel between players
   - four controllers. Take one at the couch: on this computer the keyboard and your first gamepad drive your slot,
     and extra gamepads plugged into the TV owner's computer join the free slots when you press START on them.
     Party members on their own computers take a controller from their couch too; the owner's browser streams
     them the screen and the sound over WebRTC and plays their presses into the game
   - sit on the couch to play: the TV fills the wall in front of you, V blows the picture up to full screen,
     hold X to get up. The sound fades with distance from the TV
   - the owner can reset or eject the cartridge; in-game saves are kept in the owner's browser
   ============================================================ */
'use strict';
(() => {
  const F = G.fp, UI = G.ui, A = G.arcade, TM = G.tavern.models, R = Math.random;
  const me = () => G.net.myId(), now = () => Date.now(), V = (x, y, z) => new G.V3(x, y, z);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const myName = () => (G.settings.name || 'Adventurer').slice(0, 20);
  const N = G.n64 = { st: null, own: null, sitting: false, big: false, view: null, lastSt: 0, seat: -1 };
  const SLOTC = ['#e04040', '#4080ff', '#40c060', '#f0c030'];

  /* ================= controllers ================= */
  // an input state: b = bit flags (A, B, START, D-pad, L, R, Z, C buttons), ax/ay = the stick (-1..1)
  const BIT = { A: 1, B: 2, START: 4, DU: 8, DD: 16, DL: 32, DR: 64, L: 128, R: 256, Z: 512, CU: 1024, CD: 2048, CL: 4096, CR: 8192 };
  const EJS_ID = [[BIT.A, 0], [BIT.B, 1], [BIT.START, 3], [BIT.DU, 4], [BIT.DD, 5], [BIT.DL, 6], [BIT.DR, 7], [BIT.L, 10], [BIT.R, 11], [BIT.Z, 12]];
  const EJS_C = [[BIT.CR, 20], [BIT.CL, 21], [BIT.CD, 22], [BIT.CU, 23]];
  const q = v => Math.round(G.clamp(v, -1, 1) * 32) / 32;
  const keyState = () => {
    const k = G.keys, m = G.mouse; let b = 0;
    if (k.Space || k.KeyJ) b |= BIT.A; if (k.KeyK) b |= BIT.B; if (k.Enter) b |= BIT.START; if (k.KeyQ) b |= BIT.L; if (k.KeyE || m.r) b |= BIT.R; if (k.KeyL || m.l) b |= BIT.Z;
    if (k.KeyT) b |= BIT.DU; if (k.KeyG) b |= BIT.DD; if (k.KeyF) b |= BIT.DL; if (k.KeyH) b |= BIT.DR;
    if (k.ArrowUp) b |= BIT.CU; if (k.ArrowDown) b |= BIT.CD; if (k.ArrowLeft) b |= BIT.CL; if (k.ArrowRight) b |= BIT.CR;
    const tilt = k.ShiftLeft ? 0.5 : 1; return { b, ax: ((k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0)) * tilt, ay: ((k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0)) * tilt };
  };
  const padState = (gp) => {
    if (!gp) return null; const bt = i => gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5), ax = i => gp.axes[i] || 0; let b = 0;
    if (bt(0)) b |= BIT.A; if (bt(1) || bt(2)) b |= BIT.B; if (bt(3)) b |= BIT.CL; if (bt(9)) b |= BIT.START; if (bt(4)) b |= BIT.L; if (bt(5)) b |= BIT.R; if (bt(6) || bt(7)) b |= BIT.Z;
    if (bt(12)) b |= BIT.DU; if (bt(13)) b |= BIT.DD; if (bt(14)) b |= BIT.DL; if (bt(15)) b |= BIT.DR;
    if (ax(3) < -0.5) b |= BIT.CU; if (ax(3) > 0.5) b |= BIT.CD; if (ax(2) < -0.5) b |= BIT.CL; if (ax(2) > 0.5) b |= BIT.CR;
    const dz = v => Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85; return { b, ax: dz(ax(0)), ay: -dz(ax(1)) };
  };
  const pads = () => { try { return [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(Boolean).sort((a, b) => a.index - b.index); } catch (e) { return []; } };
  const merge = (a, b) => !b ? a : { b: a.b | b.b, ax: Math.abs(b.ax) > Math.abs(a.ax) ? b.ax : a.ax, ay: Math.abs(b.ay) > Math.abs(a.ay) ? b.ay : a.ay };
  const ZERO = { b: 0, ax: 0, ay: 0 };

  /* ================= messages ================= */
  N.send = (m) => { if (G.net.party) G.net.emit('sup', Object.assign({ k: 'n64' }, m)); };
  const sup0 = G.net.onSup.bind(G.net);
  G.net.onSup = function (d, peer) { if (d && d.k === 'n64') { try { N.recv(d, peer); } catch (e) { console.warn(e); } return; } return sup0(d, peer); };
  N.recv = (d, peer) => {
    const O = N.own;
    if (d.op === 'st' && d.st) {
      if (O && d.st.owner !== me() && d.st.on) { // two cartridges at once: the earlier one keeps the TV
        if ((d.st.since || 0) < O.since || ((d.st.since || 0) === O.since && String(d.st.owner) < String(me()))) { G.ui.toast(`${d.st.ownerName} already has a game in the TV`); N.eject(true); } else return; }
      N.setSt(d.st); return;
    }
    if (!O) { if (d.op === 'call' && N.watch && d.to === N.watch.id) { /* handled by the peer */ } return; }
    if (d.op === 'join') { const S = N.st, want = d.slot | 0; if (S.slots.some(s => s && s.id === peer)) return; let i = S.slots[want] ? S.slots.findIndex(s => !s) : want; if (i < 0 || i > 3) return; S.slots[i] = { id: peer, name: String(d.name || 'Adventurer').slice(0, 20) }; N.pushSt(); G.ui.toast(`${S.slots[i].name} picks up controller ${i + 1}`); }
    else if (d.op === 'leave') { const i = N.st.slots.findIndex(s => s && s.id === peer); if (i >= 0) { N.st.slots[i] = null; O.inp[i] = ZERO; N.pushSt(); } }
    else if (d.op === 'in') { const i = d.s | 0; if (N.st.slots[i] && N.st.slots[i].id === peer) O.inp[i] = { b: d.b | 0, ax: q(+d.ax || 0), ay: q(+d.ay || 0) }; }
    else if (d.op === 'watch' && d.pid) N.callWatcher(String(d.pid));
  };
  N.setSt = (st) => { const was = N.st; N.st = st; N.lastSt = now(); if (!st.on) { N.st = null; N.dropView(); if (N.sitting) N.standUp(); } else if (!was || was.since !== st.since) N.dropView(); N.syncWatch(); N.refreshPanel(); };
  N.pushSt = () => { if (!N.own) return; N.st.ver = (N.st.ver || 0) + 1; N.send({ op: 'st', st: N.st }); N.refreshPanel(); };
  N.mySlot = () => N.st ? N.st.slots.findIndex(s => s && s.id === me()) : -1;

  /* ================= the cartridge (owner side) ================= */
  N.load = (file) => {
    if (!file) return; if (N.st && N.st.on && N.st.owner !== me()) { G.ui.toast(`${N.st.ownerName}'s game is in the TV`); return; }
    if (N.own) N.eject(true);
    const url = URL.createObjectURL(file), fr = document.createElement('iframe');
    fr.setAttribute('allow', 'autoplay; gamepad'); fr.title = 'Skull-64';
    fr.style.cssText = 'position:fixed;left:0;top:0;width:640px;height:480px;border:0;opacity:0.01;pointer-events:none;z-index:-1';
    fr.src = 'emu/tv.html?name=' + encodeURIComponent(file.name) + '&rom=' + encodeURIComponent(url);
    document.body.appendChild(fr);
    const since = now();
    N.own = { fr, url, since, E: null, inp: [ZERO, ZERO, ZERO, ZERO], sent: [{}, {}, {}, {}], calls: new Map(), peer: null, t0: since, couch: {} };
    N.st = { owner: me(), ownerName: myName(), game: file.name.replace(/\.[^.]+$/, '').slice(0, 40), slots: [{ id: me(), name: myName() }, null, null, null], tvId: null, on: true, since, ver: 0, booting: true };
    N.dropView(); N.pushSt(); G.ui.toast('The cartridge clunks in…'); G.sfx('thump', 0.6);
    N.sit(0);
  };
  N.eject = (quiet) => {
    const O = N.own; if (!O) return; N.own = null;
    try { O.calls.forEach(c => c.close()); if (O.peer) O.peer.destroy(); } catch (e) { }
    try { O.fr.remove(); } catch (e) { } URL.revokeObjectURL(O.url);
    N.dropView(); const st = N.st; N.st = null; if (st && st.owner === me()) N.send({ op: 'st', st: Object.assign({}, st, { on: false }) });
    if (N.sitting) N.standUp(); if (!quiet) { G.ui.toast('Cartridge ejected'); G.sfx('click', 0.6); } N.refreshPanel();
  };
  // once the emulator is up: its picture, its sound, and the stream for the party
  N.ownerTick = () => {
    const O = N.own; if (!O) return; const w = O.fr.contentWindow, E = w && w.EJS_emulator;
    if (!O.E) {
      if (E && E.started && E.canvas) { O.E = E; N.st.booting = false; N.pushSt(); N.startStream(); G.sfx('magic', 0.5); }
      else if (now() - O.t0 > 90000 || (E && E.textElem && /error|failed/i.test(E.textElem.innerText || ''))) { G.ui.toast(`That cartridge won't start${E && E.textElem ? ': ' + E.textElem.innerText : ''}`); N.eject(true); }
      return;
    }
    N.openPeer();
    // pause while the owner is down in the dungeon
    const away = G.World.theme !== 'hideout';
    if (away && !E.paused) E.pause(); else if (!away && E.paused && !O.userPaused) E.play();
    if (!O.audio && w.TV_AUDIO && w.TV_AUDIO.__tv) { O.audio = w.TV_AUDIO.__tv; if (O.audio.msd && O.stream) { O.audio.msd.stream.getAudioTracks().forEach(tk => O.stream.addTrack(tk)); O.calls.forEach((c, pid) => { c.close(); N.callWatcher(pid); }); } }
    if (O.audio) { const gv = N.near() * G.settings.vol; if (Math.abs(gv - (O.gv ?? -1)) > 0.005) { O.gv = gv; try { O.audio.g.gain.setTargetAtTime(gv, w.TV_AUDIO.currentTime, 0.08); } catch (e) { O.audio.g.gain.value = gv; } } if (w.TV_AUDIO.state === 'suspended' && G.audio.ctx && G.audio.ctx.state === 'running') w.TV_AUDIO.resume().catch(() => { }); }
    // the controllers: the owner's own (keyboard + first pad), extra pads on this computer, and the presses that come in over the party
    const ps = pads(), mine = N.mySlot();
    if (mine >= 0) O.inp[mine] = N.sitting ? merge(keyState(), padState(ps[0])) : ZERO;
    ps.slice(1, 4).forEach((gp, k) => { const id = 'pad:' + gp.index, st = padState(gp), slot = N.st.slots.findIndex(s => s && s.id === id);
      if (slot >= 0) O.inp[slot] = st;
      else if (st.b & BIT.START) { const free = N.st.slots.findIndex(s => !s); if (free >= 0 && !O.couch[id]) { N.st.slots[free] = { id, name: `Couch player ${free + 1}` }; O.couch[id] = 1; N.pushSt(); G.ui.toast(`Gamepad ${gp.index + 1} picks up controller ${free + 1}`); } } });
    N.st.slots.forEach((s, i) => { if (s && s.id.startsWith('pad:') && !ps.some(gp => 'pad:' + gp.index === s.id)) { N.st.slots[i] = null; delete O.couch[s.id]; O.inp[i] = ZERO; N.pushSt(); } });
    for (let i = 0; i < 4; i++) N.apply(i, N.st.slots[i] ? O.inp[i] : ZERO);
  };
  N.apply = (slot, s) => {
    const O = N.own, GMg = O.E.gameManager, last = O.sent[slot], put = (id, v) => { if (last[id] !== v) { last[id] = v; GMg.simulateInput(slot, id, v); } };
    EJS_ID.forEach(([bit, id]) => put(id, s.b & bit ? 1 : 0)); EJS_C.forEach(([bit, id]) => put(id, s.b & bit ? 0x7fff : 0));
    const M = 0x7fff; put(16, Math.round(Math.max(0, s.ax) * M)); put(17, Math.round(Math.max(0, -s.ax) * M)); put(18, Math.round(Math.max(0, -s.ay) * M)); put(19, Math.round(Math.max(0, s.ay) * M));
  };
  N.startStream = () => {
    const O = N.own, w = O.fr.contentWindow; let vs; try { vs = w.TV_OUT ? w.TV_OUT() : O.E.canvas.captureStream(30); } catch (e) { console.warn('capture', e); return; }
    O.stream = new MediaStream(vs.getVideoTracks()); N.setView(new MediaStream(vs.getVideoTracks()), true); N.openPeer();
  };
  // the line the picture goes out on (opened whenever there's a party to send it to)
  N.openPeer = () => {
    const O = N.own; if (!O || O.peer || !O.stream || !window.Peer || !G.net.party || (O.peerT && now() - O.peerT < 15000)) return; O.peerT = now();
    try { O.peer = new Peer(undefined, G.p2p && G.p2p.peerOpts ? G.p2p.peerOpts() : {}); } catch (e) { O.peer = null; return; }
    O.peer.on('open', id => { if (N.own !== O) return; N.st.tvId = id; N.pushSt(); });
    O.peer.on('error', e => { console.warn('tv peer', e && e.type); if (!O.peer.open) { try { O.peer.destroy(); } catch (x) { } O.peer = null; } });
  };
  N.callWatcher = (pid) => {
    const O = N.own; if (!O || !O.peer || !O.stream || !O.peer.open) return; const old = O.calls.get(pid); if (old) try { old.close(); } catch (e) { }
    try { const c = O.peer.call(pid, O.stream); O.calls.set(pid, c); c.on('close', () => { if (O.calls.get(pid) === c) O.calls.delete(pid); }); c.on('error', () => O.calls.delete(pid)); } catch (e) { console.warn('tv call', e); }
  };

  /* ================= watching (everyone else) ================= */
  N.syncWatch = () => {
    const S = N.st, want = S && S.on && S.owner !== me() && S.tvId && window.Peer && G.World.theme === 'hideout';
    if (!want) { if (N.watch) { try { N.watch.peer.destroy(); } catch (e) { } N.watch = null; } return; }
    if (N.watch && N.watch.tvId === S.tvId) return; if (N.watch) try { N.watch.peer.destroy(); } catch (e) { }
    let peer; try { peer = new Peer(undefined, G.p2p && G.p2p.peerOpts ? G.p2p.peerOpts() : {}); } catch (e) { return; }
    const W = N.watch = { peer, tvId: S.tvId, id: null, t: now() };
    peer.on('open', id => { W.id = id; N.send({ op: 'watch', pid: id }); });
    peer.on('call', c => { c.answer(); c.on('stream', s => { if (N.watch === W) N.setView(s, false); }); c.on('close', () => { if (N.watch === W) { N.dropView(); W.again = now() + 2000; } }); });
    peer.on('error', e => { W.err = e && e.type; });
  };

  /* ================= the picture on the wall ================= */
  N.setView = (stream, local) => {
    N.dropView(); const v = document.createElement('video'); v.playsInline = true; v.autoplay = true; v.muted = local; v.srcObject = stream; v.play().catch(() => { v.muted = true; v.play().catch(() => { }); N.view && (N.view.needUnmute = !local); });
    const tex = new THREE.VideoTexture(v); tex.encoding = THREE.sRGBEncoding; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
    N.view = { v, tex, local, stream }; N.bindScreen(); const bv = document.querySelector('#n64Big video'); if (bv) bv.srcObject = stream;
  };
  N.dropView = () => { const Vw = N.view; if (!Vw) return; N.view = null; try { Vw.v.pause(); Vw.v.srcObject = null; } catch (e) { } Vw.tex.dispose(); N.bindScreen(); const bv = document.querySelector('#n64Big video'); if (bv) bv.srcObject = null; };
  // what the screen shows when there's no picture
  N.idle = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 384; const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return { c, t, key: '' }; })();
  N.drawIdle = () => {
    const S = N.st, msg = !S ? ['Press E at the couch', 'to load a cartridge'] : S.booting ? ['Loading', S.game] : S.owner === me() ? ['Starting…', S.game] : !window.Peer ? [`${S.ownerName} is playing ${S.game}`, 'streaming needs the GitHub Pages version'] : N.watch && N.watch.err ? [`${S.ownerName} is playing ${S.game}`, 'the picture could not reach you'] : [`Tuning in to ${S.ownerName}…`, S.game];
    const key = msg.join('|') + Math.floor(now() / 500) % 2; if (key === N.idle.key) return; N.idle.key = key;
    const x = N.idle.c.getContext('2d'), g = x.createRadialGradient(256, 192, 20, 256, 192, 330); g.addColorStop(0, '#2a1440'); g.addColorStop(1, '#06030a'); x.fillStyle = g; x.fillRect(0, 0, 512, 384);
    for (let y = 0; y < 384; y += 3) { x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, y, 512, 1); }
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#c8a0ff'; x.font = 'bold 64px Georgia'; x.shadowColor = '#a060ff'; x.shadowBlur = 18; x.fillText('SKULL-64', 256, 130); x.shadowBlur = 0;
    x.font = '84px serif'; x.fillStyle = '#e8dcc0'; x.fillText('☠', 256, 214);
    x.fillStyle = '#f2e6c8'; x.font = '24px Georgia'; x.fillText(msg[0].slice(0, 38), 256, 292); x.fillStyle = '#b8a8d0'; x.font = 'italic 20px Georgia'; x.fillText((msg[1] || '').slice(0, 44), 256, 324);
    if (Math.floor(now() / 500) % 2) { x.fillStyle = '#ff5050'; x.beginPath(); x.arc(470, 30, 7, 0, 7); x.fill(); }
    N.idle.t.needsUpdate = true;
  };
  N.bindScreen = () => { const T = N.tv; if (!T) return; const map = N.view ? N.view.tex : N.idle.t; if (T.screen.material.map !== map) { T.screen.material.map = map; T.screen.material.needsUpdate = true; } };
  N.near = () => { const T = N.tv, c = G.camera; if (!T || !c || G.World.theme !== 'hideout') return 0; if (N.sitting) return 1; const d = Math.hypot(c.position.x - T.x, c.position.z - T.z); return G.clamp(1 - (d - 6) / 16, 0, 1); };

  /* ================= the set: a television, a couch, a console ================= */
  const ba0 = G.World.buildArcade;
  G.World.buildArcade = function (o) {
    ba0.call(this, o); if (!o.spots || !A.bounds) return; const W = this, grp = W.group, x0 = A.bounds.x0, tz = A.bounds.z0 + 41;
    const tx = x0 + 0.02, wood = G.mat('col', { c: 0x1e120c, t: 'wood' }), bone = G.mat('col', { c: 0xc8bba0, r: 0.85 }), velvet = G.mat('col', { c: 0x4a1030, t: 'cloth', r: 1 }), iron = G.mat('iron');
    const SW = 3.6, SH = 2.7, SY = 2.35;
    // the cabinet: a deep wooden case with a bone bezel, skulls on the corners, a grille and a dial
    M.P(grp, M.box(0.5, SH + 0.7, SW + 0.7), wood, [tx + 0.25, SY, tz]);
    [-1, 1].forEach(s => { M.P(grp, M.box(0.08, SH + 0.3, 0.12), bone, [tx + 0.53, SY, tz + s * (SW / 2 + 0.12)]); M.P(grp, M.box(0.08, 0.12, SW + 0.36), bone, [tx + 0.53, SY + s * (SH / 2 + 0.12), tz]);
      const sk = A.skull(2.0, 0xb070ff); sk.position.set(tx + 0.45, SY + SH / 2 + 0.38, tz + s * (SW / 2 + 0.2)); sk.rotation.y = Math.PI / 2; grp.add(sk); });
    { const lab = A.sign('SKULL-64', 1.6, 0.26, { glow: '#b070ff' }); lab.position.set(tx + 0.55, SY - SH / 2 - 0.2, tz); lab.rotation.y = Math.PI / 2; grp.add(lab); }
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: N.idle.t, toneMapped: false })); screen.position.set(tx + 0.505, SY, tz); screen.rotation.y = Math.PI / 2; screen.userData.dynamic = true; screen.userData.noShadow = true; grp.add(screen);
    // the console under it, four ports with a light for each controller
    const con = new THREE.Group(); M.P(con, M.box(0.6, 0.5, 1.6), wood, [0, 0.25, 0]); M.P(con, M.box(0.5, 0.16, 0.9), G.mat('col', { c: 0x2a2a30, r: 0.5 }), [0, 0.58, 0]); M.P(con, M.box(0.2, 0.04, 0.5), G.mat('col', { c: 0x3a0a4a }), [0, 0.68, 0]);
    const lights = []; for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(M.sph(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: 0x222222 })); m.position.set(0.31, 0.56, -0.33 + i * 0.22); con.add(m); lights.push(m); }
    con.position.set(tx + 0.85, 0, tz); con.userData.dynamic = true; grp.add(con); W.addSolid(tx + 0.85, tz, 0.8);
    [-1, 1].forEach(s => { const sp = new THREE.Group(); M.P(sp, M.box(0.6, 1.5, 0.6), wood, [0, 0.75, 0]); [0.45, 1.1].forEach(y => { M.P(sp, M.cyl(0.2, 0.22, 0.04, 20), G.mat('col', { c: 0x111111, r: 0.9 }), [0.31, y, 0], [0, 0, Math.PI / 2]); M.P(sp, M.cyl(0.07, 0.07, 0.05, 14), bone, [0.33, y, 0], [0, 0, Math.PI / 2]); }); W.place(sp, tx + 0.6, 0, tz + s * (SW / 2 + 0.9), 0, 0.5); });
    // the couch: bone frame, dark velvet, four cushions, and a low table with four controllers on it
    const cx = tx + 4.6, couch = new THREE.Group();
    M.P(couch, M.box(0.9, 0.42, 3.4), velvet, [0, 0.3, 0]); M.P(couch, M.box(0.25, 0.75, 3.4), velvet, [0.38, 0.75, 0]);
    [-1, 1].forEach(s => { M.P(couch, M.box(0.9, 0.62, 0.22), velvet, [0, 0.42, s * 1.8]); M.P(couch, M.cyl(0.06, 0.06, 0.95, 10), bone, [0, 0.76, s * 1.8], [0, 0, Math.PI / 2]); });
    for (let i = 0; i < 4; i++) M.P(couch, M.box(0.7, 0.12, 0.78), G.mat('col', { c: 0x5a1838, t: 'cloth', r: 1 }), [-0.05, 0.57, -1.2 + i * 0.8]);
    M.P(couch, M.cyl(0.05, 0.05, 3.5, 10), bone, [0.5, 1.13, 0], [Math.PI / 2, 0, 0]); [-1.7, 1.7].forEach(z => { const sk = A.skull(1.3); sk.position.set(0.5, 1.22, z); sk.rotation.y = -Math.PI / 2; couch.add(sk); });
    W.place(couch, cx, 0, tz, 0, 0); for (let z = -1.5; z <= 1.5; z += 0.75) W.addSolid(cx + 0.1, tz + z, 0.45);
    const tbl = new THREE.Group(); M.P(tbl, M.box(0.7, 0.05, 2.2), wood, [0, 0.42, 0]); [[-0.28, -1], [0.28, -1], [-0.28, 1], [0.28, 1]].forEach(([a, b]) => M.P(tbl, M.cyl(0.03, 0.035, 0.4, 8), bone, [a, 0.2, b]));
    const pads3 = []; for (let i = 0; i < 4; i++) { const p = new THREE.Group(); M.P(p, M.box(0.12, 0.04, 0.2), G.mat('col', { c: 0x30303a, r: 0.6 }), [0, 0, 0]); M.P(p, M.box(0.1, 0.035, 0.06), G.mat('col', { c: 0x30303a, r: 0.6 }), [0.07, -0.005, 0]); M.P(p, M.sph(0.012, 6, 5), G.mat('col', { c: 0x2050c0 }), [0, 0.025, 0.05]); M.P(p, M.sph(0.012, 6, 5), G.mat('col', { c: 0x20a040 }), [0, 0.025, -0.05]);
      const led = new THREE.Mesh(M.sph(0.008, 6, 5), new THREE.MeshBasicMaterial({ color: new THREE.Color(SLOTC[i]) })); led.position.set(-0.06, 0.02, 0); p.add(led); p.position.set(0, 0.47, -0.8 + i * 0.53); p.rotation.y = (R() - 0.5) * 0.6; p.userData.led = led; tbl.add(p); pads3.push(p); }
    tbl.userData.dynamic = true; W.place(tbl, cx - 1.25, 0, tz, 0, 0); W.addSolid(cx - 1.25, tz - 0.6, 0.4); W.addSolid(cx - 1.25, tz + 0.6, 0.4);
    { const rug = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 4.6), G.mat('col', { c: 0x2a0a20, t: 'cloth', r: 1 })); rug.rotation.x = -Math.PI / 2; rug.position.set(tx + 2.8, 0.014, tz); rug.receiveShadow = true; grp.add(rug); }
    W.lights.push({ pos: V(tx + 1.4, 2.4, tz), color: 0xb090ff, intensity: 1.6, dist: 7, seed: 64, flicker: false }); W.lights.push({ pos: V(cx, 2.6, tz), color: 0xffc890, intensity: 1.0, dist: 6, seed: 65, flicker: false });
    A.hangSign(W, 'SKULL-64', tx + 2.4, tz, Math.PI / 2, 5.4, 2.6);
    W.interact.push({ id: 'n64', label: 'Skull-64', x: cx - 0.6, z: tz, r: 2.6, desc: 'Nintendo 64 · up to 4 players' });
    const seats = [0, 1, 2, 3].map(i => ({ x: cx - 0.05, z: tz - 1.2 + i * 0.8 }));
    N.tv = { x: tx + 0.5, z: tz, y: SY, screen, lights, pads: pads3, seats, cx };
    N.bindScreen();
  };

  /* ================= sitting on the couch ================= */
  N.sit = (seat) => { const P = G.player, T = N.tv; if (!P || !T || F.seated) return; N.sitting = true; N.seat = G.clamp(seat, 0, 3); const S = T.seats[N.seat]; N.back = P.pos.clone(); P.pos.set(S.x, 0, S.z); P.vel.set(0, 0, 0); N.seatYaw = Math.atan2(-(T.x - S.x), -(T.z - S.z)); P.yaw = N.seatYaw; P.pitch = Math.atan2(T.y - 1.08, Math.hypot(T.x - S.x, T.z - S.z)); if (UI.panelKind === 'n64') UI.closePanel(); G.net.pushPresence && G.net.pushPresence(true); G.sfx('thump', 0.3); };
  N.standUp = () => { const P = G.player, T = N.tv; if (!N.sitting) return; N.sitting = false; N.big = false; N.showBig(false); F.hud(null); F.holdBar(null); if (P && T) { const S = T.seats[N.seat]; P.pos.set(S.x - 0.9, 0, S.z); if (G.World.collide) G.World.collide(P.pos, 0.42); P.pitch = 0; } G.net.pushPresence && G.net.pushPresence(true); };
  N.takeSlot = (want) => {
    const S = N.st; if (!S || !S.on) return;
    if (N.own) { const cur = N.mySlot(); if (cur >= 0) { N.sit(cur); return; } let i = S.slots[want] ? S.slots.findIndex(s => !s) : want; if (i < 0) { G.ui.toast('All four controllers are taken'); return; } S.slots[i] = { id: me(), name: myName() }; N.pushSt(); N.sit(i); return; }
    N.send({ op: 'join', slot: want, name: myName() }); N.pendingSit = want; N.pendT = now();
  };
  N.dropSlot = () => { if (N.own) { const i = N.mySlot(); if (i > 0) { N.st.slots[i] = null; N.own.inp[i] = ZERO; N.pushSt(); } } else if (N.mySlot() >= 0) N.send({ op: 'leave' }); };
  // the full-screen picture
  { const css = document.createElement('style'); css.textContent = `#n64Big{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#000;pointer-events:none;z-index:4}#n64Big video{height:min(88vh,calc(92vw * .75));aspect-ratio:4/3;background:#000;border:3px solid #6a4a8a;border-radius:6px;box-shadow:0 0 40px rgba(150,90,255,.35);image-rendering:auto}
#n64Help{position:absolute;left:14px;top:84px;width:290px;background:linear-gradient(180deg,rgba(26,16,30,.9),rgba(10,6,14,.92));border:1px solid #6a4a8a;border-radius:6px;padding:10px 12px;color:#e8dcf0;font-size:12.5px;line-height:1.45;pointer-events:none;z-index:5}#n64Help h3{margin:0 0 6px;font-family:var(--head);color:#d8b8ff;font-size:16px}#n64Help table{border-collapse:collapse;width:100%}#n64Help td{padding:1px 0;vertical-align:top}#n64Help td:first-child{white-space:nowrap;padding-right:8px;color:#ffe08a;font-weight:600;width:1%}#n64Help .sl{display:flex;gap:6px;margin:4px 0 8px}#n64Help .sl span{flex:1;text-align:center;border-radius:3px;padding:2px 0;font-size:11px;background:rgba(255,255,255,.06)}`; document.head.appendChild(css); }
  N.showBig = (on) => { let el = document.getElementById('n64Big'); if (!on) { if (el) el.hidden = true; return; } if (!el) { el = document.createElement('div'); el.id = 'n64Big'; el.innerHTML = '<video autoplay muted playsinline></video>'; document.getElementById('hud').appendChild(el); } el.hidden = false; const v = el.querySelector('video'); if (N.view && v.srcObject !== N.view.stream) { v.srcObject = N.view.stream; v.play().catch(() => { }); } };
  const helpOpen = () => { try { return localStorage.getItem('dd_help_n64') !== '0'; } catch (e) { return true; } };
  N.renderHelp = (on) => {
    let el = document.getElementById('n64Help'); if (!on || !helpOpen()) { if (el) el.hidden = true; return; } if (!el) { el = document.createElement('div'); el.id = 'n64Help'; document.getElementById('hud').appendChild(el); }
    const S = N.st, fps = N.speed(), key = JSON.stringify(S && S.slots) + N.mySlot() + '|' + fps; el.hidden = false; if (el._k === key) return; el._k = key;
    el.innerHTML = `<h3>Skull-64 · ${esc(S ? S.game : '')}</h3><div class="sl">${[0, 1, 2, 3].map(i => `<span style="border-bottom:3px solid ${SLOTC[i]}">${i + 1}. ${S && S.slots[i] ? esc(S.slots[i].id === me() ? 'You' : S.slots[i].name).slice(0, 12) : '—'}</span>`).join('')}</div><table>
<tr><td>WASD</td><td>control stick (hold Shift for a gentle push)</td></tr><tr><td>Space / J</td><td>A</td></tr><tr><td>K</td><td>B</td></tr><tr><td>L / left mouse</td><td>Z trigger</td></tr><tr><td>Q · E / right mouse</td><td>L · R</td></tr><tr><td>Enter</td><td>START</td></tr><tr><td>arrow keys</td><td>C buttons</td></tr><tr><td>T F G H</td><td>D-pad</td></tr><tr><td>gamepad</td><td>stick, A, B (or X), LT/RT = Z, LB/RB = L/R, right stick = C, START</td></tr><tr><td>V</td><td>full-screen picture</td></tr><tr><td>Backspace</td><td>hide this panel</td></tr><tr><td>hold X</td><td>put the controller down</td></tr></table>${N.own ? '<p style="margin:6px 0 0;opacity:.8">More gamepads on this computer: press START on one to join.</p>' : ''}${fps ? `<p style="margin:6px 0 0;color:${fps < 55 ? '#ff9a7a' : '#9ef08a'}">Emulator: ${fps} frames a second${fps < 55 ? ' · struggling: press V for the full-screen picture, it frees up the computer' : ''}</p>` : ''}`;
  };

  /* ================= the frame ================= */
  N.update = (dt) => {
    N.hookRender(); if (N.own) N.ownerTick();
    if (N.own && G.net.party && now() - (N.lastPush || 0) > 1500) { N.lastPush = now(); N.send({ op: 'st', st: N.st }); }
    if (N.st && !N.own && now() - N.lastSt > 7000) { N.st = null; N.dropView(); N.syncWatch(); if (N.sitting) N.standUp(); }
    if (N.watch && N.watch.again && now() > N.watch.again) { N.watch.again = 0; N.send({ op: 'watch', pid: N.watch.id }); }
    if (N.st && !N.own) N.syncWatch();
    if (N.pendingSit !== undefined && N.mySlot() >= 0) { N.sit(N.mySlot()); N.pendingSit = undefined; } else if (N.pendingSit !== undefined && now() - N.pendT > 5000) { N.pendingSit = undefined; G.ui.toast('No answer from the TV'); }
    // owner: free slots of party members who left
    if (N.own && G.net.party && now() - (N.memT || 0) > 2000) { N.memT = now(); const ids = new Set(G.net.members().filter(p => p.presence && p.presence.s === 'hideout').map(p => p.peer)); ids.add(me()); let ch = false; N.st.slots.forEach((s, i) => { if (s && !s.id.startsWith('pad:') && !ids.has(s.id)) { N.st.slots[i] = null; N.own.inp[i] = ZERO; ch = true; } }); if (ch) N.pushSt(); }
    if (G.World.theme !== 'hideout' || !N.tv) { if (N.sitting) N.standUp(); return; }
    if (!N.view) N.drawIdle();
    if (N.view && N.view.needUnmute && G.audio.ctx && G.audio.ctx.state === 'running') { N.view.needUnmute = false; N.view.v.muted = false; N.view.v.play().catch(() => { }); }
    if (N.view && !N.view.local) N.view.v.volume = G.clamp(N.near() * G.settings.vol, 0, 1);
    // the console's port lights and the controllers' lights
    const S = N.st; N.tv.lights.forEach((m, i) => m.material.color.set(S && S.slots[i] ? SLOTC[i] : '#222222')); N.tv.pads.forEach((p, i) => { p.visible = !(S && S.slots[i]); p.userData.led.visible = !!(S && S.slots[i]) && Math.floor(now() / 400 + i) % 2 === 0; });
    if (!N.sitting) { N.renderHelp(false); return; }
    // the controller in your hands: guests send their presses to the owner
    const slot = N.mySlot();
    if (!N.own && slot >= 0) { const st = merge(keyState(), padState(pads()[0])), key = st.b + ',' + q(st.ax) + ',' + q(st.ay); if (key !== N.lastIn || now() - (N.inT || 0) > 400) { N.lastIn = key; N.inT = now(); N.send({ op: 'in', s: slot, b: st.b, ax: q(st.ax), ay: q(st.ay) }); } }
    if (!S || slot < 0 && !N.pendingSit) { N.standUp(); return; }
  };
  // seated: the keys go to the controller, not your character
  const mk0 = G.makePlayer;
  G.makePlayer = function (cls) {
    const P = mk0(cls), up0 = P.update, cam0 = P.updateCam, vm0 = P.animVM;
    P.update = (dt, t) => {
      if (!N.sitting) return up0(dt, t);
      const S = N.tv.seats[N.seat];
      if (!G.ui.modalOpen()) {
        if (G.keys.KeyX) { N.leaveT = (N.leaveT || 0) + dt; F.holdBar(Math.min(1, N.leaveT / 0.8)); if (N.leaveT > 0.8) { N.leaveT = 0; F.holdBar(null); N.dropSlot(); N.standUp(); return up0(dt, t); } } else if (N.leaveT) { N.leaveT = 0; F.holdBar(null); }
        if (G.pressed.KeyV) { N.big = !N.big; G.sfx('click', 0.3); } if (G.pressed.Backspace) { try { localStorage.setItem('dd_help_n64', helpOpen() ? '0' : '1'); } catch (e) { } const el = document.getElementById('n64Help'); if (el) el._k = null; }
        if (N.own && G.pressed.F8) { N.own.E.gameManager.restart(); G.ui.toast('Reset'); }
      }
      N.showBig(N.big && !G.ui.modalOpen()); N.renderHelp(!G.ui.modalOpen() && !N.big);
      const s0 = N.mySlot(), S2 = N.st;
      F.hud({ title: `Skull-64 · ${esc(S2 ? S2.game : '')}`, status: s0 >= 0 ? `You have controller <b style="color:${SLOTC[s0]}">${s0 + 1}</b>${S2 && S2.owner !== me() ? ` · ${esc(S2.ownerName)}'s cartridge` : ''}` : 'Waiting for a controller…', keys: [['V', N.big ? 'back to the room' : 'full screen'], ['hold X', 'put the controller down'], N.own ? ['F8', 'reset'] : null], log: [], noLeave: true });
      const keep = {}; ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ControlLeft', 'KeyC', 'KeyE', 'KeyQ', 'KeyF', 'KeyR', 'KeyG', 'KeyH', 'KeyT', 'KeyJ', 'KeyK', 'KeyL', 'Enter', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].forEach(k => { keep[k] = G.keys[k]; G.keys[k] = false; });
      const mk = { dx: G.mouse.dx, dy: G.mouse.dy, l: G.mouse.l, r: G.mouse.r }; G.mouse.dx = G.mouse.dy = 0; G.mouse.l = G.mouse.r = G.mouse.lPressed = G.mouse.rPressed = false;
      for (const k in G.pressed) if (k !== 'Escape' && k !== 'Enter' && k !== 'KeyT' && k !== 'Tab') G.pressed[k] = false; G.pressed.Enter = false; G.pressed.KeyT = false;
      const yaw = P.yaw - mk.dx * 0.0016 * G.settings.sens, pit = P.pitch - mk.dy * 0.0016 * G.settings.sens; up0(dt, t); P.pitch = pit; P.pos.set(S.x, 0, S.z); P.vel.set(0, 0, 0); P.yaw = N.seatYaw + G.clamp(G.angDiff(yaw, N.seatYaw), -0.6, 0.6); P.pitch = G.clamp(P.pitch, -0.3, 0.6);
      Object.assign(G.keys, keep); Object.assign(G.mouse, mk);
    };
    P.updateCam = (dt, t) => { cam0(dt, t); const cam = G.camera; if (N.sitting && N.tv) { const S = N.tv.seats[N.seat]; cam.position.set(S.x, 1.08, S.z); N.fz = G.damp(N.fz || cam.fov, 50, 4, dt); cam.fov = N.fz; cam.updateProjectionMatrix(); } else if (N.fz) { N.fz = 0; } };   // a narrower view on the couch: the TV fills the wall
    P.animVM = (dt, t) => { vm0(dt, t); if (N.sitting && P.V) P.V.root.visible = false; };
    return P;
  };
  const pk0 = G.game.updatePickups.bind(G.game); G.game.updatePickups = function (dt, t) { pk0(dt, t); try { N.update(dt); } catch (e) { console.error('n64', e); } };
  const it0 = G.game.interactTarget.bind(G.game); G.game.interactTarget = function () { if (N.sitting) return null; return it0(); };
  const hide0 = G.game.enterHideout.bind(G.game); G.game.enterHideout = async function () { if (N.sitting) N.standUp(); N.tv = null; const r = await hide0(); N.syncWatch(); return r; };

  /* ================= sharing the computer with the emulator ================= */
  // the emulator and the 3D room share one browser thread. While a cartridge runs on this computer the room draws at
  // most 60 times a second (a 144 Hz monitor would otherwise starve the emulator), and in the full-screen picture it
  // doesn't draw at all.
  const loop0 = G.game.loop;
  G.game.loop = function (now) {
    const O = N.own; if (O && O.E && !O.E.paused) { if (now - (N.lastLoop || 0) < 15.2) { requestAnimationFrame(t => this.loop(t)); return; } N.lastLoop = now; }
    return loop0.call(this, now);
  };
  N.hookRender = () => { const C = G.composer; if (!C || C.__n64) return; C.__n64 = true; const r0 = C.render.bind(C); C.render = (...a) => { if (N.sitting && N.big && !G.ui.modalOpen()) { N.skipped = (N.skipped || 0) + 1; if (N.skipped % 30) return; } return r0(...a); }; };
  // how fast the game is really running (shown on the controls panel)
  N.speed = () => { const O = N.own; if (!O || !O.E) return null; const n = O.E.gameManager.functions.getFrameNum(), t = now(); if (!O.sp) O.sp = { n, t, fps: 0 }; else if (t - O.sp.t > 1000) { O.sp.fps = Math.round((n - O.sp.n) * 1000 / (t - O.sp.t)); O.sp.n = n; O.sp.t = t; } return O.sp.fps; };

  /* ================= the panel at the couch ================= */
  const render0 = UI.renderPanel.bind(UI);
  UI.renderPanel = function () {
    if (this.panelKind !== 'n64') return render0();
    document.getElementById('panelEye').textContent = 'The Grand Arcade'; document.getElementById('panelTitle').textContent = 'Skull-64';
    document.getElementById('panelSub').textContent = 'A Nintendo 64 for up to four players. Pick a ROM file from your own computer: it stays on your computer, and the picture and sound stream to your party.';
    const body = document.getElementById('panelBody'), S = N.st, mine = N.mySlot();
    let h = '';
    if (!S || !S.on) {
      h += `<div class="tform" style="flex-direction:column;align-items:flex-start;gap:8px"><b style="font-family:var(--head);color:#f3d998">Insert a cartridge</b><span class="note" style="margin:0">.z64, .n64 or .v64 (zipped is fine). You'll have controller 1. Party members in the hideout can take the other three from their couch; extra gamepads on this computer join with START.</span><label class="btn" style="cursor:pointer">Choose a ROM file…<input type="file" id="n64File" accept=".z64,.n64,.v64,.zip,.7z,.rom" hidden></label></div>`;
      if (G.net.party && !window.Peer) h += '<p class="note">Online players will need the GitHub Pages version of the game to see the picture.</p>';
    } else {
      h += `<div class="tbhead">${esc(S.game)} <small>${esc(S.owner === me() ? 'your cartridge' : S.ownerName + "'s cartridge")}${S.booting ? ' · loading…' : ''}</small></div><div class="tseats">${S.slots.map((s, i) => `<span class="tseat ${s && s.id === me() ? 'me' : ''}" style="border-left:4px solid ${SLOTC[i]}">Controller ${i + 1}: ${s ? esc(s.id === me() ? 'You' : s.name) : '<i>free</i>'}${!s && mine < 0 ? ` <button class="btn small" data-slot="${i}">Take it</button>` : ''}</span>`).join('')}</div>`;
      h += `<div class="tact">${mine >= 0 ? '<button class="btn small" id="n64Sit">Sit down and play</button>' : ''}${mine > 0 || (mine >= 0 && S.owner !== me()) ? '<button class="btn small ghost" id="n64Drop">Put the controller down</button>' : ''}${S.owner === me() ? '<button class="btn small ghost" id="n64Reset">Reset</button><button class="btn small ghost" id="n64Eject">Eject cartridge</button>' : ''}</div>`;
      if (S.owner !== me() && !window.Peer) h += '<p class="note">This version of the game can\'t receive the picture from another computer. Play together on the GitHub Pages version, or plug more gamepads into the owner\'s computer.</p>';
    }
    h += '<p class="note" style="margin-top:12px;opacity:.75">Emulation by EmulatorJS and mupen64plus (GPL-3.0). Bring your own legally obtained ROMs: none are included.</p>';
    body.innerHTML = h;
    const $ = id => body.querySelector('#' + id);
    if ($('n64File')) $('n64File').onchange = e => { const f = e.target.files && e.target.files[0]; if (f) { UI.closePanel(); N.load(f); } };
    body.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { N.takeSlot(+b.dataset.slot); UI.closePanel(); });
    if ($('n64Sit')) $('n64Sit').onclick = () => { UI.closePanel(); N.sit(mine); };
    if ($('n64Drop')) $('n64Drop').onclick = () => { N.dropSlot(); setTimeout(() => UI.renderPanel(), 300); };
    if ($('n64Reset')) $('n64Reset').onclick = () => { if (N.own && N.own.E) { N.own.E.gameManager.restart(); G.ui.toast('Reset'); } };
    if ($('n64Eject')) $('n64Eject').onclick = () => { N.eject(); UI.renderPanel(); };
  };
  N.refreshPanel = () => { if (UI.panelKind === 'n64' && !document.getElementById('panelM').hidden) UI.renderPanel(); };
  // pressing E at the couch with a controller already yours sits you straight down
  const op0 = UI.openPanel.bind(UI);
  UI.openPanel = function (kind, data) { if (kind === 'n64' && N.st && N.st.on && N.mySlot() >= 0) { N.sit(N.mySlot()); return; } return op0(kind, data); };
})();
