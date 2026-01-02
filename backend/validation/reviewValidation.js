const Joi = require('joi');

// Validation middleware
const validate = (schema) => {
    return (req, res, next) => {
        const dataToValidate = req.method === 'GET' ? req.query : req.body;

        const { error, value } = schema.validate(dataToValidate, {
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

        if (req.method === 'GET') {
            req.validatedQuery = value;
        } else {
            req.validatedData = value;
        }

        next();
    };
};

// Create review schema
const createReviewSchema = Joi.object({
    rating: Joi.number()
        .integer()
        .min(1)
        .max(5)
        .required()
        .messages({
            'number.base': 'Rating must be a number',
            'number.integer': 'Rating must be an integer',
            'number.min': 'Rating must be at least 1',
            'number.max': 'Rating must be at most 5',
            'any.required': 'Rating is required'
        }),

    title: Joi.string()
        .max(200)
        .optional()
        .allow('')
        .messages({
            'string.max': 'Title must be less than 200 characters'
        }),

    reviewText: Joi.string()
        .max(2000)
        .optional()
        .allow('')
        .messages({
            'string.max': 'Review text must be less than 2000 characters'
        })
});

// Update review schema (same as create)
const updateReviewSchema = createReviewSchema;

// Review query schema for filtering and pagination
const reviewQuerySchema = Joi.object({
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
        .max(50)
        .optional()
        .default(10)
        .messages({
            'number.base': 'Limit must be a number',
            'number.integer': 'Limit must be an integer',
            'number.min': 'Limit must be at least 1',
            'number.max': 'Limit must be at most 50'
        }),

    rating: Joi.number()
        .integer()
        .min(1)
        .max(5)
        .optional()
        .messages({
            'number.base': 'Rating filter must be a number',
            'number.integer': 'Rating filter must be an integer',
            'number.min': 'Rating filter must be at least 1',
            'number.max': 'Rating filter must be at most 5'
        }),

    verifiedOnly: Joi.boolean()
        .optional()
        .default(false)
        .messages({
            'boolean.base': 'Verified only must be a boolean'
        }),

    sortBy: Joi.string()
        .valid('created_at', 'rating', 'helpful_count')
        .optional()
        .default('created_at')
        .messages({
            'any.only': 'Sort by must be one of: created_at, rating, helpful_count'
        }),

    sortOrder: Joi.string()
        .valid('ASC', 'DESC', 'asc', 'desc')
        .optional()
        .default('DESC')
        .messages({
            'any.only': 'Sort order must be ASC or DESC'
        })
});

// Review helpfulness schema
const reviewHelpfulnessSchema = Joi.object({
    isHelpful: Joi.boolean()
        .required()
        .messages({
            'boolean.base': 'Is helpful must be a boolean',
            'any.required': 'Is helpful is required'
        })
});

// Report review schema
const reportReviewSchema = Joi.object({
    reason: Joi.string()
        .valid('spam', 'inappropriate', 'fake', 'offensive', 'other')
        .required()
        .messages({
            'any.only': 'Reason must be one of: spam, inappropriate, fake, offensive, other',
            'any.required': 'Reason is required'
        }),

    description: Joi.string()
        .max(500)
        .optional()
        .allow('')
        .messages({
            'string.max': 'Description must be less than 500 characters'
        })
});

// User reviews query schema
const userReviewsQuerySchema = Joi.object({
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
        .max(50)
        .optional()
        .default(10)
        .messages({
            'number.base': 'Limit must be a number',
            'number.integer': 'Limit must be an integer',
            'number.min': 'Limit must be at least 1',
            'number.max': 'Limit must be at most 50'
        })
});

// Admin moderation query schema
const moderationQuerySchema = Joi.object({
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
        .default(20)
        .messages({
            'number.base': 'Limit must be a number',
            'number.integer': 'Limit must be an integer',
            'number.min': 'Limit must be at least 1',
            'number.max': 'Limit must be at most 100'
        }),

    status: Joi.string()
        .valid('all', 'pending', 'approved', 'reported')
        .optional()
        .default('all')
        .messages({
            'any.only': 'Status must be one of: all, pending, approved, reported'
        }),

    sortBy: Joi.string()
        .valid('created_at', 'rating', 'reported_count', 'helpful_count')
        .optional()
        .default('created_at')
        .messages({
            'any.only': 'Sort by must be one of: created_at, rating, reported_count, helpful_count'
        }),

    sortOrder: Joi.string()
        .valid('ASC', 'DESC', 'asc', 'desc')
        .optional()
        .default('DESC')
        .messages({
            'any.only': 'Sort order must be ASC or DESC'
        })
});

// Review moderation schema
const reviewModerationSchema = Joi.object({
    isApproved: Joi.boolean()
        .required()
        .messages({
            'boolean.base': 'Is approved must be a boolean',
            'any.required': 'Is approved is required'
        }),

    reason: Joi.string()
        .max(500)
        .optional()
        .allow('')
        .messages({
            'string.max': 'Reason must be less than 500 characters'
        })
});

// Review media schema (for future use)
const reviewMediaSchema = Joi.object({
    mediaType: Joi.string()
        .valid('image', 'video')
        .required()
        .messages({
            'any.only': 'Media type must be image or video',
            'any.required': 'Media type is required'
        }),

    mediaUrl: Joi.string()
        .uri()
        .required()
        .messages({
            'string.uri': 'Media URL must be a valid URL',
            'any.required': 'Media URL is required'
        }),

    mediaThumbnailUrl: Joi.string()
        .uri()
        .optional()
        .allow('')
        .messages({
            'string.uri': 'Media thumbnail URL must be a valid URL'
        }),

    altText: Joi.string()
        .max(200)
        .optional()
        .allow('')
        .messages({
            'string.max': 'Alt text must be less than 200 characters'
        })
});

module.exports = {
    validate,
    createReviewSchema,
    updateReviewSchema,
    reviewQuerySchema,
    reviewHelpfulnessSchema,
    reportReviewSchema,
    userReviewsQuerySchema,
    moderationQuerySchema,
    reviewModerationSchema,
    reviewMediaSchema
};