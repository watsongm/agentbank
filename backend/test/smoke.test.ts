// Smoke test suite — boots the server in-process and hits the live endpoints.
// Requires DATABASE_URL pointing at a Postgres with the schema applied and
// seed data loaded (npx prisma db push && npm run db:seed).
// Skipped automatically when DATABASE_URL is absent so the suite does not
// break local typecheck-only runs or CI jobs that only typecheck the frontend.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SEED } from "../src/lib/constants.js";

const HAS_DB = !!process.env.DATABASE_URL;

// Auth header sent on every authenticated request (Phase 3).
// Matches the "demo-token" accepted by authPlugin in lib/auth.ts.
const AUTH = { authorization: "Bearer demo-token" };

describe.skipIf(!HAS_DB)("agentBANK backend smoke", () => {
  let app: Awaited<ReturnType<(typeof import("../src/server.js"))["buildServer"]>>;

  beforeAll(async () => {
    const mod = await import("../src/server.js");
    app = await mod.buildServer();
    await app.ready();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  // ── Public endpoints (no auth required) ────────────────────────────────────

  it("GET /health returns ok and reports postgres reachable", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { status: string; db: string };
    expect(body.status).toBe("ok");
    expect(body.db).toBe("connected");
  });

  it("GET /health propagates x-fapi-interaction-id without auth", async () => {
    const id = `test-fapi-${Date.now()}`;
    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: { "x-fapi-interaction-id": id },
    });
    expect(res.headers["x-fapi-interaction-id"]).toBe(id);
  });

  // ── Auth gate (Phase 3) ─────────────────────────────────────────────────────

  it("returns 401 when Authorization header is absent", async () => {
    const res = await app.inject({ method: "GET", url: "/open-banking/v3.1/party" });
    expect(res.statusCode).toBe(401);
    expect((res.json() as { Code: string }).Code).toBe("Unauthorized");
  });

  it("returns 401 when token is invalid", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/open-banking/v3.1/party",
      headers: { authorization: "Bearer bad-token-xyz" },
    });
    expect(res.statusCode).toBe(401);
  });

  // ── Domain 1: Party ────────────────────────────────────────────────────────

  it("GET /open-banking/v3.1/party returns the seeded authenticated party", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/open-banking/v3.1/party",
      headers: AUTH,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { Data: { Party: { legalName: string; kycStatus: string } } };
    expect(body.Data.Party.legalName).toBeDefined();
    expect(body.Data.Party.kycStatus).toBe("VERIFIED");
  });

  // ── Domain 2: Accounts ─────────────────────────────────────────────────────

  it("GET /open-banking/v3.1/accounts lists at least one account", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/open-banking/v3.1/accounts",
      headers: AUTH,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { Data: { Account: Array<{ accountRef: string }> } };
    expect(body.Data.Account.length).toBeGreaterThan(0);
  });

  it("GET balance for ACC-1829 returns Aria's seeded balance", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/bian/current-account/${SEED.ARIA_CURRENT_REF}/balance`,
      headers: AUTH,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { accountBalance: { available: string; currency: string } };
    expect(body.accountBalance.currency).toBe("GBP");
    expect(Number(body.accountBalance.available)).toBeGreaterThan(0);
  });

  it("POST /bian/current-account/initiate and PUT /bian/current-account/:accountId/update create and update a current account", async () => {
    const initRes = await app.inject({
      method: "POST",
      url: "/bian/current-account/initiate",
      headers: AUTH,
      payload: {
        partyId: SEED.ARIA_PARTY_REF,
        productName: "Agent Cash Management",
        currency: "GBP",
        overdraftLimit: 500,
      },
    });
    expect(initRes.statusCode).toBe(201);
    const created = (
      initRes.json() as {
        currentAccountFacility: { accountRef: string; overdraftLimit: string };
      }
    ).currentAccountFacility;
    expect(created.accountRef).toMatch(/^ACC-/);

    const updateRes = await app.inject({
      method: "PUT",
      url: `/bian/current-account/${created.accountRef}/update`,
      headers: AUTH,
      payload: {
        productName: "Agent Cash Management Plus",
        overdraftLimit: 1000,
      },
    });
    expect(updateRes.statusCode).toBe(200);
    const updated = (
      updateRes.json() as {
        currentAccountFacility: { productName: string; overdraftLimit: string };
      }
    ).currentAccountFacility;
    expect(updated.productName).toBe("Agent Cash Management Plus");
    expect(Number(updated.overdraftLimit)).toBe(1000);
  });

  // ── Domain 4: Transactions ─────────────────────────────────────────────────

  it("transactions list returns paginated items with cursor", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/open-banking/v3.1/accounts/${SEED.ARIA_CURRENT_REF}/transactions?limit=10`,
      headers: AUTH,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { Data: { Transaction: unknown[] }; Links: { Next?: string } };
    expect(body.Data.Transaction).toHaveLength(10);
    expect(body.Links.Next).toBeDefined();
  });

  it("GET /open-banking/v3.1/accounts/ACC-1829/transactions with fromBookingDateTime and limit=5 returns next_cursor", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/open-banking/v3.1/accounts/${SEED.ARIA_CURRENT_REF}/transactions?fromBookingDateTime=2020-01-01&limit=5`,
      headers: AUTH,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      Data: { Transaction: unknown[] };
      next_cursor: string | null;
    };
    expect(body.Data.Transaction).toHaveLength(5);
    expect(body.next_cursor).toBeTruthy();
  });

  // ── Domain 3: Payments — Phase 4 ───────────────────────────────────────────

  it("POST /open-banking/v3.1/domestic-payments initiates a payment and returns PAY ref", async () => {
    // Resolve debtor and creditor from seeded accounts
    const acctRes = await app.inject({
      method: "GET",
      url: "/open-banking/v3.1/accounts",
      headers: AUTH,
    });
    const accounts = (
      acctRes.json() as { Data: { Account: Array<{ accountRef: string }> } }
    ).Data.Account;
    expect(accounts.length).toBeGreaterThanOrEqual(2);

    const [debtor, creditor] = accounts as [{ accountRef: string }, { accountRef: string }];
    const fapiId = `smoke-pay-${Date.now()}`;

    const res = await app.inject({
      method: "POST",
      url: "/open-banking/v3.1/domestic-payments",
      headers: { ...AUTH, "x-fapi-interaction-id": fapiId },
      payload: {
        Data: {
          Initiation: {
            InstructionIdentification: `SMOKE-${Date.now()}`,
            InstructedAmount: { Amount: "1.00", Currency: "GBP" },
            DebtorAccount:    { Identification: debtor.accountRef },
            CreditorAccount:  { Identification: creditor.accountRef, Name: "Smoke test" },
            RemittanceInformation: { Reference: "SMOKE-TEST" },
          },
        },
        Risk: {},
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json() as { Data: { DomesticPaymentId: string; Status: string } };
    expect(body.Data.DomesticPaymentId).toMatch(/^PAY-/);
    expect(body.Data.Status).toBe("AcceptedSettlementCompleted");
  });

  it("POST /domestic-payments is idempotent for the same x-fapi-interaction-id", async () => {
    const acctRes = await app.inject({
      method: "GET",
      url: "/open-banking/v3.1/accounts",
      headers: AUTH,
    });
    const accounts = (
      acctRes.json() as { Data: { Account: Array<{ accountRef: string }> } }
    ).Data.Account;
    const [debtor, creditor] = accounts as [{ accountRef: string }, { accountRef: string }];

    // Use a stable FAPI ID that is unique per test run
    const fapiId = `idempotency-${Date.now()}`;
    const payload = {
      Data: {
        Initiation: {
          InstructionIdentification: `IDEM-${Date.now()}`,
          InstructedAmount: { Amount: "0.50", Currency: "GBP" },
          DebtorAccount:    { Identification: debtor.accountRef },
          CreditorAccount:  { Identification: creditor.accountRef, Name: "Idempotency test" },
          RemittanceInformation: { Reference: "IDEM-TEST" },
        },
      },
      Risk: {},
    };
    const opts = { method: "POST" as const, url: "/open-banking/v3.1/domestic-payments", headers: { ...AUTH, "x-fapi-interaction-id": fapiId }, payload };

    const r1 = await app.inject(opts);
    const r2 = await app.inject(opts);

    expect(r1.statusCode).toBe(201);
    expect(r2.statusCode).toBe(201);
    // Both responses must carry the same payment ref — not two separate payments
    const id1 = (r1.json() as { Data: { DomesticPaymentId: string } }).Data.DomesticPaymentId;
    const id2 = (r2.json() as { Data: { DomesticPaymentId: string } }).Data.DomesticPaymentId;
    expect(id1).toBe(id2);
  });

  // ── Negative paths — Phase 4 ───────────────────────────────────────────────

  it("returns 400 for insufficient funds", async () => {
    const acctRes = await app.inject({
      method: "GET",
      url: "/open-banking/v3.1/accounts",
      headers: AUTH,
    });
    const accounts = (
      acctRes.json() as { Data: { Account: Array<{ accountRef: string }> } }
    ).Data.Account;
    const [debtor, creditor] = accounts as [{ accountRef: string }, { accountRef: string }];

    const res = await app.inject({
      method: "POST",
      url: "/open-banking/v3.1/domestic-payments",
      headers: AUTH,
      payload: {
        Data: {
          Initiation: {
            InstructionIdentification: `INSUF-${Date.now()}`,
            InstructedAmount: { Amount: "999999999.00", Currency: "GBP" },
            DebtorAccount:    { Identification: debtor.accountRef },
            CreditorAccount:  { Identification: creditor.accountRef, Name: "Test" },
          },
        },
        Risk: {},
      },
    });

    expect(res.statusCode).toBe(400);
    expect((res.json() as { Code: string }).Code).toBe("BadRequest");
  });

  it("returns 404 for unknown account balance", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/bian/current-account/ACC-DOESNOTEXIST/balance",
      headers: AUTH,
    });
    expect(res.statusCode).toBe(404);
    expect((res.json() as { Code: string }).Code).toBe("NotFound");
  });

  it("returns 404 for unknown payment ref", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/open-banking/v3.1/domestic-payments/PAY-DOESNOTEXIST",
      headers: AUTH,
    });
    expect(res.statusCode).toBe(404);
    expect((res.json() as { Code: string }).Code).toBe("NotFound");
  });

  // ── Domain 5: Consumer Lending ─────────────────────────────────────────────

  it("Domain 5 (Lending): retrieve loan, repayment-schedule, and initiate loan", async () => {
    const retrieveRes = await app.inject({
      method: "GET",
      url: `/bian/consumer-loan/${SEED.MAHLI_LOAN_REF}/retrieve`,
      headers: AUTH,
    });
    expect(retrieveRes.statusCode).toBe(200);
    const loanBody = retrieveRes.json() as {
      consumerLoanFacility: { loanRef: string };
    };
    expect(loanBody.consumerLoanFacility.loanRef).toBe(SEED.MAHLI_LOAN_REF);

    const schedRes = await app.inject({
      method: "GET",
      url: `/bian/consumer-loan/${SEED.MAHLI_LOAN_REF}/repayment-schedule`,
      headers: AUTH,
    });
    expect(schedRes.statusCode).toBe(200);
    const schedBody = schedRes.json() as {
      repaymentSchedule: { schedule: unknown[] };
    };
    expect(Array.isArray(schedBody.repaymentSchedule.schedule)).toBe(true);

    const initRes = await app.inject({
      method: "POST",
      url: "/bian/consumer-loan/initiate",
      headers: AUTH,
      payload: {
        partyId: SEED.ARIA_PARTY_REF,
        requestedAmount: 5000,
        currency: "GBP",
        termMonths: 24,
        purpose: "Home office upgrade",
      },
    });
    expect(initRes.statusCode).toBe(201);
    const initBody = initRes.json() as {
      consumerLoanFacility: { loanRef: string };
    };
    expect(initBody.consumerLoanFacility.loanRef).toMatch(/^LOAN-/);
  });

  // ── Domain 6: Credit & Debit Cards ─────────────────────────────────────────

  it("Domain 6 (Cards): retrieve card, BLOCK then UNBLOCK, and fetch statements", async () => {
    const cardRes = await app.inject({
      method: "GET",
      url: `/bian/credit-card/${SEED.ARIA_CARD_REF}/retrieve`,
      headers: AUTH,
    });
    expect(cardRes.statusCode).toBe(200);
    const cardBody = cardRes.json() as {
      creditCardFacility: { cardRef: string };
    };
    expect(cardBody.creditCardFacility.cardRef).toBe(SEED.ARIA_CARD_REF);

    const blockRes = await app.inject({
      method: "POST",
      url: `/bian/credit-card/${SEED.ARIA_CARD_REF}/request`,
      headers: AUTH,
      payload: { action: "BLOCK", reason: "Smoke test block" },
    });
    expect(blockRes.statusCode).toBe(200);
    expect(
      (blockRes.json() as { creditCardFacility: { status: string } })
        .creditCardFacility.status,
    ).toBe("BLOCKED");

    const unblockRes = await app.inject({
      method: "POST",
      url: `/bian/credit-card/${SEED.ARIA_CARD_REF}/request`,
      headers: AUTH,
      payload: { action: "UNBLOCK" },
    });
    expect(unblockRes.statusCode).toBe(200);
    expect(
      (unblockRes.json() as { creditCardFacility: { status: string } })
        .creditCardFacility.status,
    ).toBe("ACTIVE");

    const stmtRes = await app.inject({
      method: "GET",
      url: `/open-banking/v3.1/accounts/${SEED.ARIA_CURRENT_REF}/statements`,
      headers: AUTH,
    });
    expect(stmtRes.statusCode).toBe(200);
    const stmtBody = stmtRes.json() as { Data: { Statement: unknown[] } };
    expect(Array.isArray(stmtBody.Data.Statement)).toBe(true);
  });

  // ── Domain 7: Savings & Deposits ───────────────────────────────────────────

  it("Domain 7 (Savings): retrieve savings account and interest projection", async () => {
    const savRes = await app.inject({
      method: "GET",
      url: `/bian/savings-account/${SEED.ARIA_SAVINGS_REF}/retrieve`,
      headers: AUTH,
    });
    expect(savRes.statusCode).toBe(200);
    const savBody = savRes.json() as {
      savingsAccountFacility: { accountRef: string };
    };
    expect(savBody.savingsAccountFacility.accountRef).toBe(SEED.ARIA_SAVINGS_REF);

    const intRes = await app.inject({
      method: "GET",
      url: `/bian/savings-account/${SEED.ARIA_SAVINGS_REF}/interest`,
      headers: AUTH,
    });
    expect(intRes.statusCode).toBe(200);
    const intBody = intRes.json() as {
      interestApplication: { annualRatePercent: number };
    };
    expect(intBody.interestApplication.annualRatePercent).toBeGreaterThan(0);
  });

  // ── Domain 8: Investment Portfolio ─────────────────────────────────────────

  it("Domain 8 (Investments): retrieve portfolio, BUY 0.5 shares of AAPL, and get performance", async () => {
    const portRes = await app.inject({
      method: "GET",
      url: `/bian/investment-portfolio/${SEED.ARIA_PORTFOLIO_REF}/retrieve`,
      headers: AUTH,
    });
    expect(portRes.statusCode).toBe(200);
    const portBody = portRes.json() as {
      investmentPortfolio: { portfolioRef: string };
    };
    expect(portBody.investmentPortfolio.portfolioRef).toBe(
      SEED.ARIA_PORTFOLIO_REF,
    );

    const orderRes = await app.inject({
      method: "POST",
      url: `/bian/investment-portfolio/${SEED.ARIA_PORTFOLIO_REF}/request`,
      headers: AUTH,
      payload: {
        instrument: "AAPL",
        quantity: 0.5,
        direction: "BUY",
      },
    });
    expect(orderRes.statusCode).toBe(201);
    const orderBody = orderRes.json() as {
      orderExecution: { instrument: string; direction: string };
    };
    expect(orderBody.orderExecution.instrument).toBe("AAPL");
    expect(orderBody.orderExecution.direction).toBe("BUY");

    const perfRes = await app.inject({
      method: "GET",
      url: `/bian/investment-portfolio/${SEED.ARIA_PORTFOLIO_REF}/performance`,
      headers: AUTH,
    });
    expect(perfRes.statusCode).toBe(200);
    const perfBody = perfRes.json() as {
      portfolioPerformance: { portfolioRef: string };
    };
    expect(perfBody.portfolioPerformance.portfolioRef).toBe(
      SEED.ARIA_PORTFOLIO_REF,
    );
  });

  // ── Domain 9: Regulatory Compliance ────────────────────────────────────────

  it("Domain 9 (Compliance): evaluate AML screen, retrieve CASE-9001, and initiate regulatory report", async () => {
    const evalRes = await app.inject({
      method: "POST",
      url: "/bian/aml-screening/evaluate",
      headers: AUTH,
      payload: {
        subjectType: "party",
        subjectId: SEED.ARIA_PARTY_REF,
      },
    });
    expect(evalRes.statusCode).toBe(200);
    const evalBody = evalRes.json() as {
      amlScreening: { outcome: string };
    };
    expect(evalBody.amlScreening.outcome).toBeDefined();

    const caseRes = await app.inject({
      method: "GET",
      url: `/bian/aml-screening/${SEED.ARIA_CASE_REF}/retrieve`,
      headers: AUTH,
    });
    expect(caseRes.statusCode).toBe(200);
    const caseBody = caseRes.json() as {
      amlScreening: { caseRef: string };
    };
    expect(caseBody.amlScreening.caseRef).toBe(SEED.ARIA_CASE_REF);

    const repRes = await app.inject({
      method: "POST",
      url: "/bian/regulatory-reporting/initiate",
      headers: AUTH,
      payload: {
        reportType: "SARReport",
        jurisdiction: "UK-FCA",
        subjectId: SEED.ARIA_PARTY_REF,
      },
    });
    expect(repRes.statusCode).toBe(201);
    const repBody = repRes.json() as {
      regulatoryReport: { reportId: string };
    };
    expect(repBody.regulatoryReport.reportId).toBeDefined();
  });

  // ── Domain 10: Customer Notifications ──────────────────────────────────────

  it("Domain 10 (Notifications): subscribe webhook and list event history for PAR-ARIA", async () => {
    const subRes = await app.inject({
      method: "POST",
      url: "/bian/customer-event-history/webhook",
      headers: AUTH,
      payload: {
        partyId: SEED.ARIA_PARTY_REF,
        eventTypes: ["payment.completed", "balance.threshold"],
        webhookUrl: "https://example.com/webhooks/agentbank",
      },
    });
    expect(subRes.statusCode).toBe(201);
    const subBody = subRes.json() as {
      subscription: { subscriptionRef: string };
    };
    expect(subBody.subscription.subscriptionRef).toMatch(/^SUB-/);

    const listRes = await app.inject({
      method: "GET",
      url: `/bian/customer-event-history/${SEED.ARIA_PARTY_REF}/list`,
      headers: AUTH,
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = listRes.json() as {
      customerEventHistory: { partyRef: string };
    };
    expect(listBody.customerEventHistory.partyRef).toBe(SEED.ARIA_PARTY_REF);
  });
});
