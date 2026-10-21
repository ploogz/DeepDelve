/* ============================================================
   DEEPDELVE — core: math, rng, settings, save, input, audio
   ============================================================ */
'use strict';
const G = window.G = {};
G.V3 = THREE.Vector3;
G.tmpV = new THREE.Vector3(); G.tmpV2 = new THREE.Vector3(); G.tmpQ = new THREE.Quaternion();

/* ---------- math ---------- */
G.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
G.lerp = (a, b, t) => a + (b - a) * t;
G.smooth = t => t * t * (3 - 2 * t);
G.angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
G.lerpAng = (a, b, t) => a + G.angDiff(a, b) * t;
// frame-rate independent exponential approach (rate = 1/time-constant)
// smooth pseudo-noise in -1..1 (layered incommensurate sines): camera shake that wobbles instead of flickering
G.noise1 = (t, s = 0) => (Math.sin(t * 13.7 + s * 7.1) * 0.5 + Math.sin(t * 23.3 + s * 3.3 + 1.7) * 0.32 + Math.sin(t * 41.9 + s * 5.9 + 0.4) * 0.18);
G.damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
G.dampAng = (a, b, rate, dt) => a + G.angDiff(a, b) * (1 - Math.exp(-rate * dt));
/* snapshot interpolation: samples {t,x,z,r} are played back slightly in the past so motion between network
   updates is a straight, even line instead of an exponential chase; short gaps extrapolate briefly */
G.netBuf = {
  // dedupe: for sources re-read every frame (presence) only real changes become samples
  push(buf, x, z, r, dedupe) { const t = G.now(), L = buf[buf.length - 1]; if (dedupe && L && L.x === x && L.z === z && L.r === r) return; buf.push({ t, x, z, r }); if (buf.length > 8) buf.shift(); },
  sample(buf, delay, out, extrap) {
    if (!buf.length) return null; const rt = G.now() - delay;
    if (rt <= buf[0].t) { out.x = buf[0].x; out.z = buf[0].z; out.r = buf[0].r; return out; }
    for (let i = buf.length - 1; i > 0; i--) { const a = buf[i - 1], b = buf[i]; if (rt >= a.t && rt <= b.t) { const k = (rt - a.t) / Math.max(1e-4, b.t - a.t); out.x = a.x + (b.x - a.x) * k; out.z = a.z + (b.z - a.z) * k; out.r = G.lerpAng(a.r, b.r, k); return out; } }
    const L = buf[buf.length - 1], P = buf[buf.length - 2], ex = Math.min(rt - L.t, delay * 0.8);
    if (extrap && P && L.t - P.t < 0.4) { const k = ex / Math.max(1e-3, L.t - P.t); out.x = L.x + (L.x - P.x) * k; out.z = L.z + (L.z - P.z) * k; } else { out.x = L.x; out.z = L.z; }
    out.r = L.r; return out;
  }
};
G.dist2 = (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };
G.mulberry = function (a) {
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
};
G.R = Math.random;
G.rr = (a, b, r = Math.random) => a + (b - a) * r();
G.ri = (a, b, r = Math.random) => Math.floor(a + (b - a + 1) * r());
G.pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length)];
G.shuffle = (arr, r = Math.random) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
G.now = () => performance.now() / 1000;

/* ---------- storage (per-viewer save) ---------- */
G.store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
};

G.settings = Object.assign({
  sens: 1.0, fov: 82, vol: 0.7, music: 0.35, quality: 'high', bloom: true, gore: true,
  fps: false, invertY: false, shake: true, name: ''
}, G.store.get('dd_settings', {}));
G.saveSettings = () => G.store.set('dd_settings', G.settings);

G.CLASSES = ['knight', 'barbarian', 'rogue', 'archer', 'wizard', 'priest'];
G.defaultSave = () => ({
  gold: 60, backpackLv: 0, armorLv: 0, luckLv: 0, flaskLv: 0, stash: [], runs: 0, kills: 0, bossKills: 0,
  cls: Object.fromEntries(G.CLASSES.map(c => [c, { wpn: 0, ab2: false, ab2Lv: 0 }]))
});
G.save = Object.assign(G.defaultSave(), G.store.get('dd_save', {}));
G.CLASSES.forEach(c => { if (!G.save.cls[c]) G.save.cls[c] = { wpn: 0, ab2: false, ab2Lv: 0 }; });
G.persist = () => G.store.set('dd_save', G.save);

/* ---------- input ---------- */
G.keys = {}; G.mouse = { dx: 0, dy: 0, l: false, r: false, lPressed: false, rPressed: false };
G.pressed = {};
addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
  if (!G.keys[e.code]) G.pressed[e.code] = true;
  G.keys[e.code] = true;
  if (['Space', 'Tab'].includes(e.code) && G.state === 'play') e.preventDefault();
});
addEventListener('keyup', e => { G.keys[e.code] = false; });
addEventListener('blur', () => { G.keys = {}; G.mouse.l = G.mouse.r = false; });
const freeLook = e => G.noLock && G.state === 'play' && G.ui && !G.ui.modalOpen() && e.target && e.target.tagName === 'CANVAS';
addEventListener('mousemove', e => {
  if (document.pointerLockElement || freeLook(e)) { G.mouse.dx += e.movementX; G.mouse.dy += e.movementY; }
});
addEventListener('mousedown', e => {
  if (!document.pointerLockElement && !freeLook(e)) return;
  if (e.button === 0) { G.mouse.l = true; G.mouse.lPressed = true; }
  if (e.button === 2) { G.mouse.r = true; G.mouse.rPressed = true; }
});
addEventListener('mouseup', e => { if (e.button === 0) G.mouse.l = false; if (e.button === 2) G.mouse.r = false; });
addEventListener('contextmenu', e => e.preventDefault());
G.endFrameInput = () => { G.pressed = {}; G.mouse.dx = G.mouse.dy = 0; G.mouse.lPressed = G.mouse.rPressed = false; };
G.lockPointer = () => {
  const c = G.renderer && G.renderer.domElement; if (!c) return;
  try { const p = c.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (e) { }
};

/* ---------- audio (fully synthesized) ---------- */
G.audio = {
  ctx: null, master: null, sfxBus: null, musicBus: null, noiseBuf: null, amb: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const C = window.AudioContext || window.webkitAudioContext; this.ctx = new C();
      this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain(); this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain(); this.musicBus.connect(this.master);
      const len = this.ctx.sampleRate * 2; this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // convolution reverb for dungeon feel
      this.verb = this.ctx.createConvolver(); const ir = this.ctx.createBuffer(2, this.ctx.sampleRate * 2.2, this.ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const b = ir.getChannelData(ch); for (let i = 0; i < b.length; i++) b[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / b.length, 3.2); }
      this.verb.buffer = ir; this.verbGain = this.ctx.createGain(); this.verbGain.gain.value = 0.35;
      this.sfxBus.connect(this.verb); this.verb.connect(this.verbGain); this.verbGain.connect(this.master);
      this.apply();
    } catch (e) { this.ctx = null; }
  },
  apply() { if (!this.ctx) return; this.sfxBus.gain.value = G.settings.vol; this.musicBus.gain.value = G.settings.music; },
  noise(t0, dur, f0, f1, q, vol, type = 'bandpass', dest) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.02, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfxBus); s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
  },
  tone(t0, dur, f0, f1, vol, type = 'sine', dest) {
    const c = this.ctx, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || this.sfxBus); o.start(t0); o.stop(t0 + dur + 0.05);
  },
  play(name, vol = 1, pos) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (pos && G.player) { const d = Math.sqrt(G.dist2(pos.x, pos.z, G.player.pos.x, G.player.pos.z)); vol *= G.clamp(1.2 - d / 26, 0, 1); if (vol < 0.03) return; }
    const t = this.ctx.currentTime, r = Math.random;
    switch (name) {
      case 'swing': this.noise(t, 0.22, 600 + r() * 300, 2400, 1.2, 0.35 * vol); break;
      case 'heavy': this.noise(t, 0.35, 300, 1400, 1, 0.45 * vol); this.tone(t, 0.3, 90, 50, 0.2 * vol, 'sine'); break;
      case 'flesh': this.noise(t, 0.16, 900, 200, 2, 0.6 * vol, 'lowpass'); this.tone(t, 0.12, 140, 60, 0.35 * vol, 'triangle'); this.noise(t + 0.03, 0.2, 2500, 800, 4, 0.12 * vol); break;
      case 'clang': this.tone(t, 0.5, 1400 + r() * 300, 1300, 0.18 * vol, 'square'); this.tone(t, 0.6, 2300, 2200, 0.12 * vol, 'sine'); this.noise(t, 0.1, 5000, 3000, 1, 0.3 * vol); break;
      case 'block': this.tone(t, 0.3, 380, 320, 0.25 * vol, 'triangle'); this.noise(t, 0.12, 1800, 900, 1, 0.3 * vol); break;
      case 'parry': this.tone(t, 0.8, 1900, 1850, 0.22 * vol, 'sine'); this.tone(t, 0.8, 2850, 2800, 0.14 * vol, 'sine'); this.noise(t, 0.08, 7000, 5000, 1, 0.3 * vol); break;
      case 'fire': this.noise(t, 0.6, 400, 1800, 0.7, 0.4 * vol, 'lowpass'); this.noise(t, 0.5, 3000, 600, 3, 0.15 * vol); break;
      case 'boom': this.noise(t, 1.2, 1200, 60, 0.6, 0.9 * vol, 'lowpass'); this.tone(t, 0.8, 70, 30, 0.6 * vol, 'sine'); break;
      case 'ice': this.tone(t, 0.25, 3200, 1800, 0.12 * vol, 'sine'); this.noise(t, 0.3, 6000, 3000, 6, 0.25 * vol); break;
      case 'shatter': for (let i = 0; i < 6; i++) this.tone(t + i * 0.025, 0.2, 2000 + r() * 3000, 1500, 0.07 * vol, 'triangle'); this.noise(t, 0.4, 7000, 2500, 2, 0.35 * vol); break;
      case 'zap': this.noise(t, 0.3, 4000, 1500, 8, 0.4 * vol); this.tone(t, 0.25, 900, 120, 0.15 * vol, 'sawtooth'); break;
      case 'holy': [523, 659, 784, 1046].forEach((f, i) => this.tone(t + i * 0.04, 1.2, f, f, 0.08 * vol, 'sine')); break;
      case 'heal': [392, 494, 587, 784].forEach((f, i) => this.tone(t + i * 0.08, 0.9, f, f * 1.01, 0.08 * vol, 'triangle')); break;
      case 'arrow': this.noise(t, 0.18, 2500, 6000, 3, 0.25 * vol); this.tone(t, 0.08, 180, 90, 0.2 * vol, 'triangle'); break;
      case 'thunk': this.tone(t, 0.12, 220, 90, 0.35 * vol, 'triangle'); this.noise(t, 0.08, 1500, 500, 2, 0.2 * vol); break;
      case 'dice': for (let i = 0; i < 9; i++) { const tt = t + i * 0.09 + r() * 0.05; this.tone(tt, 0.06, 1800 + r() * 1200, 1200, 0.1 * vol * (1 - i / 10), 'triangle'); this.noise(tt, 0.04, 4000, 2000, 3, 0.12 * vol * (1 - i / 10)); } break;
      case 'diceland': this.tone(t, 0.15, 900, 600, 0.2 * vol, 'triangle'); this.noise(t, 0.1, 3000, 1200, 2, 0.2 * vol); break;
      case 'crit20': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(t + i * 0.07, 1.4, f, f, 0.1 * vol, 'square')); break;
      case 'coin': this.tone(t, 0.12, 1975, 1975, 0.15 * vol, 'square'); this.tone(t + 0.08, 0.3, 2637, 2637, 0.12 * vol, 'square'); break;
      case 'pickup': this.tone(t, 0.15, 660, 990, 0.15 * vol, 'triangle'); break;
      case 'hurt': this.noise(t, 0.25, 800, 200, 1, 0.5 * vol, 'lowpass'); this.tone(t, 0.2, 200, 90, 0.3 * vol, 'sawtooth'); break;
      case 'groan': this.tone(t, 0.7, 120 + r() * 60, 55, 0.25 * vol, 'sawtooth'); this.noise(t, 0.6, 500, 150, 2, 0.25 * vol); break;
      case 'screech': this.tone(t, 0.5, 900 + r() * 400, 300, 0.15 * vol, 'sawtooth'); this.noise(t, 0.4, 3000, 1000, 4, 0.2 * vol); break;
      case 'roar': this.tone(t, 1.6, 90, 40, 0.5 * vol, 'sawtooth'); this.noise(t, 1.6, 600, 120, 1, 0.6 * vol, 'lowpass'); this.tone(t, 1.4, 140, 70, 0.25 * vol, 'square'); break;
      case 'step': this.noise(t, 0.07, 300 + r() * 200, 120, 1, 0.08 * vol, 'lowpass'); break;
      case 'portal': this.tone(t, 1.5, 200, 800, 0.15 * vol, 'sine'); this.tone(t, 1.5, 300, 1200, 0.1 * vol, 'triangle'); this.noise(t, 1.5, 500, 4000, 2, 0.15 * vol); break;
      case 'chest': this.tone(t, 0.3, 160, 120, 0.3 * vol, 'square'); this.noise(t, 0.4, 600, 300, 2, 0.3 * vol); [784, 988, 1175].forEach((f, i) => this.tone(t + 0.25 + i * 0.07, 0.5, f, f, 0.08 * vol, 'triangle')); break;
      case 'click': this.tone(t, 0.05, 1200, 900, 0.1 * vol, 'triangle'); break;
      case 'level': [392, 523, 659, 784, 1046].forEach((f, i) => this.tone(t + i * 0.06, 0.6, f, f, 0.1 * vol, 'triangle')); break;
      case 'bone': for (let i = 0; i < 5; i++) this.tone(t + i * 0.04 + r() * 0.03, 0.06, 600 + r() * 800, 300, 0.12 * vol, 'square'); break;
      case 'squish': this.noise(t, 0.3, 400, 150, 3, 0.5 * vol, 'lowpass'); break;
      case 'web': this.noise(t, 0.3, 1200, 400, 5, 0.25 * vol); break;
    }
  },
  ambient(theme) {
    if (!this.ctx) return;
    if (this.amb) { const a = this.amb; a.g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.6); setTimeout(() => a.nodes.forEach(n => { try { n.stop(); } catch (e) { } }), 2500); this.amb = null; }
    if (!theme) return;
    const c = this.ctx, g = c.createGain(); g.gain.value = 0.0001; g.connect(this.musicBus);
    const base = { crypt: 55, warrens: 49, forge: 41.2, hideout: 65.4, menu: 55 }[theme] || 55;
    const nodes = [];
    [1, 1.5, 2.0, 3.0].forEach((m, i) => {
      const o = c.createOscillator(); o.type = i % 2 ? 'triangle' : 'sine'; o.frequency.value = base * m * (1 + (Math.random() - 0.5) * 0.004);
      const og = c.createGain(); og.gain.value = [0.16, 0.08, 0.05, 0.025][i];
      const lfo = c.createOscillator(); lfo.frequency.value = 0.05 + Math.random() * 0.1; const lg = c.createGain(); lg.gain.value = og.gain.value * 0.6; lfo.connect(lg); lg.connect(og.gain);
      o.connect(og); og.connect(g); o.start(); lfo.start(); nodes.push(o, lfo);
    });
    const n = c.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true; const f = c.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.value = theme === 'forge' ? 500 : theme === 'warrens' ? 260 : 180; const ng = c.createGain(); ng.gain.value = theme === 'forge' ? 0.18 : 0.1;
    n.connect(f); f.connect(ng); ng.connect(g); n.start(); nodes.push(n);
    g.gain.setTargetAtTime(1, c.currentTime, 1.5);
    this.amb = { g, nodes };
  }
};
G.sfx = (n, v, p) => G.audio.play(n, v, p);
// decals are transparent and do not write depth, so three.js sorts them by distance and overlapping ones swap as you move.
// give each one a fixed draw order by creation instead (newest on top).
G.decalSeq = 0; G.decalOrder = () => 1 + ((++G.decalSeq) % 900000) / 1000000;
