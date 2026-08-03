/**
 * Legacy API surface — delegates to shared client and feature services.
 * Prefer importing from feature services or shared/api/client.
 */
import type {
  DeviceStatus,
  PlantAnalysisResult,
  TelemetrySample,
} from "@verdia/contracts";
import { apiFetch } from "./shared/api/client";
import { uploadAnalysis } from "./features/camera/cameraService";
import { sendPumpCommand as devicesPump } from "./features/devices/devicesService";

export { apiFetch, ApiError, getApiBase } from "./shared/api/client";

export async function fetchDashboard(deviceId: string): Promise<{
  status: DeviceStatus | null;
  latest: TelemetrySample | null;
  history: TelemetrySample[];
}> {
  return apiFetch(`/devices/${encodeURIComponent(deviceId)}/dashboard`);
}

export async function sendPumpCommand(
  deviceId: string,
  action: "on" | "off" | "pulse",
  durationMs?: number,
): Promise<{ queued?: boolean }> {
  return devicesPump(deviceId, action, durationMs);
}

export async function fetchAnalyses(limit = 10): Promise<PlantAnalysisResult[]> {
  const body = await apiFetch<{ items: PlantAnalysisResult[] }>(`/analysis?limit=${limit}`);
  return body.items;
}

export async function analyzeImage(params: {
  deviceId: string;
  file: Blob;
  sensors: TelemetrySample["sensors"] | null;
  consentImage: boolean;
  consentLocation: boolean;
  latitude?: number;
  longitude?: number;
}): Promise<PlantAnalysisResult> {
  const gate = await uploadAnalysis({
    file: params.file,
    deviceId: params.deviceId,
    sensors: params.sensors,
    consentImage: params.consentImage,
    consentLocation: params.consentLocation,
    latitude: params.latitude,
    longitude: params.longitude,
  });
  if (!gate.accepted) {
    throw new Error(gate.reason);
  }
  return gate.result;
}
