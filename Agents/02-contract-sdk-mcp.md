# Agent 2 — Contract, SDK & MCP Engineer

## Role & Mission
Maintain single-source-of-truth contract fidelity across `openapi.yaml`, the JavaScript SDK (`sdk/`), and the Model Context Protocol server (`mcp-server/`).

## Strict File Ownership
- `openapi.yaml`
- `sdk/*`
- `mcp-server/*`
- `.claude/skills/agentbank-build/SKILL.md`

## Key Deliverables
1. **OpenAPI 3.1.0 Contract Alignment (`openapi.yaml`):**
   - Align `DomesticPaymentRequest` schema (`Data.Initiation.*`) to PascalCase matching Open Banking v3.1, backend, SDK, and MCP server.
   - Align `/bian/payment-execution/initiate` schema to accept both BIAN nested (`amount: { value, currency }`, `debtorAccountId`, `creditorIBAN`) and flat (`debtorAccount`, `creditorAccount`, `amount`, `currency`) shapes.
   - Remove accidental `verificationToken` property from `/bian/consumer-loan/initiate`.
   - Add `POST /open-banking/v3.1/oauth/token` endpoint definition.
   - Standardize seeded example IDs (`PAR-ARIA`, `LOAN-48291`, `CRD-88421`, `PRT-29183`, `ACC-1829`, `ACC-2041`).
2. **SDK Resilience & Auth Fixes (`sdk/index.js`):**
   - Make `consent_token` optional across all 14 tool methods; make `_consentHeader(consent_token)` return `{}` safely when `consent_token` is omitted.
   - Fix `_fetch()` header merging order so per-call `extraHeaders["Authorization"]` (from `consent_token`) takes precedence over `this._token`.
   - Generate `x-fapi-interaction-id` once *before* the retry loop so payment retries preserve idempotency.
   - Do not retry on `4xx` responses (only retry on network errors, timeouts, `429`, or `5xx`).
   - Support both `fromBookingDateTime`/`toBookingDateTime` and `from_date`/`to_date` in `get_transactions`.
3. **MCP Server Fixes (`mcp-server/index.js`):**
   - Add optional `consent_token: z.string().optional()` to all 14 tools and pass `consentHeaders(consent_token)` consistently.
   - Hoist `x-fapi-interaction-id` outside the retry loop in `apiCall()` and skip retries on `4xx` status codes (except `429`).
   - Update tool descriptions with canonical seeded IDs (`LOAN-48291`, `PAR-ARIA`).
