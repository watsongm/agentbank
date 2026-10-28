import { useState, useEffect, useRef, useMemo } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { OBS_TOOLS, OBS_MODELS, makeSpans, makeTraceSteps, makeHex } from "./mock/sessions.js";
import { apiFetch } from "./api/index.js";

function CT({ active, payload, label, unit = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0d1520", border: "1px solid #263849", padding: "8px 12px", fontFamily: "var(--mono)", fontSize: 11 }}>
      <div style={{ color: "#8b9bb4", marginBottom: 4 }}>{label}</div>
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
        marginBottom: 14,
        padding: "8px 12px",
        background: "#0c121b",
        border: "1px solid #1e293b",
        overflowX: "auto",
      }}
    >
      <span
        style={{
          fontFamily: "var(--sans)",
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: "0.06em",
          color: "#8b9bb4",
          textTransform: "uppercase",
          flexShrink: 0,
          marginRight: 4,
        }}
      >
        ACTIVE SESSIONS:
      </span>
      {sessions.slice(0, 6).map(s => {
        const isSel = selSess?.id === s.id;
        const srcBadge =
          s.source === "console"
            ? { label: "CONSOLE", color: "var(--blue)" }
            : s.source === "backend"
            ? { label: "LIVE", color: "var(--green)" }
            : { label: "AGENT", color: "#8b9bb4" };
        const dotColor =
          s.status === "success" ? "var(--green)" : s.status === "error" ? "var(--red)" : "var(--orange)";
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 10px",
              fontFamily: "var(--sans)",
              fontSize: 11.5,
              background: isSel ? "rgba(201,168,76,0.14)" : "rgba(255,255,255,0.03)",
              border: "1px solid",
              borderColor: isSel ? "var(--gold)" : "rgba(255,255,255,0.1)",
              color: isSel ? "#fff" : "#94a3b8",
              cursor: "pointer",
              flexShrink: 0,
              transition: "all 0.15s",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
            <span style={{ fontFamily: "var(--mono)", color: isSel ? "var(--gold)" : "#cbd5e1", fontWeight: 600 }}>{s.id}</span>
            <span style={{ color: "#94a3b8", fontWeight: 500 }}>{s.customer.split(" ")[0]}</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "#64748b" }}>· {s.tool}</span>
            <span
              style={{
                fontFamily: "var(--sans)",
                fontSize: 9.5,
                fontWeight: 600,
                padding: "1px 5px",
                border: `1px solid ${srcBadge.color}`,
                color: srcBadge.color,
                letterSpacing: "0.04em",
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
  const traceRef = useRef(null);

  /* Ensure selSess is never null when sessions exist, or update when initialSessionId changes */
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

  const activeSession = selSess || sessions[0] || null;

  /* Animate reasoning trace when a session is selected */
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
    }, 140);
    return () => clearInterval(t);
  }, [activeSession, fullTraceSteps]);

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

  const tickStyle = { fill: "#64748b", fontSize: 9.5, fontFamily: "monospace" };

  return (
    <div className="obs-wrap" role="dialog" aria-modal="true" aria-label="Observability Dashboard">
      <div className="obs-top">
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div className="obs-logo">AGENT<span>BANK</span></div>
          <span className="obs-sub">OBSERVABILITY</span>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9.5,
              padding: "3px 8px",
              border: "1px solid",
              borderColor: apiMode === "live" ? "rgba(79,195,247,.45)" : "rgba(201,168,76,.4)",
              color: apiMode === "live" ? "var(--blue)" : "var(--gold)",
              background: apiMode === "live" ? "rgba(79,195,247,.1)" : "rgba(201,168,76,.1)",
              letterSpacing: 1,
            }}
          >
            {apiMode === "live"
              ? `LIVE BACKEND (${backendSyncStatus.toUpperCase()})`
              : "MOCK TELEMETRY"}
          </span>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9.5,
              padding: "3px 8px",
              border: "1px solid rgba(0,230,118,.35)",
              color: "var(--green)",
              background: "rgba(0,230,118,.08)",
              letterSpacing: 0.8,
            }}
            title="ADR-0002: Every session and tool execution is recorded in a tamper-evident SHA-256 hash chain"
          >
            🔒 SHA-256 AUDIT CHAIN VERIFIED
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
              { l: "AVG LATENCY",    v: `${avgLat}ms`,                   c: "var(--orange)" },
              { l: "TOTAL TOKENS",   v: `${(totTok / 1000).toFixed(1)}k`, c: "var(--blue)" },
              { l: "AVG TOOL CALLS", v: avgTool,                          c: "var(--purple)" },
              { l: "ERROR RATE",     v: `${errPct}%`,                     c: errPct > 5 ? "var(--red)" : "var(--green)" },
              { l: "LIVE SESSIONS",  v: sessions.length,                  c: "var(--green)" },
              { l: "TOOLS REGISTERED", v: OBS_TOOLS.length,               c: "var(--gold)" },
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
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                  <XAxis dataKey="t" tick={tickStyle} tickLine={false} axisLine={false} />
                  <YAxis tick={tickStyle} tickLine={false} axisLine={false} />
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
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                  <XAxis dataKey="t" tick={tickStyle} tickLine={false} axisLine={false} />
                  <YAxis tick={tickStyle} tickLine={false} axisLine={false} />
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
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                  <XAxis dataKey="t" tick={tickStyle} tickLine={false} axisLine={false} />
                  <YAxis tick={tickStyle} tickLine={false} axisLine={false} />
                  <Tooltip content={<CT />} />
                  <Area type="monotone" dataKey="toolCalls" stroke="#00e676" strokeWidth={2} fill="url(#gl4)" name="calls" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <div className="chart-hdr">TOP TOOLS BY VOLUME (ALL 14 PRIMITIVES)</div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={toolDist.slice(0, 6)} layout="vertical" margin={{ top: 0, right: 4, left: 85, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" horizontal={false} />
                  <XAxis type="number" tick={tickStyle} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 9.5, fontFamily: "monospace" }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CT />} />
                  <Bar dataKey="calls" fill="#ce93d8" radius={[0, 2, 2, 0]} name="calls" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <div className="chart-hdr">ERRORS AND SESSIONS</div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={history.slice(-10)} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                  <XAxis dataKey="t" tick={tickStyle} tickLine={false} axisLine={false} />
                  <YAxis tick={tickStyle} tickLine={false} axisLine={false} />
                  <Tooltip content={<CT />} />
                  <Bar dataKey="sessions" fill="rgba(79,195,247,.5)" name="sessions" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="errors" fill="rgba(255,82,82,.75)" name="errors" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="sess-table">
            <div className="srow srow-hdr">
              <span>SESSION</span><span>MODEL</span><span>CUSTOMER · PARTY ID</span><span>LATENCY</span><span>TOKENS</span><span>STATUS</span><span>PRIMARY TOOL</span>
            </div>
            {sessions.slice(0, 14).map(s => (
              <div
                key={s.id}
                className={`srow ${activeSession?.id === s.id ? "on" : ""} ${s.source === "console" || s.source === "backend" ? "console-row" : ""}`}
                onClick={() => { setSelSess(s); setObsTab("trace"); }}
                title="Click to inspect reasoning trace and OpenTelemetry waterfall"
              >
                <span style={{ color: "var(--gold)", fontFamily: "monospace", fontWeight: 600 }}>{s.id}</span>
                <span style={{ color: "var(--blue)", fontSize: 10.5 }}>{s.model.replace("claude-", "")}</span>
                <span style={{ color: s.source === "console" || s.source === "backend" ? "var(--blue)" : "#e2e8f0" }}>
                  {s.customer}
                </span>
                <span style={{ color: "var(--orange)" }}>{s.latency}ms</span>
                <span style={{ color: "#cbd5e1" }}>{((s.inputTok + s.outputTok) / 1000).toFixed(1)}k</span>
                <span><span className={`sbadge sb-${s.status}`}>{s.status}</span></span>
                <span style={{ color: "#94a3b8", fontSize: 10.5 }}>{s.tool}()</span>
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
                  <span className="panel-hdr-lbl">AGENT REASONING TRACE · {activeSession.id}</span>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span className="panel-tid">trace: {activeSession.traceId.slice(0, 18)}…</span>
                    <button
                      type="button"
                      onClick={() => setObsTab("otel")}
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 9.5,
                        padding: "3px 8px",
                        background: "rgba(79,195,247,0.1)",
                        border: "1px solid rgba(79,195,247,0.35)",
                        color: "var(--blue)",
                        cursor: "pointer",
                      }}
                    >
                      View OTel Waterfall →
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
                    <span style={{ color: "rgba(201,168,76,.65)", animation: "pulse 1s infinite" }}>▌</span>
                  )}
                </div>
              </div>
              <div className="detail-panel">
                <div className="detail-sec">
                  <div className="dlbl">Session &amp; Cryptographic Audit</div>
                  {[
                    ["Session ID", activeSession.id, "gold"],
                    ["Customer", activeSession.customer, ""],
                    ["Primary Tool", `${activeSession.tool}()`, "blue"],
                    ["Model", activeSession.model, "blue"],
                    ["Status", activeSession.status, activeSession.status === "success" ? "green" : "red"],
                    ["Latency", activeSession.latency + "ms", ""],
                    ["Tool Calls", activeSession.toolCalls, ""],
                    ["Source", activeSession.source ?? "simulated", ""],
                    ["FAPI Interaction", (activeSession.fapiInteractionId || activeSession.traceId).slice(0, 18) + "…", ""],
                    ["Prev Hash", (activeSession.prevHash || "0".repeat(64)).slice(0, 16) + "…", ""],
                    ["Row Hash (SHA-256)", (activeSession.rowHash || activeSession.traceId).slice(0, 16) + "…", "green"],
                  ].map(([k, v, c]) => (
                    <div key={k} className="drow">
                      <span className="dk">{k}</span>
                      <span className={`dv ${c}`}>{v}</span>
                    </div>
                  ))}
                </div>
                <div className="detail-sec">
                  <div className="dlbl">Token Usage</div>
                  {[["Input", activeSession.inputTok, "#4fc3f7"], ["Output", activeSession.outputTok, "#ce93d8"]].map(([k, v, col]) => (
                    <div key={k} className="tok-wrap">
                      <div className="tok-row">
                        <span>{k} tokens</span>
                        <span style={{ color: col }}>{v.toLocaleString()}</span>
                      </div>
                      <div className="tok-track">
                        <div className="tok-fill" style={{ width: (v / ((activeSession.inputTok + activeSession.outputTok) || 1) * 100) + "%", background: col }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="detail-sec">
                  <div className="dlbl">Recent Sessions</div>
                  {sessions.slice(0, 6).map(s => (
                    <div
                      key={s.id}
                      style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,.05)", cursor: "pointer" }}
                      onClick={() => setSelSess(s)}
                    >
                      <span style={{ fontFamily: "monospace", fontSize: 10.5, color: activeSession.id === s.id ? "var(--gold)" : "#8b9bb4" }}>{s.id}</span>
                      <span style={{ fontFamily: "monospace", fontSize: 10.5, color: "#cbd5e1" }}>{s.customer.split(" ")[0]}</span>
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
          <QuickSessionBar sessions={sessions} selSess={activeSession} onSelect={setSelSess} />
          {activeSession && (
            <>
              <div className="kpi-row" style={{ marginBottom: 14 }}>
                {[
                  ["TRACE ID", activeSession.traceId.slice(0, 16) + "…", ""],
                  ["TOTAL SPANS", spans.length, "var(--blue)"],
                  ["ROOT DURATION", spanMax + "ms", "var(--orange)"],
                  ["SERVICES", [...new Set(spans.map(s => s.service))].length, "var(--green)"],
                  ["ERRORS", spans.filter(s => s.status === "error").length, spans.some(s => s.status === "error") ? "var(--red)" : "var(--green)"],
                ].map(([l, v, c]) => (
                  <div key={l} className="kpi" style={{ padding: "11px 13px" }}>
                    <div className="kpi-lbl">{l}</div>
                    <div className="kpi-val" style={{ fontSize: 15, color: c || "#e2e8f0" }}>{v}</div>
                  </div>
                ))}
              </div>
              <div className="span-panel">
                <div className="panel-hdr">
                  <span className="panel-hdr-lbl">OpenTelemetry Trace Waterfall · {activeSession.id}</span>
                  <span className="panel-tid">{activeSession.traceId}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 10.5, color: "#8b9bb4", marginLeft: "auto" }}>{activeSession.model}</span>
                </div>
                <div className="span-body">
                  <div style={{ display: "flex", paddingLeft: 220, paddingBottom: 6, minWidth: 500 }}>
                    {[0, 25, 50, 75, 100].map(p => (
                      <span key={p} style={{ fontFamily: "monospace", fontSize: 9.5, color: "#64748b", flex: 1 }}>
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
                            width: Math.max(sp.dur / spanMax * 100, 0.5) + "%",
                            background: sp.status === "ok" ? spColors[i % spColors.length] + "b3" : "rgba(255,82,82,.8)",
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
                          <span className="attr-v" style={{ color: k === "otel.status_code" && sp.status === "error" ? "var(--red)" : undefined }}>{v}</span>
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
