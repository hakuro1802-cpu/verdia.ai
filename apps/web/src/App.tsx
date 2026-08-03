import { useEffect, useState } from "react";
import type { DeviceStatus, TelemetrySample } from "@verdia/contracts";
import { fetchAnalyses, fetchDashboard, sendPumpCommand } from "./api";
import { buildAlerts } from "./alerts";
import { CaptureDrawer } from "./hud/CaptureDrawer";
import { ImmersiveHud } from "./hud/ImmersiveHud";
import { GreenhouseCanvas } from "./scene/GreenhouseCanvas";

const DEVICE_ID = import.meta.env.VITE_DEVICE_ID ?? "ESP32_001";

export function App() {
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [latest, setLatest] = useState<TelemetrySample | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const data = await fetchDashboard(DEVICE_ID);
        if (!alive) return;
        setStatus(data.status);
        setLatest(data.latest);
        setError(null);
        setConnected(true);
      } catch (e) {
        if (!alive) return;
        setConnected(false);
        setError(e instanceof Error ? e.message : "Failed to load live canopy");
      }
    }
    void tick();
    const id = window.setInterval(tick, 2500);
    return () => {
      alive = false;
      window.clearInterval(id);
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
          ? "Irrigation pulse queued — watch the canopy"
          : `Pump ${action} queued`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Command failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="immersive">
      <GreenhouseCanvas latest={latest} />
      <ImmersiveHud
        deviceId={DEVICE_ID}
        status={status}
        latest={latest}
        sensors={sensors}
        alerts={alerts}
        connected={connected}
        busy={busy}
        toast={toast}
        error={error}
        onWaterNow={() => void pump("pulse", 4000)}
        onForceOn={() => void pump("on")}
        onForceOff={() => void pump("off")}
        onOpenCapture={() => setCaptureOpen(true)}
      />
      <CaptureDrawer
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        deviceId={DEVICE_ID}
        sensors={sensors}
        onAnalyzed={() => void fetchAnalyses(4)}
      />
    </div>
  );
}
