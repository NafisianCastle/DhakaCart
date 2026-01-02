const express = require('express');
const { AuthController, authLimiter, passwordResetLimiter } = require('../controllers/authController');
const { authenticateToken } = require('../auth/middleware');
const {
    validate,
    registerSchema,
    loginSchema,
    passwordResetRequestSchema,
    passwordResetSchema,
    emailVerificationSchema,
    changePasswordSchema
} = require('../auth/validation');

const router = express.Router();

// Initialize controller - will be set when routes are mounted
let authController = null;

const initializeController = (dbPool, redisPool, webSocketService = null, emailService = null) => {
    authController = new AuthController(dbPool, redisPool, webSocketService, emailService);
};

// Public routes (no authentication required)
router.post('/register',
    authLimiter,
    validate(registerSchema),
    (req, res) => authController.register(req, res)
);

router.post('/login',
    authLimiter,
    validate(loginSchema),
    (req, res) => authController.login(req, res)
);

router.post('/refresh-token',
    authLimiter,
    (req, res) => authController.refreshToken(req, res)
);

router.post('/verify-email',
    validate(emailVerificationSchema),
    (req, res) => authController.verifyEmail(req, res)
);

router.post('/request-password-reset',
    passwordResetLimiter,
    validate(passwordResetRequestSchema),
    (req, res) => authController.requestPasswordReset(req, res)
);

router.post('/reset-password',
    authLimiter,
    validate(passwordResetSchema),
    (req, res) => authController.resetPassword(req, res)
);

// Protected routes (authentication required)
router.post('/logout',
    authenticateToken,
    (req, res) => authController.logout(req, res)
);

router.get('/profile',
    authenticateToken,
    (req, res) => authController.getProfile(req, res)
);

router.post('/change-password',
    authenticateToken,
    validate(changePasswordSchema),
    (req, res) => authController.changePassword(req, res)
);

module.exports = { router, initializeController };