const PromotionalService = require('../services/promotionalService');

// Mock the database pool
const mockDbPool = {
    query: jest.fn()
};

describe('PromotionalService', () => {
    let promotionalService;

    beforeEach(() => {
        promotionalService = new PromotionalService(mockDbPool);
        jest.clearAllMocks();
    });

    describe('Coupon Management', () => {
        describe('createCoupon', () => {
            it('should create a coupon successfully', async () => {
                const couponData = {
                    code: 'SAVE20',
                    name: 'Save 20%',
                    description: 'Get 20% off your order',
                    type: 'percentage',
                    value: 20,
                    minimumOrderAmount: 50,
                    usageLimit: 100,
                    userUsageLimit: 1
                };

                const mockResult = {
                    rows: [{
                        id: 1,
                        code: 'SAVE20',
                        name: 'Save 20%',
                        ...couponData
                    }]
                };

                mockDbPool.query.mockResolvedValue(mockResult);

                const result = await promotionalService.createCoupon(couponData);

                expect(mockDbPool.query).toHaveBeenCalledWith(
                    expect.stringContaining('INSERT INTO coupons'),
                    expect.arrayContaining(['SAVE20', 'Save 20%'])
                );
                expect(result).toEqual(mockResult.rows[0]);
            });

            it('should handle database errors', async () => {
                const couponData = {
                    code: 'SAVE20',
                    name: 'Save 20%',
                    type: 'percentage',
                    value: 20
                };

                mockDbPool.query.mockRejectedValue(new Error('Database error'));

                await expect(promotionalService.createCoupon(couponData))
                    .rejects.toThrow('Database error');
            });
        });

        describe('validateCoupon', () => {
            it('should validate a valid coupon', async () => {
                const mockCoupon = {
                    id: 1,
                    code: 'SAVE10',
                    type: 'percentage',
                    value: 10,
                    minimum_order_amount: 0,
                    maximum_discount_amount: null,
                    usage_count: 5,
                    usage_limit: 100,
                    user_usage_limit: 1,
                    is_active: true
                };

                mockDbPool.query
                    .mockResolvedValueOnce({ rows: [mockCoupon] }) // coupon query
                    .mockResolvedValueOnce({ rows: [{ usage_count: '0' }] }); // usage query

                const result = await promotionalService.validateCoupon('SAVE10', 1, 100);

                expect(result.valid).toBe(true);
                expect(result.coupon).toEqual(mockCoupon);
                expect(result.discount).toBe(10); // 10% of 100
            });

            it('should reject invalid coupon code', async () => {
                mockDbPool.query.mockResolvedValue({ rows: [] });

                const result = await promotionalService.validateCoupon('INVALID', 1, 100);

                expect(result.valid).toBe(false);
                expect(result.error).toBe('Invalid or expired coupon code');
            });

            it('should reject coupon when minimum order amount not met', async () => {
                const mockCoupon = {
                    id: 1,
                    code: 'SAVE10',
                    minimum_order_amount: 50,
                    is_active: true
                };

                mockDbPool.query.mockResolvedValue({ rows: [mockCoupon] });

                const result = await promotionalService.validateCoupon('SAVE10', 1, 30);

                expect(result.valid).toBe(false);
                expect(result.error).toContain('Minimum order amount');
            });
        });

        describe('calculateCouponDiscount', () => {
            it('should calculate percentage discount correctly', () => {
                const coupon = {
                    type: 'percentage',
                    value: 20,
                    maximum_discount_amount: null
                };

                const discount = promotionalService.calculateCouponDiscount(coupon, 100);
                expect(discount).toBe(20);
            });

            it('should calculate fixed amount discount correctly', () => {
                const coupon = {
                    type: 'fixed_amount',
                    value: 15,
                    maximum_discount_amount: null
                };

                const discount = promotionalService.calculateCouponDiscount(coupon, 100);
                expect(discount).toBe(15);
            });

            it('should apply maximum discount limit', () => {
                const coupon = {
                    type: 'percentage',
                    value: 50,
                    maximum_discount_amount: 25
                };

                const discount = promotionalService.calculateCouponDiscount(coupon, 100);
                expect(discount).toBe(25); // Limited by maximum_discount_amount
            });

            it('should not exceed order amount', () => {
                const coupon = {
                    type: 'fixed_amount',
                    value: 150,
                    maximum_discount_amount: null
                };

                const discount = promotionalService.calculateCouponDiscount(coupon, 100);
                expect(discount).toBe(100); // Cannot exceed order amount
            });
        });
    });

    describe('Promotional Banners', () => {
        describe('createPromotionalBanner', () => {
            it('should create a promotional banner successfully', async () => {
                const bannerData = {
                    title: 'Summer Sale',
                    subtitle: 'Up to 50% off',
                    description: 'Get amazing discounts',
                    position: 'hero',
                    priority: 10
                };

                const mockResult = {
                    rows: [{
                        id: 1,
                        title: 'Summer Sale',
                        ...bannerData
                    }]
                };

                mockDbPool.query.mockResolvedValue(mockResult);

                const result = await promotionalService.createPromotionalBanner(bannerData);

                expect(mockDbPool.query).toHaveBeenCalledWith(
                    expect.stringContaining('INSERT INTO promotional_banners'),
                    expect.arrayContaining(['Summer Sale', 'Up to 50% off'])
                );
                expect(result).toEqual(mockResult.rows[0]);
            });
        });

        describe('getActivePromotionalBanners', () => {
            it('should return active banners', async () => {
                const mockBanners = [
                    { id: 1, title: 'Banner 1', position: 'hero' },
                    { id: 2, title: 'Banner 2', position: 'sidebar' }
                ];

                mockDbPool.query.mockResolvedValue({ rows: mockBanners });

                const result = await promotionalService.getActivePromotionalBanners();

                expect(mockDbPool.query).toHaveBeenCalledWith(
                    expect.stringContaining('SELECT * FROM promotional_banners'),
                    []
                );
                expect(result).toEqual(mockBanners);
            });

            it('should filter banners by position', async () => {
                const mockBanners = [
                    { id: 1, title: 'Hero Banner', position: 'hero' }
                ];

                mockDbPool.query.mockResolvedValue({ rows: mockBanners });

                const result = await promotionalService.getActivePromotionalBanners('hero');

                expect(mockDbPool.query).toHaveBeenCalledWith(
                    expect.stringContaining('AND position = $1'),
                    ['hero']
                );
                expect(result).toEqual(mockBanners);
            });
        });
    });

    describe('Featured Products', () => {
        describe('addFeaturedProduct', () => {
            it('should add a featured product successfully', async () => {
                const mockResult = {
                    rows: [{
                        id: 1,
                        product_id: 1,
                        section: 'hero',
                        priority: 5
                    }]
                };

                mockDbPool.query.mockResolvedValue(mockResult);

                const result = await promotionalService.addFeaturedProduct(1, 'hero', 5);

                expect(mockDbPool.query).toHaveBeenCalledWith(
                    expect.stringContaining('INSERT INTO featured_products'),
                    [1, 'hero', 5, null, null]
                );
                expect(result).toEqual(mockResult.rows[0]);
            });
        });

        describe('getFeaturedProducts', () => {
            it('should return featured products for a section', async () => {
                const mockProducts = [
                    {
                        id: 1,
                        product_id: 1,
                        section: 'hero',
                        name: 'Product 1',
                        price: 99.99
                    }
                ];

                mockDbPool.query.mockResolvedValue({ rows: mockProducts });

                const result = await promotionalService.getFeaturedProducts('hero');

                expect(mockDbPool.query).toHaveBeenCalledWith(
                    expect.stringContaining('JOIN products p ON fp.product_id = p.id'),
                    ['hero']
                );
                expect(result).toEqual(mockProducts);
            });
        });
    });

    describe('Flash Sales', () => {
        describe('createFlashSale', () => {
            it('should create a flash sale successfully', async () => {
                const flashSaleData = {
                    name: 'Flash Sale 24h',
                    description: '24 hour flash sale',
                    discountPercentage: 30,
                    startsAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                };

                const mockResult = {
                    rows: [{
                        id: 1,
                        name: 'Flash Sale 24h',
                        ...flashSaleData
                    }]
                };

                mockDbPool.query.mockResolvedValue(mockResult);

                const result = await promotionalService.createFlashSale(flashSaleData);

                expect(mockDbPool.query).toHaveBeenCalledWith(
                    expect.stringContaining('INSERT INTO flash_sales'),
                    expect.arrayContaining(['Flash Sale 24h', '24 hour flash sale', 30])
                );
                expect(result).toEqual(mockResult.rows[0]);
            });
        });

        describe('addProductToFlashSale', () => {
            it('should add product to flash sale with calculated sale price', async () => {
                // Mock flash sale query
                mockDbPool.query
                    .mockResolvedValueOnce({ rows: [{ discount_percentage: 20 }] })
                    .mockResolvedValueOnce({
                        rows: [{
                            id: 1,
                            flash_sale_id: 1,
                            product_id: 1,
                            original_price: 100,
                            sale_price: 80
                        }]
                    });

                const result = await promotionalService.addProductToFlashSale(1, 1, 100);

                expect(mockDbPool.query).toHaveBeenCalledTimes(2);
                expect(result.sale_price).toBe(80); // 100 - 20%
            });

            it('should throw error for non-existent flash sale', async () => {
                mockDbPool.query.mockResolvedValue({ rows: [] });

                await expect(promotionalService.addProductToFlashSale(999, 1, 100))
                    .rejects.toThrow('Flash sale not found');
            });
        });
    });

    describe('Loyalty Program', () => {
        describe('awardLoyaltyPoints', () => {
            it('should award loyalty points for order', async () => {
                // Mock program query and upsert query
                mockDbPool.query
                    .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // program query
                    .mockResolvedValueOnce({ rows: [{ points_per_dollar: 1.0 }] }) // rate query
                    .mockResolvedValueOnce({
                        rows: [{
                            total_points: 150,
                            available_points: 150
                        }]
                    }) // upsert query
                    .mockResolvedValueOnce({ rows: [{}] }); // transaction query

                const result = await promotionalService.awardLoyaltyPoints(1, 123, 50);

                expect(result.pointsEarned).toBe(50); // 50 * 1.0 points per dollar
                expect(result.totalPoints).toBe(150);
                expect(result.availablePoints).toBe(150);
            });

            it('should return null for zero points earned', async () => {
                mockDbPool.query
                    .mockResolvedValueOnce({ rows: [{ id: 1 }] })
                    .mockResolvedValueOnce({ rows: [{ points_per_dollar: 1.0 }] });

                const result = await promotionalService.awardLoyaltyPoints(1, 123, 0.5);

                expect(result).toBeNull(); // 0.5 * 1.0 = 0 points (floored)
            });
        });

        describe('redeemLoyaltyPoints', () => {
            it('should redeem loyalty points successfully', async () => {
                mockDbPool.query
                    .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // program query
                    .mockResolvedValueOnce({ rows: [{ available_points: 1000 }] }) // points query
                    .mockResolvedValueOnce({
                        rows: [{ available_points: 900 }]
                    }) // update query
                    .mockResolvedValueOnce({ rows: [{}] }); // transaction query

                const result = await promotionalService.redeemLoyaltyPoints(1, 100);

                expect(result.pointsRedeemed).toBe(100);
                expect(result.discountAmount).toBe(1.00); // 100 * 0.01
                expect(result.remainingPoints).toBe(900);
            });

            it('should throw error for insufficient points', async () => {
                mockDbPool.query
                    .mockResolvedValueOnce({ rows: [{ id: 1 }] })
                    .mockResolvedValueOnce({ rows: [{ available_points: 50 }] });

                await expect(promotionalService.redeemLoyaltyPoints(1, 100))
                    .rejects.toThrow('Insufficient loyalty points');
            });
        });
    });

    describe('Admin Functions', () => {
        describe('getAllCoupons', () => {
            it('should return paginated coupons', async () => {
                const mockCoupons = [
                    { id: 1, code: 'SAVE10', usage_count_actual: '5' },
                    { id: 2, code: 'SAVE20', usage_count_actual: '10' }
                ];

                mockDbPool.query.mockResolvedValue({ rows: mockCoupons });

                const result = await promotionalService.getAllCoupons(1, 20);

                expect(mockDbPool.query).toHaveBeenCalledWith(
                    expect.stringContaining('LIMIT $1 OFFSET $2'),
                    [20, 0]
                );
                expect(result).toEqual(mockCoupons);
            });
        });

        describe('getCouponUsageStats', () => {
            it('should return coupon usage statistics', async () => {
                const mockStats = {
                    total_uses: '25',
                    total_discount: '250.00',
                    unique_users: '20',
                    avg_discount: '10.00'
                };

                mockDbPool.query.mockResolvedValue({ rows: [mockStats] });

                const result = await promotionalService.getCouponUsageStats(1);

                expect(mockDbPool.query).toHaveBeenCalledWith(
                    expect.stringContaining('COUNT(*) as total_uses'),
                    [1]
                );
                expect(result).toEqual(mockStats);
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle database connection errors gracefully', async () => {
            const validCouponData = {
                code: 'TEST',
                name: 'Test Coupon',
                type: 'percentage',
                value: 10
            };

            mockDbPool.query.mockRejectedValue(new Error('Connection failed'));

            await expect(promotionalService.createCoupon(validCouponData))
                .rejects.toThrow('Connection failed');
        });

        it('should handle invalid data gracefully', async () => {
            const invalidCouponData = null;

            await expect(promotionalService.createCoupon(invalidCouponData))
                .rejects.toThrow();
        });
    });
});