// src/simulations/sims/photoelectric_7.js
import * as THREE from 'three';

export function buildSim_7(group){
  // ======= Parâmetros =======
  const params = {
    intensity_pct: 50,  // 0..100 (controle do usuário)
    frequency_nm: 550,  // 100..840 nm (controle do usuário)
    workfunc_eV: 2.3,   // φ (eV) metal genérico (ex.: Na ~2.3eV) — pode expor se quiser
    // compat com seu roteiro (fallbacks/escuta):
    frequency: 1.0,     // fator normalizado vindo do script (0.6, 0.9, 1.2 ...)
    photonRate: 1.0,    // fator para taxa
    electronGain: 1.0   // fator para energia (velocidade)
  };

  // UI padrão (se quiser mostrar controles)
  group.userData.uiSchema = [
    { id:'frequency_nm', type:'range', label:'Frequência (nm)', min:100, max:840, step:1, value:params.frequency_nm },
    { id:'intensity_pct', type:'range', label:'Intensidade (%)', min:0, max:100, step:1, value:params.intensity_pct }
  ];

  // ======= Cena local =======
  const root = new THREE.Group();
  root.position.set(0, 0.35, 0);
  group.add(root);

  const amb = new THREE.AmbientLight(0xffffff, 0.5);
  const key = new THREE.DirectionalLight(0xffffff, 0.7); key.position.set(2,3,2);
  root.add(amb, key);

  // ======= Tubo (horizontal) =======
  const tubeLen = 6.0, tubeR = 0.6;
  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(tubeR, tubeR, tubeLen, 48, 1, true),
    new THREE.MeshPhongMaterial({ color:0x88a0c8, transparent:true, opacity:0.15, side:THREE.DoubleSide })
  );
  tube.rotation.z = Math.PI/2;
  root.add(tube);

  // ======= Eletrodos (discos) =======
  const elR = tubeR * 0.9, elT = 0.12;
  const leftEl = new THREE.Mesh(
    new THREE.CylinderGeometry(elR, elR, elT, 64),
    new THREE.MeshPhongMaterial({ color:0x4d6a8f, emissive:0x0, shininess:50 })
  );
  leftEl.position.set(-tubeLen/2 + elT/2, 0, 0);
  leftEl.rotation.z = Math.PI/2;
  const rightEl = leftEl.clone();
  rightEl.position.set( tubeLen/2 - elT/2, 0, 0);
  rightEl.material = leftEl.material.clone();
  rightEl.material.color.setHex(0x6b5f3a);
  root.add(leftEl, rightEl);

  // ======= Lanterna (acima do eletrodo esquerdo) =======
  const lamp = new THREE.Group();
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.36, 24),
    new THREE.MeshPhongMaterial({ color:0x666666, shininess:60 })
  );
  head.rotation.x = -Math.PI/2;
  head.position.set(0.3, 0, 0);
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.10, 0.4, 16),
    new THREE.MeshPhongMaterial({ color:0x333333 })
  );
  body.rotation.x = -Math.PI/2;
  body.position.set(-0.1, 0, 0);
  lamp.add(head, body);
  lamp.lookAt(leftEl.position);
  root.add(lamp);

  // ======= Feixe (plano) do bocal da lanterna ao eletrodo =======
  const beamLen = 0.55; // lanterna -> topo do eletrodo
  const beamGeom = new THREE.PlaneGeometry(beamLen, 0.28);
  const beamMat  = new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.0, side:THREE.DoubleSide });
  const beam = new THREE.Mesh(beamGeom, beamMat);
  beam.position.copy(lamp.position);
  beam.lookAt(leftEl.position);
  beam.translateZ(-beamLen/2);

  root.add(beam);

  // ======= Fio externo (simples curva) =======
  const wire = makeWireCurve(new THREE.Vector3(-tubeLen/2, -0.4, 0), new THREE.Vector3(tubeLen/2, -0.4, 0));
  root.add(wire);

  // ======= Eletrons (instanced) =======
  const MAX_E = 400; // instâncias máximas
  const eGeom = new THREE.SphereGeometry(0.035, 10, 10);
  const eMat  = new THREE.MeshBasicMaterial({ color:0x8ff0ff, transparent:true, opacity:0.95 });
  const electrons = new THREE.InstancedMesh(eGeom, eMat, MAX_E);
  electrons.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  root.add(electrons);

  // estado dos elétrons
  const eState = new Array(MAX_E).fill(null).map(()=>({ alive:false, x:0, y:0, vx:0, life:0 }));
  let eCursor = 0;

  // ======= Aux: física simplificada =======
  const h_c_eVnm = 1240.0; // eV·nm
  function photonEnergy_eV(lambda_nm){ return h_c_eVnm / lambda_nm; }
  function wavelengthToHex(lambda_nm){
    // 380–740 nm visível; extrapolamos um pouco pros 100–840
    const clamped = Math.max(380, Math.min(740, lambda_nm));
    const t = (clamped - 380) / (740-380);
    const rgb = hsv2rgb( 0.75 - 0.75*t, 1.0, 1.0 ); // de violeta (0.75) a vermelho (0)
    return (rgb.r<<16) | (rgb.g<<8) | (rgb.b);
  }
  function hsv2rgb(h,s,v){
    const i = Math.floor(h*6); const f = h*6 - i;
    const p = v*(1-s), q = v*(1-f*s), t = v*(1-(1-f)*s);
    const m = [ [v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q] ][(i%6+6)%6];
    return { r:Math.round(m[0]*255), g:Math.round(m[1]*255), b:Math.round(m[2]*255) };
  }

  // mapeamento compatível com seu roteiro:
  // frequency (0.0..1.2?) -> 380..740 nm (inverso: frequência↑ => lambda↓)
  function normalizedToNm(f){
    // centro 0.9 ~ 450 nm; simples mapeamento sensato
    const fClamped = Math.max(0.1, Math.min(1.5, f));
    // mapeia [0.1..1.5] para [780..350] nm (inverso)
    const t = (fClamped - 0.1) / (1.5 - 0.1);
    return 780 - t*(780-350);
  }

  // ======= Spawner =======
  const tmpMat = new THREE.Matrix4();
  function spawnElectron(speed){
    const i = eCursor; eCursor = (eCursor+1) % MAX_E;
    const s = eState[i];
    s.alive = true;
    // nasce no lado interno do eletrodo esquerdo
    s.x = -tubeLen/2 + elT*0.6;
    s.y = (Math.random()*2-1)* (tubeR*0.6);
    s.vx = speed * (0.8 + 0.4*Math.random()); // pequena variação
    s.life = 0;

    tmpMat.makeTranslation(s.x, s.y, 0);
    electrons.setMatrixAt(i, tmpMat);
    electrons.instanceMatrix.needsUpdate = true;
  }

  // ======= Atualização do feixe e emissão =======
  function updateBeam(){
    const hex = wavelengthToHex(params.frequency_nm);
    beam.material.color.setHex(hex);
    beam.material.opacity = (params.intensity_pct/100) * 0.8;
    beam.material.needsUpdate = true;
  }
  updateBeam();

  // ======= API =======
  group.userData.api = {
    set:(k, v)=>{
      // Controles nativos
      if (k === 'frequency_nm'){
        params.frequency_nm = Number(v)||params.frequency_nm;
        updateBeam();
        return;
      }
      if (k === 'intensity_pct'){
        params.intensity_pct = Math.max(0, Math.min(100, Number(v)||0));
        updateBeam();
        return;
      }
      // Parâmetros do roteiro (compat)
      if (k === 'frequency'){
        params.frequency = Number(v)||params.frequency;
        // converte para nm para manter coerência visual
        params.frequency_nm = Math.max(100, Math.min(840, normalizedToNm(params.frequency)));
        updateBeam();
        return;
      }
      if (k === 'photonRate'){
        params.photonRate = Number(v)||1.0;
        return;
      }
      if (k === 'electronGain'){
        params.electronGain = Number(v)||1.0;
        return;
      }
      if (k === 'workfunc_eV'){
        params.workfunc_eV = Math.max(0, Number(v)||params.workfunc_eV);
        return;
      }
    },
    get:(k)=> params[k]
  };

  // ======= Animação =======
  let t=0, acc=0;
  group.userData.anim = (dt)=>{
    t += dt;

    // taxa de emissão (aprox): base por intensidade (el/s)
    const E = photonEnergy_eV(params.frequency_nm);
    const over = Math.max(0, E - params.workfunc_eV);           // excesso de energia (eV)
    const canEmit = over > 0;

    // taxa: 0..(200 el/s) escalada por intensidade e photonRate
    const baseRate = 200 * (params.intensity_pct/100) * params.photonRate * (canEmit?1:0);
    acc += dt * baseRate;
    while (acc >= 1.0) {
      acc -= 1.0;
      if (canEmit){
        // velocidade proporcional a sqrt(E-φ); ganho extra do roteiro
        const v = 1.5 * Math.sqrt(over) * params.electronGain + 0.3;
        spawnElectron(v);
      }
    }

    // mover elétrons para a direita (até o eletrodo direito)
    for (let i=0;i<MAX_E;i++){
      const s = eState[i]; if (!s.alive) continue;
      s.x += s.vx * dt;
      s.life += dt;

      // colisão simplificada (parede do tubo)
      if (Math.abs(s.y) > tubeR*0.85){ s.y = Math.sign(s.y)*tubeR*0.85; s.vx *= 0.98; }

      // chegou ao eletrodo direito?
      if (s.x >= tubeLen/2 - elT*0.6 || s.life > 6.0){
        s.alive = false;
        tmpMat.makeScale(0,0,0);
      } else {
        tmpMat.makeTranslation(s.x, s.y, 0);
      }
      electrons.setMatrixAt(i, tmpMat);
    }
    electrons.instanceMatrix.needsUpdate = true;

    // brilho sutil nos eletrodos em função de emissão
    const glow = canEmit ? 0.2 + 0.3*Math.min(1, params.intensity_pct/100) : 0.05;
    leftEl.material.emissive.setRGB(glow, glow*0.9, glow*0.5);
    rightEl.material.emissive.setRGB(glow*0.4, glow*0.6, glow);
  };

  // ======= Dispose =======
  group.userData.dispose = ()=>{
    root.removeFromParent();
    tube.geometry.dispose(); tube.material.dispose();
    leftEl.geometry.dispose(); leftEl.material.dispose();
    rightEl.geometry.dispose(); rightEl.material.dispose();
    beam.geometry.dispose(); beam.material.dispose();
    electrons.geometry.dispose(); electrons.material.dispose();
    wire.children.forEach(l => l.geometry.dispose());
    wire.children.forEach(l => l.material.dispose && l.material.dispose());
  };

  // ======= Helpers =======
  function makeWireCurve(a, b){
    const mid = a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(0, -0.6, 0));
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const pts = curve.getPoints(40);
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const m = new THREE.LineBasicMaterial({ color:0x333333, transparent:true, opacity:0.9 });
    return new THREE.Line(g, m);
  }
}
