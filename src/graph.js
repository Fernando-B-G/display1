import * as THREE from 'three';
import { roundRect } from './utils.js';

/* Cores */
export const COL_A  = 0x4ea1ff;   // azul caminho A
export const COL_B  = 0xffa14e;   // laranja caminho B
export const COL_9  = 0x54e89b;   // verde
export const COL_10 = 0xbc7aff;   // roxo
export const COL_C  = 0x9fb3c8;   // convergência / hub

export const nodesData = [
  { id:'1',   label:'1 — Introdução',           path:'hub' },
  { id:'2',   label:'2 — Espectro H',           path:'A'   },
  { id:'3',   label:'3 — Bohr',                 path:'A'   },
  { id:'4',   label:'4 — Spin / Estrutura',     path:'A'   },
  { id:'5a',  label:'5a — Schrödinger',         path:'C'   },
  { id:'5b',  label:'5b — Matricial/Incerteza', path:'C'   },
  { id:'5c',  label:'5c — Formalismo Unificado',path:'C'   },
  { id:'6',   label:'6 — Corpo Negro/Planck',   path:'B'   },
  { id:'7',   label:'7 — Fotoelétrico',         path:'B'   },
  { id:'8',   label:'8 — de Broglie/Difração',  path:'B'   },
  { id:'9',   label:'9 — Mom.Ang./Números',     path:'extra9' },
  { id:'10',  label:'10 — Curie/Radioatividade',path:'extra10' },
];

export const edgesData = [
  // Caminho A
  ['1','2'], ['2','3'], ['3','4'], ['4','5a'], ['5a','5b'], ['5b','5c'],
  // Caminho B
  ['1','6'], ['6','7'], ['7','8'], ['8','5a'],
  // Extras
  ['3','9'], ['7','10']
];

export function colorOf(path){
  if(path==='A') return COL_A;
  if(path==='B') return COL_B;
  if(path==='extra9') return COL_9;
  if(path==='extra10')return COL_10;
  return COL_C;
}

export function buildMindmap(group){
  const positions = layoutPositions();

  // criar nós (molduras planas com canvas)
  nodesData.forEach(n=>{
    const color = colorOf(n.path);
    const mesh = makeNodeFrame(n.label, color);
    mesh.position.copy(positions[n.id]);
    mesh.userData = { id:n.id, label:n.label, color, path:n.path };
    group.add(mesh);
  });

  // criar conexões
  edgesData.forEach(([a,b])=>{
    const na = group.children.find(m=>m.userData?.id===a);
    const nb = group.children.find(m=>m.userData?.id===b);
    if(!na || !nb) return;

    const color = edgeColor(a,b);
    const geom = new THREE.BufferGeometry().setFromPoints([na.position, nb.position]);
    const mat  = new THREE.LineBasicMaterial({ color, transparent:true, opacity:0.9 });
    const line = new THREE.Line(geom, mat);

    // arqueamento suave
    const mid = na.position.clone().add(nb.position).multiplyScalar(0.5).add(new THREE.Vector3(0, 2.5, 0));
    const pts = new THREE.CatmullRomCurve3([na.position, mid, nb.position]).getPoints(20);
    line.geometry.setFromPoints(pts);
    group.add(line);
  });
}

export function getNodeMeshes(group){
  return group.children.filter(o => o.isMesh && o.geometry?.type === 'PlaneGeometry');
}

/* Helpers */
function edgeColor(a,b){
  const Aset = new Set(['1','2','3','4','5a','5b','5c']);
  const Bset = new Set(['1','6','7','8','5a','5b','5c']);
  if (Aset.has(a) && Aset.has(b)) return COL_A;
  if (Bset.has(a) && Bset.has(b)) return COL_B;
  if (a==='3' && b==='9') return COL_9;
  if (a==='7' && b==='10') return COL_10;
  return COL_C;
}

function layoutPositions(){
  return {
    '1'  : new THREE.Vector3(0, 24, 0),

    // Caminho A (esquerda)
    '2'  : new THREE.Vector3(-26, 18, -6),
    '3'  : new THREE.Vector3(-40, 12,  0),
    '4'  : new THREE.Vector3(-26,  6,  6),

    // Caminho B (direita)
    '6'  : new THREE.Vector3( 26, 18, -6),
    '7'  : new THREE.Vector3( 40, 12,  0),
    '8'  : new THREE.Vector3( 26,  6,  6),

    // Convergência
    '5a' : new THREE.Vector3(  0,  3,  0),
    '5b' : new THREE.Vector3(  0, -4,  0),
    '5c' : new THREE.Vector3(  0, -11, 0),

    // extras
    '9'  : new THREE.Vector3(-48,  4, -10),
    '10' : new THREE.Vector3( 48,  4, -10),
  };
}

function makeNodeFrame(label, colorHex){
  const w=768, h=432, r=36;
  const canvas = document.createElement('canvas');
  canvas.width=w; canvas.height=h;
  const ctx = canvas.getContext('2d');

  // fundo translúcido + borda
  ctx.lineWidth = 10;
  ctx.strokeStyle = `#${colorHex.toString(16).padStart(6,'0')}`;
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  roundRect(ctx, 5, 5, w-10, h-10, r, true, true);

  // texto
  ctx.fillStyle = '#E6F2FF';
  ctx.font = 'bold 44px Inter, Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, w/2, h/2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;

  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent:true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), mat);
  mesh.userData.canvas = canvas;
  mesh.userData.ctx = ctx;
  return mesh;
}
