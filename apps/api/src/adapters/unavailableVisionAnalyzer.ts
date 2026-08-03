import { nanoid } from "nanoid";
import type {
  AnalysisRequestMeta,
  PlantAnalysisResult,
  ServiceAvailability,
} from "@verdia/contracts";
import type { PlantAnalysisPort } from "../domain/ports.js";

/**
 * Honest live-mode stub when VERDIA_VISION_URL is not configured.
 * Never fabricates plant diagnoses.
 */
export class UnavailableVisionAnalyzer implements PlantAnalysisPort {
  async analyze(
    imageBuffer: Buffer,
    meta: AnalysisRequestMeta,
  ): Promise<PlantAnalysisResult> {
    if (!meta.consentImage) {
      throw new Error("Image consent required before analysis");
    }
    if (imageBuffer.byteLength === 0) {
      throw new Error("Empty image");
    }

    return {
      id: nanoid(),
      createdAt: new Date().toISOString(),
      provider: "unavailable",
      plantName: null,
      health: "unknown",
      diagnosis:
        "Vision analysis is unavailable. Configure VERDIA_VISION_URL for live plant analysis.",
      careTips: [
        "Set VERDIA_VISION_URL to your vision provider endpoint.",
        "In demo mode (VERDIA_MODE=demo), mock analysis is used instead.",
      ],
      confidence: 0,
      isMock: false,
      rejected: false,
      evidence: ["provider_not_configured"],
    };
  }

  availability(): ServiceAvailability {
    return {
      status: "unavailable",
      reason: "VERDIA_VISION_URL is not configured",
      code: "vision_not_configured",
    };
  }
}

/**
 * Optional remote vision client when VERDIA_VISION_URL is set.
 * Posts multipart image + meta; expects PlantAnalysisResult JSON.
 */
export class HttpVisionAnalyzer implements PlantAnalysisPort {
  constructor(
    private readonly endpoint: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  availability(): ServiceAvailability {
    return { status: "available" };
  }

  async analyze(
    imageBuffer: Buffer,
    meta: AnalysisRequestMeta,
  ): Promise<PlantAnalysisResult> {
    if (!meta.consentImage) {
      throw new Error("Image consent required before analysis");
    }
    if (imageBuffer.byteLength === 0) {
      throw new Error("Empty image");
    }

    const form = new FormData();
    form.append(
      "image",
      new Blob([new Uint8Array(imageBuffer)]),
      "plant.jpg",
    );
    form.append("meta", JSON.stringify(meta));

    const res = await this.fetchImpl(this.endpoint, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      throw new Error(`vision_provider_http_${res.status}`);
    }
    const result = (await res.json()) as PlantAnalysisResult;
    return {
      ...result,
      provider: result.provider ?? "verdia",
      isMock: false,
    };
  }
}
