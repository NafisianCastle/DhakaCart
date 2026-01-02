const PaymentService = require('../services/paymentService');
const OrderService = require('../services/orderService');
const CartService = require('../services/cartService');
const logger = require('../logger');
const rateLimit = require('express-rate-limit');

// Rate limiting for payment endpoints
const paymentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // limit each IP to 20 payment requests per windowMs
    message: {
        error: 'Too many payment requests, please try again later',
        code: 'RATE_LIMIT_EXCEEDED'
    }
});

const webhookLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // Allow more webhook requests
    message: {
        error: 'Too many webhook requests',
        code: 'RATE_LIMIT_EXCEEDED'
    }
});

class PaymentController {
    constructor(dbPool, redisPool, webSocketService = null, emailService = null) {
        this.paymentService = new PaymentService(dbPool, redisPool);
        this.orderService = new OrderService(dbPool, redisPool);
        this.cartService = new CartService(dbPool, redisPool);
        this.webSocketService = webSocketService;
        this.emailService = emailService;
    }

    // Create payment intent for an order
    createPaymentIntent = async (req, res) => {
        try {
            const { orderId, currency, metadata } = req.validatedData;
            const userId = req.user.userId;

            // Verify order belongs to user
            const order = await this.orderService.getOrderById(userId, orderId);

            if (!order) {
                return res.status(404).json({
                    error: 'Order not found',
                    code: 'ORDER_NOT_FOUND',
                    timestamp: new Date().toISOString(),
                    correlationId: req.correlationId
                });
            }

            const paymentIntent = await this.paymentService.createPaymentIntent(
                orderId,
                order.total_amount,
                currency,
                metadata
            );

            logger.info('Payment intent created successfully', {
                userId,
                orderId,
                paymentIntentId: paymentIntent.paymentIntentId,
                amount: order.total_amount,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                data: { paymentIntent },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Create payment intent failed', {
                error: error.message,
                userId: req.user?.userId,
                orderData: req.validatedData,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('not found') ? 404 :
                error.message.includes('already paid') ? 400 :
                    error.message.includes('cancelled') ? 400 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: statusCode === 404 ? 'ORDER_NOT_FOUND' :
                    statusCode === 400 ? 'INVALID_REQUEST' : 'PAYMENT_INTENT_CREATION_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Confirm payment
    confirmPayment = async (req, res) => {
        try {
            const { paymentIntentId, paymentMethodId } = req.validatedData;

            const paymentIntent = await this.paymentService.confirmPayment(paymentIntentId, paymentMethodId);

            logger.info('Payment confirmed successfully', {
                paymentIntentId,
                status: paymentIntent.status,
                userId: req.user.userId,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                data: {
                    paymentIntent: {
                        id: paymentIntent.id,
                        status: paymentIntent.status,
                        amount: paymentIntent.amount,
                        currency: paymentIntent.currency
                    }
                },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Confirm payment failed', {
                error: error.message,
                paymentData: req.validatedData,
                userId: req.user?.userId,
                correlationId: req.correlationId
            });

            res.status(400).json({
                error: error.message,
                code: 'PAYMENT_CONFIRMATION_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Enhanced checkout (creates order and payment intent in one step)
    enhancedCheckout = async (req, res) => {
        try {
            const userId = req.user.userId;
            const { paymentMethod, paymentMethodId, currency, ...orderData } = req.validatedData;

            // Validate cart before creating order
            await this.cartService.validateCartForCheckout(userId);

            // Create order
            const order = await this.orderService.createOrder(userId, {
                ...orderData,
                paymentMethod
            });

            let paymentIntent = null;

            // Create payment intent for card payments
            if (paymentMethod === 'stripe_card') {
                if (!paymentMethodId) {
                    return res.status(400).json({
                        error: 'Payment method ID is required for card payments',
                        code: 'PAYMENT_METHOD_REQUIRED',
                        timestamp: new Date().toISOString(),
                        correlationId: req.correlationId
                    });
                }

                paymentIntent = await this.paymentService.createPaymentIntent(
                    order.id,
                    order.total_amount,
                    currency,
                    { userId: userId.toString() }
                );
            }

            logger.info('Enhanced checkout completed successfully', {
                userId,
                orderId: order.id,
                orderNumber: order.order_number,
                paymentMethod,
                totalAmount: order.total_amount,
                paymentIntentId: paymentIntent?.paymentIntentId,
                correlationId: req.correlationId
            });

            res.status(201).json({
                success: true,
                message: 'Checkout completed successfully',
                data: {
                    order,
                    paymentIntent
                },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Enhanced checkout failed', {
                error: error.message,
                userId: req.user?.userId,
                checkoutData: req.validatedData,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('Cart is empty') ? 400 :
                error.message.includes('not available') ? 400 :
                    error.message.includes('Insufficient stock') ? 400 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: statusCode === 400 ? 'INVALID_REQUEST' : 'CHECKOUT_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Get payment status for an order
    getPaymentStatus = async (req, res) => {
        try {
            const { orderId } = req.params;
            const userId = req.user.userId;

            // Verify order belongs to user (for non-admin users)
            if (req.user.role !== 'admin') {
                const order = await this.orderService.getOrderById(userId, orderId);
                if (!order) {
                    return res.status(404).json({
                        error: 'Order not found',
                        code: 'ORDER_NOT_FOUND',
                        timestamp: new Date().toISOString(),
                        correlationId: req.correlationId
                    });
                }
            }

            const paymentStatus = await this.paymentService.getPaymentStatus(orderId);

            logger.info('Payment status retrieved successfully', {
                userId,
                orderId,
                paymentStatus: paymentStatus.paymentStatus,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                data: { paymentStatus },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Get payment status failed', {
                error: error.message,
                userId: req.user?.userId,
                orderId: req.params.orderId,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('not found') ? 404 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: statusCode === 404 ? 'ORDER_NOT_FOUND' : 'PAYMENT_STATUS_FETCH_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Process refund (admin only)
    refundPayment = async (req, res) => {
        try {
            const { orderId } = req.params;
            const { amount, reason } = req.validatedData;

            const refund = await this.paymentService.refundPayment(orderId, amount, reason);

            logger.info('Refund processed successfully', {
                orderId,
                refundId: refund.refundId,
                amount: refund.amount,
                isFullRefund: refund.isFullRefund,
                processedBy: req.user.userId,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                message: 'Refund processed successfully',
                data: { refund },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Refund processing failed', {
                error: error.message,
                orderId: req.params.orderId,
                refundData: req.validatedData,
                processedBy: req.user?.userId,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('not found') ? 404 :
                error.message.includes('not in paid status') ? 400 :
                    error.message.includes('No payment intent') ? 400 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: statusCode === 404 ? 'ORDER_NOT_FOUND' :
                    statusCode === 400 ? 'INVALID_REQUEST' : 'REFUND_PROCESSING_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Handle Stripe webhooks
    handleWebhook = async (req, res) => {
        try {
            const payload = req.body;
            const signature = req.stripeSignature;

            const result = await this.paymentService.handleWebhook(payload, signature);

            logger.info('Webhook processed successfully', {
                signature: signature.substring(0, 20) + '...',
                correlationId: req.correlationId
            });

            res.json(result);
        } catch (error) {
            logger.error('Webhook processing failed', {
                error: error.message,
                signature: req.stripeSignature?.substring(0, 20) + '...',
                correlationId: req.correlationId
            });

            res.status(400).json({
                error: 'Webhook processing failed',
                code: 'WEBHOOK_PROCESSING_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Create Stripe customer (for saved payment methods)
    createCustomer = async (req, res) => {
        try {
            const { email, name, metadata } = req.validatedData;
            const userId = req.user.userId;

            const customer = await this.paymentService.createCustomer(email, name, {
                userId: userId.toString(),
                ...metadata
            });

            logger.info('Stripe customer created successfully', {
                userId,
                customerId: customer.id,
                email,
                correlationId: req.correlationId
            });

            res.status(201).json({
                success: true,
                message: 'Customer created successfully',
                data: {
                    customer: {
                        id: customer.id,
                        email: customer.email,
                        name: customer.name
                    }
                },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Create customer failed', {
                error: error.message,
                userId: req.user?.userId,
                customerData: req.validatedData,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to create customer',
                code: 'CUSTOMER_CREATION_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };
}

module.exports = { PaymentController, paymentLimiter, webhookLimiter };