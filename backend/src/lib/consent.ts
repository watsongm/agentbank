// Consent Manager — FAPI 2.0 consent scoping layer.
// Implements scope-based access control over bearer tokens.
// See docs/adr/0002-security-model.md for rationale.

import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest, preHandlerHookHandler } from "fastify";
import { Unauthorized, Forbidden } from "./errors.js";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Scope definitions
// ─────────────────────────────────────────────────────────────────────────────

export enum ConsentScope {
  READ_ACCOUNTS = "READ_ACCOUNTS",
  READ_TRANSACTIONS = "READ_TRANSACTIONS",
  INITIATE_PAYMENT = "INITIATE_PAYMENT",
  READ_PARTY = "READ_PARTY",
  READ_BALANCES = "READ_BALANCES",
  MANAGE_INVESTMENTS = "MANAGE_INVESTMENTS",
  READ_LOANS = "READ_LOANS",
  READ_CARDS = "READ_CARDS",
  READ_SAVINGS = "READ_SAVINGS",
  READ_NOTIFICATIONS = "READ_NOTIFICATIONS",
}

// All scopes — used for the demo-token grant
const ALL_SCOPES: ConsentScope[] = Object.values(ConsentScope);

// ─────────────────────────────────────────────────────────────────────────────
// 2. Consent interface
// ─────────────────────────────────────────────────────────────────────────────

export interface Consent {
  token: string;
  customerId: string;
  scopes: ConsentScope[];
  expiresAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. parseConsent — resolves a token string to a Consent object
// ─────────────────────────────────────────────────────────────────────────────

export function parseConsent(token: string): Consent {
  // Demo / CI token — full access, expires in 24 hours
  if (token === "demo-token") {
    return {
      token,
      customerId: "demo-customer",
      scopes: ALL_SCOPES,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  // Attempt base64-encoded JSON Consent object
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as {
      token?: string;
      customerId?: string;
      scopes?: string[];
      expiresAt?: string;
    };

    if (
      typeof parsed.customerId !== "string" ||
      !Array.isArray(parsed.scopes) ||
      !parsed.expiresAt
    ) {
      throw new Error("Malformed consent payload");
    }

    const scopes = parsed.scopes
      .filter((s): s is ConsentScope => Object.values(ConsentScope).includes(s as ConsentScope));

    const expiresAt = new Date(parsed.expiresAt);
    if (isNaN(expiresAt.getTime())) {
      throw new Error("Invalid expiresAt");
    }
    if (expiresAt < new Date()) {
      throw Unauthorized("Consent token has expired");
    }

    return {
      token,
      customerId: parsed.customerId,
      scopes,
      expiresAt,
    };
  } catch (err) {
    if (err instanceof Error && err.message === "Consent token has expired") {
      throw err;
    }
    throw Unauthorized("Invalid or unrecognised consent token");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Fastify type augmentation
// ─────────────────────────────────────────────────────────────────────────────

declare module "fastify" {
  interface FastifyRequest {
    consent: Consent;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. consentPlugin — attaches request.consent for every authenticated request
// ─────────────────────────────────────────────────────────────────────────────

// Routes that bypass consent parsing (public/infrastructure)
const PUBLIC_PREFIXES = ["/docs", "/openapi.json", "/health", "/"] as const;

function isPublicRoute(url: string): boolean {
  return PUBLIC_PREFIXES.some((p) => url === p || (p !== "/" && url.startsWith(p)));
}

export const consentPlugin = fp(async function (fastify: FastifyInstance) {
  fastify.decorateRequest("consent", null as unknown as Consent);

  fastify.addHook("onRequest", async (req: FastifyRequest) => {
    if (isPublicRoute(req.url)) return;

    const header = req.headers["authorization"];
    if (!header || !header.startsWith("Bearer ")) return; // authPlugin will reject

    const token = header.slice(7).trim();
    req.consent = parseConsent(token);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. requiresScope — preHandler hook factory for scope enforcement
// ─────────────────────────────────────────────────────────────────────────────

export function requiresScope(...required: ConsentScope[]): preHandlerHookHandler {
  return async function (req: FastifyRequest) {
    const consent = req.consent;

    // No consent object means no scope info — deny
    if (!consent) {
      throw Forbidden(`This endpoint requires scopes: ${required.join(", ")}`);
    }

    const missing = required.filter((s) => !consent.scopes.includes(s));
    if (missing.length > 0) {
      throw Forbidden(
        `Consent is missing required scope(s): ${missing.join(", ")}`,
      );
    }
  };
}
