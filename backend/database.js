const { Pool } = require('pg');
const logger = require('./logger');

class DatabaseConnectionPool {
    constructor() {
        this.pool = null;
        this.isConnected = false;
        this.connectionAttempts = 0;
        this.maxRetries = 5;
        this.retryDelay = 1000; // Start with 1 second
        this.maxRetryDelay = 30000; // Max 30 seconds
    }

    async initialize() {
        try {
            const dbConfig = this.getDatabaseConfig();

            if (!dbConfig) {
                throw new Error('Database configuration not found');
            }

            this.pool = new Pool(dbConfig);
            this.setupEventHandlers();

            await this.testConnection();
            this.isConnected = true;

            logger.info('Database connection pool initialized successfully', {
                host: dbConfig.host,
                database: dbConfig.database,
                user: dbConfig.user,
                maxConnections: dbConfig.max
            });

            return this.pool;
        } catch (error) {
            logger.error('Failed to initialize database connection pool', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    getDatabaseConfig() {
        // Check for DATABASE_URL first (common in cloud environments)
        if (process.env.DATABASE_URL) {
            return {
                connectionString: process.env.DATABASE_URL,
                max: parseInt(process.env.DB_POOL_MAX) || 20,
                idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
                connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 5000,
                maxUses: parseInt(process.env.DB_MAX_USES) || 7500,
                ssl: this.getSSLConfig()
            };
        }

        // Individual database configuration parameters
        if (process.env.DB_HOST) {
            return {
                host: process.env.DB_HOST,
                port: parseInt(process.env.DB_PORT) || 5432,
                database: process.env.DB_NAME || 'dhakacart',
                user: process.env.DB_USER || 'postgres',
                password: process.env.DB_PASSWORD,
                max: parseInt(process.env.DB_POOL_MAX) || 20,
                idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
                connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 5000,
                maxUses: parseInt(process.env.DB_MAX_USES) || 7500,
                ssl: this.getSSLConfig()
            };
        }

        return null;
    }

    getSSLConfig() {
        // In production environments (AWS RDS), SSL is required
        if (process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true') {
            return {
                rejectUnauthorized: false,
                ca: process.env.DB_SSL_CA || undefined,
                cert: process.env.DB_SSL_CERT || undefined,
                key: process.env.DB_SSL_KEY || undefined
            };
        }

        return false;
    }

    setupEventHandlers() {
        this.pool.on('connect', (client) => {
            logger.debug('Database client connected', {
                processID: client.processID
            });
        });

        this.pool.on('acquire', (client) => {
            logger.debug('Database client acquired from pool', {
                processID: client.processID
            });
        });

        this.pool.on('remove', (client) => {
            logger.debug('Database client removed from pool', {
                processID: client.processID
            });
        });

        this.pool.on('error', (err, client) => {
            logger.error('Database pool error', {
                error: err.message,
                processID: client?.processID
            });
        });
    }

    async testConnection() {
        try {
            const client = await this.pool.connect();
            const result = await client.query('SELECT NOW() as timestamp, version() as version');
            client.release();

            logger.info('Database connection test successful', {
                timestamp: result.rows[0].timestamp,
                version: result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1]
            });
        } catch (error) {
            logger.error('Database connection test failed', { error: error.message });
            throw error;
        }
    }

    async query(text, params = []) {
        return await this.queryWithRetry(text, params);
    }

    async queryWithRetry(text, params = [], maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const start = Date.now();
                const result = await this.pool.query(text, params);
                const duration = Date.now() - start;

                logger.debug('Database query executed', {
                    query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
                    duration,
                    rows: result.rowCount,
                    attempt
                });

                return result;
            } catch (error) {
                logger.warn('Database query attempt failed', {
                    attempt,
                    maxRetries,
                    error: error.message,
                    query: text.substring(0, 100) + (text.length > 100 ? '...' : '')
                });

                if (attempt === maxRetries) {
                    logger.error('Database query failed after all retries', {
                        error: error.message,
                        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
                        totalAttempts: maxRetries
                    });
                    throw error;
                }

                // Exponential backoff with jitter
                const delay = Math.min(
                    this.retryDelay * Math.pow(2, attempt - 1) + Math.random() * 1000,
                    this.maxRetryDelay
                );

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    async transaction(callback) {
        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');

            const result = await callback(client);

            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Database transaction rolled back', { error: error.message });
            throw error;
        } finally {
            client.release();
        }
    }

    async healthCheck() {
        if (!this.pool || !this.isConnected) {
            return {
                status: 'unhealthy',
                message: 'Database pool not initialized'
            };
        }

        try {
            const start = Date.now();
            const result = await this.pool.query('SELECT 1 as health_check, NOW() as timestamp');
            const responseTime = Date.now() - start;

            return {
                status: 'healthy',
                responseTime: `${responseTime}ms`,
                message: 'Database connection is healthy',
                details: {
                    totalConnections: this.pool.totalCount,
                    idleConnections: this.pool.idleCount,
                    waitingClients: this.pool.waitingCount,
                    timestamp: result.rows[0].timestamp
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                message: `Database health check failed: ${error.message}`
            };
        }
    }

    async close() {
        if (this.pool) {
            try {
                await this.pool.end();
                this.isConnected = false;
                logger.info('Database connection pool closed');
            } catch (error) {
                logger.error('Error closing database connection pool', { error: error.message });
                throw error;
            }
        }
    }

    // Getter methods for pool statistics
    get totalCount() {
        return this.pool ? this.pool.totalCount : 0;
    }

    get idleCount() {
        return this.pool ? this.pool.idleCount : 0;
    }

    get waitingCount() {
        return this.pool ? this.pool.waitingCount : 0;
    }
}

module.exports = DatabaseConnectionPool;