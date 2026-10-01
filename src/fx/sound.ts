// Small Web Audio blips, no files. Muted state is a per-device convenience kept in localStorage.
const KEY = 'yrh_muted';

let context: AudioContext | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(KEY, value ? '1' : '0');
  } catch {
    // storage can be blocked; the mute still holds for this page view
  }
}

function audio(): AudioContext {
  context ??= new AudioContext();
  if (context.state === 'suspended') void context.resume();
  return context;
}

function tone(from: number, to: number, seconds: number, type: OscillatorType = 'sine', volume = 0.07): void {
  if (muted) return;
  try {
    const ac = audio();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), ac.currentTime + seconds);
    gain.gain.setValueAtTime(volume, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + seconds);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + seconds + 0.02);
  } catch {
    // no audio device or autoplay blocked: effects are optional
  }
}

export const sfx = {
  pop: () => tone(440, 180, 0.09, 'sine', 0.06),
  ding: () => {
    tone(660, 660, 0.16, 'sine', 0.06);
    setTimeout(() => tone(990, 990, 0.22, 'sine', 0.05), 90);
  },
  err: () => tone(170, 85, 0.28, 'sawtooth', 0.05),
  puff: () => tone(150, 70, 0.2, 'sine', 0.05),
};
