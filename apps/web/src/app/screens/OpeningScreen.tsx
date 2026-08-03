import { useEffect, useMemo, useState } from "react";
import {
  markLaunched,
  readBootProfile,
  type StoryBeatId,
} from "../opening/bootTiming";
import { createOpeningSoundscape } from "../opening/openingSound";
import { StoryCinema } from "../opening/StoryCinema";

type Props = {
  onFinished: () => void;
};

/**
 * Part 1 — Immersive 30s cinematic story opening.
 */
export function OpeningScreen({ onFinished }: Props) {
  const profile = useMemo(() => readBootProfile(), []);
  const first = profile.beats[0]!;
  const [beat, setBeat] = useState<StoryBeatId>(first.id);
  const [caption, setCaption] = useState(first.caption);
  const [captionKey, setCaptionKey] = useState(0);
  const [time, setTime] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const sound = createOpeningSoundscape();
    void sound.start();
    const t0 = performance.now();

    const timers = profile.beats.map((b) =>
      window.setTimeout(() => {
        if (cancelled) return;
        setBeat(b.id);
        setCaption(b.caption);
        setCaptionKey((k) => k + 1);
        if (b.id === "morning" || b.id === "title") sound.swell();
      }, b.startMs),
    );

    timers.push(
      window.setTimeout(() => {
        if (cancelled) return;
        markLaunched();
        sound.stop();
        onFinished();
      }, profile.durationMs),
    );

    let raf = 0;
    const tick = (now: number) => {
      if (cancelled) return;
      setTime(Math.min(profile.durationMs / 1000, (now - t0) / 1000));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
      sound.stop();
    };
  }, [onFinished, profile]);

  return (
    <section
      className={`story-opening immersive mode-${profile.mode} beat-${beat}`}
      aria-label="MOMO.AI cinematic opening"
      data-boot={profile.mode}
      data-duration={profile.durationMs}
    >
      <div className="story-cinema-stage">
        <StoryCinema
          time={time}
          duration={profile.durationMs / 1000}
          warm={profile.mode === "warm"}
        />
      </div>

      <div className="story-letterbox top" />
      <div className="story-letterbox bottom" />
      <div className="story-film-frame" aria-hidden />

      {caption ? (
        <p key={captionKey} className="story-caption cinematic-caption">
          {caption}
        </p>
      ) : null}

      <div className="story-progress" aria-hidden>
        <div
          className="story-progress-bar"
          style={{ animationDuration: `${profile.durationMs}ms` }}
        />
      </div>
    </section>
  );
}
