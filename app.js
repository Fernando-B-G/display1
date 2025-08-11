  // -----------------------
  // Imports (CDN module-friendly)
  // -----------------------
  import * as THREE from 'three';
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { GUI } from 'https://unpkg.com/three@0.155.0/examples/jsm/libs/lil-gui.module.min.js';

const container = document.getElementById('container');
const textPanel = document.getElementById('narrative');
const nRange = document.getElementById('nRange');
const lRange = document.getElementById('lRange');
const mRange = document.getElementById('mRange');
const nVal = document.getElementById('nVal');
const lVal = document.getElementById('lVal');
const mVal = document.getElementById('mVal');
const playBtn = document.getElementById('playBtn');
const resetBtn = document.getElementById('resetBtn');
const gestureLabel = document.getElementById('gestureLabel');
const gestureBox = document.getElementById('gestureBox');
const progressBar = document.getElementById('progressBar');

let scene, camera, renderer, controls;
let starSystem, frameGroup, orbitalPoints;
let clock = new THREE.Clock();
let autoPlay = false;
let narrativePlaying = false;

initScene();
animate();

/* -------------------------
  Scene init
------------------------- */
function initScene(){
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030417);

  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 6, 18);

  renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 6;
  controls.maxDistance = 60;
  controls.target.set(0, 2, 0);

  // lights
  const amb = new THREE.AmbientLight(0xffffff, 0.6);
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(10, 20, 10);
  scene.add(amb, dir);

  // starfield background (points with simple parallax)
  starSystem = createStarField(1200);
  scene.add(starSystem);

  // center frame (moldura) where the orbital sim sits
  frameGroup = new THREE.Group();
  scene.add(frameGroup);
  createFrame();

  // placeholder orbital points (particles)
  orbitalPoints = createOrbitalsVisual(1,0,0); // defaults
  frameGroup.add(orbitalPoints);

  // small orbiting gizmo for visual activity
  const giz = new THREE.Mesh(new THREE.SphereGeometry(0.06,8,8), new THREE.MeshStandardMaterial({color:0xffdd66}));
  giz.position.set(3.4,0.6,0); frameGroup.add(giz);
  frameGroup.userData.gizmo = giz;

  window.addEventListener('resize', onResize);
  setUpUI();
  setUpMediapipe(); // camera & hands
}

/* -------------------------
  Starfield
------------------------- */
function createStarField(count){
  const g = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for(let i=0;i<count;i++){
    const r = 60 + Math.random()*120;
    const theta = Math.random() * Math.PI * 2;
    const phi = (Math.random() - 0.5) * Math.PI;
    positions[i*3] = Math.cos(theta) * Math.cos(phi) * r;
    positions[i*3+1] = Math.sin(phi) * r * 0.7;
    positions[i*3+2] = Math.sin(theta) * Math.cos(phi) * r;
    sizes[i] = 0.5 + Math.random()*1.4;
  }
  g.setAttribute('position', new THREE.BufferAttribute(positions,3));
  g.setAttribute('size', new THREE.BufferAttribute(sizes,1));
  const mat = new THREE.PointsMaterial({ color:0x88cfe7, size:0.2, transparent:true, opacity:0.9});
  return new THREE.Points(g, mat);
}

/* -------------------------
  Frame / moldura 3D
------------------------- */
function createFrame(){
  // rectangular rounded frame — simple approach with ring and inner plane
  const outer = new THREE.Mesh(new THREE.BoxGeometry(9.6, 6.0, 0.6), new THREE.MeshStandardMaterial({color:0x0d4f66, metalness:0.3, roughness:0.3}));
  outer.position.set(0,2,0);
  frameGroup.add(outer);

  // inner inset plane (slightly behind glass) - this will hold the orbital particles
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(8.6,5.0), new THREE.MeshBasicMaterial({ color:0x001825 }));
  inner.position.set(0,2,0.18);
  frameGroup.add(inner);

  // decorative rim
  const rim = new THREE.Mesh(new THREE.BoxGeometry(9.8, 6.2, 0.12), new THREE.MeshStandardMaterial({color:0x0f2933, metalness:0.7, roughness:0.25}));
  rim.position.set(0,2,0.36);
  frameGroup.add(rim);
}

/* -------------------------
  Orbitals visual — prototype
  This generates points whose density roughly mimics radial shells and angular nodes.
  For a production display replace with precomputed volumetric data or GPU shader Spherical Harmonics.
------------------------- */
function createOrbitalsVisual(n,l,m){
  const pointsGeo = new THREE.BufferGeometry();
  const NUM = 2500; // point count
  const pos = new Float32Array(NUM * 3);
  const col = new Float32Array(NUM * 3);
  const sizes = new Float32Array(NUM);
  for(let i=0;i<NUM;i++){
    // sample spherical coords
    // radius centered around shell = n * base
    const baseR = 1.2 + (n-1) * 1.6;
    const r = baseR + (Math.random() - 0.5) * 0.8; // some spread
    const theta = Math.acos(2*Math.random()-1); // 0..pi
    const phi = Math.random() * Math.PI * 2;

    // angular modulation (proto spherical harmonic-like)
    // use cos(l*theta) * cos(m*phi) absolute to modulate density
    const ang = Math.abs(Math.cos(l * theta) * Math.cos((m||0) * phi));
    const acceptance = Math.pow(ang, 1 + Math.abs(m)); // accentuate with m
    if (Math.random() > acceptance + 0.08) {
      // push further to sample more uniformly; still include
      // we'll allow randomness but bias positions by acceptance
    }

    // coordinates (inside the frame)
    const x = Math.sin(theta) * Math.cos(phi) * r;
    const y = Math.cos(theta) * r;
    const z = Math.sin(theta) * Math.sin(phi) * r * 0.6;
    pos[i*3] = x;
    pos[i*3+1] = y + 1.8; // lift to frame center
    pos[i*3+2] = z;

    // color gradient by radius
    const t = (r - baseR + 1.2) / 3.0;
    const c = new THREE.Color().setHSL(0.55 - 0.2 * t, 0.8, 0.5 + 0.15*t);
    col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
    sizes[i] = 2.0 + Math.random() * 2.5;
  }
  pointsGeo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  pointsGeo.setAttribute('customColor', new THREE.BufferAttribute(col,3));
  pointsGeo.setAttribute('size', new THREE.BufferAttribute(sizes,1));

  const material = new THREE.PointsMaterial({ size:0.12, vertexColors:true });
  const pts = new THREE.Points(pointsGeo, material);
  pts.scale.set(1.6,1.6,1.6);
  pts.position.set(0,0.1,0.28); // slightly in front of inner plane
  return pts;
}

/* Update orbital visual by removing old points and creating new */
function updateOrbitals(n,l,m){
  if(!orbitalPoints) return;
  frameGroup.remove(orbitalPoints);
  orbitalPoints.geometry?.dispose?.();
  orbitalPoints.material?.dispose?.();
  orbitalPoints = createOrbitalsVisual(n,l,m);
  frameGroup.add(orbitalPoints);
}

/* -------------------------
  UI handlers
------------------------- */
function setUpUI(){
  nRange.addEventListener('input', ()=> {
    nVal.textContent = nRange.value;
    // ensure l's range remains valid
    const maxL = Math.max(0, Number(nRange.value) - 1);
    lRange.max = maxL;
    if(Number(lRange.value) > maxL) lRange.value = maxL;
    lVal.textContent = lRange.value;
    // update m bounds
    const maxM = Number(lRange.value);
    mRange.min = -maxM;
    mRange.max = maxM;
    if(Number(mRange.value) < -maxM) mRange.value = -maxM;
    if(Number(mRange.value) > maxM) mRange.value = maxM;
    mVal.textContent = mRange.value;
    updateOrbitals(Number(nRange.value), Number(lRange.value), Number(mRange.value));
  });
  lRange.addEventListener('input', ()=> {
    lVal.textContent = lRange.value;
    const maxM = Math.abs(Number(lRange.value));
    mRange.min = -maxM;
    mRange.max = maxM;
    if(Number(mRange.value) < -maxM) mRange.value = -maxM;
    if(Number(mRange.value) > maxM) mRange.value = maxM;
    mVal.textContent = mRange.value;
    updateOrbitals(Number(nRange.value), Number(lRange.value), Number(mRange.value));
  });
  mRange.addEventListener('input', ()=> {
    mVal.textContent = mRange.value;
    updateOrbitals(Number(nRange.value), Number(lRange.value), Number(mRange.value));
  });

  playBtn.addEventListener('click', ()=>{
    if(narrativePlaying) return;
    playRoteiro();
  });

  resetBtn.addEventListener('click', ()=>{
    nRange.value = 1; lRange.value = 0; mRange.value = 0;
    nVal.textContent = 1; lVal.textContent = 0; mVal.textContent = 0;
    updateOrbitals(1,0,0);
    progressBar.textContent = 'Estado: reiniciado';
  });
}

/* -------------------------
  Roteiro (simples)
  - camera move + highlighted narration + then leave simulation interactive
------------------------- */
function playRoteiro(){
  narrativePlaying = true;
  progressBar.textContent = 'Roteiro: introdução (0:00–0:40)';
  // zoom/cinema move
  const startPos = camera.position.clone();
  const targetPos = new THREE.Vector3(0,3.0,9.0);
  const startTarget = controls.target.clone();
  const targetTarget = new THREE.Vector3(0,2.0,0);

  // simple tween with requestAnimationFrame
  const tStart = performance.now();
  const duration = 1200;
  function step(){
    const t = (performance.now() - tStart) / duration;
    const ease = t<0?0:(t>1?1:(0.5 - 0.5*Math.cos(Math.PI*t)));
    camera.position.lerpVectors(startPos, targetPos, ease);
    controls.target.lerpVectors(startTarget, targetTarget, ease);
    if(t < 1) requestAnimationFrame(step);
    else {
      // start narration sequence (text fades simulate)
      progressBar.textContent = 'Roteiro: descrição (0:40–2:20)';
      // simulate steps with timeouts; in real display sync audio here
      setTimeout(()=> {
        progressBar.textContent = 'Roteiro: demonstração (2:20–3:00)';
        setTimeout(()=> {
          progressBar.textContent = 'Roteiro: interação disponível';
          narrativePlaying = false;
        }, 8000); // demo portion
      }, 16000); // description portion
    }
  }
  step();
}

/* -------------------------
  MediaPipe Hands setup
  We use the CDN non-module scripts below (see HTML includes)
  - detect hands from webcam
  - heuristic to classify open vs closed
------------------------- */
let mpHandsCamera = null;
let handsProcessor = null;

function setUpMediapipe(){
  // create video element (hidden)
  const video = document.createElement('video');
  video.style.display = 'none';
  video.setAttribute('playsinline','');
  video.muted = true;
  video.autoplay = true;
  document.body.appendChild(video);

  // Load MediaPipe Hands via CDN (non-module)
  // Note: these scripts are loaded dynamically to keep this file single-module.
  loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js').then(() => {
    return loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
  }).then(()=>{
    handsProcessor = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
    handsProcessor.setOptions({
      maxNumHands: 2,
      modelComplexity: 0,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.5
    });
    handsProcessor.onResults(onHandsResults);

    // camera utils
    mpHandsCamera = new Camera(video, {
      onFrame: async () => { await handsProcessor.send({image: video}); },
      width: 640,
      height: 480
    });
    mpHandsCamera.start();
  }).catch(err=>{
    console.warn('MediaPipe scripts failed to load:', err);
    gestureBox.textContent = 'Gesto: MediaPipe não carregou';
  });
}

function loadScript(src){
  return new Promise((res,rej)=>{
    const s = document.createElement('script');
    s.src = src;
    s.onload = ()=>res();
    s.onerror = (e)=>rej(e);
    document.head.appendChild(s);
  });
}

/* Heuristic: count number of extended fingers
   We use landmarks indices from MediaPipe:
   tips: 4 (thumb), 8 (index), 12 (middle), 16 (ring), 20 (pinky)
   pip: 3, 6, 10, 14, 18
*/
function classifyHand(landmarks){
  if(!landmarks || landmarks.length < 21) return 'none';
  // we compare tip y to pip y for fingers (y smaller means higher on image coordinates)
  // but image coords origin top-left -> lower y is up, we'll compare distances
  const tips = [4,8,12,16,20];
  const pips = [3,6,10,14,18];
  let extended = 0;
  for(let i=0;i<5;i++){
    const tip = landmarks[tips[i]];
    const pip = landmarks[pips[i]];
    // project via z if needed; here we use distance in 2D
    const dy = pip.y - tip.y;
    if(dy > 0.02) { // tip is above pip => finger likely extended
      extended++;
    }
  }
  // decide
  if(extended >= 4) return 'open';
  if(extended <= 1) return 'closed';
  return 'partial';
}

let lastGesture = 'Nenhum';
function onHandsResults(results){
  // results.multiHandLandmarks is array of landmark sets
  if(!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    gestureLabel.textContent = 'Nenhum';
    gestureBox.textContent = 'Gesto: —';
    lastGesture = 'Nenhum';
    return;
  }
  // analyze first detected hand
  const lm = results.multiHandLandmarks[0];
  const cls = classifyHand(lm);
  let show = '—';
  if(cls === 'open') { show = 'Aberta'; gestureLabel.textContent = 'Aberta'; }
  else if(cls === 'closed') { show = 'Fechada'; gestureLabel.textContent = 'Fechada'; }
  else { show = 'Parcial'; gestureLabel.textContent = 'Parcial'; }

  gestureBox.textContent = `Gesto: ${show}`;

  // example mapping: if open → rotate frame slowly towards cursor of index finger
  if(cls === 'open'){
    // find index tip position normalized (x,y)
    const tip = lm[8];
    // map to a small rotation target
    const rx = (0.5 - tip.x) * 0.6;
    const ry = (tip.y - 0.5) * 0.4;
    // apply gentle transform to frameGroup
    frameGroup.rotation.y += rx * 0.02;
    frameGroup.rotation.x += ry * 0.02;
  } else if(cls === 'closed'){
    // closed could trigger "vote" or pause; for demo we scale gizmo
    const gz = frameGroup.userData.gizmo;
    if(gz) gz.scale.set(0.6,0.6,0.6);
    setTimeout(()=> gz && gz.scale.set(1,1,1), 350);
  }

  lastGesture = show;
}

/* -------------------------
  Render loop
------------------------- */
function animate(){
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  // animate starfield very slowly
  starSystem.rotation.y += dt * 0.003;
  // subtle bob for frame
  frameGroup.rotation.y += dt * 0.02;
  frameGroup.rotation.x = Math.sin(performance.now() / 6000) * 0.02;

  // update orbital points a little (pulsing)
  if(orbitalPoints){
    orbitalPoints.rotation.y += dt * 0.04;
    orbitalPoints.material.size = 0.12 + 0.03 * Math.sin(performance.now() / 400);
  }

  controls.update();
  renderer.render(scene, camera);
}

/* -------------------------
  Helpers & resize
------------------------- */
function onResize(){
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

/* -------------------------
  Notes for next steps / integration:
  - Replace createOrbitalsVisual with GPU shader or precomputed volumetric slices for accurate orbitals.
  - Hook gesture detection to voting logic: detect multiple hands and their screen X positions, tally open/closed votes and run a timer.
  - Add QR endpoint: create a tiny WebSocket server on local machine to accept remote controllers (or use WebRTC).
  - Add audio narration: integrate Howler.js and sync with playRoteiro() sequence.
------------------------- */