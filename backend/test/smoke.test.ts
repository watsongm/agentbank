// Smoke test — boots the server in-process and hits the live endpoints.
// Requires DATABASE_URL pointing at a Postgres with `prisma migrate deploy`
// + `prisma/seed.ts` already applied. Skipped automatically if Postgres
// is not reachable, so it doesn't break local typecheck-only runs.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";

const HAS_DB = !!process.env.DATABASE_URL;

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

  it("GET /health returns ok and reports postgres reachable", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { status: string; dependencies: { postgres: string } };
    expect(body.status).toBe("ok");
    expect(body.dependencies.postgres).toBe("ok");
  });

  it("GET /open-banking/v3.1/party returns the seeded authenticated party", async () => {
    const res = await app.inject({ method: "GET", url: "/open-banking/v3.1/party" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { Data: { Party: { legalName: string; kycStatus: string } } };
    expect(body.Data.Party.legalName).toBeDefined();
    expect(body.Data.Party.kycStatus).toBe("VERIFIED");
  });

  it("GET /open-banking/v3.1/accounts lists at least one account", async () => {
    const res = await app.inject({ method: "GET", url: "/open-banking/v3.1/accounts" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { Data: { Account: Array<{ accountRef: string }> } };
    expect(body.Data.Account.length).toBeGreaterThan(0);
  });

  it("GET balance for ACC-1829 returns Aria's seeded balance", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/bian/current-account/ACC-1829/balance",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { accountBalance: { available: string; currency: string } };
    expect(body.accountBalance.currency).toBe("GBP");
    expect(Number(body.accountBalance.available)).toBeGreaterThan(0);
  });

  it("transactions list returns paginated items with cursor", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/open-banking/v3.1/accounts/ACC-1829/transactions?limit=10",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { Data: { Transaction: unknown[] }; Links: { Next?: string } };
    expect(body.Data.Transaction).toHaveLength(10);
    expect(body.Links.Next).toBeDefined();
  });

  it("propagates x-fapi-interaction-id header", async () => {
    const id = "test-fapi-id-" + Date.now();
    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: { "x-fapi-interaction-id": id },
    });
    expect(res.headers["x-fapi-interaction-id"]).toBe(id);
  });
});
