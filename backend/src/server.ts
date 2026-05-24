// agentBANK reference backend — entrypoint.
// See docs/adr/0001-backend-stack.md for stack rationale.
// See docs/adr/0002-security-model.md for security layer rationale.

import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import rateLimit from "@fastify/rate-limit";

import { prisma } from "./lib/db.js";
import { errorHandler } from "./lib/errors.js";
import { fapiPlugin } from "./lib/fapi.js";
import { authPlugin } from "./lib/auth.js";
import { consentPlugin, ConsentScope, requiresScope } from "./lib/consent.js";
import { auditPlugin } from "./lib/audit.js";
import { dpopPlugin } from "./lib/dpop.js";
import { openApiRoutes } from "./lib/openapi.js";
import { partyRoutes } from "./domains/party/routes.js";
import { accountsRoutes } from "./domains/accounts/routes.js";
import { transactionsRoutes } from "./domains/transactions/routes.js";
import { paymentsRoutes } from "./domains/payments/routes.js";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";
const LOG_LEVEL = process.env.LOG_LEVEL ?? "info";

async function buildServer() {
  // Only opt into pino-pretty when LOG_PRETTY=1 is explicitly set —
  // CI / prod / smoke tests use plain JSON logging so we don't have to
  // ship pino-pretty in every install.
  const logger =
    process.env.LOG_PRETTY === "1"
      ? {
          level: LOG_LEVEL,
          transport: { target: "pino-pretty", options: { colorize: true } },
        }
      : { level: LOG_LEVEL };

  const app = Fastify({
    logger,
    genReqId: () => crypto.randomUUID(),
    disableRequestLogging: false,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: true, credentials: true });
  await app.register(sensible);

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

  // ── Domain routes with scope enforcement ─────────────────────────────────

  // Party — requires READ_PARTY
  await app.register(async (instance) => {
    instance.addHook("preHandler", requiresScope(ConsentScope.READ_PARTY));
    await instance.register(partyRoutes);
  });

  // Accounts — requires READ_ACCOUNTS
  await app.register(async (instance) => {
    instance.addHook("preHandler", requiresScope(ConsentScope.READ_ACCOUNTS));
    await instance.register(accountsRoutes);
  });

  // Transactions — requires READ_TRANSACTIONS
  await app.register(async (instance) => {
    instance.addHook("preHandler", requiresScope(ConsentScope.READ_TRANSACTIONS));
    await instance.register(transactionsRoutes);
  });

  // Payments — requires INITIATE_PAYMENT; POST endpoints also have tighter rate limit
  await app.register(async (instance) => {
    instance.addHook("preHandler", requiresScope(ConsentScope.INITIATE_PAYMENT));

    // Tighter rate limit for payment initiation: 10 req/min per customerId
    // Applied to POST /open-banking/v3.1/domestic-payments etc.
    const paymentRateLimitConfig = {
      max: 10,
      timeWindow: "1 minute",
      keyGenerator: (req: any) => {
        // Use the type-augmented FastifyRequest
        const r = req as unknown as { consent?: { customerId?: string }; ip: string };
        return r.consent?.customerId ?? r.ip;
      },
      errorResponseBuilder: (_req: unknown, context: { ttl: number }) => ({
        error: "RATE_LIMITED",
        retryAfterSeconds: Math.ceil(context.ttl / 1000),
      }),
    };

    instance.post(
      "/open-banking/v3.1/domestic-payments",
      { config: { rateLimit: paymentRateLimitConfig } },
      async () => ({}), // placeholder — real handler registered via paymentsRoutes
    );

    await instance.register(paymentsRoutes);
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
  }
}

// Only run when invoked directly (not when imported by tests)
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  void main();
}

export { buildServer };
