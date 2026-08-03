import { nanoid } from "nanoid";
import type {
  AnalysisRequestMeta,
  PlantAnalysisResult,
  ServiceAvailability,
} from "@verdia/contracts";
import type {
  ImageQualityPort,
  PlantAnalysisPort,
  VisionPipelinePort,
} from "../domain/ports.js";

/**
 * Vision pipeline: quality gate first, then analyzer.
 * Live without provider → UnavailableVisionAnalyzer (honest).
 * Demo → MockVerdiaAnalyzer (labeled isMock).
 */
export class VisionPipeline implements VisionPipelinePort {
  constructor(
    private readonly quality: ImageQualityPort,
    private readonly analyzer: PlantAnalysisPort,
    private readonly availabilityFn: () => ServiceAvailability,
  ) {}

  availability(): ServiceAvailability {
    return this.availabilityFn();
  }

  async qualityCheck(imageBuffer: Buffer) {
    return this.quality.check(imageBuffer);
  }

  async analyze(
    imageBuffer: Buffer,
    meta: AnalysisRequestMeta,
  ): Promise<PlantAnalysisResult> {
    if (!meta.consentImage) {
      throw new Error("Image consent required before analysis");
    }

    const quality = await this.quality.check(imageBuffer);
    if (!quality.ok) {
      return {
        id: nanoid(),
        createdAt: new Date().toISOString(),
        provider: "unavailable",
        plantName: null,
        health: "unknown",
        diagnosis: "Image rejected by quality check before analysis.",
        careTips: [
          "Use a clear, well-lit photo of the leaf or plant.",
          "Avoid blurry, dark, or extremely small images.",
        ],
        confidence: 0,
        isMock: false,
        rejected: true,
        rejectionReason: quality.reason ?? "quality_failed",
        evidence: [
          `quality_reject:${quality.reason ?? "unknown"}`,
          quality.sharpnessScore != null
            ? `sharpness:${quality.sharpnessScore}`
            : "sharpness:n/a",
        ],
      };
    }

    return this.analyzer.analyze(imageBuffer, meta);
  }
}
