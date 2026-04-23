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
