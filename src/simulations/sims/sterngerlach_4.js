// src/simulations/sims/sterngerlach_4.js
import * as THREE from 'three';
import { attachUI } from '../core.js';

export function buildSim_4(group){
  const params = { fieldStrength:1.0, flip:1, spawnRate:0.7 };

  const forno = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 2.2, 16),
    new THREE.MeshStandardMaterial({ color:0x888, metalness:0.5, roughness:0.5 })
  );
  forno.position.set(-10, 0, 0);
  group.add(forno);

  const campo = new THREE.Mesh(
    new THREE.BoxGeometry(6, 4, 0.5),
    new THREE.MeshStandardMaterial({ color:0x223546, metalness:0.2, roughness:0.6, transparent:true, opacity:0.25 })
  );
  campo.position.set(-3, 0, 0);
  group.add(campo);

  const anteparo = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 6),
    new THREE.MeshBasicMaterial({ color:0x0b2030 })
  );
  anteparo.position.set(6, 0, 0.1);
  group.add(anteparo);

  const particulas = [];
  function spawn(){
    const g = new THREE.SphereGeometry(0.12, 10, 10);
    const m = new THREE.MeshBasicMaterial({ color:0x9fdcff });
    const s = new THREE.Mesh(g, m);
    s.position.set(-10, 0, 0);
    s.userData.spin = (Math.random() < 0.5) ? +1 : -1;
    group.add(s); particulas.push(s);
  }

  group.userData.anim = (dt)=>{
    if (Math.random() < params.spawnRate) spawn();
    for (let i=particulas.length-1;i>=0;i--){
      const p = particulas[i];
      if (p.position.x > -6 && p.position.x < 0){
        p.position.y += p.userData.spin * params.flip * params.fieldStrength * dt * 2.0;
      }
      p.position.x += dt * 6.0;
      if (p.position.x > 6){
        group.remove(p); p.geometry.dispose(); p.material.dispose(); particulas.splice(i,1);
      }
    }
  };

  group.userData.objects.push(forno, campo, anteparo);

  attachUI(group, params, [
    { id:'fieldStrength', label:'Intensidade do campo', type:'range', min:0.4, max:2.0, step:0.1, value:1.0 },
    { id:'flip',          label:'Inverter campo',       type:'toggle', value:false }, // false=+1, true=-1
    { id:'spawnRate',     label:'Taxa de partículas',   type:'range', min:0.1, max:1.0, step:0.05, value:0.7 }
  ]);

  // adapta toggle para +1/-1:
  const origSet = group.userData.api.set;
  group.userData.api.set = (k, v) => {
    if (k === 'flip') params.flip = (v ? -1 : +1);
    else origSet(k, v);
  };
}
