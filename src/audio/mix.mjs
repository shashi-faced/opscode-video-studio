// Place voice clips on the timeline, duck music under speech, soft-limit, write WAV.
import { SR, writeWav16, decodeStereo } from './wav.mjs';
import { synthMusic } from './synth.mjs';

export function buildMusic(storyboard, timeline, baseDir, path) {
  const m = storyboard.music || {};
  if (m.file) {
    const [l, r] = decodeStereo(path.resolve(baseDir, m.file));
    const N = Math.ceil((timeline.duration + 0.3) * SR);
    const L = new Float32Array(N), R = new Float32Array(N);
    for (let i = 0; i < N; i++) { const j = i % l.length; L[i] = l[j]; R[i] = r[j]; }
    const fi = Math.round(0.5 * SR), fo = Math.round(2 * SR);
    for (let i = 0; i < fi; i++) { L[i] *= i / fi; R[i] *= i / fi; }
    for (let i = 0; i < fo; i++) { const g = i / fo; L[N - 1 - i] *= g; R[N - 1 - i] *= g; }
    let pk = 0; for (let i = 0; i < N; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
    if (pk) for (let i = 0; i < N; i++) { L[i] /= pk; R[i] /= pk; }
    return [L, R];
  }
  return synthMusic(timeline, { style: m.style || 'indian-electronic' });
}

/** Returns { file, hasAudio } */
export function mixToWav({ storyboard, timeline, voices, music, file }) {
  const N = Math.ceil((timeline.duration + 0.3) * SR);
  const vo = new Float32Array(N), active = new Uint8Array(N);
  let anyVoice = false;
  timeline.scenes.forEach((sc, i) => {
    const v = voices[i];
    if (!v || sc.voiceStart == null) return;
    anyVoice = true;
    const i0 = Math.round(sc.voiceStart * SR);
    for (let j = 0; j < v.samples.length && i0 + j < N; j++) { vo[i0 + j] += v.samples[j]; active[i0 + j] = 1; }
  });
  const [mL, mR] = music;
  const anyMusic = mL.some(x => x !== 0);
  if (!anyVoice && !anyMusic) return { file: null, hasAudio: false };

  // Duck envelope: 120 ms smoothing with lookahead, 400 ms release.
  const k = Math.round(0.12 * SR), duck = new Float32Array(N);
  let run = 0;
  const pre = new Float32Array(N);
  for (let i = 0; i < N; i++) { run += active[i]; if (i >= k) run -= active[i - k]; pre[i] = run / k; }
  const shifted = new Float32Array(N);
  for (let i = 0; i < N; i++) shifted[i] = pre[Math.min(N - 1, i + (k >> 1))];
  const rel = Math.exp(-1 / (0.4 * SR));
  let acc = 0;
  for (let i = 0; i < N; i++) { acc = Math.max(shifted[i], acc * rel); duck[i] = acc; }

  const vol = storyboard.music?.volume ?? 0.5;
  const L = new Float32Array(N), R = new Float32Array(N);
  const norm = Math.tanh(1.1);
  let peak = 0;
  for (let i = 0; i < N; i++) {
    const g = anyVoice ? vol * (1 - 0.66 * duck[i]) : vol;
    const l = Math.tanh(((mL[i] || 0) * g + vo[i] * 0.97) * 1.1) / norm;
    const r = Math.tanh(((mR[i] || 0) * g + vo[i] * 0.97) * 1.1) / norm;
    L[i] = l; R[i] = r; peak = Math.max(peak, Math.abs(l), Math.abs(r));
  }
  const target = Math.pow(10, -1 / 20);
  if (peak > 0) for (let i = 0; i < N; i++) { L[i] *= target / peak; R[i] *= target / peak; }
  writeWav16(file, L, R);
  return { file, hasAudio: true };
}
