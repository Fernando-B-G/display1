import { refs } from '../core/state.js';
import { createRTSimulation } from './rt.js';

export {
  initCenterSim,
  updateCenterSim,
  setCenterSimColor,
  disposeNodeSimulation,
  attachUI
} from './core.js';

export { loadNodeSimulation, getUISchema, REGISTRY } from './registry.js';
export { createRTSimulation };

export async function preloadAllSimulations(ids){
  await Promise.all(ids.map(async id => {
    if (!refs.simCache[id]){
      refs.simCache[id] = await createRTSimulation(id);
    }
  }));
}
