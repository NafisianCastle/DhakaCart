const Joi = require('joi');

// Coupon validation schemas
const createCouponSchema = Joi.object({
    code: Joi.string()
        .trim()
        .uppercase()
        .min(3)
        .max(20)
        .pattern(/^[A-Z0-9_-]+$/)
        .required()
        .messages({
            'string.pattern.base': 'Coupon code must contain only uppercase letters, numbers, underscores, and hyphens'
        }),
    name: Joi.string()
        .trim()
        .min(3)
        .max(100)
        .required(),
    description: Joi.string()
        .trim()
        .max(500)
        .allow(''),
    type: Joi.string()
        .valid('percentage', 'fixed_amount', 'free_shipping')
        .required(),
    value: Joi.number()
        .positive()
        .precision(2)
        .required(),
    minimumOrderAmount: Joi.number()
        .min(0)
        .precision(2)
        .default(0),
    maximumDiscountAmount: Joi.number()
        .positive()
        .precision(2)
        .allow(null),
    usageLimit: Joi.number()
        .integer()
        .positive()
        .allow(null),
    userUsageLimit: Joi.number()
        .integer()
        .positive()
        .default(1),
    startsAt: Joi.date()
        .iso()
        .allow(null),
    expiresAt: Joi.date()
        .iso()
        .greater(Joi.ref('startsAt'))
        .allow(null)
}).custom((value, helpers) => {
    // Custom validation for percentage type
    if (value.type === 'percentage' && value.value > 100) {
        return helpers.error('custom.percentageLimit');
    }
    return value;
}).messages({
    'custom.percentageLimit': 'Percentage discount cannot exceed 100%'
});

const validateCouponSchema = Joi.object({
    code: Joi.string()
        .trim()
        .required(),
    orderAmount: Joi.number()
        .positive()
        .precision(2)
        .required()
});

// Promotional banner validation schemas
const createPromotionalBannerSchema = Joi.object({
    title: Joi.string()
        .trim()
        .min(3)
        .max(100)
        .required(),
    subtitle: Joi.string()
        .trim()
        .max(150)
        .allow(''),
    description: Joi.string()
        .trim()
        .max(500)
        .allow(''),
    imageUrl: Joi.string()
        .uri()
        .allow(''),
    linkUrl: Joi.string()
        .uri()
        .allow(''),
    buttonText: Joi.string()
        .trim()
        .max(50)
        .allow(''),
    position: Joi.string()
        .valid('hero', 'sidebar', 'footer', 'popup')
        .default('hero'),
    priority: Joi.number()
        .integer()
        .min(0)
        .default(0),
    startsAt: Joi.date()
        .iso()
        .allow(null),
    expiresAt: Joi.date()
        .iso()
        .greater(Joi.ref('startsAt'))
        .allow(null)
});

// Featured product validation schemas
const addFeaturedProductSchema = Joi.object({
    productId: Joi.number()
        .integer()
        .positive()
        .required(),
    section: Joi.string()
        .valid('hero', 'deals', 'trending', 'new_arrivals')
        .required(),
    priority: Joi.number()
        .integer()
        .min(0)
        .default(0),
    startsAt: Joi.date()
        .iso()
        .allow(null),
    expiresAt: Joi.date()
        .iso()
        .greater(Joi.ref('startsAt'))
        .allow(null)
});

// Flash sale validation schemas
const createFlashSaleSchema = Joi.object({
    name: Joi.string()
        .trim()
        .min(3)
        .max(100)
        .required(),
    description: Joi.string()
        .trim()
        .max(500)
        .allow(''),
    discountPercentage: Joi.number()
        .positive()
        .max(100)
        .precision(2)
        .required(),
    startsAt: Joi.date()
        .iso()
        .required(),
    expiresAt: Joi.date()
        .iso()
        .greater(Joi.ref('startsAt'))
        .required()
});

const addProductToFlashSaleSchema = Joi.object({
    productId: Joi.number()
        .integer()
        .positive()
        .required(),
    originalPrice: Joi.number()
        .positive()
        .precision(2)
        .required(),
    stockLimit: Joi.number()
        .integer()
        .positive()
        .allow(null)
});

// Loyalty program validation schemas
const redeemLoyaltyPointsSchema = Joi.object({
    pointsToRedeem: Joi.number()
        .integer()
        .positive()
        .required()
});

// Query parameter validation schemas
const paginationSchema = Joi.object({
    page: Joi.number()
        .integer()
        .positive()
        .default(1),
    limit: Joi.number()
        .integer()
        .positive()
        .max(100)
        .default(20)
});

const bannerQuerySchema = Joi.object({
    position: Joi.string()
        .valid('hero', 'sidebar', 'footer', 'popup')
        .allow('')
});

const featuredProductsParamsSchema = Joi.object({
    section: Joi.string()
        .valid('hero', 'deals', 'trending', 'new_arrivals')
        .required()
});

const flashSaleParamsSchema = Joi.object({
    flashSaleId: Joi.number()
        .integer()
        .positive()
        .required()
});

const couponParamsSchema = Joi.object({
    couponId: Joi.number()
        .integer()
        .positive()
        .required()
});

// Validation middleware functions
const validateCreateCoupon = (req, res, next) => {
    const { error, value } = createCouponSchema.validate(req.body, { abortEarly: false });

    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));

        return res.status(400).json({
            error: 'Validation failed',
            details: errors,
            correlationId: req.correlationId
        });
    }

    req.body = value;
    next();
};

const validateCoupon = (req, res, next) => {
    const { error, value } = validateCouponSchema.validate({
        code: req.params.code,
        orderAmount: req.query.orderAmount
    }, { abortEarly: false });

    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));

        return res.status(400).json({
            error: 'Validation failed',
            details: errors,
            correlationId: req.correlationId
        });
    }

    req.params.code = value.code;
    req.query.orderAmount = value.orderAmount;
    next();
};

const validateCreatePromotionalBanner = (req, res, next) => {
    const { error, value } = createPromotionalBannerSchema.validate(req.body, { abortEarly: false });

    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));

        return res.status(400).json({
            error: 'Validation failed',
            details: errors,
            correlationId: req.correlationId
        });
    }

    req.body = value;
    next();
};

const validateAddFeaturedProduct = (req, res, next) => {
    const { error, value } = addFeaturedProductSchema.validate(req.body, { abortEarly: false });

    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));

        return res.status(400).json({
            error: 'Validation failed',
            details: errors,
            correlationId: req.correlationId
        });
    }

    req.body = value;
    next();
};

const validateCreateFlashSale = (req, res, next) => {
    const { error, value } = createFlashSaleSchema.validate(req.body, { abortEarly: false });

    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));

        return res.status(400).json({
            error: 'Validation failed',
            details: errors,
            correlationId: req.correlationId
        });
    }

    req.body = value;
    next();
};

const validateAddProductToFlashSale = (req, res, next) => {
    const { error, value } = addProductToFlashSaleSchema.validate(req.body, { abortEarly: false });

    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));

        return res.status(400).json({
            error: 'Validation failed',
            details: errors,
            correlationId: req.correlationId
        });
    }

    req.body = value;
    next();
};

const validateRedeemLoyaltyPoints = (req, res, next) => {
    const { error, value } = redeemLoyaltyPointsSchema.validate(req.body, { abortEarly: false });

    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));

        return res.status(400).json({
            error: 'Validation failed',
            details: errors,
            correlationId: req.correlationId
        });
    }

    req.body = value;
    next();
};

const validatePagination = (req, res, next) => {
    const { error, value } = paginationSchema.validate(req.query, { abortEarly: false });

    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));

        return res.status(400).json({
            error: 'Validation failed',
            details: errors,
            correlationId: req.correlationId
        });
    }

    req.query = { ...req.query, ...value };
    next();
};

const validateBannerQuery = (req, res, next) => {
    const { error, value } = bannerQuerySchema.validate(req.query, { abortEarly: false });

    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));

        return res.status(400).json({
            error: 'Validation failed',
            details: errors,
            correlationId: req.correlationId
        });
    }

    req.query = { ...req.query, ...value };
    next();
};

const validateFeaturedProductsParams = (req, res, next) => {
    const { error, value } = featuredProductsParamsSchema.validate(req.params, { abortEarly: false });

    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));

        return res.status(400).json({
            error: 'Validation failed',
            details: errors,
            correlationId: req.correlationId
        });
    }

    req.params = { ...req.params, ...value };
    next();
};

const validateFlashSaleParams = (req, res, next) => {
    const { error, value } = flashSaleParamsSchema.validate({
        flashSaleId: parseInt(req.params.flashSaleId)
    }, { abortEarly: false });

    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));

        return res.status(400).json({
            error: 'Validation failed',
            details: errors,
            correlationId: req.correlationId
        });
    }

    req.params.flashSaleId = value.flashSaleId;
    next();
};

const validateCouponParams = (req, res, next) => {
    const { error, value } = couponParamsSchema.validate({
        couponId: parseInt(req.params.couponId)
    }, { abortEarly: false });

    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));

        return res.status(400).json({
            error: 'Validation failed',
            details: errors,
            correlationId: req.correlationId
        });
    }

    req.params.couponId = value.couponId;
    next();
};

module.exports = {
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
};