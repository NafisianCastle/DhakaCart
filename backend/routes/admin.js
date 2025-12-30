const express = require('express');
const { AdminController, adminLimiter } = require('../controllers/adminController');
const { authenticateToken, requireAdmin } = require('../auth/middleware');
const {
    validate,
    userQuerySchema,
    updateUserStatusSchema,
    updateUserRoleSchema,
    adminOrderQuerySchema,
    updateOrderStatusSchema,
    updatePaymentStatusSchema,
    salesAnalyticsQuerySchema,
    cacheQuerySchema
} = require('../validation/adminValidation');

const router = express.Router();

// Initialize controller - will be set when routes are mounted
let adminController = null;

const initializeController = (dbPool, redisPool) => {
    adminController = new AdminController(dbPool, redisPool);
};

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);
router.use(adminLimiter);

// Dashboard and Analytics
router.get('/dashboard/stats',
    (req, res) => adminController.getDashboardStats(req, res)
);

router.get('/analytics/sales',
    validate(salesAnalyticsQuerySchema),
    (req, res) => adminController.getSalesAnalytics(req, res)
);

// User Management
router.get('/users',
    validate(userQuerySchema),
    (req, res) => adminController.getAllUsers(req, res)
);

router.patch('/users/:userId(\\d+)/status',
    validate(updateUserStatusSchema),
    (req, res) => adminController.updateUserStatus(req, res)
);

router.patch('/users/:userId(\\d+)/role',
    validate(updateUserRoleSchema),
    (req, res) => adminController.updateUserRole(req, res)
);

// Order Management
router.get('/orders',
    validate(adminOrderQuerySchema),
    (req, res) => adminController.getAllOrders(req, res)
);

router.get('/orders/:orderId(\\d+)',
    (req, res) => adminController.getOrderDetails(req, res)
);

router.patch('/orders/:orderId(\\d+)/status',
    validate(updateOrderStatusSchema),
    (req, res) => adminController.updateOrderStatus(req, res)
);

router.patch('/orders/:orderId(\\d+)/payment-status',
    validate(updatePaymentStatusSchema),
    (req, res) => adminController.updatePaymentStatus(req, res)
);

// System Management
router.get('/system/config',
    (req, res) => adminController.getSystemConfig(req, res)
);

router.post('/system/cache/clear',
    validate(cacheQuerySchema),
    (req, res) => adminController.clearCache(req, res)
);

module.exports = { router, initializeController };