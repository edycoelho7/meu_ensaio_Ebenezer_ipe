// app/app.js
import { SONGS } from '../songs.js';
import { startAll, stopAll, togglePause, seekTo, setVozVolume, setPlaybackVolume, setMetroVolume, getDuration, getCurrentTime } from './audio-engine.js';

const songListEl   = document.getElementById('songList');
const songSearchEl = document.getElementById('songSearch');
const songTitleEl  = document.getElementById('songTitle');
const songArtistEl = document.getElementById('songArtist');
const bpmDisplayEl = document.getElementById('bpmDisplay');
const tsDisplayEl  = document.getElementById('tsDisplay');
const bpmHiddenEl  = document.getElementById('bpm');
const tsHiddenEl   = document.getElementById('timeSig');
const offsetEl     = document.getElementById('offset');

const playBtn = document.getElementById('playBtn');
const stopBtn = document.getElementById('stopBtn');

const vozVol = document.getElementById('vozVol');
const playbackVol = document.getElementById('playbackVol');
const metroVol = document.getElementById('metroVol');
const vozPct = document.getElementById('vozPct');
const playbackPct = document.getElementById('playbackPct');
const metroPct = document.getElementById('metroPct');

const progressBar = document.getElementById('progressBar');
const currentTimeDisplay = document.getElementById('currentTimeDisplay');
const durationDisplay = document.getElementById('durationDisplay');

let selectedSong = null;
let animationFrameId = null;
let isPaused = false;
let isDragging = false; 

// --- NOVO: LÓGICA DE HISTÓRICO (ÚLTIMAS TOCADAS) ---

// Puxa a memória do celular da pessoa
function getHistoryIds() {
  try {
    const hist = localStorage.getItem('ensaio_history');
    return hist ? JSON.parse(hist) : [];
  } catch(e) { return []; }
}

// Salva a música clicada na memória
function saveToHistory(id) {
  let hist = getHistoryIds();
  hist = hist.filter(hId => hId !== id); // Remove se já estiver na lista (para jogar pro topo)
  hist.unshift(id); // Adiciona no topo
  if (hist.length > 5) hist.pop(); // Mantém apenas as 5 últimas
  localStorage.setItem('ensaio_history', JSON.stringify(hist));
}

// Decide o que mostrar quando a barra de busca está vazia
function getDefaultList() {
  const histIds = getHistoryIds();
  if (histIds.length > 0) {
    // Transforma os IDs salvos nas informações reais da música
    return histIds.map(id => SONGS.find(s => s.id === id)).filter(Boolean);
  }
  // Se for a primeira vez da pessoa no app, mostra as 5 primeiras do catálogo
  return SONGS.slice(0, 5);
}
// ---------------------------------------------------

function renderList(items) {
  songListEl.innerHTML = '';
  if (!items || !items.length) {
    songListEl.innerHTML = '<li class="muted">Nada encontrado…</li>';
    return;
  }
  
  // Limita a exibição visual a 5 itens e adiciona uma tag se for do histórico
  const isSearchEmpty = songSearchEl.value.trim() === '';
  const itensParaMostrar = items.slice(0, 5);

  if (isSearchEmpty && getHistoryIds().length > 0) {
    const tituloHistorico = document.createElement('li');
    tituloHistorico.textContent = '🕒 Tocadas Recentemente';
    tituloHistorico.style.fontSize = '12px';
    tituloHistorico.style.opacity = '0.6';
    tituloHistorico.style.pointerEvents = 'none';
    tituloHistorico.style.paddingBottom = '4px';
    songListEl.appendChild(tituloHistorico);
  }

  itensParaMostrar.forEach(s => {
    const li = document.createElement('li');
    li.textContent = `${s.title} — ${s.artist || 'Desconhecido'}`;
    li.tabIndex = 0;
    li.addEventListener('click', () => applySong(s.id));
    li.addEventListener('keydown', (e) => { if (e.key === 'Enter') applySong(s.id); });
    songListEl.appendChild(li);
  });
}

function filterSongs(q) {
  if (!q) return getDefaultList();
  const n = q.trim().toLowerCase();
  return SONGS.filter(s => (s.title || '').toLowerCase().includes(n) || (s.artist || '').toLowerCase().includes(n));
}

function applySong(id) {
  const s = SONGS.find(x => x.id === id);
  if (!s) return;
  selectedSong = s;
  
  // Salva no histórico toda vez que uma música é selecionada
  saveToHistory(id);

  songTitleEl.textContent = s.title || '—';
  songArtistEl.textContent = s.artist || '—';
  bpmDisplayEl.textContent = s.bpm ?? '—';
  tsDisplayEl.textContent  = s.timeSignature ?? '—';

  const beats = parseInt(String(s.timeSignature || '4/4').split('/')[0], 10) || 4;
  bpmHiddenEl.value = s.bpm || 120;
  tsHiddenEl.value  = beats;
  offsetEl.value    = s.offset || 0.00;

  const items = Array.from(songListEl.children);
  items.forEach(li => li.classList.remove('selected'));
  const found = items.find(li => li.textContent.includes(s.title));
  if (found) found.classList.add('selected');
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function updateProgress() {
  const current = getCurrentTime();
  const duration = getDuration();

  if (duration > 0 && !isDragging) {
    currentTimeDisplay.textContent = formatTime(current);
    durationDisplay.textContent = formatTime(duration);
    const percentage = (current / duration) * 100;
    progressBar.value = percentage;
    progressBar.style.setProperty('--value', `${percentage}%`);
  }
  animationFrameId = requestAnimationFrame(updateProgress);
}

// LÓGICA DE ARRASTAR A BARRA (SEEK)
progressBar.addEventListener('input', (e) => {
  isDragging = true;
  const percentage = e.target.value;
  progressBar.style.setProperty('--value', `${percentage}%`);
  const newTime = (percentage / 100) * getDuration();
  currentTimeDisplay.textContent = formatTime(newTime);
});

progressBar.addEventListener('change', (e) => {
  isDragging = false;
  if (selectedSong && getCurrentTime() > 0) {
    seekTo(e.target.value, selectedSong);
  }
});

playBtn.addEventListener('click', async () => {
  if (!selectedSong) { 
    const defaultList = getDefaultList();
    if (defaultList.length) applySong(defaultList[0].id); 
    else return; 
  }
  
  if (currentTimeDisplay.textContent !== '0:00' && currentTimeDisplay.textContent !== '0:00') {
      const state = await togglePause();
      if (state === "paused") {
          isPaused = true;
          playBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden="true" style="margin-right:8px"><path d="M8 5v14l11-7z"></path></svg> Play`;
      } else if (state === "playing") {
          isPaused = false;
          playBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden="true" style="margin-right:8px"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg> Pause`;
      }
      return;
  }

  playBtn.disabled = true; 
  playBtn.textContent = 'Carregando...';

  try {
    await startAll(selectedSong);
    
    setVozVolume(parseFloat(vozVol.value));
    setPlaybackVolume(parseFloat(playbackVol.value));
    setMetroVolume(parseFloat(metroVol.value));

    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    updateProgress();
    
    isPaused = false;
    playBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden="true" style="margin-right:8px"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg> Pause`;
  } catch (err) {
    console.error("Erro ao carregar áudio:", err);
  } finally {
    playBtn.disabled = false;
  }
});

stopBtn.addEventListener('click', () => { 
  stopAll(); 
  isPaused = false;
  playBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden="true" style="margin-right:8px"><path d="M8 5v14l11-7z"></path></svg> Play`;
  
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  progressBar.value = 0;
  progressBar.style.setProperty('--value', '0%');
  currentTimeDisplay.textContent = '0:00';
});

function pct(v){ return Math.round(v * 100) + '%'; }

function setFill(slider) { 
  slider.style.setProperty('--value', `${slider.value * 100}%`);
  slider.style.background = 'transparent'; 
}

function syncAll(){
  vozPct.textContent = pct(parseFloat(vozVol.value));
  playbackPct.textContent = pct(parseFloat(playbackVol.value));
  metroPct.textContent = pct(parseFloat(metroVol.value));
  [vozVol, playbackVol, metroVol].forEach(setFill);
}

vozVol.addEventListener('input', (e) => { setVozVolume(+e.target.value); syncAll(); });
playbackVol.addEventListener('input', (e) => { setPlaybackVolume(+e.target.value); syncAll(); });
metroVol.addEventListener('input', (e) => { setMetroVolume(+e.target.value); syncAll(); });
syncAll();

songSearchEl.addEventListener('input', () => {
  const filtered = filterSongs(songSearchEl.value);
  renderList(filtered);
});

(function bootstrap(){
  const listaInicial = getDefaultList();
  renderList(listaInicial);
  if (listaInicial.length) applySong(listaInicial[0].id);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault(); songSearchEl.focus();
    }
  });
})();