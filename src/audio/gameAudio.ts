import type { SoundCue, GameSound } from './soundEvents';

let context: AudioContext | null = null;
let output: GainNode | null = null;
let primed = false;
const listeners = new Set<() => void>();
const sources = new Set<AudioScheduledSourceNode>();

export const subscribeToAudioState = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const isAudioReady = () => context?.state === 'running' && !document.hidden;
const notifyListeners = () => listeners.forEach(listener => listener());

function stopSounds() {
  for (const source of sources) {
    try { source.stop(); } catch { /* O som já terminou. */ }
  }
  sources.clear();
}

// Recupera um contexto já liberado por uma interação anterior.
export function resumeExistingAudio() {
  if (!context || context.state === 'closed' || document.hidden) return;
  if (context.state !== 'running') {
    void context.resume().then(notifyListeners).catch(() => {});
  }
}

// Chamado somente em uma interação do usuário, para respeitar o autoplay.
export function unlockAudio() {
  try {
    if (!context || context.state === 'closed') {
      const AudioContextClass = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      context = new AudioContextClass();
      primed = false;
      context.onstatechange = notifyListeners;
      output = context.createGain();
      output.gain.value = 0.35;
      output.connect(context.destination);
    }
    // Inicia uma amostra silenciosa dentro do gesto: abre a saída em navegadores móveis.
    if (!primed && output) {
      const source = context.createBufferSource();
      source.buffer = context.createBuffer(1, 1, context.sampleRate);
      source.connect(output);
      sources.add(source);
      source.onended = () => { sources.delete(source); source.disconnect(); };
      source.start();
      primed = true;
    }
    if (context.state !== 'running' && context.state !== 'closed') {
      void context.resume().then(notifyListeners).catch(() => {});
    } else {
      notifyListeners();
    }
  } catch { /* Falhas de áudio não interrompem o jogo. */ }
}

export function installAudioUnlock() {
  const unlock = () => unlockAudio();
  const onVisibilityChange = () => {
    if (document.hidden) stopSounds();
    else resumeExistingAudio();
    notifyListeners();
  };
  const gestures = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const;
  gestures.forEach(event => window.addEventListener(event, unlock, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('focus', resumeExistingAudio);
  return () => {
    gestures.forEach(event => window.removeEventListener(event, unlock, true));
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('focus', resumeExistingAudio);
    stopSounds();
  };
}

function track(source: AudioScheduledSourceNode, gain: GainNode) {
  sources.add(source);
  source.onended = () => { sources.delete(source); source.disconnect(); gain.disconnect(); };
}

function tone(audio: AudioContext, destination: GainNode, frequency: number, start: number, duration: number) {
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.25, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(destination);
  track(oscillator, gain);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.01);
}

function cardSound(audio: AudioContext, destination: GainNode, start: number, flip: boolean) {
  const duration = flip ? 0.12 : 0.075;
  const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * duration), audio.sampleRate);
  const samples = buffer.getChannelData(0);
  // Ruído curto e suavizado, semelhante ao deslizar e virar de uma carta.
  let previous = 0;
  for (let index = 0; index < samples.length; index++) {
    previous = previous * 0.7 + (Math.random() * 2 - 1) * 0.3;
    samples[index] = previous;
  }
  const source = audio.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = flip ? 1 : 1.3;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(flip ? 0.7 : 0.5, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(gain);
  gain.connect(destination);
  track(source, gain);
  source.start(start);
  source.stop(start + duration + 0.01);
}

function play(sound: GameSound, start: number, audio: AudioContext, destination: GainNode) {
  if (sound === 'newHand') {
    [392, 523.25, 659.25].forEach((frequency, index) => tone(audio, destination, frequency, start + index * 0.09, 0.18));
  } else if (sound === 'yourTurn') {
    tone(audio, destination, 783.99, start, 0.2);
    tone(audio, destination, 1046.5, start + 0.22, 0.28);
  } else {
    cardSound(audio, destination, start, sound === 'flip');
  }
}

export function playSoundCues(cues: SoundCue[]) {
  if (!context || !output || context.state !== 'running' || document.hidden) return;
  try {
    const start = context.currentTime + 0.02;
    for (const cue of cues) play(cue.sound, start + cue.delay, context, output);
  } catch { /* Sem áudio, o jogo continua normalmente. */ }
}
