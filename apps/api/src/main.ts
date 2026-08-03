import cors from "cors";
import express from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import { MockVerdiaAnalyzer } from "./adapters/mockVerdiaAnalyzer.js";
import { FileBackedStore } from "./adapters/fileStore.js";
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
const DATA_DIR = process.env.VERDIA_DATA_DIR ?? path.resolve(process.cwd(), "data");
const USE_FILE_STORE = process.env.VERDIA_STORE !== "memory";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveWebDist(): string | null {
  const candidates = [
    process.env.VERDIA_WEB_DIST,
    path.resolve(__dirname, "../../web/dist"), // from apps/api/dist → apps/web/dist
    path.resolve(__dirname, "../../../apps/web/dist"),
    path.resolve(process.cwd(), "apps/web/dist"),
    path.resolve(process.cwd(), "../web/dist"),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, "index.html"))) return candidate;
  }
  return null;
}

export async function createApp() {
  let telemetry: InMemoryTelemetryRepository | FileBackedStore["telemetry"];
  let devices: InMemoryDeviceRepository | FileBackedStore["devices"];
  let analyses: InMemoryAnalysisRepository | FileBackedStore["analyses"];

  if (USE_FILE_STORE) {
    const store = new FileBackedStore(DATA_DIR);
    await store.load();
    telemetry = store.telemetry;
    devices = store.devices;
    analyses = store.analyses;
    console.log(`[verdia-api] file store: ${DATA_DIR}`);
  } else {
    telemetry = new InMemoryTelemetryRepository();
    devices = new InMemoryDeviceRepository();
    analyses = new InMemoryAnalysisRepository();
    console.log("[verdia-api] memory store");
  }

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

  const webDist = resolveWebDist();
  if (webDist) {
    app.use(express.static(webDist));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/")) return next();
      res.sendFile(path.join(webDist, "index.html"));
    });
    console.log(`[verdia-api] serving web UI from ${webDist}`);
  } else {
    console.log("[verdia-api] web dist not found — API only (run npm run build)");
  }

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
  const { app, ingestTelemetry, defaultDeviceId } = await createApp();

  if (SIMULATOR) {
    startDemoSimulator(ingestTelemetry, defaultDeviceId);
    console.log(`[verdia-api] demo simulator enabled for ${defaultDeviceId}`);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[verdia-api] app ready at http://0.0.0.0:${PORT}`);
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
