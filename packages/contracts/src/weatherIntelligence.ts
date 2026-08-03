import type { WeatherInterpretation, WeatherSnapshot } from "./types.js";

/**
 * Interpret live weather for agricultural decisions.
 * Weather must never be shown without interpretation.
 */
export function interpretWeather(weather: WeatherSnapshot): WeatherInterpretation {
  const impacts: WeatherInterpretation["impacts"] = [];

  if (
    weather.precipitationProbabilityPct !== null &&
    weather.precipitationProbabilityPct >= 60
  ) {
    impacts.push({
      signal: "High rain probability",
      agriculturalImpact: "Soil may already receive water from rainfall.",
      suggestedAction: "Delay irrigation until after the rain window.",
    });
  }

  if (weather.humidityPct >= 85) {
    impacts.push({
      signal: "High humidity",
      agriculturalImpact: "Elevated risk of fungal disease pressure.",
      suggestedAction: "Increase disease monitoring on leaves and fruit.",
    });
  }

  if (weather.temperatureC >= 35) {
    impacts.push({
      signal: "Heat stress risk",
      agriculturalImpact: "High temperature increases plant water demand.",
      suggestedAction: "Prefer early-morning or evening watering windows.",
    });
  } else if (weather.temperatureC <= 5) {
    impacts.push({
      signal: "Cold stress risk",
      agriculturalImpact: "Low temperature can slow growth and raise frost risk.",
      suggestedAction: "Avoid night irrigation; protect sensitive crops if needed.",
    });
  }

  if (weather.windSpeedMs !== null && weather.windSpeedMs >= 10) {
    impacts.push({
      signal: "Strong wind",
      agriculturalImpact: "Faster canopy drying and spray drift risk.",
      suggestedAction: "Avoid foliar sprays; check young plant staking.",
    });
  }

  if (impacts.length === 0) {
    impacts.push({
      signal: "Stable conditions",
      agriculturalImpact: "No extreme weather signals from current snapshot.",
      suggestedAction: "Follow sensor-driven irrigation and routine scouting.",
    });
  }

  return { weather, impacts };
}
