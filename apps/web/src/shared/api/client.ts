const API_BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly offline: boolean;

  constructor(message: string, opts: { status: number; code?: string; offline?: boolean }) {
    super(message);
    this.name = "ApiError";
    this.status = opts.status;
    this.code = opts.code ?? (opts.offline ? "offline" : `http_${opts.status}`);
    this.offline = opts.offline ?? false;
  }
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

function isNavigatorOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function getApiBase(): string {
  return API_BASE;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  if (isNavigatorOffline()) {
    throw new ApiError("You appear to be offline", {
      status: 0,
      code: "offline",
      offline: true,
    });
  }

  const url = path.startsWith("http") ? path : `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError("Network request failed", {
      status: 0,
      code: "offline",
      offline: true,
    });
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let code = `http_${res.status}`;
    try {
      const body = (await res.json()) as { error?: string; code?: string; message?: string };
      message = body.error ?? body.message ?? message;
      if (body.code) code = body.code;
    } catch {
      // keep defaults
    }
    throw new ApiError(message, { status: res.status, code });
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export async function apiFetchSettled<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const data = await apiFetch<T>(path, init);
    return { ok: true, data };
  } catch (e) {
    const error =
      e instanceof ApiError
        ? e
        : new ApiError(e instanceof Error ? e.message : "Unknown error", { status: 0 });
    return { ok: false, error };
  }
}

export function authHeaders(token?: string | null): HeadersInit {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
