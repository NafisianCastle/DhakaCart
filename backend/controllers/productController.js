const ProductService = require('../services/productService');
const CategoryService = require('../services/categoryService');
const logger = require('../logger');
const rateLimit = require('express-rate-limit');

// Rate limiting for product endpoints
const productLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many product requests, please try again later',
        code: 'RATE_LIMIT_EXCEEDED'
    }
});

const productCreateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // limit each IP to 20 product creation requests per hour
    message: {
        error: 'Too many product creation attempts, please try again later',
        code: 'RATE_LIMIT_EXCEEDED'
    }
});

class ProductController {
    constructor(dbPool, redisPool, webSocketService = null, emailService = null) {
        this.productService = new ProductService(dbPool, redisPool);
        this.categoryService = new CategoryService(dbPool, redisPool);
        this.webSocketService = webSocketService;
        this.emailService = emailService;
    }

    // Get all products with filtering, sorting, and pagination
    getProducts = async (req, res) => {
        try {
            const filters = req.validatedQuery;
            const result = await this.productService.getProducts(filters);

            logger.info('Products fetched successfully', {
                count: result.products.length,
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
            logger.error('Get products failed', {
                error: error.message,
                filters: req.validatedQuery,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to fetch products',
                code: 'PRODUCTS_FETCH_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Get single product by ID
    getProductById = async (req, res) => {
        try {
            const { id } = req.params;
            const product = await this.productService.getProductById(id);

            if (!product) {
                return res.status(404).json({
                    error: 'Product not found',
                    code: 'PRODUCT_NOT_FOUND',
                    timestamp: new Date().toISOString(),
                    correlationId: req.correlationId
                });
            }

            logger.info('Product fetched successfully', {
                productId: product.id,
                name: product.name,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                data: { product },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Get product by ID failed', {
                error: error.message,
                productId: req.params.id,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to fetch product',
                code: 'PRODUCT_FETCH_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Get single product by slug
    getProductBySlug = async (req, res) => {
        try {
            const { slug } = req.params;
            const product = await this.productService.getProductBySlug(slug);

            if (!product) {
                return res.status(404).json({
                    error: 'Product not found',
                    code: 'PRODUCT_NOT_FOUND',
                    timestamp: new Date().toISOString(),
                    correlationId: req.correlationId
                });
            }

            logger.info('Product fetched by slug successfully', {
                productId: product.id,
                slug: product.slug,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                data: { product },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Get product by slug failed', {
                error: error.message,
                slug: req.params.slug,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to fetch product',
                code: 'PRODUCT_FETCH_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Create new product (admin only)
    createProduct = async (req, res) => {
        try {
            const productData = req.validatedData;

            // Validate category exists if provided
            if (productData.categoryId) {
                const category = await this.categoryService.getCategoryById(productData.categoryId);
                if (!category) {
                    return res.status(400).json({
                        error: 'Category not found',
                        code: 'CATEGORY_NOT_FOUND',
                        timestamp: new Date().toISOString(),
                        correlationId: req.correlationId
                    });
                }
            }

            const product = await this.productService.createProduct(productData);

            logger.info('Product created successfully', {
                productId: product.id,
                name: product.name,
                createdBy: req.user.userId,
                correlationId: req.correlationId
            });

            res.status(201).json({
                success: true,
                message: 'Product created successfully',
                data: { product },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Product creation failed', {
                error: error.message,
                productData: req.validatedData,
                createdBy: req.user?.userId,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('already exists') ? 409 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: statusCode === 409 ? 'PRODUCT_EXISTS' : 'PRODUCT_CREATION_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Update product (admin only)
    updateProduct = async (req, res) => {
        try {
            const { id } = req.params;
            const updateData = req.validatedData;

            // Validate category exists if provided
            if (updateData.categoryId) {
                const category = await this.categoryService.getCategoryById(updateData.categoryId);
                if (!category) {
                    return res.status(400).json({
                        error: 'Category not found',
                        code: 'CATEGORY_NOT_FOUND',
                        timestamp: new Date().toISOString(),
                        correlationId: req.correlationId
                    });
                }
            }

            const product = await this.productService.updateProduct(id, updateData);

            logger.info('Product updated successfully', {
                productId: product.id,
                name: product.name,
                updatedBy: req.user.userId,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                message: 'Product updated successfully',
                data: { product },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Product update failed', {
                error: error.message,
                productId: req.params.id,
                updateData: req.validatedData,
                updatedBy: req.user?.userId,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('not found') ? 404 :
                error.message.includes('already exists') ? 409 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: statusCode === 404 ? 'PRODUCT_NOT_FOUND' :
                    statusCode === 409 ? 'PRODUCT_EXISTS' : 'PRODUCT_UPDATE_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Delete product (admin only)
    deleteProduct = async (req, res) => {
        try {
            const { id } = req.params;
            const product = await this.productService.deleteProduct(id);

            logger.info('Product deleted successfully', {
                productId: product.id,
                name: product.name,
                deletedBy: req.user.userId,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                message: 'Product deleted successfully',
                data: { product },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Product deletion failed', {
                error: error.message,
                productId: req.params.id,
                deletedBy: req.user?.userId,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('not found') ? 404 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: statusCode === 404 ? 'PRODUCT_NOT_FOUND' : 'PRODUCT_DELETION_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Update product stock (admin only)
    updateStock = async (req, res) => {
        try {
            const { id } = req.params;
            const { quantity, operation } = req.validatedData;

            const product = await this.productService.updateStock(id, quantity, operation);

            // Send real-time inventory update notification
            if (this.webSocketService) {
                await this.webSocketService.notifyInventoryUpdate(
                    product.id,
                    product.stock_quantity,
                    10 // Low stock threshold
                );
            }

            logger.info('Product stock updated successfully', {
                productId: product.id,
                newStock: product.stock_quantity,
                operation,
                quantity,
                updatedBy: req.user.userId,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                message: 'Product stock updated successfully',
                data: {
                    product: {
                        id: product.id,
                        name: product.name,
                        stock_quantity: product.stock_quantity
                    }
                },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Product stock update failed', {
                error: error.message,
                productId: req.params.id,
                stockData: req.validatedData,
                updatedBy: req.user?.userId,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('not found') ? 404 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: statusCode === 404 ? 'PRODUCT_NOT_FOUND' : 'STOCK_UPDATE_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Get all categories
    getCategories = async (req, res) => {
        try {
            const categories = await this.categoryService.getCategories();

            logger.info('Categories fetched successfully', {
                count: categories.length,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                data: { categories },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Get categories failed', {
                error: error.message,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to fetch categories',
                code: 'CATEGORIES_FETCH_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Get single category by ID
    getCategoryById = async (req, res) => {
        try {
            const { id } = req.params;
            const category = await this.categoryService.getCategoryById(id);

            if (!category) {
                return res.status(404).json({
                    error: 'Category not found',
                    code: 'CATEGORY_NOT_FOUND',
                    timestamp: new Date().toISOString(),
                    correlationId: req.correlationId
                });
            }

            logger.info('Category fetched successfully', {
                categoryId: category.id,
                name: category.name,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                data: { category },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Get category by ID failed', {
                error: error.message,
                categoryId: req.params.id,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to fetch category',
                code: 'CATEGORY_FETCH_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Create new category (admin only)
    createCategory = async (req, res) => {
        try {
            const categoryData = req.validatedData;
            const category = await this.categoryService.createCategory(categoryData);

            logger.info('Category created successfully', {
                categoryId: category.id,
                name: category.name,
                createdBy: req.user.userId,
                correlationId: req.correlationId
            });

            res.status(201).json({
                success: true,
                message: 'Category created successfully',
                data: { category },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Category creation failed', {
                error: error.message,
                categoryData: req.validatedData,
                createdBy: req.user?.userId,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('already exists') ? 409 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: statusCode === 409 ? 'CATEGORY_EXISTS' : 'CATEGORY_CREATION_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Update category (admin only)
    updateCategory = async (req, res) => {
        try {
            const { id } = req.params;
            const updateData = req.validatedData;

            const category = await this.categoryService.updateCategory(id, updateData);

            logger.info('Category updated successfully', {
                categoryId: category.id,
                name: category.name,
                updatedBy: req.user.userId,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                message: 'Category updated successfully',
                data: { category },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Category update failed', {
                error: error.message,
                categoryId: req.params.id,
                updateData: req.validatedData,
                updatedBy: req.user?.userId,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('not found') ? 404 :
                error.message.includes('already exists') ? 409 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: statusCode === 404 ? 'CATEGORY_NOT_FOUND' :
                    statusCode === 409 ? 'CATEGORY_EXISTS' : 'CATEGORY_UPDATE_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Delete category (admin only)
    deleteCategory = async (req, res) => {
        try {
            const { id } = req.params;
            const category = await this.categoryService.deleteCategory(id);

            logger.info('Category deleted successfully', {
                categoryId: category.id,
                name: category.name,
                deletedBy: req.user.userId,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                message: 'Category deleted successfully',
                data: { category },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Category deletion failed', {
                error: error.message,
                categoryId: req.params.id,
                deletedBy: req.user?.userId,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('not found') ? 404 :
                error.message.includes('Cannot delete') ? 400 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: statusCode === 404 ? 'CATEGORY_NOT_FOUND' :
                    statusCode === 400 ? 'CATEGORY_HAS_PRODUCTS' : 'CATEGORY_DELETION_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };
}

module.exports = { ProductController, productLimiter, productCreateLimiter };