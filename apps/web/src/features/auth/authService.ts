import type { AuthSession } from "@verdia/contracts";
import { apiFetch } from "../../shared/api/client";

const SESSION_KEY = "verdia.ai.session";

export function readStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function writeStoredSession(session: AuthSession | null): void {
  try {
    if (!session) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage failures.
  }
}

export async function createGuestSession(): Promise<AuthSession> {
  const session = await apiFetch<AuthSession>("/auth/guest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  writeStoredSession(session);
  return session;
}

/** Local guest session when API is unavailable during development. */
export function createLocalGuestSession(): AuthSession {
  const now = new Date().toISOString();
  const session: AuthSession = {
    userId: `guest_${crypto.randomUUID()}`,
    displayName: "Guest",
    email: null,
    provider: "guest",
    emailVerified: false,
    isGuest: true,
    createdAt: now,
    expiresAt: null,
  };
  writeStoredSession(session);
  return session;
}

export async function ensureGuestSession(): Promise<AuthSession> {
  const existing = readStoredSession();
  if (existing) return existing;
  try {
    return await createGuestSession();
  } catch {
    return createLocalGuestSession();
  }
}

export function clearSession(): void {
  writeStoredSession(null);
}
