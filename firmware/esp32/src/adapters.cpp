#include <HTTPClient.h>
#include <WiFi.h>
#include <ArduinoJson.h>
#include <time.h>

#include "adapters/hardware.h"
#include "config.h"

AdcSoilMoisture::AdcSoilMoisture(int pin) : pin_(pin) {}
int AdcSoilMoisture::readRaw() { return analogRead(pin_); }

AdcPhSensor::AdcPhSensor(int pin) : pin_(pin) {}
int AdcPhSensor::readRaw() { return analogRead(pin_); }

PowerGatedWaterLevel::PowerGatedWaterLevel(int adcPin, int vccPin)
    : adc_(adcPin), vcc_(vccPin) {
  pinMode(vcc_, OUTPUT);
  digitalWrite(vcc_, LOW);
}

int PowerGatedWaterLevel::readRaw() {
  digitalWrite(vcc_, HIGH);
  delay(50);
  int raw = analogRead(adc_);
  digitalWrite(vcc_, LOW);
  return raw;
}

Dht22Climate::Dht22Climate(int pin) { dht_.setup(pin, DHTesp::DHT22); }

bool Dht22Climate::read(float& temperatureC, float& humidityPct) {
  TempAndHumidity th = dht_.getTempAndHumidity();
  if (dht_.getStatus() != DHTesp::ERROR_NONE) return false;
  if (th.temperature < -40 || th.temperature > 80) return false;
  if (th.humidity < 0 || th.humidity > 100) return false;
  temperatureC = th.temperature;
  humidityPct = th.humidity;
  return true;
}

RelayPump::RelayPump(int pin) : pin_(pin) {
  pinMode(pin_, OUTPUT);
  digitalWrite(pin_, LOW);
}

void RelayPump::setOn(bool on) {
  on_ = on;
  digitalWrite(pin_, on ? HIGH : LOW);
}

bool RelayPump::isOn() const { return on_; }

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.mode(WIFI_STA);
  WiFi.begin(config().wifi.ssid, config().wifi.password);
  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(250);
  }
}

void ensureNtp() {
  static bool started = false;
  if (!started) {
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
    started = true;
  }
}

String isoTimestamp() {
  time_t now = time(nullptr);
  if (now < 1700000000) {
    // Until NTP locks, emit a unique RFC3339-ish stamp from uptime.
    char buf[40];
    unsigned long sec = millis() / 1000UL;
    snprintf(buf, sizeof(buf), "1970-01-01T%02lu:%02lu:%02luZ",
             (sec / 3600UL) % 24UL, (sec / 60UL) % 60UL, sec % 60UL);
    return String(buf);
  }
  struct tm tmNow;
  gmtime_r(&now, &tmNow);
  char buf[30];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &tmNow);
  return String(buf);
}

float soilRawToPct(int raw) {
  const auto& c = config().calibration;
  if (c.soilDryRaw == c.soilWetRaw) return NAN;
  float pct =
      100.f * float(c.soilDryRaw - raw) / float(c.soilDryRaw - c.soilWetRaw);
  return clampPct(pct);
}

float phRawToValue(int raw) {
  // TODO(pending measurement): two-point buffer calibration.
  const auto& c = config().calibration;
  float voltage = raw * (3.3f / 4095.f);
  float slope = (7.0f - 4.0f) / (c.phVoltageAt7 - c.phVoltageAt4);
  return 7.0f + slope * (voltage - c.phVoltageAt7);
}

float waterRawToPct(int raw) {
  const auto& c = config().calibration;
  if (c.waterFullRaw == c.waterEmptyRaw) return NAN;
  float pct = 100.f * float(raw - c.waterEmptyRaw) /
              float(c.waterFullRaw - c.waterEmptyRaw);
  return clampPct(pct);
}

static void setNullableNumber(JsonObject obj, const char* key, float value) {
  if (isnan(value)) {
    obj[key] = nullptr;
  } else {
    obj[key] = value;
  }
}

bool HttpTelemetryPublisher::publish(const SensorReading& sensors, bool pumpOn,
                                     const char* reason) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  String url = String(config().api.baseUrl) + "/telemetry";
  if (!http.begin(url)) return false;

  http.addHeader("Content-Type", "application/json");
  if (config().api.bearerToken[0] != '\0') {
    http.addHeader("Authorization", String("Bearer ") + config().api.bearerToken);
  }

  JsonDocument doc;
  doc["timestamp"] = isoTimestamp();
  doc["deviceId"] = config().api.deviceId;
  doc["pumpOn"] = pumpOn;
  doc["irrigationReason"] = reason;
  JsonObject s = doc["sensors"].to<JsonObject>();
  setNullableNumber(s, "temperatureC", sensors.temperatureC);
  setNullableNumber(s, "humidityPct", sensors.humidityPct);
  setNullableNumber(s, "soilMoisturePct", sensors.soilMoisturePct);
  s["soilMoistureRaw"] = sensors.soilMoistureRaw;
  setNullableNumber(s, "soilPh", sensors.soilPh);
  s["soilPhRaw"] = sensors.soilPhRaw;
  setNullableNumber(s, "waterLevelPct", sensors.waterLevelPct);
  s["waterLevelRaw"] = sensors.waterLevelRaw;

  String body;
  serializeJson(doc, body);
  int code = http.POST(body);
  http.end();
  return code >= 200 && code < 300;
}

bool HttpCommandSource::pollAndApply(PumpActuator& pump) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  String url = String(config().api.baseUrl) + "/devices/" + config().api.deviceId +
               "/commands";
  if (!http.begin(url)) return false;
  if (config().api.bearerToken[0] != '\0') {
    http.addHeader("Authorization", String("Bearer ") + config().api.bearerToken);
  }

  int code = http.GET();
  if (code != 200) {
    http.end();
    return false;
  }
  String payload = http.getString();
  http.end();

  JsonDocument doc;
  if (deserializeJson(doc, payload)) return false;

  bool applied = false;
  for (JsonObject cmd : doc["commands"].as<JsonArray>()) {
    const char* action = cmd["action"] | "";
    if (strcmp(action, "on") == 0) {
      pump.setOn(true);
      applied = true;
    } else if (strcmp(action, "off") == 0) {
      pump.setOn(false);
      applied = true;
    } else if (strcmp(action, "pulse") == 0) {
      int ms = cmd["durationMs"] | 3000;
      pump.setOn(true);
      delay(ms);
      pump.setOn(false);
      applied = true;
    }
  }
  return applied;
}

TelemetryBuffer::TelemetryBuffer(size_t cap) : cap_(cap) {}

void TelemetryBuffer::push(const SensorReading& s, bool pumpOn,
                           const char* reason) {
  if (q_.size() >= cap_) q_.erase(q_.begin());
  q_.push_back(Item{s, pumpOn, reason ? String(reason) : String()});
}

bool TelemetryBuffer::flush(TelemetryPublisher& pub) {
  while (!q_.empty()) {
    const Item& item = q_.front();
    if (!pub.publish(item.sensors, item.pumpOn, item.reason.c_str())) {
      return false;
    }
    q_.erase(q_.begin());
  }
  return true;
}

size_t TelemetryBuffer::size() const { return q_.size(); }
