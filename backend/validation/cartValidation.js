const Joi = require('joi');

// Add to cart validation schema
const addToCartSchema = Joi.object({
    productId: Joi.number()
        .integer()
        .positive()
        .required()
        .messages({
            'number.integer': 'Product ID must be a whole number',
            'number.positive': 'Product ID must be a positive number',
            'any.required': 'Product ID is required'
        }),

    quantity: Joi.number()
        .integer()
        .min(1)
        .max(100)
        .optional()
        .default(1)
        .messages({
            'number.integer': 'Quantity must be a whole number',
            'number.min': 'Quantity must be at least 1',
            'number.max': 'Quantity cannot exceed 100'
        })
});

// Update cart item validation schema
const updateCartItemSchema = Joi.object({
    quantity: Joi.number()
        .integer()
        .min(0)
        .max(100)
        .required()
        .messages({
            'number.integer': 'Quantity must be a whole number',
            'number.min': 'Quantity cannot be negative',
            'number.max': 'Quantity cannot exceed 100',
            'any.required': 'Quantity is required'
        })
});

// Order creation validation schema
const createOrderSchema = Joi.object({
    shippingAddress: Joi.object({
        firstName: Joi.string()
            .min(1)
            .max(50)
            .required()
            .messages({
                'string.min': 'First name is required',
                'string.max': 'First name must be less than 50 characters',
                'any.required': 'First name is required'
            }),

        lastName: Joi.string()
            .min(1)
            .max(50)
            .required()
            .messages({
                'string.min': 'Last name is required',
                'string.max': 'Last name must be less than 50 characters',
                'any.required': 'Last name is required'
            }),

        addressLine1: Joi.string()
            .min(1)
            .max(255)
            .required()
            .messages({
                'string.min': 'Address line 1 is required',
                'string.max': 'Address line 1 must be less than 255 characters',
                'any.required': 'Address line 1 is required'
            }),

        addressLine2: Joi.string()
            .max(255)
            .optional()
            .allow('')
            .messages({
                'string.max': 'Address line 2 must be less than 255 characters'
            }),

        city: Joi.string()
            .min(1)
            .max(100)
            .required()
            .messages({
                'string.min': 'City is required',
                'string.max': 'City must be less than 100 characters',
                'any.required': 'City is required'
            }),

        state: Joi.string()
            .min(1)
            .max(100)
            .optional()
            .messages({
                'string.min': 'State cannot be empty',
                'string.max': 'State must be less than 100 characters'
            }),

        postalCode: Joi.string()
            .min(1)
            .max(20)
            .required()
            .messages({
                'string.min': 'Postal code is required',
                'string.max': 'Postal code must be less than 20 characters',
                'any.required': 'Postal code is required'
            }),

        country: Joi.string()
            .min(1)
            .max(100)
            .required()
            .messages({
                'string.min': 'Country is required',
                'string.max': 'Country must be less than 100 characters',
                'any.required': 'Country is required'
            }),

        phone: Joi.string()
            .pattern(/^(\+88)?01[3-9]\d{8}$/)
            .optional()
            .messages({
                'string.pattern.base': 'Please provide a valid Bangladeshi phone number (e.g., 01712345678 or +8801712345678)'
            })
    }).required().messages({
        'any.required': 'Shipping address is required'
    }),

    billingAddress: Joi.object({
        firstName: Joi.string()
            .min(1)
            .max(50)
            .required()
            .messages({
                'string.min': 'First name is required',
                'string.max': 'First name must be less than 50 characters',
                'any.required': 'First name is required'
            }),

        lastName: Joi.string()
            .min(1)
            .max(50)
            .required()
            .messages({
                'string.min': 'Last name is required',
                'string.max': 'Last name must be less than 50 characters',
                'any.required': 'Last name is required'
            }),

        addressLine1: Joi.string()
            .min(1)
            .max(255)
            .required()
            .messages({
                'string.min': 'Address line 1 is required',
                'string.max': 'Address line 1 must be less than 255 characters',
                'any.required': 'Address line 1 is required'
            }),

        addressLine2: Joi.string()
            .max(255)
            .optional()
            .allow('')
            .messages({
                'string.max': 'Address line 2 must be less than 255 characters'
            }),

        city: Joi.string()
            .min(1)
            .max(100)
            .required()
            .messages({
                'string.min': 'City is required',
                'string.max': 'City must be less than 100 characters',
                'any.required': 'City is required'
            }),

        state: Joi.string()
            .min(1)
            .max(100)
            .optional()
            .messages({
                'string.min': 'State cannot be empty',
                'string.max': 'State must be less than 100 characters'
            }),

        postalCode: Joi.string()
            .min(1)
            .max(20)
            .required()
            .messages({
                'string.min': 'Postal code is required',
                'string.max': 'Postal code must be less than 20 characters',
                'any.required': 'Postal code is required'
            }),

        country: Joi.string()
            .min(1)
            .max(100)
            .required()
            .messages({
                'string.min': 'Country is required',
                'string.max': 'Country must be less than 100 characters',
                'any.required': 'Country is required'
            }),

        phone: Joi.string()
            .pattern(/^(\+88)?01[3-9]\d{8}$/)
            .optional()
            .messages({
                'string.pattern.base': 'Please provide a valid Bangladeshi phone number (e.g., 01712345678 or +8801712345678)'
            })
    }).optional(),

    paymentMethod: Joi.string()
        .valid('cash_on_delivery', 'credit_card', 'debit_card', 'mobile_banking', 'bank_transfer')
        .required()
        .messages({
            'any.only': 'Payment method must be one of: cash_on_delivery, credit_card, debit_card, mobile_banking, bank_transfer',
            'any.required': 'Payment method is required'
        }),

    notes: Joi.string()
        .max(500)
        .optional()
        .allow('')
        .messages({
            'string.max': 'Notes must be less than 500 characters'
        })
});

// Order query validation schema
const orderQuerySchema = Joi.object({
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
        .max(50)
        .optional()
        .default(10)
        .messages({
            'number.integer': 'Limit must be a whole number',
            'number.min': 'Limit must be at least 1',
            'number.max': 'Limit cannot exceed 50'
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
        })
});

// Order status update validation schema
const updateOrderStatusSchema = Joi.object({
    status: Joi.string()
        .valid('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')
        .required()
        .messages({
            'any.only': 'Status must be one of: pending, confirmed, processing, shipped, delivered, cancelled',
            'any.required': 'Status is required'
        })
});

// Payment status update validation schema
const updatePaymentStatusSchema = Joi.object({
    paymentStatus: Joi.string()
        .valid('pending', 'paid', 'failed', 'refunded')
        .required()
        .messages({
            'any.only': 'Payment status must be one of: pending, paid, failed, refunded',
            'any.required': 'Payment status is required'
        })
});

// Cancel order validation schema
const cancelOrderSchema = Joi.object({
    reason: Joi.string()
        .min(1)
        .max(500)
        .required()
        .messages({
            'string.min': 'Cancellation reason is required',
            'string.max': 'Cancellation reason must be less than 500 characters',
            'any.required': 'Cancellation reason is required'
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
    addToCartSchema,
    updateCartItemSchema,
    createOrderSchema,
    orderQuerySchema,
    updateOrderStatusSchema,
    updatePaymentStatusSchema,
    cancelOrderSchema,
    validate
};