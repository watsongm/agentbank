// Seed data for agentBANK reference backend.
//
// Three personas, six accounts, 90 days of transactions, one loan (with
// repayment schedule), one card, one portfolio, one compliance case,
// one notification subscription, and default OAuth clients. Matches the shape
// used by the existing frontend mock so the Smart Savings Agent demo works
// identically against the real backend.
//
// Idempotent — safe to re-run. Each entity has a stable external ref.

import { PrismaClient } from "@prisma/client";
import { SEED } from "../src/lib/constants.js";

const prisma = new PrismaClient();

type TxSeed = {
  txRef: string;
  accountId: string;
  direction: "DEBIT" | "CREDIT";
  amount: string;
  currency: string;
  balanceAfter: string;
  category: string;
  merchantName?: string;
  description: string;
  bookedAt: Date;
  valueDate: Date;
};

// Prisma accepts decimal as string at the input boundary
const D = (s: string) => s;

const PERSONAS = [
  {
    partyRef: SEED.ARIA_PARTY_REF,
    legalName: "Aria Chen",
    givenName: "Aria",
    familyName: "Chen",
    email: "aria.chen@example.com",
    dateOfBirth: "1991-05-14",
    city: "London",
    postcode: "E1 6AN",
    country: "GB",
    kycStatus: "VERIFIED" as const,
    riskRating: "LOW" as const,
    accounts: [
      { ref: SEED.ARIA_CURRENT_REF, type: "CURRENT" as const, product: "Everyday Current", available: "4821.50", ledger: "4821.50", overdraft: "500.00" },
      { ref: SEED.ARIA_SAVINGS_REF, type: "SAVINGS" as const, product: "Easy Saver", available: "12500.00", ledger: "12500.00", overdraft: "0" },
    ],
    card: { ref: SEED.ARIA_CARD_REF, type: "CREDIT" as const, last4: "4291", limit: "5000", balance: "1758.20" },
    portfolio: {
      ref: SEED.ARIA_PORTFOLIO_REF,
      cash: "1250.00",
      market: "47041.44",
      holdings: [
        { instrument: "AAPL", quantity: "12", avgCost: "180.00", marketPrice: "236.80" },
        { instrument: "VWRL.L", quantity: "180", avgCost: "96.50", marketPrice: "108.20" },
      ],
    },
  },
  {
    partyRef: SEED.MAHLI_PARTY_REF,
    legalName: "Mahli Patel",
    givenName: "Mahli",
    familyName: "Patel",
    email: "mahli.patel@example.com",
    dateOfBirth: "1985-11-02",
    city: "Manchester",
    postcode: "M1 2AB",
    country: "GB",
    kycStatus: "VERIFIED" as const,
    riskRating: "LOW" as const,
    accounts: [
      { ref: SEED.MAHLI_CURRENT_REF, type: "CURRENT" as const, product: "Everyday Current", available: "1284.00", ledger: "1284.00", overdraft: "250.00" },
    ],
    loan: {
      ref: SEED.MAHLI_LOAN_REF,
      principal: "10000",
      termMonths: 36,
      rate: "0.069",
      outstanding: "7842.33",
      purpose: "HomeImprovement",
    },
  },
  {
    partyRef: SEED.OKORO_PARTY_REF,
    legalName: "Noah Okoro",
    givenName: "Noah",
    familyName: "Okoro",
    email: "noah.okoro@example.com",
    dateOfBirth: "1996-02-21",
    city: "Bristol",
    postcode: "BS1 4DJ",
    country: "GB",
    kycStatus: "PENDING" as const,
    riskRating: "LOW" as const,
    accounts: [
      { ref: SEED.OKORO_CURRENT_REF, type: "CURRENT" as const, product: "Everyday Current", available: "324.78", ledger: "324.78", overdraft: "0" },
    ],
  },
];

async function main() {
  console.log("Seeding agentBANK reference data...");

  for (const persona of PERSONAS) {
    const party = await prisma.party.upsert({
      where: { partyRef: persona.partyRef },
      update: {},
      create: {
        partyRef: persona.partyRef,
        legalName: persona.legalName,
        givenName: persona.givenName,
        familyName: persona.familyName,
        email: persona.email,
        dateOfBirth: new Date(persona.dateOfBirth),
        city: persona.city,
        postcode: persona.postcode,
        country: persona.country,
        kycStatus: persona.kycStatus,
        riskRating: persona.riskRating,
        partyType: "INDIVIDUAL",
      },
    });
    console.log(`  party ${party.partyRef} — ${party.legalName}`);

    for (const acc of persona.accounts) {
      await prisma.account.upsert({
        where: { accountRef: acc.ref },
        update: {
          availableBalance: D(acc.available),
          ledgerBalance: D(acc.ledger),
        },
        create: {
          accountRef: acc.ref,
          partyId: party.id,
          accountType: acc.type,
          productName: acc.product,
          currency: "GBP",
          availableBalance: D(acc.available),
          ledgerBalance: D(acc.ledger),
          overdraftLimit: D(acc.overdraft),
          status: "ACTIVE",
        },
      });
      console.log(`    account ${acc.ref} (${acc.type})`);
    }

    // Seed 90 days of transactions on the primary current account
    const primary = persona.accounts.find((a) => a.type === "CURRENT");
    if (primary) {
      const acct = await prisma.account.findUniqueOrThrow({ where: { accountRef: primary.ref } });
      const existing = await prisma.transaction.count({ where: { accountId: acct.id } });
      if (existing === 0) {
        const now = Date.now();
        const day = 24 * 3600 * 1000;
        const txs: TxSeed[] = [];
        let running = Number(primary.ledger);
        // 90 days of realistic pattern: ~daily £5–80 spend + monthly £2500 salary credit
        for (let i = 89; i >= 0; i--) {
          const date = new Date(now - i * day);
          if (date.getDate() === 25) {
            running += 2500;
            txs.push({
              txRef: `TXN-${acct.accountRef}-${i}-SAL`,
              accountId: acct.id,
              direction: "CREDIT",
              amount: D("2500.00"),
              currency: "GBP",
              balanceAfter: D(running.toFixed(2)),
              category: "Salary",
              description: "SALARY PAYMENT",
              bookedAt: date,
              valueDate: date,
            });
          }
          // daily small debit
          const amt = +(5 + Math.random() * 75).toFixed(2);
          running -= amt;
          const merchants = ["TESCO STORES", "TFL TRAVEL", "PRET A MANGER", "NETFLIX.COM", "AMAZON UK"];
          txs.push({
            txRef: `TXN-${acct.accountRef}-${i}-D`,
            accountId: acct.id,
            direction: "DEBIT",
            amount: D(amt.toFixed(2)),
            currency: "GBP",
            balanceAfter: D(running.toFixed(2)),
            category: "Groceries",
            merchantName: merchants[i % merchants.length],
            description: merchants[i % merchants.length] ?? "PURCHASE",
            bookedAt: date,
            valueDate: date,
          });
        }
        await prisma.transaction.createMany({ data: txs });
        console.log(`    seeded ${txs.length} transactions on ${acct.accountRef}`);
      }
    }

    if (persona.card) {
      await prisma.card.upsert({
        where: { cardRef: persona.card.ref },
        update: {},
        create: {
          cardRef: persona.card.ref,
          partyId: party.id,
          cardType: persona.card.type,
          last4: persona.card.last4,
          expiryMonth: 12,
          expiryYear: 2029,
          creditLimit: D(persona.card.limit),
          currentBalance: D(persona.card.balance),
          status: "ACTIVE",
        },
      });
      console.log(`    card ${persona.card.ref}`);
    }

    if (persona.loan) {
      const loan = await prisma.loan.upsert({
        where: { loanRef: persona.loan.ref },
        update: {},
        create: {
          loanRef: persona.loan.ref,
          partyId: party.id,
          principal: D(persona.loan.principal),
          currency: "GBP",
          termMonths: persona.loan.termMonths,
          interestRateAnnual: D(persona.loan.rate),
          outstandingBalance: D(persona.loan.outstanding),
          purpose: persona.loan.purpose,
          status: "REPAYING",
          approvedAt: new Date(Date.now() - 180 * 24 * 3600 * 1000),
        },
      });

      // Seed 6 monthly Repayment schedule rows (2 PAID and 4 DUE) idempotently
      await prisma.repayment.deleteMany({ where: { loanId: loan.id } });
      const monthMs = 30 * 24 * 3600 * 1000;
      const now = Date.now();
      const monthlyInstalment = "308.29";
      const repaymentRows = [-2, -1, 1, 2, 3, 4].map((offset) => {
        const dueDate = new Date(now + offset * monthMs);
        const isPaid = offset < 0;
        return {
          loanId: loan.id,
          dueDate,
          amount: D(monthlyInstalment),
          paidDate: isPaid ? dueDate : null,
          paidAmount: isPaid ? D(monthlyInstalment) : null,
          status: isPaid ? ("PAID" as const) : ("DUE" as const),
        };
      });
      await prisma.repayment.createMany({ data: repaymentRows });
      console.log(`    loan ${persona.loan.ref} (with ${repaymentRows.length} repayment schedule rows)`);
    }

    if (persona.portfolio) {
      const p = await prisma.portfolio.upsert({
        where: { portfolioRef: persona.portfolio.ref },
        update: {},
        create: {
          portfolioRef: persona.portfolio.ref,
          partyId: party.id,
          currency: "GBP",
          cashBalance: D(persona.portfolio.cash),
          marketValue: D(persona.portfolio.market),
        },
      });
      for (const h of persona.portfolio.holdings) {
        await prisma.holding.upsert({
          where: { portfolioId_instrument: { portfolioId: p.id, instrument: h.instrument } },
          update: {
            quantity: D(h.quantity),
            marketPrice: D(h.marketPrice),
          },
          create: {
            portfolioId: p.id,
            instrument: h.instrument,
            quantity: D(h.quantity),
            avgCost: D(h.avgCost),
            marketPrice: D(h.marketPrice),
          },
        });
      }
      console.log(`    portfolio ${persona.portfolio.ref}`);
    }
  }

  // Seed Aria's default ComplianceCase (CASE-9001) & NotificationSubscription (SUB-1001)
  const aria = await prisma.party.findUniqueOrThrow({
    where: { partyRef: SEED.ARIA_PARTY_REF },
  });

  const sampleTxRef = `TXN-${SEED.ARIA_CURRENT_REF}-0-D`;
  await prisma.complianceCase.upsert({
    where: { caseRef: SEED.ARIA_CASE_REF },
    update: {
      subjectType: "transaction",
      subjectId: sampleTxRef,
      partyId: aria.id,
      screenType: "AML",
      decision: "CLEAR",
      score: 8,
      reasons: ["Verified domestic transfer", "Known counterparty"],
    },
    create: {
      caseRef: SEED.ARIA_CASE_REF,
      subjectType: "transaction",
      subjectId: sampleTxRef,
      partyId: aria.id,
      screenType: "AML",
      decision: "CLEAR",
      score: 8,
      reasons: ["Verified domestic transfer", "Known counterparty"],
      resolvedAt: new Date(),
    },
  });
  console.log(`  complianceCase ${SEED.ARIA_CASE_REF}`);

  await prisma.notificationSubscription.upsert({
    where: { id: SEED.ARIA_SUB_REF },
    update: {
      partyId: aria.id,
      eventTypes: ["payment.completed", "balance.threshold"],
      webhookUrl: "https://agent.example.com/webhooks/agentbank",
      verificationToken: "vtok-seed-1001",
      active: true,
    },
    create: {
      id: SEED.ARIA_SUB_REF,
      partyId: aria.id,
      eventTypes: ["payment.completed", "balance.threshold"],
      webhookUrl: "https://agent.example.com/webhooks/agentbank",
      verificationToken: "vtok-seed-1001",
      active: true,
    },
  });
  console.log(`  notificationSubscription ${SEED.ARIA_SUB_REF}`);

  // Seed default OAuth Client
  await prisma.client.upsert({
    where: { clientId: "agentbank-sdk" },
    update: {
      clientSecret: "demo-secret",
      name: "agentBANK Reference Agent",
      scopes: ["accounts:read", "payments:write"],
      active: true,
    },
    create: {
      clientId: "agentbank-sdk",
      clientSecret: "demo-secret",
      name: "agentBANK Reference Agent",
      scopes: ["accounts:read", "payments:write"],
      active: true,
    },
  });
  console.log("  client agentbank-sdk");

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
