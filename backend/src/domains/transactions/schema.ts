import { z } from "zod";

export const TxDirectionEnum = z.enum(["DEBIT", "CREDIT"]);
export const TxStatusEnum = z.enum(["PENDING", "BOOKED", "REVERSED"]);

export const TransactionSchema = z.object({
  txId: z.string(),
  txRef: z.string(),
  accountId: z.string(),
  direction: TxDirectionEnum,
  amount: z.string(),
  currency: z.string(),
  balanceAfter: z.string(),
  category: z.string().nullable(),
  merchantName: z.string().nullable(),
  description: z.string(),
  bookedAt: z.string(),
  valueDate: z.string(),
  status: TxStatusEnum,
});
export type TransactionDto = z.infer<typeof TransactionSchema>;

export const ListQuery = z.object({
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  cursor: z.string().optional(),
});
export type ListQueryT = z.infer<typeof ListQuery>;

export const SearchInput = z.object({
  accountId: z.string().optional(),
  partyId: z.string().optional(),
  minAmount: z.coerce.number().optional(),
  maxAmount: z.coerce.number().optional(),
  category: z.string().optional(),
  merchantName: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});
export type SearchInputT = z.infer<typeof SearchInput>;
