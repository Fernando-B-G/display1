// src/core/events.js
import * as THREE from 'three';
import { refs } from './state.js';
import { getNodeGroups } from '../graph.js';
import { enterNode } from '../nav.js';

export function bindEvents(){
  window.addEventListener('resize', onResize);
  refs.renderer.domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
}

function onResize(){
  refs.camera.aspect = innerWidth/innerHeight;
  refs.camera.updateProjectionMatrix();
  refs.renderer.setSize(innerWidth, innerHeight);
}

function onPointerMove(e){
  const rect = refs.renderer.domElement.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  const y = (-(e.clientY - rect.top) / rect.height) * 2 + 1;

  refs.raycaster.setFromCamera({x,y}, refs.camera);
  const hits = refs.raycaster.intersectObjects(refs.mindmapGroup.children, true);
  const isOverNode = hits.some(h => {
    let o = h.object;
    while (o && !o.isGroup) o = o.parent;
    return o && o.userData && o.userData.id;
  });
  document.body.style.cursor = isOverNode ? 'pointer' : 'default';
}

function onPointerDown(e){
  const rect = refs.renderer.domElement.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  const y = (-(e.clientY - rect.top) / rect.height) * 2 + 1;

  refs.raycaster.setFromCamera({x, y}, refs.camera);
  const hits = refs.raycaster.intersectObjects(refs.mindmapGroup.children, true);
  if (!hits.length) return;

  let node = hits[0].object;
  while (node && !node.isGroup) node = node.parent;
  if (!node || !node.userData?.id) return;

  enterNode(node.userData.id, node);
}
