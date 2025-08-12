// src/simulations/registry.js
import { initCenterSim, disposeNodeSimulation } from './core.js';
import { buildSim_5a } from './sims/orbitals_5a.js';
import { buildSim_7 } from './sims/photoelectric_7.js';
import { buildSim_4 } from './sims/sterngerlach_4.js';
import { buildSim_fallback } from './sims/fallback.js';

// 🔸 NOVO: introdutório (prisma/sol/espectros)
// Crie este arquivo no mesmo padrão dos demais builders:
// export function buildSim_1(group){ ... group.userData.uiSchema = [...]; group.userData.api = {...}; ... }
import { buildSim_1 } from './sims/intro_1.js';

const REGISTRY = {
  '1' : buildSim_1,  // ⬅️ novo
  '5a': buildSim_5a,
  '7' : buildSim_7,
  '4' : buildSim_4
  // adicione aqui outros nós quando modularizar mais
};

export async function loadNodeSimulation(group, nodeId){
  // mantém compat com o core
  disposeNodeSimulation(group);
  group.userData.currentId = nodeId;

  const builder = REGISTRY[nodeId] || ((g)=>buildSim_fallback(g, nodeId));
  builder(group);
}

// UI schema: usa o que a sim publicou; se não, fallback por nó
export function getUISchema(nodeId, group){
  if (group?.userData?.uiSchema) return group.userData.uiSchema;

  switch (nodeId){
    case '1': // 🔸 fallback de UI se o builder não publicar uiSchema
      return [
        { id:'source',      label:'Fonte de luz',          type:'select',
          options:['Sol (contínuo)','Sódio','Mercúrio','Hidrogênio'], value:'Sol (contínuo)' },
        { id:'intensity',   label:'Intensidade',           type:'range', min:0,    max:1.5, step:0.01, value:1.0 },
        { id:'spread',      label:'Abertura (dispersão)',  type:'range', min:0.4,  max:2.0, step:0.01, value:1.0 },
        { id:'prismAngle',  label:'Ângulo do prisma',      type:'range', min:-35,  max:35,  step:1,    value:-16 },
        { id:'showLabels',  label:'Mostrar UV / IR',       type:'toggle', value:true }
      ];

    case '5a':
      return [
        { id:'rotSpeed',  label:'Velocidade de rotação', type:'range', min:0,    max:1.0, step:0.01, value:0.35 },
        { id:'pointSize', label:'Tamanho dos pontos',     type:'range', min:0.02, max:0.20, step:0.01, value:0.08 },
        { id:'lobeBias',  label:'Ênfase dos lóbulos',     type:'range', min:0.8,  max:2.0,  step:0.05, value:1.2 }
      ];

    case '7':
      return [
        { id:'frequency',   label:'Frequência relativa', type:'range', min:0.6, max:1.6, step:0.02, value:1.0 },
        { id:'photonRate',  label:'Taxa de fótons',      type:'range', min:0.05, max:0.8, step:0.01, value:0.35 },
        { id:'electronGain',label:'Ganho do elétron',    type:'range', min:0.5,  max:2.0, step:0.05, value:1.0 }
      ];

    case '4':
      return [
        { id:'fieldStrength', label:'Intensidade do campo', type:'range', min:0.4, max:2.0, step:0.1, value:1.0 },
        { id:'flip',          label:'Inverter campo',       type:'toggle', value:false },
        { id:'spawnRate',     label:'Taxa de partículas',   type:'range', min:0.1, max:1.0, step:0.05, value:0.7 }
      ];

    default:
      return [];
  }
}
