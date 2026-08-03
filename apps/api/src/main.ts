import cors from "cors";
import express from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import type { AppMode, GeoPoint } from "@verdia/contracts";
import { MockVerdiaAnalyzer } from "./adapters/mockVerdiaAnalyzer.js";
import { FileBackedStore } from "./adapters/fileStore.js";
import {
  InMemoryAnalysisRepository,
  InMemoryDeviceRepository,
  InMemoryFarmRepository,
  InMemoryFieldRepository,
  InMemoryNotificationRepository,
  InMemorySessionRepository,
  InMemoryTelemetryRepository,
} from "./adapters/memoryStore.js";
import { buildRouter } from "./adapters/http/routes.js";
import { startDemoSimulator } from "./adapters/demoSimulator.js";
import { OpenMeteoWeatherAdapter } from "./adapters/openMeteoWeather.js";
import { ImageQualityChecker } from "./adapters/imageQualityChecker.js";
import { VisionPipeline } from "./adapters/visionPipeline.js";
import {
  HttpVisionAnalyzer,
  UnavailableVisionAnalyzer,
} from "./adapters/unavailableVisionAnalyzer.js";
import {
  CompositeAuthAdapter,
  FirebaseAuthAdapter,
  GuestAuthAdapter,
} from "./adapters/authAdapters.js";
import {
  LocalRecommendationAdapter,
  LocalReportAdapter,
} from "./adapters/recommendationAndReport.js";
import { MomoTemplateAssistant } from "./adapters/momoAssistant.js";
import {
  AnalyzePlantImage,
  AskMomo,
  BuildRecommendationUseCase,
  CreateFarm,
  CreateField,
  CreateFirebaseSession,
  CreateGuestSession,
  DeleteFarm,
  DeleteField,
  FetchWeather,
  GenerateReport,
  GetAuthAvailability,
  GetDashboardAggregate,
  GetDeviceDashboard,
  GetFarm,
  GetPlatformStatus,
  GetSensorOverview,
  IngestTelemetry,
  ListFarms,
  ListFields,
  ListNotifications,
  MarkNotificationRead,
  PollDeviceCommands,
  RequestPumpCommand,
  UpdateFarm,
  UpdateField,
} from "./application/useCases.js";

const PORT = Number(process.env.PORT ?? 8787);
const DEFAULT_DEVICE_ID = process.env.VERDIA_DEVICE_ID ?? "ESP32_001";
const DATA_DIR = process.env.VERDIA_DATA_DIR ?? path.resolve(process.cwd(), "data");
const USE_FILE_STORE = process.env.VERDIA_STORE !== "memory";

/** Default live. Demo only when explicitly VERDIA_MODE=demo. */
const MODE: AppMode =
  process.env.VERDIA_MODE === "demo" ? "demo" : "live";

/**
 * Simulator ONLY in demo mode (VERDIA_MODE=demo).
 * VERDIA_SIMULATOR=0 disables even in demo.
 * Live mode NEVER enables the simulator (no fabricated telemetry).
 */
const SIMULATOR_ACTIVE =
  MODE === "demo" && process.env.VERDIA_SIMULATOR !== "0";

const VISION_URL = process.env.VERDIA_VISION_URL?.trim() || "";
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID?.trim() || "";

const DEFAULT_LOCATION: GeoPoint | null = parseDefaultLocation(
  process.env.VERDIA_DEFAULT_LAT,
  process.env.VERDIA_DEFAULT_LON,
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseDefaultLocation(
  lat?: string,
  lon?: string,
): GeoPoint | null {
  if (lat == null || lon == null || lat === "" || lon === "") return null;
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function resolveWebDist(): string | null {
  const candidates = [
    process.env.VERDIA_WEB_DIST,
    path.resolve(__dirname, "../../web/dist"),
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
  let farms: InMemoryFarmRepository | FileBackedStore["farms"];
  let fields: InMemoryFieldRepository | FileBackedStore["fields"];
  let notifications:
    | InMemoryNotificationRepository
    | FileBackedStore["notifications"];
  let sessions: InMemorySessionRepository | FileBackedStore["sessions"];
  let allTelemetry: (() => Promise<import("@verdia/contracts").TelemetrySample[]>) | undefined;

  if (USE_FILE_STORE) {
    const store = new FileBackedStore(DATA_DIR);
    await store.load();
    telemetry = store.telemetry;
    devices = store.devices;
    analyses = store.analyses;
    farms = store.farms;
    fields = store.fields;
    notifications = store.notifications;
    sessions = store.sessions;
    allTelemetry = () => store.telemetryMem.all();
    console.log(`[verdia-api] file store: ${DATA_DIR}`);
  } else {
    const memTelemetry = new InMemoryTelemetryRepository();
    telemetry = memTelemetry;
    devices = new InMemoryDeviceRepository();
    analyses = new InMemoryAnalysisRepository();
    farms = new InMemoryFarmRepository();
    fields = new InMemoryFieldRepository();
    notifications = new InMemoryNotificationRepository();
    sessions = new InMemorySessionRepository();
    allTelemetry = () => memTelemetry.all();
    console.log("[verdia-api] memory store");
  }

  const weather = new OpenMeteoWeatherAdapter();
  const quality = new ImageQualityChecker();
  const recommendations = new LocalRecommendationAdapter();
  const reports = new LocalReportAdapter();
  const momo = new MomoTemplateAssistant();

  const guestAuth = new GuestAuthAdapter(sessions);
  const firebaseAuth = new FirebaseAuthAdapter(sessions, FIREBASE_PROJECT_ID || undefined);
  const auth = new CompositeAuthAdapter(guestAuth, firebaseAuth);

  // Vision: demo → mock labeled; live → remote if URL else honest unavailable
  let visionConfigured = false;
  let analyzer;
  if (MODE === "demo") {
    analyzer = new MockVerdiaAnalyzer();
    visionConfigured = false; // mock is not a live provider
    console.log("[verdia-api] vision: MockVerdiaAnalyzer (demo mode, labeled mock)");
  } else if (VISION_URL) {
    analyzer = new HttpVisionAnalyzer(VISION_URL);
    visionConfigured = true;
    console.log(`[verdia-api] vision: HttpVisionAnalyzer → ${VISION_URL}`);
  } else {
    analyzer = new UnavailableVisionAnalyzer();
    visionConfigured = false;
    console.log("[verdia-api] vision: UnavailableVisionAnalyzer (no VERDIA_VISION_URL)");
  }

  const vision = new VisionPipeline(quality, analyzer, () => {
    if (MODE === "demo") {
      return {
        status: "degraded",
        reason: "Demo mode uses mock vision analyzer (results labeled isMock)",
        code: "vision_demo_mock",
      };
    }
    if (visionConfigured) return { status: "available" };
    return {
      status: "unavailable",
      reason: "VERDIA_VISION_URL is not configured",
      code: "vision_not_configured",
    };
  });

  const ingestTelemetry = new IngestTelemetry(telemetry, devices, notifications);
  const getDashboard = new GetDeviceDashboard(telemetry, devices);
  const getDashboardAggregate = new GetDashboardAggregate(
    telemetry,
    devices,
    analyses,
    weather,
    recommendations,
    DEFAULT_LOCATION,
  );
  const getSensorOverview = new GetSensorOverview(telemetry, devices, notifications);
  const requestPump = new RequestPumpCommand(devices, notifications);
  const pollCommands = new PollDeviceCommands(devices);
  const analyzePlant = new AnalyzePlantImage(vision, analyses, notifications);

  const createFarm = new CreateFarm(farms);
  const listFarms = new ListFarms(farms);
  const getFarm = new GetFarm(farms);
  const updateFarm = new UpdateFarm(farms);
  const deleteFarm = new DeleteFarm(farms, fields);
  const createField = new CreateField(farms, fields);
  const listFields = new ListFields(fields);
  const updateField = new UpdateField(fields);
  const deleteField = new DeleteField(fields);

  const fetchWeather = new FetchWeather(weather);
  const buildRecommendation = new BuildRecommendationUseCase(
    telemetry,
    analyses,
    weather,
    recommendations,
    fields,
  );
  const generateReport = new GenerateReport(
    telemetry,
    devices,
    analyses,
    reports,
    allTelemetry,
  );
  const listNotifications = new ListNotifications(notifications);
  const markNotificationRead = new MarkNotificationRead(notifications);
  const createGuestSession = new CreateGuestSession(auth);
  const createFirebaseSession = new CreateFirebaseSession(auth);
  const getAuthAvailability = new GetAuthAvailability(auth);
  const askMomo = new AskMomo(
    momo,
    telemetry,
    analyses,
    recommendations,
    weather,
  );
  const getPlatformStatus = new GetPlatformStatus(
    MODE,
    SIMULATOR_ACTIVE,
    Boolean(FIREBASE_PROJECT_ID),
    visionConfigured,
    () => weather.availability(),
    () => vision.availability(),
    () => auth.availability(),
  );

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.use(
    "/api/v1",
    buildRouter({
      ingestTelemetry,
      getDashboard,
      getDashboardAggregate,
      getSensorOverview,
      requestPump,
      pollCommands,
      analyzePlant,
      createFarm,
      listFarms,
      getFarm,
      updateFarm,
      deleteFarm,
      createField,
      listFields,
      updateField,
      deleteField,
      fetchWeather,
      buildRecommendation,
      generateReport,
      listNotifications,
      markNotificationRead,
      createGuestSession,
      createFirebaseSession,
      getAuthAvailability,
      askMomo,
      getPlatformStatus,
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
      if (message === "farm_not_found") {
        res.status(404).json({ error: "not_found", message: "Farm not found" });
        return;
      }
      const status = message.toLowerCase().includes("consent") ? 403 : 500;
      console.error(err);
      res.status(status).json({ error: message });
    },
  );

  return {
    app,
    ingestTelemetry,
    defaultDeviceId: DEFAULT_DEVICE_ID,
    mode: MODE,
    simulatorActive: SIMULATOR_ACTIVE,
    getPlatformStatus,
  };
}

async function main() {
  const { app, ingestTelemetry, defaultDeviceId, mode, simulatorActive } =
    await createApp();

  console.log(`[verdia-api] mode=${mode} simulator=${simulatorActive ? "on" : "off"}`);

  if (simulatorActive) {
    startDemoSimulator(ingestTelemetry, defaultDeviceId);
    console.log(`[verdia-api] demo simulator enabled for ${defaultDeviceId}`);
  } else if (mode === "live") {
    console.log("[verdia-api] live mode — simulator OFF (no fabricated telemetry)");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[verdia-api] ready at http://0.0.0.0:${PORT}`);
    console.log(`[verdia-api] brand: verdia.ai · assistant: momo.ai`);
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
