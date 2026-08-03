# AGENTS.md

Guidance for AI agents working in the **verdia.ai** repository.

## Repository overview

- **Product:** verdia.ai web frontend (Vite + React + TypeScript in `web/`)
- **Remote:** `https://github.com/hakuro1802-cpu/verdia.ai`
- **Default branch:** `main`
- **Package manager:** pnpm (workspace root + `web/` package)

## Cursor Cloud specific instructions

### Services

| Service | Required? | Port | Start command |
|---------|-----------|------|---------------|
| Vite dev server | Yes (for local dev / E2E) | 5173 | `pnpm dev` from repo root |
| Database / cache | No | — | Not used |
| Docker Compose | No | — | No compose files; Docker not on default VM |

Only the Vite dev server is required for end-to-end frontend verification.

### Lint / test / build / run

From repository root (`/workspace`):

```bash
pnpm install          # install all workspace deps
pnpm lint             # oxlint in web/
pnpm test             # vitest in web/
pnpm build            # tsc + vite build
pnpm dev              # dev server at http://localhost:5173
```

Production preview after build:

```bash
pnpm preview          # serves web/dist (default port 4173)
```

### Dev server notes

- Vite binds to `localhost:5173` by default.
- Use tmux for long-running `pnpm dev` sessions on Cloud Agent VMs.
- After `pnpm install`, dependency changes are picked up by Vite HMR without restarting the dev server in most cases.

### Verification

```bash
./scripts/verify-environment.sh
```

Runs toolchain checks, installs dependencies, lint, test, build, and optionally probes the dev server when `VERIFY_DEV_SERVER=1`.

### VM update script

On VM startup, run from repo root:

```bash
pnpm install
```

Do not add `pnpm dev`, migrations, or build steps to the update script.
