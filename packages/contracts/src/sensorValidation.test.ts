import assert from "node:assert/strict";
import { test } from "node:test";
import {
  detectFrozenSensors,
  sanitizeSensorReading,
  validateSensorValue,
} from "./sensorValidation.js";
import { interpretWeather } from "./weatherIntelligence.js";
import { buildRecommendation } from "./recommendationEngine.js";

test("rejects impossible temperature", () => {
  const v = validateSensorValue("temperatureC", 999, new Date().toISOString());
  assert.equal(v.status, "invalid");
  assert.ok(v.rejectionReason);
});

test("accepts valid moisture", () => {
  const v = validateSensorValue("soilMoisturePct", 42, new Date().toISOString());
  assert.equal(v.status, "ok");
  assert.equal(v.value, 42);
});

test("sanitize strips invalid fields", () => {
  const s = sanitizeSensorReading(
    {
      temperatureC: 200,
      humidityPct: 50,
      soilMoisturePct: 40,
      soilMoistureRaw: 1000,
      soilPh: 6.5,
      soilPhRaw: 1,
      waterLevelPct: 60,
      waterLevelRaw: 1,
    },
    new Date().toISOString(),
  );
  assert.equal(s.temperatureC, null);
  assert.equal(s.humidityPct, 50);
});

test("weather always returns interpretation", () => {
  const i = interpretWeather({
    fetchedAt: new Date().toISOString(),
    location: { latitude: 13.08, longitude: 80.27 },
    temperatureC: 36,
    humidityPct: 90,
    precipitationProbabilityPct: 70,
    windSpeedMs: 2,
    conditionLabel: "humid",
  });
  assert.ok(i.impacts.length >= 2);
});

test("recommendation refuses empty evidence", () => {
  const r = buildRecommendation({});
  assert.equal(r.unavailableReason, "no_verified_evidence");
  assert.equal(r.confidence, 0);
});

test("recommendation uses moisture evidence", () => {
  const r = buildRecommendation({
    sensors: {
      temperatureC: 28,
      humidityPct: 60,
      soilMoisturePct: 20,
      soilMoistureRaw: null,
      soilPh: null,
      soilPhRaw: null,
      waterLevelPct: 50,
      waterLevelRaw: null,
    },
  });
  assert.ok(r.confidence > 0);
  assert.ok(r.evidence.some((e) => e.includes("moisture")));
});

test("rejects future timestamps", () => {
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const v = validateSensorValue("temperatureC", 25, future);
  assert.equal(v.status, "invalid");
});

test("detects frozen sensors", () => {
  const sample = {
    sensors: {
      temperatureC: 22,
      humidityPct: 50,
      soilMoisturePct: 40,
      soilMoistureRaw: 1,
      soilPh: 6.5,
      soilPhRaw: 1,
      waterLevelPct: 60,
      waterLevelRaw: 1,
    },
    timestamp: new Date().toISOString(),
  };
  const history = Array.from({ length: 6 }, () => sample);
  const frozen = detectFrozenSensors(history);
  assert.ok(frozen.includes("temperatureC"));
  assert.ok(frozen.includes("soilMoisturePct"));
});
