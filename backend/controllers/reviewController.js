const ReviewService = require('../services/reviewService');
const logger = require('../logger');
const rateLimit = require('express-rate-limit');

// Rate limiting for review endpoints
const reviewLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // limit each IP to 20 review requests per windowMs
    message: {
        error: 'Too many review requests, please try again later',
        code: 'RATE_LIMIT_EXCEEDED'
    }
});

const reviewCreateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // limit each IP to 5 review creation requests per hour
    message: {
        error: 'Too many review creation attempts, please try again later',
        code: 'RATE_LIMIT_EXCEEDED'
    }
});

class ReviewController {
    constructor(dbPool, redisPool, webSocketService = null, emailService = null) {
        this.reviewService = new ReviewService(dbPool, redisPool);
        this.webSocketService = webSocketService;
        this.emailService = emailService;
    }

    // Create a new product review
    createReview = async (req, res) => {
        try {
            const { productId } = req.params;
            const userId = req.user.userId;
            const reviewData = req.validatedData;

            const review = await this.reviewService.createReview(userId, productId, reviewData);

            logger.info('Product review created successfully', {
                reviewId: review.id,
                productId,
                userId,
                rating: review.rating,
                correlationId: req.correlationId
            });

            res.status(201).json({
                success: true,
                message: 'Review created successfully',
                data: { review },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Create review failed', {
                error: error.message,
                productId: req.params.productId,
                userId: req.user?.userId,
                reviewData: req.validatedData,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('already reviewed') ? 409 :
                error.message.includes('not found') ? 404 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: statusCode === 409 ? 'REVIEW_EXISTS' :
                    statusCode === 404 ? 'PRODUCT_NOT_FOUND' : 'REVIEW_CREATION_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Get reviews for a product
    getProductReviews = async (req, res) => {
        try {
            const { productId } = req.params;
            const filters = req.validatedQuery;

            const result = await this.reviewService.getProductReviews(productId, filters);

            logger.info('Product reviews fetched successfully', {
                productId,
                reviewCount: result.reviews.length,
                totalReviews: result.pagination.total,
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
            logger.error('Get product reviews failed', {
                error: error.message,
                productId: req.params.productId,
                filters: req.validatedQuery,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to fetch product reviews',
                code: 'REVIEWS_FETCH_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Get review statistics for a product
    getProductReviewStats = async (req, res) => {
        try {
            const { productId } = req.params;

            const stats = await this.reviewService.getProductReviewStats(productId);

            logger.info('Product review stats fetched successfully', {
                productId,
                reviewCount: stats.reviewCount,
                averageRating: stats.averageRating,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                data: { stats },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Get product review stats failed', {
                error: error.message,
                productId: req.params.productId,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('not found') ? 404 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: statusCode === 404 ? 'PRODUCT_NOT_FOUND' : 'REVIEW_STATS_FETCH_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Update a review
    updateReview = async (req, res) => {
        try {
            const { reviewId } = req.params;
            const userId = req.user.userId;
            const updateData = req.validatedData;

            const review = await this.reviewService.updateReview(reviewId, userId, updateData);

            logger.info('Product review updated successfully', {
                reviewId,
                userId,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                message: 'Review updated successfully',
                data: { review },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Update review failed', {
                error: error.message,
                reviewId: req.params.reviewId,
                userId: req.user?.userId,
                updateData: req.validatedData,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('not found') ||
                error.message.includes('permission') ? 404 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: statusCode === 404 ? 'REVIEW_NOT_FOUND' : 'REVIEW_UPDATE_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Delete a review
    deleteReview = async (req, res) => {
        try {
            const { reviewId } = req.params;
            const userId = req.user.userId;

            const deletedReview = await this.reviewService.deleteReview(reviewId, userId);

            logger.info('Product review deleted successfully', {
                reviewId,
                userId,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                message: 'Review deleted successfully',
                data: { review: deletedReview },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Delete review failed', {
                error: error.message,
                reviewId: req.params.reviewId,
                userId: req.user?.userId,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('not found') ||
                error.message.includes('permission') ? 404 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: statusCode === 404 ? 'REVIEW_NOT_FOUND' : 'REVIEW_DELETION_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Mark review as helpful
    markReviewHelpful = async (req, res) => {
        try {
            const { reviewId } = req.params;
            const userId = req.user.userId;
            const { isHelpful } = req.validatedData;

            const vote = await this.reviewService.markReviewHelpful(reviewId, userId, isHelpful);

            logger.info('Review helpfulness marked successfully', {
                reviewId,
                userId,
                isHelpful,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                message: 'Review helpfulness updated successfully',
                data: { vote },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Mark review helpful failed', {
                error: error.message,
                reviewId: req.params.reviewId,
                userId: req.user?.userId,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to update review helpfulness',
                code: 'REVIEW_HELPFULNESS_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Report a review
    reportReview = async (req, res) => {
        try {
            const { reviewId } = req.params;
            const userId = req.user.userId;
            const reportData = req.validatedData;

            const report = await this.reviewService.reportReview(reviewId, userId, reportData);

            logger.info('Review reported successfully', {
                reportId: report.id,
                reviewId,
                userId,
                reason: reportData.reason,
                correlationId: req.correlationId
            });

            res.status(201).json({
                success: true,
                message: 'Review reported successfully',
                data: { report },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Report review failed', {
                error: error.message,
                reviewId: req.params.reviewId,
                userId: req.user?.userId,
                reportData: req.validatedData,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('already reported') ? 409 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: statusCode === 409 ? 'REPORT_EXISTS' : 'REVIEW_REPORT_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Get user's reviews
    getUserReviews = async (req, res) => {
        try {
            const userId = req.user.userId;
            const options = req.validatedQuery;

            const result = await this.reviewService.getUserReviews(userId, options);

            logger.info('User reviews fetched successfully', {
                userId,
                reviewCount: result.reviews.length,
                totalReviews: result.pagination.total,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                data: result,
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Get user reviews failed', {
                error: error.message,
                userId: req.user?.userId,
                options: req.validatedQuery,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to fetch user reviews',
                code: 'USER_REVIEWS_FETCH_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Admin: Get all reviews for moderation
    getAllReviewsForModeration = async (req, res) => {
        try {
            const options = req.validatedQuery;

            const result = await this.reviewService.getAllReviewsForModeration(options);

            logger.info('Reviews for moderation fetched successfully', {
                reviewCount: result.reviews.length,
                totalReviews: result.pagination.total,
                filters: result.filters,
                adminId: req.user.userId,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                data: result,
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Get reviews for moderation failed', {
                error: error.message,
                options: req.validatedQuery,
                adminId: req.user?.userId,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to fetch reviews for moderation',
                code: 'MODERATION_REVIEWS_FETCH_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Admin: Moderate a review
    moderateReview = async (req, res) => {
        try {
            const { reviewId } = req.params;
            const adminId = req.user.userId;
            const moderationData = req.validatedData;

            const review = await this.reviewService.moderateReview(reviewId, adminId, moderationData);

            logger.info('Review moderated successfully', {
                reviewId,
                adminId,
                isApproved: moderationData.isApproved,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                message: 'Review moderated successfully',
                data: { review },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Moderate review failed', {
                error: error.message,
                reviewId: req.params.reviewId,
                adminId: req.user?.userId,
                moderationData: req.validatedData,
                correlationId: req.correlationId
            });

            const statusCode = error.message.includes('not found') ? 404 : 500;

            res.status(statusCode).json({
                error: error.message,
                code: statusCode === 404 ? 'REVIEW_NOT_FOUND' : 'REVIEW_MODERATION_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };
}

module.exports = { ReviewController, reviewLimiter, reviewCreateLimiter };