// Seed data for agentBANK reference backend.
//
// Three personas, six accounts, 90 days of transactions, one loan, one card,
// one portfolio. Matches the shape used by the existing frontend mock so the
// Smart Savings Agent demo works identically against the real backend.
//
// Idempotent — safe to re-run. Each entity has a stable external ref.

import { PrismaClient } from "@prisma/client";

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
    partyRef: "PAR-ARIA",
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
      { ref: "ACC-1829", type: "CURRENT" as const, product: "Everyday Current", available: "4821.50", ledger: "4821.50", overdraft: "500.00" },
      { ref: "ACC-2041", type: "SAVINGS" as const, product: "Easy Saver", available: "12500.00", ledger: "12500.00", overdraft: "0" },
    ],
    card: { ref: "CRD-88421", type: "CREDIT" as const, last4: "4291", limit: "5000", balance: "1758.20" },
    portfolio: {
      ref: "PRT-29183",
      cash: "1250.00",
      market: "47041.44",
      holdings: [
        { instrument: "AAPL", quantity: "12", avgCost: "180.00", marketPrice: "236.80" },
        { instrument: "VWRL.L", quantity: "180", avgCost: "96.50", marketPrice: "108.20" },
      ],
    },
  },
  {
    partyRef: "PAR-MAHLI",
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
      { ref: "ACC-3311", type: "CURRENT" as const, product: "Everyday Current", available: "1284.00", ledger: "1284.00", overdraft: "250.00" },
    ],
    loan: {
      ref: "LOAN-48291",
      principal: "10000",
      termMonths: 36,
      rate: "0.069",
      outstanding: "7842.33",
      purpose: "HomeImprovement",
    },
  },
  {
    partyRef: "PAR-OKORO",
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
      { ref: "ACC-5522", type: "CURRENT" as const, product: "Everyday Current", available: "324.78", ledger: "324.78", overdraft: "0" },
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
      await prisma.loan.upsert({
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
      console.log(`    loan ${persona.loan.ref}`);
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
