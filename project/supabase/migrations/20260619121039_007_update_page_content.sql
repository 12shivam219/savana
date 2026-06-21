-- Update pages with professional content
UPDATE public.pages SET content = '<section>
<h2>Our Story</h2>
<p>SAVANA was born from a simple belief: fashion should adapt to life, not the other way around. India''s diverse climate—from the scorching summers to the refreshing monsoons, the golden autumns to the crisp winters, and the vibrant festive seasons—inspires every piece in our collection.</p>
</section>
<section>
<h2>Our Philosophy</h2>
<p>We design for the modern Indian who values quality, comfort, and style. Our seasonal collections are thoughtfully curated to ensure you look and feel your best, no matter the weather or occasion. From breathable linens in summer to cozy wool blends in winter, each fabric is carefully selected to suit the season.</p>
</section>
<section>
<h2>Sustainability</h2>
<p>SAVANA is committed to responsible fashion. We partner with artisans across India, support traditional textile crafts like Ajrakh block printing, and prioritize sustainable materials including organic cotton, recycled polyester, and eco-friendly dyes.</p>
</section>
<section>
<h2>Contact Us</h2>
<p>Email: hello@savana.in</p>
<p>Phone: +91 98765 43210</p>
<p>Hours: Monday to Saturday, 10 AM to 7 PM IST</p>
</section>' WHERE slug = 'about-us';

UPDATE public.pages SET content = '<section>
<h2>Get in Touch</h2>
<p>We''d love to hear from you. Whether you have questions about our products, need help with an order, or just want to say hello, our team is here to help.</p>
</section>
<section>
<h3>Customer Support</h3>
<p>Email: support@savana.in</p>
<p>Phone: +91 98765 43210</p>
<p>WhatsApp: +91 98765 43210</p>
<p>Hours: Monday to Saturday, 10 AM to 7 PM IST</p>
</section>
<section>
<h3>Corporate Inquiries</h3>
<p>For bulk orders, collaborations, or press inquiries:</p>
<p>Email: partnerships@savana.in</p>
</section>
<section>
<h3>Visit Our Store</h3>
<p>SAVANA Flagship Store</p>
<p>Mumbai, Maharashtra, India</p>
<p>(By appointment only)</p>
</section>' WHERE slug = 'contact';

-- Insert missing pages
INSERT INTO public.pages (slug, title, content, meta_title, is_published) VALUES
('faq', 'Frequently Asked Questions', '<section>
<h2>Orders & Shipping</h2>
<h3>How long does delivery take?</h3>
<p>Standard delivery takes 5-7 business days across India. Express shipping (2-3 days) is available for select pin codes at an additional charge.</p>
<h3>How can I track my order?</h3>
<p>Once your order ships, you will receive tracking details via email and SMS. You can also track your order in the My Orders section of your account.</p>
<h3>What are the shipping charges?</h3>
<p>Shipping is FREE for all orders above INR 999. For orders below INR 999, a flat shipping fee of INR 99 applies.</p>
</section>
<section>
<h2>Returns & Exchanges</h2>
<h3>What is your return policy?</h3>
<p>We offer free returns within 7 days of delivery. Items must be unworn, unwashed, with all tags attached. Refunds are processed within 5-7 business days of receiving the return.</p>
<h3>How do I initiate a return?</h3>
<p>Log into your account, go to My Orders, select the item you wish to return, and follow the prompts. A pickup will be scheduled within 2-3 business days.</p>
</section>
<section>
<h2>Payments</h2>
<h3>What payment methods do you accept?</h3>
<p>We accept UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, Net Banking, Popular Wallets, and Cash on Delivery (COD) for eligible pin codes.</p>
<h3>Is my payment information secure?</h3>
<p>Absolutely. We use industry-standard encryption and never store your complete card details. All transactions are processed through RBI-compliant payment gateways.</p>
</section>
<section>
<h2>Sizing & Fit</h2>
<h3>How do I find my size?</h3>
<p>Each product page has a detailed size chart. We recommend measuring yourself and comparing to our charts for the best fit. If you are between sizes, we suggest sizing up for a relaxed fit.</p>
<h3>Do you offer alterations?</h3>
<p>We currently do not offer alterations, but our customer support team can guide you to trusted local tailors in major cities.</p>
</section>', 'FAQ - SAVANA', true),
('shipping', 'Shipping Information', '<section>
<h2>Shipping Policy</h2>
<p>At SAVANA, we want you to receive your order as quickly as possible. Here is everything you need to know about our shipping process.</p>
</section>
<section>
<h3>Free Shipping</h3>
<p>Enjoy FREE shipping on all orders above INR 999. No code needed, the discount applies automatically at checkout.</p>
</section>
<section>
<h3>Delivery Timelines</h3>
<p><strong>Metro Cities:</strong> 3-5 business days</p>
<p><strong>Tier 2 Cities:</strong> 5-7 business days</p>
<p><strong>Remote Areas:</strong> 7-10 business days</p>
<p>Express shipping (2-3 days) available for select pin codes.</p>
</section>
<section>
<h3>Shipping Partners</h3>
<p>We work with trusted logistics partners including Delhivery, BlueDart, Ecom Express, and DTDC to ensure your order reaches you safely and on time.</p>
</section>
<section>
<h3>Order Tracking</h3>
<p>Track your order real-time via the link sent to your email and phone. You can also view all tracking updates in your SAVANA account under My Orders.</p>
</section>', 'Shipping Policy - SAVANA', true),
('returns', 'Returns & Refunds', '<section>
<h2>Returns & Refund Policy</h2>
<p>We want you to love your purchase. If you are not completely satisfied, we are here to help.</p>
</section>
<section>
<h3>7-Day Free Returns</h3>
<p>Return any item within 7 days of delivery for free. We arrange pickup from your doorstep.</p>
</section>
<section>
<h3>Return Conditions</h3>
<ul>
<li>Item must be unworn, unwashed, and in original condition</li>
<li>All tags and labels must be attached</li>
<li>Original packaging should be intact</li>
<li>Items marked as Final Sale are non-returnable</li>
</ul>
</section>
<section>
<h3>How to Initiate a Return</h3>
<ol>
<li>Log into your SAVANA account</li>
<li>Go to My Orders</li>
<li>Select the item you wish to return</li>
<li>Choose a reason and confirm</li>
<li>Pickup will be scheduled within 2-3 business days</li>
</ol>
</section>
<section>
<h3>Refund Timeline</h3>
<p>Once we receive and inspect your return, refunds are processed within 5-7 business days to your original payment method. You will receive an email confirmation.</p>
</section>
<section>
<h3>Exchanges</h3>
<p>For size exchanges, please return the original item and place a new order. This ensures faster delivery of your preferred size.</p>
</section>', 'Returns & Refunds - SAVANA', true),
('privacy', 'Privacy Policy', '<section>
<h2>Privacy Policy</h2>
<p>At SAVANA, we respect your privacy and are committed to protecting your personal information.</p>
</section>
<section>
<h3>Information We Collect</h3>
<p>We collect information you provide directly (name, email, phone, address) and automatically (browsing data, device information) to improve your shopping experience.</p>
</section>
<section>
<h3>How We Use Your Information</h3>
<ul>
<li>Process and deliver your orders</li>
<li>Send order updates and promotional communications (with your consent)</li>
<li>Improve our website and products</li>
<li>Prevent fraud and ensure security</li>
</ul>
</section>
<section>
<h3>Data Security</h3>
<p>We use industry-standard encryption and security measures. Your payment information is never stored on our servers.</p>
</section>
<section>
<h3>Your Rights</h3>
<p>You can access, update, or delete your personal data at any time by contacting us at privacy@savana.in.</p>
</section>
<section>
<h3>Cookies</h3>
<p>We use cookies to enhance your browsing experience. You can disable cookies in your browser settings.</p>
</section>
<p>Last updated: June 2024</p>', 'Privacy Policy - SAVANA', true),
('terms', 'Terms of Service', '<section>
<h2>Terms of Service</h2>
<p>By using savana.in, you agree to these terms. Please read them carefully.</p>
</section>
<section>
<h3>Eligibility</h3>
<p>You must be 18+ or have parental consent to make purchases. By placing an order, you confirm you meet this requirement.</p>
</section>
<section>
<h3>Products & Pricing</h3>
<p>All prices are in Indian Rupees (INR) and include applicable taxes. We reserve the right to modify prices without notice. In case of pricing errors, we will notify you before fulfilling your order.</p>
</section>
<section>
<h3>Order Acceptance</h3>
<p>All orders are subject to acceptance. We may refuse orders for any reason, including stock unavailability or suspected fraud.</p>
</section>
<section>
<h3>Intellectual Property</h3>
<p>All content on savana.in, including images, text, and logos, is owned by SAVANA or licensed to us. Unauthorized use is prohibited.</p>
</section>
<section>
<h3>Limitation of Liability</h3>
<p>SAVANA is not liable for indirect, incidental, or consequential damages arising from product use. Our liability is limited to the purchase price.</p>
</section>
<section>
<h3>Governing Law</h3>
<p>These terms are governed by the laws of India. Disputes shall be resolved in courts in Mumbai, Maharashtra.</p>
</section>
<p>For questions, contact legal@savana.in</p>
<p>Last updated: June 2024</p>', 'Terms of Service - SAVANA', true)
ON CONFLICT (slug) DO UPDATE SET content = EXCLUDED.content, title = EXCLUDED.title, meta_title = EXCLUDED.meta_title;