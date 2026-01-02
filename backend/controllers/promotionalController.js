const logger = require('../logger');
const PromotionalService = require('../services/promotionalService');

class PromotionalController {
    constructor(dbPool, redisPool, webSocketService, emailService) {
        this.dbPool = dbPool;
        this.redisPool = redisPool;
        this.webSocketService = webSocketService;
        this.emailService = emailService;
        this.promotionalService = new PromotionalService(dbPool);
    }

    // Coupon endpoints
    async validateCoupon(req, res) {
        try {
            const { code } = req.params;
            const { orderAmount } = req.query;
            const userId = req.user?.id;

            if (!code) {
                return res.status(400).json({
                    error: 'Coupon code is required',
                    correlationId: req.correlationId
                });
            }

            if (!orderAmount || isNaN(orderAmount) || parseFloat(orderAmount) <= 0) {
                return res.status(400).json({
                    error: 'Valid order amount is required',
                    correlationId: req.correlationId
                });
            }

            const validation = await this.promotionalService.validateCoupon(
                code,
                userId,
                parseFloat(orderAmount)
            );

            if (!validation.valid) {
                return res.status(400).json({
                    error: validation.error,
                    correlationId: req.correlationId
                });
            }

            logger.info('Coupon validated successfully', {
                correlationId: req.correlationId,
                code,
                userId,
                discount: validation.discount
            });

            res.json({
                valid: true,
                coupon: {
                    id: validation.coupon.id,
                    code: validation.coupon.code,
                    name: validation.coupon.name,
                    description: validation.coupon.description,
                    type: validation.coupon.type,
                    value: validation.coupon.value
                },
                discount: validation.discount,
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Error validating coupon', {
                correlationId: req.correlationId,
                error: error.message
            });

            res.status(500).json({
                error: 'Failed to validate coupon',
                correlationId: req.correlationId
            });
        }
    }

    // Promotional banners endpoints
    async getPromotionalBanners(req, res) {
        try {
            const { position } = req.query;
            const cacheKey = `promotional_banners:${position || 'all'}`;

            // Try to get from cache first
            let banners = null;
            if (this.redisPool && this.redisPool.isConnected) {
                banners = await this.redisPool.getCachedData(cacheKey);
            }

            if (!banners) {
                banners = await this.promotionalService.getActivePromotionalBanners(position);

                // Cache for 5 minutes
                if (this.redisPool && this.redisPool.isConnected) {
                    await this.redisPool.setCachedData(cacheKey, banners, 300);
                }
            }

            logger.info('Promotional banners fetched successfully', {
                correlationId: req.correlationId,
                position,
                count: banners.length
            });

            res.json({
                banners,
                count: banners.length,
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Error fetching promotional banners', {
                correlationId: req.correlationId,
                error: error.message
            });

            res.status(500).json({
                error: 'Failed to fetch promotional banners',
                correlationId: req.correlationId
            });
        }
    }

    // Featured products endpoints
    async getFeaturedProducts(req, res) {
        try {
            const { section } = req.params;
            const cacheKey = `featured_products:${section}`;

            // Try to get from cache first
            let products = null;
            if (this.redisPool && this.redisPool.isConnected) {
                products = await this.redisPool.getCachedData(cacheKey);
            }

            if (!products) {
                products = await this.promotionalService.getFeaturedProducts(section);

                // Cache for 10 minutes
                if (this.redisPool && this.redisPool.isConnected) {
                    await this.redisPool.setCachedData(cacheKey, products, 600);
                }
            }

            logger.info('Featured products fetched successfully', {
                correlationId: req.correlationId,
                section,
                count: products.length
            });

            res.json({
                products,
                section,
                count: products.length,
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Error fetching featured products', {
                correlationId: req.correlationId,
                error: error.message,
                section: req.params.section
            });

            res.status(500).json({
                error: 'Failed to fetch featured products',
                correlationId: req.correlationId
            });
        }
    }

    // Flash sales endpoints
    async getActiveFlashSales(req, res) {
        try {
            const cacheKey = 'flash_sales:active';

            // Try to get from cache first
            let flashSales = null;
            if (this.redisPool && this.redisPool.isConnected) {
                flashSales = await this.redisPool.getCachedData(cacheKey);
            }

            if (!flashSales) {
                flashSales = await this.promotionalService.getActiveFlashSales();

                // Cache for 2 minutes (shorter cache for time-sensitive data)
                if (this.redisPool && this.redisPool.isConnected) {
                    await this.redisPool.setCachedData(cacheKey, flashSales, 120);
                }
            }

            logger.info('Flash sales fetched successfully', {
                correlationId: req.correlationId,
                count: flashSales.length
            });

            res.json({
                flashSales,
                count: flashSales.length,
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Error fetching flash sales', {
                correlationId: req.correlationId,
                error: error.message
            });

            res.status(500).json({
                error: 'Failed to fetch flash sales',
                correlationId: req.correlationId
            });
        }
    }

    async getFlashSaleProducts(req, res) {
        try {
            const { flashSaleId } = req.params;
            const cacheKey = `flash_sale_products:${flashSaleId}`;

            // Try to get from cache first
            let products = null;
            if (this.redisPool && this.redisPool.isConnected) {
                products = await this.redisPool.getCachedData(cacheKey);
            }

            if (!products) {
                products = await this.promotionalService.getFlashSaleProducts(flashSaleId);

                // Cache for 2 minutes
                if (this.redisPool && this.redisPool.isConnected) {
                    await this.redisPool.setCachedData(cacheKey, products, 120);
                }
            }

            logger.info('Flash sale products fetched successfully', {
                correlationId: req.correlationId,
                flashSaleId,
                count: products.length
            });

            res.json({
                products,
                flashSaleId: parseInt(flashSaleId),
                count: products.length,
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Error fetching flash sale products', {
                correlationId: req.correlationId,
                error: error.message,
                flashSaleId: req.params.flashSaleId
            });

            res.status(500).json({
                error: 'Failed to fetch flash sale products',
                correlationId: req.correlationId
            });
        }
    }

    // Loyalty program endpoints
    async getUserLoyaltyPoints(req, res) {
        try {
            const userId = req.user.id;
            const cacheKey = `loyalty_points:${userId}`;

            // Try to get from cache first
            let loyaltyData = null;
            if (this.redisPool && this.redisPool.isConnected) {
                loyaltyData = await this.redisPool.getCachedData(cacheKey);
            }

            if (!loyaltyData) {
                loyaltyData = await this.promotionalService.getUserLoyaltyPoints(userId);

                // Cache for 5 minutes
                if (this.redisPool && this.redisPool.isConnected) {
                    await this.redisPool.setCachedData(cacheKey, loyaltyData, 300);
                }
            }

            logger.info('User loyalty points fetched successfully', {
                correlationId: req.correlationId,
                userId
            });

            res.json({
                loyaltyData: Array.isArray(loyaltyData) ? loyaltyData : [loyaltyData].filter(Boolean),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Error fetching user loyalty points', {
                correlationId: req.correlationId,
                error: error.message,
                userId: req.user?.id
            });

            res.status(500).json({
                error: 'Failed to fetch loyalty points',
                correlationId: req.correlationId
            });
        }
    }

    async redeemLoyaltyPoints(req, res) {
        try {
            const userId = req.user.id;
            const { pointsToRedeem } = req.body;

            if (!pointsToRedeem || isNaN(pointsToRedeem) || pointsToRedeem <= 0) {
                return res.status(400).json({
                    error: 'Valid points amount is required',
                    correlationId: req.correlationId
                });
            }

            const redemption = await this.promotionalService.redeemLoyaltyPoints(
                userId,
                parseInt(pointsToRedeem)
            );

            // Clear cache
            if (this.redisPool && this.redisPool.isConnected) {
                await this.redisPool.deleteCachedData(`loyalty_points:${userId}`);
            }

            logger.info('Loyalty points redeemed successfully', {
                correlationId: req.correlationId,
                userId,
                pointsRedeemed: redemption.pointsRedeemed,
                discountAmount: redemption.discountAmount
            });

            res.json({
                success: true,
                redemption,
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Error redeeming loyalty points', {
                correlationId: req.correlationId,
                error: error.message,
                userId: req.user?.id
            });

            res.status(400).json({
                error: error.message,
                correlationId: req.correlationId
            });
        }
    }

    // Admin endpoints
    async createCoupon(req, res) {
        try {
            const couponData = req.body;
            const coupon = await this.promotionalService.createCoupon(couponData);

            logger.info('Coupon created successfully by admin', {
                correlationId: req.correlationId,
                adminId: req.user.id,
                couponId: coupon.id,
                code: coupon.code
            });

            res.status(201).json({
                success: true,
                coupon,
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Error creating coupon', {
                correlationId: req.correlationId,
                error: error.message,
                adminId: req.user?.id
            });

            if (error.code === '23505') { // Unique constraint violation
                return res.status(400).json({
                    error: 'Coupon code already exists',
                    correlationId: req.correlationId
                });
            }

            res.status(500).json({
                error: 'Failed to create coupon',
                correlationId: req.correlationId
            });
        }
    }

    async createPromotionalBanner(req, res) {
        try {
            const bannerData = req.body;
            const banner = await this.promotionalService.createPromotionalBanner(bannerData);

            // Clear cache
            if (this.redisPool && this.redisPool.isConnected) {
                const cacheKeys = [
                    'promotional_banners:all',
                    `promotional_banners:${bannerData.position || 'hero'}`
                ];
                for (const key of cacheKeys) {
                    await this.redisPool.deleteCachedData(key);
                }
            }

            logger.info('Promotional banner created successfully by admin', {
                correlationId: req.correlationId,
                adminId: req.user.id,
                bannerId: banner.id,
                title: banner.title
            });

            res.status(201).json({
                success: true,
                banner,
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Error creating promotional banner', {
                correlationId: req.correlationId,
                error: error.message,
                adminId: req.user?.id
            });

            res.status(500).json({
                error: 'Failed to create promotional banner',
                correlationId: req.correlationId
            });
        }
    }

    async addFeaturedProduct(req, res) {
        try {
            const { productId, section, priority, startsAt, expiresAt } = req.body;

            const featuredProduct = await this.promotionalService.addFeaturedProduct(
                productId,
                section,
                priority,
                startsAt,
                expiresAt
            );

            // Clear cache
            if (this.redisPool && this.redisPool.isConnected) {
                await this.redisPool.deleteCachedData(`featured_products:${section}`);
            }

            logger.info('Featured product added successfully by admin', {
                correlationId: req.correlationId,
                adminId: req.user.id,
                productId,
                section
            });

            res.status(201).json({
                success: true,
                featuredProduct,
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Error adding featured product', {
                correlationId: req.correlationId,
                error: error.message,
                adminId: req.user?.id
            });

            res.status(500).json({
                error: 'Failed to add featured product',
                correlationId: req.correlationId
            });
        }
    }

    async createFlashSale(req, res) {
        try {
            const flashSaleData = req.body;
            const flashSale = await this.promotionalService.createFlashSale(flashSaleData);

            // Clear cache
            if (this.redisPool && this.redisPool.isConnected) {
                await this.redisPool.deleteCachedData('flash_sales:active');
            }

            logger.info('Flash sale created successfully by admin', {
                correlationId: req.correlationId,
                adminId: req.user.id,
                flashSaleId: flashSale.id,
                name: flashSale.name
            });

            res.status(201).json({
                success: true,
                flashSale,
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Error creating flash sale', {
                correlationId: req.correlationId,
                error: error.message,
                adminId: req.user?.id
            });

            res.status(500).json({
                error: 'Failed to create flash sale',
                correlationId: req.correlationId
            });
        }
    }

    async addProductToFlashSale(req, res) {
        try {
            const { flashSaleId } = req.params;
            const { productId, originalPrice, stockLimit } = req.body;

            const flashSaleProduct = await this.promotionalService.addProductToFlashSale(
                parseInt(flashSaleId),
                productId,
                originalPrice,
                stockLimit
            );

            // Clear cache
            if (this.redisPool && this.redisPool.isConnected) {
                await this.redisPool.deleteCachedData(`flash_sale_products:${flashSaleId}`);
                await this.redisPool.deleteCachedData('flash_sales:active');
            }

            logger.info('Product added to flash sale successfully by admin', {
                correlationId: req.correlationId,
                adminId: req.user.id,
                flashSaleId,
                productId
            });

            res.status(201).json({
                success: true,
                flashSaleProduct,
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Error adding product to flash sale', {
                correlationId: req.correlationId,
                error: error.message,
                adminId: req.user?.id
            });

            res.status(500).json({
                error: 'Failed to add product to flash sale',
                correlationId: req.correlationId
            });
        }
    }

    async getAllCoupons(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;

            const coupons = await this.promotionalService.getAllCoupons(page, limit);

            logger.info('All coupons fetched successfully by admin', {
                correlationId: req.correlationId,
                adminId: req.user.id,
                page,
                limit,
                count: coupons.length
            });

            res.json({
                coupons,
                page,
                limit,
                count: coupons.length,
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Error fetching all coupons', {
                correlationId: req.correlationId,
                error: error.message,
                adminId: req.user?.id
            });

            res.status(500).json({
                error: 'Failed to fetch coupons',
                correlationId: req.correlationId
            });
        }
    }

    async getCouponUsageStats(req, res) {
        try {
            const { couponId } = req.params;
            const stats = await this.promotionalService.getCouponUsageStats(parseInt(couponId));

            logger.info('Coupon usage stats fetched successfully by admin', {
                correlationId: req.correlationId,
                adminId: req.user.id,
                couponId
            });

            res.json({
                stats,
                couponId: parseInt(couponId),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Error fetching coupon usage stats', {
                correlationId: req.correlationId,
                error: error.message,
                adminId: req.user?.id
            });

            res.status(500).json({
                error: 'Failed to fetch coupon usage stats',
                correlationId: req.correlationId
            });
        }
    }
}

module.exports = PromotionalController;