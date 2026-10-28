# Agent 6 — QA, Contract Testing & DevOps Engineer

## Role & Mission
Ensure end-to-end quality, expand automated test coverage across all 10 BIAN domains and security layers, maintain CI/CD pipelines and observability containers, and keep repository hygiene pristine.

## Strict File Ownership
- `backend/test/*`
- `.github/workflows/*`
- `docker-compose.yml`, `docker-compose.observability.yml`
- `infra/*`
- `.env.example`, `backend/.env.example`

## Key Deliverables
1. **Repository & Config Hygiene:**
   - Untrack committed cruft files (`.DS_Store`, `vite.config.js.timestamp-*.mjs`, `backend/vitest.config.ts.timestamp-*.mjs`).
   - Restore complete `.env.example` documenting `VITE_API_URL`, `VITE_USE_MOCK`, `AGENTBANK_BASE_URL`, `AGENTBANK_TOKEN`, and `DATABASE_URL`.
2. **Comprehensive Automated Test Suite (`backend/test/`):**
   - Create unit tests (`backend/test/unit.test.ts`) that run **even without Postgres** (`DATABASE_URL` unset), testing `parseConsent`, scope mapping, `ZodError` formatting, DPoP verification, OAuth token generation, SDK `_fetch` header precedence & retry logic, and OpenAPI spec completeness (verifying all 44 endpoints exist in `openapi.yaml`).
   - Expand `backend/test/smoke.test.ts` to cover all 10 BIAN domains (Party, Accounts, Payments, Transactions, Lending, Cards, Savings, Investments, Compliance, Notifications), OAuth `/open-banking/v3.1/oauth/token`, `/metrics`, `/observability/sessions`, scope enforcement (`403`), and `ZodError` (`400`).
3. **CI/CD & Observability Stack (`docker-compose*.yml`, `.github/workflows/ci.yml`):**
   - Fix `docker-compose.yml` and `backend/Dockerfile` so `openapi.yaml` is available in containers.
   - Update `.github/workflows/ci.yml` to run unit tests, backend integration tests, SDK/MCP verification, and frontend build.
