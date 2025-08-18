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
  refs.statusEl    = document.getElementById('status');
  refs.backBtn     = document.getElementById('backBtn');
  refs.voteBtn     = document.getElementById('voteBtn');
  refs.btnPlay     = document.getElementById('btnPlay');
  refs.btnPause    = document.getElementById('btnPause');
  refs.btnStop     = document.getElementById('btnStop');
  refs.scriptStatus= document.getElementById('scriptStatus');
  refs.captionBar  = document.getElementById('captionBar');
  refs.loadingOverlay = document.getElementById('loadingOverlay');

  toggleLoadingOverlay(true);

  initScene();
  bindEvents();

  refs.backBtn.addEventListener('click', exitToGraph);
  refs.btnPlay?.addEventListener('click', ()=>{ refs.scriptPlayer?.play?.(); resumeSpeak(); });
  refs.voteBtn.addEventListener('click', () => {
    if (refs.currentNodeId) startVoteOnce(refs.currentNodeId);
  });
  refs.btnPause?.addEventListener('click', ()=>{ refs.scriptPlayer?.pause?.(); pauseSpeak(); });
  refs.btnStop?.addEventListener('click', ()=>{ refs.scriptPlayer?.stop?.(); stopSpeak(); });

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
