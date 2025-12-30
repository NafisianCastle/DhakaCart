const DatabaseConnectionPool = require('../database');
const logger = require('../logger');
require('dotenv').config();

class DatabaseSeeder {
    constructor() {
        this.dbPool = new DatabaseConnectionPool();
    }

    async initialize() {
        try {
            await this.dbPool.initialize();
            logger.info('Database seeder initialized');
        } catch (error) {
            logger.error('Failed to initialize database seeder', { error: error.message });
            throw error;
        }
    }

    async seedCategories() {
        const categories = [
            {
                name: 'Electronics',
                description: 'Electronic devices and gadgets',
                slug: 'electronics'
            },
            {
                name: 'Clothing',
                description: 'Fashion and apparel',
                slug: 'clothing'
            },
            {
                name: 'Books',
                description: 'Books and educational materials',
                slug: 'books'
            },
            {
                name: 'Home & Garden',
                description: 'Home improvement and garden supplies',
                slug: 'home-garden'
            },
            {
                name: 'Sports & Outdoors',
                description: 'Sports equipment and outdoor gear',
                slug: 'sports-outdoors'
            },
            {
                name: 'Health & Beauty',
                description: 'Health and beauty products',
                slug: 'health-beauty'
            }
        ];

        try {
            for (const category of categories) {
                await this.dbPool.query(
                    `INSERT INTO categories (name, description, slug) 
           VALUES ($1, $2, $3) 
           ON CONFLICT (slug) DO NOTHING`,
                    [category.name, category.description, category.slug]
                );
            }

            logger.info('Categories seeded successfully', { count: categories.length });
        } catch (error) {
            logger.error('Failed to seed categories', { error: error.message });
            throw error;
        }
    }

    async seedProducts() {
        // First, get category IDs
        const categoriesResult = await this.dbPool.query('SELECT id, slug FROM categories');
        const categoryMap = {};
        categoriesResult.rows.forEach(row => {
            categoryMap[row.slug] = row.id;
        });

        const products = [
            // Electronics
            {
                name: 'Smartphone Pro Max',
                description: 'Latest flagship smartphone with advanced features',
                price: 999.99,
                stock_quantity: 50,
                category_slug: 'electronics',
                sku: 'PHONE-001',
                slug: 'smartphone-pro-max'
            },
            {
                name: 'Wireless Headphones',
                description: 'Premium noise-cancelling wireless headphones',
                price: 299.99,
                stock_quantity: 75,
                category_slug: 'electronics',
                sku: 'AUDIO-001',
                slug: 'wireless-headphones'
            },
            {
                name: 'Laptop Computer',
                description: 'High-performance laptop for work and gaming',
                price: 1299.99,
                stock_quantity: 25,
                category_slug: 'electronics',
                sku: 'COMP-001',
                slug: 'laptop-computer'
            },

            // Clothing
            {
                name: 'Cotton T-Shirt',
                description: 'Comfortable 100% cotton t-shirt',
                price: 19.99,
                stock_quantity: 200,
                category_slug: 'clothing',
                sku: 'CLOTH-001',
                slug: 'cotton-t-shirt'
            },
            {
                name: 'Denim Jeans',
                description: 'Classic blue denim jeans',
                price: 59.99,
                stock_quantity: 100,
                category_slug: 'clothing',
                sku: 'CLOTH-002',
                slug: 'denim-jeans'
            },
            {
                name: 'Winter Jacket',
                description: 'Warm winter jacket for cold weather',
                price: 129.99,
                stock_quantity: 40,
                category_slug: 'clothing',
                sku: 'CLOTH-003',
                slug: 'winter-jacket'
            },

            // Books
            {
                name: 'Programming Guide',
                description: 'Comprehensive guide to modern programming',
                price: 49.99,
                stock_quantity: 80,
                category_slug: 'books',
                sku: 'BOOK-001',
                slug: 'programming-guide'
            },
            {
                name: 'Cooking Cookbook',
                description: 'Delicious recipes for home cooking',
                price: 29.99,
                stock_quantity: 60,
                category_slug: 'books',
                sku: 'BOOK-002',
                slug: 'cooking-cookbook'
            },

            // Home & Garden
            {
                name: 'Garden Tools Set',
                description: 'Complete set of essential garden tools',
                price: 89.99,
                stock_quantity: 30,
                category_slug: 'home-garden',
                sku: 'GARDEN-001',
                slug: 'garden-tools-set'
            },
            {
                name: 'LED Light Bulbs',
                description: 'Energy-efficient LED light bulbs pack',
                price: 24.99,
                stock_quantity: 150,
                category_slug: 'home-garden',
                sku: 'HOME-001',
                slug: 'led-light-bulbs'
            },

            // Sports & Outdoors
            {
                name: 'Running Shoes',
                description: 'Professional running shoes for athletes',
                price: 119.99,
                stock_quantity: 70,
                category_slug: 'sports-outdoors',
                sku: 'SPORT-001',
                slug: 'running-shoes'
            },
            {
                name: 'Yoga Mat',
                description: 'Non-slip yoga mat for exercise',
                price: 39.99,
                stock_quantity: 90,
                category_slug: 'sports-outdoors',
                sku: 'SPORT-002',
                slug: 'yoga-mat'
            },

            // Health & Beauty
            {
                name: 'Skincare Set',
                description: 'Complete skincare routine set',
                price: 79.99,
                stock_quantity: 45,
                category_slug: 'health-beauty',
                sku: 'BEAUTY-001',
                slug: 'skincare-set'
            },
            {
                name: 'Vitamin Supplements',
                description: 'Daily vitamin and mineral supplements',
                price: 34.99,
                stock_quantity: 120,
                category_slug: 'health-beauty',
                sku: 'HEALTH-001',
                slug: 'vitamin-supplements'
            }
        ];

        try {
            for (const product of products) {
                const categoryId = categoryMap[product.category_slug];
                if (!categoryId) {
                    logger.warn('Category not found for product', {
                        product: product.name,
                        category: product.category_slug
                    });
                    continue;
                }

                await this.dbPool.query(
                    `INSERT INTO products (name, description, price, stock_quantity, category_id, sku, slug) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) 
           ON CONFLICT (slug) DO NOTHING`,
                    [
                        product.name,
                        product.description,
                        product.price,
                        product.stock_quantity,
                        categoryId,
                        product.sku,
                        product.slug
                    ]
                );
            }

            logger.info('Products seeded successfully', { count: products.length });
        } catch (error) {
            logger.error('Failed to seed products', { error: error.message });
            throw error;
        }
    }

    async seedTestUsers() {
        const users = [
            {
                email: 'admin@dhakacart.com',
                password_hash: '$2b$10$example.hash.for.admin.user', // In real app, use bcrypt
                first_name: 'Admin',
                last_name: 'User',
                phone: '+8801234567890',
                email_verified: true
            },
            {
                email: 'customer@example.com',
                password_hash: '$2b$10$example.hash.for.customer.user',
                first_name: 'John',
                last_name: 'Doe',
                phone: '+8801234567891',
                email_verified: true
            },
            {
                email: 'test@dhakacart.com',
                password_hash: '$2b$10$example.hash.for.test.user',
                first_name: 'Test',
                last_name: 'User',
                phone: '+8801234567892',
                email_verified: false
            }
        ];

        try {
            for (const user of users) {
                await this.dbPool.query(
                    `INSERT INTO users (email, password_hash, first_name, last_name, phone, email_verified) 
           VALUES ($1, $2, $3, $4, $5, $6) 
           ON CONFLICT (email) DO NOTHING`,
                    [
                        user.email,
                        user.password_hash,
                        user.first_name,
                        user.last_name,
                        user.phone,
                        user.email_verified
                    ]
                );
            }

            logger.info('Test users seeded successfully', { count: users.length });
        } catch (error) {
            logger.error('Failed to seed test users', { error: error.message });
            throw error;
        }
    }

    async runAllSeeds() {
        try {
            logger.info('Starting database seeding process');

            await this.seedCategories();
            await this.seedProducts();
            await this.seedTestUsers();

            logger.info('Database seeding completed successfully');
        } catch (error) {
            logger.error('Database seeding failed', { error: error.message });
            throw error;
        }
    }

    async close() {
        await this.dbPool.close();
    }
}

// Run seeding if this file is executed directly
if (require.main === module) {
    (async () => {
        const seeder = new DatabaseSeeder();

        try {
            await seeder.initialize();
            await seeder.runAllSeeds();

            console.log('✅ Database seeding completed successfully');
            process.exit(0);
        } catch (error) {
            console.error('❌ Database seeding failed:', error.message);
            process.exit(1);
        } finally {
            await seeder.close();
        }
    })();
}

module.exports = DatabaseSeeder;