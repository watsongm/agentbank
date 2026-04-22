/**
 * AgentBankAgent SDK
 *
 * A lightweight client for building agents on top of agentBANK.
 * Wraps authentication and all 14 tool functions into a single class.
 *
 * Usage:
 *   import { AgentBankAgent } from "./sdk/index.js";
 *
 *   const agent = new AgentBankAgent({ scope: "accounts:read payments:write" });
 *   const token = await agent.authenticate();
 *   const party = await agent.tools.get_party({ consent_token: token });
 */

export class AgentBankAgent {
  /**
   * @param {object} options
   * @param {string} options.scope       - Space-separated OAuth scopes, e.g. "accounts:read payments:write"
   * @param {string} [options.baseUrl]   - agentBANK base URL (defaults to AGENTBANK_BASE_URL env var or http://localhost:3000)
   * @param {string} [options.clientId]  - OAuth client ID (defaults to AGENT_CLIENT_ID env var)
   * @param {string} [options.token]     - Pre-existing bearer token (skips authenticate())
   */
  constructor({ scope, baseUrl, clientId, token } = {}) {
    this.scope    = scope ?? "accounts:read";
    this.baseUrl  = baseUrl  ?? (typeof process !== "undefined" ? process.env.AGENTBANK_BASE_URL : null) ?? "http://localhost:3000";
    this.clientId = clientId ?? (typeof process !== "undefined" ? process.env.AGENT_CLIENT_ID  : null) ?? "demo-client";
    this._token   = token ?? null;
    this.tools    = this._buildTools();
  }

  /**
   * Authenticate via FAPI 2.0 PAR flow and return a scoped consent token.
   * In production this performs the full OAuth exchange; in demo mode it
   * returns a signed demo token scoped to the requested domains.
   *
   * @returns {Promise<string>} Bearer token string
   */
  async authenticate() {
    const res = await this._fetch("POST", "/open-banking/v3.1/oauth/token", {
      grant_type: "client_credentials",
      client_id:  this.clientId,
      scope:      this.scope,
    });
    this._token = res.access_token ?? res.token ?? `demo-${this.scope.replace(/\s/g, "-")}`;
    return this._token;
  }

  /* ── Internal HTTP helper ── */
  async _fetch(method, path, body, extraHeaders = {}) {
    const headers = {
      "Content-Type": "application/json",
      "x-fapi-interaction-id": this._uuid(),
      ...extraHeaders,
    };
    if (this._token) {
      headers["Authorization"] = this._token.startsWith("Bearer ") ? this._token : `Bearer ${this._token}`;
    }
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`agentBANK ${method} ${path} → ${res.status}: ${text}`);
    }
    return res.json();
  }

  _uuid() {
    return typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  }

  _consentHeader(consent_token) {
    const auth = consent_token.startsWith("Bearer ") ? consent_token : `Bearer ${consent_token}`;
    return { "Authorization": auth };
  }

  /* ── Tool definitions ── */
  _buildTools() {
    const self = this;
    return {
      /** Retrieve authenticated customer profile (KYC status, risk rating). */
      get_party({ consent_token }) {
        return self._fetch("GET", "/open-banking/v3.1/party", null, self._consentHeader(consent_token));
      },

      /** List all accounts in scope for the given consent token. */
      get_accounts({ consent_token }) {
        return self._fetch("GET", "/open-banking/v3.1/accounts", null, self._consentHeader(consent_token));
      },

      /** Retrieve real-time available balance for an account. */
      get_balance({ account_id }) {
        return self._fetch("GET", `/bian/current-account/${account_id}/balance`, null);
      },

      /**
       * Retrieve paginated transaction history.
       * Pass `cursor` from a previous response's `next_cursor` field to page forward.
       */
      get_transactions({ account_id, from_date, to_date, limit = 100, cursor }) {
        const params = new URLSearchParams({ fromBookingDateTime: from_date, toBookingDateTime: to_date, limit });
        if (cursor) params.set("cursor", cursor);
        return self._fetch("GET", `/open-banking/v3.1/accounts/${account_id}/transactions?${params}`, null);
      },

      /** Create and submit a domestic payment instruction. */
      initiate_payment({ debtor_account, creditor_account, amount, currency, reference }) {
        return self._fetch("POST", "/open-banking/v3.1/domestic-payments", {
          data: {
            initiation: {
              instructionIdentification: `SDK-${Date.now()}`,
              instructedAmount: { amount: String(amount), currency },
              debtorAccount:    { identification: debtor_account,   schemeName: "IBAN" },
              creditorAccount:  { identification: creditor_account, schemeName: "IBAN" },
              remittanceInformation: { reference },
            },
          },
          risk: {},
        });
      },

      /** Check execution status of a previously submitted payment. */
      get_payment_status({ payment_id }) {
        return self._fetch("GET", `/open-banking/v3.1/domestic-payments/${payment_id}`, null);
      },

      /** Retrieve loan account details and full repayment schedule. */
      get_loan_details({ loan_id }) {
        return self._fetch("GET", `/bian/consumer-loan/${loan_id}/retrieve`, null);
      },

      /** Submit a new loan application. Currency defaults to GBP. */
      apply_for_loan({ party_id, amount, currency = "GBP", term_months, purpose }) {
        return self._fetch("POST", "/bian/consumer-loan/initiate", {
          partyId: party_id,
          requestedAmount: amount,
          currency,
          termMonths: term_months,
          purpose,
        });
      },

      /** Retrieve card information including type, status, and limits. */
      get_card_details({ card_id }) {
        return self._fetch("GET", `/bian/credit-card/${card_id}/retrieve`, null);
      },

      /** Block or unblock a payment card (action: "block" | "unblock"). */
      block_card({ card_id, action }) {
        return self._fetch("POST", `/bian/credit-card/${card_id}/request`, { action });
      },

      /** Retrieve investment portfolio holdings, value, and YTD performance. */
      get_portfolio({ portfolio_id }) {
        return self._fetch("GET", `/bian/investment-portfolio/${portfolio_id}/retrieve`, null);
      },

      /** Place a buy or sell order. Fractional quantities are supported. */
      place_order({ portfolio_id, instrument, quantity, direction }) {
        return self._fetch("POST", `/bian/investment-portfolio/${portfolio_id}/request`, {
          instrument, quantity, direction,
        });
      },

      /** Run AML and sanctions screening against a party or transaction. */
      run_aml_screen({ subject_type, subject_id }) {
        return self._fetch("POST", "/bian/aml-screening/evaluate", {
          subjectType: subject_type,
          subjectId:   subject_id,
        });
      },

      /** Subscribe a webhook to real-time account events. */
      subscribe_events({ party_id, event_types, webhook_url }) {
        const verificationToken = self._uuid();
        return self._fetch("POST", "/bian/customer-event-history/webhook", {
          partyId: party_id,
          eventTypes: event_types,
          webhookUrl: webhook_url,
          verificationToken,
        });
      },
    };
  }
}
