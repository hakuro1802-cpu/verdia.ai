import { nanoid } from "nanoid";
import type { AuthSession, ServiceAvailability } from "@verdia/contracts";
import type { AuthPort, SessionRepository } from "../domain/ports.js";

const GUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class GuestAuthAdapter implements AuthPort {
  constructor(private readonly sessions: SessionRepository) {}

  availability(): ServiceAvailability {
    return { status: "available" };
  }

  async createGuestSession(displayName?: string): Promise<AuthSession> {
    const now = Date.now();
    const session: AuthSession = {
      userId: `guest_${nanoid(12)}`,
      displayName: displayName?.trim() || "Guest Farmer",
      email: null,
      provider: "guest",
      emailVerified: false,
      isGuest: true,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + GUEST_TTL_MS).toISOString(),
    };
    await this.sessions.save(session);
    return session;
  }
}

/**
 * Firebase auth stub — reports unavailable until FIREBASE_PROJECT_ID is set.
 * Does not fabricate sessions or verify tokens without configuration.
 */
export class FirebaseAuthAdapter implements AuthPort {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly projectId: string | undefined = process.env.FIREBASE_PROJECT_ID,
  ) {}

  availability(): ServiceAvailability {
    if (!this.projectId) {
      return {
        status: "unavailable",
        reason: "FIREBASE_PROJECT_ID is not configured",
        code: "firebase_not_configured",
      };
    }
    return {
      status: "degraded",
      reason:
        "FIREBASE_PROJECT_ID is set but full Firebase Admin verification is not wired yet",
      code: "firebase_partial",
    };
  }

  async createGuestSession(displayName?: string): Promise<AuthSession> {
    // Guests always work via the guest path even when Firebase is the primary adapter
    const guest = new GuestAuthAdapter(this.sessions);
    return guest.createGuestSession(displayName);
  }

  async createFirebaseSession(
    _idToken: string,
  ): Promise<AuthSession | { unavailable: ServiceAvailability }> {
    const avail = this.availability();
    if (avail.status === "unavailable") {
      return { unavailable: avail };
    }
    // Honest: even with project id we do not fabricate a verified user
    return {
      unavailable: {
        status: "unavailable",
        reason:
          "Firebase token verification is not fully configured (Admin SDK missing)",
        code: "firebase_verify_unavailable",
      },
    };
  }
}

/** Composite: guest always available; Firebase optional. */
export class CompositeAuthAdapter implements AuthPort {
  constructor(
    private readonly guest: GuestAuthAdapter,
    private readonly firebase: FirebaseAuthAdapter,
  ) {}

  availability(): ServiceAvailability {
    return this.firebase.availability();
  }

  createGuestSession(displayName?: string): Promise<AuthSession> {
    return this.guest.createGuestSession(displayName);
  }

  createFirebaseSession(idToken: string) {
    return this.firebase.createFirebaseSession(idToken);
  }
}
