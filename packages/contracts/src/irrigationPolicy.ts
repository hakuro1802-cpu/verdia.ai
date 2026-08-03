import type { IrrigationThresholds, SensorReading } from "./types.js";
import { DEFAULT_IRRIGATION_THRESHOLDS } from "./types.js";

export interface IrrigationDecision {
  pumpOn: boolean;
  reason: string;
}

/**
 * Pure edge irrigation policy. Must remain usable offline on ESP32 (ported) and in tests.
 * Does not depend on cloud connectivity.
 */
export function decideIrrigation(
  sensors: Pick<SensorReading, "soilMoisturePct" | "waterLevelPct">,
  currentlyOn: boolean,
  thresholds: IrrigationThresholds = DEFAULT_IRRIGATION_THRESHOLDS,
): IrrigationDecision {
  const moisture = sensors.soilMoisturePct;
  const water = sensors.waterLevelPct;

  if (moisture == null) {
    return { pumpOn: false, reason: "moisture_unavailable" };
  }

  if (water != null && water < thresholds.minWaterLevelPct) {
    return { pumpOn: false, reason: "water_tank_low" };
  }

  if (!currentlyOn && moisture < thresholds.moistureLowPct) {
    return { pumpOn: true, reason: "moisture_below_low_threshold" };
  }

  if (currentlyOn && moisture > thresholds.moistureHighPct) {
    return { pumpOn: false, reason: "moisture_above_high_threshold" };
  }

  if (currentlyOn) {
    return { pumpOn: true, reason: "hysteresis_hold_on" };
  }

  return { pumpOn: false, reason: "moisture_in_band" };
}

/** Reject physically implausible DHT-like spikes. */
export function sanitizeDht(
  temperatureC: number | null,
  humidityPct: number | null,
): { temperatureC: number | null; humidityPct: number | null } {
  const tempOk =
    temperatureC != null && temperatureC >= -40 && temperatureC <= 80
      ? temperatureC
      : null;
  const humOk =
    humidityPct != null && humidityPct >= 0 && humidityPct <= 100
      ? humidityPct
      : null;
  return { temperatureC: tempOk, humidityPct: humOk };
}

/** Simple exponential moving average for ADC noise reduction. */
export function ema(previous: number | null, next: number, alpha = 0.3): number {
  if (previous == null) return next;
  return alpha * next + (1 - alpha) * previous;
}
