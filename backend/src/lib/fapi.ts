// FAPI interaction-id propagation.
// Every request must have an x-fapi-interaction-id header — we generate
// one if the client omitted it, and echo it on the response.

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import fp from "fastify-plugin";

export const fapiPlugin = fp(async function (fastify: FastifyInstance) {
  fastify.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    const incoming = req.headers["x-fapi-interaction-id"];
    const id = typeof incoming === "string" && incoming.length > 0 ? incoming : randomUUID();
    (req.headers as Record<string, string>)["x-fapi-interaction-id"] = id;
    reply.header("x-fapi-interaction-id", id);
  });
});
