import type {
  DeviceStatus,
  PlantAnalysisResult,
  PumpCommand,
  TelemetrySample,
  AnalysisRequestMeta,
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
