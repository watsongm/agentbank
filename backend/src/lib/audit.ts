// Immutable Audit Log plugin.
// Hooks into Fastify's onResponse lifecycle to write an AuditEvent and
// hash-chained AuditLog entry for every request. Request bodies are hashed
// (SHA-256) — raw PII is never stored.
// See docs/adr/0002-security-model.md for the append-only & hash-chain rationale.

import fp from "fastify-plugin";
import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "./db.js";

// ─────────────────────────────────────────────────────────────────────────────
// SHA-256 helpers
// ─────────────────────────────────────────────────────────────────────────────

function sha256String(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function sha256(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  try {
    const str =
      typeof input === "string" ? input : JSON.stringify(input);
    return sha256String(str);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hash-Chained In-Memory Ring Buffer (last 100 audit events)
// ─────────────────────────────────────────────────────────────────────────────

export interface AuditChainEntry {
  id: string;
  requestId: string;
  fapiInteractionId: string;
  customerId: string | null;
  tool: string;
  method: string;
  path: string;
  statusCode: number;
  latencyMs: number;
  paramsHash: string | null;
  prevHash: string;
  rowHash: string;
  timestamp: string;
}

const MAX_RECENT_EVENTS = 100;
const recentAuditEvents: AuditChainEntry[] = [];
let lastRowHash = "GENESIS";

function computeRowHash(entry: {
  timestamp: string;
  customerId: string | null;
  tool: string;
  prevHash: string;
  paramsHash: string | null;
  statusCode: number;
}): string {
  return sha256String(
    `${entry.timestamp}${entry.customerId ?? ""}${entry.tool}${entry.prevHash}${entry.paramsHash ?? ""}${entry.statusCode}`,
  );
}

export function getRecentAuditEvents(): AuditChainEntry[] {
  return [...recentAuditEvents];
}

export function verifyAuditChain(): {
  valid: boolean;
  totalVerified: number;
  headHash: string;
  brokenAt: number | null;
} {
  for (let i = 0; i < recentAuditEvents.length; i++) {
    const entry = recentAuditEvents[i]!;
    const expectedHash = computeRowHash(entry);
    if (entry.rowHash !== expectedHash) {
      return {
        valid: false,
        totalVerified: i,
        headHash: lastRowHash,
        brokenAt: i,
      };
    }
    if (i > 0 && entry.prevHash !== recentAuditEvents[i - 1]!.rowHash) {
      return {
        valid: false,
        totalVerified: i,
        headHash: lastRowHash,
        brokenAt: i,
      };
    }
  }
  return {
    valid: true,
    totalVerified: recentAuditEvents.length,
    headHash: lastRowHash,
    brokenAt: null,
  };
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
        const paramsHash = sha256(req.body);

        // Route path (Fastify 4 routeOptions.url)
        const path = req.routeOptions?.url ?? req.url.split("?")[0];

        // Endpoint label: METHOD /path
        const tool = `${req.method} ${path}`;

        const fapiInteractionId =
          (req.headers["x-fapi-interaction-id"] as string) ?? req.id;

        const timestamp = new Date().toISOString();
        const prevHash = lastRowHash;
        const rowHash = computeRowHash({
          timestamp,
          customerId,
          tool,
          prevHash,
          paramsHash,
          statusCode: reply.statusCode,
        });
        lastRowHash = rowHash;

        const entry: AuditChainEntry = {
          id: randomUUID(),
          requestId: req.id,
          fapiInteractionId,
          customerId,
          tool,
          method: req.method,
          path,
          statusCode: reply.statusCode,
          latencyMs,
          paramsHash,
          prevHash,
          rowHash,
          timestamp,
        };

        recentAuditEvents.push(entry);
        if (recentAuditEvents.length > MAX_RECENT_EVENTS) {
          recentAuditEvents.shift();
        }

        if (process.env.DATABASE_URL) {
          // Write primary AuditEvent record
          await prisma.auditEvent.create({
            data: {
              requestId: req.id,
              customerId,
              tool,
              paramsHash: paramsHash ?? undefined,
              statusCode: reply.statusCode,
              latencyMs,
            },
          });

          // Asynchronously write hash-chained AuditLog entry (non-blocking)
          void prisma.auditLog
            .create({
              data: {
                ts: new Date(timestamp),
                humanPrincipalId: customerId,
                agentIdentity:
                  (req.headers["user-agent"] as string)?.slice(0, 120) ?? "agentbank-client",
                method: req.method,
                path,
                scopeUsed: req.consent?.scopes?.join(" ") ?? null,
                fapiInteractionId,
                statusCode: reply.statusCode,
                latencyMs,
                requestHash: paramsHash ?? sha256String(""),
                responseHash: "",
                prevHash,
                rowHash,
              },
            })
            .catch(() => {
              // Non-blocking secondary log
            });
        }
      } catch (err) {
        // Never let audit failures break the response
        req.log.error({ err }, "audit: failed to write AuditEvent");
      }
    },
  );
});
