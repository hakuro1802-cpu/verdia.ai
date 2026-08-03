# verdia.ai

Web application monorepo for **verdia.ai**.

## Prerequisites

- Node.js 22+
- [pnpm](https://pnpm.io/) 10+

## Quick start

```bash
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173). The landing page heading should read **verdia.ai**.

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Vite dev server (`web/`) |
| `pnpm build` | Production build |
| `pnpm preview` | Serve production build locally |
| `pnpm lint` | Run oxlint |
| `pnpm test` | Run Vitest unit tests |
| `./scripts/verify-environment.sh` | Verify toolchain and run CI-style checks |

## Project layout

| Path | Purpose |
|------|---------|
| `web/` | Vite + React + TypeScript frontend |
| `scripts/` | Environment verification scripts |
| `AGENTS.md` | Guidance for AI coding agents |
