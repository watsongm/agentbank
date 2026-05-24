// Smoke test suite — boots the server in-process and hits the live endpoints.
// Requires DATABASE_URL pointing at a Postgres with the schema applied and
// seed data loaded (npx prisma db push && npm run db:seed).
// Skipped automatically when DATABASE_URL is absent so the suite does not
// break local typecheck-only runs or CI jobs that only typecheck the frontend.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { SEED } from "../src/lib/constants.js";

const HAS_DB = !!process.env.DATABASE_URL;

// Auth header sent on every authenticated request (Phase 3).
// Matches the "demo-token" accepted by authPlugin in lib/auth.ts.
const AUTH = { authorization: "Bearer demo-token" };

describe.skipIf(!HAS_DB)("agentBANK backend smoke", () => {
  let app: FastifyInstance;

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

  // ── Party ──────────────────────────────────────────────────────────────────

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

  // ── Accounts ───────────────────────────────────────────────────────────────

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

  // ── Transactions ───────────────────────────────────────────────────────────

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

  // ── Payments — Phase 4 ─────────────────────────────────────────────────────

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
});
