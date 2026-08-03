import { nanoid } from "nanoid";
import type {
  AnalysisRequestMeta,
  PlantAnalysisResult,
  ServiceAvailability,
} from "@verdia/contracts";
import type { PlantAnalysisPort } from "../domain/ports.js";

/**
 * Honest live-mode stub when VERDIA_VISION_URL is not configured.
 * Always rejected — never enters "verified analysis" paths.
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
        "Set VERDIA_VISION_URL to your vision provider HTTPS endpoint.",
        "Capture another image after the provider is configured.",
        "Until then, use sensor + weather evidence for recommendations.",
      ],
      confidence: 0,
      isMock: false,
      rejected: true,
      rejectionReason:
        "Vision provider not configured (VERDIA_VISION_URL). Analysis rejected — no diagnosis invented.",
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

const CONFIDENCE_FLOOR = 0.45;

/**
 * Remote vision client when VERDIA_VISION_URL is set.
 * Validates provider JSON; rejects low-confidence or mock-labeled live results.
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
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      throw new Error(`vision_provider_http_${res.status}`);
    }

    const raw = (await res.json()) as Partial<PlantAnalysisResult>;
    const confidence =
      typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
        ? raw.confidence
        : 0;

    if (raw.isMock === true) {
      return {
        id: typeof raw.id === "string" ? raw.id : nanoid(),
        createdAt: new Date().toISOString(),
        provider: "unavailable",
        plantName: null,
        health: "unknown",
        diagnosis: "Vision provider returned a mock-labeled result in Live Mode.",
        careTips: ["Use a production vision endpoint that does not return isMock:true."],
        confidence: 0,
        isMock: true,
        rejected: true,
        rejectionReason: "Mock-labeled vision result rejected in Live Mode.",
        evidence: ["provider_returned_mock"],
      };
    }

    if (confidence < CONFIDENCE_FLOOR) {
      return {
        id: typeof raw.id === "string" ? raw.id : nanoid(),
        createdAt: new Date().toISOString(),
        provider: "verdia",
        plantName: raw.plantName ?? null,
        health: "unknown",
        diagnosis: raw.diagnosis ?? "Low confidence analysis",
        careTips: ["Capture a sharper, closer image in good light and retry."],
        confidence,
        isMock: false,
        rejected: true,
        rejectionReason: `Confidence ${confidence} below threshold ${CONFIDENCE_FLOOR}. Please capture another image.`,
        evidence: Array.isArray(raw.evidence) ? raw.evidence : [],
      };
    }

    if (!raw.diagnosis || typeof raw.diagnosis !== "string") {
      throw new Error("vision_provider_invalid_payload");
    }

    return {
      id: typeof raw.id === "string" ? raw.id : nanoid(),
      createdAt:
        typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
      provider: "verdia",
      analysisType: raw.analysisType,
      plantName: raw.plantName ?? null,
      health: raw.health ?? "unknown",
      diagnosis: raw.diagnosis,
      careTips: Array.isArray(raw.careTips) ? raw.careTips : [],
      confidence,
      isMock: false,
      rejected: false,
      evidence: Array.isArray(raw.evidence) ? raw.evidence : [],
    };
  }
}
