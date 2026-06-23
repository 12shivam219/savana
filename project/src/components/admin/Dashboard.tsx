import { useEffect, useState } from 'react';
import { TrendingUp, ShoppingBag, Users, Package, DollarSign, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { formatPrice } from '../../lib/utils';
import type { Order } from '../../types';
import { SafeProductImage } from '../product';

interface StatCard {
  label: string;
  value: string;
  change?: number;
  icon: React.ElementType;
  color: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<StatCard[]>([
    { label: 'Total Revenue', value: '-', icon: DollarSign, color: 'bg-success-500' },
    { label: 'Average Order Value', value: '-', icon: TrendingUp, color: 'bg-warning-500' },
    { label: 'Total Orders', value: '-', icon: Package, color: 'bg-primary-500' },
    { label: 'Total Customers', value: '-', icon: Users, color: 'bg-accent-500' },
    { label: 'Return Metrics', value: '-', icon: RefreshCw, color: 'bg-neutral-500' },
  ]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  interface TopProduct {
    name: string;
    image: string;
    quantity: number;
    revenue: number;
  }
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const { count: orderCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });

      const { count: customerCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'customer');

      const { data: ordersData } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch all orders to compute correct Total Revenue and AOV
      const { data: allOrders } = await supabase
        .from('orders')
        .select('total, payment_status, status');

      let totalRevenue = 0;
      let completedOrdersCount = 0;
      let returnedOrdersCount = 0;
      if (allOrders) {
        allOrders.forEach((order) => {
          if (order.payment_status === 'completed') {
            totalRevenue += Number(order.total) || 0;
            completedOrdersCount += 1;
          }
          if (order.status === 'returned') {
            returnedOrdersCount += 1;
          }
        });
      }

      const averageOrderValue = completedOrdersCount > 0 ? (totalRevenue / completedOrdersCount) : 0;
      const returnRate = allOrders && allOrders.length > 0
        ? Math.round((returnedOrdersCount / allOrders.length) * 100)
        : 0;

      if (ordersData) {
        setRecentOrders(ordersData as Order[]);
      }

      // Fetch all order_items to compute top 3 products
      const { data: allOrderItems } = await supabase
        .from('order_items')
        .select('product_name, product_image, quantity, total_price');

      const productSales: Record<string, { name: string; image: string; quantity: number; revenue: number }> = {};
      if (allOrderItems) {
        allOrderItems.forEach((item) => {
          const key = item.product_name;
          if (!productSales[key]) {
            productSales[key] = {
              name: item.product_name,
              image: item.product_image,
              quantity: 0,
              revenue: 0,
            };
          }
          productSales[key].quantity += item.quantity;
          productSales[key].revenue += Number(item.total_price) || 0;
        });
      }

      const sortedTopProducts = Object.values(productSales)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 3);

      setTopProducts(sortedTopProducts);

      setStats([
        {
          label: 'Total Revenue',
          value: formatPrice(totalRevenue),
          icon: DollarSign,
          color: 'bg-success-500',
        },
        {
          label: 'Average Order Value',
          value: formatPrice(averageOrderValue),
          icon: TrendingUp,
          color: 'bg-warning-500',
        },
        {
          label: 'Total Orders',
          value: (orderCount || 0).toString(),
          icon: Package,
          color: 'bg-primary-500',
        },
        {
          label: 'Total Customers',
          value: (customerCount || 0).toString(),
          icon: Users,
          color: 'bg-accent-500',
        },
        {
          label: 'Return Metrics',
          value: `${returnedOrdersCount} returned (${returnRate}%)`,
          icon: RefreshCw,
          color: 'bg-neutral-500',
        },
      ]);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  function getStatusColor(status: string) {
    const colors: Record<string, string> = {
      pending: 'bg-warning-100 text-warning-700',
      processing: 'bg-blue-100 text-blue-700',
      shipped: 'bg-primary-100 text-primary-700',
      delivered: 'bg-success-100 text-success-700',
      cancelled: 'bg-error-100 text-error-700',
    };
    return colors[status] || 'bg-neutral-100 text-neutral-700';
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-neutral-500 mt-1">Welcome back! Here's your store overview.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-neutral-500">{stat.label}</p>
                <p className="text-2xl font-bold mt-1">{loading ? '...' : stat.value}</p>
              </div>
              <div className={cn('p-3 rounded-lg', stat.color)}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
            <h2 className="text-lg font-semibold">Recent Orders</h2>
          </div>
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {recentOrders.length === 0 ? (
              <div className="p-8 text-center text-neutral-500">
                No orders yet
              </div>
            ) : (
              recentOrders.map((order) => (
                <div key={order.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">#{order.order_number}</p>
                    <p className="text-sm text-neutral-500">
                      {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatPrice(order.total)}</p>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', getStatusColor(order.status))}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Selling Products */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
            <h2 className="text-lg font-semibold">Top Selling Products</h2>
          </div>
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {topProducts.length === 0 ? (
              <div className="p-8 text-center text-neutral-500">
                No sales data yet
              </div>
            ) : (
              topProducts.map((prod, index) => (
                <div key={prod.name} className="p-4 flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center font-bold text-neutral-500 text-sm">
                    #{index + 1}
                  </div>
                  <SafeProductImage
                    src={prod.image || '/placeholder.svg'}
                    alt={prod.name}
                    className="w-10 h-12 object-cover rounded bg-neutral-50"
                    fallbackSize="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-neutral-900 dark:text-white truncate">{prod.name}</p>
                    <p className="text-xs text-neutral-500">{prod.quantity} sold</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm text-neutral-900 dark:text-white">{formatPrice(prod.revenue)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
            <h2 className="text-lg font-semibold">Quick Actions</h2>
          </div>
          <div className="p-6 grid grid-cols-2 gap-4">
            <a
              href="/admin/products"
              className="flex flex-col items-center justify-center text-center gap-2 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:border-primary-300 transition-colors"
            >
              <ShoppingBag className="w-5 h-5 text-primary-600" />
              <span className="font-medium text-xs">Manage Products</span>
            </a>
            <a
              href="/admin/orders"
              className="flex flex-col items-center justify-center text-center gap-2 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:border-primary-300 transition-colors"
            >
              <Package className="w-5 h-5 text-primary-600" />
              <span className="font-medium text-xs">View Orders</span>
            </a>
            <a
              href="/"
              className="flex flex-col items-center justify-center text-center gap-2 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:border-primary-300 transition-colors"
            >
              <TrendingUp className="w-5 h-5 text-primary-600" />
              <span className="font-medium text-xs">View Store</span>
            </a>
            <a
              href="/shop"
              className="flex flex-col items-center justify-center text-center gap-2 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:border-primary-300 transition-colors"
            >
              <Users className="w-5 h-5 text-primary-600" />
              <span className="font-medium text-xs">Product Catalog</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
