// src/simulations/sims/bohr_3.js
import * as THREE from 'three';
import { updateControlDisplay } from '../../ui.js'; // <--- IMPORT

export function buildSim_3(group) {
  // === Parâmetros de Estado ===
  const params = {
    n: 2,           
    speed: 1.0,     
    wavelength: 656 
  };

  const state = {
    angle: 0,
    currentN: 2,       
    currentR: 1.5 * 2  
  };

  // === Cena Local ===
  const root = new THREE.Group();
  group.add(root);

  // 1. Núcleo
  const nucleus = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 32, 32),
    new THREE.MeshStandardMaterial({ 
      color: 0xff4444, emissive: 0x550000, roughness: 0.2, metalness: 0.5
    })
  );
  nucleus.name = 'nucleus';
  root.add(nucleus);

  // 2. Órbitas
  const orbits = [];
  const maxN = 6;
  for (let i = 1; i <= maxN; i++) {
    const r = 1.5 * i;
    const geometry = new THREE.TorusGeometry(r, 0.04, 64, 100); 
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1 });
    const ring = new THREE.Mesh(geometry, material);
    root.add(ring);
    orbits.push(ring);
  }

  // 3. Elétron
  const electron = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x00ffff })
  );
  root.add(electron);

  // 4. Fótons
  const activePhotons = [];
  const photonGeom = new THREE.SphereGeometry(0.15, 8, 8); 

  const PHOTON_SPEED = 12.0; 
  const SPAWN_DIST = 30.0; 

  function spawnPhoton(color, startPos, velocity, options = {}) {
    const mat = new THREE.MeshBasicMaterial({ 
      color: color,
      transparent: true,
      opacity: options.interacts ? 1.0 : 0.4 
    });
    const p = new THREE.Mesh(photonGeom, mat);
    
    p.position.copy(startPos);
    
    p.userData = { 
      vel: velocity, 
      life: 8.0,
      isIncoming: !!options.onHit, 
      onHit: options.onHit,
      interacts: options.interacts !== false 
    };
    
    root.add(p);
    activePhotons.push(p);
  }

  // === Helpers ===
  function wavelengthToColor(nm) {
    let r=0, g=0, b=0;
    if (nm >= 380 && nm < 440) { r = -(nm - 440) / (440 - 380); g = 0; b = 1; }
    else if (nm >= 440 && nm < 490) { r = 0; g = (nm - 440) / (490 - 440); b = 1; }
    else if (nm >= 490 && nm < 510) { r = 0; g = 1; b = -(nm - 510) / (510 - 490); }
    else if (nm >= 510 && nm < 580) { r = (nm - 510) / (580 - 510); g = 1; b = 0; }
    else if (nm >= 580 && nm < 645) { r = 1; g = -(nm - 645) / (645 - 580); b = 0; }
    else if (nm >= 645 && nm <= 780) { r = 1; g = 0; b = 0; }
    return new THREE.Color(r, g, b);
  }

  function checkTransitionMatch(currentN, nm) {
    const TOLERANCE = 20; 
    for (let target = currentN + 1; target <= maxN; target++) {
      const energyDiff = 13.6 * (1/(currentN*currentN) - 1/(target*target));
      const targetNm = 1240.0 / energyDiff;
      if (Math.abs(targetNm - nm) < TOLERANCE) return target;
    }
    return null;
  }

  // === Loop ===
  group.userData.anim = (dt) => {
    state.currentR = 1.5 * state.currentN;

    const angularSpeed = params.speed * (5 / state.currentR);
    state.angle += dt * angularSpeed;
    electron.position.x = Math.cos(state.angle) * state.currentR;
    electron.position.y = Math.sin(state.angle) * state.currentR;

    orbits.forEach((o, i) => {
      const n = i + 1;
      const isCurrent = n === state.currentN;
      o.material.opacity = isCurrent ? 0.6 : 0.1;
      o.material.color.setHex(isCurrent ? 0xffff00 : 0xffffff);
    });

    for (let i = activePhotons.length - 1; i >= 0; i--) {
      const p = activePhotons[i];
      const data = p.userData;

      p.position.addScaledVector(data.vel, dt);

      if (data.isIncoming && data.interacts) {
        const distToCenter = p.position.length();
        if (distToCenter <= state.currentR + 0.2) {
          if (data.onHit) data.onHit();
          root.remove(p);
          p.material.dispose();
          activePhotons.splice(i, 1);
          continue;
        }
      }

      data.life -= dt;
      if (data.life <= 0 || p.position.length() > 40) {
        root.remove(p);
        p.material.dispose(); 
        activePhotons.splice(i, 1);
      }
    }
  };

  // === API ===
  const api = {
    set: (k, v) => {
      if (k === 'n') {
        const nextN = Math.round(v);
        if (nextN !== state.currentN) api.triggerJump(state.currentN, nextN);
      }
      if (k === 'speed') params.speed = Number(v);
      if (k === 'wavelength') params.wavelength = Number(v);
      if (k === 'fire') api.fireManualPhoton(); 
    },
    get: (k) => (k === 'n' ? state.currentN : params[k]),

    fireManualPhoton: () => {
      const nm = params.wavelength;
      const color = wavelengthToColor(nm);
      const targetN = checkTransitionMatch(state.currentN, nm);
      const interacts = (targetN !== null);

      console.log(`Disparo: ${nm}nm. Nível: ${state.currentN}. Alvo: ${targetN}`);

      const targetR = 1.5 * state.currentN;
      const travelDist = SPAWN_DIST - targetR;
      const timeToImpact = travelDist / PHOTON_SPEED;
      const angularSpeed = params.speed * (5 / targetR);
      const futureAngle = state.angle + (angularSpeed * timeToImpact);

      const spawnDir = new THREE.Vector3(Math.cos(futureAngle), Math.sin(futureAngle), 0);
      const startPos = spawnDir.clone().multiplyScalar(SPAWN_DIST);
      const velocity = spawnDir.negate().multiplyScalar(PHOTON_SPEED);

      spawnPhoton(color, startPos, velocity, {
        interacts: interacts,
        onHit: interacts ? () => {
          state.currentN = targetN;
          params.n = targetN;
          updateControlDisplay('n', targetN); // <--- ATUALIZA UI
        } : null
      });
    },

    triggerJump: (from, to) => {
      if (typeof from === 'object' && from.from !== undefined) { 
        to = from.to; from = from.from; 
      }
      if (from === to) return;

      const low = Math.min(from, to), high = Math.max(from, to);
      const en = Math.abs(1/(low*low) - 1/(high*high));
      const hue = Math.min(0.8, en * 3.0);
      const color = new THREE.Color().setHSL(0.7 - hue*0.2, 1, 0.5);

      if (from > to) { // Emissão
        state.currentN = to; 
        params.n = to;
        updateControlDisplay('n', to); // <--- ATUALIZA UI

        const startPos = electron.position.clone();
        const dir = electron.position.clone().normalize(); 
        spawnPhoton(color, startPos, dir.multiplyScalar(8.0), { interacts: false });
      } else { // Absorção
        const targetR = 1.5 * from; 
        const travelDist = SPAWN_DIST - targetR;
        const timeToImpact = travelDist / PHOTON_SPEED;
        const angularSpeed = params.speed * (5 / targetR);
        const futureAngle = state.angle + (angularSpeed * timeToImpact);

        const spawnDir = new THREE.Vector3(Math.cos(futureAngle), Math.sin(futureAngle), 0);
        const startPos = spawnDir.clone().multiplyScalar(SPAWN_DIST);
        const velocity = spawnDir.negate().multiplyScalar(PHOTON_SPEED);

        spawnPhoton(color, startPos, velocity, {
          interacts: true,
          onHit: () => { 
            state.currentN = to; 
            params.n = to; 
            updateControlDisplay('n', to); // <--- ATUALIZA UI
          }
        });
      }
    }
  };

  group.userData.api = api;

  group.userData.uiSchema = [
    { id: 'n', label: 'Nível (n)', type: 'range', min: 1, max: 6, step: 1, value: 2 },
    { id: 'speed', label: 'Velocidade', type: 'range', min: 0, max: 3, step: 0.1, value: 1.0 },
    { id: 'wavelength', label: 'Comp. Onda (nm)', type: 'range', min: 380, max: 750, step: 1, value: 656 },
    { id: 'fire', text: 'Disparar Fóton', type: 'button' }
  ];

  group.userData.dispose = () => {
    root.clear();
    group.remove(root);
    photonGeom.dispose(); 
  };
}
