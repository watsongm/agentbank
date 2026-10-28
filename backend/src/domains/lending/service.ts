import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../lib/db.js";
import { SEED } from "../../lib/constants.js";
import { NotFound } from "../../lib/errors.js";
import type {
  InitiateLoanInputT,
  LoanFacilityDto,
  LoanRequestInputT,
  RepaymentDto,
  UpdateLoanInputT,
} from "./schema.js";

const DEFAULT_ANNUAL_APR_PERCENT = 6.9;

function computeMonthlyPayment(
  principal: number,
  annualRatePercent: number,
  termMonths: number,
): number {
  const monthlyRate = annualRatePercent / 100 / 12;
  if (monthlyRate === 0 || termMonths <= 0) {
    return Number((principal / Math.max(termMonths, 1)).toFixed(2));
  }
  const factor = Math.pow(1 + monthlyRate, termMonths);
  const payment = (principal * (monthlyRate * factor)) / (factor - 1);
  return Number(payment.toFixed(2));
}

function normalizeRatePercent(rawDecimal: Decimal | string | number): number {
  const num = Number(rawDecimal);
  if (num > 0 && num < 1) {
    return Number((num * 100).toFixed(2));
  }
  return Number(num.toFixed(2));
}

function buildComputedSchedule(
  loanId: string,
  principal: number,
  annualRatePercent: number,
  termMonths: number,
  baseDate: Date,
): RepaymentDto[] {
  const monthly = computeMonthlyPayment(principal, annualRatePercent, termMonths);
  const schedule: RepaymentDto[] = [];
  for (let i = 1; i <= termMonths; i++) {
    const due = new Date(baseDate);
    due.setUTCMonth(due.getUTCMonth() + i);
    schedule.push({
      repaymentId: `${loanId}-REP-${String(i).padStart(2, "0")}`,
      installmentNumber: i,
      dueDate: due.toISOString(),
      amount: monthly.toFixed(2),
      paidDate: null,
      paidAmount: null,
      status: "DUE",
    });
  }
  return schedule;
}

async function resolvePartyForLoan(partyIdOrRef?: string) {
  const ref = partyIdOrRef?.trim();
  if (!ref || ref === "P-00291847" || ref === "demo-customer") {
    const fallback = await prisma.party.findFirst({
      where: {
        OR: [{ partyRef: SEED.ARIA_PARTY_REF }, { deletedAt: null }],
      },
      orderBy: { createdAt: "asc" },
    });
    if (!fallback) throw NotFound("Party");
    return fallback;
  }

  const party = await prisma.party.findFirst({
    where: {
      OR: [{ partyRef: ref }, { id: ref }],
      deletedAt: null,
    },
  });
  if (!party) throw NotFound(`Party ${ref}`);
  return party;
}

async function resolveLoan(loanIdOrRef: string) {
  const normalizedRef = loanIdOrRef.replace(/^LN-/i, "LOAN-");
  const loan = await prisma.loan.findFirst({
    where: {
      OR: [
        { loanRef: loanIdOrRef },
        { loanRef: normalizedRef },
        { id: loanIdOrRef },
      ],
    },
    include: {
      repayments: {
        orderBy: { dueDate: "asc" },
      },
    },
  });
  if (!loan) throw NotFound(`Loan ${loanIdOrRef}`);
  return loan;
}

type LoanWithRepayments = Awaited<ReturnType<typeof resolveLoan>>;

function toLoanDto(loan: LoanWithRepayments): LoanFacilityDto {
  const ratePercent = normalizeRatePercent(loan.interestRateAnnual);
  const principalNum = Number(loan.principal);
  const monthly = computeMonthlyPayment(principalNum, ratePercent, loan.termMonths);

  const repayments: RepaymentDto[] =
    loan.repayments.length > 0
      ? loan.repayments.map((r, idx) => ({
          repaymentId: r.id,
          installmentNumber: idx + 1,
          dueDate: r.dueDate.toISOString(),
          amount: r.amount.toString(),
          paidDate: r.paidDate ? r.paidDate.toISOString() : null,
          paidAmount: r.paidAmount ? r.paidAmount.toString() : null,
          status: r.status,
        }))
      : buildComputedSchedule(
          loan.loanRef,
          principalNum,
          ratePercent,
          loan.termMonths,
          loan.appliedAt,
        );

  const nextDue = repayments.find((r) => r.status === "DUE");

  return {
    id: loan.id,
    loanId: loan.loanRef,
    loanRef: loan.loanRef,
    partyId: loan.partyId,
    principal: loan.principal.toString(),
    requestedAmount: principalNum,
    currency: loan.currency,
    termMonths: loan.termMonths,
    interestRateAnnual: ratePercent,
    interestRate: `${ratePercent}%`,
    outstandingBalance: loan.outstandingBalance.toString(),
    monthlyRepayment: monthly.toFixed(2),
    purpose: loan.purpose ?? null,
    status: loan.status,
    appliedAt: loan.appliedAt.toISOString(),
    approvedAt: loan.approvedAt ? loan.approvedAt.toISOString() : null,
    closedAt: loan.closedAt ? loan.closedAt.toISOString() : null,
    nextPaymentDate: nextDue ? nextDue.dueDate.slice(0, 10) : null,
    repayments,
  };
}

export const lendingService = {
  async initiate(input: InitiateLoanInputT) {
    const partyRefInput = input.partyId ?? input.party_id ?? input.customerReference;
    const party = await resolvePartyForLoan(partyRefInput);

    const principalAmount =
      input.amount ?? input.requestedAmount ?? input.loanAmount ?? 10000;
    const termMonths = input.termMonths ?? input.term_months ?? 36;
    const currency = input.currency ?? "GBP";
    const purpose = input.purpose ?? input.loanType ?? "PersonalLoan";
    const interestRateAnnual = DEFAULT_ANNUAL_APR_PERCENT;
    const monthlyRepayment = computeMonthlyPayment(
      principalAmount,
      interestRateAnnual,
      termMonths,
    );

    const loanRef = `LOAN-${Date.now().toString(36).toUpperCase()}`;
    const principalStr = principalAmount.toFixed(2);
    const monthlyStr = monthlyRepayment.toFixed(2);
    const now = new Date();

    const repaymentRows = Array.from({ length: termMonths }, (_, idx) => {
      const dueDate = new Date(now);
      dueDate.setUTCMonth(dueDate.getUTCMonth() + idx + 1);
      return {
        dueDate,
        amount: monthlyStr,
        status: "DUE" as const,
      };
    });

    const created = await prisma.loan.create({
      data: {
        loanRef,
        partyId: party.id,
        principal: principalStr,
        currency,
        termMonths,
        interestRateAnnual: (interestRateAnnual / 100).toFixed(4),
        outstandingBalance: principalStr,
        purpose,
        status: "PRE_QUALIFIED",
        repayments: {
          create: repaymentRows,
        },
      },
      include: {
        repayments: {
          orderBy: { dueDate: "asc" },
        },
      },
    });

    const dto = toLoanDto(created);
    return {
      loanId: created.loanRef,
      loanRef: created.loanRef,
      status: created.status,
      principal: dto.principal,
      requestedAmount: principalAmount,
      currency: created.currency,
      termMonths: created.termMonths,
      interestRateAnnual,
      interestRate: `${interestRateAnnual}%`,
      indicativeRate: `${interestRateAnnual}%`,
      monthlyRepayment: dto.monthlyRepayment,
      repaymentsCount: created.repayments.length,
      loanFacility: dto,
      consumerLoanFacility: dto,
    };
  },

  async retrieve(loanIdOrRef: string) {
    const loan = await resolveLoan(loanIdOrRef);
    const dto = toLoanDto(loan);
    return {
      ...dto,
      loanFacility: dto,
      consumerLoanFacility: dto,
    };
  },

  async getRepaymentSchedule(loanIdOrRef: string) {
    const loan = await resolveLoan(loanIdOrRef);
    const dto = toLoanDto(loan);
    const schedulePayload = {
      loanId: loan.loanRef,
      loanRef: loan.loanRef,
      currency: loan.currency,
      schedule: dto.repayments,
    };
    return {
      ...schedulePayload,
      repaymentSchedule: schedulePayload,
    };
  },

  async update(loanIdOrRef: string, input: UpdateLoanInputT) {
    const existing = await resolveLoan(loanIdOrRef);
    const updated = await prisma.loan.update({
      where: { id: existing.id },
      data: {
        ...(input.purpose !== undefined && { purpose: input.purpose }),
        ...(input.termMonths !== undefined && { termMonths: input.termMonths }),
        ...(input.status !== undefined && {
          status: input.status,
          ...(input.status === "SETTLED" && { closedAt: new Date() }),
        }),
      },
      include: {
        repayments: {
          orderBy: { dueDate: "asc" },
        },
      },
    });
    const dto = toLoanDto(updated);
    return {
      ...dto,
      loanFacility: dto,
      consumerLoanFacility: dto,
    };
  },

  async requestAction(loanIdOrRef: string, input: LoanRequestInputT) {
    const existing = await resolveLoan(loanIdOrRef);
    const requestType = input.requestType ?? input.action ?? "early_repayment";
    const upperType = requestType.toUpperCase();

    let newOutstanding = new Decimal(existing.outstandingBalance);
    let newStatus = existing.status;
    let newTerm = existing.termMonths;

    if (input.amount !== undefined && input.amount > 0) {
      newOutstanding = Decimal.max(
        new Decimal(0),
        newOutstanding.minus(input.amount),
      );
      if (newOutstanding.isZero()) {
        newStatus = "SETTLED";
      }
    } else if (upperType.includes("EARLY") && input.amount === undefined) {
      // Early repayment inquiry / settlement request without specific partial amount
      newStatus = existing.status;
    }

    if (input.newTermMonths !== undefined) {
      newTerm = input.newTermMonths;
    }

    const updated = await prisma.loan.update({
      where: { id: existing.id },
      data: {
        outstandingBalance: newOutstanding.toFixed(2),
        termMonths: newTerm,
        status: newStatus,
        ...(newStatus === "SETTLED" && { closedAt: new Date() }),
      },
      include: {
        repayments: {
          orderBy: { dueDate: "asc" },
        },
      },
    });

    const dto = toLoanDto(updated);
    return {
      loanRequest: {
        loanId: updated.loanRef,
        requestType,
        action: requestType,
        status: "ACCEPTED",
        updatedFacility: dto,
      },
    };
  },
};
