const ReviewService = require('../services/reviewService');
const reviewController = require('../controllers/reviewController');
const {
    createReviewSchema,
    updateReviewSchema,
    voteHelpfulSchema,
    reportReviewSchema
} = require('../validation/reviewValidation');

// Mock the database and services
jest.mock('../database');
jest.mock('../redis');
jest.mock('../services/websocketService');
jest.mock('../services/emailService');
jest.mock('../services/emailSchedulerService');

describe('Review System Components', () => {
    describe('Review Service', () => {
        test('should be properly exported', () => {
            expect(ReviewService).toBeDefined();
            expect(typeof ReviewService).toBe('function');
        });

        test('should have required methods', () => {
            const mockDbPool = { query: jest.fn() };
            const reviewService = new ReviewService(mockDbPool);

            expect(typeof reviewService.createReview).toBe('function');
            expect(typeof reviewService.getProductReviews).toBe('function');
            expect(typeof reviewService.getReviewStats).toBe('function');
            expect(typeof reviewService.voteHelpful).toBe('function');
            expect(typeof reviewService.reportReview).toBe('function');
            expect(typeof reviewService.moderateReview).toBe('function');
        });
    });

    describe('Review Controller', () => {
        test('should be properly exported', () => {
            expect(reviewController).toBeDefined();
            expect(typeof reviewController.createReview).toBe('function');
            expect(typeof reviewController.getProductReviews).toBe('function');
            expect(typeof reviewController.getReviewStats).toBe('function');
            expect(typeof reviewController.voteHelpful).toBe('function');
            expect(typeof reviewController.reportReview).toBe('function');
        });
    });

    describe('Review Validation', () => {
        test('should validate review creation data', () => {
            const validData = {
                productId: 1,
                rating: 5,
                title: 'Great product',
                reviewText: 'This is a great product!'
            };

            const { error } = createReviewSchema.validate(validData);
            expect(error).toBeUndefined();
        });

        test('should reject invalid rating', () => {
            const invalidData = {
                productId: 1,
                rating: 6, // Invalid rating
                reviewText: 'This is a review'
            };

            const { error } = createReviewSchema.validate(invalidData);
            expect(error).toBeDefined();
        });

        test('should validate helpful vote data', () => {
            const validData = { isHelpful: true };

            const { error } = voteHelpfulSchema.validate(validData);
            expect(error).toBeUndefined();
        });

        test('should validate report data', () => {
            const validData = {
                reason: 'spam',
                description: 'This looks like spam'
            };

            const { error } = reportReviewSchema.validate(validData);
            expect(error).toBeUndefined();
        });

        test('should reject invalid report reason', () => {
            const invalidData = {
                reason: 'invalid_reason',
                description: 'This is invalid'
            };

            const { error } = reportReviewSchema.validate(invalidData);
            expect(error).toBeDefined();
        });
    });

    describe('Review Service Methods', () => {
        let reviewService;
        let mockDbPool;

        beforeEach(() => {
            mockDbPool = {
                query: jest.fn()
            };
            reviewService = new ReviewService(mockDbPool);
        });

        test('createReview should handle valid input', async () => {
            const reviewData = {
                productId: 1,
                userId: 1,
                rating: 5,
                title: 'Great product',
                reviewText: 'This is excellent!'
            };

            mockDbPool.query
                .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Product' }] }) // Product exists
                .mockResolvedValueOnce({ rows: [] }) // No existing review
                .mockResolvedValueOnce({ rows: [{ id: 1, ...reviewData }] }); // Insert review

            const result = await reviewService.createReview(reviewData);
            expect(result).toBeDefined();
            expect(mockDbPool.query).toHaveBeenCalledTimes(3);
        });

        test('getProductReviews should return paginated results', async () => {
            const mockReviews = [
                { id: 1, rating: 5, title: 'Great', review_text: 'Excellent product' },
                { id: 2, rating: 4, title: 'Good', review_text: 'Nice product' }
            ];

            mockDbPool.query
                .mockResolvedValueOnce({ rows: mockReviews })
                .mockResolvedValueOnce({ rows: [{ count: '2' }] });

            const result = await reviewService.getProductReviews(1, {
                page: 1,
                limit: 10,
                sortBy: 'created_at',
                sortOrder: 'DESC'
            });

            expect(result.reviews).toEqual(mockReviews);
            expect(result.pagination.total).toBe(2);
        });

        test('getReviewStats should calculate statistics', async () => {
            const mockStats = {
                reviewCount: 10,
                averageRating: 4.5,
                ratingDistribution: { '1': 0, '2': 1, '3': 2, '4': 3, '5': 4 }
            };

            mockDbPool.query.mockResolvedValueOnce({ rows: [mockStats] });

            const result = await reviewService.getReviewStats(1);
            expect(result.stats).toEqual(mockStats);
        });
    });
});