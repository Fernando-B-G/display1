import * as THREE from 'three';

export function createStars(count=1600){
  const g = new THREE.BufferGeometry();
  const positions = new Float32Array(count*3);
  for(let i=0;i<count;i++){
    const r = 80 + Math.random()*200;
    const t = Math.random()*Math.PI*2;
    const p = (Math.random()-0.5)*Math.PI;
    positions[i*3]   = Math.cos(t)*Math.cos(p)*r;
    positions[i*3+1] = Math.sin(p)*r*0.6;
    positions[i*3+2] = Math.sin(t)*Math.cos(p)*r;
  }
  g.setAttribute('position', new THREE.BufferAttribute(positions,3));
  const m = new THREE.PointsMaterial({ color:0x8fd0ff, size:0.35, transparent:true, opacity:0.9 });
  return new THREE.Points(g, m);
}
