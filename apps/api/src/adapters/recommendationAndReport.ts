import { nanoid } from "nanoid";
import { buildRecommendation } from "@verdia/contracts";
import type {
  PlantAnalysisResult,
  Recommendation,
  ReportPeriod,
  ReportSummary,
  TelemetrySample,
  WeatherInterpretation,
} from "@verdia/contracts";
import type { RecommendationPort, ReportPort } from "../domain/ports.js";

export class LocalRecommendationAdapter implements RecommendationPort {
  build(input: {
    sensors?: TelemetrySample["sensors"] | null;
    weather?: WeatherInterpretation | null;
    analysis?: PlantAnalysisResult | null;
    crop?: string | null;
    growthStage?: string | null;
  }): Recommendation {
    return buildRecommendation(input);
  }
}

/**
 * Reports only from verified telemetry / non-rejected analysis evidence.
 * Never invents statistics when data is missing.
 */
export class LocalReportAdapter implements ReportPort {
  generate(input: {
    period: ReportPeriod;
    farmId?: string | null;
    deviceId?: string | null;
    telemetry: TelemetrySample[];
    analyses: PlantAnalysisResult[];
    weather?: WeatherInterpretation | null;
  }): ReportSummary {
    const now = new Date().toISOString();
    const windowMs = periodMs(input.period);
    const cutoff = Date.now() - windowMs;

    const samples = input.telemetry.filter((s) => {
      const t = Date.parse(s.timestamp);
      if (!Number.isFinite(t) || t < cutoff) return false;
      if (input.deviceId && s.deviceId !== input.deviceId) return false;
      return true;
    });

    const analyses = input.analyses.filter((a) => {
      const t = Date.parse(a.createdAt);
      if (!Number.isFinite(t) || t < cutoff) return false;
      if (a.rejected || a.isMock || a.provider === "unavailable") return false;
      if (!(a.confidence > 0)) return false;
      return true;
    });

    const sections: ReportSummary["sections"] = [];
    const moistureVals = samples
      .map((s) => s.sensors.soilMoisturePct)
      .filter((v): v is number => v != null);
    const tempVals = samples
      .map((s) => s.sensors.temperatureC)
      .filter((v): v is number => v != null);
    const pumpOnCount = samples.filter((s) => s.pumpOn).length;

    const missing: string[] = [];
    if (samples.length === 0) missing.push("ESP32 / sensor telemetry for this period");
    if (analyses.length === 0) missing.push("Accepted live camera analyses");
    if (!input.weather) missing.push("Weather snapshot (optional context)");
    if (input.farmId) {
      missing.push(
        `Farm filter ${input.farmId} is recorded on the report header; telemetry is still device-scoped until devices are linked to farms.`,
      );
    }

    if (samples.length === 0 && analyses.length === 0) {
      const nextCollection = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      return {
        id: `report_${nanoid(8)}`,
        period: input.period,
        generatedAt: now,
        farmId: input.farmId ?? null,
        deviceId: input.deviceId ?? null,
        sections: [
          {
            title: "Available information",
            facts: [
              "No verified telemetry or accepted live camera analyses in this period.",
              "No averages, trends, or statistics were invented.",
            ],
          },
          {
            title: "Missing information",
            facts: missing.length
              ? missing
              : ["Connect an ESP32 or complete a live camera analysis."],
          },
          {
            title: "Minimum data required",
            facts: [
              "At least one validated sensor sample OR one accepted live vision analysis in the selected period.",
              "Sensor values must pass physical bounds and timestamp checks.",
            ],
          },
          {
            title: "Next data collection",
            facts: [
              `Ensure the device posts telemetry, then regenerate after ${nextCollection}.`,
              "Or capture a clear plant image once VERDIA_VISION_URL is configured.",
            ],
          },
        ],
        dataPointsUsed: 0,
        note: "Honest empty report: insufficient verified historical data.",
      };
    }

    if (samples.length > 0) {
      const facts: string[] = [
        `${samples.length} verified telemetry sample(s) in period.`,
      ];
      if (moistureVals.length) {
        facts.push(
          `Soil moisture range ${min(moistureVals).toFixed(1)}–${max(moistureVals).toFixed(1)}% (n=${moistureVals.length}).`,
        );
      } else {
        facts.push("No valid soil moisture readings in period.");
      }
      if (tempVals.length) {
        facts.push(
          `Air temperature range ${min(tempVals).toFixed(1)}–${max(tempVals).toFixed(1)}°C (n=${tempVals.length}).`,
        );
      }
      facts.push(`Samples with pump on: ${pumpOnCount}/${samples.length}.`);
      sections.push({ title: "Telemetry", facts });
    }

    if (analyses.length > 0) {
      const mockCount = analyses.filter((a) => a.isMock).length;
      const liveCount = analyses.length - mockCount;
      const facts = [
        `${analyses.length} analysis result(s) retained (rejected images excluded).`,
        `Live provider results: ${liveCount}; mock-labeled: ${mockCount}.`,
      ];
      for (const a of analyses.slice(0, 5)) {
        const tag = a.isMock ? " [mock]" : "";
        facts.push(
          `${a.createdAt}: ${a.diagnosis} (confidence ${a.confidence})${tag}`,
        );
      }
      sections.push({ title: "Vision analysis", facts });
    }

    if (input.weather) {
      sections.push({
        title: "Weather context",
        facts: [
          `${input.weather.weather.conditionLabel}, ${input.weather.weather.temperatureC}°C, humidity ${input.weather.weather.humidityPct}%RH`,
          ...input.weather.impacts.map(
            (i) => `${i.signal}: ${i.agriculturalImpact}`,
          ),
        ],
      });
    }

    return {
      id: `report_${nanoid(8)}`,
      period: input.period,
      generatedAt: now,
      farmId: input.farmId ?? null,
      deviceId: input.deviceId ?? null,
      sections,
      dataPointsUsed: samples.length + analyses.length,
      note: "Built only from verified telemetry and retained analysis results.",
    };
  }
}

function periodMs(period: ReportPeriod): number {
  switch (period) {
    case "daily":
      return 24 * 60 * 60 * 1000;
    case "weekly":
      return 7 * 24 * 60 * 60 * 1000;
    case "monthly":
      return 30 * 24 * 60 * 60 * 1000;
    case "seasonal":
      return 90 * 24 * 60 * 60 * 1000;
  }
}

function min(xs: number[]) {
  return Math.min(...xs);
}
function max(xs: number[]) {
  return Math.max(...xs);
}
