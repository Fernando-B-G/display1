// src/main.js
import { refs } from './core/state.js';
import { initScene } from './core/scene.js';
import { bindEvents } from './core/events.js';
import { buildGraph, exitToGraph, gotoNode } from './nav.js';
import { startLoop } from './render/loop.js';
import { setupUIBindings } from './ui.js';
import { loadContent } from './contentloader.js';
import { initCaptionAndTTS, resumeSpeak, pauseSpeak, stopSpeak } from './ui/captionTTS.js';
import { setNavFns, preloadGesturesOnce, startVoteOnce } from './vote.js';
import { preloadAllSimulations, REGISTRY } from './simulations/index.js';

function toggleLoadingOverlay(show){
  const el = refs.loadingOverlay;
  if(!el) return;
  el.classList.toggle('hidden', !show);
}

async function bootstrap(){
  // DOM refs
  refs.container   = document.getElementById('container');
  refs.nodeTitle   = document.getElementById('nodeTitle');
  refs.nodeText    = document.getElementById('nodeText');
  refs.initialTitle = refs.nodeTitle.textContent;
  refs.initialText  = refs.nodeText.innerHTML;
  refs.statusEl    = document.getElementById('status');
  refs.backBtn     = document.getElementById('backBtn');
  refs.voteBtn     = document.getElementById('voteBtn');
  refs.btnPlayPause= document.getElementById('btnPlayPause');
  refs.btnStop     = document.getElementById('btnStop');
  refs.captionBar  = document.getElementById('captionBar');
  refs.loadingOverlay = document.getElementById('loadingOverlay');

  function updatePlayPauseState(state){
    const btn = refs.btnPlayPause;
    if (!btn) return;
    btn.classList.remove('playing','paused','stopped');
    btn.classList.add(state);
  }
  refs.updatePlayPauseState = updatePlayPauseState;
  updatePlayPauseState('stopped');

  toggleLoadingOverlay(true);

  initScene();
  bindEvents();

  refs.backBtn.addEventListener('click', exitToGraph);
  refs.btnPlayPause?.addEventListener('click', ()=>{
    if (!refs.scriptPlayer) return;
    if (refs.scriptPlayer.playing){
      refs.scriptPlayer.pause();
      if (refs.scriptPlayer.paused) pauseSpeak(); else resumeSpeak();
    } else {
      refs.scriptPlayer.play();
      resumeSpeak();
    }
  });
  refs.voteBtn.addEventListener('click', () => {
    if (refs.currentNodeId) startVoteOnce(refs.currentNodeId);
  });
  refs.btnStop?.addEventListener('click', ()=>{
    refs.scriptPlayer?.stop?.();
    stopSpeak();
    refs.updatePlayPauseState?.('stopped');
  });

  setupUIBindings();
  initCaptionAndTTS({ captionEl: refs.captionBar, ttsButton: document.getElementById('btnTTS') });

  try {
    await loadContent('./data/nodes.pt-BR.json');
  } catch (e) {
    console.error(e);
    alert('Não foi possível carregar os textos (data/nodes.pt-BR.json). Rode via servidor HTTP.');
  }

  buildGraph();

  // habilita voto → navegação (agora também retorno)
  setNavFns(gotoNode, exitToGraph);

  // pré-carrega gestos e simulações
  await Promise.all([
    preloadGesturesOnce(),
    preloadAllSimulations(Object.keys(REGISTRY))
  ]);

requestAnimationFrame(() => {
  startLoop();
  requestIdleCallback(() => toggleLoadingOverlay(false));
});
}

bootstrap();
