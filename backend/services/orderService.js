const logger = require('../logger');

class OrderService {
    constructor(dbPool, redisPool) {
        this.db = dbPool;
        this.redis = redisPool;
        this.cachePrefix = 'order:';
        this.cacheTTL = 3600; // 1 hour
    }

    async createOrder(userId, orderData) {
        const { shippingAddress, billingAddress, paymentMethod, notes } = orderData;

        try {
            // Start transaction
            return await this.db.transaction(async (client) => {
                // Get cart items
                const cartResult = await client.query(`
                    SELECT 
                        ci.product_id,
                        ci.quantity,
                        p.name as product_name,
                        p.price as product_price,
                        p.stock_quantity as product_stock,
                        p.is_active as product_active
                    FROM cart_items ci
                    JOIN products p ON ci.product_id = p.id
                    WHERE ci.user_id = $1 AND p.is_active = true
                `, [userId]);

                if (cartResult.rows.length === 0) {
                    throw new Error('Cart is empty');
                }

                const cartItems = cartResult.rows;

                // Validate stock and calculate total
                let totalAmount = 0;
                const orderItems = [];

                for (const item of cartItems) {
                    if (!item.product_active) {
                        throw new Error(`Product "${item.product_name}" is no longer available`);
                    }

                    if (item.product_stock < item.quantity) {
                        throw new Error(`Insufficient stock for "${item.product_name}". Available: ${item.product_stock}, Requested: ${item.quantity}`);
                    }

                    const itemTotal = item.quantity * parseFloat(item.product_price);
                    totalAmount += itemTotal;

                    orderItems.push({
                        productId: item.product_id,
                        quantity: item.quantity,
                        unitPrice: parseFloat(item.product_price),
                        totalPrice: itemTotal
                    });
                }

                // Create order
                const orderResult = await client.query(`
                    INSERT INTO orders (
                        user_id, 
                        total_amount, 
                        status, 
                        shipping_address, 
                        billing_address, 
                        payment_method, 
                        payment_status,
                        notes
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    RETURNING *
                `, [
                    userId,
                    totalAmount,
                    'pending',
                    JSON.stringify(shippingAddress),
                    JSON.stringify(billingAddress || shippingAddress),
                    paymentMethod,
                    'pending',
                    notes
                ]);

                const order = orderResult.rows[0];

                // Create order items and update stock
                for (const item of orderItems) {
                    // Insert order item
                    await client.query(`
                        INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
                        VALUES ($1, $2, $3, $4, $5)
                    `, [order.id, item.productId, item.quantity, item.unitPrice, item.totalPrice]);

                    // Update product stock
                    await client.query(`
                        UPDATE products 
                        SET stock_quantity = stock_quantity - $2, updated_at = CURRENT_TIMESTAMP
                        WHERE id = $1
                    `, [item.productId, item.quantity]);
                }

                // Clear cart
                await client.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);

                logger.info('Order created successfully', {
                    orderId: order.id,
                    orderNumber: order.order_number,
                    userId,
                    totalAmount,
                    itemCount: orderItems.length
                });

                return order;
            });
        } catch (error) {
            logger.error('Error creating order', { error: error.message, userId, orderData });
            throw error;
        }
    }

    async getOrders(userId, filters = {}) {
        const { page = 1, limit = 10, status } = filters;

        try {
            const offset = (page - 1) * limit;

            let query = `
                SELECT 
                    o.*,
                    COUNT(oi.id) as item_count
                FROM orders o
                LEFT JOIN order_items oi ON o.id = oi.order_id
                WHERE o.user_id = $1
            `;
            let params = [userId];
            let paramCount = 1;

            if (status) {
                paramCount++;
                query += ` AND o.status = $${paramCount}`;
                params.push(status);
            }

            query += `
                GROUP BY o.id
                ORDER BY o.created_at DESC
                LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
            `;
            params.push(limit, offset);

            const result = await this.db.query(query, params);

            // Get total count
            let countQuery = 'SELECT COUNT(*) as total FROM orders WHERE user_id = $1';
            let countParams = [userId];

            if (status) {
                countQuery += ' AND status = $2';
                countParams.push(status);
            }

            const countResult = await this.db.query(countQuery, countParams);
            const total = parseInt(countResult.rows[0].total);

            const orders = result.rows.map(order => ({
                ...order,
                shipping_address: JSON.parse(order.shipping_address || '{}'),
                billing_address: JSON.parse(order.billing_address || '{}')
            }));

            logger.info('Orders fetched successfully', {
                userId,
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
            logger.error('Error fetching orders', { error: error.message, userId, filters });
            throw error;
        }
    }

    async getOrderById(userId, orderId) {
        try {
            const cacheKey = `${this.cachePrefix}${orderId}:${userId}`;

            // Try to get from cache first
            if (this.redis && this.redis.isConnected) {
                const cachedOrder = await this.redis.getCachedData(cacheKey);
                if (cachedOrder) {
                    logger.debug('Order served from cache', { orderId, userId });
                    return cachedOrder;
                }
            }

            // Get order details
            const orderResult = await this.db.query(`
                SELECT * FROM orders 
                WHERE id = $1 AND user_id = $2
            `, [orderId, userId]);

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
                    p.slug as product_slug
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

            // Cache the result
            if (this.redis && this.redis.isConnected) {
                await this.redis.setCachedData(cacheKey, orderWithItems, this.cacheTTL);
            }

            logger.info('Order fetched successfully', {
                orderId,
                userId,
                orderNumber: order.order_number
            });

            return orderWithItems;
        } catch (error) {
            logger.error('Error fetching order', { error: error.message, orderId, userId });
            throw error;
        }
    }

    async updateOrderStatus(orderId, status, updatedBy) {
        try {
            const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

            if (!validStatuses.includes(status)) {
                throw new Error('Invalid order status');
            }

            const result = await this.db.query(`
                UPDATE orders 
                SET status = $2, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *
            `, [orderId, status]);

            if (result.rows.length === 0) {
                throw new Error('Order not found');
            }

            const order = result.rows[0];

            // Clear order cache
            await this.clearOrderCache(orderId);

            logger.info('Order status updated successfully', {
                orderId,
                orderNumber: order.order_number,
                newStatus: status,
                updatedBy
            });

            return order;
        } catch (error) {
            logger.error('Error updating order status', { error: error.message, orderId, status, updatedBy });
            throw error;
        }
    }

    async updatePaymentStatus(orderId, paymentStatus, updatedBy) {
        try {
            const validPaymentStatuses = ['pending', 'paid', 'failed', 'refunded'];

            if (!validPaymentStatuses.includes(paymentStatus)) {
                throw new Error('Invalid payment status');
            }

            const result = await this.db.query(`
                UPDATE orders 
                SET payment_status = $2, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *
            `, [orderId, paymentStatus]);

            if (result.rows.length === 0) {
                throw new Error('Order not found');
            }

            const order = result.rows[0];

            // Clear order cache
            await this.clearOrderCache(orderId);

            logger.info('Payment status updated successfully', {
                orderId,
                orderNumber: order.order_number,
                newPaymentStatus: paymentStatus,
                updatedBy
            });

            return order;
        } catch (error) {
            logger.error('Error updating payment status', { error: error.message, orderId, paymentStatus, updatedBy });
            throw error;
        }
    }

    async cancelOrder(userId, orderId, reason) {
        try {
            return await this.db.transaction(async (client) => {
                // Get order details
                const orderResult = await client.query(`
                    SELECT * FROM orders 
                    WHERE id = $1 AND user_id = $2
                `, [orderId, userId]);

                if (orderResult.rows.length === 0) {
                    throw new Error('Order not found');
                }

                const order = orderResult.rows[0];

                // Check if order can be cancelled
                if (['shipped', 'delivered', 'cancelled'].includes(order.status)) {
                    throw new Error('Order cannot be cancelled');
                }

                // Get order items to restore stock
                const itemsResult = await client.query(`
                    SELECT product_id, quantity FROM order_items 
                    WHERE order_id = $1
                `, [orderId]);

                // Restore stock for each item
                for (const item of itemsResult.rows) {
                    await client.query(`
                        UPDATE products 
                        SET stock_quantity = stock_quantity + $2, updated_at = CURRENT_TIMESTAMP
                        WHERE id = $1
                    `, [item.product_id, item.quantity]);
                }

                // Update order status
                const updatedOrderResult = await client.query(`
                    UPDATE orders 
                    SET status = 'cancelled', 
                        notes = COALESCE(notes, '') || $2,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                    RETURNING *
                `, [orderId, `\nCancellation reason: ${reason}`]);

                const updatedOrder = updatedOrderResult.rows[0];

                // Clear order cache
                await this.clearOrderCache(orderId);

                logger.info('Order cancelled successfully', {
                    orderId,
                    orderNumber: order.order_number,
                    userId,
                    reason
                });

                return updatedOrder;
            });
        } catch (error) {
            logger.error('Error cancelling order', { error: error.message, orderId, userId, reason });
            throw error;
        }
    }

    // Admin methods
    async getAllOrders(filters = {}) {
        const { page = 1, limit = 20, status, paymentStatus, userId } = filters;

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

            query += `
                GROUP BY o.id, u.id
                ORDER BY o.created_at DESC
                LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
            `;
            params.push(limit, offset);

            const result = await this.db.query(query, params);

            // Get total count
            let countQuery = 'SELECT COUNT(*) as total FROM orders o WHERE 1=1';
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

            const countResult = await this.db.query(countQuery, countParams);
            const total = parseInt(countResult.rows[0].total);

            const orders = result.rows.map(order => ({
                ...order,
                shipping_address: JSON.parse(order.shipping_address || '{}'),
                billing_address: JSON.parse(order.billing_address || '{}')
            }));

            logger.info('All orders fetched successfully', {
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
            logger.error('Error fetching all orders', { error: error.message, filters });
            throw error;
        }
    }

    async clearOrderCache(orderId) {
        if (this.redis && this.redis.isConnected) {
            // Clear specific order cache (we don't know the userId, so we can't clear the specific cache)
            // In a production system, you might want to implement a more sophisticated cache invalidation strategy
            const keys = await this.redis.client.keys(`${this.cachePrefix}${orderId}:*`);
            if (keys.length > 0) {
                await this.redis.client.del(keys);
            }
        }
    }
}

module.exports = OrderService;