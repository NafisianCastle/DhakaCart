const Joi = require('joi');

// Create payment intent validation schema
const createPaymentIntentSchema = Joi.object({
    orderId: Joi.number()
        .integer()
        .positive()
        .required()
        .messages({
            'number.integer': 'Order ID must be a whole number',
            'number.positive': 'Order ID must be a positive number',
            'any.required': 'Order ID is required'
        }),

    currency: Joi.string()
        .valid('usd', 'eur', 'gbp', 'bdt')
        .optional()
        .default('usd')
        .messages({
            'any.only': 'Currency must be one of: usd, eur, gbp, bdt'
        }),

    metadata: Joi.object()
        .optional()
        .default({})
        .messages({
            'object.base': 'Metadata must be an object'
        })
});

// Confirm payment validation schema
const confirmPaymentSchema = Joi.object({
    paymentIntentId: Joi.string()
        .required()
        .messages({
            'any.required': 'Payment intent ID is required'
        }),

    paymentMethodId: Joi.string()
        .required()
        .messages({
            'any.required': 'Payment method ID is required'
        })
});

// Refund payment validation schema
const refundPaymentSchema = Joi.object({
    amount: Joi.number()
        .positive()
        .precision(2)
        .optional()
        .messages({
            'number.positive': 'Refund amount must be a positive number'
        }),

    reason: Joi.string()
        .valid('duplicate', 'fraudulent', 'requested_by_customer')
        .optional()
        .default('requested_by_customer')
        .messages({
            'any.only': 'Reason must be one of: duplicate, fraudulent, requested_by_customer'
        })
});

// Create customer validation schema
const createCustomerSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required'
        }),

    name: Joi.string()
        .min(1)
        .max(100)
        .required()
        .messages({
            'string.min': 'Name is required',
            'string.max': 'Name must be less than 100 characters',
            'any.required': 'Name is required'
        }),

    metadata: Joi.object()
        .optional()
        .default({})
        .messages({
            'object.base': 'Metadata must be an object'
        })
});

// Webhook validation (for raw body)
const webhookSchema = Joi.object({
    signature: Joi.string()
        .required()
        .messages({
            'any.required': 'Stripe signature is required'
        })
});

// Payment method validation schema
const paymentMethodSchema = Joi.object({
    type: Joi.string()
        .valid('card', 'bank_account', 'ideal', 'sepa_debit')
        .optional()
        .default('card')
        .messages({
            'any.only': 'Payment method type must be one of: card, bank_account, ideal, sepa_debit'
        }),

    card: Joi.object({
        number: Joi.string()
            .creditCard()
            .required()
            .messages({
                'string.creditCard': 'Please provide a valid credit card number',
                'any.required': 'Card number is required'
            }),

        exp_month: Joi.number()
            .integer()
            .min(1)
            .max(12)
            .required()
            .messages({
                'number.integer': 'Expiry month must be a whole number',
                'number.min': 'Expiry month must be between 1 and 12',
                'number.max': 'Expiry month must be between 1 and 12',
                'any.required': 'Expiry month is required'
            }),

        exp_year: Joi.number()
            .integer()
            .min(new Date().getFullYear())
            .max(new Date().getFullYear() + 20)
            .required()
            .messages({
                'number.integer': 'Expiry year must be a whole number',
                'number.min': 'Expiry year cannot be in the past',
                'number.max': 'Expiry year is too far in the future',
                'any.required': 'Expiry year is required'
            }),

        cvc: Joi.string()
            .pattern(/^\d{3,4}$/)
            .required()
            .messages({
                'string.pattern.base': 'CVC must be 3 or 4 digits',
                'any.required': 'CVC is required'
            })
    }).when('type', {
        is: 'card',
        then: Joi.required(),
        otherwise: Joi.optional()
    }),

    billing_details: Joi.object({
        name: Joi.string()
            .max(100)
            .optional()
            .messages({
                'string.max': 'Name must be less than 100 characters'
            }),

        email: Joi.string()
            .email()
            .optional()
            .messages({
                'string.email': 'Please provide a valid email address'
            }),

        phone: Joi.string()
            .pattern(/^(\+88)?01[3-9]\d{8}$/)
            .optional()
            .messages({
                'string.pattern.base': 'Please provide a valid Bangladeshi phone number'
            }),

        address: Joi.object({
            line1: Joi.string().max(255).optional(),
            line2: Joi.string().max(255).optional(),
            city: Joi.string().max(100).optional(),
            state: Joi.string().max(100).optional(),
            postal_code: Joi.string().max(20).optional(),
            country: Joi.string().length(2).optional()
        }).optional()
    }).optional()
});

// Enhanced checkout validation schema (combines order and payment)
const enhancedCheckoutSchema = Joi.object({
    // Order details
    shippingAddress: Joi.object({
        firstName: Joi.string().min(1).max(50).required(),
        lastName: Joi.string().min(1).max(50).required(),
        addressLine1: Joi.string().min(1).max(255).required(),
        addressLine2: Joi.string().max(255).optional().allow(''),
        city: Joi.string().min(1).max(100).required(),
        state: Joi.string().min(1).max(100).optional(),
        postalCode: Joi.string().min(1).max(20).required(),
        country: Joi.string().min(1).max(100).required(),
        phone: Joi.string().pattern(/^(\+88)?01[3-9]\d{8}$/).optional()
    }).required(),

    billingAddress: Joi.object({
        firstName: Joi.string().min(1).max(50).required(),
        lastName: Joi.string().min(1).max(50).required(),
        addressLine1: Joi.string().min(1).max(255).required(),
        addressLine2: Joi.string().max(255).optional().allow(''),
        city: Joi.string().min(1).max(100).required(),
        state: Joi.string().min(1).max(100).optional(),
        postalCode: Joi.string().min(1).max(20).required(),
        country: Joi.string().min(1).max(100).required(),
        phone: Joi.string().pattern(/^(\+88)?01[3-9]\d{8}$/).optional()
    }).optional(),

    // Payment details
    paymentMethod: Joi.string()
        .valid('stripe_card', 'cash_on_delivery', 'mobile_banking', 'bank_transfer')
        .required()
        .messages({
            'any.only': 'Payment method must be one of: stripe_card, cash_on_delivery, mobile_banking, bank_transfer',
            'any.required': 'Payment method is required'
        }),

    // Stripe-specific fields (required when paymentMethod is 'stripe_card')
    paymentMethodId: Joi.string()
        .when('paymentMethod', {
            is: 'stripe_card',
            then: Joi.required(),
            otherwise: Joi.optional()
        })
        .messages({
            'any.required': 'Payment method ID is required for card payments'
        }),

    savePaymentMethod: Joi.boolean()
        .optional()
        .default(false)
        .messages({
            'boolean.base': 'Save payment method must be true or false'
        }),

    currency: Joi.string()
        .valid('usd', 'eur', 'gbp', 'bdt')
        .optional()
        .default('usd')
        .messages({
            'any.only': 'Currency must be one of: usd, eur, gbp, bdt'
        }),

    notes: Joi.string()
        .max(500)
        .optional()
        .allow('')
        .messages({
            'string.max': 'Notes must be less than 500 characters'
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

// Special middleware for webhook validation (handles raw body)
const validateWebhook = (req, res, next) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
        return res.status(400).json({
            error: 'Missing Stripe signature',
            code: 'MISSING_SIGNATURE',
            timestamp: new Date().toISOString()
        });
    }

    req.stripeSignature = signature;
    next();
};

module.exports = {
    createPaymentIntentSchema,
    confirmPaymentSchema,
    refundPaymentSchema,
    createCustomerSchema,
    webhookSchema,
    paymentMethodSchema,
    enhancedCheckoutSchema,
    validate,
    validateWebhook
};