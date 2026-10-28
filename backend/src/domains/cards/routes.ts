import type { FastifyInstance } from "fastify";
import {
  CardRequestInput,
  InitiateCardInput,
  UpdateCardInput,
} from "./schema.js";
import { cardsService } from "./service.js";

export async function cardsRoutes(app: FastifyInstance) {
  // GET /open-banking/v3.1/accounts/:accountId/statements — card / account statements
  app.get<{ Params: { accountId: string } }>(
    "/open-banking/v3.1/accounts/:accountId/statements",
    async (req) => {
      return cardsService.getStatements(req.params.accountId);
    },
  );

  // POST /bian/credit-card/initiate — apply for new card
  app.post("/bian/credit-card/initiate", async (req, reply) => {
    const input = InitiateCardInput.parse(req.body ?? {});
    const result = await cardsService.initiate(input);
    return reply.code(201).send(result);
  });

  // GET /bian/credit-card/:cardId/retrieve — get_card_details
  app.get<{ Params: { cardId: string } }>(
    "/bian/credit-card/:cardId/retrieve",
    async (req) => {
      return cardsService.retrieve(req.params.cardId);
    },
  );

  // PUT /bian/credit-card/:cardId/update — update card preferences and limits
  app.put<{ Params: { cardId: string } }>(
    "/bian/credit-card/:cardId/update",
    async (req) => {
      const input = UpdateCardInput.parse(req.body ?? {});
      return cardsService.update(req.params.cardId, input);
    },
  );

  // POST /bian/credit-card/:cardId/request — block_card / unblock
  app.post<{ Params: { cardId: string } }>(
    "/bian/credit-card/:cardId/request",
    async (req) => {
      const input = CardRequestInput.parse(req.body ?? {});
      return cardsService.requestAction(req.params.cardId, input);
    },
  );
}
