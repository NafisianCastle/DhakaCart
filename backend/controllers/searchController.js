const SearchService = require('../services/searchService');
const RecommendationService = require('../services/recommendationService');
const logger = require('../logger');
const rateLimit = require('express-rate-limit');

// Rate limiting for search endpoints
const searchLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // limit each IP to 200 search requests per windowMs
    message: {
        error: 'Too many search requests, please try again later',
        code: 'RATE_LIMIT_EXCEEDED'
    }
});

const recommendationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 recommendation requests per windowMs
    message: {
        error: 'Too many recommendation requests, please try again later',
        code: 'RATE_LIMIT_EXCEEDED'
    }
});

class SearchController {
    constructor(dbPool, redisPool) {
        this.searchService = new SearchService(dbPool, redisPool);
        this.recommendationService = new RecommendationService(dbPool, redisPool);
    }

    // Advanced product search with Elasticsearch
    searchProducts = async (req, res) => {
        try {
            const {
                q: query = '',
                page = 1,
                limit = 20,
                category,
                minPrice,
                maxPrice,
                sortBy = 'relevance'
            } = req.query;

            // Validate parameters
            const validatedFilters = {
                page: Math.max(1, parseInt(page)),
                limit: Math.min(100, Math.max(1, parseInt(limit))),
                category: category || null,
                minPrice: minPrice ? parseFloat(minPrice) : null,
                maxPrice: maxPrice ? parseFloat(maxPrice) : null,
                sortBy: ['relevance', 'price_asc', 'price_desc', 'newest', 'popularity', 'rating'].includes(sortBy)
                    ? sortBy : 'relevance',
                userId: req.user?.userId || null,
                sessionId: req.sessionID || null,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            };

            const result = await this.searchService.searchProducts(query, validatedFilters);

            logger.info('Product search completed', {
                query,
                resultsCount: result.pagination.total,
                took: result.took,
                fallback: result.fallback || false,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                data: result,
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Product search failed', {
                error: error.message,
                query: req.query.q,
                filters: req.query,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Search failed',
                code: 'SEARCH_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Get search suggestions/autocomplete
    getSearchSuggestions = async (req, res) => {
        try {
            const { q: query = '', limit = 10 } = req.query;

            if (!query || query.trim().length < 2) {
                return res.json({
                    success: true,
                    data: { suggestions: [] },
                    timestamp: new Date().toISOString(),
                    correlationId: req.correlationId
                });
            }

            const validatedLimit = Math.min(20, Math.max(1, parseInt(limit)));
            const suggestions = await this.searchService.getSearchSuggestions(query, validatedLimit);

            logger.debug('Search suggestions generated', {
                query,
                count: suggestions.length,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                data: { suggestions },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Search suggestions failed', {
                error: error.message,
                query: req.query.q,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to get search suggestions',
                code: 'SUGGESTIONS_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Get popular search terms
    getPopularSearchTerms = async (req, res) => {
        try {
            const { limit = 10, timeframe = '7d' } = req.query;

            const validatedLimit = Math.min(50, Math.max(1, parseInt(limit)));
            const validTimeframes = ['1d', '7d', '30d', '90d'];
            const validatedTimeframe = validTimeframes.includes(timeframe) ? timeframe : '7d';

            const terms = await this.searchService.getPopularSearchTerms(validatedLimit, validatedTimeframe);

            logger.info('Popular search terms retrieved', {
                count: terms.length,
                timeframe: validatedTimeframe,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                data: {
                    terms,
                    timeframe: validatedTimeframe
                },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Failed to get popular search terms', {
                error: error.message,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to get popular search terms',
                code: 'POPULAR_TERMS_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Log product click for analytics
    logProductClick = async (req, res) => {
        try {
            const { productId } = req.params;
            const { query = '', sessionId } = req.body;

            await this.searchService.logProductClick(
                parseInt(productId),
                query,
                req.user?.userId || null,
                sessionId || req.sessionID
            );

            logger.debug('Product click logged', {
                productId,
                query,
                userId: req.user?.userId,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                message: 'Click logged successfully',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Failed to log product click', {
                error: error.message,
                productId: req.params.productId,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to log click',
                code: 'CLICK_LOG_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Get personalized recommendations
    getPersonalizedRecommendations = async (req, res) => {
        try {
            const { limit = 10, exclude } = req.query;
            const userId = req.user?.userId;

            if (!userId) {
                return res.status(401).json({
                    error: 'Authentication required for personalized recommendations',
                    code: 'AUTH_REQUIRED',
                    timestamp: new Date().toISOString(),
                    correlationId: req.correlationId
                });
            }

            const validatedLimit = Math.min(50, Math.max(1, parseInt(limit)));
            const excludeProductIds = exclude ? exclude.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : [];

            const recommendations = await this.recommendationService.getPersonalizedRecommendations(
                userId,
                { limit: validatedLimit, excludeProductIds }
            );

            logger.info('Personalized recommendations generated', {
                userId,
                count: recommendations.length,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                data: {
                    recommendations,
                    type: 'personalized'
                },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Failed to get personalized recommendations', {
                error: error.message,
                userId: req.user?.userId,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to get recommendations',
                code: 'RECOMMENDATIONS_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Get "customers who bought this also bought" recommendations
    getAlsoBoughtRecommendations = async (req, res) => {
        try {
            const { productId } = req.params;
            const { limit = 10, exclude } = req.query;

            const validatedLimit = Math.min(50, Math.max(1, parseInt(limit)));
            const excludeProductIds = exclude ? exclude.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : [];

            const recommendations = await this.recommendationService.getCustomersWhoBoughtAlsoBoought(
                parseInt(productId),
                { limit: validatedLimit, excludeProductIds }
            );

            logger.info('Also bought recommendations generated', {
                productId,
                count: recommendations.length,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                data: {
                    recommendations,
                    type: 'also_bought',
                    productId: parseInt(productId)
                },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Failed to get also bought recommendations', {
                error: error.message,
                productId: req.params.productId,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to get recommendations',
                code: 'RECOMMENDATIONS_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Get similar products
    getSimilarProducts = async (req, res) => {
        try {
            const { productId } = req.params;
            const { limit = 10, exclude } = req.query;

            const validatedLimit = Math.min(50, Math.max(1, parseInt(limit)));
            const excludeProductIds = exclude ? exclude.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : [];

            const recommendations = await this.recommendationService.getSimilarProducts(
                parseInt(productId),
                { limit: validatedLimit, excludeProductIds }
            );

            logger.info('Similar products generated', {
                productId,
                count: recommendations.length,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                data: {
                    recommendations,
                    type: 'similar',
                    productId: parseInt(productId)
                },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Failed to get similar products', {
                error: error.message,
                productId: req.params.productId,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to get similar products',
                code: 'SIMILAR_PRODUCTS_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Get popular products
    getPopularProducts = async (req, res) => {
        try {
            const { limit = 10, category, exclude } = req.query;

            const validatedLimit = Math.min(50, Math.max(1, parseInt(limit)));
            const categoryId = category ? parseInt(category) : null;
            const excludeProductIds = exclude ? exclude.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : [];

            const recommendations = await this.recommendationService.getPopularProducts({
                limit: validatedLimit,
                categoryId,
                excludeProductIds
            });

            logger.info('Popular products generated', {
                categoryId,
                count: recommendations.length,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                data: {
                    recommendations,
                    type: 'popular',
                    categoryId
                },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Failed to get popular products', {
                error: error.message,
                categoryId: req.query.category,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to get popular products',
                code: 'POPULAR_PRODUCTS_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Get trending products
    getTrendingProducts = async (req, res) => {
        try {
            const { limit = 10, days = 7, exclude } = req.query;

            const validatedLimit = Math.min(50, Math.max(1, parseInt(limit)));
            const validatedDays = Math.min(90, Math.max(1, parseInt(days)));
            const excludeProductIds = exclude ? exclude.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : [];

            const recommendations = await this.recommendationService.getTrendingProducts({
                limit: validatedLimit,
                days: validatedDays,
                excludeProductIds
            });

            logger.info('Trending products generated', {
                days: validatedDays,
                count: recommendations.length,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                data: {
                    recommendations,
                    type: 'trending',
                    days: validatedDays
                },
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Failed to get trending products', {
                error: error.message,
                days: req.query.days,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to get trending products',
                code: 'TRENDING_PRODUCTS_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };

    // Admin endpoint to reindex all products
    reindexProducts = async (req, res) => {
        try {
            await this.searchService.indexAllProducts();

            logger.info('Products reindexed successfully', {
                adminId: req.user.userId,
                correlationId: req.correlationId
            });

            res.json({
                success: true,
                message: 'Products reindexed successfully',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        } catch (error) {
            logger.error('Failed to reindex products', {
                error: error.message,
                adminId: req.user?.userId,
                correlationId: req.correlationId
            });

            res.status(500).json({
                error: 'Failed to reindex products',
                code: 'REINDEX_FAILED',
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        }
    };
}

module.exports = { SearchController, searchLimiter, recommendationLimiter };