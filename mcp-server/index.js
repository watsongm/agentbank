/**
 * agentBANK MCP Server
 *
 * Exposes all 14 agentBANK tool functions as Model Context Protocol tools,
 * allowing any MCP-compatible client (Claude Desktop, Cursor, etc.) to call
 * them directly using stdio transport.
 *
 * Configuration (environment variables):
 *   AGENTBANK_BASE_URL   Base URL of the agentBANK API  (default: http://localhost:3000)
 *   AGENTBANK_TOKEN      Bearer token for authentication (default: demo-token)
 *
 * Claude Desktop config (~/.claude/claude_desktop_config.json):
 * {
 *   "mcpServers": {
 *     "agentbank": {
 *       "command": "node",
 *       "args": ["/absolute/path/to/mcp-server/index.js"],
 *       "env": {
 *         "AGENTBANK_BASE_URL": "https://your-agentbank-instance.example.com",
 *         "AGENTBANK_TOKEN": "Bearer eyJhbGci..."
 *       }
 *     }
 *   }
 * }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = process.env.AGENTBANK_BASE_URL ?? "http://localhost:3000";
const TOKEN    = process.env.AGENTBANK_TOKEN    ?? "demo-token";

const server = new McpServer({
  name: "agentbank",
  version: "1.0.0",
});

/* ─────────────────────────────────────────────
   HTTP helper — 10s timeout per attempt, 2 retries with 500ms backoff
───────────────────────────────────────────── */
async function apiCall(method, path, body, extraHeaders = {}) {
  let lastError;
  for (let attempt = 0; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
          "Authorization": TOKEN.startsWith("Bearer ") ? TOKEN : `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
          "x-fapi-interaction-id": crypto.randomUUID(),
          ...extraHeaders,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`agentBANK API error ${res.status}: ${text}`);
      }
      return res.json();
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      if (err.name === "AbortError" || attempt === 2) break;
      await new Promise(r => setTimeout(r, 500));
    }
  }
  throw lastError;
}

function ok(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function consentHeaders(consent_token) {
  const auth = consent_token.startsWith("Bearer ") ? consent_token : `Bearer ${consent_token}`;
  return { "Authorization": auth };
}

/* ─────────────────────────────────────────────
   PARTY
───────────────────────────────────────────── */
server.tool(
  "get_party",
  "Retrieve the authenticated customer profile including KYC status and risk rating.",
  { consent_token: z.string().describe("FAPI consent token obtained during OAuth flow") },
  async ({ consent_token }) => {
    const data = await apiCall("GET", "/open-banking/v3.1/party", null, consentHeaders(consent_token));
    return ok(data);
  }
);

/* ─────────────────────────────────────────────
   ACCOUNTS
───────────────────────────────────────────── */
server.tool(
  "get_accounts",
  "List all accounts in scope for the given consent token.",
  { consent_token: z.string().describe("FAPI consent token") },
  async ({ consent_token }) => {
    const data = await apiCall("GET", "/open-banking/v3.1/accounts", null, consentHeaders(consent_token));
    return ok(data);
  }
);

server.tool(
  "get_balance",
  "Retrieve the real-time available balance for a specific account.",
  { account_id: z.string().describe("The account identifier, e.g. ACC-1829") },
  async ({ account_id }) => {
    const data = await apiCall("GET", `/bian/current-account/${account_id}/balance`, null);
    return ok(data);
  }
);

/* ─────────────────────────────────────────────
   TRANSACTIONS
───────────────────────────────────────────── */
server.tool(
  "get_transactions",
  "Retrieve paginated transaction history for an account within a date range.",
  {
    account_id: z.string().describe("Account identifier"),
    from_date:  z.string().describe("Start date in YYYY-MM-DD format"),
    to_date:    z.string().describe("End date in YYYY-MM-DD format"),
    limit:      z.number().int().min(1).max(500).default(100).describe("Maximum number of transactions to return"),
    cursor:     z.string().optional().describe("Pagination cursor from previous response's next_cursor field"),
  },
  async ({ account_id, from_date, to_date, limit, cursor }) => {
    const params = new URLSearchParams({ fromBookingDateTime: from_date, toBookingDateTime: to_date, limit });
    if (cursor) params.set("cursor", cursor);
    const data = await apiCall("GET", `/open-banking/v3.1/accounts/${account_id}/transactions?${params}`, null);
    return ok(data);
  }
);

/* ─────────────────────────────────────────────
   PAYMENTS
───────────────────────────────────────────── */
server.tool(
  "initiate_payment",
  "Create and submit a domestic payment instruction.",
  {
    debtor_account:    z.string().describe("Source account identifier"),
    creditor_account:  z.string().describe("Destination account identifier or IBAN"),
    amount:            z.number().positive().describe("Payment amount"),
    currency:          z.string().length(3).describe("ISO 4217 currency code, e.g. GBP"),
    reference:         z.string().describe("Payment reference / narrative"),
  },
  async ({ debtor_account, creditor_account, amount, currency, reference }) => {
    const data = await apiCall("POST", "/open-banking/v3.1/domestic-payments", {
      data: {
        initiation: {
          instructionIdentification: `MCP-${Date.now()}`,
          instructedAmount: { amount: String(amount), currency },
          debtorAccount:    { identification: debtor_account,   schemeName: "IBAN" },
          creditorAccount:  { identification: creditor_account, schemeName: "IBAN" },
          remittanceInformation: { reference },
        },
      },
      risk: {},
    });
    return ok(data);
  }
);

server.tool(
  "get_payment_status",
  "Check the execution status of a previously submitted payment.",
  { payment_id: z.string().describe("Payment identifier returned by initiate_payment") },
  async ({ payment_id }) => {
    const data = await apiCall("GET", `/open-banking/v3.1/domestic-payments/${payment_id}`, null);
    return ok(data);
  }
);

/* ─────────────────────────────────────────────
   LENDING
───────────────────────────────────────────── */
server.tool(
  "get_loan_details",
  "Retrieve loan account details and full repayment schedule.",
  { loan_id: z.string().describe("Loan identifier, e.g. LN-48291") },
  async ({ loan_id }) => {
    const data = await apiCall("GET", `/bian/consumer-loan/${loan_id}/retrieve`, null);
    return ok(data);
  }
);

server.tool(
  "apply_for_loan",
  "Submit a new loan application for a customer.",
  {
    party_id:     z.string().describe("Customer party identifier"),
    amount:       z.number().positive().describe("Requested loan amount"),
    currency:     z.string().length(3).default("GBP").describe("ISO 4217 currency code (default: GBP)"),
    term_months:  z.number().int().min(1).max(360).describe("Loan term in months"),
    purpose:      z.string().describe("Loan purpose, e.g. HomeImprovement, CarPurchase, Consolidation"),
  },
  async ({ party_id, amount, currency, term_months, purpose }) => {
    const data = await apiCall("POST", "/bian/consumer-loan/initiate", {
      partyId: party_id,
      requestedAmount: amount,
      currency,
      termMonths: term_months,
      purpose,
    });
    return ok(data);
  }
);

/* ─────────────────────────────────────────────
   CARDS
───────────────────────────────────────────── */
server.tool(
  "get_card_details",
  "Retrieve card information including type, status, credit limit, and available credit.",
  { card_id: z.string().describe("Card identifier, e.g. CRD-88421") },
  async ({ card_id }) => {
    const data = await apiCall("GET", `/bian/credit-card/${card_id}/retrieve`, null);
    return ok(data);
  }
);

server.tool(
  "block_card",
  "Block or unblock a payment card. Use action='block' to freeze, 'unblock' to restore.",
  {
    card_id: z.string().describe("Card identifier"),
    action:  z.enum(["block", "unblock"]).describe("The action to perform on the card"),
  },
  async ({ card_id, action }) => {
    const data = await apiCall("POST", `/bian/credit-card/${card_id}/request`, { action });
    return ok(data);
  }
);

/* ─────────────────────────────────────────────
   INVESTMENTS
───────────────────────────────────────────── */
server.tool(
  "get_portfolio",
  "Retrieve investment portfolio holdings, total value, and year-to-date performance.",
  { portfolio_id: z.string().describe("Portfolio identifier, e.g. PRT-29183") },
  async ({ portfolio_id }) => {
    const data = await apiCall("GET", `/bian/investment-portfolio/${portfolio_id}/retrieve`, null);
    return ok(data);
  }
);

server.tool(
  "place_order",
  "Place a buy or sell order for a financial instrument within a portfolio. Supports fractional quantities.",
  {
    portfolio_id: z.string().describe("Portfolio identifier"),
    instrument:   z.string().describe("Instrument ticker or ISIN, e.g. AAPL or GB00B16GWD56"),
    quantity:     z.number().positive().describe("Number of units to buy or sell (fractional quantities supported)"),
    direction:    z.enum(["buy", "sell"]).describe("Order direction"),
  },
  async ({ portfolio_id, instrument, quantity, direction }) => {
    const data = await apiCall("POST", `/bian/investment-portfolio/${portfolio_id}/request`, {
      instrument, quantity, direction,
    });
    return ok(data);
  }
);

/* ─────────────────────────────────────────────
   COMPLIANCE
───────────────────────────────────────────── */
server.tool(
  "run_aml_screen",
  "Run AML and sanctions screening against a party or transaction.",
  {
    subject_type: z.enum(["party", "transaction"]).describe("What is being screened"),
    subject_id:   z.string().describe("The party or transaction identifier to screen"),
  },
  async ({ subject_type, subject_id }) => {
    const data = await apiCall("POST", "/bian/aml-screening/evaluate", {
      subjectType: subject_type,
      subjectId:   subject_id,
    });
    return ok(data);
  }
);

/* ─────────────────────────────────────────────
   NOTIFICATIONS
───────────────────────────────────────────── */
server.tool(
  "subscribe_events",
  "Subscribe an agent webhook to real-time account events such as credits, debits, and balance alerts.",
  {
    party_id:    z.string().describe("Customer party identifier"),
    event_types: z.array(z.string()).describe("Event types to subscribe to, e.g. ['transaction.credit', 'balance.threshold']"),
    webhook_url: z.string().url().describe("HTTPS endpoint that will receive event payloads"),
  },
  async ({ party_id, event_types, webhook_url }) => {
    // FAPI webhook ownership verification: generate a challenge token and include
    // it in the subscription request. The server is expected to POST the challenge
    // to webhook_url and verify the echo before activating the subscription.
    const verificationToken = crypto.randomUUID();
    const data = await apiCall("POST", "/bian/customer-event-history/webhook", {
      partyId: party_id,
      eventTypes: event_types,
      webhookUrl: webhook_url,
      verificationToken,
    });
    return ok(data);
  }
);

/* ─────────────────────────────────────────────
   Start server
───────────────────────────────────────────── */
const transport = new StdioServerTransport();
await server.connect(transport);
