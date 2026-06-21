-- Seed Product Images
INSERT INTO public.product_images (id, product_id, url, alt, is_primary, sort_order) VALUES
('b0000001-0001-0001-0001-000000000001', 'a0000001-0001-0001-0001-000000000001', 'https://images.pexels.com/photos/297928/pexels-photo-297928.jpeg?auto=compress&cs=tinysrgb&w=800', 'Linen Shirt', true, 0),
('b0000003-0001-0001-0001-000000000003', 'a0000002-0001-0001-0001-000000000002', 'https://images.pexels.com/photos/1536679/pexels-photo-1536679.jpeg?auto=compress&cs=tinysrgb&w=800', 'Maxi Dress', true, 0),
('b0000005-0001-0001-0001-000000000005', 'a0000003-0001-0001-0001-000000000003', 'https://images.pexels.com/photos/1547692/pexels-photo-1547692.jpeg?auto=compress&cs=tinysrgb&w=800', 'Waterproof Jacket', true, 0),
('b0000006-0001-0001-0001-000000000006', 'a0000004-0001-0001-0001-000000000004', 'https://images.pexels.com/photos/14704906/pexels-photo-14704906.jpeg?auto=compress&cs=tinysrgb&w=800', 'Joggers', true, 0),
('b0000007-0001-0001-0001-000000000007', 'a0000005-0001-0001-0001-000000000005', 'https://images.pexels.com/photos/7691158/pexels-photo-7691158.jpeg?auto=compress&cs=tinysrgb&w=800', 'Sweater', true, 0),
('b0000008-0001-0001-0001-000000000008', 'a0000006-0001-0001-0001-000000000006', 'https://images.pexels.com/photos/8106054/pexels-photo-8106054.jpeg?auto=compress&cs=tinysrgb&w=800', 'Kurta', true, 0),
('b0000009-0001-0001-0001-000000000009', 'a0000007-0001-0001-0001-000000000007', 'https://images.pexels.com/photos/15385049/pexels-photo-15385049.jpeg?auto=compress&cs=tinysrgb&w=800', 'Wool Coat', true, 0),
('b0000010-0001-0001-0001-000000000010', 'a0000008-0001-0001-0001-000000000008', 'https://images.pexels.com/photos/14793928/pexels-photo-14793928.jpeg?auto=compress&cs=tinysrgb&w=800', 'Puffer Jacket', true, 0),
('b0000011-0001-0001-0001-000000000011', 'a0000009-0001-0001-0001-000000000009', 'https://images.pexels.com/photos/1670890/pexels-photo-1670890.jpeg?auto=compress&cs=tinysrgb&w=800', 'Lehenga', true, 0),
('b0000012-0001-0001-0001-000000000012', 'a0000010-0001-0001-0001-000000000010', 'https://images.pexels.com/photos/1547692/pexels-photo-1547692.jpeg?auto=compress&cs=tinysrgb&w=800', 'Sherwani', true, 0);

-- Seed Product Variants
INSERT INTO public.product_variants (id, product_id, size, color, color_code, sku, inventory_quantity, low_stock_threshold, is_in_stock) VALUES
-- Linen Shirt
('c0000001-0001-0001-0001-000000000001', 'a0000001-0001-0001-0001-000000000001', 'S', 'Natural White', '#F5F5DC', 'SUM-TSH-001-S-WH', 50, 10, true),
('c0000002-0001-0001-0001-000000000002', 'a0000001-0001-0001-0001-000000000001', 'M', 'Natural White', '#F5F5DC', 'SUM-TSH-001-M-WH', 65, 10, true),
('c0000003-0001-0001-0001-000000000003', 'a0000001-0001-0001-0001-000000000001', 'L', 'Natural White', '#F5F5DC', 'SUM-TSH-001-L-WH', 40, 10, true),
('c0000005-0001-0001-0001-000000000005', 'a0000001-0001-0001-0001-000000000001', 'S', 'Sky Blue', '#87CEEB', 'SUM-TSH-001-S-BL', 45, 10, true),
('c0000006-0001-0001-0001-000000000006', 'a0000001-0001-0001-0001-000000000001', 'M', 'Sky Blue', '#87CEEB', 'SUM-TSH-001-M-BL', 55, 10, true),
-- Maxi Dress
('c0000007-0001-0001-0001-000000000007', 'a0000002-0001-0001-0001-000000000002', 'S', 'Coral Pink', '#FF6F61', 'SUM-DRE-002-S-PK', 45, 8, true),
('c0000008-0001-0001-0001-000000000008', 'a0000002-0001-0001-0001-000000000002', 'M', 'Coral Pink', '#FF6F61', 'SUM-DRE-002-M-PK', 60, 8, true),
('c0000009-0001-0001-0001-000000000009', 'a0000002-0001-0001-0001-000000000002', 'L', 'Coral Pink', '#FF6F61', 'SUM-DRE-002-L-PK', 40, 8, true),
-- Waterproof Jacket
('c0000013-0001-0001-0001-000000000013', 'a0000003-0001-0001-0001-000000000003', 'S', 'Midnight Black', '#191970', 'MON-JAC-001-S-BK', 40, 10, true),
('c0000014-0001-0001-0001-000000000014', 'a0000003-0001-0001-0001-000000000003', 'M', 'Midnight Black', '#191970', 'MON-JAC-001-M-BK', 55, 10, true),
('c0000015-0001-0001-0001-000000000015', 'a0000003-0001-0001-0001-000000000003', 'L', 'Midnight Black', '#191970', 'MON-JAC-001-L-BK', 45, 10, true),
-- Joggers
('c0000017-0001-0001-0001-000000000017', 'a0000004-0001-0001-0001-000000000004', 'S', 'Charcoal Grey', '#36454F', 'MON-JEA-002-S-GY', 35, 10, true),
('c0000018-0001-0001-0001-000000000018', 'a0000004-0001-0001-0001-000000000004', 'M', 'Charcoal Grey', '#36454F', 'MON-JEA-002-M-GY', 50, 10, true),
('c0000019-0001-0001-0001-000000000019', 'a0000004-0001-0001-0001-000000000004', 'L', 'Charcoal Grey', '#36454F', 'MON-JEA-002-L-GY', 40, 10, true),
-- Sweater
('c0000020-0001-0001-0001-000000000020', 'a0000005-0001-0001-0001-000000000005', 'S', 'Warm Beige', '#F5E6D3', 'AUT-SWE-001-S-BG', 40, 10, true),
('c0000021-0001-0001-0001-000000000021', 'a0000005-0001-0001-0001-000000000005', 'M', 'Warm Beige', '#F5E6D3', 'AUT-SWE-001-M-BG', 55, 10, true),
('c0000022-0001-0001-0001-000000000022', 'a0000005-0001-0001-0001-000000000005', 'L', 'Warm Beige', '#F5E6D3', 'AUT-SWE-001-L-BG', 45, 10, true),
-- Kurta
('c0000023-0001-0001-0001-000000000023', 'a0000006-0001-0001-0001-000000000006', 'S', 'Indigo Blue', '#4B0082', 'AUT-KUR-002-S-IN', 25, 8, true),
('c0000024-0001-0001-0001-000000000024', 'a0000006-0001-0001-0001-000000000006', 'M', 'Indigo Blue', '#4B0082', 'AUT-KUR-002-M-IN', 35, 8, true),
('c0000025-0001-0001-0001-000000000025', 'a0000006-0001-0001-0001-000000000006', 'L', 'Indigo Blue', '#4B0082', 'AUT-KUR-002-L-IN', 30, 8, true),
-- Wool Coat
('c0000026-0001-0001-0001-000000000026', 'a0000007-0001-0001-0001-000000000007', 'S', 'Camel', '#C19A6B', 'WIN-COA-001-S-CM', 20, 5, true),
('c0000027-0001-0001-0001-000000000027', 'a0000007-0001-0001-0001-000000000007', 'M', 'Camel', '#C19A6B', 'WIN-COA-001-M-CM', 25, 5, true),
-- Puffer
('c0000029-0001-0001-0001-000000000029', 'a0000008-0001-0001-0001-000000000008', 'S', 'Olive Green', '#808000', 'WIN-POU-002-S-OL', 35, 10, true),
('c0000030-0001-0001-0001-000000000030', 'a0000008-0001-0001-0001-000000000008', 'M', 'Olive Green', '#808000', 'WIN-POU-002-M-OL', 50, 10, true),
-- Lehenga
('c0000032-0001-0001-0001-000000000032', 'a0000009-0001-0001-0001-000000000009', 'S', 'Rose Gold', '#B76E79', 'FES-LEH-001-S-RG', 15, 3, true),
('c0000033-0001-0001-0001-000000000033', 'a0000009-0001-0001-0001-000000000009', 'M', 'Rose Gold', '#B76E79', 'FES-LEH-001-M-RG', 18, 3, true),
-- Sherwani
('c0000035-0001-0001-0001-000000000035', 'a0000010-0001-0001-0001-000000000010', 'S', 'Ivory Cream', '#FFFFF0', 'FES-SHE-002-S-IV', 12, 3, true),
('c0000036-0001-0001-0001-000000000036', 'a0000010-0001-0001-0001-000000000010', 'M', 'Ivory Cream', '#FFFFF0', 'FES-SHE-002-M-IV', 18, 3, true);

-- Seed Coupons
INSERT INTO public.coupons (code, type, value, min_order_amount, max_discount_amount, usage_limit, valid_from, valid_until, is_active) VALUES
('WELCOME10', 'percentage', 10.00, 500.00, 500.00, 10000, NOW(), NOW() + INTERVAL '1 year', true),
('SUMMER25', 'percentage', 25.00, 1500.00, 1000.00, 5000, NOW(), NOW() + INTERVAL '3 months', true),
('FLAT500', 'fixed', 500.00, 2000.00, NULL, 3000, NOW(), NOW() + INTERVAL '6 months', true);

-- Seed Banners
INSERT INTO public.banners (title, subtitle, image_url, link_url, button_text, position, sort_order, is_active) VALUES
('Summer Collection 2024', 'Embrace the warmth with breathable styles', 'https://images.pexels.com/photos/1536679/pexels-photo-1536679.jpeg?auto=compress&cs=tinysrgb&w=1600', '/collection/summer-essentials', 'Shop Now', 'hero', 1, true),
('Festive Edit', 'Celebrate in style this season', 'https://images.pexels.com/photos/15385049/pexels-photo-15385049.jpeg?auto=compress&cs=tinysrgb&w=1600', '/collection/festive-edit', 'Explore', 'hero', 2, true);

-- Seed FAQs
INSERT INTO public.faqs (category, question, answer, sort_order, is_active) VALUES
('Orders', 'How can I track my order?', 'Once shipped, you will receive tracking details via email and SMS.', 1, true),
('Returns', 'What is your return policy?', 'We offer free returns within 7 days. Items must be unworn with tags attached.', 2, true),
('Payments', 'What payment methods do you accept?', 'We accept UPI, Cards, Net Banking, Wallets, and Cash on Delivery.', 3, true);

-- Seed Pages
INSERT INTO public.pages (slug, title, content, meta_title, is_published) VALUES
('about-us', 'About SAVANA', '<p>SAVANA celebrates Indias diverse seasons with thoughtfully designed fashion.</p>', 'About SAVANA', true),
('contact', 'Contact Us', '<p>Email: hello@savana.in | Phone: +91 98765 43210</p>', 'Contact SAVANA', true);
