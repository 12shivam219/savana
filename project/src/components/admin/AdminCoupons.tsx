import { useEffect, useState, useCallback } from 'react';
import { Search, Plus, Trash2, ToggleLeft, ToggleRight, Loader2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToastStore } from '../../stores';
import { Button, Input, Card, Select } from '../ui';

interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  usage_limit: number;
  used_count: number;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { addToast } = useToastStore();

  // Add Coupon Form state
  const [formData, setFormData] = useState({
    code: '',
    type: 'percentage' as 'percentage' | 'fixed',
    value: '',
    min_order_amount: '',
    max_discount_amount: '',
    usage_limit: '100',
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  const loadCoupons = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });

      if (searchQuery) {
        query = query.ilike('code', `%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setCoupons((data as Coupon[]) || []);
    } catch (error) {
      console.error('Error loading coupons:', error);
      addToast({
        type: 'error',
        title: 'Error loading coupons',
        message: 'Could not fetch coupon list.',
      });
    } finally {
      setLoading(false);
    }
  }, [searchQuery, addToast]);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  const handleToggleActive = async (couponId: string, currentStatus: boolean) => {
    setUpdatingId(couponId);
    try {
      const { error } = await supabase
        .from('coupons')
        .update({ is_active: !currentStatus })
        .eq('id', couponId);

      if (error) throw error;

      addToast({
        type: 'success',
        title: 'Coupon updated',
        message: `Coupon is now ${!currentStatus ? 'active' : 'inactive'}.`,
      });
      loadCoupons();
    } catch (error: any) {
      console.error('Error toggling coupon:', error);
      addToast({
        type: 'error',
        title: 'Failed to update coupon',
        message: error.message || 'Please try again.',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    if (!confirm('Are you sure you want to delete this coupon?')) return;
    setUpdatingId(couponId);
    try {
      const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', couponId);

      if (error) throw error;

      addToast({
        type: 'success',
        title: 'Coupon deleted',
        message: 'Coupon has been successfully removed.',
      });
      loadCoupons();
    } catch (error: any) {
      console.error('Error deleting coupon:', error);
      addToast({
        type: 'error',
        title: 'Failed to delete coupon',
        message: error.message || 'Please try again.',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formattedData = {
        code: formData.code.toUpperCase().trim(),
        type: formData.type,
        value: Number(formData.value),
        min_order_amount: Number(formData.min_order_amount) || 0,
        max_discount_amount: formData.max_discount_amount ? Number(formData.max_discount_amount) : null,
        usage_limit: Number(formData.usage_limit) || 100,
        valid_from: new Date(formData.valid_from).toISOString(),
        valid_until: new Date(formData.valid_until).toISOString(),
        is_active: true,
      };

      const { error } = await supabase
        .from('coupons')
        .insert([formattedData]);

      if (error) throw error;

      addToast({
        type: 'success',
        title: 'Coupon created',
        message: 'Successfully generated new coupon code.',
      });
      setIsModalOpen(false);
      setFormData({
        code: '',
        type: 'percentage',
        value: '',
        min_order_amount: '',
        max_discount_amount: '',
        usage_limit: '100',
        valid_from: new Date().toISOString().split('T')[0],
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
      loadCoupons();
    } catch (error: any) {
      console.error('Error creating coupon:', error);
      addToast({
        type: 'error',
        title: 'Creation failed',
        message: error.message || 'Check your input parameters.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Coupons</h1>
          <p className="text-neutral-500 mt-1">Generate discounts, set coupon rules, and toggle validity limits.</p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2"
          variant="primary"
        >
          <Plus className="w-4 h-4" /> Create Coupon
        </Button>
      </div>

      <Card className="p-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search by coupon code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {loading && coupons.length === 0 ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 text-sm font-semibold text-neutral-600 dark:text-neutral-400">
                  <th className="pb-3 pt-2 pl-4">Coupon Code</th>
                  <th className="pb-3 pt-2">Type</th>
                  <th className="pb-3 pt-2">Value</th>
                  <th className="pb-3 pt-2 text-center">Min Order Amount</th>
                  <th className="pb-3 pt-2 text-center">Redeemed / Limit</th>
                  <th className="pb-3 pt-2">Expiry Date</th>
                  <th className="pb-3 pt-2">Status</th>
                  <th className="pb-3 pt-2 text-right pr-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {coupons.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-neutral-500">
                      No coupons found
                    </td>
                  </tr>
                ) : (
                  coupons.map((coupon) => (
                    <tr key={coupon.id} className="text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                      <td className="py-4 pl-4 font-semibold text-neutral-900 dark:text-white">
                        {coupon.code}
                      </td>
                      <td className="py-4 capitalize">
                        {coupon.type}
                      </td>
                      <td className="py-4 font-semibold">
                        {coupon.type === 'percentage' ? `${coupon.value}%` : `₹${coupon.value}`}
                      </td>
                      <td className="py-4 text-center">
                        ₹{coupon.min_order_amount}
                      </td>
                      <td className="py-4 text-center">
                        {coupon.used_count} / {coupon.usage_limit}
                      </td>
                      <td className="py-4">
                        {new Date(coupon.valid_until).toLocaleDateString()}
                      </td>
                      <td className="py-4">
                        <button
                          onClick={() => handleToggleActive(coupon.id, coupon.is_active)}
                          disabled={updatingId !== null}
                          className="text-neutral-500 transition-colors"
                        >
                          {coupon.is_active ? (
                            <ToggleRight className="w-9 h-6 text-success-600" />
                          ) : (
                            <ToggleLeft className="w-9 h-6 text-neutral-400" />
                          )}
                        </button>
                      </td>
                      <td className="py-4 text-right pr-4">
                        <button
                          onClick={() => handleDeleteCoupon(coupon.id)}
                          disabled={updatingId !== null}
                          className="p-1 text-neutral-500 hover:text-error-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                          title="Delete Coupon"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create Coupon Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg p-6 bg-white dark:bg-neutral-900 shadow-elevated relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-neutral-500 hover:text-neutral-700"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold mb-4">Create New Coupon</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Coupon Code"
                name="code"
                placeholder="e.g. WELCOME20"
                value={formData.code}
                onChange={handleInputChange}
                required
              />

              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Discount Type"
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                  options={[
                    { value: 'percentage', label: 'Percentage' },
                    { value: 'fixed', label: 'Fixed Value' },
                  ]}
                  required
                />
                <Input
                  label="Value"
                  name="value"
                  type="number"
                  placeholder="e.g. 15"
                  value={formData.value}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Min Order Amount"
                  name="min_order_amount"
                  type="number"
                  placeholder="e.g. 999"
                  value={formData.min_order_amount}
                  onChange={handleInputChange}
                  required
                />
                <Input
                  label="Usage Limit"
                  name="usage_limit"
                  type="number"
                  placeholder="e.g. 500"
                  value={formData.usage_limit}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Valid From"
                  name="valid_from"
                  type="date"
                  value={formData.valid_from}
                  onChange={handleInputChange}
                  required
                />
                <Input
                  label="Valid Until"
                  name="valid_until"
                  type="date"
                  value={formData.valid_until}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={loading}>
                  Save Coupon
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
