import { z } from "zod";

export const CardTypeEnum = z.enum(["DEBIT", "CREDIT", "PREPAID"]);
export const CardStatusEnum = z.enum([
  "ACTIVE",
  "BLOCKED",
  "EXPIRED",
  "LOST",
  "STOLEN",
  "PENDING",
]);

export const CardFacilitySchema = z.object({
  id: z.string(),
  cardId: z.string(),
  cardRef: z.string(),
  partyId: z.string(),
  linkedAccountId: z.string().nullable(),
  cardType: CardTypeEnum,
  last4: z.string(),
  expiryMonth: z.number().int(),
  expiryYear: z.number().int(),
  creditLimit: z.string().nullable(),
  currentBalance: z.string(),
  availableCredit: z.string(),
  status: CardStatusEnum,
  issuedAt: z.string(),
});
export type CardFacilityDto = z.infer<typeof CardFacilitySchema>;

export const InitiateCardInput = z.object({
  partyId: z.string().optional(),
  party_id: z.string().optional(),
  customerReference: z.string().optional(),
  linkedAccountId: z.string().optional(),
  cardType: z.string().default("CREDIT"),
  creditLimit: z.coerce.number().nonnegative().default(5000),
});
export type InitiateCardInputT = z.infer<typeof InitiateCardInput>;

export const UpdateCardInput = z.object({
  creditLimit: z.coerce.number().nonnegative().optional(),
  status: CardStatusEnum.optional(),
});
export type UpdateCardInputT = z.infer<typeof UpdateCardInput>;

export const CardRequestInput = z.object({
  action: z.string().min(1),
  reason: z.string().optional(),
});
export type CardRequestInputT = z.infer<typeof CardRequestInput>;
