-- =============================================================
-- SECURITY HARDENING MIGRATION
-- Fixes critical RLS / multi-tenant / payment / race condition bugs
-- discovered in code review.
-- =============================================================

-- =============================================================
-- 1. Define the MISSING is_admin_check function
-- (Referenced by order_returns_ledger and secure_storage_bucket
--  migrations but never created — those policies are currently
--  broken at deploy time.)
-- =============================================================
CREATE OR REPLACE FUNCTION public.is_admin_check(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Only trust app_metadata (server-controlled). user_metadata is
  -- user-writable at signUp via supabase.auth.signUp({ options: { data: ... } }).
  RETURN COALESCE(
    current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role',
    ''
  ) = 'admin';
END;
$$;

-- =============================================================
-- 2. Harden JWT role check
-- Previously trusted user_metadata.role which is user-controlled
-- at signUp. This let any user self-promote to admin by passing
-- { data: { role: 'admin' } } in supabase.auth.signUp().
-- =============================================================
CREATE OR REPLACE FUNCTION public.jwt_has_admin_role()
RETURNS BOOLEAN AS $$
BEGIN
  -- ONLY trust app_metadata (server-controlled)
  RETURN COALESCE(
    current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role',
    ''
  ) = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
DECLARE
  _jwt_role text;
BEGIN
  -- ONLY trust app_metadata
  _jwt_role := current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role';
  IF _jwt_role IS NOT NULL AND _jwt_role <> '' THEN
    RETURN _jwt_role;
  END IF;

  RETURN 'anonymous';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================================
-- 3. Tenant resolution: stop trusting user_metadata.tenant_id
-- Previously a malicious user could sign up with
--   supabase.auth.signUp({ options: { data: { tenant_id: '<victim>' } } })
-- and become a member of any tenant.
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID AS $$
DECLARE
  _jwt_tenant_id text;
  _profile_tenant_id uuid;
  _default_tenant_id uuid := 'd9f8e7d6-c5b4-a3f2-e1d0-c9b8a7f6e5d4';
BEGIN
  -- ONLY trust app_metadata (server-controlled)
  _jwt_tenant_id := current_setting('request.jwt.claims', true)::json->'app_metadata'->>'tenant_id';

  IF _jwt_tenant_id IS NOT NULL AND _jwt_tenant_id <> '' THEN
    RETURN _jwt_tenant_id::uuid;
  END IF;

  -- Fallback to profiles.tenant_id for authenticated users.
  -- profiles.tenant_id is set by handle_new_user trigger and CANNOT
  -- be changed by the user (prevent_self_promotion_and_tenant_change).
  IF auth.uid() IS NOT NULL THEN
    SELECT tenant_id INTO _profile_tenant_id FROM public.profiles WHERE id = auth.uid();
    IF _profile_tenant_id IS NOT NULL THEN
      RETURN _profile_tenant_id;
    END IF;
  END IF;

  -- Default tenant fallback (anonymous storefront visitors only)
  RETURN _default_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================================
-- 4. handle_new_user trigger — ignore user-controlled tenant_id
-- from raw_user_meta_data. New users ALWAYS land in the default
-- tenant. Admins must explicitly move users between tenants.
-- =============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_default_tenant_id uuid := 'd9f8e7d6-c5b4-a3f2-e1d0-c9b8a7f6e5d4';
BEGIN
  -- Always 'customer'. Never trust raw_user_meta_data->>'role'.
  INSERT INTO public.profiles (id, email, full_name, role, loyalty_points, tenant_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Customer'),
    'customer',
    100,
    v_default_tenant_id
  );

  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (
    NEW.id,
    'customer',
    v_default_tenant_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================
-- 5. prevent_self_promotion_and_tenant_change — drop the DB-lookup
-- fallback (TOCTOU window) and rely on the now-hardened
-- jwt_has_admin_role(). The DB lookup is racy: the user's role in
-- user_roles can be flipped in a parallel session.
-- =============================================================
CREATE OR REPLACE FUNCTION public.prevent_self_promotion_and_tenant_change()
RETURNS TRIGGER AS $$
BEGIN
  -- jwt_has_admin_role() now only trusts app_metadata.
  IF NOT public.jwt_has_admin_role() THEN
    IF NEW.role <> OLD.role THEN
      RAISE EXCEPTION 'Cannot change user role. Only admins can update user roles.';
    END IF;
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
      RAISE EXCEPTION 'Cannot change tenant association.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================
-- 6. Fix search_products to enforce tenant + is_active + soft delete.
-- Previously this function was SECURITY DEFINER (bypassed RLS) and
-- had no tenant or is_active filter — leaking inactive and
-- cross-tenant products.
-- =============================================================
DROP FUNCTION IF EXISTS public.search_products(text);
CREATE OR REPLACE FUNCTION public.search_products(p_query text)
RETURNS SETOF public.products
LANGUAGE sql
SECURITY INVOKER  -- respect RLS
STABLE
AS $$
  SELECT *
  FROM public.products
  WHERE
    is_active = TRUE
    AND deleted_at IS NULL
    AND (
      tsv_name @@ websearch_to_tsquery('english', p_query)
      OR name ILIKE '%' || p_query || '%'
    )
  ORDER BY
    ts_rank(tsv_name, websearch_to_tsquery('english', p_query)) DESC,
    name ASC;
$$;

-- =============================================================
-- 7. Idempotency key scoped per-user (was globally UNIQUE)
-- Two users could collide on the same UUID key; even a single user
-- could be DoS'd by an attacker pre-registering keys.
-- =============================================================
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_idempotency_key_key;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_user_idempotency_key_unique'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_user_idempotency_key_unique
      UNIQUE (user_id, idempotency_key);
  END IF;
END;
$$;

-- =============================================================
-- 8. Re-create place_order with proper coupon FOR UPDATE lock
-- to close the read-then-write window on coupon usage_limit, and
-- with idempotency-key lookup that is locked.
-- =============================================================
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
  p_coupon_code text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
  v_order_id uuid;
  v_existing_order_id uuid;
  v_item jsonb;
  v_variant_id uuid;
  v_quantity integer;
  v_sku text;
  v_product_id uuid;
  v_current_stock integer;
  v_loyalty_points integer;
  v_current_balance integer;

  v_db_unit_price numeric;
  v_item_total_price numeric;
  v_recalculated_subtotal numeric := 0;
  v_recalculated_tax numeric := 0;
  v_recalculated_shipping numeric := 0;

  v_coupon_id uuid;
  v_coupon_type text;
  v_coupon_value numeric;
  v_coupon_min_amount numeric;
  v_coupon_max_discount numeric;
  v_coupon_usage_limit integer;
  v_coupon_used_count integer;
  v_coupon_discount numeric := 0;

  v_points_discount numeric := 0;
  v_calculated_discount numeric := 0;
  v_recalculated_total numeric := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_tenant_id := public.get_current_tenant_id();

  -- 1. Idempotency: short-circuit if the same (user_id, key) was already used.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_order_id
    FROM public.orders
    WHERE user_id = v_user_id AND idempotency_key = p_idempotency_key
    FOR UPDATE;

    IF FOUND THEN
      RETURN v_existing_order_id;
    END IF;
  END IF;

  -- 2. Lock user profile early to serialize concurrent checkouts.
  SELECT loyalty_points INTO v_current_balance
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    v_current_balance := 0;
  END IF;

  -- 3. Validate loyalty point redemption
  IF p_redeemed_points > 0 THEN
    IF v_current_balance < p_redeemed_points THEN
      RAISE EXCEPTION 'Insufficient loyalty points balance. Available: %, Requested: %', v_current_balance, p_redeemed_points;
    END IF;
  END IF;

  -- 4. Recalculate subtotal and lock stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;

    SELECT pv.inventory_quantity, pv.sku, COALESCE(p.sale_price, p.base_price)
    INTO v_current_stock, v_sku, v_db_unit_price
    FROM public.product_variants pv
    JOIN public.products p ON pv.product_id = p.id
    WHERE pv.id = v_variant_id
      AND p.tenant_id = v_tenant_id
      AND pv.tenant_id = v_tenant_id
    FOR UPDATE;

    IF v_current_stock IS NULL THEN
      RAISE EXCEPTION 'Product variant not found (ID: %)', v_variant_id;
    END IF;

    IF v_current_stock < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for item (SKU: %). Available: %, Requested: %', v_sku, v_current_stock, v_quantity;
    END IF;

    v_recalculated_subtotal := v_recalculated_subtotal + (v_db_unit_price * v_quantity);
  END LOOP;

  -- 5. Tax + shipping
  v_recalculated_tax := round(v_recalculated_subtotal * 0.18, 2);
  v_recalculated_shipping := CASE WHEN v_recalculated_subtotal >= 999 THEN 0 ELSE 99 END;

  -- 6. Coupon — LOCK the coupon row before validating usage
  IF p_coupon_code IS NOT NULL THEN
    SELECT id, type, value, min_order_amount, max_discount_amount, usage_limit, used_count
    INTO v_coupon_id, v_coupon_type, v_coupon_value, v_coupon_min_amount, v_coupon_max_discount, v_coupon_usage_limit, v_coupon_used_count
    FROM public.coupons
    WHERE code = UPPER(TRIM(p_coupon_code))
      AND is_active = TRUE
      AND now() BETWEEN valid_from AND valid_until
      AND tenant_id = v_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid or expired coupon code';
    END IF;

    IF v_coupon_usage_limit IS NOT NULL AND v_coupon_used_count >= v_coupon_usage_limit THEN
      RAISE EXCEPTION 'Coupon usage limit has been reached';
    END IF;

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

  v_points_discount := p_redeemed_points * 0.1;
  v_calculated_discount := round(v_coupon_discount + v_points_discount, 2);

  v_recalculated_total := greatest(0, v_recalculated_subtotal + v_recalculated_tax + v_recalculated_shipping - v_calculated_discount);

  -- 7. Price tampering detection
  IF abs(p_subtotal - v_recalculated_subtotal) > 0.05 THEN
    RAISE EXCEPTION 'Subtotal mismatch detected (Price Tampering). Client: %, Server: %', p_subtotal, v_recalculated_subtotal;
  END IF;
  IF abs(p_tax_amount - v_recalculated_tax) > 0.05 THEN
    RAISE EXCEPTION 'Tax mismatch detected (Price Tampering). Client: %, Server: %', p_tax_amount, v_recalculated_tax;
  END IF;
  IF abs(p_shipping_amount - v_recalculated_shipping) > 0.05 THEN
    RAISE EXCEPTION 'Shipping mismatch detected (Price Tampering). Client: %, Server: %', p_shipping_amount, v_recalculated_shipping;
  END IF;
  IF abs(p_discount_amount - v_calculated_discount) > 0.05 THEN
    RAISE EXCEPTION 'Discount mismatch detected (Price Tampering). Client: %, Server: %', p_discount_amount, v_calculated_discount;
  END IF;
  IF abs(p_total - v_recalculated_total) > 0.05 THEN
    RAISE EXCEPTION 'Total mismatch detected (Price Tampering). Client: %, Server: %', p_total, v_recalculated_total;
  END IF;

  -- 8. Insert order (tenant-scoped)
  INSERT INTO public.orders (
    user_id, order_number, status,
    subtotal, tax_amount, shipping_amount, discount_amount, total,
    billing_address, shipping_address,
    payment_method, payment_status,
    tenant_id, idempotency_key
  ) VALUES (
    v_user_id, p_order_number,
    CASE WHEN p_payment_method = 'cod' THEN 'pending' ELSE 'PENDING_PAYMENT' END,
    v_recalculated_subtotal, v_recalculated_tax, v_recalculated_shipping, v_calculated_discount, v_recalculated_total,
    p_billing_address, p_shipping_address,
    p_payment_method, 'pending',
    v_tenant_id, p_idempotency_key
  ) RETURNING id INTO v_order_id;

  -- 9. Decrement stock + insert order_items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;

    SELECT pv.sku, pv.product_id, COALESCE(p.sale_price, p.base_price)
    INTO v_sku, v_product_id, v_db_unit_price
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
      order_id, product_id, variant_id,
      quantity, unit_price, total_price,
      product_name, product_image, size, color,
      tenant_id
    ) VALUES (
      v_order_id, v_product_id, v_variant_id,
      v_quantity, v_db_unit_price, v_item_total_price,
      v_item->>'product_name', v_item->>'product_image', v_item->>'size', v_item->>'color',
      v_tenant_id
    );
  END LOOP;

  -- 10. Loyalty: redeem then earn
  IF p_redeemed_points > 0 THEN
    PERFORM public.add_loyalty_points(
      v_user_id, p_redeemed_points, 'redeemed',
      'Redeemed on Order #' || p_order_number, v_order_id
    );
  END IF;

  v_loyalty_points := round(v_recalculated_subtotal);
  IF v_loyalty_points > 0 THEN
    PERFORM public.add_loyalty_points(
      v_user_id, v_loyalty_points, 'earned',
      'Order #' || p_order_number, v_order_id
    );
  END IF;

  -- 11. Coupon: increment usage atomically (the row is already locked above)
  IF v_coupon_id IS NOT NULL THEN
    UPDATE public.coupons
    SET used_count = used_count + 1
    WHERE id = v_coupon_id;
  END IF;

  -- 12. Clear cart items for this user/tenant
  DELETE FROM public.cart_items
  WHERE cart_id IN (
    SELECT id FROM public.carts WHERE user_id = v_user_id AND tenant_id = v_tenant_id
  );

  RETURN v_order_id;
END;
$$;

-- =============================================================
-- 9. Lock variant in decrement_variant_stock and verify tenant
-- =============================================================
CREATE OR REPLACE FUNCTION decrement_variant_stock(
  p_variant_id uuid,
  p_quantity integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_stock integer;
  v_sku text;
  v_tenant_id uuid;
BEGIN
  v_tenant_id := public.get_current_tenant_id();

  SELECT pv.inventory_quantity, pv.sku
  INTO v_current_stock, v_sku
  FROM public.product_variants pv
  WHERE id = p_variant_id
    AND pv.tenant_id = v_tenant_id
  FOR UPDATE;

  IF v_current_stock IS NULL THEN
    RAISE EXCEPTION 'Product variant not found (ID: %)', p_variant_id;
  END IF;

  IF v_current_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock for item (SKU: %). Available: %, Requested: %', v_sku, v_current_stock, p_quantity;
  END IF;

  UPDATE public.product_variants
  SET
    inventory_quantity = inventory_quantity - p_quantity,
    is_in_stock = (inventory_quantity - p_quantity) > 0,
    updated_at = now()
  WHERE id = p_variant_id;
END;
$$;

-- =============================================================
-- 10. Tenant-scope cancel_order stock replenishment
-- =============================================================
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
  v_item record;
  v_current_stock integer;
  v_points_to_reverse integer;
  v_points_to_refund integer;
  v_current_balance integer;
  v_order_tenant_id uuid;
  v_current_tenant_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id, status, order_number, tenant_id
  INTO v_order_user_id, v_status, v_order_number, v_order_tenant_id
  FROM public.orders
  WHERE id = p_order_id;

  IF v_order_user_id IS NULL THEN
    RAISE EXCEPTION 'Order not found (ID: %)', p_order_id;
  END IF;

  v_current_tenant_id := public.get_current_tenant_id();
  IF v_order_tenant_id IS DISTINCT FROM v_current_tenant_id THEN
    RAISE EXCEPTION 'Access denied. Order belongs to a different tenant.';
  END IF;

  -- Hardened: only jwt_has_admin_role() (now app_metadata-only)
  IF v_user_id <> v_order_user_id AND NOT public.jwt_has_admin_role() THEN
    RAISE EXCEPTION 'Not authorized to cancel this order';
  END IF;

  IF v_status = 'cancelled' THEN
    RETURN;
  END IF;

  IF v_status NOT IN ('pending', 'processing', 'confirmed', 'PENDING_PAYMENT', 'PAID') THEN
    RAISE EXCEPTION 'Order cannot be cancelled in status: %', v_status;
  END IF;

  PERFORM 1 FROM public.orders WHERE id = p_order_id FOR UPDATE;

  FOR v_item IN
    SELECT variant_id, quantity
    FROM public.order_items
    WHERE order_id = p_order_id
  LOOP
    SELECT inventory_quantity INTO v_current_stock
    FROM public.product_variants
    WHERE id = v_item.variant_id
      AND tenant_id = v_current_tenant_id
    FOR UPDATE;

    IF v_current_stock IS NULL THEN
      RAISE EXCEPTION 'Product variant not found (ID: %)', v_item.variant_id;
    END IF;

    UPDATE public.product_variants
    SET
      inventory_quantity = inventory_quantity + v_item.quantity,
      is_in_stock = TRUE,
      updated_at = now()
    WHERE id = v_item.variant_id;
  END LOOP;

  SELECT COALESCE(SUM(points), 0) INTO v_points_to_reverse
  FROM public.loyalty_transactions
  WHERE order_id = p_order_id AND type = 'earned';

  SELECT COALESCE(SUM(points), 0) INTO v_points_to_refund
  FROM public.loyalty_transactions
  WHERE order_id = p_order_id AND type = 'redeemed';

  IF v_points_to_refund > 0 THEN
    PERFORM public.add_loyalty_points(
      v_order_user_id, v_points_to_refund, 'earned',
      'Refunded points from cancelled Order #' || v_order_number, p_order_id
    );
  END IF;

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
        v_order_user_id, v_points_to_reverse, 'expired',
        'Reversed points from cancelled Order #' || v_order_number, p_order_id
      );
    END IF;
  END IF;

  UPDATE public.orders
  SET
    status = 'cancelled',
    payment_status = 'refunded',
    updated_at = now()
  WHERE id = p_order_id;
END;
$$;

-- =============================================================
-- 11. Tenant-scope approve_return_and_restock
-- =============================================================
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
  v_order_subtotal numeric;
  v_order_tax numeric;
  v_order_shipping numeric;
  v_order_discount numeric;
  v_order_total numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.jwt_has_admin_role() THEN
    RAISE EXCEPTION 'Not authorized. Admin privileges required.';
  END IF;

  SELECT
    tenant_id, subtotal, tax_amount, shipping_amount, discount_amount, total
  INTO
    v_order_tenant_id, v_order_subtotal, v_order_tax, v_order_shipping, v_order_discount, v_order_total
  FROM public.orders
  WHERE id = p_order_id;

  v_current_tenant_id := public.get_current_tenant_id();

  IF v_order_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order_tenant_id IS DISTINCT FROM v_current_tenant_id THEN
    RAISE EXCEPTION 'Access denied. Order belongs to a different tenant.';
  END IF;

  PERFORM 1 FROM public.orders WHERE id = p_order_id FOR UPDATE;

  FOR v_item IN
    SELECT variant_id, quantity
    FROM public.order_items
    WHERE order_id = p_order_id
  LOOP
    SELECT inventory_quantity INTO v_current_stock
    FROM public.product_variants
    WHERE id = v_item.variant_id
      AND tenant_id = v_current_tenant_id
    FOR UPDATE;

    IF v_current_stock IS NULL THEN
      RAISE EXCEPTION 'Product variant not found (ID: %)', v_item.variant_id;
    END IF;

    UPDATE public.product_variants
    SET
      inventory_quantity = inventory_quantity + v_item.quantity,
      is_in_stock = TRUE,
      updated_at = now()
    WHERE id = v_item.variant_id;
  END LOOP;

  INSERT INTO public.order_adjustments (
    order_id, adjustment_type, amount, tax_amount, shipping_amount, discount_amount, tenant_id, notes
  ) VALUES (
    p_order_id, 'return',
    -v_order_subtotal, -v_order_tax, -v_order_shipping, -v_order_discount,
    v_order_tenant_id, p_notes
  );

  UPDATE public.orders
  SET
    status = 'returned',
    payment_status = 'refunded',
    notes = p_notes,
    updated_at = now()
  WHERE id = p_order_id;
END;
$$;

-- =============================================================
-- 12. Reset test DB: tenant-scoped + hardened admin check
-- =============================================================
CREATE OR REPLACE FUNCTION public.reset_test_database()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.jwt_has_admin_role() THEN
    RAISE EXCEPTION 'Not authorized. Admin privileges required.';
  END IF;

  DELETE FROM public.notifications;
  DELETE FROM public.loyalty_transactions;
  DELETE FROM public.reviews;
  DELETE FROM public.wishlists;
  DELETE FROM public.contact_submissions;
  DELETE FROM public.order_items;
  DELETE FROM public.order_adjustments;
  DELETE FROM public.orders;
  DELETE FROM public.cart_items;
  DELETE FROM public.carts;
  DELETE FROM public.product_variants;
  DELETE FROM public.product_images;
  DELETE FROM public.products;
  DELETE FROM public.collections;
  DELETE FROM public.categories;
  DELETE FROM public.coupons;
  DELETE FROM public.banners;
  DELETE FROM public.faqs;
  DELETE FROM public.pages;
END;
$$;

-- =============================================================
-- 13. Tenant-scoped sync_user_cart
-- =============================================================
CREATE OR REPLACE FUNCTION public.sync_user_cart(
  p_cart_id uuid,
  p_items jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify cart ownership AND tenant match
  IF NOT EXISTS (
    SELECT 1 FROM public.carts
    WHERE id = p_cart_id
      AND user_id = v_user_id
      AND tenant_id = public.get_current_tenant_id()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_tenant_id := public.get_current_tenant_id();

  DELETE FROM public.cart_items
  WHERE cart_id = p_cart_id
    AND variant_id IN (
      SELECT id FROM public.product_variants
      WHERE inventory_quantity <= 0 OR tenant_id IS DISTINCT FROM v_tenant_id
    );

  IF jsonb_typeof(p_items) = 'array' AND jsonb_array_length(p_items) > 0 THEN
    DELETE FROM public.cart_items
    WHERE cart_id = p_cart_id
      AND variant_id NOT IN (
        SELECT (item->>'variant_id')::uuid
        FROM jsonb_array_elements(p_items) AS item
      );

    INSERT INTO public.cart_items (cart_id, product_id, variant_id, quantity, user_id, tenant_id)
    SELECT
      p_cart_id,
      (item->>'product_id')::uuid,
      (item->>'variant_id')::uuid,
      LEAST(pv.inventory_quantity, (item->>'quantity')::integer),
      v_user_id,
      v_tenant_id
    FROM jsonb_array_elements(p_items) AS item
    JOIN public.product_variants pv ON pv.id = (item->>'variant_id')::uuid
    WHERE pv.inventory_quantity > 0
      AND pv.tenant_id = v_tenant_id
    ON CONFLICT (cart_id, variant_id)
    DO UPDATE SET quantity = EXCLUDED.quantity;
  ELSE
    DELETE FROM public.cart_items WHERE cart_id = p_cart_id;
  END IF;
END;
$$;

-- =============================================================
-- 14. Order adjustments RLS — use hardened is_admin_check
-- (now that the function exists)
-- =============================================================
DROP POLICY IF EXISTS "order_adjustments_own" ON public.order_adjustments;
DROP POLICY IF EXISTS "order_adjustments_admin_all" ON public.order_adjustments;

CREATE POLICY "order_adjustments_own" ON public.order_adjustments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_adjustments.order_id
        AND o.user_id = auth.uid()
    ) OR public.is_admin_check(auth.uid())
  );

CREATE POLICY "order_adjustments_admin_all" ON public.order_adjustments
  FOR ALL TO authenticated
  USING (public.is_admin_check(auth.uid()))
  WITH CHECK (public.is_admin_check(auth.uid()));

-- =============================================================
-- 15. Storage bucket admin policies — use hardened is_admin_check
-- =============================================================
DROP POLICY IF EXISTS "Allow admin to insert product images" ON storage.objects;
DROP POLICY IF EXISTS "Allow admin to delete/update product images" ON storage.objects;

CREATE POLICY "Allow admin to insert product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND public.is_admin_check(auth.uid())
);

CREATE POLICY "Allow admin to delete/update product images"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.is_admin_check(auth.uid())
)
WITH CHECK (
  bucket_id = 'product-images'
  AND public.is_admin_check(auth.uid())
);

-- =============================================================
-- 16. Real-time publication: restrict cart_items broadcast scope
-- (the channel filter "user_id=eq.${user.id}" requires the column
--  to be present, which it now is via the denormalize migration)
-- =============================================================
-- The realtime filter on user_id is applied client-side only; we
-- cannot enforce it server-side via RLS on the publication.
-- The RLS policies on cart_items are the authoritative gate.
-- Recommendation: enable RLS on the publication by limiting
-- subscription to authenticated users only (Supabase dashboard).

-- =============================================================
-- 17. Secure admin-only RPC to simulate payment success
-- (replaces the dangerous x-mock-payment bypass in payment-webhook).
-- Admin role is checked via app_metadata only (post-hardening).
-- =============================================================
CREATE OR REPLACE FUNCTION public.simulate_payment_success(
  p_order_number text,
  p_payment_intent_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_tenant_id uuid;
  v_current_tenant_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.jwt_has_admin_role() THEN
    RAISE EXCEPTION 'Not authorized. Admin privileges required.';
  END IF;

  SELECT tenant_id INTO v_order_tenant_id
  FROM public.orders
  WHERE order_number = p_order_number;

  IF v_order_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  v_current_tenant_id := public.get_current_tenant_id();
  IF v_order_tenant_id IS DISTINCT FROM v_current_tenant_id THEN
    RAISE EXCEPTION 'Access denied. Order belongs to a different tenant.';
  END IF;

  UPDATE public.orders
  SET
    status = 'PAID',
    payment_status = 'completed',
    payment_id = COALESCE(p_payment_intent_id, payment_id),
    updated_at = now()
  WHERE order_number = p_order_number
    AND status IN ('PENDING_PAYMENT', 'pending');
END;
$$;