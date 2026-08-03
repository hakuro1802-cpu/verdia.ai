import { useEffect, useMemo, useRef, useState } from "react";
import { StoryCinema } from "../opening/StoryCinema";
import {
  coldBootPlan,
  openingCopy,
  warmBootPlan,
  type BeatId,
} from "../opening/bootTiming";
import { createOpeningAmbience } from "../opening/openingSound";

type Props = {
  onFinished: () => void;
};

const HAS_LAUNCHED_KEY = "momo.ai.hasLaunched";

function readHasLaunched(): boolean {
  try {
    return localStorage.getItem(HAS_LAUNCHED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeHasLaunched(): void {
  try {
    localStorage.setItem(HAS_LAUNCHED_KEY, "1");
  } catch {
    // Ignore storage failures.
  }
}

function clearHasLaunched(): void {
  try {
    localStorage.removeItem(HAS_LAUNCHED_KEY);
  } catch {
    // Ignore storage failures.
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function forceColdBoot(): boolean {
  return new URLSearchParams(window.location.search).get("boot") === "cold";
}

export function OpeningScreen({ onFinished }: Props) {
  const coldForced = forceColdBoot();
  if (coldForced) {
    clearHasLaunched();
  }

  const plan = useMemo(
    () => (coldForced || !readHasLaunched() ? coldBootPlan : warmBootPlan),
    [coldForced],
  );
  const copy = openingCopy[plan.mode];
  const reduced = prefersReducedMotion();
  const [phase, setPhase] = useState<"story" | "leaving">("story");
  const [beat, setBeat] = useState<BeatId>(plan.beats[0]?.id ?? "dawn");
  const [timeMs, setTimeMs] = useState(0);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const finishedRef = useRef(false);
  const audioRef = useRef<ReturnType<typeof createOpeningAmbience> | null>(null);

  useEffect(() => {
    if (reduced) {
      writeHasLaunched();
      onFinished();
      return;
    }

    const timers = plan.beats.map((item) =>
      window.setTimeout(() => setBeat(item.id), item.atMs),
    );
    const leave = window.setTimeout(() => setPhase("leaving"), plan.totalMs - 700);
    const done = window.setTimeout(() => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      writeHasLaunched();
      onFinished();
    }, plan.totalMs);

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      window.clearTimeout(leave);
      window.clearTimeout(done);
    };
  }, [onFinished, plan, reduced]);

  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      setTimeMs(Math.min(plan.totalMs, now - started));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [plan.totalMs, reduced]);

  useEffect(() => {
    if (reduced) return;
    const audio = createOpeningAmbience();
    audioRef.current = audio;

    const unlock = () => {
      void audio.unlock().then((ok) => {
        if (ok) setAudioUnlocked(true);
      });
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    void audio.unlock().then((ok) => {
      if (ok) setAudioUnlocked(true);
    });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      audio.stop();
      audioRef.current = null;
    };
  }, [reduced]);

  useEffect(() => {
    audioRef.current?.setIntensity(beat);
  }, [beat]);

  const skip = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    writeHasLaunched();
    audioRef.current?.stop();
    onFinished();
  };

  if (reduced) {
    return null;
  }

  // Title-forward: whisper early, strong mid, mega finale
  const titleClass =
    beat === "title"
      ? "is-on is-mega"
      : beat === "chorus"
        ? "is-on is-strong"
        : beat === "bloom"
          ? "is-on is-whisper"
          : plan.mode === "warm"
            ? "is-on is-mega"
            : "";

  return (
    <section
      className={`opening-screen aurora ${phase === "leaving" ? "is-leaving" : ""}`}
      aria-label="momo.ai opening"
    >
      <div className="opening-cinema-host" aria-hidden="true">
        <StoryCinema timeMs={timeMs} totalMs={plan.totalMs} mode={plan.mode} />
      </div>

      <div className="opening-veil" aria-hidden="true" />

      <div className="opening-letterbox aurora-chrome">
        <header className="opening-topbar">
          <p className="opening-kicker">{copy.kicker}</p>
          <button type="button" className="opening-skip" onClick={skip}>
            Skip
          </button>
        </header>

        <div className={`opening-title-stage ${titleClass}`}>
          <p className="opening-title-wordmark">momo.ai</p>
          {beat === "title" || plan.mode === "warm" ? (
            <p className="opening-title-tag">{copy.titleTag}</p>
          ) : null}
        </div>

        <div className="opening-caption-dock">
          <p key={beat} className="opening-caption">
            {copy.captions[beat]}
          </p>
          {!audioUnlocked ? (
            <p className="opening-audio-hint">Tap anywhere for sound</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
