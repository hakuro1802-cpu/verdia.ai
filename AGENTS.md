# AGENTS.md

Guidance for AI agents working in the **verdia.ai** repository.

## Repository status

This repository is currently a **greenfield stub**: a single `README.md` with the project title and no application source, dependency manifests, Docker config, CI, or tests. There is nothing to build, lint, test, or run until application code is added.

- **Remote:** `https://github.com/hakuro1802-cpu/verdia.ai`
- **Default branch:** `main`
- **Branches with code:** `main` only (no other remote branches)

When code lands, update this file with service-specific startup, lint, and test commands.

## Cursor Cloud specific instructions

### Services

| Service | Required? | Notes |
|---------|-----------|-------|
| Application server | — | Not defined in repo yet |
| Database / cache | — | Not defined in repo yet |
| Docker Compose stack | — | No `docker-compose` or `Dockerfile` in repo; Docker is not installed on the default Cloud Agent VM |

There are **no services to start** until the codebase defines them.

### VM baseline toolchain

The Cloud Agent VM provides these tools without extra install steps:

| Tool | Version (approx.) |
|------|-------------------|
| Node.js | 22.x |
| npm | 10.x |
| pnpm | 10.x |
| Python | 3.12 |
| Rust (rustc) | 1.83 |
| Go | 1.22 |
| Git | system |
| `gh` CLI | authenticated for this repo |

Docker is **not** available on the default VM. If the project later needs Docker, use a custom environment build or document container-free local alternatives.

### Lint / test / build / run

Not applicable until dependency manifests and scripts exist (e.g. `package.json`, `pyproject.toml`, `Makefile`).

### Verification (current stub repo)

From `/workspace`, confirm the environment and repo connectivity:

```bash
git status
git fetch origin
test -f README.md && grep -q verdia README.md
node --version && python3 --version && pnpm --version
```

All commands should succeed. There is no application hello-world flow until an app is added.

### After application code is added

1. Document required vs optional services in this section.
2. Add concrete commands for lint, test, build, and dev server startup.
3. Extend the VM update script (via Cursor environment settings) with the correct install command for the chosen package manager — do not add service startup to the update script.
