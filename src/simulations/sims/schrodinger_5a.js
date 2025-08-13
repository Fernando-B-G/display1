// src/simulations/sims/schrodinger_5a.js
import * as THREE from 'three';

/**
 * Nó 5a — Equação de Schrödinger (visual de orbital 2p_z em nuvem de pontos)
 * Parâmetros esperados pelo roteiro/UI:
 *  - rotSpeed  : [0..1]  velocidade de rotação (rad/s aprox.)
 *  - pointSize : [0.02..0.20] tamanho dos pontos
 *  - lobeBias  : [0.8..2.0] ênfase dos lóbulos (peso para cosθ>0)
 *
 * O builder segue o contrato usado no seu core:
 *   - define group.userData.api = { set, get, reset? }
 *   - define group.userData.uiSchema (opcional; você já tem fallback no registry, mas deixo aqui tb)
 *   - define group.userData.anim(dt) para o updateCenterSim chamar
 */
export function buildSim_5a(group){
  // ---------- parâmetros (espelham o schema do registry) ----------
  const params = {
    rotSpeed: 0.35,
    pointSize: 0.08,
    lobeBias: 1.20
  };

  // ---------- UI schema local (seu registry já tem; manter por redundância útil) ----------
  group.userData.uiSchema = [
    { id:'rotSpeed',  label:'Velocidade de rotação', type:'range', min:0,    max:1.0, step:0.01, value:params.rotSpeed },
    { id:'pointSize', label:'Tamanho dos pontos',     type:'range', min:0.02, max:0.20, step:0.01, value:params.pointSize },
    { id:'lobeBias',  label:'Ênfase dos lóbulos',     type:'range', min:0.8,  max:2.0,  step:0.05, value:params.lobeBias }
  ];

  // ---------- grupo raiz desta sim ----------
  const root = new THREE.Group();
  root.position.set(0, 0.35, 0); // leve deslocamento pra caber bem na sua câmera padrão
  group.add(root);

  // ---------- geometrias ----------
  // Nuvem: amostramos |ψ|^2 ~ r^2 e^{-r/a0} * cos^2(θ) (2p_z simplificado)
  const COUNT = 18000;
  const pos   = new Float32Array(COUNT * 3);
  const col   = new Float32Array(COUNT * 3);
  const bias  = new Float32Array(COUNT); // +1 para lobo +z, -1 para lobo -z (pro "lobeBias")
  const size  = new Float32Array(COUNT); // tamanho base por ponto

  // distribuição radial simplificada (amostragem por inversa grosseira)
  // r ~ Gamma-like; aqui usamos amostra de r com peso ~ r^2 * exp(-r/a)
  const a0 = 1.0; // escala arbitrária
  function sampleR(){
    // amostra de distribuição ~ r^2 e^{-r/a0}
    // Use soma de expoenciais para aproximar: r = -a0 * ln(u1*u2*u3)
    const u1 = Math.random(), u2 = Math.random(), u3 = Math.random();
    return -a0 * Math.log(u1 * u2 * u3);
  }

  // amostra angular para cos^2(θ) (aceitação-rejeição simples)
  function sampleTheta(){
    // densidade ~ cos^2 θ em [0,π]
    while(true){
      const u = Math.random();           // propõe cosθ ~ U(-1,1)
      const c = -1 + 2*u;
      const w = c*c;                     // peso ~ cos^2
      if (Math.random() < w) {
        return Math.acos(c);             // θ
      }
    }
  }

  for (let i=0; i<COUNT; i++){
    const r = sampleR();                 // ~ [0, ~algo]
    const th = sampleTheta();            // [0,π], com peso cos^2
    const ph = Math.random() * Math.PI * 2;

    const sinT = Math.sin(th), cosT = Math.cos(th);
    const x = r * sinT * Math.cos(ph);
    const y = r * sinT * Math.sin(ph);
    const z = r * cosT;

    // compacta o conjunto pra caber melhor no quadro
    const scale = 0.6;
    pos[3*i+0] = x * scale;
    pos[3*i+1] = y * scale;
    pos[3*i+2] = z * scale;

    // cor por sinal de cosθ (vermelho para +z, azul para -z)
    const isPos = (cosT >= 0);
    col[3*i+0] = isPos ? 1.0 : 0.2;
    col[3*i+1] = 0.25;
    col[3*i+2] = isPos ? 0.25 : 1.0;

    bias[i] = isPos ? 1.0 : -1.0;

    // levemente variável pra dar textura
    size[i] = 1.0 + 0.75*Math.random();
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geom.setAttribute('color',    new THREE.BufferAttribute(col, 3));
  geom.setAttribute('aBias',    new THREE.BufferAttribute(bias, 1));
  geom.setAttribute('aSize',    new THREE.BufferAttribute(size, 1));

  // ---------- material ----------
  // Usamos PointsMaterial + onBeforeCompile para aplicar "lobeBias" e "pointSize" como uniforms.
  const mat = new THREE.PointsMaterial({
    size: params.pointSize * 12.0,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false
  });

  // uniforms extras
  const uniforms = {
    uBiasGain:   { value: params.lobeBias },
    uBaseSize:   { value: params.pointSize * 12.0 }
  };

  mat.onBeforeCompile = (shader)=>{
    // injeta uniforms
    shader.uniforms.uBiasGain = uniforms.uBiasGain;
    shader.uniforms.uBaseSize = uniforms.uBaseSize;

    // adiciona atributo de tamanho e bias
    shader.vertexShader = `
      attribute float aBias;
      attribute float aSize;
      uniform float uBiasGain;
      uniform float uBaseSize;
    ` + shader.vertexShader;

    // ajusta gl_PointSize e alpha conforme bias
    shader.vertexShader = shader.vertexShader.replace(
      'gl_PointSize = size;',
      `
        float g = max(0.1, (aBias > 0.0 ? uBiasGain : (2.0 - uBiasGain))); // lobo +Z ganha, -Z perde
        gl_PointSize = uBaseSize * aSize * g;
      `
    );

    shader.fragmentShader = `
      uniform float uBiasGain;
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <clipping_planes_fragment>',
      `
        #include <clipping_planes_fragment>
        // reforça transparência do lobo "fraco" para realçar assimetria
        float g = (uBiasGain);
        // nada pesado: só mantém shader simples
      `
    );

    mat.userData.shader = shader;
  };

  const points = new THREE.Points(geom, mat);
  root.add(points);

  // ---------- eixo/indicadores simples ----------
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.8, 0.01, 8, 64),
    new THREE.MeshBasicMaterial({ color:0x335577, transparent:true, opacity:0.5 })
  );
  ring.rotation.x = Math.PI/2;
  root.add(ring);

  // ---------- API (set/get) ----------
  group.userData.api = {
    set: (k, v)=>{
      if (k === 'rotSpeed'){
        params.rotSpeed = Number(v)||0;
      } else if (k === 'pointSize'){
        params.pointSize = Number(v)||0.08;
        uniforms.uBaseSize.value = params.pointSize * 12.0;
        const s = group.userData.shader?.uniforms?.uBaseSize;
        if (s) s.value = uniforms.uBaseSize.value;
      } else if (k === 'lobeBias'){
        params.lobeBias = Number(v)||1.2;
        uniforms.uBiasGain.value = params.lobeBias;
        const b = mat.userData?.shader?.uniforms?.uBiasGain;
        if (b) b.value = params.lobeBias;
      }
    },
    get: (k)=> params[k]
  };

  // ---------- animação contínua ----------
  group.userData.anim = (dt)=>{
    root.rotation.y += params.rotSpeed * dt; // rotação leve “didática”
  };

  // ---------- limpeza ----------
  group.userData.dispose = ()=>{
    root.removeFromParent();
    geom.dispose();
    if (Array.isArray(mat)) mat.forEach(m=>m.dispose());
    else mat.dispose();
    ring.geometry.dispose(); ring.material.dispose();
  };
}
