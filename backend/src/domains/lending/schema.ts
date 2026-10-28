import { z } from "zod";

export const LoanStatusEnum = z.enum([
  "APPLIED",
  "PRE_QUALIFIED",
  "APPROVED",
  "DISBURSED",
  "REPAYING",
  "SETTLED",
  "REJECTED",
  "DEFAULTED",
]);

export const RepaymentStatusEnum = z.enum(["DUE", "PAID", "MISSED", "PARTIAL"]);

export const RepaymentSchema = z.object({
  repaymentId: z.string(),
  installmentNumber: z.number().int().optional(),
  dueDate: z.string(),
  amount: z.string(),
  paidDate: z.string().nullable(),
  paidAmount: z.string().nullable(),
  status: RepaymentStatusEnum,
});
export type RepaymentDto = z.infer<typeof RepaymentSchema>;

export const LoanFacilitySchema = z.object({
  id: z.string(),
  loanId: z.string(),
  loanRef: z.string(),
  partyId: z.string(),
  principal: z.string(),
  requestedAmount: z.number(),
  currency: z.string(),
  termMonths: z.number().int(),
  interestRateAnnual: z.number(),
  interestRate: z.string(),
  outstandingBalance: z.string(),
  monthlyRepayment: z.string(),
  purpose: z.string().nullable(),
  status: LoanStatusEnum,
  appliedAt: z.string(),
  approvedAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  nextPaymentDate: z.string().nullable(),
  repayments: z.array(RepaymentSchema),
});
export type LoanFacilityDto = z.infer<typeof LoanFacilitySchema>;

export const InitiateLoanInput = z
  .object({
    party_id: z.string().optional(),
    partyId: z.string().optional(),
    customerReference: z.string().optional(),
    amount: z.coerce.number().positive().optional(),
    requestedAmount: z.coerce.number().positive().optional(),
    loanAmount: z.coerce.number().positive().optional(),
    currency: z.string().length(3).default("GBP"),
    term_months: z.coerce.number().int().min(1).max(360).optional(),
    termMonths: z.coerce.number().int().min(1).max(360).optional(),
    purpose: z.string().optional(),
    loanType: z.string().optional(),
  })
  .refine(
    (d) =>
      d.amount !== undefined ||
      d.requestedAmount !== undefined ||
      d.loanAmount !== undefined,
    {
      message: "amount, requestedAmount, or loanAmount is required",
      path: ["amount"],
    },
  );
export type InitiateLoanInputT = z.infer<typeof InitiateLoanInput>;

export const UpdateLoanInput = z.object({
  purpose: z.string().optional(),
  termMonths: z.coerce.number().int().min(1).max(360).optional(),
  status: LoanStatusEnum.optional(),
});
export type UpdateLoanInputT = z.infer<typeof UpdateLoanInput>;

export const LoanRequestInput = z.object({
  requestType: z.string().optional(),
  action: z.string().optional(),
  amount: z.coerce.number().nonnegative().optional(),
  newTermMonths: z.coerce.number().int().min(1).max(360).optional(),
});
export type LoanRequestInputT = z.infer<typeof LoanRequestInput>;
