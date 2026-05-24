// DPoP (Demonstrating Proof-of-Possession) stub.
//
// This is a STUB implementation. Full PKCE/PAR/DPoP validation
// (key binding, jti replay prevention, ath claim) is deferred to
// the FAPI 2.0 security profile implementation.
// TODO: implement full DPoP per RFC 9449 — see ADR 0002 (docs/adr/0002-security-model.md)

import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest } from "fastify";

// ─────────────────────────────────────────────────────────────────────────────
// Fastify type augmentation
// ─────────────────────────────────────────────────────────────────────────────

declare module "fastify" {
  interface FastifyRequest {
    hasDPoP: boolean;
  }
}

// Mutating HTTP methods that should carry DPoP proof
const MUTATING_METHODS = new Set(["POST", "PATCH", "DELETE", "PUT"]);

// ─────────────────────────────────────────────────────────────────────────────
// dpopPlugin
// ─────────────────────────────────────────────────────────────────────────────

export const dpopPlugin = fp(async function (fastify: FastifyInstance) {
  fastify.decorateRequest("hasDPoP", false);

  fastify.addHook("onRequest", async (req: FastifyRequest) => {
    const dpopHeader = req.headers["dpop"];

    if (typeof dpopHeader === "string" && dpopHeader.length > 0) {
      // Header is present and non-empty — mark as DPoP-bound
      // TODO (ADR 0002): validate the DPoP proof JWT:
      //   1. Parse the JWK thumbprint from the DPoP header
      //   2. Verify signature over htm (method) + htu (URL) + iat + jti
      //   3. Confirm ath claim matches SHA-256 of the access token
      //   4. Enforce jti uniqueness to prevent replay attacks
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
