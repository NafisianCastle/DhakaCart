const DatabaseConnectionPool = require('../database');
const logger = require('../logger');

async function seedPromotionalData() {
    const dbPool = new DatabaseConnectionPool();
    let pool;

    try {
        pool = await dbPool.initialize();
        logger.info('Starting promotional data seeding...');

        // Create sample coupons
        const coupons = [
            {
                code: 'WELCOME10',
                name: 'Welcome Discount',
                description: 'Get 10% off your first order',
                type: 'percentage',
                value: 10,
                minimum_order_amount: 25,
                usage_limit: 1000,
                user_usage_limit: 1,
                starts_at: new Date(),
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
            },
            {
                code: 'SAVE20',
                name: 'Save $20',
                description: 'Get $20 off orders over $100',
                type: 'fixed_amount',
                value: 20,
                minimum_order_amount: 100,
                usage_limit: 500,
                user_usage_limit: 2,
                starts_at: new Date(),
                expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days
            },
            {
                code: 'FREESHIP',
                name: 'Free Shipping',
                description: 'Free shipping on all orders',
                type: 'free_shipping',
                value: 0,
                minimum_order_amount: 50,
                usage_limit: null,
                user_usage_limit: 5,
                starts_at: new Date(),
                expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
            },
            {
                code: 'FLASH50',
                name: 'Flash Sale 50%',
                description: 'Limited time 50% off',
                type: 'percentage',
                value: 50,
                minimum_order_amount: 0,
                maximum_discount_amount: 100,
                usage_limit: 100,
                user_usage_limit: 1,
                starts_at: new Date(),
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            }
        ];

        for (const coupon of coupons) {
            await pool.query(`
                INSERT INTO coupons (
                    code, name, description, type, value, minimum_order_amount,
                    maximum_discount_amount, usage_limit, user_usage_limit,
                    starts_at, expires_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (code) DO NOTHING
            `, [
                coupon.code,
                coupon.name,
                coupon.description,
                coupon.type,
                coupon.value,
                coupon.minimum_order_amount,
                coupon.maximum_discount_amount,
                coupon.usage_limit,
                coupon.user_usage_limit,
                coupon.starts_at,
                coupon.expires_at
            ]);
        }

        logger.info(`Created ${coupons.length} sample coupons`);

        // Create promotional banners
        const banners = [
            {
                title: 'Summer Sale',
                subtitle: 'Up to 50% Off',
                description: 'Get amazing discounts on summer collection. Limited time offer!',
                image_url: 'https://example.com/summer-sale-banner.jpg',
                link_url: '/products?category=summer',
                button_text: 'Shop Now',
                position: 'hero',
                priority: 10,
                starts_at: new Date(),
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            },
            {
                title: 'Free Shipping',
                subtitle: 'On Orders Over $50',
                description: 'Enjoy free shipping on all orders over $50. No code needed!',
                image_url: 'https://example.com/free-shipping-banner.jpg',
                link_url: '/products',
                button_text: 'Start Shopping',
                position: 'sidebar',
                priority: 5,
                starts_at: new Date(),
                expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
            },
            {
                title: 'New Arrivals',
                subtitle: 'Fresh Styles Just In',
                description: 'Check out our latest collection of trendy products',
                image_url: 'https://example.com/new-arrivals-banner.jpg',
                link_url: '/products?section=new_arrivals',
                button_text: 'Explore',
                position: 'footer',
                priority: 3,
                starts_at: new Date(),
                expires_at: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000)
            }
        ];

        for (const banner of banners) {
            await pool.query(`
                INSERT INTO promotional_banners (
                    title, subtitle, description, image_url, link_url,
                    button_text, position, priority, starts_at, expires_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [
                banner.title,
                banner.subtitle,
                banner.description,
                banner.image_url,
                banner.link_url,
                banner.button_text,
                banner.position,
                banner.priority,
                banner.starts_at,
                banner.expires_at
            ]);
        }

        logger.info(`Created ${banners.length} promotional banners`);

        // Get some products to feature
        const productsResult = await pool.query('SELECT id FROM products LIMIT 10');
        const productIds = productsResult.rows.map(row => row.id);

        if (productIds.length > 0) {
            // Create featured products
            const featuredSections = ['hero', 'deals', 'trending', 'new_arrivals'];

            for (let i = 0; i < Math.min(productIds.length, 8); i++) {
                const section = featuredSections[i % featuredSections.length];
                const productId = productIds[i];

                await pool.query(`
                    INSERT INTO featured_products (product_id, section, priority, starts_at, expires_at)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (product_id, section) DO NOTHING
                `, [
                    productId,
                    section,
                    10 - i, // Higher priority for first products
                    new Date(),
                    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                ]);
            }

            logger.info(`Featured ${Math.min(productIds.length, 8)} products`);

            // Create a flash sale
            const flashSaleResult = await pool.query(`
                INSERT INTO flash_sales (name, description, discount_percentage, starts_at, expires_at)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id
            `, [
                'Weekend Flash Sale',
                '48-hour flash sale with incredible discounts!',
                30,
                new Date(),
                new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days
            ]);

            const flashSaleId = flashSaleResult.rows[0].id;

            // Add products to flash sale
            for (let i = 0; i < Math.min(productIds.length, 5); i++) {
                const productId = productIds[i];
                const originalPrice = 99.99 + (i * 20); // Sample prices
                const salePrice = originalPrice * 0.7; // 30% off

                await pool.query(`
                    INSERT INTO flash_sale_products (
                        flash_sale_id, product_id, original_price, sale_price, stock_limit
                    ) VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (flash_sale_id, product_id) DO NOTHING
                `, [
                    flashSaleId,
                    productId,
                    originalPrice,
                    salePrice,
                    50 // Stock limit
                ]);
            }

            logger.info(`Created flash sale with ${Math.min(productIds.length, 5)} products`);
        }

        // Ensure default loyalty program exists
        await pool.query(`
            INSERT INTO loyalty_programs (name, description, points_per_dollar, is_active)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT DO NOTHING
        `, [
            'DhakaCart Rewards',
            'Earn points on every purchase and redeem for discounts',
            1.00,
            true
        ]);

        logger.info('Ensured default loyalty program exists');

        logger.info('Promotional data seeding completed successfully!');

    } catch (error) {
        logger.error('Error seeding promotional data:', { error: error.message });
        throw error;
    } finally {
        if (pool) {
            await dbPool.close();
        }
    }
}

// Run the seeding if this file is executed directly
if (require.main === module) {
    seedPromotionalData()
        .then(() => {
            logger.info('Promotional seeding completed');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('Promotional seeding failed:', { error: error.message });
            process.exit(1);
        });
}

module.exports = seedPromotionalData;