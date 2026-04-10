# agentBANK

<p align="center">
  <img src="https://img.shields.io/badge/Open%20Banking-v3.1-C9A84C?style=for-the-badge" alt="Open Banking v3.1"/>
  <img src="https://img.shields.io/badge/BIAN-v12-0d0f14?style=for-the-badge" alt="BIAN v12"/>
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

agentBANK combines two proven open standards — the **UK Open Banking API v3.1** and the **BIAN Service Domain Model v12** — with a native agent interface layer providing structured tool functions, FAPI-grade authentication, consent-scoped operations, real-time webhook subscriptions, and a full observability stack.

---

## Live Demo

> Open the app in your browser and explore the interactive API console, service domain explorer, agent use case walkthrough, and live observability dashboard.

---

## Screenshots

### Landing Page — AI Agent Channel
The hero section and animated agent terminal replaying a live session from authentication through payment completion.

### Service Domain Explorer
Ten BIAN service domains, each with full endpoint listings and agent capability modals.

### API Console
Full interactive API explorer — browse domains, select endpoints, edit request headers and body, fire requests, and inspect realistic JSON responses.

### Observability Dashboard
Three-tab dashboard: LLM metrics (real-time charts), agent trace log (animated reasoning replay), and OpenTelemetry span waterfall.

---

## Background — The Case for Agent-First Banking

*Summarised from the agentBANK White Paper, April 2026*

### The Structural Shift

The financial services industry is undergoing a fundamental change. AI agents — autonomous software systems capable of reasoning, planning, and executing multi-step tasks — are creating a new class of banking customer that sits between the human account holder and the traditional API consumer.

These agents do not just query data. They initiate payments, apply for credit, monitor portfolios, and respond to market events in real time, all on behalf of customers who have granted explicit consent. A single well-designed agent can serve tens of thousands of customers through a single API integration, scaling the bank's reach without proportional growth in customer acquisition cost.

### The Business Model

agentBANK is designed around a **developer-first, agent-builder revenue model**. The primary commercial relationship is with developers and organisations building AI-powered financial applications — not with retail account holders.

| Revenue Stream | Customer | Mechanism |
|---------------|----------|-----------|
| **API Access Tiers** | Agent builders | Starter / Growth / Enterprise monthly subscription |
| **Per-Call Metering** | Agent builders | Billed per 1,000 API calls above tier limit |
| **Premium Tool Access** | Regulated builders | AML screening, credit scoring, FX locking add-ons |
| **Marketplace Listing** | ISVs | Revenue share on agent template sales |
| **Compliance-as-a-Service** | Regulated builders | Managed regulatory reporting bundle |
| **White-Label Platform** | Financial institutions | Full platform licence and co-branding |
| Account Fees *(secondary)* | Account holders | Optional premium account tier |
| Payment Rails Margin *(secondary)* | Account holders | FX spread and faster payment surcharge |

Account holder revenue is deliberately secondary. The account base serves primarily as a live environment for agent builders to develop and test against real banking data.

### The Strategic Rationale

A single Growth tier agent builder whose application manages savings for 50,000 customers generates substantially more revenue per relationship than 50,000 individual retail account holders — at a fraction of the acquisition and servicing cost. The unit economics of developer-first banking invert the traditional retail model in agentBANK's favour.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  CHANNELS                                               │
│  [ AI Agent API ★ ]  [ Mobile ]  [ Web ]  [ Partner ]  │
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

Each domain is accessible via both its Open Banking v3.1 endpoint and its BIAN service domain interface, providing dual-standard interoperability.

---

## Agent Tool Registry

All 14 tools are typed, consent-scoped, and callable by AI agents via structured tool-use (Anthropic Claude, OpenAI function calling, or any compatible LLM framework).

```
get_accounts          get_balance           get_transactions
initiate_payment      get_payment_status    get_party
get_loan_details      apply_for_loan        get_card_details
block_card            get_portfolio         place_order
run_aml_screen        subscribe_events
```

### Example: Invoking a tool with the Anthropic SDK

```javascript
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

## Observability

The built-in observability dashboard (`Observability.jsx`) covers three dimensions required for production agent deployments:

### LLM Metrics
Real-time monitoring of agent session latency, token consumption (input and output separately), tool call frequency per session, error rates, and model utilisation. Displayed as live-updating time-series charts with a 2.4-second refresh cycle.

### Agent Trace Log
Structured, timestamped replay of every agent reasoning step within a session. Each trace line captures step type, elapsed time, and the full content of tool call parameters and results. Colour-coded by step type:

| Colour | Step Type |
|--------|-----------|
| 🔵 Blue | Authentication |
| 🟡 Amber | Tool call |
| 🟢 Green | Tool result / Completion |
| Grey | System / Reasoning |

### OpenTelemetry Spans
Distributed trace waterfall showing the full call hierarchy: **agent session → BIAN service domain → core banking**. Spans are annotated with FAPI interaction IDs, HTTP status codes, service names, and durations. Enables latency bottleneck identification and service dependency mapping.

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
| Financial-grade API (FAPI) | 2.0 | Agent authentication security profile |
| ISO 20022 | 2019 | Payment message format |
| OAuth 2.0 | RFC 6749 | Authorisation framework |
| OpenID Connect | 1.0 | Identity layer |

---

## Getting Started

### Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **npm 9+** — included with Node.js

### Install and Run

```bash
# 1. Clone or download and unzip the project
git clone https://github.com/watsongm/agentbank.git
cd agentbank

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) — you should see the agentBANK landing page.

### Build for Production

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
├── public/
│   └── favicon.svg
├── src/
│   ├── main.jsx              # React entry point
│   ├── App.jsx               # Main app — landing page, API console, use case
│   └── Observability.jsx     # Observability dashboard (standalone)
├── .env.example              # Environment variable template
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
| API | In-memory mock | Replace with real fetch calls for production |

No backend required. The API console and observability dashboard use in-memory mock responses and simulated data. To connect to a real API gateway, replace the `mockApi()` function in `App.jsx` with actual `fetch()` calls.

---

## Roadmap

- [ ] WebSocket support for real-time event streaming  
- [ ] Additional BIAN domains (Trade Finance, Correspondent Banking)  
- [ ] Customer explainability log UI  
- [ ] Consent management flow  

---

## Disclaimer

agentBANK is a **reference implementation** for educational and architectural purposes. It is not a regulated bank, does not hold real funds, and should not be used in production without appropriate regulatory authorisation, security audit, and compliance sign-off.

---

