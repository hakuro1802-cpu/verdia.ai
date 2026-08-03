import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideIrrigation } from "@verdia/contracts";
import { MockVerdiaAnalyzer } from "../adapters/mockVerdiaAnalyzer.ts";
import {
  InMemoryAnalysisRepository,
  InMemoryDeviceRepository,
  InMemoryTelemetryRepository,
} from "../adapters/memoryStore.ts";
import {
  AnalyzePlantImage,
  IngestTelemetry,
  RequestPumpCommand,
} from "./useCases.ts";

describe("IngestTelemetry", () => {
  it("stores sample and updates device", async () => {
    const telemetry = new InMemoryTelemetryRepository();
    const devices = new InMemoryDeviceRepository();
    const ingest = new IngestTelemetry(telemetry, devices);
    const decision = decideIrrigation(
      { soilMoisturePct: 20, waterLevelPct: 70 },
      false,
    );

    const result = await ingest.execute({
      timestamp: new Date().toISOString(),
      deviceId: "ESP32_001",
      sensors: {
        temperatureC: 24,
        humidityPct: 50,
        soilMoisturePct: 20,
        soilMoistureRaw: 2400,
        soilPh: 6.5,
        soilPhRaw: 1700,
        waterLevelPct: 70,
        waterLevelRaw: 2100,
      },
      pumpOn: decision.pumpOn,
      irrigationReason: decision.reason,
    });

    assert.equal(result.status.deviceId, "ESP32_001");
    assert.equal(result.status.online, true);
    const latest = await telemetry.latest("ESP32_001");
    assert.ok(latest);
    assert.equal(latest!.sensors.soilMoisturePct, 20);
  });
});

describe("MockVerdiaAnalyzer", () => {
  it("requires image consent", async () => {
    const analyzer = new MockVerdiaAnalyzer();
    await assert.rejects(
      () =>
        analyzer.analyze(Buffer.from("fake"), {
          deviceId: "ESP32_001",
          timestamp: new Date().toISOString(),
          consentImage: false,
          consentLocation: false,
        }),
      /consent/i,
    );
  });

  it("returns mock analysis", async () => {
    const analyses = new InMemoryAnalysisRepository();
    const useCase = new AnalyzePlantImage(new MockVerdiaAnalyzer(), analyses);
    const result = await useCase.execute(Buffer.from("jpeg-bytes"), {
      deviceId: "ESP32_001",
      timestamp: new Date().toISOString(),
      consentImage: true,
      consentLocation: false,
      sensors: { soilMoisturePct: 22 },
    });
    assert.equal(result.isMock, true);
    assert.equal(result.provider, "mock-verdia");
    assert.ok(result.careTips.length > 0);
  });
});

describe("RequestPumpCommand", () => {
  it("enqueues app command", async () => {
    const devices = new InMemoryDeviceRepository();
    const req = new RequestPumpCommand(devices);
    await req.execute("ESP32_001", { action: "pulse", durationMs: 3000, source: "app" });
    const cmds = await devices.consumeCommands("ESP32_001");
    assert.equal(cmds.length, 1);
    assert.equal(cmds[0]!.action, "pulse");
  });
});
