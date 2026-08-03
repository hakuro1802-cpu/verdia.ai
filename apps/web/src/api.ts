import type {
  DeviceStatus,
  PlantAnalysisResult,
  TelemetrySample,
} from "@verdia/contracts";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";

export async function fetchDashboard(deviceId: string): Promise<{
  status: DeviceStatus | null;
  latest: TelemetrySample | null;
  history: TelemetrySample[];
}> {
  const res = await fetch(`${API_BASE}/devices/${encodeURIComponent(deviceId)}/dashboard`);
  if (!res.ok) throw new Error(`dashboard ${res.status}`);
  return res.json();
}

export async function sendPumpCommand(
  deviceId: string,
  action: "on" | "off" | "pulse",
  durationMs?: number,
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/devices/${encodeURIComponent(deviceId)}/commands/pump`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, durationMs, source: "app" }),
    },
  );
  if (!res.ok) throw new Error(`pump command ${res.status}`);
}

export async function fetchAnalyses(limit = 10): Promise<PlantAnalysisResult[]> {
  const res = await fetch(`${API_BASE}/analysis?limit=${limit}`);
  if (!res.ok) throw new Error(`analysis list ${res.status}`);
  const body = (await res.json()) as { items: PlantAnalysisResult[] };
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
  const form = new FormData();
  form.append("image", params.file, "plant.jpg");
  form.append("deviceId", params.deviceId);
  form.append("consentImage", String(params.consentImage));
  form.append("consentLocation", String(params.consentLocation));
  if (params.sensors) form.append("sensors", JSON.stringify(params.sensors));
  if (params.consentLocation && params.latitude != null && params.longitude != null) {
    form.append("latitude", String(params.latitude));
    form.append("longitude", String(params.longitude));
  }

  const res = await fetch(`${API_BASE}/analysis`, { method: "POST", body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `analysis ${res.status}`);
  }
  return res.json();
}
