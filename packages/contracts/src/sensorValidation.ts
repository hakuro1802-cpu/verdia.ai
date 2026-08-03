import type { SensorKind, SensorReading, ValidatedSensorValue } from "./types.js";

/** Physical sanity bounds — reject impossible values rather than display them. */
const BOUNDS: Record<
  SensorKind,
  { min: number; max: number; unit: string; label: string }
> = {
  temperatureC: { min: -40, max: 85, unit: "°C", label: "Temperature" },
  humidityPct: { min: 0, max: 100, unit: "%RH", label: "Humidity" },
  soilMoisturePct: { min: 0, max: 100, unit: "%", label: "Soil moisture" },
  soilPh: { min: 0, max: 14, unit: "pH", label: "Soil pH" },
  waterLevelPct: { min: 0, max: 100, unit: "%", label: "Water level" },
  lightLux: { min: 0, max: 200000, unit: "lx", label: "Light" },
  rainMm: { min: 0, max: 500, unit: "mm", label: "Rain" },
};

const STALE_MS = 15 * 60 * 1000;

function readingFor(
  sensors: SensorReading,
  kind: SensorKind,
): number | null | undefined {
  switch (kind) {
    case "temperatureC":
      return sensors.temperatureC;
    case "humidityPct":
      return sensors.humidityPct;
    case "soilMoisturePct":
      return sensors.soilMoisturePct;
    case "soilPh":
      return sensors.soilPh;
    case "waterLevelPct":
      return sensors.waterLevelPct;
    case "lightLux":
      return sensors.lightLux ?? null;
    case "rainMm":
      return sensors.rainMm ?? null;
  }
}

export function validateSensorValue(
  kind: SensorKind,
  value: number | null | undefined,
  timestamp: string,
  nowMs = Date.now(),
): ValidatedSensorValue {
  const bound = BOUNDS[kind];
  const base = {
    kind,
    unit: bound.unit,
    timestamp,
    confidence: 0,
    status: "missing" as const,
    value: null as number | null,
  };

  if (value === null || value === undefined || Number.isNaN(value)) {
    return { ...base, status: "missing", confidence: 0 };
  }

  if (!Number.isFinite(value) || value < bound.min || value > bound.max) {
    return {
      ...base,
      status: "invalid",
      confidence: 0,
      rejectionReason: `${bound.label} ${value} outside ${bound.min}–${bound.max} ${bound.unit}`,
    };
  }

  const age = nowMs - Date.parse(timestamp);
  if (Number.isFinite(age) && age > STALE_MS) {
    return {
      kind,
      value,
      unit: bound.unit,
      timestamp,
      confidence: 0.4,
      status: "stale",
      rejectionReason: `Reading older than ${STALE_MS / 60000} minutes`,
    };
  }

  return {
    kind,
    value,
    unit: bound.unit,
    timestamp,
    confidence: 0.9,
    status: "ok",
  };
}

export function validateSensorReading(
  sensors: SensorReading,
  timestamp: string,
  nowMs = Date.now(),
): ValidatedSensorValue[] {
  const kinds = Object.keys(BOUNDS) as SensorKind[];
  return kinds.map((kind) =>
    validateSensorValue(kind, readingFor(sensors, kind), timestamp, nowMs),
  );
}

/** Strip invalid fields from a reading before persistence/display. */
export function sanitizeSensorReading(sensors: SensorReading, timestamp: string): SensorReading {
  const validated = validateSensorReading(sensors, timestamp);
  const byKind = Object.fromEntries(validated.map((v) => [v.kind, v])) as Record<
    SensorKind,
    ValidatedSensorValue
  >;

  const pick = (kind: SensorKind, raw: number | null | undefined) =>
    byKind[kind].status === "invalid" ? null : (raw ?? null);

  return {
    temperatureC: pick("temperatureC", sensors.temperatureC),
    humidityPct: pick("humidityPct", sensors.humidityPct),
    soilMoisturePct: pick("soilMoisturePct", sensors.soilMoisturePct),
    soilMoistureRaw: sensors.soilMoistureRaw,
    soilPh: pick("soilPh", sensors.soilPh),
    soilPhRaw: sensors.soilPhRaw,
    waterLevelPct: pick("waterLevelPct", sensors.waterLevelPct),
    waterLevelRaw: sensors.waterLevelRaw,
    lightLux: pick("lightLux", sensors.lightLux),
    rainMm: pick("rainMm", sensors.rainMm),
  };
}
