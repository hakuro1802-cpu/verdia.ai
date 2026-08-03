# Verdia AI — Smart Plant Monitoring & Irrigation

Monorepo for edge irrigation (ESP32), a demo cloud API with a **mock Verdia** plant-analysis adapter, and a responsive web app (phone gateway / UI).

> There is **no public Verdia SDK/API**. Plant diagnostics use `MockVerdiaAnalyzer`, clearly marked `isMock: true`, swappable when real contracts exist.

## Architecture

| Layer | Location | Responsibility |
|-------|----------|----------------|
| Domain / contracts | `packages/contracts` | Shared types + irrigation policy (pure) |
| Application + API | `apps/api` | Telemetry ingest, pump commands, mock analysis |
| Phone / demo UI | `apps/web` | Live gauges, charts, Water Now, camera upload |
| Edge firmware | `firmware/esp32` | Sensors, local pump control, HTTP telemetry + command poll |

**Edge vs cloud:** pump ON/OFF hysteresis runs on the ESP32 even offline. The cloud stores telemetry and serves mock AI. The web app acts as the camera + control surface.

```
Sensors → ESP32 (calibrate, decide, actuate)
              ├─ Wi-Fi HTTP → API (/telemetry, /commands)
              └─ offline buffer → retry
Camera / UI → Web app → API (/analysis mock-verdia)
```

## Quick start

```bash
npm install
npm run build:contracts
npm run dev:api    # http://localhost:8787  (simulator ON by default)
npm run dev:web    # http://localhost:5173
```

Open the web app — the API demo simulator feeds `ESP32_001` so the UI works without hardware.

Disable the simulator: `VERDIA_SIMULATOR=0 npm run dev:api`

### Useful API routes

- `GET /api/v1/health`
- `POST /api/v1/telemetry`
- `GET /api/v1/devices/:id/dashboard`
- `POST /api/v1/devices/:id/commands/pump` body `{ "action": "pulse", "durationMs": 4000, "source": "app" }`
- `POST /api/v1/analysis` multipart `image` + consent fields

## ESP32 firmware

PlatformIO project under `firmware/esp32`.

1. Edit `include/config.h` — Wi-Fi SSID/password and `api.baseUrl` (LAN IP of the API host). **Do not commit secrets.**
2. Replace calibration placeholders after bench measurement (`TODO(pending measurement)`).
3. Build/flash: `pio run -d firmware/esp32 -t upload`

GPIO defaults: DHT22→4, soil→36, pH→39, water ADC→34, water VCC gate→25, relay→26.

## Configuration gaps (ask before inventing)

- Official Verdia API URL, auth, and response schema
- Measured calibration constants per probe
- Production TLS certificates and token issuance

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev:api` | API + optional plant simulator |
| `npm run dev:web` | Vite web UI |
| `npm test` | Contract + API unit tests |
| `npm run build` | Build contracts, API, web |

## Skill

Project agent skill: `.cursor/skills/coding-and-designing/` — Clean Architecture, SOLID, no fabricated Verdia APIs.
