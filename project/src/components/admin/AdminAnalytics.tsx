import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, DollarSign, Package, ShoppingBag, ArrowUpRight, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatPrice } from '../../lib/utils';
import { Card } from '../ui';

interface AnalyticsData {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  conversionRate: number;
  orderStatuses: { name: string; count: number; percentage: number }[];
  salesByPeriod: { period: string; amount: number }[];
  topProducts: { name: string; sold: number; revenue: number }[];
}

export default function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        setLoading(true);

        const { data: allOrders, error: ordersError } = await supabase
          .from('orders')
          .select('id, total, status, payment_status, created_at');

        if (ordersError) throw ordersError;

        let totalRevenue = 0;
        let totalOrders = allOrders?.length || 0;
        let completedOrdersCount = 0;

        const statusCounts: Record<string, number> = {
          pending: 0,
          processing: 0,
          shipped: 0,
          delivered: 0,
          cancelled: 0,
        };

        const salesByMonth: Record<string, number> = {};

        allOrders?.forEach((order) => {
          const amount = Number(order.total) || 0;
          if (order.payment_status === 'completed') {
            totalRevenue += amount;
            completedOrdersCount++;
          }

          if (order.status) {
            statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
          }

          // Group by Month
          const date = new Date(order.created_at);
          const monthYear = date.toLocaleString('default', { month: 'short', year: 'numeric' });
          salesByMonth[monthYear] = (salesByMonth[monthYear] || 0) + (order.payment_status === 'completed' ? amount : 0);
        });

        const averageOrderValue = completedOrdersCount > 0 ? totalRevenue / completedOrdersCount : 0;

        // Process order statuses
        const totalStatusTracked = Object.values(statusCounts).reduce((a, b) => a + b, 0) || 1;
        const orderStatuses = Object.entries(statusCounts).map(([name, count]) => ({
          name,
          count,
          percentage: Math.round((count / totalStatusTracked) * 100),
        }));

        // Process sales trend
        const salesByPeriod = Object.entries(salesByMonth).map(([period, amount]) => ({
          period,
          amount,
        })).slice(-6); // Last 6 months

        // Top products query
        const { data: allOrderItems } = await supabase
          .from('order_items')
          .select('product_name, quantity, total_price');

        const productSales: Record<string, { name: string; sold: number; revenue: number }> = {};
        allOrderItems?.forEach((item) => {
          const key = item.product_name;
          if (!productSales[key]) {
            productSales[key] = { name: item.product_name, sold: 0, revenue: 0 };
          }
          productSales[key].sold += item.quantity || 0;
          productSales[key].revenue += Number(item.total_price) || 0;
        });

        const topProducts = Object.values(productSales)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5);

        setData({
          totalRevenue,
          totalOrders,
          averageOrderValue,
          conversionRate: 3.2, // Static mockup indicator
          orderStatuses,
          salesByPeriod,
          topProducts,
        });

      } catch (error) {
        console.error('Error loading analytics:', error);
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, []);

  if (loading || !data) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Analytics</h1>
        <p className="text-neutral-500 mt-1 font-sans">Analyze sales patterns, conversion trends, and general order metrics.</p>
      </div>

      {/* Grid Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500">Gross Sales Revenue</p>
              <h3 className="text-2xl font-bold mt-1 text-neutral-900 dark:text-white">{formatPrice(data.totalRevenue)}</h3>
            </div>
            <div className="p-3 bg-success-50 dark:bg-success-950 text-success-600 dark:text-success-400 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-4 text-sm text-success-600">
            <TrendingUp className="w-4 h-4" />
            <span className="font-semibold">+12.4%</span>
            <span className="text-neutral-500 dark:text-neutral-400 ml-1">since last month</span>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500">Orders Received</p>
              <h3 className="text-2xl font-bold mt-1 text-neutral-900 dark:text-white">{data.totalOrders}</h3>
            </div>
            <div className="p-3 bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400 rounded-lg">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-4 text-sm text-success-600">
            <TrendingUp className="w-4 h-4" />
            <span className="font-semibold">+8.2%</span>
            <span className="text-neutral-500 dark:text-neutral-400 ml-1">since last week</span>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500">Average Order Value</p>
              <h3 className="text-2xl font-bold mt-1 text-neutral-900 dark:text-white">{formatPrice(data.averageOrderValue)}</h3>
            </div>
            <div className="p-3 bg-warning-50 dark:bg-warning-950 text-warning-600 dark:text-warning-400 rounded-lg">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-4 text-sm text-success-600">
            <TrendingUp className="w-4 h-4" />
            <span className="font-semibold">+4.1%</span>
            <span className="text-neutral-500 dark:text-neutral-400 ml-1">AOV growth</span>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500">Conversion Rate</p>
              <h3 className="text-2xl font-bold mt-1 text-neutral-900 dark:text-white">{data.conversionRate}%</h3>
            </div>
            <div className="p-3 bg-accent-50 dark:bg-accent-950 text-accent-600 dark:text-accent-400 rounded-lg">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-4 text-sm text-success-600">
            <TrendingUp className="w-4 h-4" />
            <span className="font-semibold">+2.1%</span>
            <span className="text-neutral-500 dark:text-neutral-400 ml-1">checkout conversion</span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend representation */}
        <Card className="p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4 text-neutral-900 dark:text-white">Monthly Sales Trend</h3>
          <div className="h-64 flex items-end justify-between gap-4 pt-4 border-b border-neutral-200 dark:border-neutral-800">
            {data.salesByPeriod.length === 0 ? (
              <div className="w-full text-center py-20 text-neutral-500">No trend data available</div>
            ) : (
              data.salesByPeriod.map((item) => {
                const maxAmount = Math.max(...data.salesByPeriod.map(s => s.amount)) || 1;
                const percentHeight = Math.round((item.amount / maxAmount) * 100);
                return (
                  <div key={item.period} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                    <div className="text-xs text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      {formatPrice(item.amount)}
                    </div>
                    <div
                      style={{ height: `${Math.max(10, percentHeight)}%` }}
                      className="w-full bg-primary-500 dark:bg-primary-600 hover:bg-primary-600 rounded-t transition-all cursor-pointer"
                    />
                    <div className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 truncate w-full text-center pb-2">
                      {item.period}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Order Status Breakdown */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-neutral-900 dark:text-white">Order Status</h3>
          <div className="space-y-4">
            {data.orderStatuses.map((status) => (
              <div key={status.name} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="capitalize font-medium text-neutral-700 dark:text-neutral-300">{status.name}</span>
                  <span className="text-neutral-500">{status.count} ({status.percentage}%)</span>
                </div>
                <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${status.percentage}%` }}
                    className={`h-full rounded-full ${
                      status.name === 'delivered'
                        ? 'bg-success-500'
                        : status.name === 'cancelled'
                        ? 'bg-error-500'
                        : status.name === 'shipped'
                        ? 'bg-primary-500'
                        : 'bg-warning-500'
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Top Performing Catalog Items */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Top Performing Catalog Items</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-sm font-semibold text-neutral-600 dark:text-neutral-400">
                <th className="pb-3 pl-4">Product Name</th>
                <th className="pb-3 text-center">Units Sold</th>
                <th className="pb-3 text-right pr-4">Total Revenue Generated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-sm">
              {data.topProducts.map((prod) => (
                <tr key={prod.name} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                  <td className="py-4 pl-4 font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                    {prod.name}
                    <ArrowUpRight className="w-3.5 h-3.5 text-primary-500" />
                  </td>
                  <td className="py-4 text-center font-medium">{prod.sold} items</td>
                  <td className="py-4 text-right pr-4 font-bold text-success-600">{formatPrice(prod.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
