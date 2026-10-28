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

function normalizePaymentType(
  raw?: string,
): "DOMESTIC" | "INTERNATIONAL" | "INSTANT" | "STANDING_ORDER" | "DIRECT_DEBIT" {
  if (!raw) return "DOMESTIC";
  const upper = raw.toUpperCase();
  if (
    upper === "DOMESTIC" ||
    upper === "INTERNATIONAL" ||
    upper === "INSTANT" ||
    upper === "STANDING_ORDER" ||
    upper === "DIRECT_DEBIT"
  ) {
    return upper;
  }
  if (upper.includes("INT")) return "INTERNATIONAL";
  if (upper.includes("INSTANT") || upper.includes("FASTER")) return "INSTANT";
  if (upper.includes("STANDING")) return "STANDING_ORDER";
  if (upper.includes("DIRECT")) return "DIRECT_DEBIT";
  return "DOMESTIC";
}

const RawInitiatePaymentSchema = z
  .object({
    debtorAccount: z.string().optional(),
    debtorAccountId: z.string().optional(),
    creditorAccount: z.string().optional(),
    creditorAccountId: z.string().optional(),
    creditorName: z.string().optional(),
    creditorIban: z.string().optional(),
    creditorIBAN: z.string().optional(),
    creditorSortCode: z.string().optional(),
    creditorAccNum: z.string().optional(),
    amount: z.union([
      z.coerce.number().positive(),
      z.object({
        value: z.coerce.number().positive(),
        currency: z.string().length(3).optional(),
      }),
    ]),
    currency: z.string().length(3).optional(),
    reference: z.string().optional(),
    paymentReference: z.string().optional(),
    paymentType: z.string().optional(),
    scheduledFor: z.string().optional(),
    executionDate: z.string().optional(),
  })
  .refine((d) => Boolean(d.debtorAccount || d.debtorAccountId), {
    message: "debtorAccount or debtorAccountId is required",
    path: ["debtorAccount"],
  });

export const InitiatePaymentInput = RawInitiatePaymentSchema.transform(
  (d): InitiatePaymentInputT => {
    const amountVal = typeof d.amount === "number" ? d.amount : d.amount.value;
    const currencyVal =
      d.currency ?? (typeof d.amount === "object" ? d.amount.currency : undefined) ?? "GBP";
    return {
      debtorAccount: (d.debtorAccount ?? d.debtorAccountId)!,
      creditorAccount: d.creditorAccount ?? d.creditorAccountId,
      creditorName: d.creditorName,
      creditorIban: d.creditorIban ?? d.creditorIBAN,
      creditorSortCode: d.creditorSortCode,
      creditorAccNum: d.creditorAccNum,
      amount: amountVal,
      currency: currencyVal,
      reference: d.reference ?? d.paymentReference,
      paymentType: normalizePaymentType(d.paymentType),
      scheduledFor: d.scheduledFor ?? d.executionDate,
    };
  },
);

export interface InitiatePaymentInputT {
  debtorAccount: string;
  creditorAccount?: string;
  creditorName?: string;
  creditorIban?: string;
  creditorSortCode?: string;
  creditorAccNum?: string;
  amount: number;
  currency: string;
  reference?: string;
  paymentType: "DOMESTIC" | "INTERNATIONAL" | "INSTANT" | "STANDING_ORDER" | "DIRECT_DEBIT";
  scheduledFor?: string;
}

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
