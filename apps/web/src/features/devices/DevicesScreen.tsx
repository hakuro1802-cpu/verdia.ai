import { useCallback, useEffect, useState } from "react";
import type { DeviceStatus } from "@verdia/contracts";
import { ApiError } from "../../shared/api/client";
import { FeatureState, mapErrorToState, type FeatureStateKind } from "../../shared/ui/FeatureState";
import { listDevices, sendPumpCommand } from "./devicesService";

export function DevicesScreen() {
  const [devices, setDevices] = useState<DeviceStatus[]>([]);
  const [state, setState] = useState<FeatureStateKind>("loading");
  const [message, setMessage] = useState<string | undefined>();
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    setMessage(undefined);
    try {
      const items = await listDevices();
      setDevices(items);
      setState(items.length === 0 ? "empty" : "ready");
    } catch (e) {
      const err =
        e instanceof ApiError
          ? e
          : new ApiError(e instanceof Error ? e.message : "Failed", { status: 0 });
      const mapped = mapErrorToState(err);
      setState(mapped.state);
      setMessage(mapped.message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pump = async (deviceId: string, action: "on" | "off" | "pulse") => {
    setActionMsg(null);
    try {
      await sendPumpCommand(deviceId, action, action === "pulse" ? 5000 : undefined);
      setActionMsg(`Pump ${action} accepted for ${deviceId}`);
      await load();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "Pump command failed");
    }
  };

  return (
    <main className="feature-screen">
      <header className="feature-screen__header">
        <div>
          <p className="feature-kicker">Devices</p>
          <h1>Device fleet</h1>
          <p className="feature-lede">Online status and pump controls from the API.</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => void load()}>
          Refresh
        </button>
      </header>

      {actionMsg ? <p className="auth-note">{actionMsg}</p> : null}

      <FeatureState
        state={state}
        message={message}
        onRetry={() => void load()}
        title={state === "empty" ? "No devices" : undefined}
      >
        <ul className="device-list">
          {devices.map((d) => (
            <li key={d.deviceId} className="device-row">
              <div>
                <strong>{d.deviceId}</strong>
                <p className="muted">
                  {d.online ? "Online" : "Offline"} · {d.network} · pump{" "}
                  {d.pumpOn ? "on" : "off"}
                  {d.lastSeenAt ? ` · seen ${new Date(d.lastSeenAt).toLocaleString()}` : ""}
                </p>
              </div>
              <div className="device-actions">
                <button type="button" className="btn btn-ghost" onClick={() => void pump(d.deviceId, "pulse")}>
                  Pulse
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => void pump(d.deviceId, "on")}>
                  On
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => void pump(d.deviceId, "off")}>
                  Off
                </button>
              </div>
            </li>
          ))}
        </ul>
      </FeatureState>
    </main>
  );
}
