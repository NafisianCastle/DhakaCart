const Joi = require('joi');

// Validation middleware
const validate = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context.value
            }));

            return res.status(400).json({
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                details: errors,
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }

        req.validatedData = value;
        next();
    };
};

// Newsletter email schema
const sendNewsletterSchema = Joi.object({
    subject: Joi.string()
        .min(1)
        .max(200)
        .required()
        .messages({
            'string.empty': 'Subject is required',
            'string.max': 'Subject must be less than 200 characters'
        }),

    content: Joi.string()
        .min(1)
        .max(10000)
        .required()
        .messages({
            'string.empty': 'Content is required',
            'string.max': 'Content must be less than 10,000 characters'
        }),

    ctaText: Joi.string()
        .max(50)
        .optional()
        .allow('')
        .messages({
            'string.max': 'CTA text must be less than 50 characters'
        }),

    ctaUrl: Joi.string()
        .uri()
        .optional()
        .allow('')
        .messages({
            'string.uri': 'CTA URL must be a valid URL'
        })
});

// Bulk email schema
const sendBulkEmailSchema = Joi.object({
    recipients: Joi.array()
        .items(
            Joi.object({
                email: Joi.string()
                    .email()
                    .required()
                    .messages({
                        'string.email': 'Invalid email address',
                        'string.empty': 'Email is required'
                    }),

                firstName: Joi.string()
                    .max(50)
                    .optional()
                    .allow('')
                    .messages({
                        'string.max': 'First name must be less than 50 characters'
                    }),

                lastName: Joi.string()
                    .max(50)
                    .optional()
                    .allow('')
                    .messages({
                        'string.max': 'Last name must be less than 50 characters'
                    }),

                customData: Joi.object()
                    .optional()
                    .messages({
                        'object.base': 'Custom data must be an object'
                    })
            })
        )
        .min(1)
        .max(1000)
        .required()
        .messages({
            'array.min': 'At least one recipient is required',
            'array.max': 'Maximum 1000 recipients allowed per bulk email',
            'array.base': 'Recipients must be an array'
        }),

    subject: Joi.string()
        .min(1)
        .max(200)
        .required()
        .messages({
            'string.empty': 'Subject is required',
            'string.max': 'Subject must be less than 200 characters'
        }),

    templateName: Joi.string()
        .min(1)
        .max(50)
        .required()
        .messages({
            'string.empty': 'Template name is required',
            'string.max': 'Template name must be less than 50 characters'
        }),

    templateData: Joi.object()
        .optional()
        .default({})
        .messages({
            'object.base': 'Template data must be an object'
        })
});

// Email template schema
const emailTemplateSchema = Joi.object({
    name: Joi.string()
        .min(1)
        .max(50)
        .pattern(/^[a-z0-9-_]+$/)
        .required()
        .messages({
            'string.empty': 'Template name is required',
            'string.max': 'Template name must be less than 50 characters',
            'string.pattern.base': 'Template name can only contain lowercase letters, numbers, hyphens, and underscores'
        }),

    content: Joi.string()
        .min(1)
        .max(50000)
        .required()
        .messages({
            'string.empty': 'Template content is required',
            'string.max': 'Template content must be less than 50,000 characters'
        }),

    description: Joi.string()
        .max(500)
        .optional()
        .allow('')
        .messages({
            'string.max': 'Description must be less than 500 characters'
        }),

    variables: Joi.array()
        .items(
            Joi.object({
                name: Joi.string()
                    .min(1)
                    .max(50)
                    .required()
                    .messages({
                        'string.empty': 'Variable name is required',
                        'string.max': 'Variable name must be less than 50 characters'
                    }),

                description: Joi.string()
                    .max(200)
                    .optional()
                    .allow('')
                    .messages({
                        'string.max': 'Variable description must be less than 200 characters'
                    }),

                required: Joi.boolean()
                    .optional()
                    .default(false)
                    .messages({
                        'boolean.base': 'Required flag must be a boolean'
                    })
            })
        )
        .optional()
        .default([])
        .messages({
            'array.base': 'Variables must be an array'
        })
});

// Test email schema
const testEmailSchema = Joi.object({
    email: Joi.string()
        .email()
        .optional()
        .messages({
            'string.email': 'Invalid email address'
        }),

    templateName: Joi.string()
        .min(1)
        .max(50)
        .optional()
        .default('newsletter')
        .messages({
            'string.max': 'Template name must be less than 50 characters'
        }),

    subject: Joi.string()
        .min(1)
        .max(200)
        .optional()
        .default('Test Email')
        .messages({
            'string.max': 'Subject must be less than 200 characters'
        }),

    templateData: Joi.object()
        .optional()
        .default({})
        .messages({
            'object.base': 'Template data must be an object'
        })
});

// Email campaign query schema
const emailCampaignQuerySchema = Joi.object({
    page: Joi.number()
        .integer()
        .min(1)
        .optional()
        .default(1)
        .messages({
            'number.base': 'Page must be a number',
            'number.integer': 'Page must be an integer',
            'number.min': 'Page must be at least 1'
        }),

    limit: Joi.number()
        .integer()
        .min(1)
        .max(100)
        .optional()
        .default(50)
        .messages({
            'number.base': 'Limit must be a number',
            'number.integer': 'Limit must be an integer',
            'number.min': 'Limit must be at least 1',
            'number.max': 'Limit must be at most 100'
        }),

    type: Joi.string()
        .valid('newsletter', 'bulk', 'transactional')
        .optional()
        .messages({
            'any.only': 'Type must be one of: newsletter, bulk, transactional'
        }),

    startDate: Joi.date()
        .iso()
        .optional()
        .messages({
            'date.format': 'Start date must be in ISO format'
        }),

    endDate: Joi.date()
        .iso()
        .min(Joi.ref('startDate'))
        .optional()
        .messages({
            'date.format': 'End date must be in ISO format',
            'date.min': 'End date must be after start date'
        })
});

module.exports = {
    validate,
    sendNewsletterSchema,
    sendBulkEmailSchema,
    emailTemplateSchema,
    testEmailSchema,
    emailCampaignQuerySchema
};