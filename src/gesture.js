// gesture.js
let handsInstance = null;
let cameraInstance = null;
let streamRef = null;
let videoEl = null;
let preloadDone = false;
let kbHandler = null;

export async function preloadGesture() {
  if (preloadDone) return;
  await ensureScripts();

  // cria video oculto e pede permissão já
  videoEl = document.createElement('video');
  videoEl.playsInline = true; videoEl.muted = true; videoEl.autoplay = true;
  videoEl.style.position = 'fixed';
  videoEl.style.left = '-9999px';
  document.body.appendChild(videoEl);

  try {
    streamRef = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    videoEl.srcObject = streamRef;

    // cria Hands e “aquece”
    handsInstance = new window.Hands({
      locateFile: (file)=>`https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });
    handsInstance.setOptions({
      maxNumHands: 4,
      modelComplexity: 0,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6
    });

    // roda a pipeline com alguns frames para “warm up”
    const warmup = new window.Camera(videoEl, {
      onFrame: async () => { await handsInstance.send({ image: videoEl }); },
      width: 640, height: 480
    });
    await warmup.start();
    
    // roda ~10 frames
    await new Promise(r => setTimeout(r, 400));
    await warmup.stop();

    preloadDone = true;
  } catch (err) {
    console.warn('Falha ao pré-carregar câmera/mediapipe, usando fallback:', err);
    // se não há câmera, pelo menos os scripts já estão no cache
    preloadDone = true;
  }
}

export async function startGesture(onUpdate){
  await ensureScripts();

  // fallback teclado se câmera indisponível
  if (!navigator.mediaDevices?.getUserMedia) {
    enableKeyboardFallback(onUpdate);
    return { stop: ()=>disableKeyboardFallback() };
  }

  // se ainda não preparamos, faça agora (vai pedir permissão 1x)
  if (!preloadDone) await preloadGesture();

  // se não temos Hands (deu erro na permissão), ativa fallback
  if (!handsInstance || !videoEl) {
    console.warn('Hands/câmera indisponíveis. Fallback O/C.');
    enableKeyboardFallback(onUpdate);
    return { stop: ()=>disableKeyboardFallback() };
  }

  // instancia a câmera “definitiva” para a votação
  handsInstance.onResults((res)=>{
    let open=0, closed=0;
    if (res.multiHandLandmarks) {
      res.multiHandLandmarks.forEach(lms=>{
        const extended = countExtendedFingers(lms);
        if (extended >= 4) open++; else closed++;
      });
    }
    onUpdate({ open, closed });
  });

  cameraInstance = new window.Camera(videoEl, {
    onFrame: async ()=> { await handsInstance.send({ image: videoEl }); },
    width: 640, height: 480
  });
  await cameraInstance.start();

  return {
    stop: ()=>{
      cameraInstance && cameraInstance.stop();
      cameraInstance = null;
      // NÃO paramos o stream nem destruímos o Hands para reuso em próximas votações
    }
  };
}

function countExtendedFingers(lms){
  const wrist = lms[0];
  let ext = 0;
  [[8,5],[12,9],[16,13],[20,17]].forEach(([tip, base])=>{
    if (lms[tip].y < lms[base].y) ext++;
  });
  return ext;
}

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
  async function load(src){ return new Promise(r=>{ const s=document.createElement('script'); s.src=src; s.onload=r; s.async=true; document.head.appendChild(s); }); }
  if (!window.Hands)   await load('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.min.js');
  if (!window.Camera)  await load('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
}
