import { useEffect, useState } from "react";
import { MomoWordmark } from "../../brand/MomoWordmark";
import { OpeningAtmosphere } from "./OpeningAtmosphere";

export type OpeningPhase = "boot" | "bloom" | "brand" | "ready";

type Props = {
  onFinished: () => void;
};

/**
 * Part 1 — App opening.
 * Cinematic launch only: atmosphere → brand → enter.
 */
export function OpeningScreen({ onFinished }: Props) {
  const [phase, setPhase] = useState<OpeningPhase>("boot");

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setPhase("bloom"), 280),
      window.setTimeout(() => setPhase("brand"), 1100),
      window.setTimeout(() => setPhase("ready"), 2200),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const wordmarkPhase =
    phase === "boot" || phase === "bloom"
      ? "hidden"
      : phase === "brand"
        ? "mark"
        : "full";

  return (
    <section className={`opening phase-${phase}`} aria-label="momo.ai opening">
      <OpeningAtmosphere />
      <div className="opening-veil" />

      <div className="opening-stage">
        <p className={`opening-kicker ${phase !== "boot" ? "show" : ""}`}>
          welcome in
        </p>

        <MomoWordmark phase={wordmarkPhase} />

        <p className={`opening-line ${phase === "ready" ? "show" : ""}`}>
          Your plants, felt in real time.
        </p>

        <button
          type="button"
          className={`opening-enter ${phase === "ready" ? "show" : ""}`}
          onClick={onFinished}
          disabled={phase !== "ready"}
        >
          Open app
        </button>
      </div>

      <div className="opening-progress" aria-hidden>
        <span className={phase !== "boot" ? "on" : ""} />
        <span className={phase === "brand" || phase === "ready" ? "on" : ""} />
        <span className={phase === "ready" ? "on" : ""} />
      </div>
    </section>
  );
}
