// App root — orchestrates the 5-step checkout flow from Redux state.

import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { backToSummary } from '@/store/checkoutSlice';
import { checkout as checkoutApi } from '@/api/client';
import { ProductPage } from '@/pages/ProductPage';
import { SummaryPage } from '@/pages/SummaryPage';
import { ResultPage } from '@/pages/ResultPage';
import { paymentSucceeded, paymentFailed } from '@/store/checkoutSlice';
import { buildCheckoutRequest, CardDeliveryDialog } from '@/pages/CardDeliveryDialogBarrel';

function CheckoutFlow() {
  const dispatch = useAppDispatch();
  const step = useAppSelector((s) => s.checkout.step);
  const checkoutState = useAppSelector((s) => s.checkout);

  // Effect: when entering 'processing', call the backend checkout endpoint once.
  useEffect(() => {
    if (step !== 'processing') return;
    if (!checkoutState.card || !checkoutState.delivery || !checkoutState.productId) return;

    let cancelled = false;
    const run = async () => {
      try {
        const request = buildCheckoutRequest(
          checkoutState.productId!,
          checkoutState.units,
          checkoutState.card!,
          checkoutState.delivery!,
        );
        const result = await checkoutApi(request);
        if (cancelled) return;
        if (result.status === 'APPROVED') {
          dispatch(paymentSucceeded({ transactionId: result.transactionId, totalInCents: result.totalInCents }));
        } else {
          dispatch(paymentFailed('Payment was declined'));
        }
      } catch (e) {
        if (cancelled) return;
        dispatch(paymentFailed(e instanceof Error ? e.message : 'Unexpected error'));
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [step, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  switch (step) {
    case 'product':
      return <ProductPage />;
    case 'card-delivery':
      return (
        <div className="p-4">
          <CardDeliveryDialog open onOpenChange={() => dispatch(backToSummary())} />
        </div>
      );
    case 'summary':
    case 'processing':
      return <SummaryPage />;
    case 'result':
      return <ResultPage />;
    default:
      return <ProductPage />;
  }
}

export default function App() {
  return (
    <main className="min-h-dvh bg-zinc-50 py-6">
      <CheckoutFlow />
    </main>
  );
}