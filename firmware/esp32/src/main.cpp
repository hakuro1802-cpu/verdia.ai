#include <Arduino.h>
#include <WiFi.h>

#include "adapters/hardware.h"
#include "config.h"
#include "domain/irrigation.h"

/*
 * Application loop: sample → calibrate/filter → edge irrigation → buffer/publish.
 * Pump control does not require cloud connectivity.
 */

AdcSoilMoisture soil(Pins::kSoilAdc);
AdcPhSensor ph(Pins::kPhAdc);
PowerGatedWaterLevel water(Pins::kWaterAdc, Pins::kWaterVcc);
Dht22Climate climate(Pins::kDht);
RelayPump pump(Pins::kPumpRelay);
HttpTelemetryPublisher publisher;
HttpCommandSource commands;
TelemetryBuffer buffer(config().telemetryBufferMax);

float moistureEma = NAN;
float waterEma = NAN;
uint32_t lastSampleMs = 0;
uint32_t lastCommandMs = 0;

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("Verdia edge firmware starting");
  Serial.println("Irrigation policy runs locally even if Wi-Fi is down");

  connectWifi();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Wi-Fi OK ");
    Serial.println(WiFi.localIP());
    ensureNtp();
  } else {
    Serial.println("Wi-Fi unavailable — continuing in offline edge mode");
  }
}

void loop() {
  const uint32_t now = millis();

  if (now - lastCommandMs >= config().commandPollMs) {
    lastCommandMs = now;
    connectWifi();
    commands.pollAndApply(pump);
    buffer.flush(publisher);
  }

  if (now - lastSampleMs < config().sampleIntervalMs) {
    delay(20);
    return;
  }
  lastSampleMs = now;

  SensorReading reading;
  float t = NAN;
  float h = NAN;
  if (climate.read(t, h)) {
    reading.temperatureC = t;
    reading.humidityPct = h;
  }

  reading.soilMoistureRaw = soil.readRaw();
  reading.soilMoisturePct = soilRawToPct(reading.soilMoistureRaw);
  moistureEma = ema(moistureEma, reading.soilMoisturePct);
  if (!isnan(moistureEma)) reading.soilMoisturePct = moistureEma;

  reading.soilPhRaw = ph.readRaw();
  reading.soilPh = phRawToValue(reading.soilPhRaw);

  reading.waterLevelRaw = water.readRaw();
  reading.waterLevelPct = waterRawToPct(reading.waterLevelRaw);
  waterEma = ema(waterEma, reading.waterLevelPct);
  if (!isnan(waterEma)) reading.waterLevelPct = waterEma;

  IrrigationDecision decision = decideIrrigation(
      reading.soilMoisturePct, reading.waterLevelPct, pump.isOn(),
      config().irrigation.moistureLowPct, config().irrigation.moistureHighPct,
      config().irrigation.minWaterLevelPct);

  // Edge closed-loop: apply immediately.
  pump.setOn(decision.pumpOn);

  Serial.printf(
      "moist=%.1f pH=%.2f water=%.1f T=%.1f H=%.1f pump=%d (%s)\n",
      reading.soilMoisturePct, reading.soilPh, reading.waterLevelPct,
      reading.temperatureC, reading.humidityPct, decision.pumpOn ? 1 : 0,
      decision.reason);

  connectWifi();
  if (!publisher.publish(reading, decision.pumpOn, decision.reason)) {
    buffer.push(reading, decision.pumpOn, decision.reason);
    Serial.printf("telemetry buffered (%u)\n", (unsigned)buffer.size());
  } else {
    buffer.flush(publisher);
  }
}
