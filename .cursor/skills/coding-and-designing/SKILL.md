---
name: coding-and-designing
description: Guides coding and system design for Verdia AI Smart Plant Monitoring & Irrigation (ESP32, sensors, phone gateway, Verdia cloud). Use when designing architecture, implementing firmware/app/cloud features, reviewing code, integrating sensors or communication paths, or when the user asks about coding and designing for this project.
---

# Coding and Designing — Verdia AI

## Core principles (mandatory)

Follow these rules on every coding and design task:

1. Read the entire project before making changes.
2. Understand the architecture.
3. Do not rewrite working code unless necessary.
4. Maintain Clean Architecture.
5. Follow SOLID principles.
6. Keep features modular.
7. Do not fabricate implementations.
8. If information is missing, ask instead of assuming.
9. Explain architectural decisions before implementing them.

### After every implementation

- Review the code.
- Identify improvements.
- Ensure no existing functionality is broken.
- Verify production readiness.

## Before you write code

1. **Survey the repo** — map layers, modules, and existing patterns (firmware, mobile, cloud, shared contracts).
2. **State the decision** — briefly explain the architectural choice (where logic lives, which interface, which transport) *before* editing.
3. **Ask on gaps** — if Verdia API contracts, credentials, pin maps, calibration constants, or product requirements are undocumented, ask; do not invent endpoints, auth schemes, or hardware behavior.
4. **Prefer extension** — add modules behind interfaces; avoid rewriting working paths.

## Clean Architecture & SOLID (this system)

Map work to layers; dependencies point inward:

| Layer | Responsibility | Examples |
|-------|----------------|----------|
| **Domain** | Pure rules, entities, thresholds | Irrigation policy, calibrated readings, plant context |
| **Application** | Use cases / orchestration | Sample sensors → decide pump → enqueue telemetry |
| **Adapters** | Hardware, network, UI | DHT22 driver, MQTT/HTTP client, Android BLE, camera |
| **Infrastructure** | Config, storage, TLS, buffers | SPIFFS queue, Wi-Fi, secrets, OTA |

SOLID expectations:

- **S** — one reason to change per module (e.g. moisture calibration ≠ MQTT publish).
- **O** — extend via new adapters/policies, not by editing core control loops for each sensor brand.
- **L** — sensor/transport implementations must be substitutable behind their ports.
- **I** — thin ports (`SoilMoistureSensor`, `TelemetryPublisher`, `PumpActuator`); no fat “device manager” APIs.
- **D** — domain and use cases depend on abstractions, not ESP32/Android/Verdia SDKs.

Keep features modular: sensors, calibration, control, telemetry, phone gateway, and Verdia upload as separate packages with clear contracts.

## System context (do not invent beyond this)

Canonical hardware and roles (see [architecture.md](architecture.md)):

- **ESP32 DevKit V1** — sensors, local closed-loop irrigation, telemetry buffer/retry.
- **Sensors** — capacitive soil moisture (ADC), DHT22 (temp/RH), analog soil pH, water level (power only while reading).
- **Actuation** — 5V relay → DC pump (edge control; do not require cloud for pump ON/OFF).
- **Android phone** — camera + gateway/UI; GPS/timestamp/metadata with images.
- **Verdia AI cloud** — plant ID / diagnostics / care guidance when integrated.

**Verdia API reality:** No public SDK/API docs were found. Treat Verdia as an HTTPS (and optionally MQTT) cloud endpoint only when credentials and contracts are provided. Until then, use mock adapters and open IoT conventions (JSON over TLS)—do not fabricate production Verdia URLs, OAuth flows, or response schemas.

## Edge vs cloud vs phone

| Concern | Where |
|---------|--------|
| Pump thresholds, local filtering, buffering, reconnect/backoff | **ESP32 (edge)** |
| Image capture/compress, BLE/local Wi-Fi relay, demo UI, offline upload queue | **Phone** |
| Plant vision AI, historical analytics, care tips | **Verdia cloud** (when available) |

Prefer hybrid resilience: direct Wi-Fi/MQTT when online; phone gateway for images and failover. Explain any change to this split before implementing.

## Communication & security defaults

- Prefer **MQTT over TLS** for telemetry efficiency/QoS; **HTTPS** for uploads/REST when required.
- TLS mandatory; no hard-coded secrets; token/cert auth only when real values exist.
- Offline: local buffer + exponential backoff with jitter; preserve edge irrigation offline.
- Privacy: minimize personal data (location/device ID); consent; deletion/retention awareness for images/GPS.

## Calibration & data quality

Do not invent calibration curves. Implement two-point pH, gravimetric moisture mapping, DHT22 ≥2 s interval + spike rejection, water-level immersion maps, and power-gated level probes—only with measured constants or explicit placeholders marked TODO pending measurement.

## Implementation workflow

```
Task Progress:
- [ ] Read relevant modules end-to-end
- [ ] Explain architectural decision
- [ ] Confirm missing contracts with user (if any)
- [ ] Implement behind ports; keep modules focused
- [ ] Review + improvements list
- [ ] Regression check (control still works offline)
- [ ] Production-readiness pass (TLS, secrets, errors, power, safety)
```

## Production-readiness checklist

- [ ] No fabricated APIs or credentials
- [ ] Common grounds / GPIO roles respected; ADC pins for analog; relay isolation from logic rails
- [ ] Edge control works without cloud
- [ ] Retry/backoff and buffer bounds defined
- [ ] Sanity checks / filters on sensor streams
- [ ] Errors logged; watchdogs/OTA considered where in scope
- [ ] Existing behavior preserved unless change was intentional and explained

## Additional resources

- System architecture, GPIO map, payloads, and integration options: [architecture.md](architecture.md)
- Post-implementation review template: [verification.md](verification.md)
