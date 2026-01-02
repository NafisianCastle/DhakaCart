const AdminService = require('../services/adminService');
const OrderService = require('../services/orderService');
const logger = require('../logger');
const rateLimit = require('express-rate-limit');

// Rate limiting for admin endpoints
const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Higher limit for admin operations
    message: {
        error: 'Too many admin requests, please try again later',
        code: 'RATE_LIMIT_EXCEEDED'
    }
});

class AdminController {
    constructor(dbPool, redisPool, webSocketService = null, emailService = null) {
        this.adminService = new AdminService(dbPool, redisPool);
        this.orderService = new OrderService(dbPool, redisPool);
        this.webSocketService = webSocketService;
        this.emailService = emailService;
    }

    // Dashboard Analytics
    getDashboardStats = async (req, res) => {
        try {
            const stats = await this.adminService.getDashboardStats();

            logger.info('Dashboard stats retrieved successfully', {
                adminId: req.user.userId,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                data: { stats },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Get dashboard stats failed', {
                error: error.message,
                adminId: req.user?.userId,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to fetch dashboard statistics',
                code: 'DASHBOARD_STATS_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    getSalesAnalytics = async (req, res) => {
        try {
            const { period = '30d' } = req.query;
            const analytics = await this.adminService.getSalesAnalytics(period);

            logger.info('Sales analytics retrieved successfully', {
                period,
                adminId: req.user.userId,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                data: { analytics },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Get sales analytics failed', {
                error: error.message,
                period: req.query.period,
                adminId: req.user?.userId,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to fetch sales analytics',
                code: 'SALES_ANALYTICS_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // User Management
    getAllUsers = async (req, res) => {
        try {
            const filters = req.validatedQuery;
            const result = await this.adminService.getAllUsers(filters);

            logger.info('Users fetched successfully', {
                count: result.users.length,
                total: result.pagination.total,
                filters,
                adminId: req.user.userId,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                data: result,
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Get users failed', {
                error: error.message,
                filters: req.validatedQuery,
                adminId: req.user?.userId,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to fetch users',
                code: 'USERS_FETCH_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    updateUserStatus = async (req, res) => {
        try {
            const { userId } = req.params;
            const { isActive } = req.validatedData;

            const user = await this.adminService.updateUserStatus(userId, isActive, req.user.userId);

            logger.info('User status updated successfully', {
                targetUserId: userId,
                newStatus: isActive,
                adminId: req.user.userId,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
                data: { user },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Update user status failed', {
                error: error.message,
                targetUserId: req.params.userId,
                statusData: req.validatedData,
                adminId: req.user?.userId,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('not found') ? 404 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: statusCode === 404 ? 'USER_NOT_FOUND' : 'USER_STATUS_UPDATE_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    updateUserRole = async (req, res) => {
        try {
            const { userId } = req.params;
            const { role } = req.validatedData;

            const user = await this.adminService.updateUserRole(userId, role, req.user.userId);

            logger.info('User role updated successfully', {
                targetUserId: userId,
                newRole: role,
                adminId: req.user.userId,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                message: 'User role updated successfully',
                data: { user },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Update user role failed', {
                error: error.message,
                targetUserId: req.params.userId,
                roleData: req.validatedData,
                adminId: req.user?.userId,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('not found') ? 404 :
                error.message.includes('Invalid role') ? 400 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: statusCode === 404 ? 'USER_NOT_FOUND' :
                    statusCode === 400 ? 'INVALID_ROLE' : 'USER_ROLE_UPDATE_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Order Management
    getAllOrders = async (req, res) => {
        try {
            const filters = req.validatedQuery;
            const result = await this.adminService.getAllOrdersAdmin(filters);

            logger.info('Admin orders fetched successfully', {
                count: result.orders.length,
                total: result.pagination.total,
                filters,
                adminId: req.user.userId,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                data: result,
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Get admin orders failed', {
                error: error.message,
                filters: req.validatedQuery,
                adminId: req.user?.userId,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to fetch orders',
                code: 'ORDERS_FETCH_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    getOrderDetails = async (req, res) => {
        try {
            const { orderId } = req.params;
            const order = await this.adminService.getOrderDetailsAdmin(orderId);

            logger.info('Admin order details fetched successfully', {
                orderId,
                orderNumber: order.order_number,
                adminId: req.user.userId,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                data: { order },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Get admin order details failed', {
                error: error.message,
                orderId: req.params.orderId,
                adminId: req.user?.userId,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('not found') ? 404 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: statusCode === 404 ? 'ORDER_NOT_FOUND' : 'ORDER_DETAILS_FETCH_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    updateOrderStatus = async (req, res) => {
        try {
            const { orderId } = req.params;
            const { status } = req.validatedData;

            const order = await this.orderService.updateOrderStatus(orderId, status, req.user.userId);

            // Send order status update email
            if (this.emailService && order.user_id) {
                try {
                    // Get user details for email
                    const userResult = await this.adminService.getUserById(order.user_id);
                    if (userResult) {
                        await this.emailService.sendOrderStatusEmail(userResult, order);
                        logger.info('Order status email sent', {
                            orderId,
                            userId: order.user_id,
                            status,
                            email: userResult.email
                        });
                    }
                } catch (emailError) {
                    logger.error('Failed to send order status email', {
                        orderId,
                        userId: order.user_id,
                        error: emailError.message
                    });
                    // Don't fail status update if email fails
                }
            }

            // Send real-time order status update to customer
            if (this.webSocketService && order.user_id) {
                await this.webSocketService.notifyOrderUpdate(order.user_id, order);
            }

            logger.info('Order status updated successfully', {
                orderId,
                orderNumber: order.order_number,
                newStatus: status,
                adminId: req.user.userId,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                message: 'Order status updated successfully',
                data: { order },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Update order status failed', {
                error: error.message,
                orderId: req.params.orderId,
                statusData: req.validatedData,
                adminId: req.user?.userId,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('not found') ? 404 :
                error.message.includes('Invalid') ? 400 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: statusCode === 404 ? 'ORDER_NOT_FOUND' :
                    statusCode === 400 ? 'INVALID_STATUS' : 'ORDER_STATUS_UPDATE_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    updatePaymentStatus = async (req, res) => {
        try {
            const { orderId } = req.params;
            const { paymentStatus } = req.validatedData;

            const order = await this.orderService.updatePaymentStatus(orderId, paymentStatus, req.user.userId);

            logger.info('Payment status updated successfully', {
                orderId,
                orderNumber: order.order_number,
                newPaymentStatus: paymentStatus,
                adminId: req.user.userId,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                message: 'Payment status updated successfully',
                data: { order },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Update payment status failed', {
                error: error.message,
                orderId: req.params.orderId,
                paymentData: req.validatedData,
                adminId: req.user?.userId,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('not found') ? 404 :
                error.message.includes('Invalid') ? 400 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: statusCode === 404 ? 'ORDER_NOT_FOUND' :
                    statusCode === 400 ? 'INVALID_PAYMENT_STATUS' : 'PAYMENT_STATUS_UPDATE_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // System Management
    getSystemConfig = async (req, res) => {
        try {
            const config = await this.adminService.getSystemConfig();

            logger.info('System config retrieved successfully', {
                adminId: req.user.userId,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                data: { config },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Get system config failed', {
                error: error.message,
                adminId: req.user?.userId,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to fetch system configuration',
                code: 'SYSTEM_CONFIG_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    clearCache = async (req, res) => {
        try {
            const { pattern } = req.query;
            const result = await this.adminService.clearCache(pattern);

            logger.info('Cache cleared successfully', {
                pattern,
                keysDeleted: result.keysDeleted,
                adminId: req.user.userId,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                message: 'Cache cleared successfully',
                data: result,
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Clear cache failed', {
                error: error.message,
                pattern: req.query.pattern,
                adminId: req.user?.userId,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: error.message,
                code: 'CACHE_CLEAR_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };
}

module.exports = { AdminController, adminLimiter };