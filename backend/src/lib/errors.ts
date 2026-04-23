// Uniform error envelope matching the Open Banking v3.1 error shape.
// See openapi.yaml for the canonical schema.

import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

export class AgentBankError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "AgentBankError";
  }
}

export const NotFound = (what: string) =>
  new AgentBankError(404, "NotFound", `${what} not found`);

export const BadRequest = (msg: string, details?: unknown) =>
  new AgentBankError(400, "BadRequest", msg, details);

export const Unauthorized = (msg = "Invalid or missing credentials") =>
  new AgentBankError(401, "Unauthorized", msg);

export const Forbidden = (msg = "Scope does not permit this action") =>
  new AgentBankError(403, "Forbidden", msg);

export const Conflict = (msg: string) =>
  new AgentBankError(409, "Conflict", msg);

export function errorHandler(
  err: FastifyError | AgentBankError | Error,
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const fapiId = (req.headers["x-fapi-interaction-id"] as string) ?? req.id;

  if (err instanceof AgentBankError) {
    return reply.status(err.statusCode).send({
      Code: err.code,
      Message: err.message,
      Details: err.details ?? null,
      FapiInteractionId: fapiId,
    });
  }

  // Zod-style validation error from Fastify schema compiler
  if ("validation" in err && err.validation) {
    return reply.status(400).send({
      Code: "BadRequest",
      Message: err.message,
      Details: err.validation,
      FapiInteractionId: fapiId,
    });
  }

  req.log.error({ err }, "unhandled error");
  return reply.status(500).send({
    Code: "InternalServerError",
    Message: "An unexpected error occurred",
    Details: null,
    FapiInteractionId: fapiId,
  });
}
