import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/db.js";
import { SEED } from "../../lib/constants.js";
import { BadRequest } from "../../lib/errors.js";
import {
  ALL_SCOPES,
  mapOAuthScopesToConsentScopes,
} from "../../lib/consent.js";
import { OAuthTokenInput } from "./schema.js";

const DEFAULT_SCOPE_STRING =
  "accounts:read payments:write lending:read lending:write cards:read cards:write savings:read savings:write investments:read investments:write compliance:read compliance:write notifications:write party:read";

function normalizeBody(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    const params = new URLSearchParams(raw);
    const obj: Record<string, string> = {};
    for (const [k, v] of params.entries()) {
      obj[k] = v;
    }
    return obj;
  }
  if (typeof raw === "object") {
    return raw as Record<string, unknown>;
  }
  return {};
}

export async function oauthRoutes(app: FastifyInstance) {
  if (!app.hasContentTypeParser("application/x-www-form-urlencoded")) {
    app.addContentTypeParser(
      "application/x-www-form-urlencoded",
      { parseAs: "string" },
      (_req, body, done) => {
        try {
          const params = new URLSearchParams(body as string);
          const result: Record<string, string> = {};
          for (const [k, v] of params.entries()) {
            result[k] = v;
          }
          done(null, result);
        } catch (err) {
          done(err as Error, undefined);
        }
      },
    );
  }

  // POST /open-banking/v3.1/oauth/token
  app.post("/open-banking/v3.1/oauth/token", async (req) => {
    const input = OAuthTokenInput.parse(normalizeBody(req.body));
    const grantType = input.grant_type || "client_credentials";

    if (
      grantType !== "client_credentials" &&
      grantType !== "authorization_code" &&
      grantType !== "refresh_token"
    ) {
      throw BadRequest(`Unsupported grant_type: ${grantType}`);
    }

    const requestedScope =
      input.scope && input.scope.trim().length > 0
        ? input.scope.trim()
        : DEFAULT_SCOPE_STRING;

    const mappedScopes = mapOAuthScopesToConsentScopes(requestedScope);
    const scopes = mappedScopes.length > 0 ? mappedScopes : ALL_SCOPES;

    const rawCustomer = input.customer_id ?? input.sub ?? SEED.ARIA_PARTY_REF;
    const customerId =
      rawCustomer === "P-00291847" ? SEED.ARIA_PARTY_REF : rawCustomer;

    const expiresIn = 3600;
    const expiresAtDate = new Date(Date.now() + expiresIn * 1000);
    const expiresAt = expiresAtDate.toISOString();

    const accessToken = Buffer.from(
      JSON.stringify({ customerId, scopes, expiresAt }),
      "utf8",
    ).toString("base64");

    // Non-blocking persistence of Consent if client + party exist in DB
    const clientId = input.client_id || "agentbank-sdk";
    void (async () => {
      try {
        const [client, party] = await Promise.all([
          prisma.client.findUnique({ where: { clientId } }),
          prisma.party.findFirst({
            where: { OR: [{ partyRef: customerId }, { id: customerId }] },
          }),
        ]);
        if (client && party) {
          const consentRef = `CNS-${Date.now().toString(36).toUpperCase()}-${Math.floor(
            100 + Math.random() * 900,
          )}`;
          await prisma.consent.create({
            data: {
              consentRef,
              partyId: party.id,
              clientId: client.id,
              scopes,
              status: "ACTIVE",
              expiresAt: expiresAtDate,
            },
          });
        }
      } catch {
        // Non-blocking audit/consent persistence
      }
    })();

    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: expiresIn,
      scope: requestedScope,
      consent_scopes: scopes,
    };
  });
}
