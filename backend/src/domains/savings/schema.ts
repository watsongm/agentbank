import { z } from "zod";

export const SavingsStatusEnum = z.enum(["ACTIVE", "FROZEN", "CLOSED", "DORMANT"]);

export const SavingsFacilitySchema = z.object({
  id: z.string(),
  accountId: z.string(),
  accountRef: z.string(),
  partyId: z.string(),
  productName: z.string(),
  currency: z.string(),
  availableBalance: z.string(),
  ledgerBalance: z.string(),
  interestRateAer: z.number(),
  status: SavingsStatusEnum,
  openedAt: z.string(),
});
export type SavingsFacilityDto = z.infer<typeof SavingsFacilitySchema>;

export const InitiateSavingsInput = z.object({
  partyId: z.string().optional(),
  party_id: z.string().optional(),
  customerReference: z.string().optional(),
  productName: z.string().optional(),
  currency: z.string().length(3).default("GBP"),
  initialDeposit: z.coerce.number().nonnegative().default(0),
  termMonths: z.coerce.number().int().positive().optional(),
});
export type InitiateSavingsInputT = z.infer<typeof InitiateSavingsInput>;

export const UpdateSavingsInput = z.object({
  productName: z.string().optional(),
  status: SavingsStatusEnum.optional(),
});
export type UpdateSavingsInputT = z.infer<typeof UpdateSavingsInput>;
