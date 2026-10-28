# Agent 1 — Backend Core & Security Engineer

## Role & Mission
Own the core Fastify server lifecycle, security middleware (Bearer auth, FAPI 2.0 interaction ID, Consent scoping, DPoP proof verification), error handling, cryptographic audit logging, and Prometheus/Pino observability plugins.

## Strict File Ownership
- `backend/src/lib/*` (`auth.ts`, `consent.ts`, `dpop.ts`, `errors.ts`, `audit.ts`, `metrics.ts`, `logger.ts`, `fapi.ts`, `openapi.ts`, `constants.ts`, `db.ts`)
- `backend/src/server.ts`
- `backend/Dockerfile`
- `docs/adr/*`

## Key Deliverables
1. **Unified Auth & Consent Pipeline (`auth.ts` + `consent.ts`):**
   - Allow `demo-token`, `process.env.AGENTBANK_TOKEN`, and base64-JSON / JWT consent payloads (`{ customerId, scopes, expiresAt }`) to pass `authPlugin` and populate `req.consent`.
   - Fix `isPublic()` in both `auth.ts` and `consent.ts` to properly allow `/docs` and `/docs/*`, `/openapi.json`, `/health`, `/metrics`, `/open-banking/v3.1/oauth/token`, `/observability/*`, and `/`.
   - Expand `ConsentScope` enum in `consent.ts` to cover all 10 BIAN domains while keeping backward compatibility.
2. **Zod Validation Error Handling (`errors.ts`):**
   - Detect `err instanceof ZodError` (or `err.name === "ZodError"`) in `errorHandler` and return HTTP `400 BadRequest` with standard Open Banking error envelope (`UK.OBIE.Field.Invalid`) and formatted Zod issues.
3. **Observability & Audit Wiring (`server.ts`, `metrics.ts`, `logger.ts`, `audit.ts`):**
   - Register `metricsPlugin` in `server.ts` so `GET /metrics` serves Prometheus metrics.
   - Wire `loggerSerializers` from `logger.ts` into Fastify's logger configuration.
   - Update `audit.ts` to use `req.routeOptions.url` instead of deprecated `routerPath`, write both `AuditEvent` and hash-chained `AuditLog` entries, and expose `GET /observability/sessions` (returning recent audit events + metrics summary for the frontend Observability dashboard).
4. **DPoP Proof Verification (`dpop.ts`):**
   - Enhance `dpopPlugin` to parse and validate RFC 9449 `dpop+jwt` structure (`typ`, `htm`, `htu`, `iat`, `jti`) when a `DPoP` header is provided, with in-memory `jti` replay detection.
5. **Docker OpenAPI Packaging (`backend/Dockerfile` & `openapi.ts`):**
   - Ensure `openapi.yaml` is copied or resolved properly so `/openapi.json` serves the complete 44-endpoint specification in both local dev and Docker containers.
