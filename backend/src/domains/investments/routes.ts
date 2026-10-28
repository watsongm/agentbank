import type { FastifyInstance } from "fastify";
import { InitiatePortfolioInput, PlaceOrderInput } from "./schema.js";
import { investmentsService } from "./service.js";

export async function investmentsRoutes(app: FastifyInstance) {
  // GET /bian/investment-portfolio/:portfolioId/retrieve (get_portfolio)
  app.get<{ Params: { portfolioId: string } }>(
    "/bian/investment-portfolio/:portfolioId/retrieve",
    async (req) => {
      const investmentPortfolio = await investmentsService.getPortfolio(
        req.params.portfolioId,
      );
      return { investmentPortfolio };
    },
  );

  // POST /bian/investment-portfolio/initiate
  app.post("/bian/investment-portfolio/initiate", async (req, reply) => {
    const input = InitiatePortfolioInput.parse(req.body ?? {});
    const investmentPortfolio = await investmentsService.initiatePortfolio(input);
    return reply.code(201).send({ investmentPortfolio });
  });

  // POST /bian/investment-portfolio/:portfolioId/request (place_order)
  app.post<{ Params: { portfolioId: string } }>(
    "/bian/investment-portfolio/:portfolioId/request",
    async (req, reply) => {
      const input = PlaceOrderInput.parse(req.body ?? {});
      const orderExecution = await investmentsService.placeOrder(
        req.params.portfolioId,
        input,
      );
      return reply.code(201).send({ orderExecution });
    },
  );

  // GET /bian/investment-portfolio/:portfolioId/performance
  app.get<{ Params: { portfolioId: string } }>(
    "/bian/investment-portfolio/:portfolioId/performance",
    async (req) => {
      const portfolioPerformance = await investmentsService.getPerformance(
        req.params.portfolioId,
      );
      return { portfolioPerformance };
    },
  );
}
