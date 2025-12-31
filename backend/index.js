const express = require("express");
const http = require("http");
const rateLimit = require("express-rate-limit");
const logger = require('./logger');
const { register, databaseConnectionsTotal, databaseConnectionsActive, databaseQueryDuration, businessMetrics } = require('./metrics');
const { correlationIdMiddleware, requestLoggingMiddleware, errorLoggingMiddleware } = require('./middleware');
const HealthChecker = require('./health');
const RedisConnectionPool = require('./redis');
const DatabaseConnectionPool = require('./database');
const WebSocketService = require('./services/websocketService');
const EmailService = require('./services/emailService');
const EmailSchedulerService = require('./services/emailSchedulerService');
const { router: authRoutes, initializeController: initializeAuthController } = require('./routes/auth');
const { router: productRoutes, initializeController: initializeProductController } = require('./routes/products');
const { router: cartRoutes, initializeController: initializeCartController } = require('./routes/cart');
const { router: paymentRoutes, initializeController: initializePaymentController } = require('./routes/payments');
const { router: adminRoutes, initializeController: initializeAdminController } = require('./routes/admin');
const { router: emailRoutes, initializeController: initializeEmailController } = require('./routes/email');
const { router: reviewRoutes, initializeController: initializeReviewController } = require('./routes/reviews');
const { router: searchRoutes, initializeSearchRoutes } = require('./routes/search');
const { router: promotionRoutes, initializeController: initializePromotionController } = require('./routes/promotions');
require("dotenv").config();

const app = express();
const server = http.createServer(app);

// Middleware setup
app.use(express.json());
app.use(correlationIdMiddleware);
app.use(requestLoggingMiddleware);

// Database connection pool initialization
const dbPool = new DatabaseConnectionPool();
let pool = null;

// Redis connection pool initialization
const redisPool = new RedisConnectionPool();

// WebSocket service initialization
const webSocketService = new WebSocketService();

// Email service initialization
const emailService = new EmailService();

// Email scheduler service initialization
let emailSchedulerService = null;

// Initialize database connection
(async () => {
  try {
    pool = await dbPool.initialize();
    logger.info('Database connection pool initialized successfully');

    // Initialize email service
    await emailService.initialize();

    // Initialize email scheduler service
    emailSchedulerService = new EmailSchedulerService(dbPool, emailService);
    emailSchedulerService.start();

    // Initialize auth controller after database is ready
    initializeAuthController(dbPool, redisPool, webSocketService, emailService);
    initializeProductController(dbPool, redisPool, webSocketService, emailService);
    initializeCartController(dbPool, redisPool, webSocketService, emailService);
    initializePaymentController(dbPool, redisPool, webSocketService, emailService);
    initializeAdminController(dbPool, redisPool, webSocketService, emailService);
    initializeEmailController(dbPool, redisPool, webSocketService, emailService);
    initializeReviewController(dbPool, redisPool, webSocketService, emailService);
    initializeSearchRoutes(dbPool, redisPool);
    initializePromotionController(dbPool, redisPool, webSocketService, emailService);
  } catch (error) {
    logger.error('Failed to initialize database connection pool', { error: error.message });
    process.exit(1);
  }
})();

// Initialize health checker
const healthChecker = new HealthChecker(dbPool, redisPool);

// Monitor database connection pool
if (pool) {
  pool.on('connect', () => {
    databaseConnectionsActive.inc();
    logger.debug('Database connection established');
  });

  pool.on('remove', () => {
    databaseConnectionsActive.dec();
    logger.debug('Database connection removed');
  });

  pool.on('error', (err) => {
    logger.error('Database pool error', { error: err.message });
    businessMetrics.apiErrors.labels('database_error', 'pool').inc();
  });

  // Update total connections metric
  setInterval(() => {
    databaseConnectionsTotal.set(pool.totalCount);
  }, 5000);
}

// Rate limiting
const productsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs for /products
});

const healthLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // limit each IP to 60 health check requests per minute
});

// Metrics endpoint
app.get("/metrics", async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    logger.error('Error generating metrics', {
      correlationId: req.correlationId,
      error: err.message
    });
    res.status(500).end(err);
  }
});

// Comprehensive health check endpoint
app.get("/health", healthLimiter, async (req, res) => {
  try {
    const healthResult = await healthChecker.performHealthCheck();

    const statusCode = healthResult.status === 'healthy' ? 200 :
      healthResult.status === 'degraded' ? 200 : 503;

    logger.info('Health check completed', {
      correlationId: req.correlationId,
      status: healthResult.status,
      responseTime: healthResult.responseTime
    });

    res.status(statusCode).json({
      ...healthResult,
      correlationId: req.correlationId
    });
  } catch (err) {
    logger.error('Health check failed', {
      correlationId: req.correlationId,
      error: err.message
    });

    res.status(503).json({
      status: "unhealthy",
      error: "Health check failed",
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId
    });
  }
});

// Kubernetes readiness probe endpoint
app.get("/ready", async (req, res) => {
  try {
    const readinessResult = await healthChecker.performReadinessCheck();

    const statusCode = readinessResult.status === 'ready' ? 200 : 503;

    logger.debug('Readiness check completed', {
      correlationId: req.correlationId,
      status: readinessResult.status
    });

    res.status(statusCode).json({
      ...readinessResult,
      correlationId: req.correlationId
    });
  } catch (err) {
    logger.error('Readiness check failed', {
      correlationId: req.correlationId,
      error: err.message
    });

    res.status(503).json({
      status: "not_ready",
      reason: "Readiness check failed",
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId
    });
  }
});

// Kubernetes liveness probe endpoint (simple)
app.get("/live", (req, res) => {
  res.status(200).json({
    status: "alive",
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId
  });
});

// Products endpoint with enhanced logging, metrics, and caching
app.get("/products", productsLimiter, async (req, res) => {
  const startTime = Date.now();
  const cacheKey = 'products:all';

  try {
    logger.info('Fetching products', {
      correlationId: req.correlationId,
      userId: req.user?.id
    });

    // Try to get from cache first
    let cachedProducts = null;
    if (redisPool && redisPool.isConnected) {
      cachedProducts = await redisPool.getCachedData(cacheKey);
      if (cachedProducts) {
        logger.info('Products served from cache', {
          correlationId: req.correlationId,
          productCount: cachedProducts.length,
          userId: req.user?.id
        });

        businessMetrics.productsViewed.inc();

        return res.json({
          data: cachedProducts,
          count: cachedProducts.length,
          timestamp: new Date().toISOString(),
          correlationId: req.correlationId,
          source: 'cache'
        });
      }
    }

    // Fetch from database if not in cache
    const result = await dbPool.query("SELECT * FROM products");
    const queryTime = Date.now() - startTime;

    databaseQueryDuration.labels('select_products').observe(queryTime / 1000);
    businessMetrics.productsViewed.inc();

    // Cache the results for 5 minutes
    if (redisPool && redisPool.isConnected) {
      await redisPool.setCachedData(cacheKey, result.rows, 300);
    }

    logger.info('Products fetched from database', {
      correlationId: req.correlationId,
      productCount: result.rows.length,
      dbResponseTime: queryTime,
      userId: req.user?.id
    });

    res.json({
      data: result.rows,
      count: result.rows.length,
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
      source: 'database'
    });
  } catch (err) {
    const queryTime = Date.now() - startTime;

    databaseQueryDuration.labels('select_products').observe(queryTime / 1000);
    businessMetrics.apiErrors.labels('database_error', '/products').inc();

    logger.error('Error fetching products', {
      correlationId: req.correlationId,
      error: err.message,
      dbResponseTime: queryTime,
      userId: req.user?.id
    });

    throw err; // Let error middleware handle it
  }
});

// Mount auth routes
app.use('/api/auth', authRoutes);

// Mount product routes
app.use('/api/products', productRoutes);

// Mount cart routes
app.use('/api/cart', cartRoutes);

// Mount payment routes
app.use('/api/payments', paymentRoutes);

// Mount admin routes
app.use('/api/admin', adminRoutes);

// Mount email routes
app.use('/api/email', emailRoutes);

// Mount review routes
app.use('/api/reviews', reviewRoutes);

// Mount search routes
app.use('/api/search', searchRoutes);

// Mount promotion routes
app.use('/api/promotions', promotionRoutes);

// Error handling middleware (must be last)
app.use(errorLoggingMiddleware);

const httpServer = app.listen(5000, () => {
  logger.info("Backend server started", {
    port: 5000,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    redisEnabled: !!redisPool
  });

  // Initialize WebSocket service after server starts
  webSocketService.initialize(httpServer, dbPool, redisPool);
});

// Graceful shutdown handling
let isShuttingDown = false;

const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  if (isShuttingDown) {
    logger.warn('Shutdown already in progress...');
    return;
  }

  isShuttingDown = true;
  healthChecker.setShuttingDown(true);

  // Stop accepting new connections
  httpServer.close((err) => {
    if (err) {
      logger.error('Error during server shutdown', { error: err.message });
      process.exit(1);
    }

    logger.info('HTTP server closed');

    // Close database connections
    const dbClosePromise = new Promise((resolve) => {
      dbPool.close().then(() => {
        logger.info('Database connection pool closed');
        resolve();
      }).catch((err) => {
        logger.warn('Error closing database connection pool', { error: err.message });
        resolve();
      });
    });

    // Close Redis connection
    const redisClosePromise = redisPool ?
      redisPool.disconnect().then(() => {
        logger.info('Redis connection pool closed');
      }).catch((err) => {
        logger.warn('Error closing Redis connection pool', { error: err.message });
      }) :
      Promise.resolve();

    // Stop email scheduler
    const emailSchedulerClosePromise = emailSchedulerService ?
      Promise.resolve().then(() => {
        emailSchedulerService.stop();
        logger.info('Email scheduler service stopped');
      }) :
      Promise.resolve();

    Promise.all([dbClosePromise, redisClosePromise, emailSchedulerClosePromise]).then(() => {
      logger.info('Graceful shutdown completed');
      process.exit(0);
    });
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', {
    error: err.message,
    stack: err.stack
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', {
    reason: reason?.message || reason,
    promise: promise.toString()
  });
  process.exit(1);
});

// Export app for testing
module.exports = app;