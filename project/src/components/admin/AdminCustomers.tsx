import { useEffect, useState, useCallback } from 'react';
import { Search, Shield, ShieldAlert, Award, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToastStore } from '../../stores';
import { Input, Card } from '../ui';
import type { User } from '../../types';

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { addToast } = useToastStore();

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (searchQuery) {
        query = query.or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setCustomers((data as User[]) || []);
    } catch (error) {
      console.error('Error loading customers:', error);
      addToast({
        type: 'error',
        title: 'Error loading customers',
        message: 'Could not fetch customer profiles.',
      });
    } finally {
      setLoading(false);
    }
  }, [searchQuery, addToast]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleRoleChange = async (userId: string, newRole: 'customer' | 'admin' | 'vendor') => {
    setUpdatingId(userId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      addToast({
        type: 'success',
        title: 'Role updated successfully',
        message: `User role has been changed to ${newRole}.`,
      });
      loadCustomers();
    } catch (error: any) {
      console.error('Error updating role:', error);
      addToast({
        type: 'error',
        title: 'Failed to update role',
        message: error.message || 'Please try again.',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAdjustPoints = async (userId: string, currentPoints: number, amount: number) => {
    const newPoints = Math.max(0, currentPoints + amount);
    setUpdatingId(userId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ loyalty_points: newPoints })
        .eq('id', userId);

      if (error) throw error;

      addToast({
        type: 'success',
        title: 'Points updated successfully',
        message: `Customer points set to ${newPoints}.`,
      });
      loadCustomers();
    } catch (error: any) {
      console.error('Error adjusting points:', error);
      addToast({
        type: 'error',
        title: 'Failed to adjust points',
        message: error.message || 'Please try again.',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Customers</h1>
          <p className="text-neutral-500 mt-1">Manage user profiles, adjust loyalty points, and configure roles.</p>
        </div>
      </div>

      <Card className="p-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 text-sm font-semibold text-neutral-600 dark:text-neutral-400">
                  <th className="pb-3 pt-2 pl-4">Customer</th>
                  <th className="pb-3 pt-2">Role</th>
                  <th className="pb-3 pt-2 text-center">Loyalty Points</th>
                  <th className="pb-3 pt-2 text-right pr-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-neutral-500">
                      No customers found
                    </td>
                  </tr>
                ) : (
                  customers.map((cust) => (
                    <tr key={cust.id} className="text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                      <td className="py-4 pl-4 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-950 flex items-center justify-center font-bold text-primary-700 dark:text-primary-400">
                          {cust.full_name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <p className="font-semibold text-neutral-900 dark:text-white">{cust.full_name}</p>
                          <p className="text-xs text-neutral-500">{cust.email}</p>
                          {cust.phone && <p className="text-xs text-neutral-400 mt-0.5">{cust.phone}</p>}
                        </div>
                      </td>
                      <td className="py-4">
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium ${
                            cust.role === 'admin'
                              ? 'bg-error-100 text-error-800 dark:bg-error-950 dark:text-error-400'
                              : cust.role === 'vendor'
                              ? 'bg-warning-100 text-warning-800 dark:bg-warning-950 dark:text-warning-400'
                              : 'bg-success-100 text-success-800 dark:bg-success-950 dark:text-success-400'
                          }`}
                        >
                          {cust.role === 'admin' ? (
                            <ShieldAlert className="w-3 h-3" />
                          ) : (
                            <Shield className="w-3 h-3" />
                          )}
                          {cust.role}
                        </span>
                      </td>
                      <td className="py-4 text-center">
                        <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                          {cust.loyalty_points || 0}
                        </span>
                      </td>
                      <td className="py-4 text-right pr-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleAdjustPoints(cust.id, cust.loyalty_points || 0, 50)}
                            disabled={updatingId !== null}
                            className="p-1 text-neutral-500 hover:text-primary-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                            title="Add 50 Points"
                          >
                            <Award className="w-4 h-4" />
                          </button>
                          {cust.role === 'admin' ? (
                            <button
                              onClick={() => handleRoleChange(cust.id, 'customer')}
                              disabled={updatingId !== null}
                              className="btn btn-sm btn-outline text-error-600 hover:bg-error-50"
                            >
                              Demote
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRoleChange(cust.id, 'admin')}
                              disabled={updatingId !== null}
                              className="btn btn-sm btn-outline text-primary-600 hover:bg-primary-50"
                            >
                              Promote
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
