const Stripe = require('stripe');
const logger = require('../logger');

class PaymentService {
    constructor(dbPool, redisPool) {
        this.db = dbPool;
        this.redis = redisPool;
        this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy_key');
        this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    }

    async createPaymentIntent(orderId, amount, currency = 'usd', metadata = {}) {
        try {
            // Validate order exists and belongs to user
            const orderResult = await this.db.query(
                'SELECT id, user_id, total_amount, status, payment_status FROM orders WHERE id = $1',
                [orderId]
            );

            if (orderResult.rows.length === 0) {
                throw new Error('Order not found');
            }

            const order = orderResult.rows[0];

            if (order.payment_status === 'paid') {
                throw new Error('Order is already paid');
            }

            if (order.status === 'cancelled') {
                throw new Error('Cannot process payment for cancelled order');
            }

            // Create Stripe payment intent
            const paymentIntent = await this.stripe.paymentIntents.create({
                amount: Math.round(amount * 100), // Convert to cents
                currency: currency.toLowerCase(),
                metadata: {
                    orderId: orderId.toString(),
                    userId: order.user_id.toString(),
                    ...metadata
                },
                automatic_payment_methods: {
                    enabled: true,
                },
            });

            // Store payment intent ID in database
            await this.db.query(`
                UPDATE orders 
                SET payment_intent_id = $2, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [orderId, paymentIntent.id]);

            logger.info('Payment intent created successfully', {
                orderId,
                paymentIntentId: paymentIntent.id,
                amount,
                currency
            });

            return {
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id,
                amount: paymentIntent.amount,
                currency: paymentIntent.currency
            };
        } catch (error) {
            logger.error('Error creating payment intent', {
                error: error.message,
                orderId,
                amount,
                currency
            });
            throw error;
        }
    }

    async confirmPayment(paymentIntentId, paymentMethodId) {
        try {
            const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId, {
                payment_method: paymentMethodId,
            });

            logger.info('Payment confirmed successfully', {
                paymentIntentId,
                status: paymentIntent.status
            });

            return paymentIntent;
        } catch (error) {
            logger.error('Error confirming payment', {
                error: error.message,
                paymentIntentId,
                paymentMethodId
            });
            throw error;
        }
    }

    async handleWebhook(payload, signature) {
        try {
            let event;

            if (this.webhookSecret) {
                // Verify webhook signature
                event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
            } else {
                // For development/testing without webhook secret
                event = JSON.parse(payload);
            }

            logger.info('Webhook received', {
                eventType: event.type,
                eventId: event.id
            });

            switch (event.type) {
                case 'payment_intent.succeeded':
                    await this.handlePaymentSuccess(event.data.object);
                    break;
                case 'payment_intent.payment_failed':
                    await this.handlePaymentFailure(event.data.object);
                    break;
                case 'payment_intent.canceled':
                    await this.handlePaymentCancellation(event.data.object);
                    break;
                default:
                    logger.info('Unhandled webhook event type', { eventType: event.type });
            }

            return { received: true };
        } catch (error) {
            logger.error('Webhook handling failed', { error: error.message });
            throw error;
        }
    }

    async handlePaymentSuccess(paymentIntent) {
        try {
            const orderId = paymentIntent.metadata.orderId;

            if (!orderId) {
                throw new Error('Order ID not found in payment intent metadata');
            }

            // Update order payment status
            const result = await this.db.query(`
                UPDATE orders 
                SET payment_status = 'paid', 
                    status = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *
            `, [orderId]);

            if (result.rows.length === 0) {
                throw new Error('Order not found');
            }

            const order = result.rows[0];

            logger.info('Payment success handled', {
                orderId,
                paymentIntentId: paymentIntent.id,
                orderNumber: order.order_number
            });

            // Here you could trigger additional actions like:
            // - Send confirmation email
            // - Update inventory
            // - Notify fulfillment system

            return order;
        } catch (error) {
            logger.error('Error handling payment success', {
                error: error.message,
                paymentIntentId: paymentIntent.id
            });
            throw error;
        }
    }

    async handlePaymentFailure(paymentIntent) {
        try {
            const orderId = paymentIntent.metadata.orderId;

            if (!orderId) {
                throw new Error('Order ID not found in payment intent metadata');
            }

            // Update order payment status
            const result = await this.db.query(`
                UPDATE orders 
                SET payment_status = 'failed', 
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *
            `, [orderId]);

            if (result.rows.length === 0) {
                throw new Error('Order not found');
            }

            const order = result.rows[0];

            logger.info('Payment failure handled', {
                orderId,
                paymentIntentId: paymentIntent.id,
                orderNumber: order.order_number,
                failureReason: paymentIntent.last_payment_error?.message
            });

            // Here you could trigger additional actions like:
            // - Send payment failure notification
            // - Restore inventory if needed
            // - Retry payment logic

            return order;
        } catch (error) {
            logger.error('Error handling payment failure', {
                error: error.message,
                paymentIntentId: paymentIntent.id
            });
            throw error;
        }
    }

    async handlePaymentCancellation(paymentIntent) {
        try {
            const orderId = paymentIntent.metadata.orderId;

            if (!orderId) {
                throw new Error('Order ID not found in payment intent metadata');
            }

            // Update order payment status
            const result = await this.db.query(`
                UPDATE orders 
                SET payment_status = 'failed', 
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *
            `, [orderId]);

            if (result.rows.length === 0) {
                throw new Error('Order not found');
            }

            const order = result.rows[0];

            logger.info('Payment cancellation handled', {
                orderId,
                paymentIntentId: paymentIntent.id,
                orderNumber: order.order_number
            });

            return order;
        } catch (error) {
            logger.error('Error handling payment cancellation', {
                error: error.message,
                paymentIntentId: paymentIntent.id
            });
            throw error;
        }
    }

    async getPaymentStatus(orderId) {
        try {
            const result = await this.db.query(`
                SELECT 
                    id, 
                    payment_status, 
                    payment_intent_id, 
                    total_amount,
                    status
                FROM orders 
                WHERE id = $1
            `, [orderId]);

            if (result.rows.length === 0) {
                throw new Error('Order not found');
            }

            const order = result.rows[0];

            // If we have a payment intent ID, get the latest status from Stripe
            if (order.payment_intent_id) {
                try {
                    const paymentIntent = await this.stripe.paymentIntents.retrieve(order.payment_intent_id);

                    return {
                        orderId: order.id,
                        paymentStatus: order.payment_status,
                        orderStatus: order.status,
                        totalAmount: order.total_amount,
                        stripeStatus: paymentIntent.status,
                        paymentIntentId: order.payment_intent_id
                    };
                } catch (stripeError) {
                    logger.warn('Failed to retrieve payment intent from Stripe', {
                        orderId,
                        paymentIntentId: order.payment_intent_id,
                        error: stripeError.message
                    });
                }
            }

            return {
                orderId: order.id,
                paymentStatus: order.payment_status,
                orderStatus: order.status,
                totalAmount: order.total_amount,
                paymentIntentId: order.payment_intent_id
            };
        } catch (error) {
            logger.error('Error getting payment status', { error: error.message, orderId });
            throw error;
        }
    }

    async refundPayment(orderId, amount = null, reason = 'requested_by_customer') {
        try {
            // Get order details
            const orderResult = await this.db.query(`
                SELECT 
                    id, 
                    payment_intent_id, 
                    payment_status, 
                    total_amount,
                    status
                FROM orders 
                WHERE id = $1
            `, [orderId]);

            if (orderResult.rows.length === 0) {
                throw new Error('Order not found');
            }

            const order = orderResult.rows[0];

            if (order.payment_status !== 'paid') {
                throw new Error('Order payment is not in paid status');
            }

            if (!order.payment_intent_id) {
                throw new Error('No payment intent found for this order');
            }

            // Create refund in Stripe
            const refundAmount = amount ? Math.round(amount * 100) : Math.round(order.total_amount * 100);

            const refund = await this.stripe.refunds.create({
                payment_intent: order.payment_intent_id,
                amount: refundAmount,
                reason: reason,
                metadata: {
                    orderId: orderId.toString()
                }
            });

            // Update order payment status
            const isFullRefund = refundAmount >= Math.round(order.total_amount * 100);
            const newPaymentStatus = isFullRefund ? 'refunded' : 'paid'; // Partial refunds keep 'paid' status

            await this.db.query(`
                UPDATE orders 
                SET payment_status = $2, 
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [orderId, newPaymentStatus]);

            logger.info('Refund processed successfully', {
                orderId,
                refundId: refund.id,
                refundAmount: refundAmount / 100,
                isFullRefund
            });

            return {
                refundId: refund.id,
                amount: refundAmount / 100,
                currency: refund.currency,
                status: refund.status,
                isFullRefund
            };
        } catch (error) {
            logger.error('Error processing refund', { error: error.message, orderId, amount, reason });
            throw error;
        }
    }

    async createCustomer(userEmail, userName, metadata = {}) {
        try {
            const customer = await this.stripe.customers.create({
                email: userEmail,
                name: userName,
                metadata: metadata
            });

            logger.info('Stripe customer created', {
                customerId: customer.id,
                email: userEmail
            });

            return customer;
        } catch (error) {
            logger.error('Error creating Stripe customer', { error: error.message, userEmail });
            throw error;
        }
    }

    async getPaymentMethods(customerId) {
        try {
            const paymentMethods = await this.stripe.paymentMethods.list({
                customer: customerId,
                type: 'card',
            });

            return paymentMethods.data;
        } catch (error) {
            logger.error('Error retrieving payment methods', { error: error.message, customerId });
            throw error;
        }
    }
}

module.exports = PaymentService;