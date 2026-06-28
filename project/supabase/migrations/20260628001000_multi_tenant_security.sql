-- 1. Helper Functions to get current tenant and role from JWT or DB fallback
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID AS $$
DECLARE
  _jwt_tenant_id TEXT;
  _profile_tenant_id UUID;
  _default_tenant_id UUID := 'd9f8e7d6-c5b4-a3f2-e1d0-c9b8a7f6e5d4'::uuid;
BEGIN
  -- Extract tenant_id from JWT claims
  _jwt_tenant_id := COALESCE(
    current_setting('request.jwt.claims', true)::json->'app_metadata'->>'tenant_id',
    current_setting('request.jwt.claims', true)::json->'user_metadata'->>'tenant_id'
  );
  
  IF _jwt_tenant_id IS NOT NULL AND _jwt_tenant_id <> '' THEN
    RETURN _jwt_tenant_id::uuid;
  END IF;

  -- Fallback to database lookup for authenticated user
  IF auth.uid() IS NOT NULL THEN
    SELECT tenant_id INTO _profile_tenant_id FROM public.profiles WHERE id = auth.uid();
    IF _profile_tenant_id IS NOT NULL THEN
      RETURN _profile_tenant_id;
    END IF;
  END IF;

  -- Fallback to request headers (x-tenant-id) for anonymous storefront visitors
  BEGIN
    _jwt_tenant_id := current_setting('request.headers', true)::json->>'x-tenant-id';
    IF _jwt_tenant_id IS NOT NULL AND _jwt_tenant_id <> '' THEN
      RETURN _jwt_tenant_id::uuid;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- GUC may not be populated
  END;

  -- Default tenant fallback
  RETURN _default_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.jwt_has_admin_role()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role',
    current_setting('request.jwt.claims', true)::json->'user_metadata'->>'role'
  ) = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
DECLARE
  _jwt_role TEXT;
  _profile_role TEXT;
BEGIN
  -- Extract role from JWT claims
  _jwt_role := COALESCE(
    current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role',
    current_setting('request.jwt.claims', true)::json->'user_metadata'->>'role'
  );
  
  IF _jwt_role IS NOT NULL AND _jwt_role <> '' THEN
    RETURN _jwt_role;
  END IF;

  -- Fallback to profiles database lookup
  IF auth.uid() IS NOT NULL THEN
    SELECT role INTO _profile_role FROM public.profiles WHERE id = auth.uid();
    IF _profile_role IS NOT NULL THEN
      RETURN _profile_role;
    END IF;
  END IF;

  RETURN 'anonymous';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('customer', 'admin', 'vendor')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Seed user_roles table from profiles
INSERT INTO public.user_roles (user_id, role)
SELECT id, role FROM public.profiles
ON CONFLICT (user_id, role) DO NOTHING;

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;


-- 3. Add tenant_id column to all tables
-- Table list: profiles, addresses, categories, collections, products, product_images, product_variants, carts, cart_items, orders, order_items, reviews, wishlists, coupons, loyalty_transactions, notifications, contact_submissions, faqs, pages, banners, site_settings

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'profiles', 'addresses', 'categories', 'collections', 'products', 
    'product_images', 'product_variants', 'carts', 'cart_items', 'orders', 
    'order_items', 'reviews', 'wishlists', 'coupons', 'loyalty_transactions', 
    'notifications', 'contact_submissions', 'faqs', 'pages', 'banners', 
    'site_settings', 'user_roles'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Add column with default 'd9f8e7d6-c5b4-a3f2-e1d0-c9b8a7f6e5d4' for existing rows
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT ''d9f8e7d6-c5b4-a3f2-e1d0-c9b8a7f6e5d4''::uuid', t);
    -- Set dynamic default for future rows
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET DEFAULT public.get_current_tenant_id()', t);
  END LOOP;
END;
$$;


-- 4. Secure handle_new_user() trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, full_name, role, loyalty_points, tenant_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Customer'),
    'customer',
    100, -- Welcome bonus points
    COALESCE((NEW.raw_user_meta_data->>'tenant_id')::uuid, 'd9f8e7d6-c5b4-a3f2-e1d0-c9b8a7f6e5d4'::uuid)
  );

  -- Insert default user role
  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (
    NEW.id,
    'customer',
    COALESCE((NEW.raw_user_meta_data->>'tenant_id')::uuid, 'd9f8e7d6-c5b4-a3f2-e1d0-c9b8a7f6e5d4'::uuid)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Prevent self-promotion and tenant changes via triggers
CREATE OR REPLACE FUNCTION public.prevent_self_promotion_and_tenant_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If not an admin, check that role and tenant_id are not updated
  IF NOT (
    public.jwt_has_admin_role() OR EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
    )
  ) THEN
    IF NEW.role <> OLD.role THEN
      RAISE EXCEPTION 'Cannot change user role. Only admins can update user roles.';
    END IF;
    IF NEW.tenant_id <> OLD.tenant_id THEN
      RAISE EXCEPTION 'Cannot change tenant association.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_update_security ON public.profiles;
CREATE TRIGGER on_profile_update_security
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_promotion_and_tenant_change();


-- 6. Secure public.sync_user_cart RPC function
CREATE OR REPLACE FUNCTION public.sync_user_cart(
  p_cart_id uuid,
  p_items jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- Verify authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify ownership of the cart
  IF NOT EXISTS (
    SELECT 1 FROM public.carts 
    WHERE id = p_cart_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Resolve active tenant ID
  v_tenant_id := public.get_current_tenant_id();

  -- Delete all existing items for the cart
  DELETE FROM public.cart_items WHERE cart_id = p_cart_id;

  -- Insert new items from the jsonb array
  IF jsonb_typeof(p_items) = 'array' AND jsonb_array_length(p_items) > 0 THEN
    INSERT INTO public.cart_items (cart_id, product_id, variant_id, quantity, tenant_id)
    SELECT 
      p_cart_id,
      (item->>'product_id')::uuid,
      (item->>'variant_id')::uuid,
      (item->>'quantity')::integer,
      v_tenant_id
    FROM jsonb_array_elements(p_items) AS item;
  END IF;
END;
$$;


-- 7. Secure approve_return_and_restock RPC function
CREATE OR REPLACE FUNCTION public.approve_return_and_restock(
  p_order_id uuid,
  p_notes text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item record;
  v_current_stock integer;
  v_order_tenant_id uuid;
  v_current_tenant_id uuid;
BEGIN
  -- Verify authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify admin role
  IF NOT (
    public.jwt_has_admin_role() OR EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized. Admin privileges required.';
  END IF;

  -- Resolve tenant IDs and check boundaries
  SELECT tenant_id INTO v_order_tenant_id FROM public.orders WHERE id = p_order_id;
  v_current_tenant_id := public.get_current_tenant_id();

  IF v_order_tenant_id <> v_current_tenant_id THEN
    RAISE EXCEPTION 'Access denied. Order belongs to a different tenant.';
  END IF;

  -- Lock the order row to prevent concurrent modifications
  PERFORM 1
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  -- Loop over order items and replenish inventory atomically
  FOR v_item IN 
    SELECT variant_id, quantity 
    FROM public.order_items 
    WHERE order_id = p_order_id
  LOOP
    -- Lock product variant row for update
    SELECT inventory_quantity INTO v_current_stock
    FROM public.product_variants
    WHERE id = v_item.variant_id
    FOR UPDATE;

    IF v_current_stock IS NULL THEN
      RAISE EXCEPTION 'Product variant not found (ID: %)', v_item.variant_id;
    END IF;

    -- Increment stock atomically
    UPDATE public.product_variants
    SET 
      inventory_quantity = inventory_quantity + v_item.quantity,
      is_in_stock = TRUE,
      updated_at = now()
    WHERE id = v_item.variant_id;
  END LOOP;

  -- Update order status, payment status, and notes
  UPDATE public.orders
  SET 
    status = 'returned',
    payment_status = 'refunded',
    notes = p_notes,
    updated_at = now()
  WHERE id = p_order_id;
END;
$$;


-- 8. Secure cancel_order RPC function
CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_order_user_id uuid;
  v_status text;
  v_order_number text;
  v_user_role text;
  v_item record;
  v_current_stock integer;
  v_points_to_reverse integer;
  v_points_to_refund integer;
  v_current_balance integer;
  v_order_tenant_id uuid;
  v_current_tenant_id uuid;
BEGIN
  -- 1. Resolve authenticated user and check authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Fetch order details
  SELECT user_id, status, order_number, tenant_id INTO v_order_user_id, v_status, v_order_number, v_order_tenant_id
  FROM public.orders
  WHERE id = p_order_id;

  IF v_order_user_id IS NULL THEN
    RAISE EXCEPTION 'Order not found (ID: %)', p_order_id;
  END IF;

  -- 3. Resolve active tenant and verify data isolation
  v_current_tenant_id := public.get_current_tenant_id();
  IF v_order_tenant_id <> v_current_tenant_id THEN
    RAISE EXCEPTION 'Access denied. Order belongs to a different tenant.';
  END IF;

  -- 4. Check authorization (caller must be the owner OR an admin)
  IF v_user_id <> v_order_user_id AND NOT (
    public.jwt_has_admin_role() OR EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to cancel this order';
  END IF;

  -- 5. Check if order is already cancelled (noop) or non-cancellable
  IF v_status = 'cancelled' THEN
    RETURN;
  END IF;

  IF v_status NOT IN ('pending', 'processing', 'confirmed') THEN
    RAISE EXCEPTION 'Order cannot be cancelled in status: %', v_status;
  END IF;

  -- 6. Lock the order row to prevent concurrent updates
  PERFORM 1
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  -- 7. Loop over items and replenish inventory atomically
  FOR v_item IN 
    SELECT variant_id, quantity 
    FROM public.order_items 
    WHERE order_id = p_order_id
  LOOP
    -- Lock variant row
    SELECT inventory_quantity INTO v_current_stock
    FROM public.product_variants
    WHERE id = v_item.variant_id
    FOR UPDATE;

    IF v_current_stock IS NULL THEN
      RAISE EXCEPTION 'Product variant not found (ID: %)', v_item.variant_id;
    END IF;

    -- Increment stock atomically
    UPDATE public.product_variants
    SET 
      inventory_quantity = inventory_quantity + v_item.quantity,
      is_in_stock = TRUE,
      updated_at = now()
    WHERE id = v_item.variant_id;
  END LOOP;

  -- 8. Handle loyalty points reversal and refunds
  SELECT COALESCE(SUM(points), 0) INTO v_points_to_reverse
  FROM public.loyalty_transactions
  WHERE order_id = p_order_id AND type = 'earned';

  SELECT COALESCE(SUM(points), 0) INTO v_points_to_refund
  FROM public.loyalty_transactions
  WHERE order_id = p_order_id AND type = 'redeemed';

  -- A. Refund points that were redeemed
  IF v_points_to_refund > 0 THEN
    PERFORM public.add_loyalty_points(
      v_order_user_id,
      v_points_to_refund,
      'earned',
      'Refunded points from cancelled Order #' || v_order_number,
      p_order_id
    );
  END IF;

  -- B. Reverse points that were earned
  IF v_points_to_reverse > 0 THEN
    SELECT loyalty_points INTO v_current_balance
    FROM public.profiles
    WHERE id = v_order_user_id;

    IF v_current_balance IS NULL THEN
      v_current_balance := 0;
    END IF;

    IF v_points_to_reverse > v_current_balance THEN
      v_points_to_reverse := v_current_balance;
    END IF;

    IF v_points_to_reverse > 0 THEN
      PERFORM public.add_loyalty_points(
        v_order_user_id,
        v_points_to_reverse,
        'expired',
        'Reversed points from cancelled Order #' || v_order_number,
        p_order_id
      );
    END IF;
  END IF;

  -- 9. Update order status and payment status
  UPDATE public.orders
  SET 
    status = 'cancelled',
    payment_status = 'refunded',
    updated_at = now()
  WHERE id = p_order_id;
END;
$$;


-- 9. Secure place_order RPC function to include tenant_id
CREATE OR REPLACE FUNCTION public.place_order(
  p_order_number text,
  p_subtotal numeric,
  p_tax_amount numeric,
  p_shipping_amount numeric,
  p_discount_amount numeric,
  p_total numeric,
  p_billing_address jsonb,
  p_shipping_address jsonb,
  p_payment_method text,
  p_payment_status text,
  p_items jsonb,
  p_redeemed_points integer DEFAULT 0,
  p_coupon_code text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
  v_order_id uuid;
  v_item jsonb;
  v_variant_id uuid;
  v_quantity integer;
  v_sku text;
  v_product_id uuid;
  v_current_stock integer;
  v_loyalty_points integer;
  v_current_balance integer;
  
  -- Recalculation variables
  v_db_unit_price numeric;
  v_item_total_price numeric;
  v_recalculated_subtotal numeric := 0;
  v_recalculated_tax numeric := 0;
  v_recalculated_shipping numeric := 0;
  
  -- Coupon validation
  v_coupon_type text;
  v_coupon_value numeric;
  v_coupon_min_amount numeric;
  v_coupon_max_discount numeric;
  v_coupon_discount numeric := 0;
  v_points_discount numeric := 0;
  v_calculated_discount numeric := 0;
  v_recalculated_total numeric := 0;
BEGIN
  -- Resolve user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Resolve tenant
  v_tenant_id := public.get_current_tenant_id();

  -- 1. Validate loyalty points if redemption is requested
  IF p_redeemed_points > 0 THEN
    SELECT loyalty_points INTO v_current_balance
    FROM public.profiles
    WHERE id = v_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL THEN
      v_current_balance := 0;
    END IF;

    IF v_current_balance < p_redeemed_points THEN
      RAISE EXCEPTION 'Insufficient loyalty points balance. Available: %, Requested: %', v_current_balance, p_redeemed_points;
    END IF;
  END IF;

  -- 2. Recalculate subtotal and validate/lock stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;

    SELECT pv.inventory_quantity, pv.sku, COALESCE(p.sale_price, p.base_price) 
    INTO v_current_stock, v_sku, v_db_unit_price
    FROM public.product_variants pv
    JOIN public.products p ON pv.product_id = p.id
    WHERE pv.id = v_variant_id
    FOR UPDATE;

    IF v_current_stock IS NULL THEN
      RAISE EXCEPTION 'Product variant not found (ID: %)', v_variant_id;
    END IF;

    IF v_current_stock < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for item (SKU: %). Available: %, Requested: %', v_sku, v_current_stock, v_quantity;
    END IF;

    v_recalculated_subtotal := v_recalculated_subtotal + (v_db_unit_price * v_quantity);
  END LOOP;

  -- 3. Calculate tax and shipping
  v_recalculated_tax := round(v_recalculated_subtotal * 0.18, 2);
  v_recalculated_shipping := CASE WHEN v_recalculated_subtotal >= 999 THEN 0 ELSE 99 END;

  -- 4. Calculate discount
  IF p_coupon_code IS NOT NULL THEN
    SELECT type, value, min_order_amount, max_discount_amount 
    INTO v_coupon_type, v_coupon_value, v_coupon_min_amount, v_coupon_max_discount
    FROM public.coupons
    WHERE code = UPPER(TRIM(p_coupon_code)) AND is_active = true AND now() BETWEEN valid_from AND valid_until;

    IF FOUND THEN
      IF v_recalculated_subtotal >= v_coupon_min_amount THEN
        IF v_coupon_type = 'percentage' THEN
          v_coupon_discount := v_recalculated_subtotal * (v_coupon_value / 100.0);
          IF v_coupon_max_discount IS NOT NULL THEN
            v_coupon_discount := least(v_coupon_discount, v_coupon_max_discount);
          END IF;
        ELSIF v_coupon_type = 'fixed' THEN
          v_coupon_discount := least(v_coupon_value, v_recalculated_subtotal);
        END IF;
      END IF;
    END IF;
  END IF;
  
  v_points_discount := p_redeemed_points * 0.1;
  v_calculated_discount := round(v_coupon_discount + v_points_discount, 2);

  v_recalculated_total := greatest(0, v_recalculated_subtotal + v_recalculated_tax + v_recalculated_shipping - v_calculated_discount);

  -- 5. Insert order into public.orders
  INSERT INTO public.orders (
    user_id,
    order_number,
    status,
    subtotal,
    tax_amount,
    shipping_amount,
    discount_amount,
    total,
    billing_address,
    shipping_address,
    payment_method,
    payment_status,
    tenant_id
  ) VALUES (
    v_user_id,
    p_order_number,
    'pending',
    v_recalculated_subtotal,
    v_recalculated_tax,
    v_recalculated_shipping,
    v_calculated_discount,
    v_recalculated_total,
    p_billing_address,
    p_shipping_address,
    p_payment_method,
    p_payment_status,
    v_tenant_id
  ) RETURNING id INTO v_order_id;

  -- 6. Process items and insert order_items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;

    SELECT pv.inventory_quantity, pv.sku, pv.product_id, COALESCE(p.sale_price, p.base_price)
    INTO v_current_stock, v_sku, v_product_id, v_db_unit_price
    FROM public.product_variants pv
    JOIN public.products p ON pv.product_id = p.id
    WHERE pv.id = v_variant_id;

    UPDATE public.product_variants
    SET 
      inventory_quantity = inventory_quantity - v_quantity,
      is_in_stock = (inventory_quantity - v_quantity) > 0,
      updated_at = now()
    WHERE id = v_variant_id;

    v_item_total_price := round(v_db_unit_price * v_quantity, 2);

    INSERT INTO public.order_items (
      order_id,
      product_id,
      variant_id,
      quantity,
      unit_price,
      total_price,
      product_name,
      product_image,
      size,
      color,
      tenant_id
    ) VALUES (
      v_order_id,
      v_product_id,
      v_variant_id,
      v_quantity,
      v_db_unit_price,
      v_item_total_price,
      v_item->>'product_name',
      v_item->>'product_image',
      v_item->>'size',
      v_item->>'color',
      v_tenant_id
    );
  END LOOP;

  -- 7. Perform loyalty points redemption
  IF p_redeemed_points > 0 THEN
    PERFORM public.add_loyalty_points(
      v_user_id,
      p_redeemed_points,
      'redeemed',
      'Redeemed on Order #' || p_order_number,
      v_order_id
    );
  END IF;

  -- 8. Allocate loyalty points earned
  v_loyalty_points := round(v_recalculated_subtotal);
  IF v_loyalty_points > 0 THEN
    PERFORM public.add_loyalty_points(
      v_user_id,
      v_loyalty_points,
      'earned',
      'Order #' || p_order_number,
      v_order_id
    );
  END IF;

  RETURN v_order_id;
END;
$$;


-- 10. Update add_loyalty_points to support tenant_id
CREATE OR REPLACE FUNCTION public.add_loyalty_points(
  p_user_id uuid,
  p_points integer,
  p_type text,
  p_description text DEFAULT NULL,
  p_order_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance integer;
  v_new_balance integer;
  v_tenant_id uuid;
BEGIN
  -- Resolve user tenant ID
  SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = p_user_id;

  -- Lock the profiles row to prevent race conditions
  SELECT loyalty_points INTO v_current_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    v_current_balance := 0;
  END IF;

  IF p_type = 'earned' THEN
    v_new_balance := v_current_balance + p_points;
  ELSIF p_type = 'redeemed' OR p_type = 'expired' THEN
    v_new_balance := v_current_balance - p_points;
  ELSE
    v_new_balance := v_current_balance + p_points;
  END IF;

  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient loyalty points balance. Available: %, Requested Redemption: %', v_current_balance, p_points;
  END IF;

  UPDATE public.profiles
  SET loyalty_points = v_new_balance,
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.loyalty_transactions (
    user_id,
    type,
    points,
    order_id,
    description,
    balance_after,
    tenant_id
  )
  VALUES (
    p_user_id,
    p_type,
    p_points,
    p_order_id,
    p_description,
    v_new_balance,
    COALESCE(v_tenant_id, public.get_current_tenant_id())
  );
END;
$$;


-- 11. Drop all existing RLS policies
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "addresses_select_own" ON public.addresses;
DROP POLICY IF EXISTS "addresses_insert_own" ON public.addresses;
DROP POLICY IF EXISTS "addresses_update_own" ON public.addresses;
DROP POLICY IF EXISTS "addresses_delete_own" ON public.addresses;
DROP POLICY IF EXISTS "categories_public_read" ON public.categories;
DROP POLICY IF EXISTS "categories_admin_all" ON public.categories;
DROP POLICY IF EXISTS "collections_public_read" ON public.collections;
DROP POLICY IF EXISTS "collections_admin_all" ON public.collections;
DROP POLICY IF EXISTS "products_public_read" ON public.products;
DROP POLICY IF EXISTS "products_admin_all" ON public.products;
DROP POLICY IF EXISTS "product_images_public_read" ON public.product_images;
DROP POLICY IF EXISTS "product_images_admin_all" ON public.product_images;
DROP POLICY IF EXISTS "product_variants_public_read" ON public.product_variants;
DROP POLICY IF EXISTS "product_variants_admin_all" ON public.product_variants;
DROP POLICY IF EXISTS "carts_select_own" ON public.carts;
DROP POLICY IF EXISTS "carts_insert_own" ON public.carts;
DROP POLICY IF EXISTS "carts_update_own" ON public.carts;
DROP POLICY IF EXISTS "carts_delete_own" ON public.carts;
DROP POLICY IF EXISTS "cart_items_select_own" ON public.cart_items;
DROP POLICY IF EXISTS "cart_items_insert_own" ON public.cart_items;
DROP POLICY IF EXISTS "cart_items_update_own" ON public.cart_items;
DROP POLICY IF EXISTS "cart_items_delete_own" ON public.cart_items;
DROP POLICY IF EXISTS "orders_select_own" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_own" ON public.orders;
DROP POLICY IF EXISTS "orders_update_own" ON public.orders;
DROP POLICY IF EXISTS "orders_admin_all" ON public.orders;
DROP POLICY IF EXISTS "order_items_select_own" ON public.order_items;
DROP POLICY IF EXISTS "order_items_admin_all" ON public.order_items;
DROP POLICY IF EXISTS "reviews_public_read" ON public.reviews;
DROP POLICY IF EXISTS "reviews_insert_own" ON public.reviews;
DROP POLICY IF EXISTS "reviews_update_own" ON public.reviews;
DROP POLICY IF EXISTS "reviews_delete_own" ON public.reviews;
DROP POLICY IF EXISTS "wishlists_select_own" ON public.wishlists;
DROP POLICY IF EXISTS "wishlists_insert_own" ON public.wishlists;
DROP POLICY IF EXISTS "wishlists_delete_own" ON public.wishlists;
DROP POLICY IF EXISTS "coupons_public_read" ON public.coupons;
DROP POLICY IF EXISTS "coupons_admin_all" ON public.coupons;
DROP POLICY IF EXISTS "loyalty_transactions_select_own" ON public.loyalty_transactions;
DROP POLICY IF EXISTS "loyalty_transactions_insert_admin" ON public.loyalty_transactions;
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
DROP POLICY IF EXISTS "contact_submissions_insert_public" ON public.contact_submissions;
DROP POLICY IF EXISTS "contact_submissions_admin_all" ON public.contact_submissions;
DROP POLICY IF EXISTS "faqs_public_read" ON public.faqs;
DROP POLICY IF EXISTS "faqs_admin_all" ON public.faqs;
DROP POLICY IF EXISTS "pages_public_read" ON public.pages;
DROP POLICY IF EXISTS "pages_admin_all" ON public.pages;
DROP POLICY IF EXISTS "banners_public_read" ON public.banners;
DROP POLICY IF EXISTS "banners_admin_all" ON public.banners;
DROP POLICY IF EXISTS "site_settings_public_read" ON public.site_settings;
DROP POLICY IF EXISTS "site_settings_admin_all" ON public.site_settings;


-- 12. Create strict tenant-isolated and admin-enforced RLS policies

-- A. user_roles policies
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT
  TO authenticated USING (auth.uid() = user_id AND tenant_id = public.get_current_tenant_id());
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL
  TO authenticated USING (
    tenant_id = public.get_current_tenant_id() AND (
      public.jwt_has_admin_role() OR EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- B. profiles policies
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT
  TO authenticated USING (auth.uid() = id AND tenant_id = public.get_current_tenant_id());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id AND tenant_id = public.get_current_tenant_id())
  WITH CHECK (auth.uid() = id AND tenant_id = public.get_current_tenant_id());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id AND tenant_id = public.get_current_tenant_id());
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL
  TO authenticated USING (
    tenant_id = public.get_current_tenant_id() AND (
      public.jwt_has_admin_role() OR EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- C. addresses policies
CREATE POLICY "addresses_own_all" ON public.addresses FOR ALL
  TO authenticated USING (auth.uid() = user_id AND tenant_id = public.get_current_tenant_id())
  WITH CHECK (auth.uid() = user_id AND tenant_id = public.get_current_tenant_id());
CREATE POLICY "addresses_admin_all" ON public.addresses FOR ALL
  TO authenticated USING (
    tenant_id = public.get_current_tenant_id() AND (
      public.jwt_has_admin_role() OR EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- D. categories policies
CREATE POLICY "categories_public_read" ON public.categories FOR SELECT
  TO public USING (is_active = TRUE AND tenant_id = public.get_current_tenant_id());
CREATE POLICY "categories_admin_all" ON public.categories FOR ALL
  TO authenticated USING (
    tenant_id = public.get_current_tenant_id() AND (
      public.jwt_has_admin_role() OR EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- E. collections policies
CREATE POLICY "collections_public_read" ON public.collections FOR SELECT
  TO public USING (is_active = TRUE AND tenant_id = public.get_current_tenant_id());
CREATE POLICY "collections_admin_all" ON public.collections FOR ALL
  TO authenticated USING (
    tenant_id = public.get_current_tenant_id() AND (
      public.jwt_has_admin_role() OR EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- F. products policies
CREATE POLICY "products_public_read" ON public.products FOR SELECT
  TO public USING (is_active = TRUE AND tenant_id = public.get_current_tenant_id());
CREATE POLICY "products_admin_all" ON public.products FOR ALL
  TO authenticated USING (
    tenant_id = public.get_current_tenant_id() AND (
      public.jwt_has_admin_role() OR EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- G. product_images policies
CREATE POLICY "product_images_public_read" ON public.product_images FOR SELECT
  TO public USING (
    tenant_id = public.get_current_tenant_id() AND EXISTS (
      SELECT 1 FROM public.products WHERE id = product_id AND is_active = TRUE
    )
  );
CREATE POLICY "product_images_admin_all" ON public.product_images FOR ALL
  TO authenticated USING (
    tenant_id = public.get_current_tenant_id() AND (
      public.jwt_has_admin_role() OR EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- H. product_variants policies
CREATE POLICY "product_variants_public_read" ON public.product_variants FOR SELECT
  TO public USING (
    tenant_id = public.get_current_tenant_id() AND EXISTS (
      SELECT 1 FROM public.products WHERE id = product_id AND is_active = TRUE
    )
  );
CREATE POLICY "product_variants_admin_all" ON public.product_variants FOR ALL
  TO authenticated USING (
    tenant_id = public.get_current_tenant_id() AND (
      public.jwt_has_admin_role() OR EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- I. carts policies
CREATE POLICY "carts_own_all" ON public.carts FOR ALL
  TO authenticated USING (auth.uid() = user_id AND tenant_id = public.get_current_tenant_id())
  WITH CHECK (auth.uid() = user_id AND tenant_id = public.get_current_tenant_id());
CREATE POLICY "carts_admin_all" ON public.carts FOR ALL
  TO authenticated USING (
    tenant_id = public.get_current_tenant_id() AND (
      public.jwt_has_admin_role() OR EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- J. cart_items policies
CREATE POLICY "cart_items_own_all" ON public.cart_items FOR ALL
  TO authenticated USING (
    tenant_id = public.get_current_tenant_id() AND EXISTS (
      SELECT 1 FROM public.carts WHERE id = cart_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id = public.get_current_tenant_id() AND EXISTS (
      SELECT 1 FROM public.carts WHERE id = cart_id AND user_id = auth.uid()
    )
  );

-- K. orders policies
CREATE POLICY "orders_own_read" ON public.orders FOR SELECT
  TO authenticated USING (auth.uid() = user_id AND tenant_id = public.get_current_tenant_id());
CREATE POLICY "orders_own_insert" ON public.orders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id AND tenant_id = public.get_current_tenant_id());
CREATE POLICY "orders_own_update" ON public.orders FOR UPDATE
  TO authenticated USING (auth.uid() = user_id AND tenant_id = public.get_current_tenant_id())
  WITH CHECK (auth.uid() = user_id AND tenant_id = public.get_current_tenant_id());
CREATE POLICY "orders_admin_all" ON public.orders FOR ALL
  TO authenticated USING (
    tenant_id = public.get_current_tenant_id() AND (
      public.jwt_has_admin_role() OR EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- L. order_items policies
CREATE POLICY "order_items_own_read" ON public.order_items FOR SELECT
  TO authenticated USING (
    tenant_id = public.get_current_tenant_id() AND EXISTS (
      SELECT 1 FROM public.orders WHERE id = order_id AND user_id = auth.uid()
    )
  );
CREATE POLICY "order_items_admin_all" ON public.order_items FOR ALL
  TO authenticated USING (
    tenant_id = public.get_current_tenant_id() AND (
      public.jwt_has_admin_role() OR EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- M. reviews policies
CREATE POLICY "reviews_public_read" ON public.reviews FOR SELECT
  TO public USING (
    tenant_id = public.get_current_tenant_id() AND (
      is_approved = TRUE OR public.jwt_has_admin_role() OR EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );
CREATE POLICY "reviews_own_all" ON public.reviews FOR ALL
  TO authenticated USING (auth.uid() = user_id AND tenant_id = public.get_current_tenant_id())
  WITH CHECK (auth.uid() = user_id AND tenant_id = public.get_current_tenant_id());
CREATE POLICY "reviews_admin_all" ON public.reviews FOR ALL
  TO authenticated USING (
    tenant_id = public.get_current_tenant_id() AND (
      public.jwt_has_admin_role() OR EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- N. wishlists policies
CREATE POLICY "wishlists_own_all" ON public.wishlists FOR ALL
  TO authenticated USING (auth.uid() = user_id AND tenant_id = public.get_current_tenant_id())
  WITH CHECK (auth.uid() = user_id AND tenant_id = public.get_current_tenant_id());
CREATE POLICY "wishlists_admin_all" ON public.wishlists FOR ALL
  TO authenticated USING (
    tenant_id = public.get_current_tenant_id() AND (
      public.jwt_has_admin_role() OR EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- O. coupons policies
CREATE POLICY "coupons_public_read" ON public.coupons FOR SELECT
  TO public USING (is_active = TRUE AND tenant_id = public.get_current_tenant_id());
CREATE POLICY "coupons_admin_all" ON public.coupons FOR ALL
  TO authenticated USING (
    tenant_id = public.get_current_tenant_id() AND (
      public.jwt_has_admin_role() OR EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- P. loyalty_transactions policies
CREATE POLICY "loyalty_transactions_own_read" ON public.loyalty_transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id AND tenant_id = public.get_current_tenant_id());
CREATE POLICY "loyalty_transactions_admin_all" ON public.loyalty_transactions FOR ALL
  TO authenticated USING (
    tenant_id = public.get_current_tenant_id() AND (
      public.jwt_has_admin_role() OR EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- Q. notifications policies
CREATE POLICY "notifications_own_all" ON public.notifications FOR ALL
  TO authenticated USING (auth.uid() = user_id AND tenant_id = public.get_current_tenant_id())
  WITH CHECK (auth.uid() = user_id AND tenant_id = public.get_current_tenant_id());
CREATE POLICY "notifications_admin_all" ON public.notifications FOR ALL
  TO authenticated USING (
    tenant_id = public.get_current_tenant_id() AND (
      public.jwt_has_admin_role() OR EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- R. contact_submissions policies
CREATE POLICY "contact_submissions_insert_public" ON public.contact_submissions FOR INSERT
  TO public WITH CHECK (tenant_id = public.get_current_tenant_id());
CREATE POLICY "contact_submissions_admin_all" ON public.contact_submissions FOR ALL
  TO authenticated USING (
    tenant_id = public.get_current_tenant_id() AND (
      public.jwt_has_admin_role() OR EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- S. faqs policies
CREATE POLICY "faqs_public_read" ON public.faqs FOR SELECT
  TO public USING (is_active = TRUE AND tenant_id = public.get_current_tenant_id());
CREATE POLICY "faqs_admin_all" ON public.faqs FOR ALL
  TO authenticated USING (
    tenant_id = public.get_current_tenant_id() AND (
      public.jwt_has_admin_role() OR EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- T. pages policies
CREATE POLICY "pages_public_read" ON public.pages FOR SELECT
  TO public USING (is_published = TRUE AND tenant_id = public.get_current_tenant_id());
CREATE POLICY "pages_admin_all" ON public.pages FOR ALL
  TO authenticated USING (
    tenant_id = public.get_current_tenant_id() AND (
      public.jwt_has_admin_role() OR EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- U. banners policies
CREATE POLICY "banners_public_read" ON public.banners FOR SELECT
  TO public USING (
    is_active = TRUE 
    AND (end_date IS NULL OR end_date > NOW()) 
    AND tenant_id = public.get_current_tenant_id()
  );
CREATE POLICY "banners_admin_all" ON public.banners FOR ALL
  TO authenticated USING (
    tenant_id = public.get_current_tenant_id() AND (
      public.jwt_has_admin_role() OR EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- V. site_settings policies
CREATE POLICY "site_settings_public_read" ON public.site_settings FOR SELECT
  TO public USING (tenant_id = public.get_current_tenant_id());
CREATE POLICY "site_settings_admin_all" ON public.site_settings FOR ALL
  TO authenticated USING (
    tenant_id = public.get_current_tenant_id() AND (
      public.jwt_has_admin_role() OR EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );
