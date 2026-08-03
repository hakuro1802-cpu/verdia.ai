import type { PlantAnalysisResult, SensorReading } from "@verdia/contracts";
import { apiFetch } from "../../shared/api/client";
import {
  blobToBase64,
  enqueueOutbox,
  isOfflineError,
} from "../../shared/offline/outbox";
import { assessImageQuality } from "./imageQuality";

export type AnalysisUploadInput = {
  file: Blob;
  deviceId: string;
  sensors?: SensorReading | null;
  consentImage: boolean;
  consentLocation: boolean;
  latitude?: number;
  longitude?: number;
};

export type UploadGateResult =
  | { accepted: false; reason: string; queued?: boolean }
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

  const formFields: Record<string, string> = {
    deviceId: input.deviceId,
    consentImage: String(input.consentImage),
    consentLocation: String(input.consentLocation),
  };
  if (input.sensors) formFields.sensors = JSON.stringify(input.sensors);
  if (
    input.consentLocation &&
    input.latitude != null &&
    input.longitude != null
  ) {
    formFields.latitude = String(input.latitude);
    formFields.longitude = String(input.longitude);
  }

  const form = new FormData();
  form.append("image", input.file, "plant.jpg");
  for (const [key, value] of Object.entries(formFields)) {
    form.append(key, value);
  }

  try {
    const result = await apiFetch<PlantAnalysisResult>("/analysis", {
      method: "POST",
      body: form,
    });

    if (result.rejected && result.rejectionReason) {
      return { accepted: false, reason: result.rejectionReason };
    }

    return { accepted: true, result };
  } catch (e) {
    if (isOfflineError(e)) {
      const imageBase64 = await blobToBase64(input.file);
      enqueueOutbox({
        kind: "analysis",
        path: "/analysis",
        payload: JSON.stringify({
          formFields,
          imageBase64,
          imageName: "plant.jpg",
          imageType: input.file.type || "image/jpeg",
        }),
      });
      return {
        accepted: false,
        reason: "Offline — analysis queued for sync when back online.",
        queued: true,
      };
    }
    throw e;
  }
}
