/** Shared domain contracts for Verdia AI plant monitoring. */

export type DeviceId = string;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface SensorReading {
  temperatureC: number | null;
  humidityPct: number | null;
  /** Calibrated volumetric or percent moisture when available; else raw-mapped placeholder. */
  soilMoisturePct: number | null;
  /** Raw ADC retained for calibration workflows. */
  soilMoistureRaw: number | null;
  soilPh: number | null;
  soilPhRaw: number | null;
  waterLevelPct: number | null;
  waterLevelRaw: number | null;
}

export interface TelemetrySample {
  timestamp: string;
  deviceId: DeviceId;
  gps?: GeoPoint | null;
  sensors: SensorReading;
  pumpOn: boolean;
  /** Edge-computed decision reason for observability. */
  irrigationReason?: string;
}

export interface DeviceStatus {
  deviceId: DeviceId;
  online: boolean;
  lastSeenAt: string | null;
  pumpOn: boolean;
  network: "wifi" | "phone-gateway" | "offline" | "unknown";
  firmwareVersion?: string;
}

export type PumpCommand = {
  action: "on" | "off" | "pulse";
  /** Pulse duration in ms when action is pulse. */
  durationMs?: number;
  source: "edge" | "app" | "api";
};

export interface AnalysisRequestMeta {
  deviceId: DeviceId;
  timestamp: string;
  gps?: GeoPoint | null;
  sensors?: Partial<SensorReading> | null;
  /** Explicit consent flag for location/image upload. */
  consentLocation: boolean;
  consentImage: boolean;
}

export interface PlantAnalysisResult {
  id: string;
  createdAt: string;
  provider: "mock-verdia" | "verdia";
  plantName: string | null;
  health: "healthy" | "attention" | "critical" | "unknown";
  diagnosis: string;
  careTips: string[];
  confidence: number;
  /** True when result is from the mock adapter (no public Verdia API). */
  isMock: boolean;
}

export interface IrrigationThresholds {
  /** Water when moisture falls below this percent. */
  moistureLowPct: number;
  /** Stop when moisture rises above this percent (hysteresis). */
  moistureHighPct: number;
  /** Block pump if tank below this percent. */
  minWaterLevelPct: number;
}

export const DEFAULT_IRRIGATION_THRESHOLDS: IrrigationThresholds = {
  moistureLowPct: 35,
  moistureHighPct: 55,
  minWaterLevelPct: 15,
};
