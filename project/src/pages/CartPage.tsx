import { Link } from 'react-router-dom';
import { ShoppingBag, Trash2 } from 'lucide-react';
import { Button, Card, EmptyState, PriceTag } from '../components/ui';
import { QuantitySelector } from '../components/product';
import { useCartStore } from '../stores';
import { formatPrice } from '../lib/utils';
import { cn } from '../lib/utils';

import { SafeProductImage } from '../components/product';

export default function CartPage() {
  const {
    items,
    removeItem,
    updateQuantity,
    clearCart,
    getSubtotal,
    getTax,
    getShipping,
    getTotal,
  } = useCartStore();

  const subtotal = getSubtotal();
  const tax = getTax();
  const shipping = getShipping();
  const total = getTotal();

  if (items.length === 0) {
    return (
      <div className="container-app py-16">
        <EmptyState
          icon={<ShoppingBag className="w-16 h-16" />}
          title="Your cart is empty"
          description="Add items to start shopping"
          action={
            <Link to="/">
              <Button>Continue Shopping</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="container-app py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-display font-bold">Shopping Cart</h1>
        <Button variant="ghost" onClick={clearCart}>
          Clear Cart
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => {
            const price = item.product.sale_price || item.product.base_price;
            const itemTotal = price * item.quantity;
            const primaryImage = item.images?.[0]?.url || item.product.images?.[0]?.url || '/placeholder.svg';

            return (
              <Card key={item.variantId} className="p-4">
                <div className="flex gap-4">
                  <SafeProductImage
                    src={primaryImage}
                    alt={item.product.name}
                    className="w-24 h-32 object-cover rounded-lg"
                    fallbackSize="md"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <div>
                        <Link
                          to={`/product/${item.product.slug}`}
                          className="font-medium hover:text-primary-600"
                        >
                          {item.product.name}
                        </Link>
                        <p className="text-sm text-neutral-500 mt-1">
                          Size: {item.variant.size} | Color: {item.variant.color}
                        </p>
                        <p className="text-sm text-neutral-400 mt-1">
                          SKU: {item.variant.sku}
                        </p>
                      </div>
                      <button
                        onClick={() => removeItem(item.variantId)}
                        className="text-neutral-400 hover:text-error-500"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <QuantitySelector
                        value={item.quantity}
                        onChange={(qty) => updateQuantity(item.variantId, qty)}
                        max={item.variant.inventory_quantity ?? 10}
                      />
                      <PriceTag price={itemTotal} size="lg" />
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="lg:col-span-1">
          <Card className="p-6 sticky top-24">
            <h2 className="text-lg font-medium mb-4">Order Summary</h2>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-neutral-600">Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Tax (18%)</span>
                <span>{formatPrice(tax)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Shipping</span>
                <span className={cn(shipping === 0 && 'text-success-600')}>
                  {shipping === 0 ? 'Free' : formatPrice(shipping)}
                </span>
              </div>

              {subtotal < 999 && (
                <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-3">
                  <p className="text-sm text-primary-700">
                    Add {formatPrice(999 - subtotal)} more for free shipping!
                  </p>
                </div>
              )}

              <div className="border-t pt-3 flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>

            <Link to="/checkout" className="block mt-6">
              <Button variant="primary" size="lg" className="w-full">
                Proceed to Checkout
              </Button>
            </Link>

            <p className="text-xs text-neutral-500 text-center mt-4">
              Taxes calculated at checkout
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
