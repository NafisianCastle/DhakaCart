const express = require('express');
const { PaymentController, paymentLimiter, webhookLimiter, authLimiter } = require('../controllers/paymentController');
const { authenticateToken, requireAdmin, requireCustomerOrAdmin } = require('../auth/middleware');
const {
    validate,
    validateWebhook,
    createPaymentIntentSchema,
    confirmPaymentSchema,
    refundPaymentSchema,
    createCustomerSchema,
    enhancedCheckoutSchema
} = require('../validation/paymentValidation');

const router = express.Router();

// Initialize controller - will be set when routes are mounted
let paymentController = null;

const initializeController = (dbPool, redisPool) => {
    paymentController = new PaymentController(dbPool, redisPool);
};

// Webhook endpoint (no authentication required, but signature verification)
router.post('/webhook',
    webhookLimiter,
    express.raw({ type: 'application/json' }), // Raw body for webhook signature verification
    validateWebhook,
    (req, res) => paymentController.handleWebhook(req, res)
);

// All other routes require authentication
router.use(authLimiter);
router.use(authenticateToken);

// Customer and admin routes
router.post('/create-payment-intent',
    paymentLimiter,
    requireCustomerOrAdmin,
    validate(createPaymentIntentSchema),
    (req, res) => paymentController.createPaymentIntent(req, res)
);

router.post('/confirm-payment',
    paymentLimiter,
    requireCustomerOrAdmin,
    validate(confirmPaymentSchema),
    (req, res) => paymentController.confirmPayment(req, res)
);

router.post('/enhanced-checkout',
    paymentLimiter,
    requireCustomerOrAdmin,
    validate(enhancedCheckoutSchema),
    (req, res) => paymentController.enhancedCheckout(req, res)
);

router.get('/status/:orderId(\\d+)',
    paymentLimiter,
    requireCustomerOrAdmin,
    (req, res) => paymentController.getPaymentStatus(req, res)
);

router.post('/create-customer',
    paymentLimiter,
    requireCustomerOrAdmin,
    validate(createCustomerSchema),
    (req, res) => paymentController.createCustomer(req, res)
);

// Admin-only routes
router.post('/refund/:orderId(\\d+)',
    paymentLimiter,
    requireAdmin,
    validate(refundPaymentSchema),
    (req, res) => paymentController.refundPayment(req, res)
);

module.exports = { router, initializeController };