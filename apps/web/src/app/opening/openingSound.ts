import type { BeatId } from "./bootTiming";

/**
 * Soft aurora pad — muted until a user gesture (autoplay policy).
 */
export function createOpeningAmbience() {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  if (!AC) {
    return {
      unlock: async () => false,
      setIntensity: (_beat: BeatId) => undefined,
      stop: () => undefined,
    };
  }

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

  async function unlock(): Promise<boolean> {
    if (stopped) return false;
    try {
      const c = ensureCtx();
      if (c.state === "suspended") await c.resume();
      if (!started) {
        started = true;
        // Brighter, warmer pad for Aurora Meadow
        tone(220, "sine", 0.028);
        tone(277.18, "sine", 0.02);
        tone(329.63, "triangle", 0.012);
        tone(440, "sine", 0.008);
        const t = c.currentTime;
        master!.gain.setValueAtTime(0, t);
        master!.gain.linearRampToValueAtTime(0.55, t + 2.2);
      }
      return c.state === "running";
    } catch {
      return false;
    }
  }

  function setIntensity(beat: BeatId) {
    if (stopped || !ctx || !master || ctx.state !== "running") return;
    const levels: Record<BeatId, number> = {
      dawn: 0.35,
      spark: 0.48,
      bloom: 0.58,
      chorus: 0.72,
      title: 0.85,
    };
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.linearRampToValueAtTime(levels[beat], t + 1.1);

    if (beat === "chorus" || beat === "title") {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(392, t);
      osc.frequency.linearRampToValueAtTime(523.25, t + 1.4);
      g.gain.value = 0;
      osc.connect(g);
      g.connect(master);
      g.gain.linearRampToValueAtTime(0.06, t + 0.25);
      g.gain.exponentialRampToValueAtTime(0.001, t + 2.4);
      osc.start(t);
      osc.stop(t + 2.5);
    }
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    if (!ctx || !master) return;
    try {
      if (ctx.state === "closed") return;
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.linearRampToValueAtTime(0, t + 0.9);
      window.setTimeout(() => {
        nodes.forEach((n) => {
          try {
            n.stop();
          } catch {
            /* ignore */
          }
        });
        if (ctx && ctx.state !== "closed") void ctx.close();
      }, 1000);
    } catch {
      /* ignore */
    }
  }

  return { unlock, setIntensity, stop };
}
