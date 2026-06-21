import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { Button, EmptyState } from '../components/ui';
import { ProductGrid } from '../components/product';
import { useWishlistStore } from '../stores';
import { supabase } from '../lib/supabase';
import type { Product, ProductImage, ProductVariant } from '../types';

export default function WishlistPage() {
  const { productIds } = useWishlistStore();
  const [products, setProducts] = useState<Array<{
    product: Product;
    images: ProductImage[];
    variants: ProductVariant[];
  }>>([]);

  const loadWishlistProducts = useCallback(async () => {
    try {
      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .in('id', productIds)
        .eq('is_active', true);

      if (productsData && productsData.length > 0) {
        const ids = productsData.map((p) => p.id);
        const [imagesResult, variantsResult] = await Promise.all([
          supabase.from('product_images').select('*').in('product_id', ids),
          supabase.from('product_variants').select('*').in('product_id', ids),
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
    } catch (error) {
      console.error('Error loading wishlist:', error);
    }
  }, [productIds]);

  useEffect(() => {
    if (productIds.length > 0) {
      loadWishlistProducts();
    } else {
      setProducts([]);
    }
  }, [productIds, loadWishlistProducts]);

  if (productIds.length === 0) {
    return (
      <div className="container-app py-16">
        <EmptyState
          icon={<Heart className="w-16 h-16" />}
          title="Your wishlist is empty"
          description="Save items you love for later by clicking the heart icon"
          action={
            <Link to="/">
              <Button>Start Shopping</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="container-app py-8">
      <h1 className="text-2xl font-display font-bold mb-2">My Wishlist</h1>
      <p className="text-neutral-600 dark:text-neutral-400 mb-8">
        {productIds.length} items saved
      </p>
      <ProductGrid products={products} columns={4} />
    </div>
  );
}
