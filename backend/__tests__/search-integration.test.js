const request = require('supertest');
const app = require('../index');

describe('Search Integration Test', () => {
    it('should return search results with fallback to database', async () => {
        const response = await request(app)
            .get('/api/search/recommendations/popular')
            .query({ limit: 5 });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('recommendations');
        expect(Array.isArray(response.body.data.recommendations)).toBe(true);
    });

    it('should handle search suggestions gracefully', async () => {
        const response = await request(app)
            .get('/api/search/suggestions')
            .query({ q: 'te', limit: 5 });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('suggestions');
        expect(Array.isArray(response.body.data.suggestions)).toBe(true);
    });
});