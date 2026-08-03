import { Router } from "express";
import multer from "multer";
import type {
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
} from "../../application/useCases.js";
import type {
  AnalysisRepository,
  DeviceRepository,
} from "../../domain/ports.js";
import {
  createFarmSchema,
  createFieldSchema,
  firebaseAuthSchema,
  guestAuthSchema,
  momoAskSchema,
  pumpCommandSchema,
  recommendationSchema,
  reportSchema,
  telemetrySchema,
  updateFarmSchema,
  updateFieldSchema,
  weatherQuerySchema,
} from "./schemas.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

export type RouterDeps = {
  ingestTelemetry: IngestTelemetry;
  getDashboard: GetDeviceDashboard;
  getDashboardAggregate: GetDashboardAggregate;
  getSensorOverview: GetSensorOverview;
  requestPump: RequestPumpCommand;
  pollCommands: PollDeviceCommands;
  analyzePlant: AnalyzePlantImage;
  createFarm: CreateFarm;
  listFarms: ListFarms;
  getFarm: GetFarm;
  updateFarm: UpdateFarm;
  deleteFarm: DeleteFarm;
  createField: CreateField;
  listFields: ListFields;
  updateField: UpdateField;
  deleteField: DeleteField;
  fetchWeather: FetchWeather;
  buildRecommendation: BuildRecommendationUseCase;
  generateReport: GenerateReport;
  listNotifications: ListNotifications;
  markNotificationRead: MarkNotificationRead;
  createGuestSession: CreateGuestSession;
  createFirebaseSession: CreateFirebaseSession;
  getAuthAvailability: GetAuthAvailability;
  askMomo: AskMomo;
  getPlatformStatus: GetPlatformStatus;
  devices: DeviceRepository;
  analyses: AnalysisRepository;
  defaultDeviceId: string;
  /** When set, Live Mode telemetry requires matching X-Device-Token / Authorization Bearer. */
  telemetryToken: string | null;
};

export function buildRouter(deps: RouterDeps): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    const status = deps.getPlatformStatus.execute();
    res.json({
      ok: true,
      service: "verdia-api",
      brand: "verdia.ai",
      assistant: "momo.ai",
      mode: status.mode,
      simulatorActive: status.simulatorActive,
      firebaseConfigured: status.firebaseConfigured,
      visionConfigured: status.visionConfigured,
      weatherConfigured: status.weatherConfigured,
      services: status.services,
    });
  });

  router.get("/platform/status", (_req, res) => {
    res.json(deps.getPlatformStatus.execute());
  });

  /** Alias used by web shell */
  router.get("/platform", (_req, res) => {
    res.json(deps.getPlatformStatus.execute());
  });

  router.get("/dashboard", async (req, res, next) => {
    try {
      const deviceId =
        typeof req.query.deviceId === "string" && req.query.deviceId
          ? req.query.deviceId
          : deps.defaultDeviceId;
      const [devices, farms, notifications, aggregate] = await Promise.all([
        deps.devices.list(),
        deps.listFarms.execute(),
        deps.listNotifications.execute(5),
        deps.getDashboardAggregate.execute(deviceId),
      ]);
      res.json({
        deviceCount: devices.length,
        farmCount: farms.length,
        onlineDevices: devices.filter((d) => d.online).length,
        latestAlert: notifications[0]?.title ?? null,
        aggregate,
      });
    } catch (e) {
      next(e);
    }
  });

  /* —— Devices / telemetry —— */

  router.get("/devices", async (_req, res, next) => {
    try {
      res.json({ devices: await deps.devices.list() });
    } catch (e) {
      next(e);
    }
  });

  router.get("/devices/:deviceId/dashboard", async (req, res, next) => {
    try {
      const limit = Number(req.query.limit ?? 60);
      const data = await deps.getDashboard.execute(req.params.deviceId, limit);
      res.json(data);
    } catch (e) {
      next(e);
    }
  });

  router.get("/devices/:deviceId/dashboard/aggregate", async (req, res, next) => {
    try {
      const data = await deps.getDashboardAggregate.execute(req.params.deviceId);
      res.json(data);
    } catch (e) {
      next(e);
    }
  });

  router.get("/devices/:deviceId/sensors", async (req, res, next) => {
    try {
      const data = await deps.getSensorOverview.execute(req.params.deviceId);
      res.json(data);
    } catch (e) {
      next(e);
    }
  });

  router.post("/telemetry", async (req, res, next) => {
    try {
      if (deps.telemetryToken) {
        const header =
          (typeof req.header("x-device-token") === "string"
            ? req.header("x-device-token")
            : null) ||
          (typeof req.header("authorization") === "string"
            ? req.header("authorization")!.replace(/^Bearer\s+/i, "")
            : null);
        if (!header || header !== deps.telemetryToken) {
          res.status(401).json({
            error: "unauthorized",
            message:
              "Telemetry requires a valid device token (X-Device-Token). Set VERDIA_TELEMETRY_TOKEN on the server and device.",
          });
          return;
        }
      }
      const parsed = telemetrySchema.parse(req.body);
      const result = await deps.ingestTelemetry.execute(parsed);
      res.status(201).json(result);
    } catch (e) {
      next(e);
    }
  });

  /** Offline outbox flush — replay queued telemetry samples after reconnect. */
  router.post("/sync/telemetry-batch", async (req, res, next) => {
    try {
      if (deps.telemetryToken) {
        const header =
          (typeof req.header("x-device-token") === "string"
            ? req.header("x-device-token")
            : null) ||
          (typeof req.header("authorization") === "string"
            ? req.header("authorization")!.replace(/^Bearer\s+/i, "")
            : null);
        if (!header || header !== deps.telemetryToken) {
          res.status(401).json({
            error: "unauthorized",
            message: "Batch sync requires a valid device token.",
          });
          return;
        }
      }
      const items = Array.isArray(req.body?.samples) ? req.body.samples : [];
      if (items.length === 0) {
        res.status(400).json({
          error: "validation_failed",
          message: "Provide samples: TelemetrySample[]",
        });
        return;
      }
      if (items.length > 100) {
        res.status(400).json({
          error: "validation_failed",
          message: "Maximum 100 samples per batch",
        });
        return;
      }
      const accepted: unknown[] = [];
      const rejected: Array<{ index: number; error: string }> = [];
      for (let i = 0; i < items.length; i++) {
        try {
          const parsed = telemetrySchema.parse(items[i]);
          accepted.push(await deps.ingestTelemetry.execute(parsed));
        } catch (err) {
          rejected.push({
            index: i,
            error: err instanceof Error ? err.message : "invalid_sample",
          });
        }
      }
      res.status(202).json({
        accepted: accepted.length,
        rejected,
        message:
          rejected.length === 0
            ? "All queued samples ingested"
            : "Some samples rejected — see rejected[]. No fabricated fills.",
      });
    } catch (e) {
      next(e);
    }
  });

  router.post("/devices/:deviceId/commands/pump", async (req, res, next) => {
    try {
      const parsed = pumpCommandSchema.parse(req.body);
      const status = await deps.requestPump.execute(req.params.deviceId, parsed);
      res.json({ status, accepted: true });
    } catch (e) {
      next(e);
    }
  });

  router.get("/devices/:deviceId/commands", async (req, res, next) => {
    try {
      const commands = await deps.pollCommands.execute(req.params.deviceId);
      res.json({ commands });
    } catch (e) {
      next(e);
    }
  });

  /* —— Vision —— */

  router.post("/analysis", upload.single("image"), async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "image file required (field: image)" });
        return;
      }
      const deviceId =
        String(req.body.deviceId || deps.defaultDeviceId).trim() ||
        deps.defaultDeviceId;
      const consentImage =
        req.body.consentImage === "true" || req.body.consentImage === true;
      const consentLocation =
        req.body.consentLocation === "true" || req.body.consentLocation === true;

      let sensors = null;
      if (req.body.sensors) {
        sensors =
          typeof req.body.sensors === "string"
            ? JSON.parse(req.body.sensors)
            : req.body.sensors;
      }

      let gps = null;
      if (consentLocation && req.body.latitude && req.body.longitude) {
        gps = {
          latitude: Number(req.body.latitude),
          longitude: Number(req.body.longitude),
        };
      }

      const result = await deps.analyzePlant.execute(req.file.buffer, {
        deviceId,
        timestamp: new Date().toISOString(),
        gps,
        sensors,
        consentImage,
        consentLocation,
        analysisType: req.body.analysisType || undefined,
      });
      res.status(201).json(result);
    } catch (e) {
      next(e);
    }
  });

  router.get("/analysis", async (req, res, next) => {
    try {
      const limit = Number(req.query.limit ?? 20);
      res.json({ items: await deps.analyses.list(limit) });
    } catch (e) {
      next(e);
    }
  });

  router.get("/analysis/:id", async (req, res, next) => {
    try {
      const item = await deps.analyses.get(req.params.id);
      if (!item) {
        res.status(404).json({ error: "not_found", message: "Analysis not found" });
        return;
      }
      res.json(item);
    } catch (e) {
      next(e);
    }
  });

  /* —— Farms —— */

  router.get("/farms", async (_req, res, next) => {
    try {
      res.json({ farms: await deps.listFarms.execute() });
    } catch (e) {
      next(e);
    }
  });

  router.post("/farms", async (req, res, next) => {
    try {
      const parsed = createFarmSchema.parse(req.body);
      const farm = await deps.createFarm.execute(parsed);
      res.status(201).json(farm);
    } catch (e) {
      next(e);
    }
  });

  router.get("/farms/:id", async (req, res, next) => {
    try {
      const farm = await deps.getFarm.execute(req.params.id);
      if (!farm) {
        res.status(404).json({ error: "not_found", message: "Farm not found" });
        return;
      }
      const fields = await deps.listFields.execute(farm.id);
      res.json({ farm, fields });
    } catch (e) {
      next(e);
    }
  });

  router.patch("/farms/:id", async (req, res, next) => {
    try {
      const parsed = updateFarmSchema.parse(req.body);
      const farm = await deps.updateFarm.execute(req.params.id, parsed);
      if (!farm) {
        res.status(404).json({ error: "not_found", message: "Farm not found" });
        return;
      }
      res.json(farm);
    } catch (e) {
      next(e);
    }
  });

  router.delete("/farms/:id", async (req, res, next) => {
    try {
      const ok = await deps.deleteFarm.execute(req.params.id);
      if (!ok) {
        res.status(404).json({ error: "not_found", message: "Farm not found" });
        return;
      }
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  router.get("/farms/:id/fields", async (req, res, next) => {
    try {
      res.json({ fields: await deps.listFields.execute(req.params.id) });
    } catch (e) {
      next(e);
    }
  });

  router.post("/farms/:id/fields", async (req, res, next) => {
    try {
      const parsed = createFieldSchema.parse({
        ...req.body,
        farmId: req.params.id,
      });
      const field = await deps.createField.execute(parsed);
      res.status(201).json(field);
    } catch (e) {
      next(e);
    }
  });

  /* —— Fields —— */

  router.get("/fields", async (req, res, next) => {
    try {
      const farmId = typeof req.query.farmId === "string" ? req.query.farmId : undefined;
      res.json({ fields: await deps.listFields.execute(farmId) });
    } catch (e) {
      next(e);
    }
  });

  router.post("/fields", async (req, res, next) => {
    try {
      const parsed = createFieldSchema.parse(req.body);
      const field = await deps.createField.execute(parsed);
      res.status(201).json(field);
    } catch (e) {
      next(e);
    }
  });

  router.patch("/fields/:id", async (req, res, next) => {
    try {
      const parsed = updateFieldSchema.parse(req.body);
      const field = await deps.updateField.execute(req.params.id, parsed);
      if (!field) {
        res.status(404).json({ error: "not_found", message: "Field not found" });
        return;
      }
      res.json(field);
    } catch (e) {
      next(e);
    }
  });

  router.delete("/fields/:id", async (req, res, next) => {
    try {
      const ok = await deps.deleteField.execute(req.params.id);
      if (!ok) {
        res.status(404).json({ error: "not_found", message: "Field not found" });
        return;
      }
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  /* —— Weather —— */

  router.get("/weather", async (req, res, next) => {
    try {
      const parsed = weatherQuerySchema.parse({
        latitude: req.query.latitude ?? req.query.lat,
        longitude: req.query.longitude ?? req.query.lon,
      });
      const data = await deps.fetchWeather.execute(parsed);
      res.json(data);
    } catch (e) {
      next(e);
    }
  });

  /* —— Recommendations —— */

  router.post("/recommendations", async (req, res, next) => {
    try {
      const parsed = recommendationSchema.parse(req.body ?? {});
      const rec = await deps.buildRecommendation.execute(parsed);
      res.json(rec);
    } catch (e) {
      next(e);
    }
  });

  router.get("/recommendations", async (req, res, next) => {
    try {
      const rec = await deps.buildRecommendation.execute({
        deviceId: typeof req.query.deviceId === "string" ? req.query.deviceId : undefined,
        fieldId: typeof req.query.fieldId === "string" ? req.query.fieldId : undefined,
        latitude:
          req.query.latitude != null ? Number(req.query.latitude) : undefined,
        longitude:
          req.query.longitude != null ? Number(req.query.longitude) : undefined,
      });
      res.json(rec);
    } catch (e) {
      next(e);
    }
  });

  /* —— Reports —— */

  router.post("/reports", async (req, res, next) => {
    try {
      const parsed = reportSchema.parse(req.body);
      const report = await deps.generateReport.execute(parsed);
      res.status(201).json(report);
    } catch (e) {
      next(e);
    }
  });

  router.get("/reports", async (req, res, next) => {
    try {
      const parsed = reportSchema.parse({
        period: req.query.period ?? "daily",
        farmId: typeof req.query.farmId === "string" ? req.query.farmId : null,
        deviceId:
          typeof req.query.deviceId === "string" ? req.query.deviceId : null,
      });
      const report = await deps.generateReport.execute(parsed);
      res.json(report);
    } catch (e) {
      next(e);
    }
  });

  /* —— Notifications —— */

  router.get("/notifications", async (req, res, next) => {
    try {
      const limit = Number(req.query.limit ?? 50);
      res.json({ items: await deps.listNotifications.execute(limit) });
    } catch (e) {
      next(e);
    }
  });

  router.post("/notifications/:id/read", async (req, res, next) => {
    try {
      const item = await deps.markNotificationRead.execute(req.params.id);
      if (!item) {
        res
          .status(404)
          .json({ error: "not_found", message: "Notification not found" });
        return;
      }
      res.json(item);
    } catch (e) {
      next(e);
    }
  });

  /* —— Auth —— */

  router.get("/auth/status", (_req, res) => {
    res.json(deps.getAuthAvailability.execute());
  });

  router.post("/auth/guest", async (req, res, next) => {
    try {
      const parsed = guestAuthSchema.parse(req.body ?? {});
      const session = await deps.createGuestSession.execute(parsed.displayName);
      res.status(201).json(session);
    } catch (e) {
      next(e);
    }
  });

  router.post("/auth/firebase", async (req, res, next) => {
    try {
      const parsed = firebaseAuthSchema.parse(req.body);
      const result = await deps.createFirebaseSession.execute(parsed.idToken);
      if ("unavailable" in result) {
        const avail = result.unavailable;
        res.status(503).json({
          error: "firebase_unavailable",
          availability: avail,
          message: avail.status === "available" ? "unavailable" : avail.reason,
        });
        return;
      }
      res.status(201).json(result);
    } catch (e) {
      next(e);
    }
  });

  /* —— momo.ai —— */

  router.post("/momo/ask", async (req, res, next) => {
    try {
      const parsed = momoAskSchema.parse(req.body);
      const reply = await deps.askMomo.execute(parsed);
      res.json(reply);
    } catch (e) {
      next(e);
    }
  });

  /** Alias for web chat UI */
  router.post("/momo/chat", async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const parsed = momoAskSchema.parse({
        question: body.question ?? body.message,
        locale: body.locale,
        deviceId: body.deviceId,
        latitude: body.latitude,
        longitude: body.longitude,
      });
      const reply = await deps.askMomo.execute(parsed);
      res.json(reply);
    } catch (e) {
      next(e);
    }
  });

  return router;
}
