const Joi = require('joi');

// Product creation validation schema
const createProductSchema = Joi.object({
    name: Joi.string()
        .min(1)
        .max(255)
        .required()
        .messages({
            'string.min': 'Product name is required',
            'string.max': 'Product name must be less than 255 characters',
            'any.required': 'Product name is required'
        }),

    description: Joi.string()
        .max(2000)
        .optional()
        .allow('')
        .messages({
            'string.max': 'Product description must be less than 2000 characters'
        }),

    price: Joi.number()
        .positive()
        .precision(2)
        .required()
        .messages({
            'number.positive': 'Product price must be a positive number',
            'any.required': 'Product price is required'
        }),

    stockQuantity: Joi.number()
        .integer()
        .min(0)
        .optional()
        .default(0)
        .messages({
            'number.integer': 'Stock quantity must be a whole number',
            'number.min': 'Stock quantity cannot be negative'
        }),

    categoryId: Joi.number()
        .integer()
        .positive()
        .optional()
        .messages({
            'number.integer': 'Category ID must be a whole number',
            'number.positive': 'Category ID must be a positive number'
        }),

    imageUrl: Joi.string()
        .uri()
        .optional()
        .allow('')
        .messages({
            'string.uri': 'Image URL must be a valid URL'
        }),

    sku: Joi.string()
        .max(100)
        .optional()
        .allow('')
        .messages({
            'string.max': 'SKU must be less than 100 characters'
        })
});

// Product update validation schema
const updateProductSchema = Joi.object({
    name: Joi.string()
        .min(1)
        .max(255)
        .optional()
        .messages({
            'string.min': 'Product name cannot be empty',
            'string.max': 'Product name must be less than 255 characters'
        }),

    description: Joi.string()
        .max(2000)
        .optional()
        .allow('')
        .messages({
            'string.max': 'Product description must be less than 2000 characters'
        }),

    price: Joi.number()
        .positive()
        .precision(2)
        .optional()
        .messages({
            'number.positive': 'Product price must be a positive number'
        }),

    stockQuantity: Joi.number()
        .integer()
        .min(0)
        .optional()
        .messages({
            'number.integer': 'Stock quantity must be a whole number',
            'number.min': 'Stock quantity cannot be negative'
        }),

    categoryId: Joi.number()
        .integer()
        .positive()
        .optional()
        .allow(null)
        .messages({
            'number.integer': 'Category ID must be a whole number',
            'number.positive': 'Category ID must be a positive number'
        }),

    imageUrl: Joi.string()
        .uri()
        .optional()
        .allow('')
        .messages({
            'string.uri': 'Image URL must be a valid URL'
        }),

    sku: Joi.string()
        .max(100)
        .optional()
        .allow('')
        .messages({
            'string.max': 'SKU must be less than 100 characters'
        }),

    isActive: Joi.boolean()
        .optional()
        .messages({
            'boolean.base': 'isActive must be true or false'
        })
});

// Product query validation schema
const productQuerySchema = Joi.object({
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

    category: Joi.alternatives()
        .try(
            Joi.number().integer().positive(),
            Joi.string().min(1)
        )
        .optional()
        .messages({
            'alternatives.match': 'Category must be a category ID or slug'
        }),

    search: Joi.string()
        .min(1)
        .max(255)
        .optional()
        .messages({
            'string.min': 'Search term cannot be empty',
            'string.max': 'Search term must be less than 255 characters'
        }),

    minPrice: Joi.number()
        .positive()
        .precision(2)
        .optional()
        .messages({
            'number.positive': 'Minimum price must be a positive number'
        }),

    maxPrice: Joi.number()
        .positive()
        .precision(2)
        .optional()
        .messages({
            'number.positive': 'Maximum price must be a positive number'
        }),

    sortBy: Joi.string()
        .valid('name', 'price', 'created_at', 'stock_quantity')
        .optional()
        .default('created_at')
        .messages({
            'any.only': 'Sort field must be one of: name, price, created_at, stock_quantity'
        }),

    sortOrder: Joi.string()
        .valid('ASC', 'DESC', 'asc', 'desc')
        .optional()
        .default('DESC')
        .messages({
            'any.only': 'Sort order must be ASC or DESC'
        }),

    isActive: Joi.boolean()
        .optional()
        .default(true)
        .messages({
            'boolean.base': 'isActive must be true or false'
        })
}).custom((value, helpers) => {
    // Custom validation: maxPrice should be greater than minPrice
    if (value.minPrice && value.maxPrice && value.maxPrice <= value.minPrice) {
        return helpers.error('custom.priceRange');
    }
    return value;
}).messages({
    'custom.priceRange': 'Maximum price must be greater than minimum price'
});

// Stock update validation schema
const stockUpdateSchema = Joi.object({
    quantity: Joi.number()
        .integer()
        .min(0)
        .required()
        .messages({
            'number.integer': 'Quantity must be a whole number',
            'number.min': 'Quantity cannot be negative',
            'any.required': 'Quantity is required'
        }),

    operation: Joi.string()
        .valid('set', 'increment', 'decrement')
        .optional()
        .default('set')
        .messages({
            'any.only': 'Operation must be one of: set, increment, decrement'
        })
});

// Category validation schemas
const createCategorySchema = Joi.object({
    name: Joi.string()
        .min(1)
        .max(100)
        .required()
        .messages({
            'string.min': 'Category name is required',
            'string.max': 'Category name must be less than 100 characters',
            'any.required': 'Category name is required'
        }),

    description: Joi.string()
        .max(500)
        .optional()
        .allow('')
        .messages({
            'string.max': 'Category description must be less than 500 characters'
        })
});

const updateCategorySchema = Joi.object({
    name: Joi.string()
        .min(1)
        .max(100)
        .optional()
        .messages({
            'string.min': 'Category name cannot be empty',
            'string.max': 'Category name must be less than 100 characters'
        }),

    description: Joi.string()
        .max(500)
        .optional()
        .allow('')
        .messages({
            'string.max': 'Category description must be less than 500 characters'
        }),

    isActive: Joi.boolean()
        .optional()
        .messages({
            'boolean.base': 'isActive must be true or false'
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
    createProductSchema,
    updateProductSchema,
    productQuerySchema,
    stockUpdateSchema,
    createCategorySchema,
    updateCategorySchema,
    validate
};