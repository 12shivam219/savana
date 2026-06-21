-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  phone TEXT,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'vendor')),
  loyalty_points INTEGER DEFAULT 0,
  referral_code TEXT UNIQUE DEFAULT UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8)),
  referred_by UUID REFERENCES auth.users(id),
  email_verified BOOLEAN DEFAULT FALSE,
  phone_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Addresses table
CREATE TABLE public.addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('billing', 'shipping')),
  is_default BOOLEAN DEFAULT FALSE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'India',
  landmark TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES public.categories(id),
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collections table
CREATE TABLE public.collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  season TEXT CHECK (season IN ('summer', 'monsoon', 'autumn', 'winter', 'festive')),
  type TEXT CHECK (type IN ('new-arrivals', 'best-sellers', 'limited-edition', 'sale')),
  image_url TEXT,
  banner_url TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  short_description TEXT,
  category TEXT NOT NULL CHECK (category IN ('men', 'women', 'unisex', 'kids')),
  subcategory TEXT CHECK (subcategory IN ('tops', 'bottoms', 'dresses', 'outerwear', 'accessories', 'footwear', 'activewear', 'ethnic', 'loungewear')),
  season TEXT CHECK (season IN ('summer', 'monsoon', 'autumn', 'winter', 'festive')),
  collection_id UUID REFERENCES public.collections(id),
  base_price DECIMAL(10,2) NOT NULL,
  sale_price DECIMAL(10,2),
  currency TEXT DEFAULT 'INR',
  tags TEXT[] DEFAULT '{}',
  fabric_material TEXT,
  fabric_composition TEXT,
  fabric_weight TEXT,
  fabric_weave TEXT,
  fabric_certifications TEXT[] DEFAULT '{}',
  care_instructions TEXT[] DEFAULT '{}',
  is_featured BOOLEAN DEFAULT FALSE,
  is_new_arrival BOOLEAN DEFAULT FALSE,
  is_best_seller BOOLEAN DEFAULT FALSE,
  is_limited_edition BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product images table
CREATE TABLE public.product_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product variants table
CREATE TABLE public.product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  color TEXT NOT NULL,
  color_code TEXT NOT NULL,
  sku TEXT UNIQUE NOT NULL,
  price_adjustment DECIMAL(10,2) DEFAULT 0,
  inventory_quantity INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 10,
  is_in_stock BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, size, color)
);

-- Create index for search
CREATE INDEX idx_products_name_trgm ON public.products USING GIN (name gin_trgm_ops);
CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_products_season ON public.products(season);
CREATE INDEX idx_products_is_active ON public.products(is_active);
CREATE INDEX idx_products_featured ON public.products(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_products_new_arrival ON public.products(is_new_arrival) WHERE is_new_arrival = TRUE;
CREATE INDEX idx_products_best_seller ON public.products(is_best_seller) WHERE is_best_seller = TRUE;

-- Cart table
CREATE TABLE public.carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  coupon_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cart items table
CREATE TABLE public.cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  variant_id UUID NOT NULL REFERENCES public.product_variants(id),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cart_id, variant_id)
);

-- Orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned')),
  subtotal DECIMAL(12,2) NOT NULL,
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  shipping_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  billing_address JSONB NOT NULL,
  shipping_address JSONB NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('upi', 'card', 'wallet', 'netbanking', 'cod', 'giftcard')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_id TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  estimated_delivery DATE,
  delivered_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order items table
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  variant_id UUID NOT NULL REFERENCES public.product_variants(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  product_name TEXT NOT NULL,
  product_image TEXT NOT NULL,
  size TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for orders
CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);

-- Reviews table
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',
  is_verified_purchase BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN DEFAULT FALSE,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, user_id)
);

-- Wishlist table
CREATE TABLE public.wishlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id, variant_id)
);

-- Coupons table
CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value DECIMAL(10,2) NOT NULL,
  min_order_amount DECIMAL(10,2) DEFAULT 0,
  max_discount_amount DECIMAL(10,2),
  usage_limit INTEGER DEFAULT 1000,
  used_count INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  applicable_categories TEXT[] DEFAULT '{}',
  applicable_products UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loyalty transactions table
CREATE TABLE public.loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('earned', 'redeemed', 'expired')),
  points INTEGER NOT NULL,
  order_id UUID REFERENCES public.orders(id),
  description TEXT NOT NULL,
  balance_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('order', 'promotion', 'system', 'loyalty')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contact submissions table
CREATE TABLE public.contact_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FAQs table
CREATE TABLE public.faqs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Page content table
CREATE TABLE public.pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  meta_title TEXT,
  meta_description TEXT,
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Banners table
CREATE TABLE public.banners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT NOT NULL,
  image_url_mobile TEXT,
  link_url TEXT,
  button_text TEXT,
  position TEXT DEFAULT 'hero' CHECK (position IN ('hero', 'category', 'promotional', 'sidebar')),
  sort_order INTEGER DEFAULT 0,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Site settings table
CREATE TABLE public.site_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_name TEXT DEFAULT 'SAVANA',
  site_description TEXT,
  logo_url TEXT,
  favicon_url TEXT,
  default_currency TEXT DEFAULT 'INR',
  default_country TEXT DEFAULT 'India',
  tax_rate DECIMAL(5,2) DEFAULT 18.00,
  free_shipping_threshold DECIMAL(10,2) DEFAULT 999,
  shipping_zones JSONB DEFAULT '[]',
  social_links JSONB DEFAULT '{}',
  contact_email TEXT,
  contact_phone TEXT,
  company_name TEXT,
  company_address TEXT,
  gst_number TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default site settings
INSERT INTO public.site_settings (site_name, site_description, contact_email, contact_phone, company_name, gst_number)
VALUES ('SAVANA', 'Embrace Every Season in Style', 'hello@savana.in', '+91 98765 43210', 'SAVANA Fashion Pvt. Ltd.', '27AANCS1234B1Z5');

-- Row Level Security Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- Addresses policies
CREATE POLICY "addresses_select_own" ON public.addresses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "addresses_insert_own" ON public.addresses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "addresses_update_own" ON public.addresses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "addresses_delete_own" ON public.addresses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Categories - public read
CREATE POLICY "categories_public_read" ON public.categories FOR SELECT
  TO public USING (is_active = TRUE);
CREATE POLICY "categories_admin_all" ON public.categories FOR ALL
  TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Collections - public read
CREATE POLICY "collections_public_read" ON public.collections FOR SELECT
  TO public USING (is_active = TRUE);
CREATE POLICY "collections_admin_all" ON public.collections FOR ALL
  TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Products - public read active products
CREATE POLICY "products_public_read" ON public.products FOR SELECT
  TO public USING (is_active = TRUE);
CREATE POLICY "products_admin_all" ON public.products FOR ALL
  TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Product images - public read
CREATE POLICY "product_images_public_read" ON public.product_images FOR SELECT
  TO public USING (EXISTS (SELECT 1 FROM public.products WHERE id = product_id AND is_active = TRUE));
CREATE POLICY "product_images_admin_all" ON public.product_images FOR ALL
  TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Product variants - public read
CREATE POLICY "product_variants_public_read" ON public.product_variants FOR SELECT
  TO public USING (EXISTS (SELECT 1 FROM public.products WHERE id = product_id AND is_active = TRUE));
CREATE POLICY "product_variants_admin_all" ON public.product_variants FOR ALL
  TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Carts policies
CREATE POLICY "carts_select_own" ON public.carts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "carts_insert_own" ON public.carts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "carts_update_own" ON public.carts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "carts_delete_own" ON public.carts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Cart items policies
CREATE POLICY "cart_items_select_own" ON public.cart_items FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM public.carts WHERE id = cart_id AND user_id = auth.uid()));
CREATE POLICY "cart_items_insert_own" ON public.cart_items FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.carts WHERE id = cart_id AND user_id = auth.uid()));
CREATE POLICY "cart_items_update_own" ON public.cart_items FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM public.carts WHERE id = cart_id AND user_id = auth.uid()));
CREATE POLICY "cart_items_delete_own" ON public.cart_items FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM public.carts WHERE id = cart_id AND user_id = auth.uid()));

-- Orders policies
CREATE POLICY "orders_select_own" ON public.orders FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "orders_insert_own" ON public.orders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "orders_update_own" ON public.orders FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "orders_admin_all" ON public.orders FOR ALL
  TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Order items policies
CREATE POLICY "order_items_select_own" ON public.order_items FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND user_id = auth.uid()));
CREATE POLICY "order_items_admin_all" ON public.order_items FOR ALL
  TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Reviews policies
CREATE POLICY "reviews_public_read" ON public.reviews FOR SELECT
  TO public USING (is_approved = TRUE OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "reviews_insert_own" ON public.reviews FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews_update_own" ON public.reviews FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews_delete_own" ON public.reviews FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Wishlists policies
CREATE POLICY "wishlists_select_own" ON public.wishlists FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "wishlists_insert_own" ON public.wishlists FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wishlists_delete_own" ON public.wishlists FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Coupons - public read active coupons
CREATE POLICY "coupons_public_read" ON public.coupons FOR SELECT
  TO public USING (is_active = TRUE);
CREATE POLICY "coupons_admin_all" ON public.coupons FOR ALL
  TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Loyalty transactions policies
CREATE POLICY "loyalty_transactions_select_own" ON public.loyalty_transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "loyalty_transactions_insert_admin" ON public.loyalty_transactions FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Notifications policies
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notifications_delete_own" ON public.notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Contact submissions - anyone can submit
CREATE POLICY "contact_submissions_insert_public" ON public.contact_submissions FOR INSERT
  TO public WITH CHECK (true);
CREATE POLICY "contact_submissions_admin_all" ON public.contact_submissions FOR ALL
  TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- FAQs - public read
CREATE POLICY "faqs_public_read" ON public.faqs FOR SELECT
  TO public USING (is_active = TRUE);
CREATE POLICY "faqs_admin_all" ON public.faqs FOR ALL
  TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Pages - public read
CREATE POLICY "pages_public_read" ON public.pages FOR SELECT
  TO public USING (is_published = TRUE);
CREATE POLICY "pages_admin_all" ON public.pages FOR ALL
  TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Banners - public read
CREATE POLICY "banners_public_read" ON public.banners FOR SELECT
  TO public USING (is_active = TRUE AND (end_date IS NULL OR end_date > NOW()));
CREATE POLICY "banners_admin_all" ON public.banners FOR ALL
  TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Site settings - public read
CREATE POLICY "site_settings_public_read" ON public.site_settings FOR SELECT
  TO public USING (true);
CREATE POLICY "site_settings_admin_all" ON public.site_settings FOR ALL
  TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Functions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, loyalty_points)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Customer'),
    'customer',
    100 -- Welcome bonus points
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_addresses_updated_at BEFORE UPDATE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_carts_updated_at BEFORE UPDATE ON public.carts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_faqs_updated_at BEFORE UPDATE ON public.faqs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pages_updated_at BEFORE UPDATE ON public.pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_banners_updated_at BEFORE UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_site_settings_updated_at BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
