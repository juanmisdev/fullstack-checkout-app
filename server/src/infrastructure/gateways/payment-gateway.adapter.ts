// Infrastructure adapter — HTTP client for the payment gateway sandbox API.
// Reads credentials ONLY from environment variables (never hardcoded).

import { Injectable } from '@nestjs/common';
import { PaymentGatewayPort, PaymentGatewayChargeInput, PaymentGatewayChargeResult, GatewayError } from '../../application/ports/ports';

export interface GatewayAcceptanceToken {
  acceptance_token: string;
  presigned_acceptance: {
    acceptance_token: string;
  };
}

@Injectable()
export class PaymentGatewayAdapter implements PaymentGatewayPort {
  private readonly baseUrl = process.env.GATEWAY_API_URL ?? 'https://api-sandbox.co.uat.wompi.dev/v1';
  private readonly publicKey = process.env.GATEWAY_PUBLIC_KEY ?? '';

  async getAcceptanceToken(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/merchants`, {
      headers: { Authorization: `Bearer ${this.publicKey}` },
    });
    if (!res.ok) throw new GatewayError(`Failed to fetch acceptance token: ${res.status}`);
    const body = (await res.json()) as {
      data: { presigned_acceptance: { acceptance_token: string } };
    };
    return body.data.presigned_acceptance.acceptance_token;
  }

  async charge(input: PaymentGatewayChargeInput): Promise<PaymentGatewayChargeResult> {
    const acceptanceToken = await this.getAcceptanceToken();

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
          token: input.cardToken,
          installments: 1,
        },
        acceptance_token: acceptanceToken,
      }),
    });

    if (!res.ok) {
      throw new GatewayError(`Gateway returned ${res.status}`);
    }

    const body = (await res.json()) as {
      data: { id: string; status: string };
    };

    const status = body.data.status;
    if (status === 'APPROVED' || status === 'DECLINED') {
      return { ok: true, gatewayTransactionId: body.data.id, status };
    }
    throw new GatewayError(`Unexpected gateway status: ${status}`);
  }
}