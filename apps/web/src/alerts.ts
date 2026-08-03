import type { SensorReading, TelemetrySample } from "@verdia/contracts";

export type AlertLevel = "info" | "warn" | "danger";

export type Alert = {
  id: string;
  level: AlertLevel;
  title: string;
  detail: string;
};

export function buildAlerts(
  sensors: SensorReading | null,
  latest: TelemetrySample | null,
): Alert[] {
  if (!sensors) return [];
  const alerts: Alert[] = [];

  if (sensors.soilMoisturePct != null && sensors.soilMoisturePct < 30) {
    alerts.push({
      id: "moisture-low",
      level: "warn",
      title: "Soil drying out",
      detail: `Moisture at ${sensors.soilMoisturePct}% — edge policy will water when below threshold.`,
    });
  }
  if (sensors.waterLevelPct != null && sensors.waterLevelPct < 20) {
    alerts.push({
      id: "tank-low",
      level: "danger",
      title: "Water tank low",
      detail: `Tank at ${sensors.waterLevelPct}% — pump is blocked until refilled.`,
    });
  }
  if (sensors.soilPh != null && (sensors.soilPh < 5.5 || sensors.soilPh > 7.5)) {
    alerts.push({
      id: "ph-band",
      level: "warn",
      title: "pH outside comfort band",
      detail: `Reported pH ${sensors.soilPh}. Confirm with a fresh buffer calibration.`,
    });
  }
  if (sensors.temperatureC != null && sensors.temperatureC > 32) {
    alerts.push({
      id: "hot",
      level: "warn",
      title: "High temperature",
      detail: `${sensors.temperatureC.toFixed(1)}°C ambient — watch for heat stress.`,
    });
  }
  if (latest?.irrigationReason === "water_tank_low") {
    alerts.push({
      id: "edge-block",
      level: "danger",
      title: "Edge blocked irrigation",
      detail: "ESP32 refused to run the pump because the tank is too low.",
    });
  }
  return alerts;
}
