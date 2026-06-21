-- Premium marketing banners
DELETE FROM public.banners;
INSERT INTO public.banners (title, subtitle, image_url, link_url, button_text, position, sort_order, is_active) VALUES
('Summer Collection 2024', 'Premium Irish Linen & Silk Blends at 30% Off', 'https://images.pexels.com/photos/1536679/pexels-photo-1536679.jpeg?auto=compress&cs=tinysrgb&w=1600&q=80', '/collection/summer-essentials', 'Shop Summer Sale', 'hero', 1, true),
('Festive Wedding Edit', 'Bridal Lehengas & Designer Sherwanis', 'https://images.pexels.com/photos/15385049/pexels-photo-15385049.jpeg?auto=compress&cs=tinysrgb&w=1600&q=80', '/collection/festive-edit', 'Explore Festive Collection', 'hero', 2, true),
('Monsoon Ready', 'Waterproof Technical Wear — Now 30% Off', 'https://images.pexels.com/photos/1547692/pexels-photo-1547692.jpeg?auto=compress&cs=tinysrgb&w=1600&q=80', '/collection/monsoon-ready', 'Shop Monsoon Gear', 'hero', 3, true);

-- Update collections with better descriptions
UPDATE public.collections SET 
  description = 'Lightweight linens, breathable cottons, and luxurious silk blends designed for the Indian summer. Temperature-regulating fabrics that keep you cool and stylish.',
  name = 'Summer Essentials'
WHERE slug = 'summer-essentials';

UPDATE public.collections SET 
  description = 'Engineered technical wear with sealed seams, water-repellent coatings, and quick-dry technology. Built for the heaviest monsoons.',
  name = 'Monsoon Ready'
WHERE slug = 'monsoon-ready';

UPDATE public.collections SET 
  description = 'Warm cashmere blends, premium wool, and layered silhouettes for crisp autumn weather. Earthy tones and sustainable materials.',
  name = 'Autumn Edit'
WHERE slug = 'autumn-vibes';

UPDATE public.collections SET 
  description = 'Heavy-weight wool coats, ultralight packable puffers, and insulated layers. Temperature rated for Indian winters.',
  name = 'Winter Collection'
WHERE slug = 'winter-collection';

UPDATE public.collections SET 
  description = 'Hand-embroidered bridal lehengas, designer sherwanis, and traditional evening wear. Zardozi, sequin work, and heritage craftsmanship.',
  name = 'Festive Edit'
WHERE slug = 'festive-edit';