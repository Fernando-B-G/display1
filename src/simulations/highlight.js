import * as THREE from 'three';

// Attach a generic highlighter to a simulation group.
// Returns a highlight(id, opts) function that animates emissive color/intensity.
export function attachHighlighter(group, root = group) {
  const active = [];
  const prevAnim = group.userData.anim;

  group.userData.anim = function(dt) {
    if (typeof prevAnim === 'function') prevAnim(dt);

    for (let i = active.length - 1; i >= 0; i--) {
      const h = active[i];
      h.elapsed += dt * 1000; // dt is in seconds, convert to ms
      const t = h.elapsed / h.dur;
      const mat = h.obj.material;
      if (t >= 1) {
        mat.emissive.copy(h.origColor);
        mat.emissiveIntensity = h.origIntensity;
        mat.needsUpdate = true;
        active.splice(i, 1);
        continue;
      }
      const r = t < 0.5 ? t / 0.5 : (1 - t) / 0.5; // 0→1→0
      mat.emissive.copy(h.origColor).lerp(h.color, r);
      mat.emissiveIntensity = h.origIntensity + (h.intensity - h.origIntensity) * r;
      mat.needsUpdate = true;
    }
  };

  return function highlight(id, opts = {}) {
    const obj = root.getObjectByName(id);
    if (!obj) return;
    const mat = obj.material;
    if (!mat || !mat.emissive) return;

    const color = new THREE.Color(opts.color ?? 0xffff00);
    const dur = opts.dur ?? 1200;
    const intensity = opts.intensity ?? 1.5;

    for (let i = 0; i < active.length; i++) {
      if (active[i].obj === obj) {
        active.splice(i, 1);
        break;
      }
    }

    active.push({
      obj,
      color,
      dur,
      elapsed: 0,
      origColor: mat.emissive.clone(),
      origIntensity: mat.emissiveIntensity ?? 1,
      intensity
    });
  };
}