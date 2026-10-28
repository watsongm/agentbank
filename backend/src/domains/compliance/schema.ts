import { z } from "zod";

export const InitiateRegulatoryReportInput = z
  .object({
    reportType: z.string().default("SARReport"),
    jurisdiction: z.string().default("UK-FCA"),
    periodStart: z.string().optional(),
    periodEnd: z.string().optional(),
    subjectId: z.string().optional(),
    partyId: z.string().optional(),
  })
  .default({});

export type InitiateRegulatoryReportInputT = z.infer<
  typeof InitiateRegulatoryReportInput
>;

export const EvaluateAmlInput = z
  .object({
    subject_type: z
      .string()
      .transform((v) => v.toLowerCase())
      .pipe(z.enum(["party", "transaction"]))
      .optional(),
    subjectType: z
      .string()
      .transform((v) => v.toLowerCase())
      .pipe(z.enum(["party", "transaction"]))
      .optional(),
    subject_id: z.string().optional(),
    subjectId: z.string().optional(),
    checkTypes: z.array(z.string()).optional(),
    screenType: z
      .string()
      .transform((v) => v.toUpperCase())
      .pipe(z.enum(["AML", "SANCTIONS", "PEP", "FRAUD"]))
      .optional(),
  })
  .default({});

export type EvaluateAmlInputT = z.infer<typeof EvaluateAmlInput>;
