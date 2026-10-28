# Agent 7 — Styling, Narrative & UX Design Engineer

## Role & Mission
Own the visual design system, typographic hierarchy, color contrast, narrative continuity ("Golden Thread"), and interactive user experience across all human-facing surfaces of **agentBANK**:
1. **Main Showcase & 7 Feature Tabs** (`src/App.jsx`, `src/components/McpTab.jsx`, `src/components/SdkTab.jsx`)
2. **Interactive API Console** (`src/App.jsx` Console overlay & `src/mock/api.js`)
3. **Observability Dashboard** (`src/Observability.jsx` & `src/mock/sessions.js`)
4. **Executive Visuals Deck** (`agentbank-executive-visuals.html`)

## Strict File Ownership
- `src/App.jsx`
- `src/Observability.jsx`
- `src/components/McpTab.jsx`, `src/components/SdkTab.jsx`
- `src/mock/sessions.js`, `src/mock/api.js`
- `src/data/*`
- `agentbank-executive-visuals.html`
- `old mock/**` (archive of previous versions)

## Review Pillars & Design Standards

### 1. Visual & Brand Consistency (Unified Design System)
- **Typography**: `Syne` (800 display headings), `IBM Plex Sans` (300/400/500/600 UI & editorial body), and `Fira Code` (400/500 technical/code/telemetry) across **both** the React app and `agentbank-executive-visuals.html`.
- **Editorial Light Palette**: `--bg: #f8f7f4`, `--cream: #f0ede6`, `--ink: #0d0f14`, `--mid: #5a6270`, `--line: #e2e0da`, `--gold: #c9a84c`, `--gold-dark: #9a7b2c`.
- **Technical Dark Palette (API Console & Observability)**: `--dbg: #07090d`, `--dsurf: #0c1018`, `--dcard: #101620`, `--dborder: #1e293b`, with elevated muted text tokens (`#7c8ea6` and `#94a3b8` instead of unreadable `#2a3a4a` / `#445566`) to meet WCAG AA contrast ratios.

### 2. Narrative Cohesion ("The Golden Thread")
- **Unified Personas & Canonical References**: All four surfaces tell a connected story around the three seeded banking personas:
  - **Aria Chen (`PAR-ARIA`)** — Primary retail & wealth customer (`ACC-1829` Current, `ACC-2041` Savings, `CRD-88421` Card, `PRT-29183` Portfolio)
  - **Mahliqa Patel (`PAR-MAHLI`)** — Consumer lending customer (`LOAN-48291`)
  - **Devon Brooks (`PAR-DEVON`)** — Multi-domain customer (`ACC-3310`)
- **Accurate Platform Metrics**: Consistent numbers everywhere — **10 BIAN v12 Service Domains**, **44 Domain Endpoints (+ OAuth 2.0)**, **14 Agent Tool Primitives**, **FAPI 2.0 / DPoP**, and **SHA-256 Hash-Chained Audit Trail**.
- **Cross-Surface Story Bridges**:
  - From **Services Modal** → `"Test in API Console →"` button on every endpoint row opens the API Console pre-loaded with that exact domain and endpoint.
  - From **Agent Tool Registry** → Clicking any of the 14 tool cards opens the API Console directly on that tool's backing endpoint.
  - From **API Console Response** → `"Inspect Trace in Observability →"` button jumps directly from an executed API request to its live reasoning trace and OpenTelemetry waterfall in the Observability overlay.
  - Between **Main App** and **Executive Visuals** → Shared brand header, seamless navigation links (`← Return to Interactive Platform`, `Open API Console`, `Five Exhibits`), and matching domain/tool terminology.

### 3. User Experience (UX) & Interaction Polish
- **Observability Auto-Selection & Session Switcher**: Automatically select the latest session when opening the `AGENT TRACE` or `OTEL SPANS` tabs (eliminating the dead-end `"SELECT A SESSION FROM METRICS TAB"` blank screen), add a quick session switcher bar at the top of Trace/OTel views, and display a **`SHA-256 AUDIT CHAIN VERIFIED`** badge with cryptographic hash details.
- **API Console Developer Ergonomics**: Readable endpoint pills (showing HTTP method + concise operation label + path), quick-insert **Seeded ID Chips** (`PAR-ARIA`, `ACC-1829`, `ACC-2041`, `LOAN-48291`, `CRD-88421`, `PRT-29183`, `CASE-9001`), **"Copy cURL"** and **"Copy JSON"** buttons, and one-click trace handoff to Observability.
- **Executive Visuals Presentation Controls**: Unified `AGENTBANK` brand header, Previous / Next slide footer bar with keyboard shortcut indicators (`1`–`5` and `←` / `→`), and interactive links back to the live platform.
