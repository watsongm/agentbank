# ADR 0002 — Security Model: Consent Scoping, Audit Log, Rate Limiting, and DPoP

**Status:** Accepted  
**Date:** 2026-05-24  
**Authors:** Security Hardener (Agent 4)  
**Supersedes:** Phase 3 stub auth in `src/lib/auth.ts`

---

## Context

agentBANK serves Open Banking v3.1 and BIAN v12 APIs to AI agents and third-party applications. The initial Phase 3 implementation used a static bearer-token allowlist (`demo-token` + `AGENTBANK_TOKEN` env var) with no scope enforcement, no audit trail, and no rate limiting.

For Phase 4 / Tier 2 readiness we need:

1. **Consent-based scope enforcement** — not all clients should access all endpoints
2. **Immutable audit trail** — regulatory requirement; every API call must be logged
3. **Rate limiting** — protect against abuse and AI-agent runaway loops
4. **DPoP binding** — path to FAPI 2.0 compliance (sender-constrained tokens)

---

## Decision 1 — Consent Scoping over Simple Bearer Auth

### Why not simple bearer tokens?

Simple bearer tokens are "ambient authority" — possession equals permission. They grant all-or-nothing access; there is no standard way to express that a token permits reading account balances but not initiating payments.

### Why consent scoping?

Open Banking v3.1 mandates consent objects that enumerate permitted scopes. FAPI 2.0 builds on this with sender-constrained tokens. By introducing a `ConsentScope` enum now:

- Route handlers can declare required scopes via `requiresScope(ConsentScope.READ_ACCOUNTS)`
- A compromised token leaks only the scopes it carries, not the whole API surface
- The `demo-token` continues to work (full-scope consent, 24h expiry) — no CI breakage
- Future migration to JWT-signed consents requires only updating `parseConsent()`

### Implementation

`src/lib/consent.ts` introduces:

| Export | Purpose |
|---|---|
| `ConsentScope` | Enum of all 10 permission scopes |
| `Consent` | Interface: `{ token, customerId, scopes, expiresAt }` |
| `parseConsent(token)` | Resolves `demo-token` to full-scope consent; otherwise decodes base64-JSON |
| `consentPlugin` | Fastify plugin — attaches `request.consent` on every authenticated request |
| `requiresScope(...scopes)` | `preHandler` factory — throws 403 if consent lacks required scope |

---

## Decision 2 — Immutable Audit Log (Append-Only)

### Rationale

UK FCA SYSC 9.1 and PSD2 Article 96 require financial institutions to maintain access logs. Key design choices:

**Append-only by convention:** `AuditEvent` has no `updatedAt` field and no update mutations in the application layer.

**Body hashing, not raw bodies:** Request bodies may contain PII. We store SHA-256(body) — a one-way hash allowing tamper-detection without re-exposing PII.

**Non-blocking writes:** Audit writes happen in `onResponse`. Failures are caught and logged as warnings — they never fail the original request.

### Schema

```prisma
model AuditEvent {
  id         String   @id @default(uuid())
  requestId  String
  customerId String?
  tool       String
  paramsHash String?
  statusCode Int
  latencyMs  Int
  timestamp  DateTime @default(now())
}
```

---

## Decision 3 — Rate Limiting Strategy

| Tier | Scope | Limit | Key |
|---|---|---|---|
| Global | All endpoints | 100 req/min | IP address |
| Payment endpoints | POST on payment routes | 10 req/min | `customerId` from consent |

**429 response shape:**
```json
{ "error": "RATE_LIMITED", "retryAfterSeconds": 42 }
```

`@fastify/rate-limit` is used — official Fastify 4 ecosystem plugin with per-route key generators.

---

## Decision 4 — DPoP Stub and Path to Full FAPI 2.0

### What is DPoP?

DPoP (RFC 9449) binds access tokens to a client's public key. FAPI 2.0 Security Profile mandates DPoP.

### Stub behaviour

| Condition | Action |
|---|---|
| `DPoP` header present and non-empty | `request.hasDPoP = true` |
| `DPoP` header absent | `request.hasDPoP = false` |
| Absent on POST/PATCH/DELETE/PUT | Warning log emitted |

### Path to full FAPI 2.0

1. **Phase 4A** — Validate DPoP JWT structure (`typ: dpop+jwt`, claims `htm`, `htu`, `iat`, `jti`)
2. **Phase 4B** — Verify JWK thumbprint and `ath` claim = SHA-256(access_token)
3. **Phase 4C** — jti replay cache (Redis/Postgres) to prevent replay
4. **Phase 5** — PKCE + PAR (Pushed Authorisation Requests)
5. **Phase 6** — Standards-compliant AS (Keycloak with FAPI profile)

---

## Consequences

### Positive

- Scope enforcement prevents privilege escalation
- Audit trail meets FCA SYSC 9.1 minimum requirements
- Rate limiting protects against AI-agent runaway
- `hasDPoP` flag enables gradual FAPI 2.0 tightening

### Negative / Trade-offs

- `parseConsent` base64-JSON tokens are unsigned — must be replaced with signed JWTs before production
- In-memory rate-limit store does not survive restarts; Redis backend required for multi-node
- DPoP stub provides no actual key binding — scaffold only

---

## References

- [RFC 9449 — DPoP](https://datatracker.ietf.org/doc/html/rfc9449)
- [FAPI 2.0 Security Profile](https://openid.net/specs/fapi-security-profile-2_0-final.html)
- [Open Banking UK — Consent and Authorisation](https://standards.openbanking.org.uk/api-specifications/security/)
- [FCA SYSC 9.1 — Record keeping](https://www.handbook.fca.org.uk/handbook/SYSC/9/)
- ADR 0001 — Backend Stack (`docs/adr/0001-backend-stack.md`)
