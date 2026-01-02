const jwtManager = require('./jwt');
const logger = require('../logger');

// Authentication middleware - verifies JWT token
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                error: 'Access token required',
                code: 'TOKEN_MISSING',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }

        const decoded = jwtManager.verifyAccessToken(token);
        req.user = decoded;

        logger.debug('User authenticated successfully', {
            userId: decoded.userId,
            email: decoded.email,
            correlationId: req.correlationId
        });

        next();
    } catch (error) {
        logger.warn('Authentication failed', {
            error: error.message,
            correlationId: req.correlationId
        });

        return res.status(401).json({
            error: error.message,
            code: 'TOKEN_INVALID',
            timestamp: new Date().toISOString(),
            correlationId: req.correlationId
        });
    }
};

// Optional authentication middleware - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            const decoded = jwtManager.verifyAccessToken(token);
            req.user = decoded;

            logger.debug('Optional authentication successful', {
                userId: decoded.userId,
                correlationId: req.correlationId
            });
        }

        next();
    } catch (error) {
        // For optional auth, we continue without user context
        logger.debug('Optional authentication failed, continuing without user', {
            error: error.message,
            correlationId: req.correlationId
        });
        next();
    }
};

// Role-based authorization middleware
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }

        const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.role];
        const requiredRoles = Array.isArray(roles) ? roles : [roles];

        const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

        if (!hasRequiredRole) {
            logger.warn('Authorization failed - insufficient permissions', {
                userId: req.user.userId,
                userRoles,
                requiredRoles,
                correlationId: req.correlationId
            });

            return res.status(403).json({
                error: 'Insufficient permissions',
                code: 'INSUFFICIENT_PERMISSIONS',
                required: requiredRoles,
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }

        logger.debug('Authorization successful', {
            userId: req.user.userId,
            userRoles,
            requiredRoles,
            correlationId: req.correlationId
        });

        next();
    };
};

// Admin-only middleware
const requireAdmin = requireRole(['admin']);

// Customer or admin middleware
const requireCustomerOrAdmin = requireRole(['customer', 'admin']);

// Self or admin middleware - allows users to access their own resources or admins to access any
const requireSelfOrAdmin = (userIdParam = 'userId') => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }

        const requestedUserId = req.params[userIdParam] || req.body.userId || req.query.userId;
        const currentUserId = req.user.userId;
        const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.role];

        // Allow if user is admin or accessing their own resource
        if (userRoles.includes('admin') || currentUserId.toString() === requestedUserId.toString()) {
            next();
        } else {
            logger.warn('Authorization failed - user can only access own resources', {
                userId: currentUserId,
                requestedUserId,
                correlationId: req.correlationId
            });

            return res.status(403).json({
                error: 'You can only access your own resources',
                code: 'ACCESS_DENIED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };
};

module.exports = {
    authenticateToken,
    optionalAuth,
    requireRole,
    requireAdmin,
    requireCustomerOrAdmin,
    requireSelfOrAdmin
};