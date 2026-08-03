# VERDIA.AI

Production-oriented intelligent agriculture platform. **momo.ai** is the evidence-based assistant.

## Architecture decision

Clean Architecture with replaceable adapters:

| Layer | Location |
|-------|----------|
| Domain contracts | `packages/contracts` |
| Application use cases | `apps/api/src/application` |
| Ports | `apps/api/src/domain/ports.ts` |
| Adapters | `apps/api/src/adapters` |
| Presentation | `apps/web/src/features/*` |

**Live Mode (default):** never fabricates sensor values or AI diagnoses. Missing providers return honest `unavailable` states.

**Demo Mode:** `VERDIA_MODE=demo` enables the labeled simulator and mock vision (`isMock: true`). Never used as Live.

## Modules

Auth (Guest + Firebase when configured) · Dashboard · Farms · Devices · Sensors · Camera · momo.ai · Recommendations · Weather · Reports · Notifications · ESP32 firmware

## Run

```bash
npm install
npm start                 # Live Mode on :8787
VERDIA_MODE=demo npm start  # Demo Mode with simulator
```

Opening: `/?boot=cold` · App shell follows the cinematic opening.

## Honest limits (no fabrication)

| Capability | Live behavior without config |
|------------|------------------------------|
| Firebase Auth | Unavailable — Guest Mode works |
| Vision disease model | Rejects blurry/empty images; analysis unavailable until `VERDIA_VISION_URL` |
| Weather | Live via Open-Meteo (no key) + agricultural interpretation |
| ESP32 | Real telemetry via `POST /api/v1/telemetry` — empty until a device reports |

## Part 1

Aurora Meadow cinematic opening (preserved).
