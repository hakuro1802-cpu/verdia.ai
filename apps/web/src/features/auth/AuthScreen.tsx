import { useCallback, useEffect, useState } from "react";
import type { AuthSession } from "@verdia/contracts";
import { FeatureState, mapErrorToState, type FeatureStateKind } from "../../shared/ui/FeatureState";
import { ApiError } from "../../shared/api/client";
import {
  clearSession,
  createGuestSession,
  createLocalGuestSession,
  ensureGuestSession,
  readStoredSession,
} from "./authService";

type Props = {
  session: AuthSession | null;
  onSession: (session: AuthSession) => void;
  onContinueGuest: () => void;
};

export function AuthScreen({ session, onSession, onContinueGuest }: Props) {
  const [state, setState] = useState<FeatureStateKind>("ready");
  const [message, setMessage] = useState<string | undefined>();

  useEffect(() => {
    if (session) return;
    const stored = readStoredSession();
    if (stored) onSession(stored);
  }, [session, onSession]);

  const startGuest = useCallback(async () => {
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
      // Guest Mode auto-session is OK even if API is down.
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
    }
  }, [onContinueGuest, onSession]);

  const ensureAndContinue = useCallback(async () => {
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
    }
  }, [onContinueGuest, onSession]);

  const signOut = useCallback(() => {
    clearSession();
    setMessage("Signed out. You can continue as Guest anytime.");
  }, []);

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
          Guest Mode starts a local session so you can explore the platform. Full accounts arrive
          when Firebase auth is configured.
        </p>
        {message ? <p className="auth-note">{message}</p> : null}
        {state === "loading" ? (
          <FeatureState state="loading" compact />
        ) : (
          <div className="auth-actions">
            <button type="button" className="btn btn-primary" onClick={() => void startGuest()}>
              Continue as Guest
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled
              title="Email sign-in is not configured yet"
            >
              Email (unavailable)
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled
              title="Google sign-in is not configured yet"
            >
              Google (unavailable)
            </button>
            {session ? (
              <button type="button" className="btn btn-ghost" onClick={signOut}>
                Clear session
              </button>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}
