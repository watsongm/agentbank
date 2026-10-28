# Agent 4 — Wealth, Compliance & Events Engineer

## Role & Mission
Implement the Wealth, Regulatory Compliance, Customer Event Notifications, and OAuth 2.0 Service Domains in the backend (Domains 8–10 + OAuth), and enrich the Prisma database seed to cover all 10 BIAN domains.

## Strict File Ownership
- `backend/src/domains/investments/*`
- `backend/src/domains/compliance/*`
- `backend/src/domains/notifications/*`
- `backend/src/domains/oauth/*`
- `backend/prisma/seed.ts`

## Key Deliverables
1. **Domain 8 — Investment Portfolio (`investments/` — 4 endpoints):**
   - `GET /bian/investment-portfolio/:portfolioId/retrieve` (`get_portfolio`)
   - `POST /bian/investment-portfolio/initiate`
   - `POST /bian/investment-portfolio/:portfolioId/request` (`place_order` — creates an `Order`, executes `MARKET` orders atomically against `Holding` and `Portfolio.cashBalance`/`marketValue`)
   - `GET /bian/investment-portfolio/:portfolioId/performance`
2. **Domain 9 — Regulatory Compliance (`compliance/` — 4 endpoints):**
   - `POST /bian/regulatory-reporting/initiate`
   - `GET /bian/regulatory-reporting/:reportId/retrieve`
   - `POST /bian/aml-screening/evaluate` (`run_aml_screen` — evaluates party or transaction risk, persists `ComplianceCase`, returns `caseId`, `decision`, `score`, `reasons`)
   - `GET /bian/aml-screening/:caseId/retrieve`
3. **Domain 10 — Customer Notifications (`notifications/` — 3 endpoints):**
   - `POST /bian/customer-event-history/initiate`
   - `GET /bian/customer-event-history/:partyId/list`
   - `POST /bian/customer-event-history/webhook` (`subscribe_events` — persists `NotificationSubscription` with `verificationToken`)
4. **OAuth 2.0 Token Endpoint (`oauth/` — 1 endpoint):**
   - `POST /open-banking/v3.1/oauth/token` — validates `grant_type` (`client_credentials`), parses requested `scope` string (e.g., `"accounts:read payments:write"`), maps to `ConsentScope` permissions, and returns `{ access_token, token_type: "Bearer", expires_in: 3600, scope }`.
5. **Comprehensive Seed Data (`backend/prisma/seed.ts`):**
   - Seed `Repayment` schedule rows for `LOAN-48291`, initial `ComplianceCase` (`CASE-9001`), `NotificationSubscription` (`SUB-1001`), and a default `Client` (`agentbank-sdk-client`) so every endpoint has deterministic data out of the box.
