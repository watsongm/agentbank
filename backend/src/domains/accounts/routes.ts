import type { FastifyInstance } from "fastify";
import { accountsService } from "./service.js";

export async function accountsRoutes(app: FastifyInstance) {
  // GET /open-banking/v3.1/accounts — list in scope
  app.get("/open-banking/v3.1/accounts", async () => {
    const accounts = await accountsService.list();
    return {
      Data: { Account: accounts },
      Links: { Self: "/open-banking/v3.1/accounts" },
      Meta: { TotalPages: 1 },
    };
  });

  // GET /open-banking/v3.1/accounts/:accountId — detail
  app.get<{ Params: { accountId: string } }>(
    "/open-banking/v3.1/accounts/:accountId",
    async (req) => {
      const account = await accountsService.get(req.params.accountId);
      return {
        Data: { Account: [account] },
        Links: { Self: `/open-banking/v3.1/accounts/${req.params.accountId}` },
      };
    },
  );

  // GET /bian/current-account/:accountId/balance — BIAN-structured balance
  app.get<{ Params: { accountId: string } }>(
    "/bian/current-account/:accountId/balance",
    async (req) => {
      const balance = await accountsService.getBalance(req.params.accountId);
      return { accountBalance: balance };
    },
  );
}
