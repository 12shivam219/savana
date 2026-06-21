-- Seed Collections
INSERT INTO public.collections (id, name, slug, description, season, type, image_url, is_active) VALUES
('11111111-1111-1111-1111-111111111111', 'Summer Essentials', 'summer-essentials', 'Light, breathable fabrics for the hot months', 'summer', 'new-arrivals', 'https://images.pexels.com/photos/1536679/pexels-photo-1536679.jpeg?auto=compress&cs=tinysrgb&w=800', true),
('22222222-2222-2222-2222-222222222222', 'Monsoon Ready', 'monsoon-ready', 'Water-resistant styles for the rainy season', 'monsoon', 'best-sellers', 'https://images.pexels.com/photos/1447267/pexels-photo-1447267.jpeg?auto=compress&cs=tinysrgb&w=800', true),
('33333333-3333-3333-3333-333333333333', 'Autumn Vibes', 'autumn-vibes', 'Warm tones and cozy layers', 'autumn', 'new-arrivals', 'https://images.pexels.com/photos/1598505/pexels-photo-1598505.jpeg?auto=compress&cs=tinysrgb&w=800', true),
('44444444-4444-4444-4444-444444444444', 'Winter Collection', 'winter-collection', 'Stay warm in style this winter', 'winter', 'new-arrivals', 'https://images.pexels.com/photos/14793928/pexels-photo-14793928.jpeg?auto=compress&cs=tinysrgb&w=800', true),
('55555555-5555-5555-5555-555555555555', 'Festive Edit', 'festive-edit', 'Celebrate in style with our festive collection', 'festive', 'limited-edition', 'https://images.pexels.com/photos/15385049/pexels-photo-15385049.jpeg?auto=compress&cs=tinysrgb&w=800', true);

-- Seed Categories
INSERT INTO public.categories (id, name, slug, description, sort_order, is_active) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Men', 'men', 'Mens fashion collection', 1, true),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Women', 'women', 'Womens fashion collection', 2, true),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Unisex', 'unisex', 'Unisex styles for everyone', 3, true);
