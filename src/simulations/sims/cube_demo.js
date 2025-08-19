// src/simulations/sims/tube_demo.js
import * as THREE from 'three';

export function buildSim_cube(group){
  const params = { rotSpeed: 1.0, running: true };

  // Controles (painel direito)
  group.userData.uiSchema = [
    { id:'rotSpeed', type:'range', label:'Velocidade de rotação', min:0, max:5, step:0.1, value:params.rotSpeed },
    { id:'running',  type:'toggle', label:'Ativar rotação', value:params.running }
  ];

  // Raiz local
  const root = new THREE.Group();
  root.position.set(0,0.5,0);
  group.add(root);

  // Luzes
  const amb = new THREE.AmbientLight(0xffffff, 0.6);
  const key = new THREE.DirectionalLight(0xffffff, 0.8); key.position.set(3,3,2);
  root.add(amb, key);

  // --- Geometria do tubo + eletrodos ---
  const tubeLen = 6.0;
  const tubeR   = 0.6;

  // Tubo transparente
  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(tubeR, tubeR, tubeLen, 48, 1, true),
    new THREE.MeshPhongMaterial({ color:0x88a0c8, transparent:true, opacity:0.18, side:THREE.DoubleSide })
  );
  tube.rotation.z = Math.PI/2;
  root.add(tube);

  // Eletrodos (discos) nas extremidades
  const elR = tubeR * 0.9, elT = 0.14;
  const elMatL = new THREE.MeshPhongMaterial({ color:0x4d6a8f, shininess:60 });
  const elMatR = new THREE.MeshPhongMaterial({ color:0x6b5f3a, shininess:60 });

  const leftEl = new THREE.Mesh(new THREE.CylinderGeometry(elR, elR, elT, 64), elMatL);
  leftEl.rotation.z = Math.PI/2;
  leftEl.position.set(-tubeLen/2 + elT/2, 0, 0);

  const rightEl = new THREE.Mesh(new THREE.CylinderGeometry(elR, elR, elT, 64), elMatR);
  rightEl.rotation.z = Math.PI/2;
  rightEl.position.set( tubeLen/2 - elT/2, 0, 0);

  root.add(leftEl, rightEl);

  // API
  group.userData.api = {
    set:(k,v)=>{
      if (k==='rotSpeed') params.rotSpeed = Number(v)||0;
      else if (k==='running') params.running = !!v;
    },
    get:(k)=> params[k]
  };

  // Animação
  group.userData.anim = (dt)=>{
    if (params.running){
      root.rotation.y += params.rotSpeed * dt;
    }
  };

  // Dispose
  group.userData.dispose = ()=>{
    root.removeFromParent();
    tube.geometry.dispose(); tube.material.dispose();
    leftEl.geometry.dispose(); leftEl.material.dispose();
    rightEl.geometry.dispose(); rightEl.material.dispose();
  };
}
