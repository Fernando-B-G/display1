import * as THREE from 'three';

export function buildSim_1(group) {
  // === Parâmetros ===
  const params = {
    source: 'Sol (Contínuo)', 
    speed: 1.5,
    dispersion: 1.0 
  };

  const state = {
    progress: 0, 
    wavelengths: [] 
  };

  // === Dimensões ===
  const SCREEN_X = 5.5; // Distância
  const SCREEN_H = 5.5; // Altura aumentada para evitar vazamento
  const SCREEN_W = 4.0; // Largura

  // === Cena Local (Plano XY) ===
  const root = new THREE.Group();
  group.add(root);

  // 1. Fonte de Luz (Esquerda)
  const sourceMesh = new THREE.Group();
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffee, emissiveIntensity: 1 })
  );
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.8, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x444444 })
  );
  box.position.x = -0.4;
  sourceMesh.add(box, bulb);
  sourceMesh.position.set(-5.5, 0, 0); // Y=0 para garantir alinhamento
  root.add(sourceMesh);

  // 2. Prisma (Centro)
  const shape = new THREE.Shape();
  const size = 1.8;
  const h = size * Math.sqrt(3) / 2;
  shape.moveTo(-size/2, -h/3);
  shape.lineTo(size/2, -h/3);
  shape.lineTo(0, h*2/3);
  shape.lineTo(-size/2, -h/3);
  
  const prismGeom = new THREE.ExtrudeGeometry(shape, { depth: 0.8, bevelEnabled: false });
  prismGeom.translate(0, 0, -0.4); 
  const prismMat = new THREE.MeshPhysicalMaterial({
    color: 0xaaccff, transmission: 0.95, opacity: 0.6,
    metalness: 0.1, roughness: 0, ior: 1.5, thickness: 1.5, transparent: true
  });
  const prism = new THREE.Mesh(prismGeom, prismMat);
  prism.position.set(0, 0, 0);
  root.add(prism);

  // 3. Anteparo (Direita) - Configuração Física
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 512; 
  const ctx = canvas.getContext('2d');
  const screenTex = new THREE.CanvasTexture(canvas);
  
  // Mesh de colisão e visualização
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(SCREEN_W, SCREEN_H),
    new THREE.MeshBasicMaterial({ map: screenTex, side: THREE.DoubleSide })
  );
  
  // Posicionamento:
  // X positivo, rotacionado -60 graus no Y para ficar de frente para o prisma e para a câmera
  screen.position.set(SCREEN_X, 0, 0);
  screen.rotation.y = -Math.PI / 3; 
  screen.name = "ScreenSurface";
  
  // Suporte visual (moldura)
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(SCREEN_W + 0.2, SCREEN_H + 0.2, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x222222 })
  );
  frame.position.copy(screen.position);
  frame.rotation.copy(screen.rotation);
  frame.translateZ(-0.06); 
  
  root.add(screen, frame);

  // Grupos de Feixes
  const incomingGroup = new THREE.Group();
  const outgoingGroup = new THREE.Group();
  // Ajuste fino de Z para os feixes ficarem visíveis "dentro" ou na frente do vidro
  incomingGroup.position.z = 0.05;
  outgoingGroup.position.z = 0.05;
  root.add(incomingGroup, outgoingGroup);

  const raycaster = new THREE.Raycaster();

  // === Helpers ===

  function nmToColor(nm) {
    let r=0, g=0, b=0;
    if (nm >= 380 && nm < 440) { r = -(nm - 440) / (440 - 380); g = 0; b = 1; }
    else if (nm >= 440 && nm < 490) { r = 0; g = (nm - 440) / (490 - 440); b = 1; }
    else if (nm >= 490 && nm < 510) { r = 0; g = 1; b = -(nm - 510) / (510 - 490); }
    else if (nm >= 510 && nm < 580) { r = (nm - 510) / (580 - 510); g = 1; b = 0; }
    else if (nm >= 580 && nm < 645) { r = 1; g = -(nm - 645) / (645 - 580); b = 0; }
    else if (nm >= 645 && nm <= 780) { r = 1; g = 0; b = 0; }
    return new THREE.Color(r, g, b);
  }

  function getAngle(nm) {
    // Verde (550nm) no centro (0 graus)
    const centerNm = 550; 
    const delta = (centerNm - nm); 
    // Calibração de abertura do leque
    const scale = (0.4 / 200) * params.dispersion; 
    return delta * scale; 
  }

  // === Construção da Luz ===

  function updateWavelengths() {
    state.wavelengths = [];
    if (params.source.includes('Sol')) {
      for (let nm = 380; nm <= 780; nm += 8) state.wavelengths.push({ nm, color: nmToColor(nm) });
    } else if (params.source.includes('Hidrogênio')) {
      [656, 486, 434, 410].forEach(nm => state.wavelengths.push({ nm, color: nmToColor(nm) }));
    } else if (params.source.includes('Sódio')) {
      [589, 589.6].forEach(nm => state.wavelengths.push({ nm, color: nmToColor(nm) }));
    } else if (params.source.includes('Mercúrio')) {
      [436, 546, 577, 579].forEach(nm => state.wavelengths.push({ nm, color: nmToColor(nm) }));
    }
    rebuildBeams();
    state.progress = 0; 
  }

  function rebuildBeams() {
    incomingGroup.clear();
    outgoingGroup.clear();

    // 1. Feixe de Entrada (Mira Automática)
    const distToPrism = sourceMesh.position.distanceTo(prism.position);
    // Geometria plana que nasce na origem e cresce para a direita (+X)
    const inGeom = new THREE.PlaneGeometry(distToPrism, 0.25); 
    inGeom.translate(distToPrism / 2, 0, 0); 
    
    const inColor = params.source.includes('Sol') ? 0xffffff : state.wavelengths[0].color;
    const inMat = new THREE.MeshBasicMaterial({ 
      color: inColor, transparent: true, opacity: 0.5, 
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending 
    });
    const inBeam = new THREE.Mesh(inGeom, inMat);
    
    // Posiciona na fonte
    inBeam.position.copy(sourceMesh.position);
    // APONTA para o prisma (Garante a direção correta)
    inBeam.lookAt(prism.position);
    
    incomingGroup.add(inBeam);

    // Atualiza a posição real da tela no mundo para o Raycaster não errar
    screen.updateMatrixWorld(true);

    // 2. Feixes de Saída (Raycasting)
    state.wavelengths.forEach(wl => {
      const angle = getAngle(wl.nm);
      
      // Vetor direção do raio (no plano XY)
      const dir = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0).normalize();
      const origin = new THREE.Vector3(0,0,0); // Prisma

      // Dispara raio para achar onde bate na tela
      raycaster.set(origin, dir);
      const intersects = raycaster.intersectObject(screen);

      let dist = 10.0;
      let hitUV = null;

      if (intersects.length > 0) {
        dist = intersects[0].distance;
        // Salva onde bateu na textura (0..1)
        hitUV = intersects[0].uv.y; 
      }

      // Cria feixe visual com comprimento exato
      const outGeom = new THREE.PlaneGeometry(dist, 0.2); 
      outGeom.translate(dist / 2, 0, 0); 
      
      const outMat = new THREE.MeshBasicMaterial({
        color: wl.color, transparent: true, 
        opacity: params.source.includes('Sol') ? 0.15 : 0.8,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
      });

      const outBeam = new THREE.Mesh(outGeom, outMat);
      outBeam.position.set(0, 0, 0);
      outBeam.rotation.z = angle; // Rotaciona no plano XY

      outBeam.userData = { hitUV, color: wl.color };
      outBeam.scale.x = 0; 
      outgoingGroup.add(outBeam);
    });
  }

  function updateScreenTexture(beamsHit) {
    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!beamsHit) {
      screenTex.needsUpdate = true;
      return;
    }

    outgoingGroup.children.forEach(beam => {
      const v = beam.userData.hitUV; 
      const col = beam.userData.color;
      
      if (v != null && v >= 0 && v <= 1) {
        // Mapeia UV para pixel Y
        const y = v * canvas.height;
        
        const h = params.source.includes('Sol') ? 16 : 4; 
        const alpha = params.source.includes('Sol') ? 0.15 : 1.0;

        const grd = ctx.createLinearGradient(0, y - h, 0, y + h);
        grd.addColorStop(0, `rgba(0,0,0,0)`);
        grd.addColorStop(0.5, `rgba(${col.r*255}, ${col.g*255}, ${col.b*255}, ${alpha})`);
        grd.addColorStop(1, `rgba(0,0,0,0)`);
        
        ctx.fillStyle = grd;
        ctx.fillRect(0, y - h, canvas.width, h * 2);
      }
    });
    screenTex.needsUpdate = true;
  }

  // === Loop ===
  updateWavelengths();

  group.userData.anim = (dt) => {
    state.progress += dt * params.speed;
    if (state.progress > 2.5) state.progress = 2.5;

    if (incomingGroup.children[0]) {
      incomingGroup.children[0].scale.x = Math.min(1, Math.max(0, state.progress));
    }

    const outProgress = Math.min(1, Math.max(0, state.progress - 1));
    outgoingGroup.children.forEach(b => b.scale.x = outProgress);

    const beamsHit = state.progress > 1.95;
    if (beamsHit) updateScreenTexture(true);
    else if (state.progress < 1.1) updateScreenTexture(false);

    prism.rotation.z = Math.sin(performance.now() * 0.0005) * 0.05;
  };

  // === API ===
  group.userData.api = {
    set: (k, v) => {
      if (k === 'source') { params.source = v; updateWavelengths(); }
      if (k === 'speed') params.speed = v;
    },
    get: (k) => params[k]
  };

  group.userData.uiSchema = [
    { id: 'source', label: 'Fonte', type: 'select', options: ['Sol (Contínuo)', 'Hidrogênio', 'Sódio', 'Mercúrio'], value: 'Sol (Contínuo)' },
    { id: 'speed', label: 'Velocidade', type: 'range', min: 0.1, max: 3.0, step: 0.1, value: 1.5 }
  ];

  group.userData.dispose = () => {
    root.clear();
    group.remove(root);
    screenTex.dispose();
  };
}
