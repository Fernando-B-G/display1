// graph.js
import * as THREE from 'three';
import { roundRect } from './utils.js';
import { createPreviewFor } from './nodePreviews.js';

/* ===== Cores ===== */
export const COL_A  = 0x4ea1ff;   // azul caminho A (topo)
export const COL_B  = 0xffa14e;   // laranja caminho B (base)
export const COL_9  = 0xff4e4e;   // vermelho (extra depois do 3)
export const COL_10 = 0xff4e4e;   // vermelho (extra depois do 7)
export const COL_C  = 0xbc7aff;   // roxo (convergência / hub)

/* ===== Dados ===== */
export const nodesData = [
  { id:'1',   label:'1 — Introdução',           path:'hub' },
  // Caminho A (topo)
  { id:'2',   label:'2 — Espectro H',           path:'A'   },
  { id:'3',   label:'3 — Bohr',                 path:'A'   },
  { id:'4',   label:'4 — Spin / Estrutura',     path:'A'   },
  // Convergência
  { id:'5a',  label:'5a — Schrödinger',         path:'C'   },
  { id:'5b',  label:'5b — Matricial/Incerteza', path:'C'   },
  { id:'5c',  label:'5c — Formalismo Unificado',path:'C'   },
  // Caminho B (base)
  { id:'6',   label:'6 — Corpo Negro/Planck',   path:'B'   },
  { id:'7',   label:'7 — Fotoelétrico',         path:'B'   },
  { id:'8',   label:'8 — de Broglie/Difração',  path:'B'   },
  // Extras
  { id:'9',   label:'9 — Mom.Ang./Números',     path:'extra9' },
  { id:'10',  label:'10 — Curie/Radioatividade',path:'extra10' },
];

export const edgesData = [
  // Caminho A
  ['1','2'], ['2','3'], ['3','4'], ['4','5a'], ['5a','5b'], ['5b','5c'],

  // Caminho B
  ['1','6'], ['6','7'], ['7','8'], ['8','5a'],

  // Extras já existentes
  ['3','9'], ['7','10'],

  // Novas ligações solicitadas
  ['2','7'],  // ligação cruzada
  ['10','8'], // retorno
  ['9','4'],  // retorno
  ['8','3']   // ligação cruzada
];

/* ===== API ===== */
export function colorOf(path){
  if(path==='A') return COL_A;
  if(path==='B') return COL_B;
  if(path==='extra9') return COL_9;
  if(path==='extra10')return COL_10;
  return COL_C;
}

export function buildMindmap(group){
  const positions = layoutPositions();

  // criar nós como GROUP com frame + display (renderTarget)
  nodesData.forEach(n=>{
    const color = colorOf(n.path);
    const nodeGroup = makeNodeGroup(n.id, n.label, color);
    nodeGroup.userData.path = n.path;
    nodeGroup.position.copy(positions[n.id]);
    group.add(nodeGroup);
  });

  // conexões (linhas coloridas com leve arco)
  edgesData.forEach(([a,b])=>{
    const na = findNodeGroup(group, a);
    const nb = findNodeGroup(group, b);
    if(!na || !nb) return;

    const color = edgeColor(a,b);
    const mat  = new THREE.LineBasicMaterial({ color, transparent:true, opacity:0.9 });
    const line = new THREE.Line(new THREE.BufferGeometry(), mat);

    const mid = na.position.clone().add(nb.position).multiplyScalar(0.5).add(new THREE.Vector3(0, 2.0, 0));
    const pts = new THREE.CatmullRomCurve3([na.position, mid, nb.position]).getPoints(24);
    line.geometry.setFromPoints(pts);
    group.add(line);
  });
}

// retorna todos os GROUPs de nó
export function getNodeGroups(group){
  return group.children.filter(o => o.isGroup && o.userData?.rt);
}

// util p/ achar um nó pelo id
function findNodeGroup(group, id){
  return group.children.find(o => o.isGroup && o.userData?.id === id);
}

/* ===== Layout horizontal ===== */
function layoutPositions(){
  const yTop = 10;   // linha de cima (Azul - caminho A)
  const yBot = -6;   // linha de baixo (Laranja - caminho B)
  const stepX = 22;

  return {
    // nó inicial à esquerda
    '1'  : new THREE.Vector3(0, 2, 0),

    // Caminho A (topo, azul)
    '2'  : new THREE.Vector3(1*stepX, yTop, 0),
    '3'  : new THREE.Vector3(2*stepX, yTop, 0),
    '4'  : new THREE.Vector3(3*stepX, yTop, 0),

    // Caminho B (base, laranja)
    '6'  : new THREE.Vector3(1*stepX, yBot, 0),
    '7'  : new THREE.Vector3(2*stepX, yBot, 0),
    '8'  : new THREE.Vector3(3*stepX, yBot, 0),

    // Convergência (centro-direita)
    '5a' : new THREE.Vector3( 4*stepX,  2, 0),
    '5b' : new THREE.Vector3( 5*stepX,  2, 0),
    '5c' : new THREE.Vector3( 6*stepX,  2, 0),

    // extras (saem de 3 e 7)
    '9'  : new THREE.Vector3(2.5*stepX, yTop*2, 0),   // acima de 3
    '10' : new THREE.Vector3(2.5*stepX, yBot*3, 0)    // abaixo de 7
  };
}

/* ===== Criação do nó como GROUP com display interno ===== */
function makeNodeGroup(id, label, colorHex){
  // --- FRAME (canvas com borda + título) ---
  const w=768, h=432, r=36;
  const canvas = document.createElement('canvas');
  canvas.width=w; canvas.height=h;
  const ctx = canvas.getContext('2d');
  ctx.lineWidth = 10;
  ctx.strokeStyle = `#${colorHex.toString(16).padStart(6,'0')}`;
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  roundRect(ctx, 5, 5, w-10, h-10, r, true, true);
  ctx.fillStyle = '#E6F2FF';
  
  ctx.font = 'bold 44px Inter, Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, w/2, h/2);
  const tex = new THREE.CanvasTexture(canvas);

  const frameMat  = new THREE.MeshBasicMaterial({ map: tex, transparent:true });
  const frameMesh = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), frameMat);

  // --- DISPLAY INTERNO (render target do preview) ---
  const rt = new THREE.WebGLRenderTarget(480, 270, { samples: 0 }); // menor por padrão
  const displayMat  = new THREE.MeshBasicMaterial({ map: rt.texture, transparent:true });
  const displayMesh = new THREE.Mesh(new THREE.PlaneGeometry(15.2, 8.2), displayMat);
  displayMesh.position.z = 0.02;

  // --- GROUP ---
  const group = new THREE.Group();
  group.add(frameMesh);
  group.add(displayMesh);

  // === Pré-vias temáticas por nó (usa nodePreviews) ===
  const { scene: previewScene, camera: previewCamera, step } = createPreviewFor(id);

  group.userData = {
    id, label, color: colorHex, path: null,
    canvas, ctx, rt, displayMesh,
    previewScene, previewCamera,
    step,                 // <- função de animação específica do nó
    isActive: false
  };

  return group;

}

/* ===== Helpers ===== */
function edgeColor(a,b){
  const Aset = new Set(['1','2','3','4','5a','5b','5c']);
  const Bset = new Set(['1','6','7','8','5a','5b','5c']);
  if (Aset.has(a) && Aset.has(b)) return COL_A;
  if (Bset.has(a) && Bset.has(b)) return COL_B;
  if (a==='3' && b==='9') return COL_9;
  if (a==='7' && b==='10') return COL_10;
  return COL_C;
}
