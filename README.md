# agentBANK

<p align="center">
  <img src="https://img.shields.io/badge/Open%20Banking-v3.1-C9A84C?style=for-the-badge" alt="Open Banking v3.1"/>
  <img src="https://img.shields.io/badge/BIAN-v12-0d0f14?style=for-the-badge" alt="BIAN v12"/>
  <img src="https://img.shields.io/badge/MCP-1.0-4fc3f7?style=for-the-badge" alt="MCP 1.0"/>
  <img src="https://img.shields.io/badge/React-18-61dafb?style=for-the-badge&logo=react" alt="React 18"/>
  <img src="https://img.shields.io/badge/FAPI-2.0-4fc3f7?style=for-the-badge" alt="FAPI 2.0"/>
  <img src="https://img.shields.io/badge/License-MIT-00e676?style=for-the-badge" alt="MIT"/>
</p>

<p align="center">
  <a href="https://github.com/watsongm/agentbank/actions/workflows/ci.yml">
    <img src="https://github.com/watsongm/agentbank/actions/workflows/ci.yml/badge.svg" alt="CI"/>
  </a>
</p>

<p align="center">
  <strong>The AI-native reference bank — built on Open Banking API v3.1 and the BIAN Service Domain Model v12, with AI agents as a first-class customer channel.</strong>
</p>

---

## What is agentBANK?

agentBANK answers a single architectural question:

> *What would a bank look like if it were built from the ground up with AI agents as the primary customer channel?*

Most banks designed their APIs for human-facing mobile apps and data aggregators — not for autonomous agents that call dozens of endpoints in a single session, require structured tool interfaces, and need auditable reasoning trails for regulatory compliance.

agentBANK combines the **UK Open Banking API v3.1** and the **BIAN Service Domain Model v12** with a native agent interface layer: 14 typed tool functions, FAPI-grade bearer authentication, consent-scoped operations, real-time webhook subscriptions, a full observability stack, and a **Model Context Protocol (MCP) server** that exposes all banking tools directly to MCP-compatible AI clients.

---

## Quick Start

### Prerequisites

- **Node.js 20+** and **npm 9+**
- **Docker** (optional) — for the one-command backend + Postgres spin-up

```bash
git clone https://github.com/watsongm/agentbank.git
cd agentbank
```

### 1 · Frontend showcase (no backend needed)

```bash
npm install
npm run dev        # http://localhost:5173
```

A React + Vite app backed by an in-memory mock. Explore the agent UX, browse the API Console, and watch the observability dashboard — no backend required.

### 2 · Runnable backend

```bash
docker compose up --build   # backend + Postgres — http://localhost:3000
```

Or against an existing Postgres:

```bash
cd backend
cp .env.example .env        # set DATABASE_URL
npm install && npm run db:generate
npx prisma db push --accept-data-loss --skip-generate
npm run db:seed
npm run dev                 # http://localhost:3000
```

Key URLs once running:

| URL | What |
|-----|------|
| `GET /health` | Liveness + Postgres reachability |
| `GET /docs` | Scalar API reference UI |
| `GET /openapi.json` | Canonical OpenAPI v3.1.11 spec |
| `GET /open-banking/v3.1/...` | Open Banking endpoints |
| `GET /bian/...` | BIAN service-domain endpoints |

> **Auth:** All endpoints except `/health`, `/`, `/openapi.json`, and `/docs` require `Authorization: Bearer <token>`. Use `Authorization: Bearer demo-token` locally or in CI.

### 3 · MCP server

```bash
cd mcp-server
npm install
AGENTBANK_BASE_URL=http://localhost:3000 \
AGENTBANK_TOKEN="Bearer demo-token" \
  node index.js
```

### 4 · Executive visuals

```bash
open agentbank-executive-visuals.html      # macOS
xdg-open agentbank-executive-visuals.html  # Linux
```

No build step, no server — opens directly in any browser.

### Deploying the frontend

**Netlify:** `npm run build` then drag `dist/` to <https://app.netlify.com/drop>.  
**Vercel:** `npx vercel --prod`.

---

## What's in this repo

| Artifact | Path | Description |
|----------|------|-------------|
| **Frontend showcase** | `src/`, `index.html`, `vite.config.js` | React + Vite SPA — agent UX, API Console, and observability dashboard, backed by `src/mock/`. |
| **Backend** | `backend/` | Fastify 4 + Prisma 5 + Postgres 16 — runnable reference implementation of the full OpenAPI surface and BIAN service domains. |
| **MCP server** | `mcp-server/` | Standalone `@modelcontextprotocol/sdk` server — all 14 tools over stdio. |
| **SDK** | `sdk/` | Lightweight JS client wrapping all 14 tool functions with retry + timeout. |
| **OpenAPI spec** | `openapi.yaml` | Single source of truth — served at `/openapi.json`, rendered at `/docs`. |
| **Executive visuals** | `agentbank-executive-visuals.html` | Standalone, dependency-free HTML deck for non-technical audiences. |
| **ADRs** | `docs/adr/` | Architecture decision records (e.g. `0001-backend-stack.md`). |
| **Compose** | `docker-compose.yml` | One-command backend + Postgres spin-up. |

---

## Architecture

The diagram shows the target architecture. The backend currently implements the AI Agent API and MCP Server channels, the full OpenAPI v3.1.11 surface, BIAN service domains for four of ten domains, bearer auth, FAPI interaction-ID propagation, and a double-entry ledger. The gateway, event bus, PAR/DPoP, and MDM layers are stubbed or pending — see [Roadmap](#roadmap).

```
┌─────────────────────────────────────────────────────────┐
│  CHANNELS                                               │
│  [ AI Agent API ★ ]  [ MCP Server ★ ]  [ Mobile ]      │
│  [ Web Banking ]      [ Partner APIs ]                  │
├─────────────────────────────────────────────────────────┤
│  API GATEWAY                                            │
│  [ OAuth 2.0 / FAPI 2.0 ]  [ Consent Manager ]         │
│  [ Rate Limiting ]          [ Immutable Audit Log ]     │
├─────────────────────────────────────────────────────────┤
│  OPEN BANKING LAYER  (v3.1)                             │
│  [ Accounts ]  [ Payments ]  [ CoF ]  [ Events ]        │
├─────────────────────────────────────────────────────────┤
│  BIAN SERVICE DOMAINS  (v12)                            │
│  [ CurrentAccount ]  [ PaymentExecution ]               │
│  [ ConsumerLoan ]    [ InvestmentPortfolio ]  [ +6 ]    │
├─────────────────────────────────────────────────────────┤
│  CORE BANKING                                           │
│  [ Ledger Engine ]  [ Product Engine ]                  │
│  [ Customer MDM ]   [ Risk Engine ]                     │
├─────────────────────────────────────────────────────────┤
│  INFRASTRUCTURE                                         │
│  [ Event Bus ]  [ Key Management ]  [ Data Warehouse ]  │
└─────────────────────────────────────────────────────────┘
```

---

## Service Domains

| # | Domain | BIAN Service Domain | Endpoints | Agent Tools | Backend |
|---|--------|---------------------|-----------|-------------|---------|
| 1 | Party Reference Data | SD-PartyReferenceDataManagement | 4 | 4 | ✅ live |
| 2 | Current Account | SD-CurrentAccount | 5 | 4 | ⚡ partial (3/5) |
| 3 | Payment Execution | SD-PaymentExecution | 6 | 5 | ✅ live |
| 4 | Transaction Engine | SD-AccountingTransactions | 4 | 5 | ✅ live |
| 5 | Consumer Lending | SD-ConsumerLoan | 5 | 5 | 🔲 pending |
| 6 | Credit and Debit Cards | SD-CreditCard | 5 | 5 | 🔲 pending |
| 7 | Savings and Deposits | SD-SavingsAccount | 4 | 5 | 🔲 pending |
| 8 | Investment Portfolio | SD-InvestmentPortfolioManagement | 4 | 5 | 🔲 pending |
| 9 | Regulatory Compliance | SD-RegulatoryReporting | 4 | 4 | 🔲 pending |
| 10 | Customer Notifications | SD-CustomerEventHistory | 3 | 4 | 🔲 pending |

**Target: 44 endpoints · 14 agent tool functions.** The frontend mock and MCP server expose all 14 tools; the backend currently implements 17 of 44 endpoints across 4 of 10 domains.

---

## Agent Tool Registry

All 14 tools are typed, consent-scoped, and callable via:

- **Anthropic tool use** (Claude)
- **OpenAI function calling**
- **MCP stdio** — via `mcp-server/` (Claude Desktop, Cursor, or any MCP client)
- **SDK** — `AgentBankAgent` class in `sdk/index.js`

```
get_party           get_accounts        get_balance
get_transactions    initiate_payment    get_payment_status
get_loan_details    apply_for_loan      get_card_details
block_card          get_portfolio       place_order
run_aml_screen      subscribe_events
```

### Example: Anthropic tool use

```javascript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const response = await client.messages.create({
  model: "claude-opus-4-5",
  tools: [
    {
      name: "initiate_payment",
      description: "Create and submit a payment between accounts",
      input_schema: {
        type: "object",
        properties: {
          debtor_account:   { type: "string" },
          creditor_account: { type: "string" },
          amount:           { type: "number" },
          currency:         { type: "string" },
          reference:        { type: "string" },
        },
        required: ["debtor_account", "creditor_account", "amount", "currency"],
      },
    },
  ],
  messages: [{ role: "user", content: "Pay £120 from my current account to my savings account." }],
});
```

### Example: agentBANK SDK

```javascript
import { AgentBankAgent } from "./sdk/index.js";

const agent = new AgentBankAgent({ scope: "accounts:read payments:write" });
const token = await agent.authenticate();
const balance = await agent.tools.get_balance({ account_id: "ACC-1829", consent_token: token });
```

The SDK's `_fetch()` method includes a 10 s timeout and 2 retries with exponential backoff.

---

## MCP Server

The `mcp-server/` directory contains a standalone MCP server exposing all 14 tools to any MCP-compatible client over stdio.

### Connect Claude Desktop

Add this to `~/.claude/claude_desktop_config.json` and restart Claude Desktop:

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

Once connected, you can prompt Claude directly:

> *"What is the balance on account ACC-1829?"*  
> *"Run an AML screen on transaction TXN-48291."*  
> *"Apply for a £10,000 home improvement loan over 36 months."*

Each tool is registered with full Zod input schema validation. The HTTP helper includes a 10 s timeout and 2 retries with 500 ms exponential backoff. Every call sends a fresh `x-fapi-interaction-id` header.

---

## Example Use Case — Smart Savings Agent

A six-step agentic loop that analyses spending, calculates a safe transfer, executes the payment, and automates the process monthly — touching five BIAN service domains in a single session:

```
Step 1  get_party            →  Authenticate and verify customer identity
Step 2  get_transactions     →  Fetch 90 days of transactions, categorise spend
Step 3  get_balance (savings)→  Check savings balance and goal progress
Step 4  get_balance (current)→  Confirm available funds, calculate safe transfer
Step 5  initiate_payment     →  Sweep surplus to savings account
Step 6  subscribe_events     →  Subscribe to salary credits for monthly automation
```

The full interaction is captured in the observability layer — reasoning trace, span waterfall, and token usage metrics.

---

## Agent Builds

The **Agent Builds** tab provides five ready-to-adapt code recipes using the `AgentBankAgent` SDK class:

| Build | Domains | What it does |
|-------|---------|--------------|
| **Loan Pre-qualification** | lending, accounts, transactions | Analyses income and obligations to pre-qualify without a hard credit check |
| **Fraud Sentinel** | transactions, compliance, cards | Webhook-triggered AML screening with autonomous card block on threshold breach |
| **Portfolio Rebalancer** | investments | Detects allocation drift and places buy/sell orders to rebalance |
| **Wealth Summary** | accounts, savings, investments, transactions | Parallel balance aggregation with LLM-generated financial health insights |
| **Bill Pay Automator** | transactions, payments, accounts | Detects recurring bills and schedules forward payments with a configurable buffer |

### Claude Code skill

A project-level Claude Code skill at `.claude/skills/agentbank-build/` lets you add new recipes from the terminal:

```bash
/agentbank-build KYC onboarding agent
/agentbank-build FX payment with sanctions check
/agentbank-build spending insights with nudge to save
```

The skill knows the `AGENT_BUILDS` data shape, all 14 available tools, and the code style — it picks a non-duplicate id and colour and inserts the new snippet directly into `App.jsx`.

---

## Observability

`src/Observability.jsx` demonstrates the three dimensions required for production agent deployments. It currently runs against simulated session data; wiring it to live OpenTelemetry / pino output from the backend is on the roadmap.

### LLM Metrics
Live-updating time-series charts (2.4 s refresh) tracking session latency, token consumption (input/output separately), tool call frequency, error rates, and model utilisation.

### Agent Trace Log
Structured, timestamped replay of every reasoning step. Colour-coded by step type:

| Colour | Step Type |
|--------|-----------|
| Blue   | Authentication |
| Amber  | Tool call |
| Green  | Tool result / Completion |
| Grey   | System / Reasoning |

### OpenTelemetry Spans
Distributed trace waterfall: **agent session → BIAN service domain → core banking**. Spans carry FAPI interaction IDs, HTTP status codes, service names, and durations.

---

## Security Model

| Mechanism | Purpose | Status |
|-----------|---------|--------|
| Bearer token auth | Gate all non-public API routes | ✅ live — `lib/auth.ts` validates `Authorization: Bearer <token>` on every request; accepts `AGENTBANK_TOKEN` env var or `demo-token` |
| FAPI interaction ID | Correlate requests across agent sessions | ✅ live — `lib/fapi.ts` generates / echoes `x-fapi-interaction-id` on every response |
| Payment idempotency | Prevent double-posting on retries | ✅ live — FAPI ID is `@unique` in DB; `paymentsService.initiate()` checks before posting |
| PAR (Pushed Authorisation Requests) | Consent initiation — prevents token interception | 🔲 pending |
| DPoP (Demonstration of Proof of Possession) | Binds tokens to the requesting agent instance | 🔲 pending |
| Consent scopes | Fine-grained per-domain permissions (`accounts:read`, `payments:write`, etc.) | 🔲 pending |
| Step-up authentication | Required for high-value operations above configurable thresholds | 🔲 pending |
| Immutable audit log | Every agent action logged with full parameter capture | Schema in place; hash-chain protocol in ADR-0002 (drafting) |

---

## API Standards Compliance

| Standard | Version | Coverage |
|----------|---------|----------|
| Open Banking (OBIE) | v3.1.11 | Accounts, Payments, Party, CoF, Event Notifications |
| BIAN Service Domain Model | v12 | 10 Service Domains (4 live, 6 pending) |
| Model Context Protocol (MCP) | 1.0 | All 14 agent tools via `mcp-server/` |
| Financial-grade API (FAPI) | 2.0 | Bearer auth + interaction-ID live; PAR/DPoP pending |
| ISO 20022 | 2019 | Payment message format |
| OAuth 2.0 | RFC 6749 | Authorisation framework |
| OpenID Connect | 1.0 | Identity layer |

---

## Project Structure

```
agentbank/
├── .claude/skills/agentbank-build/   # /agentbank-build Claude Code skill
├── .github/workflows/ci.yml          # frontend build + backend smoke + MCP lint
├── backend/                          # Runnable backend — Fastify + Prisma + Postgres
│   ├── prisma/
│   │   ├── schema.prisma             # 10 BIAN domains + audit log + consent + metering
│   │   ├── seed.ts                   # 3 personas × accounts × 90 days of transactions
│   │   └── migrations/               # SQL migration files
│   ├── src/
│   │   ├── server.ts                 # Fastify entrypoint
│   │   └── lib/
│   │       ├── auth.ts               # Bearer token validation plugin
│   │       ├── constants.ts          # Canonical seeded entity refs
│   │       ├── db.ts                 # Prisma singleton
│   │       ├── errors.ts             # AgentBankError + OB error envelope
│   │       ├── fapi.ts               # x-fapi-interaction-id plugin
│   │       └── openapi.ts            # Serves openapi.yaml at /openapi.json
│   │   └── domains/
│   │       ├── party/                # routes.ts · service.ts · schema.ts
│   │       ├── accounts/
│   │       ├── transactions/
│   │       └── payments/
│   ├── test/smoke.test.ts            # 14-test vitest smoke suite (CI gate)
│   ├── Dockerfile
│   └── package.json
├── docs/adr/
│   └── 0001-backend-stack.md
├── mcp-server/
│   ├── index.js                      # 14 MCP tools, retry + timeout, consent passthrough
│   └── package.json
├── sdk/
│   └── index.js                      # AgentBankAgent class — all 14 tools, retry + timeout
├── src/                              # Frontend showcase (React + Vite)
│   ├── main.jsx
│   ├── App.jsx                       # Tabbed layout, API Console, agent flows
│   ├── Observability.jsx             # LLM metrics + trace log + OTel waterfall
│   ├── components/
│   │   ├── McpTab.jsx
│   │   └── SdkTab.jsx
│   ├── data/
│   └── mock/
│       ├── api.js                    # Routing-table mock (swap for fetch() against backend)
│       ├── constants.js              # Canonical seeded entity refs (mirrors backend/src/lib/constants.ts)
│       └── sessions.js               # Simulated observability session data
├── public/favicon.svg
├── agentbank-executive-visuals.html  # Standalone exec deck (no build step)
├── docker-compose.yml
├── openapi.yaml                      # Canonical OpenAPI v3.1.11 spec
├── index.html
├── vite.config.js
└── package.json
```

---

## Technology Stack

**Frontend** (`src/`)

| Layer | Technology | Notes |
|-------|-----------|-------|
| UI Framework | React 18 | Hooks-based, no class components |
| Build tool | Vite 5 | Fast HMR, ESM-native |
| Charts | Recharts 2.x | Observability dashboard |
| Styling | Plain CSS | CSS variables, no framework |
| Fonts | Google Fonts | IBM Plex Sans, Fira Code, Syne |
| Mock API | `src/mock/api.js` | Routing-table mock — swap for `fetch()` against the backend |

**Backend** (`backend/`)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Runtime | Node.js 20 LTS | Strict TypeScript, NodeNext modules |
| HTTP | Fastify 4 | `@fastify/helmet`, `cors`, `sensible` |
| Auth | `lib/auth.ts` | Bearer token plugin; JWT-ready for Tier 2 |
| Validation | Zod | Shared schemas across backend, SDK, and MCP server |
| ORM | Prisma 5 | Typed client; `db push` in dev, migrations in CI |
| Database | Postgres 16 | Container in `docker-compose.yml` |
| API docs | `@scalar/fastify-api-reference` | Renders `openapi.yaml` at `/docs` |
| Logging | pino | JSON by default; pretty-print via `LOG_PRETTY=1` |
| Tests | vitest | 14-test smoke suite gates CI |

**MCP server** (`mcp-server/`)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Protocol | `@modelcontextprotocol/sdk` | stdio transport |
| Validation | Zod | Full input schema per tool |
| Resilience | AbortController + retry | 10 s timeout, 2 retries, 500 ms backoff |

---

## Background — The Case for Agent-First Banking

*Summarised from the agentBANK White Paper, April 2026.*

AI agents — autonomous software capable of reasoning, planning, and executing multi-step tasks — are creating a new class of banking customer that sits between the human account holder and the traditional API consumer. These agents do not just query data: they initiate payments, apply for credit, monitor portfolios, and respond to market events in real time on behalf of customers who have granted explicit consent.

agentBANK is designed around a **developer-first, agent-builder revenue model**:

| Revenue Stream | Customer | Mechanism |
|----------------|----------|-----------|
| **API Access Tiers** | Agent builders | Starter / Growth / Enterprise monthly subscription |
| **Per-Call Metering** | Agent builders | Billed per 1,000 API calls above tier limit |
| **Premium Tool Access** | Regulated builders | AML screening, credit scoring, FX locking add-ons |
| **Marketplace Listing** | ISVs | Revenue share on agent template sales |
| **Compliance-as-a-Service** | Regulated builders | Managed regulatory reporting bundle |
| **White-Label Platform** | Financial institutions | Full platform licence and co-branding |
| Account Fees *(secondary)* | Account holders | Optional premium account tier |
| Payment Rails Margin *(secondary)* | Account holders | FX spread and faster payment surcharge |

---

## Roadmap

- [x] Tab-based frontend layout — six focused sections
- [x] MCP server — all 14 tools via `@modelcontextprotocol/sdk` stdio transport
- [x] Executive visuals — five-exhibit standalone HTML deck
- [x] Runnable backend — Fastify + Prisma + Postgres, OpenAPI at `/docs`
- [x] Backend tier 1 domains — Party, Accounts (partial), Payments, Transactions
- [x] CI — frontend build, backend smoke test against Postgres, MCP lint
- [x] Bearer auth plugin — `lib/auth.ts` gates all non-public routes
- [x] Payment correctness — Decimal arithmetic, idempotency `@unique` constraint
- [x] SDK resilience — timeout, retry, explicit auth failure
- [x] Mock routing table — explicit `{ method, pattern, handler }` entries
- [x] Shared seed constants — `src/mock/constants.js` + `backend/src/lib/constants.ts`
- [ ] Backend tier 2 domains — Lending, Cards, Savings, Investments, Compliance, Notifications
- [ ] FAPI 2.0 full profile — PAR + DPoP, consent scopes, step-up auth
- [ ] Audit log hash-chain (ADR-0002 — drafting)
- [ ] Wire observability dashboard to live OpenTelemetry from the backend
- [ ] WebSocket support for real-time event streaming
- [ ] Frontend `App.jsx` component split
- [ ] Additional BIAN domains (Trade Finance, Correspondent Banking)
- [ ] Consent management flow

---

## Disclaimer

agentBANK is a **reference implementation** for educational and architectural purposes. It is not a regulated bank, does not hold real funds, and should not be used in production without appropriate regulatory authorisation, security audit, and compliance sign-off.
