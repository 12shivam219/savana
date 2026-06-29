import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CreditCard, Building2, Wallet, Truck, MapPin, Mail, Shield, RefreshCw, WifiOff } from 'lucide-react';
import { Button, Input, Card } from '../components/ui';
import { useCartStore, useToastStore } from '../stores';
import { useAuth } from '../hooks/useAuth';
import { isInvalidRefreshTokenError, supabase } from '../lib/supabase';
import { formatPrice, generateOrderNumber } from '../lib/utils';
import { cn } from '../lib/utils';
import type { Coupon } from '../types';
import { SafeProductImage } from '../components/product';
import { Modal } from '../components/overlays';

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
  const { user, refreshProfile } = useAuth();
  const { items, getSubtotal, getTax, getShipping, clearCart } = useCartStore();
  const { addToast } = useToastStore();
  const [, setCheckoutLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [networkErrorBanner, setNetworkErrorBanner] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => self.crypto?.randomUUID() || Math.random().toString(36).substring(2) + Date.now().toString(36));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);

  // Coupon states
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  // Re-authentication states
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthLoading, setReauthLoading] = useState(false);
  const [reauthError, setReauthError] = useState('');

  const roundPrice = (val: number) => Math.round((val + Number.EPSILON) * 100) / 100;

  const subtotal = roundPrice(getSubtotal());
  const tax = roundPrice(getTax());
  const shipping = roundPrice(getShipping());

  // Coupon validation hook
  useEffect(() => {
    if (appliedCoupon) {
      if (subtotal < Number(appliedCoupon.min_order_amount)) {
        setAppliedCoupon(null);
        setCouponError(`Minimum order amount of INR ${appliedCoupon.min_order_amount} required`);
        addToast({
          type: 'error',
          title: 'Coupon Revoked',
          message: `The active coupon was revoked as the cart subtotal fell below the minimum amount of INR ${appliedCoupon.min_order_amount}`,
        });
      }
    }
  }, [subtotal, appliedCoupon, addToast]);

  const subtotalPaise = Math.round(subtotal * 100);
  const taxPaise = Math.round(tax * 100);
  const shippingPaise = Math.round(shipping * 100);

  let rawDiscountPaise = 0;
  if (appliedCoupon) {
    if (appliedCoupon.type === 'percentage') {
      rawDiscountPaise = Math.round((subtotalPaise * Number(appliedCoupon.value)) / 100);
      if (appliedCoupon.max_discount_amount) {
        const maxDiscountPaise = Math.round(Number(appliedCoupon.max_discount_amount) * 100);
        rawDiscountPaise = Math.min(rawDiscountPaise, maxDiscountPaise);
      }
    } else if (appliedCoupon.type === 'fixed') {
      const fixedPaise = Math.round(Number(appliedCoupon.value) * 100);
      rawDiscountPaise = Math.min(fixedPaise, subtotalPaise);
    }
  }
  const discount = rawDiscountPaise / 100;

  const orderTotalBeforePointsPaise = Math.max(0, subtotalPaise + taxPaise + shippingPaise - rawDiscountPaise);
  const orderTotalBeforePoints = orderTotalBeforePointsPaise / 100;

  const maxPointsAvailable = user?.loyalty_points || 0;
  const maxPointsNeeded = Math.floor(orderTotalBeforePoints * 10);
  const redeemedPoints = useLoyaltyPoints ? Math.min(maxPointsAvailable, maxPointsNeeded) : 0;
  
  const pointsDiscountPaise = Math.round(redeemedPoints * 10); // 1 point = 10 paise
  const pointsDiscount = pointsDiscountPaise / 100;

  const totalPaise = Math.max(0, orderTotalBeforePointsPaise - pointsDiscountPaise);
  const total = totalPaise / 100;

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

  const handleReauthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reauthPassword) return;
    setReauthLoading(true);
    setReauthError('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: reauthPassword,
      });

      if (error) {
        if (isInvalidRefreshTokenError(error)) {
          await supabase.auth.signOut();
        }
        throw error;
      }

      setShowReauthModal(false);
      setReauthPassword('');
      addToast({
        type: 'success',
        title: 'Authenticated Successfully',
        message: 'Your session has been restored. Please click Place Order again to complete your checkout.',
      });
    } catch (error) {
      console.error('Re-authentication error:', error);
      setReauthError(error instanceof Error ? error.message : 'Invalid password. Please try again.');
    } finally {
      setReauthLoading(false);
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setNetworkErrorBanner(null);
    setCheckoutLoading(true);
    setIsSubmitting(true);

    try {
      if (!user) {
        addToast({
          type: 'error',
          title: 'Please sign in to checkout',
        });
        navigate('/login');
        return;
      }

      // Check connection before sending the request
      if (!navigator.onLine) {
        throw new TypeError('Failed to fetch');
      }

      // 1. Silent Token Refresh Check / Session Verification
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        if (isInvalidRefreshTokenError(sessionError)) {
          await supabase.auth.signOut();
        }
        setCheckoutLoading(false);
        setIsSubmitting(false);
        setShowReauthModal(true);
        return;
      }

      // 2. Fetch fresh non-stale state from Zustand store right before constructing the payload
      const freshStore = useCartStore.getState();
      const freshItems = freshStore.items;
      
      const subtotalPaise = Math.round(freshStore.getSubtotal() * 100);
      const taxPaise = Math.round(freshStore.getTax() * 100);
      const shippingPaise = Math.round(freshStore.getShipping() * 100);

      let couponDiscountPaise = 0;
      if (appliedCoupon) {
        if (appliedCoupon.type === 'percentage') {
          couponDiscountPaise = Math.round((subtotalPaise * Number(appliedCoupon.value)) / 100);
          if (appliedCoupon.max_discount_amount) {
            const maxDiscountPaise = Math.round(Number(appliedCoupon.max_discount_amount) * 100);
            couponDiscountPaise = Math.min(couponDiscountPaise, maxDiscountPaise);
          }
        } else if (appliedCoupon.type === 'fixed') {
          const fixedPaise = Math.round(Number(appliedCoupon.value) * 100);
          couponDiscountPaise = Math.min(fixedPaise, subtotalPaise);
        }
      }

      const pointsDiscountPaise = Math.round(redeemedPoints * 10); // 1 point = 0.10 INR = 10 paise
      const totalDiscountPaise = couponDiscountPaise + pointsDiscountPaise;

      const orderTotalBeforePointsPaise = Math.max(0, subtotalPaise + taxPaise + shippingPaise - couponDiscountPaise);
      const totalPaise = Math.max(0, orderTotalBeforePointsPaise - pointsDiscountPaise);

      const freshSubtotal = subtotalPaise / 100;
      const freshTax = taxPaise / 100;
      const freshShipping = shippingPaise / 100;
      const freshDiscount = totalDiscountPaise / 100;
      const freshTotal = totalPaise / 100;

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

      const orderItems = freshItems.map((item) => {
        const price = roundPrice(item.product.sale_price || item.product.base_price);
        const primaryImage = item.images?.[0]?.url || item.product.images?.[0]?.url || '/placeholder.svg';
        return {
          product_id: item.product.id,
          variant_id: item.variantId,
          quantity: item.quantity,
          unit_price: price,
          total_price: roundPrice(price * item.quantity),
          product_name: item.product.name,
          product_image: primaryImage,
          size: item.variant.size,
          color: item.variant.color,
        };
      });

      // Wrap RPC in a race with a 15-second strict timeout limit
      const rpcCall = supabase.rpc('place_order', {
        p_order_number: orderNumber,
        p_subtotal: freshSubtotal,
        p_tax_amount: freshTax,
        p_shipping_amount: freshShipping,
        p_discount_amount: freshDiscount,
        p_total: freshTotal,
        p_billing_address: shippingAddress,
        p_shipping_address: shippingAddress,
        p_payment_method: paymentMethod,
        p_payment_status: 'pending', // Online payment always starts as pending to capture via webhook
        p_items: orderItems,
        p_redeemed_points: redeemedPoints,
        p_coupon_code: appliedCoupon?.code || null,
        p_idempotency_key: idempotencyKey,
      });



      let timeoutId: any;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new TypeError('Failed to fetch')), 15000);
      });

      let orderId: string | null = null;
      let checkoutError: any = null;

      try {
        const result = await Promise.race([
          rpcCall,
          timeoutPromise
        ]);
        orderId = result.data;
        checkoutError = result.error;
      } finally {
        clearTimeout(timeoutId);
      }

      if (checkoutError) throw checkoutError;
      if (!orderId) throw new Error('Failed to place order');

      // SECURITY: We no longer auto-invoke the payment webhook from the
      // client. The previous flow allowed any caller with the anon key
      // to mark any order as PAID by POSTing { order_number, x-mock-payment }.
      //
      // The new flow expects either:
      //   1. A genuine Stripe webhook (production)
      //   2. An admin invoking simulate_payment_success RPC (dev/test)
      // The order is left in PENDING_PAYMENT until one of those fires.

      // Refresh loyalty points balance on profile state
      await refreshProfile();

      addToast({
        type: 'success',
        title: 'Order placed successfully!',
        message: `Order #${orderNumber}`,
      });

      clearCart();
      navigate('/orders');
    } catch (error) {
      console.error('Checkout error:', error);
      const isNetworkError = error instanceof TypeError && error.message === 'Failed to fetch';
      
      if (isNetworkError) {
        setNetworkErrorBanner("Network connection lost. No payment was taken. Please check your connection and try again.");
        return;
      }

      const errMsg = error instanceof Error 
        ? error.message 
        : (error && typeof error === 'object' && 'message' in error 
            ? String((error as { message?: unknown }).message) 
            : 'Please try again');
      addToast({
        type: 'error',
        title: 'Checkout failed',
        message: errMsg,
      });
    } finally {
      setCheckoutLoading(false);
      setIsSubmitting(false);
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

      {networkErrorBanner && (
        <div className="mb-6 p-4 bg-error-50 dark:bg-error-900/10 border border-error-200 dark:border-error-800 rounded-lg text-error-800 dark:text-error-300 text-sm flex items-start gap-3 shadow-sm">
          <WifiOff className="w-5 h-5 text-error-600 dark:text-error-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-error-900 dark:text-error-200">Connection Failed</h3>
            <p className="mt-0.5">{networkErrorBanner}</p>
          </div>
          <button 
            type="button" 
            onClick={() => setNetworkErrorBanner(null)} 
            className="text-error-500 hover:text-error-700 dark:text-error-400 dark:hover:text-error-200 font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

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
                      <SafeProductImage
                        src={primaryImage}
                        alt={item.product.name}
                        className="w-12 h-16 object-cover rounded"
                        fallbackSize="sm"
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

              {/* Loyalty Points Selection */}
              {user && (user.loyalty_points || 0) > 0 && (
                <div className="my-4 pt-3 border-t border-neutral-200 dark:border-neutral-700">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      id="use-loyalty-checkbox"
                      checked={useLoyaltyPoints}
                      onChange={(e) => setUseLoyaltyPoints(e.target.checked)}
                      className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      Use Loyalty Points ({user.loyalty_points} points available)
                    </span>
                  </label>
                  {useLoyaltyPoints && (
                    <p className="text-xs text-success-600 dark:text-success-400 mt-1.5 font-medium">
                      Saving {formatPrice(pointsDiscount)} discount ({redeemedPoints} points redeemed)
                    </p>
                  )}
                </div>
              )}

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
                {pointsDiscount > 0 && (
                  <div className="flex justify-between text-sm text-success-600 dark:text-success-400 font-medium">
                    <span>Loyalty Points Redeemed</span>
                    <span>-{formatPrice(pointsDiscount)}</span>
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
                isLoading={isSubmitting}
                disabled={isSubmitting}
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

      {/* Re-authentication Modal to prevent checkout loss on token expiry */}
      <Modal
        isOpen={showReauthModal}
        onClose={() => setShowReauthModal(false)}
        title="Session Expired"
        size="sm"
      >
        <form onSubmit={handleReauthSubmit} className="space-y-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Your secure checkout session has expired. Please enter your password to authenticate and complete your purchase without losing your cart.
          </p>
          <div>
            <label className="block text-xs font-medium mb-1 text-neutral-500">Email Address</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 text-sm cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Password</label>
            <input
              type="password"
              required
              value={reauthPassword}
              onChange={(e) => setReauthPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded bg-transparent text-sm font-sans"
            />
          </div>
          {reauthError && (
            <p className="text-xs text-error-600 dark:text-error-400 font-medium">
              {reauthError}
            </p>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowReauthModal(false)}
              disabled={reauthLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={reauthLoading}
            >
              Sign In
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
