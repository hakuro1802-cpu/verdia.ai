import { useCallback, useEffect, useState } from "react";
import type { DeviceStatus, TelemetrySample } from "@verdia/contracts";
import { ApiError } from "../../shared/api/client";
import { FeatureState, mapErrorToState, type FeatureStateKind } from "../../shared/ui/FeatureState";
import { DEFAULT_DEVICE, fetchSensors, formatSensorValue } from "./sensorsService";

export function SensorsScreen() {
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [latest, setLatest] = useState<TelemetrySample | null>(null);
  const [history, setHistory] = useState<TelemetrySample[]>([]);
  const [state, setState] = useState<FeatureStateKind>("loading");
  const [message, setMessage] = useState<string | undefined>();

  const load = useCallback(async () => {
    setState("loading");
    setMessage(undefined);
    try {
      const data = await fetchSensors(DEFAULT_DEVICE);
      setStatus(data.status);
      setLatest(data.latest);
      setHistory(data.history ?? []);
      if (!data.latest) {
        setState("empty");
        setMessage("No live sensor sample from the device yet.");
      } else {
        setState("ready");
      }
    } catch (e) {
      const err =
        e instanceof ApiError
          ? e
          : new ApiError(e instanceof Error ? e.message : "Failed", { status: 0 });
      const mapped = mapErrorToState(err);
      setStatus(null);
      setLatest(null);
      setHistory([]);
      setState(mapped.state);
      setMessage(mapped.message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const s = latest?.sensors;

  return (
    <main className="feature-screen">
      <header className="feature-screen__header">
        <div>
          <p className="feature-kicker">Sensors</p>
          <h1>Live readings</h1>
          <p className="feature-lede">
            Values appear only when the API returns them. Missing sensors show as unavailable.
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => void load()}>
          Refresh
        </button>
      </header>

      <FeatureState state={state} message={message} onRetry={() => void load()}>
        <div className="sensor-grid">
          <div className="sensor-tile">
            <span>Soil moisture</span>
            <strong>{formatSensorValue(s?.soilMoisturePct, "%")}</strong>
          </div>
          <div className="sensor-tile">
            <span>Temperature</span>
            <strong>{formatSensorValue(s?.temperatureC, "°C")}</strong>
          </div>
          <div className="sensor-tile">
            <span>Humidity</span>
            <strong>{formatSensorValue(s?.humidityPct, "%")}</strong>
          </div>
          <div className="sensor-tile">
            <span>Soil pH</span>
            <strong>{formatSensorValue(s?.soilPh, "")}</strong>
          </div>
          <div className="sensor-tile">
            <span>Water level</span>
            <strong>{formatSensorValue(s?.waterLevelPct, "%")}</strong>
          </div>
          <div className="sensor-tile">
            <span>Device</span>
            <strong>
              {status?.deviceId ?? DEFAULT_DEVICE} ·{" "}
              {status?.online ? "online" : status ? "offline" : "unavailable"}
            </strong>
          </div>
        </div>
        <p className="muted">
          History points: {history.length}
          {latest?.timestamp ? ` · latest ${new Date(latest.timestamp).toLocaleString()}` : ""}
        </p>
      </FeatureState>
    </main>
  );
}
