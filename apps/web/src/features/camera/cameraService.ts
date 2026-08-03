import type { PlantAnalysisResult, SensorReading } from "@verdia/contracts";
import { apiFetch } from "../../shared/api/client";
import { assessImageQuality } from "./imageQuality";

const DEFAULT_DEVICE = import.meta.env.VITE_DEVICE_ID ?? "ESP32_001";

export type AnalysisUploadInput = {
  file: Blob;
  deviceId?: string;
  sensors?: SensorReading | null;
  consentImage: boolean;
  consentLocation: boolean;
  latitude?: number;
  longitude?: number;
};

export type UploadGateResult =
  | { accepted: false; reason: string }
  | { accepted: true; result: PlantAnalysisResult };

export async function listAnalyses(limit = 20): Promise<PlantAnalysisResult[]> {
  const body = await apiFetch<{ items: PlantAnalysisResult[] }>(`/analysis?limit=${limit}`);
  return body.items ?? [];
}

export async function uploadAnalysis(input: AnalysisUploadInput): Promise<UploadGateResult> {
  const quality = await assessImageQuality(input.file);
  if (!quality.ok) {
    return { accepted: false, reason: quality.reason };
  }

  const deviceId = input.deviceId ?? DEFAULT_DEVICE;
  const form = new FormData();
  form.append("image", input.file, "plant.jpg");
  form.append("deviceId", deviceId);
  form.append("consentImage", String(input.consentImage));
  form.append("consentLocation", String(input.consentLocation));
  if (input.sensors) form.append("sensors", JSON.stringify(input.sensors));
  if (
    input.consentLocation &&
    input.latitude != null &&
    input.longitude != null
  ) {
    form.append("latitude", String(input.latitude));
    form.append("longitude", String(input.longitude));
  }

  const result = await apiFetch<PlantAnalysisResult>("/analysis", {
    method: "POST",
    body: form,
  });

  if (result.rejected && result.rejectionReason) {
    return { accepted: false, reason: result.rejectionReason };
  }

  return { accepted: true, result };
}
