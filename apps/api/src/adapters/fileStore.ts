import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
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
import {
  InMemoryAnalysisRepository,
  InMemoryDeviceRepository,
  InMemoryTelemetryRepository,
} from "./memoryStore.js";

type Snapshot = {
  telemetry: Record<string, TelemetrySample[]>;
  devices: DeviceStatus[];
  commands: Record<string, PumpCommand[]>;
  analyses: PlantAnalysisResult[];
};

/**
 * File-backed persistence wrapping the in-memory repositories.
 * Keeps the same ports; durable enough for demo/single-node production.
 */
export class FileBackedStore {
  readonly telemetry: TelemetryRepository;
  readonly devices: DeviceRepository;
  readonly analyses: AnalysisRepository;

  private readonly memTelemetry = new InMemoryTelemetryRepository();
  private readonly memDevices = new InMemoryDeviceRepository();
  private readonly memAnalyses = new InMemoryAnalysisRepository();
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
        // restore pump/online if telemetry missed
        if (!(await this.memDevices.get(device.deviceId))) {
          await this.memDevices.enqueueCommand(device.deviceId, {
            action: device.pumpOn ? "on" : "off",
            source: "api",
          });
          await this.memDevices.consumeCommands(device.deviceId);
          await this.memDevices.setPump(device.deviceId, device.pumpOn);
        }
      }
      for (const [deviceId, cmds] of Object.entries(snap.commands ?? {})) {
        for (const cmd of cmds) {
          await this.memDevices.enqueueCommand(deviceId, cmd);
        }
      }
      for (const analysis of snap.analyses ?? []) {
        await this.memAnalyses.save(analysis);
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
    const telemetry: Record<string, TelemetrySample[]> = {};
    for (const d of devices) {
      telemetry[d.deviceId] = await this.memTelemetry.history(d.deviceId, 500);
    }
    // Also include devices that only have telemetry
    // (already covered via device upsert on ingest)

    const analyses = await this.memAnalyses.list(100);
    const commands: Record<string, PumpCommand[]> = {};
    // pending commands are consumed; nothing to dump unless we expose them —
    // leave empty; in-flight cmds are short-lived

    const snap: Snapshot = { telemetry, devices, commands, analyses };
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(snap), "utf8");
  }
}
