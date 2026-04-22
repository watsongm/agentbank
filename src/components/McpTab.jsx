import { useState, useEffect, useRef } from "react";

const CLAUDE_DESKTOP_CONFIG = `{
  "mcpServers": {
    "agentbank": {
      "command": "node",
      "args": ["/path/to/agentbank/mcp-server/index.js"],
      "env": {
        "AGENTBANK_BASE_URL": "https://your-agentbank.example.com",
        "AGENTBANK_TOKEN": "Bearer eyJhbGci..."
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
  { account_id: z.string() },
  async ({ account_id }) => {
    const res = await fetch(\`\${BASE_URL}/bian/current-account/\${account_id}/balance\`,
      { headers: { Authorization: TOKEN } });
    return { content: [{ type: "text", text: JSON.stringify(await res.json(), null, 2) }] };
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

export default function McpTab({ tools, domains }) {
  const [copied, setCopied] = useState(null);
  const [msgIdx, setMsgIdx] = useState(0);
  const termRef             = useRef(null);

  useEffect(() => {
    if (msgIdx < MCP_HANDSHAKE.length) {
      const t = setTimeout(() => setMsgIdx(i => i + 1), 900);
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

  return (
    <section className="mcp-sec">
      <span className="sec-tag">MODEL CONTEXT PROTOCOL</span>
      <h2 className="sec-h">agentBANK as<br/>an MCP Server</h2>
      <p className="sec-p">The reference MCP server (<code style={{fontFamily:"var(--mono)",fontSize:13}}>mcp-server/</code>) exposes all 14 agentBANK tools over stdio transport — connect any MCP-compatible client in minutes.</p>

      <div className="mcp-grid">
        <div className="mcp-card">
          <div className="mcp-card-hdr">
            <span className="mcp-card-icon" style={{color:"var(--gold)"}}>⚙</span>
            <span className="mcp-card-title">Claude Desktop Config</span>
          </div>
          <p className="mcp-card-sub">Add this to <code style={{fontFamily:"var(--mono)"}}>~/.claude/claude_desktop_config.json</code> to connect Claude Desktop to agentBANK instantly.</p>
          <div className="mcp-copy-block">
            <pre className="mcp-code">{CLAUDE_DESKTOP_CONFIG}</pre>
            <button className="mcp-copy-btn" onClick={() => copy("cfg", CLAUDE_DESKTOP_CONFIG)}>{copied === "cfg" ? "✓ COPIED" : "COPY"}</button>
          </div>
        </div>

        <div className="mcp-card">
          <div className="mcp-card-hdr">
            <span className="mcp-card-icon" style={{color:"var(--blue)"}}>◈</span>
            <span className="mcp-card-title">Server Implementation</span>
          </div>
          <p className="mcp-card-sub">Built with <code style={{fontFamily:"var(--mono)"}}>@modelcontextprotocol/sdk</code> + Zod. Each agentBANK tool is a typed MCP tool with full schema validation.</p>
          <div className="mcp-copy-block">
            <pre className="mcp-code">{SERVER_SNIPPET}</pre>
            <button className="mcp-copy-btn" onClick={() => copy("srv", SERVER_SNIPPET)}>{copied === "srv" ? "✓ COPIED" : "COPY"}</button>
          </div>
        </div>
      </div>

      <div className="mcp-term">
        <div className="term">
          <div className="term-bar">
            <div className="tdot" style={{background:"#ff5f57"}}/><div className="tdot" style={{background:"#ffbd2e"}}/><div className="tdot" style={{background:"#28c840"}}/>
            <span className="term-lbl">MCP STDIO PROTOCOL TRACE</span>
            <button style={{marginLeft:"auto",fontFamily:"var(--mono)",fontSize:10,padding:"3px 9px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",color:"rgba(255,255,255,.3)",cursor:"pointer"}} onClick={() => setMsgIdx(0)}>↺ REPLAY</button>
          </div>
          <div className="term-body" ref={termRef} style={{maxHeight:280}}>
            {MCP_HANDSHAKE.slice(0, msgIdx).map((m, i) => (
              <div key={i} style={{marginBottom:8}}>
                <div style={{color: m.dir === "client" ? "#4fc3f7" : "#81c784", fontSize:10, marginBottom:2, letterSpacing:1}}>
                  {m.dir === "client" ? "▶ CLIENT →" : "◀ SERVER ←"}
                </div>
                <div style={{color:"rgba(255,255,255,.5)", fontSize:10, wordBreak:"break-all", lineHeight:1.6}}>{m.text}</div>
              </div>
            ))}
            {msgIdx < MCP_HANDSHAKE.length && <span style={{color:"rgba(255,255,255,.3)"}}>▌</span>}
          </div>
        </div>
      </div>

      <div style={{marginTop:48}}>
        <span className="sec-tag">MCP TOOL MANIFEST</span>
        <h3 className="sec-h" style={{fontSize:"clamp(22px,3vw,34px)",marginBottom:12}}>14 Tools · Full Schema</h3>
        <p style={{fontSize:14,color:"var(--mid)",marginBottom:24}}>Every agentBANK tool maps 1-to-1 to an MCP tool definition with Zod-validated inputSchema.</p>
        <div className="mcp-tools-grid">
          {tools.map(t => {
            const dom = domains.find(d => d.id === t.domain);
            return (
              <div key={t.name} className="mcp-tool">
                <div className="mcp-tool-name" style={{color: dom?.color}}>{t.name}</div>
                <div className="mcp-tool-desc">{t.desc}</div>
                <div className="mcp-schema">
                  {t.params.map((p, i) => (
                    <span key={p} className={`mcp-param ${i === 0 ? "req" : ""}`}>{p}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{marginTop:48,padding:28,border:"1px solid var(--line)",background:"var(--cream)"}}>
        <span className="sec-tag" style={{marginBottom:14}}>QUICK START</span>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {[
            {n:"1", cmd:"cp .env.example .env && nano .env", label:"Configure environment variables"},
            {n:"2", cmd:"cd mcp-server && npm install", label:"Install MCP server dependencies"},
            {n:"3", cmd:"AGENTBANK_BASE_URL=http://localhost:3000 node index.js", label:"Start the MCP server"},
            {n:"4", cmd:"# Add Claude Desktop config (see above), restart Claude Desktop", label:"Connect Claude Desktop"},
            {n:"5", cmd:'# Ask Claude: "What is the balance on account ACC-1829?"', label:"Start using agentBANK tools"},
          ].map(s => (
            <div key={s.n} style={{display:"flex",alignItems:"flex-start",gap:14}}>
              <div style={{width:24,height:24,borderRadius:"50%",background:"var(--ink)",color:"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--mono)",fontSize:11,fontWeight:700,flexShrink:0,marginTop:2}}>{s.n}</div>
              <div>
                <div style={{fontSize:12,fontWeight:600,marginBottom:4}}>{s.label}</div>
                <code style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--mid)"}}>{s.cmd}</code>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
