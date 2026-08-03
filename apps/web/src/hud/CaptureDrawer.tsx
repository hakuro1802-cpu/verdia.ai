import { useEffect, useRef, useState } from "react";
import type { PlantAnalysisResult, SensorReading } from "@verdia/contracts";
import { analyzeImage } from "../api";

type Props = {
  open: boolean;
  onClose: () => void;
  deviceId: string;
  sensors: SensorReading | null;
  onAnalyzed?: () => void;
};

export function CaptureDrawer({ open, onClose, deviceId, sensors, onAnalyzed }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [consentImage, setConsentImage] = useState(true);
  const [consentLocation, setConsentLocation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlantAnalysisResult | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    let media: MediaStream | null = null;

    async function start() {
      try {
        media = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (!active || !videoRef.current) return;
        videoRef.current.srcObject = media;
        await videoRef.current.play();
      } catch {
        setError("Camera unavailable — upload a photo instead.");
      }
    }

    void start();
    return () => {
      active = false;
      media?.getTracks().forEach((t) => t.stop());
    };
  }, [open]);

  async function captureFromVideo(): Promise<Blob | null> {
    const video = videoRef.current;
    if (!video) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85));
  }

  async function runAnalysis(blob: Blob) {
    setBusy(true);
    setError(null);
    try {
      setPreview(URL.createObjectURL(blob));
      let latitude: number | undefined;
      let longitude: number | undefined;
      if (consentLocation && "geolocation" in navigator) {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 }),
        ).catch(() => null);
        if (pos) {
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
        }
      }
      const analysis = await analyzeImage({
        deviceId,
        file: blob,
        sensors,
        consentImage,
        consentLocation,
        latitude,
        longitude,
      });
      setResult(analysis);
      onAnalyzed?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2>Leaf scan</h2>
          <button className="btn ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="drawer-stage">
          {preview ? <img src={preview} alt="Captured plant" /> : <video ref={videoRef} playsInline muted />}
        </div>
        <div className="consent">
          <label>
            <input
              type="checkbox"
              checked={consentImage}
              onChange={(e) => setConsentImage(e.target.checked)}
            />
            Consent to upload this image for analysis
          </label>
          <label>
            <input
              type="checkbox"
              checked={consentLocation}
              onChange={(e) => setConsentLocation(e.target.checked)}
            />
            Include GPS (optional)
          </label>
        </div>
        <div className="dock-actions">
          <button
            className="btn primary"
            disabled={busy || !consentImage}
            onClick={async () => {
              const blob = await captureFromVideo();
              if (blob) await runAnalysis(blob);
              else setError("Could not capture frame");
            }}
          >
            {busy ? "Reading canopy…" : "Capture & analyze"}
          </button>
          <button className="btn ghost" disabled={busy} onClick={() => setPreview(null)}>
            Live
          </button>
          <label className="btn ghost file-btn">
            Upload
            <input
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) await runAnalysis(file);
              }}
            />
          </label>
        </div>
        {error ? <p className="error">{error}</p> : null}
        {result ? (
          <div className="analysis-card">
            {result.isMock ? <div className="badge">Mock Verdia</div> : null}
            <h3>{result.plantName ?? "Unknown plant"}</h3>
            <p>
              <strong>{result.health}</strong> — {result.diagnosis}
            </p>
            <ul>
              {result.careTips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
