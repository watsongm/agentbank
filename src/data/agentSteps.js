export const AGENT_STEPS = [
  {id:1,title:"Authenticate and Load Profile",domain:"party",color:"#2563EB",icon:"SD-01",
   desc:"Agent authenticates via FAPI OAuth 2.0 and retrieves the customer verified party profile.",
   code:`// Step 1: Authenticate and retrieve party profile
import { AgentBankAgent } from "./sdk/index.js";

const agent = new AgentBankAgent({
  clientId: process.env.AGENT_CLIENT_ID,
  scope: "party:read accounts:read transactions:read savings:write payments:write"
});
const token = await agent.authenticate(); // FAPI PAR flow
const party = await agent.tools.get_party({ consent_token: token });
console.log(party.name, party.kycStatus);
// -> Aria Chen  VERIFIED`},
  {id:2,title:"Analyse Spending Patterns",domain:"transactions",color:"#7C3AED",icon:"SD-04",
   desc:"Agent fetches 90 days of transactions and uses the LLM to categorise discretionary spending.",
   code:`// Step 2: Retrieve and analyse 90 days of transactions
const txns = await agent.tools.get_transactions({
  account_id: "ACC-1829",
  from_date: "2025-12-24",
  to_date: "2026-03-24",
  limit: 200
});
// LLM categorises spend and finds savings opportunity
// -> discretionary: 487.20 GBP/mo  savingsOpportunity: 120 GBP`},
  {id:3,title:"Check Existing Savings",domain:"savings",color:"#0284C7",icon:"SD-07",
   desc:"Agent retrieves current savings balance, interest rate and goal progress.",
   code:`// Step 3: Retrieve savings position
const balance = await agent.tools.get_balance({
  account_id: "ACC-2041"  // savings account
});
// -> balance: 2150.00  goal: Holiday (3000 GBP)  monthsToGoal: 7`},
  {id:4,title:"Calculate Optimal Transfer",domain:"accounts",color:"#059669",icon:"SD-02",
   desc:"Agent checks current account balance and calculates a safe transfer leaving a 500 GBP buffer.",
   code:`// Step 4: Check current account and calculate safe transfer
const current = await agent.tools.get_balance({
  account_id: "ACC-1829"
});
// LLM reasons: balance 4821.50, avg spend 2180, buffer 500
// -> safeTransfer: 120.00 GBP`},
  {id:5,title:"Execute Savings Sweep",domain:"payments",color:"#D97706",icon:"SD-03",
   desc:"Agent initiates the payment from current account to savings with a full audit trail.",
   code:`// Step 5: Execute the savings sweep
const payment = await agent.tools.initiate_payment({
  debtor_account:   "ACC-1829",
  creditor_account: "ACC-2041",
  amount:    120.00,
  currency:  "GBP",
  reference: "AGENT-SAVINGS-SWEEP-2026-03"
});
// -> paymentId: PAY-7741920  status: AcceptedSettlementInProcess`},
  {id:6,title:"Subscribe to Future Events",domain:"notifications",color:"#DB2777",icon:"SD-10",
   desc:"Agent sets up a webhook to repeat the sweep automatically on each salary credit.",
   code:`// Step 6: Subscribe to salary credit events for monthly automation
const sub = await agent.tools.subscribe_events({
  party_id:    "PAR-ARIA",
  event_types: ["transaction.credit", "balance.threshold"],
  webhook_url: "https://savings-agent.agentbank.io/webhook"
});
// -> subscriptionId: SUB-88291  status: Active`},
];
