# @agentbank/backend

The reference backend for agentBANK — implements the OpenAPI v3.1.11 surface and 10 BIAN service domains over Fastify + Prisma + Postgres. Serves the SDK (`../sdk/`) and MCP server (`../mcp-server/`) with real, persistent data.

> **Status: Tier 1 in progress.** This directory is being built out as part of Plan A — "from reference to runnable reference" (see `../../Projects--agentbank/plan-a-code-capability.md`).

## Quick start

```bash
# From the repo root
docker compose up --build       # full stack: backend + postgres

# Or locally with a running Postgres
cd backend
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run dev                     # http://localhost:3000
```

Health check:

```bash
curl http://localhost:3000/health
```

## Layout

```
backend/
├── prisma/
│   ├── schema.prisma      # 10 BIAN domains + audit log
│   └── seed.ts            # 3 personas × 2 accounts × 90 days
├── src/
│   ├── server.ts          # Fastify entrypoint
│   ├── lib/               # shared helpers (db, logger, errors)
│   └── domains/
│       ├── party/
│       ├── accounts/
│       └── ... (payments, transactions, lending, cards,
│                savings, investments, compliance, notifications)
├── .env.example
├── tsconfig.json
└── package.json
```

## What's implemented today

| Domain | Endpoints | Status |
|---|---|---|
| Party | 4 | in progress |
| Accounts | 3 of 5 | in progress |
| Payments | 0 of 6 | pending |
| Transactions | 0 of 4 | pending |
| Lending | 0 of 5 | pending |
| Cards | 0 of 5 | pending |
| Savings | 0 of 4 | pending |
| Investments | 0 of 4 | pending |
| Compliance | 0 of 4 | pending |
| Notifications | 0 of 3 | pending |

See [the plan](../../Projects--agentbank/plan-a-code-capability.md) for the full roadmap.

## Environment

See `.env.example`. The backend reads `DATABASE_URL`, `PORT`, `LOG_LEVEL`, and observability / auth knobs.

## Contributing

This is a reference implementation. Keep routes thin, put business logic in `domains/<name>/service.ts`, keep Prisma calls in `domains/<name>/repository.ts`. Zod schemas under `domains/<name>/schema.ts` are shared with the SDK and MCP server.
