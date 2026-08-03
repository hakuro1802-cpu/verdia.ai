const STORAGE_KEY = "momo.ai.hasLaunched";

export type StoryBeatId =
  | "night"
  | "seed"
  | "morning"
  | "answer"
  | "intelligence"
  | "title";

export type StoryBeat = {
  id: StoryBeatId;
  /** When this beat begins (ms from start) */
  startMs: number;
  caption: string;
};

export type BootProfile = {
  mode: "cold" | "warm";
  durationMs: number;
  beats: StoryBeat[];
};

/** Cold launch — full 30s illustrated story. */
const COLD: BootProfile = {
  mode: "cold",
  durationMs: 30_000,
  beats: [
    { id: "night", startMs: 0, caption: "Once, the night held a quiet field…" },
    { id: "seed", startMs: 5_500, caption: "A single seed waited beneath the soil." },
    { id: "morning", startMs: 11_000, caption: "It reached for the morning light." },
    { id: "answer", startMs: 17_000, caption: "And the world answered gently." },
    { id: "intelligence", startMs: 23_000, caption: "Intelligence grew with every leaf." },
    { id: "title", startMs: 27_000, caption: "" },
  ],
};

/** Warm return — short studio title card. */
const WARM: BootProfile = {
  mode: "warm",
  durationMs: 4_000,
  beats: [{ id: "title", startMs: 0, caption: "" }],
};

export function readBootProfile(): BootProfile {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const forceCold = params?.get("boot") === "cold";
  const warm =
    !forceCold &&
    typeof localStorage !== "undefined" &&
    localStorage.getItem(STORAGE_KEY) === "1";
  return warm ? WARM : COLD;
}

export function markLaunched(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* private mode */
  }
}
