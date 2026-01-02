const express = require('express');
const { CartController, cartLimiter, orderLimiter } = require('../controllers/cartController');
const { authenticateToken, requireCustomerOrAdmin } = require('../auth/middleware');
const {
    validate,
    addToCartSchema,
    updateCartItemSchema,
    createOrderSchema,
    orderQuerySchema,
    cancelOrderSchema
} = require('../validation/cartValidation');

const router = express.Router();

// Initialize controller - will be set when routes are mounted
let cartController = null;

const initializeController = (dbPool, redisPool, webSocketService = null, emailService = null) => {
    cartController = new CartController(dbPool, redisPool, webSocketService, emailService);
};

// Apply rate limiting before authentication/authorization
router.use(cartLimiter);
// All cart routes require authentication
router.use(authenticateToken);
router.use(requireCustomerOrAdmin);

// Cart routes
router.get('/',
    cartLimiter,
    (req, res) => cartController.getCart(req, res)
);

router.post('/items',
    cartLimiter,
    validate(addToCartSchema),
    (req, res) => cartController.addToCart(req, res)
);

router.put('/items/:cartItemId',
    cartLimiter,
    validate(updateCartItemSchema),
    (req, res) => cartController.updateCartItem(req, res)
);

router.delete('/items/:cartItemId',
    cartLimiter,
    (req, res) => cartController.removeFromCart(req, res)
);

router.delete('/',
    cartLimiter,
    (req, res) => cartController.clearCart(req, res)
);

// Order routes
router.post('/checkout',
    orderLimiter,
    validate(createOrderSchema),
    (req, res) => cartController.createOrder(req, res)
);

router.get('/orders',
    cartLimiter,
    validate(orderQuerySchema),
    (req, res) => cartController.getOrders(req, res)
);

router.get('/orders/:orderId',
    cartLimiter,
    (req, res) => cartController.getOrderById(req, res)
);

router.post('/orders/:orderId/cancel',
    cartLimiter,
    validate(cancelOrderSchema),
    (req, res) => cartController.cancelOrder(req, res)
);

module.exports = { router, initializeController };