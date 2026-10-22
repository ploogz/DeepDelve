/* ============================================================
   Procedural textures — painted on canvas, normal maps derived
   ============================================================ */
'use strict';
G.tex = {
  cache: {},
  size() { return this._forceS || (G.settings.quality === 'low' ? 256 : 512); },
  refineTarget() { return G.settings.quality === 'ultra' ? 2048 : G.settings.quality === 'high' ? 1024 : 0; },
  maxAniso() { return G.renderer ? Math.min(16, G.renderer.capabilities.getMaxAnisotropy()) : 4; },
  // tileable value noise
  noiseField(s, cells, r) {
    const g = []; for (let i = 0; i < cells * cells; i++) g.push(r());
    const at = (x, y) => g[((y % cells + cells) % cells) * cells + ((x % cells + cells) % cells)];
    return (x, y) => {
      const fx = x / s * cells, fy = y / s * cells, ix = Math.floor(fx), iy = Math.floor(fy), tx = G.smooth(fx - ix), ty = G.smooth(fy - iy);
      return G.lerp(G.lerp(at(ix, iy), at(ix + 1, iy), tx), G.lerp(at(ix, iy + 1), at(ix + 1, iy + 1), tx), ty);
    };
  },
  fbm(s, r, oct = 5, base = 4) {
    const layers = []; for (let o = 0; o < oct; o++) layers.push(this.noiseField(s, base << o, r));
    return (x, y) => { let v = 0, a = 0.5, t = 0; for (const l of layers) { v += l(x, y) * a; t += a; a *= 0.5; } return v / t; };
  },
  canvas(s) { const c = document.createElement('canvas'); c.width = c.height = s; return c; },
  toNormal(hc, strength = 2.5) {
    const s = hc.width, src = hc.getContext('2d').getImageData(0, 0, s, s).data;
    const out = this.canvas(s), octx = out.getContext('2d'), img = octx.createImageData(s, s), d = img.data;
    const h = (x, y) => src[(((y + s) % s) * s + ((x + s) % s)) * 4] / 255;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const dx = (h(x - 1, y) - h(x + 1, y)) * strength, dy = (h(x, y - 1) - h(x, y + 1)) * strength;
      const l = Math.hypot(dx, dy, 1), i = (y * s + x) * 4;
      d[i] = (dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
    octx.putImageData(img, 0, 0); return out;
  },
  finish(key, col, hgt, emi, repeat = 1, nStr = 2.5) {
    const mk = (cv, srgb) => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = this.maxAniso(); if (srgb) t.encoding = THREE.sRGBEncoding; return t; };
    const res = { map: mk(col, true) };
    if (hgt) res.normalMap = mk(this.toNormal(hgt, nStr));
    if (emi) res.emissiveMap = mk(emi, true);
    this.cache[key] = res; return res;
  },
  // pixel-level painter: fn(x,y) -> [r,g,b,h,(er,eg,eb)]
  paint(s, fn, withEmi) {
    if (this._defer) return { job: true, s, fn, withEmi };
    const c = this.canvas(s), h = this.canvas(s), e = withEmi ? this.canvas(s) : null;
    const ci = c.getContext('2d').createImageData(s, s), hi = h.getContext('2d').createImageData(s, s), ei = e ? e.getContext('2d').createImageData(s, s) : null;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const v = fn(x, y), i = (y * s + x) * 4;
      ci.data[i] = v[0]; ci.data[i + 1] = v[1]; ci.data[i + 2] = v[2]; ci.data[i + 3] = 255;
      hi.data[i] = hi.data[i + 1] = hi.data[i + 2] = G.clamp(v[3], 0, 1) * 255; hi.data[i + 3] = 255;
      if (ei) { ei.data[i] = v[4] || 0; ei.data[i + 1] = v[5] || 0; ei.data[i + 2] = v[6] || 0; ei.data[i + 3] = 255; }
    }
    c.getContext('2d').putImageData(ci, 0, 0); h.getContext('2d').putImageData(hi, 0, 0); if (e) e.getContext('2d').putImageData(ei, 0, 0);
    return [c, h, e];
  },
  // brick layout helper: returns {mortar dist, brick id, local u v}
  bricks(x, y, s, rows, cols, offset = 0.5, mortar = 0.06) {
    const bh = s / rows, row = Math.floor(y / bh), off = (row % 2) * offset * (s / cols), bw = s / cols;
    const xx = ((x + off) % s + s) % s, col = Math.floor(xx / bw);
    const u = (xx % bw) / bw, v = (y % bh) / bh;
    const edge = Math.min(u, 1 - u, (v) * bw / bh, (1 - v) * bw / bh);
    return { id: row * 97 + col * 13, edge, u, v, m: mortar };
  },
  get(key, force) {
    if (this.cache[key] && !force) return this.cache[key];
    const s = this.size(), r = G.mulberry(key.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0);
    const fb = this.fbm(s, r, 5, 4), fb2 = this.fbm(s, r, 4, 8);
    const hash = n => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
    let out;
    switch (key) {
      case 'cryptWall': out = this.paint(s, (x, y) => {
        const b = this.bricks(x, y, s, 8, 4, 0.5), n = fb(x, y), n2 = fb2(x, y), hv = hash(b.id);
        const mort = b.edge < 0.05; let base = 80 + hv * 35 + (n - 0.5) * 70;
        const moss = G.clamp((y / s - 0.6) * 3 * (n2 - 0.3) * 2, 0, 1);
        let rr = base * 0.95, gg = base, bb = base * 0.9;
        if (mort) { rr = gg = bb = 32 + n * 25; }
        rr = G.lerp(rr, 50, moss * 0.6); gg = G.lerp(gg, 80, moss * 0.6); bb = G.lerp(bb, 40, moss * 0.6);
        const crack = Math.abs(n2 - 0.5) < 0.012 ? 0.5 : 1;
        return [rr * crack, gg * crack, bb * crack, mort ? 0.1 : 0.55 + n * 0.4 - (b.edge < 0.12 ? (0.12 - b.edge) * 2 : 0)];
      }); break;
      case 'cryptFloor': out = this.paint(s, (x, y) => {
        const b = this.bricks(x, y, s, 4, 4, 0.37), n = fb(x, y), hv = hash(b.id);
        const mort = b.edge < 0.035; const base = 70 + hv * 30 + (n - 0.5) * 60;
        const dirt = fb2(x, y);
        return mort ? [25, 24, 22, 0.05] : [base * 0.95 + dirt * 20, base * 0.93 + dirt * 15, base * 0.88, 0.5 + n * 0.4];
      }); break;
      case 'cavernWall': out = this.paint(s, (x, y) => {
        const n = fb(x, y), n2 = fb2(x, y), strata = Math.sin((y / s) * 28 + n * 9) * 0.5 + 0.5;
        const v = 60 + n * 70 + strata * 20;
        return [v * 0.95, v * 0.82, v * 0.66, n * 0.7 + strata * 0.2 + n2 * 0.25];
      }); break;
      case 'cavernFloor': out = this.paint(s, (x, y) => {
        const n = fb(x, y), n2 = fb2(x, y), peb = n2 > 0.62 ? (n2 - 0.62) * 4 : 0;
        const v = 52 + n * 50 + peb * 60;
        return [v * 0.9, v * 0.75, v * 0.55, n * 0.5 + peb];
      }); break;
      case 'forgeWall': out = this.paint(s, (x, y) => {
        const b = this.bricks(x, y, s, 6, 3, 0.5), n = fb(x, y), hv = hash(b.id), n2 = fb2(x, y);
        const mort = b.edge < 0.05, crack = Math.abs(n2 - 0.5) < 0.018 && !mort;
        const v = 28 + hv * 18 + n * 30;
        const glow = mort ? 0.55 + n * 0.4 : crack ? 1 : 0;
        return [mort ? 40 : v * 1.1, mort ? 14 : v * 0.9, mort ? 8 : v * 0.85, mort ? 0.05 : 0.6 + n * 0.3, glow * 255, glow * 90, glow * 15];
      }, true); break;
      case 'forgeFloor': out = this.paint(s, (x, y) => {
        const b = this.bricks(x, y, s, 3, 3, 0.0), n = fb(x, y), hv = hash(b.id + 3);
        const mort = b.edge < 0.03; const v = 30 + hv * 16 + n * 30;
        const rivet = (Math.hypot(b.u - 0.1, b.v - 0.1) < 0.03 || Math.hypot(b.u - 0.9, b.v - 0.9) < 0.03);
        const glow = mort ? 0.7 : 0;
        return [rivet ? 90 : v * 1.05, rivet ? 80 : v * 0.92, rivet ? 70 : v * 0.88, mort ? 0.05 : rivet ? 0.95 : 0.55 + n * 0.3, glow * 255, glow * 70, 0];
      }, true); break;
      case 'wood': out = this.paint(s, (x, y) => {
        const plank = Math.floor(x / (s / 4)), n = fb(x, y * 0.2 + plank * 50), grain = Math.sin((x + n * 60) * 0.35 + plank) * 0.5 + 0.5;
        const edge = (x % (s / 4)) < 3; const v = 95 + grain * 35 + n * 40 + hash(plank) * 20;
        const knot = Math.hypot(((x % (s / 4)) - s / 8), ((y + plank * 70) % (s / 2)) - s / 4) < 7;
        return edge ? [30, 20, 12, 0] : knot ? [60, 38, 22, 0.3] : [v, v * 0.68, v * 0.42, 0.5 + grain * 0.3];
      }); break;
      case 'hideoutWall': out = this.paint(s, (x, y) => {
        const b = this.bricks(x, y, s, 10, 5, 0.5), n = fb(x, y), hv = hash(b.id);
        const mort = b.edge < 0.07; const v = 110 + hv * 40 + (n - 0.5) * 60;
        return mort ? [60, 55, 48, 0.1] : [v, v * 0.88, v * 0.72, 0.6 + n * 0.3];
      }); break;
      case 'metal': out = this.paint(s, (x, y) => {
        // hammered plate: soft peen dents on a cell grid, fine directional scratches, a little pitting
        const n = fb(x, y), sc = fb2(x * 3, y * 0.3), u = x / s * 14, w = y / s * 14, cx = Math.floor(u), cy = Math.floor(w), h1 = hash(cx * 31 + cy * 17), h2 = hash(cx * 7 + cy * 41);
        const dx = u - cx - 0.3 - h1 * 0.4, dy = w - cy - 0.3 - h2 * 0.4, dent = Math.max(0, 1 - Math.hypot(dx, dy) * 2.6);
        const scr = Math.pow(Math.max(0, 1 - Math.abs(Math.sin((x * 0.9 + y * 0.12) / s * 220 + n * 9)) * 18), 2) * (fb2(x, y * 4) > 0.55 ? 1 : 0);
        const v = 120 + n * 60 + sc * 30 - dent * 14 + scr * 40;
        return [v, v, v * 1.02, 0.5 + n * 0.15 - dent * dent * 0.22 - scr * 0.08 + (hash(x * 13.1 + y * 7.7) > 0.997 ? -0.15 : 0)];
      }); break;
      case 'rock': out = this.paint(s, (x, y) => { const n = fb(x, y), n2 = fb2(x, y); const v = 70 + n * 80; return [v, v * 0.95, v * 0.9, n * 0.6 + n2 * 0.4]; }); break;
      case 'cloth': out = this.paint(s, (x, y) => { const w = ((x % 4) < 2) ^ ((y % 4) < 2) ? 1 : 0.85, n = fb(x, y); const v = 200 * w * (0.8 + n * 0.3); return [v, v, v, w * 0.5 + n * 0.2]; }); break;
      case 'leather': out = this.paint(s, (x, y) => { const n = fb2(x, y), n3 = fb(x, y); const v = 150 + n * 70 + n3 * 30; return [v, v * 0.72, v * 0.5, n * 0.7]; }); break;
      case 'hide': out = this.paint(s, (x, y) => { const n = fb2(x, y), n3 = fb(x, y); const v = 165 + n * 60 + n3 * 25; return [v, v * 0.97, v * 0.95, n * 0.7]; }); break;
      case 'bone': out = this.paint(s, (x, y) => { const n = fb(x, y), p = fb2(x, y); const v = 200 + n * 40 - p * 40; return [v, v * 0.95, v * 0.82, n * 0.5 + p * 0.3]; }); break;
      case 'scales': out = this.paint(s, (x, y) => {
        const sz = s / 16, row = Math.floor(y / sz), xx = x + (row % 2) * sz / 2, cx = (Math.floor(xx / sz) + 0.5) * sz, cy = (row + 0.2) * sz;
        const d = Math.hypot(xx - cx, (y - cy) * 1.3) / (sz * 0.7), n = fb(x, y); const v = 1 - G.clamp(d, 0, 1);
        return [200 * (0.5 + v * 0.5 + n * 0.2), 200 * (0.5 + v * 0.5 + n * 0.2), 200 * (0.5 + v * 0.5 + n * 0.2), v];
      }); break;
      case 'skin': out = this.paint(s, (x, y) => { const n = fb(x, y), p = fb2(x * 2, y * 2); const v = 200 + n * 40 - p * 30; return [v, v, v, p * 0.5 + n * 0.3]; }); break;
    }
    if (!out) return null;
    const rep = { cryptWall: 1, cryptFloor: 1, cavernWall: 1, cavernFloor: 1, forgeWall: 1, forgeFloor: 1, wood: 1, hideoutWall: 1 }[key] || 1;
    if (this._defer) return { out, rep, nStr: key.includes('Floor') ? 2 : 3 };
    return this.finish(key, out[0], out[1], out[2], rep, key.includes('Floor') ? 2 : 3);
  },
  /* ---- progressive refinement (Ultra quality): once a level is up, every painted texture is repainted at
     2048 px a few rows per frame and swapped into every material that uses it, so loads stay fast ---- */
  refine: { queue: [], job: null, t: 0 },  // repaints at 1024 (High) or 2048 (Ultra) in the background
  tick(dt) {
    const T = this.refineTarget(); if (!T) return; const R = this.refine, t0 = performance.now(), budget = this.refineBudget || 7;
    if (!R.job) {
      R.t -= dt; if (!R.queue.length) { if (R.t > 0) return; R.t = 3; R.queue = Object.keys(this.cache).filter(k => !k.startsWith('s_') && this.cache[k].map && this.cache[k].map.image && this.cache[k].map.image.width < T); if (!R.queue.length) return;
        // the surfaces you are looking at go first: this dungeon's walls and floors, then metal and cloth
        const th = { crypt: 'crypt', warrens: 'cavern', forge: 'forge', abyss: 'abyss', hideout: 'hideout' }[G.World.theme] || '', pri = k => (th && k.startsWith(th) ? 0 : k === 'wood' || k === 'metal' ? 1 : k === 'cloth' || k === 'leather' || k === 'skin' ? 2 : 3); R.queue.sort((a, b) => pri(a) - pri(b)); }
      const key = R.queue.shift(); this._defer = true; this._forceS = T; let d = null; try { d = this.get(key, true); } finally { this._defer = false; this._forceS = 0; }
      if (!d || !d.out || !d.out.job) return;
      const o = d.out, mk = () => { const c = this.canvas(T); return { c, ctx: c.getContext('2d'), img: null }; }, C = mk(), H = mk(), E = o.withEmi ? mk() : null;
      C.img = C.ctx.createImageData(T, T); H.img = H.ctx.createImageData(T, T); if (E) E.img = E.ctx.createImageData(T, T);
      R.job = { key, T, fn: o.fn, C, H, E, y: 0, stage: 0, rep: d.rep, nStr: d.nStr };
    }
    const J = R.job, s = J.T;
    while (performance.now() - t0 < budget) {
      if (J.stage === 0) {
        const y = J.y, cd = J.C.img.data, hd = J.H.img.data, ed = J.E && J.E.img.data;
        for (let x = 0; x < s; x++) { const v = J.fn(x, y), i = (y * s + x) * 4; cd[i] = v[0]; cd[i + 1] = v[1]; cd[i + 2] = v[2]; cd[i + 3] = 255; hd[i] = hd[i + 1] = hd[i + 2] = G.clamp(v[3], 0, 1) * 255; hd[i + 3] = 255; if (ed) { ed[i] = v[4] || 0; ed[i + 1] = v[5] || 0; ed[i + 2] = v[6] || 0; ed[i + 3] = 255; } }
        if (++J.y >= s) { J.C.ctx.putImageData(J.C.img, 0, 0); if (J.E) J.E.ctx.putImageData(J.E.img, 0, 0); J.N = { c: this.canvas(s) }; J.N.ctx = J.N.c.getContext('2d'); J.N.img = J.N.ctx.createImageData(s, s); J.y = 0; J.stage = 1; }
      } else if (J.stage === 1) {
        const y = J.y, src = J.H.img.data, d = J.N.img.data, h = (x, yy) => src[(((yy + s) % s) * s + ((x + s) % s)) * 4] / 255, k = J.nStr;
        for (let x = 0; x < s; x++) { const dx = (h(x - 1, y) - h(x + 1, y)) * k, dy = (h(x, y - 1) - h(x, y + 1)) * k, l = Math.hypot(dx, dy, 1), i = (y * s + x) * 4; d[i] = (dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255; }
        if (++J.y >= s) { J.N.ctx.putImageData(J.N.img, 0, 0); this.swapIn(J); R.job = null; return; }
      }
    }
  },
  swapIn(J) {
    const old = this.cache[J.key]; if (!old) return;
    const mk = (cv, srgb) => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(J.rep, J.rep); t.anisotropy = this.maxAniso(); if (srgb) t.encoding = THREE.sRGBEncoding; return t; };
    const nu = { map: mk(J.C.c, true) }; if (old.normalMap) nu.normalMap = mk(J.N.c); if (old.emissiveMap && J.E) nu.emissiveMap = mk(J.E.c, true);
    const props = ['map', 'normalMap', 'emissiveMap'], dead = new Set();
    const fix = m => { if (!m) return; for (const p of props) { const t = m[p], o = old[p]; if (!t || !o || !nu[p]) continue; if (t === o) { m[p] = nu[p]; dead.add(o); } else if (t.source === o.source) { const c = nu[p].clone(); c.repeat.copy(t.repeat); c.offset.copy(t.offset); c.needsUpdate = true; m[p] = c; dead.add(t); } } };
    G.scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(fix); });
    if (G.mats) Object.values(G.mats).forEach(fix);
    this.cache[J.key] = nu; dead.forEach(t => t.dispose());
  },
  // alpha decals and sprites
  sprite(key) {
    if (this.cache['s_' + key]) return this.cache['s_' + key];
    const s = 128, c = this.canvas(s), x = c.getContext('2d'), r = G.mulberry(key.length * 977 + 3);
    x.clearRect(0, 0, s, s);
    const radial = (cx, cy, rad, stops) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad); stops.forEach(st => g.addColorStop(st[0], st[1])); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, rad, 0, 7); x.fill(); };
    switch (key) {
      case 'blood': for (let i = 0; i < 18; i++) { const a = r() * 7, d = r() * 40 * (i ? 1 : 0), rad = i ? 4 + r() * 14 : 30; radial(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, rad, [[0, 'rgba(110,0,0,0.95)'], [0.7, 'rgba(80,0,0,0.9)'], [1, 'rgba(60,0,0,0)']]); }
        for (let i = 0; i < 10; i++) { const a = r() * 7, d = 42 + r() * 18; radial(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 2 + r() * 4, [[0, 'rgba(100,0,0,0.9)'], [1, 'rgba(60,0,0,0)']]); } break;
      case 'scorch': for (let i = 0; i < 14; i++) { const a = r() * 7, d = r() * 30; radial(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 18 + r() * 25, [[0, 'rgba(5,3,2,0.85)'], [0.6, 'rgba(20,10,5,0.5)'], [1, 'rgba(30,15,5,0)']]); } break;
      case 'frost': for (let i = 0; i < 24; i++) { x.strokeStyle = `rgba(200,240,255,${0.3 + r() * 0.5})`; x.lineWidth = 1 + r() * 2; x.beginPath(); x.moveTo(64, 64); const a = r() * 7, d = 20 + r() * 40; x.lineTo(64 + Math.cos(a) * d, 64 + Math.sin(a) * d); x.stroke(); } radial(64, 64, 50, [[0, 'rgba(180,230,255,0.6)'], [1, 'rgba(180,230,255,0)']]); break;
      case 'glow': radial(64, 64, 64, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]); break;
      case 'spark': radial(64, 64, 64, [[0, 'rgba(255,255,255,1)'], [0.1, 'rgba(255,255,255,0.9)'], [0.3, 'rgba(255,255,255,0.15)'], [1, 'rgba(255,255,255,0)']]); break;
      case 'smoke': for (let i = 0; i < 12; i++) radial(40 + r() * 48, 40 + r() * 48, 20 + r() * 25, [[0, 'rgba(255,255,255,0.25)'], [1, 'rgba(255,255,255,0)']]); break;
      case 'ring': x.strokeStyle = 'rgba(255,255,255,1)'; x.lineWidth = 6; x.beginPath(); x.arc(64, 64, 58, 0, 7); x.stroke(); radial(64, 64, 62, [[0, 'rgba(255,255,255,0.05)'], [0.85, 'rgba(255,255,255,0.25)'], [1, 'rgba(255,255,255,0)']]); break;
      case 'disc': radial(64, 64, 62, [[0, 'rgba(255,255,255,0.9)'], [0.9, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]); break;
      case 'shadow': radial(64, 64, 62, [[0, 'rgba(0,0,0,0.7)'], [1, 'rgba(0,0,0,0)']]); break;
      case 'rune': { x.strokeStyle = 'white'; x.lineWidth = 3; x.beginPath(); x.arc(64, 64, 58, 0, 7); x.stroke(); x.beginPath(); x.arc(64, 64, 46, 0, 7); x.stroke();
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; x.beginPath(); x.moveTo(64 + Math.cos(a) * 46, 64 + Math.sin(a) * 46); x.lineTo(64 + Math.cos(a + 2.1) * 46, 64 + Math.sin(a + 2.1) * 46); x.stroke(); }
        x.font = '12px serif'; x.fillStyle = 'white'; const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; x.save(); x.translate(64 + Math.cos(a) * 52, 64 + Math.sin(a) * 52); x.rotate(a + Math.PI / 2); x.fillText(runes[i], -4, 4); x.restore(); } } break;
      case 'web': x.strokeStyle = 'rgba(230,230,230,0.7)'; x.lineWidth = 1; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; x.beginPath(); x.moveTo(64, 64); x.lineTo(64 + Math.cos(a) * 64, 64 + Math.sin(a) * 64); x.stroke(); }
        for (let rr = 8; rr < 64; rr += 7) { x.beginPath(); for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI * 2, rad = rr + Math.sin(i * 3) * 1.5; i ? x.lineTo(64 + Math.cos(a) * rad, 64 + Math.sin(a) * rad) : x.moveTo(64 + Math.cos(a) * rad, 64 + Math.sin(a) * rad); } x.stroke(); } break;
      case 'acid': for (let i = 0; i < 10; i++) { const a = r() * 7, d = r() * 30; radial(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 15 + r() * 20, [[0, 'rgba(120,255,60,0.8)'], [1, 'rgba(60,160,20,0)']]); } break;
      case 'crack': x.strokeStyle = 'rgba(0,0,0,0.85)'; x.lineWidth = 3; for (let i = 0; i < 8; i++) { let px = 64, py = 64, a = r() * 7; x.beginPath(); x.moveTo(px, py); for (let j = 0; j < 6; j++) { a += (r() - 0.5); px += Math.cos(a) * 10; py += Math.sin(a) * 10; x.lineTo(px, py); } x.stroke(); } break;
    }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; this.cache['s_' + key] = t; return t;
  }
};

/* ---------- shared materials ---------- */
G.mats = {};
G.mat = function (key, opts) {
  const k = key + (opts ? JSON.stringify(opts) : '');
  if (G.mats[k]) return G.mats[k];
  let m;
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const t = n => G.tex.get(n);
  switch (key) {
    case 'iron': m = std({ color: 0x8a8d94, metalness: 0.85, roughness: 0.38, normalMap: t('metal').normalMap }); break;
    case 'steel': m = std({ color: 0xc8ccd4, metalness: 0.95, roughness: 0.22 }); break;
    case 'dark': m = std({ color: 0x2b2d33, metalness: 0.8, roughness: 0.4 }); break;
    case 'gold': m = std({ color: 0xffc14d, metalness: 1, roughness: 0.25 }); break;
    case 'bronze': m = std({ color: 0xb87333, metalness: 0.9, roughness: 0.35 }); break;
    case 'leather': m = std({ color: 0x8a5a33, roughness: 0.85, ...t('leather') }); break;
    case 'darkleather': m = std({ color: 0x3a2618, roughness: 0.8, ...t('leather') }); break;
    case 'wood': m = std({ color: 0xffffff, roughness: 0.85, ...t('wood') }); break;
    case 'bone': m = std({ color: 0xe8dcc0, roughness: 0.7, ...t('bone') }); break;
    case 'rock': m = std({ color: 0x8a8580, roughness: 0.95, ...t('rock') }); break;
    case 'cloth': m = std({ color: 0xffffff, roughness: 1, ...t('cloth') }); break;
    case 'skin': m = std({ color: 0xd9a07a, roughness: 0.75, ...t('skin') }); break;
    case 'emissive': m = std({ color: 0x000000, emissive: new THREE.Color(opts.c), emissiveIntensity: opts.i || 2, roughness: 1 }); break;
    case 'col': m = std({ color: opts.c, roughness: opts.r ?? 0.7, metalness: opts.m ?? 0, ...(opts.t ? t(opts.t) : {}) }); if (opts.e) { m.emissive = new THREE.Color(opts.e); m.emissiveIntensity = opts.ei || 1; } if (!opts.t && (opts.m ?? 0) >= 0.6 && G.settings.quality !== 'low') { m.normalMap = t('metal').normalMap; m.normalScale = new THREE.Vector2(0.45, 0.45); } if (opts.tr) { m.transparent = true; m.opacity = opts.tr; m.depthWrite = false; } if (opts.ds) m.side = THREE.DoubleSide; break;
  }
  m.userData.kind = (opts && opts.t) || key;
  G.mats[k] = m; return m;
};
