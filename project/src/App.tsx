import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Layout } from './components/layout';
import { CartDrawer } from './components/cart';
import { ToastContainer } from './components/overlays';
import { AuthProvider } from './hooks/useAuth';
import { useThemeStore } from './stores';
import { Spinner } from './components/ui';
import StaticPage from './pages/StaticPage';

// Lazy load pages for better performance
const HomePage = lazy(() => import('./pages/HomePage'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const CollectionPage = lazy(() => import('./pages/CollectionPage'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const ShopPage = lazy(() => import('./pages/ShopPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const AddressesPage = lazy(() => import('./pages/AddressesPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const WishlistPage = lazy(() => import('./pages/WishlistPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
import { AdminLayout, AdminDashboard, AdminProducts, AdminOrders } from './components/admin';

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

// Loading Fallback
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

// App wrapper with theme initialization
function AppContent() {
  const { mode } = useThemeStore();

  useEffect(() => {
    const html = document.documentElement;
    if (mode === 'dark') {
      html.classList.add('dark');
    } else if (mode === 'light') {
      html.classList.remove('dark');
    } else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }
    }
  }, [mode]);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <ScrollToTop />
        <Layout>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/shop" element={<ShopPage />} />
              <Route path="/product/:slug" element={<ProductPage />} />
              <Route path="/collection/:slug" element={<CollectionPage />} />
              <Route path="/category/:slug" element={<CategoryPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/account/addresses" element={<AddressesPage />} />
              <Route path="/account/settings" element={<SettingsPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/wishlist" element={<WishlistPage />} />
              <Route path="/about" element={<StaticPage slug="about-us" />} />
              <Route path="/contact" element={<StaticPage slug="contact" />} />
              <Route path="/faq" element={<StaticPage slug="faq" />} />
              <Route path="/shipping" element={<StaticPage slug="shipping" />} />
              <Route path="/returns" element={<StaticPage slug="returns" />} />
              <Route path="/privacy" element={<StaticPage slug="privacy" />} />
              <Route path="/terms" element={<StaticPage slug="terms" />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="products" element={<AdminProducts />} />
                <Route path="orders" element={<AdminOrders />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </Layout>
        <CartDrawer />
        <ToastContainer />
      </AuthProvider>
    </BrowserRouter>
  );
}

function App() {
  return <AppContent />;
}

export default App;
