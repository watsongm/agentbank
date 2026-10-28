/**
 * Canonical seeded demo identifiers for the agentBANK frontend mock.
 *
 * These values MUST match the external refs written by backend/prisma/seed.ts
 * so the mock and the real backend produce consistent responses for the same
 * logical entities. Update both files together if refs ever change.
 */
export const SEED = {
  // Persona: Aria Chen (primary demo persona — VERIFIED, LOW risk)
  ARIA_PARTY_REF:    "PAR-ARIA",
  ARIA_CURRENT_REF:  "ACC-1829",
  ARIA_SAVINGS_REF:  "ACC-2041",
  ARIA_CARD_REF:     "CRD-88421",
  ARIA_PORTFOLIO_REF: "PRT-29183",

  // Persona: Mahli Patel (secondary — has a loan)
  MAHLI_PARTY_REF:   "PAR-MAHLI",
  MAHLI_CURRENT_REF: "ACC-3311",
  MAHLI_LOAN_REF:    "LOAN-48291",

  // Persona: Noah Okoro (tertiary — PENDING KYC)
  OKORO_PARTY_REF:   "PAR-OKORO",
  OKORO_CURRENT_REF: "ACC-5522",
};
