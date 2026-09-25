// Unit tests — Payment gateway adapter (HTTP client, mocked fetch).

import { PaymentGatewayAdapter } from './payment-gateway.adapter';
import { GatewayError } from '../../application/ports/ports';

const mockFetch = (status: number, body: unknown) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response);
};

const adapter = () => new PaymentGatewayAdapter();

const chargeInput = {
  amountInCents: 260500,
  customerEmail: 'john@example.com',
  cardToken: 'tok_test_4242',
  reference: 'tx_1',
};

describe('PaymentGatewayAdapter', () => {
  beforeEach(() => {
    process.env.GATEWAY_API_URL = 'https://payment-gateway-sandbox.example.com/v1';
    process.env.GATEWAY_PUBLIC_KEY = 'pub_test';
  });

  it('fetches the acceptance token', async () => {
    mockFetch(200, {
      data: { presigned_acceptance: { acceptance_token: 'acc_tok_1' } },
    });
    expect(await adapter().getAcceptanceToken()).toBe('acc_tok_1');
  });

  it('throws GatewayError when acceptance token fetch fails', async () => {
    mockFetch(500, {});
    await expect(adapter().getAcceptanceToken()).rejects.toThrow(GatewayError);
  });

  it('returns APPROVED charge result', async () => {
    mockFetch(200, {
      data: { presigned_acceptance: { acceptance_token: 'acc_tok_1' } },
    });
    // First fetch = merchants (token), second = transactions
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { presigned_acceptance: { acceptance_token: 'acc_tok_1' } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: { id: 'gw_1', status: 'APPROVED' } }),
      });

    const result = await adapter().charge(chargeInput);
    expect(result).toEqual({ ok: true, gatewayTransactionId: 'gw_1', status: 'APPROVED' });
  });

  it('returns DECLINED charge result', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { presigned_acceptance: { acceptance_token: 'acc_tok_1' } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: { id: 'gw_2', status: 'DECLINED' } }),
      });

    const result = await adapter().charge(chargeInput);
    expect(result.status).toBe('DECLINED');
  });

  it('throws GatewayError on HTTP failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({}),
    });
    await expect(adapter().charge(chargeInput)).rejects.toThrow(GatewayError);
  });

  it('polls PENDING transactions and throws on non-terminal state', async () => {
    const pendingBody = { data: { id: 'gw_3', status: 'PENDING' } };
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { presigned_acceptance: { acceptance_token: 'tok' } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => pendingBody,
      })
      // All poll attempts keep returning PENDING.
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => pendingBody,
      });
    await expect(adapter().charge(chargeInput)).rejects.toThrow('Unexpected gateway status: PENDING');
  }, 15000);
});