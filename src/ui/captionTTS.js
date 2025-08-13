// ui/captionTTS.js
// TTS + Legendas com sincronização real de duração (Promise resolve no onend)

// ===== estado interno =====
let ttsEnabled = true;
let ttsUtter = null;

let cachedVoices = [];
let brVoice = null;
let voicesReady = false;

// ===== API =====
export async function initCaptionAndTTS({ captionEl, ttsButton } = {}){
  // esconde legenda ao iniciar
  if (captionEl) captionEl.classList.add('hidden');

  // garante que as vozes chegam antes do primeiro speak
  await ensureVoicesReady();
  selectBRVoice();
  logVoicesDebug();

  // botão de liga/desliga TTS (opcional)
  ttsButton?.addEventListener('click', ()=>{
    setTTSEnabled(!ttsEnabled);
    ttsButton.classList.toggle('off', !ttsEnabled);
  });
}

export async function ensureVoicesReady(timeoutMs = 3000){
  if (!('speechSynthesis' in window)) {
    voicesReady = false;
    return false;
  }
  // já temos vozes?
  refreshVoices();
  if (cachedVoices.length){
    voicesReady = true;
    return true;
  }
  // aguarda evento do navegador
  await new Promise(resolve=>{
    const timer = setTimeout(()=>{
      window.speechSynthesis.onvoiceschanged = null;
      refreshVoices();
      voicesReady = cachedVoices.length > 0;
      resolve();
    }, timeoutMs);

    window.speechSynthesis.onvoiceschanged = ()=>{
      clearTimeout(timer);
      window.speechSynthesis.onvoiceschanged = null;
      refreshVoices();
      voicesReady = cachedVoices.length > 0;
      resolve();
    };

    // força inicialização em alguns browsers
    try { window.speechSynthesis.getVoices(); } catch {}
  });
  return voicesReady;
}

export function showCaption(captionEl, text){
  const safe = normalizeText(text);
  if (!captionEl) return;
  captionEl.textContent = safe;
  captionEl.classList.toggle('hidden', !safe);
}
export function clearCaption(captionEl){
  if (!captionEl) return;
  captionEl.textContent = '';
  captionEl.classList.add('hidden');
}

// ---- FALA "fire-and-forget" (compat com código antigo) ----
export function speak(text, opts){
  // Se quiser apenas tocar sem sincronizar o roteiro.
  void speakAsync(text, opts); // usa a versão que resolve no onend (desprezamos o retorno)
}

// ---- FALA ASSÍNCRONA: resolve com a duração real (ms) ----
export function speakAsync(text, { rate=1.0, pitch=1.0, volume=1.0 } = {}){
  const msg = normalizeText(text);
  if (!msg) return Promise.resolve(0);

  // TTS desligado → devolve estimativa para manter ritmo do roteiro
  if (!ttsEnabled) return sleep(estimatedMs(msg));

  // Sem Web Speech API → estimativa
  if (!('speechSynthesis' in window)) return sleep(estimatedMs(msg));

  // cancela fala anterior (evita sobreposição)
  stopSpeak();

  // garante vozes e escolhe pt-BR se possível
  // (não aguardamos aqui para não bloquear; se ainda não estiverem prontas,
  // o navegador usará a default e a duração ainda assim será real)
  selectBRVoice();

  const u = new SpeechSynthesisUtterance(msg);
  if (brVoice){
    u.voice = brVoice;
    u.lang  = brVoice.lang || 'pt-BR';
  } else {
    u.lang = 'pt-BR';
  }
  u.rate = rate; u.pitch = pitch; u.volume = volume;

  // Em alguns navegadores ajuda cancelar antes de falar
  try { window.speechSynthesis.cancel(); } catch {}

  ttsUtter = u;
  return new Promise(resolve=>{
    const t0 = performance.now();
    u.onend = ()=>{ ttsUtter = null; resolve(performance.now() - t0); };
    u.onerror = ()=>{ ttsUtter = null; resolve(estimatedMs(msg)); };
    try {
      window.speechSynthesis.speak(u);
    } catch {
      // fallback total
      ttsUtter = null;
      resolve(estimatedMs(msg));
    }
  });
}

export function pauseSpeak(){
  if (!('speechSynthesis' in window)) return;
  if (!window.speechSynthesis.paused) window.speechSynthesis.pause();
}
export function resumeSpeak(){
  if (!('speechSynthesis' in window)) return;
  if (window.speechSynthesis.paused) window.speechSynthesis.resume();
}
export function stopSpeak(){
  if (!('speechSynthesis' in window)) return;
  try { window.speechSynthesis.cancel(); } catch {}
  ttsUtter = null;
}

export function setTTSEnabled(on){
  ttsEnabled = !!on;
  if (!ttsEnabled) stopSpeak();
}
export function getTTSEnabled(){ return ttsEnabled; }

// ===== helpers internos =====
function refreshVoices(){
  cachedVoices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
}
function selectBRVoice(){
  if (!cachedVoices.length) { brVoice = null; return; }
  // 1) pt-BR explícito
  brVoice =
    cachedVoices.find(v => /pt[-_]BR/i.test(v.lang)) ||
    // 2) qualquer pt
    cachedVoices.find(v => /^pt/i.test(v.lang)) ||
    // 3) nomes mais comuns (Chrome)
    cachedVoices.find(v => /portugu[eê]s.*brasil/i.test(v.name)) ||
    null;
}

function normalizeText(t){
  if (typeof t === 'string') return t;
  if (t && (t.text || t.t)) return t.text || t.t;
  return '';
}

// Estimativa simples (~190 wpm PT-BR ≈ 3.2 palavras/s) com limites
function estimatedMs(s){
  if (!s) return 0;
  const words = String(s).trim().split(/\s+/).filter(Boolean).length;
  const ms = Math.max(900, (words / 3.2) * 1000);
  return Math.min(ms, 20000);
}
function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

// Debug opcional
function logVoicesDebug(){
  if (!cachedVoices.length) {
    console.warn('[TTS] Nenhuma voz listada; o navegador usará a padrão.');
    return;
  }
  const list = cachedVoices.map(v => `${v.name} — ${v.lang}${v === brVoice ? '  (pt-BR escolhido)' : ''}`);
  console.log('[TTS] Vozes:\n' + list.join('\n'));
}
