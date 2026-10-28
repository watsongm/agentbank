import { prisma } from "../../lib/db.js";
import { SEED } from "../../lib/constants.js";
import { NotFound } from "../../lib/errors.js";
import type {
  AccountDto,
  BalanceDto,
  InitiateCurrentAccountInputT,
  UpdateCurrentAccountInputT,
} from "./schema.js";

type AccountRow = Awaited<ReturnType<typeof prisma.account.findFirst>> & object;

function toAccountDto(a: AccountRow): AccountDto {
  return {
    accountId: a.id,
    accountRef: a.accountRef,
    partyId: a.partyId,
    accountType: a.accountType,
    productName: a.productName,
    currency: a.currency,
    availableBalance: a.availableBalance.toString(),
    ledgerBalance: a.ledgerBalance.toString(),
    overdraftLimit: a.overdraftLimit.toString(),
    status: a.status,
    openedAt: a.openedAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

async function resolveAccount(accountIdOrRef: string) {
  const a = await prisma.account.findFirst({
    where: { OR: [{ id: accountIdOrRef }, { accountRef: accountIdOrRef }] },
  });
  if (!a) throw NotFound(`Account ${accountIdOrRef}`);
  return a;
}

async function resolveParty(partyIdOrRef?: string) {
  const ref = partyIdOrRef || SEED.ARIA_PARTY_REF;
  const p = await prisma.party.findFirst({
    where: { OR: [{ partyRef: ref }, { id: ref }], deletedAt: null },
  });
  if (p) return p;
  const fallback = await prisma.party.findFirst({
    where: { OR: [{ partyRef: SEED.ARIA_PARTY_REF }, { deletedAt: null }] },
    orderBy: { createdAt: "asc" },
  });
  if (!fallback) throw NotFound(`Party ${ref}`);
  return fallback;
}

export const accountsService = {
  /**
   * List accounts in scope. Demo: returns all accounts of the first party.
   * Tier 2 will filter by consent-scoped party id.
   */
  async list(): Promise<AccountDto[]> {
    const party = await prisma.party.findFirst({ where: { deletedAt: null } });
    if (!party) return [];
    const accounts = await prisma.account.findMany({
      where: { partyId: party.id },
      orderBy: { openedAt: "asc" },
    });
    return accounts.map(toAccountDto);
  },

  async get(accountIdOrRef: string): Promise<AccountDto> {
    const a = await resolveAccount(accountIdOrRef);
    return toAccountDto(a);
  },

  async getBalance(accountIdOrRef: string): Promise<BalanceDto> {
    const a = await resolveAccount(accountIdOrRef);
    return {
      accountId: a.id,
      currency: a.currency,
      available: a.availableBalance.toString(),
      ledger: a.ledgerBalance.toString(),
      overdraftLimit: a.overdraftLimit.toString(),
      asOf: new Date().toISOString(),
    };
  },

  async initiate(input: InitiateCurrentAccountInputT): Promise<AccountDto> {
    const party = await resolveParty(input.partyId ?? input.customerReference);
    const accountRef = `ACC-${Date.now().toString(36).toUpperCase()}`;
    const productName = input.productName ?? input.productType ?? "Everyday Current";
    const overdraftStr = (input.overdraftLimit ?? 0).toFixed(2);
    const a = await prisma.account.create({
      data: {
        accountRef,
        partyId: party.id,
        accountType: "CURRENT",
        productName,
        currency: input.currency ?? "GBP",
        availableBalance: "0.00",
        ledgerBalance: "0.00",
        overdraftLimit: overdraftStr,
        status: "ACTIVE",
      },
    });
    return toAccountDto(a);
  },

  async update(accountIdOrRef: string, input: UpdateCurrentAccountInputT): Promise<AccountDto> {
    const existing = await resolveAccount(accountIdOrRef);
    const a = await prisma.account.update({
      where: { id: existing.id },
      data: {
        ...(input.productName !== undefined && { productName: input.productName }),
        ...(input.overdraftLimit !== undefined && {
          overdraftLimit: input.overdraftLimit.toFixed(2),
        }),
        ...(input.status !== undefined && {
          status: input.status,
          ...(input.status === "CLOSED" && { closedAt: new Date() }),
        }),
      },
    });
    return toAccountDto(a);
  },
};
