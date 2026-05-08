// FAPI bearer-token validation plugin.
// Phase 3 stub: validates that every non-public request carries a well-formed
// Authorization: Bearer <token> header. Accepted tokens are:
//   • the value of AGENTBANK_TOKEN env var (the service-level token)
//   • the literal string "demo-token" (CI smoke tests, local dev)
//
// Phase 4 (Tier 2): replace the static-set check with JWT signature
// verification + scope extraction from the token claims.

import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { Unauthorized } from "./errors.js";

// Routes that bypass auth — docs, health, and the root index
const PUBLIC_PREFIXES = ["/docs", "/openapi.json", "/health", "/"] as const;

function isPublic(url: string): boolean {
  return PUBLIC_PREFIXES.some((p) => url === p || url.startsWith(p + "?"));
}

// Build the set of accepted tokens once at startup
function buildValidTokens(): Set<string> {
  const tokens = new Set(["demo-token"]);
  const envToken = process.env.AGENTBANK_TOKEN;
  if (envToken) {
    // Accept the raw value and the value without a "Bearer " prefix
    tokens.add(envToken);
    tokens.add(envToken.replace(/^Bearer\s+/i, ""));
  }
  return tokens;
}

export const authPlugin = fp(async function (fastify: FastifyInstance) {
  const validTokens = buildValidTokens();

  fastify.addHook("onRequest", async (req: FastifyRequest) => {
    if (isPublic(req.url)) return;

    const header = req.headers["authorization"];
    if (!header || !header.startsWith("Bearer ")) {
      throw Unauthorized("Missing or malformed Authorization header — expected: Bearer <token>");
    }

    const token = header.slice(7).trim();
    if (!validTokens.has(token)) {
      throw Unauthorized("Invalid or expired token");
    }

    // Phase 4 (Tier 2): extract sub, scope, and party claims from JWT here
    // and attach them to req for downstream scope enforcement.
  });
});
