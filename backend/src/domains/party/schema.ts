import { z } from "zod";

export const PartyTypeEnum = z.enum(["INDIVIDUAL", "BUSINESS", "TRUST"]);
export const KycStatusEnum = z.enum(["PENDING", "VERIFIED", "REJECTED", "REVIEW", "EXPIRED"]);
export const RiskRatingEnum = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const PartySchema = z.object({
  partyId: z.string(),
  partyRef: z.string(),
  legalName: z.string(),
  givenName: z.string().nullable(),
  familyName: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  address: z
    .object({
      line1: z.string().nullable(),
      line2: z.string().nullable(),
      city: z.string().nullable(),
      postcode: z.string().nullable(),
      country: z.string(),
    })
    .nullable(),
  partyType: PartyTypeEnum,
  kycStatus: KycStatusEnum,
  riskRating: RiskRatingEnum,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PartyDto = z.infer<typeof PartySchema>;

export const RegisterPartyInput = z.object({
  legalName: z.string().min(1),
  givenName: z.string().optional(),
  familyName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  postcode: z.string().optional(),
  country: z.string().length(2).default("GB"),
  partyType: PartyTypeEnum.default("INDIVIDUAL"),
});
export type RegisterPartyInputT = z.infer<typeof RegisterPartyInput>;

export const UpdatePartyInput = RegisterPartyInput.partial();
export type UpdatePartyInputT = z.infer<typeof UpdatePartyInput>;
