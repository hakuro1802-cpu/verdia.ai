import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { markLaunched, readBootProfile } from "../opening/bootTiming";
import { createOpeningSoundscape } from "../opening/openingSound";
import { OpeningAtmosphere } from "./OpeningAtmosphere";

export type CinematicPhase = "dark" | "awaken" | "ecosystem" | "intelligence" | "transit";

type Props = {
  onFinished: () => void;
};

/**
 * MOMO.AI cinematic opening — master boot sequence.
 * Cold: 5s · Warm return: 1.5s · Morphs into Home (no spinner).
 */
export function OpeningScreen({ onFinished }: Props) {
  const profile = useMemo(() => readBootProfile(), []);
  const [phase, setPhase] = useState<CinematicPhase>("dark");
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const sound = createOpeningSoundscape();
    void sound.start();

    const { phases } = profile;
    const timers = [
      window.setTimeout(() => setPhase("awaken"), phases.dark),
      window.setTimeout(() => {
        setPhase("ecosystem");
        sound.pulse();
      }, phases.awaken),
      window.setTimeout(() => setPhase("intelligence"), phases.ecosystem),
      window.setTimeout(() => {
        setPhase("transit");
        sound.pulse();
      }, phases.intelligence),
      window.setTimeout(() => {
        markLaunched();
        sound.stop();
        onFinished();
      }, phases.transit),
    ];

    return () => {
      timers.forEach(clearTimeout);
      sound.stop();
    };
  }, [onFinished, profile]);

  useEffect(() => {
    const onOrient = (e: DeviceOrientationEvent) => {
      const x = ((e.gamma ?? 0) / 45) * 6;
      const y = (((e.beta ?? 45) - 45) / 45) * 4;
      setTilt({ x: Math.max(-8, Math.min(8, x)), y: Math.max(-6, Math.min(6, y)) });
    };
    window.addEventListener("deviceorientation", onOrient);
    return () => window.removeEventListener("deviceorientation", onOrient);
  }, []);

  return (
    <section
      className={`opening cinematic phase-${phase} mode-${profile.mode}`}
      aria-label="MOMO.AI opening"
      style={
        {
          "--tilt-x": `${tilt.x}px`,
          "--tilt-y": `${tilt.y}px`,
        } as CSSProperties
      }
    >
      <OpeningAtmosphere phase={phase} reduced={!!reduced} />
      <div className="opening-veil" />
      <div className="opening-bloom" />

      <div className="opening-stage">
        <div className="opening-brand-block">
          <p className="cinematic-mark">MOMO.AI</p>
          <p className="cinematic-tagline">
            <span>Growing Intelligence.</span>
            <span>Growing Tomorrow.</span>
          </p>
        </div>
      </div>

      <div className="opening-progress cinematic" aria-hidden>
        <span className={phase !== "dark" ? "on" : ""} />
        <span
          className={
            phase === "ecosystem" || phase === "intelligence" || phase === "transit" ? "on" : ""
          }
        />
        <span className={phase === "intelligence" || phase === "transit" ? "on" : ""} />
        <span className={phase === "transit" ? "on" : ""} />
      </div>
    </section>
  );
}
