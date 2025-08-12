// src/simulations/sims/fallback.js
import * as THREE from 'three';

function makeLabel(s){
  const w=1024, h=256;
  const canvas = document.createElement('canvas');
  canvas.width=w; canvas.height=h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#001423'; ctx.fillRect(0,0,w,h);
  ctx.fillStyle = '#E6F2FF'; ctx.font='bold 64px Inter,Arial';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(s, w/2, h/2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.MeshBasicMaterial({ map:tex, transparent:true });
  return new THREE.Mesh(new THREE.PlaneGeometry(12, 3), mat);
}

export function buildSim_fallback(group, nodeId){
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 3.6),
    new THREE.MeshBasicMaterial({ color:0x002033 })
  );
  bg.position.set(0, 0, 0.2);
  const label = makeLabel(`Simulação do nó ${nodeId} (placeholder)`); label.position.set(0,0,0.25);
  group.add(bg, label);
  group.userData.objects.push(bg, label);
  group.userData.anim = null;
}
