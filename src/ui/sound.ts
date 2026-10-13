import { getSettings } from '../store/settings';

let ctx: AudioContext | null = null;
const ac = () => {
  if (!getSettings().sound) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
};

function click(freq: number, dur: number, gain: number, when = 0, type: OscillatorType = 'triangle') {
  const c = ac(); if (!c) return;
  const t = c.currentTime + when;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur: number, gain: number, when = 0) {
  const c = ac(); if (!c) return;
  const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 2400; s.buffer = buf; g.gain.value = gain;
  s.connect(f).connect(g).connect(c.destination); s.start(c.currentTime + when);
}

export const sound = {
  unlock() { ac(); },
  dice() { for (let i = 0; i < 5; i++) noise(0.05, 0.35, i * 0.07); },
  checker() { click(520, 0.07, 0.25); noise(0.03, 0.15); },
  error() { click(180, 0.12, 0.18, 0, 'square'); },
  win(won: boolean) {
    const notes = won ? [523, 659, 784, 1046] : [392, 330, 262];
    notes.forEach((f, i) => click(f, 0.25, 0.2, i * 0.14, 'sine'));
  },
};
