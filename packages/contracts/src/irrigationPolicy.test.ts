import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideIrrigation, sanitizeDht, ema } from "./irrigationPolicy.ts";
import { DEFAULT_IRRIGATION_THRESHOLDS } from "./types.ts";

describe("decideIrrigation", () => {
  it("turns pump on when moisture is low and tank ok", () => {
    const d = decideIrrigation(
      { soilMoisturePct: 20, waterLevelPct: 80 },
      false,
      DEFAULT_IRRIGATION_THRESHOLDS,
    );
    assert.equal(d.pumpOn, true);
    assert.equal(d.reason, "moisture_below_low_threshold");
  });

  it("blocks pump when tank is low", () => {
    const d = decideIrrigation(
      { soilMoisturePct: 10, waterLevelPct: 5 },
      false,
    );
    assert.equal(d.pumpOn, false);
    assert.equal(d.reason, "water_tank_low");
  });

  it("holds on inside hysteresis band", () => {
    const d = decideIrrigation(
      { soilMoisturePct: 45, waterLevelPct: 80 },
      true,
    );
    assert.equal(d.pumpOn, true);
    assert.equal(d.reason, "hysteresis_hold_on");
  });

  it("turns off above high threshold", () => {
    const d = decideIrrigation(
      { soilMoisturePct: 60, waterLevelPct: 80 },
      true,
    );
    assert.equal(d.pumpOn, false);
  });
});

describe("sanitizeDht", () => {
  it("nulls impossible humidity", () => {
    const s = sanitizeDht(22, 140);
    assert.equal(s.humidityPct, null);
    assert.equal(s.temperatureC, 22);
  });
});

describe("ema", () => {
  it("returns next when no previous", () => {
    assert.equal(ema(null, 10), 10);
  });
});
