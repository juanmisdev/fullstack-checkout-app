// Screen 1 — Product listing: all store products, each card starts the checkout flow.

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fetchProducts, type ProductDto } from '@/api/client';
import { useAppDispatch } from '@/store/hooks';
import { startCheckout } from '@/store/checkoutSlice';

function ProductCard({ product }: { product: ProductDto }) {
  const dispatch = useAppDispatch();
  const [units, setUnits] = useState(1);

  return (
    <div className="flex h-full w-full flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <img
        src={product.imageUrl}
        alt={product.name}
        className="aspect-square w-full rounded-lg object-cover"
        loading="lazy"
      />
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{product.name}</h2>
          <Badge variant={product.stock > 0 ? 'secondary' : 'destructive'}>
            {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{product.description}</p>
        <p className="text-xl font-bold">
          {(product.priceInCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
        </p>
      </div>

      <div className="mt-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label={`Decrease units for ${product.name}`}
            disabled={units <= 1 || product.stock === 0}
            onClick={() => setUnits((u) => Math.max(1, u - 1))}
          >
            −
          </Button>
          <span className="w-8 text-center text-sm font-semibold">{units}</span>
          <Button
            variant="outline"
            size="icon"
            aria-label={`Increase units for ${product.name}`}
            disabled={units >= product.stock}
            onClick={() => setUnits((u) => Math.min(product.stock, u + 1))}
          >
            +
          </Button>
        </div>
        <Button
          disabled={product.stock === 0}
          onClick={() => dispatch(startCheckout({ productId: product.id, units }))}
        >
          Pay with credit card
        </Button>
      </div>
    </div>
  );
}

export function ProductPage() {
  const [products, setProducts] = useState<ProductDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return <p className="p-4 text-center text-sm text-destructive">{error}</p>;
  }
  if (!products) {
    return <p className="p-4 text-center text-sm text-muted-foreground">Loading products…</p>;
  }

  return (
    <div className="mx-auto w-full max-w-6xl p-4 md:p-8">
      <h1 className="mb-6 text-2xl font-semibold md:text-3xl">Our products</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}