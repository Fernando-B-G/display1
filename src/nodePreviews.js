// src/nodePreviews.js
import * as THREE from 'three';

export function createPreviewFor(id){
  // cena/câmera padrão 16:9
  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 16/9, 0.1, 100);
  camera.position.set(0, 0, 12);
  scene.background = new THREE.Color(0x001522);

  const amb = new THREE.AmbientLight(0xffffff, 0.8);
  const dir = new THREE.DirectionalLight(0xffffff, 0.7);
  dir.position.set(5,8,6);
  scene.add(amb, dir);

  switch(id){
    case '1' : return introPrismPreview(scene, camera);      // Introdução (prisma e espectro)
    case '2' : return hydrogenSpectrumPreview(scene, camera);// Espectro H
    case '3' : return bohrPreview(scene, camera);            // Átomo de Bohr
    case '4' : return sternGerlachPreview(scene, camera);    // Stern–Gerlach
    case '5a': return orbitalPreview(scene, camera);         // Schrödinger (orbitais)
    case '5b': return uncertaintyPreview(scene, camera);     // Matricial / Incerteza
    case '5c': return blochPreview(scene, camera);           // Formalismo unificado (qubit)
    case '6' : return planckPreview(scene, camera);          // Corpo negro
    case '7' : return photoelectricPreview(scene, camera);   // Fotoelétrico
    case '8' : return doubleSlitPreview(scene, camera);      // Dupla fenda
    case '9' : return angMomPreview(scene, camera);          // Momento angular / números quânticos
    case '10': return radioactivityPreview(scene, camera);   // Curie / Radioatividade
    default  : return particlesFallback(scene, camera);      // genérico
  }
}

/* ---------- 1: Introdução — prisma e espectro animado ---------- */
function introPrismPreview(scene, camera){
  // feixe incidente
  const beam = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-10,2,0),
      new THREE.Vector3(-2.2,2,0)
    ]),
    new THREE.LineBasicMaterial({ color:0x88caff, transparent:true, opacity:0.9 })
  );
  scene.add(beam);

  // prisma triangular semi-transparente
  const prismGeo = new THREE.ConeGeometry(2.2, 3.2, 3);
  const prismMat = new THREE.MeshStandardMaterial({
    color:0x244a6a, metalness:0.2, roughness:0.4, transparent:true, opacity:0.6
  });
  const prism = new THREE.Mesh(prismGeo, prismMat);
  prism.rotation.z = Math.PI; // base para baixo
  prism.position.set(0,2,0);
  scene.add(prism);

  // tela do espectro (CanvasTexture)
  const w=256, h=64;
  const cnv = document.createElement('canvas'); cnv.width=w; cnv.height=h;
  const ctx = cnv.getContext('2d');
  const tex = new THREE.CanvasTexture(cnv);
  const spectrum = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 3),
    new THREE.MeshBasicMaterial({ map: tex, transparent:true })
  );
  spectrum.position.set(7,2,0.01);
  scene.add(spectrum);

  function hsvToRgb(h,s,v){
    let r,g,b,i=Math.floor(h*6), f=h*6-i, p=v*(1-s), q=v*(1-f*s), t=v*(1-(1-f)*s);
    switch(i%6){case 0:r=v,g=t,b=p;break;case 1:r=q,g=v,b=p;break;case 2:r=p,g=v,b=t;break;case 3:r=p,g=q,b=v;break;case 4:r=t,g=p,b=v;break;case 5:r=v,g=p,b=q;break;}
    return [Math.round(r*255),Math.round(g*255),Math.round(b*255)];
  }

  function drawSpectrum(angle){
    const img = ctx.createImageData(w,h);
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const u = x/w;
        // deslocamento simples dependente do "ângulo"
        const disp = (u-0.5) * (0.6 + 0.8*Math.abs(angle));
        const hue = 0.7 - u*0.7 + disp*0.05;
        const rgb = hsvToRgb((hue%1+1)%1, 1.0, 1.0);
        const i=(y*w+x)*4;
        img.data[i]=rgb[0]; img.data[i+1]=rgb[1]; img.data[i+2]=rgb[2]; img.data[i+3]=235;
      }
    }
    ctx.putImageData(img,0,0);
    tex.needsUpdate = true;
  }

  return {
    scene, camera,
    step:(dt)=>{
      const t = performance.now()*0.001;
      const angle = Math.sin(t*0.4)*0.6;
      prism.rotation.y = angle;
      drawSpectrum(angle);
    }
  };
}

/* ---------- 2: Espectro do Hidrogênio (linhas) ---------- */
function hydrogenSpectrumPreview(scene, camera){
  const group = new THREE.Group(); scene.add(group);
  // posições aproximadas das linhas de Balmer no painel
  const xs = [0.26, 0.31, 0.36, 0.40, 0.43];
  const lines = xs.map((x,i)=>{
    const mat = new THREE.MeshBasicMaterial({ color:0x66ccff });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 4.6), mat);
    m.position.set(-6 + x*10, 0, 0);
    group.add(m);
    return m;
  });
  return {
    scene, camera,
    step:()=>{
      const s = 1.0 + 0.05*Math.sin(performance.now()/600);
      lines.forEach(m=> m.scale.y = s);
    }
  };
}

/* ---------- 3: Átomo de Bohr (transições automáticas) ---------- */
function bohrPreview(scene, camera){
  const nucleus = new THREE.Mesh(
    new THREE.SphereGeometry(0.6,16,16),
    new THREE.MeshStandardMaterial({ color:0xff7777, emissive:0x330000, emissiveIntensity:0.4 })
  );
  scene.add(nucleus);

  const orbits = [];
  for(let n=1;n<=4;n++){
    const tor = new THREE.Mesh(
      new THREE.TorusGeometry(1.5*n, 0.02, 8, 64),
      new THREE.MeshBasicMaterial({ color:0x7fb8ff, transparent:true, opacity: n===1?1:0.35 })
    );
    orbits.push(tor); scene.add(tor);
  }

  const electron = new THREE.Mesh(
    new THREE.SphereGeometry(0.15,12,12),
    new THREE.MeshBasicMaterial({ color:0x66ffe0 })
  );
  scene.add(electron);

  const photon = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color:0xffff88 }));
  photon.visible=false; scene.add(photon);

  const state = { n:3, theta:0, cooldown:0 };

  function placeElectron(){
    const r = 1.5 * state.n;
    electron.position.set(Math.cos(state.theta)*r, Math.sin(state.theta)*r, 0);
    orbits.forEach((o,i)=> o.material.opacity = (i+1<=state.n? 1.0 : 0.25));
  }
  placeElectron();

  function emitPhoton(){
    const a = electron.position.clone();
    const b = new THREE.Vector3(6, 3, 0);
    photon.geometry.setFromPoints([a,b]);
    photon.visible = true;
    setTimeout(()=> photon.visible=false, 220);
  }

  return {
    scene, camera,
    step:(dt)=>{
      state.theta += dt * (1.2/state.n);
      placeElectron();
      state.cooldown -= dt;
      if (state.cooldown <= 0){
        if (state.n>1){
          emitPhoton();
          state.n--;
          state.cooldown = 1.2; // tempo entre transições
        } else {
          // reexcita periodicamente
          state.n = 3 + ((Math.random()<0.5)?0:1);
          state.cooldown = 1.0;
        }
      }
    }
  };
}

/* ---------- 4: Stern–Gerlach (feixe se divide) ---------- */
function sternGerlachPreview(scene, camera){
  const magnet = new THREE.Mesh(
    new THREE.BoxGeometry(6,4,0.5),
    new THREE.MeshStandardMaterial({ color:0x223546, transparent:true, opacity:0.25 })
  );
  magnet.position.set(-2,0,0);
  scene.add(magnet);

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(4,6),
    new THREE.MeshBasicMaterial({ color:0x0b2030 })
  );
  screen.position.set(6,0,0.1);
  scene.add(screen);

  const particles = [];
  function spawn(){
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 10, 10),
      new THREE.MeshBasicMaterial({ color:0x89d6ff })
    );
    s.position.set(-10,0,0);
    s.userData.spin = (Math.random()<0.5)? 1 : -1;
    particles.push(s); scene.add(s);
  }

  return {
    scene, camera,
    step:(dt)=>{
      if(Math.random() < 0.7) spawn();
      for(let i=particles.length-1;i>=0;i--){
        const p = particles[i];
        if(p.position.x > -6 && p.position.x < 0){ p.position.y += p.userData.spin * dt * 2.0; }
        p.position.x += dt*6.5;
        if(p.position.x > 6.2){ scene.remove(p); p.geometry.dispose(); p.material.dispose(); particles.splice(i,1); }
      }
    }
  };
}

/* ---------- 5a: Orbitais (p-orbital |ψ|² ~ cos²θ) ---------- */
function orbitalPreview(scene, camera){
  const N=2600;
  const pos = new Float32Array(N*3);
  for(let i=0;i<N;i++){
    const r = -Math.log(Math.random())*1.6 + 0.2;
    const u = Math.random()*2-1;
    const bias = Math.pow(Math.abs(u), 1.2);
    const theta = Math.acos(Math.sign(u)*bias);
    const phi = Math.random()*Math.PI*2;
    const s = r;
    const x = s*Math.sin(theta)*Math.cos(phi);
    const y = s*Math.cos(theta);
    const z = s*Math.sin(theta)*Math.sin(phi)*0.7;
    pos[i*3]=x; pos[i*3+1]=y; pos[i*3+2]=z;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const m = new THREE.PointsMaterial({ size:0.06, color:0x9fdcff, transparent:true, opacity:0.9 });
  const pts = new THREE.Points(g, m);
  scene.add(pts);

  return {
    scene, camera,
    step:(dt)=>{ pts.rotation.y += dt*0.35; pts.rotation.x += dt*0.15; }
  };
}

/* ---------- 5b: Incerteza (σx vs σp) ---------- */
function uncertaintyPreview(scene, camera){
  const w=360, h=180, cnv=document.createElement('canvas'); cnv.width=w; cnv.height=h;
  const ctx=cnv.getContext('2d'); const tex=new THREE.CanvasTexture(cnv);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(12,6), new THREE.MeshBasicMaterial({ map:tex, transparent:true }));
  scene.add(panel);

  const state = { t:0 };

  function gaussian(ctx, cx, baseY, sigma, color){
    ctx.strokeStyle=color; ctx.lineWidth=2; ctx.beginPath();
    for(let i=0;i<=160;i++){
      const u = (i/160-0.5)*4;
      const y = Math.exp(-(u*u)/(2*sigma*sigma));
      const px = cx + u*50;
      const py = baseY - y*70;
      if(i===0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  function draw(t){
    const sigmaX = 1.2 + 0.9*Math.sin(t*0.7);     // oscila σx
    const sigX = Math.max(0.3, Math.abs(sigmaX));
    const sigmaP = 1.0/Math.max(0.2, sigX);       // σp ~ 1/σx

    ctx.clearRect(0,0,w,h);
    ctx.fillStyle='#031a28'; ctx.fillRect(0,0,w,h);

    ctx.strokeStyle='#5aaaff'; ctx.lineWidth=2; ctx.beginPath();
    ctx.moveTo(w/2, 10); ctx.lineTo(w/2, h-10); ctx.stroke();

    gaussian(ctx, 0.25*w, h*0.7, sigX, '#9fdcff');
    gaussian(ctx, 0.75*w, h*0.7, sigmaP, '#ffd08a');

    ctx.fillStyle='#d8f1ff'; ctx.font='bold 18px Inter,Arial';
    ctx.fillText('Posição', 0.25*w-40, 22);
    ctx.fillText('Momento', 0.75*w-45, 22);
    ctx.font='14px Inter,Arial';
    ctx.fillText(`σx ≈ ${sigX.toFixed(2)}`, 20, h-16);
    ctx.fillText(`σp ≈ ${sigmaP.toFixed(2)}`, w-120, h-16);

    tex.needsUpdate=true;
  }

  draw(0);

  return {
    scene, camera,
    step:(dt)=>{ state.t += dt; draw(state.t); }
  };
}

/* ---------- 5c: Formalismo unificado (Esfera de Bloch) ---------- */
function blochPreview(scene, camera){
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 32, 24),
    new THREE.MeshStandardMaterial({ color:0x0f2740, roughness:0.6, metalness:0.0, transparent:true, opacity:0.5 })
  );
  scene.add(sphere);

  const axes = new THREE.AxesHelper(3); scene.add(axes);

  const dirGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.6, 12);
  const dirMat = new THREE.MeshBasicMaterial({ color:0x66ffcc });
  const arrow = new THREE.Mesh(dirGeo, dirMat);
  arrow.position.set(0, 1.3, 0);
  arrow.rotation.z = Math.PI/2;
  const pivot = new THREE.Group();
  pivot.add(arrow);
  scene.add(pivot);

  const barA = new THREE.Mesh(new THREE.BoxGeometry(0.5,1,0.5), new THREE.MeshBasicMaterial({ color:0x66ccff }));
  const barB = new THREE.Mesh(new THREE.BoxGeometry(0.5,1,0.5), new THREE.MeshBasicMaterial({ color:0xffa14e }));
  barA.position.set(-4, -2, 0);
  barB.position.set(-3, -2, 0);
  scene.add(barA, barB);

  const state = { t: 0, theta: Math.PI/3, phi: Math.PI/5 };

  function apply(){
    const q = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0,1,0), state.phi)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1), state.theta));
    pivot.setRotationFromQuaternion(q);

    const pa = Math.cos(state.theta/2);
    const pb = Math.sin(state.theta/2);
    barA.scale.y = 0.1 + pa*pa*2.0; barA.position.y = -2 + barA.scale.y/2;
    barB.scale.y = 0.1 + pb*pb*2.0; barB.position.y = -2 + barB.scale.y/2;
  }
  apply();

  return {
    scene, camera,
    step:(dt)=>{
      state.t += dt;
      state.phi   += dt * 0.8;                     // precessão
      state.theta  = Math.PI/3 + 0.35*Math.sin(state.t*0.9); // nutação leve
      apply();
    }
  };
}

/* ---------- 6: Corpo negro (curva de Planck animando T) ---------- */
function planckPreview(scene, camera){
  const axis = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-7,-3,0), new THREE.Vector3(7,-3,0),
      new THREE.Vector3(7,-3,0),  new THREE.Vector3(7, 3,0)
    ]),
    new THREE.LineBasicMaterial({ color:0x6aa9ff })
  );
  scene.add(axis);

  const mat = new THREE.LineBasicMaterial({ color:0xffa14e });
  const geom = new THREE.BufferGeometry();
  const line = new THREE.Line(geom, mat);
  scene.add(line);

  let T = 3000; // K
  function planck(x, T){
    // forma qualitativa (normalizada)
    const a = Math.pow(x,3) / (Math.exp(8*x/T) - 1);
    return a;
  }
  function updateCurve(){
    const pts=[];
    for(let i=0;i<=80;i++){
      const x = i/80;
      const y = planck(1.8*x, T);
      pts.push(new THREE.Vector3(-6 + 12*x, -3 + y*8, 0));
    }
    geom.setFromPoints(pts);
  }
  updateCurve();

  return {
    scene, camera,
    step:()=>{
      T = 2500 + 1500*(0.5 + 0.5*Math.sin(performance.now()/1500));
      updateCurve();
    }
  };
}

/* ---------- 7: Efeito fotoelétrico (fótons → elétrons) ---------- */
function photoelectricPreview(scene, camera){
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(10,3,0.5),
    new THREE.MeshStandardMaterial({ color:0x334855, metalness:0.4, roughness:0.4 })
  );
  plate.position.set(-4,-1.5,0);
  scene.add(plate);

  const source = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 12, 12),
    new THREE.MeshStandardMaterial({ color:0xffdd66, emissive:0x664400, emissiveIntensity:0.7 })
  );
  source.position.set(-10,3,1);
  scene.add(source);

  const photons=[], electrons=[];
  function spawnPhoton(){
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.12,8,8), new THREE.MeshBasicMaterial({ color:0xffee88 }));
    p.position.copy(source.position);
    p.userData.v = new THREE.Vector3(1.7, -0.25 + Math.random()*0.5, 0);
    photons.push(p); scene.add(p);
  }
  function spawnElectron(y){
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.12,10,10), new THREE.MeshBasicMaterial({ color:0x66ffd1 }));
    e.position.set(-5.2, y, 0);
    e.userData.v = new THREE.Vector3(1.2 + Math.random()*0.8, 0.2 - Math.random()*0.4, 0);
    electrons.push(e); scene.add(e);
  }

  return {
    scene, camera,
    step:(dt)=>{
      if(Math.random() < 0.35) spawnPhoton();
      for(let i=photons.length-1;i>=0;i--){
        const f = photons[i];
        f.position.addScaledVector(f.userData.v, dt*12);
        if (f.position.x > -5.5 && f.position.y < 0.2 && f.position.y > -3.2){
          spawnElectron(f.position.y);
          scene.remove(f); f.geometry.dispose(); f.material.dispose(); photons.splice(i,1);
        } else if (f.position.x > 12){
          scene.remove(f); f.geometry.dispose(); f.material.dispose(); photons.splice(i,1);
        }
      }
      for(let i=electrons.length-1;i>=0;i--){
        const e = electrons[i];
        e.position.addScaledVector(e.userData.v, dt*8);
        if (e.position.x > 12){
          scene.remove(e); e.geometry.dispose(); e.material.dispose(); electrons.splice(i,1);
        }
      }
    }
  };
}

/* ---------- 8: Dupla fenda (franjas oscilando contraste) ---------- */
function doubleSlitPreview(scene, camera){
  const w=256, h=128, cnv = document.createElement('canvas');
  cnv.width=w; cnv.height=h;
  const ctx = cnv.getContext('2d');
  const tex = new THREE.CanvasTexture(cnv);
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 6),
    new THREE.MeshBasicMaterial({ map: tex, transparent:true })
  );
  scene.add(plane);

  function drawFringes(contrast=1.0){
    const img = ctx.createImageData(w,h);
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const u = x/w;
        const I = 0.15 + 0.85 * (0.5 + 0.5*Math.cos(20*u*Math.PI)) * contrast;
        const c = Math.floor(255*I);
        const i = (y*w + x)*4;
        img.data[i]=c; img.data[i+1]=c; img.data[i+2]=c; img.data[i+3]=255;
      }
    }
    ctx.putImageData(img,0,0); tex.needsUpdate = true;
  }
  let t=0;
  drawFringes(1.0);

  return {
    scene, camera,
    step:(dt)=>{
      t += dt;
      const k = 0.5 + 0.5*Math.sin(t*0.8);
      drawFringes(k);
    }
  };
}

/* ---------- 9: Momento angular / números quânticos ---------- */
function angMomPreview(scene, camera){
  let pts = null;
  const state = { t:0, phase:0, l:0 };

  function makeShape(l){
    if (pts){ scene.remove(pts); pts.geometry.dispose(); pts.material.dispose(); }
    const N=2200, pos=new Float32Array(N*3);
    for(let i=0;i<N;i++){
      const r = -Math.log(Math.random())*1.2 + 0.2;
      const u = Math.random()*2-1;
      const theta=Math.acos(u), phi=Math.random()*Math.PI*2;
      let amp=1;
      if (l===0){ amp = 1; }
      if (l===1){ amp = Math.abs(Math.cos(theta)); }
      if (l===2){ amp = Math.abs(0.5*(3*Math.cos(theta)**2 - 1)); }
      const s=r*(0.6+0.6*amp);
      const x=s*Math.sin(theta)*Math.cos(phi);
      const y=s*Math.cos(theta);
      const z=s*Math.sin(theta)*Math.sin(phi)*0.8;
      pos[i*3]=x; pos[i*3+1]=y; pos[i*3+2]=z;
    }
    const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos,3));
    pts = new THREE.Points(g, new THREE.PointsMaterial({ size:0.06, color:0xc6e6ff, transparent:true, opacity:0.95 }));
    scene.add(pts);
  }
  makeShape(0);

  return {
    scene, camera,
    step:(dt)=>{
      state.t += dt;
      pts.rotation.y += dt*0.15;
      // muda l de tempos em tempos (morfologia 0 -> 1 -> 2 -> 0)
      if (state.t > 2.8){
        state.t = 0;
        state.l = (state.l+1)%3;
        makeShape(state.l);
      }
    }
  };
}

/* ---------- 10: Radioatividade (α, β, γ e barreiras) ---------- */
function radioactivityPreview(scene, camera){
  const sources = [
    { y: 2.0, color:0xff6666, type:'alpha' },
    { y: 0.0, color:0x66aaff, type:'beta' },
    { y:-2.0, color:0xffff88, type:'gamma' }
  ];
  const particles=[];

  const paper = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 0.2), new THREE.MeshStandardMaterial({ color:0xffffff, opacity:0.5, transparent:true }));
  const alu   = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6, 0.2), new THREE.MeshStandardMaterial({ color:0x9aa5b1, opacity:0.5, transparent:true }));
  const lead  = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6, 0.2), new THREE.MeshStandardMaterial({ color:0x7777aa, opacity:0.5, transparent:true }));
  paper.position.set(-2,0,0); alu.position.set(1,0,0); lead.position.set(4,0,0);
  scene.add(paper, alu, lead);

  function spawn(){
    sources.forEach(s=>{
      if (Math.random() > 0.3) return;
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.08,8,8), new THREE.MeshBasicMaterial({ color:s.color }));
      m.position.set(-10, s.y, 0); m.userData.type=s.type;
      particles.push(m); scene.add(m);
    });
  }

  function blocked(type, x){
    if (x>-2.25 && type==='alpha') return true;                       // papel bloqueia α
    if (x> 0.6  && type!=='gamma') return Math.random()<0.6;          // Al bloqueia boa parte de β
    if (x> 3.2)  return Math.random()<0.85;                            // Pb bloqueia maioria de γ
    return false;
  }

  return {
    scene, camera,
    step:(dt)=>{
      if (Math.random()<0.9) spawn();
      for(let i=particles.length-1;i>=0;i--){
        const p = particles[i];
        p.position.x += dt*8;
        if (blocked(p.userData.type, p.position.x)){
          scene.remove(p); p.geometry.dispose(); p.material.dispose(); particles.splice(i,1);
        } else if (p.position.x > 10){
          scene.remove(p); p.geometry.dispose(); p.material.dispose(); particles.splice(i,1);
        }
      }
    }
  };
}

/* ---------- Fallback particulado ---------- */
function particlesFallback(scene, camera){
  const N=1200;
  const g = new THREE.BufferGeometry();
  const arr = new Float32Array(N*3);
  for(let i=0;i<N;i++){
    const R = 0.5 + Math.random()*3.5;
    const a = Math.random()*Math.PI*2;
    const z = (Math.random()-0.5)*1.2;
    arr[i*3]   = Math.cos(a)*R;
    arr[i*3+1] = Math.sin(a)*R*0.4;
    arr[i*3+2] = z;
  }
  g.setAttribute('position', new THREE.BufferAttribute(arr,3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size:0.06, color:0x89d6ff, transparent:true, opacity:0.9 }));
  scene.add(pts);

  return { scene, camera, step:(dt)=>{ pts.rotation.y += dt*0.25; } };
}
