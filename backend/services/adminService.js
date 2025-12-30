const logger = require('../logger');

class AdminService {
    constructor(dbPool, redisPool) {
        this.db = dbPool;
        this.redis = redisPool;
        this.cachePrefix = 'admin:';
        this.cacheTTL = 300; // 5 minutes
    }

    // Dashboard Analytics
    async getDashboardStats() {
        try {
            const cacheKey = `${this.cachePrefix}dashboard_stats`;

            // Try to get from cache first
            if (this.redis && this.redis.isConnected) {
                const cachedStats = await this.redis.getCachedData(cacheKey);
                if (cachedStats) {
                    logger.debug('Dashboard stats served from cache');
                    return cachedStats;
                }
            }

            // Get various statistics
            const [
                totalUsersResult,
                totalProductsResult,
                totalOrdersResult,
                totalRevenueResult,
                recentOrdersResult,
                topProductsResult,
                orderStatusResult,
                paymentStatusResult
            ] = await Promise.all([
                // Total users
                this.db.query('SELECT COUNT(*) as count FROM users WHERE is_active = true'),

                // Total products
                this.db.query('SELECT COUNT(*) as count FROM products WHERE is_active = true'),

                // Total orders
                this.db.query('SELECT COUNT(*) as count FROM orders'),

                // Total revenue
                this.db.query('SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE payment_status = \'paid\''),

                // Recent orders (last 30 days)
                this.db.query(`
                    SELECT COUNT(*) as count 
                    FROM orders 
                    WHERE created_at >= NOW() - INTERVAL '30 days'
                `),

                // Top selling products
                this.db.query(`
                    SELECT 
                        p.id,
                        p.name,
                        p.price,
                        COALESCE(SUM(oi.quantity), 0) as total_sold,
                        COALESCE(SUM(oi.total_price), 0) as total_revenue
                    FROM products p
                    LEFT JOIN order_items oi ON p.id = oi.product_id
                    LEFT JOIN orders o ON oi.order_id = o.id AND o.payment_status = 'paid'
                    WHERE p.is_active = true
                    GROUP BY p.id, p.name, p.price
                    ORDER BY total_sold DESC
                    LIMIT 10
                `),

                // Order status distribution
                this.db.query(`
                    SELECT 
                        status,
                        COUNT(*) as count
                    FROM orders
                    GROUP BY status
                    ORDER BY count DESC
                `),

                // Payment status distribution
                this.db.query(`
                    SELECT 
                        payment_status,
                        COUNT(*) as count,
                        COALESCE(SUM(total_amount), 0) as total_amount
                    FROM orders
                    GROUP BY payment_status
                    ORDER BY count DESC
                `)
            ]);

            const stats = {
                overview: {
                    totalUsers: parseInt(totalUsersResult.rows[0].count),
                    totalProducts: parseInt(totalProductsResult.rows[0].count),
                    totalOrders: parseInt(totalOrdersResult.rows[0].count),
                    totalRevenue: parseFloat(totalRevenueResult.rows[0].total),
                    recentOrders: parseInt(recentOrdersResult.rows[0].count)
                },
                topProducts: topProductsResult.rows.map(product => ({
                    ...product,
                    total_sold: parseInt(product.total_sold),
                    total_revenue: parseFloat(product.total_revenue),
                    price: parseFloat(product.price)
                })),
                orderStatus: orderStatusResult.rows.map(status => ({
                    status: status.status,
                    count: parseInt(status.count)
                })),
                paymentStatus: paymentStatusResult.rows.map(status => ({
                    status: status.payment_status,
                    count: parseInt(status.count),
                    totalAmount: parseFloat(status.total_amount)
                }))
            };

            // Cache the result
            if (this.redis && this.redis.isConnected) {
                await this.redis.setCachedData(cacheKey, stats, this.cacheTTL);
            }

            logger.info('Dashboard stats fetched successfully', {
                totalUsers: stats.overview.totalUsers,
                totalOrders: stats.overview.totalOrders,
                totalRevenue: stats.overview.totalRevenue
            });

            return stats;
        } catch (error) {
            logger.error('Error fetching dashboard stats', { error: error.message });
            throw error;
        }
    }

    async getSalesAnalytics(period = '30d') {
        try {
            const cacheKey = `${this.cachePrefix}sales_analytics:${period}`;

            // Try to get from cache first
            if (this.redis && this.redis.isConnected) {
                const cachedAnalytics = await this.redis.getCachedData(cacheKey);
                if (cachedAnalytics) {
                    logger.debug('Sales analytics served from cache', { period });
                    return cachedAnalytics;
                }
            }

            let dateFilter;
            let groupBy;

            switch (period) {
                case '7d':
                    dateFilter = "created_at >= NOW() - INTERVAL '7 days'";
                    groupBy = "DATE(created_at)";
                    break;
                case '30d':
                    dateFilter = "created_at >= NOW() - INTERVAL '30 days'";
                    groupBy = "DATE(created_at)";
                    break;
                case '90d':
                    dateFilter = "created_at >= NOW() - INTERVAL '90 days'";
                    groupBy = "DATE_TRUNC('week', created_at)";
                    break;
                case '1y':
                    dateFilter = "created_at >= NOW() - INTERVAL '1 year'";
                    groupBy = "DATE_TRUNC('month', created_at)";
                    break;
                default:
                    dateFilter = "created_at >= NOW() - INTERVAL '30 days'";
                    groupBy = "DATE(created_at)";
            }

            const salesResult = await this.db.query(`
                SELECT 
                    ${groupBy} as date,
                    COUNT(*) as order_count,
                    COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) as revenue,
                    COALESCE(AVG(CASE WHEN payment_status = 'paid' THEN total_amount ELSE NULL END), 0) as avg_order_value
                FROM orders
                WHERE ${dateFilter}
                GROUP BY ${groupBy}
                ORDER BY date ASC
            `);

            const analytics = {
                period,
                data: salesResult.rows.map(row => ({
                    date: row.date,
                    orderCount: parseInt(row.order_count),
                    revenue: parseFloat(row.revenue),
                    avgOrderValue: parseFloat(row.avg_order_value)
                }))
            };

            // Cache the result
            if (this.redis && this.redis.isConnected) {
                await this.redis.setCachedData(cacheKey, analytics, this.cacheTTL);
            }

            logger.info('Sales analytics fetched successfully', {
                period,
                dataPoints: analytics.data.length
            });

            return analytics;
        } catch (error) {
            logger.error('Error fetching sales analytics', { error: error.message, period });
            throw error;
        }
    }

    // User Management
    async getAllUsers(filters = {}) {
        const { page = 1, limit = 20, search, role, isActive } = filters;

        try {
            const offset = (page - 1) * limit;

            let query = `
                SELECT 
                    id,
                    email,
                    first_name,
                    last_name,
                    phone,
                    role,
                    is_active,
                    email_verified,
                    created_at,
                    updated_at
                FROM users
                WHERE 1=1
            `;
            let params = [];
            let paramCount = 0;

            if (search) {
                paramCount++;
                query += ` AND (
                    email ILIKE $${paramCount} OR 
                    first_name ILIKE $${paramCount} OR 
                    last_name ILIKE $${paramCount}
                )`;
                params.push(`%${search}%`);
            }

            if (role) {
                paramCount++;
                query += ` AND role = $${paramCount}`;
                params.push(role);
            }

            if (isActive !== undefined) {
                paramCount++;
                query += ` AND is_active = $${paramCount}`;
                params.push(isActive);
            }

            query += `
                ORDER BY created_at DESC
                LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
            `;
            params.push(limit, offset);

            const result = await this.db.query(query, params);

            // Get total count
            let countQuery = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
            let countParams = [];
            let countParamCount = 0;

            if (search) {
                countParamCount++;
                countQuery += ` AND (
                    email ILIKE $${countParamCount} OR 
                    first_name ILIKE $${countParamCount} OR 
                    last_name ILIKE $${countParamCount}
                )`;
                countParams.push(`%${search}%`);
            }

            if (role) {
                countParamCount++;
                countQuery += ` AND role = $${countParamCount}`;
                countParams.push(role);
            }

            if (isActive !== undefined) {
                countParamCount++;
                countQuery += ` AND is_active = $${countParamCount}`;
                countParams.push(isActive);
            }

            const countResult = await this.db.query(countQuery, countParams);
            const total = parseInt(countResult.rows[0].total);

            logger.info('Users fetched successfully', {
                count: result.rows.length,
                total,
                filters
            });

            return {
                users: result.rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasNext: page * limit < total,
                    hasPrev: page > 1
                }
            };
        } catch (error) {
            logger.error('Error fetching users', { error: error.message, filters });
            throw error;
        }
    }

    async updateUserStatus(userId, isActive, updatedBy) {
        try {
            const result = await this.db.query(`
                UPDATE users 
                SET is_active = $2, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING id, email, first_name, last_name, is_active
            `, [userId, isActive]);

            if (result.rows.length === 0) {
                throw new Error('User not found');
            }

            const user = result.rows[0];

            logger.info('User status updated successfully', {
                userId,
                email: user.email,
                newStatus: isActive,
                updatedBy
            });

            return user;
        } catch (error) {
            logger.error('Error updating user status', { error: error.message, userId, isActive, updatedBy });
            throw error;
        }
    }

    async updateUserRole(userId, role, updatedBy) {
        try {
            const validRoles = ['customer', 'admin'];

            if (!validRoles.includes(role)) {
                throw new Error('Invalid role');
            }

            const result = await this.db.query(`
                UPDATE users 
                SET role = $2, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING id, email, first_name, last_name, role
            `, [userId, role]);

            if (result.rows.length === 0) {
                throw new Error('User not found');
            }

            const user = result.rows[0];

            logger.info('User role updated successfully', {
                userId,
                email: user.email,
                newRole: role,
                updatedBy
            });

            return user;
        } catch (error) {
            logger.error('Error updating user role', { error: error.message, userId, role, updatedBy });
            throw error;
        }
    }

    // Order Management (Admin view)
    async getAllOrdersAdmin(filters = {}) {
        const { page = 1, limit = 20, status, paymentStatus, userId, search } = filters;

        try {
            const offset = (page - 1) * limit;

            let query = `
                SELECT 
                    o.*,
                    u.email as user_email,
                    u.first_name as user_first_name,
                    u.last_name as user_last_name,
                    COUNT(oi.id) as item_count
                FROM orders o
                LEFT JOIN users u ON o.user_id = u.id
                LEFT JOIN order_items oi ON o.id = oi.order_id
                WHERE 1=1
            `;
            let params = [];
            let paramCount = 0;

            if (status) {
                paramCount++;
                query += ` AND o.status = $${paramCount}`;
                params.push(status);
            }

            if (paymentStatus) {
                paramCount++;
                query += ` AND o.payment_status = $${paramCount}`;
                params.push(paymentStatus);
            }

            if (userId) {
                paramCount++;
                query += ` AND o.user_id = $${paramCount}`;
                params.push(userId);
            }

            if (search) {
                paramCount++;
                query += ` AND (
                    o.order_number ILIKE $${paramCount} OR
                    u.email ILIKE $${paramCount} OR
                    u.first_name ILIKE $${paramCount} OR
                    u.last_name ILIKE $${paramCount}
                )`;
                params.push(`%${search}%`);
            }

            query += `
                GROUP BY o.id, u.id
                ORDER BY o.created_at DESC
                LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
            `;
            params.push(limit, offset);

            const result = await this.db.query(query, params);

            // Get total count
            let countQuery = 'SELECT COUNT(*) as total FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE 1=1';
            let countParams = [];
            let countParamCount = 0;

            if (status) {
                countParamCount++;
                countQuery += ` AND o.status = $${countParamCount}`;
                countParams.push(status);
            }

            if (paymentStatus) {
                countParamCount++;
                countQuery += ` AND o.payment_status = $${countParamCount}`;
                countParams.push(paymentStatus);
            }

            if (userId) {
                countParamCount++;
                countQuery += ` AND o.user_id = $${countParamCount}`;
                countParams.push(userId);
            }

            if (search) {
                countParamCount++;
                countQuery += ` AND (
                    o.order_number ILIKE $${countParamCount} OR
                    u.email ILIKE $${countParamCount} OR
                    u.first_name ILIKE $${countParamCount} OR
                    u.last_name ILIKE $${countParamCount}
                )`;
                countParams.push(`%${search}%`);
            }

            const countResult = await this.db.query(countQuery, countParams);
            const total = parseInt(countResult.rows[0].total);

            const orders = result.rows.map(order => ({
                ...order,
                shipping_address: JSON.parse(order.shipping_address || '{}'),
                billing_address: JSON.parse(order.billing_address || '{}'),
                item_count: parseInt(order.item_count)
            }));

            logger.info('Admin orders fetched successfully', {
                count: orders.length,
                total,
                filters
            });

            return {
                orders,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasNext: page * limit < total,
                    hasPrev: page > 1
                }
            };
        } catch (error) {
            logger.error('Error fetching admin orders', { error: error.message, filters });
            throw error;
        }
    }

    async getOrderDetailsAdmin(orderId) {
        try {
            // Get order details
            const orderResult = await this.db.query(`
                SELECT 
                    o.*,
                    u.email as user_email,
                    u.first_name as user_first_name,
                    u.last_name as user_last_name,
                    u.phone as user_phone
                FROM orders o
                LEFT JOIN users u ON o.user_id = u.id
                WHERE o.id = $1
            `, [orderId]);

            if (orderResult.rows.length === 0) {
                throw new Error('Order not found');
            }

            const order = orderResult.rows[0];

            // Get order items
            const itemsResult = await this.db.query(`
                SELECT 
                    oi.*,
                    p.name as product_name,
                    p.image_url as product_image,
                    p.slug as product_slug,
                    p.sku as product_sku
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                WHERE oi.order_id = $1
                ORDER BY oi.id ASC
            `, [orderId]);

            const orderWithItems = {
                ...order,
                shipping_address: JSON.parse(order.shipping_address || '{}'),
                billing_address: JSON.parse(order.billing_address || '{}'),
                items: itemsResult.rows
            };

            logger.info('Admin order details fetched successfully', {
                orderId,
                orderNumber: order.order_number,
                userEmail: order.user_email
            });

            return orderWithItems;
        } catch (error) {
            logger.error('Error fetching admin order details', { error: error.message, orderId });
            throw error;
        }
    }

    // System Configuration
    async getSystemConfig() {
        try {
            // This could be expanded to include various system settings
            // For now, we'll return some basic configuration information
            const config = {
                version: process.env.APP_VERSION || '1.0.0',
                environment: process.env.NODE_ENV || 'development',
                database: {
                    connected: true, // This could be checked dynamically
                    host: process.env.DB_HOST,
                    name: process.env.DB_NAME
                },
                redis: {
                    connected: this.redis && this.redis.isConnected,
                    host: process.env.REDIS_HOST
                },
                features: {
                    stripeEnabled: !!process.env.STRIPE_SECRET_KEY,
                    emailEnabled: !!process.env.EMAIL_SERVICE_ENABLED,
                    cacheEnabled: this.redis && this.redis.isConnected
                }
            };

            logger.info('System config retrieved successfully');

            return config;
        } catch (error) {
            logger.error('Error getting system config', { error: error.message });
            throw error;
        }
    }

    async clearCache(pattern = null) {
        try {
            if (!this.redis || !this.redis.isConnected) {
                throw new Error('Redis not available');
            }

            let keysDeleted = 0;

            if (pattern) {
                const keys = await this.redis.client.keys(pattern);
                if (keys.length > 0) {
                    keysDeleted = await this.redis.client.del(keys);
                }
            } else {
                // Clear all cache
                await this.redis.client.flushall();
                keysDeleted = 'all';
            }

            logger.info('Cache cleared successfully', {
                pattern,
                keysDeleted
            });

            return { keysDeleted, pattern };
        } catch (error) {
            logger.error('Error clearing cache', { error: error.message, pattern });
            throw error;
        }
    }
}

module.exports = AdminService;