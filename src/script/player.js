import * as THREE from 'three';
// src/script/player.js
// Pequeno “engine” de roteiro com passos sequenciais e tweens.

export class ScriptPlayer {
  constructor(ctx){
    // ctx: { nodeId, simGroup, simAPI, simCamera, setText, setStatus, onEnd }
    this.ctx = ctx;
    this.steps = [];
    this.i = 0;
    this.playing = false;
    this.paused = false;
    this.abort = false;
    this._raf = null;
    this._tweeners = new Set();
  }

  load(steps){            // steps = array de comandos (ver exemplos)
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
    this.ctx.setStatus?.('tocando...');

    while (this.i < this.steps.length){
      if (this.abort) break;
      if (this.paused){ await sleep(120); continue; }

      const step = this.steps[this.i++];
      try {
        // cada step pode ser síncrono ou retornar Promise
        const p = this._runStep(step);
        if (p && typeof p.then === 'function') await p;
      } catch(e){ console.warn('[ScriptPlayer] erro no step', e); }
    }

    this.playing = false;
    if (!this.abort){
      this.ctx.setStatus?.('concluído');
      this.ctx.onEnd?.(); // dispara votação
    } else {
      this.ctx.setStatus?.('interrompido');
    }
  }

  pause(){
    if (!this.playing) return;
    this.paused = !this.paused;
    this.ctx.setStatus?.(this.paused ? 'pausado' : 'tocando...');
  }

  stop(){
    // finaliza tudo e reseta
    this.abort = true;
    this.paused = false;
    this.playing = false;
    this.i = 0;
    // cancela tweens ativos
    this._tweeners.forEach(t => t.cancel && t.cancel());
    this._tweeners.clear();
    this.ctx.setStatus?.('pronto');
  }

  // ===== executores de passos =====
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

    if (step.wait){ // {wait:1000}
      await sleep(step.wait);
      return;
    }

    if (step.set){ // {set:{param: value, ...}}
      const o = step.set;
      Object.keys(o).forEach(k => this.ctx.simAPI?.set?.(k, o[k]));
      return;
    }

    if (step.tween){ // {tween:{key:'param', to:1.5, dur:1200, ease:'easeInOut'}}
      const { key, to, dur=800, ease='easeInOut' } = step.tween;
      const from = this.ctx.simAPI?.get?.(key);
      if (typeof from === 'number' && typeof to === 'number'){
        await this._tweenValue(v => this.ctx.simAPI.set(key, v), from, to, dur, ease);
      }
      return;
    }

    if (step.camera){ // {camera:{pos:[x,y,z], lookAt:[x,y,z], dur:800, ease:'linear'}}
      const { pos, lookAt, dur=800, ease='easeInOut' } = step.camera;
      await this._tweenCamera(pos, lookAt, dur, ease);
      return;
    }

    if (step.call){ // {call:'nome', args:{...}}
      // gancho simples: se você quiser hooks customizados por nó
      const fn = this.ctx[step.call];
      if (typeof fn === 'function') await fn(step.args);
      return;
    }

    if (step.parallel){ // {parallel:[{...},{...}], dur opcional}
      // executa em paralelo; espera todas terminarem
      const arr = Array.isArray(step.parallel) ? step.parallel : [];
      await Promise.all(arr.map(s => this._runStep(s)));
      return;
    }

    if (step.until){ // {until:()=>boolean, checkEach:100}
      const dt = step.checkEach ?? 120;
      while(!this.abort && !(await maybeAsync(step.until))) await sleep(dt);
      return;
    }

    if (step.note){ // comentário
      return;
    }
  }

  async _tweenValue(apply, from, to, dur, easeName){
    const ease = easings[easeName] || easings.easeInOut;
    let t0; let cancelled=false;
    const tweener = { cancel: ()=>{ cancelled=true; } };
    this._tweeners.add(tweener);

    await new Promise(resolve=>{
      const loop = (now)=>{
        if (!t0) t0 = now;
        const u = Math.min(1, (now - t0)/dur);
        apply( from + (to-from) * ease(u) );
        if (!cancelled && u < 1 && !this.abort){
          this._raf = requestAnimationFrame(loop);
        } else {
          resolve();
        }
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
      const loop = (now)=>{
        if (!tStart) tStart = now;
        const u = Math.min(1, (now - tStart)/dur);
        const k = ease(u);
        cam.position.lerpVectors(p0, p1, k);
        const tgt = t0.clone().lerp(t1, k);
        cam.lookAt(tgt);
        this.ctx._camTarget = tgt.clone();
        if (!cancelled && u < 1 && !this.abort){
          this._raf = requestAnimationFrame(loop);
        } else {
          resolve();
        }
      };
      this._raf = requestAnimationFrame(loop);
    });

    this._tweeners.delete(tweener);
  }
}

// ===== utils =====
function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
function vec3(a){ return new THREE.Vector3(a[0], a[1], a[2]); }

// Easing básicos
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
