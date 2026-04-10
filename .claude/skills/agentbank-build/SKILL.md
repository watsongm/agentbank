---
name: agentbank-build
description: Generate a new AgentBank agent build recipe and add it to the Agent Builds section of App.jsx. Use when the user asks to add an agent build, agent recipe, agent example, or agent snippet to agentbank.
argument-hint: [build description]
allowed-tools: Read Edit Grep
---

# AgentBank — Add Agent Build Recipe

When invoked, add a new agent build recipe to the AgentBank demo app.

## The task

1. Understand the user's intent from `$ARGUMENTS` (e.g. "KYC onboarding agent", "savings goal agent")
2. Design a realistic banking agent scenario using the available tools below
3. Write the code snippet in the established style
4. Insert the new build into `AGENT_BUILDS` in `src/App.jsx`

## Available AgentBankAgent tools

These are the only tools you may reference in code snippets:

| Tool | Domain | Key params |
|---|---|---|
| `get_party` | party | `consent_token` |
| `get_accounts` | accounts | `consent_token` |
| `get_balance` | accounts | `account_id` |
| `get_transactions` | transactions | `account_id, from_date, to_date, limit` |
| `initiate_payment` | payments | `debtor_account, creditor_account, amount, currency, reference` |
| `get_payment_status` | payments | `payment_id` |
| `get_loan_details` | lending | `loan_id` |
| `apply_for_loan` | lending | `party_id, amount, term_months, purpose` |
| `get_card_details` | cards | `card_id` |
| `block_card` | cards | `card_id, action` |
| `get_portfolio` | investments | `portfolio_id` |
| `place_order` | investments | `portfolio_id, instrument, quantity, direction` |
| `run_aml_screen` | compliance | `subject_type, subject_id` |
| `subscribe_events` | notifications | `party_id, event_types, webhook_url` |

## AGENT_BUILDS entry format

Each entry in the `AGENT_BUILDS` array must have this exact shape:

```js
{
  id: "kebab-case-id",
  icon: "◆",          // pick a geometric unicode: ◆ ⬟ △ ◉ ⟳ ◈ ⬡ ≡ ▭
  color: "#xxxxxx",   // pick from: #ef9a9a #ffcc80 #b39ddb #fff176 #ffb74d #4fc3f7 #81c784 #ce93d8 #80cbc4
  name: "Short Title",
  desc: "One or two sentence description of what the agent does and why it is useful.",
  tags: ["domain1", "domain2"],   // use domain ids: party accounts transactions payments lending cards savings investments compliance notifications
  code: `// Comment describing the agent
const agent = new AgentBankAgent({ scope: "..." });
// ... tool calls using await agent.tools.tool_name({ ... })
// -> inline comments showing example output`,
},
```

## Code snippet style rules

- Start with a `// Title Comment` then construct `AgentBankAgent` with the minimal required scope
- Call `await agent.authenticate()` or pass `consent_token` as needed
- Use `Promise.all([...])` for parallel independent calls
- Add `// LLM derives:` or `// LLM identifies:` comments to show where AI reasoning happens
- End result lines with `// -> key: value` style output comments
- Keep snippets to 25-35 lines — dense but readable
- Use realistic IDs: `ACC-XXXX`, `P-XXXXXXXX`, `PRT-XXXXX`, `LN-XXXXX`, `CRD-XXXXX`
- Use GBP as currency unless the scenario calls for another
- Scope string uses `domain:read` / `domain:write` space-separated

## Where to insert

Find the closing `];` of the `AGENT_BUILDS` array in `src/App.jsx` and insert the new entry before it.

Read the existing entries first to:
- Avoid duplicate `id` values
- Pick an unused `color` if possible
- Keep the new entry consistent in tone with the existing five

After inserting, confirm the build name and which domains it touches.
