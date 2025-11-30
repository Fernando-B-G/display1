// src/script/player.js
import * as THREE from 'three';
import { updateControlDisplay } from '../ui.js'; // <--- IMPORTANTE

export class ScriptPlayer {
  constructor(ctx){
    this.ctx = ctx;
    this.steps = [];
    this.i = 0;
    this.playing = false;
    this.paused = false;
    this.abort = false;
    this._raf = null;
    this._tweeners = new Set();

    this._initCamPos = ctx.simCamera?.position.clone();
    this._initCamTarget = ctx._camTarget ? ctx._camTarget.clone() : new THREE.Vector3();
    this._initGroupPos = ctx.simGroup?.position.clone();
    this._initGroupRot = ctx.simGroup?.rotation.clone();
  }

  load(steps){
    this.steps = Array.isArray(steps) ? steps : [];
    this.i = 0;
    this.playing = false;
    this.paused = false;
    this.abort = false;
  }

  async play(){
    if (this.playing) return;
    this.playing = true;
    this.paused = false; this.abort = false;
    this.ctx.updatePlayPauseState?.('playing');

    while (this.i < this.steps.length){
      if (this.abort) break;
      if (this.paused){ await sleep(120); continue; }

      const step = this.steps[this.i++];
      try{
        const p = this._runStep(step);
        if (p && typeof p.then === 'function') await p;
      }catch(e){ console.warn('[ScriptPlayer] erro no step', e); }
    }

    this.playing = false;
    if (!this.abort){
      this.ctx.updatePlayPauseState?.('stopped');
      this.ctx.onEnd?.();
    } else {
      this.ctx.updatePlayPauseState?.('stopped');
    }
  }

  pause(){
    if (!this.playing) return;
    this.paused = !this.paused;
    this.ctx.updatePlayPauseState?.(this.paused ? 'paused' : 'playing');
  }

  stop(){
    this.abort = true;
    this.paused = false;
    this.playing = false;
    this.i = 0;
    this._tweeners.forEach(t => t.cancel && t.cancel());
    this._tweeners.clear();
    this.ctx.updatePlayPauseState?.('stopped');

    this.ctx.simAPI?.reset?.();

    if (this.ctx.simGroup){
      if (this._initGroupPos) this.ctx.simGroup.position.copy(this._initGroupPos);
      if (this._initGroupRot) this.ctx.simGroup.rotation.copy(this._initGroupRot);
    }

    if (this.ctx.simCamera){
      if (this._initCamPos) this.ctx.simCamera.position.copy(this._initCamPos);
      this.ctx._camTarget = this._initCamTarget ? this._initCamTarget.clone() : new THREE.Vector3();
      this.ctx.simCamera.lookAt(this.ctx._camTarget);
    }
  }

  async _runStep(step){
    if (!step) return;

    if (step.say){
      let text = step.say;
      if (typeof text !== 'string'){
        text = (text && (text.text || text.t)) ?? '';
      }
      const p = this.ctx.setText?.(text);
      if (p && typeof p.then === 'function'){
        await p;
      } else {
        await sleep(step.dur ?? 1800);
      }
      return;
    }

    if (step.wait){ await sleep(step.wait); return; }

    if (step.set){
      const o = step.set;
      Object.keys(o).forEach(k => {
        this.ctx.simAPI?.set?.(k, o[k]);
        // Atualiza a UI para refletir a mudança do script
        updateControlDisplay(k, o[k]); // <--- ATUALIZAÇÃO UI
      });
      return;
    }

    if (step.tween){
      const { key, to, dur=800, ease='easeInOut' } = step.tween;
      const from = this.ctx.simAPI?.get?.(key);
      if (typeof from === 'number' && typeof to === 'number'){
        await this._tweenValue(v => {
          this.ctx.simAPI.set(key, v);
          // Opcional: atualizar slider durante tween pode ser pesado, mas visualmente legal
          // updateControlDisplay(key, v); 
        }, from, to, dur, ease);
        // Garante valor final na UI
        updateControlDisplay(key, to); // <--- ATUALIZAÇÃO UI FINAL
      }
      return;
    }

    if (step.highlight){
      const h = typeof step.highlight === 'string' ? { id: step.highlight } : step.highlight;
      const dur = h.dur ?? step.dur;
      const opts = h.options ? { ...h.options, dur } : { dur };
      this.ctx.simAPI?.highlight?.(h.id, opts);
      if (dur) await sleep(dur);
      return;
    }

    if (step.camera){
      const { pos, lookAt, dur=800, ease='easeInOut' } = step.camera;
      await this._tweenCamera(pos, lookAt, dur, ease);
      return;
    }

    if (step.move){
      const { to, by, dur=800, ease='easeInOut' } = step.move;
      const grp = this.ctx.simGroup;
      if (grp){
        const target = Array.isArray(to)
          ? vec3(to)
          : grp.position.clone().add(Array.isArray(by) ? vec3(by) : new THREE.Vector3());
        await this._tweenMove(target, dur, ease);
      }
      return;
    }

    if (step.rotate){
      const { axis=[0,1,0], angle, deg, dur=800, ease='easeInOut' } = step.rotate;
      const a = typeof angle === 'number' ? angle
                : typeof deg === 'number' ? deg*Math.PI/180 : 0;
      await this._tweenRotate(axis, a, dur, ease);
      return;
    }

    if (step.call){
      let fn = this.ctx[step.call];
      if (!fn && this.ctx.simAPI) fn = this.ctx.simAPI[step.call];
      
      if (typeof fn === 'function') await fn(step.args);
      return;
    }

    if (step.parallel){
      const arr = Array.isArray(step.parallel) ? step.parallel : [];
      await Promise.all(arr.map(s => this._runStep(s)));
      return;
    }

    if (step.until){
      const dt = step.checkEach ?? 120;
      while(!this.abort && !(await maybeAsync(step.until))) await sleep(dt);
      return;
    }
  }

  async _tweenValue(apply, from, to, dur, easeName){
    const ease = easings[easeName] || easings.easeInOut;
    let t0; let cancelled=false;
    const tweener = { cancel: ()=>{ cancelled=true; } };
    this._tweeners.add(tweener);

    await new Promise(resolve=>{
      const loop = now => {
        if (!t0) t0 = now;
        const u = Math.min(1, (now - t0)/dur);
        apply(from + (to-from)*ease(u));
        if (!cancelled && u<1 && !this.abort) this._raf = requestAnimationFrame(loop);
        else resolve();
      };
      this._raf = requestAnimationFrame(loop);
    });
    this._tweeners.delete(tweener);
  }

  async _tweenCamera(pos, lookAt, dur, easeName){
    const cam = this.ctx.simCamera;
    if (!cam) return;
    const ease = easings[easeName] || easings.easeInOut;

    const p0 = cam.position.clone();
    const p1 = Array.isArray(pos) ? vec3(pos) : p0;
    const t0 = this.ctx._camTarget?.clone() || new THREE.Vector3(0,0,0);
    const t1 = Array.isArray(lookAt) ? vec3(lookAt) : t0;

    let tStart; let cancelled=false;
    const tweener = { cancel: ()=>{ cancelled=true; } };
    this._tweeners.add(tweener);

    await new Promise(resolve=>{
      const loop = now => {
        if (!tStart) tStart = now;
        const u = Math.min(1, (now - tStart)/dur);
        const k = ease(u);
        cam.position.lerpVectors(p0, p1, k);
        const tgt = t0.clone().lerp(t1, k);
        cam.lookAt(tgt);
        this.ctx._camTarget = tgt.clone();
        if (!cancelled && u<1 && !this.abort) this._raf = requestAnimationFrame(loop);
        else resolve();
      };
      this._raf = requestAnimationFrame(loop);
    });
    this._tweeners.delete(tweener);
  }

  async _tweenMove(toVec, dur, easeName){
    const grp = this.ctx.simGroup;
    if (!grp) return;
    const ease = easings[easeName] || easings.easeInOut;

    const p0 = grp.position.clone();
    const p1 = toVec.clone();

    let tStart; let cancelled=false;
    const tweener = { cancel: ()=>{ cancelled=true; } };
    this._tweeners.add(tweener);

    await new Promise(resolve=>{
      const loop = now => {
        if (!tStart) tStart = now;
        const u = Math.min(1, (now - tStart)/dur);
        const k = ease(u);
        grp.position.lerpVectors(p0, p1, k);
        if (!cancelled && u<1 && !this.abort) this._raf = requestAnimationFrame(loop);
        else resolve();
      };
      this._raf = requestAnimationFrame(loop);
    });
    this._tweeners.delete(tweener);
  }

  async _tweenRotate(axisArr, angle, dur, easeName){
    const grp = this.ctx.simGroup;
    if (!grp || !angle) return;
    const ease = easings[easeName] || easings.easeInOut;

    const axis = vec3(axisArr).normalize();
    const q0 = grp.quaternion.clone();
    const q1 = q0.clone().multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle));

    let tStart; let cancelled=false;
    const tweener = { cancel: ()=>{ cancelled=true; } };
    this._tweeners.add(tweener);

    await new Promise(resolve=>{
      const loop = now => {
        if (!tStart) tStart = now;
        const u = Math.min(1, (now - tStart)/dur);
        const k = ease(u);
        grp.quaternion.copy(q0).slerp(q1, k);
        if (!cancelled && u<1 && !this.abort) this._raf = requestAnimationFrame(loop);
        else resolve();
      };
      this._raf = requestAnimationFrame(loop);
    });
    this._tweeners.delete(tweener);
  }
}

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
function vec3(a){ return new THREE.Vector3(a[0], a[1], a[2]); }

const easings = {
  linear: t => t,
  easeInOut: t => 0.5*(1 - Math.cos(Math.PI*t)),
  easeOut: t => 1 - Math.pow(1 - t, 3),
  easeIn: t => Math.pow(t, 3)
};

async function maybeAsync(fnOrVal){
  try{
    if (typeof fnOrVal === 'function'){
      const r = fnOrVal();
      return (r && typeof r.then === 'function') ? !!(await r) : !!r;
    }
    return !!fnOrVal;
  }catch(e){ return false; }
}
