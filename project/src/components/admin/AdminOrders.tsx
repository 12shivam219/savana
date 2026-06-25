import { useEffect, useState, useCallback } from 'react';
import { Search, Truck, CheckCircle, XCircle, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatPrice, formatDate } from '../../lib/utils';
import { cn } from '../../lib/utils';
import type { Order, Address } from '../../types';

interface OrderNotes {
  events: any[];
  carrier?: string;
  tracking_number?: string;
  return_reason?: string;
  return_status?: string;
}

const parseOrderNotes = (notes: string | null | undefined): OrderNotes => {
  if (!notes) return { events: [] };
  try {
    const parsed = JSON.parse(notes);
    if (Array.isArray(parsed)) {
      return { events: parsed };
    }
    if (parsed && typeof parsed === 'object') {
      return {
        events: Array.isArray(parsed.events) ? parsed.events : [],
        carrier: parsed.carrier,
        tracking_number: parsed.tracking_number,
        return_reason: parsed.return_reason,
        return_status: parsed.return_status
      };
    }
  } catch (e) {
    console.error('Error parsing order notes:', e);
  }
  return { events: [] };
};

const statusFilters = ['all', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const;

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<typeof statusFilters[number]>('all');

  // Shipping dialog states
  const [shippingOrderId, setShippingOrderId] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('DHL');

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (searchQuery) {
        query = query.ilike('order_number', `%${searchQuery}%`);
      }

      const { data } = await query;
      setOrders((data as Order[]) || []);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  async function updateOrderStatus(orderId: string, newStatus: string) {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;
      loadOrders();
    } catch (error) {
      console.error('Error updating order:', error);
    }
  }

  async function markAsDelivered(order: Order) {
    try {
      const parsedNotes = parseOrderNotes(order.notes);
      const deliveryEvent = {
        status: 'delivered',
        timestamp: new Date().toISOString()
      };

      const updatedNotes = {
        ...parsedNotes,
        events: [...parsedNotes.events, deliveryEvent]
      };

      const { error } = await supabase
        .from('orders')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          notes: JSON.stringify(updatedNotes)
        })
        .eq('id', order.id);

      if (error) throw error;
      loadOrders();
    } catch (error) {
      console.error('Error delivering order:', error);
    }
  }

  async function handleShipOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!shippingOrderId || !trackingNumber) return;
    try {
      const order = orders.find(o => o.id === shippingOrderId);
      const parsedNotes = parseOrderNotes(order?.notes);

      const trackingEvent = {
        status: 'shipped',
        carrier,
        tracking_number: trackingNumber,
        timestamp: new Date().toISOString(),
      };

      const updatedNotes = {
        ...parsedNotes,
        carrier,
        tracking_number: trackingNumber,
        events: [...parsedNotes.events, trackingEvent]
      };

      const { error } = await supabase
        .from('orders')
        .update({
          status: 'shipped',
          tracking_number: trackingNumber,
          tracking_url: `https://www.google.com/search?q=${trackingNumber}`,
          notes: JSON.stringify(updatedNotes)
        })
        .eq('id', shippingOrderId);

      if (error) throw error;
      setShippingOrderId(null);
      setTrackingNumber('');
      loadOrders();
    } catch (error) {
      console.error('Error shipping order:', error);
    }
  }

  async function handleApproveReturn(order: Order) {
    try {
      const parsedNotes = parseOrderNotes(order.notes);
      const returnEvent = {
        status: 'returned_restocked',
        timestamp: new Date().toISOString()
      };

      const updatedNotes = {
        ...parsedNotes,
        return_status: 'returned_restocked',
        events: [...parsedNotes.events, returnEvent]
      };

      // Call postgres function to execute return and restock atomically
      const { error } = await supabase
        .rpc('approve_return_and_restock', {
          p_order_id: order.id,
          p_notes: JSON.stringify(updatedNotes)
        });

      if (error) throw error;
      loadOrders();
    } catch (error) {
      console.error('Error approving return:', error);
    }
  }

  function getStatusLabel(order: Order) {
    if (order.status === 'pending') {
      return 'Pending Fulfillment';
    }
    if (order.status === 'processing') {
      return 'Unshipped';
    }
    if (order.status === 'returned') {
      const meta = parseOrderNotes(order.notes);
      if (meta.return_status === 'returned_restocked') {
        return 'Returned & Restocked';
      }
      return 'Return Requested';
    }
    return order.status.charAt(0).toUpperCase() + order.status.slice(1);
  }

  function getStatusColorClass(status: string, notes?: string | null) {
    if (status === 'pending' || status === 'processing') {
      return 'bg-warning-100 text-warning-700';
    }
    if (status === 'shipped') {
      return 'bg-primary-100 text-primary-700';
    }
    if (status === 'delivered') {
      return 'bg-success-100 text-success-700';
    }
    if (status === 'returned') {
      const meta = parseOrderNotes(notes);
      if (meta.return_status === 'returned_restocked') {
        return 'bg-neutral-100 text-neutral-700';
      }
      return 'bg-warning-100 text-warning-700';
    }
    return 'bg-neutral-100 text-neutral-700';
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="text-neutral-500 mt-1">Manage customer orders</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by order number..."
            className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {statusFilters.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                statusFilter === status
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-neutral-900 text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-300 dark:border-neutral-700'
              )}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-neutral-500">Loading...</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">No orders found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-800">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-neutral-600">Order</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-neutral-600">Customer</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-neutral-600">Items</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-neutral-600">Total</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-neutral-600">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-neutral-600">Date</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-neutral-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {orders.map((order) => (

                    <tr key={order.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800">
                      <td className="px-4 py-3">
                        <p className="font-medium">#{order.order_number}</p>
                        <p className="text-sm text-neutral-500 capitalize">{order.payment_method}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p>{(order.shipping_address as unknown as Address)?.full_name}</p>
                        <p className="text-sm text-neutral-500">{(order.shipping_address as unknown as Address)?.phone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-neutral-600">View items</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{formatPrice(order.total)}</p>
                        <p className={cn(
                          'text-xs',
                          order.payment_status === 'completed' ? 'text-success-600' : 'text-warning-600'
                        )}>
                          {order.payment_status}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-1 rounded-full text-xs font-medium', getStatusColorClass(order.status, order.notes))} id={`status-badge-admin-${order.order_number}`}>
                          {getStatusLabel(order)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-500">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {order.status === 'pending' && (
                            <button
                              onClick={() => updateOrderStatus(order.id, 'processing')}
                              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg text-warning-600"
                              title="Mark as Processing"
                              id={`process-btn-${order.order_number}`}
                            >
                              <Clock className="w-4 h-4" />
                            </button>
                          )}
                          {order.status === 'processing' && (
                            <button
                              onClick={() => {
                                setShippingOrderId(order.id);
                                setTrackingNumber('1Z999AA10123456784'); // Pre-fill suggestion
                              }}
                              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg text-primary-600"
                              title="Ship Order"
                              id={`ship-btn-${order.order_number}`}
                            >
                              <Truck className="w-4 h-4" />
                            </button>
                          )}
                          {order.status === 'shipped' && (
                            <button
                              onClick={() => markAsDelivered(order)}
                              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg text-success-600"
                              title="Mark as Delivered"
                              id={`deliver-btn-${order.order_number}`}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                           {order.status === 'returned' && (() => {
                             const meta = parseOrderNotes(order.notes);
                             if (meta.return_status === 'requested') {
                               return (
                                 <button
                                   onClick={() => handleApproveReturn(order)}
                                   className="px-3 py-1 bg-success-600 hover:bg-success-700 text-white text-xs font-semibold rounded-lg"
                                   title="Approve Return & Restock"
                                   id={`approve-return-${order.order_number}`}
                                 >
                                   Approve Return
                                 </button>
                               );
                             }
                             return null;
                           })()}
                          {order.status !== 'cancelled' && order.status !== 'delivered' && order.status !== 'returned' && (
                            <button
                              onClick={() => updateOrderStatus(order.id, 'cancelled')}
                              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg text-error-500"
                              title="Cancel Order"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Shipping Dialog Modal */}
      {shippingOrderId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fadeIn" id="ship-modal">
          <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 max-w-md w-full border border-neutral-200 dark:border-neutral-800 shadow-xl animate-scaleUp">
            <h3 className="text-lg font-bold mb-4">Ship Order</h3>
            <form onSubmit={handleShipOrder} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Shipping Carrier</label>
                <select
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  className="w-full p-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900"
                  id="carrier-select"
                >
                  <option value="DHL">DHL</option>
                  <option value="FedEx">FedEx</option>
                  <option value="UPS">UPS</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tracking Number</label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="w-full p-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 font-mono"
                  placeholder="Enter tracking number"
                  required
                  id="tracking-input"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShippingOrderId(null)}
                  className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  id="ship-cancel-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
                  id="ship-submit-btn"
                >
                  Ship
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
