import { useState, useEffect, useRef } from "react";

const CLAUDE_DESKTOP_CONFIG = `{
  "mcpServers": {
    "agentbank": {
      "command": "node",
      "args": ["/path/to/agentbank/mcp-server/index.js"],
      "env": {
        "AGENTBANK_BASE_URL": "http://localhost:3000",
        "AGENTBANK_TOKEN": "Bearer demo-token"
      }
    }
  }
}`;

const SERVER_SNIPPET = `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "agentbank", version: "1.0.0" });

server.tool(
  "get_balance",
  "Retrieve real-time account balance.",
  {
    account_id: z.string().describe("Account ID (e.g. ACC-1829)"),
    consent_token: z.string().optional().describe("Optional FAPI consent token override")
  },
  async ({ account_id, consent_token }) => {
    const res = await apiCall("GET", \`/bian/current-account/\${account_id}/balance\`, null, consentHeaders(consent_token));
    return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
  }
);
// ... 13 more tools — see mcp-server/index.js

const transport = new StdioServerTransport();
await server.connect(transport);`;

const MCP_HANDSHAKE = [
  {dir:"client", text:'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","clientInfo":{"name":"claude-desktop","version":"1.0"}}}'},
  {dir:"server", text:'{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05","serverInfo":{"name":"agentbank","version":"1.0.0"},"capabilities":{"tools":{}}}}'},
  {dir:"client", text:'{"jsonrpc":"2.0","id":2,"method":"tools/list"}'},
  {dir:"server", text:'{"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"get_balance","description":"Retrieve real-time account balance.","inputSchema":{"type":"object","properties":{"account_id":{"type":"string"}},"required":["account_id"]}},{"name":"get_transactions","description":"Retrieve paginated transaction history.","inputSchema":{"type":"object","properties":{"account_id":{"type":"string"},"from_date":{"type":"string"},"to_date":{"type":"string"},"limit":{"type":"number"},"cursor":{"type":"string"}},"required":["account_id","from_date","to_date"]}},...12 more]}}'},
  {dir:"client", text:'{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_balance","arguments":{"account_id":"ACC-1829"}}}'},
  {dir:"server", text:'{"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"{\\"accountId\\":\\"ACC-1829\\",\\"available\\":4821.50,\\"currency\\":\\"GBP\\",\\"dateTime\\":\\"2026-04-11T09:14:22Z\\"}"}]}}'},
];

const GROUP_MAP = {
  all: null,
  core: ["party", "accounts", "savings"],
  payments: ["payments", "transactions"],
  credit: ["lending", "cards"],
  wealth: ["investments", "compliance", "notifications"],
};

export default function McpTab({ tools, domains, onTryTool }) {
  const [copied, setCopied] = useState(null);
  const [workbenchTab, setWorkbenchTab] = useState("config");
  const [msgIdx, setMsgIdx] = useState(0);
  const [groupFilter, setGroupFilter] = useState("all");
  const [expandedTools, setExpandedTools] = useState(() => new Set(["get_balance", "initiate_payment"]));
  const [expandAll, setExpandAll] = useState(false);
  const termRef = useRef(null);

  useEffect(() => {
    if (msgIdx < MCP_HANDSHAKE.length) {
      const t = setTimeout(() => setMsgIdx(i => i + 1), 750);
      return () => clearTimeout(t);
    }
  }, [msgIdx]);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [msgIdx]);

  function copy(key, text) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  }

  function toggleToolExpand(name) {
    setExpandedTools(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function handleExpandAll() {
    if (expandAll) {
      setExpandAll(false);
      setExpandedTools(new Set());
    } else {
      setExpandAll(true);
      setExpandedTools(new Set(tools.map(t => t.name)));
    }
  }

  const visibleTools = tools.filter(t => {
    const allowed = GROUP_MAP[groupFilter];
    return !allowed || allowed.includes(t.domain);
  });

  return (
    <section className="mcp-sec">
      <div className="sec-inner">
        <div className="sec-hdr-split">
          <div>
            <span className="sec-tag">MODEL CONTEXT PROTOCOL · MCP 1.0</span>
            <h2 className="sec-h">agentBANK as an MCP Server</h2>
            <p className="sec-p" style={{ marginBottom: 0 }}>
              The reference MCP server (<code className="inline-code">mcp-server/index.js</code>) exposes all 14 agentBANK primitives over stdio JSON-RPC 2.0 transport with strict Zod schema validation and per-call FAPI consent overrides.
            </p>
          </div>
          <div className="sec-meta-pill">
            <span>STDIO TRANSPORT</span>
            <span>·</span>
            <span>14 ZOD SCHEMAS</span>
          </div>
        </div>

        {/* Interactive Integration Workbench */}
        <div className="workbench-shell" style={{ marginTop: 32, marginBottom: 56 }}>
          <div className="workbench-tabs" role="tablist">
            {[
              { id: "config", label: "01 · Claude Desktop Config" },
              { id: "server", label: "02 · Server Implementation" },
              { id: "trace",  label: "03 · Live Stdio JSON-RPC Trace" },
              { id: "setup",  label: "04 · 5-Step Quickstart" },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={workbenchTab === tab.id}
                className={`wb-tab ${workbenchTab === tab.id ? "on" : ""}`}
                onClick={() => setWorkbenchTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {workbenchTab === "config" && (
            <div className="wb-body">
              <div className="wb-info-bar">
                <span>Add to <code style={{ color: "#93C5FD" }}>~/.claude/claude_desktop_config.json</code> to register all 14 banking tools with Claude Desktop or Cursor.</span>
                <button className="mcp-copy-btn" style={{ position: "static" }} onClick={() => copy("cfg", CLAUDE_DESKTOP_CONFIG)}>
                  {copied === "cfg" ? "✓ COPIED" : "COPY JSON"}
                </button>
              </div>
              <pre className="mcp-code" style={{ border: "none", borderRadius: 0 }}>{CLAUDE_DESKTOP_CONFIG}</pre>
            </div>
          )}

          {workbenchTab === "server" && (
            <div className="wb-body">
              <div className="wb-info-bar">
                <span>Built on <code style={{ color: "#93C5FD" }}>@modelcontextprotocol/sdk</code> + Zod. Includes automatic UUIDv4 <code style={{ color: "#93C5FD" }}>x-fapi-interaction-id</code> and 5xx retry logic.</span>
                <button className="mcp-copy-btn" style={{ position: "static" }} onClick={() => copy("srv", SERVER_SNIPPET)}>
                  {copied === "srv" ? "✓ COPIED" : "COPY CODE"}
                </button>
              </div>
              <pre className="mcp-code" style={{ border: "none", borderRadius: 0 }}>{SERVER_SNIPPET}</pre>
            </div>
          )}

          {workbenchTab === "trace" && (
            <div className="wb-body">
              <div className="wb-info-bar">
                <span>JSON-RPC 2.0 handshake and tool invocation stream between MCP Host and <code style={{ color: "#93C5FD" }}>agentbank</code> server:</span>
                <button
                  type="button"
                  className="mcp-copy-btn"
                  style={{ position: "static" }}
                  onClick={() => setMsgIdx(0)}
                >
                  ↺ REPLAY HANDSHAKE
                </button>
              </div>
              <div className="term-body" ref={termRef} style={{ maxHeight: 300, background: "#090D16" }}>
                {MCP_HANDSHAKE.slice(0, msgIdx).map((m, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ color: m.dir === "client" ? "#38BDF8" : "#34D399", fontSize: 10, fontWeight: 600, marginBottom: 2, letterSpacing: "0.06em" }}>
                      {m.dir === "client" ? "▶ MCP CLIENT → SERVER" : "◀ MCP SERVER → CLIENT"}
                    </div>
                    <div style={{ color: "#CBD5E1", fontSize: 11, wordBreak: "break-all", lineHeight: 1.6 }}>{m.text}</div>
                  </div>
                ))}
                {msgIdx < MCP_HANDSHAKE.length && <span style={{ color: "#38BDF8" }}>▌</span>}
              </div>
            </div>
          )}

          {workbenchTab === "setup" && (
            <div className="wb-body" style={{ background: "var(--surface)", color: "var(--ink)", padding: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
                {[
                  { n: "01", cmd: "cp .env.example .env", label: "Configure environment variables" },
                  { n: "02", cmd: "cd mcp-server && npm install", label: "Install MCP server dependencies" },
                  { n: "03", cmd: "AGENTBANK_BASE_URL=http://localhost:3000 node index.js", label: "Start the stdio MCP server" },
                  { n: "04", cmd: "# Paste config into claude_desktop_config.json", label: "Register with Claude Desktop / Cursor" },
                  { n: "05", cmd: '"What is the balance on account ACC-1829?"', label: "Invoke tools via natural language" },
                ].map(s => (
                  <div key={s.n} style={{ padding: 16, borderRadius: 8, border: "1px solid var(--line)", background: "var(--cream)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color: "var(--accent)", background: "var(--accent-soft)", padding: "2px 7px", borderRadius: 4 }}>{s.n}</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</span>
                    </div>
                    <code style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--mid)", display: "block", marginTop: 4 }}>{s.cmd}</code>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Progressive Disclosure Tool Manifest */}
        <div>
          <div className="sec-hdr-split" style={{ marginBottom: 20 }}>
            <div>
              <span className="sec-tag">MCP TOOL MANIFEST · PROGRESSIVE SCHEMA VIEW</span>
              <h3 className="sec-h" style={{ fontSize: "clamp(22px, 2.6vw, 30px)", marginBottom: 6 }}>14 Typed Tool Definitions</h3>
              <p style={{ fontSize: 14, color: "var(--mid)" }}>Click any tool card to surface its Zod input schema and test it live in the API Console.</p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {[
                ["all", "All (14)"],
                ["core", "Core Retail"],
                ["payments", "Payments & Txns"],
                ["credit", "Lending & Cards"],
                ["wealth", "Wealth & Risk"],
              ].map(([id, lbl]) => (
                <button
                  key={id}
                  type="button"
                  className={`filter-chip ${groupFilter === id ? "on" : ""}`}
                  onClick={() => setGroupFilter(id)}
                >
                  {lbl}
                </button>
              ))}
              <button type="button" className="filter-chip" onClick={handleExpandAll}>
                {expandAll ? "Collapse Schemas ▴" : "Expand All Schemas ▾"}
              </button>
            </div>
          </div>

          <div className="mcp-tools-grid" style={{ marginTop: 16 }}>
            {visibleTools.map(t => {
              const dom = domains.find(d => d.id === t.domain);
              const isExp = expandedTools.has(t.name);
              return (
                <div key={t.name} className={`mcp-tool ${isExp ? "expanded" : ""}`}>
                  <div
                    style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}
                    onClick={() => toggleToolExpand(t.name)}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span className="mcp-tool-name" style={{ color: dom?.color || "var(--accent)", marginBottom: 0 }}>{t.name}()</span>
                        <span className="dom-code-pill">{dom?.icon || "SD"}</span>
                      </div>
                      <div className="mcp-tool-desc" style={{ marginBottom: 0 }}>{t.desc}</div>
                    </div>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent)", flexShrink: 0 }}>
                      {isExp ? "Hide ▴" : "Schema ▾"}
                    </span>
                  </div>

                  {isExp && (
                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mid)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Input Parameters ({t.params.length}) · <span style={{ color: "var(--accent)" }}>{dom?.bian}</span>
                      </div>
                      <div className="mcp-schema" style={{ marginBottom: 12 }}>
                        {t.params.map(p => {
                          const cleanParam = p.replace(/\?$/, "");
                          const isReq = Array.isArray(t.required) ? t.required.includes(cleanParam) : !p.endsWith("?");
                          return (
                            <span key={p} className={`mcp-param ${isReq ? "req" : ""}`} title={isReq ? "Required parameter" : "Optional parameter"}>
                              {p}
                            </span>
                          );
                        })}
                      </div>
                      {onTryTool && (
                        <button
                          type="button"
                          className="try-tool-btn"
                          onClick={() => onTryTool(t.name)}
                        >
                          Try in Console →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
