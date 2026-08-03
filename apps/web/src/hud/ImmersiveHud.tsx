import type { DeviceStatus, SensorReading, TelemetrySample } from "@verdia/contracts";
import type { Alert } from "../alerts";

type Props = {
  deviceId: string;
  status: DeviceStatus | null;
  latest: TelemetrySample | null;
  sensors: SensorReading | null;
  alerts: Alert[];
  connected: boolean;
  busy: boolean;
  toast: string | null;
  error: string | null;
  onWaterNow: () => void;
  onForceOn: () => void;
  onForceOff: () => void;
  onOpenCapture: () => void;
};

export function ImmersiveHud({
  deviceId,
  status,
  latest,
  sensors,
  alerts,
  connected,
  busy,
  toast,
  error,
  onWaterNow,
  onForceOn,
  onForceOff,
  onOpenCapture,
}: Props) {
  return (
    <div className="hud">
      <header className="hud-brand">
        <p className="hud-kicker">Field canopy</p>
        <h1>
          Verdia <em>AI</em>
        </h1>
        <p className="hud-tagline">
          Step into the living greenhouse — drag to orbit, watch the plant respond
          to real moisture, heat, and irrigation.
        </p>
        <div className="hud-status-row">
          <span className="pill">{deviceId}</span>
          <span className={`pill ${connected ? "live" : ""}`}>
            {connected ? "Signal live" : "Reconnecting"}
          </span>
          <span className={`pill ${status?.pumpOn ? "pump" : ""}`}>
            Pump {status?.pumpOn ? "active" : "idle"}
          </span>
        </div>
      </header>

      <aside className="hud-orbs" aria-label="Live sensors">
        <Orb label="Moisture" value={fmt(sensors?.soilMoisturePct)} unit="%" tone="leaf" />
        <Orb label="Temp" value={fmt(sensors?.temperatureC)} unit="°C" tone="sun" />
        <Orb label="Humidity" value={fmt(sensors?.humidityPct)} unit="%" tone="mist" />
        <Orb label="pH" value={fmt(sensors?.soilPh, 2)} unit="" tone="soil" />
        <Orb label="Tank" value={fmt(sensors?.waterLevelPct)} unit="%" tone="water" />
      </aside>

      <footer className="hud-dock">
        <div className="dock-copy">
          <strong>{shortReason(latest?.irrigationReason)}</strong>
          <span>
            {latest
              ? `Sample ${new Date(latest.timestamp).toLocaleTimeString()}`
              : "Awaiting edge telemetry"}
          </span>
          {alerts[0] ? (
            <span className={`dock-alert ${alerts[0].level}`}>{alerts[0].title}</span>
          ) : (
            <span className="dock-alert ok">Canopy stable</span>
          )}
        </div>
        <div className="dock-actions">
          <button className="btn primary" disabled={busy} onClick={onWaterNow}>
            Water now
          </button>
          <button className="btn ghost" disabled={busy} onClick={onForceOn}>
            Force on
          </button>
          <button className="btn danger" disabled={busy} onClick={onForceOff}>
            Force off
          </button>
          <button className="btn ghost" onClick={onOpenCapture}>
            Scan leaf
          </button>
        </div>
      </footer>

      {error ? <div className="hud-banner error">{error}</div> : null}
      {toast ? <div className="hud-banner toast">{toast}</div> : null}
    </div>
  );
}

function Orb({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string;
  unit: string;
  tone: string;
}) {
  return (
    <div className={`orb tone-${tone}`}>
      <span className="orb-label">{label}</span>
      <span className="orb-value">
        {value}
        {value !== "—" && unit ? <small>{unit}</small> : null}
      </span>
    </div>
  );
}

function fmt(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n.toFixed(digits)).toString();
}

function shortReason(reason?: string): string {
  if (!reason) return "Edge listening";
  return reason.replaceAll("_", " ");
}
