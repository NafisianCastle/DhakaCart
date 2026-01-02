const logger = require('../logger');

class ReviewService {
    constructor(dbPool, redisPool) {
        this.dbPool = dbPool;
        this.redisPool = redisPool;
    }

    // Create a new product review
    async createReview(userId, productId, reviewData) {
        const { rating, title, reviewText } = reviewData;

        try {
            // Check if user has already reviewed this product
            const existingReview = await this.dbPool.query(
                'SELECT id FROM product_reviews WHERE product_id = $1 AND user_id = $2',
                [productId, userId]
            );

            if (existingReview.rows.length > 0) {
                throw new Error('You have already reviewed this product');
            }

            // Check if user has purchased this product (for verified purchase flag)
            const purchaseCheck = await this.dbPool.query(`
                SELECT COUNT(*) as purchase_count
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                WHERE o.user_id = $1 AND oi.product_id = $2 AND o.status IN ('delivered', 'completed')
            `, [userId, productId]);

            const isVerifiedPurchase = parseInt(purchaseCheck.rows[0].purchase_count) > 0;

            // Create the review
            const result = await this.dbPool.query(`
                INSERT INTO product_reviews (
                    product_id, user_id, rating, title, review_text, is_verified_purchase
                ) VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `, [productId, userId, rating, title, reviewText, isVerifiedPurchase]);

            const review = result.rows[0];

            // Clear cache for this product's reviews
            if (this.redisPool && this.redisPool.isConnected) {
                await this.redisPool.deleteCachedData(`product:${productId}:reviews`);
                await this.redisPool.deleteCachedData(`product:${productId}:stats`);
            }

            logger.info('Product review created', {
                reviewId: review.id,
                productId,
                userId,
                rating,
                isVerifiedPurchase
            });

            return review;
        } catch (error) {
            logger.error('Failed to create product review', {
                error: error.message,
                productId,
                userId,
                reviewData
            });
            throw error;
        }
    }

    // Get reviews for a product with pagination and filtering
    async getProductReviews(productId, options = {}) {
        const {
            page = 1,
            limit = 10,
            sortBy = 'created_at',
            sortOrder = 'DESC',
            rating = null,
            verifiedOnly = false
        } = options;

        const offset = (page - 1) * limit;

        try {
            // Build WHERE clause
            let whereConditions = ['pr.product_id = $1', 'pr.is_approved = true'];
            let queryParams = [productId];
            let paramIndex = 2;

            if (rating) {
                whereConditions.push(`pr.rating = $${paramIndex}`);
                queryParams.push(rating);
                paramIndex++;
            }

            if (verifiedOnly) {
                whereConditions.push('pr.is_verified_purchase = true');
            }

            const whereClause = whereConditions.join(' AND ');

            // Validate sort options
            const validSortColumns = ['created_at', 'rating', 'helpful_count'];
            const validSortOrders = ['ASC', 'DESC'];

            const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
            const sortDirection = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

            // Get reviews with user information
            const reviewsResult = await this.dbPool.query(`
                SELECT 
                    pr.*,
                    u.first_name,
                    u.last_name,
                    u.email,
                    COUNT(rm.id) as media_count
                FROM product_reviews pr
                JOIN users u ON pr.user_id = u.id
                LEFT JOIN review_media rm ON pr.id = rm.review_id AND rm.is_approved = true
                WHERE ${whereClause}
                GROUP BY pr.id, u.first_name, u.last_name, u.email
                ORDER BY pr.${sortColumn} ${sortDirection}
                LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            `, [...queryParams, limit, offset]);

            // Get total count for pagination
            const countResult = await this.dbPool.query(`
                SELECT COUNT(*) as total
                FROM product_reviews pr
                WHERE ${whereClause}
            `, queryParams);

            const total = parseInt(countResult.rows[0].total);
            const totalPages = Math.ceil(total / limit);

            // Get review media for each review
            const reviews = await Promise.all(reviewsResult.rows.map(async (review) => {
                const mediaResult = await this.dbPool.query(`
                    SELECT media_type, media_url, media_thumbnail_url, alt_text
                    FROM review_media
                    WHERE review_id = $1 AND is_approved = true
                    ORDER BY created_at
                `, [review.id]);

                return {
                    ...review,
                    user: {
                        firstName: review.first_name,
                        lastName: review.last_name,
                        email: review.email
                    },
                    media: mediaResult.rows,
                    // Remove sensitive user data from response
                    first_name: undefined,
                    last_name: undefined,
                    email: undefined
                };
            }));

            return {
                reviews,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                },
                filters: {
                    rating,
                    verifiedOnly,
                    sortBy: sortColumn,
                    sortOrder: sortDirection
                }
            };
        } catch (error) {
            logger.error('Failed to get product reviews', {
                error: error.message,
                productId,
                options
            });
            throw error;
        }
    }

    // Get review statistics for a product
    async getProductReviewStats(productId) {
        try {
            // Try to get from cache first
            const cacheKey = `product:${productId}:stats`;
            if (this.redisPool && this.redisPool.isConnected) {
                const cachedStats = await this.redisPool.getCachedData(cacheKey);
                if (cachedStats) {
                    return cachedStats;
                }
            }

            // Get from database
            const result = await this.dbPool.query(`
                SELECT 
                    review_count,
                    average_rating,
                    rating_distribution
                FROM products
                WHERE id = $1
            `, [productId]);

            if (result.rows.length === 0) {
                throw new Error('Product not found');
            }

            const stats = {
                reviewCount: result.rows[0].review_count || 0,
                averageRating: parseFloat(result.rows[0].average_rating) || 0,
                ratingDistribution: result.rows[0].rating_distribution || { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 }
            };

            // Cache the stats for 5 minutes
            if (this.redisPool && this.redisPool.isConnected) {
                await this.redisPool.setCachedData(cacheKey, stats, 300);
            }

            return stats;
        } catch (error) {
            logger.error('Failed to get product review stats', {
                error: error.message,
                productId
            });
            throw error;
        }
    }

    // Update a review
    async updateReview(reviewId, userId, updateData) {
        const { rating, title, reviewText } = updateData;

        try {
            // Check if review exists and belongs to user
            const existingReview = await this.dbPool.query(
                'SELECT product_id FROM product_reviews WHERE id = $1 AND user_id = $2',
                [reviewId, userId]
            );

            if (existingReview.rows.length === 0) {
                throw new Error('Review not found or you do not have permission to update it');
            }

            const productId = existingReview.rows[0].product_id;

            // Update the review
            const result = await this.dbPool.query(`
                UPDATE product_reviews 
                SET rating = $1, title = $2, review_text = $3, updated_at = CURRENT_TIMESTAMP
                WHERE id = $4 AND user_id = $5
                RETURNING *
            `, [rating, title, reviewText, reviewId, userId]);

            const review = result.rows[0];

            // Clear cache
            if (this.redisPool && this.redisPool.isConnected) {
                await this.redisPool.deleteCachedData(`product:${productId}:reviews`);
                await this.redisPool.deleteCachedData(`product:${productId}:stats`);
            }

            logger.info('Product review updated', {
                reviewId,
                productId,
                userId
            });

            return review;
        } catch (error) {
            logger.error('Failed to update product review', {
                error: error.message,
                reviewId,
                userId,
                updateData
            });
            throw error;
        }
    }

    // Delete a review
    async deleteReview(reviewId, userId) {
        try {
            // Check if review exists and belongs to user
            const existingReview = await this.dbPool.query(
                'SELECT product_id FROM product_reviews WHERE id = $1 AND user_id = $2',
                [reviewId, userId]
            );

            if (existingReview.rows.length === 0) {
                throw new Error('Review not found or you do not have permission to delete it');
            }

            const productId = existingReview.rows[0].product_id;

            // Delete the review (cascade will handle related records)
            const result = await this.dbPool.query(
                'DELETE FROM product_reviews WHERE id = $1 AND user_id = $2 RETURNING *',
                [reviewId, userId]
            );

            const deletedReview = result.rows[0];

            // Clear cache
            if (this.redisPool && this.redisPool.isConnected) {
                await this.redisPool.deleteCachedData(`product:${productId}:reviews`);
                await this.redisPool.deleteCachedData(`product:${productId}:stats`);
            }

            logger.info('Product review deleted', {
                reviewId,
                productId,
                userId
            });

            return deletedReview;
        } catch (error) {
            logger.error('Failed to delete product review', {
                error: error.message,
                reviewId,
                userId
            });
            throw error;
        }
    }

    // Mark review as helpful or not helpful
    async markReviewHelpful(reviewId, userId, isHelpful) {
        try {
            // Check if user has already voted on this review
            const existingVote = await this.dbPool.query(
                'SELECT id, is_helpful FROM review_helpfulness WHERE review_id = $1 AND user_id = $2',
                [reviewId, userId]
            );

            if (existingVote.rows.length > 0) {
                // Update existing vote
                const result = await this.dbPool.query(`
                    UPDATE review_helpfulness 
                    SET is_helpful = $1
                    WHERE review_id = $2 AND user_id = $3
                    RETURNING *
                `, [isHelpful, reviewId, userId]);

                logger.info('Review helpfulness vote updated', {
                    reviewId,
                    userId,
                    isHelpful
                });

                return result.rows[0];
            } else {
                // Create new vote
                const result = await this.dbPool.query(`
                    INSERT INTO review_helpfulness (review_id, user_id, is_helpful)
                    VALUES ($1, $2, $3)
                    RETURNING *
                `, [reviewId, userId, isHelpful]);

                logger.info('Review helpfulness vote created', {
                    reviewId,
                    userId,
                    isHelpful
                });

                return result.rows[0];
            }
        } catch (error) {
            logger.error('Failed to mark review helpfulness', {
                error: error.message,
                reviewId,
                userId,
                isHelpful
            });
            throw error;
        }
    }

    // Report a review
    async reportReview(reviewId, userId, reportData) {
        const { reason, description } = reportData;

        try {
            // Check if user has already reported this review for this reason
            const existingReport = await this.dbPool.query(
                'SELECT id FROM review_reports WHERE review_id = $1 AND reporter_user_id = $2 AND reason = $3',
                [reviewId, userId, reason]
            );

            if (existingReport.rows.length > 0) {
                throw new Error('You have already reported this review for this reason');
            }

            // Create the report
            const result = await this.dbPool.query(`
                INSERT INTO review_reports (review_id, reporter_user_id, reason, description)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `, [reviewId, userId, reason, description]);

            const report = result.rows[0];

            // Update reported count on the review
            await this.dbPool.query(`
                UPDATE product_reviews 
                SET reported_count = reported_count + 1
                WHERE id = $1
            `, [reviewId]);

            logger.info('Review reported', {
                reportId: report.id,
                reviewId,
                userId,
                reason
            });

            return report;
        } catch (error) {
            logger.error('Failed to report review', {
                error: error.message,
                reviewId,
                userId,
                reportData
            });
            throw error;
        }
    }

    // Get user's reviews
    async getUserReviews(userId, options = {}) {
        const { page = 1, limit = 10 } = options;
        const offset = (page - 1) * limit;

        try {
            const reviewsResult = await this.dbPool.query(`
                SELECT 
                    pr.*,
                    p.name as product_name,
                    p.image_url as product_image
                FROM product_reviews pr
                JOIN products p ON pr.product_id = p.id
                WHERE pr.user_id = $1
                ORDER BY pr.created_at DESC
                LIMIT $2 OFFSET $3
            `, [userId, limit, offset]);

            const countResult = await this.dbPool.query(
                'SELECT COUNT(*) as total FROM product_reviews WHERE user_id = $1',
                [userId]
            );

            const total = parseInt(countResult.rows[0].total);
            const totalPages = Math.ceil(total / limit);

            return {
                reviews: reviewsResult.rows,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                }
            };
        } catch (error) {
            logger.error('Failed to get user reviews', {
                error: error.message,
                userId,
                options
            });
            throw error;
        }
    }

    // Admin: Get all reviews for moderation
    async getAllReviewsForModeration(options = {}) {
        const {
            page = 1,
            limit = 20,
            status = 'all', // 'all', 'pending', 'approved', 'reported'
            sortBy = 'created_at',
            sortOrder = 'DESC'
        } = options;

        const offset = (page - 1) * limit;

        try {
            let whereConditions = [];
            let queryParams = [];
            let paramIndex = 1;

            // Filter by status
            if (status === 'pending') {
                whereConditions.push('pr.is_approved = false');
            } else if (status === 'approved') {
                whereConditions.push('pr.is_approved = true');
            } else if (status === 'reported') {
                whereConditions.push('pr.reported_count > 0');
            }

            const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

            // Validate sort options
            const validSortColumns = ['created_at', 'rating', 'reported_count', 'helpful_count'];
            const validSortOrders = ['ASC', 'DESC'];

            const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
            const sortDirection = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

            const reviewsResult = await this.dbPool.query(`
                SELECT 
                    pr.*,
                    u.first_name,
                    u.last_name,
                    u.email,
                    p.name as product_name,
                    COUNT(rr.id) as report_count
                FROM product_reviews pr
                JOIN users u ON pr.user_id = u.id
                JOIN products p ON pr.product_id = p.id
                LEFT JOIN review_reports rr ON pr.id = rr.review_id AND rr.status = 'pending'
                ${whereClause}
                GROUP BY pr.id, u.first_name, u.last_name, u.email, p.name
                ORDER BY pr.${sortColumn} ${sortDirection}
                LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            `, [...queryParams, limit, offset]);

            const countResult = await this.dbPool.query(`
                SELECT COUNT(*) as total
                FROM product_reviews pr
                ${whereClause}
            `, queryParams);

            const total = parseInt(countResult.rows[0].total);
            const totalPages = Math.ceil(total / limit);

            return {
                reviews: reviewsResult.rows,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                },
                filters: {
                    status,
                    sortBy: sortColumn,
                    sortOrder: sortDirection
                }
            };
        } catch (error) {
            logger.error('Failed to get reviews for moderation', {
                error: error.message,
                options
            });
            throw error;
        }
    }

    // Admin: Moderate a review
    async moderateReview(reviewId, adminId, moderationData) {
        const { isApproved, reason } = moderationData;

        try {
            const result = await this.dbPool.query(`
                UPDATE product_reviews 
                SET 
                    is_approved = $1,
                    moderated_by = $2,
                    moderated_at = CURRENT_TIMESTAMP,
                    moderation_reason = $3
                WHERE id = $4
                RETURNING *
            `, [isApproved, adminId, reason, reviewId]);

            if (result.rows.length === 0) {
                throw new Error('Review not found');
            }

            const review = result.rows[0];

            // Clear cache for this product
            if (this.redisPool && this.redisPool.isConnected) {
                await this.redisPool.deleteCachedData(`product:${review.product_id}:reviews`);
                await this.redisPool.deleteCachedData(`product:${review.product_id}:stats`);
            }

            logger.info('Review moderated', {
                reviewId,
                adminId,
                isApproved,
                reason
            });

            return review;
        } catch (error) {
            logger.error('Failed to moderate review', {
                error: error.message,
                reviewId,
                adminId,
                moderationData
            });
            throw error;
        }
    }
}

module.exports = ReviewService;