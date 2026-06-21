import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CreditCard, Building2, Wallet, Truck, MapPin, Mail, Shield, RefreshCw } from 'lucide-react';
import { Button, Input, Card } from '../components/ui';
import { useCartStore, useToastStore } from '../stores';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { formatPrice, generateOrderNumber } from '../lib/utils';
import { cn } from '../lib/utils';
import type { Coupon } from '../types';

type PaymentMethod = 'upi' | 'card' | 'wallet' | 'netbanking' | 'cod';

const paymentMethods: { id: PaymentMethod; name: string; icon: React.ElementType }[] = [
  { id: 'upi', name: 'UPI', icon: Wallet },
  { id: 'card', name: 'Credit/Debit Card', icon: CreditCard },
  { id: 'netbanking', name: 'Net Banking', icon: Building2 },
  { id: 'wallet', name: 'Wallets', icon: Wallet },
  { id: 'cod', name: 'Cash on Delivery', icon: Truck },
];

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, getSubtotal, getTax, getShipping, clearCart } = useCartStore();
  const { addToast } = useToastStore();
  const [loading, setCheckoutLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');

  // Coupon states
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  const subtotal = getSubtotal();
  const tax = getTax();
  const shipping = getShipping();

  let discount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.type === 'percentage') {
      discount = Math.round(subtotal * (Number(appliedCoupon.value) / 100));
      if (appliedCoupon.max_discount_amount) {
        discount = Math.min(discount, Number(appliedCoupon.max_discount_amount));
      }
    } else if (appliedCoupon.type === 'fixed') {
      discount = Math.min(Number(appliedCoupon.value), subtotal);
    }
  }

  const total = Math.max(0, subtotal + tax + shipping - discount);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError('');
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponCode.trim().toUpperCase())
        .eq('is_active', true)
        .single();

      if (error || !data) {
        setCouponError('Invalid or expired coupon code');
        setAppliedCoupon(null);
        return;
      }

      const now = new Date();
      const validFrom = new Date(data.valid_from);
      const validUntil = new Date(data.valid_until);

      if (now < validFrom || now > validUntil) {
        setCouponError('This coupon is not active or has expired');
        setAppliedCoupon(null);
        return;
      }

      if (subtotal < Number(data.min_order_amount)) {
        setCouponError(`Minimum order amount of INR ${data.min_order_amount} required`);
        setAppliedCoupon(null);
        return;
      }

      setAppliedCoupon(data);
      addToast({
        type: 'success',
        title: 'Coupon applied successfully!',
        message: `${data.code} applied`,
      });
    } catch (err) {
      console.error('Error applying coupon:', err);
      setCouponError('Error applying coupon. Please try again.');
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  const [formData, setFormData] = useState({
    email: user?.email || '',
    fullName: user?.full_name || '',
    phone: '',
    address: '',
    apartment: '',
    city: '',
    state: '',
    pincode: '',
    saveInfo: false,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutLoading(true);

    try {
      if (!user) {
        addToast({
          type: 'error',
          title: 'Please sign in to checkout',
        });
        navigate('/login');
        return;
      }

      const orderNumber = generateOrderNumber();

      const shippingAddress = {
        full_name: formData.fullName,
        phone: formData.phone,
        address_line1: formData.address,
        address_line2: formData.apartment,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        country: 'India',
      };

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          order_number: orderNumber,
          status: 'pending',
          subtotal,
          tax_amount: tax,
          shipping_amount: shipping,
          discount_amount: discount,
          total,
          billing_address: shippingAddress,
          shipping_address: shippingAddress,
          payment_method: paymentMethod,
          payment_status: 'completed',
        })
        .select('id')
        .single();

      if (orderError) throw orderError;
      if (!orderData) throw new Error('Failed to create order');

      const orderId = orderData.id;

      const orderItems = items.map((item) => {
        const price = item.product.sale_price || item.product.base_price;
        const primaryImage = item.images?.[0]?.url || item.product.images?.[0]?.url || '/placeholder.svg';
        return {
          order_id: orderId,
          product_id: item.product.id,
          variant_id: item.variantId,
          quantity: item.quantity,
          unit_price: price,
          total_price: price * item.quantity,
          product_name: item.product.name,
          product_image: primaryImage,
          size: item.variant.size,
          color: item.variant.color,
        };
      });

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);

      if (itemsError) throw itemsError;

      // Decrement inventory stock count for each purchased product variant in the database
      for (const item of items) {
        const newQty = Math.max(0, item.variant.inventory_quantity - item.quantity);
        const { error: variantError } = await supabase
          .from('product_variants')
          .update({
            inventory_quantity: newQty,
            is_in_stock: newQty > 0
          })
          .eq('id', item.variantId);

        if (variantError) throw variantError;
      }

      const loyaltyPoints = Math.floor(total / 100);

      if (loyaltyPoints > 0) {
        await supabase.rpc('add_loyalty_points', {
          p_user_id: user.id,
          p_points: loyaltyPoints,
          p_type: 'earned',
          p_description: `Order #${orderNumber}`,
        });
      }

      addToast({
        type: 'success',
        title: 'Order placed successfully!',
        message: `Order #${orderNumber}`,
      });

      clearCart();
      navigate('/orders');
    } catch (error) {
      console.error('Checkout error:', error);
      addToast({
        type: 'error',
        title: 'Checkout failed',
        message: 'Please try again',
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="container-app py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Your cart is empty</h1>
        <Link to="/">
          <Button>Continue Shopping</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container-app py-8">
      <h1 className="text-2xl font-display font-bold mb-8">Checkout</h1>

      <form onSubmit={handleCheckout}>
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary-600" />
                Contact Information
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <Input
                  label="Email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
                <Input
                  label="Phone"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="+91 98765 43210"
                  required
                />
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary-600" />
                Shipping Address
              </h2>
              <div className="space-y-4">
                <Input
                  label="Full Name"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  required
                />
                <Input
                  label="Address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="Street address"
                  required
                />
                <Input
                  label="Apartment, suite, etc. (optional)"
                  name="apartment"
                  value={formData.apartment}
                  onChange={handleInputChange}
                />
                <div className="grid md:grid-cols-3 gap-4">
                  <Input
                    label="City"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    required
                  />
                  <Input
                    label="State"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    required
                  />
                  <Input
                    label="PIN Code"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary-600" />
                Payment Method
              </h2>
              <div className="space-y-2">
                {paymentMethods.map((method) => (
                  <label
                    key={method.id}
                    className={cn(
                      'flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all',
                      paymentMethod === method.id
                        ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                    )}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method.id}
                      checked={paymentMethod === method.id}
                      onChange={() => setPaymentMethod(method.id)}
                      className="sr-only"
                    />
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                        paymentMethod === method.id
                          ? 'border-primary-600'
                          : 'border-neutral-300'
                      )}
                    >
                      {paymentMethod === method.id && (
                        <div className="w-2.5 h-2.5 rounded-full bg-primary-600" />
                      )}
                    </div>
                    <method.icon className="w-5 h-5 text-neutral-600" />
                    <span className="font-medium">{method.name}</span>
                  </label>
                ))}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-24">
              <h2 className="text-lg font-medium mb-4">Order Summary</h2>

              <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                {items.map((item) => {
                  const primaryImage = item.images?.[0]?.url || item.product.images?.[0]?.url || '/placeholder.svg';
                  const price = item.product.sale_price || item.product.base_price;
                  return (
                    <div key={item.variantId} className="flex gap-3">
                      <img
                        src={primaryImage}
                        alt={item.product.name}
                        className="w-12 h-16 object-cover rounded"
                      />
                      <div className="flex-1 text-sm">
                        <p className="font-medium line-clamp-1">{item.product.name}</p>
                        <p className="text-xs text-neutral-500">
                          {item.variant.size} / {item.variant.color} x {item.quantity}
                        </p>
                      </div>
                      <p className="text-sm font-medium">
                        {formatPrice(price * item.quantity)}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Promo Code Input */}
              <div className="my-4 pt-3 border-t border-neutral-200 dark:border-neutral-700">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between bg-success-50 dark:bg-success-900/10 border border-success-200 dark:border-success-950 p-2.5 rounded-lg text-sm">
                    <div>
                      <p className="font-semibold text-success-800 dark:text-success-400">{appliedCoupon.code}</p>
                      <p className="text-xs text-neutral-500">
                        {appliedCoupon.type === 'percentage'
                          ? `${appliedCoupon.value}% OFF (Max INR ${appliedCoupon.max_discount_amount || 'N/A'})`
                          : `INR ${appliedCoupon.value} OFF`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-xs font-semibold text-neutral-400 hover:text-neutral-600"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        placeholder="Enter Promo Code"
                        className="input text-sm py-1.5 min-w-0"
                        disabled={couponLoading}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleApplyCoupon}
                        isLoading={couponLoading}
                        disabled={!couponCode.trim()}
                      >
                        Apply
                      </Button>
                    </div>
                    {couponError && <p className="text-xs text-error-600">{couponError}</p>}
                  </div>
                )}
              </div>

              <div className="border-t border-neutral-200 dark:border-neutral-700 pt-3" />

              <div className="space-y-3 my-4">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-success-600 dark:text-success-400 font-medium">
                    <span>Discount</span>
                    <span>-{formatPrice(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">Tax (18%)</span>
                  <span>{formatPrice(tax)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">Shipping</span>
                  <span className={cn(shipping === 0 && 'text-success-600')}>
                    {shipping === 0 ? 'Free' : formatPrice(shipping)}
                  </span>
                </div>
              </div>

              <div className="border-t border-neutral-200 dark:border-neutral-700 pt-3" />

              <div className="flex justify-between text-lg font-semibold mb-6">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={loading}
              >
                Place Order
              </Button>

              <div className="flex flex-col gap-2 mt-4 text-center text-xs">
                <p className="flex items-center justify-center gap-1 text-neutral-600">
                  <Shield className="w-3.5 h-3.5 text-accent-600" />
                  ⚡ Secure SSL Encrypted Checkout
                </p>
                <p className="flex items-center justify-center gap-1 text-neutral-600">
                  <RefreshCw className="w-3.5 h-3.5 text-success-600" />
                  Easy 30-Day Returns
                </p>
              </div>

              <p className="text-xs text-neutral-500 text-center mt-4">
                By placing your order, you agree to our Terms and Privacy Policy
              </p>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
