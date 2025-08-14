// src/vote.js
import { refs } from './core/state.js';
import { nodesData, edgesData } from './graph.js';
import { startGesture, preloadGesture } from './gesture.js';

let gotoNodeFn = null;     // fornecido pelo nav
let exitGraphFn = null;    // novo: voltar ao mapa

export function setNavFns(gotoFn, exitFn){
  gotoNodeFn = gotoFn;
  exitGraphFn = exitFn;
}
export function getVoteState(){ return refs.voteState; }

export function preloadGesturesOnce(){
  return preloadGesture().catch(()=>{});
}

export function startVoteOnce(nodeId){
  const v = refs.voteState;
  if (!v.active || v.nodeId !== nodeId){
    startVote(nodeId);
  }
}

export function startVote(nodeId){
  const v = refs.voteState;
  if (v.active && v.nodeId === nodeId) return;

  endVote();

  const options = nextOptions(nodeId);
  if (options.length === 0){
    refs.statusEl.textContent = 'Fim do caminho.';
    exitGraphFn && exitGraphFn();       // volta ao mapa
    return;
  }
  if (options.length === 1){
    gotoNodeFn && gotoNodeFn(options[0].id);
    return;
  }

  v.active = true; v.nodeId = nodeId;

  const [optOpen, optClosed] = options.slice(0,2);
  showVoteOverlay(optOpen, optClosed);

  let remaining = 10;
  updateVoteTimer(remaining);
  let openCount = 0, closedCount = 0;

  startGesture(({open, closed})=>{
    openCount = open; closedCount = closed;
    updateVoteCounts(openCount, closedCount);
  }).then(session=>{
    v.gestureSession = session;
  });

  v.timerId = setInterval(()=>{
    remaining--;
    updateVoteTimer(remaining);
    if (remaining <= 0){
      endVote();
      const choose = (openCount >= closedCount) ? optOpen : optClosed;
      gotoNodeFn && gotoNodeFn(choose.id);
    }
  }, 1000);
}

export function endVote(){
  const v = refs.voteState;
  if (v.timerId){ clearInterval(v.timerId); v.timerId = null; }
  if (v.gestureSession){ try{ v.gestureSession.stop(); }catch(_){} v.gestureSession = null; }
  hideVoteOverlay();
  v.active = false;
  v.nodeId = null;
}

function nextOptions(nodeId){
  const outs = edgesData.filter(([a,_])=> a===nodeId).map(([_,b])=> b);
  const byId = id => ({ id, label: (nodesData.find(n=>n.id===id)?.label) || id });
  return outs.map(byId);
}

// ===== overlay DOM helpers
function getOv(){ return document.getElementById('voteOverlay'); }
function showVoteOverlay(openOpt, closedOpt){
  const ov = getOv();
  ov.classList.remove('hidden');
  ov.querySelector('.open-label').textContent   = `MÃOS ABERTAS → ${openOpt.label}`;
  ov.querySelector('.closed-label').textContent = `MÃOS FECHADAS → ${closedOpt.label}`;
  ov.querySelector('.open-count').textContent = '0';
  ov.querySelector('.closed-count').textContent = '0';
}
function hideVoteOverlay(){ getOv().classList.add('hidden'); }
function updateVoteCounts(open, closed){
  const ov = getOv();
  ov.querySelector('.open-count').textContent   = String(open);
  ov.querySelector('.closed-count').textContent = String(closed);
}
function updateVoteTimer(n){ getOv().querySelector('.timer').textContent = String(n); }
