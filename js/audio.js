/* ============================================================
   Audio v2: punchy layered synthesis, master compression,
   stereo panning + distance muffling, surface-aware footsteps
   ============================================================ */
'use strict';
(() => {
  const A = G.audio, baseInit = A.init.bind(A);
  A.init = function () {
    const fresh = !this.ctx; baseInit();
    if (fresh && this.ctx) {
      const c = this.ctx;
      this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -16; this.comp.knee.value = 8; this.comp.ratio.value = 5; this.comp.attack.value = 0.002; this.comp.release.value = 0.14;
      this.master.disconnect(); this.master.connect(this.comp); this.comp.connect(c.destination);
      this.master.gain.value = 1.15;
      this.verbGain.gain.value = 0.22;
      this.last = {}; this.voices = 0;
    }
  };
  const R = Math.random;
  // ---------- building blocks (all connect into `o`) ----------
  A.bus = function (vol, pos) {
    const c = this.ctx, g = c.createGain(); g.gain.value = vol; let head = g;
    if (pos && G.player && G.camera) {
      const dx = pos.x - G.player.pos.x, dz = pos.z - G.player.pos.z, d = Math.hypot(dx, dz) || 0.001;
      const yaw = G.player.yaw, rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const p = c.createStereoPanner(); p.pan.value = G.clamp((dx * rx + dz * rz) / d, -1, 1) * Math.min(1, d / 3) * 0.85;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 18000 * G.clamp(1.15 - d / 30, 0.06, 1); f.Q.value = 0.5;
      g.connect(f); f.connect(p); p.connect(this.sfxBus);
    } else g.connect(this.sfxBus);
    this.voices++; setTimeout(() => { try { g.disconnect(); } catch (e) { } this.voices--; }, 3500);
    return head;
  };
  A.env = function (g, t, a, d, peak, curve = 'exp') {
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
    if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); else g.gain.linearRampToValueAtTime(0, t + a + d);
  };
  A.osc = function (o, t, f0, f1, dur, vol, type = 'sine', a = 0.003, fdur) {
    const c = this.ctx, s = c.createOscillator(), g = c.createGain(); s.type = type;
    s.frequency.setValueAtTime(f0, t); s.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + (fdur || dur));
    this.env(g, t, a, dur, vol); s.connect(g); g.connect(o); s.start(t); s.stop(t + a + dur + 0.05); return s;
  };
  A.nz = function (o, t, dur, f0, f1, q, vol, type = 'bandpass', a = 0.002) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain(); this.env(g, t, a, dur, vol); s.connect(f); f.connect(g); g.connect(o); s.start(t, R() * 1.5); s.stop(t + a + dur + 0.05);
  };
  A.thump = function (o, t, f0, f1, dur, vol) { this.osc(o, t, f0, f1, dur, vol, 'sine', 0.002, dur * 0.6); this.osc(o, t, f0 * 2, f1 * 2, dur * 0.4, vol * 0.25, 'triangle', 0.001); };
  A.ring = function (o, t, base, parts, vol) { parts.forEach(([ratio, amp, dec]) => this.osc(o, t, base * ratio * (1 + (R() - 0.5) * 0.004), base * ratio, dec, vol * amp, 'sine', 0.001)); };
  A.clack = function (o, t, f, vol) { this.nz(o, t, 0.03 + R() * 0.02, f, f * 0.8, 9, vol); this.osc(o, t, f * 0.55, f * 0.45, 0.04, vol * 0.5, 'triangle', 0.001); };
  A.crackle = function (o, t, dur, n, vol, f = 3000) { for (let i = 0; i < n; i++) { const tt = t + R() * dur; this.nz(o, tt, 0.006 + R() * 0.012, f * (0.6 + R()), f, 3, vol * (0.3 + R() * 0.7) * (1 - (tt - t) / dur * 0.6), 'bandpass', 0.0005); } };
  A.trem = function (g, t, dur, rate, depth) { const c = this.ctx, l = c.createOscillator(), lg = c.createGain(); l.frequency.value = rate; lg.gain.value = depth; l.connect(lg); lg.connect(g.gain); l.start(t); l.stop(t + dur); };
  A.voice = function (o, t, f0, f1, dur, vol, formant = 700) { // grunts and roars
    const c = this.ctx, s = c.createOscillator(); s.type = 'sawtooth'; s.frequency.setValueAtTime(f0, t); s.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const vib = c.createOscillator(), vg = c.createGain(); vib.frequency.value = 7 + R() * 4; vg.gain.value = f0 * 0.03; vib.connect(vg); vg.connect(s.frequency);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = formant; f.Q.value = 2.5;
    const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = formant * 1.9; f2.Q.value = 4;
    const g = c.createGain(); this.env(g, t, 0.04, dur, vol); s.connect(f); s.connect(f2); f.connect(g); f2.connect(g); g.connect(o);
    s.start(t); vib.start(t); s.stop(t + dur + 0.1); vib.stop(t + dur + 0.1); return g;
  };
  const surface = () => ({ crypt: 'stone', warrens: 'dirt', forge: 'metal', abyss: 'stone', hideout: 'wood', menu: 'stone' })[G.World.theme] || 'stone';

  // ---------- the sound bank ----------
  A.play = function (name, vol = 1, pos) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (pos && G.player) { const d = Math.sqrt(G.dist2(pos.x, pos.z, G.player.pos.x, G.player.pos.z)); vol *= G.clamp(1.25 - d / 30, 0, 1); if (vol < 0.03) return; }
    const now = this.ctx.currentTime; if (this.last[name] && now - this.last[name] < 0.025) return; this.last[name] = now;
    if (this.voices > 70) return;
    const o = this.bus(vol, pos), t = now + 0.005;
    switch (name) {
      /* ---- swings ---- */
      case 'swing': this.nz(o, t, 0.24, 350, 2600, 1.4, 0.55, 'bandpass', 0.06); this.osc(o, t + 0.04, 900, 420, 0.14, 0.05, 'sine', 0.03); break;
      case 'swingfast': this.nz(o, t, 0.14, 900, 4200, 1.8, 0.45, 'bandpass', 0.03); break;
      case 'heavy': this.nz(o, t, 0.4, 160, 1400, 1.1, 0.7, 'bandpass', 0.1); this.osc(o, t, 85, 40, 0.35, 0.3, 'sine', 0.08); break;
      /* ---- blade & metal ---- */
      case 'cling': { const b = 2100 + R() * 1100; this.nz(o, t, 0.035, 9000, 5000, 1, 0.5, 'highpass'); this.ring(o, t, b, [[1, 0.5, 1.1], [2.76, 0.32, 0.7], [5.4, 0.18, 0.4], [8.93, 0.1, 0.22]], 0.32); this.thump(o, t, 260, 140, 0.06, 0.25); break; }
      case 'clang': { const b = 520 + R() * 200; this.thump(o, t, 160, 60, 0.12, 0.7); this.ring(o, t, b, [[1, 0.6, 0.9], [1.48, 0.45, 0.7], [2.13, 0.35, 0.5], [3.32, 0.22, 0.35], [4.73, 0.15, 0.25]], 0.3); this.nz(o, t, 0.08, 6000, 2500, 1, 0.45, 'highpass'); break; }
      case 'block': this.thump(o, t, 190, 90, 0.16, 0.9); this.ring(o, t, 420 + R() * 60, [[1, 0.5, 0.35], [2.3, 0.3, 0.2]], 0.25); this.nz(o, t, 0.1, 2500, 800, 1, 0.4); break;
      case 'parry': this.nz(o, t, 0.05, 9000, 6000, 1, 0.6, 'highpass'); this.ring(o, t, 1650, [[1, 0.6, 1.6], [2.01, 0.4, 1.2], [3.9, 0.25, 0.8], [6.1, 0.15, 0.5]], 0.35); this.thump(o, t, 300, 120, 0.1, 0.5); break;
      /* ---- impacts ---- */
      case 'slice': this.nz(o, t, 0.12, 4200, 900, 2.2, 0.55); this.nz(o, t + 0.02, 0.18, 900, 220, 1.2, 0.45, 'lowpass'); break;
      case 'flesh': this.thump(o, t, 170, 45, 0.16, 1.0); this.nz(o, t, 0.2, 800, 180, 1, 0.55, 'lowpass'); this.nz(o, t, 0.012, 3000, 2000, 1, 0.5, 'bandpass', 0.0005); break;
      case 'thump': this.thump(o, t, 130, 38, 0.28, 1.0); this.nz(o, t, 0.16, 600, 150, 1, 0.6, 'lowpass'); this.crackle(o, t, 0.06, 4, 0.3, 1600); break;
      case 'bonehit': for (let i = 0; i < 4; i++) this.clack(o, t + i * 0.018 + R() * 0.02, 1400 + R() * 1500, 0.55 * (1 - i * 0.18)); this.thump(o, t, 240, 110, 0.07, 0.4); break;
      case 'stonehit': this.thump(o, t, 210, 70, 0.16, 0.9); this.nz(o, t, 0.12, 1600, 600, 1.4, 0.6); this.crackle(o, t, 0.15, 10, 0.35, 2200); break;
      case 'sizzle': this.nz(o, t, 0.45, 5000, 3000, 0.7, 0.35, 'highpass', 0.01); this.crackle(o, t, 0.4, 14, 0.25, 4000); break;
      case 'thunk': this.thump(o, t, 320, 120, 0.09, 0.7); this.nz(o, t, 0.06, 1800, 600, 2, 0.35); break;
      /* ---- skeletons ---- */
      case 'bone': case 'rattle': { const n = name === 'bone' ? 6 : 9; for (let i = 0; i < n; i++) this.clack(o, t + R() * (name === 'bone' ? 0.15 : 0.45), 1200 + R() * 2200, 0.35 * (name === 'bone' ? 1 : 0.6)); break; }
      case 'boneStep': this.clack(o, t, 900 + R() * 400, 0.35); this.clack(o, t + 0.03, 1800 + R() * 800, 0.2); break;
      case 'bonecollapse': { this.thump(o, t, 200, 70, 0.15, 0.6); let tt = t; for (let i = 0; i < 26; i++) { tt += 0.012 + Math.pow(i / 26, 1.6) * 0.07 * R() + 0.01; this.clack(o, tt, 900 + R() * 2400, 0.55 * (1 - i / 32)); } this.osc(o, t + 0.05, 420, 160, 0.4, 0.05, 'square', 0.01); break; }
      /* ---- fire & magic ---- */
      case 'firecast': this.nz(o, t, 0.4, 180, 3200, 0.8, 0.8, 'lowpass', 0.05); this.osc(o, t, 55, 120, 0.35, 0.45, 'sine', 0.03); this.crackle(o, t + 0.05, 0.45, 18, 0.3, 3500); break;
      case 'fire': this.nz(o, t, 0.55, 300, 2400, 0.7, 0.6, 'lowpass', 0.04); this.crackle(o, t, 0.5, 16, 0.32, 3000); this.osc(o, t, 70, 45, 0.4, 0.25, 'sine', 0.05); break;
      case 'boom': this.thump(o, t, 95, 28, 0.9, 1.3); this.nz(o, t, 1.3, 3000, 70, 0.6, 1.0, 'lowpass', 0.003); this.nz(o, t, 0.08, 6000, 2000, 0.7, 0.7, 'highpass'); this.crackle(o, t + 0.1, 1.1, 40, 0.35, 2500); break;
      case 'magic': [0, 4, 7, 12].forEach((s, i) => this.osc(o, t + i * 0.035, 440 * Math.pow(2, s / 12), 440 * Math.pow(2, (s + 12) / 12), 0.6, 0.07, 'sine', 0.03)); for (let i = 0; i < 8; i++) this.osc(o, t + 0.1 + R() * 0.4, 1800 + R() * 2800, 2000, 0.15, 0.03, 'triangle', 0.003); this.nz(o, t, 0.5, 3000, 9000, 2, 0.15, 'bandpass', 0.1); break;
      case 'ice': case 'frost': this.ring(o, t, 2700 + R() * 600, [[1, 0.5, 0.5], [1.58, 0.35, 0.4], [2.47, 0.3, 0.3], [3.9, 0.2, 0.2]], 0.18); this.nz(o, t, 0.45, 9000, 4000, 1, 0.4, 'highpass', 0.02); this.crackle(o, t, 0.4, 20, 0.3, 6000); if (name === 'frost') this.thump(o, t, 140, 50, 0.4, 0.6); break;
      case 'shatter': for (let i = 0; i < 12; i++) this.ring(o, t + R() * 0.12, 1800 + R() * 5200, [[1, 1, 0.12 + R() * 0.2]], 0.12); this.nz(o, t, 0.3, 9000, 3000, 0.7, 0.6, 'highpass'); this.thump(o, t, 200, 90, 0.12, 0.5); break;
      case 'zap': case 'lightning': { this.nz(o, t, 0.05, 8000, 2000, 0.5, 1.0, 'highpass', 0.0005); this.osc(o, t, 120, 95, 0.35, 0.22, 'sawtooth', 0.002); this.crackle(o, t, 0.35, 30, 0.4, 5000); this.thump(o, t + 0.03, 80, 35, 0.6, name === 'lightning' ? 0.8 : 0.4); break; }
      case 'holy': [261.6, 329.6, 392, 523.2, 659.2].forEach((f, i) => { const s = this.osc(o, t + i * 0.03, f, f * 1.002, 1.4, 0.07, i % 2 ? 'triangle' : 'sine', 0.12); }); for (let i = 0; i < 10; i++) this.osc(o, t + 0.2 + R() * 0.8, 2000 + R() * 3000, 2600, 0.2, 0.025, 'sine', 0.01); this.nz(o, t, 1.2, 2000, 8000, 3, 0.1, 'bandpass', 0.3); break;
      case 'heal': [392, 494, 587, 784, 988].forEach((f, i) => this.osc(o, t + i * 0.07, f, f * 1.01, 0.9, 0.07, 'triangle', 0.02)); this.nz(o, t, 0.8, 3000, 9000, 4, 0.08, 'bandpass', 0.2); break;
      /* ---- bows ---- */
      case 'bowdraw': { const s = this.ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.setValueAtTime(70, t); s.frequency.linearRampToValueAtTime(110, t + 0.5); const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 6; const g = this.ctx.createGain(); this.env(g, t, 0.15, 0.4, 0.08, 'lin'); this.trem(g, t, 0.6, 31, 0.05); s.connect(f); f.connect(g); g.connect(o); s.start(t); s.stop(t + 0.7); break; }
      case 'arrow': this.osc(o, t, 165, 150, 0.3, 0.45, 'triangle', 0.001); this.osc(o, t, 330, 300, 0.15, 0.2, 'triangle', 0.001); this.nz(o, t, 0.015, 3000, 2500, 1, 0.6, 'bandpass', 0.0005); this.nz(o, t + 0.02, 0.22, 2500, 7000, 3, 0.3, 'bandpass', 0.05); break;
      /* ---- breakables ---- */
      case 'woodbreak': this.nz(o, t, 0.05, 2200, 1200, 1, 1.0, 'bandpass', 0.0005); this.thump(o, t, 180, 60, 0.22, 1.0); this.crackle(o, t, 0.35, 34, 0.5, 2800); for (let i = 0; i < 7; i++) { const tt = t + 0.12 + R() * 0.6; this.thump(o, tt, 260 + R() * 200, 120, 0.06, 0.25); this.clack(o, tt, 700 + R() * 600, 0.15); } break;
      case 'potbreak': this.thump(o, t, 240, 100, 0.12, 0.7); this.nz(o, t, 0.25, 8000, 2500, 0.8, 0.7, 'highpass'); for (let i = 0; i < 14; i++) this.ring(o, t + R() * 0.25, 1400 + R() * 4500, [[1, 1, 0.06 + R() * 0.12], [2.3, 0.4, 0.05]], 0.1); for (let i = 0; i < 6; i++) this.clack(o, t + 0.15 + R() * 0.5, 2000 + R() * 2000, 0.12); break;
      /* ---- footsteps ---- */
      case 'step': {
        const s = surface(), lr = (this.stepLR = !this.stepLR) ? 1 : 0.92;
        if (s === 'stone') { this.thump(o, t, 120 * lr, 55, 0.08, 0.45); this.nz(o, t, 0.03, 2600 * lr, 1500, 2, 0.28); this.nz(o, t + 0.01, 0.08, 1200, 500, 1, 0.12, 'lowpass'); }
        else if (s === 'dirt') { this.thump(o, t, 95 * lr, 45, 0.09, 0.4); this.crackle(o, t, 0.09, 9, 0.25, 1800); this.nz(o, t, 0.1, 900, 300, 1, 0.22, 'lowpass'); }
        else if (s === 'metal') { this.thump(o, t, 130 * lr, 60, 0.07, 0.4); this.ring(o, t, 760 * lr, [[1, 0.5, 0.25], [2.6, 0.3, 0.15]], 0.06); this.nz(o, t, 0.03, 4000, 2500, 2, 0.2); }
        else { this.thump(o, t, 150 * lr, 85, 0.11, 0.5); this.nz(o, t, 0.06, 420 * lr, 300, 6, 0.3); this.nz(o, t, 0.02, 2200, 1500, 2, 0.12); }
        if (G.player && G.player.cls === 'knight') { this.ring(o, t + 0.02, 3800 + R() * 900, [[1, 1, 0.12]], 0.035); this.ring(o, t + 0.05, 5200 + R() * 900, [[1, 1, 0.08]], 0.025); }
        break; }
      case 'heavyStep': this.thump(o, t, 75, 30, 0.4, 1.1); this.nz(o, t, 0.3, 500, 80, 1, 0.5, 'lowpass'); this.crackle(o, t + 0.02, 0.2, 8, 0.2, 1200); break;
      case 'skitter': for (let i = 0; i < 4; i++) this.clack(o, t + i * 0.035 + R() * 0.02, 2500 + R() * 1500, 0.12); break;
      case 'pawStep': this.thump(o, t, 110, 55, 0.07, 0.35); this.nz(o, t, 0.06, 1200, 500, 1, 0.12, 'lowpass'); break;
      /* ---- voices ---- */
      case 'hurt': this.thump(o, t, 140, 50, 0.18, 0.9); this.voice(o, t, 190 + R() * 30, 120, 0.25, 0.5, 650); break;
      case 'groan': this.voice(o, t, 115 + R() * 40, 70, 0.75, 0.5, 520); this.nz(o, t, 0.6, 500, 150, 2, 0.2); break;
      case 'screech': { const g = this.voice(o, t, 760 + R() * 300, 380, 0.5, 0.35, 1800); this.trem(g, t, 0.6, 24, 0.15); this.nz(o, t, 0.4, 4000, 1500, 4, 0.2); break; }
      case 'roar': { const g1 = this.voice(o, t, 82, 42, 1.7, 0.6, 420), g2 = this.voice(o, t + 0.04, 124, 60, 1.6, 0.45, 760); this.trem(g1, t, 1.8, 27, 0.25); this.nz(o, t, 1.7, 700, 120, 0.8, 0.8, 'lowpass', 0.1); this.thump(o, t, 60, 30, 1.2, 0.8); break; }
      /* ---- ui & misc ---- */
      case 'coin': this.ring(o, t, 2093, [[1, 0.8, 0.25], [2.98, 0.3, 0.15]], 0.18); this.ring(o, t + 0.07, 2637, [[1, 0.8, 0.35], [2.98, 0.3, 0.2]], 0.16); break;
      case 'pickup': [523, 784, 1046].forEach((f, i) => this.osc(o, t + i * 0.05, f, f, 0.25, 0.12, 'triangle', 0.005)); break;
      case 'chest': { const s = this.ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.setValueAtTime(130, t); s.frequency.linearRampToValueAtTime(95, t + 0.35); s.frequency.linearRampToValueAtTime(150, t + 0.55); const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 7; const g = this.ctx.createGain(); this.env(g, t, 0.05, 0.55, 0.22, 'lin'); this.trem(g, t, 0.6, 18, 0.12); s.connect(f); f.connect(g); g.connect(o); s.start(t); s.stop(t + 0.7);
        this.clack(o, t, 1800, 0.5); this.thump(o, t + 0.55, 160, 80, 0.12, 0.5); [784, 988, 1175, 1568].forEach((fr, i) => this.osc(o, t + 0.6 + i * 0.06, fr, fr, 0.5, 0.07, 'triangle', 0.01)); break; }
      case 'click': this.osc(o, t, 1300, 900, 0.04, 0.12, 'triangle', 0.001); break;
      case 'level': [392, 523, 659, 784, 1046].forEach((f, i) => this.osc(o, t + i * 0.06, f, f, 0.6, 0.1, 'triangle', 0.005)); break;
      case 'squish': this.nz(o, t, 0.3, 500, 140, 3, 0.7, 'lowpass'); this.thump(o, t, 90, 50, 0.2, 0.4); break;
      case 'web': this.nz(o, t, 0.3, 1400, 500, 6, 0.35); this.osc(o, t, 300, 200, 0.2, 0.05, 'sawtooth', 0.01); break;
      case 'portal': this.osc(o, t, 110, 440, 1.5, 0.18, 'sine', 0.2); this.osc(o, t, 165, 660, 1.5, 0.12, 'triangle', 0.2); this.nz(o, t, 1.5, 400, 5000, 2, 0.25, 'bandpass', 0.3); this.thump(o, t + 1.2, 80, 30, 0.6, 0.5); break;
      case 'dice': for (let i = 0; i < 10; i++) { const tt = t + i * 0.085 + R() * 0.05, k = 1 - i / 11; this.clack(o, tt, 1600 + R() * 1400, 0.4 * k); this.thump(o, tt, 220, 120, 0.05, 0.2 * k); } break;
      case 'diceland': this.thump(o, t, 260, 120, 0.12, 0.6); this.clack(o, t, 2100, 0.4); break;
      /* ---- dungeon ambience & the great door ---- */
      case 'drip': this.osc(o, t, 1400 + R() * 600, 500, 0.08, 0.18, 'sine', 0.001); this.osc(o, t + 0.02, 2600 + R() * 400, 1400, 0.05, 0.06, 'sine', 0.001); break;
      case 'moan': { const g = this.voice(o, t, 140 + R() * 40, 90 + R() * 30, 2.2, 0.25, 420); this.nz(o, t, 2.2, 300, 200, 1, 0.08, 'lowpass', 0.6); break; }
      case 'whisper': for (let i = 0; i < 6; i++) this.nz(o, t + i * 0.18 + R() * 0.08, 0.15 + R() * 0.1, 3000 + R() * 3000, 2000, 6, 0.12, 'bandpass', 0.03); break;
      case 'chainrattle': for (let i = 0; i < 8; i++) { const tt = t + i * 0.06 + R() * 0.04; this.clack(o, tt, 2400 + R() * 1600, 0.18); this.osc(o, tt, 3200 + R() * 800, 2800, 0.12, 0.03, 'sine', 0.001); } break;
      case 'cackle': for (let i = 0; i < 5; i++) this.voice(o, t + i * 0.13, 420 + R() * 80, 300, 0.1, 0.12, 1400); break;
      case 'squeak': for (let i = 0; i < 3; i++) this.osc(o, t + i * 0.09, 3200 + R() * 900, 2600, 0.06, 0.06, 'sine', 0.004); break;
      case 'bats': for (let i = 0; i < 14; i++) { const tt = t + R() * 1.4; this.osc(o, tt, 5200 + R() * 2600, 3800, 0.03, 0.04, 'sine', 0.001); this.nz(o, tt, 0.05, 1200, 600, 2, 0.06, 'bandpass', 0.004); } break;
      case 'rumble': this.nz(o, t, 2.4, 160, 60, 1, 0.5, 'lowpass', 0.5); this.thump(o, t + 0.2, 50, 30, 1.6, 0.25); break;
      case 'metalclank': this.ring(o, t, 420 + R() * 200, [[1, 1, 0.9], [2.76, 0.5, 0.5], [5.4, 0.3, 0.3]], 0.15); this.clack(o, t, 3000, 0.3); break;
      case 'bigdoor': this.nz(o, t, 2.0, 220, 90, 2, 0.55, 'bandpass', 0.3); for (let i = 0; i < 12; i++) this.osc(o, t + i * 0.14 + R() * 0.05, 90 + R() * 40, 70, 0.12, 0.12, 'sawtooth', 0.01); this.thump(o, t, 70, 40, 0.6, 0.35); break;
      case 'doorslam': this.thump(o, t, 70, 28, 1.2, 1.0); this.nz(o, t, 0.9, 900, 120, 1, 0.8, 'lowpass', 0.002); this.ring(o, t, 180, [[1, 1, 1.4], [2.3, 0.4, 0.8]], 0.12); this.clack(o, t + 0.05, 1200, 0.4); break;
      case 'note0': case 'note1': case 'note2': case 'note3': case 'note4': { const f = [262, 330, 392, 523, 659][+name[4]]; this.osc(o, t, f, f, 1.1, 0.16, 'triangle', 0.01); this.osc(o, t, f * 2, f * 2, 0.7, 0.05, 'sine', 0.01); this.nz(o, t, 0.4, 600, 300, 1, 0.12, 'lowpass', 0.02); break; }
      case 'crit20': [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => this.osc(o, t + i * 0.07, f, f, 1.4, 0.09, 'square', 0.005)); this.thump(o, t, 80, 40, 0.6, 0.6); this.nz(o, t, 1.4, 3000, 9000, 3, 0.15, 'bandpass', 0.2); break;
    }
  };
})();
