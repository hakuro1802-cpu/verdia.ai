import type {
  Recommendation,
  SensorReading,
  WeatherInterpretation,
  PlantAnalysisResult,
} from "./types.js";

export type RecommendationInput = {
  sensors?: SensorReading | null;
  weather?: WeatherInterpretation | null;
  analysis?: PlantAnalysisResult | null;
  crop?: string | null;
  growthStage?: string | null;
};

/**
 * Evidence-based recommendations only.
 * If evidence is insufficient, returns an honest unavailable-style recommendation.
 */
export function buildRecommendation(input: RecommendationInput): Recommendation {
  const now = new Date().toISOString();
  const evidence: string[] = [];
  const risks: string[] = [];
  const sources: string[] = [
    "FAO irrigation scheduling principles",
    "IPM scouting best practices",
  ];

  const moisture = input.sensors?.soilMoisturePct;
  const temp = input.sensors?.temperatureC;
  const water = input.sensors?.waterLevelPct;
  const humidity = input.sensors?.humidityPct;

  if (moisture != null) evidence.push(`Soil moisture ${moisture}%`);
  if (temp != null) evidence.push(`Air temperature ${temp}°C`);
  if (water != null) evidence.push(`Water tank ${water}%`);
  if (humidity != null) evidence.push(`Humidity ${humidity}%RH`);
  if (input.crop) evidence.push(`Crop: ${input.crop}`);
  if (input.growthStage) evidence.push(`Growth stage: ${input.growthStage}`);
  if (input.analysis && !input.analysis.rejected && !input.analysis.isMock && input.analysis.provider !== "unavailable") {
    evidence.push(`Camera: ${input.analysis.diagnosis} (confidence ${input.analysis.confidence})`);
  } else if (input.analysis?.isMock) {
    evidence.push("Camera result labeled mock — not used as scientific evidence");
  } else if (input.analysis?.rejected || input.analysis?.provider === "unavailable") {
    // Explicitly not evidence
  }
  if (input.weather) {
    for (const impact of input.weather.impacts) {
      evidence.push(`Weather: ${impact.signal}`);
    }
  }

  if (evidence.length === 0) {
    return {
      id: `rec_insufficient_${Date.now()}`,
      createdAt: now,
      summary: "Insufficient verified evidence for a recommendation.",
      evidence: [],
      scientificExplanation:
        "Recommendations require at least one validated sensor reading, live weather interpretation, or non-mock camera analysis.",
      confidence: 0,
      primary: "Collect a validated sensor sample or a clear plant image, then retry.",
      alternative: null,
      organicMethod: null,
      conventionalMethod: null,
      preventiveAdvice: "Keep devices online and capture images in good light.",
      expectedOutcome: null,
      potentialRisks: ["Acting without evidence can waste water or miss disease early signs."],
      sources,
      unavailableReason: "no_verified_evidence",
    };
  }

  let primary = "Maintain current irrigation schedule and continue monitoring.";
  let alternative: string | null = "Recheck sensors in 1–2 hours before changing course.";
  let organic: string | null = null;
  let conventional: string | null = null;
  let preventive: string | null = "Scout leaves weekly; log moisture before and after irrigation.";
  let expected: string | null = "Stable growth if moisture stays in the crop-appropriate band.";
  let confidence = 0.55;
  let summary = "Conditions appear manageable with continued monitoring.";
  let scientific =
    "Decisions combine soil-water availability, atmospheric demand, and (when present) visual plant evidence.";

  if (water != null && water < 15) {
    summary = "Water tank is low — irrigation should pause until refilled.";
    primary = "Refill the tank before running the pump.";
    alternative = "Switch to hand watering for critical plants only.";
    risks.push("Pump cavitation or dry-run damage if tank is empty.");
    confidence = 0.9;
    scientific =
      "Edge policy blocks irrigation below the minimum tank threshold to protect hardware and avoid false moisture recovery.";
  } else if (moisture != null && moisture < 35) {
    summary = "Soil moisture is below the low threshold.";
    primary = "Irrigate during a cool window if rain probability is not high.";
    alternative = "Spot-water root zones if a full cycle is not possible.";
    organic = "Mulch to reduce evaporation after watering.";
    conventional = "Run a timed pulse and re-measure moisture after 30–60 minutes.";
    risks.push("Overwatering if rain arrives soon after irrigation.");
    confidence = 0.8;
    scientific =
      "Capacitive moisture below the low set-point indicates plant-available water is likely limited for many vegetable crops.";
  } else if (moisture != null && moisture > 70) {
    summary = "Soil moisture is high — hold irrigation.";
    primary = "Skip the next irrigation cycle and monitor for waterlogging.";
    preventive = "Improve drainage if high moisture persists for multiple days.";
    risks.push("Root hypoxia and fungal pressure in persistently wet soil.");
    confidence = 0.75;
  }

  if (input.weather) {
    for (const impact of input.weather.impacts) {
      if (impact.signal.includes("rain")) {
        primary = `${primary} Also: ${impact.suggestedAction}`;
        confidence = Math.min(0.92, confidence + 0.05);
      }
      if (impact.signal.includes("Humidity")) {
        preventive = impact.suggestedAction;
      }
      if (impact.signal.includes("Heat")) {
        alternative = impact.suggestedAction;
      }
    }
  }

  if (input.analysis && !input.analysis.rejected && input.analysis.confidence >= 0.5) {
    if (input.analysis.isMock) {
      risks.push("Vision result is mock-labeled and must not be treated as a field diagnosis.");
      confidence = Math.min(confidence, 0.45);
    } else {
      summary = `Plant attention: ${input.analysis.diagnosis}`;
      primary = input.analysis.careTips[0] ?? primary;
      confidence = Math.min(0.95, (confidence + input.analysis.confidence) / 2);
    }
  }

  return {
    id: `rec_${Date.now()}`,
    createdAt: now,
    summary,
    evidence,
    scientificExplanation: scientific,
    confidence: Number(confidence.toFixed(2)),
    primary,
    alternative,
    organicMethod: organic,
    conventionalMethod: conventional,
    preventiveAdvice: preventive,
    expectedOutcome: expected,
    potentialRisks: risks,
    sources,
  };
}
