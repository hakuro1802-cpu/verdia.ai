import { useEffect, useState } from "react";
import type { DeviceStatus, PlantAnalysisResult, TelemetrySample } from "@verdia/contracts";
import { fetchAnalyses, fetchDashboard, sendPumpCommand } from "./api";
import { buildAlerts } from "./alerts";
import { AlertsPanel } from "./components/AlertsPanel";
import { AnalysisHistory } from "./components/AnalysisHistory";
import { CameraPanel } from "./components/CameraPanel";
import { Metric } from "./components/Metric";
import { MoistureChart } from "./components/MoistureChart";

const DEVICE_ID = import.meta.env.VITE_DEVICE_ID ?? "ESP32_001";

export function App() {
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [latest, setLatest] = useState<TelemetrySample | null>(null);
  const [history, setHistory] = useState<TelemetrySample[]>([]);
  const [analyses, setAnalyses] = useState<PlantAnalysisResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);

  async function refreshAnalyses() {
    try {
      setAnalyses(await fetchAnalyses(8));
    } catch {
      /* non-fatal */
    }
  }

  useEffect(() => {
    let alive = true;

    async function tick() {
      try {
        const data = await fetchDashboard(DEVICE_ID);
        if (!alive) return;
        setStatus(data.status);
        setLatest(data.latest);
        setHistory(data.history);
        setError(null);
        setConnected(true);
      } catch (e) {
        if (!alive) return;
        setConnected(false);
        setError(e instanceof Error ? e.message : "Failed to load dashboard");
      }
    }

    void tick();
    void refreshAnalyses();
    const id = window.setInterval(tick, 2500);
    const analysisId = window.setInterval(() => void refreshAnalyses(), 12000);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.clearInterval(analysisId);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const sensors = latest?.sensors ?? null;
  const alerts = buildAlerts(sensors, latest);

  async function pump(action: "on" | "off" | "pulse", durationMs?: number) {
    setBusy(true);
    try {
      await sendPumpCommand(DEVICE_ID, action, durationMs);
      setToast(
        action === "pulse"
          ? "Water pulse queued for the device"
          : `Pump ${action} command queued`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Command failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <header className="brand-hero">
        <h1>
          Verdia <span>AI</span>
        </h1>
        <p>
          Complete plant monitoring and irrigation — live edge sensors, manual
          controls, and on-demand leaf analysis.
        </p>
        <div className="toolbar">
          <span className="device-chip">Device {DEVICE_ID}</span>
          <span className={`status-pill ${status?.pumpOn ? "on" : ""}`}>
            Pump {status?.pumpOn ? "ON" : "OFF"}
          </span>
          <span className={`status-pill ${connected ? "on" : ""}`}>
            {connected ? "Live" : "Reconnecting…"}
          </span>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}
      {toast ? <div className="toast">{toast}</div> : null}

      <div className="grid">
        <section className="panel readings">
          <h2>Live readings</h2>
          <div className="readings-grid">
            <Metric label="Soil moisture" value={sensors?.soilMoisturePct} unit="%" />
            <Metric label="Temperature" value={fmt(sensors?.temperatureC)} unit="°C" />
            <Metric label="Humidity" value={fmt(sensors?.humidityPct)} unit="%" />
            <Metric label="Soil pH" value={sensors?.soilPh} />
            <Metric label="Water tank" value={fmt(sensors?.waterLevelPct)} unit="%" />
            <Metric
              label="Edge decision"
              value={shortReason(latest?.irrigationReason)}
            />
          </div>
          {latest ? (
            <p className="hint">
              Last sample {new Date(latest.timestamp).toLocaleTimeString()}
            </p>
          ) : (
            <p className="hint">Waiting for telemetry from the simulator or ESP32…</p>
          )}
        </section>

        <section className="panel controls">
          <h2>Irrigation controls</h2>
          <p className="hint">
            Automatic watering stays on the ESP32. These buttons queue manual
            overrides for the device to poll.
          </p>
          <div className="btn-row" style={{ marginTop: "1rem" }}>
            <button className="primary" disabled={busy} onClick={() => pump("pulse", 4000)}>
              Water now
            </button>
            <button className="ghost" disabled={busy} onClick={() => pump("on")}>
              Force on
            </button>
            <button className="danger" disabled={busy} onClick={() => pump("off")}>
              Force off
            </button>
          </div>
        </section>

        <AlertsPanel alerts={alerts} />

        <section className="panel chart">
          <h2>Moisture trend</h2>
          <MoistureChart history={history} />
        </section>

        <CameraPanel
          deviceId={DEVICE_ID}
          sensors={sensors}
          onAnalyzed={() => void refreshAnalyses()}
        />

        <section className="panel history">
          <h2>Recent analyses</h2>
          <AnalysisHistory items={analyses} />
        </section>
      </div>

      <p className="footer-note">
        Plant analysis uses the mock Verdia adapter until an official API is
        available. Location and images are only sent with your consent.
      </p>
    </div>
  );
}

function fmt(n: number | null | undefined): string | number | null {
  if (n == null) return null;
  return Number(n.toFixed(1));
}

function shortReason(reason?: string): string {
  if (!reason) return "—";
  return reason.replaceAll("_", " ");
}
