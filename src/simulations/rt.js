// src/simulations/rt.js
import * as THREE from 'three';
import { initCenterSim, updateCenterSim, disposeNodeSimulation } from './core.js';
import { loadNodeSimulation } from './registry.js';

export async function createRTSimulation(nodeId){
  const scene  = new THREE.Scene();
  scene.background = new THREE.Color(0x001825);
  const camera = new THREE.PerspectiveCamera(50, 16/9, 0.1, 100);
  camera.position.set(0, 0, 12);

  const amb = new THREE.AmbientLight(0xffffff, 0.8);
  const dir = new THREE.DirectionalLight(0xffffff, 0.7);
  dir.position.set(5,8,6);
  scene.add(amb, dir);

  const group = new THREE.Group();
  scene.add(group);
  initCenterSim(group);
  await loadNodeSimulation(group, nodeId);

  function update(dt){ updateCenterSim(group, dt); }
  function dispose(){
    disposeNodeSimulation(group);
    scene.traverse(obj=>{
      if (obj.isMesh || obj.isPoints || obj.isLine){
        obj.geometry?.dispose?.();
        if (Array.isArray(obj.material)) obj.material.forEach(m=>m?.dispose?.());
        else obj.material?.dispose?.();
      }
    });
  }

  return { scene, camera, update, dispose, group };
}
