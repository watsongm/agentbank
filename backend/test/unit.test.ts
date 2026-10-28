// Unit & HTTP contract test suite — runs ALWAYS (no Postgres DATABASE_URL required).
// Verifies auth & consent parsing, OAuth scope mapping, OpenAPI 3.1.0 completeness,
// Prometheus metrics, OAuth token minting, 401/403 security gates, ZodError -> 400
// formatting, DPoP proof & jti replay protection, SHA-256 audit hash-chain, and SDK
// header precedence & tool surface.

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { SEED } from "../src/lib/constants.js";
import {
  parseConsent,
  mapOAuthScopesToConsentScopes,
  ConsentScope,
  ALL_SCOPES,
} from "../src/lib/consent.js";
import { clearDpopReplayCache } from "../src/lib/dpop.js";
// @ts-expect-error — SDK is an untyped ESM JavaScript module
import { AgentBankAgent } from "../../sdk/index.js";

const AUTH = { authorization: "Bearer demo-token" };

describe("agentBANK unit & contract suite (no DB required)", () => {
  let app: Awaited<ReturnType<(typeof import("../src/server.js"))["buildServer"]>>;

  beforeAll(async () => {
    process.env.LOG_LEVEL = "silent";
    const mod = await import("../src/server.js");
    app = await mod.buildServer();
    await app.ready();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  // ── 1. Auth & Consent Unit Tests ───────────────────────────────────────────

  describe("Auth & Consent (parseConsent, mapOAuthScopesToConsentScopes)", () => {
    it("demo-token grants ALL_SCOPES for PAR-ARIA", () => {
      const consent = parseConsent("demo-token");
      expect(consent.customerId).toBe(SEED.ARIA_PARTY_REF);
      expect(consent.scopes).toEqual(ALL_SCOPES);
      expect(consent.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("parses a base64-encoded JSON consent token accurately", () => {
      const expiresAt = new Date(Date.now() + 3600_000).toISOString();
      const rawToken = Buffer.from(
        JSON.stringify({
          customerId: SEED.MAHLI_PARTY_REF,
          scopes: ["READ_LOANS"],
          expiresAt,
        }),
        "utf8",
      ).toString("base64");

      const consent = parseConsent(rawToken);
      expect(consent.customerId).toBe("PAR-MAHLI");
      expect(consent.scopes).toEqual([ConsentScope.READ_LOANS]);
      expect(consent.expiresAt.toISOString()).toBe(expiresAt);
    });

    it("throws 401 Unauthorized when consent token is expired", () => {
      const expiredToken = Buffer.from(
        JSON.stringify({
          customerId: SEED.ARIA_PARTY_REF,
          scopes: ["READ_PARTY"],
          expiresAt: new Date(Date.now() - 60_000).toISOString(),
        }),
        "utf8",
      ).toString("base64");

      expect(() => parseConsent(expiredToken)).toThrow(/expired/i);
    });

    it("mapOAuthScopesToConsentScopes maps OAuth scope strings to ConsentScope enums", () => {
      const mapped = mapOAuthScopesToConsentScopes(
        "accounts:read payments:write lending:read",
      );
      expect(mapped).toContain(ConsentScope.READ_ACCOUNTS);
      expect(mapped).toContain(ConsentScope.READ_BALANCES);
      expect(mapped).toContain(ConsentScope.READ_TRANSACTIONS);
      expect(mapped).toContain(ConsentScope.INITIATE_PAYMENT);
      expect(mapped).toContain(ConsentScope.READ_LOANS);
      expect(mapped).not.toContain(ConsentScope.BLOCK_CARD);
    });
  });

  // ── 2. Fastify HTTP Routes (No-DB Required) ────────────────────────────────

  describe("Fastify HTTP Routes & Security Gates", () => {
    it("GET / returns 200 with metadata including metrics and observability URLs", async () => {
      const res = await app.inject({ method: "GET", url: "/" });
      expect(res.statusCode).toBe(200);
      const body = res.json() as Record<string, string>;
      expect(body.name).toBe("agentBANK");
      expect(body.metrics).toBe("/metrics");
      expect(body.observability).toBe("/observability/sessions");
    });

    it("GET /openapi.json returns 200 with OpenAPI 3.1.0 spec containing all 10 BIAN domains and OAuth endpoint", async () => {
      const res = await app.inject({ method: "GET", url: "/openapi.json" });
      expect(res.statusCode).toBe(200);
      const spec = res.json() as {
        openapi: string;
        paths: Record<string, unknown>;
        tags?: Array<{ name: string }>;
      };
      expect(spec.openapi).toMatch(/^3\.1\./);
      const paths = Object.keys(spec.paths);
      expect(paths).toContain("/open-banking/v3.1/oauth/token");
      expect(paths).toContain("/open-banking/v3.1/party");
      expect(paths).toContain("/open-banking/v3.1/accounts");
      expect(paths).toContain("/open-banking/v3.1/domestic-payments");
      expect(paths).toContain("/open-banking/v3.1/accounts/{accountId}/transactions");
      expect(paths).toContain("/bian/consumer-loan/initiate");
      expect(paths).toContain("/bian/credit-card/initiate");
      expect(paths).toContain("/bian/savings-account/initiate");
      expect(paths).toContain("/bian/investment-portfolio/initiate");
      expect(paths).toContain("/bian/aml-screening/evaluate");
      expect(paths).toContain("/bian/customer-event-history/webhook");
      // 44 banking endpoints + 1 OAuth token endpoint = 45 paths
      expect(paths.length).toBeGreaterThanOrEqual(44);
    });

    it("GET /metrics returns 200 with Prometheus metrics", async () => {
      const res = await app.inject({ method: "GET", url: "/metrics" });
      expect(res.statusCode).toBe(200);
      expect(res.body).toContain("http_requests_total");
      expect(res.body).toContain("http_request_duration_ms");
    });

    it("POST /open-banking/v3.1/oauth/token mints a valid base64 consent token with requested scopes", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/open-banking/v3.1/oauth/token",
        payload: {
          grant_type: "client_credentials",
          client_id: "unit-test-client",
          scope: "accounts:read payments:write",
          customer_id: SEED.ARIA_PARTY_REF,
        },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as {
        access_token: string;
        token_type: string;
        expires_in: number;
        consent_scopes: string[];
      };
      expect(body.token_type).toBe("Bearer");
      expect(body.expires_in).toBe(3600);
      expect(body.consent_scopes).toContain(ConsentScope.READ_ACCOUNTS);
      expect(body.consent_scopes).toContain(ConsentScope.INITIATE_PAYMENT);

      const parsed = parseConsent(body.access_token);
      expect(parsed.customerId).toBe(SEED.ARIA_PARTY_REF);
      expect(parsed.scopes).toContain(ConsentScope.INITIATE_PAYMENT);
    });

    it("POST /open-banking/v3.1/oauth/token returns 400 on unsupported grant_type", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/open-banking/v3.1/oauth/token",
        payload: {
          grant_type: "password_grant_invalid",
        },
      });
      expect(res.statusCode).toBe(400);
      expect((res.json() as { Code: string }).Code).toBe("BadRequest");
    });

    it("returns 401 when Authorization header is missing or invalid on protected routes", async () => {
      const missingRes = await app.inject({
        method: "GET",
        url: "/open-banking/v3.1/party",
      });
      expect(missingRes.statusCode).toBe(401);
      expect((missingRes.json() as { Code: string }).Code).toBe("Unauthorized");

      const invalidRes = await app.inject({
        method: "GET",
        url: "/open-banking/v3.1/party",
        headers: { authorization: "Bearer not-a-valid-token" },
      });
      expect(invalidRes.statusCode).toBe(401);
      expect((invalidRes.json() as { Code: string }).Code).toBe("Unauthorized");
    });

    it("returns 403 Forbidden when using a party:read token on INITIATE_PAYMENT or READ_LOANS endpoints", async () => {
      const tokenRes = await app.inject({
        method: "POST",
        url: "/open-banking/v3.1/oauth/token",
        payload: {
          grant_type: "client_credentials",
          scope: "party:read",
        },
      });
      const { access_token } = tokenRes.json() as { access_token: string };
      const scopedAuth = { authorization: `Bearer ${access_token}` };

      const payRes = await app.inject({
        method: "POST",
        url: "/open-banking/v3.1/domestic-payments",
        headers: scopedAuth,
        payload: {},
      });
      expect(payRes.statusCode).toBe(403);
      expect((payRes.json() as { Code: string }).Code).toBe("Forbidden");

      const loanRes = await app.inject({
        method: "GET",
        url: `/bian/consumer-loan/${SEED.MAHLI_LOAN_REF}/retrieve`,
        headers: scopedAuth,
      });
      expect(loanRes.statusCode).toBe(403);
      expect((loanRes.json() as { Code: string }).Code).toBe("Forbidden");
    });

    it("returns 400 UK.OBIE.Field.Invalid when sending an invalid body to Zod-validated routes", async () => {
      const partyRes = await app.inject({
        method: "POST",
        url: "/bian/party-reference/register",
        headers: AUTH,
        payload: {},
      });
      expect(partyRes.statusCode).toBe(400);
      expect((partyRes.json() as { Code: string }).Code).toBe(
        "UK.OBIE.Field.Invalid",
      );

      const payRes = await app.inject({
        method: "POST",
        url: "/open-banking/v3.1/domestic-payments",
        headers: AUTH,
        payload: {},
      });
      expect(payRes.statusCode).toBe(400);
      expect((payRes.json() as { Code: string }).Code).toBe(
        "UK.OBIE.Field.Invalid",
      );
    });
  });

  // ── 3. DPoP Proof & Replay Protection ──────────────────────────────────────

  describe("DPoP Proof & Replay Protection (dpopPlugin)", () => {
    it("accepts a valid DPoP proof with unique jti and rejects replay of the same jti with 401", async () => {
      clearDpopReplayCache();
      const jti = `dpop-jti-${Date.now()}-${Math.random()}`;
      const headerB64 = Buffer.from(
        JSON.stringify({ typ: "dpop+jwt", alg: "ES256" }),
      ).toString("base64url");
      const payloadB64 = Buffer.from(
        JSON.stringify({
          jti,
          htm: "GET",
          htu: "http://localhost:3000/",
          iat: Math.floor(Date.now() / 1000),
        }),
      ).toString("base64url");
      const dpopProof = `${headerB64}.${payloadB64}.sig`;

      const firstRes = await app.inject({
        method: "GET",
        url: "/",
        headers: { dpop: dpopProof },
      });
      expect(firstRes.statusCode).toBe(200);

      const replayRes = await app.inject({
        method: "GET",
        url: "/",
        headers: { dpop: dpopProof },
      });
      expect(replayRes.statusCode).toBe(401);
      expect((replayRes.json() as { Message: string }).Message).toMatch(
        /DPoP proof replay detected/i,
      );
    });
  });

  // ── 4. Audit Log Hash-Chain & Live Observability ───────────────────────────

  describe("Audit Log Hash-Chain & Live Observability", () => {
    it("records requests in the hash-chained audit ring buffer and verifies chain integrity", async () => {
      // Trigger a known request first
      await app.inject({ method: "GET", url: "/" });

      const verifyRes = await app.inject({
        method: "GET",
        url: "/observability/audit-verify",
      });
      expect(verifyRes.statusCode).toBe(200);
      const verifyBody = verifyRes.json() as {
        valid: boolean;
        totalVerified: number;
        headHash: string;
        brokenAt: number | null;
      };
      expect(verifyBody.valid).toBe(true);
      expect(verifyBody.brokenAt).toBeNull();
      expect(verifyBody.totalVerified).toBeGreaterThan(0);
      expect(verifyBody.headHash).toMatch(/^[a-f0-9]{64}$/);

      const sessionsRes = await app.inject({
        method: "GET",
        url: "/observability/sessions",
      });
      expect(sessionsRes.statusCode).toBe(200);
      const sessionsBody = sessionsRes.json() as {
        sessions: Array<{ rowHash: string; prevHash: string }>;
        events: Array<{ rowHash: string; prevHash: string }>;
        auditChain: { valid: boolean };
      };
      expect(sessionsBody.auditChain.valid).toBe(true);
      expect(sessionsBody.events.length).toBeGreaterThan(1);

      // Verify cryptographic link between consecutive events
      for (let i = 1; i < sessionsBody.events.length; i++) {
        expect(sessionsBody.events[i]!.prevHash).toBe(
          sessionsBody.events[i - 1]!.rowHash,
        );
        expect(sessionsBody.events[i]!.rowHash).toMatch(/^[a-f0-9]{64}$/);
      }
    });
  });

  // ── 5. SDK Resilience & Header Precedence ──────────────────────────────────

  describe("AgentBankAgent SDK (sdk/index.js)", () => {
    it("_consentHeader returns empty object when consent_token is undefined and Authorization when provided", () => {
      const agent = new AgentBankAgent({ token: "instance-token" });
      expect(agent._consentHeader(undefined)).toEqual({});
      expect(agent._consentHeader("override-token")).toEqual({
        Authorization: "Bearer override-token",
      });
      expect(agent._consentHeader("Bearer already-prefixed")).toEqual({
        Authorization: "Bearer already-prefixed",
      });
    });

    it("uses instance token when consent_token is omitted and overrides it when consent_token is passed", async () => {
      const agent = new AgentBankAgent({
        baseUrl: "http://localhost:3000",
        token: "instance-default-token",
      });

      const capturedHeaders: Array<Record<string, string>> = [];
      const mockFetch = vi.fn(async (_url: string, init?: RequestInit) => {
        capturedHeaders.push(
          (init?.headers ?? {}) as Record<string, string>,
        );
        return {
          ok: true,
          status: 200,
          json: async () => ({ Data: { Party: {} } }),
          text: async () => "{}",
        } as unknown as Response;
      });

      vi.stubGlobal("fetch", mockFetch);
      try {
        await agent.tools.get_party();
        expect(capturedHeaders[0]?.["Authorization"]).toBe(
          "Bearer instance-default-token",
        );

        await agent.tools.get_party({ consent_token: "per-call-token" });
        expect(capturedHeaders[1]?.["Authorization"]).toBe(
          "Bearer per-call-token",
        );
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("exposes all 14 banking tool methods on agent.tools", () => {
      const agent = new AgentBankAgent();
      const expectedTools = [
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
      for (const toolName of expectedTools) {
        expect(typeof agent.tools[toolName]).toBe("function");
      }
      expect(Object.keys(agent.tools)).toHaveLength(14);
    });
  });
});
