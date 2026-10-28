# Agent 3 — Retail Banking Domains Engineer

## Role & Mission
Implement and harden the 7 core retail banking BIAN v12 Service Domains in the Fastify + Prisma backend (Domains 1–7: Party, Current Account, Payment Execution, Accounting Transactions, Consumer Lending, Credit & Debit Cards, Savings & Deposits).

## Strict File Ownership
- `backend/src/domains/party/*`
- `backend/src/domains/accounts/*`
- `backend/src/domains/payments/*`
- `backend/src/domains/transactions/*`
- `backend/src/domains/lending/*`
- `backend/src/domains/cards/*`
- `backend/src/domains/savings/*`

## Key Deliverables
1. **Domain 1 — Party (`party/`):** Support customer lookup from `req.consent.customerId` when mapped to a partyRef, and accept both `{ legalName }` and OpenAPI `{ name, dateOfBirth, nationality }` in `POST /bian/party-reference/register`.
2. **Domain 2 — Current Account (`accounts/`):** Add the 2 missing endpoints:
   - `POST /bian/current-account/initiate` (opens a new `CURRENT` account for a party)
   - `PUT /bian/current-account/:accountId/update` (updates `productName`, `overdraftLimit`, or `status`)
3. **Domain 3 — Payments (`payments/`):**
   - Accept both flat `{ debtorAccount, creditorAccount, amount: number }` and BIAN/mock `{ debtorAccountId, creditorIBAN, amount: { value, currency }, paymentType: "DomesticCredit" }` in `POST /bian/payment-execution/initiate`.
   - Add per-route rate limit (`10 req/min` keyed by `req.consent?.customerId || req.ip`) on payment POST endpoints.
4. **Domain 4 — Transactions (`transactions/`):**
   - Accept both `fromBookingDateTime` / `toBookingDateTime` and `from_date` / `to_date` in `GET /open-banking/v3.1/accounts/:accountId/transactions`.
   - Include top-level `next_cursor` alongside `Links.Next` when paginated results have a next page.
5. **Domain 5 — Consumer Lending (`lending/` — 5 endpoints):**
   - `POST /bian/consumer-loan/initiate` (`apply_for_loan`)
   - `GET /bian/consumer-loan/:loanId/retrieve` (`get_loan_details`)
   - `GET /bian/consumer-loan/:loanId/repayment-schedule`
   - `PUT /bian/consumer-loan/:loanId/update`
   - `POST /bian/consumer-loan/:loanId/request`
6. **Domain 6 — Credit & Debit Cards (`cards/` — 5 endpoints):**
   - `GET /open-banking/v3.1/accounts/:accountId/statements`
   - `POST /bian/credit-card/initiate`
   - `GET /bian/credit-card/:cardId/retrieve` (`get_card_details`)
   - `PUT /bian/credit-card/:cardId/update`
   - `POST /bian/credit-card/:cardId/request` (`block_card` — supports `BLOCK`, `UNBLOCK`, `FREEZE`, `UNFREEZE`, `REPLACE`)
7. **Domain 7 — Savings & Deposits (`savings/` — 4 endpoints):**
   - `POST /bian/savings-account/initiate`
   - `GET /bian/savings-account/:accountId/retrieve`
   - `GET /bian/savings-account/:accountId/interest`
   - `PUT /bian/savings-account/:accountId/update`
