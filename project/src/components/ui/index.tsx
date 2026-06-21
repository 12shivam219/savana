import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading,
  leftIcon,
  rightIcon,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    accent: 'btn-accent',
    outline: 'btn-outline',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
  };

  const sizes = {
    sm: 'btn-sm',
    md: '',
    lg: 'btn-lg',
    xl: 'btn-xl',
    icon: 'btn-icon',
  };

  return (
    <button
      className={cn(
        'btn',
        variants[variant],
        sizes[size],
        isLoading && 'btn-loading',
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
    </button>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helpText, leftElement, rightElement, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && <label className="label">{label}</label>}
        <div className="relative">
          {leftElement && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
              {leftElement}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              'input',
              error && 'input-error',
              leftElement && 'pl-10',
              rightElement && 'pr-10',
              className
            )}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
              {rightElement}
            </div>
          )}
        </div>
        {error && <p className="text-sm text-error-600 mt-1">{error}</p>}
        {helpText && !error && <p className="text-sm text-neutral-500 mt-1">{helpText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helpText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helpText, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && <label className="label">{label}</label>}
        <textarea
          ref={ref}
          className={cn(
            'input min-h-[120px] resize-y',
            error && 'input-error',
            className
          )}
          {...props}
        />
        {error && <p className="text-sm text-error-600 mt-1">{error}</p>}
        {helpText && !error && <p className="text-sm text-neutral-500 mt-1">{helpText}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && <label className="label">{label}</label>}
        <select
          ref={ref}
          className={cn('input appearance-none cursor-pointer', error && 'input-error', className)}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && <p className="text-sm text-error-600 mt-1">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, className, ...props }, ref) => {
    return (
      <label className={cn('flex items-start gap-3 cursor-pointer', className)}>
        <input
          ref={ref}
          type="checkbox"
          className="w-5 h-5 rounded border-neutral-300 dark:border-neutral-600 text-primary-600 focus:ring-primary-500 mt-0.5"
          {...props}
        />
        <div>
          {label && <span className="font-medium">{label}</span>}
          {description && <p className="text-sm text-neutral-500">{description}</p>}
        </div>
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';

interface BadgeProps {
  variant?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error';
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'primary', children, className }: BadgeProps) {
  const variants = {
    primary: 'badge-primary',
    secondary: 'badge-secondary',
    accent: 'badge-accent',
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
  };

  return <span className={cn('badge', variants[variant], className)}>{children}</span>;
}

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const sizes = {
    xs: 'avatar-xs',
    sm: 'avatar-sm',
    md: 'avatar-md',
    lg: 'avatar-lg',
    xl: 'avatar-xl',
  };

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn('rounded-full object-cover', sizes[size], className)}
      />
    );
  }

  return <div className={cn('avatar', sizes[size], className)}>{initials}</div>;
}

interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular';
  className?: string;
}

export function Skeleton({ variant = 'rectangular', className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'skeleton',
        variant === 'circular' && 'rounded-full',
        variant === 'text' && 'h-4 w-full rounded',
        className
      )}
    />
  );
}

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  clickable?: boolean;
  onClick?: () => void;
}

export function Card({ children, className, hover, clickable, onClick }: CardProps) {
  return (
    <div
      className={cn(
        'card',
        hover && 'card-hover',
        clickable && 'card-clickable',
        className
      )}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return <div className={cn('p-4 border-b border-neutral-200 dark:border-neutral-800', className)}>{children}</div>;
}

interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function CardBody({ children, className }: CardBodyProps) {
  return <div className={cn('p-4', className)}>{children}</div>;
}

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return <div className={cn('p-4 border-t border-neutral-200 dark:border-neutral-800', className)}>{children}</div>;
}

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <svg
      className={cn('animate-spin text-primary-600', sizes[size], className)}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && <div className="text-neutral-400 mb-4">{icon}</div>}
      <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-2">{title}</h3>
      {description && (
        <p className="text-neutral-500 dark:text-neutral-400 mb-4 max-w-sm">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}

interface DividerProps {
  className?: string;
  label?: string;
}

export function Divider({ className, label }: DividerProps) {
  if (label) {
    return (
      <div className={cn('flex items-center gap-4', className)}>
        <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
        <span className="text-sm text-neutral-500">{label}</span>
        <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
      </div>
    );
  }

  return <div className={cn('divider', className)} />;
}

interface PriceTagProps {
  price: number;
  salePrice?: number | null;
  currency?: string;
  size?: 'sm' | 'md' | 'lg';
  showDiscount?: boolean;
  className?: string;
}

export function PriceTag({
  price,
  salePrice,
  currency = 'INR',
  size = 'md',
  showDiscount = true,
  className,
}: PriceTagProps) {
  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const sizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl font-bold',
  };

  const hasDiscount = salePrice && salePrice < price;
  const discountPercent = hasDiscount
    ? Math.round(((price - salePrice!) / price) * 100)
    : 0;

  return (
    <div className={cn('flex items-baseline gap-2', className)}>
      {hasDiscount ? (
        <>
          <span className={cn('price-sale font-semibold text-accent-600', sizes[size])}>{formatPrice(salePrice)}</span>
          <span className="price-original text-sm line-through text-neutral-500">{formatPrice(price)}</span>
          {showDiscount && (
            <Badge variant="accent" className="text-xs">
              {discountPercent}% OFF
            </Badge>
          )}
        </>
      ) : (
        <span className={cn('price', sizes[size])}>{formatPrice(price)}</span>
      )}
    </div>
  );
}

interface RatingProps {
  rating: number;
  maxRating?: number;
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Rating({ rating, maxRating = 5, showValue = true, size = 'md', className }: RatingProps) {
  const stars = Array.from({ length: maxRating }, (_, i) => i + 1);

  const sizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {stars.map((star) => (
        <svg
          key={star}
          className={cn(
            sizes[size],
            star <= rating ? 'text-warning-400 fill-warning-400' : 'text-neutral-300 dark:text-neutral-600'
          )}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        </svg>
      ))}
      {showValue && (
        <span className="text-sm text-neutral-600 dark:text-neutral-400 ml-1">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}
