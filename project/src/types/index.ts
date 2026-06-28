// Core Types for SAVANA E-commerce Platform

export type Season = 'summer' | 'monsoon' | 'autumn' | 'winter' | 'festive';
export type CollectionType = 'new-arrivals' | 'best-sellers' | 'limited-edition' | 'sale';
export type ProductCategory = 'men' | 'women' | 'unisex' | 'kids';
export type ProductSubcategory =
  | 'tops'
  | 'bottoms'
  | 'dresses'
  | 'outerwear'
  | 'accessories'
  | 'footwear'
  | 'activewear'
  | 'ethnic'
  | 'loungewear';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned'
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'FAILED_ABANDONED';

export type PaymentMethod = 'upi' | 'card' | 'wallet' | 'netbanking' | 'cod' | 'giftcard';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export type AddressType = 'billing' | 'shipping';

export interface User {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  avatar_url: string | null;
  role: 'customer' | 'admin' | 'vendor';
  loyalty_points: number;
  referral_code: string;
  referred_by: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  type: AddressType;
  is_default: boolean;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  landmark: string | null;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string;
  short_description: string | null;
  category: ProductCategory;
  subcategory: ProductSubcategory | null;
  season: Season | null;
  collection_id: string | null;
  base_price: number;
  sale_price: number | null;
  currency: string;
  tags: string[];
  fabric_material: string | null;
  fabric_composition: string | null;
  fabric_weight: string | null;
  fabric_weave: string | null;
  fabric_certifications: string[];
  care_instructions: string[];
  is_featured: boolean;
  is_new_arrival: boolean;
  is_best_seller: boolean;
  is_limited_edition: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Computed fields
  images?: ProductImage[];
  variants?: ProductVariant[];
  total_reviews?: number;
  average_rating?: number;
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  is_primary: boolean;
  sort_order: number;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  size: string;
  color: string;
  color_code: string;
  sku: string;
  price_adjustment: number;
  inventory_quantity: number;
  low_stock_threshold: number;
  is_in_stock: boolean;
  images: string[];
}

export interface FabricDetails {
  material: string;
  composition: string;
  weight: string;
  weave: string;
  certifications: string[];
}

export interface SizeGuideEntry {
  size: string;
  measurements: Record<string, string>;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  parent_id: string | null;
  image_url: string;
  sort_order: number;
  is_active: boolean;
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string;
  season: Season;
  type: CollectionType;
  image_url: string;
  banner_url: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}

export interface Cart {
  id: string;
  user_id: string | null;
  session_id: string;
  items: CartItem[];
  subtotal: number;
  tax_amount: number;
  shipping_amount: number;
  discount_amount: number;
  total: number;
  coupon_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  id: string;
  cart_id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product?: Product;
  variant?: ProductVariant;
}

export interface Wishlist {
  id: string;
  user_id: string;
  product_id: string;
  variant_id: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  tax_amount: number;
  shipping_amount: number;
  discount_amount: number;
  total: number;
  billing_address: Address;
  shipping_address: Address;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  payment_id: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  estimated_delivery: string | null;
  delivered_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product_name: string;
  product_image: string;
  size: string;
  color: string;
}

export interface Review {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  title: string;
  content: string;
  images: string[];
  is_verified_purchase: boolean;
  is_approved: boolean;
  helpful_count: number;
  created_at: string;
  updated_at: string;
  user?: Pick<User, 'id' | 'full_name' | 'avatar_url'>;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  usage_limit: number;
  used_count: number;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  applicable_categories: ProductCategory[];
  applicable_products: string[];
}

export interface LoyaltyTransaction {
  id: string;
  user_id: string;
  type: 'earned' | 'redeemed' | 'expired';
  points: number;
  order_id: string | null;
  description: string;
  balance_after: number;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'order' | 'promotion' | 'system' | 'loyalty';
  title: string;
  message: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: 'pending' | 'in_progress' | 'resolved';
  created_at: string;
}

export interface FAQ {
  id: string;
  category: string;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
}

// API Response Types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface ApiError {
  message: string;
  code: string;
  details?: Record<string, string[]>;
}

// Search Types
export interface SearchFilters {
  query?: string;
  category?: ProductCategory;
  subcategory?: ProductSubcategory;
  season?: Season;
  collection?: CollectionType;
  min_price?: number;
  max_price?: number;
  sizes?: string[];
  colors?: string[];
  sort_by?: 'price_asc' | 'price_desc' | 'newest' | 'rating' | 'popularity';
  page?: number;
  per_page?: number;
}

export interface SearchResult {
  products: Product[];
  categories: Category[];
  collections: Collection[];
  suggestions: string[];
  total_results: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Analytics Types
export interface DashboardMetrics {
  total_revenue: number;
  total_orders: number;
  total_customers: number;
  total_products: number;
  revenue_change: number;
  orders_change: number;
  customers_change: number;
  products_change: number;
  top_products: { product: Product; sales: number }[];
  recent_orders: Order[];
}

// Settings Types
export interface SiteSettings {
  site_name: string;
  site_description: string;
  logo_url: string;
  favicon_url: string;
  default_currency: string;
  default_country: string;
  tax_rate: number;
  free_shipping_threshold: number;
  shipping_rates: ShippingRate[];
  social_links: SocialLinks;
}

export interface ShippingRate {
  id: string;
  name: string;
  min_weight: number;
  max_weight: number;
  min_order_amount: number;
  base_rate: number;
  per_kg_rate: number;
  zones: string[];
}

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  twitter?: string;
  youtube?: string;
  pinterest?: string;
}

// Theme Types
export type ThemeMode = 'light' | 'dark' | 'system';
export type Currency = 'INR' | 'USD' | 'EUR' | 'GBP';

// UI State Types
export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

export interface ModalState {
  isOpen: boolean;
  title?: string;
  content?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

// Form Types
export interface LoginFormData {
  email: string;
  password: string;
  remember_me?: boolean;
}

export interface RegisterFormData {
  email: string;
  password: string;
  confirm_password: string;
  full_name: string;
  phone?: string;
  referral_code?: string;
  terms_accepted: boolean;
}

export interface CheckoutFormData {
  email: string;
  shipping_address: Omit<Address, 'id' | 'user_id' | 'is_default'>;
  billing_same_as_shipping: boolean;
  billing_address?: Omit<Address, 'id' | 'user_id' | 'is_default'>;
  payment_method: PaymentMethod;
  save_info?: boolean;
  notes?: string;
}

// Navigation Types
export interface NavItem {
  label: string;
  href: string;
  icon?: string;
  badge?: string | number;
  children?: NavItem[];
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  image_url_mobile: string | null;
  link_url: string | null;
  button_text: string | null;
  position: 'hero' | 'category' | 'promotional' | 'sidebar';
  sort_order: number;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}
