# agentBANK — Styling, Narrative & UX Design Review

**Author**: Agent 7 (`styling-ux-agent`) — Styling, Narrative & UX Design Engineer  
**Archive Location**: `/old mock/` (contains both `v1-original/` and pre-refactor snapshots of `src/` and `agentbank-executive-visuals.html`)  
**Scope**: Main Showcase (`src/App.jsx`, `src/components/McpTab.jsx`, `src/components/SdkTab.jsx`), Interactive API Console (`src/App.jsx`, `src/mock/api.js`), Observability Dashboard (`src/Observability.jsx`, `src/mock/sessions.js`), and Executive Briefing Deck (`agentbank-executive-visuals.html`).

---

## Executive Summary

**agentBANK** presents a rich, standards-anchored reference architecture combining **Open Banking v3.1**, **BIAN v12 (10 Service Domains · 44 Domain Endpoints)**, **MCP 1.0 (14 Agent Tool Primitives)**, and **FAPI 2.0 / DPoP with SHA-256 Hash-Chained Audit Logging**.

However, an audit across the four human-facing surfaces revealed three systemic gaps prior to this enhancement pass:

1. **Visual & Brand Split-Brain**: The main React showcase used an editorial-fintech design system (`Syne` + `IBM Plex Sans` + `Fira Code`, warm ivory `#f8f7f4`, ink `#0d0f14`, gold `#c9a84c`), whereas the Executive Visuals deck (`agentbank-executive-visuals.html`) used a disconnected corporate blue/amber palette (`Inter`, `#0A2540` navy, `#B45309` amber) with no `AGENTBANK` brand mark or return path to the interactive platform. Meanwhile, the dark technical overlays (API Console and Observability) suffered from severe WCAG AA contrast failures (`#2a3a4a` and `#445566` text on `#07090d` / `#101620` backgrounds — contrast ratios of `1.6:1` to `2.5:1`).
2. **Narrative Discontinuity ("Broken Golden Thread")**:
   - The Hero banner displayed approximate placeholder metrics (`10+`, `45+`) instead of the exact architectural specification (`10 BIAN v12 Domains`, `44 OpenAPI Endpoints`, `14 MCP & SDK Tools`, `FAPI 2.0 DPoP + Hash Audit`).
   - `src/mock/sessions.js` only included **8 of the 14 tools** in `OBS_TOOLS` and used random customer names (`James Okafor`, `Sofia Reyes`, etc.) instead of the canonical seeded personas (`Aria Chen (PAR-ARIA)`, `Mahliqa Patel (PAR-MAHLI)`, `Devon Brooks (PAR-DEVON)`).
   - Feature tabs were static islands: users viewing a BIAN domain endpoint in the Services modal, a tool in the 14-Tool Registry, or a step in the Smart Savings Agent use case had no one-click way to test that exact endpoint in the API Console, and API Console responses had no direct bridge to inspect the resulting trace in Observability.
3. **UX Friction & Dead Ends**:
   - Clicking **AGENT TRACE** or **OTEL SPANS** in the Observability overlay presented a blank dead-end screen (`"SELECT A SESSION FROM METRICS TAB"`) unless the user first clicked a row in the Metrics table.
   - Switching between sessions required navigating back and forth to the Metrics tab.
   - The API Console truncated endpoint paths to the last two segments (making `/bian/consumer-loan/{loanId}/retrieve` and `/bian/credit-card/{cardId}/retrieve` look identical as `{id}/retrieve`) and lacked developer ergonomics (quick-copy seeded IDs, Copy cURL, Copy JSON).

---

## Pillar 1: Visual & Brand Consistency Audit

| Surface | Pre-Enhancement State | Issue / Contrast Audit | Implemented Resolution |
| :--- | :--- | :--- | :--- |
| **Typography & Readability (`index.html`, `src/App.jsx`, `agentbank-executive-visuals.html`)** | `Syne` 800 display font had exaggerated, stretched wide glyphs (`W`, `M`, `O`, `e`, `s`) that made sentence-length titles (`"When a person's primary tool is an agent..."`) jarring to read; `IBM Plex Sans` only loaded weights `300;400;500` while headings used `font-weight: 800` with `-3px` tracking (triggering browser faux-bold smearing); `Fira Code` was overused on UI labels. | Jarring, hard-to-read headings and cramped letter-spacing across both the mock and Executive Visuals slides. | Standardized on a clean, high-legibility font system across all surfaces: **`Inter`** (`wght@400;500;600;700`) for display/headings/UI (`--sans`, `--display`) with natural `-0.02em` tracking and `600`/`700` weights, paired with **`JetBrains Mono`** (`wght@400;500;600`) reserved strictly for code, API paths, JSON payloads, and tool identifiers (`--mono`). |
| **Executive Briefing (`agentbank-executive-visuals.html`)** | Disconnected corporate blue/amber palette (`#0A2540` navy, `#B45309` amber); header titled `"When agents are the interface"`. | Visually felt like a separate presentation deck unrelated to the `AGENTBANK` platform. | Unified `Inter` + `JetBrains Mono` typography, aligned CSS tokens (`--bg: #f8f7f4`, `--ink: #0d0f14`, `--gold: #c9a84c`, `--accent: #9a7b2c`), and added the `AGENTBANK` brand mark + `"← Interactive Platform"` bridge. |
| **API Console (`src/App.jsx`)** | Dark surface (`#070a0e` / `#0c1018`) with labels, headers, and timings in `#2a3a4a` (1.65:1 contrast) and `#445566` (2.52:1 contrast). | Fails WCAG AA (requires ≥ 4.5:1 for normal text). Field labels, BIAN domain tags, and template hints were nearly invisible. | Upgraded dark-surface secondary text to `#8b9bb4` (6.4:1 contrast) and muted metadata to `#64748b` (4.5:1 contrast). |
| **Observability (`src/Observability.jsx`)** | Recharts X/Y axis ticks, span rulers, and trace timestamps in `#2a3a4a`; KPI labels and chart headers in `#445566`. | Chart axes, trace timestamps (`+50ms`), and `[Reasoning]` steps were unreadable on `#101620` cards. | Upgraded chart axis ticks to `#64748b`, chart/panel headers and KPI labels to `#8b9bb4`, and reasoning steps to `#94a3b8`. |
| **MCP & SDK Tabs (`McpTab.jsx`, `SdkTab.jsx`)** | Clean editorial cards, but terminal replay buttons and copy buttons had low-opacity labels (`rgba(255,255,255,.3)`). | Low discoverability on dark code blocks; no direct bridge from MCP/SDK tools to the interactive API Console. | Enhanced button legibility and added interactive `"Try in Console →"` actions on every MCP and SDK tool row. |

---

## Pillar 2: Narrative Cohesion ("The Golden Thread")

### 1. Canonical Personas Across Every Surface
Previously, the database seed (`prisma/seed.js`) and Mock API (`src/mock/constants.js`) defined three canonical customers, while `src/mock/sessions.js` used unrelated names. All surfaces now share the exact same personas and entity IDs:
- **Aria Chen (`PAR-ARIA`)** — Primary retail & wealth persona (`ACC-1829` Current Account, `ACC-2041` Savings Account, `CRD-88421` Visa Platinum Card, `PRT-29183` Investment Portfolio).
- **Mahliqa Patel (`PAR-MAHLI`)** — Consumer lending persona (`LOAN-48291` Active Consumer Loan).
- **Devon Brooks (`PAR-DEVON`)** — Multi-domain banking persona (`ACC-3310` Current Account, `CASE-9001` Compliance Screening).

### 2. Complete 14-Tool Telemetry Coverage
`OBS_TOOLS` in `src/mock/sessions.js` previously omitted 6 tools (`get_payment_status`, `get_loan_details`, `block_card`, `get_portfolio`, `place_order`, `subscribe_events`). All **14 agentBANK tools** are now represented in simulated sessions, tool volume bar charts, and reasoning traces, with realistic domain-specific arguments (e.g., `ACC-1829`, `LOAN-48291`, `CRD-88421`, `PRT-29183`) and BIAN Service Domain span names.

### 3. Cryptographic Audit Chain Visibility (ADR-0002 Alignment)
To bring the regulatory compliance narrative (`SHA-256 hash-chained audit log` + `FAPI 2.0 DPoP`) to life visually:
- Every session in `src/mock/sessions.js` and `src/Observability.jsx` now carries `fapiInteractionId`, `prevHash`, and `rowHash` (64-char SHA-256 hex digest).
- The Observability top bar and Trace Session Details panel feature a **`🔒 SHA-256 AUDIT CHAIN VERIFIED`** badge and display the cryptographic hash chain links alongside the FAPI Interaction ID.

### 4. End-to-End Story Bridges
We connected every static showcase view into a continuous interactive loop:
1. **Hero Section**: Added `"Open API Console →"` and `"Executive Briefing ↗"` CTAs alongside `"See Agent Use Case"`, plus authoritative platform stats (`10 BIAN v12 Domains`, `44 OpenAPI Endpoints`, `14 MCP & SDK Tools`, `FAPI 2.0 DPoP + Hash Audit`).
2. **Use Case Stepper → API Console**: Added a `"Run Step in API Console →"` button in the Smart Savings Agent code header that opens the API Console pre-loaded with the exact domain and endpoint for Steps 1–6.
3. **Services Modal → API Console**: Added a `"Test in Console →"` button on every endpoint row inside the BIAN Domain Modal.
4. **14-Tool Registry / MCP Tab / SDK Tab → API Console**: Added `"Try Tool in Console →"` links on all 14 tool cards so developers can immediately test any tool's backing REST/BIAN endpoint.
5. **API Console Response → Observability Trace**: After executing any request in the API Console, an `"Inspect Trace in Observability →"` button appears in the response header, jumping directly to the `AGENT TRACE` tab in Observability with that exact console session selected.

---

## Pillar 3: User Experience (UX) & Ergonomics Improvements

### 1. Eliminating Blank-Screen Friction in Observability (`src/Observability.jsx`)
- **Auto-Selection**: `selSess` now defaults to `sessions[0]` (or `initialSessionId` when bridged from the API Console) and automatically stays synced if `selSess` is null. Clicking `AGENT TRACE` or `OTEL SPANS` immediately renders a live reasoning trace and 4-layer OpenTelemetry waterfall.
- **Quick Session Selector Bar**: Added a persistent horizontal session switcher bar at the top of both `AGENT TRACE` and `OTEL SPANS`, allowing one-click switching between the 6 most recent sessions (with visual badges for `CONSOLE` / `LIVE` / `AGENT` sources) without returning to the `LLM METRICS` tab.

### 2. API Console Developer Ergonomics (`src/App.jsx`)
- **Quick Seed ID Bar**: Added a clickable chip bar (`PAR-ARIA`, `ACC-1829`, `ACC-2041`, `LOAN-48291`, `CRD-88421`, `PRT-29183`, `CASE-9001`) in the request pane with instant clipboard copy and `"✓ Copied"` feedback.
- **Copy cURL & Copy JSON**: Added a `"Copy cURL"` button in the Request pane header (generating a complete, runnable `curl` command with `Authorization` and `x-fapi-interaction-id` headers) and a `"Copy JSON"` button in the Response pane header.
- **Readable Endpoint Pills**: Increased endpoint pill width (`maxWidth: 220px`) and added descriptive `title` tooltips (`METHOD /path — Description`).

### 3. Executive Visuals Presentation UX (`agentbank-executive-visuals.html`)
- **Interactive Exhibit Footer Bar**: Added a bottom navigation bar with `← Previous Exhibit`, progress indicator (`Exhibit X of 5 · Use keys 1–5 or ← →`), and `Next Exhibit →`.
- **Keyboard & Deep-Link Support**: Added `ArrowLeft` / `ArrowRight` keyboard navigation (in addition to keys `1`–`5`), proper `aria-selected` tab attributes, and `?exhibit=1..5` URL query parameter support.
- **Explicit agentBANK Grounding**: Enriched Exhibits 1 and 2 with concrete references to all 14 agentBANK primitives, the 10 BIAN v12 Service Domains, Open Banking v3.1, MCP 1.0, and FAPI 2.0 / SHA-256 audit guarantees.
