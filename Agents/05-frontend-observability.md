# Agent 5 — Frontend & Observability Engineer

## Role & Mission
Modernize the React + Vite frontend (`src/`), wire the live/mock API client and `AuthContext`, resolve API Console path parameter templates, modularize `App.jsx`, unify `Observability.jsx` with live backend telemetry support, and ensure responsive & accessible UX.

## Strict File Ownership
- `src/**`
- `index.html`
- `vite.config.js`
- `agentbank-executive-visuals.html`

## Key Deliverables
1. **Wire `src/api/index.js` & `AuthContext` into `src/App.jsx`:**
   - Replace direct `mockApi` calls in `App.jsx` with `apiFetch` from `./api/index.js` and connect `useAuth()` from `./context/AuthContext.jsx`.
   - Allow toggling between **Mock Mode** and **Live Backend Mode** right in the UI (defaulting to `import.meta.env.VITE_USE_MOCK !== 'false'`, with graceful fallback or status indicator).
   - Resolve curly-brace path templates (`{accountId}` → `ACC-1829`, `{partyId}` → `PAR-ARIA`, `{loanId}` → `LOAN-48291`, `{cardId}` → `CRD-88421`, `{portfolioId}` → `PRT-29183`, `{txId}` → `TXN-48291`, `{id}`/`{execId}`/`{paymentId}` → `PAY-70001`, `{caseId}`/`{reportId}` → `CASE-9001`) automatically when selecting an endpoint in the API Console, and make the URL input editable so users can test custom IDs.
   - Parse and send `cBody` on `POST`/`PUT` requests and display actual HTTP response status codes (`200 OK`, `201 Created`, `400 Bad Request`, etc.).
2. **Mock API Completeness (`src/mock/api.js` & `src/data/*`):**
   - Add `POST /open-banking/v3.1/oauth/token` and `GET /observability/sessions` to `src/mock/api.js`.
   - Align seeded IDs (`PAR-ARIA`, `LOAN-48291`) and tool parameters (`consent_token` optional) across `src/data/*`, `src/components/McpTab.jsx`, and `src/components/SdkTab.jsx`.
3. **Deduplicate & Upgrade Observability (`src/Observability.jsx` & `src/App.jsx`):**
   - Consolidate the observability overlay into `src/Observability.jsx` and import it cleanly into `src/App.jsx` (reducing `App.jsx` bloat and eliminating duplicate code).
   - Fix the render-phase `rnd()` bug in `toolDist` using deterministic/memoized calculation.
   - Add a **Live Backend Sync** poll/fetch (`GET /observability/sessions` when in Live Backend mode) that merges backend `AuditEvent` traces into the Observability session list.
4. **Responsive CSS, Accessibility & Executive Visuals:**
   - Fix `@media(max-width:900px)` so `.res-pane` and `.detail-panel` stack vertically below the request/table panes rather than disappearing (`display: none`).
   - Add keyboard accessibility (`Escape` key closes modals/overlays, replay button on the Channel terminal animation).
   - Fix viewport meta tag in `agentbank-executive-visuals.html`, configure `vite.config.js` to include `agentbank-executive-visuals.html` in multi-page build output, and add an "Executive Deck" link in the `App.jsx` navbar/footer.
