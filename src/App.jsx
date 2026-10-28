import { useState, useEffect, useRef } from "react";

import { DOMAINS } from "./data/domains.js";
import { TOOLS } from "./data/tools.js";
import { AGENT_BUILDS } from "./data/agentBuilds.js";
import { AGENT_STEPS } from "./data/agentSteps.js";
import { CONVERSATION } from "./data/conversation.js";
import { apiConsoleRequest, resolveEndpointPath, defaultBody, getApiMode, setApiMode } from "./api/index.js";
import { useAuth } from "./context/AuthContext.jsx";
import { OBS_MODELS, rnd, makeSession, makeHistory, makeHex } from "./mock/sessions.js";
import ObservabilityOverlay from "./Observability.jsx";
import McpTab from "./components/McpTab.jsx";
import SdkTab from "./components/SdkTab.jsx";

/* ══════════════════════════════════════════════════════
   STYLES
══════════════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
:root{
  --bg:#f8f7f4; --ink:#0d0f14; --mid:#5a6270; --line:#e2e0da; --cream:#f0ede6;
  --gold:#c9a84c;
  --mono:'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  --sans:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --display:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --dbg:#07090d; --dsurf:#0c1018; --dcard:#101620; --dborder:#18222e;
  --blue:#4fc3f7; --green:#00e676; --purple:#ce93d8; --red:#ff5252; --orange:#ffb74d;
}
html{scroll-behavior:smooth;}
body{background:var(--bg);color:var(--ink);font-family:var(--sans);overflow-x:hidden;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;}
.nav{position:fixed;top:0;left:0;right:0;z-index:300;display:flex;align-items:center;justify-content:space-between;padding:0 40px;height:60px;background:rgba(248,247,244,.95);backdrop-filter:blur(12px);border-bottom:1px solid var(--line);}
.nav-logo{font-family:var(--sans);font-size:18px;font-weight:700;color:var(--ink);letter-spacing:-0.025em;}
.nav-logo span{color:var(--gold);}
.nav-links{display:flex;gap:26px;}
.nl{font-size:13px;font-weight:500;color:var(--mid);cursor:pointer;text-decoration:none;transition:color .2s;}
.nl:hover{color:var(--ink);}
.nav-btn{font-family:var(--sans);background:var(--ink);color:var(--bg);padding:8px 18px;font-size:13px;font-weight:600;border:none;cursor:pointer;transition:background .2s;}
.nav-btn:hover{background:#2d3548;}
.hero{min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:120px 40px 80px;position:relative;overflow:hidden;}
.hero-grid{position:absolute;inset:0;background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:48px 48px;opacity:.5;}
.hero-inner{position:relative;max-width:900px;}
.hero-tag{display:inline-flex;align-items:center;gap:8px;background:var(--ink);color:var(--bg);font-family:var(--sans);font-size:11px;font-weight:600;letter-spacing:0.06em;padding:6px 13px;margin-bottom:28px;}
.hero-dot{width:6px;height:6px;border-radius:50%;background:var(--gold);animation:pulse 2s infinite;}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
h1{font-family:var(--sans);font-size:clamp(38px,5.2vw,66px);font-weight:700;line-height:1.06;letter-spacing:-0.028em;margin-bottom:28px;}
h1 em{font-style:normal;color:var(--gold);}
.hero-p{font-size:17px;color:var(--mid);line-height:1.65;max-width:600px;margin-bottom:44px;font-weight:400;}
.btn-row{display:flex;gap:16px;flex-wrap:wrap;}
.btn-dark{font-family:var(--sans);background:var(--ink);color:var(--bg);padding:13px 26px;font-size:14px;font-weight:600;border:2px solid var(--ink);cursor:pointer;transition:all .2s;}
.btn-dark:hover{background:transparent;color:var(--ink);}
.btn-light{font-family:var(--sans);background:transparent;color:var(--ink);padding:13px 26px;font-size:14px;font-weight:600;border:2px solid var(--ink);cursor:pointer;transition:all .2s;}
.btn-light:hover{background:var(--ink);color:var(--bg);}
.hero-stats{display:flex;gap:44px;margin-top:72px;padding-top:36px;border-top:1px solid var(--line);flex-wrap:wrap;}
.stat-n{font-family:var(--sans);font-size:32px;font-weight:700;letter-spacing:-0.025em;}.stat-n span{color:var(--gold);}
.stat-l{font-family:var(--sans);font-size:11.5px;font-weight:600;color:var(--mid);margin-top:4px;letter-spacing:0.06em;text-transform:uppercase;}
.sec{padding:96px 40px;}
.sec-tag{font-family:var(--sans);font-size:11.5px;font-weight:600;letter-spacing:0.08em;color:#9a7b2c;text-transform:uppercase;margin-bottom:14px;display:block;}
.sec-h{font-family:var(--sans);font-size:clamp(26px,3.2vw,38px);font-weight:700;letter-spacing:-0.022em;line-height:1.16;margin-bottom:18px;}
.sec-p{font-size:16px;color:var(--mid);line-height:1.68;max-width:600px;margin-bottom:52px;}
.dark{background:var(--ink);color:var(--bg);}
.dark .sec-tag{color:var(--gold);}
.dark .sec-h{color:var(--bg);}
.dark .sec-p{color:rgba(255,255,255,.72);}
.agent-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:start;}
.agent-feats{display:flex;flex-direction:column;gap:20px;}
.feat{padding:22px;border:1px solid rgba(255,255,255,.12);transition:border-color .2s;}
.feat:hover{border-color:var(--gold);}
.feat-icon{font-size:19px;margin-bottom:10px;}
.feat-h{font-size:15px;font-weight:600;letter-spacing:-0.01em;margin-bottom:7px;color:var(--bg);}
.feat-p{font-size:13.5px;color:rgba(255,255,255,.72);line-height:1.6;}
.term{background:#0a0c10;border:1px solid rgba(255,255,255,.12);}
.term-bar{display:flex;align-items:center;gap:7px;padding:11px 15px;border-bottom:1px solid rgba(255,255,255,.09);}
.tdot{width:10px;height:10px;border-radius:50%;}
.term-lbl{font-family:var(--sans);font-size:11px;font-weight:600;color:#8b9bb4;margin-left:6px;letter-spacing:0.06em;}
.term-body{padding:18px;max-height:460px;overflow-y:auto;font-family:var(--mono);font-size:11.5px;line-height:1.75;}
.tm-agent{color:#64b5f6;margin-bottom:7px;}
.tm-lbl{color:rgba(100,181,246,.75);margin-right:6px;}
.tm-call{margin-bottom:3px;}
.tm-tool{color:var(--gold);}
.tm-tlbl{color:rgba(201,168,76,.75);margin-right:4px;}
.tm-params{color:#94a3b8;font-size:10.5px;}
.tm-res{margin:3px 0 9px 14px;padding:9px 11px;background:rgba(255,255,255,.035);border-left:2px solid rgba(255,255,255,.15);}
.tm-rlbl{color:#8b9bb4;font-size:10px;margin-bottom:3px;}
.tm-rval{color:#a5d6a7;font-size:10.5px;}
.svc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1px;background:var(--line);border:1px solid var(--line);}
.svc-card{background:var(--bg);padding:28px;cursor:pointer;transition:background .2s;position:relative;overflow:hidden;}
.svc-card:hover{background:var(--cream);}
.svc-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--c,#888);opacity:0;transition:opacity .2s;}
.svc-card:hover::before{opacity:1;}
.svc-icon{font-size:22px;margin-bottom:14px;}
.svc-name{font-size:16.5px;font-weight:600;letter-spacing:-0.015em;margin-bottom:4px;}
.svc-bian{font-family:var(--mono);font-size:10.5px;color:var(--mid);margin-bottom:10px;}
.svc-desc{font-size:13.5px;color:var(--mid);line-height:1.6;margin-bottom:14px;}
.svc-meta{font-family:var(--sans);font-size:12px;display:flex;gap:14px;color:var(--mid);}
.svc-meta span{color:var(--ink);font-weight:600;}
.tools-sec{padding:96px 40px;background:var(--cream);}
.tools-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(255px,1fr));gap:13px;}
.tool-card{padding:18px;background:var(--bg);border:1px solid var(--line);}
.tool-name{font-family:var(--mono);font-size:13px;font-weight:600;margin-bottom:4px;}
.tool-dom{font-family:var(--sans);font-size:10.5px;font-weight:600;letter-spacing:0.06em;color:var(--mid);margin-bottom:8px;text-transform:uppercase;}
.tool-desc{font-size:12.5px;color:var(--mid);line-height:1.55;margin-bottom:10px;}
.tool-params{display:flex;flex-wrap:wrap;gap:4px;}
.tool-p{font-family:var(--mono);font-size:10.5px;padding:2px 6px;background:var(--cream);color:var(--mid);border:1px solid var(--line);}
.uc-sec{padding:96px 40px;background:var(--cream);}
.uc-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:start;}
.uc-steps{display:flex;flex-direction:column;}
.uc-step{display:flex;cursor:pointer;}
.step-spine{display:flex;flex-direction:column;align-items:center;width:44px;flex-shrink:0;}
.step-circle{width:30px;height:30px;border-radius:50%;border:2px solid var(--line);display:flex;align-items:center;justify-content:center;font-family:var(--sans);font-size:12px;font-weight:600;background:var(--bg);color:var(--mid);transition:all .2s;z-index:1;}
.uc-step.active .step-circle{background:var(--ink);color:var(--bg);border-color:var(--ink);}
.uc-step.done .step-circle{background:var(--gold);color:#000;border-color:var(--gold);}
.step-line-v{width:2px;flex:1;background:var(--line);min-height:14px;}
.uc-step:last-child .step-line-v{display:none;}
.step-body{padding:0 0 22px 14px;flex:1;}
.step-title{font-size:14.5px;font-weight:600;letter-spacing:-0.01em;margin-bottom:3px;}
.step-dom{font-family:var(--sans);font-size:10.5px;font-weight:600;letter-spacing:0.06em;margin-bottom:5px;text-transform:uppercase;}
.step-desc{font-size:13px;color:var(--mid);line-height:1.55;max-height:0;overflow:hidden;transition:max-height .3s ease;}
.uc-step.active .step-desc{max-height:120px;}
.code-box{background:#0a0c10;border:1px solid rgba(255,255,255,.1);position:sticky;top:76px;}
.code-topbar{display:flex;align-items:center;justify-content:space-between;padding:11px 15px;border-bottom:1px solid rgba(255,255,255,.08);}
.cdots{display:flex;gap:6px;}
.cdot{width:10px;height:10px;border-radius:50%;}
.code-lbl{font-family:var(--sans);font-size:11px;font-weight:600;color:#8b9bb4;letter-spacing:0.06em;}
.code-badge{font-family:var(--sans);font-size:10.5px;font-weight:600;padding:2px 8px;border:1px solid;border-radius:10px;}
.code-scroll{padding:18px;overflow:auto;max-height:460px;}
.code-scroll pre{font-family:var(--mono);font-size:11.5px;line-height:1.75;color:#a5d6a7;white-space:pre;}
.arch-full{padding:80px 40px 96px;}
.arch-section-hdr{font-family:var(--sans);font-size:11px;font-weight:600;letter-spacing:0.08em;color:var(--gold);text-transform:uppercase;margin-bottom:18px;padding-bottom:10px;border-bottom:1px solid rgba(201,168,76,.2);}
.arch-stack{display:flex;flex-direction:column;gap:2px;margin-bottom:64px;}
.arch-row{display:grid;grid-template-columns:150px 1fr;align-items:stretch;}
.arch-lbl{font-family:var(--sans);font-size:10.5px;font-weight:600;letter-spacing:0.06em;color:rgba(255,255,255,.45);flex-shrink:0;text-transform:uppercase;display:flex;align-items:center;padding-right:18px;border-right:1px solid rgba(255,255,255,.08);margin-right:0;}
.arch-band{flex:1;padding:12px 18px;border:1px solid rgba(255,255,255,.08);margin-left:18px;}
.arch-comps{display:flex;gap:6px;flex-wrap:wrap;}
.arch-chip{font-family:var(--sans);font-size:11.5px;font-weight:500;padding:4px 10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.11);color:rgba(255,255,255,.72);}
.arch-chip.hi{background:rgba(201,168,76,.12);border-color:rgba(201,168,76,.4);color:var(--gold);}
.arch-chip.blue{background:rgba(79,195,247,.1);border-color:rgba(79,195,247,.35);color:#4fc3f7;}
.arch-chip.green{background:rgba(0,230,118,.08);border-color:rgba(0,230,118,.3);color:#00e676;}
.arch-chip.purple{background:rgba(206,147,216,.08);border-color:rgba(206,147,216,.25);color:#ce93d8;}
.arch-connect{grid-column:2;height:18px;display:flex;align-items:center;padding-left:18px;}
.arch-connect-line{width:1px;height:100%;background:rgba(255,255,255,.07);margin-left:22px;}
.arch-channels{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:64px;}
.arch-chan{border:1px solid rgba(255,255,255,.08);display:flex;flex-direction:column;}
.arch-chan-hdr{padding:13px 16px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;gap:10px;}
.arch-chan-icon{font-size:15px;}
.arch-chan-title{font-size:13.5px;font-weight:600;color:rgba(255,255,255,.88);}
.arch-chan-sub{font-family:var(--sans);font-size:10px;font-weight:500;letter-spacing:0.06em;color:rgba(255,255,255,.4);margin-top:1px;}
.arch-chan-body{padding:14px 16px;flex:1;display:flex;flex-direction:column;gap:10px;}
.arch-flow-step{display:flex;align-items:flex-start;gap:10px;}
.arch-flow-dot{width:20px;height:20px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-family:var(--sans);font-size:10px;font-weight:600;margin-top:1px;}
.arch-flow-text{font-size:12.5px;color:rgba(255,255,255,.6);line-height:1.55;}
.arch-flow-text strong{color:rgba(255,255,255,.88);font-weight:600;}
.arch-flow-arrow{font-family:var(--sans);font-size:10px;color:rgba(255,255,255,.25);padding-left:30px;}
.arch-domains{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px;margin-bottom:64px;}
.arch-domain{padding:16px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.02);}
.arch-domain-top{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
.arch-domain-icon{font-size:18px;}
.arch-domain-name{font-size:13.5px;font-weight:600;color:rgba(255,255,255,.88);}
.arch-domain-bian{font-family:var(--mono);font-size:10px;color:rgba(255,255,255,.45);}
.arch-domain-divider{height:1px;background:rgba(255,255,255,.06);margin-bottom:10px;}
.arch-domain-caps{display:flex;flex-direction:column;gap:4px;}
.arch-domain-cap{font-size:12px;color:rgba(255,255,255,.55);display:flex;align-items:flex-start;gap:6px;}
.arch-domain-cap::before{content:'→';color:rgba(255,255,255,.25);flex-shrink:0;font-family:var(--sans);font-size:11px;}
.arch-ob{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-bottom:64px;}
.arch-ob-card{padding:16px;border:1px solid rgba(79,195,247,.15);background:rgba(79,195,247,.03);}
.arch-ob-name{font-size:13.5px;font-weight:600;color:#4fc3f7;margin-bottom:10px;}
.arch-ob-ep{font-family:var(--mono);font-size:10.5px;color:rgba(255,255,255,.45);padding:3px 0;border-bottom:1px solid rgba(255,255,255,.04);display:flex;justify-content:space-between;align-items:center;}
.arch-ob-ep:last-child{border-bottom:none;}
.arch-ob-badge{font-size:9px;font-weight:700;padding:1px 4px;border-radius:1px;}
.ob-GET{background:#1a3d1a;color:#4caf50;}.ob-POST{background:#1a2a4a;color:#64b5f6;}.ob-PUT{background:#3d2a0a;color:#ffb74d;}
.arch-standards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;}
.arch-std{padding:16px;border:1px solid rgba(255,255,255,.08);}
.arch-std-name{font-size:14px;font-weight:600;color:rgba(255,255,255,.88);margin-bottom:3px;}
.arch-std-ver{font-family:var(--mono);font-size:10.5px;color:var(--gold);margin-bottom:8px;}
.arch-std-desc{font-size:12.5px;color:rgba(255,255,255,.55);line-height:1.55;}
@media(max-width:900px){.arch-channels{grid-template-columns:1fr;}.arch-full{padding:56px 20px 72px;}}
@media(max-width:768px){.arch-row{grid-template-columns:90px 1fr;}.arch-lbl{font-size:9px;}}
.overlay{position:fixed;inset:0;background:rgba(13,15,20,.87);z-index:500;display:flex;align-items:flex-start;justify-content:center;padding:40px 20px;overflow-y:auto;}
.modal{background:var(--bg);width:100%;max-width:760px;border:1px solid var(--line);}
.modal-hdr{padding:26px 30px 22px;border-bottom:1px solid var(--line);display:flex;align-items:flex-start;justify-content:space-between;gap:14px;}
.modal-title{font-family:var(--sans);font-size:22px;font-weight:700;letter-spacing:-0.02em;}
.modal-bian{font-family:var(--mono);font-size:11px;color:var(--mid);margin-top:4px;}
.modal-x{background:none;border:1px solid var(--line);padding:7px 11px;cursor:pointer;font-size:15px;color:var(--mid);transition:all .2s;}
.modal-x:hover{background:var(--ink);color:var(--bg);border-color:var(--ink);}
.modal-body{padding:28px 30px;}
.modal-tabs{display:flex;border-bottom:1px solid var(--line);margin-bottom:24px;}
.mtab{font-family:var(--sans);padding:9px 18px;font-size:13px;font-weight:600;background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;color:var(--mid);transition:all .2s;}
.mtab.on{color:var(--ink);border-bottom-color:var(--ink);}
.ep-list{display:flex;flex-direction:column;gap:7px;}
.ep-row{display:flex;align-items:flex-start;gap:11px;padding:11px 13px;background:var(--cream);border:1px solid var(--line);}
.ep-badge{font-family:var(--mono);font-size:10px;font-weight:600;padding:2px 6px;border-radius:2px;flex-shrink:0;margin-top:1px;}
.badge-GET{background:#e3f4e8;color:#2e7d32;}
.badge-POST{background:#e8f0fe;color:#1565c0;}
.badge-PUT{background:#fff3e0;color:#e65100;}
.ep-path{font-family:var(--mono);font-size:11.5px;color:var(--ink);word-break:break-all;}
.ep-desc{font-size:12.5px;color:var(--mid);margin-top:3px;}
.cap-list{display:flex;flex-direction:column;gap:9px;}
.cap-row{display:flex;align-items:center;gap:11px;padding:11px 15px;border:1px solid var(--line);}
.cap-tick{width:19px;height:19px;border-radius:50%;background:var(--ink);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:10px;color:var(--bg);}
.cap-text{font-size:13.5px;font-weight:500;}
.scope-box{margin-top:14px;padding:14px;background:var(--cream);border:1px solid var(--line);}
.scope-lbl{font-family:var(--sans);font-size:10.5px;font-weight:600;letter-spacing:0.06em;color:var(--mid);margin-bottom:6px;}
.console-wrap{position:fixed;inset:0;background:#070a0e;z-index:600;display:flex;flex-direction:column;}
.console-top{display:flex;align-items:center;justify-content:space-between;padding:0 22px;height:52px;background:#0c1018;border-bottom:1px solid #18222e;flex-shrink:0;}
.console-logo{font-family:var(--sans);font-size:16px;font-weight:700;letter-spacing:-0.02em;color:#fff;}
.console-logo span{color:var(--gold);}
.console-sub{font-family:var(--sans);font-size:11px;font-weight:600;color:#8b9bb4;margin-left:10px;letter-spacing:0.06em;text-transform:uppercase;}
.console-x{font-family:var(--sans);font-size:11.5px;font-weight:600;padding:6px 14px;background:rgba(255,255,255,.06);border:1px solid #263849;color:#94a3b8;cursor:pointer;letter-spacing:0.04em;transition:all .2s;}
.console-x:hover{background:rgba(255,255,255,.12);color:#fff;}
.console-inner{display:flex;flex:1;overflow:hidden;}
.console-sidebar{width:210px;flex-shrink:0;border-right:1px solid #18222e;overflow-y:auto;background:#070a0e;}
.csb-lbl{font-family:var(--sans);font-size:10.5px;font-weight:600;letter-spacing:0.08em;color:#8b9bb4;padding:13px 14px 5px;text-transform:uppercase;}
.csb-item{padding:9px 14px;cursor:pointer;transition:background .15s;display:flex;align-items:center;gap:8px;}
.csb-item:hover{background:rgba(255,255,255,.04);}
.csb-item.on{background:rgba(201,168,76,.12);border-right:2px solid var(--gold);}
.csb-icon{font-size:12px;}
.csb-name{font-family:var(--sans);font-size:12.5px;font-weight:500;color:#cbd5e1;}
.csb-item.on .csb-name{color:var(--gold);font-weight:600;}
.console-main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;}
.ep-bar{padding:9px 14px;border-bottom:1px solid #18222e;display:flex;gap:5px;flex-wrap:wrap;background:#09101a;flex-shrink:0;}
.ep-btn{font-family:var(--mono);font-size:10.5px;padding:4px 9px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);color:#94a3b8;cursor:pointer;transition:all .15s;display:flex;gap:4px;align-items:center;}
.ep-btn:hover{background:rgba(255,255,255,.08);color:#e2e8f0;}
.ep-btn.on{background:rgba(201,168,76,.12);border-color:rgba(201,168,76,.45);color:var(--gold);}
.em{font-size:9px;font-weight:700;padding:1px 4px;border-radius:1px;}
.em-GET{background:#1a3d1a;color:#4caf50;}
.em-POST{background:#1a2a4a;color:#64b5f6;}
.em-PUT{background:#3d2a0a;color:#ffb74d;}
.workspace{flex:1;display:grid;grid-template-columns:1fr 1fr;overflow:hidden;}
.req-pane,.res-pane{display:flex;flex-direction:column;overflow:hidden;}
.req-pane{border-right:1px solid #18222e;}
.pane-hdr{padding:8px 14px;border-bottom:1px solid #18222e;font-family:var(--sans);font-size:11px;font-weight:600;letter-spacing:0.06em;color:#8b9bb4;background:#070a0e;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:8px;}
.url-row{display:flex;align-items:center;padding:9px 13px;border-bottom:1px solid #18222e;flex-shrink:0;background:#09101a;}
.url-method{font-family:var(--mono);font-size:11px;font-weight:600;padding:7px 9px;border:1px solid rgba(255,255,255,.12);border-right:none;min-width:54px;text-align:center;}
.um-GET{color:#4caf50;background:rgba(76,175,80,.09);}
.um-POST{color:#64b5f6;background:rgba(100,181,246,.09);}
.um-PUT{color:#ffb74d;background:rgba(255,183,77,.09);}
.url-path{flex:1;font-family:var(--mono);font-size:11.5px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);color:#e2e8f0;padding:7px 9px;outline:none;min-width:0;}
.send{padding:7px 16px;background:var(--gold);color:#000;font-family:var(--sans);font-size:12px;font-weight:600;border:none;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:background .15s;}
.send:hover{background:#dbb95a;}
.send:disabled{opacity:.4;cursor:not-allowed;}
.req-fields{flex:1;overflow-y:auto;}
.field-section{border-bottom:1px solid rgba(255,255,255,.06);}
.field-sec-hdr{padding:8px 14px;font-family:var(--sans);font-size:10.5px;font-weight:600;letter-spacing:0.06em;color:#8b9bb4;background:#070a0e;}
.field{padding:7px 14px;display:flex;flex-direction:column;gap:3px;}
.field-lbl{font-family:var(--sans);font-size:11px;font-weight:500;color:#8b9bb4;}
.field-inp{font-family:var(--mono);font-size:11.5px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);color:#e2e8f0;padding:6px 9px;outline:none;width:100%;}
.field-inp:focus{border-color:rgba(201,168,76,.55);}
.field-ta{font-family:var(--mono);font-size:11.5px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.1);color:#a5d6a7;padding:10px;outline:none;width:100%;resize:none;line-height:1.6;}
.field-ta:focus{border-color:rgba(201,168,76,.45);}
.res-body{flex:1;overflow-y:auto;padding:14px;}
.res-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:180px;color:#64748b;gap:8px;}
.res-empty-icon{font-size:26px;}
.res-empty-text{font-family:var(--sans);font-size:11.5px;font-weight:500;letter-spacing:0.06em;}
.res-meta{display:flex;gap:10px;margin-bottom:12px;align-items:center;flex-wrap:wrap;}
.res-status{font-family:var(--mono);font-size:12px;font-weight:600;padding:3px 9px;background:rgba(76,175,80,.12);border:1px solid rgba(76,175,80,.35);color:#4caf50;}
.res-status.err{background:rgba(255,82,82,.12);border-color:rgba(255,82,82,.4);color:var(--red);}
.mode-toggle{display:inline-flex;border:1px solid #263849;background:#070a0e;margin-left:14px;}
.mode-btn{font-family:var(--sans);font-size:11px;font-weight:600;padding:4px 10px;background:transparent;border:none;color:#8b9bb4;cursor:pointer;letter-spacing:0.04em;transition:all .15s;}
.mode-btn.on-mock{background:rgba(201,168,76,.16);color:var(--gold);}
.mode-btn.on-live{background:rgba(0,230,118,.14);color:var(--green);}
.res-time{font-family:var(--mono);font-size:11.5px;color:#8b9bb4;}
.res-json{font-family:var(--mono);font-size:11.5px;line-height:1.7;color:#a5d6a7;white-space:pre-wrap;word-break:break-all;}
.res-loading{display:flex;align-items:center;gap:9px;color:var(--gold);font-family:var(--sans);font-size:12.5px;font-weight:500;padding:18px 0;}
.spinner{width:15px;height:15px;border:2px solid rgba(201,168,76,.2);border-top-color:var(--gold);border-radius:50%;animation:spin .7s linear infinite;}
@keyframes spin{to{transform:rotate(360deg)}}
.obs-wrap{position:fixed;inset:0;background:#07090d;z-index:600;display:flex;flex-direction:column;}
.obs-top{display:flex;align-items:center;justify-content:space-between;padding:0 22px;height:52px;background:#0c1018;border-bottom:1px solid #18222e;flex-shrink:0;}
.obs-logo{font-family:var(--sans);font-size:16px;font-weight:700;letter-spacing:-0.02em;color:#fff;}
.obs-logo span{color:var(--gold);}
.obs-sub{font-family:var(--sans);font-size:11px;font-weight:600;color:#8b9bb4;margin-left:10px;letter-spacing:0.06em;text-transform:uppercase;}
.obs-right{display:flex;align-items:center;gap:12px;}
.live-pill{display:flex;align-items:center;gap:6px;background:rgba(0,230,118,.08);border:1px solid rgba(0,230,118,.3);padding:4px 10px;}
.ldot{width:6px;height:6px;border-radius:50%;background:var(--green);animation:blink 1.5s infinite;}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
.ltext{font-family:var(--sans);font-size:11px;font-weight:600;color:var(--green);letter-spacing:0.04em;}
.pause-btn{font-family:var(--sans);font-size:11.5px;font-weight:600;padding:5px 13px;background:rgba(255,255,255,.05);border:1px solid #263849;color:#94a3b8;cursor:pointer;transition:all .2s;letter-spacing:0.04em;}
.pause-btn:hover,.pause-btn.paused{background:rgba(201,168,76,.1);border-color:rgba(201,168,76,.45);color:var(--gold);}
.obs-tabs{display:flex;background:#0c1018;border-bottom:1px solid #18222e;padding:0 22px;}
.otab{padding:11px 18px;font-family:var(--sans);font-size:12px;font-weight:600;letter-spacing:0.04em;color:#8b9bb4;cursor:pointer;border-bottom:2px solid transparent;background:none;border-top:none;border-left:none;border-right:none;transition:all .2s;}
.otab:hover{color:#e2e8f0;}
.otab.on{color:var(--gold);border-bottom-color:var(--gold);}
.obs-page{padding:18px 22px;overflow-y:auto;flex:1;}
.kpi-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:11px;margin-bottom:18px;}
.kpi{background:#101620;border:1px solid #18222e;padding:14px;}
.kpi-lbl{font-family:var(--sans);font-size:10.5px;font-weight:600;letter-spacing:0.06em;color:#8b9bb4;text-transform:uppercase;margin-bottom:7px;}
.kpi-val{font-family:var(--sans);font-size:22px;font-weight:700;letter-spacing:-0.02em;}
.kpi-sub{font-family:var(--sans);font-size:11px;margin-top:3px;color:#8b9bb4;}
.chart-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px;}
.chart-row-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:18px;}
.chart-card{background:#101620;border:1px solid #18222e;padding:14px;}
.chart-hdr{font-family:var(--sans);font-size:11px;font-weight:600;letter-spacing:0.06em;color:#8b9bb4;text-transform:uppercase;margin-bottom:12px;}
.sess-table{background:#101620;border:1px solid #18222e;overflow:hidden;}
.srow{display:grid;grid-template-columns:100px 120px 1fr 85px 75px 85px 150px;padding:8px 14px;border-bottom:1px solid rgba(255,255,255,.04);font-family:var(--sans);font-size:12px;align-items:center;cursor:pointer;transition:background .15s;}
.srow:hover{background:rgba(255,255,255,.035);}
.srow.on{background:rgba(201,168,76,.09);border-left:2px solid var(--gold);}
.srow-hdr{color:#8b9bb4;font-size:10.5px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;cursor:default;}
.srow-hdr:hover{background:transparent;}
.srow.console-row{border-left:2px solid rgba(79,195,247,.55);}
.sbadge{font-family:var(--sans);font-size:10.5px;font-weight:600;padding:2px 7px;}
.sb-success{background:rgba(0,230,118,.1);color:var(--green);border:1px solid rgba(0,230,118,.3);}
.sb-error{background:rgba(255,82,82,.1);color:var(--red);border:1px solid rgba(255,82,82,.3);}
.sb-timeout{background:rgba(255,183,77,.1);color:var(--orange);border:1px solid rgba(255,183,77,.3);}
.trace-layout{display:grid;grid-template-columns:1fr 340px;gap:14px;}
.trace-panel,.detail-panel{background:#101620;border:1px solid #18222e;}
.panel-hdr{padding:9px 14px;border-bottom:1px solid #18222e;display:flex;align-items:center;justify-content:space-between;}
.panel-hdr-lbl{font-family:var(--sans);font-size:11px;font-weight:600;letter-spacing:0.06em;color:#8b9bb4;text-transform:uppercase;}
.panel-tid{font-family:var(--mono);font-size:10.5px;color:var(--gold);}
.trace-body{padding:14px;max-height:460px;overflow-y:auto;font-family:var(--mono);font-size:11.5px;line-height:1.8;}
.tl{display:flex;gap:9px;margin-bottom:2px;}
.tl-t{color:#64748b;width:54px;flex-shrink:0;font-size:10.5px;padding-top:1px;}
.tl-sys{color:#cbd5e1;}
.tl-auth{color:var(--blue);}
.tl-think{color:#94a3b8;}
.tl-call{color:var(--gold);}
.tl-ret{color:var(--green);}
.tl-done{color:#fff;font-weight:500;}
.detail-sec{padding:13px 14px;border-bottom:1px solid #18222e;}
.detail-sec:last-child{border-bottom:none;}
.dlbl{font-family:var(--sans);font-size:10.5px;font-weight:600;letter-spacing:0.08em;color:#8b9bb4;text-transform:uppercase;margin-bottom:9px;}
.drow{display:flex;justify-content:space-between;margin-bottom:5px;gap:8px;}
.dk{font-family:var(--sans);font-size:11.5px;color:#8b9bb4;}
.dv{font-family:var(--mono);font-size:11.5px;color:#e2e8f0;text-align:right;}
.dv.gold{color:var(--gold);}
.dv.green{color:var(--green);}
.dv.blue{color:var(--blue);}
.tok-wrap{margin-top:7px;}
.tok-row{display:flex;justify-content:space-between;font-family:var(--sans);font-size:11px;color:#8b9bb4;margin-bottom:3px;}
.tok-track{height:5px;background:#18222e;border-radius:3px;overflow:hidden;}
.tok-fill{height:100%;border-radius:3px;transition:width .5s;}
.span-panel{background:#101620;border:1px solid #18222e;margin-bottom:14px;}
.span-body{padding:14px;overflow-x:auto;}
.span-ruler{display:flex;justify-content:space-between;padding:0 0 6px;min-width:500px;}
.span-ruler span{font-family:var(--mono);font-size:10px;color:#64748b;}
.span-row{display:flex;align-items:center;gap:0;margin-bottom:5px;min-width:500px;}
.span-info{width:220px;flex-shrink:0;}
.span-name{font-family:var(--mono);font-size:11.5px;color:#e2e8f0;}
.span-svc{font-family:var(--sans);font-size:10.5px;font-weight:500;color:#8b9bb4;}
.span-track{flex:1;position:relative;height:22px;}
.span-bar{position:absolute;height:16px;top:3px;border-radius:2px;display:flex;align-items:center;padding:0 5px;font-family:var(--mono);font-size:9.5px;color:rgba(0,0,0,.85);font-weight:600;overflow:hidden;white-space:nowrap;min-width:4px;}
.span-dur{font-family:var(--mono);font-size:10.5px;color:#8b9bb4;width:48px;text-align:right;flex-shrink:0;}
.attr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:9px;padding:14px;}
.attr-card{background:#0c1018;border:1px solid #18222e;padding:10px 12px;}
.attr-name{font-family:var(--mono);font-size:11px;font-weight:600;margin-bottom:5px;}
.attr-row{display:flex;justify-content:space-between;margin-bottom:3px;}
.attr-k{font-family:var(--sans);font-size:11px;color:#8b9bb4;}
.attr-v{font-family:var(--mono);font-size:11px;color:#e2e8f0;}
.builds-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;margin-bottom:40px;}
.build-card{padding:22px;border:1px solid var(--line);cursor:pointer;transition:border-color .2s,background .2s;}
.build-card:hover{border-color:var(--gold);}
.build-card.active{border-color:var(--gold);background:var(--cream);}
.build-card-icon{font-size:20px;margin-bottom:10px;}
.build-card-name{font-size:14.5px;font-weight:600;letter-spacing:-0.01em;margin-bottom:6px;}
.build-card-desc{font-size:12.5px;color:var(--mid);line-height:1.55;margin-bottom:12px;}
.build-tags{display:flex;flex-wrap:wrap;gap:5px;}
.build-tag{font-family:var(--sans);font-size:10.5px;font-weight:500;padding:2px 7px;border:1px solid var(--line);color:var(--mid);}
.build-viewer{border:1px solid var(--line);}
.build-viewer-bar{display:flex;align-items:center;justify-content:space-between;padding:11px 16px;border-bottom:1px solid var(--line);background:var(--cream);}
.build-viewer-title{font-family:var(--sans);font-size:11.5px;font-weight:600;letter-spacing:0.05em;color:var(--mid);}
.build-viewer-badge{font-family:var(--sans);font-size:10.5px;font-weight:600;padding:2px 8px;border:1px solid;}
.build-viewer-code{background:#07090d;padding:24px;overflow-x:auto;}
.build-viewer-code pre{font-family:var(--mono);font-size:12px;line-height:1.8;color:#c8d8e8;margin:0;white-space:pre;}
.mcp-sec{padding:96px 40px;}
.mcp-grid{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:40px;}
.mcp-card{border:1px solid var(--line);padding:28px;}
.mcp-card-hdr{display:flex;align-items:center;gap:10px;margin-bottom:16px;}
.mcp-card-icon{font-size:18px;}
.mcp-card-title{font-size:15.5px;font-weight:600;letter-spacing:-0.01em;}
.mcp-card-sub{font-size:13px;color:var(--mid);line-height:1.6;margin-bottom:18px;}
.mcp-copy-block{position:relative;}
.mcp-code{background:#07090d;border:1px solid rgba(255,255,255,.09);padding:16px;font-family:var(--mono);font-size:11.5px;line-height:1.75;color:#a5d6a7;overflow-x:auto;white-space:pre;}
.mcp-copy-btn{position:absolute;top:8px;right:8px;font-family:var(--sans);font-size:10.5px;font-weight:600;padding:4px 10px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.55);cursor:pointer;transition:all .15s;}
.mcp-copy-btn:hover{background:rgba(201,168,76,.12);border-color:rgba(201,168,76,.4);color:var(--gold);}
.mcp-tools-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;margin-top:40px;}
.mcp-tool{padding:16px;border:1px solid var(--line);background:var(--cream);}
.mcp-tool-name{font-family:var(--mono);font-size:13px;font-weight:600;margin-bottom:4px;}
.mcp-tool-desc{font-size:12.5px;color:var(--mid);line-height:1.55;margin-bottom:10px;}
.mcp-schema{font-family:var(--mono);font-size:10.5px;color:var(--mid);display:flex;flex-wrap:wrap;gap:4px;}
.mcp-param{padding:2px 6px;background:var(--bg);border:1px solid var(--line);}
.mcp-param.req{border-color:var(--gold);color:#9a7b2c;font-weight:500;}
.mcp-term{margin-top:40px;}
@media(max-width:900px){.mcp-grid{grid-template-columns:1fr;}}
.tab-bar{position:sticky;top:60px;z-index:200;background:rgba(248,247,244,.97);backdrop-filter:blur(12px);border-bottom:1px solid var(--line);display:flex;align-items:center;gap:0;padding:0 40px;}
.tab-btn{font-family:var(--sans);font-size:13px;font-weight:600;letter-spacing:-0.005em;padding:14px 22px;background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;color:var(--mid);transition:color .2s,border-color .2s;white-space:nowrap;}
.tab-btn:hover{color:var(--ink);}
.tab-btn.on{color:var(--ink);border-bottom-color:var(--ink);}
footer{padding:56px 40px 36px;border-top:1px solid var(--line);display:flex;flex-wrap:wrap;justify-content:space-between;gap:36px;}
.footer-logo{font-family:var(--sans);font-size:18px;font-weight:700;letter-spacing:-0.025em;margin-bottom:7px;}
.footer-logo span{color:var(--gold);}
.footer-tag{font-size:13px;color:var(--mid);}
.footer-col-hdr{font-size:13px;font-weight:600;margin-bottom:14px;}
.footer-links{display:flex;flex-direction:column;gap:8px;}
.fl{font-size:13px;color:var(--mid);cursor:pointer;transition:color .2s;text-decoration:none;}
.fl:hover{color:var(--ink);}
.footer-bar{padding:20px 40px;border-top:1px solid var(--line);display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;font-family:var(--sans);font-size:12px;color:var(--mid);}
@media(max-width:768px){.tab-bar{padding:0 20px;overflow-x:auto;}.tab-btn{padding:12px 14px;font-size:11px;}}
@media(max-width:1100px){.chart-row-3{grid-template-columns:1fr 1fr;}.trace-layout{grid-template-columns:1fr;}}
@media(max-width:900px){.agent-grid,.uc-grid{grid-template-columns:1fr;}.workspace{display:flex;flex-direction:column;overflow-y:auto;}.req-pane{border-right:none;border-bottom:1px solid #18222e;flex-shrink:0;}.res-pane{flex-shrink:0;min-height:240px;}.trace-layout{grid-template-columns:1fr;}}
@media(max-width:768px){.nav{padding:0 20px;}.nav-links{display:none;}.sec,.tools-sec,.uc-sec{padding:60px 20px;}.hero{padding:100px 20px 60px;}.hero-stats{gap:26px;}footer,.footer-bar{padding-left:20px;padding-right:20px;}.srow{grid-template-columns:80px 1fr 65px 60px;}.srow>*:nth-child(n+5){display:none;}}
`;

export default function App() {
  const { token, setToken }       = useAuth();
  const [apiMode, setApiModeState]= useState(() => getApiMode());
  const [activeTab, setActiveTab] = useState("channel");
  const tabBarRef                  = useRef(null);
  const [modal, setModal]          = useState(null);
  const [modalTab, setModalTab]    = useState("ep");
  const [showConsole, setShowConsole] = useState(false);
  const [showObs, setShowObs]      = useState(false);

  const [termIdx, setTermIdx]      = useState(0);
  const termRef                    = useRef(null);
  const [ucStep, setUcStep]        = useState(0);
  const [selBuild, setSelBuild]    = useState(AGENT_BUILDS[0].id);

  /* console state */
  const [cDomain, setCDomain]  = useState(DOMAINS[0].id);
  const [cEpIdx, setCEpIdx]    = useState(0);
  const [cPath, setCPath]      = useState(() => resolveEndpointPath(DOMAINS[0].endpoints[0].p));
  const [cBody, setCBody]      = useState("");
  const [cResp, setCResp]      = useState(null);
  const [cStatus, setCStatus]  = useState("200 OK");
  const [cOk, setCOk]          = useState(true);
  const [cFapiId, setCFapiId]  = useState("3f785c72-b4a1-4b9c-9221-8d6c3f0e1294");
  const [cLoading, setCLoading]= useState(false);
  const [cTime, setCTime]      = useState(null);
  const [cCopied, setCCopied]  = useState(null);
  const [lastConsoleSessId, setLastConsoleSessId] = useState(null);

  /* observability state */
  const [obsPaused, setObsPaused]  = useState(false);
  const [obsInitTab, setObsInitTab]= useState("metrics");
  const [obsInitSessId, setObsInitSessId] = useState(null);
  const [sessions, setSessions]    = useState(()=>Array.from({length:12},(_,i)=>makeSession(i+1)));
  const [history, setHistory]      = useState(makeHistory);
  const sessCounter                = useRef(13);

  function toggleMode(nextMode) {
    setApiMode(nextMode);
    setApiModeState(nextMode);
  }

  function switchTab(id) {
    setActiveTab(id);
    window.scrollTo({ top: (tabBarRef.current?.offsetTop ?? 0) - 60, behavior: "smooth" });
  }

  /* Escape key closes active modal or overlay */
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") {
        if (modal) setModal(null);
        else if (showConsole) setShowConsole(false);
        else if (showObs) setShowObs(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modal, showConsole, showObs]);

  /* terminal animation */
  useEffect(()=>{
    if (termIdx < CONVERSATION.length) {
      const t = setTimeout(()=>setTermIdx(i=>i+1), 620);
      return ()=>clearTimeout(t);
    }
  },[termIdx]);
  useEffect(()=>{ if(termRef.current) termRef.current.scrollTop=termRef.current.scrollHeight; },[termIdx]);

  /* obs live feed */
  useEffect(()=>{
    if (obsPaused || !showObs) return;
    const t = setInterval(()=>{
      setSessions(p=>[makeSession(sessCounter.current++), ...p].slice(0,40));
      setHistory(p=>{
        const pt={t:new Date().toLocaleTimeString("en",{hour:"2-digit",minute:"2-digit"}),latency:rnd(180,900),inputTok:rnd(1200,4000),outputTok:rnd(200,1600),toolCalls:rnd(2,10),errors:rnd(0,2),sessions:rnd(1,6)};
        return [...p.slice(-19),pt];
      });
    },2400);
    return ()=>clearInterval(t);
  },[obsPaused,showObs]);

  /* console helpers */
  const cDom = DOMAINS.find(d=>d.id===cDomain);
  const cEp  = cDom?.endpoints[cEpIdx];
  function pickDomain(id) {
    const d=DOMAINS.find(x=>x.id===id);
    const ep = d.endpoints[0];
    setCDomain(id); setCEpIdx(0); setCResp(null);
    setCPath(resolveEndpointPath(ep.p));
    setCBody(defaultBody(ep.m, ep.p));
  }
  function pickEp(i) {
    const ep = cDom.endpoints[i];
    setCEpIdx(i); setCResp(null);
    setCPath(resolveEndpointPath(ep.p));
    setCBody(defaultBody(ep.m, ep.p));
  }
  function openConsole() {
    const ep = cDom?.endpoints[cEpIdx] || DOMAINS[0].endpoints[0];
    setCPath(resolveEndpointPath(ep.p));
    setCBody(defaultBody(ep.m, ep.p));
    setShowConsole(true);
  }
  function openConsoleAt(domainId, epIdx = 0) {
    const d = DOMAINS.find(x => x.id === domainId) || DOMAINS[0];
    const safeIdx = d.endpoints[epIdx] ? epIdx : 0;
    const ep = d.endpoints[safeIdx];
    setModal(null);
    setCDomain(d.id);
    setCEpIdx(safeIdx);
    setCResp(null);
    setCPath(resolveEndpointPath(ep.p));
    setCBody(defaultBody(ep.m, ep.p));
    setShowConsole(true);
  }
  function openConsoleForTool(toolName) {
    const TOOL_EP_MAP = {
      get_party:          ["party", 0],
      get_accounts:       ["accounts", 0],
      get_balance:        ["accounts", 2],
      get_transactions:   ["transactions", 0],
      initiate_payment:   ["payments", 0],
      get_payment_status: ["payments", 2],
      get_loan_details:   ["lending", 1],
      apply_for_loan:     ["lending", 0],
      get_card_details:   ["cards", 2],
      block_card:         ["cards", 4],
      get_portfolio:      ["investments", 0],
      place_order:        ["investments", 2],
      run_aml_screen:     ["compliance", 2],
      subscribe_events:   ["notifications", 2],
    };
    const [domId, epIdx] = TOOL_EP_MAP[toolName] || ["accounts", 0];
    openConsoleAt(domId, epIdx);
  }
  function openConsoleForUcStep(stepIdx) {
    const UC_EP_MAP = [
      ["party", 0],
      ["transactions", 0],
      ["savings", 1],
      ["accounts", 2],
      ["payments", 0],
      ["notifications", 2],
    ];
    const [domId, epIdx] = UC_EP_MAP[stepIdx] || ["party", 0];
    openConsoleAt(domId, epIdx);
  }
  function copyToClipboard(key, text) {
    navigator.clipboard.writeText(text);
    setCCopied(key);
    setTimeout(() => setCCopied(null), 1600);
  }

  /* API Console → Observability: real calls appear as sessions with a blue left border */
  async function sendReq() {
    if (!cEp) return;
    setCLoading(true); setCResp(null);

    let parsedBody = null;
    if (cEp.m !== "GET" && cBody.trim()) {
      try {
        parsedBody = JSON.parse(cBody);
      } catch (err) {
        setCTime(1);
        setCStatus("400 Bad Request");
        setCOk(false);
        setCResp({ error: "InvalidJSON", message: err.message });
        setCLoading(false);
        return;
      }
    }

    const res = await apiConsoleRequest(cEp.m, cPath, parsedBody, token, apiMode);
    setCTime(res.latencyMs);
    setCStatus(`${res.status} ${res.statusText}`);
    setCOk(res.ok);
    if (res.fapiId) setCFapiId(res.fapiId);
    setCResp(res.data);
    setCLoading(false);

    const matchedTool = TOOLS.find(t=>t.domain===cDomain) ?? TOOLS[0];
    const newId = `SES-${String(sessCounter.current++).padStart(5,"0")}`;
    const fapiId = res.fapiId || cFapiId || makeHex(16);
    const consoleSess = {
      id: newId,
      traceId: fapiId.replace(/-/g, ""),
      fapiInteractionId: fapiId,
      prevHash: makeHex(64),
      rowHash: makeHex(64),
      customer: apiMode === "live" ? "Aria Chen (PAR-ARIA · Live)" : "Aria Chen (PAR-ARIA · Console)",
      model: OBS_MODELS[0],
      tool: matchedTool.name,
      latency: res.latencyMs,
      inputTok: rnd(200,600),
      outputTok: rnd(40,180),
      toolCalls: 1,
      status: res.ok ? "success" : "error",
      ts: Date.now(),
      source: "console",
    };
    setLastConsoleSessId(newId);
    setSessions(p=>[consoleSess, ...p].slice(0,40));
    setHistory(p=>{
      const pt={t:new Date().toLocaleTimeString("en",{hour:"2-digit",minute:"2-digit"}),latency:res.latencyMs,inputTok:consoleSess.inputTok,outputTok:consoleSess.outputTok,toolCalls:1,errors:res.ok?0:1,sessions:1};
      return [...p.slice(-19),pt];
    });
  }

  const modalDomain = modal ? DOMAINS.find(d=>d.id===modal) : null;
  const authDisplayValue = token ? (token.startsWith("Bearer ") ? token : `Bearer ${token}`) : "Bearer demo-token";

  return (
    <>
      <style>{CSS}</style>

      <nav className="nav">
        <div className="nav-logo">AGENT<span>BANK</span></div>
        <div className="nav-links">
          <span className="nl" onClick={()=>switchTab("channel")}>AI Channel</span>
          <span className="nl" onClick={()=>switchTab("usecase")}>Use Case</span>
          <span className="nl" onClick={()=>switchTab("services")}>Services</span>
          <span className="nl" onClick={()=>switchTab("builds")}>Agent Builds</span>
          <span className="nl" onClick={()=>switchTab("arch")}>Architecture</span>
          <span className="nl" onClick={()=>switchTab("mcp")}>MCP Server</span>
          <span className="nl" onClick={()=>switchTab("sdk")}>SDK</span>
          <a className="nl" href="/agentbank-executive-visuals.html" target="_blank" rel="noreferrer">Exec Deck ↗</a>
          <a className="nl" href="https://github.com/watsongm/agentbank" target="_blank" rel="noreferrer">GitHub ↗</a>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="nav-btn" style={{background:"transparent",color:"var(--ink)",border:"1.5px solid var(--ink)"}} onClick={()=>{setObsInitTab("metrics");setObsInitSessId(null);setShowObs(true);}}>Observability</button>
          <button className="nav-btn" onClick={openConsole}>API Console →</button>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-grid"/>
        <div className="hero-inner">
          <div className="hero-tag"><div className="hero-dot"/>AGENTBANK · BIAN v12 · OPEN BANKING v3.1 · FAPI 2.0 · MCP 1.0</div>
          <h1>The Bank<br/>Built for<br/><em>AI Agents</em></h1>
          <p className="hero-p">agentBANK is a fully-featured reference bank combining the Open Banking v3.1 API standard with the BIAN v12 Service Domain capability model — with AI agents as a first-class, cryptographically audited customer channel.</p>
          <div className="btn-row">
            <button className="btn-dark" onClick={()=>switchTab("usecase")}>See Agent Use Case</button>
            <button className="btn-light" onClick={openConsole}>Open API Console →</button>
            <a className="btn-light" style={{textDecoration:"none",display:"inline-flex",alignItems:"center"}} href="/agentbank-executive-visuals.html" target="_blank" rel="noreferrer">Executive Briefing ↗</a>
          </div>
          <div className="hero-stats">
            {[["10","BIAN v12 Domains"],["44","OpenAPI Endpoints"],["14","MCP & SDK Tools"],["FAPI 2.0","DPoP + Hash Audit"]].map(([n,l])=>(
              <div key={l}><div className="stat-n">{n}</div><div className="stat-l">{l}</div></div>
            ))}
          </div>
        </div>
      </section>

      <div className="tab-bar" ref={tabBarRef}>
        {[{id:"channel",label:"AI Channel"},{id:"usecase",label:"Use Case"},{id:"services",label:"Services & APIs"},{id:"builds",label:"Agent Builds"},{id:"arch",label:"Architecture"},{id:"mcp",label:"MCP Server"},{id:"sdk",label:"SDK"}].map(t=>(
          <button key={t.id} className={`tab-btn ${activeTab===t.id?"on":""}`} onClick={()=>switchTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {activeTab==="channel" && <section className="sec dark" id="agent">
        <span className="sec-tag">PRIMARY CHANNEL</span>
        <h2 className="sec-h">AI Agents as<br/>First-Class Customers</h2>
        <p className="sec-p">agentBANK exposes a structured tool-use layer allowing AI agents to authenticate, reason, and transact autonomously — using the same Open Banking consent framework.</p>
        <div className="agent-grid">
          <div className="agent-feats">
            {[
              {icon:"⚡",h:"OAuth 2.0 + FAPI Agent Auth",p:"Agents authenticate via Financial-grade API profiles. Consent tokens are scoped, time-limited, and customer-authorised."},
              {icon:"🛠",h:"Structured Tool Registry",p:"14 agent-callable tool functions map directly to BIAN service domain operations. Each tool is typed, documented, and sandboxed."},
              {icon:"🔍",h:"Explainable Reasoning Trace",p:"Every agent action generates a full audit trail with tool calls, parameters, results, and reasoning in immutable ledger."},
              {icon:"🔒",h:"Consent-Scoped Operations",p:"Agents operate within granted scopes. Sensitive operations require step-up authentication with customer confirmation."},
              {icon:"🌐",h:"Webhook Event Subscriptions",p:"Agents subscribe to real-time account events via webhooks for proactive financial management and autonomous responses."},
            ].map(f=>(
              <div key={f.h} className="feat">
                <div className="feat-icon">{f.icon}</div>
                <div className="feat-h">{f.h}</div>
                <div className="feat-p">{f.p}</div>
              </div>
            ))}
          </div>
          <div className="term">
            <div className="term-bar">
              <div className="tdot" style={{background:"#ff5f57"}}/><div className="tdot" style={{background:"#ffbd2e"}}/><div className="tdot" style={{background:"#28c840"}}/>
              <span className="term-lbl">AGENTBANK-AGENT-RUNTIME v2.4</span>
              <button style={{marginLeft:"auto",fontFamily:"var(--mono)",fontSize:10,padding:"3px 9px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",color:"rgba(255,255,255,.35)",cursor:"pointer"}} onClick={()=>setTermIdx(0)}>↺ REPLAY</button>
            </div>
            <div className="term-body" ref={termRef}>
              {CONVERSATION.slice(0,termIdx).map((m,i)=>(
                <div key={i}>
                  {m.role==="agent"  && <div className="tm-agent"><span className="tm-lbl">AGENT »</span>{m.text}</div>}
                  {m.role==="call"   && <div className="tm-call"><span className="tm-tlbl">CALL »</span><span className="tm-tool">{m.tool}</span><span className="tm-params"> ({JSON.stringify(m.params).slice(0,55)}…)</span></div>}
                  {m.role==="result" && <div className="tm-res"><div className="tm-rlbl">RESULT</div><div className="tm-rval">{JSON.stringify(m.result,null,1).slice(0,180)}</div></div>}
                </div>
              ))}
              {termIdx<CONVERSATION.length && <span style={{color:"rgba(255,255,255,.3)",animation:"pulse 1s infinite"}}>▌</span>}
            </div>
          </div>
        </div>
      </section>}

      {activeTab==="usecase" && <section className="uc-sec" id="usecase">
        <span className="sec-tag">EXAMPLE AGENT</span>
        <h2 className="sec-h">Smart Savings Agent</h2>
        <p className="sec-p">A complete worked example: an AI agent that analyses spending, calculates a safe monthly savings amount, executes the transfer, and automates it on future salary credits.</p>
        <div className="uc-grid">
          <div className="uc-steps">
            {AGENT_STEPS.map((s,i)=>(
              <div key={s.id} className={`uc-step ${ucStep===i?"active":""} ${ucStep>i?"done":""}`} onClick={()=>setUcStep(i)}>
                <div className="step-spine">
                  <div className="step-circle">{ucStep>i?"✓":s.id}</div>
                  <div className="step-line-v"/>
                </div>
                <div className="step-body">
                  <div className="step-title">{s.title}</div>
                  <div className="step-dom" style={{color:s.color}}>{s.domain}</div>
                  <div className="step-desc">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="code-box">
            <div className="code-topbar">
              <div className="cdots"><div className="cdot" style={{background:"#ff5f57"}}/><div className="cdot" style={{background:"#ffbd2e"}}/><div className="cdot" style={{background:"#28c840"}}/></div>
              <span className="code-lbl" style={{color:"#8b9bb4"}}>STEP {AGENT_STEPS[ucStep].id} — {AGENT_STEPS[ucStep].title.toUpperCase()}</span>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span className="code-badge" style={{borderColor:AGENT_STEPS[ucStep].color,color:AGENT_STEPS[ucStep].color}}>{AGENT_STEPS[ucStep].icon} {AGENT_STEPS[ucStep].domain}</span>
                <button
                  type="button"
                  onClick={() => openConsoleForUcStep(ucStep)}
                  style={{
                    fontFamily:"var(--mono)",
                    fontSize:10,
                    padding:"4px 10px",
                    background:"rgba(201,168,76,0.14)",
                    border:"1px solid var(--gold)",
                    color:"var(--gold)",
                    cursor:"pointer",
                  }}
                >
                  Run Step in API Console →
                </button>
              </div>
            </div>
            <div className="code-scroll"><pre>{AGENT_STEPS[ucStep].code}</pre></div>
          </div>
        </div>
      </section>}

      {activeTab==="services" && <>
        <section id="services" style={{padding:"96px 40px 0"}}>
          <span className="sec-tag">BIAN SERVICE DOMAINS</span>
          <h2 className="sec-h">Complete Banking<br/>Capability Model</h2>
          <p className="sec-p">Each domain implements both Open Banking v3.1 and the corresponding BIAN service domain interface. Click any card to explore endpoints and agent capabilities.</p>
        </section>
        <div style={{padding:"0 40px 96px"}}>
          <div className="svc-grid">
            {DOMAINS.map(d=>(
              <div key={d.id} className="svc-card" style={{"--c":d.color}} onClick={()=>{setModal(d.id);setModalTab("ep");}}>
                <div className="svc-icon" style={{color:d.color}}>{d.icon}</div>
                <div className="svc-name">{d.name}</div>
                <div className="svc-bian">{d.bian}</div>
                <div className="svc-desc">{d.desc}</div>
                <div className="svc-meta"><span><span>{d.endpoints.length}</span> endpoints</span><span><span>{d.caps.length}</span> agent tools</span></div>
              </div>
            ))}
          </div>
        </div>
        <section className="tools-sec" id="tools">
          <span className="sec-tag">AGENT TOOL REGISTRY</span>
          <h2 className="sec-h">14 Agent-Callable<br/>Tool Functions</h2>
          <p className="sec-p">Every tool is typed, scoped to a BIAN service domain, and callable by AI agents with the appropriate consent token.</p>
          <div className="tools-grid">
            {TOOLS.map(t=>{
              const dom=DOMAINS.find(d=>d.id===t.domain);
              return (
                <div key={t.name} className="tool-card" style={{display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
                  <div>
                    <div className="tool-name" style={{color:dom?.color}}>{t.name}()</div>
                    <div className="tool-dom">{t.domain.replace(/-/g," ")} · {dom?.bian}</div>
                    <div className="tool-desc">{t.desc}</div>
                    <div className="tool-params">{t.params.map(p=><span key={p} className="tool-p">{p}</span>)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openConsoleForTool(t.name)}
                    style={{
                      marginTop: 12,
                      alignSelf: "flex-start",
                      fontFamily: "var(--mono)",
                      fontSize: 10,
                      padding: "4px 9px",
                      background: "var(--cream)",
                      border: "1px solid var(--line)",
                      color: "var(--ink)",
                      cursor: "pointer",
                    }}
                  >
                    Try Tool in Console →
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </>}

      {activeTab==="builds" && (()=>{
        const build = AGENT_BUILDS.find(b=>b.id===selBuild);
        return (
          <section className="sec" id="builds">
            <span className="sec-tag">EXAMPLE BUILDS</span>
            <h2 className="sec-h">Agent Build Recipes</h2>
            <p className="sec-p">Ready-to-adapt code snippets for common banking agent patterns. Each build wires together agentBANK tool functions into a complete, runnable agent.</p>
            <div className="builds-grid">
              {AGENT_BUILDS.map(b=>(
                <div key={b.id} className={`build-card ${selBuild===b.id?"active":""}`} onClick={()=>setSelBuild(b.id)}>
                  <div className="build-card-icon" style={{color:b.color}}>{b.icon}</div>
                  <div className="build-card-name">{b.name}</div>
                  <div className="build-card-desc">{b.desc}</div>
                  <div className="build-tags">{b.tags.map(t=><span key={t} className="build-tag">{t}</span>)}</div>
                </div>
              ))}
            </div>
            {build && (
              <div className="build-viewer">
                <div className="build-viewer-bar">
                  <span className="build-viewer-title">{build.icon} {build.name.toUpperCase()}</span>
                  <span className="build-viewer-badge" style={{borderColor:build.color,color:build.color}}>{build.tags[0]}</span>
                </div>
                <div className="build-viewer-code"><pre>{build.code}</pre></div>
              </div>
            )}
          </section>
        );
      })()}

      {activeTab==="arch" && <section className="dark arch-full" id="arch">
        <span className="sec-tag">REFERENCE ARCHITECTURE</span>
        <h2 className="sec-h" style={{marginBottom:14}}>agentBANK Architecture</h2>
        <p style={{fontSize:16,color:"rgba(255,255,255,.4)",lineHeight:1.7,maxWidth:640,marginBottom:64}}>A complete view of how AI agents, Open Banking, BIAN service domains, and the MCP server interact — from client to ledger.</p>
        <div className="arch-section-hdr">Full Stack Overview</div>
        <div className="arch-stack">
          {[
            {l:"AI CLIENTS",   chips:[{t:"Claude Desktop",c:"hi"},{t:"Custom Agent (SDK)",c:"hi"},{t:"MCP Client",c:"hi"},{t:"Mobile / Web App",c:""}]},
            null,
            {l:"MCP LAYER",    chips:[{t:"MCP Server (stdio)",c:"hi"},{t:"14 Typed Tools",c:"hi"},{t:"Zod Schema Validation",c:""},{t:"Tool Registry",c:""}]},
            null,
            {l:"API GATEWAY",  chips:[{t:"OAuth 2.0 / FAPI 2.0",c:"green"},{t:"Consent Manager",c:"green"},{t:"Rate Limiting",c:""},{t:"Immutable Audit Log",c:""}]},
            null,
            {l:"OPEN BANKING", chips:[{t:"Accounts v3.1",c:"blue"},{t:"Payments v3.1",c:"blue"},{t:"Confirmation of Funds",c:"blue"},{t:"Event Notifications",c:"blue"}]},
            null,
            {l:"BIAN DOMAINS", chips:[{t:"SD-CurrentAccount",c:"purple"},{t:"SD-PaymentExecution",c:"purple"},{t:"SD-ConsumerLoan",c:"purple"},{t:"SD-InvestmentPortfolio",c:"purple"},{t:"+6 domains",c:""}]},
            null,
            {l:"CORE BANKING", chips:[{t:"Ledger Engine",c:""},{t:"Product Engine",c:""},{t:"Customer MDM",c:""},{t:"Risk Engine",c:""}]},
            null,
            {l:"INFRA",        chips:[{t:"Event Bus",c:""},{t:"Key Management",c:""},{t:"Immutable Audit",c:""},{t:"Data Warehouse",c:""}]},
          ].map((row,i)=>
            row===null
              ? <div key={i} className="arch-connect"><div className="arch-connect-line"/></div>
              : <div key={row.l} className="arch-row"><div className="arch-lbl">{row.l}</div><div className="arch-band"><div className="arch-comps">{row.chips.map(ch=><span key={ch.t} className={`arch-chip ${ch.c}`}>{ch.t}</span>)}</div></div></div>
          )}
        </div>
        <div className="arch-section-hdr">BIAN Service Domain Capability Map</div>
        <div className="arch-domains">
          {DOMAINS.map(d=>(
            <div key={d.id} className="arch-domain">
              <div className="arch-domain-top"><span className="arch-domain-icon" style={{color:d.color}}>{d.icon}</span><div><div className="arch-domain-name">{d.name}</div><div className="arch-domain-bian">{d.bian}</div></div></div>
              <div className="arch-domain-divider"/>
              <div className="arch-domain-caps">{d.caps.map(c=><div key={c} className="arch-domain-cap">{c}</div>)}</div>
              <div style={{marginTop:10,display:"flex",gap:6,flexWrap:"wrap"}}>
                <span style={{fontFamily:"var(--mono)",fontSize:9,padding:"2px 6px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",color:"rgba(255,255,255,.3)"}}>{d.endpoints.length} endpoints</span>
                <span style={{fontFamily:"var(--mono)",fontSize:9,padding:"2px 6px",background:"rgba(201,168,76,.08)",border:"1px solid rgba(201,168,76,.2)",color:"rgba(201,168,76,.7)"}}>{d.caps.length} agent tools</span>
              </div>
            </div>
          ))}
        </div>
        <div className="arch-section-hdr">Standards Compliance</div>
        <div className="arch-standards">
          {[
            {name:"Open Banking (OBIE)",       ver:"v3.1.11",  desc:"UK Open Banking standard covering Accounts, Payments, CoF, and Event Notification resource types."},
            {name:"BIAN Service Domain Model", ver:"v12",      desc:"10 BIAN service domains providing a structured banking capability model mapped to every API endpoint."},
            {name:"Model Context Protocol",    ver:"MCP 1.0",  desc:"Stdio-transport MCP server exposing all 14 agentBANK tools to Claude Desktop, Cursor, and any MCP host."},
            {name:"Financial-grade API",       ver:"FAPI 2.0", desc:"Security profile for agent authentication: PAR, DPoP, consent scopes, and step-up auth for high-value operations."},
            {name:"ISO 20022",                 ver:"2019",     desc:"Payment message format for domestic and international payment instruction payloads."},
            {name:"OAuth 2.0 / OIDC",          ver:"RFC 6749", desc:"Authorisation framework and identity layer underpinning the FAPI consent and token flows."},
          ].map(s=>(
            <div key={s.name} className="arch-std"><div className="arch-std-name">{s.name}</div><div className="arch-std-ver">{s.ver}</div><div className="arch-std-desc">{s.desc}</div></div>
          ))}
        </div>
      </section>}

      {activeTab==="mcp" && <McpTab tools={TOOLS} domains={DOMAINS} onTryTool={openConsoleForTool}/>}
      {activeTab==="sdk" && <SdkTab onTryTool={openConsoleForTool}/>}

      <footer>
        <div><div className="footer-logo">AGENT<span>BANK</span></div><div className="footer-tag">BIAN v12 · Open Banking v3.1 · AI-Native Reference Implementation</div></div>
        <div>
          <div className="footer-col-hdr">API Standards</div>
          <div className="footer-links">
            <a className="fl" href="https://standards.openbanking.org.uk/api-specifications/" target="_blank" rel="noreferrer">Open Banking v3.1 ↗</a>
            <a className="fl" href="https://bian.org/servicelandscape/" target="_blank" rel="noreferrer">BIAN v12 ↗</a>
            <a className="fl" href="https://openid.net/specs/fapi-2_0-baseline.html" target="_blank" rel="noreferrer">FAPI 2.0 ↗</a>
            <a className="fl" href="https://www.iso20022.org/" target="_blank" rel="noreferrer">ISO 20022 ↗</a>
          </div>
        </div>
        <div>
          <div className="footer-col-hdr">Service Domains</div>
          <div className="footer-links">
            <span className="fl" onClick={()=>switchTab("services")}>Current Account</span>
            <span className="fl" onClick={()=>switchTab("services")}>Payments</span>
            <span className="fl" onClick={()=>switchTab("services")}>Consumer Lending</span>
            <span className="fl" onClick={()=>switchTab("services")}>Investments</span>
          </div>
        </div>
        <div>
          <div className="footer-col-hdr">Developer</div>
          <div className="footer-links">
            <span className="fl" onClick={openConsole}>API Console</span>
            <span className="fl" onClick={()=>setShowObs(true)}>Observability</span>
            <span className="fl" onClick={()=>switchTab("sdk")}>Agent SDK</span>
            <a className="fl" href="https://github.com/watsongm/agentbank/blob/main/openapi.yaml" target="_blank" rel="noreferrer">OpenAPI Spec ↗</a>
          </div>
        </div>
        <div>
          <div className="footer-col-hdr">Project</div>
          <div className="footer-links">
            <a className="fl" href="https://github.com/watsongm/agentbank" target="_blank" rel="noreferrer">GitHub ↗</a>
            <a className="fl" href="/agentbank-executive-visuals.html" target="_blank" rel="noreferrer">Exec Deck ↗</a>
            <span className="fl" onClick={()=>switchTab("mcp")}>MCP Server</span>
            <span className="fl" onClick={()=>switchTab("arch")}>Architecture</span>
          </div>
        </div>
      </footer>
      <div className="footer-bar">
        <span>© 2026 agentBANK Reference Implementation. Not a real bank.</span>
        <span>Open Banking API v3.1 + BIAN Service Domain Model v12</span>
      </div>

      {/* DOMAIN MODAL */}
      {modalDomain && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label={modalDomain.name} onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal">
            <div className="modal-hdr">
              <div><div className="modal-title" style={{color:modalDomain.color}}>{modalDomain.icon} {modalDomain.name}</div><div className="modal-bian">{modalDomain.bian}</div></div>
              <button className="modal-x" onClick={()=>setModal(null)} aria-label="Close modal">✕</button>
            </div>
            <div className="modal-body">
              <p style={{fontSize:14,color:"var(--mid)",lineHeight:1.7,marginBottom:22}}>{modalDomain.desc}</p>
              <div className="modal-tabs" role="tablist">
                <button role="tab" aria-selected={modalTab==="ep"} className={`mtab ${modalTab==="ep"?"on":""}`} onClick={()=>setModalTab("ep")}>Endpoints ({modalDomain.endpoints.length})</button>
                <button role="tab" aria-selected={modalTab==="caps"} className={`mtab ${modalTab==="caps"?"on":""}`} onClick={()=>setModalTab("caps")}>Agent Capabilities ({modalDomain.caps.length})</button>
              </div>
              {modalTab==="ep" && (
                <div className="ep-list">
                  {modalDomain.endpoints.map((ep,i)=>(
                    <div key={i} className="ep-row" style={{alignItems:"center",justifyContent:"space-between"}}>
                      <div style={{display:"flex",alignItems:"flex-start",gap:11}}>
                        <span className={`ep-badge badge-${ep.m}`}>{ep.m}</span>
                        <div>
                          <div className="ep-path">{ep.p}</div>
                          <div className="ep-desc">{ep.d}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openConsoleAt(modalDomain.id, i)}
                        style={{
                          fontFamily:"var(--mono)",
                          fontSize:10.5,
                          padding:"6px 11px",
                          background:"var(--ink)",
                          color:"var(--bg)",
                          border:"none",
                          cursor:"pointer",
                          flexShrink:0,
                        }}
                      >
                        Test in Console →
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {modalTab==="caps" && <div><div className="cap-list">{modalDomain.caps.map((c,i)=><div key={i} className="cap-row"><div className="cap-tick">✓</div><span className="cap-text">{c}</span></div>)}</div><div className="scope-box"><div className="scope-lbl">REQUIRED CONSENT SCOPE</div><code style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--ink)"}}>{modalDomain.id}:read {modalDomain.id}:write</code></div></div>}
            </div>
          </div>
        </div>
      )}

      {/* API CONSOLE */}
      {showConsole && (
        <div className="console-wrap" role="dialog" aria-modal="true" aria-label="Interactive API Console">
          <div className="console-top">
            <div style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:4}}>
              <div className="console-logo">AGENT<span>BANK</span></div>
              <span className="console-sub">Interactive API Console</span>
              <div className="mode-toggle" role="group" aria-label="API execution mode">
                <button
                  type="button"
                  className={`mode-btn ${apiMode === "mock" ? "on-mock" : ""}`}
                  onClick={() => toggleMode("mock")}
                >
                  MOCK
                </button>
                <button
                  type="button"
                  className={`mode-btn ${apiMode === "live" ? "on-live" : ""}`}
                  onClick={() => toggleMode("live")}
                >
                  LIVE BACKEND
                </button>
              </div>
            </div>
            <button className="console-x" onClick={()=>setShowConsole(false)}>✕ CLOSE</button>
          </div>
          <div className="console-inner">
            <div className="console-sidebar">
              <div className="csb-lbl">Domains</div>
              {DOMAINS.map(d=>(
                <div key={d.id} className={`csb-item ${cDomain===d.id?"on":""}`} onClick={()=>pickDomain(d.id)}>
                  <span className="csb-icon" style={{color:d.color}}>{d.icon}</span>
                  <span className="csb-name">{d.name}</span>
                </div>
              ))}
            </div>
            <div className="console-main">
              <div className="ep-bar">
                {cDom?.endpoints.map((ep,i)=>(
                  <button
                    key={i}
                    className={`ep-btn ${cEpIdx===i?"on":""}`}
                    onClick={()=>pickEp(i)}
                    title={`${ep.m} ${ep.p} — ${ep.d}`}
                  >
                    <span className={`em em-${ep.m}`}>{ep.m}</span>
                    <span style={{maxWidth:220,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ep.p.replace(/^\/open-banking\/v3\.1\/|^\/bian\//, "/")}</span>
                  </button>
                ))}
              </div>
              <div className="workspace">
                <div className="req-pane">
                  <div className="pane-hdr">
                    <span>REQUEST ({apiMode.toUpperCase()}) · <span style={{color:"var(--gold)"}}>{cDom?.bian}</span></span>
                    <button
                      type="button"
                      onClick={() => {
                        const curlCmd = `curl -X ${cEp?.m || "GET"} "http://localhost:3000${cPath}" \\\n  -H "Authorization: ${authDisplayValue}" \\\n  -H "x-fapi-interaction-id: ${cFapiId}" \\\n  -H "Content-Type: application/json"${cEp?.m !== "GET" && cBody.trim() ? ` \\\n  -d '${cBody.replace(/\n\s*/g, " ")}'` : ""}`;
                        copyToClipboard("curl", curlCmd);
                      }}
                      style={{
                        fontFamily:"var(--mono)",
                        fontSize:9.5,
                        padding:"3px 8px",
                        background:"rgba(255,255,255,.06)",
                        border:"1px solid rgba(255,255,255,.15)",
                        color:cCopied==="curl"?"var(--green)":"#cbd5e1",
                        cursor:"pointer",
                      }}
                    >
                      {cCopied==="curl" ? "✓ cURL Copied" : "Copy cURL"}
                    </button>
                  </div>
                  <div className="url-row">
                    <div className={`url-method um-${cEp?.m}`}>{cEp?.m}</div>
                    <input className="url-path" value={cPath} onChange={e=>setCPath(e.target.value)} aria-label="Request URL path"/>
                    <button className="send" onClick={sendReq} disabled={cLoading}>{cLoading?"...":"SEND →"}</button>
                  </div>
                  <div
                    style={{
                      display:"flex",
                      alignItems:"center",
                      gap:6,
                      padding:"6px 13px",
                      background:"#080d14",
                      borderBottom:"1px solid #18222e",
                      flexWrap:"wrap",
                    }}
                  >
                    <span style={{fontFamily:"var(--mono)",fontSize:9,color:"#8b9bb4",letterSpacing:1}}>SEED IDs:</span>
                    {[
                      ["PAR-ARIA", "Aria Party"],
                      ["ACC-1829", "Aria Current"],
                      ["ACC-2041", "Aria Savings"],
                      ["LOAN-48291", "Mahliqa Loan"],
                      ["CRD-88421", "Aria Card"],
                      ["PRT-29183", "Aria Portfolio"],
                      ["CASE-9001", "AML Case"],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        title={`Click to copy ${id} (${label})`}
                        onClick={() => copyToClipboard(id, id)}
                        style={{
                          fontFamily:"var(--mono)",
                          fontSize:9.5,
                          padding:"2px 6px",
                          background:cCopied===id ? "rgba(0,230,118,.15)" : "rgba(255,255,255,.04)",
                          border:"1px solid",
                          borderColor:cCopied===id ? "var(--green)" : "rgba(255,255,255,.12)",
                          color:cCopied===id ? "var(--green)" : "#cbd5e1",
                          cursor:"pointer",
                        }}
                      >
                        {cCopied===id ? "✓ Copied" : id}
                      </button>
                    ))}
                  </div>
                  <div className="req-fields">
                    <div className="field-section">
                      <div className="field-sec-hdr">HEADERS</div>
                      <div className="field">
                        <span className="field-lbl">Authorization</span>
                        <input
                          className="field-inp"
                          value={authDisplayValue}
                          onChange={e => setToken(e.target.value.replace(/^Bearer\s+/i, ""))}
                          aria-label="Authorization header"
                        />
                      </div>
                      <div className="field"><span className="field-lbl">x-fapi-interaction-id</span><input className="field-inp" value={cFapiId} readOnly aria-label="FAPI Interaction ID"/></div>
                      <div className="field"><span className="field-lbl">Content-Type</span><input className="field-inp" value="application/json" readOnly aria-label="Content-Type"/></div>
                    </div>
                    {cEp?.m!=="GET" && <div className="field-section"><div className="field-sec-hdr">REQUEST BODY</div><div style={{padding:"8px 14px"}}><textarea className="field-ta" rows={8} value={cBody} onChange={e=>setCBody(e.target.value)} aria-label="Request JSON body"/></div></div>}
                    <div className="field-section"><div className="field-sec-hdr">ENDPOINT INFO</div><div style={{padding:"10px 14px"}}><div style={{fontSize:12,color:"#cbd5e1",lineHeight:1.7}}>{cEp?.d}</div><div style={{marginTop:7,fontFamily:"monospace",fontSize:10.5,color:"#8b9bb4"}}>TEMPLATE: <span style={{color:"#4fc3f7"}}>{cEp?.p}</span> · SCOPE: <span style={{color:"var(--gold)"}}>{cDomain}:read{cEp?.m!=="GET"?" "+cDomain+":write":""}</span></div></div></div>
                  </div>
                </div>
                <div className="res-pane">
                  <div className="pane-hdr">
                    <span>RESPONSE</span>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      {cResp && <span style={{color:"#8b9bb4"}}>{cTime}ms</span>}
                      {cResp && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard("json", JSON.stringify(cResp, null, 2))}
                          style={{
                            fontFamily:"var(--mono)",
                            fontSize:9.5,
                            padding:"3px 8px",
                            background:"rgba(255,255,255,.06)",
                            border:"1px solid rgba(255,255,255,.15)",
                            color:cCopied==="json"?"var(--green)":"#cbd5e1",
                            cursor:"pointer",
                          }}
                        >
                          {cCopied==="json" ? "✓ JSON Copied" : "Copy JSON"}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="res-body">
                    {!cResp&&!cLoading&&<div className="res-empty"><div className="res-empty-icon">◎</div><div className="res-empty-text">HIT SEND TO EXECUTE</div></div>}
                    {cLoading&&<div className="res-loading"><div className="spinner"/>AWAITING RESPONSE...</div>}
                    {cResp&&!cLoading&&(
                      <>
                        <div className="res-meta">
                          <div className={`res-status ${cOk?"":"err"}`}>{cStatus}</div>
                          <div className="res-time">{cTime}ms · application/json</div>
                          <button
                            type="button"
                            onClick={() => {
                              setShowConsole(false);
                              setObsInitTab("trace");
                              setObsInitSessId(lastConsoleSessId);
                              setShowObs(true);
                            }}
                            style={{
                              marginLeft:"auto",
                              fontFamily:"var(--mono)",
                              fontSize:10,
                              padding:"4px 10px",
                              background:"rgba(79,195,247,.12)",
                              border:"1px solid rgba(79,195,247,.4)",
                              color:"var(--blue)",
                              cursor:"pointer",
                            }}
                          >
                            Inspect Trace in Observability →
                          </button>
                        </div>
                        <pre className="res-json">{JSON.stringify(cResp,null,2)}</pre>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OBSERVABILITY */}
      {showObs && (
        <ObservabilityOverlay
          sessions={sessions}
          setSessions={setSessions}
          history={history}
          obsPaused={obsPaused}
          setObsPaused={setObsPaused}
          apiMode={apiMode}
          token={token}
          initialTab={obsInitTab}
          initialSessionId={obsInitSessId}
          onClose={() => setShowObs(false)}
        />
      )}
    </>
  );
}
