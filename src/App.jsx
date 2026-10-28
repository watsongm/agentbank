import { useState, useEffect, useRef } from "react";

import { DOMAINS } from "./data/domains.js";
import { TOOLS } from "./data/tools.js";
import { AGENT_BUILDS } from "./data/agentBuilds.js";
import { AGENT_STEPS } from "./data/agentSteps.js";
import { CONVERSATION } from "./data/conversation.js";
import { apiConsoleRequest, resolveEndpointPath, defaultBody, getApiMode, setApiMode } from "./api/index.js";
import { useAuth } from "./context/AuthContext.jsx";
import { OBS_MODELS, rnd, makeSession, makeHistory, makeHex } from "./mock/sessions.js";
import ObservabilityOverlay from "./Observability.jsx";
import McpTab from "./components/McpTab.jsx";
import SdkTab from "./components/SdkTab.jsx";

/* ══════════════════════════════════════════════════════════════════════════
   ARCHITECTURAL REFERENCE DATA FOR PROGRESSIVE DISCLOSURE
══════════════════════════════════════════════════════════════════════════ */
const HERO_LAYERS = [
  {
    code: "L1",
    name: "AI Agent Runtime",
    tag: "Claude · Custom SDK · Cursor",
    summary: "Translates natural language customer goals into deterministic multi-step execution plans.",
    detail: "Holds customer context (PAR-ARIA), enforces safety buffers (£500 min balance), and orchestrates tool calls across 10 BIAN domains.",
    ctaLabel: "Inspect AI Channel →",
    targetTab: "channel",
  },
  {
    code: "L2",
    name: "MCP 1.0 & SDK Primitives",
    tag: "14 Typed Tools · Zod Schemas",
    summary: "Exposes banking capabilities as schema-validated functions over stdio JSON-RPC 2.0 and REST.",
    detail: "Every tool maps 1-to-1 to a BIAN v12 operation with automatic UUIDv4 x-fapi-interaction-id generation and 5xx retry resilience.",
    ctaLabel: "Explore MCP Server →",
    targetTab: "mcp",
  },
  {
    code: "L3",
    name: "FAPI 2.0 & Cryptographic Trust",
    tag: "OAuth 2.0 · RFC 9449 DPoP · SHA-256",
    summary: "Verifies scoped consent tokens, prevents DPoP proof replay, and chains every call in a SHA-256 ledger.",
    detail: "Per-customer rate limiting on payment initiation, sender-constrained jti replay checks, and real-time OpenTelemetry span waterfalls.",
    ctaLabel: "Open Live Observability →",
    targetAction: "obs",
  },
  {
    code: "L4",
    name: "10 BIAN v12 Service Domains",
    tag: "44 OpenAPI 3.1 Endpoints",
    summary: "Full core banking capability model covering Party, Accounts, Payments, Lending, Cards, Savings, Wealth, AML, and Events.",
    detail: "Backed by Fastify, Prisma ORM, and PostgreSQL with dual Open Banking v3.1 (UK OBIE) and BIAN v12 resource representations.",
    ctaLabel: "Browse 10 BIAN Domains →",
    targetTab: "services",
  },
];

const CHANNEL_PILLARS = [
  {
    code: "01",
    std: "FAPI 2.0 · RFC 6749",
    h: "OAuth 2.0 + FAPI Agent Authentication",
    p: "Agents authenticate via Financial-grade API profiles. Consent tokens are scoped (e.g. accounts:read payments:write), time-limited, and bound to customer identity (PAR-ARIA).",
    spec: "POST /open-banking/v3.1/oauth/token → Base64/JWT Consent Payload + DPoP Proof Verification",
  },
  {
    code: "02",
    std: "MCP 1.0 · Zod",
    h: "Structured 14-Tool Capability Registry",
    p: "14 agent-callable tool functions map directly to BIAN v12 service domain operations. Each primitive is strictly typed, documented, and validated before execution.",
    spec: "get_party · get_accounts · get_balance · get_transactions · initiate_payment · apply_for_loan · +8 more",
  },
  {
    code: "03",
    std: "ADR-0002 · SHA-256",
    h: "Tamper-Evident Reasoning & Audit Chain",
    p: "Every agent action generates a full cryptographic audit trail linking tool calls, parameters hash, status code, and previous row hash in an immutable ledger.",
    spec: "rowHash = sha256(timestamp + customerId + tool + prevHash + paramsHash + statusCode)",
  },
  {
    code: "04",
    std: "OBIE v3.1 · Scopes",
    h: "Granular Consent-Scoped Operations",
    p: "Agents operate strictly within granted scopes. Attempting a payment or loan origination with a read-only token immediately returns 403 Forbidden.",
    spec: "15 granular ConsentScope enums enforced via Fastify preHandler middleware",
  },
  {
    code: "05",
    std: "SD-EventHistory",
    h: "Proactive Webhook Event Subscriptions",
    p: "Agents subscribe to real-time account events (salary credits, balance thresholds, card activity) via webhooks for autonomous financial management.",
    spec: "POST /bian/customer-event-history/webhook → Active event stream for PAR-ARIA",
  },
];

const ARCH_STACK_LAYERS = [
  {
    code: "L1",
    l: "AI CLIENTS",
    std: "Host Applications",
    summary: "Conversational & autonomous hosts that delegate financial tasks on behalf of the customer.",
    chips: [{ t: "Claude Desktop", c: "hi" }, { t: "Custom Agent (@agentbank/sdk)", c: "hi" }, { t: "Cursor / IDE Host", c: "hi" }, { t: "Web / Mobile Assistant", c: "" }],
    specs: [
      ["Primary Interface", "Natural Language Intent"],
      ["Session Context", "Customer Persona (PAR-ARIA)"],
      ["Auth Delegation", "Bearer / Scoped Consent Token"],
    ],
  },
  {
    code: "L2",
    l: "MCP LAYER",
    std: "MCP 1.0 (stdio / JSON-RPC)",
    summary: "Model Context Protocol server translating LLM tool_use requests into validated banking calls.",
    chips: [{ t: "MCP Server (stdio)", c: "hi" }, { t: "14 Typed Tools", c: "hi" }, { t: "Zod Schema Validation", c: "blue" }, { t: "Idempotent Retry Engine", c: "" }],
    specs: [
      ["Package", "mcp-server/index.js"],
      ["Validation", "Zod inputSchema per primitive"],
      ["Resilience", "Exponential backoff on 5xx/429"],
    ],
  },
  {
    code: "L3",
    l: "API GATEWAY",
    std: "FAPI 2.0 + RFC 9449 DPoP",
    summary: "Security, rate-limiting, and cryptographic audit pipeline inspecting every incoming request.",
    chips: [{ t: "OAuth 2.0 / FAPI 2.0", c: "green" }, { t: "DPoP Replay Guard (jti)", c: "green" }, { t: "Per-Customer Rate Limit", c: "" }, { t: "SHA-256 Audit Ring", c: "green" }],
    specs: [
      ["Auth Middleware", "backend/src/lib/auth.ts + consent.ts"],
      ["Replay Protection", "In-memory TTL jti cache (dpop.ts)"],
      ["Audit Endpoint", "GET /observability/audit-verify"],
    ],
  },
  {
    code: "L4",
    l: "OPEN BANKING",
    std: "UK OBIE v3.1.11",
    summary: "Standardized Account Information (AISP) and Payment Initiation (PISP) REST resource endpoints.",
    chips: [{ t: "Accounts v3.1", c: "blue" }, { t: "Domestic Payments v3.1", c: "blue" }, { t: "Statements & Balances", c: "blue" }, { t: "UK.OBIE Error Envelopes", c: "" }],
    specs: [
      ["Base Prefix", "/open-banking/v3.1/*"],
      ["Payload Convention", "PascalCase Data / Initiation / Links"],
      ["Interaction Header", "x-fapi-interaction-id echoed on all calls"],
    ],
  },
  {
    code: "L5",
    l: "BIAN DOMAINS",
    std: "BIAN Service Landscape v12",
    summary: "10 canonical Service Domains providing full retail, lending, wealth, and compliance capabilities.",
    chips: [{ t: "SD-CurrentAccount", c: "purple" }, { t: "SD-PaymentExecution", c: "purple" }, { t: "SD-ConsumerLoan", c: "purple" }, { t: "SD-InvestmentPortfolio", c: "purple" }, { t: "+6 BIAN Domains", c: "" }],
    specs: [
      ["Base Prefix", "/bian/<service-domain>/*"],
      ["Action Terms", "initiate · retrieve · update · request · evaluate"],
      ["Total Endpoints", "44 OpenAPI 3.1 Operations"],
    ],
  },
  {
    code: "L6",
    l: "CORE BANKING",
    std: "Transactional Domain Services",
    summary: "Double-entry ledger, amortization calculator, fractional order matcher, and deterministic AML engine.",
    chips: [{ t: "Ledger & Balance Engine", c: "" }, { t: "Loan Amortization Engine", c: "" }, { t: "Portfolio Order Matcher", c: "" }, { t: "AML Risk Evaluator", c: "" }],
    specs: [
      ["Implementation", "backend/src/domains/*/service.ts"],
      ["Atomicity", "Prisma interactive $transaction blocks"],
      ["Seeded Personas", "PAR-ARIA · PAR-MAHLI · PAR-DEVON"],
    ],
  },
  {
    code: "L7",
    l: "INFRA & DATA",
    std: "PostgreSQL 16 + OpenTelemetry",
    summary: "Cloud-native persistence and observability stack with Prometheus metrics and Jaeger tracing.",
    chips: [{ t: "PostgreSQL 16 (Prisma)", c: "" }, { t: "Prometheus /metrics", c: "blue" }, { t: "OpenTelemetry Collector", c: "blue" }, { t: "Docker Compose Profiles", c: "" }],
    specs: [
      ["Database Schema", "backend/prisma/schema.prisma"],
      ["Metrics Route", "GET /metrics (prom-client)"],
      ["Session Stream", "GET /observability/sessions"],
    ],
  },
];

const DOMAIN_CATEGORIES = {
  all: null,
  retail: ["party", "accounts", "savings"],
  payments: ["payments", "transactions"],
  credit: ["lending", "cards"],
  wealth: ["investments", "compliance", "notifications"],
};

/* ══════════════════════════════════════════════════════════════════════════
   PRECISION CORE BANKING DESIGN SYSTEM (THOUGHT MACHINE INSPIRED)
══════════════════════════════════════════════════════════════════════════ */
const CSS = `
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
:root{
  --bg:#F8FAFC;
  --surface:#FFFFFF;
  --cream:#F1F5F9;
  --ink:#0B1120;
  --ink-2:#334155;
  --mid:#64748B;
  --line:#E2E8F0;
  --line-strong:#CBD5E1;
  --accent:#2563EB;
  --accent-dark:#1D4ED8;
  --accent-soft:#EFF6FF;
  --accent-border:#BFDBFE;
  --gold:#2563EB;
  --mono:'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  --sans:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --display:'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --dbg:#090D16;
  --dsurf:#0F172A;
  --dcard:#131C31;
  --dborder:#1E293B;
  --blue:#38BDF8;
  --green:#10B981;
  --purple:#818CF8;
  --red:#EF4444;
  --orange:#F59E0B;
  --radius-sm:6px;
  --radius-md:10px;
  --radius-lg:14px;
  --shadow-sm:0 1px 2px rgba(15,23,42,0.04);
  --shadow-md:0 4px 12px -2px rgba(15,23,42,0.06), 0 2px 4px -2px rgba(15,23,42,0.03);
  --shadow-lg:0 12px 28px -6px rgba(15,23,42,0.08), 0 4px 10px -3px rgba(15,23,42,0.04);
}
html{scroll-behavior:smooth;}
body{background:var(--bg);color:var(--ink);font-family:var(--sans);overflow-x:hidden;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;}

/* ───── Top Institutional Navbar ───── */
.nav{position:fixed;top:0;left:0;right:0;z-index:300;display:flex;align-items:center;justify-content:space-between;padding:0 36px;height:64px;background:rgba(255,255,255,0.92);backdrop-filter:blur(12px);border-bottom:1px solid var(--line);}
.nav-brand{display:flex;align-items:center;gap:10px;cursor:pointer;}
.nav-mark{width:30px;height:30px;border-radius:7px;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:12px;font-weight:600;letter-spacing:-0.03em;}
.nav-mark span{color:#60A5FA;}
.nav-logo{font-family:var(--display);font-size:17px;font-weight:700;color:var(--ink);letter-spacing:-0.025em;}
.nav-logo span{color:var(--accent);}
.nav-links{display:flex;gap:22px;align-items:center;}
.nl{font-size:13px;font-weight:500;color:var(--mid);cursor:pointer;text-decoration:none;transition:color .16s;}
.nl:hover{color:var(--accent);}
.nav-btn{font-family:var(--sans);background:var(--accent);color:#fff;padding:8px 16px;font-size:12.5px;font-weight:600;border-radius:var(--radius-sm);border:1px solid var(--accent);cursor:pointer;transition:all .16s;box-shadow:var(--shadow-sm);}
.nav-btn:hover{background:var(--accent-dark);border-color:var(--accent-dark);}
.nav-btn-outline{background:var(--surface);color:var(--ink);border:1px solid var(--line-strong);}
.nav-btn-outline:hover{background:var(--accent-soft);color:var(--accent);border-color:var(--accent);}

/* ───── Hero Section (2-Column Precision Layout) ───── */
.hero{padding:112px 36px 72px;position:relative;overflow:hidden;background:linear-gradient(180deg,#FFFFFF 0%,#F8FAFC 100%);border-bottom:1px solid var(--line);}
.hero-grid{position:absolute;inset:0;background-image:linear-gradient(to right,rgba(226,232,240,0.45) 1px,transparent 1px),linear-gradient(to bottom,rgba(226,232,240,0.45) 1px,transparent 1px);background-size:48px 48px;pointer-events:none;}
.hero-container{position:relative;max-width:1280px;margin:0 auto;display:grid;grid-template-columns:1.1fr 0.9fr;gap:48px;align-items:center;}
.hero-tag{display:inline-flex;align-items:center;gap:8px;background:var(--accent-soft);color:var(--accent);border:1px solid var(--accent-border);border-radius:999px;font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:0.05em;padding:5px 13px;margin-bottom:22px;}
.hero-dot{width:6px;height:6px;border-radius:50%;background:var(--accent);animation:pulse 2s infinite;}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
h1{font-family:var(--display);font-size:clamp(36px,4.4vw,56px);font-weight:700;line-height:1.08;letter-spacing:-0.03em;margin-bottom:20px;color:var(--ink);}
h1 em{font-style:normal;color:var(--accent);}
.hero-p{font-size:16.5px;color:var(--ink-2);line-height:1.65;max-width:580px;margin-bottom:32px;font-weight:400;}
.btn-row{display:flex;gap:12px;flex-wrap:wrap;}
.btn-dark{font-family:var(--sans);background:var(--accent);color:#fff;padding:11px 22px;font-size:13.5px;font-weight:600;border-radius:var(--radius-sm);border:1px solid var(--accent);cursor:pointer;transition:all .16s;box-shadow:var(--shadow-sm);}
.btn-dark:hover{background:var(--accent-dark);border-color:var(--accent-dark);}
.btn-light{font-family:var(--sans);background:var(--surface);color:var(--ink);padding:11px 20px;font-size:13.5px;font-weight:600;border-radius:var(--radius-sm);border:1px solid var(--line-strong);cursor:pointer;transition:all .16s;box-shadow:var(--shadow-sm);text-decoration:none;display:inline-flex;align-items:center;}
.btn-light:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-soft);}
.hero-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:44px;padding-top:28px;border-top:1px solid var(--line);}
.stat-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-sm);padding:12px 14px;box-shadow:var(--shadow-sm);}
.stat-n{font-family:var(--display);font-size:22px;font-weight:700;letter-spacing:-0.025em;color:var(--ink);}
.stat-l{font-family:var(--mono);font-size:10.5px;font-weight:500;color:var(--mid);margin-top:3px;letter-spacing:0.04em;text-transform:uppercase;}

/* Hero Right: Interactive 4-Layer Core Schematic */
.hero-schematic{background:var(--dsurf);border:1px solid var(--dborder);border-radius:var(--radius-lg);padding:20px;box-shadow:var(--shadow-lg);color:#F8FAFC;}
.hs-hdr{display:flex;align-items:center;justify-content:space-between;padding-bottom:14px;margin-bottom:14px;border-bottom:1px solid var(--dborder);}
.hs-title{font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:0.06em;color:#93C5FD;text-transform:uppercase;}
.hs-hint{font-family:var(--mono);font-size:10px;color:#64748B;}
.hs-layers{display:flex;flex-direction:column;gap:8px;}
.hs-layer{padding:13px 15px;border-radius:var(--radius-sm);border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.02);cursor:pointer;transition:all .16s;}
.hs-layer:hover{border-color:rgba(96,165,250,0.4);background:rgba(255,255,255,0.04);}
.hs-layer.active{border-color:#3B82F6;background:rgba(37,99,235,0.14);}
.hs-l-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;}
.hs-l-name{font-family:var(--display);font-size:14px;font-weight:600;color:#fff;display:flex;align-items:center;gap:8px;}
.hs-l-code{font-family:var(--mono);font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;background:rgba(59,130,246,0.2);color:#93C5FD;}
.hs-l-tag{font-family:var(--mono);font-size:10px;color:#94A3B8;}
.hs-l-sum{font-size:12.5px;color:#94A3B8;line-height:1.5;}
.hs-l-drawer{margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}
.hs-l-det{font-size:12px;color:#CBD5E1;line-height:1.5;flex:1;min-width:200px;}
.hs-l-btn{font-family:var(--mono);font-size:10.5px;font-weight:600;padding:5px 10px;border-radius:4px;background:#2563EB;color:#fff;border:none;cursor:pointer;white-space:nowrap;}

/* ───── Sticky Sub-Navigation Tab Bar ───── */
.tab-bar{position:sticky;top:64px;z-index:200;background:rgba(255,255,255,0.95);backdrop-filter:blur(12px);border-bottom:1px solid var(--line);display:flex;align-items:center;gap:4px;padding:0 36px;}
.tab-btn{font-family:var(--sans);font-size:13px;font-weight:600;padding:14px 18px;background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;color:var(--mid);transition:color .16s,border-color .16s;white-space:nowrap;}
.tab-btn:hover{color:var(--ink);}
.tab-btn.on{color:var(--accent);border-bottom-color:var(--accent);}

/* ───── Shared Section Containers ───── */
.sec,.mcp-sec,.uc-sec,.tools-sec{padding:72px 36px;}
.sec-inner{max-width:1280px;margin:0 auto;}
.sec-hdr-split{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;flex-wrap:wrap;margin-bottom:36px;}
.sec-tag{font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:0.06em;color:var(--accent);text-transform:uppercase;margin-bottom:10px;display:inline-block;background:var(--accent-soft);border:1px solid var(--accent-border);padding:3px 9px;border-radius:999px;}
.sec-h{font-family:var(--display);font-size:clamp(26px,3vw,36px);font-weight:700;letter-spacing:-0.025em;line-height:1.15;margin-bottom:12px;color:var(--ink);}
.sec-p{font-size:15.5px;color:var(--ink-2);line-height:1.65;max-width:640px;margin-bottom:36px;}
.sec-meta-pill{font-family:var(--mono);font-size:11px;color:var(--mid);background:var(--surface);border:1px solid var(--line);padding:6px 12px;border-radius:var(--radius-sm);display:inline-flex;gap:8px;align-items:center;box-shadow:var(--shadow-sm);}
.inline-code{font-family:var(--mono);font-size:12.5px;background:var(--cream);border:1px solid var(--line);padding:1px 6px;border-radius:4px;color:var(--ink);}

/* ───── AI Channel Tab (Progressive 5-Pillar Accordion + Terminal) ───── */
.agent-grid{display:grid;grid-template-columns:1fr 1.05fr;gap:32px;align-items:start;}
.agent-feats{display:flex;flex-direction:column;gap:10px;}
.feat{padding:18px 20px;border-radius:var(--radius-md);background:var(--surface);border:1px solid var(--line);cursor:pointer;transition:all .16s;box-shadow:var(--shadow-sm);}
.feat:hover{border-color:var(--line-strong);}
.feat.active{border-color:var(--accent);box-shadow:0 0 0 3px rgba(37,99,235,0.08),var(--shadow-md);}
.feat-top{display:flex;align-items:center;justify-content:space-between;gap:10px;}
.feat-left{display:flex;align-items:center;gap:10px;}
.feat-code{font-family:var(--mono);font-size:11px;font-weight:600;padding:3px 7px;border-radius:4px;background:var(--cream);color:var(--mid);}
.feat.active .feat-code{background:var(--accent);color:#fff;}
.feat-h{font-family:var(--display);font-size:15.5px;font-weight:700;letter-spacing:-0.01em;color:var(--ink);}
.feat-std{font-family:var(--mono);font-size:10px;color:var(--accent);background:var(--accent-soft);padding:2px 7px;border-radius:4px;border:1px solid var(--accent-border);}
.feat-body{margin-top:12px;padding-top:12px;border-top:1px solid var(--line);}
.feat-p{font-size:13.5px;color:var(--ink-2);line-height:1.6;margin-bottom:10px;}
.feat-spec{font-family:var(--mono);font-size:11px;color:var(--ink);background:var(--cream);padding:7px 10px;border-radius:5px;border:1px solid var(--line);}

.term{background:var(--dbg);border:1px solid var(--dborder);border-radius:var(--radius-lg);overflow:hidden;box-shadow:var(--shadow-lg);}
.term-bar{display:flex;align-items:center;gap:7px;padding:12px 16px;background:var(--dsurf);border-bottom:1px solid var(--dborder);}
.tdot{width:10px;height:10px;border-radius:50%;}
.term-lbl{font-family:var(--mono);font-size:11px;font-weight:600;color:#94A3B8;margin-left:6px;letter-spacing:0.05em;}
.term-body{padding:20px;max-height:460px;overflow-y:auto;font-family:var(--mono);font-size:11.5px;line-height:1.75;}
.tm-agent{color:#38BDF8;margin-bottom:8px;}
.tm-lbl{color:#60A5FA;font-weight:600;margin-right:6px;}
.tm-call{margin-bottom:4px;}
.tm-tool{color:#FBBF24;font-weight:600;}
.tm-tlbl{color:#94A3B8;margin-right:4px;}
.tm-params{color:#94A3B8;font-size:10.5px;}
.tm-res{margin:4px 0 10px 14px;padding:10px 12px;background:rgba(255,255,255,.03);border-left:2px solid #3B82F6;border-radius:0 6px 6px 0;}
.tm-rlbl{color:#94A3B8;font-size:10px;margin-bottom:3px;}
.tm-rval{color:#34D399;font-size:10.5px;}

/* ───── Services & APIs Tab (Segmented + Filterable) ───── */
.filter-bar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:24px;flex-wrap:wrap;padding:12px 16px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);box-shadow:var(--shadow-sm);}
.seg-group{display:inline-flex;background:var(--cream);padding:3px;border-radius:7px;border:1px solid var(--line);}
.seg-btn{font-family:var(--sans);font-size:12.5px;font-weight:600;padding:6px 14px;border-radius:5px;border:none;background:transparent;color:var(--ink-2);cursor:pointer;transition:all .15s;}
.seg-btn.on{background:var(--surface);color:var(--accent);box-shadow:var(--shadow-sm);}
.filter-chip{font-family:var(--sans);font-size:12px;font-weight:500;padding:6px 12px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--ink-2);cursor:pointer;transition:all .15s;}
.filter-chip:hover{border-color:var(--line-strong);color:var(--ink);}
.filter-chip.on{background:var(--ink);color:#fff;border-color:var(--ink);}

.svc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:16px;}
.svc-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);padding:24px;cursor:pointer;transition:all .18s;position:relative;overflow:hidden;box-shadow:var(--shadow-sm);display:flex;flex-direction:column;justify-content:space-between;}
.svc-card:hover{border-color:var(--accent);box-shadow:var(--shadow-md);transform:translateY(-1px);}
.svc-card-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
.dom-code-pill{font-family:var(--mono);font-size:10.5px;font-weight:600;padding:3px 8px;border-radius:5px;background:var(--cream);color:var(--ink);border:1px solid var(--line);}
.svc-name{font-family:var(--display);font-size:17px;font-weight:700;letter-spacing:-0.015em;margin-bottom:4px;color:var(--ink);}
.svc-bian{font-family:var(--mono);font-size:11px;color:var(--accent);margin-bottom:10px;}
.svc-desc{font-size:13.5px;color:var(--ink-2);line-height:1.55;margin-bottom:18px;}
.svc-meta{font-family:var(--mono);font-size:11.5px;display:flex;align-items:center;justify-content:space-between;padding-top:12px;border-top:1px solid var(--line);color:var(--mid);}
.svc-meta span strong{color:var(--ink);font-weight:600;}

.tools-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;}
.tool-card{padding:18px 20px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);box-shadow:var(--shadow-sm);transition:all .16s;}
.tool-card:hover{border-color:var(--line-strong);box-shadow:var(--shadow-md);}
.tool-name{font-family:var(--mono);font-size:13.5px;font-weight:600;margin-bottom:3px;}
.tool-dom{font-family:var(--mono);font-size:10.5px;color:var(--mid);margin-bottom:8px;}
.tool-desc{font-size:13px;color:var(--ink-2);line-height:1.55;margin-bottom:12px;}
.tool-params{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;margin-bottom:12px;}
.tool-p{font-family:var(--mono);font-size:10.5px;padding:2px 7px;border-radius:4px;background:var(--cream);color:var(--ink-2);border:1px solid var(--line);}
.try-tool-btn{font-family:var(--mono);font-size:11px;font-weight:600;padding:6px 11px;border-radius:5px;background:var(--accent-soft);border:1px solid var(--accent-border);color:var(--accent);cursor:pointer;transition:all .15s;}
.try-tool-btn:hover{background:var(--accent);color:#fff;}

/* ───── Use Case Tab (Smart Savings Agent) ───── */
.uc-grid{display:grid;grid-template-columns:0.95fr 1.05fr;gap:32px;align-items:start;}
.uc-steps{display:flex;flex-direction:column;gap:10px;}
.uc-step{display:flex;gap:14px;padding:16px 18px;border-radius:var(--radius-md);background:var(--surface);border:1px solid var(--line);cursor:pointer;transition:all .16s;box-shadow:var(--shadow-sm);}
.uc-step:hover{border-color:var(--line-strong);}
.uc-step.active{border-color:var(--accent);box-shadow:0 0 0 3px rgba(37,99,235,0.08),var(--shadow-md);}
.step-circle{width:28px;height:28px;border-radius:7px;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:12px;font-weight:600;background:var(--cream);color:var(--mid);flex-shrink:0;}
.uc-step.active .step-circle{background:var(--accent);color:#fff;border-color:var(--accent);}
.uc-step.done .step-circle{background:#ECFDF5;color:#059669;border-color:#A7F3D0;}
.step-body{flex:1;}
.step-title{font-family:var(--display);font-size:15px;font-weight:700;color:var(--ink);margin-bottom:2px;}
.step-dom{font-family:var(--mono);font-size:10.5px;font-weight:600;text-transform:uppercase;}
.step-desc{font-size:13px;color:var(--ink-2);line-height:1.55;margin-top:8px;padding-top:8px;border-top:1px solid var(--line);}

.code-box{background:var(--dbg);border:1px solid var(--dborder);border-radius:var(--radius-lg);overflow:hidden;box-shadow:var(--shadow-lg);position:sticky;top:128px;}
.code-topbar{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--dsurf);border-bottom:1px solid var(--dborder);gap:10px;flex-wrap:wrap;}
.cdots{display:flex;gap:6px;}
.cdot{width:10px;height:10px;border-radius:50%;}
.code-lbl{font-family:var(--mono);font-size:11px;font-weight:600;color:#94A3B8;}
.code-badge{font-family:var(--mono);font-size:10.5px;font-weight:600;padding:2px 8px;border:1px solid;border-radius:4px;}
.code-scroll{padding:20px;overflow:auto;max-height:460px;}
.code-scroll pre{font-family:var(--mono);font-size:12px;line-height:1.75;color:#34D399;white-space:pre;}

/* ───── Agent Builds Tab ───── */
.builds-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;margin-bottom:28px;}
.build-card{padding:20px;border-radius:var(--radius-md);background:var(--surface);border:1px solid var(--line);cursor:pointer;transition:all .16s;box-shadow:var(--shadow-sm);}
.build-card:hover{border-color:var(--line-strong);box-shadow:var(--shadow-md);}
.build-card.active{border-color:var(--accent);background:var(--accent-soft);box-shadow:0 0 0 2px rgba(37,99,235,0.1);}
.build-card-name{font-family:var(--display);font-size:15.5px;font-weight:700;margin-bottom:6px;color:var(--ink);}
.build-card-desc{font-size:12.5px;color:var(--ink-2);line-height:1.55;margin-bottom:12px;}
.build-tags{display:flex;flex-wrap:wrap;gap:5px;}
.build-tag{font-family:var(--mono);font-size:10px;font-weight:500;padding:2px 7px;border-radius:4px;background:var(--surface);border:1px solid var(--line);color:var(--mid);}
.build-viewer{border:1px solid var(--dborder);border-radius:var(--radius-lg);overflow:hidden;box-shadow:var(--shadow-lg);}
.build-viewer-bar{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid var(--dborder);background:var(--dsurf);}
.build-viewer-title{font-family:var(--mono);font-size:11.5px;font-weight:600;color:#E2E8F0;}
.build-viewer-badge{font-family:var(--mono);font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:4px;border:1px solid;}
.build-viewer-code{background:var(--dbg);padding:24px;overflow-x:auto;}
.build-viewer-code pre{font-family:var(--mono);font-size:12px;line-height:1.8;color:#E2E8F0;margin:0;white-space:pre;}

/* ───── Architecture Tab (Interactive 3-Sub-Tab Inspector) ───── */
.arch-full{padding:72px 36px;background:var(--dbg);color:#F8FAFC;}
.arch-split{display:grid;grid-template-columns:1.15fr 0.85fr;gap:28px;align-items:start;}
.arch-stack{display:flex;flex-direction:column;gap:8px;}
.arch-row-card{padding:14px 18px;border-radius:var(--radius-md);border:1px solid var(--dborder);background:var(--dsurf);cursor:pointer;transition:all .16s;display:grid;grid-template-columns:130px 1fr;gap:16px;align-items:center;}
.arch-row-card:hover{border-color:#334155;}
.arch-row-card.active{border-color:#3B82F6;background:rgba(37,99,235,0.12);box-shadow:0 0 0 2px rgba(59,130,246,0.2);}
.arch-lbl{font-family:var(--mono);font-size:11px;font-weight:600;color:#93C5FD;letter-spacing:0.05em;}
.arch-comps{display:flex;gap:6px;flex-wrap:wrap;}
.arch-chip{font-family:var(--sans);font-size:11.5px;font-weight:500;padding:4px 10px;border-radius:5px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);color:#CBD5E1;}
.arch-chip.hi{background:rgba(59,130,246,.15);border-color:rgba(59,130,246,.4);color:#93C5FD;}
.arch-chip.blue{background:rgba(56,189,248,.12);border-color:rgba(56,189,248,.35);color:#38BDF8;}
.arch-chip.green{background:rgba(16,185,129,.12);border-color:rgba(16,185,129,.35);color:#34D399;}
.arch-chip.purple{background:rgba(129,140,248,.12);border-color:rgba(129,140,248,.35);color:#A5B4FC;}

.arch-inspector{background:var(--dsurf);border:1px solid var(--dborder);border-radius:var(--radius-lg);padding:24px;position:sticky;top:128px;}
.arch-domains{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;}
.arch-domain{padding:18px;border-radius:var(--radius-md);border:1px solid var(--dborder);background:var(--dsurf);cursor:pointer;transition:border-color .16s;}
.arch-domain:hover{border-color:#3B82F6;}
.arch-domain-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;}
.arch-domain-name{font-family:var(--display);font-size:15px;font-weight:700;color:#F8FAFC;}
.arch-domain-bian{font-family:var(--mono);font-size:10.5px;color:#60A5FA;margin-bottom:10px;}
.arch-domain-divider{height:1px;background:var(--dborder);margin-bottom:10px;}
.arch-domain-caps{display:flex;flex-direction:column;gap:5px;}
.arch-domain-cap{font-size:12.5px;color:#94A3B8;display:flex;align-items:flex-start;gap:6px;}
.arch-domain-cap::before{content:'→';color:#38BDF8;flex-shrink:0;font-family:var(--mono);}
.arch-standards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;}
.arch-std{padding:20px;border-radius:var(--radius-md);border:1px solid var(--dborder);background:var(--dsurf);}
.arch-std-name{font-family:var(--display);font-size:16px;font-weight:700;color:#F8FAFC;margin-bottom:4px;}
.arch-std-ver{font-family:var(--mono);font-size:11px;color:#38BDF8;margin-bottom:10px;}
.arch-std-desc{font-size:13px;color:#94A3B8;line-height:1.6;}

/* ───── Workbench Shared Styles (MCP & SDK Tabs) ───── */
.workbench-shell{border:1px solid var(--dborder);border-radius:var(--radius-lg);overflow:hidden;background:var(--dbg);box-shadow:var(--shadow-lg);}
.workbench-tabs{display:flex;background:var(--dsurf);border-bottom:1px solid var(--dborder);overflow-x:auto;}
.wb-tab{font-family:var(--mono);font-size:11.5px;font-weight:600;padding:12px 18px;background:none;border:none;border-bottom:2px solid transparent;color:#94A3B8;cursor:pointer;white-space:nowrap;transition:all .15s;}
.wb-tab:hover{color:#F8FAFC;}
.wb-tab.on{color:#60A5FA;border-bottom-color:#3B82F6;background:rgba(59,130,246,0.08);}
.wb-info-bar{padding:10px 18px;background:#0C1322;border-bottom:1px solid var(--dborder);display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12.5px;color:#94A3B8;flex-wrap:wrap;}
.mcp-code{background:var(--dbg);padding:20px;font-family:var(--mono);font-size:12px;line-height:1.75;color:#34D399;overflow-x:auto;white-space:pre;}
.mcp-copy-btn{position:absolute;top:10px;right:10px;font-family:var(--mono);font-size:10.5px;font-weight:600;padding:5px 11px;border-radius:5px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);color:#CBD5E1;cursor:pointer;transition:all .15s;}
.mcp-copy-btn:hover{background:#2563EB;border-color:#3B82F6;color:#fff;}
.mcp-tools-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;}
.mcp-tool{padding:16px 18px;border-radius:var(--radius-md);border:1px solid var(--line);background:var(--surface);box-shadow:var(--shadow-sm);transition:all .15s;}
.mcp-tool.expanded{border-color:var(--accent);box-shadow:var(--shadow-md);}
.mcp-tool-name{font-family:var(--mono);font-size:13.5px;font-weight:600;}
.mcp-tool-desc{font-size:13px;color:var(--ink-2);line-height:1.5;}
.mcp-schema{font-family:var(--mono);font-size:10.5px;display:flex;flex-wrap:wrap;gap:5px;}
.mcp-param{padding:2px 7px;border-radius:4px;background:var(--cream);border:1px solid var(--line);color:var(--mid);}
.mcp-param.req{border-color:var(--accent-border);background:var(--accent-soft);color:var(--accent-dark);font-weight:600;}

/* ───── Domain Modal ───── */
.overlay{position:fixed;inset:0;background:rgba(11,17,32,.75);backdrop-filter:blur(4px);z-index:500;display:flex;align-items:flex-start;justify-content:center;padding:48px 20px;overflow-y:auto;}
.modal{background:var(--surface);width:100%;max-width:780px;border:1px solid var(--line);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);overflow:hidden;}
.modal-hdr{padding:24px 28px 20px;border-bottom:1px solid var(--line);display:flex;align-items:flex-start;justify-content:space-between;gap:14px;background:var(--bg);}
.modal-title{font-family:var(--display);font-size:22px;font-weight:700;letter-spacing:-0.02em;color:var(--ink);}
.modal-bian{font-family:var(--mono);font-size:11.5px;color:var(--accent);margin-top:4px;}
.modal-x{background:var(--surface);border:1px solid var(--line-strong);border-radius:var(--radius-sm);padding:6px 11px;cursor:pointer;font-size:14px;color:var(--mid);transition:all .15s;}
.modal-x:hover{background:var(--ink);color:#fff;border-color:var(--ink);}
.modal-body{padding:24px 28px;}
.modal-tabs{display:flex;border-bottom:1px solid var(--line);margin-bottom:20px;}
.mtab{font-family:var(--sans);padding:9px 18px;font-size:13px;font-weight:600;background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;color:var(--mid);transition:all .15s;}
.mtab.on{color:var(--accent);border-bottom-color:var(--accent);}
.ep-list{display:flex;flex-direction:column;gap:8px;}
.ep-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-radius:var(--radius-sm);background:var(--bg);border:1px solid var(--line);}
.ep-badge{font-family:var(--mono);font-size:10px;font-weight:600;padding:3px 7px;border-radius:4px;flex-shrink:0;}
.badge-GET{background:#DCFCE7;color:#166534;}
.badge-POST{background:#DBEAFE;color:#1E40AF;}
.badge-PUT{background:#FEF3C7;color:#92400E;}
.ep-path{font-family:var(--mono);font-size:12px;font-weight:500;color:var(--ink);word-break:break-all;}
.ep-desc{font-size:12.5px;color:var(--ink-2);margin-top:2px;}
.cap-list{display:flex;flex-direction:column;gap:8px;}
.cap-row{display:flex;align-items:center;gap:11px;padding:11px 15px;border-radius:var(--radius-sm);border:1px solid var(--line);background:var(--bg);}
.cap-tick{width:20px;height:20px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:10px;color:#fff;}
.cap-text{font-size:13.5px;font-weight:500;}
.scope-box{margin-top:16px;padding:14px;border-radius:var(--radius-sm);background:var(--accent-soft);border:1px solid var(--accent-border);}
.scope-lbl{font-family:var(--mono);font-size:10.5px;font-weight:600;letter-spacing:0.06em;color:var(--accent);margin-bottom:6px;}

/* ───── Interactive API Console & Observability Dark Control Plane ───── */
.console-wrap,.obs-wrap{position:fixed;inset:0;background:var(--dbg);z-index:600;display:flex;flex-direction:column;color:#F8FAFC;}
.console-top,.obs-top{display:flex;align-items:center;justify-content:space-between;padding:0 24px;height:56px;background:var(--dsurf);border-bottom:1px solid var(--dborder);flex-shrink:0;}
.console-logo,.obs-logo{font-family:var(--display);font-size:16px;font-weight:700;letter-spacing:-0.025em;color:#fff;}
.console-logo span,.obs-logo span{color:#60A5FA;}
.console-sub,.obs-sub{font-family:var(--mono);font-size:11px;font-weight:500;color:#94A3B8;margin-left:10px;letter-spacing:0.05em;text-transform:uppercase;}
.console-x{font-family:var(--mono);font-size:11px;font-weight:600;padding:6px 14px;border-radius:var(--radius-sm);background:rgba(255,255,255,.06);border:1px solid #334155;color:#CBD5E1;cursor:pointer;transition:all .15s;}
.console-x:hover{background:#EF4444;border-color:#EF4444;color:#fff;}
.console-inner{display:flex;flex:1;overflow:hidden;}
.console-sidebar{width:225px;flex-shrink:0;border-right:1px solid var(--dborder);overflow-y:auto;background:var(--dbg);}
.csb-lbl{font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:0.08em;color:#64748B;padding:14px 16px 6px;text-transform:uppercase;}
.csb-item{padding:10px 16px;cursor:pointer;transition:background .15s;display:flex;align-items:center;gap:10px;border-left:2px solid transparent;}
.csb-item:hover{background:rgba(255,255,255,.03);}
.csb-item.on{background:rgba(37,99,235,.15);border-left-color:#3B82F6;}
.csb-icon{font-family:var(--mono);font-size:10px;font-weight:600;padding:2px 5px;border-radius:4px;background:rgba(255,255,255,0.06);}
.csb-name{font-family:var(--sans);font-size:12.5px;font-weight:500;color:#CBD5E1;}
.csb-item.on .csb-name{color:#fff;font-weight:600;}
.console-main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;}
.ep-bar{padding:10px 16px;border-bottom:1px solid var(--dborder);display:flex;gap:6px;flex-wrap:wrap;background:#0C1322;flex-shrink:0;}
.ep-btn{font-family:var(--mono);font-size:11px;padding:5px 10px;border-radius:5px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);color:#94A3B8;cursor:pointer;transition:all .15s;display:flex;gap:6px;align-items:center;}
.ep-btn:hover{background:rgba(255,255,255,.08);color:#F8FAFC;}
.ep-btn.on{background:rgba(37,99,235,.2);border-color:#3B82F6;color:#fff;}
.em{font-size:9.5px;font-weight:700;padding:1px 5px;border-radius:3px;}
.em-GET{background:rgba(16,185,129,.2);color:#34D399;}
.em-POST{background:rgba(59,130,246,.25);color:#60A5FA;}
.em-PUT{background:rgba(245,158,11,.2);color:#FBBF24;}
.workspace{flex:1;display:grid;grid-template-columns:1fr 1fr;overflow:hidden;}
.req-pane,.res-pane{display:flex;flex-direction:column;overflow:hidden;}
.req-pane{border-right:1px solid var(--dborder);}
.pane-hdr{padding:10px 16px;border-bottom:1px solid var(--dborder);font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:0.05em;color:#94A3B8;background:var(--dbg);flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:8px;}
.url-row{display:flex;align-items:center;padding:10px 16px;border-bottom:1px solid var(--dborder);flex-shrink:0;background:#0C1322;gap:8px;}
.url-method{font-family:var(--mono);font-size:11px;font-weight:600;padding:7px 10px;border-radius:5px;min-width:56px;text-align:center;}
.um-GET{color:#34D399;background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.3);}
.um-POST{color:#60A5FA;background:rgba(59,130,246,.15);border:1px solid rgba(59,130,246,.35);}
.um-PUT{color:#FBBF24;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.3);}
.url-path{flex:1;font-family:var(--mono);font-size:12px;background:rgba(255,255,255,.04);border:1px solid #334155;border-radius:5px;color:#F8FAFC;padding:7px 11px;outline:none;min-width:0;}
.url-path:focus{border-color:#3B82F6;}
.send{padding:7px 18px;border-radius:5px;background:#2563EB;color:#fff;font-family:var(--sans);font-size:12.5px;font-weight:600;border:none;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:background .15s;}
.send:hover{background:#1D4ED8;}
.send:disabled{opacity:.4;cursor:not-allowed;}
.req-fields{flex:1;overflow-y:auto;}
.field-section{border-bottom:1px solid var(--dborder);}
.field-sec-hdr{padding:9px 16px;font-family:var(--mono);font-size:10.5px;font-weight:600;letter-spacing:0.06em;color:#94A3B8;background:var(--dbg);display:flex;align-items:center;justify-content:space-between;cursor:pointer;}
.field{padding:8px 16px;display:flex;flex-direction:column;gap:4px;}
.field-lbl{font-family:var(--mono);font-size:10.5px;color:#94A3B8;}
.field-inp{font-family:var(--mono);font-size:11.5px;background:rgba(255,255,255,.04);border:1px solid #334155;border-radius:5px;color:#E2E8F0;padding:6px 10px;outline:none;width:100%;}
.field-inp:focus{border-color:#3B82F6;}
.field-ta{font-family:var(--mono);font-size:12px;background:rgba(255,255,255,.03);border:1px solid #334155;border-radius:6px;color:#34D399;padding:12px;outline:none;width:100%;resize:none;line-height:1.6;}
.field-ta:focus{border-color:#3B82F6;}
.res-body{flex:1;overflow-y:auto;padding:16px;}
.res-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;color:#64748B;gap:8px;}
.res-empty-icon{font-size:24px;}
.res-empty-text{font-family:var(--mono);font-size:11.5px;letter-spacing:0.05em;}
.res-meta{display:flex;gap:10px;margin-bottom:14px;align-items:center;flex-wrap:wrap;}
.res-status{font-family:var(--mono);font-size:12px;font-weight:600;padding:3px 10px;border-radius:4px;background:rgba(16,185,129,.14);border:1px solid rgba(16,185,129,.35);color:#34D399;}
.res-status.err{background:rgba(239,68,68,.14);border-color:rgba(239,68,68,.4);color:#F87171;}
.mode-toggle{display:inline-flex;border-radius:6px;border:1px solid #334155;background:var(--dbg);margin-left:14px;overflow:hidden;}
.mode-btn{font-family:var(--mono);font-size:10.5px;font-weight:600;padding:5px 11px;background:transparent;border:none;color:#94A3B8;cursor:pointer;transition:all .15s;}
.mode-btn.on-mock{background:rgba(59,130,246,.22);color:#60A5FA;}
.mode-btn.on-live{background:rgba(16,185,129,.2);color:#34D399;}
.res-time{font-family:var(--mono);font-size:11.5px;color:#94A3B8;}
.res-json{font-family:var(--mono);font-size:12px;line-height:1.7;color:#34D399;white-space:pre-wrap;word-break:break-all;}
.res-loading{display:flex;align-items:center;gap:10px;color:#60A5FA;font-family:var(--mono);font-size:12px;padding:18px 0;}
.spinner{width:15px;height:15px;border:2px solid rgba(59,130,246,.2);border-top-color:#3B82F6;border-radius:50%;animation:spin .7s linear infinite;}
@keyframes spin{to{transform:rotate(360deg)}}

/* ───── Observability Styles ───── */
.obs-right{display:flex;align-items:center;gap:12px;}
.live-pill{display:flex;align-items:center;gap:6px;border-radius:999px;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);padding:4px 11px;}
.ldot{width:6px;height:6px;border-radius:50%;background:#10B981;animation:blink 1.5s infinite;}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
.ltext{font-family:var(--mono);font-size:10.5px;font-weight:600;color:#34D399;}
.pause-btn{font-family:var(--mono);font-size:11px;font-weight:600;padding:5px 12px;border-radius:var(--radius-sm);background:rgba(255,255,255,.05);border:1px solid #334155;color:#CBD5E1;cursor:pointer;transition:all .15s;}
.pause-btn:hover,.pause-btn.paused{background:rgba(59,130,246,.18);border-color:#3B82F6;color:#60A5FA;}
.obs-tabs{display:flex;background:var(--dsurf);border-bottom:1px solid var(--dborder);padding:0 24px;}
.otab{padding:12px 18px;font-family:var(--mono);font-size:11.5px;font-weight:600;color:#94A3B8;cursor:pointer;border-bottom:2px solid transparent;background:none;border-top:none;border-left:none;border-right:none;transition:all .15s;}
.otab:hover{color:#F8FAFC;}
.otab.on{color:#60A5FA;border-bottom-color:#3B82F6;}
.obs-page{padding:20px 24px;overflow-y:auto;flex:1;}
.kpi-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:18px;}
.kpi{background:var(--dsurf);border:1px solid var(--dborder);border-radius:var(--radius-sm);padding:14px 16px;}
.kpi-lbl{font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:0.06em;color:#94A3B8;text-transform:uppercase;margin-bottom:6px;}
.kpi-val{font-family:var(--display);font-size:22px;font-weight:700;letter-spacing:-0.02em;}
.chart-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px;}
.chart-row-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:16px;}
.chart-card{background:var(--dsurf);border:1px solid var(--dborder);border-radius:var(--radius-sm);padding:16px;}
.chart-hdr{font-family:var(--mono);font-size:10.5px;font-weight:600;letter-spacing:0.06em;color:#94A3B8;text-transform:uppercase;margin-bottom:12px;}
.sess-table{background:var(--dsurf);border:1px solid var(--dborder);border-radius:var(--radius-sm);overflow:hidden;}
.srow{display:grid;grid-template-columns:105px 120px 1fr 90px 80px 90px 160px;padding:10px 16px;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px;align-items:center;cursor:pointer;transition:background .15s;}
.srow:hover{background:rgba(255,255,255,.04);}
.srow.on{background:rgba(37,99,235,.15);border-left:3px solid #3B82F6;}
.srow-hdr{color:#94A3B8;font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;cursor:default;background:#0C1322;}
.srow-hdr:hover{background:#0C1322;}
.srow.console-row{border-left:3px solid #38BDF8;}
.sbadge{font-family:var(--mono);font-size:10px;font-weight:600;padding:2px 7px;border-radius:4px;}
.sb-success{background:rgba(16,185,129,.12);color:#34D399;border:1px solid rgba(16,185,129,.3);}
.sb-error{background:rgba(239,68,68,.12);color:#F87171;border:1px solid rgba(239,68,68,.3);}
.sb-timeout{background:rgba(245,158,11,.12);color:#FBBF24;border:1px solid rgba(245,158,11,.3);}
.trace-layout{display:grid;grid-template-columns:1fr 350px;gap:16px;}
.trace-panel,.detail-panel,.span-panel{background:var(--dsurf);border:1px solid var(--dborder);border-radius:var(--radius-sm);overflow:hidden;}
.panel-hdr{padding:11px 16px;border-bottom:1px solid var(--dborder);display:flex;align-items:center;justify-content:space-between;background:#0C1322;}
.panel-hdr-lbl{font-family:var(--mono);font-size:10.5px;font-weight:600;letter-spacing:0.06em;color:#94A3B8;text-transform:uppercase;}
.panel-tid{font-family:var(--mono);font-size:10.5px;color:#60A5FA;}
.trace-body{padding:16px;max-height:460px;overflow-y:auto;font-family:var(--mono);font-size:11.5px;line-height:1.8;}
.tl{display:flex;gap:10px;margin-bottom:3px;}
.tl-t{color:#64748B;width:54px;flex-shrink:0;font-size:10.5px;padding-top:1px;}
.tl-sys{color:#CBD5E1;}
.tl-auth{color:#38BDF8;}
.tl-think{color:#94A3B8;}
.tl-call{color:#FBBF24;}
.tl-ret{color:#34D399;}
.tl-done{color:#fff;font-weight:600;}
.detail-sec{padding:14px 16px;border-bottom:1px solid var(--dborder);}
.detail-sec:last-child{border-bottom:none;}
.dlbl{font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:0.08em;color:#94A3B8;text-transform:uppercase;margin-bottom:10px;}
.drow{display:flex;justify-content:space-between;margin-bottom:6px;gap:8px;}
.dk{font-size:12px;color:#94A3B8;}
.dv{font-family:var(--mono);font-size:11.5px;color:#E2E8F0;text-align:right;}
.dv.gold{color:#FBBF24;}
.dv.green{color:#34D399;}
.dv.blue{color:#38BDF8;}
.dv.red{color:#F87171;}
.tok-wrap{margin-top:8px;}
.tok-row{display:flex;justify-content:space-between;font-size:11.5px;color:#94A3B8;margin-bottom:4px;}
.tok-track{height:6px;background:var(--dborder);border-radius:3px;overflow:hidden;}
.tok-fill{height:100%;border-radius:3px;transition:width .5s;}
.span-panel{margin-bottom:16px;}
.span-body{padding:16px;overflow-x:auto;}
.span-row{display:flex;align-items:center;margin-bottom:6px;min-width:520px;}
.span-info{width:230px;flex-shrink:0;}
.span-name{font-family:var(--mono);font-size:11.5px;color:#E2E8F0;}
.span-svc{font-family:var(--mono);font-size:10px;font-weight:500;}
.span-track{flex:1;position:relative;height:22px;}
.span-bar{position:absolute;height:16px;top:3px;border-radius:3px;display:flex;align-items:center;padding:0 6px;font-family:var(--mono);font-size:9.5px;color:#090D16;font-weight:600;overflow:hidden;white-space:nowrap;min-width:4px;}
.span-dur{font-family:var(--mono);font-size:10.5px;color:#94A3B8;width:52px;text-align:right;flex-shrink:0;}
.attr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;padding:16px;}
.attr-card{background:var(--dbg);border:1px solid var(--dborder);border-radius:6px;padding:12px;}
.attr-name{font-family:var(--mono);font-size:11px;font-weight:600;margin-bottom:6px;}
.attr-row{display:flex;justify-content:space-between;margin-bottom:3px;}
.attr-k{font-size:11px;color:#94A3B8;}
.attr-v{font-family:var(--mono);font-size:11px;color:#E2E8F0;}

/* ───── Footer ───── */
footer{max-width:1280px;margin:0 auto;padding:56px 36px 36px;border-top:1px solid var(--line);display:flex;flex-wrap:wrap;justify-content:space-between;gap:36px;}
.footer-logo{font-family:var(--display);font-size:18px;font-weight:700;letter-spacing:-0.025em;margin-bottom:6px;color:var(--ink);}
.footer-logo span{color:var(--accent);}
.footer-tag{font-size:13px;color:var(--mid);}
.footer-col-hdr{font-family:var(--mono);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink);margin-bottom:12px;}
.footer-links{display:flex;flex-direction:column;gap:8px;}
.fl{font-size:13px;color:var(--mid);cursor:pointer;transition:color .16s;text-decoration:none;}
.fl:hover{color:var(--accent);}
.footer-bar{max-width:1280px;margin:0 auto;padding:20px 36px;border-top:1px solid var(--line);display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;font-family:var(--mono);font-size:11.5px;color:var(--mid);}

@media(max-width:1100px){.hero-container,.arch-split{grid-template-columns:1fr;}.chart-row-3{grid-template-columns:1fr 1fr;}.trace-layout{grid-template-columns:1fr;}}
@media(max-width:900px){.agent-grid,.uc-grid{grid-template-columns:1fr;}.workspace{display:flex;flex-direction:column;overflow-y:auto;}.req-pane{border-right:none;border-bottom:1px solid var(--dborder);flex-shrink:0;}.res-pane{flex-shrink:0;min-height:240px;}.hero-stats{grid-template-columns:1fr 1fr;}}
@media(max-width:768px){.nav{padding:0 18px;}.nav-links{display:none;}.tab-bar{padding:0 18px;overflow-x:auto;}.sec,.mcp-sec,.uc-sec,.tools-sec,.arch-full{padding:48px 18px;}.hero{padding:92px 18px 48px;}footer,.footer-bar{padding-left:18px;padding-right:18px;}.srow{grid-template-columns:85px 1fr 65px 60px;}.srow>*:nth-child(n+5){display:none;}}
`;

export default function App() {
  const { token, setToken }        = useAuth();
  const [apiMode, setApiModeState] = useState(() => getApiMode());
  const [activeTab, setActiveTab]  = useState("channel");
  const tabBarRef                  = useRef(null);
  const [modal, setModal]          = useState(null);
  const [modalTab, setModalTab]    = useState("ep");
  const [showConsole, setShowConsole] = useState(false);
  const [showObs, setShowObs]      = useState(false);

  /* Progressive disclosure states */
  const [heroLayerIdx, setHeroLayerIdx] = useState(0);
  const [activePillar, setActivePillar] = useState(0);
  const [svcViewMode, setSvcViewMode]   = useState("domains"); // "domains" | "tools" | "both"
  const [domCategory, setDomCategory]   = useState("all");
  const [expandedSvcTool, setExpandedSvcTool] = useState(null);
  const [archSubTab, setArchSubTab]     = useState("stack"); // "stack" | "bian" | "standards"
  const [selArchLayer, setSelArchLayer] = useState(0);
  const [showReqHeaders, setShowReqHeaders] = useState(false);

  const [termIdx, setTermIdx]      = useState(0);
  const termRef                    = useRef(null);
  const [ucStep, setUcStep]        = useState(0);
  const [selBuild, setSelBuild]    = useState(AGENT_BUILDS[0].id);

  /* console state */
  const [cDomain, setCDomain]   = useState(DOMAINS[0].id);
  const [cEpIdx, setCEpIdx]     = useState(0);
  const [cPath, setCPath]       = useState(() => resolveEndpointPath(DOMAINS[0].endpoints[0].p));
  const [cBody, setCBody]       = useState("");
  const [cResp, setCResp]       = useState(null);
  const [cStatus, setCStatus]   = useState("200 OK");
  const [cOk, setCOk]           = useState(true);
  const [cFapiId, setCFapiId]   = useState("3f785c72-b4a1-4b9c-9221-8d6c3f0e1294");
  const [cLoading, setCLoading] = useState(false);
  const [cTime, setCTime]       = useState(null);
  const [cCopied, setCCopied]   = useState(null);
  const [lastConsoleSessId, setLastConsoleSessId] = useState(null);

  /* observability state */
  const [obsPaused, setObsPaused]   = useState(false);
  const [obsInitTab, setObsInitTab] = useState("metrics");
  const [obsInitSessId, setObsInitSessId] = useState(null);
  const [sessions, setSessions]     = useState(() => Array.from({ length: 12 }, (_, i) => makeSession(i + 1)));
  const [history, setHistory]       = useState(makeHistory);
  const sessCounter                 = useRef(13);

  function toggleMode(nextMode) {
    setApiMode(nextMode);
    setApiModeState(nextMode);
  }

  function switchTab(id) {
    setActiveTab(id);
    window.scrollTo({ top: (tabBarRef.current?.offsetTop ?? 0) - 64, behavior: "smooth" });
  }

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") {
        if (modal) setModal(null);
        else if (showConsole) setShowConsole(false);
        else if (showObs) setShowObs(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modal, showConsole, showObs]);

  useEffect(() => {
    if (termIdx < CONVERSATION.length) {
      const t = setTimeout(() => setTermIdx(i => i + 1), 620);
      return () => clearTimeout(t);
    }
  }, [termIdx]);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [termIdx]);

  useEffect(() => {
    if (obsPaused || !showObs) return;
    const t = setInterval(() => {
      setSessions(p => [makeSession(sessCounter.current++), ...p].slice(0, 40));
      setHistory(p => {
        const pt = {
          t: new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }),
          latency: rnd(180, 900),
          inputTok: rnd(1200, 4000),
          outputTok: rnd(200, 1600),
          toolCalls: rnd(2, 10),
          errors: rnd(0, 2),
          sessions: rnd(1, 6),
        };
        return [...p.slice(-19), pt];
      });
    }, 2400);
    return () => clearInterval(t);
  }, [obsPaused, showObs]);

  const cDom = DOMAINS.find(d => d.id === cDomain);
  const cEp  = cDom?.endpoints[cEpIdx];

  function pickDomain(id) {
    const d = DOMAINS.find(x => x.id === id);
    const ep = d.endpoints[0];
    setCDomain(id);
    setCEpIdx(0);
    setCResp(null);
    setCPath(resolveEndpointPath(ep.p));
    setCBody(defaultBody(ep.m, ep.p));
  }

  function pickEp(i) {
    const ep = cDom.endpoints[i];
    setCEpIdx(i);
    setCResp(null);
    setCPath(resolveEndpointPath(ep.p));
    setCBody(defaultBody(ep.m, ep.p));
  }

  function openConsole() {
    const ep = cDom?.endpoints[cEpIdx] || DOMAINS[0].endpoints[0];
    setCPath(resolveEndpointPath(ep.p));
    setCBody(defaultBody(ep.m, ep.p));
    setShowConsole(true);
  }

  function openConsoleAt(domainId, epIdx = 0) {
    const d = DOMAINS.find(x => x.id === domainId) || DOMAINS[0];
    const safeIdx = d.endpoints[epIdx] ? epIdx : 0;
    const ep = d.endpoints[safeIdx];
    setModal(null);
    setCDomain(d.id);
    setCEpIdx(safeIdx);
    setCResp(null);
    setCPath(resolveEndpointPath(ep.p));
    setCBody(defaultBody(ep.m, ep.p));
    setShowConsole(true);
  }

  function openConsoleForTool(toolName) {
    const TOOL_EP_MAP = {
      get_party:          ["party", 0],
      get_accounts:       ["accounts", 0],
      get_balance:        ["accounts", 2],
      get_transactions:   ["transactions", 0],
      initiate_payment:   ["payments", 0],
      get_payment_status: ["payments", 2],
      get_loan_details:   ["lending", 1],
      apply_for_loan:     ["lending", 0],
      get_card_details:   ["cards", 2],
      block_card:         ["cards", 4],
      get_portfolio:      ["investments", 0],
      place_order:        ["investments", 2],
      run_aml_screen:     ["compliance", 2],
      subscribe_events:   ["notifications", 2],
    };
    const [domId, epIdx] = TOOL_EP_MAP[toolName] || ["accounts", 0];
    openConsoleAt(domId, epIdx);
  }

  function openConsoleForUcStep(stepIdx) {
    const UC_EP_MAP = [
      ["party", 0],
      ["transactions", 0],
      ["savings", 1],
      ["accounts", 2],
      ["payments", 0],
      ["notifications", 2],
    ];
    const [domId, epIdx] = UC_EP_MAP[stepIdx] || ["party", 0];
    openConsoleAt(domId, epIdx);
  }

  function copyToClipboard(key, text) {
    navigator.clipboard.writeText(text);
    setCCopied(key);
    setTimeout(() => setCCopied(null), 1600);
  }

  async function sendReq() {
    if (!cEp) return;
    setCLoading(true);
    setCResp(null);

    let parsedBody = null;
    if (cEp.m !== "GET" && cBody.trim()) {
      try {
        parsedBody = JSON.parse(cBody);
      } catch (err) {
        setCTime(1);
        setCStatus("400 Bad Request");
        setCOk(false);
        setCResp({ error: "InvalidJSON", message: err.message });
        setCLoading(false);
        return;
      }
    }

    const res = await apiConsoleRequest(cEp.m, cPath, parsedBody, token, apiMode);
    setCTime(res.latencyMs);
    setCStatus(`${res.status} ${res.statusText}`);
    setCOk(res.ok);
    if (res.fapiId) setCFapiId(res.fapiId);
    setCResp(res.data);
    setCLoading(false);

    const matchedTool = TOOLS.find(t => t.domain === cDomain) ?? TOOLS[0];
    const newId = `SES-${String(sessCounter.current++).padStart(5, "0")}`;
    const fapiId = res.fapiId || cFapiId || makeHex(16);
    const consoleSess = {
      id: newId,
      traceId: fapiId.replace(/-/g, ""),
      fapiInteractionId: fapiId,
      prevHash: makeHex(64),
      rowHash: makeHex(64),
      customer: apiMode === "live" ? "Aria Chen (PAR-ARIA · Live)" : "Aria Chen (PAR-ARIA · Console)",
      model: OBS_MODELS[0],
      tool: matchedTool.name,
      latency: res.latencyMs,
      inputTok: rnd(200, 600),
      outputTok: rnd(40, 180),
      toolCalls: 1,
      status: res.ok ? "success" : "error",
      ts: Date.now(),
      source: "console",
    };
    setLastConsoleSessId(newId);
    setSessions(p => [consoleSess, ...p].slice(0, 40));
    setHistory(p => {
      const pt = {
        t: new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }),
        latency: res.latencyMs,
        inputTok: consoleSess.inputTok,
        outputTok: consoleSess.outputTok,
        toolCalls: 1,
        errors: res.ok ? 0 : 1,
        sessions: 1,
      };
      return [...p.slice(-19), pt];
    });
  }

  const modalDomain = modal ? DOMAINS.find(d => d.id === modal) : null;
  const authDisplayValue = token ? (token.startsWith("Bearer ") ? token : `Bearer ${token}`) : "Bearer demo-token";
  const filteredDomains = DOMAINS.filter(d => {
    const allowed = DOMAIN_CATEGORIES[domCategory];
    return !allowed || allowed.includes(d.id);
  });
  const filteredTools = TOOLS.filter(t => {
    const allowed = DOMAIN_CATEGORIES[domCategory];
    return !allowed || allowed.includes(t.domain);
  });

  return (
    <>
      <style>{CSS}</style>

      {/* ───── TOP NAVBAR ───── */}
      <nav className="nav">
        <div className="nav-brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <div className="nav-mark">A<span>B</span></div>
          <div className="nav-logo">agent<span>BANK</span></div>
        </div>
        <div className="nav-links">
          <span className="nl" onClick={() => switchTab("channel")}>AI Channel</span>
          <span className="nl" onClick={() => switchTab("usecase")}>Use Case</span>
          <span className="nl" onClick={() => switchTab("services")}>Services &amp; APIs</span>
          <span className="nl" onClick={() => switchTab("builds")}>Agent Builds</span>
          <span className="nl" onClick={() => switchTab("arch")}>Architecture</span>
          <span className="nl" onClick={() => switchTab("mcp")}>MCP Server</span>
          <span className="nl" onClick={() => switchTab("sdk")}>SDK</span>
          <a className="nl" href="/agentbank-executive-visuals.html" target="_blank" rel="noreferrer">Exec Briefing ↗</a>
          <a className="nl" href="https://github.com/watsongm/agentbank" target="_blank" rel="noreferrer">GitHub ↗</a>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="nav-btn nav-btn-outline"
            onClick={() => { setObsInitTab("metrics"); setObsInitSessId(null); setShowObs(true); }}
          >
            Observability
          </button>
          <button className="nav-btn" onClick={openConsole}>API Console →</button>
        </div>
      </nav>

      {/* ───── 2-COLUMN HERO WITH INTERACTIVE CORE SCHEMATIC ───── */}
      <section className="hero" id="top">
        <div className="hero-grid" />
        <div className="hero-container">
          <div>
            <div className="hero-tag">
              <div className="hero-dot" />
              AGENTBANK CORE · BIAN v12 · OPEN BANKING v3.1 · FAPI 2.0 · MCP 1.0
            </div>
            <h1>The Core Banking<br />Platform Built for<br /><em>AI Agents</em></h1>
            <p className="hero-p">
              agentBANK combines the UK Open Banking v3.1 API standard with the BIAN v12 Service Domain capability model — exposing 10 core banking domains and 14 typed primitives to AI agents as a cryptographically audited customer channel.
            </p>
            <div className="btn-row">
              <button className="btn-dark" onClick={() => switchTab("usecase")}>Explore Agent Use Case</button>
              <button className="btn-light" onClick={openConsole}>Open API Console →</button>
              <a className="btn-light" href="/agentbank-executive-visuals.html" target="_blank" rel="noreferrer">Executive Briefing ↗</a>
            </div>
            <div className="hero-stats">
              {[
                ["10", "BIAN v12 Domains"],
                ["44", "OpenAPI Endpoints"],
                ["14", "MCP & SDK Tools"],
                ["FAPI 2.0", "DPoP + Hash Audit"],
              ].map(([n, l]) => (
                <div key={l} className="stat-card">
                  <div className="stat-n">{n}</div>
                  <div className="stat-l">{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Interactive 4-Layer Architecture Schematic */}
          <div className="hero-schematic">
            <div className="hs-hdr">
              <span className="hs-title">Interactive Core Stack Schematic</span>
              <span className="hs-hint">Click any layer to surface specs</span>
            </div>
            <div className="hs-layers">
              {HERO_LAYERS.map((layer, idx) => {
                const isAct = heroLayerIdx === idx;
                return (
                  <div
                    key={layer.code}
                    className={`hs-layer ${isAct ? "active" : ""}`}
                    onClick={() => setHeroLayerIdx(idx)}
                  >
                    <div className="hs-l-top">
                      <div className="hs-l-name">
                        <span className="hs-l-code">{layer.code}</span>
                        <span>{layer.name}</span>
                      </div>
                      <span className="hs-l-tag">{layer.tag}</span>
                    </div>
                    <div className="hs-l-sum">{layer.summary}</div>
                    {isAct && (
                      <div className="hs-l-drawer">
                        <div className="hs-l-det">{layer.detail}</div>
                        <button
                          type="button"
                          className="hs-l-btn"
                          onClick={e => {
                            e.stopPropagation();
                            if (layer.targetAction === "obs") {
                              setObsInitTab("metrics");
                              setObsInitSessId(null);
                              setShowObs(true);
                            } else if (layer.targetTab) {
                              switchTab(layer.targetTab);
                            }
                          }}
                        >
                          {layer.ctaLabel}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ───── STICKY NAVIGATION TABS ───── */}
      <div className="tab-bar" ref={tabBarRef}>
        {[
          { id: "channel",  label: "AI Channel" },
          { id: "usecase",  label: "Use Case" },
          { id: "services", label: "Services & APIs" },
          { id: "builds",   label: "Agent Builds" },
          { id: "arch",     label: "Architecture" },
          { id: "mcp",      label: "MCP Server" },
          { id: "sdk",      label: "SDK" },
        ].map(t => (
          <button
            key={t.id}
            className={`tab-btn ${activeTab === t.id ? "on" : ""}`}
            onClick={() => switchTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ───── TAB 1: AI CHANNEL (PROGRESSIVE ACCORDION + LIVE TERMINAL) ───── */}
      {activeTab === "channel" && (
        <section className="sec" id="agent">
          <div className="sec-inner">
            <div className="sec-hdr-split">
              <div>
                <span className="sec-tag">PRIMARY AGENT CHANNEL</span>
                <h2 className="sec-h">AI Agents as First-Class Banking Customers</h2>
                <p className="sec-p" style={{ marginBottom: 0 }}>
                  agentBANK exposes a deterministic tool-use layer allowing AI agents to authenticate, reason, and transact autonomously under explicit FAPI 2.0 customer consent.
                </p>
              </div>
              <div className="sec-meta-pill">
                <span>CLICK ANY PILLAR TO INSPECT SPECIFICATION</span>
              </div>
            </div>

            <div className="agent-grid">
              <div className="agent-feats">
                {CHANNEL_PILLARS.map((f, idx) => {
                  const isAct = activePillar === idx;
                  return (
                    <div
                      key={f.code}
                      className={`feat ${isAct ? "active" : ""}`}
                      onClick={() => setActivePillar(idx)}
                    >
                      <div className="feat-top">
                        <div className="feat-left">
                          <span className="feat-code">{f.code}</span>
                          <div className="feat-h">{f.h}</div>
                        </div>
                        <span className="feat-std">{f.std}</span>
                      </div>
                      {isAct && (
                        <div className="feat-body">
                          <div className="feat-p">{f.p}</div>
                          <div className="feat-spec">{f.spec}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="term">
                <div className="term-bar">
                  <div className="tdot" style={{ background: "#EF4444" }} />
                  <div className="tdot" style={{ background: "#F59E0B" }} />
                  <div className="tdot" style={{ background: "#10B981" }} />
                  <span className="term-lbl">AGENTBANK-AGENT-RUNTIME v2.4 · PAR-ARIA</span>
                  <button
                    style={{
                      marginLeft: "auto",
                      fontFamily: "var(--mono)",
                      fontSize: 10.5,
                      padding: "4px 10px",
                      borderRadius: 4,
                      background: "rgba(255,255,255,.06)",
                      border: "1px solid rgba(255,255,255,.15)",
                      color: "#CBD5E1",
                      cursor: "pointer",
                    }}
                    onClick={() => setTermIdx(0)}
                  >
                    ↺ REPLAY TRACE
                  </button>
                </div>
                <div className="term-body" ref={termRef}>
                  {CONVERSATION.slice(0, termIdx).map((m, i) => (
                    <div key={i}>
                      {m.role === "agent" && (
                        <div className="tm-agent">
                          <span className="tm-lbl">AGENT »</span>
                          {m.text}
                        </div>
                      )}
                      {m.role === "call" && (
                        <div className="tm-call">
                          <span className="tm-tlbl">CALL »</span>
                          <span className="tm-tool">{m.tool}()</span>
                          <span className="tm-params"> ({JSON.stringify(m.params).slice(0, 58)}…)</span>
                        </div>
                      )}
                      {m.role === "result" && (
                        <div className="tm-res">
                          <div className="tm-rlbl">BIAN / OBIE RESPONSE</div>
                          <div className="tm-rval">{JSON.stringify(m.result, null, 1).slice(0, 180)}</div>
                        </div>
                      )}
                    </div>
                  ))}
                  {termIdx < CONVERSATION.length && (
                    <span style={{ color: "#38BDF8", animation: "pulse 1s infinite" }}>▌</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ───── TAB 2: USE CASE (SMART SAVINGS AGENT) ───── */}
      {activeTab === "usecase" && (
        <section className="uc-sec" id="usecase">
          <div className="sec-inner">
            <div className="sec-hdr-split">
              <div>
                <span className="sec-tag">END-TO-END WORKFLOW · 6 BIAN STEPS</span>
                <h2 className="sec-h">Smart Savings Sweep Agent</h2>
                <p className="sec-p" style={{ marginBottom: 0 }}>
                  A worked execution trace: an AI agent authenticates for Aria Chen (<code className="inline-code">PAR-ARIA</code>), analyses 90 days of transactions on <code className="inline-code">ACC-1829</code>, calculates a safe £120 sweep to <code className="inline-code">ACC-2041</code>, and subscribes to future salary webhooks.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="filter-chip"
                  disabled={ucStep === 0}
                  onClick={() => setUcStep(s => Math.max(0, s - 1))}
                >
                  ← Prev Step
                </button>
                <button
                  type="button"
                  className="filter-chip"
                  disabled={ucStep === AGENT_STEPS.length - 1}
                  onClick={() => setUcStep(s => Math.min(AGENT_STEPS.length - 1, s + 1))}
                >
                  Next Step →
                </button>
              </div>
            </div>

            <div className="uc-grid">
              <div className="uc-steps">
                {AGENT_STEPS.map((s, i) => {
                  const isAct = ucStep === i;
                  const isDone = ucStep > i;
                  return (
                    <div
                      key={s.id}
                      className={`uc-step ${isAct ? "active" : ""} ${isDone ? "done" : ""}`}
                      onClick={() => setUcStep(i)}
                    >
                      <div className="step-circle">{isDone ? "✓" : `0${s.id}`}</div>
                      <div className="step-body">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <div className="step-title">{s.title}</div>
                          <span className="step-dom" style={{ color: s.color }}>{s.icon} · {s.domain}</span>
                        </div>
                        {isAct && <div className="step-desc">{s.desc}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="code-box">
                <div className="code-topbar">
                  <div className="cdots">
                    <div className="cdot" style={{ background: "#EF4444" }} />
                    <div className="cdot" style={{ background: "#F59E0B" }} />
                    <div className="cdot" style={{ background: "#10B981" }} />
                  </div>
                  <span className="code-lbl">
                    STEP 0{AGENT_STEPS[ucStep].id} — {AGENT_STEPS[ucStep].title.toUpperCase()}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      className="code-badge"
                      style={{ borderColor: AGENT_STEPS[ucStep].color, color: "#93C5FD" }}
                    >
                      {AGENT_STEPS[ucStep].icon} · {AGENT_STEPS[ucStep].domain}
                    </span>
                    <button
                      type="button"
                      onClick={() => openConsoleForUcStep(ucStep)}
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 10.5,
                        fontWeight: 600,
                        padding: "5px 11px",
                        borderRadius: 5,
                        background: "#2563EB",
                        border: "none",
                        color: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      Run Step in API Console →
                    </button>
                  </div>
                </div>
                <div className="code-scroll">
                  <pre>{AGENT_STEPS[ucStep].code}</pre>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ───── TAB 3: SERVICES & APIS (SEGMENTED + FILTERABLE PROGRESSIVE DISCLOSURE) ───── */}
      {activeTab === "services" && (
        <section className="sec" id="services">
          <div className="sec-inner">
            <div className="sec-hdr-split" style={{ marginBottom: 24 }}>
              <div>
                <span className="sec-tag">BIAN v12 SERVICE LANDSCAPE &amp; TOOL REGISTRY</span>
                <h2 className="sec-h">Complete Banking Capability Model</h2>
                <p className="sec-p" style={{ marginBottom: 0 }}>
                  Every domain implements both Open Banking v3.1 and the canonical BIAN v12 Service Domain interface. Filter by banking vertical or switch between Service Domains and Agent Tool Primitives.
                </p>
              </div>
            </div>

            {/* Progressive Disclosure Filter & View Switcher Bar */}
            <div className="filter-bar">
              <div className="seg-group" role="tablist" aria-label="Services view switcher">
                <button
                  type="button"
                  className={`seg-btn ${svcViewMode === "domains" ? "on" : ""}`}
                  onClick={() => setSvcViewMode("domains")}
                >
                  10 BIAN Service Domains ({filteredDomains.length})
                </button>
                <button
                  type="button"
                  className={`seg-btn ${svcViewMode === "tools" ? "on" : ""}`}
                  onClick={() => setSvcViewMode("tools")}
                >
                  14 Agent Tool Primitives ({filteredTools.length})
                </button>
                <button
                  type="button"
                  className={`seg-btn ${svcViewMode === "both" ? "on" : ""}`}
                  onClick={() => setSvcViewMode("both")}
                >
                  Combined View
                </button>
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[
                  ["all", "All Verticals"],
                  ["retail", "Core Retail (Party / Accts / Savings)"],
                  ["payments", "Payments & Transactions"],
                  ["credit", "Lending & Cards"],
                  ["wealth", "Wealth, Compliance & Events"],
                ].map(([id, lbl]) => (
                  <button
                    key={id}
                    type="button"
                    className={`filter-chip ${domCategory === id ? "on" : ""}`}
                    onClick={() => setDomCategory(id)}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {/* 10 BIAN Domains Grid */}
            {(svcViewMode === "domains" || svcViewMode === "both") && (
              <div className="svc-grid" style={{ marginBottom: svcViewMode === "both" ? 56 : 0 }}>
                {filteredDomains.map(d => (
                  <div
                    key={d.id}
                    className="svc-card"
                    onClick={() => { setModal(d.id); setModalTab("ep"); }}
                  >
                    <div>
                      <div className="svc-card-top">
                        <span className="dom-code-pill" style={{ color: d.color, borderColor: d.color + "44", background: d.color + "10" }}>
                          {d.icon}
                        </span>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>
                          Inspect Domain →
                        </span>
                      </div>
                      <div className="svc-name">{d.name}</div>
                      <div className="svc-bian">{d.bian}</div>
                      <div className="svc-desc">{d.desc}</div>
                    </div>
                    <div className="svc-meta">
                      <span><strong>{d.endpoints.length}</strong> REST endpoints</span>
                      <span><strong>{d.caps.length}</strong> agent capabilities</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 14 Agent Tool Primitives Grid */}
            {(svcViewMode === "tools" || svcViewMode === "both") && (
              <div>
                {svcViewMode === "both" && (
                  <div style={{ marginBottom: 20 }}>
                    <span className="sec-tag">AGENT TOOL REGISTRY</span>
                    <h3 className="sec-h" style={{ fontSize: 26, marginBottom: 6 }}>14 Agent-Callable Tool Primitives</h3>
                  </div>
                )}
                <div className="tools-grid">
                  {filteredTools.map(t => {
                    const dom = DOMAINS.find(d => d.id === t.domain);
                    const isExp = expandedSvcTool === t.name;
                    return (
                      <div key={t.name} className="tool-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <div className="tool-name" style={{ color: dom?.color || "var(--accent)" }}>{t.name}()</div>
                            <span className="dom-code-pill">{dom?.icon}</span>
                          </div>
                          <div className="tool-dom">{dom?.bian}</div>
                          <div className="tool-desc">{t.desc}</div>
                          {isExp && (
                            <div className="tool-params">
                              {t.params.map(p => (
                                <span key={p} className="tool-p">{p}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
                          <button
                            type="button"
                            onClick={() => setExpandedSvcTool(isExp ? null : t.name)}
                            style={{
                              fontFamily: "var(--mono)",
                              fontSize: 10.5,
                              background: "none",
                              border: "none",
                              color: "var(--mid)",
                              cursor: "pointer",
                            }}
                          >
                            {isExp ? "Hide Params ▴" : `Params (${t.params.length}) ▾`}
                          </button>
                          <button
                            type="button"
                            className="try-tool-btn"
                            onClick={() => openConsoleForTool(t.name)}
                          >
                            Try Tool in Console →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ───── TAB 4: AGENT BUILDS ───── */}
      {activeTab === "builds" && (() => {
        const build = AGENT_BUILDS.find(b => b.id === selBuild);
        return (
          <section className="sec" id="builds">
            <div className="sec-inner">
              <div className="sec-hdr-split">
                <div>
                  <span className="sec-tag">REFERENCE BLUEPRINTS · 5 RECIPES</span>
                  <h2 className="sec-h">Composable Agent Build Recipes</h2>
                  <p className="sec-p" style={{ marginBottom: 0 }}>
                    Production-ready blueprints wiring agentBANK primitives into autonomous workflows across lending, fraud prevention, wealth management, and bill automation.
                  </p>
                </div>
              </div>

              <div className="builds-grid">
                {AGENT_BUILDS.map(b => (
                  <div
                    key={b.id}
                    className={`build-card ${selBuild === b.id ? "active" : ""}`}
                    onClick={() => setSelBuild(b.id)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span className="dom-code-pill" style={{ color: b.color }}>{b.icon}</span>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mid)" }}>{b.tags.length} domains</span>
                    </div>
                    <div className="build-card-name">{b.name}</div>
                    <div className="build-card-desc">{b.desc}</div>
                    <div className="build-tags">
                      {b.tags.map(t => (
                        <span key={t} className="build-tag">{t}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {build && (
                <div className="build-viewer">
                  <div className="build-viewer-bar">
                    <span className="build-viewer-title">{build.icon} · {build.name.toUpperCase()}</span>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span className="build-viewer-badge" style={{ borderColor: "#3B82F6", color: "#93C5FD" }}>
                        Primary Domain: {build.tags[0]}
                      </span>
                      <button
                        type="button"
                        onClick={() => openConsoleAt(build.tags[0], 0)}
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 10.5,
                          fontWeight: 600,
                          padding: "5px 11px",
                          borderRadius: 5,
                          background: "#2563EB",
                          color: "#fff",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Test {build.tags[0]} in API Console →
                      </button>
                    </div>
                  </div>
                  <div className="build-viewer-code">
                    <pre>{build.code}</pre>
                  </div>
                </div>
              )}
            </div>
          </section>
        );
      })()}

      {/* ───── TAB 5: ARCHITECTURE (PROGRESSIVE 3-SUB-TAB INSPECTOR) ───── */}
      {activeTab === "arch" && (
        <section className="arch-full" id="arch">
          <div className="sec-inner">
            <div className="sec-hdr-split">
              <div>
                <span className="sec-tag" style={{ background: "rgba(37,99,235,0.2)", borderColor: "rgba(59,130,246,0.4)", color: "#93C5FD" }}>
                  REFERENCE ARCHITECTURE
                </span>
                <h2 className="sec-h" style={{ color: "#F8FAFC" }}>agentBANK System Architecture</h2>
                <p style={{ fontSize: 15.5, color: "#94A3B8", lineHeight: 1.65, maxWidth: 640 }}>
                  Explore how AI clients, the Model Context Protocol server, the FAPI 2.0 security gateway, and the 10 BIAN v12 Service Domains interact from natural language intent to PostgreSQL ledger settlement.
                </p>
              </div>

              {/* Sub-Tab Selector for Progressive Disclosure */}
              <div style={{ display: "inline-flex", background: "#0F172A", padding: 4, borderRadius: 8, border: "1px solid #1E293B" }}>
                {[
                  ["stack", "01 · Interactive 7-Layer Stack"],
                  ["bian", "02 · BIAN Capability Matrix"],
                  ["standards", "03 · Standards & Security"],
                ].map(([id, lbl]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setArchSubTab(id)}
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 11.5,
                      fontWeight: 600,
                      padding: "8px 14px",
                      borderRadius: 6,
                      border: "none",
                      background: archSubTab === id ? "#2563EB" : "transparent",
                      color: archSubTab === id ? "#fff" : "#94A3B8",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-Tab 1: Interactive 7-Layer Stack + Inspector */}
            {archSubTab === "stack" && (() => {
              const activeL = ARCH_STACK_LAYERS[selArchLayer] || ARCH_STACK_LAYERS[0];
              return (
                <div className="arch-split">
                  <div className="arch-stack">
                    {ARCH_STACK_LAYERS.map((row, idx) => (
                      <div
                        key={row.l}
                        className={`arch-row-card ${selArchLayer === idx ? "active" : ""}`}
                        onClick={() => setSelArchLayer(idx)}
                      >
                        <div>
                          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "#64748B" }}>{row.code}</div>
                          <div className="arch-lbl">{row.l}</div>
                        </div>
                        <div className="arch-comps">
                          {row.chips.map(ch => (
                            <span key={ch.t} className={`arch-chip ${ch.c}`}>{ch.t}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <aside className="arch-inspector">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color: "#60A5FA" }}>
                        {activeL.code} · {activeL.l}
                      </span>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, padding: "2px 8px", borderRadius: 4, background: "rgba(56,189,248,0.12)", color: "#38BDF8" }}>
                        {activeL.std}
                      </span>
                    </div>
                    <h3 style={{ fontFamily: "var(--display)", fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 10 }}>
                      {activeL.l} Specification
                    </h3>
                    <p style={{ fontSize: 13.5, color: "#94A3B8", lineHeight: 1.6, marginBottom: 20 }}>
                      {activeL.summary}
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                      {activeL.specs.map(([k, v]) => (
                        <div key={k} style={{ padding: "10px 12px", borderRadius: 6, background: "#090D16", border: "1px solid #1E293B", display: "flex", justifyContent: "space-between", gap: 12 }}>
                          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "#64748B" }}>{k}</span>
                          <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "#E2E8F0", textAlign: "right" }}>{v}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        type="button"
                        className="nav-btn"
                        onClick={openConsole}
                      >
                        Test in API Console →
                      </button>
                      <button
                        type="button"
                        className="console-x"
                        onClick={() => setShowObs(true)}
                      >
                        Inspect Live Telemetry →
                      </button>
                    </div>
                  </aside>
                </div>
              );
            })()}

            {/* Sub-Tab 2: BIAN Service Domain Matrix */}
            {archSubTab === "bian" && (
              <div className="arch-domains">
                {DOMAINS.map(d => (
                  <div
                    key={d.id}
                    className="arch-domain"
                    onClick={() => { setModal(d.id); setModalTab("ep"); }}
                  >
                    <div className="arch-domain-top">
                      <div className="arch-domain-name">{d.name}</div>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, padding: "2px 7px", borderRadius: 4, background: "rgba(59,130,246,0.15)", color: "#93C5FD" }}>
                        {d.icon}
                      </span>
                    </div>
                    <div className="arch-domain-bian">{d.bian}</div>
                    <div className="arch-domain-divider" />
                    <div className="arch-domain-caps">
                      {d.caps.map(c => (
                        <div key={c} className="arch-domain-cap">{c}</div>
                      ))}
                    </div>
                    <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "rgba(255,255,255,.05)", color: "#94A3B8" }}>
                        {d.endpoints.length} endpoints
                      </span>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "rgba(56,189,248,.1)", color: "#38BDF8" }}>
                        {d.caps.length} capabilities
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Sub-Tab 3: Standards Compliance */}
            {archSubTab === "standards" && (
              <div className="arch-standards">
                {[
                  { name: "Open Banking (OBIE)",       ver: "v3.1.11",  desc: "UK Open Banking standard covering Accounts, Domestic/International Payments, Statements, and Event Notification resource types." },
                  { name: "BIAN Service Domain Model", ver: "v12",      desc: "10 BIAN service domains providing a canonical banking capability model mapped to every REST endpoint and tool." },
                  { name: "Model Context Protocol",    ver: "MCP 1.0",  desc: "Stdio JSON-RPC 2.0 server exposing all 14 agentBANK tools to Claude Desktop, Cursor, and any MCP host." },
                  { name: "Financial-grade API",       ver: "FAPI 2.0", desc: "Security profile for agent authentication: PAR, RFC 9449 DPoP proof replay protection, and consent scopes." },
                  { name: "ISO 20022",                 ver: "2019",     desc: "Structured financial message format for domestic and international payment initiation payloads." },
                  { name: "OAuth 2.0 / OIDC",          ver: "RFC 6749", desc: "Authorization framework and identity layer underpinning the `/open-banking/v3.1/oauth/token` consent flow." },
                ].map(s => (
                  <div key={s.name} className="arch-std">
                    <div className="arch-std-name">{s.name}</div>
                    <div className="arch-std-ver">{s.ver}</div>
                    <div className="arch-std-desc">{s.desc}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ───── TAB 6 & 7: MCP SERVER & SDK ───── */}
      {activeTab === "mcp" && <McpTab tools={TOOLS} domains={DOMAINS} onTryTool={openConsoleForTool} />}
      {activeTab === "sdk" && <SdkTab onTryTool={openConsoleForTool} />}

      {/* ───── FOOTER ───── */}
      <footer>
        <div>
          <div className="footer-logo">agent<span>BANK</span></div>
          <div className="footer-tag">BIAN v12 · Open Banking v3.1 · AI-Native Reference Core Banking Platform</div>
        </div>
        <div>
          <div className="footer-col-hdr">API Standards</div>
          <div className="footer-links">
            <a className="fl" href="https://standards.openbanking.org.uk/api-specifications/" target="_blank" rel="noreferrer">Open Banking v3.1 ↗</a>
            <a className="fl" href="https://bian.org/servicelandscape/" target="_blank" rel="noreferrer">BIAN v12 ↗</a>
            <a className="fl" href="https://openid.net/specs/fapi-2_0-baseline.html" target="_blank" rel="noreferrer">FAPI 2.0 ↗</a>
            <a className="fl" href="https://www.iso20022.org/" target="_blank" rel="noreferrer">ISO 20022 ↗</a>
          </div>
        </div>
        <div>
          <div className="footer-col-hdr">Service Domains</div>
          <div className="footer-links">
            <span className="fl" onClick={() => switchTab("services")}>Current Account (SD-02)</span>
            <span className="fl" onClick={() => switchTab("services")}>Payment Execution (SD-03)</span>
            <span className="fl" onClick={() => switchTab("services")}>Consumer Lending (SD-05)</span>
            <span className="fl" onClick={() => switchTab("services")}>Investment Portfolio (SD-08)</span>
          </div>
        </div>
        <div>
          <div className="footer-col-hdr">Developer</div>
          <div className="footer-links">
            <span className="fl" onClick={openConsole}>Interactive API Console</span>
            <span className="fl" onClick={() => setShowObs(true)}>Live Observability</span>
            <span className="fl" onClick={() => switchTab("sdk")}>Agent SDK (@agentbank/sdk)</span>
            <a className="fl" href="https://github.com/watsongm/agentbank/blob/main/openapi.yaml" target="_blank" rel="noreferrer">OpenAPI 3.1 Spec ↗</a>
          </div>
        </div>
        <div>
          <div className="footer-col-hdr">Platform</div>
          <div className="footer-links">
            <a className="fl" href="https://github.com/watsongm/agentbank" target="_blank" rel="noreferrer">GitHub Repository ↗</a>
            <a className="fl" href="/agentbank-executive-visuals.html" target="_blank" rel="noreferrer">Executive Briefing Deck ↗</a>
            <span className="fl" onClick={() => switchTab("mcp")}>MCP Server</span>
            <span className="fl" onClick={() => switchTab("arch")}>System Architecture</span>
          </div>
        </div>
      </footer>
      <div className="footer-bar">
        <span>© 2026 agentBANK Reference Implementation. Institutional sandbox environment.</span>
        <span>Open Banking API v3.1 + BIAN Service Domain Model v12 + FAPI 2.0</span>
      </div>

      {/* ───── DOMAIN INSPECTOR MODAL ───── */}
      {modalDomain && (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          aria-label={modalDomain.name}
          onClick={e => e.target === e.currentTarget && setModal(null)}
        >
          <div className="modal">
            <div className="modal-hdr">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="dom-code-pill" style={{ color: modalDomain.color }}>{modalDomain.icon}</span>
                  <div className="modal-title">{modalDomain.name}</div>
                </div>
                <div className="modal-bian">{modalDomain.bian}</div>
              </div>
              <button className="modal-x" onClick={() => setModal(null)} aria-label="Close modal">✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14.5, color: "var(--ink-2)", lineHeight: 1.65, marginBottom: 20 }}>{modalDomain.desc}</p>
              <div className="modal-tabs" role="tablist">
                <button
                  role="tab"
                  aria-selected={modalTab === "ep"}
                  className={`mtab ${modalTab === "ep" ? "on" : ""}`}
                  onClick={() => setModalTab("ep")}
                >
                  REST Endpoints ({modalDomain.endpoints.length})
                </button>
                <button
                  role="tab"
                  aria-selected={modalTab === "caps"}
                  className={`mtab ${modalTab === "caps" ? "on" : ""}`}
                  onClick={() => setModalTab("caps")}
                >
                  Agent Capabilities ({modalDomain.caps.length})
                </button>
              </div>
              {modalTab === "ep" && (
                <div className="ep-list">
                  {modalDomain.endpoints.map((ep, i) => (
                    <div key={i} className="ep-row">
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <span className={`ep-badge badge-${ep.m}`}>{ep.m}</span>
                        <div>
                          <div className="ep-path">{ep.p}</div>
                          <div className="ep-desc">{ep.d}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="try-tool-btn"
                        onClick={() => openConsoleAt(modalDomain.id, i)}
                      >
                        Test in Console →
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {modalTab === "caps" && (
                <div>
                  <div className="cap-list">
                    {modalDomain.caps.map((c, i) => (
                      <div key={i} className="cap-row">
                        <div className="cap-tick">✓</div>
                        <span className="cap-text">{c}</span>
                      </div>
                    ))}
                  </div>
                  <div className="scope-box">
                    <div className="scope-lbl">REQUIRED OAUTH 2.0 / FAPI CONSENT SCOPE</div>
                    <code style={{ fontFamily: "var(--mono)", fontSize: 12.5, color: "var(--ink)", fontWeight: 600 }}>
                      {modalDomain.id}:read {modalDomain.id}:write
                    </code>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ───── INTERACTIVE API CONSOLE OVERLAY ───── */}
      {showConsole && (
        <div className="console-wrap" role="dialog" aria-modal="true" aria-label="Interactive API Console">
          <div className="console-top">
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
              <div className="console-logo">agent<span>BANK</span></div>
              <span className="console-sub">Interactive API Console</span>
              <div className="mode-toggle" role="group" aria-label="API execution mode">
                <button
                  type="button"
                  className={`mode-btn ${apiMode === "mock" ? "on-mock" : ""}`}
                  onClick={() => toggleMode("mock")}
                >
                  MOCK ENGINE
                </button>
                <button
                  type="button"
                  className={`mode-btn ${apiMode === "live" ? "on-live" : ""}`}
                  onClick={() => toggleMode("live")}
                >
                  LIVE BACKEND
                </button>
              </div>
            </div>
            <button className="console-x" onClick={() => setShowConsole(false)}>✕ CLOSE</button>
          </div>

          <div className="console-inner">
            <div className="console-sidebar">
              <div className="csb-lbl">10 BIAN Domains</div>
              {DOMAINS.map(d => (
                <div
                  key={d.id}
                  className={`csb-item ${cDomain === d.id ? "on" : ""}`}
                  onClick={() => pickDomain(d.id)}
                >
                  <span className="csb-icon" style={{ color: d.color }}>{d.icon}</span>
                  <span className="csb-name">{d.name}</span>
                </div>
              ))}
            </div>

            <div className="console-main">
              <div className="ep-bar">
                {cDom?.endpoints.map((ep, i) => (
                  <button
                    key={i}
                    className={`ep-btn ${cEpIdx === i ? "on" : ""}`}
                    onClick={() => pickEp(i)}
                    title={`${ep.m} ${ep.p} — ${ep.d}`}
                  >
                    <span className={`em em-${ep.m}`}>{ep.m}</span>
                    <span style={{ maxWidth: 230, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ep.p.replace(/^\/open-banking\/v3\.1\/|^\/bian\//, "/")}
                    </span>
                  </button>
                ))}
              </div>

              <div className="workspace">
                <div className="req-pane">
                  <div className="pane-hdr">
                    <span>
                      REQUEST ({apiMode.toUpperCase()}) · <span style={{ color: "#60A5FA" }}>{cDom?.bian}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const curlCmd = `curl -X ${cEp?.m || "GET"} "http://localhost:3000${cPath}" \\\n  -H "Authorization: ${authDisplayValue}" \\\n  -H "x-fapi-interaction-id: ${cFapiId}" \\\n  -H "Content-Type: application/json"${cEp?.m !== "GET" && cBody.trim() ? ` \\\n  -d '${cBody.replace(/\n\s*/g, " ")}'` : ""}`;
                        copyToClipboard("curl", curlCmd);
                      }}
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 10,
                        padding: "3px 9px",
                        borderRadius: 4,
                        background: "rgba(255,255,255,.06)",
                        border: "1px solid rgba(255,255,255,.15)",
                        color: cCopied === "curl" ? "#34D399" : "#CBD5E1",
                        cursor: "pointer",
                      }}
                    >
                      {cCopied === "curl" ? "✓ cURL Copied" : "Copy cURL"}
                    </button>
                  </div>

                  <div className="url-row">
                    <div className={`url-method um-${cEp?.m}`}>{cEp?.m}</div>
                    <input
                      className="url-path"
                      value={cPath}
                      onChange={e => setCPath(e.target.value)}
                      aria-label="Request URL path"
                    />
                    <button className="send" onClick={sendReq} disabled={cLoading}>
                      {cLoading ? "SENDING..." : "SEND →"}
                    </button>
                  </div>

                  {/* Quick Seed ID Bar */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 16px",
                      background: "#090D16",
                      borderBottom: "1px solid var(--dborder)",
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "#64748B", letterSpacing: "0.06em" }}>
                      SEED IDs:
                    </span>
                    {[
                      ["PAR-ARIA", "Aria Party"],
                      ["ACC-1829", "Aria Current"],
                      ["ACC-2041", "Aria Savings"],
                      ["LOAN-48291", "Mahliqa Loan"],
                      ["CRD-88421", "Aria Card"],
                      ["PRT-29183", "Aria Portfolio"],
                      ["CASE-9001", "AML Case"],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        title={`Click to copy ${id} (${label})`}
                        onClick={() => copyToClipboard(id, id)}
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 10,
                          padding: "2px 7px",
                          borderRadius: 4,
                          background: cCopied === id ? "rgba(16,185,129,.18)" : "rgba(255,255,255,.04)",
                          border: "1px solid",
                          borderColor: cCopied === id ? "#10B981" : "rgba(255,255,255,.1)",
                          color: cCopied === id ? "#34D399" : "#CBD5E1",
                          cursor: "pointer",
                        }}
                      >
                        {cCopied === id ? "✓ Copied" : id}
                      </button>
                    ))}
                  </div>

                  <div className="req-fields">
                    {/* Progressive Disclosure for FAPI Headers */}
                    <div className="field-section">
                      <div className="field-sec-hdr" onClick={() => setShowReqHeaders(h => !h)}>
                        <span>FAPI 2.0 &amp; AUTHENTICATION HEADERS</span>
                        <span style={{ color: "#60A5FA" }}>{showReqHeaders ? "Hide ▴" : "Edit Headers ▾"}</span>
                      </div>
                      {showReqHeaders && (
                        <div style={{ paddingBottom: 8 }}>
                          <div className="field">
                            <span className="field-lbl">Authorization</span>
                            <input
                              className="field-inp"
                              value={authDisplayValue}
                              onChange={e => setToken(e.target.value.replace(/^Bearer\s+/i, ""))}
                              aria-label="Authorization header"
                            />
                          </div>
                          <div className="field">
                            <span className="field-lbl">x-fapi-interaction-id</span>
                            <input className="field-inp" value={cFapiId} readOnly aria-label="FAPI Interaction ID" />
                          </div>
                          <div className="field">
                            <span className="field-lbl">Content-Type</span>
                            <input className="field-inp" value="application/json" readOnly aria-label="Content-Type" />
                          </div>
                        </div>
                      )}
                    </div>

                    {cEp?.m !== "GET" && (
                      <div className="field-section">
                        <div className="field-sec-hdr" style={{ cursor: "default" }}>
                          <span>JSON REQUEST PAYLOAD</span>
                        </div>
                        <div style={{ padding: "10px 16px" }}>
                          <textarea
                            className="field-ta"
                            rows={9}
                            value={cBody}
                            onChange={e => setCBody(e.target.value)}
                            aria-label="Request JSON body"
                          />
                        </div>
                      </div>
                    )}

                    <div className="field-section">
                      <div className="field-sec-hdr" style={{ cursor: "default" }}>
                        <span>OPERATION SPECIFICATION</span>
                      </div>
                      <div style={{ padding: "12px 16px" }}>
                        <div style={{ fontSize: 12.5, color: "#CBD5E1", lineHeight: 1.6 }}>{cEp?.d}</div>
                        <div style={{ marginTop: 8, fontFamily: "var(--mono)", fontSize: 11, color: "#94A3B8" }}>
                          PATH TEMPLATE: <span style={{ color: "#38BDF8" }}>{cEp?.p}</span> · REQUIRED SCOPE:{" "}
                          <span style={{ color: "#60A5FA" }}>
                            {cDomain}:read{cEp?.m !== "GET" ? " " + cDomain + ":write" : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="res-pane">
                  <div className="pane-hdr">
                    <span>RESPONSE PAYLOAD</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {cResp && <span style={{ color: "#94A3B8" }}>{cTime}ms</span>}
                      {cResp && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard("json", JSON.stringify(cResp, null, 2))}
                          style={{
                            fontFamily: "var(--mono)",
                            fontSize: 10,
                            padding: "3px 9px",
                            borderRadius: 4,
                            background: "rgba(255,255,255,.06)",
                            border: "1px solid rgba(255,255,255,.15)",
                            color: cCopied === "json" ? "#34D399" : "#CBD5E1",
                            cursor: "pointer",
                          }}
                        >
                          {cCopied === "json" ? "✓ JSON Copied" : "Copy JSON"}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="res-body">
                    {!cResp && !cLoading && (
                      <div className="res-empty">
                        <div className="res-empty-icon">◎</div>
                        <div className="res-empty-text">CLICK SEND TO EXECUTE BIAN / OBIE OPERATION</div>
                      </div>
                    )}
                    {cLoading && (
                      <div className="res-loading">
                        <div className="spinner" />
                        EXECUTING REQUEST...
                      </div>
                    )}
                    {cResp && !cLoading && (
                      <>
                        <div className="res-meta">
                          <div className={`res-status ${cOk ? "" : "err"}`}>{cStatus}</div>
                          <div className="res-time">{cTime}ms · application/json</div>
                          <button
                            type="button"
                            onClick={() => {
                              setShowConsole(false);
                              setObsInitTab("trace");
                              setObsInitSessId(lastConsoleSessId);
                              setShowObs(true);
                            }}
                            style={{
                              marginLeft: "auto",
                              fontFamily: "var(--mono)",
                              fontSize: 10.5,
                              fontWeight: 600,
                              padding: "5px 11px",
                              borderRadius: 5,
                              background: "rgba(56,189,248,.14)",
                              border: "1px solid rgba(56,189,248,.4)",
                              color: "#38BDF8",
                              cursor: "pointer",
                            }}
                          >
                            Inspect Trace in Observability →
                          </button>
                        </div>
                        <pre className="res-json">{JSON.stringify(cResp, null, 2)}</pre>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───── OBSERVABILITY OVERLAY ───── */}
      {showObs && (
        <ObservabilityOverlay
          sessions={sessions}
          setSessions={setSessions}
          history={history}
          obsPaused={obsPaused}
          setObsPaused={setObsPaused}
          apiMode={apiMode}
          token={token}
          initialTab={obsInitTab}
          initialSessionId={obsInitSessId}
          onClose={() => setShowObs(false)}
        />
      )}
    </>
  );
}
