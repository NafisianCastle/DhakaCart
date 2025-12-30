const { createClient } = require('redis');
const logger = require('./logger');

class RedisConnectionPool {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.connectionAttempts = 0;
        this.maxRetries = 5;
        this.retryDelay = 1000; // Start with 1 second
        this.maxRetryDelay = 30000; // Max 30 seconds
    }

    async initialize() {
        try {
            const redisConfig = this.getRedisConfig();

            if (!redisConfig) {
                logger.warn('Redis configuration not found, skipping Redis initialization');
                return null;
            }

            this.client = createClient(redisConfig);
            this.setupEventHandlers();

            await this.connect();
            return this.client;
        } catch (error) {
            logger.error('Failed to initialize Redis connection pool', {
                error: error.message,
                stack: error.stack
            });
            return null;
        }
    }

    getRedisConfig() {
        // Check for AWS Secrets Manager configuration first
        if (process.env.REDIS_SECRET_ARN) {
            // This would be handled by External Secrets Operator in Kubernetes
            // For now, fall back to environment variables
            logger.info('Redis secret ARN found, using environment variables populated by External Secrets Operator');
        }

        // Direct Redis URL (for local development)
        if (process.env.REDIS_URL) {
            return {
                url: process.env.REDIS_URL,
                socket: {
                    connectTimeout: 5000,
                    lazyConnect: true,
                    keepAlive: true,
                    reconnectStrategy: (retries) => this.getReconnectDelay(retries)
                }
            };
        }

        // Individual Redis configuration parameters
        if (process.env.REDIS_HOST) {
            const config = {
                socket: {
                    host: process.env.REDIS_HOST,
                    port: parseInt(process.env.REDIS_PORT) || 6379,
                    connectTimeout: 5000,
                    lazyConnect: true,
                    keepAlive: true,
                    reconnectStrategy: (retries) => this.getReconnectDelay(retries)
                }
            };

            // Add authentication if provided
            if (process.env.REDIS_AUTH_TOKEN || process.env.REDIS_PASSWORD) {
                config.password = process.env.REDIS_AUTH_TOKEN || process.env.REDIS_PASSWORD;
            }

            // Add TLS configuration for AWS ElastiCache
            if (process.env.REDIS_TLS === 'true') {
                config.socket.tls = true;
            }

            return config;
        }

        return null;
    }

    getReconnectDelay(retries) {
        if (retries >= this.maxRetries) {
            logger.error(`Redis connection failed after ${this.maxRetries} attempts`);
            return false; // Stop retrying
        }

        // Exponential backoff with jitter
        const delay = Math.min(
            this.retryDelay * Math.pow(2, retries) + Math.random() * 1000,
            this.maxRetryDelay
        );

        logger.warn(`Redis reconnection attempt ${retries + 1}/${this.maxRetries} in ${delay}ms`);
        return delay;
    }

    setupEventHandlers() {
        this.client.on('connect', () => {
            logger.info('Redis client connecting...');
        });

        this.client.on('ready', () => {
            logger.info('Redis client ready and connected');
            this.isConnected = true;
            this.connectionAttempts = 0;
        });

        this.client.on('error', (err) => {
            logger.error('Redis client error', {
                error: err.message,
                code: err.code,
                errno: err.errno
            });
            this.isConnected = false;
        });

        this.client.on('end', () => {
            logger.info('Redis client connection ended');
            this.isConnected = false;
        });

        this.client.on('reconnecting', () => {
            this.connectionAttempts++;
            logger.info('Redis client reconnecting...', {
                attempt: this.connectionAttempts
            });
        });
    }

    async connect() {
        try {
            await this.client.connect();
            logger.info('Redis connection established successfully');
        } catch (error) {
            logger.error('Failed to connect to Redis', {
                error: error.message,
                code: error.code
            });
            throw error;
        }
    }

    async disconnect() {
        if (this.client && this.isConnected) {
            try {
                await this.client.quit();
                logger.info('Redis connection closed gracefully');
            } catch (error) {
                logger.warn('Error during Redis disconnect', { error: error.message });
                // Force close if graceful quit fails
                await this.client.disconnect();
            }
        }
    }

    // Health check method
    async healthCheck() {
        if (!this.client || !this.isConnected) {
            return {
                status: 'unhealthy',
                message: 'Redis client not connected'
            };
        }

        try {
            const start = Date.now();
            await this.client.ping();
            const responseTime = Date.now() - start;

            return {
                status: 'healthy',
                responseTime: `${responseTime}ms`,
                message: 'Redis connection is healthy'
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                message: `Redis health check failed: ${error.message}`
            };
        }
    }

    // Wrapper methods for common Redis operations with error handling
    async get(key) {
        if (!this.isConnected) {
            logger.warn('Redis not connected, skipping GET operation', { key });
            return null;
        }

        try {
            return await this.client.get(key);
        } catch (error) {
            logger.error('Redis GET operation failed', {
                key,
                error: error.message
            });
            return null;
        }
    }

    async set(key, value, options = {}) {
        if (!this.isConnected) {
            logger.warn('Redis not connected, skipping SET operation', { key });
            return false;
        }

        try {
            await this.client.set(key, value, options);
            return true;
        } catch (error) {
            logger.error('Redis SET operation failed', {
                key,
                error: error.message
            });
            return false;
        }
    }

    async del(key) {
        if (!this.isConnected) {
            logger.warn('Redis not connected, skipping DEL operation', { key });
            return false;
        }

        try {
            return await this.client.del(key);
        } catch (error) {
            logger.error('Redis DEL operation failed', {
                key,
                error: error.message
            });
            return false;
        }
    }

    async exists(key) {
        if (!this.isConnected) {
            logger.warn('Redis not connected, skipping EXISTS operation', { key });
            return false;
        }

        try {
            return await this.client.exists(key);
        } catch (error) {
            logger.error('Redis EXISTS operation failed', {
                key,
                error: error.message
            });
            return false;
        }
    }

    async expire(key, seconds) {
        if (!this.isConnected) {
            logger.warn('Redis not connected, skipping EXPIRE operation', { key });
            return false;
        }

        try {
            return await this.client.expire(key, seconds);
        } catch (error) {
            logger.error('Redis EXPIRE operation failed', {
                key,
                seconds,
                error: error.message
            });
            return false;
        }
    }

    // Session management methods
    async getSession(sessionId) {
        const sessionData = await this.get(`session:${sessionId}`);
        return sessionData ? JSON.parse(sessionData) : null;
    }

    async setSession(sessionId, sessionData, ttlSeconds = 3600) {
        const success = await this.set(
            `session:${sessionId}`,
            JSON.stringify(sessionData),
            { EX: ttlSeconds }
        );
        return success;
    }

    async deleteSession(sessionId) {
        return await this.del(`session:${sessionId}`);
    }

    // Cache management methods
    async getCachedData(key) {
        const cachedData = await this.get(`cache:${key}`);
        return cachedData ? JSON.parse(cachedData) : null;
    }

    async setCachedData(key, data, ttlSeconds = 300) {
        const success = await this.set(
            `cache:${key}`,
            JSON.stringify(data),
            { EX: ttlSeconds }
        );
        return success;
    }

    async invalidateCache(pattern) {
        if (!this.isConnected) {
            logger.warn('Redis not connected, skipping cache invalidation', { pattern });
            return false;
        }

        try {
            const keys = await this.client.keys(`cache:${pattern}`);
            if (keys.length > 0) {
                await this.client.del(keys);
                logger.info('Cache invalidated', { pattern, keysDeleted: keys.length });
            }
            return true;
        } catch (error) {
            logger.error('Cache invalidation failed', {
                pattern,
                error: error.message
            });
            return false;
        }
    }

    // Rate limiting methods
    async checkRateLimit(identifier, limit, windowSeconds) {
        if (!this.isConnected) {
            return { allowed: true, remaining: limit }; // Allow if Redis is down
        }

        try {
            const key = `rate_limit:${identifier}`;
            const current = await this.client.incr(key);

            if (current === 1) {
                await this.client.expire(key, windowSeconds);
            }

            const allowed = current <= limit;
            const remaining = Math.max(0, limit - current);

            return { allowed, remaining, current };
        } catch (error) {
            logger.error('Rate limit check failed', {
                identifier,
                error: error.message
            });
            return { allowed: true, remaining: limit }; // Allow if check fails
        }
    }
}

module.exports = RedisConnectionPool;