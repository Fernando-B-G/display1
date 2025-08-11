// gesture.js
export async function startGesture(onUpdate){
  // tenta carregar libs
  await ensureScripts();
  // se não houver MediaPipe, ativa fallback de teclado
  if (!window.Hands || !window.Camera) {
    console.warn('MediaPipe Hands não disponível. Usando fallback (teclas O/C).');
    enableKeyboardFallback(onUpdate);
    return { stop: ()=>disableKeyboardFallback() };
  }

  const video = document.createElement('video');
  video.playsInline = true; video.muted = true; video.autoplay = true;
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  video.srcObject = stream;

  const hands = new window.Hands({ locateFile: (file)=>`https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
  hands.setOptions({ maxNumHands: 4, modelComplexity: 0, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6 });

  hands.onResults((res)=>{
    // conta quantas "mãos abertas" vs "fechadas" com heurística simples de dedos estendidos
    let open=0, closed=0;
    if (res.multiHandLandmarks) {
      res.multiHandLandmarks.forEach(lms=>{
        const extended = countExtendedFingers(lms);
        if (extended >= 4) open++; else closed++;
      });
    }
    onUpdate({ open, closed });
  });

  const camera = new window.Camera(video, {
    onFrame: async ()=> { await hands.send({ image: video }); },
    width: 640, height: 480
  });
  camera.start();

  return {
    stop: ()=>{
      stream.getTracks().forEach(t=>t.stop());
      camera.stop();
      hands.close && hands.close();
    }
  };
}

function countExtendedFingers(lms){
  // heurística simples: compara ângulos/posições dos dedos vs palma
  // polegar: 4>3>2 em x (mão direita) ou < (mão esquerda); simplificamos usando distâncias y
  const wrist = lms[0];
  let ext = 0;
  // indicadores: indices das pontas 8,12,16,20 e das bases 5,9,13,17
  [[8,5],[12,9],[16,13],[20,17]].forEach(([tip, base])=>{
    if (lms[tip].y < lms[base].y) ext++; // ponta acima da base -> dedo estendido (aprox)
  });
  return ext;
}

let kbHandler=null;
function enableKeyboardFallback(onUpdate){
  kbHandler = (e)=>{
    if (e.key==='o' || e.key==='O') onUpdate({ open: 3, closed: 0 });
    if (e.key==='c' || e.key==='C') onUpdate({ open: 0, closed: 3 });
  };
  window.addEventListener('keydown', kbHandler);
}
function disableKeyboardFallback(){
  if (kbHandler) window.removeEventListener('keydown', kbHandler);
  kbHandler=null;
}

async function ensureScripts(){
  // carrega mediapipe hands e camera utils se ainda não estiverem presentes
  async function load(src){ return new Promise(r=>{ const s=document.createElement('script'); s.src=src; s.onload=r; document.head.appendChild(s); }); }
  if (!window.Hands) await load('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.min.js');
  if (!window.Camera) await load('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
}
