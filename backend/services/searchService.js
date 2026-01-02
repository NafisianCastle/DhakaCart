const { Client } = require('@elastic/elasticsearch');
const logger = require('../logger');

class SearchService {
    constructor(dbPool, redisPool) {
        this.db = dbPool;
        this.redis = redisPool;
        this.client = new Client({
            node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
            auth: process.env.ELASTICSEARCH_AUTH ? {
                username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
                password: process.env.ELASTICSEARCH_PASSWORD
            } : undefined,
            requestTimeout: 30000,
            pingTimeout: 3000,
            maxRetries: 3
        });

        this.productIndex = 'products';
        this.searchAnalyticsIndex = 'search_analytics';
        this.cachePrefix = 'search:';
        this.cacheTTL = 300; // 5 minutes

        this.initializeIndices();
    }

    async initializeIndices() {
        try {
            // Check if Elasticsearch is available
            await this.client.ping();
            logger.info('Elasticsearch connection established');

            // Create product index if it doesn't exist
            await this.createProductIndex();

            // Create search analytics index if it doesn't exist
            await this.createSearchAnalyticsIndex();

            // Index existing products
            await this.indexAllProducts();
        } catch (error) {
            logger.warn('Elasticsearch not available, search features will be limited', {
                error: error.message
            });
        }
    }

    async createProductIndex() {
        try {
            const exists = await this.client.indices.exists({ index: this.productIndex });

            if (!exists) {
                await this.client.indices.create({
                    index: this.productIndex,
                    body: {
                        settings: {
                            analysis: {
                                analyzer: {
                                    product_analyzer: {
                                        type: 'custom',
                                        tokenizer: 'standard',
                                        filter: ['lowercase', 'stop', 'snowball']
                                    }
                                }
                            }
                        },
                        mappings: {
                            properties: {
                                id: { type: 'integer' },
                                name: {
                                    type: 'text',
                                    analyzer: 'product_analyzer',
                                    fields: {
                                        keyword: { type: 'keyword' },
                                        suggest: { type: 'completion' }
                                    }
                                },
                                description: {
                                    type: 'text',
                                    analyzer: 'product_analyzer'
                                },
                                price: { type: 'float' },
                                stock_quantity: { type: 'integer' },
                                category_id: { type: 'integer' },
                                category_name: {
                                    type: 'text',
                                    fields: { keyword: { type: 'keyword' } }
                                },
                                category_slug: { type: 'keyword' },
                                image_url: { type: 'keyword' },
                                slug: { type: 'keyword' },
                                sku: { type: 'keyword' },
                                is_active: { type: 'boolean' },
                                created_at: { type: 'date' },
                                updated_at: { type: 'date' },
                                popularity_score: { type: 'float' },
                                rating_average: { type: 'float' },
                                rating_count: { type: 'integer' }
                            }
                        }
                    }
                });

                logger.info('Product index created successfully');
            }
        } catch (error) {
            logger.error('Error creating product index', { error: error.message });
            throw error;
        }
    }

    async createSearchAnalyticsIndex() {
        try {
            const exists = await this.client.indices.exists({ index: this.searchAnalyticsIndex });

            if (!exists) {
                await this.client.indices.create({
                    index: this.searchAnalyticsIndex,
                    body: {
                        mappings: {
                            properties: {
                                query: {
                                    type: 'text',
                                    fields: { keyword: { type: 'keyword' } }
                                },
                                user_id: { type: 'integer' },
                                results_count: { type: 'integer' },
                                clicked_product_id: { type: 'integer' },
                                session_id: { type: 'keyword' },
                                ip_address: { type: 'ip' },
                                user_agent: { type: 'text' },
                                timestamp: { type: 'date' }
                            }
                        }
                    }
                });

                logger.info('Search analytics index created successfully');
            }
        } catch (error) {
            logger.error('Error creating search analytics index', { error: error.message });
            throw error;
        }
    }

    async indexAllProducts() {
        try {
            // Get all active products from database
            const result = await this.db.query(`
                SELECT p.*, c.name as category_name, c.slug as category_slug,
                       COALESCE(AVG(r.rating), 0) as rating_average,
                       COUNT(r.id) as rating_count
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN reviews r ON p.id = r.product_id AND r.is_approved = true
                WHERE p.is_active = true
                GROUP BY p.id, c.name, c.slug
            `);

            if (result.rows.length === 0) {
                logger.info('No products to index');
                return;
            }

            // Prepare bulk index operations
            const body = [];
            for (const product of result.rows) {
                body.push({ index: { _index: this.productIndex, _id: product.id } });
                body.push({
                    ...product,
                    popularity_score: await this.calculatePopularityScore(product.id),
                    rating_average: parseFloat(product.rating_average) || 0,
                    rating_count: parseInt(product.rating_count) || 0
                });
            }

            // Bulk index products
            const response = await this.client.bulk({ body });

            if (response.errors) {
                logger.error('Errors occurred during bulk indexing', { errors: response.items });
            } else {
                logger.info('Products indexed successfully', { count: result.rows.length });
            }
        } catch (error) {
            logger.error('Error indexing products', { error: error.message });
        }
    }

    async indexProduct(productId) {
        try {
            // Get product data from database
            const result = await this.db.query(`
                SELECT p.*, c.name as category_name, c.slug as category_slug,
                       COALESCE(AVG(r.rating), 0) as rating_average,
                       COUNT(r.id) as rating_count
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN reviews r ON p.id = r.product_id AND r.is_approved = true
                WHERE p.id = $1
                GROUP BY p.id, c.name, c.slug
            `, [productId]);

            if (result.rows.length === 0) {
                logger.warn('Product not found for indexing', { productId });
                return;
            }

            const product = result.rows[0];

            await this.client.index({
                index: this.productIndex,
                id: productId,
                body: {
                    ...product,
                    popularity_score: await this.calculatePopularityScore(productId),
                    rating_average: parseFloat(product.rating_average) || 0,
                    rating_count: parseInt(product.rating_count) || 0
                }
            });

            logger.info('Product indexed successfully', { productId });
        } catch (error) {
            logger.error('Error indexing product', { error: error.message, productId });
        }
    }

    async removeProduct(productId) {
        try {
            await this.client.delete({
                index: this.productIndex,
                id: productId
            });

            logger.info('Product removed from index', { productId });
        } catch (error) {
            if (error.meta?.statusCode !== 404) {
                logger.error('Error removing product from index', { error: error.message, productId });
            }
        }
    }

    async searchProducts(query, filters = {}) {
        const {
            page = 1,
            limit = 20,
            category,
            minPrice,
            maxPrice,
            sortBy = 'relevance',
            userId = null,
            sessionId = null,
            ipAddress = null,
            userAgent = null
        } = filters;

        try {
            const cacheKey = `${this.cachePrefix}${JSON.stringify({ query, ...filters })}`;

            // Try cache first
            if (this.redis && this.redis.isConnected) {
                const cachedResult = await this.redis.getCachedData(cacheKey);
                if (cachedResult) {
                    logger.debug('Search results served from cache', { query, filters });
                    return cachedResult;
                }
            }

            const from = (page - 1) * limit;

            // Build Elasticsearch query
            const searchBody = {
                from,
                size: limit,
                query: {
                    bool: {
                        must: [
                            { term: { is_active: true } }
                        ],
                        should: [],
                        filter: []
                    }
                },
                highlight: {
                    fields: {
                        name: {},
                        description: {}
                    }
                }
            };

            // Add text search if query provided
            if (query && query.trim()) {
                searchBody.query.bool.should.push(
                    {
                        multi_match: {
                            query: query.trim(),
                            fields: ['name^3', 'description^1', 'category_name^2'],
                            type: 'best_fields',
                            fuzziness: 'AUTO'
                        }
                    },
                    {
                        match_phrase_prefix: {
                            name: {
                                query: query.trim(),
                                boost: 2
                            }
                        }
                    }
                );
                searchBody.query.bool.minimum_should_match = 1;
            } else {
                // If no query, match all active products
                searchBody.query.bool.must.push({ match_all: {} });
            }

            // Add filters
            if (category) {
                searchBody.query.bool.filter.push({
                    term: { category_slug: category }
                });
            }

            if (minPrice || maxPrice) {
                const priceRange = {};
                if (minPrice) priceRange.gte = minPrice;
                if (maxPrice) priceRange.lte = maxPrice;

                searchBody.query.bool.filter.push({
                    range: { price: priceRange }
                });
            }

            // Add sorting
            switch (sortBy) {
                case 'price_asc':
                    searchBody.sort = [{ price: { order: 'asc' } }];
                    break;
                case 'price_desc':
                    searchBody.sort = [{ price: { order: 'desc' } }];
                    break;
                case 'newest':
                    searchBody.sort = [{ created_at: { order: 'desc' } }];
                    break;
                case 'popularity':
                    searchBody.sort = [
                        { popularity_score: { order: 'desc' } },
                        { _score: { order: 'desc' } }
                    ];
                    break;
                case 'rating':
                    searchBody.sort = [
                        { rating_average: { order: 'desc' } },
                        { rating_count: { order: 'desc' } }
                    ];
                    break;
                default: // relevance
                    searchBody.sort = [
                        { _score: { order: 'desc' } },
                        { popularity_score: { order: 'desc' } }
                    ];
            }

            // Execute search
            const response = await this.client.search({
                index: this.productIndex,
                body: searchBody
            });

            const products = response.hits.hits.map(hit => ({
                ...hit._source,
                _score: hit._score,
                _highlight: hit.highlight
            }));

            const result = {
                products,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: response.hits.total.value,
                    totalPages: Math.ceil(response.hits.total.value / limit),
                    hasNext: from + limit < response.hits.total.value,
                    hasPrev: page > 1
                },
                query: query || '',
                filters: {
                    category,
                    minPrice,
                    maxPrice,
                    sortBy
                },
                took: response.took
            };

            // Cache the result
            if (this.redis && this.redis.isConnected) {
                await this.redis.setCachedData(cacheKey, result, this.cacheTTL);
            }

            // Log search analytics
            await this.logSearchAnalytics({
                query: query || '',
                userId,
                resultsCount: response.hits.total.value,
                sessionId,
                ipAddress,
                userAgent
            });

            logger.info('Search completed successfully', {
                query,
                resultsCount: response.hits.total.value,
                took: response.took,
                filters
            });

            return result;
        } catch (error) {
            logger.error('Search failed', { error: error.message, query, filters });

            // Fallback to database search
            return await this.fallbackDatabaseSearch(query, filters);
        }
    }

    async getSearchSuggestions(query, limit = 10) {
        try {
            if (!query || query.trim().length < 2) {
                return [];
            }

            const response = await this.client.search({
                index: this.productIndex,
                body: {
                    suggest: {
                        product_suggest: {
                            prefix: query.trim(),
                            completion: {
                                field: 'name.suggest',
                                size: limit
                            }
                        }
                    }
                }
            });

            const suggestions = response.suggest.product_suggest[0].options.map(option => ({
                text: option.text,
                score: option._score
            }));

            return suggestions;
        } catch (error) {
            logger.error('Error getting search suggestions', { error: error.message, query });
            return [];
        }
    }

    async getPopularSearchTerms(limit = 10, timeframe = '7d') {
        try {
            const response = await this.client.search({
                index: this.searchAnalyticsIndex,
                body: {
                    size: 0,
                    query: {
                        bool: {
                            must: [
                                { range: { timestamp: { gte: `now-${timeframe}` } } },
                                { range: { results_count: { gt: 0 } } }
                            ]
                        }
                    },
                    aggs: {
                        popular_terms: {
                            terms: {
                                field: 'query.keyword',
                                size: limit,
                                min_doc_count: 2
                            }
                        }
                    }
                }
            });

            const terms = response.aggregations.popular_terms.buckets.map(bucket => ({
                term: bucket.key,
                count: bucket.doc_count
            }));

            return terms;
        } catch (error) {
            logger.error('Error getting popular search terms', { error: error.message });
            return [];
        }
    }

    async logSearchAnalytics(data) {
        try {
            await this.client.index({
                index: this.searchAnalyticsIndex,
                body: {
                    ...data,
                    timestamp: new Date()
                }
            });
        } catch (error) {
            logger.error('Error logging search analytics', { error: error.message, data });
        }
    }

    async logProductClick(productId, query, userId, sessionId) {
        try {
            await this.client.index({
                index: this.searchAnalyticsIndex,
                body: {
                    query: query || '',
                    user_id: userId,
                    clicked_product_id: productId,
                    session_id: sessionId,
                    timestamp: new Date()
                }
            });

            logger.debug('Product click logged', { productId, query, userId });
        } catch (error) {
            logger.error('Error logging product click', { error: error.message, productId, query });
        }
    }

    async calculatePopularityScore(productId) {
        try {
            // Get order count for the product (last 30 days)
            const orderResult = await this.db.query(`
                SELECT COUNT(*) as order_count,
                       SUM(oi.quantity) as total_quantity
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                WHERE oi.product_id = $1 
                AND o.created_at >= NOW() - INTERVAL '30 days'
                AND o.status NOT IN ('cancelled')
            `, [productId]);

            const orderCount = parseInt(orderResult.rows[0].order_count) || 0;
            const totalQuantity = parseInt(orderResult.rows[0].total_quantity) || 0;

            // Get view count from search analytics (last 30 days)
            let viewCount = 0;
            try {
                const viewResult = await this.client.count({
                    index: this.searchAnalyticsIndex,
                    body: {
                        query: {
                            bool: {
                                must: [
                                    { term: { clicked_product_id: productId } },
                                    { range: { timestamp: { gte: 'now-30d' } } }
                                ]
                            }
                        }
                    }
                });
                viewCount = viewResult.count || 0;
            } catch (esError) {
                // Elasticsearch not available, use 0
            }

            // Calculate popularity score (weighted combination)
            const popularityScore = (orderCount * 10) + (totalQuantity * 5) + (viewCount * 1);

            return popularityScore;
        } catch (error) {
            logger.error('Error calculating popularity score', { error: error.message, productId });
            return 0;
        }
    }

    async fallbackDatabaseSearch(query, filters) {
        try {
            const {
                page = 1,
                limit = 20,
                category,
                minPrice,
                maxPrice,
                sortBy = 'relevance'
            } = filters;

            const offset = (page - 1) * limit;

            let searchQuery = `
                SELECT p.*, c.name as category_name, c.slug as category_slug
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.is_active = true
            `;
            let params = [];
            let paramCount = 0;

            // Add text search
            if (query && query.trim()) {
                paramCount++;
                searchQuery += ` AND (
                    p.name ILIKE $${paramCount} OR 
                    p.description ILIKE $${paramCount} OR
                    to_tsvector('english', p.name || ' ' || COALESCE(p.description, '')) @@ plainto_tsquery('english', $${paramCount})
                )`;
                params.push(`%${query.trim()}%`);
            }

            // Add filters
            if (category) {
                paramCount++;
                searchQuery += ` AND c.slug = $${paramCount}`;
                params.push(category);
            }

            if (minPrice) {
                paramCount++;
                searchQuery += ` AND p.price >= $${paramCount}`;
                params.push(minPrice);
            }

            if (maxPrice) {
                paramCount++;
                searchQuery += ` AND p.price <= $${paramCount}`;
                params.push(maxPrice);
            }

            // Add sorting
            switch (sortBy) {
                case 'price_asc':
                    searchQuery += ' ORDER BY p.price ASC';
                    break;
                case 'price_desc':
                    searchQuery += ' ORDER BY p.price DESC';
                    break;
                case 'newest':
                    searchQuery += ' ORDER BY p.created_at DESC';
                    break;
                default:
                    searchQuery += ' ORDER BY p.created_at DESC';
            }

            // Add pagination
            paramCount++;
            searchQuery += ` LIMIT $${paramCount}`;
            params.push(limit);

            paramCount++;
            searchQuery += ` OFFSET $${paramCount}`;
            params.push(offset);

            const result = await this.db.query(searchQuery, params);

            // Get total count
            let countQuery = `
                SELECT COUNT(*) as total
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.is_active = true
            `;
            let countParams = [];
            let countParamCount = 0;

            if (query && query.trim()) {
                countParamCount++;
                countQuery += ` AND (
                    p.name ILIKE $${countParamCount} OR 
                    p.description ILIKE $${countParamCount} OR
                    to_tsvector('english', p.name || ' ' || COALESCE(p.description, '')) @@ plainto_tsquery('english', $${countParamCount})
                )`;
                countParams.push(`%${query.trim()}%`);
            }

            if (category) {
                countParamCount++;
                countQuery += ` AND c.slug = $${countParamCount}`;
                countParams.push(category);
            }

            if (minPrice) {
                countParamCount++;
                countQuery += ` AND p.price >= $${countParamCount}`;
                countParams.push(minPrice);
            }

            if (maxPrice) {
                countParamCount++;
                countQuery += ` AND p.price <= $${countParamCount}`;
                countParams.push(maxPrice);
            }

            const countResult = await this.db.query(countQuery, countParams);
            const total = parseInt(countResult.rows[0]?.total || 0);

            return {
                products: result.rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasNext: page * limit < total,
                    hasPrev: page > 1
                },
                query: query || '',
                filters: {
                    category,
                    minPrice,
                    maxPrice,
                    sortBy
                },
                fallback: true
            };
        } catch (error) {
            logger.error('Fallback database search failed', { error: error.message, query, filters });
            throw error;
        }
    }
}

module.exports = SearchService;