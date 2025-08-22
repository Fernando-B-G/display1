// src/simulations/core.js
import * as THREE from 'three';

// ===== núcleo da “mesa”/palco central =====
export function initCenterSim(group){
  group.clear();
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 14),
    new THREE.MeshBasicMaterial({ color:0x001825 })
  );
  plate.material.depthWrite = false;
  plate.raycast = () => false;
  plate.position.set(0, 0, 0);
  group.add(plate);
  group.userData = { currentId: null, objects: [], anim: null, ring: null };
}

export function updateCenterSim(group, dt){
  const anim = group.userData?.anim;
  if (typeof anim === 'function') anim(dt);
}

export function setCenterSimColor(group, hex){
  if (!group.userData.ring) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(6.5, 0.12, 16, 128),
      new THREE.MeshStandardMaterial({ color:hex, metalness:0.3, roughness:0.3 })
    );
    ring.position.set(0, 0, 0.2);
    group.add(ring);
    group.userData.ring = ring;
  } else {
    group.userData.ring.material.color.setHex(hex);
    group.userData.ring.material.needsUpdate = true;
  }
}

export function disposeNodeSimulation(group){
  const objs = group.userData?.objects || [];
  objs.forEach(o => {
    if (o?.isMesh || o?.isPoints || o?.isLine) {
      o.geometry?.dispose?.();
      if (Array.isArray(o.material)) o.material.forEach(m => m?.dispose?.());
      else o.material?.dispose?.();
    }
    group.remove(o);
  });
  group.userData.objects = [];
  group.userData.anim = null;
  group.userData.currentId = null;
}

// ===== helper para UI por sim =====
export function attachUI(group, params, schema){
  group.userData.params = params;
  group.userData.api = {
    set: (k,v)=>{ if (k in params) params[k]=v; },
    get: (k)=> params[k],
    reset: ()=> schema.forEach(ctrl=>{
      if ('value' in ctrl && ctrl.id in params) params[ctrl.id]=ctrl.value;
    }),
    highlight: (id, opts)=>{}
  };
  group.userData.uiSchema = schema;
}
