// Screen 2 — Credit card + delivery info modal with client-side validation
// (Luhn check, VISA/MasterCard brand logos detection).

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { saveCardAndDelivery, type CardState, type DeliveryState } from '@/store/checkoutSlice';
import { isValidLuhn, detectBrand } from '@/api/client';

function BrandLogo({ brand }: { brand: 'VISA' | 'MASTERCARD' | 'UNKNOWN' }) {
  if (brand === 'VISA') {
    return <span className="text-xs font-black italic tracking-wider text-[#1A1F71]">VISA</span>;
  }
  if (brand === 'MASTERCARD') {
    return (
      <span className="flex items-center" aria-label="MasterCard">
        <span className="h-4 w-4 rounded-full bg-[#EB001B]" />
        <span className="-ml-1.5 h-4 w-4 rounded-full bg-[#F79E1B] opacity-90" />
      </span>
    );
  }
  return null;
}

const formatCardNumber = (raw: string): string =>
  raw
    .replace(/\D/g, '')
    .slice(0, 16)
    .replace(/(.{4})/g, '$1 ')
    .trim();

export function CardDeliveryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const dispatch = useAppDispatch();
  const deliverySaved = useAppSelector((s) => s.checkout.delivery);

  const [card, setCard] = useState<CardState>({
    number: '',
    cvv: '',
    expiryMonth: '',
    expiryYear: '',
    holderName: '',
  });
  const [delivery, setDelivery] = useState<DeliveryState>({
    fullName: deliverySaved?.fullName ?? '',
    email: deliverySaved?.email ?? '',
    phone: deliverySaved?.phone ?? '',
    address: deliverySaved?.address ?? '',
    city: deliverySaved?.city ?? '',
    postalCode: deliverySaved?.postalCode ?? '',
  });
  const [touched, setTouched] = useState(false);

  const brand = detectBrand(card.number);
  const numberValid = isValidLuhn(card.number);
  const cvvValid = /^\d{3,4}$/.test(card.cvv);
  const expiryValid =
    /^\d{2}$/.test(card.expiryMonth) &&
    Number(card.expiryMonth) >= 1 &&
    Number(card.expiryMonth) <= 12 &&
    /^\d{2,4}$/.test(card.expiryYear);
  const holderValid = card.holderName.trim().length > 2;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(delivery.email);
  const deliveryValid =
    delivery.fullName.trim().length > 2 &&
    emailValid &&
    delivery.phone.trim().length > 5 &&
    delivery.address.trim().length > 4 &&
    delivery.city.trim().length > 2 &&
    delivery.postalCode.trim().length > 2;

  const formValid = numberValid && cvvValid && expiryValid && holderValid && deliveryValid;

  const submit = () => {
    setTouched(true);
    if (!formValid) return;
    dispatch(saveCardAndDelivery({ card, delivery }));
    onOpenChange(false);
  };

  // `errorCondition` is the per-field invalidity expression (e.g. !numberValid).
  const showFieldError = (errorCondition: boolean) => touched && errorCondition;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payment details</DialogTitle>
          <DialogDescription>Enter your card and delivery information.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Card section */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Credit card</legend>

            <div className="space-y-1">
              <Label htmlFor="card-number">Card number</Label>
              <div className="relative">
                <Input
                  id="card-number"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="4242 4242 4242 4242"
                  value={card.number}
                  onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })}
                  className={showFieldError(!numberValid) ? 'border-destructive' : ''}
                />
                {brand !== 'UNKNOWN' && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    <BrandLogo brand={brand} />
                  </span>
                )}
              </div>
              {showFieldError(!numberValid) && <p className="text-xs text-destructive">Invalid card number</p>}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="cvv">CVV</Label>
                <Input
                  id="cvv"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  placeholder="123"
                  maxLength={4}
                  value={card.cvv}
                  onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '') })}
                  className={showFieldError(!cvvValid) ? 'border-destructive' : ''}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="exp-month">Month</Label>
                <Input
                  id="exp-month"
                  inputMode="numeric"
                  autoComplete="cc-exp-month"
                  placeholder="MM"
                  maxLength={2}
                  value={card.expiryMonth}
                  onChange={(e) => setCard({ ...card, expiryMonth: e.target.value.replace(/\D/g, '') })}
                  className={showFieldError(!expiryValid) ? 'border-destructive' : ''}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="exp-year">Year</Label>
                <Input
                  id="exp-year"
                  inputMode="numeric"
                  autoComplete="cc-exp-year"
                  placeholder="YY"
                  maxLength={2}
                  value={card.expiryYear}
                  onChange={(e) => setCard({ ...card, expiryYear: e.target.value.replace(/\D/g, '') })}
                  className={showFieldError(!expiryValid) ? 'border-destructive' : ''}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="holder">Cardholder name</Label>
              <Input
                id="holder"
                autoComplete="cc-name"
                placeholder="JOHN DOE"
                value={card.holderName}
                onChange={(e) => setCard({ ...card, holderName: e.target.value.toUpperCase() })}
                className={showFieldError(!holderValid) ? 'border-destructive' : ''}
              />
            </div>
          </fieldset>

          {/* Delivery section */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Delivery information</legend>

            <div className="space-y-1">
              <Label htmlFor="full-name">Full name</Label>
              <Input
                id="full-name"
                autoComplete="name"
                value={delivery.fullName}
                onChange={(e) => setDelivery({ ...delivery, fullName: e.target.value })}
                className={showFieldError(delivery.fullName.trim().length <= 2) ? 'border-destructive' : ''}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={delivery.email}
                onChange={(e) => setDelivery({ ...delivery, email: e.target.value })}
                className={showFieldError(!emailValid) ? 'border-destructive' : ''}
              />
              {showFieldError(!emailValid) && <p className="text-xs text-destructive">Invalid email</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                inputMode="tel"
                autoComplete="tel"
                value={delivery.phone}
                onChange={(e) => setDelivery({ ...delivery, phone: e.target.value })}
                className={showFieldError(delivery.phone.trim().length <= 5) ? 'border-destructive' : ''}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                autoComplete="street-address"
                value={delivery.address}
                onChange={(e) => setDelivery({ ...delivery, address: e.target.value })}
                className={showFieldError(delivery.address.trim().length <= 4) ? 'border-destructive' : ''}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={delivery.city}
                  onChange={(e) => setDelivery({ ...delivery, city: e.target.value })}
                  className={showFieldError(delivery.city.trim().length <= 2) ? 'border-destructive' : ''}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="postal">Postal code</Label>
                <Input
                  id="postal"
                  value={delivery.postalCode}
                  onChange={(e) => setDelivery({ ...delivery, postalCode: e.target.value })}
                  className={showFieldError(delivery.postalCode.trim().length <= 0) ? 'border-destructive' : ''}
                />
              </div>
            </div>
          </fieldset>

          <Button className="w-full" size="lg" onClick={submit} disabled={!formValid && touched}>
            Continue to summary
          </Button>
          {touched && !formValid && (
            <p className="text-center text-xs text-destructive">Please complete all fields correctly</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}