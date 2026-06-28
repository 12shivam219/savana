import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Button } from '../components/ui';
import { ProductGrid } from '../components/product';
import { supabase } from '../lib/supabase';
import type { Product, ProductImage, ProductVariant } from '../types';

const safeDecodeURIComponent = (str: string) => {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
};

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [inputQuery, setInputQuery] = useState('');
  const [products, setProducts] = useState<Array<{
    product: Product;
    images: ProductImage[];
    variants: ProductVariant[];
  }>>([]);

  useEffect(() => {
    const decoded = safeDecodeURIComponent(query);
    setInputQuery(decoded);
    if (decoded) {
      searchProducts(decoded);
    } else {
      setProducts([]);
    }
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputQuery.trim()) {
      setSearchParams({ q: encodeURIComponent(inputQuery.trim()) });
    }
  };

  async function searchProducts(searchQuery: string) {
    try {
      const decodedQuery = safeDecodeURIComponent(searchQuery);
      const { data: productsData } = await (supabase
        .rpc('search_products', { p_query: decodedQuery })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .select('*, product_images(*), product_variants(*)') as any)
        .eq('is_active', true)
        .limit(20);

      if (productsData && productsData.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const productsWithDetails = productsData.map((product: any) => ({
          product,
          images: product.product_images || [],
          variants: product.product_variants || [],
        }));

        setProducts(productsWithDetails);
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error('Error searching products:', error);
      setProducts([]);
    }
  }

  return (
    <div className="container-app py-8">
      <nav className="flex items-center gap-2 text-sm text-neutral-500 mb-6">
        <Link to="/">Home</Link>
        <span className="text-neutral-900 dark:text-white">Search</span>
      </nav>

      <div className="max-w-2xl mx-auto mb-12">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Search for products..."
              className="input pl-12 text-lg"
            />
          </div>
          <Button type="submit" variant="primary" size="lg">
            Search
          </Button>
        </form>
      </div>

      {query && (
        <>
          <h1 className="text-2xl font-display font-bold mb-2">
            {products.length > 0
              ? `Found ${products.length} results for "${safeDecodeURIComponent(query)}"`
              : `No results for "${safeDecodeURIComponent(query)}"`}
          </h1>

          <div className="mt-8">
            <ProductGrid products={products} columns={4} />
          </div>

          {products.length === 0 && (
            <div className="text-center py-8">
              <p className="text-neutral-500 mb-6">
                Try different keywords or browse our collections
              </p>
              <Link to="/">
                <Button variant="outline">Browse Collections</Button>
              </Link>
            </div>
          )}
        </>
      )}

      {!query && (
        <div className="text-center py-16">
          <h2 className="text-xl font-medium mb-2">What are you looking for?</h2>
          <p className="text-neutral-500">
            Search for products by name, category, or style
          </p>
        </div>
      )}
    </div>
  );
}
