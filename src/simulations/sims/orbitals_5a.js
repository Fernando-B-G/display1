// src/simulations/sims/orbitals_5a.js
import * as THREE from 'three';
import { attachUI } from '../core.js';

export function buildSim_5a(group){
  const params = { rotSpeed:0.35, pointSize:0.08, lobeBias:1.2 };

  const NUM = 2800;
  const g = new THREE.BufferGeometry();
  const a = new Float32Array(NUM*3);
  for(let i=0;i<NUM;i++){
    const r = 1.2 + Math.random()*4.0;
    const u = Math.random()*2-1;
    const bias = Math.pow(Math.abs(u), params.lobeBias);
    const th = Math.acos(Math.sign(u)*bias);
    const ph = Math.random()*Math.PI*2;
    a[i*3]   = Math.sin(th)*Math.cos(ph)*r;
    a[i*3+1] = Math.cos(th)*r;
    a[i*3+2] = Math.sin(th)*Math.sin(ph)*0.7*r;
  }
  g.setAttribute('position', new THREE.BufferAttribute(a,3));
  const mat = new THREE.PointsMaterial({ color:0x9fdcff, size:params.pointSize, transparent:true, opacity:0.85 });
  const pts = new THREE.Points(g, mat);
  pts.position.set(0, 0, 0.3);

  group.add(pts);
  group.userData.objects.push(pts);

  group.userData.anim = (dt)=>{
    pts.rotation.y += dt*params.rotSpeed;
    pts.rotation.x += dt*(params.rotSpeed*0.45);
    pts.material.size = params.pointSize;
  };

  attachUI(group, params, [
    { id:'rotSpeed',  label:'Velocidade de rotação', type:'range', min:0,    max:1.0, step:0.01, value:0.35 },
    { id:'pointSize', label:'Tamanho dos pontos',     type:'range', min:0.02, max:0.20, step:0.01, value:0.08 },
    { id:'lobeBias',  label:'Ênfase dos lóbulos',     type:'range', min:0.8,  max:2.0,  step:0.05, value:1.2 }
  ]);
}
