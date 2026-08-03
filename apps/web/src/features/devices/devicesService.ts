import type { DeviceStatus, PumpCommand, TelemetrySample } from "@verdia/contracts";
import { apiFetch } from "../../shared/api/client";

export async function listDevices(): Promise<DeviceStatus[]> {
  const body = await apiFetch<{ devices: DeviceStatus[] } | DeviceStatus[]>("/devices");
  return Array.isArray(body) ? body : body.devices ?? [];
}

export async function fetchDeviceDashboard(deviceId: string): Promise<{
  status: DeviceStatus | null;
  latest: TelemetrySample | null;
  history: TelemetrySample[];
}> {
  return apiFetch(`/devices/${encodeURIComponent(deviceId)}/dashboard`);
}

export async function sendPumpCommand(
  deviceId: string,
  action: PumpCommand["action"],
  durationMs?: number,
): Promise<void> {
  await apiFetch(`/devices/${encodeURIComponent(deviceId)}/commands/pump`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, durationMs, source: "app" }),
  });
}

export async function postTelemetry(sample: TelemetrySample): Promise<void> {
  await apiFetch("/telemetry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sample),
  });
}
