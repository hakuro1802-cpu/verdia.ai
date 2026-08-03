#pragma once

#include <Arduino.h>

struct SensorReading {
  float temperatureC = NAN;
  float humidityPct = NAN;
  float soilMoisturePct = NAN;
  int soilMoistureRaw = -1;
  float soilPh = NAN;
  int soilPhRaw = -1;
  float waterLevelPct = NAN;
  int waterLevelRaw = -1;
};

struct IrrigationDecision {
  bool pumpOn = false;
  const char* reason = "init";
};

inline IrrigationDecision decideIrrigation(float moisturePct, float waterLevelPct,
                                           bool currentlyOn, float lowPct,
                                           float highPct, float minWaterPct) {
  IrrigationDecision d;
  if (isnan(moisturePct)) {
    d.pumpOn = false;
    d.reason = "moisture_unavailable";
    return d;
  }
  if (!isnan(waterLevelPct) && waterLevelPct < minWaterPct) {
    d.pumpOn = false;
    d.reason = "water_tank_low";
    return d;
  }
  if (!currentlyOn && moisturePct < lowPct) {
    d.pumpOn = true;
    d.reason = "moisture_below_low_threshold";
    return d;
  }
  if (currentlyOn && moisturePct > highPct) {
    d.pumpOn = false;
    d.reason = "moisture_above_high_threshold";
    return d;
  }
  if (currentlyOn) {
    d.pumpOn = true;
    d.reason = "hysteresis_hold_on";
    return d;
  }
  d.pumpOn = false;
  d.reason = "moisture_in_band";
  return d;
}

inline float clampPct(float v) {
  if (isnan(v)) return v;
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

inline float mapRawToPct(int raw, int dryOrEmpty, int wetOrFull) {
  if (wetOrFull == dryOrEmpty) return NAN;
  float pct = 100.f * float(dryOrEmpty - raw) / float(dryOrEmpty - wetOrFull);
  // water level often rises with raw — caller chooses argument order
  return clampPct(pct);
}

inline float ema(float prev, float next, float alpha = 0.3f) {
  if (isnan(prev)) return next;
  return alpha * next + (1.f - alpha) * prev;
}
