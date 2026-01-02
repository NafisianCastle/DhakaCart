const logger = require('../logger');

class ProductService {
    constructor(dbPool, redisPool, searchService = null) {
        this.db = dbPool;
        this.redis = redisPool;
        this.searchService = searchService;
        this.cachePrefix = 'product:';
        this.cacheTTL = 300; // 5 minutes
    }

    async createProduct(productData) {
        const { name, description, price, stockQuantity, categoryId, imageUrl, sku } = productData;

        try {
            // Generate slug from name
            const slug = this.generateSlug(name);

            // Check if slug already exists
            const existingProduct = await this.findProductBySlug(slug);
            if (existingProduct) {
                throw new Error('Product with similar name already exists');
            }

            // Check if SKU already exists (if provided)
            if (sku) {
                const existingBySku = await this.findProductBySku(sku);
                if (existingBySku) {
                    throw new Error('Product with this SKU already exists');
                }
            }

            const result = await this.db.query(`
                INSERT INTO products (name, description, price, stock_quantity, category_id, image_url, slug, sku)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `, [name, description, price, stockQuantity || 0, categoryId, imageUrl, slug, sku]);

            const product = result.rows[0];

            // Clear products cache
            await this.clearProductsCache();

            // Index product in Elasticsearch
            if (this.searchService) {
                await this.searchService.indexProduct(product.id);
            }

            logger.info('Product created successfully', {
                productId: product.id,
                name: product.name,
                slug: product.slug
            });

            return product;
        } catch (error) {
            logger.error('Error creating product', { error: error.message, productData });
            throw error;
        }
    }

    async getProducts(filters = {}) {
        const {
            page = 1,
            limit = 20,
            category,
            search,
            minPrice,
            maxPrice,
            sortBy = 'created_at',
            sortOrder = 'DESC',
            isActive = true
        } = filters;

        try {
            const offset = (page - 1) * limit;
            const cacheKey = `products:list:${JSON.stringify(filters)}`;

            // Try to get from cache first
            if (this.redis && this.redis.isConnected) {
                const cachedResult = await this.redis.getCachedData(cacheKey);
                if (cachedResult) {
                    logger.debug('Products served from cache', { filters });
                    return cachedResult;
                }
            }

            // Build dynamic query
            let query = `
                SELECT p.*, c.name as category_name, c.slug as category_slug
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.is_active = $1
            `;
            let params = [isActive];
            let paramCount = 1;

            // Add filters
            if (category) {
                paramCount++;
                query += ` AND (c.slug = $${paramCount} OR c.id = $${paramCount})`;
                params.push(category);
            }

            if (search) {
                paramCount++;
                query += ` AND (
                    p.name ILIKE $${paramCount} OR 
                    p.description ILIKE $${paramCount} OR
                    to_tsvector('english', p.name || ' ' || COALESCE(p.description, '')) @@ plainto_tsquery('english', $${paramCount})
                )`;
                params.push(`%${search}%`);
            }

            if (minPrice) {
                paramCount++;
                query += ` AND p.price >= $${paramCount}`;
                params.push(minPrice);
            }

            if (maxPrice) {
                paramCount++;
                query += ` AND p.price <= $${paramCount}`;
                params.push(maxPrice);
            }

            // Add sorting
            const validSortFields = ['name', 'price', 'created_at', 'stock_quantity'];
            const validSortOrders = ['ASC', 'DESC'];

            const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'created_at';
            const safeSortOrder = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

            query += ` ORDER BY p.${safeSortBy} ${safeSortOrder}`;

            // Add pagination
            paramCount++;
            query += ` LIMIT $${paramCount}`;
            params.push(limit);

            paramCount++;
            query += ` OFFSET $${paramCount}`;
            params.push(offset);

            // Execute query
            const result = await this.db.query(query, params);

            // Get total count for pagination
            let countQuery = `
                SELECT COUNT(*) as total
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.is_active = $1
            `;
            let countParams = [isActive];
            let countParamCount = 1;

            // Add same filters to count query
            if (category) {
                countParamCount++;
                countQuery += ` AND (c.slug = $${countParamCount} OR c.id = $${countParamCount})`;
                countParams.push(category);
            }

            if (search) {
                countParamCount++;
                countQuery += ` AND (
                    p.name ILIKE $${countParamCount} OR 
                    p.description ILIKE $${countParamCount} OR
                    to_tsvector('english', p.name || ' ' || COALESCE(p.description, '')) @@ plainto_tsquery('english', $${countParamCount})
                )`;
                countParams.push(`%${search}%`);
            }

            if (minPrice) {
                countParamCount++;
                countQuery += ` AND p.price >= $${countParamCount}`;
                countParams.push(minPrice);
            }

            if (maxPrice) {
                countParamCount++;
                countQuery += ` AND p.price <= $${countParamCount}`;
                countParams.push(maxPrice);
            }

            const countResult = await this.db.query(countQuery, countParams);
            const total = parseInt(countResult.rows[0].total);

            const response = {
                products: result.rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasNext: page * limit < total,
                    hasPrev: page > 1
                },
                filters: {
                    category,
                    search,
                    minPrice,
                    maxPrice,
                    sortBy: safeSortBy,
                    sortOrder: safeSortOrder
                }
            };

            // Cache the result
            if (this.redis && this.redis.isConnected) {
                await this.redis.setCachedData(cacheKey, response, this.cacheTTL);
            }

            logger.info('Products fetched successfully', {
                count: result.rows.length,
                total,
                filters
            });

            return response;
        } catch (error) {
            logger.error('Error fetching products', { error: error.message, filters });
            throw error;
        }
    }

    async getProductById(productId) {
        try {
            const cacheKey = `${this.cachePrefix}${productId}`;

            // Try to get from cache first
            if (this.redis && this.redis.isConnected) {
                const cachedProduct = await this.redis.getCachedData(cacheKey);
                if (cachedProduct) {
                    logger.debug('Product served from cache', { productId });
                    return cachedProduct;
                }
            }

            const result = await this.db.query(`
                SELECT p.*, c.name as category_name, c.slug as category_slug
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.id = $1 AND p.is_active = true
            `, [productId]);

            const product = result.rows[0] || null;

            if (product && this.redis && this.redis.isConnected) {
                await this.redis.setCachedData(cacheKey, product, this.cacheTTL);
            }

            return product;
        } catch (error) {
            logger.error('Error fetching product by ID', { error: error.message, productId });
            throw error;
        }
    }

    async getProductBySlug(slug) {
        try {
            const cacheKey = `${this.cachePrefix}slug:${slug}`;

            // Try to get from cache first
            if (this.redis && this.redis.isConnected) {
                const cachedProduct = await this.redis.getCachedData(cacheKey);
                if (cachedProduct) {
                    logger.debug('Product served from cache by slug', { slug });
                    return cachedProduct;
                }
            }

            const result = await this.db.query(`
                SELECT p.*, c.name as category_name, c.slug as category_slug
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.slug = $1 AND p.is_active = true
            `, [slug]);

            const product = result.rows[0] || null;

            if (product && this.redis && this.redis.isConnected) {
                await this.redis.setCachedData(cacheKey, product, this.cacheTTL);
            }

            return product;
        } catch (error) {
            logger.error('Error fetching product by slug', { error: error.message, slug });
            throw error;
        }
    }

    async updateProduct(productId, updateData) {
        const { name, description, price, stockQuantity, categoryId, imageUrl, sku, isActive } = updateData;

        try {
            // Check if product exists
            const existingProduct = await this.getProductById(productId);
            if (!existingProduct) {
                throw new Error('Product not found');
            }

            // Generate new slug if name is being updated
            let slug = existingProduct.slug;
            if (name && name !== existingProduct.name) {
                slug = this.generateSlug(name);

                // Check if new slug already exists
                const existingBySlug = await this.findProductBySlug(slug);
                if (existingBySlug && existingBySlug.id !== productId) {
                    throw new Error('Product with similar name already exists');
                }
            }

            // Check if SKU already exists (if being updated)
            if (sku && sku !== existingProduct.sku) {
                const existingBySku = await this.findProductBySku(sku);
                if (existingBySku && existingBySku.id !== productId) {
                    throw new Error('Product with this SKU already exists');
                }
            }

            const result = await this.db.query(`
                UPDATE products 
                SET name = COALESCE($2, name),
                    description = COALESCE($3, description),
                    price = COALESCE($4, price),
                    stock_quantity = COALESCE($5, stock_quantity),
                    category_id = COALESCE($6, category_id),
                    image_url = COALESCE($7, image_url),
                    slug = COALESCE($8, slug),
                    sku = COALESCE($9, sku),
                    is_active = COALESCE($10, is_active),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND is_active = true
                RETURNING *
            `, [productId, name, description, price, stockQuantity, categoryId, imageUrl, slug, sku, isActive]);

            if (result.rows.length === 0) {
                throw new Error('Product not found or inactive');
            }

            const product = result.rows[0];

            // Clear cache
            await this.clearProductCache(productId);
            await this.clearProductsCache();

            // Update product in Elasticsearch
            if (this.searchService) {
                await this.searchService.indexProduct(product.id);
            }

            logger.info('Product updated successfully', {
                productId: product.id,
                name: product.name
            });

            return product;
        } catch (error) {
            logger.error('Error updating product', { error: error.message, productId, updateData });
            throw error;
        }
    }

    async deleteProduct(productId) {
        try {
            // Soft delete - set is_active to false
            const result = await this.db.query(`
                UPDATE products 
                SET is_active = false, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND is_active = true
                RETURNING *
            `, [productId]);

            if (result.rows.length === 0) {
                throw new Error('Product not found or already deleted');
            }

            const product = result.rows[0];

            // Clear cache
            await this.clearProductCache(productId);
            await this.clearProductsCache();

            // Remove product from Elasticsearch
            if (this.searchService) {
                await this.searchService.removeProduct(product.id);
            }

            logger.info('Product deleted successfully', {
                productId: product.id,
                name: product.name
            });

            return product;
        } catch (error) {
            logger.error('Error deleting product', { error: error.message, productId });
            throw error;
        }
    }

    async updateStock(productId, quantity, operation = 'set') {
        try {
            let query;
            let params;

            if (operation === 'increment') {
                query = `
                    UPDATE products 
                    SET stock_quantity = stock_quantity + $2, updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1 AND is_active = true
                    RETURNING *
                `;
                params = [productId, quantity];
            } else if (operation === 'decrement') {
                query = `
                    UPDATE products 
                    SET stock_quantity = GREATEST(stock_quantity - $2, 0), updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1 AND is_active = true
                    RETURNING *
                `;
                params = [productId, quantity];
            } else {
                // Default: set
                query = `
                    UPDATE products 
                    SET stock_quantity = $2, updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1 AND is_active = true
                    RETURNING *
                `;
                params = [productId, quantity];
            }

            const result = await this.db.query(query, params);

            if (result.rows.length === 0) {
                throw new Error('Product not found or inactive');
            }

            const product = result.rows[0];

            // Clear cache
            await this.clearProductCache(productId);
            await this.clearProductsCache();

            logger.info('Product stock updated successfully', {
                productId: product.id,
                newStock: product.stock_quantity,
                operation,
                quantity
            });

            return product;
        } catch (error) {
            logger.error('Error updating product stock', { error: error.message, productId, quantity, operation });
            throw error;
        }
    }

    // Helper methods
    async findProductBySlug(slug) {
        try {
            const result = await this.db.query('SELECT * FROM products WHERE slug = $1', [slug]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error finding product by slug', { error: error.message, slug });
            throw error;
        }
    }

    async findProductBySku(sku) {
        try {
            const result = await this.db.query('SELECT * FROM products WHERE sku = $1', [sku]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error finding product by SKU', { error: error.message, sku });
            throw error;
        }
    }

    generateSlug(name) {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Replace multiple hyphens with single
            .trim('-'); // Remove leading/trailing hyphens
    }

    async clearProductCache(productId) {
        if (this.redis && this.redis.isConnected) {
            await this.redis.deleteCachedData(`${this.cachePrefix}${productId}`);
        }
    }

    async clearProductsCache() {
        if (this.redis && this.redis.isConnected) {
            // Clear all products list cache (this is a simple approach)
            // In production, you might want to use a more sophisticated cache invalidation strategy
            const keys = await this.redis.client.keys('products:list:*');
            if (keys.length > 0) {
                await this.redis.client.del(keys);
            }
        }
    }
}

module.exports = ProductService;