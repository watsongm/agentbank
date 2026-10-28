export const OBS_TOOLS     = ["get_party","get_accounts","get_balance","get_transactions","initiate_payment","apply_for_loan","get_card_details","run_aml_screen"];
export const OBS_CUSTOMERS = ["Aria Chen","James Okafor","Sofia Reyes","Lena Fischer","Kai Nakamura","Priya Sharma"];
export const OBS_MODELS    = ["claude-opus-4-5","claude-sonnet-4-6"];

export function rnd(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

export function makeSession(id) {
  return {
    id: `SES-${String(id).padStart(5,"0")}`,
    traceId: Array.from({length:16}, () => Math.floor(Math.random()*16).toString(16)).join(""),
    customer: OBS_CUSTOMERS[rnd(0, OBS_CUSTOMERS.length-1)],
    model: OBS_MODELS[rnd(0,1)],
    tool: OBS_TOOLS[rnd(0, OBS_TOOLS.length-1)],
    latency: rnd(180,1200),
    inputTok: rnd(800,4200),
    outputTok: rnd(120,1600),
    toolCalls: rnd(1,8),
    status: Math.random()>0.09 ? "success" : Math.random()>0.5 ? "error" : "timeout",
    ts: Date.now(),
    source: "simulated",
  };
}

export function makeHistory() {
  return Array.from({length:20}, (_,i) => ({
    t: `${String(i).padStart(2,"0")}:00`,
    latency: rnd(200,900),
    inputTok: rnd(1200,4000),
    outputTok: rnd(200,1600),
    toolCalls: rnd(2,10),
    errors: rnd(0,3),
    sessions: rnd(1,8),
  }));
}

export function makeSpans(session) {
  const colors = ["#4fc3f7","#81c784","#ffb74d","#ce93d8","#ef9a9a","#80cbc4"];
  const rows = [
    {name:"agent.session",              service:"agentbank-agent",                        start:0,           dur:session.latency,   depth:0},
    {name:"agent.tool_call."+session.tool, service:"agentbank-agent",                    start:rnd(20,80),  dur:rnd(200,600),      depth:1},
    {name:"bian.service.retrieve",      service:"SD-"+session.tool.split("_").slice(-1)[0], start:rnd(100,200),dur:rnd(80,300),    depth:2},
    {name:"core.ledger.read",           service:"core-banking",                           start:rnd(180,300),dur:rnd(30,120),       depth:3},
  ];
  return rows.map((r,i) => ({...r, color:colors[i%colors.length], status:Math.random()>0.05?"ok":"error"}));
}

export function makeTraceSteps(session) {
  const steps = [];
  let t = 0;
  steps.push({type:"sys",  t:t+=10,  text:`Session ${session.id} — model: ${session.model} — customer: ${session.customer}`});
  steps.push({type:"auth", t:t+=40,  text:`FAPI token validated. Scope: accounts:read payments:write`});
  for (let i = 0; i < session.toolCalls; i++) {
    const tool = OBS_TOOLS[rnd(0, OBS_TOOLS.length-1)];
    steps.push({type:"think", t:t+=rnd(80,280), text:`[Reasoning] Determining next action — ${rnd(200,800)} input tokens`});
    steps.push({type:"call",  t:t+=20,           text:`tool_use: ${tool}({ account_id: "ACC-${rnd(1000,9999)}" })`});
    steps.push({type:"ret",   t:t+=rnd(40,400),  text:`tool_result: { status: "ok", latency: ${rnd(40,400)}ms }`});
  }
  steps.push({type:"think", t:t+=200, text:`[Reasoning] Task complete. Composing response — ${rnd(100,500)} output tokens`});
  steps.push({type:"done",  t:t+=50,  text:`stop_reason: end_turn — total: ${session.inputTok} in / ${session.outputTok} out — ${session.latency}ms`});
  return steps;
}
