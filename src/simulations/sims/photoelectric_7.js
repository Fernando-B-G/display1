// src/simulations/sims/photoelectric_7.js
import * as THREE from 'three';
import { attachUI } from '../core.js';

export function buildSim_7(group){
  const params = { frequency:1.0, photonRate:0.35, electronGain:1.0 };

  const alvo = new THREE.Mesh(
    new THREE.BoxGeometry(10, 3, 0.5),
    new THREE.MeshStandardMaterial({ color:0x334855, metalness:0.4, roughness:0.4 })
  );
  alvo.position.set(-4, -1.5, 0);
  group.add(alvo);

  const emissor = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 16, 16),
    new THREE.MeshStandardMaterial({ color:0xffdd66, emissive:0x664400, emissiveIntensity:0.6 })
  );
  emissor.position.set(-10, 3, 1);
  group.add(emissor);

  const eletrons = [];
  const fotons = [];

  function spawnPhoton(){
    const geo = new THREE.SphereGeometry(0.12, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color:0xffee88 });
    const p = new THREE.Mesh(geo, mat);
    p.position.copy(emissor.position);
    p.userData.v = new THREE.Vector3(1.6, -0.25 + Math.random()*0.5, 0);
    group.add(p); fotons.push(p);
  }

  function spawnElectron(pos){
    const geo = new THREE.SphereGeometry(0.13, 10, 10);
    const mat = new THREE.MeshBasicMaterial({ color:0x66ffd1 });
    const e = new THREE.Mesh(geo, mat);
    e.position.copy(pos).add(new THREE.Vector3(0.2, 0.2, 0));
    const base = 0.9 + Math.random()*0.6;
    const speed = (0.6 + (params.frequency-0.9)*1.4) * params.electronGain * base;
    e.userData.v = new THREE.Vector3(speed, 0.2 - Math.random()*0.4, 0);
    group.add(e); eletrons.push(e);
  }

  group.userData.anim = (dt)=>{
    if (Math.random() < params.photonRate) spawnPhoton();

    for (let i=fotons.length-1;i>=0;i--){
      const f = fotons[i];
      f.position.addScaledVector(f.userData.v, dt*12);
      if (f.position.x > -5.5 && f.position.y < 0.2 && f.position.y > -3.2){
        if (params.frequency >= 0.9) spawnElectron(new THREE.Vector3(-5.4, f.position.y, 0));
        group.remove(f); f.geometry.dispose(); f.material.dispose(); fotons.splice(i,1);
      } else if (f.position.x > 12){
        group.remove(f); f.geometry.dispose(); f.material.dispose(); fotons.splice(i,1);
      }
    }

    for (let i=eletrons.length-1;i>=0;i--){
      const e = eletrons[i];
      e.position.addScaledVector(e.userData.v, dt*8);
      if (e.position.x > 12){
        group.remove(e); e.geometry.dispose(); e.material.dispose(); eletrons.splice(i,1);
      }
    }
  };

  group.userData.objects.push(alvo, emissor);

  attachUI(group, params, [
    { id:'frequency',   label:'Frequência relativa', type:'range', min:0.6, max:1.6, step:0.02, value:1.0 },
    { id:'photonRate',  label:'Taxa de fótons',      type:'range', min:0.05, max:0.8, step:0.01, value:0.35 },
    { id:'electronGain',label:'Ganho do elétron',    type:'range', min:0.5,  max:2.0, step:0.05, value:1.0 }
  ]);
}
