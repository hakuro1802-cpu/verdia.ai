/**
 * Procedural cinematic ambience via Web Audio.
 * No stock voice asset yet — welcome tone stands in for the whisper
 * until a licensed "Welcome to MOMO." clip is provided.
 */
export function createOpeningSoundscape() {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return { start: async () => {}, stop: () => {}, pulse: () => {} };

  const ctx = new AudioCtx();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  let windNode: AudioBufferSourceNode | null = null;
  let stopped = false;

  function noiseBuffer(seconds = 3) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  async function start() {
    if (stopped) return;
    if (ctx.state === "suspended") await ctx.resume();

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    filter.Q.value = 0.7;

    const windGain = ctx.createGain();
    windGain.gain.value = 0.045;

    windNode = ctx.createBufferSource();
    windNode.buffer = noiseBuffer(4);
    windNode.loop = true;
    windNode.connect(filter);
    filter.connect(windGain);
    windGain.connect(master);
    windNode.start();

    // Soft pad
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 110;
    oscGain.gain.value = 0.02;
    osc.connect(oscGain);
    oscGain.connect(master);
    osc.start();

    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(0.85, now + 1.2);
  }

  function pulse() {
    if (stopped || ctx.state !== "running") return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = 392;
    g.gain.value = 0;
    osc.connect(g);
    g.connect(master);
    const t = ctx.currentTime;
    g.gain.linearRampToValueAtTime(0.08, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    osc.frequency.linearRampToValueAtTime(523, t + 0.8);
    osc.start(t);
    osc.stop(t + 1.5);
  }

  function stop() {
    stopped = true;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.linearRampToValueAtTime(0, t + 0.6);
    window.setTimeout(() => {
      try {
        windNode?.stop();
        void ctx.close();
      } catch {
        /* ignore */
      }
    }, 700);
  }

  return { start, stop, pulse };
}
