# agentBANK Backlog

All items resolved. See commit history for details.

## Wave 1–3 Multi-Agent Engineering Enhancements (Completed)

- [x] **Full 10 BIAN Service Domains (44 Endpoints)** — Completed backend routes, services, and Zod schemas across all 10 BIAN domains (`party`, `accounts`, `payments`, `transactions`, `lending`, `cards`, `savings`, `investments`, `compliance`, `notifications`), plus OAuth 2.0 token issuance (`POST /open-banking/v3.1/oauth/token`).
- [x] **FAPI 2.0 Consent Scopes & DPoP Replay Protection** — Implemented 18-scope consent manager (`backend/src/lib/consent.ts`), OAuth scope mapping, and RFC 9449 DPoP proof verification with 5-minute `jti` replay cache (`backend/src/lib/dpop.ts`).
- [x] **Immutable SHA-256 Hash-Chained Audit Log** — Implemented cryptographic `rowHash`/`prevHash` chaining (`backend/src/lib/audit.ts`), live chain verification (`GET /observability/audit-verify`), and telemetry feed (`GET /observability/sessions`).
- [x] **Runtime Zod Validation Error Handling** — Updated `errorHandler` (`backend/src/lib/errors.ts`) to format runtime `ZodError` exceptions as `400 UK.OBIE.Field.Invalid` Open Banking envelopes instead of `500`.
- [x] **SDK & MCP Server Alignment** — Fixed `AgentBankAgent._fetch()` header precedence in `sdk/index.js` so `this._token` is not clobbered by empty per-call headers, aligned all 14 tool payloads and paths with backend and mock routes, and documented `/open-banking/v3.1/oauth/token` in `openapi.yaml`.
- [x] **Frontend Modularization & Live Telemetry Mode** — Extracted `src/App.jsx` and `src/Observability.jsx` into modular subcomponents (`src/components/tabs/*`, `src/components/observability/*`) with a unified API client (`src/api/client.js`) and Live/Mock runtime toggle (`src/context/RuntimeModeContext.jsx`).
- [x] **Unit & Integration Test Suite + CI/Docker Polish** — Added DB-independent unit and HTTP contract test suite (`backend/test/unit.test.ts`), expanded Postgres integration smoke tests (`backend/test/smoke.test.ts`) across all 10 BIAN domains, mounted `openapi.yaml` in `docker-compose.yml`, and added MCP/SDK syntax checks in `.github/workflows/ci.yml`.

## Previously Completed

- [x] **`consent_token` passthrough** — threaded through as per-call `Authorization` header via `consentHeaders()` helper in `mcp-server/index.js`
- [x] **`apply_for_loan` currency param** — added optional `currency: z.string().length(3).default("GBP")`
- [x] **`place_order` fractional quantities** — changed `z.number().int()` → `z.number().positive()`
- [x] **`App.jsx` component split** — split into `src/data/`, `src/mock/`, and `src/components/McpTab.jsx`; App.jsx reduced from 1937 → ~700 lines
- [x] **OpenAPI spec** — `openapi.yaml` added covering all 44 endpoints across 10 BIAN service domains (OpenAPI 3.1.0)
- [x] **Observability wired to API Console** — `sendReq()` pushes real call data into the same `sessions`/`history` state used by the Observability panel
- [x] **Retry + timeout on `apiCall`** — 2 retries, 500ms backoff, 10s `AbortController` timeout
- [x] **Pagination cursor in `get_transactions`** — added `cursor: z.string().optional()` param
- [x] **Webhook ownership verification** — `subscribe_events` generates `verificationToken: crypto.randomUUID()` and includes it in the POST body
- [x] **`AgentBankAgent` SDK** — added `sdk/index.js` + `sdk/package.json` (`@agentbank/sdk`)
- [x] **`.env.example`** — added with `AGENTBANK_BASE_URL` and `AGENTBANK_TOKEN`
- [x] **`.claude/skills/` committed** — already present in repo (confirmed via `git ls-files`)
