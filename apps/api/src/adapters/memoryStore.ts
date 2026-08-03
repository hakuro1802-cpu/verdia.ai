import { nanoid } from "nanoid";
import type {
  AnalysisRequestMeta,
  AppNotification,
  AuthSession,
  DeviceStatus,
  Farm,
  Field,
  PlantAnalysisResult,
  PumpCommand,
  TelemetrySample,
} from "@verdia/contracts";
import type {
  AnalysisRepository,
  DeviceRepository,
  FarmRepository,
  FieldRepository,
  NotificationRepository,
  SessionRepository,
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

  /** All samples across devices (for reports). */
  async all(limitPerDevice = 200): Promise<TelemetrySample[]> {
    const out: TelemetrySample[] = [];
    for (const deviceId of this.byDevice.keys()) {
      out.push(...(await this.history(deviceId, limitPerDevice)));
    }
    return out.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /** Internal: restore without caps dance — used by file store load. */
  dump(): Record<string, TelemetrySample[]> {
    const out: Record<string, TelemetrySample[]> = {};
    for (const [id, list] of this.byDevice) out[id] = [...list];
    return out;
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
      rssi: existing?.rssi,
      batteryPct: existing?.batteryPct,
      health: existing?.health ?? "healthy",
      farmId: existing?.farmId ?? null,
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

  pendingCommands(): Record<string, PumpCommand[]> {
    const out: Record<string, PumpCommand[]> = {};
    for (const [id, cmds] of this.commands) {
      if (cmds.length) out[id] = [...cmds];
    }
    return out;
  }

  async restoreDevice(status: DeviceStatus): Promise<void> {
    this.devices.set(status.deviceId, status);
  }
}

export class InMemoryAnalysisRepository implements AnalysisRepository {
  private readonly items = new Map<string, PlantAnalysisResult>();
  private readonly order: string[] = [];

  async save(result: PlantAnalysisResult): Promise<void> {
    if (!this.items.has(result.id)) this.order.push(result.id);
    this.items.set(result.id, result);
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

export class InMemoryFarmRepository implements FarmRepository {
  private readonly farms = new Map<string, Farm>();

  async create(farm: Farm): Promise<Farm> {
    this.farms.set(farm.id, farm);
    return farm;
  }

  async update(
    id: string,
    patch: Partial<Omit<Farm, "id" | "createdAt">>,
  ): Promise<Farm | null> {
    const current = this.farms.get(id);
    if (!current) return null;
    const next: Farm = {
      ...current,
      ...patch,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: patch.updatedAt ?? new Date().toISOString(),
    };
    this.farms.set(id, next);
    return next;
  }

  async get(id: string): Promise<Farm | null> {
    return this.farms.get(id) ?? null;
  }

  async list(): Promise<Farm[]> {
    return [...this.farms.values()];
  }

  async delete(id: string): Promise<boolean> {
    return this.farms.delete(id);
  }

  async restore(farm: Farm): Promise<void> {
    this.farms.set(farm.id, farm);
  }
}

export class InMemoryFieldRepository implements FieldRepository {
  private readonly fields = new Map<string, Field>();

  async create(field: Field): Promise<Field> {
    this.fields.set(field.id, field);
    return field;
  }

  async update(
    id: string,
    patch: Partial<Omit<Field, "id" | "farmId" | "createdAt">>,
  ): Promise<Field | null> {
    const current = this.fields.get(id);
    if (!current) return null;
    const next: Field = {
      ...current,
      ...patch,
      id: current.id,
      farmId: current.farmId,
      createdAt: current.createdAt,
      updatedAt: patch.updatedAt ?? new Date().toISOString(),
    };
    this.fields.set(id, next);
    return next;
  }

  async get(id: string): Promise<Field | null> {
    return this.fields.get(id) ?? null;
  }

  async listByFarm(farmId: string): Promise<Field[]> {
    return [...this.fields.values()].filter((f) => f.farmId === farmId);
  }

  async list(): Promise<Field[]> {
    return [...this.fields.values()];
  }

  async delete(id: string): Promise<boolean> {
    return this.fields.delete(id);
  }

  async restore(field: Field): Promise<void> {
    this.fields.set(field.id, field);
  }
}

export class InMemoryNotificationRepository implements NotificationRepository {
  private readonly items = new Map<string, AppNotification>();
  private readonly order: string[] = [];

  async create(notification: AppNotification): Promise<AppNotification> {
    this.items.set(notification.id, notification);
    this.order.push(notification.id);
    return notification;
  }

  async list(limit: number): Promise<AppNotification[]> {
    return this.order
      .slice(-limit)
      .reverse()
      .map((id) => this.items.get(id)!)
      .filter(Boolean);
  }

  async markRead(id: string): Promise<AppNotification | null> {
    const current = this.items.get(id);
    if (!current) return null;
    const next = { ...current, read: true };
    this.items.set(id, next);
    return next;
  }

  async get(id: string): Promise<AppNotification | null> {
    return this.items.get(id) ?? null;
  }

  async restore(n: AppNotification): Promise<void> {
    if (!this.items.has(n.id)) this.order.push(n.id);
    this.items.set(n.id, n);
  }
}

export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, AuthSession>();

  async save(session: AuthSession): Promise<AuthSession> {
    this.sessions.set(session.userId, session);
    return session;
  }

  async get(userId: string): Promise<AuthSession | null> {
    return this.sessions.get(userId) ?? null;
  }

  async delete(userId: string): Promise<boolean> {
    return this.sessions.delete(userId);
  }

  async list(): Promise<AuthSession[]> {
    return [...this.sessions.values()];
  }

  async restore(session: AuthSession): Promise<void> {
    this.sessions.set(session.userId, session);
  }
}

/** Convenience factory for a new farm entity. */
export function newFarm(input: {
  name: string;
  locationLabel?: string | null;
  geo?: Farm["geo"];
  metadata?: Record<string, string>;
}): Farm {
  const now = new Date().toISOString();
  return {
    id: `farm_${nanoid(10)}`,
    name: input.name,
    locationLabel: input.locationLabel ?? null,
    geo: input.geo ?? null,
    createdAt: now,
    updatedAt: now,
    metadata: input.metadata ?? {},
  };
}

export function newField(input: {
  farmId: string;
  name: string;
  crop?: string | null;
  growthStage?: string | null;
}): Field {
  const now = new Date().toISOString();
  return {
    id: `field_${nanoid(10)}`,
    farmId: input.farmId,
    name: input.name,
    crop: input.crop ?? null,
    growthStage: input.growthStage ?? null,
    irrigationZoneIds: [],
    createdAt: now,
    updatedAt: now,
    history: [],
  };
}

export type { AnalysisRequestMeta };
