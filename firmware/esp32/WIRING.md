/*
 * Wiring cheat-sheet (ESP32 DevKit V1) — common GND required.
 *
 * DHT22        VCC 3.3V  DATA GPIO4   GND
 * Soil moist   VCC 3.3V  OUT  GPIO36  GND
 * pH module    VCC 3.3V  OUT  GPIO39  GND
 * Water level  VCC GPIO25 (gated) OUT GPIO34  GND
 * Relay IN1    GPIO26    VCC 5V       GND common
 * Pump         switched by relay contacts on separate supply
 */
