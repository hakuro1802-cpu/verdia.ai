export type BootMode = "cold" | "warm";

export type BeatId = "dawn" | "spark" | "bloom" | "chorus" | "title";

export type Beat = {
  id: BeatId;
  atMs: number;
};

export type BootPlan = {
  mode: BootMode;
  totalMs: number;
  beats: Beat[];
};

export const coldBootPlan: BootPlan = {
  mode: "cold",
  totalMs: 30_000,
  beats: [
    { id: "dawn", atMs: 0 },
    { id: "spark", atMs: 5_500 },
    { id: "bloom", atMs: 11_000 },
    { id: "chorus", atMs: 16_500 },
    { id: "title", atMs: 20_500 },
  ],
};

export const warmBootPlan: BootPlan = {
  mode: "warm",
  totalMs: 4_200,
  beats: [{ id: "title", atMs: 0 }],
};

export const openingCopy = {
  cold: {
    kicker: "Opening",
    titleTag: "Growing intelligence. Growing tomorrow.",
    captions: {
      dawn: "Before the harvest… a quiet light.",
      spark: "A spark finds the earth.",
      bloom: "Life unfolds.",
      chorus: "Nature and intelligence become one.",
      title: "Welcome to momo.ai",
    } satisfies Record<BeatId, string>,
  },
  warm: {
    kicker: "Welcome back",
    titleTag: "Growing intelligence. Growing tomorrow.",
    captions: {
      dawn: "",
      spark: "",
      bloom: "",
      chorus: "",
      title: "momo.ai",
    } satisfies Record<BeatId, string>,
  },
} as const;
