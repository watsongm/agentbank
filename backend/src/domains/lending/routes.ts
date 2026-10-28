import type { FastifyInstance } from "fastify";
import {
  InitiateLoanInput,
  LoanRequestInput,
  UpdateLoanInput,
} from "./schema.js";
import { lendingService } from "./service.js";

export async function lendingRoutes(app: FastifyInstance) {
  // POST /bian/consumer-loan/initiate — apply_for_loan
  app.post("/bian/consumer-loan/initiate", async (req, reply) => {
    const input = InitiateLoanInput.parse(req.body ?? {});
    const result = await lendingService.initiate(input);
    return reply.code(201).send(result);
  });

  // GET /bian/consumer-loan/:loanId/retrieve — get_loan_details
  app.get<{ Params: { loanId: string } }>(
    "/bian/consumer-loan/:loanId/retrieve",
    async (req) => {
      return lendingService.retrieve(req.params.loanId);
    },
  );

  // GET /bian/consumer-loan/:loanId/repayment-schedule — full amortisation schedule
  app.get<{ Params: { loanId: string } }>(
    "/bian/consumer-loan/:loanId/repayment-schedule",
    async (req) => {
      return lendingService.getRepaymentSchedule(req.params.loanId);
    },
  );

  // PUT /bian/consumer-loan/:loanId/update — modify loan terms
  app.put<{ Params: { loanId: string } }>(
    "/bian/consumer-loan/:loanId/update",
    async (req) => {
      const input = UpdateLoanInput.parse(req.body ?? {});
      return lendingService.update(req.params.loanId, input);
    },
  );

  // POST /bian/consumer-loan/:loanId/request — early repayment / refinance / drawdown
  app.post<{ Params: { loanId: string } }>(
    "/bian/consumer-loan/:loanId/request",
    async (req) => {
      const input = LoanRequestInput.parse(req.body ?? {});
      return lendingService.requestAction(req.params.loanId, input);
    },
  );
}
