import { useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Phone, Mail, ChevronRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToastStore } from '../stores';
import { Button, Input, Card } from '../components/ui';

export default function SettingsPage() {
  const { user, updateProfile } = useAuth();
  const { addToast } = useToastStore();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const { error } = await updateProfile({
        full_name: formData.full_name,
        phone: formData.phone || null,
      });

      if (error) throw error;

      addToast({
        type: 'success',
        title: 'Profile updated successfully',
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      addToast({
        type: 'error',
        title: 'Failed to update profile',
        message: 'Please try again',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-app py-8">
      <div className="max-w-xl mx-auto">
        <nav className="flex items-center gap-2 text-sm text-neutral-500 mb-6">
          <Link to="/">Home</Link>
          <ChevronRight className="w-4 h-4" />
          <Link to="/account">Account</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-neutral-900 dark:text-white">Settings</span>
        </nav>

        <div className="flex items-center gap-3 mb-8">
          <Link to="/account" className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-display font-bold">Account Settings</h1>
            <p className="text-sm text-neutral-500">Update your profile information</p>
          </div>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex justify-center mb-6">
              <div className="w-24 h-24 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-4xl font-bold text-primary-600">
                {formData.full_name?.[0] || 'U'}
              </div>
            </div>

            <Input
              label="Email Address"
              type="email"
              value={user?.email || ''}
              disabled
              leftElement={<Mail className="w-5 h-5" />}
              helpText="Email address cannot be changed"
            />

            <Input
              label="Full Name"
              name="full_name"
              value={formData.full_name}
              onChange={handleInputChange}
              leftElement={<User className="w-5 h-5" />}
              placeholder="Enter your name"
              required
            />

            <Input
              label="Phone Number"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleInputChange}
              leftElement={<Phone className="w-5 h-5" />}
              placeholder="e.g. +91 98765 43210"
            />

            <div className="flex justify-end pt-4">
              <Link to="/account" className="mr-3">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" variant="primary" isLoading={loading}>
                Save Changes
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
