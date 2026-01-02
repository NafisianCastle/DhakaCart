const CartService = require('../services/cartService');
const OrderService = require('../services/orderService');
const logger = require('../logger');
const rateLimit = require('express-rate-limit');

// Rate limiting for cart endpoints
const cartLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many cart requests, please try again later',
        code: 'RATE_LIMIT_EXCEEDED'
    }
});

const orderLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // limit each IP to 10 order creation requests per hour
    message: {
        error: 'Too many order creation attempts, please try again later',
        code: 'RATE_LIMIT_EXCEEDED'
    }
});

class CartController {
    constructor(dbPool, redisPool, webSocketService = null, emailService = null) {
        this.cartService = new CartService(dbPool, redisPool);
        this.orderService = new OrderService(dbPool, redisPool);
        this.webSocketService = webSocketService;
        this.emailService = emailService;
    }

    // Get user's cart
    getCart = async (req, res) => {
        try {
            const userId = req.user.userId;
            const cart = await this.cartService.getCart(userId);

            logger.info('Cart fetched successfully', {
                userId,
                itemCount: cart.items.length,
                totalAmount: cart.summary.totalAmount,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                data: { cart },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Get cart failed', {
                error: error.message,
                userId: req.user?.userId,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to fetch cart',
                code: 'CART_FETCH_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Add item to cart
    addToCart = async (req, res) => {
        try {
            const userId = req.user.userId;
            const { productId, quantity } = req.validatedData;

            const cartItem = await this.cartService.addToCart(userId, productId, quantity);

            logger.info('Item added to cart successfully', {
                userId,
                productId,
                quantity,
                cartItemId: cartItem.id,
                correlationId: req.correlationId
            });

            res.status(201).json({
                success: true,
                message: 'Item added to cart successfully',
                data: { cartItem },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Add to cart failed', {
                error: error.message,
                userId: req.user?.userId,
                productData: req.validatedData,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('not found') ? 404 :
                error.message.includes('not available') ? 400 :
                    error.message.includes('Insufficient stock') ? 400 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: statusCode === 404 ? 'PRODUCT_NOT_FOUND' :
                    statusCode === 400 ? 'INVALID_REQUEST' : 'ADD_TO_CART_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Update cart item quantity
    updateCartItem = async (req, res) => {
        try {
            const userId = req.user.userId;
            const { cartItemId } = req.params;
            const { quantity } = req.validatedData;

            const cartItem = await this.cartService.updateCartItem(userId, cartItemId, quantity);

            logger.info('Cart item updated successfully', {
                userId,
                cartItemId,
                newQuantity: quantity,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                message: quantity > 0 ? 'Cart item updated successfully' : 'Cart item removed successfully',
                data: { cartItem },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Update cart item failed', {
                error: error.message,
                userId: req.user?.userId,
                cartItemId: req.params.cartItemId,
                quantity: req.validatedData?.quantity,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('not found') ? 404 :
                error.message.includes('Insufficient stock') ? 400 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: statusCode === 404 ? 'CART_ITEM_NOT_FOUND' :
                    statusCode === 400 ? 'INVALID_REQUEST' : 'UPDATE_CART_ITEM_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Remove item from cart
    removeFromCart = async (req, res) => {
        try {
            const userId = req.user.userId;
            const { cartItemId } = req.params;

            const removedItem = await this.cartService.removeFromCart(userId, cartItemId);

            logger.info('Item removed from cart successfully', {
                userId,
                cartItemId,
                productId: removedItem.product_id,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                message: 'Item removed from cart successfully',
                data: { removedItem },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Remove from cart failed', {
                error: error.message,
                userId: req.user?.userId,
                cartItemId: req.params.cartItemId,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('not found') ? 404 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: statusCode === 404 ? 'CART_ITEM_NOT_FOUND' : 'REMOVE_FROM_CART_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Clear entire cart
    clearCart = async (req, res) => {
        try {
            const userId = req.user.userId;
            const removedItems = await this.cartService.clearCart(userId);

            logger.info('Cart cleared successfully', {
                userId,
                itemsRemoved: removedItems.length,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                message: 'Cart cleared successfully',
                data: { itemsRemoved: removedItems.length },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Clear cart failed', {
                error: error.message,
                userId: req.user?.userId,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to clear cart',
                code: 'CLEAR_CART_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Create order from cart
    createOrder = async (req, res) => {
        try {
            const userId = req.user.userId;
            const orderData = req.validatedData;

            // Validate cart before creating order
            await this.cartService.validateCartForCheckout(userId);

            const order = await this.orderService.createOrder(userId, orderData);

            // Send order confirmation email
            if (this.emailService) {
                try {
                    await this.emailService.sendOrderConfirmationEmail(req.user, order);
                    logger.info('Order confirmation email sent', {
                        userId,
                        orderId: order.id,
                        email: req.user.email
                    });
                } catch (emailError) {
                    logger.error('Failed to send order confirmation email', {
                        userId,
                        orderId: order.id,
                        error: emailError.message
                    });
                    // Don't fail order creation if email fails
                }
            }

            // Send real-time order notification
            if (this.webSocketService) {
                await this.webSocketService.notifyOrderUpdate(userId, {
                    ...order,
                    user_email: req.user.email
                });
            }

            logger.info('Order created successfully', {
                userId,
                orderId: order.id,
                orderNumber: order.order_number,
                totalAmount: order.total_amount,
                correlationId: req.correlationId
            });

            res.status(201).json({
                success: true,
                message: 'Order created successfully',
                data: { order },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Order creation failed', {
                error: error.message,
                userId: req.user?.userId,
                orderData: req.validatedData,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('Cart is empty') ? 400 :
                error.message.includes('not available') ? 400 :
                    error.message.includes('Insufficient stock') ? 400 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: statusCode === 400 ? 'INVALID_REQUEST' : 'ORDER_CREATION_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Get user's orders
    getOrders = async (req, res) => {
        try {
            const userId = req.user.userId;
            const filters = req.validatedQuery;

            const result = await this.orderService.getOrders(userId, filters);

            logger.info('Orders fetched successfully', {
                userId,
                count: result.orders.length,
                total: result.pagination.total,
                filters,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                data: result,
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Get orders failed', {
                error: error.message,
                userId: req.user?.userId,
                filters: req.validatedQuery,
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

    // Get single order
    getOrderById = async (req, res) => {
        try {
            const userId = req.user.userId;
            const { orderId } = req.params;

            const order = await this.orderService.getOrderById(userId, orderId);

            logger.info('Order fetched successfully', {
                userId,
                orderId,
                orderNumber: order.order_number,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                data: { order },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Get order failed', {
                error: error.message,
                userId: req.user?.userId,
                orderId: req.params.orderId,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('not found') ? 404 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: statusCode === 404 ? 'ORDER_NOT_FOUND' : 'ORDER_FETCH_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Cancel order
    cancelOrder = async (req, res) => {
        try {
            const userId = req.user.userId;
            const { orderId } = req.params;
            const { reason } = req.validatedData;

            const order = await this.orderService.cancelOrder(userId, orderId, reason);

            // Send real-time order status update
            if (this.webSocketService) {
                await this.webSocketService.notifyOrderUpdate(userId, {
                    ...order,
                    user_email: req.user.email
                });
            }

            logger.info('Order cancelled successfully', {
                userId,
                orderId,
                orderNumber: order.order_number,
                reason,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                message: 'Order cancelled successfully',
                data: { order },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Order cancellation failed', {
                error: error.message,
                userId: req.user?.userId,
                orderId: req.params.orderId,
                reason: req.validatedData?.reason,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('not found') ? 404 :
                error.message.includes('cannot be cancelled') ? 400 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: statusCode === 404 ? 'ORDER_NOT_FOUND' :
                    statusCode === 400 ? 'INVALID_REQUEST' : 'ORDER_CANCELLATION_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };
}

module.exports = { CartController, cartLimiter, orderLimiter };