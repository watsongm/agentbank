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

## Live Demo

> Open the app in your browser and explore all six tabs: AI Channel, Use Case, Services & APIs, Agent Builds, Architecture, and MCP Server.

---

## App Layout

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

## Architecture

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

| # | Domain | BIAN Service Domain | Endpoints | Agent Tools |
|---|--------|-------------------|-----------|-------------|
| 1 | Party Reference Data | SD-PartyReferenceDataManagement | 4 | 4 |
| 2 | Current Account | SD-CurrentAccount | 5 | 4 |
| 3 | Payment Execution | SD-PaymentExecution | 6 | 5 |
| 4 | Transaction Engine | SD-AccountingTransactions | 4 | 5 |
| 5 | Consumer Lending | SD-ConsumerLoan | 5 | 5 |
| 6 | Credit and Debit Cards | SD-CreditCard | 5 | 5 |
| 7 | Savings and Deposits | SD-SavingsAccount | 4 | 5 |
| 8 | Investment Portfolio | SD-InvestmentPortfolioManagement | 4 | 5 |
| 9 | Regulatory Compliance | SD-RegulatoryReporting | 4 | 4 |
| 10 | Customer Notifications | SD-CustomerEventHistory | 3 | 4 |

**Total: 44 endpoints · 14 agent tool functions**

Each domain is accessible via both its Open Banking v3.1 endpoint and its BIAN service domain interface, and is exposed as a typed MCP tool via the reference MCP server.

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

The built-in observability dashboard covers three dimensions required for production agent deployments:

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

| Mechanism | Purpose |
|-----------|---------|
| FAPI 2.0 | Security profile for all agent authentication flows |
| PAR (Pushed Authorisation Requests) | Consent initiation — prevents token interception |
| DPoP (Demonstration of Proof of Possession) | Binds tokens to the requesting agent instance |
| Consent scopes | Fine-grained per-domain permissions (`accounts:read`, `payments:write`, etc.) |
| Step-up authentication | Required for high-value operations above configurable thresholds |
| Immutable audit log | Every agent action logged with full parameter capture for regulatory audit |

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

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **npm 9+** — included with Node.js

### Run the app

```bash
# 1. Clone the repository
git clone https://github.com/watsongm/agentbank.git
cd agentbank

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) — you should see the agentBANK landing page.

### Run the MCP server

```bash
cd mcp-server
npm install

# Point at your agentBANK API instance
AGENTBANK_BASE_URL=http://localhost:3000 \
AGENTBANK_TOKEN="Bearer eyJhbGci..." \
node index.js
```

### Build the app for production

```bash
npm run build      # outputs to dist/
npm run preview    # preview the production build locally
```

### Deploy

**Netlify (drag and drop):**
```bash
npm run build
# Drag the dist/ folder to https://app.netlify.com/drop
```

**Vercel:**
```bash
npx vercel --prod
```

---

## Project Structure

```
agentbank/
├── .claude/
│   └── skills/
│       └── agentbank-build/
│           └── SKILL.md          # /agentbank-build Claude Code skill
├── mcp-server/                   # Standalone MCP server (separate deployable)
│   ├── index.js                  # All 14 agentBANK tools as MCP tools (stdio transport)
│   └── package.json              # @modelcontextprotocol/sdk + zod
├── public/
│   └── favicon.svg
├── src/
│   ├── main.jsx                  # React entry point
│   └── App.jsx                   # Full app — tab layout, all sections, overlays
├── .gitignore
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

---

## Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| UI Framework | React 18 | Hooks-based, no class components |
| Build Tool | Vite 5 | Fast HMR, ESM-native |
| Charts | Recharts 2.x | Used in Observability dashboard |
| Styling | Plain CSS | CSS variables, no framework |
| Fonts | Google Fonts | IBM Plex Sans, Fira Code, Syne |
| MCP Server | @modelcontextprotocol/sdk | Stdio transport, Zod schema validation |
| API | In-memory mock | Replace `mockApi()` in `App.jsx` with real `fetch()` for production |

No backend required for the frontend app. The API console and observability dashboard use in-memory mock responses. The MCP server makes real HTTP calls — point `AGENTBANK_BASE_URL` at a live agentBANK API instance.

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

- [x] Tab-based layout — six focused sections replacing single-page scroll
- [x] MCP Server — all 14 tools via `@modelcontextprotocol/sdk` stdio transport
- [ ] WebSocket support for real-time event streaming
- [ ] Additional BIAN domains (Trade Finance, Correspondent Banking)
- [ ] Customer explainability log UI
- [ ] Consent management flow

---

## Disclaimer

agentBANK is a **reference implementation** for educational and architectural purposes. It is not a regulated bank, does not hold real funds, and should not be used in production without appropriate regulatory authorisation, security audit, and compliance sign-off.

---
