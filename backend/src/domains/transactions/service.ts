import { prisma } from "../../lib/db.js";
import { NotFound, BadRequest } from "../../lib/errors.js";
import type { TransactionDto, ListQueryT, SearchInputT } from "./schema.js";

type TxRow = Awaited<ReturnType<typeof prisma.transaction.findFirst>> & object;

function toDto(t: TxRow): TransactionDto {
  return {
    txId: t.id,
    txRef: t.txRef,
    accountId: t.accountId,
    direction: t.direction,
    amount: t.amount.toString(),
    currency: t.currency,
    balanceAfter: t.balanceAfter.toString(),
    category: t.category ?? null,
    merchantName: t.merchantName ?? null,
    description: t.description,
    bookedAt: t.bookedAt.toISOString(),
    valueDate: t.valueDate.toISOString(),
    status: t.status,
  };
}

// Cursor: opaque base64 of "<isoDate>|<txRef>" — stable & sortable
function encodeCursor(t: TxRow): string {
  return Buffer.from(`${t.bookedAt.toISOString()}|${t.txRef}`).toString("base64url");
}
function decodeCursor(c: string): { bookedAt: Date; txRef: string } {
  const raw = Buffer.from(c, "base64url").toString("utf8");
  const [iso, ref] = raw.split("|");
  if (!iso || !ref) throw BadRequest("Invalid cursor");
  return { bookedAt: new Date(iso), txRef: ref };
}

async function resolveAccount(accountIdOrRef: string) {
  const a = await prisma.account.findFirst({
    where: { OR: [{ id: accountIdOrRef }, { accountRef: accountIdOrRef }] },
  });
  if (!a) throw NotFound(`Account ${accountIdOrRef}`);
  return a;
}

export const transactionsService = {
  async list(
    accountIdOrRef: string,
    q: ListQueryT,
  ): Promise<{ items: TransactionDto[]; nextCursor: string | null }> {
    const a = await resolveAccount(accountIdOrRef);
    const where: Record<string, unknown> = { accountId: a.id };
    if (q.from_date || q.to_date) {
      const range: Record<string, Date> = {};
      if (q.from_date) range.gte = new Date(q.from_date);
      if (q.to_date) range.lte = new Date(q.to_date);
      where.bookedAt = range;
    }

    let cursorClause: Record<string, unknown> | undefined;
    if (q.cursor) {
      const { bookedAt, txRef } = decodeCursor(q.cursor);
      cursorClause = {
        OR: [
          { bookedAt: { lt: bookedAt } },
          { AND: [{ bookedAt }, { txRef: { lt: txRef } }] },
        ],
      };
    }
    if (cursorClause) Object.assign(where, cursorClause);

    const rows = await prisma.transaction.findMany({
      where,
      orderBy: [{ bookedAt: "desc" }, { txRef: "desc" }],
      take: q.limit + 1,
    });
    const hasMore = rows.length > q.limit;
    const page = rows.slice(0, q.limit);
    const nextCursor = hasMore && page.length > 0 ? encodeCursor(page[page.length - 1]!) : null;
    return { items: page.map(toDto), nextCursor };
  },

  async getByRef(txIdOrRef: string): Promise<TransactionDto> {
    const t = await prisma.transaction.findFirst({
      where: { OR: [{ id: txIdOrRef }, { txRef: txIdOrRef }] },
    });
    if (!t) throw NotFound(`Transaction ${txIdOrRef}`);
    return toDto(t);
  },

  async search(input: SearchInputT): Promise<TransactionDto[]> {
    const where: Record<string, unknown> = {};
    if (input.accountId) {
      const a = await resolveAccount(input.accountId);
      where.accountId = a.id;
    } else if (input.partyId) {
      const accounts = await prisma.account.findMany({
        where: { OR: [{ partyId: input.partyId }, { party: { partyRef: input.partyId } }] },
        select: { id: true },
      });
      where.accountId = { in: accounts.map((a: { id: string }) => a.id) };
    }
    if (input.category) where.category = input.category;
    if (input.merchantName) where.merchantName = input.merchantName;
    if (input.fromDate || input.toDate) {
      const range: Record<string, Date> = {};
      if (input.fromDate) range.gte = new Date(input.fromDate);
      if (input.toDate) range.lte = new Date(input.toDate);
      where.bookedAt = range;
    }
    if (input.minAmount !== undefined || input.maxAmount !== undefined) {
      const range: Record<string, number> = {};
      if (input.minAmount !== undefined) range.gte = input.minAmount;
      if (input.maxAmount !== undefined) range.lte = input.maxAmount;
      where.amount = range;
    }
    const rows = await prisma.transaction.findMany({
      where,
      orderBy: [{ bookedAt: "desc" }],
      take: input.limit,
    });
    return rows.map(toDto);
  },
};
