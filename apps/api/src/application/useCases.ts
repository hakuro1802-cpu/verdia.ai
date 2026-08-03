import { nanoid } from "nanoid";
import {
  interpretWeather,
  sanitizeSensorReading,
  validateSensorReading,
  type AnalysisRequestMeta,
  type AppNotification,
  type AppMode,
  type DashboardCard,
  type DeviceStatus,
  type Farm,
  type Field,
  type GeoPoint,
  type MomoLocale,
  type NotificationKind,
  type PlantAnalysisResult,
  type PlatformStatus,
  type PumpCommand,
  type ReportPeriod,
  type ServiceAvailability,
  type TelemetrySample,
  type ValidatedSensorValue,
  type WeatherInterpretation,
} from "@verdia/contracts";
import type {
  AnalysisRepository,
  AuthPort,
  DeviceRepository,
  FarmRepository,
  FieldRepository,
  MomoAssistantPort,
  NotificationRepository,
  RecommendationPort,
  ReportPort,
  TelemetryRepository,
  VisionPipelinePort,
  WeatherPort,
} from "../domain/ports.js";
import { newFarm, newField } from "../adapters/memoryStore.js";

export class IngestTelemetry {
  constructor(
    private readonly telemetry: TelemetryRepository,
    private readonly devices: DeviceRepository,
    private readonly notifications?: NotificationRepository,
  ) {}

  async execute(sample: TelemetrySample) {
    const validated = validateSensorReading(sample.sensors, sample.timestamp);
    const sanitized: TelemetrySample = {
      ...sample,
      sensors: sanitizeSensorReading(sample.sensors, sample.timestamp),
    };
    await this.telemetry.save(sanitized);
    const status = await this.devices.upsertFromTelemetry(sanitized);

    if (this.notifications) {
      await maybeNotifyFromTelemetry(this.notifications, sanitized, status);
    }

    return {
      sample: sanitized,
      status,
      validated,
    };
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
  constructor(
    private readonly devices: DeviceRepository,
    private readonly notifications?: NotificationRepository,
  ) {}

  async execute(deviceId: string, command: PumpCommand) {
    await this.devices.enqueueCommand(deviceId, command);
    if (command.action === "on") await this.devices.setPump(deviceId, true);
    if (command.action === "off") await this.devices.setPump(deviceId, false);
    if (command.action === "pulse") await this.devices.setPump(deviceId, true);

    if (this.notifications && (command.action === "on" || command.action === "pulse")) {
      await this.notifications.create(
        makeNotification(
          "pump_activated",
          "Pump activated",
          `Pump command ${command.action} sent to ${deviceId}`,
          deviceId,
        ),
      );
    }

    return this.devices.get(deviceId);
  }
}

export class AnalyzePlantImage {
  constructor(
    private readonly vision: VisionPipelinePort,
    private readonly analyses: AnalysisRepository,
    private readonly notifications?: NotificationRepository,
  ) {}

  async execute(image: Buffer, meta: AnalysisRequestMeta) {
    const result = await this.vision.analyze(image, meta);
    await this.analyses.save(result);

    if (this.notifications && !result.rejected) {
      await this.notifications.create(
        makeNotification(
          "analysis_completed",
          result.provider === "unavailable"
            ? "Analysis unavailable"
            : "Analysis completed",
          result.diagnosis,
          result.id,
        ),
      );
    }

    return result;
  }
}

export class PollDeviceCommands {
  constructor(private readonly devices: DeviceRepository) {}

  async execute(deviceId: string) {
    return this.devices.consumeCommands(deviceId);
  }
}

/* —— Farms / Fields —— */

export class CreateFarm {
  constructor(private readonly farms: FarmRepository) {}

  async execute(input: {
    name: string;
    locationLabel?: string | null;
    geo?: Farm["geo"];
    metadata?: Record<string, string>;
  }) {
    const farm = newFarm(input);
    return this.farms.create(farm);
  }
}

export class ListFarms {
  constructor(private readonly farms: FarmRepository) {}
  async execute() {
    return this.farms.list();
  }
}

export class GetFarm {
  constructor(private readonly farms: FarmRepository) {}
  async execute(id: string) {
    return this.farms.get(id);
  }
}

export class UpdateFarm {
  constructor(private readonly farms: FarmRepository) {}
  async execute(
    id: string,
    patch: Partial<Pick<Farm, "name" | "locationLabel" | "geo" | "metadata">>,
  ) {
    return this.farms.update(id, { ...patch, updatedAt: new Date().toISOString() });
  }
}

export class DeleteFarm {
  constructor(
    private readonly farms: FarmRepository,
    private readonly fields: FieldRepository,
  ) {}
  async execute(id: string) {
    const related = await this.fields.listByFarm(id);
    for (const f of related) await this.fields.delete(f.id);
    return this.farms.delete(id);
  }
}

export class CreateField {
  constructor(
    private readonly farms: FarmRepository,
    private readonly fields: FieldRepository,
  ) {}

  async execute(input: {
    farmId: string;
    name: string;
    crop?: string | null;
    growthStage?: string | null;
  }) {
    const farm = await this.farms.get(input.farmId);
    if (!farm) throw new Error("farm_not_found");
    const field = newField(input);
    return this.fields.create(field);
  }
}

export class ListFields {
  constructor(private readonly fields: FieldRepository) {}
  async execute(farmId?: string) {
    if (farmId) return this.fields.listByFarm(farmId);
    return this.fields.list();
  }
}

export class UpdateField {
  constructor(private readonly fields: FieldRepository) {}
  async execute(
    id: string,
    patch: Partial<Pick<Field, "name" | "crop" | "growthStage" | "irrigationZoneIds">> & {
      historyNote?: string;
    },
  ) {
    const current = await this.fields.get(id);
    if (!current) return null;
    const history = [...current.history];
    if (patch.historyNote) {
      history.push({
        at: new Date().toISOString(),
        note: patch.historyNote,
        crop: patch.crop ?? current.crop,
      });
    }
    const { historyNote: _, ...rest } = patch;
    return this.fields.update(id, {
      ...rest,
      history,
      updatedAt: new Date().toISOString(),
    });
  }
}

export class DeleteField {
  constructor(private readonly fields: FieldRepository) {}
  async execute(id: string) {
    return this.fields.delete(id);
  }
}

/* —— Sensors —— */

export class GetSensorOverview {
  constructor(
    private readonly telemetry: TelemetryRepository,
    private readonly devices: DeviceRepository,
    private readonly notifications?: NotificationRepository,
  ) {}

  async execute(deviceId: string) {
    const [rawStatus, latest] = await Promise.all([
      this.devices.get(deviceId),
      this.telemetry.latest(deviceId),
    ]);

    const status = await applyOnlineFreshness(rawStatus, this.notifications);

    if (!latest) {
      return {
        deviceId,
        status,
        readings: [] as ValidatedSensorValue[],
        sample: null,
        state: "empty" as const,
      };
    }

    const readings = validateSensorReading(latest.sensors, latest.timestamp);
    return {
      deviceId,
      status,
      readings,
      sample: latest,
      state: status?.online === false ? ("offline" as const) : ("ready" as const),
    };
  }
}

/* —— Dashboard aggregate (independent cards) —— */

export class GetDashboardAggregate {
  constructor(
    private readonly telemetry: TelemetryRepository,
    private readonly devices: DeviceRepository,
    private readonly analyses: AnalysisRepository,
    private readonly weather: WeatherPort,
    private readonly recommendations: RecommendationPort,
    private readonly defaultLocation: GeoPoint | null,
  ) {}

  async execute(deviceId: string) {
    const now = new Date().toISOString();
    const [status, latest, recentAnalyses] = await Promise.all([
      this.devices.get(deviceId),
      this.telemetry.latest(deviceId),
      this.analyses.list(5),
    ]);

    const deviceCard: DashboardCard<DeviceStatus> = {
      id: "device",
      title: "Device",
      state: status ? (status.online ? "ready" : "offline") : "empty",
      updatedAt: status?.lastSeenAt ?? null,
      data: status,
      error: status ? undefined : "No device status yet",
    };

    const sensorsCard: DashboardCard<{
      readings: ValidatedSensorValue[];
      sample: TelemetrySample | null;
    }> = latest
      ? {
          id: "sensors",
          title: "Sensors",
          state: "ready",
          updatedAt: latest.timestamp,
          data: {
            readings: validateSensorReading(latest.sensors, latest.timestamp),
            sample: latest,
          },
        }
      : {
          id: "sensors",
          title: "Sensors",
          state: "empty",
          updatedAt: null,
          data: null,
          error: "No telemetry yet",
        };

    const latestAnalysis = recentAnalyses[0] ?? null;
    const analysisCard: DashboardCard<PlantAnalysisResult> = latestAnalysis
      ? {
          id: "analysis",
          title: "Vision analysis",
          state: latestAnalysis.provider === "unavailable" ? "unavailable" : "ready",
          updatedAt: latestAnalysis.createdAt,
          data: latestAnalysis,
          error:
            latestAnalysis.provider === "unavailable"
              ? latestAnalysis.diagnosis
              : undefined,
        }
      : {
          id: "analysis",
          title: "Vision analysis",
          state: "empty",
          updatedAt: null,
          data: null,
          error: "No analysis yet",
        };

    let weatherCard: DashboardCard<WeatherInterpretation>;
    let weatherInterp: WeatherInterpretation | null = null;
    const loc =
      latest?.gps ??
      this.defaultLocation;
    if (!loc) {
      weatherCard = {
        id: "weather",
        title: "Weather",
        state: "unavailable",
        updatedAt: null,
        data: null,
        error: "No GPS or default farm location for weather",
      };
    } else {
      try {
        const snap = await this.weather.fetchCurrent(loc);
        weatherInterp = interpretWeather(snap);
        weatherCard = {
          id: "weather",
          title: "Weather",
          state: "ready",
          updatedAt: snap.fetchedAt,
          data: weatherInterp,
        };
      } catch (err) {
        weatherCard = {
          id: "weather",
          title: "Weather",
          state: "error",
          updatedAt: now,
          data: null,
          error: err instanceof Error ? err.message : "weather_fetch_failed",
        };
      }
    }

    const rec = this.recommendations.build({
      sensors: latest?.sensors ?? null,
      weather: weatherInterp,
      analysis: latestAnalysis,
    });
    const recommendationCard: DashboardCard<typeof rec> = {
      id: "recommendation",
      title: "Recommendation",
      state: rec.unavailableReason ? "unavailable" : "ready",
      updatedAt: rec.createdAt,
      data: rec,
      error: rec.unavailableReason,
    };

    return {
      deviceId,
      generatedAt: now,
      cards: {
        device: deviceCard,
        sensors: sensorsCard,
        analysis: analysisCard,
        weather: weatherCard,
        recommendation: recommendationCard,
      },
    };
  }
}

/* —— Weather —— */

export class FetchWeather {
  constructor(private readonly weather: WeatherPort) {}

  async execute(location: GeoPoint) {
    const snapshot = await this.weather.fetchCurrent(location);
    return interpretWeather(snapshot);
  }
}

/* —— Recommendations —— */

export class BuildRecommendationUseCase {
  constructor(
    private readonly telemetry: TelemetryRepository,
    private readonly analyses: AnalysisRepository,
    private readonly weather: WeatherPort,
    private readonly recommendations: RecommendationPort,
    private readonly fields: FieldRepository,
  ) {}

  async execute(input: {
    deviceId?: string;
    fieldId?: string;
    latitude?: number;
    longitude?: number;
  }) {
    const latest = input.deviceId
      ? await this.telemetry.latest(input.deviceId)
      : null;
    const analysis = (await this.analyses.list(1))[0] ?? null;
    const field = input.fieldId ? await this.fields.get(input.fieldId) : null;

    let weatherInterp: WeatherInterpretation | null = null;
    const loc =
      input.latitude != null && input.longitude != null
        ? { latitude: input.latitude, longitude: input.longitude }
        : latest?.gps ?? null;
    if (loc) {
      try {
        const snap = await this.weather.fetchCurrent(loc);
        weatherInterp = interpretWeather(snap);
      } catch {
        weatherInterp = null;
      }
    }

    return this.recommendations.build({
      sensors: latest?.sensors ?? null,
      weather: weatherInterp,
      analysis,
      crop: field?.crop ?? null,
      growthStage: field?.growthStage ?? null,
    });
  }
}

/* —— Reports —— */

export class GenerateReport {
  constructor(
    private readonly telemetry: TelemetryRepository,
    private readonly devices: DeviceRepository,
    private readonly analyses: AnalysisRepository,
    private readonly reports: ReportPort,
    private readonly allTelemetry?: () => Promise<TelemetrySample[]>,
  ) {}

  async execute(input: {
    period: ReportPeriod;
    farmId?: string | null;
    deviceId?: string | null;
  }) {
    let telemetry: TelemetrySample[];
    if (input.deviceId) {
      telemetry = await this.telemetry.history(input.deviceId, 500);
    } else if (this.allTelemetry) {
      telemetry = await this.allTelemetry();
    } else {
      const devices = await this.devices.list();
      telemetry = [];
      for (const d of devices) {
        telemetry.push(...(await this.telemetry.history(d.deviceId, 200)));
      }
    }

    const analyses = await this.analyses.list(100);
    // Only verified: exclude rejected; keep mock but reports adapter labels them
    const verifiedAnalyses = analyses.filter((a) => !a.rejected);

    return this.reports.generate({
      period: input.period,
      farmId: input.farmId ?? null,
      deviceId: input.deviceId ?? null,
      telemetry,
      analyses: verifiedAnalyses,
    });
  }
}

/* —— Notifications —— */

export class ListNotifications {
  constructor(private readonly notifications: NotificationRepository) {}
  async execute(limit = 50) {
    return this.notifications.list(limit);
  }
}

export class MarkNotificationRead {
  constructor(private readonly notifications: NotificationRepository) {}
  async execute(id: string) {
    return this.notifications.markRead(id);
  }
}

/* —— Auth —— */

export class CreateGuestSession {
  constructor(private readonly auth: AuthPort) {}
  async execute(displayName?: string) {
    return this.auth.createGuestSession(displayName);
  }
}

export class CreateFirebaseSession {
  constructor(private readonly auth: AuthPort) {}
  async execute(idToken: string) {
    if (!this.auth.createFirebaseSession) {
      return {
        unavailable: {
          status: "unavailable" as const,
          reason: "Firebase auth adapter not configured",
          code: "firebase_not_configured",
        } satisfies ServiceAvailability,
      };
    }
    return this.auth.createFirebaseSession(idToken);
  }
}

export class GetAuthAvailability {
  constructor(private readonly auth: AuthPort) {}
  execute() {
    return {
      guest: { status: "available" as const },
      firebase: this.auth.availability(),
    };
  }
}

/* —— momo.ai —— */

export class AskMomo {
  constructor(
    private readonly momo: MomoAssistantPort,
    private readonly telemetry: TelemetryRepository,
    private readonly analyses: AnalysisRepository,
    private readonly recommendations: RecommendationPort,
    private readonly weather: WeatherPort,
  ) {}

  async execute(input: {
    question: string;
    locale?: MomoLocale;
    deviceId?: string;
    latitude?: number;
    longitude?: number;
  }) {
    const latest = input.deviceId
      ? await this.telemetry.latest(input.deviceId)
      : null;
    const analysis = (await this.analyses.list(1))[0] ?? null;

    let weatherInterp: WeatherInterpretation | null = null;
    const loc =
      input.latitude != null && input.longitude != null
        ? { latitude: input.latitude, longitude: input.longitude }
        : latest?.gps ?? null;
    if (loc) {
      try {
        weatherInterp = interpretWeather(await this.weather.fetchCurrent(loc));
      } catch {
        weatherInterp = null;
      }
    }

    const validated = latest
      ? validateSensorReading(latest.sensors, latest.timestamp)
          .filter((v) => v.status === "ok" || v.status === "stale")
          .map((v) => `${v.kind}=${v.value}${v.unit}(${v.status})`)
      : [];

    const recommendation = this.recommendations.build({
      sensors: latest?.sensors ?? null,
      weather: weatherInterp,
      analysis,
    });

    return this.momo.reply({
      question: input.question,
      locale: input.locale ?? "en",
      sensors: latest?.sensors ?? null,
      validatedEvidence: validated,
      analysis,
      recommendation,
      weather: weatherInterp,
    });
  }
}

/* —— Platform status —— */

export class GetPlatformStatus {
  constructor(
    private readonly mode: AppMode,
    private readonly simulatorActive: boolean,
    private readonly firebaseConfigured: boolean,
    private readonly visionConfigured: boolean,
    private readonly weatherAvail: () => ServiceAvailability,
    private readonly visionAvail: () => ServiceAvailability,
    private readonly authAvail: () => ServiceAvailability,
  ) {}

  execute(): PlatformStatus {
    return {
      mode: this.mode,
      brand: "verdia.ai",
      assistant: "momo.ai",
      firebaseConfigured: this.firebaseConfigured,
      weatherConfigured: true,
      visionConfigured: this.visionConfigured,
      simulatorActive: this.simulatorActive,
      services: {
        weather: this.weatherAvail(),
        vision: this.visionAvail(),
        firebase: this.authAvail(),
        guestAuth: { status: "available" },
        openMeteo: { status: "available" },
        simulator: this.simulatorActive
          ? { status: "available" }
          : {
              status: "unavailable",
              reason: "Simulator disabled in live mode (or VERDIA_SIMULATOR not set)",
              code: "simulator_off",
            },
      },
    };
  }
}

/* —— helpers —— */

function makeNotification(
  kind: NotificationKind,
  title: string,
  body: string,
  relatedId?: string,
): AppNotification {
  return {
    id: `ntf_${nanoid(10)}`,
    kind,
    title,
    body,
    createdAt: new Date().toISOString(),
    read: false,
    relatedId,
  };
}

/** Debounce identical kind+device notifications (avoid simulator spam). */
const lastNotifiedAt = new Map<string, number>();
const NOTIFY_COOLDOWN_MS = 30 * 60 * 1000;
const lastPumpByDevice = new Map<string, boolean>();
const DEVICE_OFFLINE_MS = 15 * 60 * 1000;

async function applyOnlineFreshness(
  status: DeviceStatus | null,
  notifications?: NotificationRepository,
): Promise<DeviceStatus | null> {
  if (!status?.lastSeenAt) return status;
  const age = Date.now() - Date.parse(status.lastSeenAt);
  if (!Number.isFinite(age) || age <= DEVICE_OFFLINE_MS) return status;

  const offline: DeviceStatus = {
    ...status,
    online: false,
    network: "offline",
    health: "degraded",
  };

  if (notifications) {
    await notifyOnce(
      notifications,
      `device_offline:${status.deviceId}`,
      makeNotification(
        "device_offline",
        "Device offline",
        `${status.deviceId} has not reported for ${Math.round(age / 60000)} minutes`,
        status.deviceId,
      ),
    );
  }

  return offline;
}

async function maybeNotifyFromTelemetry(
  notifications: NotificationRepository,
  sample: TelemetrySample,
  _status: DeviceStatus,
) {
  const moisture = sample.sensors.soilMoisturePct;
  if (moisture != null && moisture < 35) {
    await notifyOnce(
      notifications,
      `low_moisture:${sample.deviceId}`,
      makeNotification(
        "low_moisture",
        "Low soil moisture",
        `Device ${sample.deviceId}: soil moisture at ${moisture}%`,
        sample.deviceId,
      ),
    );
  }

  const prevPump = lastPumpByDevice.get(sample.deviceId);
  lastPumpByDevice.set(sample.deviceId, sample.pumpOn);
  if (sample.pumpOn && prevPump === false) {
    await notifications.create(
      makeNotification(
        "pump_activated",
        "Pump activated",
        `Device ${sample.deviceId} pump turned on (${sample.irrigationReason ?? "edge"})`,
        sample.deviceId,
      ),
    );
  }
}

async function notifyOnce(
  notifications: NotificationRepository,
  key: string,
  notification: AppNotification,
) {
  const last = lastNotifiedAt.get(key) ?? 0;
  if (Date.now() - last < NOTIFY_COOLDOWN_MS) return;
  lastNotifiedAt.set(key, Date.now());
  await notifications.create(notification);
}
