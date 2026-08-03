import type { DeviceStatus, TelemetrySample, ValidatedSensorValue } from "@verdia/contracts";
import { apiFetch } from "../../shared/api/client";

const DEFAULT_DEVICE = import.meta.env.VITE_DEVICE_ID ?? "ESP32_001";

export async function fetchSensors(deviceId = DEFAULT_DEVICE): Promise<{
  status: DeviceStatus | null;
  latest: TelemetrySample | null;
  history: TelemetrySample[];
  validated?: ValidatedSensorValue[];
}> {
  return apiFetch(`/devices/${encodeURIComponent(deviceId)}/dashboard`);
}

export { DEFAULT_DEVICE };

/** Present only real values — never invent readings. */
export function formatSensorValue(
  value: number | null | undefined,
  unit: string,
): string {
  if (value == null || Number.isNaN(value)) return "Unavailable";
  return `${value}${unit}`;
}
