import type { TelemetrySample, PumpCommand, AnalysisRequestMeta } from "@verdia/contracts";
import type {
  AnalysisRepository,
  DeviceRepository,
  PlantAnalysisPort,
  TelemetryRepository,
} from "../domain/ports.js";

export class IngestTelemetry {
  constructor(
    private readonly telemetry: TelemetryRepository,
    private readonly devices: DeviceRepository,
  ) {}

  async execute(sample: TelemetrySample) {
    await this.telemetry.save(sample);
    const status = await this.devices.upsertFromTelemetry(sample);
    return { sample, status };
  }
}

export class GetDeviceDashboard {
  constructor(
    private readonly telemetry: TelemetryRepository,
    private readonly devices: DeviceRepository,
  ) {}

  async execute(deviceId: string, historyLimit = 60) {
    const [status, latest, history] = await Promise.all([
      this.devices.get(deviceId),
      this.telemetry.latest(deviceId),
      this.telemetry.history(deviceId, historyLimit),
    ]);
    return { status, latest, history };
  }
}

export class RequestPumpCommand {
  constructor(private readonly devices: DeviceRepository) {}

  async execute(deviceId: string, command: PumpCommand) {
    await this.devices.enqueueCommand(deviceId, command);
    if (command.action === "on") await this.devices.setPump(deviceId, true);
    if (command.action === "off") await this.devices.setPump(deviceId, false);
    return this.devices.get(deviceId);
  }
}

export class AnalyzePlantImage {
  constructor(
    private readonly analyzer: PlantAnalysisPort,
    private readonly analyses: AnalysisRepository,
  ) {}

  async execute(image: Buffer, meta: AnalysisRequestMeta) {
    const result = await this.analyzer.analyze(image, meta);
    await this.analyses.save(result);
    return result;
  }
}

export class PollDeviceCommands {
  constructor(private readonly devices: DeviceRepository) {}

  async execute(deviceId: string) {
    return this.devices.consumeCommands(deviceId);
  }
}
