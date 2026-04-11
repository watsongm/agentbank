# agentBANK Backlog

## Code Quality / Correctness

- [ ] **`consent_token` is accepted but silently ignored** — `get_party` and `get_accounts` in `mcp-server/index.js` declare `consent_token` as a required parameter but never pass it to `apiCall`. Either thread it through as a per-call `Authorization` header or remove the param.

- [ ] **`apply_for_loan` hardcodes `currency: "GBP"`** — `mcp-server/index.js` line 186 has no `currency` param, so multi-currency scenarios silently bill in GBP. Add as an optional param with a GBP default.

- [ ] **`place_order` rejects fractional quantities** — `z.number().int()` for `quantity` rules out fractional shares (ETFs, fractional equity). Change to `z.number().positive()` or add a `fractional` flag.

---

## Architecture

- [ ] **`App.jsx` is a single 1937-line file** — CSS, data constants, mock API, observability helpers, and all UI components are co-located. Split into `src/data/`, `src/mock/`, and `src/components/` for readability and learnability.

- [ ] **No OpenAPI / AsyncAPI spec** — a reference bank with 44 endpoints and no machine-readable spec is a gap. An `openapi.yaml` would let developers generate clients, validate requests, and see the full contract — consistent with the "API Standards Compliance" table in the README.

- [ ] **Observability is disconnected from the API Console** — charts use random data (`rnd()`, `makeSession()`) and never reflect actual calls made through the API Console. Wire real API Console calls into the observability state.

---

## MCP Server

- [ ] **No retry or timeout on `apiCall`** — a single network hiccup kills the tool call with no recovery. Add a simple retry (2 attempts, 500ms backoff) and an `AbortController` timeout (10s) to `apiCall` in `mcp-server/index.js`.

- [ ] **No pagination cursor in `get_transactions`** — `limit` is supported but there is no `cursor` / `next_page` param. Agents doing bulk transaction analysis will silently miss data beyond the first page.

- [ ] **`subscribe_events` takes a webhook URL with no ownership verification** — a real FAPI implementation requires a challenge/response handshake to verify endpoint ownership. Add at least a mock of the verification flow.

---

## Developer Experience

- [ ] **No `AgentBankAgent` SDK to match the Agent Builds demos** — the Agent Builds tab shows `new AgentBankAgent({ scope: "..." })` but this class does not exist in the repo. Add a small `sdk/` or `client/` package so the snippets are runnable, not just illustrative.

- [ ] **No `.env.example`** — the MCP server requires `AGENTBANK_BASE_URL` and `AGENTBANK_TOKEN` but there is no `.env.example`. Add one so the setup path is obvious.

- [ ] **`.claude/skills/` is not committed to the repo** — the README advertises `/agentbank-build` as a Claude Code skill but the `.claude/` directory is not in the repository. Commit it — it is a differentiator.

---

## Priority

| # | Issue | Effort |
|---|-------|--------|
| 1 | Fix `consent_token` passthrough in MCP server | ~10 min |
| 2 | Add `.env.example` | ~5 min |
| 3 | Commit `.claude/skills/` to the repo | ~5 min |
| 4 | Add `currency` param to `apply_for_loan` | ~10 min |
| 5 | Add timeout + retry to `apiCall` | ~20 min |
| 6 | Add pagination cursor to `get_transactions` | ~30 min |
| 7 | Fix fractional quantity in `place_order` | ~10 min |
| 8 | Add `AgentBankAgent` SDK stub | ~2 hr |
| 9 | Add `openapi.yaml` spec | ~4 hr |
| 10 | Wire API Console calls into Observability | ~3 hr |
| 11 | Split `App.jsx` into components | ~4 hr |
| 12 | Add webhook ownership verification to `subscribe_events` | ~1 hr |
