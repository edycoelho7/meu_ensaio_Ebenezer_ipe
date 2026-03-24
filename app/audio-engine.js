// app/audio-engine.js
let audioCtx;
let masterGain, vozGain, playbackGain, metroGain;
let isPlaying = false;
let schedulerTimerId = null;
let currentNoteTime = 0;
let currentBeatInBar = 0;

let songDuration = 0;
let startTime = 0;

let vozSource = null;
let playbackSource = null;

// Buffers em Cache (para não baixar de novo ao arrastar a barra)
let currentSongId = null;
let cachedVozBuf = null;
let cachedPlaybackBuf = null;
let clickAgudoBuf = null;
let clickGraveBuf = null;

const scheduleAheadTime = 0.15;
const lookahead = 25;

function initAudioGraph() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  masterGain = audioCtx.createGain();
  masterGain.gain.value = 1.0;
  masterGain.connect(audioCtx.destination);

  vozGain = audioCtx.createGain();
  playbackGain = audioCtx.createGain();
  metroGain = audioCtx.createGain();

  vozGain.connect(masterGain);
  playbackGain.connect(masterGain);
  metroGain.connect(masterGain);
}

async function loadBufferFromUrl(url) {
  const resp = await fetch(url, { mode: 'cors' });
  const buf = await resp.arrayBuffer();
  return await audioCtx.decodeAudioData(buf);
}

// Atualizado para aceitar um tempo de início (offset)
function connectAndStartBuffer(buffer, when, gainNode, offset = 0) {
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  src.connect(gainNode);
  src.start(when, offset);
  return src;
}

function secondsPerBeat(bpm) { return 60.0 / bpm; }

function scheduleClick(time, isAccent) {
  if (!clickAgudoBuf || !clickGraveBuf) return;
  const src = audioCtx.createBufferSource();
  src.buffer = isAccent ? clickAgudoBuf : clickGraveBuf;
  src.connect(metroGain);
  src.start(time);
}

function scheduler(bpm, beatsPerBar) {
  while (currentNoteTime < audioCtx.currentTime + scheduleAheadTime) {
    const isAccent = (currentBeatInBar % beatsPerBar === 0);
    scheduleClick(currentNoteTime, isAccent);
    currentNoteTime += secondsPerBeat(bpm);
    currentBeatInBar = (currentBeatInBar + 1) % beatsPerBar;
  }
}

// API Principal
export async function startAll(song) {
  if (isPlaying) return;
  initAudioGraph();

  if (audioCtx.state === 'suspended') await audioCtx.resume();

  // Só baixa os áudios se for uma música nova
  if (currentSongId !== song.id) {
    const [vozBuf, playbackBuf, agudoBuf, graveBuf] = await Promise.all([
      loadBufferFromUrl(song.files.voz),
      loadBufferFromUrl(song.files.playback),
      loadBufferFromUrl('click-agudo.mp3'),
      loadBufferFromUrl('click-grave.mp3')
    ]);
    cachedVozBuf = vozBuf;
    cachedPlaybackBuf = playbackBuf;
    clickAgudoBuf = agudoBuf;
    clickGraveBuf = graveBuf;
    currentSongId = song.id;
  }

  songDuration = cachedPlaybackBuf.duration;

  const startAt = audioCtx.currentTime + 0.25;
  startTime = startAt;

  const beatsPerBar = parseInt(String(song.timeSignature).split('/')[0], 10) || 4;
  const bpm = Number(song.bpm) || 120;
  const offset = Number(song.offset) || 0;

  vozSource = connectAndStartBuffer(cachedVozBuf, startAt, vozGain);
  playbackSource = connectAndStartBuffer(cachedPlaybackBuf, startAt, playbackGain);

  currentBeatInBar = 0;
  currentNoteTime = startAt + offset;

  schedulerTimerId = setInterval(() => scheduler(bpm, beatsPerBar), lookahead);
  isPlaying = true;
}

// NOVO: Função para pular para um momento específico (Seek)
export function seekTo(percent, song) {
  if (!isPlaying || !audioCtx) return;

  const offsetTime = (percent / 100) * songDuration;

  // 1. Para tudo que está tocando
  if (schedulerTimerId) { clearInterval(schedulerTimerId); schedulerTimerId = null; }
  try { vozSource && vozSource.stop(); } catch(e) {}
  try { playbackSource && playbackSource.stop(); } catch(e) {}

  // 2. Atualiza o relógio para o novo tempo
  startTime = audioCtx.currentTime - offsetTime;

  // 3. Dá o Play novamente a partir do novo tempo
  vozSource = connectAndStartBuffer(cachedVozBuf, audioCtx.currentTime, vozGain, offsetTime);
  playbackSource = connectAndStartBuffer(cachedPlaybackBuf, audioCtx.currentTime, playbackGain, offsetTime);

  // 4. Recalcula a matemática do Metrônomo para ele não se perder
  const beatsPerBar = parseInt(String(song.timeSignature).split('/')[0], 10) || 4;
  const bpm = Number(song.bpm) || 120;
  const secPerBeat = secondsPerBeat(bpm);
  const songOffset = Number(song.offset) || 0;
  
  const timeInMetro = offsetTime - songOffset;

  if (timeInMetro >= 0) {
    const beatsPassed = Math.floor(timeInMetro / secPerBeat);
    currentBeatInBar = (beatsPassed + 1) % beatsPerBar;
    const timeSinceLastBeat = timeInMetro % secPerBeat;
    currentNoteTime = audioCtx.currentTime + (secPerBeat - timeSinceLastBeat);
  } else {
    currentBeatInBar = 0;
    currentNoteTime = audioCtx.currentTime + Math.abs(timeInMetro);
  }

  schedulerTimerId = setInterval(() => scheduler(bpm, beatsPerBar), lookahead);
}

export async function togglePause() {
  if (!audioCtx) return "stopped";
  if (audioCtx.state === 'running') {
    await audioCtx.suspend(); 
    return "paused";
  } else if (audioCtx.state === 'suspended') {
    await audioCtx.resume(); 
    return "playing";
  }
}

export function stopAll() {
  if (!audioCtx) return;
  if (schedulerTimerId) { clearInterval(schedulerTimerId); schedulerTimerId = null; }
  try { vozSource && vozSource.stop(); } catch(e) {}
  try { playbackSource && playbackSource.stop(); } catch(e) {}
  vozSource = null; playbackSource = null;
  audioCtx.close();
  audioCtx = null;
  isPlaying = false;
  currentSongId = null; // Limpa a música atual ao dar stop
}

export function setVozVolume(v){ if (vozGain) vozGain.gain.value = v; }
export function setPlaybackVolume(v){ if (playbackGain) playbackGain.gain.value = v; }
export function setMetroVolume(v){ if (metroGain) metroGain.gain.value = v; }

export function getDuration() { return songDuration; }
export function getCurrentTime() {
  if (!isPlaying || !audioCtx) return 0;
  const now = audioCtx.currentTime - startTime;
  return Math.max(0, Math.min(now, songDuration));
}