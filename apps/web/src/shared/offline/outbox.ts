import { apiFetch, ApiError } from "../api/client";

const OUTBOX_KEY = "verdia.ai.outbox";

export type OutboxKind = "telemetry" | "analysis" | "pump";

export type OutboxEntry = {
  id: string;
  kind: OutboxKind;
  path: string;
  /** JSON body, or for analysis: `{ formFields, imageBase64, imageName, imageType }` */
  payload: string;
  createdAt: string;
};

type Listener = (entries: OutboxEntry[]) => void;

const listeners = new Set<Listener>();
let flushInFlight: Promise<{ flushed: number; remaining: number; errors: string[] }> | null =
  null;

function readEntries(): OutboxEntry[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OutboxEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEntries(entries: OutboxEntry[]): void {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(entries));
  } catch {
    // Ignore quota / private-mode failures.
  }
  for (const listener of listeners) listener(entries);
}

export function getOutboxEntries(): OutboxEntry[] {
  return readEntries();
}

export function getOutboxLength(): number {
  return readEntries().length;
}

export function subscribeOutbox(listener: Listener): () => void {
  listeners.add(listener);
  listener(readEntries());
  return () => {
    listeners.delete(listener);
  };
}

export function enqueueOutbox(input: {
  kind: OutboxKind;
  path: string;
  payload: string;
}): OutboxEntry {
  const entry: OutboxEntry = {
    id: `ob_${crypto.randomUUID()}`,
    kind: input.kind,
    path: input.path,
    payload: input.payload,
    createdAt: new Date().toISOString(),
  };
  const next = [...readEntries(), entry];
  writeEntries(next);
  return entry;
}

async function replayEntry(entry: OutboxEntry): Promise<void> {
  if (entry.kind === "analysis") {
    const data = JSON.parse(entry.payload) as {
      formFields: Record<string, string>;
      imageBase64: string;
      imageName: string;
      imageType: string;
    };
    const binary = atob(data.imageBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: data.imageType || "image/jpeg" });
    const form = new FormData();
    form.append("image", blob, data.imageName || "plant.jpg");
    for (const [key, value] of Object.entries(data.formFields)) {
      form.append(key, value);
    }
    await apiFetch(entry.path, { method: "POST", body: form });
    return;
  }

  await apiFetch(entry.path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: entry.payload,
  });
}

export async function flushOutbox(): Promise<{
  flushed: number;
  remaining: number;
  errors: string[];
}> {
  if (flushInFlight) return flushInFlight;

  flushInFlight = (async () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return { flushed: 0, remaining: readEntries().length, errors: ["Still offline"] };
    }

    const queue = readEntries();
    const remaining: OutboxEntry[] = [];
    const errors: string[] = [];
    let flushed = 0;

    for (let i = 0; i < queue.length; i++) {
      const entry = queue[i]!;
      try {
        await replayEntry(entry);
        flushed += 1;
      } catch (e) {
        const offline =
          e instanceof ApiError && (e.offline || e.code === "offline");
        errors.push(e instanceof Error ? e.message : "Flush failed");
        if (offline) {
          remaining.push(...queue.slice(i));
          break;
        }
        remaining.push(entry);
      }
    }

    writeEntries(remaining);
    return { flushed, remaining: remaining.length, errors };
  })();

  try {
    return await flushInFlight;
  } finally {
    flushInFlight = null;
  }
}

/** Start listening for connectivity and flush on app start when online. */
export function startOutboxSync(): () => void {
  const onOnline = () => {
    void flushOutbox();
  };

  if (typeof window !== "undefined") {
    window.addEventListener("online", onOnline);
    if (navigator.onLine) {
      void flushOutbox();
    }
  }

  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener("online", onOnline);
    }
  };
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function isOfflineError(e: unknown): boolean {
  return (
    e instanceof ApiError &&
    (e.offline || e.code === "offline" || e.status === 0)
  );
}
