import cors from "cors";
import express from "express";
import { ZodError } from "zod";
import { MockVerdiaAnalyzer } from "./adapters/mockVerdiaAnalyzer.js";
import {
  InMemoryAnalysisRepository,
  InMemoryDeviceRepository,
  InMemoryTelemetryRepository,
} from "./adapters/memoryStore.js";
import { buildRouter } from "./adapters/http/routes.js";
import { startDemoSimulator } from "./adapters/demoSimulator.js";
import {
  AnalyzePlantImage,
  GetDeviceDashboard,
  IngestTelemetry,
  PollDeviceCommands,
  RequestPumpCommand,
} from "./application/useCases.js";

const PORT = Number(process.env.PORT ?? 8787);
const DEFAULT_DEVICE_ID = process.env.VERDIA_DEVICE_ID ?? "ESP32_001";
const SIMULATOR = process.env.VERDIA_SIMULATOR !== "0";

export function createApp() {
  const telemetry = new InMemoryTelemetryRepository();
  const devices = new InMemoryDeviceRepository();
  const analyses = new InMemoryAnalysisRepository();
  const analyzer = new MockVerdiaAnalyzer();

  const ingestTelemetry = new IngestTelemetry(telemetry, devices);
  const getDashboard = new GetDeviceDashboard(telemetry, devices);
  const requestPump = new RequestPumpCommand(devices);
  const pollCommands = new PollDeviceCommands(devices);
  const analyzePlant = new AnalyzePlantImage(analyzer, analyses);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.use(
    "/api/v1",
    buildRouter({
      ingestTelemetry,
      getDashboard,
      requestPump,
      pollCommands,
      analyzePlant,
      devices,
      analyses,
      defaultDeviceId: DEFAULT_DEVICE_ID,
    }),
  );

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (err instanceof ZodError) {
        res.status(400).json({ error: "validation_failed", details: err.flatten() });
        return;
      }
      const message = err instanceof Error ? err.message : "internal_error";
      const status = message.toLowerCase().includes("consent") ? 403 : 500;
      console.error(err);
      res.status(status).json({ error: message });
    },
  );

  return { app, ingestTelemetry, defaultDeviceId: DEFAULT_DEVICE_ID };
}

async function main() {
  const { app, ingestTelemetry, defaultDeviceId } = createApp();

  if (SIMULATOR) {
    startDemoSimulator(ingestTelemetry, defaultDeviceId);
    console.log(`[verdia-api] demo simulator enabled for ${defaultDeviceId}`);
  }

  app.listen(PORT, () => {
    console.log(`[verdia-api] listening on http://localhost:${PORT}`);
    console.log(`[verdia-api] Verdia provider: mock-verdia (no public API)`);
  });
}

const isDirect =
  process.argv[1] &&
  (process.argv[1].endsWith("main.ts") || process.argv[1].endsWith("main.js"));

if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
