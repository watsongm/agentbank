import { useState, useEffect, useRef, useMemo } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { OBS_TOOLS, OBS_MODELS, makeSpans, makeTraceSteps } from "./mock/sessions.js";
import { apiFetch } from "./api/index.js";

function CT({ active, payload, label, unit = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0d1520", border: "1px solid #1e2c3a", padding: "8px 12px", fontFamily: "monospace", fontSize: 11 }}>
      <div style={{ color: "#445566", marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>
          {p.name}: {p.value}{unit}
        </div>
      ))}
    </div>
  );
}

function normalizeBackendSession(item, index) {
  const id = item.id
    ? (String(item.id).startsWith("SES-") || String(item.id).startsWith("AUD-") ? String(item.id) : `AUD-${String(item.id).slice(0, 6)}`)
    : `AUD-${String(index + 1).padStart(5, "0")}`;
  const traceId = item.traceId || item.fapiInteractionId || item.interactionId || String(item.id || "backend-trace").padEnd(16, "0");
  return {
    id,
    traceId,
    customer: item.customer || item.partyId || item.actor || "Live Backend",
    model: item.model || OBS_MODELS[0],
    tool: item.tool || item.action || item.endpoint || "get_accounts",
    latency: typeof item.latency === "number" ? item.latency : (item.latencyMs || 210),
    inputTok: typeof item.inputTok === "number" ? item.inputTok : 420,
    outputTok: typeof item.outputTok === "number" ? item.outputTok : 140,
    toolCalls: typeof item.toolCalls === "number" ? item.toolCalls : 1,
    status: item.status === "error" || (item.statusCode && item.statusCode >= 400) ? "error" : "success",
    ts: item.ts || (item.createdAt ? new Date(item.createdAt).getTime() : Date.now()),
    source: item.source || "backend",
  };
}

export function ObservabilityOverlay({
  sessions,
  setSessions,
  history,
  obsPaused,
  setObsPaused,
  apiMode = "mock",
  token = "demo-token",
  onClose,
}) {
  const [obsTab, setObsTab] = useState("metrics");
  const [selSess, setSelSess] = useState(null);
  const [traceLines, setTraceLines] = useState([]);
  const [spans, setSpans] = useState([]);
  const [backendSyncStatus, setBackendSyncStatus] = useState(apiMode === "live" ? "syncing" : "mock");
  const traceRef = useRef(null);

  /* Poll live backend /observability/sessions when apiMode === "live" */
  useEffect(() => {
    if (apiMode !== "live" || obsPaused) {
      setBackendSyncStatus(apiMode === "live" ? "paused" : "mock");
      return;
    }
    let cancelled = false;

    async function pollBackendSessions() {
      try {
        const res = await apiFetch("GET", "/observability/sessions", null, token, "live");
        if (cancelled) return;
        const rawList = Array.isArray(res?.sessions)
          ? res.sessions
          : Array.isArray(res?.events)
          ? res.events
          : Array.isArray(res)
          ? res
          : [];
        if (rawList.length > 0) {
          const normalized = rawList.map((item, idx) => normalizeBackendSession(item, idx));
          setSessions(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            const existingTraces = new Set(prev.map(s => s.traceId));
            const fresh = normalized.filter(s => !existingIds.has(s.id) && !existingTraces.has(s.traceId));
            return fresh.length > 0 ? [...fresh, ...prev].slice(0, 40) : prev;
          });
        }
        setBackendSyncStatus("connected");
      } catch {
        if (!cancelled) setBackendSyncStatus("offline");
      }
    }

    pollBackendSessions();
    const interval = setInterval(pollBackendSessions, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [apiMode, obsPaused, token, setSessions]);

  /* Animate reasoning trace when a session is selected */
  const fullTraceSteps = useMemo(() => (selSess ? makeTraceSteps(selSess) : []), [selSess]);

  useEffect(() => {
    if (!selSess) return;
    setTraceLines([]);
    setSpans(makeSpans(selSess));
    let i = 0;
    const t = setInterval(() => {
      if (i < fullTraceSteps.length) {
        const nextStep = fullTraceSteps[i];
        i++;
        setTraceLines(p => [...p, nextStep]);
      } else {
        clearInterval(t);
      }
    }, 190);
    return () => clearInterval(t);
  }, [selSess, fullTraceSteps]);

  useEffect(() => {
    if (traceRef.current) traceRef.current.scrollTop = traceRef.current.scrollHeight;
  }, [traceLines]);

  /* Derived observability metrics (deterministic, memoized) */
  const rec = useMemo(() => sessions.slice(0, 30), [sessions]);
  const avgLat = useMemo(
    () => (rec.length ? Math.round(rec.reduce((a, s) => a + s.latency, 0) / rec.length) : 0),
    [rec],
  );
  const totTok = useMemo(
    () => rec.reduce((a, s) => a + s.inputTok + s.outputTok, 0),
    [rec],
  );
  const errPct = useMemo(
    () => (rec.length ? +(rec.filter(s => s.status !== "success").length / rec.length * 100).toFixed(1) : 0),
    [rec],
  );
  const avgTool = useMemo(
    () => (rec.length ? +(rec.reduce((a, s) => a + s.toolCalls, 0) / rec.length).toFixed(1) : 0),
    [rec],
  );

  const toolDist = useMemo(() => {
    return OBS_TOOLS.map((n, idx) => {
      const matching = rec.filter(s => s.tool === n);
      const calls = matching.reduce((sum, s) => sum + (s.toolCalls || 1), 0);
      return {
        name: n.replace(/_/g, " "),
        calls: calls > 0 ? calls : Math.max(1, OBS_TOOLS.length - idx),
      };
    }).sort((a, b) => b.calls - a.calls);
  }, [rec]);

  const spanMax = spans.length ? Math.max(...spans.map(s => s.start + s.dur)) || 1 : 1;
  const spColors = ["#4fc3f7", "#81c784", "#ffb74d", "#ce93d8", "#ef9a9a", "#80cbc4"];

  return (
    <div className="obs-wrap" role="dialog" aria-modal="true" aria-label="Observability Dashboard">
      <div className="obs-top">
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div className="obs-logo">AGENT<span>BANK</span></div>
          <span className="obs-sub">OBSERVABILITY</span>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              padding: "2px 7px",
              border: "1px solid",
              borderColor: apiMode === "live" ? "rgba(79,195,247,.4)" : "rgba(201,168,76,.35)",
              color: apiMode === "live" ? "var(--blue)" : "var(--gold)",
              background: apiMode === "live" ? "rgba(79,195,247,.08)" : "rgba(201,168,76,.08)",
              letterSpacing: 1,
            }}
          >
            {apiMode === "live"
              ? `LIVE BACKEND (${backendSyncStatus.toUpperCase()})`
              : "MOCK TELEMETRY"}
          </span>
        </div>
        <div className="obs-right">
          <div className="live-pill">
            <div className="ldot" />
            <span className="ltext">LIVE · {sessions.length} SESSIONS</span>
          </div>
          <button
            className={`pause-btn ${obsPaused ? "paused" : ""}`}
            onClick={() => setObsPaused(p => !p)}
          >
            {obsPaused ? "▶ RESUME" : "⏸ PAUSE"}
          </button>
          <button className="console-x" onClick={onClose}>✕ CLOSE</button>
        </div>
      </div>

      <div className="obs-tabs" role="tablist">
        {[["metrics", "LLM METRICS"], ["trace", "AGENT TRACE"], ["otel", "OTEL SPANS"]].map(([id, lbl]) => (
          <button
            key={id}
            role="tab"
            aria-selected={obsTab === id}
            className={`otab ${obsTab === id ? "on" : ""}`}
            onClick={() => setObsTab(id)}
          >
            {lbl}
          </button>
        ))}
      </div>

      {obsTab === "metrics" && (
        <div className="obs-page">
          <div className="kpi-row">
            {[
              { l: "AVG LATENCY",    v: `${avgLat}ms`,                   c: "var(--orange)" },
              { l: "TOTAL TOKENS",   v: `${(totTok / 1000).toFixed(1)}k`, c: "var(--blue)" },
              { l: "AVG TOOL CALLS", v: avgTool,                          c: "var(--purple)" },
              { l: "ERROR RATE",     v: `${errPct}%`,                     c: errPct > 5 ? "var(--red)" : "var(--green)" },
              { l: "LIVE SESSIONS",  v: sessions.length,                  c: "var(--green)" },
              { l: "MODELS ACTIVE",  v: OBS_MODELS.length,                c: "var(--blue)" },
            ].map(k => (
              <div key={k.l} className="kpi">
                <div className="kpi-lbl">{k.l}</div>
                <div className="kpi-val" style={{ color: k.c }}>{k.v}</div>
              </div>
            ))}
          </div>

          <div className="chart-row">
            <div className="chart-card">
              <div className="chart-hdr">AGENT LATENCY (ms)</div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gl1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffb74d" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ffb74d" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" />
                  <XAxis dataKey="t" tick={{ fill: "#2a3a4a", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "#2a3a4a", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CT unit="ms" />} />
                  <Area type="monotone" dataKey="latency" stroke="#ffb74d" strokeWidth={2} fill="url(#gl1)" name="latency" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <div className="chart-hdr">TOKEN USAGE (in / out)</div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gl2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4fc3f7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4fc3f7" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gl3" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ce93d8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ce93d8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" />
                  <XAxis dataKey="t" tick={{ fill: "#2a3a4a", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "#2a3a4a", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CT unit=" tok" />} />
                  <Area type="monotone" dataKey="inputTok" stroke="#4fc3f7" strokeWidth={2} fill="url(#gl2)" name="input" dot={false} />
                  <Area type="monotone" dataKey="outputTok" stroke="#ce93d8" strokeWidth={2} fill="url(#gl3)" name="output" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-row-3">
            <div className="chart-card">
              <div className="chart-hdr">TOOL CALLS / SESSION</div>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gl4" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00e676" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00e676" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" />
                  <XAxis dataKey="t" tick={{ fill: "#2a3a4a", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "#2a3a4a", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CT />} />
                  <Area type="monotone" dataKey="toolCalls" stroke="#00e676" strokeWidth={2} fill="url(#gl4)" name="calls" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <div className="chart-hdr">TOP TOOLS BY VOLUME</div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={toolDist.slice(0, 6)} layout="vertical" margin={{ top: 0, right: 4, left: 70, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#2a3a4a", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#7899aa", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CT />} />
                  <Bar dataKey="calls" fill="#ce93d8" radius={[0, 2, 2, 0]} name="calls" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <div className="chart-hdr">ERRORS AND SESSIONS</div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={history.slice(-10)} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" />
                  <XAxis dataKey="t" tick={{ fill: "#2a3a4a", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "#2a3a4a", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CT />} />
                  <Bar dataKey="sessions" fill="rgba(79,195,247,.45)" name="sessions" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="errors" fill="rgba(255,82,82,.65)" name="errors" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="sess-table">
            <div className="srow srow-hdr">
              <span>SESSION</span><span>MODEL</span><span>CUSTOMER</span><span>LATENCY</span><span>TOKENS</span><span>STATUS</span><span>TOOLS</span>
            </div>
            {sessions.slice(0, 14).map(s => (
              <div
                key={s.id}
                className={`srow ${selSess?.id === s.id ? "on" : ""} ${s.source === "console" || s.source === "backend" ? "console-row" : ""}`}
                onClick={() => { setSelSess(s); setObsTab("trace"); }}
              >
                <span style={{ color: "var(--gold)", fontFamily: "monospace" }}>{s.id}</span>
                <span style={{ color: "var(--blue)", fontSize: 10 }}>{s.model.replace("claude-", "")}</span>
                <span style={{ color: s.source === "console" || s.source === "backend" ? "var(--blue)" : undefined }}>
                  {s.customer}
                </span>
                <span style={{ color: "var(--orange)" }}>{s.latency}ms</span>
                <span>{((s.inputTok + s.outputTok) / 1000).toFixed(1)}k</span>
                <span><span className={`sbadge sb-${s.status}`}>{s.status}</span></span>
                <span style={{ color: "#445566" }}>{s.toolCalls}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {obsTab === "trace" && (
        <div className="obs-page">
          {!selSess ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, color: "#2a3a4a", gap: 10 }}>
              <div style={{ fontSize: 28, opacity: 0.3 }}>◎</div>
              <div style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: 1 }}>SELECT A SESSION FROM METRICS TAB</div>
            </div>
          ) : (
            <div className="trace-layout">
              <div className="trace-panel">
                <div className="panel-hdr">
                  <span className="panel-hdr-lbl">AGENT REASONING TRACE</span>
                  <span className="panel-tid">{selSess.traceId.slice(0, 20)}…</span>
                </div>
                <div className="trace-body" ref={traceRef}>
                  {traceLines.map((ln, i) => (
                    <div key={i} className="tl">
                      <span className="tl-t">+{ln.t}ms</span>
                      <span className={`tl-${ln.type}`}>{ln.text}</span>
                    </div>
                  ))}
                  {traceLines.length < fullTraceSteps.length && (
                    <span style={{ color: "rgba(201,168,76,.5)", animation: "pulse 1s infinite" }}>▌</span>
                  )}
                </div>
              </div>
              <div className="detail-panel">
                <div className="detail-sec">
                  <div className="dlbl">Session Details</div>
                  {[
                    ["Session", selSess.id, "gold"],
                    ["Customer", selSess.customer, ""],
                    ["Model", selSess.model, "blue"],
                    ["Status", selSess.status, selSess.status === "success" ? "green" : "red"],
                    ["Latency", selSess.latency + "ms", ""],
                    ["Tool Calls", selSess.toolCalls, ""],
                    ["Source", selSess.source ?? "simulated", ""],
                  ].map(([k, v, c]) => (
                    <div key={k} className="drow">
                      <span className="dk">{k}</span>
                      <span className={`dv ${c}`}>{v}</span>
                    </div>
                  ))}
                </div>
                <div className="detail-sec">
                  <div className="dlbl">Token Usage</div>
                  {[["Input", selSess.inputTok, "#4fc3f7"], ["Output", selSess.outputTok, "#ce93d8"]].map(([k, v, col]) => (
                    <div key={k} className="tok-wrap">
                      <div className="tok-row">
                        <span>{k} tokens</span>
                        <span style={{ color: col }}>{v.toLocaleString()}</span>
                      </div>
                      <div className="tok-track">
                        <div className="tok-fill" style={{ width: (v / ((selSess.inputTok + selSess.outputTok) || 1) * 100) + "%", background: col }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="detail-sec">
                  <div className="dlbl">Other Sessions</div>
                  {sessions.slice(0, 6).map(s => (
                    <div
                      key={s.id}
                      style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,.04)", cursor: "pointer" }}
                      onClick={() => setSelSess(s)}
                    >
                      <span style={{ fontFamily: "monospace", fontSize: 10, color: selSess.id === s.id ? "var(--gold)" : "#445566" }}>{s.id}</span>
                      <span style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,.6)" }}>{s.customer.split(" ")[0]}</span>
                      <span className={`sbadge sb-${s.status}`}>{s.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {obsTab === "otel" && (
        <div className="obs-page">
          {!selSess ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, color: "#2a3a4a", gap: 10 }}>
              <div style={{ fontSize: 28, opacity: 0.3 }}>◎</div>
              <div style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: 1 }}>SELECT A SESSION FROM METRICS TAB</div>
            </div>
          ) : (
            <>
              <div className="kpi-row" style={{ marginBottom: 14 }}>
                {[
                  ["TRACE ID", selSess.traceId.slice(0, 16) + "…", ""],
                  ["TOTAL SPANS", spans.length, "var(--blue)"],
                  ["ROOT DURATION", spanMax + "ms", "var(--orange)"],
                  ["SERVICES", [...new Set(spans.map(s => s.service))].length, "var(--green)"],
                  ["ERRORS", spans.filter(s => s.status === "error").length, spans.some(s => s.status === "error") ? "var(--red)" : "var(--green)"],
                ].map(([l, v, c]) => (
                  <div key={l} className="kpi" style={{ padding: "11px 13px" }}>
                    <div className="kpi-lbl">{l}</div>
                    <div className="kpi-val" style={{ fontSize: 15, color: c || "rgba(255,255,255,.75)" }}>{v}</div>
                  </div>
                ))}
              </div>
              <div className="span-panel">
                <div className="panel-hdr">
                  <span className="panel-hdr-lbl">Trace Waterfall</span>
                  <span className="panel-tid">{selSess.traceId}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 10, color: "#445566", marginLeft: "auto" }}>{selSess.model}</span>
                </div>
                <div className="span-body">
                  <div style={{ display: "flex", paddingLeft: 220, paddingBottom: 6, minWidth: 500 }}>
                    {[0, 25, 50, 75, 100].map(p => (
                      <span key={p} style={{ fontFamily: "monospace", fontSize: 9, color: "#2a3a4a", flex: 1 }}>
                        {Math.round(spanMax * p / 100)}ms
                      </span>
                    ))}
                  </div>
                  {spans.map((sp, i) => (
                    <div key={sp.name + i} className="span-row" style={{ paddingLeft: sp.depth * 16 }}>
                      <div className="span-info">
                        <div className="span-name">{sp.name}</div>
                        <div className="span-svc" style={{ color: spColors[i % spColors.length] }}>{sp.service}</div>
                      </div>
                      <div className="span-track">
                        {[25, 50, 75].map(p => (
                          <div key={p} style={{ position: "absolute", left: p + "%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,.04)" }} />
                        ))}
                        <div
                          className="span-bar"
                          style={{
                            left: (sp.start / spanMax * 100) + "%",
                            width: Math.max(sp.dur / spanMax * 100, 0.5) + "%",
                            background: sp.status === "ok" ? spColors[i % spColors.length] + "99" : "rgba(255,82,82,.7)",
                          }}
                        >
                          {sp.dur > spanMax * 0.08 ? sp.dur + "ms" : ""}
                        </div>
                      </div>
                      <div className="span-dur">{sp.dur}ms</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="span-panel">
                <div className="panel-hdr">
                  <span className="panel-hdr-lbl">Span Attributes</span>
                </div>
                <div className="attr-grid">
                  {spans.map((sp, i) => (
                    <div key={sp.name + i} className="attr-card">
                      <div className="attr-name" style={{ color: spColors[i % spColors.length] }}>{sp.name}</div>
                      {[
                        ["service", sp.service],
                        ["status", sp.status],
                        ["duration", sp.dur + "ms"],
                        ["http.status_code", "200"],
                        ["fapi.interaction_id", selSess.traceId.slice(0, 12) + "…"],
                      ].map(([k, v]) => (
                        <div key={k} className="attr-row">
                          <span className="attr-k">{k}</span>
                          <span className="attr-v" style={{ color: k === "status" && sp.status === "error" ? "var(--red)" : undefined }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default ObservabilityOverlay;
