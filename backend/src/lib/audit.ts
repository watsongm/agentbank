// Immutable Audit Log plugin.
// Hooks into Fastify's onResponse lifecycle to write an AuditEvent for every
// request. Request bodies are hashed (SHA-256) — raw PII is never stored.
// See docs/adr/0002-security-model.md for the append-only rationale.

import fp from "fastify-plugin";
import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "./db.js";

// ─────────────────────────────────────────────────────────────────────────────
// SHA-256 helper
// ─────────────────────────────────────────────────────────────────────────────

function sha256(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  try {
    const str =
      typeof input === "string" ? input : JSON.stringify(input);
    return createHash("sha256").update(str, "utf8").digest("hex");
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// auditPlugin
// ─────────────────────────────────────────────────────────────────────────────

export const auditPlugin = fp(async function (fastify: FastifyInstance) {
  fastify.addHook(
    "onResponse",
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const startTime = (req as any).startTime ?? Date.now();
        const latencyMs = Math.round(reply.elapsedTime ?? (Date.now() - startTime));

        // Resolve customerId from consent if available; fall back to null
        const customerId: string | null =
          (req as FastifyRequest & { consent?: { customerId?: string } }).consent
            ?.customerId ?? null;

        // Hash the request body — never log raw PII
        const paramsHash = sha256(req.body) ?? undefined;

        // Endpoint label: METHOD /path
        const tool = `${req.method} ${req.routerPath ?? req.url}`;

        await prisma.auditEvent.create({
          data: {
            requestId: req.id,
            customerId,
            tool,
            paramsHash,
            statusCode: reply.statusCode,
            latencyMs,
          },
        });
      } catch (err) {
        // Never let audit failures break the response
        req.log.error({ err }, "audit: failed to write AuditEvent");
      }
    },
  );
});
