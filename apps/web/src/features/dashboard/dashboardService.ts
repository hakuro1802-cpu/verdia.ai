import type {
  AppNotification,
  DeviceStatus,
  Farm,
  PlantAnalysisResult,
  Recommendation,
  ReportSummary,
  TelemetrySample,
  WeatherInterpretation,
} from "@verdia/contracts";
import { ApiError, apiFetch, apiFetchSettled, type ApiResult } from "../../shared/api/client";

export type DashboardBundle = {
  overview: ApiResult<{
    deviceCount: number;
    farmCount: number;
    onlineDevices: number;
    latestAlert: string | null;
  }>;
  devices: ApiResult<{ devices: DeviceStatus[] }>;
  farms: ApiResult<{ farms: Farm[] }>;
  weather: ApiResult<WeatherInterpretation>;
  sensors: ApiResult<{
    status: DeviceStatus | null;
    latest: TelemetrySample | null;
    history: TelemetrySample[];
  }>;
  recommendations: ApiResult<{ items: Recommendation[] } | Recommendation>;
  notifications: ApiResult<{ items: AppNotification[] }>;
  reports: ApiResult<{ items: ReportSummary[] } | ReportSummary>;
  analyses: ApiResult<{ items: PlantAnalysisResult[] }>;
};

export type DashboardCardId = keyof DashboardBundle;

const DEFAULT_DEVICE = import.meta.env.VITE_DEVICE_ID ?? "ESP32_001";

function failedResult<T>(message: string): ApiResult<T> {
  return {
    ok: false,
    error: new ApiError(message, { status: 0, code: "unknown" }),
  };
}

export async function fetchDashboardCard(
  id: DashboardCardId,
  opts?: { lat?: number; lon?: number; deviceId?: string },
): Promise<ApiResult<unknown>> {
  const deviceId = opts?.deviceId ?? DEFAULT_DEVICE;
  const lat = opts?.lat ?? 11.0;
  const lon = opts?.lon ?? 78.0;

  switch (id) {
    case "overview":
      return apiFetchSettled("/dashboard");
    case "devices":
      return apiFetchSettled("/devices");
    case "farms":
      return apiFetchSettled("/farms");
    case "weather":
      return apiFetchSettled(`/weather?lat=${lat}&lon=${lon}`);
    case "sensors":
      return apiFetchSettled(`/devices/${encodeURIComponent(deviceId)}/dashboard`);
    case "recommendations":
      return apiFetchSettled("/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    case "notifications":
      return apiFetchSettled("/notifications");
    case "reports":
      return apiFetchSettled("/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: "daily" }),
      });
    case "analyses":
      return apiFetchSettled("/analysis");
    default:
      return failedResult("Unknown dashboard card");
  }
}

/** Load cards independently — each settles on its own (Promise.allSettled). */
export async function loadDashboardCards(
  ids: DashboardCardId[],
  opts?: { lat?: number; lon?: number; deviceId?: string },
): Promise<Record<DashboardCardId, ApiResult<unknown>>> {
  const settled = await Promise.allSettled(ids.map((id) => fetchDashboardCard(id, opts)));
  const out = {} as Record<DashboardCardId, ApiResult<unknown>>;
  ids.forEach((id, i) => {
    const result = settled[i]!;
    if (result.status === "fulfilled") {
      out[id] = result.value;
    } else {
      out[id] = failedResult(
        result.reason instanceof Error ? result.reason.message : "Failed to load card",
      );
    }
  });
  return out;
}

export async function fetchDeviceDashboard(deviceId: string) {
  return apiFetch<{
    status: DeviceStatus | null;
    latest: TelemetrySample | null;
    history: TelemetrySample[];
  }>(`/devices/${encodeURIComponent(deviceId)}/dashboard`);
}

export { DEFAULT_DEVICE };
