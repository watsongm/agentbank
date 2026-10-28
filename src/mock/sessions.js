export const OBS_TOOLS = [
  "get_party",
  "get_accounts",
  "get_balance",
  "get_transactions",
  "initiate_payment",
  "get_payment_status",
  "get_loan_details",
  "apply_for_loan",
  "get_card_details",
  "block_card",
  "get_portfolio",
  "place_order",
  "run_aml_screen",
  "subscribe_events",
];

export const OBS_CUSTOMERS = [
  "Aria Chen (PAR-ARIA)",
  "Mahliqa Patel (PAR-MAHLI)",
  "Devon Brooks (PAR-DEVON)",
];

export const OBS_MODELS = ["claude-opus-4-5", "claude-sonnet-4-6"];

const TOOL_BIAN_SERVICE = {
  get_party:          "SD-PartyReferenceData",
  get_accounts:       "SD-CurrentAccount",
  get_balance:        "SD-CurrentAccount",
  get_transactions:   "SD-AccountingTransactions",
  initiate_payment:   "SD-PaymentExecution",
  get_payment_status: "SD-PaymentExecution",
  get_loan_details:   "SD-ConsumerLoan",
  apply_for_loan:     "SD-ConsumerLoan",
  get_card_details:   "SD-CreditCard",
  block_card:         "SD-CreditCard",
  get_portfolio:      "SD-InvestmentPortfolio",
  place_order:        "SD-InvestmentPortfolio",
  run_aml_screen:     "SD-RegulatoryReporting",
  subscribe_events:   "SD-CustomerEventHistory",
};

const TOOL_SAMPLE_ARGS = {
  get_party:          '{ party_id: "PAR-ARIA" }',
  get_accounts:       '{ consent_scope: "accounts:read" }',
  get_balance:        '{ account_id: "ACC-1829" }',
  get_transactions:   '{ account_id: "ACC-1829", limit: 50 }',
  initiate_payment:   '{ debtor_account: "ACC-1829", creditor_account: "ACC-2041", amount: 120.00, currency: "GBP" }',
  get_payment_status: '{ payment_id: "PAY-70001" }',
  get_loan_details:   '{ loan_id: "LOAN-48291" }',
  apply_for_loan:     '{ party_id: "PAR-MAHLI", amount: 10000, term_months: 36, purpose: "HomeImprovement" }',
  get_card_details:   '{ card_id: "CRD-88421" }',
  block_card:         '{ card_id: "CRD-88421", action: "block" }',
  get_portfolio:      '{ portfolio_id: "PRT-29183" }',
  place_order:        '{ portfolio_id: "PRT-29183", instrument: "AAPL", quantity: 5, direction: "buy" }',
  run_aml_screen:     '{ subject_type: "party", subject_id: "PAR-ARIA" }',
  subscribe_events:   '{ party_id: "PAR-ARIA", event_types: ["transaction.credit", "balance.threshold"] }',
};

export function rnd(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

export function makeHex(len = 64) {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

export function makeSession(id) {
  const traceId = makeHex(16);
  const fapiId = `${traceId.slice(0, 8)}-b4a1-4b9c-9221-${traceId.slice(4, 16)}`;
  return {
    id: `SES-${String(id).padStart(5, "0")}`,
    traceId,
    fapiInteractionId: fapiId,
    prevHash: makeHex(64),
    rowHash: makeHex(64),
    customer: OBS_CUSTOMERS[rnd(0, OBS_CUSTOMERS.length - 1)],
    model: OBS_MODELS[rnd(0, 1)],
    tool: OBS_TOOLS[rnd(0, OBS_TOOLS.length - 1)],
    latency: rnd(180, 960),
    inputTok: rnd(800, 3800),
    outputTok: rnd(120, 1400),
    toolCalls: rnd(1, 5),
    status: Math.random() > 0.08 ? "success" : Math.random() > 0.5 ? "error" : "timeout",
    ts: Date.now(),
    source: "simulated",
  };
}

export function makeHistory() {
  return Array.from({ length: 20 }, (_, i) => ({
    t: `${String(i).padStart(2, "0")}:00`,
    latency: rnd(200, 850),
    inputTok: rnd(1200, 3800),
    outputTok: rnd(200, 1500),
    toolCalls: rnd(2, 8),
    errors: rnd(0, 2),
    sessions: rnd(2, 8),
  }));
}

export function makeSpans(session) {
  const colors = ["#4fc3f7", "#81c784", "#ffb74d", "#ce93d8", "#ef9a9a", "#80cbc4"];
  const bianSvc = TOOL_BIAN_SERVICE[session.tool] || `SD-${session.tool.split("_").slice(-1)[0]}`;
  const totalDur = Math.max(session.latency || 260, 120);
  const toolStart = Math.round(totalDur * 0.12);
  const toolDur = Math.round(totalDur * 0.76);
  const bianStart = Math.round(totalDur * 0.24);
  const bianDur = Math.round(totalDur * 0.52);
  const ledgerStart = Math.round(totalDur * 0.36);
  const ledgerDur = Math.round(totalDur * 0.28);

  const rows = [
    { name: "agent.session",                   service: "agentbank-agent", start: 0,           dur: totalDur,   depth: 0 },
    { name: `agent.tool_call.${session.tool}`, service: "mcp-tool-router", start: toolStart,   dur: toolDur,    depth: 1 },
    { name: "bian.service.execute",            service: bianSvc,           start: bianStart,   dur: bianDur,    depth: 2 },
    { name: "core.ledger.audit_chain_commit",  service: "core-banking-db", start: ledgerStart, dur: ledgerDur,  depth: 3 },
  ];
  return rows.map((r, i) => ({
    ...r,
    color: colors[i % colors.length],
    status: session.status === "error" && i === rows.length - 1 ? "error" : "ok",
  }));
}

export function makeTraceSteps(session) {
  const steps = [];
  let t = 0;
  const fapiId = session.fapiInteractionId || session.traceId;
  const rowHashShort = (session.rowHash || makeHex(64)).slice(0, 16);
  steps.push({
    type: "sys",
    t: (t += 10),
    text: `Session ${session.id} — model: ${session.model} — customer: ${session.customer}`,
  });
  steps.push({
    type: "auth",
    t: (t += 35),
    text: `FAPI 2.0 DPoP token verified · x-fapi-interaction-id: ${fapiId.slice(0, 22)}…`,
  });

  const count = Math.max(1, session.toolCalls || 1);
  for (let i = 0; i < count; i++) {
    const tool = i === 0 ? session.tool : OBS_TOOLS[(OBS_TOOLS.indexOf(session.tool) + i) % OBS_TOOLS.length];
    const args = TOOL_SAMPLE_ARGS[tool] || '{ account_id: "ACC-1829" }';
    const bian = TOOL_BIAN_SERVICE[tool] || "SD-CurrentAccount";
    steps.push({
      type: "think",
      t: (t += rnd(60, 180)),
      text: `[Reasoning] Selecting ${tool} (${bian}) — ${rnd(180, 620)} input tokens`,
    });
    steps.push({
      type: "call",
      t: (t += 18),
      text: `tool_use: ${tool}(${args})`,
    });
    steps.push({
      type: "ret",
      t: (t += rnd(45, 220)),
      text: `tool_result: { status: "${session.status === "error" ? "error" : "200 OK"}", domain: "${bian}", sha256: "${rowHashShort}…" }`,
    });
  }
  steps.push({
    type: "think",
    t: (t += 120),
    text: `[Reasoning] Audit chain verified. Synthesizing customer response — ${session.outputTok} output tokens`,
  });
  steps.push({
    type: "done",
    t: (t += 30),
    text: `stop_reason: end_turn — total: ${session.inputTok} in / ${session.outputTok} out — ${session.latency}ms`,
  });
  return steps;
}
