const logger = require('../logger');

class RecommendationService {
    constructor(dbPool, redisPool) {
        this.db = dbPool;
        this.redis = redisPool;
        this.cachePrefix = 'recommendations:';
        this.cacheTTL = 3600; // 1 hour
    }

    async getPersonalizedRecommendations(userId, options = {}) {
        const { limit = 10, excludeProductIds = [] } = options;

        try {
            const cacheKey = `${this.cachePrefix}personalized:${userId}:${limit}`;

            // Try cache first
            if (this.redis && this.redis.isConnected) {
                const cachedResult = await this.redis.getCachedData(cacheKey);
                if (cachedResult) {
                    logger.debug('Personalized recommendations served from cache', { userId });
                    return this.filterExcludedProducts(cachedResult, excludeProductIds);
                }
            }

            // Get user's purchase history
            const userHistory = await this.getUserPurchaseHistory(userId);

            if (userHistory.length === 0) {
                // New user - return popular products
                return await this.getPopularProducts({ limit, excludeProductIds });
            }

            // Get recommendations based on collaborative filtering
            const collaborativeRecs = await this.getCollaborativeRecommendations(userId, userHistory, limit);

            // Get content-based recommendations
            const contentRecs = await this.getContentBasedRecommendations(userHistory, limit);

            // Combine and score recommendations
            const combinedRecs = this.combineRecommendations(collaborativeRecs, contentRecs, limit);

            // Cache the result
            if (this.redis && this.redis.isConnected) {
                await this.redis.setCachedData(cacheKey, combinedRecs, this.cacheTTL);
            }

            logger.info('Personalized recommendations generated', {
                userId,
                count: combinedRecs.length,
                historySize: userHistory.length
            });

            return this.filterExcludedProducts(combinedRecs, excludeProductIds);
        } catch (error) {
            logger.error('Error generating personalized recommendations', {
                error: error.message,
                userId
            });

            // Fallback to popular products
            return await this.getPopularProducts({ limit, excludeProductIds });
        }
    }

    async getCustomersWhoBoughtAlsoBoought(productId, options = {}) {
        const { limit = 10, excludeProductIds = [] } = options;

        try {
            const cacheKey = `${this.cachePrefix}also_bought:${productId}:${limit}`;

            // Try cache first
            if (this.redis && this.redis.isConnected) {
                const cachedResult = await this.redis.getCachedData(cacheKey);
                if (cachedResult) {
                    logger.debug('Also bought recommendations served from cache', { productId });
                    return this.filterExcludedProducts(cachedResult, excludeProductIds);
                }
            }

            // Find users who bought this product
            const usersBoughtQuery = `
                SELECT DISTINCT o.user_id
                FROM orders o
                JOIN order_items oi ON o.id = oi.order_id
                WHERE oi.product_id = $1 
                AND o.status NOT IN ('cancelled')
                AND o.created_at >= NOW() - INTERVAL '6 months'
            `;

            const usersBoughtResult = await this.db.query(usersBoughtQuery, [productId]);
            const userIds = usersBoughtResult.rows.map(row => row.user_id);

            if (userIds.length === 0) {
                return await this.getSimilarProducts(productId, { limit, excludeProductIds });
            }

            // Find products these users also bought
            const alsoBoughtQuery = `
                SELECT 
                    oi.product_id,
                    p.name,
                    p.description,
                    p.price,
                    p.image_url,
                    p.slug,
                    c.name as category_name,
                    c.slug as category_slug,
                    COUNT(*) as purchase_count,
                    COUNT(DISTINCT o.user_id) as user_count,
                    AVG(p.price) as avg_price,
                    COALESCE(AVG(r.rating), 0) as avg_rating,
                    COUNT(r.id) as rating_count
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                JOIN products p ON oi.product_id = p.id
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN reviews r ON p.id = r.product_id AND r.is_approved = true
                WHERE o.user_id = ANY($1)
                AND oi.product_id != $2
                AND p.is_active = true
                AND o.status NOT IN ('cancelled')
                AND o.created_at >= NOW() - INTERVAL '6 months'
                GROUP BY oi.product_id, p.name, p.description, p.price, p.image_url, p.slug, c.name, c.slug
                ORDER BY 
                    user_count DESC,
                    purchase_count DESC,
                    avg_rating DESC
                LIMIT $3
            `;

            const result = await this.db.query(alsoBoughtQuery, [userIds, productId, limit * 2]);

            // Calculate recommendation scores
            const recommendations = result.rows.map(row => ({
                id: row.product_id,
                name: row.name,
                description: row.description,
                price: parseFloat(row.price),
                image_url: row.image_url,
                slug: row.slug,
                category_name: row.category_name,
                category_slug: row.category_slug,
                avg_rating: parseFloat(row.avg_rating),
                rating_count: parseInt(row.rating_count),
                recommendation_score: this.calculateAlsoBoughtScore(
                    parseInt(row.user_count),
                    parseInt(row.purchase_count),
                    userIds.length,
                    parseFloat(row.avg_rating)
                ),
                recommendation_reason: 'Customers who bought this item also bought'
            })).slice(0, limit);

            // Cache the result
            if (this.redis && this.redis.isConnected) {
                await this.redis.setCachedData(cacheKey, recommendations, this.cacheTTL);
            }

            logger.info('Also bought recommendations generated', {
                productId,
                count: recommendations.length,
                userCount: userIds.length
            });

            return this.filterExcludedProducts(recommendations, excludeProductIds);
        } catch (error) {
            logger.error('Error generating also bought recommendations', {
                error: error.message,
                productId
            });

            // Fallback to similar products
            return await this.getSimilarProducts(productId, { limit, excludeProductIds });
        }
    }

    async getSimilarProducts(productId, options = {}) {
        const { limit = 10, excludeProductIds = [] } = options;

        try {
            const cacheKey = `${this.cachePrefix}similar:${productId}:${limit}`;

            // Try cache first
            if (this.redis && this.redis.isConnected) {
                const cachedResult = await this.redis.getCachedData(cacheKey);
                if (cachedResult) {
                    logger.debug('Similar products served from cache', { productId });
                    return this.filterExcludedProducts(cachedResult, excludeProductIds);
                }
            }

            // Get the target product
            const productResult = await this.db.query(`
                SELECT p.*, c.name as category_name, c.slug as category_slug
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.id = $1 AND p.is_active = true
            `, [productId]);

            if (productResult.rows.length === 0) {
                return [];
            }

            const targetProduct = productResult.rows[0];

            // Find similar products based on category and price range
            const priceMin = targetProduct.price * 0.5;
            const priceMax = targetProduct.price * 2.0;

            const similarQuery = `
                SELECT 
                    p.*,
                    c.name as category_name,
                    c.slug as category_slug,
                    COALESCE(AVG(r.rating), 0) as avg_rating,
                    COUNT(r.id) as rating_count,
                    ABS(p.price - $2) as price_diff
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN reviews r ON p.id = r.product_id AND r.is_approved = true
                WHERE p.id != $1
                AND p.is_active = true
                AND (
                    p.category_id = $3
                    OR (p.price BETWEEN $4 AND $5)
                    OR similarity(p.name, $6) > 0.3
                )
                GROUP BY p.id, c.name, c.slug
                ORDER BY 
                    CASE WHEN p.category_id = $3 THEN 1 ELSE 2 END,
                    price_diff ASC,
                    avg_rating DESC
                LIMIT $7
            `;

            const result = await this.db.query(similarQuery, [
                productId,
                targetProduct.price,
                targetProduct.category_id,
                priceMin,
                priceMax,
                targetProduct.name,
                limit
            ]);

            const recommendations = result.rows.map(row => ({
                id: row.id,
                name: row.name,
                description: row.description,
                price: parseFloat(row.price),
                image_url: row.image_url,
                slug: row.slug,
                category_name: row.category_name,
                category_slug: row.category_slug,
                avg_rating: parseFloat(row.avg_rating),
                rating_count: parseInt(row.rating_count),
                recommendation_score: this.calculateSimilarityScore(
                    targetProduct,
                    row,
                    parseFloat(row.avg_rating)
                ),
                recommendation_reason: 'Similar products you might like'
            }));

            // Cache the result
            if (this.redis && this.redis.isConnected) {
                await this.redis.setCachedData(cacheKey, recommendations, this.cacheTTL);
            }

            logger.info('Similar products generated', {
                productId,
                count: recommendations.length
            });

            return this.filterExcludedProducts(recommendations, excludeProductIds);
        } catch (error) {
            logger.error('Error generating similar products', {
                error: error.message,
                productId
            });
            return [];
        }
    }

    async getPopularProducts(options = {}) {
        const { limit = 10, excludeProductIds = [], categoryId = null } = options;

        try {
            const cacheKey = `${this.cachePrefix}popular:${categoryId || 'all'}:${limit}`;

            // Try cache first
            if (this.redis && this.redis.isConnected) {
                const cachedResult = await this.redis.getCachedData(cacheKey);
                if (cachedResult) {
                    logger.debug('Popular products served from cache', { categoryId });
                    return this.filterExcludedProducts(cachedResult, excludeProductIds);
                }
            }

            let popularQuery = `
                SELECT 
                    p.*,
                    c.name as category_name,
                    c.slug as category_slug,
                    COALESCE(SUM(oi.quantity), 0) as total_sold,
                    COALESCE(COUNT(DISTINCT o.id), 0) as order_count,
                    COALESCE(AVG(r.rating), 0) as avg_rating,
                    COUNT(r.id) as rating_count
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN order_items oi ON p.id = oi.product_id
                LEFT JOIN orders o ON oi.order_id = o.id AND o.status NOT IN ('cancelled')
                LEFT JOIN reviews r ON p.id = r.product_id AND r.is_approved = true
                WHERE p.is_active = true
            `;

            let params = [];
            let paramCount = 0;

            if (categoryId) {
                paramCount++;
                popularQuery += ` AND p.category_id = $${paramCount}`;
                params.push(categoryId);
            }

            popularQuery += `
                GROUP BY p.id, c.name, c.slug
                ORDER BY 
                    total_sold DESC,
                    order_count DESC,
                    avg_rating DESC,
                    p.created_at DESC
                LIMIT $${paramCount + 1}
            `;
            params.push(limit);

            const result = await this.db.query(popularQuery, params);

            const recommendations = result.rows.map(row => ({
                id: row.id,
                name: row.name,
                description: row.description,
                price: parseFloat(row.price),
                image_url: row.image_url,
                slug: row.slug,
                category_name: row.category_name,
                category_slug: row.category_slug,
                avg_rating: parseFloat(row.avg_rating),
                rating_count: parseInt(row.rating_count),
                total_sold: parseInt(row.total_sold),
                recommendation_score: this.calculatePopularityScore(
                    parseInt(row.total_sold),
                    parseInt(row.order_count),
                    parseFloat(row.avg_rating)
                ),
                recommendation_reason: 'Popular products'
            }));

            // Cache the result
            if (this.redis && this.redis.isConnected) {
                await this.redis.setCachedData(cacheKey, recommendations, this.cacheTTL);
            }

            logger.info('Popular products generated', {
                categoryId,
                count: recommendations.length
            });

            return this.filterExcludedProducts(recommendations, excludeProductIds);
        } catch (error) {
            logger.error('Error generating popular products', {
                error: error.message,
                categoryId
            });
            return [];
        }
    }

    async getTrendingProducts(options = {}) {
        const { limit = 10, excludeProductIds = [], days = 7 } = options;

        try {
            const cacheKey = `${this.cachePrefix}trending:${days}:${limit}`;

            // Try cache first
            if (this.redis && this.redis.isConnected) {
                const cachedResult = await this.redis.getCachedData(cacheKey);
                if (cachedResult) {
                    logger.debug('Trending products served from cache', { days });
                    return this.filterExcludedProducts(cachedResult, excludeProductIds);
                }
            }

            const trendingQuery = `
                SELECT 
                    p.*,
                    c.name as category_name,
                    c.slug as category_slug,
                    COALESCE(SUM(oi.quantity), 0) as recent_sold,
                    COALESCE(COUNT(DISTINCT o.id), 0) as recent_orders,
                    COALESCE(AVG(r.rating), 0) as avg_rating,
                    COUNT(r.id) as rating_count
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN order_items oi ON p.id = oi.product_id
                LEFT JOIN orders o ON oi.order_id = o.id 
                    AND o.status NOT IN ('cancelled')
                    AND o.created_at >= NOW() - INTERVAL '${days} days'
                LEFT JOIN reviews r ON p.id = r.product_id AND r.is_approved = true
                WHERE p.is_active = true
                AND p.created_at >= NOW() - INTERVAL '30 days'
                GROUP BY p.id, c.name, c.slug
                HAVING COALESCE(SUM(oi.quantity), 0) > 0
                ORDER BY 
                    recent_sold DESC,
                    recent_orders DESC,
                    avg_rating DESC
                LIMIT $1
            `;

            const result = await this.db.query(trendingQuery, [limit]);

            const recommendations = result.rows.map(row => ({
                id: row.id,
                name: row.name,
                description: row.description,
                price: parseFloat(row.price),
                image_url: row.image_url,
                slug: row.slug,
                category_name: row.category_name,
                category_slug: row.category_slug,
                avg_rating: parseFloat(row.avg_rating),
                rating_count: parseInt(row.rating_count),
                recent_sold: parseInt(row.recent_sold),
                recommendation_score: this.calculateTrendingScore(
                    parseInt(row.recent_sold),
                    parseInt(row.recent_orders),
                    parseFloat(row.avg_rating),
                    days
                ),
                recommendation_reason: `Trending in the last ${days} days`
            }));

            // Cache the result
            if (this.redis && this.redis.isConnected) {
                await this.redis.setCachedData(cacheKey, recommendations, this.cacheTTL);
            }

            logger.info('Trending products generated', {
                days,
                count: recommendations.length
            });

            return this.filterExcludedProducts(recommendations, excludeProductIds);
        } catch (error) {
            logger.error('Error generating trending products', {
                error: error.message,
                days
            });
            return [];
        }
    }

    // Helper methods
    async getUserPurchaseHistory(userId) {
        try {
            const result = await this.db.query(`
                SELECT DISTINCT oi.product_id, p.category_id, p.price
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                JOIN products p ON oi.product_id = p.id
                WHERE o.user_id = $1 
                AND o.status NOT IN ('cancelled')
                AND o.created_at >= NOW() - INTERVAL '6 months'
            `, [userId]);

            return result.rows;
        } catch (error) {
            logger.error('Error getting user purchase history', { error: error.message, userId });
            return [];
        }
    }

    async getCollaborativeRecommendations(userId, userHistory, limit) {
        try {
            const productIds = userHistory.map(item => item.product_id);

            if (productIds.length === 0) {
                return [];
            }

            // Find users with similar purchase patterns
            const similarUsersQuery = `
                SELECT 
                    o.user_id,
                    COUNT(*) as common_products,
                    COUNT(DISTINCT oi.product_id) as total_products
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                WHERE oi.product_id = ANY($1)
                AND o.user_id != $2
                AND o.status NOT IN ('cancelled')
                GROUP BY o.user_id
                HAVING COUNT(*) >= 2
                ORDER BY common_products DESC, total_products DESC
                LIMIT 50
            `;

            const similarUsersResult = await this.db.query(similarUsersQuery, [productIds, userId]);
            const similarUserIds = similarUsersResult.rows.map(row => row.user_id);

            if (similarUserIds.length === 0) {
                return [];
            }

            // Get products bought by similar users
            const recommendationsQuery = `
                SELECT 
                    oi.product_id,
                    p.name,
                    p.description,
                    p.price,
                    p.image_url,
                    p.slug,
                    c.name as category_name,
                    c.slug as category_slug,
                    COUNT(*) as purchase_count,
                    COUNT(DISTINCT o.user_id) as user_count,
                    COALESCE(AVG(r.rating), 0) as avg_rating,
                    COUNT(r.id) as rating_count
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                JOIN products p ON oi.product_id = p.id
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN reviews r ON p.id = r.product_id AND r.is_approved = true
                WHERE o.user_id = ANY($1)
                AND oi.product_id != ALL($2)
                AND p.is_active = true
                AND o.status NOT IN ('cancelled')
                GROUP BY oi.product_id, p.name, p.description, p.price, p.image_url, p.slug, c.name, c.slug
                ORDER BY user_count DESC, purchase_count DESC
                LIMIT $3
            `;

            const result = await this.db.query(recommendationsQuery, [
                similarUserIds,
                productIds,
                limit
            ]);

            return result.rows.map(row => ({
                id: row.product_id,
                name: row.name,
                description: row.description,
                price: parseFloat(row.price),
                image_url: row.image_url,
                slug: row.slug,
                category_name: row.category_name,
                category_slug: row.category_slug,
                avg_rating: parseFloat(row.avg_rating),
                rating_count: parseInt(row.rating_count),
                recommendation_score: this.calculateCollaborativeScore(
                    parseInt(row.user_count),
                    parseInt(row.purchase_count),
                    similarUserIds.length
                ),
                recommendation_reason: 'Based on similar customers'
            }));
        } catch (error) {
            logger.error('Error generating collaborative recommendations', {
                error: error.message,
                userId
            });
            return [];
        }
    }

    async getContentBasedRecommendations(userHistory, limit) {
        try {
            if (userHistory.length === 0) {
                return [];
            }

            // Get user's preferred categories and price ranges
            const categoryIds = [...new Set(userHistory.map(item => item.category_id))];
            const avgPrice = userHistory.reduce((sum, item) => sum + parseFloat(item.price), 0) / userHistory.length;
            const priceMin = avgPrice * 0.7;
            const priceMax = avgPrice * 1.5;

            const contentQuery = `
                SELECT 
                    p.*,
                    c.name as category_name,
                    c.slug as category_slug,
                    COALESCE(AVG(r.rating), 0) as avg_rating,
                    COUNT(r.id) as rating_count
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN reviews r ON p.id = r.product_id AND r.is_approved = true
                WHERE p.is_active = true
                AND (
                    p.category_id = ANY($1)
                    OR (p.price BETWEEN $2 AND $3)
                )
                GROUP BY p.id, c.name, c.slug
                ORDER BY 
                    CASE WHEN p.category_id = ANY($1) THEN 1 ELSE 2 END,
                    avg_rating DESC,
                    p.created_at DESC
                LIMIT $4
            `;

            const result = await this.db.query(contentQuery, [
                categoryIds,
                priceMin,
                priceMax,
                limit
            ]);

            return result.rows.map(row => ({
                id: row.id,
                name: row.name,
                description: row.description,
                price: parseFloat(row.price),
                image_url: row.image_url,
                slug: row.slug,
                category_name: row.category_name,
                category_slug: row.category_slug,
                avg_rating: parseFloat(row.avg_rating),
                rating_count: parseInt(row.rating_count),
                recommendation_score: this.calculateContentScore(
                    categoryIds.includes(row.category_id),
                    parseFloat(row.price),
                    avgPrice,
                    parseFloat(row.avg_rating)
                ),
                recommendation_reason: 'Based on your preferences'
            }));
        } catch (error) {
            logger.error('Error generating content-based recommendations', {
                error: error.message
            });
            return [];
        }
    }

    combineRecommendations(collaborative, contentBased, limit) {
        // Combine and deduplicate recommendations
        const combined = new Map();

        // Add collaborative recommendations with higher weight
        collaborative.forEach(rec => {
            combined.set(rec.id, {
                ...rec,
                recommendation_score: rec.recommendation_score * 1.2
            });
        });

        // Add content-based recommendations
        contentBased.forEach(rec => {
            if (combined.has(rec.id)) {
                // Boost score if product appears in both
                const existing = combined.get(rec.id);
                existing.recommendation_score += rec.recommendation_score * 0.8;
                existing.recommendation_reason = 'Highly recommended for you';
            } else {
                combined.set(rec.id, rec);
            }
        });

        // Sort by score and return top results
        return Array.from(combined.values())
            .sort((a, b) => b.recommendation_score - a.recommendation_score)
            .slice(0, limit);
    }

    filterExcludedProducts(recommendations, excludeProductIds) {
        if (!excludeProductIds || excludeProductIds.length === 0) {
            return recommendations;
        }

        return recommendations.filter(rec => !excludeProductIds.includes(rec.id));
    }

    // Scoring functions
    calculateAlsoBoughtScore(userCount, purchaseCount, totalUsers, avgRating) {
        const userRatio = userCount / Math.max(totalUsers, 1);
        const ratingBonus = avgRating > 0 ? avgRating / 5 : 0.5;
        return (userRatio * 100) + (purchaseCount * 10) + (ratingBonus * 20);
    }

    calculateSimilarityScore(targetProduct, similarProduct, avgRating) {
        const categoryMatch = targetProduct.category_id === similarProduct.category_id ? 50 : 0;
        const priceDiff = Math.abs(targetProduct.price - similarProduct.price);
        const priceScore = Math.max(0, 30 - (priceDiff / targetProduct.price * 100));
        const ratingBonus = avgRating > 0 ? avgRating * 4 : 10;

        return categoryMatch + priceScore + ratingBonus;
    }

    calculatePopularityScore(totalSold, orderCount, avgRating) {
        return (totalSold * 2) + (orderCount * 5) + (avgRating * 10);
    }

    calculateTrendingScore(recentSold, recentOrders, avgRating, days) {
        const dailyAvg = recentSold / days;
        return (dailyAvg * 10) + (recentOrders * 5) + (avgRating * 8);
    }

    calculateCollaborativeScore(userCount, purchaseCount, totalSimilarUsers) {
        const userRatio = userCount / Math.max(totalSimilarUsers, 1);
        return (userRatio * 100) + (purchaseCount * 5);
    }

    calculateContentScore(categoryMatch, price, avgUserPrice, avgRating) {
        const categoryBonus = categoryMatch ? 50 : 0;
        const priceDiff = Math.abs(price - avgUserPrice);
        const priceScore = Math.max(0, 30 - (priceDiff / avgUserPrice * 100));
        const ratingBonus = avgRating > 0 ? avgRating * 4 : 10;

        return categoryBonus + priceScore + ratingBonus;
    }
}

module.exports = RecommendationService;