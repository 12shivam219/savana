import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Heart,
  Share2,
  Truck,
  RefreshCw,
  Shield,
  ChevronDown,
  Check,
  ImageIcon,
  Zap,
  Award,
  CreditCard,
} from 'lucide-react';
import { Button, Badge, PriceTag, Skeleton } from '../components/ui';
import { QuantitySelector, ColorSelector, SizeSelector } from '../components/product';
import { useCartStore, useWishlistStore, useToastStore } from '../stores';
import { supabase } from '../lib/supabase';
import { cn, FREE_SHIPPING_THRESHOLD } from '../lib/utils';
import type { Product, ProductImage, ProductVariant } from '../types';

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());

  const { addItem } = useCartStore();
  const { toggleWishlist, isInWishlist } = useWishlistStore();
  const { addToast } = useToastStore();

  useEffect(() => {
    if (slug) {
      loadProduct(slug);
    }
  }, [slug]);

  async function loadProduct(productSlug: string) {
    setLoading(true);
    try {
      const { data: productData, error } = await supabase
        .from('products')
        .select('*')
        .eq('slug', productSlug)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      if (!productData) return;

      setProduct(productData);

      const [imagesResult, variantsResult] = await Promise.all([
        supabase.from('product_images').select('*').eq('product_id', productData.id).order('sort_order'),
        supabase.from('product_variants').select('*').eq('product_id', productData.id),
      ]);

      setImages(imagesResult.data || []);
      setVariants(variantsResult.data || []);

      if (variantsResult.data && variantsResult.data.length > 0) {
        const firstVariant = variantsResult.data[0];
        setSelectedSize(firstVariant.size);
        setSelectedColor(firstVariant.color);
      }
    } catch (error) {
      console.error('Error loading product:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container-app py-8">
        {/* Breadcrumb skeleton */}
        <div className="flex items-center gap-2 mb-6">
          <Skeleton className="h-4 w-16" />
          <span className="text-neutral-300">/</span>
          <Skeleton className="h-4 w-24" />
          <span className="text-neutral-300">/</span>
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Image gallery skeleton */}
          <div className="space-y-4">
            <Skeleton className="aspect-[3/4] rounded-xl" />
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="w-16 h-20 rounded-lg" />
              ))}
            </div>
          </div>
          {/* Product info skeleton */}
          <div className="space-y-6">
            <div className="space-y-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-28" />
            </div>
            <Skeleton className="h-16 w-full rounded" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
            <div className="space-y-3 pt-4">
              <Skeleton variant="circular" className="h-10 w-40" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container-app py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Product Not Found</h1>
        <p className="text-neutral-600 mb-6">
          The product you're looking for doesn't exist or has been removed.
        </p>
        <Link to="/">
          <Button variant="primary">Continue Shopping</Button>
        </Link>
      </div>
    );
  }

  const isWishlisted = isInWishlist(product.id);
  const availableSizes = [...new Set(variants.map((v) => v.size))];
  const availableColors = Array.from(new Set(variants.map((v) => v.color))).map((color) => {
    const variant = variants.find((v) => v.color === color);
    return {
      name: color,
      code: variant?.color_code || '#ccc',
      available: variants.some((v) => v.color === color && v.is_in_stock),
    };
  });

  const selectedVariant = variants.find(
    (v) => v.size === selectedSize && v.color === selectedColor
  );

  const handleAddToCart = () => {
    if (!selectedVariant) {
      addToast({
        type: 'warning',
        title: 'Please select size and color',
      });
      return;
    }

    addItem(product, selectedVariant, quantity);
    addToast({
      type: 'success',
      title: 'Added to cart',
      message: `${quantity} x ${product.name} (${selectedSize}, ${selectedColor})`,
    });
  };

  const handleToggleWishlist = () => {
    toggleWishlist(product.id);
    addToast({
      type: isWishlisted ? 'info' : 'success',
      title: isWishlisted ? 'Removed from wishlist' : 'Added to wishlist',
    });
  };

  return (
    <div className="container-app py-8">
      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
        <div className="space-y-4">
          <div className="relative aspect-[3/4] bg-neutral-100 dark:bg-neutral-800 rounded-xl overflow-hidden">
            {images[selectedImage] && !imageErrors.has(selectedImage) ? (
              <img
                src={images[selectedImage].url || '/placeholder.svg'}
                alt={images[selectedImage].alt || product.name}
                className="w-full h-full object-cover"
                onError={() => setImageErrors(prev => new Set(prev).add(selectedImage))}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-neutral-400">
                <ImageIcon className="w-16 h-16 mb-2" />
                <span className="text-sm">Image unavailable</span>
              </div>
            )}

            <div className="absolute top-4 left-4 flex flex-col gap-2">
              {product.sale_price && product.sale_price < product.base_price && (
                <Badge variant="accent">
                  {Math.round(((product.base_price - product.sale_price) / product.base_price) * 100)}% OFF
                </Badge>
              )}
              {product.is_new_arrival && <Badge variant="primary">New</Badge>}
              {product.is_limited_edition && <Badge variant="secondary">Limited</Badge>}
            </div>

            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <button
                onClick={handleToggleWishlist}
                className={cn(
                  'w-10 h-10 rounded-full backdrop-blur-sm flex items-center justify-center transition-all',
                  isWishlisted
                    ? 'bg-accent-500 text-white'
                    : 'bg-white/90 dark:bg-neutral-900/90 text-neutral-700 dark:text-neutral-300 hover:text-accent-500'
                )}
              >
                <Heart className={cn('w-5 h-5', isWishlisted && 'fill-current')} />
              </button>
              <button className="w-10 h-10 rounded-full bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm flex items-center justify-center text-neutral-700 dark:text-neutral-300 hover:text-primary-600">
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  onClick={() => setSelectedImage(index)}
                  className={cn(
                    'flex-shrink-0 w-16 h-20 rounded-lg overflow-hidden border-2 transition-all',
                    selectedImage === index
                      ? 'border-primary-600'
                      : 'border-transparent hover:border-neutral-300'
                  )}
                >
                  {!imageErrors.has(index) ? (
                    <img
                      src={image.url || '/placeholder.svg'}
                      alt={image.alt || product.name}
                      className="w-full h-full object-cover"
                      onError={() => setImageErrors(prev => new Set(prev).add(index))}
                    />
                  ) : (
                    <div className="w-full h-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-neutral-400" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-sm text-primary-600 dark:text-primary-400 font-medium uppercase mb-1">
              {product.category} {product.subcategory && `/ ${product.subcategory}`}
            </p>
            <h1 className="text-3xl font-display font-bold mb-2">{product.name}</h1>
          </div>

          <PriceTag
            price={product.base_price}
            salePrice={product.sale_price}
            size="lg"
            currency={product.currency}
          />

          <p className="text-neutral-600 dark:text-neutral-400">
            {product.short_description || product.description}
          </p>

          {availableColors.length > 0 && (
            <ColorSelector
              colors={availableColors}
              selectedColor={selectedColor}
              onSelect={(color) => {
                setSelectedColor(color);
                const variant = variants.find((v) => v.color === color && v.size === selectedSize);
                if (!variant) {
                  const firstSizeForColor = variants.find((v) => v.color === color);
                  if (firstSizeForColor) {
                    setSelectedSize(firstSizeForColor.size);
                  }
                }
              }}
            />
          )}

          {availableSizes.length > 0 && (
            <SizeSelector
              sizes={availableSizes}
              selectedSize={selectedSize}
              onSelect={(size) => {
                setSelectedSize(size);
                const variant = variants.find((v) => v.size === size && v.color === selectedColor);
                if (!variant) {
                  const firstColorForSize = variants.find((v) => v.size === size);
                  if (firstColorForSize) {
                    setSelectedColor(firstColorForSize.color);
                  }
                }
              }}
            />
          )}

          {selectedVariant && (
            <div className="flex items-center gap-2 flex-wrap">
              {selectedVariant.inventory_quantity > 0 ? (
                <>
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-400 rounded text-xs font-medium">
                    <Check className="w-3 h-3" /> In Stock
                  </span>
                  {selectedVariant.inventory_quantity <= selectedVariant.low_stock_threshold && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-warning-50 dark:bg-warning-900/20 text-warning-700 dark:text-warning-400 rounded text-xs font-medium">
                      <Zap className="w-3 h-3" /> Only {selectedVariant.inventory_quantity} left — Order soon!
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 rounded text-xs">
                    <Truck className="w-3 h-3" /> Eligible for FREE Shipping
                  </span>
                </>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded text-xs font-medium">
                  Out of Stock — Notify Me
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Quantity</span>
            <QuantitySelector
              value={quantity}
              onChange={setQuantity}
              max={selectedVariant?.inventory_quantity ?? 10}
              disabled={!selectedVariant}
            />
          </div>

          <div className="space-y-4">
            <div className="flex gap-3">
              <Button
                variant="primary"
                size="lg"
                className="flex-1"
                onClick={handleAddToCart}
                disabled={!selectedVariant || selectedVariant.inventory_quantity === 0}
              >
                Add to Cart
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="flex-shrink-0 border-primary-600 text-primary-600 hover:bg-primary-50"
                onClick={() => {
                  handleAddToCart();
                }}
              >
                Buy Now
              </Button>
            </div>
            <p className="text-xs text-neutral-500 text-center flex items-center justify-center gap-2">
              <CreditCard className="w-4 h-4" />
              Secure checkout with SSL encryption
            </p>
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-4">
              <Truck className="w-10 h-10 p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg text-primary-600" />
              <div>
                <p className="text-sm font-semibold text-neutral-900 dark:text-white">FREE Express Shipping</p>
                <p className="text-xs text-neutral-500">On orders above INR {FREE_SHIPPING_THRESHOLD} • 3-5 business days</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <RefreshCw className="w-10 h-10 p-2 bg-success-100 dark:bg-success-900/30 rounded-lg text-success-600" />
              <div>
                <p className="text-sm font-semibold text-neutral-900 dark:text-white">Easy 30-Day Returns</p>
                <p className="text-xs text-neutral-500">Hassle-free returns with free pickup</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Shield className="w-10 h-10 p-2 bg-accent-100 dark:bg-accent-900/30 rounded-lg text-accent-600" />
              <div>
                <p className="text-sm font-semibold text-neutral-900 dark:text-white">256-bit SSL Checkout</p>
                <p className="text-xs text-neutral-500">Your payment info is always secure</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Award className="w-10 h-10 p-2 bg-warning-100 dark:bg-warning-900/30 rounded-lg text-warning-600" />
              <div>
                <p className="text-sm font-semibold text-neutral-900 dark:text-white">100% Authentic Products</p>
                <p className="text-xs text-neutral-500">Genuine brands, quality guaranteed</p>
              </div>
            </div>
          </div>

          <div>
            <details className="group">
              <summary className="flex items-center justify-between cursor-pointer py-3 border-b border-neutral-200 dark:border-neutral-800">
                <span className="font-medium">Product Details</span>
                <ChevronDown className="w-5 h-5 text-neutral-500 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="py-4 text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap">
                {product.description}
              </div>
            </details>

            {product.fabric_material && (
              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer py-3 border-b border-neutral-200 dark:border-neutral-800">
                  <span className="font-medium">Fabric Details</span>
                  <ChevronDown className="w-5 h-5 text-neutral-500 group-open:rotate-180 transition-transform" />
                </summary>
                <div className="py-4 space-y-2 text-neutral-600 dark:text-neutral-400">
                  {product.fabric_material && (
                    <p><span className="font-medium">Material:</span> {product.fabric_material}</p>
                  )}
                  {product.fabric_composition && (
                    <p><span className="font-medium">Composition:</span> {product.fabric_composition}</p>
                  )}
                  {product.fabric_weight && (
                    <p><span className="font-medium">Weight:</span> {product.fabric_weight}</p>
                  )}
                </div>
              </details>
            )}

            {product.care_instructions && product.care_instructions.length > 0 && (
              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer py-3 border-b border-neutral-200 dark:border-neutral-800">
                  <span className="font-medium">Care Instructions</span>
                  <ChevronDown className="w-5 h-5 text-neutral-500 group-open:rotate-180 transition-transform" />
                </summary>
                <div className="py-4">
                  <ul className="space-y-2 text-neutral-600 dark:text-neutral-400">
                    {product.care_instructions.map((instruction, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-primary-600" />
                        {instruction}
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
