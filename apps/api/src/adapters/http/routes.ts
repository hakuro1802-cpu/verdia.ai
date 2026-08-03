import { Router } from "express";
import multer from "multer";
import type {
  AnalyzePlantImage,
  GetDeviceDashboard,
  IngestTelemetry,
  PollDeviceCommands,
  RequestPumpCommand,
} from "../../application/useCases.js";
import type { AnalysisRepository, DeviceRepository } from "../../domain/ports.js";
import { pumpCommandSchema, telemetrySchema } from "./schemas.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

export function buildRouter(deps: {
  ingestTelemetry: IngestTelemetry;
  getDashboard: GetDeviceDashboard;
  requestPump: RequestPumpCommand;
  pollCommands: PollDeviceCommands;
  analyzePlant: AnalyzePlantImage;
  devices: DeviceRepository;
  analyses: AnalysisRepository;
  defaultDeviceId: string;
}): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ ok: true, service: "verdia-api", verdiaProvider: "mock-verdia" });
  });

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

  router.post("/telemetry", async (req, res, next) => {
    try {
      const parsed = telemetrySchema.parse(req.body);
      const result = await deps.ingestTelemetry.execute(parsed);
      res.status(201).json(result);
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

  router.post("/analysis", upload.single("image"), async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "image file required (field: image)" });
        return;
      }
      const deviceId =
        String(req.body.deviceId || deps.defaultDeviceId).trim() ||
        deps.defaultDeviceId;
      const consentImage = req.body.consentImage === "true" || req.body.consentImage === true;
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
        res.status(404).json({ error: "not found" });
        return;
      }
      res.json(item);
    } catch (e) {
      next(e);
    }
  });

  return router;
}
