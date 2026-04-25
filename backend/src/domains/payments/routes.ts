import type { FastifyInstance } from "fastify";
import {
  InitiatePaymentInput,
  OBPaymentInput,
  UpdatePaymentInput,
} from "./schema.js";
import { paymentsService } from "./service.js";

export async function paymentsRoutes(app: FastifyInstance) {
  // POST /open-banking/v3.1/domestic-payments — OB v3.1 envelope
  app.post("/open-banking/v3.1/domestic-payments", async (req, reply) => {
    const fapiId = (req.headers["x-fapi-interaction-id"] as string) ?? req.id;
    const parsed = OBPaymentInput.parse(req.body);
    const init = parsed.Data.Initiation;
    const payment = await paymentsService.initiate(
      {
        debtorAccount: init.DebtorAccount.Identification,
        creditorAccount: init.CreditorAccount.Identification,
        creditorName: init.CreditorAccount.Name,
        amount: init.InstructedAmount.Amount,
        currency: init.InstructedAmount.Currency,
        reference: init.RemittanceInformation?.Reference,
        paymentType: "DOMESTIC",
      },
      fapiId,
    );
    return reply.code(201).send({
      Data: {
        DomesticPaymentId: payment.paymentRef,
        Status: payment.status === "COMPLETED" ? "AcceptedSettlementCompleted" : payment.status,
        CreationDateTime: payment.createdAt,
        Initiation: init,
      },
      Links: { Self: `/open-banking/v3.1/domestic-payments/${payment.paymentRef}` },
    });
  });

  // POST /open-banking/v3.1/international-payments — same shape, type = INTERNATIONAL
  app.post("/open-banking/v3.1/international-payments", async (req, reply) => {
    const fapiId = (req.headers["x-fapi-interaction-id"] as string) ?? req.id;
    const parsed = OBPaymentInput.parse(req.body);
    const init = parsed.Data.Initiation;
    const payment = await paymentsService.initiate(
      {
        debtorAccount: init.DebtorAccount.Identification,
        creditorAccount: init.CreditorAccount.Identification,
        creditorName: init.CreditorAccount.Name,
        amount: init.InstructedAmount.Amount,
        currency: init.InstructedAmount.Currency,
        reference: init.RemittanceInformation?.Reference,
        paymentType: "INTERNATIONAL",
      },
      fapiId,
    );
    return reply.code(201).send({
      Data: {
        InternationalPaymentId: payment.paymentRef,
        Status: payment.status === "COMPLETED" ? "AcceptedSettlementCompleted" : payment.status,
        CreationDateTime: payment.createdAt,
        Initiation: init,
      },
      Links: { Self: `/open-banking/v3.1/international-payments/${payment.paymentRef}` },
    });
  });

  // GET /open-banking/v3.1/domestic-payments/:id — status retrieval
  app.get<{ Params: { id: string } }>(
    "/open-banking/v3.1/domestic-payments/:id",
    async (req) => {
      const p = await paymentsService.getByRef(req.params.id);
      return {
        Data: {
          DomesticPaymentId: p.paymentRef,
          Status: p.status === "COMPLETED" ? "AcceptedSettlementCompleted" : p.status,
          CreationDateTime: p.createdAt,
        },
        Links: { Self: `/open-banking/v3.1/domestic-payments/${p.paymentRef}` },
      };
    },
  );

  // POST /bian/payment-execution/initiate — BIAN-flavoured form
  app.post("/bian/payment-execution/initiate", async (req, reply) => {
    const fapiId = (req.headers["x-fapi-interaction-id"] as string) ?? req.id;
    const input = InitiatePaymentInput.parse(req.body);
    const payment = await paymentsService.initiate(input, fapiId);
    return reply.code(201).send({ paymentExecution: payment });
  });

  // GET /bian/payment-execution/:execId/retrieve
  app.get<{ Params: { execId: string } }>(
    "/bian/payment-execution/:execId/retrieve",
    async (req) => {
      const p = await paymentsService.getByRef(req.params.execId);
      return { paymentExecution: p };
    },
  );

  // PUT /bian/payment-execution/:execId/update
  app.put<{ Params: { execId: string } }>(
    "/bian/payment-execution/:execId/update",
    async (req) => {
      const input = UpdatePaymentInput.parse(req.body);
      const p = await paymentsService.update(req.params.execId, input);
      return { paymentExecution: p };
    },
  );
}
