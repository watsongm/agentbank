// Consent Manager — FAPI 2.0 consent scoping layer.
// Implements scope-based access control over bearer tokens.
// See docs/adr/0002-security-model.md for rationale.

import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest, preHandlerHookHandler } from "fastify";
import { Unauthorized, Forbidden } from "./errors.js";
import { SEED } from "./constants.js";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Scope definitions (covering all 10 BIAN service domains)
// ─────────────────────────────────────────────────────────────────────────────

export enum ConsentScope {
  READ_PARTY = "READ_PARTY",
  WRITE_PARTY = "WRITE_PARTY",
  READ_ACCOUNTS = "READ_ACCOUNTS",
  WRITE_ACCOUNTS = "WRITE_ACCOUNTS",
  READ_BALANCES = "READ_BALANCES",
  READ_TRANSACTIONS = "READ_TRANSACTIONS",
  INITIATE_PAYMENT = "INITIATE_PAYMENT",
  READ_LOANS = "READ_LOANS",
  APPLY_LOAN = "APPLY_LOAN",
  READ_CARDS = "READ_CARDS",
  BLOCK_CARD = "BLOCK_CARD",
  READ_SAVINGS = "READ_SAVINGS",
  READ_PORTFOLIO = "READ_PORTFOLIO",
  PLACE_ORDER = "PLACE_ORDER",
  MANAGE_INVESTMENTS = "MANAGE_INVESTMENTS",
  RUN_AML = "RUN_AML",
  SUBSCRIBE_EVENTS = "SUBSCRIBE_EVENTS",
  READ_NOTIFICATIONS = "READ_NOTIFICATIONS",
}

// All scopes — used for the demo-token and service-level AGENTBANK_TOKEN grant
export const ALL_SCOPES: ConsentScope[] = Object.values(ConsentScope);

const OAUTH_SCOPE_MAP: Record<string, ConsentScope[]> = {
  "party:read": [ConsentScope.READ_PARTY],
  "party:write": [ConsentScope.WRITE_PARTY, ConsentScope.READ_PARTY],
  "accounts:read": [
    ConsentScope.READ_ACCOUNTS,
    ConsentScope.READ_BALANCES,
    ConsentScope.READ_TRANSACTIONS,
  ],
  "accounts:write": [ConsentScope.WRITE_ACCOUNTS, ConsentScope.READ_ACCOUNTS],
  "balances:read": [ConsentScope.READ_BALANCES],
  "transactions:read": [ConsentScope.READ_TRANSACTIONS],
  "payments:read": [ConsentScope.INITIATE_PAYMENT, ConsentScope.READ_TRANSACTIONS],
  "payments:write": [
    ConsentScope.INITIATE_PAYMENT,
    ConsentScope.READ_ACCOUNTS,
    ConsentScope.READ_TRANSACTIONS,
  ],
  "lending:read": [ConsentScope.READ_LOANS],
  "lending:write": [ConsentScope.APPLY_LOAN, ConsentScope.READ_LOANS],
  "cards:read": [ConsentScope.READ_CARDS],
  "cards:write": [ConsentScope.BLOCK_CARD, ConsentScope.READ_CARDS],
  "savings:read": [
    ConsentScope.READ_SAVINGS,
    ConsentScope.READ_ACCOUNTS,
    ConsentScope.READ_BALANCES,
  ],
  "savings:write": [
    ConsentScope.WRITE_ACCOUNTS,
    ConsentScope.READ_SAVINGS,
    ConsentScope.READ_ACCOUNTS,
  ],
  "investments:read": [ConsentScope.READ_PORTFOLIO, ConsentScope.MANAGE_INVESTMENTS],
  "investments:write": [
    ConsentScope.PLACE_ORDER,
    ConsentScope.READ_PORTFOLIO,
    ConsentScope.MANAGE_INVESTMENTS,
  ],
  "compliance:read": [ConsentScope.RUN_AML],
  "compliance:write": [ConsentScope.RUN_AML],
  "notifications:read": [ConsentScope.READ_NOTIFICATIONS, ConsentScope.SUBSCRIBE_EVENTS],
  "notifications:write": [ConsentScope.SUBSCRIBE_EVENTS, ConsentScope.READ_NOTIFICATIONS],
};

/**
 * Maps space- or comma-delimited OAuth scope strings (e.g. "accounts:read payments:write")
 * as well as direct ConsentScope enum names into a deduplicated array of ConsentScope values.
 */
export function mapOAuthScopesToConsentScopes(scopeString: string): ConsentScope[] {
  const tokens = scopeString
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const result = new Set<ConsentScope>();
  const enumValues = new Set<string>(Object.values(ConsentScope));

  for (const token of tokens) {
    if ( token === "*" || token.toLowerCase() === "all") {
      for (const s of ALL_SCOPES) result.add(s);
      continue;
    }
    if (enumValues.has(token)) {
      result.add(token as ConsentScope);
      continue;
    }
    const upper = token.toUpperCase();
    if (enumValues.has(upper)) {
      result.add(upper as ConsentScope);
      continue;
    }
    const mapped = OAUTH_SCOPE_MAP[token.toLowerCase()];
    if (mapped) {
      for (const s of mapped) result.add(s);
    }
  }

  return Array.from(result);
}

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

function isStaticFullAccessToken(token: string): boolean {
  if (token === "demo-token") return true;
  const envToken = process.env.AGENTBANK_TOKEN;
  if (envToken) {
    const cleanEnv = envToken.replace(/^Bearer\s+/i, "").trim();
    if (token === envToken || token === cleanEnv) return true;
  }
  return false;
}

function decodeBase64Json(segment: string): Record<string, unknown> {
  // Normalise base64url to standard base64
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = Buffer.from(normalized, "base64").toString("utf8").trim();
  if (!decoded.startsWith("{") || !decoded.endsWith("}")) {
    throw new Error("Not a JSON object");
  }
  return JSON.parse(decoded) as Record<string, unknown>;
}

export function parseConsent(token: string): Consent {
  // Demo / CI / configured AGENTBANK_TOKEN — full access, expires in 24 hours
  if (isStaticFullAccessToken(token)) {
    return {
      token,
      customerId: SEED.ARIA_PARTY_REF,
      scopes: ALL_SCOPES,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  // Attempt 3-part JWT (header.payload.signature) or base64/base64url JSON Consent object
  try {
    const parts = token.split(".");
    const payloadSegment = parts.length === 3 ? parts[1]! : token;
    const parsed = decodeBase64Json(payloadSegment);

    const customerId =
      typeof parsed.customerId === "string"
        ? parsed.customerId
        : typeof parsed.sub === "string"
          ? parsed.sub
          : null;

    if (!customerId) {
      throw new Error("Malformed consent payload: missing customerId/sub");
    }

    let scopes: ConsentScope[] = [];
    if (Array.isArray(parsed.scopes)) {
      const scopeSet = new Set<ConsentScope>();
      for (const item of parsed.scopes) {
        if (typeof item === "string") {
          for (const mapped of mapOAuthScopesToConsentScopes(item)) {
            scopeSet.add(mapped);
          }
        }
      }
      scopes = Array.from(scopeSet);
    } else if (typeof parsed.scopes === "string") {
      scopes = mapOAuthScopesToConsentScopes(parsed.scopes);
    } else if (typeof parsed.scope === "string") {
      scopes = mapOAuthScopesToConsentScopes(parsed.scope);
    } else {
      throw new Error("Malformed consent payload: missing scopes/scope");
    }

    let expiresAt: Date;
    if (typeof parsed.expiresAt === "string" || typeof parsed.expiresAt === "number") {
      expiresAt = new Date(parsed.expiresAt);
    } else if (typeof parsed.exp === "number") {
      expiresAt = new Date(parsed.exp < 1e12 ? parsed.exp * 1000 : parsed.exp);
    } else {
      throw new Error("Malformed consent payload: missing expiresAt/exp");
    }

    if (isNaN(expiresAt.getTime())) {
      throw new Error("Invalid expiresAt");
    }
    if (expiresAt < new Date()) {
      throw Unauthorized("Consent token has expired");
    }

    return {
      token,
      customerId,
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
export const PUBLIC_PREFIXES = [
  "/docs",
  "/openapi.json",
  "/health",
  "/metrics",
  "/open-banking/v3.1/oauth/token",
  "/observability",
] as const;

export function isPublicRoute(url: string): boolean {
  const path = url.split("?")[0];
  if (path === "/") return true;
  return PUBLIC_PREFIXES.some(
    (p) => url === p || path === p || url.startsWith(p + "/") || url.startsWith(p + "?"),
  );
}

export const consentPlugin = fp(async function (fastify: FastifyInstance) {
  if (!fastify.hasRequestDecorator("consent")) {
    fastify.decorateRequest("consent", null as unknown as Consent);
  }

  fastify.addHook("onRequest", async (req: FastifyRequest) => {
    if (isPublicRoute(req.url)) return;
    if (req.consent) return;

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

export function requiresAnyScope(...allowed: ConsentScope[]): preHandlerHookHandler {
  return async function (req: FastifyRequest) {
    const consent = req.consent;

    if (!consent) {
      throw Forbidden(`This endpoint requires one of scopes: ${allowed.join(", ")}`);
    }

    const hasAny = allowed.some((s) => consent.scopes.includes(s));
    if (!hasAny) {
      throw Forbidden(
        `Consent is missing required scope (needs one of: ${allowed.join(", ")})`,
      );
    }
  };
}
