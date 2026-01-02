const Joi = require('joi');

// User query validation schema (for admin user management)
const userQuerySchema = Joi.object({
    page: Joi.number()
        .integer()
        .min(1)
        .optional()
        .default(1)
        .messages({
            'number.integer': 'Page must be a whole number',
            'number.min': 'Page must be at least 1'
        }),

    limit: Joi.number()
        .integer()
        .min(1)
        .max(100)
        .optional()
        .default(20)
        .messages({
            'number.integer': 'Limit must be a whole number',
            'number.min': 'Limit must be at least 1',
            'number.max': 'Limit cannot exceed 100'
        }),

    search: Joi.string()
        .min(1)
        .max(255)
        .optional()
        .messages({
            'string.min': 'Search term cannot be empty',
            'string.max': 'Search term must be less than 255 characters'
        }),

    role: Joi.string()
        .valid('customer', 'admin')
        .optional()
        .messages({
            'any.only': 'Role must be either customer or admin'
        }),

    isActive: Joi.boolean()
        .optional()
        .messages({
            'boolean.base': 'isActive must be true or false'
        })
});

// Update user status validation schema
const updateUserStatusSchema = Joi.object({
    isActive: Joi.boolean()
        .required()
        .messages({
            'boolean.base': 'isActive must be true or false',
            'any.required': 'isActive is required'
        })
});

// Update user role validation schema
const updateUserRoleSchema = Joi.object({
    role: Joi.string()
        .valid('customer', 'admin')
        .required()
        .messages({
            'any.only': 'Role must be either customer or admin',
            'any.required': 'Role is required'
        })
});

// Admin order query validation schema
const adminOrderQuerySchema = Joi.object({
    page: Joi.number()
        .integer()
        .min(1)
        .optional()
        .default(1)
        .messages({
            'number.integer': 'Page must be a whole number',
            'number.min': 'Page must be at least 1'
        }),

    limit: Joi.number()
        .integer()
        .min(1)
        .max(100)
        .optional()
        .default(20)
        .messages({
            'number.integer': 'Limit must be a whole number',
            'number.min': 'Limit must be at least 1',
            'number.max': 'Limit cannot exceed 100'
        }),

    status: Joi.string()
        .valid('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')
        .optional()
        .messages({
            'any.only': 'Status must be one of: pending, confirmed, processing, shipped, delivered, cancelled'
        }),

    paymentStatus: Joi.string()
        .valid('pending', 'paid', 'failed', 'refunded')
        .optional()
        .messages({
            'any.only': 'Payment status must be one of: pending, paid, failed, refunded'
        }),

    userId: Joi.number()
        .integer()
        .positive()
        .optional()
        .messages({
            'number.integer': 'User ID must be a whole number',
            'number.positive': 'User ID must be a positive number'
        }),

    search: Joi.string()
        .min(1)
        .max(255)
        .optional()
        .messages({
            'string.min': 'Search term cannot be empty',
            'string.max': 'Search term must be less than 255 characters'
        })
});

// Update order status validation schema
const updateOrderStatusSchema = Joi.object({
    status: Joi.string()
        .valid('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')
        .required()
        .messages({
            'any.only': 'Status must be one of: pending, confirmed, processing, shipped, delivered, cancelled',
            'any.required': 'Status is required'
        })
});

// Update payment status validation schema
const updatePaymentStatusSchema = Joi.object({
    paymentStatus: Joi.string()
        .valid('pending', 'paid', 'failed', 'refunded')
        .required()
        .messages({
            'any.only': 'Payment status must be one of: pending, paid, failed, refunded',
            'any.required': 'Payment status is required'
        })
});

// Sales analytics query validation schema
const salesAnalyticsQuerySchema = Joi.object({
    period: Joi.string()
        .valid('7d', '30d', '90d', '1y')
        .optional()
        .default('30d')
        .messages({
            'any.only': 'Period must be one of: 7d, 30d, 90d, 1y'
        })
});

// Cache management validation schema
const cacheQuerySchema = Joi.object({
    pattern: Joi.string()
        .min(1)
        .max(100)
        .optional()
        .messages({
            'string.min': 'Pattern cannot be empty',
            'string.max': 'Pattern must be less than 100 characters'
        })
});

// System configuration validation schema
const systemConfigSchema = Joi.object({
    feature: Joi.string()
        .valid('email', 'stripe', 'cache', 'analytics')
        .optional()
        .messages({
            'any.only': 'Feature must be one of: email, stripe, cache, analytics'
        }),

    enabled: Joi.boolean()
        .optional()
        .messages({
            'boolean.base': 'Enabled must be true or false'
        })
});

// Bulk operations validation schema
const bulkOperationSchema = Joi.object({
    operation: Joi.string()
        .valid('activate', 'deactivate', 'delete', 'update_role')
        .required()
        .messages({
            'any.only': 'Operation must be one of: activate, deactivate, delete, update_role',
            'any.required': 'Operation is required'
        }),

    userIds: Joi.array()
        .items(Joi.number().integer().positive())
        .min(1)
        .max(100)
        .required()
        .messages({
            'array.min': 'At least one user ID is required',
            'array.max': 'Cannot process more than 100 users at once',
            'any.required': 'User IDs are required'
        }),

    role: Joi.string()
        .valid('customer', 'admin')
        .when('operation', {
            is: 'update_role',
            then: Joi.required(),
            otherwise: Joi.optional()
        })
        .messages({
            'any.only': 'Role must be either customer or admin',
            'any.required': 'Role is required for update_role operation'
        })
});

// Report generation validation schema
const reportQuerySchema = Joi.object({
    type: Joi.string()
        .valid('sales', 'users', 'products', 'orders')
        .required()
        .messages({
            'any.only': 'Report type must be one of: sales, users, products, orders',
            'any.required': 'Report type is required'
        }),

    startDate: Joi.date()
        .iso()
        .optional()
        .messages({
            'date.format': 'Start date must be in ISO format (YYYY-MM-DD)'
        }),

    endDate: Joi.date()
        .iso()
        .min(Joi.ref('startDate'))
        .optional()
        .messages({
            'date.format': 'End date must be in ISO format (YYYY-MM-DD)',
            'date.min': 'End date must be after start date'
        }),

    format: Joi.string()
        .valid('json', 'csv', 'pdf')
        .optional()
        .default('json')
        .messages({
            'any.only': 'Format must be one of: json, csv, pdf'
        })
});

// Validation middleware factory
const validate = (schema) => {
    return (req, res, next) => {
        const dataToValidate = req.method === 'GET' ? req.query : req.body;

        const { error, value } = schema.validate(dataToValidate, {
            abortEarly: false,
            stripUnknown: true,
            convert: true
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(400).json({
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                details: errors,
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }

        if (req.method === 'GET') {
            req.validatedQuery = value;
        } else {
            req.validatedData = value;
        }

        next();
    };
};

module.exports = {
    userQuerySchema,
    updateUserStatusSchema,
    updateUserRoleSchema,
    adminOrderQuerySchema,
    updateOrderStatusSchema,
    updatePaymentStatusSchema,
    salesAnalyticsQuerySchema,
    cacheQuerySchema,
    systemConfigSchema,
    bulkOperationSchema,
    reportQuerySchema,
    validate
};