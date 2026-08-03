import { useEffect, useMemo, useState } from "react";
import {
  markLaunched,
  readBootProfile,
  type StoryBeatId,
} from "../opening/bootTiming";
import { createOpeningSoundscape } from "../opening/openingSound";
import { StoryReel } from "../opening/StoryReel";

type Props = {
  onFinished: () => void;
};

/**
 * 30-second illustrated story opening (Disney/Pixar intro spirit).
 * Warm returns get a short title card (~4s).
 */
export function OpeningScreen({ onFinished }: Props) {
  const profile = useMemo(() => readBootProfile(), []);
  const first = profile.beats[0]!;
  const [beat, setBeat] = useState<StoryBeatId>(first.id);
  const [caption, setCaption] = useState(first.caption);
  const [captionKey, setCaptionKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const sound = createOpeningSoundscape();
    void sound.start();

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

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      sound.stop();
    };
  }, [onFinished, profile]);

  return (
    <section
      className={`story-opening mode-${profile.mode} beat-${beat}`}
      aria-label="MOMO.AI story opening"
      data-boot={profile.mode}
      data-duration={profile.durationMs}
    >
      <StoryReel beat={beat} warmOnly={profile.mode === "warm"} />

      <div className="story-letterbox top" />
      <div className="story-letterbox bottom" />

      {caption ? (
        <p key={captionKey} className="story-caption">
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
