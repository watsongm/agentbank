import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/db.js";
import { NotFound, BadRequest, Conflict } from "../../lib/errors.js";
import type { InitiatePaymentInputT, PaymentDto, UpdatePaymentInputT } from "./schema.js";

type PaymentRow = NonNullable<Awaited<ReturnType<typeof prisma.payment.findFirst>>>;

function toDto(p: PaymentRow): PaymentDto {
  return {
    paymentId: p.id,
    paymentRef: p.paymentRef,
    status: p.status,
    amount: p.amount.toString(),
    currency: p.currency,
    debtorAccountId: p.debtorAccountId,
    creditorAccountId: p.creditorAccountId ?? null,
    reference: p.reference ?? null,
    paymentType: p.paymentType,
    scheduledFor: p.scheduledFor ? p.scheduledFor.toISOString() : null,
    executedAt: p.executedAt ? p.executedAt.toISOString() : null,
    failureReason: p.failureReason ?? null,
    fapiInteractionId: p.fapiInteractionId ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

async function resolveAccount(idOrRef: string) {
  return prisma.account.findFirst({
    where: { OR: [{ id: idOrRef }, { accountRef: idOrRef }] },
  });
}

export const paymentsService = {
  /**
   * Initiate a payment. Atomic: balance check, debit debtor, credit creditor
   * (if internal), write two Transaction rows (DEBIT + CREDIT), set status COMPLETED.
   *
   * Idempotency: if a payment already exists with this fapiInteractionId, return
   * the existing record without re-posting.
   */
  async initiate(input: InitiatePaymentInputT, fapiInteractionId: string): Promise<PaymentDto> {
    // Idempotency check
    const existing = await prisma.payment.findFirst({ where: { fapiInteractionId } });
    if (existing) return toDto(existing);

    const debtor = await resolveAccount(input.debtorAccount);
    if (!debtor) throw NotFound(`Debtor account ${input.debtorAccount}`);
    if (debtor.status !== "ACTIVE") throw Conflict("Debtor account not active");

    const debtorAvail = Number(debtor.availableBalance) + Number(debtor.overdraftLimit);
    if (Number(input.amount) > debtorAvail) {
      throw BadRequest("Insufficient funds", {
        available: debtor.availableBalance.toString(),
        overdraftLimit: debtor.overdraftLimit.toString(),
        requested: input.amount,
      });
    }

    const creditor = input.creditorAccount ? await resolveAccount(input.creditorAccount) : null;

    const paymentRef = `PAY-${Date.now().toString(36).toUpperCase()}`;
    const amountStr = input.amount.toFixed(2);

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Debit debtor
      const newDebtorBal = (Number(debtor.availableBalance) - Number(input.amount)).toFixed(2);
      await tx.account.update({
        where: { id: debtor.id },
        data: {
          availableBalance: newDebtorBal,
          ledgerBalance: newDebtorBal,
        },
      });

      // Credit creditor (if internal)
      let newCreditorBal: string | null = null;
      if (creditor) {
        newCreditorBal = (Number(creditor.availableBalance) + Number(input.amount)).toFixed(2);
        await tx.account.update({
          where: { id: creditor.id },
          data: {
            availableBalance: newCreditorBal,
            ledgerBalance: newCreditorBal,
          },
        });
      }

      const payment = await tx.payment.create({
        data: {
          paymentRef,
          debtorAccountId: debtor.id,
          creditorAccountId: creditor?.id ?? null,
          creditorName: input.creditorName ?? null,
          creditorIban: input.creditorIban ?? null,
          creditorSortCode: input.creditorSortCode ?? null,
          creditorAccNum: input.creditorAccNum ?? null,
          amount: amountStr,
          currency: input.currency,
          reference: input.reference ?? null,
          paymentType: input.paymentType,
          status: input.scheduledFor ? "PENDING" : "COMPLETED",
          scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
          executedAt: input.scheduledFor ? null : new Date(),
          fapiInteractionId,
        },
      });

      // Double-entry ledger rows (only post immediately for executed payments)
      if (!input.scheduledFor) {
        await tx.transaction.create({
          data: {
            txRef: `TXN-${paymentRef}-D`,
            accountId: debtor.id,
            paymentId: payment.id,
            direction: "DEBIT",
            amount: amountStr,
            currency: input.currency,
            balanceAfter: newDebtorBal,
            description: input.reference ?? `Payment ${paymentRef}`,
            category: "Transfer",
          },
        });
        if (creditor && newCreditorBal) {
          await tx.transaction.create({
            data: {
              txRef: `TXN-${paymentRef}-C`,
              accountId: creditor.id,
              paymentId: payment.id,
              direction: "CREDIT",
              amount: amountStr,
              currency: input.currency,
              balanceAfter: newCreditorBal,
              description: input.reference ?? `Payment ${paymentRef}`,
              category: "Transfer",
            },
          });
        }
      }

      return payment;
    });

    return toDto(result);
  },

  async getByRef(idOrRef: string): Promise<PaymentDto> {
    const p = await prisma.payment.findFirst({
      where: { OR: [{ id: idOrRef }, { paymentRef: idOrRef }] },
    });
    if (!p) throw NotFound(`Payment ${idOrRef}`);
    return toDto(p);
  },

  async update(idOrRef: string, input: UpdatePaymentInputT): Promise<PaymentDto> {
    const existing = await prisma.payment.findFirst({
      where: { OR: [{ id: idOrRef }, { paymentRef: idOrRef }] },
    });
    if (!existing) throw NotFound(`Payment ${idOrRef}`);
    if (input.status === "CANCELLED" && existing.status !== "PENDING") {
      throw Conflict(`Cannot cancel payment in status ${existing.status}`);
    }
    const p = await prisma.payment.update({
      where: { id: existing.id },
      data: {
        ...(input.status && { status: input.status }),
        ...(input.reference !== undefined && { reference: input.reference }),
      },
    });
    return toDto(p);
  },
};
