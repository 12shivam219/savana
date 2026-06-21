import { Link, Navigate } from 'react-router-dom';
import { Package, Heart, MapPin, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Card } from '../components/ui';

export default function AccountPage() {
  const { user, signOut, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  const menuItems = [
    { icon: Package, label: 'My Orders', href: '/orders' },
    { icon: Heart, label: 'Wishlist', href: '/wishlist' },
    { icon: MapPin, label: 'Addresses', href: '/account/addresses' },
    { icon: Settings, label: 'Settings', href: '/account/settings' },
  ];

  return (
    <div className="container-app py-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-2xl font-bold text-primary-600">
            {user?.full_name?.[0] || 'U'}
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">{user?.full_name}</h1>
            <p className="text-neutral-500">{user?.email}</p>
          </div>
        </div>

        <Card className="p-6 mb-6 bg-gradient-to-r from-primary-600 to-primary-700">
          <div className="flex items-center justify-between text-white">
            <div>
              <p className="text-sm text-primary-100">Loyalty Points</p>
              <p className="text-3xl font-bold">{user?.loyalty_points || 0}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-primary-100">Earn points on every purchase</p>
              <p className="text-xs text-primary-200 mt-1">100 pts = INR 10 discount</p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {menuItems.map((item) => (
            <Link key={item.href} to={item.href}>
              <Card hover className="p-4 flex items-center gap-3">
                <item.icon className="w-5 h-5 text-primary-600" />
                <span className="font-medium">{item.label}</span>
              </Card>
            </Link>
          ))}
        </div>

        <Card className="p-4 mb-6">
          <p className="text-sm text-neutral-600 mb-2">Need help?</p>
          <p className="text-sm">
            Contact us at <span className="text-primary-600">hello@savana.in</span>
          </p>
        </Card>

        <button
          onClick={signOut}
          className="flex items-center gap-2 text-error-600 hover:text-error-700"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
