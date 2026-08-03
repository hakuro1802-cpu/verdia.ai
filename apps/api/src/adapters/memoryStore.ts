import type {
  AnalysisRequestMeta,
  DeviceStatus,
  PlantAnalysisResult,
  PumpCommand,
  TelemetrySample,
} from "@verdia/contracts";
import type {
  AnalysisRepository,
  DeviceRepository,
  TelemetryRepository,
} from "../domain/ports.js";

const HISTORY_CAP = 500;

export class InMemoryTelemetryRepository implements TelemetryRepository {
  private readonly byDevice = new Map<string, TelemetrySample[]>();

  async save(sample: TelemetrySample): Promise<void> {
    const list = this.byDevice.get(sample.deviceId) ?? [];
    list.push(sample);
    if (list.length > HISTORY_CAP) list.splice(0, list.length - HISTORY_CAP);
    this.byDevice.set(sample.deviceId, list);
  }

  async latest(deviceId: string): Promise<TelemetrySample | null> {
    const list = this.byDevice.get(deviceId);
    return list?.length ? list[list.length - 1]! : null;
  }

  async history(deviceId: string, limit: number): Promise<TelemetrySample[]> {
    const list = this.byDevice.get(deviceId) ?? [];
    return list.slice(-Math.max(1, Math.min(limit, HISTORY_CAP)));
  }
}

export class InMemoryDeviceRepository implements DeviceRepository {
  private readonly devices = new Map<string, DeviceStatus>();
  private readonly commands = new Map<string, PumpCommand[]>();

  async upsertFromTelemetry(sample: TelemetrySample): Promise<DeviceStatus> {
    const existing = this.devices.get(sample.deviceId);
    const status: DeviceStatus = {
      deviceId: sample.deviceId,
      online: true,
      lastSeenAt: sample.timestamp,
      pumpOn: sample.pumpOn,
      network: existing?.network ?? "wifi",
      firmwareVersion: existing?.firmwareVersion,
    };
    this.devices.set(sample.deviceId, status);
    return status;
  }

  async get(deviceId: string): Promise<DeviceStatus | null> {
    return this.devices.get(deviceId) ?? null;
  }

  async list(): Promise<DeviceStatus[]> {
    return [...this.devices.values()];
  }

  async setPump(deviceId: string, pumpOn: boolean): Promise<DeviceStatus | null> {
    const current = this.devices.get(deviceId);
    if (!current) return null;
    const next = { ...current, pumpOn };
    this.devices.set(deviceId, next);
    return next;
  }

  async enqueueCommand(deviceId: string, command: PumpCommand): Promise<void> {
    const q = this.commands.get(deviceId) ?? [];
    q.push(command);
    this.commands.set(deviceId, q);
    if (!this.devices.has(deviceId)) {
      this.devices.set(deviceId, {
        deviceId,
        online: false,
        lastSeenAt: null,
        pumpOn: command.action === "on",
        network: "unknown",
      });
    }
  }

  async consumeCommands(deviceId: string): Promise<PumpCommand[]> {
    const q = this.commands.get(deviceId) ?? [];
    this.commands.set(deviceId, []);
    return q;
  }
}

export class InMemoryAnalysisRepository implements AnalysisRepository {
  private readonly items = new Map<string, PlantAnalysisResult>();
  private readonly order: string[] = [];

  async save(result: PlantAnalysisResult): Promise<void> {
    this.items.set(result.id, result);
    this.order.push(result.id);
  }

  async get(id: string): Promise<PlantAnalysisResult | null> {
    return this.items.get(id) ?? null;
  }

  async list(limit: number): Promise<PlantAnalysisResult[]> {
    return this.order
      .slice(-limit)
      .reverse()
      .map((id) => this.items.get(id)!)
      .filter(Boolean);
  }
}

export type { AnalysisRequestMeta };
