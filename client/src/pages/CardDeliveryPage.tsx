// Screen 2 — Credit card + delivery info modal with client-side validation
// (Luhn check, VISA/MasterCard brand logos detection).
//
// UX contract (Vercel Web Interface Guidelines): the submit button is never
// disabled by form validity — a disabled button on an invalid form is a dead
// end with zero feedback. Instead, submitting an invalid form marks the form
// touched, reveals inline per-field errors, moves focus to the first invalid
// field, and announces the count via a polite live region.

import { useEffect, useRef, useState } from 'react';
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

const errorId = (inputId: string): string => `${inputId}-error`;

const FieldError = ({ inputId, message }: { inputId: string; message: string }) => (
  <p id={errorId(inputId)} className="text-xs text-destructive">
    {message}
  </p>
);

// Browser autofill (Chrome, password managers) can set input values without
// firing input/change events, leaving React state stale while the DOM looks
// complete. React's onAnimationStart workaround is unreliable under React 19 +
// jsdom, so instead we self-heal: after the dialog opens, re-read every input's
// DOM value through the same normalizers used by onChange. Runs twice (300ms,
// 1000ms) to cover early and late autofill, and only writes back when the DOM
// actually differs from state so real typing is never clobbered.
const syncFromDom = (
  card: CardState,
  delivery: DeliveryState,
  setCard: (c: CardState) => void,
  setDelivery: (d: DeliveryState) => void,
): boolean => {
  const read = (id: string): string =>
    (document.getElementById(id) as HTMLInputElement | null)?.value ?? '';
  const nextCard: CardState = {
    number: formatCardNumber(read('card-number')),
    cvv: read('cvv').replace(/\D/g, ''),
    expiryMonth: read('exp-month').replace(/\D/g, ''),
    expiryYear: read('exp-year').replace(/\D/g, ''),
    holderName: read('holder').toUpperCase(),
  };
  const nextDelivery: DeliveryState = {
    fullName: read('full-name'),
    email: read('email'),
    phone: read('phone'),
    address: read('address'),
    city: read('city'),
    postalCode: read('postal'),
  };
  // Only sync when the DOM actually differs from React state — that gap is
  // exactly what autofill-without-events creates. Normal typing keeps them in
  // step (controlled inputs), so this can never clobber real user input.
  const cardDiffers = (Object.keys(nextCard) as (keyof CardState)[]).some(
    (k) => nextCard[k] !== card[k],
  );
  const deliveryDiffers = (Object.keys(nextDelivery) as (keyof DeliveryState)[]).some(
    (k) => nextDelivery[k] !== delivery[k],
  );
  if (cardDiffers) setCard(nextCard);
  if (deliveryDiffers) setDelivery(nextDelivery);
  return cardDiffers || deliveryDiffers;
};

export function CardDeliveryDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after card+delivery were saved (step already advanced). Lets the
   * host close the dialog without triggering its "explicit close" behavior. */
  onSaved?: () => void;
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

  const cardRef = useRef(card);
  const deliveryRef = useRef(delivery);
  cardRef.current = card;
  deliveryRef.current = delivery;

  useEffect(() => {
    if (!open) return;
    const run = () =>
      syncFromDom(cardRef.current, deliveryRef.current, (c) => setCard(c), (d) => setDelivery(d));
    const timers = [setTimeout(run, 300), setTimeout(run, 1000)];
    return () => timers.forEach(clearTimeout);
  }, [open]);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const brand = detectBrand(card.number);
  const numberValid = isValidLuhn(card.number);
  const cvvValid = /^\d{3,4}$/.test(card.cvv);
  // Month and year validity are split so each field can show its own error
  // message (they previously shared one `expiryValid`).
  const monthValid =
    /^\d{2}$/.test(card.expiryMonth) &&
    Number(card.expiryMonth) >= 1 &&
    Number(card.expiryMonth) <= 12;
  // Year: format (2–4 digits) + semantic expiry, mirroring the server's
  // card-validator normalization (2-digit YY becomes 20YY). '12' is 2012 —
  // format-valid but expired; the client now catches what the server rejects.
  const yearFormatValid = /^\d{2,4}$/.test(card.expiryYear);
  const normalizedYear = yearFormatValid
    ? Number(card.expiryYear) < 100
      ? 2000 + Number(card.expiryYear)
      : Number(card.expiryYear)
    : null;
  const yearExpired =
    monthValid &&
    normalizedYear !== null &&
    (normalizedYear < currentYear ||
      (normalizedYear === currentYear && Number(card.expiryMonth) < currentMonth));
  const yearValid = yearFormatValid && !yearExpired;
  const holderValid = card.holderName.trim().length > 2;
  const fullNameValid = delivery.fullName.trim().length > 2;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(delivery.email);
  const phoneValid = delivery.phone.trim().length > 5;
  const addressValid = delivery.address.trim().length > 4;
  const cityValid = delivery.city.trim().length > 2;
  const postalValid = delivery.postalCode.trim().length > 2;

  // Declaration order = DOM/focus order on a failed submit.
  const fieldValidity: Array<[string, boolean]> = [
    ['card-number', numberValid],
    ['cvv', cvvValid],
    ['exp-month', monthValid],
    ['exp-year', yearValid],
    ['holder', holderValid],
    ['full-name', fullNameValid],
    ['email', emailValid],
    ['phone', phoneValid],
    ['address', addressValid],
    ['city', cityValid],
    ['postal', postalValid],
  ];
  const formValid = fieldValidity.every(([, valid]) => valid);
  const invalidCount = fieldValidity.filter(([, valid]) => !valid).length;

  const submit = () => {
    setTouched(true);
    if (!formValid) {
      // Always-enabled submit: reveal every per-field error and put the
      // caret on the first invalid field so the user knows exactly what to fix.
      const firstInvalid = fieldValidity.find(([, valid]) => !valid)?.[0];
      if (firstInvalid) document.getElementById(firstInvalid)?.focus();
      return;
    }
    dispatch(saveCardAndDelivery({ card, delivery }));
    onSaved?.();
    onOpenChange(false);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submit();
  };

  // Accidental dismissal (Escape, outside click, focus-out) must NOT close the
  // dialog: typed card data lives in local state and would be lost. Only the
  // explicit Close (X) button or a successful submit dismisses it.
  const blockDismissal = (e: Event) => e.preventDefault();

  // `errorCondition` is the per-field invalidity expression (e.g. !numberValid).
  // Errors stay hidden until the first submit attempt so pristine fields are
  // never flagged (the always-enabled button guarantees the attempt happens).
  const showFieldError = (errorCondition: boolean) => touched && errorCondition;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90dvh] max-w-md overflow-y-auto"
        onEscapeKeyDown={blockDismissal}
        onInteractOutside={blockDismissal}
        onFocusOutside={blockDismissal}
      >
        <DialogHeader>
          <DialogTitle>Payment details</DialogTitle>
          <DialogDescription>Enter your card and delivery information.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          {/* Card section */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Credit card</legend>

            <div className="space-y-1">
              <Label htmlFor="card-number">Card number</Label>
              <div className="relative">
                <Input
                  id="card-number"
                  name="cardNumber"
                  inputMode="numeric"
                  spellCheck={false}
                  autoComplete="cc-number"
                  placeholder="4242 4242 4242 4242"
                  value={card.number}
                  onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })}
                  aria-invalid={showFieldError(!numberValid) || undefined}
                  aria-describedby={showFieldError(!numberValid) ? errorId('card-number') : undefined}
                  className={showFieldError(!numberValid) ? 'border-destructive' : ''}
                />
                {brand !== 'UNKNOWN' && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    <BrandLogo brand={brand} />
                  </span>
                )}
              </div>
              {showFieldError(!numberValid) && (
                <FieldError inputId="card-number" message="Enter a valid 16-digit card number (Luhn check)" />
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="cvv">CVV</Label>
                <Input
                  id="cvv"
                  name="cvv"
                  inputMode="numeric"
                  spellCheck={false}
                  autoComplete="cc-csc"
                  placeholder="123"
                  maxLength={4}
                  value={card.cvv}
                  onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '') })}
                  aria-invalid={showFieldError(!cvvValid) || undefined}
                  aria-describedby={showFieldError(!cvvValid) ? errorId('cvv') : undefined}
                  className={showFieldError(!cvvValid) ? 'border-destructive' : ''}
                />
                {showFieldError(!cvvValid) && (
                  <FieldError inputId="cvv" message="CVV is the 3–4 digit code on the back" />
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="exp-month">Month</Label>
                <Input
                  id="exp-month"
                  name="expiryMonth"
                  inputMode="numeric"
                  spellCheck={false}
                  autoComplete="cc-exp-month"
                  placeholder="MM"
                  maxLength={2}
                  value={card.expiryMonth}
                  onChange={(e) => setCard({ ...card, expiryMonth: e.target.value.replace(/\D/g, '') })}
                  aria-invalid={showFieldError(!monthValid) || undefined}
                  aria-describedby={showFieldError(!monthValid) ? errorId('exp-month') : undefined}
                  className={showFieldError(!monthValid) ? 'border-destructive' : ''}
                />
                {showFieldError(!monthValid) && (
                  <FieldError inputId="exp-month" message="Enter month as MM (01–12)" />
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="exp-year">Year</Label>
                <Input
                  id="exp-year"
                  name="expiryYear"
                  inputMode="numeric"
                  spellCheck={false}
                  autoComplete="cc-exp-year"
                  placeholder="YY"
                  maxLength={2}
                  value={card.expiryYear}
                  onChange={(e) => setCard({ ...card, expiryYear: e.target.value.replace(/\D/g, '') })}
                  aria-invalid={showFieldError(!yearValid) || undefined}
                  aria-describedby={showFieldError(!yearValid) ? errorId('exp-year') : undefined}
                  className={showFieldError(!yearValid) ? 'border-destructive' : ''}
                />
                {showFieldError(yearFormatValid && yearExpired) && (
                  <FieldError inputId="exp-year" message="This card has expired" />
                )}
                {showFieldError(!yearFormatValid) && (
                  <FieldError inputId="exp-year" message="Enter year as YY (e.g. 29)" />
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="holder">Cardholder name</Label>
              <Input
                id="holder"
                name="holderName"
                autoComplete="cc-name"
                placeholder="JOHN DOE"
                value={card.holderName}
                onChange={(e) => setCard({ ...card, holderName: e.target.value.toUpperCase() })}
                aria-invalid={showFieldError(!holderValid) || undefined}
                aria-describedby={showFieldError(!holderValid) ? errorId('holder') : undefined}
                className={showFieldError(!holderValid) ? 'border-destructive' : ''}
              />
              {showFieldError(!holderValid) && (
                <FieldError inputId="holder" message="Enter the name as printed on the card (min. 3 letters)" />
              )}
            </div>
          </fieldset>

          {/* Delivery section */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Delivery information</legend>

            <div className="space-y-1">
              <Label htmlFor="full-name">Full name</Label>
              <Input
                id="full-name"
                name="fullName"
                autoComplete="name"
                placeholder="Jane Appleseed"
                value={delivery.fullName}
                onChange={(e) => setDelivery({ ...delivery, fullName: e.target.value })}
                aria-invalid={showFieldError(!fullNameValid) || undefined}
                aria-describedby={showFieldError(!fullNameValid) ? errorId('full-name') : undefined}
                className={showFieldError(!fullNameValid) ? 'border-destructive' : ''}
              />
              {showFieldError(!fullNameValid) && (
                <FieldError inputId="full-name" message="Enter your full name" />
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                spellCheck={false}
                autoComplete="email"
                placeholder="name@example.com"
                value={delivery.email}
                onChange={(e) => setDelivery({ ...delivery, email: e.target.value })}
                aria-invalid={showFieldError(!emailValid) || undefined}
                aria-describedby={showFieldError(!emailValid) ? errorId('email') : undefined}
                className={showFieldError(!emailValid) ? 'border-destructive' : ''}
              />
              {showFieldError(!emailValid) && (
                <FieldError inputId="email" message="Enter a valid email, e.g. name@example.com" />
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                inputMode="tel"
                spellCheck={false}
                autoComplete="tel"
                placeholder="+57 300 123 4567"
                value={delivery.phone}
                onChange={(e) => setDelivery({ ...delivery, phone: e.target.value })}
                aria-invalid={showFieldError(!phoneValid) || undefined}
                aria-describedby={showFieldError(!phoneValid) ? errorId('phone') : undefined}
                className={showFieldError(!phoneValid) ? 'border-destructive' : ''}
              />
              {showFieldError(!phoneValid) && (
                <FieldError inputId="phone" message="Enter a phone number with country code, e.g. +57 300 123 4567" />
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                name="address"
                autoComplete="street-address"
                placeholder="Street 123 #45-67"
                value={delivery.address}
                onChange={(e) => setDelivery({ ...delivery, address: e.target.value })}
                aria-invalid={showFieldError(!addressValid) || undefined}
                aria-describedby={showFieldError(!addressValid) ? errorId('address') : undefined}
                className={showFieldError(!addressValid) ? 'border-destructive' : ''}
              />
              {showFieldError(!addressValid) && (
                <FieldError inputId="address" message="Enter the full street address" />
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="city"
                  autoComplete="address-level2"
                  placeholder="Bogotá"
                  value={delivery.city}
                  onChange={(e) => setDelivery({ ...delivery, city: e.target.value })}
                  aria-invalid={showFieldError(!cityValid) || undefined}
                  aria-describedby={showFieldError(!cityValid) ? errorId('city') : undefined}
                  className={showFieldError(!cityValid) ? 'border-destructive' : ''}
                />
                {showFieldError(!cityValid) && <FieldError inputId="city" message="Enter the city" />}
              </div>
              <div className="space-y-1">
                <Label htmlFor="postal">Postal code</Label>
                <Input
                  id="postal"
                  name="postalCode"
                  spellCheck={false}
                  autoComplete="postal-code"
                  placeholder="110111"
                  value={delivery.postalCode}
                  onChange={(e) => setDelivery({ ...delivery, postalCode: e.target.value })}
                  aria-invalid={showFieldError(!postalValid) || undefined}
                  aria-describedby={showFieldError(!postalValid) ? errorId('postal') : undefined}
                  className={showFieldError(!postalValid) ? 'border-destructive' : ''}
                />
                {showFieldError(!postalValid) && (
                  <FieldError inputId="postal" message="Enter the postal code" />
                )}
              </div>
            </div>
          </fieldset>

          {/* Never disabled by validity: an invalid submit reveals inline
              errors and focuses the first invalid field instead of a dead end. */}
          <Button className="w-full" size="lg" type="submit">
            Continue to summary
          </Button>
          {/* Polite live region: persists (possibly empty) so screen readers
              announce the count the moment a failed submit populates it. */}
          <div aria-live="polite">
            {touched && invalidCount > 0 && (
              <p className="text-center text-xs text-destructive">
                {invalidCount} {invalidCount === 1 ? 'field needs' : 'fields need'} attention
              </p>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}