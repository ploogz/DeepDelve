/* ============================================================
   NPC dialogue, 3D d20 roll overlay, tiered upgrade cards,
   and 3D item icon rendering
   ============================================================ */
'use strict';
G.dialog = {
  open(o) {
    this.o = o; const el = document.getElementById('dialog');
    el.hidden = false; G.ui.releasePointer();
    document.getElementById('dlgName').textContent = o.name; document.getElementById('dlgRole').textContent = o.role || '';
    document.getElementById('dlgSigil').style.background = o.color || '#c9a24a';
    const txt = document.getElementById('dlgText'), opts = document.getElementById('dlgOpts'); opts.innerHTML = ''; txt.textContent = '';
    let i = 0; const full = o.text; clearInterval(this.tw);
    const showOpts = () => { opts.innerHTML = ''; (o.options || []).forEach((op, k) => { const b = document.createElement('button'); b.className = 'dlg-opt' + (k === 0 ? ' primary' : ''); b.innerHTML = `<span class="key">${k + 1}</span>${op.label}`; b.onclick = () => { G.sfx('click'); op.fn(); }; opts.appendChild(b); }); };
    this.tw = setInterval(() => { i += 2; txt.textContent = full.slice(0, i); if (i % 6 === 0) G.sfx('click', 0.15); if (i >= full.length) { clearInterval(this.tw); showOpts(); } }, 22);
    this.skip = () => { if (txt.textContent.length < full.length) { clearInterval(this.tw); txt.textContent = full; showOpts(); } };
  },
  close(relock = true) { clearInterval(this.tw); document.getElementById('dialog').hidden = true; this.o = null; if (relock) G.ui.lockSoon(); },
  isOpen() { return !!this.o; }
};
addEventListener('keydown', e => {
  if (!G.dialog.o) return;
  if (e.code === 'Space' || e.code === 'KeyE') { G.dialog.skip && G.dialog.skip(); }
  const n = parseInt(e.key); if (n >= 1 && n <= 4) { const b = document.querySelectorAll('#dlgOpts .dlg-opt')[n - 1]; if (b) b.click(); }
});

// NPC roll bonus: Charisma modifier + shrine fortune + Bone Dice
G.npcBonus = () => { const P = G.player; return G.sheet.mod(P, 'CHA') + G.save.luckLv + (P.relics.includes('bonedice') ? 1 : 0) - (P.hex || 0); };
G.npcTalk = (npc) => {
  const d = npc.def, P = G.player, me = G.net.myId();
  if (npc.used[me]) { G.dialog.open({ name: d.name, role: d.role, voice: d.model, at: npc.x !== undefined ? new G.V3(npc.x, 0, npc.z) : null, text: 'You have had your due from me, wanderer. Fortune does not smile twice in one breath.', options: [{ label: 'Farewell', fn: () => G.dialog.close() }] }); return; }
  G.sfx('portal', 0.3);
  const b = G.npcBonus(), parts = [`CHA ${G.fmt(G.sheet.mod(P, 'CHA'))}`]; if (G.save.luckLv) parts.push(`fortune +${G.save.luckLv}`); if (P.relics.includes('bonedice')) parts.push('Bone Dice +1'); if (P.hex) parts.push(`curse −${P.hex}`);
  G.dialog.open({ name: d.name, role: d.role, voice: d.model, at: npc.x !== undefined ? new G.V3(npc.x, 0, npc.z) : null, text: G.pick(d.hello), options: [
    { label: `Roll the d20 <small style="opacity:.7">${G.fmt(b)}: ${parts.join(', ')}</small>`, fn: () => { G.dialog.close(false); npc.used[me] = true; G.dice.roll(b, (roll, nat) => nat === 1 && !P.relics.includes('coin') ? G.dice.fumble(d) : G.dice.offer(roll, nat, d)); } },
    { label: 'Not now', fn: () => G.dialog.close() }] });
};

G.dice = {
  init() {
    if (this.r) return;
    const c = document.getElementById('diceCanvas');
    this.r = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
    this.r.outputEncoding = THREE.sRGBEncoding; this.r.toneMapping = THREE.ACESFilmicToneMapping; this.r.setPixelRatio(Math.min(2, devicePixelRatio));
    this.scene = new THREE.Scene(); this.cam = new THREE.PerspectiveCamera(35, 1, 0.1, 100); this.cam.position.set(0, 0, 9);
    this.scene.add(new THREE.HemisphereLight(0xfff0d0, 0x302040, 0.9));
    const key = new THREE.DirectionalLight(0xffe0b0, 2.2); key.position.set(3, 5, 6); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x8060ff, 1.6); rim.position.set(-5, -2, -3); this.scene.add(rim);
    this.pl = new THREE.PointLight(0xffc060, 0, 10); this.pl.position.set(0, 0, 3); this.scene.add(this.pl);
    this.die = this.makeD20(); this.scene.add(this.die);
    // sparkle ring
    const g = new THREE.BufferGeometry(), n = 120, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, rr = 1.6 + Math.random() * 0.8; p[i * 3] = Math.cos(a) * rr; p[i * 3 + 1] = Math.sin(a) * rr; p[i * 3 + 2] = (Math.random() - 0.5); } g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.spark = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.12, map: G.tex.sprite('spark'), color: 0xffd060, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); this.scene.add(this.spark);
    // icon scene
    this.iconScene = new THREE.Scene(); this.iconScene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 1.2)); const il = new THREE.DirectionalLight(0xffffff, 1.5); il.position.set(2, 3, 4); this.iconScene.add(il);
    this.iconCam = new THREE.PerspectiveCamera(30, 1, 0.01, 20); this.icons = {};
  },
  makeD20() {
    const geo = new THREE.IcosahedronGeometry(1.3, 0); // non-indexed: 20 faces
    const cols = 5, rows = 4, W = 1280, H = 1024, cw = W / cols, ch = H / rows;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
    const ev = document.createElement('canvas'); ev.width = W; ev.height = H; const ex = ev.getContext('2d'); ex.fillStyle = '#000'; ex.fillRect(0, 0, W, H);
    const uv = geo.attributes.uv, pad = 0.06;
    this.faceTop = [];
    for (let f = 0; f < 20; f++) {
      const cx = (f % cols) * cw, cy = Math.floor(f / cols) * ch;
      // gem gradient face
      const gr = x.createLinearGradient(cx, cy, cx + cw, cy + ch); gr.addColorStop(0, '#5a1a8a'); gr.addColorStop(0.5, '#2a0a4a'); gr.addColorStop(1, '#16052a');
      x.fillStyle = gr; x.fillRect(cx, cy, cw, ch);
      // inner bevel triangle
      const ax = cx + cw / 2, ay = cy + ch * pad, bx = cx + cw * pad, by = cy + ch * (1 - pad), qx = cx + cw * (1 - pad);
      x.strokeStyle = 'rgba(255,210,120,0.55)'; x.lineWidth = 6; x.beginPath(); x.moveTo(ax, ay + 18); x.lineTo(bx + 24, by - 10); x.lineTo(qx - 24, by - 10); x.closePath(); x.stroke();
      const num = String(f + 1); const fs = num.length > 1 ? ch * 0.36 : ch * 0.42;
      [x, ex].forEach((g, k) => { g.font = `700 ${fs}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = k ? '#ffd890' : '#ffe2a8'; g.fillText(num, cx + cw / 2, cy + ch * 0.6); if (num === '6' || num === '9') g.fillRect(cx + cw / 2 - fs * 0.22, cy + ch * 0.6 + fs * 0.42, fs * 0.44, 8); });
      // UVs: v0 apex, v1 bottom-left, v2 bottom-right
      const u = (px) => px / W, v = (py) => 1 - py / H;
      uv.setXY(f * 3, u(ax), v(ay)); uv.setXY(f * 3 + 1, u(bx), v(by)); uv.setXY(f * 3 + 2, u(qx), v(by));
    }
    uv.needsUpdate = true;
    const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 8;
    const etex = new THREE.CanvasTexture(ev); etex.encoding = THREE.sRGBEncoding;
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: etex, emissive: 0xffb040, emissiveIntensity: 0.9, roughness: 0.18, metalness: 0.35, flatShading: true });
    const die = new THREE.Mesh(geo, mat);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xffc860 })); die.add(edges);
    // face data
    const p = geo.attributes.position; this.faces = [];
    for (let f = 0; f < 20; f++) { const a = new G.V3().fromBufferAttribute(p, f * 3), b = new G.V3().fromBufferAttribute(p, f * 3 + 1), c = new G.V3().fromBufferAttribute(p, f * 3 + 2); const n = a.clone().add(b).add(c).normalize(); this.faces.push({ n, apex: a.clone() }); }
    this.dieMat = mat; return die;
  },
  targetQuat(f) {
    const F = this.faces[f], q1 = new THREE.Quaternion().setFromUnitVectors(F.n, new G.V3(0, 0, 1));
    const ap = F.apex.clone().applyQuaternion(q1); const ang = Math.atan2(ap.x, ap.y);
    const q2 = new THREE.Quaternion().setFromAxisAngle(new G.V3(0, 0, 1), ang); return q2.multiply(q1);
  },
  roll(bonus, cb) {
    const nat = 1 + Math.floor(Math.random() * 20), total = G.clamp(nat + (bonus || 0), 1, 20);
    document.getElementById('diceTitle').textContent = 'The bones are cast';
    this.animate(nat, () => this.settle(nat, total, cb));
  },
  // active ability check / saving throw with the spinning die
  check(o, cb) {
    const P = G.player, res = G.sheet.resolve(P, o), ab = o.ab || G.SKILLS[o.skill];
    document.getElementById('diceTitle').textContent = o.title || `${o.skill || G.AB_NAME[ab] + (o.save ? ' saving throw' : ' check')} · DC ${res.dc}`;
    const shown = res.coin ? 1 : res.nat;
    this.animate(res.rerolled ? res.nat : shown, () => {
      const ov = document.getElementById('diceOverlay'), col = res.success ? '#57d26a' : '#e0503a';
      ov.classList.add('settled'); ov.style.setProperty('--tier', col);
      document.getElementById('diceResult').textContent = `${res.total}`;
      const advTxt = res.rolls.length > 1 ? `${res.adv ? 'Advantage' : 'Disadvantage'}: rolled ${res.rolls.join(' and ')}, kept ${res.nat}. ` : '';
      document.getElementById('diceTier').textContent = res.nat20 ? 'NATURAL 20 · CRITICAL SUCCESS' : res.nat1 ? 'NATURAL 1 · CRITICAL FAILURE' : res.success ? 'SUCCESS' : 'FAILURE';
      document.getElementById('diceQuote').textContent = `${advTxt}${res.coin ? 'The Two-Headed Coin turns your 1 into a 10. ' : ''}${res.rerolled ? res.rerolled + ' rerolled a failure. ' : ''}d20 ${res.nat} ${res.bonus >= 0 ? '+' : '−'} ${Math.abs(res.bonus)} = ${res.total} against DC ${res.dc}`;
      G.sfx(res.nat20 ? 'crit20' : res.success ? 'level' : 'groan', res.success ? 1 : 0.6);
      if (res.nat20) G.dm.say(G.pick(G.DM_LINES.nat20)); else if (res.nat1) G.dm.say(G.pick(G.DM_LINES.nat1));
      const box = document.getElementById('diceCards'); box.innerHTML = ''; const b = document.createElement('button'); b.className = 'btn small'; b.textContent = 'Continue'; box.appendChild(b);
      let done = false; const fin = () => { if (done) return; done = true; this.close(true); cb && cb(res); };
      b.onclick = fin; this.autoT = setTimeout(fin, 3200);
    });
    return res;
  },
  animate(nat, onSettle) {
    this.init(); G.ui.releasePointer(); clearTimeout(this.autoT);
    const ov = document.getElementById('diceOverlay'); ov.hidden = false; ov.classList.remove('settled');
    document.getElementById('diceResult').textContent = ''; document.getElementById('diceTier').textContent = ''; document.getElementById('diceCards').innerHTML = ''; document.getElementById('diceQuote').textContent = '';
    const w = innerWidth, h = innerHeight; this.r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
    const tq = this.targetQuat(nat - 1), q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
    const av = new G.V3(8 + Math.random() * 6, 6 + Math.random() * 6, 4 + Math.random() * 4);
    const t0 = performance.now(), D1 = 1.7, D2 = 0.55; let last = t0;
    G.sfx('dice', 1);
    const tick = (now) => {
      const t = (now - t0) / 1000, dt = (now - last) / 1000; last = now;
      const die = this.die;
      if (t < D1) {
        const k = t / D1, bounce = Math.abs(Math.sin(k * Math.PI * 3.2)) * (1 - k) * 2.2;
        die.position.set(G.lerp(-4.5, 0, G.smooth(k)), -2.2 + bounce + k * 2.2, G.lerp(-2, 0, k));
        const damp = (1 - k) * (1 - k); q0.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(av.x * dt * damp, av.y * dt * damp, av.z * dt * damp)));
        die.quaternion.copy(q0); if (Math.abs(Math.sin(k * Math.PI * 3.2)) < 0.08 && Math.random() < 0.5) G.sfx('diceland', 0.4);
      } else {
        const k = G.smooth(Math.min(1, (t - D1) / D2)); die.quaternion.copy(q0).slerp(tq, k); die.position.set(0, 0, 0);
        const s = 1 + Math.sin(Math.min(1, (t - D1) / D2) * Math.PI) * 0.15; die.scale.setScalar(s);
      }
      this.spark.rotation.z += dt * 0.6; this.spark.material.opacity = t > D1 ? Math.min(1, (t - D1) * 2) : 0;
      this.pl.intensity = t > D1 ? 3 + Math.sin(t * 6) : 0;
      this.dieMat.emissiveIntensity = 0.7 + (t > D1 + D2 ? 0.4 + Math.sin(t * 5) * 0.2 : 0);
      this.r.render(this.scene, this.cam);
      if (t < D1 + D2 + 0.1) this.raf = requestAnimationFrame(tick);
      else { this.raf = requestAnimationFrame(idle); onSettle(); }
    };
    const idle = (now) => { this.die.position.y = G.lerp(this.die.position.y, 1.55, 0.06); this.die.scale.setScalar(G.lerp(this.die.scale.x, 0.62, 0.06)); this.spark.position.y = this.die.position.y; this.die.rotation.z = Math.sin(now / 900) * 0.04; this.spark.rotation.z += 0.01; this.r.render(this.scene, this.cam); if (!ov.hidden) this.raf = requestAnimationFrame(idle); };
    this.die.scale.setScalar(1); this.spark.position.y = 0;
    cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(tick);
  },
  settle(nat, total, cb) {
    const tier = G.tierOf(total), T = G.TIERS[tier], ov = document.getElementById('diceOverlay'); if (nat === 1 && !G.player.relics.includes('coin')) { ov.classList.add('settled'); ov.style.setProperty('--tier', '#e0503a'); document.getElementById('diceResult').textContent = '1'; document.getElementById('diceTier').textContent = 'NATURAL 1 · CRITICAL FAIL'; G.sfx('groan', 1); setTimeout(() => cb(total, nat), 900); return; }
    ov.classList.add('settled'); ov.style.setProperty('--tier', T.color);
    document.getElementById('diceResult').textContent = total + (total !== nat ? `  (${nat} + ${total - nat})` : '');
    document.getElementById('diceTier').textContent = (nat === 20 ? 'NATURAL 20 · ' : nat === 1 ? 'CRITICAL FAIL · ' : '') + T.name;
    G.sfx(nat === 20 ? 'crit20' : tier >= 2 ? 'level' : 'diceland', 1);
    setTimeout(() => cb(total, nat), 700);
  },
  offer(roll, nat, npc) {
    const P = G.player, tier = G.tierOf(roll), pool = G.UPGRADES.filter(u => u.t === tier && (!u.cls || u.cls.includes(P.cls)));
    const pref = G.shuffle(pool.filter(u => npc.cat.includes(u.cat))), rest = G.shuffle(pool.filter(u => !npc.cat.includes(u.cat)));
    const n = nat === 20 ? 4 : 3, picks = [];
    pref.slice(0, 2).forEach(u => picks.push(u)); for (const u of rest.concat(pref.slice(2))) { if (picks.length >= n) break; if (!picks.includes(u)) picks.push(u); }
    { const q = nat === 20 ? npc.legend : tier >= 2 ? npc.good : npc.bad; document.getElementById('diceQuote').textContent = `${npc.name}: “${q}”`; if (G.voice && npc.model) G.voice.say(q, npc.model, { prio: 'npc', key: 'dlg' }); }
    const box = document.getElementById('diceCards'); box.innerHTML = '';
    picks.forEach((u, i) => {
      const T = G.TIERS[u.t], c = document.createElement('button'); c.className = 'card'; c.style.setProperty('--tc', T.color); c.style.animationDelay = (i * 0.09) + 's';
      c.innerHTML = `<div class="card-tier">${T.name}</div><div class="card-icon">${u.icon}</div><div class="card-name">${u.name}</div><div class="card-desc">${u.desc}</div><div class="card-cat">${{ off: 'Offense', def: 'Defense', mag: 'Arcane', util: 'Utility' }[u.cat]}</div>`;
      c.onclick = () => { G.sfx('level', 1); G.game.applyUpgrade(u); this.close(); G.ui.toast(`${u.name} acquired`); };
      box.appendChild(c);
    });
  },
  // natural 1 at an NPC: something goes wrong
  fumble(npc) {
    const P = G.player, k = G.pick(['ambush', 'cursed', 'robbed']);
    G.dm.say(G.pick(G.DM_LINES.nat1));
    if (k === 'robbed' && P.runGold < 20) return this.fumbleAmbush(npc);
    if (k === 'ambush') return this.fumbleAmbush(npc);
    if (k === 'robbed') { const lost = Math.ceil(P.runGold * 0.3); P.runGold -= lost; document.getElementById('diceQuote').textContent = `${npc.name}: "Fortune's a fickle thing." Your purse feels lighter. You lost ${lost} gold.`; G.sfx('coin', 0.5); this.continueBtn(); return; }
    this.offerCursed(`${npc.name}: "The bones have turned on you. Only dark bargains remain."`, true);
  },
  fumbleAmbush(npc) {
    document.getElementById('diceQuote').textContent = `${npc.name} recoils from the roll. "You've brought death with you!" Shapes move in the dark.`;
    this.continueBtn(() => { const P = G.player, dg = G.DUNGEONS[G.run.dungeon]; G.game.ambush(P.pos.x, P.pos.z, [G.pick(dg.enemies.slice(0, 3)), G.pick(dg.enemies.slice(0, 3)), G.pick(dg.enemies.slice(0, 4))], false); });
  },
  continueBtn(fn) { const box = document.getElementById('diceCards'); box.innerHTML = ''; const b = document.createElement('button'); b.className = 'btn small'; b.textContent = 'Continue'; b.onclick = () => { this.close(); fn && fn(); }; box.appendChild(b); },
  // a choice between cursed boons (or walking away)
  offerCursed(quote, inOverlay) {
    if (!inOverlay) { this.init(); G.ui.releasePointer(); const ov = document.getElementById('diceOverlay'); ov.hidden = false; ov.classList.add('settled'); ov.style.setProperty('--tier', '#c040ff'); document.getElementById('diceTitle').textContent = 'A dark bargain'; document.getElementById('diceResult').textContent = ''; document.getElementById('diceTier').textContent = 'CURSED BOONS'; this.die.position.set(0, 1.55, 0); this.die.scale.setScalar(0.62); this.r.render(this.scene, this.cam); }
    document.getElementById('diceQuote').textContent = quote;
    const box = document.getElementById('diceCards'); box.innerHTML = '';
    G.shuffle(G.CURSED.slice()).slice(0, 2).forEach((u, i) => {
      const c = document.createElement('button'); c.className = 'card'; c.style.setProperty('--tc', '#c040ff'); c.style.animationDelay = (i * 0.09) + 's';
      c.innerHTML = `<div class="card-tier">Cursed</div><div class="card-icon">${u.icon}</div><div class="card-name">${u.name}</div><div class="card-desc">${u.desc}</div><div class="card-cat">Power at a price</div>`;
      c.onclick = () => { G.sfx('groan', 0.8); G.game.applyUpgrade(Object.assign({}, u, { t: -1 })); this.close(); G.ui.toast(`${u.name} binds to you`); };
      box.appendChild(c);
    });
    const no = document.createElement('button'); no.className = 'card'; no.style.setProperty('--tc', '#6a6070'); no.innerHTML = '<div class="card-tier">Refuse</div><div class="card-icon">✋</div><div class="card-name">Walk Away</div><div class="card-desc">Take nothing. Keep your soul.</div>'; no.onclick = () => this.close(); box.appendChild(no);
  },
  close(keepLock) { cancelAnimationFrame(this.raf); clearTimeout(this.autoT); document.getElementById('diceOverlay').hidden = true; if (!keepLock) G.ui.lockSoon(); },
  isOpen() { return !document.getElementById('diceOverlay').hidden; },
  icon(model, v) {
    this.init(); const key = model + (v || 0); if (this.icons[key]) return this.icons[key];
    const obj = M.loot[model](v); this.iconScene.add(obj);
    const box = new THREE.Box3().setFromObject(obj), c = box.getCenter(new G.V3()), s = box.getSize(new G.V3()).length();
    this.iconCam.position.set(c.x + s * 0.9, c.y + s * 0.8, c.z + s * 1.6); this.iconCam.lookAt(c);
    obj.rotation.y = 0.5; this.r.setSize(96, 96, false); this.r.setClearColor(0x000000, 0); this.r.render(this.iconScene, this.iconCam);
    const url = this.r.domElement.toDataURL(); this.iconScene.remove(obj); this.icons[key] = url; return url;
  }
};
