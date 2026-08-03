import { useCallback, useEffect, useState } from "react";
import type { AuthSession } from "@verdia/contracts";
import { OpeningScreen } from "./screens/OpeningScreen";
import { MainShell, type NavId } from "./MainShell";
import { usePlatformStatus } from "../shared/mode/usePlatformStatus";
import { ensureGuestSession, readStoredSession } from "../features/auth/authService";

export type AppPhase = "opening" | "app";

/**
 * App shell — Part 1 Aurora Meadow opening, then functional MainShell.
 * Guest Mode auto-session is OK; Auth remains available in nav.
 */
export function AppShell() {
  const [phase, setPhase] = useState<AppPhase>("opening");
  const [entering, setEntering] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(() => readStoredSession());
  const [nav, setNav] = useState<NavId>("dashboard");
  const platform = usePlatformStatus();

  const finishOpening = useCallback(() => {
    setEntering(true);
    window.setTimeout(() => {
      setPhase("app");
      setEntering(false);
    }, 180);
  }, []);

  useEffect(() => {
    if (phase !== "app") return;
    if (session) return;
    let cancelled = false;
    void (async () => {
      const guest = await ensureGuestSession();
      if (!cancelled) setSession(guest);
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, session]);

  return (
    <div
      className={`app-shell ${phase === "opening" ? "is-opening" : "is-app"} ${entering ? "is-morphing" : ""}`}
    >
      {phase === "opening" ? (
        <OpeningScreen onFinished={finishOpening} />
      ) : (
        <MainShell
          mode={platform.mode}
          session={session}
          onSession={setSession}
          active={nav}
          onNavigate={setNav}
        />
      )}
    </div>
  );
}
