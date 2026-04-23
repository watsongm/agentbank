import { prisma } from "../../lib/db.js";
import { NotFound } from "../../lib/errors.js";
import type { AccountDto, BalanceDto } from "./schema.js";

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
};
