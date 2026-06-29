import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Package, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button, Card, Badge, EmptyState } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { formatDate, formatPrice } from '../lib/utils';
import { useToastStore } from '../stores';
import { SafeProductImage } from '../components/product';

interface OrderItem {
  id: string;
  product_id: string;
  variant_id: string;
  product_name: string;
  product_image: string;
  size: string;
  color: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  shipping_amount: number;
  discount_amount?: number;
  total: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
  notes?: string;
  tracking_number?: string;
}

interface OrderNotes {
  events?: unknown[];
  carrier?: string;
  tracking_number?: string;
  return_reason?: string;
  return_status?: string;
  admin_notes?: string;
}

const parseOrderNotes = (notes?: string | null): OrderNotes => {
  if (!notes) return {};

  try {
    const parsed = JSON.parse(notes);
    if (Array.isArray(parsed)) {
      return { events: parsed };
    }

    if (parsed && typeof parsed === 'object') {
      return {
        events: Array.isArray((parsed as Record<string, unknown>).events) ? ((parsed as Record<string, unknown>).events as unknown[]) : undefined,
        carrier: (parsed as Record<string, unknown>).carrier as string | undefined,
        tracking_number: (parsed as Record<string, unknown>).tracking_number as string | undefined,
        return_reason: (parsed as Record<string, unknown>).return_reason as string | undefined,
        return_status: (parsed as Record<string, unknown>).return_status as string | undefined,
        admin_notes: (parsed as Record<string, unknown>).admin_notes as string | undefined,
      };
    }
  } catch {
    return { admin_notes: notes };
  }

  return {};
};

const statusColors: Record<string, string> = {
  pending: 'bg-warning-100 text-warning-700',
  confirmed: 'bg-primary-100 text-primary-700',
  processing: 'bg-primary-100 text-primary-700',
  shipped: 'bg-blue-100 text-blue-700',
  delivered: 'bg-success-100 text-success-700',
  cancelled: 'bg-error-100 text-error-700',
  returned: 'bg-neutral-100 text-neutral-700',
  PENDING_PAYMENT: 'bg-warning-100 text-warning-700',
  PAID: 'bg-success-100 text-success-700',
  FAILED_ABANDONED: 'bg-error-100 text-error-700',
};

function getStatusTextAndColor(status: string, notes?: string | null) {
  try {
    const meta = JSON.parse(notes || '{}');
    if (meta.return_status === 'requested') {
      return { text: 'Return Requested', colorClass: 'bg-neutral-100 text-neutral-700' };
    }
    if (meta.return_status === 'returned_restocked') {
      return { text: 'Returned & Restocked', colorClass: 'bg-neutral-100 text-neutral-700' };
    }
  } catch { /* ignore */ }

  if (status === 'PENDING_PAYMENT') {
    return { text: 'Pending Payment', colorClass: 'bg-warning-100 text-warning-700' };
  }
  if (status === 'PAID') {
    return { text: 'Paid & Confirmed', colorClass: 'bg-success-100 text-success-700' };
  }
  if (status === 'FAILED_ABANDONED') {
    return { text: 'Failed & Abandoned', colorClass: 'bg-error-100 text-error-700' };
  }
  if (status === 'pending') {
    return { text: 'Pending Fulfillment', colorClass: 'bg-warning-100 text-warning-700' };
  }
  if (status === 'processing') {
    return { text: 'Unshipped', colorClass: 'bg-warning-100 text-warning-700' };
  }
  if (status === 'returned') {
    return { text: 'Returned', colorClass: 'bg-neutral-100 text-neutral-700' };
  }
  const labels: Record<string, string> = {
    confirmed: 'Confirmed',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  };
  return {
    text: labels[status] || (status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : ''),
    colorClass: statusColors[status] || 'bg-neutral-100 text-neutral-700',
  };
}

export default function OrdersPage() {
  const { user, isAuthenticated } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToastStore();
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  const [simulatingWebhookId, setSimulatingWebhookId] = useState<string | null>(null);

  // Expanded details state
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, OrderItem[]>>({});
  const [loadingItems, setLoadingItems] = useState(false);

  const handleSimulateWebhook = async (orderNumber: string) => {
    try {
      setSimulatingWebhookId(orderNumber);

      // SECURITY: previously this invoked the payment-webhook function
      // with x-mock-payment:true which let ANY user mark ANY order PAID.
      // It now goes through the admin-only RPC which requires
      // app_metadata.role = 'admin' in the JWT.
      const { error } = await supabase.rpc('simulate_payment_success', {
        p_order_number: orderNumber,
        p_payment_intent_id: `pi_test_${Date.now()}`,
      });

      if (error) {
        throw error;
      }

      addToast({
        type: 'success',
        title: 'Webhook Delivered',
        message: `Order #${orderNumber} successfully marked as PAID.`,
      });

      loadOrders();
    } catch (error) {
      console.error('Error simulating webhook:', error);
      addToast({
        type: 'error',
        title: 'Simulation Failed',
        message: 'Could not deliver the payment success webhook. Admin role required.',
      });
    } finally {
      setSimulatingWebhookId(null);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      setProcessingOrderId(orderId);

      // Call database RPC to cancel the order and replenish stock atomically
      const { error } = await supabase.rpc('cancel_order', {
        p_order_id: orderId,
      });
      if (error) throw error;

      addToast({
        type: 'success',
        title: 'Order Cancelled',
        message: 'Your order has been cancelled and stock replenished.',
      });

      loadOrders();
    } catch (error) {
      console.error('Error cancelling order:', error);
      addToast({
        type: 'error',
        title: 'Cancellation failed',
        message: 'Could not cancel the order.',
      });
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleReturnOrder = async (orderId: string, reason: string) => {
    try {
      setProcessingOrderId(orderId);

      const order = orders.find(o => o.id === orderId);
      let currentNotes: Record<string, unknown> = {};
      try {
        if (order?.notes) {
          const parsed = JSON.parse(order.notes);
          if (Array.isArray(parsed)) {
            currentNotes = { events: parsed };
          } else if (parsed && typeof parsed === 'object' && parsed !== null) {
            currentNotes = parsed;
          } else {
            currentNotes = { admin_notes: String(parsed) };
          }
        }
      } catch {
        if (order?.notes) {
          currentNotes = { admin_notes: order.notes };
        }
      }

      const events = Array.isArray(currentNotes.events) ? currentNotes.events : [];
      const returnRequestedEvent = {
        status: 'return_requested',
        reason,
        timestamp: new Date().toISOString()
      };

      const updatedNotes = {
        ...currentNotes,
        return_reason: reason,
        return_status: 'requested',
        events: [...events, returnRequestedEvent]
      };

      // Update order metadata in notes only
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          notes: JSON.stringify(updatedNotes)
        })
        .eq('id', orderId);
      if (orderError) throw orderError;

      addToast({
        type: 'success',
        title: 'Return Requested',
        message: 'Your return has been requested successfully.',
      });

      loadOrders();
    } catch (error) {
      console.error('Error returning order:', error);
      addToast({
        type: 'error',
        title: 'Return failed',
        message: 'Could not request return.',
      });
    } finally {
      setProcessingOrderId(null);
    }
  };

  const loadOrders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders((data as Order[]) || []);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      loadOrders();
    }
  }, [user, loadOrders]);

  const toggleOrderDetails = async (orderId: string) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      return;
    }

    setExpandedOrderId(orderId);

    if (!itemsByOrder[orderId]) {
      setLoadingItems(true);
      try {
        const { data, error } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', orderId);

        if (error) throw error;
        setItemsByOrder((prev) => ({
          ...prev,
          [orderId]: (data as OrderItem[]) || [],
        }));
      } catch (error) {
        console.error('Error loading order items:', error);
      } finally {
        setLoadingItems(false);
      }
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="container-app py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Sign in to view your orders</h1>
        <Link to="/login">
          <Button>Sign In</Button>
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container-app py-8">
        <div className="skeleton h-8 w-32 mb-6" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="container-app py-16">
        <EmptyState
          icon={<Package className="w-16 h-16" />}
          title="No orders yet"
          description="When you place an order, it will appear here"
          action={
            <Link to="/">
              <Button>Start Shopping</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="container-app py-8">
      <h1 className="text-2xl font-display font-bold mb-6">My Orders</h1>

      <div className="space-y-4">
        {orders.map((order) => (
          <Card key={order.id} className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <p className="text-sm text-neutral-500">Order #{order.order_number}</p>
                <p className="text-sm text-neutral-500">{formatDate(order.created_at)}</p>
              </div>
              {(() => {
                const mapped = getStatusTextAndColor(order.status, order.notes);
                return (
                  <span id={`status-badge-${order.order_number}`}>
                    <Badge className={mapped.colorClass}>
                      {mapped.text}
                    </Badge>
                  </span>
                );
              })()}
            </div>

            {/* Visual Tracking Timeline */}
            {(() => {
              let isReturnOrCancelled = order.status === 'cancelled' || order.status === 'returned' || order.status === 'PENDING_PAYMENT' || order.status === 'FAILED_ABANDONED';
              try {
                const meta = JSON.parse(order.notes || '{}');
                if (meta.return_status === 'requested' || meta.return_status === 'returned_restocked') {
                  isReturnOrCancelled = true;
                }
              } catch { /* ignore */ }
              
              if (isReturnOrCancelled) return null;

              return (
                <div className="my-6 px-4">
                  <div className="flex items-center justify-between max-w-xl mx-auto relative">
                    <div className="absolute left-0 right-0 top-4 -translate-y-1/2 h-1 bg-neutral-200 dark:bg-neutral-700 z-0" />
                    <div 
                      className="absolute left-0 top-4 -translate-y-1/2 h-1 bg-primary-600 transition-all duration-500 z-0" 
                      style={{ 
                        width: `${
                          (order.status === 'pending' || order.status === 'PAID') ? '0%' :
                          order.status === 'processing' ? '33.33%' :
                          order.status === 'shipped' ? '66.66%' :
                          order.status === 'delivered' ? '100%' : '0%'
                        }`
                      }}
                    />
                    
                    {['pending', 'processing', 'shipped', 'delivered'].map((step, idx) => {
                      const stepLabels: Record<string, string> = {
                        pending: 'Ordered',
                        processing: 'Fulfilled',
                        shipped: 'Shipped',
                        delivered: 'Delivered',
                      };
                      
                      const orderStatuses = ['pending_dummy', 'processing', 'shipped', 'delivered'];
                      const mappedStatus = (order.status === 'pending' || order.status === 'PAID') ? 'pending_dummy' : order.status;
                      const currentIdx = orderStatuses.indexOf(mappedStatus);
                      const isCompleted = orderStatuses.indexOf(step) <= currentIdx;
                      
                      return (
                        <div key={step} className="flex flex-col items-center z-10 relative" id={`timeline-step-${order.order_number}-${step}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300 ${
                            isCompleted 
                              ? 'bg-primary-600 text-white ring-4 ring-primary-100 dark:ring-primary-900/30' 
                              : 'bg-neutral-200 text-neutral-500 dark:bg-neutral-800'
                          }`}>
                            {idx + 1}
                          </div>
                          <span className={`text-xs mt-2 font-medium ${isCompleted ? 'text-primary-600 font-semibold' : 'text-neutral-500'}`}>
                            {stepLabels[step]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Carrier Info & Clickable Link */}
            {order.tracking_number && (
              <div className="mt-4 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg text-sm flex flex-wrap justify-between items-center gap-2" id={`tracking-info-${order.order_number}`}>
                <div>
                  <span className="text-neutral-500">Carrier:</span>{' '}
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200 capitalize" id={`carrier-name-${order.order_number}`}>
                    {(() => {
                      const notes = parseOrderNotes(order.notes);
                      const events = Array.isArray(notes.events) ? notes.events : [];
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const shipStep = events.find((t: any) => t?.status === 'shipped') as { carrier?: string } | undefined;
                      return shipStep?.carrier || notes.carrier || 'Carrier';
                    })()}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500">Tracking Number:</span>{' '}
                  <a
                    href={`https://www.google.com/search?q=${order.tracking_number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline font-mono font-medium"
                    id={`tracking-link-${order.order_number}`}
                  >
                    {order.tracking_number}
                  </a>
                </div>
              </div>
            )}

             <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <div>
                <p className="text-lg font-semibold">{formatPrice(order.total)}</p>
              </div>
              <div className="flex gap-2">
                {order.status === 'PENDING_PAYMENT' && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="bg-success-600 hover:bg-success-700 text-white font-medium shadow-sm"
                    onClick={() => handleSimulateWebhook(order.order_number)}
                    isLoading={simulatingWebhookId === order.order_number}
                    disabled={processingOrderId !== null || simulatingWebhookId !== null}
                    id={`simulate-btn-${order.order_number}`}
                  >
                    Simulate Payment Webhook
                  </Button>
                )}
                {(order.status === 'pending' || order.status === 'processing' || order.status === 'confirmed') && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-error-600 text-error-600 hover:bg-error-50"
                    onClick={() => handleCancelOrder(order.id)}
                    disabled={processingOrderId !== null}
                  >
                    Cancel Order
                  </Button>
                )}
                {order.status === 'delivered' && (() => {
                  let hasRequestedReturn = false;
                  try {
                    const meta = JSON.parse(order.notes || '{}');
                    if (meta.return_status === 'requested' || meta.return_status === 'returned_restocked') {
                      hasRequestedReturn = true;
                    }
                  } catch { /* ignore */ }

                  if (hasRequestedReturn) return null;

                  return (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-warning-600 text-warning-600 hover:bg-warning-50"
                      onClick={() => {
                        const reason = window.prompt("Please enter a return reason:", "Item didn't fit");
                        if (reason !== null) {
                          handleReturnOrder(order.id, reason || "No reason provided");
                        }
                      }}
                      disabled={processingOrderId !== null}
                      id={`return-btn-${order.order_number}`}
                    >
                      Request Return
                    </Button>
                  );
                })()}
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={expandedOrderId === order.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  onClick={() => toggleOrderDetails(order.id)}
                >
                  {expandedOrderId === order.id ? 'Hide Details' : 'View Details'}
                </Button>
              </div>
            </div>

            {/* Expandable Order Details */}
            {expandedOrderId === order.id && (
              <div className="mt-6 pt-6 border-t border-neutral-100 dark:border-neutral-800 space-y-4 animate-fadeIn">
                <h4 className="font-semibold text-sm text-neutral-900 dark:text-white">Order Items</h4>
                {loadingItems && !itemsByOrder[order.id] ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      {itemsByOrder[order.id]?.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 text-sm">
                          <SafeProductImage
                            src={item.product_image || '/placeholder.svg'}
                            alt={item.product_name}
                            className="w-12 h-16 object-cover rounded bg-neutral-100 dark:bg-neutral-800"
                            fallbackSize="sm"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-neutral-900 dark:text-white truncate">{item.product_name}</p>
                            <p className="text-xs text-neutral-500 mt-0.5">
                              Size: {item.size} | Color: {item.color}
                            </p>
                            <p className="text-xs text-neutral-500 mt-0.5">
                              Qty: {item.quantity} x {formatPrice(item.unit_price)}
                            </p>
                          </div>
                          <p className="font-medium text-neutral-900 dark:text-white">
                            {formatPrice(item.total_price)}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 grid sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-neutral-500">Payment Method</p>
                        <p className="font-medium capitalize mt-0.5">{order.payment_method}</p>
                        <p className="text-neutral-500 mt-2">Payment Status</p>
                        <p className="font-medium capitalize mt-0.5">{order.payment_status}</p>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Subtotal</span>
                          <span>{formatPrice(order.subtotal)}</span>
                        </div>
                        {order.discount_amount && Number(order.discount_amount) > 0 ? (
                          <div className="flex justify-between text-success-600">
                            <span>Discount</span>
                            <span>-{formatPrice(order.discount_amount)}</span>
                          </div>
                        ) : null}
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Tax</span>
                          <span>{formatPrice(order.tax_amount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Shipping</span>
                          <span>{Number(order.shipping_amount) === 0 ? 'Free' : formatPrice(order.shipping_amount)}</span>
                        </div>
                        <div className="flex justify-between font-semibold text-sm pt-1.5 border-t border-neutral-100 dark:border-neutral-800">
                          <span>Total</span>
                          <span>{formatPrice(order.total)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
