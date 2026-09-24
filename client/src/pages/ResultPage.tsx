// Screen 4 — Final transaction status with the animated receipt printer.

import { useEffect, useState } from 'react';
import {
  ReceiptPrinter,
  type ReceiptPrinterStage,
} from '@/components/receipt/ReceiptPrinter';
import { Button } from '@/components/ui/button';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { backToProduct } from '@/store/checkoutSlice';
import { BASE_FEE_IN_CENTS, DELIVERY_FEE_IN_CENTS } from '@/api/client';

const formatMoney = (cents: number): string =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const today = (): string => {
  const d = new Date();
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export function ResultPage() {
  const dispatch = useAppDispatch();
  const { transactionId, transactionStatus, totalInCents, card, delivery, units } = useAppSelector(
    (s) => s.checkout,
  );

  const [stage, setStage] = useState<ReceiptPrinterStage>('processing');

  useEffect(() => {
    if (stage !== 'processing') return;
    const t1 = setTimeout(() => setStage('printing'), 1200);
    return () => clearTimeout(t1);
  }, [stage]);

  useEffect(() => {
    if (stage === 'printing') {
      const t2 = setTimeout(() => setStage('complete'), 2000);
      return () => clearTimeout(t2);
    }
  }, [stage]);

  const approved = transactionStatus === 'APPROVED';
  const productAmount = (totalInCents ?? 0) - BASE_FEE_IN_CENTS - DELIVERY_FEE_IN_CENTS;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-5 p-4">
      <ReceiptPrinter.Root stage={stage} feedMotion="stepped">
        <ReceiptPrinter.Machine>
          <ReceiptPrinter.Header>
            <ReceiptPrinter.Status />
          </ReceiptPrinter.Header>
          <ReceiptPrinter.Screen>
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-zinc-400">Payment</span>
              <span>{approved ? 'APPROVED' : 'DECLINED'}</span>
            </div>
            <div className="mt-2 font-mono text-sm font-semibold">
              {formatMoney(totalInCents ?? 0)}
            </div>
          </ReceiptPrinter.Screen>
        </ReceiptPrinter.Machine>

        <ReceiptPrinter.Output>
          <ReceiptPrinter.Paper>
            <div className="space-y-4 font-mono text-xs">
              <div className="text-center">
                <p className="text-sm font-bold tracking-widest">CHECKOUT STORE</p>
                <p className="text-[10px] text-zinc-500">Thanks for your purchase</p>
              </div>
              <div className="border-t border-dashed border-zinc-300" />
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Order</span>
                  <span className="font-semibold">ORD-{(transactionId ?? '').slice(-8)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date</span>
                  <span>{today()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Paid with</span>
                  <span>
                    {card?.number.startsWith('4') ? 'Visa' : 'MC'} ••••{' '}
                    {(card?.number ?? '').replace(/\D/g, '').slice(-4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Units</span>
                  <span>{units}</span>
                </div>
              </div>
              <div className="border-t border-dashed border-zinc-300" />
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Product</span>
                  <span>{formatMoney(productAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Base fee</span>
                  <span>{formatMoney(BASE_FEE_IN_CENTS)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery</span>
                  <span>{formatMoney(DELIVERY_FEE_IN_CENTS)}</span>
                </div>
              </div>
              <div className="border-t border-dashed border-zinc-300" />
              <div className="flex justify-between text-sm font-bold">
                <span>TOTAL PAID</span>
                <span>{formatMoney(totalInCents ?? 0)}</span>
              </div>
              <div className="border-t border-dashed border-zinc-300" />
              <div className="space-y-0.5 text-[10px] text-zinc-500">
                <p>Ship to: {delivery?.fullName}</p>
                <p>{delivery?.address}, {delivery?.city} {delivery?.postalCode}</p>
              </div>
              {!approved && (
                <p className="pt-2 text-center font-bold text-red-600">PAYMENT DECLINED</p>
              )}
            </div>
          </ReceiptPrinter.Paper>
        </ReceiptPrinter.Output>
      </ReceiptPrinter.Root>

      <Button
        size="lg"
        variant={approved ? 'default' : 'secondary'}
        onClick={() => dispatch(backToProduct())}
      >
        {approved ? 'Continue shopping' : 'Back to product'}
      </Button>
    </div>
  );
}