import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Button } from '../components/ui';
import { ProductGrid } from '../components/product';
import { supabase } from '../lib/supabase';
import type { Product, ProductImage, ProductVariant } from '../types';

const categoryTitles: Record<string, string> = {
  men: "Men's Collection",
  women: "Women's Collection",
  unisex: "Unisex Styles",
};

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const [products, setProducts] = useState<Array<{
    product: Product;
    images: ProductImage[];
    variants: ProductVariant[];
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) {
      loadCategory(slug);
    }
  }, [slug]);

  async function loadCategory(categorySlug: string) {
    setLoading(true);
    try {
      const { data: productsData } = await supabase
        .from('products')
        .select('*, product_images(*), product_variants(*)')
        .eq('category', categorySlug)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(24);

      if (productsData && productsData.length > 0) {
        const productsWithDetails = productsData.map((product) => ({
          product,
          images: product.product_images || [],
          variants: product.product_variants || [],
        }));

        setProducts(productsWithDetails);
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error('Error loading category:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  const title = slug ? (categoryTitles[slug] || slug) : 'Products';

  return (
    <div>
      <section className="bg-neutral-100 dark:bg-neutral-900 py-8 md:py-12">
        <div className="container-app">
          <nav className="flex items-center gap-2 text-sm text-neutral-500 mb-4">
            <Link to="/">Home</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-neutral-900 dark:text-white">{title}</span>
          </nav>
          <h1 className="text-3xl md:text-4xl font-display font-bold">
            {title}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-2">
            Discover our curated {title.toLowerCase()} for every season
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container-app">
          <ProductGrid
            products={products}
            columns={4}
            loading={loading}
          />
          {products.length === 0 && !loading && (
            <div className="text-center py-16">
              <h2 className="text-xl font-medium mb-2">No products found</h2>
              <p className="text-neutral-500 mb-6">Try exploring our collections!</p>
              <Link to="/">
                <Button>Browse Collections</Button>
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
