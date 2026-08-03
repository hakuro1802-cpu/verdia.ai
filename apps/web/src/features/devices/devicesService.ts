import type { DeviceStatus, PumpCommand, TelemetrySample } from "@verdia/contracts";
import { apiFetch } from "../../shared/api/client";
import { enqueueOutbox, isOfflineError } from "../../shared/offline/outbox";

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
): Promise<{ queued?: boolean }> {
  const path = `/devices/${encodeURIComponent(deviceId)}/commands/pump`;
  const body = JSON.stringify({ action, durationMs, source: "app" });
  try {
    await apiFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    return {};
  } catch (e) {
    if (isOfflineError(e)) {
      enqueueOutbox({ kind: "pump", path, payload: body });
      return { queued: true };
    }
    throw e;
  }
}

export async function postTelemetry(sample: TelemetrySample): Promise<{ queued?: boolean }> {
  const body = JSON.stringify(sample);
  try {
    await apiFetch("/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    return {};
  } catch (e) {
    if (isOfflineError(e)) {
      enqueueOutbox({ kind: "telemetry", path: "/telemetry", payload: body });
      return { queued: true };
    }
    throw e;
  }
}
