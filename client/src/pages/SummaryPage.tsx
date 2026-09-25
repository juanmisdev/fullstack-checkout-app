// Screen 3 — Payment summary in a backdrop component (Material Backdrop-like):
// product amount + base fee + delivery fee = total, with pay button.

import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { submitPayment, backToSummary } from '@/store/checkoutSlice';
import { BASE_FEE_IN_CENTS, DELIVERY_FEE_IN_CENTS } from '@/api/client';
import { CardDeliveryDialog } from './CardDeliveryPage';
import { useState } from 'react';

const formatMoney = (cents: number): string =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

// One idempotency key per payment attempt: retries of the same attempt hit the
// backend dedup instead of creating a second charge.
const newIdempotencyKey = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function SummaryPage() {
  const dispatch = useAppDispatch();
  const { checkout } = useAppSelector((s) => ({ checkout: s.checkout }));
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const processing = checkout.step === 'processing';

  // Total shown = product amount estimate + base fee + delivery fee.
  // The authoritative total comes from the backend transaction response.
  if (!checkout.card || !checkout.delivery) {
    return <p className="p-4 text-center text-sm text-muted-foreground">Missing payment data</p>;
  }

  const cardMeta = {
    last4: checkout.card.number.replace(/\D/g, '').slice(-4),
    brand: checkout.card.number.startsWith('4') ? 'VISA' : 'MC',
  };

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4 p-4">
      <h2 className="text-lg font-semibold">Order summary</h2>

      <div className="divide-y rounded-xl border">
        <div className="flex items-center justify-between p-4 text-sm">
          <span>
            Product × {checkout.units}
          </span>
          <span>{formatMoney(checkout.totalInCents ?? 0)}</span>
        </div>
        <div className="flex items-center justify-between p-4 text-sm text-muted-foreground">
          <span>Base fee</span>
          <span>{formatMoney(BASE_FEE_IN_CENTS)}</span>
        </div>
        <div className="flex items-center justify-between p-4 text-sm text-muted-foreground">
          <span>Delivery fee</span>
          <span>{formatMoney(DELIVERY_FEE_IN_CENTS)}</span>
        </div>
        <div className="flex items-center justify-between p-4 font-semibold">
          <span>Total</span>
          <span>{formatMoney((checkout.totalInCents ?? 0) + BASE_FEE_IN_CENTS + DELIVERY_FEE_IN_CENTS)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
        <span className="text-muted-foreground">{cardMeta.brand} •••• {cardMeta.last4}</span>
        <Button variant="link" size="sm" onClick={() => setCardDialogOpen(true)} disabled={processing}>
          Edit
        </Button>
      </div>

      <Button
        size="lg"
        onClick={() => dispatch(submitPayment({ idempotencyKey: newIdempotencyKey() }))}
        disabled={processing}
        aria-busy={processing}
      >
        {processing ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" />
            Processing payment…
          </>
        ) : (
          'Pay now'
        )}
      </Button>
      <Button variant="ghost" onClick={() => dispatch(backToSummary())} disabled={processing}>
        Back
      </Button>

      <CardDeliveryDialog open={cardDialogOpen} onOpenChange={setCardDialogOpen} />
    </div>
  );
}