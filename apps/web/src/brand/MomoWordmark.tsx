type Props = {
  phase: "hidden" | "mark" | "full";
};

/** Brand wordmark — hero-level signal for opening. */
export function MomoWordmark({ phase }: Props) {
  return (
    <h1 className={`momo-wordmark phase-${phase}`} aria-label="momo.ai">
      <span className="momo-name">momo</span>
      <span className="momo-dot">.</span>
      <span className="momo-tld">ai</span>
    </h1>
  );
}
