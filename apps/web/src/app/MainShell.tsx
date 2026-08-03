import { useCallback, useEffect, useState } from "react";
import type { AuthSession } from "@verdia/contracts";
import type { AppMode } from "@verdia/contracts";
import { AuthScreen } from "../features/auth/AuthScreen";
import { CameraScreen } from "../features/camera/CameraScreen";
import { DashboardScreen } from "../features/dashboard/DashboardScreen";
import { DevicesScreen } from "../features/devices/DevicesScreen";
import { FarmsScreen } from "../features/farms/FarmsScreen";
import { MomoScreen } from "../features/momo/MomoScreen";
import { NotificationsScreen } from "../features/notifications/NotificationsScreen";
import { RecommendationsScreen } from "../features/recommendations/RecommendationsScreen";
import { ReportsScreen } from "../features/reports/ReportsScreen";
import { SensorsScreen } from "../features/sensors/SensorsScreen";
import { WeatherScreen } from "../features/weather/WeatherScreen";
import type { FeatureStateKind } from "../shared/ui/FeatureState";
import {
  flushOutbox,
  getOutboxLength,
  startOutboxSync,
  subscribeOutbox,
} from "../shared/offline/outbox";

export type NavId =
  | "dashboard"
  | "farms"
  | "devices"
  | "sensors"
  | "camera"
  | "momo"
  | "recommendations"
  | "weather"
  | "reports"
  | "notifications"
  | "auth";

const NAV: Array<{ id: NavId; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "farms", label: "Farms" },
  { id: "devices", label: "Devices" },
  { id: "sensors", label: "Sensors" },
  { id: "camera", label: "Camera" },
  { id: "momo", label: "momo.ai" },
  { id: "recommendations", label: "Tips" },
  { id: "weather", label: "Weather" },
  { id: "reports", label: "Reports" },
  { id: "notifications", label: "Alerts" },
  { id: "auth", label: "Auth" },
];

type Props = {
  mode: AppMode;
  platformState: FeatureStateKind;
  platformMessage?: string;
  onPlatformRetry: () => void;
  session: AuthSession | null;
  onSession: (session: AuthSession | null) => void;
  active: NavId;
  onNavigate: (id: NavId) => void;
};

function renderScreen(
  active: NavId,
  session: AuthSession | null,
  onSession: (session: AuthSession | null) => void,
  onNavigate: (id: NavId) => void,
) {
  switch (active) {
    case "dashboard":
      return <DashboardScreen />;
    case "farms":
      return <FarmsScreen />;
    case "devices":
      return <DevicesScreen />;
    case "sensors":
      return <SensorsScreen />;
    case "camera":
      return <CameraScreen />;
    case "momo":
      return <MomoScreen />;
    case "recommendations":
      return <RecommendationsScreen />;
    case "weather":
      return <WeatherScreen />;
    case "reports":
      return <ReportsScreen />;
    case "notifications":
      return <NotificationsScreen />;
    case "auth":
      return (
        <AuthScreen
          session={session}
          onSession={onSession}
          onContinueGuest={() => onNavigate("dashboard")}
        />
      );
    default:
      return <DashboardScreen />;
  }
}

function modeBadgeLabel(mode: AppMode, platformState: FeatureStateKind): string {
  if (platformState === "loading") return "…";
  return mode === "live" ? "LIVE" : "DEMO";
}

export function MainShell({
  mode,
  platformState,
  platformMessage,
  onPlatformRetry,
  session,
  onSession,
  active,
  onNavigate,
}: Props) {
  const [queued, setQueued] = useState(() => getOutboxLength());
  const [flushing, setFlushing] = useState(false);
  const [flushMsg, setFlushMsg] = useState<string | null>(null);

  useEffect(() => startOutboxSync(), []);

  useEffect(() => subscribeOutbox((entries) => setQueued(entries.length)), []);

  const onFlush = useCallback(async () => {
    if (flushing) return;
    setFlushing(true);
    setFlushMsg(null);
    try {
      const result = await flushOutbox();
      setFlushMsg(
        result.errors.length
          ? `Flushed ${result.flushed}; ${result.remaining} left (${result.errors[0]})`
          : `Flushed ${result.flushed}`,
      );
    } catch (e) {
      setFlushMsg(e instanceof Error ? e.message : "Flush failed");
    } finally {
      setFlushing(false);
    }
  }, [flushing]);

  const showOfflineBanner =
    platformState === "offline" || platformState === "unavailable";

  return (
    <div className="main-shell">
      <div className="main-aurora" aria-hidden="true" />
      <header className="main-topbar">
        <div className="main-brand-block">
          <p className="main-brand">VERDIA.AI</p>
          <p className="main-assistant">momo.ai</p>
        </div>
        <div className="main-topbar-meta">
          {queued > 0 ? (
            <span className="sync-chip" title="Offline outbox">
              Sync: {queued} queued
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={flushing}
                onClick={() => void onFlush()}
              >
                {flushing ? "Flushing…" : "Flush"}
              </button>
            </span>
          ) : null}
          {flushMsg ? <span className="sync-chip-msg muted">{flushMsg}</span> : null}
          <span
            className={`mode-badge mode-badge--${platformState === "loading" ? "live" : mode}`}
            title="Platform data mode"
          >
            {modeBadgeLabel(mode, platformState)}
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNavigate("auth")}>
            {session?.isGuest ? "Guest · Auth" : session ? session.displayName : "Auth"}
          </button>
        </div>
      </header>

      {showOfflineBanner ? (
        <div className="offline-banner" role="alert">
          <p>
            {platformState === "offline"
              ? platformMessage ?? "Platform unreachable — you appear offline."
              : platformMessage ?? "Platform status unavailable."}
          </p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onPlatformRetry}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="main-layout">
        <nav className="main-nav" aria-label="Primary">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={active === item.id ? "is-active" : ""}
              onClick={() => onNavigate(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="main-content">{renderScreen(active, session, onSession, onNavigate)}</div>
      </div>
    </div>
  );
}
