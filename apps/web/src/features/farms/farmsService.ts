import type { Farm, Field } from "@verdia/contracts";
import { apiFetch } from "../../shared/api/client";

export async function listFarms(): Promise<Farm[]> {
  const body = await apiFetch<{ farms: Farm[] } | Farm[]>("/farms");
  return Array.isArray(body) ? body : body.farms ?? [];
}

export async function createFarm(input: {
  name: string;
  locationLabel?: string | null;
}): Promise<Farm> {
  return apiFetch<Farm>("/farms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateFarm(
  id: string,
  patch: Partial<{ name: string; locationLabel: string | null }>,
): Promise<Farm> {
  return apiFetch<Farm>(`/farms/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export async function deleteFarm(id: string): Promise<void> {
  await apiFetch(`/farms/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function listFields(farmId: string): Promise<Field[]> {
  const body = await apiFetch<{ fields: Field[] } | Field[]>(
    `/fields?farmId=${encodeURIComponent(farmId)}`,
  );
  return Array.isArray(body) ? body : body.fields ?? [];
}

export async function createField(
  farmId: string,
  input: { name: string; crop?: string | null },
): Promise<Field> {
  return apiFetch<Field>(`/fields`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, farmId }),
  });
}
