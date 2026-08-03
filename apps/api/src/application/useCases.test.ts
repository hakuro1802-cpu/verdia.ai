import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideIrrigation, sanitizeSensorReading } from "@verdia/contracts";
import { MockVerdiaAnalyzer } from "../adapters/mockVerdiaAnalyzer.ts";
import { ImageQualityChecker } from "../adapters/imageQualityChecker.ts";
import { VisionPipeline } from "../adapters/visionPipeline.ts";
import { UnavailableVisionAnalyzer } from "../adapters/unavailableVisionAnalyzer.ts";
import { MomoTemplateAssistant } from "../adapters/momoAssistant.ts";
import { LocalRecommendationAdapter } from "../adapters/recommendationAndReport.ts";
import {
  InMemoryAnalysisRepository,
  InMemoryDeviceRepository,
  InMemoryFarmRepository,
  InMemoryFieldRepository,
  InMemoryNotificationRepository,
  InMemoryTelemetryRepository,
} from "../adapters/memoryStore.ts";
import {
  AnalyzePlantImage,
  CreateFarm,
  CreateField,
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

  it("sanitizes invalid sensor values on ingest", async () => {
    const telemetry = new InMemoryTelemetryRepository();
    const devices = new InMemoryDeviceRepository();
    const ingest = new IngestTelemetry(telemetry, devices);

    const result = await ingest.execute({
      timestamp: new Date().toISOString(),
      deviceId: "ESP32_001",
      sensors: {
        temperatureC: 999,
        humidityPct: 50,
        soilMoisturePct: -5,
        soilMoistureRaw: 100,
        soilPh: 6.5,
        soilPhRaw: 1700,
        waterLevelPct: 70,
        waterLevelRaw: 2100,
      },
      pumpOn: false,
    });

    assert.equal(result.sample.sensors.temperatureC, null);
    assert.equal(result.sample.sensors.soilMoisturePct, null);
    assert.equal(result.sample.sensors.humidityPct, 50);
    assert.ok(result.validated.some((v) => v.kind === "temperatureC" && v.status === "invalid"));
  });
});

describe("sanitizeSensorReading", () => {
  it("nulls out-of-bounds moisture", () => {
    const clean = sanitizeSensorReading(
      {
        temperatureC: 22,
        humidityPct: 40,
        soilMoisturePct: 200,
        soilMoistureRaw: 1,
        soilPh: 6,
        soilPhRaw: 1,
        waterLevelPct: 50,
        waterLevelRaw: 1,
      },
      new Date().toISOString(),
    );
    assert.equal(clean.soilMoisturePct, null);
    assert.equal(clean.temperatureC, 22);
  });
});

describe("VisionPipeline", () => {
  it("rejects tiny images before analyzer", async () => {
    const pipeline = new VisionPipeline(
      new ImageQualityChecker(),
      new MockVerdiaAnalyzer(),
      () => ({ status: "available" }),
    );
    const result = await pipeline.analyze(Buffer.from("tiny"), {
      deviceId: "ESP32_001",
      timestamp: new Date().toISOString(),
      consentImage: true,
      consentLocation: false,
    });
    assert.equal(result.rejected, true);
    assert.match(result.rejectionReason ?? "", /empty|too_small|unrecognized/i);
  });

  it("mock analyzer requires consent", async () => {
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

  it("returns mock analysis via use case", async () => {
    const analyses = new InMemoryAnalysisRepository();
    const pipeline = new VisionPipeline(
      new ImageQualityChecker(),
      new MockVerdiaAnalyzer(),
      () => ({
        status: "degraded",
        reason: "demo",
        code: "vision_demo_mock",
      }),
    );
    const useCase = new AnalyzePlantImage(pipeline, analyses);
    // JPEG SOI + padding to clear 5KB gate and look like JPEG
    const jpeg = Buffer.alloc(6 * 1024, 0x80);
    jpeg[0] = 0xff;
    jpeg[1] = 0xd8;
    for (let i = 2; i < jpeg.length; i++) jpeg[i] = (i * 37) % 256;

    const result = await useCase.execute(jpeg, {
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

  it("unavailable analyzer does not fabricate diagnosis", async () => {
    const analyzer = new UnavailableVisionAnalyzer();
    const jpeg = Buffer.alloc(6 * 1024, 0x40);
    jpeg[0] = 0xff;
    jpeg[1] = 0xd8;
    for (let i = 2; i < jpeg.length; i++) jpeg[i] = (i * 17) % 256;
    const result = await analyzer.analyze(jpeg, {
      deviceId: "ESP32_001",
      timestamp: new Date().toISOString(),
      consentImage: true,
      consentLocation: false,
    });
    assert.equal(result.provider, "unavailable");
    assert.equal(result.confidence, 0);
    assert.equal(result.isMock, false);
    assert.equal(result.rejected, true);
    assert.ok(result.rejectionReason);
  });
});

describe("RequestPumpCommand", () => {
  it("enqueues app command", async () => {
    const devices = new InMemoryDeviceRepository();
    const req = new RequestPumpCommand(devices);
    await req.execute("ESP32_001", {
      action: "pulse",
      durationMs: 3000,
      source: "app",
    });
    const cmds = await devices.consumeCommands("ESP32_001");
    assert.equal(cmds.length, 1);
    assert.equal(cmds[0]!.action, "pulse");
  });
});

describe("Farms and fields", () => {
  it("creates farm then field", async () => {
    const farms = new InMemoryFarmRepository();
    const fields = new InMemoryFieldRepository();
    const farm = await new CreateFarm(farms).execute({ name: "Test Farm" });
    const field = await new CreateField(farms, fields).execute({
      farmId: farm.id,
      name: "Plot A",
      crop: "tomato",
    });
    assert.equal(field.farmId, farm.id);
    assert.equal(field.crop, "tomato");
  });
});

describe("momo.ai", () => {
  it("refuses to invent irrigation advice without evidence", async () => {
    const momo = new MomoTemplateAssistant();
    const reply = await momo.reply({
      question: "Should I water?",
      locale: "en",
    });
    assert.equal(reply.message.confidence, 0);
    assert.equal(reply.message.uncertain, true);
    assert.match(reply.message.content, /enough verified evidence|won't invent|will not invent|don't have/i);
  });

  it("explains sensors with confidence when evidence present", async () => {
    const momo = new MomoTemplateAssistant();
    const reply = await momo.reply({
      question: "What is my soil moisture?",
      locale: "en",
      validatedEvidence: ["soilMoisturePct=22%(ok)"],
      sensors: {
        temperatureC: 28,
        humidityPct: 60,
        soilMoisturePct: 22,
        soilMoistureRaw: 2000,
        soilPh: 6.5,
        soilPhRaw: 1700,
        waterLevelPct: 80,
        waterLevelRaw: 2400,
      },
    });
    assert.ok((reply.message.confidence ?? 0) > 0.5);
    assert.match(reply.message.content, /22%/);
  });

  it("introduces itself as master companion", async () => {
    const momo = new MomoTemplateAssistant();
    const reply = await momo.reply({
      question: "Who are you?",
      locale: "en",
    });
    assert.match(reply.message.content, /momo\.ai/i);
    assert.ok((reply.message.confidence ?? 0) > 0.8);
  });
});

describe("Recommendations", () => {
  it("returns unavailable without evidence", () => {
    const rec = new LocalRecommendationAdapter().build({});
    assert.equal(rec.unavailableReason, "no_verified_evidence");
    assert.equal(rec.confidence, 0);
  });

  it("builds from moisture evidence", () => {
    const rec = new LocalRecommendationAdapter().build({
      sensors: {
        temperatureC: 30,
        humidityPct: 55,
        soilMoisturePct: 20,
        soilMoistureRaw: 1,
        soilPh: 6.5,
        soilPhRaw: 1,
        waterLevelPct: 70,
        waterLevelRaw: 1,
      },
    });
    assert.ok(!rec.unavailableReason);
    assert.ok(rec.confidence >= 0.7);
    assert.ok(rec.evidence.some((e) => /moisture/i.test(e)));
  });
});

describe("Notifications on low moisture", () => {
  it("emits low_moisture notification once", async () => {
    const telemetry = new InMemoryTelemetryRepository();
    const devices = new InMemoryDeviceRepository();
    const notifications = new InMemoryNotificationRepository();
    const ingest = new IngestTelemetry(telemetry, devices, notifications);

    await ingest.execute({
      timestamp: new Date().toISOString(),
      deviceId: "ESP32_001",
      sensors: {
        temperatureC: 24,
        humidityPct: 50,
        soilMoisturePct: 18,
        soilMoistureRaw: 2400,
        soilPh: 6.5,
        soilPhRaw: 1700,
        waterLevelPct: 70,
        waterLevelRaw: 2100,
      },
      pumpOn: false,
    });

    const items = await notifications.list(10);
    assert.ok(items.some((n) => n.kind === "low_moisture"));
  });
});
