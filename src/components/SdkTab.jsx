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
// → { partyId: "PAR-ARIA", name: "Aria Chen", kycStatus: "VERIFIED" }

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
  debtor_account:   "ACC-1829",
  creditor_account: "ACC-2041",
  amount:    120,
  currency:  "GBP",
  reference: "Auto-sweep",
});
// → { paymentId: "PAY-7741920", status: "AcceptedSettlementInProcess" }`;

const CLAUDE_SNIPPET = `import Anthropic from "@anthropic-ai/sdk";
import { AgentBankAgent } from "@agentbank/sdk";

const bank   = new AgentBankAgent({ scope: "accounts:read payments:write" });
const token  = await bank.authenticate();
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
  { name: "get_party",          domain: "SD-PartyReference",      sig: "({ consent_token? })",                                              desc: "Retrieve authenticated customer profile (KYC, risk rating)." },
  { name: "get_accounts",       domain: "SD-CurrentAccount",      sig: "({ consent_token? })",                                              desc: "List all accounts in scope for the given consent token." },
  { name: "get_balance",        domain: "SD-CurrentAccount",      sig: "({ account_id, consent_token? })",                                  desc: "Retrieve real-time available balance for an account." },
  { name: "get_transactions",   domain: "SD-Transactions",        sig: "({ account_id, from_date, to_date, limit?, cursor? })",             desc: "Paginated transaction history. Pass cursor to page forward." },
  { name: "initiate_payment",   domain: "SD-PaymentExecution",    sig: "({ debtor_account, creditor_account, amount, currency, reference })",desc: "Create and submit a domestic payment instruction." },
  { name: "get_payment_status", domain: "SD-PaymentExecution",    sig: "({ payment_id, consent_token? })",                                  desc: "Check execution status of a submitted payment." },
  { name: "get_loan_details",   domain: "SD-ConsumerLoan",        sig: "({ loan_id, consent_token? })",                                     desc: "Retrieve loan account details and repayment schedule." },
  { name: "apply_for_loan",     domain: "SD-ConsumerLoan",        sig: "({ party_id, amount, currency?, term_months, purpose })",           desc: "Submit a new loan application. Currency defaults to GBP." },
  { name: "get_card_details",   domain: "SD-CreditCard",          sig: "({ card_id, consent_token? })",                                     desc: "Retrieve card type, status, and credit limits." },
  { name: "block_card",         domain: "SD-CreditCard",          sig: '({ card_id, action: "block" | "unblock", consent_token? })',        desc: "Block or unblock a payment card." },
  { name: "get_portfolio",      domain: "SD-InvestmentPortfolio", sig: "({ portfolio_id, consent_token? })",                                desc: "Retrieve portfolio holdings, value, and YTD performance." },
  { name: "place_order",        domain: "SD-InvestmentPortfolio", sig: '({ portfolio_id, instrument, quantity, direction })',               desc: "Place a buy/sell order. Fractional quantities are supported." },
  { name: "run_aml_screen",     domain: "SD-RegulatoryReporting", sig: "({ subject_type, subject_id, consent_token? })",                    desc: "Run AML and sanctions screening against a party or transaction." },
  { name: "subscribe_events",   domain: "SD-CustomerEventHistory",sig: "({ party_id, event_types, webhook_url, consent_token? })",          desc: "Subscribe a webhook to real-time account events." },
];

export default function SdkTab({ onTryTool }) {
  const [copied, setCopied] = useState(null);
  const [activeSnippet, setActiveSnippet] = useState("quickstart");
  const [expandedRow, setExpandedRow] = useState("get_balance");
  const [searchQuery, setSearchQuery] = useState("");

  function copy(key, text) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  }

  const filteredTools = SDK_TOOLS.filter(
    t =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <section className="mcp-sec">
      <div className="sec-inner">
        <div className="sec-hdr-split">
          <div>
            <span className="sec-tag">AGENT SDK · @agentbank/sdk</span>
            <h2 className="sec-h">AgentBankAgent TypeScript &amp; JS Client</h2>
            <p className="sec-p" style={{ marginBottom: 0 }}>
              A zero-dependency client wrapping FAPI 2.0 authentication, idempotent <code className="inline-code">x-fapi-interaction-id</code> generation, and all 14 banking primitives into a single class.
            </p>
          </div>
          <div
            style={{
              background: "#0F172A",
              border: "1px solid #1E293B",
              borderRadius: 8,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <code style={{ fontFamily: "var(--mono)", fontSize: 12.5, color: "#34D399" }}>$ {INSTALL_SNIPPET}</code>
            <button
              type="button"
              onClick={() => copy("install", INSTALL_SNIPPET)}
              className="mcp-copy-btn"
              style={{ position: "static" }}
            >
              {copied === "install" ? "✓ COPIED" : "COPY"}
            </button>
          </div>
        </div>

        {/* Interactive Code & Constructor Workbench */}
        <div className="workbench-shell" style={{ marginTop: 32, marginBottom: 56 }}>
          <div className="workbench-tabs" role="tablist">
            {[
              { id: "quickstart",  label: "01 · Quick Start (FAPI + Sweep)" },
              { id: "claude",      label: "02 · With Anthropic Claude API" },
              { id: "constructor", label: "03 · Constructor & Auth Options" },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeSnippet === tab.id}
                className={`wb-tab ${activeSnippet === tab.id ? "on" : ""}`}
                onClick={() => setActiveSnippet(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeSnippet === "quickstart" && (
            <div className="wb-body">
              <div className="wb-info-bar">
                <span>Authenticate via OAuth 2.0 / FAPI 2.0, inspect balances, and execute an idempotent savings sweep:</span>
                <button className="mcp-copy-btn" style={{ position: "static" }} onClick={() => copy("quickstart", QUICKSTART_SNIPPET)}>
                  {copied === "quickstart" ? "✓ COPIED" : "COPY CODE"}
                </button>
              </div>
              <pre className="mcp-code" style={{ border: "none", borderRadius: 0 }}>{QUICKSTART_SNIPPET}</pre>
            </div>
          )}

          {activeSnippet === "claude" && (
            <div className="wb-body">
              <div className="wb-info-bar">
                <span>Wire <code style={{ color: "#93C5FD" }}>AgentBankAgent</code> directly into Claude <code style={{ color: "#93C5FD" }}>tool_use</code> blocks:</span>
                <button className="mcp-copy-btn" style={{ position: "static" }} onClick={() => copy("claude", CLAUDE_SNIPPET)}>
                  {copied === "claude" ? "✓ COPIED" : "COPY CODE"}
                </button>
              </div>
              <pre className="mcp-code" style={{ border: "none", borderRadius: 0 }}>{CLAUDE_SNIPPET}</pre>
            </div>
          )}

          {activeSnippet === "constructor" && (
            <div className="wb-body" style={{ background: "var(--surface)", color: "var(--ink)" }}>
              <div style={{ padding: "14px 20px", background: "var(--cream)", borderBottom: "1px solid var(--line)", fontFamily: "var(--mono)", fontSize: 12.5, fontWeight: 600 }}>
                new AgentBankAgent(&#123; scope, baseUrl?, clientId?, token? &#125;)
              </div>
              {[
                { param: "scope",    type: "string", req: true,  desc: 'Space-separated OAuth scopes, e.g. "accounts:read payments:write"' },
                { param: "baseUrl",  type: "string", req: false, desc: "agentBANK base URL. Defaults to AGENTBANK_BASE_URL env var or http://localhost:3000" },
                { param: "clientId", type: "string", req: false, desc: "OAuth client ID. Defaults to AGENT_CLIENT_ID env var" },
                { param: "token",    type: "string", req: false, desc: "Pre-existing bearer token. Skips authenticate() if provided; per-call consent_token overrides this." },
              ].map(p => (
                <div
                  key={p.param}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "140px 90px 90px 1fr",
                    gap: 16,
                    padding: "14px 20px",
                    borderBottom: "1px solid var(--line)",
                    fontSize: 13.5,
                    alignItems: "center",
                  }}
                >
                  <code style={{ fontFamily: "var(--mono)", fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{p.param}</code>
                  <code style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--mid)" }}>{p.type}</code>
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 10,
                      fontWeight: 600,
                      color: p.req ? "var(--accent)" : "var(--mid)",
                      background: p.req ? "var(--accent-soft)" : "var(--cream)",
                      padding: "2px 7px",
                      borderRadius: 4,
                      width: "fit-content",
                    }}
                  >
                    {p.req ? "REQUIRED" : "OPTIONAL"}
                  </span>
                  <span style={{ color: "var(--mid)" }}>{p.desc}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Progressive Disclosure Method Reference */}
        <div>
          <div className="sec-hdr-split" style={{ marginBottom: 18 }}>
            <div>
              <span className="sec-tag">METHOD REFERENCE · PROMISE API</span>
              <h3 className="sec-h" style={{ fontSize: "clamp(22px, 2.6vw, 30px)", marginBottom: 6 }}>14 SDK Methods on <code className="inline-code">agent.tools.*</code></h3>
              <p style={{ fontSize: 14, color: "var(--mid)" }}>Click any method row to inspect its signature and execute it in the Interactive API Console.</p>
            </div>
            <input
              type="search"
              placeholder="Filter methods or BIAN domain..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                fontFamily: "var(--sans)",
                fontSize: 13,
                padding: "8px 14px",
                borderRadius: 6,
                border: "1px solid var(--line)",
                background: "var(--surface)",
                color: "var(--ink)",
                minWidth: 250,
                outline: "none",
              }}
            />
          </div>

          <div style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", background: "var(--surface)" }}>
            {filteredTools.map((t, i) => {
              const isExp = expandedRow === t.name;
              return (
                <div
                  key={t.name}
                  style={{
                    borderBottom: i < filteredTools.length - 1 ? "1px solid var(--line)" : "none",
                    background: isExp ? "var(--accent-soft)" : i % 2 === 0 ? "var(--surface)" : "var(--bg)",
                    transition: "background 0.15s",
                  }}
                >
                  <div
                    onClick={() => setExpandedRow(isExp ? null : t.name)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "230px 180px 1fr auto",
                      gap: 16,
                      padding: "14px 20px",
                      alignItems: "center",
                      cursor: "pointer",
                    }}
                  >
                    <code style={{ fontFamily: "var(--mono)", fontSize: 12.5, color: "var(--accent)", fontWeight: 600 }}>
                      agent.tools.{t.name}
                    </code>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--mid)" }}>{t.domain}</span>
                    <span style={{ fontSize: 13.5, color: "var(--ink)" }}>{t.desc}</span>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>
                      {isExp ? "Hide ▴" : "Inspect ▾"}
                    </span>
                  </div>

                  {isExp && (
                    <div
                      style={{
                        padding: "0 20px 16px 20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 16,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink)", background: "#fff", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--line)" }}>
                        <span style={{ color: "var(--mid)" }}>Signature: </span>
                        <strong>agent.tools.{t.name}{t.sig}</strong>
                      </div>
                      {onTryTool && (
                        <button
                          type="button"
                          className="try-tool-btn"
                          onClick={() => onTryTool(t.name)}
                        >
                          Try in API Console →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Repository Links */}
        <div
          style={{
            marginTop: 40,
            padding: "18px 24px",
            borderRadius: 10,
            border: "1px solid var(--line)",
            background: "var(--surface)",
            display: "flex",
            gap: 28,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", color: "var(--accent)", textTransform: "uppercase" }}>
            Source Specifications
          </span>
          <a href="https://github.com/watsongm/agentbank/blob/main/sdk/index.js" target="_blank" rel="noreferrer" className="fl" style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink)", fontWeight: 500 }}>
            sdk/index.js on GitHub ↗
          </a>
          <a href="https://github.com/watsongm/agentbank/blob/main/openapi.yaml" target="_blank" rel="noreferrer" className="fl" style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink)", fontWeight: 500 }}>
            openapi.yaml (44 Endpoints) ↗
          </a>
          <a href="https://github.com/watsongm/agentbank/blob/main/mcp-server/index.js" target="_blank" rel="noreferrer" className="fl" style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink)", fontWeight: 500 }}>
            mcp-server/index.js ↗
          </a>
        </div>
      </div>
    </section>
  );
}
