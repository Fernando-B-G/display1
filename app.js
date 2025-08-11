  // -----------------------
  // Imports (CDN module-friendly)
  // -----------------------
  import * as THREE from 'three';
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js';



/* ======== DOM ======== */
const container = document.getElementById('container');
const nodeTitle = document.getElementById('nodeTitle');
const nodeText  = document.getElementById('nodeText');
const statusEl  = document.getElementById('status');
const playBtn   = document.getElementById('playBtn');
const intensity = document.getElementById('intensity');
const speed     = document.getElementById('speed');

/* ======== Scene ======== */
let scene, camera, renderer, controls, clock;
let starField, mindmapGroup, centerSimGroup;

init();
animate();

/* ======== Data do grafo ======== */
/* Cores */
const COL_A = 0x4ea1ff;   // azul caminho A
const COL_B = 0xffa14e;   // laranja caminho B
const COL_9 = 0x54e89b;   // verde
const COL_10= 0xbc7aff;   // roxo

/* Nós e conexões segundo sua topologia */
const nodes = [
  { id:'1',   label:'1 — Introdução',         path:'hub' },
  { id:'2',   label:'2 — Espectro H',         path:'A'   },
  { id:'3',   label:'3 — Bohr',               path:'A'   },
  { id:'4',   label:'4 — Spin / Estrutura',   path:'A'   },
  { id:'5a',  label:'5a — Schrödinger',       path:'C'   },
  { id:'5b',  label:'5b — Matricial/Incerteza', path:'C' },
  { id:'5c',  label:'5c — Formalismo Unificado', path:'C'},
  { id:'6',   label:'6 — Corpo Negro/Planck', path:'B'   },
  { id:'7',   label:'7 — Fotoelétrico',       path:'B'   },
  { id:'8',   label:'8 — de Broglie/Difração',path:'B'   },
  { id:'9',   label:'9 — Mom.Ang./Números',   path:'extra9' },
  { id:'10',  label:'10 — Curie/Radioatividade', path:'extra10' },
];

const edges = [
  // Caminho A
  ['1','2'], ['2','3'], ['3','4'], ['4','5a'], ['5a','5b'], ['5b','5c'],
  // Caminho B
  ['1','6'], ['6','7'], ['7','8'], ['8','5a'],
  // Extras
  ['3','9'], ['7','10']
];

/* Texto placeholder por nó (substitua pelo seu conteúdo real) */
const contentById = {
  '1':  { title:'1 — Introdução',
          text:`Ponto de partida: espectros contínuos e de linhas. Escolha entre trilha A (linhas → Bohr → spin → formalismo) ou trilha B (corpo negro → fotoelétrico → de Broglie → formalismo).`},
  '2':  { title:'2 — Espectro do Hidrogênio',
          text:`Séries de Balmer/Lyman mostram regularidades matemáticas nas linhas; pista de níveis discretos.`},
  '3':  { title:'3 — Átomo de Bohr',
          text:`Órbitas quantizadas explicam as linhas do hidrogênio; prepara números quânticos e estrutura fina.`},
  '4':  { title:'4 — Spin e Estrutura Fina',
          text:`Stern–Gerlach e efeitos relativísticos explicam a multiplicação de linhas e o efeito Zeeman.`},
  '5a': { title:'5a — Equação de Schrödinger',
          text:`Função de onda, orbitais como densidade de probabilidade e estados estacionários.`},
  '5b': { title:'5b — Mecânica Matricial e Incerteza',
          text:`Heisenberg: observáveis como operadores não comutativos; Δx·Δp ≥ ħ/2.`},
  '5c': { title:'5c — Formalismo Unificado',
          text:`Equivalência das abordagens; Dirac, espaço de Hilbert, operadores e evolução unitária.`},
  '6':  { title:'6 — Corpo Negro e Planck',
          text:`Catástrofe ultravioleta resolvida pela quantização da energia (Planck).`},
  '7':  { title:'7 — Efeito Fotoelétrico',
          text:`Fótons com E=hν e limiar de frequência; energia cinética cresce com ν.`},
  '8':  { title:'8 — de Broglie e Difração',
          text:`λ=h/p; interferência de elétrons em fendas e cristais; papel da medição.`},
  '9':  { title:'9 — Momento Angular e Números Quânticos',
          text:`n, l, m, s; formas de orbitais e regras de seleção.`},
  '10': { title:'10 — Curie e Radioatividade',
          text:`Decaimentos α, β, γ; estatística de contagem e estrutura nuclear.`}
};

/* ======== Init ======== */
function init(){
  clock = new THREE.Clock();

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030417);

  camera = new THREE.PerspectiveCamera(55, innerWidth/innerHeight, 0.1, 3000);
  camera.position.set(0, 40, 120);

  renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(devicePixelRatio);
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 30;
  controls.maxDistance = 300;
  controls.target.set(0, 10, 0);

  // Luzes
  const amb = new THREE.AmbientLight(0xffffff, 0.7);
  const dir = new THREE.DirectionalLight(0xffffff, 0.7);
  dir.position.set(50, 80, 30);
  scene.add(amb, dir);

  // Fundo estrelado
  starField = createStars(1600);
  scene.add(starField);

  // Grupo do mapa
  mindmapGroup = new THREE.Group();
  scene.add(mindmapGroup);

  // Grupo da simulação central (placeholder)
  centerSimGroup = new THREE.Group();
  scene.add(centerSimGroup);
  createCenterSimPlaceholder(); // sim central inicial

  // Construir mapa
  placeGraphNodesAndEdges();

  // Eventos
  addEvents();
}

/* ======== Starfield ======== */
function createStars(count){
  const g = new THREE.BufferGeometry();
  const positions = new Float32Array(count*3);
  for(let i=0;i<count;i++){
    const r = 80 + Math.random()*200;
    const t = Math.random()*Math.PI*2;
    const p = (Math.random()-0.5)*Math.PI;
    positions[i*3]   = Math.cos(t)*Math.cos(p)*r;
    positions[i*3+1] = Math.sin(p)*r*0.6;
    positions[i*3+2] = Math.sin(t)*Math.cos(p)*r;
  }
  g.setAttribute('position', new THREE.BufferAttribute(positions,3));
  const m = new THREE.PointsMaterial({ color:0x8fd0ff, size:0.35, transparent:true, opacity:0.9 });
  return new THREE.Points(g, m);
}

/* ======== Node frame (moldura com texto) ======== */
function makeNodeFrame(label, colorHex){
  // canvas para borda arredondada + texto
  const w=768, h=432, r=36;
  const canvas = document.createElement('canvas');
  canvas.width=w; canvas.height=h;
  const ctx = canvas.getContext('2d');

  // borda
  ctx.lineWidth = 10;
  ctx.strokeStyle = `#${colorHex.toString(16).padStart(6,'0')}`;
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  roundRect(ctx, 5, 5, w-10, h-10, r, true, true);

  // texto
  ctx.fillStyle = '#E6F2FF';
  ctx.font = 'bold 44px Inter, Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, w/2, h/2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;

  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent:true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), mat);
  mesh.userData.canvas = canvas;
  mesh.userData.ctx = ctx;
  return mesh;
}

function roundRect(ctx, x, y, w, h, r, fill, stroke){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
  if(fill) ctx.fill();
  if(stroke) ctx.stroke();
}

/* ======== Construção do grafo ======== */
function placeGraphNodesAndEdges(){
  // posições (layout manual + radial leve para visual limpo)
  const pos = {
    '1'  : new THREE.Vector3(0, 24, 0),

    // Caminho A (azul) à esquerda
    '2'  : new THREE.Vector3(-26, 18, -6),
    '3'  : new THREE.Vector3(-40, 12,  0),
    '4'  : new THREE.Vector3(-26,  6,  6),

    // Caminho B (laranja) à direita
    '6'  : new THREE.Vector3( 26, 18, -6),
    '7'  : new THREE.Vector3( 40, 12,  0),
    '8'  : new THREE.Vector3( 26,  6,  6),

    // Convergência (cinza/mesma família C ao centro-baixo)
    '5a' : new THREE.Vector3(  0,  3,  0),
    '5b' : new THREE.Vector3(  0, -4,  0),
    '5c' : new THREE.Vector3(  0, -11, 0),

    // extras
    '9'  : new THREE.Vector3(-48,  4, -10),
    '10' : new THREE.Vector3( 48,  4, -10),
  };

  // criar meshes dos nós
  const colorForPath = (p)=>{
    if(p==='A') return COL_A;
    if(p==='B') return COL_B;
    if(p==='extra9') return COL_9;
    if(p==='extra10')return COL_10;
    return 0x9fb3c8; // hub / convergência
  };

  nodes.forEach(n=>{
    const color = colorForPath(n.path);
    const nodeMesh = makeNodeFrame(n.label, color);
    nodeMesh.position.copy(pos[n.id]);
    nodeMesh.userData.id = n.id;
    nodeMesh.userData.label = n.label;
    nodeMesh.userData.color = color;
    nodeMesh.userData.path  = n.path;
    mindmapGroup.add(nodeMesh);
  });

  // conexões (linhas)
  edges.forEach(([a,b])=>{
    const na = mindmapGroup.children.find(m=>m.userData?.id===a);
    const nb = mindmapGroup.children.find(m=>m.userData?.id===b);
    if(!na||!nb) return;
    const color = (['1','2','3','4','5a','5b','5c'].includes(a) && ['1','2','3','4','5a','5b','5c'].includes(b))
      ? COL_A
      : (['1','6','7','8','5a','5b','5c'].includes(a) && ['1','6','7','8','5a','5b','5c'].includes(b))
        ? COL_B
        : (a==='3'&&b==='9') ? COL_9
          : (a==='7'&&b==='10') ? COL_10
            : 0x9fb3c8;

    const geom = new THREE.BufferGeometry().setFromPoints([na.position, nb.position]);
    const mat  = new THREE.LineBasicMaterial({ color, transparent:true, opacity:0.9 });
    const line = new THREE.Line(geom, mat);
    // leve arqueamento (curva) para ficar bonito
    const mid = na.position.clone().add(nb.position).multiplyScalar(0.5).add(new THREE.Vector3(0, 2.5, 0));
    const pts = new THREE.CatmullRomCurve3([na.position, mid, nb.position]).getPoints(20);
    line.geometry.setFromPoints(pts);
    mindmapGroup.add(line);
  });
}

/* ======== Simulação central (placeholder) ======== */
function createCenterSimPlaceholder(){
  // limpa anterior
  centerSimGroup.clear();

  // “câmara” central: um objeto 3D simples e partículas
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(18,10),
    new THREE.MeshBasicMaterial({ color:0x001825 })
  );
  plate.position.set(0, -2, 0);
  centerSimGroup.add(plate);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(5, 0.12, 16, 128),
    new THREE.MeshStandardMaterial({ color:0x5cd1ff, metalness:0.3, roughness:0.2 })
  );
  ring.position.set(0, -2, 0.2);
  centerSimGroup.add(ring);

  const pts = new THREE.Points(
    (()=>{ const g=new THREE.BufferGeometry();
      const N=1200; const arr=new Float32Array(N*3);
      for(let i=0;i<N;i++){
        const r= Math.random()*4.8;
        const a= Math.random()*Math.PI*2;
        const z= (Math.random()-0.5)*1.2;
        arr[i*3]=Math.cos(a)*r; arr[i*3+1]= -2 + Math.sin(a)*r*0.2; arr[i*3+2]=z+0.3;
      }
      g.setAttribute('position', new THREE.BufferAttribute(arr,3)); return g; })(),
    new THREE.PointsMaterial({ color:0x9fdcff, size:0.08, transparent:true, opacity:0.85 })
  );
  centerSimGroup.add(pts);

  centerSimGroup.userData = { ring, pts };
}

function updateCenterSimPlaceholder(dt){
  const ring = centerSimGroup.userData?.ring;
  if(ring){ ring.rotation.x += dt*0.25; ring.rotation.z += dt*0.15; }
}

/* ======== Interação ======== */
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

function addEvents(){
  window.addEventListener('resize', onResize);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  playBtn.addEventListener('click', ()=> {
    statusEl.textContent = 'Roteiro: tocando (placeholder)';
    // aqui você gatilha a animação/narração real do nó ativo
  });
}

function onPointerDown(e){
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left)/rect.width)*2 - 1;
  mouse.y = -((e.clientY - rect.top)/rect.height)*2 + 1;

  raycaster.setFromCamera(mouse, camera);
  // só checar meshes de plano (nós), não linhas
  const candidates = mindmapGroup.children.filter(o=>o.isMesh && o.geometry?.type==='PlaneGeometry');
  const hits = raycaster.intersectObjects(candidates);
  if(!hits.length) return;
  const mesh = hits[0].object;
  const id = mesh.userData.id;
  focusNode(id, mesh);
}

function focusNode(id, mesh){
  const content = contentById[id] || {title:id, text:'(sem conteúdo)'};
  nodeTitle.textContent = content.title;
  nodeText.innerHTML = `<p>${content.text}</p>`;

  // dar um “zoom” leve de câmera (sem travar controle)
  const target = mesh.position.clone();
  gsapLike(camera.position, camera.position.clone(), target.clone().add(new THREE.Vector3(0, 0, 34)), 0.9);
  gsapLike(controls.target, controls.target.clone(), target.clone(), 0.9);

  // mudar aparência do centro para refletir caminho/cor do nó
  const color = mesh.userData.color;
  const ring = centerSimGroup.userData?.ring;
  if(ring){ ring.material.color.setHex(color); ring.material.needsUpdate = true; }

  statusEl.textContent = `Nó ativo: ${content.title}`;
}

/* Pequena função tween leve (sem depender de libs) */
function gsapLike(vec3, from, to, secs){
  const start = performance.now();
  const dur = secs*1000;
  function tick(){
    const t = (performance.now() - start)/dur;
    const e = t<0?0:(t>1?1:(0.5-0.5*Math.cos(Math.PI*t)));
    vec3.lerpVectors(from, to, e);
    if(t<1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ======== Loop ======== */
function animate(){
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  // movimento de fundo/mindmap
  starField.rotation.y += dt * 0.02;
  mindmapGroup.children.forEach(obj=>{
    // manter nós virados para a câmera (billboard)
    if(obj.isMesh && obj.geometry?.type==='PlaneGeometry'){
      obj.lookAt(camera.position);
    }
  });

  updateCenterSimPlaceholder(dt);

  controls.update();
  renderer.render(scene, camera);
}

/* ======== Utils ======== */
function onResize(){
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
