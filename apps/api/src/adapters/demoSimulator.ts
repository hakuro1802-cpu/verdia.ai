import { decideIrrigation } from "@verdia/contracts";
import type { TelemetrySample } from "@verdia/contracts";
import type { IngestTelemetry } from "../application/useCases.js";

/**
 * Demo plant simulator so the UI works without a physical ESP32.
 * Disable with VERDIA_SIMULATOR=0.
 */
export function startDemoSimulator(
  ingest: IngestTelemetry,
  deviceId: string,
  intervalMs = 4000,
): NodeJS.Timeout {
  let pumpOn = false;
  let moisture = 42;
  let t = 0;

  return setInterval(async () => {
    t += 1;
    // Slow dry-down; wetter when pump on
    moisture += pumpOn ? 2.2 : -0.8;
    moisture += Math.sin(t / 7) * 0.4;
    moisture = Math.max(12, Math.min(88, moisture));

    const waterLevelPct = 55 + Math.sin(t / 20) * 10;
    const decision = decideIrrigation(
      { soilMoisturePct: moisture, waterLevelPct },
      pumpOn,
    );
    pumpOn = decision.pumpOn;

    const sample: TelemetrySample = {
      timestamp: new Date().toISOString(),
      deviceId,
      gps: null,
      sensors: {
        temperatureC: 23.5 + Math.sin(t / 15) * 1.5,
        humidityPct: 55 + Math.cos(t / 12) * 8,
        soilMoisturePct: Number(moisture.toFixed(1)),
        soilMoistureRaw: Math.round(2800 - moisture * 18),
        soilPh: Number((6.4 + Math.sin(t / 40) * 0.15).toFixed(2)),
        soilPhRaw: 1800,
        waterLevelPct: Number(waterLevelPct.toFixed(1)),
        waterLevelRaw: Math.round(waterLevelPct * 30),
      },
      pumpOn,
      irrigationReason: decision.reason,
    };

    try {
      await ingest.execute(sample);
    } catch (err) {
      console.error("[simulator] ingest failed", err);
    }
  }, intervalMs);
}
