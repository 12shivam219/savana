import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Button } from '../components/ui';
import { ProductGrid } from '../components/product';
import { supabase } from '../lib/supabase';
import type { Collection, Product, ProductImage, ProductVariant } from '../types';

export default function CollectionPage() {
  const { slug } = useParams<{ slug: string }>();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [products, setProducts] = useState<Array<{
    product: Product;
    images: ProductImage[];
    variants: ProductVariant[];
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) {
      loadCollection(slug);
    }
  }, [slug]);

  async function loadCollection(collectionSlug: string) {
    setLoading(true);
    try {
      const { data: collectionData, error } = await supabase
        .from('collections')
        .select('*')
        .eq('slug', collectionSlug)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      if (!collectionData) return;

      setCollection(collectionData);

      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .eq('collection_id', collectionData.id)
        .eq('is_active', true)
        .limit(20);

      if (productsData && productsData.length > 0) {
        const productIds = productsData.map((p) => p.id);

        const [imagesResult, variantsResult] = await Promise.all([
          supabase.from('product_images').select('*').in('product_id', productIds),
          supabase.from('product_variants').select('*').in('product_id', productIds),
        ]);

        const productsWithDetails = productsData.map((product) => ({
          product,
          images: imagesResult.data?.filter((img) => img.product_id === product.id) || [],
          variants: variantsResult.data?.filter((v) => v.product_id === product.id) || [],
        }));

        setProducts(productsWithDetails);
      }
    } catch (error) {
      console.error('Error loading collection:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container-app py-8">
        <div className="skeleton h-8 w-1/3 mb-4" />
        <div className="skeleton h-64 w-full mb-8" />
        <ProductGrid products={[]} loading />
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="container-app py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Collection Not Found</h1>
        <Link to="/">
          <Button>Go Home</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <section className="relative h-64 md:h-80 overflow-hidden">
        {collection.banner_url && (
          <img
            src={collection.banner_url}
            alt={collection.name}
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12">
          <div className="container-app">
            <nav className="flex items-center gap-2 text-sm text-white/70 mb-4">
              <Link to="/" className="hover:text-white">Home</Link>
              <ChevronRight className="w-4 h-4" />
              <span className="text-white">{collection.name}</span>
            </nav>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-2">
              {collection.name}
            </h1>
            {collection.description && (
              <p className="text-white/80 max-w-lg">
                {collection.description}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-app">
          <ProductGrid
            products={products}
            columns={4}
            loading={false}
          />
          {products.length === 0 && !loading && (
            <div className="text-center py-16">
              <h2 className="text-xl font-medium mb-2">No products found</h2>
              <p className="text-neutral-500">Check back later for new arrivals!</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
