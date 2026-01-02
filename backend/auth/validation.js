const Joi = require('joi');

// User registration validation schema
const registerSchema = Joi.object({
    email: Joi.string()
        .email({ minDomainSegments: 2, tlds: { allow: ['com', 'net', 'org', 'edu', 'gov', 'bd', 'co'] } })
        .required()
        .messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required'
        }),

    password: Joi.string()
        .min(8)
        .max(128)
        .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-=\\[\\]{};\':"\\\\|,.<>\\/?])'))
        .required()
        .messages({
            'string.min': 'Password must be at least 8 characters long',
            'string.max': 'Password must be less than 128 characters',
            'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
            'any.required': 'Password is required'
        }),

    confirmPassword: Joi.string()
        .valid(Joi.ref('password'))
        .required()
        .messages({
            'any.only': 'Passwords do not match',
            'any.required': 'Password confirmation is required'
        }),

    firstName: Joi.string()
        .min(1)
        .max(50)
        .pattern(/^[a-zA-Z\s]+$/)
        .required()
        .messages({
            'string.min': 'First name is required',
            'string.max': 'First name must be less than 50 characters',
            'string.pattern.base': 'First name can only contain letters and spaces',
            'any.required': 'First name is required'
        }),

    lastName: Joi.string()
        .min(1)
        .max(50)
        .pattern(/^[a-zA-Z\s]+$/)
        .required()
        .messages({
            'string.min': 'Last name is required',
            'string.max': 'Last name must be less than 50 characters',
            'string.pattern.base': 'Last name can only contain letters and spaces',
            'any.required': 'Last name is required'
        }),

    phone: Joi.string()
        .pattern(/^(\+88)?01[3-9]\d{8}$/)
        .optional()
        .messages({
            'string.pattern.base': 'Please provide a valid Bangladeshi phone number (e.g., 01712345678 or +8801712345678)'
        })
});

// User login validation schema
const loginSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required'
        }),

    password: Joi.string()
        .required()
        .messages({
            'any.required': 'Password is required'
        })
});

// Password reset request validation schema
const passwordResetRequestSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required'
        })
});

// Password reset validation schema
const passwordResetSchema = Joi.object({
    token: Joi.string()
        .required()
        .messages({
            'any.required': 'Reset token is required'
        }),

    password: Joi.string()
        .min(8)
        .max(128)
        .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-=\\[\\]{};\':"\\\\|,.<>\\/?])'))
        .required()
        .messages({
            'string.min': 'Password must be at least 8 characters long',
            'string.max': 'Password must be less than 128 characters',
            'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
            'any.required': 'Password is required'
        }),

    confirmPassword: Joi.string()
        .valid(Joi.ref('password'))
        .required()
        .messages({
            'any.only': 'Passwords do not match',
            'any.required': 'Password confirmation is required'
        })
});

// Email verification validation schema
const emailVerificationSchema = Joi.object({
    token: Joi.string()
        .required()
        .messages({
            'any.required': 'Verification token is required'
        })
});

// Profile update validation schema
const profileUpdateSchema = Joi.object({
    firstName: Joi.string()
        .min(1)
        .max(50)
        .pattern(/^[a-zA-Z\s]+$/)
        .optional()
        .messages({
            'string.min': 'First name cannot be empty',
            'string.max': 'First name must be less than 50 characters',
            'string.pattern.base': 'First name can only contain letters and spaces'
        }),

    lastName: Joi.string()
        .min(1)
        .max(50)
        .pattern(/^[a-zA-Z\s]+$/)
        .optional()
        .messages({
            'string.min': 'Last name cannot be empty',
            'string.max': 'Last name must be less than 50 characters',
            'string.pattern.base': 'Last name can only contain letters and spaces'
        }),

    phone: Joi.string()
        .pattern(/^(\+88)?01[3-9]\d{8}$/)
        .optional()
        .allow('')
        .messages({
            'string.pattern.base': 'Please provide a valid Bangladeshi phone number (e.g., 01712345678 or +8801712345678)'
        })
});

// Change password validation schema
const changePasswordSchema = Joi.object({
    currentPassword: Joi.string()
        .required()
        .messages({
            'any.required': 'Current password is required'
        }),

    newPassword: Joi.string()
        .min(8)
        .max(128)
        .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-=\\[\\]{};\':"\\\\|,.<>\\/?])'))
        .required()
        .messages({
            'string.min': 'New password must be at least 8 characters long',
            'string.max': 'New password must be less than 128 characters',
            'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
            'any.required': 'New password is required'
        }),

    confirmNewPassword: Joi.string()
        .valid(Joi.ref('newPassword'))
        .required()
        .messages({
            'any.only': 'New passwords do not match',
            'any.required': 'New password confirmation is required'
        })
});

// Validation middleware factory
const validate = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true
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

        req.validatedData = value;
        next();
    };
};

module.exports = {
    registerSchema,
    loginSchema,
    passwordResetRequestSchema,
    passwordResetSchema,
    emailVerificationSchema,
    profileUpdateSchema,
    changePasswordSchema,
    validate
};