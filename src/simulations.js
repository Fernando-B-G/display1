import * as THREE from 'three';

/** Grupo central básico (já existia) */
export function initCenterSim(group){
  group.clear();
  // base: uma “mesa” para receber as simulações
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 14),
    new THREE.MeshBasicMaterial({ color:0x001825 })
  );
  plate.position.set(0, 0, 0);
  group.add(plate);

  group.userData = { currentId: null, objects: [], anim: null, ring: null };
}

/** Atualização por frame (se necessário pela sim atual) */
export function updateCenterSim(group, dt){
  const anim = group.userData?.anim;
  if (typeof anim === 'function') anim(dt);
}

/** Ajusta cor de um elemento “ambiental” da sim (se presente) */
export function setCenterSimColor(group, hex){
  // opcional: se quiser manter um anel decorativo
  if (!group.userData.ring) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(6.5, 0.12, 16, 128),
      new THREE.MeshStandardMaterial({ color:hex, metalness:0.3, roughness:0.3 })
    );
    ring.position.set(0, 0, 0.2);
    group.add(ring);
    group.userData.ring = ring;
  } else {
    group.userData.ring.material.color.setHex(hex);
    group.userData.ring.material.needsUpdate = true;
  }
}

/** Limpa sim atual (geometrias, materiais, animação) */
export function disposeNodeSimulation(group){
  const objs = group.userData?.objects || [];
  objs.forEach(o => {
    if (o && o.isMesh) {
      o.geometry?.dispose?.();
      if (Array.isArray(o.material)) o.material.forEach(m => m?.dispose?.());
      else o.material?.dispose?.();
      group.remove(o);
    } else if (o && o.isPoints) {
      o.geometry?.dispose?.();
      o.material?.dispose?.();
      group.remove(o);
    }
  });
  group.userData.objects = [];
  group.userData.anim = null;
  group.userData.currentId = null;
}

/** Carrega sim específica por nó */
export async function loadNodeSimulation(group, nodeId){
  // limpa anterior antes de carregar nova
  disposeNodeSimulation(group);
  group.userData.currentId = nodeId;

  if (nodeId === '5a') {
    simOrbitaisPlaceholder(group);
  } else if (nodeId === '7') {
    simFotoeletricoPlaceholder(group);
  } else if (nodeId === '4') {
    simSternGerlachPlaceholder(group);
  } else {
    simFallback(group, nodeId);
  }
}

/* ============ SIMULAÇÕES EXEMPLO ============ */

/** 5a — Orbitais (placeholder com pontos “densidade”) */
function simOrbitaisPlaceholder(group){
  const NUM = 2800;
  const g = new THREE.BufferGeometry();
  const a = new Float32Array(NUM*3);
  for(let i=0;i<NUM;i++){
    const r = 1.2 + Math.random()*4.0;
    const th = Math.acos(2*Math.random()-1);
    const ph = Math.random()*Math.PI*2;
    a[i*3]   = Math.sin(th)*Math.cos(ph)*r;
    a[i*3+1] = Math.cos(th)*r;
    a[i*3+2] = Math.sin(th)*Math.sin(ph)*r*0.7;
  }
  g.setAttribute('position', new THREE.BufferAttribute(a,3));
  const m = new THREE.PointsMaterial({ color:0x9fdcff, size:0.08, transparent:true, opacity:0.85 });
  const pts = new THREE.Points(g, m);
  pts.position.set(0, 0, 0.3);

  group.add(pts);
  group.userData.objects.push(pts);

  group.userData.anim = (dt)=>{
    pts.rotation.y += dt * 0.35;
    pts.material.size = 0.08 + 0.02*Math.sin(performance.now()/500);
  };
}

/** 7 — Fotoelétrico (placeholder) */
function simFotoeletricoPlaceholder(group){
  // alvo (metal)
  const alvo = new THREE.Mesh(
    new THREE.BoxGeometry(10, 3, 0.5),
    new THREE.MeshStandardMaterial({ color:0x334855, metalness:0.4, roughness:0.4 })
  );
  alvo.position.set(-4, -1.5, 0);
  group.add(alvo);

  // emissor “luz”
  const emissor = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 16, 16),
    new THREE.MeshStandardMaterial({ color:0xffdd66, emissive:0x664400, emissiveIntensity:0.6 })
  );
  emissor.position.set(-10, 3, 1);
  group.add(emissor);

  // pontos “elétrons” e “fótons”
  const eletrons = [];
  const fotons = [];

  function spawnPhoton(){
    const geo = new THREE.SphereGeometry(0.12, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color:0xffee88 });
    const p = new THREE.Mesh(geo, mat);
    p.position.copy(emissor.position);
    p.userData.v = new THREE.Vector3(1.6, -0.25 + Math.random()*0.5, 0);
    group.add(p); fotons.push(p);
  }

  function spawnElectron(pos){
    const geo = new THREE.SphereGeometry(0.13, 10, 10);
    const mat = new THREE.MeshBasicMaterial({ color:0x66ffd1 });
    const e = new THREE.Mesh(geo, mat);
    e.position.copy(pos).add(new THREE.Vector3(0.2, 0.2, 0));
    e.userData.v = new THREE.Vector3(1.2 + Math.random()*0.8, 0.2-Math.random()*0.4, 0);
    group.add(e); eletrons.push(e);
  }

  group.userData.anim = (dt)=>{
    // spawn fotons
    if (Math.random() < 0.35) spawnPhoton();

    // move fótons
    for (let i=fotons.length-1;i>=0;i--){
      const f = fotons[i];
      f.position.addScaledVector(f.userData.v, dt*12);
      // colisão aproximada com o alvo
      if (f.position.x > -5.5 && f.position.y < 0.2 && f.position.y > -3.2){
        // “ejetar” elétron
        spawnElectron(new THREE.Vector3(-5.4, f.position.y, 0));
        group.remove(f); f.geometry.dispose(); f.material.dispose(); fotons.splice(i,1);
      } else if (f.position.x > 12){
        group.remove(f); f.geometry.dispose(); f.material.dispose(); fotons.splice(i,1);
      }
    }

    // move elétrons
    for (let i=eletrons.length-1;i>=0;i--){
      const e = eletrons[i];
      e.position.addScaledVector(e.userData.v, dt*8);
      if (e.position.x > 12){
        group.remove(e); e.geometry.dispose(); e.material.dispose(); eletrons.splice(i,1);
      }
    }
  };

  group.userData.objects.push(alvo, emissor);
}

/** 4 — Stern–Gerlach (placeholder simples) */
function simSternGerlachPlaceholder(group){
  // “forno” emissor
  const forno = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 2.2, 16),
    new THREE.MeshStandardMaterial({ color:0x888, metalness:0.5, roughness:0.5 })
  );
  forno.position.set(-10, 0, 0);
  group.add(forno);

  // região do ímã (setas)
  const campo = new THREE.Mesh(
    new THREE.BoxGeometry(6, 4, 0.5),
    new THREE.MeshStandardMaterial({ color:0x223546, metalness:0.2, roughness:0.6, transparent:true, opacity:0.25 })
  );
  campo.position.set(-3, 0, 0);
  group.add(campo);

  // anteparo (detector)
  const anteparo = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 6),
    new THREE.MeshBasicMaterial({ color:0x0b2030 })
  );
  anteparo.position.set(6, 0, 0.1);
  group.add(anteparo);

  const particulas = [];
  function spawn(){
    const g = new THREE.SphereGeometry(0.12, 10, 10);
    const m = new THREE.MeshBasicMaterial({ color:0x9fdcff });
    const s = new THREE.Mesh(g, m);
    s.position.set(-10, 0, 0);
    // spin “up” ou “down”
    s.userData.spin = (Math.random() < 0.5) ? 1 : -1;
    group.add(s); particulas.push(s);
  }

  group.userData.anim = (dt)=>{
    if (Math.random() < 0.5) spawn();
    for (let i=particulas.length-1;i>=0;i--){
      const p = particulas[i];
      // aceleração vertical no ímã depende do spin
      if (p.position.x > -6 && p.position.x < 0){
        p.position.y += p.userData.spin * dt * 2.0;
      }
      p.position.x += dt * 6.0;

      // “detecção” no anteparo (remover)
      if (p.position.x > 6){
        group.remove(p); p.geometry.dispose(); p.material.dispose(); particulas.splice(i,1);
      }
    }
  };

  group.userData.objects.push(forno, campo, anteparo);
}

/** Fallback genérico */
function simFallback(group, nodeId){
  const txt = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 3.6),
    new THREE.MeshBasicMaterial({ color:0x002033 })
  );
  txt.position.set(0, 0, 0.2);
  const label = makeLabel(`Simulação do nó ${nodeId} (placeholder)`);
  label.position.set(0, 0, 0.25);

  group.add(txt, label);
  group.userData.objects.push(txt, label);
  group.userData.anim = null;
}

/* Label planar simples */
function makeLabel(s){
  const w=1024, h=256;
  const canvas = document.createElement('canvas');
  canvas.width=w; canvas.height=h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#001423'; ctx.fillRect(0,0,w,h);
  ctx.fillStyle = '#E6F2FF'; ctx.font='bold 64px Inter,Arial';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(s, w/2, h/2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.MeshBasicMaterial({ map:tex, transparent:true });
  return new THREE.Mesh(new THREE.PlaneGeometry(12, 3), mat);
}
