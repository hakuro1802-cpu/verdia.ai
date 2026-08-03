#pragma once

#include <Arduino.h>
#include <DHTesp.h>
#include <vector>

#include "domain/ports.h"

class AdcSoilMoisture final : public SoilMoistureSensor {
 public:
  explicit AdcSoilMoisture(int pin);
  int readRaw() override;

 private:
  int pin_;
};

class AdcPhSensor final : public PhSensor {
 public:
  explicit AdcPhSensor(int pin);
  int readRaw() override;

 private:
  int pin_;
};

class PowerGatedWaterLevel final : public WaterLevelSensor {
 public:
  PowerGatedWaterLevel(int adcPin, int vccPin);
  int readRaw() override;

 private:
  int adc_;
  int vcc_;
};

class Dht22Climate final : public ClimateSensor {
 public:
  explicit Dht22Climate(int pin);
  bool read(float& temperatureC, float& humidityPct) override;

 private:
  DHTesp dht_;
};

class RelayPump final : public PumpActuator {
 public:
  explicit RelayPump(int pin);
  void setOn(bool on) override;
  bool isOn() const override;

 private:
  int pin_;
  bool on_ = false;
};

class HttpTelemetryPublisher final : public TelemetryPublisher {
 public:
  bool publish(const SensorReading& sensors, bool pumpOn,
               const char* reason) override;
};

class HttpCommandSource final : public CommandSource {
 public:
  bool pollAndApply(PumpActuator& pump) override;
};

class TelemetryBuffer {
 public:
  explicit TelemetryBuffer(size_t cap);
  void push(const SensorReading& s, bool pumpOn, const char* reason);
  bool flush(TelemetryPublisher& pub);
  size_t size() const;

 private:
  struct Item {
    SensorReading sensors;
    bool pumpOn;
    String reason;
  };
  size_t cap_;
  std::vector<Item> q_;
};

void connectWifi();
void ensureNtp();
String isoTimestamp();
float soilRawToPct(int raw);
float phRawToValue(int raw);
float waterRawToPct(int raw);
