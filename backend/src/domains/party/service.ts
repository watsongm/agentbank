import { prisma } from "../../lib/db.js";
import { NotFound } from "../../lib/errors.js";
import type { PartyDto, RegisterPartyInputT, UpdatePartyInputT } from "./schema.js";

type PartyRow = NonNullable<Awaited<ReturnType<typeof prisma.party.findFirst>>>;

function toDto(p: PartyRow): PartyDto {
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
   * Resolves from customerId when it matches a partyRef or id, falling back
   * to the earliest-created verified party (Aria).
   */
  async getCurrent(customerId?: string): Promise<PartyDto> {
    if (customerId && customerId !== "demo-customer") {
      const matched = await prisma.party.findFirst({
        where: {
          OR: [{ partyRef: customerId }, { id: customerId }],
          deletedAt: null,
        },
      });
      if (matched) return toDto(matched);
    }

    const p = await prisma.party.findFirst({
      where: { deletedAt: null, kycStatus: "VERIFIED" },
      orderBy: { createdAt: "asc" },
    });
    if (!p) throw NotFound("Party");
    return toDto(p);
  },

  async getAuthenticated(customerId?: string): Promise<PartyDto> {
    return this.getCurrent(customerId);
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
    const resolvedLegalName = input.legalName ?? input.name ?? "Unknown Party";
    const resolvedCountry = input.country ?? input.nationality ?? "GB";
    const resolvedEmail = input.email ?? input.contactEmail ?? null;
    const p = await prisma.party.create({
      data: {
        partyRef,
        legalName: resolvedLegalName,
        givenName: input.givenName ?? null,
        familyName: input.familyName ?? null,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        email: resolvedEmail,
        phone: input.phone ?? null,
        addressLine1: input.addressLine1 ?? null,
        addressLine2: input.addressLine2 ?? null,
        city: input.city ?? null,
        postcode: input.postcode ?? null,
        country: resolvedCountry,
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
    const resolvedLegalName = input.legalName ?? input.name;
    const resolvedEmail = input.email ?? input.contactEmail;
    const resolvedAddressLine1 = input.addressLine1 ?? input.address;
    const resolvedCountry = input.country ?? input.nationality;
    const p = await prisma.party.update({
      where: { id: existing.id },
      data: {
        ...(resolvedLegalName !== undefined && { legalName: resolvedLegalName }),
        ...(input.givenName !== undefined && { givenName: input.givenName }),
        ...(input.familyName !== undefined && { familyName: input.familyName }),
        ...(input.dateOfBirth !== undefined && {
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        }),
        ...(resolvedEmail !== undefined && { email: resolvedEmail }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(resolvedAddressLine1 !== undefined && { addressLine1: resolvedAddressLine1 }),
        ...(input.addressLine2 !== undefined && { addressLine2: input.addressLine2 }),
        ...(input.city !== undefined && { city: input.city }),
        ...(input.postcode !== undefined && { postcode: input.postcode }),
        ...(resolvedCountry !== undefined && { country: resolvedCountry }),
        ...(input.partyType !== undefined && { partyType: input.partyType }),
      },
    });
    return toDto(p);
  },
};
