import { useState, useEffect, useRef } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";

import { DOMAINS } from "./data/domains.js";
import { TOOLS } from "./data/tools.js";
import { AGENT_BUILDS } from "./data/agentBuilds.js";
import { AGENT_STEPS } from "./data/agentSteps.js";
import { CONVERSATION } from "./data/conversation.js";
import { mockApi, defaultBody } from "./mock/api.js";
import { OBS_TOOLS, OBS_MODELS, rnd, makeSession, makeHistory, makeSpans, makeTraceSteps } from "./mock/sessions.js";
import McpTab from "./components/McpTab.jsx";
import SdkTab from "./components/SdkTab.jsx";

/* ══════════════════════════════════════════════════════
   STYLES
══════════════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Fira+Code:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
:root{
  --bg:#f8f7f4; --ink:#0d0f14; --mid:#6b7280; --line:#e2e0da; --cream:#f0ede6;
  --gold:#c9a84c; --mono:'Fira Code',monospace; --sans:'IBM Plex Sans',sans-serif; --display:'Syne',sans-serif;
  --dbg:#07090d; --dsurf:#0c1018; --dcard:#101620; --dborder:#18222e;
  --blue:#4fc3f7; --green:#00e676; --purple:#ce93d8; --red:#ff5252; --orange:#ffb74d;
}
html{scroll-behavior:smooth;}
body{background:var(--bg);color:var(--ink);font-family:var(--sans);overflow-x:hidden;}
.nav{position:fixed;top:0;left:0;right:0;z-index:300;display:flex;align-items:center;justify-content:space-between;padding:0 40px;height:60px;background:rgba(248,247,244,.95);backdrop-filter:blur(12px);border-bottom:1px solid var(--line);}
.nav-logo{font-family:var(--display);font-size:20px;color:var(--ink);letter-spacing:-.5px;}
.nav-logo span{color:var(--gold);}
.nav-links{display:flex;gap:28px;}
.nl{font-size:13px;font-weight:500;color:var(--mid);cursor:pointer;text-decoration:none;transition:color .2s;}
.nl:hover{color:var(--ink);}
.nav-btn{background:var(--ink);color:var(--bg);padding:8px 18px;font-size:13px;font-weight:600;border:none;cursor:pointer;transition:background .2s;}
.nav-btn:hover{background:#2d3548;}
.hero{min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:120px 40px 80px;position:relative;overflow:hidden;}
.hero-grid{position:absolute;inset:0;background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:48px 48px;opacity:.5;}
.hero-inner{position:relative;max-width:900px;}
.hero-tag{display:inline-flex;align-items:center;gap:8px;background:var(--ink);color:var(--bg);font-family:var(--mono);font-size:11px;letter-spacing:1px;padding:5px 12px;margin-bottom:32px;}
.hero-dot{width:6px;height:6px;border-radius:50%;background:var(--gold);animation:pulse 2s infinite;}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
h1{font-size:clamp(44px,8vw,96px);font-weight:800;line-height:.95;letter-spacing:-3px;margin-bottom:32px;}
h1 em{font-style:normal;color:var(--gold);}
.hero-p{font-size:18px;color:var(--mid);line-height:1.65;max-width:580px;margin-bottom:48px;}
.btn-row{display:flex;gap:16px;flex-wrap:wrap;}
.btn-dark{background:var(--ink);color:var(--bg);padding:13px 26px;font-size:14px;font-weight:600;border:2px solid var(--ink);cursor:pointer;transition:all .2s;}
.btn-dark:hover{background:transparent;color:var(--ink);}
.btn-light{background:transparent;color:var(--ink);padding:13px 26px;font-size:14px;font-weight:600;border:2px solid var(--ink);cursor:pointer;transition:all .2s;}
.btn-light:hover{background:var(--ink);color:var(--bg);}
.hero-stats{display:flex;gap:44px;margin-top:80px;padding-top:40px;border-top:1px solid var(--line);flex-wrap:wrap;}
.stat-n{font-size:34px;font-weight:800;letter-spacing:-1px;}.stat-n span{color:var(--gold);}
.stat-l{font-size:11px;font-weight:500;color:var(--mid);margin-top:4px;letter-spacing:1px;text-transform:uppercase;}
.sec{padding:96px 40px;}
.sec-tag{font-family:var(--mono);font-size:11px;letter-spacing:2px;color:var(--gold);text-transform:uppercase;margin-bottom:16px;display:block;}
.sec-h{font-size:clamp(30px,4vw,50px);font-weight:800;letter-spacing:-1.5px;line-height:1.05;margin-bottom:20px;}
.sec-p{font-size:16px;color:var(--mid);line-height:1.7;max-width:580px;margin-bottom:56px;}
.dark{background:var(--ink);color:var(--bg);}
.dark .sec-tag{color:var(--gold);}
.dark .sec-h{color:var(--bg);}
.dark .sec-p{color:rgba(255,255,255,.45);}
.agent-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:start;}
.agent-feats{display:flex;flex-direction:column;gap:20px;}
.feat{padding:22px;border:1px solid rgba(255,255,255,.1);transition:border-color .2s;}
.feat:hover{border-color:var(--gold);}
.feat-icon{font-size:19px;margin-bottom:10px;}
.feat-h{font-size:15px;font-weight:700;margin-bottom:7px;color:var(--bg);}
.feat-p{font-size:13px;color:rgba(255,255,255,.45);line-height:1.6;}
.term{background:#0a0c10;border:1px solid rgba(255,255,255,.1);}
.term-bar{display:flex;align-items:center;gap:7px;padding:11px 15px;border-bottom:1px solid rgba(255,255,255,.07);}
.tdot{width:10px;height:10px;border-radius:50%;}
.term-lbl{font-family:var(--mono);font-size:10px;color:rgba(255,255,255,.25);margin-left:6px;letter-spacing:1px;}
.term-body{padding:18px;max-height:460px;overflow-y:auto;font-family:var(--mono);font-size:11px;line-height:1.75;}
.tm-agent{color:#64b5f6;margin-bottom:7px;}
.tm-lbl{color:rgba(100,181,246,.5);margin-right:6px;}
.tm-call{margin-bottom:3px;}
.tm-tool{color:var(--gold);}
.tm-tlbl{color:rgba(201,168,76,.45);margin-right:4px;}
.tm-params{color:rgba(255,255,255,.25);font-size:10px;}
.tm-res{margin:3px 0 9px 14px;padding:9px 11px;background:rgba(255,255,255,.03);border-left:2px solid rgba(255,255,255,.09);}
.tm-rlbl{color:rgba(255,255,255,.25);font-size:10px;margin-bottom:3px;}
.tm-rval{color:#a5d6a7;font-size:10.5px;}
.svc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1px;background:var(--line);border:1px solid var(--line);}
.svc-card{background:var(--bg);padding:28px;cursor:pointer;transition:background .2s;position:relative;overflow:hidden;}
.svc-card:hover{background:var(--cream);}
.svc-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--c,#888);opacity:0;transition:opacity .2s;}
.svc-card:hover::before{opacity:1;}
.svc-icon{font-size:22px;margin-bottom:14px;}
.svc-name{font-size:17px;font-weight:700;margin-bottom:4px;}
.svc-bian{font-family:var(--mono);font-size:10px;color:var(--mid);margin-bottom:10px;}
.svc-desc{font-size:13px;color:var(--mid);line-height:1.6;margin-bottom:12px;}
.svc-meta{font-family:var(--mono);font-size:11px;display:flex;gap:14px;color:var(--mid);}
.svc-meta span{color:var(--ink);font-weight:600;}
.tools-sec{padding:96px 40px;background:var(--cream);}
.tools-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(255px,1fr));gap:13px;}
.tool-card{padding:17px;background:var(--bg);border:1px solid var(--line);}
.tool-name{font-family:var(--mono);font-size:13px;font-weight:500;margin-bottom:4px;}
.tool-dom{font-family:var(--mono);font-size:10px;letter-spacing:1px;color:var(--mid);margin-bottom:8px;text-transform:uppercase;}
.tool-desc{font-size:12px;color:var(--mid);line-height:1.5;margin-bottom:8px;}
.tool-params{display:flex;flex-wrap:wrap;gap:4px;}
.tool-p{font-family:var(--mono);font-size:10px;padding:2px 6px;background:var(--cream);color:var(--mid);border:1px solid var(--line);}
.uc-sec{padding:96px 40px;background:var(--cream);}
.uc-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:start;}
.uc-steps{display:flex;flex-direction:column;}
.uc-step{display:flex;cursor:pointer;}
.step-spine{display:flex;flex-direction:column;align-items:center;width:44px;flex-shrink:0;}
.step-circle{width:30px;height:30px;border-radius:50%;border:2px solid var(--line);display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:11px;font-weight:600;background:var(--bg);color:var(--mid);transition:all .2s;z-index:1;}
.uc-step.active .step-circle{background:var(--ink);color:var(--bg);border-color:var(--ink);}
.uc-step.done .step-circle{background:var(--gold);color:#000;border-color:var(--gold);}
.step-line-v{width:2px;flex:1;background:var(--line);min-height:14px;}
.uc-step:last-child .step-line-v{display:none;}
.step-body{padding:0 0 22px 14px;flex:1;}
.step-title{font-size:14px;font-weight:700;margin-bottom:3px;}
.step-dom{font-family:var(--mono);font-size:10px;letter-spacing:1px;margin-bottom:5px;text-transform:uppercase;}
.step-desc{font-size:12px;color:var(--mid);line-height:1.55;max-height:0;overflow:hidden;transition:max-height .3s ease;}
.uc-step.active .step-desc{max-height:120px;}
.code-box{background:#0a0c10;border:1px solid rgba(255,255,255,.1);position:sticky;top:76px;}
.code-topbar{display:flex;align-items:center;justify-content:space-between;padding:11px 15px;border-bottom:1px solid rgba(255,255,255,.08);}
.cdots{display:flex;gap:6px;}
.cdot{width:10px;height:10px;border-radius:50%;}
.code-lbl{font-family:var(--mono);font-size:10px;color:rgba(255,255,255,.25);letter-spacing:1px;}
.code-badge{font-family:var(--mono);font-size:10px;padding:2px 8px;border:1px solid;border-radius:10px;}
.code-scroll{padding:18px;overflow:auto;max-height:460px;}
.code-scroll pre{font-family:var(--mono);font-size:11.5px;line-height:1.75;color:#a5d6a7;white-space:pre;}
.arch-full{padding:80px 40px 96px;}
.arch-section-hdr{font-family:var(--mono);font-size:9px;letter-spacing:2px;color:var(--gold);text-transform:uppercase;margin-bottom:18px;padding-bottom:10px;border-bottom:1px solid rgba(201,168,76,.2);}
.arch-stack{display:flex;flex-direction:column;gap:2px;margin-bottom:64px;}
.arch-row{display:grid;grid-template-columns:150px 1fr;align-items:stretch;}
.arch-lbl{font-family:var(--mono);font-size:9px;letter-spacing:1px;color:rgba(255,255,255,.28);flex-shrink:0;text-transform:uppercase;display:flex;align-items:center;padding-right:18px;border-right:1px solid rgba(255,255,255,.05);margin-right:0;}
.arch-band{flex:1;padding:12px 18px;border:1px solid rgba(255,255,255,.06);margin-left:18px;}
.arch-comps{display:flex;gap:6px;flex-wrap:wrap;}
.arch-chip{font-family:var(--mono);font-size:10px;padding:4px 9px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);color:rgba(255,255,255,.55);}
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
.arch-chan-title{font-size:13px;font-weight:700;color:rgba(255,255,255,.85);}
.arch-chan-sub{font-family:var(--mono);font-size:9px;letter-spacing:1px;color:rgba(255,255,255,.25);margin-top:1px;}
.arch-chan-body{padding:14px 16px;flex:1;display:flex;flex-direction:column;gap:10px;}
.arch-flow-step{display:flex;align-items:flex-start;gap:10px;}
.arch-flow-dot{width:20px;height:20px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:9px;font-weight:700;margin-top:1px;}
.arch-flow-text{font-size:12px;color:rgba(255,255,255,.5);line-height:1.55;}
.arch-flow-text strong{color:rgba(255,255,255,.8);font-weight:600;}
.arch-flow-arrow{font-family:var(--mono);font-size:10px;color:rgba(255,255,255,.18);padding-left:30px;}
.arch-domains{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px;margin-bottom:64px;}
.arch-domain{padding:16px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.015);}
.arch-domain-top{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
.arch-domain-icon{font-size:18px;}
.arch-domain-name{font-size:13px;font-weight:700;color:rgba(255,255,255,.8);}
.arch-domain-bian{font-family:var(--mono);font-size:9px;color:rgba(255,255,255,.22);letter-spacing:.5px;}
.arch-domain-divider{height:1px;background:rgba(255,255,255,.05);margin-bottom:10px;}
.arch-domain-caps{display:flex;flex-direction:column;gap:4px;}
.arch-domain-cap{font-size:11px;color:rgba(255,255,255,.38);display:flex;align-items:flex-start;gap:6px;}
.arch-domain-cap::before{content:'→';color:rgba(255,255,255,.15);flex-shrink:0;font-family:var(--mono);font-size:10px;}
.arch-ob{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-bottom:64px;}
.arch-ob-card{padding:16px;border:1px solid rgba(79,195,247,.15);background:rgba(79,195,247,.03);}
.arch-ob-name{font-size:13px;font-weight:700;color:#4fc3f7;margin-bottom:10px;}
.arch-ob-ep{font-family:var(--mono);font-size:10px;color:rgba(255,255,255,.3);padding:3px 0;border-bottom:1px solid rgba(255,255,255,.04);display:flex;justify-content:space-between;align-items:center;}
.arch-ob-ep:last-child{border-bottom:none;}
.arch-ob-badge{font-size:9px;font-weight:700;padding:1px 4px;border-radius:1px;}
.ob-GET{background:#1a3d1a;color:#4caf50;}.ob-POST{background:#1a2a4a;color:#64b5f6;}.ob-PUT{background:#3d2a0a;color:#ffb74d;}
.arch-standards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;}
.arch-std{padding:16px;border:1px solid rgba(255,255,255,.06);}
.arch-std-name{font-size:13px;font-weight:700;color:rgba(255,255,255,.8);margin-bottom:3px;}
.arch-std-ver{font-family:var(--mono);font-size:10px;color:var(--gold);margin-bottom:8px;}
.arch-std-desc{font-size:12px;color:rgba(255,255,255,.35);line-height:1.55;}
@media(max-width:900px){.arch-channels{grid-template-columns:1fr;}.arch-full{padding:56px 20px 72px;}}
@media(max-width:768px){.arch-row{grid-template-columns:90px 1fr;}.arch-lbl{font-size:8px;}}
.overlay{position:fixed;inset:0;background:rgba(13,15,20,.87);z-index:500;display:flex;align-items:flex-start;justify-content:center;padding:40px 20px;overflow-y:auto;}
.modal{background:var(--bg);width:100%;max-width:760px;border:1px solid var(--line);}
.modal-hdr{padding:26px 30px 22px;border-bottom:1px solid var(--line);display:flex;align-items:flex-start;justify-content:space-between;gap:14px;}
.modal-title{font-size:24px;font-weight:800;letter-spacing:-.5px;}
.modal-bian{font-family:var(--mono);font-size:11px;color:var(--mid);margin-top:4px;}
.modal-x{background:none;border:1px solid var(--line);padding:7px 11px;cursor:pointer;font-size:15px;color:var(--mid);transition:all .2s;}
.modal-x:hover{background:var(--ink);color:var(--bg);border-color:var(--ink);}
.modal-body{padding:28px 30px;}
.modal-tabs{display:flex;border-bottom:1px solid var(--line);margin-bottom:24px;}
.mtab{padding:9px 18px;font-size:13px;font-weight:600;background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;color:var(--mid);transition:all .2s;}
.mtab.on{color:var(--ink);border-bottom-color:var(--ink);}
.ep-list{display:flex;flex-direction:column;gap:7px;}
.ep-row{display:flex;align-items:flex-start;gap:11px;padding:11px 13px;background:var(--cream);border:1px solid var(--line);}
.ep-badge{font-family:var(--mono);font-size:10px;font-weight:600;padding:2px 6px;border-radius:2px;flex-shrink:0;margin-top:1px;}
.badge-GET{background:#e3f4e8;color:#2e7d32;}
.badge-POST{background:#e8f0fe;color:#1565c0;}
.badge-PUT{background:#fff3e0;color:#e65100;}
.ep-path{font-family:var(--mono);font-size:11px;color:var(--ink);word-break:break-all;}
.ep-desc{font-size:12px;color:var(--mid);margin-top:3px;}
.cap-list{display:flex;flex-direction:column;gap:9px;}
.cap-row{display:flex;align-items:center;gap:11px;padding:11px 15px;border:1px solid var(--line);}
.cap-tick{width:19px;height:19px;border-radius:50%;background:var(--ink);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:10px;color:var(--bg);}
.cap-text{font-size:13px;font-weight:500;}
.scope-box{margin-top:14px;padding:14px;background:var(--cream);border:1px solid var(--line);}
.scope-lbl{font-family:var(--mono);font-size:10px;color:var(--mid);margin-bottom:6px;}
.console-wrap{position:fixed;inset:0;background:#070a0e;z-index:600;display:flex;flex-direction:column;}
.console-top{display:flex;align-items:center;justify-content:space-between;padding:0 22px;height:52px;background:#0c1018;border-bottom:1px solid #18222e;flex-shrink:0;}
.console-logo{font-family:var(--display);font-size:16px;font-weight:800;color:#fff;}
.console-logo span{color:var(--gold);}
.console-sub{font-family:var(--mono);font-size:10px;color:#445566;margin-left:10px;letter-spacing:1px;}
.console-x{font-family:var(--mono);font-size:11px;padding:6px 14px;background:rgba(255,255,255,.05);border:1px solid #1e2c3a;color:#445566;cursor:pointer;letter-spacing:1px;transition:all .2s;}
.console-x:hover{background:rgba(255,255,255,.09);color:#fff;}
.console-inner{display:flex;flex:1;overflow:hidden;}
.console-sidebar{width:200px;flex-shrink:0;border-right:1px solid #18222e;overflow-y:auto;background:#070a0e;}
.csb-lbl{font-family:var(--mono);font-size:9px;letter-spacing:2px;color:#2a3a4a;padding:13px 14px 5px;text-transform:uppercase;}
.csb-item{padding:9px 14px;cursor:pointer;transition:background .15s;display:flex;align-items:center;gap:8px;}
.csb-item:hover{background:rgba(255,255,255,.03);}
.csb-item.on{background:rgba(201,168,76,.1);border-right:2px solid var(--gold);}
.csb-icon{font-size:12px;}
.csb-name{font-family:var(--mono);font-size:11px;color:rgba(255,255,255,.55);}
.csb-item.on .csb-name{color:var(--gold);}
.console-main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;}
.ep-bar{padding:9px 14px;border-bottom:1px solid #18222e;display:flex;gap:5px;flex-wrap:wrap;background:#09101a;flex-shrink:0;}
.ep-btn{font-family:var(--mono);font-size:10px;padding:4px 9px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.4);cursor:pointer;transition:all .15s;display:flex;gap:4px;align-items:center;}
.ep-btn:hover{background:rgba(255,255,255,.06);color:rgba(255,255,255,.7);}
.ep-btn.on{background:rgba(201,168,76,.1);border-color:rgba(201,168,76,.35);color:var(--gold);}
.em{font-size:9px;font-weight:700;padding:1px 4px;border-radius:1px;}
.em-GET{background:#1a3d1a;color:#4caf50;}
.em-POST{background:#1a2a4a;color:#64b5f6;}
.em-PUT{background:#3d2a0a;color:#ffb74d;}
.workspace{flex:1;display:grid;grid-template-columns:1fr 1fr;overflow:hidden;}
.req-pane,.res-pane{display:flex;flex-direction:column;overflow:hidden;}
.req-pane{border-right:1px solid #18222e;}
.pane-hdr{padding:8px 14px;border-bottom:1px solid #18222e;font-family:var(--mono);font-size:10px;letter-spacing:1px;color:#2a3a4a;background:#070a0e;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;}
.url-row{display:flex;align-items:center;padding:9px 13px;border-bottom:1px solid #18222e;flex-shrink:0;background:#09101a;}
.url-method{font-family:var(--mono);font-size:11px;font-weight:700;padding:7px 9px;border:1px solid rgba(255,255,255,.09);border-right:none;min-width:54px;text-align:center;}
.um-GET{color:#4caf50;background:rgba(76,175,80,.07);}
.um-POST{color:#64b5f6;background:rgba(100,181,246,.07);}
.um-PUT{color:#ffb74d;background:rgba(255,183,77,.07);}
.url-path{flex:1;font-family:var(--mono);font-size:11px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.09);color:rgba(255,255,255,.6);padding:7px 9px;outline:none;min-width:0;}
.send{padding:7px 16px;background:var(--gold);color:#000;font-family:var(--mono);font-size:12px;font-weight:700;border:none;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:background .15s;}
.send:hover{background:#dbb95a;}
.send:disabled{opacity:.4;cursor:not-allowed;}
.req-fields{flex:1;overflow-y:auto;}
.field-section{border-bottom:1px solid rgba(255,255,255,.04);}
.field-sec-hdr{padding:8px 14px;font-family:var(--mono);font-size:10px;letter-spacing:1px;color:#2a3a4a;background:#070a0e;}
.field{padding:7px 14px;display:flex;flex-direction:column;gap:3px;}
.field-lbl{font-family:var(--mono);font-size:10px;color:#2a3a4a;}
.field-inp{font-family:var(--mono);font-size:11px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.09);color:rgba(255,255,255,.7);padding:6px 9px;outline:none;width:100%;}
.field-inp:focus{border-color:rgba(201,168,76,.45);}
.field-ta{font-family:var(--mono);font-size:11px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);color:#a5d6a7;padding:10px;outline:none;width:100%;resize:none;line-height:1.6;}
.field-ta:focus{border-color:rgba(201,168,76,.35);}
.res-body{flex:1;overflow-y:auto;padding:14px;}
.res-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:180px;color:#2a3a4a;gap:8px;}
.res-empty-icon{font-size:26px;}
.res-empty-text{font-family:var(--mono);font-size:11px;letter-spacing:1px;}
.res-meta{display:flex;gap:12px;margin-bottom:12px;align-items:center;}
.res-status{font-family:var(--mono);font-size:12px;font-weight:700;padding:3px 9px;background:rgba(76,175,80,.1);border:1px solid rgba(76,175,80,.3);color:#4caf50;}
.res-time{font-family:var(--mono);font-size:11px;color:#2a3a4a;}
.res-json{font-family:var(--mono);font-size:11px;line-height:1.7;color:#a5d6a7;white-space:pre-wrap;word-break:break-all;}
.res-loading{display:flex;align-items:center;gap:9px;color:var(--gold);font-family:var(--mono);font-size:12px;padding:18px 0;}
.spinner{width:15px;height:15px;border:2px solid rgba(201,168,76,.2);border-top-color:var(--gold);border-radius:50%;animation:spin .7s linear infinite;}
@keyframes spin{to{transform:rotate(360deg)}}
.obs-wrap{position:fixed;inset:0;background:#07090d;z-index:600;display:flex;flex-direction:column;}
.obs-top{display:flex;align-items:center;justify-content:space-between;padding:0 22px;height:52px;background:#0c1018;border-bottom:1px solid #18222e;flex-shrink:0;}
.obs-logo{font-family:var(--display);font-size:16px;font-weight:800;color:#fff;}
.obs-logo span{color:var(--gold);}
.obs-sub{font-family:var(--mono);font-size:10px;color:#445566;margin-left:10px;letter-spacing:1px;}
.obs-right{display:flex;align-items:center;gap:12px;}
.live-pill{display:flex;align-items:center;gap:6px;background:rgba(0,230,118,.07);border:1px solid rgba(0,230,118,.25);padding:4px 10px;}
.ldot{width:6px;height:6px;border-radius:50%;background:var(--green);animation:blink 1.5s infinite;}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
.ltext{font-family:var(--mono);font-size:10px;color:var(--green);}
.pause-btn{font-family:var(--mono);font-size:11px;padding:5px 13px;background:rgba(255,255,255,.04);border:1px solid #1e2c3a;color:#445566;cursor:pointer;transition:all .2s;letter-spacing:1px;}
.pause-btn:hover,.pause-btn.paused{background:rgba(201,168,76,.08);border-color:rgba(201,168,76,.4);color:var(--gold);}
.obs-tabs{display:flex;background:#0c1018;border-bottom:1px solid #18222e;padding:0 22px;}
.otab{padding:11px 18px;font-family:var(--mono);font-size:11px;letter-spacing:1px;color:#445566;cursor:pointer;border-bottom:2px solid transparent;background:none;border-top:none;border-left:none;border-right:none;transition:all .2s;}
.otab.on{color:var(--gold);border-bottom-color:var(--gold);}
.obs-page{padding:18px 22px;overflow-y:auto;flex:1;}
.kpi-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:11px;margin-bottom:18px;}
.kpi{background:#101620;border:1px solid #18222e;padding:14px;}
.kpi-lbl{font-family:var(--mono);font-size:9px;letter-spacing:1px;color:#445566;text-transform:uppercase;margin-bottom:7px;}
.kpi-val{font-family:var(--mono);font-size:22px;font-weight:600;}
.kpi-sub{font-family:var(--mono);font-size:10px;margin-top:3px;color:#445566;}
.chart-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px;}
.chart-row-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:18px;}
.chart-card{background:#101620;border:1px solid #18222e;padding:14px;}
.chart-hdr{font-family:var(--mono);font-size:10px;letter-spacing:1px;color:#445566;text-transform:uppercase;margin-bottom:12px;}
.sess-table{background:#101620;border:1px solid #18222e;overflow:hidden;}
.srow{display:grid;grid-template-columns:100px 120px 1fr 85px 75px 85px 70px;padding:8px 14px;border-bottom:1px solid rgba(255,255,255,.03);font-family:var(--mono);font-size:11px;align-items:center;cursor:pointer;transition:background .15s;}
.srow:hover{background:rgba(255,255,255,.025);}
.srow.on{background:rgba(201,168,76,.07);border-left:2px solid var(--gold);}
.srow-hdr{color:#2a3a4a;font-size:9px;letter-spacing:1px;text-transform:uppercase;cursor:default;}
.srow-hdr:hover{background:transparent;}
.srow.console-row{border-left:2px solid rgba(79,195,247,.4);}
.sbadge{font-size:10px;padding:2px 6px;}
.sb-success{background:rgba(0,230,118,.1);color:var(--green);border:1px solid rgba(0,230,118,.3);}
.sb-error{background:rgba(255,82,82,.1);color:var(--red);border:1px solid rgba(255,82,82,.3);}
.sb-timeout{background:rgba(255,183,77,.1);color:var(--orange);border:1px solid rgba(255,183,77,.3);}
.trace-layout{display:grid;grid-template-columns:1fr 340px;gap:14px;}
.trace-panel,.detail-panel{background:#101620;border:1px solid #18222e;}
.panel-hdr{padding:9px 14px;border-bottom:1px solid #18222e;display:flex;align-items:center;justify-content:space-between;}
.panel-hdr-lbl{font-family:var(--mono);font-size:10px;letter-spacing:1px;color:#445566;text-transform:uppercase;}
.panel-tid{font-family:var(--mono);font-size:10px;color:var(--gold);}
.trace-body{padding:14px;max-height:460px;overflow-y:auto;font-family:var(--mono);font-size:11px;line-height:1.8;}
.tl{display:flex;gap:9px;margin-bottom:2px;}
.tl-t{color:#2a3a4a;width:50px;flex-shrink:0;font-size:10px;padding-top:1px;}
.tl-sys{color:rgba(255,255,255,.25);}
.tl-auth{color:var(--blue);}
.tl-think{color:#445566;}
.tl-call{color:var(--gold);}
.tl-ret{color:var(--green);}
.tl-done{color:#fff;font-weight:500;}
.detail-sec{padding:13px 14px;border-bottom:1px solid #18222e;}
.detail-sec:last-child{border-bottom:none;}
.dlbl{font-family:var(--mono);font-size:9px;letter-spacing:2px;color:#445566;text-transform:uppercase;margin-bottom:9px;}
.drow{display:flex;justify-content:space-between;margin-bottom:5px;}
.dk{font-family:var(--mono);font-size:11px;color:#445566;}
.dv{font-family:var(--mono);font-size:11px;color:rgba(255,255,255,.75);}
.dv.gold{color:var(--gold);}
.dv.green{color:var(--green);}
.dv.blue{color:var(--blue);}
.tok-wrap{margin-top:7px;}
.tok-row{display:flex;justify-content:space-between;font-family:var(--mono);font-size:10px;color:#445566;margin-bottom:3px;}
.tok-track{height:5px;background:#18222e;border-radius:3px;overflow:hidden;}
.tok-fill{height:100%;border-radius:3px;transition:width .5s;}
.span-panel{background:#101620;border:1px solid #18222e;margin-bottom:14px;}
.span-body{padding:14px;overflow-x:auto;}
.span-ruler{display:flex;justify-content:space-between;padding:0 0 6px;min-width:500px;}
.span-ruler span{font-family:var(--mono);font-size:9px;color:#2a3a4a;}
.span-row{display:flex;align-items:center;gap:0;margin-bottom:5px;min-width:500px;}
.span-info{width:220px;flex-shrink:0;}
.span-name{font-family:var(--mono);font-size:11px;color:rgba(255,255,255,.75);}
.span-svc{font-family:var(--mono);font-size:10px;color:#445566;}
.span-track{flex:1;position:relative;height:22px;}
.span-bar{position:absolute;height:16px;top:3px;border-radius:2px;display:flex;align-items:center;padding:0 5px;font-family:var(--mono);font-size:9px;color:rgba(0,0,0,.75);font-weight:600;overflow:hidden;white-space:nowrap;min-width:4px;}
.span-dur{font-family:var(--mono);font-size:10px;color:#445566;width:48px;text-align:right;flex-shrink:0;}
.attr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:9px;padding:14px;}
.attr-card{background:#0c1018;border:1px solid #18222e;padding:10px 12px;}
.attr-name{font-family:var(--mono);font-size:10px;margin-bottom:5px;letter-spacing:.5px;}
.attr-row{display:flex;justify-content:space-between;margin-bottom:3px;}
.attr-k{font-family:var(--mono);font-size:10px;color:#445566;}
.attr-v{font-family:var(--mono);font-size:10px;color:rgba(255,255,255,.65);}
.builds-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;margin-bottom:40px;}
.build-card{padding:22px;border:1px solid var(--line);cursor:pointer;transition:border-color .2s,background .2s;}
.build-card:hover{border-color:var(--gold);}
.build-card.active{border-color:var(--gold);background:var(--cream);}
.build-card-icon{font-size:20px;margin-bottom:10px;}
.build-card-name{font-size:14px;font-weight:700;margin-bottom:6px;}
.build-card-desc{font-size:12px;color:var(--mid);line-height:1.55;margin-bottom:12px;}
.build-tags{display:flex;flex-wrap:wrap;gap:5px;}
.build-tag{font-family:var(--mono);font-size:9px;letter-spacing:.5px;padding:2px 7px;border:1px solid var(--line);color:var(--mid);}
.build-viewer{border:1px solid var(--line);}
.build-viewer-bar{display:flex;align-items:center;justify-content:space-between;padding:11px 16px;border-bottom:1px solid var(--line);background:var(--cream);}
.build-viewer-title{font-family:var(--mono);font-size:11px;letter-spacing:.5px;color:var(--mid);}
.build-viewer-badge{font-family:var(--mono);font-size:10px;padding:2px 8px;border:1px solid;letter-spacing:.5px;}
.build-viewer-code{background:#07090d;padding:24px;overflow-x:auto;}
.build-viewer-code pre{font-family:var(--mono);font-size:12px;line-height:1.8;color:#c8d8e8;margin:0;white-space:pre;}
.mcp-sec{padding:96px 40px;}
.mcp-grid{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:40px;}
.mcp-card{border:1px solid var(--line);padding:28px;}
.mcp-card-hdr{display:flex;align-items:center;gap:10px;margin-bottom:16px;}
.mcp-card-icon{font-size:18px;}
.mcp-card-title{font-size:15px;font-weight:700;}
.mcp-card-sub{font-size:12px;color:var(--mid);line-height:1.6;margin-bottom:18px;}
.mcp-copy-block{position:relative;}
.mcp-code{background:#07090d;border:1px solid rgba(255,255,255,.09);padding:16px;font-family:var(--mono);font-size:11px;line-height:1.75;color:#a5d6a7;overflow-x:auto;white-space:pre;}
.mcp-copy-btn{position:absolute;top:8px;right:8px;font-family:var(--mono);font-size:10px;padding:4px 10px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.4);cursor:pointer;letter-spacing:.5px;transition:all .15s;}
.mcp-copy-btn:hover{background:rgba(201,168,76,.12);border-color:rgba(201,168,76,.4);color:var(--gold);}
.mcp-tools-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;margin-top:40px;}
.mcp-tool{padding:16px;border:1px solid var(--line);background:var(--cream);}
.mcp-tool-name{font-family:var(--mono);font-size:13px;font-weight:600;margin-bottom:4px;}
.mcp-tool-desc{font-size:12px;color:var(--mid);line-height:1.5;margin-bottom:10px;}
.mcp-schema{font-family:var(--mono);font-size:10px;color:var(--mid);display:flex;flex-wrap:wrap;gap:4px;}
.mcp-param{padding:2px 6px;background:var(--bg);border:1px solid var(--line);}
.mcp-param.req{border-color:var(--gold);color:var(--gold);}
.mcp-term{margin-top:40px;}
@media(max-width:900px){.mcp-grid{grid-template-columns:1fr;}}
.tab-bar{position:sticky;top:60px;z-index:200;background:rgba(248,247,244,.97);backdrop-filter:blur(12px);border-bottom:1px solid var(--line);display:flex;align-items:center;gap:0;padding:0 40px;}
.tab-btn{font-size:12px;font-weight:600;letter-spacing:.5px;padding:14px 22px;background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;color:var(--mid);transition:color .2s,border-color .2s;white-space:nowrap;}
.tab-btn:hover{color:var(--ink);}
.tab-btn.on{color:var(--ink);border-bottom-color:var(--ink);}
footer{padding:56px 40px 36px;border-top:1px solid var(--line);display:flex;flex-wrap:wrap;justify-content:space-between;gap:36px;}
.footer-logo{font-family:var(--display);font-size:20px;font-weight:800;margin-bottom:7px;}
.footer-logo span{color:var(--gold);}
.footer-tag{font-size:13px;color:var(--mid);}
.footer-col-hdr{font-size:13px;font-weight:700;margin-bottom:14px;}
.footer-links{display:flex;flex-direction:column;gap:8px;}
.fl{font-size:13px;color:var(--mid);cursor:pointer;transition:color .2s;}
.fl:hover{color:var(--ink);}
.footer-bar{padding:20px 40px;border-top:1px solid var(--line);display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;font-family:var(--mono);font-size:11px;color:var(--mid);}
@media(max-width:768px){.tab-bar{padding:0 20px;overflow-x:auto;}.tab-btn{padding:12px 14px;font-size:11px;}}
@media(max-width:1100px){.chart-row-3{grid-template-columns:1fr 1fr;}.trace-layout{grid-template-columns:1fr;}}
@media(max-width:900px){.agent-grid,.uc-grid,.workspace{grid-template-columns:1fr;}.detail-panel,.res-pane{display:none;}}
@media(max-width:768px){.nav{padding:0 20px;}.nav-links{display:none;}.sec,.tools-sec,.uc-sec{padding:60px 20px;}.hero{padding:100px 20px 60px;}.hero-stats{gap:26px;}footer,.footer-bar{padding-left:20px;padding-right:20px;}.srow{grid-template-columns:80px 1fr 65px 60px;}.srow>*:nth-child(n+5){display:none;}}
`;

function CT({active,payload,label,unit=""}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{background:"#0d1520",border:"1px solid #1e2c3a",padding:"8px 12px",fontFamily:"monospace",fontSize:11}}>
      <div style={{color:"#445566",marginBottom:4}}>{label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{color:p.color}}>{p.name}: {p.value}{unit}</div>
      ))}
    </div>
  );
}

export default function App() {
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
  const [cBody, setCBody]      = useState("");
  const [cAuth, setCAuth]      = useState("Bearer eyJhbGciOiJQUzI1NiIsInR5cCI6IkpXVCJ9...");
  const [cResp, setCResp]      = useState(null);
  const [cLoading, setCLoading]= useState(false);
  const [cTime, setCTime]      = useState(null);

  /* observability state */
  const [obsTab, setObsTab]        = useState("metrics");
  const [obsPaused, setObsPaused]  = useState(false);
  const [sessions, setSessions]    = useState(()=>Array.from({length:12},(_,i)=>makeSession(i+1)));
  const [history, setHistory]      = useState(makeHistory);
  const [selSess, setSelSess]      = useState(null);
  const [traceLines, setTraceLines]= useState([]);
  const [spans, setSpans]          = useState([]);
  const sessCounter                = useRef(13);
  const traceRef                   = useRef(null);

  function switchTab(id) {
    setActiveTab(id);
    window.scrollTo({ top: (tabBarRef.current?.offsetTop ?? 0) - 60, behavior: "smooth" });
  }

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

  /* obs trace animation */
  useEffect(()=>{
    if (!selSess) return;
    const steps = makeTraceSteps(selSess);
    setTraceLines([]); setSpans(makeSpans(selSess));
    let i=0;
    const t = setInterval(()=>{ if(i<steps.length){setTraceLines(p=>[...p,steps[i]]);i++;}else clearInterval(t); },190);
    return ()=>clearInterval(t);
  },[selSess?.id]);
  useEffect(()=>{ if(traceRef.current) traceRef.current.scrollTop=traceRef.current.scrollHeight; },[traceLines]);

  /* console helpers */
  const cDom = DOMAINS.find(d=>d.id===cDomain);
  const cEp  = cDom?.endpoints[cEpIdx];
  function pickDomain(id) {
    const d=DOMAINS.find(x=>x.id===id);
    setCDomain(id); setCEpIdx(0); setCResp(null);
    setCBody(defaultBody(d.endpoints[0].m, d.endpoints[0].p));
  }
  function pickEp(i) {
    setCEpIdx(i); setCResp(null);
    setCBody(defaultBody(cDom.endpoints[i].m, cDom.endpoints[i].p));
  }

  /* API Console → Observability: real calls appear as sessions with a blue left border */
  async function sendReq() {
    if (!cEp) return;
    setCLoading(true); setCResp(null);
    const t0 = Date.now();
    await new Promise(r=>setTimeout(r, 350+Math.random()*450));
    const elapsed = Date.now()-t0;
    setCTime(elapsed);
    const resp = mockApi(cEp.m, cEp.p);
    setCResp(resp);
    setCLoading(false);

    const matchedTool = TOOLS.find(t=>t.domain===cDomain) ?? TOOLS[0];
    const consoleSess = {
      id: `SES-${String(sessCounter.current++).padStart(5,"0")}`,
      traceId: Array.from({length:16},()=>Math.floor(Math.random()*16).toString(16)).join(""),
      customer: "API Console",
      model: OBS_MODELS[0],
      tool: matchedTool.name,
      latency: elapsed,
      inputTok: rnd(200,600),
      outputTok: rnd(40,180),
      toolCalls: 1,
      status: "success",
      ts: Date.now(),
      source: "console",
    };
    setSessions(p=>[consoleSess, ...p].slice(0,40));
    setHistory(p=>{
      const pt={t:new Date().toLocaleTimeString("en",{hour:"2-digit",minute:"2-digit"}),latency:elapsed,inputTok:consoleSess.inputTok,outputTok:consoleSess.outputTok,toolCalls:1,errors:0,sessions:1};
      return [...p.slice(-19),pt];
    });
  }

  /* derived obs metrics */
  const rec    = sessions.slice(0,30);
  const avgLat = Math.round(rec.reduce((a,s)=>a+s.latency,0)/rec.length);
  const totTok = rec.reduce((a,s)=>a+s.inputTok+s.outputTok,0);
  const errPct = +(rec.filter(s=>s.status!=="success").length/rec.length*100).toFixed(1);
  const avgTool= +(rec.reduce((a,s)=>a+s.toolCalls,0)/rec.length).toFixed(1);
  const toolDist=OBS_TOOLS.map(n=>({name:n.replace(/_/g," "),calls:rec.filter(s=>s.tool===n).length*rnd(1,4)||rnd(1,8)})).sort((a,b)=>b.calls-a.calls);
  const spanMax=spans.length?Math.max(...spans.map(s=>s.start+s.dur))||1:1;
  const spColors=["#4fc3f7","#81c784","#ffb74d","#ce93d8","#ef9a9a","#80cbc4"];
  const modalDomain = modal ? DOMAINS.find(d=>d.id===modal) : null;

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
          <a className="nl" href="https://github.com/watsongm/agentbank" target="_blank" rel="noreferrer">GitHub ↗</a>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="nav-btn" style={{background:"transparent",color:"var(--ink)",border:"1.5px solid var(--ink)"}} onClick={()=>setShowObs(true)}>Observability</button>
          <button className="nav-btn" onClick={()=>{ setShowConsole(true); setCBody(defaultBody(cDom.endpoints[0].m,cDom.endpoints[0].p)); }}>API Console →</button>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-grid"/>
        <div className="hero-inner">
          <div className="hero-tag"><div className="hero-dot"/>AGENTBANK · BIAN v12 · OPEN BANKING v3.1 · AI-NATIVE</div>
          <h1>The Bank<br/>Built for<br/><em>AI Agents</em></h1>
          <p className="hero-p">agentBANK is a fully-featured reference bank combining the Open Banking API standard with the BIAN Service Domain capability model — with AI agents as a first-class customer channel.</p>
          <div className="btn-row">
            <button className="btn-dark" onClick={()=>switchTab("usecase")}>See Agent Use Case</button>
            <button className="btn-light" onClick={()=>switchTab("services")}>View All Services</button>
          </div>
          <div className="hero-stats">
            {[["10+","BIAN Service Domains"],["45+","API Endpoints"],["14","Agent Tool Functions"],["v3.1","Open Banking Spec"]].map(([n,l])=>(
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
              <span className="code-lbl">STEP {AGENT_STEPS[ucStep].id} — {AGENT_STEPS[ucStep].title.toUpperCase()}</span>
              <span className="code-badge" style={{borderColor:AGENT_STEPS[ucStep].color,color:AGENT_STEPS[ucStep].color}}>{AGENT_STEPS[ucStep].icon} {AGENT_STEPS[ucStep].domain}</span>
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
                <div key={t.name} className="tool-card">
                  <div className="tool-name" style={{color:dom?.color}}>{t.name}()</div>
                  <div className="tool-dom">{t.domain.replace(/-/g," ")}</div>
                  <div className="tool-desc">{t.desc}</div>
                  <div className="tool-params">{t.params.map(p=><span key={p} className="tool-p">{p}</span>)}</div>
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

      {activeTab==="mcp" && <McpTab tools={TOOLS} domains={DOMAINS}/>}
      {activeTab==="sdk" && <SdkTab/>}

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
            <span className="fl" onClick={()=>{ setShowConsole(true); setCBody(defaultBody(DOMAINS[0].endpoints[0].m, DOMAINS[0].endpoints[0].p)); }}>API Console</span>
            <span className="fl" onClick={()=>setShowObs(true)}>Observability</span>
            <span className="fl" onClick={()=>switchTab("sdk")}>Agent SDK</span>
            <a className="fl" href="https://github.com/watsongm/agentbank/blob/main/openapi.yaml" target="_blank" rel="noreferrer">OpenAPI Spec ↗</a>
          </div>
        </div>
        <div>
          <div className="footer-col-hdr">Project</div>
          <div className="footer-links">
            <a className="fl" href="https://github.com/watsongm/agentbank" target="_blank" rel="noreferrer">GitHub ↗</a>
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
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal">
            <div className="modal-hdr">
              <div><div className="modal-title" style={{color:modalDomain.color}}>{modalDomain.icon} {modalDomain.name}</div><div className="modal-bian">{modalDomain.bian}</div></div>
              <button className="modal-x" onClick={()=>setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{fontSize:14,color:"var(--mid)",lineHeight:1.7,marginBottom:22}}>{modalDomain.desc}</p>
              <div className="modal-tabs">
                <button className={`mtab ${modalTab==="ep"?"on":""}`} onClick={()=>setModalTab("ep")}>Endpoints ({modalDomain.endpoints.length})</button>
                <button className={`mtab ${modalTab==="caps"?"on":""}`} onClick={()=>setModalTab("caps")}>Agent Capabilities ({modalDomain.caps.length})</button>
              </div>
              {modalTab==="ep" && <div className="ep-list">{modalDomain.endpoints.map((ep,i)=><div key={i} className="ep-row"><span className={`ep-badge badge-${ep.m}`}>{ep.m}</span><div><div className="ep-path">{ep.p}</div><div className="ep-desc">{ep.d}</div></div></div>)}</div>}
              {modalTab==="caps" && <div><div className="cap-list">{modalDomain.caps.map((c,i)=><div key={i} className="cap-row"><div className="cap-tick">✓</div><span className="cap-text">{c}</span></div>)}</div><div className="scope-box"><div className="scope-lbl">REQUIRED CONSENT SCOPE</div><code style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--ink)"}}>{modalDomain.id}:read {modalDomain.id}:write</code></div></div>}
            </div>
          </div>
        </div>
      )}

      {/* API CONSOLE */}
      {showConsole && (
        <div className="console-wrap">
          <div className="console-top">
            <div style={{display:"flex",alignItems:"center"}}><div className="console-logo">AGENT<span>BANK</span></div><span className="console-sub">Interactive API Console</span></div>
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
                  <button key={i} className={`ep-btn ${cEpIdx===i?"on":""}`} onClick={()=>pickEp(i)}>
                    <span className={`em em-${ep.m}`}>{ep.m}</span>
                    <span style={{maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ep.p.split("/").slice(-2).join("/")}</span>
                  </button>
                ))}
              </div>
              <div className="workspace">
                <div className="req-pane">
                  <div className="pane-hdr"><span>REQUEST</span><span style={{color:"#2a3a4a"}}>{cDom?.bian}</span></div>
                  <div className="url-row">
                    <div className={`url-method um-${cEp?.m}`}>{cEp?.m}</div>
                    <input className="url-path" value={cEp?.p||""} readOnly/>
                    <button className="send" onClick={sendReq} disabled={cLoading}>{cLoading?"...":"SEND →"}</button>
                  </div>
                  <div className="req-fields">
                    <div className="field-section">
                      <div className="field-sec-hdr">HEADERS</div>
                      <div className="field"><span className="field-lbl">Authorization</span><input className="field-inp" value={cAuth} onChange={e=>setCAuth(e.target.value)}/></div>
                      <div className="field"><span className="field-lbl">x-fapi-interaction-id</span><input className="field-inp" defaultValue="3f785c72-b4a1-4b9c-9221-8d6c3f0e1294" readOnly/></div>
                      <div className="field"><span className="field-lbl">Content-Type</span><input className="field-inp" value="application/json" readOnly/></div>
                    </div>
                    {cEp?.m!=="GET" && <div className="field-section"><div className="field-sec-hdr">REQUEST BODY</div><div style={{padding:"8px 14px"}}><textarea className="field-ta" rows={8} value={cBody} onChange={e=>setCBody(e.target.value)}/></div></div>}
                    <div className="field-section"><div className="field-sec-hdr">ENDPOINT INFO</div><div style={{padding:"10px 14px"}}><div style={{fontSize:12,color:"rgba(255,255,255,.35)",lineHeight:1.7}}>{cEp?.d}</div><div style={{marginTop:7,fontFamily:"monospace",fontSize:10,color:"#2a3a4a"}}>SCOPE: <span style={{color:"rgba(201,168,76,.7)"}}>{cDomain}:read{cEp?.m!=="GET"?" "+cDomain+":write":""}</span></div></div></div>
                  </div>
                </div>
                <div className="res-pane">
                  <div className="pane-hdr"><span>RESPONSE</span>{cResp&&<span style={{color:"#2a3a4a"}}>{cTime}ms</span>}</div>
                  <div className="res-body">
                    {!cResp&&!cLoading&&<div className="res-empty"><div className="res-empty-icon">◎</div><div className="res-empty-text">HIT SEND TO EXECUTE</div></div>}
                    {cLoading&&<div className="res-loading"><div className="spinner"/>AWAITING RESPONSE...</div>}
                    {cResp&&!cLoading&&<><div className="res-meta"><div className="res-status">200 OK</div><div className="res-time">{cTime}ms · application/json</div></div><pre className="res-json">{JSON.stringify(cResp,null,2)}</pre></>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OBSERVABILITY */}
      {showObs && (
        <div className="obs-wrap">
          <div className="obs-top">
            <div style={{display:"flex",alignItems:"center"}}><div className="obs-logo">AGENT<span>BANK</span></div><span className="obs-sub">OBSERVABILITY</span></div>
            <div className="obs-right">
              <div className="live-pill"><div className="ldot"/><span className="ltext">LIVE · {sessions.length} SESSIONS</span></div>
              <button className={`pause-btn ${obsPaused?"paused":""}`} onClick={()=>setObsPaused(p=>!p)}>{obsPaused?"▶ RESUME":"⏸ PAUSE"}</button>
              <button className="console-x" onClick={()=>setShowObs(false)}>✕ CLOSE</button>
            </div>
          </div>
          <div className="obs-tabs">
            {[["metrics","LLM METRICS"],["trace","AGENT TRACE"],["otel","OTEL SPANS"]].map(([id,lbl])=>(
              <button key={id} className={`otab ${obsTab===id?"on":""}`} onClick={()=>setObsTab(id)}>{lbl}</button>
            ))}
          </div>

          {obsTab==="metrics" && (
            <div className="obs-page">
              <div className="kpi-row">
                {[
                  {l:"AVG LATENCY",   v:`${avgLat}ms`,                  c:"var(--orange)"},
                  {l:"TOTAL TOKENS",  v:`${(totTok/1000).toFixed(1)}k`, c:"var(--blue)"},
                  {l:"AVG TOOL CALLS",v:avgTool,                         c:"var(--purple)"},
                  {l:"ERROR RATE",    v:`${errPct}%`,                    c:errPct>5?"var(--red)":"var(--green)"},
                  {l:"LIVE SESSIONS", v:sessions.length,                 c:"var(--green)"},
                  {l:"MODELS ACTIVE", v:OBS_MODELS.length,               c:"var(--blue)"},
                ].map(k=>(
                  <div key={k.l} className="kpi"><div className="kpi-lbl">{k.l}</div><div className="kpi-val" style={{color:k.c}}>{k.v}</div></div>
                ))}
              </div>
              <div className="chart-row">
                <div className="chart-card">
                  <div className="chart-hdr">AGENT LATENCY (ms)</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={history} margin={{top:4,right:4,left:-20,bottom:0}}>
                      <defs><linearGradient id="gl1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ffb74d" stopOpacity={.3}/><stop offset="95%" stopColor="#ffb74d" stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)"/>
                      <XAxis dataKey="t" tick={{fill:"#2a3a4a",fontSize:9,fontFamily:"monospace"}} tickLine={false} axisLine={false}/>
                      <YAxis tick={{fill:"#2a3a4a",fontSize:9,fontFamily:"monospace"}} tickLine={false} axisLine={false}/>
                      <Tooltip content={<CT unit="ms"/>}/>
                      <Area type="monotone" dataKey="latency" stroke="#ffb74d" strokeWidth={2} fill="url(#gl1)" name="latency" dot={false}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="chart-card">
                  <div className="chart-hdr">TOKEN USAGE (in / out)</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={history} margin={{top:4,right:4,left:-20,bottom:0}}>
                      <defs>
                        <linearGradient id="gl2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4fc3f7" stopOpacity={.3}/><stop offset="95%" stopColor="#4fc3f7" stopOpacity={0}/></linearGradient>
                        <linearGradient id="gl3" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ce93d8" stopOpacity={.3}/><stop offset="95%" stopColor="#ce93d8" stopOpacity={0}/></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)"/>
                      <XAxis dataKey="t" tick={{fill:"#2a3a4a",fontSize:9,fontFamily:"monospace"}} tickLine={false} axisLine={false}/>
                      <YAxis tick={{fill:"#2a3a4a",fontSize:9,fontFamily:"monospace"}} tickLine={false} axisLine={false}/>
                      <Tooltip content={<CT unit=" tok"/>}/>
                      <Area type="monotone" dataKey="inputTok" stroke="#4fc3f7" strokeWidth={2} fill="url(#gl2)" name="input" dot={false}/>
                      <Area type="monotone" dataKey="outputTok" stroke="#ce93d8" strokeWidth={2} fill="url(#gl3)" name="output" dot={false}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="chart-row-3">
                <div className="chart-card">
                  <div className="chart-hdr">TOOL CALLS / SESSION</div>
                  <ResponsiveContainer width="100%" height={140}>
                    <AreaChart data={history} margin={{top:4,right:4,left:-20,bottom:0}}>
                      <defs><linearGradient id="gl4" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00e676" stopOpacity={.3}/><stop offset="95%" stopColor="#00e676" stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)"/>
                      <XAxis dataKey="t" tick={{fill:"#2a3a4a",fontSize:9,fontFamily:"monospace"}} tickLine={false} axisLine={false}/>
                      <YAxis tick={{fill:"#2a3a4a",fontSize:9,fontFamily:"monospace"}} tickLine={false} axisLine={false}/>
                      <Tooltip content={<CT/>}/>
                      <Area type="monotone" dataKey="toolCalls" stroke="#00e676" strokeWidth={2} fill="url(#gl4)" name="calls" dot={false}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="chart-card">
                  <div className="chart-hdr">TOP TOOLS BY VOLUME</div>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={toolDist.slice(0,6)} layout="vertical" margin={{top:0,right:4,left:70,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" horizontal={false}/>
                      <XAxis type="number" tick={{fill:"#2a3a4a",fontSize:9,fontFamily:"monospace"}} tickLine={false} axisLine={false}/>
                      <YAxis type="category" dataKey="name" tick={{fill:"#7899aa",fontSize:9,fontFamily:"monospace"}} tickLine={false} axisLine={false}/>
                      <Tooltip content={<CT/>}/>
                      <Bar dataKey="calls" fill="#ce93d8" radius={[0,2,2,0]} name="calls"/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="chart-card">
                  <div className="chart-hdr">ERRORS AND SESSIONS</div>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={history.slice(-10)} margin={{top:4,right:4,left:-20,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)"/>
                      <XAxis dataKey="t" tick={{fill:"#2a3a4a",fontSize:9,fontFamily:"monospace"}} tickLine={false} axisLine={false}/>
                      <YAxis tick={{fill:"#2a3a4a",fontSize:9,fontFamily:"monospace"}} tickLine={false} axisLine={false}/>
                      <Tooltip content={<CT/>}/>
                      <Bar dataKey="sessions" fill="rgba(79,195,247,.45)" name="sessions" radius={[2,2,0,0]}/>
                      <Bar dataKey="errors" fill="rgba(255,82,82,.65)" name="errors" radius={[2,2,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="sess-table">
                <div className="srow srow-hdr"><span>SESSION</span><span>MODEL</span><span>CUSTOMER</span><span>LATENCY</span><span>TOKENS</span><span>STATUS</span><span>TOOLS</span></div>
                {sessions.slice(0,14).map(s=>(
                  <div key={s.id} className={`srow ${selSess?.id===s.id?"on":""} ${s.source==="console"?"console-row":""}`} onClick={()=>{setSelSess(s);setObsTab("trace");}}>
                    <span style={{color:"var(--gold)",fontFamily:"monospace"}}>{s.id}</span>
                    <span style={{color:"var(--blue)",fontSize:10}}>{s.model.replace("claude-","")}</span>
                    <span style={{color:s.source==="console"?"var(--blue)":undefined}}>{s.customer}</span>
                    <span style={{color:"var(--orange)"}}>{s.latency}ms</span>
                    <span>{((s.inputTok+s.outputTok)/1000).toFixed(1)}k</span>
                    <span><span className={`sbadge sb-${s.status}`}>{s.status}</span></span>
                    <span style={{color:"#445566"}}>{s.toolCalls}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {obsTab==="trace" && (
            <div className="obs-page">
              {!selSess ? (
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:300,color:"#2a3a4a",gap:10}}>
                  <div style={{fontSize:28,opacity:.3}}>◎</div>
                  <div style={{fontFamily:"monospace",fontSize:11,letterSpacing:1}}>SELECT A SESSION FROM METRICS TAB</div>
                </div>
              ) : (
                <div className="trace-layout">
                  <div className="trace-panel">
                    <div className="panel-hdr"><span className="panel-hdr-lbl">AGENT REASONING TRACE</span><span className="panel-tid">{selSess.traceId.slice(0,20)}…</span></div>
                    <div className="trace-body" ref={traceRef}>
                      {traceLines.map((ln,i)=>(
                        <div key={i} className="tl"><span className="tl-t">+{ln.t}ms</span><span className={`tl-${ln.type}`}>{ln.text}</span></div>
                      ))}
                      {traceLines.length < makeTraceSteps(selSess).length && <span style={{color:"rgba(201,168,76,.5)",animation:"pulse 1s infinite"}}>▌</span>}
                    </div>
                  </div>
                  <div className="detail-panel">
                    <div className="detail-sec">
                      <div className="dlbl">Session Details</div>
                      {[["Session",selSess.id,"gold"],["Customer",selSess.customer,""],["Model",selSess.model,"blue"],["Status",selSess.status,selSess.status==="success"?"green":"red"],["Latency",selSess.latency+"ms",""],["Tool Calls",selSess.toolCalls,""],["Source",selSess.source??"simulated",""]].map(([k,v,c])=>(
                        <div key={k} className="drow"><span className="dk">{k}</span><span className={`dv ${c}`}>{v}</span></div>
                      ))}
                    </div>
                    <div className="detail-sec">
                      <div className="dlbl">Token Usage</div>
                      {[["Input",selSess.inputTok,"#4fc3f7"],["Output",selSess.outputTok,"#ce93d8"]].map(([k,v,col])=>(
                        <div key={k} className="tok-wrap">
                          <div className="tok-row"><span>{k} tokens</span><span style={{color:col}}>{v.toLocaleString()}</span></div>
                          <div className="tok-track"><div className="tok-fill" style={{width:(v/(selSess.inputTok+selSess.outputTok)*100)+"%",background:col}}/></div>
                        </div>
                      ))}
                    </div>
                    <div className="detail-sec">
                      <div className="dlbl">Other Sessions</div>
                      {sessions.slice(0,6).map(s=>(
                        <div key={s.id} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,.04)",cursor:"pointer"}} onClick={()=>setSelSess(s)}>
                          <span style={{fontFamily:"monospace",fontSize:10,color:selSess.id===s.id?"var(--gold)":"#445566"}}>{s.id}</span>
                          <span style={{fontFamily:"monospace",fontSize:10,color:"rgba(255,255,255,.6)"}}>{s.customer.split(" ")[0]}</span>
                          <span className={`sbadge sb-${s.status}`}>{s.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {obsTab==="otel" && (
            <div className="obs-page">
              {!selSess ? (
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:300,color:"#2a3a4a",gap:10}}>
                  <div style={{fontSize:28,opacity:.3}}>◎</div>
                  <div style={{fontFamily:"monospace",fontSize:11,letterSpacing:1}}>SELECT A SESSION FROM METRICS TAB</div>
                </div>
              ) : (
                <>
                  <div className="kpi-row" style={{marginBottom:14}}>
                    {[["TRACE ID",selSess.traceId.slice(0,16)+"…",""],["TOTAL SPANS",spans.length,"var(--blue)"],["ROOT DURATION",spanMax+"ms","var(--orange)"],["SERVICES",[...new Set(spans.map(s=>s.service))].length,"var(--green)"],["ERRORS",spans.filter(s=>s.status==="error").length,spans.some(s=>s.status==="error")?"var(--red)":"var(--green)"]].map(([l,v,c])=>(
                      <div key={l} className="kpi" style={{padding:"11px 13px"}}><div className="kpi-lbl">{l}</div><div className="kpi-val" style={{fontSize:15,color:c||"rgba(255,255,255,.75)"}}>{v}</div></div>
                    ))}
                  </div>
                  <div className="span-panel">
                    <div className="panel-hdr"><span className="panel-hdr-lbl">Trace Waterfall</span><span className="panel-tid">{selSess.traceId}</span><span style={{fontFamily:"monospace",fontSize:10,color:"#445566",marginLeft:"auto"}}>{selSess.model}</span></div>
                    <div className="span-body">
                      <div style={{display:"flex",paddingLeft:220,paddingBottom:6,minWidth:500}}>
                        {[0,25,50,75,100].map(p=><span key={p} style={{fontFamily:"monospace",fontSize:9,color:"#2a3a4a",flex:1}}>{Math.round(spanMax*p/100)}ms</span>)}
                      </div>
                      {spans.map((sp,i)=>(
                        <div key={sp.name+i} className="span-row" style={{paddingLeft:sp.depth*16}}>
                          <div className="span-info"><div className="span-name">{sp.name}</div><div className="span-svc" style={{color:spColors[i%spColors.length]}}>{sp.service}</div></div>
                          <div className="span-track">
                            {[25,50,75].map(p=><div key={p} style={{position:"absolute",left:p+"%",top:0,bottom:0,width:1,background:"rgba(255,255,255,.04)"}}/>)}
                            <div className="span-bar" style={{left:(sp.start/spanMax*100)+"%",width:Math.max(sp.dur/spanMax*100,0.5)+"%",background:sp.status==="ok"?spColors[i%spColors.length]+"99":"rgba(255,82,82,.7)"}}>{sp.dur>spanMax*.08?sp.dur+"ms":""}</div>
                          </div>
                          <div className="span-dur">{sp.dur}ms</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="span-panel">
                    <div className="panel-hdr"><span className="panel-hdr-lbl">Span Attributes</span></div>
                    <div className="attr-grid">
                      {spans.map((sp,i)=>(
                        <div key={sp.name+i} className="attr-card">
                          <div className="attr-name" style={{color:spColors[i%spColors.length]}}>{sp.name}</div>
                          {[["service",sp.service],["status",sp.status],["duration",sp.dur+"ms"],["http.status_code","200"],["fapi.interaction_id",selSess.traceId.slice(0,12)+"…"]].map(([k,v])=>(
                            <div key={k} className="attr-row"><span className="attr-k">{k}</span><span className="attr-v" style={{color:k==="status"&&sp.status==="error"?"var(--red)":undefined}}>{v}</span></div>
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
      )}
    </>
  );
}
