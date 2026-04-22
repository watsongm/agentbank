export const AGENT_BUILDS = [
  {
    id:"loan-prequalify",
    icon:"◆", color:"#ef9a9a",
    name:"Loan Pre-qualification",
    desc:"Analyses account health, income patterns, and existing obligations to pre-qualify a customer — without a hard credit check.",
    tags:["lending","accounts","transactions"],
    code:`// Loan Pre-qualification Agent
import { AgentBankAgent } from "./sdk/index.js";

const agent = new AgentBankAgent({
  scope: "accounts:read transactions:read lending:write"
});
const token = await agent.authenticate();

// 1. Pull financial profile
const [party, accounts] = await Promise.all([
  agent.tools.get_party({ consent_token: token }),
  agent.tools.get_accounts({ consent_token: token }),
]);

// 2. Analyse 6 months of income and expenditure
const txns = await agent.tools.get_transactions({
  account_id: accounts[0].accountId,
  from_date: "2025-09-01", to_date: "2026-03-01", limit: 500,
});
// LLM derives: avgMonthlyIncome: 4200, avgExpenditure: 2840, dsr: 0.32

// 3. Check existing loan obligations
const loan = await agent.tools.get_loan_details({ loan_id: "LN-48291" });
// -> outstandingBalance: 7842.33  interestRate: "6.9%"

// 4. Submit pre-qualification
const result = await agent.tools.apply_for_loan({
  party_id: party.partyId,
  amount: 15000, currency: "GBP", term_months: 48, purpose: "HomeImprovement",
});
// -> loanId: "LN-92841"  status: "PreQualified"  indicativeRate: "7.2%"`,
  },
  {
    id:"fraud-sentinel",
    icon:"⬟", color:"#ffcc80",
    name:"Fraud Sentinel",
    desc:"Monitors real-time transactions for anomalous patterns, runs AML screening, and autonomously blocks the card when risk threshold is breached.",
    tags:["transactions","compliance","cards"],
    code:`// Fraud Sentinel Agent — triggered via webhook
import { AgentBankAgent } from "./sdk/index.js";

export async function onTransactionEvent(event) {
  const agent = new AgentBankAgent({
    scope: "transactions:read compliance:write cards:write"
  });

  // 1. Fetch recent transaction context
  const txns = await agent.tools.get_transactions({
    account_id: event.accountId,
    from_date: subDays(new Date(), 7), limit: 50,
  });
  // LLM flags: 3 overseas txns in 10 min, avg amount +800% above baseline

  // 2. Run AML / sanctions screen
  const screen = await agent.tools.run_aml_screen({
    subject_type: "transaction", subject_id: event.transactionId,
  });
  // -> riskScore: 87  status: "Review"  matchesFound: 1

  if (screen.riskScore > 75) {
    // 3. Block card immediately
    await agent.tools.block_card({
      card_id: event.cardId, action: "block",
    });
    // -> status: "Blocked"  reason: "AML threshold exceeded"
    // Customer notified via CustomerNotifications webhook
  }
}`,
  },
  {
    id:"portfolio-rebalancer",
    icon:"△", color:"#b39ddb",
    name:"Portfolio Rebalancer",
    desc:"Retrieves current allocation, compares against target weights, and places buy/sell orders to rebalance within configured drift thresholds.",
    tags:["investments","accounts"],
    code:`// Portfolio Rebalancing Agent — runs monthly
import { AgentBankAgent } from "./sdk/index.js";

const agent = new AgentBankAgent({
  scope: "investments:read investments:write"
});
await agent.authenticate();

// 1. Retrieve current holdings
const portfolio = await agent.tools.get_portfolio({
  portfolio_id: "PRT-29183"
});
// -> totalValue: 48291.44  performanceYTD: "+8.4%"
// holdings: [{ instrument:"AAPL", weight:0.31, target:0.25 }, ...]

// 2. LLM calculates drift vs target allocation
// AAPL: 31% actual vs 25% target → SELL 6%  (~2897 GBP)
// BONDS: 18% actual vs 25% target → BUY 7%  (~3380 GBP)

// 3. Place rebalancing orders (fractional quantities supported)
await agent.tools.place_order({
  portfolio_id: "PRT-29183",
  instrument: "AAPL", quantity: 12.5, direction: "sell",
});
await agent.tools.place_order({
  portfolio_id: "PRT-29183",
  instrument: "VGOV", quantity: 34, direction: "buy",
});
// -> orders submitted  estimatedSettlement: "T+2"`,
  },
  {
    id:"wealth-summary",
    icon:"◉", color:"#fff176",
    name:"Wealth Summary",
    desc:"Aggregates balances across current, savings, and investment accounts to produce a structured financial health report with actionable insights.",
    tags:["accounts","savings","investments","transactions"],
    code:`// Wealth Summary Agent — on-demand report
import { AgentBankAgent } from "./sdk/index.js";

const agent = new AgentBankAgent({
  scope: "accounts:read savings:read investments:read transactions:read"
});
const token = await agent.authenticate();

// 1. Fetch all balances in parallel
const [current, savings, portfolio, txns] = await Promise.all([
  agent.tools.get_balance({ account_id: "ACC-1829" }),
  agent.tools.get_balance({ account_id: "ACC-2041" }),
  agent.tools.get_portfolio({ portfolio_id: "PRT-29183" }),
  agent.tools.get_transactions({
    account_id: "ACC-1829", from_date: "2026-01-01", limit: 200
  }),
]);

// 2. LLM synthesises health report
// {
//   netWorth:       63612.94 GBP,
//   liquidAssets:   17321.50 GBP,
//   investedAssets: 48291.44 GBP,
//   monthlyInflow:   4200.00 GBP,
//   savingsRate:        "18%",
//   insights: [
//     "Savings goal on track — 6 months to Holiday target",
//     "Portfolio up 8.4% YTD — consider rebalancing AAPL",
//     "Discretionary spend 12% above 3-month average"
//   ]
// }`,
  },
  {
    id:"bill-pay-automator",
    icon:"⟳", color:"#ffb74d",
    name:"Bill Pay Automator",
    desc:"Detects recurring bill patterns from transaction history, verifies sufficient balance, and schedules forward payments with a configurable buffer.",
    tags:["transactions","payments","accounts"],
    code:`// Bill Pay Automator Agent — runs weekly
import { AgentBankAgent } from "./sdk/index.js";

const agent = new AgentBankAgent({
  scope: "accounts:read transactions:read payments:write"
});
await agent.authenticate();

// 1. Scan 3 months of history for recurring debits
const txns = await agent.tools.get_transactions({
  account_id: "ACC-1829",
  from_date: "2025-12-01", to_date: "2026-03-01", limit: 300,
});
// LLM identifies recurring bills:
// [{ payee: "THAMES WATER", amount: 48.50, dueDate: "2026-04-14" },
//  { payee: "BT BROADBAND",  amount: 35.00, dueDate: "2026-04-16" }, ...]

// 2. Verify balance covers upcoming bills + 500 GBP buffer
const balance = await agent.tools.get_balance({ account_id: "ACC-1829" });
// -> available: 4821.50  required: 249.00  buffer: 500  ✓ safe

// 3. Schedule payments
for (const bill of upcomingBills) {
  await agent.tools.initiate_payment({
    debtor_account:   "ACC-1829",
    creditor_account: bill.creditorIBAN,
    amount:    bill.amount, currency: "GBP",
    reference: \`AUTO-\${bill.payee}-\${bill.dueDate}\`,
  });
}
// -> 5 payments scheduled  totalAmount: 249.00 GBP`,
  },
];
