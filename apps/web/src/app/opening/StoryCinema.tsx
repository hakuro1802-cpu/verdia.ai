import { useEffect, useRef } from "react";
import type { BootMode } from "./bootTiming";
import { createCinemaRenderer } from "./cinema/renderStory";

type Props = {
  timeMs: number;
  totalMs: number;
  mode: BootMode;
};

export function StoryCinema({ timeMs, totalMs, mode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timeRef = useRef(timeMs);
  const totalRef = useRef(totalMs);
  const modeRef = useRef(mode);
  const lastRef = useRef(performance.now());

  timeRef.current = timeMs;
  totalRef.current = totalMs;
  modeRef.current = mode;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = createCinemaRenderer(canvas);
    let frame = 0;
    let disposed = false;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(window.innerWidth));
      const h = Math.max(1, Math.floor(window.innerHeight));
      renderer.resize(w, h, dpr);
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = (now: number) => {
      if (disposed) return;
      const dt = Math.min(0.05, (now - lastRef.current) / 1000);
      lastRef.current = now;
      const timeSec = timeRef.current / 1000;
      const durationSec = totalRef.current / 1000;
      renderer.draw({
        time: timeSec,
        duration: durationSec,
        warm: modeRef.current === "warm",
        w: canvas.clientWidth,
        h: canvas.clientHeight,
        dpr: Math.min(window.devicePixelRatio || 1, 2),
        dt,
      });
      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="story-cinema" aria-hidden="true" />;
}
