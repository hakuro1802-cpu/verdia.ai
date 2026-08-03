# VERDIA.AI

Production-oriented intelligent agriculture platform. **momo.ai** is the evidence-based assistant.

## Architecture

Clean Architecture with replaceable adapters:

| Layer | Location |
|-------|----------|
| Domain contracts | `packages/contracts` |
| Application use cases | `apps/api/src/application` |
| Ports | `apps/api/src/domain/ports.ts` |
| Adapters | `apps/api/src/adapters` |
| Presentation | `apps/web/src/features/*` |

**Live Mode (default):** never fabricates sensor values, diagnoses, reports, or notifications from unavailable providers.

**Demo Mode:** `VERDIA_MODE=demo` only — labeled simulator + mock vision (`isMock: true`).

## Production honesty

| Capability | Live behavior |
|------------|----------------|
| Sensors | Bounds + timestamp + frozen-probe detection; invalid values stripped |
| Vision | Rejected until `VERDIA_VISION_URL`; low confidence / mock payloads rejected |
| Reports | Verified telemetry + accepted live analyses only; honest empty report when insufficient |
| Recommendations | Evidence-only; unavailable/mock camera never cited as science |
| Weather | Open-Meteo + agricultural interpretation; UI requires location consent |
| Auth | Guest works; Firebase only when Admin credentials exist |
| Telemetry | Set `VERDIA_TELEMETRY_TOKEN` for production device auth |
| Offline | Client outbox queues failed writes; `POST /api/v1/sync/telemetry-batch` flushes |

## Run

```bash
npm install
npm start                          # Live Mode :8787
VERDIA_MODE=demo npm start         # Demo Mode
VERDIA_TELEMETRY_TOKEN=secret npm start
```

Opening: `/?boot=cold` → functional app shell (no placeholder screens).

## Still requires your credentials (not faked)

- Firebase email/Google → `FIREBASE_PROJECT_ID` + Admin service account + `VITE_FIREBASE_*`
- Live plant vision → `VERDIA_VISION_URL`
- Firestore cloud sync → Firebase project (local file store used until then)
- Physical ESP32 → posts telemetry with device token
