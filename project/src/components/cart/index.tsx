import { Link } from 'react-router-dom';
import { ShoppingBag, Trash2, Minus, Plus, Truck, Shield, RefreshCw, CreditCard } from 'lucide-react';
import { Drawer } from '../overlays';
import { Button } from '../ui';
import { useCartStore, useUIStore, useToastStore } from '../../stores';
import { formatPrice, cn, FREE_SHIPPING_THRESHOLD } from '../../lib/utils';

import { SafeProductImage } from '../product';

export function CartDrawer() {
  const { isCartOpen, setCartOpen } = useUIStore();
  const { items, removeItem, updateQuantity, getSubtotal, getTax, getShipping, getTotal } = useCartStore();
  const { addToast } = useToastStore();

  const subtotal = getSubtotal();
  const tax = getTax();
  const shipping = getShipping();
  const total = getTotal();

  return (
    <Drawer
      isOpen={isCartOpen}
      onClose={() => setCartOpen(false)}
      title={`Shopping Cart (${items.length} ${items.length === 1 ? 'item' : 'items'})`}
      size="lg"
    >
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-20 h-20 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-6">
            <ShoppingBag className="w-10 h-10 text-neutral-400" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Your cart is empty</h3>
          <p className="text-neutral-500 text-center mb-8 max-w-xs">
            Looks like you haven't added anything yet. Start shopping to fill it up!
          </p>
          <Button variant="primary" onClick={() => setCartOpen(false)}>
            Start Shopping
          </Button>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          {/* Free shipping progress */}
          {subtotal < FREE_SHIPPING_THRESHOLD && (
            <div className="px-4 py-3 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-100 dark:border-primary-900/30">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-primary-700 dark:text-primary-300 font-medium">
                  Add {formatPrice(FREE_SHIPPING_THRESHOLD - subtotal)} more for FREE shipping!
                </span>
                <span className="text-xs text-primary-600">{Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-primary-200 dark:bg-primary-900/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-600 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto py-4 space-y-3 px-4">
            {items.map((item) => {
              const price = item.product.sale_price || item.product.base_price;
              const itemTotal = price * item.quantity;
              const primaryImage = item.images?.[0]?.url || item.product.images?.[0]?.url || '/placeholder.svg';
              const hasDiscount = item.product.sale_price !== null && item.product.sale_price !== undefined && Number(item.product.sale_price) < Number(item.product.base_price);

              return (
                <div
                  key={item.variantId}
                  className="flex gap-4 p-3 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm"
                >
                  <div className="relative">
                    <SafeProductImage
                      src={primaryImage}
                      alt={item.product.name}
                      className="w-20 h-24 object-cover rounded-lg"
                      fallbackSize="sm"
                    />
                    {hasDiscount && (
                      <span className="absolute -top-1 -right-1 bg-accent-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                        -{Math.round(((item.product.base_price - item.product.sale_price!) / item.product.base_price) * 100)}%
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/product/${item.product.slug}`}
                          className="font-medium text-sm hover:text-primary-600 line-clamp-2"
                          onClick={() => setCartOpen(false)}
                        >
                          {item.product.name}
                        </Link>
                        <p className="text-xs text-neutral-500 mt-1">
                          Size: {item.variant.size} &bull; Color: {item.variant.color}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          removeItem(item.variantId);
                          addToast({
                            type: 'info',
                            title: 'Removed from cart',
                            message: item.product.name,
                          });
                        }}
                        className="p-1 text-neutral-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-900/20 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className={cn(
                            "w-7 h-7 rounded-md border border-neutral-300 dark:border-neutral-600 flex items-center justify-center transition-colors",
                            item.quantity <= 1 ? "opacity-50 cursor-not-allowed" : "hover:bg-neutral-100 dark:hover:bg-neutral-700"
                          )}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                          disabled={item.quantity >= item.variant.inventory_quantity}
                          className={cn(
                            "w-7 h-7 rounded-md border border-neutral-300 dark:border-neutral-600 flex items-center justify-center transition-colors",
                            item.quantity >= item.variant.inventory_quantity ? "opacity-50 cursor-not-allowed" : "hover:bg-neutral-100 dark:hover:bg-neutral-700"
                          )}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-right">
                        {hasDiscount && (
                          <p className="text-xs text-neutral-400 line-through">
                            {formatPrice(item.product.base_price * item.quantity)}
                          </p>
                        )}
                        <p className="font-semibold">
                          {formatPrice(itemTotal)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Checkout section */}
          <div className="border-t border-neutral-200 dark:border-neutral-800 p-4 space-y-3 bg-white dark:bg-neutral-900">
            {/* Trust badges */}
            <div className="flex items-center justify-center gap-4 text-xs text-neutral-500 py-2">
              <span className="flex items-center gap-1">
                <Truck className="w-3.5 h-3.5" />
                Free Shipping {FREE_SHIPPING_THRESHOLD}+
              </span>
              <span className="flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5" />
                30-Day Returns
              </span>
              <span className="flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" />
                SSL Secure
              </span>
            </div>

            {/* Pricing summary */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Tax (GST 18%)</span>
                <span>{formatPrice(tax)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Shipping</span>
                <span className={cn(shipping === 0 ? 'text-success-600 font-medium' : '')}>
                  {shipping === 0 ? 'FREE' : formatPrice(shipping)}
                </span>
              </div>
            </div>

            <div className="flex justify-between text-lg font-semibold pt-2 border-t border-neutral-200 dark:border-neutral-700">
              <span>Total</span>
              <span>{formatPrice(total)}</span>
            </div>

            <Link to="/checkout" onClick={() => setCartOpen(false)} className="block">
              <Button variant="primary" size="lg" className="w-full gap-2">
                <CreditCard className="w-4 h-4" />
                Proceed to Secure Checkout
              </Button>
            </Link>

            <div className="flex items-center justify-center gap-2 text-xs text-neutral-400">
              <Shield className="w-3.5 h-3.5" />
              <span>256-bit SSL encrypted checkout</span>
            </div>

            <Link to="/cart" onClick={() => setCartOpen(false)} className="block">
              <Button variant="ghost" size="sm" className="w-full">
                View Full Cart
              </Button>
            </Link>
          </div>
        </div>
      )}
    </Drawer>
  );
}
