import { useEffect, useRef } from "react";
import { createCinemaRenderer } from "./cinema/renderStory";

type Props = {
  /** Elapsed seconds into the opening. */
  time: number;
  duration: number;
  warm: boolean;
};

/**
 * Immersive 60fps 2D cinema stage — Pixar/Disney motion principles
 * (arcs, squash/stretch, ease, staging, secondary action, appeal).
 */
export function StoryCinema({ time, duration, warm }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ReturnType<typeof createCinemaRenderer> | null>(null);
  const timeRef = useRef(time);
  timeRef.current = time;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = createCinemaRenderer(canvas);
    rendererRef.current = renderer;

    const fit = () => {
      const parent = canvas.parentElement;
      const w = parent?.clientWidth ?? window.innerWidth;
      const h = parent?.clientHeight ?? window.innerHeight;
      renderer.resize(w, h, Math.min(window.devicePixelRatio || 1, 2));
    };
    fit();
    window.addEventListener("resize", fit);

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      renderer.draw({
        time: timeRef.current,
        duration,
        warm,
        w: canvas.clientWidth || window.innerWidth,
        h: canvas.clientHeight || window.innerHeight,
        dpr: Math.min(window.devicePixelRatio || 1, 2),
        dt,
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", fit);
    };
  }, [duration, warm]);

  return <canvas ref={canvasRef} className="story-cinema-canvas" aria-hidden />;
}
