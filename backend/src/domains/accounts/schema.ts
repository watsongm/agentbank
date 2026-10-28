import { z } from "zod";

export const AccountTypeEnum = z.enum([
  "CURRENT",
  "SAVINGS",
  "LOAN",
  "CREDIT_CARD",
  "INVESTMENT",
]);
export const AccountStatusEnum = z.enum(["ACTIVE", "FROZEN", "CLOSED", "DORMANT"]);

export const AccountSchema = z.object({
  accountId: z.string(),
  accountRef: z.string(),
  partyId: z.string(),
  accountType: AccountTypeEnum,
  productName: z.string(),
  currency: z.string(),
  availableBalance: z.string(), // Decimal serialised as string
  ledgerBalance: z.string(),
  overdraftLimit: z.string(),
  status: AccountStatusEnum,
  openedAt: z.string(),
  updatedAt: z.string(),
});
export type AccountDto = z.infer<typeof AccountSchema>;

export const BalanceSchema = z.object({
  accountId: z.string(),
  currency: z.string(),
  available: z.string(),
  ledger: z.string(),
  overdraftLimit: z.string(),
  asOf: z.string(),
});
export type BalanceDto = z.infer<typeof BalanceSchema>;

export const InitiateCurrentAccountInput = z.object({
  partyId: z.string().optional(),
  customerReference: z.string().optional(),
  productType: z.string().optional(),
  productName: z.string().optional(),
  currency: z.string().length(3).default("GBP"),
  overdraftLimit: z.coerce.number().nonnegative().default(0),
});
export type InitiateCurrentAccountInputT = z.infer<typeof InitiateCurrentAccountInput>;

export const UpdateCurrentAccountInput = z.object({
  productName: z.string().optional(),
  overdraftLimit: z.coerce.number().nonnegative().optional(),
  status: AccountStatusEnum.optional(),
});
export type UpdateCurrentAccountInputT = z.infer<typeof UpdateCurrentAccountInput>;
