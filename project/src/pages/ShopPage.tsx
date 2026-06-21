import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '../components/ui';
import { ProductGrid } from '../components/product';
import { supabase } from '../lib/supabase';
import type { Product, ProductImage, ProductVariant, Collection } from '../types';

export default function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Array<{
    product: Product;
    images: ProductImage[];
    variants: ProductVariant[];
  }>>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const selectedCollection = searchParams.get('collection') || '';
  const selectedCategory = searchParams.get('category') || '';
  const sortBy = searchParams.get('sort') || 'newest';
  const inStockOnly = searchParams.get('inStock') === 'true';

  const [maxPrice, setMaxPrice] = useState(() => {
    const val = searchParams.get('maxPrice');
    return val ? Number(val) : 30000;
  });

  // Sync price slider state with URL search parameters changes (like Clear all)
  useEffect(() => {
    const val = searchParams.get('maxPrice');
    setMaxPrice(val ? Number(val) : 30000);
  }, [searchParams]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: productsData, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .limit(200);

      if (error) throw error;

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
      } else {
        setProducts([]);
      }

      const { data: collectionsData } = await supabase
        .from('collections')
        .select('*')
        .eq('is_active', true);

      if (collectionsData) {
        setCollections(collectionsData);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Error loading shop data:', message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function updateFilter(key: string, value: string | null) {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  }

  const handlePriceChange = (value: number) => {
    setMaxPrice(value);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('maxPrice', value.toString());
    setSearchParams(newParams, { replace: true });
  };

  function clearFilters() {
    setSearchParams(new URLSearchParams({ sort: sortBy }));
    setMaxPrice(30000);
  }

  // Memoized in-memory filtering and sorting
  const filteredProducts = useMemo(() => {
    return products
      .filter(({ product, variants }) => {
        // 1. Category Filter
        if (selectedCategory && product.category !== selectedCategory) {
          return false;
        }

        // 2. Collection Filter
        if (selectedCollection && product.collection_id !== selectedCollection) {
          return false;
        }

        // 3. Price Filter (checking sale_price if present, else base_price)
        const price = product.sale_price !== null && product.sale_price !== undefined
          ? product.sale_price
          : product.base_price;
        if (price > maxPrice) {
          return false;
        }

        // 4. Stock Filter (hide out-of-stock)
        if (inStockOnly) {
          const totalStock = variants.reduce((sum, v) => sum + v.inventory_quantity, 0);
          if (totalStock === 0) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        // 5. Sorting
        const aPrice = a.product.sale_price !== null && a.product.sale_price !== undefined
          ? a.product.sale_price
          : a.product.base_price;
        const bPrice = b.product.sale_price !== null && b.product.sale_price !== undefined
          ? b.product.sale_price
          : b.product.base_price;

        if (sortBy === 'price-low') {
          return aPrice - bPrice;
        }
        if (sortBy === 'price-high') {
          return bPrice - aPrice;
        }
        if (sortBy === 'name') {
          return a.product.name.localeCompare(b.product.name);
        }
        // default: newest
        return new Date(b.product.created_at).getTime() - new Date(a.product.created_at).getTime();
      });
  }, [products, selectedCategory, selectedCollection, maxPrice, inStockOnly, sortBy]);

  const activeFilters = [
    selectedCollection && 'collection',
    selectedCategory && 'category',
    inStockOnly && 'instock',
    maxPrice < 30000 && 'price',
  ].filter(Boolean);

  return (
    <div>
      <section className="bg-neutral-100 dark:bg-neutral-900 py-8 md:py-12">
        <div className="container-app">
          <nav className="flex items-center gap-2 text-sm text-neutral-500 mb-4">
            <Link to="/">Home</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-neutral-900 dark:text-white">Shop</span>
          </nav>
          <h1 className="text-3xl md:text-4xl font-display font-bold">
            All Products
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-2">
            Explore our complete collection for every season
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container-app">
          <div className="flex flex-col md:flex-row gap-6 md:gap-8">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="md:hidden flex items-center justify-center gap-2 py-3 border border-neutral-300 dark:border-neutral-700 rounded-lg"
            >
              <SlidersHorizontal className="w-5 h-5" />
              Filters
              {activeFilters.length > 0 && (
                <span className="bg-primary-600 text-white text-xs px-2 py-0.5 rounded-full">
                  {activeFilters.length}
                </span>
              )}
            </button>

            <aside className={`
              ${showFilters ? 'block' : 'hidden'}
              md:block w-full md:w-64 flex-shrink-0
            `}>
              <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 border border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">Filters</h3>
                  {activeFilters.length > 0 && (
                    <button
                      onClick={clearFilters}
                      className="text-sm text-primary-600 hover:underline"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                <div className="space-y-6">
                  {/* Category Filter */}
                  <div>
                    <h4 className="text-sm font-medium mb-3">Category</h4>
                    <div className="space-y-2">
                      {['men', 'women', 'unisex'].map((cat) => (
                        <label
                          key={cat}
                          className="flex items-center gap-2 cursor-pointer select-none"
                        >
                          <input
                            type="radio"
                            name="category"
                            checked={selectedCategory === cat}
                            onChange={() => updateFilter('category', selectedCategory === cat ? null : cat)}
                            className="w-4 h-4 text-primary-600"
                          />
                          <span className="text-sm capitalize">{cat}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Collection Filter */}
                  <div>
                    <h4 className="text-sm font-medium mb-3">Collection</h4>
                    <div className="space-y-2">
                      {collections.map((col) => (
                        <label
                          key={col.id}
                          className="flex items-center gap-2 cursor-pointer select-none"
                        >
                          <input
                            type="radio"
                            name="collection"
                            checked={selectedCollection === col.id}
                            onChange={() => updateFilter('collection', selectedCollection === col.id ? null : col.id)}
                            className="w-4 h-4 text-primary-600"
                          />
                          <span className="text-sm">{col.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Price Filter */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-medium">Max Price</h4>
                      <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                        {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(maxPrice)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="30000"
                      step="500"
                      value={maxPrice}
                      onChange={(e) => handlePriceChange(Number(e.target.value))}
                      className="w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-primary-600"
                    />
                    <div className="flex justify-between text-[10px] text-neutral-400 mt-1">
                      <span>₹0</span>
                      <span>₹15,000</span>
                      <span>₹30,000+</span>
                    </div>
                  </div>

                  {/* Stock Availability */}
                  <div>
                    <h4 className="text-sm font-medium mb-3">Availability</h4>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={inStockOnly}
                        onChange={(e) => updateFilter('inStock', e.target.checked ? 'true' : null)}
                        className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-700 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-neutral-700 dark:text-neutral-300">Hide Out of Stock</span>
                    </label>
                  </div>

                  {/* Sort By */}
                  <div>
                    <h4 className="text-sm font-medium mb-3">Sort By</h4>
                    <select
                      value={sortBy}
                      onChange={(e) => updateFilter('sort', e.target.value)}
                      className="w-full border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900"
                    >
                      <option value="newest">Newest Arrivals</option>
                      <option value="price-low">Price: Low to High</option>
                      <option value="price-high">Price: High to Low</option>
                      <option value="name">Product Name (A-Z)</option>
                    </select>
                  </div>
                </div>
              </div>
            </aside>

            <div className="flex-1">
              {activeFilters.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedCollection && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-full text-sm">
                      {collections.find((c) => c.id === selectedCollection)?.name}
                      <button onClick={() => updateFilter('collection', null)}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {selectedCategory && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-full text-sm">
                      {selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)}
                      <button onClick={() => updateFilter('category', null)}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {inStockOnly && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-full text-sm">
                      In Stock Only
                      <button onClick={() => updateFilter('inStock', null)}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {maxPrice < 30000 && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-full text-sm">
                      Under {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(maxPrice)}
                      <button onClick={() => {
                        const newParams = new URLSearchParams(searchParams);
                        newParams.delete('maxPrice');
                        setSearchParams(newParams);
                        setMaxPrice(30000);
                      }}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>
              )}

              <ProductGrid products={filteredProducts} columns={3} loading={loading} />

              {filteredProducts.length === 0 && !loading && (
                <div className="text-center py-16">
                  <h2 className="text-xl font-medium mb-2">No products found</h2>
                  <p className="text-neutral-500 mb-6">Try adjusting your filters</p>
                  <Button variant="outline" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
