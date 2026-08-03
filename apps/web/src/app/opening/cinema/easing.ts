/** Disney-style easing helpers */

export function clamp01(t: number) {
  return Math.max(0, Math.min(1, t));
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function smoothstep(t: number) {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

export function smootherstep(t: number) {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/** Map global time into a local 0–1 window. */
export function windowT(time: number, start: number, end: number) {
  if (end <= start) return time >= end ? 1 : 0;
  return smootherstep((time - start) / (end - start));
}

export function easeOutBack(t: number) {
  const x = clamp01(t);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}

export function easeInOutCubic(t: number) {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}
