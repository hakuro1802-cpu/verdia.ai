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
  session: AuthSession | null;
  onSession: (session: AuthSession) => void;
  active: NavId;
  onNavigate: (id: NavId) => void;
};

function renderScreen(
  active: NavId,
  session: AuthSession | null,
  onSession: (session: AuthSession) => void,
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

export function MainShell({ mode, session, onSession, active, onNavigate }: Props) {
  return (
    <div className="main-shell">
      <div className="main-aurora" aria-hidden="true" />
      <header className="main-topbar">
        <div className="main-brand-block">
          <p className="main-brand">VERDIA.AI</p>
          <p className="main-assistant">momo.ai</p>
        </div>
        <div className="main-topbar-meta">
          <span className={`mode-badge mode-badge--${mode}`} title="Platform data mode">
            {mode === "live" ? "LIVE" : "DEMO"}
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNavigate("auth")}>
            {session?.isGuest ? "Guest · Auth" : session ? session.displayName : "Auth"}
          </button>
        </div>
      </header>

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
