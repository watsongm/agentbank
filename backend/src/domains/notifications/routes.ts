import type { FastifyInstance } from "fastify";
import {
  InitiateNotificationEventInput,
  SubscribeWebhookInput,
} from "./schema.js";
import { notificationsService } from "./service.js";

export async function notificationsRoutes(app: FastifyInstance) {
  // POST /bian/customer-event-history/initiate
  app.post("/bian/customer-event-history/initiate", async (req, reply) => {
    const input = InitiateNotificationEventInput.parse(req.body ?? {});
    const eventRecord = await notificationsService.initiateEvent(input);
    return reply.code(201).send({ eventRecord });
  });

  // GET /bian/customer-event-history/:partyId/list
  app.get<{ Params: { partyId: string } }>(
    "/bian/customer-event-history/:partyId/list",
    async (req) => {
      const customerEventHistory = await notificationsService.listEventHistory(
        req.params.partyId,
      );
      return { customerEventHistory };
    },
  );

  // POST /bian/customer-event-history/webhook (subscribe_events)
  app.post("/bian/customer-event-history/webhook", async (req, reply) => {
    const input = SubscribeWebhookInput.parse(req.body ?? {});
    const subscription = await notificationsService.subscribeWebhook(input);
    return reply.code(201).send({ subscription });
  });
}
