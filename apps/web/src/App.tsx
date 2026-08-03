import { useEffect, useState } from "react";
import type { DeviceStatus, TelemetrySample } from "@verdia/contracts";
import { fetchDashboard, sendPumpCommand } from "./api";
import { CameraPanel } from "./components/CameraPanel";
import { Metric } from "./components/Metric";
import { MoistureChart } from "./components/MoistureChart";

const DEVICE_ID = import.meta.env.VITE_DEVICE_ID ?? "ESP32_001";

export function App() {
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [latest, setLatest] = useState<TelemetrySample | null>(null);
  const [history, setHistory] = useState<TelemetrySample[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load dashboard");
      }
    }

    void tick();
    const id = window.setInterval(tick, 3000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const sensors = latest?.sensors ?? null;

  return (
    <div className="app">
      <header className="brand-hero">
        <h1>
          Verdia <span>AI</span>
        </h1>
        <p>
          Smart plant monitoring and irrigation — live sensors at the edge, care
          guidance when you capture a leaf.
        </p>
        <div className="toolbar">
          <span className="device-chip">Device {DEVICE_ID}</span>
          <span className={`status-pill ${status?.pumpOn ? "on" : ""}`}>
            Pump {status?.pumpOn ? "ON" : "OFF"}
          </span>
          <span className="status-pill">
            {status?.online ? "Online" : "Waiting for telemetry"}
          </span>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}

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
            <p className="hint">Start the API simulator or flash ESP32 firmware.</p>
          )}
        </section>

        <section className="panel controls">
          <h2>Irrigation controls</h2>
          <p className="hint">
            Automatic watering stays on the ESP32. These buttons queue manual
            overrides for the device to poll.
          </p>
          <div className="btn-row" style={{ marginTop: "1rem" }}>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                run(setBusy, () => sendPumpCommand(DEVICE_ID, "pulse", 4000))
              }
            >
              Water now
            </button>
            <button
              className="ghost"
              disabled={busy}
              onClick={() => run(setBusy, () => sendPumpCommand(DEVICE_ID, "on"))}
            >
              Force on
            </button>
            <button
              className="danger"
              disabled={busy}
              onClick={() => run(setBusy, () => sendPumpCommand(DEVICE_ID, "off"))}
            >
              Force off
            </button>
          </div>
        </section>

        <section className="panel chart">
          <h2>Moisture trend</h2>
          <MoistureChart history={history} />
        </section>

        <CameraPanel deviceId={DEVICE_ID} sensors={sensors} />
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

async function run(setBusy: (v: boolean) => void, fn: () => Promise<void>) {
  setBusy(true);
  try {
    await fn();
  } finally {
    setBusy(false);
  }
}
