/**
 * backend/src/lib/logger.ts
 *
 * Typed log helper for structured logging in agentBANK.
 *
 * Usage:
 *   import { log } from "./lib/logger.js";
 *   log(app.log).info({ customerId: "C-001", domain: "payments", tool: "initiate_payment" }, "payment initiated");
 *
 * Every call is a thin wrapper around pino that ensures the standard
 * agentBANK fields are always present in the log entry alongside
 * Fastify's built-in {requestId, method, url, statusCode, latencyMs}.
 */

import type { FastifyBaseLogger } from "fastify";

// ── Types ────────────────────────────────────────────────────────────────────

/** Standard fields added to every structured log line by agentBANK code. */
export interface AgentBankLogFields {
  /** The BIAN/Open Banking customer ID (e.g. "C-001"). */
  customerId?: string;
  /** The BIAN service domain (e.g. "payments", "accounts", "party"). */
  domain?: string;
  /** The agent tool name as registered in the tool registry (e.g. "initiate_payment"). */
  tool?: string;
  /** FAPI interaction ID — normally set automatically by fapiPlugin. */
  fapiInteractionId?: string;
  /** Any additional ad-hoc key-value pairs. */
  [key: string]: unknown;
}

// ── Logger wrapper ───────────────────────────────────────────────────────────

/**
 * Returns a pino-compatible logger bound to `AgentBankLogFields`.
 *
 * Calling `log(request.log).info(fields, message)` ensures TypeScript
 * enforces that all custom fields are in `AgentBankLogFields`.
 *
 * @example
 * // In a route handler:
 * log(request.log).info({ customerId: "C-001", domain: "accounts" }, "balance fetched");
 */
export function log(logger: FastifyBaseLogger) {
  return {
    trace: (fields: AgentBankLogFields, message: string) =>
      logger.trace(fields, message),
    debug: (fields: AgentBankLogFields, message: string) =>
      logger.debug(fields, message),
    info: (fields: AgentBankLogFields, message: string) =>
      logger.info(fields, message),
    warn: (fields: AgentBankLogFields, message: string) =>
      logger.warn(fields, message),
    error: (fields: AgentBankLogFields, message: string) =>
      logger.error(fields, message),
    fatal: (fields: AgentBankLogFields, message: string) =>
      logger.fatal(fields, message),
  };
}

// ── Fastify serializer config ────────────────────────────────────────────────

/**
 * Pino serializers to merge into the Fastify logger config in server.ts.
 *
 * These ensure every request/response log line includes:
 *   { requestId, method, url, statusCode, latencyMs }
 *
 * Fastify's default request serializer already captures req.id, req.method
 * and req.url.  The response serializer captures statusCode.  We add latencyMs
 * by reading the responseTime that Fastify attaches to the reply object.
 */
export const loggerSerializers = {
  req(request: {
    id: string;
    method: string;
    url: string;
    [key: string]: unknown;
  }) {
    return {
      requestId: request.id,
      method: request.method,
      url: request.url,
    };
  },
  res(reply: {
    statusCode: number;
    elapsedTime?: number;
    [key: string]: unknown;
  }) {
    return {
      statusCode: reply.statusCode,
      latencyMs: reply.elapsedTime !== undefined
        ? Math.round(reply.elapsedTime)
        : undefined,
    };
  },
};
