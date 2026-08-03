import type { ImageQualityCheckResult, ImageQualityPort } from "../domain/ports.js";

const MIN_BYTES = 5 * 1024; // 5KB — reject tiny/empty uploads

/**
 * Basic image quality gate without native deps (no sharp).
 * Rejects empty/tiny buffers; optional Laplacian-variance-like heuristic
 * on raw bytes as a crude sharpness proxy for JPEG/PNG payloads.
 */
export class ImageQualityChecker implements ImageQualityPort {
  async check(imageBuffer: Buffer): Promise<ImageQualityCheckResult> {
    if (!imageBuffer || imageBuffer.byteLength === 0) {
      return { ok: false, reason: "empty_image", sharpnessScore: 0 };
    }
    if (imageBuffer.byteLength < MIN_BYTES) {
      return {
        ok: false,
        reason: `image_too_small_${imageBuffer.byteLength}b_min_${MIN_BYTES}`,
        sharpnessScore: 0,
      };
    }

    // Reject buffers that look like plain text / non-image
    if (!looksLikeImage(imageBuffer)) {
      return { ok: false, reason: "unrecognized_image_format", sharpnessScore: 0 };
    }

    const sharpnessScore = estimateSharpness(imageBuffer);
    // Very flat byte streams (near-constant) → likely blank/blurred placeholders
    if (sharpnessScore < 0.5) {
      return {
        ok: false,
        reason: "image_appears_blank_or_extremely_blurred",
        sharpnessScore,
      };
    }

    return { ok: true, sharpnessScore };
  }
}

function looksLikeImage(buf: Buffer): boolean {
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8) return true;
  // PNG
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return true;
  }
  // WebP (RIFF....WEBP)
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45
  ) {
    return true;
  }
  // GIF
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true;
  // Allow unknown binary that is large enough (camera may send raw) —
  // still run sharpness heuristic
  return buf.byteLength >= 20 * 1024;
}

/**
 * Sample adjacent-byte absolute differences as a cheap variance proxy.
 * Real images have higher high-frequency content than solid fills.
 */
function estimateSharpness(buf: Buffer): number {
  const step = Math.max(1, Math.floor(buf.byteLength / 4000));
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let i = 0; i + step < buf.byteLength; i += step) {
    const d = Math.abs(buf[i]! - buf[i + step]!);
    sum += d;
    sumSq += d * d;
    n += 1;
  }
  if (n === 0) return 0;
  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  return Number(Math.max(0, variance).toFixed(2));
}
