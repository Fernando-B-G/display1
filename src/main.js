import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { createStars } from './starfield.js';
import { buildMindmap, getNodeMeshes, nodesData, colorOf } from './graph.js';
import { initCenterSim, updateCenterSim, setCenterSimColor } from './simulations.js';
import { roundEase, gsapLike } from './utils.js';
import { setupUIBindings } from './ui.js';
import { loadContent, getContent } from './contentloader.js';

const container = document.getElementById('container');
const nodeTitle = document.getElementById('nodeTitle');
const nodeText  = document.getElementById('nodeText');
const statusEl  = document.getElementById('status');
const playBtn   = document.getElementById('playBtn');

let scene, camera, renderer, controls, clock;
let starField, mindmapGroup, centerSimGroup;

let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

let mode = 'graph'; // 'graph' | 'sim'
const backBtn = document.getElementById('backBtn');


init();

async function init(){
  clock = new THREE.Clock();

  // 1) carrega conteúdo
  try {
    await loadContent('./data/nodes.pt-BR.json');
  } catch (e) {
    console.error(e);
    alert('Não foi possível carregar os textos (data/nodes.pt-BR.json). Rode via servidor HTTP.');
  }

  backBtn.addEventListener('click', exitToGraph);

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

  // Fundo
  starField = createStars(1600);
  scene.add(starField);

  // Mapa
  mindmapGroup = new THREE.Group();
  scene.add(mindmapGroup);
  buildMindmap(mindmapGroup); // nós + arestas

  // Simulação central
  centerSimGroup = new THREE.Group();
  scene.add(centerSimGroup);
  initCenterSim(centerSimGroup);

  // Eventos
  window.addEventListener('resize', onResize);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  playBtn.addEventListener('click', () => {
    statusEl.textContent = 'Roteiro: tocando (placeholder)';
  });

  setupUIBindings(); // liga sliders/botões (placeholder)
  animate();
}

function onResize(){
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

function onPointerDown(e){
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left)/rect.width)*2 - 1;
  mouse.y = -((e.clientY - rect.top)/rect.height)*2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const meshNodes = getNodeMeshes(mindmapGroup);
  const hits = raycaster.intersectObjects(meshNodes);
  if(!hits.length) return;
  const mesh = hits[0].object;
  enterNode(id, mesh);
}

function focusNode(id, mesh){
  // mantém a lógica atual de atualizar painel texto e cor do anel, se quiser
  const content = getContent(id) || { title:id, text:'(sem conteúdo)' };
  nodeTitle.textContent = content.title;
  nodeText.innerHTML = `
    <p>${content.text}</p>
    ${content.simulacao ? `<p><strong>Simulação:</strong> ${content.simulacao}</p>` : ''}
  `;
  const color = colorOf(mesh.userData.path);
  setCenterSimColor(centerSimGroup, color);

  // zoom “leve” até o nó (opcional)
  const target = mesh.position.clone();
  gsapLike(camera.position, camera.position.clone(), target.clone().add(new THREE.Vector3(0, 0, 34)), 0.6);
  gsapLike(controls.target, controls.target.clone(), target.clone(), 0.6);
  statusEl.textContent = `Nó: ${content.title}`;
}

async function enterNode(id, mesh){
  if (mode !== 'graph') return;
  mode = 'transition';

  // 1) dá um foco breve no nó (efeito de continuidade)
  focusNode(id, mesh);

  // 2) após o mini-zoom, voa para a “área de simulação” central
  setTimeout(async () => {
    // posição alvo da câmera para a simulação central
    const camTo = new THREE.Vector3(0, 10, 46);
    const tgtTo = new THREE.Vector3(0, 0, 0);
    gsapLike(camera.position, camera.position.clone(), camTo, 0.9);
    gsapLike(controls.target,  controls.target.clone(),  tgtTo, 0.9);

    // 3) esconde o grafo e mostra botão voltar
    mindmapGroup.visible = false;
    backBtn.classList.remove('hidden');

    // 4) carrega simulação específica do nó (em simulations.js)
    await loadNodeSimulation(centerSimGroup, id);

    // 5) atualiza UI
    const content = getContent(id) || { title:id, text:'(sem conteúdo)' };
    nodeTitle.textContent = content.title;
    nodeText.innerHTML = `
      <p>${content.text}</p>
      ${content.simulacao ? `<p><strong>Simulação:</strong> ${content.simulacao}</p>` : ''}
    `;
    statusEl.textContent = `Simulação: ${content.title}`;

    mode = 'sim';
  }, 650);
}

function exitToGraph(){
  if (mode !== 'sim') return;
  mode = 'transition';

  // 1) limpar simulação atual
  disposeNodeSimulation(centerSimGroup);

  // 2) voltar câmera para a visão geral do grafo
  const camTo = new THREE.Vector3(0, 40, 120);
  const tgtTo = new THREE.Vector3(0, 10, 0);
  gsapLike(camera.position, camera.position.clone(), camTo, 1.0);
  gsapLike(controls.target,  controls.target.clone(),  tgtTo, 1.0);

  // 3) reexibir grafo e esconder botão voltar
  mindmapGroup.visible = true;
  backBtn.classList.add('hidden');

  statusEl.textContent = 'Mapa: selecione um nó';
  mode = 'graph';
}

function animate(){
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  // fundo e billboard dos nós
  starField.rotation.y += dt * 0.02;

  // manter nós virados para a câmera
  getNodeMeshes(mindmapGroup).forEach(obj => obj.lookAt(camera.position));

  updateCenterSim(centerSimGroup, dt);

  controls.update();
  renderer.render(scene, camera);
}
