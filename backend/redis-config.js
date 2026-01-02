const Redis = require('ioredis');
const logger = require('./logger');

class RedisConnectionManager {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.connectionAttempts = 0;
        this.maxRetries = 5;
        this.retryDelay = 1000;
        this.maxRetryDelay = 30000;
    }

    async initialize() {
        try {
            const redisConfig = this.getRedisConfig();

            if (!redisConfig) {
                logger.warn('Redis configuration not found, skipping Redis initialization');
                return null;
            }

            this.client = new Redis(redisConfig);
            this.setupEventHandlers();

            await this.testConnection();
            this.isConnected = true;

            logger.info('Redis connection initialized successfully', {
                host: redisConfig.host,
                port: redisConfig.port,
                db: redisConfig.db || 0
            });

            return this.client;
        } catch (error) {
            logger.error('Failed to initialize Redis connection', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    getRedisConfig() {
        // Check for REDIS_URL first (common in cloud environments)
        if (process.env.REDIS_URL) {
            return {
                ...this.parseRedisUrl(process.env.REDIS_URL),
                retryDelayOnFailover: 100,
                enableReadyCheck: true,
                maxRetriesPerRequest: 3,
                lazyConnect: true,
                keepAlive: 30000,
                connectTimeout: 10000,
                commandTimeout: 5000,
                tls: this.getTLSConfig()
            };
        }

        // Individual Redis configuration parameters
        if (process.env.REDIS_HOST) {
            return {
                host: process.env.REDIS_HOST,
                port: parseInt(process.env.REDIS_PORT) || 6379,
                password: process.env.REDIS_PASSWORD || undefined,
                db: parseInt(process.env.REDIS_DB) || 0,
                retryDelayOnFailover: 100,
                enableReadyCheck: true,
                maxRetriesPerRequest: 3,
                lazyConnect: true,
                keepAlive: 30000,
                connectTimeout: 10000,
                commandTimeout: 5000,
                tls: this.getTLSConfig()
            };
        }

        return null;
    }

    parseRedisUrl(url) {
        try {
            const parsed = new URL(url);
            return {
                host: parsed.hostname,
                port: parseInt(parsed.port) || 6379,
                password: parsed.password || undefined,
                db: parseInt(parsed.pathname.slice(1)) || 0
            };
        } catch (error) {
            logger.error('Failed to parse Redis URL', { error: error.message });
            throw error;
        }
    }

    getTLSConfig() {
        // Enable TLS for production environments (AWS ElastiCache with encryption)
        if (process.env.NODE_ENV === 'production' || process.env.REDIS_TLS === 'true') {
            return {
                rejectUnauthorized: false,
                ca: process.env.REDIS_TLS_CA || undefined,
                cert: process.env.REDIS_TLS_CERT || undefined,
                key: process.env.REDIS_TLS_KEY || undefined
            };
        }

        return undefined;
    }

    setupEventHandlers() {
        this.client.on('connect', () => {
            logger.debug('Redis client connected');
        });

        this.client.on('ready', () => {
            logger.info('Redis client ready');
            this.isConnected = true;
        });

        this.client.on('error', (error) => {
            logger.error('Redis client error', { error: error.message });
            this.isConnected = false;
        });

        this.client.on('close', () => {
            logger.warn('Redis connection closed');
            this.isConnected = false;
        });

        this.client.on('reconnecting', (delay) => {
            logger.info('Redis client reconnecting', { delay });
        });

        this.client.on('end', () => {
            logger.warn('Redis connection ended');
            this.isConnected = false;
        });
    }

    async testConnection() {
        try {
            const start = Date.now();
            const result = await this.client.ping();
            const responseTime = Date.now() - start;

            if (result !== 'PONG') {
                throw new Error('Redis ping test failed');
            }

            logger.info('Redis connection test successful', {
                responseTime: `${responseTime}ms`
            });
        } catch (error) {
            logger.error('Redis connection test failed', { error: error.message });
            throw error;
        }
    }

    async healthCheck() {
        if (!this.client || !this.isConnected) {
            return {
                status: 'unhealthy',
                message: 'Redis client not initialized or not connected'
            };
        }

        try {
            const start = Date.now();
            const result = await this.client.ping();
            const responseTime = Date.now() - start;

            if (result !== 'PONG') {
                throw new Error('Redis ping failed');
            }

            const info = await this.client.info('server');
            const serverInfo = this.parseRedisInfo(info);

            return {
                status: 'healthy',
                responseTime: `${responseTime}ms`,
                message: 'Redis connection is healthy',
                details: {
                    version: serverInfo.redis_version,
                    mode: serverInfo.redis_mode,
                    uptime: serverInfo.uptime_in_seconds,
                    connected_clients: serverInfo.connected_clients
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                message: `Redis health check failed: ${error.message}`
            };
        }
    }

    parseRedisInfo(info) {
        const lines = info.split('\r\n');
        const result = {};

        lines.forEach(line => {
            if (line && !line.startsWith('#')) {
                const [key, value] = line.split(':');
                if (key && value) {
                    result[key] = value;
                }
            }
        });

        return result;
    }

    async set(key, value, ttl = null) {
        if (!this.isConnected) {
            throw new Error('Redis client not connected');
        }

        try {
            if (ttl) {
                return await this.client.setex(key, ttl, JSON.stringify(value));
            } else {
                return await this.client.set(key, JSON.stringify(value));
            }
        } catch (error) {
            logger.error('Redis SET operation failed', {
                key,
                error: error.message
            });
            throw error;
        }
    }

    async get(key) {
        if (!this.isConnected) {
            throw new Error('Redis client not connected');
        }

        try {
            const value = await this.client.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            logger.error('Redis GET operation failed', {
                key,
                error: error.message
            });
            throw error;
        }
    }

    async del(key) {
        if (!this.isConnected) {
            throw new Error('Redis client not connected');
        }

        try {
            return await this.client.del(key);
        } catch (error) {
            logger.error('Redis DEL operation failed', {
                key,
                error: error.message
            });
            throw error;
        }
    }

    async close() {
        if (this.client) {
            try {
                await this.client.quit();
                this.isConnected = false;
                logger.info('Redis connection closed');
            } catch (error) {
                logger.error('Error closing Redis connection', { error: error.message });
                throw error;
            }
        }
    }
}

module.exports = RedisConnectionManager;