import { useCallback, useEffect, useState } from "react";
import type { WeatherInterpretation } from "@verdia/contracts";
import { apiFetch, ApiError } from "../../shared/api/client";
import { FeatureState, mapErrorToState, type FeatureStateKind } from "../../shared/ui/FeatureState";

async function fetchWeather(lat: number, lon: number): Promise<WeatherInterpretation> {
  return apiFetch(`/weather?lat=${lat}&lon=${lon}`);
}

export function WeatherScreen() {
  const [data, setData] = useState<WeatherInterpretation | null>(null);
  const [state, setState] = useState<FeatureStateKind>("loading");
  const [message, setMessage] = useState<string | undefined>();

  const load = useCallback(async () => {
    setState("loading");
    setMessage(undefined);
    try {
      let lat = 11.0;
      let lon = 78.0;
      if ("geolocation" in navigator) {
        const pos = await new Promise<GeolocationPosition | null>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (p) => resolve(p),
            () => resolve(null),
            { timeout: 4000 },
          );
        });
        if (pos) {
          lat = pos.coords.latitude;
          lon = pos.coords.longitude;
        }
      }
      const weather = await fetchWeather(lat, lon);
      setData(weather);
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
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="feature-screen">
      <header className="feature-screen__header">
        <div>
          <p className="feature-kicker">Weather</p>
          <h1>Field conditions</h1>
          <p className="feature-lede">
            Interpretation first — impacts and actions, not raw numbers alone.
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => void load()}>
          Refresh
        </button>
      </header>

      <FeatureState state={state} message={message} onRetry={() => void load()}>
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
