-- Update product images with more reliable URLs
UPDATE public.product_images SET url = 'https://images.pexels.com/photos/297928/pexels-photo-297928.jpeg?auto=compress&cs=tinysrgb&w=800&q=80' WHERE id = 'b0000001-0001-0001-0001-000000000001';
UPDATE public.product_images SET url = 'https://images.pexels.com/photos/1536679/pexels-photo-1536679.jpeg?auto=compress&cs=tinysrgb&w=800&q=80' WHERE id = 'b0000003-0001-0001-0001-000000000003';
UPDATE public.product_images SET url = 'https://images.pexels.com/photos/1547692/pexels-photo-1547692.jpeg?auto=compress&cs=tinysrgb&w=800&q=80' WHERE id = 'b0000005-0001-0001-0001-000000000005';
UPDATE public.product_images SET url = 'https://images.pexels.com/photos/14704906/pexels-photo-14704906.jpeg?auto=compress&cs=tinysrgb&w=800&q=80' WHERE id = 'b0000006-0001-0001-0001-000000000006';
UPDATE public.product_images SET url = 'https://images.pexels.com/photos/7691158/pexels-photo-7691158.jpeg?auto=compress&cs=tinysrgb&w=800&q=80' WHERE id = 'b0000007-0001-0001-0001-000000000007';
UPDATE public.product_images SET url = 'https://images.pexels.com/photos/8106054/pexels-photo-8106054.jpeg?auto=compress&cs=tinysrgb&w=800&q=80' WHERE id = 'b0000008-0001-0001-0001-000000000008';
UPDATE public.product_images SET url = 'https://images.pexels.com/photos/15385049/pexels-photo-15385049.jpeg?auto=compress&cs=tinysrgb&w=800&q=80' WHERE id = 'b0000009-0001-0001-0001-000000000009';
UPDATE public.product_images SET url = 'https://images.pexels.com/photos/14793928/pexels-photo-14793928.jpeg?auto=compress&cs=tinysrgb&w=800&q=80' WHERE id = 'b0000010-0001-0001-0001-000000000010';
UPDATE public.product_images SET url = 'https://images.pexels.com/photos/1670890/pexels-photo-1670890.jpeg?auto=compress&cs=tinysrgb&w=800&q=80' WHERE id = 'b0000011-0001-0001-0001-000000000011';
UPDATE public.product_images SET url = 'https://images.pexels.com/photos/1547692/pexels-photo-1547692.jpeg?auto=compress&cs=tinysrgb&w=800&q=80' WHERE id = 'b0000012-0001-0001-0001-000000000012';

-- Update banner images
UPDATE public.banners SET image_url = 'https://images.pexels.com/photos/1536679/pexels-photo-1536679.jpeg?auto=compress&cs=tinysrgb&w=1600&q=80' WHERE title = 'Summer Collection 2024';
UPDATE public.banners SET image_url = 'https://images.pexels.com/photos/15385049/pexels-photo-15385049.jpeg?auto=compress&cs=tinysrgb&w=1600&q=80' WHERE title = 'Festive Edit';

-- Update collection images
UPDATE public.collections SET image_url = 'https://images.pexels.com/photos/1536679/pexels-photo-1536679.jpeg?auto=compress&cs=tinysrgb&w=800&q=80' WHERE slug = 'summer-essentials';
UPDATE public.collections SET image_url = 'https://images.pexels.com/photos/1447267/pexels-photo-1447267.jpeg?auto=compress&cs=tinysrgb&w=800&q=80' WHERE slug = 'monsoon-ready';
UPDATE public.collections SET image_url = 'https://images.pexels.com/photos/1598505/pexels-photo-1598505.jpeg?auto=compress&cs=tinysrgb&w=800&q=80' WHERE slug = 'autumn-vibes';
UPDATE public.collections SET image_url = 'https://images.pexels.com/photos/14793928/pexels-photo-14793928.jpeg?auto=compress&cs=tinysrgb&w=800&q=80' WHERE slug = 'winter-collection';
UPDATE public.collections SET image_url = 'https://images.pexels.com/photos/15385049/pexels-photo-15385049.jpeg?auto=compress&cs=tinysrgb&w=800&q=80' WHERE slug = 'festive-edit';