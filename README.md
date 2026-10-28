# agentBANK — The Agent First Banking Platform

<p align="center">
  <img src="https://img.shields.io/badge/BIAN-v12%20(10%20Domains)-2563EB?style=for-the-badge" alt="BIAN v12"/>
  <img src="https://img.shields.io/badge/Open%20Banking-v3.1%20(44%20Endpoints)-0B1120?style=for-the-badge" alt="Open Banking v3.1"/>
  <img src="https://img.shields.io/badge/MCP%20%26%20SDK-14%20Tools-0EA5E9?style=for-the-badge" alt="MCP 1.0 & SDK"/>
  <img src="https://img.shields.io/badge/Security-FAPI%202.0%20%2B%20DPoP%20%2B%20SHA256-10B981?style=for-the-badge" alt="FAPI 2.0 + SHA-256"/>
  <a href="https://github.com/watsongm/agentbank/actions/workflows/ci.yml">
    <img src="https://github.com/watsongm/agentbank/actions/workflows/ci.yml/badge.svg?style=for-the-badge" alt="CI"/>
  </a>
</p>

<p align="center">
  <strong>An AI-native core banking reference platform combining UK Open Banking v3.1 and the BIAN v12 Service Domain model — built from the ground up with AI agents as a first-class, cryptographically audited customer channel.</strong>
</p>

---

## Why Agent-First Banking?

Traditional banking APIs were designed for mobile screen navigation. When a customer's primary interface is an AI agent, banking products stop being screens and become **composable, schema-validated primitives** sitting inside a four-layer stack:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│  L1 · CONSUMER INTENT       Plain-language financial goals & constraints   │
├────────────────────────────────────────────────────────────────────────────┤
│  L2 · AGENT RUNTIME         MCP 1.0 Server (stdio) · @agentbank/sdk        │
│                             14 typed banking primitives with Zod schemas   │
├────────────────────────────────────────────────────────────────────────────┤
│  L3 · DOMAIN RAILS          10 BIAN v12 Service Domains · 44 REST Routes   │
│                             UK Open Banking v3.1 (AISP / PISP / Statements)│
├────────────────────────────────────────────────────────────────────────────┤
│  L4 · TRUST FABRIC          FAPI 2.0 Scoped Consent · RFC 9449 DPoP Guard  │
│                             SHA-256 Hash-Chained Audit Ledger · OTel Spans │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### 1 · Interactive Platform & Executive Briefing (Zero-Dependency Mock Mode)

Run the React + Vite platform locally with an in-memory BIAN/Open Banking mock engine (and one-click toggle to a live backend):

```bash
npm install
npm run dev
```

- **Interactive Platform, API Console & Observability**: <http://localhost:5173>
- **Executive Architecture Briefing (5 Interactive Exhibits)**: <http://localhost:5173/agentbank-executive-visuals.html> (or open `agentbank-executive-visuals.html` directly in any browser)

### 2 · Live Core Banking Backend (Fastify + Prisma + PostgreSQL 16)

Spin up the full backend and seeded PostgreSQL database via Docker Compose:

```bash
docker compose up --build   # Runs on http://localhost:3000
```

Or run directly against a local PostgreSQL instance:

```bash
cd backend
cp ../.env.example .env
npm install && npm run db:generate
npx prisma db push && npm run db:seed
npm run dev                 # http://localhost:3000
```

| Endpoint | Purpose |
| :--- | :--- |
| `GET /docs` | Interactive Scalar OpenAPI 3.1 Reference UI |
| `GET /openapi.json` | Canonical OpenAPI 3.1 specification (44 domain endpoints + OAuth) |
| `POST /open-banking/v3.1/oauth/token` | Mint scoped FAPI 2.0 consent tokens (`accounts:read payments:write ...`) |
| `GET /observability/sessions` | Live audit ring buffer & session telemetry stream |
| `GET /observability/audit-verify` | Verify cryptographic integrity of the SHA-256 audit hash chain |
| `GET /metrics` | Prometheus metrics exporter (`http_requests_total`, latency histograms) |

> **Authentication:** Pass `Authorization: Bearer demo-token` for full-scope sandbox access (`PAR-ARIA`), or mint a least-privilege token via `POST /open-banking/v3.1/oauth/token`.

---

## 10 BIAN v12 Domains & 14 Agent Tool Primitives

Every BIAN v12 Service Domain is implemented end-to-end across `openapi.yaml`, the Fastify/Prisma backend (`backend/src/domains/`), the in-memory mock (`src/mock/api.js`), the MCP server (`mcp-server/`), and the JS/TS SDK (`sdk/`):

| Code | BIAN v12 Service Domain | REST Endpoints | Agent Tool Primitives (`MCP` & `SDK`) | Canonical Seed IDs |
| :--- | :--- | :---: | :--- | :--- |
| **`SD-01`** | `SD-PartyReferenceDataManagement` | 4 | `get_party()` | `PAR-ARIA`, `PAR-MAHLI`, `PAR-DEVON` |
| **`SD-02`** | `SD-CurrentAccount` | 5 | `get_accounts()`, `get_balance()` | `ACC-1829` (Aria), `ACC-3310` (Devon) |
| **`SD-03`** | `SD-PaymentExecution` | 6 | `initiate_payment()`, `get_payment_status()` | `PAY-70001` |
| **`SD-04`** | `SD-AccountingTransactions` | 4 | `get_transactions()` | `TXN-48291` |
| **`SD-05`** | `SD-ConsumerLoan` | 5 | `get_loan_details()`, `apply_for_loan()` | `LOAN-48291` (Mahliqa) |
| **`SD-06`** | `SD-CreditCard` | 5 | `get_card_details()`, `block_card()` | `CRD-88421` (Aria Visa) |
| **`SD-07`** | `SD-SavingsAccount` | 4 | *(queried/swept via `get_balance` & `initiate_payment`)* | `ACC-2041` (Aria Savings) |
| **`SD-08`** | `SD-InvestmentPortfolioManagement` | 4 | `get_portfolio()`, `place_order()` | `PRT-29183` (`AAPL`, `MSFT`, `VWRL`) |
| **`SD-09`** | `SD-RegulatoryReporting` | 4 | `run_aml_screen()` | `CASE-9001` |
| **`SD-10`** | `SD-CustomerEventHistory` | 3 | `subscribe_events()` | `SUB-1001` |

---

## Connecting AI Agents (MCP Server & SDK)

### Option A · Model Context Protocol (`mcp-server/index.js`)

Add `agentbank` to `~/.claude/claude_desktop_config.json` (or Cursor MCP settings) to expose all 14 Zod-validated tools over stdio JSON-RPC 2.0:

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

### Option B · TypeScript / JavaScript SDK (`sdk/index.js`)

```javascript
import { AgentBankAgent } from "./sdk/index.js";

const agent = new AgentBankAgent({
  scope: "party:read accounts:read transactions:read payments:write",
  baseUrl: "http://localhost:3000",
});

// 1. Mint a scoped FAPI 2.0 consent token
const token = await agent.authenticate();

// 2. Verify customer identity & inspect real-time balance
const party   = await agent.tools.get_party({ consent_token: token });
const balance = await agent.tools.get_balance({ account_id: "ACC-1829" });

// 3. Execute an idempotent savings sweep
const payment = await agent.tools.initiate_payment({
  debtor_account:   "ACC-1829",
  creditor_account: "ACC-2041",
  amount:           120.00,
  currency:         "GBP",
  reference:        "AGENT-SAVINGS-SWEEP",
});
```

Both the MCP server and SDK generate a UUIDv4 `x-fapi-interaction-id` per operation (reused across 5xx/429 exponential-backoff retries to guarantee payment idempotency) and support per-call `consent_token` overrides.

---

## Security, Audit & Observability Architecture

Detailed in [ADR-0001 (Backend Stack)](docs/adr/0001-backend-stack.md) and [ADR-0002 (Security Model)](docs/adr/0002-security-model.md):

- **Scoped Consent Enforcement (`backend/src/lib/consent.ts`)**: Validates `demo-token`, base64-encoded JSON consent tokens, and 3-part JWTs across 15 granular `ConsentScope` permissions. Insufficient scope returns `403 UK.OBIE.Rules.AfterCutoffDateTime / Forbidden`.
- **RFC 9449 DPoP & Replay Guard (`backend/src/lib/dpop.ts`)**: Validates `dpop+jwt` headers, HTTP method binding (`htm`), and rejects replayed `jti` identifiers with `401 Unauthorized`.
- **Tamper-Evident SHA-256 Audit Chain (`backend/src/lib/audit.ts`)**: Every API call computes `rowHash = sha256(timestamp + customerId + tool + prevHash + paramsHash + statusCode)` in an in-memory ring buffer and persists to PostgreSQL (`AuditEvent` & `AuditLog`).
- **Live Telemetry Control Plane (`src/Observability.jsx`)**: Real-time LLM/tool latency charts, step-by-step agent reasoning trace replay, OpenTelemetry span waterfalls, and cryptographic hash-chain inspection.

---

## Repository Structure & Testing

```text
agentbank/
├── src/                              # React 18 + Vite 5 interactive platform
│   ├── App.jsx                       # Precision Core Banking showcase & API Console
│   ├── Observability.jsx             # Live & simulated telemetry + OTel waterfall
│   ├── components/{McpTab,SdkTab}.jsx# Interactive MCP & SDK workbenches
│   ├── api/{index,client,mockClient}.js # Runtime switchable Mock / Live API client
│   ├── data/                         # Canonical BIAN domains, tools, steps & recipes
│   └── mock/{api,constants,sessions}.js # 44-endpoint in-memory mock engine
├── agentbank-executive-visuals.html  # Standalone 5-exhibit executive briefing deck
├── openapi.yaml                      # Canonical OpenAPI 3.1 contract (44 endpoints + OAuth)
├── mcp-server/index.js               # Stdio MCP 1.0 server (14 Zod-validated tools)
├── sdk/index.js                      # AgentBankAgent client library
├── backend/                          # Fastify 4 + Prisma 5 + PostgreSQL 16 core bank
│   ├── prisma/{schema.prisma,seed.ts}# 10 BIAN domain models & 3 seeded customer personas
│   ├── src/lib/                      # Auth, Consent, DPoP, FAPI, SHA-256 Audit, Metrics
│   ├── src/domains/                  # 10 BIAN domains + OAuth token endpoint
│   └── test/{unit,smoke}.test.ts     # 17 unit/contract tests + 21 DB integration tests
└── docs/                             # Architecture Decision Records (ADRs) & UX reviews
```

### Running Tests & Verification

```bash
# 1. Build frontend & executive briefing deck
npm run build

# 2. Run backend TypeScript type-check & unit/contract suite (no DB required — 17 tests)
cd backend && npm run type-check && npm test

# 3. Run full 38-test suite (17 unit + 21 Postgres integration smoke tests)
DATABASE_URL="postgresql://agentbank:agentbank@localhost:5432/agentbank?schema=public" npm test
```

---

## Disclaimer

agentBANK is an open-source **reference implementation** for architectural and educational exploration. It is not a regulated financial institution and does not hold real customer funds.
