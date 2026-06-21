import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Truck, RefreshCw, Shield, Star, Zap, Clock, TrendingUp, Award, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui';
import { ProductGrid, CollectionCard } from '../components/product';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import type { Product, Collection, ProductImage, ProductVariant, Banner } from '../types';

export default function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState<Array<{
    product: Product;
    images: ProductImage[];
    variants: ProductVariant[];
  }>>([]);
  const [bestSellers, setBestSellers] = useState<Array<{
    product: Product;
    images: ProductImage[];
    variants: ProductVariant[];
  }>>([]);
  const [newArrivals, setNewArrivals] = useState<Array<{
    product: Product;
    images: ProductImage[];
    variants: ProductVariant[];
  }>>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [featuredRes, bestSellersRes, newArrivalsRes] = await Promise.all([
        supabase.from('products').select('*').eq('is_featured', true).eq('is_active', true).limit(4),
        supabase.from('products').select('*').eq('is_best_seller', true).eq('is_active', true).limit(4),
        supabase.from('products').select('*').eq('is_new_arrival', true).eq('is_active', true).limit(4),
      ]);

      const allProducts = [
        ...(featuredRes.data || []),
        ...(bestSellersRes.data || []),
        ...(newArrivalsRes.data || []),
      ];
      const uniqueProducts = Array.from(new Map(allProducts.map(p => [p.id, p])).values());

      if (uniqueProducts.length > 0) {
        const productIds = uniqueProducts.map((p) => p.id);
        const [imagesResult, variantsResult] = await Promise.all([
          supabase.from('product_images').select('*').in('product_id', productIds),
          supabase.from('product_variants').select('*').in('product_id', productIds),
        ]);

        const buildProductData = (products: Product[]) => products.map((product) => ({
          product,
          images: imagesResult.data?.filter((img) => img.product_id === product.id) || [],
          variants: variantsResult.data?.filter((v) => v.product_id === product.id) || [],
        }));

        setFeaturedProducts(buildProductData(featuredRes.data || []));
        setBestSellers(buildProductData(bestSellersRes.data || []));
        setNewArrivals(buildProductData(newArrivalsRes.data || []));
      }

      const { data: collectionsData } = await supabase
        .from('collections')
        .select('*')
        .eq('is_active', true)
        .limit(5);

      if (collectionsData) {
        setCollections(collectionsData);
      }

      const { data: bannersData } = await supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .eq('position', 'hero')
        .order('sort_order')
        .limit(3);

      if (bannersData) {
        setBanners(bannersData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Hero Carousel */}
      <section className="relative h-[70vh] min-h-[500px] max-h-[800px] overflow-hidden">
        {banners.length > 0 ? (
          <HeroCarousel banners={banners} />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white px-4 max-w-3xl">
                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur px-4 py-2 rounded-full text-sm mb-6">
                  <Zap className="w-4 h-4" />
                  Summer Sale — Up to 35% Off
                </div>
                <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
                  Premium Fashion<br />
                  <span className="text-primary-200">For Every Season</span>
                </h1>
                <p className="text-lg md:text-xl mb-8 text-white/80 max-w-2xl mx-auto">
                  Discover handpicked collections crafted with exceptional quality, sustainable materials, and timeless Indian design heritage.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link to="/shop">
                    <Button
                      size="lg"
                      className="bg-white text-primary-700 hover:bg-neutral-100 gap-2"
                      rightIcon={<ArrowRight className="w-5 h-5" />}
                    >
                      Shop New Arrivals
                    </Button>
                  </Link>
                  <Link to="/collection/summer-essentials">
                    <Button
                      variant="outline"
                      size="lg"
                      className="border-white/40 text-white hover:bg-white/10"
                    >
                      Explore Summer Collection
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Trust Badges */}
      <section className="bg-white dark:bg-neutral-900 py-4 border-b border-neutral-200 dark:border-neutral-800">
        <div className="container-app">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <TrustBadge
              icon={Truck}
              title="FREE Shipping"
              subtitle="Orders above INR 999"
              highlight
            />
            <TrustBadge
              icon={RefreshCw}
              title="Easy 30-Day Returns"
              subtitle="Hassle-free policy"
            />
            <TrustBadge
              icon={Shield}
              title="SSL Secure Checkout"
              subtitle="256-bit encryption"
            />
            <TrustBadge
              icon={Award}
              title="100% Authentic"
              subtitle="Genuine products only"
            />
          </div>
        </div>
      </section>

      {/* Trending Now Section */}
      <section className="section pt-12">
        <div className="container-app">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent-100 dark:bg-accent-900/30 rounded-lg">
                <TrendingUp className="w-5 h-5 text-accent-600" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-display font-bold">
                  Trending Now
                </h2>
                <p className="text-sm text-neutral-500">Most loved by our customers</p>
              </div>
            </div>
            <Link
              to="/shop"
              className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <ProductGrid products={featuredProducts} columns={4} loading={loading} />
        </div>
      </section>

      {/* Campaign Banner */}
      <section className="py-8">
        <div className="container-app">
          <div className="bg-gradient-to-r from-amber-600 via-orange-500 to-rose-500 rounded-2xl p-8 md:p-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full translate-y-1/4 -translate-x-1/4" />
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-white text-center md:text-left">
                <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur px-3 py-1 rounded-full text-sm mb-3">
                  <Clock className="w-4 h-4" /> Limited Time Offer
                </div>
                <h3 className="text-2xl md:text-3xl font-display font-bold mb-2">
                  Summer Flash Sale — Up to 35% Off
                </h3>
                <p className="text-white/80">
                  Premium linen, cotton & silk blends at unprecedented prices
                </p>
              </div>
              <Link to="/collection/summer-essentials">
                <Button
                  size="lg"
                  className="bg-white text-orange-600 hover:bg-neutral-100 gap-2"
                  rightIcon={<ArrowRight className="w-5 h-5" />}
                >
                  Shop Summer Sale
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Shop by Season */}
      <section className="section bg-neutral-50 dark:bg-neutral-900">
        <div className="container-app">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-display font-bold mb-3">
              Curated Seasonal Collections
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 max-w-xl mx-auto">
              Thoughtfully designed for India's unique climate — from humid monsoons to crisp winters and vibrant festivities.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {collections.map((collection) => (
              <CollectionCard
                key={collection.id}
                id={collection.id}
                name={collection.name}
                slug={collection.slug}
                description={collection.description}
                season={collection.season}
                imageUrl={collection.image_url}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Best Sellers */}
      {bestSellers.length > 0 && (
        <section className="section">
          <div className="container-app">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                  <Star className="w-5 h-5 text-primary-600 fill-primary-600" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-display font-bold">
                    Customer Favorites
                  </h2>
                  <p className="text-sm text-neutral-500">Top-rated & most purchased</p>
                </div>
              </div>
              <Link
                to="/shop"
                className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                View All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <ProductGrid products={bestSellers} columns={4} loading={loading} />
          </div>
        </section>
      )}

      {/* New Arrivals */}
      {newArrivals.length > 0 && (
        <section className="section bg-neutral-50 dark:bg-neutral-900">
          <div className="container-app">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success-100 dark:bg-success-900/30 rounded-lg">
                  <Zap className="w-5 h-5 text-success-600" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-display font-bold">
                    Just Dropped
                  </h2>
                  <p className="text-sm text-neutral-500">Fresh styles for the season</p>
                </div>
              </div>
              <Link
                to="/shop"
                className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                View All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <ProductGrid products={newArrivals} columns={4} loading={loading} />
          </div>
        </section>
      )}

      {/* Newsletter Signup */}
      <section className="section bg-neutral-900 text-white">
        <div className="container-app">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-display font-bold mb-4">
              Join 50,000+ Style Enthusiasts
            </h2>
            <p className="text-neutral-400 mb-8">
              Get exclusive early access to new collections, member-only sales, and personalized style recommendations.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                placeholder="Enter your email address"
                className="flex-1 px-5 py-4 rounded-xl text-neutral-900 bg-white border-2 border-transparent focus:border-primary-500 focus:outline-none"
              />
              <Button
                size="lg"
                className="bg-primary-600 hover:bg-primary-500 px-8"
              >
                Subscribe — It's Free
              </Button>
            </div>
            <p className="text-xs text-neutral-500 mt-4">
              By subscribing, you agree to our Privacy Policy. Unsubscribe anytime.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function HeroCarousel({ banners }: { banners: Banner[] }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % banners.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [banners.length]);

  return (
    <div className="relative h-full">
      {banners.map((banner, index) => (
        <div
          key={banner.id}
          className={cn(
            'absolute inset-0 transition-opacity duration-1000',
            index === current ? 'opacity-100' : 'opacity-0'
          )}
        >
          <img
            src={banner.image_url}
            alt={banner.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
          <div className="absolute inset-0 flex items-center">
            <div className="container-app">
              <div className="max-w-xl text-white">
                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur px-3 py-1 rounded-full text-sm mb-4">
                  {banner.subtitle}
                </div>
                <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight">
                  {banner.title}
                </h1>
                {banner.link_url && (
                  <Link to={banner.link_url} className="inline-block mt-4">
                    <Button
                      variant="primary"
                      size="lg"
                      rightIcon={<ArrowRight className="w-5 h-5" />}
                    >
                      {banner.button_text || 'Shop Collection'}
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Carousel Dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
        {banners.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrent(index)}
            className={cn(
              'w-8 h-1.5 rounded-full transition-all',
              index === current ? 'bg-white' : 'bg-white/40 hover:bg-white/60'
            )}
          />
        ))}
      </div>
    </div>
  );
}

function TrustBadge({ icon: Icon, title, subtitle, highlight }: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-xl transition-all',
      highlight && 'bg-primary-50 dark:bg-primary-900/20'
    )}>
      <div className={cn(
        'flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center',
        highlight ? 'bg-primary-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600'
      )}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h3 className="font-semibold text-sm text-neutral-900 dark:text-white">{title}</h3>
        <p className="text-xs text-neutral-500">{subtitle}</p>
      </div>
    </div>
  );
}
