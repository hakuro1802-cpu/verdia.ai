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

export type DashboardLoadOpts = {
  lat?: number;
  lon?: number;
  deviceId?: string;
};

function failedResult<T>(message: string, code = "unavailable"): ApiResult<T> {
  return {
    ok: false,
    error: new ApiError(message, { status: 0, code }),
  };
}

export async function fetchDashboardCard(
  id: DashboardCardId,
  opts?: DashboardLoadOpts,
): Promise<ApiResult<unknown>> {
  switch (id) {
    case "overview":
      return apiFetchSettled("/dashboard");
    case "devices":
      return apiFetchSettled("/devices");
    case "farms":
      return apiFetchSettled("/farms");
    case "weather": {
      if (opts?.lat == null || opts?.lon == null) {
        return failedResult("Location required", "unavailable");
      }
      return apiFetchSettled(`/weather?lat=${opts.lat}&lon=${opts.lon}`);
    }
    case "sensors": {
      if (!opts?.deviceId) {
        return failedResult(
          "No verified device. Pair ESP32 or wait for telemetry.",
          "unavailable",
        );
      }
      return apiFetchSettled(`/devices/${encodeURIComponent(opts.deviceId)}/dashboard`);
    }
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
  opts?: DashboardLoadOpts,
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
