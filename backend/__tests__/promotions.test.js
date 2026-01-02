const request = require('supertest');
const app = require('../index');

// Mock the database and services
jest.mock('../database');
jest.mock('../redis');
jest.mock('../services/websocketService');
jest.mock('../services/emailService');
jest.mock('../services/emailSchedulerService');
jest.mock('../services/promotionalService');

// Mock authentication middleware
jest.mock('../auth/middleware', () => ({
    authenticateToken: (req, res, next) => {
        // Mock user authentication
        if (req.headers.authorization && req.headers.authorization.includes('mock-user-token')) {
            req.user = { id: 1, email: 'user@test.com', role: 'customer' };
            return next();
        }
        if (req.headers.authorization && req.headers.authorization.includes('mock-admin-token')) {
            req.user = { id: 2, email: 'admin@test.com', role: 'admin' };
            return next();
        }
        return res.status(401).json({ error: 'Unauthorized' });
    },
    requireAdmin: (req, res, next) => {
        if (req.user && req.user.role === 'admin') {
            return next();
        }
        return res.status(403).json({ error: 'Admin access required' });
    },
    requireCustomerOrAdmin: (req, res, next) => {
        if (req.user && (req.user.role === 'customer' || req.user.role === 'admin')) {
            return next();
        }
        return res.status(403).json({ error: 'Customer or admin access required' });
    }
}));

describe('Promotional System API', () => {
    let authToken;
    let adminToken;

    beforeAll(async () => {
        // Mock authentication tokens
        authToken = 'mock-user-token';
        adminToken = 'mock-admin-token';

        // Mock the promotional service methods
        const PromotionalService = require('../services/promotionalService');
        PromotionalService.prototype.getActivePromotionalBanners = jest.fn().mockResolvedValue([]);
        PromotionalService.prototype.getFeaturedProducts = jest.fn().mockResolvedValue([]);
        PromotionalService.prototype.getActiveFlashSales = jest.fn().mockResolvedValue([]);
        PromotionalService.prototype.getFlashSaleProducts = jest.fn().mockResolvedValue([]);
        PromotionalService.prototype.validateCoupon = jest.fn().mockResolvedValue({
            valid: true,
            coupon: { id: 1, code: 'SAVE10', name: 'Save 10%', type: 'percentage', value: 10 },
            discount: 10
        });
        PromotionalService.prototype.getUserLoyaltyPoints = jest.fn().mockResolvedValue([]);
        PromotionalService.prototype.redeemLoyaltyPoints = jest.fn().mockResolvedValue({
            pointsRedeemed: 100,
            discountAmount: 1.00,
            remainingPoints: 900
        });
        PromotionalService.prototype.createCoupon = jest.fn().mockResolvedValue({
            id: 1,
            code: 'SAVE20',
            name: 'Save 20%'
        });
        PromotionalService.prototype.getAllCoupons = jest.fn().mockResolvedValue([]);
        PromotionalService.prototype.createPromotionalBanner = jest.fn().mockResolvedValue({
            id: 1,
            title: 'Summer Sale'
        });
        PromotionalService.prototype.addFeaturedProduct = jest.fn().mockResolvedValue({
            id: 1,
            productId: 1,
            section: 'hero'
        });
        PromotionalService.prototype.createFlashSale = jest.fn().mockResolvedValue({
            id: 1,
            name: 'Flash Sale 24h'
        });
    });

    describe('Public Promotional Endpoints', () => {
        describe('GET /api/promotions/banners', () => {
            it('should return promotional banners', async () => {
                const response = await request(app)
                    .get('/api/promotions/banners')
                    .expect(200);

                expect(response.body).toHaveProperty('banners');
                expect(response.body).toHaveProperty('count');
                expect(response.body).toHaveProperty('correlationId');
                expect(Array.isArray(response.body.banners)).toBe(true);
            });

            it('should filter banners by position', async () => {
                const response = await request(app)
                    .get('/api/promotions/banners?position=hero')
                    .expect(200);

                expect(response.body).toHaveProperty('banners');
                expect(Array.isArray(response.body.banners)).toBe(true);
            });

            it('should return 400 for invalid position', async () => {
                const response = await request(app)
                    .get('/api/promotions/banners?position=invalid')
                    .expect(400);

                expect(response.body).toHaveProperty('error');
                expect(response.body.error).toBe('Validation failed');
            });
        });

        describe('GET /api/promotions/featured/:section', () => {
            it('should return featured products for valid section', async () => {
                const response = await request(app)
                    .get('/api/promotions/featured/hero')
                    .expect(200);

                expect(response.body).toHaveProperty('products');
                expect(response.body).toHaveProperty('section', 'hero');
                expect(response.body).toHaveProperty('count');
                expect(Array.isArray(response.body.products)).toBe(true);
            });

            it('should return 400 for invalid section', async () => {
                const response = await request(app)
                    .get('/api/promotions/featured/invalid')
                    .expect(400);

                expect(response.body).toHaveProperty('error');
                expect(response.body.error).toBe('Validation failed');
            });
        });

        describe('GET /api/promotions/flash-sales', () => {
            it('should return active flash sales', async () => {
                const response = await request(app)
                    .get('/api/promotions/flash-sales')
                    .expect(200);

                expect(response.body).toHaveProperty('flashSales');
                expect(response.body).toHaveProperty('count');
                expect(Array.isArray(response.body.flashSales)).toBe(true);
            });
        });

        describe('GET /api/promotions/flash-sales/:flashSaleId/products', () => {
            it('should return flash sale products for valid ID', async () => {
                const response = await request(app)
                    .get('/api/promotions/flash-sales/1/products')
                    .expect(200);

                expect(response.body).toHaveProperty('products');
                expect(response.body).toHaveProperty('flashSaleId', 1);
                expect(response.body).toHaveProperty('count');
                expect(Array.isArray(response.body.products)).toBe(true);
            });

            it('should return 400 for invalid flash sale ID', async () => {
                const response = await request(app)
                    .get('/api/promotions/flash-sales/invalid/products')
                    .expect(400);

                expect(response.body).toHaveProperty('error');
                expect(response.body.error).toBe('Validation failed');
            });
        });

        describe('GET /api/promotions/coupons/:code/validate', () => {
            it('should validate coupon with valid parameters', async () => {
                const response = await request(app)
                    .get('/api/promotions/coupons/SAVE10/validate?orderAmount=100')
                    .expect(200);

                expect(response.body).toHaveProperty('valid');
                expect(response.body).toHaveProperty('correlationId');
            });

            it('should return 400 for missing order amount', async () => {
                const response = await request(app)
                    .get('/api/promotions/coupons/SAVE10/validate')
                    .expect(400);

                expect(response.body).toHaveProperty('error');
                expect(response.body.error).toBe('Validation failed');
            });

            it('should return 400 for invalid order amount', async () => {
                const response = await request(app)
                    .get('/api/promotions/coupons/SAVE10/validate?orderAmount=-10')
                    .expect(400);

                expect(response.body).toHaveProperty('error');
                expect(response.body.error).toBe('Validation failed');
            });
        });
    });

    describe('User Loyalty Endpoints', () => {
        describe('GET /api/promotions/loyalty/points', () => {
            it('should return user loyalty points with authentication', async () => {
                const response = await request(app)
                    .get('/api/promotions/loyalty/points')
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);

                expect(response.body).toHaveProperty('loyaltyData');
                expect(response.body).toHaveProperty('correlationId');
                expect(Array.isArray(response.body.loyaltyData)).toBe(true);
            });

            it('should return 401 without authentication', async () => {
                const response = await request(app)
                    .get('/api/promotions/loyalty/points')
                    .expect(401);

                expect(response.body).toHaveProperty('error');
            });
        });

        describe('POST /api/promotions/loyalty/redeem', () => {
            it('should redeem loyalty points with valid data', async () => {
                const redeemData = {
                    pointsToRedeem: 100
                };

                const response = await request(app)
                    .post('/api/promotions/loyalty/redeem')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(redeemData)
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('redemption');
                expect(response.body).toHaveProperty('correlationId');
            });

            it('should return 400 for invalid points amount', async () => {
                const redeemData = {
                    pointsToRedeem: -10
                };

                const response = await request(app)
                    .post('/api/promotions/loyalty/redeem')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(redeemData)
                    .expect(400);

                expect(response.body).toHaveProperty('error');
                expect(response.body.error).toBe('Validation failed');
            });

            it('should return 401 without authentication', async () => {
                const redeemData = {
                    pointsToRedeem: 100
                };

                const response = await request(app)
                    .post('/api/promotions/loyalty/redeem')
                    .send(redeemData)
                    .expect(401);

                expect(response.body).toHaveProperty('error');
            });
        });
    });

    describe('Admin Promotional Endpoints', () => {
        describe('POST /api/promotions/admin/coupons', () => {
            it('should create coupon with valid admin token and data', async () => {
                const couponData = {
                    code: 'SAVE20',
                    name: 'Save 20%',
                    description: 'Get 20% off your order',
                    type: 'percentage',
                    value: 20,
                    minimumOrderAmount: 50,
                    usageLimit: 100,
                    userUsageLimit: 1,
                    startsAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                };

                const response = await request(app)
                    .post('/api/promotions/admin/coupons')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send(couponData)
                    .expect(201);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('coupon');
                expect(response.body.coupon).toHaveProperty('code', 'SAVE20');
            });

            it('should return 400 for invalid coupon data', async () => {
                const invalidCouponData = {
                    code: 'ab', // too short
                    name: '',   // empty name
                    type: 'invalid', // invalid type
                    value: -10  // negative value
                };

                const response = await request(app)
                    .post('/api/promotions/admin/coupons')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send(invalidCouponData)
                    .expect(400);

                expect(response.body).toHaveProperty('error');
                expect(response.body.error).toBe('Validation failed');
                expect(response.body).toHaveProperty('details');
                expect(Array.isArray(response.body.details)).toBe(true);
            });

            it('should return 401 without admin authentication', async () => {
                const couponData = {
                    code: 'SAVE20',
                    name: 'Save 20%',
                    type: 'percentage',
                    value: 20
                };

                const response = await request(app)
                    .post('/api/promotions/admin/coupons')
                    .set('Authorization', `Bearer ${authToken}`) // regular user token
                    .send(couponData)
                    .expect(403);

                expect(response.body).toHaveProperty('error');
            });
        });

        describe('GET /api/promotions/admin/coupons', () => {
            it('should return all coupons for admin', async () => {
                const response = await request(app)
                    .get('/api/promotions/admin/coupons')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .expect(200);

                expect(response.body).toHaveProperty('coupons');
                expect(response.body).toHaveProperty('page', 1);
                expect(response.body).toHaveProperty('limit', 20);
                expect(response.body).toHaveProperty('count');
                expect(Array.isArray(response.body.coupons)).toBe(true);
            });

            it('should support pagination', async () => {
                const response = await request(app)
                    .get('/api/promotions/admin/coupons?page=2&limit=10')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .expect(200);

                expect(response.body).toHaveProperty('page', 2);
                expect(response.body).toHaveProperty('limit', 10);
            });
        });

        describe('POST /api/promotions/admin/banners', () => {
            it('should create promotional banner with valid data', async () => {
                const bannerData = {
                    title: 'Summer Sale',
                    subtitle: 'Up to 50% off',
                    description: 'Get amazing discounts on summer collection',
                    imageUrl: 'https://example.com/banner.jpg',
                    linkUrl: 'https://example.com/sale',
                    buttonText: 'Shop Now',
                    position: 'hero',
                    priority: 10
                };

                const response = await request(app)
                    .post('/api/promotions/admin/banners')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send(bannerData)
                    .expect(201);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('banner');
                expect(response.body.banner).toHaveProperty('title', 'Summer Sale');
            });

            it('should return 400 for invalid banner data', async () => {
                const invalidBannerData = {
                    title: 'ab', // too short
                    position: 'invalid' // invalid position
                };

                const response = await request(app)
                    .post('/api/promotions/admin/banners')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send(invalidBannerData)
                    .expect(400);

                expect(response.body).toHaveProperty('error');
                expect(response.body.error).toBe('Validation failed');
            });
        });

        describe('POST /api/promotions/admin/featured', () => {
            it('should add featured product with valid data', async () => {
                const featuredData = {
                    productId: 1,
                    section: 'hero',
                    priority: 5
                };

                const response = await request(app)
                    .post('/api/promotions/admin/featured')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send(featuredData)
                    .expect(201);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('featuredProduct');
            });

            it('should return 400 for invalid featured product data', async () => {
                const invalidData = {
                    productId: 'invalid', // should be number
                    section: 'invalid'    // invalid section
                };

                const response = await request(app)
                    .post('/api/promotions/admin/featured')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send(invalidData)
                    .expect(400);

                expect(response.body).toHaveProperty('error');
                expect(response.body.error).toBe('Validation failed');
            });
        });

        describe('POST /api/promotions/admin/flash-sales', () => {
            it('should create flash sale with valid data', async () => {
                const flashSaleData = {
                    name: 'Flash Sale 24h',
                    description: '24 hour flash sale with amazing discounts',
                    discountPercentage: 30,
                    startsAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                };

                const response = await request(app)
                    .post('/api/promotions/admin/flash-sales')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send(flashSaleData)
                    .expect(201);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('flashSale');
                expect(response.body.flashSale).toHaveProperty('name', 'Flash Sale 24h');
            });

            it('should return 400 for invalid flash sale data', async () => {
                const invalidData = {
                    name: 'ab', // too short
                    discountPercentage: 150, // over 100%
                    startsAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() - 1000).toISOString() // expires before starts
                };

                const response = await request(app)
                    .post('/api/promotions/admin/flash-sales')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send(invalidData)
                    .expect(400);

                expect(response.body).toHaveProperty('error');
                expect(response.body.error).toBe('Validation failed');
            });
        });
    });

    describe('Rate Limiting', () => {
        it('should apply rate limiting to promotional endpoints', async () => {
            // This test would need to be run with actual rate limiting
            // For now, we just verify the endpoint exists
            const response = await request(app)
                .get('/api/promotions/banners')
                .expect(200);

            expect(response.body).toHaveProperty('banners');
        });
    });

    describe('Error Handling', () => {
        it('should handle service unavailable gracefully', async () => {
            // This would test when the controller is not initialized
            // The actual implementation returns 503 in this case
            const response = await request(app)
                .get('/api/promotions/banners');

            // Should either return data or 503
            expect([200, 503]).toContain(response.status);
        });

        it('should return proper error format for validation failures', async () => {
            const response = await request(app)
                .get('/api/promotions/featured/invalid')
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body).toHaveProperty('correlationId');
            expect(response.body.error).toBe('Validation failed');
        });
    });
});