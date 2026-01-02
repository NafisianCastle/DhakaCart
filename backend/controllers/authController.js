const UserService = require('../services/userService');
const { validate, registerSchema, loginSchema, passwordResetRequestSchema, passwordResetSchema, emailVerificationSchema, changePasswordSchema } = require('../auth/validation');
const logger = require('../logger');
const rateLimit = require('express-rate-limit');

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs for auth endpoints
    message: {
        error: 'Too many authentication attempts, please try again later',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // limit each IP to 3 password reset requests per hour
    message: {
        error: 'Too many password reset attempts, please try again later',
        code: 'RATE_LIMIT_EXCEEDED'
    }
});

class AuthController {
    constructor(dbPool, redisPool, webSocketService = null, emailService = null) {
        this.userService = new UserService(dbPool, redisPool);
        this.webSocketService = webSocketService;
        this.emailService = emailService;
    }

    // User registration
    register = async (req, res) => {
        try {
            const { email, password, firstName, lastName, phone } = req.validatedData;

            const result = await this.userService.createUser({
                email: email.toLowerCase(),
                password,
                firstName,
                lastName,
                phone
            });

            // Send welcome email
            if (this.emailService) {
                try {
                    await this.emailService.sendWelcomeEmail(result.user);
                    logger.info('Welcome email sent', {
                        userId: result.user.id,
                        email: result.user.email
                    });
                } catch (emailError) {
                    logger.error('Failed to send welcome email', {
                        userId: result.user.id,
                        email: result.user.email,
                        error: emailError.message
                    });
                    // Don't fail registration if email fails
                }
            }

            logger.info('User registration successful', {
                userId: result.user.id,
                email: result.user.email,
                correlationId: req.correlationId
            });

            res.status(201).json({
                success: true,
                message: 'User registered successfully. Please check your email for verification.',
                data: {
                    user: result.user,
                    // In production, don't send verification token in response
                    verificationToken: result.verificationToken
                },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('User registration failed', {
                error: error.message,
                email: req.validatedData?.email,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('already exists') ? 409 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: statusCode === 409 ? 'USER_EXISTS' : 'REGISTRATION_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // User login
    login = async (req, res) => {
        try {
            const { email, password } = req.validatedData;

            const result = await this.userService.authenticateUser(email.toLowerCase(), password);

            logger.info('User login successful', {
                userId: result.user.id,
                email: result.user.email,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                message: 'Login successful',
                data: {
                    user: result.user,
                    tokens: result.tokens
                },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('User login failed', {
                error: error.message,
                email: req.validatedData?.email,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('Invalid') || error.message.includes('deactivated') ? 401 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: statusCode === 401 ? 'AUTHENTICATION_FAILED' : 'LOGIN_ERROR',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Token refresh
    refreshToken = async (req, res) => {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                return res.status(400).json({
                    error: 'Refresh token is required',
                    code: 'REFRESH_TOKEN_MISSING',
                    timestamp: new Date().toISOString(),
                    correlationId: req.correlationId
                });
            }

            const tokens = await this.userService.refreshToken(refreshToken);

            logger.info('Token refresh successful', {
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                message: 'Token refreshed successfully',
                data: { tokens },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Token refresh failed', {
                error: error.message,
                correlationId: req.correlationId
            });

            res.status(401).json({
                error: error.message,
                code: 'TOKEN_REFRESH_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // User logout
    logout = async (req, res) => {
        try {
            await this.userService.logout(req.user.userId);

            logger.info('User logout successful', {
                userId: req.user.userId,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                message: 'Logout successful',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('User logout failed', {
                error: error.message,
                userId: req.user?.userId,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Logout failed',
                code: 'LOGOUT_ERROR',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Email verification
    verifyEmail = async (req, res) => {
        try {
            const { token } = req.validatedData;

            await this.userService.verifyEmail(token);

            logger.info('Email verification successful', {
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                message: 'Email verified successfully',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Email verification failed', {
                error: error.message,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('Invalid') || error.message.includes('expired') ? 400 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: 'EMAIL_VERIFICATION_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Password reset request
    requestPasswordReset = async (req, res) => {
        try {
            const { email } = req.validatedData;

            const result = await this.userService.requestPasswordReset(email.toLowerCase());

            logger.info('Password reset requested', {
                email,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                message: 'If an account with this email exists, a password reset link has been sent.',
                // In production, don't send reset token in response
                data: { resetToken: result.resetToken },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Password reset request failed', {
                error: error.message,
                email: req.validatedData?.email,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Password reset request failed',
                code: 'PASSWORD_RESET_REQUEST_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Password reset
    resetPassword = async (req, res) => {
        try {
            const { token, password } = req.validatedData;

            await this.userService.resetPassword(token, password);

            logger.info('Password reset successful', {
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                message: 'Password reset successfully',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Password reset failed', {
                error: error.message,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('Invalid') || error.message.includes('expired') ? 400 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: 'PASSWORD_RESET_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Change password (for authenticated users)
    changePassword = async (req, res) => {
        try {
            const { currentPassword, newPassword } = req.validatedData;

            await this.userService.changePassword(req.user.userId, currentPassword, newPassword);

            logger.info('Password change successful', {
                userId: req.user.userId,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                message: 'Password changed successfully',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Password change failed', {
                error: error.message,
                userId: req.user?.userId,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('incorrect') ? 400 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: 'PASSWORD_CHANGE_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Get current user profile
    getProfile = async (req, res) => {
        try {
            const user = await this.userService.findUserById(req.user.userId);

            if (!user) {
                return res.status(404).json({
                    error: 'User not found',
                    code: 'USER_NOT_FOUND',
                    timestamp: new Date().toISOString(),
                    correlationId: req.correlationId
                });
            }

            res.json({
                success: true,
                data: { user: this.userService.sanitizeUser(user) },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Get profile failed', {
                error: error.message,
                userId: req.user?.userId,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to get user profile',
                code: 'PROFILE_FETCH_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };
}

module.exports = { AuthController, authLimiter, passwordResetLimiter };