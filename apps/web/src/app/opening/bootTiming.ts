const STORAGE_KEY = "momo.ai.hasLaunched";

export type BootProfile = {
  /** First launch cinematic vs warm start. */
  mode: "cold" | "warm";
  /** Total duration in ms. */
  durationMs: number;
  /** Phase end times (ms from start). */
  phases: {
    dark: number;
    awaken: number;
    ecosystem: number;
    intelligence: number;
    transit: number;
  };
};

export function readBootProfile(): BootProfile {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const forceCold = params?.get("boot") === "cold";
  const warm =
    !forceCold &&
    typeof localStorage !== "undefined" &&
    localStorage.getItem(STORAGE_KEY) === "1";
  if (warm) {
    return {
      mode: "warm",
      durationMs: 1500,
      phases: {
        dark: 200,
        awaken: 500,
        ecosystem: 800,
        intelligence: 1100,
        transit: 1500,
      },
    };
  }
  return {
    mode: "cold",
    durationMs: 5000,
    phases: {
      dark: 1000,
      awaken: 2000,
      ecosystem: 3000,
      intelligence: 4000,
      transit: 5000,
    },
  };
}

export function markLaunched(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* private mode */
  }
}

/** Dev helper — clear to replay full cinematic. */
export function resetLaunchFlag(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
