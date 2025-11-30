import * as THREE from 'three';

export function buildSim_1(group) {
  // === Parâmetros ===
  const params = {
    source: 'Sol (Contínuo)', 
    speed: 1.5,
    prismIndex: 1.5,
    dispersion: 0.08 // Aumentei um pouco para separar mais as cores
  };

  const state = {
    progress: 0, 
    wavelengths: [] 
  };

  // === Cena Local ===
  const root = new THREE.Group();
  group.add(root);

  // 1. Fonte de Luz (Esquerda)
  const sourceMesh = new THREE.Group();
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffee, emissiveIntensity: 1 })
  );
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1.5),
    new THREE.MeshStandardMaterial({ color: 0x333333 })
  );
  box.position.x = -0.5;
  sourceMesh.add(box, bulb);
  sourceMesh.position.set(-6, 1, 0);
  root.add(sourceMesh);

  // 2. Prisma (Centro)
  const shape = new THREE.Shape();
  shape.moveTo(-1, -1);
  shape.lineTo(1, -1);
  shape.lineTo(0, 1.2);
  shape.lineTo(-1, -1);
  const prismGeom = new THREE.ExtrudeGeometry(shape, { depth: 1.5, bevelEnabled: false });
  prismGeom.translate(0, 0, -0.75); 
  const prismMat = new THREE.MeshPhysicalMaterial({
    color: 0xaaccff, transmission: 0.9, opacity: 0.8,
    metalness: 0, roughness: 0, ior: 1.5, thickness: 2.0, transparent: true
  });
  const prism = new THREE.Mesh(prismGeom, prismMat);
  prism.position.set(0, 1, 0);
  root.add(prism);

  // 3. Anteparo (Direita) - CORRIGIDO (Em pé e virado para o prisma)
  const screenW = 6;
  const screenH = 3;
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const screenTex = new THREE.CanvasTexture(canvas);
  
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(screenW, screenH),
    new THREE.MeshBasicMaterial({ map: screenTex, side: THREE.DoubleSide })
  );
  // Posição X=6. Rotação Y=-90 graus faz o plano (que nasce +Z) virar para -X (encarar o prisma)
  screen.position.set(6, 1, 0);
  screen.rotation.y = -Math.PI / 2; 
  root.add(screen);

  // Grupos de Feixes
  const incomingGroup = new THREE.Group();
  const outgoingGroup = new THREE.Group();
  root.add(incomingGroup, outgoingGroup);

  // Raycaster para física exata
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
    
    let alpha = 1;
    if (nm > 700) alpha = 0.3 + 0.7 * (780 - nm) / (780 - 700);
    if (nm < 420) alpha = 0.3 + 0.7 * (nm - 380) / (420 - 380);

    return new THREE.Color(r * alpha, g * alpha, b * alpha);
  }

  function getDeviationAngle(nm) {
    // Cauchy: n = A + B/lambda^2
    // Violeta (400) desvia MAIS que Vermelho (700)
    const lambdaSq = (nm / 1000) * (nm / 1000); 
    const n = params.prismIndex + (params.dispersion / lambdaSq);
    
    // Desvio angular arbitrário para fins estéticos (0 rad = reto)
    // Ajuste para espalhar bem na tela
    // Violeta (n alto) -> ângulo positivo
    // Vermelho (n baixo) -> ângulo negativo
    return (n - 1.6) * 1.5; 
  }

  // === Setup ===

  function updateWavelengths() {
    state.wavelengths = [];
    // Define lista de comp. de onda baseado na fonte
    if (params.source.includes('Sol')) {
      for (let nm = 380; nm <= 750; nm += 8) { // Amostragem densa
        state.wavelengths.push({ nm, color: nmToColor(nm) });
      }
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

    // 1. Feixe de Entrada
    const distToPrism = 6; 
    const inGeom = new THREE.PlaneGeometry(distToPrism, 0.4);
    inGeom.translate(distToPrism / 2, 0, 0); 
    
    const inColor = params.source.includes('Sol') ? 0xffffff : state.wavelengths[0].color;
    const inMat = new THREE.MeshBasicMaterial({ 
      color: inColor, transparent: true, opacity: 0.6, 
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending 
    });
    const inBeam = new THREE.Mesh(inGeom, inMat);
    inBeam.position.copy(sourceMesh.position);
    inBeam.lookAt(prism.position);
    incomingGroup.add(inBeam);

    // 2. Feixes de Saída (Calculados via Raycast)
    state.wavelengths.forEach(wl => {
      // Origem: Prisma
      const origin = prism.position.clone();
      
      // Direção: Baseada no desvio
      const angleY = getDeviationAngle(wl.nm);
      const dir = new THREE.Vector3(Math.cos(angleY), 0, Math.sin(angleY)).normalize();

      // Raycast contra o anteparo para achar ponto exato de impacto
      raycaster.set(origin, dir);
      const intersects = raycaster.intersectObject(screen);

      let dist = 10; // Fallback se não bater
      let hitUV = null;

      if (intersects.length > 0) {
        dist = intersects[0].distance;
        hitUV = intersects[0].uv; // Coordenada (0..1) na textura onde bateu
      }

      // Cria geometria com o tamanho exato da distância
      const outGeom = new THREE.PlaneGeometry(dist, 0.4);
      outGeom.translate(dist / 2, 0, 0);
      
      const outMat = new THREE.MeshBasicMaterial({
        color: wl.color, transparent: true, 
        opacity: params.source.includes('Sol') ? 0.1 : 0.8,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
      });

      const outBeam = new THREE.Mesh(outGeom, outMat);
      outBeam.position.copy(origin);
      
      // Orienta o feixe para a direção calculada
      // lookAt espera um ponto alvo. Alvo = origin + dir
      const target = origin.clone().add(dir);
      outBeam.lookAt(target);

      // Salva metadados no mesh para animação e pintura
      outBeam.userData = { 
        nm: wl.nm, 
        color: wl.color, 
        hitUV: hitUV // Guarda onde bateu na tela (0..1)
      };
      
      outBeam.scale.x = 0; // Começa encolhido
      outgoingGroup.add(outBeam);
    });
  }

  function updateScreenTexture(beamsHit) {
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!beamsHit) {
      screenTex.needsUpdate = true;
      return;
    }

    // Pinta baseado onde os raios realmente bateram (hitUV)
    outgoingGroup.children.forEach(beam => {
      const uv = beam.userData.hitUV;
      const col = beam.userData.color;
      
      if (uv) {
        const x = uv.x * canvas.width;
        
        // Largura e opacidade da linha
        const w = params.source.includes('Sol') ? 12 : 6; // Sol = mais borrado
        const alpha = params.source.includes('Sol') ? 0.3 : 1.0;

        const grd = ctx.createLinearGradient(x - w, 0, x + w, 0);
        grd.addColorStop(0, `rgba(0,0,0,0)`);
        grd.addColorStop(0.5, `rgba(${col.r*255}, ${col.g*255}, ${col.b*255}, ${alpha})`);
        grd.addColorStop(1, `rgba(0,0,0,0)`);
        
        ctx.fillStyle = grd;
        ctx.fillRect(x - w, 0, w * 2, canvas.height);
      }
    });

    // Labels
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left'; ctx.fillText('UV', 10, 20);
    ctx.textAlign = 'right'; ctx.fillText('IR', canvas.width-10, 20);

    screenTex.needsUpdate = true;
  }

  // === Inicializa ===
  updateWavelengths();

  // === Animação ===
  group.userData.anim = (dt) => {
    state.progress += dt * params.speed;
    if (state.progress > 2.5) state.progress = 2.5;

    // 1. Feixe de Entrada cresce
    if (incomingGroup.children[0]) {
      incomingGroup.children[0].scale.x = Math.min(1, Math.max(0, state.progress));
    }

    // 2. Feixes de Saída crescem
    const outProgress = Math.min(1, Math.max(0, state.progress - 1));
    outgoingGroup.children.forEach(b => b.scale.x = outProgress);

    // 3. Pinta a tela só quando a luz chega lá (progress > 1.9)
    const beamsHit = state.progress > 1.9;
    
    // Otimização: só repinta se mudou o estado de "bater na tela" ou se for Sol (efeito visual)
    // Para simplificar, pintamos sempre que beamsHit for true para manter o brilho
    if (beamsHit) updateScreenTexture(true);
    else if (state.progress < 1.1) updateScreenTexture(false); // Limpa se reiniciar

    // Giro leve do prisma
    prism.rotation.y = Math.sin(performance.now() * 0.0005) * 0.1;
  };

  // === API ===
  group.userData.api = {
    set: (k, v) => {
      if (k === 'source') {
        params.source = v;
        updateWavelengths();
      }
      if (k === 'speed') params.speed = v;
    },
    get: (k) => params[k]
  };

  group.userData.uiSchema = [
    { id: 'source', label: 'Fonte de Luz', type: 'select', options: ['Sol (Contínuo)', 'Hidrogênio', 'Sódio', 'Mercúrio'], value: 'Sol (Contínuo)' },
    { id: 'speeds', label: 'Velocidade', type: 'range', min: 0.1, max: 3.0, step: 0.1, value: 1.5 }
  ];

  group.userData.dispose = () => {
    root.clear();
    group.remove(root);
    screenTex.dispose();
  };
}
