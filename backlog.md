# agentBANK Backlog

All items resolved. See commit history for details.

## Completed

- [x] **`consent_token` passthrough** — threaded through as per-call `Authorization` header via `consentHeaders()` helper in `mcp-server/index.js`
- [x] **`apply_for_loan` currency param** — added optional `currency: z.string().length(3).default("GBP")`
- [x] **`place_order` fractional quantities** — changed `z.number().int()` → `z.number().positive()`
- [x] **`App.jsx` component split** — split into `src/data/`, `src/mock/`, and `src/components/McpTab.jsx`; App.jsx reduced from 1937 → ~700 lines
- [x] **OpenAPI spec** — `openapi.yaml` added covering all 44 endpoints across 10 BIAN service domains (OpenAPI 3.1.0)
- [x] **Observability wired to API Console** — `sendReq()` pushes real call data into the same `sessions`/`history` state used by the Observability panel
- [x] **Retry + timeout on `apiCall`** — 2 retries, 500ms backoff, 10s `AbortController` timeout
- [x] **Pagination cursor in `get_transactions`** — added `cursor: z.string().optional()` param
- [x] **Webhook ownership verification** — `subscribe_events` generates `verificationToken: crypto.randomUUID()` and includes it in the POST body
- [x] **`AgentBankAgent` SDK** — added `sdk/index.js` + `sdk/package.json` (`@agentbank/sdk`)
- [x] **`.env.example`** — added with `AGENTBANK_BASE_URL` and `AGENTBANK_TOKEN`
- [x] **`.claude/skills/` committed** — already present in repo (confirmed via `git ls-files`)
