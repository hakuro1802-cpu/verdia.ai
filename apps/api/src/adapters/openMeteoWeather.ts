import type { GeoPoint, ServiceAvailability, WeatherSnapshot } from "@verdia/contracts";
import type { WeatherPort } from "../domain/ports.js";

/**
 * Real Open-Meteo weather adapter — no API key required.
 * https://api.open-meteo.com
 */
export class OpenMeteoWeatherAdapter implements WeatherPort {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  availability(): ServiceAvailability {
    return { status: "available" };
  }

  async fetchCurrent(location: GeoPoint): Promise<WeatherSnapshot> {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(location.latitude));
    url.searchParams.set("longitude", String(location.longitude));
    url.searchParams.set(
      "current",
      "temperature_2m,relative_humidity_2m,precipitation_probability,wind_speed_10m,weather_code",
    );
    url.searchParams.set("timezone", "auto");
    // precipitation_probability may not be in "current" on all models — also request hourly fallback
    url.searchParams.set(
      "hourly",
      "precipitation_probability",
    );
    url.searchParams.set("forecast_days", "1");

    const res = await this.fetchImpl(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`open_meteo_http_${res.status}`);
    }

    const body = (await res.json()) as OpenMeteoResponse;
    const current = body.current;
    if (!current || typeof current.temperature_2m !== "number") {
      throw new Error("open_meteo_incomplete_response");
    }

    const precip =
      current.precipitation_probability ??
      body.hourly?.precipitation_probability?.[0] ??
      null;

    const windRaw = current.wind_speed_10m ?? null;
    // Open-Meteo default wind is km/h unless wind_speed_unit=ms — convert km/h → m/s
    const windSpeedMs =
      windRaw == null ? null : Number((windRaw / 3.6).toFixed(2));

    return {
      fetchedAt: new Date().toISOString(),
      location: { latitude: location.latitude, longitude: location.longitude },
      temperatureC: current.temperature_2m,
      humidityPct: current.relative_humidity_2m ?? 0,
      precipitationProbabilityPct: precip,
      windSpeedMs,
      conditionLabel: weatherCodeLabel(current.weather_code ?? 0),
    };
  }
}

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    precipitation_probability?: number | null;
    wind_speed_10m?: number | null;
    weather_code?: number;
  };
  hourly?: {
    precipitation_probability?: Array<number | null>;
  };
};

function weatherCodeLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  if (code <= 99) return "Thunderstorm";
  return `Code ${code}`;
}
