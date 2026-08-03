import { useCallback, useEffect, useState } from "react";
import type { WeatherInterpretation } from "@verdia/contracts";
import { apiFetch, ApiError } from "../../shared/api/client";
import { FeatureState, mapErrorToState, type FeatureStateKind } from "../../shared/ui/FeatureState";

async function fetchWeather(lat: number, lon: number): Promise<WeatherInterpretation> {
  return apiFetch(`/weather?lat=${lat}&lon=${lon}`);
}

type Coords = { lat: number; lon: number };

export function WeatherScreen() {
  const [data, setData] = useState<WeatherInterpretation | null>(null);
  const [state, setState] = useState<FeatureStateKind>("loading");
  const [message, setMessage] = useState<string | undefined>();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadAt = useCallback(async (lat: number, lon: number) => {
    setBusy(true);
    setState("loading");
    setMessage(undefined);
    try {
      const weather = await fetchWeather(lat, lon);
      setData(weather);
      setCoords({ lat, lon });
      if (!weather.impacts?.length) {
        setState("empty");
        setMessage("Weather returned without interpretation impacts.");
      } else {
        setState("ready");
      }
    } catch (e) {
      const err =
        e instanceof ApiError
          ? e
          : new ApiError(e instanceof Error ? e.message : "Failed", { status: 0 });
      const mapped = mapErrorToState(err);
      setData(null);
      setState(mapped.state);
      setMessage(mapped.message);
    } finally {
      setBusy(false);
    }
  }, []);

  const requestLocation = useCallback(async () => {
    setBusy(true);
    setState("loading");
    setMessage(undefined);
    setData(null);

    if (!("geolocation" in navigator)) {
      setState("unavailable");
      setMessage(
        "Geolocation is not available in this browser. Enter latitude and longitude manually below.",
      );
      setBusy(false);
      return;
    }

    const pos = await new Promise<GeolocationPosition | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) => resolve(p),
        () => resolve(null),
        { timeout: 8000, maximumAge: 60_000 },
      );
    });

    if (!pos) {
      setState("unavailable");
      setMessage(
        "Location access denied or unavailable. Allow location in your browser, or enter latitude and longitude manually below.",
      );
      setBusy(false);
      return;
    }

    await loadAt(pos.coords.latitude, pos.coords.longitude);
  }, [loadAt]);

  useEffect(() => {
    void requestLocation();
  }, [requestLocation]);

  const applyManual = () => {
    const lat = Number(manualLat);
    const lon = Number(manualLon);
    if (
      manualLat.trim() === "" ||
      manualLon.trim() === "" ||
      Number.isNaN(lat) ||
      Number.isNaN(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      setManualError("Enter valid latitude (−90…90) and longitude (−180…180).");
      return;
    }
    setManualError(null);
    void loadAt(lat, lon);
  };

  return (
    <main className="feature-screen">
      <header className="feature-screen__header">
        <div>
          <p className="feature-kicker">Weather</p>
          <h1>Field conditions</h1>
          <p className="feature-lede">
            Interpretation first — impacts and actions, not raw numbers alone. Location is required;
            we never invent coordinates.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={() => void requestLocation()}
        >
          {busy ? "Loading…" : "Use my location"}
        </button>
      </header>

      <div className="location-manual">
        <p className="muted">
          Or enter coordinates manually
          {coords ? ` · current ${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}` : ""}.
        </p>
        <div className="farm-create">
          <input
            value={manualLat}
            onChange={(e) => {
              setManualLat(e.target.value);
              if (manualError) setManualError(null);
            }}
            placeholder="Latitude"
            aria-label="Latitude"
            inputMode="decimal"
          />
          <input
            value={manualLon}
            onChange={(e) => {
              setManualLon(e.target.value);
              if (manualError) setManualError(null);
            }}
            placeholder="Longitude"
            aria-label="Longitude"
            inputMode="decimal"
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={applyManual}
          >
            Apply
          </button>
        </div>
        {manualError ? <p className="field-error">{manualError}</p> : null}
      </div>

      <FeatureState
        state={state}
        message={message}
        onRetry={() => void (coords ? loadAt(coords.lat, coords.lon) : requestLocation())}
      >
        {data ? (
          <div className="weather-panel">
            <p className="weather-summary">
              {data.weather.conditionLabel} · {data.weather.temperatureC}°C · RH{" "}
              {data.weather.humidityPct}%
              {data.weather.precipitationProbabilityPct != null
                ? ` · rain ${data.weather.precipitationProbabilityPct}%`
                : ""}
            </p>
            <ul className="impact-list">
              {data.impacts.map((imp) => (
                <li key={imp.signal}>
                  <strong>{imp.signal}</strong>
                  <p>{imp.agriculturalImpact}</p>
                  <p className="muted">Action: {imp.suggestedAction}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </FeatureState>
    </main>
  );
}
