// src/nodePreviews.js
import * as THREE from 'three';

// util normaliza vetor
const tmpV = new THREE.Vector3();

export function createPreviewFor(id){
  // câmera padrão 16:9
  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 16/9, 0.1, 100);
  camera.position.set(0, 0, 12);
  scene.background = new THREE.Color(0x001522);

  const amb = new THREE.AmbientLight(0xffffff, 0.8);
  const dir = new THREE.DirectionalLight(0xffffff, 0.7);
  dir.position.set(5,8,6);
  scene.add(amb, dir);

  switch(id){
    case '5a': return orbitalPreview(scene, camera);         // Schrödinger (orbitais)
    case '4' : return sternGerlachPreview(scene, camera);    // Stern–Gerlach
    case '7' : return photoelectricPreview(scene, camera);   // Fotoelétrico
    case '6' : return planckPreview(scene, camera);          // Corpo negro
    case '8' : return doubleSlitPreview(scene, camera);      // Dupla fenda
    case '2' : return hydrogenSpectrumPreview(scene, camera);// Espectro H
    default  : return particlesFallback(scene, camera);      // genérico
  }
}

/* ---------- 5a: Orbitais (p-orbital |ψ|² ~ cos²(theta)) ---------- */
function orbitalPreview(scene, camera){
  const N=2600;
  const pos = new Float32Array(N*3);
  for(let i=0;i<N;i++){
    // amostragem simples: radial ~ exp(-r/a), angular ~ |cos(theta)| bias
    const r = -Math.log(Math.random())*1.6 + 0.2;
    const u = Math.random()*2-1;                         // cos(theta) ~ U[-1,1]
    const bias = Math.pow(Math.abs(u), 1.2);             // reforça lóbulos
    const theta = Math.acos(Math.sign(u)*bias);          // θ
    const phi = Math.random()*Math.PI*2;                 // φ
    const s = r;
    const x = s*Math.sin(theta)*Math.cos(phi);
    const y = s*Math.cos(theta);                         // lobo ao longo de y
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

/* ---------- 7: Fotoelétrico (fótons -> elétrons) ---------- */
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

/* ---------- 6: Corpo negro (curva de Planck animando T) ---------- */
function planckPreview(scene, camera){
  // eixos simples
  const axis = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-7,-3,0), new THREE.Vector3(7,-3,0), new THREE.Vector3(7,-3,0), new THREE.Vector3(7,3,0)]),
    new THREE.LineBasicMaterial({ color:0x6aa9ff })
  );
  scene.add(axis);

  const mat = new THREE.LineBasicMaterial({ color:0xffa14e });
  const geom = new THREE.BufferGeometry();
  const line = new THREE.Line(geom, mat);
  scene.add(line);

  let T = 3000; // K
  function planck(x, T){
    // x em [0..1] representando frequência normalizada; forma qualitativa
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
    step:(dt)=>{
      T = 2500 + 1500*(0.5 + 0.5*Math.sin(performance.now()/1500));
      updateCurve();
    }
  };
}

/* ---------- 8: Dupla fenda (franjas) ---------- */
function doubleSlitPreview(scene, camera){
  // painel com padrão de interferência
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
      // oscila contraste (0 = sem franjas; 1 = claras)
      const k = 0.5 + 0.5*Math.sin(t*0.8);
      drawFringes(k);
    }
  };
}

/* ---------- 2: Espectro do Hidrogênio (linhas) ---------- */
function hydrogenSpectrumPreview(scene, camera){
  const group = new THREE.Group(); scene.add(group);
  // linhas (posição aproximada em x)
  const lines = [0.26, 0.31, 0.36, 0.40, 0.43].map(x=>{
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.15, 4.6),
      new THREE.MeshBasicMaterial({ color:0x66ccff })
    );
    m.position.set(-6 + x*10, 0, 0);
    group.add(m);
    return m;
  });
  return {
    scene, camera,
    step:(dt)=>{
      const s = 1.0 + 0.05*Math.sin(performance.now()/600);
      lines.forEach(m=> m.scale.y = s);
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
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size:0.06, color:0x89d6ff }));
  scene.add(pts);

  return { scene, camera, step:(dt)=>{ pts.rotation.y += dt*0.25; } };
}
