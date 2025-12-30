const express = require('express');
const { ProductController, productLimiter, productCreateLimiter } = require('../controllers/productController');
const { authenticateToken, requireAdmin, optionalAuth } = require('../auth/middleware');
const {
    validate,
    createProductSchema,
    updateProductSchema,
    productQuerySchema,
    stockUpdateSchema,
    createCategorySchema,
    updateCategorySchema
} = require('../validation/productValidation');

const router = express.Router();

// Initialize controller - will be set when routes are mounted
let productController = null;

const initializeController = (dbPool, redisPool) => {
    productController = new ProductController(dbPool, redisPool);
};

// Product routes

// Public routes (no authentication required)
router.get('/',
    productLimiter,
    validate(productQuerySchema),
    (req, res) => productController.getProducts(req, res)
);

router.get('/:id(\\d+)',
    productLimiter,
    (req, res) => productController.getProductById(req, res)
);

router.get('/slug/:slug',
    productLimiter,
    (req, res) => productController.getProductBySlug(req, res)
);

// Admin-only routes (authentication + admin role required)
router.post('/',
    productCreateLimiter,
    authenticateToken,
    requireAdmin,
    validate(createProductSchema),
    (req, res) => productController.createProduct(req, res)
);

router.put('/:id(\\d+)',
    productLimiter,
    authenticateToken,
    requireAdmin,
    validate(updateProductSchema),
    (req, res) => productController.updateProduct(req, res)
);

router.delete('/:id(\\d+)',
    productLimiter,
    authenticateToken,
    requireAdmin,
    (req, res) => productController.deleteProduct(req, res)
);

router.patch('/:id(\\d+)/stock',
    productLimiter,
    authenticateToken,
    requireAdmin,
    validate(stockUpdateSchema),
    (req, res) => productController.updateStock(req, res)
);

// Category routes

// Public routes
router.get('/categories',
    productLimiter,
    (req, res) => productController.getCategories(req, res)
);

router.get('/categories/:id(\\d+)',
    productLimiter,
    (req, res) => productController.getCategoryById(req, res)
);

// Admin-only routes
router.post('/categories',
    productCreateLimiter,
    authenticateToken,
    requireAdmin,
    validate(createCategorySchema),
    (req, res) => productController.createCategory(req, res)
);

router.put('/categories/:id(\\d+)',
    productLimiter,
    authenticateToken,
    requireAdmin,
    validate(updateCategorySchema),
    (req, res) => productController.updateCategory(req, res)
);

router.delete('/categories/:id(\\d+)',
    productLimiter,
    authenticateToken,
    requireAdmin,
    (req, res) => productController.deleteCategory(req, res)
);

module.exports = { router, initializeController };