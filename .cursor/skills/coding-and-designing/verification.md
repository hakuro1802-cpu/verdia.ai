# Post-implementation verification

Use after every coding or design delivery. Attach findings to the PR/summary; fix blockers before calling work done.

## Review

- [ ] Change matches the architectural decision stated before implementation
- [ ] Layers/ports respected (domain free of Wi-Fi/UI/SDK details)
- [ ] Modules remain single-purpose; no drive-by refactors of unrelated working code
- [ ] No fabricated Verdia APIs, credentials, calibration constants, or hardware behaviors
- [ ] Missing information was asked for—or explicitly marked TODO with owner/blocker

## Improvements (list explicitly)

Record 2–5 concrete follow-ups (tech debt, tests, naming, power, observability). Distinguish **must-fix now** vs **later**.

## Regression / existing behavior

- [ ] Edge irrigation still works without cloud/phone
- [ ] Sensor read path and relay safety unchanged unless intentionally modified
- [ ] Telemetry/retry behavior does not storm the network
- [ ] Phone/demo flows (if touched) still show live data and capture upload path

## Production readiness

- [ ] TLS and secret handling correct for the environment used
- [ ] Error paths, timeouts, and buffer limits defined
- [ ] Power considerations (sleep, probe power-gating) not regressed
- [ ] Logging enough to diagnose field failures without leaking secrets
- [ ] Bench or simulated checks performed for the touched path

## Sign-off blurb (template)

```markdown
### Verification
- Architecture decision: …
- Review notes: …
- Improvements: …
- Regression: …
- Production readiness: pass / blocked (reason)
```
