import { useCallback, useEffect, useRef, useState } from "react";
import type { DeviceStatus, PlantAnalysisResult } from "@verdia/contracts";
import { ApiError } from "../../shared/api/client";
import { FeatureState, mapErrorToState, type FeatureStateKind } from "../../shared/ui/FeatureState";
import { listDevices } from "../devices/devicesService";
import { listAnalyses, uploadAnalysis } from "./cameraService";

export function CameraScreen() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [devices, setDevices] = useState<DeviceStatus[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [history, setHistory] = useState<PlantAnalysisResult[]>([]);
  const [state, setState] = useState<FeatureStateKind>("loading");
  const [message, setMessage] = useState<string | undefined>();
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [latest, setLatest] = useState<PlantAnalysisResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [consentImage, setConsentImage] = useState(true);
  const [consentLocation, setConsentLocation] = useState(false);

  const loadDevices = useCallback(async () => {
    try {
      const items = await listDevices();
      setDevices(items);
      setDeviceId((prev) => {
        if (prev && items.some((d) => d.deviceId === prev)) return prev;
        return items[0]?.deviceId ?? null;
      });
      return items;
    } catch {
      setDevices([]);
      setDeviceId(null);
      return [];
    }
  }, []);

  const load = useCallback(async () => {
    setState("loading");
    setMessage(undefined);
    const items = await loadDevices();
    if (items.length === 0) {
      setHistory([]);
      setState("empty");
      setMessage("No verified device. Pair ESP32 or wait for telemetry.");
      return;
    }
    try {
      const analyses = await listAnalyses();
      setHistory(analyses);
      setState(analyses.length === 0 ? "empty" : "ready");
      if (analyses.length === 0) {
        setMessage("No analyses yet.");
      }
    } catch (e) {
      const err =
        e instanceof ApiError
          ? e
          : new ApiError(e instanceof Error ? e.message : "Failed", { status: 0 });
      const mapped = mapErrorToState(err);
      setState(mapped.state);
      setMessage(mapped.message);
    }
  }, [loadDevices]);

  useEffect(() => {
    void load();
  }, [load]);

  const onFile = async (file: File | undefined) => {
    if (!file || busy) return;
    if (!deviceId) {
      setRejectReason("No verified device. Pair ESP32 or wait for telemetry.");
      return;
    }
    setBusy(true);
    setRejectReason(null);
    setLatest(null);
    try {
      let latitude: number | undefined;
      let longitude: number | undefined;
      if (consentLocation && "geolocation" in navigator) {
        const pos = await new Promise<GeolocationPosition | null>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (p) => resolve(p),
            () => resolve(null),
            { timeout: 5000 },
          );
        });
        if (pos) {
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
        }
      }

      const gate = await uploadAnalysis({
        file,
        deviceId,
        sensors: null,
        consentImage,
        consentLocation,
        latitude,
        longitude,
      });

      if (!gate.accepted) {
        setRejectReason(gate.reason);
        return;
      }

      setLatest(gate.result);
      await load();
    } catch (e) {
      const err =
        e instanceof ApiError
          ? e
          : new ApiError(e instanceof Error ? e.message : "Upload failed", { status: 0 });
      const mapped = mapErrorToState(err);
      setState(mapped.state);
      setMessage(mapped.message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const noDevice = devices.length === 0 || !deviceId;

  return (
    <main className="feature-screen">
      <header className="feature-screen__header">
        <div>
          <p className="feature-kicker">Camera</p>
          <h1>Plant capture</h1>
          <p className="feature-lede">
            Tiny or blurry-looking images are rejected on-device before upload.
          </p>
        </div>
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

      <div className="camera-controls">
        <label className="check">
          <input
            type="checkbox"
            checked={consentImage}
            onChange={(e) => setConsentImage(e.target.checked)}
          />
          Consent to analyze image
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={consentLocation}
            onChange={(e) => setConsentLocation(e.target.checked)}
          />
          Share location
        </label>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          disabled={busy || !consentImage || noDevice}
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        {busy ? <FeatureState state="loading" compact title="Uploading" /> : null}
        {rejectReason ? (
          <div className="reject-banner" role="alert">
            <strong>Rejected</strong>
            <p>{rejectReason}</p>
          </div>
        ) : null}
        {latest ? (
          <div className="analysis-result">
            <h2>{latest.plantName ?? "Analysis"}</h2>
            <p>{latest.diagnosis}</p>
            <p className="muted">
              Confidence {Math.round(latest.confidence * 100)}%
              {latest.isMock ? " · mock provider" : ""}
            </p>
          </div>
        ) : null}
      </div>

      <FeatureState
        state={state}
        message={message}
        onRetry={() => void load()}
        title={
          state === "empty"
            ? noDevice
              ? "No verified device"
              : "No analyses yet"
            : undefined
        }
      >
        <ul className="stat-list">
          {history.map((item) => (
            <li key={item.id}>
              {item.plantName ?? "Plant"} — {item.diagnosis} (
              {Math.round(item.confidence * 100)}%)
            </li>
          ))}
        </ul>
      </FeatureState>
    </main>
  );
}
