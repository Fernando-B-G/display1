import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { createStars } from './starfield.js';
import { buildMindmap, getNodeGroups, colorOf, nodesData, edgesData } from './graph.js';
import { gsapLike } from './utils.js';
import { setupUIBindings, renderControls, clearControls } from './ui.js';
import { loadContent, getContent } from './contentloader.js'; // << corrigido C/L
import { initCenterSim, updateCenterSim, setCenterSimColor, loadNodeSimulation, disposeNodeSimulation, createRTSimulation, getUISchema } from './simulations.js';
import { startGesture, preloadGesture } from './gesture.js';

const container = document.getElementById('container');
const nodeTitle = document.getElementById('nodeTitle');
const nodeText  = document.getElementById('nodeText');
const statusEl  = document.getElementById('status');
const playBtn   = document.getElementById('playBtn');
const backBtn   = document.getElementById('backBtn');
const btnPlay = document.getElementById('btnPlay');
const btnPause = document.getElementById('btnPause');
const btnStop = document.getElementById('btnStop');
const scriptStatus = document.getElementById('scriptStatus');

let scriptCtrl = { lines:[], idx:0, playing:false, paused:false, abort:false };


let scene, camera, renderer, controls, clock;
let starField, mindmapGroup, centerSimGroup;

const NODE_ZOOM_DISTANCE = 10; // quanto menor, mais perto (antes estava ~26)
const GRAPH_MIN_DISTANCE = 30;
const NODE_MIN_DISTANCE  = 3;   // pode usar 2 ou 1 se quiser mais perto

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let currentNodeId = null;
let gestureSession = null;
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
  //controls.minDistance = 30;
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
  centerSimGroup.visible = false;

  // 8) Eventos
  window.addEventListener('resize', onResize);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  backBtn.addEventListener('click', exitToGraph);
    btnPlay?.addEventListener('click', ()=> runScript());
    btnPause?.addEventListener('click', ()=> pauseScript());
    btnStop?.addEventListener('click', ()=> stopScript());

/*playBtn.addEventListener('click', () => {
  if (mode === 'sim' && currentNodeId) {
    playNodeScript(currentNodeId);
  } else {
    statusEl.textContent = 'Roteiro: selecione um nó e entre na simulação.';
  }
});*/

preloadGesture().then(()=>{
  console.log('Gestos pré-carregados');
}).catch(()=>{ /* segue normal com fallback */ });

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

function startVote(nodeId){
  const options = nextOptions(nodeId);

  // 0 saídas: fim real
  if (options.length === 0){
    statusEl.textContent = 'Fim do caminho.';
    return;
  }

  // 1 saída: segue direto sem overlay nem gestos
  if (options.length === 1){
    gotoNode(options[0].id);
    return;
  }

  // 2+ saídas: votação normal (usamos as 2 primeiras)
  const [optOpen, optClosed] = options.slice(0,2);

  showVoteOverlay(optOpen, optClosed);

  let remaining = 10;
  updateVoteTimer(remaining);

  if (gestureSession) { gestureSession.stop(); gestureSession=null; }
  let openCount=0, closedCount=0;

  startGesture(({open, closed})=>{
    openCount = open; closedCount = closed;
    updateVoteCounts(openCount, closedCount);
  }).then(session=> gestureSession=session);

  const tick = setInterval(()=>{
    remaining--;
    updateVoteTimer(remaining);
    if (remaining <= 0){
      clearInterval(tick);
      if (gestureSession) { gestureSession.stop(); gestureSession=null; }
      hideVoteOverlay();

      const choose = (openCount >= closedCount) ? optOpen : optClosed;
      gotoNode(choose.id);
    }
  }, 1000);
}

function nextOptions(nodeId){
  // saídas do nó
  const outs = edgesData.filter(([a,_])=> a===nodeId).map(([_,b])=> b);
  // mapeia para {id,label}
  const map = id => ({ id, label: (nodesData.find(n=>n.id===id)?.label) || id });
  return outs.map(map); // devolve todas (startVote decide como usar)
}

function gotoNode(targetId){
  const nodeGroup = getNodeGroups(mindmapGroup).find(g=> g.userData?.id === targetId);
  if (!nodeGroup){
    statusEl.textContent = `Não encontrei o nó ${targetId}`;
    return;
  }

  // limpar sim local do nó atual
  getNodeGroups(mindmapGroup).forEach(g=>{
    if (g.userData?.simRT){
      try { g.userData.simRT.dispose && g.userData.simRT.dispose(); } catch(_){}
      delete g.userData.simRT;
      g.userData.isActive = false;
    }
  });

  currentNodeId = targetId;
  nodeGroup.userData.isActive = true;
  focusNode(targetId, nodeGroup);

  setTimeout(async ()=>{
    const simRT = await createRTSimulation(targetId);
    nodeGroup.userData.simRT = simRT;

    const content = getContent(targetId) || { title:targetId, text:'(sem conteúdo)' };
    nodeTitle.textContent = content.title;
    nodeText.innerHTML = `<p>${content.text || '(sem conteúdo)'}</p>`;

    const schema = getUISchema(targetId, simRT.group);
    renderControls(schema, (key, value)=>{
      const api = simRT.group?.userData?.api;
      if (api && api.set) api.set(key, value);
    });

    statusEl.textContent = `Simulação: ${content.title}`;

    // carrega + inicia o roteiro automaticamente no novo nó
    loadScriptForNode(targetId);
    runScript();
  }, 250);
}

// ===== Overlay helpers =====
function showVoteOverlay(openOpt, closedOpt){
  const ov = getVoteOverlay();
  ov.classList.remove('hidden');
  ov.querySelector('.open-label').textContent   = `MÃOS ABERTAS → ${openOpt.label}`;
  ov.querySelector('.closed-label').textContent = `MÃOS FECHADAS → ${closedOpt.label}`;
  ov.querySelector('.open-count').textContent = '0';
  ov.querySelector('.closed-count').textContent = '0';
}
function hideVoteOverlay(){
  getVoteOverlay().classList.add('hidden');
}
function updateVoteCounts(open, closed){
  const ov = getVoteOverlay();
  ov.querySelector('.open-count').textContent   = String(open);
  ov.querySelector('.closed-count').textContent = String(closed);
}
function updateVoteTimer(n){
  getVoteOverlay().querySelector('.timer').textContent = String(n);
}
function getVoteOverlay(){
  return document.getElementById('voteOverlay');
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
  currentNodeId = id;

  nodeGroup.userData.isActive = true;
  focusNode(id, nodeGroup);

  setTimeout(async () => {
    const simRT = await createRTSimulation(id);
    nodeGroup.userData.simRT = simRT;

    backBtn.classList.remove('hidden');

    const content = getContent(id) || { title:id, text:'(sem conteúdo)' };
    nodeTitle.textContent = content.title;
    nodeText.innerHTML = `<p>${content.text || '(sem conteúdo)'}</p>`;

    const schema = getUISchema(id, simRT.group);
    renderControls(schema, (key, value)=>{
      const api = simRT.group?.userData?.api;
      if (api && api.set) api.set(key, value);
    });

    // prepara + inicia o roteiro automaticamente
    loadScriptForNode(id);
    runScript(); // <<< começa sozinho

    centerSimGroup.visible = false;
    mode = 'sim';
  }, 300);
}

function exitToGraph(){
  if (mode !== 'sim' && mode !== 'node-zoom') return;
  mode = 'graph';

  // 1) desligar sim local (se existir) no nó ativo
  const nodeGroups = getNodeGroups(mindmapGroup);
  nodeGroups.forEach(g=>{
    if (g.userData?.simRT){
      try { g.userData.simRT.dispose && g.userData.simRT.dispose(); } catch(_){}
      delete g.userData.simRT;
    }
    g.userData.isActive = false;
  });

  // 2) palco central segue invisível
  disposeNodeSimulation(centerSimGroup);
  centerSimGroup.visible = false;

  // 3) voltar à visão geral
  mindmapGroup.visible = true;
  const camTo = new THREE.Vector3(0, 24, 110);
  const tgtTo = new THREE.Vector3(40, 0, 0);
  gsapLike(camera.position, camera.position.clone(), camTo, 0.9);
  gsapLike(controls.target,  controls.target.clone(),  tgtTo, 0.9);

    stopScript();
    updateScriptStatus('');
    clearControls();

  backBtn.classList.add('hidden');
  statusEl.textContent = 'Mapa: selecione um nó';
  currentNodeId = null;
}


async function playNodeScript(id){
  const content = getContent(id) || {};
  const lines = Array.isArray(content.script) ? content.script
              : Array.isArray(content.roteiro) ? content.roteiro
              : (content.text ? [content.text] : []);

  if (!lines.length) {
    statusEl.textContent = 'Roteiro: (vazio)';
    // mesmo sem roteiro, podemos iniciar a votação direto:
    startVote(id);
    return;
  }

  statusEl.textContent = 'Roteiro: tocando...';
  for (let i=0;i<lines.length;i++){
    nodeText.innerHTML = `<p>${lines[i]}</p>`;
    await sleep(1800);
  }
  statusEl.textContent = 'Roteiro: concluído';

  // === inicia a votação de caminho ===
  startVote(id);
}


function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

function updateScriptStatus(msg){
  if (scriptStatus) scriptStatus.textContent = msg || '';
}

function loadScriptForNode(id){
  const content = getContent(id) || {};
  const lines = Array.isArray(content.script) ? content.script
              : Array.isArray(content.roteiro) ? content.roteiro
              : (content.text ? [content.text] : []);
  scriptCtrl = { lines, idx:0, playing:false, paused:false, abort:false };
  updateScriptStatus(lines.length ? 'pronto' : 'sem roteiro');
}

async function runScript(){
  if (!currentNodeId) { statusEl.textContent = 'Selecione um nó para tocar o roteiro.'; return; }
  if (!scriptCtrl.lines.length){ updateScriptStatus('sem roteiro'); startVote(currentNodeId); return; }
  if (scriptCtrl.playing) return;

  scriptCtrl.playing = true;
  scriptCtrl.paused = false;
  scriptCtrl.abort = false;
  updateScriptStatus('tocando...');

  while (scriptCtrl.idx < scriptCtrl.lines.length){
    if (scriptCtrl.abort) break;
    if (scriptCtrl.paused){ await sleep(120); continue; }

    nodeText.innerHTML = `<p>${scriptCtrl.lines[scriptCtrl.idx]}</p>`;
    scriptCtrl.idx++;
    await sleep(1800); // cadência entre falas
  }

  scriptCtrl.playing = false;
  if (!scriptCtrl.abort){
    updateScriptStatus('concluído');
    // dispara a votação de caminho
    startVote(currentNodeId);
  } else {
    updateScriptStatus('interrompido');
  }
}

function pauseScript(){
  if (!scriptCtrl.playing) return;
  scriptCtrl.paused = !scriptCtrl.paused;
  updateScriptStatus(scriptCtrl.paused ? 'pausado' : 'tocando...');
}

function stopScript(){
  if (!scriptCtrl.playing) { scriptCtrl.idx = 0; updateScriptStatus('pronto'); return; }
  scriptCtrl.abort = true;
  scriptCtrl.paused = false;
  scriptCtrl.playing = false;
  scriptCtrl.idx = 0;
  updateScriptStatus('interrompido');
}


function animate(){
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  // animação leve no starfield
  if (starField) starField.rotation.y += dt * 0.02;

  // --- renderizar previews nos renderTargets dos nós ---
const nodeGroups = getNodeGroups(mindmapGroup);
nodeGroups.forEach(node=>{
  const { previewScene, previewCamera, rt, isActive, step, simRT } = node.userData || {};
  if (!rt) return;

  // RT maior quando ativo (nítido), menor caso contrário
  const targetW = isActive ? 1024 : 480;
  const targetH = isActive ?  576 : 270;
  if (rt.width !== targetW || rt.height !== targetH) rt.setSize(targetW, targetH);

  renderer.setRenderTarget(rt);

  if (simRT) {
    // simulação real local (no lugar da prévia)
    simRT.update && simRT.update(dt);
    renderer.render(simRT.scene, simRT.camera);
  } else if (previewScene && previewCamera) {
    // prévia não-interativa
    if (typeof step === 'function') step(dt);
    renderer.render(previewScene, previewCamera);
  }

});
renderer.setRenderTarget(null);



  // manter os nós virados para a câmera
  nodeGroups.forEach(obj => obj.lookAt(camera.position));

  if (centerSimGroup.visible) updateCenterSim(centerSimGroup, dt);

  controls.update();
  renderer.render(scene, camera);
}
