// src/core/state.js
import * as THREE from 'three';

export const refs = {
  // THREE / cena
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  clock: null,

  // grupos
  starField: null,
  mindmapGroup: null,
  centerSimGroup: null,

  // input
  raycaster: new THREE.Raycaster(),
  mode: 'graph',             // 'graph' | 'node-zoom' | 'sim'
  currentNodeId: null,
  simCache: {},

  // script + voto
  scriptPlayer: null,
  voteState: { active:false, timerId:null, gestureSession:null, nodeId:null },

  // DOM
  container: null,
  nodeTitle: null,
  nodeText: null,
  statusEl: null,
  backBtn: null,
  voteBtn: null,
  scriptStatus: null,
  btnPlay: null,
  btnPause: null,
  btnStop: null,
  captionBar: null,

  // constantes
  NODE_ZOOM_DISTANCE: 10,
  NODE_MIN_DISTANCE: 3
};
