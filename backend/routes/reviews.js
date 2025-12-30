const express = require('express');
const { ReviewController, reviewLimiter, reviewCreateLimiter } = require('../controllers/reviewController');
const { authenticateToken, requireAdmin, requireCustomerOrAdmin, optionalAuth } = require('../auth/middleware');
const {
    validate,
    createReviewSchema,
    updateReviewSchema,
    reviewQuerySchema,
    reviewHelpfulnessSchema,
    reportReviewSchema,
    userReviewsQuerySchema,
    moderationQuerySchema,
    reviewModerationSchema
} = require('../validation/reviewValidation');

const router = express.Router();

// Initialize controller - will be set when routes are mounted
let reviewController = null;

const initializeController = (dbPool, redisPool, webSocketService = null, emailService = null) => {
    reviewController = new ReviewController(dbPool, redisPool, webSocketService, emailService);
};

// Public routes (no authentication required)

// Get reviews for a specific product
router.get('/products/:productId(\\d+)',
    reviewLimiter,
    validate(reviewQuerySchema),
    (req, res) => reviewController.getProductReviews(req, res)
);

// Get review statistics for a specific product
router.get('/products/:productId(\\d+)/stats',
    reviewLimiter,
    (req, res) => reviewController.getProductReviewStats(req, res)
);

// Protected routes (authentication required)

// Create a review for a product
router.post('/products/:productId(\\d+)',
    reviewCreateLimiter,
    authenticateToken,
    requireCustomerOrAdmin,
    validate(createReviewSchema),
    (req, res) => reviewController.createReview(req, res)
);

// Update a review
router.put('/:reviewId(\\d+)',
    reviewLimiter,
    authenticateToken,
    requireCustomerOrAdmin,
    validate(updateReviewSchema),
    (req, res) => reviewController.updateReview(req, res)
);

// Delete a review
router.delete('/:reviewId(\\d+)',
    reviewLimiter,
    authenticateToken,
    requireCustomerOrAdmin,
    (req, res) => reviewController.deleteReview(req, res)
);

// Mark review as helpful/not helpful
router.post('/:reviewId(\\d+)/helpful',
    reviewLimiter,
    authenticateToken,
    requireCustomerOrAdmin,
    validate(reviewHelpfulnessSchema),
    (req, res) => reviewController.markReviewHelpful(req, res)
);

// Report a review
router.post('/:reviewId(\\d+)/report',
    reviewLimiter,
    authenticateToken,
    requireCustomerOrAdmin,
    validate(reportReviewSchema),
    (req, res) => reviewController.reportReview(req, res)
);

// Get current user's reviews
router.get('/my-reviews',
    reviewLimiter,
    authenticateToken,
    requireCustomerOrAdmin,
    validate(userReviewsQuerySchema),
    (req, res) => reviewController.getUserReviews(req, res)
);

// Admin routes (admin authentication required)

// Get all reviews for moderation
router.get('/admin/moderation',
    reviewLimiter,
    authenticateToken,
    requireAdmin,
    validate(moderationQuerySchema),
    (req, res) => reviewController.getAllReviewsForModeration(req, res)
);

// Moderate a review (approve/reject)
router.patch('/admin/:reviewId(\\d+)/moderate',
    reviewLimiter,
    authenticateToken,
    requireAdmin,
    validate(reviewModerationSchema),
    (req, res) => reviewController.moderateReview(req, res)
);

module.exports = { router, initializeController };