// agentBANK reference backend — entrypoint.
// See docs/adr/0001-backend-stack.md for stack rationale.
// See docs/adr/0002-security-model.md for security layer rationale.

import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import rateLimit from "@fastify/rate-limit";

import { prisma } from "./lib/db.js";
import { SEED } from "./lib/constants.js";
import { errorHandler } from "./lib/errors.js";
import { fapiPlugin } from "./lib/fapi.js";
import { authPlugin } from "./lib/auth.js";
import {
  consentPlugin,
  ConsentScope,
  requiresScope,
  requiresAnyScope,
} from "./lib/consent.js";
import {
  auditPlugin,
  getRecentAuditEvents,
  verifyAuditChain,
} from "./lib/audit.js";
import { dpopPlugin } from "./lib/dpop.js";
import { metricsPlugin } from "./lib/metrics.js";
import { loggerSerializers } from "./lib/logger.js";
import { openApiRoutes } from "./lib/openapi.js";
import { partyRoutes } from "./domains/party/routes.js";
import { accountsRoutes } from "./domains/accounts/routes.js";
import { transactionsRoutes } from "./domains/transactions/routes.js";
import { paymentsRoutes } from "./domains/payments/routes.js";
import { lendingRoutes } from "./domains/lending/routes.js";
import { cardsRoutes } from "./domains/cards/routes.js";
import { savingsRoutes } from "./domains/savings/routes.js";
import { investmentsRoutes } from "./domains/investments/routes.js";
import { complianceRoutes } from "./domains/compliance/routes.js";
import { notificationsRoutes } from "./domains/notifications/routes.js";
import { oauthRoutes } from "./domains/oauth/routes.js";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";
const LOG_LEVEL = process.env.LOG_LEVEL ?? "info";

function inferDomainFromPath(path: string): string {
  if (path.includes("party")) return "party";
  if (path.includes("loan")) return "lending";
  if (path.includes("card") || path.includes("statements")) return "cards";
  if (path.includes("savings")) return "savings";
  if (path.includes("portfolio")) return "investments";
  if (path.includes("aml") || path.includes("regulatory")) return "compliance";
  if (path.includes("event-history") || path.includes("webhook")) return "notifications";
  if (path.includes("payment")) return "payments";
  if (path.includes("transaction")) return "transactions";
  if (path.includes("account")) return "accounts";
  return "accounts";
}

async function buildServer() {
  // Only opt into pino-pretty when LOG_PRETTY=1 is explicitly set —
  // CI / prod / smoke tests use plain JSON logging so we don't have to
  // ship pino-pretty in every install.
  const logger =
    process.env.LOG_PRETTY === "1"
      ? {
          level: LOG_LEVEL,
          serializers: loggerSerializers as any,
          transport: { target: "pino-pretty", options: { colorize: true } },
        }
      : {
          level: LOG_LEVEL,
          serializers: loggerSerializers as any,
        };

  const app = Fastify({
    logger,
    genReqId: () => crypto.randomUUID(),
    disableRequestLogging: false,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: true, credentials: true });
  await app.register(sensible);

  // ── Prometheus metrics (registers GET /metrics before auth gate) ──────────
  await app.register(metricsPlugin);

  // ── Rate Limiting ─────────────────────────────────────────────────────────
  // Global: 100 req/min per IP.
  // Payment POST endpoints override this with 10 req/min per customerId.
  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: "1 minute",
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: (_req, context) => ({
      error: "RATE_LIMITED",
      retryAfterSeconds: Math.ceil((context as { ttl: number }).ttl / 1000),
    }),
  });

  // ── Security plugins ──────────────────────────────────────────────────────
  await app.register(fapiPlugin);
  await app.register(authPlugin);
  await app.register(consentPlugin);
  await app.register(dpopPlugin);

  // ── Audit log (runs on every response, after the reply is sent) ───────────
  await app.register(auditPlugin);

  app.setErrorHandler(errorHandler);

  // Health
  app.get("/health", async () => {
    const dbOk = await prisma.$queryRaw`SELECT 1`
      .then(() => true)
      .catch(() => false);
    return {
      status: "ok",
      version: "1.0.0",
      uptime: process.uptime(),
      db: dbOk ? "connected" : "degraded",
    };
  });

  app.get("/", async () => ({
    name: "agentBANK",
    tagline: "The AI-native reference bank",
    docs: "/docs",
    openapi: "/openapi.json",
    health: "/health",
    metrics: "/metrics",
    observability: "/observability/sessions",
  }));

  // ── Observability & Audit Chain Verification Endpoints ────────────────────
  app.get("/observability/sessions", async () => {
    const events = getRecentAuditEvents();
    const sessions = events
      .slice()
      .reverse()
      .map((e, idx) => ({
        id: `SES-LIVE-${String(events.length - idx).padStart(4, "0")}`,
        requestId: e.requestId,
        traceId: e.fapiInteractionId || e.requestId,
        fapiInteractionId: e.fapiInteractionId,
        customer: e.customerId ?? SEED.ARIA_PARTY_REF,
        customerId: e.customerId,
        model: "claude-sonnet-4-6",
        tool: e.tool,
        method: e.method,
        path: e.path,
        domain: inferDomainFromPath(e.path),
        latency: e.latencyMs,
        latencyMs: e.latencyMs,
        statusCode: e.statusCode,
        inputTok: 1200,
        outputTok: 380,
        totalTok: 1580,
        toolCalls: 1,
        status: e.statusCode < 400 ? "success" : "error",
        paramsHash: e.paramsHash,
        prevHash: e.prevHash,
        rowHash: e.rowHash,
        timestamp: e.timestamp,
        ts: new Date(e.timestamp).getTime(),
      }));

    const totalEvents = events.length;
    const avgLatencyMs =
      totalEvents > 0
        ? Math.round(events.reduce((sum, e) => sum + e.latencyMs, 0) / totalEvents)
        : 0;
    const errorCount = events.filter((e) => e.statusCode >= 400).length;

    return {
      sessions,
      events,
      auditChain: verifyAuditChain(),
      summary: {
        totalEvents,
        avgLatencyMs,
        errorCount,
        uptime: process.uptime(),
      },
    };
  });

  app.get("/observability/audit-verify", async () => ({
    ...verifyAuditChain(),
    eventsCount: getRecentAuditEvents().length,
    timestamp: new Date().toISOString(),
  }));

  // OpenAPI: spec at /openapi.json, Scalar UI at /docs (when available)
  await app.register(openApiRoutes);
  try {
    const scalar = await import("@scalar/fastify-api-reference");
    await app.register(scalar.default, {
      routePrefix: "/docs",
      configuration: { url: "/openapi.json" },
    });
  } catch (err) {
    app.log.warn({ err }, "@scalar/fastify-api-reference not installed; /docs disabled");
  }

  // ── OAuth 2.0 Token Endpoint ──────────────────────────────────────────────
  await app.register(oauthRoutes);

  // ── Domain routes with scope enforcement ─────────────────────────────────

  // 1. Party — requires READ_PARTY or WRITE_PARTY
  await app.register(async (instance) => {
    instance.addHook(
      "preHandler",
      requiresAnyScope(ConsentScope.READ_PARTY, ConsentScope.WRITE_PARTY),
    );
    await instance.register(partyRoutes);
  });

  // 2. Accounts — requires READ_ACCOUNTS, WRITE_ACCOUNTS, or READ_BALANCES
  await app.register(async (instance) => {
    instance.addHook(
      "preHandler",
      requiresAnyScope(
        ConsentScope.READ_ACCOUNTS,
        ConsentScope.WRITE_ACCOUNTS,
        ConsentScope.READ_BALANCES,
      ),
    );
    await instance.register(accountsRoutes);
  });

  // 3. Payments — requires INITIATE_PAYMENT
  await app.register(async (instance) => {
    instance.addHook("preHandler", requiresScope(ConsentScope.INITIATE_PAYMENT));
    await instance.register(paymentsRoutes);
  });

  // 4. Transactions — requires READ_TRANSACTIONS
  await app.register(async (instance) => {
    instance.addHook("preHandler", requiresScope(ConsentScope.READ_TRANSACTIONS));
    await instance.register(transactionsRoutes);
  });

  // 5. Consumer Lending — requires READ_LOANS or APPLY_LOAN
  await app.register(async (instance) => {
    instance.addHook(
      "preHandler",
      requiresAnyScope(ConsentScope.READ_LOANS, ConsentScope.APPLY_LOAN),
    );
    await instance.register(lendingRoutes);
  });

  // 6. Credit & Debit Cards — requires READ_CARDS or BLOCK_CARD
  await app.register(async (instance) => {
    instance.addHook(
      "preHandler",
      requiresAnyScope(ConsentScope.READ_CARDS, ConsentScope.BLOCK_CARD),
    );
    await instance.register(cardsRoutes);
  });

  // 7. Savings & Deposits — requires READ_SAVINGS, READ_ACCOUNTS, or WRITE_ACCOUNTS
  await app.register(async (instance) => {
    instance.addHook(
      "preHandler",
      requiresAnyScope(
        ConsentScope.READ_SAVINGS,
        ConsentScope.READ_ACCOUNTS,
        ConsentScope.WRITE_ACCOUNTS,
      ),
    );
    await instance.register(savingsRoutes);
  });

  // 8. Investment Portfolio — requires READ_PORTFOLIO, PLACE_ORDER, or MANAGE_INVESTMENTS
  await app.register(async (instance) => {
    instance.addHook(
      "preHandler",
      requiresAnyScope(
        ConsentScope.READ_PORTFOLIO,
        ConsentScope.PLACE_ORDER,
        ConsentScope.MANAGE_INVESTMENTS,
      ),
    );
    await instance.register(investmentsRoutes);
  });

  // 9. Regulatory Compliance — requires RUN_AML
  await app.register(async (instance) => {
    instance.addHook("preHandler", requiresAnyScope(ConsentScope.RUN_AML));
    await instance.register(complianceRoutes);
  });

  // 10. Customer Notifications — requires SUBSCRIBE_EVENTS or READ_NOTIFICATIONS
  await app.register(async (instance) => {
    instance.addHook(
      "preHandler",
      requiresAnyScope(
        ConsentScope.SUBSCRIBE_EVENTS,
        ConsentScope.READ_NOTIFICATIONS,
      ),
    );
    await instance.register(notificationsRoutes);
  });

  return app;
}

async function main() {
  const app = await buildServer();

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "shutting down");
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info({ port: PORT }, "agentBANK backend listening");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  };
}

// Only run when invoked directly (not when imported by tests)
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  void main();
}

export { buildServer };
