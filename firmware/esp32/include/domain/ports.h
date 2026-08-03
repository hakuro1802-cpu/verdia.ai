#pragma once

#include "domain/irrigation.h"

class SoilMoistureSensor {
 public:
  virtual ~SoilMoistureSensor() = default;
  virtual int readRaw() = 0;
};

class PhSensor {
 public:
  virtual ~PhSensor() = default;
  virtual int readRaw() = 0;
};

class WaterLevelSensor {
 public:
  virtual ~WaterLevelSensor() = default;
  virtual int readRaw() = 0;
};

class ClimateSensor {
 public:
  virtual ~ClimateSensor() = default;
  virtual bool read(float& temperatureC, float& humidityPct) = 0;
};

class PumpActuator {
 public:
  virtual ~PumpActuator() = default;
  virtual void setOn(bool on) = 0;
  virtual bool isOn() const = 0;
};

class TelemetryPublisher {
 public:
  virtual ~TelemetryPublisher() = default;
  virtual bool publish(const SensorReading& sensors, bool pumpOn,
                       const char* reason) = 0;
};

class CommandSource {
 public:
  virtual ~CommandSource() = default;
  /** Returns true if a command was applied (pump override). */
  virtual bool pollAndApply(PumpActuator& pump) = 0;
};
