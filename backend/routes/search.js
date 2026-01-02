const express = require('express');
const { SearchController, searchLimiter, recommendationLimiter } = require('../controllers/searchController');
const { authenticateToken, requireAdmin } = require('../auth/middleware');

const router = express.Router();

// Initialize controller
let searchController;

const initializeSearchRoutes = (dbPool, redisPool) => {
    searchController = new SearchController(dbPool, redisPool);
    return router;
};

// Search endpoints
router.get('/products', searchLimiter, (req, res) => {
    if (!searchController) {
        return res.status(503).json({ error: 'Search service not initialized' });
    }
    return searchController.searchProducts(req, res);
});

router.get('/suggestions', searchLimiter, (req, res) => {
    if (!searchController) {
        return res.status(503).json({ error: 'Search service not initialized' });
    }
    return searchController.getSearchSuggestions(req, res);
});

router.get('/popular-terms', searchLimiter, (req, res) => {
    if (!searchController) {
        return res.status(503).json({ error: 'Search service not initialized' });
    }
    return searchController.getPopularSearchTerms(req, res);
});

router.post('/products/:productId/click', searchLimiter, (req, res) => {
    if (!searchController) {
        return res.status(503).json({ error: 'Search service not initialized' });
    }
    return searchController.logProductClick(req, res);
});

// Recommendation endpoints
router.get('/recommendations/personalized',
    recommendationLimiter,
    authenticateToken,
    (req, res) => {
        if (!searchController) {
            return res.status(503).json({ error: 'Search service not initialized' });
        }
        return searchController.getPersonalizedRecommendations(req, res);
    }
);

router.get('/recommendations/also-bought/:productId',
    recommendationLimiter,
    (req, res) => {
        if (!searchController) {
            return res.status(503).json({ error: 'Search service not initialized' });
        }
        return searchController.getAlsoBoughtRecommendations(req, res);
    }
);

router.get('/recommendations/similar/:productId',
    recommendationLimiter,
    (req, res) => {
        if (!searchController) {
            return res.status(503).json({ error: 'Search service not initialized' });
        }
        return searchController.getSimilarProducts(req, res);
    }
);

router.get('/recommendations/popular',
    recommendationLimiter,
    (req, res) => {
        if (!searchController) {
            return res.status(503).json({ error: 'Search service not initialized' });
        }
        return searchController.getPopularProducts(req, res);
    }
);

router.get('/recommendations/trending',
    recommendationLimiter,
    (req, res) => {
        if (!searchController) {
            return res.status(503).json({ error: 'Search service not initialized' });
        }
        return searchController.getTrendingProducts(req, res);
    }
);

// Admin endpoints
router.post('/admin/reindex',
    searchLimiter,
    authenticateToken,
    requireAdmin,
    (req, res) => {
        if (!searchController) {
            return res.status(503).json({ error: 'Search service not initialized' });
        }
        return searchController.reindexProducts(req, res);
    }
);

module.exports = { router, initializeSearchRoutes };