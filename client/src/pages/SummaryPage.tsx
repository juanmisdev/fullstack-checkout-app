// Screen 3 — Payment summary in a backdrop component (Material Backdrop-like):
// product amount + base fee + delivery fee = total, with pay button.

import { Button } from '@/components/ui/button';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { submitPayment, backToSummary } from '@/store/checkoutSlice';
import { BASE_FEE_IN_CENTS, DELIVERY_FEE_IN_CENTS } from '@/api/client';
import { CardDeliveryDialog } from './CardDeliveryPage';
import { useState } from 'react';

const formatMoney = (cents: number): string =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export function SummaryPage() {
  const dispatch = useAppDispatch();
  const { checkout } = useAppSelector((s) => ({ checkout: s.checkout }));
  const [cardDialogOpen, setCardDialogOpen] = useState(false);

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
        <Button variant="link" size="sm" onClick={() => setCardDialogOpen(true)}>
          Edit
        </Button>
      </div>

      <Button size="lg" onClick={() => dispatch(submitPayment())}>
        Pay now
      </Button>
      <Button variant="ghost" onClick={() => dispatch(backToSummary())}>
        Back
      </Button>

      <CardDeliveryDialog open={cardDialogOpen} onOpenChange={setCardDialogOpen} />
    </div>
  );
}