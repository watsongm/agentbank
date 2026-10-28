// FAPI 2.0 bearer-token & consent validation plugin.
// Validates that every non-public request carries a well-formed
// Authorization: Bearer <token> header and resolves the token into a
// scoped Consent object via parseConsent(). Accepted tokens are:
//   • the literal string "demo-token" (CI smoke tests, local dev)
//   • the value of AGENTBANK_TOKEN env var (the service-level token)
//   • base64/base64url-encoded JSON consent payloads ({ customerId, scopes, expiresAt })
//   • 3-part JWT tokens (header.payload.signature)

import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { Unauthorized } from "./errors.js";
import { parseConsent, type Consent } from "./consent.js";

// Routes that bypass auth — docs, OpenAPI spec, health, metrics, OAuth token endpoint, observability, and root
export const PUBLIC_PREFIXES = [
  "/docs",
  "/openapi.json",
  "/health",
  "/metrics",
  "/open-banking/v3.1/oauth/token",
  "/observability",
] as const;

export function isPublic(url: string): boolean {
  const path = url.split("?")[0];
  if (path === "/") return true;
  return PUBLIC_PREFIXES.some(
    (p) => url === p || path === p || url.startsWith(p + "/") || url.startsWith(p + "?"),
  );
}

export const authPlugin = fp(async function (fastify: FastifyInstance) {
  if (!fastify.hasRequestDecorator("consent")) {
    fastify.decorateRequest("consent", null as unknown as Consent);
  }

  fastify.addHook("onRequest", async (req: FastifyRequest) => {
    if (isPublic(req.url)) return;

    const header = req.headers["authorization"];
    if (!header || !header.startsWith("Bearer ")) {
      throw Unauthorized("Missing or malformed Authorization header — expected: Bearer <token>");
    }

    const token = header.slice(7).trim();
    if (!token) {
      throw Unauthorized("Missing or malformed Authorization header — expected: Bearer <token>");
    }

    // Verify token and attach parsed consent for downstream scope enforcement
    req.consent = parseConsent(token);
  });
});
