import type {
  AnalysisRequestMeta,
  AppNotification,
  AuthSession,
  DeviceStatus,
  Farm,
  Field,
  GeoPoint,
  MomoLocale,
  MomoReply,
  PlantAnalysisResult,
  PlatformStatus,
  PumpCommand,
  Recommendation,
  ReportPeriod,
  ReportSummary,
  ServiceAvailability,
  TelemetrySample,
  WeatherInterpretation,
  WeatherSnapshot,
} from "@verdia/contracts";

export interface TelemetryRepository {
  save(sample: TelemetrySample): Promise<void>;
  latest(deviceId: string): Promise<TelemetrySample | null>;
  history(deviceId: string, limit: number): Promise<TelemetrySample[]>;
}

export interface DeviceRepository {
  upsertFromTelemetry(sample: TelemetrySample): Promise<DeviceStatus>;
  get(deviceId: string): Promise<DeviceStatus | null>;
  list(): Promise<DeviceStatus[]>;
  setPump(deviceId: string, pumpOn: boolean): Promise<DeviceStatus | null>;
  enqueueCommand(deviceId: string, command: PumpCommand): Promise<void>;
  consumeCommands(deviceId: string): Promise<PumpCommand[]>;
}

export interface PlantAnalysisPort {
  analyze(
    imageBuffer: Buffer,
    meta: AnalysisRequestMeta,
  ): Promise<PlantAnalysisResult>;
}

export interface AnalysisRepository {
  save(result: PlantAnalysisResult): Promise<void>;
  get(id: string): Promise<PlantAnalysisResult | null>;
  list(limit: number): Promise<PlantAnalysisResult[]>;
}

export interface FarmRepository {
  create(farm: Farm): Promise<Farm>;
  update(id: string, patch: Partial<Omit<Farm, "id" | "createdAt">>): Promise<Farm | null>;
  get(id: string): Promise<Farm | null>;
  list(): Promise<Farm[]>;
  delete(id: string): Promise<boolean>;
}

export interface FieldRepository {
  create(field: Field): Promise<Field>;
  update(id: string, patch: Partial<Omit<Field, "id" | "farmId" | "createdAt">>): Promise<Field | null>;
  get(id: string): Promise<Field | null>;
  listByFarm(farmId: string): Promise<Field[]>;
  list(): Promise<Field[]>;
  delete(id: string): Promise<boolean>;
}

export interface NotificationRepository {
  create(notification: AppNotification): Promise<AppNotification>;
  list(limit: number): Promise<AppNotification[]>;
  markRead(id: string): Promise<AppNotification | null>;
  get(id: string): Promise<AppNotification | null>;
}

export interface SessionRepository {
  save(session: AuthSession): Promise<AuthSession>;
  get(userId: string): Promise<AuthSession | null>;
  delete(userId: string): Promise<boolean>;
}

export interface AuthPort {
  createGuestSession(displayName?: string): Promise<AuthSession>;
  /** Firebase/email providers — may return unavailable until configured. */
  availability(): ServiceAvailability;
  createFirebaseSession?(
    idToken: string,
  ): Promise<AuthSession | { unavailable: ServiceAvailability }>;
}

export interface WeatherPort {
  fetchCurrent(location: GeoPoint): Promise<WeatherSnapshot>;
  availability(): ServiceAvailability;
}

export interface ImageQualityCheckResult {
  ok: boolean;
  reason?: string;
  sharpnessScore?: number;
}

export interface ImageQualityPort {
  check(imageBuffer: Buffer): Promise<ImageQualityCheckResult>;
}

/** Combined quality gate + analyzer. */
export interface VisionPipelinePort {
  qualityCheck(imageBuffer: Buffer): Promise<ImageQualityCheckResult>;
  analyze(
    imageBuffer: Buffer,
    meta: AnalysisRequestMeta,
  ): Promise<PlantAnalysisResult>;
  availability(): ServiceAvailability;
}

export interface RecommendationPort {
  build(input: {
    sensors?: TelemetrySample["sensors"] | null;
    weather?: WeatherInterpretation | null;
    analysis?: PlantAnalysisResult | null;
    crop?: string | null;
    growthStage?: string | null;
  }): Recommendation;
}

export interface ReportPort {
  generate(input: {
    period: ReportPeriod;
    farmId?: string | null;
    deviceId?: string | null;
    telemetry: TelemetrySample[];
    analyses: PlantAnalysisResult[];
    weather?: WeatherInterpretation | null;
  }): ReportSummary;
}

export interface MomoAssistantPort {
  reply(input: {
    question: string;
    locale: MomoLocale;
    sensors?: TelemetrySample["sensors"] | null;
    validatedEvidence?: string[];
    analysis?: PlantAnalysisResult | null;
    recommendation?: Recommendation | null;
    weather?: WeatherInterpretation | null;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
    sessionId?: string;
  }): Promise<MomoReply> | MomoReply;
}

export interface PlatformStatusPort {
  getStatus(): PlatformStatus;
}
