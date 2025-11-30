// src/ui.js

// Cache para guardar referência dos inputs ativos
let controlsCache = {};

export function setupUIBindings(){
  // Bindings globais se necessário
}

export function updateControlDisplay(id, value) {
  const ctrl = controlsCache[id];
  if (!ctrl) return; // Controle não existe na tela atual

  // Atualiza o estado do input
  if (ctrl.type === 'range' || ctrl.type === 'text' || ctrl.type === 'select') {
    if (ctrl.element.value !== String(value)) {
      ctrl.element.value = value;
    }
    // Atualiza o mostrador de número (span) se existir
    if (ctrl.valueDisplay) {
      ctrl.valueDisplay.textContent = value;
    }
  } else if (ctrl.type === 'checkbox' || ctrl.type === 'toggle') {
    ctrl.element.checked = !!value;
  }
}

export function renderControls(schema, onChange){
  const panel = document.getElementById('controlsHost');
  if (!panel) return;
  panel.innerHTML = ''; 
  controlsCache = {}; // Limpa cache anterior

  if (!schema || !schema.length){
    panel.innerHTML = '<div class="small">Sem controles para este nó.</div>';
    return;
  }

  schema.forEach(def => {
    const wrap = document.createElement('div');
    wrap.className = 'control';

    let valueDisplay = null;

    // Rótulo
    if (def.type !== 'button') {
      const labelRow = document.createElement('div');
      labelRow.style.display = 'flex';
      labelRow.style.justifyContent = 'space-between';
      labelRow.style.marginBottom = '4px';

      const label = document.createElement('label');
      label.textContent = def.label || def.id;
      label.style.margin = '0';
      label.style.color = '#bfeaff'; 
      
      labelRow.appendChild(label);

      if (def.type === 'range') {
        valueDisplay = document.createElement('span');
        valueDisplay.style.fontSize = '13px';
        valueDisplay.style.fontFamily = 'monospace';
        valueDisplay.style.color = '#66ccff';
        valueDisplay.textContent = def.value ?? def.min;
        labelRow.appendChild(valueDisplay);
      }
      wrap.appendChild(labelRow);
    }

    let input;

    if (def.type === 'range'){
      input = document.createElement('input');
      input.type = 'range';
      input.min = def.min;
      input.max = def.max;
      input.step = def.step ?? 1;
      input.value = def.value ?? def.min;
      
      input.addEventListener('input', ()=> {
        const val = parseFloat(input.value);
        if (valueDisplay) valueDisplay.textContent = val;
        onChange(def.id, val);
      });
      
    } else if (def.type === 'toggle' || def.type === 'checkbox'){
      input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !!def.value;
      input.addEventListener('change', ()=> onChange(def.id, input.checked ? 1 : 0));
      
    } else if (def.type === 'select'){
      input = document.createElement('select');
      const opts = Array.isArray(def.options) ? def.options : [];
      const initial = (def.value !== undefined) ? def.value : (opts.length ? opts[0] : '');

      opts.forEach(optVal=>{
        const opt = document.createElement('option');
        opt.value = String(optVal);
        opt.textContent = String(optVal);
        if (optVal === initial) opt.selected = true;
        input.appendChild(opt);
      });
      input.addEventListener('change', ()=> onChange(def.id, input.value));

    } else if (def.type === 'button') {
      input = document.createElement('button');
      input.type = 'button';
      input.textContent = def.text || def.label || 'Clique';
      input.style.width = '100%';
      input.style.marginTop = '8px';
      input.style.padding = '8px';
      input.style.cursor = 'pointer';
      input.style.background = '#66ccff';
      input.style.color = '#002';
      input.style.fontWeight = 'bold';
      input.style.border = 'none';
      input.style.borderRadius = '6px';
      
      // Efeitos visuais
      input.addEventListener('mousedown', () => input.style.transform = 'scale(0.98)');
      input.addEventListener('mouseup', () => input.style.transform = 'scale(1.0)');
      input.addEventListener('click', (e) => {
        e.preventDefault();
        onChange(def.id, 'clicked');
      });

    } else {
      input = document.createElement('input');
      input.type = 'text';
      input.value = def.value ?? '';
      input.addEventListener('change', ()=> onChange(def.id, input.value));
    }

    wrap.appendChild(input);
    panel.appendChild(wrap);

    // Registra no cache
    controlsCache[def.id] = { 
      element: input, 
      type: def.type, 
      valueDisplay 
    };
  });
}

export function clearControls(){
  const panel = document.getElementById('controlsHost');
  if (panel) panel.innerHTML = '<div class="small">Selecione um nó.</div>';
  controlsCache = {};
}

// Fullscreen handler
const fsBtn = document.getElementById('fullscreenBtn');
if (fsBtn) {
    fsBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.error(`Erro ao entrar em fullscreen: ${err.message}`);
        });
      } else {
        document.exitFullscreen();
      }
    });
}
