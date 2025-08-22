// src/nav.js
import * as THREE from 'three';
import { refs } from './core/state.js';
import { gsapLike } from './utils.js';
import { colorOf, buildMindmap, getNodeGroups } from './graph.js';
import { setCenterSimColor, disposeNodeSimulation, createRTSimulation, getUISchema } from './simulations/index.js';
import { renderControls, clearControls } from './ui.js';
import { getContent, loadContent } from './contentloader.js';
import { endVote } from './vote.js';
import { clearCaption, stopSpeak } from './ui/captionTTS.js';
import { setupScriptForNode } from './script/setup.js';

export function buildGraph(){ buildMindmap(refs.mindmapGroup); }

export function focusNode(id, nodeGroup){
  const content = getContent(id) || { title:id, text:'' };
  refs.nodeTitle.textContent = content.title;
  refs.nodeText.innerHTML = `
    <p>${content.text}</p>
    ${content.simulacao ? `<p><strong>Simulação:</strong> ${content.simulacao}</p>` : ''}
  `;

  setCenterSimColor(refs.centerSimGroup, colorOf(nodeGroup.userData.path));
  refs.controls.minDistance = refs.NODE_MIN_DISTANCE;

  const toPos = nodeGroup.position.clone().add(new THREE.Vector3(0, 0, refs.NODE_ZOOM_DISTANCE));
  const toTgt = nodeGroup.position.clone();
  gsapLike(refs.camera.position, refs.camera.position.clone(), toPos, 0.6);
  gsapLike(refs.controls.target,  refs.controls.target.clone(),  toTgt, 0.6);

  refs.statusEl.textContent = `Nó: ${content.title}`;
}

export async function enterNode(id, nodeGroup){
  if (refs.mode !== 'graph') return;
  refs.mode = 'node-zoom';
  refs.currentNodeId = id;
  refs.backBtn?.classList.remove('hidden');

  nodeGroup.userData.isActive = true;
  focusNode(id, nodeGroup);

  setTimeout(async () => {
    let simRT = refs.simCache[id];
    if (!simRT){
      simRT = await createRTSimulation(id);
      refs.simCache[id] = simRT;
    }
    nodeGroup.userData.simRT = simRT;

    const content = getContent(id) || { title:id, text:'' };
    refs.nodeTitle.textContent = content.title;
    refs.nodeText.innerHTML = `<p>${content.text || ''}</p>`;

    const schema = getUISchema(id, simRT.group);
    renderControls(schema, (key, value)=>{
      const api = simRT.group?.userData?.api;
      if (api && api.set) api.set(key, value);
    });

    refs.centerSimGroup.visible = false;
    refs.mode = 'sim';
    document.body.classList.add('sim-mode');
    
    setupScriptForNode(id, simRT, content);
    refs.voteBtn?.classList.remove('hidden');
  }, 300);
}

export function gotoNode(targetId){
  endVote();
  stopSpeak();
  clearCaption(refs.captionBar);

  const nodeGroup = getNodeGroups(refs.mindmapGroup).find(g=> g.userData?.id === targetId);
  if (!nodeGroup){
    refs.statusEl.textContent = `Não encontrei o nó ${targetId}`;
    return;
  }

  getNodeGroups(refs.mindmapGroup).forEach(g=>{
    if (g.userData?.simRT){
      delete g.userData.simRT;
      g.userData.isActive = false;
    }
  });

  refs.currentNodeId = targetId;
  refs.backBtn?.classList.remove('hidden');
  nodeGroup.userData.isActive = true;
  focusNode(targetId, nodeGroup);

  setTimeout(async ()=>{
    let simRT = refs.simCache[targetId];
    if (!simRT){
      simRT = await createRTSimulation(targetId);
      refs.simCache[targetId] = simRT;
    }
    nodeGroup.userData.simRT = simRT;

    const content = getContent(targetId) || { title:targetId, text:'(sem conteúdo)' };
    refs.nodeTitle.textContent = content.title;
    refs.nodeText.innerHTML = `<p>${content.text || '(sem conteúdo)'}</p>`;

    const schema = getUISchema(targetId, simRT.group);
    renderControls(schema, (key, value)=>{
      const api = simRT.group?.userData?.api;
      if (api && api.set) api.set(key, value);
    });

    refs.statusEl.textContent = content?.title ? `Simulação — ${content.title}` : '';

    refs.mode = 'sim';
    document.body.classList.add('sim-mode');

    setupScriptForNode(targetId, simRT, content);
    refs.voteBtn?.classList.remove('hidden');
  }, 250);
}

export function exitToGraph(){
  endVote();
  stopSpeak();
  clearCaption(refs.captionBar);

  if (refs.mode !== 'node-zoom' && refs.mode !== 'sim') return;
  refs.mode = 'graph';

  document.body.classList.remove('sim-mode');

  try { refs.scriptPlayer?.stop?.(); } catch(_) {}
  refs.scriptPlayer = null;
  refs.updatePlayPauseState?.('stopped');
  clearControls?.();

  getNodeGroups(refs.mindmapGroup).forEach(g=>{
    if (g.userData?.simRT){
      delete g.userData.simRT;
    }
    g.userData.isActive = false;
  });

  disposeNodeSimulation(refs.centerSimGroup);
  refs.centerSimGroup.visible = false;

  refs.mindmapGroup.visible = true;
  const camTo = new THREE.Vector3(10, 40, 60);
  const tgtTo = new THREE.Vector3(40, 0, 0);
  gsapLike(refs.camera.position, refs.camera.position.clone(), camTo, 0.9);
  gsapLike(refs.controls.target,  refs.controls.target.clone(),  tgtTo, 0.9);

  refs.voteBtn?.classList.add('hidden');
  refs.statusEl.textContent = 'Mapa: selecione um nó';
  refs.nodeTitle.textContent = refs.initialTitle;
  refs.nodeText.innerHTML = refs.initialText;
  document.body.className = '';
  refs.currentNodeId = null;
  refs.backBtn?.classList.add('hidden');
}