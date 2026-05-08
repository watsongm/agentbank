/**
 * Canonical seeded demo identifiers for the agentBANK backend.
 *
 * These values MUST match the external refs written by prisma/seed.ts.
 * Import from here in tests and any backend code that references seed data
 * directly, so a single change keeps everything consistent.
 *
 * The equivalent frontend file lives at src/mock/constants.js.
 */
export const SEED = {
  // Persona: Aria Chen (primary demo persona — VERIFIED, LOW risk)
  ARIA_PARTY_REF:     "PAR-ARIA",
  ARIA_CURRENT_REF:   "ACC-1829",
  ARIA_SAVINGS_REF:   "ACC-2041",
  ARIA_CARD_REF:      "CRD-88421",
  ARIA_PORTFOLIO_REF: "PRT-29183",

  // Persona: Mahli Patel (secondary — has a loan)
  MAHLI_PARTY_REF:    "PAR-MAHLI",
  MAHLI_CURRENT_REF:  "ACC-3311",
  MAHLI_LOAN_REF:     "LOAN-48291",

  // Persona: Noah Okoro (tertiary — PENDING KYC)
  OKORO_PARTY_REF:    "PAR-OKORO",
  OKORO_CURRENT_REF:  "ACC-5522",
} as const;

export type SeedKeys = typeof SEED;
