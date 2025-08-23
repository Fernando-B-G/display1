// src/simulations/sims/prism_1.js
import * as THREE from 'three';
import { attachHighlighter } from '../highlight.js';

export function buildSim_1(group) {
  // ---------- Parâmetros (alinhado ao seu roteiro) ----------
  const params = {
    source: 'Sol (contínuo)',
    showSource: true,
    showPreBeam: true,
    showPrism: true,
    showPostRays: true,
    showScreen: true
  };

  group.userData.uiSchema = [
    { id:'source', type:'select', label:'Fonte', value:params.source, options:[
      'Sol (contínuo)', 'Lâmpada de Sódio', 'Lâmpada de Mercúrio', 'Lâmpada de Hidrogênio'
    ]},
    { id:'showSource',   type:'toggle', label:'Mostrar fonte', value:params.showSource },
    { id:'showPreBeam',  type:'toggle', label:'Mostrar feixe antes', value:params.showPreBeam },
    { id:'showPrism',    type:'toggle', label:'Mostrar prisma', value:params.showPrism },
    { id:'showPostRays', type:'toggle', label:'Mostrar raios após', value:params.showPostRays },
    { id:'showScreen',   type:'toggle', label:'Mostrar anteparo', value:params.showScreen },
  ];

  // ---------- Raiz local ----------
  const root = new THREE.Group();
  root.position.set(0, 0.65, 0);
  group.add(root);

  // ---------- Luz ambiente leve para dar volume ----------
  const amb = new THREE.AmbientLight(0xffffff, 0.35);
  const key = new THREE.DirectionalLight(0xffffff, 0.6);
  key.position.set(2, 3, 2);
  root.add(amb, key);

  // ---------- Fonte (lâmpada genérica + abertura) ----------
  const srcG = new THREE.Group();
  root.add(srcG);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 24, 16),
    new THREE.MeshPhongMaterial({ color: 0xfff4cc, emissive: 0xffe7a3, emissiveIntensity: 0.8, shininess: 60 })
  );
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 0.16, 20),
    new THREE.MeshPhongMaterial({ color: 0x888888, shininess: 20 })
  );
  cap.position.y = -0.22; bulb.add(cap);

  const nozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.06, 16),
    new THREE.MeshPhongMaterial({ color: 0x555555 })
  );
  nozzle.rotation.z = Math.PI/2;
  nozzle.position.set(0.32, 0, 0);
  srcG.add(bulb, nozzle);

  // posição e orientação da fonte
  srcG.position.set(-2.3, 0, 0);
  srcG.rotation.y = 0;

  // ---------- Feixe antes do prisma ----------
  const preBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 2.0, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2cf, transparent:true, opacity:0.35, side:THREE.DoubleSide })
  );
  preBeam.rotation.z = Math.PI/2;
  preBeam.position.set(-1.3, 0, 0);
  root.add(preBeam);

  // ---------- Prisma triangular (vidro) ----------
  const prism = new THREE.Mesh(makeTriPrismGeometry(0.6, 0.6, 0.8), new THREE.MeshPhongMaterial({
    color: 0x88ccee, transparent:true, opacity:0.25, shininess: 120
  }));
  prism.position.set(-0.2, 0, 0);
  prism.rotation.z = Math.PI; // ângulo fixo
  prism.name = 'prism';
  root.add(prism);

  // ---------- Anteparo (tela) com CanvasTexture ----------
  const scrCanvas = document.createElement('canvas');
  scrCanvas.width = 640; scrCanvas.height = 140;
  const scrCtx = scrCanvas.getContext('2d');
  const scrTex = new THREE.CanvasTexture(scrCanvas);
  scrTex.minFilter = THREE.LinearFilter;

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 0.6),
    new THREE.MeshBasicMaterial({ map: scrTex, transparent:true, opacity: 1.0 })
  );
  screen.position.set(1.8, 0, 0);
  screen.rotation.z = -Math.PI / 2;
  root.add(screen);

  // moldura simples
  const frame = new THREE.Mesh(
    new THREE.RingGeometry(1.22, 1.25, 64, 1, 0, Math.PI*2),
    new THREE.MeshBasicMaterial({ color:0x223344, transparent:true, opacity:0.2, side:THREE.DoubleSide })
  );
  frame.rotation.y = 0; // alinhado ao anteparo
  frame.visible = false; // opcional
  screen.add(frame);

  // ---------- Raios após o prisma ----------
  const postGroup = new THREE.Group();
  root.add(postGroup);

  root.scale.set(3, 3, 3);

  group.userData.objects.push(srcG, preBeam, prism, screen, frame, postGroup);

  // criamos alguns "feixes" como finos planos coloridos que vão do prisma até a tela
  /**
   * Converte uma frequência de luz em um ângulo de saída.
   * Utiliza um modelo linear simples de dispersão: 550 THz é mapeado
   * para 0 rad e cada terahertz desloca o raio em ~0.002 rad.
   * O coeficiente negativo indica que frequências menores (vermelho)
   * desviam para cima e maiores (violeta) para baixo.
   * @param {number} freq Frequência em terahertz.
   * @returns {number} Ângulo em radianos.
   */
  function freqToAngle(freq) {
    const REF_FREQ = 550;       // THz (aprox. verde)
    const DISPERSION = -0.004;  // rad/THz
    return (freq - REF_FREQ) * DISPERSION;
  }

  function createRay(color, freq) {
    const theta = freqToAngle(freq);
    const len = (screen.position.x - prism.position.x) / Math.cos(theta) * 0.85;
    const w = 0.02;
    const g = new THREE.PlaneGeometry(len, w);
    const m = new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.75, side:THREE.DoubleSide });
    const ray = new THREE.Mesh(g, m);
    ray.rotation.z = theta;
    ray.position.set(
      prism.position.x + (len/2)*Math.cos(theta),
      (len/2)*Math.sin(theta),
      0
    );
    return ray;
  }

  const rays = {
    continuous: [
      createRay(0xff0000, 400), // vermelho
      createRay(0xff7f00, 480), // laranja
      createRay(0xffff00, 510), // amarelo
      createRay(0x00ff00, 540), // verde
      createRay(0x00ffff, 600), // ciano
      createRay(0x0000ff, 650), // azul
      createRay(0x8b00ff, 700), // violeta
    ],
    sodium: [
      createRay(0xffd200, 508),
      createRay(0xffc000, 510),
    ],
    mercury: [
      createRay(0x7f00ff, 740), // violeta
      createRay(0x3f67ff, 690), // azul
      createRay(0x00ff5c, 550), // verde
      createRay(0xd0ff00, 520), // amarelo-esverdeado
    ],
    hydrogen: [
      createRay(0xff3b3b, 457), // Hα ~656 nm
      createRay(0x2ee0ff, 617), // Hβ ~486 nm
      createRay(0x2a5bff, 691), // Hγ ~434 nm
      createRay(0x7a2aff, 731), // Hδ ~410 nm
    ]
  };
  Object.values(rays).flat().forEach(r => postGroup.add(r));

  // ---------- Funções de desenho do espectro na tela ----------
  function drawContinuous(ctx, w, h) {
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    // arco-íris simples (não físico)
    grad.addColorStop(0.00, '#f00');
    grad.addColorStop(0.17, '#ff7f00');
    grad.addColorStop(0.33, '#ff0');
    grad.addColorStop(0.50, '#0f0');
    grad.addColorStop(0.67, '#0ff');
    grad.addColorStop(0.83, '#00f');
    grad.addColorStop(1.00, '#8b00ff');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  function drawLines(ctx, w, h, lines) {
    // fundo escuro
    ctx.fillStyle = '#0b0b12';
    ctx.fillRect(0, 0, w, h);
    // leve glow
    ctx.globalCompositeOperation = 'lighter';
    lines.forEach(({ xFrac, color, width=4 })=>{
      const x = Math.floor(xFrac * w);
      const grd = ctx.createLinearGradient(x-8, 0, x+8, 0);
      grd.addColorStop(0.0, 'rgba(0,0,0,0)');
      grd.addColorStop(0.45, hexToRgba(color, 0.15));
      grd.addColorStop(0.5,  hexToRgba(color, 0.8));
      grd.addColorStop(0.55, hexToRgba(color, 0.15));
      grd.addColorStop(1.0, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(x-8, 0, 16, h);

      ctx.fillStyle = hexToRgba(color, 1.0);
      ctx.fillRect(x - Math.round(width/2), 0, width, h);
    });
    ctx.globalCompositeOperation = 'source-over';
  }

  function hexToRgba(hex, a=1) {
    const r = (hex>>16)&255, g=(hex>>8)&255, b=hex&255;
    return `rgba(${r},${g},${b},${a})`;
  }

  // posições aproximadas (0..1 no eixo x do espectro)
  const LINES = {
    sodium: [
      { xFrac: 0.55, color: 0xffd200, width: 5 },
      { xFrac: 0.57, color: 0xffc000, width: 4 },
    ],
    mercury: [
      { xFrac: 0.14, color: 0x7f00ff },
      { xFrac: 0.36, color: 0x3f67ff },
      { xFrac: 0.60, color: 0x00ff5c },
      { xFrac: 0.70, color: 0xd0ff00 },
    ],
    hydrogen: [
      { xFrac: 0.18, color: 0x7a2aff }, // ~410 nm
      { xFrac: 0.29, color: 0x2a5bff }, // ~434 nm
      { xFrac: 0.48, color: 0x2ee0ff }, // ~486 nm
      { xFrac: 0.82, color: 0xff3b3b }  // ~656 nm
    ]
  };

  function updateScreenForSource() {
    const w = scrCanvas.width, h = scrCanvas.height;
    if (params.source.startsWith('Sol')) {
      drawContinuous(scrCtx, w, h);
    } else if (params.source.includes('Sódio')) {
      drawLines(scrCtx, w, h, LINES.sodium);
    } else if (params.source.includes('Mercúrio')) {
      drawLines(scrCtx, w, h, LINES.mercury);
    } else if (params.source.includes('Hidrogênio')) {
      drawLines(scrCtx, w, h, LINES.hydrogen);
    } else {
      // fallback
      drawContinuous(scrCtx, w, h);
    }
    scrTex.needsUpdate = true;
  }

  function updatePostRaysForSource() {
    // esconde tudo
    Object.values(rays).flat().forEach(r => r.visible = false);
    if (params.source.startsWith('Sol')) {
      rays.continuous.forEach(r => r.visible = true);
    } else if (params.source.includes('Sódio')) {
      rays.sodium.forEach(r => r.visible = true);
    } else if (params.source.includes('Mercúrio')) {
      rays.mercury.forEach(r => r.visible = true);
    } else if (params.source.includes('Hidrogênio')) {
      rays.hydrogen.forEach(r => r.visible = true);
    }
  }

  // inicializa espectro e raios
  updateScreenForSource();
  updatePostRaysForSource();

  // ---------- Visibilidade controlável ----------
  function applyVisibility() {
    srcG.visible     = params.showSource;
    preBeam.visible  = params.showPreBeam;
    prism.visible    = params.showPrism;
    postGroup.visible= params.showPostRays;
    screen.visible   = params.showScreen;
  }
  applyVisibility();


  // ---------- Animação sutil (pulsação do brilho) ----------
  let t = 0;
  group.userData.anim = (dt) => {
    t += dt;
    const pulse = 0.3 + 0.2 * Math.sin(t*2.0);
    (Array.isArray(prism.material) ? prism.material : [prism.material]).forEach(m=>{
      m.opacity = 0.22 + pulse*0.06;
      m.needsUpdate = true;
    });
    // leve pulso nos raios
    Object.values(rays).flat().forEach(r=>{
      r.material.opacity = 0.65 + 0.10*Math.sin(t*3.0);
    });
  };

  // ---------- API ----------
  const highlight = attachHighlighter(group, root);
  group.userData.api = {
    set: (k, v) => {
      if (k === 'source') {
        params.source = String(v);
        updateScreenForSource();
        updatePostRaysForSource();
      } else if (k in params) {
        params[k] = (typeof params[k] === 'boolean') ? !!v : v;
        applyVisibility();
      }
    },
    get: (k) => params[k],
    highlight
  };

  group.userData.dispose = () => {
    root.removeFromParent();
    // dispose básico
    preBeam.geometry.dispose(); preBeam.material.dispose();
    prism.geometry.dispose(); (Array.isArray(prism.material)?prism.material:[prism.material]).forEach(m=>m.dispose());
    screen.geometry.dispose(); screen.material.dispose();
    Object.values(rays).flat().forEach(r => { r.geometry.dispose(); r.material.dispose(); });
  };

  // ---------- Helpers ----------
  function makeTriPrismGeometry(width=1, height=0.6, depth=0.6) {
    // prisma triangular a partir de 2 triângulos e faces laterais
    const hw = width/2, hh = height/2, hd = depth/2;
    const shape = new THREE.Shape();
    shape.moveTo(-hw, -hh);
    shape.lineTo( hw, -hh);
    shape.lineTo( 0 ,  hh);
    shape.lineTo(-hw, -hh);
    const extrude = new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled:false });
    extrude.translate(0,0,-hd);
    extrude.rotateX(Math.PI); // “em pé”
    return extrude;
  }
}
