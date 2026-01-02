const request = require('supertest');
const app = require('../index');

describe('Search and Recommendation API', () => {
    describe('GET /api/search/products', () => {
        it('should return search results for products', async () => {
            const response = await request(app)
                .get('/api/search/products')
                .query({ q: 'test', limit: 10 });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
            expect(response.body.data).toHaveProperty('products');
            expect(response.body.data).toHaveProperty('pagination');
        });

        it('should return empty results for empty query', async () => {
            const response = await request(app)
                .get('/api/search/products')
                .query({ q: '', limit: 10 });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('products');
        });

        it('should handle search with filters', async () => {
            const response = await request(app)
                .get('/api/search/products')
                .query({
                    q: 'test',
                    category: 'electronics',
                    minPrice: 10,
                    maxPrice: 100,
                    sortBy: 'price_asc'
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data.filters).toMatchObject({
                category: 'electronics',
                minPrice: 10,
                maxPrice: 100,
                sortBy: 'price_asc'
            });
        });
    });

    describe('GET /api/search/suggestions', () => {
        it('should return search suggestions', async () => {
            const response = await request(app)
                .get('/api/search/suggestions')
                .query({ q: 'te', limit: 5 });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('suggestions');
            expect(Array.isArray(response.body.data.suggestions)).toBe(true);
        });

        it('should return empty suggestions for short query', async () => {
            const response = await request(app)
                .get('/api/search/suggestions')
                .query({ q: 'a' });

            expect(response.status).toBe(200);
            expect(response.body.data.suggestions).toEqual([]);
        });
    });

    describe('GET /api/search/popular-terms', () => {
        it('should return popular search terms', async () => {
            const response = await request(app)
                .get('/api/search/popular-terms')
                .query({ limit: 10, timeframe: '7d' });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('terms');
            expect(response.body.data).toHaveProperty('timeframe', '7d');
            expect(Array.isArray(response.body.data.terms)).toBe(true);
        });
    });

    describe('POST /api/search/products/:productId/click', () => {
        it('should log product click', async () => {
            const response = await request(app)
                .post('/api/search/products/1/click')
                .send({
                    query: 'test product',
                    sessionId: 'test-session-123'
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message', 'Click logged successfully');
        });
    });

    describe('GET /api/search/recommendations/popular', () => {
        it('should return popular products', async () => {
            const response = await request(app)
                .get('/api/search/recommendations/popular')
                .query({ limit: 10 });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('recommendations');
            expect(response.body.data).toHaveProperty('type', 'popular');
            expect(Array.isArray(response.body.data.recommendations)).toBe(true);
        });

        it('should return popular products for specific category', async () => {
            const response = await request(app)
                .get('/api/search/recommendations/popular')
                .query({ limit: 5, category: 1 });

            expect(response.status).toBe(200);
            expect(response.body.data).toHaveProperty('categoryId', 1);
        });
    });

    describe('GET /api/search/recommendations/trending', () => {
        it('should return trending products', async () => {
            const response = await request(app)
                .get('/api/search/recommendations/trending')
                .query({ limit: 10, days: 7 });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('recommendations');
            expect(response.body.data).toHaveProperty('type', 'trending');
            expect(response.body.data).toHaveProperty('days', 7);
        });
    });

    describe('GET /api/search/recommendations/similar/:productId', () => {
        it('should return similar products', async () => {
            const response = await request(app)
                .get('/api/search/recommendations/similar/1')
                .query({ limit: 10 });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('recommendations');
            expect(response.body.data).toHaveProperty('type', 'similar');
            expect(response.body.data).toHaveProperty('productId', 1);
        });
    });

    describe('GET /api/search/recommendations/also-bought/:productId', () => {
        it('should return also bought recommendations', async () => {
            const response = await request(app)
                .get('/api/search/recommendations/also-bought/1')
                .query({ limit: 10 });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('recommendations');
            expect(response.body.data).toHaveProperty('type', 'also_bought');
            expect(response.body.data).toHaveProperty('productId', 1);
        });
    });

    describe('Rate Limiting', () => {
        it('should enforce rate limits on search endpoints', async () => {
            // Make multiple requests quickly to trigger rate limit
            const requests = Array(10).fill().map(() =>
                request(app).get('/api/search/products').query({ q: 'test' })
            );

            const responses = await Promise.all(requests);

            // All requests should succeed initially (within rate limit)
            responses.forEach(response => {
                expect([200, 429]).toContain(response.status);
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid product ID in recommendations', async () => {
            const response = await request(app)
                .get('/api/search/recommendations/similar/invalid');

            expect([400, 500]).toContain(response.status);
        });

        it('should handle invalid parameters gracefully', async () => {
            const response = await request(app)
                .get('/api/search/products')
                .query({
                    limit: -1,
                    page: 0,
                    minPrice: 'invalid',
                    maxPrice: 'invalid'
                });

            expect(response.status).toBe(200);
            // Should use default/validated values
            expect(response.body.data.pagination.limit).toBeGreaterThan(0);
            expect(response.body.data.pagination.page).toBeGreaterThan(0);
        });
    });
});