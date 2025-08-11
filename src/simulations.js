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

// === Helper para amarrar UI a cada sim ===
function attachUI(group, params, schema){
  group.userData.params = params;
  group.userData.api = {
    set: (k, v) => { if (k in params) params[k] = v; },
    get: (k)    => params[k],
    reset: () => {
      schema.forEach(ctrl => {
        if ('value' in ctrl && ctrl.id in params) params[ctrl.id] = ctrl.value;
      });
    }
  };
  group.userData.uiSchema = schema; // lido pelo painel de controles
}

/* ============ SIMULAÇÕES EXEMPLO ============ */

/** 5a — Orbitais (placeholder com pontos “densidade”) */
function simOrbitaisPlaceholder(group){
  const params = {
    rotSpeed: 0.35,   // velocidade de rotação
    pointSize: 0.08,  // tamanho do ponto
    lobeBias: 1.2     // 1.0–2.0 aumenta lóbulos (|cosθ|)
  };

  const NUM = 2800;
  const g = new THREE.BufferGeometry();
  const a = new Float32Array(NUM*3);
  for(let i=0;i<NUM;i++){
    const r = 1.2 + Math.random()*4.0;
    const u = Math.random()*2-1;
    const bias = Math.pow(Math.abs(u), params.lobeBias);
    const th = Math.acos(Math.sign(u)*bias);
    const ph = Math.random()*Math.PI*2;
    a[i*3]   = Math.sin(th)*Math.cos(ph)*r;
    a[i*3+1] = Math.cos(th)*r;
    a[i*3+2] = Math.sin(th)*Math.sin(ph)*0.7*r;
  }
  g.setAttribute('position', new THREE.BufferAttribute(a,3));
  const mat = new THREE.PointsMaterial({ color:0x9fdcff, size:params.pointSize, transparent:true, opacity:0.85 });
  const pts = new THREE.Points(g, mat);
  pts.position.set(0, 0, 0.3);

  group.add(pts);
  group.userData.objects.push(pts);

  group.userData.anim = (dt)=>{
    pts.rotation.y += dt * params.rotSpeed;
    pts.rotation.x += dt * (params.rotSpeed * 0.45);
    pts.material.size = params.pointSize;
  };

  attachUI(group, params, [
    { id:'rotSpeed',  label:'Velocidade de rotação', type:'range', min:0.0, max:1.0, step:0.01, value:0.35 },
    { id:'pointSize', label:'Tamanho dos pontos',     type:'range', min:0.02, max:0.20, step:0.01, value:0.08 },
    { id:'lobeBias',  label:'Ênfase dos lóbulos',     type:'range', min:0.8,  max:2.0,  step:0.05, value:1.2 }
  ]);
}


/** 7 — Fotoelétrico (placeholder) */
function simFotoeletricoPlaceholder(group){
  const params = {
    frequency: 1.0,     // 1.0 = limiar de referência
    photonRate: 0.35,   // probabilidade de spawn por frame
    electronGain: 1.0   // escala da velocidade do elétron
  };

  const alvo = new THREE.Mesh(
    new THREE.BoxGeometry(10, 3, 0.5),
    new THREE.MeshStandardMaterial({ color:0x334855, metalness:0.4, roughness:0.4 })
  );
  alvo.position.set(-4, -1.5, 0);
  group.add(alvo);

  const emissor = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 16, 16),
    new THREE.MeshStandardMaterial({ color:0xffdd66, emissive:0x664400, emissiveIntensity:0.6 })
  );
  emissor.position.set(-10, 3, 1);
  group.add(emissor);

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
    const base = 0.9 + Math.random()*0.6;
    const speed = (0.6 + (params.frequency-0.9)*1.4) * params.electronGain * base;
    e.userData.v = new THREE.Vector3(speed, 0.2 - Math.random()*0.4, 0);
    group.add(e); eletrons.push(e);
  }

  group.userData.anim = (dt)=>{
    if (Math.random() < params.photonRate) spawnPhoton();

    for (let i=fotons.length-1;i>=0;i--){
      const f = fotons[i];
      f.position.addScaledVector(f.userData.v, dt*12);
      // colisão aproximada com o alvo
      if (f.position.x > -5.5 && f.position.y < 0.2 && f.position.y > -3.2){
        if (params.frequency >= 0.9) spawnElectron(new THREE.Vector3(-5.4, f.position.y, 0));
        group.remove(f); f.geometry.dispose(); f.material.dispose(); fotons.splice(i,1);
      } else if (f.position.x > 12){
        group.remove(f); f.geometry.dispose(); f.material.dispose(); fotons.splice(i,1);
      }
    }

    for (let i=eletrons.length-1;i>=0;i--){
      const e = eletrons[i];
      e.position.addScaledVector(e.userData.v, dt*8);
      if (e.position.x > 12){
        group.remove(e); e.geometry.dispose(); e.material.dispose(); eletrons.splice(i,1);
      }
    }
  };

  group.userData.objects.push(alvo, emissor);

  attachUI(group, params, [
    { id:'frequency',   label:'Frequência relativa',   type:'range', min:0.6, max:1.6, step:0.02, value:1.0 },
    { id:'photonRate',  label:'Taxa de fótons',        type:'range', min:0.05, max:0.8, step:0.01, value:0.35 },
    { id:'electronGain',label:'Ganho do elétron',      type:'range', min:0.5,  max:2.0, step:0.05, value:1.0 }
  ]);
}


/** 4 — Stern–Gerlach (placeholder simples) */
function simSternGerlachPlaceholder(group){
  const params = {
    fieldStrength: 1.0, // 0.4–2.0
    flip: 1,            // +1 ou -1
    spawnRate: 0.7      // probabilidade por frame
  };

  const forno = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 2.2, 16),
    new THREE.MeshStandardMaterial({ color:0x888, metalness:0.5, roughness:0.5 })
  );
  forno.position.set(-10, 0, 0);
  group.add(forno);

  const campo = new THREE.Mesh(
    new THREE.BoxGeometry(6, 4, 0.5),
    new THREE.MeshStandardMaterial({ color:0x223546, metalness:0.2, roughness:0.6, transparent:true, opacity:0.25 })
  );
  campo.position.set(-3, 0, 0);
  group.add(campo);

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
    s.userData.spin = (Math.random() < 0.5) ? +1 : -1;
    group.add(s); particulas.push(s);
  }

  group.userData.anim = (dt)=>{
    if (Math.random() < params.spawnRate) spawn();
    for (let i=particulas.length-1;i>=0;i--){
      const p = particulas[i];
      if (p.position.x > -6 && p.position.x < 0){
        p.position.y += p.userData.spin * params.flip * params.fieldStrength * dt * 2.0;
      }
      p.position.x += dt * 6.0;

      if (p.position.x > 6){
        group.remove(p); p.geometry.dispose(); p.material.dispose(); particulas.splice(i,1);
      }
    }
  };

  group.userData.objects.push(forno, campo, anteparo);

  attachUI(group, params, [
    { id:'fieldStrength', label:'Intensidade do campo', type:'range', min:0.4, max:2.0, step:0.1, value:1.0 },
    { id:'flip',          label:'Inverter campo',       type:'toggle', value:false }, // false=+1, true=-1
    { id:'spawnRate',     label:'Taxa de partículas',   type:'range', min:0.1, max:1.0, step:0.05, value:0.7 }
  ]);

  // Adapter: quando UI marcar toggle, converte para +1/-1
  const origSet = group.userData.api.set;
  group.userData.api.set = (k, v) => {
    if (k === 'flip') params.flip = (v ? -1 : +1);
    else origSet(k, v);
  };
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

// === NOVO: criar simulação local renderizável em RT (sem mover câmera) ===
export async function createRTSimulation(nodeId){
  // cena e câmera locais (não mexem na cena principal)
  const scene  = new THREE.Scene();
  scene.background = new THREE.Color(0x001825);
  const camera = new THREE.PerspectiveCamera(50, 16/9, 0.1, 100);
  camera.position.set(0, 0, 12);

  // luzes básicas
  const amb = new THREE.AmbientLight(0xffffff, 0.8);
  const dir = new THREE.DirectionalLight(0xffffff, 0.7);
  dir.position.set(5,8,6);
  scene.add(amb, dir);

  // group “palco” reaproveitando sua API central
  const group = new THREE.Group();
  scene.add(group);
  initCenterSim(group);              // cria “mesa”, anel etc (se quiser manter)
  await loadNodeSimulation(group, nodeId); // monta a sim do nó

  // atualizador e destruidor
  function update(dt){ updateCenterSim(group, dt); }

  function dispose(){
    disposeNodeSimulation(group);
    // limpa tudo do local scene (plane/geometrias restantes)
    scene.traverse(obj=>{
      if (obj.isMesh || obj.isPoints || obj.isLine){
        obj.geometry && obj.geometry.dispose && obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach(m=>m && m.dispose && m.dispose());
        else obj.material && obj.material.dispose && obj.material.dispose();
      }
    });
  }

  return { scene, camera, update, dispose, group };
}

export function getUISchema(nodeId, group){
  // se a sim já publicou seu schema, use-o
  if (group?.userData?.uiSchema) return group.userData.uiSchema;

  // fallback por nó (caso alguma sim não publique)
  switch (nodeId){
    case '5a': return [
      { id:'rotSpeed',  label:'Velocidade de rotação', type:'range', min:0.0, max:1.0, step:0.01, value:0.35 },
      { id:'pointSize', label:'Tamanho dos pontos',     type:'range', min:0.02, max:0.20, step:0.01, value:0.08 },
      { id:'lobeBias',  label:'Ênfase dos lóbulos',     type:'range', min:0.8,  max:2.0,  step:0.05, value:1.2 }
    ];
    case '7': return [
      { id:'frequency',   label:'Frequência relativa', type:'range', min:0.6, max:1.6, step:0.02, value:1.0 },
      { id:'photonRate',  label:'Taxa de fótons',      type:'range', min:0.05, max:0.8, step:0.01, value:0.35 },
      { id:'electronGain',label:'Ganho do elétron',    type:'range', min:0.5,  max:2.0, step:0.05, value:1.0 }
    ];
    case '4': return [
      { id:'fieldStrength', label:'Intensidade do campo', type:'range', min:0.4, max:2.0, step:0.1, value:1.0 },
      { id:'flip',          label:'Inverter campo',       type:'toggle', value:false },
      { id:'spawnRate',     label:'Taxa de partículas',   type:'range', min:0.1, max:1.0, step:0.05, value:0.7 }
    ];
    default: return [];
  }
}
