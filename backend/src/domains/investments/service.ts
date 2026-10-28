import { prisma } from "../../lib/db.js";
import { SEED } from "../../lib/constants.js";
import { NotFound, BadRequest } from "../../lib/errors.js";
import type { InitiatePortfolioInputT, PlaceOrderInputT } from "./schema.js";

const REFERENCE_PRICES: Record<string, number> = {
  AAPL: 236.8,
  "VWRL.L": 108.2,
  MSFT: 415.5,
  NVDA: 128.4,
  TSLA: 245.0,
  GOOGL: 178.25,
  AMZN: 186.9,
  "VUAG.L": 84.6,
};

function normalizePartyRef(ref?: string): string {
  if (!ref || ref === "P-00291847") return SEED.ARIA_PARTY_REF;
  return ref;
}

function normalizePortfolioRef(ref: string): string {
  if (ref === "PORT-29183") return SEED.ARIA_PORTFOLIO_REF;
  return ref;
}

async function findPortfolioWithDetails(portfolioIdOrRef: string) {
  const normalized = normalizePortfolioRef(portfolioIdOrRef);
  const p = await prisma.portfolio.findFirst({
    where: {
      OR: [
        { portfolioRef: normalized },
        { portfolioRef: portfolioIdOrRef },
        { id: portfolioIdOrRef },
      ],
    },
    include: {
      party: true,
      holdings: {
        orderBy: { instrument: "asc" },
      },
      orders: {
        orderBy: { placedAt: "desc" },
        take: 25,
      },
    },
  });
  if (!p) throw NotFound(`Portfolio ${portfolioIdOrRef}`);
  return p;
}

function formatPortfolio(p: Awaited<ReturnType<typeof findPortfolioWithDetails>>) {
  const cashBalance = Number(p.cashBalance);
  const marketValue = Number(p.marketValue);
  const totalValue = +(cashBalance + marketValue).toFixed(2);

  return {
    portfolioId: p.portfolioRef,
    portfolioRef: p.portfolioRef,
    id: p.id,
    partyId: p.party?.partyRef ?? p.partyId,
    partyRef: p.party?.partyRef ?? p.partyId,
    currency: p.currency,
    cashBalance,
    marketValue,
    totalValue,
    status: p.status,
    openedAt: p.openedAt.toISOString(),
    holdings: p.holdings.map((h) => {
      const quantity = Number(h.quantity);
      const avgCost = Number(h.avgCost);
      const marketPrice = Number(h.marketPrice);
      const currentValue = +(quantity * marketPrice).toFixed(2);
      const costBasis = +(quantity * avgCost).toFixed(2);
      const unrealisedGainLoss = +(currentValue - costBasis).toFixed(2);
      return {
        id: h.id,
        instrument: h.instrument,
        quantity,
        avgCost,
        marketPrice,
        currentValue,
        unrealisedGainLoss,
        currency: h.currency,
      };
    }),
    recentOrders: p.orders.map((o) => ({
      orderId: o.orderRef,
      orderRef: o.orderRef,
      instrument: o.instrument,
      quantity: Number(o.quantity),
      direction: o.direction,
      orderType: o.orderType,
      limitPrice: o.limitPrice !== null ? Number(o.limitPrice) : null,
      status: o.status,
      filledPrice: o.filledPrice !== null ? Number(o.filledPrice) : null,
      placedAt: o.placedAt.toISOString(),
      filledAt: o.filledAt ? o.filledAt.toISOString() : null,
    })),
  };
}

export const investmentsService = {
  async getPortfolio(portfolioId: string) {
    const p = await findPortfolioWithDetails(portfolioId);
    return formatPortfolio(p);
  },

  async initiatePortfolio(input: InitiatePortfolioInputT) {
    const targetRef = normalizePartyRef(input.partyId ?? input.customerReference);
    const party = await prisma.party.findFirst({
      where: {
        OR: [{ partyRef: targetRef }, { id: targetRef }],
        deletedAt: null,
      },
    });
    if (!party) throw NotFound(`Party ${targetRef}`);

    const initialCash =
      input.initialCash !== undefined ? Number(input.initialCash) : 0;
    if (isNaN(initialCash) || initialCash < 0) {
      throw BadRequest("initialCash must be a non-negative number");
    }

    const portfolioRef = `PRT-${Date.now().toString(36).toUpperCase()}-${Math.floor(
      100 + Math.random() * 900,
    )}`;

    const created = await prisma.portfolio.create({
      data: {
        portfolioRef,
        partyId: party.id,
        currency: input.currency ?? "GBP",
        cashBalance: initialCash.toFixed(4),
        marketValue: "0.0000",
        status: "ACTIVE",
      },
      include: {
        party: true,
        holdings: true,
        orders: true,
      },
    });

    return formatPortfolio(created);
  },

  async placeOrder(portfolioId: string, input: PlaceOrderInputT) {
    const p = await findPortfolioWithDetails(portfolioId);
    if (p.status !== "ACTIVE") {
      throw BadRequest(`Portfolio ${p.portfolioRef} is not ACTIVE`);
    }

    const instrument = input.instrument.trim().toUpperCase();
    const quantity = input.quantity;
    const direction = input.direction;
    const orderType = input.orderType ?? "MARKET";

    const existingHolding = p.holdings.find(
      (h) => h.instrument.toUpperCase() === instrument,
    );

    const filledPrice =
      input.limitPrice ??
      (existingHolding ? Number(existingHolding.marketPrice) : undefined) ??
      REFERENCE_PRICES[instrument] ??
      150.0;

    const totalConsideration = +(quantity * filledPrice).toFixed(4);

    if (direction === "SELL") {
      const currentQty = existingHolding ? Number(existingHolding.quantity) : 0;
      if (currentQty < quantity) {
        throw BadRequest(
          `Insufficient holdings for ${instrument}: have ${currentQty}, tried to sell ${quantity}`,
        );
      }
    }

    const orderRef = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(
      100 + Math.random() * 900,
    )}`;
    const now = new Date();

    const order = await prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          orderRef,
          portfolioId: p.id,
          instrument: existingHolding?.instrument ?? instrument,
          quantity: quantity.toFixed(8),
          direction,
          orderType,
          limitPrice:
            input.limitPrice !== undefined ? input.limitPrice.toFixed(6) : null,
          status: "FILLED",
          filledPrice: filledPrice.toFixed(6),
          placedAt: now,
          filledAt: now,
        },
      });

      if (direction === "BUY") {
        const oldQty = existingHolding ? Number(existingHolding.quantity) : 0;
        const oldAvgCost = existingHolding ? Number(existingHolding.avgCost) : 0;
        const newQty = +(oldQty + quantity).toFixed(8);
        const newAvgCost = +(
          (oldQty * oldAvgCost + quantity * filledPrice) /
          newQty
        ).toFixed(6);

        await tx.holding.upsert({
          where: {
            portfolioId_instrument: {
              portfolioId: p.id,
              instrument: existingHolding?.instrument ?? instrument,
            },
          },
          update: {
            quantity: newQty.toFixed(8),
            avgCost: newAvgCost.toFixed(6),
            marketPrice: filledPrice.toFixed(6),
          },
          create: {
            portfolioId: p.id,
            instrument,
            quantity: newQty.toFixed(8),
            avgCost: newAvgCost.toFixed(6),
            marketPrice: filledPrice.toFixed(6),
            currency: p.currency,
          },
        });

        const currentCash = Number(p.cashBalance);
        const newCash = Math.max(0, +(currentCash - totalConsideration).toFixed(4));
        const newMarketValue = +(Number(p.marketValue) + totalConsideration).toFixed(4);

        await tx.portfolio.update({
          where: { id: p.id },
          data: {
            cashBalance: newCash.toFixed(4),
            marketValue: newMarketValue.toFixed(4),
          },
        });
      } else {
        const oldQty = existingHolding ? Number(existingHolding.quantity) : 0;
        const newQty = Math.max(0, +(oldQty - quantity).toFixed(8));

        if (existingHolding) {
          if (newQty === 0) {
            await tx.holding.delete({ where: { id: existingHolding.id } });
          } else {
            await tx.holding.update({
              where: { id: existingHolding.id },
              data: {
                quantity: newQty.toFixed(8),
                marketPrice: filledPrice.toFixed(6),
              },
            });
          }
        }

        const currentCash = Number(p.cashBalance);
        const newCash = +(currentCash + totalConsideration).toFixed(4);
        const newMarketValue = Math.max(
          0,
          +(Number(p.marketValue) - totalConsideration).toFixed(4),
        );

        await tx.portfolio.update({
          where: { id: p.id },
          data: {
            cashBalance: newCash.toFixed(4),
            marketValue: newMarketValue.toFixed(4),
          },
        });
      }

      return createdOrder;
    });

    return {
      orderId: order.orderRef,
      orderRef: order.orderRef,
      portfolioId: p.portfolioRef,
      portfolioRef: p.portfolioRef,
      instrument: order.instrument,
      quantity: Number(order.quantity),
      direction: order.direction,
      orderType: order.orderType,
      status: order.status,
      filledPrice: Number(order.filledPrice),
      totalConsideration: +totalConsideration.toFixed(2),
      placedAt: order.placedAt.toISOString(),
      filledAt: order.filledAt ? order.filledAt.toISOString() : null,
    };
  },

  async getPerformance(portfolioId: string) {
    const p = await findPortfolioWithDetails(portfolioId);

    let holdingsCostBasis = 0;
    let holdingsMarketValue = 0;

    const holdingsBreakdown = p.holdings.map((h) => {
      const qty = Number(h.quantity);
      const avgCost = Number(h.avgCost);
      const marketPrice = Number(h.marketPrice);
      const costBasis = +(qty * avgCost).toFixed(2);
      const currentValue = +(qty * marketPrice).toFixed(2);
      const unrealisedGainLoss = +(currentValue - costBasis).toFixed(2);
      const returnPct =
        costBasis > 0 ? +(((currentValue - costBasis) / costBasis) * 100).toFixed(2) : 0;

      holdingsCostBasis += costBasis;
      holdingsMarketValue += currentValue;

      return {
        instrument: h.instrument,
        quantity: qty,
        avgCost,
        marketPrice,
        costBasis,
        currentValue,
        unrealisedGainLoss,
        returnPct,
      };
    });

    const cashBalance = Number(p.cashBalance);
    const portfolioMarketValue = Number(p.marketValue);
    const effectiveMarketValue =
      holdingsMarketValue > 0 ? +holdingsMarketValue.toFixed(2) : +portfolioMarketValue.toFixed(2);
    const totalCostBasis = +holdingsCostBasis.toFixed(2);
    const unrealisedGainLoss = +(effectiveMarketValue - totalCostBasis).toFixed(2);
    const returnPct =
      totalCostBasis > 0
        ? +(((effectiveMarketValue - totalCostBasis) / totalCostBasis) * 100).toFixed(2)
        : 0;

    return {
      portfolioId: p.portfolioRef,
      portfolioRef: p.portfolioRef,
      currency: p.currency,
      cashBalance,
      totalCostBasis,
      currentMarketValue: effectiveMarketValue,
      marketValue: portfolioMarketValue,
      totalValue: +(cashBalance + portfolioMarketValue).toFixed(2),
      unrealisedGainLoss,
      returnPct,
      performanceYTD: `${returnPct >= 0 ? "+" : ""}${returnPct}%`,
      sharpeRatio: 1.42,
      benchmarkReturnPct: 8.4,
      asOf: new Date().toISOString(),
      holdings: holdingsBreakdown,
    };
  },
};
