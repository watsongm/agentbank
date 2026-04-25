import type { FastifyInstance } from "fastify";
import { ListQuery, SearchInput } from "./schema.js";
import { transactionsService } from "./service.js";

export async function transactionsRoutes(app: FastifyInstance) {
  // GET /open-banking/v3.1/accounts/:accountId/transactions
  app.get<{ Params: { accountId: string }; Querystring: Record<string, string> }>(
    "/open-banking/v3.1/accounts/:accountId/transactions",
    async (req) => {
      const q = ListQuery.parse(req.query);
      const { items, nextCursor } = await transactionsService.list(req.params.accountId, q);
      return {
        Data: { Transaction: items },
        Links: {
          Self: `/open-banking/v3.1/accounts/${req.params.accountId}/transactions`,
          ...(nextCursor && {
            Next: `/open-banking/v3.1/accounts/${req.params.accountId}/transactions?cursor=${nextCursor}`,
          }),
        },
        Meta: { TotalPages: nextCursor ? null : 1 },
      };
    },
  );

  // GET /bian/accounting-transactions/:acctId/list
  app.get<{ Params: { acctId: string }; Querystring: Record<string, string> }>(
    "/bian/accounting-transactions/:acctId/list",
    async (req) => {
      const q = ListQuery.parse(req.query);
      const { items, nextCursor } = await transactionsService.list(req.params.acctId, q);
      return { transactions: items, nextCursor };
    },
  );

  // POST /bian/accounting-transactions/search
  app.post("/bian/accounting-transactions/search", async (req) => {
    const input = SearchInput.parse(req.body ?? {});
    const items = await transactionsService.search(input);
    return { transactions: items, count: items.length };
  });

  // GET /bian/accounting-transactions/:txId/retrieve
  app.get<{ Params: { txId: string } }>(
    "/bian/accounting-transactions/:txId/retrieve",
    async (req) => {
      const tx = await transactionsService.getByRef(req.params.txId);
      return { transaction: tx };
    },
  );
}
