/* ============================================================
   Audio v3
   - true 3D: every positioned sound plays through a panner around a listener that follows the camera,
     and is muffled + hollow (lowpass, resonant bump, more reverb) when there is no line of sight
   - punchier combat: layered whooshes with air and body, hits with a transient crack, a body thump
     and saturation, crits with an extra slam
   - new sounds: goblin cackles, portal whoosh + hum, door creaks and slams, stone grinding, lava
   - looping positional beds (portals, lava pools), spooky ambient beds and procedural boss music
   ============================================================ */
'use strict';
(() => {
  const A = G.audio, R = Math.random;
  /* ---------------- listener & spatial helpers ---------------- */
  A.setPos = function (node, x, y, z, snap) {
    const t = this.ctx.currentTime;
    if (node.positionX) { if (snap) { node.positionX.value = x; node.positionY.value = y; node.positionZ.value = z; } else { node.positionX.setTargetAtTime(x, t, 0.04); node.positionY.setTargetAtTime(y, t, 0.04); node.positionZ.setTargetAtTime(z, t, 0.04); } }
    else node.setPosition(x, y, z);
  };
  A.updateListener = function () {
    if (!this.ctx || !G.camera) return; const L = this.ctx.listener, cam = G.camera, p = cam.position, f = new G.V3(0, 0, -1).applyQuaternion(cam.quaternion), u = new G.V3(0, 1, 0).applyQuaternion(cam.quaternion), t = this.ctx.currentTime;
    if (L.positionX) { L.positionX.setTargetAtTime(p.x, t, 0.02); L.positionY.setTargetAtTime(p.y, t, 0.02); L.positionZ.setTargetAtTime(p.z, t, 0.02); L.forwardX.setTargetAtTime(f.x, t, 0.02); L.forwardY.setTargetAtTime(f.y, t, 0.02); L.forwardZ.setTargetAtTime(f.z, t, 0.02); L.upX.setTargetAtTime(u.x, t, 0.02); L.upY.setTargetAtTime(u.y, t, 0.02); L.upZ.setTargetAtTime(u.z, t, 0.02); }
    else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z); }
  };
  // is there a wall between the listener and this point?
  A.occluded = function (x, z) {
    const W = G.World; if (!W || !W.W || !W.los || !G.camera) return false;
    const c = G.camera.position; if (Math.hypot(c.x - x, c.z - z) < 1.2) return false;
    return !W.los(c.x, c.z, x, z);
  };
  // every positioned one-shot: [voice gain] -> occlusion lowpass -> hollow bump -> distance air loss -> 3D panner -> sfx bus
  A.bus = function (vol, pos) {
    const c = this.ctx, g = c.createGain(); g.gain.value = vol;
    if (pos && G.camera) {
      const cp = G.camera.position, d = Math.hypot(pos.x - cp.x, pos.z - cp.z), occ = this.occluded(pos.x, pos.z);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = occ ? 560 : 18000 * G.clamp(1.15 - d / 34, 0.08, 1); lp.Q.value = 0.6;
      const hol = c.createBiquadFilter(); hol.type = 'peaking'; hol.frequency.value = 360; hol.Q.value = 1.5; hol.gain.value = occ ? 7 : 0;
      const pan = c.createPanner(); pan.panningModel = this.voices < 28 ? 'HRTF' : 'equalpower'; pan.distanceModel = 'linear'; pan.rolloffFactor = 0; pan.refDistance = 1; pan.maxDistance = 1000;
      this.setPos(pan, pos.x, (pos.y || 0) + 1.0, pos.z, true);
      if (occ) g.gain.value = vol * 0.62;
      g.connect(lp); lp.connect(hol); hol.connect(pan); pan.connect(this.sfxBus);
      if (occ) { const s = c.createGain(); s.gain.value = 0.55; hol.connect(s); s.connect(this.verb); }
    } else g.connect(this.sfxBus);
    this.voices++; setTimeout(() => { try { g.disconnect(); } catch (e) { } this.voices--; }, 4000);
    return g;
  };
  // soft-clip stage for hits: grit and loudness without clipping the mix
  A.grit = function (o, k = 2.2) { const c = this.ctx; if (!this._gc) { const n = 512, cur = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; cur[i] = Math.tanh(x * 2.6) / Math.tanh(2.6); } this._gc = cur; } const ws = c.createWaveShaper(); ws.curve = this._gc; const pg = c.createGain(); pg.gain.value = k; pg.connect(ws); const post = c.createGain(); post.gain.value = 1 / Math.sqrt(k); ws.connect(post); post.connect(o); return pg; };
  // a brief dip of the music and beds under a big hit
  A.duck = function (amt = 0.5, dur = 0.18) { if (!this.musicBus) return; const t = this.ctx.currentTime, g = this.musicBus.gain, base = G.settings.music; g.cancelScheduledValues(t); g.setValueAtTime(base * amt, t); g.setTargetAtTime(base, t + 0.02, dur); };
  // swept 'whoosh': band of noise that rises then falls, with an airy whistle and a little body
  A.whoosh = function (o, t, dur, lo, hi, vol, body) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.6;
    f.frequency.setValueAtTime(lo, t); f.frequency.exponentialRampToValueAtTime(hi, t + dur * 0.45); f.frequency.exponentialRampToValueAtTime(lo * 0.8, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(o); s.start(t, R() * 1.5); s.stop(t + dur + 0.05);
    this.osc(o, t + dur * 0.25, hi * 0.45, hi * 0.22, dur * 0.5, vol * 0.06, 'sine', dur * 0.15);
    if (body) this.osc(o, t, body, body * 0.6, dur * 0.8, vol * 0.35, 'sine', dur * 0.3);
  };
  // stick-slip friction (door hinges): a sawtooth whose pitch stutters, through two resonances
  A.creak = function (o, t, dur, f0, vol) {
    const c = this.ctx, s = c.createOscillator(); s.type = 'sawtooth'; let tt = t; s.frequency.setValueAtTime(f0, t);
    while (tt < t + dur) { tt += 0.03 + R() * 0.07; s.frequency.linearRampToValueAtTime(f0 * (0.75 + R() * 0.6) * (1 + (tt - t) / dur * 0.3), tt); }
    const b1 = c.createBiquadFilter(); b1.type = 'bandpass'; b1.frequency.value = 900; b1.Q.value = 6; const b2 = c.createBiquadFilter(); b2.type = 'bandpass'; b2.frequency.value = 2300; b2.Q.value = 9;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.08); g.gain.setValueAtTime(vol, t + dur - 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const am = c.createGain(); am.gain.value = 0.6; const lfo = c.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 14 + R() * 10; const lg = c.createGain(); lg.gain.value = 0.4; lfo.connect(lg); lg.connect(am.gain);
    s.connect(b1); s.connect(b2); b1.connect(am); b2.connect(am); am.connect(g); g.connect(o); s.start(t); lfo.start(t); s.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  };

  /* ---------------- the new and replaced sounds ---------------- */
  const S = {
    swing(o, t) { this.whoosh(o, t, 0.24, 420, 3200, 0.75, 120); },
    swingfast(o, t) { this.whoosh(o, t, 0.15, 700, 4800, 0.6); },
    heavy(o, t) { this.whoosh(o, t, 0.42, 170, 1500, 0.95, 70); this.nz(o, t + 0.1, 0.3, 120, 60, 1, 0.3, 'lowpass', 0.08); },
    slice(o, t) { const q = this.grit(o, 2); this.nz(q, t, 0.006, 9000, 7000, 0.7, 1.0, 'highpass', 0.0003); this.nz(q, t, 0.11, 5200, 1200, 2.4, 0.6); this.nz(q, t + 0.012, 0.2, 1100, 200, 1.1, 0.55, 'lowpass'); this.osc(q, t, 160, 55, 0.14, 0.55, 'sine', 0.001); },
    flesh(o, t) { const q = this.grit(o, 2.6); this.osc(q, t, 190, 42, 0.17, 1.1, 'sine', 0.0015); this.nz(q, t, 0.22, 900, 160, 1, 0.7, 'lowpass'); this.nz(q, t, 0.01, 3500, 2200, 1, 0.7, 'bandpass', 0.0005); this.crackle(q, t, 0.05, 4, 0.25, 1500); this.duck(0.7, 0.12); },
    thump(o, t) { const q = this.grit(o, 3); this.osc(q, t, 150, 34, 0.32, 1.25, 'sine', 0.0015); this.nz(q, t, 0.008, 6000, 4000, 1, 0.8, 'highpass', 0.0003); this.nz(q, t, 0.2, 700, 140, 1, 0.75, 'lowpass'); this.crackle(q, t, 0.07, 6, 0.35, 1600); this.duck(0.6, 0.16); },
    bonehit(o, t) { const q = this.grit(o, 2); for (let i = 0; i < 5; i++) this.clack(q, t + i * 0.016 + R() * 0.018, 1300 + R() * 1700, 0.65 * (1 - i * 0.15)); this.osc(q, t, 260, 100, 0.08, 0.6, 'sine', 0.001); this.nz(q, t, 0.005, 8000, 6000, 1, 0.8, 'highpass', 0.0003); },
    stonehit(o, t) { const q = this.grit(o, 2.4); this.osc(q, t, 230, 60, 0.18, 1.0, 'sine', 0.001); this.nz(q, t, 0.14, 1800, 500, 1.4, 0.7); this.crackle(q, t, 0.18, 14, 0.4, 2400); this.nz(q, t, 0.005, 9000, 6000, 1, 0.8, 'highpass', 0.0003); },
    hitcrit(o, t) { const q = this.grit(o, 3.4); this.osc(q, t, 120, 30, 0.45, 1.3, 'sine', 0.001); this.nz(q, t, 0.35, 2400, 90, 0.7, 0.9, 'lowpass', 0.001); this.ring(q, t + 0.01, 1900 + R() * 400, [[1, 0.5, 0.5], [2.6, 0.3, 0.3]], 0.12); this.duck(0.4, 0.25); },
    cackle(o, t) {   // heh-heh-heh-HEH: pitch-jumping nasal syllables
      const n = 4 + Math.floor(R() * 3), base = 380 + R() * 120;
      for (let i = 0; i < n; i++) { const tt = t + i * (0.11 + R() * 0.03), f = base * (1 + (i % 2) * 0.12 + (i === n - 1 ? 0.35 : 0)); const g = this.voice(o, tt, f, f * 0.82, 0.075 + (i === n - 1 ? 0.12 : 0), 0.32, 1500 + R() * 400); this.nz(o, tt, 0.05, 3500, 2500, 3, 0.12, 'bandpass', 0.004); }
    },
    goblinhurt(o, t) { this.voice(o, t, 620 + R() * 120, 380, 0.22, 0.4, 1700); },
    portalwhoosh(o, t) {   // a rising swirl with shimmer and a soft sub swell
      const c = this.ctx; for (let k = 0; k < 3; k++) this.osc(o, t + k * 0.05, 90 * (k + 1), 360 * (k + 1), 1.6, 0.11 / (k + 1), k ? 'triangle' : 'sine', 0.35);
      const s = c.createBufferSource(); s.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 5; const lfo = c.createOscillator(); lfo.frequency.value = 5; const lg = c.createGain(); lg.gain.value = 900; lfo.connect(lg); lg.connect(f.frequency); f.frequency.setValueAtTime(600, t); f.frequency.linearRampToValueAtTime(3200, t + 1.5);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.35, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8); s.connect(f); f.connect(g); g.connect(o); s.start(t); lfo.start(t); s.stop(t + 1.9); lfo.stop(t + 1.9);
      for (let i = 0; i < 10; i++) this.osc(o, t + 0.3 + R() * 1.2, 2400 + R() * 3000, 3000 + R() * 2000, 0.25, 0.025, 'sine', 0.02);
      this.osc(o, t, 45, 70, 1.6, 0.35, 'sine', 0.4);
    },
    creak(o, t) { this.creak(o, t, 0.9 + R() * 0.4, 70 + R() * 40, 0.3); this.thump(o, t + 0.05, 140, 80, 0.1, 0.25); },
    dooropen(o, t) { this.creak(o, t, 1.1, 80 + R() * 30, 0.32); this.clack(o, t, 2200, 0.4); this.thump(o, t + 1.05, 120, 60, 0.15, 0.4); },
    bigdoor(o, t) { this.creak(o, t, 2.6, 55, 0.4); this.creak(o, t + 0.3, 2.0, 38, 0.3); this.nz(o, t, 2.6, 160, 70, 1.5, 0.6, 'lowpass', 0.4); this.osc(o, t, 38, 30, 2.6, 0.4, 'sine', 0.6); for (let i = 0; i < 6; i++) this.clack(o, t + 0.2 + i * 0.4 + R() * 0.1, 900 + R() * 600, 0.15); },
    doorslam(o, t) { const q = this.grit(o, 3.2); this.osc(q, t, 85, 24, 1.5, 1.4, 'sine', 0.001); this.nz(q, t, 1.2, 1400, 70, 0.8, 1.0, 'lowpass', 0.001); this.nz(q, t, 0.01, 7000, 4000, 1, 0.9, 'highpass', 0.0003); this.ring(q, t, 150, [[1, 1, 1.8], [2.4, 0.5, 1.0], [3.9, 0.25, 0.6]], 0.14); for (let i = 0; i < 8; i++) this.clack(q, t + 0.05 + R() * 0.5, 600 + R() * 900, 0.25); this.duck(0.25, 0.6); if (G.fx) G.fx.shake(0.25); },
    stonegrind(o, t) { this.nz(o, t, 1.4, 260, 120, 3, 0.5, 'bandpass', 0.15); this.crackle(o, t, 1.3, 40, 0.25, 900); this.osc(o, t, 48, 40, 1.4, 0.25, 'sawtooth', 0.2); },
    lavapop(o, t) { const f = 110 + R() * 120; this.osc(o, t, f, f * 0.45, 0.16 + R() * 0.1, 0.5, 'sine', 0.004); this.nz(o, t, 0.08, 900, 300, 2, 0.25, 'lowpass', 0.002); if (R() < 0.4) this.crackle(o, t + 0.04, 0.12, 5, 0.2, 2600); },
    bubble(o, t) { const f = 220 + R() * 300; this.osc(o, t, f, f * 2.2, 0.07, 0.3, 'sine', 0.003); }
  };
  const base = A.play;
  A.play = function (name, vol = 1, pos) {
    const fn = S[name]; if (!fn) return base.call(this, name, vol, pos);
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (pos && G.camera) { const cp = G.camera.position, d = Math.hypot(pos.x - cp.x, pos.z - cp.z); vol *= G.clamp(1.25 - d / 32, 0, 1); if (vol < 0.03) return; }
    const now = this.ctx.currentTime; if (this.last[name] && now - this.last[name] < 0.025) return; this.last[name] = now; if (this.voices > 80) return;
    fn.call(this, this.bus(vol, pos), now + 0.005);
  };

  /* ---------------- looping positional beds: portals hum, lava burbles ---------------- */
  A.loops = {};
  A.loopBed = function (id, kind, pos, maxD) {
    const c = this.ctx, L = { id, kind, pos, maxD, nodes: [] }, out = c.createGain(); out.gain.value = 0;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 16000; const hol = c.createBiquadFilter(); hol.type = 'peaking'; hol.frequency.value = 360; hol.Q.value = 1.5;
    const pan = c.createPanner(); pan.panningModel = 'HRTF'; pan.distanceModel = 'linear'; pan.rolloffFactor = 0; this.setPos(pan, pos.x, 1.2, pos.z, true);
    out.connect(lp); lp.connect(hol); hol.connect(pan); pan.connect(this.sfxBus); Object.assign(L, { out, lp, hol, pan });
    if (kind === 'portal') {
      [55, 82.5, 110.5].forEach((f, i) => { const o = c.createOscillator(); o.type = i ? 'triangle' : 'sine'; o.frequency.value = f; const g = c.createGain(); g.gain.value = [0.22, 0.08, 0.06][i]; const l = c.createOscillator(); l.frequency.value = 0.3 + i * 0.21; const lg = c.createGain(); lg.gain.value = g.gain.value * 0.6; l.connect(lg); lg.connect(g.gain); o.connect(g); g.connect(out); o.start(); l.start(); L.nodes.push(o, l); });
      const n = c.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 4; const l = c.createOscillator(); l.frequency.value = 0.7; const lg = c.createGain(); lg.gain.value = 700; l.connect(lg); lg.connect(bp.frequency); const ng = c.createGain(); ng.gain.value = 0.12; n.connect(bp); bp.connect(ng); ng.connect(out); n.start(); l.start(); L.nodes.push(n, l);
    } else if (kind === 'lava') {
      const n = c.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180; const ng = c.createGain(); ng.gain.value = 0.55; n.connect(f); f.connect(ng); ng.connect(out); n.start(); L.nodes.push(n);
      const o = c.createOscillator(); o.frequency.value = 36; const og = c.createGain(); og.gain.value = 0.12; o.connect(og); og.connect(out); o.start(); L.nodes.push(o);
      L.popT = 0;
    }
    this.loops[id] = L; return L;
  };
  A.updateLoops = function (dt) {
    if (!this.ctx || this.ctx.state !== 'running' || !G.camera) return; const W = G.World, cp = G.camera.position, want = {};
    if (W.exitPortal) want['ep'] = ['portal', W.exitPortal, 18];
    if (W.theme === 'hideout') { const p = (W.interact || []).find(s => s.id === 'portal'); if (p) want['hp'] = ['portal', { x: p.x, z: p.z - 2 }, 18]; }
    (W.lava || []).forEach((L, i) => want['lava' + i] = ['lava', L, 16 + Math.max(L.w, L.d)]);
    for (const id in this.loops) if (!want[id] || want[id][1] !== this.loops[id].src) { const L = this.loops[id]; L.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2); setTimeout(() => L.nodes.forEach(n => { try { n.stop(); } catch (e) { } }), 900); delete this.loops[id]; }
    for (const id in want) {
      const [kind, src, maxD] = want[id], d = Math.hypot(src.x - cp.x, src.z - cp.z);
      let L = this.loops[id]; if (!L) { if (d > maxD) continue; L = this.loopBed(id, kind, { x: src.x, z: src.z }, maxD); L.src = src; }
      const occ = this.occluded(src.x, src.z), k = G.clamp(1 - d / maxD, 0, 1), t = this.ctx.currentTime;
      L.out.gain.setTargetAtTime(k * k * (occ ? 0.5 : 1) * (kind === 'lava' ? 0.9 : 0.8), t, 0.15); L.lp.frequency.setTargetAtTime(occ ? 520 : 16000, t, 0.1); L.hol.gain.setTargetAtTime(occ ? 6 : 0, t, 0.1);
      if (kind === 'lava' && k > 0) { L.popT -= dt; if (L.popT <= 0) { L.popT = 0.18 + R() * 0.55; const px = src.x + (R() - 0.5) * src.w * 1.6, pz = src.z + (R() - 0.5) * src.d * 1.6; G.sfx(R() < 0.7 ? 'lavapop' : 'bubble', 0.55 + R() * 0.4, new G.V3(px, 0, pz)); if (R() < 0.5 && G.fx) G.fx.emit(G.fx.add, px, 0.1, pz, 0, 1.5 + R(), 0, 0.5, 0.25, 0.05, [1.8, 0.6, 0.15, 1], [0.6, 0.1, 0, 0], 4); } }
    }
  };

  /* ---------------- spooky ambient beds ----------------
     continuous layers (drone, wind, furnace, hearth) plus scheduled events placed around the
     listener in 3D (choir swells, far bells, distant anvils, moans, plucked melody at the hideout) */
  const NOTE = (root, semi) => root * Math.pow(2, semi / 12);
  A.ambient = function (theme) {
    if (!this.ctx) return; const c = this.ctx;
    if (this.amb) { const a = this.amb; a.g.gain.setTargetAtTime(0.0001, c.currentTime, 0.8); setTimeout(() => a.nodes.forEach(n => { try { n.stop(); } catch (e) { } }), 3500); this.amb = null; }
    if (!theme) return;
    const g = c.createGain(); g.gain.value = 0.0001; g.connect(this.musicBus); const nodes = [];
    const root = { crypt: 36.7, warrens: 32.7, forge: 41.2, abyss: 30.9, hideout: 65.4, menu: 36.7 }[theme] || 36.7;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; lp.Q.value = 3; lp.connect(g);
    const sweep = c.createOscillator(); sweep.frequency.value = 0.031; const sg = c.createGain(); sg.gain.value = 120; sweep.connect(sg); sg.connect(lp.frequency); sweep.start(); nodes.push(sweep);
    // drone: detuned saws on root, fifth and a sour minor second up high, slowly breathing
    const drone = theme === 'hideout' ? [[1, 0.05], [1.5, 0.03]] : [[1, 0.12], [1.003, 0.1], [1.5, 0.06], [2, 0.05], [2.12, 0.018]];
    drone.forEach(([m, v]) => { const o = c.createOscillator(); o.type = theme === 'hideout' ? 'triangle' : 'sawtooth'; o.frequency.value = root * m; const og = c.createGain(); og.gain.value = v; const l = c.createOscillator(); l.frequency.value = 0.04 + R() * 0.09; const lg = c.createGain(); lg.gain.value = v * 0.7; l.connect(lg); lg.connect(og.gain); o.connect(og); og.connect(lp); o.start(); l.start(); nodes.push(o, l); });
    // a deep sub you feel more than hear
    { const o = c.createOscillator(); o.frequency.value = root / 2; const og = c.createGain(); og.gain.value = theme === 'hideout' ? 0.04 : 0.16; o.connect(og); og.connect(g); o.start(); nodes.push(o); }
    // wind / air: noise through a wandering band, gusting
    const wind = (fc, q, vol, rate) => { const n = c.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fc; bp.Q.value = q; const l = c.createOscillator(); l.frequency.value = rate; const lg = c.createGain(); lg.gain.value = fc * 0.6; l.connect(lg); lg.connect(bp.frequency); const ng = c.createGain(); ng.gain.value = vol; const l2 = c.createOscillator(); l2.frequency.value = rate * 1.7; const lg2 = c.createGain(); lg2.gain.value = vol * 0.8; l2.connect(lg2); lg2.connect(ng.gain); n.connect(bp); bp.connect(ng); ng.connect(g); n.start(R() * 2); l.start(); l2.start(); nodes.push(n, l, l2); };
    if (theme === 'crypt' || theme === 'menu') { wind(520, 6, 0.09, 0.07); wind(1300, 10, 0.03, 0.11); }
    if (theme === 'warrens') { wind(300, 3, 0.1, 0.05); wind(900, 8, 0.03, 0.13); }
    if (theme === 'forge') { const n = c.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; const ng = c.createGain(); ng.gain.value = 0.26; const l = c.createOscillator(); l.frequency.value = 0.18; const lg = c.createGain(); lg.gain.value = 0.12; l.connect(lg); lg.connect(ng.gain); n.connect(f); f.connect(ng); ng.connect(g); n.start(); l.start(); nodes.push(n, l); wind(1800, 4, 0.025, 0.2); }
    if (theme === 'hideout') { const n = c.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300; const ng = c.createGain(); ng.gain.value = 0.08; n.connect(f); f.connect(ng); ng.connect(g); n.start(); nodes.push(n); }
    g.gain.setTargetAtTime(1, c.currentTime, 2);
    this.amb = { g, nodes, theme, root, evT: 3 + R() * 4, pluckT: 2, step: 0 };
  };
  // a one-shot placed somewhere around the listener (dist m away), routed through the ambience bus
  A.ambOut = function (dist, vol) {
    const c = this.ctx, g = c.createGain(); g.gain.value = vol; const pan = c.createPanner(); pan.panningModel = 'HRTF'; pan.distanceModel = 'linear'; pan.rolloffFactor = 0;
    const cp = G.camera ? G.camera.position : { x: 0, y: 0, z: 0 }, a = R() * 6.283; this.setPos(pan, cp.x + Math.cos(a) * dist, cp.y + (R() - 0.3) * 3, cp.z + Math.sin(a) * dist, true);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; g.connect(lp); lp.connect(pan); pan.connect(this.amb.g); const s = c.createGain(); s.gain.value = 0.6; lp.connect(s); s.connect(this.verb);
    setTimeout(() => { try { g.disconnect(); s.disconnect(); } catch (e) { } }, 9000); return g;
  };
  // ghostly choir: saw chord through vowel formants, swelling in and out
  A.choir = function (o, t, root, chord, dur, vol, vowel = 'a') {
    const c = this.ctx, F = { a: [800, 1150, 2900], o: [450, 800, 2830], u: [325, 700, 2530], e: [400, 1600, 2700] }[vowel];
    const sum = c.createGain(); sum.gain.setValueAtTime(0.0001, t); sum.gain.linearRampToValueAtTime(vol, t + dur * 0.4); sum.gain.linearRampToValueAtTime(0.0001, t + dur);
    F.forEach((f, i) => { const b = c.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = 7; const bg = c.createGain(); bg.gain.value = [1, 0.5, 0.15][i]; sum.connect(b); b.connect(bg); bg.connect(o); });
    chord.forEach(semi => { for (let k = 0; k < 3; k++) { const s = c.createOscillator(); s.type = 'sawtooth'; s.frequency.value = NOTE(root, semi) * (1 + (k - 1) * 0.006); const vib = c.createOscillator(); vib.frequency.value = 4.5 + R(); const vg = c.createGain(); vg.gain.value = s.frequency.value * 0.006; vib.connect(vg); vg.connect(s.frequency); const sg = c.createGain(); sg.gain.value = 0.25 / chord.length; s.connect(sg); sg.connect(sum); s.start(t); vib.start(t); s.stop(t + dur + 0.1); vib.stop(t + dur + 0.1); } });
  };
  A.bell = function (o, t, f, vol) { this.ring(o, t, f, [[0.5, 0.6, 4.5], [1, 1, 3.5], [1.19, 0.5, 2.6], [1.5, 0.4, 2.2], [2, 0.35, 1.8], [2.74, 0.2, 1.2], [3.76, 0.12, 0.8]], vol); };
  A.pluck = function (o, t, f, vol) { this.osc(o, t, f, f, 1.4, vol, 'triangle', 0.002); this.osc(o, t, f * 2, f * 2, 0.5, vol * 0.3, 'sine', 0.001); this.osc(o, t, f * 3.01, f * 3, 0.25, vol * 0.12, 'sine', 0.001); };
  A.ambTick = function (dt) {
    const a = this.amb; if (!a || !this.ctx || this.ctx.state !== 'running') return; const t = this.ctx.currentTime + 0.05, th = a.theme;
    if (this.boss && this.boss.on) return;            // the boss score owns the room
    if (th === 'hideout') {                           // a slow pentatonic lute line by the hearth
      a.pluckT -= dt; if (a.pluckT <= 0) { const sc = [0, 3, 5, 7, 10, 12, 15], ph = [0, 2, 4, 3, 1, 2, 0, 5, 4, 2, 3, 1]; const n = sc[ph[a.step % ph.length]] + (a.step % 24 > 11 ? 0 : 0); this.pluck(this.ambOut(4, 0.35), t, NOTE(a.root * 2, n), 0.22); if (a.step % 4 === 0) this.pluck(this.ambOut(4, 0.3), t, NOTE(a.root, [0, 5, 3, 7][(a.step / 4 | 0) % 4]), 0.18); a.step++; a.pluckT = a.step % 12 === 0 ? 3.5 : 0.62 + (a.step % 3 === 0 ? 0.3 : 0); }
      a.evT -= dt; if (a.evT <= 0) { a.evT = 2 + R() * 3; this.crackle(this.ambOut(3, 0.5), t, 0.6, 6, 0.3, 2200); }
      return;
    }
    a.evT -= dt; if (a.evT > 0) return; a.evT = 7 + R() * 9;
    const roll = R();
    if (th === 'forge') {
      if (roll < 0.5) { const o = this.ambOut(18 + R() * 10, 0.35), f = 700 + R() * 500; for (let i = 0; i < 2 + (R() * 3 | 0); i++) this.ring(o, t + i * 0.55, f, [[1, 1, 1.3], [2.7, 0.5, 0.8], [5.1, 0.25, 0.4]], 0.2); }
      else if (roll < 0.8) { const o = this.ambOut(20, 0.5); this.osc(o, t, 50, 32, 2.5, 0.6, 'sine', 0.3); this.nz(o, t, 2.5, 300, 80, 1, 0.4, 'lowpass', 0.5); }
      else this.choir(this.ambOut(25, 0.25), t, a.root * 4, [0, 1, 6], 6, 0.35, 'o');
    } else {
      if (roll < 0.35) this.choir(this.ambOut(20 + R() * 10, 0.3), t, a.root * 4, G.pick([[0, 3, 7], [0, 1, 6], [0, 3, 8], [0, 6, 11]]), 5 + R() * 3, 0.32, G.pick(['a', 'o', 'u']));
      else if (roll < 0.55) this.bell(this.ambOut(30, 0.28), t, a.root * 8 * G.pick([1, 1.189, 0.749]), 0.18);
      else if (roll < 0.75) { const o = this.ambOut(15 + R() * 10, 0.3); this.voice(o, t, 140 + R() * 60, 70 + R() * 20, 2 + R(), 0.25, 450); }  // something moans far away
      else if (roll < 0.9) { const o = this.ambOut(10, 0.4); this.whoosh(o, t, 2.2, 200, 900, 0.3); }                                        // a draught through the halls
      else { const o = this.ambOut(14, 0.35); for (let i = 0; i < 4; i++) this.clack(o, t + i * 0.25 + R() * 0.1, 700 + R() * 600, 0.3); }      // pebbles skitter
    }
  };

  /* ---------------- procedural boss music ----------------
     per-dungeon key and tempo; taiko-style drums, a phrygian string ostinato, choir chords, brass stabs.
     it gets denser and louder as the boss loses health. plays only while a boss is awake. */
  const BOSS = {
    crypt: { root: 73.4, bpm: 96, mode: [0, 1, 3, 5, 7, 8, 10], vowel: 'a', bell: true },
    warrens: { root: 65.4, bpm: 112, mode: [0, 1, 4, 5, 7, 8, 10], vowel: 'o', bell: false },
    forge: { root: 82.4, bpm: 126, mode: [0, 1, 3, 6, 7, 8, 11], vowel: 'u', bell: false, anvil: true },
    abyss: { root: 61.7, bpm: 104, mode: [0, 1, 3, 4, 6, 8, 10], vowel: 'o', bell: true }
  };
  A.bossStart = function (dg) {
    if (!this.ctx || (this.boss && this.boss.on)) return; const c = this.ctx, cfg = BOSS[dg] || BOSS.crypt;
    const out = c.createGain(); out.gain.value = 0.0001; out.connect(this.musicBus); out.gain.setTargetAtTime(1.1, c.currentTime, 0.5);
    const s = c.createGain(); s.gain.value = 0.3; out.connect(s); s.connect(this.verb);
    if (this.amb) this.amb.g.gain.setTargetAtTime(0.25, c.currentTime, 1);
    this.boss = { on: true, cfg, out, next: c.currentTime + 0.1, step: 0, bar: 0, int: 0 };
  };
  A.bossStop = function (win) {
    const B = this.boss; if (!B || !B.on) return; B.on = false; const c = this.ctx, t = c.currentTime;
    if (win) { this.choir(B.out, t + 0.05, B.cfg.root * 2, [0, 4, 7, 12], 4, 0.5, 'a'); this.thump(B.out, t, 60, 30, 2, 0.9); }
    B.out.gain.setTargetAtTime(0.0001, t + (win ? 2.5 : 0), 0.8); const o = B.out; setTimeout(() => { try { o.disconnect(); } catch (e) { } }, 8000);
    if (this.amb) this.amb.g.gain.setTargetAtTime(1, t + 2, 2);
  };
  // drum voices
  A.taiko = function (o, t, vol) { const q = this.grit(o, 2); this.osc(q, t, 110, 42, 0.5, vol, 'sine', 0.002); this.nz(q, t, 0.12, 900, 200, 1, vol * 0.4, 'lowpass', 0.001); this.osc(q, t, 230, 120, 0.08, vol * 0.3, 'triangle', 0.001); };
  A.snareish = function (o, t, vol) { this.nz(o, t, 0.18, 4000, 1500, 0.8, vol * 0.6, 'bandpass', 0.001); this.osc(o, t, 210, 160, 0.09, vol * 0.4, 'triangle', 0.001); };
  A.brass = function (o, t, f, dur, vol) { const c = this.ctx, lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2; lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(2400, t + 0.06); lp.frequency.exponentialRampToValueAtTime(500, t + dur); lp.connect(o); [1, 1.005, 0.995].forEach(d => this.osc(lp, t, f * d, f * d, dur, vol / 3, 'sawtooth', 0.03)); };
  A.string = function (o, t, f, dur, vol) { const c = this.ctx, lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 1; lp.connect(o); this.osc(lp, t, f, f, dur, vol, 'sawtooth', 0.01); this.osc(lp, t, f * 1.004, f * 1.004, dur, vol * 0.7, 'sawtooth', 0.01); };
  A.bossTick = function () {
    const E = G.enemies, b = E && E.boss, want = b && !b.dead && b.awake && b.announced && G.run && G.run.active;
    if (want && !(this.boss && this.boss.on)) this.bossStart(G.run.dungeon);
    if (!want && this.boss && this.boss.on) this.bossStop(b && b.dead);
    const B = this.boss; if (!B || !B.on || !this.ctx) return; const c = this.ctx;
    B.int = G.clamp(1 - b.hp / b.maxHp, 0, 1);       // 0 fresh .. 1 nearly dead
    const hot = B.int > 0.5, frantic = B.int > 0.75, cfg = B.cfg, sp = 60 / cfg.bpm / 4;
    const ost = [0, 0, 1, 0, 2, 0, 1, 0, 0, 0, 1, 0, 4, 3, 2, 1];   // scale degrees for the 16th-note ostinato
    const prog = [[0, 3, 7], [1, 4, 8], [0, 3, 7], [6, 1, 5]];     // chord roots as scale degree triads per bar
    while (B.next < c.currentTime + 0.25) {
      const t = B.next, s = B.step % 16, bar = B.bar, deg = i => cfg.mode[((i % 7) + 7) % 7] + 12 * Math.floor(i / 7);
      // drums
      const kick = hot ? [0, 3, 6, 8, 10, 11, 14] : [0, 6, 10]; if (kick.includes(s)) this.taiko(B.out, t, s === 0 ? 0.9 : 0.6);
      if (s === 4 || s === 12) this.snareish(B.out, t, 0.5); if (frantic && (s % 2 === 1)) this.snareish(B.out, t, 0.15);
      if (frantic && s >= 12 && bar % 2 === 1) this.taiko(B.out, t, 0.35 + (s - 12) * 0.12);
      // ostinato: eighths early, sixteenths once it's hot
      if (hot || s % 2 === 0) this.string(B.out, t, NOTE(cfg.root, deg(ost[s] + (bar % 4 === 3 ? 1 : 0))), sp * (hot ? 0.9 : 1.8), 0.12);
      if (s === 0) {
        const ch = prog[bar % 4].map(deg); this.choir(B.out, t, cfg.root * 2, ch, sp * 16 * 1.05, 0.26 + B.int * 0.12, cfg.vowel);
        this.string(B.out, t, NOTE(cfg.root / 2, ch[0]), sp * 15, 0.16);
        if (cfg.bell && bar % 2 === 0) this.bell(B.out, t, NOTE(cfg.root * 4, ch[2]), 0.1);
      }
      if (cfg.anvil && (s === 2 || s === 10)) this.ring(B.out, t, 1400 + (s === 10 ? 200 : 0), [[1, 1, 0.5], [2.7, 0.4, 0.3]], 0.1);
      // brass enters at half health: stabs on the off-beats, a held call every other bar
      if (hot && (s === 3 || s === 11)) { const r = deg(prog[bar % 4][0]); this.brass(B.out, t, NOTE(cfg.root, r), sp * 1.5, 0.22); this.brass(B.out, t, NOTE(cfg.root, r + 7), sp * 1.5, 0.15); }
      if (hot && s === 0 && bar % 2 === 0) this.brass(B.out, t, NOTE(cfg.root * 2, deg(prog[bar % 4][0])), sp * 8, 0.18);
      B.next += sp; B.step++; if (B.step % 16 === 0) B.bar++;
    }
  };
  // one call per frame
  A.tick = function (dt) { if (!this.ctx || this.ctx.state !== 'running') return; this.updateListener(); this.updateLoops(dt); this.ambTick(dt); this.bossTick(); };
})();
