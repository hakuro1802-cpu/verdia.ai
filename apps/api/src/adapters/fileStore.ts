import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
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
import {
  InMemoryAnalysisRepository,
  InMemoryDeviceRepository,
  InMemoryFarmRepository,
  InMemoryFieldRepository,
  InMemoryNotificationRepository,
  InMemorySessionRepository,
  InMemoryTelemetryRepository,
} from "./memoryStore.js";

type Snapshot = {
  telemetry: Record<string, TelemetrySample[]>;
  devices: DeviceStatus[];
  commands: Record<string, PumpCommand[]>;
  analyses: PlantAnalysisResult[];
  farms: Farm[];
  fields: Field[];
  notifications: AppNotification[];
  sessions: AuthSession[];
};

/**
 * File-backed persistence wrapping the in-memory repositories.
 * Keeps the same ports; durable enough for demo/single-node production.
 */
export class FileBackedStore {
  readonly telemetry: TelemetryRepository;
  readonly devices: DeviceRepository;
  readonly analyses: AnalysisRepository;
  readonly farms: FarmRepository;
  readonly fields: FieldRepository;
  readonly notifications: NotificationRepository;
  readonly sessions: SessionRepository;

  private readonly memTelemetry = new InMemoryTelemetryRepository();
  private readonly memDevices = new InMemoryDeviceRepository();
  private readonly memAnalyses = new InMemoryAnalysisRepository();
  private readonly memFarms = new InMemoryFarmRepository();
  private readonly memFields = new InMemoryFieldRepository();
  private readonly memNotifications = new InMemoryNotificationRepository();
  private readonly memSessions = new InMemorySessionRepository();
  private readonly filePath: string;
  private writeTimer: NodeJS.Timeout | null = null;
  private ready = false;

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, "store.json");

    this.telemetry = {
      save: async (sample) => {
        await this.memTelemetry.save(sample);
        this.schedulePersist();
      },
      latest: (id) => this.memTelemetry.latest(id),
      history: (id, limit) => this.memTelemetry.history(id, limit),
    };

    this.devices = {
      upsertFromTelemetry: async (sample) => {
        const status = await this.memDevices.upsertFromTelemetry(sample);
        this.schedulePersist();
        return status;
      },
      get: (id) => this.memDevices.get(id),
      list: () => this.memDevices.list(),
      setPump: async (id, on) => {
        const status = await this.memDevices.setPump(id, on);
        this.schedulePersist();
        return status;
      },
      enqueueCommand: async (id, cmd) => {
        await this.memDevices.enqueueCommand(id, cmd);
        this.schedulePersist();
      },
      consumeCommands: async (id) => {
        const cmds = await this.memDevices.consumeCommands(id);
        this.schedulePersist();
        return cmds;
      },
    };

    this.analyses = {
      save: async (result) => {
        await this.memAnalyses.save(result);
        this.schedulePersist();
      },
      get: (id) => this.memAnalyses.get(id),
      list: (limit) => this.memAnalyses.list(limit),
    };

    this.farms = {
      create: async (farm) => {
        const created = await this.memFarms.create(farm);
        this.schedulePersist();
        return created;
      },
      update: async (id, patch) => {
        const updated = await this.memFarms.update(id, patch);
        this.schedulePersist();
        return updated;
      },
      get: (id) => this.memFarms.get(id),
      list: () => this.memFarms.list(),
      delete: async (id) => {
        const ok = await this.memFarms.delete(id);
        this.schedulePersist();
        return ok;
      },
    };

    this.fields = {
      create: async (field) => {
        const created = await this.memFields.create(field);
        this.schedulePersist();
        return created;
      },
      update: async (id, patch) => {
        const updated = await this.memFields.update(id, patch);
        this.schedulePersist();
        return updated;
      },
      get: (id) => this.memFields.get(id),
      listByFarm: (farmId) => this.memFields.listByFarm(farmId),
      list: () => this.memFields.list(),
      delete: async (id) => {
        const ok = await this.memFields.delete(id);
        this.schedulePersist();
        return ok;
      },
    };

    this.notifications = {
      create: async (n) => {
        const created = await this.memNotifications.create(n);
        this.schedulePersist();
        return created;
      },
      list: (limit) => this.memNotifications.list(limit),
      markRead: async (id) => {
        const updated = await this.memNotifications.markRead(id);
        this.schedulePersist();
        return updated;
      },
      get: (id) => this.memNotifications.get(id),
    };

    this.sessions = {
      save: async (session) => {
        const saved = await this.memSessions.save(session);
        this.schedulePersist();
        return saved;
      },
      get: (userId) => this.memSessions.get(userId),
      delete: async (userId) => {
        const ok = await this.memSessions.delete(userId);
        this.schedulePersist();
        return ok;
      },
    };
  }

  /** Expose memory telemetry for report aggregation. */
  get telemetryMem(): InMemoryTelemetryRepository {
    return this.memTelemetry;
  }

  async load(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const raw = await readFile(this.filePath, "utf8");
      const snap = JSON.parse(raw) as Snapshot;
      for (const samples of Object.values(snap.telemetry ?? {})) {
        for (const sample of samples) {
          await this.memTelemetry.save(sample);
          await this.memDevices.upsertFromTelemetry(sample);
        }
      }
      for (const device of snap.devices ?? []) {
        await this.memDevices.restoreDevice(device);
      }
      for (const [deviceId, cmds] of Object.entries(snap.commands ?? {})) {
        for (const cmd of cmds) {
          await this.memDevices.enqueueCommand(deviceId, cmd);
        }
      }
      for (const analysis of snap.analyses ?? []) {
        await this.memAnalyses.save(analysis);
      }
      for (const farm of snap.farms ?? []) {
        await this.memFarms.restore(farm);
      }
      for (const field of snap.fields ?? []) {
        await this.memFields.restore(field);
      }
      for (const n of snap.notifications ?? []) {
        await this.memNotifications.restore(n);
      }
      for (const s of snap.sessions ?? []) {
        await this.memSessions.restore(s);
      }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw err;
    }
    this.ready = true;
  }

  private schedulePersist() {
    if (!this.ready) return;
    if (this.writeTimer) clearTimeout(this.writeTimer);
    this.writeTimer = setTimeout(() => {
      void this.persist();
    }, 250);
  }

  private async persist() {
    const devices = await this.memDevices.list();
    const telemetry: Record<string, TelemetrySample[]> = this.memTelemetry.dump();
    const analyses = await this.memAnalyses.list(200);
    const commands = this.memDevices.pendingCommands();
    const farms = await this.memFarms.list();
    const fields = await this.memFields.list();
    const notifications = await this.memNotifications.list(200);
    const sessions = await this.memSessions.list();

    const snap: Snapshot = {
      telemetry,
      devices,
      commands,
      analyses,
      farms,
      fields,
      notifications,
      sessions,
    };
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(snap), "utf8");
  }
}
