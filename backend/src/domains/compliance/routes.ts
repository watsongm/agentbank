import type { FastifyInstance } from "fastify";
import { EvaluateAmlInput, InitiateRegulatoryReportInput } from "./schema.js";
import { complianceService } from "./service.js";

export async function complianceRoutes(app: FastifyInstance) {
  // POST /bian/regulatory-reporting/initiate
  app.post("/bian/regulatory-reporting/initiate", async (req, reply) => {
    const input = InitiateRegulatoryReportInput.parse(req.body ?? {});
    const regulatoryReport = await complianceService.initiateReport(input);
    return reply.code(201).send({ regulatoryReport });
  });

  // GET /bian/regulatory-reporting/:reportId/retrieve
  app.get<{ Params: { reportId: string } }>(
    "/bian/regulatory-reporting/:reportId/retrieve",
    async (req) => {
      const regulatoryReport = await complianceService.retrieveReport(
        req.params.reportId,
      );
      return { regulatoryReport };
    },
  );

  // POST /bian/aml-screening/evaluate (run_aml_screen)
  app.post("/bian/aml-screening/evaluate", async (req) => {
    const input = EvaluateAmlInput.parse(req.body ?? {});
    const amlScreening = await complianceService.evaluateAml(input);
    return { amlScreening };
  });

  // GET /bian/aml-screening/:caseId/retrieve
  app.get<{ Params: { caseId: string } }>(
    "/bian/aml-screening/:caseId/retrieve",
    async (req) => {
      const amlScreening = await complianceService.retrieveAmlCase(
        req.params.caseId,
      );
      return { amlScreening };
    },
  );
}
