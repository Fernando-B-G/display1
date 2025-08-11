export function setupUIBindings(){
  const intensity = document.getElementById('intensity');
  const speed     = document.getElementById('speed');

  intensity.addEventListener('input', ()=>{
    // TODO: ligar na simulação real
    // console.log('intensity', intensity.value);
  });
  speed.addEventListener('input', ()=>{
    // TODO: ligar na simulação real
    // console.log('speed', speed.value);
  });
}
