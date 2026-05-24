# Contributing to agentBANK

Thank you for your interest in contributing! This guide will get you from zero to a running dev environment and explain our workflow conventions.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Node.js** | >= 20 LTS | [nodejs.org](https://nodejs.org) or `nvm install 20` |
| **npm** | >= 9 | Bundled with Node.js 20 |
| **Docker** | any recent | [docker.com/get-started](https://www.docker.com/get-started) |
| **Docker Compose** | v2 (plugin) | Bundled with Docker Desktop |
| **Postgres** | 16 (via Docker) | Handled automatically by `docker compose up` |
| **Git** | >= 2.40 | [git-scm.com](https://git-scm.com) |

Optional: install `pino-pretty` globally for colourised logs during development:

```bash
npm install -g pino-pretty
```

---

## Local Setup

### 1. Clone and install

```bash
git clone https://github.com/watsongm/agentbank.git
cd agentbank
npm install          # installs frontend / root workspace deps
```

### 2. Start the full stack with Docker Compose

```bash
docker compose up --build
```

This starts:
- **Postgres 16** at `localhost:5432`
- **agentBANK backend** at `http://localhost:3000`

The first startup runs `prisma db push` and seeds the database automatically.

### 3. Run the frontend dev server (no backend required)

```bash
npm run dev          # http://localhost:5173
```

The frontend uses an in-memory mock API by default.

### 4. Run the backend in dev mode (against existing Postgres)

```bash
cd backend
cp .env.example .env   # set DATABASE_URL if not using Docker Compose
npm install
npm run db:generate    # generates Prisma client
npx prisma db push --accept-data-loss --skip-generate
npm run db:seed
npm run dev            # http://localhost:3000 (hot-reloads via tsx watch)
```

---

## Branch Strategy

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/*` | New features or enhancements | `feature/add-consent-flow` |
| `fix/*` | Bug fixes | `fix/payment-decimal-rounding` |
| `chore/*` | Non-functional changes (deps, docs, CI) | `chore/update-prisma` |
| `docs/*` | Documentation-only changes | `docs/improve-readme` |

Branch directly from `main`. Keep branches short-lived.

---

## Pull Request Checklist

Before opening a PR, ensure all of the following pass locally:

- [ ] **Tests pass** --- `cd backend && npm test`
- [ ] **Type-check passes** --- `cd backend && npm run type-check`
- [ ] **No lint errors** --- `cd backend && npm run lint`
- [ ] **Frontend builds** --- `npm run build` (from repo root)
- [ ] **No regressions** --- health endpoint returns `{ "status": "ok" }` at `GET /health`
- [ ] **PR description** explains what changed and why
- [ ] **Self-review** --- diff reviewed line-by-line before requesting review

---

## Running Backend Tests

```bash
cd backend
npm test
```

The smoke suite uses vitest and requires a running Postgres instance. Set `DATABASE_URL` in `.env` or rely on the Docker Compose stack.

Watch mode:

```bash
cd backend
npm run test:watch
```

---

## Running the MCP Server Locally

```bash
cd mcp-server
npm install
AGENTBANK_BASE_URL=http://localhost:3000 \
AGENTBANK_TOKEN="Bearer demo-token" \
  node index.js
```

Connect Claude Desktop by adding this to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agentbank": {
      "command": "node",
      "args": ["/absolute/path/to/agentbank/mcp-server/index.js"],
      "env": {
        "AGENTBANK_BASE_URL": "http://localhost:3000",
        "AGENTBANK_TOKEN": "Bearer demo-token"
      }
    }
  }
}
```

Restart Claude Desktop and all 14 agentBANK tools will appear in the tool bar.

---

## Viewing the Observability Stack

```bash
docker compose -f docker-compose.yml -f docker-compose.observability.yml --profile observability up
```

| URL | Service |
|-----|---------|
| `http://localhost:3000/metrics` | Raw Prometheus metrics (backend) |
| `http://localhost:9090` | Prometheus UI |
| `http://localhost:3001` | Grafana (admin / agentbank) |
| `http://localhost:3100` | Loki log sink |

The **agentBANK -- Backend Observability** dashboard is pre-provisioned in Grafana with panels for request rate, error rate, and p50/p95 latency.

---

## Code Style

- **TypeScript** --- strict mode, NodeNext modules
- **Imports** --- always use `.js` extensions in TypeScript source
- **Error handling** --- throw `AgentBankError` from `lib/errors.ts`
- **Logging** --- use the typed `log()` helper from `lib/logger.ts` in service code

---

## Architecture Decisions

See [docs/adr/](docs/adr/) for Architecture Decision Records. When making a significant architectural choice, add a new ADR before submitting the PR.

---

## Questions?

Open a [GitHub Discussion](https://github.com/watsongm/agentbank/discussions) or reach out via the issue tracker.
