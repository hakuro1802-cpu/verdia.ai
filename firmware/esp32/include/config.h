#pragma once

#include <Arduino.h>

// GPIO map from architecture reference — change only in one place.
namespace Pins {
constexpr int kDht = 4;
constexpr int kSoilAdc = 36;
constexpr int kPhAdc = 39;
constexpr int kWaterAdc = 34;
constexpr int kWaterVcc = 25;  // power-gate water level probe
constexpr int kPumpRelay = 26;
}  // namespace Pins

struct WifiConfig {
  const char* ssid;
  const char* password;
};

struct ApiConfig {
  const char* baseUrl;  // e.g. http://192.168.1.10:8787/api/v1
  const char* deviceId;
  const char* bearerToken;  // optional; empty if unused
};

struct CalibrationConfig {
  // TODO(pending measurement): replace placeholders with gravimetric / buffer cal.
  int soilDryRaw = 3200;
  int soilWetRaw = 1400;
  float phVoltageAt7 = 1.50f;
  float phVoltageAt4 = 2.00f;
  int waterEmptyRaw = 0;
  int waterFullRaw = 3000;
};

struct IrrigationThresholds {
  float moistureLowPct = 35.f;
  float moistureHighPct = 55.f;
  float minWaterLevelPct = 15.f;
};

struct AppConfig {
  WifiConfig wifi{
      // Fill via build flags or edit before flash — do not commit secrets.
      "YOUR_WIFI_SSID",
      "YOUR_WIFI_PASSWORD",
  };
  ApiConfig api{
      "http://YOUR_LAN_IP:8787/api/v1",
      "ESP32_001",
      "",
  };
  CalibrationConfig calibration{};
  IrrigationThresholds irrigation{};
  uint32_t sampleIntervalMs = 5000;
  uint32_t commandPollMs = 8000;
  size_t telemetryBufferMax = 32;
};

inline AppConfig& config() {
  static AppConfig cfg;
  return cfg;
}
