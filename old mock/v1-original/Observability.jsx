import { useState, useEffect, useRef, useCallback } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart } from "recharts";

/* ─── SIMULATION ENGINE ─────────────────────────────────────────────────── */
function randomBetween(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function randomFloat(a, b) { return +(Math.random() * (b - a) + a).toFixed(1); }

const TOOL_NAMES = ["get_party","get_accounts","get_balance","get_transactions","initiate_payment","get_payment_status","apply_for_loan","get_card_details","block_card","run_aml_screen","subscribe_events","get_portfolio"];
const DOMAINS   = ["party","accounts","payments","transactions","lending","cards","compliance","investments","notifications"];
const SERVICES  = ["SD-PartyRef","SD-CurrentAccount","SD-PaymentExecution","SD-AccountingTx","SD-ConsumerLoan","SD-CreditCard","SD-RegulatoryRep","SD-InvestmentPort"];
const CUSTOMERS = ["Aria Chen","James Okafor","Sofia Reyes","Lena Fischer","Kai Nakamura","Priya Sharma"];
const MODELS    = ["claude-opus-4-5","claude-sonnet-4-6"];

function makeSession(id) {
  const tool = TOOL_NAMES[randomBetween(0, TOOL_NAMES.length-1)];
  const domain = DOMAINS[randomBetween(0, DOMAINS.length-1)];
  const latency = randomBetween(180, 1400);
  const inputTok = randomBetween(800, 4200);
  const outputTok = randomBetween(120, 1800);
  const model = MODELS[randomBetween(0,1)];
  const status = Math.random() > 0.08 ? "success" : Math.random() > 0.5 ? "error" : "timeout";
  return {
    id: `SES-${String(id).padStart(5,"0")}`,
    traceId: Array.from({length:8},()=>Math.floor(Math.random()*16).toString(16)).join("")+"-"+Array.from({length:4},()=>Math.floor(Math.random()*16).toString(16)).join(""),
    customer: CUSTOMERS[randomBetween(0, CUSTOMERS.length-1)],
    model, tool, domain,
    latency, inputTok, outputTok,
    totalTok: inputTok + outputTok,
    toolCalls: randomBetween(1,8),
    status,
    ts: Date.now() - randomBetween(0, 3000),
  };
}

function makeSpan(sessionId, traceId, tool, depth=0) {
  const service = SERVICES[randomBetween(0,SERVICES.length-1)];
  const start = randomBetween(0, 600);
  const dur = randomBetween(20, depth===0 ? 800 : 300);
  return {
    spanId: Array.from({length:6},()=>Math.floor(Math.random()*16).toString(16)).join(""),
    traceId, sessionId,
    name: depth===0 ? `agent.tool_call.${tool}` : depth===1 ? `${service}.retrieve` : `core.ledger.read`,
    service: depth===0 ? "agentbank-agent" : depth===1 ? service : "core-banking",
    start, dur, depth,
    status: Math.random()>0.05 ? "ok" : "error",
    attrs: { "db.system": depth===2 ? "postgres" : undefined, "http.status_code": 200, "fapi.interaction_id": traceId }
  };
}

function buildTrace(session) {
  const spans = [];
  spans.push(makeSpan(session.id, session.traceId, session.tool, 0));
  const n = randomBetween(1,3);
  for(let i=0;i<n;i++) spans.push(makeSpan(session.id, session.traceId, session.tool, 1));
  spans.push(makeSpan(session.id, session.traceId, session.tool, 2));
  return spans;
}

function buildAgentTrace(session) {
  const steps = [];
  const toolCount = session.toolCalls;
  let t = 0;
  steps.push({ type:"system", text:`Session ${session.id} initialised. Model: ${session.model}. Customer: ${session.customer}.`, t: t+=10 });
  steps.push({ type:"auth",   text:`OAuth 2.0 FAPI token validated. Consent scope: ${session.domain}:read ${session.domain}:write`, t: t+=40 });
  for(let i=0;i<toolCount;i++){
    const tool = TOOL_NAMES[randomBetween(0,TOOL_NAMES.length-1)];
    const tok = randomBetween(200,800);
    steps.push({ type:"think", text:`[Reasoning] Determining next action… token usage: ${tok} input`, t: t+=randomBetween(80,300) });
    steps.push({ type:"call",  text:`→ tool_use: ${tool}({ ${DOMAINS[randomBetween(0,DOMAINS.length-1)]}_id: "ACC-${randomBetween(1000,9999)}" })`, t: t+=20 });
    steps.push({ type:"result",text:`← tool_result: { status: "ok", latency: ${randomBetween(40,400)}ms, data: {...} }`, t: t+=randomBetween(40,400) });
  }
  const finalTok = randomBetween(100,600);
  steps.push({ type:"think", text:`[Reasoning] All required data collected. Composing response… output tokens: ${finalTok}`, t: t+=200 });
  steps.push({ type:"done",  text:`Session complete. stop_reason: end_turn. Total tokens: ${session.inputTok}→${session.outputTok}. Latency: ${session.latency}ms`, t: t+=50 });
  return steps;
}

function generateMetricHistory() {
  return Array.from({length:20},(_,i)=>({
    t: `${String(Math.floor(i/2)).padStart(2,"0")}:${i%2===0?"00":"30"}`,
    latency: randomBetween(200,900),
    inputTok: randomBetween(1200,4000),
    outputTok: randomBetween(200,1600),
    toolCalls: randomBetween(2,10),
    errors: randomBetween(0,3),
    sessions: randomBetween(1,8),
  }));
}

/* ─── STYLES ────────────────────────────────────────────────────────────── */
const S = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Fira+Code:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#070a0e; --surface:#0c1018; --card:#101620;
  --border:#18222e; --border2:#1e2c3a;
  --accent:#c9a84c; --blue:#4fc3f7; --green:#00e676;
  --purple:#ce93d8; --red:#ff5252; --orange:#ffb74d;
  --text:#c8d6e2; --muted:#445566; --dim:#2a3a4a;
  --mono:'Fira Code',monospace; --sans:'IBM Plex Sans',sans-serif; --display:'Syne',sans-serif;
}
html,body{background:var(--bg);color:var(--text);font-family:var(--sans);overflow-x:hidden;height:100%;}
/* TOPBAR */
.topbar{display:flex;align-items:center;justify-content:space-between;padding:0 24px;height:52px;background:var(--surface);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:100;flex-shrink:0;}
.topbar-logo{font-family:var(--display);font-size:17px;color:#fff;letter-spacing:-0.3px;}.topbar-logo span{color:var(--accent);}
.topbar-sub{font-family:var(--mono);font-size:10px;color:var(--muted);margin-left:10px;letter-spacing:1px;}
.topbar-right{display:flex;align-items:center;gap:16px;}
.live-badge{display:flex;align-items:center;gap:6px;background:rgba(0,230,118,0.08);border:1px solid rgba(0,230,118,0.25);padding:4px 10px;}
.live-dot{width:6px;height:6px;border-radius:50%;background:var(--green);animation:blink 1.5s infinite;}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}}
.live-text{font-family:var(--mono);font-size:10px;color:var(--green);}
.pause-btn{font-family:var(--mono);font-size:11px;padding:5px 14px;background:rgba(255,255,255,0.05);border:1px solid var(--border2);color:var(--muted);cursor:pointer;transition:all 0.2s;letter-spacing:1px;}
.pause-btn:hover{background:rgba(255,255,255,0.08);color:var(--text);}
.pause-btn.paused{border-color:var(--accent);color:var(--accent);background:rgba(201,168,76,0.08);}
/* TABS */
.tabs{display:flex;background:var(--surface);border-bottom:1px solid var(--border);padding:0 24px;position:sticky;top:52px;z-index:99;}
.tab{padding:12px 20px;font-family:var(--mono);font-size:11px;letter-spacing:1px;color:var(--muted);cursor:pointer;border-bottom:2px solid transparent;transition:all 0.2s;background:none;border-top:none;border-left:none;border-right:none;}
.tab:hover{color:var(--text);}
.tab.active{color:var(--accent);border-bottom-color:var(--accent);}
/* LAYOUT */
.page{padding:20px 24px;min-height:calc(100vh - 104px);}
/* STAT CARDS */
.stat-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:20px;}
.stat-card{background:var(--card);border:1px solid var(--border);padding:16px;}
.stat-label{font-family:var(--mono);font-size:10px;letter-spacing:1px;color:var(--muted);text-transform:uppercase;margin-bottom:8px;}
.stat-val{font-family:var(--mono);font-size:24px;font-weight:600;color:#fff;}
.stat-val.green{color:var(--green);}
.stat-val.amber{color:var(--accent);}
.stat-val.blue{color:var(--blue);}
.stat-val.purple{color:var(--purple);}
.stat-val.red{color:var(--red);}
.stat-delta{font-family:var(--mono);font-size:10px;margin-top:4px;}
.delta-up{color:var(--green);}
.delta-dn{color:var(--red);}
/* CHART CARDS */
.chart-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;}
.chart-grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:20px;}
.chart-card{background:var(--card);border:1px solid var(--border);padding:16px;}
.chart-title{font-family:var(--mono);font-size:10px;letter-spacing:1px;color:var(--muted);margin-bottom:14px;text-transform:uppercase;display:flex;align-items:center;justify-content:space-between;}
.chart-badge{font-size:10px;padding:2px 7px;border-radius:10px;}
/* CUSTOM TOOLTIP */
.ct{background:#0d1520;border:1px solid var(--border2);padding:8px 12px;font-family:var(--mono);font-size:11px;}
.ct-label{color:var(--muted);margin-bottom:4px;}
.ct-val{color:#fff;}
/* SESSION TABLE */
.session-table{background:var(--card);border:1px solid var(--border);margin-bottom:20px;overflow:hidden;}
.table-header{display:grid;grid-template-columns:100px 120px 1fr 90px 80px 90px 80px 70px;padding:8px 16px;border-bottom:1px solid var(--border);font-family:var(--mono);font-size:10px;letter-spacing:1px;color:var(--muted);text-transform:uppercase;}
.table-row{display:grid;grid-template-columns:100px 120px 1fr 90px 80px 90px 80px 70px;padding:9px 16px;border-bottom:1px solid rgba(255,255,255,0.04);font-family:var(--mono);font-size:11px;cursor:pointer;transition:background 0.15s;align-items:center;}
.table-row:hover{background:rgba(255,255,255,0.03);}
.table-row.selected{background:rgba(201,168,76,0.07);border-left:2px solid var(--accent);}
.cell-id{color:var(--accent);}
.cell-model{color:var(--blue);font-size:10px;}
.cell-customer{color:var(--text);}
.cell-tool{color:var(--purple);font-size:10px;}
.cell-tok{color:var(--text);}
.cell-lat{color:var(--orange);}
.status-badge{font-size:10px;padding:2px 7px;}
.s-success{background:rgba(0,230,118,0.1);color:var(--green);border:1px solid rgba(0,230,118,0.3);}
.s-error{background:rgba(255,82,82,0.1);color:var(--red);border:1px solid rgba(255,82,82,0.3);}
.s-timeout{background:rgba(255,183,77,0.1);color:var(--orange);border:1px solid rgba(255,183,77,0.3);}
/* AGENT TRACE */
.trace-layout{display:grid;grid-template-columns:1fr 380px;gap:16px;}
.trace-panel{background:var(--card);border:1px solid var(--border);}
.trace-header{padding:10px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
.trace-title{font-family:var(--mono);font-size:10px;letter-spacing:1px;color:var(--muted);text-transform:uppercase;}
.trace-id{font-family:var(--mono);font-size:10px;color:var(--accent);}
.trace-body{padding:16px;max-height:520px;overflow-y:auto;font-family:var(--mono);font-size:11.5px;line-height:1.8;}
.trace-line{display:flex;gap:10px;margin-bottom:2px;}
.trace-t{color:var(--dim);width:52px;flex-shrink:0;font-size:10px;padding-top:1px;}
.trace-icon{width:14px;flex-shrink:0;text-align:center;}
.trace-text{}
.tr-system{color:rgba(255,255,255,0.3);}
.tr-auth{color:var(--blue);}
.tr-think{color:var(--muted);}
.tr-call{color:var(--accent);}
.tr-result{color:var(--green);}
.tr-done{color:#fff;font-weight:500;}
.trace-cursor{animation:blink 0.8s infinite;color:var(--accent);}
/* SESSION DETAIL */
.detail-panel{background:var(--card);border:1px solid var(--border);}
.detail-section{padding:14px 16px;border-bottom:1px solid var(--border);}
.detail-label{font-family:var(--mono);font-size:9px;letter-spacing:2px;color:var(--muted);text-transform:uppercase;margin-bottom:10px;}
.detail-row{display:flex;justify-content:space-between;margin-bottom:6px;font-size:12px;}
.detail-key{color:var(--muted);font-family:var(--mono);font-size:11px;}
.detail-val{color:var(--text);font-family:var(--mono);font-size:11px;}
.detail-val.accent{color:var(--accent);}
.detail-val.green{color:var(--green);}
.detail-val.blue{color:var(--blue);}
.tok-bar-wrap{margin-top:8px;}
.tok-bar-label{display:flex;justify-content:space-between;font-family:var(--mono);font-size:10px;color:var(--muted);margin-bottom:4px;}
.tok-bar-track{height:6px;background:var(--dim);border-radius:3px;overflow:hidden;}
.tok-bar-fill{height:100%;border-radius:3px;transition:width 0.5s;}
/* OTEL SPANS */
.span-header{padding:10px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;}
.span-trace-id{font-family:var(--mono);font-size:11px;color:var(--accent);}
.span-body{padding:16px;overflow-x:auto;}
.span-row{display:flex;align-items:center;gap:0;margin-bottom:6px;min-width:600px;}
.span-info{width:240px;flex-shrink:0;display:flex;flex-direction:column;gap:2px;}
.span-name{font-family:var(--mono);font-size:11px;color:var(--text);}
.span-service{font-family:var(--mono);font-size:10px;color:var(--muted);}
.span-timeline{flex:1;position:relative;height:24px;}
.span-bar{position:absolute;height:18px;top:3px;border-radius:2px;min-width:4px;display:flex;align-items:center;padding:0 6px;font-family:var(--mono);font-size:9px;color:rgba(0,0,0,0.7);font-weight:600;overflow:hidden;white-space:nowrap;}
.span-dur{font-family:var(--mono);font-size:10px;color:var(--muted);width:52px;text-align:right;flex-shrink:0;}
.span-ok{background:rgba(0,230,118,0.7);}
.span-error{background:rgba(255,82,82,0.7);}
.depth-0{opacity:1;}.depth-1{opacity:0.8;margin-left:20px;}.depth-2{opacity:0.65;margin-left:40px;}
/* EMPTY */
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;color:var(--muted);gap:10px;}
.empty-icon{font-size:28px;opacity:0.3;}.empty-text{font-family:var(--mono);font-size:11px;letter-spacing:1px;}
/* SCROLLBAR */
::-webkit-scrollbar{width:4px;height:4px;}
::-webkit-scrollbar-track{background:var(--bg);}
::-webkit-scrollbar-thumb{background:var(--border2);}
@media(max-width:1100px){.chart-grid-3{grid-template-columns:1fr 1fr;}.trace-layout{grid-template-columns:1fr;}}
@media(max-width:768px){.chart-grid,.chart-grid-3{grid-template-columns:1fr;}.table-header,.table-row{grid-template-columns:80px 1fr 70px 60px;}.table-row>*:nth-child(n+4):not(:nth-child(4)):not(:nth-child(7)){display:none;}}
`;

/* ─── CUSTOM TOOLTIP ────────────────────────────────────────────────────── */
function CT({active,payload,label,unit=""}) {
  if (!active||!payload?.length) return null;
  return (
    <div className="ct">
      <div className="ct-label">{label}</div>
      {payload.map((p,i)=><div key={i} className="ct-val" style={{color:p.color}}>{p.name}: {p.value}{unit}</div>)}
    </div>
  );
}

/* ─── MAIN ──────────────────────────────────────────────────────────────── */
export default function ObsDashboard() {
  const [tab, setTab] = useState("metrics");
  const [paused, setPaused] = useState(false);
  const [sessions, setSessions] = useState(() => Array.from({length:12},(_,i)=>makeSession(i+1)));
  const [history, setHistory] = useState(generateMetricHistory);
  const [selectedSession, setSelectedSession] = useState(null);
  const [traceLines, setTraceLines] = useState([]);
  const [traceIdx, setTraceIdx] = useState(0);
  const [spans, setSpans] = useState([]);
  const sessionCounter = useRef(13);
  const traceRef = useRef(null);

  // Live session feed
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setSessions(prev => {
        const next = [makeSession(sessionCounter.current++), ...prev].slice(0, 40);
        return next;
      });
      setHistory(prev => {
        const last = prev[prev.length-1];
        const newPt = {
          t: new Date().toLocaleTimeString("en",{hour:"2-digit",minute:"2-digit",second:"2-digit"}),
          latency: randomBetween(180,900),
          inputTok: randomBetween(1200,4000),
          outputTok: randomBetween(200,1600),
          toolCalls: randomBetween(2,10),
          errors: randomBetween(0,2),
          sessions: randomBetween(1,6),
        };
        return [...prev.slice(-19), newPt];
      });
    }, 2200);
    return () => clearInterval(t);
  }, [paused]);

  // Animate trace when session selected
  useEffect(() => {
    if (!selectedSession) return;
    const steps = buildAgentTrace(selectedSession);
    setTraceLines([]);
    setTraceIdx(0);
    setSpans(buildTrace(selectedSession));
    let i = 0;
    const t = setInterval(() => {
      if (i < steps.length) { setTraceLines(prev => [...prev, steps[i]]); i++; }
      else clearInterval(t);
    }, 180);
    return () => clearInterval(t);
  }, [selectedSession?.id]);

  useEffect(() => {
    if (traceRef.current) traceRef.current.scrollTop = traceRef.current.scrollHeight;
  }, [traceLines]);

  // Derived metrics
  const recent = sessions.slice(0,30);
  const avgLat = Math.round(recent.reduce((a,s)=>a+s.latency,0)/recent.length);
  const totalTok = recent.reduce((a,s)=>a+s.totalTok,0);
  const errorRate = +(recent.filter(s=>s.status!=="success").length/recent.length*100).toFixed(1);
  const avgTools = +(recent.reduce((a,s)=>a+s.toolCalls,0)/recent.length).toFixed(1);
  const p99Lat = Math.max(...recent.map(s=>s.latency));

  // Tool call distribution
  const toolDist = TOOL_NAMES.slice(0,8).map(n=>({
    name:n.replace("_"," "), calls: recent.filter(s=>s.tool===n).length * randomBetween(1,4) || randomBetween(1,8)
  })).sort((a,b)=>b.calls-a.calls);

  // Model distribution
  const modelDist = MODELS.map(m=>({
    name:m, sessions:recent.filter(s=>s.model===m).length
  }));

  // Span timeline max
  const spanMax = spans.length ? Math.max(...spans.map(s=>s.start+s.dur)) : 1000;

  const traceIcons = {system:"◌",auth:"⚡",think:"…",call:"→",result:"←",done:"✓"};
  const traceColors = {system:"tr-system",auth:"tr-auth",think:"tr-think",call:"tr-call",result:"tr-result",done:"tr-done"};
  const spanColors = ["#4fc3f7","#81c784","#ffb74d","#ce93d8","#ef9a9a","#80cbc4"];

  return (
    <>
      <style>{S}</style>
      <div className="topbar">
        <div style={{display:"flex",alignItems:"center"}}>
          <span className="topbar-logo">AGENT<span>BANK</span></span>
          <span className="topbar-sub">OBSERVABILITY</span>
        </div>
        <div className="topbar-right">
          <div className="live-badge"><div className="live-dot"/><span className="live-text">LIVE · {sessions.length} SESSIONS</span></div>
          <button className={`pause-btn ${paused?"paused":""}`} onClick={()=>setPaused(p=>!p)}>
            {paused ? "▶ RESUME" : "⏸ PAUSE"}
          </button>
        </div>
      </div>

      <div className="tabs">
        {[["metrics","LLM METRICS"],["trace","AGENT TRACE LOG"],["otel","OPENTELEMETRY SPANS"]].map(([id,label])=>(
          <button key={id} className={`tab ${tab===id?"active":""}`} onClick={()=>setTab(id)}>{label}</button>
        ))}
      </div>

      {/* ── METRICS TAB ── */}
      {tab==="metrics" && (
        <div className="page">
          <div className="stat-row">
            {[
              {label:"AVG LATENCY",val:`${avgLat}ms`,cls:"amber",delta:`p99: ${p99Lat}ms`,up:false},
              {label:"TOTAL TOKENS (30s)",val:(totalTok/1000).toFixed(1)+"k",cls:"blue",delta:`↑ ${Math.round(totalTok/30)} tok/s`,up:true},
              {label:"AVG TOOL CALLS",val:avgTools,cls:"purple",delta:"per session",up:null},
              {label:"ERROR RATE",val:errorRate+"%",cls:errorRate>5?"red":"green",delta:errorRate>5?"above threshold":"within SLO",up:false},
              {label:"SESSIONS (live)",val:sessions.length,cls:"green",delta:paused?"paused":"streaming",up:null},
              {label:"MODELS ACTIVE",val:MODELS.length,cls:"blue",delta:MODELS.map(m=>m.split("-")[1]).join(" / "),up:null},
            ].map(s=>(
              <div key={s.label} className="stat-card">
                <div className="stat-label">{s.label}</div>
                <div className={`stat-val ${s.cls}`}>{s.val}</div>
                <div className={`stat-delta ${s.up===true?"delta-up":s.up===false?"delta-dn":""}`} style={{color:s.up===null?"var(--muted)":undefined}}>{s.delta}</div>
              </div>
            ))}
          </div>

          <div className="chart-grid">
            <div className="chart-card">
              <div className="chart-title">AGENT LATENCY (ms) <span className="chart-badge" style={{background:"rgba(255,183,77,0.1)",color:"var(--orange)",border:"1px solid rgba(255,183,77,0.3)"}}>P50/P99</span></div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={history} margin={{top:4,right:4,left:-20,bottom:0}}>
                  <defs>
                    <linearGradient id="lg1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffb74d" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ffb74d" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                  <XAxis dataKey="t" tick={{fill:"#445566",fontSize:9,fontFamily:"monospace"}} tickLine={false} axisLine={false}/>
                  <YAxis tick={{fill:"#445566",fontSize:9,fontFamily:"monospace"}} tickLine={false} axisLine={false}/>
                  <Tooltip content={<CT unit="ms"/>}/>
                  <Area type="monotone" dataKey="latency" stroke="#ffb74d" strokeWidth={2} fill="url(#lg1)" name="latency" dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <div className="chart-title">TOKEN USAGE / TURN <span className="chart-badge" style={{background:"rgba(79,195,247,0.1)",color:"var(--blue)",border:"1px solid rgba(79,195,247,0.3)"}}>IN / OUT</span></div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={history} margin={{top:4,right:4,left:-20,bottom:0}}>
                  <defs>
                    <linearGradient id="lg2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4fc3f7" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#4fc3f7" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="lg3" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ce93d8" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ce93d8" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                  <XAxis dataKey="t" tick={{fill:"#445566",fontSize:9,fontFamily:"monospace"}} tickLine={false} axisLine={false}/>
                  <YAxis tick={{fill:"#445566",fontSize:9,fontFamily:"monospace"}} tickLine={false} axisLine={false}/>
                  <Tooltip content={<CT unit=" tok"/>}/>
                  <Area type="monotone" dataKey="inputTok" stroke="#4fc3f7" strokeWidth={2} fill="url(#lg2)" name="input" dot={false}/>
                  <Area type="monotone" dataKey="outputTok" stroke="#ce93d8" strokeWidth={2} fill="url(#lg3)" name="output" dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-grid-3">
            <div className="chart-card">
              <div className="chart-title">TOOL CALLS / SESSION</div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={history} margin={{top:4,right:4,left:-20,bottom:0}}>
                  <defs>
                    <linearGradient id="lg4" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00e676" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#00e676" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                  <XAxis dataKey="t" tick={{fill:"#445566",fontSize:9,fontFamily:"monospace"}} tickLine={false} axisLine={false}/>
                  <YAxis tick={{fill:"#445566",fontSize:9,fontFamily:"monospace"}} tickLine={false} axisLine={false}/>
                  <Tooltip content={<CT/>}/>
                  <Area type="monotone" dataKey="toolCalls" stroke="#00e676" strokeWidth={2} fill="url(#lg4)" name="tool calls" dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <div className="chart-title">TOP TOOLS BY CALL VOLUME</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={toolDist.slice(0,6)} layout="vertical" margin={{top:0,right:4,left:60,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false}/>
                  <XAxis type="number" tick={{fill:"#445566",fontSize:9,fontFamily:"monospace"}} tickLine={false} axisLine={false}/>
                  <YAxis type="category" dataKey="name" tick={{fill:"#7899aa",fontSize:10,fontFamily:"monospace"}} tickLine={false} axisLine={false}/>
                  <Tooltip content={<CT/>}/>
                  <Bar dataKey="calls" fill="#ce93d8" radius={[0,2,2,0]} name="calls"/>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <div className="chart-title">ERRORS &amp; SESSIONS</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={history.slice(-10)} margin={{top:4,right:4,left:-20,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                  <XAxis dataKey="t" tick={{fill:"#445566",fontSize:9,fontFamily:"monospace"}} tickLine={false} axisLine={false}/>
                  <YAxis tick={{fill:"#445566",fontSize:9,fontFamily:"monospace"}} tickLine={false} axisLine={false}/>
                  <Tooltip content={<CT/>}/>
                  <Bar dataKey="sessions" fill="rgba(79,195,247,0.5)" name="sessions" radius={[2,2,0,0]}/>
                  <Bar dataKey="errors" fill="rgba(255,82,82,0.7)" name="errors" radius={[2,2,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Session table */}
          <div className="session-table">
            <div className="table-header">
              <span>SESSION</span><span>MODEL</span><span>CUSTOMER</span>
              <span>TOOL</span><span>TOKENS</span><span>LATENCY</span>
              <span>STATUS</span><span>CALLS</span>
            </div>
            {sessions.slice(0,15).map(s=>(
              <div key={s.id} className={`table-row ${selectedSession?.id===s.id?"selected":""}`} onClick={()=>{setSelectedSession(s);setTab("trace");}}>
                <span className="cell-id">{s.id}</span>
                <span className="cell-model">{s.model.replace("claude-","")}</span>
                <span className="cell-customer">{s.customer}</span>
                <span className="cell-tool">{s.tool}</span>
                <span className="cell-tok">{(s.totalTok/1000).toFixed(1)}k</span>
                <span className="cell-lat">{s.latency}ms</span>
                <span><span className={`status-badge s-${s.status}`}>{s.status}</span></span>
                <span style={{color:"var(--muted)",fontFamily:"var(--mono)"}}>{s.toolCalls}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── AGENT TRACE TAB ── */}
      {tab==="trace" && (
        <div className="page">
          {!selectedSession ? (
            <div className="empty"><div className="empty-icon">◎</div><div className="empty-text">SELECT A SESSION FROM METRICS TAB</div></div>
          ) : (
            <div className="trace-layout">
              <div className="trace-panel">
                <div className="trace-header">
                  <span className="trace-title">AGENT REASONING TRACE</span>
                  <span className="trace-id">{selectedSession.traceId}</span>
                </div>
                <div className="trace-body" ref={traceRef}>
                  {traceLines.map((line,i)=>(
                    <div key={i} className="trace-line">
                      <span className="trace-t">+{line.t}ms</span>
                      <span className="trace-icon" style={{color: line.type==="call"?"var(--accent)":line.type==="result"?"var(--green)":line.type==="done"?"var(--green)":line.type==="auth"?"var(--blue)":"var(--muted)"}}>{traceIcons[line.type]}</span>
                      <span className={traceColors[line.type]}>{line.text}</span>
                    </div>
                  ))}
                  {traceLines.length < buildAgentTrace(selectedSession).length && (
                    <div className="trace-line"><span className="trace-t"></span><span className="trace-cursor">▌</span></div>
                  )}
                </div>
              </div>

              <div className="detail-panel">
                <div className="detail-section">
                  <div className="detail-label">Session Details</div>
                  {[
                    ["Session ID", selectedSession.id, "accent"],
                    ["Trace ID", selectedSession.traceId.slice(0,16)+"…", ""],
                    ["Customer", selectedSession.customer, ""],
                    ["Model", selectedSession.model, "blue"],
                    ["Status", selectedSession.status, selectedSession.status==="success"?"green":"red"],
                    ["Latency", selectedSession.latency+"ms", "amber"],
                    ["Tool Calls", selectedSession.toolCalls, ""],
                  ].map(([k,v,c])=>(
                    <div key={k} className="detail-row">
                      <span className="detail-key">{k}</span>
                      <span className={`detail-val ${c}`}>{v}</span>
                    </div>
                  ))}
                </div>
                <div className="detail-section">
                  <div className="detail-label">Token Usage</div>
                  {[
                    ["Input tokens", selectedSession.inputTok, selectedSession.inputTok/(selectedSession.inputTok+selectedSession.outputTok)*100, "#4fc3f7"],
                    ["Output tokens", selectedSession.outputTok, selectedSession.outputTok/(selectedSession.inputTok+selectedSession.outputTok)*100, "#ce93d8"],
                  ].map(([k,v,pct,col])=>(
                    <div key={k} className="tok-bar-wrap">
                      <div className="tok-bar-label"><span>{k}</span><span style={{color:col}}>{v.toLocaleString()}</span></div>
                      <div className="tok-bar-track"><div className="tok-bar-fill" style={{width:pct+"%",background:col}}/></div>
                    </div>
                  ))}
                  <div style={{marginTop:12,display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--muted)"}}>TOTAL</span>
                    <span style={{fontFamily:"var(--mono)",fontSize:11,color:"#fff"}}>{selectedSession.totalTok.toLocaleString()} tokens</span>
                  </div>
                </div>
                <div className="detail-section">
                  <div className="detail-label">Consent Scope</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                    {[selectedSession.domain+":read", selectedSession.domain+":write"].map(s=>(
                      <span key={s} style={{fontFamily:"var(--mono)",fontSize:10,padding:"2px 7px",background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.3)",color:"var(--accent)"}}>{s}</span>
                    ))}
                  </div>
                </div>
                <div className="detail-section" style={{borderBottom:"none"}}>
                  <div className="detail-label">Other Sessions</div>
                  {sessions.slice(0,6).map(s=>(
                    <div key={s.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.04)",cursor:"pointer"}} onClick={()=>setSelectedSession(s)}>
                      <span style={{fontFamily:"var(--mono)",fontSize:10,color:selectedSession.id===s.id?"var(--accent)":"var(--muted)"}}>{s.id}</span>
                      <span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--text)"}}>{s.customer.split(" ")[0]}</span>
                      <span className={`status-badge s-${s.status}`}>{s.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── OTEL SPANS TAB ── */}
      {tab==="otel" && (
        <div className="page">
          {!selectedSession ? (
            <div className="empty"><div className="empty-icon">◎</div><div className="empty-text">SELECT A SESSION FROM METRICS TAB</div></div>
          ) : (
            <>
              <div className="stat-row" style={{marginBottom:16}}>
                {[
                  {label:"TRACE ID", val:selectedSession.traceId.slice(0,18)+"…", cls:""},
                  {label:"TOTAL SPANS", val:spans.length, cls:"blue"},
                  {label:"ROOT DURATION", val:Math.max(...spans.map(s=>s.start+s.dur))+"ms", cls:"amber"},
                  {label:"SERVICES", val:[...new Set(spans.map(s=>s.service))].length, cls:"green"},
                  {label:"ERRORS", val:spans.filter(s=>s.status==="error").length, cls:spans.filter(s=>s.status==="error").length>0?"red":"green"},
                ].map(s=>(
                  <div key={s.label} className="stat-card" style={{padding:"12px 14px"}}>
                    <div className="stat-label">{s.label}</div>
                    <div className={`stat-val ${s.cls}`} style={{fontSize:16}}>{s.val}</div>
                  </div>
                ))}
              </div>

              <div className="trace-panel" style={{marginBottom:16}}>
                <div className="span-header">
                  <span style={{fontFamily:"var(--mono)",fontSize:10,letterSpacing:1,color:"var(--muted)",textTransform:"uppercase"}}>Trace Waterfall</span>
                  <span className="span-trace-id">{selectedSession.traceId}</span>
                  <span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--muted)",marginLeft:"auto"}}>{selectedSession.model}</span>
                </div>
                {/* Timeline ruler */}
                <div style={{padding:"8px 16px 0",display:"flex",gap:0,minWidth:600}}>
                  <div style={{width:240,flexShrink:0}}/>
                  <div style={{flex:1,display:"flex",justifyContent:"space-between",padding:"0 0 6px"}}>
                    {[0,25,50,75,100].map(p=>(
                      <span key={p} style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--muted)"}}>{Math.round(spanMax*p/100)}ms</span>
                    ))}
                  </div>
                  <div style={{width:52}}/>
                </div>
                <div className="span-body">
                  {spans.map((span,i)=>(
                    <div key={span.spanId} className={`span-row depth-${span.depth}`}>
                      <div className="span-info">
                        <span className="span-name" style={{paddingLeft:span.depth*12}}>{span.name}</span>
                        <span className="span-service" style={{paddingLeft:span.depth*12,color:spanColors[i%spanColors.length]}}>{span.service}</span>
                      </div>
                      <div className="span-timeline">
                        {/* Grid lines */}
                        {[25,50,75].map(p=>(
                          <div key={p} style={{position:"absolute",left:p+"%",top:0,bottom:0,width:"1px",background:"rgba(255,255,255,0.04)"}}/>
                        ))}
                        <div
                          className={`span-bar ${span.status==="ok"?"span-ok":"span-error"}`}
                          style={{
                            left:(span.start/spanMax*100)+"%",
                            width:Math.max((span.dur/spanMax*100),1)+"%",
                            background: span.status==="ok" ? spanColors[i%spanColors.length]+"99" : "rgba(255,82,82,0.7)",
                          }}
                        >
                          {span.dur > spanMax*0.08 ? span.dur+"ms" : ""}
                        </div>
                      </div>
                      <div className="span-dur">{span.dur}ms</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Span attributes table */}
              <div className="trace-panel">
                <div className="span-header">
                  <span style={{fontFamily:"var(--mono)",fontSize:10,letterSpacing:1,color:"var(--muted)",textTransform:"uppercase"}}>Span Attributes</span>
                </div>
                <div style={{padding:"12px 16px"}}>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10}}>
                    {spans.map((span,i)=>(
                      <div key={span.spanId} style={{background:"var(--card)",border:"1px solid var(--border)",padding:"10px 12px"}}>
                        <div style={{fontFamily:"var(--mono)",fontSize:10,color:spanColors[i%spanColors.length],marginBottom:6,letterSpacing:0.5}}>{span.name}</div>
                        {[
                          ["span_id", span.spanId],
                          ["service", span.service],
                          ["status", span.status],
                          ["duration", span.dur+"ms"],
                          ["http.status", "200"],
                          ["fapi.interaction_id", span.traceId.slice(0,12)+"…"],
                        ].map(([k,v])=>(
                          <div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                            <span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--muted)"}}>{k}</span>
                            <span style={{fontFamily:"var(--mono)",fontSize:10,color:k==="status"&&span.status==="error"?"var(--red)":"var(--text)"}}>{v}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
