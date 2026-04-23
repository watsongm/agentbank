import type { FastifyInstance } from "fastify";
import { RegisterPartyInput, UpdatePartyInput } from "./schema.js";
import { partyService } from "./service.js";

export async function partyRoutes(app: FastifyInstance) {
  // GET /open-banking/v3.1/party  — authenticated party
  app.get("/open-banking/v3.1/party", async () => {
    const party = await partyService.getAuthenticated();
    return { Data: { Party: party }, Links: { Self: "/open-banking/v3.1/party" } };
  });

  // GET /bian/party-reference/:partyId — full BIAN party record
  app.get<{ Params: { partyId: string } }>(
    "/bian/party-reference/:partyId",
    async (req) => {
      const party = await partyService.getByRef(req.params.partyId);
      return { partyReference: party };
    },
  );

  // POST /bian/party-reference/register — onboard new party
  app.post("/bian/party-reference/register", async (req, reply) => {
    const input = RegisterPartyInput.parse(req.body);
    const party = await partyService.register(input);
    return reply.code(201).send({ partyReference: party });
  });

  // PUT /bian/party-reference/:partyId/update — update attributes
  app.put<{ Params: { partyId: string } }>(
    "/bian/party-reference/:partyId/update",
    async (req) => {
      const input = UpdatePartyInput.parse(req.body);
      const party = await partyService.update(req.params.partyId, input);
      return { partyReference: party };
    },
  );
}
