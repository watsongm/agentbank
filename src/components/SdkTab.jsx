import { useState } from "react";

const INSTALL_SNIPPET = `npm install @agentbank/sdk`;

const QUICKSTART_SNIPPET = `import { AgentBankAgent } from "@agentbank/sdk";

const agent = new AgentBankAgent({
  scope:    "accounts:read payments:write party:read",
  baseUrl:  process.env.AGENTBANK_BASE_URL,
  clientId: process.env.AGENT_CLIENT_ID,
});

// 1. Authenticate (FAPI 2.0 PAR flow)
const token = await agent.authenticate();

// 2. Verify customer identity
const party = await agent.tools.get_party({ consent_token: token });
// → { partyId: "P-00291847", name: "Aria Chen", kycStatus: "VERIFIED" }

// 3. Fetch balances and transactions
const balance = await agent.tools.get_balance({ account_id: "ACC-1829" });
const txns    = await agent.tools.get_transactions({
  account_id: "ACC-1829",
  from_date:  "2025-12-24",
  to_date:    "2026-03-24",
  limit:      100,
});

// 4. Move money
const payment = await agent.tools.initiate_payment({
  debtor_account:  "ACC-1829",
  creditor_account: "ACC-2041",
  amount:    120,
  currency:  "GBP",
  reference: "Auto-sweep",
});
// → { paymentId: "PAY-7741920", status: "AcceptedSettlementInProcess" }`;

const CLAUDE_SNIPPET = `import Anthropic from "@anthropic-ai/sdk";
import { AgentBankAgent } from "@agentbank/sdk";

const bank  = new AgentBankAgent({ scope: "accounts:read payments:write" });
const token = await bank.authenticate();
const claude = new Anthropic();

const tools = [
  {
    name: "get_balance",
    description: "Retrieve real-time account balance.",
    input_schema: {
      type: "object",
      properties: { account_id: { type: "string" } },
      required: ["account_id"],
    },
  },
  // ... add remaining tools
];

const response = await claude.messages.create({
  model: "claude-opus-4-6",
  max_tokens: 1024,
  tools,
  messages: [{ role: "user", content: "What's the balance on ACC-1829?" }],
});

// Handle tool_use blocks
for (const block of response.content) {
  if (block.type === "tool_use" && block.name === "get_balance") {
    const result = await bank.tools.get_balance(block.input);
    console.log(result);
  }
}`;

const SDK_TOOLS = [
  { name: "get_party",         sig: "({ consent_token })",                                       desc: "Retrieve authenticated customer profile (KYC, risk rating)." },
  { name: "get_accounts",      sig: "({ consent_token })",                                       desc: "List all accounts in scope for the given consent token." },
  { name: "get_balance",       sig: "({ account_id })",                                          desc: "Retrieve real-time available balance for an account." },
  { name: "get_transactions",  sig: "({ account_id, from_date, to_date, limit?, cursor? })",     desc: "Paginated transaction history. Pass cursor to page forward." },
  { name: "initiate_payment",  sig: "({ debtor_account, creditor_account, amount, currency, reference })", desc: "Create and submit a domestic payment instruction." },
  { name: "get_payment_status",sig: "({ payment_id })",                                          desc: "Check execution status of a submitted payment." },
  { name: "get_loan_details",  sig: "({ loan_id })",                                             desc: "Retrieve loan account details and repayment schedule." },
  { name: "apply_for_loan",    sig: "({ party_id, amount, currency?, term_months, purpose })",   desc: "Submit a new loan application. Currency defaults to GBP." },
  { name: "get_card_details",  sig: "({ card_id })",                                             desc: "Retrieve card type, status, and credit limits." },
  { name: "block_card",        sig: '({ card_id, action: "block" | "unblock" })',                desc: "Block or unblock a payment card." },
  { name: "get_portfolio",     sig: "({ portfolio_id })",                                        desc: "Retrieve portfolio holdings, value, and YTD performance." },
  { name: "place_order",       sig: '({ portfolio_id, instrument, quantity, direction })',        desc: "Place a buy/sell order. Fractional quantities are supported." },
  { name: "run_aml_screen",    sig: "({ subject_type, subject_id })",                            desc: "Run AML and sanctions screening against a party or transaction." },
  { name: "subscribe_events",  sig: "({ party_id, event_types, webhook_url })",                  desc: "Subscribe a webhook to real-time account events." },
];

const COLORS = ["#4fc3f7","#81c784","#ffb74d","#ce93d8","#ef9a9a","#80cbc4","#4fc3f7","#81c784","#ffb74d","#ce93d8","#ef9a9a","#80cbc4","#4fc3f7","#81c784"];

export default function SdkTab() {
  const [copied, setCopied] = useState(null);
  const [activeSnippet, setActiveSnippet] = useState("quickstart");

  function copy(key, text) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  }

  const snippets = {
    quickstart: { label: "Quick Start", code: QUICKSTART_SNIPPET },
    claude:     { label: "With Claude API", code: CLAUDE_SNIPPET },
  };

  return (
    <section style={{ padding: "80px 40px", maxWidth: 1100, margin: "0 auto" }}>
      <span className="sec-tag">AGENT SDK</span>
      <h2 className="sec-h">AgentBankAgent<br/>SDK</h2>
      <p className="sec-p">A lightweight JavaScript/TypeScript client that wraps authentication and all 14 tool functions into a single class — compatible with any AI framework including the Claude API and MCP.</p>

      {/* Install */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: 2, color: "var(--gold)", textTransform: "uppercase" }}>Install</span>
        </div>
        <div style={{ background: "var(--ink)", borderRadius: 0, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <code style={{ fontFamily: "var(--mono)", fontSize: 14, color: "#a5d6a7" }}>$ {INSTALL_SNIPPET}</code>
          <button
            onClick={() => copy("install", INSTALL_SNIPPET)}
            style={{ fontFamily: "var(--mono)", fontSize: 10, padding: "4px 10px", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.15)", color: "rgba(255,255,255,.5)", cursor: "pointer", flexShrink: 0, marginLeft: 16 }}
          >{copied === "install" ? "✓ COPIED" : "COPY"}</button>
        </div>
      </div>

      {/* Constructor options */}
      <div style={{ marginBottom: 48 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: 2, color: "var(--gold)", textTransform: "uppercase", display: "block", marginBottom: 16 }}>Constructor</span>
        <div style={{ border: "1px solid var(--line)", overflow: "hidden" }}>
          <div style={{ background: "var(--cream)", padding: "10px 16px", fontFamily: "var(--mono)", fontSize: 12, borderBottom: "1px solid var(--line)" }}>
            new AgentBankAgent(&#123; scope, baseUrl?, clientId?, token? &#125;)
          </div>
          {[
            { param: "scope",     type: "string",  req: true,  desc: 'Space-separated OAuth scopes, e.g. "accounts:read payments:write"' },
            { param: "baseUrl",   type: "string",  req: false, desc: "agentBANK base URL. Defaults to AGENTBANK_BASE_URL env var or http://localhost:3000" },
            { param: "clientId",  type: "string",  req: false, desc: "OAuth client ID. Defaults to AGENT_CLIENT_ID env var" },
            { param: "token",     type: "string",  req: false, desc: "Pre-existing bearer token. Skips authenticate() if provided" },
          ].map(p => (
            <div key={p.param} style={{ display: "grid", gridTemplateColumns: "130px 80px 60px 1fr", gap: 16, padding: "12px 16px", borderBottom: "1px solid var(--line)", fontSize: 13, alignItems: "center" }}>
              <code style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink)" }}>{p.param}</code>
              <code style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--mid)" }}>{p.type}</code>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: p.req ? "#c9a84c" : "var(--mid)", letterSpacing: 1 }}>{p.req ? "REQUIRED" : "optional"}</span>
              <span style={{ fontSize: 13, color: "var(--mid)" }}>{p.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Code snippets */}
      <div style={{ marginBottom: 56 }}>
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--line)", marginBottom: 0 }}>
          {Object.entries(snippets).map(([key, { label }]) => (
            <button
              key={key}
              onClick={() => setActiveSnippet(key)}
              style={{ padding: "10px 20px", fontFamily: "var(--mono)", fontSize: 11, letterSpacing: 1, background: "none", border: "none", borderBottom: activeSnippet === key ? "2px solid var(--ink)" : "2px solid transparent", color: activeSnippet === key ? "var(--ink)" : "var(--mid)", cursor: "pointer", fontWeight: activeSnippet === key ? 700 : 400 }}
            >{label}</button>
          ))}
        </div>
        <div style={{ position: "relative", background: "var(--ink)", border: "1px solid rgba(255,255,255,.06)", borderTop: "none" }}>
          <pre style={{ fontFamily: "var(--mono)", fontSize: 11.5, lineHeight: 1.75, color: "rgba(255,255,255,.75)", padding: "20px 24px", overflowX: "auto", margin: 0 }}>{snippets[activeSnippet].code}</pre>
          <button
            onClick={() => copy(activeSnippet, snippets[activeSnippet].code)}
            style={{ position: "absolute", top: 12, right: 12, fontFamily: "var(--mono)", fontSize: 10, padding: "4px 10px", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.15)", color: "rgba(255,255,255,.4)", cursor: "pointer" }}
          >{copied === activeSnippet ? "✓ COPIED" : "COPY"}</button>
        </div>
      </div>

      {/* Tool reference */}
      <div>
        <span className="sec-tag">TOOL REFERENCE</span>
        <h3 style={{ fontSize: "clamp(22px,3vw,34px)", fontWeight: 800, letterSpacing: "-1px", marginBottom: 8 }}>14 Tools</h3>
        <p style={{ fontSize: 14, color: "var(--mid)", marginBottom: 28 }}>All tools are available on <code style={{ fontFamily: "var(--mono)", fontSize: 12 }}>agent.tools.*</code> and return Promises.</p>
        <div style={{ border: "1px solid var(--line)", overflow: "hidden" }}>
          {SDK_TOOLS.map((t, i) => (
            <div key={t.name} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, padding: "14px 20px", borderBottom: i < SDK_TOOLS.length - 1 ? "1px solid var(--line)" : "none", background: i % 2 === 0 ? "transparent" : "var(--cream)" }}>
              <div>
                <code style={{ fontFamily: "var(--mono)", fontSize: 12, color: COLORS[i], fontWeight: 500 }}>agent.tools.{t.name}</code>
                <code style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--mid)", display: "block", marginTop: 4 }}>{t.sig}</code>
              </div>
              <div style={{ fontSize: 13, color: "var(--mid)", alignSelf: "center", paddingLeft: 16 }}>{t.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Links */}
      <div style={{ marginTop: 48, padding: 28, border: "1px solid var(--line)", background: "var(--cream)", display: "flex", gap: 32, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: 2, color: "var(--gold)", textTransform: "uppercase" }}>Also see</span>
        <a href="https://github.com/watsongm/agentbank/blob/main/sdk/index.js" target="_blank" rel="noreferrer" style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink)", textDecoration: "none", borderBottom: "1px solid var(--ink)" }}>sdk/index.js on GitHub ↗</a>
        <a href="https://github.com/watsongm/agentbank/blob/main/openapi.yaml" target="_blank" rel="noreferrer" style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink)", textDecoration: "none", borderBottom: "1px solid var(--ink)" }}>openapi.yaml ↗</a>
        <a href="https://github.com/watsongm/agentbank/blob/main/mcp-server/index.js" target="_blank" rel="noreferrer" style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink)", textDecoration: "none", borderBottom: "1px solid var(--ink)" }}>mcp-server/index.js ↗</a>
      </div>
    </section>
  );
}
