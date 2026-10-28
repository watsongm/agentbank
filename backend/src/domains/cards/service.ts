import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../lib/db.js";
import { SEED } from "../../lib/constants.js";
import { NotFound, BadRequest } from "../../lib/errors.js";
import type {
  CardFacilityDto,
  CardRequestInputT,
  InitiateCardInputT,
  UpdateCardInputT,
} from "./schema.js";

type CardRow = NonNullable<Awaited<ReturnType<typeof prisma.card.findFirst>>>;

function normalizeCardType(raw?: string): "DEBIT" | "CREDIT" | "PREPAID" {
  if (!raw) return "CREDIT";
  const upper = raw.toUpperCase();
  if (upper === "DEBIT" || upper === "CREDIT" || upper === "PREPAID") {
    return upper;
  }
  if (upper.includes("DEBIT")) return "DEBIT";
  if (upper.includes("PREPAID")) return "PREPAID";
  return "CREDIT";
}

function toCardDto(c: CardRow): CardFacilityDto {
  const limitDec = c.creditLimit ? new Decimal(c.creditLimit) : null;
  const balDec = new Decimal(c.currentBalance);
  const availDec = limitDec ? Decimal.max(new Decimal(0), limitDec.minus(balDec)) : new Decimal(0);

  return {
    id: c.id,
    cardId: c.cardRef,
    cardRef: c.cardRef,
    partyId: c.partyId,
    linkedAccountId: c.linkedAccountId ?? null,
    cardType: c.cardType,
    last4: c.last4,
    expiryMonth: c.expiryMonth,
    expiryYear: c.expiryYear,
    creditLimit: c.creditLimit ? c.creditLimit.toString() : null,
    currentBalance: c.currentBalance.toString(),
    availableCredit: availDec.toFixed(2),
    status: c.status,
    issuedAt: c.issuedAt.toISOString(),
  };
}

async function resolveParty(partyIdOrRef?: string) {
  const ref = partyIdOrRef?.trim() || SEED.ARIA_PARTY_REF;
  const party = await prisma.party.findFirst({
    where: {
      OR: [{ partyRef: ref }, { id: ref }],
      deletedAt: null,
    },
  });
  if (party) return party;
  const fallback = await prisma.party.findFirst({
    where: {
      OR: [{ partyRef: SEED.ARIA_PARTY_REF }, { deletedAt: null }],
    },
    orderBy: { createdAt: "asc" },
  });
  if (!fallback) throw NotFound(`Party ${ref}`);
  return fallback;
}

async function resolveCard(cardIdOrRef: string): Promise<CardRow> {
  const altRef = cardIdOrRef.startsWith("CARD-")
    ? cardIdOrRef.replace(/^CARD-/, "CRD-")
    : cardIdOrRef.startsWith("CRD-")
      ? cardIdOrRef.replace(/^CRD-/, "CARD-")
      : cardIdOrRef;

  const card = await prisma.card.findFirst({
    where: {
      OR: [
        { cardRef: cardIdOrRef },
        { cardRef: altRef },
        { id: cardIdOrRef },
      ],
    },
  });
  if (!card) throw NotFound(`Card ${cardIdOrRef}`);
  return card;
}

export const cardsService = {
  async getStatements(accountIdOrRef: string) {
    const account = await prisma.account.findFirst({
      where: {
        OR: [{ accountRef: accountIdOrRef }, { id: accountIdOrRef }],
      },
    });
    if (!account) throw NotFound(`Account ${accountIdOrRef}`);

    const now = new Date();
    const statements = [0, 1, 2].map((monthsAgo) => {
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1));
      const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1));
      const ym = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}`;
      return {
        StatementId: `STMT-${account.accountRef}-${ym}`,
        AccountId: account.accountRef,
        StatementReference: ym,
        Type: "RegularPeriodic",
        StartDateTime: start.toISOString(),
        EndDateTime: end.toISOString(),
        CreationDateTime: end.toISOString(),
        StatementAmount: [
          {
            CreditDebitIndicator: "Credit",
            Type: "ClosingBalance",
            Amount: {
              Amount: account.ledgerBalance.toString(),
              Currency: account.currency,
            },
          },
        ],
      };
    });

    return {
      Data: { Statement: statements },
      Links: { Self: `/open-banking/v3.1/accounts/${accountIdOrRef}/statements` },
      Meta: { TotalPages: 1 },
    };
  },

  async initiate(input: InitiateCardInputT) {
    const party = await resolveParty(
      input.partyId ?? input.party_id ?? input.customerReference,
    );

    let linkedAccountId: string | null = null;
    if (input.linkedAccountId) {
      const acct = await prisma.account.findFirst({
        where: {
          OR: [{ accountRef: input.linkedAccountId }, { id: input.linkedAccountId }],
        },
      });
      if (acct) linkedAccountId = acct.id;
    }

    const cardRef = `CRD-${Date.now().toString(36).toUpperCase()}`;
    const last4 = String(Math.floor(1000 + Math.random() * 9000));
    const now = new Date();
    const cardType = normalizeCardType(input.cardType);
    const creditLimitStr = (input.creditLimit ?? 5000).toFixed(2);

    const card = await prisma.card.create({
      data: {
        cardRef,
        partyId: party.id,
        linkedAccountId,
        cardType,
        last4,
        expiryMonth: 12,
        expiryYear: now.getUTCFullYear() + 4,
        creditLimit: cardType === "CREDIT" ? creditLimitStr : null,
        currentBalance: "0.00",
        status: "ACTIVE",
      },
    });

    const dto = toCardDto(card);
    return {
      ...dto,
      cardFacility: dto,
    };
  },

  async retrieve(cardIdOrRef: string) {
    const card = await resolveCard(cardIdOrRef);
    const dto = toCardDto(card);
    return {
      ...dto,
      cardFacility: dto,
    };
  },

  async update(cardIdOrRef: string, input: UpdateCardInputT) {
    const existing = await resolveCard(cardIdOrRef);
    const updated = await prisma.card.update({
      where: { id: existing.id },
      data: {
        ...(input.creditLimit !== undefined && {
          creditLimit: input.creditLimit.toFixed(2),
        }),
        ...(input.status !== undefined && { status: input.status }),
      },
    });
    const dto = toCardDto(updated);
    return {
      ...dto,
      cardFacility: dto,
    };
  },

  async requestAction(cardIdOrRef: string, input: CardRequestInputT) {
    const existing = await resolveCard(cardIdOrRef);
    const rawAction = input.action.trim().toUpperCase();

    let targetStatus: "ACTIVE" | "BLOCKED" | "EXPIRED" | "LOST" | "STOLEN" | "PENDING";
    if (rawAction === "BLOCK" || rawAction === "FREEZE") {
      targetStatus = "BLOCKED";
    } else if (rawAction === "UNBLOCK" || rawAction === "UNFREEZE" || rawAction === "ACTIVATE") {
      targetStatus = "ACTIVE";
    } else if (rawAction === "REPLACE") {
      targetStatus = "ACTIVE";
    } else if (rawAction === "LOST") {
      targetStatus = "LOST";
    } else if (rawAction === "STOLEN") {
      targetStatus = "STOLEN";
    } else {
      throw BadRequest(`Unsupported card action: ${input.action}`);
    }

    const updated = await prisma.card.update({
      where: { id: existing.id },
      data: { status: targetStatus },
    });

    const dto = toCardDto(updated);
    return {
      cardId: updated.cardRef,
      cardRef: updated.cardRef,
      action: rawAction,
      reason: input.reason ?? null,
      status: updated.status,
      cardFacility: dto,
    };
  },
};
