import type { DeviceStatus, TelemetrySample, ValidatedSensorValue } from "@verdia/contracts";
import { apiFetch } from "../../shared/api/client";

export async function fetchSensors(deviceId: string): Promise<{
  status: DeviceStatus | null;
  latest: TelemetrySample | null;
  history: TelemetrySample[];
  validated?: ValidatedSensorValue[];
}> {
  return apiFetch(`/devices/${encodeURIComponent(deviceId)}/dashboard`);
}

/** Present only real values — never invent readings. */
export function formatSensorValue(
  value: number | null | undefined,
  unit: string,
): string {
  if (value == null || Number.isNaN(value)) return "Unavailable";
  return `${value}${unit}`;
}
