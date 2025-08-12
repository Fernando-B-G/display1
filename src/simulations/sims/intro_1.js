// src/simulations/sims/intro_1.js
import * as THREE from 'three';

// ===== util: nm -> cor aproximada =====
function wavelengthToRGB(nm){
  let r=0,g=0,b=0;
  if (nm >= 380 && nm < 440) { r = -(nm-440)/(440-380); g = 0; b = 1; }
  else if (nm >= 440 && nm < 490) { r = 0; g = (nm-440)/(490-440); b = 1; }
  else if (nm >= 490 && nm < 510) { r = 0; g = 1; b = -(nm-510)/(510-490); }
  else if (nm >= 510 && nm < 580) { r = (nm-510)/(580-510); g = 1; b = 0; }
  else if (nm >= 580 && nm < 645) { r = 1; g = -(nm-645)/(645-580); b = 0; }
  else if (nm >= 645 && nm <= 780) { r = 1; g = 0; b = 0; }
  let factor = 1;
  if (nm > 700) factor = 0.3 + 0.7*(780 - nm) / (780 - 700);
  else if (nm < 420) factor = 0.3 + 0.7*(nm - 380) / (420 - 380);
  return new THREE.Color(r*factor, g*factor, b*factor);
}

// ===== geometria prisma triangular =====
function makeTriPrism(size=1.6, length=2.2){
  const h = size;
  const w = size*1.2;
  const shape = new THREE.Shape();
  shape.moveTo(-w/2, -h/2);
  shape.lineTo( 0,  h/2);
  shape.lineTo( w/2, -h/2);
  shape.lineTo(-w/2, -h/2);
  const geo = new THREE.ExtrudeGeometry(shape, { depth:length, bevelEnabled:false });
  geo.translate(0,0,-length/2);
  return geo;
}

// ===== canvas do espectro =====
function makeSpectrumCanvas(w=1024, h=256){
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  return { canvas, ctx };
}

function drawContinuous(ctx, w, h, showLabels){
  const stops = [380, 440, 490, 510, 580, 645, 780];
  const grad = ctx.createLinearGradient(0,0,w,0);
  stops.forEach((nm,i)=>{
    grad.addColorStop(i/(stops.length-1), wavelengthToRGB(nm).getStyle());
  });
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = '#08131b';
  ctx.fillRect(0,0,w,h);
  ctx.fillStyle = grad;
  ctx.fillRect(40, 50, w-80, h-100);

  if (showLabels){
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 22px Inter,Arial';
    ctx.textAlign='left';  ctx.fillText('UV', 12, h/2+8);
    ctx.textAlign='right'; ctx.fillText('IR', w-12, h/2+8);
  }
}

function drawEmissionLines(ctx, w, h, wavelengths, showLabels){
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = '#08131b';
  ctx.fillRect(0,0,w,h);
  const y=50; const hh=h-100;
  ctx.fillStyle='rgba(255,255,255,0.06)';
  ctx.fillRect(40,y,w-80,hh);

  const xFromNm = nm => 40 + (w-80) * (nm-380) / (780-380);
  wavelengths.forEach(nm=>{
    ctx.fillStyle = wavelengthToRGB(nm).getStyle();
    ctx.fillRect(xFromNm(nm)-2, y, 4, hh);
  });

  if (showLabels){
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 22px Inter,Arial';
    ctx.textAlign='left';  ctx.fillText('UV', 12, h/2+8);
    ctx.textAlign='right'; ctx.fillText('IR', w-12, h/2+8);
  }
}

// ===== listas de linhas =====
const LINES = {
  hydrogen: [656, 486, 434, 410],      // Balmer
  sodium:   [589, 589.6],
  mercury:  [436, 546, 577, 579],
};

// ===== beams =====
function makeDispersedBeams(group, count=22){
  const list = [];
  for (let i=0;i<count;i++){
    const t = i/(count-1);
    const nm = 380 + t*(780-380);
    const col = wavelengthToRGB(nm);
    const g = new THREE.BoxGeometry(0.02, 0.6, 8.0);
    const m = new THREE.MeshBasicMaterial({ color: col, transparent:true, opacity:0.85 });
    const beam = new THREE.Mesh(g,m);
    beam.position.set(0.4, 0.8, 1.0);
    beam.rotation.y = THREE.MathUtils.degToRad(-24 + t*48);
    group.add(beam);
    list.push(beam);
  }
  return list;
}
function setBeamsVisible(arr, v){ arr.forEach(b=> b.visible = !!v); }
function makeEmissionBeams(group, wavelengths){
  const list = [];
  wavelengths.forEach(nm=>{
    const t = (nm-380)/(780-380);
    const col = wavelengthToRGB(nm);
    const g = new THREE.BoxGeometry(0.03, 0.6, 8.2);
    const m = new THREE.MeshBasicMaterial({ color: col, transparent:true, opacity:1.0 });
    const beam = new THREE.Mesh(g,m);
    beam.position.set(0.4, 0.8, 1.0);
    beam.rotation.y = THREE.MathUtils.degToRad(-22 + t*44);
    group.add(beam);
    list.push(beam);
  });
  return list;
}

// ======= BUILDER PRINCIPAL =======
export function buildSim_1(group){
  // LIMPA e prepara o core
  group.clear();
  group.userData.objects = [];
  group.userData.anim = null;
  group.userData.api = null;
  group.userData.uiSchema = null;

  // === “cenário” === (OBS: a câmera vem do RT: (0,0,12) olhando para (0,0,0))
  // Sol
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 32, 32),
    new THREE.MeshStandardMaterial({
      color: 0xffdd77, emissive: 0xffa500, emissiveIntensity: 1.4,
      roughness: 0.6, metalness: 0.0
    })
  );
  sun.position.set(-7.6, 0.8, 0);
  group.add(sun);

  // Flare (sprite)
  const flareCnv = document.createElement('canvas');
  flareCnv.width = 256; flareCnv.height = 256;
  const fctx = flareCnv.getContext('2d');
  const grd = fctx.createRadialGradient(128,128,0, 128,128,128);
  grd.addColorStop(0, 'rgba(255,220,100,0.95)');
  grd.addColorStop(0.4, 'rgba(255,170,0,0.35)');
  grd.addColorStop(1, 'rgba(255,140,0,0.0)');
  fctx.fillStyle = grd; fctx.fillRect(0,0,256,256);
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(flareCnv),
    transparent:true, depthWrite:false
  }));
  flare.scale.set(3.2,3.2,1);
  flare.position.copy(sun.position).add(new THREE.Vector3(0,0,0.2));
  group.add(flare);

  // Feixe branco antes do prisma
  const preBeam = new THREE.Mesh(
    new THREE.BoxGeometry(6.4, 0.18, 0.18),
    new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.9 })
  );
  preBeam.position.set(-3.6, 0.8, 0);
  group.add(preBeam);

  // Prisma
  const prism = new THREE.Mesh(
    makeTriPrism(1.8, 2.2),
    new THREE.MeshPhysicalMaterial({
      color: 0x99d9ff, transmission: 0.96, thickness: 1.6,
      roughness: 0.12, metalness: 0.0, ior: 1.47, reflectivity: 0.04, transparent: true
    })
  );
  prism.position.set(-0.4, 0.8, 0);
  prism.rotation.y = THREE.MathUtils.degToRad(-16);
  group.add(prism);

  const beamsGroup = new THREE.Group();
  group.add(beamsGroup);
  let beamsContinuous = makeDispersedBeams(beamsGroup, 22);
  let beamsEmission = [];

  // Parede com espectro
  const { canvas:specCanvas, ctx:specCtx } = makeSpectrumCanvas(1024, 256);
  const specTex = new THREE.CanvasTexture(specCanvas);
  specTex.anisotropy = 8; specTex.needsUpdate = true;

  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(8.6, 3.2),
    new THREE.MeshBasicMaterial({ map: specTex })
  );
  wall.position.set(5.6, 0.8, 0);
  wall.rotation.y = THREE.MathUtils.degToRad(8);
  wall.rotation.z = THREE.MathUtils.degToRad(90)
  group.add(wall);

  // Piso
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 10),
    new THREE.MeshBasicMaterial({ color:0x021018 })
  );
  floor.position.set(0,-1.6,0);
  floor.rotation.x = -Math.PI/2;
  group.add(floor);

  // ===== Estado/Parâmetros + funções =====
  const params = {
    source: 'Sol (contínuo)',
    intensity: 1.0,
    spread: 1.0,
    prismAngle: -16,
    showLabels: true
  };

  drawContinuous(specCtx, specCanvas.width, specCanvas.height, params.showLabels);
  specTex.needsUpdate = true;
  setBeamsVisible(beamsContinuous, true);

  function updateBeamsSpread(){
    const base = params.spread;
    const setFan = (arr, offset=0)=>{
      arr.forEach((beam,i)=>{
        const t = i/(arr.length-1 || 1);
        const deg = -22*base + t*(44*base) + offset;
        beam.rotation.y = THREE.MathUtils.degToRad(deg);
      });
    };
    setFan(beamsContinuous, 0);
    setFan(beamsEmission, 0);
  }

  function setSource(type){
    params.source = type;

    beamsEmission.forEach(b=>{
      beamsGroup.remove(b);
      b.geometry.dispose(); b.material.dispose();
    });
    beamsEmission = [];

    if (type === 'Sol (contínuo)'){
      drawContinuous(specCtx, specCanvas.width, specCanvas.height, params.showLabels);
      specTex.needsUpdate = true;
      setBeamsVisible(beamsContinuous, true);
    } else {
      const wl = (type==='Sódio') ? LINES.sodium
               : (type==='Mercúrio') ? LINES.mercury
               : /* Hidrogênio */ LINES.hydrogen;
      drawEmissionLines(specCtx, specCanvas.width, specCanvas.height, wl, params.showLabels);
      specTex.needsUpdate = true;
      setBeamsVisible(beamsContinuous, false);
      beamsEmission = makeEmissionBeams(beamsGroup, wl);
    }
    updateBeamsSpread();
  }

  function setIntensity(v){
    params.intensity = v;
    const k = THREE.MathUtils.clamp(v, 0, 2);
    sun.material.emissiveIntensity = 0.8 + 1.2*k;
    preBeam.material.opacity = 0.3 + 0.7*k;
    [...beamsContinuous, ...beamsEmission].forEach(b=>{
      b.material.opacity = 0.3 + 0.7*k;
    });
  }

  function setPrismAngle(deg){
    params.prismAngle = deg;
    prism.rotation.y = THREE.MathUtils.degToRad(deg);
  }

  function setSpread(v){
    params.spread = THREE.MathUtils.clamp(v, 0.4, 2.0);
    updateBeamsSpread();
  }

  function setLabels(on){
    params.showLabels = !!on;
    if (params.source === 'Sol (contínuo)'){
      drawContinuous(specCtx, specCanvas.width, specCanvas.height, params.showLabels);
    } else {
      const type = params.source;
      const wl = (type==='Sódio') ? LINES.sodium
               : (type==='Mercúrio') ? LINES.mercury
               : LINES.hydrogen;
      drawEmissionLines(specCtx, specCanvas.width, specCanvas.height, wl, params.showLabels);
    }
    specTex.needsUpdate = true;
  }

  // ===== API + UI Schema =====
  const api = {
    get: (k)=>{
      if (k==='intensity') return params.intensity;
      if (k==='spread') return params.spread;
      if (k==='prismAngle') return params.prismAngle;
      if (k==='showLabels') return params.showLabels ? 1 : 0;
      if (k==='sourceIndex'){
        return ['Sol (contínuo)','Sódio','Mercúrio','Hidrogênio'].indexOf(params.source);
      }
      return 0;
    },
    set: (k,v)=>{
      if (k==='intensity') setIntensity(v);
      else if (k==='spread') setSpread(v);
      else if (k==='prismAngle') setPrismAngle(v);
      else if (k==='showLabels') setLabels(!!v);
      else if (k==='source' && typeof v==='string') setSource(v);
      else if (k==='sourceIndex'){
        const list = ['Sol (contínuo)','Sódio','Mercúrio','Hidrogênio'];
        const i = Math.max(0, Math.min(list.length-1, Math.round(v)));
        setSource(list[i]);
      }
    }
  };

  group.userData.api = api;
  group.userData.uiSchema = [
    { id:'source',      label:'Fonte de luz',          type:'select',
      options:['Sol (contínuo)','Sódio','Mercúrio','Hidrogênio'], value:'Sol (contínuo)' },
    { id:'intensity',   label:'Intensidade',           type:'range', min:0,    max:1.5, step:0.01, value:1.0 },
    { id:'spread',      label:'Abertura (dispersão)',  type:'range', min:0.4,  max:2.0, step:0.01, value:1.0 },
    { id:'prismAngle',  label:'Ângulo do prisma',      type:'range', min:-35,  max:35,  step:1,    value:-16 },
    { id:'showLabels',  label:'Mostrar UV / IR',       type:'toggle', value:true }
  ];

  // registra objetos para o dispose do core
  group.userData.objects.push(sun, flare, preBeam, prism, beamsGroup, wall, floor);

  // animação por frame
  let t=0;
  group.userData.anim = (dt)=>{
    t += dt;
    sun.rotation.y += dt * 0.25;
    if (flare.material) flare.material.opacity = 0.8 + 0.2*Math.sin(t*1.6);
    preBeam.scale.y = 1.0 + 0.04*Math.sin(t*2.2);
  };

  // defaults “bonitos”
  setPrismAngle(-16);
  setSpread(1.0);
  setIntensity(1.0);
  setSource('Sol (contínuo)');
}
