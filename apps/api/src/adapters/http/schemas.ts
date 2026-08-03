import { z } from "zod";

export const sensorReadingSchema = z.object({
  temperatureC: z.number().nullable(),
  humidityPct: z.number().nullable(),
  soilMoisturePct: z.number().nullable(),
  soilMoistureRaw: z.number().nullable(),
  soilPh: z.number().nullable(),
  soilPhRaw: z.number().nullable(),
  waterLevelPct: z.number().nullable(),
  waterLevelRaw: z.number().nullable(),
  lightLux: z.number().nullable().optional(),
  rainMm: z.number().nullable().optional(),
});

export const telemetrySchema = z.object({
  timestamp: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Invalid timestamp" }),
  deviceId: z.string().min(1),
  gps: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
    })
    .nullable()
    .optional(),
  sensors: sensorReadingSchema,
  pumpOn: z.boolean(),
  irrigationReason: z.string().optional(),
});

export const pumpCommandSchema = z.object({
  action: z.enum(["on", "off", "pulse"]),
  durationMs: z.number().int().positive().optional(),
  source: z.enum(["edge", "app", "api"]).default("app"),
});

export const geoSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const createFarmSchema = z.object({
  name: z.string().min(1).max(200),
  locationLabel: z.string().max(500).nullable().optional(),
  geo: geoSchema.nullable().optional(),
  metadata: z.record(z.string()).optional(),
});

export const updateFarmSchema = createFarmSchema.partial();

export const createFieldSchema = z.object({
  farmId: z.string().min(1),
  name: z.string().min(1).max(200),
  crop: z.string().max(200).nullable().optional(),
  growthStage: z.string().max(200).nullable().optional(),
});

export const updateFieldSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  crop: z.string().max(200).nullable().optional(),
  growthStage: z.string().max(200).nullable().optional(),
  irrigationZoneIds: z.array(z.string()).optional(),
  historyNote: z.string().max(1000).optional(),
});

export const weatherQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

export const recommendationSchema = z.object({
  deviceId: z.string().optional(),
  fieldId: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const reportSchema = z.object({
  period: z.enum(["daily", "weekly", "monthly", "seasonal"]),
  farmId: z.string().nullable().optional(),
  deviceId: z.string().nullable().optional(),
});

export const guestAuthSchema = z.object({
  displayName: z.string().max(100).optional(),
});

export const firebaseAuthSchema = z.object({
  idToken: z.string().min(1),
});

export const momoAskSchema = z.object({
  question: z.string().min(1).max(2000),
  locale: z.enum(["en", "ta"]).optional(),
  deviceId: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});
