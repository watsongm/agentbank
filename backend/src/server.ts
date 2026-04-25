// agentBANK reference backend — entrypoint.
// See docs/adr/0001-backend-stack.md for stack rationale.

import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";

import { prisma } from "./lib/db.js";
import { errorHandler } from "./lib/errors.js";
import { fapiPlugin } from "./lib/fapi.js";
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
  await app.register(fapiPlugin);

  app.setErrorHandler(errorHandler);

  // Health
  app.get("/health", async () => {
    const dbOk = await prisma.$queryRaw`SELECT 1`
      .then(() => true)
      .catch(() => false);
    return {
      status: "ok",
      version: "0.1.0",
      service: "agentbank-backend",
      dependencies: { postgres: dbOk ? "ok" : "unreachable" },
      timestamp: new Date().toISOString(),
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

  // Domains
  await app.register(partyRoutes);
  await app.register(accountsRoutes);
  await app.register(transactionsRoutes);
  await app.register(paymentsRoutes);

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
