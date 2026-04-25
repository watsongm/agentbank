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
  <strong>The AI-native reference bank — built on Open Banking API v3.1 and the BIAN Service Domain Model v12, with AI agents as a first-class customer channel.</strong>
</p>

---

## What is agentBANK?

agentBANK is a fully-featured reference bank implementation that answers a single architectural question:

> *What would a bank look like if it were built from the ground up with AI agents as the primary customer channel?*

Most banks have not built for AI agents. Their APIs were designed for human-facing mobile apps and data aggregators — not for autonomous agents that call dozens of endpoints in a single session, require structured tool interfaces, and need auditable reasoning trails for regulatory compliance.

agentBANK combines two proven open standards — the **UK Open Banking API v3.1** and the **BIAN Service Domain Model v12** — with a native agent interface layer providing structured tool functions, FAPI-grade authentication, consent-scoped operations, real-time webhook subscriptions, a full observability stack, and a **Model Context Protocol (MCP) server** that exposes all banking tools directly to MCP-compatible AI clients.

---

## What's in this repo

agentBANK ships as three independently runnable artifacts plus the SDK and MCP server they share:

| Artifact | Path | What it is |
|---|---|---|
| **Frontend mock** | `src/`, `index.html`, `vite.config.js` | React + Vite single-page app — the agent showcase, API console, and observability dashboard, backed by an in-memory mock (`src/mock/`). |
| **Runnable backend** | `backend/` | Fastify + Prisma + Postgres reference implementation of the OpenAPI v3.1.11 surface and BIAN service domains. The same HTTP surface the SDK and MCP server target. |
| **Executive visuals** | `agentbank-executive-visuals.html` | Standalone, dependency-free HTML deck — five exhibits framing the agent-native commerce thesis for non-technical audiences. |
| MCP server | `mcp-server/` | Standalone `@modelcontextprotocol/sdk` server exposing the agent tools over stdio. |
| SDK | `sdk/` | Lightweight JS client over the OpenAPI surface. |
| OpenAPI spec | `openapi.yaml` | Single source of truth — served at `/openapi.json` and rendered at `/docs` (Scalar) by the backend. |
| ADRs | `docs/adr/` | Architecture decisions (e.g. `0001-backend-stack.md`). |
| Compose | `docker-compose.yml` | One-command spin-up of the backend + Postgres. |

Everything below describes those artifacts in more detail.

---

## Frontend mock — App layout

The frontend is a self-contained React + Vite app that runs against an **in-memory mock** (`src/mock/api.js`). It's the showcase surface — open it locally to explore the agent UX, browse endpoints in the API Console, and watch the observability dashboard. Point it at the real backend by replacing `mockApi()` with `fetch()` calls (see `src/mock/api.js`).

The app uses a **tab-based layout** — a sticky tab bar below the hero keeps each topic focused without requiring long vertical scrolling.

| Tab | Contents |
| --- | --- |
| **AI Channel** | Agent authentication model, FAPI flow, and animated live agent terminal |
| **Use Case** | Smart Savings Agent — six-step interactive walkthrough with code at each step |
| **Services & APIs** | Ten BIAN service domain cards + full agent tool registry |
| **Agent Builds** | Five ready-to-adapt agent code recipes with interactive card picker |
| **Architecture** | Layered banking stack diagram |
| **MCP Server** | MCP tool manifest, Claude Desktop config, protocol trace, and quick-start guide |

Two full-screen overlays are accessible from the nav at any time:

- **API Console** — browse domains, select endpoints, edit headers and body, fire requests, inspect JSON responses
- **Observability** — live LLM metrics, agent trace log, and OpenTelemetry span waterfall

---

## MCP Server

The `mcp-server/` directory contains a standalone **Model Context Protocol server** that exposes all 14 agentBANK tools to any MCP-compatible AI client — Claude Desktop, Cursor, or any other client that supports the MCP stdio transport.

### Quick start

```bash
cd mcp-server
npm install
AGENTBANK_BASE_URL=http://localhost:3000 AGENTBANK_TOKEN="Bearer eyJhbGci..." node index.js
```

### Connect Claude Desktop

Add this to `~/.claude/claude_desktop_config.json` and restart Claude Desktop:

```json
{
  "mcpServers": {
    "agentbank": {
      "command": "node",
      "args": ["/absolute/path/to/agentbank/mcp-server/index.js"],
      "env": {
        "AGENTBANK_BASE_URL": "https://your-agentbank-instance.example.com",
        "AGENTBANK_TOKEN": "Bearer eyJhbGci..."
      }
    }
  }
}
```

Once connected, Claude Desktop can call agentBANK tools directly:

> *"What is the balance on account ACC-1829?"*  
> *"Run an AML screen on transaction TXN-48291."*  
> *"Apply for a £10,000 home improvement loan over 36 months."*

### How it works

The server uses `@modelcontextprotocol/sdk` with stdio transport. Each of the 14 agentBANK tool functions is registered as a typed MCP tool with full Zod input schema validation:

```javascript
server.tool(
  "get_balance",
  "Retrieve the real-time available balance for a specific account.",
  { account_id: z.string().describe("The account identifier, e.g. ACC-1829") },
  async ({ account_id }) => {
    const data = await apiCall("GET", `/bian/current-account/${account_id}/balance`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);
```

### MCP tools exposed

```
get_accounts          get_balance           get_transactions
initiate_payment      get_payment_status    get_party
get_loan_details      apply_for_loan        get_card_details
block_card            get_portfolio         place_order
run_aml_screen        subscribe_events
```

---

## Backend — runnable reference

The `backend/` directory is the runnable counterpart to the OpenAPI spec — Fastify 4 + Prisma 5 + Postgres 16, written in strict TypeScript, serving `openapi.yaml` (rendered at `/docs` via Scalar) plus the BIAN endpoints. Same HTTP surface the SDK and MCP server target, so you can point either of them at `http://localhost:3000` and exercise the real wire format end-to-end.

### Quick start

```bash
docker compose up --build              # backend + Postgres in one go
# or, against a Postgres you're already running:
cd backend && cp .env.example .env
npm install && npm run db:generate
npx prisma db push --accept-data-loss --skip-generate
npm run db:seed
npm run dev                            # http://localhost:3000
```

Key surfaces:

- `GET /health` — liveness + Postgres reachability
- `GET /openapi.json` — the canonical OpenAPI v3.1.11 spec
- `GET /docs` — Scalar API reference UI
- `GET /open-banking/v3.1/...` — Open Banking endpoints
- `GET /bian/...` — BIAN service-domain endpoints

### Implementation status

The schema covers all 10 BIAN domains and the seed script populates 3 personas × 2 accounts × 90 days of transactions. Endpoint coverage is being filled in tier by tier — see `backend/README.md` for the live tracker. As of this writing:

| Domain | Endpoints live | Notes |
|---|---|---|
| Party | 4 / 4 | complete |
| Accounts | 3 / 5 | list, detail, balance — initiate/update pending |
| Payments | 6 / 6 | idempotent, double-entry ledger posting |
| Transactions | 4 / 4 | cursor-paginated |
| Lending, Cards, Savings, Investments, Compliance, Notifications | 0 / 21 | scheduled in Plan A tier 2 |

CI (`.github/workflows/ci.yml`) typechecks and builds the frontend, runs the backend smoke test against a Postgres service container, and lints the MCP server on every push.

---

## Executive visuals

`agentbank-executive-visuals.html` is a **standalone, dependency-free** HTML deck for non-technical audiences — open it directly in any browser, no build step, no server. Five tabbed exhibits frame the agent-native commerce thesis at the level a board, regulator, or design-partner exec needs:

| # | Exhibit | What it shows |
|---|---------|---------------|
| 1 | The stack | The four-layer agent → rails → trust fabric model that sits under every domain. |
| 2 | Features → primitives | How customer-visible features collapse into reusable agent primitives. |
| 3 | User experience | What an agent-mediated interaction looks and feels like. |
| 4 | The lifestyle agent | Where this lands when finance, commerce, travel, and health share one agent. |
| 5 | Blended outcomes | The cross-domain outcomes that only become possible when channels share a fabric. |

```bash
open agentbank-executive-visuals.html      # macOS
xdg-open agentbank-executive-visuals.html  # Linux
```

It's intentionally divorced from the React app: nothing to install, easy to email or drop into a deck, and styled for a calmer, print-friendly aesthetic than the developer-facing showcase.

---

## Architecture

The diagram below is the **target architecture**. The `backend/` reference today implements the channels (AI Agent API, MCP server), the OpenAPI v3.1.11 surface, the BIAN service-domain layer for four of ten domains, and a double-entry ledger; the gateway, event bus, and risk/MDM layers are stubbed or pending — see Roadmap.

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
│  OPEN BANKING LAYER  (v3.1)                            │
│  [ Accounts ]  [ Payments ]  [ CoF ]  [ Events ]       │
├─────────────────────────────────────────────────────────┤
│  BIAN SERVICE DOMAINS  (v12)                           │
│  [ CurrentAccount ]  [ PaymentExecution ]              │
│  [ ConsumerLoan ]    [ InvestmentPortfolio ]  [ +6 ]   │
├─────────────────────────────────────────────────────────┤
│  CORE BANKING                                           │
│  [ Ledger Engine ]  [ Product Engine ]                 │
│  [ Customer MDM ]   [ Risk Engine ]                    │
├─────────────────────────────────────────────────────────┤
│  INFRASTRUCTURE                                         │
│  [ Event Bus ]  [ Key Management ]  [ Data Warehouse ] │
└─────────────────────────────────────────────────────────┘
```

---

## Service Domains

| # | Domain | BIAN Service Domain | Endpoints | Agent Tools | Backend status |
|---|--------|-------------------|-----------|-------------|----------------|
| 1 | Party Reference Data | SD-PartyReferenceDataManagement | 4 | 4 | live |
| 2 | Current Account | SD-CurrentAccount | 5 | 4 | partial (3/5) |
| 3 | Payment Execution | SD-PaymentExecution | 6 | 5 | live |
| 4 | Transaction Engine | SD-AccountingTransactions | 4 | 5 | live |
| 5 | Consumer Lending | SD-ConsumerLoan | 5 | 5 | pending |
| 6 | Credit and Debit Cards | SD-CreditCard | 5 | 5 | pending |
| 7 | Savings and Deposits | SD-SavingsAccount | 4 | 5 | pending |
| 8 | Investment Portfolio | SD-InvestmentPortfolioManagement | 4 | 5 | pending |
| 9 | Regulatory Compliance | SD-RegulatoryReporting | 4 | 4 | pending |
| 10 | Customer Notifications | SD-CustomerEventHistory | 3 | 4 | pending |

**Target: 44 endpoints · 14 agent tool functions** — frontend mock and MCP tool registry expose all 14; backend currently implements 17 of 44 endpoints across 4 of 10 domains. Each domain is designed to be accessible via both its Open Banking v3.1 endpoint and its BIAN service-domain interface.

---

## Agent Tool Registry

All 14 tools are typed, consent-scoped, and callable by AI agents via:

- **Anthropic tool use** (Claude)
- **OpenAI function calling**
- **MCP stdio** (Claude Desktop, Cursor, or any MCP client) — via `mcp-server/`

### Example: Invoking a tool with the Anthropic SDK

```javascript
const response = await client.messages.create({
  model: "claude-sonnet-4-6",
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
          reference:        { type: "string" }
        },
        required: ["debtor_account", "creditor_account", "amount", "currency"]
      }
    }
  ],
  messages: [{ role: "user", content: "Pay £120 from my current account to my savings account." }]
});
```

---

## Example Use Case — Smart Savings Agent

A complete six-step agentic loop that analyses spending, calculates a safe transfer, executes the payment, and automates the process monthly:

```
Step 1  get_party            →  Authenticate and verify customer identity
Step 2  get_transactions     →  Fetch 90 days of transactions, categorise spend
Step 3  get_balance (savings)→  Check savings balance and goal progress
Step 4  get_balance (current)→  Confirm available funds, calculate safe transfer
Step 5  initiate_payment     →  Sweep surplus to savings account
Step 6  subscribe_events     →  Subscribe to salary credits for monthly automation
```

The agent touches five BIAN service domains in a single loop. The full interaction is captured in the observability layer — reasoning trace, span waterfall, and token usage metrics.

---

## Agent Builds

The **Agent Builds** tab provides five ready-to-adapt code snippets for common banking agent patterns. Each recipe wires together agentBANK tool functions into a complete, runnable agent using the `AgentBankAgent` class.

| Build | Domains | Description |
|-------|---------|-------------|
| **Loan Pre-qualification** | lending, accounts, transactions | Analyses income and obligations to pre-qualify without a hard credit check |
| **Fraud Sentinel** | transactions, compliance, cards | Webhook-triggered AML screening with autonomous card block on threshold breach |
| **Portfolio Rebalancer** | investments | Detects allocation drift and places buy/sell orders to rebalance |
| **Wealth Summary** | accounts, savings, investments, transactions | Parallel balance aggregation with LLM-generated financial health insights |
| **Bill Pay Automator** | transactions, payments, accounts | Detects recurring bills and schedules forward payments with a configurable buffer |

### Claude Code Skill

A project-level Claude Code skill is included at `.claude/skills/agentbank-build/`. Once Claude Code is running in this project, you can add new agent build recipes directly from the terminal:

```bash
/agentbank-build KYC onboarding agent
/agentbank-build FX payment with sanctions check
/agentbank-build spending insights with nudge to save
```

The skill knows the `AGENT_BUILDS` data shape, all 14 available tools, and the code style conventions — it reads existing entries, picks a non-duplicate id and colour, and inserts the new snippet directly into `App.jsx`.

---

## Observability

The frontend mock ships an observability dashboard (`src/Observability.jsx`) that demonstrates the three dimensions required for production agent deployments. It runs against simulated session data — wiring it to live OpenTelemetry / pino output from the backend is on the roadmap.

### LLM Metrics
Real-time monitoring of agent session latency, token consumption (input and output separately), tool call frequency per session, error rates, and model utilisation. Displayed as live-updating time-series charts with a 2.4-second refresh cycle.

### Agent Trace Log
Structured, timestamped replay of every agent reasoning step within a session. Each trace line captures step type, elapsed time, and the full content of tool call parameters and results. Colour-coded by step type:

| Colour | Step Type |
|--------|-----------|
| Blue | Authentication |
| Amber | Tool call |
| Green | Tool result / Completion |
| Grey | System / Reasoning |

### OpenTelemetry Spans
Distributed trace waterfall showing the full call hierarchy: **agent session → BIAN service domain → core banking**. Spans are annotated with FAPI interaction IDs, HTTP status codes, service names, and durations.

---

## Security Model

| Mechanism | Purpose | Backend status |
|-----------|---------|----------------|
| FAPI 2.0 | Security profile for all agent authentication flows | partial — `x-fapi-interaction-id` propagation in `lib/fapi.ts`; full PAR/DPoP pending |
| PAR (Pushed Authorisation Requests) | Consent initiation — prevents token interception | pending |
| DPoP (Demonstration of Proof of Possession) | Binds tokens to the requesting agent instance | pending |
| Consent scopes | Fine-grained per-domain permissions (`accounts:read`, `payments:write`, etc.) | pending |
| Step-up authentication | Required for high-value operations above configurable thresholds | pending |
| Immutable audit log | Every agent action logged with full parameter capture for regulatory audit | schema in place; hash-chain protocol drafted in ADR-0002 |

---

## API Standards Compliance

| Standard | Version | Coverage |
|----------|---------|----------|
| Open Banking (OBIE) | v3.1.11 | Accounts, Payments, Party, CoF, Event Notifications |
| BIAN Service Domain Model | v12 | 10 Service Domains |
| Model Context Protocol (MCP) | 1.0 | All 14 agent tools via `mcp-server/` |
| Financial-grade API (FAPI) | 2.0 | Agent authentication security profile |
| ISO 20022 | 2019 | Payment message format |
| OAuth 2.0 | RFC 6749 | Authorisation framework |
| OpenID Connect | 1.0 | Identity layer |

---

## Getting Started

### Prerequisites

- **Node.js 20+** — [nodejs.org](https://nodejs.org) (required by the backend; the frontend works on 18+)
- **npm 9+** — included with Node.js
- **Docker** (optional) — for the one-command backend + Postgres spin-up

```bash
git clone https://github.com/watsongm/agentbank.git
cd agentbank
```

### 1 · Frontend mock

```bash
npm install
npm run dev                # http://localhost:5173
npm run build && npm run preview   # production build
```

This is the React showcase — agent UX, API console, observability dashboard — backed by an in-memory mock. No backend required.

### 2 · Runnable backend

```bash
docker compose up --build  # backend + Postgres in one command
```

Or against a Postgres you're already running:

```bash
cd backend
cp .env.example .env       # set DATABASE_URL
npm install
npm run db:generate
npx prisma db push --accept-data-loss --skip-generate
npm run db:seed
npm run dev                # http://localhost:3000
```

Then visit `http://localhost:3000/docs` for the live API reference, or `curl http://localhost:3000/health` to confirm DB connectivity.

### 3 · Executive visuals

No build step — just open the file:

```bash
open agentbank-executive-visuals.html      # macOS
xdg-open agentbank-executive-visuals.html  # Linux
```

### 4 · MCP server

```bash
cd mcp-server
npm install
AGENTBANK_BASE_URL=http://localhost:3000 \
AGENTBANK_TOKEN="Bearer eyJhbGci..." \
  node index.js
```

Point `AGENTBANK_BASE_URL` at the local backend (above) or any deployed agentBANK instance.

### Deploying the frontend mock

**Netlify:** `npm run build` then drag `dist/` to <https://app.netlify.com/drop>.
**Vercel:** `npx vercel --prod`.

---

## Project Structure

```
agentbank/
├── .claude/skills/agentbank-build/   # /agentbank-build Claude Code skill
├── .github/workflows/ci.yml          # frontend build + backend smoke + mcp lint
├── backend/                          # Runnable reference — Fastify + Prisma + Postgres
│   ├── prisma/
│   │   ├── schema.prisma             # 10 BIAN domains + audit log
│   │   └── seed.ts                   # 3 personas × 2 accounts × 90 days of txns
│   ├── src/
│   │   ├── server.ts                 # Fastify entrypoint
│   │   ├── lib/                      # db, errors, fapi, openapi
│   │   └── domains/{party,accounts,transactions,payments}/
│   ├── test/smoke.test.ts            # vitest smoke suite (CI gate)
│   ├── Dockerfile
│   └── package.json
├── docs/adr/                         # Architecture decision records
│   └── 0001-backend-stack.md
├── mcp-server/                       # MCP stdio server — 14 typed tools
│   ├── index.js
│   └── package.json
├── sdk/                              # JS client over the OpenAPI surface
├── src/                              # Frontend mock (React + Vite)
│   ├── main.jsx
│   ├── App.jsx                       # Tabbed showcase, API console, agent flows
│   ├── Observability.jsx             # LLM metrics + trace + OTel waterfall
│   ├── components/
│   ├── data/
│   └── mock/                         # In-memory API + canned sessions
├── public/favicon.svg
├── agentbank-executive-visuals.html  # Standalone exec deck (no build)
├── docker-compose.yml                # backend + Postgres
├── openapi.yaml                      # Canonical spec (served by backend)
├── index.html, vite.config.js, package.json   # Frontend mock root
├── backlog.md, README.md
```

---

## Technology Stack

**Frontend mock** (`src/`)

| Layer | Technology | Notes |
|-------|-----------|-------|
| UI Framework | React 18 | Hooks-based, no class components |
| Build Tool | Vite 5 | Fast HMR, ESM-native |
| Charts | Recharts 2.x | Used in Observability dashboard |
| Styling | Plain CSS | CSS variables, no framework |
| Fonts | Google Fonts | IBM Plex Sans, Fira Code, Syne |
| API | In-memory mock | `src/mock/api.js` — swap for real `fetch()` against the backend |

**Backend** (`backend/`)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Runtime | Node.js 20 LTS | strict TypeScript, NodeNext modules |
| HTTP | Fastify 4 | `@fastify/helmet`, `cors`, `sensible` |
| Validation | Zod | shared schemas with SDK and MCP server |
| ORM | Prisma 5 | typed client, `db push` in dev |
| Database | Postgres 16 | container in `docker-compose.yml` |
| Spec serving | `@scalar/fastify-api-reference` | renders `openapi.yaml` at `/docs` |
| Logging | pino | JSON by default; pretty-print via `LOG_PRETTY=1` |
| Tests | vitest | smoke suite gates CI |

**MCP server** (`mcp-server/`)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Protocol | `@modelcontextprotocol/sdk` | stdio transport |
| Validation | Zod | tool input schemas |

**Executive visuals** (`agentbank-executive-visuals.html`)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Everything | Plain HTML + CSS | no build, no JS framework — open in any browser |

The frontend mock and executive visuals run with no backend. The MCP server and SDK make real HTTP calls — point them at the local backend (`http://localhost:3000`) or a deployed agentBANK instance.

---

## Background — The Case for Agent-First Banking

Summarised from the agentBANK White Paper, April 2026.

### The Structural Shift

The financial services industry is undergoing a fundamental change. AI agents — autonomous software systems capable of reasoning, planning, and executing multi-step tasks — are creating a new class of banking customer that sits between the human account holder and the traditional API consumer.

These agents do not just query data. They initiate payments, apply for credit, monitor portfolios, and respond to market events in real time, all on behalf of customers who have granted explicit consent. A single well-designed agent can serve tens of thousands of customers through a single API integration, scaling the bank's reach without proportional growth in customer acquisition cost.

### The Business Model

agentBANK is designed around a **developer-first, agent-builder revenue model**. The primary commercial relationship is with developers and organisations building AI-powered financial applications — not with retail account holders.

| Revenue Stream | Customer | Mechanism |
| --- | --- | --- |
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

- [x] Tab-based frontend layout — six focused sections replacing single-page scroll
- [x] MCP Server — all 14 tools via `@modelcontextprotocol/sdk` stdio transport
- [x] Executive visuals — five-exhibit standalone HTML deck
- [x] Runnable backend scaffold — Fastify + Prisma + Postgres, OpenAPI served at `/docs`
- [x] Backend tier 1 domains — Party, Accounts (partial), Payments, Transactions
- [x] CI — frontend build, backend smoke test against Postgres, MCP lint
- [ ] Backend tier 2 domains — Lending, Cards, Savings, Investments, Compliance, Notifications
- [ ] FAPI 2.0 — PAR + DPoP, consent scopes, step-up auth
- [ ] Audit log hash-chain (ADR-0002 — drafting)
- [ ] WebSocket support for real-time event streaming
- [ ] Wire frontend observability dashboard to live OpenTelemetry from the backend
- [ ] Additional BIAN domains (Trade Finance, Correspondent Banking)
- [ ] Customer explainability log UI
- [ ] Consent management flow

---

## Disclaimer

agentBANK is a **reference implementation** for educational and architectural purposes. It is not a regulated bank, does not hold real funds, and should not be used in production without appropriate regulatory authorisation, security audit, and compliance sign-off.

---
