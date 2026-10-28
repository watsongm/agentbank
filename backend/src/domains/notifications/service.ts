import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/db.js";
import { SEED } from "../../lib/constants.js";
import { NotFound, BadRequest } from "../../lib/errors.js";
import type {
  InitiateNotificationEventInputT,
  SubscribeWebhookInputT,
} from "./schema.js";

function normalizePartyRef(ref?: string): string {
  if (!ref || ref === "P-00291847") return SEED.ARIA_PARTY_REF;
  return ref;
}

async function resolveParty(partyIdOrRef?: string) {
  const normalized = normalizePartyRef(partyIdOrRef);
  const party = await prisma.party.findFirst({
    where: {
      OR: [
        { partyRef: normalized },
        ...(partyIdOrRef ? [{ partyRef: partyIdOrRef }, { id: partyIdOrRef }] : []),
      ],
      deletedAt: null,
    },
  });
  if (!party) throw NotFound(`Party ${partyIdOrRef ?? normalized}`);
  return party;
}

export const notificationsService = {
  async initiateEvent(input: InitiateNotificationEventInputT) {
    const party = await resolveParty(input.partyId ?? input.customerReference);
    const eventType =
      input.eventType ??
      (input.eventTypes && input.eventTypes.length > 0
        ? input.eventTypes[0]!
        : "account.notification");
    const eventTypes = input.eventTypes ?? [eventType];
    const channel = input.channel || "WEBHOOK";
    const eventId = `EVT-${Date.now().toString(36).toUpperCase()}-${Math.floor(
      100 + Math.random() * 900,
    )}`;
    const timestamp = new Date().toISOString();

    return {
      id: eventId,
      eventId,
      eventRef: eventId,
      partyId: party.partyRef,
      partyRef: party.partyRef,
      eventType,
      eventTypes,
      channel,
      payload: input.payload ?? {},
      status: "DELIVERED",
      timestamp,
    };
  },

  async listEventHistory(partyId: string) {
    const party = await resolveParty(partyId);

    const [subscriptions, auditEvents] = await Promise.all([
      prisma.notificationSubscription.findMany({
        where: { partyId: party.id, active: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.auditEvent.findMany({
        where: {
          OR: [{ customerId: party.partyRef }, { customerId: party.id }],
        },
        orderBy: { timestamp: "desc" },
        take: 25,
      }),
    ]);

    return {
      partyId: party.partyRef,
      partyRef: party.partyRef,
      subscriptions: subscriptions.map((s) => ({
        id: s.id,
        subscriptionId: s.id,
        subscriptionRef: s.id,
        partyId: party.partyRef,
        partyRef: party.partyRef,
        eventTypes: s.eventTypes,
        webhookUrl: s.webhookUrl,
        verificationToken: s.verificationToken,
        active: s.active,
        createdAt: s.createdAt.toISOString(),
        lastDeliveredAt: s.lastDeliveredAt ? s.lastDeliveredAt.toISOString() : null,
      })),
      events: auditEvents.map((e) => ({
        eventId: e.id,
        requestId: e.requestId,
        customerId: e.customerId ?? party.partyRef,
        tool: e.tool,
        statusCode: e.statusCode,
        latencyMs: e.latencyMs,
        timestamp: e.timestamp.toISOString(),
      })),
    };
  },

  async subscribeWebhook(input: SubscribeWebhookInputT) {
    const rawPartyId = input.partyId ?? input.party_id;
    const party = await resolveParty(rawPartyId);

    const eventTypes = input.eventTypes ??
      input.event_types ?? ["payment.completed", "balance.threshold"];
    if (eventTypes.length === 0) {
      throw BadRequest("eventTypes must contain at least one event type");
    }

    const webhookUrl =
      input.webhookUrl ??
      input.webhook_url ??
      "https://agent.example.com/webhooks/agentbank";

    const verificationToken =
      input.verificationToken && input.verificationToken.trim().length > 0
        ? input.verificationToken.trim()
        : `vtok-${randomUUID()}`;

    const subId = `SUB-${Date.now().toString(36).toUpperCase()}-${Math.floor(
      100 + Math.random() * 900,
    )}`;

    const sub = await prisma.notificationSubscription.create({
      data: {
        id: subId,
        partyId: party.id,
        eventTypes,
        webhookUrl,
        verificationToken,
        active: true,
      },
    });

    return {
      id: sub.id,
      subscriptionId: sub.id,
      subscriptionRef: sub.id,
      partyId: party.partyRef,
      partyRef: party.partyRef,
      eventTypes: sub.eventTypes,
      webhookUrl: sub.webhookUrl,
      verificationToken: sub.verificationToken,
      active: sub.active,
      status: sub.active ? "Active" : "Inactive",
      createdAt: sub.createdAt.toISOString(),
    };
  },
};
