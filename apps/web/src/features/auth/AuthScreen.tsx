import { useCallback, useEffect, useState } from "react";
import type { AuthSession } from "@verdia/contracts";
import { FeatureState, mapErrorToState, type FeatureStateKind } from "../../shared/ui/FeatureState";
import { ApiError } from "../../shared/api/client";
import {
  clearSession,
  createGuestSession,
  createLocalGuestSession,
  ensureGuestSession,
  fetchAuthStatus,
  isFirebaseClientConfigured,
  readStoredSession,
  type AuthStatus,
} from "./authService";

type Props = {
  session: AuthSession | null;
  onSession: (session: AuthSession | null) => void;
  onContinueGuest: () => void;
};

export function AuthScreen({ session, onSession, onContinueGuest }: Props) {
  const [state, setState] = useState<FeatureStateKind>("ready");
  const [message, setMessage] = useState<string | undefined>();
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [statusState, setStatusState] = useState<FeatureStateKind>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) return;
    const stored = readStoredSession();
    if (stored) onSession(stored);
  }, [session, onSession]);

  const loadAuthStatus = useCallback(async () => {
    setStatusState("loading");
    try {
      const status = await fetchAuthStatus();
      setAuthStatus(status);
      setStatusState("ready");
    } catch (e) {
      const err =
        e instanceof ApiError
          ? e
          : new ApiError(e instanceof Error ? e.message : "Failed", { status: 0 });
      const mapped = mapErrorToState(err);
      setAuthStatus(null);
      setStatusState(mapped.state);
      setMessage(mapped.message);
    }
  }, []);

  useEffect(() => {
    void loadAuthStatus();
  }, [loadAuthStatus]);

  const startGuest = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setState("loading");
    setMessage(undefined);
    try {
      const next = await createGuestSession();
      onSession(next);
      setState("ready");
      onContinueGuest();
    } catch (e) {
      const err =
        e instanceof ApiError
          ? e
          : new ApiError(e instanceof Error ? e.message : "Auth failed", { status: 0 });
      const local = createLocalGuestSession();
      onSession(local);
      const mapped = mapErrorToState(err);
      setMessage(
        mapped.state === "offline"
          ? "Continuing offline as Guest."
          : "Guest API unavailable — continuing with local Guest session.",
      );
      setState("ready");
      onContinueGuest();
    } finally {
      setBusy(false);
    }
  }, [busy, onContinueGuest, onSession]);

  const ensureAndContinue = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setState("loading");
    try {
      const next = await ensureGuestSession();
      onSession(next);
      setState("ready");
      onContinueGuest();
    } catch (e) {
      const err =
        e instanceof ApiError
          ? e
          : new ApiError(e instanceof Error ? e.message : "Auth failed", { status: 0 });
      const mapped = mapErrorToState(err);
      setState(mapped.state);
      setMessage(mapped.message);
    } finally {
      setBusy(false);
    }
  }, [busy, onContinueGuest, onSession]);

  const signOut = useCallback(() => {
    clearSession();
    onSession(null);
    setMessage("Signed out. You can continue as Guest anytime.");
  }, [onSession]);

  const firebaseAvailable =
    authStatus?.firebase?.status === "available" && isFirebaseClientConfigured();

  if (state !== "ready" && state !== "loading") {
    return (
      <main className="auth-screen">
        <FeatureState state={state} message={message} onRetry={() => void ensureAndContinue()} />
      </main>
    );
  }

  return (
    <main className="auth-screen">
      <div className="auth-aurora" aria-hidden="true" />
      <header className="auth-header">
        <p className="auth-brand">VERDIA.AI</p>
        <p className="auth-assistant">with momo.ai</p>
      </header>
      <section className="auth-body">
        <h1>Sign in or continue as Guest</h1>
        <p>
          Guest Mode starts a session so you can explore the platform. Full accounts require
          Firebase configuration.
        </p>

        <div className="auth-setup-panel" role="status">
          <p className="auth-setup-title">Email &amp; Google Sign-In require Firebase</p>
          <p>
            Set <code>VITE_FIREBASE_*</code> and <code>FIREBASE_PROJECT_ID</code>. Until then,
            Guest Mode is the supported path.
          </p>
          {statusState === "loading" ? (
            <FeatureState state="loading" compact title="Checking auth services" />
          ) : statusState !== "ready" ? (
            <FeatureState
              state={statusState}
              message={message ?? "Could not load /auth/status."}
              onRetry={() => void loadAuthStatus()}
              compact
            />
          ) : (
            <ul className="auth-status-list">
              <li>
                Guest:{" "}
                {authStatus?.guest.status === "available"
                  ? "available"
                  : authStatus?.guest.status === "unavailable"
                    ? `unavailable — ${authStatus.guest.reason}`
                    : authStatus?.guest.status ?? "unknown"}
              </li>
              <li>
                Firebase:{" "}
                {authStatus?.firebase.status === "available"
                  ? isFirebaseClientConfigured()
                    ? "available"
                    : "server ready — set VITE_FIREBASE_API_KEY on the client"
                  : authStatus?.firebase.status === "unavailable"
                    ? `unavailable — ${authStatus.firebase.reason}`
                    : authStatus?.firebase.status === "degraded"
                      ? `degraded — ${authStatus.firebase.reason}`
                      : "unknown"}
              </li>
            </ul>
          )}
        </div>

        {message ? <p className="auth-note">{message}</p> : null}
        {state === "loading" || busy ? (
          <FeatureState state="loading" compact />
        ) : (
          <div className="auth-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void startGuest()}
            >
              Continue as Guest
            </button>
            {firebaseAvailable ? (
              <p className="auth-note">
                Firebase client keys are present. Wire the Firebase Auth SDK to obtain an ID
                token, then POST <code>/auth/firebase</code>.
              </p>
            ) : null}
            {session ? (
              <button type="button" className="btn btn-ghost" onClick={signOut}>
                Clear session / Logout
              </button>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}
