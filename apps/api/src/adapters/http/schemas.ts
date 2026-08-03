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
