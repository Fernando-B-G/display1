export function roundEase(t){
  // ease-in-out cosseno
  return t<0?0:(t>1?1:(0.5 - 0.5*Math.cos(Math.PI*t)));
}

export function gsapLike(vec3, from, to, secs){
  const start = performance.now();
  const dur = secs*1000;
  function tick(){
    const t = (performance.now() - start)/dur;
    const e = roundEase(t);
    vec3.lerpVectors(from, to, e);
    if(t<1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

export function roundRect(ctx, x, y, w, h, r, fill, stroke){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
  if(fill) ctx.fill();
  if(stroke) ctx.stroke();
}
