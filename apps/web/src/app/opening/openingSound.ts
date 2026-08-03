/**
 * Soft story score — gentle musical bed.
 * Starts muted until a user gesture (browser autoplay policy).
 */
export function createOpeningSoundscape() {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return { start: async () => {}, stop: () => {}, swell: () => {} };

  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  const nodes: OscillatorNode[] = [];
  let stopped = false;
  let started = false;

  function ensureCtx() {
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
    }
    return ctx;
  }

  function tone(freq: number, type: OscillatorType, gainVal: number) {
    const c = ensureCtx();
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gainVal;
    osc.connect(g);
    g.connect(master!);
    osc.start();
    nodes.push(osc);
  }

  async function unlockAndStart() {
    if (stopped || started) return;
    const c = ensureCtx();
    if (c.state === "suspended") await c.resume();
    started = true;
    tone(196, "sine", 0.03);
    tone(246.94, "sine", 0.022);
    tone(293.66, "triangle", 0.012);
    const t = c.currentTime;
    master!.gain.setValueAtTime(0, t);
    master!.gain.linearRampToValueAtTime(0.7, t + 2.5);
  }

  async function start() {
    // Try immediately; if blocked, wait for first gesture
    try {
      await unlockAndStart();
    } catch {
      /* blocked */
    }
    const unlock = () => {
      void unlockAndStart();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
  }

  function swell() {
    if (stopped || !ctx || !master || ctx.state !== "running") return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(392, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(523.25, ctx.currentTime + 1.2);
    g.gain.value = 0;
    osc.connect(g);
    g.connect(master);
    const t = ctx.currentTime;
    g.gain.linearRampToValueAtTime(0.07, t + 0.2);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
    osc.start(t);
    osc.stop(t + 2.3);
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    if (!ctx || !master) return;
    try {
      if (ctx.state === "closed") return;
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.linearRampToValueAtTime(0, t + 1.0);
      window.setTimeout(() => {
        nodes.forEach((n) => {
          try {
            n.stop();
          } catch {
            /* ignore */
          }
        });
        if (ctx && ctx.state !== "closed") void ctx.close();
      }, 1100);
    } catch {
      /* ignore */
    }
  }

  return { start, stop, swell };
}
