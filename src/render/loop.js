// src/render/loop.js
import { refs } from '../core/state.js';
import { getNodeGroups } from '../graph.js';
import { updateCenterSim } from '../simulations/index.js';

export function startLoop(){
  function animate(){
    requestAnimationFrame(animate);
    const dt = refs.clock.getDelta();

    if (refs.starField) refs.starField.rotation.y += dt * 0.02;

    const nodeGroups = getNodeGroups(refs.mindmapGroup);
    nodeGroups.forEach(node=>{
      const { previewScene, previewCamera, rt, isActive, step, simRT } = node.userData || {};
      if (!rt) return;

      const targetW = isActive ? 1024 : 480;
      const targetH = isActive ?  576 : 270;
      if (rt.width !== targetW || rt.height !== targetH) rt.setSize(targetW, targetH);

      refs.renderer.setRenderTarget(rt);
      if (simRT) {
        simRT.update && simRT.update(dt);
        refs.renderer.render(simRT.scene, simRT.camera);
      } else if (previewScene && previewCamera) {
        if (typeof step === 'function') step(dt);
        refs.renderer.render(previewScene, previewCamera);
      }
    });
    refs.renderer.setRenderTarget(null);

    nodeGroups.forEach(obj => {
      obj.quaternion.copy(refs.camera.quaternion);
      /*obj.rotateY(Math.PI);*/
    });

    if (refs.centerSimGroup.visible) updateCenterSim(refs.centerSimGroup, dt);

    refs.controls.update();
    refs.renderer.render(refs.scene, refs.camera);
  }
  animate();
}
