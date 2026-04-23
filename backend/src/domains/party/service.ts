import { prisma } from "../../lib/db.js";
import { NotFound } from "../../lib/errors.js";
import type { PartyDto, RegisterPartyInputT, UpdatePartyInputT } from "./schema.js";

function toDto(p: Awaited<ReturnType<typeof prisma.party.findFirst>> & object): PartyDto {
  return {
    partyId: p.id,
    partyRef: p.partyRef,
    legalName: p.legalName,
    givenName: p.givenName ?? null,
    familyName: p.familyName ?? null,
    dateOfBirth: p.dateOfBirth ? p.dateOfBirth.toISOString() : null,
    email: p.email ?? null,
    phone: p.phone ?? null,
    address: {
      line1: p.addressLine1 ?? null,
      line2: p.addressLine2 ?? null,
      city: p.city ?? null,
      postcode: p.postcode ?? null,
      country: p.country,
    },
    partyType: p.partyType,
    kycStatus: p.kycStatus,
    riskRating: p.riskRating,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export const partyService = {
  /**
   * Authenticated-party lookup for GET /open-banking/v3.1/party.
   * Demo: returns the first non-deleted party; tier 2 will resolve from
   * the bearer token's sub/party claim.
   */
  async getAuthenticated(): Promise<PartyDto> {
    const p = await prisma.party.findFirst({ where: { deletedAt: null } });
    if (!p) throw NotFound("Party");
    return toDto(p);
  },

  async getByRef(partyRef: string): Promise<PartyDto> {
    const p = await prisma.party.findFirst({
      where: { OR: [{ partyRef }, { id: partyRef }], deletedAt: null },
    });
    if (!p) throw NotFound(`Party ${partyRef}`);
    return toDto(p);
  },

  async register(input: RegisterPartyInputT): Promise<PartyDto> {
    const partyRef = `PAR-${Date.now().toString(36).toUpperCase()}`;
    const p = await prisma.party.create({
      data: {
        partyRef,
        legalName: input.legalName,
        givenName: input.givenName ?? null,
        familyName: input.familyName ?? null,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        addressLine1: input.addressLine1 ?? null,
        addressLine2: input.addressLine2 ?? null,
        city: input.city ?? null,
        postcode: input.postcode ?? null,
        country: input.country,
        partyType: input.partyType,
        kycStatus: "PENDING",
      },
    });
    return toDto(p);
  },

  async update(partyRef: string, input: UpdatePartyInputT): Promise<PartyDto> {
    const existing = await prisma.party.findFirst({
      where: { OR: [{ partyRef }, { id: partyRef }], deletedAt: null },
    });
    if (!existing) throw NotFound(`Party ${partyRef}`);
    const p = await prisma.party.update({
      where: { id: existing.id },
      data: {
        ...(input.legalName !== undefined && { legalName: input.legalName }),
        ...(input.givenName !== undefined && { givenName: input.givenName }),
        ...(input.familyName !== undefined && { familyName: input.familyName }),
        ...(input.dateOfBirth !== undefined && {
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.addressLine1 !== undefined && { addressLine1: input.addressLine1 }),
        ...(input.addressLine2 !== undefined && { addressLine2: input.addressLine2 }),
        ...(input.city !== undefined && { city: input.city }),
        ...(input.postcode !== undefined && { postcode: input.postcode }),
        ...(input.country !== undefined && { country: input.country }),
        ...(input.partyType !== undefined && { partyType: input.partyType }),
      },
    });
    return toDto(p);
  },
};
