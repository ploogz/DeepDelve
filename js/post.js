/* ============================================================
   Lighting post-process (runs between the scene render and bloom, in linear HDR):
   - ambient occlusion from the depth buffer: corners, crevices, contact with the floor darken softly
   - volumetric in-scattering: fog glows around every torch, chandelier, spell and fireball, computed
     analytically per light along each view ray (no ray marching, so it is cheap and noise-free)
   - light grading: gentle vignette and a touch of contrast
   ============================================================ */
'use strict';
G.post = {
  NL: 24,
  init(composer, renderer) {
    this.composer = composer;
    // the scene render keeps its depth so later passes can read it
    [composer.renderTarget1, composer.renderTarget2].forEach(rt => { rt.depthTexture = new THREE.DepthTexture(rt.width, rt.height); rt.depthTexture.type = THREE.UnsignedIntType; });
    const NL = this.NL;
    const mat = new THREE.ShaderMaterial({
      defines: { NL },
      uniforms: {
        tDiffuse: { value: null }, tDepth: { value: null }, projInv: { value: new THREE.Matrix4() }, res: { value: new THREE.Vector2(1, 1) }, projS: { value: 1 },
        aoR: { value: 0.55 }, aoS: { value: 1.0 }, aoOn: { value: 1 }, scat: { value: 0.004 }, fogD: { value: 0.045 }, fogC: { value: new THREE.Color(0x0c1012) },
        vig: { value: 0.32 }, lp: { value: Array.from({ length: NL }, () => new THREE.Vector3()) }, lc: { value: Array.from({ length: NL }, () => new THREE.Vector3()) }, lr: { value: new Array(NL).fill(1) }, nl: { value: 0 }
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `
        uniform sampler2D tDiffuse, tDepth; uniform mat4 projInv; uniform vec2 res; uniform float projS, aoR, aoS, aoOn, scat, fogD, vig;
        uniform vec3 fogC; uniform vec3 lp[NL]; uniform vec3 lc[NL]; uniform float lr[NL]; uniform int nl; varying vec2 vUv;
        vec3 vpos(vec2 uv){ float d=texture2D(tDepth,uv).x; vec4 v=projInv*vec4(uv*2.0-1.0, d*2.0-1.0, 1.0); return v.xyz/v.w; }
        float bayer(vec2 p){ vec2 q=mod(floor(p),4.0); int i=int(q.x)+int(q.y)*4;
          float m[16]; m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
          for(int k=0;k<16;k++) if(k==i) return m[k]/16.0; return 0.0; }
        void main(){
          vec4 col=texture2D(tDiffuse,vUv); float d=texture2D(tDepth,vUv).x; bool sky=d>=0.99999;
          vec3 P=vpos(vUv); float z=-P.z;
          // --- ambient occlusion (24-tap spiral, normals rebuilt from the depth neighbours) ---
          float ao=1.0;
          if(!sky && aoOn>0.5){
            vec2 px=1.0/res;
            vec3 pr=vpos(vUv+vec2(px.x,0.0)), pl=vpos(vUv-vec2(px.x,0.0)), pu=vpos(vUv+vec2(0.0,px.y)), pd=vpos(vUv-vec2(0.0,px.y));
            vec3 dx=abs(pr.z-P.z)<abs(pl.z-P.z)?pr-P:P-pl, dy=abs(pu.z-P.z)<abs(pd.z-P.z)?pu-P:P-pd;
            vec3 N=normalize(cross(dx,dy));
            vec2 qd=mod(floor(gl_FragCoord.xy),2.0); float rp=clamp(aoR*projS/max(z,0.1), 3.0, 90.0), a0=(qd.x*0.5+qd.y*0.25)*2.39996+bayer(floor(gl_FragCoord.xy*0.5))*0.6, occ=0.0;
            for(int i=0;i<24;i++){
              float fi=(float(i)+0.5)/24.0, ang=a0+float(i)*2.39996, rr=rp*sqrt(fi);
              vec3 v=vpos(vUv+vec2(cos(ang),sin(ang))*rr*px)-P; float l=length(v)+1e-4;
              occ+=max(0.0, dot(N,v)/l-0.12)*(1.0-smoothstep(aoR*0.6, aoR*1.6, l));
            }
            ao=clamp(1.0-occ/24.0*aoS*1.9, 0.0, 1.0);
            ao=mix(ao, 1.0, smoothstep(16.0, 34.0, z));
          }
          // each pixel of a 2x2 quad used a different spiral rotation; averaging the quad through the derivatives
          // (outside the branch, so they are defined) cancels the pattern: 96 effective samples, no blur pass
          vec2 qe=mod(floor(gl_FragCoord.xy),2.0);
          ao+=dFdx(ao)*(qe.x<0.5?0.5:-0.5); ao+=dFdy(ao)*(qe.y<0.5?0.5:-0.5);
          float lum=dot(col.rgb, vec3(0.299,0.587,0.114)); ao=mix(ao, 1.0, smoothstep(0.2, 0.55, lum));   // light sources stay bright
          col.rgb*=ao;
          // --- volumetric glow: integral of 1/(h^2+(t-t0)^2) along the ray up to the surface, per light ---
          vec3 D=normalize(P); float L=sky?40.0:min(length(P),40.0); vec3 sc=vec3(0.0);
          for(int i=0;i<NL;i++){
            if(i>=nl) break;
            vec3 q=lp[i]; float t0=dot(q,D); vec3 off=q-D*t0; float h=sqrt(dot(off,off)+0.05);
            float I=(atan((L-t0)/h)-atan(-t0/h))/h;
            float fall=1.0-smoothstep(lr[i]*0.25, lr[i]*0.8, h);
            sc+=lc[i]*I*fall*exp(-fogD*clamp(t0,0.0,L)*0.6);
          }
          col.rgb+=sc*scat*(0.75+fogC*1.5);
          // --- grading: vignette + slight contrast ---
          vec2 c=vUv-0.5; col.rgb*=1.0-vig*dot(c,c)*1.6;
          col.rgb=mix(col.rgb, col.rgb*col.rgb*1.15/(col.rgb+0.15), 0.12);
          gl_FragColor=col;
        }`,
      depthTest: false, depthWrite: false
    });
    const pass = new THREE.ShaderPass(mat);
    const base = pass.render.bind(pass);
    pass.render = (r, wb, rb, dt, mask) => { mat.uniforms.tDepth.value = rb.depthTexture; base(r, wb, rb, dt, mask); };
    this.pass = pass; this.mat = mat;
    return pass;
  },
  // render targets don't resize their depth textures, so swap in fresh ones whenever the size changes
  resize() { if (!this.composer) return; [this.composer.renderTarget1, this.composer.renderTarget2].forEach(rt => { const d = rt.depthTexture; if (d && (d.image.width !== rt.width || d.image.height !== rt.height)) { d.dispose(); rt.depthTexture = new THREE.DepthTexture(rt.width, rt.height); rt.depthTexture.type = THREE.UnsignedIntType; rt.dispose(); } }); },
  // per frame: camera matrices, theme fog, and the nearest bright lights in view space
  update(cam) {
    if (!this.mat) return; this.resize();
    const U = this.mat.uniforms, sz = this.composer.renderTarget1;
    this.pass.enabled = G.settings.quality !== 'low';
    U.projInv.value.copy(cam.projectionMatrixInverse); U.res.value.set(sz.width, sz.height); U.projS.value = cam.projectionMatrix.elements[5] * sz.height * 0.5;
    const fog = G.scene.fog; U.fogD.value = fog.density; U.fogC.value.copy(fog.color);
    U.scat.value = 0.0042 * G.clamp(fog.density / 0.045, 0.5, 1.4);
    U.aoOn.value = G.settings.ao === false ? 0 : 1;
    const list = this._l || (this._l = []); list.length = 0; const wp = this._wp || (this._wp = new G.V3());
    const add = (l, k = 1) => { if (!l || !l.visible || l.intensity <= 0.02) return; l.getWorldPosition(wp); const v = wp.clone().applyMatrix4(cam.matrixWorldInverse); if (v.z > (l.distance || 8)) return; list.push({ v, l, k, s: l.intensity * k / (1 + v.lengthSq() * 0.01) }); };
    G.Lights.pool.forEach(l => add(l)); (G.Lights.fxPool || []).forEach(s => add(s.l, 1.3)); (G.Lights.projPool || []).forEach(l => add(l, 1.4));
    if (G.player && G.player.V && G.player.V.orbLight && G.player.V.root.visible) add(G.player.V.orbLight, 0.5);
    (G.enemies && G.enemies.list || []).forEach(e => { if (e.light && e.root.visible) add(e.light, 0.8); });
    list.sort((a, b) => b.s - a.s);
    const n = Math.min(this.NL, list.length);
    for (let i = 0; i < n; i++) { const o = list[i], c = o.l.color, I = o.l.intensity * o.k; U.lp.value[i].copy(o.v); U.lc.value[i].set(c.r * I, c.g * I, c.b * I); U.lr.value[i] = o.l.distance || 8; }
    U.nl.value = n;
  }
};
