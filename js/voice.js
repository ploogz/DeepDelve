/* ============================================================
   Speech: party chat, NPCs, the narrator and enemy taunts are spoken by an eSpeak synthesizer
   (meSpeak, running in a Web Worker so the game never stutters). The audio comes back as a WAV,
   so every line plays through Web Audio: positioned in 3D at the speaker, muffled and hollow when a
   wall stands between you, and dressed with per-voice effects (growl, ring-mod, echo, octave-down).
   ============================================================ */
'use strict';
G.voice = {
  // speech presets: eSpeak variant, pitch 0-99, speed in words/min, playback rate, effects
  P: {
    // player voices (pick one in Settings)
    hero: { v: 'm3', p: 48, s: 165, label: 'Hero' },
    baritone: { v: 'm1', p: 30, s: 155, label: 'Baritone' },
    gravel: { v: 'croak', p: 22, s: 150, r: 0.94, label: 'Gravel' },
    bard: { v: 'm6', p: 62, s: 175, label: 'Bard' },
    lady: { v: 'f2', p: 52, s: 160, label: 'Lady' },
    sorceress: { v: 'f5', p: 40, s: 150, echo: 0.12, label: 'Sorceress' },
    sprite: { v: 'f1', p: 92, s: 195, r: 1.12, label: 'Sprite' },
    shadow: { v: 'whisper', p: 40, s: 150, label: 'Whisper' },
    golem: { v: 'klatt3', p: 18, s: 140, r: 0.9, label: 'Construct' },
    // non-player characters
    narrator: { v: 'm1', p: 30, s: 148, clear: 1 },   // dry and present: no echo, no room, no slowed-down resampling
    oracle: { v: 'f3', p: 38, s: 135, echo: 0.1 }, dwarf: { v: 'm1', p: 22, s: 150, r: 0.9 }, ghost: { v: 'm7', p: 35, s: 128, echo: 0.18, chorus: 1 },
    goblin: { v: 'm4', p: 99, s: 210, r: 1.25 }, imp: { v: 'f4', p: 99, s: 220, r: 1.32 }, thrall: { v: 'm2', p: 40, s: 150 }, monk: { v: 'm5', p: 50, s: 150 }, shrine: { v: 'f2', p: 30, s: 140, echo: 0.2 },
    // monsters
    undead: { v: 'm7', p: 8, s: 135, r: 0.78, ring: 34, echo: 0.14 }, brute: { v: 'croak', p: 0, s: 150, r: 0.74, dist: 3 },
    demon: { v: 'm1', p: 0, s: 140, r: 0.66, dist: 4, sub: 0.5, echo: 0.1 }, spider: { v: 'whisperf', p: 70, s: 170, r: 0.9, ring: 70 },
    fungus: { v: 'm5', p: 20, s: 130, r: 0.8, chorus: 1 }, stone: { v: 'klatt3', p: 0, s: 125, r: 0.7, dist: 2, sub: 0.4 }
  },
  CLASS: { knight: 'hero', barbarian: 'gravel', rogue: 'shadow', archer: 'bard', wizard: 'baritone', priest: 'lady' },
  active: [], pending: {}, nid: 1, failed: false,
  enabled() { return G.settings.tts !== false && !!G.audio.ctx; },
  myPreset() { const s = G.settings.voice; return s && this.P[s] ? s : this.CLASS[G.cls] || 'hero'; },
  worker() {
    if (this.w || this.failed) return this.w;
    try {
      this.w = new Worker('js/tts/espeak-worker.js');
      this.w.onmessage = e => { const m = e.data; if (m.ready) { this.ready = true; return; } const cb = this.pending[m.id]; delete this.pending[m.id]; if (this.pendingTxt) delete this.pendingTxt[m.id]; if (cb) cb(m.buf); };
      this.w.onerror = () => { this.failed = true; this.w = null; const P = this.pendingTxt || {}; Object.entries(this.pending).forEach(([id, cb]) => { const q = P[id]; if (q) this.synth(q[0], q[1], cb); else cb(null); }); this.pending = {}; this.pendingTxt = {}; };
    } catch (e) { this.failed = true; this.w = null; }
    return this.w;
  },
  // strip markup, dice notes and symbols the synthesizer would spell out
  clean(t) { return String(t || '').replace(/<[^>]*>/g, ' ').replace(/\((?:DC|vs\.?|[+-]\d)[^)]*\)/gi, ' ').replace(/\bd(\d+)\b/g, ' D $1 ').replace(/[^\w\s.,!?'’:;-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300); },
  // no workers allowed here: load the synthesizer on the page itself (a short hitch per line, but it talks)
  inline(cb) {
    if (window.__speakWav) return cb(true); if (this.inl === 'failed') return cb(false);
    (this.inlQ = this.inlQ || []).push(cb); if (this.inl) return; this.inl = 'loading';
    const sc = document.createElement('script'); sc.src = 'js/tts/espeak-worker.js';
    sc.onload = () => { this.inl = window.__speakWav ? 'ok' : 'failed'; this.inlQ.splice(0).forEach(f => f(this.inl === 'ok')); };
    sc.onerror = () => { this.inl = 'failed'; this.inlQ.splice(0).forEach(f => f(false)); }; document.head.appendChild(sc);
  },
  synth(text, pr, cb) {
    const o = { variant: pr.v, pitch: pr.p, speed: pr.s, wordgap: pr.gap || 0, amplitude: 120 };
    const w = this.worker(); if (!w) { this.inline(ok => cb(ok ? window.__speakWav(text, o) : null)); return; }
    const id = this.nid++; this.pending[id] = cb; (this.pendingTxt = this.pendingTxt || {})[id] = [text, pr];
    w.postMessage({ id, text, o });
  },
  /* say(text, presetName, opts)
     opts.at: () => V3 (moving) or V3; omitted = in your head (narrator, your own voice)
     opts.vol, opts.radio (heard from another part of the dungeon), opts.prio ('chat' | 'npc' | 'quip' | 'narr') */
  say(text, preset, opts = {}) {
    if (!this.enabled()) return; const A = G.audio, c = A.ctx; if (!c || c.state !== 'running') return;
    const t = this.clean(text); if (!t) return; const pr = this.P[preset] || this.P.hero;
    // keep it civil: narrator and quips wait their turn; a new NPC line cuts the previous one from the same NPC
    if (opts.prio === 'narr' && this.active.some(v => v.prio === 'narr' || v.prio === 'npc')) return;
    if (opts.prio === 'quip' && this.active.filter(v => v.prio === 'quip').length >= 2) return;
    if (opts.key) this.active.filter(v => v.key === opts.key).forEach(v => this.stop(v));
    this.synth(t, pr, buf => {
      if (!buf) return;
      c.decodeAudioData(buf.slice(0), ab => this.play(ab, pr, opts), () => { });
    });
  },
  play(ab, pr, opts) {
    const A = G.audio, c = A.ctx; if (!A.voiceBus) { A.voiceBus = c.createGain(); A.voiceBus.connect(A.master); }
    A.voiceBus.gain.value = (G.settings.voiceVol ?? 0.9);
    const rate = pr.r || 1, dur = ab.duration / rate, t0 = c.currentTime + 0.02, V = { prio: opts.prio, key: opts.key, nodes: [], end: t0 + dur + 0.6 };
    const src = c.createBufferSource(); src.buffer = ab; src.playbackRate.value = rate; V.nodes.push(src);
    const pre = c.createGain(); pre.gain.value = 1.4; src.connect(pre);
    // a second copy an octave down gives monsters their bulk
    if (pr.sub) { const s2 = c.createBufferSource(); s2.buffer = ab; s2.playbackRate.value = rate * 0.5; const g2 = c.createGain(); g2.gain.value = pr.sub; s2.connect(g2); g2.connect(pre); s2.start(t0); s2.stop(t0 + dur + 0.2); V.nodes.push(s2); }
    let head = pre;
    // the narrator: rumble trimmed, a little presence where consonants live, the harsh top softened
    if (pr.clear) { const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 95; const pk = c.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 2600; pk.Q.value = 0.9; pk.gain.value = 3.5; const sh = c.createBiquadFilter(); sh.type = 'highshelf'; sh.frequency.value = 7000; sh.gain.value = -5; head.connect(hp); hp.connect(pk); pk.connect(sh); head = sh; }
    if (pr.dist) { const ws = c.createWaveShaper(), n = 1024, cur = new Float32Array(n), k = pr.dist; for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; cur[i] = Math.tanh(x * k) / Math.tanh(k); } ws.curve = cur; ws.oversample = '2x'; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; head.connect(ws); ws.connect(lp); head = lp; }
    if (pr.ring) { const rm = c.createGain(); rm.gain.value = 0; const lo = c.createOscillator(); lo.frequency.value = pr.ring; const lg = c.createGain(); lg.gain.value = 0.8; lo.connect(lg); lg.connect(rm.gain); const dry = c.createGain(); dry.gain.value = 0.45; const mix = c.createGain(); head.connect(rm); head.connect(dry); rm.connect(mix); dry.connect(mix); lo.start(t0); lo.stop(t0 + dur + 0.3); V.nodes.push(lo); head = mix; }
    if (pr.chorus) { const d = c.createDelay(0.05); d.delayTime.value = 0.018; const lo = c.createOscillator(); lo.frequency.value = 0.9; const lg = c.createGain(); lg.gain.value = 0.006; lo.connect(lg); lg.connect(d.delayTime); const mix = c.createGain(); head.connect(mix); head.connect(d); d.connect(mix); lo.start(t0); lo.stop(t0 + dur + 0.3); V.nodes.push(lo); head = mix; }
    if (pr.echo) { const d = c.createDelay(1); d.delayTime.value = pr.echo + 0.08; const fb = c.createGain(); fb.gain.value = 0.32; const mix = c.createGain(); head.connect(mix); head.connect(d); d.connect(fb); fb.connect(d); d.connect(mix); head = mix; }
    // occlusion: a lowpass that closes and a resonant 'hollow' bump when a wall is in the way
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 16000; lp.Q.value = 0.7;
    const hol = c.createBiquadFilter(); hol.type = 'peaking'; hol.frequency.value = 380; hol.Q.value = 1.6; hol.gain.value = 0;
    const out = c.createGain(); out.gain.value = opts.vol ?? 1; head.connect(lp); lp.connect(hol); hol.connect(out);
    const send = c.createGain(); send.gain.value = pr.clear ? 0 : opts.at ? 0.18 : 0.08; out.connect(send); send.connect(A.verb);
    if (opts.radio) { const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.9; out.disconnect(); out.connect(bp); bp.connect(A.voiceBus); out.gain.value *= 0.55; }
    else if (opts.at) {
      const pan = c.createPanner(); pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse'; pan.refDistance = 2.2; pan.rolloffFactor = 1.1; pan.maxDistance = 60;
      out.connect(pan); pan.connect(A.voiceBus); V.pan = pan; V.at = typeof opts.at === 'function' ? opts.at : () => opts.at;
    } else out.connect(A.voiceBus);
    V.lp = lp; V.hol = hol; V.out = out; V.send = send; V.base = opts.vol ?? 1;
    src.start(t0); src.stop(t0 + dur + 0.2); src.onended = () => this.stop(V);
    this.active.push(V); this.place(V, true);
    if (opts.onStart) opts.onStart(dur);
  },
  stop(V) { const i = this.active.indexOf(V); if (i >= 0) this.active.splice(i, 1); V.nodes.forEach(n => { try { n.stop(); } catch (e) { } }); setTimeout(() => { try { V.out.disconnect(); V.send.disconnect(); } catch (e) { } }, 800); },
  // follow moving speakers and re-test the walls between you and them
  place(V, snap) {
    if (!V.pan) return; const p = V.at(); if (!p) return; const c = G.audio.ctx, t = c.currentTime;
    G.audio.setPos(V.pan, p.x, (p.y || 0) + 1.6, p.z, snap);
    const occ = G.audio.occluded(p.x, p.z), k = snap ? 0 : 0.08;
    const f = occ ? 520 : 16000, hg = occ ? 7 : 0, g = V.base * (occ ? 0.6 : 1), s = occ ? 0.45 : 0.18;
    if (k) { V.lp.frequency.setTargetAtTime(f, t, k); V.hol.gain.setTargetAtTime(hg, t, k); V.out.gain.setTargetAtTime(g, t, k); V.send.gain.setTargetAtTime(s, t, k); }
    else { V.lp.frequency.value = f; V.hol.gain.value = hg; V.out.gain.value = g; V.send.gain.value = s; }
  },
  update() { const now = G.audio.ctx ? G.audio.ctx.currentTime : 0; for (let i = this.active.length - 1; i >= 0; i--) { const V = this.active[i]; if (now > V.end + 1) { this.active.splice(i, 1); continue; } this.place(V, false); } },
  /* ---- floating speech bubbles ---- */
  bubbles: [],
  bubble(parent, text, y = 2.85, dur) {
    if (!parent) return; const B = this.bubbles.find(b => b.parent === parent) || (() => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 200; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })); s.renderOrder = 22; parent.add(s);
      const b = { parent, c, s, t: 0 }; this.bubbles.push(b); return b; })();
    const x = B.c.getContext('2d'); x.clearRect(0, 0, 512, 200); x.font = '600 33px Georgia, serif'; const words = String(text).split(/\s+/); let line = '', lines = [];
    for (const w of words) { if (x.measureText(line + w).width > 450 && line) { lines.push(line.trim()); line = ''; } line += w + ' '; } lines.push(line.trim()); lines = lines.slice(0, 3);
    const h = 22 + lines.length * 40, wd = Math.min(492, Math.max(...lines.map(l => x.measureText(l).width)) + 44), x0 = (512 - wd) / 2;
    x.fillStyle = 'rgba(14,10,8,0.82)'; x.strokeStyle = '#c8a050'; x.lineWidth = 3; x.beginPath(); if (x.roundRect) x.roundRect(x0, 6, wd, h, 16); else x.rect(x0, 6, wd, h); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(256 - 12, 6 + h); x.lineTo(256, 6 + h + 16); x.lineTo(256 + 12, 6 + h); x.fill();
    x.fillStyle = '#f4e6c8'; x.textAlign = 'center'; lines.forEach((l, i) => x.fillText(l, 256, 44 + i * 40));
    B.s.material.map.needsUpdate = true; B.s.position.y = y; B.s.visible = true; B.t = dur || Math.min(9, 2.5 + String(text).length * 0.06);
    // undo the parent's scale so every bubble reads the same size
    const ws = new G.V3(); parent.getWorldScale(ws); B.s.scale.set(2.5 / (ws.x || 1), 0.977 / (ws.y || 1), 1); B.s.position.y = y / (ws.y || 1);
  },
  updateBubbles(dt) { for (let i = this.bubbles.length - 1; i >= 0; i--) { const B = this.bubbles[i]; B.t -= dt; B.s.visible = B.t > 0; B.s.material.opacity = G.clamp(B.t / 0.4, 0, 1); if (!B.parent.parent) { this.bubbles.splice(i, 1); } } }
};
