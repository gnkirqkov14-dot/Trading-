// Кратки звукови ефекти (без файлове – генерират се с Web Audio).
let ctx;
function tone(freqs, dur = 0.12, type = 'sine', vol = 0.08) {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    let t = ctx.currentTime;
    for (const f of freqs) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = f;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + dur);
      t += dur * 0.8;
    }
  } catch {}
}

export const sfx = {
  ok: () => tone([660, 880], 0.1),
  bad: () => tone([220, 180], 0.14, 'triangle'),
  win: () => tone([523, 659, 784, 1046], 0.13),
  tick: () => tone([1200], 0.03, 'square', 0.03),
};
