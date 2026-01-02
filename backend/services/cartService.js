const logger = require('../logger');

class CartService {
    constructor(dbPool, redisPool) {
        this.db = dbPool;
        this.redis = redisPool;
        this.cachePrefix = 'cart:';
        this.cacheTTL = 1800; // 30 minutes
    }

    async getCart(userId) {
        try {
            const cacheKey = `${this.cachePrefix}${userId}`;

            // Try to get from cache first
            if (this.redis && this.redis.isConnected) {
                const cachedCart = await this.redis.getCachedData(cacheKey);
                if (cachedCart) {
                    logger.debug('Cart served from cache', { userId });
                    return cachedCart;
                }
            }

            // Get cart from database
            const result = await this.db.query(`
                SELECT 
                    ci.id,
                    ci.product_id,
                    ci.quantity,
                    ci.created_at,
                    ci.updated_at,
                    p.name as product_name,
                    p.price as product_price,
                    p.image_url as product_image,
                    p.slug as product_slug,
                    p.stock_quantity as product_stock,
                    p.is_active as product_active,
                    (ci.quantity * p.price) as item_total
                FROM cart_items ci
                JOIN products p ON ci.product_id = p.id
                WHERE ci.user_id = $1 AND p.is_active = true
                ORDER BY ci.created_at ASC
            `, [userId]);

            const items = result.rows;
            const totalAmount = items.reduce((sum, item) => sum + parseFloat(item.item_total), 0);
            const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

            const cart = {
                userId,
                items,
                summary: {
                    totalItems,
                    totalAmount: parseFloat(totalAmount.toFixed(2)),
                    itemCount: items.length
                },
                updatedAt: new Date().toISOString()
            };

            // Cache the result
            if (this.redis && this.redis.isConnected) {
                await this.redis.setCachedData(cacheKey, cart, this.cacheTTL);
            }

            logger.info('Cart fetched successfully', {
                userId,
                itemCount: items.length,
                totalItems,
                totalAmount: cart.summary.totalAmount
            });

            return cart;
        } catch (error) {
            logger.error('Error fetching cart', { error: error.message, userId });
            throw error;
        }
    }

    async addToCart(userId, productId, quantity = 1) {
        try {
            // Check if product exists and is active
            const productResult = await this.db.query(
                'SELECT id, name, price, stock_quantity, is_active FROM products WHERE id = $1',
                [productId]
            );

            if (productResult.rows.length === 0) {
                throw new Error('Product not found');
            }

            const product = productResult.rows[0];

            if (!product.is_active) {
                throw new Error('Product is not available');
            }

            if (product.stock_quantity < quantity) {
                throw new Error('Insufficient stock available');
            }

            // Check if item already exists in cart
            const existingItemResult = await this.db.query(
                'SELECT id, quantity FROM cart_items WHERE user_id = $1 AND product_id = $2',
                [userId, productId]
            );

            let cartItem;

            if (existingItemResult.rows.length > 0) {
                // Update existing item
                const existingItem = existingItemResult.rows[0];
                const newQuantity = existingItem.quantity + quantity;

                if (product.stock_quantity < newQuantity) {
                    throw new Error('Insufficient stock available');
                }

                const updateResult = await this.db.query(`
                    UPDATE cart_items 
                    SET quantity = $3, updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = $1 AND product_id = $2
                    RETURNING *
                `, [userId, productId, newQuantity]);

                cartItem = updateResult.rows[0];
            } else {
                // Add new item
                const insertResult = await this.db.query(`
                    INSERT INTO cart_items (user_id, product_id, quantity)
                    VALUES ($1, $2, $3)
                    RETURNING *
                `, [userId, productId, quantity]);

                cartItem = insertResult.rows[0];
            }

            // Clear cart cache
            await this.clearCartCache(userId);

            logger.info('Item added to cart successfully', {
                userId,
                productId,
                quantity,
                cartItemId: cartItem.id
            });

            return cartItem;
        } catch (error) {
            logger.error('Error adding item to cart', { error: error.message, userId, productId, quantity });
            throw error;
        }
    }

    async updateCartItem(userId, cartItemId, quantity) {
        try {
            if (quantity <= 0) {
                return await this.removeFromCart(userId, cartItemId);
            }

            // Check if cart item belongs to user
            const cartItemResult = await this.db.query(
                'SELECT ci.*, p.stock_quantity FROM cart_items ci JOIN products p ON ci.product_id = p.id WHERE ci.id = $1 AND ci.user_id = $2',
                [cartItemId, userId]
            );

            if (cartItemResult.rows.length === 0) {
                throw new Error('Cart item not found');
            }

            const cartItem = cartItemResult.rows[0];

            if (cartItem.stock_quantity < quantity) {
                throw new Error('Insufficient stock available');
            }

            const result = await this.db.query(`
                UPDATE cart_items 
                SET quantity = $3, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND user_id = $2
                RETURNING *
            `, [cartItemId, userId, quantity]);

            const updatedItem = result.rows[0];

            // Clear cart cache
            await this.clearCartCache(userId);

            logger.info('Cart item updated successfully', {
                userId,
                cartItemId,
                newQuantity: quantity
            });

            return updatedItem;
        } catch (error) {
            logger.error('Error updating cart item', { error: error.message, userId, cartItemId, quantity });
            throw error;
        }
    }

    async removeFromCart(userId, cartItemId) {
        try {
            const result = await this.db.query(`
                DELETE FROM cart_items 
                WHERE id = $1 AND user_id = $2
                RETURNING *
            `, [cartItemId, userId]);

            if (result.rows.length === 0) {
                throw new Error('Cart item not found');
            }

            const removedItem = result.rows[0];

            // Clear cart cache
            await this.clearCartCache(userId);

            logger.info('Item removed from cart successfully', {
                userId,
                cartItemId,
                productId: removedItem.product_id
            });

            return removedItem;
        } catch (error) {
            logger.error('Error removing item from cart', { error: error.message, userId, cartItemId });
            throw error;
        }
    }

    async clearCart(userId) {
        try {
            const result = await this.db.query(`
                DELETE FROM cart_items 
                WHERE user_id = $1
                RETURNING *
            `, [userId]);

            // Clear cart cache
            await this.clearCartCache(userId);

            logger.info('Cart cleared successfully', {
                userId,
                itemsRemoved: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error clearing cart', { error: error.message, userId });
            throw error;
        }
    }

    async validateCartForCheckout(userId) {
        try {
            const cart = await this.getCart(userId);

            if (cart.items.length === 0) {
                throw new Error('Cart is empty');
            }

            const validationErrors = [];

            for (const item of cart.items) {
                if (!item.product_active) {
                    validationErrors.push(`Product "${item.product_name}" is no longer available`);
                } else if (item.product_stock < item.quantity) {
                    validationErrors.push(`Insufficient stock for "${item.product_name}". Available: ${item.product_stock}, Requested: ${item.quantity}`);
                }
            }

            if (validationErrors.length > 0) {
                throw new Error(`Cart validation failed: ${validationErrors.join(', ')}`);
            }

            logger.info('Cart validation successful', {
                userId,
                itemCount: cart.items.length,
                totalAmount: cart.summary.totalAmount
            });

            return cart;
        } catch (error) {
            logger.error('Cart validation failed', { error: error.message, userId });
            throw error;
        }
    }

    async clearCartCache(userId) {
        if (this.redis && this.redis.isConnected) {
            await this.redis.deleteCachedData(`${this.cachePrefix}${userId}`);
        }
    }
}

module.exports = CartService;