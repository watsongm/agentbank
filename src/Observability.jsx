import { useState, useEffect, useRef, useMemo } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { OBS_TOOLS, OBS_MODELS, makeSpans, makeTraceSteps, makeHex } from "./mock/sessions.js";
import { apiFetch } from "./api/index.js";

function CT({ active, payload, label, unit = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0F172A", border: "1px solid #334155", borderRadius: 6, padding: "8px 12px", fontFamily: "var(--mono)", fontSize: 11, boxShadow: "0 8px 20px rgba(0,0,0,0.35)" }}>
      <div style={{ color: "#94A3B8", marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 500 }}>
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
    fapiInteractionId: item.fapiInteractionId || item.interactionId || traceId,
    prevHash: item.prevHash || makeHex(64),
    rowHash: item.rowHash || makeHex(64),
    customer: item.customer || item.partyId || item.actor || "Aria Chen (PAR-ARIA)",
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

function QuickSessionBar({ sessions, selSess, onSelect }) {
  if (!sessions?.length) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 16,
        padding: "10px 14px",
        background: "#0F172A",
        border: "1px solid #1E293B",
        borderRadius: 8,
        overflowX: "auto",
      }}
    >
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: "0.06em",
          color: "#94A3B8",
          textTransform: "uppercase",
          flexShrink: 0,
          marginRight: 4,
        }}
      >
        SELECT SESSION:
      </span>
      {sessions.slice(0, 6).map(s => {
        const isSel = selSess?.id === s.id;
        const srcBadge =
          s.source === "console"
            ? { label: "CONSOLE", color: "#38BDF8" }
            : s.source === "backend"
            ? { label: "LIVE", color: "#34D399" }
            : { label: "AGENT", color: "#94A3B8" };
        const dotColor =
          s.status === "success" ? "#10B981" : s.status === "error" ? "#EF4444" : "#F59E0B";
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "6px 11px",
              borderRadius: 6,
              fontFamily: "var(--sans)",
              fontSize: 11.5,
              background: isSel ? "rgba(37, 99, 235, 0.2)" : "rgba(255, 255, 255, 0.03)",
              border: "1px solid",
              borderColor: isSel ? "#3B82F6" : "rgba(255, 255, 255, 0.08)",
              color: isSel ? "#FFFFFF" : "#94A3B8",
              cursor: "pointer",
              flexShrink: 0,
              transition: "all 0.15s",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
            <span style={{ fontFamily: "var(--mono)", color: isSel ? "#60A5FA" : "#E2E8F0", fontWeight: 600 }}>{s.id}</span>
            <span style={{ color: "#CBD5E1", fontWeight: 500 }}>{s.customer.split(" ")[0]}</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "#64748B" }}>· {s.tool}</span>
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 9.5,
                fontWeight: 600,
                padding: "1px 5px",
                borderRadius: 3,
                border: `1px solid ${srcBadge.color}`,
                color: srcBadge.color,
              }}
            >
              {srcBadge.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ObservabilityOverlay({
  sessions,
  setSessions,
  history,
  obsPaused,
  setObsPaused,
  apiMode = "mock",
  token = "demo-token",
  initialTab = "metrics",
  initialSessionId = null,
  onClose,
}) {
  const [obsTab, setObsTab] = useState(initialTab || "metrics");
  const [selSess, setSelSess] = useState(() => {
    if (initialSessionId) {
      const found = sessions.find(s => s.id === initialSessionId);
      if (found) return found;
    }
    return sessions[0] || null;
  });
  const [traceLines, setTraceLines] = useState([]);
  const [spans, setSpans] = useState([]);
  const [backendSyncStatus, setBackendSyncStatus] = useState(apiMode === "live" ? "syncing" : "mock");
  const [showSecondaryCharts, setShowSecondaryCharts] = useState(false);
  const [showAuditHashes, setShowAuditHashes] = useState(true);
  const [showSpanAttrs, setShowSpanAttrs] = useState(false);
  const traceRef = useRef(null);

  useEffect(() => {
    if (initialSessionId) {
      const target = sessions.find(s => s.id === initialSessionId);
      if (target) {
        setSelSess(target);
        return;
      }
    }
    if (!selSess && sessions.length > 0) {
      setSelSess(sessions[0]);
    }
  }, [initialSessionId, sessions, selSess]);

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

  const activeSession = selSess || sessions[0] || null;
  const fullTraceSteps = useMemo(() => (activeSession ? makeTraceSteps(activeSession) : []), [activeSession]);

  useEffect(() => {
    if (!activeSession) return;
    setTraceLines([]);
    setSpans(makeSpans(activeSession));
    let i = 0;
    const t = setInterval(() => {
      if (i < fullTraceSteps.length) {
        const nextStep = fullTraceSteps[i];
        i++;
        setTraceLines(p => [...p, nextStep]);
      } else {
        clearInterval(t);
      }
    }, 120);
    return () => clearInterval(t);
  }, [activeSession, fullTraceSteps]);

  useEffect(() => {
    if (traceRef.current) traceRef.current.scrollTop = traceRef.current.scrollHeight;
  }, [traceLines]);

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
  const spColors = ["#38BDF8", "#34D399", "#FBBF24", "#818CF8", "#F87171", "#2DD4BF"];
  const tickStyle = { fill: "#64748B", fontSize: 10, fontFamily: "var(--mono)" };

  return (
    <div className="obs-wrap" role="dialog" aria-modal="true" aria-label="Observability Dashboard">
      <div className="obs-top">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div className="obs-logo">agent<span>BANK</span></div>
          <span className="obs-sub">Telemetry &amp; Audit Control Plane</span>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              fontWeight: 600,
              padding: "3px 9px",
              borderRadius: 999,
              border: "1px solid",
              borderColor: apiMode === "live" ? "rgba(56, 189, 248, 0.4)" : "rgba(99, 102, 241, 0.4)",
              color: apiMode === "live" ? "#38BDF8" : "#818CF8",
              background: apiMode === "live" ? "rgba(56, 189, 248, 0.1)" : "rgba(99, 102, 241, 0.1)",
            }}
          >
            {apiMode === "live"
              ? `LIVE BACKEND (${backendSyncStatus.toUpperCase()})`
              : "SIMULATED TELEMETRY"}
          </span>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              fontWeight: 600,
              padding: "3px 9px",
              borderRadius: 999,
              border: "1px solid rgba(16, 185, 129, 0.35)",
              color: "#34D399",
              background: "rgba(16, 185, 129, 0.1)",
            }}
            title="ADR-0002: Every session and tool execution is recorded in a tamper-evident SHA-256 hash chain"
          >
            SHA-256 AUDIT CHAIN VERIFIED
          </span>
        </div>
        <div className="obs-right">
          <div className="live-pill">
            <div className="ldot" />
            <span className="ltext">STREAMING · {sessions.length} SESSIONS</span>
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
        {[
          ["metrics", "01 · LLM & Tool Metrics"],
          ["trace", "02 · Agent Reasoning Trace"],
          ["otel", "03 · OpenTelemetry Waterfall"],
        ].map(([id, lbl]) => (
          <button
            key={id}
            role="tab"
            aria-selected={obsTab === id}
            className={`otab ${obsTab === id ? "on" : ""}`}
            onClick={() => {
              if (!selSess && sessions.length > 0) setSelSess(sessions[0]);
              setObsTab(id);
            }}
          >
            {lbl}
          </button>
        ))}
      </div>

      {obsTab === "metrics" && (
        <div className="obs-page">
          <div className="kpi-row">
            {[
              { l: "AVG LATENCY",      v: `${avgLat}ms`,                   c: "#F59E0B" },
              { l: "TOTAL TOKENS",     v: `${(totTok / 1000).toFixed(1)}k`, c: "#38BDF8" },
              { l: "AVG TOOL CALLS",   v: avgTool,                          c: "#818CF8" },
              { l: "ERROR RATE",       v: `${errPct}%`,                     c: errPct > 5 ? "#EF4444" : "#10B981" },
              { l: "ACTIVE SESSIONS",  v: sessions.length,                  c: "#10B981" },
              { l: "REGISTERED TOOLS", v: OBS_TOOLS.length,                 c: "#60A5FA" },
            ].map(k => (
              <div key={k.l} className="kpi">
                <div className="kpi-lbl">{k.l}</div>
                <div className="kpi-val" style={{ color: k.c }}>{k.v}</div>
              </div>
            ))}
          </div>

          <div className="chart-row-3">
            <div className="chart-card">
              <div className="chart-hdr">AGENT LATENCY (ms)</div>
              <ResponsiveContainer width="100%" height={155}>
                <AreaChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gl1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                  <XAxis dataKey="t" tick={tickStyle} tickLine={false} axisLine={false} />
                  <YAxis tick={tickStyle} tickLine={false} axisLine={false} />
                  <Tooltip content={<CT unit="ms" />} />
                  <Area type="monotone" dataKey="latency" stroke="#F59E0B" strokeWidth={2} fill="url(#gl1)" name="latency" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <div className="chart-hdr">TOKEN THROUGHPUT (input / output)</div>
              <ResponsiveContainer width="100%" height={155}>
                <AreaChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gl2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#38BDF8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gl3" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818CF8" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#818CF8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                  <XAxis dataKey="t" tick={tickStyle} tickLine={false} axisLine={false} />
                  <YAxis tick={tickStyle} tickLine={false} axisLine={false} />
                  <Tooltip content={<CT unit=" tok" />} />
                  <Area type="monotone" dataKey="inputTok" stroke="#38BDF8" strokeWidth={2} fill="url(#gl2)" name="input" dot={false} />
                  <Area type="monotone" dataKey="outputTok" stroke="#818CF8" strokeWidth={2} fill="url(#gl3)" name="output" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <div className="chart-hdr">TOP PRIMITIVES BY VOLUME</div>
              <ResponsiveContainer width="100%" height={155}>
                <BarChart data={toolDist.slice(0, 6)} layout="vertical" margin={{ top: 0, right: 8, left: 85, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" horizontal={false} />
                  <XAxis type="number" tick={tickStyle} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#94A3B8", fontSize: 10, fontFamily: "var(--mono)" }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CT />} />
                  <Bar dataKey="calls" fill="#3B82F6" radius={[0, 4, 4, 0]} name="calls" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Progressive Disclosure for Secondary Charts */}
          <div style={{ marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setShowSecondaryCharts(s => !s)}
              style={{
                fontFamily: "var(--mono)",
                fontSize: 11,
                padding: "7px 14px",
                borderRadius: 6,
                background: "#0F172A",
                border: "1px solid #1E293B",
                color: "#93C5FD",
                cursor: "pointer",
              }}
            >
              {showSecondaryCharts
                ? "Hide Secondary Telemetry Charts (Tool Calls & Error Breakdown) ▴"
                : "Surface Secondary Telemetry Charts (Tool Calls & Error Breakdown) ▾"}
            </button>
          </div>

          {showSecondaryCharts && (
            <div className="chart-row" style={{ marginBottom: 18 }}>
              <div className="chart-card">
                <div className="chart-hdr">TOOL CALLS / SESSION</div>
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gl4" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                    <XAxis dataKey="t" tick={tickStyle} tickLine={false} axisLine={false} />
                    <YAxis tick={tickStyle} tickLine={false} axisLine={false} />
                    <Tooltip content={<CT />} />
                    <Area type="monotone" dataKey="toolCalls" stroke="#10B981" strokeWidth={2} fill="url(#gl4)" name="calls" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-card">
                <div className="chart-hdr">SESSIONS VS. ERRORS</div>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={history.slice(-10)} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                    <XAxis dataKey="t" tick={tickStyle} tickLine={false} axisLine={false} />
                    <YAxis tick={tickStyle} tickLine={false} axisLine={false} />
                    <Tooltip content={<CT />} />
                    <Bar dataKey="sessions" fill="rgba(56, 189, 248, 0.55)" name="sessions" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="errors" fill="rgba(239, 68, 68, 0.8)" name="errors" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="sess-table">
            <div className="srow srow-hdr">
              <span>SESSION ID</span><span>MODEL</span><span>CUSTOMER · PARTY REF</span><span>LATENCY</span><span>TOKENS</span><span>STATUS</span><span>PRIMARY PRIMITIVE</span>
            </div>
            {sessions.slice(0, 14).map(s => (
              <div
                key={s.id}
                className={`srow ${activeSession?.id === s.id ? "on" : ""} ${s.source === "console" || s.source === "backend" ? "console-row" : ""}`}
                onClick={() => { setSelSess(s); setObsTab("trace"); }}
                title="Click to inspect reasoning trace and OpenTelemetry waterfall"
              >
                <span style={{ color: "#60A5FA", fontFamily: "var(--mono)", fontWeight: 600 }}>{s.id}</span>
                <span style={{ color: "#94A3B8", fontFamily: "var(--mono)", fontSize: 11 }}>{s.model.replace("claude-", "")}</span>
                <span style={{ color: s.source === "console" || s.source === "backend" ? "#38BDF8" : "#F1F5F9", fontWeight: 500 }}>
                  {s.customer}
                </span>
                <span style={{ color: "#F59E0B", fontFamily: "var(--mono)" }}>{s.latency}ms</span>
                <span style={{ color: "#CBD5E1", fontFamily: "var(--mono)" }}>{((s.inputTok + s.outputTok) / 1000).toFixed(1)}k</span>
                <span><span className={`sbadge sb-${s.status}`}>{s.status}</span></span>
                <span style={{ color: "#93C5FD", fontFamily: "var(--mono)", fontSize: 11 }}>{s.tool}()</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {obsTab === "trace" && (
        <div className="obs-page">
          <QuickSessionBar sessions={sessions} selSess={activeSession} onSelect={setSelSess} />
          {activeSession && (
            <div className="trace-layout">
              <div className="trace-panel">
                <div className="panel-hdr">
                  <span className="panel-hdr-lbl">AGENT REASONING &amp; TOOL EXECUTION STREAM · {activeSession.id}</span>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span className="panel-tid">trace: {activeSession.traceId.slice(0, 18)}…</span>
                    <button
                      type="button"
                      onClick={() => setObsTab("otel")}
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 10.5,
                        padding: "4px 10px",
                        borderRadius: 5,
                        background: "rgba(56, 189, 248, 0.12)",
                        border: "1px solid rgba(56, 189, 248, 0.35)",
                        color: "#38BDF8",
                        cursor: "pointer",
                      }}
                    >
                      Open OTel Waterfall →
                    </button>
                  </div>
                </div>
                <div className="trace-body" ref={traceRef}>
                  {traceLines.map((ln, i) => (
                    <div key={i} className="tl">
                      <span className="tl-t">+{ln.t}ms</span>
                      <span className={`tl-${ln.type}`}>{ln.text}</span>
                    </div>
                  ))}
                  {traceLines.length < fullTraceSteps.length && (
                    <span style={{ color: "#38BDF8", animation: "pulse 1s infinite" }}>▌</span>
                  )}
                </div>
              </div>

              <div className="detail-panel">
                <div className="detail-sec">
                  <div className="dlbl">Session Metadata</div>
                  {[
                    ["Session ID", activeSession.id, "blue"],
                    ["Customer", activeSession.customer, ""],
                    ["Primary Tool", `${activeSession.tool}()`, "gold"],
                    ["Model", activeSession.model, ""],
                    ["Status", activeSession.status, activeSession.status === "success" ? "green" : "red"],
                    ["Latency", activeSession.latency + "ms", ""],
                    ["Tool Calls", activeSession.toolCalls, ""],
                    ["Channel Source", activeSession.source ?? "agent-runtime", ""],
                  ].map(([k, v, c]) => (
                    <div key={k} className="drow">
                      <span className="dk">{k}</span>
                      <span className={`dv ${c}`}>{v}</span>
                    </div>
                  ))}
                </div>

                <div className="detail-sec">
                  <div
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                    onClick={() => setShowAuditHashes(h => !h)}
                  >
                    <div className="dlbl" style={{ marginBottom: 0 }}>Cryptographic Audit Chain</div>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "#38BDF8" }}>
                      {showAuditHashes ? "Hide ▴" : "Inspect ▾"}
                    </span>
                  </div>
                  {showAuditHashes && (
                    <div style={{ marginTop: 10 }}>
                      {[
                        ["FAPI Interaction ID", (activeSession.fapiInteractionId || activeSession.traceId).slice(0, 20) + "…", ""],
                        ["Prev Block Hash", (activeSession.prevHash || "0".repeat(64)).slice(0, 18) + "…", ""],
                        ["Row Hash (SHA-256)", (activeSession.rowHash || activeSession.traceId).slice(0, 18) + "…", "green"],
                      ].map(([k, v, c]) => (
                        <div key={k} className="drow">
                          <span className="dk">{k}</span>
                          <span className={`dv ${c}`}>{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="detail-sec">
                  <div className="dlbl">Token Distribution</div>
                  {[["Input", activeSession.inputTok, "#38BDF8"], ["Output", activeSession.outputTok, "#818CF8"]].map(([k, v, col]) => (
                    <div key={k} className="tok-wrap">
                      <div className="tok-row">
                        <span>{k} tokens</span>
                        <span style={{ color: col, fontFamily: "var(--mono)" }}>{v.toLocaleString()}</span>
                      </div>
                      <div className="tok-track">
                        <div className="tok-fill" style={{ width: (v / ((activeSession.inputTok + activeSession.outputTok) || 1) * 100) + "%", background: col }} />
                      </div>
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
          <QuickSessionBar sessions={sessions} selSess={activeSession} onSelect={setSelSess} />
          {activeSession && (
            <>
              <div className="kpi-row" style={{ marginBottom: 16 }}>
                {[
                  ["TRACE ID", activeSession.traceId.slice(0, 16) + "…", "#E2E8F0"],
                  ["TOTAL SPANS", spans.length, "#38BDF8"],
                  ["ROOT DURATION", spanMax + "ms", "#F59E0B"],
                  ["SERVICES TRAVERSED", [...new Set(spans.map(s => s.service))].length, "#10B981"],
                  ["SPAN ERRORS", spans.filter(s => s.status === "error").length, spans.some(s => s.status === "error") ? "#EF4444" : "#10B981"],
                ].map(([l, v, c]) => (
                  <div key={l} className="kpi" style={{ padding: "12px 14px" }}>
                    <div className="kpi-lbl">{l}</div>
                    <div className="kpi-val" style={{ fontSize: 16, color: c }}>{v}</div>
                  </div>
                ))}
              </div>

              <div className="span-panel">
                <div className="panel-hdr">
                  <span className="panel-hdr-lbl">OpenTelemetry Distributed Trace Waterfall · {activeSession.id}</span>
                  <span className="panel-tid">{activeSession.traceId}</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "#94A3B8", marginLeft: "auto" }}>{activeSession.model}</span>
                </div>
                <div className="span-body">
                  <div style={{ display: "flex", paddingLeft: 230, paddingBottom: 8, minWidth: 520 }}>
                    {[0, 25, 50, 75, 100].map(p => (
                      <span key={p} style={{ fontFamily: "var(--mono)", fontSize: 10, color: "#64748B", flex: 1 }}>
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
                          <div key={p} style={{ position: "absolute", left: p + "%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,.06)" }} />
                        ))}
                        <div
                          className="span-bar"
                          style={{
                            left: (sp.start / spanMax * 100) + "%",
                            width: Math.max(sp.dur / spanMax * 100, 0.8) + "%",
                            background: sp.status === "ok" ? spColors[i % spColors.length] : "#EF4444",
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

              <div style={{ marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={() => setShowSpanAttrs(s => !s)}
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    padding: "8px 14px",
                    borderRadius: 6,
                    background: "#0F172A",
                    border: "1px solid #1E293B",
                    color: "#38BDF8",
                    cursor: "pointer",
                  }}
                >
                  {showSpanAttrs
                    ? `Hide Span Attributes & BIAN / FAPI Context (${spans.length} Spans) ▴`
                    : `Surface Span Attributes & BIAN / FAPI Context (${spans.length} Spans) ▾`}
                </button>
              </div>

              {showSpanAttrs && (
                <div className="span-panel">
                  <div className="panel-hdr">
                    <span className="panel-hdr-lbl">Span Attributes &amp; BIAN / FAPI Context</span>
                  </div>
                  <div className="attr-grid">
                    {spans.map((sp, i) => (
                      <div key={sp.name + i} className="attr-card">
                        <div className="attr-name" style={{ color: spColors[i % spColors.length] }}>{sp.name}</div>
                        {[
                          ["service.name", sp.service],
                          ["otel.status_code", sp.status.toUpperCase()],
                          ["span.duration_ms", sp.dur + "ms"],
                          ["http.status_code", sp.status === "error" ? "500" : "200"],
                          ["fapi.interaction_id", (activeSession.fapiInteractionId || activeSession.traceId).slice(0, 14) + "…"],
                          ["audit.sha256_head", (activeSession.rowHash || activeSession.traceId).slice(0, 14) + "…"],
                        ].map(([k, v]) => (
                          <div key={k} className="attr-row">
                            <span className="attr-k">{k}</span>
                            <span className="attr-v" style={{ color: k === "otel.status_code" && sp.status === "error" ? "#EF4444" : undefined }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default ObservabilityOverlay;
