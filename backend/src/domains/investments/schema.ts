import { z } from "zod";

export const InitiatePortfolioInput = z
  .object({
    partyId: z.string().optional(),
    customerReference: z.string().optional(),
    currency: z.string().length(3).default("GBP"),
    initialCash: z.union([z.number(), z.string()]).optional(),
  })
  .default({});

export type InitiatePortfolioInputT = z.infer<typeof InitiatePortfolioInput>;

export const PlaceOrderInput = z.object({
  instrument: z.string().min(1, "instrument is required"),
  quantity: z.coerce.number().positive("quantity must be greater than 0"),
  direction: z
    .string()
    .transform((v) => v.toUpperCase())
    .pipe(z.enum(["BUY", "SELL"])),
  orderType: z
    .string()
    .transform((v) => v.toUpperCase())
    .pipe(z.enum(["MARKET", "LIMIT", "STOP"]))
    .default("MARKET"),
  limitPrice: z.coerce.number().positive().optional(),
});

export type PlaceOrderInputT = z.infer<typeof PlaceOrderInput>;
