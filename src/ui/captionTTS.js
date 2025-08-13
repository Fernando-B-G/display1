// ui/captionTTS.js
let ttsEnabled = true;
let ttsUtter = null;
let cachedVoices = [];
let brVoice = null;
let voicesReady = false;

export async function initCaptionAndTTS({ captionEl, ttsButton }){
  if (captionEl) captionEl.classList.add('hidden');
  await awaitVoices();           // << garante que voices vêm antes de falar
  selectBRVoice();               // << escolhe pt-BR se houver
  logVoicesDebug();              // << ajuda a ver no console o que existe

  ttsButton?.addEventListener('click', ()=>{
    ttsEnabled = !ttsEnabled;
    if (!ttsEnabled) stopSpeak();
    ttsButton.classList.toggle('off', !ttsEnabled);
  });
}

function refreshVoices(){
  cachedVoices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
}
function selectBRVoice(){
  if (!cachedVoices.length) return (brVoice = null);
  // 1) lang pt-BR explícito
  brVoice = cachedVoices.find(v => /pt[-_]BR/i.test(v.lang))
         // 2) qualquer pt-*
         || cachedVoices.find(v => /^pt/i.test(v.lang))
         // 3) nomes comuns
         || cachedVoices.find(v => /portugu[eê]s.*brasil/i.test(v.name));
}

function awaitVoices(timeoutMs = 1500){
  return new Promise(resolve=>{
    if (!('speechSynthesis' in window)) return resolve();
    const done = ()=>{
      refreshVoices();
      voicesReady = !!cachedVoices.length;
      resolve();
    };
    refreshVoices();
    if (cachedVoices.length) return resolve();
    const timer = setTimeout(()=>{ window.speechSynthesis.onvoiceschanged = null; done(); }, timeoutMs);
    window.speechSynthesis.onvoiceschanged = ()=>{ clearTimeout(timer); window.speechSynthesis.onvoiceschanged = null; done(); };
    // força o motor a inicializar a lista em alguns browsers
    try { window.speechSynthesis.getVoices(); } catch {}
  });
}

export function showCaption(captionEl, text){
  const safe = (typeof text === 'string') ? text
              : (text && (text.text || text.t)) ? (text.text || text.t)
              : '';
  if (!captionEl) return;
  captionEl.textContent = safe;
  captionEl.classList.toggle('hidden', !safe);
}
export function clearCaption(captionEl){
  if (!captionEl) return;
  captionEl.textContent = '';
  captionEl.classList.add('hidden');
}

export function speak(text){
  if (!ttsEnabled || !window.speechSynthesis) return;
  stopSpeak();

  const msg = (typeof text === 'string') ? text
            : (text && (text.text || text.t)) ? (text.text || text.t)
            : '';
  if (!msg) return;

  const u = new SpeechSynthesisUtterance(msg);

  // Se temos brVoice, use-a E alinhe o lang dela.
  if (brVoice){
    u.voice = brVoice;
    u.lang  = brVoice.lang || 'pt-BR';
  } else {
    // Sem voz pt disponível? Force lang pt-BR (melhora prosódia mesmo com voz padrão)
    u.lang = 'pt-BR';
  }

  u.rate = 1.0; u.pitch = 1.0; u.volume = 1.0;

  // Em alguns browsers, falar logo após setar voice falha; usar cancel ajuda
  window.speechSynthesis.cancel();
  ttsUtter = u;
  window.speechSynthesis.speak(u);
}

export function pauseSpeak(){
  if (!window.speechSynthesis) return;
  if (!window.speechSynthesis.paused) window.speechSynthesis.pause();
}
export function resumeSpeak(){
  if (!window.speechSynthesis) return;
  if (window.speechSynthesis.paused) window.speechSynthesis.resume();
}
export function stopSpeak(){
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  ttsUtter = null;
}

// Debug opcional
function logVoicesDebug(){
  if (!cachedVoices.length) {
    console.warn('[TTS] Nenhuma voz listada pelo navegador. O sistema usará o padrão.');
    return;
  }
  const list = cachedVoices.map(v => `${v.name} — ${v.lang}${v === brVoice ? '  (pt-BR escolhido)' : ''}`);
  console.log('[TTS] Vozes disponíveis:\n' + list.join('\n'));
}
