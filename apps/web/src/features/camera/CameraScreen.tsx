import { useCallback, useEffect, useRef, useState } from "react";
import type { PlantAnalysisResult } from "@verdia/contracts";
import { ApiError } from "../../shared/api/client";
import { FeatureState, mapErrorToState, type FeatureStateKind } from "../../shared/ui/FeatureState";
import { listAnalyses, uploadAnalysis } from "./cameraService";

export function CameraScreen() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState<PlantAnalysisResult[]>([]);
  const [state, setState] = useState<FeatureStateKind>("loading");
  const [message, setMessage] = useState<string | undefined>();
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [latest, setLatest] = useState<PlantAnalysisResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [consentImage, setConsentImage] = useState(true);
  const [consentLocation, setConsentLocation] = useState(false);

  const load = useCallback(async () => {
    setState("loading");
    setMessage(undefined);
    try {
      const items = await listAnalyses();
      setHistory(items);
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

  const onFile = async (file: File | undefined) => {
    if (!file) return;
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
          disabled={busy || !consentImage}
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
        title={state === "empty" ? "No analyses yet" : undefined}
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
