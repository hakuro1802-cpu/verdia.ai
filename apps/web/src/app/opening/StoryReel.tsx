import type { StoryBeatId } from "../opening/bootTiming";

type Props = {
  beat: StoryBeatId;
  warmOnly?: boolean;
};

/**
 * 2D illustrated story reel — Disney/Pixar intro energy:
 * soft shapes, staged reveals, sparkle dust, emotional payoff.
 */
export function StoryReel({ beat, warmOnly }: Props) {
  return (
    <div className={`story-reel beat-${beat} ${warmOnly ? "warm" : ""}`} aria-hidden>
      <div className="story-sky" />
      <Stars active={beat === "night" || beat === "seed"} />
      <Hills />
      <Sun active={beat === "morning" || beat === "answer" || beat === "intelligence" || beat === "title"} />
      <SoilCrossSection showSeed={beat !== "night"} grow={beat} />
      <Fireflies active={beat === "answer" || beat === "intelligence"} />
      <Butterflies active={beat === "answer" || beat === "intelligence" || beat === "title"} />
      <SparkleDust active={beat === "title" || beat === "intelligence"} />
      <TitleCrest active={beat === "title"} />
    </div>
  );
}

function Stars({ active }: { active: boolean }) {
  return (
    <svg className={`layer stars ${active ? "on" : ""}`} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
      {Array.from({ length: 28 }, (_, i) => (
        <circle
          key={i}
          className="star"
          cx={3 + ((i * 17) % 94)}
          cy={4 + ((i * 13) % 48)}
          r={0.25 + (i % 3) * 0.12}
          style={{ animationDelay: `${(i % 7) * 0.35}s` }}
        />
      ))}
    </svg>
  );
}

function Hills() {
  return (
    <svg className="layer hills" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="hillFar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a5a40" />
          <stop offset="100%" stopColor="#143024" />
        </linearGradient>
        <linearGradient id="hillNear" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3d7a52" />
          <stop offset="100%" stopColor="#1c4030" />
        </linearGradient>
        <linearGradient id="soilGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5c4030" />
          <stop offset="100%" stopColor="#24160f" />
        </linearGradient>
        <linearGradient id="leafGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8fd98a" />
          <stop offset="100%" stopColor="#2f8a4a" />
        </linearGradient>
        <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path className="hill far" d="M0 72 C18 62 32 66 48 70 C64 74 78 60 100 68 L100 100 L0 100 Z" />
      <path className="hill near" d="M0 78 C22 70 40 76 55 80 C72 85 88 74 100 78 L100 100 L0 100 Z" />
    </svg>
  );
}

function Sun({ active }: { active: boolean }) {
  return (
    <div className={`sun ${active ? "on" : ""}`}>
      <span className="sun-core" />
      <span className="sun-glow" />
    </div>
  );
}

function SoilCrossSection({ showSeed, grow }: { showSeed: boolean; grow: StoryBeatId }) {
  const sprout =
    grow === "morning" || grow === "answer" || grow === "intelligence" || grow === "title";
  const leafy = grow === "answer" || grow === "intelligence" || grow === "title";
  const wise = grow === "intelligence" || grow === "title";

  return (
    <svg className="layer soil-scene" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="soilGrad2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6a4a36" />
          <stop offset="55%" stopColor="#3a261a" />
          <stop offset="100%" stopColor="#1a100c" />
        </linearGradient>
        <linearGradient id="leafGrad2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#b6f0a0" />
          <stop offset="100%" stopColor="#2f8a4a" />
        </linearGradient>
        <filter id="leafGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path className="soil" d="M0 62 L100 62 L100 100 L0 100 Z" fill="url(#soilGrad2)" />
      <path
        className="soil-top"
        d="M0 62 C20 60 40 64 60 61 C80 58 90 63 100 62 L100 70 L0 70 Z"
        fill="#5a3c2a"
        opacity="0.9"
      />

      <g className={`roots ${leafy ? "on" : ""} ${wise ? "glow" : ""}`}>
        <path d="M50 70 C46 78 42 84 38 92" />
        <path d="M50 70 C54 78 58 85 64 93" />
        <path d="M50 72 C50 80 48 88 50 96" />
        <path d="M48 76 C40 80 34 86 30 90" />
        <path d="M52 76 C60 81 68 86 72 91" />
      </g>

      <ellipse className={`seed ${showSeed ? "on" : ""}`} cx="50" cy="68" rx="3.4" ry="2.4" />

      <g className={`sprout ${sprout ? "on" : ""} ${leafy ? "leafy" : ""}`} filter={wise ? "url(#leafGlow)" : undefined}>
        <path className="stem" d="M50 66 C50 58 50 50 50 40" />
        <path className="leaf left" d="M50 52 C42 50 36 46 34 40 C40 42 46 44 50 48 Z" fill="url(#leafGrad2)" />
        <path className="leaf right" d="M50 48 C58 46 64 42 66 36 C60 38 54 42 50 46 Z" fill="url(#leafGrad2)" />
        <path className="leaf left upper" d="M50 44 C43 41 38 36 37 30 C43 33 47 36 50 40 Z" fill="url(#leafGrad2)" />
        <path className="leaf right upper" d="M50 40 C57 37 62 32 64 26 C58 29 53 34 50 38 Z" fill="url(#leafGrad2)" />
      </g>

      {wise ? (
        <g className="wisps">
          <circle cx="40" cy="38" r="0.7" />
          <circle cx="60" cy="34" r="0.55" />
          <circle cx="50" cy="28" r="0.5" />
          <path d="M40 38 L50 28 L60 34" />
        </g>
      ) : null}
    </svg>
  );
}

function Fireflies({ active }: { active: boolean }) {
  return (
    <div className={`fireflies ${active ? "on" : ""}`}>
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} style={{ ["--i" as string]: i }} />
      ))}
    </div>
  );
}

function Butterflies({ active }: { active: boolean }) {
  return (
    <div className={`butterflies ${active ? "on" : ""}`}>
      <svg className="bf bf-a" viewBox="0 0 24 24">
        <path d="M12 12 C8 8 4 9 5 13 C6 16 10 15 12 12 Z" />
        <path d="M12 12 C16 8 20 9 19 13 C18 16 14 15 12 12 Z" />
        <circle cx="12" cy="12" r="0.8" />
      </svg>
      <svg className="bf bf-b" viewBox="0 0 24 24">
        <path d="M12 12 C8 8 4 9 5 13 C6 16 10 15 12 12 Z" />
        <path d="M12 12 C16 8 20 9 19 13 C18 16 14 15 12 12 Z" />
        <circle cx="12" cy="12" r="0.8" />
      </svg>
    </div>
  );
}

function SparkleDust({ active }: { active: boolean }) {
  return (
    <div className={`sparkle-dust ${active ? "on" : ""}`}>
      {Array.from({ length: 18 }, (_, i) => (
        <span key={i} style={{ ["--i" as string]: i }} />
      ))}
    </div>
  );
}

function TitleCrest({ active }: { active: boolean }) {
  return (
    <div className={`title-crest ${active ? "on" : ""}`}>
      <div className="crest-ring" />
      <div className="crest-mark">MOMO.AI</div>
      <div className="crest-sub">Growing Intelligence. Growing Tomorrow.</div>
    </div>
  );
}
