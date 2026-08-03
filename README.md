# Verdia AI — Smart Plant Monitoring & Irrigation

**Complete runnable app:** one Node process serves the web UI + API, with a live plant simulator (or real ESP32 firmware).

> There is **no public Verdia SDK/API**. Plant diagnostics use `MockVerdiaAnalyzer` (`isMock: true`), swappable when real contracts exist.

# Run the completed immersive app

```bash
npm install
npm start
```

Open **http://localhost:8787** (cloud preview must use this port — the server binds `0.0.0.0`).

The UI is a **full-viewport 3D greenhouse**: orbit the living plant, watch leaves respond to moisture, and trigger irrigation from the glass HUD.

| Command | Purpose |
|---------|---------|
| `npm start` | Build everything and run the unified app |
| `npm run dev:api` | Dev API (rebuilds web once, serves UI + hot API reload) |
| `npm run dev:split` | Separate Vite (:5173) + API (:8787) |
| `npm test` | Unit tests |
| `npm run smoke` | Hit health/dashboard/pump endpoints |

Disable simulator: `VERDIA_SIMULATOR=0 npm start`  
In-memory only: `VERDIA_STORE=memory npm start`

## Architecture

| Layer | Location | Responsibility |
|-------|----------|----------------|
| Domain / contracts | `packages/contracts` | Shared types + irrigation policy (pure) |
| Application + API | `apps/api` | Telemetry, pump commands, mock analysis, file store, serves UI |
| Phone / demo UI | `apps/web` | Live gauges, alerts, charts, Water Now, camera |
| Edge firmware | `firmware/esp32` | Sensors, local pump control, HTTP telemetry + command poll |

**Edge vs cloud:** pump ON/OFF hysteresis runs on the ESP32 even offline. The cloud stores telemetry and serves mock AI. The web app is the camera + control surface.

## ESP32 firmware

1. Edit `firmware/esp32/include/config.h` (Wi-Fi + API LAN URL). Do not commit secrets.
2. Replace calibration placeholders after bench measurement.
3. `pio run -d firmware/esp32 -t upload`

See `firmware/esp32/WIRING.md`.

## Configuration gaps (do not invent)

- Official Verdia API URL, auth, and response schema
- Measured calibration constants per probe
- Production TLS certificates and token issuance
