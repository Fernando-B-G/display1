export function setupUIBindings(){

}

export function renderControls(schema, onChange){
  const panel = document.getElementById('controlsHost'); // <<< antes era .panel-right
  if (!panel) return;
  panel.innerHTML = ''; // limpa só a área dos sliders

  if (!schema || !schema.length){
    panel.innerHTML = '<div class="small">Sem controles para este nó.</div>';
    return;
  }

  schema.forEach(ctrl=>{
    const wrap = document.createElement('div');
    wrap.className = 'control';

    const label = document.createElement('label');
    label.textContent = ctrl.label || ctrl.id;

    let input;

    if (ctrl.type === 'range'){
      input = document.createElement('input');
      input.type = 'range';
      input.min = ctrl.min;
      input.max = ctrl.max;
      input.step = ctrl.step ?? 1;
      input.value = ctrl.value ?? ctrl.min;
      input.addEventListener('input', ()=> onChange(ctrl.id, parseFloat(input.value)));
    } else if (ctrl.type === 'toggle'){
      input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !!ctrl.value;
      input.addEventListener('change', ()=> onChange(ctrl.id, input.checked ? 1 : 0));
    } else {
      // fallback text/number
      input = document.createElement('input');
      input.type = 'text';
      input.value = ctrl.value ?? '';
      input.addEventListener('change', ()=> onChange(ctrl.id, input.value));
    }

    wrap.appendChild(label);
    wrap.appendChild(input);
    panel.appendChild(wrap);
  });
}

export function clearControls(){
  const panel = document.getElementById('controlsHost');
  if (panel) panel.innerHTML = '<div class="small">Selecione um nó.</div>';
}