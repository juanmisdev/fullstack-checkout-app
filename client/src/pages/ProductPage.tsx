// Screen 1 — Product page with stock display.

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fetchProduct, type ProductDto } from '@/api/client';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { startCheckout } from '@/store/checkoutSlice';

export function ProductPage() {
  const dispatch = useAppDispatch();
  const productId = useAppSelector((s) => s.checkout.productId);
  const [product, setProduct] = useState<ProductDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localUnits, setLocalUnits] = useState(1);

  useEffect(() => {
    const id = productId ?? 'prod_001';
    fetchProduct(id)
      .then(setProduct)
      .catch((e: Error) => setError(e.message));
  }, [productId]);

  if (error) {
    return <p className="p-4 text-center text-sm text-destructive">{error}</p>;
  }
  if (!product) {
    return <p className="p-4 text-center text-sm text-muted-foreground">Loading product…</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-5 p-4">
      <img
        src={product.imageUrl}
        alt={product.name}
        className="aspect-square w-full rounded-xl object-cover"
        loading="eager"
      />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">{product.name}</h1>
          <Badge variant={product.stock > 0 ? 'secondary' : 'destructive'}>
            {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{product.description}</p>
        <p className="text-2xl font-bold">
          {(product.priceInCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <span className="text-sm font-medium">Units</span>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            aria-label="Decrease units"
            onClick={() => {
              const next = Math.max(1, localUnits - 1);
              setLocalUnits(next);

            }}
          >
            −
          </Button>
          <span className="w-8 text-center text-sm font-semibold">{localUnits}</span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Increase units"
            disabled={localUnits >= product.stock}
            onClick={() => {
              const next = Math.min(product.stock, localUnits + 1);
              setLocalUnits(next);

            }}
          >
            +
          </Button>
        </div>
      </div>

      <Button
        size="lg"
        disabled={product.stock === 0}
        onClick={() => dispatch(startCheckout({ productId: product.id, units: localUnits }))}
      >
        Pay with credit card
      </Button>
    </div>
  );
}