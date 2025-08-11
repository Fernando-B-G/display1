import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { createStars } from './starfield.js';
import { buildMindmap, getNodeGroups, colorOf } from './graph.js';
import { initCenterSim, updateCenterSim, setCenterSimColor } from './simulations.js';
import { gsapLike } from './utils.js';
import { setupUIBindings } from './ui.js';
import { loadContent, getContent } from './contentloader.js'; // << corrigido C/L

const container = document.getElementById('container');
const nodeTitle = document.getElementById('nodeTitle');
const nodeText  = document.getElementById('nodeText');
const statusEl  = document.getElementById('status');
const playBtn   = document.getElementById('playBtn');
const backBtn   = document.getElementById('backBtn');

let scene, camera, renderer, controls, clock;
let starField, mindmapGroup, centerSimGroup;

const NODE_ZOOM_DISTANCE = 5; // quanto menor, mais perto (antes estava ~26)
const GRAPH_MIN_DISTANCE = 30;
const NODE_MIN_DISTANCE  = 3;   // pode usar 2 ou 1 se quiser mais perto

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let mode = 'graph'; // 'graph' | 'node-zoom'

init();

async function init(){
  clock = new THREE.Clock();

  // 1) Carrega conteúdo
  try {
    await loadContent('./data/nodes.pt-BR.json');
  } catch (e) {
    console.error(e);
    alert('Não foi possível carregar os textos (data/nodes.pt-BR.json). Rode via servidor HTTP.');
  }

  // 2) Cena
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030417);

  camera = new THREE.PerspectiveCamera(55, innerWidth/innerHeight, 0.1, 3000);
  camera.position.set(0, 24, 110);

  renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(devicePixelRatio);
  container.appendChild(renderer.domElement);

  // 3) Controles (crie ANTES de usar controls.target)
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 30;
  controls.maxDistance = 300;
  controls.target.set(40, 0, 0); // mira para o centro do mapa horizontal

  // 4) Luzes
  const amb = new THREE.AmbientLight(0xffffff, 0.7);
  const dir = new THREE.DirectionalLight(0xffffff, 0.7);
  dir.position.set(50, 80, 30);
  scene.add(amb, dir);

  // 5) Fundo
  starField = createStars(1600);
  scene.add(starField);

  // 6) Mapa
  mindmapGroup = new THREE.Group();
  scene.add(mindmapGroup);
  buildMindmap(mindmapGroup); // nós + arestas (cada nó é um Group com .userData.rt)

  // 7) Simulação central (mantemos se quiser usar depois)
  centerSimGroup = new THREE.Group();
  scene.add(centerSimGroup);
  initCenterSim(centerSimGroup);

  // 8) Eventos
  window.addEventListener('resize', onResize);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  backBtn.addEventListener('click', exitToGraph);

  playBtn.addEventListener('click', () => {
    statusEl.textContent = 'Roteiro: tocando (placeholder)';
  });

  setupUIBindings(); // sliders/botões

  animate();
}

function onResize(){
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

function onPointerMove(e){
  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  const y = (-(e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera({x,y}, camera);
  const hits = raycaster.intersectObjects(mindmapGroup.children, true);
  // Se qualquer hit pertence a um nodeGroup, mostramos pointer
  const isOverNode = hits.some(h => {
    let o = h.object;
    while (o && !o.isGroup) o = o.parent;
    return o && o.userData && o.userData.id;
  });
  document.body.style.cursor = isOverNode ? 'pointer' : 'default';
}

function onPointerDown(e){
  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  const y = (-(e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera({x, y}, camera);
  const hits = raycaster.intersectObjects(mindmapGroup.children, true);
  if (!hits.length) return;

  // Subir até o GROUP do nó
  let node = hits[0].object;
  while (node && !node.isGroup) node = node.parent;
  if (!node || !node.userData?.id) return;

  enterNode(node.userData.id, node);
}

function focusNode(id, nodeGroup){
  const content = getContent(id) || { title:id, text:'(sem conteúdo)' };
  nodeTitle.textContent = content.title;
  nodeText.innerHTML = `
    <p>${content.text}</p>
    ${content.simulacao ? `<p><strong>Simulação:</strong> ${content.simulacao}</p>` : ''}
  `;

  // opcional: cor no anel central
  setCenterSimColor(centerSimGroup, colorOf(nodeGroup.userData.path));
  controls.minDistance = NODE_MIN_DISTANCE;
  // zoom “leve” até o nó
  const toPos = nodeGroup.position.clone().add(new THREE.Vector3(0, 0, NODE_ZOOM_DISTANCE)); // 12 deixa BEM perto
  const toTgt = nodeGroup.position.clone();
  gsapLike(camera.position, camera.position.clone(), toPos, 0.6);
  gsapLike(controls.target,  controls.target.clone(),  toTgt, 0.6);

  statusEl.textContent = `Nó: ${content.title}`;
}

async function enterNode(id, nodeGroup){
  if (mode !== 'graph') return;
  mode = 'node-zoom';

  // 1) marcar ativo (renderTarget maior = mais nítido) e focar
  nodeGroup.userData.isActive = true;
  focusNode(id, nodeGroup);

  // 2) mostrar botão voltar
  backBtn.classList.remove('hidden');
}

function exitToGraph(){
  if (mode !== 'node-zoom') return;
  mode = 'graph';

  // reduzir resolução dos RTs de todos os nós
  getNodeGroups(mindmapGroup).forEach(g => g.userData.isActive = false);

  // voltar à visão geral horizontal
  const camTo = new THREE.Vector3(0, 24, 110);
  const tgtTo = new THREE.Vector3(40, 0, 0);
  gsapLike(camera.position, camera.position.clone(), camTo, 0.9);
  gsapLike(controls.target,  controls.target.clone(),  tgtTo, 0.9);


    // <-- restaura o clamp original
  //controls.minDistance = GRAPH_MIN_DISTANCE;
  backBtn.classList.add('hidden');
  statusEl.textContent = 'Mapa: selecione um nó';
}

function animate(){
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  // animação leve no starfield
  if (starField) starField.rotation.y += dt * 0.02;

  // --- renderizar previews nos renderTargets dos nós ---
  const nodeGroups = getNodeGroups(mindmapGroup);
  nodeGroups.forEach(node=>{
    const { previewScene, previewCamera, rt, isActive, step } = node.userData || {};
    if (!rt || !previewScene || !previewCamera) return;

    // animação da prévia do nó (se definida em nodePreviews)
    if (typeof step === 'function') step(dt);

    // RT maior quando ativo (nítido), menor caso contrário
    const targetW = isActive ? 1024 : 480;
    const targetH = isActive ?  576 : 270;
    if (rt.width !== targetW || rt.height !== targetH) rt.setSize(targetW, targetH);

    renderer.setRenderTarget(rt);
    renderer.render(previewScene, previewCamera);
  });
  renderer.setRenderTarget(null);


  // manter os nós virados para a câmera
  nodeGroups.forEach(obj => obj.lookAt(camera.position));

  updateCenterSim(centerSimGroup, dt);

  controls.update();
  renderer.render(scene, camera);
}
