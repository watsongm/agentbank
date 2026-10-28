import { z } from "zod";

export const InitiateNotificationEventInput = z
  .object({
    partyId: z.string().optional(),
    customerReference: z.string().optional(),
    eventType: z.string().optional(),
    eventTypes: z.array(z.string()).optional(),
    channel: z.string().default("WEBHOOK"),
    payload: z.record(z.unknown()).optional(),
  })
  .default({});

export type InitiateNotificationEventInputT = z.infer<
  typeof InitiateNotificationEventInput
>;

export const SubscribeWebhookInput = z
  .object({
    party_id: z.string().optional(),
    partyId: z.string().optional(),
    event_types: z.array(z.string()).optional(),
    eventTypes: z.array(z.string()).optional(),
    webhook_url: z.string().url().optional(),
    webhookUrl: z.string().url().optional(),
    verificationToken: z.string().optional(),
  })
  .default({});

export type SubscribeWebhookInputT = z.infer<typeof SubscribeWebhookInput>;
