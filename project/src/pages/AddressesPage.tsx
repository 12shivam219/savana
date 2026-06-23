import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Edit2, MapPin, Check, ChevronRight, Home, Briefcase, ArrowLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { useToastStore } from '../stores';
import { Button, Input, Card, Checkbox, Select, Spinner } from '../components/ui';

interface Address {
  id: string;
  user_id: string;
  type: 'billing' | 'shipping';
  is_default: boolean;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  landmark: string | null;
}

const getErrorMessage = (error: any): string => {
  if (!error) return 'An unknown error occurred';
  if (error.message) {
    if (error.details) {
      return `${error.message} (${error.details})`;
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  if (typeof error === 'object') {
    return error.details || error.hint || JSON.stringify(error);
  }
  return String(error);
};

export default function AddressesPage() {
  const { user } = useAuth();
  const { addToast } = useToastStore();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  const [formData, setFormData] = useState({
    type: 'shipping' as 'billing' | 'shipping',
    full_name: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    pincode: '',
    landmark: '',
    is_default: false,
  });

  const loadAddresses = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user?.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAddresses((data as Address[]) || []);
    } catch (error) {
      console.error('Error loading addresses:', error);
      addToast({
        type: 'error',
        title: 'Failed to load addresses',
        message: getErrorMessage(error),
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, addToast]);

  useEffect(() => {
    if (user) {
      loadAddresses();
    }
  }, [user, loadAddresses]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  const handleEdit = (address: Address) => {
    setEditingAddress(address);
    setFormData({
      type: address.type,
      full_name: address.full_name,
      phone: address.phone,
      address_line1: address.address_line1,
      address_line2: address.address_line2 || '',
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      landmark: address.landmark || '',
      is_default: address.is_default,
    });
    setFormOpen(true);
  };

  const handleAddNew = () => {
    setEditingAddress(null);
    setFormData({
      type: 'shipping',
      full_name: user?.full_name || '',
      phone: user?.phone || '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      pincode: '',
      landmark: '',
      is_default: false,
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setLoading(true);

      const addressPayload = {
        user_id: user.id,
        type: formData.type,
        full_name: formData.full_name,
        phone: formData.phone,
        address_line1: formData.address_line1,
        address_line2: formData.address_line2 || null,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        country: 'India',
        landmark: formData.landmark || null,
        is_default: formData.is_default,
      };

      if (formData.is_default) {
        // If this address is set to default, we must unset other default addresses of the same type
        const { error: resetError } = await supabase
          .from('addresses')
          .update({ is_default: false })
          .eq('user_id', user.id)
          .eq('type', formData.type);

        if (resetError) throw resetError;
      }

      if (editingAddress) {
        // Update existing address
        const { error } = await supabase
          .from('addresses')
          .update(addressPayload)
          .eq('id', editingAddress.id);

        if (error) throw error;
        addToast({
          type: 'success',
          title: 'Address updated successfully',
        });
      } else {
        // Insert new address
        const { error } = await supabase
          .from('addresses')
          .insert(addressPayload);

        if (error) throw error;
        addToast({
          type: 'success',
          title: 'Address added successfully',
        });
      }

      setFormOpen(false);
      setEditingAddress(null);
      loadAddresses();
    } catch (error) {
      console.error('Error saving address:', error);
      addToast({
        type: 'error',
        title: 'Failed to save address',
        message: getErrorMessage(error),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this address?')) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('addresses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      addToast({
        type: 'success',
        title: 'Address deleted successfully',
      });
      loadAddresses();
    } catch (error) {
      console.error('Error deleting address:', error);
      addToast({
        type: 'error',
        title: 'Failed to delete address',
        message: getErrorMessage(error),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (address: Address) => {
    if (!user) return;
    try {
      setLoading(true);

      // Unset current default addresses of the same type
      const { error: resetError } = await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .eq('type', address.type);

      if (resetError) throw resetError;

      // Set this address as default
      const { error: updateError } = await supabase
        .from('addresses')
        .update({ is_default: true })
        .eq('id', address.id);

      if (updateError) throw updateError;

      addToast({
        type: 'success',
        title: 'Default address updated',
      });
      loadAddresses();
    } catch (error) {
      console.error('Error setting default address:', error);
      addToast({
        type: 'error',
        title: 'Failed to set default address',
        message: getErrorMessage(error),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-app py-8">
      <div className="max-w-3xl mx-auto">
        <nav className="flex items-center gap-2 text-sm text-neutral-500 mb-6">
          <Link to="/">Home</Link>
          <ChevronRight className="w-4 h-4" />
          <Link to="/account">Account</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-neutral-900 dark:text-white">Addresses</span>
        </nav>

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link to="/account" className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-display font-bold">Manage Addresses</h1>
              <p className="text-sm text-neutral-500">Add, edit, or delete shipping and billing addresses</p>
            </div>
          </div>
          {!formOpen && (
            <Button onClick={handleAddNew} leftIcon={<Plus className="w-4 h-4" />}>
              Add New Address
            </Button>
          )}
        </div>

        {formOpen ? (
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">
              {editingAddress ? 'Edit Address' : 'Add New Address'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Select
                  label="Address Type"
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                  options={[
                    { value: 'shipping', label: 'Shipping Address' },
                    { value: 'billing', label: 'Billing Address' },
                  ]}
                  required
                />
                <Input
                  label="Full Name"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  placeholder="Receiver's name"
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Input
                  label="Phone Number"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="10-digit mobile number"
                  required
                />
                <Input
                  label="PIN Code"
                  name="pincode"
                  value={formData.pincode}
                  onChange={handleInputChange}
                  placeholder="6-digit pincode"
                  required
                />
              </div>

              <Input
                label="Flat, House no., Building, Company, Apartment"
                name="address_line1"
                value={formData.address_line1}
                onChange={handleInputChange}
                required
              />

              <Input
                label="Area, Colony, Street, Sector, Village (optional)"
                name="address_line2"
                value={formData.address_line2}
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
                  label="Landmark (optional)"
                  name="landmark"
                  value={formData.landmark}
                  onChange={handleInputChange}
                  placeholder="e.g. Near Apollo Hospital"
                />
              </div>

              <div className="pt-2">
                <Checkbox
                  label="Set as default address"
                  description="Use this address by default for future orders"
                  name="is_default"
                  checked={formData.is_default}
                  onChange={handleCheckboxChange}
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFormOpen(false);
                    setEditingAddress(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Save Address
                </Button>
              </div>
            </form>
          </Card>
        ) : loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : addresses.length === 0 ? (
          <Card className="p-8 text-center bg-neutral-50 dark:bg-neutral-900/50">
            <MapPin className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-1">No addresses saved</h3>
            <p className="text-neutral-500 mb-6">Create an address to speed up checkout.</p>
            <Button onClick={handleAddNew} leftIcon={<Plus className="w-4 h-4" />}>
              Add Address
            </Button>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {addresses.map((address) => (
              <Card key={address.id} className="p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 capitalize">
                      {address.type === 'shipping' ? (
                        <>
                          <Home className="w-3 h-3" /> Shipping
                        </>
                      ) : (
                        <>
                          <Briefcase className="w-3 h-3" /> Billing
                        </>
                      )}
                    </span>
                    {address.is_default && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-400 rounded-full text-xs font-medium">
                        <Check className="w-3 h-3" /> Default
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-neutral-900 dark:text-white">{address.full_name}</h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">
                    {address.address_line1}
                    {address.address_line2 && `, ${address.address_line2}`}
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {address.city}, {address.state} - {address.pincode}
                  </p>
                  {address.landmark && (
                    <p className="text-sm text-neutral-500 mt-1 italic">Landmark: {address.landmark}</p>
                  )}
                  <p className="text-sm text-neutral-900 dark:text-white mt-2 font-medium">Phone: {address.phone}</p>
                </div>

                <div className="flex items-center justify-between mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(address)}
                      className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(address.id)}
                      className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-error-500 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {!address.is_default && (
                    <Button variant="ghost" size="sm" onClick={() => handleSetDefault(address)}>
                      Set as Default
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
