import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingBag, ImageIcon } from 'lucide-react';
import { cn, getDiscountPercentage } from '../../lib/utils';
import { Card, Badge, Button, PriceTag, Skeleton } from '../ui';
import { useWishlistStore, useCartStore, useToastStore } from '../../stores';
import type { Product, ProductVariant, ProductImage } from '../../types';

interface SafeProductImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackSize?: 'sm' | 'md' | 'lg';
}

export function SafeProductImage({ src, alt, className, fallbackSize = 'md' }: SafeProductImageProps) {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
  };

  const containerClasses = {
    sm: 'p-1',
    md: 'p-2',
    lg: 'p-4',
  };

  if (imageError || !src || src === '/placeholder.svg') {
    return (
      <div className={cn('w-full h-full flex flex-col items-center justify-center bg-neutral-100 dark:bg-neutral-800 text-neutral-400 select-none', containerClasses[fallbackSize], className)}>
        <ImageIcon className={cn('text-neutral-400 dark:text-neutral-500 mb-1', sizeClasses[fallbackSize])} />
        {fallbackSize !== 'sm' && <span className="text-[10px] text-neutral-500 mt-1">Image unavailable</span>}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setImageError(true)}
    />
  );
}

interface ProductCardProps {
  product: Product;
  images: ProductImage[];
  variants: ProductVariant[];
  className?: string;
}

export function ProductCard({ product, images, variants, className }: ProductCardProps) {
  const { toggleWishlist, isInWishlist } = useWishlistStore();
  const { addItem } = useCartStore();
  const { addToast } = useToastStore();

  const primaryImage = images.find((img) => img.is_primary) || images[0];
  const isWishlisted = isInWishlist(product.id);
  const firstVariant = variants[0];
  const hasDiscount = product.sale_price !== null && product.sale_price !== undefined && Number(product.sale_price) < Number(product.base_price);
  
  // Calculate total inventory across all variants
  const totalStock = variants.reduce((sum, v) => sum + v.inventory_quantity, 0);
  const isOutOfStock = totalStock === 0;
  const isLowStock = !isOutOfStock && totalStock > 0 && totalStock <= 5;
  const stockMessage = isOutOfStock ? 'Out of Stock' : isLowStock ? `Only ${totalStock} left in stock - Order Soon!` : null;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock) {
      addToast({
        type: 'error',
        title: 'Out of stock',
        message: `${product.name} is currently unavailable`,
      });
      return;
    }
    if (firstVariant) {
      addItem(product, firstVariant, 1);
      addToast({
        type: 'success',
        title: 'Added to cart',
        message: `${product.name} has been added to your cart`,
      });
    }
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product.id);
    addToast({
      type: isWishlisted ? 'info' : 'success',
      title: isWishlisted ? 'Removed from wishlist' : 'Added to wishlist',
      message: product.name,
    });
  };

  const imageSrc = primaryImage?.url || '/placeholder.svg';

  return (
    <Link
      to={`/product/${product.slug}`}
      className={cn('block group', className)}
    >
      <Card hover className="overflow-hidden">
        <div className="relative aspect-product bg-neutral-100 dark:bg-neutral-800">
          <SafeProductImage
            src={imageSrc}
            alt={primaryImage?.alt || product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            fallbackSize="md"
          />

          <div className="absolute top-3 left-3 flex flex-col gap-2">
            {hasDiscount && (
              <Badge variant="accent">
                {getDiscountPercentage(product.base_price, product.sale_price!)}% OFF
              </Badge>
            )}
            {isOutOfStock && (
              <Badge variant="secondary">Out of Stock</Badge>
            )}
            {isLowStock && !isOutOfStock && (
              <Badge variant="warning">
                Only {totalStock} Left!
              </Badge>
            )}
            {product.is_new_arrival && <Badge variant="primary">New</Badge>}
            {product.is_limited_edition && <Badge variant="secondary">Limited</Badge>}
          </div>

          <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
          </div>

          <div
            className={cn(
              'absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent',
              'transform translate-y-full group-hover:translate-y-0 transition-transform duration-300'
            )}
          >
            <Button
              variant="primary"
              className="w-full"
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              leftIcon={<ShoppingBag className="w-4 h-4" />}
            >
              {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
            </Button>
          </div>

          {stockMessage && !isOutOfStock && (
            <div className="absolute bottom-3 left-3 right-3 group-hover:bottom-16 group-hover:opacity-0 transition-all">
              <div className="bg-warning-500 text-white text-xs text-center py-1 px-2 rounded font-medium">
                {stockMessage}
              </div>
            </div>
          )}
        </div>

        <div className="p-4">
          <p className="text-xs text-primary-600 dark:text-primary-400 font-medium uppercase mb-1">
            {product.category}
          </p>
          <h3 className="font-medium text-neutral-900 dark:text-white mb-1 line-clamp-1">
            {product.name}
          </h3>

          <PriceTag price={product.base_price} salePrice={product.sale_price} currency={product.currency} />

          {variants.length > 0 && (
            <div className="flex items-center gap-1 mt-2">
              {Array.from(new Set(variants.map((v) => v.color)))
                .slice(0, 4)
                .map((color) => {
                  const variant = variants.find((v) => v.color === color);
                  return (
                    <div
                      key={color}
                      className="w-4 h-4 rounded-full border border-neutral-300 dark:border-neutral-600"
                      style={{ backgroundColor: variant?.color_code }}
                      title={color}
                    />
                  );
                })}
              {new Set(variants.map((v) => v.color)).size > 4 && (
                <span className="text-xs text-neutral-500 ml-1">
                  +{new Set(variants.map((v) => v.color)).size - 4}
                </span>
              )}
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}

interface ProductGridProps {
  products: Array<{
    product: Product;
    images: ProductImage[];
    variants: ProductVariant[];
  }>;
  columns?: 2 | 3 | 4;
  loading?: boolean;
}

export function ProductGrid({ products, columns = 4, loading }: ProductGridProps) {
  const colStyles = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
  };

  if (loading) {
    return (
      <div className={cn('grid gap-4 md:gap-6', colStyles[columns])}>
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('grid gap-4 md:gap-6', colStyles[columns])}>
      {products.map(({ product, images, variants }) => (
        <ProductCard
          key={product.id}
          product={product}
          images={images}
          variants={variants}
        />
      ))}
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="aspect-product bg-neutral-100 dark:bg-neutral-800 relative overflow-hidden">
        <Skeleton className="w-full h-full" />
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          <Skeleton variant="circular" className="w-12 h-5" />
        </div>
      </div>
      <div className="p-4 space-y-3">
        <Skeleton className="h-3 w-16" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="flex justify-between items-center">
          <Skeleton className="h-5 w-20" />
          <div className="flex gap-1">
            <Skeleton variant="circular" className="w-4 h-4" />
            <Skeleton variant="circular" className="w-4 h-4" />
            <Skeleton variant="circular" className="w-4 h-4" />
          </div>
        </div>
      </div>
    </Card>
  );
}

interface CollectionCardProps {
  id: string;
  name: string;
  slug: string;
  description?: string;
  season?: string;
  imageUrl: string;
}

export function CollectionCard({
  name,
  slug,
  description,
  season,
  imageUrl,
}: CollectionCardProps) {
  const seasonColors: Record<string, string> = {
    summer: 'bg-amber-500',
    monsoon: 'bg-blue-500',
    autumn: 'bg-orange-500',
    winter: 'bg-slate-600',
    festive: 'bg-rose-500',
  };

  return (
    <Link to={`/collection/${slug}`} className="group block relative overflow-hidden rounded-2xl">
      <div className="aspect-[4/5] relative">
        <SafeProductImage
          src={imageUrl || '/placeholder.svg'}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          fallbackSize="lg"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          {season && (
            <div className={cn('inline-block px-2 py-0.5 rounded text-xs font-medium mb-2', seasonColors[season] || 'bg-neutral-700')}>
              {season.charAt(0).toUpperCase() + season.slice(1)}
            </div>
          )}
          <h3 className="font-display text-2xl font-bold mb-1">{name}</h3>
          {description && (
            <p className="text-sm text-white/80 line-clamp-2">{description}</p>
          )}
          <div className="mt-4 flex items-center gap-2 text-sm font-medium group-hover:gap-3 transition-all">
            Shop Collection
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}

interface SizeSelectorProps {
  sizes: string[];
  selectedSize: string | null;
  onSelect: (size: string) => void;
  disabled?: boolean;
}

export function SizeSelector({ sizes, selectedSize, onSelect, disabled }: SizeSelectorProps) {
  const standardSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const sortedSizes = [...new Set(sizes)].sort((a, b) => {
    const aIndex = standardSizes.indexOf(a.toUpperCase());
    const bIndex = standardSizes.indexOf(b.toUpperCase());
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Size
        </label>
        <button className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
          Size Guide
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {sortedSizes.map((size) => (
          <button
            key={size}
            disabled={disabled}
            onClick={() => onSelect(size)}
            className={cn(
              'min-w-[48px] px-4 py-2 text-sm font-medium border rounded-lg transition-all',
              selectedSize === size
                ? 'border-primary-600 bg-primary-600 text-white'
                : 'border-neutral-300 dark:border-neutral-600 hover:border-primary-500',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  );
}

interface ColorSelectorProps {
  colors: Array<{ name: string; code: string; available: boolean }>;
  selectedColor: string | null;
  onSelect: (color: string) => void;
}

export function ColorSelector({ colors, selectedColor, onSelect }: ColorSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
        Color: <span className="font-normal text-neutral-600">{selectedColor || 'Select'}</span>
      </label>
      <div className="flex flex-wrap gap-2">
        {colors.map((color) => (
          <button
            key={color.name}
            disabled={!color.available}
            onClick={() => onSelect(color.name)}
            title={color.name}
            className={cn(
              'relative w-8 h-8 rounded-full border-2 transition-all',
              selectedColor === color.name
                ? 'border-primary-600 ring-2 ring-primary-600/20'
                : 'border-neutral-300 dark:border-neutral-600 hover:border-primary-400',
              !color.available && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div
              className="w-full h-full rounded-full"
              style={{ backgroundColor: color.code }}
            />
            {!color.available && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-0.5 bg-neutral-400 rotate-45 transform origin-center" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

interface QuantitySelectorProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function QuantitySelector({
  value,
  min = 1,
  max = 99,
  onChange,
  disabled,
}: QuantitySelectorProps) {
  const [inputValue, setInputValue] = useState(String(value));

  // Sync local state when parent value changes (e.g. from +/- buttons)
  useEffect(() => {
    setInputValue(String(value));
  }, [value]);

  const commit = (raw: string) => {
    const val = parseInt(raw, 10);
    if (!isNaN(val) && val >= min && val <= max) {
      onChange(val);
      setInputValue(String(val));
    } else {
      // Reset to last valid value if input is out of range
      setInputValue(String(value));
    }
  };

  return (
    <div className="flex items-center border border-neutral-300 dark:border-neutral-600 rounded-lg">
      <button
        disabled={disabled || value <= min}
        onClick={() => {
          const next = value - 1;
          onChange(next);
          setInputValue(String(next));
        }}
        className={cn(
          'w-10 h-10 flex items-center justify-center text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-l-lg transition-colors',
          (disabled || value <= min) && 'opacity-50 cursor-not-allowed'
        )}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </button>
      <input
        type="number"
        value={inputValue}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
        }}
        className="w-12 h-10 text-center text-sm font-medium bg-transparent border-x border-neutral-300 dark:border-neutral-600 focus:outline-none"
      />
      <button
        disabled={disabled || value >= max}
        onClick={() => {
          const next = value + 1;
          onChange(next);
          setInputValue(String(next));
        }}
        className={cn(
          'w-10 h-10 flex items-center justify-center text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-r-lg transition-colors',
          (disabled || value >= max) && 'opacity-50 cursor-not-allowed'
        )}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}
