// In-memory mock API for the agentBANK frontend showcase.
// Replace mockApi() calls with real fetch() calls against the backend
// (http://localhost:3000) to use the live data instead.
//
// Route matching uses an explicit table ordered most-specific first.
// Each entry has: method (optional), pattern (regex), and handler (function).
// The first match wins — no order-sensitive substring surprises.

import { SEED } from "./constants.js";

const rand5  = () => Math.floor(Math.random() * 90_000 + 10_000);
const rand7  = () => Math.floor(Math.random() * 9_000_000 + 1_000_000);
const now    = () => new Date().toISOString();

const ROUTES = [
  // ── Payments ────────────────────────────────────────────────────────────
  {
    method:  "POST",
    pattern: /domestic-payments/,
    handler: () => ({
      domesticPaymentId: `PAY-${rand7()}`,
      status:            "AcceptedSettlementInProcess",
      amount:            "500.00",
      currency:          "GBP",
    }),
  },

  // ── Lending ─────────────────────────────────────────────────────────────
  {
    method:  "POST",
    pattern: /consumer-loan/,
    handler: () => ({
      loanId:            `LN-${rand5()}`,
      status:            "UnderReview",
      requestedAmount:   10_000,
      indicativeRate:    "6.9%",
    }),
  },
  {
    pattern: /consumer-loan/,
    handler: () => ({
      loanId:            "LN-48291",
      status:            "Active",
      outstandingBalance: 7842.33,
      interestRate:      "6.9%",
      nextPaymentDate:   "2026-04-01",
    }),
  },

  // ── Cards ────────────────────────────────────────────────────────────────
  {
    method:  "POST",
    pattern: /credit-card/,
    handler: () => ({
      cardId:   `CRD-${rand5()}`,
      status:   "ApplicationReceived",
      cardType: "Visa Platinum",
    }),
  },
  {
    pattern: /credit-card/,
    handler: () => ({
      cardId:          SEED.ARIA_CARD_REF,
      status:          "Active",
      last4:           "4291",
      cardType:        "Visa Platinum",
      creditLimit:     5000,
      availableCredit: 3241.80,
    }),
  },

  // ── Compliance ───────────────────────────────────────────────────────────
  {
    pattern: /aml/,
    handler: () => ({
      screeningId:  `AML-${rand5()}`,
      status:       "Clear",
      riskScore:    12,
      matchesFound: 0,
    }),
  },
  {
    pattern: /regulatory/,
    handler: () => ({
      reportId:   `REG-${rand5()}`,
      status:     "Submitted",
      reportType: "SARReport",
    }),
  },

  // ── Notifications ────────────────────────────────────────────────────────
  {
    pattern: /webhook|event/,
    handler: () => ({
      subscriptionId: `SUB-${rand5()}`,
      status:         "Active",
      eventTypes:     ["payment.completed", "balance.low"],
    }),
  },

  // ── Investments ──────────────────────────────────────────────────────────
  {
    pattern: /investment/,
    handler: () => ({
      portfolioId:    SEED.ARIA_PORTFOLIO_REF,
      totalValue:     48_291.44,
      currency:       "GBP",
      performanceYTD: "+8.4%",
      holdings:       [{ instrument: "AAPL", quantity: 12, currentValue: 2841.60 }],
    }),
  },

  // ── Savings ──────────────────────────────────────────────────────────────
  {
    pattern: /savings/,
    handler: () => ({
      accountId:    "SAV-19284",
      status:       "Active",
      balance:      12_500.00,
      interestRate: "4.75%",
      maturityDate: "2026-12-01",
    }),
  },

  // ── Party ────────────────────────────────────────────────────────────────
  {
    pattern: /party/,
    handler: () => ({
      partyId:     SEED.ARIA_PARTY_REF,
      name:        "Aria Chen",
      kycStatus:   "VERIFIED",
      riskRating:  "LOW",
      nationality: "GBR",
    }),
  },

  // ── Accounts — balance before list (more specific path) ──────────────────
  {
    pattern: /balance/,
    handler: () => ({
      accountId:  SEED.ARIA_CURRENT_REF,
      available:  4821.50,
      currency:   "GBP",
      dateTime:   now(),
    }),
  },
  {
    pattern: /transactions/,
    handler: () => ({
      transactions: [
        { id: "TXN-001", amount: -42.50,   description: "TESCO STORES",   bookingDateTime: "2026-03-22T14:23:00Z" },
        { id: "TXN-002", amount:  2500.00, description: "SALARY PAYMENT", bookingDateTime: "2026-03-20T08:00:00Z" },
      ],
    }),
  },
  {
    pattern: /accounts/,
    handler: () => ({
      accounts: [
        { accountId: SEED.ARIA_CURRENT_REF, accountSubType: "CurrentAccount", currency: "GBP" },
        { accountId: SEED.ARIA_SAVINGS_REF, accountSubType: "Savings",        currency: "GBP" },
      ],
    }),
  },
];

/**
 * Return a mock response for the given HTTP method + path.
 * Matches the first route where method (if specified) and pattern both match.
 */
export function mockApi(method, path) {
  const route = ROUTES.find(
    (r) => (!r.method || r.method === method) && r.pattern.test(path),
  );
  return route
    ? route.handler()
    : { status: "success", message: "Operation completed", timestamp: now() };
}

/**
 * Return a pre-filled request body string for the API console.
 * Uses PascalCase OB envelope to match the real backend schema.
 */
export function defaultBody(method, path) {
  if (method === "GET") return "";

  if (/domestic-payments/.test(path)) {
    return JSON.stringify({
      Data: {
        Initiation: {
          InstructionIdentification: "INSTR-001",
          InstructedAmount: { Amount: "500.00", Currency: "GBP" },
          DebtorAccount:    { Identification: SEED.ARIA_CURRENT_REF, SchemeName: "IBAN" },
          CreditorAccount:  { Identification: "GB29NWBK60161331926819", SchemeName: "IBAN" },
          RemittanceInformation: { Reference: "INV-2241" },
        },
      },
      Risk: {},
    }, null, 2);
  }

  if (/consumer-loan\/initiate/.test(path)) {
    return JSON.stringify({
      partyId:         SEED.ARIA_PARTY_REF,
      requestedAmount: 10_000,
      currency:        "GBP",
      termMonths:      36,
      purpose:         "HomeImprovement",
    }, null, 2);
  }

  if (/payment-execution\/initiate/.test(path)) {
    return JSON.stringify({
      paymentType:     "DomesticCredit",
      amount:          { value: 500, currency: "GBP" },
      debtorAccountId: SEED.ARIA_CURRENT_REF,
      creditorIBAN:    "GB29NWBK60161331926819",
    }, null, 2);
  }

  if (/webhook/.test(path)) {
    return JSON.stringify({
      partyId:    SEED.ARIA_PARTY_REF,
      eventTypes: ["payment.completed", "balance.low"],
      webhookUrl: "https://your-agent.example.com/events",
    }, null, 2);
  }

  return JSON.stringify({ note: "Add request body here" }, null, 2);
}
