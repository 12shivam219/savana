-- Premium Product Data Overhaul
UPDATE public.products SET 
  name = 'Premium Irish Linen Relaxed-Fit Shirt',
  description = 'Crafted from 100% authentic Irish linen, this relaxed-fit shirt embodies effortless sophistication for warm-weather styling. The natural breathability and moisture-wicking properties of linen keep you cool even on the hottest days. Features a spread collar, mother-of-pearl buttons, and a curved hem perfect for untucked wear. Slightly textured handfeel that softens beautifully with each wash.',
  short_description = 'Authentic Irish linen with natural texture and breathability',
  base_price = 2899.00,
  sale_price = 2247.00,
  tags = ARRAY['linen', 'summer', 'breathable', 'premium', 'relaxed-fit', 'sustainable'],
  fabric_material = '100% Genuine Irish Linen, 150 GSM',
  fabric_composition = 'Pure flax fiber with natural slub texture',
  fabric_weight = 'Lightweight (150 GSM)',
  care_instructions = ARRAY['Machine wash cold, gentle cycle', 'Tumble dry low or line dry', 'Warm iron if needed', 'Do not bleach'],
  is_featured = true,
  is_new_arrival = true,
  is_best_seller = false
WHERE id = 'a0000001-0001-0001-0001-000000000001';

UPDATE public.products SET 
  name = 'Silk-Blend Midi Slip Dress with Cowl Neck',
  description = 'An elegant midi dress crafted from luxurious silk-viscose blend that drapes beautifully over your silhouette. The cowl neckline adds a touch of old-Hollywood glamour while adjustable spaghetti straps ensure the perfect fit. Fully lined with lightweight crepe for comfort and opacity. Features a subtle side slit for ease of movement. Perfect for evening occasions, destination weddings, or elevated everyday wear.',
  short_description = 'Luxurious silk-viscose blend with elegant cowl drape',
  base_price = 4599.00,
  sale_price = NULL,
  tags = ARRAY['silk', 'dress', 'evening', 'wedding-guest', 'elegant', 'lined'],
  fabric_material = '70% Silk, 30% Viscose Blend',
  fabric_composition = 'Premium mulberry silk with sustainable viscose',
  fabric_weight = ' Lightweight (120 GSM)',
  care_instructions = ARRAY['Dry clean recommended', 'Steam to refresh', 'Store on padded hanger', 'Avoid direct sunlight'],
  is_featured = true,
  is_new_arrival = true,
  is_best_seller = true
WHERE id = 'a0000002-0001-0001-0001-000000000002';

UPDATE public.products SET 
  name = 'Technical Waterproof Trench Coat with Sealed Seams',
  description = 'Engineered for the modern urbanite, this waterproof trench combines classic styling with cutting-edge performance technology. Features fully taped seams, a water-repellent DWR coating rated to 10,000mm, and a breathable membrane that prevents overheating. The three-quarter length provides coverage without restricting movement. Detachable hood, storm flaps, and secure zip pockets protect your essentials. Windproof to 80 km/h.',
  short_description = 'Professional-grade waterproofing in a timeless silhouette',
  base_price = 7499.00,
  sale_price = 5247.00,
  tags = ARRAY['waterproof', 'monsoon', 'technical', 'trench', 'windproof', 'urban'],
  fabric_material = 'Recycled Polyester with TPU Membrane',
  fabric_composition = '3-layer bonded fabric with DWR C6 finish',
  fabric_weight = 'Mid-weight (180 GSM)',
  care_instructions = ARRAY['Machine wash cold, close zippers', 'Do not use fabric softener', 'Tumble dry low', 'Reapply DWR spray seasonally'],
  is_featured = true,
  is_new_arrival = false,
  is_best_seller = true
WHERE id = 'a0000003-0001-0001-0001-000000000003';

UPDATE public.products SET 
  name = 'Athleisure Quick-Dry Joggers with 4-Way Stretch',
  description = 'Designed for both performance and everyday wear, these joggers feature advanced moisture-wicking fabric that dries 3x faster than cotton. The 4-way stretch construction moves with you through yoga, running, or weekend errands. Elastic waistband with inner drawcord ensures a custom fit. Features zip cargo pockets, tapered leg silhouette, and reflective accent trims for low-light visibility. UPF 30+ sun protection built in.',
  short_description = 'Performance joggers with moisture-wicking technology',
  base_price = 2899.00,
  sale_price = NULL,
  tags = ARRAY['athleisure', 'monsoon', 'quick-dry', 'performance', 'workout', 'UPF'],
  fabric_material = '88% Recycled Polyester, 12% Elastane',
  fabric_composition = 'Interlock knit with Eco-DWR finish',
  fabric_weight = 'Mid-weight (220 GSM)',
  care_instructions = ARRAY['Machine wash cold', 'Tumble dry low', 'Do not iron', 'Do not use bleach'],
  is_featured = false,
  is_new_arrival = true,
  is_best_seller = false
WHERE id = 'a0000004-0001-0001-0001-000000000004';

UPDATE public.products SET 
  name = 'Cashmere-Blend Oversized Knit Sweater',
  description = 'Wrap yourself in cloud-like softness with this luxurious cashmere-blend sweater. The relaxed oversized silhouette offers contemporary elegance with dropped shoulders and ribbed trim details. Knit from premium Mongolian cashmere blended with fine merino wool for durability and warmth without weight. Pre-washed for extra softness and to prevent pilling. The perfect layering piece for crisp autumn evenings and cool mountain getaways.',
  short_description = 'Luxuriously soft cashmere-blend in relaxed proportions',
  base_price = 5299.00,
  sale_price = NULL,
  tags = ARRAY['cashmere', 'autumn', 'luxury', 'oversized', 'cozy', 'knitwear'],
  fabric_material = '60% Cashmere, 40% Extra-Fine Merino Wool',
  fabric_composition = 'Grade-A Mongolian cashmere, RWS-certified merino',
  fabric_weight = 'Light-mid weight (200 GSM)',
  care_instructions = ARRAY['Hand wash cold or dry clean', 'Lay flat to dry', 'Fold for storage', 'Steam to refresh'],
  is_featured = true,
  is_new_arrival = true,
  is_best_seller = false
WHERE id = 'a0000005-0001-0001-0001-000000000005';

UPDATE public.products SET 
  name = 'Hand-Crafted Ajrakh Block Print Kurta Set',
  description = 'A masterpiece of traditional Indian craftsmanship, this kurta features authentic Ajrakh block printing by master artisans from Kutch, Gujarat. Each piece is hand-printed using natural dyes derived from madder root, indigo, and pomegranite, creating the distinctive double-sided pattern true to 4,000-year-old techniques. The relaxed silhouette includes a mandarin collar, wooden button placket, and side slits. Comes with matching straight-cut pyjama.',
  short_description = 'Authentic Ajrakh hand block print with natural dyes',
  base_price = 4899.00,
  sale_price = NULL,
  tags = ARRAY['ajrakh', 'ethnic', 'handcrafted', 'artisan', 'natural-dye', 'kurta'],
  fabric_material = '100% Handloom Cotton',
  fabric_composition = 'Single-count handspun cotton, naturally dyed',
  fabric_weight = 'Light-mid weight (140 GSM)',
  care_instructions = ARRAY['Hand wash separately in cold water', 'Mild detergent only', 'Line dry in shade', 'Expect natural color variation'],
  is_featured = true,
  is_new_arrival = false,
  is_best_seller = true
WHERE id = 'a0000006-0001-0001-0001-000000000006';

UPDATE public.products SET 
  name = 'Italian Wool Double-Breasted Long Coat',
  description = 'Investment-piece outerwear crafted from premium Italian virgin wool sourced from Biella mills. The classic double-breasted silhouette features peak lapels, horn buttons, and a full satin lining for smooth layering. Tailored with structured shoulders, a nipped waist, and vented back for a flattering, elongated fit. Fully lined interior pockets and warm quilted lining. Professional-grade construction with pick-stitching details.',
  short_description = 'Tailored Italian wool coat with timeless double-breasted styling',
  base_price = 13999.00,
  sale_price = 8997.00,
  tags = ARRAY['wool', 'winter', 'italian', 'tailored', 'investment', 'formal'],
  fabric_material = '80% Virgin Wool, 20% Polyamide Blend',
  fabric_composition = 'Biella mill Italian wool with durable polyamide',
  fabric_weight = 'Heavy-weight (450 GSM)',
  care_instructions = ARRAY['Dry clean only', 'Steam between wears', 'Store on padded hanger', 'Brush regularly'],
  is_featured = true,
  is_new_arrival = true,
  is_best_seller = false
WHERE id = 'a0000007-0001-0001-0001-000000000007';

UPDATE public.products SET 
  name = 'Ultralight Packable Down-Alternative Puffer Jacket',
  description = 'Feather-free warmth that packs into its own pocket. This sustainable puffer features Primaloft Gold Insulation, a high-performance synthetic that mimics down cluster loft without the cruelty or allergy concerns. Weighs just 380g and compresses to a compact pouch for travel. Features include a stand collar, two-way zipper with wind flap, zip pockets, and elasticized cuffs. Water-resistant shell sheds light precipitation. Temperature rated to -5°C.',
  short_description = 'Vegan insulation that packs small and stays warm',
  base_price = 6499.00,
  sale_price = 5799.00,
  tags = ARRAY['puffer', 'winter', 'packable', 'vegan', 'ultralight', 'primaloft'],
  fabric_material = '100% Recycled Nylon Ripstop',
  fabric_composition = '20D ripstop nylon with DWR finish',
  fabric_weight = 'Ultralight (32 GSM shell)',
  care_instructions = ARRAY['Machine wash cold, gentle cycle', 'Tumble dry low with tennis balls', 'Do not iron', 'Store uncompressed'],
  is_featured = false,
  is_new_arrival = true,
  is_best_seller = true
WHERE id = 'a0000008-0001-0001-0001-000000000008';

UPDATE public.products SET 
  name = 'Bridal Sequence Embroidered Lehenga with Dupatta',
  description = 'A breathtaking ensemble for your most celebrated moments. This floor-length lehenga features intricate hand-embroidered sequin and zardozi work on premium art silk, with motifs inspired by Mughal palace architecture. The flared silhouette includes a canvas-stiff hem for dramatic movement. Paired with a contrasting embroidered blouse piece and a sheer organza dupatta with scattered sequins. Can-can attached for added volume. Semi-stitched customization available.',
  short_description = 'Hand-embroidered bridal lehenga with zardozi and sequin work',
  base_price = 28999.00,
  sale_price = 18999.00,
  tags = ARRAY['lehenga', 'festive', 'bridal', 'embroidered', 'wedding', 'zardozi'],
  fabric_material = 'Premium Art Silk with Sequin Embroidery',
  fabric_composition = 'Synthetic silk base with metallic threadwork',
  fabric_weight = 'Heavy (elaborate embroidery)',
  care_instructions = ARRAY['Dry clean only', 'Store in cotton bag', 'Avoid direct sunlight', 'Steam before wear'],
  is_featured = true,
  is_new_arrival = true,
  is_best_seller = false
WHERE id = 'a0000009-0001-0001-0001-000000000009';

UPDATE public.products SET 
  name = 'Heritage Embroidered Sherwani with Stole',
  description = 'Command attention at celebrations with this regal sherwani featuring traditional Indian motifs hand-embroidered in metallic thread. The structured silhouette includes a Nehru collar, concealed front placket, and side slits for ease of movement. Crafted from a premium silk blend with a subtle tonal sheen that catches the light. Comes paired with a tonal churidar and embellished stole. Lined with breathable cotton for comfort through long ceremonies.',
  short_description = 'Royal embroidered sherwani with traditional Indian craft',
  base_price = 21999.00,
  sale_price = 18699.00,
  tags = ARRAY['sherwani', 'festive', 'embroidered', 'groom', 'wedding', 'heritage'],
  fabric_material = '60% Art Silk, 40% Cotton Blend',
  fabric_composition = 'Jacquard-woven base with metallic thread embroidery',
  fabric_weight = 'Mid-heavy (structured construction)',
  care_instructions = ARRAY['Dry clean only', 'Steam to refresh', 'Store on padded hanger', 'Spot clean spills immediately'],
  is_featured = true,
  is_new_arrival = true,
  is_best_seller = false
WHERE id = 'a0000010-0001-0001-0001-000000000010';