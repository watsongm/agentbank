# ADR 0001 — Backend stack for agentBANK reference implementation

- **Status:** Accepted
- **Date:** 2026-04-23
- **Context:** Plan A, Tier 1 — "from reference to runnable reference"

## Context

agentBANK today is a React + Vite frontend talking to an in-memory mock (`src/mock/api.js`). The `mcp-server/` and `sdk/` packages are written against a real HTTP surface that does not exist yet. Plan A commits to making `openapi.yaml` executable so design partners can integrate against a live backend.

We need a stack that:

1. Is ergonomic for an AI-native reference (readable by both humans and LLMs).
2. Produces typed schemas shared between backend, SDK, and MCP server — one source of truth.
3. Supports OpenAPI-first development with contract testing.
4. Runs in a single `docker compose up` for design partners.
5. Scales down to a Raspberry Pi demo and up to a cloud-hosted reference.
6. Doesn't saddle us with licensing surprises as we layer in OIDF / FAPI / OTEL dependencies.

## Decision

| Concern | Choice |
|---|---|
| Runtime | Node.js 20 LTS |
| Language | TypeScript (strict) |
| HTTP framework | **Fastify 4** |
| Validation | **Zod** (shared with SDK and MCP server) |
| ORM | **Prisma 5** |
| Database | **Postgres 16** (SQLite in dev optional) |
| Queue | **BullMQ** + **Redis 7** |
| Logging | **Pino** (JSON) |
| Tracing | **OpenTelemetry** (OTLP → Jaeger in dev) |
| Testing | **Vitest** (unit) + **Dredd** (contract) + **Playwright** (e2e) |
| Container | Docker + docker-compose |
| Package manager | npm (align with existing root) |

## Rationale

### Fastify over Express / Hono

- Fastest general-purpose Node framework with stable API, active maintainers, and a large ecosystem of typed plugins (`@fastify/swagger`, `@fastify/rate-limit`, `@fastify/oauth2`, `@fastify/websocket`).
- First-class JSON-schema support, which maps cleanly onto our OpenAPI-first workflow — we can serve `openapi.yaml` and validate against it with the same tooling.
- Hono was considered (edge-friendly, elegant) but the auth/FAPI plugin ecosystem is thinner and we don't need edge runtime for a reference.
- Express rejected on performance and the dated middleware model.

### Prisma over Drizzle / Kysely

- Schema-first generator produces both migrations and types; readable `schema.prisma` is a strong narrative artefact for a reference implementation.
- Trade-off accepted: Prisma query engine adds a runtime binary; we judge that acceptable for a reference where DX and legibility matter more than hot-path microseconds.
- Drizzle reconsidered if we later hit edge-runtime requirements.

### Postgres over MySQL / SQLite-only

- JSONB, range types, partial indexes, and `pg_partman` partitioning all land-useful for audit log at scale.
- SQLite retained as an optional dev-only target for the "clone, run, read" onboarding; switch via `DATABASE_URL`.

### Zod shared across layers

- Single source of truth for schemas — `backend/src/domains/*/schema.ts` exports Zod types consumed by backend routes, SDK, and MCP server.
- Prior art: `mcp-server/index.js` already uses Zod. Continuing avoids a second schema language.

### OpenTelemetry from day one

- The Observability tab currently renders mock spans. OTEL from the first endpoint ensures the UI flips to real traces the moment we cut over.

## Consequences

- All three packages (`backend`, `sdk`, `mcp-server`) converge on the same Zod schemas — we will extract a `contracts/` workspace package in a follow-up commit.
- The `openapi.yaml` file becomes generated output from Zod + Fastify routes (via `@fastify/swagger`). The hand-authored spec becomes the acceptance test — contract tests run `openapi.yaml` against the generated schema and fail on drift.
- Docker compose boot-time goal: under 15 seconds cold on a developer laptop.
- FAPI 2.0 DPoP middleware will be a custom Fastify plugin — no mainstream library covers this yet at the quality we need.

## Alternatives rejected

| Option | Reason rejected |
|---|---|
| NestJS | Opinionated DI + decorator heavy — adds ceremony without buying us anything for a reference |
| tRPC | Elegant but anti-goal: our contract IS the REST / OpenAPI surface |
| Go + Huma | Superior performance and FAPI gateway lineage, but fragments the repo across two languages |
| Python + FastAPI | Same fragmentation concern; also weakens the "one stack" narrative for developers |
| Deno | Smaller plugin ecosystem for banking-grade auth primitives |

## Revisit criteria

Revisit this ADR if any of:

- A design partner pushes volumes where Prisma's query-engine overhead becomes material.
- FAPI 2.0 conformance tooling matures significantly in another ecosystem (e.g. Java).
- Edge runtime (Cloudflare Workers) becomes a product requirement.

## References

- Plan A — Code Capability, §4 Tier 1 (Projects--agentbank/plan-a-code-capability.md)
- Fastify benchmarks: fastify.io/benchmarks
- Prisma schema reference: prisma.io/docs/orm/prisma-schema
