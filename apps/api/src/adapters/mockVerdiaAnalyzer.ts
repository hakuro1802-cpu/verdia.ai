import { nanoid } from "nanoid";
import type {
  AnalysisRequestMeta,
  PlantAnalysisResult,
  SensorReading,
} from "@verdia/contracts";
import type { PlantAnalysisPort } from "../domain/ports.js";

/**
 * Mock Verdia adapter.
 * There is no public Verdia SDK/API; this returns plausible demo diagnostics
 * and is swappable when real credentials/contracts exist.
 */
export class MockVerdiaAnalyzer implements PlantAnalysisPort {
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

    const sensors = meta.sensors ?? {};
    const { health, diagnosis, tips, plantName, confidence } =
      inferFromSensors(sensors);

    return {
      id: nanoid(),
      createdAt: new Date().toISOString(),
      provider: "mock-verdia",
      plantName,
      health,
      diagnosis,
      careTips: tips,
      confidence,
      isMock: true,
    };
  }
}

function inferFromSensors(sensors: Partial<SensorReading>): {
  health: PlantAnalysisResult["health"];
  diagnosis: string;
  tips: string[];
  plantName: string;
  confidence: number;
} {
  const moisture = sensors.soilMoisturePct;
  const ph = sensors.soilPh;
  const temp = sensors.temperatureC;

  const plantName = "Demo plant (mock identification)";
  const tips: string[] = [
    "This result is from the mock Verdia adapter — not a live Verdia cloud response.",
    "Capture in natural light with the leaf filling most of the frame.",
  ];

  if (moisture != null && moisture < 30) {
    tips.push("Soil moisture is low — consider watering if the pot feels light.");
    return {
      plantName,
      health: "attention",
      diagnosis: "Possible water stress based on soil moisture telemetry.",
      tips,
      confidence: 0.55,
    };
  }

  if (ph != null && (ph < 5.5 || ph > 7.5)) {
    tips.push("Check soil pH against the plant’s preferred range.");
    return {
      plantName,
      health: "attention",
      diagnosis: "Soil pH outside a typical houseplant comfort band.",
      tips,
      confidence: 0.5,
    };
  }

  if (temp != null && temp > 32) {
    tips.push("Move out of direct heat if leaves show stress.");
    return {
      plantName,
      health: "attention",
      diagnosis: "High ambient temperature reported by the DHT22.",
      tips,
      confidence: 0.5,
    };
  }

  tips.push("Keep watering on the edge hysteresis schedule; avoid overwatering.");
  return {
    plantName,
    health: "healthy",
    diagnosis: "No acute stress inferred from paired sensor metadata (mock).",
    tips,
    confidence: 0.45,
  };
}
