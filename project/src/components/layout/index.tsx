import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  Search,
  ShoppingBag,
  Heart,
  User,
  Menu,
  X,
  Sun,
  Moon,
  ChevronDown,
  MapPin,
  Shield,
} from 'lucide-react';
import { cn, FREE_SHIPPING_THRESHOLD } from '../../lib/utils';
import { Button } from '../ui';
import { useCartStore, useWishlistStore, useUIStore, useThemeStore } from '../../stores';
import { useAuth } from '../../hooks/useAuth';

const seasons = [
  { name: 'Summer', slug: 'summer', color: 'bg-amber-500' },
  { name: 'Monsoon', slug: 'monsoon', color: 'bg-blue-500' },
  { name: 'Autumn', slug: 'autumn', color: 'bg-orange-500' },
  { name: 'Winter', slug: 'winter', color: 'bg-slate-600' },
  { name: 'Festive', slug: 'festive', color: 'bg-rose-500' },
];

const categories = [
  { name: 'Men', slug: 'men' },
  { name: 'Women', slug: 'women' },
  { name: 'Unisex', slug: 'unisex' },
];

export function Header() {
  const location = useLocation();
  const { user } = useAuth();
  const { getItemCount } = useCartStore();
  const { productIds } = useWishlistStore();
  const { isMobileMenuOpen, setMobileMenuOpen, setSearchOpen, setCartOpen } = useUIStore();
  const { mode, toggleTheme } = useThemeStore();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, setMobileMenuOpen]);

  const itemCount = getItemCount();
  const wishlistCount = productIds.length;

  return (
    <>
      <div className="bg-primary-700 text-white text-sm py-2 px-4 text-center">
        <p>Free shipping on orders above INR {FREE_SHIPPING_THRESHOLD} | Use code WELCOME10 for 10% off</p>
      </div>

      <header
        className={cn(
          'sticky top-0 z-40 transition-all duration-300',
          isScrolled
            ? 'bg-white/95 dark:bg-neutral-950/95 backdrop-blur-lg shadow-soft'
            : 'bg-white dark:bg-neutral-950'
        )}
      >
        <div className="container-app">
          <div className="flex items-center justify-between h-16">
            <button
              className="lg:hidden p-2 -ml-2"
              onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            <Link to="/" className="flex items-center gap-2">
              <span className="font-display text-2xl font-bold text-primary-600 dark:text-primary-400">
                SAVANA
              </span>
            </Link>

            <nav className="hidden lg:flex items-center gap-8">
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  to={`/category/${cat.slug}`}
                  className="text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                >
                  {cat.name}
                </Link>
              ))}
              <div className="relative group">
                <button className="flex items-center gap-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Collections
                  <ChevronDown className="w-4 h-4" />
                </button>
                <div className="absolute top-full left-0 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <div className="dropdown">
                    {seasons.map((season) => (
                      <Link
                        key={season.slug}
                        to={`/collection/${season.slug}`}
                        className="dropdown-item flex items-center gap-2"
                      >
                        <span className={cn('w-2 h-2 rounded-full', season.color)} />
                        {season.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </nav>

            <div className="flex items-center gap-2">
              <button
                className="p-2 text-neutral-700 dark:text-neutral-300 hover:text-primary-600"
                onClick={() => setSearchOpen(true)}
              >
                <Search className="w-5 h-5" />
              </button>

              <button
                className="p-2 text-neutral-700 dark:text-neutral-300 hover:text-primary-600"
                onClick={toggleTheme}
              >
                {mode === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <Link
                to="/wishlist"
                className="hidden sm:flex p-2 text-neutral-700 dark:text-neutral-300 hover:text-primary-600 relative"
              >
                <Heart className="w-5 h-5" />
                {wishlistCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent-500 text-white text-xs rounded-full flex items-center justify-center">
                    {wishlistCount}
                  </span>
                )}
              </Link>

              <button
                className="p-2 text-neutral-700 dark:text-neutral-300 hover:text-primary-600 relative"
                onClick={() => setCartOpen(true)}
              >
                <ShoppingBag className="w-5 h-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center">
                    {itemCount}
                  </span>
                )}
              </button>

              {user?.role === 'admin' && (
                <Link
                  to="/admin"
                  className="hidden sm:flex items-center gap-2 rounded-full border border-primary-600/20 bg-primary-50 px-3 py-2 text-sm font-medium text-primary-700 hover:bg-primary-100 dark:bg-primary-950/40 dark:text-primary-300 dark:hover:bg-primary-900/60"
                >
                  <Shield className="w-4 h-4" />
                  Admin
                </Link>
              )}

              {user ? (
                <Link
                  to="/account"
                  className="hidden sm:flex p-2 text-neutral-700 dark:text-neutral-300 hover:text-primary-600"
                >
                  <User className="w-5 h-5" />
                </Link>
              ) : (
                <Link to="/login" className="hidden sm:block">
                  <Button variant="outline" size="sm">
                    Sign In
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-neutral-200 dark:border-neutral-800">
            <nav className="container-app py-4 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {seasons.map((season) => (
                  <Link
                    key={season.slug}
                    to={`/collection/${season.slug}`}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-white text-sm font-medium',
                      season.color
                    )}
                  >
                    {season.name}
                  </Link>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                {categories.map((cat) => (
                  <Link
                    key={cat.slug}
                    to={`/category/${cat.slug}`}
                    className="flex items-center justify-between py-2 text-neutral-700 dark:text-neutral-300"
                  >
                    {cat.name}
                    <ChevronDown className="w-4 h-4 -rotate-90" />
                  </Link>
                ))}
              </div>
              <div className="flex items-center gap-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <Link
                  to="/wishlist"
                  className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300"
                >
                  <Heart className="w-5 h-5" />
                  Wishlist ({wishlistCount})
                </Link>
              </div>

              {user?.role === 'admin' && (
                <Link
                  to="/admin"
                  className="flex items-center gap-2 rounded-lg bg-primary-50 px-3 py-2 text-sm font-medium text-primary-700 dark:bg-primary-950/40 dark:text-primary-300"
                >
                  <Shield className="w-4 h-4" />
                  Admin Panel
                </Link>
              )}
            </nav>
          </div>
        )}
      </header>
    </>
  );
}

export function SearchOverlay() {
  const { isSearchOpen, setSearchOpen } = useUIStore();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isSearchOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSearchOpen]);

  if (!isSearchOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setSearchOpen(false);
      setQuery('');
    }
  };

  return (
    <div
      className="fixed z-modal inset-0 bg-black/50 backdrop-blur-sm"
      onClick={() => setSearchOpen(false)}
    >
      <div
        className="max-w-2xl mx-auto mt-20 px-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-elevated p-4">
          <form onSubmit={handleSubmit} className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for products, collections..."
              className="input pl-12 text-lg"
            />
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400"
            >
              <X className="w-5 h-5" />
            </button>
          </form>
          <div className="mt-4">
            <p className="text-sm text-neutral-500 mb-3">Popular Searches</p>
            <div className="flex flex-wrap gap-2">
              {['Linen Shirt', 'Maxi Dress', 'Summer Collection', 'Festive Wear'].map((term) => (
                <Link
                  key={term}
                  to={`/search?q=${encodeURIComponent(term)}`}
                  className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                  onClick={() => setSearchOpen(false)}
                >
                  {term}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="bg-neutral-900 text-white">
      <div className="border-b border-neutral-800">
        <div className="container-app py-12">
          <div className="max-w-xl mx-auto text-center">
            <h3 className="text-2xl font-display font-bold mb-2">
              Join the SAVANA Family
            </h3>
            <p className="text-neutral-400 mb-6">
              Subscribe for exclusive access to new arrivals, special offers, and style tips.
            </p>
            <form className="flex gap-2">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 rounded-lg bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <Button variant="primary">Subscribe</Button>
            </form>
          </div>
        </div>
      </div>

      <div className="container-app py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h4 className="font-semibold mb-4">Shop</h4>
            <ul className="space-y-2 text-neutral-400">
              <li>
                <Link to="/category/men" className="hover:text-white">Men</Link>
              </li>
              <li>
                <Link to="/category/women" className="hover:text-white">Women</Link>
              </li>
              <li>
                <Link to="/category/unisex" className="hover:text-white">Unisex</Link>
              </li>
              <li>
                <Link to="/collection/summer" className="hover:text-white">Summer Collection</Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Help</h4>
            <ul className="space-y-2 text-neutral-400">
              <li><Link to="/faq" className="hover:text-white">FAQs</Link></li>
              <li><Link to="/shipping" className="hover:text-white">Shipping Info</Link></li>
              <li><Link to="/returns" className="hover:text-white">Returns & Exchanges</Link></li>
              <li><Link to="/contact" className="hover:text-white">Contact Us</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-neutral-400">
              <li><Link to="/about" className="hover:text-white">About SAVANA</Link></li>
              <li><Link to="/privacy" className="hover:text-white">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-white">Terms of Service</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <ul className="space-y-2 text-neutral-400 text-sm">
              <li>hello@savana.in</li>
              <li>+91 98765 43210</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-neutral-800">
        <div className="container-app py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="font-display text-xl font-bold text-primary-400">SAVANA</span>
              <span className="text-neutral-500 text-sm">Embrace Every Season in Style</span>
            </div>
            <div className="flex items-center gap-2 text-neutral-400 text-sm">
              <MapPin className="w-4 h-4" />
              Made with love in India
            </div>
            <p className="text-neutral-500 text-sm">
              {new Date().getFullYear()} SAVANA Fashion Pvt. Ltd.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-4 text-neutral-500 text-xs">
            <span>GST: 27AANCS1234B1Z5</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function Layout({ children }: { children?: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <SearchOverlay />
      <main className="flex-1">{children || <Outlet />}</main>
      <Footer />
    </div>
  );
}
