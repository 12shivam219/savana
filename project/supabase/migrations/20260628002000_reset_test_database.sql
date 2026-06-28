CREATE OR REPLACE FUNCTION public.reset_test_database()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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

  -- Delete from dependent tables first to respect foreign key constraints
  DELETE FROM public.notifications WHERE true;
  DELETE FROM public.loyalty_transactions WHERE true;
  DELETE FROM public.reviews WHERE true;
  DELETE FROM public.wishlists WHERE true;
  DELETE FROM public.contact_submissions WHERE true;
  DELETE FROM public.order_items WHERE true;
  DELETE FROM public.order_adjustments WHERE true;
  DELETE FROM public.orders WHERE true;
  DELETE FROM public.cart_items WHERE true;
  DELETE FROM public.carts WHERE true;
  DELETE FROM public.product_variants WHERE true;
  DELETE FROM public.product_images WHERE true;
  DELETE FROM public.products WHERE true;
  DELETE FROM public.collections WHERE true;
  DELETE FROM public.categories WHERE true;
  DELETE FROM public.coupons WHERE true;
  DELETE FROM public.banners WHERE true;
  DELETE FROM public.faqs WHERE true;
  DELETE FROM public.pages WHERE true;

  -- Re-seed collections
  INSERT INTO public.collections (id, name, slug, description, season, type, image_url, is_active) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Summer Essentials', 'summer-essentials', 'Light, breathable fabrics for the hot months', 'summer', 'new-arrivals', 'https://images.pexels.com/photos/1536679/pexels-photo-1536679.jpeg?auto=compress&cs=tinysrgb&w=800', true),
  ('22222222-2222-2222-2222-222222222222', 'Monsoon Ready', 'monsoon-ready', 'Water-resistant styles for the rainy season', 'monsoon', 'best-sellers', 'https://images.pexels.com/photos/1447267/pexels-photo-1447267.jpeg?auto=compress&cs=tinysrgb&w=800', true),
  ('33333333-3333-3333-3333-333333333333', 'Autumn Vibes', 'autumn-vibes', 'Warm tones and cozy layers', 'autumn', 'new-arrivals', 'https://images.pexels.com/photos/1598505/pexels-photo-1598505.jpeg?auto=compress&cs=tinysrgb&w=800', true),
  ('44444444-4444-4444-4444-444444444444', 'Winter Collection', 'winter-collection', 'Stay warm in style this winter', 'winter', 'new-arrivals', 'https://images.pexels.com/photos/14793928/pexels-photo-14793928.jpeg?auto=compress&cs=tinysrgb&w=800', true),
  ('55555555-5555-5555-5555-555555555555', 'Festive Edit', 'festive-edit', 'Celebrate in style with our festive collection', 'festive', 'limited-edition', 'https://images.pexels.com/photos/15385049/pexels-photo-15385049.jpeg?auto=compress&cs=tinysrgb&w=800', true);

  -- Re-seed categories
  INSERT INTO public.categories (id, name, slug, description, sort_order, is_active) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Men', 'men', 'Mens fashion collection', 1, true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Women', 'women', 'Womens fashion collection', 2, true),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Unisex', 'unisex', 'Unisex styles for everyone', 3, true);

  -- Re-seed products
  INSERT INTO public.products (id, sku, name, slug, description, short_description, category, season, collection_id, base_price, sale_price, tags, fabric_material, care_instructions, is_featured, is_new_arrival, is_best_seller, is_active) VALUES
  ('a0000001-0001-0001-0001-000000000001', 'SUM-TSH-001', 'Premium Irish Linen Relaxed-Fit Shirt', 'breezy-linen-shirt', 'Crafted from 100% authentic Irish linen, this relaxed-fit shirt embodies effortless sophistication for warm-weather styling. The natural breathability and moisture-wicking properties of linen keep you cool even on the hottest days. Features a spread collar, mother-of-pearl buttons, and a curved hem perfect for untucked wear. Slightly textured handfeel that softens beautifully with each wash.', 'Authentic Irish linen with natural texture and breathability', 'men', 'summer', '11111111-1111-1111-1111-111111111111', 2899.00, 2247.00, ARRAY['linen', 'summer', 'breathable', 'premium', 'relaxed-fit', 'sustainable'], '100% Genuine Irish Linen, 150 GSM', ARRAY['Machine wash cold, gentle cycle', 'Tumble dry low or line dry', 'Warm iron if needed', 'Do not bleach'], true, true, false, true),
  ('a0000002-0001-0001-0001-000000000002', 'SUM-DRE-002', 'Silk-Blend Midi Slip Dress with Cowl Neck', 'flowy-maxi-dress', 'An elegant midi dress crafted from luxurious silk-viscose blend that drapes beautifully over your silhouette. The cowl neckline adds a touch of old-Hollywood glamour while adjustable spaghetti straps ensure the perfect fit. Fully lined with lightweight crepe for comfort and opacity. Features a subtle side slit for ease of movement. Perfect for evening occasions, destination weddings, or elevated everyday wear.', 'Luxurious silk-viscose blend with elegant cowl drape', 'women', 'summer', '11111111-1111-1111-1111-111111111111', 4599.00, NULL, ARRAY['silk', 'dress', 'evening', 'wedding-guest', 'elegant', 'lined'], '70% Silk, 30% Viscose Blend', ARRAY['Dry clean recommended', 'Steam to refresh', 'Store on padded hanger', 'Avoid direct sunlight'], true, true, true, true),
  ('a0000003-0001-0001-0001-000000000003', 'MON-JAC-001', 'Technical Waterproof Trench Coat with Sealed Seams', 'waterproof-jacket', 'Engineered for the modern urbanite, this waterproof trench combines classic styling with cutting-edge performance technology. Features fully taped seams, a water-repellent DWR coating rated to 10,000mm, and a breathable membrane that prevents overheating. The three-quarter length provides coverage without restricting movement. Detachable hood, storm flaps, and secure zip pockets protect your essentials. Windproof to 80 km/h.', 'Professional-grade waterproofing in a timeless silhouette', 'unisex', 'monsoon', '22222222-2222-2222-2222-222222222222', 7499.00, 5247.00, ARRAY['waterproof', 'monsoon', 'technical', 'trench', 'windproof', 'urban'], 'Recycled Polyester with TPU Membrane', ARRAY['Machine wash cold, close zippers', 'Do not use fabric softener', 'Tumble dry low', 'Reapply DWR spray seasonally'], true, false, true, true),
  ('a0000004-0001-0001-0001-000000000004', 'MON-JEA-002', 'Athleisure Quick-Dry Joggers with 4-Way Stretch', 'quick-dry-joggers', 'Designed for both performance and everyday wear, these joggers feature advanced moisture-wicking fabric that dries 3x faster than cotton. The 4-way stretch construction moves with you through yoga, running, or weekend errands. Elastic waistband with inner drawcord ensures a custom fit. Features zip cargo pockets, tapered leg silhouette, and reflective accent trims for low-light visibility. UPF 30+ sun protection built in.', 'Performance joggers with moisture-wicking technology', 'men', 'monsoon', '22222222-2222-2222-2222-222222222222', 2899.00, NULL, ARRAY['athleisure', 'monsoon', 'quick-dry', 'performance', 'workout', 'UPF'], '88% Recycled Polyester, 12% Elastane', ARRAY['Machine wash cold', 'Tumble dry low', 'Do not iron', 'Do not use bleach'], false, true, false, true),
  ('a0000005-0001-0001-0001-000000000005', 'AUT-SWE-001', 'Cashmere-Blend Oversized Knit Sweater', 'cotton-blend-sweater', 'Wrap yourself in cloud-like softness with this luxurious cashmere-blend sweater. The relaxed oversized silhouette offers contemporary elegance with dropped shoulders and ribbed trim details. Knit from premium Mongolian cashmere blended with fine merino wool for durability and warmth without weight. Pre-washed for extra softness and to prevent pilling. The perfect layering piece for crisp autumn evenings and cool mountain getaways.', 'Luxuriously soft cashmere-blend in relaxed proportions', 'unisex', 'autumn', '33333333-3333-3333-3333-333333333333', 5299.00, NULL, ARRAY['cashmere', 'autumn', 'luxury', 'oversized', 'cozy', 'knitwear'], '60% Cashmere, 40% Extra-Fine Merino Wool', ARRAY['Hand wash cold or dry clean', 'Lay flat to dry', 'Fold for storage', 'Steam to refresh'], true, true, false, true),
  ('a0000006-0001-0001-0001-000000000006', 'AUT-KUR-002', 'Hand-Crafted Ajrakh Block Print Kurta Set', 'block-print-kurta', 'A masterpiece of traditional Indian craftsmanship, this kurta features authentic Ajrakh block printing by master artisans from Kutch, Gujarat. Each piece is hand-printed using natural dyes derived from madder root, indigo, and pomegranite, creating the distinctive double-sided pattern true to 4,000-year-old techniques. The relaxed silhouette includes a mandarin collar, wooden button placket, and side slits. Comes with matching straight-cut pyjama.', 'Authentic Ajrakh hand block print with natural dyes', 'men', 'autumn', '33333333-3333-3333-3333-333333333333', 4899.00, NULL, ARRAY['ajrakh', 'ethnic', 'handcrafted', 'artisan', 'natural-dye', 'kurta'], '100% Handloom Cotton', ARRAY['Hand wash separately in cold water', 'Mild detergent only', 'Line dry in shade', 'Expect natural color variation'], true, false, true, true),
  ('a0000007-0001-0001-0001-000000000007', 'WIN-COA-001', 'Italian Wool Double-Breasted Long Coat', 'wool-coat', 'Investment-piece outerwear crafted from premium Italian vintage wool sourced from Biella mills. The classic double-breasted silhouette features peak lapels, horn buttons, and a full satin lining for smooth layering. Tailored with structured shoulders, a nipped waist, and vented back for a flattering, elongated fit. Fully lined interior pockets and warm quilted lining. Professional-grade construction with pick-stitching details.', 'Tailored Italian wool coat with timeless double-breasted styling', 'women', 'winter', '44444444-4444-4444-4444-444444444444', 13999.00, 8997.00, ARRAY['wool', 'winter', 'italian', 'tailored', 'investment', 'formal'], '80% Virgin Wool, 20% Polyamide Blend', ARRAY['Dry clean only', 'Steam between wears', 'Store on padded hanger', 'Brush regularly'], true, true, false, true),
  ('a0000008-0001-0001-0001-000000000008', 'WIN-POU-002', 'Ultralight Packable Down-Alternative Puffer Jacket', 'puffer-jacket', 'Feather-free warmth that packs into its own pocket. This sustainable puffer features Primaloft Gold Insulation, a high-performance synthetic that mimics down cluster loft without the cruelty or allergy concerns. Weighs just 380g and compresses to a compact pouch for travel. Features include a stand collar, two-way zipper with wind flap, zip pockets, and elasticized cuffs. Water-resistant shell sheds light precipitation. Temperature rated to -5°C.', 'Vegan insulation that packs small and stays warm', 'unisex', 'winter', '44444444-4444-4444-4444-444444444444', 6499.00, 5799.00, ARRAY['puffer', 'winter', 'packable', 'vegan', 'ultralight', 'primaloft'], '100% Recycled Nylon Ripstop', ARRAY['Machine wash cold, gentle cycle', 'Tumble dry low with tennis balls', 'Do not iron', 'Store uncompressed'], false, true, true, true),
  ('a0000009-0001-0001-0001-000000000009', 'FES-LEH-001', 'Bridal Sequence Embroidered Lehenga with Dupatta', 'festive-lehenga', 'A breathtaking ensemble for your most celebrated moments. This floor-length lehenga features intricate hand-embroidered sequin and zardozi work on premium art silk, with motifs inspired by Mughal palace architecture. The flared silhouette includes a canvas-stiff hem for dramatic movement. Paired with a contrasting embroidered blouse piece and a sheer organza dupatta with scattered sequins. Can-can attached for added volume. Semi-stitched customization available.', 'Hand-embroidered bridal lehenga with zardozi and sequin work', 'women', 'festive', '55555555-5555-5555-5555-555555555555', 28999.00, 18999.00, ARRAY['lehenga', 'festive', 'bridal', 'embroidered', 'wedding', 'zardozi'], 'Premium Art Silk with Sequin Embroidery', ARRAY['Dry clean only', 'Store in cotton bag', 'Avoid direct sunlight', 'Steam before wear'], true, true, false, true),
  ('a0000010-0001-0001-0001-000000000010', 'FES-SHE-002', 'Heritage Embroidered Sherwani with Stole', 'embroidered-sherwani', 'Command attention at celebrations with this regal sherwani featuring traditional Indian motifs hand-embroidered in metallic thread. The structured silhouette includes a Nehru collar, concealed front placket, and side slits for ease of movement. Crafted from a premium silk blend with a subtle tonal sheen that catches the light. Comes paired with a tonal churidar and embellished stole. Lined with breathable cotton for comfort through long ceremonies.', 'Royal embroidered sherwani with traditional Indian craft', 'men', 'festive', '55555555-5555-5555-5555-555555555555', 21999.00, 18699.00, ARRAY['sherwani', 'festive', 'embroidered', 'groom', 'wedding', 'heritage'], '60% Art Silk, 40% Cotton Blend', ARRAY['Dry clean only', 'Steam to refresh', 'Store on padded hanger', 'Spot clean spills immediately'], true, true, false, true);

  -- Re-seed product_images
  INSERT INTO public.product_images (id, product_id, url, alt, is_primary, sort_order) VALUES
  ('b0000001-0001-0001-0001-000000000001', 'a0000001-0001-0001-0001-000000000001', 'https://images.pexels.com/photos/297928/pexels-photo-297928.jpeg?auto=compress&cs=tinysrgb&w=800', 'Linen Shirt', true, 0),
  ('b0000003-0001-0001-0001-000000000003', 'a0000002-0001-0001-0001-000000000002', 'https://images.pexels.com/photos/1536679/pexels-photo-1536679.jpeg?auto=compress&cs=tinysrgb&w=800', 'Maxi Dress', true, 0),
  ('b0000005-0001-0001-0001-000000000003', 'a0000003-0001-0001-0001-000000000003', 'https://images.pexels.com/photos/1547692/pexels-photo-1547692.jpeg?auto=compress&cs=tinysrgb&w=800', 'Waterproof Jacket', true, 0),
  ('b0000006-0001-0001-0001-000000000004', 'a0000004-0001-0001-0001-000000000004', 'https://images.pexels.com/photos/14704906/pexels-photo-14704906.jpeg?auto=compress&cs=tinysrgb&w=800', 'Joggers', true, 0),
  ('b0000007-0001-0001-0001-000000000007', 'a0000005-0001-0001-0001-000000000005', 'https://images.pexels.com/photos/7691158/pexels-photo-7691158.jpeg?auto=compress&cs=tinysrgb&w=800', 'Sweater', true, 0),
  ('b0000008-0001-0001-0001-000000000008', 'a0000006-0001-0001-0001-000000000006', 'https://images.pexels.com/photos/8106054/pexels-photo-8106054.jpeg?auto=compress&cs=tinysrgb&w=800', 'Kurta', true, 0),
  ('b0000009-0001-0001-0001-000000000007', 'a0000007-0001-0001-0001-000000000007', 'https://images.pexels.com/photos/15385049/pexels-photo-15385049.jpeg?auto=compress&cs=tinysrgb&w=800', 'Wool Coat', true, 0),
  ('b0000010-0001-0001-0001-000000000010', 'a0000008-0001-0001-0001-000000000008', 'https://images.pexels.com/photos/14793928/pexels-photo-14793928.jpeg?auto=compress&cs=tinysrgb&w=800', 'Puffer Jacket', true, 0),
  ('b0000011-0001-0001-0001-000000000011', 'a0000009-0001-0001-0001-000000000009', 'https://images.pexels.com/photos/1670890/pexels-photo-1670890.jpeg?auto=compress&cs=tinysrgb&w=800', 'Lehenga', true, 0),
  ('b0000012-0001-0001-0001-000000000012', 'a0000010-0001-0001-0001-000000000010', 'https://images.pexels.com/photos/1547692/pexels-photo-1547692.jpeg?auto=compress&cs=tinysrgb&w=800', 'Sherwani', true, 0);

  -- Re-seed product_variants
  INSERT INTO public.product_variants (id, product_id, size, color, color_code, sku, inventory_quantity, low_stock_threshold, is_in_stock) VALUES
  ('c0000001-0001-0001-0001-000000000001', 'a0000001-0001-0001-0001-000000000001', 'S', 'Natural White', '#F5F5DC', 'SUM-TSH-001-S-WH', 50, 10, true),
  ('c0000002-0001-0001-0001-000000000002', 'a0000001-0001-0001-0001-000000000001', 'M', 'Natural White', '#F5F5DC', 'SUM-TSH-001-M-WH', 65, 10, true),
  ('c0000003-0001-0001-0001-000000000003', 'a0000001-0001-0001-0001-000000000001', 'L', 'Natural White', '#F5F5DC', 'SUM-TSH-001-L-WH', 40, 10, true),
  ('c0000005-0001-0001-0001-000000000005', 'a0000001-0001-0001-0001-000000000001', 'S', 'Sky Blue', '#87CEEB', 'SUM-TSH-001-S-BL', 45, 10, true),
  ('c0000006-0001-0001-0001-000000000006', 'a0000001-0001-0001-0001-000000000001', 'M', 'Sky Blue', '#87CEEB', 'SUM-TSH-001-M-BL', 55, 10, true),
  ('c0000007-0001-0001-0001-000000000007', 'a0000002-0001-0001-0001-000000000002', 'S', 'Coral Pink', '#FF6F61', 'SUM-DRE-002-S-PK', 45, 8, true),
  ('c0000008-0001-0001-0001-000000000008', 'a0000002-0001-0001-0001-000000000002', 'M', 'Coral Pink', '#FF6F61', 'SUM-DRE-002-M-PK', 60, 8, true),
  ('c0000009-0001-0001-0001-000000000009', 'a0000002-0001-0001-0001-000000000002', 'L', 'Coral Pink', '#FF6F61', 'SUM-DRE-002-L-PK', 40, 8, true),
  ('c0000013-0001-0001-0001-000000000013', 'a0000003-0001-0001-0001-000000000003', 'S', 'Midnight Black', '#191970', 'MON-JAC-001-S-BK', 40, 10, true),
  ('c0000014-0001-0001-0001-000000000014', 'a0000003-0001-0001-0001-000000000003', 'M', 'Midnight Black', '#191970', 'MON-JAC-001-M-BK', 55, 10, true),
  ('c0000015-0001-0001-0001-000000000015', 'a0000003-0001-0001-0001-000000000003', 'L', 'Midnight Black', '#191970', 'MON-JAC-001-L-BK', 45, 10, true),
  ('c0000017-0001-0001-0001-000000000017', 'a0000004-0001-0001-0001-000000000004', 'S', 'Charcoal Grey', '#36454F', 'MON-JEA-002-S-GY', 35, 10, true),
  ('c0000018-0001-0001-0001-000000000018', 'a0000004-0001-0001-0001-000000000004', 'M', 'Charcoal Grey', '#36454F', 'MON-JEA-002-M-GY', 50, 10, true),
  ('c0000019-0001-0001-0001-000000000019', 'a0000004-0001-0001-0001-000000000004', 'L', 'Charcoal Grey', '#36454F', 'MON-JEA-002-L-GY', 40, 10, true),
  ('c0000020-0001-0001-0001-000000000020', 'a0000005-0001-0001-0001-000000000005', 'S', 'Warm Beige', '#F5E6D3', 'AUT-SWE-001-S-BG', 40, 10, true),
  ('c0000021-0001-0001-0001-000000000021', 'a0000005-0001-0001-0001-000000000005', 'M', 'Warm Beige', '#F5E6D3', 'AUT-SWE-001-M-BG', 55, 10, true),
  ('c0000022-0001-0001-0001-000000000022', 'a0000005-0001-0001-0001-000000000005', 'L', 'Warm Beige', '#F5E6D3', 'AUT-SWE-001-L-BG', 45, 10, true),
  ('c0000023-0001-0001-0001-000000000023', 'a0000006-0001-0001-0001-000000000006', 'S', 'Indigo Blue', '#4B0082', 'AUT-KUR-002-S-IN', 25, 8, true),
  ('c0000024-0001-0001-0001-000000000024', 'a0000006-0001-0001-0001-000000000006', 'M', 'Indigo Blue', '#4B0082', 'AUT-KUR-002-M-IN', 35, 8, true),
  ('c0000025-0001-0001-0001-000000000025', 'a0000006-0001-0001-0001-000000000006', 'L', 'Indigo Blue', '#4B0082', 'AUT-KUR-002-L-IN', 30, 8, true),
  ('c0000026-0001-0001-0001-000000000026', 'a0000007-0001-0001-0001-000000000007', 'S', 'Camel', '#C19A6B', 'WIN-COA-001-S-CM', 20, 5, true),
  ('c0000027-0001-0001-0001-000000000027', 'a0000007-0001-0001-0001-000000000007', 'M', 'Camel', '#C19A6B', 'WIN-COA-001-M-CM', 25, 5, true),
  ('c0000029-0001-0001-0001-000000000029', 'a0000008-0001-0001-0001-000000000008', 'S', 'Olive Green', '#808000', 'WIN-POU-002-S-OL', 35, 10, true),
  ('c0000030-0001-0001-0001-000000000030', 'a0000008-0001-0001-0001-000000000008', 'M', 'Olive Green', '#808000', 'WIN-POU-002-M-OL', 50, 10, true),
  ('c0000032-0001-0001-0001-000000000032', 'a0000009-0001-0001-0001-000000000009', 'S', 'Rose Gold', '#B76E79', 'FES-LEH-001-S-RG', 15, 3, true),
  ('c0000033-0001-0001-0001-000000000033', 'a0000009-0001-0001-0001-000000000009', 'M', 'Rose Gold', '#B76E79', 'FES-LEH-001-M-RG', 18, 3, true),
  ('c0000035-0001-0001-0001-000000000035', 'a0000010-0001-0001-0001-000000000010', 'S', 'Ivory Cream', '#FFFFF0', 'FES-SHE-002-S-IV', 12, 3, true),
  ('c0000036-0001-0001-0001-000000000036', 'a0000010-0001-0001-0001-000000000010', 'M', 'Ivory Cream', '#FFFFF0', 'FES-SHE-002-M-IV', 18, 3, true);

  -- Re-seed coupons
  INSERT INTO public.coupons (code, type, value, min_order_amount, max_discount_amount, usage_limit, used_count, valid_from, valid_until, is_active) VALUES
  ('WELCOME10', 'percentage', 10.00, 500.00, 500.00, 10000, 0, NOW(), NOW() + INTERVAL '1 year', true),
  ('SUMMER25', 'percentage', 25.00, 1500.00, 1000.00, 5000, 0, NOW(), NOW() + INTERVAL '3 months', true),
  ('FLAT500', 'fixed', 500.00, 2000.00, NULL, 3000, 0, NOW(), NOW() + INTERVAL '6 months', true);

  -- Re-seed banners
  INSERT INTO public.banners (title, subtitle, image_url, link_url, button_text, position, sort_order, is_active) VALUES
  ('Summer Collection 2024', 'Premium Irish Linen & Silk Blends at 30% Off', 'https://images.pexels.com/photos/1536679/pexels-photo-1536679.jpeg?auto=compress&cs=tinysrgb&w=1600&q=80', '/collection/summer-essentials', 'Shop Summer Sale', 'hero', 1, true),
  ('Festive Edit', 'Celebrate in style this season', 'https://images.pexels.com/photos/15385049/pexels-photo-15385049.jpeg?auto=compress&cs=tinysrgb&w=1600', '/collection/festive-edit', 'Explore', 'hero', 2, true);

  -- Re-seed faqs
  INSERT INTO public.faqs (category, question, answer, sort_order, is_active) VALUES
  ('Orders', 'How can I track my order?', 'Once shipped, you will receive tracking details via email and SMS.', 1, true),
  ('Returns', 'What is your return policy?', 'We offer free returns within 7 days. Items must be unworn with tags attached.', 2, true),
  ('Payments', 'What payment methods do you accept?', 'We accept UPI, Cards, Net Banking, Wallets, and Cash on Delivery.', 3, true);

  -- Re-seed pages
  INSERT INTO public.pages (slug, title, content, meta_title, is_published) VALUES
  ('about-us', 'About SAVANA', '<p>SAVANA celebrates India''s diverse seasons with thoughtfully designed fashion.</p>', 'About SAVANA', true),
  ('contact', 'Contact Us', '<p>Email: hello@savana.in | Phone: +91 98765 43210</p>', 'Contact SAVANA', true);
END;
$$;
