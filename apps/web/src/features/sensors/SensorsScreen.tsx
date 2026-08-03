import { useCallback, useEffect, useState } from "react";
import type { DeviceStatus, TelemetrySample } from "@verdia/contracts";
import { ApiError } from "../../shared/api/client";
import { FeatureState, mapErrorToState, type FeatureStateKind } from "../../shared/ui/FeatureState";
import { listDevices } from "../devices/devicesService";
import { fetchSensors, formatSensorValue } from "./sensorsService";

export function SensorsScreen() {
  const [devices, setDevices] = useState<DeviceStatus[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [latest, setLatest] = useState<TelemetrySample | null>(null);
  const [history, setHistory] = useState<TelemetrySample[]>([]);
  const [state, setState] = useState<FeatureStateKind>("loading");
  const [message, setMessage] = useState<string | undefined>();
  const [devicesLoaded, setDevicesLoaded] = useState(false);

  const loadDevices = useCallback(async () => {
    try {
      const items = await listDevices();
      setDevices(items);
      setDeviceId((prev) => {
        if (prev && items.some((d) => d.deviceId === prev)) return prev;
        return items[0]?.deviceId ?? null;
      });
      setDevicesLoaded(true);
      if (items.length === 0) {
        setState("empty");
        setMessage("No verified device. Pair ESP32 or wait for telemetry.");
      }
      return items;
    } catch (e) {
      const err =
        e instanceof ApiError
          ? e
          : new ApiError(e instanceof Error ? e.message : "Failed", { status: 0 });
      const mapped = mapErrorToState(err);
      setDevices([]);
      setDeviceId(null);
      setDevicesLoaded(true);
      setState(mapped.state);
      setMessage(mapped.message);
      return [];
    }
  }, []);

  const loadSensors = useCallback(async (id: string) => {
    setState("loading");
    setMessage(undefined);
    try {
      const data = await fetchSensors(id);
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

  const load = useCallback(async () => {
    const items = await loadDevices();
    const id =
      deviceId && items.some((d) => d.deviceId === deviceId)
        ? deviceId
        : items[0]?.deviceId ?? null;
    if (id) await loadSensors(id);
  }, [deviceId, loadDevices, loadSensors]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!devicesLoaded) return;
    if (!deviceId) {
      if (devices.length === 0) {
        setState("empty");
        setMessage("No verified device. Pair ESP32 or wait for telemetry.");
      }
      return;
    }
    void loadSensors(deviceId);
  }, [deviceId, devicesLoaded, devices.length, loadSensors]);

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

      <label className="device-select-label">
        Device
        <select
          className="device-select"
          value={deviceId ?? ""}
          onChange={(e) => setDeviceId(e.target.value || null)}
          aria-label="Select device"
          disabled={devices.length === 0}
        >
          {devices.length === 0 ? (
            <option value="">No verified device</option>
          ) : (
            devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.deviceId}
                {d.online ? " · online" : " · offline"}
              </option>
            ))
          )}
        </select>
      </label>

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
              {status?.deviceId ?? deviceId ?? "—"} ·{" "}
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
