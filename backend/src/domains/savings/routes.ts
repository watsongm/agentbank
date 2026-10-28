import type { FastifyInstance } from "fastify";
import { InitiateSavingsInput, UpdateSavingsInput } from "./schema.js";
import { savingsService } from "./service.js";

export async function savingsRoutes(app: FastifyInstance) {
  // POST /bian/savings-account/initiate — open savings account or term deposit
  app.post("/bian/savings-account/initiate", async (req, reply) => {
    const input = InitiateSavingsInput.parse(req.body ?? {});
    const result = await savingsService.initiate(input);
    return reply.code(201).send(result);
  });

  // GET /bian/savings-account/:accountId/retrieve — savings account details
  app.get<{ Params: { accountId: string } }>(
    "/bian/savings-account/:accountId/retrieve",
    async (req) => {
      return savingsService.retrieve(req.params.accountId);
    },
  );

  // GET /bian/savings-account/:accountId/interest — interest accrual and projections
  app.get<{ Params: { accountId: string } }>(
    "/bian/savings-account/:accountId/interest",
    async (req) => {
      return savingsService.getInterest(req.params.accountId);
    },
  );

  // PUT /bian/savings-account/:accountId/update — update savings goals and instructions
  app.put<{ Params: { accountId: string } }>(
    "/bian/savings-account/:accountId/update",
    async (req) => {
      const input = UpdateSavingsInput.parse(req.body ?? {});
      return savingsService.update(req.params.accountId, input);
    },
  );
}
