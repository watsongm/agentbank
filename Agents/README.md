# agentBANK — Autonomous Agent Development Team

This directory contains the role specifications, ownership boundaries, and verification contracts for the 6-agent engineering team responsible for developing and maintaining **agentBANK**.

## Team Roster

| Agent | Role | Owned Scope |
|---|---|---|
| [01-backend-core-security.md](./01-backend-core-security.md) | **Backend Core & Security Engineer** | `backend/src/lib/*`, `backend/src/server.ts`, `backend/Dockerfile`, `docs/adr/*` |
| [02-contract-sdk-mcp.md](./02-contract-sdk-mcp.md) | **Contract, SDK & MCP Engineer** | `openapi.yaml`, `sdk/*`, `mcp-server/*`, `.claude/skills/*` |
| [03-retail-banking-domains.md](./03-retail-banking-domains.md) | **Retail Banking Domains Engineer** | `backend/src/domains/{party,accounts,payments,transactions,lending,cards,savings}/*` |
| [04-wealth-compliance-events.md](./04-wealth-compliance-events.md) | **Wealth, Compliance & Events Engineer** | `backend/src/domains/{investments,compliance,notifications,oauth}/*`, `backend/prisma/*` |
| [05-frontend-observability.md](./05-frontend-observability.md) | **Frontend & Observability Engineer** | `src/*`, `index.html`, `vite.config.js`, `agentbank-executive-visuals.html` |
| [06-qa-devops.md](./06-qa-devops.md) | **QA, Contract Testing & DevOps Engineer** | `backend/test/*`, `.github/workflows/*`, `docker-compose*.yml`, `infra/*`, `.env.example` |

## Execution Waves & Gate Protocol

1. **Wave 1 — Core Stabilization, Contracts & Frontend Wiring:** Agents 1, 2, and 5 execute in parallel across strictly non-overlapping directories.
2. **Wave 2 — Full 10-Domain BIAN Build-Out:** Agents 3 and 4 implement all remaining 27 domain endpoints, OAuth token issuance, and database seed expansion in parallel.
3. **Wave 3 — Integration, Comprehensive QA & CI/CD Hardening:** Lead Orchestrator wires all 10 domain route plugins in `backend/src/server.ts`, and Agent 6 executes the 60+ test suite, contract checks, and DevOps verification gates.
