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

  it('polls a PENDING transaction until it reaches APPROVED', async () => {
    mockFetch(200, { data: { presigned_acceptance: { acceptance_token: 'tok' } } });
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { presigned_acceptance: { acceptance_token: 'tok' } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: { id: 'gw_4', status: 'PENDING' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 'gw_4', status: 'PENDING' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 'gw_4', status: 'APPROVED' } }),
      });
    const result = await adapter().charge(chargeInput);
    expect(result).toEqual({ ok: true, gatewayTransactionId: 'gw_4', status: 'APPROVED' });
  }, 15000);

  it('keeps polling when a poll request fails (non-ok response)', async () => {
    mockFetch(200, { data: { presigned_acceptance: { acceptance_token: 'tok' } } });
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { presigned_acceptance: { acceptance_token: 'tok' } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: { id: 'gw_5', status: 'PENDING' } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 'gw_5', status: 'DECLINED' } }),
      });
    const result = await adapter().charge(chargeInput);
    expect(result).toEqual({ ok: true, gatewayTransactionId: 'gw_5', status: 'DECLINED' });
  }, 15000);

  it('throws GatewayError when GATEWAY_API_URL is not configured', async () => {
    delete process.env.GATEWAY_API_URL;
    await expect(adapter().getAcceptanceToken()).rejects.toThrow('GATEWAY_API_URL is not configured');
    await expect(adapter().charge(chargeInput)).rejects.toThrow('GATEWAY_API_URL is not configured');
    process.env.GATEWAY_API_URL = 'https://payment-gateway-sandbox.example.com/v1';
  });

  it('adds an integrity signature when GATEWAY_INTEGRITY_KEY is set', async () => {
    mockFetch(200, { data: { presigned_acceptance: { acceptance_token: 'tok' } } });
    process.env.GATEWAY_INTEGRITY_KEY = 'integ_test';
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { presigned_acceptance: { acceptance_token: 'tok' } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: { id: 'gw_6', status: 'APPROVED' } }),
      });
    const result = await adapter().charge(chargeInput);
    expect(result.status).toBe('APPROVED');
    const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
    expect(typeof callBody.signature).toBe('string');
    expect(callBody.signature).toHaveLength(64);
    delete process.env.GATEWAY_INTEGRITY_KEY;
  });

  it('tokenizes the raw card when GATEWAY_RAW_CARD_TOKENIZATION=true', async () => {
    mockFetch(200, { data: { presigned_acceptance: { acceptance_token: 'tok' } } });
    process.env.GATEWAY_RAW_CARD_TOKENIZATION = 'true';
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { presigned_acceptance: { acceptance_token: 'tok' } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: { id: 'card_tok_1' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: { id: 'gw_7', status: 'APPROVED' } }),
      });
    const result = await adapter().charge({ ...chargeInput, rawCard: { number: '4242 4242 4242 4242', cvv: '123', expiryMonth: 12, expiryYear: 2029, holderName: 'JOHN DOE' } });
    expect(result).toEqual({ ok: true, gatewayTransactionId: 'gw_7', status: 'APPROVED' });
    const tokenizeBody = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
    expect(tokenizeBody.number).toBe('4242424242424242');
    expect(tokenizeBody.exp_year).toBe('29');
    delete process.env.GATEWAY_RAW_CARD_TOKENIZATION;
  });

  it('throws GatewayError when raw card tokenization fails', async () => {
    process.env.GATEWAY_RAW_CARD_TOKENIZATION = 'true';
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { presigned_acceptance: { acceptance_token: 'tok' } } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({}),
      });
    await expect(
      adapter().charge({ ...chargeInput, rawCard: { number: '4242 4242 4242 4242', cvv: '123', expiryMonth: 12, expiryYear: 2029, holderName: 'JOHN DOE' } }),
    ).rejects.toThrow('Card tokenization failed: 422');
    delete process.env.GATEWAY_RAW_CARD_TOKENIZATION;
  });

  it('forwards the card token as-is when tokenization is enabled but no raw card is given', async () => {
    mockFetch(200, { data: { presigned_acceptance: { acceptance_token: 'tok' } } });
    process.env.GATEWAY_RAW_CARD_TOKENIZATION = 'true';
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { presigned_acceptance: { acceptance_token: 'tok' } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: { id: 'gw_8', status: 'APPROVED' } }),
      });
    const result = await adapter().charge(chargeInput);
    expect(result.status).toBe('APPROVED');
    // Only 2 fetches: merchants + transactions (no /tokens/cards call).
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(2);
    delete process.env.GATEWAY_RAW_CARD_TOKENIZATION;
  });
});