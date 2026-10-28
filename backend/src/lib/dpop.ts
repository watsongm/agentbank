// DPoP (Demonstrating Proof-of-Possession) — RFC 9449 verification plugin.
//
// Validates DPoP proofs when provided on incoming requests:
//   1. Parses 3-part JWT (header.payload.signature) or JSON proof
//   2. Verifies JWT header `typ === "dpop+jwt"`
//   3. Verifies `htm` matches the HTTP request method (when present)
//   4. Enforces `jti` uniqueness via an in-memory TTL cache to prevent replay attacks
//   5. Emits FAPI 2.0 compliance warnings on mutating requests missing DPoP
// See ADR 0002 (docs/adr/0002-security-model.md)

import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { Unauthorized } from "./errors.js";

// ─────────────────────────────────────────────────────────────────────────────
// Fastify type augmentation
// ─────────────────────────────────────────────────────────────────────────────

export interface DPoPClaims {
  jti?: string;
  htm?: string;
  htu?: string;
  iat?: number;
  ath?: string;
}

declare module "fastify" {
  interface FastifyRequest {
    hasDPoP: boolean;
    dpopClaims?: DPoPClaims;
  }
}

// Mutating HTTP methods that should carry DPoP proof
const MUTATING_METHODS = new Set(["POST", "PATCH", "DELETE", "PUT"]);

// In-memory jti replay cache with 5-minute TTL
const JTI_TTL_MS = 5 * 60 * 1000;
const seenJtis = new Map<string, number>();

function pruneExpiredJtis(now: number): void {
  for (const [jti, expiresAt] of seenJtis.entries()) {
    if (expiresAt <= now) {
      seenJtis.delete(jti);
    }
  }
}

export function clearDpopReplayCache(): void {
  seenJtis.clear();
}

function decodeBase64UrlJson(segment: string): Record<string, unknown> {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const text = Buffer.from(normalized, "base64").toString("utf8").trim();
  if (!text.startsWith("{") || !text.endsWith("}")) {
    throw new Error("Segment is not a JSON object");
  }
  return JSON.parse(text) as Record<string, unknown>;
}

function validateClaimsAndReplay(claims: Record<string, unknown>, reqMethod: string): DPoPClaims {
  if (
    typeof claims.htm === "string" &&
    claims.htm.toUpperCase() !== reqMethod.toUpperCase()
  ) {
    throw Unauthorized(
      `Invalid DPoP proof: htm claim (${claims.htm}) does not match request method (${reqMethod})`,
    );
  }

  if (typeof claims.jti === "string" && claims.jti.length > 0) {
    const now = Date.now();
    pruneExpiredJtis(now);
    if (seenJtis.has(claims.jti)) {
      throw Unauthorized("DPoP proof replay detected");
    }
    seenJtis.set(claims.jti, now + JTI_TTL_MS);
  }

  return {
    jti: typeof claims.jti === "string" ? claims.jti : undefined,
    htm: typeof claims.htm === "string" ? claims.htm : undefined,
    htu: typeof claims.htu === "string" ? claims.htu : undefined,
    iat: typeof claims.iat === "number" ? claims.iat : undefined,
    ath: typeof claims.ath === "string" ? claims.ath : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// dpopPlugin
// ─────────────────────────────────────────────────────────────────────────────

export const dpopPlugin = fp(async function (fastify: FastifyInstance) {
  if (!fastify.hasRequestDecorator("hasDPoP")) {
    fastify.decorateRequest("hasDPoP", false);
  }
  if (!fastify.hasRequestDecorator("dpopClaims")) {
    fastify.decorateRequest("dpopClaims", undefined);
  }

  fastify.addHook("onRequest", async (req: FastifyRequest) => {
    const dpopHeader = req.headers["dpop"];

    if (typeof dpopHeader === "string" && dpopHeader.trim().length > 0) {
      const raw = dpopHeader.trim();
      const parts = raw.split(".");

      if (parts.length === 3) {
        let headerObj: Record<string, unknown>;
        let payloadObj: Record<string, unknown>;
        try {
          headerObj = decodeBase64UrlJson(parts[0]!);
          payloadObj = decodeBase64UrlJson(parts[1]!);
        } catch {
          throw Unauthorized("Malformed DPoP JWT proof");
        }

        if (
          typeof headerObj.typ === "string" &&
          headerObj.typ.toLowerCase() !== "dpop+jwt"
        ) {
          throw Unauthorized("Invalid DPoP proof: JWT header typ must be dpop+jwt");
        }

        req.dpopClaims = validateClaimsAndReplay(payloadObj, req.method);
      } else {
        // Support base64-encoded or inline JSON DPoP proof payloads
        try {
          const payloadObj = raw.startsWith("{")
            ? (JSON.parse(raw) as Record<string, unknown>)
            : decodeBase64UrlJson(raw);
          req.dpopClaims = validateClaimsAndReplay(payloadObj, req.method);
        } catch (err) {
          if (err instanceof Error && err.name === "AgentBankError") {
            throw err;
          }
          // Non-JSON opaque DPoP token — accept as present without structured claims
        }
      }

      req.hasDPoP = true;
    } else {
      req.hasDPoP = false;

      // Warn on mutating endpoints missing DPoP — important for FAPI 2.0 compliance
      if (MUTATING_METHODS.has(req.method)) {
        req.log.warn(
          {
            method: req.method,
            url: req.url,
            requestId: req.id,
          },
          "dpop: DPoP header absent on mutating endpoint — FAPI 2.0 recommends DPoP binding",
        );
      }
    }
  });
});
