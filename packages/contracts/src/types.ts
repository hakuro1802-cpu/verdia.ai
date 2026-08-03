/** Shared domain contracts for VERDIA.AI / momo.ai */

export type DeviceId = string;
export type FarmId = string;
export type FieldId = string;
export type UserId = string;

/** Live never fabricates. Demo is explicit and labeled. */
export type AppMode = "live" | "demo";

export type ServiceAvailability =
  | { status: "available" }
  | { status: "unavailable"; reason: string; code: string }
  | { status: "degraded"; reason: string; code: string };

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface SensorReading {
  temperatureC: number | null;
  humidityPct: number | null;
  soilMoisturePct: number | null;
  soilMoistureRaw: number | null;
  soilPh: number | null;
  soilPhRaw: number | null;
  waterLevelPct: number | null;
  waterLevelRaw: number | null;
  /** Optional future sensors */
  lightLux?: number | null;
  rainMm?: number | null;
}

export type SensorKind =
  | "temperatureC"
  | "humidityPct"
  | "soilMoisturePct"
  | "soilPh"
  | "waterLevelPct"
  | "lightLux"
  | "rainMm";

export type ReadingStatus = "ok" | "stale" | "invalid" | "missing" | "offline";

export interface ValidatedSensorValue {
  kind: SensorKind;
  value: number | null;
  unit: string;
  timestamp: string;
  confidence: number;
  status: ReadingStatus;
  rejectionReason?: string;
}

export interface TelemetrySample {
  timestamp: string;
  deviceId: DeviceId;
  gps?: GeoPoint | null;
  sensors: SensorReading;
  pumpOn: boolean;
  irrigationReason?: string;
}

export interface DeviceStatus {
  deviceId: DeviceId;
  online: boolean;
  lastSeenAt: string | null;
  pumpOn: boolean;
  network: "wifi" | "phone-gateway" | "offline" | "unknown";
  firmwareVersion?: string;
  rssi?: number | null;
  batteryPct?: number | null;
  health?: "healthy" | "degraded" | "critical" | "unknown";
  farmId?: FarmId | null;
}

export type PumpCommand = {
  action: "on" | "off" | "pulse";
  durationMs?: number;
  source: "edge" | "app" | "api";
};

export interface AnalysisRequestMeta {
  deviceId: DeviceId;
  timestamp: string;
  gps?: GeoPoint | null;
  sensors?: Partial<SensorReading> | null;
  consentLocation: boolean;
  consentImage: boolean;
  analysisType?: AnalysisType;
}

export type AnalysisType =
  | "leaf"
  | "plant"
  | "soil"
  | "root"
  | "fruit"
  | "flower"
  | "seed"
  | "weed"
  | "pest";

export interface PlantAnalysisResult {
  id: string;
  createdAt: string;
  provider: "mock-verdia" | "verdia" | "unavailable";
  analysisType?: AnalysisType;
  plantName: string | null;
  health: "healthy" | "attention" | "critical" | "unknown";
  diagnosis: string;
  careTips: string[];
  confidence: number;
  isMock: boolean;
  rejected?: boolean;
  rejectionReason?: string;
  evidence?: string[];
}

export interface IrrigationThresholds {
  moistureLowPct: number;
  moistureHighPct: number;
  minWaterLevelPct: number;
}

export const DEFAULT_IRRIGATION_THRESHOLDS: IrrigationThresholds = {
  moistureLowPct: 35,
  moistureHighPct: 55,
  minWaterLevelPct: 15,
};

/* —— Auth —— */

export type AuthProvider = "email" | "google" | "guest" | "firebase-session";

export interface AuthSession {
  userId: UserId;
  displayName: string;
  email: string | null;
  provider: AuthProvider;
  emailVerified: boolean;
  isGuest: boolean;
  createdAt: string;
  expiresAt: string | null;
}

/* —— Farms —— */

export interface Farm {
  id: FarmId;
  name: string;
  locationLabel: string | null;
  geo: GeoPoint | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, string>;
}

export interface Field {
  id: FieldId;
  farmId: FarmId;
  name: string;
  crop: string | null;
  growthStage: string | null;
  irrigationZoneIds: string[];
  createdAt: string;
  updatedAt: string;
  history: Array<{ at: string; note: string; crop?: string | null }>;
}

export interface IrrigationZone {
  id: string;
  farmId: FarmId;
  fieldId: FieldId | null;
  name: string;
  deviceIds: DeviceId[];
}

/* —— Recommendations —— */

export interface Recommendation {
  id: string;
  createdAt: string;
  summary: string;
  evidence: string[];
  scientificExplanation: string;
  confidence: number;
  primary: string;
  alternative: string | null;
  organicMethod: string | null;
  conventionalMethod: string | null;
  preventiveAdvice: string | null;
  expectedOutcome: string | null;
  potentialRisks: string[];
  sources: string[];
  unavailableReason?: string;
}

/* —— Weather —— */

export interface WeatherSnapshot {
  fetchedAt: string;
  location: GeoPoint;
  temperatureC: number;
  humidityPct: number;
  precipitationProbabilityPct: number | null;
  windSpeedMs: number | null;
  conditionLabel: string;
}

export interface WeatherInterpretation {
  weather: WeatherSnapshot;
  impacts: Array<{
    signal: string;
    agriculturalImpact: string;
    suggestedAction: string;
  }>;
}

/* —— Notifications —— */

export type NotificationKind =
  | "low_moisture"
  | "high_temperature"
  | "device_offline"
  | "pump_activated"
  | "analysis_completed"
  | "firmware_update"
  | "sync_complete"
  | "system";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  relatedId?: string;
}

/* —— Reports —— */

export type ReportPeriod = "daily" | "weekly" | "monthly" | "seasonal";

export interface ReportSummary {
  id: string;
  period: ReportPeriod;
  generatedAt: string;
  farmId: FarmId | null;
  deviceId: DeviceId | null;
  sections: Array<{ title: string; facts: string[] }>;
  dataPointsUsed: number;
  note: string;
}

/* —— momo.ai —— */

export type MomoLocale = "en" | "ta";

export interface MomoMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  locale: MomoLocale;
  confidence: number | null;
  evidenceIds: string[];
  createdAt: string;
  uncertain?: boolean;
}

export interface MomoReply {
  message: MomoMessage;
  availability: ServiceAvailability;
}

/* —— Dashboard aggregate —— */

export interface DashboardCard<T> {
  id: string;
  title: string;
  state: "loading" | "ready" | "empty" | "error" | "offline" | "unavailable";
  updatedAt: string | null;
  error?: string;
  data: T | null;
}

export interface PlatformStatus {
  mode: AppMode;
  brand: "verdia.ai";
  assistant: "momo.ai";
  firebaseConfigured: boolean;
  weatherConfigured: boolean;
  visionConfigured: boolean;
  simulatorActive: boolean;
  services: Record<string, ServiceAvailability>;
}
