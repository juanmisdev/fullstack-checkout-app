// Infrastructure adapter — HTTP client for the payment gateway sandbox API.
// Reads credentials ONLY from environment variables (never hardcoded).

import { Injectable } from '@nestjs/common';
import { PaymentGatewayPort, PaymentGatewayChargeInput, PaymentGatewayChargeResult, GatewayError } from '../../application/ports/ports';
import { createHash } from 'crypto';

export interface GatewayAcceptanceToken {
  acceptance_token: string;
  presigned_acceptance: {
    acceptance_token: string;
  };
}

@Injectable()
export class PaymentGatewayAdapter implements PaymentGatewayPort {
  private readonly baseUrl = process.env.GATEWAY_API_URL ?? '';
  private readonly publicKey = process.env.GATEWAY_PUBLIC_KEY ?? '';
  private readonly integrityKey = process.env.GATEWAY_INTEGRITY_KEY ?? '';

  /**
   * Acceptance token: GET /merchants/info with the public key as Bearer and
   * X-Merchant-Public-Key header (gateway sandbox contract).
   */
  async getAcceptanceToken(): Promise<string> {
    if (!this.baseUrl) throw new GatewayError('GATEWAY_API_URL is not configured');
    const res = await fetch(`${this.baseUrl}/merchants/info`, {
      headers: {
        Authorization: `Bearer ${this.publicKey}`,
        'X-Merchant-Public-Key': this.publicKey,
      },
    });
    if (!res.ok) throw new GatewayError(`Failed to fetch acceptance token: ${res.status}`);
    const body = (await res.json()) as {
      data: { presigned_acceptance: { acceptance_token: string } };
    };
    return body.data.presigned_acceptance.acceptance_token;
  }

  async charge(input: PaymentGatewayChargeInput): Promise<PaymentGatewayChargeResult> {
    if (!this.baseUrl) throw new GatewayError('GATEWAY_API_URL is not configured');
    const [acceptanceToken, cardToken] = await Promise.all([
      this.getAcceptanceToken(),
      this.ensureCardToken(input.cardToken, input.rawCard),
    ]);

    // Integrity signature: SHA256(reference + amount + currency + integrity key)
    // (the gateway sandbox does not include the timestamp in the digest).
    const signature = this.integrityKey
      ? createHash('sha256')
          .update(`${input.reference}${input.amountInCents}COP${this.integrityKey}`)
          .digest('hex')
      : undefined;

    const res = await fetch(`${this.baseUrl}/transactions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.publicKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount_in_cents: input.amountInCents,
        currency: 'COP',
        customer_email: input.customerEmail,
        reference: input.reference,
        payment_method: {
          type: 'CARD',
          token: cardToken,
          installments: 1,
        },
        acceptance_token: acceptanceToken,
        ...(signature ? { signature } : {}),
      }),
    });

    if (!res.ok) {
      throw new GatewayError(`Gateway returned ${res.status}`);
    }

    let body = (await res.json()) as {
      data: { id: string; status: string };
    };

    // Sandbox card transactions finalize asynchronously (PENDING -> APPROVED/DECLINED).
    // Poll the transaction endpoint until it reaches a terminal state.
    if (body.data.status === 'PENDING') {
      for (let attempt = 0; attempt < 6; attempt++) {
        await new Promise((r) => setTimeout(r, 1000));
        const poll = await fetch(`${this.baseUrl}/transactions/${body.data.id}`, {
          headers: { Authorization: `Bearer ${this.publicKey}` },
        });
        if (!poll.ok) continue;
        const polled = (await poll.json()) as { data: { id: string; status: string } };
        body = polled;
        if (body.data.status !== 'PENDING') break;
      }
    }

    const status = body.data.status;
    if (status === 'APPROVED' || status === 'DECLINED') {
      return { ok: true, gatewayTransactionId: body.data.id, status };
    }
    throw new GatewayError(`Unexpected gateway status: ${status}`);
  }

  /**
   * The use case passes a simulated token (raw-card-derived). The gateway needs
   * a real token, so when GATEWAY_RAW_CARD_TOKENIZATION=true we tokenize the raw
   * card number first. Otherwise the token is forwarded as-is.
   */
  private async ensureCardToken(cardToken: string, rawCard?: { number: string; cvv: string; expiryMonth: number; expiryYear: number; holderName: string }): Promise<string> {
    if (process.env.GATEWAY_RAW_CARD_TOKENIZATION !== 'true') return cardToken;
    if (!rawCard) return cardToken;
    const res = await fetch(`${this.baseUrl}/tokens/cards`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.publicKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: rawCard.number.replace(/[\s-]/g, ''),
        cvc: rawCard.cvv,
        exp_month: String(rawCard.expiryMonth),
        exp_year: String(rawCard.expiryYear).slice(-2),
        card_holder: rawCard.holderName,
      }),
    });
    if (!res.ok) throw new GatewayError(`Card tokenization failed: ${res.status}`);
    const body = (await res.json()) as { data: { id: string } };
    return body.data.id;
  }
}