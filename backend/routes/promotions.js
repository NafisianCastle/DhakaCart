const express = require('express');
const rateLimit = require('express-rate-limit');
const PromotionalController = require('../controllers/promotionalController');
const { authenticateToken, requireAdmin } = require('../auth/middleware');
const {
    validateCreateCoupon,
    validateCoupon,
    validateCreatePromotionalBanner,
    validateAddFeaturedProduct,
    validateCreateFlashSale,
    validateAddProductToFlashSale,
    validateRedeemLoyaltyPoints,
    validatePagination,
    validateBannerQuery,
    validateFeaturedProductsParams,
    validateFlashSaleParams,
    validateCouponParams
} = require('../validation/promotionalValidation');

const router = express.Router();

// Rate limiting for promotional endpoints
const promotionalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many promotional requests, please try again later.',
        retryAfter: '15 minutes'
    }
});

const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // higher limit for admin operations
    message: {
        error: 'Too many admin requests, please try again later.',
        retryAfter: '15 minutes'
    }
});

const loyaltyLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // limit loyalty operations to prevent abuse
    message: {
        error: 'Too many loyalty requests, please try again later.',
        retryAfter: '1 minute'
    }
});

let promotionalController = null;

// Initialize controller function
function initializeController(dbPool, redisPool, webSocketService, emailService) {
    promotionalController = new PromotionalController(dbPool, redisPool, webSocketService, emailService);
}

// Public endpoints (no authentication required)

// Get promotional banners
router.get('/banners',
    promotionalLimiter,
    validateBannerQuery,
    (req, res) => {
        if (!promotionalController) {
            return res.status(503).json({
                error: 'Service temporarily unavailable',
                correlationId: req.correlationId
            });
        }
        promotionalController.getPromotionalBanners(req, res);
    }
);

// Get featured products by section
router.get('/featured/:section',
    promotionalLimiter,
    validateFeaturedProductsParams,
    (req, res) => {
        if (!promotionalController) {
            return res.status(503).json({
                error: 'Service temporarily unavailable',
                correlationId: req.correlationId
            });
        }
        promotionalController.getFeaturedProducts(req, res);
    }
);

// Get active flash sales
router.get('/flash-sales',
    promotionalLimiter,
    (req, res) => {
        if (!promotionalController) {
            return res.status(503).json({
                error: 'Service temporarily unavailable',
                correlationId: req.correlationId
            });
        }
        promotionalController.getActiveFlashSales(req, res);
    }
);

// Get flash sale products
router.get('/flash-sales/:flashSaleId/products',
    promotionalLimiter,
    validateFlashSaleParams,
    (req, res) => {
        if (!promotionalController) {
            return res.status(503).json({
                error: 'Service temporarily unavailable',
                correlationId: req.correlationId
            });
        }
        promotionalController.getFlashSaleProducts(req, res);
    }
);

// Validate coupon (can be used by guests for cart validation)
router.get('/coupons/:code/validate',
    promotionalLimiter,
    validateCoupon,
    (req, res) => {
        if (!promotionalController) {
            return res.status(503).json({
                error: 'Service temporarily unavailable',
                correlationId: req.correlationId
            });
        }
        promotionalController.validateCoupon(req, res);
    }
);

// User endpoints (authentication required)

// Get user loyalty points
router.get('/loyalty/points',
    authenticateToken,
    promotionalLimiter,
    (req, res) => {
        if (!promotionalController) {
            return res.status(503).json({
                error: 'Service temporarily unavailable',
                correlationId: req.correlationId
            });
        }
        promotionalController.getUserLoyaltyPoints(req, res);
    }
);

// Redeem loyalty points
router.post('/loyalty/redeem',
    authenticateToken,
    loyaltyLimiter,
    validateRedeemLoyaltyPoints,
    (req, res) => {
        if (!promotionalController) {
            return res.status(503).json({
                error: 'Service temporarily unavailable',
                correlationId: req.correlationId
            });
        }
        promotionalController.redeemLoyaltyPoints(req, res);
    }
);

// Admin endpoints (admin authentication required)

// Create coupon
router.post('/admin/coupons',
    authenticateToken,
    requireAdmin,
    adminLimiter,
    validateCreateCoupon,
    (req, res) => {
        if (!promotionalController) {
            return res.status(503).json({
                error: 'Service temporarily unavailable',
                correlationId: req.correlationId
            });
        }
        promotionalController.createCoupon(req, res);
    }
);

// Get all coupons (admin)
router.get('/admin/coupons',
    authenticateToken,
    requireAdmin,
    adminLimiter,
    validatePagination,
    (req, res) => {
        if (!promotionalController) {
            return res.status(503).json({
                error: 'Service temporarily unavailable',
                correlationId: req.correlationId
            });
        }
        promotionalController.getAllCoupons(req, res);
    }
);

// Get coupon usage statistics
router.get('/admin/coupons/:couponId/stats',
    authenticateToken,
    requireAdmin,
    adminLimiter,
    validateCouponParams,
    (req, res) => {
        if (!promotionalController) {
            return res.status(503).json({
                error: 'Service temporarily unavailable',
                correlationId: req.correlationId
            });
        }
        promotionalController.getCouponUsageStats(req, res);
    }
);

// Create promotional banner
router.post('/admin/banners',
    authenticateToken,
    requireAdmin,
    adminLimiter,
    validateCreatePromotionalBanner,
    (req, res) => {
        if (!promotionalController) {
            return res.status(503).json({
                error: 'Service temporarily unavailable',
                correlationId: req.correlationId
            });
        }
        promotionalController.createPromotionalBanner(req, res);
    }
);

// Add featured product
router.post('/admin/featured',
    authenticateToken,
    requireAdmin,
    adminLimiter,
    validateAddFeaturedProduct,
    (req, res) => {
        if (!promotionalController) {
            return res.status(503).json({
                error: 'Service temporarily unavailable',
                correlationId: req.correlationId
            });
        }
        promotionalController.addFeaturedProduct(req, res);
    }
);

// Create flash sale
router.post('/admin/flash-sales',
    authenticateToken,
    requireAdmin,
    adminLimiter,
    validateCreateFlashSale,
    (req, res) => {
        if (!promotionalController) {
            return res.status(503).json({
                error: 'Service temporarily unavailable',
                correlationId: req.correlationId
            });
        }
        promotionalController.createFlashSale(req, res);
    }
);

// Add product to flash sale
router.post('/admin/flash-sales/:flashSaleId/products',
    authenticateToken,
    requireAdmin,
    adminLimiter,
    validateFlashSaleParams,
    validateAddProductToFlashSale,
    (req, res) => {
        if (!promotionalController) {
            return res.status(503).json({
                error: 'Service temporarily unavailable',
                correlationId: req.correlationId
            });
        }
        promotionalController.addProductToFlashSale(req, res);
    }
);

module.exports = {
    router,
    initializeController
};