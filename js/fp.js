/* ============================================================
   First-person tables: sit down and play at the table instead of in a window
   - seating: when a game you're in starts, you sit at your seat; look around the table with the mouse,
     the actions live on a slim bar at the bottom (keys), and you click things on the table with the crosshair
   - magic cards: a floating deck deals itself, cards fly to their places and flip with a shimmer
   - physics dice: hold left click to shake, release to throw; the dice tumble, bounce off the tray walls
     and whatever lands face up is the roll (the host's simulation is the truth, everyone replays it)
   - regulars sit in their seats as real figures, party members' avatars sit in theirs
   - Madame Morta, a witch at a small table, deals your fortune face to face
   ============================================================ */
'use strict';
(() => {
  const TB = G.tables, GM = TB.GAMES, T = G.tavern, TM = T.models, UI = G.ui, R = Math.random;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const me = () => G.net.myId(), now = () => Date.now();
  const F = G.fp = { L: {}, C: {}, seated: null, picks: [], hover: null, sel: null, cards: {}, wheel: 0 };
  addEventListener('wheel', e => { if (F.seated || F.rats) F.wheel += Math.sign(e.deltaY); }, { passive: true });

  /* ================= seat geometry helpers ================= */
  // facing yaw for the camera convention (forward = -sin(yaw), -cos(yaw))
  F.yawTo = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z));
  F.ring = (cx, cz, rx, rz, angles) => angles.map(a => ({ x: cx + Math.cos(a) * rx, z: cz + Math.sin(a) * rz, a }));

  /* ================= labels over seats ================= */
  F.label = () => { const c = document.createElement('canvas'); c.width = 512; c.height = 128; const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); s.scale.set(0.9, 0.225, 1); s.renderOrder = 15; s.userData = { c, tex, text: '' }; return s; };
  F.setLabel = (s, name, sub, hot) => { const key = name + '|' + sub + '|' + hot; if (s.userData.text === key) return; s.userData.text = key; const x = s.userData.c.getContext('2d'); x.clearRect(0, 0, 512, 128); x.fillStyle = hot ? 'rgba(60,40,8,.85)' : 'rgba(14,10,8,.72)'; x.beginPath(); x.roundRect ? x.roundRect(8, 8, 496, 112, 18) : x.rect(8, 8, 496, 112); x.fill(); x.strokeStyle = hot ? '#ffe08a' : '#8a6a30'; x.lineWidth = 4; x.stroke();
    x.textAlign = 'center'; x.fillStyle = hot ? '#ffe08a' : '#f3d998'; x.font = '600 40px Georgia'; x.fillText(name.slice(0, 22), 256, 56); x.fillStyle = '#d8c8a0'; x.font = '30px Georgia'; x.fillText(String(sub).slice(0, 30), 256, 98); s.userData.tex.needsUpdate = true; };

  /* ================= people in the seats ================= */
  const VARIANT = { 'npc:Old Hollis': 0, 'npc:Mara Quickfingers': 1, 'npc:Dorrin': 2 };
  F.npcModel = {};   // id -> model (for gestures)
  TB.npcModel = id => F.npcModel[id];
  F.seatPatron = (id) => { const v = VARIANT[id] ?? ([...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % 3); const Rr = TM.patron(v); M.batchRig(Rr); Rr.root.userData.dynamic = true; return Rr; };
  // occupants: [{slot, id, name, npc, sub, hot}] -> figures for regulars, labels for everyone else but you
  F.occupy = (L, occ) => {
    L.figs = L.figs || {}; L.tags = L.tags || {}; const keep = new Set();
    occ.forEach(o => {
      const S = L.seats[o.slot]; if (!S) return; const k = o.id; keep.add(k);
      if (o.npc && !L.figs[k]) { const Rr = F.seatPatron(o.id); Rr.root.position.set(S.x, 0, S.z); Rr.root.rotation.y = S.look ? Math.atan2(S.look.x - S.x, S.look.z - S.z) : Math.atan2(L.cx - S.x, L.cz - S.z); G.World.group.add(Rr.root); G.World.hideNPCs.push(Rr); L.figs[k] = Rr; F.npcModel[k] = Rr; }
      if (L.figs[k]) { const S2 = L.seats[o.slot]; L.figs[k].root.position.set(S2.x, 0, S2.z); L.figs[k].root.rotation.y = S2.look ? Math.atan2(S2.look.x - S2.x, S2.look.z - S2.z) : Math.atan2(L.cx - S2.x, L.cz - S2.z); }
      if (o.id !== me()) { let s = L.tags[k]; if (!s) { s = L.tags[k] = F.label(); G.scene.add(s); } s.position.set(S.x, o.npc ? 1.72 : 2.05, S.z); F.setLabel(s, o.name, o.sub || '', o.hot); s.visible = true; }
    });
    Object.keys(L.figs).forEach(k => { if (!keep.has(k)) { const Rr = L.figs[k]; if (Rr.root.parent) Rr.root.parent.remove(Rr.root); const i = G.World.hideNPCs.indexOf(Rr); if (i >= 0) G.World.hideNPCs.splice(i, 1); delete L.figs[k]; if (F.npcModel[k] === Rr) delete F.npcModel[k]; } });
    Object.keys(L.tags).forEach(k => { if (!keep.has(k) || k === me()) { G.scene.remove(L.tags[k]); delete L.tags[k]; } });
    // the idle regulars who sit here when nobody's playing
    (L.idle || []).forEach(Rr => { const on = !occ.length; if (on && !Rr.root.parent) { G.World.group.add(Rr.root); if (!G.World.hideNPCs.includes(Rr)) G.World.hideNPCs.push(Rr); } else if (!on && Rr.root.parent) { Rr.root.parent.remove(Rr.root); const i = G.World.hideNPCs.indexOf(Rr); if (i >= 0) G.World.hideNPCs.splice(i, 1); } });
  };

  /* ================= picking with the crosshair ================= */
  const ray = new THREE.Raycaster(), ctr = new THREE.Vector2(0, 0);
  F.pick = () => {
    if (!F.picks.length) { F.setHover(null); return null; }
    ray.setFromCamera(ctr, G.camera); ray.far = 4;
    const objs = F.picks.map(p => p.obj).filter(o => o.visible !== false), hit = ray.intersectObjects(objs, true)[0];
    if (!hit) { F.setHover(null); return null; }
    let o = hit.object; while (o && !F.picks.some(p => p.obj === o)) o = o.parent; const P = F.picks.find(p => p.obj === o) || null; F.setHover(P, hit.point); return P;
  };
  F.setHover = (P, pt) => { if (F.hover === P) { if (P) P.pt = pt; return; } if (F.hover && F.hover.unhover) F.hover.unhover(); F.hover = P; if (P) { P.pt = pt; if (P.onHover) P.onHover(); } };
  F.glow = (obj, on, col = 0xffd060) => obj.traverse(m => { if (!m.isMesh || !m.material || Array.isArray(m.material)) { if (m.isMesh && Array.isArray(m.material)) m.material.forEach(mm => { if (mm.emissive) { if (!mm.userData.own) { mm.userData.own = true; } mm.emissive.setHex(on ? col : 0); mm.emissiveIntensity = on ? 0.55 : 1; } }); return; } if (!m.material.userData.fpOwn) { m.material = m.material.clone(); m.material.userData.fpOwn = true; } if (m.material.emissive) { m.material.emissive.setHex(on ? col : 0); m.material.emissiveIntensity = on ? 0.55 : 1; } });

  /* ================= the HUD bar ================= */
  const css = document.createElement('style');
  css.textContent = `#fpHud{position:absolute;left:50%;bottom:96px;transform:translateX(-50%);min-width:360px;max-width:min(760px,92vw);background:linear-gradient(180deg,rgba(26,16,10,.86),rgba(12,8,6,.9));border:1px solid #7a5a30;border-radius:6px;padding:8px 14px 9px;color:#e8d8b0;font-size:13px;text-align:center;pointer-events:none;box-shadow:0 6px 24px rgba(0,0,0,.6)}
#fpHud .t{font-family:var(--head);color:#f3d998;font-size:15px;letter-spacing:.04em}#fpHud .s{margin:3px 0 6px;color:#e8d8b0}#fpHud .s b{color:#ffe08a}
#fpHud .k{display:flex;flex-wrap:wrap;gap:6px 12px;justify-content:center}#fpHud .k span{white-space:nowrap;opacity:.95}#fpHud .k span.off{opacity:.35}#fpHud .k kbd{display:inline-block;min-width:18px;padding:1px 5px;margin-right:4px;border:1px solid #c8a050;border-bottom-width:2px;border-radius:3px;background:#2a1a0c;color:#ffe08a;font:600 11px/15px var(--body)}
#fpLog{position:absolute;right:18px;bottom:96px;width:250px;font-size:12px;color:#e8d8b0;text-shadow:0 1px 3px #000;pointer-events:none;text-align:right;line-height:1.45}#fpLog p{margin:0;opacity:.9}#fpLog p:nth-child(n+2){opacity:.65}#fpLog p:nth-child(n+4){opacity:.4}
#fpHold{position:absolute;left:50%;top:56%;transform:translateX(-50%);width:120px;height:6px;border-radius:3px;background:rgba(0,0,0,.5);overflow:hidden;pointer-events:none}#fpHold i{display:block;height:100%;background:linear-gradient(90deg,#c8a040,#ffe08a)}`;
  document.head.appendChild(css);
  F.hud = (o) => {
    let el = document.getElementById('fpHud'), lg = document.getElementById('fpLog');
    if (!o) { if (el) el.hidden = true; if (lg) lg.hidden = true; return; }
    if (!el) { el = document.createElement('div'); el.id = 'fpHud'; document.getElementById('hud').appendChild(el); lg = document.createElement('div'); lg.id = 'fpLog'; document.getElementById('hud').appendChild(lg); }
    const keys = (o.keys || []).concat(o.noLeave ? [] : [['X', 'hold: leave the table', true]]);
    const h = `<div class="t">${o.title || ''}</div>${o.status ? `<div class="s">${o.status}</div>` : ''}<div class="k">${keys.filter(Boolean).map(([k, l, on]) => `<span class="${on === false ? 'off' : ''}"><kbd>${k}</kbd>${l}</span>`).join('')}</div>`;
    if (el._h !== h) { el.innerHTML = h; el._h = h; } el.hidden = false;
    const lh = (o.log || []).slice(0, 5).map(l => `<p>${esc(l)}</p>`).join(''); if (lg._h !== lh) { lg.innerHTML = lh; lg._h = lh; } lg.hidden = !lh;
  };
  F.holdBar = (k) => { let el = document.getElementById('fpHold'); if (k === null) { if (el) el.hidden = true; return; } if (!el) { el = document.createElement('div'); el.id = 'fpHold'; el.innerHTML = '<i></i>'; document.getElementById('hud').appendChild(el); } el.hidden = false; el.firstChild.style.width = Math.round(k * 100) + '%'; };
  F.key = (code) => { if (G.pressed[code]) { G.pressed[code] = false; return true; } return false; };

  /* ================= cards ================= */
  const SUITC = ['#1a1410', '#8a0c1c', '#8a0c1c', '#1a1410'];
  F.suitImg = TB.SUIT_SVG.map((svg, s) => { const im = new Image(); im.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" ').replace(/currentColor/g, SUITC[s])); return im; });
  const goldImg = (() => { const im = new Image(); im.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(TB.SUIT_SVG[0].replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" ').replace(/currentColor/g, '#c8a040')); return im; })();
  F.cardTex = (c) => {
    const key = c === null || c === undefined ? 'back' : c; if (F.cards[key]) return F.cards[key];
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 358; const x = cv.getContext('2d'); const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 8; F.cards[key] = tex;
    const draw = () => {
      if (key === 'back') { const g = x.createRadialGradient(128, 179, 10, 128, 179, 220); g.addColorStop(0, '#5a1420'); g.addColorStop(1, '#1e050a'); x.fillStyle = g; x.fillRect(0, 0, 256, 358); x.strokeStyle = 'rgba(200,160,64,.18)'; x.lineWidth = 2; for (let i = -400; i < 400; i += 14) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 358, 358); x.stroke(); x.beginPath(); x.moveTo(i + 358, 0); x.lineTo(i, 358); x.stroke(); } x.strokeStyle = '#c8a040'; x.lineWidth = 6; x.strokeRect(12, 12, 232, 334); x.lineWidth = 2; x.strokeRect(22, 22, 212, 314); if (goldImg.complete) x.drawImage(goldImg, 68, 119, 120, 120); tex.needsUpdate = true; return; }
      const r = key >> 2, s = key & 3, red = s === 1 || s === 2, col = red ? '#8a0c1c' : '#1a1410', g = x.createLinearGradient(0, 0, 256, 358); g.addColorStop(0, '#f8eed6'); g.addColorStop(1, '#dccaa0'); x.fillStyle = g; x.fillRect(0, 0, 256, 358);
      x.strokeStyle = '#7a6038'; x.lineWidth = 6; x.strokeRect(3, 3, 250, 352); x.strokeStyle = 'rgba(122,96,56,.5)'; x.lineWidth = 2; x.strokeRect(14, 14, 228, 330);
      const RK = TB.RANK[r], im = F.suitImg[s]; x.fillStyle = col; x.font = 'bold 54px Georgia'; x.textAlign = 'left'; x.textBaseline = 'top'; x.fillText(RK, 20, 18); if (im.complete) x.drawImage(im, 22, 76, 40, 40);
      x.save(); x.translate(236, 340); x.rotate(Math.PI); x.fillText(RK, 0, 0); if (im.complete) x.drawImage(im, 2, 58, 40, 40); x.restore();
      if (r >= 9 && r <= 11) { x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '110px serif'; x.fillText({ 9: '☠', 10: '🜏', 11: '♛' }[r], 128, 172); x.font = '600 24px Georgia'; x.fillText({ 9: 'GHOUL', 10: 'WITCH', 11: 'LICH' }[r], 128, 268); }
      else if (im.complete) { const sz = r === 12 ? 150 : 110; x.drawImage(im, 128 - sz / 2, 179 - sz / 2, sz, sz); }
      tex.needsUpdate = true;
    };
    draw(); [...F.suitImg, goldImg].forEach(im => { if (!im.complete) im.addEventListener('load', draw); });
    return tex;
  };
  const CW = 0.088, CL = 0.124, CH = 0.0014, cardGeo = new THREE.BoxGeometry(CW, CH, CL), edgeM = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.8 });
  F.cardMesh = (c) => { const face = new THREE.MeshStandardMaterial({ map: F.cardTex(c), roughness: 0.55, emissive: 0x000000 }), back = new THREE.MeshStandardMaterial({ map: F.cardTex(null), roughness: 0.55, emissive: 0x000000 }); const m = new THREE.Mesh(cardGeo, [edgeM, edgeM, face, back, edgeM, edgeM]); m.castShadow = true; m.userData.face = face; m.userData.back = back; m.userData.dynamic = true; return m; };
  F.setCardFace = (m, c) => { if (m.userData.c === c) return; m.userData.c = c; m.userData.face.map = F.cardTex(c); m.userData.face.needsUpdate = true; };
  // a set of cards on one table that tweens toward wanted spots: want = [{k, c, x, y, z, ry, up}]
  F.cardSet = (L) => L.cardset || (L.cardset = { m: {}, deck: null });
  F.syncCards = (L, want, dt) => {
    const S = F.cardSet(L), keys = new Set();
    want.forEach((w, n) => {
      keys.add(w.k); let o = S.m[w.k];
      if (!o) { const m = F.cardMesh(w.c); G.scene.add(m); const d = L.deckAt; o = S.m[w.k] = { m, p: new G.V3(d.x, d.y, d.z), up: false, flip: 0, t: -n * 0.11, from: new G.V3(d.x, d.y, d.z), ry: 0 }; m.position.copy(o.p); G.sfx('click', 0.25, o.p); }
      if (w.c !== null && w.c !== undefined) F.setCardFace(o.m, w.c);
      o.want = w; if (!o.to || o.to.x !== w.x || o.to.y !== w.y || o.to.z !== w.z) { o.from = o.m.position.clone(); o.to = new G.V3(w.x, w.y, w.z); o.t = Math.min(o.t, 0); o.mv = true; }
    });
    Object.keys(S.m).forEach(k => { if (!keys.has(k)) { const o = S.m[k]; if (!o.gone) { o.gone = 0.001; o.from = o.m.position.clone(); } } });
    // animate
    Object.keys(S.m).forEach(k => {
      const o = S.m[k], m = o.m;
      if (o.gone) { o.gone += dt * 2.2; const e = Math.min(1, o.gone); m.position.lerpVectors(o.from, new G.V3(L.deckAt.x, L.deckAt.y, L.deckAt.z), e); m.position.y += Math.sin(e * Math.PI) * 0.25; m.scale.setScalar(1 - e * 0.7); if (e >= 1) { G.scene.remove(m); delete S.m[k]; } return; }
      if (o.mv) { o.t += dt * 1.9; const e = G.clamp(o.t, 0, 1), s = e * e * (3 - 2 * e); m.position.lerpVectors(o.from, o.to, s); m.position.y += Math.sin(s * Math.PI) * (o.from.distanceTo(o.to) * 0.35 + 0.05); m.rotation.y = G.lerpAng(m.rotation.y, o.want.ry, Math.min(1, dt * 8)); if (e >= 1) { o.mv = false; m.position.copy(o.to); } }
      else m.rotation.y = G.lerpAng(m.rotation.y, o.want.ry, Math.min(1, dt * 8));
      // flips are magic: the card rises a little, turns over in a shimmer and settles
      const wantUp = !!o.want.up && o.want.c !== null && o.want.c !== undefined, target = wantUp ? 1 : 0;
      if (o.flip !== target && !o.mv) { const was = o.flip; o.flip = G.clamp(o.flip + (target > o.flip ? 1 : -1) * dt * 2.6, 0, 1); if ((was < 0.5) !== (o.flip < 0.5)) { G.fx.spark(m.position.clone().add(new G.V3(0, 0.05, 0)), 0xd0a0ff, 10, 1.2, 0.5, 0.025, 0); G.sfx('magic', 0.18, m.position); } }
      const fk = o.flip, lift = Math.sin(fk * Math.PI) * 0.07; m.rotation.x = 0; m.rotation.z = (1 - fk) * Math.PI; if (!o.mv) m.position.y = o.want.y + lift;
      const glow = Math.sin(fk * Math.PI); m.userData.face.emissive.setHex(0x6030a0); m.userData.face.emissiveIntensity = glow * 0.9; m.userData.back.emissive.setHex(0x6030a0); m.userData.back.emissiveIntensity = glow * 0.9;
      if (o.want.hl) { m.userData.face.emissive.setHex(0xffd060); m.userData.face.emissiveIntensity = 0.25 + Math.sin(G.now() * 5) * 0.12; }
      m.scale.setScalar((F.cardScale || 1) * (o.want.s || 1));
      // peeking: your own cards lift off the table and come up in front of your eyes, big and readable
      if (o.want.peek !== undefined && F.peekK > 0.001) { const cam = G.camera, cx = new G.V3(1, 0, 0).applyQuaternion(cam.quaternion), cy = new G.V3(0, 1, 0).applyQuaternion(cam.quaternion), cz = new G.V3(0, 0, 1).applyQuaternion(cam.quaternion), n = o.want.peekN || 2;
        const pp = cam.position.clone().addScaledVector(cz, -0.3).addScaledVector(cy, 0.012).addScaledVector(cx, (o.want.peek - (n - 1) / 2) * 0.075), mx = new THREE.Matrix4().makeBasis(cx, cz, cy.clone().negate()), pq = new THREE.Quaternion().setFromRotationMatrix(mx).multiply(new THREE.Quaternion().setFromAxisAngle(new G.V3(0, 0, 1), (o.want.peek - (n - 1) / 2) * -0.12));
        const e = F.peekK * F.peekK * (3 - 2 * F.peekK); m.position.lerp(pp, e); m.quaternion.slerp(pq, e); m.scale.setScalar(G.lerp(F.cardScale || 1, 0.85, e)); m.renderOrder = e > 0.5 ? 5 : 0; }
    });
  };
  F.clearCards = (L) => { const S = L.cardset; if (!S) return; Object.values(S.m).forEach(o => G.scene.remove(o.m)); S.m = {}; };
  // the deck that deals itself: a floating, slowly turning stack wrapped in violet light
  F.magicDeck = (W, x, y, z) => { const g = new THREE.Group(); for (let i = 0; i < 14; i++) { const m = F.cardMesh(null); m.rotation.z = Math.PI; m.position.y = i * 0.0016; m.rotation.y = (R() - 0.5) * 0.05; g.add(m); } const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.004, 6, 32), G.mat('emissive', { c: 0xb080ff, i: 2.5 })); ring.rotation.x = Math.PI / 2; ring.position.y = -0.02; g.add(ring); g.position.set(x, y, z); g.userData.dynamic = true; G.World.group.add(g); W.lights.push({ pos: new G.V3(x, y + 0.1, z), color: 0xa070ff, intensity: 0.9, dist: 3.5, seed: x, flicker: false }); F.decks.push({ g, y, ring }); return g; };
  F.decks = [];

  /* ================= dice: the model ================= */
  // local face normals -> values: +x 2, -x 5, +y 1, -y 6, +z 3, -z 4 (opposite faces sum to seven)
  const FACEV = [2, 5, 1, 6, 3, 4], FACEN = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  F.dieTex = {}; F.dieFaceTex = (v, style) => { const key = v + style; if (F.dieTex[key]) return F.dieTex[key]; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    x.fillStyle = style === 'dragon' ? '#efe2c2' : '#f2ead6'; x.fillRect(0, 0, 128, 128); x.strokeStyle = 'rgba(90,70,40,.35)'; x.lineWidth = 6; x.strokeRect(3, 3, 122, 122);
    const P = { 1: [[64, 64]], 2: [[34, 34], [94, 94]], 3: [[30, 30], [64, 64], [98, 98]], 4: [[34, 34], [94, 34], [34, 94], [94, 94]], 5: [[32, 32], [96, 32], [64, 64], [32, 96], [96, 96]], 6: [[34, 28], [94, 28], [34, 64], [94, 64], [34, 100], [94, 100]] }[v];
    P.forEach(([px, py]) => { x.beginPath(); x.arc(px, py, v === 1 ? (style === 'dragon' ? 22 : 15) : 11, 0, Math.PI * 2); x.fillStyle = v === 1 ? '#a01818' : '#1a1210'; x.fill(); if (v === 1 && style === 'dragon') { x.fillStyle = '#ffd040'; x.beginPath(); x.ellipse(px, py, 4, 14, 0, 0, Math.PI * 2); x.fill(); } });
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return (F.dieTex[key] = t); };
  F.DS = 0.05;   // die edge
  F.dieGeo = new THREE.BoxGeometry(F.DS, F.DS, F.DS);
  F.diceSet = new Set(); F.dieMesh = (style = 'bone') => { const mats = FACEV.map(v => new THREE.MeshStandardMaterial({ map: F.dieFaceTex(v, style), roughness: 0.45, emissive: 0x000000 })); const m = new THREE.Mesh(F.dieGeo, mats); m.castShadow = true; m.userData.dynamic = true; F.diceSet.add(m); return m; };
  F.dieGlow = (m, col, k) => m.material.forEach(mm => { mm.emissive.setHex(col); mm.emissiveIntensity = k; });
  // orient a die so a value faces up, with some yaw
  const qTmp = new THREE.Quaternion(), vUp = new G.V3(0, 1, 0);
  F.faceUpQuat = (v, yaw = 0) => { const i = FACEV.indexOf(v), n = new G.V3(...FACEN[i]); const q = new THREE.Quaternion().setFromUnitVectors(n, vUp); return new THREE.Quaternion().setFromAxisAngle(vUp, yaw).multiply(q); };
  F.topValue = (q) => { let best = 0, bv = -2; FACEN.forEach((n, i) => { const w = new G.V3(...n).applyQuaternion(q); if (w.y > bv) { bv = w.y; best = i; } }); return FACEV[best]; };

  /* ================= dice: the physics ================= */
  // a box arena (the tray), dice are cubes with eight contact corners; fixed 1/240 s steps so every client gets the same tumble
  const DT = 1 / 240, GRAV = 9.8, REST = 0.32, MU = 0.45;
  const rng = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
  F.diceSim = (arena, from, aim, pow, seed, n) => {
    const r = rng(seed), half = F.DS / 2, D = [];
    for (let i = 0; i < n; i++) {
      const sp = new G.V3((r() - 0.5) * 0.06, (r() - 0.5) * 0.03, (r() - 0.5) * 0.06), speed = 0.9 + pow * 1.9 + r() * 0.3, a = aim + (r() - 0.5) * 0.35;
      D.push({ p: new G.V3(from.x, from.y, from.z).add(sp), v: new G.V3(Math.sin(a) * speed, 0.5 + pow * 0.9 + r() * 0.4, Math.cos(a) * speed), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6.28, r() * 6.28, r() * 6.28)), w: new G.V3((r() - 0.5) * 30, (r() - 0.5) * 30, (r() - 0.5) * 30), rest: 0 });
    }
    return { arena, D, t: 0, done: false, half, acc: 0 };
  };
  const corners = []; for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) corners.push(new G.V3(a, b, c));
  const rr = new G.V3(), vp = new G.V3(), tmp = new G.V3(), tmp2 = new G.V3(), cn = new G.V3();
  const contact = (d, r, n, invI, depth) => {
    // r: corner offset from the centre (world), n: contact normal
    vp.copy(d.w).cross(r).add(d.v); const vn = vp.dot(n);
    if (vn < 0) {
      tmp.copy(r).cross(n); const k = 1 + invI * tmp.lengthSq(), e = vn < -0.35 ? REST : 0, j = -(1 + e) * vn / k;
      d.v.addScaledVector(n, j); tmp.copy(r).cross(n).multiplyScalar(j * invI); d.w.add(tmp);
      // friction
      vp.copy(d.w).cross(r).add(d.v); const vn2 = vp.dot(n); tmp2.copy(vp).addScaledVector(n, -vn2); const vt = tmp2.length();
      if (vt > 1e-5) { tmp2.multiplyScalar(1 / vt); tmp.copy(r).cross(tmp2); const kt = 1 + invI * tmp.lengthSq(); let jt = -vt / kt; jt = Math.max(jt, -MU * j); d.v.addScaledVector(tmp2, jt); tmp.copy(r).cross(tmp2).multiplyScalar(jt * invI); d.w.add(tmp); }
    }
    return depth;
  };
  F.stepDice = (S) => {
    const A = S.arena, h = S.half, invI = 6 / (F.DS * F.DS);
    S.D.forEach(d => {
      if (d.sleep) return;
      d.v.y -= GRAV * DT; d.p.addScaledVector(d.v, DT);
      // integrate the rotation
      const wl = d.w.length(); if (wl > 1e-6) { qTmp.setFromAxisAngle(tmp.copy(d.w).multiplyScalar(1 / wl), wl * DT); d.q.premultiply(qTmp).normalize(); }
      // contacts: floor and the four walls
      let push = [0, 0, 0, 0, 0], touching = false;
      for (const c of corners) {
        rr.copy(c).multiplyScalar(h).applyQuaternion(d.q); const px = d.p.x + rr.x, py = d.p.y + rr.y, pz = d.p.z + rr.z;
        if (py < A.y) { touching = true; push[0] = Math.max(push[0], contact(d, rr, cn.set(0, 1, 0), invI, A.y - py)); }
        if (px < A.cx - A.hx) push[1] = Math.max(push[1], contact(d, rr, cn.set(1, 0, 0), invI, A.cx - A.hx - px));
        if (px > A.cx + A.hx) push[2] = Math.max(push[2], contact(d, rr, cn.set(-1, 0, 0), invI, px - A.cx - A.hx));
        if (pz < A.cz - A.hz) push[3] = Math.max(push[3], contact(d, rr, cn.set(0, 0, 1), invI, A.cz - A.hz - pz));
        if (pz > A.cz + A.hz) push[4] = Math.max(push[4], contact(d, rr, cn.set(0, 0, -1), invI, pz - A.cz - A.hz));
      }
      d.p.y += push[0]; d.p.x += push[1] - push[2]; d.p.z += push[3] - push[4];
      if (touching) { d.w.multiplyScalar(0.985); d.v.x *= 0.995; d.v.z *= 0.995; }
      // asleep once it has been still for a moment
      if (touching && d.v.lengthSq() < 0.0009 && d.w.lengthSq() < 0.09) { d.rest += DT; if (d.rest > 0.25) { d.sleep = true; d.v.set(0, 0, 0); d.w.set(0, 0, 0); } } else d.rest = 0;
    });
    // dice knock into each other (as spheres, which is plenty at this size)
    for (let i = 0; i < S.D.length; i++) for (let j = i + 1; j < S.D.length; j++) { const a = S.D[i], b = S.D[j]; tmp.copy(b.p).sub(a.p); const dd = tmp.length(), rr2 = F.DS * 1.05; if (dd >= rr2 || dd < 1e-6) continue; tmp.multiplyScalar(1 / dd); const o = (rr2 - dd) / 2; a.p.addScaledVector(tmp, -o); b.p.addScaledVector(tmp, o); const rv = tmp2.copy(b.v).sub(a.v).dot(tmp); if (rv < 0) { const j2 = -(1 + 0.4) * rv / 2; a.v.addScaledVector(tmp, -j2); b.v.addScaledVector(tmp, j2); a.sleep = b.sleep = false; a.rest = b.rest = 0; a.w.x += (R0(i) - 0.5) * 2; b.w.z += (R0(j) - 0.5) * 2; } }
    S.t += DT;
    if (S.D.every(d => d.sleep) || S.t > 7) { S.done = true; S.D.forEach(d => { const v = F.topValue(d.q), e = new THREE.Euler().setFromQuaternion(d.q, 'YXZ'); d.q.copy(F.faceUpQuat(v, e.y)); d.p.y = A.y + h; d.val = v; }); }
  };
  const R0 = i => ((i * 2654435761) >>> 0) / 4294967296;   // deterministic jitter, no Math.random inside the sim
  F.runDice = (arena, from, aim, pow, seed, n) => { const S = F.diceSim(arena, from, aim, pow, seed, n); let k = 0; while (!S.done && k++ < 4000) F.stepDice(S); return S.D.map(d => d.val || F.topValue(d.q)); };
  // where a throw starts for a seat: on the tray's edge nearest the seat, aimed back across it
  F.throwFrom = (arena, seat) => { const dx = seat.x - arena.cx, dz = seat.z - arena.cz, k = Math.min((arena.hx - 0.03) / Math.max(1e-6, Math.abs(dx)), (arena.hz - 0.03) / Math.max(1e-6, Math.abs(dz))); return { x: arena.cx + dx * k, y: arena.y + 0.16, z: arena.cz + dz * k, aim: Math.atan2(-dx, -dz) }; };
  F.tossResult = (arena, seat, o, n) => { const f = F.throwFrom(arena, seat); return F.runDice(arena, f, f.aim + G.clamp(+o.aim || 0, -0.6, 0.6), G.clamp(+o.pow || 0, 0, 1), o.seed >>> 0, n); };
  // a toss being shown on a table: replays the same throw, then nudges any die that disagrees with the host's result
  F.showToss = (L, tossKey, seat, o, n, faces, style = 'bone') => {
    const f = F.throwFrom(L.arena, seat); const S = F.diceSim(L.arena, f, f.aim + G.clamp(+o.aim || 0, -0.6, 0.6), G.clamp(+o.pow || 0, 0, 1), o.seed >>> 0, n);
    (L.tossDice || []).forEach(m => G.scene.remove(m)); L.tossDice = S.D.map(() => { const m = F.dieMesh(style); G.scene.add(m); return m; });
    L.toss = { key: tossKey, S, faces, acc: 0, fixT: 0 }; G.sfx('dice', 0.7, new G.V3(f.x, 1, f.z));
  };
  F.tickToss = (L, dt) => {
    const X = L.toss; if (!X) return;
    if (!X.S.done) { X.acc += Math.min(dt, 0.1); let k = 0; while (X.acc >= DT && k++ < 80 && !X.S.done) { X.acc -= DT; const hits = X.S.D.map(d => d.v.y); F.stepDice(X.S); X.S.D.forEach((d, i) => { if (hits[i] < -0.6 && d.v.y > -0.1) G.sfx('diceland', 0.25, d.p); }); } }
    else if (X.faces && X.fixT < 1) { X.fixT = Math.min(1, X.fixT + dt * 3); X.S.D.forEach((d, i) => { const want = X.faces[i]; if (!want || F.topValue(d.q) === want && !d.fixing) return; d.fixing = d.fixing || { from: d.q.clone(), to: F.faceUpQuat(want, new THREE.Euler().setFromQuaternion(d.q, 'YXZ').y) }; d.q.slerpQuaternions(d.fixing.from, d.fixing.to, X.fixT); }); }
    X.S.D.forEach((d, i) => { const m = L.tossDice[i]; if (m) { m.position.copy(d.p); m.quaternion.copy(d.q); } });
  };
  F.tossDone = (L) => !L.toss || L.toss.S.done;
  F.clearToss = (L) => { (L.tossDice || []).forEach(m => G.scene.remove(m)); L.tossDice = []; L.toss = null; };
  // the shake: hold left click to rattle the dice in your fist, release to throw
  F.shaker = { on: false, t: 0 };
  F.shakeInput = (dt, ok, onThrow) => {
    const K = F.shaker; if (!ok) { if (K.vm) K.vm.visible = false; K.on = false; F.holdBar(null); return; }
    if (!K.vm) { K.vm = new THREE.Group(); const cup = TM.diceCup(); cup.scale.setScalar(1.2); cup.rotation.x = 0.2; K.vm.add(cup); K.vm.position.set(0.18, -0.24, -0.45); G.camera.add(K.vm); }
    K.vm.visible = true;
    if (G.mouse.l && !F.hover) { if (!K.on) { K.on = true; K.t = 0; } K.t += dt; const a = Math.min(1, K.t / 1.2); K.vm.position.set(0.18 + Math.sin(K.t * 31) * 0.03 * (0.4 + a), -0.2 + Math.sin(K.t * 23) * 0.04 * (0.4 + a), -0.42); K.vm.rotation.set(0.2 + Math.sin(K.t * 27) * 0.3 * a, 0, Math.sin(K.t * 19) * 0.2); if (Math.floor(K.t * 9) !== Math.floor((K.t - dt) * 9)) G.sfx('dice', 0.25 + a * 0.3); F.holdBar(0.5 - 0.5 * Math.cos(Math.min(K.t, 2.4) / 1.2 * Math.PI)); }
    else if (K.on) { K.on = false; F.holdBar(null); const pow = 0.5 - 0.5 * Math.cos(Math.min(K.t, 2.4) / 1.2 * Math.PI), P = G.player, S = F.seated; const aim = S ? G.clamp(G.angDiff(P.yaw, S.yaw) * -1, -0.6, 0.6) : 0; K.vm.rotation.set(-0.8, 0, 0); onThrow({ pow: Math.max(0.15, pow), aim, seed: (R() * 4294967295) >>> 0 }); }
    else { K.vm.position.set(0.18, -0.24 + Math.sin(G.now() * 2) * 0.005, -0.45); K.vm.rotation.set(0.2, 0, 0); }
  };

  /* ================= sitting down and standing up ================= */
  F.sit = (L, slot) => {
    const P = G.player, S = L.seats[slot]; if (!P || !S) return;
    F.seated = { L, slot, yaw: S.look ? F.yawTo(S.x, S.z, S.look.x, S.look.z) : F.yawTo(S.x, S.z, L.cx, L.cz), back: P.pos.clone() };
    P.pos.set(S.x, 0, S.z); P.vel.set(0, 0, 0); P.yaw = F.seated.yaw; P.pitch = L.pitch ?? -0.5; G.sfx('thump', 0.3);
    if (UI.panelKind && !document.getElementById('panelM').hidden) UI.closePanel();
    G.net.pushPresence && G.net.pushPresence(true);
  };
  F.stand = () => {
    const P = G.player, S = F.seated; if (!S) return; F.seated = null; F.hud(null); F.holdBar(null); F.setHover(null); F.picks = [];
    if (F.shaker.vm) F.shaker.vm.visible = false;
    if (P) { const st = S.L.seats[S.slot], dx = st.x - S.L.cx, dz = st.z - S.L.cz, l = Math.hypot(dx, dz) || 1; P.pos.set(st.x + dx / l * 0.7, 0, st.z + dz / l * 0.7); if (G.World.collide) G.World.collide(P.pos, 0.42); P.pitch = 0; }
    G.net.pushPresence && G.net.pushPresence(true);
  };
  // which table am I sitting at, and where
  F.myGame = () => {
    for (const k in F.L) { const L = F.L[k], C = F.C[L.game]; if (!C) continue; const t = F.tableFor(L); if (!t || t.closed || t.phase !== 'play' || !t.seats.some(s => s.id === me())) continue; const slot = C.slotOf(L, t, me()); if (slot >= 0) return { L, t, C, slot }; }
    return null;
  };
  F.tableFor = (L) => { const all = Object.values(TB.list).filter(t => t.game === L.game && !t.closed && (L.match ? L.match(t) : true)); return all.find(t => t.seats.some(s => s.id === me())) || all.find(t => t.phase === 'play') || all[0] || null; };

  /* ================= the frame ================= */
  F.update = (dt) => {
    if (G.World.theme !== 'hideout') return;
    F.decks.forEach(d => { d.g.rotation.y += dt * 0.5; d.g.position.y = d.y + Math.sin(G.now() * 1.6) * 0.02; d.ring.material.emissiveIntensity = 2 + Math.sin(G.now() * 3) * 0.6; });
    for (const k in F.L) { const L = F.L[k], C = F.C[L.game]; if (!C) continue; const t = F.tableFor(L); try { C.sync(L, t && t.phase === 'play' ? t : null, dt); } catch (e) { console.error('fp sync', L.key, e); } F.tickToss(L, dt); }
    // sit when my game starts, stand when it ends
    const mg = F.myGame();
    if (mg && (!F.seated || F.seated.L !== mg.L || F.seated.slot !== mg.slot)) { if (F.seated) F.stand(); F.sit(mg.L, mg.slot); }
    else if (!mg && F.seated && F.seated.L.game !== 'tarot') F.stand();
    if (F.tarot) F.tarotTick(dt);
  };
  // the seated frame: look around within reason, act with keys and the crosshair, everything else held still
  F.input = (dt) => {
    const S = F.seated, P = G.player; if (!S || !P) return;
    const s = 0.0022 * G.settings.sens; P.yaw -= G.mouse.dx * s; P.pitch -= G.mouse.dy * s * (G.settings.invertY ? -1 : 1);
    const dy = G.angDiff(P.yaw, S.yaw); if (Math.abs(dy) > 1.35) P.yaw = S.yaw + Math.sign(dy) * 1.35; P.pitch = G.clamp(P.pitch, -1.25, 0.45);
    // hold X to get up
    if (G.keys.KeyX && !G.ui.modalOpen()) { S.leaveT = (S.leaveT || 0) + dt; F.holdBar(Math.min(1, S.leaveT / 0.8)); if (S.leaveT > 0.8) { S.leaveT = 0; F.holdBar(null); if (S.L.game === 'tarot') { F.tarotEnd(); return; } const mg = F.myGame(); if (mg) { TB.leave(mg.t.tid); if (mg.t.host !== me()) { delete TB.list[mg.t.tid]; delete TB.seated[mg.t.tid]; } } F.stand(); return; } }
    else if (S.leaveT) { S.leaveT = 0; F.holdBar(null); }
    if (G.ui.modalOpen()) return;
    F.pick();
    if (S.L.game === 'tarot') { F.tarotInput(dt); return; }
    const mg = F.myGame(); if (!mg) return;
    const hud = mg.C.input(mg.L, mg.t, dt) || {};
    const over = mg.t.st && mg.t.st.phase === 'over' || (mg.t.phase === 'over');
    if (over && mg.t.host === me()) { hud.keys = (hud.keys || []).concat([['R', 'play again', true]]); if (F.key('KeyR')) { TB.act(mg.t.tid, { t: 'rematch' }); setTimeout(() => { const t2 = TB.list[mg.t.tid]; if (t2 && t2.phase === 'lobby') TB.act(mg.t.tid, { t: 'start' }); }, 120); } }
    hud.log = hud.log || (mg.t.st && mg.t.st.log) || [];
    F.hud(hud);
    if (G.mouse.lPressed && F.hover && F.hover.onClick) { G.mouse.lPressed = false; F.hover.onClick(); }
  };
  // hook the player: seated players don't walk, jump, swing or emote
  const mk0 = G.makePlayer;
  G.makePlayer = function (cls) {
    const P = mk0(cls), up0 = P.update, cam0 = P.updateCam, vm0 = P.animVM;
    P.update = (dt, t) => {
      if (!F.seated) { if (F.preInput && G.World.theme === 'hideout') F.preInput(dt); return up0(dt, t); }
      F.input(dt); if (!F.seated) return up0(dt, t);
      const S = F.seated, st = S.L.seats[S.slot], keep = { dx: G.mouse.dx, dy: G.mouse.dy, l: G.mouse.l, r: G.mouse.r, lp: G.mouse.lPressed, rp: G.mouse.rPressed }, kk = {}, yaw = P.yaw, pitch = P.pitch;
      ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ControlLeft', 'KeyC'].forEach(k => { kk[k] = G.keys[k]; G.keys[k] = false; });
      G.mouse.dx = G.mouse.dy = 0; G.mouse.l = G.mouse.r = G.mouse.lPressed = G.mouse.rPressed = false;
      for (const k in G.pressed) if (k !== 'Escape' && k !== 'Tab' && k !== 'KeyM' && k !== 'Enter' && k !== 'KeyT') G.pressed[k] = false;
      up0(dt, t);
      P.pos.set(st.x, 0, st.z); P.vel.set(0, 0, 0); P.yaw = yaw; P.pitch = pitch;
      Object.assign(G.mouse, { dx: keep.dx, dy: keep.dy, l: keep.l, r: keep.r, lPressed: keep.lp, rPressed: keep.rp }); Object.assign(G.keys, kk);
    };
    P.updateCam = (dt, t) => { cam0(dt, t); if (F.seated) { const st = F.seated.L.seats[F.seated.slot]; G.camera.position.set(st.x, F.seated.L.eye || 1.2, st.z); } };
    P.animVM = (dt, t) => { vm0(dt, t); if (F.seated && P.V) P.V.root.visible = false; };
    return P;
  };
  // tell the party you're sitting, and sit their avatars down
  F.sitPose = (R2) => { R2.hips.position.y = 0.6; R2.legL.hip.rotation.set(-1.5, 0, 0.12); R2.legR.hip.rotation.set(-1.5, 0, -0.12); R2.legL.kn.rotation.set(1.45, 0, 0); R2.legR.kn.rotation.set(1.5, 0, 0); R2.armL.sh.rotation.set(-0.85, 0, 0.18); R2.armL.el.rotation.set(-1.0, 0, 0); R2.armR.sh.rotation.set(-0.9, 0, -0.15); R2.armR.el.rotation.set(-0.95, 0, 0); };
  const ur0 = G.net.updateRemotes.bind(G.net);
  G.net.updateRemotes = function (dt) { ur0(dt); if (!this.party) return; for (const p of this.members()) { const r = this.remotes[p.peer]; if (r && r.root.visible && p.presence && p.presence.sit) F.sitPose(r.R); } };

  /* ================= wiring: build, frame, panels ================= */
  const pk0 = G.game.updatePickups.bind(G.game);
  G.game.updatePickups = function (dt, t) { pk0(dt, t); try { F.update(dt); } catch (e) { console.error('fp', e); } };
  const clearAll = () => { Object.values(F.L).forEach(L => { F.clearCards(L); F.clearToss(L); Object.values(L.tags || {}).forEach(s => G.scene.remove(s)); (L.extra || []).forEach(m => G.scene.remove(m)); if (F.C[L.game] && F.C[L.game].clear) F.C[L.game].clear(L); }); F.L = {}; F.decks = []; F.npcModel = {}; if (F.seated) F.stand(); F.hud(null); };
  const hideout0 = G.game.enterHideout.bind(G.game); G.game.enterHideout = async function () { clearAll(); return hideout0(); };
  const ns0 = G.game.netStart.bind(G.game); G.game.netStart = function (d) { const r0 = ns0(d); if (G.run.active) clearAll(); return r0; };
  // walking up to a table you're already playing at sits you down rather than opening the window
  const op0 = UI.openPanel.bind(UI);
  UI.openPanel = function (kind, data) {
    if (kind === 'tarot' && F.tarotStart) { F.tarotStart(); return; }
    if (GM[kind] && F.C[kind]) { const t = TB.mineFor(kind); if (t && t.phase === 'play' && F.C[kind].slotOf && Object.values(F.L).some(L => L.game === kind)) { return; } }
    return op0(kind, data);
  };
  // the interact prompt is hidden while seated
  const it0 = G.game.interactTarget.bind(G.game);
  G.game.interactTarget = function () { if (F.seated || (T.knives && T.knives.active)) return null; return it0(); };
  // when a game starts the lobby window closes by itself (you're about to sit down)
  const ab0 = TB.absorb;
  TB.absorb = (t) => { const was = TB.list[t.tid] && TB.list[t.tid].phase; ab0(t); if (was === 'lobby' && t.phase === 'play' && t.seats.some(s => s.id === me()) && F.C[t.game] && UI.panelKind === t.game && !document.getElementById('panelM').hidden) UI.closePanel(); };
})();
