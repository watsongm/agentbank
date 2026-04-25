import { z } from "zod";

export const PaymentTypeEnum = z.enum([
  "DOMESTIC",
  "INTERNATIONAL",
  "INSTANT",
  "STANDING_ORDER",
  "DIRECT_DEBIT",
]);

export const PaymentStatusEnum = z.enum([
  "PENDING",
  "AUTHORISED",
  "EXECUTING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "REJECTED",
]);

export const InitiatePaymentInput = z.object({
  debtorAccount: z.string(),
  creditorAccount: z.string().optional(),
  creditorName: z.string().optional(),
  creditorIban: z.string().optional(),
  creditorSortCode: z.string().optional(),
  creditorAccNum: z.string().optional(),
  amount: z.coerce.number().positive(),
  currency: z.string().length(3).default("GBP"),
  reference: z.string().optional(),
  paymentType: PaymentTypeEnum.default("DOMESTIC"),
  scheduledFor: z.string().optional(),
});
export type InitiatePaymentInputT = z.infer<typeof InitiatePaymentInput>;

// Open Banking v3.1 envelope shape — accept both flat and nested forms
export const OBPaymentInput = z.object({
  Data: z.object({
    Initiation: z.object({
      InstructedAmount: z.object({
        Amount: z.coerce.number(),
        Currency: z.string().length(3),
      }),
      DebtorAccount: z.object({ Identification: z.string() }),
      CreditorAccount: z.object({
        Identification: z.string(),
        SchemeName: z.string().optional(),
        Name: z.string().optional(),
      }),
      RemittanceInformation: z.object({ Reference: z.string().optional() }).optional(),
    }),
  }),
  Risk: z.unknown().optional(),
});

export const PaymentSchema = z.object({
  paymentId: z.string(),
  paymentRef: z.string(),
  status: PaymentStatusEnum,
  amount: z.string(),
  currency: z.string(),
  debtorAccountId: z.string(),
  creditorAccountId: z.string().nullable(),
  reference: z.string().nullable(),
  paymentType: PaymentTypeEnum,
  scheduledFor: z.string().nullable(),
  executedAt: z.string().nullable(),
  failureReason: z.string().nullable(),
  fapiInteractionId: z.string().nullable(),
  createdAt: z.string(),
});
export type PaymentDto = z.infer<typeof PaymentSchema>;

export const UpdatePaymentInput = z.object({
  status: z.enum(["CANCELLED"]).optional(),
  reference: z.string().optional(),
});
export type UpdatePaymentInputT = z.infer<typeof UpdatePaymentInput>;
