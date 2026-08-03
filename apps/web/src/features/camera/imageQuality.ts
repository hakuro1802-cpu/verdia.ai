export type ImageQualityResult =
  | { ok: true; width: number; height: number; bytes: number }
  | { ok: false; reason: string };

const MIN_WIDTH = 320;
const MIN_HEIGHT = 240;
const MIN_BYTES = 8_000;
/** Very small JPEGs / PNGs often indicate blank or heavily compressed blurry captures. */
const SUSPICIOUS_BYTES_PER_PIXEL = 0.04;

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode image"));
    };
    img.src = url;
  });
}

/**
 * Estimate "blurry-looking" via low variance of grayscale luminance on a downscaled sample.
 * This is a client heuristic — not a scientific blur metric.
 */
async function estimateSharpness(img: HTMLImageElement): Promise<number> {
  const canvas = document.createElement("canvas");
  const w = 64;
  const h = 64;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 1;
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const grays: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    grays.push(0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!);
  }
  let laplacianSum = 0;
  let count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const c = grays[i]!;
      const lap =
        Math.abs(4 * c - grays[i - 1]! - grays[i + 1]! - grays[i - w]! - grays[i + w]!);
      laplacianSum += lap;
      count++;
    }
  }
  return count ? laplacianSum / count : 0;
}

export async function assessImageQuality(blob: Blob): Promise<ImageQualityResult> {
  if (blob.size < MIN_BYTES) {
    return {
      ok: false,
      reason: `Image too small (${blob.size} bytes). Capture a clearer photo.`,
    };
  }

  let img: HTMLImageElement;
  try {
    img = await loadImage(blob);
  } catch {
    return { ok: false, reason: "Could not read this image file." };
  }

  if (img.naturalWidth < MIN_WIDTH || img.naturalHeight < MIN_HEIGHT) {
    return {
      ok: false,
      reason: `Resolution too low (${img.naturalWidth}×${img.naturalHeight}). Need at least ${MIN_WIDTH}×${MIN_HEIGHT}.`,
    };
  }

  const bpp = blob.size / (img.naturalWidth * img.naturalHeight);
  if (bpp < SUSPICIOUS_BYTES_PER_PIXEL) {
    return {
      ok: false,
      reason: "Image looks overly compressed or nearly empty. Try a clearer capture.",
    };
  }

  const sharpness = await estimateSharpness(img);
  if (sharpness < 4) {
    return {
      ok: false,
      reason: "Image looks blurry. Hold steady and try again.",
    };
  }

  return {
    ok: true,
    width: img.naturalWidth,
    height: img.naturalHeight,
    bytes: blob.size,
  };
}
